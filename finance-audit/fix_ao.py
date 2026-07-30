#!/usr/bin/env python3
"""Phase AO — la TPS annuelle, versée au 30 novembre.

Lasclay déclare la TVQ au mois et la TPS à l'année, avec un solde dû au
30 novembre. Le modèle recopiait le profil mensuel réel de 2025-2026 et le
mettait à l'échelle des ventes, ce qui traite correctement la TVQ, mécaniquement
proportionnelle aux ventes du mois, mais pas la TPS : un règlement annuel porte
sur l'exercice écoulé et se paie en un seul coup.

Deux raisons de le poser explicitement.

1. Le versement grandit vite. Il valait 12 672 $ le 30 novembre 2025, pour
   l'exercice 2024-2025. Aux ventes projetées, il atteint 45 348 $ le
   30 novembre 2028.

2. Les crédits de taxe sur intrants baissent. La sous-traitance de couture au
   Québec, 92 252 $ en 2024-2025, part vers la Tunisie : cette dépense cesse de
   donner droit à un CTI. La TPS nette monte donc plus vite que les ventes.

Le calage vient du réel. Sur des ventes nettes de 779 492 $ en 2024-2025 et une
TPS nette de 12 672 $, les CTI valaient 23 341 $, soit une base de 466 811 $
dont 92 252 $ de couture. La base hors couture, 374 559 $, fait 48,05 % des
ventes nettes, et c'est ce ratio qui est projeté.

Le solde du bilan n'est plus recopié mais construit par ses mouvements, à partir
du solde réel d'août 2026 : chaque mois accumule sa TPS et sa TVQ, la TVQ du mois
précédent se verse, et novembre acquitte la TPS de l'exercice écoulé. Il n'y a
donc aucune rupture entre le dernier mois réel et le premier mois projeté.
"""
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
BIL = 'Bilan2026-27-28'
PNL = 'Résultats-Prev 2025-2029'
INP = 'Inputs'
TAXES = 35          # rangée « Taxes à payer » au bilan
VENTES = 26         # rangée « Ventes nettes » au résultat
ASSEMB = 35         # rangée « Sous-traitance assemblage » au résultat

FY26 = list('DEFGHIJKLMNO')
FY27 = ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC']
FY28 = ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ']
FY29 = ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']
TOT = {'FY26': 'P', 'FY27': 'AD', 'FY28': 'AR', 'FY29': 'BF'}
NOVEMBRE = 2        # troisième mois de l'exercice, qui commence en septembre

# --- paramètres, tous posés dans Inputs -------------------------------------
PART_CAN = 0.924        # part des ventes assujetties à la TPS
PART_QC = 0.848         # part des ventes assujetties à la TVQ
TAUX_TPS = 0.05
TAUX_TVQ = 0.09975
CTI_HORS_COUTURE = 0.4805   # base de CTI hors couture, en part des ventes nettes
# part de la sous-traitance d'assemblage encore réalisée au Québec
PART_COUTURE_QC = {'FY26': 1.0, 'FY27': 0.4, 'FY28': 0.0, 'FY29': 0.0}
TPS_2024_2025 = 12672.0     # réellement versée le 30 novembre 2025

L = 142   # première rangée du bloc dans Inputs


