# ShipStation — audit complet et dossier de clonage

**Date :** 31 juillet 2026 · **Compte audité :** Les Produits Lasclay Inc · **Méthode :** API v1
(`ssapi.shipstation.com`) via le General Proxy, en lecture seule + devis de tarifs, complétée par
une revue documentaire du produit.

Objectif : réunir tout ce qu'il faut pour **reconstruire l'outil sans abonnement**.

---

## 1. Résumé exécutif

**L'enjeu du projet n'est pas l'abonnement ShipStation — c'est le tarif de transport.**
L'abonnement coûte quelques centaines à quelques milliers de dollars par an. Le passage au tarif
**drop-off Canada Post à 6,31 $** via une plateforme courtier vaut, sur les 12 derniers mois
réels, **33 100 $ par an**. L'un est du bruit, l'autre est le projet.

Quatre constats.

**a) 80,5 % des envois pèsent moins de 500 g et coûtent aujourd'hui 11,24 $ en moyenne.**
Sur 12 mois (1ᵉʳ août 2025 → 31 juillet 2026) : 8 338 expéditions actives, **98 828 $ de
transport**, dont 75 498 $ pour les seuls colis sous 500 g. Au tarif drop-off de 6,31 $, cette
tranche tombe à 42 378 $ — **33 120 $ d'économie annuelle, soit 33,5 % de la facture de
transport**.

**b) Ce tarif est inaccessible au contrat commercial de Lasclay.** Christine Valin (Canada Post,
27 juillet 2026) est formelle : *« ce service n'inclut pas le ramassage et est offert que par
l'entremise de plate-forme d'expédition. Ce n'est pas offert pour les ententes commerciales. »*
Aller en direct sur l'API Canada Post avec le contrat `0005082011` donnerait donc les tarifs
d'aujourd'hui (≈ 9–11 $), pas 6,31 $. **La couche transporteur doit passer par un courtier —
ClickShip / Freightcom.**

**c) Le compte n'utilise qu'une fraction de ShipStation.** 99,6 % des envois partent chez Canada
Post, 98,6 % sur le seul service `expedited_parcel`. Purolator prend 34 envois sur 12 mois, UPS
un seul. Aucun tag utilisé, aucun cadeau, deux fusions sur 2 000 commandes. En revanche
**96 % des étiquettes sont achetées en lot** — c'est le cœur du flux.

**d) Ce qui reste à cloner est un outil de tri de backlog, pas un logiciel de transport.**
ShipStation gagne sur la grille : filtres, vues sauvegardées, Hold, tri, traitement par lot. C'est
précisément la couche à reconstruire ; le transport, lui, se sous-traite à l'API du courtier.

| Ce qu'on remplace | Difficulté | Remplacement |
|---|---|---|
| Achat d'étiquette et tarifs | moyenne | **API ClickShip / Freightcom** — c'est là qu'est l'argent |
| Import commandes Shopify / Etsy / Faire | moyenne | API des plateformes (déjà en place côté Shopify) |
| Grille, filtres, vues, Hold, lots | **c'est le cœur du clone** | applicatif web maison |
| Douanes / CN22 / facture commerciale | moyenne | généré par le courtier |
| Notifications client + page de suivi | faible | courriel maison + suivi du courtier |
| Manifeste fin de journée | **sans objet en drop-off** | le dépôt au comptoir remplace le ramassage |
| Portefeuille One Balance (UPS, FedEx, DHL, Purolator, Canpar) | élevée | non reproductible — mais 35 envois/an, voir §9 |

---

## 2. Ce que l'audit a mesuré sur le compte

### Volumétrie (API, 31 juillet 2026)

| Statut de commande | Total |
|---|---|
| `shipped` | 38 126 |
| `awaiting_shipment` | 412 |
| `cancelled` | 292 |
| `awaiting_payment` | 2 |
| `on_hold` | 2 |
| `pending_fulfillment` | 1 |
| **Commandes, tous statuts** | **38 835** |
| **Expéditions (avec étiquette)** | **19 671** |
| **Fulfillments (expédiés hors étiquette)** | **14 406** |

Le ratio est parlant : **près de 42 % des envois historiques n'ont pas d'étiquette ShipStation** —
ils sont marqués expédiés depuis une autre source. Un clone n'a donc pas à couvrir 100 % du flux
pour être utile.

### Cadence et dépense — 12 mois réels (expéditions du 1ᵉʳ août 2025 au 31 juillet 2026)

8 518 étiquettes émises, dont **8 338 actives** (75 annulées, 107 étiquettes de retour), pour
**98 828 $ de transport**.

| Mois | Expéditions | | Mois | Expéditions |
|---|---|---|---|---|
| 2025-08 | 270 | | 2026-02 | 1 011 |
| 2025-09 | 504 | | 2026-03 | 431 |
| 2025-10 | 382 | | 2026-04 | 288 |
| 2025-11 | 985 | | 2026-05 | 241 |
| **2025-12** | **2 755** | | 2026-06 | 142 |
| 2026-01 | 1 288 | | 2026-07 | 41 |

**Le pic est décembre** — 2 755 envois, soit un tiers de l'année en un mois — suivi de janvier et
février. Le creux est l'été : juin et juillet réunis font 183 envois, **quinze fois moins que
décembre**. Novembre à février concentre 72 % du volume annuel.

### Répartition par poids — la donnée qui décide

| Bande | Envois | Part | Coût moyen | Coût médian | Total 12 mois |
|---|---|---|---|---|---|
| **< 500 g** | **6 716** | **80,5 %** | **11,24 $** | 10,70 $ | **75 498 $** |
| 500 g – 1 kg | 1 213 | 14,5 % | 12,62 $ | 11,76 $ | 15 312 $ |
| 1 – 2 kg | 132 | 1,6 % | 14,64 $ | 13,25 $ | 1 932 $ |
| 2 – 5 kg | 241 | 2,9 % | 18,65 $ | 13,52 $ | 4 494 $ |
| > 5 kg | 36 | 0,4 % | 44,20 $ | 36,43 $ | 1 591 $ |

Quatre envois sur cinq entrent dans le programme Canada Post « envoi unique sous 1,1 lb (500 g) »
mentionné dans l'interface ClickShip. C'est exactement la cible du tarif drop-off.

