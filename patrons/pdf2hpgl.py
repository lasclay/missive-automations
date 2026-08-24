#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pdf2hpgl.py — Convertit un PDF de patron VECTORIEL en HPGL (.plt).

Ne fonctionne que si diag_pdf.py annonce « VECTORIEL » ou « MIXTE ».
Un PDF raster (scanné) doit d'abord être vectorisé — ce n'est pas le rôle
de cet outil.

Principe
    PDF (points, origine en haut à gauche, y vers le bas)
      → mm
      → unités traceur HPGL (1 unité = 0,025 mm, soit 40 u/mm)
      → origine en bas à gauche, y vers le haut

L'échelle est le seul point qui compte vraiment. Deux garde-fous :
    --carre N     le patron contient un carré de calibration de N mm ;
                  le facteur d'échelle est recalculé pour qu'il sorte exact
    --echelle F   correction manuelle (1.0 = aucune)
Après conversion, l'outil écrit AUSSI un SVG de contrôle à la même échelle :
imprimer ce SVG à 100 %, mesurer le carré, valider avant de plotter.

Usage
    python3 pdf2hpgl.py patron.pdf                     # conversion directe
    python3 pdf2hpgl.py patron.pdf --carre 100         # calibré sur carré 100 mm
    python3 pdf2hpgl.py patron.pdf --plumes "#000000=1,#ff0000=2,#0000ff=3"
    python3 pdf2hpgl.py patron.pdf --page 1 -o sortie.plt
