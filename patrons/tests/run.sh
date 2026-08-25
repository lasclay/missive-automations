#!/bin/sh
# Non-régression de la chaîne patrons.
#  1. PDF → HPGL : le carré de calibration, volontairement à 96 mm au lieu de 100,
#     doit ressortir à 100,000 mm exactement.
#  2. Boucle fermée : le HPGL produit doit être reconnu « cohérent » par l'audit,
#     c'est-à-dire auto-vérifiable sans connaître la convention d'unité.
#  3. L'audit doit détecter la bonne unité sur les vrais fichiers Lasclay.
set -e
cd "$(dirname "$0")"

echo "### 1. Conversion et exactitude géométrique"
python3 fabrique_patron_test.py
python3 ../diag_pdf.py _patron_test.pdf
python3 ../pdf2hpgl.py _patron_test.pdf --carre 100 \
        --plumes "#000000=1,#ff0000=2,#0000ff=3" -o _test.plt
python3 verifie_conversion.py _test.plt

echo "### 2. Boucle fermée : le fichier produit est auto-vérifiable"
python3 ../pdf2hpgl.py _patron_test.pdf --carre 100 --unites 4 \
        --nom "Devant test" -o _t.hpgl >/dev/null
python3 ../audit_hpgl.py _t.hpgl | grep -q "\[OK\]" \
  && echo "  [OK ] l'audit reconnaît l'échelle du fichier généré" \
  || { echo "  [ÉCHEC] le fichier généré n'est pas auto-vérifiable"; exit 1; }

echo "### 3. Audit des échantillons réels"
python3 ../audit_hpgl.py ../echantillons/ | tail -22

rm -f _patron_test.pdf _test.plt _test_controle.svg _t.hpgl _t_controle.svg
