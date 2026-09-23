# Les données — ce qui existe, où, et ce qui ment

Carte complète dans `mrp/donnees/SOURCES.md`. Collecte du **24-25 août 2026**. Tout est en TSV,
lisible par un tableur ou par `node -e`, sans séparateur dans les valeurs.

**Rien ici n'est automatisé, et c'est délibéré** : la structure des chiffriers sources change trop
souvent pour qu'un script tienne sans surveillance.

## Les 21 fichiers

| Fichier | Lignes | Contenu |
| --- | ---: | --- |
| `shopify-produits.tsv` | 122 | id, titre, handle, statut, tags, stock, URL boutique, **`description_html`** |
| `shopify-variantes.tsv` | 907 | produit, variante, SKU, prix, **coût unitaire**, stock, poids |
| `shopify-images.tsv` | 679 | produit, rang, **URL CDN**, dimensions, texte alternatif |
| `cogs-tunisie.tsv` | 18 | prix de vente, coût, marge, **10 postes de coût décomposés** |
| `nomenclatures.tsv` | 66 | **la vraie nomenclature** : produit → matière, coût unitaire, consommation |
| `temps-operations.tsv` | 36 | temps **chronométré** par opération et par produit (la préparation) |
| `assemblage-bmb.tsv` | 35 | prix d'assemblage BMB par unité, **extrait des notes techniques** |
| `assemblage-estime.tsv` | 15 | estimations à la main — **à supprimer dès qu'un prix existe** |
| `fournisseurs.tsv` | 16 | fournisseurs de matières, contacts, quantités, prix au mètre ou au kilo |
| `emballage-expedition.tsv` | 5 | Uline et EcoEnclose, prix à l'unité selon le volume |
| `tarifs-postes-canada.tsv` | 4 | tarif par format de colis et destination |
| `plan-production-2627.tsv` | 29 | produit, quantité prévue, prévente encaissée, coût BMB, coût de production |
| `plan-variantes-2627.tsv` | 149 | la répartition par taille et coloris, avec son groupe |
| `correspondances.tsv` | 35 | produit de production → handle Shopify → libellé du plan, + `confiance` et famille |
| `ajouts-production.tsv` | 17 | quantités décidées **hors chiffrier**, avec leur date, leur origine et la ligne qu'elles remplacent |
| `charte-produits.tsv` | 232 | la charte Miro : matière, isolant, garniture, paramètre, note |
| `qualite-charte.tsv` | 114 | la **moitié jaune** de la charte : les vérifications avant emballage |
| `qualite-amorce.tsv` | 47 | protocoles relus à la main depuis les notes techniques |
| `qualite-squelettes.tsv` | 29 | structure des tests de cyclage et d'essai porté, valeurs `À FIXER` |
| `qualite-hors-sujet.tsv` | 21 | les points généraux **écartés** d'un produit, avec motif |
| `bris-terrain.tsv` | 130 | ce qui casse : la phrase mot pour mot, la zone, la date, l'origine |
| `production-tunisie.md` | — | consignes par produit, état des patrons, table de gradation du chandail |
| `schema-v01-propose.sql` | — | le schéma PostgreSQL dérivé de Miro (20 tables) — **lu, pas adopté** |
| `extrait-variantes.py` | — | refait l'extraction des répartitions et vérifie chaque produit par la somme de ses feuilles |

## 1. Catalogue Shopify

Extrait par opération bulk sur l'API Admin le 2026-08-24. **121 produits** (71 actifs),
**906 variantes**, **678 images**.

**Utilisable tout de suite** : les 678 URL sont toutes sur `cdn.shopify.com`, donc redimensionnables
par `?width=N` ; **638 portent un texte alternatif** en français, souvent descriptif au point de
servir de base à une fiche ; **421 variantes portent un coût unitaire** (`inventoryItem.unitCost`).

**Ce qui cloche, et qu'il faudra trancher :**

- **Seulement 195 variantes sur 906 ont un SKU.** Les produits récents (étui de téléphone, mitaines
  urbaines, manchons, coussin pour animaux) n'en ont aucun. Un MRP a besoin d'un identifiant stable
  par variante : soit on généralise les SKU dans Shopify, soit le MRP porte sa propre nomenclature
  et garde l'`id` de variante Shopify comme clé de rapprochement.