"""
import sys, os, math, argparse
from collections import OrderedDict

try:
    import pymupdf
except ImportError:
    import fitz as pymupdf

PT2MM = 25.4 / 72.0
UNITES_PAR_MM = 40.0          # HP-GL standard : 1 unité = 0,025 mm
TOL_BEZIER_MM = 0.10          # écart max toléré lors de l'aplatissement des courbes


# ---------------------------------------------------------------- géométrie
def bezier(p0, p1, p2, p3, tol_pt):
    """Aplatit une Bézier cubique en polyligne, par subdivision adaptative."""
    def plat(a, b, c, d):
        # distance des points de contrôle à la corde
        dx, dy = d.x - a.x, d.y - a.y
        n = math.hypot(dx, dy)
        if n < 1e-9:
            return (math.hypot(b.x - a.x, b.y - a.y) < tol_pt and
                    math.hypot(c.x - a.x, c.y - a.y) < tol_pt)
        d1 = abs((b.x - a.x) * dy - (b.y - a.y) * dx) / n
        d2 = abs((c.x - a.x) * dy - (c.y - a.y) * dx) / n
        return max(d1, d2) < tol_pt

    pts, pile = [p0], [(p0, p1, p2, p3, 0)]
    sortie = []
    while pile:
        a, b, c, d, prof = pile.pop()
        if prof > 16 or plat(a, b, c, d):
            sortie.append((a, d, prof))
            continue
        # subdivision de De Casteljau
        M = pymupdf.Point
        ab, bc, cd = M((a.x+b.x)/2,(a.y+b.y)/2), M((b.x+c.x)/2,(b.y+c.y)/2), M((c.x+d.x)/2,(c.y+d.y)/2)
        abc, bcd = M((ab.x+bc.x)/2,(ab.y+bc.y)/2), M((bc.x+cd.x)/2,(bc.y+cd.y)/2)
        m = M((abc.x+bcd.x)/2,(abc.y+bcd.y)/2)
        pile.append((m, bcd, cd, d, prof+1))
        pile.append((a, ab, abc, m, prof+1))
    # les segments ont été empilés dans l'ordre : on reconstruit
    res = [p0]
    for a, d, _ in sortie:
        res.append(d)
    return res


def hexcol(c):
    if c is None: return "#000000"
    if isinstance(c, (int, float)):
        v = int(round(c * 255)); return "#%02x%02x%02x" % (v, v, v)
    try:
        return "#%02x%02x%02x" % tuple(int(round(x * 255)) for x in c[:3])
    except Exception:
        return "#000000"


def polylignes_de_page(page, tol_pt):
    """Retourne [(couleur_hex, [Point,...]), ...] en coordonnées PDF (points)."""
    out = []
    for d in page.get_drawings():
        coul = hexcol(d.get("color") if d.get("color") is not None else d.get("fill"))
        courante = []
        for it in d["items"]:
            k = it[0]
            if k == "l":
                _, p1, p2 = it
                if not courante: courante = [p1]
                elif (abs(courante[-1].x-p1.x) > 1e-6 or abs(courante[-1].y-p1.y) > 1e-6):
                    out.append((coul, courante)); courante = [p1]
                courante.append(p2)
            elif k == "c":
                _, p1, p2, p3, p4 = it
                pts = bezier(p1, p2, p3, p4, tol_pt)
                if not courante: courante = [pts[0]]
                elif (abs(courante[-1].x-pts[0].x) > 1e-6 or abs(courante[-1].y-pts[0].y) > 1e-6):
                    out.append((coul, courante)); courante = [pts[0]]
                courante.extend(pts[1:])
            elif k == "re":
                r = it[1]
                if courante: out.append((coul, courante)); courante = []
                P = pymupdf.Point
                out.append((coul, [P(r.x0,r.y0), P(r.x1,r.y0), P(r.x1,r.y1),
                                   P(r.x0,r.y1), P(r.x0,r.y0)]))
            elif k == "qu":
                q = it[1]
                if courante: out.append((coul, courante)); courante = []
                out.append((coul, [q.ul, q.ur, q.lr, q.ll, q.ul]))
        if courante and len(courante) > 1:
            out.append((coul, courante))
    return [(c, p) for c, p in out if len(p) > 1]


def detecte_carre(polys, cible_mm, tol_pct=15.0):
    """Cherche une polyligne fermée quasi carrée de côté proche de cible_mm.

    La tolérance est RELATIVE : un export mal échelonné produit justement un
    carré qui s'écarte de plusieurs millimètres de sa valeur nominale — c'est
    le cas qu'on cherche à rattraper, pas à rejeter.
    Retourne (cote_mesuree_mm, [tous_les_candidats]) ou (None, [...]).
    """
    marge = cible_mm * tol_pct / 100.0
    best, candidats = None, []
    for _, pts in polys:
        xs = [p.x for p in pts]; ys = [p.y for p in pts]
        w = (max(xs) - min(xs)) * PT2MM
        h = (max(ys) - min(ys)) * PT2MM
        if w < 5 or h < 5: continue
        if abs(w - h) > max(0.5, 0.02 * w): continue      # doit être carré
        cote = (w + h) / 2
        candidats.append(round(cote, 2))
        if abs(cote - cible_mm) <= marge:
            if best is None or abs(cote - cible_mm) < abs(best - cible_mm):
                best = cote
    return best, sorted(set(candidats))


# ---------------------------------------------------------------- sorties
def ecrit_hpgl(chemin, polys, hauteur_pt, echelle, plumes, defaut=1):
    """polys en points PDF → fichier HPGL."""
    def conv(p):
        x_mm = p.x * PT2MM * echelle
        y_mm = (hauteur_pt - p.y) * PT2MM * echelle     # origine en bas à gauche
        return int(round(x_mm * UNITES_PAR_MM)), int(round(y_mm * UNITES_PAR_MM))

    # regroupe par plume pour limiter les changements d'outil
    par_plume = OrderedDict()
    for coul, pts in polys:
        par_plume.setdefault(plumes.get(coul.lower(), defaut), []).append(pts)

    buf = ["IN;", "SC;"]                       # init, pas de mise à l'échelle logicielle
    for plume in sorted(par_plume):
        buf.append("SP%d;" % plume)
        for pts in par_plume[plume]:
            x, y = conv(pts[0])
            buf.append("PU%d,%d;" % (x, y))
            coords = []
            for p in pts[1:]:
                x, y = conv(p)
                coords.append("%d,%d" % (x, y))
            # découpe en instructions de longueur raisonnable
            while coords:
                bloc, coords = coords[:200], coords[200:]
                buf.append("PD" + ",".join(bloc) + ";")
    buf += ["PU;", "SP0;"]
    with open(chemin, "w", encoding="ascii") as f:
        f.write("\n".join(buf) + "\n")
    return sum(len(v) for v in par_plume.values()), par_plume


def ecrit_svg_controle(chemin, polys, largeur_pt, hauteur_pt, echelle):
    """SVG à l'échelle réelle, en millimètres — pour impression de contrôle."""
    W = largeur_pt * PT2MM * echelle
    H = hauteur_pt * PT2MM * echelle
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.2f}mm" '
             f'height="{H:.2f}mm" viewBox="0 0 {W:.3f} {H:.3f}">',
             '<rect width="100%" height="100%" fill="#fff"/>']
    for coul, pts in polys:
        d = "M " + " L ".join(f"{p.x*PT2MM*echelle:.3f},{p.y*PT2MM*echelle:.3f}" for p in pts)
        parts.append(f'<path d="{d}" fill="none" stroke="{coul}" stroke-width="0.2"/>')
    parts.append('</svg>')
    open(chemin, "w", encoding="utf-8").write("\n".join(parts))
    return W, H