### Ce qui est réellement utilisé

| Dimension | Observation |
|---|---|
| Transporteurs (12 mois) | `canada_post` **8 303** · `purolator_walleted` **34** · `ups_walleted` **1** |
| Destinations (12 mois) | Canada 8 308 · États-Unis 23 · France 5 · Belgique 1 · Chine 1 |
| Services | `expedited_parcel` 98,6 % · `xpresspost` 0,7 % · `priority` 0,3 % · `xpresspost_international` 2 envois |
| Types de colis | non renseigné 97,4 % · `package` 2,4 % · `customerpackage` 0,2 % |
| Confirmation | aucune 98,7 % · `signature` 0,9 % · `delivery` 0,3 % |
| Lots (`batchNumber`) | **96,1 % des étiquettes sont achetées en lot** — le traitement par lot est le cœur du flux |
| Étiquettes de retour | 1,9 % (57 sur 3 000) |
| Étiquettes annulées | 0,4 % (13 sur 3 000) |
| Assurance | 0,6 % (19 sur 3 000) |
| Destinations | Canada 99,9 %, France 2 envois |
| Entrepôts utilisés | `153232` LAS Capucins 85,6 % · `372441` Jean-Simon Bégin 14,1 % · `590291` Unique Plastique 0,4 % |

### Boutiques connectées

| storeId | Nom | Canal | Auto-refresh | Dernier import |
|---|---|---|---|---|
| 198670 | LAS Shopify | Shopify | oui | 2026-07-31 06:53 |
| 198711 | LAS Etsy | Etsy | oui | 2026-07-31 06:35 |
| 361089 | FAIRE Lasclay | Faire | oui | 2026-05-27 |
| 194366 | Manual Orders | ShipStation | non | 2025-06-02 |

Répartition des commandes récentes : Shopify 95,7 %, Manual Orders 4,1 %, Etsy 0,2 %, Faire 0,05 %.
Le champ `advancedOptions.source` révèle aussi `exchange`, `shopify_draft_order`, `pos` et `faire`.

### Entrepôts (*Ship From Locations*) — 5

`153232` LAS Capucins (254 boul. des Capucins, Québec) · `372441` Jean-Simon Bégin (photographe
animalier, Québec) · `463467` Lasclay JCC (Saint-Zacharie) · `590291` Unique Plastique (Lévis) ·
`601259` Monarch Botanika (Camarillo, Californie).

Chacun porte **deux adresses distinctes** : `originAddress` et `returnAddress`. Un clone doit
garder cette distinction — elle sert aux étiquettes de retour.

### Transporteurs configurés — 9

| Code | Nom | Compte | Type | Solde |
|---|---|---|---|---|
| `canada_post` | Canada Post (LASCLAY) | 0005082011 | **contrat direct** | — |
| `canada_post` | Canada Post (Rotule) | 0008084738 | contrat direct | — |
| `ups_walleted` | UPS by ShipStation | G98E98 | One Balance | 74,40 $ |
| `canpar_walleted` | Canpar One Balance | — | One Balance | 74,40 $ |
| `canada_post_walleted` | Canada Post One Balance | — | One Balance | 74,40 $ |
| `purolator_walleted` | Purolator One Balance | — | One Balance | 74,40 $ |
| `fedex_walleted` | FedEx One Balance | — | One Balance | 74,40 $ |
| `dhl_express_walleted` | DHL Express One Balance | — | One Balance | 74,40 $ |
| `shippingchimp` | ShippingChimp | operations@lasclay.com | tiers | — |

Les six comptes One Balance partagent **un seul portefeuille de 74,40 $** — ils sont revendus par
ShipStation et disparaissent avec l'abonnement.

### Tags de commande — 6

`10614` Timbre · `15051` Priority · `37367` Non expédié · `37675` Réexpédition ·
`37964` JSB traité par LASCLAY · `43269` Non expédiable avec Chit Chats.

Aucun n'est appliqué sur les 2 000 commandes récentes : la fonction existe, elle n'est pas
utilisée. Un clone peut la reporter en phase 2.

### Champs personnalisés

Ils **sont** utilisés, contrairement aux tags :

| customField1 | customField2 | customField3 | Occurrences |
|---|---|---|---|
| — | — | `LASCLAY` | 1 264 |
| — | `USA` | `LASCLAY` | 729 |

`customField3` porte la marque, `customField2` marque le flux USA. À reproduire.

### Tarifs réels obtenus en direct (Québec G1J3R4 → Toronto M5V2T6, 500 g, 12×6×6 po)

| Transporteur | Service | `serviceCode` | Tarif | Autres frais |
|---|---|---|---|---|
| Canada Post | Expedited Parcel (Carbon Neutral) | `expedited_parcel` | **9,09 $** | 4,52 $ |
| Canada Post | Xpresspost | `xpresspost` | 10,56 $ | 5,25 $ |
| Canada Post | Priority | `priority` | 17,05 $ | 8,48 $ |
| Purolator | Ground | `purolator_ground` | 10,99 $ | 4,35 $ |
| Purolator | Express | `purolator_express` | 16,76 $ | 6,18 $ |
| Purolator | Express 10:30 | `purolator_express_1030am` | 24,02 $ | 9,86 $ |
| Purolator | Express 9 AM | `purolator_express_9am` | 31,07 $ | 12,30 $ |
| UPS | Standard | `ups_standard` | 12,82 $ | 1,31 $ |
| UPS | Expedited | `ups_2nd_day_air` | 20,19 $ | 2,07 $ |
| UPS | Express Saver | `ups_next_day_air_saver` | 21,96 $ | 2,25 $ |
| UPS | Express | `ups_next_day_air` | 25,80 $ | 2,64 $ |
| UPS | Express Early | `ups_next_day_air_early_am` | 46,08 $ | 4,72 $ |
| FedEx | Ground | `fedex_ground` | 12,95 $ | 6,31 $ |
| FedEx | Economy / 2Day / Standard Overnight | `fedex_economy`, `fedex_2day`, `fedex_standard_overnight` | 37,34 $ | 17,68 $ |
| FedEx | Priority Overnight | `fedex_priority_overnight` | 41,07 $ | 19,44 $ |
| FedEx | First Overnight | `fedex_first_overnight` | 113,28 $ | 53,63 $ |
| Canpar | Ground | `ground` | 13,18 $ | 9,44 $ |
| Canpar | Select | `select` | 31,65 $ | 15,36 $ |
| Canpar | Express | `express` | 32,24 $ | 15,55 $ |