def build(dst=F, src=F):
    e = Editor(src)
    e.expand_shared()

    # ------------------------------------------------ AO1 : les paramètres
    lignes = [
        ('TPS ANNUELLE ET TVQ MENSUELLE', None, None),
        ('Part des ventes assujetties à la TPS (Canada)', PART_CAN,
         'QuickBooks 2025-2026 : ventes canadiennes sur ventes totales.'),
        ('Part des ventes assujetties à la TVQ (Québec)', PART_QC,
         'Part canadienne, multipliée par la part québécoise des ventes en ligne.'),
        ('Taux de TPS', TAUX_TPS, None),
        ('Taux de TVQ', TAUX_TVQ, None),
        ('Base de CTI et de RTI hors couture, % des ventes nettes',
         CTI_HORS_COUTURE,
         "Calé sur 2024-2025 : 12 672 $ de TPS nette sur 779 492 $ de ventes "
         "impliquent 466 811 $ de dépenses donnant droit à un crédit, dont "
         "92 252 $ de sous-traitance de couture. Le reste, 374 559 $, fait "
         "48,05 % des ventes nettes."),
    ]
    for i, (lab, val, note) in enumerate(lignes):
        e.set(INP, f'A{L + i}', lab)
        if val is not None:
            e.set(INP, f'D{L + i}', val)
        if note:
            e.set(INP, f'E{L + i}', note)

    r_part_can, r_part_qc = L + 1, L + 2
    r_tps, r_tvq, r_cti = L + 3, L + 4, L + 5

    # part de la couture encore au Québec, un exercice par colonne
    r_couture = L + 6
    e.set(INP, f'A{r_couture}',
          "Sous-traitance d'assemblage encore réalisée au Québec")
    e.set(INP, f'E{r_couture}',
          "Ce qui part en Tunisie cesse de donner droit à un CTI : la TPS nette "
          "monte donc plus vite que les ventes.")
    for col, k in zip('BCDE', ('FY26', 'FY27', 'FY28', 'FY29')):
        e.set(INP, f'{col}{r_couture}', PART_COUTURE_QC[k])

    # TPS nette de chaque exercice, payable le 30 novembre suivant
    r_net = r_couture + 1
    e.set(INP, f'A{r_net}', 'TPS nette par exercice, payable le 30 novembre '
                            'suivant')
    e.set(INP, f'E{r_net}',
          "2024-2025 est le montant réellement versé le 30 novembre 2025.")
    e.set(INP, f'A{r_net + 1}', '2024-2025 (versée le 30 novembre 2025)')
    e.set(INP, f'D{r_net + 1}', TPS_2024_2025)
    for i, k in enumerate(('FY26', 'FY27', 'FY28', 'FY29')):
        rr = r_net + 2 + i
        an = ['2025-2026', '2026-2027', '2027-2028', '2028-2029'][i]
        suiv = int(an[5:]) + 1
        e.set(INP, f'A{rr}', f'{an} (versée le 30 novembre {suiv})')
        t = TOT[k]
        col_c = 'BCDE'[i]
        e.set(INP, f'D{rr}',
              f"='{PNL}'!${t}${VENTES}*$D${r_part_can}*$D${r_tps}"
              f"-('{PNL}'!${t}${VENTES}*$D${r_cti}"
              f"+'{PNL}'!${t}${ASSEMB}*${col_c}${r_couture})*$D${r_tps}")
    # Rangée portant la TPS nette DE cet exercice-là. Le décalage compte : le
    # versement de novembre 2026 acquitte l'exercice clos le 31 août 2026, pas
    # celui d'avant, qui a été payé en novembre 2025.
    r_tps_fy = {'FY25': r_net + 1, 'FY26': r_net + 2,
                'FY27': r_net + 3, 'FY28': r_net + 4}

    # ------------------------------------------------ AO2 : le bilan
    # Le solde se construit par ses mouvements à partir du dernier mois réel,
    # ce qui évite toute rupture entre août 2026 et septembre 2026.
    # Les formules vivent sur la feuille du bilan : sans le préfixe « Inputs! »,
    # « $D$143 » désigne une cellule vide du bilan et tout le calcul tombe à zéro.
    def tvq(col):
        """TVQ nette accumulée sur les ventes d'un mois."""
        return (f"('{PNL}'!{col}{VENTES}*Inputs!$D${r_part_qc}"
                f"-'{PNL}'!{col}{VENTES}*Inputs!$D${r_cti})*Inputs!$D${r_tvq}")

    def tps(col):
        """TPS nette accumulée sur les ventes d'un mois."""
        return (f"('{PNL}'!{col}{VENTES}*Inputs!$D${r_part_can}"
                f"-'{PNL}'!{col}{VENTES}*Inputs!$D${r_cti})*Inputs!$D${r_tps}")

    for cols, prec, k in ((FY27, FY26, 'FY27'), (FY28, FY27, 'FY28'),
                          (FY29, FY28, 'FY29')):
        # le versement de novembre acquitte la TPS de l'exercice précédent
        r_du = r_tps_fy[{'FY27': 'FY26', 'FY28': 'FY27', 'FY29': 'FY28'}[k]]
        for i, c in enumerate(cols):
            avant = prec[-1] if i == 0 else cols[i - 1]
            f = (f'={avant}{TAXES}+{tps(c)}+{tvq(c)}-{tvq(avant)}')
            if i == NOVEMBRE:
                f += f"-Inputs!$D${r_du}"
            e.set(BIL, f'{c}{TAXES}', f)

    e.set(BIL, f'C{TAXES}',
          "TVQ déclarée au mois, TPS à l'année avec un solde dû au 30 novembre. "
          "Le solde se construit par ses mouvements à partir du réel d'août "
          "2026 : chaque mois accumule sa TPS et sa TVQ, la TVQ du mois "
          "précédent se verse, et novembre acquitte la TPS de l'exercice "
          f"écoulé. Paramètres dans Inputs, rangées {L} à {r_net + 5}.")

    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    avant = xlcalc.load(F)
    build()
    bk = xlcalc.load(F)
    MOIS = ['sep', 'oct', 'nov', 'déc', 'jan', 'fév', 'mar', 'avr', 'mai',
            'jun', 'jul', 'aoû']
    r_net = L + 7
    print('TPS nette par exercice, versée le 30 novembre suivant')
    for i, an in enumerate(['2024-2025', '2025-2026', '2026-2027', '2027-2028',
                            '2028-2029']):
        print(f'  {an}  {bk.get(INP, f"D{r_net + 1 + i}"):>12,.0f} $')
    print('\nSolde « Taxes à payer » au bilan')
    for lab, cols in (('2025-2026', FY26), ('2026-2027', FY27),
                      ('2027-2028', FY28), ('2028-2029', FY29)):
        print(f'  {lab} ' + ' '.join(f'{m}:{bk.get(BIL, c + str(TAXES)):>7,.0f}'
                                     for m, c in zip(MOIS, cols)))
    print('\nVariation, ce qui touche la trésorerie (- = décaissement)')
    for lab, cols in (('2026-2027', FY27), ('2027-2028', FY28),
                      ('2028-2029', FY29)):
        print(f'  {lab} ' + ' '.join(f'{m}:{bk.get(PNL, c + "163"):>7,.0f}'
                                     for m, c in zip(MOIS, cols)))
    COLS = FY26 + FY27 + FY28 + FY29
    print('\nmois hors équilibre :',
          sum(1 for c in COLS if abs(bk.get(BIL, c + '76')) > 0.01))
    for lab, b in (('après', bk), ('avant', avant)):
        print(f'  {lab} : encaisse la plus basse '
              f'{min(b.get(PNL, c + "189") for c in COLS):>10,.0f}   '
              f'marge au pic {max(b.get(PNL, c + "183") for c in COLS):>10,.0f}')
