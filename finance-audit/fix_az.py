#!/usr/bin/env python3
"""Phase AZ — la marge autorisée est de 150 000 $, pas de 130 000 $.

Le classeur portait deux montants différents pour la même facilité, et le
mémo se servait de l'autre.

- `Inputs!D164`, « Marge de crédit autorisée » : **130 000 $**, une constante
  posée à la phase AP sans source.
- Le compte de QuickBooks s'appelle « 2022 Marge de crédit - EDC LC1 - **150K** ».
- La section 06 du mémo écrit « Marge EDC autorisée 150 000 $ » et en tire le
  coussin restant : 150 000 − 143 026 = 6 974 $.

Deux sources indépendantes contre une constante inexpliquée. Le contrôle de la
rangée 167 annonçait donc **11 878 $ de dépassement d'une limite qui n'est pas
la bonne**, et le journal en concluait qu'il fallait porter la marge à
150 000 $ — alors qu'elle y est déjà.

Ce que ça change au dossier : le sommet projeté de 141 878 $ tient sous la
facilité existante, avec 8 122 $ de marge. Ce n'est pas une bonne nouvelle pour
autant — la facilité est déjà tirée à 143 026 $ et le sommet est atteint deux
étés de suite — mais c'est le vrai portrait, et il vaut mieux qu'un prêteur le
lise ainsi que de le voir corriger une erreur à notre place.

**À confirmer auprès d'EDC et de Desjardins** : c'est le nom du compte au grand
livre qui sert de source, pas une lettre d'autorisation.

    python3 fix_az.py
"""
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'


def build(dst=F, src=F):
    avant = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()

    e.set('Inputs', 'D164', 150000.0, 'Facilité EDC LC1, telle que nommée au '
                                      'grand livre')
    e.set('Inputs', 'E164',
          'Facilité EDC LC1. Le compte du grand livre s’appelle « 2022 Marge '
          'de crédit - EDC LC1 - 150K » et la section 06 du mémo en tire le '
          'coussin restant au 31 juillet 2026. Le classeur a porté 130 000 $ '
          'un temps, sans source. À confirmer par la lettre d’autorisation.')
    e.set('Inputs', 'E165',
          'Le sommet est juillet 2026, et c’est du réel : la marge EDC était '
          'tirée à 143 026 $ au 31 juillet, soit 6 974 $ sous la facilité '
          'autorisée.')
    e.set('Inputs', 'E167',
          'Zéro : le sommet projeté tient sous la facilité existante, avec '
          '8 122 $ de marge. Le tirage n’est pas bridé dans le modèle — si '
          'l’hypothèse de vente se dégrade, le dépassement apparaîtra ici.')

    journal(e)
    e.set_full_calc()
    e.save(dst)

    apres = xlcalc.load(dst)
    return [f'  marge autorisée      {avant.get("Inputs", "D164"):>12,.0f} → '
            f'{apres.get("Inputs", "D164"):>12,.0f}',
            f'  sommet projeté       {apres.get("Inputs", "D166"):>12,.0f}',
            f'  dépassement          {avant.get("Inputs", "D167"):>12,.0f} → '
            f'{apres.get("Inputs", "D167"):>12,.0f}']


def journal(e):
    J = 'Notes d’audit'
    e.set(J, 'A65',
          '• Ce que la bascule révèle : la marge de crédit était tirée à '
          '143 026 $ au 31 juillet 2026, alors que le modèle projetait '
          '27 825 $. Le sommet des mois projetés — août 2026 à août 2029 — '
          's’établit à 141 878 $ en août 2027, sous la facilité EDC de '
          '150 000 $ mais à 8 122 $ près. Le modèle ne bride pas le tirage : '
          'plafonner cacherait le besoin au lieu de le montrer '
          '(Inputs, rangées 163 à 167).')
    e.set(J, 'A74',
          '• Constat de clôture, scénario conservateur : 2025-2026 se referme '
          'sur 977 339 $ de ventes nettes et -122 613 $ avant impôts, dont '
          'onze mois réels. La marge de crédit culmine à 143 026 $ — le réel '
          'du 31 juillet 2026 — et le sommet projeté atteint 141 878 $ en août '
          '2027, le creux d’avant-saison deux étés de suite. La facilité EDC '
          'de 150 000 $ tient, à 8 122 $ près, mais elle est déjà tirée à '
          '95 % : c’est le fonds de roulement qui manque, pas la limite.')
    e.set(J, 'A77',
          '• Corrigé : le classeur portait 130 000 $ comme « marge de crédit '
          'autorisée » (Inputs D164), une constante sans source, pendant que '
          'le compte du grand livre s’appelle « 2022 Marge de crédit - EDC LC1 '
          '- 150K » et que la section 06 du mémo calcule le coussin restant '
          'sur 150 000 $. Le contrôle annonçait donc 11 878 $ de dépassement '
          'd’une limite qui n’est pas la bonne. La valeur passe à 150 000 $ ; '
          'la lettre d’autorisation reste à verser au dossier.')


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