Vers les États-Unis (G1J3R4 → 10001, 500 g), Canada Post en direct :

| Service | `serviceCode` | Tarif |
|---|---|---|
| Small Packet Air – USA | `small_packet_air_usa` | 13,05 $ |
| Tracked Packet – USA | `tracked_packet_usa` | 13,05 $ |
| Expedited Parcel USA | `expedited_parcel_usa` | 21,75 $ |
| Xpresspost USA | `xpresspost_usa` | 32,91 $ |

Deux anomalies notées : `canada_post_walleted` ne retourne **aucun service** (compte One Balance
inactif) et `dhl_express_walleted` répond `No applicable services were available for the configured
shipment`. Ces deux comptes sont morts — rien à cloner de ce côté.

---

## 3. Surface API v1 complète

Base `https://ssapi.shipstation.com`, auth **HTTP Basic** `base64(API_KEY:API_SECRET)`,
**limite 40 requêtes/minute** (en-tête `X-Rate-Limit-Reset` = secondes avant réarmement).
Pagination : `page` + `pageSize` (max 500), réponse `{ total, page, pages }`.

| Ressource | Endpoints |
|---|---|
| Orders | `GET /orders`, `GET /orders/{id}`, `GET /orders/listbytag`, `POST /orders/createorder`, `POST /orders/createorders` (lot), `DELETE /orders/{id}`, `POST /orders/addtag`, `/removetag`, `/holduntil`, `/restorefromhold`, `/markasshipped`, `/assignuser`, `/unassignuser`, `/createlabelfororder` |
| Shipments | `GET /shipments`, `POST /shipments/createlabel`, `POST /shipments/getrates`, `POST /shipments/voidlabel` |
| Fulfillments | `GET /fulfillments` |
| Carriers | `GET /carriers`, `/carriers/getcarrier`, `/carriers/listservices`, `/carriers/listpackages`, `POST /carriers/addfunds` |
| Products | `GET /products`, `GET /products/{id}`, `PUT /products/{id}` |
| Customers | `GET /customers`, `GET /customers/{id}` |
| Stores | `GET /stores`, `/stores/{id}`, `/stores/marketplaces`, `/stores/getrefreshstatus`, `POST /stores/refreshstore`, `PUT /stores/{id}`, `/deactivate`, `/reactivate` |
| Warehouses | `GET /warehouses`, `/warehouses/{id}`, `POST`, `PUT`, `DELETE` |
| Users | `GET /users` |
| Webhooks | `GET /webhooks`, `POST /webhooks/subscribe`, `DELETE /webhooks/{id}` |
| Account | `GET /accounts/listtags`, `POST /accounts/registeraccount` |

Une **API v2** existe (`https://api.shipstation.com/v2`, en-tête `API-Key`) avec des ressources
absentes de la v1 — `/v2/labels`, `/v2/manifests`, `/v2/batches`, `/v2/inventory`, `/v2/rates`,
`/v2/tracking`. Elle n'est pas branchée sur ce compte ; sa structure reste utile comme modèle
d'architecture pour le clone (voir §8).

**Ce que l'API ne donne pas** — et qu'il faut donc reconstruire à l'aveugle : les règles
d'automatisation, les gabarits de bordereau, les paramètres de marque, les vues sauvegardées, la
configuration des notifications, les lots eux-mêmes (seul le `batchNumber` transparaît), les
manifestes de fin de journée et les rapports Analytics.

### Webhooks disponibles

`ORDER_NOTIFY` (nouvelle commande) · `ITEM_ORDER_NOTIFY` (au niveau article) · `SHIP_NOTIFY`
(étiquette créée) · `ITEM_SHIP_NOTIFY` · `FULFILLMENT_SHIPPED` · `FULFILLMENT_REJECTED`.
La charge utile ne contient **pas** la donnée : elle donne un `resource_url` à rappeler en GET
authentifié. Modèle simple à reproduire tel quel.

---

## 4. Modèle de données (relevé sur les charges utiles réelles)

### Order

```
orderId (int, PK interne)   orderNumber (visible)   orderKey (clé externe, upsert)
orderDate  createDate  modifyDate  paymentDate  shipByDate
orderStatus ∈ awaiting_payment | awaiting_shipment | pending_fulfillment | shipped | on_hold | cancelled
customerId  customerUsername  customerEmail
billTo{}  shipTo{}                       ← Address
items[]                                  ← OrderItem
orderTotal  amountPaid  taxAmount  shippingAmount
customerNotes  internalNotes  gift  giftMessage  paymentMethod
requestedShippingService                 ← libellé brut de la boutique (« Express », « Standard »)
carrierCode  serviceCode  packageCode  confirmation  shipDate  holdUntilDate
weight{value, units, WeightUnits}        ← units: grams|ounces|pounds ; WeightUnits: 1=oz 2=g 3=lb
dimensions{units, length, width, height} | null
insuranceOptions{provider, insureShipment, insuredValue}
internationalOptions{contents, customsItems[], nonDelivery}
advancedOptions{warehouseId, nonMachinable, saturdayDelivery, containsAlcohol,
                mergedOrSplit, mergedIds[], parentId, storeId,
                customField1..3, source, billToParty, billToAccount,
                billToPostalCode, billToCountryCode, billToMyOtherAccount, movementIndicator}
tagIds[]  userId  labelMessages
externallyFulfilled  externallyFulfilledBy  externallyFulfilledById  externallyFulfilledByName
```

### Address (partagée par billTo / shipTo / originAddress / returnAddress)

```
name  company  street1  street2  street3  city  state  postalCode  country
phone  residential (bool|null)  addressVerified (texte libre : « Address validated successfully »)
```

### OrderItem

```
orderItemId  lineItemKey  sku  name  imageUrl
weight{}  quantity  unitPrice  taxAmount  shippingAmount
warehouseLocation  options[]  productId  fulfillmentSku
adjustment (bool — ligne de remise/ajustement)  upc  createDate  modifyDate
```

