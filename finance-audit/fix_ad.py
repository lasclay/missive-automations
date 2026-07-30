#!/usr/bin/env python3
"""Phase AD — le canal détail au Canada, et deux versions du dossier.

Le plan est une percée en consignation : un point de vente majeur par ville
moyenne à grande au Canada, toute la gamme en dépôt, 40 % de marge au détaillant.
Le modèle ne portait que le commerce en ligne, ce qui plafonnait FY2029 à
1,77 M$ — et un résultat qui ne devient positif hors aides publiques qu'en 2029.

Le canal est modélisé par ses pilotes, pas par un pourcentage de croissance :
nombre de points de vente ouverts par exercice, vente au détail annuelle par
point de vente, marge au détaillant, et ce que le canal coûte réellement.

Ce qui est modélisé, et qu'un prêteur va chercher :

- la marge du canal est plus mince que celle du web : Lasclay encaisse 60 % du
  prix de détail alors que le produit coûte le même prix à fabriquer, donc le
  coût des marchandises passe de 33 % à 55 % du revenu encaissé ;
- en contrepartie il ne consomme aucune publicité — et la publicité coûte
  actuellement 22 % du revenu brut ;
- la consignation veut dire que Lasclay reste PROPRIÉTAIRE du stock chez le
  détaillant. C'est du fonds de roulement, pas une vente. Le bilan le porte ;
- le canal coûte une commission de représentation, un présentoir par point de
  vente ouvert, et du transport vers les magasins.

Les escomptes, le transport au consommateur et la publicité restent calculés sur
le commerce en ligne SEUL : les appliquer au détail gonflerait les coûts d'un
canal qui n'en a pas.

Deux scénarios, sur la même cellule Inputs!C70 :
  1 = conservateur mais réaliste — la version des bailleurs institutionnels
  2 = ambitieux — déploiement détail complet, la version de l'investisseur privé
Les anciennes valeurs du scénario prudent sont conservées en colonne F comme
sensibilité baissière, au cas où la BDC demande le creux.
"""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
INP = 'Inputs'

FY = {'FY27': ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],
      'FY28': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
      'FY29': ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']}
TOT = {'FY27': 'AD', 'FY28': 'AR', 'FY29': 'BF'}
# la rangée d'Inputs qui porte le nombre de points de vente à la fin de l'exercice
PDV = {'FY27': 123, 'FY28': 124, 'FY29': 125}
# le ratio de coût des marchandises applicable à l'exercice (colonne d'Inputs)
RC = {'FY27': 'C', 'FY28': 'D', 'FY29': 'E'}
# profil saisonnier du détail : colonnes B à M de la rangée 136 d'Inputs
SEASON = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']
SHARES = [0.09, 0.13, 0.16, 0.15, 0.09, 0.07, 0.06, 0.05, 0.05, 0.05, 0.045, 0.055]

# ---------------------------------------------------------------- les scénarios
# (rangée d'Inputs, conservateur, ambitieux, sensibilité baissière conservée)
SCEN = [
    (75, 1.22, 1.35, 1.12),    # croissance FY2027 — accessoires hiver
    (76, 1.40, 1.55, 1.12),    # produits été
    (77, 1.03, 1.08, 1.00),    # horticole
    (78, 1.20, 1.30, 1.08),    # maison
    (79, 1.15, 1.25, 1.08),    # produits dérivés
    (80, 1.15, 1.25, 1.08),    # matériaux
    (81, 1.20, 1.30, 1.12),    # croissance FY2028 — accessoires hiver
    (82, 1.28, 1.40, 1.12),    # produits été
    (83, 1.00, 1.05, 0.97),    # horticole
    (84, 1.18, 1.28, 1.08),    # maison
    (85, 1.15, 1.25, 1.08),    # produits dérivés
    (86, 1.15, 1.25, 1.08),    # matériaux
    (87, 0.16, 0.155, 0.165),  # achats de matières, % des ventes nettes FY2027
    (88, 0.155, 0.15, 0.162),  # FY2028
    (89, 0.15, 0.145, 0.16),   # FY2029
    (90, 0.17, 0.165, 0.185),  # sous-traitance d'assemblage FY2027
    (91, 0.155, 0.15, 0.175),  # FY2028
    (92, 0.145, 0.14, 0.17),   # FY2029
    (93, 0.22, 0.225, 0.235),  # publicité numérique, % du revenu brut FY2027
    (94, 0.205, 0.21, 0.225),  # FY2028
    (95, 0.195, 0.20, 0.215),  # FY2029
    (96, 1.18, 1.25, 1.12),    # croissance FY2029 sur le profil FY2028
    (97, 46750.0, 46750.0, 100000.0),   # ressource marketing
]
# le canal détail : (rangée, libellé, conservateur, ambitieux)
RETAIL = [
    (123, 'Points de vente ouverts au 31 août 2027', 12.0, 20.0),
    (124, 'Points de vente ouverts au 31 août 2028', 30.0, 48.0),
    (125, 'Points de vente ouverts au 31 août 2029', 55.0, 85.0),
    (126, 'Vente au détail annuelle par point de vente ($, prix de détail)', 44000.0, 52000.0),
    (127, 'Marge accordée au détaillant', 0.40, 0.40),
    (129, 'Transport vers les points de vente (% du revenu encaissé)', 0.03, 0.03),
    (130, 'Commission de représentation et déplacements (% du revenu encaissé)', 0.07, 0.07),
    (131, 'Présentoir et implantation, par point de vente ouvert ($)', 800.0, 800.0),
    (132, 'Stock en consignation (mois de coût des marchandises chez les détaillants)', 4.0, 4.0),
]


