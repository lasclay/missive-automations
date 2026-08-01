# Spécification complète de ShipStation — Compte Lasclay

**Document de transfert vers Claude Code pour la construction d'une alternative maison**

| | |
|---|---|
| **Date de capture** | 31 juillet 2026 |
| **Compte capturé** | Lasclay — `admin@lasclay.com` — Seller ID `5756672` |
| **Instance** | `ship15.shipstation.com` (interface « legacy V3 ») |
| **Forfait** | Standard `standard_2025q2` — 39,99 CAD/mois — 2 000 expéditions/mois — 10 utilisateurs — support KnowledgeBase / Email / Chat |
| **Méthode** | Navigation exhaustive de l'UI + extraction directe de l'API interne `/api/*` du navigateur authentifié |
| **Objectif** | Permettre une reconstruction fonctionnellement équivalente, puis une **transition sans rupture** (seamless) |

> **Comment lire ce document.**
> - **§ 1 à § 12.3** — ce que ShipStation *fait* : écrans, workflows, modèles de données génériques.
> - **§ 12.4, § 12.5 et § 13** — la **configuration réelle de Lasclay** : 11 règles d'automatisation, 27 vues sauvegardées, boutiques, entrepôts, transporteurs, préréglages, étiquettes, réglages. C'est la charge utile de migration, et c'est ce qu'aucune API publique n'expose.
> - **§ 14** — l'API interne découverte (référence de modèle de données).
> - **§ 15** — défauts constatés (`OBS1`…`OBS10`) + critiques publiques récentes, traduits en exigences numérotées `A1`…`H2`.
> - **§ 16** — état et plan de complétion des codes SH.
> - **§ 17** — plan de transition sans rupture.
> - **§ 18** — les 10 exigences prioritaires.
> - **Annexes A / B / C / D** — captures, questions ouvertes à trancher, script d'export JSON complet, correspondance d'identifiants.
>
> **Convention de nommage.** `OBS1`…`OBS10` = constats faits directement sur le compte Lasclay (§ 15.1). `A1`…`H2` = exigences produit (§ 15.2). Les deux espaces sont disjoints : une référence `D1` désigne toujours une exigence du bloc D (automatisation), jamais un constat.

---

## 1. Vue d'ensemble de l'application

### 1.1 Structure de navigation

**Barre supérieure (navigation primaire), de gauche à droite :**

| Élément | Route | Rôle |
|---|---|---|
| Logo ShipStation | `/orders` | Retour à l'accueil (configurable via `DefaultUrl`) |
| **Analytics** | `/dashboard/operations` | Tableaux de bord et rapports |
| **Automations** | `/automations` | Hub d'automatisation (règles, mappings, presets, SmartFill, Rate Shopper) |
| **Orders** | `/orders/...` | Grille des commandes — écran principal |
| **Shipments** | `/shipments/...` | Expéditions créées, fulfillments, fin de journée, cueillettes, lots |
| **Returns** | `/returns` | Retours (RMA) |
| **Products** | `/products` | Catalogue produits, groupes de préréglages, inventaire, achats |
| **Customers** | `/customers` | Base clients dérivée des commandes |
| **Scan** | `/scan` | Poste de scan (Scan to Print / Scan to Verify) |
| **Rates** | modale | Explorateur de tarifs (Rate Browser) |

**Icônes en haut à droite, de gauche à droite :**

1. **Rafraîchir les boutiques** (icône ↻ avec pastille) — ouvre un panneau « N Active Stores » listant chaque boutique avec son statut de dernière synchronisation, un bouton ↻ par boutique et un bouton **Update All**.
2. **Solde / portefeuille** (icône imprimante-balance) — accès au wallet transporteur.
3. **Paramètres** (engrenage) — `/settings`.
4. **Aide** (?) — centre d'aide + assistant IA.
5. **Compte utilisateur** (silhouette).

Un **bandeau d'alerte global** occupe le haut de toutes les pages (ex. : *« Please add your valid Tax ID — Add your Tax ID »*).

### 1.2 Le patron d'écran récurrent

Presque tous les modules suivent le même patron, qu'une alternative doit reproduire :

```
┌─ Barre de nav primaire ────────────────────────────────────────────┐
├──────────┬─────────────────────────────────────────────────────────┤
│ Sidebar  │ Titre de la vue          [Group By...] [Columns]        │
│ gauche : │ ─────────────────────────────────────────────────────── │
│ - recher-│ Barre d'actions en masse (grisée si rien de sélectionné) │
│   che    │ ─────────────────────────────────────────────────────── │
│ - statuts│ Onglets de sous-vue (« All », etc.)                     │
│   + comp-│ ─────────────────────────────────────────────────────── │
│   teurs  │ Filter By: [chips de filtres] [Saved Filters]           │
│ - sous-  │ ─────────────────────────────────────────────────────── │
│   filtres│ GRILLE : cases à cocher, colonnes triables/redimension- │
│ - lots   │ nables/réordonnables, ligne extensible (chevron ›)       │
│          │ ─────────────────────────────────────────────────────── │
│          │ Pied : « Viewing 1-250 of 412 » · pagination · par page │
└──────────┴─────────────────────────────────────────────────────────┘
```

**Caractéristiques transversales de la grille :**

- Sélection par case à cocher, avec « tout sélectionner » dans l'en-tête ; compteur « N Selected » en pied de page.
- Les colonnes sont **triables** (indicateur `sorted: ascending|descending`), **redimensionnables** (largeur en px persistée), **réordonnables** (index persisté) et **épinglables** (`pinned: true|false`).
- La configuration de colonnes est persistée **par utilisateur et par vue** (voir § 14.4).
- Taille de page configurable : 100 / 250 / 500. Valeurs actuelles Lasclay : commandes 250, produits 500, expéditions 500.
- Le chevron `›` en début de ligne déplie un panneau de détail inline (les articles de la commande).

---

## 2. Module Orders

### 2.1 Statuts et arborescence de la sidebar

```
Recherche « Search Orders… » + lien « Advanced Search »
├─ Awaiting Payment          (compteur)
├─ On Hold                   (compteur)
├─ Awaiting Shipment         (compteur)
│   ├─ [une entrée par boutique active, avec compteur]
│   │   FAIRE Lasclay · LAS Etsy · LAS Shopify · Manual Orders
├─ Shipped
├─ Cancelled
└─ Order Alerts
    └─ Combine Shipments   ← détection d'opportunités de regroupement
─────────────────────────
Open Batches               ← lots ouverts, avec compteur et « + » d'ajout rapide
  [liste des lots ouverts]
+ Create New Batch
```

**Machine à états des commandes :**

`awaiting_payment` → `awaiting_shipment` → `shipped`
avec branches `on_hold` (retour possible vers `awaiting_shipment`) et `cancelled`.

Les statuts sont pilotés à l'import par le mapping du canal de vente (ex. Shopify : `partially_paid` → Awaiting Payment, `authorized` → Awaiting Payment, `voided/pending` → Awaiting Payment, chacun configurable).

### 2.2 Barre d'actions (état sélectionné)

| Action | Comportement |
|---|---|
| **Create + Print Label** (+ menu déroulant) | Achat et impression d'étiquette en masse |
| **Get Rate** | Calcul de tarif pour la sélection |
| **Print** (menu) | Étiquettes, bons de préparation (packing slips), listes de prélèvement (pick lists), feuille de codes-barres |
| **Ready To Pick** | Envoi vers la file de prélèvement |
| **Hold** | Mise en attente |
| **Assign To** (menu) | Attribution à un utilisateur |
| **Tag** (menu) | Application / retrait d'étiquettes |
| **New Order** | Création manuelle (formulaire complet, § 2.6) |
| **Bulk Update** (menu) | Mise à jour en masse — 21 champs sous 2 intertitres (§ 2.3) |
| **Allocate** (menu) | Allocation d'inventaire |
| **Other Actions** (menu) | Cancel · Combine Shipments · Show Split Ship Actions · Mark As Shipped · Mark As Shipped Bulk · Refresh Selected Orders · Import Orders · Export Orders · Add to Batch · Barcode Search · Validate Address · Manage Presets |

### 2.3 Menu « Bulk Update » — champs modifiables en masse

Le menu comporte deux intertitres non cliquables (**Order**, **Shipment**) suivis de 21 champs :

Ship by Date · Add Note · Apply Shipping Preset · Custom Field 1 · Custom Field 2 · Custom Field 3 · Service · Shipping Account · Package · Weight · Size · Ship From · Insurance · Confirmation · Do Not Notify Marketplace · Email Template · Packing Slip Template · Other Shipping Options · Customs Declarations · Tax Identifiers · Prepay Duties and Taxes

### 2.4 Filtres de la grille (barre « Filter By »)

Chips disponibles : **Store · Destination · Assignee · Tag · Allocation Status · Order Date · Other** + **Saved Filters**.

**Recherche avancée** (panneau latéral gauche, remplace la sidebar) :
Order Status · Store · Order # · Recipient Name · Email · Item Name · Item SKU · Item Option · Order Date (plage de/à) · boutons Reset / Search.

### 2.5 Colonnes disponibles (51)

`Age`, `Allocation Status`, `Amount Paid`, `Assigned To`, `Batch`, `Buyer`, `Buyer ID`, `Carrier`, `Company`, `Confirmation`, `Country`, `Custom Field 1`, `Custom Field 2`, `Custom Field 3`, `Deliver By`, `Fulfillment Status`, `Gift`, `Hold Until`, `Item Name`, `Item SKU`, `Notes`, `Order Date`, `Order #`, `Order Total`, `Package`, `Packing Slip Printed`, `Paid Date`, `Pick List Printed`, `Picking Status`, `Premium Programs`, `Quantity`, `Rate`, `Rate Shopper`, `Recipient`, `Requested Service`, `Service`, `Ship By`, `Ship Date`, `Ship From`, `Shipping Account`, `Shipping Paid`, `Source`, `State`, `Status`, `Store`, `Tags`, `Tax Paid`, `Tote`, `Warehouse Location`, `Weight`, `Zone`

*Colonnes actives chez Lasclay (12) :* Order # · Age · Order Date (tri desc.) · Notes · Gift · Item SKU · Item Name · Batch · Recipient · Quantity · Order Total · Tags

### 2.6 Écran de détail d'une commande (modale plein écran)

Route : `/orders/{statut}/order/{orderGuid}/active/{shipmentId}`

**En-tête :** logo de la boutique · `Boutique : Order # X` · bouton **Batch** (+menu) · bouton **Print** (+menu) · fermeture ✕ · flèches ‹ › de navigation entre commandes.

**Rail gauche — SHIPMENTS :** liste des expéditions de la commande + bouton `+` (split ship). Deux icônes verticales avec compteurs (expéditions / documents).

**Colonne centrale (6 blocs) :**

**① Shipment Details**
- *Ship To Address* — nom, adresse complète, téléphone, courriel, badge **Address Validated** (ou avertissement), lien **Edit**, case **This is a gift**
- *Cost Summary* (éditable) — Product · Shipping · Tax · Total · **Total Paid**
- *Recipient Tax Information* — « N Tax IDs added » + **Add**
- *Deliver By* / *Ship By* / *Hold Until* / *Date Paid* — sélecteurs de date
- *Assigned To* · *Batch* (« Add To Batch »)

**② Shipment Items** — actions **Edit**, **Split Ship**, **Scan to Verify** ; colonnes Item Name (+ SKU) · Image · Unit Cost · Quantity · Total

**③ Customs Declarations** (compteur de déclarations)
- *Select Contents* (Merchandise, Gift, Documents, Sample, Returned Goods…)
- *If Undeliverable* (Return To Sender, Treat As Abandoned…)
- *Duties Paid*, *Postage Paid*, *Export Declaration Number*, *Invoice Number*
- Bascule **List View / Tab View** ; une déclaration par article, onglets `Declaration 1`, `Declaration 2`, …
- Champs par déclaration : **Description*** · SKU · MID code · Certificate Version ID · Certifier ID · **Quantity*** · **Item Value (ea)*** · Total Value · **Harmonization System (HS) Code** (+ bouton **Find HS Code**) · **Country of Origin***
- *Upload Customs Documents* — dépôt de fichier, option « je téléverserai après achat de l'étiquette »

**④ Notes** — Note From Buyer · Note To Buyer · Gift Note · Internal Note · **Custom Field 1 / 2 / 3**
**⑤ Customer Communication** (repliable)
**⑥ Shipment Activity** — journal horodaté et attribué (System / ShipStation / utilisateur), avec « Load more ». Exemples réels observés :
- `Address Verification overrode address provided by marketplace — Postal Code changed from 94305 to 94305-1014`
- `Insurance provider automatically set to XCover`
- `Insured value automatically set to 183.64`
- `Order #L-50762 imported from marketplace as 'Paid'`
- `Marketplace Mapping (Free shipping) Applied: Provider: None, Service: Expedited Parcel (Carbon Neutral), Package: Package.`

**Colonne droite — Configure Shipment**
- **Ship Today** (menu) · **Preset** (menu)
- *Requested* : service demandé par le client + mention `(unmapped)` si non mappé + bouton **Browse Rates**
- **Ship From** (menu) — avertissement contextuel si divergence : *« Shopify's Location: Entrepôt Lasclay »*
- **Weight** — kg / g + bouton **Scale** (balance USB)
- **Service** (+ « Sort by »)
- **Package** (+ **Add Package** pour le multi-colis)
- **Size (in)** — L / W / H
- **Confirmation**
- Bandeau d'assurance : *« Your shipment is insured by our coverage »*
- **Other Shipping Options** : Shipping Account · Movement Indicator · *Shipment Options* (non-machinable) · *Delivery Options* (C.O.D.) · *Label Options* (Dry Ice, étiquette de retour incluse, affranchissement imprimé) · *Marketplace Options* (Do not notify marketplace)
- Pied fixe : coût estimé, **Cost Review**, **Create + Print Label** (+ menu), **Estimated Arrival**

