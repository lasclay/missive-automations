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

## Ce qui se calcule, et ce qui ne se calcule pas

Toutes les cotes sont prises sur la **ligne de couture** (calque 14), donc sans valeur de couture.

| Cote | Tirée de |
| --- | --- |
| 1 Largeur hors tout | largeur max de P1 |
| 2 Hauteur hors tout | longueur de P1, bout → bas de manchette |
| 6 Poignet, élastique étiré | largeur de P1 à la ligne des crans du poignet |
| 7 Bas de manchette | largeur de P1 au bas |
| 8 Diamètre de la manchette | 2 × cote 7 ÷ π |

Le patron n'a **pas** de rétrécissement au poignet : ce sont l'élastique et la manchette qui le
font. Au repos, la largeur du poignet dépend de la longueur de l'élastique, qui n'est pas dans le
DXF.

**Les cotes du pouce (3, 4 et 5) ne sont pas calculées.** Le pouce prend sa forme en volume, au
montage de P3 et P4. L'appariement des crans que j'ai essayé ne fermait pas : la courbe de P3 fait
84 mm et l'échancrure de P2 110 mm. Ces cotes se relèvent donc sur la première pièce validée de
chaque taille. On peut les chiffrer à partir de la gamme de montage
(`2021 LASCLAY MITAINES GAMME DE MONTAGE.docx`, même dossier du Drive), si elle dit quelle couture
va où.

## Regénérer

```
pip install ezdxf
python3 cotes.py     # écrit cotes.json
python3 charte.py    # écrit charte.svg ; rendu PNG par Chromium, puis WebP sans perte
```
