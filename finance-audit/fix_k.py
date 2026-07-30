#!/usr/bin/env python3
"""Phase K — articuler les immobilisations et le fonds de roulement.

Reste trois ruptures : le bilan amortissait linéairement pendant que le résultat
passait la régularisation d'août en un coup ; le prêt BDC 11K disparaissait un
mois puis revenait ; et les douze lignes de variation du fonds de roulement
n'avaient pas toutes la même convention de signe. Après ça, la ligne 76 du bilan
est à zéro sur les 48 mois."""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

SRC = 'prev_fix_j.xlsx'
DST = 'prev_fix_k.xlsx'
PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
DET = 'Dette à long terme'

PFY = {'FY26': list('DEFGHIJKLMNO'),
       'FY27': ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],
       'FY28': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
       'FY29': ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']}
PTOT = {'FY26': 'P', 'FY27': 'AD', 'FY28': 'AR', 'FY29': 'BF'}
IMMB = {'FY26': list('DEFGHIJKLMNO'),
        'FY27': ['U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF'],
        'FY28': ['AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW'],
        'FY29': ['BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN']}
DFY = {'FY26': ['AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW'],
       'FY27': ['BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL'],
       'FY28': ['BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA'],
       'FY29': ['CE', 'CF', 'CG', 'CH', 'CI', 'CJ', 'CK', 'CL', 'CM', 'CN', 'CO', 'CP']}
PREVCLOSE = {'FY26': 'B', 'FY27': 'O', 'FY28': 'AC', 'FY29': 'AQ'}
FORECAST = {'FY26': PFY['FY26'][6:], 'FY27': PFY['FY27'],
            'FY28': PFY['FY28'], 'FY29': PFY['FY29']}

# poste de bilan -> (ligne de flux, actif ?)
WC = {11: (153, True), 13: (154, True), 7: (155, True), 8: (156, True),
      37: (157, False), 33: (158, False), 34: (159, False), 32: (160, False),
      39: (161, False), 38: (162, False), 35: (163, False), 10: (164, True)}


def build(dst=DST, src=SRC):
    e = Editor(src)
    e.expand_shared()

    # --- K1 : immobilisations pilotées par l'amortissement du résultat ----
    # (le bilan répartissait linéairement, le résultat passe la régularisation
    #  de fin d'exercice en août : les deux divergeaient de 11 mois)
    AMO = {19: 54, 20: 55, 21: 99, 22: 49}      # poste de bilan -> ligne du P&L
    ACQ = {19: 23, 20: 24, 21: 25, 22: 26}      # poste de bilan -> ligne d'Immos
    for k in ('FY26', 'FY27', 'FY28', 'FY29'):
        prev = PREVCLOSE[k]
        for i, c in enumerate(PFY[k]):
            if k == 'FY26' and i < 6:
                continue                        # six mois de bilan réel
            p = prev if i == 0 else PFY[k][i - 1]
            ic = IMMB[k][i]
            for br, pr in AMO.items():
                f = f"={p}{br}-'{PNL}'!{c}{pr}+Immos!{ic}{ACQ[br]}"
                if c == 'O' and br == 19:
                    f += '-(Immos!$F$10-Immos!$K$10)'   # sortie de la disposition
                e.set(BIL, f'{c}{br}', f)

    # --- K2 : prêt BDC 11K, solde continu --------------------------------
    for k in ('FY27', 'FY28', 'FY29'):
        prev = PREVCLOSE[k]
        for i, c in enumerate(PFY[k]):
            p = prev if i == 0 else PFY[k][i - 1]
            d = DFY[k][i]
            e.set(BIL, f'{c}49', f"={p}49-'{DET}'!{d}28")

    # --- K3 : convention de signe unique sur le fonds de roulement -------
    for k in ('FY26', 'FY27', 'FY28', 'FY29'):
        prev = PREVCLOSE[k]
        for i, c in enumerate(PFY[k]):
            p = prev if i == 0 else PFY[k][i - 1]
            for br, (fr, is_asset) in WC.items():
                if is_asset:
                    e.set(PNL, f'{c}{fr}', f"='{BIL}'!{p}{br}-'{BIL}'!{c}{br}")
                else:
                    e.set(PNL, f'{c}{fr}', f"='{BIL}'!{c}{br}-'{BIL}'!{p}{br}")
    for k, t in PTOT.items():
        cs = PFY[k]
        for fr in range(153, 165):
            e.set(PNL, f'{t}{fr}', f'=SUM({cs[0]}{fr}:{cs[-1]}{fr})')

    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    e = build()
    bk = xlcalc.load(DST)
    print(f"{len(e.log)} écritures -> {DST}")
    allc = ['B'] + [c for cs in PFY.values() for c in cs]
    bad = [(c, bk.get(BIL, c + '76')) for c in allc if abs(bk.get(BIL, c + '76')) > 1]
    print('mois hors équilibre :', len(bad), bad[:8])
    for r, l in ((26, 'Ventes nettes'), (33, 'CMV'), (137, 'PAI'), (141, 'PAI hors aides'),
                 (145, 'EBITDA'), (183, 'Marge max'), (189, 'Encaisse fin'), (70, None)):
        if r == 70:
            print(f"  {'Capitaux propres':20}" + ' '.join(
                f"{bk.get(BIL, c + '70'):>11,.0f}" for c in ('B', 'O', 'AC', 'AQ', 'BE')))
        else:
            print(f"  {l:20}" + ' '.join(f"{bk.get(PNL, c + str(r)):>11,.0f}"
                                        for c in ('P', 'AD', 'AR', 'BF')))
