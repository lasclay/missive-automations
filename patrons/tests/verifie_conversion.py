# -*- coding: utf-8 -*-
"""Vérifie que le HPGL produit est géométriquement exact."""
import re, sys, math
src = open(sys.argv[1] if len(sys.argv)>1 else "_test.plt").read()

# reconstruit les tracés par plume
plume, cur, traces = None, [], []
for instr in re.findall(r'(SP\d+|PU[-\d,]*|PD[-\d,]*);', src):
    if instr.startswith("SP"):
        if cur: traces.append((plume, cur)); cur = []
        plume = int(instr[2:])
    elif instr.startswith("PU"):
        if cur: traces.append((plume, cur)); cur = []
        nums = [int(x) for x in instr[2:].split(",") if x]
        if nums: cur = [(nums[0], nums[1])]
    elif instr.startswith("PD"):
        nums = [int(x) for x in instr[2:].split(",") if x]
        cur += list(zip(nums[0::2], nums[1::2]))
if cur: traces.append((plume, cur))

U = 40.0  # unités par mm
ok = True
def check(label, val, cible, tol):
    global ok
    bon = abs(val - cible) <= tol
    ok &= bon
    print(f"  [{'OK ' if bon else 'ÉCHEC'}] {label:<44} {val:.3f}  (cible {cible} ±{tol})")

print("\n  VÉRIFICATION GÉOMÉTRIQUE DU HPGL")
print("  " + "-"*70)
print(f"  Tracés reconstruits : {len(traces)}")

# 1. le carré de calibration : chercher un tracé carré
carres = []
for pl, pts in traces:
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    w, h = (max(xs)-min(xs))/U, (max(ys)-min(ys))/U
    if w > 20 and abs(w-h) < 0.5:
        carres.append((w, h, pl, len(pts)))
if carres:
    w, h, pl, n = carres[0]
    check("Carré de calibration — largeur (mm)", w, 100.0, 0.02)
    check("Carré de calibration — hauteur (mm)", h, 100.0, 0.02)
    print(f"         (plume SP{pl}, {n} points)")
else:
    print("  [ÉCHEC] aucun carré retrouvé dans le HPGL"); ok = False

# 2. plumes utilisées
plumes = sorted({pl for pl, _ in traces})
check("Nombre de plumes distinctes", len(plumes), 3, 0)
print(f"         plumes = {plumes}")

# 3. courbes aplaties : le contour doit avoir beaucoup de points
gros = max(traces, key=lambda t: len(t[1]))
print(f"  [INFO ] Tracé le plus dense : {len(gros[1])} points (contour aplati)")
if len(gros[1]) < 20:
    print("  [ÉCHEC] aplatissement des Béziers insuffisant"); ok = False

# 4. origine en bas à gauche : aucune coordonnée négative
mini = min(min(min(p[0] for p in pts), min(p[1] for p in pts)) for _, pts in traces)
check("Coordonnée minimale (doit être >= 0)", mini, max(mini,0), abs(mini)+0.001 if mini>=0 else 0)

# 5. le carré est bien en bas à gauche (y faible) => l'axe a été inversé
if carres:
    for pl, pts in traces:
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        if (max(xs)-min(xs))/U > 20 and abs((max(xs)-min(xs))-(max(ys)-min(ys)))/U < 0.5:
            y_bas = min(ys)/U
            # dans le PDF le carré est à 15 mm du HAUT ; après inversion il doit
            # se retrouver à (260 - 15 - 96) = 149 mm du bas, x échelle 1.041667
            attendu = (260 - 15 - 96) * 1.0416667
            check("Inversion de l'axe Y (carré, mm depuis le bas)", y_bas, attendu, 0.1)
            break

print("  " + "-"*70)
print(f"  RÉSULTAT : {'TOUT EST CONFORME' if ok else 'ANOMALIES DÉTECTÉES'}\n")
sys.exit(0 if ok else 1)
