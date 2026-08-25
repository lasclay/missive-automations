#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audit_hpgl.py — Vérifie l'échelle réelle d'un lot de fichiers HPGL de patrons.

Le problème qu'il détecte
    Un fichier HPGL ne dit nulle part combien vaut une unité. Le standard HP-GL
    dit 0,025 mm (40 u/mm), mais chaque logiciel exporte à sa manière. Deux
    fichiers du même dossier peuvent donc être à des échelles différentes — et
    un patron plotté 4 fois trop grand, c'est du tissu perdu.

Comment il tranche
    Si le fichier contient une étiquette du type « COUPE 67,9 X 52,1 CM », on
    compare la géométrie à cette dimension déclarée : l'unité se déduit sans
    ambiguïté. C'est la meilleure pratique et elle devrait être systématique.
    Sinon, on affiche la taille obtenue sous chaque hypothèse et on laisse
    l'humain reconnaître laquelle est plausible.

Usage
    python3 audit_hpgl.py dossier/            # tout un lot
    python3 audit_hpgl.py *.hpgl
    python3 audit_hpgl.py fichier.hpgl --attendu 245x336
"""
import sys, os, re, glob, argparse

# hypothèses d'unité rencontrées en pratique, en unités par millimètre
HYPOTHESES = [
    (40.0,  "0,025 mm — standard HP-GL"),
    (10.0,  "0,1 mm"),
    (4.0,   "0,25 mm"),
    (100.0, "0,01 mm"),
    (1.0,   "1 mm"),
]

RE_INSTR = re.compile(r'([A-Z]{2})([^;]*);')
RE_DIM   = re.compile(
    r'(\d+(?:[.,]\d+)?)\s*[Xx]\s*(\d+(?:[.,]\d+)?)\s*(CM|MM|PO|IN)\b', re.I)


def lire(chemin):
    """Retourne (bbox_unites, etiquettes, instructions_presentes)."""
    txt = open(chemin, "r", encoding="latin-1", errors="ignore").read()
    xs, ys, labels, instrs = [], [], [], set()

    for m in RE_INSTR.finditer(txt):
        code, arg = m.group(1).upper(), m.group(2)
        instrs.add(code)
        if code in ("PU", "PD", "PA"):
            n = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', arg)]
            xs += n[0::2]; ys += n[1::2]

    # LB se termine par ETX (0x03), pas par ';'
    for m in re.finditer(r'LB([^\x03]*)\x03', txt):
        t = m.group(1).strip()
        if t: labels.append(t)

    if not xs:
        return None, labels, instrs
    return (min(xs), min(ys), max(xs), max(ys)), labels, instrs


def dims_declarees(labels):
    """Cherche une dimension explicite dans les étiquettes. Retourne (l_mm, h_mm, source)."""
    for t in labels:
        m = RE_DIM.search(t)
        if not m: continue
        a = float(m.group(1).replace(",", "."))
        b = float(m.group(2).replace(",", "."))
        u = m.group(3).upper()
        k = {"CM": 10.0, "MM": 1.0, "PO": 25.4, "IN": 25.4}[u]
        return a * k, b * k, t
    return None, None, None


def audit(chemin, attendu=None):
    bbox, labels, instrs = lire(chemin)
    r = {"fichier": os.path.basename(chemin), "labels": labels,
         "instructions": sorted(instrs), "bbox": bbox}
    if not bbox:
        r["verdict"] = "AUCUNE GÉOMÉTRIE"
        return r

    x0, y0, x1, y1 = bbox
    lu, hu = x1 - x0, y1 - y0
    r["taille_unites"] = (lu, hu)

    # dimension de référence : --attendu prioritaire, sinon étiquette du fichier
    if attendu:
        ref_l, ref_h, src = attendu[0], attendu[1], "paramètre --attendu"
    else:
        ref_l, ref_h, src = dims_declarees(labels)
        if src: src = f"étiquette « {src[:60]} »"
    r["reference"] = (ref_l, ref_h, src)

    r["hypotheses"] = [
        {"u_par_mm": u, "nom": nom, "mm": (lu / u, hu / u)} for u, nom in HYPOTHESES
    ]

    if ref_l:
        # la référence peut être donnée dans l'autre sens : on teste les deux
        best = None
        for u, nom in HYPOTHESES:
            L, H = lu / u, hu / u
            for cl, ch in ((ref_l, ref_h), (ref_h, ref_l)):
                err = max(abs(L - cl) / cl, abs(H - ch) / ch) * 100
                if best is None or err < best[0]:
                    best = (err, u, nom, L, H)
        err, u, nom, L, H = best
        r["detecte"] = {"u_par_mm": u, "nom": nom, "mm": (L, H), "ecart_pct": err}
        r["verdict"] = "COHÉRENT" if err <= 1.0 else ("DOUTEUX" if err <= 5.0 else "INCOHÉRENT")
    else:
        r["verdict"] = "ÉCHELLE INDÉTERMINÉE"
    return r


def affiche(resultats):
    LARG = 78
    print("\n" + "=" * LARG)
    print("  AUDIT D'ÉCHELLE — FICHIERS HPGL DE PATRONS")
    print("=" * LARG)

    for r in resultats:
        print(f"\n  {r['fichier']}")
        print("  " + "-" * (LARG - 4))
        if r["verdict"] == "AUCUNE GÉOMÉTRIE":
            print("    Aucune coordonnée trouvée."); continue

        lu, hu = r["taille_unites"]
        print(f"    Géométrie ......... {lu:.0f} × {hu:.0f} unités")
        print(f"    Instructions ...... {', '.join(r['instructions'])}")

        ref_l, ref_h, src = r["reference"]
        if src:
            print(f"    Référence ......... {ref_l:.0f} × {ref_h:.0f} mm")
            print(f"                        ({src})")

        if "detecte" in r:
            d = r["detecte"]
            marque = {"COHÉRENT": "OK", "DOUTEUX": "??", "INCOHÉRENT": "!!"}[r["verdict"]]
            print(f"    [{marque}] Unité ........ {d['u_par_mm']:g} u/mm — {d['nom']}")
            print(f"         Taille réelle . {d['mm'][0]:.1f} × {d['mm'][1]:.1f} mm"
                  f"   (écart {d['ecart_pct']:.2f} %)")
        else:
            print("    [??] Échelle indéterminée — aucune dimension déclarée.")
            print("         Tailles selon l'hypothèse :")
            for h in r["hypotheses"]:
                print(f"           {h['u_par_mm']:>5g} u/mm  →  "
                      f"{h['mm'][0]:8.1f} × {h['mm'][1]:7.1f} mm   ({h['nom']})")

    # ---- synthèse ----
    print("\n" + "=" * LARG)
    print("  SYNTHÈSE")
    print("=" * LARG)
    unites = {}
    for r in resultats:
        if "detecte" in r:
            unites.setdefault(r["detecte"]["u_par_mm"], []).append(r["fichier"])
    indet = [r["fichier"] for r in resultats if r["verdict"] == "ÉCHELLE INDÉTERMINÉE"]

    if unites:
        print("\n  Conventions d'unité détectées :")
        for u, fs in sorted(unites.items()):
            print(f"    {u:g} u/mm  ({len(fs)} fichier(s))")
            for f in fs: print(f"        {f}")
    if indet:
        print(f"\n  Échelle indéterminée ({len(indet)} fichier(s)) :")
        for f in indet: print(f"        {f}")

    if len(unites) > 1:
        print("\n  /!\\  PLUSIEURS CONVENTIONS COEXISTENT DANS LE MÊME LOT.")
        print("       Un fichier plotté avec la mauvaise unité sort à une taille")
        print("       fausse d'un facteur entier. À uniformiser avant d'envoyer")
        print("       quoi que ce soit en production.")
    if indet:
        print("\n  Recommandation : inscrire les dimensions réelles dans une étiquette")
        print("  HPGL de chaque patron, comme le font déjà les fichiers d'oreiller")
        print("  (« COUPE 67,9 X 52,1 CM »). Le fichier devient auto-vérifiable.")
    print()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Audit d'échelle de fichiers HPGL")
    ap.add_argument("cibles", nargs="+", help="fichiers .hpgl ou dossiers")
    ap.add_argument("--attendu", help="dimension réelle attendue, ex. 245x336 (mm)")
    a = ap.parse_args()

    attendu = None
    if a.attendu:
        m = re.match(r'(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+(?:[.,]\d+)?)', a.attendu)
        if not m: sys.exit("Format de --attendu invalide. Exemple : 245x336")
        attendu = (float(m.group(1).replace(",", ".")), float(m.group(2).replace(",", ".")))

    fichiers = []
    for c in a.cibles:
        if os.path.isdir(c):
            fichiers += sorted(glob.glob(os.path.join(c, "*.hpgl")) +
                               glob.glob(os.path.join(c, "*.plt")))
        else:
            fichiers.append(c)
    if not fichiers: sys.exit("Aucun fichier trouvé.")

    affiche([audit(f, attendu) for f in fichiers])
