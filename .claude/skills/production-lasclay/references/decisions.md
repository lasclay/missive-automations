# Le besoin, ce qui reste à trancher, et le backlog

## Le besoin, tel qu'il a été exprimé

Repris des notes de cadrage, sans réécriture — c'est la référence quand on se demande si on
construit encore la bonne chose.

> Établir une stratégie d'inventaire pour planifier la production et faciliter la communication avec
> la Tunisie et nous à Québec.
>
> - Inventaire des matières premières ; les matériaux associés à chaque produit.
> - Calculateur : 1 produit = tissu associé, quincaillerie et fourniture associées, étiquette
>   associée, ou accessoire associé (ex. un étui de cell = une bandoulière).
> - Quantité prête, quantité planifiée à préparer, alerte de bas niveau d'inventaire.
> - Nomenclature standardisée pour les pièces, avec une description et une image associée.
> - Inventaire des produits, leur localisation, et la planification de la production.
> - Alertes de stocks bas, autant pour la matière que pour les produits finis.
> - Boîte de discussion pour y poser des questions : quel tissu pour ce produit, quel sens de coupe
>   du tissu, quelles couleurs pour ce tissu, quelles variantes.
> - Calendrier : c'est quoi les deadlines, les dates clés (prévente par exemple). Il faut que ce soit
>   dynamique. On peut y faire des mises à jour de production — en cours de prod (50 %), ce qui est
>   planifié vs la projection.
> - Il faut que ce soit un logiciel léger, la connexion est lente en Tunisie.
> - En français et arabe (?), puis anglais éventuellement.
> - Possibilité d'avoir des fiches produits complètes comme celle du Miro, mais version exhaustive ++++
> - Convertisseur HPGL. Version pour les patronnistes : références. Arbre des patrons et produits.
> - On veut que ce soit un outil complet.

## Où en est chaque besoin

