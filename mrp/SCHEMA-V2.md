# Schéma v0.1 — ce qu'il faut en prendre, et ce qu'il faut en changer

Lecture de `mrp_schema.sql` (PostgreSQL, 20 tables, dérivé de la même charte
Miro que `donnees/charte-produits.tsv`) confrontée à ce que l'application fait
aujourd'hui.

**Le modèle est bon. Le moteur ne l'est pas.** Ces deux jugements sont
indépendants et c'est ce qui rend la suite simple : on adopte le premier, on
laisse le second.

---

## 1. Ce que ce schéma dit de vrai sur l'application actuelle

Elle n'est pas encore un MRP. C'est un **suivi de production** : elle sait ce
qu'il y a à fabriquer, qui l'avance, ce qu'il faut vérifier et ce qui a cassé.
Elle ne sait pas ce qu'il faut **acheter**, ni quand.

Il manque exactement les quatre tables qui font le M de MRP :

| Ce qui manque | Ce qu'on ne peut pas répondre aujourd'hui |
| --- | --- |
| `item` (matières, composants) | « combien de mètres de shell pour l'hiver ? » |
| `nomenclature` | « le plan consomme quoi, en quelle quantité ? » |
| `stock` / `mouvement_stock` | « qu'est-ce qu'on a déjà en Tunisie ? » |
| `demande` + `ordre_planifie` | « quand faut-il passer la commande de coton ? » |

Aujourd'hui `produit_materiaux` est une liste de **phrases** — 50 lignes de
`nom` + `detail` en texte libre. On peut la lire, pas la multiplier par 24 333.

## 2. Les quatre bonnes idées, à garder telles quelles

1. **Tout est un `item`.** Matière, composant, étiquette, semi-fini, produit
   fini : une seule table. C'est ce qui rend la nomenclature multi-niveaux
   possible sans table spéciale, et c'est ce qui permet à l'oreiller d'avoir une
   housse cousue en Tunisie comme semi-fini et un produit fini rembourré au
   Canada.

2. **Le scope taille/couleur sur la ligne de nomenclature.** C'est la meilleure
   idée du fichier, et elle vient directement de la charte. Deux usages, et les
   deux sont réels ici :
   - *substitution* — le vert est en coton 12 oz, les autres couleurs en 10 oz.
     Constaté sur le sac à lunch, la besace, le tote bag et la glacière : c'est
     une règle, pas un cas.
   - *quantité par taille* — un XL ne consomme pas ce que consomme un M.
     Sans ça, un besoin matière calculé sur un plan de 24 333 unités est faux
     de plusieurs pour cent.

3. **`operation.site_id`.** Le site est porté par l'opération, pas par le
   produit. C'est ce que dit la charte de l'oreiller — *« le rembourrage se
   fera au Canada »* — et aujourd'hui cette phrase est une note qu'aucun calcul
   ne lit.

4. **Le patron est une entité partagée.** La charte l'écrit trois fois :
   *« **Patron mitaine polar »* sur la mitaine de laine, la mitaine de cuir et
   la mitaine polar. Aujourd'hui `produit_patrons` est une table par produit :
   le même patron y serait recopié trois fois, et corrigé une seule.

## 3. Ce qu'il ne faut PAS prendre

**`point_controle` est une régression.** Le fichier propose
`libelle` + `criticite` + `ordre`. Ce qui existe déjà fait plus :