**Formulaire « New Order » (commande manuelle) :**
Recipient Information (Name* · Company · Country* · Address 1-3 · City* · Province* · Postal Code* · Phone · Email) | Order Summary Information (Store · Order # avec case *Autogenerate Order #* · Order Date · Paid Date · Shipping Paid · Tax Paid · Total Paid) | Order Line Items (SKU · Name · Quantity · Price) + « Add a Line Item ».

### 2.7 Lots (Batches)

Les lots regroupent des commandes pour un traitement conjoint. Ils apparaissent dans la sidebar Orders (**Open Batches**) et sous **Shipments → Batches**. Chaque lot porte un nom libre et un compteur.

*Lots ouverts chez Lasclay au moment de la capture :* Timbre 22 juillet (2) · Timbre 14 juillet (3) · Graines 6 juillet (2) · USA 2026-06-30 (5) · JSB 2026-06-02 (5) · USA horticole (2) · USA textile (1).

### 2.8 Order Alerts

Sous-vue **Combine Shipments** : *« Consider shipping these orders together to save on shipping cost »*, avec actions **Combine Shipments** et **Dismiss**. C'est un moteur de suggestions basé sur la détection de destinataires identiques.

---

## 3. Module Shipments

### 3.1 Arborescence

```
Search Shipments… + Advanced Search
├─ Shipped
│   ├─ Recent
│   ├─ In Transit
│   ├─ Delivered
│   ├─ Delivery Exceptions
│   ├─ Voided
│   └─ Pending Customs Documents
├─ Fulfillments
│   ├─ Recent · Pending · In Transit · Delivered
│   ├─ Delivery Exception · Cancelled
│   └─ Returns
├─ Returns
├─ End of Day
│   ├─ Manifests
│   └─ Container Shipments
├─ Carrier Pickups
└─ Batches
```

### 3.2 Vue « Shipped »

Actions : **Print** · Void Label · Update Tracking · Send Notifications · Notify Marketplace · Assign To · Create Return · **Export Shipments**
Filtres : Store · Carrier · Ship From · Country · **Ship Date** · Shipping Account · Other · *Clear Filters*
Colonnes : Shipment # · Order # · Tracking # · Service · Recipient · Ship Date · **Packing Slip Printed** · **Label Created** · **Label Printed** · **Marketplace Notified** · **Shipment Notification** · **Delivery Notification**

Les quatre dernières colonnes sont des **indicateurs d'état de communication** (icônes + horodatage) — un modèle à reprendre : chaque événement sortant (impression, notification marketplace, courriel client, courriel de livraison) est tracé individuellement.

### 3.3 Vue « Fulfillments »

Volume observé : **14 406 lignes**. Actions : Cancel Fulfillment · Update Status · Send Notifications · Notify Marketplace · Create Return · Export.
Colonnes : Created Date · **Delegation Date** · Ship Date · **Status** (Complete / Shipped / Pending / Cancelled) · Order # · Quantity · Batch · Tracking # · **Provider** (ex. « Marked as Shipped ») · Service · Recipient · City · State · Country · Marketplace Notified · Shipment Notification.

### 3.4 End of Day

Onglets **Open Shipments** / **Closed Shipments**, sélecteur de date, génération de manifestes (SCAN forms). Mention d'une génération de codes-barres de fin de journée via l'app mobile.

---

## 4. Module Returns

Sidebar : **Standard Returns** → une entrée par boutique supportant les retours (ici : LAS Shopify).
Onglets : **Outstanding** / **Received** / **Voided**.
Actions : Print Label(s) · Void Label(s) · Update Tracking · **Mark as Received** · **Resend Return Label(s)** · Export.
Filtres : Provider · Return To · Other.
Colonnes : **RMA #** · Order # · Created Date · Returning Party · Ship To · Tracking # · Service · Insurance Fee · Label Printed · Customer Email · Return Note.
Volume observé : 54 retours.

**Motifs de retour du système (13) :** Courtesy Return · Ordered Wrong Item · Warranty · Changed Mind · Received Wrong item · Rental · Damaged · Defective · Arrived Too Late · Missing Parts · Not as Described · Other · Exchange.

Une offre « Premium Plan » pousse le **portail de retours de marque** et les échanges (non activé chez Lasclay : `EnableShipstationReturns: false`).

---

## 5. Module Products

### 5.1 Arborescence

```
├─ Products
├─ Preset Groups
├─ Reporting Categories
├─ Inventory  (sous-arbre)
├─ External Inventory
├─ Purchase Orders
├─ Suppliers
└─ Transfer Orders
```

### 5.2 Grille produits

Actions : **Add Preset Group** · Reporting Category · Tag · **Import** · **Export** · Deactivate · Delete · **New Product** · **Combine** · **Auto-split** · Create Purchase Order · Add to Supplier.
Filtres : Tags · Preset Groups · Product Type · Categories · Created At · Modified At · Image · Bundle · case **Show Inactive Products**.
Colonnes : Alias · **SKU** · Preset Group · Weight · **Name** · Warehouse Location · Active · Bundle · Created At · Image · **Allocated** · **Available** · **Declared Value** · Dimensions (+ autres).

Volume Lasclay : **472 produits actifs**.

### 5.3 Modèle de données produit (champs réels de l'API interne)

```
productId, sku, name, fulfillmentSku, createDateUTC, modifyDateUTC, active,
productType, categoryId,
providerId, serviceId, packageTypeId, confirmationId,                 → expédition domestique
intlProviderId, intlServiceId, intlPackageTypeId, intlConfirmationId, → expédition internationale
domesticRateShopperGuid, intlRateShopperGuid,
weight, weightUnitOfMeasureId, warehouseLocation,
length, width, height, dimensionUnitOfMeasureId,
itemWeight, itemWeightUnitOfMeasureId, itemLength, itemWidth, itemHeight, itemDimensionUnitOfMeasureId,
useProductName, upc, productProfileId, parentProduct, parentProductId, productVariantIds,
tags, isReturnable, price, currencyPrice, defaultCost, currencyDefaultCost,
internalNotes, lastWeightOz,
customsDescription, customsValue, currencyCustomsValue, customsTariffNo,   → douanes
customsMIDCode, cpscCertificateVersionId, cpscCertifierId, customsCountry,
noAutoCustomsDeclaration,
thumbnailUrl, archiveOrderCount, archiveOrderTotal, archiveLastOrderDateUtc,
autoSplitOption, autoSplitCustomQuantity, reorderThreshold, inventoryDisabled, …
```

Deux jeux de dimensions/poids coexistent (`weight`/`length`… = colis par défaut ; `itemWeight`/`itemLength`… = article seul) — distinction utile à conserver.

### 5.4 Preset Groups (profils produit)

Un *Preset Group* applique poids, dimensions, service domestique et international, type de colis, confirmation et informations douanières à un ensemble de produits.

*Groupes Lasclay (4) :*

| ID | Nom | Poids | Dim. (po) | Colis | Conf. | Douane |
|---|---|---|---|---|---|---|
| 1266 | Mitaines Seules | 200 g | 7 × 12 × 2,25 | Polymailer Small | 5 | « Mittens » / 99,99 / pays CA / **HS vide** |
| 1267 | Sac Lunch | 460 g | 12 × 6 × 6 | Box 12×6×6 | 1 | vide |
| 1274 | Petit Article Seul | 70 g | 7,5 × 12 × 1,5 | Polymailer Small | 1 | vide |
| 2512 | Seed bombs | 200 g | 6 × 9 × 1 | — | — | « Modeling pastes » / 8 / **HS 3407.00** / CA |

### 5.5 Inventaire

Entrepôt d'inventaire unique : `Inventory Warehouse` (id 145696), avec un seul emplacement `(Unspecified)` (id 159994, pickable). Réglages : `Inventory:ReOrderThreshold = 0`, `Inventory:ShipNoLocations = false`.
Sous-modules non exploités : Purchase Orders, Suppliers, Transfer Orders, External Inventory.

---

## 6. Module Customers

Grille unique **All Customers**. Actions : Create Customer · Edit · Create Label · New Order · Tag · **Import** · **Combine**.
Filtres : Marketplace Username(s) · Country · State · Tag.
Colonnes : Name · Email · Phone · City · State · Country · Company · **Marketplace(s)** · **Marketplace Username(s)** · Tags.
Volume Lasclay : **37 686 clients**.

Les clients sont dérivés automatiquement des commandes importées ; l'identité est la paire (marketplace, username/email).

---

## 7. Module Scan

Écran plein largeur, sans sidebar :
- **Workflow** (menu) : `Scan to Verify & Print`, `Scan to Print`, `Scan to Verify`
- **Order Number** (champ de saisie mis au point automatiquement) + **Find Shipment**
- **Print Barcode Sheet**
- **Scale** (sélection de balance) · **Printer** (sélection d'imprimante)

Dépendance dure : **ShipStation Connect** doit être installé, sinon l'écran affiche *« ShipStation Connect Missing — Scan to Print requires ShipStation Connect in order to work »*. Chez Lasclay, Connect n'est pas installé : **le poste de scan est donc inutilisable en l'état**.

---

## 8. Module Rates (Rate Browser)

Modale « Rate Browser » en deux volets.
*Configure Rates* (gauche) : Ship From · Ship To (Country, City, Postal Code, case **Residential Address**) · Shipment Information (Weight kg/g + balance, Package, Size L/W/H, Confirmation) · bouton **Browse Rates**.
*Résultats* (droite) : une carte par compte transporteur, avec compteur de services et prix ; bouton **Configure Label** pour transformer une cotation en expédition.

---

## 9. Module Analytics

```
├─ Shipments Overview        ← page par défaut
│   ├─ Carrier Performance
│   ├─ Shipment Tracking
│   ├─ Shipping Costs
│   └─ Return Shipments
├─ Orders Overview
│   ├─ Order Processing
│   └─ Customers
├─ Sales & Customers
├─ Products
├─ Warehouses
├─ Inventory
└─ Data Exports
```

**Shipments Overview** : sélecteur de plage de dates, puis KPIs — *Shipments · Shipping Revenue · Shipping Cost · **Net Shipping Revenue** · Avg Cost per Label* — histogramme des expéditions par jour, tableau **Shipments by Carrier** (Qty, Share) et **Open Order Aging** avec un **SLA de temps de traitement configurable** (« Current fill time SLA: 48 hours — Change SLA »).

Exemple réel (juillet 2026) : 41 expéditions · revenu d'expédition 391,39 $ · coût 1 094,91 $ · **net −703,52 $** · coût moyen par étiquette 26,71 $ · Canada Post 90 % / Purolator 10 %.

---

## 10. Module Automations (hub)

Deux blocs :

**① Automation Playbook** — modèles prêts à l'emploi : *Set Shipping Service Based on Weight*, *Insure Orders with Total Shipping Protection*, *Marketplace Specific Rate Shopper* (bouton « Preview Template »).

**② Automation Tools** — filtrables par intention (*Everything · Preparing Orders · Deciding How to Ship · Fulfilling at Scale*) :

| Outil | Rôle | État chez Lasclay |
|---|---|---|
| **Product Preset Groups** | Poids, dimensions, services, douane par lot de produits | 4 groupes |
| **Service Mappings** | Mapping « service demandé au checkout » → service transporteur réel, **par boutique** | configuré (§ 13.6) |
| **Rate Shopper** | Comparaison automatique de services selon délai/exigences | **Inactive** |
| **Automation Rules** | Moteur de règles conditionnelles | 11 règles (§ 12.4) |
| **Smart Fill** | Poids et dimensions déduits des expéditions similaires passées | disponible |

---

## 10bis. Modèle de données des commandes (API interne `/api/ordergrid/shipmentmode/simple`)

ShipStation sépare **la commande de vente** (ce que le client a acheté) du **plan d'exécution** (comment on l'expédie). C'est la distinction structurante à reprendre : une commande peut porter plusieurs plans (split ship), et un plan peut couvrir plusieurs commandes (regroupement).

**Enveloppe de réponse :**
`currentPageFulfillmentPlanIds`, `salesOrders`, `fulfillmentPlans`, `fulfillments`, `fulfillmentPlanSets`, `returns`, `products`, `pickBatches`, `freightShipments`, `debugInfo`, `page`, `pageSize`, `totalCount`
→ les entités sont **normalisées et jointes côté client** par identifiant, pas imbriquées. Bon patron à reprendre pour la performance de la grille.

**`SalesOrder`**
```
fulfillmentPlanIds[], salesOrderId (GUID), orderNumber,
createdDateTime, modifiedDateTime, orderDateTime, paidDateTime,
shipByDateTime, holdUntilDateTime,
assignedToUser, assignedToUserId, requestedService,
isGift, isCanceled, derivedStatus ("AWS" = Awaiting Shipment, …),
items[], store, soldTo, shipTos[], marketplaceShipTos[],
amountSummary, discounts[], premiumAttributes, tagIds[],
originalSource, otherIdentifiers, restrictions
```

**`SalesOrderItem`**
```
salesOrderItemId, productId, sku, name,
originalQuantity, quantity,          ← quantité d'origine conservée séparément
productThumbnailUrl,
unitPrice {value, code}, totalPrice {value, code},   ← montants typés avec devise
isGift, attributes[]
```

**`FulfillmentPlan`** (l'objet le plus riche du système — 62 champs)
```
fulfillmentPlanId, orderGridStatus, plannedReasonCode, isPlanned,
packingSlipPrintedStatus, pickListPrintedStatus,
createDateTime, modifiedDateTime, holdUntilDateTime, assignedToUserId,
salesOrdersFulfilledIds[],                       ← N commandes → 1 plan
labelConfiguration, externalFulfillmentConfiguration, freightConfiguration,
rateSummary, shippingConfigurationHash, alternativeRates[], recommendedRates[],
items[], international, packingSlipTemplateId, allocationStatus,
shipmentEmailNotificationTemplateId, deliveryEmailNotificationTemplateId, notificationEmails,
zone, isGift, notes, fulfillmentPlanSetId, tagIds[], fulfillmentType,
verificationStatus, sellerTaxIdentifiers, recipientTaxIdentifier(s), pickupLocation,
sellerBrandId, restrictions, lockAddress, fulfillmentPlanDates, amountSummary,
recipientInfo, marketplaceData, premiumPrograms, isExchange, isDemoOrder,
isShipSense, appliedShipSenseJson, smartFillData,
pickBatchId, toteId, pickerUserId, processedUtc, pickBatchExceptionInfo,
refundRequestDate, shipmentRefundStatusTypeId, refundAmountRequested,
refundedAmount, netRefundedAmount, refundRequestedStartUtc, refundCompletedUtc,
fraudDetection
```

**`labelConfiguration`** (sous-objet d'achat d'étiquette)
```
sellerLabelProviderId, serviceId, serviceCollectionGuid,
availableSellerShippingServices[], availableShippingOptions[],
shipFromId, shipTo, shipDate, pickup, driverTip,
packages[],            ← ⚠️ c'est ce tableau vide qui produit l'erreur OBS1
options, insuranceProvider, customs, email
```

Points à reprendre :
- `shippingConfigurationHash` — empreinte de la configuration d'expédition, permet d'invalider une cotation quand un paramètre change. Mécanisme utile.
- `originalQuantity` vs `quantity` — trace les modifications de commande sans perdre l'état d'origine.
- `alternativeRates` / `recommendedRates` stockés sur le plan — la cotation est persistée, pas recalculée à chaque affichage.
- Le cycle de remboursement d'étiquette est modélisé en **7 champs** (`refundRequestDate` → `refundCompletedUtc`) : c'est le sujet n°1 des plaintes de facturation (exigence A4).

---

## 11. Arborescence complète des Paramètres (Settings)

```
Account
├─ Sign In & Security
├─ Display Options
├─ Payment & Subscription
├─ User Management
├─ API Settings
└─ Sender Emails
Selling Channels
└─ Store Setup
Branded Customer Pages
└─ Branding Defaults
Templates
├─ Packing Slips
├─ Pick List
└─ Email Templates
Automation
├─ Order Filters
├─ Automation Rules
└─ SmartFill
Shipping
├─ Carriers
├─ Insurance
├─ Fulfillment Providers
├─ Rate Shopper
├─ Workflow Settings
├─ International Settings
├─ Packages
├─ Ship From Locations
└─ Returns
Printing
├─ Printing Setup
└─ ShipStation Connect
Inventory Management
├─ Inventory Settings
├─ Allocation Strategy
├─ Warehouses
└─ Inventory Sync
Warehouse
├─ Picking
└─ Packing
Add-Ons
Integration Partners
Labs
```

### 11.1 Paramètres d'une boutique (10 onglets)

Route : `/settings/stores/{storeGuid}/{onglet}`

| Onglet | Contenu |
|---|---|
| **General** | Store Name · Status (Active/Inactive) · **Import Frequency** (Manual Import / Automatic Import) · **Standardize Addresses When Verified** (US / non-US, support CA GB AU DE FR NO ES SE IL IT) · **Residential/Commercial Indicator Default** (commercial / résidentiel / valeurs du marketplace) · bouton **Edit Shopify Settings** |
| **Checkout Rates** (Beta) | Tarifs affichés au checkout |
| **Branding** | Logo, couleurs |
| **Tracking Page** | Page de suivi de marque |
| **Returns** | Portail de retours |
| **Emails** | Modèles de courriel par boutique |
| **Packing Slips** | Modèle de bon de préparation par boutique |
| **Products** | Options de synchronisation produits |
| **Shipping Services** | **Service Mappings** (§ 13.6) |
| **Activity** | Journal d'import de la boutique |

**Modale « Modify Marketplace Settings » (spécifique Shopify) :**

*Store Settings* (cases à cocher) :
- Shopify Discount Codes In Notes
- **Map "partially_paid" To Awaiting Payment** ✅ activé
- Use a Ship From Location Inventory Source as the location for Marketplace Notifications
- **Map "authorized" To Awaiting Payment** ✅ activé
- Allows Shopify `source_name` to populate in the Source column
- Map Voided and Pending Payment as Awaiting Payment
- **Import harmonization codes** ❌ *désactivé — pertinent pour les codes SH*
- Preserve the original `order_name` from Shopify
- Import Pickup Order (survol du « ? » avant activation)
- Import in 'Buy With Prime' orders as Shipped
- Import Pickup Order with Shopify Customer address (survol du « ? » avant activation)
- *Beta* — **Minimum order age in minutes before order imports** (max 120, 0 = aucun délai)

*Custom Field Mapping* : Custom Field 1 / 2 / 3 → source (actuellement `None` pour les trois, les valeurs sont donc écrites par les règles d'automatisation).

### 11.2 Panneau de rafraîchissement des boutiques

Ouvert par l'icône ↻ de la barre supérieure :

```
3 Active Stores                      [↻ Update All]
─────────────────────────────────────────────────
🔸 FAIRE Lasclay      ⛔ Failed to import  View Details   [↻]
🔸 LAS Etsy           ✅ Last updated 31/07/2026 19:23    [↻]
🔸 LAS Shopify        ✅ Last updated 31/07/2026 18:07    [↻]
```

**Défaut majeur observé.** Le lien *View Details* sur une boutique en erreur ouvre une modale « Store Error » qui affiche : **« No error details are currently available. »** avec pour seules options *Contact Support*, *Get Help* et *Reconfigure Store Connection*. Une boutique est en échec d'import depuis le 27/05/2026 sans qu'aucun diagnostic ne soit disponible dans le produit. → **Exigence C6** (§ 15.2, bloc C).

Panneau latéral contextuel : *« Check for new orders… whenever — Anytime you feel like checking for new orders, use the import ↻ action in the toolbar to update all stores, or see when each store was last updated. »* Aucune notion de **cadence garantie** n'est exposée à l'utilisateur.

---

## 12. Moteur d'automatisation — spécification complète

### 12.1 Fonctionnement

Une **règle** = un *filtre de commande* (`filterId`, ensemble de critères) + une liste ordonnée d'**actions**. Les règles s'exécutent **à l'import** de la commande, dans l'ordre du champ `order`. Un bouton **Reprocess Automation Rules** rejoue toutes les règles sur les commandes ouvertes, avec l'avertissement : *« This may overwrite any shipping settings that have been made since the orders were imported. »*

Les règles sont réordonnables par glisser-déposer, activables/désactivables par interrupteur, et une case **Show Inactive** révèle les règles désactivées.

### 12.2 Catalogue complet des types d'action (56)

*Les identifiants 3, 41, 54 et 58 sont absents de la réponse de l'API (types dépréciés ou non exposés au forfait Standard) — ce n'est pas une troncature.*

| ID | Nom | Code interne |
|---|---|---|
| 1 | Add a Tag… | AddTag |
| 2 | Set Carrier/Service/Package… | ShippingService |
| 4 | Insure the Package… | Insure |
| 5 | Request Confirmation… | Confirmation |
| 6 | Add an Internal Note… | InternalNote |
| 7 | Hold the Order for… | Hold |
| 8 | Set Customs Content Type… | CustomsContent |
| 9 | Set International Non-Delivery… | NonDelivery |
| 10 | Set Ship From Location… | Warehouse |
| 11 | Stop Processing Rules for the Order | Stop |
| 12 | Send an email… | Email |
| 13 | Create an Alert… | Alert |
| 14 | Set the Total Order Weight… | Weight |
| 15 | Set Package Dimensions… | Dimensions |
| 16 | Don't Import the Order | Ignore |
| 17 | Adjust the Order Weight… | AdjustWeight |
| 18 | Hold Until… | HoldUntil |
| 19 | Mark Shipment(s) as "Non-Machinable" | NonMachinable |
| 20 | Show Postage Paid on the Label | ShowPostage |
| 21 | Use email template for Shipment Notification… | EmailTemplate |
| 22 | Use a specific Packing Slip… | PackingSlip |
| 23 | Add Note to the Buyer… | NoteToBuyer |
| 24 | Assign to a user… | AssignToUser |
| 25 | Bill Int'l Duties to Payor of Shipping Charges | BillDutiesToSender |
| 26 | Do Not Prepay Postage (Endicia Only) | NoPostage |
| 27 | Charge Shipping to 3rd Party… | BillTo3rdParty |
| 28 | Set Fulfillment Provider… | FillService |
| 29 | Do Not Notify Marketplace of Shipment | DoNotNotifyMarketplaceOfShipment |
| 30 | **Set Custom Field 1…** | SetCustomField1 |
| 31 | **Set Custom Field 2…** | SetCustomField2 |
| 32 | **Set Custom Field 3…** | SetCustomField3 |
| 33 | Enable Saturday Delivery (UPS / FedEx) | SaturdayDelivery |
| 34 | Set the Order as Containing Alcohol (FedEx) | Alcohol |
| 35 | Set the Order as Containing Dry Ice (UPS / FedEx) | DryIce |
| 36 | Enable Shipper Release (UPS only) | ShipperRelease |
| 37 | Set the Dry Ice Weight (UPS / FedEx) | DryIceWeight |
| 38 | Set Declaration Statement (FedEx only) | DeclarationStatement |
| 39 | Include a Return Label with the Outbound Label | IncludeReturnLabel |
| 40 | Use email template for Delivery Notification… | DeliveryEmailTemplate |
| 42 | Set Ship By Date | ShipByDate |
| 43 | Charge Shipping to My Account… | BillToOtherAccount |
| 44 | Collect Payment on Delivery (C.O.D.)… | COD |
| 45 | Set Tax Identifiers | TaxIdentifiers |
| 46 | Set Rate Shopper | ServiceCollection |
| 47 | Prepay duties and taxes | PrepaidDuties |
| 48 | Use Blank Box | UseBlankBox |
| 49 | Block Amazon Logistics | BlockAmazonLogistics |
| 50 | Delegate to assigned Fulfillment Provider | DelegateFulfillmentProviderService |
| 51 | Set Notifications (Royal Mail / Parcelforce) | SendCarrierNotifications |
| 52 | Set Deliver By Date | DeliverByDate |
| 53 | Set Shipment As Dangerous Goods | OrderContainsDangerousGoods |
| 55 | Set Importer of Record | AddImporterOfRecord |
| 56 | Set Service Level | AddServiceLevel |
| 57 | Set Ship Date | ShipDate |
| 59 | Set Movement Indicator | AddMovementIndicator |
| 60 | Send orders to the Picking Queue | ReadyToPick |

### 12.3 Modèle de filtre

Un filtre (`orderFilterSet`) est composé de six familles de critères :

```jsonc
{
  "stringFilters":   [{ "column": "...", "operator": "Equals|Contains|DoesNotContain|BeginsWith|EndsWith", "value": "a;b;c" }],
  "numericFilters":  [{ "column": "...", "operator": "Eq|Lt|Lte|Gt|Gte", "value": "1", "unitOfMeasure": null }],
  "dateTimeFilters": [{ "column": "...", "operator": "dateCustomRange|...", "value": {...} }],
  "collectionFilters":[{ "column": "...", "values": ["id1","id2"], "isIn": true }],
  "booleanFilters":  [{ "column": "...", "value": true }],
  "timeFilters":     []
}
```

**Colonnes filtrables observées :** `ItemSku`, `ItemName`, `Quantity`, `OrderWeight`, `OrderTotal`, `AmountPaid`, `ShippingPaid`, `RequestedServiceMarketPlace`, `RequestedServiceMapped`, `IsInternational`, `ShipFromId`, `StoreGuid`, `shipToCountryCode`, `shipToState`, `NotesFromBuyer`, `CustomField2`, `tag`, `OrderDateTime`.

Dans les filtres textuels, **les valeurs multiples sont séparées par `;`** (ex. `"22;23;SEEDBMB"`) et le séparateur signifie OU.

**Légende des symboles utilisés au § 12.5** (et correspondance avec l'API) :

| Symbole | Opérateur API (`criterionOperatorValue`) | Sens |
|---|---|---|
| `∋` | `Contains` | contient la sous-chaîne |
| `∌` | `DoesNotContain` | ne contient aucune des valeurs |
| `=` (texte) | `Equals` / `equals` | égal à l'une des valeurs |
| `≠` | `notEquals` | différent de |
| `∈` | `isIn: true` (collectionFilters) | appartient à l'ensemble d'IDs |
| `>` `≥` `<` `≤` | `Gt` `Gte` `Lt` `Lte` | comparaison numérique |
| plage de dates | `dateCustomRange` avec `{startRangeDate, endRangeDate}` (format `MM/DD/YYYY`) | intervalle |

**Combinaison des critères — sémantique à reproduire :**

1. Entre deux critères de **colonnes différentes** : **ET**.
2. Entre les **valeurs d'un même critère** (tableau `criterionArgumentValue` ou chaîne séparée par `;`) : **OU**.
3. Entre deux critères portant sur la **même colonne** : **OU** — c'est le seul moyen d'expliquer la vue 8 « QC-ON » (`shipToState equals CA-ON` + `shipToState equals CA-QC`), qui serait vide en ET pur. Les vues 1/2/3 confirment le même patron sur `ItemSku` (`DoesNotContain` + `Equals`) : la négation et l'affirmation coexistent parce qu'elles s'appliquent à des articles différents d'une même commande.
4. `unitOfMeasure` sur les filtres numériques : `null` signifie « unité par défaut du compte » — ici **grammes** (`UnitOfMeasure:Weight = Gram`). C'est ce qui donne son sens au seuil de **73 g** des vues *TIMBRE 2.0* et *ROC*.

> ⚠️ **À confirmer sur données réelles avant implémentation.** Les points 3 et 4 sont déduits du comportement observé des vues, pas d'une documentation. Le test d'acceptation de la Phase 2 (§ 17) doit les valider en rejouant chaque vue sur le jeu de commandes historiques et en comparant les résultats à ShipStation.

**Ordre d'exécution et état mutant — piège critique.** Les règles s'exécutent dans l'ordre du champ `order`, mais le document ShipStation ne dit pas si un filtre s'évalue sur l'état **initial** de la commande ou sur l'état **déjà modifié** par les règles précédentes. Le jeu de règles de Lasclay contient précisément ce cas :

- **Règle 2** (ordre 2) filtre sur `ShipFromId ∈ {153232}` et écrit `CustomField3 = LASCLAY`.
- **Règle 3** (ordre 3) *assigne* `ShipFrom = 153232`.

Si l'évaluation porte sur l'état initial, `CustomField3` n'est renseigné que pour les commandes déjà rattachées à LAS Capucins à l'import ; si elle porte sur l'état mutant, la règle 2 ne se déclenche **jamais** pour les commandes que la règle 3 va rattacher. Or `CustomField3` est le **centre de coût de facturation Postes Canada** (§ 12.4, § 17). → **Vérifier empiriquement sur 50 commandes réelles avant de coder le moteur, et en faire un cas de test de la Phase 2.** La correction évidente dans l'alternative est d'inverser l'ordre des deux règles.

> **Limite structurelle connue de ShipStation** (confirmée par les critiques publiques, § 15.2 bloc D) : les critères portant sur les articles (`ItemSku`, `ItemName`) s'évaluent mal sur les commandes **multi-articles** — c'est la demande d'évolution la plus ancienne et la plus réclamée de la communauté. Une alternative doit traiter ce point en priorité (exigence **D1**).

### 12.4 Les 11 règles d'automatisation de Lasclay (état exact)

| Ordre | Nom | Actif | Filtre | Action |
|---|---|---|---|---|
| 1 | **Default Confirmation** | ✅ | *(aucun — toutes les commandes)* | `Confirmation` = 0 *(Aucune confirmation)* |
| 2 | **LAS Cost Centre (Postes Canada Billing)** | ✅ | `ShipFromId` ∈ {153232 — LAS Capucins} | `SetCustomField3` = `LASCLAY` |
| 3 | **LAS Incoming Orders Warehouse Selection** | ✅ | `StoreGuid` ∈ {LAS Shopify, LAS Etsy, Manual Orders} | `Warehouse` (Ship From) = 153232 — **LAS Capucins** |
| 4 | **1x Sac Lunch Package Dimensions Expedited** | ✅ | `ItemSku` BeginsWith `LUNCHB-23` **ET** `RequestedServiceMarketPlace` Contains `Expedited; Free Shipping` **ET** `Quantity` = 1 | `ShippingService` = `11,99,115317` → Canada Post / **Expedited Parcel (Carbon Neutral)** / **Polymailer Small** |
| 5 | **1x MIT Package Dimensions Expedited** | ✅ | `ItemSku` BeginsWith `MIT` **ET** `Quantity` = 1 | `ShippingService` = `11,99,115317` → idem |
| 6 | **Do Not Safe Drop Auto** | ✅ | `RequestedServiceMapped` ∈ {98, 99, 100, 101, 102} *(services Canada Post : Regular, Expedited, Xpresspost, Xpresspost Certified, Priority)* | `Confirmation` = 5 → **Do Not Safe Drop** |
| 7 | **LAS Incoming Orders USA** | ✅ | `IsInternational` = true | `SetCustomField2` = `USA` |
| 9 | **LAS Incoming Orders LOCAL** | ✅ | `RequestedServiceMarketPlace` Contains `Entrepôt Lasclay` | `SetCustomField1` = `CAPUCINS LOCAL` |
| 10 | **LAS Incoming Orders DDD** | ✅ | `RequestedServiceMarketPlace` Contains `DDD` | `SetCustomField1` = `DDD ` |
| 11 | **LAS Incoming Orders DDD email** | ❌ **inactive** | `RequestedServiceMarketPlace` Contains `DDD` | `Email` → modèle 5770 « DDD Template » vers `info@boutiqueddd.com` |
| 12 | **LAS Incoming Orders Lucie** | ✅ | `ItemName` Contains `Bague;Pendentif` | `Email` → modèle 6054 « Lucie Veilleux » vers `lucieveilleux@live.ca` |

*(L'ordre 8 correspond à une règle supprimée ; deux filtres orphelins subsistent : `ShippingPaid < 1` et `ShippingPaid < 2.99`.)*

**Lecture métier de ce jeu de règles — ce que l'alternative doit préserver :**

1. **Trois champs personnalisés servent de dimensions analytiques** : CF1 = canal logistique (`CAPUCINS LOCAL`, `DDD `), CF2 = zone (`USA`), CF3 = centre de coût (`LASCLAY`, pour la facturation Postes Canada). Ce sont de facto les axes de reporting de Lasclay.
2. **Deux règles déclenchent des courriels de sous-traitance** vers des partenaires externes (boutique DDD, Lucie Veilleux) — c'est un **workflow de dropship manuel par courriel**.
3. **Deux règles d'emballage automatique** (sac à lunch, mitaines) — cas mono-article uniquement, ce qui est précisément la limite du moteur ShipStation.
4. **Do Not Safe Drop** est appliqué systématiquement sur les services Canada Post — décision de politique de livraison.
5. Noter le `DDD ` **avec espace final** dans la valeur du champ personnalisé — piège de migration classique.

### 12.5 Les 27 vues sauvegardées (`gridConfig`)

Ces vues sont propriétaires de `admin@lasclay.com` et **ne sont exposées par aucune API publique**. Elles encodent l'essentiel du savoir opérationnel de l'entrepôt.

| # | Nom | Critères |
|---|---|---|
| 1 | **Graines x1** | ItemSku ∌ *(liste E, ci-dessous)* · ItemSku = `ASCL-SYRIACA-1.25ML-x1, ASCL-INCARNATA-1ML-x1, ASCL-TUBEROSA-1ML-x1, ASCL-SPECIOSA-1ML-x1` · ItemName ∌ `four, manique, sous-plat, bombes` |
| 2 | **Graines x5** | ItemSku ∌ *(liste E)* · ItemSku = `…-x5` (4 SKU) · ItemName ∌ `bombes` |
| 3 | **Graines x10** | ItemSku ∌ *(liste E)* · ItemSku = `…-x10` (4 SKU) |
| 4 | **Échange** | ItemName ∋ `Échange` · Quantity = 1 |
| 5 | **USA textile** | CustomField2 ∋ `USA` · ItemName ∌ `graines, bombes` |
| 6 | **CAPUCINS** | RequestedServiceMarketPlace = `Entrepôt Lasclay` |
| 7 | **Défricheuses** | RequestedServiceMarketPlace ∋ `Défricheuses` |
| 8 | **QC-ON** | pays = CA · état = CA-ON · état = CA-QC |
| 9 | **TIMBRE 2.0** | pays = CA · **OrderWeight ≤ 73** · RequestedServiceMarketPlace ∌ `défricheuses, lasclay` |
| 10 | **Commandes pas encore expédiées** | tag = 37367 (« Non expédié ») |
| 11 | **CAN Bmb - petite env.** | RequestedServiceMarketPlace ∌ `DDD, Capucins, Lasclay` · ItemName ∋ `bombes` · ItemName ∌ *(18 termes : plantules, pantoufles, mitaines, tuque, sac, besace, foulard, cache-cou, bandeau, semelles, maniques, sous-plat, crème, nettoyant, bague, pendentif, boucles, coussin)* · pays = CA · **OrderTotal ≤ 65** |
| 12 | **USA Bmb - petite env.** | ItemName ∋ `bombes` · ItemName ∌ *(mêmes 18 termes)* · pays ≠ CA · **OrderTotal ≤ 80** |
| 13 | **Graines x 1 CAN** | comme Graines x1 + pays = CA · ItemName ∌ `bombes, four, manique, sous-plat` |
| 14 | **ROC** *(Rest of Canada)* | ItemName ∌ `plantules` · pays = CA · **OrderWeight > 73** · ItemName ∋ *(20 termes textiles)* · RequestedServiceMarketPlace ∌ `Défricheuses, Capucins, Lasclay` · état ≠ CA-QC · état ≠ CA-ON |
| 15 | **Kaseme - archivage** | NotesFromBuyer ∋ `kaseme` · Quantity = 0 |
| 16 | **Colis Canada** | pays = CA · RequestedServiceMarketPlace ∌ `timbre, entrepôt, ramassage, capucins, défricheuses` |
| 17 | **à expédier JSB (sans kaseme)** | Quantity > 0 · NotesFromBuyer ∌ `kaseme` · ItemName ∌ `alu, impression` |
| 18 | **1er dec** | Quantity > 0 · NotesFromBuyer ∌ `kaseme` · ItemName ∌ `alu, impression, galaxy, canva` · ItemName ∌ `Casse-tête - Caribou automne, Casse-tête - Huard, Casse-tête - Orignal` |
| 19 | **Canada** | pays = CA |
| 20 | **à expédier (sans kaseme, canva, alu, impr)** | Quantity > 0 · NotesFromBuyer ∌ `kaseme` · ItemName ∌ `alu, impression, canva` |
| 21 | **concours voyage** | OrderDateTime ∈ [18/10/2025 → 15/12/2025] · **OrderTotal ≥ 114** · StoreGuid = LAS Shopify · pays = CA |
| 22 | **Concours prix secondaires** | OrderDateTime ∈ [18/10/2025 → 15/12/2025] · **OrderTotal > 25** · pays = CA · StoreGuid = LAS Shopify |
| 23 | **3 mars** | pays = CA · RequestedServiceMarketPlace ∌ `timbre, entrepôt, ramassage, capucins, défricheuses` · ItemName ∌ 3 produits précis |
| 24 | **Influenceuses 0$** | **AmountPaid < 1** |
| 25 | **Distributeur** | ItemName = `Carton` |
| 26 | **Kit premium** | **AmountPaid = 82,48** |
| 27 | **Canadiens** | ItemName ∋ `Canadiens` |

**Liste E — valeur d'exclusion partagée par les vues 1, 2, 3 et 13.**
Le tableau `criterionArgumentValue` brut, tel que renvoyé par l'API, contient **six éléments dont un caractère barre verticale isolé** :

```json
{
  "filterById": "itemSku",
  "type": "TYPE_STRING",
  "filterValue": "ItemSku",
  "criterionOperatorValue": "DoesNotContain",
  "criterionArgumentValue": ["22", "23", "SEEDBMB", "21", "20", "|"]
}
```

Le sixième élément `"|"` est bien une **valeur d'exclusion à part entière**, pas un séparateur : le séparateur entre valeurs multiples est `;` dans les filtres de règles (§ 12.3) et un tableau JSON dans les vues. Concrètement, cette vue exclut donc tout SKU contenant un caractère `|` — ce qui écarte les SKU composites de type `4459028||8x10|digital-print|none` (les tirages d'art Jean-Simon Begin). **À reprendre tel quel**, c'est un filtre volontaire.

**Ce que révèle ce corpus — règles métier implicites à reprendre dans l'alternative :**

- **Seuil de poids 73 g** : sépare le tarif « timbre » (lettre) du colis. Vues *TIMBRE 2.0* (≤ 73) et *ROC* (> 73).
- **Seuils de valeur pour l'emballage** : 65 $ (Canada) et 80 $ (international) pour les bombes semencières en petite enveloppe.
- **Zonage** : QC + ON traités ensemble (livraison locale), « ROC » pour le reste du Canada.
- **Canaux logistiques** identifiés par le libellé de service au checkout : `Entrepôt Lasclay` (ramassage), `Défricheuses`, `DDD`, `timbre`, `ramassage`, `capucins`.
- **Convention `kaseme`** : mot-clé dans la note de l'acheteur qui exclut une commande du flux d'expédition.
- Le préfixe/suffixe SKU encode le conditionnement des graines : `-x1`, `-x5`, `-x10`, et les codes `20/21/22/23/SEEDBMB` sont des exclusions systématiques.
- Plusieurs vues sont **jetables et datées** (« 1er dec », « 3 mars », « concours voyage ») — signe qu'il manque un objet de premier ordre pour les campagnes ponctuelles.

---

## 13. Configuration réelle du compte Lasclay (données à migrer)

> Cette section est la **charge utile de migration**. Tout ce qui suit a été extrait de l'API interne du navigateur authentifié et constitue l'état exact au 31/07/2026.

### 13.1 Boutiques (11, dont 4 actives)

| storeId | Nom | Marketplace | Actif | Manuel | Auto-refresh | Statut |
|---|---|---|---|---|---|---|
| 361089 | **FAIRE Lasclay** | 3371 (Faire) | ✅ | non | ✅ | ⛔ **Failed to import** (depuis 27/05/2026) |
| 198711 | **LAS Etsy** | 8 (Etsy) | ✅ | non | ✅ | ✅ Idle |
| 198670 | **LAS Shopify** | 14 (Shopify) | ✅ | non | ✅ | ✅ Idle |
| 194366 | **Manual Orders** | 0 | ✅ | **oui** | — | ✅ Idle · numérotation auto |
| 256900 | Fake Poparide Store | 14 | ❌ | | | |
| 360675 | JS begin | 22 | ❌ | | | |
| 368792 | JSB - SHOPIFY | 14 | ❌ | | | |
| 368332 | New Shopify Store | 14 | ❌ | | | Idle |
| 371264 | New Shopify Store | 14 | ❌ | | | ⛔ Error |
| 371961 | TSURU COUTEAUX | 14 | ❌ | | | ⛔ Error |
| 378993 | Unique Plastique | 14 | ❌ | | | ⛔ Error |

**Correspondance `storeId ↔ storeGuid` des boutiques actives** (les GUID sont ce que référencent les règles et les vues) :

| storeId | Nom | storeGuid |
|---|---|---|
| 361089 | FAIRE Lasclay | `4e156b52-86a2-4c9f-b823-fda8c1662bdb` |
| 198711 | LAS Etsy | `082beef5-09ed-4983-9b57-98a00ae6e417` |
| 198670 | **LAS Shopify** | `93980608-de51-43e7-8380-4553fa960626` |
| 194366 | Manual Orders | `4def72a0-cae5-4f28-89e9-dd94d7a5c543` |

> Note sur le compteur « **3** Active Stores » du panneau de rafraîchissement (§ 11.2) alors que 4 boutiques sont actives : le panneau ne liste que les boutiques à **import automatique**. `Manual Orders` en est exclue par construction. À reproduire ou à corriger explicitement.

*Aucune boutique n'utilise la page de suivi de marque (`useBrandedTrackingPage: false` sur les 4), aucune n'a de modèle de courriel dédié au niveau boutique, toutes utilisent le bon de préparation « Default 4″ × 6″ » (id 2).*

### 13.2 Emplacements d'expédition — Ship From Locations (5)

| shipFromId | Nom | Défaut | Société | Adresse | Source d'inventaire |
|---|---|---|---|---|---|
| **153232** | **LAS Capucins** | ✅ | Lasclay | 254 Boulevard des Capucins, Québec QC G1J 3R4, CA | aucune |
| 372441 | Jean-Simon Begin | | Photographe animalier | 298 Boulevard des Capucins, Québec QC G1J3R4, CA | Store 198670 |
| 463467 | Lasclay JCC | | JCC | 839 27e Rue, Saint-Zacharie QC G0M2C0, CA | Native 145696 |
| 601259 | Monarch Botanika | | Monarch Botanika | 1565 Calle La Cumbre, Camarillo CA 93010, **US** | Native 145696 |
| 590291 | Unique Plastique | | Unique Plastique | 16 rue du Tisserand, Lévis QC G6V7E4, CA | Native 145696 |

> Structure notable : **cinq entités logistiques distinctes dans un seul compte** — Lasclay, un photographe, un atelier à Saint-Zacharie, un partenaire américain (Californie) et un fabricant plastique. Une alternative doit modéliser l'expéditeur comme entité de premier ordre, pas comme simple adresse.

### 13.3 Transporteurs et services (94 services, 8 transporteurs porteurs de services + GlobalPost)

| carrierId | Fournisseur (labelProvider) | Nb services |
|---|---|---|
| **11** | **Canada Post** *(compte propre, « LASCLAY »)* | 23 |
| 127 | Canada Post One Balance™ | 20 |
| 194 | FedEx One Balance | 12 |
| 3 | UPS by ShipStation | 11 |
| 128 | Purolator Canada One Balance | 8 |
| 195 | DHL Express One Balance | 8 |
| 104 | Canpar One Balance™ | 6 |
| 3750 | ShippingChimp | 6 |
| 2528 | GlobalPost | *(types de colis seulement)* |

**Services Canada Post visibles (compte 11)** — le service par défaut de fait est le n°99 :
`99 Expedited Parcel (Carbon Neutral)` · `100 Xpresspost` · `102 Priority` · `104 Expedited Parcel USA` · `105/106/107 Priority Worldwide Envelope/pak/Parcel USA` · `108 Small Packet Air - USA` · `109 Tracked Packet - USA` · `110 Tracked Packet - USA (LVM)` · `111 Xpresspost USA` · `112 Xpresspost International` · `113 International Parcel Air` · `114 International Parcel Surface` · `115/116/117 Priority Worldwide Envelope/pak/parcel Intl` · `118 Small Packet International Air` · `119 Small Packet International Surface` · `120 Tracked Packet - International`
*Masqués :* `98 Regular Parcel (Carbon Neutral)`, `101 Xpresspost Certified`, `103 Library Books`.

**Codes de confirmation observés :** `0` = aucune confirmation · `1` = confirmation de livraison (*Delivery Confirmation*) · `2` = signature requise (*Signature Required*) · `5` = **Do Not Safe Drop** (Canada Post).
*Les libellés exacts de 1 et 2 sont à confirmer dans le menu Confirmation d'une commande — les presets utilisent les deux (`USA Small poly` = 1, `JSB Couteaux Tsuru` = 2, `prorec` = 2).*

**Précédence des dimensions et du poids — à trancher avant implémentation.** Le preset « prorec » déclare 20 × 19 × 18 po alors que son type de colis « JSB Grosse boite » mesure 17 × 12 × 12 po ; le preset « 11x11x12 » déclare 10 g pour une boîte de 11 × 11 × 12 po (valeur vraisemblablement erronée, à corriger à la migration). L'ordre de précédence observé semble être :
`preset > product profile (preset group) > produit > type de colis`
mais il n'est documenté nulle part. **À valider empiriquement**, car c'est ce qui détermine le poids facturé.

### 13.4 Types de colis personnalisés (17 sur 51)

| packageTypeId | Nom | Dimensions (po) |
|---|---|---|
| 115317 | **Polymailer Small** | (souple) |
| 115318 | **Polymailer Medium** | (souple) |
| 123516 | Kraft mailer | (souple) |
| 133384 | Petite enveloppe kraft | (souple) |
| 126003 | 7.5 × 2.5 × 4.5 | 7,5 × 4,5 × 2,5 |
| 123521 | Boite 8.5 × 4 × 4 | 8,5 × 4 × 4 |
| 124753 | box 6×6×6 | 6 × 6 × 6 |
| 115209 | Box 12 × 6 × 6 | 12 × 6 × 6 |
| 115939 | Box 12 × 12 × 6 | 12 × 12 × 6 |
| 115962 | Box 18.5 × 14 × 7 | 18,5 × 14 × 7 |
| 135865 | box 11×11×12 | 11 × 11 × 12 |
| 135864 | boite casse tete JSB | 16 × 6,5 × 6 |
| 127886 | JSB 1 LIVRE | 12,5 × 12,5 × 2 |
| 127887 | JSB Calendrier Box | 19,5 × 12 × 4 |
| 127888 | JSB Grosse boite | 17 × 12 × 12 |
| 127879 | JSB Kft 12×19 | (souple) |
| 133007 | JSB Couteaux | 18 × 4 × 3,5 |

Plus 34 types transporteur (FedEx Box/Envelope/Pak/Tube/10kg/25kg, Flat Rate Envelope, etc.).

### 13.5 Préréglages d'expédition — Shipping Presets (17)

Aucun n'a de raccourci clavier assigné (`hotKey: null` partout — occasion manquée d'accélération).

| Nom | Ship From | Colis | Conf. | Service | Poids | Dimensions (po) |
|---|---|---|---|---|---|---|
| 11x11x12 | LAS Capucins | box 11×11×12 | 5 | CP 99 | 10 g | 11 × 11 × 12 |
| 7.5 x 2.5 x 4.5 | LAS Capucins | 7.5×2.5×4.5 | 5 | CP 99 | 80 g | 7,5 × 4,5 × 2,5 |
| 9x6x2 | Unique Plastique | Package | 5 | CP 99 | 60 g | 9 × 6 × 2 |
| Boite 8.5x4x4 | LAS Capucins | Boite 8.5×4×4 | 5 | CP 99 | 500 g | 8,5 × 4 × 4 |
| box 6x6x6 | LAS Capucins | box 6×6×6 | 5 | CP 99 | 100 g | 6 × 6 × 6 |
| kraft mailer 6x9 | LAS Capucins | Kraft mailer | 5 | CP 99 | 100 g | — |
| **Small Poly 1 mit** | LAS Capucins | Polymailer Small | 5 | CP 99 | 100 g | — |
| **USA Small poly** | LAS Capucins | Polymailer Small | **1** | **CP 109** *(Tracked Packet USA)* | 100 g | — |
| prorec | LAS Capucins | JSB Grosse boite | 2 | **CP 102** *(Priority)* | 9 000 g | 20 × 19 × 18 |
| boite 1 casse tete JSB | Jean-Simon Begin | boite casse tete JSB | 5 | CP 99 | — | 16 × 6,5 × 6 |
| Boite Blanche | Jean-Simon Begin | JSB Calendrier Box | 5 | CP 99 | — | 19,5 × 12 × 4 |
| JBS Combo livre | Jean-Simon Begin | Box 12×12×6 | 5 | CP 99 | 2 005 g | 12 × 12 × 6 |
| JSB 1Livre | Jean-Simon Begin | JSB 1 LIVRE | 5 | CP 99 | — | 12,5 × 12,5 × 2 |
| JSB Couteaux Tsuru | Jean-Simon Begin | JSB Couteaux | **2** | CP 99 | 600 g | 18 × 4 × 3,5 |
| JSB Grosse boite | Jean-Simon Begin | JSB Grosse boite | 5 | CP 99 | — | 17 × 12 × 12 |
| JSB Kraft | Jean-Simon Begin | JSB Kft 12×19 | 5 | CP 99 | 900 g | — |
| JSB Poly | Jean-Simon Begin | Polymailer Medium | 5 | CP 99 | 900 g | — |

### 13.6 Mappings de service (Service Mappings) — boutique LAS Shopify

Traduit le libellé de service choisi au checkout en service transporteur réel.

| Service demandé (checkout) | Service ShipStation | Colis |
|---|---|---|
| **Canada Post Expedited Parcel** | Canada Post | Package |
| **Free Shipping** | Canada Post | Package |
| **Free Shipping / Livraison gratuite** | Canada Post | Package |
| **Stamp (no tracking)** | Canada Post | **Polymailer Small** |
| **Standard** | Canada Post | Package |
| FedEx 2 Day / Express Saver / Ground / Ground Home Delivery / Home Delivery / International Economy / International Priority / Priority Overnight / Standard Overnight | *(non mappé)* | |
| UPS Ground | *(non mappé)* | |
| USPS Express Mail / Express Mail International / First Class International / First Class Mail / First-Class Mail International Package / Parcel / First-Class Mail Package / Parcel … | *(non mappé)* | |

**Deux réserves importantes sur cette table :**

1. **La colonne « Service ShipStation » n'affiche que le transporteur** (« Canada Post »), jamais le service précis (99 ? 109 ?). Le mapping n'est donc **pas reproductible en l'état** : il faut ouvrir chaque ligne via *Edit* — ou lire l'objet `packingSlip`/`serviceMapping` de `/api/seller/stores` — pour obtenir le `serviceId`. **À recapturer avant la Phase 1.**
2. **Le mapping n'a été capturé que pour LAS Shopify.** L'onglet *Shipping Services* existe au niveau de **chaque** boutique (§ 11.1) : LAS Etsy et FAIRE Lasclay ont leurs propres tables, non capturées.

> ⚠️ Les libellés opérationnels utilisés par les règles et les vues (`Entrepôt Lasclay`, `Défricheuses`, `DDD`, `ramassage`, `capucins`, `timbre`) **n'apparaissent pas explicitement** dans la table : ils sont matchés en texte libre sur `RequestedServiceMarketPlace`. Seul `timbre` a très probablement pour équivalent la ligne anglaise **« Stamp (no tracking) → Polymailer Small »** — à confirmer. C'est fragile (dépend de l'orthographe exacte saisie dans Shopify) et doit devenir un **enum de canal logistique** dans l'alternative (exigence issue de OBS6).

### 13.7 Étiquettes (Tags) — 6

| tagId | Nom | Couleur |
|---|---|---|
| 37964 | JSB traité par LASCLAY | `#FF00FF` |
| 43269 | Non expédiable avec Chit Chats | `#FF0000` |
| 37367 | **Non expédié** | `#FFCC00` |
| 15051 | Priority | `#FF6600` |
| 37675 | Réexpédition | `#00FF00` |
| 10614 | **Timbre** | `#00CCFF` |

### 13.8 Modèles

**Bons de préparation (packing slips)** : `LAS Template` (2034, 4×6, privé) + les modèles système ShipStation (4×6, A4, A6, Letter). Modèle en usage sur les 4 boutiques : `Default 4" x 6"` (id 2).

**Courriels d'expédition** : `Default Shipment Template` (1) · **`DDD Template` (5770)** · **`Lucie Veilleux` (6054)**
**Courriels de livraison** : `Default Delivery Template` (2)

### 13.9 Réglages du compte (extraits significatifs)

**Unités et localisation**
`UnitOfMeasure:Weight = Gram` · `UnitOfMeasure:Dimension = Inch` · `PreferredLocale = en-CA` (utilisateur : `en`) · `UI:DateFormat = DD/MM/YYYY` · `UI:TimeFormat = HH:mm`

**Comportement d'expédition**
`AutoRate = true` · `AutoRoute = false` · `DisableRouting = true` · `QuickShip = true` (mais `quickship:isEnabled = false` côté utilisateur) · `ShippingServiceGrouping = Provider` · `RequireReshipConfirmation = true` · `ShouldHideDuplicateOrders = true` · `HidePhantomOrders = true` · `SkipDockRating = true` · `EnableOrderItemMerging = true` · `EnableSplitShip = false` · `EnableSmartOrderRouting = false`

**Douanes**
`CustomsContentType = Merchandise` · `CustomsItemCountry = CA` · `CustomsNonDelivery = Return` · `CreateCustomsItems = orderitems` · `CustomsItemHarmonization = ` **(vide)** · `CustomsStoreCurrency = false` · `BillDutiesAndTaxesToPayor = false` · `BypassETD = false` · `TaxIdType = EIN` · `DisableByoaEstimatedDutiesAndTaxes = false` · `PrepayByoaDutiesAndTaxesWithWallet = false`

**Assurance**
`Insurance.CarrierEnabled = true` · `Insurance.ExternalEnabled = true` · `Insurance.SystemAutomationApplyXCover = true` · `Insurance.SystemAutomationApplyParcelGuard = false` · `Insurance.SystemAutomationApplyAll = false` · `Insurance.SystemAutomationReturnApplyXCover = true`
→ **XCover assure automatiquement chaque expédition** (visible dans le journal : *« Insurance provider automatically set to XCover / Insured value automatically set to 183.64 »*). Poste de coût significatif à réévaluer.

**Bons de préparation**
`HtmlPackingSlips = true` · `PSFormat = 4x6` · `PSInline = true` · `PSItemPrices = Include` · `PSItemSorting = Quantity desc` · `PSHalfPageContinuation = false` · `CollatePackingSlips = inline` · `PackingSlipPrices = true` · `PackingSlipsItemImages = true` · `PackingSlipsSkus = true` · `PackingSlipsNotesFromBuyer = true` · `PackingSlipsNotesToBuyer = true` · `PackingSlipsSeparateItemOptions = true` · `PackingSlipsDistinguishMultiples = true` · `PackingSlipShowDiscounts = true` · `PackingSlipReturnQrCode = false` · `EnablePackingSlipLogos = true` · `PostPackingSlipPrinted = DoNothing`

**Liste de prélèvement (pick list)**
`PickListGrouping = SKU` · `PickListSorting = Items` · `PickListImages = true` · `PickListWarehouseLocation = Shipping` · `PickListInventoryCounts = false` · `PickListMasterSku = false` · `PickListOrderNumbers = false` · `PickListZeroQuantity = false` · `IncludeLotIdInPickList = false`

**Images produit** `ProductImageMaxWidth = 200` · `ProductImageMaxHeight = 100`

**Divers** `PdfInBrowser = true` · `UsbScale = false` · `SingleUserSessions = true` · `WeeklyDigest = true` · `ShopifyUseFulfillableQuantity = true` · `EnableLabelLogos = false` · `HideReturnAddress = false` · `EnableScanToPrint = true` · `Connect:AutoScaleEnabled = false` · `EnableShipstationReturns = false` · `EnableProviderWallet = true` · `RecurlyPaymentNickname = Visa ••••9044`

**Préférences utilisateur** `DefaultUrl = #/orders` · `orders:grid:pagesize = 250` · `products:grid:pagesize = 500` · `track:shipments:grid:pagesize = 500` · `customsFormViewMode = tab` · `v3.orders.grid.drawerVisibility = false` · `v3.Orders:Drawer:GroupItemsBy = items` · `Hints:Show = true`

---

## 14. API interne observée (`ship15.shipstation.com/api/*`)

Ces endpoints sont ceux que l'application web consomme. Ils sont **plus riches que l'API publique** et constituent la meilleure référence de modèle de données pour la reconstruction. *(Accessibles en session authentifiée par cookie ; usage à des fins de migration uniquement.)*

### 14.1 Compte et référentiel
```
GET  /api/seller                              identité du vendeur
GET  /api/seller/settings                     307 réglages à plat (clé → valeur string)
GET  /api/user/current                        utilisateur courant
GET  /api/user/setting                        103 préférences utilisateur (dont config des grilles)
GET  /api/account/planInfo                    forfait, limites, options de support
GET  /api/account/billingInfo
GET  /api/account/v2/getSellerApiKeys
GET  /api/seller/workstations
```

### 14.2 Expédition
```
GET  /api/seller/stores                       boutiques
GET  /api/seller/shipfrom                     emplacements d'expédition
GET  /api/seller/packagetypes                 types de colis
GET  /api/seller/services                     services transporteur (94)
GET  /api/seller/labelproviders
GET  /api/provider/seller                     fournisseurs d'étiquettes
GET  /api/carrier  ·  /api/carrier/seller/carrierIds
GET  /api/presets                             préréglages d'expédition
GET  /api/packageset  ·  /api/serviceCollection  (Rate Shopper)
GET  /api/reference/service  ·  /api/service/classifications
GET  /api/wallet  ·  /api/wallet/eligibility/v2
GET  /api/iors                                Importers of Record
GET  /api/taxIdentifiers
```

### 14.3 Automatisation *(les plus importants pour la migration)*
```
GET  /api/automationRule/rules                règles + actions (JSON complet)
GET  /api/automationRule/getRuleActionTypes   catalogue des 44 types d'action
GET  /api/orderfilterset                      filtres (dont les filtres cachés des règles)
```

### 14.4 Grilles et vues
```
GET  /api/gridconfig                          ← LES 27 VUES SAUVEGARDÉES
```
Format d'un enregistrement :
```jsonc
{
  "gridConfigId": "uuid",
  "gridConfigTypeId": "Order",
  "gridConfigName": "TIMBRE 2.0",
  "gridConfigOwnerUsername": "admin@lasclay.com",
  "configData": "\"{\\\"appliedFilters\\\":[…],\\\"gridViewId\\\":\\\"awaiting-shipment-{storeGuid}\\\"}\""
  // ⚠️ configData est du JSON DOUBLEMENT encodé : JSON.parse deux fois
}
```
Un filtre appliqué :
```jsonc
{ "id":"uuid", "filterById":"itemSku", "type":"TYPE_STRING",
  "filterValue":"ItemSku", "criterionOperatorValue":"DoesNotContain",
  "criterionArgumentValue":["22","23","SEEDBMB"] }
```

La disposition des colonnes est stockée dans `/api/user/setting` sous des clés du type
`v3.orders.gridConfig.{vue}[-{storeGuid}].default` :
```json
[{"id":"order-number","index":0,"width":150,"pinned":false},
 {"id":"orderDate","index":2,"width":107,"pinned":false,"sorted":"descending"}, …]
```
Clés observées : `v3.orders.gridConfig..default`, `…advanced-search…`, `…alerts…`, `…all-orders-search-result[-{storeGuid}]…`, `…awaiting-shipment[-{storeGuid}]…`, `v3.customers.gridConfig.all-customers.default`, `v3.fulfillments.gridConfig.fulfillments[-recent].default`.

### 14.5 Produits et inventaire
```
POST /api/productgrid          body: {"page":{"pageNumber":1,"pageSize":1000}}  → catalogue complet
GET  /api/product/profiles                    preset groups
GET  /api/productCategory
GET  /api/inventoryWarehouses  ·  /api/inventoryLocations  ·  /api/totes
GET  /api/store/productsRefreshStatus
```

### 14.6 Documents et communications
```
GET  /api/packingslip
GET  /api/emailtemplate/shipment  ·  /api/emailtemplate/delivery
GET  /api/return/reasons
GET  /api/label/batch/labelBatches
GET  /api/tag
GET  /api/notifier/send
```

### 14.7 Divers
```
GET  /api/2026-04/graphql.json      (couche GraphQL récente, coexiste avec le REST)
GET  /api/pusher/config  ·  /api/pusher/auth/batch   (temps réel via Pusher)
```

---

## 15. Défauts observés et critiques publiques → exigences pour l'alternative

### 15.1 Défauts constatés directement sur le compte Lasclay

| # | Constat | Preuve | Exigence |
|---|---|---|---|
| **OBS1** | Erreur d'API bloquante à l'ouverture d'une commande : `validation_error: An API error occurred. [0].packages: [] should be non-empty.` s'affiche en surimpression du bouton d'achat d'étiquette | Commande L-50762 | Messages d'erreur **traduits et actionnables**, jamais d'erreur brute de validation d'API exposée à l'utilisateur |
| **OBS2** | Boutique FAIRE en échec d'import depuis le 27/05/2026 ; *View Details* → **« No error details are currently available »** | Panneau de rafraîchissement | **Journal d'import par boutique** : horodatage, code d'erreur, charge utile, nombre de commandes lues/importées/rejetées, avec rejeu |
| **OBS3** | Aucune cadence d'import garantie n'est exposée (« whenever ») | Panneau *Check for new orders* | **Contrat de synchronisation affiché** : dernière synchro réussie, prochaine synchro, latence médiane, alerte si dépassement |
| **OBS4** | Le poste **Scan** est inutilisable sans ShipStation Connect (agent local) | Écran Scan | **Impression navigateur native** (PDF/ZPL direct, WebUSB), agent local en repli seulement |
| **OBS5** | 17 préréglages, **zéro raccourci clavier assigné** | `/api/presets` | Raccourcis clavier obligatoires + palette de commandes ⌘K |
| **OBS6** | Les canaux logistiques sont matchés en **texte libre** sur le libellé de service Shopify (`Entrepôt Lasclay`, `DDD `, `Défricheuses`) | Règles 9-11, vues 6/7/9/11/14/16/23 | **Canal logistique = enum de premier ordre**, mappé explicitement, jamais du texte libre |
| **OBS7** | Valeur `DDD ` avec **espace final** ; vues « 1er dec », « 3 mars » jetables | `/api/gridconfig`, règle 10 | Normalisation des valeurs + objet **Campagne** avec date d'expiration pour les vues temporaires |
| **OBS8** | 403 produits sur 472 **sans code SH** ; `CustomsItemHarmonization` global vide ; « Import harmonization codes » **désactivé** côté Shopify | § 16 | Code SH **obligatoire** avant toute étiquette internationale + héritage produit → déclaration |
| **OBS9** | Marge d'expédition **négative** : −703,52 $ sur juillet 2026 (revenu 391 $ vs coût 1 095 $) | Analytics | **Alerte de marge par commande** avant achat d'étiquette : coût réel vs frais facturés au client |
| **OBS10** | XCover assure automatiquement chaque envoi sans arbitrage visible | `Insurance.SystemAutomationApplyXCover = true` | Politique d'assurance **par règle et par seuil de valeur**, avec coût affiché |

### 15.2 Critiques publiques récentes (2024-2026) — synthèse et traduction en exigences

Sources : Trustpilot (3,0/5, 512 avis, ~47 % de 1 étoile), G2, Capterra, GetApp, ShipStation Community, Shopify App Store, Shopify Community, Etsy Community, IsDown. *(Reddit inaccessible depuis l'environnement de capture.)*

#### A. Modèle économique

| Plainte | Source | Exigence |
|---|---|---|
| **API, webhooks et impression en masse mis derrière un paywall** le 19 mai 2025 (Gold US/CA, Scale UK/AU/NZ/EU). « After years of paying for your service and building our workflow around your platform, you arbitrarily cut off API access and hold it hostage behind a paywall » (G2, 22/05/2025) ; « $110 extra a month » (Capterra, 15/05/2025) | [G2](https://www.g2.com/products/shipstation/reviews), [Capterra](https://www.capterra.com/p/155621/ShipStation/reviews/?page=2), [1TeamSoftware](https://1teamsoftware.com/documentation/shipstation-shipping/using/shipstation-api-access-limited-to-gold-amp-scale-plans-effective-may-2025/) | **A1** — API et webhooks inclus sans exception. L'API est l'interface du produit, pas une option. |
| Hausses répétées : Gold 69,99 → 99,99 $ **en réduisant** le quota 3 000 → 2 500 (janv. 2023) ; frais empilés (« Your Carriers » 5-95 $/mois, Amazon Buy Shipping 20 $/mois, frais par expédition) | [ShipStation Community](https://community.shipstation.com/t5/ShipStation-Features/Subscription-Fee-Huge-Increase/m-p/17422), [Shipment Fees by Plan](https://help.shipstation.com/hc/en-us/articles/22354433862555-Shipment-Fees-by-Plan) | **A2** — Aucun frais pour brancher ses propres comptes transporteurs. |
| « Shipping Cost display is not including add ons like confirmation and insurance » | [Community](https://community.shipstation.com/t5/ShipStation-Features/Shipping-Cost-display-is-not-including-add-ons-like-confirmation/m-p/23210) | **A3** — Coût total réel affiché avant achat, ventilé. |
| Ajustements transporteurs surprises, soldes négatifs, remboursements à 6 semaines. « holds up hundreds of my dollars for literal months » | [Community](https://community.shipstation.com/t5/ShipStation-Features/UPS-Disputes-amp-Shipstation-customer-service-taking-WAY-too/td-p/26425), [Trustpilot](https://www.trustpilot.com/review/shipstation.com) | **A4** — Journal d'ajustements par colis (acheté vs facturé vs delta + motif), contestation en un clic, aucun blocage de fonds. |

#### B. Architecture de synchronisation — le plus gros différenciateur possible

| Plainte | Source | Exigence |
|---|---|---|
| « **ShipStation only imports an order once.** So if you remove hold tags, split fulfilment, or update the shipping location afterwards, it is impossible to get it to sync. » ; multi-emplacements qualifié de « core failure » ; aucun *hold and release* | [Shopify App Store, 22/07/2026, 2/5](https://apps.shopify.com/shipstation/reviews?sort_by=most_recent) | **B1** — Commande = objet vivant re-synchronisé sur tout changement amont. Événements + balayage de réconciliation, jamais un import ponctuel. |
| Commandes Shop Pay jamais importées après annulation d'autorisation (« at least half dozen orders a week ») | [Shopify Community](https://community.shopify.com/t/some-shopify-orders-are-not-importing-into-shipstation-after-shop-pay-glitch/302308) | **B2** — Ne jamais dépendre des seuls webhooks : balayage sur `updated_at` + **tableau de réconciliation** « présentes chez le marchand, absentes ici » avec import en un clic. |
| Commandes dupliquées importées | [Community](https://community.shipstation.com/t5/Order-Source-Integrations/Duplicate-Orders-Are-Importing-from-Shopify-Based-Stores/m-p/27735) | **B3** — Clé d'idempotence `(source_store_id, source_order_id)` en contrainte d'unicité + détection de quasi-doublons. |
| Split shipments : un seul numéro de suivi renvoyé à Shopify | [Community](https://community.shipstation.com/t5/Order-Source-Integrations/Split-Shipments-not-Updating-Shopify-Properly/td-p/25848) | **B4** — N expéditions → N fulfillments renvoyés avec les bonnes lignes. |
| Inventory Sync : « it zero'ed out my inventory and I lost sales » ; 7 500 SKU en 4 h sur 28 000 | [Community](https://community.shipstation.com/t5/ShipStation-Features/Has-anyone-enabled-Inventory-Sync-yet-How-well-does-it-work/m-p/25916) | **B5** — Synchro incrémentale par delta, jamais de remise à zéro. Mode simulation obligatoire, garde-fou « ne jamais écrire 0 sans confirmation », journal réversible. |

#### C. Performance et ergonomie

| Plainte | Source | Exigence |
|---|---|---|
| « My performance is about **4x slower** to process a shipment due to severe lagging » ; étiquettes qui gèlent pendant la génération | [Community](https://community.shipstation.com/t5/ShipStation-Features/order-page-problem-works-INCREDIBLY-slow-since-update/m-p/20513) | **C1** — Budget de performance contractuel : grille de 1 000 commandes < 500 ms, achat d'étiquette < 2 s, génération **asynchrone non bloquante**. |
| « There is far too much spacing in this new layout requiring scrolling » ; un membre a écrit **ses propres surcharges CSS** pour réduire le padding | [Community](https://community.shipstation.com/t5/ShipStation-Features/New-Layout-horrible-More-steps-required-to-do-the-same-work/m-p/22668) | **C2** — Mode densité (compact / confortable / spacieux) persistant. Cible : 40+ lignes visibles en 1080p. |
| « The new layout definitely does not work for our shipping team. Our team uses tags frequently… » — plus de clics qu'avant | [Community](https://community.shipstation.com/t5/ShipStation-Features/Piling-on-on-the-new-layout-not-designed-for-me/m-p/22568) | **C3** — Aucune action fréquente à plus d'un clic ; nombre de clics par expédition suivi comme KPI produit. |
| Impossible de revenir à l'ancienne version (fils *V3 Sucks*, *Everything is worse*, *Re-enable V2 already*) | Community | **C4** — Toute refonte derrière un basculement volontaire, ancienne version maintenue 12 mois. |
| Le scan **réinitialise les filtres de statut**, provoquant des expéditions en double | [Shopify App Store](https://apps.shopify.com/shipstation/reviews?sort_by=most_recent) | **C5** — Mode scan strict : filtre verrouillé, refus explicite (son + message) sur commande déjà expédiée. |
| **C6** | *(constat direct OBS2)* | Toute erreur d'intégration expose un code, un message, une charge utile et une action corrective. |

#### D. Automatisation, filtres et vues

| Plainte | Source | Exigence |
|---|---|---|
| Règles incapables de traiter correctement les commandes **multi-articles** — demande ouverte, ≥ 5 pages de commentaires | [Community idea #6000](https://community.shipstation.com/t5/Orders-Shipment-Management/Allow-for-automation-rules-to-work-on-multiple-item-orders/idi-p/6000) | **D1** — Moteur de règles au **niveau ligne de commande** : `ANY item` / `ALL items` / `ONLY items` / agrégats (poids total, nb de SKU distincts), actions par ligne. |
| Conflits d'ordre entre règles et mappings de service | [Community](https://community.shipstation.com/t5/Strategies-Workflows/Automation-rule-not-overwriting-mapped-carrier-and-package-type/m-p/11809) | **D2** — Précédence explicite + **simulation à sec** montrant, pour une commande donnée, les règles déclenchées et la gagnante. |
| Demandes ouvertes depuis 4+ ans ; 2 727 idées dont 331 « under review » | [Shopify App Store 19/06/2026](https://apps.shopify.com/shipstation/reviews?sort_by=most_recent), [feedback.shipstation.com](http://feedback.shipstation.com/forums/330429-product-feedback-fresh-ideas/status/466259) | **D3** — *(sans objet pour un outil interne, mais : tenir un backlog visible)* |
| Pas de routage d'impression domestique vs international | Community Ideas | **D4** — Routage d'impression conditionnel, piloté par les mêmes conditions que les règles. |

#### E. Impression et matériel

| Plainte | Source | Exigence |
|---|---|---|
| « We use ShipStation Connect to print our labels… and **almost daily we lose connection** » | [Community](https://community.shipstation.com/t5/ShipStation-Features/ShipStation-Connect-constantly-losing-connection/m-p/18624) | **E1** — Impression navigateur native prioritaire ; file d'impression persistante qui survit à une coupure ; indicateur de santé imprimante. |
| Douchettes laser Zebra non supportées (caméra seulement) | Community Ideas | **E2** — Support des scanners HID (mode clavier) en plus de la caméra. |
| Erreurs d'impression silencieuses | Community Ideas | **E3** — Chaque étiquette a un statut (en file / envoyée / imprimée / échec) + réimpression sans nouvel achat. |

#### F. International et douanes

| Plainte | Source | Exigence |
|---|---|---|
| « The **ONLY** thing Shipstation includes on the USPS and UPS customs declaration information is the product total » — port et assurance laissés vides alors qu'ils sont taxables | [Community](https://community.shipstation.com/t5/ShipStation-Features/Shipstation-is-not-compliant-with-International-customs-laws/m-p/15288) | **F1** — Valeur douanière complète et paramétrable (marchandise + port + assurance), conforme CIF/FOB par destination. |
| ITN absent de la facture commerciale FedEx ; champs de référence DHL Globalmail supprimés en « version 4 » | Community | **F2** — Champs ITN / EEL / EORI / IOSS de premier ordre, imprimés ; champs de référence testés en non-régression à chaque mise à jour d'intégration. |
| Suppression du de minimis UE (perturbation en cours depuis le 08/07/2026) ; DDP lancé en nov. 2025 | [IsDown](https://isdown.app/status/shipstation), [Businesswire](https://secure.businesswire.com/news/home/20251118263606/en/ShipStation-Streamlines-Duty-and-Tax-Payments-for-US-Businesses-Shipping-Internationally) | **F3** — Estimation des droits et taxes, choix DDP/DAP par commande ou par règle, alerte au franchissement de seuil de minimis. |

#### G. API, webhooks, intégration

| Plainte | Source | Exigence |
|---|---|---|
| 40 req/min ; webhooks qui ne transmettent qu'un `resource_url` → **rappel API obligatoire** consommant le quota | [ShipExtension](https://shipextension.com/blog/shipstation-webhooks-guide), [docs](https://docs.shipstation.com/rate-limits) | **G1** — Webhooks à **charge utile complète**, limites publiées, en-têtes de quota standard. |
| Aucune signature de webhook | ShipExtension | **G2** — HMAC-SHA256 signé, secret rotatif, horodatage anti-rejeu. |
| Aucune garantie de redélivrance : « do not assume you will receive every webhook » | ShipExtension | **G3** — Redélivrance avec back-off, journal de livraison, **rejeu manuel** depuis l'interface, endpoint de réconciliation par curseur. |
| « I'm trying to connect to the ShipStation API, and **the online documentation is terrible** » (G2, 24/06/2026) | [G2](https://www.g2.com/products/shipstation/reviews) | **G4** — OpenAPI généré, bac à sable, SDK, collection Postman. |

#### H. Fiabilité et support

| Plainte | Source | Exigence |
|---|---|---|
| **438 incidents depuis mars 2021**, 12 sur 90 jours ; **3 pannes de connexion en un mois** (1, 3 et 30 juin 2026) | [IsDown](https://isdown.app/status/shipstation) | **H1** — Page de statut instrumentée automatiquement, post-mortems, **mode dégradé** permettant au moins d'imprimer les étiquettes déjà achetées. |
| « we've reported bugs that have been unaddressed for years » ; « got rid of most of their customer service reps, and you have to ask AI 10 times » | [G2](https://www.g2.com/products/shipstation/reviews) | **H2** *(non normatif — organisationnel)* — suivi de bugs visible, aucun mur d'IA |

---

## 16. Codes SH (harmonisation douanière) — état et plan de complétion

### 16.1 État actuel

Extraction du catalogue complet (`POST /api/productgrid`, 472 produits actifs) :

| Mesure | Valeur |
|---|---|
| Produits actifs | **472** |
| Avec code SH (`customsTariffNo`) | **69** (14,6 %) |
| **Sans code SH** | **403** (85,4 %) |
| Avec description douanière (`customsDescription`) | 70 |
| Valeur du réglage global `CustomsItemHarmonization` | **vide** |
| Option Shopify « Import harmonization codes » | **désactivée** |

**Codes SH actuellement en usage — 5 combinaisons seulement** (42 + 14 + 11 + 1 + 1 = 69, cohérent avec le total ci-dessus) :

| Occurrences | Code | Description | Pays d'origine |
|---|---|---|---|
| 42 | `3407.00` | *Modeling pastes* | CA |
| 14 | `9505.90` | *Confetti* | CA |
| 11 | `2309.90` | *Dog food* | CA |
| 1 | `1209.30` | *Milkweed Seed* | CA |
| 1 | `6307.90` | *Insulated lunch bag* | CA |

> ⚠️ **Point à valider avec un courtier en douane.** Les descriptions *Modeling pastes* (3407.00), *Confetti* (9505.90) et *Dog food* (2309.90) appliquées aux bombes semencières et aux graines semblent être des contournements destinés à éviter les contrôles phytosanitaires à l'exportation vers les États-Unis. Ce document **reprend la convention existante sans la valider** : une déclaration douanière inexacte engage la responsabilité de l'exportateur. À arbitrer explicitement avant la migration.

### 16.2 Nature du catalogue

Les 472 produits couvrent **plusieurs entités commerciales** dans un même compte :

- **Lasclay** — produits isolés à la soie d'asclépiade : vêtements (manteaux, chandails, mitaines, tuques, bandeaux, foulards), literie (oreillers, sacs de couchage, coussins), sacs isothermes (besaces, sacs à lunch, glacières, manchons), accessoires de cuisine (maniques, sous-plats), semences, plantules, soie en vrac, bombes semencières, cosmétiques, bijoux monarque.
- **Jean-Simon Begin** (photographe animalier) — tirages d'art, cartes de vœux, calendriers, cahiers, signets, casse-tête, jeux de cartes, tasses (céramique et émail), couvertures, sacs en coton, étuis de téléphone.
- **TSURU Couteaux** — couteaux japonais (Gyuto, Nakiri, Petty, Sujihiki, Hakata…).
- **Unique Plastique** — pinces et barrettes à cheveux.

### 16.3 Classification proposée

Un moteur de règles par mots-clés (SKU d'abord, puis nom de produit, du plus spécifique au plus générique) a été appliqué aux 403 produits sans code. **387 sur 403 sont classés automatiquement (96 %)** ; 16 restent à arbitrer manuellement.

| Code SH | Nb | Libellé douanier proposé | Familles concernées |
|---|---|---|---|
| `4202.92` | 60 | Contenants à surface extérieure textile / plastique | besaces isothermes, sacs à lunch, tote bags, sacs à dos glacière, manchons à boissons, sacs à bouteille, étuis isolés, sacs réutilisables en coton |
| `3926.90` | 59 | Étuis de protection en matière plastique | étuis de téléphone (iPhone, Galaxy, Pixel), petits étuis |
| `4911.91` | 29 | Images, gravures, photographies imprimées | tirages d'art, illustrations, impressions papier |
| `9615.90` | 22 | Pinces et barrettes à cheveux | pinces (petite/moyenne), pinces à mitaines, SKU `PIN-*` |
| `7117.19` | 20 | Bijouterie de fantaisie | bagues, pendentifs, boucles d'oreilles Asclepias / Aile de monarque |
| `6116.93` | 17 | Gants et mitaines en bonneterie, fibres synthétiques | mitaines, gants magiques, mitaines urbaines, ski mittens |
| `6117.10` | 15 | Châles, écharpes, foulards en bonneterie | foulards, cache-cous, quilted scarf / neck warmer |
| `6912.00` | 15 | Vaisselle en céramique | tasses céramique |
| `1209.30` | 13 | Semences de plantes herbacées cultivées pour leurs fleurs | graines et semences d'asclépiade (toutes variétés et conditionnements) |
| `8211.92` | 11 | Couteaux à lame fixe | couteaux TSURU, « Silencieux » |
| `6117.80` | 10 | Autres accessoires vestimentaires en bonneterie | bandeaux |
| `0602.90` | 10 | Autres plants vivants | plantules d'asclépiade |
| `6301.40` | 9 | Couvertures en fibres synthétiques | couvertures / throws |
| `6307.10` | 9 | Serpillières, lavettes, chamoisettes | serviettes et linges en microfibre |
| `6405.20` | 9 | Chaussures à dessus en matières textiles | pantoufles |
| `6406.90` | 9 | Autres parties de chaussures | semelles intérieures isolantes |
| `7323.94` | 9 | Articles de ménage en fer ou acier, émaillés | tasses émail |
| `1404.90` | 8 | Autres produits végétaux | soie d'asclépiade pure en vrac / milkweed floss |
| `9503.00` | 7 | Puzzles et casse-tête | casse-tête |
| `6505.00` | 7 | Chapeaux et coiffures en bonneterie | tuques |
| `3407.00` | 6 | *(convention existante)* Pâtes à modeler | bombes semencières — **à revalider** |
| `6307.90` | 6 | Autres articles textiles confectionnés | maniques, poignées de four, sous-plats, mitaines de four |
| `4909.00` | 5 | Cartes postales et cartes de vœux imprimées | ensembles de cartes de vœux |
| `4820.10` | 4 | Registres, cahiers, carnets | cahiers de notes |
| `4910.00` | 4 | Calendriers imprimés | calendriers |
| `9404.90` | 3 | Articles de literie rembourrés | oreillers, coussins d'assise, coussins pour animaux |
| `4911.99` | 3 | Autres imprimés | signets |
| `4819.10` | 2 | Boîtes et caisses en carton ondulé | cartons, présentoirs |
| `9504.40` | 2 | Cartes à jouer | jeux de cartes |
| `4821.10` | 1 | Étiquettes en papier imprimées | étiquettes |
| `3919.90` | 1 | Plaques et feuilles auto-adhésives en plastique | autocollants vinyle |
| `3304.99` | 1 | Préparations de beauté / soins de la peau | huile d'asclépiade, nettoyant visage |
| *(exclure)* | 1 | Non expédiable | carte-cadeau |

**Codes attendus mais non déclenchés** (produits actuellement inactifs ou déjà pourvus) : `6201.40` / `6202.40` (manteaux et vestes isolées), `6110.30` (chandails polaires), `9404.30` (sacs de couchage). Ces règles restent dans le moteur pour les futurs produits.

### 16.4 Les 16 produits à arbitrer manuellement

Tous sont des **produits actifs** (`active: true`) rattachés à des **boutiques désormais inactives** (TSURU Couteaux / JSB) — ils comptent donc dans les 472, mais ne sont plus expédiés. *Décision prise : laissés sans code SH pour l'instant.*

| SKU | Nom | Prix | Hypothèse |
|---|---|---|---|
| `aosagi_moyenne` | Aosagi - Moyenne | 155 $ | Série à noms d'oiseaux japonais (aosagi = héron) |
| `aosagi_petite` | Aosagi - Petite | 135 $ | |
| `fukuro_moyenne` | Fukuro - Moyenne | 195 $ | (fukuro = hibou) |
| `fukuro_petite` | Fukuro - Petite | 175 $ | |
| `hakucho_moyenne` | Hakucho | 155 $ | (hakucho = cygne) |
| `hayabusa_moyenne` | Hayabusa - Moyenne | 155 $ | (hayabusa = faucon pèlerin) |
| `hayabusa_petite` | Hayabusa - Petite | 135 $ | |
| `kiji_moyenne` | Kiji - Moyenne | 155 $ | (kiji = faisan) |
| `kiji_petite` | Kiji - Petite | 135 $ | |
| `kitsutsuki_moyenne` | Kitsutsuki - Moyenne | 155 $ | (kitsutsuki = pic-bois) |
| `kuroi_petite` | Kitsutsuki kuroi - Petite | 135 $ | *kuroi* = noir (couleur, pas un oiseau) |
| `shiroi_petite` | Kitsutsuki shiroi - Petite | 135 $ | *shiroi* = blanc (couleur) |
| `suzume_moyenne` | Suzume | 135 $ | (suzume = moineau) |
| `taka_moyenne` | Taka - Moyenne | 195 $ | (taka = faucon) |
| `taka_petite` | Taka - Petite | 175 $ | |
| `washi_moyenne` | Washi | 135 $ | (washi = aigle) |

→ Si ce sont des **couteaux TSURU** : `8211.92`. Si ce sont des **tirages photographiques** : `4911.91`. Une confirmation d'une seule fiche produit tranche les 16 d'un coup.

### 16.5 Comment appliquer

Trois voies, par ordre de sécurité décroissante :

1. **Import CSV produits** (`Products → Import`) — la voie officielle, réversible, avec prévisualisation. Colonnes requises : `SKU`, `Customs Description`, `Customs Tariff No`, `Customs Value`, `Customs Country`.
2. **Écriture directe via l'API interne** depuis la session navigateur — rapide (403 produits en quelques minutes), mais sans prévisualisation ni annulation groupée.
3. **Source amont Shopify** — activer « Import harmonization codes » dans les paramètres de la boutique et renseigner les codes SH dans Shopify (*Paramètres → Marchés → Droits et taxes*). C'est la **bonne architecture à long terme** : Shopify devient la source de vérité, ShipStation (ou son remplaçant) hérite.

> **Recommandation.** Faire (3) pour les produits Lasclay actifs — le code SH appartient à la fiche produit, pas à l'outil d'expédition — et (1) pour le rattrapage historique. L'alternative maison doit alors **lire le code SH depuis Shopify** et le rendre obligatoire avant toute étiquette internationale (exigences **OBS8** et **F1**).

---

## 17. Plan de transition sans rupture

### Phase 0 — Geler la référence
Ce document constitue l'état de référence au 31/07/2026 **pour la structure**. Pour les **données brutes** (les 27 vues avec leur `configData` doublement encodé, les 11 règles, les 472 produits, les 94 services…), exécuter le script de l'**Annexe C** dans la console du navigateur : il produit un fichier `shipstation-dump-{date}.json` contenant la réponse intégrale de tous les endpoints du § 14. **Ce fichier est indispensable à la Phase 3** — le § 12.5 n'en est qu'une transcription lisible, pas une source réimportable.

### Phase 1 — Reconstruire le socle de données
Ordre de dépendance :
1. `ShipFromLocation` (5) → 2. `Carrier` + `Service` (8 / 94) → 3. `PackageType` (51) → 4. `Store` (4 actives) → 5. `Tag` (6) → 6. `Preset` (17) → 7. `ProductProfile` (4) → 8. `Product` (472) → 9. `Customer` (37 686) → 10. `Order` / `Shipment` / `Fulfillment` (14 406 fulfillments, ~54 retours)

Conserver **les identifiants ShipStation d'origine** dans un champ `legacy_id` sur chaque entité : c'est ce qui permet de rejouer les règles et les vues sans réécriture, et de comparer les deux systèmes pendant la période de double roulement.

### Phase 2 — Moteur de règles
Implémenter les 56 types d'action (§ 12.2) — au minimum les **7 réellement utilisés** par Lasclay : `Confirmation` (5), `SetCustomField1` (30), `SetCustomField2` (31), `SetCustomField3` (32), `Warehouse` (10), `ShippingService` (2), `Email` (12). Ajouter `Stop` (11) dès la v1 : aucune règle Lasclay ne l'utilise aujourd'hui, mais c'est la primitive qui rend le chaînage de règles maîtrisable.
Implémenter le modèle de filtre à 6 familles (§ 12.3) **en corrigeant d'emblée la sémantique multi-articles** (exigence **D1**, § 15.2 bloc D) : chaque critère d'article doit déclarer explicitement s'il porte sur *au moins un article*, *tous les articles* ou *uniquement ces articles*.
Charger les 11 règles de Lasclay et les rejouer sur un échantillon de 500 commandes historiques : le résultat doit être **identique champ pour champ** à celui de ShipStation. C'est le test d'acceptation de la phase.

### Phase 3 — Vues et grille
Charger les 27 vues sauvegardées (§ 12.5) et les configurations de colonnes (§ 14.4).
Ajouter ce que ShipStation n'a pas : opérateurs booléens imbriqués (ET/OU), partage de vue au niveau équipe, date d'expiration pour les vues de campagne, export CSV/API de toute vue.

### Phase 4 — Double roulement (2 à 4 semaines)
Les deux systèmes importent en parallèle depuis Shopify/Etsy/Faire. ShipStation reste seul à acheter des étiquettes. Un rapport de divergence quotidien compare, commande par commande : présence, statut, Ship From, service, colis, confirmation, champs personnalisés, étiquettes. **Objectif : zéro divergence non expliquée pendant 5 jours ouvrables consécutifs.**

### Phase 5 — Bascule de l'achat d'étiquettes
Basculer **par canal**, pas d'un coup : commencer par `Manual Orders` (5 commandes), puis `LAS Etsy` (1), puis `LAS Shopify` (406). Conserver la capacité de revenir à ShipStation tant que l'abonnement court.

### Phase 6 — Sortie
Exporter l'historique complet (commandes, expéditions, fulfillments, retours, clients) avant résiliation. Vérifier que les numéros de suivi restent résolvables et que les pages de suivi client ne cassent pas.

### Points de vigilance spécifiques à Lasclay

| Sujet | Risque | Action |
|---|---|---|
| Compte Canada Post propre (`LASCLAY`, sellerLabelProviderId 556760) | Rupture de facturation / de tarifs négociés | Rebrancher le compte transporteur **avant** la bascule, tester un achat réel |
| Champ personnalisé 3 = centre de coût `LASCLAY` | Rupture de la réconciliation de facturation Postes Canada | Répliquer à l'identique, y compris la casse |
| Valeur `DDD ` avec espace final | Filtres qui ne matchent plus | Normaliser **et** conserver un alias legacy |
| Libellés de canal en texte libre (`Entrepôt Lasclay`, `Défricheuses`) | Dépendance à l'orthographe Shopify | Créer un enum + table de correspondance, avec alerte sur libellé inconnu |
| Assurance XCover automatique | Coût invisible reconduit par défaut | Décider explicitement de la politique avant la bascule |
| Boutique FAIRE en échec depuis le 27/05/2026 | Commandes Faire potentiellement perdues | Diagnostiquer côté Faire avant migration ; ne pas reproduire le silence de ShipStation |
| Marge d'expédition négative (−703 $ en juillet) | Se reproduit à l'identique si on ne change rien | Intégrer l'alerte de marge (exigence D9) dès la v1 |
| Codes SH manquants sur 403 produits | Blocages douaniers, pénalités | Traiter avant la bascule (§ 16) |

---

## 18. Récapitulatif des exigences prioritaires pour l'alternative

**Les cinq qui font la différence :**

1. **Synchronisation vivante** (B1-B5) — la commande reste synchronisée avec la boutique après l'import. C'est le défaut architectural n°1 de ShipStation et le plus gros gain possible.
2. **Règles au niveau ligne de commande** (**D1-D2**) — avec simulation à sec. C'est la demande la plus ancienne jamais satisfaite par ShipStation.
3. **Diagnostic d'intégration réel** (**C6**, constat OBS2) — jamais de « No error details are currently available ».
4. **Densité et vitesse** (C1-C3) — grille compacte, achat d'étiquette non bloquant, tout au clavier.
5. **Douanes de premier ordre** (F1-F3, D8) — code SH obligatoire hérité du produit, valeur douanière complète, DDP/DAP par règle.

**Les cinq à ne pas oublier :**

6. Coût total réel affiché avant achat + alerte de marge (**A3**, constat OBS9).
7. Impression navigateur native, sans agent local obligatoire (constat OBS4, **E1-E3**).
8. Webhooks à charge utile complète, signés, redélivrables (G1-G3).
9. Canal logistique modélisé comme enum, pas comme texte libre (constat OBS6).
10. Objet « campagne » pour les vues temporaires (constat OBS7).

---

## Annexe A — Inventaire des captures d'écran de référence

Écrans capturés pendant la session (non joints à ce fichier — ils illustrent, ils ne spécifient pas ; tout leur contenu utile est retranscrit dans les sections correspondantes) : grille Orders / Awaiting Shipment · détail de commande (3 hauteurs de défilement) · Settings Quick Links · arborescence Settings (12 sections dépliées) · Store Setup · Branding Defaults · Automation Rules (actives + inactives) · Shipments / Shipped · Shipments / Fulfillments · End of Day · Returns · Products · Customers · Scan · Rate Browser · Analytics / Shipments Overview · Automations Overview · Service Mappings · General Store Settings · Modify Marketplace Settings (2 hauteurs) · panneau de rafraîchissement des boutiques · modale Store Error · Order Alerts · Manage Columns · Bulk Update (2 hauteurs) · Other Actions · New Order · Advanced Search.

## Annexe B — Questions ouvertes à trancher avant de coder

Ce document décrit fidèlement ce qui a été observé. Les points suivants **n'ont pas pu être capturés depuis l'interface** et doivent être fournis à Claude Code avant le démarrage :

### B.1 Bloquants techniques

| # | Question | Pourquoi c'est bloquant |
|---|---|---|
| Q1 | **Achat d'étiquette** : contrat Canada Post (`sellerLabelProviderId 556760`, compte « LASCLAY »), identifiants API, tarifs négociés, mode de financement de l'affranchissement (`EnableProviderWallet = true` vs facturation sur compte propre) | Sans cela, l'alternative ne peut acheter aucune étiquette. Le § 8 décrit le Rate Browser comme une UI, pas comme un moteur de tarification. |
| Q2 | **Format d'étiquette** attendu par l'entrepôt : PDF 4×6 ? **ZPL** ? Modèle exact d'imprimante ? | Détermine toute la chaîne d'impression (exigences E1-E3). Indice : `UsbScale = false` et ShipStation Connect non installé → **on ne sait pas comment l'équipe pèse et imprime aujourd'hui.** |
| Q3 | **Intégrations amont** : version de l'API Shopify, scopes, usage de `fulfillmentOrders` vs `fulfillments`, locations ; API Etsy ; API Faire | C'est là que se joue l'exigence phare **B1-B4**. |
| Q4 | **Contenu des gabarits** : modèles de courriel `1`, `2`, `5770` (DDD), `6054` (Lucie Veilleux) et bon de préparation `LAS Template (2034)` — HTML, variables, déclencheurs | Les règles 11 et 12 envoient ces courriels à des **partenaires externes** ; un identifiant numérique ne suffit pas à les reconstruire. |
| Q5 | **Mappings de service complets** : le `serviceId` derrière chaque ligne (§ 13.6 n'a capturé que le transporteur), et les tables des boutiques Etsy et Faire | Sans le service précis, le mapping n'est pas reproductible. |

### B.2 Cadrage produit

| # | Question |
|---|---|
| Q6 | **Volumétrie** : nombre total de commandes historiques à migrer, profondeur de rétention, volume de pointe journalier, saisonnalité (Noël, campagnes semences). *Écart non expliqué : le forfait autorise 2 000 expéditions/mois, juillet 2026 en compte 41.* |
| Q7 | **Utilisateurs et rôles** : combien de comptes (limite 10), quels rôles, que voit un préposé d'entrepôt vs l'admin ? Les 27 vues appartiennent toutes à `admin@lasclay.com` — quel modèle de propriété et de partage ? |
| Q8 | **Langue de l'interface** : le compte est en `en-CA`/`en` alors que toute l'opération est en français. À trancher avant de commencer l'UI. |
| Q9 | **Périmètre de l'inventaire** : allocation, `Allocation Status`, Purchase Orders, Suppliers, Transfer Orders — dans la v1 ou hors périmètre ? Le § 5.5 constate qu'ils ne sont pas exploités aujourd'hui. |
| Q10 | **Stack, hébergement, budget, échéance, comportement hors-ligne, conformité** (Loi 25 / PIPEDA sur 37 686 clients). |
| Q11 | **Jeu de données de test** : la Phase 2 exige un rejeu sur « 500 commandes historiques » — lesquelles, et où ? |

---

## Annexe C — Script d'export JSON complet

À coller dans la console du navigateur, **connecté à ShipStation sur `ship15.shipstation.com`**. Produit un fichier unique contenant la réponse intégrale de tous les endpoints, à joindre à la session Claude Code.

```js
(async () => {
  const GET = [
    '/api/seller', '/api/seller/settings', '/api/user/current', '/api/user/setting',
    '/api/account/planInfo',
    '/api/seller/stores', '/api/seller/shipfrom', '/api/seller/packagetypes',
    '/api/seller/services', '/api/seller/labelproviders', '/api/provider/seller',
    '/api/carrier', '/api/carrier/seller/carrierIds', '/api/reference/service',
    '/api/service/classifications',
    '/api/presets', '/api/packageset', '/api/serviceCollection',
    '/api/automationRule/rules', '/api/automationRule/getRuleActionTypes',
    '/api/orderfilterset', '/api/gridconfig',
    '/api/tag', '/api/packingslip',
    '/api/emailtemplate/shipment', '/api/emailtemplate/delivery',
    '/api/return/reasons', '/api/product/profiles', '/api/productCategory',
    '/api/inventoryWarehouses', '/api/inventoryLocations', '/api/totes',
    '/api/label/batch/labelBatches', '/api/iors', '/api/taxIdentifiers',
    '/api/seller/fulfillmentproviders', '/api/seller/fulfillmentservices',
    '/api/seller/sellerBrands', '/api/seller/workstations'
  ];

  const dump = { capturedAt: new Date().toISOString(), host: location.host, get: {}, post: {} };

  for (const p of GET) {
    try {
      const r = await fetch(p, { credentials: 'include', headers: { Accept: 'application/json' } });
      dump.get[p] = { status: r.status, body: r.ok ? await r.json() : await r.text() };
    } catch (e) { dump.get[p] = { error: String(e) }; }
  }

  // Catalogue produits complet
  try {
    const r = await fetch('/api/productgrid', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ page: { pageNumber: 1, pageSize: 2000 } })
    });
    dump.post['/api/productgrid'] = { status: r.status, body: await r.json() };
  } catch (e) { dump.post['/api/productgrid'] = { error: String(e) }; }

  // Commandes ouvertes (adapter orderStatus / pageSize au besoin)
  for (const st of ['AwaitingShipment', 'AwaitingPayment', 'OnHold', 'Shipped', 'Cancelled']) {
    try {
      const r = await fetch('/api/ordergrid/shipmentmode/simple', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ page: { pageNumber: 1, pageSize: 500 }, orderStatus: st })
      });
      dump.post['/api/ordergrid/' + st] = { status: r.status, body: await r.json() };
    } catch (e) { dump.post['/api/ordergrid/' + st] = { error: String(e) }; }
  }

  // Décodage du double encodage de gridconfig (les 27 vues sauvegardées)
  try {
    const gc = dump.get['/api/gridconfig'].body;
    dump.decodedGridConfigs = gc.map(g => {
      let c = g.configData;
      try { c = JSON.parse(c); if (typeof c === 'string') c = JSON.parse(c); } catch (_) {}
      return { id: g.gridConfigId, type: g.gridConfigTypeId, name: g.gridConfigName,
               owner: g.gridConfigOwnerUsername, config: c };
    });
  } catch (e) { dump.decodedGridConfigs = { error: String(e) }; }

  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'shipstation-dump-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  console.log('Export terminé —', Object.keys(dump.get).length, 'endpoints GET,',
              Object.keys(dump.post).length, 'POST.');
})();
```

> Le fichier contient des données personnelles de clients (noms, adresses, courriels). Le traiter comme confidentiel : ne pas le déposer dans un dépôt public, et le purger après migration.

---

## Annexe D — Correspondance des identifiants clés

```
Seller ................ 5756672  (Lasclay)
Ship From par défaut .. 153232   (LAS Capucins)
Boutique principale ... 198670   (LAS Shopify) — GUID 93980608-de51-43e7-8380-4553fa960626
Transporteur principal. carrierId 11 (Canada Post), labelProvider 11, compte « LASCLAY »
Service par défaut .... 99  (Expedited Parcel — Carbon Neutral)
Colis par défaut ...... 115317 (Polymailer Small) / 3 (Package générique)
Confirmation par défaut 5  (Do Not Safe Drop)
Entrepôt d'inventaire . 145696, emplacement 159994 « (Unspecified) »
Modèle de bon .......... 2  (Default 4" x 6")
```
