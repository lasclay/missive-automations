# -*- coding: utf-8 -*-
"""Fabrique un PDF de patron synthétique pour valider la chaîne de conversion.
Le carré de calibration est dessiné à 96 mm alors qu'il devrait faire 100 mm :
on simule un export mal échelonné, exactement le cas qu'on doit rattraper."""
import pymupdf
MM = 72.0 / 25.4
doc = pymupdf.open(); page = doc.new_page(width=340*MM, height=260*MM)

def P(x, y): return pymupdf.Point(x*MM, y*MM)

NOIR, ROUGE, BLEU = (0,0,0), (1,0,0), (0,0,1)

# --- carré de calibration : 96 mm au lieu de 100 ---
sh = page.new_shape()
sh.draw_rect(pymupdf.Rect(P(15,15), P(15+96, 15+96)))
sh.finish(color=NOIR, width=0.6, fill=None); sh.commit()

# --- contour de pièce : droites + courbes de Bézier (noir) ---
sh = page.new_shape()
sh.draw_line(P(140, 30), P(250, 30))
sh.draw_bezier(P(250, 30), P(285, 70), P(290, 140), P(268, 196))
sh.draw_line(P(268, 196), P(150, 196))
sh.draw_bezier(P(150, 196), P(128, 140), P(133, 70), P(140, 30))
sh.finish(color=NOIR, width=0.6, fill=None); sh.commit()

# --- crans de montage (rouge) ---
sh = page.new_shape()
for x, y in [(196, 30), (268, 120), (206, 196)]:
    sh.draw_line(P(x, y), P(x, y+6))
sh.finish(color=ROUGE, width=0.4, fill=None); sh.commit()

# --- droit-fil (bleu) ---
sh = page.new_shape()
sh.draw_line(P(200, 50), P(200, 175))
sh.finish(color=BLEU, width=0.4, fill=None); sh.commit()

page.insert_text(P(15, 122), "CARRE DE CALIBRATION 100 mm", fontsize=9)
page.insert_text(P(140, 215), "DEVANT - T.M - COUPER 2x - DROIT FIL", fontsize=9)
doc.save("_patron_test.pdf"); doc.close()
print("PDF de test écrit : _patron_test.pdf (carré dessiné à 96 mm, cible 100 mm)")
