# Patrons — audit d'échelle, diagnostic PDF et conversion vers HPGL

Trois outils pour le parc de patrons Lasclay :

| Outil | Rôle |
| --- | --- |
| `audit_hpgl.py` | **Vérifie l'échelle réelle des fichiers HPGL existants.** À lancer en premier. |
| `diag_pdf.py` | Détermine si un PDF de patron est convertible, et à quel coût. |
| `pdf2hpgl.py` | Convertit un PDF vectoriel en HPGL, à l'échelle exacte et auto-documenté. |

Objectif : rendre les patrons archivés en PDF exploitables par les patronnistes
qui travaillent en HPGL, **sans les redessiner de zéro**, et s'assurer que rien
ne part en production à la mauvaise taille.

## 0. Auditer l'existant

```
python3 audit_hpgl.py echantillons/
python3 audit_hpgl.py mon_patron.hpgl --attendu 245x336
```

**Un fichier HPGL ne dit nulle part combien vaut une unité.** Le standard HP-GL
dit 0,025 mm (40 u/mm), mais chaque logiciel exporte à sa manière. Un patron
plotté avec la mauvaise convention sort faux d'un facteur entier — 4 fois trop
grand, c'est du tissu perdu.

L'audit tranche de deux façons :

- **Si le fichier déclare ses dimensions** dans une étiquette HPGL du type
  `COUPE 67,9 X 52,1 CM`, l'unité se déduit sans ambiguïté en comparant à la
  géométrie. C'est la bonne pratique.
- **Sinon**, il affiche la taille obtenue sous chaque hypothèse et laisse
  l'humain reconnaître laquelle est plausible.

### Ce que l'audit a trouvé dans le parc actuel

Sur les cinq fichiers de `echantillons/`, prélevés dans le Drive :

| Fichier | Géométrie | Unité | Taille réelle |
| --- | --- | --- | --- |
| `PatronOreillerStandard2026.hpgl` | 2718 × 2083 | **4 u/mm, confirmée** | 679,5 × 520,8 mm |
| `PatronOreillerKing2026.hpgl` | 3734 × 2083 | **4 u/mm, confirmée** | 933,5 × 520,8 mm |
| `Cache-cou_Adulte_M-L.hpgl` | 2451 × 3361 | indéterminée | 245 × 336 mm à 10 u/mm |
| `Cache-cou_Enfant_5-14_ans.hpgl` | 2051 × 2663 | indéterminée | 205 × 266 mm à 10 u/mm |
| `Bandeau_amovible_beanie.hpgl` | 17800 × 11000 | indéterminée | 445 × 275 mm à 40 u/mm |

**Trois conventions différentes cohabitent, et seuls les fichiers d'oreiller sont
vérifiables.** Les deux cache-cou ne sont plausibles qu'à 10 u/mm ; le bandeau
qu'à 40 u/mm. Rien dans les fichiers ne le dit.

Les fichiers d'oreiller montrent la bonne pratique à généraliser : ils portent
leur nom, leurs dimensions de coupe et de fini, le tissu, les valeurs de couture
et la mention `1:1 - NE PAS REDIMENSIONNER`, le tout en étiquettes HPGL.

## Installation

```
python3 -m pip install pymupdf
```

Aucune autre dépendance.

## 1. Diagnostiquer un PDF avant de convertir

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
python3 pdf2hpgl.py mon_patron.pdf --carre 100 --unites 4 \
        --nom "Devant tuque sport" \
        --plumes "#000000=1,#ff0000=2,#0000ff=3"
```

Produit deux fichiers :

- `mon_patron.hpgl` — le HPGL
- `mon_patron_controle.svg` — **contrôle à l'échelle réelle**

Avec `--nom`, le fichier reçoit un bloc d'identification HPGL — nom du patron,
dimensions de coupe, mention 1:1, convention d'unité employée. Le fichier devient
**auto-vérifiable** : `audit_hpgl.py` sait alors retrouver son échelle seul.

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
| `--unites U` | unités par millimètre (défaut 40 ; 10 et 4 existent dans le parc) |
| `--nom "..."` | ajoute le bloc d'identification auto-documenté |
| `--tolerance T` | écart max d'aplatissement des courbes, en mm (défaut 0,10) |
| `-o` | fichier de sortie |

## Conventions techniques

- Unités traceur : **paramétrables** (`--unites`). Le standard HP-GL est 40 u/mm,
  mais le parc Lasclay contient aussi du 10 et du 4 u/mm — d'où l'audit.
- Entête et pied conformes aux fichiers existants : `IN; IP; PW0.25;` … `PU0,0; SP0; IN;`
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

Puis **la boucle fermée** : le fichier HPGL généré avec `--nom` doit être reconnu
« cohérent » par `audit_hpgl.py`, c'est-à-dire vérifiable sans connaître sa
convention d'unité. Enfin, l'audit est passé sur les échantillons réels.

## Recommandation

Inscrire systématiquement les dimensions réelles dans une étiquette HPGL de
chaque patron. C'est ce que font déjà les fichiers d'oreiller, et c'est la seule
chose qui rend un lot vérifiable après coup. Le convertisseur le fait avec
`--nom` ; les fichiers produits autrement devraient être repris.

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
