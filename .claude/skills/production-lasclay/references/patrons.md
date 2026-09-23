# Patrons et HPGL

Outils dans `patrons/`. Python, une seule dépendance : `python3 -m pip install pymupdf`.

| Outil | Rôle |
| --- | --- |
| `audit_hpgl.py` | **vérifie l'échelle réelle des fichiers HPGL existants — à lancer en premier** |
| `diag_pdf.py` | détermine si un PDF de patron est convertible, et à quel coût |
| `pdf2hpgl.py` | convertit un PDF vectoriel en HPGL, à l'échelle exacte et auto-documenté |

Objectif : rendre les patrons archivés en PDF exploitables par les patronnistes qui travaillent en
HPGL, **sans les redessiner de zéro**, et s'assurer que rien ne part en production à la mauvaise
taille.

## Le problème d'échelle, qui est le seul qui compte

**Un fichier HPGL ne dit nulle part combien vaut une unité.** Le standard HP-GL dit 0,025 mm
(40 u/mm), mais chaque logiciel exporte à sa manière. Un patron plotté avec la mauvaise convention
sort faux d'un facteur entier — **4 fois trop grand, c'est du tissu perdu**. Un patron sorti à 96 %
est un patron inutilisable.

L'audit tranche de deux façons :

- **Si le fichier déclare ses dimensions** dans une étiquette HPGL du type `COUPE 67,9 X 52,1 CM`,
  l'unité se déduit sans ambiguïté en comparant à la géométrie. **C'est la bonne pratique.**
- **Sinon**, il affiche la taille obtenue sous chaque hypothèse et laisse l'humain reconnaître
  laquelle est plausible.

## Ce que l'audit a trouvé dans le parc actuel

Cinq fichiers prélevés dans le Drive (`patrons/echantillons/`) :

| Fichier | Géométrie | Unité | Taille réelle |
| --- | --- | --- | --- |
| `PatronOreillerStandard2026.hpgl` | 2718 × 2083 | **4 u/mm, confirmée** | 679,5 × 520,8 mm |
| `PatronOreillerKing2026.hpgl` | 3734 × 2083 | **4 u/mm, confirmée** | 933,5 × 520,8 mm |
| `Cache-cou_Adulte_M-L.hpgl` | 2451 × 3361 | indéterminée | 245 × 336 mm à 10 u/mm |
| `Cache-cou_Enfant_5-14_ans.hpgl` | 2051 × 2663 | indéterminée | 205 × 266 mm à 10 u/mm |
| `Bandeau_amovible_beanie.hpgl` | 17800 × 11000 | indéterminée | 445 × 275 mm à 40 u/mm |

**Trois conventions différentes cohabitent, et seuls les fichiers d'oreiller sont vérifiables.** Les
deux cache-cou ne sont plausibles qu'à 10 u/mm ; le bandeau qu'à 40 u/mm. Rien dans les fichiers ne
le dit.

**Les fichiers d'oreiller montrent la bonne pratique à généraliser** : ils portent leur nom, leurs
dimensions de coupe et de fini, le tissu, les valeurs de couture et la mention
`1:1 - NE PAS REDIMENSIONNER`, le tout en étiquettes HPGL.

## Usage

```sh
python3 audit_hpgl.py echantillons/
python3 audit_hpgl.py mon_patron.hpgl --attendu 245x336

python3 diag_pdf.py mon_patron.pdf

python3 pdf2hpgl.py mon_patron.pdf --carre 100 --unites 4 \
        --nom "Devant tuque sport" \
        --plumes "#000000=1,#ff0000=2,#0000ff=3"
```

La conversion produit **deux fichiers** : le `.hpgl` et un `_controle.svg` — **contrôle à l'échelle
réelle**. Avant de plotter : imprimer le SVG à 100 % (sans « ajuster à la page ») et **mesurer le
carré à la règle**.

Avec `--nom`, le fichier reçoit un bloc d'identification HPGL — nom, dimensions de coupe, mention
1:1, convention d'unité employée. Le fichier devient **auto-vérifiable** : `audit_hpgl.py` sait
alors retrouver son échelle seul.

### Ce que le diagnostic PDF tranche

| Question | Pourquoi c'est décisif |
| --- | --- |
| **Vectoriel ou raster ?** | un PDF vectoriel se convertit sans perte ; un PDF scanné doit être vectorisé — résultat approximatif, retouche obligatoire. Ce n'est plus une conversion, c'est un redessin assisté |
| **Une grande page ou des tuiles ?** | un PDF tuilé en A4 doit être réassemblé avant conversion |
| **Y a-t-il un carré de calibration ?** | la seule façon de garantir la bonne taille |
| **Combien de couleurs de trait ?** | chaque couleur devient une plume : contour, crans, droit-fil, texte |
| **Quelle emprise réelle ?** | cohérence avec le patron papier |

