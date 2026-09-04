---
name: shopify
description: Boutique Shopify de Lasclay (lasclay.myshopify.com) — tout ce qui se joue dans l'admin : produits et variantes, poids d'expédition, profils et tarifs de livraison, collections, commandes, clients, stock, métachamps, thème. Contient la stratégie de poids arbitraire qui pilote le tarif « timbre » à 2,99 $ de Postes Canada — la règle la plus facile à briser sans s'en apercevoir.
when_to_use: Déclenche dès qu'il est question de Shopify, d'un produit, d'une variante, d'un poids, d'un SKU, d'un prix, d'une collection, d'un profil de livraison, d'un tarif d'expédition, du stock, d'une carte-cadeau, d'un métachamp ou du thème. Déclenche même sans nommer Shopify — « crée le produit X », « mets ça en prévente », « pourquoi la livraison affiche 6,99 au lieu de 2,99 », « ce produit part-il en timbre ou en colis », « le connecteur a créé les produits à 0 g », « change le prix des semelles », « ajoute ça à la collection Noël ».
argument-hint: [ce que tu veux faire dans Shopify]
allowed-tools:
  - mcp__Shopify__search_products
  - mcp__Shopify__get-product
  - mcp__Shopify__update-product
  - mcp__Shopify__create-product
  - mcp__Shopify__search_collections
  - mcp__Shopify__get-collection
  - mcp__Shopify__add-to-collection
  - mcp__Shopify__list-orders
  - mcp__Shopify__get-order
  - mcp__Shopify__get-inventory-levels
  - mcp__Shopify__get-shop-info
  - mcp__Shopify__graphql_query
  - mcp__Shopify__graphql_mutation
  - mcp__Shopify__graphql_schema
  - mcp__Shopify__validate_graphql_codeblocks
  - mcp__Shopify__search_docs_chunks
  - Bash(node shopify_check.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# Shopify — boutique Lasclay

N'explore pas le dépôt pour retrouver comment joindre Shopify : tout est ci-dessous.

## La boutique en bref

| | |
| --- | --- |
| Domaine | `lasclay.myshopify.com` → `lasclay.com` |
| Devise | CAD, prix en `X,99` |
| Langues | FR (défaut) et EN, via **langify** — d'où le produit fantôme `langify_image_container`, à ne jamais toucher |
| Catalogue | ~500 variantes au profil général, beaucoup de produits archivés ou brouillons hérités de 2020-2023 |
| Exercice fiscal | 1er sept → 31 août (voir skill `qbo`) |

Le catalogue traîne dix ans d'historique : doublons « Ancienne version », « IMPARFAIT », « Échange -
Grandeur », préventes closes, combos en brouillon. **Filtre toujours sur `status:active` avant de
conclure quoi que ce soit sur « le catalogue »** — sinon tu comptes des fantômes.

## Trois chemins d'accès — ne prends jamais le plus étroit pour le plus large

**Avant d'écrire qu'une chose est impossible dans Shopify, tu DOIS avoir lu la couche 3.** Sans ça,
tu n'as pas constaté une limite, tu as constaté ton ignorance.

| # | Couche | Ce que ça vaut comme preuve |
| --- | --- | --- |
| 1 | Outils MCP dédiés (`search_products`, `update-product`, `create-product`…) | **aucune.** Ce sont des raccourcis sur une poignée de champs, pas une frontière |
| 2 | `graphql_query` / `graphql_mutation` sur l'Admin API | à peu près tout l'admin : poids, profils de livraison, métachamps, pages, traductions, marchés |
| 3 | `graphql_schema('Mutation')` puis `graphql_schema('<InputType>')` | le vrai plafond, et la seule façon honnête de dire « ça n'existe pas » |

La bonne formulation n'est jamais « Shopify ne peut pas ». C'est « l'outil dédié ne l'expose pas,
l'Admin API le permet, voici la mutation ».

Cas typique : les outils MCP `create-product` / `update-product` **ne touchent pas au poids**. Le
poids vit sur `inventoryItem.measurement.weight` et se change par `productVariantsBulkUpdate`. Un
produit créé par l'outil dédié naît donc **à 0 g** — et 0 g, ici, n'est pas neutre (voir plus bas).

```
# Workflow mutation : schéma → construire → valider → exécuter
graphql_schema('Mutation')  →  graphql_schema('ProductVariantsBulkInput')
                            →  validate_graphql_codeblocks  →  graphql_mutation
```

### Le connecteur MCP est une surface de session

Le connecteur Shopify est authentifié pour **cette session interactive**. Une Routine, un cron
Render ou `support.js` ne l'ont pas : côté serveur, l'accès Shopify passe par l'app
« Render connector » en client credentials (`SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET`, portées
en lecture + `write_merchant_managed_fulfillment_orders`). Détails et étapes : `SHOPIFY_SETUP.md`.
Vérification en lecture seule d'une commande, sans le connecteur :

```bash
node shopify_check.js L-50468      # statut réel, suivi, état du colis
```

C'est la même leçon que le skill `composio` : ne bâtis jamais une automatisation non surveillée
sur un connecteur de session.

---

## Le poids n'est PAS un poids

C'est la règle centrale de cette boutique, et celle qu'on brise sans s'en apercevoir.

Le champ « poids » d'une variante ne décrit pas la masse de l'objet. C'est un **jeton de
tarification** qui décide quel tarif de livraison Postes Canada s'affiche à la caisse, et combien
d'unités tiennent dans une enveloppe.

### Le tarif qui commande tout

Zone **Canada** du **Profil général** :

| Tarif | Prix | Condition |
| --- | --- | --- |
| **Stamp / timbre (0 tracking)** | **2,99 $** | `poids total ≤ 73 g` |
| Standard | 6,99 $ | sous-total 0 $ – 98,58 $ |
| Express | 9,99 $ | sous-total 0 $ – 98,58 $ |
| Express | gratuit | sous-total ≥ 98,59 $ |

Le tarif timbre correspond au **timbre surdimensionné** de Postes Canada : 14″ × 9″ max, moins de
5 cm d'épaisseur, moins de 100 g réels, **aucun suivi**. Le seuil Shopify (73 g) est **arbitraire** :
il ne mesure pas la vraie masse, il sert de **budget d'enveloppe**.

### La formule

Pour un article qui **s'expédie en timbre** et dont on peut mettre **N** par enveloppe :

```
poids de la variante = ⌊ 73 / N ⌋ grammes
```

| N par enveloppe | Poids à inscrire | Vérif : N × poids | N+1 × poids |
| --- | --- | --- | --- |
| 1 | 73 g | 73 ≤ 73 ✓ | 146 ✗ |
| 2 | 36 g | 72 ≤ 73 ✓ | 108 ✗ |
| 3 | 24 g | 72 ≤ 73 ✓ | 96 ✗ |
| 4 | 18 g | 72 ≤ 73 ✓ | 90 ✗ |
| 5 | 14 g | 70 ≤ 73 ✓ | 84 ✗ |
| 6 | 12 g | 72 ≤ 73 ✓ | 84 ✗ |
| 7 | 10 g | 70 ≤ 73 ✓ | 80 ✗ |

Pour un article qui **s'expédie en colis** : **strictement plus que 73 g**. La convention maison
est un poids plausible et rond (100, 105, 130, 175, 195, 250, 300, 460, 1050 g) — jamais 74 g, qui
donne l'air d'un bogue. **Minimum 100 g** pour un colis.

### Les quatre pièges

1. **0 g n'est pas « poids inconnu », c'est « timbre, quantité illimitée ».** Une variante à 0 g
   laisse passer 40 unités à 2,99 $ sans suivi, quel que soit le prix du panier. C'est le mode
   d'échec par défaut de tout produit créé par API ou par le connecteur.
2. **Ne « corrige » jamais un poids vers la masse réelle.** Voir 25 g sur des semelles et le
   remonter à 90 g « parce que c'est le vrai poids » casse la tarification. Le poids est une
   décision commerciale, pas une mesure. En cas de doute : demande, ne mesure pas.
3. **Le seuil porte sur le poids TOTAL du panier**, pas sur l'article. C'est voulu : un panier qui
   mélange un article timbre et un article colis dépasse 73 g, le timbre disparaît, le Standard
   s'affiche. Idem si le client dépasse le N maximal. Le système s'auto-régule — à condition que
   chaque variante porte le bon jeton.
4. **Un article léger mais cher ou volumineux est le vrai danger.** Rien ne relie le poids au prix
   ni au volume : un article à 45 g facturé 179 $ part à 2,99 $ sans suivi. Avant de poser un poids
   ≤ 73 g, pose-toi la question de l'enveloppe : est-ce que ça entre vraiment à plat dans 14″ × 9″
   × 5 cm?

### Poids en usage aujourd'hui (repères)

| Poids | Articles | N par enveloppe |
| --- | --- | --- |
| 1–12 g | porte-clés et sous-verres en bois (1 g), illustrations, soie en vrac, sachets de graines, bijoux (10 g) | 6 et plus |
| 20–35 g | tuque sport, manchons, étui téléphone, bandeau (32 g), kit bandoulière, mitaines bébé | 2–3 |
| **24 g** | **savon glycérine à l'unité** — 3 par enveloppe (le paquet de 4 est un colis) | 3 |
| **25 g** | **semelles intérieures** — 2 par enveloppe, décision de sept. 2026 | 2 |
| 40–70 g | cache-cou (40 g), mitaine seule, cache-cou enfant (60 g), tuque de ville, gants magiques | 1 |
| 100 g + | tout le reste : mitaines, foulards, manteaux, t-shirts (200 g), couvertures, sacs, oreillers, cosmétiques | colis |

> **Le plafond est 73 g, pas 75.** La tentation récurrente est de le monter pour « faire entrer »
> un cas limite. Le cas qui la déclenche : 3 × 25 g de semelles = 75 g, donc 3 paires ne passent pas
> en timbre. **C'est le comportement voulu** — les semelles sont à 2 par enveloppe. Ne touche pas au
> plafond du tarif (`DeliveryMethodDefinition/771114205403`) : il est le dénominateur de tout le
> catalogue, le déplacer d'un gramme rejuge silencieusement chaque produit.

### Poser un poids

```graphql
mutation {
  productVariantsBulkUpdate(
    productId: "gid://shopify/Product/XXXX",
    variants: [
      { id: "gid://shopify/ProductVariant/YYYY",
        inventoryItem: { measurement: { weight: { value: 24, unit: GRAMS } } } }
    ]
  ) { productVariants { id title } userErrors { field message } }
}
```

Toutes les variantes doivent appartenir au même produit dans un même appel. `unit: GRAMS` toujours —
le catalogue contient de vieux enregistrements en `KILOGRAMS` (`0.3 kg`) qui se lisent mal.

### Auditer les poids

Le filtre `weight:` de l'API Shopify **n'est pas fiable** (il ignore l'unité et laisse passer des
1050 g dans un `weight:<74`). Ne t'y fie pas : tire les variantes et filtre côté client.

```graphql
query {
  products(first: 50, sortKey: CREATED_AT, reverse: true) {
    edges { node { id title status createdAt
      variants(first: 100) { edges { node { id title sku price
        inventoryItem { measurement { weight { value unit } } } } } } } }
  }
}
```

Trois signaux à traquer, dans cet ordre de gravité :

1. variante **ACTIVE à 0 g** → fuite de tarif en cours, tout part à 2,99 $ ;
2. variante **≤ 73 g sur un produit cher ou volumineux** → timbre non intentionnel ;
3. **une seule variante à 0 g** parmi des sœurs à 250 g → variante ajoutée après coup, oubliée
   (le cas classique : une taille 2XL ajoutée plus tard).

Balayage complet du catalogue ACTIVE (sept. 2026) : aucune variante à 0 g ne subsiste, sauf
`langify_image_container` — c'est le produit fantôme de langify, il doit rester tel quel.

---

## Profils de livraison

Cinq profils. Le poids ne compte que dans **Canada / Profil général** — partout ailleurs les
conditions portent sur le sous-total.

| Profil | ID | Portée |
| --- | --- | --- |
| **Profil général** | `66216853666` | défaut, ~500 variantes. Zones : Canada, États-Unis, Euro-FR (FR/BE/CH), UK, AUS+NZ, Mexico |
| Free Shipping échange/grandeur/retour | `81385947298` | 5 variantes — les produits « Échange - Grandeur / erreur » |
| Print | `92674588891` | illustrations : 1,99 $ ; Xpresspost 8 $ ; gratuit ≥ 149 $ |
| Speciosa Western only | `92732063963` | Ouest canadien |
| Speciosa Seeds | `95128518875` | Ouest canadien, gratuit |

Hors Canada, en bref : É.-U. 6,99 $ USD, gratuit ≥ 59,99 $ USD · Euro-FR 9,50 / 27 / 49 € ·
UK 15 / 24 / 39 £ · AUS+NZ 29 / 39 / 59 $ CAD · Mexique 9 / 19 $ USD.

Lire un profil en entier (zones, tarifs, conditions) :

```graphql
query { deliveryProfiles(first: 10) { edges { node { id name default
  profileLocationGroups { locationGroupZones(first: 10) { edges { node {
    zone { name countries { code { countryCode } } }
    methodDefinitions(first: 20) { edges { node { id name active
      rateProvider { ... on DeliveryRateDefinition { price { amount currencyCode } } }
      methodConditions { field operator conditionCriteria {
        ... on Weight { unit value } ... on MoneyV2 { amount currencyCode } } } } } } } } } } } } } }
```

Modifier un tarif : `deliveryProfileUpdate`. **Jamais sans demande explicite** — un tarif touche
toutes les commandes en cours.

---

## Créer ou modifier un produit — liste de vérification

Dans cet ordre. Le poids est l'étape qu'on oublie, et c'est celle qui coûte de l'argent.

1. **Statut** — `DRAFT` par défaut. Ne passe à `ACTIVE` que sur demande explicite : `ACTIVE` = en
   vente publique tout de suite.
2. **Poids de chaque variante** — timbre ou colis? Si timbre, combien par enveloppe? Applique
   ⌊73/N⌋. Si tu ne sais pas, **demande** : ne devine pas, et ne laisse surtout pas 0 g.
3. **Prix** — en `X,99`. Les variantes d'un même produit peuvent différer (grandeurs, formats).
4. **SKU** — convention maison `FAMILLE-ANNÉE-VARIANTE` (`INSOLES-23-8F-6M`, `CC-ENF-5A14A-NR`,
   `SCARF22-60P-BK-1`). Beaucoup de produits récents n'en ont pas ; ajoute-en si tu en crées un.
5. **Suivi du stock** — `inventoryItem: { tracked: true }`. Sans ça `set-inventory` ne fait rien.
   Un inventaire négatif = prévente en survente assumée, ce n'est pas un bogue.
6. **Étiquettes** — `prevente`, `no-returns` (cosmétiques), `imparfait`, `cosmetiques`,
   `huile-asclepiade`, `Product-Collection-All`, `Winter`. Elles pilotent des collections
   automatiques et des règles de service client (voir skill `support`).
7. **Profil de livraison** — Profil général sauf illustrations (Print), semences (Speciosa) et
   produits d'échange.
8. **FR et EN** — le contenu EN passe par langify, pas par un champ Shopify natif. Un titre créé en
   FR reste non traduit tant que personne ne s'en occupe : signale-le, ne le laisse pas passer en
   silence.
9. **Collections** — `add-to-collection`, ou laisse les règles des collections intelligentes faire
   leur travail si l'étiquette est bonne.

Pour le texte du produit (titre, description, ton, SEO) : skills `copywriting-lasclay` et
`lasclay-seo`. Pour le contexte de marque : `lasclay-master`.

---

## Le reste de l'admin

| Besoin | Chemin |
| --- | --- |
| Commandes, statut, suivi | `list-orders` / `get-order` ; en lecture serveur `node shopify_check.js L-xxxxx` ; l'expédition réelle vit dans **ShipStation** → skill `proxygen` |
| Stock | `get-inventory-levels` / `set-inventory` (exige `tracked: true`) |
| Clients | `list-customers` ; pour répondre à un client → skill `support` |
| Collections | `search_collections`, `create-collection`, `update-collection` (règles intelligentes : TAG, VENDOR, TYPE, TITLE, VARIANT_PRICE) |
| Rabais | `create-discount` — demande toujours date de début et audience avant |
| Métachamps, pages, blogues, marchés, traductions, cartes-cadeaux | pas d'outil dédié → `graphql_query` / `graphql_mutation` |
| Analytique de ventes | `run-analytics-query` (ShopifyQL) ; pour les chiffres comptables → skill `qbo` |

## Garde-fous

- **Rien de public sans demande.** Passer un produit en `ACTIVE`, changer un prix, modifier un
  tarif de livraison, publier un rabais : ce sont des gestes visibles par les clients et parfois par
  les commandes déjà au panier. Demande d'abord.
- **Le poids se demande, ne se déduit pas.** Face à une variante à 0 g, la bonne réponse n'est
  jamais d'inventer un chiffre. Timbre ou colis? Combien par enveloppe? Deux questions, une réponse
  par produit.
- **Ne supprime jamais un produit, une variante ou une collection.** Archive (`ARCHIVED`). Les
  vieux produits portent l'historique des commandes et des retours.
- **`langify_image_container` et les produits « Échange - » ne sont pas de vrais produits.** Ne les
  compte pas, ne les corrige pas.
- **Une variante à 0 g sur un produit ACTIVE est une urgence, pas une coquette.** Signale-la tout de
  suite, même si elle n'était pas dans la demande.