`adjustment: true` marque une ligne qui n'est pas un article physique (remise). Piège classique :
il faut l'exclure du calcul de poids et des douanes.

### Shipment

```
shipmentId  orderId  orderKey  orderNumber  userId (GUID)  customerEmail
createDate  shipDate  shipmentCost  insuranceCost  trackingNumber
isReturnLabel  batchNumber  carrierCode  serviceCode  packageCode  confirmation
warehouseId  voided  voidDate  marketplaceNotified  notifyErrorMessage
shipTo{}  weight{}  dimensions{}  insuranceOptions{}
advancedOptions{billToParty, billToAccount, billToPostalCode, billToCountryCode, storeId}
shipmentItems[]  labelData (PDF base64)  formData (douane, base64)
```

`labelData` et `formData` ne sont renvoyés qu'à l'achat ou avec `includeShipmentItems`. Le clone
doit stocker le PDF lui-même — Canada Post ne le garde pas indéfiniment.

### Fulfillment (envoi sans étiquette ShipStation)

```
fulfillmentId  orderId  orderNumber  userId  trackingNumber
createDate  shipDate  voidDate  deliveryDate
carrierCode (texte libre ici : « Canada Post », pas un code)
sellerFillProviderId/Name  fulfillmentProviderCode  fulfillmentServiceCode  fulfillmentFee
voidRequested  voided  marketplaceNotified  notifyErrorMessage
shipTo{}  externalFulfillmentId
```

À noter : `carrierCode` est ici un **libellé humain**, pas un code normalisé. Incohérence de
ShipStation à ne pas reproduire.

### InternationalOptions / CustomsItem

```
contents ∈ merchandise | documents | gift | returned_goods | sample
nonDelivery ∈ return_to_sender | treat_as_abandoned
customsItems[]: customsItemId, description, quantity, value,
                harmonizedTariffCode, countryOfOrigin,
                manufacturerProductId, manufacturerProductIdType,
                manufacturerNsProductId, cpscCertificates
```

**Trou constaté sur le compte :** `harmonizedTariffCode` est `null` sur les déclarations
observées. Or l'USPS exige un code SH à six chiffres depuis le 1ᵉʳ septembre 2025 sur tout envoi
commercial international. Le clone doit rendre ce champ obligatoire et l'alimenter depuis la fiche
produit — c'est une amélioration, pas une régression.

### Product, Customer, Warehouse, Store, Carrier, Tag, User

Structures secondaires, toutes accessibles en lecture. La fiche **Product** est la plus importante
pour le clone : elle porte poids, dimensions, `customsDescription`, `harmonizedTariffCode`,
`countryOfOrigin`, `warehouseLocation` et les défauts d'expédition. C'est elle qui alimente
automatiquement les douanes et la configuration d'envoi.

---

## 5. Inventaire fonctionnel de l'interface

Recensé écran par écran d'après la documentation produit. Les fonctions marquées **[U]** sont
réellement utilisées par Lasclay d'après l'audit API ; les autres sont à écarter ou reporter.

### Onglet Orders

- Grille de commandes : colonnes ajoutables/retirables via **Manage Columns**, réordonnables par
  glisser-déposer, **jusqu'à deux colonnes épinglées** au défilement horizontal. **[U]**
- Tri par en-tête de colonne (date, âge, destinataire…). **[U]**
- Vues sauvegardées, désormais en **onglets au-dessus de la grille**, en nombre illimité (l'ancienne
  limite de 5 est tombée avec la nouvelle interface).
- Déploiement d'une commande multi-articles directement dans la grille, sans ouvrir le détail.
- Recherche rapide (*Quicksearch*), y compris **par lecture de code-barres**.
- Actions de masse : Hold, Assign to user, Cancel, Tag, Mark as Shipped. **[U — mark as shipped]**
- **Order Alerts** : bandeau latéral listant les commandes problématiques (adresse invalide,
  expéditions combinables, articles manquants).
- **Split Ship** : découper une commande en plusieurs expéditions, depuis le détail ou une
  fenêtre surgissante de la grille ; auto-split par règle.
- **Combine** : fusionner plusieurs commandes en une expédition ; les deux dossiers conservent
  leurs données et reçoivent chacun une notification. **[U — marginal, 2/2000]**
- *Shipping Sidebar* / **Configure Shipment Widget** : transporteur, service, colis, poids,
  dimensions, confirmation, assurance, douanes — sans quitter la grille. **[U]**

### Détail de commande (refonte 2025)

Vue centrée sur **une expédition** plutôt que sur la commande, pour lever l'ambiguïté quand une
partie est en rupture. Un *order summary* sert de reçu d'origine consultable en parallèle.

### Onglet Shipments

- Grille des expéditions, colonnes et vues personnalisables, mêmes mécanismes que Orders. **[U]**
- **Void label** — annulation, remboursement selon le transporteur. **[U — 0,4 %]**
- Réimpression d'étiquette et de bordereau.
- **End of Day** : section latérale, un bouton *Close Shipments* par transporteur, sélection des
  envois, génération du **manifeste / SCAN form** avec code-barres unique. Attention : cutoff USPS
  à 21 h locale, au-delà la date d'expédition bascule au lendemain.
- Colonne **Insurance** avec lien de réclamation intégré. **[U — 0,6 %]**

### Onglet Returns

- Cycle de vie complet des **RMA**, numéro unique par retour, liant commande, étiquette, motif et
  statut de remboursement ou d'échange.
- **Portail de retours de marque** sur une URL contrôlée par le marchand, logo, couleurs, messages.
- Fenêtre de retour, produits retournables, transporteurs et colis autorisés — **par boutique**.
- Étiquettes de retour manuelles. **[U — 1,9 % des étiquettes]**

### Onglet Products

- Fiches produit : SKU, nom, poids, dimensions, emplacement d'entrepôt, image, UPC. **[U]**
- **Product Defaults** : configuration d'expédition et de douane appliquée à l'import.
- **Preset Groups** : défauts partagés par un groupe de produits, surchargés par un défaut
  individuel s'il existe.
- Inventaire interne : quantités par entrepôt, seuil et **alerte de stock bas**, **Inventory Sync**,
  inventaire externe (3PL).
- Bundles de produits (nouvelle interface).

### Onglet Customers

