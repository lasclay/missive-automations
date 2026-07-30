#!/usr/bin/env python3
"""Phase Q — porter les mois réels du bilan de février à juin 2026.

Le bilan et le résultat s'arrêtaient à des mois différents : février pour l'un,
juin pour l'autre. Ils sont maintenant alignés sur dix mois réels. La chaîne de
trésorerie s'ancre donc sur juin 2026 (dernier mois de bilan réel) et court sur
les 38 mois prévus jusqu'en août 2029.
"""
import re
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
CAI = 'Budget de caisse'
DET = 'Dette à long terme'

PFY = {'FY26': list('DEFGHIJKLMNO'),
       'FY27': ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],
       'FY28': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
       'FY29': ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']}
PTOT = {'FY26': 'P', 'FY27': 'AD', 'FY28': 'AR', 'FY29': 'BF'}
CFY = {'FY26': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
       'FY27': ['AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD'],
       'FY28': ['BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ'],
       'FY29': ['BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA', 'CB', 'CC', 'CD', 'CE']}
IMMB = {'FY26': list('DEFGHIJKLMNO'),
        'FY27': ['U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF'],
        'FY28': ['AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW'],
        'FY29': ['BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN']}
PREVCLOSE = {'FY26': 'B', 'FY27': 'O', 'FY28': 'AC', 'FY29': 'AQ'}

# dix mois de bilan réel : sept. 2025 → juin 2026, sur les colonnes QBOBS AC → AL
ACTUAL = list('DEFGHIJKLM')
QBOBS = ['AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL']
CHAIN = ['N', 'O'] + PFY['FY27'] + PFY['FY28'] + PFY['FY29']

WC = {11: (153, True), 13: (154, True), 7: (155, True), 8: (156, True),
      37: (157, False), 33: (158, False), 34: (159, False), 32: (160, False),
      39: (161, False), 38: (162, False), 35: (163, False), 10: (164, True)}
AMO = {19: 54, 20: 55, 21: 99, 22: 49}
ACQ = {19: 23, 20: 24, 21: 25, 22: 26}


