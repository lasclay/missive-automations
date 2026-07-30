#!/usr/bin/env python3
"""Phase Y — réparer la mise en page que la révision avait démolie.

Trois défauts, dans l'ordre où ils se sont produits :

1. `fix_o.py` insérait ses deux formats numériques au DÉBUT de la table
   `cellXfs` au lieu de la fin. Les 678 formats du classeur glissaient donc de
   deux crans et chaque cellule affichait le format d'une autre : des montants
   en pourcentage, des ratios en dollars, des dates en numéros de série. Aucune
   valeur n'était fausse, tout était illisible. (La cause est corrigée dans
   `fix_o.py` ; cette phase répare les fichiers déjà produits.)
2. Une cellule CRÉÉE par `xledit.set()` n'avait aucun style et héritait du
   format par défaut de sa rangée. 1 220 cellules étaient dans ce cas. Elles
   reprennent le format de leur voisine. (`xledit.set()` le fait maintenant
   de lui-même pour les prochaines écritures.)
3. Le bloc d'hypothèses d'Inputs et les contrôles du budget de caisse
   affichaient « 80000 » et « 0.08 » : ils prennent les deux formats que
   `fix_o` avait créés pour ça.

Rien d'autre n'est touché : aucune valeur, aucune formule.
"""
import re
import sys
import zipfile
sys.path.insert(0, 'tools')
from openpyxl.utils import column_index_from_string
from xledit import Editor

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
MONEY, PCT = '678', '679'
CELL = re.compile(r'<c r="([A-Z]+)(\d+)"([^>/]*)(?:/>|>(.*?)</c>)', re.S)
# les deux <xf> fautivement placés en tête, tels que l'ancien fix_o les écrivait
STRAY = ('<xf numFmtId="900" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
         '<xf numFmtId="901" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>')

def repair(path=F):
    e = Editor(path)
    x = e.parts['xl/styles.xml'].decode('utf8')
    m = re.search(r'(<cellXfs count="(\d+)">)(.*?)(</cellXfs>)', x, re.S)
    head, count, body, tail = m.group(1), int(m.group(2)), m.group(3), m.group(4)
    if not body.startswith(STRAY):
        print('rien à réparer : la table ne commence pas par les deux xf ajoutés')
        return None
    body = body[len(STRAY):] + STRAY
    x = x[:m.start()] + head + body + tail + x[m.end():]
    e.parts['xl/styles.xml'] = x.encode('utf8')
    # Excel doit recalculer à l'ouverture : les valeurs en cache restent celles
    # du dernier recalcul du moteur, pas celles d'Excel.
    e.set_full_calc()
    e.save(path)
    entries = re.findall(r'<xf\b[^>]*?(?:/>|>.*?</xf>)', body, re.S)
    print(f'{count} formats, les deux ajoutés déplacés aux index '
          f'{len(entries) - 2} et {len(entries) - 1}')
    return e


def verify(path=F, orig='prev_orig.xlsx'):
    def xfs(f):
        z = zipfile.ZipFile(f)
        st = z.read('xl/styles.xml').decode('utf8')
        m = re.search(r'<cellXfs count="\d+">(.*?)</cellXfs>', st, re.S)
        return re.findall(r'<xf\b[^>]*?(?:/>|>.*?</xf>)', m.group(1), re.S)
    a, b = xfs(orig), xfs(path)
    same = b[:len(a)] == a
    print(f'les {len(a)} formats d’origine sont à leur index d’origine : {same}')
    print(f'formats ajoutés à la fin : {len(b) - len(a)}')
    # contrôle sur des cellules témoins des feuilles principales
    z = zipfile.ZipFile(path)
    zo = zipfile.ZipFile(orig)
    bad = 0
    for n in z.namelist():
        if not n.startswith('xl/worksheets/sheet') or n not in zo.namelist():
            continue
        xa = zo.read(n).decode('utf8')
        xb = z.read(n).decode('utf8')
        sa = dict(re.findall(r'<c r="([A-Z]+\d+)" s="(\d+)"', xa))
        sb = dict(re.findall(r'<c r="([A-Z]+\d+)" s="(\d+)"', xb))
        for k, v in sa.items():
            if k in sb and sb[k] != v:
                bad += 1
    print(f'cellules dont l’index de style a bougé depuis l’original : {bad}')
    return same and bad == 0