Vue agrégée par client : adresses, nombre de commandes, valeur, marché d'origine, tags.

### Onglet Analytics / Insights

Tableaux de bord propulsés par Looker : performance transporteur, optimisation des coûts, vitesse
de traitement, signaux d'inventaire, tendances de retours. Le **Shipping Cost Report** compare ce
que le client a payé en frais de port au coût réel de l'étiquette. Exports de données brutes,
filtres par période, boutique, transporteur, API d'analytique pour tableaux de bord externes.

### Settings

| Section | Contenu |
|---|---|
| Selling Channels | boutiques, mappage de statuts, options d'import, bordereau par boutique |
| Shipping | transporteurs, services et colis autorisés, assurance par défaut |
| Ship From Locations | entrepôts, adresse d'origine **et** de retour **[U — 5 sites]** |
| Automation | règles IF/THEN, auto-routage, auto-split, Rate Shopper |
| Printing | imprimantes, formats d'étiquette (4×6, lettre), documents à imprimer ensemble |
| Templates | bordereaux, courriels, étiquettes — édition **HTML + Liquid + CSS** |
| Branding | logo, couleurs, page de suivi de marque, réseaux sociaux, authentification de domaine |
| Emails | notifications par boutique : expédition, livraison, retard, retour |
| Inventory | seuils, alertes, sources d'inventaire liées aux entrepôts |
| Users | modèle **plat sans rôles nommés** : cases à cocher par utilisateur (Orders, Shipments, Products, Reports, Account Settings, accès par boutique) |
| Account | API keys, facturation, sécurité/2FA |

### Automatisation — le cœur du produit

Logique **IF/THEN** : des critères identifient les commandes, des actions leur sont appliquées à
l'import.

*Critères* : état/province de destination, poids, montant, boutique d'origine, tags, SKU, service
demandé, pays, article unique vs multiple.
*Actions* : fixer service + type de colis, ajouter un tag, fixer l'entrepôt d'expédition
(**auto-routage**), scinder la commande (**auto-split**), assigner un utilisateur, appliquer le
**Rate Shopper**, transmettre à un 3PL par courriel.

Les règles sont **chaînables** : une règle peut réagir au résultat d'une règle précédente. C'est
la fonction dont il faut se méfier en clonant — sans elle, le clone redevient de la saisie
manuelle.

**Rate Shopper** : sélection automatique du meilleur tarif selon une stratégie par défaut ou des
règles maison, arbitrant coût contre délai. ShipStation annonce l'arbitrage sur 200+ transporteurs.

### Mobile

Application iOS/Android : consultation et recherche de commandes, **lecture de code-barres par la
caméra**, création de manifeste de fin de journée, et **Mobile Picking** — deux flux, *Basic*
(regroupement par article, prélèvement en vrac) et *Pick to Tote* (une commande par bac). Le scan
valide contre SKU, UPC ou fulfillment SKU, avec retour visuel et sonore.

Poste d'emballage : **Scan to Verify** / *Verify & Print* — le scan du bordereau déclenche
l'impression de l'étiquette correspondante.

---

## 6. Étiquettes, douanes, assurance

**Achat d'étiquette.** Deux chemins : `createlabelfororder` (rattaché à une commande) et
`createlabel` (hors commande, ou étiquette de retour avec `isReturnLabel: true`). Le paramètre
`testLabel: true` produit une étiquette factice **sans frais** — indispensable pour tout banc
d'essai, et le seul moyen d'exercer ces appels sans dépenser.

**Annulation.** `voidlabel` sur un `shipmentId` ; remboursement selon le transporteur, jamais
garanti par ShipStation.

**Douanes.** Déclaration par `internationalOptions`. Les transporteurs privés (FedEx, UPS,
DHL Express) reçoivent une **facture commerciale** ; la soumission électronique est automatique
chez FedEx et DHL Express, et exige l'activation EDI côté UPS. Canada Post utilise le CN22/CN23.

**Assurance.** Deux fournisseurs selon le pays : **Shipsurance** (comptes américains, ShipStation
Legacy) et **XCover / Total Shipping Protection** (comptes canadiens, australiens, britanniques —
donc Lasclay). XCover couvre la valeur de la commande, **1,10 % en domestique et 1,50 % à
l'international**, et rembourse aussi le port de retour et le coût de réexpédition. Réclamation
depuis la colonne Insurance de la grille.

---

## 7. Ce que coûte l'abonnement

ShipStation a refondu sa tarification en juillet 2025 : trois forfaits à facturation au volume
remplacent les huit paliers précédents.

| Forfait | Prix d'entrée | Utilisateurs inclus |
|---|---|---|
| Starter | 14,99 $ US / 50 expéditions / mois | 3 |
| Standard | 29,99 $ US / 50 expéditions / mois | 10 |
| Premium | 349,99 $ US / mois | 15 |

Le prix monte par palier de volume ; au-delà de 20 000 expéditions/mois, tarif sur mesure. Toutes
les formules incluent les connexions boutique illimitées et l'arbitrage de tarifs.

**Pour Lasclay** — ≈ 695 expéditions/mois en moyenne, avec un pic à 2 755 en décembre — le compte
se situe dans les paliers supérieurs du volume. Mais l'abonnement **n'est pas l'enjeu** : même à
2 000 $/an, il pèse dix fois moins que l'écart de tarif documenté au §7 bis. Le clone se justifie
par le tarif, pas par la licence.

---

## 7 bis. Le vrai gisement — le tarif drop-off à 6,31 $

### Le fait

Un devis ClickShip du 22 juillet 2026 (colis 9×6×1 po, 0,10 lb, Québec → Lac-Beauport) affiche
**Canada Post Expedited Parcel « Drop-Off Only » à 6,31 $ CAD**, contre 9,12 $ chez GLS, 11,45 $
chez Canpar, 15,51 $ chez UPS, 16,01 $ chez Purolator et 18,98 $ chez FedEx. L'interface signale un
**« new program for single shipments under 1.1 lbs (0.5 kg or 500 grams) »**.

Interrogée le 27 juillet 2026, Christine Valin, représentante Solutions d'affaires chez Canada
Post, confirme et ferme la porte au contrat direct :

> « Ce service n'inclut pas le ramassage et est offert que par l'entremise de plate-forme
> d'expédition. Ce n'est pas offert pour les ententes commerciales. »

