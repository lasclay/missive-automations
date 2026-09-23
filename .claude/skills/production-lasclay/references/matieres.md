# Matières, fournisseurs, emballage et expédition

**39 matières distinctes** pour **65 lignes de nomenclature** (`donnees/nomenclatures.tsv`), dont
46 entrent dans la base. Les prix viennent des fiches COGS ; les quantités en stock **n'existent
nulle part** — voir `donnees.md` §6.

## L'isolant, qui est le cœur du produit

**Vegeto** est l'isolant fabriqué à partir de la soie d'asclépiade. Il arrive en rouleau et se vend
au mètre, avec un prix au m² dérivé :

| Matière | Prix | Équivalent m² |
| --- | ---: | ---: |
| Vegeto 150 gsm | 12,50 $/m | 8,22 $/m² |
| Vegeto 200 gsm | 18,00 $/m | 11,84 $/m² |
| Vegeto 250 gsm | 22,00 $/m | 14,47 $/m² |
| Vegeto *(générique, sans grammage)* | 13,84 $/m | — |

**L'asclépiade en vrac** (soie libre, pas en nappe) sert au remplissage de certains produits, mélangée
à du **staple fiber** — une fibre synthétique bas point de fusion qui la fait tenir.

### ⚠️ Trois contradictions dans les données d'isolant

**1. L'asclépiade porte deux prix, dans un rapport de six.**

| Produit | Prix au kg | Consommation |
| --- | ---: | --- |
| Tuque sport | **105,00 $** | 1 g |
| Mitaines plein air | **105,00 $** | 36,6 g/paire |
| Mitaines polar | **105,00 $** | voir fiche |
| Glacière | **105,00 $** | 51,25 g |
| **Gants magiques** | **17,00 $** | 0,02 kg |

La charte tranche probablement le mystère : elle décrit le gant magique comme isolé à la **fibre
recyclée, 4 à 5 g par gant** — pas à l'asclépiade. **Le même nom désignerait donc deux matières
différentes dans la nomenclature**, ce qui casserait l'agrégation de stock le jour où on comptera.
À corriger à la source, pas à moyenner.

**2. « Staple fiber » et « Fibre synthétique » coexistent, au même rôle, à deux prix.**
Staple fiber 7,24 $/kg (bandeau, tuque sport, mitaines polar) contre Fibre synthétique 3,69 $/kg
(glacière). Deux noms pour la même chose, ou deux qualités ? Rien ne le dit.

**3. Le ratio « 80 % asclépiade / 20 % staple » n'est pas universel**, contrairement à ce
qu'annonçait `SOURCES.md`. Il tient sur les **mitaines plein air** — 36,6 g d'asclépiade pour 9,2 g
de staple, soit 79,9 %. Il ne tient pas sur la **glacière** (51,25 g + 51,25 g = 50/50) ni sur la
**tuque sport** (1 g + 1 g). **À vérifier produit par produit avant de s'en servir pour calculer un
besoin matière.**

Repère utile qui, lui, tient : une **palette de 300 kg de staple couvre 33 440 paires** de mitaines.

**Le chanvre est sorti.** Il isolait le fond de la glacière (638 $/rouleau, 1,02 $/unité) ; retiré
le 09/09/2026, c'est le Vegeto 250 g qui fait le travail. La ligne reste au fichier avec sa date —
voir la colonne `retire`.

## Les unités : la source reste impériale, l'affichage s'adapte

Les fournisseurs nord-américains écrivent la toile en **onces par verge carrée**
et les longueurs en **pouces**. L'atelier tunisien travaille en métrique. Le
dépôt ne tranche pas : **les fichiers gardent l'unité de la source**, et la
conversion se fait au rendu selon le réglage de chacun (`unites.js`, réglable
dans *Mon compte* : métrique, impérial, ou les deux).

Convertir à la saisie ferait perdre la trace ; écrire les deux partout
alourdirait chaque ligne d'une parenthèse qu'un des deux lecteurs n'utilise
jamais.

| Unité source | Facteur | Exemple |
| --- | --- | --- |
| oz/verge² *(toile)* | **× 33,9057** g/m² | 10 oz ≈ **339 g/m²** · 12 oz ≈ **407 g/m²** |
| pouce | × 2,54 cm | 50 po = 127 cm |
| pied | × 30,48 cm | 1 pied = 30 cm |
| verge | × 0,9144 m | 3,19 verges = 2,92 m |
| fils/po² | ÷ 6,4516 | 300 fils/po² = 47 fils/cm² |

