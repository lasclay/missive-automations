#!/usr/bin/env python3
"""Phase AG — le stock en consignation rentre dans l'inventaire.

Il était sur sa propre rangée d'actif. Il n'a pas à l'être : c'est du stock au
même titre que le reste, simplement entreposé chez un détaillant plutôt que chez
Lasclay. Il retourne donc dans l'inventaire de produits finis (bilan, rangée 13).

Le seul piège est celui qui avait faussé la première version : la formule de la
rangée 13 multiplie le même mois de l'exercice précédent par le facteur de
croissance. Y ajouter le stock du canal le ferait remultiplier chaque année EN
PLUS d'être réajouté — l'inventaire de produits finis atteignait 590 622 $ et
gonflait le profit de 336 748 $.

La rangée 13 sépare donc les deux : le stock propre croît, le stock en
consignation se calcule à part et s'ajoute tel quel.

    inventaire PF = (inventaire PF du mois précédent − consignation du mois
                     précédent) × facteur de croissance + consignation du mois

La consignation est calculée rangée 84, sous la ligne de contrôle du bilan :
c'est un mémo, hors des totaux, pour qu'on puisse toujours isoler ce qui dort
chez des tiers — la première question d'un prêteur sur un stock en consignation.
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
OPEN = {'FY27': 'O', 'FY28': 'AC', 'FY29': 'AQ'}
RC = {'FY27': 'C', 'FY28': 'D', 'FY29': 'E'}
GF = {'FY27': 'C', 'FY28': 'D', 'FY29': 'E'}
PREVYR = {'FY27': list('DEFGHIJKLMNO'), 'FY28': FY['FY27'], 'FY29': FY['FY28']}
MEMO = 84          # rangée du mémo, sous la ligne de contrôle


def build(dst='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx',
          src='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'):
    e = Editor(src)
    e.expand_shared()

    # --- AG1 : le mémo du stock en consignation, hors des totaux ----------
    e.set(BIL, f'A{MEMO}', 'Dont stock en consignation chez les détaillants (mémo, compris '
                           'dans l’inventaire de produits finis)')
    e.set(BIL, f'C{MEMO}', 'Lasclay en reste propriétaire jusqu’à la vente au consommateur. '
                           'Pilotes dans Inputs : vente annuelle par point de vente (126), '
                           'mois de couverture (132).')
    for k, cols in FY.items():
        rc = RC[k]
        for c in cols:
            e.set(BIL, f'{c}{MEMO}',
                  f"='{PNL}'!{c}13*Inputs!$D$126*(Inputs!${rc}$57+Inputs!${rc}$59)"
                  f'/12*Inputs!$D$132')
        e.set(BIL, f'{TOT[k]}{MEMO}', f'={cols[-1]}{MEMO}')

    # --- AG2 : l'inventaire de produits finis le reprend ------------------
    e.set(BIL, 'C13', 'Inclut le stock en consignation chez les détaillants ; la part '
                      'en consignation est isolée rangée 84. Seul le stock propre suit le '
                      'facteur de croissance.')
    for k, cols in FY.items():
        gf = GF[k]
        for i, c in enumerate(cols):
            p = PREVYR[k][i]
            e.set(BIL, f'{c}13',
                  f'=({p}13-{p}{MEMO})*Inputs!${gf}$67+{c}{MEMO}')

    # --- AG3 : la rangée 14 redevient ce qu'elle était --------------------
    e.set(BIL, 'C14', None)
    for k, cols in FY.items():
        for c in cols:
            e.set(BIL, f'{c}14', None)

    # --- AG4 : le coût des marchandises et le fonds de roulement ----------
    # la consignation étant de nouveau dans la rangée 13, les deux contreparties
    # retrouvent leur forme d'origine
    e.set(PNL, 'C154', None)
    for k, cols in FY.items():
        for i, c in enumerate(cols):
            p = OPEN[k] if i == 0 else cols[i - 1]
            e.set(PNL, f'{c}40',
                  f"='{BIL}'!{p}11+'{BIL}'!{p}13-'{BIL}'!{c}11-'{BIL}'!{c}13")
            e.set(PNL, f'{c}154', f"='{BIL}'!{p}13-'{BIL}'!{c}13")

    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    e = build()
    print(f'{len(e.log)} écritures')
    bk = xlcalc.load('PREVISIONS LASCLAY - version audit 2026-07-30.xlsx')
    allc = ['B'] + list('DEFGHIJKLMNO') + FY['FY27'] + FY['FY28'] + FY['FY29']
    print('mois hors équilibre :',
          len([c for c in allc if abs(bk.get(BIL, c + '76')) > 0.5]))
    tots = ('P', 'AD', 'AR', 'BF')
    print(f'{"":<28}' + ''.join(f'{h:>13}' for h in ('FY2026', 'FY2027', 'FY2028', 'FY2029')))
    for lab, r in (('Ventes nettes', 26), ('  dont ventes au détail', 12),
                   ('Points de vente (fin)', 13), ('PAI', 137), ('PAI hors aides', 141)):
        print(f'{lab:<28}' + ''.join(f'{bk.get(PNL, f"{t}{r}"):>13,.0f}' for t in tots))
    print(f'{"  PAI hors aides / ventes":<28}'
          + ''.join(f'{bk.get(PNL, f"{t}141") / bk.get(PNL, f"{t}26"):>13.1%}' for t in tots))
    for lab, r in (('Inventaire PF au 31 août', 13), ('  dont consignation', MEMO)):
        print(f'{lab:<28}'
              + ''.join(f'{bk.get(BIL, f"{c}{r}"):>13,.0f}' for c in ('O', 'AC', 'AQ', 'BE')))