- **288 variantes sont en stock négatif.** Ce n'est pas une erreur d'export — Shopify laisse le
  stock passer sous zéro sur les préventes et les ruptures. Il faut décider si le négatif signifie
  « dû au client » ou « à recompter ».
- Les SKU existants suivent **au moins quatre conventions** :
  `LASCLAY-MIT-V1-XSMALL-BLK-20JCC`, `MIT20-XS-BK`, `SPORTBEANIE-24-BK-S/M`,
  `4459028||fine-art|8x10|none`. La « nomenclature standardisée » demandée commence ici.

## 2. COGS Tunisie

**17 fiches**, une par produit, depuis les chiffriers Drive `A26 - <Produit> Tunisie COGS`.

Le modèle de coût est constant :

```
coût du produit  =  matériaux (tissus & autres + isolant)
                 +  sous-traitance (assemblage + douanes + logistique)

sous la ligne, non compris : packaging · shipping client · frais marchand · frais de vente & promo
```

**Vérification faite** : sur les 17 fiches, **13 bouclent à moins d'un cent**. Les quatre écarts
s'expliquent — mitaines polar 12,63 $ et semelles 0,45/0,34 $ par une ligne « Confection Lasclay »
qui s'ajoute à la sous-traitance, tote bag et manteau par des arrondis.

### Les 39 matières

Les tissus viennent tous de Chine (NTG Textile, Shanghai East Bonding, Changshu Xingyan) ; l'isolant
**Vegeto** est fabriqué à partir de l'asclépiade ; le **staple fiber** vient de Tianjin Glory Tang.
Un conteneur groupé de 2023 — 4 946 kg, 12 678 $ CAD de fret — sert de référence pour le coût de
transport au mètre, réparti au prorata du poids.

**Ratio d'isolant valable pour tous les produits : 80 % asclépiade / 20 % staple fiber.** Environ
36,6 g d'asclépiade et 9,2 g de staple par paire de mitaines ; une palette de 300 kg de staple
couvre 33 440 paires.

### Les pièges des fiches sources

Les 17 chiffriers ont été **clonés les uns des autres**, et le nettoyage n'a pas suivi :

- **Les libellés mentent.** « Tuque Sport » contient « Temps par bandeau (5 g) » et « COST TISSUS
  mitaines 2024 ». « Besace » s'ouvre sur un onglet « Sac lunch ». Les valeurs sont bonnes, les
  titres traînent d'un produit précédent.
- **Un onglet par année, pas toujours le plus récent en premier.** La fiche Manteau ouvre sur un
  onglet 2022 de mitaines ; le bloc 2026 est le quatrième. La colonne `saison` du TSV indique
  l'année réellement retenue, pas le titre du fichier.
- **Des `#REF!` et `#DIV/0!`** subsistent dans les onglets de scénarios abandonnés (modèles
  Bilodeau notamment). Ils n'affectent pas les blocs retenus.

C'est précisément ce qu'un MRP supprime : une matière, un coût, un endroit.

### La règle de lecture de la consommation

La colonne « consommation » est du **texte libre** (« 2 pads (4,80 pads/m) », « voir fiche ») ; le
coût, lui, est un nombre fiable. On calcule donc :

```
consommation = coût par produit ÷ prix unitaire
```

et la phrase sert de **contre-vérification**. C'est le seul chemin qui garantit que l'inventaire et
le coût de revient racontent la même histoire. La règle est détaillée en tête de `mrp/chiffrier.js`.
Les **douze lignes** où les deux lectures divergent sont listées nommément par `node import.js`.
**Le coût fait foi** — c'est lui qui a servi à fixer les prix de vente ; c'est la phrase qu'il faut
corriger à la source.

Le lecteur gère aussi les **unités différentes** (g contre kg, po contre m) et les **rendements
inversés**, et applique une tolérance d'arrondi : la plupart des « écarts » apparents n'étaient
qu'une unité, pas un désaccord. Couvert par `tests/inventaire.js`.

Les douze, au 23 septembre — c'est **la phrase** qu'il faut corriger au chiffrier :