⚠️ **L'once désigne deux choses sans le dire** : une masse (28,35 g) et une
masse *surfacique* (once par verge carrée, 33,91 g/m²). Dans tout le corpus
Lasclay, « 12 oz » est toujours une toile — jamais un poids. Le jour où une
once de masse apparaîtra, la règle la convertira faux.

**Le défaut est le métrique** : l'atelier est le plus gros lecteur de fiches.

## Les tissus

| Matière | Prix | Usage |
| --- | ---: | --- |
| Ennis Fabrics Challenger 909 Raven | 14,90 $/m | sacs de couchage |
| Kendor brushed poly spandex | 7,98 $/m (5,25 $/m²) | tuque sport |
| Flanelette Chine · Outershell · Outershell Chine · Doublure intérieure | 4,00 à 5,00 $/m | manteaux, vestes |
| Knit foulard *(85 % viscose, 15 % acrylique)* | 4,95 $/m (3,26 $/m²) | cache-cou, foulard |
| PVC bleu | 4,50 $/m (2,92 $/m²) | intérieur sac à lunch, glacière |
| Viscose | 4,29 $/m | bandeau |
| Marilite bleu | 3,60 et 6,00 $/m | doublures |
| Canevas Chine / Canevas coton | 3,09 $/m (2,01 à 2,19 $/m²) | coton des isothermes |
| Outershell mitaines Chine | 2,90 $/m (1,91 $/m²) | mitaines |
| Mylar | 2,55 $/m | semelles |
| Wadding noir | 1,44 $/m | semelles, bandeau de tuque |
| Entoilage Wadding | 1,10 $/m | — |
| Mesh Hot Melt TPU | 0,59 · 0,83 · 1,01 $/m | semelles, coussin |
| Veratex entoilage noir | 1,81 $/m (1,19 $/m²) | viseline |

**Plusieurs matières portent plusieurs prix** — Canevas Chine à 2,01 / 2,03 / 2,19 $/m², Marilite à
3,60 et 6,00, Mesh TPU à trois prix, Knit foulard à deux. Ce sont des relevés de fiches COGS
différentes, donc d'années différentes. **Un MRP doit trancher : un prix par matière, à une date.**
C'est exactement la dérive qu'il supprime.

## Quincaillerie et étiquettes

| Matière | Prix | Note |
| --- | ---: | --- |
| Bandoulière | 2,00 $/unité | étui de téléphone — *1 étui = 1 ganse* |
| Zipper | 1,00 $/unité | générique ; la charte donne les vraies specs par produit |
| Velcro Brand Sticky Back Hook + Loop | 0,84 $/pouce | manteau (3 cm), coussin (2,5 cm) |
| Webbing 1 po 4-Bar Panel noir | 0,03 et 0,12 $/pied | sacs |
| Bretelles | 0,03 $/pouce | glacière — 115 po (3,19 verges) par sac |
| Woven Label *(grand)* | 1,73 $/unité | — |
| Hot cut Labels CC + logo | 0,20 $/unité | cache-cou |
| Woven Labels | 0,10 et 0,20 $/unité | — |
| Woven Labels logo | 0,05 $/unité | — |
| Woven Labels Lasclay texte | 0,02 $/unité | — |
| Fil | agrégé | **hors inventaire** |

**Les fermetures éclair méritent mieux que « Zipper ».** La charte donne la vraie spécification
produit par produit : spirale coil nylon #4 non séparable (chandail) · spirale maille 3 de 18 cm
(étui) · maille 3 de 20 cm (tote) · maille 5 ou 8 de 47 cm (besace) · maille 5 double curseur
int/ext (sacs de couchage) · blanche (oreiller). **Ce sont six articles différents sous un seul nom
de nomenclature.**

**Deux lignes sont agrégées et restent hors inventaire** : `Fil` et `Tissus & autres`. Elles ne
désignent pas une matière comptable — les compter créerait une entrée de stock qu'on ne peut ni
recevoir ni consommer.

## Les fournisseurs

`donnees/fournisseurs.tsv` — 15 lignes. **Tous les tissus viennent de Chine.**

