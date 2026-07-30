#!/usr/bin/env python3
"""Phase AO — la TPS annuelle, versée au 30 novembre.

Lasclay déclare la TVQ au mois et la TPS à l'année, avec un solde dû au
30 novembre. Le modèle recopiait le profil mensuel réel de 2025-2026 et le
mettait à l'échelle des ventes, ce qui traite correctement la TVQ, mécaniquement
proportionnelle aux ventes du mois, mais pas la TPS : un règlement annuel porte
sur l'exercice écoulé et se paie en un seul coup.

Deux raisons de le poser explicitement.

1. Le versement grandit vite. Il valait 12 672 $ le 30 novembre 2025, pour
   l'exercice 2024-2025. Aux ventes projetées, il atteint 48 510 $ le
   30 novembre 2028.

2. Les crédits de taxe sur intrants baissent. La sous-traitance de couture au
   Québec, 189 745 $ en 2025-2026, part vers la Tunisie : cette dépense cesse de
   donner droit à un CTI et à un RTI. Les taxes nettes montent donc plus vite
   que les ventes.

## Le calage vient des vrais montants de 2025-2026

Rien n'est déduit d'un ratio de l'exercice d'avant. Les trois composantes sont
lues à la source, du 1er septembre 2025 au 30 juillet 2026, onze mois clos :

- **Shopify**, taxes perçues par région de facturation, dont on extrait la part
  fédérale région par région : la TVH de l'Ontario, du Nouveau-Brunswick, de la
  Nouvelle-Écosse, de Terre-Neuve et de l'Île-du-Prince-Édouard est entièrement
  fédérale, la TPS de l'Alberta et des territoires aussi ; le Québec se partage
  5/14,975, la Colombie-Britannique et le Manitoba 5/12, la Saskatchewan 5/11 ;
  les ventes américaines ne portent pas de TPS. Total : **46 457,26 $**.
- **Factures QuickBooks**, TxnTaxDetail.TaxLine rapproché de la liste des
  TaxRate : **2 619,25 $** de TPS (et 5 225,32 $ de TVQ).
- **CTI**, mêmes lignes sur les Bill et les Purchase : 32 462,59 $ de « TPS
  (CTI) » plus 5,91 $ de « TVH (CTI) ON », soit **32 468,50 $** (et 59 896,40 $
  de RTI).

Il manque août, dont les ventes projetées sont de 5 070 $. Sa TPS perçue suit le
taux observé et son CTI la moyenne des onze mois, 2 952 $. La TPS nette de
2025-2026, à verser le 30 novembre 2026, vaut donc **13 910 $**.

Ces mêmes montants donnent les taux de projection, tous exprimés en part des
ventes nettes : 5,0011 % de TPS perçue et 8,3851 % de TVQ perçue — au-dessus des
taux nominaux, parce que la taxe se calcule sur les ventes brutes et sur le
transport, pas sur les ventes nettes — et, du côté des crédits, une base de CTI
de 52,58 % et une base de RTI de 47,17 %, couture exclue. La base de RTI est la
plus petite des deux : une partie des achats se fait hors du Québec.

Le solde du bilan n'est plus recopié mais construit par ses mouvements, à partir
du solde d'août 2026 : chaque mois accumule sa TPS et sa TVQ, la TVQ du mois
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
# colonne du bloc « part de la couture encore au Québec », un exercice par lettre
CC = {'FY26': 'B', 'FY27': 'C', 'FY28': 'D', 'FY29': 'E'}
NOVEMBRE = 2        # troisième mois de l'exercice, qui commence en septembre

# --- le réel de 2025-2026, onze mois clos ------------------------------------
TPS_SHOPIFY = 46457.26      # part fédérale des taxes Shopify, région par région
TPS_FACTURES = 2619.25      # TPS sur les factures QuickBooks
CTI_ONZE_MOIS = -32468.50   # « TPS (CTI) » + « TVH (CTI) ON » sur Bill+Purchase
AOUT_2026 = -2698.13        # TPS perçue au taux observé, moins le CTI moyen

# --- paramètres de projection, calés sur ce réel -----------------------------
TAUX_TPS_PERCUE = 0.050011   # TPS/TVH perçue, en part des ventes nettes
TAUX_TVQ_PERCUE = 0.083851   # TVQ perçue, en part des ventes nettes
TAUX_TPS = 0.05
TAUX_TVQ = 0.09975
BASE_CTI = 0.525819          # base de CTI hors couture, % des ventes nettes
BASE_RTI = 0.471731          # base de RTI hors couture, % des ventes nettes
# part de la sous-traitance d'assemblage encore réalisée au Québec
PART_COUTURE_QC = {'FY26': 1.0, 'FY27': 0.4, 'FY28': 0.0, 'FY29': 0.0}
TPS_2024_2025 = 12672.0      # réellement versée le 30 novembre 2025

L = 142   # première rangée du bloc dans Inputs
DERNIERE = 175   # jusqu'où le bloc est nettoyé avant d'être réécrit


def build(dst=F, src=F):
    e = Editor(src)
    e.expand_shared()

    # Le bloc est effacé avant d'être réécrit : une version antérieure de cette
    # phase occupait les mêmes rangées avec une autre disposition, et une
    # étiquette orpheline serait pire qu'une cellule vide.
    for r in range(L, DERNIERE + 1):
        for col in 'ABCDE':
            e.set(INP, f'{col}{r}', None)

    # ------------------------------------------------ AO1 : le réel
    e.set(INP, f'A{L}', 'TPS ANNUELLE ET TVQ MENSUELLE')
    reel = [
        ('TPS/TVH perçue chez Shopify, 1er sept. 2025 au 30 juil. 2026',
         TPS_SHOPIFY,
         "Part fédérale des taxes perçues, calculée région par région : TVH "
         "entièrement fédérale en Ontario et dans l'Atlantique, TPS seule en "
         "Alberta et dans les territoires, 5/14,975 au Québec, 5/12 en "
         "Colombie-Britannique et au Manitoba, 5/11 en Saskatchewan, rien aux "
         "États-Unis."),
        ('TPS perçue sur les factures QuickBooks, même période', TPS_FACTURES,
         "TxnTaxDetail.TaxLine des factures, rapproché de la liste des TaxRate. "
         "Les mêmes factures portent 5 225,32 $ de TVQ."),
        ('CTI sur les achats et les dépenses, même période', CTI_ONZE_MOIS,
         "Mêmes lignes sur les Bill et les Purchase : 32 462,59 $ de « TPS "
         "(CTI) » et 5,91 $ de « TVH (CTI) ON ». Les mêmes pièces portent "
         "59 896,40 $ de RTI."),
        ('Août 2026, estimé : TPS perçue moins le CTI moyen', AOUT_2026,
         "Le seul mois qui manque. Ses ventes projetées, 5 070 $, portent la "
         "TPS au taux observé ; son CTI suit la moyenne des onze mois, "
         "2 952 $."),
    ]
    for i, (lab, val, note) in enumerate(reel):
        e.set(INP, f'A{L + 1 + i}', lab)
        e.set(INP, f'D{L + 1 + i}', val)
        e.set(INP, f'E{L + 1 + i}', note)

    r_net26 = L + 5
    e.set(INP, f'A{r_net26}', 'TPS nette de 2025-2026, versée le 30 nov. 2026')
    e.set(INP, f'D{r_net26}',
          '=' + '+'.join(f'D{L + 1 + i}' for i in range(len(reel))))
    e.set(INP, f'E{r_net26}',
          "Onze mois réels et un mois estimé. Aucun ratio : c'est la somme des "
          "quatre lignes ci-dessus.")

    # ------------------------------------------------ AO2 : les taux projetés
    r = r_net26 + 1
    e.set(INP, f'A{r}', 'Paramètres de projection, calés sur le réel ci-dessus')
    params = [
        ('Taux effectif de TPS/TVH perçue, % des ventes nettes',
         TAUX_TPS_PERCUE,
         "49 077 $ perçus sur 981 313 $ de ventes nettes. Au-dessus de 5 % "
         "parce que la taxe porte sur les ventes brutes et sur le transport, "
         "pas sur les ventes nettes."),
        ('Taux effectif de TVQ perçue, % des ventes nettes', TAUX_TVQ_PERCUE,
         "82 284 $ perçus sur les mêmes ventes, Shopify et factures réunis."),
        ('Taux de TPS', TAUX_TPS, None),
        ('Taux de TVQ', TAUX_TVQ, None),
        ('Base de CTI hors couture, % des ventes nettes', BASE_CTI,
         "35 420 $ de CTI sur l'exercice supposent 708 404 $ d'achats taxés, "
         "dont 189 745 $ de sous-traitance de couture. Le reste, 518 659 $, "
         "fait 52,58 % des ventes nettes."),
        ('Base de RTI hors couture, % des ventes nettes', BASE_RTI,
         "65 342 $ de RTI supposent 655 053 $ d'achats taxés au Québec, soit "
         "465 308 $ hors couture. Plus petite que la base de CTI : une partie "
         "des achats se fait hors du Québec."),
    ]
    for i, (lab, val, note) in enumerate(params):
        e.set(INP, f'A{r + 1 + i}', lab)
        e.set(INP, f'D{r + 1 + i}', val)
        if note:
            e.set(INP, f'E{r + 1 + i}', note)

    r_tps_p, r_tvq_p = r + 1, r + 2
    r_tps, r_tvq = r + 3, r + 4
    r_cti, r_rti = r + 5, r + 6

    r_couture = r + 7
    e.set(INP, f'A{r_couture}',
          "Sous-traitance d'assemblage encore réalisée au Québec")
    e.set(INP, f'E{r_couture}',
          "Ce qui part en Tunisie cesse de donner droit à un crédit : les taxes "
          "nettes montent donc plus vite que les ventes.")
    for k, col in CC.items():
        e.set(INP, f'{col}{r_couture}', PART_COUTURE_QC[k])

    # ------------------------------------------------ AO3 : le tableau annuel
    r_net = r_couture + 1
    e.set(INP, f'A{r_net}',
          'TPS nette par exercice, payable le 30 novembre suivant')
    e.set(INP, f'A{r_net + 1}', '2024-2025 (versée le 30 novembre 2025)')
    e.set(INP, f'D{r_net + 1}', TPS_2024_2025)
    e.set(INP, f'E{r_net + 1}',
          "Montant réellement versé, visible au mouvement du compte 2110 en "
          "novembre 2025.")
    e.set(INP, f'A{r_net + 2}', '2025-2026 (versée le 30 novembre 2026)')
    e.set(INP, f'D{r_net + 2}', f'=D{r_net26}')
    e.set(INP, f'E{r_net + 2}', 'Le réel, repris de la ligne ci-dessus.')
    for i, k in enumerate(('FY27', 'FY28', 'FY29')):
        rr = r_net + 3 + i
        an = ['2026-2027', '2027-2028', '2028-2029'][i]
        # l'exercice 2026-2027 se clôt le 31 août 2027 et se règle en novembre
        # de cette même année-là, pas de la suivante
        e.set(INP, f'A{rr}', f'{an} (versée le 30 novembre {an[5:]})')
        t, cc = TOT[k], CC[k]
        e.set(INP, f'D{rr}',
              f"='{PNL}'!${t}${VENTES}*$D${r_tps_p}"
              f"-('{PNL}'!${t}${VENTES}*$D${r_cti}"
              f"+'{PNL}'!${t}${ASSEMB}*${cc}${r_couture})*$D${r_tps}")
    # Rangée portant la TPS nette DE cet exercice-là. Le décalage compte : le
    # versement de novembre 2026 acquitte l'exercice clos le 31 août 2026, pas
    # celui d'avant, qui a été payé en novembre 2025.
    r_tps_fy = {'FY25': r_net + 1, 'FY26': r_net + 2,
                'FY27': r_net + 3, 'FY28': r_net + 4}

    # ------------------------------------------------ AO4 : le bilan
    # Le solde se construit par ses mouvements à partir du dernier mois réel,
    # ce qui évite toute rupture entre août 2026 et septembre 2026.
    # Les formules vivent sur la feuille du bilan : sans le préfixe « Inputs! »,
    # « $D$143 » désigne une cellule vide du bilan et tout le calcul tombe à zéro.
    def percue(col, r_taux):
        return f"'{PNL}'!{col}{VENTES}*Inputs!$D${r_taux}"

    def credit(col, r_base, r_taux, cc):
        return (f"('{PNL}'!{col}{VENTES}*Inputs!$D${r_base}"
                f"+'{PNL}'!{col}{ASSEMB}*Inputs!${cc}${r_couture})"
                f"*Inputs!$D${r_taux}")

    def tps(col, cc):
        """TPS nette accumulée sur l'activité d'un mois."""
        return (f'{percue(col, r_tps_p)}-{credit(col, r_cti, r_tps, cc)}')

    def tvq(col, cc):
        """TVQ nette accumulée sur l'activité d'un mois."""
        return (f'{percue(col, r_tvq_p)}-{credit(col, r_rti, r_tvq, cc)}')

    for cols, prec, k, kp in ((FY27, FY26, 'FY27', 'FY26'),
                              (FY28, FY27, 'FY28', 'FY27'),
                              (FY29, FY28, 'FY29', 'FY28')):
        cc, ccp = CC[k], CC[kp]
        r_du = r_tps_fy[kp]   # novembre acquitte l'exercice précédent
        for i, c in enumerate(cols):
            # la TVQ versée ce mois-ci est celle du mois d'avant, qui peut
            # appartenir à l'exercice précédent — d'où sa propre colonne
            avant, cc_avant = (prec[-1], ccp) if i == 0 else (cols[i - 1], cc)
            f = (f'={avant}{TAXES}+{tps(c, cc)}+{tvq(c, cc)}'
                 f'-({tvq(avant, cc_avant)})')
            if i == NOVEMBRE:
                f += f"-Inputs!$D${r_du}"
            e.set(BIL, f'{c}{TAXES}', f)

    e.set(BIL, f'C{TAXES}',
          "TVQ déclarée au mois, TPS à l'année avec un solde dû au 30 novembre. "
          "Le solde se construit par ses mouvements à partir du réel d'août "
          "2026 : chaque mois accumule sa TPS et sa TVQ, la TVQ du mois "
          "précédent se verse, et novembre acquitte la TPS de l'exercice "
          "écoulé. Les taux sont calés sur les vrais montants de 2025-2026, "
          f"Inputs rangées {L} à {r_net + 5}.")

    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    avant = xlcalc.load(F)
    build()
    bk = xlcalc.load(F)
    MOIS = ['sep', 'oct', 'nov', 'déc', 'jan', 'fév', 'mar', 'avr', 'mai',
            'jun', 'jul', 'aoû']
    r_net = L + 14
    print('TPS nette par exercice, versée le 30 novembre suivant')
    for i, an in enumerate(['2024-2025', '2025-2026', '2026-2027', '2027-2028',
                            '2028-2029']):
        print(f'  {an}  {bk.get(INP, f"D{r_net + 1 + i}"):>12,.0f} $')
    print('\nSolde « Taxes à payer » au bilan')
    for lab, cols in (('2025-2026', FY26), ('2026-2027', FY27),
                      ('2027-2028', FY28), ('2028-2029', FY29)):
        print(f'  {lab} ' + ' '.join(f'{m}:{bk.get(BIL, c + str(TAXES)):>7,.0f}'
                                     for m, c in zip(MOIS, cols)))
    COLS = FY26 + FY27 + FY28 + FY29
    print('\nmois hors équilibre :',
          sum(1 for c in COLS if abs(bk.get(BIL, c + '76')) > 0.01))
    for lab, b in (('après', bk), ('avant', avant)):
        print(f'  {lab} : encaisse la plus basse '
              f'{min(b.get(PNL, c + "189") for c in COLS):>10,.0f}   '
              f'marge au pic {max(b.get(PNL, c + "183") for c in COLS):>10,.0f}')
