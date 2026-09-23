# Les produits — catalogue, conception, et les règles qui se répètent

**34 produits de production** (`donnees/correspondances.tsv`), **26 produits** décrits par la charte
Miro, **17 fiches COGS**, **23 prix d'assemblage BMB**. Un produit de production n'est ni une fiche
Shopify ni une ligne de plan : `correspondances.tsv` est la table qui relie les trois.

## Les règles de conception qui traversent le catalogue

Ce sont elles qu'il faut connaître avant les fiches. Chacune se retrouve sur plusieurs produits, et
chacune a une conséquence directe sur le modèle de données.

### 1. Le grammage de Vegeto est ce qui distingue deux produits par ailleurs identiques

| Grammage | Produits |
| --- | --- |
| **100 g** | chandail polar ; foulard (**deux couches**) |
| **150 g** | manteau 3 saisons, veste, mitaines polar, mitaines laine, tuque sport, bandeau, bandeau de tuque, cache-cou (adulte et 5-13 ans), cache-cou 18 mois-4 ans, semelles, coussin d'assise, sac de couchage 0 °C |
| **200 g** | manteau hivernal, mitaines plein air, mitaines cuir, mitaines bébé, sac à lunch, besace, tote bag, étui de téléphone |
| **250 g** | glacière, sac de couchage −18 °C |

**Le manteau hivernal et le manteau 3 saisons ne diffèrent que par ça et par deux détails** :
capuchon à élastique rond + Vegeto 200 g + intérieur soft shell d'un côté ; col polar + Vegeto 150 g
+ intérieur toile de polyester de l'autre. **La veste sans manche est le manteau 3 saisons sans les
manches** — même matières, même isolant, mêmes garnitures.

C'est ce qui a permis de trancher l'inversion des handles Shopify (voir plus bas) : la charte
départage là où les photos hésitaient.

### 1bis. Deux coloris produits que la charte ne documente pas

Le plan 26-27 fabrique **six** coloris de sac à lunch, besace et tote bag ; la
charte Miro en décrit **cinq**. Le croisement des deux sources donne :

| Plan de production | Charte Miro | Lecture |
| --- | --- | --- |
| Jaune · Rouge · Vert · Noir | idem | concordant |
| **Casonnade** | **beige** | même coloris, deux noms |
| **Rose** | *absent* | **produit sans fiche** — 55 sacs à lunch, 9 besaces, 10 totes |
| *(étui)* Beige | *(étui)* Caramel | même coloris, deux noms |

**Le rose est le cas qui coûte.** Soixante-quatorze pièces sont au plan, et la
charte ne dit pas s'il se coupe en 10 ou en 12 oz — or l'épaisseur du coton
dépend précisément de la couleur. **À faire trancher.**

Les trois lignes de charte portent maintenant la divergence, plutôt que de
choisir une source en silence.

### 2. Le coton change d'épaisseur selon la couleur

**12 oz en vert, 10 oz dans toutes les autres couleurs.** Constaté sur le **sac à lunch**, la
**besace**, le **tote bag** et la **glacière** — quatre produits, donc une règle, pas un cas.

**C'est la justification principale du « scope couleur » sur la ligne de nomenclature.** Sans lui,
le besoin matière confond deux articles distincts. L'étui de téléphone et le coussin, eux, sont en
12 oz quelle que soit la couleur.

### 3. Un patron est partagé entre produits

**« Patron mitaine polar » sert à MIT-POLAR, MIT-LAINE et MIT-CUIR** — la charte l'écrit trois fois.
Aujourd'hui `produit_patrons` est une table par produit : le même patron y serait recopié trois
fois et corrigé une seule. **Le patron doit être une entité, pas un attribut.**

Le suivi Tunisie va plus loin : « Mitaines urbaines POLAR/LAINE/CUIR — même patron pour les trois
matières ». Trois fiches Shopify, un patron, trois nomenclatures différentes.

