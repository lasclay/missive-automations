# -*- coding: utf-8 -*-
"""Glossaire du chiffrier, réuni depuis ses parties."""
import glob
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) or '.')

GLOSSAIRE = {}
for _f in sorted(glob.glob(os.path.join(
        os.path.dirname(os.path.abspath(__file__)), 'glossaire_x_*.py'))):
    _m = importlib.import_module(os.path.basename(_f)[:-3])
    GLOSSAIRE.update(_m.GLOSSAIRE)