| `qc_points` aujourd'hui | `point_controle` proposé |
| --- | --- |
| cote, tolérance, unité | — |
| règle d'échantillonnage (`ech_type`, `ech_valeur`) | — |
| portée par variante | — |
| schéma de cote (`schema_url`) | — |
| conséquence (« sinon l'isolant fond ») | — |
| protocole général (`produit_id IS NULL`) | — |
| lien vers les bris de terrain (`qc_bris.point_id`) | — |

À reprendre du fichier : rien, sauf éventuellement `criticite` si on veut trois
niveaux plutôt que le blocage binaire actuel. À reprendre de l'existant : tout.

**`variante` n'est pas `item_variantes`.** Le fichier décrit le **catalogue**
des variantes vendables (produit × taille × couleur). `item_variantes`, ici,
décrit la **répartition d'un lot** — 133 lignes accrochées à `ordre_items`.
Ce sont deux objets différents et il faut les deux, pas l'un à la place de
l'autre.

## 4. PostgreSQL : non, et voici pourquoi

L'application tourne sur `node:sqlite`, **zéro dépendance npm**, un fichier sur
un disque persistant Render de 1 Go. Passer à PostgreSQL, c'est :

- une dépendance npm (pilote `pg`) dans un projet qui n'en a aucune ;
- un service Render de plus, payant, avec sa propre panne possible ;
- aucun gain mesurable à cette échelle : 34 produits, une trentaine de milliers
  d'unités, deux à cinq personnes connectées. SQLite tient ça sans transpirer.

Le seul argument technique du fichier est `jsonb` + index GIN sur
`item.attributs`. On n'a pas de requête qui le justifie : les attributs sont
lus par item, jamais cherchés en travers.

**Le modèle, lui, se traduit intégralement.** Rien dans ce schéma n'exige
PostgreSQL :

| PostgreSQL | SQLite |
| --- | --- |
| `serial` | `INTEGER PRIMARY KEY` |
| `uuid-ossp` | inutilisé dans le fichier — à retirer |
| `jsonb` + GIN | `TEXT` + `CHECK (json_valid(x))`, lu par `json_extract` |
| `timestamptz` | `TEXT` + `datetime('now')` — déjà la convention ici |
| `numeric(12,4)` | `REAL`, ou un entier dans la plus petite unité |
| `DISTINCT ON` | `ROW_NUMBER() OVER (PARTITION BY … ORDER BY …) = 1` |
| `CREATE INDEX ON t (c)` | l'index doit être nommé |

La vue `v_nomenclature_resolue` — « la ligne la plus spécifique gagne, par
rôle » — se réécrit en une CTE avec `ROW_NUMBER()`. C'est la seule vraie
traduction à faire, et elle tient en quinze lignes.

## 5. L'ordre dans lequel le faire

Quatre étapes, chacune livrable et utile seule. Aucune ne casse ce qui tourne.

**Étape 1 — référentiels et items.**
`uom`, `couleur`, `echelle_taille`, `taille`, `patron`, `item`, `variante`.
Alimentées depuis ce qui existe déjà : `donnees/shopify-variantes.tsv` pour le
catalogue, `donnees/fournisseurs.tsv` pour les matières.
*Gain immédiat :* le catalogue des variantes vendables cesse d'être déduit des
lots. Le patron partagé cesse d'être recopié.

**Étape 2 — nomenclature.**
`nomenclature`, `nomenclature_ligne` avec les deux scopes, la vue résolue.
Alimentée par relecture de `charte` : 196 lignes de phrases deviennent des
lignes chiffrées. **C'est l'étape qui demande du travail humain** — les
quantités par taille n'existent nulle part aujourd'hui, il faut les mesurer ou
les estimer.
*Gain immédiat :* le besoin matière du plan 26-27, par matière et par couleur.

**Étape 3 — gammes.**
`gamme`, `operation` avec `site_id` et `parametres`.
Absorbe `charte.parametre` (presse 170 °C / 45 s) et la note « rembourrage au
Canada ». Absorbe surtout `charge.js`, où les temps unitaires vivent
aujourd'hui en constantes et en fichiers TSV séparés.
*Gain immédiat :* la cédule cesse de dépendre d'un périmètre choisi à la main.

**Étape 4 — le MRP proprement dit.**
`stock`, `mouvement_stock`, `demande`, `calcul_mrp`, `ordre_planifie`.
*Gain :* la question qu'on ne peut pas poser aujourd'hui — quoi acheter, quand.

## 6. Ce qu'il manque au fichier

- **Aucune trace des bris.** `qc_bris`, ses photos et son lien vers le point de
  contrôle n'ont pas d'équivalent. C'est la moitié du contrôle qualité tel
  qu'il est construit ici, et c'est celle qui vient du terrain.
- **Aucune trace de l'avancement.** `ordre_items.avancement`,
  `avancement_historique`, les jalons : le fichier planifie, il ne suit pas.
- **`site` ne dit pas le sous-traitant.** BMB Textile et Grada Mode sont deux
  ateliers distincts en Tunisie ; `site.type = 'sous_traitant'` ne suffira pas
  à répartir un lot entre eux.
- **Pas de devise sur `operation`.** Le prix d'assemblage BMB est en dollars par
  unité et c'est ce qui pilote la moitié du calcul de charge.