def build(dst='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx',
          src='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'):
    e = Editor(src)
    e.expand_shared()

    # --- AD1 : deux scénarios, plus la sensibilité baissière conservée -----
    e.set(INP, 'A70', 'SCÉNARIO ACTIF  →  1 = conservateur réaliste (bailleurs)   '
                      '2 = ambitieux (investisseur privé)')
    e.set(INP, 'A71', 'Conservateur réaliste : le financement rétablit l’approvisionnement, le '
                      'déploiement détail se fait à 12, 30 puis 55 points de vente, et le virage '
                      'manufacturier livre une partie de son gain. C’est la version de la BDC, de '
                      'Desjardins, du Prêt d’Honneur et du PARI.')
    e.set(INP, 'A72', 'Ambitieux : le déploiement détail va au bout de son plan — un point de '
                      'vente majeur par ville moyenne à grande, 85 en FY2029 — et le web croît au '
                      'rythme des deux derniers exercices financés. C’est la version de '
                      'l’investisseur privé.')
    e.set(INP, 'B74', 'Conservateur')
    e.set(INP, 'C74', 'Ambitieux')
    e.set(INP, 'F74', 'Sensibilité baissière (non branchée)')
    for row, cons, amb, down in SCEN:
        e.set(INP, f'B{row}', cons)
        e.set(INP, f'C{row}', amb)
        e.set(INP, f'F{row}', down)

    # --- AD2 : les pilotes du canal détail --------------------------------
    e.set(INP, 'A121', 'CANAL DÉTAIL — CONSIGNATION AU CANADA')
    e.set(INP, 'B122', 'Conservateur')
    e.set(INP, 'C122', 'Ambitieux')
    e.set(INP, 'D122', 'ACTIF')
    for row, label, cons, amb in RETAIL:
        e.set(INP, f'A{row}', label)
        e.set(INP, f'B{row}', cons)
        e.set(INP, f'C{row}', amb)
        e.set(INP, f'D{row}', f'=IF($C$70=2,$C${row},$B${row})')
    e.set(INP, 'A128', 'Part du prix de détail encaissée par Lasclay')
    e.set(INP, 'B128', '=1-B127')
    e.set(INP, 'C128', '=1-C127')
    e.set(INP, 'D128', '=1-D127')
    e.set(INP, 'A133', 'Coût des marchandises du canal, % du revenu encaissé (FY2027 / 28 / 29)')
    for col, rc in (('B', 'C'), ('C', 'D'), ('D', 'E')):
        e.set(INP, f'{col}133', f'=(${rc}$57+${rc}$59)/$D$128')
    e.set(INP, 'A134', 'Le produit coûte le même prix à fabriquer, qu’il se vende en ligne ou en '
                       'magasin, mais Lasclay n’encaisse que 60 % du prix de détail : le coût des '
                       'marchandises du canal est donc celui du web divisé par 0,60. En échange, '
                       'le canal ne consomme aucune publicité — et la publicité coûte 22 % du '
                       'revenu brut du web.')
    e.set(INP, 'A135', 'La consignation veut dire que Lasclay reste propriétaire du stock chez le '
                       'détaillant jusqu’à la vente au consommateur. Ce stock est au bilan '
                       '(inventaire de produits finis) et il consomme de la trésorerie : c’est le '
                       'vrai coût d’entrée du canal, et il est chiffré rangée 132.')
    e.set(INP, 'A136', 'Profil saisonnier du canal détail (part du détail annuel, sept. → août)')
    for col, share in zip(SEASON, SHARES):
        e.set(INP, f'{col}136', share)

    # --- AD3 : le canal au résultat ---------------------------------------
    e.set(PNL, 'B13', 'Points de vente au détail actifs (moyenne du mois)')
    e.set(PNL, 'B12', 'Ventes détail — consignation (revenu encaissé par Lasclay)')
    e.set(PNL, 'C12', 'Prix de détail moins la marge de 40 % du détaillant. Pilotes dans Inputs, '
                      'rangées 121 à 136.')
    for k, cols in FY.items():
        prev = PDV[k] - 1 if k != 'FY27' else None
        for i, c in enumerate(cols, start=1):
            if prev is None:
                pdv = f'=Inputs!$D${PDV[k]}*{i}/12'
            else:
                pdv = (f'=Inputs!$D${prev}+(Inputs!$D${PDV[k]}-Inputs!$D${prev})*{i}/12')
            e.set(PNL, f'{c}13', pdv)
            e.set(PNL, f'{c}12',
                  f'={c}13*Inputs!$D$126*Inputs!$D$128*Inputs!${SEASON[i - 1]}$136')
        t = TOT[k]
        e.set(PNL, f'{t}12', f'=SUM({cols[0]}12:{cols[-1]}12)')
        e.set(PNL, f'{t}13', f'={cols[-1]}13')

    # --- AD4 : le brancher sans contaminer les ratios du web --------------
    for k, cols in FY.items():
        rc = RC[k]
        for c in cols:
            # le détail s'ajoute aux ventes escomptées, sans escompte consommateur
            e.set(PNL, f'{c}18', f'={c}5+{c}16+{c}12')
            # transport : % du web sur le web, % magasin sur le détail
            e.set(PNL, f'{c}20',
                  f'=-Inputs!$G$6*({c}5+{c}16)-{c}12*Inputs!$D$129')
            # fournitures d'expédition : le web seul
            e.set(PNL, f'{c}74', f'=Inputs!$B$14*({c}5+{c}16)')
            # coût des marchandises : ratio du web sur le web, ratio majoré sur le détail
            e.set(PNL, f'{c}34',
                  f'=Inputs!${rc}$57*({c}26-{c}12)+Inputs!${rc}$57/Inputs!$D$128*{c}12')
            e.set(PNL, f'{c}35',
                  f'=Inputs!${rc}$59*({c}26-{c}12)+Inputs!${rc}$59/Inputs!$D$128*{c}12')
        # commission de représentation et présentoirs des points de vente ouverts
        for i, c in enumerate(cols, start=1):
            e.set(PNL, f'{c}80',
                  f'={c}12*Inputs!$D$130+({c}13-'
                  + (f'{cols[i - 2]}13' if i > 1 else
                     (f'Inputs!$D${PDV[k] - 1}' if k != 'FY27' else '0'))
                  + f')*Inputs!$D$131')
    e.set(PNL, 'C80', 'Canal détail : commission de représentation et déplacements (7 % du '
                      'revenu encaissé) et présentoir de 800 $ par point de vente ouvert '
                      'dans le mois.')

    # --- AD5 : le stock en consignation au bilan --------------------------
    # Lasclay reste propriétaire : le stock de produits finis porte, en plus de
    # sa croissance propre, le coût des marchandises immobilisé chez les détaillants.
    e.set(BIL, 'C13', 'Inclut le stock en consignation chez les détaillants, dont Lasclay '
                      'reste propriétaire jusqu’à la vente au consommateur '
                      '(Inputs, rangée 132)')
    GF = {'FY27': 'C', 'FY28': 'D', 'FY29': 'E'}
    PREVYR = {'FY27': list('DEFGHIJKLMNO'),
              'FY28': FY['FY27'], 'FY29': FY['FY28']}
    for k, cols in FY.items():
        rc, gf = RC[k], GF[k]
        for i, c in enumerate(cols):
            p = PREVYR[k][i]
            cons = (f"+'{PNL}'!{c}13*Inputs!$D$126*(Inputs!${rc}$57+Inputs!${rc}$59)"
                    f'/12*Inputs!$D$132')
            e.set(BIL, f'{c}13', f'={p}13*Inputs!${gf}$67{cons}')

    # --- AD6 : le facteur d'inventaire ne suit que le web ------------------
    # Inputs!C67 indexait la croissance des stocks sur celle des ventes nettes.
    # Avec le détail dans les ventes nettes, il gonflerait les matières premières
    # alors que le stock du canal est déjà compté ci-dessus.
    for col, k in (('C', 'FY27'), ('D', 'FY28'), ('E', 'FY29')):
        t = TOT[k]
        prev = {'FY27': 'P', 'FY28': 'AD', 'FY29': 'AR'}[k]
        pt = {'FY27': '', 'FY28': "-'" + PNL + "'!AD12", 'FY29': "-'" + PNL + "'!AR12"}[k]
        e.set(INP, f'{col}67',
              f"=('{PNL}'!{t}26-'{PNL}'!{t}12)/('{PNL}'!{prev}26{pt})")

    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    e = build()
    print(f'{len(e.log)} écritures')
    bk = xlcalc.load('PREVISIONS LASCLAY - version audit 2026-07-30.xlsx')
    allc = (['B'] + list('DEFGHIJKLMNO') + FY['FY27'] + FY['FY28'] + FY['FY29'])
    bad = [c for c in allc if abs(bk.get(BIL, c + '76')) > 0.5]
    print('mois hors équilibre :', len(bad), bad[:6])
    print(f'{"":<8}{"ventes nettes":>15}{"dont détail":>14}{"PDV fin":>9}'
          f'{"PAI":>12}{"hors aides":>13}')
    for lbl, t in (('FY2026', 'P'), ('FY2027', 'AD'), ('FY2028', 'AR'), ('FY2029', 'BF')):
        print(f'{lbl:<8}{bk.get(PNL, t + "26"):>15,.0f}{bk.get(PNL, t + "12"):>14,.0f}'
              f'{bk.get(PNL, t + "13"):>9,.0f}{bk.get(PNL, t + "137"):>12,.0f}'
              f'{bk.get(PNL, t + "141"):>13,.0f}')