### 4. Quatre formats d'étiquette, et deux trous

| Étiquette | Portée |
| --- | --- |
| **Lasclay 1,5 × 4,5 cm** | vêtements — manteau hivernal, 3 saisons, veste, chandail |
| **Lasclay 2,6 × 7,5 cm** | sacs — sac à lunch, besace, coussin, sac de couchage (les deux) |
| **Pliée Lasclay** | petites pièces — mitaines (toutes), gants magiques, tuque sport, tuque de ville, bandeau, étui, oreiller, oreiller de camping, cache-cou 18 mois-4 ans |
| **Cache-cou / foulard** | spécifique — cache-cou adulte, cache-cou 5-13 ans, foulard |

**Deux `À CONFIRMER` dans la charte** : le **tote bag** et la **glacière** n'ont pas d'étiquette
attribuée. Les **semelles n'ont aucune étiquette textile** — leur emballage est un manchon de carton
plié et collé au ruban.

### 5. Un réglage machine identique sur deux produits

**Presse : 170 °C, 45 secondes** — semelles (les deux pointures) et coussin d'assise. C'est le seul
`parametre` de la charte, et c'est exactement ce que `operation.parametres` doit porter dans le
schéma v2, plutôt qu'une note qu'aucun calcul ne lit.

### 6. Un seul produit se fabrique sur deux sites

**L'oreiller** : la housse est cousue en Tunisie, **le rembourrage se fait au Canada**. C'est écrit
en majuscules dans la charte, et c'est aujourd'hui une note que rien ne calcule. C'est la
justification de `operation.site_id` — le site appartient à l'opération, pas au produit.

L'oreiller est aussi le seul produit à porter une **exigence de certification** : OEKO-TEX
Standard 100, *si disponible*.

### 7. La norme enfant : aucune pièce détachable

Le **cache-cou 18 mois-4 ans** n'a **ni élastique, ni cord-lock, ni bille, ni boutonnière** —
contrairement à l'adulte **et** au 5-13 ans, qui les gardent. Une seule garniture : l'étiquette
pliée. Motif écrit dans la charte : *un cord-lock et une bille sur un cou de 18 mois, c'est un
risque d'étouffement.*

Les deux tailles enfant ont un **patron propre, distinct de l'adulte — ce n'est pas l'adulte
rapetissé** — et sont en **noir uniquement**, là où l'adulte garde ses cinq coloris.

**La règle exacte est « aucune pièce ne doit être DÉTACHABLE », pas « aucun cord-lock ».** Le
tableau Miro le dit mot pour mot sur la frame de vérification des mitaines bébé, et c'est ce qui
explique la différence de traitement : le bébé **garde** son cord-lock, mais la vérification exige
que *« lacet et élastique soient bien attachés au cord-lock »* et que *« les élastiques soient bien
pris dans la couture d'assemblage »*. Sur un cou de 18 mois, la pièce est **retirée** plutôt que
sécurisée — le risque n'est pas le même au poignet et au cou.

### 8. Deux modèles sur un patron

**Le bandeau** existe en **torsadé (5 coloris)** et en **sport (noir)** — même patron. C'est
l'explication la plus probable de l'écart de répartition **2 100 contre 1 800** au plan : le modèle
sport s'ajouterait aux cinq coloris torsadés. **À confirmer.**

Ne pas confondre avec le **bandeau de la tuque urbaine**, qui est un produit différent : c'est la
doublure intérieure de la tuque tricotée en Chine.

## Le catalogue

`fabrication` dit où la pièce se fait : un produit `chine` n'apparaît pas dans *À fabriquer*.
`famille` pilote le tri (hiver → nouveau → isotherme/sacs → autre).

