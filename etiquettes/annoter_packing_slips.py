#!/usr/bin/env python3
"""Annote les packing slips pour l'ensachage.

Sur chaque page :
  - un bandeau orange en haut à droite avec le nombre d'enveloppes (texte noir) ;
  - surlignés en orange, les mots « sachet » et « paquet » et les chiffres de quantité
    (colonne Qty, format du paquet, nombre de sachets).

Usage :
    python3 annoter_packing_slips.py <packing_slips.pdf> <sortie.pdf> [--exclure L-50736]
"""
import io
import re
import sys

import pdfplumber
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

from etiquettes_enveloppes import compter, lire_packing_slips

ORANGE = (1.0, 0.60, 0.05)
ALPHA_SURLIGNE = 0.45
MOTS_CLES = ("sachet", "sachets", "paquet", "paquets")
# La description occupe la moitié gauche ; Price, Qty et Ext. Price suivent.
X_FIN_DESCRIPTION = 185
X_QTE = (216, 245)
X_PRIX = (185, 218)


def est_entier(txt):
    return bool(re.fullmatch(r"\d+", txt))


def nettoie(txt):
    return txt.strip(" /-­().,").lower()


def boites_a_surligner(page):
    """Rectangles (x0, top, x1, bottom) des mots et chiffres de quantité."""
    mots = page.extract_words()
    boites = []

    # 1. Colonne Qty des lignes d'article (les rabais affichent leur montant entre
    #    parenthèses, donc sans jeton commençant par '$' : ils sont ignorés).
    lignes = {}
    for mot in mots:
        lignes.setdefault(round(mot["top"], 1), []).append(mot)
    for haut, mots_ligne in lignes.items():
        a_prix = any(m["text"].startswith("$") and X_PRIX[0] <= m["x0"] <= X_PRIX[1]
                     for m in mots_ligne)
        if not a_prix:
            continue
        for m in mots_ligne:
            if X_QTE[0] <= m["x0"] <= X_QTE[1] and est_entier(m["text"]):
                boites.append(m)

    # 2. Mots-clés et chiffres associés, dans l'ordre de lecture de la description.
    flux = sorted((m for m in mots if m["x0"] < X_FIN_DESCRIPTION),
                  key=lambda m: (round(m["top"], 1), m["x0"]))
    for i, mot in enumerate(flux):
        base = nettoie(mot["text"])
        if base not in MOTS_CLES:
            continue
        boites.append(mot)
        if base.startswith("sachet"):
            # « / 1 sachet » — le chiffre précède, parfois séparé par un code d'article
            # quand la ligne se casse en deux.
            for precedent in reversed(flux[max(0, i - 2):i]):
                if est_entier(precedent["text"]):
                    boites.append(precedent)
                    break
        else:
            # « Paquet de 10 » — le chiffre suit.
            for suivant in flux[i + 1:i + 3]:
                if est_entier(suivant["text"]):
                    boites.append(suivant)
                    break
    return boites


def dessine_page(c, page, info, largeur, hauteur):
    def y(top):
        return hauteur - top

    # Surlignage translucide : le texte reste lisible dessous.
    c.saveState()
    c.setFillColorRGB(*ORANGE)
    c.setFillAlpha(ALPHA_SURLIGNE)
    c.setStrokeAlpha(0)
    for b in boites_a_surligner(page):
        c.rect(b["x0"] - 1, y(b["bottom"]) - 0.5,
               b["x1"] - b["x0"] + 2, b["bottom"] - b["top"] + 1, stroke=0, fill=1)
    c.restoreState()

    # Bandeau : nombre d'enveloppes, noir sur orange plein.
    x0, x1, haut, bas = 150, 282, 16, 46
    c.setFillColorRGB(*ORANGE)
    c.rect(x0, y(bas), x1 - x0, bas - haut, stroke=0, fill=1)
    c.setFillColorRGB(0, 0, 0)
    if info is None:
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString((x0 + x1) / 2, y(bas) + 10, "RETIRÉ DU LOT")
        return
    n = info["enveloppes"]
    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString((x0 + x1) / 2, y(bas) + 13,
                        f"{n} ENVELOPPE" + ("S" if n > 1 else ""))
    c.setFont("Helvetica", 8)
    c.drawCentredString((x0 + x1) / 2, y(bas) + 4,
                        f"{info['sachets']} sachet" + ("s" if info["sachets"] > 1 else ""))


def main():
    args = sys.argv[1:]
    exclues = set()
    if "--exclure" in args:
        i = args.index("--exclure")
        exclues = {c.strip() for c in args[i + 1].split(",") if c.strip()}
        del args[i:i + 2]
    if len(args) < 2:
        print(__doc__)
        sys.exit(1)
    source, destination = args[0], args[1]

    compte = compter(lire_packing_slips(source))
    lecteur = PdfReader(source)
    ecrivain = PdfWriter()

    with pdfplumber.open(source) as pdf:
        for index, page in enumerate(pdf.pages):
            largeur, hauteur = float(page.width), float(page.height)
            tampon = io.BytesIO()
            c = canvas.Canvas(tampon, pagesize=(largeur, hauteur))
            commande = next((k for k, v in compte.items() if v["page"] == index + 1), None)
            info = None if commande in exclues else compte.get(commande)
            dessine_page(c, page, info, largeur, hauteur)
            c.save()
            tampon.seek(0)
            fond = lecteur.pages[index]
            fond.merge_page(PdfReader(tampon).pages[0])
            ecrivain.add_page(fond)

    with open(destination, "wb") as f:
        ecrivain.write(f)
    total = sum(v["enveloppes"] for k, v in compte.items() if k not in exclues)
    print(f"{len(lecteur.pages)} pages annotées → {destination}")
    print(f"Étiquettes correspondantes : {total}")


if __name__ == "__main__":
    main()
