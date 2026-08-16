#!/usr/bin/env python3
"""Phase BE — l'avance de l'actionnaire portée à 90 000 $.

`Inputs!C116` portait 80 000 $, le montant convenu au 15 août 2026. La direction
confirme que l'avance peut être étirée à **90 000 $**. Les 10 000 $ de plus ne
changent rien à la trajectoire, mais ils tombent sur le seul mois tendu des
trente-sept mois projetés.

Août 2026 est le mois où le prêt institutionnel n'est pas encore là et où la
marge porte encore le creux d'avant-saison. Le tirage passe de **131 134 $ à
121 200 $** sur une facilité de 150 000 $ : le coussin passe de 18 866 $ à
28 800 $, soit de 13 % à 19 % de la facilité. Dès septembre, le prêt à terme
arrive et la marge retombe à zéro.

L'avance reste subordonnée et non garantie ; le modèle la rembourse sur
2026-2027 comme l'entente le prévoit.

    python3 fix_be.py
"""
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
S = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
I = 'Inputs'
MONTANT = 90_000.0


def build(dst=F, src=F):
    avant = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()

    e.set(I, 'C116', MONTANT)
    journal(e)

    e.set_full_calc()
    e.save(dst)
    apres = xlcalc.load(dst)

    return [
        f'avance d’actionnaire   {avant.get(I, "C116"):>10,.0f} → '
        f'{apres.get(I, "C116"):>10,.0f}',
        f'  solde au bilan       {avant.get(BIL, "O47"):>10,.0f} → '
        f'{apres.get(BIL, "O47"):>10,.0f}',
        f'  marge, août 2026     {avant.get(S, "O183"):>10,.0f} → '
        f'{apres.get(S, "O183"):>10,.0f}',
        f'  coussin sur 150 000  {150000 - avant.get(S, "O183"):>10,.0f} → '
        f'{150000 - apres.get(S, "O183"):>10,.0f}',
        f'  sommet projeté       {avant.get(I, "D166"):>10,.0f} → '
        f'{apres.get(I, "D166"):>10,.0f}',
        f'  contrôle du bilan, écart maximal sur 48 mois : '
        f'{ecart_max(apres):.6f}',
    ]


def ecart_max(bk):
    from openpyxl.utils import get_column_letter as gl, column_index_from_string as ci
    cols = []
    for a, b in (('D', 'O'), ('R', 'AC'), ('AF', 'AQ'), ('AT', 'BE')):
        cols += [gl(i) for i in range(ci(a), ci(b) + 1)]
    return max(abs(bk.get(BIL, f'{c}76')) for c in cols)


def journal(e):
    e.set('Notes d’audit', 'A93',
          '• Avance de l’actionnaire portée de 80 000 $ à 90 000 $ (Inputs '
          'C116), montant confirmé par la direction. Elle tombe sur le seul '
          'mois tendu des trente-sept projetés : août 2026, avant l’arrivée du '
          'prêt à terme. Le tirage de la marge passe de 131 134 $ à 121 200 $ '
          'sur une facilité de 150 000 $, soit un coussin qui passe de 13 % à '
          '19 %. Dès septembre 2026 la marge retombe à zéro et n’y remonte '
          'qu’à 74 882 $ en août 2027.')


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