| Produit | Matière | Coût → | Texte → |
| --- | --- | --- | --- |
| Bandeau | Vegeto 150gsm | 0,0547 m² | « 0,06 m² » |
| Bandeau | Viscose | 0,1049 m | « 19,20 bandeaux/m » |
| Mitaines plein air | Asclépiade | 0,0509 kg | « 36,6 g/paire (moy.) » |
| Gants magiques | Asclépiade | 0,0100 kg | « 0,02 kg » |
| Semelles 6-7-8F / 9F+ | Vegeto | 0,0462 / 0,0614 m | « 27 pads/m » |
| Semelles 6-7-8F / 9F+ | Mylar | 0,0549 / 0,0745 m | « 22 unités/largeur » |
| Semelles 6-7-8F / 9F+ | Wadding noir | 0,0486 / 0,0625 m | « 27 unités/largeur » |
| Sac de couchage 0C | Ennis Fabrics Challenger 9 | 0,0154 m | « 0,02 m » |
| Glacière | Bretelles | 10,3333 pouce | « 115 po (3,19 verges) » |

Répartition des 65 lignes : **32** déduites du coût avec la phrase qui confirme · **18** la phrase
ne dit rien de comparable · **12** la phrase dit autre chose · **3** ni coût ni phrase exploitables.
Deux lignes de coût agrégées (Fil, Tissus & autres) restent **hors inventaire** : elles ne
désignent pas une matière comptable.

### Une matière ne se supprime pas, elle se retire à une date

`nomenclatures.tsv` porte une colonne **`retire`**. Une matière sortie d'une composition garde sa
ligne, avec la date et le motif — *« Glacière — Chanvre (−1,02 $/unité) : 09/09/2026, le chanvre ne
fait plus partie de la composition »* — et l'import l'annonce. Même principe que partout ailleurs :
**journal, pas état.** Effacer la ligne ferait disparaître l'explication d'une baisse de coût.

## 3. Production Tunisie

`production-tunisie.md` — relevé du Google Docs « Suivi tunisie Mai 2026 » : état du patron,
ajustements demandés, sourcing à faire, pièges d'assemblage, table de gradation du chandail polar.

**Deux ateliers sous-traitants : BMB Textile et Grada Mode.** C'est la source la plus proche de ce
qui manque au MRP : les notes techniques par produit (« presser le col avant d'insérer l'isolant,
sinon il fond ») — exactement le contenu du champ `notes_tech` des fiches.

**Où était cachée la donnée de charge.** Les prix BMB dormaient en texte libre dans ces notes —
« Assemblage BMB 7 $/unité » — là où aucun calcul ne pouvait les atteindre. Ils couvrent 23
produits, dont **cinq que les fiches COGS ignorent complètement** et qui comptaient donc pour zéro
heure. `tools/extrait_bmb.js` les récupère ; le fichier se régénère.

## 4. Plan de production 26-27

Chiffrier « QUANTITÉS FINALES — PLAN DE PRODUCTION 26-27 »
(`1klFYg6bZ7aNc6jxM-RhwLVcfBGBFCDyAAzZXSfJvLcs`), relevé le 25 août 2026. **C'est la source qui
manquait** : ce qu'on produit vraiment, en quelles quantités.

**26 133 unités sur 30 items** au 23 septembre 2026 — le chiffrier plus six ajouts datés. Le
chiffrier seul valait 233 667 $ de coût de production à la collecte d'août.

⚠️ **Les `.md` du dépôt annoncent encore 27 items / 24 333 unités.** Ils datent d'août et n'ont pas
suivi les ajouts. **`node mrp/import.js` fait foi.**

### `ajouts-production.tsv` — le plan bouge sans qu'on touche au miroir

**Le chiffrier est recopié tel quel dans `plan-production-2627.tsv` : on n'y touche jamais, sinon on
ne peut plus comparer l'extrait à sa source.** Ce qui est décidé verbalement après coup vit dans
`ajouts-production.tsv`, avec sa date et son origine, et l'import l'ajoute au plan.

| Ajout | Qté | Origine |
| --- | ---: | --- |
| Cache-cou enfant 18 mois-4 ans | 100 | demandé le 25/08/2026 |
| Cache-cou enfant 5-13 ans | 100 | demandé le 25/08/2026 |
| Sac à dos glacière 30L | 300 | demandé le 08/09/2026 — 150 vert, 150 noir, les deux coloris vendus |
| Semelles 6-7-8F | 2 179 | découpé le 09/09/2026, **remplace** « Semelles intérieures isolantes » |
| Semelles 9F+ | 2 486 | découpé le 09/09/2026, **remplace** la même ligne |
| Bandeau tuque urbaine | 1 500 | **confirmé par Gabriel le 16/09/2026** — un par tuque, le tricot reste en Chine |

