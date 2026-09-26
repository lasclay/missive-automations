"""Cotes des patrons de mitaines, sur la LIGNE DE COUTURE, taille par taille.

Écrit les lignes `couture_mm` de mrp/donnees/cotes-patrons.tsv (num, taille, valeur).
Les DXF Lectra (SHELL_LEFT_<taille>.DXF) doivent être dans ce dossier.

  1 largeur        largeur max de P1 (le dos)
  2 hauteur        longueur de P1, bout des doigts -> bas de manchette
  3 pouce          P3, cran n4 (fourche) -> cran n5 (bout du pouce)
  4 largeur pouce  P3, largeur du lobe à mi-chemin entre le milieu de la base
                   (crans n4 et n0) et le bout n5, perpendiculaire à cet axe
  5 coin -> bout   pas de valeur : le pouce s'écarte au montage (voir README)
  6 poignet        largeur de P1 à la ligne des crans du poignet
  7 manchette      largeur de P1 au bas
  8 diamètre       2 x cote 7 / pi

Les crans de P4 confirment l'assemblage du pouce : P4 n0->n1 (66 mm en M) = P3 n4->n5,
P4 n1->n2 (46) = P3 n5->n0, P4 pointe->n0 (84) = P3 n3->n4.
"""
import math, sys
from dxf import pieces, width_at

def d(a, b): return math.hypot(a[0]-b[0], a[1]-b[1])
def near(poly, p): return min(poly, key=lambda q: d(q, p))
def largeur_perp(poly, c, ax):
    nx = (-ax[1], ax[0]); pos, neg = [], []; n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i+1) % n]
        ta = (a[0]-c[0])*ax[0]+(a[1]-c[1])*ax[1]; tb = (b[0]-c[0])*ax[0]+(b[1]-c[1])*ax[1]
        if ta*tb <= 0 and ta != tb:
            f = ta/(ta-tb); q = (a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f)
            v = (q[0]-c[0])*nx[0]+(q[1]-c[1])*nx[1]; (pos if v >= 0 else neg).append(v)
    return min(pos)-max(neg) if pos and neg else 0

for s in ['XS', 'S', 'M', 'L', 'XL']:
    P = pieces(f'SHELL_LEFT_{s}.DXF')
    p1, p3, N = P['P3.1']['sew'], P['P3.3']['sew'], P['P3.3']['notch']
    xs = [p[0] for p in p1]; x0, x1 = min(xs), max(xs)
    poignet = max(n[0] for n in P['P3.1']['notch'])
    f, t, b = near(p3, N[4]), near(p3, N[5]), near(p3, N[0])
    base = ((f[0]+b[0])/2, (f[1]+b[1])/2); L = d(base, t)
    ax = ((t[0]-base[0])/L, (t[1]-base[1])/L); mil = ((base[0]+t[0])/2, (base[1]+t[1])/2)
    wc = width_at(p1, x1-2)
    v = {1: max(width_at(p1, x0+(x1-x0)*i/100) for i in range(5, 99)), 2: x1-x0,
         3: d(f, t), 4: largeur_perp(p3, mil, ax), 5: None,
         6: width_at(p1, poignet), 7: wc, 8: 2*wc/math.pi}
    for k in range(1, 9):
        print(f'{k}\t{s}\t{"" if v[k] is None else round(v[k], 1)}')
