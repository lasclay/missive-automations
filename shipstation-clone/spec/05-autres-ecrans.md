# 5. Autres écrans — Shipments, Products, Customers, Insights, Batches, Scan, EOD, Returns

> Extrait de la spec ShipStation — Lasclay. Voir `00-INDEX.md` pour la carte complète.
> Libellés d'UI en anglais (langue source du produit). `[à vérifier]` = non confirmé par une source officielle.

## 5. Autres écrans

### 5.1 Shipments

**Sous‑onglets** : `Shipments`, `Fulfillments`, `Returns`, `Batches`, `End of Day`, `Pickup`.

**Statuts (sidebar gauche)** :
| Statut | Disponibilité |
|---|---|
| `Recent` | les deux |
| `Pending` | **Fulfillments only** |
| `In Transit` | les deux |
| `Delivered` | les deux |
| `Delivery Exception` | les deux |
| `Cancelled` | **Fulfillments only** |
| `Voided` | **Shipments only** |

**Recherche** : Quicksearch (*starts with*, sur Recipient Name / Shipment Number / Order Number) + Advanced Search (*contains* : Ship Date, Carrier, Delivery Status, Tracking Number…).

**Grille** : bouton **`Columns`** (Shipments uniquement — la page Fulfillments a des colonnes **fixes**). Tri par clic sur en‑tête, drag pour réordonner. Nouvelles colonnes ajoutées **à droite**.

