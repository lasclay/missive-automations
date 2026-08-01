# 2. Écran Orders — le cœur du produit

> Extrait de la spec ShipStation — Lasclay. Voir `00-INDEX.md` pour la carte complète.
> Libellés d'UI en anglais (langue source du produit). `[à vérifier]` = non confirmé par une source officielle.

## 2. Écran Orders (le cœur du produit)

### 2.1 Layout général de l'écran

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HEADER (nav, quicksearch, update, alerts, profile, settings)            │
├───────────────┬──────────────────────────────────────┬───────────────────┤
│ SIDEBAR       │  ONGLETS CUSTOM VIEWS  [+ Click to Save]                 │
│ (statuts)     ├──────────────────────────────────────┤  SHIPPING         │
│               │  FILTER BAR (filtres actifs)          │  SIDEBAR          │
│ Awaiting      ├──────────────────────────────────────┤  (Configure       │
│  Payment      │  ACTION BAR (bulk actions)  [Columns] │   Shipment        │
│ On Hold       ├──────────────────────────────────────┤   Widget)         │
│ Awaiting      │                                       │                   │
│  Shipment  ▸  │        ORDERS GRID                    │  + Order Summary  │
│ Pending       │        (lignes = orders)              │  + Notes          │
│  Fulfillment  │        (expand = line items)          │  + Tags           │
│ Shipped       │                                       │                   │
│ Cancelled     │                                       │  [Create + Print  │
│ ─────────     │                                       │   Label  $X.XX]   │
│ Saved Filters │  PAGINATION / compteur                │                   │
└───────────────┴──────────────────────────────────────┴───────────────────┘
```

### 2.2 Statuts / onglets (sidebar gauche)

Statuts officiels de la sidebar Orders :

| Statut | Sémantique |
|---|---|
| **Awaiting Payment** | Commande importée, paiement non confirmé par le canal |
| **On Hold** | Mise en attente manuelle ou par règle (`Hold Until…`) |
| **Awaiting Shipment** | **Vue par défaut** — commandes prêtes à expédier |
| **Pending Fulfillment** | Envoyée à un fulfillment provider (3PL/dropship), en attente de confirmation |
| **Shipped** | Étiquette créée ou marqué expédié |
| **Cancelled** | Annulée sur le canal ou dans ShipStation |

Sous la liste des statuts : section **Saved Filters** (filtres enregistrés, partagés à tous les utilisateurs du compte).

> **`Rate Expired`** : n'est pas un statut de la sidebar Orders. C'est un **état d'un tarif obtenu** (le tarif affiché a expiré et doit être recalculé) affiché dans le CSW / Rate Browser. `[à vérifier]` — traiter comme un état transitoire du widget d'expédition, pas comme un onglet.

Chaque statut affiche un **compteur** de commandes. Les Custom Views apparaissent en **onglets au‑dessus de la grille** (New Layout) avec leur propre compteur.

### 2.3 Grille de commandes (Orders Grid)

#### 2.3.1 Colonnes disponibles

Colonnes confirmées comme triables/affichables :

**Identité & dates**
- `Order #`
- `Order Date`
- `Age` (Order Age = "length of time that has passed between the order paid date and the date the label was created")
- `Paid Date`
- `Ship By Date`
- `Hold Until Date`
- `Ship Date`

**Destinataire**
- `Recipient Name`
- `Buyer Name`
- `Company Name`
- `Buyer Email Address`
- `Username`
- `Recipient Address Line 1`
- `Recipient City`
- `Recipient State`
- `Postal Code`
- `Country`

**Articles**
- `Item SKU`
- `Item Name`
- `# Line Items`
- `Total Quantity`
- `Warehouse Location`

**Origine**
- `Store`
- `Marketplace` / `Source`

**Expédition**
- `Requested Service`
- `Carrier` / `Provider`
- `Service`
- `Package`
- `Confirmation`
- `Weight`
- `Ship From`
- `Shipping Account`
- `Rate`
- `Tracking Number`
- `Insurance` / `Insurance Fee`
- `Carrier Fee`

**Financier**
- `Amount Paid`
- `Order Total`
- `Order Subtotal`
- `Shipping Paid`
- `Tax Paid`

**Process / suivi documentaire** (New Layout — "Document Print Tracking")
- `Packing Slip Printed`
- `Label Created`
- `Label Printed`
- `Marketplace Notified`
- `Scan to Verify`
- `End of Day Form`
- `Batch`
- `Assigned To`
- `Tags`
- `Custom Field 1` / `Custom Field 2` / `Custom Field 3`
- `Shipment #`

