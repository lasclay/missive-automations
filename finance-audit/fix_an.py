#!/usr/bin/env python3
"""Phase AN — les taxes à payer, et le mois de novembre.

La rangée 35 du bilan porte le solde net de TPS et de TVQ. Les douze mois de
2025-2026 viennent de QuickBooks ; les trois exercices suivants recopient ce
profil mensuel en le multipliant par un facteur. Deux défauts.

1. Onze des douze mois de 2028-2029 lisent la rangée 34, « Frais courus à
   payer », au lieu de la 35. Le solde des taxes y devient donc plat à 10 500 $
   d'octobre à juillet, alors qu'il devrait suivre la saison. Comme la variation
   du poste alimente le fonds de roulement, c'est la trésorerie du dernier
   exercice qui s'en trouve faussée.

2. Le facteur de croissance est écrit en dur, 1,35 puis 1,4, sans rapport avec
   les ventes du scénario actif. Les taxes se perçoivent pourtant sur les
   ventes : le solde suit le volume, pas une constante. Le facteur devient donc
   le rapport des ventes nettes d'un exercice à l'autre, ce qui le rend juste
   dans les deux scénarios.

Le calendrier des versements, lui, n'a pas à être reconstruit. Le profil de
2025-2026 porte déjà le rythme réel, vérifié dans le grand livre : l'écriture
annuelle de novembre au compte 2110 et le versement de février qui suit le
trimestre de décembre. Le recopier en le mettant à l'échelle des ventes
conserve ce rythme, y compris le creux de trésorerie de novembre.
"""
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
BIL = 'Bilan2026-27-28'
PNL = 'Résultats-Prev 2025-2029'
TAXES = 35

FY26 = list('DEFGHIJKLMNO')
FY27 = ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC']
FY28 = ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ']
FY29 = ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']
# colonne du total de l'exercice au résultat
TOT = {'FY26': 'P', 'FY27': 'AD', 'FY28': 'AR', 'FY29': 'BF'}


def build(dst=F, src=F):
    e = Editor(src)
    e.expand_shared()

    # Chaque exercice reprend le mois correspondant du précédent, mis à
    # l'échelle des ventes nettes. La référence de rangée est explicite, ce qui
    # rend impossible le glissement vers la rangée voisine.
    for prec, suiv, a, b in ((FY26, FY27, 'P', 'AD'), (FY27, FY28, 'AD', 'AR'),
                             (FY28, FY29, 'AR', 'BF')):
        for cp, cs in zip(prec, suiv):
            e.set(BIL, f'{cs}{TAXES}',
                  f"={cp}{TAXES}*'{PNL}'!${b}$26/'{PNL}'!${a}$26")

    e.set(BIL, f'C{TAXES}',
          "Solde net de TPS et de TVQ. 2025-2026 vient de QuickBooks ; les "
          "exercices suivants reprennent ce profil mensuel à l'échelle des "
          "ventes nettes, ce qui conserve le rythme réel des versements, dont "
          "l'écriture de fin novembre et le versement de février.")

    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    avant = xlcalc.load(F)
    build()
    apres = xlcalc.load(F)
    MOIS = ['sep', 'oct', 'nov', 'déc', 'jan', 'fév', 'mar', 'avr', 'mai',
            'jun', 'jul', 'aoû']
    print('Taxes à payer, solde de fin de mois')
    for lab, cols in (('2026-2027', FY27), ('2027-2028', FY28),
                      ('2028-2029', FY29)):
        av = [avant.get(BIL, c + str(TAXES)) for c in cols]
        ap = [apres.get(BIL, c + str(TAXES)) for c in cols]
        print(f'  {lab} avant ' + ' '.join(f'{m}:{v:>7,.0f}'
                                           for m, v in zip(MOIS, av)))
        print(f'  {lab} après ' + ' '.join(f'{m}:{v:>7,.0f}'
                                           for m, v in zip(MOIS, ap)))
    COLS = FY26 + FY27 + FY28 + FY29
    print('\nmois hors équilibre :',
          sum(1 for c in COLS if abs(apres.get(BIL, c + '76')) > 0.01))
    print('encaisse la plus basse :',
          f"{min(apres.get(PNL, c + '189') for c in COLS):>12,.0f}",
          '(avant :', f"{min(avant.get(PNL, c + '189') for c in COLS):>12,.0f})")
    print('marge de crédit au pic :',
          f"{max(apres.get(PNL, c + '183') for c in COLS):>12,.0f}",
          '(avant :', f"{max(avant.get(PNL, c + '183') for c in COLS):>12,.0f})")