Autrement dit : ce tarif **n'existe pas** sur l'entente commerciale de Lasclay. Il n'est
accessible que par un courtier — ClickShip / Freightcom, ShipStation One Balance, ou équivalent.
Toute architecture qui appelle l'API Canada Post en direct avec le contrat `0005082011` **perd
d'office l'économie**.

### Le calcul, sur 12 mois réels

| | |
|---|---|
| Expéditions actives, 12 mois | 8 338 |
| Dépense transport totale | **98 828 $** |
| Dont colis < 500 g | 6 716 envois (80,5 %) · **75 498 $** · moyenne 11,24 $ |
| Ces mêmes colis à 6,31 $ | 42 378 $ |
| **Économie annuelle** | **33 120 $ — 33,5 % de la facture de transport** |

### Sensibilité — si le tarif réel négocié n'est pas 6,31 $

| Tarif obtenu par envoi < 500 g | Économie annuelle |
|---|---|
| 6,31 $ (devis observé) | **33 120 $** |
| 7,50 $ | 25 128 $ |
| 8,50 $ | 18 412 $ |
| 9,09 $ (tarif contrat direct actuel) | 14 450 $ |

Le projet reste largement rentable même dans l'hypothèse pessimiste. **Le seuil de rentabilité est
très bas** : l'abonnement ShipStation est amorti par les 300 premiers envois de l'année.

### Ce que le drop-off coûte en contrepartie

Le tarif exclut le **ramassage**. Aujourd'hui, les colis partent de LAS Capucins (85,6 % du
volume) par ramassage. En drop-off, quelqu'un dépose les colis au comptoir postal. À 2 755 envois
en décembre — environ 130 colis par jour ouvrable — ce n'est pas un détail d'exploitation : c'est
une tournée quotidienne à organiser, et le point à valider avant de s'engager.

Piste d'arbitrage : appliquer le drop-off aux colis < 500 g (80,5 % du volume, tout l'argent) et
garder un ramassage pour le reste. Le moteur de règles du clone (§8) doit pouvoir router selon le
poids — c'est même sa fonction la plus rentable.

---

## 8. Architecture proposée pour le clone

### Principe

Reprendre la séparation qui marche déjà dans ce dépôt : **un service proxy qui détient les secrets
transporteur**, une base qui détient l'état, une interface web mince. Le modèle `a2x-app/` du dépôt
(serveur Node + interface web + CLI sur le même noyau) est le précédent à suivre.

```
Shopify / Etsy / Faire ──(webhook + polling)──▶  Ingestion
                                                     │
                                                     ▼
                                          Base (PostgreSQL ou SQLite)
                                    orders · items · shipments · products
                                    warehouses · stores · rules · batches
                                                     │
                    ┌────────────────────────────────┼─────────────────────┐
                    ▼                                ▼                     ▼
       Interface web (LE CŒUR)            Moteur de règles         Proxy transporteur
   grille · filtres · vues · Hold        IF/THEN à l'import       ClickShip / Freightcom
   tri backlog · lots · détail           routage par poids         (secret côté serveur,
   config expédition                     <500 g → drop-off          même patron que
                                                                    general-proxy)
                                                                            │
                                                     ┌──────────────────────┤
                                                     ▼                      ▼
                                            étiquette PDF + suivi     douanes / CN22
```

### Choix de la couche transporteur

Le §7 bis tranche la question : **le tarif drop-off n'existe que chez un courtier**. L'option
« API Canada Post directe », séduisante sur le papier, coûte 33 000 $/an d'économie manquée.

| Option | Ce que c'est | Verdict |
|---|---|---|
| **ClickShip / Freightcom API** | courtier canadien, plateforme gratuite payée à l'envoi ; c'est la source du devis à 6,31 $ | **retenu** — seul chemin vers le tarif drop-off |
| API Canada Post directe | *Ship & Track*, contrat `0005082011` | **écarté** — perd le tarif drop-off (confirmé par Canada Post) |
| Karrio auto-hébergé | plateforme d'expédition libre (Python/Django, Docker) | repli si le courtier déçoit ; n'apporte pas de tarif par lui-même |
| EasyPost / Shippo / ShipEngine | agrégateurs commerciaux | à comparer sur le tarif Canada Post drop-off uniquement |

### Vérifications à faire côté ClickShip / Freightcom — avant d'écrire une ligne

Les domaines `developer.freightcom.com` et `clickship.com` sont **bloqués par la politique
d'égress de cette session** ; je n'ai donc pas pu lire la documentation. Ce qui suit est la liste
des points à confirmer sur le portail développeur, par ordre d'importance :

1. **Le tarif drop-off est-il exposé par l'API, ou seulement dans l'interface web ?** C'est la
   question qui décide de tout. Un devis d'API renvoyant 9 $ là où l'interface affiche 6,31 $
   annulerait le projet. **À tester en premier**, avant tout développement.
2. Le service porte-t-il un identifiant distinct (« Expedited Parcel Drop-Off ») ou est-ce une
   option sur le service standard ?
3. Accès API : ClickShip communique publiquement sur un formulaire de demande plutôt que sur une
   documentation ouverte — il faut probablement **demander l'activation** à Freightcom. Compter du
   délai commercial.
4. Modèle de facturation : compte prépayé ou facturation à terme, et qui porte le risque.
5. Rythme de rating : l'API Freightcom cote de façon **asynchrone** (on soumet une demande, on
   récupère les tarifs ensuite) — le clone doit prévoir ce va-et-vient, pas un appel bloquant.
6. Étiquettes en lot : 96 % des achats se font en lot. Vérifier s'il existe un appel de lot ou
   s'il faut paralléliser des appels unitaires, et quelle est la limite de débit.
7. Douanes et suivi : formats des documents, événements de suivi, webhooks disponibles.
8. Annulation d'étiquette et remboursement.

**Étape zéro du projet, avant tout code : obtenir un accès API Freightcom et coter un colis de
400 g Québec → Toronto.** Si le tarif drop-off sort de l'API, le reste est de l'exécution. Sinon,
il faut retourner voir ClickShip sur l'intégration, ou rester sur une plateforme d'interface.

### Périmètre par phase

