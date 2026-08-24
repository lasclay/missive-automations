#!/bin/sh
# Test de non-régression de la chaîne PDF → HPGL.
# Fabrique un patron dont le carré de calibration est volontairement à 96 mm
# au lieu de 100, convertit, puis vérifie que la sortie est géométriquement exacte.
set -e
cd "$(dirname "$0")"
python3 fabrique_patron_test.py
python3 ../diag_pdf.py _patron_test.pdf
python3 ../pdf2hpgl.py _patron_test.pdf --carre 100 \
        --plumes "#000000=1,#ff0000=2,#0000ff=3" -o _test.plt
python3 verifie_conversion.py _test.plt
rm -f _patron_test.pdf _test.plt _test_controle.svg