**La colonne `remplace` sert au second cas : le chiffrier compte en UNE ligne ce que l'atelier
fabrique en DEUX.** Une ligne d'ajout qui en remplace une autre la retire du plan — elle est
**découpée, pas ignorée** — et les quantités des morceaux doivent redonner celle de la ligne
d'origine. L'import l'annonce : *« Semelles intérieures isolantes → Semelles 6-7-8F (2 179) +
Semelles 9F+ (2 486) »*.

Le découpage des semelles est justifié par l'atelier et par les coûts : **2 min 23 la paire jusqu'au
8F, 3 min 35 à partir du 9F**, et deux fiches COGS distinctes — 3,54 $ contre 3,97 $.

**Ce que ça règle :** le bandeau de la tuque de ville, longtemps listé comme trou du plan, **n'en
est plus un**. Le README le signale encore comme « à confirmer » ; la confirmation est dans le TSV.

**Ce que le plan a révélé :** « Manteau hivernal » et « Manteau 3 saisons » sont deux produits, pas
un ; idem pour l'oreiller de camping et l'oreiller. Ils ont été séparés.

**Ce que le plan ne donne pas : aucune date.** Les quantités sont là, les échéances non — c'est ce
qui manque pour que la liste de fabrication se trie autrement que par quantité.

**Trois tableaux du même chiffrier ne sont pas encore extraits, et ils ont de la valeur :** les
**besoins en matières** (m² par unité et minimum de commande par fournisseur), les **délais
d'approvisionnement** (6 semaines de production, 90 à 120 jours, 6 semaines de bateau), et
l'**historique de ventes mensuel** depuis septembre 2025 qui justifie les quantités.

### `correspondances.tsv` — le pivot

Le lien entre un produit de production, sa fiche Shopify et sa ligne de plan. **C'est le pivot de
l'import — le code produit, pas le nom.** Porte une colonne `confiance`, et les doutes sont écrits en
note technique sur la fiche produit, **visibles dans l'app** plutôt qu'enterrés dans le TSV. État
au 23 septembre : **15 sûr · 6 à confirmer · 5 non couvert · 4 partiel · 3 non vendu · 1 non
produit** (le `SOURCES.md` du dépôt annonce encore « 13 sûrs, 21 à clarifier »).

Porte aussi la **famille de production** (hiver / nouveaux / sacs / reste), qui pilote le tri d'*À
fabriquer*. C'est un classement d'exploitation : il bouge, et il se change dans l'app.

**Le rattachement Shopify sert parfois juste de photothèque.** Les deux tailles enfant du cache-cou
empruntent le handle de l'adulte faute de fiche à elles ; l'import prend alors le **nom de
production** plutôt que le titre Shopify, sans quoi trois produits porteraient le même nom. La règle
tient au `confiance = non vendu`.

## 5. Les écarts de répartition qui restent ouverts

`plan-variantes-2627.tsv` croise deux axes (genre × taille, coloris × taille) et porte des **lignes
de sous-total**. La première lecture les additionnait avec leurs enfants : les « trois doublements
exacts » du manteau hivernal, du manteau 3 saisons et de la veste venaient de cette extraction
fautive, pas du chiffrier. Corrigé, ces trois-là bouclent.

**Cinq écarts sont réels** et affichés dans l'app, les deux chiffres côte à côte :

| Produit | Répartition | Plan | Piste |
| --- | ---: | ---: | --- |
| Bandeau | 2 100 | 1 800 | le modèle « Sport, noir seulement » s'ajoute aux cinq coloris torsadés — à confirmer |
| Semelles | 4 813 | 4 665 | — |
| Étui | 298 | 500 | — |
| Foulard | −15 | — | — |
| Oreiller | −15 | — | — |

Sept autres écarts tiennent à l'**arrondi des pourcentages** ; l'import les nomme **à part** plutôt
que de les mélanger aux vrais. Les mélanger noierait les cinq qui méritent une réponse.

**C'est au chiffrier d'être corrigé, pas à l'app de choisir.**

## 6. Ce qui n'existe nulle part

Nécessaire au MRP, et **aucune source ne le porte aujourd'hui** :

1. **Inventaire des matières premières.** Les fiches COGS donnent les prix et les consommations,
   jamais les quantités en stock. On sait ce que coûte un mètre de Vegeto ; on ne sait pas combien
   il en reste, ni à Québec ni en Tunisie. **Les 36 matières engagées par le plan sont donc « jamais
   comptées »**, et l'app le dit plutôt que de supposer zéro. Le premier comptage est le geste qui
   rend l'inventaire vivant.