| Code | Produit | Famille | Plan | Prévente | BMB $/u | COGS $/u | Confiance |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `CACHE-COU` | Cache-cou adulte | hiver | 3 500 | 34 | 3,00 | 9,13 | sûr |
| `CACHE-COU-ENF-18M4A` | Cache-cou enfant 18 mois-4 ans | hiver | 100 | — | — | — | non vendu |
| `CACHE-COU-ENF-5A13A` | Cache-cou enfant 5-13 ans | hiver | 100 | — | — | — | non vendu |
| `BANDEAU` | Bandeau (torsadé + sport) | hiver | 1 800 | 31 | 2,50 | 4,44 | à confirmer |
| `BANDEAU-TUQUE` | Bandeau tuque urbaine | hiver | 1 500 | — | 2,50 *(plancher)* | — | non vendu |
| `TUQUE-SPORT` | Tuque sport | hiver | 700 | 19 | 4,00 | 7,11 | sûr |
| `TUQUE-VILLE` | Tuque de ville | hiver | 1 500 | 30 | — | — | **non produit (Chine)** |
| `FOULARD` | Foulard | hiver | 600 | 10 | 5,00 | 11,19 | sûr |
| `MIT-PLEIN-AIR` | Mitaines plein air | hiver | 2 000 | 37 | 4,00 | 14,90 | sûr |
| `MIT-POLAR` | Mitaines polar | hiver | 1 500 | 18 | 4,00 | 11,13 | à confirmer |
| `MIT-LAINE` | Mitaines laine | nouveau | 200 | 15 | 5,00 | 12,13 | à confirmer |
| `MIT-CUIR` | Mitaines cuir | nouveau | 400 | 45 | 6,00 | 22,90 | à confirmer |
| `MIT-BEBE` | Mitaines bébé 0-2 | hiver | 200 | 5 | 3,00 | 7,47 | sûr |
| `GANTS-MAGIQUES` | Gants magiques | hiver | 2 500 | 340 | 3,00 | 3,00 | sûr |
| `SEMELLE-678` | Semelles 6-7-8F | hiver | 2 179 | 53 | 2,50 | 3,54 | partiel |
| `SEMELLE-9` | Semelles 9F+ | hiver | 2 486 | 60 | 2,50 | 3,97 | partiel |
| `MANTEAU-HIVER` | Manteau hivernal | nouveau | 150 | 18 | 28,00 | 79,17 | sûr |
| `MANTEAU-3SAISONS` | Manteau 3 saisons | hiver | 125 | 9 | 28,00 | 79,17 | sûr |
| `VESTE` | Veste sans manche | hiver | 160 | 23 | 28,00 | 79,17 | non couvert |
| `CHANDAIL` | Chandail polar | nouveau | 383 | 108 | 7,00 | 19,89 | sûr |
| `PANTOUFLES` | Pantoufles | hiver | — | — | — | — | non couvert *(écoulement)* |
| `SAC-LUNCH` | Sac à lunch | isotherme | 1 000 | 25 | 6,00 | 19,80 | à confirmer |
| `BESACE` | Besace | isotherme | 250 | 23 | 7,00 | 25,71 | sûr |
| `TOTE` | Tote bag | isotherme | 200 | 6 | 6,00 | 13,89 | sûr |
| `GLACIERE` | Glacière 30L | isotherme | 300 | — | 3,81 | 31,93 | sûr |
| `ETUI-TEL` | Étui de téléphone | isotherme | 500 | 18 | 2,50 | 6,86 | sûr |
| `MANCHON` | Manchon isotherme | isotherme | 0 | 28 | 2,43 | — | à confirmer |
| `SAC-VIN` | Sac à bouteille de vin | isotherme | 0 | 18 | 12,37 | — | non couvert |
| `COUSSIN` | Coussin d'assise | autre | 1 200 | 47 | 4,00 | 12,41 | sûr |
| `COUSSIN-ANIMAL` | Coussin pour animaux | nouveau | 150 | 7 | 9,02 | 9,02 | non couvert |
| `OREILLER` | Oreiller | nouveau | 250 | 91 | — | — | non couvert |
| `OREILLER-CAMPING` | Oreiller de camping | nouveau | 100 | 34 | 5,00 | — | sûr |
| `SAC-COUCHAGE-0` | Sac de couchage 0 °C | nouveau | — | — | — | 62,46 | partiel |
| `SAC-COUCHAGE-18` | Sac de couchage −18 °C | nouveau | 100 | 40 | 20,00 | 77,21 | partiel |