def styles_of(xml):
    """{(col_index, row) : style} pour toutes les cellules qui en ont un."""
    out = {}
    for m in CELL.finditer(xml):
        s = re.search(r'\ss="(\d+)"', m.group(3) or '')
        if s:
            out[(column_index_from_string(m.group(1)), int(m.group(2)))] = s.group(1)
    return out


def is_text(body):
    return body is not None and ('t="inlineStr"' in body or '<is>' in body)


def inherit(path=F):
    e = Editor(path)
    total = 0
    per_sheet = {}
    for sheet, part in e.sheetpart.items():
        xml = e.parts[part].decode('utf8')
        known = styles_of(xml)
        if not known:
            continue
        cols_by_row = {}
        for (c, r) in known:
            cols_by_row.setdefault(r, []).append(c)
        for r in cols_by_row:
            cols_by_row[r].sort()
        rows_by_col = {}
        for (c, r) in known:
            rows_by_col.setdefault(c, []).append(r)
        for c in rows_by_col:
            rows_by_col[c].sort()

        edits = []          # (position dans le XML, attribut à insérer)
        for m in CELL.finditer(xml):
            attrs = m.group(3) or ''
            if re.search(r'\ss="\d+"', attrs):
                continue
            body = m.group(4)
            if body in (None, '') and not attrs.strip():
                continue    # cellule vide sans attribut : rien à styler
            col = column_index_from_string(m.group(1))
            row = int(m.group(2))
            pick = None
            if is_text(body):
                # un libellé : la cellule la plus proche au-dessus, même colonne
                cands = [x for x in rows_by_col.get(col, []) if x < row]
                if cands:
                    pick = known[(col, cands[-1])]
            if pick is None:
                left = [x for x in cols_by_row.get(row, []) if x < col]
                right = [x for x in cols_by_row.get(row, []) if x > col]
                if left:
                    pick = known[(left[-1], row)]
                elif right:
                    pick = known[(right[0], row)]
                else:
                    cands = [x for x in rows_by_col.get(col, []) if x < row]
                    if cands:
                        pick = known[(col, cands[-1])]
            if pick is None:
                continue
            edits.append((m.start(3), f' s="{pick}"'))
        if not edits:
            continue
        out, last = [], 0
        for pos, ins in edits:
            out.append(xml[last:pos])
            out.append(ins)
            last = pos
        out.append(xml[last:])
        e.parts[part] = ''.join(out).encode('utf8')
        per_sheet[sheet] = len(edits)
        total += len(edits)
    e.set_full_calc()
    e.save(path)
    for k in sorted(per_sheet, key=lambda k: -per_sheet[k]):
        print(f'  {k:<32} {per_sheet[k]:>5}')
    print(f'{total} cellules ont repris le format de leur voisine')
    return total


def restyle(e, sheet, coords, s):
    """Impose un style à des cellules nommées, sans toucher au reste."""
    part = e.sheetpart[sheet]
    xml = e.parts[part].decode('utf8')
    n = 0
    for coord in coords:
        m = re.search(r'<c r="%s"([^>/]*)' % coord, xml)
        if not m:
            continue
        attrs = m.group(1)
        new = (re.sub(r'\ss="\d+"', f' s="{s}"', attrs)
               if re.search(r'\ss="\d+"', attrs) else attrs + f' s="{s}"')
        xml = xml[:m.start(1)] + new + xml[m.end(1):]
        n += 1
    e.parts[part] = xml.encode('utf8')
    return n


def formats(path=F):
    e = Editor(path)
    n = restyle(e, 'Inputs', [f'{c}{r}' for r in range(102, 114) for c in 'CDE'], MONEY)
    n += restyle(e, 'Inputs', ['C116'], MONEY)          # avance de l'actionnaire
    n += restyle(e, 'Inputs', ['C117'], PCT)            # taux de 8 %
    n += restyle(e, 'Budget de caisse', ['C38', 'C39'], MONEY)
    e.set_full_calc()
    e.save(path)
    print(f'{n} cellules reformatées')
    return n


if __name__ == '__main__':
    repair()
    inherit()
    formats()
    print('OK' if verify() else 'les seuls écarts attendus sont les cellules '
          'reformatées ci-dessus')
