#!/usr/bin/env python3
"""Phase AF — donner au stock en consignation ses deux contreparties.

Une rangée d'inventaire au bilan a besoin de deux écritures ailleurs, exactement
comme les matières premières et les produits finis :

- au coût des marchandises (rangée 40) : les produits expédiés chez un
  détaillant mais pas encore vendus au consommateur sont un actif, pas une
  charge de l'exercice ;
- au fonds de roulement de l'état des flux (rangée 154) : c'est là que le coût
  en trésorerie apparaît.

Les deux s'annulent dans la trésorerie — le vrai décaissement est dans les
achats — et c'est ce qui remet la ligne de contrôle du bilan à zéro.

La ligne « Ventes au détail » du résultat est aussi nommée telle quelle, avec le
nombre de points de vente juste en dessous, pour qu'on lise la croissance du
segment sans avoir à la calculer.
"""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'

FY = {'FY27': ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],
      'FY28': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
      'FY29': ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']}
TOT = {'FY27': 'AD', 'FY28': 'AR', 'FY29': 'BF'}
# le mois de bilan qui précède le premier mois de chaque exercice
OPEN = {'FY27': 'O', 'FY28': 'AC', 'FY29': 'AQ'}


def build(dst='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx',
          src='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'):
    e = Editor(src)
    e.expand_shared()

    e.set(PNL, 'B12', 'Ventes au détail — consignation (revenu encaissé par Lasclay)')
    e.set(PNL, 'B13', 'Points de vente au détail actifs (moyenne du mois)')
    e.set(PNL, 'C13', 'Ouverture linéaire sur l’exercice, du solde de l’an passé à la cible '
                      'd’Inputs (rangées 123 à 125)')
    e.set(PNL, 'C154', 'Inclut le stock en consignation chez les détaillants (bilan l. 14)')

    for k, cols in FY.items():
        for i, c in enumerate(cols):
            p = OPEN[k] if i == 0 else cols[i - 1]
            # le coût des marchandises capitalise ce qui dort chez les détaillants
            e.set(PNL, f'{c}40',
                  f"='{BIL}'!{p}11+'{BIL}'!{p}13+'{BIL}'!{p}14"
                  f"-'{BIL}'!{c}11-'{BIL}'!{c}13-'{BIL}'!{c}14")
            # et le fonds de roulement en porte le coût en trésorerie
            e.set(PNL, f'{c}154',
                  f"='{BIL}'!{p}13+'{BIL}'!{p}14-'{BIL}'!{c}13-'{BIL}'!{c}14")
        t = TOT[k]
        e.set(PNL, f'{t}40', f'=SUM({cols[0]}40:{cols[-1]}40)')
        e.set(PNL, f'{t}154', f'=SUM({cols[0]}154:{cols[-1]}154)')

    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    e = build()
    print(f'{len(e.log)} écritures')
    bk = xlcalc.load('PREVISIONS LASCLAY - version audit 2026-07-30.xlsx')
    allc = ['B'] + list('DEFGHIJKLMNO') + FY['FY27'] + FY['FY28'] + FY['FY29']
    bad = [(c, round(bk.get(BIL, c + '76'), 2)) for c in allc
           if abs(bk.get(BIL, c + '76')) > 0.5]
    print('mois hors équilibre :', len(bad), bad[:5])
    tots = ('P', 'AD', 'AR', 'BF')
    print(f'{"":<28}' + ''.join(f'{h:>13}' for h in ('FY2026', 'FY2027', 'FY2028', 'FY2029')))
    for lab, r in (('Ventes nettes', 26), ('  dont ventes au détail', 12),
                   ('Points de vente (fin)', 13), ('Contribution marginale', 32),
                   ('PAI', 137), ('PAI hors aides', 141)):
        print(f'{lab:<28}' + ''.join(f'{bk.get(PNL, f"{t}{r}"):>13,.0f}' for t in tots))
    print(f'{"  marge de contribution":<28}'
          + ''.join(f'{bk.get(PNL, f"{t}32") / bk.get(PNL, f"{t}26"):>13.1%}' for t in tots))
    print(f'{"  PAI hors aides / ventes":<28}'
          + ''.join(f'{bk.get(PNL, f"{t}141") / bk.get(PNL, f"{t}26"):>13.1%}' for t in tots))
