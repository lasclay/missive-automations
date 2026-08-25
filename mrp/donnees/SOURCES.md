# Données Lasclay — ce qui existe, où c'est, ce qui manque

Collecte du **24 août 2026**. Trois sources : le catalogue Shopify, les fiches
COGS du Drive, le suivi de production Tunisie. Rien ici n'est une copie de
travail figée pour de bon — c'est un instantané, avec les identifiants pour
aller rechercher la version à jour.

Tous les fichiers sont en TSV (tabulation), lisibles tels quels par un tableur
ou par `node -e`, et sans caractère de séparation dans les valeurs.

---

## 1. Catalogue Shopify

Extrait par opération bulk sur l'API Admin, le 2026-08-24.
**121 produits** (dont 71 actifs), **906 variantes**, **678 images**.

| Fichier | Contenu | Lignes |
| --- | --- | ---: |
| `shopify-produits.tsv` | id, titre, handle, statut, type, tags, stock total, URL boutique, nombre de variantes/images, collections, dates | 121 |
| `shopify-variantes.tsv` | produit, variante, **SKU**, prix, prix comparé, **coût unitaire**, stock, suivi, poids | 906 |
| `shopify-images.tsv` | produit, rang, **URL CDN**, largeur, hauteur, texte alternatif | 678 |

**Ce qui est utilisable tout de suite**

- Les **678 URL d'images** sont toutes sur `cdn.shopify.com`, donc
  redimensionnables par `?width=N` — c'est exactement ce que `urlImage()`
  attend dans `../vues.js`. **638 portent un texte alternatif** en français,
  souvent descriptif au point de servir de base à une fiche produit.
- **421 variantes portent un coût unitaire** (`inventoryItem.unitCost`). C'est
  le COGS que Shopify utilise pour ses rapports de marge.
- Chaque produit a son `onlineStoreUrl` — le lien public de la fiche.

**Ce qui cloche, et qu'il faudra trancher**

- **Seulement 195 variantes sur 906 ont un SKU.** Les produits récents (étui de
  téléphone, mitaines urbaines, manchons, coussin pour animaux) n'en ont
  aucun. Un MRP a besoin d'un identifiant stable par variante : soit on
  généralise les SKU dans Shopify, soit le MRP porte sa propre nomenclature et
  garde l'`id` de variante Shopify comme clé de rapprochement.
- **288 variantes sont en stock négatif.** Ce n'est pas une erreur d'export :
  Shopify laisse le stock passer sous zéro sur les préventes et les ruptures.
  Une stratégie d'inventaire devra décider si le négatif signifie « dû au
  client » ou « à recompter ».
- Les SKU existants suivent **au moins quatre conventions** :
  `LASCLAY-MIT-V1-XSMALL-BLK-20JCC`, `MIT20-XS-BK`, `SPORTBEANIE-24-BK-S/M`,
  `4459028||fine-art|8x10|none`. La normalisation demandée dans les besoins
  ERP (« nomenclature standardisée ») commence ici.

---

## 2. COGS Tunisie

**17 fiches produit** relevées, une par produit, depuis les chiffriers Drive
`A26 - <Produit> Tunisie COGS` et leurs prédécesseurs.

| Fichier | Contenu | Lignes |
| --- | --- | ---: |
| `cogs-tunisie.tsv` | prix de vente, coût, marge, et les 10 postes de coût décomposés | 17 |
| `nomenclatures.tsv` | **la vraie nomenclature** : produit → matière, coût unitaire, consommation, coût par produit | 65 |
| `temps-operations.tsv` | temps chronométré par opération et par produit | 35 |
| `fournisseurs.tsv` | fournisseurs de matières, contacts, quantités, prix au mètre ou au kilo | 15 |
| `emballage-expedition.tsv` | Uline et EcoEnclose, prix à l'unité selon le volume | 4 |
| `tarifs-postes-canada.tsv` | tarif par format de colis et destination | 3 |

### Comment lire `cogs-tunisie.tsv`

Le modèle de coût est constant d'une fiche à l'autre :

```
coût du produit  =  matériaux (tissus & autres + isolant)
                 +  sous-traitance (assemblage + douanes + logistique)

sous la ligne, non compris dans le coût produit :
   packaging · shipping au client · frais marchand · frais de vente & promo
```

**Vérification faite** : sur les 17 fiches, **13 bouclent à moins d'un cent**
entre le coût déclaré et la somme matériaux + sous-traitance. Les quatre
écarts s'expliquent :

