#!/usr/bin/env python3
"""
Ré-extrait la répartition par variante du chiffrier « QUANTITÉS FINALES —
PLAN DE PRODUCTION 26-27 », en respectant sa hiérarchie.

La première extraction avait tout aplati sur une colonne. Trois formes
coexistent dans ce chiffrier, et les confondre fait compter deux fois :

  1. plat          | (vide) | Gris foncé | 36,7 | 1 285 |
  2. sous-total    | (vide) | → Homme (65%) | 65% | 98 |   ← un GROUPE,
                   | (vide) | S | 5,4% | 8 |                  pas une quantité
  3. deux axes     | Torsadé | Gris foncé | 19 | 342 |      ← col1 = groupe

Une ligne « → » et une ligne de groupe portent un sous-total : l'additionner
avec ses enfants double le produit. C'est exactement ce qui donnait 301 pour
150 sur le manteau hivernal.

La preuve que l'extraction est juste : la somme des feuilles doit égaler le
total du produit. Ce qui ne boucle pas est signalé, pas corrigé.
"""
import re, sys, unicodedata

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/plan.txt'
PLAN = sys.argv[2] if len(sys.argv) > 2 else 'mrp/donnees/plan-production-2627.tsv'

def nb(t):
    """« 1 285 » → 1285. Espaces fines, insécables et pourcentages écartés."""
    t = (t or '').replace(' ', '').replace(' ', '').replace(' ', '')
    t = t.replace('$', '').replace(',', '.')
    if not t or '%' in t:
        return None
    try:
        v = float(t)
    except ValueError:
        return None
    return int(round(v))

def pct(t):
    t = (t or '').replace(' ', '').replace(' ', '').replace(' ', '')
    t = t.replace('%', '').replace(',', '.')
    try:
        return float(t)
    except ValueError:
        return None

# Les produits du plan : la colonne 1 qui en porte un ouvre un nouveau produit.
produits = {}
with open(PLAN, encoding='utf-8') as f:
    entete = f.readline()
    for l in f:
        c = l.rstrip('\n').split('\t')
        if c and c[0]:
            produits[c[0].strip()] = nb(c[1])

# Les libellés d'axe ne sont pas des variantes.
AXES = {'taille', 'couleur', 'taille unique', 'coloris', 'grandeur', 'format', '—', ''}
def est_axe(t):
    return unicodedata.normalize('NFKD', (t or '').strip().lower()) \
        .encode('ascii', 'ignore').decode() in \
        {unicodedata.normalize('NFKD', a).encode('ascii','ignore').decode() for a in AXES}

lignes = []          # (produit, groupe, variante, pct, quantite)
courant = None       # produit en cours
vus = set()          # produits déjà rencontrés : borne le premier tableau
groupe = ''          # groupe en cours à l'intérieur du produit

for brut in open(SRC, encoding='utf-8'):
    if not brut.lstrip().startswith('|'):
        continue
    c = [x.strip() for x in brut.strip().strip('|').split('|')]
    if len(c) < 4:
        continue
    c1, c2, c3, c4 = c[0], c[1], c[2], c[3]

    if '[merged]' in c1:                      # bandeau de section
        continue

    if c1 in produits:                        # nouvelle fiche produit
        # Le document contient TROIS tableaux : le plan avec sa répartition,
        # puis deux autres feuilles qui reprennent les mêmes produits. Revoir
        # un produit déjà traité veut dire qu'on a quitté le bon tableau.
        if c1 in vus:
            break
        vus.add(c1)
        courant, groupe = c1, ''
        continue
    if not courant:
        continue

    if c2.startswith('→'):                    # groupe avec sous-total
        groupe = re.sub(r'\s*\(.*?\)\s*$', '', c2.lstrip('→ ')).strip()
        continue                              # le sous-total n'est PAS une feuille

    if c1:                                    # col1 non vide = groupe (deux axes)
        groupe = re.sub(r'\s*\(.*?\)\s*$', '', c1).strip()

    if est_axe(c2):
        continue
    q = nb(c4)
    if q is None or q <= 0:
        continue
    lignes.append((courant, groupe, c2, pct(c3), q))

# ------------------------------------------------------------------ contrôle
par_produit = {}
for p, g, v, r, q in lignes:
    par_produit.setdefault(p, []).append((g, v, r, q))

ecarts = []
for p, total in sorted(produits.items()):
    vs = par_produit.get(p, [])
    if not vs:
        continue
    somme = sum(q for _, _, _, q in vs)
    marque = '' if somme == total else f'   ← ÉCART {somme - total:+d}'
    print(f'{p:<42} {total:>6}  ·  {len(vs):>2} variantes = {somme:>6}{marque}')
    if somme != total:
        ecarts.append((p, total, somme))

print(f'\n{len(lignes)} variantes, {len(par_produit)} produits, {len(ecarts)} écart(s)')

with open('/tmp/variantes-v2.tsv', 'w', encoding='utf-8') as f:
    f.write('produit\tgroupe\tvariante\tratio_pct\tquantite\n')
    for p, g, v, r, q in lignes:
        f.write(f'{p}\t{g}\t{v}\t{"" if r is None else r}\t{q}\n')
print('→ /tmp/variantes-v2.tsv')