**Trois produits sont à 0 au plan mais ont de la prévente encaissée** — manchon (28), sac à vin (18)
— et le plan ne prévoit rien pour eux. À vérifier : prévente à honorer sur stock existant, ou trou
du plan ?

## Les fiches de conception, par famille

### Vêtements

**`MANTEAU-HIVER` — Manteau hivernal** · Vegeto **200 g**
Extérieur hard shell noir · intérieur **soft shell** noir · poche soft shell · col polar.
Garnitures : fermeture éclair avant · **3 fermetures de poche** · **capuchon à élastique rond** ·
velcro 3 cm · étiquette 1,5 × 4,5.

**`MANTEAU-3SAISONS` — Manteau 3 saisons** · Vegeto **150 g**
Extérieur hard shell noir · intérieur **toile de polyester** · poche polyester · col polar.
Garnitures : fermeture avant · **2 fermetures de poche** · **boutons pressions** · biais ·
étiquette 1,5 × 4,5. **Pas de capuchon.**

**`VESTE` — Veste sans manche** · Vegeto 150 g — **identique au 3 saisons**, sans les manches.
Aucune fiche COGS distincte : le coût de 79,17 $ est celui du manteau. *Dérivée du manteau ?* reste
une question ouverte.

**`CHANDAIL` — Chandail polar** · Vegeto **100 g**
Polar des deux côtés. Fermeture éclair avant **spirale (coil nylon) #4, non séparable, selon le
patron** · élastique rond · cord-lock · **biais élastique aux manches** · étiquette 1,5 × 4,5.
Pas de fiche COGS ; *sizing des autres tailles à faire*.

### Mitaines et gants

**`MIT-PLEIN-AIR`** · Vegeto **200 g** — extérieur shell noir, intérieur polar, **patch en faux
cuir** à la paume. Élastique plat · **lacet plat pour attacher les mitaines ensemble** · étiquette
pliée · étiquette de taille. Tailles XS à XL, **chez Grada Mode**.

**`MIT-POLAR`** · Vegeto 150 g — polar des deux côtés. Mêmes garnitures.
**`MIT-LAINE`** · Vegeto 150 g — laine des deux côtés. **Étiquette pliée seulement.** Patron polar.
**`MIT-CUIR`** · Vegeto **200 g** — extérieur cuir, intérieur laine. Patron polar.

**`MIT-BEBE` 0-2 ans** · Vegeto 200 g — extérieur shell, intérieur polar. **Sans pouce.** Élastique
rond · cord-lock + bille · lacet plat · étiquettes pliées. *Recherche de shell en cours.*
Voir l'alerte de sécurité en §7 des règles.

**`GANTS-MAGIQUES`** — **le seul produit isolé à la fibre recyclée**, pas au Vegeto : **4 à 5 g par
gant**, balance fournie. Étiquette pliée. Le plus gros volume de prévente du catalogue (340).

### Accessoires de tête et de cou

**`CACHE-COU` adulte** · Vegeto 150 g — viscose des deux côtés, **viseline pour renforcer la
boutonnière**. Étiquette cache-cou/foulard · élastique rond · cord-lock + bille · bille noire
(stopper). Cinq coloris.
**`CACHE-COU-ENF-5A13A`** — identique à l'adulte, **noir uniquement**, patron enfant propre.
**`CACHE-COU-ENF-18M4A`** — **aucune garniture détachable**, noir uniquement, patron enfant propre.

**`FOULARD`** · Vegeto **100 g en deux couches** — viscose des deux côtés, étiquette
cache-cou/foulard. C'est le produit dont le **mélange asclépiade/staple est le plus long** :
10 min 39 par foulard, pour 40 g.

