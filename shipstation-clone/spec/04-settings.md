# 4. Écrans Settings (exhaustif)

> Extrait de la spec ShipStation — Lasclay. Voir `00-INDEX.md` pour la carte complète.
> Libellés d'UI en anglais (langue source du produit). `[à vérifier]` = non confirmé par une source officielle.

## 4. Écrans Settings

Structure de la sidebar Settings (reconstituée à partir des chemins documentés et des hotkeys `G+A+*`) :

```
Settings
├── Account
│   ├── My Profile
│   ├── Display Options
│   ├── Payment & Subscription
│   ├── User Management
│   ├── User Permissions and Restrictions
│   ├── Workflow Settings          (New Layout uniquement)
│   ├── API Settings
│   └── Sign In & Security
├── Selling Channels
│   ├── Store Setup
│   └── Marketplace / Checkout Rates
├── Shipping
│   ├── Carriers                   (G+A+C)
│   ├── Packages
│   ├── Ship From Locations
│   ├── International Settings
│   ├── Insurance
│   ├── Rate Shopper
│   ├── Returns
│   └── Fulfillment Providers
├── Printing
│   ├── Printing Setup             (G+A+P)
│   ├── Document Options
│   └── ShipStation Connect        (G+A+N)
├── Warehouse
│   ├── Picking
│   └── Inventory Settings
├── Automation
│   ├── Automation Rules
│   ├── Order Routing / Auto-Routing
│   └── Presets
├── Templates
│   ├── Email Templates
│   └── Packing Slips
└── Integrations / API
```

> `[à vérifier]` : le regroupement exact et l'ordre visuel des entrées de la sidebar Settings. Les chemins individuels sont, eux, confirmés par la documentation (`Settings > Shipping > International Settings`, `Account Settings > Printing > ShipStation Connect`, `Account Settings > Warehouse > Picking`, `Settings > Templates > Packing Slips`, `Settings > Automation > Order Routing`, `Settings > Shipping > Rate Shopper`, `Account Settings > Selling Channels > Store Setup`, `Settings > Inventory Settings`).

### 4.1 Account

#### My Profile
- `User Name`
- `Email Address`
- `Password`
- Option email **weekly digest**
- Sélecteur de langue (English / Spanish / French / French (Canada))

