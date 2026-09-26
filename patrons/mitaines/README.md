# Charte des cotes des mitaines adultes

`mrp/public/schema-cotes-mitaines.webp`, l'image des points « Cotes hors-tout et
incréments de gradation » des mitaines plein air, polar, laine et cuir, se tire d'ici.

## Source

Les DXF Lectra (AAMA, métrique, 2022) du Drive (fichiers du 20/10/2022, `SHELL_LEFT_<taille>.DXF`) :
`POUR L LESSARD - MITAINES ASCLEPIADE - LASCLAY / Modele Plein air / Patrons DXF / 1. Xsmall … 5. XLarge`,
fichiers `SHELL_LEFT_<taille>.DXF`. Ils ne sont pas versionnés ici. Pour regénérer la charte, déposer
les cinq fichiers dans ce dossier.

Les pièces P3.1 à P3.4 correspondent aux patrons P1 à P4 des images « ID patrons mitaines plein air » :
- P1 : le dos entier ;
- P2 : le haut de la paume, avec l'échancrure du pouce ;
- P3 : le bas de la paume et le dessous du pouce ;
- P4 : le dessus du pouce.

Les pièces SLOPPER n'ont pas de catégorie : ce sont des blocs de base, pas des pièces coupées.

## De la cote de patron à la cote finie

Les cotes du patron sont prises sur la **ligne de couture** (calque 14) : la valeur de couture
(6,3 mm tout autour, 26 mm à l'ourlet de manchette) est déjà retirée. `cotes.py` les calcule et
elles vivent dans `mrp/donnees/cotes-patrons.tsv`.

La cote **finie** retire en plus l'arrondi des bords sur l'épaisseur à plat :

    finie = couture − bords × (π/2 − 1) × épaisseur / 2

Une largeur traverse deux bords, une longueur fermée d'un seul bout n'en traverse qu'un. Le calcul
est fait par `mrp/import_cotes.js`, avec l'épaisseur de chaque produit : corps, pouce et manchette,
dans `mrp/donnees/cotes-produits.tsv`. Ces épaisseurs sont **supposées** tant que personne ne les a
mesurées sur une vraie pièce ; la grille le dit.

## Le pouce

Les crans de P4 donnent son assemblage : son bord pointe → n0 → n1 → n2 (84 + 66 + 46 mm en M) se
coud sur P3 de n3 à n4, puis n5 (bout du pouce), puis n0.

**Numérotation du 26/09/2026**, redéfinie par la direction sur photos de l'atelier. Les anciennes
3 (fourche → bout), 4 (largeur à mi-longueur) et 5 (coin inférieur → bout) sont remplacées :

- **3** — bout du pouce → bas de la mitaine, le long de la couture côté pouce. **Pas de
  théorique** : le pouce pivote au montage, et la pièce à plat ne dit pas où tombe son bout (P3
  étalée donnerait 298 mm en M le long de la couture, le dessin fini ~200 mm). Elle se mesure sur
  la pièce étalon ; la grille l'affiche sans la juger.
- **4** — largeur du pouce à la jonction avec la main : P3, largeur du lobe perpendiculaire à son
  axe, à 15 % de la base (milieu des crans n4-n0) vers le bout n5.
- **5** — largeur du haut du pouce, à 10 mm sous le bout, même méthode.
- **8** — l'ouverture arrondie en cercle presque parfait, puis son diamètre : 2 × cote 7 / π.

Les cotes 3, 4 et 5 ensemble disent l'angle et la forme du pouce. Les mesures saisies avant le
changement sont renumérotées 103, 104, 105 par `import_cotes.js` : gardées, hors de la grille.

## Le dessin

`dessin.py` trace la mitaine finie, côté paume, en M à l'échelle : pouce couché le long du bord,
empiècement de cuir, élastique du poignet, manchette. Il donne l'image du point
(`mrp/public/schema-cotes-mitaines.webp`) et les panneaux 1 et 2 de la planche `cotes_mitaine`.
Ces deux panneaux sont marqués EXACT dans `planches-prompts.tsv` : le générateur IA ne les touche pas.

## Regénérer

```
pip install ezdxf
python3 cotes.py      # lignes num / taille / couture_mm pour cotes-patrons.tsv
python3 dessin.py     # finie.svg ; rendu PNG par Chromium, puis WebP sans perte
```