**`BANDEAU`** · Vegeto 150 g — viscose des deux côtés, étiquette pliée. Deux modèles, un patron.
**`BANDEAU-TUQUE`** · Vegeto 150 g — **wadding noir // viseline**. Patron neuf, échantillon à
produire, cotes hors tout **8 × 44 cm max à valider**.
**`TUQUE-SPORT`** · Vegeto 150 g — polyester brossé des deux côtés, étiquette pliée + étiquette de
taille.
**`TUQUE-VILLE`** — **acrylique et coton, tricotée en Chine**. Étiquette pliée. Seul son bandeau
intérieur est fait en Tunisie.

### Semelles

**`SEMELLE-678` et `SEMELLE-9`** · Vegeto 150 g — **mylar · wadding noir (viseline) · mesh de TPU**.
Presse **170 °C / 45 s**. **Aucune étiquette textile** : manchon de carton plié et collé au ruban.

La ligne unique du chiffrier (4 665) est découpée au prorata des pointures, et le découpage est
justifié par le chronomètre : **2 min 23 la paire jusqu'au 8F, 3 min 35 à partir du 9F**, avec deux
fiches COGS distinctes (3,54 $ contre 3,97 $).

### Isothermes

Tous en **coton 12 oz vert / 10 oz autres couleurs**, sauf l'étui (12 oz partout).

**`SAC-LUNCH`** · Vegeto 200 g — intérieur **PVC** · étiquette 2,6 × 7,5 · webbing 2,5 cm · **boucle
side release**.
**`BESACE`** · Vegeto 200 g — intérieur **nylon bleu** · étiquette 2,6 × 7,5 · **D-ring** · webbing
2,5 cm · fermeture **spirale maille 5 ou 8, non séparable, 47 cm**.
**`TOTE`** · Vegeto 200 g — intérieur nylon · **étiquette À CONFIRMER** · webbing 2,5 cm ·
fermeture **spirale maille 3, non séparable, 20 cm**.
**`GLACIERE` 30L** · Vegeto **250 g** — intérieur PVC · **étiquette À CONFIRMER** · webbing **5 cm**.
**Plus de chanvre depuis le 09/09/2026** : il isolait le fond, c'est le Vegeto 250 g qui le fait
maintenant (−1,02 $/unité).
**`ETUI-TEL`** · Vegeto 200 g — coton 12 oz des deux côtés · étiquette pliée · fermeture **spirale
maille 3, non séparable, 18 cm** · **webbing 2,5 cm pour la ganse, 50 pouces** · lacet plat ·
**crochets 2,5 cm**. *1 étui = 1 ganse* — c'est l'exemple du « calculateur » demandé au départ.
**`COUSSIN`** · Vegeto 150 g — extérieur coton 12 oz, **intérieur shell noir (le même que les
mitaines)**, mesh de TPU. Presse **170 °C / 45 s** · étiquette 2,6 × 7,5 · webbing 2,5 cm · velcro
2,5 cm · **biais vert ou noir**.

### Couchage

**`SAC-COUCHAGE-0`** · Vegeto 150 g · **`SAC-COUCHAGE-18`** · Vegeto 250 g
Shell de nylon des deux côtés · étiquette 2,6 × 7,5 · **fermeture double curseur int/ext, spirale
maille 5, non séparable**.

⚠️ **`À RÉGLER` dans la charte** : le plan met **les deux chaleurs sous le seul code
`SAC-COUCHAGE-18`**, alors que `SAC-COUCHAGE-0` existe comme produit distinct. Un des deux est en
trop, ou la répartition est à déplacer. Les deux fiches COGS portent un `sous_traitance` (29,22 $ et
31,47 $) **mais aucun `assemblage`** — l'app prend donc le prix BMB (20 $) plutôt que de gonfler la
charge d'un montant qui couvre plus que la confection.

