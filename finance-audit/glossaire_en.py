# -*- coding: utf-8 -*-
"""Glossaire français → anglais du mémo, réuni depuis ses trois parties.

Découpé pour rester lisible : A couvre la couverture et les sections 01 à 03,
B les sections 04 à 11, C les sections 12 à 18 et les mentions de fin.
"""
from glossaire_a import GLOSSAIRE as A
from glossaire_b import GLOSSAIRE as B
from glossaire_c import GLOSSAIRE as C

GLOSSAIRE = {**A, **B, **C}

_doublons = (set(A) & set(B)) | (set(A) & set(C)) | (set(B) & set(C))
if _doublons:
    raise SystemExit(f'segments définis deux fois : {sorted(_doublons)[:5]}')
