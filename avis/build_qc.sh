#!/bin/sh
# Régénère la page de contrôle qualité à partir des fichiers de travail courants.
cd "$(dirname "$0")" || exit 1
python3 qc_data.py && python3 qc_page.py