**`OREILLER`** — **coton 300 fils/po², 100 % percale, fil simple retors**, densité ~80 × 55 fils/cm,
grammage 140-150 g/m². Rembourrage : **standard 160 g de fibre + 160 g de soie d'asclépiade** ;
**king 350 g + 350 g**. Étiquette pliée · fermeture éclair blanche. **OEKO-TEX Standard 100 si
disponible.** **LE REMBOURRAGE SE FAIT AU CANADA.**
Seul corpus de patrons HPGL **auto-vérifiable** du parc (4 u/mm confirmé).

**`OREILLER-CAMPING`** — côté supérieur toile de polyester, côté inférieur **polar noir**, isolant
**fibre recyclée et retailles de vegeto**. Étiquette pliée.

## Les temps chronométrés

Huit familles seulement (`donnees/temps-operations.tsv`, 35 lignes). **Le chronomètre mesure la
préparation — coupe, matelassage, remplissage, mélange — jamais l'assemblage.**

| Produit | Total mesuré | Détail notable |
| --- | --- | --- |
| Cache-cou | ~17 min | matelassage 5:29 · remplissage 5:14 · **mélange 1:49 pour 17 g** |
| Tuque sport | ~2 min | coupe 0:57 · remplissage 1:05 · mélange 0:04 pour 5 g |
| Besace / sac à lunch | ~10 min | remplissage 6:31 · **mélange 1:41 pour 50 g** |
| Foulard | ~24 min | matelassage 5:00 · **mélange 10:39 pour 40 g** |
| Semelles 6-7-8F | **2:23 la paire** *(ligne Total)* | découpe 1:28 · remplissage 1:51 |
| Semelles 9F+ | **3:35 la paire** *(ligne Total)* | découpe 2:12 |
| Glacière | **13:28** *(ligne Total)* | remplissage 5:26 · collage/pressage 3:06 · mélange 3:22 |
| Mitaines polar | **27:42** *(Confection Lasclay)* | **déduit du coût** : 12,01 $ à 26 $/h, 80 % eff. |

**Une ligne « Total » l'emporte sur la somme des postes** — additionner les deux doublerait la durée.
**« Confection Lasclay » couvre déjà la couture** : on ne lui ajoute pas l'assemblage BMB.

Les chronos portent le nom de qui a mesuré et le nombre de mesures — Julia, Isabelle, Abygael, Noah,
Karen, Raul, Karla, Gab. Deux lignes sont marquées **estimé**, pas chronométré.

## Les divergences BMB ↔ COGS, non arbitrées

Sur 23 produits, **17 concordent**. Les six qui divergent sont affichés ligne par ligne dans l'app
plutôt que tranchés en silence :

| Produit | BMB | COGS | Lecture |
| --- | ---: | ---: | --- |
| `MIT-CUIR` | 6,00 | 17,07 | les trois mitaines pointaient vers **la même fiche COGS** « Mitaines polar » |
| `MIT-LAINE` | 5,00 | 17,07 | idem — un prix par produit vaut mieux qu'une fiche empruntée |
| `MIT-POLAR` | 4,00 | 17,07 | idem |
| `BANDEAU` | 2,50 | 0,87 | — |
| `SEMELLE-678` | 2,50 | 0,58 | — |
| `SAC-LUNCH` | 6,00 | 7,00 | — |

**Cinq produits n'ont un temps que grâce à BMB** — chandail, coussin pour animaux, étui, oreiller de
camping, sac de couchage −18 °C — et comptaient pour **zéro heure** avant l'extraction des notes
techniques par `tools/extrait_bmb.js`.

## Les marges, telles que les fiches COGS les donnent