| Produit | Écart | Cause |
| --- | ---: | --- |
| Mitaines polar | 12,63 $ | une ligne « Confection Lasclay (26 $/h, 80 % eff.) » de 12,01 $ s'ajoute à la sous-traitance |
| Semelles 9F+ | 0,45 $ | idem, « Confection Lasclay (20 $/h, 50 % eff.) » |
| Semelles 6-7-8F | 0,34 $ | idem |
| Tote bag / Manteau | 0,26 / 0,61 $ | arrondis et lignes annexes |

### Les 39 matières distinctes

Les tissus viennent tous de Chine (NTG Textile, Shanghai East Bonding,
Changshu Xingyan), l'isolant Vegeto est fabriqué à partir de l'asclépiade,
et le staple fiber vient de Tianjin Glory Tang. Un conteneur groupé de 2023
(4 946 kg, 12 678 $ CAD de fret) sert de référence pour le coût de transport
au mètre, réparti au prorata du poids.

Ratio d'isolant, valable pour tous les produits :
**80 % asclépiade / 20 % staple fiber**. Environ 36,6 g d'asclépiade et 9,2 g
de staple par paire de mitaines ; une palette de 300 kg de staple couvre
33 440 paires.

### Pièges à connaître dans les fiches sources

Les 17 chiffriers ont été **clonés les uns des autres**, et le nettoyage n'a
pas toujours suivi. Concrètement :

- **Les libellés mentent parfois.** La fiche « Tuque Sport » contient
  « Temps par bandeau (5 g) » et « COST TISSUS mitaines 2024 ». La fiche
  « Besace » s'ouvre sur un onglet « Sac lunch ». Les *valeurs* sont bonnes,
  les *titres* traînent d'un produit précédent.
- **Un onglet par année, et pas toujours le plus récent en premier.** La
  fiche Manteau ouvre sur un onglet 2022 de mitaines ; le bloc 2026 est le
  quatrième. Les colonnes `saison` du TSV indiquent l'année réellement
  retenue, pas le titre du fichier.
- **Des `#REF!` et `#DIV/0!`** subsistent dans les onglets de scénarios
  abandonnés (modèles Bilodeau notamment). Ils n'affectent pas les blocs
  retenus ici.

C'est précisément ce genre de dérive qu'un MRP supprime : une matière, un
coût, un endroit.

---

## 3. Production Tunisie

`production-tunisie.md` — consignes par produit relevées du Google Docs
« Suivi tunisie Mai 2026 » : état du patron, ajustements demandés, sourcing à
faire, pièges d'assemblage, et la table de gradation du chandail polar.

Deux ateliers sous-traitants : **BMB Textile** et **Grada Mode**.

C'est la source la plus proche de ce qui manque au MRP aujourd'hui : les
notes techniques par produit (« presser le col avant d'insérer l'isolant,
sinon il fond »), qui sont exactement le contenu du champ `notes_tech` des
fiches produits.

---

## 3bis. Plan de production 26-27

Chiffrier « QUANTITÉS FINALES — PLAN DE PRODUCTION 26-27 »
(`1klFYg6bZ7aNc6jxM-RhwLVcfBGBFCDyAAzZXSfJvLcs`), relevé le 25 août 2026.
C'est la source qui manquait : ce qu'on produit vraiment, en quelles quantités.

| Fichier | Contenu | Lignes |
| --- | --- | ---: |
| `plan-production-2627.tsv` | produit, quantité prévue, prévente déjà encaissée, coût BMB, coût de production | 28 |
| `plan-variantes-2627.tsv` | la répartition par taille et par coloris | 141 |
| `correspondances.tsv` | produit de production → handle Shopify → libellé du plan | 32 |

**24 133 unités, 233 667 $ de coût de production.** Les cinq plus gros postes :
semelles 4 665, cache-cous 3 500, gants magiques 2 500, mitaines plein air
2 000, bandeaux 1 800.

`correspondances.tsv` est la table qui manquait au §5 : le lien entre un produit
de production, sa fiche Shopify et sa ligne de plan. Elle porte une colonne
`confiance` — **13 rattachements sûrs, 19 à clarifier**, et les doutes sont
écrits en note technique sur la fiche produit, visibles dans l'app plutôt
qu'enterrés ici.

Ce que le plan a révélé et que la table ignorait : « Manteau hivernal » et
« Manteau 3 saisons » sont deux produits, pas un ; idem pour l'oreiller de
camping et l'oreiller. Ils ont été séparés.

