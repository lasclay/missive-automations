#!/usr/bin/env python3
"""Read cell values and formulas straight from the xlsx XML.

openpyxl silently drops shared formulas whose master carries no inline text
(this workbook has several such groups), so the audit reads the parts itself
and resolves `t="shared"` by translating the master's references.
"""
import re, zipfile, datetime
from openpyxl.utils import get_column_letter, column_index_from_string

CELL_RE = re.compile(r'<c r="([A-Z]+\d+)"([^>/]*)(?:/>|>(.*?)</c>)', re.S)
F_RE = re.compile(r'<f([^>]*)(?:/>|>(.*?)</f>)', re.S)
V_RE = re.compile(r'<v>(.*?)</v>', re.S)
IS_RE = re.compile(r'<is>.*?<t[^>]*>(.*?)</t>.*?</is>', re.S)
ATTR_RE = re.compile(r'(\w+)="([^"]*)"')

REF_RE = re.compile(r"(\$?)([A-Z]{1,3})(\$?)(\d{1,7})")
SKIP_RE = re.compile(r"'(?:[^']|'')*'|\"(?:[^\"]|\"\")*\"|#[A-Z]+[!?]|/0!")


def unescape(s):
    return (s.replace('&lt;', '<').replace('&gt;', '>')
             .replace('&quot;', '"').replace('&apos;', "'").replace('&amp;', '&'))


def split_coord(coord):
    m = re.match(r'([A-Z]+)(\d+)', coord)
    return column_index_from_string(m.group(1)), int(m.group(2))


def translate(formula, src, dst):
    """Shift relative references of `formula` from cell src to cell dst."""
    sc, sr = split_coord(src)
    dc, dr = split_coord(dst)
    dcol, drow = dc - sc, dr - sr
    if dcol == 0 and drow == 0:
        return formula
    out, pos = [], 0
    # walk the string, skipping quoted spans and error literals
    i = 0
    while i < len(formula):
        m = SKIP_RE.match(formula, i)
        if m:
            out.append(formula[i:m.end()]); i = m.end(); continue
        m = REF_RE.match(formula, i)
        if m:
            d1, col, d2, row = m.groups()
            if not d1:
                c = column_index_from_string(col) + dcol
                col = get_column_letter(max(1, c))
            if not d2:
                row = str(max(1, int(row) + drow))
            out.append(f"{d1}{col}{d2}{row}")
            i = m.end(); continue
        out.append(formula[i]); i += 1
    return ''.join(out)


def read(path):
    """-> {sheet_name: {coord: value_or_formula_string}}, plus cached values."""
    z = zipfile.ZipFile(path)
    wbx = z.read('xl/workbook.xml').decode('utf8')
    rels = dict(re.findall(r'Id="(rId\d+)"[^>]*?Target="([^"]+)"',
                           z.read('xl/_rels/workbook.xml.rels').decode('utf8')))
    sheets = [(unescape(m.group(1)), rels[m.group(2)])
              for m in re.finditer(r'<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"', wbx)]
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        sx = z.read('xl/sharedStrings.xml').decode('utf8')
        for si in re.finditer(r'<si>(.*?)</si>', sx, re.S):
            shared.append(unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>', si.group(1), re.S))))
    formulas, values = {}, {}
    for name, target in sheets:
        part = 'xl/' + target if not target.startswith('/') else target[1:]
        x = z.read(part).decode('utf8')
        F, V = {}, {}
        masters = {}
        for m in CELL_RE.finditer(x):
            coord, attrs, body = m.group(1), m.group(2), m.group(3) or ''
            a = dict(ATTR_RE.findall(attrs))
            t = a.get('t')
            fm = F_RE.search(body)
            if fm:
                fa = dict(ATTR_RE.findall(fm.group(1)))
                ftext = unescape(fm.group(2) or '')
                if fa.get('t') == 'shared':
                    si = fa.get('si')
                    if ftext:
                        masters[si] = (coord, ftext)
                        F[coord] = ftext
                    else:
                        F[coord] = ('SHARED', si)
                elif ftext:
                    F[coord] = ftext
            vm = V_RE.search(body)
            if t == 'inlineStr':
                im = IS_RE.search(body)
                V[coord] = unescape(im.group(1)) if im else ''
            elif vm:
                raw = unescape(vm.group(1))
                if t == 's':
                    V[coord] = shared[int(raw)]
                elif t == 'e':
                    V[coord] = raw
                elif t == 'str':
                    V[coord] = raw
                elif t == 'b':
                    V[coord] = (raw == '1')
                else:
                    try:
                        V[coord] = float(raw)
                    except ValueError:
                        V[coord] = raw
        # resolve shared placeholders
        unresolved = []
        for coord, f in list(F.items()):
            if isinstance(f, tuple):
                si = f[1]
                if si in masters:
                    src, ftext = masters[si]
                    F[coord] = translate(ftext, src, coord)
                else:
                    unresolved.append((coord, si))
                    del F[coord]
        formulas[name] = F
        values[name] = V
        if unresolved:
            formulas.setdefault('__unresolved__', []).extend(
                [(name, c, si) for c, si in unresolved])
    return formulas, values