#### 2.3.2 Comportements de grille

- **Manage Columns** : bouton `Columns` en haut à droite → dialogue **Manage Columns**, toggles de visibilité par colonne. Nombre de colonnes **illimité** par vue.
- **Réordonner** : drag & drop des en‑têtes de colonnes.
- **Tri** : clic sur l'en‑tête → asc/desc (indicateur chevron).
- **Pin Column** : épingler **jusqu'à 2 colonnes** qui restent visibles pendant le scroll horizontal (New Layout uniquement).
- **Redimensionnement** : poignée de drag entre en‑têtes `[à vérifier — comportement standard de datagrid]`.
- **Sauvegarde automatique** : "Automatic saving of column changes within each view" — les changements de colonnes sont persistés par vue.
- **Multi‑item Order View** (New Layout) : chevron d'expansion sur la ligne → affiche **toutes les line items** dans la grille sans ouvrir Order Details.
- **Sélection** : checkbox par ligne + checkbox « tout sélectionner » en en‑tête. `Shift + Click` = sélection d'une plage de lignes. `Ctrl + Click` = toggle d'une ligne.
- **Navigation clavier** : flèches ▼▲►◄ pour parcourir les lignes.
- **Double‑clic** sur une ligne → ouvre **Order Details**.

#### 2.3.3 Group By

Sur **Awaiting Shipment**, une fonction **Group By** organise les commandes par :
`Store`, `Line Items`, `Quantity`, `Country`, `Item Name`, `SKU`, `Service Type`.

New Layout : **groupement par plusieurs attributs simultanément**.

#### 2.3.4 Recherche

Deux modes :

| Mode | Comportement | Portée | Fenêtre temporelle |
|---|---|---|---|
| **Quicksearch** | *starts with* | order #, names, emails, addresses, items, SKUs, tracking numbers | 2 ans |
| **Advanced Search** | *contains* | `Order Status`, `Store`, `Order #`, `Recipient Name`, `Recipient Email`, `Item Name`, `Item SKU`, `Item Option (Value)`, `Order Date` | 3 derniers mois par défaut, réglable jusqu'à la création du compte |

### 2.4 Panneau de filtres (Filter Bar)

Définition officielle : "A menu bar containing all filter selections for a specific screen."

**Liste exhaustive des critères de filtre Orders** (ordre alphabétique, tel que documenté) :

```
Amount Paid            Insurance                Recipient
Assigned To            Insurance Fee            Scan to Verify
Batch                  Label Created            Service
Carrier                Label Printed            Ship Date
Carrier Fee            Marketplace Notified     Ship From
City                   Order #                  Shipment #
Company                Order Date               Shipment Notification
Confirmation           Package                  Shipping Account
Country                Packing Slip Printed     Shipping Paid
Created Date           Paid Date                Source
Customs Forms          Postal Code              State
Delivery Notification  Provider                 Store
End of Day Form        Quantity                 Tax Paid
Forms                  Rate                     Tracking #
                       Rate Shopper             Weight
```

**Contraintes** :
- "All filter fields have a character limit of 2,000."
- Bouton **`Clear Filters`** pour réinitialiser.
- Un aperçu du **compteur de commandes correspondantes** est généré automatiquement au fur et à mesure de l'application des filtres.
- Filtres ajoutables/retirables individuellement.

### 2.5 Saved Filters et Custom Views

Deux mécanismes distincts :

**Saved Filters** — jeux de filtres enregistrés, listés sous le menu **Saved Filters** dans la sidebar de l'onglet Orders. Accessibles à **tous** les utilisateurs du compte.

**Custom Views** — "a saved collection of filters, columns, and column sequences".

Flux de création :
1. Onglet **Orders**
2. Appliquer les filtres dans la Filter Bar (aperçu du compteur en direct)
3. Bouton **`Columns`** (haut droite) → **Manage Columns** → toggles
4. Drag & drop pour l'ordre des colonnes
5. Cliquer **`Click to Save`** sur l'onglet de vue personnalisée → popup → saisir un nom → confirmer

Gestion :
- Renommer : survol du titre → **icône crayon**
- Supprimer : **`Delete this View`** en mode édition
- **Vues illimitées** (New Layout) / **5 max** (Legacy)
- Visibles par tous les utilisateurs du compte
- Modifier les filtres d'une vue crée une **nouvelle** vue plutôt que d'écraser l'existante

### 2.6 Panneau latéral de détail (Shipping Sidebar)

Panneau de droite, affiché quand une (ou plusieurs) commande(s) est sélectionnée. **Les sections sont réordonnables par drag & drop** ("Drag and drop the shipping sidebar sections into any sequence").