2. **Emplacements.** Le suivi Tunisie cite « palette nº 18 » et « boîte B15 » sans nomenclature.
3. **Patrons.** `patrons/` porte les outils, mais **aucun inventaire du corpus** : quel patron pour
   quel produit, dans quelle version, à quelle échelle.
4. **Seuils de réapprovisionnement.** Aucun seuil d'alerte n'est défini nulle part.
5. **Les échéances de production.** Le plan donne des quantités, pas de dates.
6. **Le nom arabe des matières.** Le champ existe et s'affiche ; personne ne l'a rempli.

## 7. Dans le Drive, pas encore extrait

| Document | Identifiant | Pourquoi il compte |
| --- | --- | --- |
| LASCLAY - INVENTAIRE PRODUITS TEMPS RÉEL.xlsx | `1qqqRZWCJDfnjc_pl26jI6Syr2mOKuLz2` | inventaire de produits finis — xlsx, non lisible par le connecteur Drive |
| Copy of LASCLAY CALENDRIER PRODUCTION | `1YMjgz1IA99bd4guYfOYvRiD9PfTdMKHuMermiHQKB8U` | calendrier jour par jour, qtés vendues, mitaines par couleur et taille — 285 Ko, structure visuelle difficile à parser |
| Copy of PRODUCTION MASTER SHEET | `1XJP73y10ao3judCNe8Kb8OFv13RZdbEUxD89webQBI4` | le chiffrier de dates tapées à la main — celui que le calendrier recalculé remplace |
| Expédition Tunisie 2026 — Palettes boîtes | `1YpuJbIUmHrnSZFAr5l4OXssFuGJNexcP3uWAEXMi0Zc` | contenu du conteneur, numéros de palettes et de boîtes |
| Tunisie (BMB Textile + Grada Mode) | `1b5qmfgLy332baLVTzdlfL2gbPGtlRJGW` | dossier des deux sous-traitants |
| Modification_Patron_Tunisie2026.ai | `1a_-0eW_VhbQQpT6ofyBzyrO2JujuIiZh` | modifications de patrons 2026 |

Pour **écrire** un fichier dans le Drive, passer par le skill `drivepush` : le connecteur Drive ne
sait créer que des dossiers et de petits fichiers texte.

## 8. La charte Miro

Tableau **« Charte produits Lasclay (copie MRP) »** — `uXjVHuYrQSA=`, ouvrable à
`https://miro.com/app/board/uXjVHuYrQSA=/`.

**633 objets, 64 frames, 26 produits**, rangés en bandes par pays (TUNISIE, CHINE). 265 zones de
texte, 176 formes, **82 images**, **16 documents**, 15 pense-bêtes.

Chaque frame est une fiche produit à deux colonnes :

- **la fiche technique** (beige) — de quoi c'est fait → `donnees/charte-produits.tsv`, sections
  `matiere`, `isolant`, `garniture`, `parametre`, `note` ;
- **les vérifications** (jaune) — ce qu'on regarde avant d'emballer → `donnees/qualite-charte.tsv`,
  qui devient de vrais points de contrôle et remonte dans la liste obligatoire de chaque ordre.

**C'est le complément exact du mur des bris.** Là où « Ce qui casse » montre ce que les clients ont
vu après coup, ces lignes disent quoi regarder avant. Quand les deux se rejoignent — « bretelles
renforcées » ici, dix coutures de bretelle décousues là-bas — c'est que la consigne existait et
qu'elle n'a pas été tenue. Ça vaut mieux qu'une consigne qui manquait.

**Limite du relevé actuel** : il a été fait depuis un export **PDF basse résolution** — 328 px par
carte, sans couche de texte. Le corps se lit ; **les vignettes d'étiquettes et les schémas de cotes
non**, et ce qui manque est marqué `À RELIRE` plutôt que deviné. Le tableau étant maintenant
accessible, **ces trous peuvent être comblés à la source.**

Imports : `node mrp/import_charte.js --ecrire` et
`node mrp/import_qualite.js --ecrire mrp/donnees/qualite-charte.tsv`.

## Refaire la collecte

Le catalogue Shopify se régénère par opération bulk (la requête exacte est dans l'historique
`git log`). Les fiches Drive se relisent par leur identifiant.
