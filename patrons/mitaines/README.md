# Charte des cotes des mitaines adultes

`mrp/public/schema-cotes-mitaines.webp`, l'image des points « Cotes hors-tout et
incréments de gradation » des mitaines plein air, polar, laine et cuir, se tire d'ici.

## Source

Les DXF Lectra (AAMA, métrique, 2022) du Drive :
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
coud sur P3 de n3 à n4 (fourche), puis n5 (bout du pouce), puis n0. Les cotes 3 et 4 se lisent donc
sur P3, entre ces crans.

La cote 5 (coin inférieur → bout du pouce) n'a **pas** de théorique. À plat, le pouce s'écarte vers le
bord, alors que P3 étalé le mettrait au milieu de la paume : 246 mm si P3 était à plat, environ 206 mm
sur la photo de la boutique. Elle se mesure sur la pièce étalon ; la grille l'affiche sans la juger.

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