def build(dst='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx',
          src='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'):
    import xlcalc
    bk = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()

    # --- Q1 : quelles rangées du bilan viennent de QuickBooks -------------
    qbo_rows = []
    for r in range(5, 82):
        f = bk.formulas[BIL].get(f'D{r}') or ''
        if 'QBOBS' in f and 'SUMIF' in f:
            qbo_rows.append(r)
    for i, c in enumerate(ACTUAL):
        q = QBOBS[i]
        for r in qbo_rows:
            e.set(BIL, f'{c}{r}',
                  f"=SUMIF('QBOBS à maj'!$A$1:$A$400,$A{r},'QBOBS à maj'!{q}$1:{q}$400)")
        e.set(BIL, f'{c}2', 'Actuel')
    for c in ['N', 'O']:
        e.set(BIL, f'{c}2', 'Forecast')

    # --- Q2 : les immobilisations suivent l'amortissement du résultat
    #          seulement à partir de juillet 2026
    for k in ('FY26', 'FY27', 'FY28', 'FY29'):
        prev = PREVCLOSE[k]
        for i, c in enumerate(PFY[k]):
            if c in ACTUAL:
                continue
            p = prev if i == 0 else PFY[k][i - 1]
            ic = IMMB[k][i]
            for br, pr in AMO.items():
                f = f"={p}{br}-'{PNL}'!{c}{pr}+Immos!{ic}{ACQ[br]}"
                if c == 'O' and br == 19:
                    f += '-(Immos!$F$10-Immos!$K$10)'
                e.set(BIL, f'{c}{br}', f)

    # --- Q3 : la chaîne de trésorerie, ancrée sur juin 2026 --------------
    for i, c in enumerate(ACTUAL):
        prev = ACTUAL[i - 1] if i else None
        e.set(PNL, f'{c}183', f"='{BIL}'!{c}31")
        e.set(PNL, f'{c}189', f"='{BIL}'!{c}6")
        e.set(PNL, f'{c}182', f'={c}189-{c}183')
        e.set(PNL, f'{c}186', (f'={prev}189' if prev else f"='{BIL}'!B6"))
        e.set(PNL, f'{c}185', f'={c}183-' + (f'{prev}183' if prev else f"'{BIL}'!B31"))
        e.set(PNL, f'{c}193', f'={c}189-{c}182-{c}183')
    for i, c in enumerate(CHAIN):
        prev = CHAIN[i - 1] if i else ACTUAL[-1]
        e.set(PNL, f'{c}182', f'={prev}182+{c}184')
        e.set(PNL, f'{c}183', f'=MAX(0,Inputs!$C$68-{c}182)')
        e.set(PNL, f'{c}185', f'={c}183-{prev}183')
        e.set(PNL, f'{c}186', f'={prev}189')
        e.set(PNL, f'{c}189', f'={c}182+{c}183')
        e.set(PNL, f'{c}193', f'={c}189-{c}182-{c}183')
        e.set(PNL, f'{c}110', f'=Inputs!$C$69/12*{prev}183')
        e.set(BIL, f'{c}6', f"='{PNL}'!{c}189")
        e.set(BIL, f'{c}31', f"='{PNL}'!{c}183")
    # les dix mois réels gardent leurs intérêts de marge tirés de QuickBooks
    for i, c in enumerate(ACTUAL):
        q = ['AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ'][i]
        e.set(PNL, f'{c}110',
              f"=SUMIF('QBO P&L à maj'!$A$1:$A$400,$B110,'QBO P&L à maj'!{q}$1:{q}$400)")

    # --- Q4 : fonds de roulement, convention de signe unique -------------
    for k in ('FY26', 'FY27', 'FY28', 'FY29'):
        prev = PREVCLOSE[k]
        for i, c in enumerate(PFY[k]):
            p = prev if i == 0 else PFY[k][i - 1]
            for br, (fr, is_asset) in WC.items():
                a, b2 = (p, c) if is_asset else (c, p)
                e.set(PNL, f'{c}{fr}', f"='{BIL}'!{a}{br}-'{BIL}'!{b2}{br}")
    for k, t in PTOT.items():
        cs = PFY[k]
        for fr in range(153, 165):
            e.set(PNL, f'{t}{fr}', f'=SUM({cs[0]}{fr}:{cs[-1]}{fr})')

    # --- Q5 : variation des dettes, deltas de bilan ----------------------
    for k in ('FY26', 'FY27', 'FY28', 'FY29'):
        prev = PREVCLOSE[k]
        for i, c in enumerate(PFY[k]):
            p = prev if i == 0 else PFY[k][i - 1]
            for fr, brs in ((174, (48,)), (175, (52,)), (177, (50, 51, 56, 57)),
                            (178, (58,)), (179, (49, 53, 54, 55)), (180, (47,))):
                terms = '+'.join(f"'{BIL}'!{c}{b}" for b in brs)
                prevt = '+'.join(f"'{BIL}'!{p}{b}" for b in brs)
                e.set(PNL, f'{c}{fr}', f'=({terms})-({prevt})')
    # la ligne 176 reste le PILOTE du plan de financement : c'est elle qui
    # alimente le solde de la nouvelle dette au bilan, pas l'inverse.

    # --- Q6 : le budget de caisse suit -----------------------------------
    for k in ('FY26', 'FY27', 'FY28', 'FY29'):
        for i, c in enumerate(CFY[k]):
            p = PFY[k][i]
            e.set(CAI, f'{c}33', f"='{PNL}'!{p}182")
            e.set(CAI, f'{c}34', f"='{PNL}'!{p}183")
            e.set(CAI, f'{c}35', f"='{PNL}'!{p}189")
            e.set(CAI, f'{c}36', f"={c}32-'{PNL}'!{p}184")
    e.set(CAI, 'A38', 'CONTRÔLE — encaisse réelle au 30 juin 2026 (QuickBooks)')
    e.set(CAI, 'C38', f"='{BIL}'!M6")
    e.set(CAI, 'A39', 'Encaisse modélisée au 31 août 2026')
    e.set(CAI, 'C39', f"='{PNL}'!O189")
    e.set(CAI, 'A40', 'Bilan réel de QuickBooks : dix mois, sept. 2025 à juin 2026 '
                      '(colonnes AC à AL de « QBOBS à maj »). Juillet et août 2026 restent '
                      'prévisionnels : la colonne juillet de QuickBooks est une photo du '
                      'mois en cours, pas un mois fermé.')

    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    e = build()
    bk = xlcalc.load('PREVISIONS LASCLAY - version audit 2026-07-30.xlsx')
    print(f"{len(e.log)} écritures")
    allc = ['B'] + [c for cs in PFY.values() for c in cs]
    bad = [(c, round(bk.get(BIL, c + '76'), 2)) for c in allc if abs(bk.get(BIL, c + '76')) > 0.5]
    print('mois hors équilibre :', len(bad), bad[:10])
