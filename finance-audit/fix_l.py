#!/usr/bin/env python3
"""Phase L — les deux dernières ruptures d'articulation.

Le prêt BDC 11K encaissé en avril 2026 entrait au passif sans contrepartie dans
l'état des flux (11 000 $), et les bénéfices non répartis de FY2026 étaient
codés en dur à -113 342 au lieu de -113 342,47 (0,47 $). Les deux traînaient
depuis mars 2026 dans la ligne de contrôle du bilan."""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
PFY = {'FY26': list('DEFGHIJKLMNO'),
       'FY27': ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],
       'FY28': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
       'FY29': ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']}
PTOT = {'FY26': 'P', 'FY27': 'AD', 'FY28': 'AR', 'FY29': 'BF'}
PREVCLOSE = {'FY26': 'B', 'FY27': 'O', 'FY28': 'AC', 'FY29': 'AQ'}


def build(dst='prev_fix_l.xlsx', src='prev_fix_k.xlsx'):
    e = Editor(src)
    e.expand_shared()
    # r179 = variation de TOUTES les dettes BDC, y compris le prêt 11K
    for k in ('FY26', 'FY27', 'FY28', 'FY29'):
        prev = PREVCLOSE[k]
        for i, c in enumerate(PFY[k]):
            if k == 'FY26' and i < 6:
                continue
            p = prev if i == 0 else PFY[k][i - 1]
            e.set(PNL, f'{c}179',
                  f"=('{BIL}'!{c}49+'{BIL}'!{c}53+'{BIL}'!{c}54+'{BIL}'!{c}55)"
                  f"-('{BIL}'!{p}49+'{BIL}'!{p}53+'{BIL}'!{p}54+'{BIL}'!{p}55)")
    for k, t in PTOT.items():
        cs = PFY[k]
        e.set(PNL, f'{t}179', f'=SUM({cs[0]}179:{cs[-1]}179)')
    # bénéfices non répartis FY2026 : reprendre la valeur exacte de février
    for c in PFY['FY26'][6:]:
        e.set(BIL, f'{c}68', '=$I$68')
    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    e = build()
    bk = xlcalc.load('prev_fix_l.xlsx')
    print(f"{len(e.log)} écritures -> prev_fix_l.xlsx")
    allc = ['B'] + [c for cs in PFY.values() for c in cs]
    bad = [(c, round(bk.get(BIL, c + '76'), 2)) for c in allc if abs(bk.get(BIL, c + '76')) > 0.5]
    print('mois hors équilibre :', len(bad), bad[:10])
