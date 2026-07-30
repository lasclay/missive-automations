#!/usr/bin/env python3
"""Phase AR — mettre le journal d'audit au diapason du recollage.

`fix_aq.py` a rapatrié la séance de tenue de livres du 30 juillet. Deux entrées
du journal parlaient d'un ancrage de trésorerie qui n'est plus le bon, et rien
n'y disait ce que la séance a changé. Le journal est la première feuille qu'un
analyste ouvre : le laisser décrire un état dépassé est pire que de ne rien
écrire.
"""
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
NOTES = 'Notes d’audit'
PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'


def build(dst=F, src=F):
    bk = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()

    # Le séparateur de milliers se pose sur le NOMBRE, jamais sur la phrase :
    # un .replace(',', ' ') appliqué au texte complet mange les virgules de la
    # prose. C'est le même piège que la virgule décimale dans les coordonnées SVG.
    def fr(x):
        return f'{x:,.0f}'.replace(',', ' ') + ' $'

    juin = fr(bk.get(PNL, 'M189'))
    marge_juin = fr(bk.get(PNL, 'M183'))
    vn = fr(bk.get(PNL, 'P26'))
    pai = fr(bk.get(PNL, 'P137'))

    e.set(NOTES, 'A45',
          '• RÉGLÉ : l’ancrage de trésorerie codé en dur (28 472 $) est remplacé '
          f'par l’encaisse réelle de QuickBooks au 30 juin 2026, soit {juin} '
          '(compte chèques -11 635 $, PayPal 6 346 $, parts 5 $), avec la marge '
          f'EDC tirée à {marge_juin}. Le compte chèques a été corrigé de '
          '-8 000 $ à la séance de tenue de livres du 30 juillet : le creux réel '
          'de juin est donc négatif.')

    r = 60
    for txt in (
        '• Séance de tenue de livres du 30 juillet, rapatriée par fix_aq.py. '
        'Juillet 2026 est maintenant comptabilisé chez QuickBooks : 3 117 $ de '
        'revenus, 7 579 $ de coût des marchandises, 43 986 $ de dépenses, soit '
        'une perte de 47 758 $. Le modèle porte encore juillet en prévision, à '
        '-39 272 $ : il est optimiste de 8 486 $ sur ce mois-là.',
        '• Une vente corporative de 8 000 $ d’avril 2026 a été retirée des '
        'livres, avec sa contrepartie au compte chèques. Les ventes nettes de '
        f'2025-2026 passent à {vn} et le résultat avant impôts à {pai}. '
        'L’encaisse d’avril tombe à -71 $ et celle de juin à -5 284 $.',
        '• Autres reclassements de la séance : 1 281 $ de sous-traitance de '
        'couture retirés de janvier ; les frais de RSDE déplacés de « '
        'Sous-traitance » vers « Matériaux » et étalés sur les mois où ils ont '
        'été engagés ; 4 718 $ de décembre passés de « RSDE - Matériaux » à « '
        'RSDE - Salaires Design » ; 277 $ d’intérêts AccordD ajoutés en février.',
        '• Les feuilles de collage sont désormais recollées par libellé et non '
        'par position. Le numéro de compte ne suffit pas : « Bénéfices non '
        'répartis » et « Bénéfice de l’année » n’en ont pas, et ce sont eux qui '
        'portent la contrepartie de toute correction au résultat. Les oublier '
        'sortait le bilan de l’équilibre du montant exact de la correction.',
    ):
        e.set(NOTES, f'A{r}', txt)
        r += 1

    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    build()
    bk = xlcalc.load(F)
    for r in (45, 60, 61, 62, 63):
        print(r, str(bk.get(NOTES, f'A{r}'))[:150])