Ce que le plan ne donne **pas** : aucune date. Les quantités sont là, les
échéances non — c'est ce qui manque pour que la liste de fabrication se trie
autrement que par quantité.

Trois autres tableaux du même chiffrier ne sont pas encore extraits, et ils ont
de la valeur : les **besoins en matières** (m² par unité et minimum de commande
par fournisseur), les **délais d'approvisionnement** (6 semaines de production,
90 à 120 jours, 6 semaines de bateau), et l'**historique de ventes mensuel**
depuis septembre 2025 qui justifie les quantités.

## 4. Ce qui existe dans le Drive mais n'est pas encore extrait

| Document | Identifiant Drive | Pourquoi il compte |
| --- | --- | --- |
| LASCLAY - INVENTAIRE PRODUITS TEMPS RÉEL.xlsx | `1qqqRZWCJDfnjc_pl26jI6Syr2mOKuLz2` | inventaire de produits finis — format xlsx, non lisible par le connecteur Drive |
| Copy of LASCLAY CALENDRIER PRODUCTION | `1YMjgz1IA99bd4guYfOYvRiD9PfTdMKHuMermiHQKB8U` | calendrier jour par jour (septembre/octobre), qtés vendues, planification mitaines par couleur et taille — 285 Ko, structure visuelle difficile à parser |
| Copy of PRODUCTION MASTER SHEET | `1XJP73y10ao3judCNe8Kb8OFv13RZdbEUxD89webQBI4` | — |
| Expédition Tunisie 2026 — Palettes boîtes et autres | `1YpuJbIUmHrnSZFAr5l4OXssFuGJNexcP3uWAEXMi0Zc` | contenu du conteneur, numéros de palettes et de boîtes cités dans le suivi (palette nº 18, boîte B15) |
| Tunisie (BMB Textile + Grada Mode) | `1b5qmfgLy332baLVTzdlfL2gbPGtlRJGW` | dossier des deux sous-traitants |
| Modification_Patron_Tunisie2026.ai | `1a_-0eW_VhbQQpT6ofyBzyrO2JujuIiZh` | modifications de patrons 2026 |
| H23 Cache-cou / H24 Mitaines / H24 Sous-plat / S24 Manchons COGS | `136dRvWpkZo1…`, `1CGEi8Jj1BNW…`, `154E7ppBBs0I…`, `1vo1iReYAv03…` | fiches COGS historiques, utiles pour l'évolution des coûts |

---

## 5. Ce qui n'existe nulle part

Ces données sont nécessaires au MRP et **aucune source ne les porte
aujourd'hui**. Il faudra les saisir.

1. **Inventaire des matières premières.** Les fiches COGS donnent les prix et
   les consommations, jamais les quantités en stock. On sait ce que coûte un
   mètre de Vegeto ; on ne sait pas combien il en reste, ni à Québec ni en
   Tunisie.
2. **Emplacements.** Le suivi Tunisie cite « palette nº 18 » et « boîte B15 »
   sans nomenclature d'emplacements.
3. ~~**Correspondance produit Shopify ↔ produit de production.**~~ Faite :
   `correspondances.tsv`. Reste à confirmer 19 rattachements sur 32 — les
   doutes sont dans la colonne `confiance` et remontent dans l'app.
4. **Patrons.** `../../patrons/` porte les outils de conversion et les
   échantillons, mais aucun inventaire du corpus : quel patron pour quel
   produit, dans quelle version, à quelle échelle. C'est un travail à part
   entière — rappel du diagnostic : **trois conventions d'unités
   incompatibles** coexistent dans les fichiers HPGL existants, et seuls les
   fichiers d'oreillers sont auto-vérifiables.
5. **Seuils de réapprovisionnement.** Aucun seuil d'alerte n'est défini nulle
   part, ni sur les matières ni sur les produits finis.
6. **Les échéances de production.** Le plan 26-27 donne des quantités, pas de
   dates. Sans elles, la liste de fabrication ne peut trier que par quantité.

---

## Refaire la collecte

Le catalogue Shopify se régénère par opération bulk (voir l'historique de
`git log` pour la requête exacte). Les fiches Drive se relisent par leur
identifiant. Rien n'est automatisé pour l'instant : c'est délibéré, la
structure des chiffriers sources change trop souvent pour qu'un script tienne
sans surveillance.
