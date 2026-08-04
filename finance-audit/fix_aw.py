#!/usr/bin/env python3
"""Phase AW — corriger le journal après coup, et poser le constat de clôture.

Une entrée écrite à la phase AT affirmait que les mois projetés restaient sous
la limite de marge de crédit. C'était vrai à l'instant où elle a été écrite, et
faux dix minutes plus tard : la phase AU a corrigé la frontière et le sommet
projeté est passé à 145 305 $. Un journal d'audit qui garde une affirmation
périmée vaut moins que pas de journal du tout.

    python3 fix_aw.py
"""
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'


def build(dst=F, src=F):
    e = Editor(src)
    e.expand_shared()
    J = 'Notes d’audit'

    e.set(J, 'A65',
          '• Ce que la bascule révèle : la marge de crédit était tirée à '
          '143 026 $ au 31 juillet 2026, alors que le modèle projetait '
          '27 825 $. Le sommet des mois projetés — août 2026 à août 2029 — '
          's’établit à 145 305 $ en août 2027, soit 15 305 $ au-dessus de la '
          'limite de 130 000 $ retenue. Le modèle ne bride pas le tirage : '
          'plafonner cacherait le besoin au lieu de le montrer '
          '(Inputs, rangées 163 à 167).')
    e.set(J, 'A74',
          '• Constat de clôture, scénario conservateur : 2025-2026 se referme '
          'sur 977 339 $ de ventes nettes et -122 613 $ avant impôts, dont '
          'onze mois réels. La marge de crédit demandée culmine à 145 305 $ '
          'en août 2027 — le creux saisonnier d’avant-saison, deux fois de '
          'suite. C’est le chiffre du dossier : la limite autorisée de '
          '130 000 $ ne suffit pas, il en faut 150 000 $.')
    e.set(J, 'A75',
          '• Vérifié après toutes les corrections : le contrôle du bilan '
          '(rangée 76) reste à zéro sur les 48 mois, dans le scénario '
          'conservateur comme dans l’ambitieux, et aucune cellule des '
          'feuilles visibles ne rend d’erreur. Le résultat avant impôts de '
          'juillet 2026 tombe au cent près sur le PROFIT de QuickBooks.')

    e.set_full_calc()
    e.save(dst)
    bk = xlcalc.load(dst)
    return [f'journal mis à jour ; tirage projeté '
            f'{bk.get("Inputs", "D166"):,.0f} $, dépassement '
            f'{bk.get("Inputs", "D167"):,.0f} $']


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
