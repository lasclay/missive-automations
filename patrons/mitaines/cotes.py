"""Cotes des patrons de mitaines, sur la LIGNE DE COUTURE, taille par taille.

Écrit les lignes `couture_mm` de mrp/donnees/cotes-patrons.tsv (num, taille, valeur).
Les DXF Lectra (SHELL_LEFT_<taille>.DXF) doivent être dans ce dossier.

Numérotation du 26/09/2026, redéfinie par la direction sur photos de l'atelier :

  1 largeur        largeur max de P1 (le dos)
  2 hauteur        longueur de P1, bout des doigts -> bas de manchette
  3 pouce -> bas   bout du pouce -> bas de la mitaine, le long de la couture du
                   côté pouce. Pas de valeur : le pouce pivote au montage, et la
                   pièce à plat ne dit pas où tombe son bout (voir README)
  4 base pouce     largeur du pouce à la jonction avec la main : P3, largeur du
                   lobe perpendiculaire à son axe, à 15 % de la base (milieu des
                   crans n4-n0) vers le bout n5
  5 haut pouce     largeur du pouce à 10 mm sous le bout, même méthode
  6 poignet        largeur de P1 à la ligne des crans du poignet
  7 manchette      largeur de P1 au bas
  8 diamètre       ouverture arrondie en cercle : 2 x cote 7 / pi

Les anciennes cotes 3 (fourche -> bout), 4 (largeur à mi-longueur) et 5 (coin
inférieur -> bout) ne sont plus relevées.

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
    a_ = lambda u: (base[0]+ax[0]*u, base[1]+ax[1]*u)
    v = {1: max(width_at(p1, x0+(x1-x0)*i/100) for i in range(5, 99)), 2: x1-x0,
         3: None, 4: largeur_perp(p3, a_(0.15*L), ax), 5: largeur_perp(p3, a_(L-10), ax),
         6: width_at(p1, poignet), 7: wc, 8: 2*wc/math.pi}
    for k in range(1, 9):
        print(f'{k}\t{s}\t{"" if v[k] is None else round(v[k], 1)}')
