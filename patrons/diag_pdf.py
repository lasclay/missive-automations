#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
diag_pdf.py — Diagnostic d'un PDF de patron avant conversion.

Répond aux seules questions qui déterminent si une conversion automatique est
possible, et à quel coût :

  1. Le PDF est-il VECTORIEL ou RASTER (scanné / aplati en image) ?
  2. Est-il en une seule grande page (format traceur) ou en tuiles A4/Letter ?
  3. Quelle est l'échelle réelle ? (recherche d'un carré de calibration)
  4. Combien de types de traits distincts ? (→ affectation des plumes HPGL)
  5. Quelles dimensions réelles occupe le dessin ?

Usage :  python3 diag_pdf.py fichier.pdf [--json]
"""
import sys, json, math
from collections import Counter, defaultdict

try:
    import pymupdf
except ImportError:
    import fitz as pymupdf

PT2MM = 25.4 / 72.0

def mm(v): return round(v * PT2MM, 2)

def hexcol(c):
    if c is None: return None
    if isinstance(c, (int, float)):
        v = int(c * 255); return "#%02x%02x%02x" % (v, v, v)
    try:
        return "#%02x%02x%02x" % tuple(int(round(x * 255)) for x in c[:3])
    except Exception:
        return str(c)

def analyse(path):
    doc = pymupdf.open(path)
    rep = {"fichier": path, "pages": len(doc), "detail_pages": []}

    tailles = Counter()
    tot_paths = tot_images = tot_texte = tot_segments = 0
    couleurs = Counter()
    epaisseurs = Counter()
    carres = []
    bbox_global = None
    couv_img_max = 0.0

    for i, page in enumerate(doc):
        r = page.rect
        w_mm, h_mm = mm(r.width), mm(r.height)
        tailles[(round(w_mm), round(h_mm))] += 1

        try:
            dessins = page.get_drawings()
        except Exception:
            dessins = []
        images = page.get_images(full=True)
        texte = page.get_text("text").strip()

        tot_paths += len(dessins)
        tot_segments += sum(len(d.get("items") or []) for d in dessins)
        tot_images += len(images)
        tot_texte += len(texte)

        # bbox du dessin vectoriel + inventaire des traits
        bb = None
        for d in dessins:
            if d.get("color") is not None:
                couleurs[hexcol(d["color"])] += 1
            lw = d.get("width")
            if lw: epaisseurs[round(lw * PT2MM, 2)] += 1
            rr = d.get("rect")
            if rr:
                bb = rr if bb is None else bb | rr
                # candidat carré de calibration : carré fermé de 20 à 300 mm
                wmm, hmm = mm(rr.width), mm(rr.height)
                if wmm > 20 and hmm > 20 and wmm < 300 and hmm < 300 \
                   and abs(wmm - hmm) < max(0.6, 0.02 * wmm):
                    carres.append({"page": i + 1, "cote_mm": round((wmm + hmm) / 2, 2)})

        if bb is not None:
            if bbox_global is None: bbox_global = bb
            else: bbox_global = bbox_global | bb

        # surface couverte par les images (détecte un PDF aplati en bitmap)
        surf_img = 0.0
        for im in images:
            for rect in page.get_image_rects(im[0]) or []:
                surf_img += rect.width * rect.height
        ratio_img = round(surf_img / (r.width * r.height), 3) if r.width and r.height else 0
        couv_img_max = max(couv_img_max, ratio_img)

        rep["detail_pages"].append({
            "page": i + 1,
            "taille_mm": [w_mm, h_mm],
            "chemins_vectoriels": len(dessins),
            "images": len(images),
            "couverture_image": ratio_img,
            "caracteres_texte": len(texte),
            "extrait_texte": texte[:180].replace("\n", " ") if texte else "",
        })

    # ---- verdicts ----
    # Le vrai discriminant n'est pas le nombre de chemins mais la présence
    # d'une image qui recouvre la page : c'est la signature d'un PDF aplati.
    a_vecteur = tot_segments >= 4
    image_dominante = couv_img_max >= 0.6

    if a_vecteur and not image_dominante:
        nature = "VECTORIEL"
        note_nature = ("Conversion automatique possible sans perte. "
                       + (f"Attention : {tot_images} image(s) présente(s), "
                          "vérifier qu'elles ne portent pas de tracé utile."
                          if tot_images else ""))
    elif a_vecteur and image_dominante:
        nature = "MIXTE"
        note_nature = (f"Géométrie vectorielle présente, mais une image couvre "
                       f"{int(couv_img_max*100)} % de la page. Vérifier si le tracé du "
                       "patron est dans le vectoriel ou dans l'image avant de convertir.")
    elif tot_images:
        nature = "RASTER"
        note_nature = ("Le patron est une image. Une vectorisation est nécessaire "
                       "(potrace/autotrace) : résultat approximatif, retouche manuelle "
                       "obligatoire. Ce n'est plus une conversion, c'est un redessin assisté.")
    else:
        nature = "VIDE / ILLISIBLE"
        note_nature = "Ni vecteur ni image détectés. PDF protégé ou format inhabituel ?"

    grandes = [t for t in tailles if max(t) > 500]
    petites = [t for t in tailles if max(t) <= 500]
    if len(doc) > 4 and not grandes:
        mise_en_page = "TUILÉ"
        note_mep = (f"{len(doc)} pages au format {petites[0][0]}×{petites[0][1]} mm. "
                    "Il faut réassembler les tuiles avant conversion — repères "
                    "d'alignement et chevauchement à gérer.")
    elif grandes:
        mise_en_page = "FORMAT TRACEUR"
        note_mep = f"Grande page détectée ({grandes[0][0]}×{grandes[0][1]} mm). Cas le plus simple."
    else:
        mise_en_page = "PAGE UNIQUE STANDARD"
        note_mep = "Une ou quelques pages de format bureautique."

    # carré de calibration : la taille la plus fréquente parmi les candidats
    calib = None
    if carres:
        c = Counter(round(x["cote_mm"]) for x in carres).most_common(1)[0]
        calib = {"cote_mm_detecte": c[0], "occurrences": c[1],
                 "candidats": carres[:8]}

    rep["synthese"] = {
        "nature": nature, "note_nature": note_nature,
        "mise_en_page": mise_en_page, "note_mise_en_page": note_mep,
        "chemins_vectoriels_total": tot_paths,
        "segments_vectoriels_total": tot_segments,
        "caracteres_texte_total": tot_texte,
        "images_total": tot_images,
        "couverture_image_max": couv_img_max,
        "formats_de_page": [{"mm": list(k), "pages": v} for k, v in tailles.items()],
        "couleurs_de_trait": [{"couleur": k, "chemins": v} for k, v in couleurs.most_common(12)],
        "epaisseurs_de_trait_mm": [{"mm": k, "chemins": v} for k, v in epaisseurs.most_common(8)],
        "carre_de_calibration": calib,
        "emprise_du_dessin_mm": ([mm(bbox_global.width), mm(bbox_global.height)]
                                  if bbox_global else None),
    }
    doc.close()
    return rep

def affiche(rep):
    s = rep["synthese"]
    L = lambda k, v: print(f"  {k:.<34} {v}")
    print("\n" + "=" * 74)
    print(f"  DIAGNOSTIC  —  {rep['fichier']}")
    print("=" * 74)
    L("Pages", rep["pages"])
    L("Nature", s["nature"])
    print(f"      → {s['note_nature']}")
    L("Mise en page", s["mise_en_page"])
    print(f"      → {s['note_mise_en_page']}")
    L("Chemins vectoriels", f'{s["chemins_vectoriels_total"]} groupes / '
                             f'{s["segments_vectoriels_total"]} segments')
    L("Texte (étiquettes de pièces)", f'{s["caracteres_texte_total"]} caractères')
    L("Images", s["images_total"])
    if s["emprise_du_dessin_mm"]:
        w, h = s["emprise_du_dessin_mm"]
        L("Emprise du dessin", f"{w} × {h} mm")

    print("\n  Formats de page")
    for f in s["formats_de_page"]:
        print(f"      {f['mm'][0]} × {f['mm'][1]} mm   ({f['pages']} page(s))")

    if s["couleurs_de_trait"]:
        print("\n  Couleurs de trait  (→ affectation des plumes HPGL)")
        for c in s["couleurs_de_trait"]:
            print(f"      {c['couleur']}   {c['chemins']} chemin(s)")

    if s["epaisseurs_de_trait_mm"]:
        print("\n  Épaisseurs de trait")
        for e in s["epaisseurs_de_trait_mm"]:
            print(f"      {e['mm']} mm   {e['chemins']} chemin(s)")

    print("\n  Carré de calibration")
    if s["carre_de_calibration"]:
        c = s["carre_de_calibration"]
        print(f"      Détecté : {c['cote_mm_detecte']} mm de côté "
              f"({c['occurrences']} occurrence(s))")
        print("      → Comparer avec la valeur imprimée sur le patron pour")
        print("        confirmer l'échelle avant conversion.")
    else:
        print("      Aucun détecté. L'échelle devra être calibrée à la main")
        print("      sur une cote connue (--calibrer dans pdf2hpgl.py).")
    print("=" * 74 + "\n")

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__); sys.exit(1)
    for f in args:
        r = analyse(f)
        if "--json" in sys.argv: print(json.dumps(r, indent=2, ensure_ascii=False))
        else: affiche(r)