Sections :

1. **Order Summary / Order Details** — n° de commande, store, date, client, statut d'adresse (icône de validation)
2. **Ship To** — adresse destinataire + icône de validation d'adresse
3. **Items** — line items ; quand plusieurs commandes sont sélectionnées, un **gear icon** permet de grouper l'affichage par **`Orders`** ou par **`Items`**
4. **Configure Shipment Widget** (voir §2.9)
5. **Notes** — Note From Buyer / Note To Buyer / Gift Note / Internal Note + **icône épingle** pour mettre une note en évidence
6. **Tags** — tags colorés
7. **Customer Communication** — sélecteurs de templates
8. **Shipment Activity** — journal d'activité (lecture seule)

Boutons d'action en bas : **`Create + Print Label`** (ou **`Create Label`** selon Workflow Settings) affichant **le tarif** ; icône **QuickShip** à côté.

### 2.7 Actions en masse (bulk actions / Action Bar)

Barre d'actions au‑dessus de la grille, activée dès qu'une ou plusieurs lignes sont cochées. Actions confirmées :

**Boutons directs**
- `Get Rate`
- `Print` → sous‑menu : `Label`, `Packing Slip`, `Pick List`, `Order Summary`, `Customs Forms`, `Label with Packing Slip`
- `Assign To` (utilisateur)
- `Tag` → sous‑menu : liste des tags + **`Manage Tags`**
- `Apply Preset` → liste des shipping presets + **`Manage Presets`**
- `Create Label` / `Create + Print Label`