**Colonnes Shipments** (dérivées des champs d'export shipment‑level) :
`Shipment #`, `Order #`, `Order Date`, `Ship Date`, `Label Create Date`, `Recipient`, `Ship To City/State/Country/Postal Code/Company/Phone`, `Carrier`, `Service`, `Package`, `Confirmation`, `Tracking Number`, `Weight`, `Weight (Oz)`, `Length`, `Width`, `Height`, `Package Count`, `Declared Value`, `Zone`, `Shipping Cost`, `Carrier Fee`, `Insurance Cost`, `Insured Value`, `Insurance Provider`, `Insurance Purchased Flag`, `Store Name`, `Marketplace Name`, `Batch ID`, `Batch Number`, `User Name`, `Warehouse`, `Order Status`, `Order Source`, `Delivery Date`, `Delivery Message`, `Void Date`, `Void Flag`, `Return Label Flag`, `RMA Number`, `Return Date Received`, `Gift Flag`, `Gift Message`, `Custom Field 1/2/3`, `Marketplace Notified`, `End of Day Form`.

**Filtres Shipments** : filtres « populaires » affichés par défaut — `Store`, `Marketplace`, `Carrier`, `Ship From Location` — avec des filtres supplémentaires sous **`Other`**. `[à vérifier — liste complète des filtres "Other"]`
**Filtres Fulfillments** : `Ship Date`, `Country`, `Provider`, `Marketplace Notification`, `Shipment Notification`.

**Void Labels** — 4 points d'entrée : Print Preview, Shipment Activity Widget (Order Details), Shipments grid, Shipment Details.
Flux : action → **dialogue de confirmation** → **`Continue`** → notification succès/échec → **`Done`**.
Effet : si l'order était *Shipped*, il **repasse en *Awaiting Shipment***. Le shipment part en statut **`Voided`** ; le tracking number s'affiche **barré (strikethrough)**.
⚠ « The *Voided* status designation does not reflect the status of any refunds. »

**Shipment Record Widget** : « The widget in ShipStation that contains the shipment's label details, the Shipment # and status. »

**Reship** (New Layout) : duplication simplifiée d'une étiquette pour une commande déjà expédiée.

### 5.2 Products

**Sidebar « Product Views »** : « The left-hand sidebar section in the Products screen » affichant séparément **records**, **groups**, et **inventory**. Contient aussi **`Reporting Categories`**.

**Products Grid** — colonnes : `Name`, `SKU`, `Alias`, `Tags`, `Active`, `Warehouse Location`, `Category`, `Weight`, `Dimensions`, informations de commande. Colonnes ajoutables via dropdown **`Columns`**, réordonnables par drag, triables par clic.

**Action Menu** — « A menu bar containing buttons that trigger either specific actions on selected products or some other function within the Products tab » : `Categorize`, `Tag`, `Import`, `Export`, `Combine Products`, `Activate/Deactivate` `[à vérifier — liste complète]`.

**Product Details** (clic sur SKU ou double‑clic sur ligne) — onglets :

| Onglet | Champs |
|---|---|
| **General** | `SKU`, `Name`, `Product Type` (Standalone / Parent / Variant), `Active`, `Description`, `Image URL`, `Reporting Category`, `Order Tags`, `UPC`, `Returnable` |
| **Shipping** | `Preset Group`, service domestique par défaut, service international, `Package Type`, `Confirmation`, `Weight`, `Dimensions`, `Warehouse Location`, `Fulfillment SKU` — ⚠ « Defaults apply only to single-item products » |
| **Customs** | `Do Not Create Customs`, `Description`, `Declared Value`, `Harmonization Code`, `Origin Country` |
| **Aliases** (Store Aliases) | `SKU` + dropdown `Store` + bouton **`Add Alias`** ; **`Save Changes`** |
| **Inventory** | niveaux de stock, toggle de suivi, `Reorder Threshold`, `Alternative Locations` |
| **Activity** | journal d'audit du product record |

**Product Types** : `Standalone Product` (défaut), `Parent Products` (non vendable, agrégation reporting), `Variant Products` (vendable, hérite des défauts du parent).

**Product Bundles and Kits** :
1. Products tab → créer/éditer un produit
2. Toggle **`This is a Bundled Product`**
3. Bouton **`+ Add Component`**
4. Rechercher par SKU ou Name + saisir la **quantité**
5. Répéter, puis **Save**
- Checkbox **`Show bundle on packing slip`** (nom du bundle vs articles composants)
- ⚠ Un bundle ne peut pas contenir un autre bundle. Les composants doivent déjà exister dans ShipStation.

**Product Aliases** : « An alias tells ShipStation that different SKUs are actually the same product. »
Import CSV : `Products > Import > Import Product Aliases`. Colonnes : `SKU`, `Alias`, `StoreName` (optionnel, défaut `Any Store`), `Delete` (True/False). Affichage : colonne **`Alias`** dans la grille, survol → nombre d'alias.

**Reporting Categories** : sidebar → **`Add Product Category`** → nom → validation par **coche verte**. Assignation : bulk via bouton **`Categorize`**, ou individuelle via dropdown **`Reporting Category`** dans Product Details. Colonne `Category` dans la grille.

**Combine Products** : fusion de product records redondants.

**Inventory (sous‑onglet Products > Inventory)** : `SKU`, `Product Name`, `Stock`, `Allocated`, `Available`, `Re-Order Threshold`, `Last Cost`, `Avg Cost`, emplacements.

### 5.3 Customers

**Grille** : colonne `Name` (tri alphabétique par toggle), + `Company`, `Ship To address`, `Username`, `Email`, `Tags`, nombre de commandes `[à vérifier — liste complète des colonnes]`.

**Actions** :
1. **Search & Filter** — Quicksearch par nom, filtres, pagination
2. **View History** — clic sur le nom → **popup** avec « history and relevant information »
3. **Create Manual Order** — directement depuis une fiche client
4. **Create Shipment** — sans créer d'order au préalable
5. **Add Tags** — pour filtrage ou déclenchement de règles d'automatisation

**Surviving Customer** : « The active customer record that remains after several similar or redundant customer records have been combined. »

Les fiches clients sont aussi accessibles depuis Orders via la colonne `Recipient Name`.

### 5.4 Insights / Reports

#### Pages d'analyse (dashboards)

**Overview**
- `# of New Orders each Day chart`
- `New Orders Summary` : `New Orders`, `Orders Shipped`, `Orders Unshipped`
- `Shipments By Carrier table`
- `Sales by Store table`
- `Open Order Aging`

**Operations**
- `Shipments chart`
- `Shipment Details Summary` : `Shipments`, `Shipping Revenue`, `Shipping Cost`, `Net Shipping Revenue`, `Avg Cost per Label`
- `Shipment By Carrier table`
- `Shipments by Class table`
- `Current Account Balance`
- `Open Order Aging`
- `Shipments by User`

**Customer Engagement**
- `Store Filter`
- `Shipment Confirmation Emails` : `Sent`, `Delivered`, `Opened`, `Clicked Link`
- `Delivery Notification Emails` : `Sent`, `Delivered`, `Opened`, `Clicked Link`

**Sales Trends**
- `# Items Sold and Revenue graph`
- `Sales Details Summary` : `Sales`, `Sales vs Time Last Year`, `Average Order Value`, `Orders`, `New Customers`, `Returning Customers`
- `Top 5 Products by Revenue table`
- `Sales by Category table`
- `Sales by Store table`

**Customer Overview**
- `Customers Per Day chart`
- `Customer Details Summary` : `New Customers`, `Return Customers`, `New Customers GMV`, `Return Customers GMV`
- `Orders by Region`
- `Sales by Location table`
- `Most Valuable Customers table`

**Product Highlights**
- `Items Sold chart`
- `Product Details Summary` : `Total Products Ordered`, `Unique Products Ordered`, `Product per Order Avg`
- `Sales by Category Quantity table`
- `Sales by Category Revenue table`
- `Top 5 Products by Quantity`
- `Top 5 Products by Revenue table`

#### Reports (« over 20 pre-formatted reports »)

**Orders**
| Rapport | Filtres requis | Filtres optionnels | Colonnes clés |
|---|---|---|---|
| `Order Detail` | Date Range (Start/End) | Store | recipient (name, address, city, state, postal code, country code), date paid, amount paid, order number, store, marketplace, buyer comments, internal notes, item SKU/name/options/unit price/qty/extended price. Option : `Include product images on order details report` |
| `Country Comparison` | Date Range | — | `Sales by Country Graph`, `Items Sold Country Graph` (2 camemberts), country name, 2‑digit country code, items sold, total sales |
| `Buyer Comments` | Date Range | Order Status | marketplace, order number, recipient name, texte complet de la note acheteur |

**Products**
| Rapport | Filtres requis | Optionnels | Colonnes |
|---|---|---|---|
| `Item Demand Summary` | Date Range (Order Date), Group Product By | Order Status, Order Filter | `SKU`, `Item Name`, `# Orders`, `# Items`, `Item Revenue` |
| `Product Sales` | Ordered During (Start/End), Show Products By | Store | `Store Name`, `SKU`, `Description`, `Category`, `Qty Sold`, `Total Sales`, `Qty Sold (Total for Store)`, `Total Sales (Total for Store)` |
| `Returned Products` | Date Range | — | `SKU`, `Product Title`, `Qty Returned`, `Product Cost`, `Return Reason`, `Outbound Shipping`, `Inbound Shipping`, `Sold To` |

**Shipments**
| Rapport | Filtres requis | Optionnels | Colonnes |
|---|---|---|---|
| `Shipment Count by User` | Date Range, Group By | User | Shipment Count Bar Graph, User Legend, Time Period, User Name, User Shipments, Total Per User, Total Per Time Period, Grand Total |
| `Shipped Items` | Shipped During | Store | `Store Name`, `SKU`, `Alias SKU`, `Description`, `Qty Sold`, `Total Sales`, totaux par store |
| `Shipping Cost` | Shipping During | Store, Provider, Shipping Account, Service | `Store Name`, `Ship Date`, `Recipient`, `Order #`, `Provider`, `Service`, `Package`, `Items`, `Zone`, `Shipping Paid`, `Shipping Cost`, `Insurance Cost`, `Weight`, `Difference (+/-)` |
| `Shipping Manifest` | Shipping Date | Provider, Shipping Account, Ship From Location | `Total Packages`, `Total Items`, `Total Weight`, `Total Customs Value`, `Total Cost`, `Recipient`, `Service`, `Weight`, `Cost`, `Tracking #`, `Order #`, `Store`, `Items`, `Item Name`, `Item Quantity`, Service Pie Chart |
| `Batch Detail` | Date Range (Ship Date) | — | `Batch #`, `Batch Notes`, `Created By`, `Processed Date`, `Ship Date`, `Ship From`, `# Labels`, `# Errors` |

**Accounting**
- `Account Balance History`

**Inventory**
| Rapport | Filtres requis | Optionnels | Champs |
|---|---|---|---|
| `Inventory Low Stock Report` | Group Products By Parent SKU | — | `SKU`, `Product Name`, `Stock`, `Allocated`, `Available`, `Re-Order Threshold`, `Shortage` |
| `Inventory Audit Report` | Date Range (Action Date) | SKU | `SKU`, `Product Name`, `Event Date/Time`, `Type`, `Quantity`, `Stock`, `User`, `Description` |
| `Inventory Out of Stock Shipments` | Date Range (Action Date) | SKU | `Tracking #`, `Order #`, `Ship Date`, `User`, `Action`, `SKU`, `Name`, `Qty` |
| `Inventory Status Report` | Group Products By Parent SKU | — | `SKU`, `Product Name`, `Last Cost`, `Avg Cost`, `Stock`, `Allocated`, `Available`, `Re-Order Threshold` |

**Hotkey & Barcode Scan Actions**
- `Hotkey Reference Sheet`
- `Barcode Scan Action Quick Reference Sheet`
- `Barcode Scan Action Report`

**Raw Data Exports**
- `Customers`
- `Shipped Items`
- `Orders`
- `Shipped Orders`
- `Product Aliases`

**Custom Reports**
- `Custom Order Reports` — sélection de champs au niveau **order** ou **item**
- `Custom Shipment Reports` — sélection de champs au niveau **shipment** ou **shipment item**

**Static Reports** : exports CSV depuis Shipments (Fulfillments, Returns) et Products (Products, Inventory).
**Data Archives** : archives mensuelles compilées d'orders, shipments et shipment items.

Disponibilité selon plan (Free / Starter / Standard / Premium).

#### Champs disponibles pour Custom Order Reports / Export Orders

**Order‑level** :
```
Amount - Order Shipping        Date - Order Date            Order - CustomerID
Amount - Order Subtotal        Date - Paid Date             Order - Number
Amount - Order Tax             Date - Shipped Date          Order - Pay Method
Amount - Order Total           Dimensions - Height          Order - Status
Amount - Paid by Customer      Dimensions - Length          Service - Confirmation Type
Amount - Shipping Cost         Dimensions - Width           Service - Package Type
Amount - Ship Rate Quoted      Gift - Flag                  Ship To - Address 1/2/3
Bill To - Name                 Gift - Message               Ship To - City
Carrier - Carrier Selected     Insurance - Cost             Ship To - Company
Carrier - Service Requested    Insurance - Insured Value    Ship To - Country
Carrier - Service Selected     Insurance - Provider         Ship To - Name
Count - Number of Items        Market - Market Order URL    Ship To - Phone
Count - Number of Shipments    Market - Marketplace Name    Ship To - Postal Code
Customer Email                 Market - Store Name          Ship To - Residential Flag
Custom - Field 1/2/3           Notes - From Buyer           Ship To - State
Customs - Package Contents     Notes - Internal             Ship To - Verified Flag
Date - Hold Until              Notes - To Buyer             Ship To - Zone
                                                            Source, Tags, Username
                                                            Weight, Weight - TotalOz,
                                                            Weight - WeightLbs, Weight - WeightOz
```

**Item‑level** (tous les champs order‑level +) :
```
Item - Category        Item - Location             Item - SKU
Item - Cost            Item - Name                 Item - UPC
Item - Cost Extended   Item - Options              Item - Weight
Item - Fill SKU        Item - Origin Country Code  Item - Weight (oz)
Item - Image URL       Item - Qty                  Date - Ship By Date
Item - ISBN
```

#### Champs Custom Shipment Reports (shipment‑level)
```
Amount - Order Shipping/Subtotal/Tax/Total    Insurance - Cost/Insured Value/Provider/Purchased Flag
Amount - Shipping Cost                        Market - Marketplace Name / Store Name
Bill To - Account/Country/Party/Postal Code   Operations - Batch ID/Batch Number/User Name/Warehouse
Carrier - Fee/Name/Service Selected           Order - Number/Source/Status
Count - Number of Line Items                  Return - Date Received/Return Label Flag/RMA Number
Customer - Email                              Service - Confirmation Type/Package Type
Custom - Field 1/2/3                          Shipment - Carrier/Declared Value/Height/Length/
Date - Label Create Date/Order Date/                     Weight/Width/Package Count/Package Type/
       Shipped Date                                      Tracking Number/Void Date/Void Flag/
Delivery - Date/Message                                  Weight (Oz)/Zone
Gift - Flag/Message                           Ship To - (Address 1-3, City, Company, Country,
                                                        Name, Phone, Postal Code, Residential
                                                        Flag, State, Verified Flag)
                                              Sum - Total of Line Items
```

### 5.5 Batches

**Statuts** : `Open`, `Processed`, `Archived`. Les batches archivés sont dans une **section dédiée**.

**Actions principales** :
- **Processing a batch** — génération et impression des étiquettes pour les shipments choisis (hotkey `P + B`)
- Impression de documents complémentaires (packing slips…)
- **`Add a note`** au batch entier
- **Réassigner** le batch à un autre utilisateur
- **`Cancel Batch`** — « will remove all orders from the batch then delete the batch »

**Bulk Update menu** (dans un batch) : `Service`, `Package`, `Weight`, `Size`, `Ship From`, `Insurance`, `Confirmation`, `Marketplace Notification`, `Packing Slip and Email Template`, `Customs Declarations`, `Shipping Account`.

**Other Actions menu** : retirer des shipments, transférer le batch, envoyer les notifications, exporter le batch.

**Contrôle d'accès** : « Most batch actions, including updating shipping options and creating and printing labels, can only be taken by the user assigned to the batch. » Les autres utilisateurs ont un **accès lecture seule**, avec possibilité d'assigner le batch à quelqu'un d'autre ou d'ajouter une note.

**Batches archivés** : immuables, impression de documents impossible ; les shipments individuels restent accessibles pour réimpression ou annulation.

New Layout : **batches illimités**, **noms personnalisés**, **visibilité inter‑utilisateurs**.

Hotkey `B` = Create new batch.

### 5.6 Scan (Scan to Print / Scan to Verify)

Accès : onglet **Scan** → menu **Workflow**.

#### Scan to Print
- Dropdown **Printer** (requis)
- Dropdown **Scale** (optionnel)
- Toggle **`Use Scale`** — bascule entre poids USB et poids préconfiguré
- Flux : scanner le code‑barres du packing slip → ouverture du détail de commande → **`Print Label`** ou hotkey **`P`** → retour immédiat en attente de scan
- Champs : `Weight from Scale` (auto), affichage du **rate** basé sur le poids, configuration du shipment

#### Scan to Verify
- Champ **`Find Shipment`** (scan code‑barres ou saisie du n° de commande)
- 3 méthodes de vérification par article : scanner le code‑barres produit, cliquer **`Verify`**, ou cliquer **`Verify All`**
- Bouton **`Mark as Verified`**
- Compteurs de vérification par article, retours audio/visuels
- Statut **`Verified`** affiché dans l'en‑tête de la commande
- Champ de correspondance configurable dans Workflow Settings : `UPC` / `Item SKU` / `Fulfillment SKU`

#### Scan to Verify & Print
- Dropdown **Label printer** (requis) + **Scale** (optionnel)
- Bouton **`Edit Verification`** (corrections)
- Lien **`Print Barcode Sheet`**
- Flux : scan packing slip → vérification → **`Mark as Verified`** ou **`V`** → configurer le shipment (CSW) → **`Print Label`** ou **`P`**
- Option **`Reprint Label`** pour les commandes déjà imprimées

**Barcode Listening** (Legacy) : « A mode wherein a barcode scanner actively 'listens' or looks to accept barcode scans. » Hotkey `Ctrl + Shift + S` / `Cmd + Shift + S`.

### 5.7 End of Day / Manifests / SCAN forms

**End of Day** : « The process in ShipStation that manifests your day's shipments for a specific carrier. » Aussi appelé **End of Day form**, **SCAN form** (USPS), **manifest**.

- Accès : `Shipments > End of Day` (hotkey `G + E`)
- Colonne **`End of Day Form`** dans la grille Shipments (aussi disponible comme filtre)
- Le processus « clôture » les shipments du jour pour un carrier donné
- **PLD (Package Level Detail)** : « The shipping and package data about the shipments processed since your last End of Day process »
- Option Document : `List items for each order in the shipment manifest`
- Rapport associé : `Shipping Manifest`
- Disponible aussi sur **ShipStation Mobile**

`[à vérifier]` : la documentation publique ne détaille pas les colonnes exactes ni les boutons de l'écran End of Day. Prévoir a minima : liste des formulaires générés (date, carrier, ship from location, nombre de colis), bouton **Create End of Day Form** / **Generate**, et actions **Print** / **Reprint** / **View**.

### 5.8 Returns & Exchanges

**Returns tab** : `Shipments > Returns`.

**3 méthodes de retour** :
1. **Returns Portal** (Branded Returns Portal) — self‑service client, téléchargement immédiat de l'étiquette
2. **Imported Returns** — retours récupérés depuis les canaux supportés
3. **Manual Returns** — création d'étiquette individuelle, avec ou sans order existant

**Grille Returns** : réimpression d'étiquettes, **`Mark as Received`**, statut du retour, détails. Cycle de vie complet des RMA.

**Contraintes** : carrier actif supportant les étiquettes retour ; **shipment domestique uniquement** (retours internationaux non supportés). Les comptes Shopify supportent en plus les **échanges d'articles**.

**Facturation** : étiquettes prépayées facturées à la création ; carriers facturés (UPS/FedEx) en **pay‑on‑use** (facturé seulement au scan dans le mail stream).

**Branded Returns Portal — réglages store (onglet Returns)** :
1. `Return Exceptions` — « Allow customers to create return labels within [dropdown N] days or order ship date »
2. `Return Service & Package Type` — dropdowns
3. `Branded Returns Portal URL` — lien public
4. `Return Policy Message` — 500 caractères max (affiché sur tracking page + portail)
5. `Return Email Message` — 2 000 caractères max, HTML supporté

**Écrans du portail client** :
| Écran | Contenu |
|---|---|
| **Initial Lookup** | champ `Order number`, champ `Ship-to postal code`, bouton **`Look Up Order`** |
| **Order Details** | liste des articles, dropdown quantité, dropdown **return reason**, bouton **`Submit Request`** |
| **Confirmation** | confirmation d'autorisation + instructions d'impression |
| **Erreur** | message : **« This item is unable to be returned »** |

Réglage produit associé : champ **`Returnable`** dans Product Details > General.

### 5.9 Fulfillments / Dropship

- Sous‑onglet `Shipments > Fulfillments` (hotkey `G + F`)
- Statuts : `Recent`, `Pending`, `In Transit`, `Delivered`, `Delivery Exception`, `Cancelled`
- Colonnes **fixes** (pas de bouton Columns)
- Filtres : `Ship Date`, `Country`, `Provider`, `Marketplace Notification`, `Shipment Notification`
- Action d'automatisation associée : `Set Fulfillment Provider…`
- **Dropship Manager** et add‑ons **3PL** disponibles (New Layout)
- Statut order associé : **`Pending Fulfillment`**
- Webhooks : `FULFILLMENT_SHIPPED`, `FULFILLMENT_REJECTED` (+ V2)

### 5.10 Pickup

Sous‑onglet `Shipments > Pickup` (hotkey `G + K`) — planification d'enlèvements carrier. `[à vérifier — UI détaillée non documentée publiquement]`

---
