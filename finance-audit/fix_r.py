#!/usr/bin/env python3
"""Phase R — ancrer le résultat cumulatif sur le réel de QuickBooks.

Le bénéfice cumulatif du modèle et celui de QuickBooks divergeaient de 853,33 $
au 30 juin 2026. Le bilan lisait le réel jusqu'en juin puis le modèle à partir de
juillet : la marche se retrouvait dans la ligne de contrôle. Les dix mois réels
du cumulatif reprennent maintenant le chiffre de QuickBooks, et la prévision
part de là."""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
ACTUAL = list('DEFGHIJKLM')


def build(dst='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx',
          src='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'):
    e = Editor(src)
    e.expand_shared()
    for c in ACTUAL:
        e.set(PNL, f'{c}143', f"='{BIL}'!{c}69")
        e.set(PNL, f'{c}139', f"='{BIL}'!{c}69+{c}140")
    e.set(PNL, 'C143', 'Dix mois réels : reprend le bénéfice cumulatif de QuickBooks')
    e.set(PNL, 'N143', "=M143+N142")
    e.set(PNL, 'O143', "=N143+O142")
    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    e = build()
    bk = xlcalc.load('PREVISIONS LASCLAY - version audit 2026-07-30.xlsx')
    PFY = {'FY26': list('DEFGHIJKLMNO'),
           'FY27': ['R','S','T','U','V','W','X','Y','Z','AA','AB','AC'],
           'FY28': ['AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO','AP','AQ'],
           'FY29': ['AT','AU','AV','AW','AX','AY','AZ','BA','BB','BC','BD','BE']}
    allc = ['B'] + [c for cs in PFY.values() for c in cs]
    bad = [(c, round(bk.get(BIL, c+'76'), 2)) for c in allc if abs(bk.get(BIL, c+'76')) > 0.5]
    print(f"{len(e.log)} écritures | mois hors équilibre : {len(bad)} {bad[:6]}")
    errs = [(sh, c) for sh, F in bk.formulas.items() for c in F
            if isinstance(bk.get(sh, c), xlcalc.Err)]
    print("erreurs :", len(errs), "| cycles :", len(bk.cycles))
    for r, l in ((26,'Ventes nettes'),(137,'PAI'),(141,'PAI hors aides'),(145,'EBITDA'),
                 (183,'Marge max'),(189,'Encaisse fin')):
        print(f"  {l:18}" + ' '.join(f"{bk.get(PNL, c+str(r)):>11,.0f}" for c in ('P','AD','AR','BF')))
    print("  Encaisse réelle 30 juin 2026 (QBO) :", f"{bk.get(BIL,'M6'):,.2f}")
    print("  Bénéfice cumulatif réel au 30 juin (QBO) :", f"{bk.get(BIL,'M69'):,.2f}")
