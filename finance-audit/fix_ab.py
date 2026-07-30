#!/usr/bin/env python3
"""Phase AB — figer le budget de FY2026, qui n'avait pas à bouger.

La ligne 5 du résultat, « Revenus Prévisions », est le BUDGET de l'exercice :
c'est elle que la ligne 7 compare au réel. Huit de ses douze mois étaient des
constantes — le budget tel qu'il avait été posé. Les quatre autres, mars à juin
2026, lisaient la feuille des produits en direct.

Recaler les 76 produits sur les unités réellement vendues (phase B) a donc
déplacé ces quatre mois : le budget de FY2026 est passé de 1 065 536 $ à
852 573 $, et la comparaison « réel vs prévu » ne comparait plus à ce qui avait
été budgété. Un exercice fermé ne se rebudgète pas après coup.

Les quatre mois reprennent les montants d'origine, en constantes comme les huit
autres. La feuille des produits ne pilote plus que FY2027 à FY2029, ce qui est
son rôle.
"""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

PNL = 'Résultats-Prev 2025-2029'
F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
# le budget FY2026 tel qu'il avait été posé, mars à juin 2026
BUDGET = {'J': 96720.22, 'K': 79986.84, 'L': 101370.76, 'M': 79016.58}


def build(dst=F, src=F):
    e = Editor(src)
    e.expand_shared()
    for col, val in BUDGET.items():
        e.set(PNL, f'{col}5', val)
    e.set(PNL, 'C5', 'Budget de FY2026 tel qu’il avait été posé (constantes) : un exercice '
                     'fermé ne se rebudgète pas. La feuille des produits ne pilote que '
                     'FY2027 à FY2029.')
    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    e = build()
    A = xlcalc.load('prev_orig.xlsx')
    B = xlcalc.load(F)
    print(f'{len(e.log)} écritures')
    print(f'{"mois":<6}{"budget origine":>16}{"budget actuel":>16}')
    for c in list('DEFGHIJKLMNO') + ['P']:
        print(f'{c:<6}{A.get(PNL, c + "5"):>16,.0f}{B.get(PNL, c + "5"):>16,.0f}')
    print(f'\nréel FY2026 {B.get(PNL, "P3"):,.0f} $ contre un budget de '
          f'{B.get(PNL, "P5"):,.0f} $ — soit {B.get(PNL, "P3") / B.get(PNL, "P5") - 1:+.1%}')
    print('ventes nettes FY2027-FY2029 inchangées :',
          [round(B.get(PNL, c + '26')) for c in ('AD', 'AR', 'BF')])
