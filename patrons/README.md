# Patrons — diagnostic et conversion PDF → HPGL

Outils pour récupérer les patrons Lasclay archivés en PDF et les rendre
exploitables par les patronnistes qui travaillent en HPGL, **sans les redessiner
de zéro**.

## Installation

```
python3 -m pip install pymupdf
```

Aucune autre dépendance.

## 1. Diagnostiquer avant de convertir

```
python3 diag_pdf.py mon_patron.pdf
```

Répond aux seules questions qui déterminent la faisabilité :

| Question | Pourquoi c'est décisif |
| --- | --- |
| **Vectoriel ou raster ?** | Un PDF vectoriel se convertit sans perte. Un PDF scanné ou aplati en image doit être vectorisé — résultat approximatif, retouche manuelle obligatoire. Ce n'est plus une conversion, c'est un redessin assisté. |
| **Une grande page ou des tuiles ?** | Un PDF tuilé en A4 doit être réassemblé avant conversion. |
| **Y a-t-il un carré de calibration ?** | C'est la seule façon de garantir que le patron sort à la bonne taille. |
| **Combien de couleurs de trait ?** | Chaque couleur devient une plume HPGL : contour, crans, droit-fil, texte. |
| **Quelle emprise réelle ?** | Pour vérifier la cohérence avec le patron papier. |

## 2. Convertir

```
python3 pdf2hpgl.py mon_patron.pdf --carre 100 \
        --plumes "#000000=1,#ff0000=2,#0000ff=3"
```

Produit deux fichiers :

- `mon_patron.plt` — le HPGL
- `mon_patron_controle.svg` — **contrôle à l'échelle réelle**

### L'échelle est le seul point qui compte

Un patron sorti à 96 % est un patron inutilisable. Deux garde-fous :

- `--carre N` — le patron contient un carré de calibration de N mm ; le facteur
  d'échelle est recalculé pour qu'il sorte exact. La tolérance de détection est
  **relative** (15 % par défaut) : un export mal échelonné s'écarte justement de
  plusieurs millimètres, c'est le cas à rattraper, pas à rejeter.
- `--echelle F` — correction manuelle si aucun carré n'est présent.

**Avant de plotter :** imprimer le SVG de contrôle à 100 % (sans « ajuster à la
page ») et mesurer le carré à la règle.

### Options

| Option | Effet |
| --- | --- |
| `--page N` | page à convertir (défaut 1) |
| `--carre N` | calibration sur un carré de N mm |
| `--tol-carre P` | tolérance de détection, en % (défaut 15) |
| `--echelle F` | correction manuelle (défaut 1.0) |
| `--plumes "..."` | affectation couleur → plume, ex. `"#000000=1,#ff0000=2"` |
| `--tolerance T` | écart max d'aplatissement des courbes, en mm (défaut 0,10) |
| `-o` | fichier de sortie |

## Conventions techniques

- Unités traceur : **1 unité = 0,025 mm** (40 u/mm), standard HP-GL.
- Origine en **bas à gauche**, axe Y vers le haut (le PDF est en haut à gauche,
  Y vers le bas — l'inversion est faite et vérifiée par le test).
- Courbes de Bézier aplaties par subdivision adaptative de De Casteljau,
  écart max 0,10 mm par défaut.
- Les tracés sont regroupés par plume pour limiter les changements d'outil.

## Test de non-régression

```
sh tests/run.sh
```

Fabrique un patron de test dont le carré de calibration est **volontairement à
96 mm au lieu de 100**, le convertit, puis vérifie sur le fichier HPGL produit :

- le carré sort à 100,000 mm (±0,02)
- les trois plumes sont correctement affectées
- les Béziers sont aplaties (contour à 53 points)
- l'axe Y est inversé, position vérifiée au dixième de mm
- aucune coordonnée négative

## Limites connues

- **PDF raster** : non traité. Il faut d'abord vectoriser (potrace, autotrace),
  puis reprendre à la main. L'outil le détecte et le dit.
- **PDF tuilé** : le réassemblage n'est pas automatisé.
- **Texte** : les étiquettes de pièces (nom, taille, droit-fil) ne sont pas
  converties en tracé. Elles sont signalées par le diagnostic mais restent à
  gérer — soit par la police vectorielle du traceur, soit en les redessinant.
- **HPGL n'est pas un format d'échange.** C'est un langage de traceur : il
  transporte de la géométrie, pas de la sémantique. Ni pièces identifiées, ni
  crans typés, ni droit-fil, ni règles de gradation. Si le logiciel des
  patronnistes accepte le **DXF-AAMA/ASTM**, c'est une bien meilleure cible —
  à vérifier avant d'industrialiser quoi que ce soit.
