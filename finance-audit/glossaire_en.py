# -*- coding: utf-8 -*-
"""Glossaire français → anglais du mémo, réuni depuis ses trois parties.

Découpé pour rester lisible : A couvre la couverture et les sections 01 à 03,
B les sections 04 à 11, C les sections 12 à 18 et les mentions de fin, D les
segments réécrits quand juillet 2026 est passé au réel.

Un segment ne doit vivre que dans une partie. Les clés portent les chiffres du
modèle : quand un chiffre bouge, la clé change et l'ancienne devient morte
plutôt que fausse — mais si les deux coexistaient dans deux parties, laquelle
gagne dépendrait de l'ordre de fusion. D'où le contrôle ci-dessous.
"""
from glossaire_a import GLOSSAIRE as A
from glossaire_b import GLOSSAIRE as B
from glossaire_c import GLOSSAIRE as C
from glossaire_d import GLOSSAIRE as D

GLOSSAIRE = {**A, **B, **C, **D}

_parties = {'A': A, 'B': B, 'C': C, 'D': D}
_doublons = {c for x, p in _parties.items() for y, q in _parties.items()
             if x < y for c in set(p) & set(q)}
if _doublons:
    raise SystemExit(f'segments définis deux fois : {sorted(_doublons)[:5]}')
