# 10. API v1 (legacy ShipStation API) — schémas complets

> Extrait de la spec ShipStation — Lasclay. Voir `00-INDEX.md` pour la carte complète.
> Libellés d'UI en anglais (langue source du produit). `[à vérifier]` = non confirmé par une source officielle.

# 1. Vue d'ensemble : deux APIs distinctes

ShipStation expose **deux APIs qui ne partagent ni le modèle de données, ni l'authentification, ni les identifiants**. C'est un point structurant pour toute réplication : il faut décider si l'on réplique l'une, l'autre, ou un modèle unifié.

| Aspect | **API v1 (legacy)** | **Shipping API v2** |
|---|---|---|
| Base URL | `https://ssapi.shipstation.com` | `https://api.shipstation.com/v2` (moteur identique à `https://api.shipengine.com/v1`) |
| Auth | Basic HTTP (`base64(apiKey:apiSecret)`) | En‑tête `API-Key: <clé>` |
| Style d'ID | entiers auto‑incrémentés (`orderId: 93348442`) | chaînes préfixées (`se-28529731`, `shipment_id`, `label_id`) |
| Convention de nommage | `camelCase` | `snake_case` |
| Objet central | **Order** (commande) | **Shipment** (expédition) |
| Étendue | gestion de commandes + expéditions + boutiques + clients + produits | tarifs, étiquettes, lots, manifestes, suivi, douanes, points relais, LTL |
| Débit | 40 req/min | 200 req/min |
| Statut | legacy, maintenue, « nouvelles intégrations devraient utiliser V2 » | active, en évolution |
| Plan requis | Standard ou supérieur (sinon HTTP 402) | Standard ou supérieur (add‑on Inventory séparé) |

**Conséquence de design :** l'objet `Order` de v1 est *un objet métier riche* (client, articles, montants, notes, tags, assignation utilisateur). L'objet `Shipment` de v2 est *un objet logistique* (adresses, colis, douanes, options avancées) auquel on a greffé des champs de commande (`items`, `amount_paid`, `notes_from_buyer`). Pour une alternative maison, **le modèle v2 est le plus complet et le plus moderne**, mais le modèle v1 décrit mieux le cycle de vie d'une commande multi‑canal.

---

<a name="2"></a>
# 2. API v1 (legacy ShipStation API)

## 2.1 Conventions transversales

### Authentification
Basic HTTP. `apiKey` = username, `apiSecret` = password, encodés RFC2045‑MIME Base64, préfixés de `Basic `.

```
Authorization: Basic <base64(apiKey:apiSecret)>
```