### Options de `pdf2hpgl.py`

| Option | Effet |
| --- | --- |
| `--page N` | page à convertir (défaut 1) |
| `--carre N` | calibration sur un carré de N mm |
| `--tol-carre P` | tolérance de détection, en % (défaut 15) — **relative**, parce qu'un export mal échelonné s'écarte justement de plusieurs millimètres : c'est le cas à rattraper, pas à rejeter |
| `--echelle F` | correction manuelle si aucun carré n'est présent |
| `--plumes "..."` | affectation couleur → plume |
| `--unites U` | unités par millimètre (défaut 40 ; 10 et 4 existent dans le parc) |
| `--nom "..."` | ajoute le bloc d'identification auto-documenté |
| `--tolerance T` | écart max d'aplatissement des courbes, en mm (défaut 0,10) |

## Conventions techniques

- Unités traceur **paramétrables**. Entête et pied conformes aux fichiers existants :
  `IN; IP; PW0.25;` … `PU0,0; SP0; IN;`
- **Origine en bas à gauche**, axe Y vers le haut. Le PDF est en haut à gauche, Y vers le bas :
  l'inversion est faite et vérifiée par le test.
- Courbes de Bézier aplaties par subdivision adaptative de De Casteljau, écart max 0,10 mm.
- Les tracés sont regroupés par plume pour limiter les changements d'outil.

## Test de non-régression — `sh tests/run.sh`

Fabrique un patron de test dont le carré de calibration est **volontairement à 96 mm au lieu de
100**, le convertit, puis vérifie : le carré sort à 100,000 mm (±0,02), les trois plumes sont
correctement affectées, les Béziers sont aplaties (contour à 53 points), l'axe Y est inversé
(position vérifiée au dixième de mm), aucune coordonnée négative.

Puis **la boucle fermée** : le HPGL généré avec `--nom` doit être reconnu « cohérent » par
`audit_hpgl.py`, c'est-à-dire vérifiable sans connaître sa convention d'unité. Enfin, l'audit est
passé sur les échantillons réels.

## Limites connues

- **PDF raster** : non traité. Il faut vectoriser (potrace, autotrace) puis reprendre à la main.
  L'outil le détecte et le dit.
- **PDF tuilé** : le réassemblage n'est pas automatisé.
- **Texte** : les étiquettes de pièces (nom, taille, droit-fil) ne sont pas converties en tracé.
  Signalées par le diagnostic, à gérer par la police vectorielle du traceur ou en les redessinant.

## La recommandation, et la question ouverte

**Inscrire systématiquement les dimensions réelles dans une étiquette HPGL de chaque patron.** C'est
ce que font déjà les fichiers d'oreiller, et c'est la seule chose qui rend un lot vérifiable après
coup. Le convertisseur le fait avec `--nom` ; les fichiers produits autrement devraient être repris.

**HPGL n'est pas un format d'échange.** C'est un langage de traceur : il transporte de la géométrie,
pas de la sémantique. Ni pièces identifiées, ni crans typés, ni droit-fil, ni règles de gradation.
**Si le logiciel des patronnistes accepte le DXF-AAMA/ASTM, c'est une bien meilleure cible** — à
vérifier avant d'industrialiser quoi que ce soit.

**La question qui n'a pas de réponse : dans quel sens ?** Recevons-nous des `.plt` qu'il faut lire,
ou produisons-nous des fichiers pour piloter un traceur en Tunisie ? Ce n'est pas le même travail.

## Ce qui manque

**Aucun inventaire du corpus de patrons.** Quel patron pour quel produit, dans quelle version, à
quelle échelle — rien ne le dit. C'est un travail à part entière, et c'est ce qui bloque l'« arbre
des patrons et produits ».

Deux choses qu'on sait déjà et qui devraient le structurer :

- **Le patron est une entité partagée, pas un attribut de produit.** La charte l'écrit trois fois :
  *« Patron mitaine polar »* sur la mitaine de laine, la mitaine de cuir et la mitaine polar.
  Aujourd'hui `produit_patrons` est une table par produit — le même patron y serait recopié trois
  fois, et corrigé une seule.
- **Sur les 34 produits importés, zéro patron n'est rattaché.** Le champ existe, rien ne le remplit.

## Le branchement prévu

Brancher l'assistant du MRP sur le convertisseur pour qu'« envoie-moi le patron du cache-cou en
HPGL » devienne une seule phrase.
