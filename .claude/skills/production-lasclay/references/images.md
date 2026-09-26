# Les images — où elles sont, comment les obtenir, ce qui manque

**Rien n'est hébergé par le MRP.** L'app ne stocke que des adresses, et les planches PDF sont
régénérables. C'est une contrainte assumée : la source reste la seule vérité, et une photo retirée
de Shopify laisse un cadre vide plutôt qu'une copie périmée.

## Les quatre gisements

| Gisement | Volume | Accès | Contenu |
| --- | ---: | --- | --- |
| **CDN Shopify** | **678 URL** | `donnees/shopify-images.tsv` | photos studio et contexte des fiches vendues |
| **Tableau Miro** | **82 images + 16 documents** | `uXjVHuYrQSA=` | schémas de cotes, détails d'assemblage, planches d'étiquettes |
| **Google Drive** | — | identifiants dans `donnees/SOURCES.md` | patrons `.ai`, photos de suivi, expédition |
| **Planches PDF** | **35 pages** | `mrp/planches/` + Drive | le condensé imprimable, régénérable |

## 1. Shopify — le gisement utilisable tout de suite

`donnees/shopify-images.tsv` : produit · handle · rang · **URL** · largeur · hauteur ·
**texte alternatif**.

**638 des 678 portent un texte alternatif en français**, souvent descriptif au point de servir de
base à une fiche produit — *« Cache-cou tubulaire gris foncé marbré en viscose de bambou, matelassé
de surpiqûres ondulées »*.

**Toutes sont sur `cdn.shopify.com`, donc redimensionnables** :

```
<url>?width=320            # ce que fait urlImage() dans vues.js
<url>?width=320&format=jpg # cinq fois plus léger — mais pas honoré partout
```

`format=webp` **n'est jamais honoré**. `format=jpg` l'est sur certaines URL et pas sur d'autres :
mesuré le 23/09/2026, une même image rendait 124 352 octets avec et sans. **Vérifier avant de
compter dessus.**

Le rattachement passe par le **handle** de `correspondances.tsv`. Trois conséquences :

- les **cache-cous enfant** empruntent le handle de l'adulte : les photos montrent du **vert**,
  alors que l'enfant est **noir uniquement** ;
- `TUQUE-VILLE`, `BANDEAU-TUQUE` et les deux tailles enfant **n'ont pas de fiche à eux** ;
- cinq URL du TSV ne répondent plus (404) — le relevé date du 24/08/2026.

## 2. Miro — les schémas, et ce qui reste illisible

Les 82 images du tableau portent ce qui n'existe nulle part ailleurs : **les cotes**, encadrées de
rectangles à liseré rouge, et les **détails d'assemblage**. Leur texte est **dans l'image**, pas
dans le SVG — c'est la raison pour laquelle le relevé TSV les marque `À RELIRE`.

Les adresses ressemblent à :

```
https://api.miro.com/v2/boards/uXjVHuYrQSA%3D/resources/images/<id>?format=preview&redirect=false
```

**Elles exigent l'authentification Miro** : `curl` ne les prend pas. Deux chemins possibles —
`mcp__Miro__image_get_url` sur un item précis, ou ouvrir le tableau et exporter à la main.

Les **16 documents** vivent dans huit frames au bandeau vert « Étiquette » : c'est l'artwork des
étiquettes tissées et pliées. Ils n'ont pas de texte extractible.

**C'est le travail qui reste pour les fiches « exhaustives ++++ »** : relever les cotes depuis ces
images, et rattacher chaque planche d'étiquette à ses produits.

## 3. Les planches PDF — `mrp/planches/PLANCHES-PRODUITS.pdf`

**35 pages, une par produit de production**, 3,5 Mo. Chaque page porte :

- l'en-tête — code, nom, famille, lieu de fabrication, fiabilité du rattachement, quantité au plan,
  prix d'assemblage BMB ;