**Menu `Other Actions`** (dropdown) :
- `Mark as Shipped` (hotkey `M+S`)
- `Mark as Shipped Bulk` (hotkey `M+B`)
- `Combine Shipments`
- `Show Split Ship Actions`
- `Import Orders` (CSV)
- `Export Orders`
- `Hold` / `Hold Until…`
- `Restore to Awaiting Shipment` (depuis On Hold / Cancelled)
- `Cancel Order`
- `Delete Order`
- `Reprocess Automation Rules`
- `Manage Presets`
- `Add to Batch` / `Create Batch`
- `Reship` (New Layout — duplication d'une étiquette pour une commande déjà expédiée)
- `Print Hotkeys and Barcodes`

> `[à vérifier]` : l'ordre exact et la présence de chaque entrée du menu `Other Actions` varie selon le statut de la sélection et les permissions. Un bug communautaire signale que le bouton `Other Actions` peut être replié derrière un menu « … » sur écrans étroits — prévoir un **overflow menu responsive**.

**Bulk Update** (disponible aussi depuis un Batch) — mise à jour simultanée de :
`Service`, `Package`, `Weight`, `Size`, `Ship From`, `Insurance`, `Confirmation`, `Marketplace Notification`, `Packing Slip and Email Template`, `Customs Declarations`, `Shipping Account`.

### 2.8 Order Details / Edit Order

Ouvert par double‑clic sur une ligne, ou hotkey **`V`**. Écran redessiné dans le New Layout ("Improved Order Details: Redesigned screen for simplified editing and multi-shipment management").

**Onglets de shipment** en haut quand la commande est splittée (`Shipment 1`, `Shipment 2`, …).

#### Section « Ship To Address »
| Champ | Type |
|---|---|
| `Full Name` | texte |
| `Company` | texte |
| `Country` | select |
| `Street Address` (Address Line 1 / 2 / 3) | texte |
| `City` | texte |
| `State` | texte/select |
| `Zip` (Postal Code) | texte |
| `Phone` | texte |
| `Email` | texte |
| `Validate Address` | bouton/action |
| `Residential / Commercial` | toggle `[à vérifier]` |

Option **`Paste Address`** (comptes US uniquement) : parsing d'une adresse collée en bloc.

#### Section « Order Information »
- `This is a Gift` (case à cocher)
- `Cost Summary` (subtotal, shipping, tax, total)
- `Tax Information`
- `Ship by date` (date picker)
- `Hold until date` (date picker)
- `Date Paid`
- `Assigned To` (select utilisateur)
- `Batch` (select)

#### Section « Shipment Items »
Bouton **`Edit`** en haut de section :
- `Add Item` (bouton)
- `SKU`
- `Name`
- `Quantity`
- `Price`
- `Delete Item` (par ligne)
- Lien **`Split Ship`**

#### Section « Notes »
- `Note From Buyer`
- `Note To Buyer`
- `Gift Note`
- `Internal Note`
- `Custom Field 1`, `Custom Field 2`, `Custom Field 3`
- **Pin icon** par note

#### Section « Customer Communication »
- `Packing Slip` (template selector)
- `Shipment Notification` (template selector)
- `Delivery Notification` (template selector)

#### Sections lecture seule
- `Order Summary`
- `Shipment Activity` (log d'activité)

### 2.9 Configure Shipment Widget (CSW)

Le composant central. Présent dans : **Shipping Sidebar** de la grille Orders, **Order Details**, **Shipment Details**, **Scan to Print/Verify & Print**.

Champs, dans l'ordre canonique :

| # | Champ | Type | Détails |
|---|---|---|---|
| 1 | **Ship From** | select | Liste des Ship From Locations ; icône **calculatrice de tarifs** intégrée |
| 2 | **Weight** | numérique (lb/oz ou kg/g) | Bouton **poids** pour lire une balance via ShipStation Connect ; hotkey `W` |
| 3 | **Service** | select | Services activés du compte. **Groupés par carrier** ; icône settings pour trier par carrier ou par compte |
| 4 | **Package** | select | **Groupé par carrier**, les **package types personnalisés apparaissent en premier** |
| 5 | **Dimensions** (Size) | 3 champs L × W × H | Requis pour les services à poids volumétrique (DIM) |
| 6 | **Confirmation** | select | ex. `None`, `Delivery`, `Signature`, `Adult Signature`, `Direct Signature` `[à vérifier — libellés exacts par carrier]` |
| 7 | **Insurance** | select provider + montant | Providers : `ParcelGuard`, `Shipsurance` (Legacy US), `Total Shipping Protection by XCover` (CA/UK/AU/NZ), `Carrier Insurance`, `Other Insurance`. Champ **Insure Amount** : « Enter the full amount you wish to declare. Do not subtract the carrier's default coverage amount. » Chiffres uniquement (pas de `$`, `£`, `€`) |
| 8 | **Ship Date** | date picker | Permet une date d'expédition future |
| 9 | **Other Shipping Options** | section repliable | voir ci‑dessous |
| 10 | **Customs** (international) | sous‑panneau | voir §4.7 |
| 11 | **Requested Service** + lien `unmapped` / `Mapped` | affichage + action | Ouvre la modale de Service Mapping |

**Other Shipping Options** (options carrier) :
- `Saturday Delivery` (UPS / FedEx)
- `Shipper Release` (UPS)
- `Do Not Prepay Postage` (Endicia)
- `Contains Alcohol` (FedEx)
- `Contains Dry Ice` (UPS / FedEx) + `Dry Ice Weight`
- `Non-Machinable`
- `Collect Payment on Delivery (C.O.D.)`
- `Show Postage Paid on the Label` / `Hide Postage`
- `Bill To` / Third‑party billing : `My Account`, `Third Party`, `Recipient` (+ champs `Bill To Account`, `Bill To Country`, `Bill To Postal Code`)
- `Do not notify Marketplace`
- `Block Amazon Logistics`
- `Use Blank Box`
- `Include a Return Label with the Outbound Label`
- `Delivery Notifications` (Royal Mail / Parcelforce)

**Bouton de validation** : le **tarif s'affiche dans le bouton `Create + Print Label`** et « The rate automatically updates as you configure your shipment ».

**Multi‑Package** : "A single shipment that contains multiple packages" avec un tracking number par colis. Quand actif, **le champ `Insured Amount` est désactivé** — l'assurance doit être ajoutée colis par colis.

### 2.10 Rate Browser / Rate Calculator

Trois surfaces distinctes :

**A. Rate Calculator** — « Allows you to enter shipment details (like postal codes, service, and weight) to view and compare available rates. » Hotkey `C`. Accessible depuis la toolbar et depuis l'icône près de `Ship From` dans le CSW.

**B. Rate Browser** (contextualisé à une commande) :
- Liste de **carriers cliquables** à gauche → développe les **services disponibles** pour ce carrier
- « Only shipping services valid for the shipment (based on weight, dimensions, and destination) will appear in the service list »
- Section **`Configure Rates`** : reconfigurer les paramètres d'expédition et voir les écarts de prix en direct
- Package type par défaut : `Package` (type standard)
- Bouton **`Configure Label`** : applique le carrier + service sélectionnés à l'expédition
- Colonnes affichées : service, **rate**, **delivery time** (« Carrier-supplied timing information… varying by format (days or specific dates) ») `[à vérifier — libellés exacts de colonnes]`

**C. Toolbar Rate Browser** — version non contextualisée depuis la barre d'outils.

**Rate Shopper** (add‑on, `Settings > Shipping > Rate Shopper`) — voir §3.6.

### 2.11 Split & Combine

#### Split Orders Into Multiple Shipments

Accès :
- Grille : `Other Actions` > **`Show Split Ship Actions`** → lien **`Split`** apparaît au survol d'une ligne d'article
- Order Details : lien **`Split Ship`**

**Split Ship pop‑up** :
- Nom de l'article (cliquable → Product Details)
- Champ **Quantity** (pour split partiel) + bouton **`Apply`**
- Dropdown **Shipment** par article, avec indicateurs :
  - `(creates new)` — le shipment sera créé au save
  - `(new)` — shipment créé avec d'autres articles déjà assignés
- Bouton **`Create Shipment`** (icône +) dans le panneau Shipments
- Bouton **`Remove Shipment`**
- Boutons **`Save`** / **`Cancel`**

Comportement : **fermer sans Save = perte des modifications**. Chaque shipment créé a ses propres détails, tags, notes et packing slip. Affichage grille : `(1 of 2)`, `(2 of 2)`.

New Layout : « Split & Combine: New process maintains original order integrity with selling channel data ».

#### Combine Shipments

Accès : sélectionner plusieurs orders → **`Other Actions`** > **`Combine Shipments`**.

- **Contrainte forte** : les commandes doivent être en statut **Awaiting Shipment**. Si des étiquettes existent, il faut d'abord les *void*.
- Si les adresses diffèrent → **modale avec radio buttons** pour choisir l'adresse de destination retenue
- Résultat : un shipment combiné en *Awaiting Shipment*, affichant **tous les numéros de commande** dans Order Details, expansible dans la grille pour voir les articles constitutifs

### 2.12 Raccourcis clavier (liste complète)

#### Basic Hotkeys (toujours actifs)

| Touche | Action |
|---|---|
| `?` | List hotkeys (a.k.a. keyboard shortcuts) |
| `Esc` | Close window |
| `Shift + Click` | Select multiple rows |
| `Ctrl + Click` | Toggle row selection |
| `▼` `▲` `►` `◄` | Navigate rows and Order Details windows |
| `Ctrl + Shift + S` (Mac : `Cmd + Shift + S`) | Enable barcode listening screen |

#### Advanced Hotkeys (activés par défaut) — Shipping

| Touche | Action |
|---|---|
| `U` | Update all stores |
| `N` | Create new orders |
| `V` | View Order Details window |
| `W` | Read weight from scale |
| `R` | Get rate |
| `Q` | Toggle QuickShip |
| `S` | Create label (a.k.a. Ship Orders) |
| `C` | Show Rate Calculator |
| `B` | Create new batch |
| `O + R` | Reload Orders grid |
| `P + B` | Process currently open batch |
| `M + S` | Mark as Shipped |
| `M + B` | Mark as Shipped Bulk |

#### Advanced Hotkeys — Printing

| Touche | Action |
|---|---|
| `P + S` | Print Packing Slip |
| `P + L` | Print Pick List |
| `O + S` | Print Order Summary |

#### Advanced Hotkeys — Navigation

| Touche | Action |
|---|---|
| `/` | Focus QuickSearch |
| `G + O` | Go to Orders |
| `G + S` | Go to Shipments |
| `G + F` | Go to Shipments > Fulfillments |
| `G + R` | Go to Shipments > Returns |
| `G + B` | Go to Shipments > Batches |
| `G + E` | Go to Shipments > End of Day |
| `G + K` | Go to Shipments > Pickup |
| `G + P` | Go to Products |
| `G + I` | Go to Products > Inventory |
| `G + C` | Go to Customers |
| `G + A + M` | Go to Account Settings |
| `G + A + S` | Go to Store Setup Settings |
| `G + A + C` | Go to Carrier Settings |
| `G + A + P` | Go to Print Setup Settings |
| `G + A + N` | Go to ShipStation Connect Settings |

#### Preset Hotkeys
Jusqu'à **36 presets** peuvent être associés à des hotkeys (les combinaisons disponibles sont listées dans la fenêtre **Manage Presets**). Chaque preset hotkey peut être **imprimé sous forme de code‑barres** (bouton **`Print Hotkeys and Barcodes`**) pour déclencher l'action au scan plutôt qu'au clavier.

#### Barcode Scan Actions
Trois rapports imprimables génèrent des codes‑barres scannables couvrant **les mêmes actions que les hotkeys ci‑dessus** :
- `Hotkey Reference Sheet`
- `Barcode Scan Action Quick Reference Sheet`
- `Barcode Scan Action Report`

Dans Scan to Verify & Print : `V` = Mark as Verified, `P` = Print Label.

---
