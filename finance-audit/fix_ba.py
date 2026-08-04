#!/usr/bin/env python3
"""Phase BA — pourquoi juin et juillet 2026 sont à presque zéro.

Le journal disait ce que les livres montrent, pas ce qui l'explique. Quelqu'un
qui ouvre le chiffrier voit 9 054 $ et 1 491 $ de ventes nettes après neuf mois
à 107 000 $ de moyenne, et conclut ce qu'il veut. La raison est une décision,
et elle se lit dans les mêmes livres.

    python3 fix_ba.py
"""
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'


def build(dst=F, src=F):
    e = Editor(src)
    e.expand_shared()
    e.set('Notes d’audit', 'A78',
          '• Pourquoi juin et juillet 2026 sont à 9 054 $ et 1 491 $ de ventes '
          'nettes : l’activité de l’été a été arrêtée, pas subie. Servir la '
          'saison chaude demandait de produire au Québec, et l’été 2025 l’avait '
          'déjà chiffré — juin et juillet 2025 dégagent 30 % et 58 % de '
          'contribution marginale contre 80 % et 72 % en novembre et décembre, '
          'et ne couvrent pas leurs frais généraux (-3 376 $ pour les deux '
          'mois, avant vente, marketing, administration et financement). '
          'L’entreprise a arrêté la production québécoise, mis à pied les '
          'employés de production et transféré l’assemblage à l’étranger.')
    e.set('Notes d’audit', 'A79',
          '• Ce que les livres montrent de cette décision, de mai à juillet : '
          'la main-d’œuvre de production passe de 35 675 $ à 4 328 $ (-88 %) et '
          'la publicité numérique de 79 599 $ à 9 172 $ (-88 %), pendant que '
          'les achats de matières premières montent de 35 550 $ à 52 719 $ '
          '(+48 %). Une entreprise à court d’argent coupe ses achats ; ceux-ci '
          'montent. C’est un stock constitué d’avance pour un assemblage fait '
          'ailleurs, pas une rupture de trésorerie. La publicité suit la '
          'production : on n’achète pas de la demande qu’on ne pourrait servir '
          'qu’à perte.')
    e.set_full_calc()
    e.save(dst)
    bk = xlcalc.load(dst)
    S = 'Résultats-Prev 2025-2029'
    return [f'ventes nettes juin {bk.get(S, "M26"):,.0f} $, '
            f'juillet {bk.get(S, "N26"):,.0f} $ — expliqué au journal, '
            f'rangées 78 et 79']


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