- **jusqu'à quatre photos** avec leur texte alternatif ;
- la **composition** telle que la charte la décrit — matières, isolant, garnitures, paramètres
  machine, notes ;
- les **vérifications avant emballage**, avec leur « sinon… » en rouge ;
- la **note de rattachement**, quand il y a un doute à porter.

**Sur le Drive** : dossier *Tunisie (Bmb Textile + Grada Mode)*, fichier
`PLANCHES-PRODUITS-LASCLAY.pdf`, identifiant `1F1zUS9j-ggkKMzOnygjKkUX3ro1KR7Dk`.

### Régénérer

```sh
# 1. la page, pointant le CDN — l'artefact honnête, aucune image copiée
node mrp/tools/planches.js > planches.html

# 2. pour une impression hors ligne : rapatrier puis pointer le local
node mrp/tools/planches.js --liste-images > liste.tsv
mkdir -p img && cd img
while IFS=$'\t' read -r nom url; do
  curl -sS -o "$nom" "${url}&width=300" || rm -f "$nom"
done < ../liste.tsv && cd ..
node mrp/tools/planches.js --local ./img > planches-local.html

# 3. l'impression
/opt/pw-browsers/chromium-*/chrome-linux/chrome --headless --disable-gpu --no-sandbox \
  --virtual-time-budget=90000 --no-pdf-header-footer \
  --print-to-pdf=PLANCHES-PRODUITS.pdf "file://$PWD/planches-local.html"
```

**Pourquoi le mode local existe.** Dans un conteneur infonuagique, Chromium ne franchit pas le
proxy TLS de la session : il échoue en `handshake failed` et imprime des cadres vides, **sans le
dire**. `curl`, lui, a le certificat. Le mode local contourne ça, et **écarte silencieusement les
images qu'il n'a pas pu rapatrier** plutôt que de laisser un cadre cassé.

`mrp/planches/images-sources.tsv` garde la correspondance nom local ↔ URL d'origine : c'est la
traçabilité du lot, et ça permet de rejouer le téléchargement sans relire le TSV Shopify.

### Déposer une nouvelle version sur le Drive

Par le skill **`drivepush`** — le connecteur Drive ne sait pas écrire un binaire. Le corps de la
requête est le fichier en base64 **et rien d'autre** ; le jeton et la destination vont dans l'URL ;
**la redirection 302 d'Apps Script se suit à la main** (`curl -L` transformerait le POST en GET).

```
&folder=<id>&name=<nom>   crée, ou écrase l'homonyme
&id=<idFichier>           remplace en conservant le lien de partage
```

⚠️ Le paramètre s'appelle **`folder`**, pas `folderId`. Un nom inconnu est ignoré en silence et
l'appel retombe sur la cible par défaut — **le chiffrier de prévisions**. C'est arrivé trois fois
le 6 août 2026.

## 4. Les schémas Miro dans l'app — résolu, et comment

**Le problème.** Les images du tableau exigent l'authentification Miro, et
`image_get_url` rend une adresse **signée qui expire** (`?Expires=…&Signature=…`).
La stocker donnerait un cadre vide le lendemain.

**Ce qu'on n'a PAS fait, et pourquoi.** Un `live-embed` Miro — le « widget » —
charge plusieurs mégaoctets de canevas WebGL dans une page qui en fait cinq
kilo-octets. Ça viole la première contrainte de l'app, ça exige que le tableau soit
public ou un siège Miro par couturière, et ça rend l'atelier à la navigation de
633 objets pour trouver sa pièce. **C'est « quitter le MRP » sous un autre nom.**

**Le chemin retenu**, validé de bout en bout le 23/09/2026 :

```
Miro → image_get_url → curl → Drive (drivepush) → lh3.googleusercontent.com/d/<id>=wN
                                                   ↑ urlImage() sait déjà le faire
```

