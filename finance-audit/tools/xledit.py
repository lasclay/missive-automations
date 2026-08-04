#!/usr/bin/env python3
"""Surgical xlsx editing: set formulas, constants and strings on existing or new
cells by rewriting the sheet XML. openpyxl is not used for writing because it
drops this workbook's drawings, comments and Google round-trip metadata."""
import re, zipfile, shutil, os
from openpyxl.utils import get_column_letter, column_index_from_string

CELL_RE = re.compile(r'<c r="([A-Z]+)(\d+)"([^>/]*)(?:/>|>(.*?)</c>)', re.S)
ROW_RE = re.compile(r'<row r="(\d+)"([^>]*?)(?:/>|>(.*?)</row>)', re.S)


def esc(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


class Editor:
    def __init__(self, src):
        self.src = src
        z = zipfile.ZipFile(src)
        self.order = [i.filename for i in z.infolist()]
        self.parts = {i.filename: z.read(i.filename) for i in z.infolist()}
        z.close()
        wbx = self.parts['xl/workbook.xml'].decode('utf8')
        rels = dict(re.findall(r'Id="(rId\d+)"[^>]*?Target="([^"]+)"',
                               self.parts['xl/_rels/workbook.xml.rels'].decode('utf8')))
        self.sheetpart = {}
        for m in re.finditer(r'<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"', wbx):
            name = (m.group(1).replace('&amp;', '&').replace('&lt;', '<')
                    .replace('&gt;', '>').replace('&quot;', '"').replace('&apos;', "'"))
            self.sheetpart[name] = 'xl/' + rels[m.group(2)]
        self.log = []

    # ---------------------------------------------------------------- helpers
    def _sheet(self, name):
        return self.parts[self.sheetpart[name]].decode('utf8')

    def _save_sheet(self, name, xml):
        self.parts[self.sheetpart[name]] = xml.encode('utf8')

    @staticmethod
    def _cell_xml(coord, style_attr, kind, payload):
        """kind: 'f' formula, 'n' number, 's' inline string, 'blank'"""
        if kind == 'f':
            return f'<c r="{coord}"{style_attr}><f>{esc(payload)}</f><v>0</v></c>'
        if kind == 'n':
            return f'<c r="{coord}"{style_attr}><v>{payload}</v></c>'
        if kind == 's':
            return (f'<c r="{coord}"{style_attr} t="inlineStr"><is><t xml:space="preserve">'
                    f'{esc(payload)}</t></is></c>')
        return f'<c r="{coord}"{style_attr}/>'

    def set(self, sheet, coord, value, note=''):
        """value: str starting with '=' -> formula ; int/float -> number ;
        str -> inline string ; None -> blank the cell."""
        m = re.match(r'([A-Z]+)(\d+)$', coord)
        col, row = m.group(1), int(m.group(2))
        cidx = column_index_from_string(col)
        if value is None:
            kind, payload = 'blank', None
        elif isinstance(value, str) and value.startswith('='):
            kind, payload = 'f', value[1:]
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            kind, payload = 'n', repr(value)
        else:
            kind, payload = 's', value

        xml = self._sheet(sheet)
        rm = None
        for cand in ROW_RE.finditer(xml):
            if int(cand.group(1)) == row:
                rm = cand; break
        if rm is None:
            # insert a whole new row, in order
            newrow = f'<row r="{row}">' + self._cell_xml(coord, '', kind, payload) + '</row>'
            inserted = False
            for cand in ROW_RE.finditer(xml):
                if int(cand.group(1)) > row:
                    xml = xml[:cand.start()] + newrow + xml[cand.start():]
                    inserted = True; break
            if not inserted:
                i = xml.rfind('</sheetData>')
                xml = xml[:i] + newrow + xml[i:]
            self._save_sheet(sheet, xml)
            self.log.append((sheet, coord, 'new-row', value, note))
            return

        body = rm.group(3) or ''
        # locate the cell inside the row
        target, before_end = None, None
        for cm in CELL_RE.finditer(body):
            if cm.group(1) == col and int(cm.group(2)) == row:
                target = cm; break
            if column_index_from_string(cm.group(1)) > cidx and before_end is None:
                before_end = cm.start()
        if target is not None:
            style = re.search(r'\ss="(\d+)"', target.group(3) or '')
            style_attr = f' s="{style.group(1)}"' if style else ''
            new = self._cell_xml(coord, style_attr, kind, payload)
            newbody = body[:target.start()] + new + body[target.end():]
        else:
            # Cellule créée : elle prend le style de sa voisine la plus proche
            # dans la rangée. Sans ça, elle hérite du format par défaut de la
            # rangée — souvent un pourcentage dans ce classeur, ce qui affiche
            # un montant de 952 470 $ comme « 95247055 % ».
            best, bestd = None, None
            for cm in CELL_RE.finditer(body):
                st = re.search(r'\ss="(\d+)"', cm.group(3) or '')
                if not st:
                    continue
                d = abs(column_index_from_string(cm.group(1)) - cidx)
                if bestd is None or d < bestd:
                    best, bestd = st.group(1), d
            style_attr = f' s="{best}"' if best else ''
            new = self._cell_xml(coord, style_attr, kind, payload)
            if before_end is None:
                newbody = body + new
            else:
                newbody = body[:before_end] + new + body[before_end:]
        rowattrs = rm.group(2)
        newrow = f'<row r="{row}"{rowattrs}>{newbody}</row>'
        xml = xml[:rm.start()] + newrow + xml[rm.end():]
        self._save_sheet(sheet, xml)
        self.log.append((sheet, coord, 'set', value, note))

    def expand_shared(self):
        """Rewrite every t="shared" formula as a standalone formula.

        Overwriting a shared-group master would otherwise orphan its members
        (Excel repairs the file and drops them). Expanding first also removes
        the one group in this workbook whose master was already missing."""
        import xlread
        total = 0
        for sheet, part in self.sheetpart.items():
            xml = self.parts[part].decode('utf8')
            masters = {}
            for cm in CELL_RE.finditer(xml):
                body = cm.group(4) or ''
                fm = re.search(r'<f([^>]*)>(.*?)</f>', body, re.S)
                if not fm:
                    continue
                a = dict(re.findall(r'(\w+)="([^"]*)"', fm.group(1)))
                if a.get('t') == 'shared' and a.get('si') and fm.group(2):
                    masters[a['si']] = (cm.group(1) + cm.group(2), fm.group(2))
            if not masters and 't="shared"' not in xml:
                continue
            out, last = [], 0
            for cm in CELL_RE.finditer(xml):
                body = cm.group(4)
                if body is None:
                    continue
                fm = re.search(r'<f([^>]*)>(.*?)</f>|<f([^>]*)/>', body, re.S)
                if not fm:
                    continue
                attrs = fm.group(1) if fm.group(1) is not None else fm.group(3)
                a = dict(re.findall(r'(\w+)="([^"]*)"', attrs or ''))
                if a.get('t') != 'shared':
                    continue
                si = a.get('si')
                coord = cm.group(1) + cm.group(2)
                if si in masters:
                    src, ftext = masters[si]
                    new_f = xlread.translate(ftext, src, coord)
                else:
                    continue
                start = cm.start(4) + fm.start()
                end = cm.start(4) + (fm.end())
                out.append(xml[last:start])
                out.append(f'<f>{new_f}</f>')
                last = end
                total += 1
            if out:
                out.append(xml[last:])
                self.parts[part] = ''.join(out).encode('utf8')
        self.log.append(('(workbook)', '-', 'expand-shared-formulas', total, ''))
        return total

    def copy_style(self, sheet, src_coord, dst_coord):
        xml = self._sheet(sheet)
        sm = re.search(r'<c r="%s"([^>/]*)' % src_coord, xml)
        if not sm: return
        st = re.search(r'\ss="(\d+)"', sm.group(1))
        if not st: return
        dm = re.search(r'<c r="%s"([^>/]*)' % dst_coord, xml)
        if not dm: return
        attrs = dm.group(1)
        if re.search(r'\ss="\d+"', attrs):
            newattrs = re.sub(r'\ss="\d+"', f' s="{st.group(1)}"', attrs)
        else:
            newattrs = attrs + f' s="{st.group(1)}"'
        xml = xml[:dm.start(1)] + newattrs + xml[dm.end(1):]
        self._save_sheet(sheet, xml)

    def drop_external_links(self):
        keep, dropped = [], []
        for n in self.order:
            if n.startswith('xl/externalLinks/'):
                dropped.append(n); self.parts.pop(n, None)
            else:
                keep.append(n)
        self.order = keep
        ct = self.parts['[Content_Types].xml'].decode('utf8')
        ct = re.sub(r'<Override PartName="/xl/externalLinks/[^"]*"[^/]*/>', '', ct)
        self.parts['[Content_Types].xml'] = ct.encode('utf8')
        r = self.parts['xl/_rels/workbook.xml.rels'].decode('utf8')
        r = re.sub(r'<Relationship Id="rId\d+"[^>]*Target="externalLinks/[^"]*"[^>]*/>', '', r)
        self.parts['xl/_rels/workbook.xml.rels'] = r.encode('utf8')
        wb = self.parts['xl/workbook.xml'].decode('utf8')
        wb = re.sub(r'<externalReferences>.*?</externalReferences>', '', wb, flags=re.S)
        self.parts['xl/workbook.xml'] = wb.encode('utf8')
        self.log.append(('(workbook)', '-', 'drop-external-links', dropped, ''))

    def set_full_calc(self):
        wb = self.parts['xl/workbook.xml'].decode('utf8')
        if '<calcPr' in wb:
            wb = re.sub(r'<calcPr[^/]*/>', '<calcPr fullCalcOnLoad="1" calcId="191029"/>', wb)
        else:
            wb = wb.replace('<sheets>', '<calcPr fullCalcOnLoad="1" calcId="191029"/><sheets>')
        self.parts['xl/workbook.xml'] = wb.encode('utf8')

    def show_sheet(self, name):
        wb = self.parts['xl/workbook.xml'].decode('utf8')
        wb = re.sub(r'(<sheet state=")hidden(" name="%s")' % re.escape(name), r'\1visible\2', wb)
        self.parts['xl/workbook.xml'] = wb.encode('utf8')

    def add_sheet(self, name, rows, after=None, styles=None, widths=None,
                  first=False):
        """rows: list of (coord, value) ; creates a bare new worksheet.

        styles: {coord: index de `cellXfs`} — un nombre sans format se lit
        « 977339.12 » au lieu de « 977 339 $ », ce qui suffit à faire douter
        un lecteur du reste de la feuille.
        widths: [(colonne_min, colonne_max, largeur)] ; first: mettre l'onglet
        en tête plutôt qu'à la fin.
        """
        styles = styles or {}
        nums = [int(m.group(1)) for m in re.finditer(r'sheet(\d+)\.xml',
                ' '.join(self.order))]
        n = max(nums) + 1
        part = f'xl/worksheets/sheet{n}.xml'
        cells = {}
        for coord, val in rows:
            m = re.match(r'([A-Z]+)(\d+)$', coord)
            cells.setdefault(int(m.group(2)), []).append((column_index_from_string(m.group(1)), coord, val))
        body = []
        for r in sorted(cells):
            body.append(f'<row r="{r}">')
            for _, coord, val in sorted(cells[r]):
                if val is None:
                    continue
                s = f' s="{styles[coord]}"' if coord in styles else ''
                if isinstance(val, str) and val.startswith('='):
                    body.append(f'<c r="{coord}"{s}><f>{esc(val[1:])}</f><v>0</v></c>')
                elif isinstance(val, (int, float)) and not isinstance(val, bool):
                    body.append(f'<c r="{coord}"{s}><v>{val!r}</v></c>')
                else:
                    body.append(f'<c r="{coord}"{s} t="inlineStr"><is><t xml:space="preserve">{esc(val)}</t></is></c>')
            body.append('</row>')
        cols = widths or [(1, 1, 52), (2, 8, 16)]
        colxml = ''.join(f'<col min="{a}" max="{b}" width="{w}" customWidth="1"/>'
                         for a, b, w in cols)
        xml = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
               '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
               '<sheetPr/><sheetViews><sheetView workbookViewId="0"/></sheetViews>'
               '<sheetFormatPr defaultRowHeight="15"/>'
               f'<cols>{colxml}</cols>'
               '<sheetData>' + ''.join(body) + '</sheetData></worksheet>')
        self.parts[part] = xml.encode('utf8')
        self.order.append(part)
        # content types
        ct = self.parts['[Content_Types].xml'].decode('utf8')
        ct = ct.replace('</Types>', f'<Override PartName="/{part}" ContentType='
                        '"application/vnd.openxmlformats-officedocument.'
                        'spreadsheetml.worksheet+xml"/></Types>')
        self.parts['[Content_Types].xml'] = ct.encode('utf8')
        # rels
        r = self.parts['xl/_rels/workbook.xml.rels'].decode('utf8')
        ids = [int(x) for x in re.findall(r'Id="rId(\d+)"', r)]
        rid = f'rId{max(ids)+1}'
        r = r.replace('</Relationships>',
                      f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/'
                      f'officeDocument/2006/relationships/worksheet" '
                      f'Target="worksheets/sheet{n}.xml"/></Relationships>')
        self.parts['xl/_rels/workbook.xml.rels'] = r.encode('utf8')
        # workbook
        wb = self.parts['xl/workbook.xml'].decode('utf8')
        sids = [int(x) for x in re.findall(r'sheetId="(\d+)"', wb)]
        entry = (f'<sheet state="visible" name="{esc(name)}" sheetId="{max(sids)+1}" '
                 f'r:id="{rid}"/>')
        if after:
            m = re.search(r'<sheet [^>]*name="%s"[^>]*/>' % re.escape(after), wb)
            wb = wb[:m.end()] + entry + wb[m.end():]
        elif first:
            wb = re.sub(r'<sheets>', '<sheets>' + entry, wb, count=1)
        else:
            wb = wb.replace('</sheets>', entry + '</sheets>')
        self.parts['xl/workbook.xml'] = wb.encode('utf8')
        self.log.append(('(workbook)', '-', 'add-sheet', name, ''))


    def remove_sheet(self, name):
        """Retire une feuille du classeur : la partie, sa relation, son entrée
        de type de contenu et sa ligne dans workbook.xml. Ne pas retirer une
        feuille dont une formule dépend encore : le classeur porterait des
        références mortes."""
        part = self.sheetpart.pop(name)
        rid = None
        r = self.parts['xl/_rels/workbook.xml.rels'].decode('utf8')
        target = part[len('xl/'):]
        m = re.search(r'<Relationship Id="(rId\d+)"[^>]*Target="%s"[^>]*/>'
                      % re.escape(target), r)
        if m:
            rid = m.group(1)
            r = r[:m.start()] + r[m.end():]
            self.parts['xl/_rels/workbook.xml.rels'] = r.encode('utf8')
        wb = self.parts['xl/workbook.xml'].decode('utf8')
        wb = re.sub(r'<sheet[^>]*name="%s"[^>]*/>' % re.escape(esc(name)), '', wb)
        self.parts['xl/workbook.xml'] = wb.encode('utf8')
        ct = self.parts['[Content_Types].xml'].decode('utf8')
        ct = ct.replace('<Override PartName="/%s" ContentType="application/vnd.'
                        'openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                        % part, '')
        self.parts['[Content_Types].xml'] = ct.encode('utf8')
        self.parts.pop(part, None)
        self.order = [n for n in self.order if n != part]
        rels = part.replace('worksheets/', 'worksheets/_rels/') + '.rels'
        self.parts.pop(rels, None)
        self.order = [n for n in self.order if n != rels]
        self.log.append(('(workbook)', '-', 'remove-sheet', name, rid or ''))

    def save(self, dst):
        z = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
        for n in self.order:
            if n in self.parts:
                z.writestr(n, self.parts[n])
        z.close()