| Besoin | État |
| --- | --- |
| Inventaire des matières premières | **construit** — stock = somme des mouvements, comptage, écarts |
| Matériaux associés à chaque produit | **construit** — 39 matières, 65 lignes de nomenclature au fichier (46 à l'import) |
| Calculateur « 1 produit = quoi » | **construit** — `/besoins`, par produit et tous ordres confondus |
| Quantité prête / planifiée / alerte bas niveau | **construit** — matières **et** produits finis |
| Nomenclature standardisée + description + image | **partiel** — description et image oui ; **la normalisation des SKU reste à décider** |
| Inventaire des produits et planification | **construit** |
| Localisation des produits | **absent** — aucune nomenclature d'emplacements (« palette nº 18 », « boîte B15 ») |
| Boîte de discussion contextuelle | **construit sur les ordres**, pas sur les produits — une réponse se perd quand l'ordre se termine |
| Calendrier dynamique, jalons, % d'avancement | **construit** — recalculé, jamais stocké |
| Planifié vs projection | **partiel** — le verdict compare des heures ; le **mode infini** donnerait une date contre une date |
| Logiciel léger | **construit** — pages sous 12 Ko, tableau de bord à 1,6 Ko |
| FR / AR / EN | **absent** — le champ de nom arabe existe sur les matières et **n'est pas rempli** ; l'interface n'est pas traduite |
| Fiches produits exhaustives ++++ | **à préparer** — voir `mrp/FICHES-PRODUITS.md` |
| Convertisseur HPGL | **construit** dans `patrons/`, pas branché sur l'app |
| Références patronnistes, arbre des patrons | **absent** — aucun inventaire du corpus, zéro patron rattaché aux 34 produits |

## Les dix questions ouvertes

Par ordre d'impact sur l'architecture.

### 1. Le périmètre de l'atelier — préparation, assemblage, ou les deux ?

**C'est la question qui décide si le plan 26-27 tient.** Du simple au double : 2 417 h, 3 829 h ou
5 311 h pour 4 320 h disponibles. Le défaut est « les deux », la lecture prudente, celle qui ne
rentre pas.

**Formulation exacte :** est-ce que les couturières de BMB font aussi la coupe, le matelassage et le
remplissage, ou est-ce que ça se fait ailleurs ? Ce n'est pas un calcul, c'est une question à poser.

### 2. La granularité de traçabilité par lot

Par lot partout (coût exact, rappel possible, saisie lourde) · FIFO automatique (saisie minimale,
pas de rappel ciblé) · **par famille d'articles** — la recommandation : obligatoire sur la fibre
d'asclépiade et les tissus, automatique sur les accessoires, fermetures, étiquettes et emballages.

Aucun MRP du marché n'offre cette granularité. C'est le premier argument du sur-mesure.

### 3. Les fiches poussées : dans le MRP, ou dans Miro ?

Si elles vivent dans le MRP, **Miro devient une source à importer une fois**. Si elles restent dans
Miro, le MRP n'a qu'à pointer dessus. Les deux se défendent ; la deuxième coûte moins cher et laisse
les fiches là où les gens les éditent déjà.

### 4. Une fiche par produit de production, ou par variante ?

Les mitaines polar en quatre coloris et cinq tailles font vingt variantes Shopify pour un seul
produit de production. **Le sens de coupe est commun ; la référence de tissu ne l'est pas.**

### 5. Qui édite une fiche ?

Aujourd'hui l'administration seulement. Un patronnier qui corrige un sens de coupe devrait-il
pouvoir écrire ?

### 6. La capacité réelle de l'atelier

20 postes est un chiffre **déclaré** en août 2026, affiché « équipe annoncée · non confirmée ici ».
Deux réserves : *20 personnes dans l'atelier* n'est pas *20 personnes qui cousent* (encadrement,
coupe, finition en font partie) ; et personne n'a dit si ces 20 sont chez **BMB**, chez **Grada**, ou
les deux réunis.

### 7. Le convertisseur HPGL, dans quel sens ?

Recevons-nous des `.plt` qu'il faut lire, ou produisons-nous des fichiers pour piloter un traceur en
Tunisie ? Ce n'est pas le même travail. Et si le logiciel des patronnistes accepte le **DXF-AAMA**,
c'est une bien meilleure cible que HPGL.

### 8. Les SKU

**195 variantes sur 906** en ont un, suivant au moins quatre conventions. Soit on généralise les SKU
dans Shopify, soit le MRP porte sa propre nomenclature et garde l'`id` de variante Shopify comme clé
de rapprochement. **La « nomenclature standardisée » demandée commence ici.**

### 9. Le stock négatif Shopify

**288 variantes** sont sous zéro. Est-ce « dû au client » ou « à recompter » ? Une stratégie
d'inventaire doit trancher.

### 10. ~~Le bandeau de la tuque beanie~~ — **tranché**

Longtemps listé comme trou du plan : 1 500 tuques de ville tricotées en Chine, aucune quantité pour
leur bandeau amovible fait à l'atelier. **Confirmé par Gabriel le 16/09/2026 : un bandeau par tuque,
donc 1 500, le tricot restant en Chine.** La ligne est dans `ajouts-production.tsv`.

`mrp/README.md` le signale encore comme « à confirmer » — le document est en retard sur la donnée.

## Le sens de coupe : combien de cas distincts ?

Question laissée sans réponse, et elle décide du niveau d'effort : **si c'est cinq règles, ce sont
cinq champs. Si c'est du cas par cas à chaque produit, il faut une vraie fiche technique.**

Aujourd'hui le sens de coupe est **une phrase dans `notes_tech`**. Une fiche poussée le *montre* :
un schéma, une flèche sur la pièce. Il faudrait un type de média « schéma technique », distinct des
photos studio et contexte.

## Qui saisit en Tunisie, et sur quoi ?

Un poste fixe, un téléphone, ou personne — et c'est Québec qui saisit d'après leurs messages ?
La réponse change l'ergonomie de toute l'app. L'hypothèse actuelle est **le téléphone** : sous
720 px le tableau devient une pile de blocs, le sélecteur d'avancement passe en grille de 6 colonnes,
aucun défilement latéral, boutons assez grands pour le pouce.

## Le backlog, par valeur

### Ce qui manque au schéma pour les fiches poussées

Depuis `mrp/FICHES-PRODUITS.md` — ce qu'une fiche « exhaustive ++++ » demande et qui n'a pas de
place aujourd'hui :

- **Le sens de coupe, illustré** — un type de média « schéma technique ».
- **Les cotes** — dimensions hors tout, tolérances. `produit_patrons.dimensions` est un texte libre,
  pas une donnée.
- **L'échantillon de tissu sur la variante** — le tissu montré, la référence fournisseur, la
  disponibilité. Et un avancement par variante, si l'atelier a besoin de déclarer « les noirs sont
  faits, pas les rouges ».
- **Les opérations d'assemblage, dans l'ordre** — les 35 temps chronométrés existent, rien ne les
  relie à un produit ni ne les met en séquence.
- **Les questions récurrentes et leurs réponses** — les commentaires existent sur les ordres, pas
  sur les produits.

État actuel des 34 fiches : description **32** · notes techniques **34** · photos **32** ·
matériaux **12** · patrons **0** · répartition taille/coloris **22** (139 lignes).

### Les quatre étapes du schéma v2

Depuis `mrp/SCHEMA-V2.md`. Le schéma v0.1 dérivé de Miro (20 tables PostgreSQL) est **bon comme
modèle, mauvais comme moteur** : on adopte le premier, on laisse le second — l'app reste sur
`node:sqlite`, zéro dépendance. Rien dans ce modèle n'exige PostgreSQL.

**Ce qui manque pour que ce soit vraiment un MRP** — les quatre tables qui font le M :

| Manquant | Ce qu'on ne peut pas répondre |
| --- | --- |
| `item` (matières, composants) | « combien de mètres de shell pour l'hiver ? » |
| `nomenclature` structurée | « le plan consomme quoi, en quelle quantité ? » |
| `stock` / `mouvement_stock` complets | « qu'est-ce qu'on a déjà en Tunisie ? » |
| `demande` + `ordre_planifie` | **« quand faut-il passer la commande de coton ? »** |

L'ordre de construction, chacune livrable et utile seule, aucune ne casse ce qui tourne :

1. **Référentiels et items** — `uom`, `couleur`, `echelle_taille`, `taille`, `patron`, `item`,
   `variante`. Alimentés depuis `shopify-variantes.tsv` et `fournisseurs.tsv`. *Gain : le catalogue
   des variantes vendables cesse d'être déduit des lots ; le patron partagé cesse d'être recopié.*
2. **Nomenclature** — avec les **deux scopes** sur la ligne (substitution et quantité par taille) et
   la vue résolue. Alimentée par relecture de la charte : 196 lignes de phrases deviennent des lignes
   chiffrées. **C'est l'étape qui demande du travail humain** : les quantités par taille n'existent
   nulle part, il faut les mesurer ou les estimer. *Gain : le besoin matière du plan, par matière et
   par couleur.*
3. **Gammes** — `operation` avec `site_id` et `parametres`. Absorbe `charte.parametre` (presse
   170 °C / 45 s), la note « rembourrage au Canada », et surtout `charge.js` où les temps unitaires
   vivent en constantes et en TSV séparés. *Gain : la cédule cesse de dépendre d'un périmètre choisi
   à la main.*
4. **Le MRP proprement dit** — `stock`, `mouvement_stock`, `demande`, `calcul_mrp`,
   `ordre_planifie`. *Gain : quoi acheter, quand.*

**Les quatre bonnes idées du schéma v0.1, à garder telles quelles :**

- **Tout est un `item`** — matière, composant, étiquette, semi-fini, produit fini dans une seule
  table. C'est ce qui rend la nomenclature multi-niveaux possible sans table spéciale, et ce qui
  permet à l'oreiller d'avoir une housse cousue en Tunisie comme semi-fini et un produit fini
  rembourré au Canada.
- **Le scope taille/couleur sur la ligne de nomenclature** — la meilleure idée du fichier. Deux
  usages, tous deux réels ici : *substitution* (le vert est en coton 12 oz, les autres couleurs en
  10 oz — constaté sur le sac à lunch, la besace, le tote bag et la glacière : c'est une règle, pas
  un cas) et *quantité par taille* (un XL ne consomme pas ce que consomme un M — **sans ça, un
  besoin matière calculé sur les 26 133 unités du plan est faux de plusieurs pour cent**).
- **`operation.site_id`** — le site est porté par l'opération, pas par le produit. Aujourd'hui
  « le rembourrage se fera au Canada » est une note qu'aucun calcul ne lit.
- **Le patron est une entité partagée**, pas un attribut de produit.

**Ce qu'il ne faut PAS prendre :** `point_controle` (`libelle` + `criticite` + `ordre`) est une
**régression** — `qc_points` fait déjà plus : cote, tolérance, unité, règle d'échantillonnage,
portée par variante, schéma de cote, conséquence, protocole général, lien vers les bris. Et
`variante` (le catalogue vendable) **n'est pas** `item_variantes` (la répartition d'un lot) : ce sont
deux objets différents, il faut les deux.