**Phase 0 — la question qui décide (quelques jours, aucun code)**

0. Obtenir un accès API Freightcom/ClickShip et **coter un colis de 400 g Québec → Toronto**.
   Le tarif drop-off sort-il de l'API ? Tant que la réponse est inconnue, tout développement est
   spéculatif.

**Phase 1 — le strict nécessaire (couvre ~99 % du flux réel)**

1. Ingestion Shopify (webhook `orders/create` + rattrapage par polling) → table `orders`.
2. **La grille de tri du backlog** — c'est la raison d'être du projet, pas une commodité :
   filtres cumulables (statut, date, âge, boutique, poids, pays, service demandé), **vues
   sauvegardées**, tri par colonne, **Hold jusqu'à une date avec retour automatique en file**,
   recherche rapide, sélection multiple et actions de masse.
3. Fiche produit avec poids, dimensions, description douanière, code SH, pays d'origine.
4. Configuration d'expédition : entrepôt, service, poids, dimensions, confirmation.
5. **Traitement par lot** — 96 % des étiquettes sont achetées en lot, c'est la fonction n°1,
   pas une option.
6. Achat d'étiquette via l'API du courtier, stockage du PDF, impression 4×6.
7. Marquage expédié + renvoi du suivi vers Shopify (`fulfillment` avec `tracking_number`).
8. Courriel de confirmation d'expédition au client.
9. Annulation d'étiquette.

**Phase 2 — parité de confort**

10. **Routage par poids** : < 500 g → drop-off, le reste → service avec ramassage. C'est la règle
    qui matérialise les 33 000 $ ; à traiter tôt si le tri manuel devient pénible.
11. Bordereaux d'emballage avec gabarit HTML éditable.
12. Douanes automatiques depuis la fiche produit — avec code SH **obligatoire**, correction du
    trou constaté au §4.
13. Étiquettes de retour et suivi des RMA.
14. Moteur de règles IF/THEN à l'import (service par poids, entrepôt par boutique, tag).
15. Import Etsy et Faire.
16. Comparateur de tarifs multi-services et multi-transporteurs.

**Phase 3 — au-delà**

17. Page de suivi de marque, notifications de livraison.
18. Scan to Verify au poste d'emballage.
19. Tableaux de bord de coûts (coût réel vs frais de port encaissés) — le seul rapport qui
    manquait vraiment, vu l'écart de tarif en jeu.
20. Inventaire et seuils d'alerte.
21. Second transporteur au besoin (34 envois Purolator sur 12 mois : très bas dans la liste).

### Migration des données

L'API v1 permet un export complet avant résiliation : 38 835 commandes, 19 671 expéditions,
14 406 fulfillments, plus produits, clients, entrepôts, transporteurs et tags. À **40 requêtes par
minute et 500 enregistrements par page**, l'export intégral tient en une trentaine de minutes.
**À faire avant toute résiliation** — l'accès API disparaît avec l'abonnement.

---

## 9. Risques et points durs

**Le tarif drop-off doit sortir de l'API — c'est le risque n°1.** Tout le projet repose sur un
prix vu dans une interface web. Si l'API Freightcom ne l'expose pas, les 33 000 $ s'évaporent et
il ne reste qu'un clone d'interface qui économise un abonnement. **À tester avant tout
développement** (phase 0). Ce test coûte quelques jours ; se tromper d'ordre coûte des mois.

**Le drop-off supprime le ramassage.** À 2 755 envois en décembre, soit ~130 colis par jour
ouvrable, la tournée au comptoir postal devient une charge d'exploitation réelle. Le gain de
33 000 $ est brut : il faut en déduire le temps de dépôt. Arbitrage possible — drop-off sur les
< 500 g seulement, ramassage conservé pour le reste.

**On change de dépendance, on ne s'en libère pas.** Sortir de ShipStation pour entrer chez
Freightcom, c'est troquer un fournisseur contre un autre, avec le même risque de hausse de tarif
ou de changement de programme. La différence : le clone possède l'interface et les données, et la
couche transporteur devient interchangeable si elle est isolée derrière un proxy — d'où
l'architecture du §8.

**Le portefeuille One Balance n'est pas reproductible.** UPS, FedEx, DHL Express, Purolator et
Canpar sont revendus par ShipStation à des tarifs négociés par elle. Vu l'usage réel — **34 envois
Purolator et 1 UPS sur 12 mois** — s'en passer est sans conséquence, et ClickShip propose de toute
façon GLS, Canpar, UPS, Purolator et FedEx.

**Les notifications marketplace.** ShipStation renvoie automatiquement le suivi à Shopify, Etsy et
Faire (`marketplaceNotified: true` sur les expéditions). Le clone doit reprendre cette
responsabilité pour chaque canal, sans quoi les clients perdent leur suivi.

**La saisonnalité concentre le risque, et le pic est décembre.** 2 755 expéditions en décembre
2025, contre 142 en juin 2026 — un facteur vingt. Une bascule ratée en novembre-décembre coûte la
saison. **Fenêtre de migration : mai à août**, où le volume reste sous 250/mois. En pratique, cela
laisse le printemps 2027 comme cible réaliste si la phase 0 démarre maintenant.

**Les 42 % de fulfillments hors étiquette** viennent d'ailleurs (Chit Chats, expéditions
partenaires). Le clone doit accepter un suivi saisi manuellement ou importé, pas seulement des
étiquettes qu'il a lui-même achetées.

---

## 10. Note sur les captures d'écran

L'objectif « images de l'interface » n'a **pas pu être rempli** : le proxy réseau de cette session
bloque tous les domaines `shipstation.com` (`docs.`, `help.`, `www.`) — refus au niveau du tunnel
CONNECT, pas un problème d'authentification. Aucune capture n'a pu être téléchargée, ni depuis les
sites tiers testés.

L'inventaire du §5 est donc textuel, reconstitué à partir des descriptions documentaires. Pour
compléter avec de vraies captures, deux chemins :

1. **Depuis le compte** — se connecter à ShipStation et capturer les écrans réellement utilisés :
   grille Orders avec les colonnes en place, Configure Shipment Widget, écran de traitement par
   lot, End of Day, Settings → Automation. Ce sont ceux qui comptent, et ils reflètent la
   configuration Lasclay plutôt qu'une démo générique.
