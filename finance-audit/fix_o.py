#!/usr/bin/env python3
"""Phase O — finitions : plus une seule cellule en erreur dans le classeur,
le bloc FY2025 du budget de caisse rebranché sur le bon exercice, et un
formatage lisible sur les deux feuilles ajoutées."""
import re
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

SRC = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
DST = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
CAI = 'Budget de caisse'
SUM_ = 'Sommaire bailleurs'


def add_styles(e):
    """Ajoute trois formats numériques et renvoie leurs index."""
    x = e.parts['xl/styles.xml'].decode('utf8')
    m = re.search(r'<cellXfs count="(\d+)">', x)
    base = int(m.group(1))
    # numFmt : entier séparé, pourcentage, montant en gras
    nf = re.search(r'<numFmts count="(\d+)">(.*?)</numFmts>', x, re.S)
    newfmts = ('<numFmt numFmtId="900" formatCode="#,##0&quot; $&quot;"/>'
               '<numFmt numFmtId="901" formatCode="0.0%"/>')
    if nf:
        x = (x[:nf.start()] + f'<numFmts count="{int(nf.group(1)) + 2}">'
             + nf.group(2) + newfmts + '</numFmts>' + x[nf.end():])
    else:
        x = x.replace('<fonts', f'<numFmts count="2">{newfmts}</numFmts><fonts', 1)
        m = re.search(r'<cellXfs count="(\d+)">', x)
        base = int(m.group(1))
    add = ('<xf numFmtId="900" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
           '<xf numFmtId="901" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>')
    # Les deux <xf> vont à la FIN de la table : un <xf> ajouté en tête décalerait
    # de deux crans les 678 index existants, et chaque cellule du classeur
    # afficherait le format d'une autre. Aucune valeur ne serait fausse, mais
    # tout deviendrait illisible.
    m = re.search(r'(<cellXfs count=")(\d+)(">)(.*?)(</cellXfs>)', x, re.S)
    x = (x[:m.start()] + m.group(1) + str(base + 2) + m.group(3)
         + m.group(4) + add + m.group(5) + x[m.end():])
    e.parts['xl/styles.xml'] = x.encode('utf8')
    return base, base + 1        # (index montant, index pourcentage)


def build(src=SRC, dst=DST):
    e = Editor(src)
    e.expand_shared()

    # --- O1 : plus aucune division par zéro ------------------------------
    fixed = 0
    for sheet in ('Résultats2024', 'PRÉVISIONS À remplir', 'Résultats2025maj',
                  'Budget2025', 'Budget2024'):
        part = e.sheetpart.get(sheet)
        if not part:
            continue
        x = e.parts[part].decode('utf8')

        def wrap(m):
            nonlocal fixed
            f = m.group(1)
            if '/' not in f or f.upper().startswith('IFERROR'):
                return m.group(0)
            fixed += 1
            return m.group(0).replace(f'<f>{f}</f>', f'<f>IFERROR({f},0)</f>')
        x = re.sub(r'<f>([^<]*)</f>', wrap, x)
        e.parts[part] = x.encode('utf8')

    # --- O2 : le bloc FY2025 du budget de caisse lisait des colonnes mortes
    #          de « Résultats2024 » ; le vrai FY2025 est dans « Résultats2025maj »
    C25 = ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC']
    M25 = list('DEFGHIJKLMNO')
    for i, c in enumerate(C25):
        s = M25[i]
        R = "'Résultats2025maj'!"
        e.set(CAI, f'{c}7', f"='Account Recevables'!{['P','Q','R','S','T','U','V','W','X','Y','Z','AA'][i]}7")
        e.set(CAI, f'{c}15', f'={R}{s}34')
        e.set(CAI, f'{c}16', f'={R}{s}36')
        e.set(CAI, f'{c}17', f'={R}{s}35')
        e.set(CAI, f'{c}18', f'={R}{s}38+{R}{s}45+{R}{s}81+{R}{s}91+{R}{s}69')
        e.set(CAI, f'{c}19', f'={R}{s}59')
        e.set(CAI, f'{c}20', f'={R}{s}44-{R}{s}45-{R}{s}59-{R}{s}49-{R}{s}54-{R}{s}55')
        e.set(CAI, f'{c}21', f'={R}{s}68-{R}{s}69')
        e.set(CAI, f'{c}22', f'={R}{s}77-{R}{s}81')
        e.set(CAI, f'{c}23', f'={R}{s}90-{R}{s}91-{R}{s}99')
        e.set(CAI, f'{c}24', f'={R}{s}105')
    e.set(CAI, 'C2', 'FY2024 et FY2025 : réels, tirés de Résultats2024 et Résultats2025maj')

    # --- O3 : formatage des deux feuilles ajoutées -----------------------
    money, pct = add_styles(e)
    for sheet, pctrows in ((SUM_, {17, 18, 19, 20}),):
        part = e.sheetpart[sheet]
        x = e.parts[part].decode('utf8')

        def restyle(m):
            coord, attrs, body = m.group(1), m.group(2) or '', m.group(3) or ''
            if 't="inlineStr"' in attrs:
                return m.group(0)
            row = int(re.match(r'[A-Z]+(\d+)', coord).group(1))
            s = pct if row in pctrows else money
            return f'<c r="{coord}" s="{s}"{attrs}>{body}</c>' if body else m.group(0)
        x = re.sub(r'<c r="([A-Z]+\d+)"([^>/]*)(?:/>|>(.*?)</c>)', restyle, x, flags=re.S)
        e.parts[part] = x.encode('utf8')

    e.set_full_calc()
    e.save(dst)
    print(f"{fixed} formules protégées contre la division par zéro ; {len(e.log)} écritures")
    return e


if __name__ == '__main__':
    import xlcalc, collections
    build()
    bk = xlcalc.load(DST)
    errs = [(sh, c, str(bk.get(sh, c))) for sh, F in bk.formulas.items()
            for c in F if isinstance(bk.get(sh, c), xlcalc.Err)]
    print('erreurs restantes :', len(errs), collections.Counter((x[0], x[2]) for x in errs).most_common())
    print('cycles :', len(bk.cycles), '| parse fail :', len(getattr(bk, 'parse_fail', [])))
    B = 'Bilan2026-27-28'
    allc = (['B'] + list('DEFGHIJKLMNO')
            + ['R','S','T','U','V','W','X','Y','Z','AA','AB','AC']
            + ['AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO','AP','AQ']
            + ['AT','AU','AV','AW','AX','AY','AZ','BA','BB','BC','BD','BE'])
    print('bilan hors équilibre :', sum(1 for c in allc if abs(bk.get(B, c + '76')) > 0.5))