L'app continue de n'héberger aucun fichier : elle porte une adresse, et le CDN
Google la sert redimensionnée. Mesuré : 6 380 octets d'origine, **3 433 en `=w600`**,
et la fiche produit reste à **3 245 octets compressés**.

**Ce qui est en place** — `donnees/schemas-produits.tsv`, **7 images pour
13 rattachements sur 12 produits** :

| Produit(s) | Ce que l'image montre |
| --- | --- |
| Cache-cou adulte + les deux enfants | **les cotes des trois tailles** — 22,1 × 19,9 · 24,8 × 22,7 · 29,9 × 27,1 cm |
| Semelles 6-7-8F et 9F+ | l'emballage en manchon de carton, estampe de taille visible |
| Mitaine plein air | jonction main/pouce et couture de la patch de cuir, annotées |
| Les quatre mitaines | **orientation de l'étiquette : toujours du même sens** |
| Glacière | **bretelles renforcées** — la zone la plus signalée du terrain |
| Bandeau de tuque | le bandeau en place, hors tout 8 × 44 cm max |
| Coussin | pliage en accordéon, étiquette visible vers le haut |

**Les invariants, épinglés par `tests/schemas.js`** (11 vérifications) : un schéma
n'est **jamais** la vignette d'une carte · l'import n'efface que ses lignes
(`source = 'miro'`) · une `data:` URI est refusée et la feuille continue · une image
partagée entre produits reste **une** image.

**La contrepartie à connaître.** Une image servie par `lh3` est **lisible par
quiconque a l'adresse**. C'est la même propriété que les photos Shopify, mais un
dessin coté n'a pas le même statut qu'une photo de boutique. Vérifié : les sept
répondent 200 sans authentification. À peser avant d'y mettre un plan de coupe.

Pour en ajouter une : `mrp/planches/README.md` § « Les schémas Miro ».

## 4bis. Ce qui manque encore

- **Aucune image de patron.** `patrons/echantillons/` porte cinq fichiers HPGL, pas de rendu.
  `pdf2hpgl.py` produit bien un SVG de contrôle à l'échelle réelle — mais aucun n'est archivé.
- **Aucun schéma de sens de coupe.** La charte dit *« Droit fil / Élasticité du bon côté »* ;
  personne n'a le dessin qui le montre. Il faudrait un type de média « schéma technique »,
  distinct des photos studio et contexte.
- **Les cotes ne sont pas des données.** Elles sont dans des images Miro et dans
  `produit_patrons.dimensions`, un texte libre. Rien ne permet de vérifier une mesure contre une
  tolérance, sauf ce que `qc_points` porte déjà (cote, tolérance, unité).
- **Le MRP plafonne les vignettes à ce que le CDN sert.** Pas de limite maison — c'est déjà mieux
  que MRPeasy, qui plafonne les icônes d'article à 50 Ko et 160 × 120 px.

## Schémas de la charte : jamais une capture Miro, jamais un fichier Drive privé

Le 26/09/2026, les quatre schémas de la charte qui pointaient au Drive (glacière bretelles, mitaine
étiquettes, semelle découpe, cache-cou tailles) étaient **flous à la source** — des vignettes Miro
agrandies dix fois, 2055 px de large pour ~200 px d'information — et **privés** : hors session
Google, `lh3` renvoie une redirection vers la connexion, donc l'atelier ne voyait rien.

Refaits depuis les **originaux** du tableau (`mcp__Miro__image_get_url` sur l'image, pas la capture
de la frame) ou depuis la photo studio Shopify, puis servis par le MRP (`/schema/*.webp`, table
`SCHEMAS` de `server.js`). Avant de citer une image du Drive, vérifier qu'elle répond **200
image/…** sans session : `curl -s -o /dev/null -w '%{http_code}' https://lh3.googleusercontent.com/d/<id>=w200`.
Le test e2e vérifie que chaque `/schema/…` cité par `donnees/` est bien servi.