# ---------------------------------------------------------------- principal
def main():
    ap = argparse.ArgumentParser(description="PDF de patron vectoriel → HPGL (.plt)")
    ap.add_argument("pdf")
    ap.add_argument("-o", "--sortie", help="fichier .plt (défaut : à côté du PDF)")
    ap.add_argument("--page", type=int, default=1, help="page à convertir (défaut 1)")
    ap.add_argument("--carre", type=float,
                    help="côté en mm du carré de calibration présent sur le patron")
    ap.add_argument("--tol-carre", type=float, default=15.0, dest="tol_carre",
                    help="tolérance de détection du carré, en %% (défaut 15)")
    ap.add_argument("--echelle", type=float, default=1.0,
                    help="correction manuelle d'échelle (défaut 1.0)")
    ap.add_argument("--plumes", default="",
                    help='affectation couleur→plume, ex. "#000000=1,#ff0000=2"')
    ap.add_argument("--tolerance", type=float, default=TOL_BEZIER_MM,
                    help="écart max d'aplatissement des courbes, en mm (défaut 0.10)")
    a = ap.parse_args()

    plumes = {}
    for pair in filter(None, a.plumes.split(",")):
        c, _, n = pair.partition("=")
        plumes[c.strip().lower()] = int(n)

    doc = pymupdf.open(a.pdf)
    if a.page < 1 or a.page > len(doc):
        sys.exit(f"Page {a.page} inexistante ({len(doc)} page(s)).")
    page = doc[a.page - 1]
    tol_pt = a.tolerance / PT2MM

    polys = polylignes_de_page(page, tol_pt)
    if not polys:
        sys.exit("Aucune géométrie vectorielle sur cette page.\n"
                 "→ Lancer diag_pdf.py : le PDF est probablement raster.")

    echelle = a.echelle
    mesure, candidats = None, []
    if a.carre:
        mesure, candidats = detecte_carre(polys, a.carre, a.tol_carre)
        if mesure:
            echelle = a.carre / mesure
        else:
            print(f"\n  ! Aucun carré proche de {a.carre} mm (±{a.tol_carre:.0f} %).",
                  file=sys.stderr)
            if candidats:
                apercu = ", ".join(f"{c} mm" for c in candidats[:12])
                print(f"    Carrés détectés dans le fichier : {apercu}", file=sys.stderr)
                print(f"    → relancer avec --carre <la bonne valeur> "
                      f"ou --tol-carre plus large.", file=sys.stderr)
            else:
                print("    Aucune forme carrée trouvée : calibrer avec --echelle "
                      "sur une cote connue.", file=sys.stderr)
            print(f"    Échelle laissée à {echelle}.\n", file=sys.stderr)

    base = a.sortie or os.path.splitext(a.pdf)[0] + ".plt"
    svg = os.path.splitext(base)[0] + "_controle.svg"

    n, par_plume = ecrit_hpgl(base, polys, page.rect.height, echelle, plumes)
    W, H = ecrit_svg_controle(svg, polys, page.rect.width, page.rect.height, echelle)

    xs = [p.x for _, pts in polys for p in pts]
    ys = [p.y for _, pts in polys for p in pts]
    bw = (max(xs) - min(xs)) * PT2MM * echelle
    bh = (max(ys) - min(ys)) * PT2MM * echelle

    print(f"\n  Source .......... {a.pdf}  (page {a.page})")
    print(f"  Polylignes ...... {n}")
    if a.carre:
        if mesure:
            print(f"  Calibration ..... carré mesuré {mesure:.2f} mm → cible {a.carre} mm")
            print(f"                    facteur d'échelle {echelle:.6f}")
        else:
            print(f"  Calibration ..... ÉCHEC — vérifier manuellement")
    else:
        print(f"  Échelle ......... {echelle:.6f} (aucune calibration demandée)")
    print(f"  Emprise dessin .. {bw:.1f} × {bh:.1f} mm")
    print(f"  Page en sortie .. {W:.1f} × {H:.1f} mm")
    print(f"  Plumes .......... " + ", ".join(f"SP{k} ({len(v)} tracés)"
                                              for k, v in sorted(par_plume.items())))
    print(f"\n  → HPGL ......... {base}")
    print(f"  → Contrôle ..... {svg}")
    print("\n  VÉRIFIER AVANT DE PLOTTER : imprimer le SVG à 100 % (sans « ajuster")
    print("  à la page ») et mesurer le carré de calibration à la règle.\n")
    doc.close()

if __name__ == "__main__":
    main()