| Produit | Vente | Coût | Marge brute |
| --- | ---: | ---: | ---: |
| Bandeau | 29,99 | 2,44 | **91,9 %** |
| Mitaines plein air | 99,99 | 14,90 | 85,1 % |
| Semelles 6-7-8F | 20,99 | 3,54 | 83,2 % |
| Tuque sport | 39,99 | 7,11 | 82,2 % |
| Mitaines bébé | 39,99 | 7,47 | 81,3 % |
| Gants magiques | 21,99 | 4,67 | 78,8 % |
| Foulard | 49,99 | 11,19 | 77,6 % |
| Cache-cou | 39,99 | 9,13 | 77,2 % |
| Manteau | 300,00 | 79,17 | 73,6 % |
| Tote bag | 39,99 | 13,89 | 65,3 % |
| Coussin d'assise | 34,99 | 12,41 | 64,5 % |
| Mitaines polar | 99,99 | 40,55 | 59,5 % |
| Glacière | 99,99 | 41,28 | 58,7 % |
| Sac de couchage −18 | 179,99 | 77,21 | 57,1 % |
| Sac de couchage 0 °C | 139,99 | 62,46 | 55,4 % |
| **Besace / sac à lunch** | 44,00 | 25,71 | **41,6 %** |

**La besace est de loin la marge la plus faible**, et c'est aussi la fiche dont la source est
douteuse : elle s'ouvre sur un onglet « Sac lunch ». Les deux produits partagent peut-être une seule
fiche COGS — à vérifier avant d'en tirer une décision de prix.

Structure de coût constante : `coût = matériaux (tissus & autres + isolant) + sous-traitance
(assemblage + douanes + logistique)`. **Hors coût produit** : packaging, shipping client, frais
marchand, frais de vente et promo.

## Les rattachements Shopify à surveiller

- **Les handles des deux manteaux étaient inversés depuis le début**, corrigé le 26/08/2026.
  Constaté sur les photos, confirmé par la charte : le manteau d'hiver a un capuchon et du Vegeto
  200 g, le 3 saisons un col polar et du 150 g. **C'est un cas où la charte a servi d'arbitre.**
- **Une fiche Shopify pour deux produits de production** : semelles (6-7-8F et 9F+), sacs de couchage
  (0 °C et −18 °C). Marqués `partiel`.
- **Les cache-cous enfant empruntent le handle de l'adulte** faute de fiche à eux. L'import prend
  alors le **nom de production** plutôt que le titre Shopify, sans quoi trois produits porteraient
  le même nom. **Les photos affichées sont celles de l'adulte — elles montrent du vert, alors que
  l'enfant est en noir uniquement.**
- **Des fiches d'écoulement à ne pas produire** : `cache-cou-dasclepiade-imparfait` (ancienne version
  non ajustable) et sa copie ; les pantoufles n'existent qu'en fiche IMPARFAIT.
- **Le bandeau a deux handles Shopify** — `headband` et `bandeau-copy` — et le COGS parle de deux
  modèles sur le même patron. **Lequel correspond à quoi n'est pas tranché.**
- **Le manchon a deux formats** (régulier/large et « canettes minces ») : un ou deux produits de
  production ?

## Ce qui casse, d'après le terrain

`donnees/bris-terrain.tsv` — 129 signalements, gardés **mot pour mot**. La zone la plus touchée, et
de loin :

| Zone | Signalements |
| --- | ---: |
| **couture de bretelle** | **10** |
| usure de la semelle | 4 |
| couture de la fermeture éclair | 3 |
| couture (générique) | 3 |
| rebord qui se défait · finition · défaut de fabrication | 2 chacun |

**Dix coutures de bretelle sur plusieurs produits différents, ce n'est pas un défaut de produit,
c'est un défaut de méthode** — et la charte porte déjà une vérification « bretelles renforcées ».
Quand les deux se rejoignent, c'est que la consigne existait et qu'elle n'a pas été tenue. Ça vaut
mieux qu'une consigne qui manquait.

Autres signalements parlants : *paire dépareillée — gauche et droite de grandeurs différentes* ·
*pli d'isolant à l'intérieur* · *se découd, l'asclépiade sort* · *trouée à la réception* ·
*étiquette absente sur une pièce*.