| Fournisseur | Pays | Article | Conditions |
| --- | --- | --- | --- |
| **Tianjin Glory Tang Hi-Tech Fiber** | Chine | staple fiber 4D 51 mm noir, 50 % recyclé, bas point de fusion | 350 kg → 1 389,15 $ CAD (**3,97 $/kg**) · `aurora@gtfibers.com` |
| **Guangzhou NTG Textile** | Chine | tissu foulard 85 % viscose / 15 % acrylique | 1 200 m en 63 po → 4 745,38 $ (**3,95 $/m**) |
| **Shanghai East Bonding Material** | Chine | Mesh TPU web 25 gsm | 10 000 m en 60 po → 0,44 $/m · 5 000 m en 36 po → 0,43 $/m |
| **Changshu Xingyan Interlining** | Chine | wadding non tissé 80 / 120 / 200 gsm | 10 000 m en 20 po → 0,37 $/m ; petits lots à 20,16 $ et 50,40 $ |
| **Dongguan Shangcheng Technology** | Chine | 2 presses à chaud 60 × 80 cm, 220 V monophasé | 2 366,00 $ — l'équipement du 170 °C / 45 s |
| **Zhengzhou Yize Machinery** | Chine | ouvreuse à staple fiber | 1 900,08 $ |
| **Baoding Feixiang Machinery** | Chine | équipement, conteneur 2023 | 1 colis, 160 kg |
| **BMB Textile** | Tunisie | sous-traitance assemblage | prix par unité — voir `assemblage-bmb.tsv` |
| **Grada Mode** | Tunisie | sous-traitance assemblage | **les mitaines plein air y sont faites** |

**Le fret de référence** : un conteneur groupé de 2023 — **4 946 kg pour 12 678 $ CAD** — sert à
répartir le coût de transport au mètre, **au prorata du poids**.

**Les délais que le calendrier ignore encore** : le chiffrier du plan porte 6 semaines de production,
90 à 120 jours, 6 semaines de bateau. La colonne `delai_jours` existe sur les matières et **ne sert
à rien pour l'instant** — la relier au calendrier est la reprise ERPNext la plus rentable.

## Emballage

| Fournisseur | Format | Par boîte | Prix unité | Shipping | Total |
| --- | --- | ---: | ---: | ---: | ---: |
| Uline | 10,5 × 16 po | 100 × 10 | **0,81 $** | 150,00 | 810,00 $ / 1 000 |
| **Uline Skid** | 10,5 × 16 po | 100 × 18 | **0,67 $** | 150,00 | 1 212,00 $ / 1 800 |
| EcoEnclose non brandé | 10,5 × 15 po | 100 × 15 | 1,02 $ | 446,25 | 1 522,61 $ / 1 500 |
| EcoEnclose brandé | 10,5 × 15 po | 100 × 15 | **1,42 $** | 446,25 | 2 133,08 $ / 1 500 |
| LP Aubut | enveloppe cartonnée rigide | — | 1,55 $ | — | — |

**La palette Uline est la moins chère à l'unité** (0,67 $ contre 0,81 $), et **le brandage EcoEnclose
coûte 0,40 $ de plus par colis** — soit 600 $ sur 1 500 envois. C'est un arbitrage de marque, pas de
logistique.

**Le packaging est hors du coût produit** dans les fiches COGS, comme le shipping client, les frais
marchands et les frais de vente et promo.

## Expédition au Canada

`donnees/tarifs-postes-canada.tsv` — trois formats, six destinations, deux tarifs par case (le second
est probablement le tarif majoré) :

| Colis | Poids | Trois-Rivières | Belleville ON | Roberval | Sutton | Winnipeg / Kamloops |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 paire — 10,5 × 15 × 1 po | 275 g | **9,96** | 9,80 | 12,70 | 13,52 | 13,87 / **15,67** |
| 2 paires — 10,5 × 15 × 2,75 po | 400 g | 11,57 | 11,38 | 15,59 | 16,59 | 16,51 / **27,48** |
| 3 paires — 12 × 6 × 6 po | 600 g | 11,57 | 11,38 | 15,59 | 16,59 | 16,51 / **27,48** |

**Deux paires et trois paires coûtent exactement le même prix.** Grouper à trois est gratuit dès
qu'on est passé à deux — un levier d'upsell qui ne coûte rien en logistique.

**L'Ouest coûte le double sur le tarif majoré** : 27,48 $ contre 11,38 $ vers l'Ontario. C'est le
poste qui décide si la livraison gratuite est soutenable par région.

Pour l'expédition réelle — étiquettes, suivi, tarifs en direct — c'est **ShipStation via le General
Proxy** (skill `proxygen`), pas ce fichier, qui n'est qu'un relevé.