Seul le propriétaire du compte peut générer des clés (après vérification d'e‑mail). Deux clés max, affichées en clair une seule fois. Rotation possible.

### Limitation de débit (rate limiting)

| Élément | Valeur |
|---|---|
| Limite | **40 requêtes / minute** par paire clé/secret |
| `X-Rate-Limit-Limit` | maximum de requêtes par fenêtre |
| `X-Rate-Limit-Remaining` | requêtes restantes dans la fenêtre courante |
| `X-Rate-Limit-Reset` | secondes avant la prochaine fenêtre |
| Dépassement | HTTP `429 Too Many Requests` |

> `[à vérifier]` Certains endpoints coûteux (ex. `/orders/createorders`) peuvent avoir un coût plus élevé qu'une unité — la doc ne le formalise pas.

### Pagination
Modèle uniforme sur tous les endpoints de liste :

| Paramètre | Type | Description |
|---|---|---|
| `page` | integer | numéro de page (base 1) |
| `pageSize` | integer | taille de page, **max 500** |
| `sortBy` | string | champ de tri (varie par ressource) |
| `sortDir` | string | `ASC` \| `DESC` |

Enveloppe de réponse :
```json
{ "<resource>": [ … ], "total": 1234, "page": 1, "pages": 25 }
```

### Formats de date
ISO 8601 sans fuseau : `yyyy-mm-dd hh:mm:ss` (24 h). **Toutes les heures sont en PST/PDT**, y compris en entrée. C'est un piège majeur : le fuseau n'est pas UTC.

### Codes d'erreur
`200`/`201`/`204` succès · `400` bad request · `401` unauthorized · `402` plan insuffisant · `403` forbidden · `404` not found · `429` rate limit · `500` erreur serveur.

---

## 2.2 Inventaire complet des endpoints v1

### Accounts
| Méthode | Chemin | Opération |
|---|---|---|
| POST | `/accounts/registeraccount` | Créer un compte (partenaires) |
| GET | `/accounts/listtags` | Lister les tags du compte |

### Orders (14 endpoints)
| Méthode | Chemin | Opération |
|---|---|---|
| GET | `/orders` | Lister les commandes |
| GET | `/orders/{orderId}` | Récupérer une commande |
| DELETE | `/orders/{orderId}` | Supprimer (soft delete → statut `cancelled`) |
| POST | `/orders/createorder` | Créer **ou mettre à jour** une commande (upsert) |
| POST | `/orders/createorders` | Upsert en lot (max 100 `[à vérifier]`) |
| GET | `/orders/listbytag` | Lister par tag |
| POST | `/orders/addtag` | Ajouter un tag |
| POST | `/orders/removetag` | Retirer un tag |
| POST | `/orders/assignuser` | Assigner un utilisateur |
| POST | `/orders/unassignuser` | Désassigner |
| POST | `/orders/holdorder` | Mettre en attente jusqu'à une date |
| POST | `/orders/restoreorder` | Sortir de l'attente |
| POST | `/orders/markasshipped` | Marquer expédié sans étiquette |
| POST | `/orders/createlabelfororder` | Créer une étiquette pour une commande |

### Shipments
| Méthode | Chemin | Opération |
|---|---|---|
| GET | `/shipments` | Lister les expéditions (seules celles avec étiquette générée dans ShipStation) |
| POST | `/shipments/createlabel` | Créer une étiquette autonome (sans commande) |
| POST | `/shipments/getrates` | Obtenir les tarifs |
| POST | `/shipments/voidlabel` | Annuler une étiquette |

### Carriers
| Méthode | Chemin | Opération |
|---|---|---|
| GET | `/carriers` | Lister les transporteurs connectés |
| GET | `/carriers/getcarrier?carrierCode=` | Détail d'un transporteur |
| POST | `/carriers/addfunds` | Ajouter des fonds (approbation ShipStation requise) |
| GET | `/carriers/listpackages?carrierCode=` | Types de colis |
| GET | `/carriers/listservices?carrierCode=` | Services d'expédition |

### Customers
| Méthode | Chemin | Opération |
|---|---|---|
| GET | `/customers` | Lister les clients |
| GET | `/customers/{customerId}` | Détail d'un client |

### Fulfillments
| Méthode | Chemin | Opération |
|---|---|---|
| GET | `/fulfillments` | Lister les fulfillments (expéditions externes) |

### Products
| Méthode | Chemin | Opération |
|---|---|---|
| GET | `/products` | Lister les produits |
| GET | `/products/{productId}` | Détail produit |
| PUT | `/products/{productId}` | Mettre à jour un produit |

### Stores
| Méthode | Chemin | Opération |
|---|---|---|
| GET | `/stores` | Lister les boutiques installées |
| GET | `/stores/{storeId}` | Détail boutique |
| PUT | `/stores/{storeId}` | Mettre à jour |
| POST | `/stores/deactivate` | Désactiver |
| POST | `/stores/reactivate` | Réactiver |
| POST | `/stores/refreshstore` | Déclencher un import (polling) |
| GET | `/stores/getrefreshstatus` | Statut du dernier import |
| GET | `/stores/marketplaces` | Lister les places de marché intégrables |

### Users / Warehouses / Webhooks
| Méthode | Chemin | Opération |
|---|---|---|
| GET | `/users?showInactive=` | Lister les utilisateurs |
| GET | `/warehouses` | Lister les entrepôts (Ship From Locations) |
| POST | `/warehouses/createwarehouse` | Créer |
| GET | `/warehouses/{warehouseId}` | Détail |
| PUT | `/warehouses/{warehouseId}` | Mettre à jour |
| DELETE | `/warehouses/{warehouseId}` | Supprimer |
| GET | `/webhooks` | Lister les abonnements |
| POST | `/webhooks/subscribe` | S'abonner |
| DELETE | `/webhooks/{webhookId}` | Se désabonner |

---

## 2.3 Modèle `Order` — schéma complet

| Champ | Type | Requis | Lecture seule | Description |
|---|---|---|---|---|
| `orderId` | number | — | ✅ | Identifiant système de la commande |
| `orderNumber` | string | ✅ | | Numéro de commande défini par l'utilisateur/le canal |
| `orderKey` | string | | | Clé unique fournie par le client. **C'est la clé d'idempotence de l'upsert** : si fournie et existante → mise à jour ; sinon → création + génération auto |
| `orderDate` | string (date‑time) | ✅ | | Date de passation de la commande |
| `createDate` | string (date‑time) | | ✅ | Date de création dans ShipStation |
| `modifyDate` | string (date‑time) | | ✅ | Dernière modification |
| `paymentDate` | string (date‑time) | | | Date de réception du paiement |
| `shipByDate` | string (date‑time) | | | Date limite d'expédition (dépend de la plateforme source) |
| `orderStatus` | string (enum) | ✅ | | Voir §4.1 |
| `customerId` | number | | ✅ | Identifiant du client (résolu par ShipStation) |
| `customerUsername` | string | ✅ | | Identifiant du client dans le système d'origine |
| `customerEmail` | string | | | Courriel du client |
| `billTo` | Address | | | Adresse de facturation |
| `shipTo` | Address | ✅ | | Adresse de livraison |
| `items` | OrderItem[] | ✅ | | Articles achetés |
| `orderTotal` | number | | ✅ | Total de la commande (calculé) |
| `amountPaid` | number | | | Montant payé |
| `taxAmount` | number | | | Taxes totales |
| `shippingAmount` | number | | | Frais d'expédition payés par le client |
| `customerNotes` | string | | | Notes laissées par le client |
| `internalNotes` | string | | | Notes privées, visibles seulement du vendeur |
| `gift` | boolean | | | Commande cadeau |
| `giftMessage` | string | | | Message cadeau |
| `paymentMethod` | string | | | Moyen de paiement |
| `requestedShippingService` | string | | | Service demandé par le client (texte libre du canal) |
| `carrierCode` | string | | | Code transporteur |
| `serviceCode` | string | | | Code service |
| `packageCode` | string | | | Code type de colis |
| `confirmation` | string (enum) | | | Type de confirmation de livraison — voir §4.2 |
| `shipDate` | string (date) | | | Date d'expédition |
| `holdUntilDate` | string (date) | | | Date de fin de mise en attente |
| `weight` | Weight | | | Poids total |
| `dimensions` | Dimensions | | | Dimensions du colis |
| `insuranceOptions` | InsuranceOptions | | | Assurance |
| `internationalOptions` | InternationalOptions | | | Douane |
| `advancedOptions` | AdvancedOptions | | | Options avancées |
| `tagIds` | number[] \| null | | | Tags appliqués |
| `userId` | string (GUID) | | ✅ | Utilisateur assigné |
| `externallyFulfilled` | boolean | | ✅ | La commande est traitée par un prestataire externe |
| `externallyFulfilledBy` | string | | ✅ | Nom du mode de fulfillment marketplace |
| `externallyFulfilledById` | number | | ✅ | Identifiant du prestataire |
| `externallyFulfilledByName` | string | | ✅ | Nom du prestataire |

### Paramètres de requête `GET /orders`

| Paramètre | Type | Valeurs |
|---|---|---|
| `customerName` | string | |
| `itemKeyword` | string | recherche dans SKU / nom / options d'article |
| `createDateStart` / `createDateEnd` | string | |
| `modifyDateStart` / `modifyDateEnd` | string | |
| `orderDateStart` / `orderDateEnd` | string | |
| `paymentDateStart` / `paymentDateEnd` | string | |
| `orderNumber` | string | recherche « commence par » |
| `orderStatus` | string | voir §4.1 |
| `customsCountryCode` | string | ISO 2 lettres |
| `storeId` | number | |
| `sortBy` | string | `OrderDate` \| `ModifyDate` \| `CreateDate` |
| `sortDir` | string | `ASC` \| `DESC` |
| `page`, `pageSize` | integer | max 500 |

> **Stratégie de synchronisation recommandée** : itérer sur `modifyDateStart`/`modifyDateEnd` avec `sortBy=ModifyDate&sortDir=ASC`, et non sur `createDate` — sinon les mises à jour sont manquées.

---

## 2.4 Modèle `OrderItem`

| Champ | Type | Lecture seule | Description |
|---|---|---|---|
| `orderItemId` | number | ✅ | Identifiant système de la ligne |
| `lineItemKey` | string | | Identifiant de la ligne dans le système d'origine |
| `sku` | string | | Unité de gestion de stock |
| `name` | string | | Nom du produit. **Ne peut pas être `null`** |
| `imageUrl` | string | | URL publique de l'image |
| `weight` | Weight | | Poids unitaire |
| `quantity` | number | | Quantité commandée |
| `unitPrice` | number | | Prix de vente unitaire tel que fourni par la source |
| `taxAmount` | number | | Taxe par article |
| `shippingAmount` | number | | Frais d'expédition par article |
| `warehouseLocation` | string | | Emplacement en entrepôt (allée, étagère…) |
| `options` | ItemOption[] | | Options / variantes |
| `productId` | number | | Lien vers la ressource Product |
| `fulfillmentSku` | string | | SKU alternatif chez le prestataire de fulfillment |
| `adjustment` | boolean | | Ligne d'ajustement **non physique** (remise, frais) — ne doit pas être expédiée |
| `upc` | string | | Code UPC |
| `createDate` | string | ✅ | |
| `modifyDate` | string | ✅ | |

### `ItemOption`
| Champ | Type | Description |
|---|---|---|
| `name` | string | Nom de l'option (ex. « Size ») |
| `value` | string | Valeur (ex. « Medium ») |

> Dans le XML custom store, `Option` porte en plus un `Weight` (poids additionnel de l'option) — absent du modèle JSON.

---

## 2.5 Modèle `Address` (billTo / shipTo)

| Champ | Type | Description |
|---|---|---|
| `name` | string | Nom de la personne |
| `company` | string | Raison sociale |
| `street1` | string | 1re ligne d'adresse |
| `street2` | string | 2e ligne |
| `street3` | string | 3e ligne |
| `city` | string | Ville |
| `state` | string | État / province |
| `postalCode` | string | Code postal |
| `country` | string | **Code pays ISO à 2 lettres — requis** |
| `phone` | string | Téléphone |
| `residential` | boolean | Adresse résidentielle (impacte la tarification) |
| `addressVerified` | string | **Lecture seule** — statut de validation |

### Statuts de validation d'adresse (v1)
- `Address not yet validated`
- `Address validated successfully`
- `Address validation warning`
- `Address validation failed`

> Ce sont des **libellés en clair**, pas des codes — un piège si l'on tente une comparaison sur un enum machine. En v2, les statuts sont normalisés (`unverified` / `verified` / `warning` / `error`).

---

## 2.6 Modèles de mesure

### `Weight`
| Champ | Type | Description |
|---|---|---|
| `value` | number | Valeur du poids |
| `units` | string | `pounds` \| `ounces` \| `grams` |
| `WeightUnits` | number | Lecture seule — équivalent numérique des unités `[à vérifier]` |

### `Dimensions`
| Champ | Type | Description |
|---|---|---|
| `length` | number | Longueur |
| `width` | number | Largeur |
| `height` | number | Hauteur |
| `units` | string | `inches` \| `centimeters` |

---

## 2.7 Modèle `InsuranceOptions`

| Champ | Type | Description |
|---|---|---|
| `provider` | string | `shipsurance` \| `carrier` \| `provider` \| `xcover` \| `parcelguard` |
| `insureShipment` | boolean | Assurer l'expédition |
| `insuredValue` | number | Valeur assurée |

> `provider` = tiers ayant géré l'assurance hors ShipStation (facturation externe). `[à vérifier]` — Le schéma OpenAPI mentionne aussi `none` comme valeur possible ; à traiter comme équivalent de `insureShipment: false`.

---

## 2.8 Modèle `InternationalOptions` + `CustomsItem`

### `InternationalOptions`
| Champ | Type | Description |
|---|---|---|
| `contents` | string | `merchandise` \| `documents` \| `gift` \| `returned_goods` \| `sample` |
| `customsItems` | CustomsItem[] | Lignes de douane |
| `nonDelivery` | string | `return_to_sender` \| `treat_as_abandoned` |

**Règles de défaut de `nonDelivery`** (important à répliquer) :
- via `Orders/CreateLabelForOrder` → défaut selon les réglages UI du compte
- via `Shipments/CreateLabel` → défaut `return_to_sender` si non spécifié

**Règle de non‑écrasement** : les `customsItems` fournis dans `CreateOrder` ne sont conservés que si le réglage UI « International Settings » est positionné sur *Leave blank (Enter Manually)*. Sinon ShipStation les régénère.

### `CustomsItem`
| Champ | Type | Lecture seule | Description |
|---|---|---|---|
| `customsItemId` | string | ✅ | Si omis → nouvelle ligne ; si fourni dans un `CreateOrder` → met à jour la ligne existante |
| `description` | string | | Description courte |
| `quantity` | number | | Quantité |
| `value` | number | | Valeur **en USD** |
| `harmonizedTariffCode` | string | | Code SH / HS |
| `countryOfOrigin` | string | | Code ISO 2 lettres du pays d'origine |

---

## 2.9 Modèle `AdvancedOptions`

| Champ | Type | Lecture seule | Description |
|---|---|---|---|
| `warehouseId` | number | | Entrepôt d'expédition. `null` pour les commandes de prestataires de fulfillment |
| `nonMachinable` | boolean | | Colis non traitable par équipement postal automatisé |
| `saturdayDelivery` | boolean | | Livraison le samedi |
| `containsAlcohol` | boolean | | Contient de l'alcool |
| `storeId` | number | | Boutique associée. **Défaut = première boutique manuelle** si non fourni à la création |
| `customField1` | string | | Donnée personnalisée |
| `customField2` | string | | Selon réglage UI, **peut apparaître sur certaines étiquettes transporteur** |
| `customField3` | string | | Donnée personnalisée |
| `source` | string | | Source/marketplace d'origine de la commande |
| `mergedOrSplit` | boolean | ✅ | La commande a été fusionnée ou scindée |
| `mergedIds` | number[] | ✅ | IDs des commandes fusionnées |
| `parentId` | number | ✅ | Commande parente si scindée |
| `billToParty` | string | | `my_account` \| `my_other_account` \| `recipient` \| `third_party` |
| `billToAccount` | string | | Numéro de compte du payeur |
| `billToPostalCode` | string | | Code postal du payeur |
| `billToCountryCode` | string | | Code pays du payeur |
| `billToMyOtherAccount` | string | | ID du fournisseur d'expédition si facturation sur compte secondaire connecté |

> Certains champs ne sont modifiables **qu'à la création** via `CreateOrder`.

---

## 2.10 Modèle `Shipment` (v1)

| Champ | Type | Description |
|---|---|---|
| `shipmentId` | integer | Identifiant unique |
| `orderId` | integer | Commande associée |
| `orderKey` | string | Clé de commande |
| `orderNumber` | string | Numéro de commande |
| `userId` | string | Utilisateur ayant créé l'expédition |
| `customerEmail` | string | Courriel client |
| `createDate` | date-time | Création |
| `shipDate` | date | Date d'expédition |
| `shipmentCost` | number | Coût d'expédition |
| `insuranceCost` | number | Coût d'assurance |
| `otherCost` | number | Frais additionnels |
| `trackingNumber` | string | Numéro de suivi |
| `isReturnLabel` | boolean | Étiquette de retour |
| `batchNumber` | string \| null | Numéro de lot |
| `carrierCode` | string | Transporteur |
| `serviceCode` | string | Service |
| `packageCode` | string | Type de colis |
| `confirmation` | string | Confirmation de livraison |
| `warehouseId` | integer \| null | Entrepôt d'origine |
| `voided` | boolean | Étiquette annulée |
| `voidDate` | date-time \| null | Date d'annulation |
| `marketplaceNotified` | boolean | La marketplace a été notifiée |
| `notifyErrorMessage` | string \| null | Message d'erreur de notification |
| `shipTo` | Address | Destinataire |
| `weight` | Weight | Poids |
| `dimensions` | Dimensions \| null | Dimensions |
| `insuranceOptions` | InsuranceOptions | Assurance |
| `advancedOptions` | AdvancedOptions | Options avancées |
| `shipmentItems` | OrderItem[] | Articles (si `includeShipmentItems=true`) |
| `labelData` | string (base64) | PDF de l'étiquette encodé |
| `formData` | string \| null | Formulaires douaniers encodés |

### Paramètres `GET /shipments`
`recipientName`, `recipientCountryCode`, `orderNumber`, `orderId`, `carrierCode`, `serviceCode`, `trackingNumber`, `createDateStart`/`End`, `shipDateStart`/`End`, `voidDateStart`/`End`, `storeId`, `includeShipmentItems`, `sortBy` (`ShipDate`\|`CreateDate`), `sortDir`, `page`, `pageSize`.

> **Important :** seules les expéditions dont l'étiquette a été générée *dans* ShipStation apparaissent. Les commandes « Mark as Shipped » ne créent **pas** de Shipment — elles créent un **Fulfillment**.

---

## 2.11 Labels et Rates (v1)

### `POST /shipments/createlabel` — étiquette autonome

| Champ | Type | Requis | Description |
|---|---|---|---|
| `carrierCode` | string | ✅ | ex. `fedex` |
| `serviceCode` | string | ✅ | ex. `fedex_ground` |
| `packageCode` | string | ✅ | ex. `package` |
| `confirmation` | string | | voir §4.2 |
| `shipDate` | string | ✅ | `YYYY-MM-DD` |
| `weight` | Weight | ✅ | |
| `dimensions` | Dimensions | | |
| `shipFrom` | Address | ✅ | |
| `shipTo` | Address | ✅ | |
| `insuranceOptions` | object | | |
| `internationalOptions` | object | | |
| `advancedOptions` | object | | |
| `testLabel` | boolean | | défaut `false` |

**Réponse :** `shipmentId`, `shipmentCost`, `insuranceCost`, `trackingNumber`, `labelData` (PDF base64), `formData`, plus les échos `carrierCode`/`serviceCode`/`packageCode`/`confirmation`, `createDate`, `voided`, `warehouseId`.

> **Contrainte :** il faut au moins une **Manual Store active** sur le compte, sinon erreur 500.

### `POST /orders/createlabelfororder`

| Champ | Type | Requis |
|---|---|---|
| `orderId` | number | ✅ |
| `carrierCode` | string | ✅ |
| `serviceCode` | string | ✅ |
| `confirmation` | string | ✅ |
| `shipDate` | string | ✅ |
| `weight` | Weight | |
| `dimensions` | Dimensions | |
| `insuranceOptions` | object | |
| `internationalOptions` | object | |
| `advancedOptions` | object | |
| `testLabel` | boolean | ✅ (USPS seulement) |

**Réponse :** `{ shipmentId, shipmentCost, insuranceCost, trackingNumber, labelData, formData }`
**Effet de bord :** la commande passe en `shipped`.

### `POST /shipments/voidlabel`
Requête : `{ "shipmentId": 12345 }` → Réponse : `{ "approved": true, "message": "Label voided successfully" }`

### `POST /shipments/getrates`

| Champ | Type | Requis | Note |
|---|---|---|---|
| `carrierCode` | string | ✅ | |
| `serviceCode` | string | | si omis → tous les services |
| `packageCode` | string | | |
| `fromPostalCode` | string | ✅ | |
| `fromCity`, `fromState` | string | | |
| `fromWarehouseId` | string | | ignoré si city/state fournis |
| `toPostalCode` | string | ✅ | |
| `toCity` | string | | |
| `toState` | string | | **requis pour UPS** |
| `toCountry` | string | ✅ | ISO 2 lettres |
| `weight` | Weight | ✅ | |
| `dimensions` | Dimensions | | |
| `confirmation` | string | | |
| `residential` | boolean | | défaut `false` |

**Réponse :** tableau de `{ serviceName, serviceCode, shipmentCost, otherCost }`.

### `POST /orders/markasshipped`

| Champ | Type | Requis | Défaut |
|---|---|---|---|
| `orderId` | number | ✅ | |
| `carrierCode` | string | ✅ | |
| `shipDate` | string | | |
| `trackingNumber` | string | | |
| `notifyCustomer` | boolean | | `false` |
| `notifySalesChannel` | boolean | | `false` |

**Réponse :** `{ orderId, orderNumber }`

---

## 2.12 Carriers / Services / Packages

### `Carrier`
| Champ | Type | Description |
|---|---|---|
| `name` | string | ex. « Stamps.com » |
| `code` | string | ex. `stamps_com` |
| `accountNumber` | string | Numéro de compte |
| `requiresFundedAccount` | boolean | Compte prépayé requis |
| `balance` | number | Solde courant |
| `nickname` | string \| null | Surnom du compte |
| `shippingProviderId` | number | Identifiant fournisseur |
| `primary` | boolean | Transporteur par défaut |

### `Service`
| Champ | Type |
|---|---|
| `carrierCode` | string |
| `code` | string (ex. `fedex_ground`) |
| `name` | string (ex. « FedEx Ground® ») |
| `domestic` | boolean |
| `international` | boolean |

### `Package`
| Champ | Type |
|---|---|
| `carrierCode` | string |
| `code` | string (ex. `flat_rate_envelope`) |
| `name` | string |
| `domestic` | boolean |
| `international` | boolean |

### `POST /carriers/addfunds`
`{ carrierCode, amount }` — montant entre **10,00 $ et 10 000,00 $**. Nécessite une approbation préalable de l'équipe développeurs ShipStation. Réponse = objet Carrier avec solde mis à jour.

---

## 2.13 Customers

| Champ | Type | Description |
|---|---|---|
| `customerId` | number | Identifiant système |
| `createDate` | date-time | |
| `modifyDate` | date-time | |
| `name` | string | |
| `company` | string | |
| `street1`, `street2` | string | |
| `city`, `state`, `postalCode` | string | |
| `countryCode` | string | ISO 2 lettres |
| `phone` | string | |
| `email` | string | |
| `addressVerified` | string | Statut de validation |
| `marketplaceUsernames` | array | Identités du client par marketplace |
| `tags` | array | `{ tagId, name }` |

### `marketplaceUsernames[]`
| Champ | Type |
|---|---|
| `customerUserId` | number |
| `customerId` | number |
| `createDate` | date-time \| null |
| `modifyDate` | date-time \| null |
| `marketplaceId` | number |
| `marketplace` | string |
| `username` | string |

> **Point de modélisation clé :** un `Customer` est une **entité dédupliquée transversale aux canaux**, reliée à N identités marketplace. C'est ce qui permet de voir l'historique d'un même acheteur sur Amazon et Shopify. À répliquer avec une table de jointure.

### Paramètres `GET /customers`
`stateCode`, `countryCode`, `marketplaceId`, `tagId`, `sortBy` (`Name`\|`ModifyDate`\|`CreateDate`), `sortDir`, `page`, `pageSize` (1–500).

---

## 2.14 Fulfillments

Un **Fulfillment** représente une expédition **non réalisée par ShipStation** : soit « Mark as Shipped » manuel, soit exécution par un prestataire externe (FBA, 3PL).

| Champ | Type | Description |
|---|---|---|
| `fulfillmentId` | integer | Identifiant |
| `orderId` | integer | Commande |
| `orderNumber` | string | Numéro de commande |
| `trackingNumber` | string | Suivi |
| `shipDate` | string | Date d'expédition |
| `carrierCode` | string | Transporteur |
| `serviceCode` | string | Service |

> `[à vérifier]` La documentation historique mentionne également : `userId`, `customerEmail`, `createDate`, `fulfillmentProviderCode`, `fulfillmentServiceCode`, `fulfillmentFee`, `voidRequested`, `voided`, `voidDate`, `marketplaceNotified`, `notifyErrorMessage`, `shipTo` (Address). La spec OpenAPI actuelle n'expose que les 7 champs ci‑dessus — je recommande de modéliser les 15 champs pour être sûr.

### Paramètres `GET /fulfillments`
`fulfillmentId`, `orderId`, `orderNumber`, `trackingNumber`, `recipientName`, `createDateStart`/`End`, `shipDateStart`/`End`, `sortBy` (`ShipDate`\|`CreateDate`), `sortDir`, `page`, `pageSize` (max 500).

---

## 2.15 Products

| Champ | Type | Lecture seule | Description |
|---|---|---|---|
| `productId` | number | ✅ | Identifiant |
| `sku` | string | | SKU |
| `name` | string | | Nom / description |
| `price` | number | | Prix unitaire |
| `defaultCost` | number | | Coût vendeur |
| `length`, `width`, `height` | number | | Unité selon réglages UI |
| `weightOz` | number | | Poids en onces |
| `internalNotes` | string | | Notes privées |
| `fulfillmentSku` | string | | SKU pour fulfillment tiers |
| `createDate` | string | ✅ | |
| `modifyDate` | string | ✅ | |
| `active` | boolean | | Produit actif |
| `productCategory` | object | | `{ categoryId, name }` `[à vérifier]` |
| `productType` | string | | Type de produit |
| `warehouseLocation` | string | | Emplacement |
| `defaultCarrierCode` | string | | Transporteur domestique par défaut |
| `defaultServiceCode` | string | | Service domestique par défaut |
| `defaultPackageCode` | string | | Colis domestique par défaut |
| `defaultIntlCarrierCode` | string | | Transporteur international par défaut |
| `defaultIntlServiceCode` | string | | Service international par défaut |
| `defaultIntlPackageCode` | string | | Colis international par défaut |
| `defaultConfirmation` | string | | Confirmation domestique par défaut |
| `defaultIntlConfirmation` | string | | Confirmation internationale par défaut |
| `customsDescription` | string | | Description douanière |
| `customsValue` | number | | Valeur déclarée |
| `customsTariffNo` | string | | Code SH |
| `customsCountryCode` | string | | Pays d'origine ISO 2 |
| `noCustoms` | boolean | | Exclure des formulaires douaniers |
| `tags` | array | | ProductTags `{ tagId, name }` `[à vérifier]` |

### Paramètres `GET /products`
`sku`, `name`, `productCategoryId`, `productTypeId`, `tagId`, `startDate`, `endDate`, `showInactive`, `sortBy` (`SKU`\|`ModifyDate`\|`CreateDate`), `sortDir`, `page`, `pageSize` (max 500).

---

## 2.16 Stores et Marketplaces

### `Store`
| Champ | Type | Description |
|---|---|---|
| `storeId` | integer | Identifiant |
| `storeName` | string | Nom affiché |
| `marketplaceId` | integer | Type de marketplace (0 = manuel, 36 = WooCommerce…) |
| `marketplaceName` | string | Nom lisible |
| `accountName` | string \| null | Compte |
| `email` | string \| null | Courriel |
| `integrationUrl` | string \| null | **URL du endpoint pour les custom stores** |
| `active` | boolean | Boutique active |
| `companyName` | string | |
| `phone` | string | |
| `publicEmail` | string | |
| `website` | string | |
| `refreshDate` | date-time | Dernière synchro réussie |
| `lastRefreshAttempt` | date-time | Dernière tentative |
| `createDate` | date-time | |
| `modifyDate` | date-time | |
| `autoRefresh` | boolean | Import automatique activé |
| `statusMappings` | array | Correspondance statuts ShipStation ↔ canal |

### `statusMappings[]`
```json
[
  { "orderStatus": "awaiting_payment",  "statusKey": "Pending"    },
  { "orderStatus": "awaiting_shipment", "statusKey": "Processing" },
  { "orderStatus": "shipped",           "statusKey": "Completed"  },
  { "orderStatus": "cancelled",         "statusKey": "Cancelled"  },
  { "orderStatus": "on_hold",           "statusKey": "On-hold"    }
]
```

> **Concept central à répliquer :** chaque boutique porte sa propre table de traduction entre le vocabulaire de statut du canal (`statusKey`) et le vocabulaire canonique interne (`orderStatus`). C'est ce qui permet d'unifier N canaux hétérogènes.

### `Marketplace`
| Champ | Type | Description |
|---|---|---|
| `name` | string | ex. « Shopify » |
| `marketplaceId` | integer | ex. 36 |
| `canRefresh` | boolean | Supporte le polling |
| `supportsCustomMappings` | boolean | Supporte les mappings de statut personnalisés |
| `supportsCustomStatuses` | boolean | Supporte des statuts personnalisés |
| `canConfirmShipments` | boolean | Supporte l'écriture retour du tracking |

**IDs de marketplace confirmés :** `0` Manual · `2` Amazon · `23` 3DCart · `32` Amazon CA · `36` WooCommerce. La liste complète (plus de 100 intégrations) n'est disponible que via un appel authentifié à `/stores/marketplaces`. `[à vérifier]`

### `POST /stores/refreshstore`
| Paramètre | Type | Description |
|---|---|---|
| `storeId` | integer (optionnel) | Si omis → toutes les boutiques rafraîchissables |
| `refreshDate` | string (optionnel) | Point de départ pour l'import d'historique, format PST `YYYY-MM-DD HH:MM:SS` |

Réponse : `{ "success": true, "message": "Store refresh initiated" }`. Le statut se consulte via `GET /stores/getrefreshstatus?storeId=`.

---

## 2.17 Users, Warehouses, Tags

### `User`
| Champ | Type | Description |
|---|---|---|
| `userId` | string (UUID) | Identifiant |
| `userName` | string | Nom de connexion |
| `name` | string | Nom affiché |

Paramètre : `showInactive` (boolean).

### `Warehouse` (Ship From Location)
| Champ | Type | Description |
|---|---|---|
| `warehouseId` | integer | Identifiant |
| `warehouseName` | string | Nom |
| `originAddress` | Address | Adresse d'expédition |
| `returnAddress` | Address | Adresse de retour |
| `createDate` | date-time | |
| `isDefault` | boolean | Entrepôt par défaut |

### `Tag`
| Champ | Type | Description |
|---|---|---|
| `tagId` | integer | Identifiant |
| `name` | string | Nom du tag |
| `color` | string | Couleur **hexadécimale** (ex. `#800080`, `#ff0000`) |

> Il n'existe **pas** de palette fermée de couleurs de tag : `color` est un hex libre à 7 caractères. Les couleurs vues dans la doc : `#800080` (violet), `#ff0000` (rouge). L'UI propose une palette prédéfinie, mais l'API accepte tout hex. `[à vérifier]`

---

## 2.18 Webhooks (v1)

### `POST /webhooks/subscribe`
| Champ | Type | Requis | Description |
|---|---|---|---|
| `target_url` | string | ✅ | URL de destination |
| `event` | string | ✅ | Type d'événement |
| `store_id` | number | | Limite le webhook à une boutique |
| `friendly_name` | string | | Nom d'affichage |

Réponse : `{ "id": 123456 }`

### Événements v1 (6)
| Événement | Déclenchement |
|---|---|
| `ORDER_NOTIFY` | Nouvelle commande créée dans **tout statut sauf** `awaiting_payment`, **ou** commande en `awaiting_payment` passant à un autre statut. Un import multi‑commandes → **un seul** payload |
| `ITEM_ORDER_NOTIFY` | Identique, mais données au **niveau article** |
| `SHIP_NOTIFY` | Création d'une nouvelle **étiquette sortante**. Les retours et les expéditions de prestataires de fulfillment **ne déclenchent pas**. Un lot → un seul événement ; expéditions individuelles → un événement chacune |
| `ITEM_SHIP_NOTIFY` | Identique, niveau article |
| `FULFILLMENT_SHIPPED` | Commande déléguée passant de `pending_fulfillment` à `shipped`, ou via « Mark as Shipped » |
| `FULFILLMENT_REJECTED` | Le prestataire de fulfillment rejette une commande déléguée |

### Payload webhook v1
```json
{
  "resource_url": "https://ssapi.shipstation.com/orders?storeId=12345&importBatch=abc-123",
  "resource_type": "ORDER_NOTIFY"
}
```

| Champ | Type | Description |
|---|---|---|
| `resource_url` | string | URL à appeler (avec vos credentials) pour récupérer la ressource. **Limite de 200 caractères** |
| `resource_type` | string | Un des 6 événements ci‑dessus |

**Paramètres présents dans `resource_url` :** `storeID`, `importBatch`/`batchId`, et `includeOrderItems=True` / `includeShipmentItems=True` pour les variantes ITEM_*.

> **Architecture « thin webhook » :** ShipStation n'envoie **pas** les données, seulement un pointeur. Le consommateur doit rappeler l'API — ce qui consomme du quota de rate limit. À répliquer ou à améliorer (payload complet) selon le besoin.

### Objet webhook interne (retourné par `GET /webhooks`)
`WebHookID`, `SellerID`, `StoreID`, `HookType`, `MessageFormat`, `Url`, `Name`, `BulkCopyBatchID`, `BulkCopyRecordID`, `Active`, `WebHookLogs[]`, `Seller`, `Store`.
> Nommage en PascalCase, incohérent avec le reste de l'API — vestige interne. Les webhooks créés par API **ne peuvent être modifiés que via l'UI** (Settings > Integrations > Integration Partners).

---

<a name="3"></a>