#### Display Options
« Determines the look and feel of the ShipStation interface »
- **Default login screen** (écran d'arrivée)
- **Time format** : 12‑hour / 24‑hour
- **Date format**
- **Time zone**
- **Units of measure** : imperial / metric

#### Payment & Subscription
- Changement de niveau d'abonnement (plans : **Free, Starter, Standard, Premium** ; aussi **High Volume**, **Enterprise** selon région)
- Détails de facturation
- Carte de crédit
- Gestion du nombre d'utilisateurs
- **Account Balance** (solde d'affranchissement) + historique (rapport `Account Balance History`)
- Méthode de paiement ACH pour le rechargement du solde

#### User Management
- Ajouter / éditer / supprimer des comptes utilisateurs
- Écrans localisés par pays : **Add & Edit Users – United States / Canada / Australia and New Zealand / Germany**

#### User Permissions and Restrictions

**Permissions** (section « Permissions ») :
- `Account Management`
- `Administration`
- `Configuration`
- `Customer Management`
- `Inventory Management` *(uniquement si inventaire interne ShipStation)*
- `Order Management`
- `Product Management`
- `Purchasing`
- `Reporting`
- `Shipping`

**Restrictions** (section « Restrictions ») :
- `Restrict this user to only see orders assigned to them`
- `Restrict this user to only see shipments assigned to them`
- `Restrict this user to only see shipments created by them`
- `Restrict this user to only see Inventory data`
- `Require this user to view the rate details screen and any warnings when shipping orders. Block QuickShip.`
- `Require workstation approval for this user`

#### Workflow Settings (New Layout)

| Réglage | Options |
|---|---|
| **Label Button** | `Create Label` **ou** `Create + Print Label` |
| **Quickship** (toggles show/skip) | `Warnings`, `Errors`, `Cost Summary`, `Label Batch Status`, `Print Dialog Preview` |
| **Scan to Verify Items By** | `UPC`, `Item SKU`, `Fulfillment SKU` |
| **Scan Workflow – Mark as Verified step** | `Make users click 'Mark as Verified' to confirm all items are verified before moving to the next step` **ou** `Automatically take users to the next step once all order items are verified` |

#### Sign In & Security
- **Adaptive Multi‑Factor Authentication**
- Politiques de mot de passe `[à vérifier]`

#### API Settings
- Génération / affichage de **API Key** et **API Secret**
- **Webhooks** (voir §4.9)

### 4.2 Selling Channels / Store Setup

**Écran Store Setup** :
- Bouton **`Connect a Store or Marketplace`**
- **Liste recherchable** de canaux (recherche/filtre)
- Liste des stores connectés, chacun avec un menu **`Actions`** → **`Edit Store Details`**, `Reconfigure`, `Deactivate` `[à vérifier — libellés exacts]`

**Catégories d'intégration** :
1. `Stores & Shopping Carts`
2. `Marketplaces`
3. `Listing Tools & Multichannel`
4. `Carriers`
5. `Ecommerce Tools`
6. `Agencies`

Canaux notables : Shopify, Amazon, eBay, Etsy, WooCommerce, BigCommerce, Squarespace, Wix, Walmart, TikTok Shop, Faire, Temu, Shein, Alibaba, Big Cartel, Adobe Commerce (Magento), PayPal, Shopware v6, Shop.com.
Types spéciaux : **Manual Store** (« A store you can create in ShipStation to hold manual orders »), **Custom Store** (développé selon le *Custom Store Development Guide*).

#### Onglets de Store Settings (`Edit Store Details`)

| Onglet | Contenu |
|---|---|
| **General** | `Store name`, statut Active/Inactive, **`Allow the store to auto-update periodically`** (auto‑import), standardisation d'adresse (address validation on/off) |
| **Checkout Rates** | « control what shipping services your customers can choose during checkout » (Shopify, BigCommerce, Magento, Wix ; US/CA/AU) |
| **Branding** | `Company name`, `Phone`, `Logo`, `Website URL`, liens sociaux, email d'expédition vérifié, **Branded Tracking Page** (voir §4.8) |
| **Tracking Page** | Rediriger vers le tracking carrier **ou** vers la **branded tracking page** |
| **Returns** | Activation du **Branded Returns Portal**, `Return Exceptions` (« Allow customers to create return labels within [N] days or order ship date »), `Return Service & Package Type`, `Branded Returns Portal URL`, `Return Policy Message` (500 car. max), `Return Email Message` (2 000 car. max, HTML supporté) |
| **Emails** | Notifications marketplace (timing), Shipment Confirmation, Estimated Delivery Date, Out for Delivery, Delivery Notification, **BCC email address** |
| **Packing Slips** | Sélection du template + message de pied de page personnalisé |
| **Products** | Préférences de création de product records, réglages des line items pour coupons/remises |
| **Shipping Services** | Création et gestion des **service mappings** |
| **Activity** | Historique d'activité du store, dates de début d'import |

#### Import & mapping de statuts
- Import automatique périodique (toggle General)
- Import manuel via `Update all stores` (`U`)
- **Import Orders via CSV** : `Orders > Other Actions > Import Orders` → `+Select file` → `Import to Store` (dropdown) → `Create a new field mapping` (ou mapping sauvegardé) → `Upload` → dialogue de mapping (colonne gauche **`ShipStation Field`**, colonne droite **`Your Column Header`**) → **`Start Import`**. **`Order #` est le seul champ obligatoire.** Auto‑numérotation avec la valeur `AUTO`. Template `OrderImportSample.csv` téléchargeable. Mappings nommés sauvegardables (alphanumérique uniquement).
- **Custom store statuses** (section d'aide « Advanced Store Settings ») pour mapper les statuts du canal vers ceux de ShipStation `[à vérifier — UI exacte]`

### 4.3 Shipping

#### Carriers
- Liste des carriers connectés, chacun affichant **le nombre de services activés**
- **Toggle par carrier** pour tout désactiver d'un coup
- Colonne **`Services`** avec **checkboxes** par service : « select the services you want to use and deselect the ones you don't want to use » → **`Save`**
- Seules les options activées apparaissent dans les dropdowns du CSW
- Exceptions : Royal Mail (UK) et Australia Post récupèrent les services approuvés directement via l'API carrier — non éditables

Carriers principaux : USPS, UPS, FedEx, DHL, Canada Post, Royal Mail, Australia Post, Amazon Logistics, Sendle, netParcel, Endicia, Parcelforce…

#### Packages
`Settings > Shipping > Packages`
- **Onglet Carriers** : dropdown **`Manage package types`** → sélectionner le provider → **toggles** par type de package → **`Save Changes`**
- **Custom package types** : création de types personnalisés (nom, dimensions, poids à vide). Ils apparaissent **en premier** dans le dropdown Package du CSW.

#### Ship From Locations

| Champ | Requis | Détails |
|---|---|---|
| `Pickup Address` | ✅ | adresse complète |
| `Return Address` | ⬜ | case **`Use Pickup Address as Return address`** ; décocher pour saisir une adresse distincte. **C'est l'adresse imprimée sur l'étiquette.** |
| `Time Zone` | ✅ | utilisé pour les options de pickup |
| `Inventory Source` | ⬜ | dropdown |
| `This is my default Location` | ⬜ | checkbox — le **premier** emplacement créé est automatiquement le défaut |

Contraintes : champs Name ≥ 2 caractères ; UPS exige `Company` ; DHL exige `Phone Number` ; UPS ne supporte pas Address Line 2 pour l'adresse de retour ; le pays doit correspondre au pays du compte. **Nombre illimité** d'emplacements.

#### International Settings — voir §4.7

#### Insurance
Providers configurables :
- **ParcelGuard** (US) — partenaire officiel, frais déduits du **ShipStation Balance**
- **Shipsurance** (US, Legacy uniquement) — facturé sur le moyen de paiement de l'abonnement
- **Total Shipping Protection by XCover** (CA/UK/AU/NZ) — couvre perte, vol, dommage + remboursement du réexpédition/retour. Tarifs : **1,25 %** domestique, **1,75 %** international
- **Carrier Insurance**
- **Other Insurance** (assurance tierce, enregistrement seulement)

#### Returns
Voir §5.7.

#### Rate Shopper
Voir §3.6.

### 4.4 Printing

#### Printing Setup — Shipping Label

| Réglage | Options |
|---|---|
| **Shipping Label Format** | `4" x 6"` (thermique) · `A6` (thermique) · `8.5" x 11" (Letter)` (jet d'encre/laser) · `A4` (jet d'encre/laser) · option **imprimer les packing slips avec les étiquettes** |
| **Label DPI** | `203 DPI` · `300 DPI` |
| **Order Labels By** | `None` · `Order Date` (Most recent first/last) · `Paid Date` (Most recent first/last) · `Buyer Name` (a→z / z→a) · `Order Number` (Lowest/highest first) · `Item SKU` (a→z / z→a) · `Item Name` (a→z / z→a) · `Warehouse Location` (a→z / z→a) |
| **Label Branding** | Enabled / Disabled (utilise le logo du store depuis Branding) |
| **Label Messages** | **3 champs** de message, **26 caractères max chacun**, supportent les *field replacements* |
| **Shipping Cutoff** | Heure de la journée après laquelle la ship date avance au jour suivant |

**Print To** — colonne dans Printing Setup, une ligne par type de document. Cliquer sur **`Always prompt`** pour changer. Options de destination :
- `Print via ShipStation Connect` (envoi direct à une imprimante)
- `Preview in Browser`
- `Download PDF`
- `Always prompt`

Types de documents imprimables : **Shipping Label**, **Label with Packing Slip**, **Packing Slip**, **Pick List**, **Order Summary**, **Customs Forms**, **Shipment Manifest / End of Day Form**, **Return Label**, **Barcode Sheet**.

#### Document Options

**Packing Slip Options**
- **Format** : `4" x 6" (thermal printer)` · `8.5" x 11" (2 per page)` · `8.5" x 11" (full page)`
- **Sort by Items** : `SKU` · `Name` · `Item Quantity` (high→low ou low→high) · `Warehouse Location` · `None` (ordre d'origine)
- **Advanced Options** (show/hide) : `Store Logo`, `Item Prices`, `Item SKUs`, `"Scan to View" Barcode`, `Item Locations`, `Discounts`, `Zero Quantity Items`

**Order Summary Options**
- **Sort Orders By** : `Order Date`, `Date Paid`, `Buyer Name`, `Order Number`, `Item SKU`, `Item Name` (+ sens de tri)
- show/hide : `Product Images`, `Product SKU`, `Simple Summary`, `"Scan to View" Barcode`

**Pick List Options** *(aussi accessibles via `Account Settings > Warehouse > Picking`)*
- **Summarize By** : `SKU` · `Name` · `SKU and Name` · `Do not summarize`
- **Order Items By** : `SKU` · `Name` · `# of items` · `Warehouse location` · `Warehouse location then SKU`
- show/hide : `Product Images`, `Order Number(s)`, `Product SKU`, `Zero Quantity Items`, `Inventory Counts`
- **Warehouse Location** : dropdown de source (`Shipping Location` ou `Inventory Location`)

**Shipment Manifest Options**
- `List items for each order in the shipment manifest` (enable/disable)

#### ShipStation Connect

`Account Settings > Printing > ShipStation Connect`. Application desktop (Windows / macOS 10.12+, auto‑updating) reliant les imprimantes et balances USB au compte.

Écran de settings :
- **Workstations** (« The computer your printers are physically attached to via USB »)
- **Printers** connectées avec indicateur de statut
- **Scales** connectées avec indicateur de statut

Contrôles par device :
- **Icône crayon** (au survol du nom) → renommer workstation/device
- Toggle **`Shared`** — rend l'imprimante visible aux autres utilisateurs / la balance accessible à tous
- Toggle **`Disabled`** — device inactif, non sélectionnable comme imprimante par défaut
- Lien **`Deactivate workstation`** — supprime la workstation et tous ses devices/réglages

États affichés : `Active`, `Disabled`, `Shared`.
« The display names set here will be what all ShipStation users see when they select a workstation and a printer during the print process. »

### 4.5 Warehouse / Inventory

#### Inventory Settings (`Settings > Inventory Settings`)
- **Inventory Tracking Toggle** — interrupteur maître
- **Out‑of‑Stock Handling** : `allow shipments as usual` / `permit with warnings` / `block entirely`
- **Non‑Tracking Location Warnings** — alerte lors d'expédition depuis un emplacement non suivi
- **Low Stock Alerts** — notifications sous seuil
- **Allocation Strategy** — défaut : commandes les plus anciennes d'abord
- **Lot Tracking** — dates de péremption, allocation FIFO automatique
- **Inventory Sync** — synchronisation vers les canaux : Amazon, BigCommerce, eBay, Etsy, Faire, Shopify, Squarespace, Temu, Walmart, Wix, WooCommerce

**Inventory Warehouses** : hiérarchie d'emplacements personnalisable **Area / Unit / Shelf / Bin** → format `B-24-7`.

**Concepts** : `On Hand Stock`, `Allocation` (« reserving inventory units for your orders in the Awaiting Shipment status »), `Aggregate Inventory` (interne + sources externes), `Available`, `Re-Order Threshold`.

⚠ **L'allocation se déclenche à l'impression du packing slip.**

Field replacement pour packing slips : `[Product Location]`.

#### Picking (`Account Settings > Warehouse > Picking`)
Voir Pick List Options ci‑dessus.

### 4.6 Products (settings côté catalogue)

Voir §5.2 pour l'écran. Réglages liés :
- **Product Defaults** (§3.8)
- **Reporting Categories** (§5.2)
- **Product Aliases** (§5.2)
- **Product Bundles and Kits** (§5.2)

### 4.7 Customs / International

`Settings > Shipping > International Settings`

**Default Customs Information**
| Champ | Options |
|---|---|
| `Default Content Type` | `Documents`, `Gift`, `Merchandise`, `Returned Goods`, `Sample` |
| `Non-Delivery Option` | `Return to sender` · `Treat as abandoned` |
| `Customs Declarations` | `Create declarations from order items` · `Use pre-defined values` · `Leave blank (enter manually)` |
| `Sign Customs As` | champ nom du signataire |
| `ITN/USPS Exemption Code` | toggle — International Transaction Number ou codes d'exemption (EEL/PFC) |

**Tax Identifiers**
- Bouton **`Add a Tax Identifier`**
- Types supportés : `TIN`, `VOEC`, `PAN`, `EIN`, `SSN`, `VAT`, `EORI`, `IOSS`
- Champs : `Tax ID Type`, `Issuing Authority`, `Number`, `Nickname`
- ⚠ **Non modifiables après ajout**

**Importer of Record**
- Bouton **`Add Importer of Record`** → nom, société, adresse, contact

**Tracking**
- `Send non-trackable Tracking Numbers to Marketplaces` (toggle, ex. USPS First Class Mail International)

**Autres**
- `Apply order import currency to customs declarations` (toggle)

#### Customs Declarations (niveau shipment, dans le CSW)

**Champs de déclaration (niveau colis)** :
| Champ | Statut | Détails |
|---|---|---|
| `Select Contents` | Recommandé | type de marchandises |
| `If Undeliverable` | Recommandé | ex. `Return to Sender` |
| `Duties Paid` | Recommandé | montant |
| `Postage Paid` | Recommandé | montant |
| `Invoice Number` | Recommandé | référence commande/facture |
| `Export Declaration Number` (ITN) | Conditionnel | requis pour marchandises restreintes ou valeur ≥ **2 500 $** |
| `Tax Identifiers` | Conditionnel | basé sur les Tax IDs enregistrés dans International Settings (VAT, IOSS, GST…) |
| `Declaration Statement` | FedEx uniquement | |

**Champs par article** :
| Champ | Statut |
|---|---|
| `Description` | **Requis** (< 50 caractères recommandé) |
| `Quantity` | **Requis** |
| `Item Value (each)` | **Requis** |
| `Total Value` | calculé automatiquement |
| `Country of Origin` | **Requis** |
| `Harmonization Code` (HS) | Recommandé — **6 à 10 chiffres** |
| `SKU` | Optionnel |

**Overrides produit** : `Products > Product Details > Customs tab` : `Do Not Create Customs`, `Description`, `Declared Value`, `Harmonization Code`, `Origin Country` + case **`Apply changes to open orders`**.

Formulaires générés : **CN22**, **CN23**, **Commercial Invoice**. Incoterms supportés : `DDP`, `DDU`, `DAP`. Notions : `EORI`, `HTS Code`, `MID Code`, `De Minimis Value`, `ETD` (FedEx), `EAD`, `IOR`, `TSS`.

### 4.8 Notifications & emails

#### Customer Notifications (4 types)
| Email | Description officielle |
|---|---|
| **Shipment Confirmation** | "This email will notify buyers that their shipment is being prepared." |
| **Estimated Delivery Date** | Envoyé à l'entrée dans le mail stream avec estimation |
| **Out for Delivery** | Colis en cours de livraison |
| **Delivery Notification** | "ShipStation will notify buyers that their shipment has arrived at it's final destination." |

Réglages (onglet **Emails** du store) :
- **Checkbox d'activation** par type
- **BCC email address** (copie de toutes les notifications)
- **Delay Options** (Shipment Confirmation) :
  - `When shipping label is created` (défaut)
  - `The shipment first hits the mail stream`
  - `At a specific time on ship date`
  - `Number of hours after label creation`
- Bouton **`Preview Emails`**

Expéditeur par défaut : **`Tracking@ShipStation.com`** sauf si une adresse société est vérifiée dans l'onglet Branding (+ **Domain Authentication** configurable).
⚠ Certains canaux (Amazon, Walmart) interdisent l'envoi direct par un tiers.

#### Marketplace Shipment Notifications
Par défaut : envoyée dès la création de l'étiquette ou le *Mark as Shipped*.
Réglage **`Send marketplace notification when…`** (onglet Emails du store), 3 conditions combinables (la **première atteinte** déclenche) :
- Mail stream hit
- Specific ship date time
- Hours after label creation

Blocage : checkbox `Do not notify Marketplace` (Other Shipping Options), bulk update `Do Not Notify Marketplace`, décocher `Notify Marketplace` dans Mark as Shipped, action d'automation.
Suivi : colonne **`Marketplace Notified`** dans Shipments → `Notified` ou `Failed` (+ possibilité de renvoyer).

#### Email Templates
`Account Settings > Templates > Email Templates` → onglets **`Shipment`** / **`Delivery`**.
- **Visual Editor (WYSIWYG)** drag & drop : `Template Name`, `Subject`, contenu
- **HTML Editor** : bouton **`Edit HTML`**, HTML4/HTML5 + CSS interne
- Bouton **`Send Test Email`**
- Dropdown **`Use Branding From`** (choix du store dont la marque s'applique)
- **Field Replacements** : « text inside square brackets `[ ]` »
- ⚠ « The Custom Email Template function is only available with the Legacy Customer Notifications experience. »

#### Packing Slip Templates
`Settings > Templates > Packing Slips` → bouton **`New Template`**.
4 sections éditables :
1. **Order Header** — logo store, adresses, n° de commande, date, infos client
2. **Order Items Header** — libellés de colonnes (`SKU`, `Description`, `Price`, `Qty`, `Ext. Price`)
3. **Order Items** — contenu
4. **Order Footer** — notes, totaux, taxe, shipping, barcode scan

Langages : **HTML**, **CSS** (inline + `<style>`), **Liquid Logic** (conditions).
Field Replacements via dropdown dédié : `[Carrier Name]`, `[Sku]`, `[Store Logo]`, `[Warehouse Location]`, `[Product Location]`, etc.
Contraintes : nom + taille du template requis à la création ; seuls les formats correspondant au Printing Setup s'affichent ; **logo max 300×80 px** (8.5"×11") ou **150×60 px** (4"×6").

#### Branding & Branded Tracking Page
Onglet **Branding** du store : nom, téléphone, logo, URL du site, liens sociaux.

**Branded Tracking Page** :
| Réglage | Détails |
|---|---|
| `Show Store Logo` | affiche le logo |
| **Custom Colors** | 3 éléments : `Tracking Page Background`, `Expected Delivery Date`, `Service Menu & Social Media Links` |
| `Show Service Menu` | sous‑options : `Website`, `Additional Links`, `Return Policy`, `Contact Us` (phone/email) |
| `Show Social Media Links` | profils configurés dans General Settings |
| `Show Order Details` | images d'articles, SKUs, prix |
| `Customize Design` | **3 layouts de template** (plans Standard/Premium) |
| `Promotional Images` | images marketing (plans Standard/Premium) |

Blocs de la page publique : zone logo (haut) → statut tracking → expected delivery date → détails articles → service menu → liens sociaux → contenu promotionnel.

**Branded Labels** : logo du store imprimé sur l'étiquette (réglage `Label Branding`).
**Marketing insert** : via `Promotional Images` (tracking page) et via le message de pied de page du packing slip `[à vérifier — pas de module "marketing insert" dédié documenté]`.

### 4.9 Integrations & API

#### API Settings
- **API Key** / **API Secret** (API v1 legacy)
- Nouvelles API : **Shipping API**, **Inventory API**, **Order Consolidation API**, **Address Validation**, **Tracking**, **Analytics** (docs.shipstation.com)
- **Throttling** : « Limiting the number of requests you (or your authorized developer) can submit to a given operation. »

#### Webhooks

Champs du formulaire de création/édition :
| Champ | Contrainte |
|---|---|
| `Name` | 100 caractères max |
| `Type` | sélection de l'événement |
| Portée store | `all stores` **ou** `a specific store` |
| `Target URL` | 200 caractères max |

**Types d'événements** :

*Order Webhooks*
- `On New Orders` (**ORDER_NOTIFY**)
- `On New Items` (**ITEM_ORDER_NOTIFY**)

*Shipment Webhooks*
- `On Orders Shipped` (**SHIP_NOTIFY**)
- `On Items Shipped` (**ITEM_SHIP_NOTIFY**)

*Fulfillment Webhooks*
- `On Items Shipped by Fulfillment Provider` (**FULFILLMENT_SHIPPED**)
- `On Items Rejected by Fulfillment Provider` (**FULFILLMENT_REJECTED**)

*V2 Webhooks*
- `(V2) On Batch Processed` (**BATCH_PROCESSED_V2**)
- `(V2) On New Track Event` (**TRACK_EVENT_V2**)
- `(V2) On New Order Created` (**SHIPMENT_CREATED_V2**)
- `(V2) On New Label Created` (**LABEL_CREATED_V2**)
- `(V2) On Fulfillment Shipped` (**FULFILLMENT_SHIPPED_V2**)
- `(V2) On Fulfillment Rejected` (**FULFILLMENT_REJECTED_V2**)

---