2. **Hors de cette session** — les pages listées en sources contiennent les captures officielles ;
   elles sont accessibles depuis un navigateur ordinaire.

---

## Sources

Documentation produit et technique ShipStation :
[Glossaire produit](https://help.shipstation.com/hc/en-us/articles/360026158671-ShipStation-Product-Glossary) ·
[Statuts de commande](https://help.shipstation.com/hc/en-us/articles/360025869712-Understanding-Order-Statuses) ·
[Hold, Assign, Cancel](https://help.shipstation.com/hc/en-us/articles/360026156911-Hold-Assign-and-Cancel-Orders) ·
[Vues et grille](https://help.shipstation.com/hc/en-us/articles/360025869052-View-Search-and-Sort-Orders) ·
[Vues personnalisées](https://help.shipstation.com/hc/en-us/articles/360045864791-Create-Custom-Order-Views) ·
[Nouvelle interface](https://help.shipstation.com/hc/en-us/articles/48668385552027-Feature-Updates-in-ShipStation-s-New-Layout) ·
[Page de détail de commande](https://www.shipstation.com/blog/order-details-page/) ·
[Split Ship](https://help.shipstation.com/hc/en-us/articles/360028798951-Split-Orders-Into-Multiple-Shipments) ·
[Combine Shipments](https://help.shipstation.com/hc/en-us/articles/360033432631-Combine-Shipments) ·
[Règles d'automatisation](https://help.shipstation.com/hc/en-us/articles/360026158331-Create-Automation-Rules) ·
[Automatisation avancée](https://help.shipstation.com/hc/en-us/articles/360047475631-Advanced-Automation-Rules) ·
[Rate Shopper](https://help.shipstation.com/hc/en-us/articles/4415714484123-Rate-Shopper-Automate-Selecting-the-Lowest-Rate) ·
[Comparer les tarifs](https://help.shipstation.com/hc/en-us/articles/360026157611-Compare-Rates) ·
[Manifestes](https://help.shipstation.com/hc/en-us/articles/360025869792-Create-Shipment-Manifests) ·
[SCAN form](https://help.shipstation.com/hc/en-us/articles/205900618-How-do-I-print-a-USPS-SCAN-form-) ·
[Bordereaux personnalisés](https://help.shipstation.com/hc/en-us/articles/360057378051-Create-Custom-Packing-Slips) ·
[Marque](https://help.shipstation.com/hc/en-us/articles/360025870252-What-is-Branding) ·
[Page de suivi de marque](https://help.shipstation.com/hc/en-us/articles/360026158351-Branded-Tracking-Page) ·
[Retours](https://help.shipstation.com/hc/en-us/articles/49977365632923-Returns-in-ShipStation) ·
[Portail de retours](https://www.shipstation.com/fulfillment/returns/) ·
[Déclarations douanières](https://help.shipstation.com/hc/en-us/articles/360025869952-Customs-Declarations) ·
[Expédition internationale](https://help.shipstation.com/hc/en-us/articles/360026157991-International-Shipping-with-ShipStation) ·
[XCover](https://help.shipstation.com/hc/en-us/articles/28656549816091-Total-Shipping-Protection-by-XCover) ·
[Shipsurance](https://help.shipstation.com/hc/en-us/articles/360026142391-Shipsurance) ·
[Produits](https://help.shipstation.com/hc/en-us/articles/360025870012-Products-Overview) ·
[Preset Groups](https://help.shipstation.com/hc/en-us/articles/360028606672-Product-Preset-Groups) ·
[Inventaire](https://help.shipstation.com/hc/en-us/articles/360025870392-Inventory-in-ShipStation) ·
[Mobile Picking](https://help.shipstation.com/hc/en-us/articles/49132708040347-Introduction-to-Mobile-Picking) ·
[Scan to Verify](https://help.shipstation.com/hc/en-us/articles/360031021831-Verify-Print-Shipments-with-Barcode-Scan) ·
[Permissions utilisateur](https://help.shipstation.com/hc/en-us/articles/360025870172-Set-User-Permissions-and-Restrictions) ·
[Notifications client](https://help.shipstation.com/hc/en-us/articles/360026157911-Customer-Notifications-Settings) ·
[Analytics](https://help.shipstation.com/hc/en-us/articles/360026158131-Get-Started-with-ShipStation-Analytics) ·
[Webhooks](https://help.shipstation.com/hc/en-us/articles/360025856252-ShipStation-Webhooks) ·
[API v1](https://www.shipstation.com/docs/api/) ·
[API v2](https://docs.shipstation.com/getting-started) ·
[Batch Labels v2](https://docs.shipstation.com/batch-labels)

Tarification :
[G2](https://www.g2.com/products/shipstation/pricing) ·
[Costbench](https://costbench.com/software/shipping-software/shipstation/) ·
[Tekpon](https://tekpon.com/software/shipstation/pricing/)

Couche transporteur envisagée :
[Portail développeur Freightcom](https://developer.freightcom.com/) ·
[API Freightcom](https://www.freightcom.com/shipping-api) ·
[Demande d'accès API ClickShip](https://www.clickship.com/request-shipping-api) ·
[ClickShip](https://www.clickship.com/)
— **ces trois domaines sont bloqués par la politique d'égress de la session ; la documentation
n'a pas pu être lue et reste à vérifier (voir §8).**

Alternatives libres :
[Karrio](https://github.com/karrioapi/karrio) ·
[Documentation auto-hébergement Karrio](https://docs.karrio.io/product/self-hosting) ·
[Purplship](https://github.com/EzeeSpace/purplship)

Échanges Lasclay ↔ Canada Post : fil Missive « Tarif Drop-off », Gabriel Gouveia → Christine Valin
(22 juillet 2026) et réponse de Christine Valin, représentante Solutions d'affaires, Canada Post
(27 juillet 2026) — confirmation que le tarif drop-off est réservé aux plateformes d'expédition et
exclu des ententes commerciales.

Données du compte : API ShipStation v1 via `general-proxy-5muf.onrender.com`, 31 juillet 2026 —
échantillons de 3 000 expéditions et 2 000 commandes, plus référentiels complets (transporteurs,
boutiques, entrepôts, tags) et devis de tarifs sur sept transporteurs.