**Ce qui manque au fichier v0.1 :** aucune trace des bris (`qc_bris` et ses photos — c'est la moitié
du contrôle qualité tel qu'il est construit, et celle qui vient du terrain) · aucune trace de
l'avancement (le fichier planifie, il ne suit pas) · `site` ne distingue pas **BMB de Grada** ·
pas de devise sur `operation`, alors que le prix d'assemblage BMB est en dollars par unité et pilote
la moitié du calcul de charge.

### Les trois reprises d'ERPNext, par valeur

1. **La matière contraint la production** — relier `delai_jours` et le manque de matière au
   calendrier. *C'est ce qui distingue un MRP d'un calendrier.*
2. **L'ordonnancement à rebours** — « le conteneur part le 20, on commence quand ». Avec le repli
   avant en cas d'échec.
3. **Le mode infini** — le rapport de surcharge en une date au lieu d'un solde d'heures.

Aucune ne demande un nouveau moteur : ce sont des variations de `charge.calendrier()`.

### Le reste

- **L'avancement par variante n'existe pas.** Si l'atelier a besoin de déclarer « les noirs sont
  faits, pas les rouges », c'est la première chose à ajouter.
- **Aucun stock n'est chargé.** Les 36 matières engagées sont « jamais comptées ». `/besoins` donne
  l'ordre dans lequel s'y prendre, le plus engagé d'abord.
- **`?format=jpg` divise le poids des images par cinq** (33 → 7 Ko pour un cache-cou en 320 px) —
  le plus gros gain qui reste sur la connexion tunisienne. Le seul risque est que la conversion
  aplatisse la transparence : sans danger sur une photo produit. **La démo s'en sert déjà**
  (`?width=320&format=jpg` dans `build-demo.js`) sans défaut visible, ce qui lève l'essentiel du
  doute. L'app ne le demande toujours pas — c'est un feu vert à donner, pas une étude à faire.
- **Le calendrier ne montre que ce qui a un temps connu.** Un item sans temps unitaire n'occupe
  aucune journée ; le verdict le chiffre à part, la grille ne peut pas le placer. **Les chronométrer
  est le seul moyen de trancher.**
- **Le suivi par opération** (coupe, matelassage, remplissage) — savoir qu'un lot est « coupé mais
  pas matelassé » changerait la conversation. Volontairement hors de cette version : à revoir après
  quelques semaines d'usage réel.
- **Traduction de l'interface FR/AR/EN** — volontairement hors de cette version.

## Le principe qui tranche les arbitrages

**Un chiffre faux est pire que pas de chiffre du tout.** C'est ce qui explique la plupart des
décisions de conception déjà prises : l'atelier seul déclare l'avancement, une matière jamais comptée
n'est pas en rupture, un item sans temps n'est pas à zéro heure, les valeurs de cyclage sont écrites
`À FIXER`, les six contradictions de sources s'affichent au lieu d'être tranchées en silence, et les
douze lignes de chiffrier qui se contredisent sont nommées plutôt que moyennées.
