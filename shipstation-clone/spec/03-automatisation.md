# 3. Automatisation — règles, presets, routage

> Extrait de la spec ShipStation — Lasclay. Voir `00-INDEX.md` pour la carte complète.
> Libellés d'UI en anglais (langue source du produit). `[à vérifier]` = non confirmé par une source officielle.

## 3. Automatisation

### 3.1 Ordre d'exécution (critique pour l'implémentation)

ShipStation applique l'automatisation **dans cet ordre exact** :

```
1. Auto-Routing        (plan High Volume, US/CA)
2. Auto-Split          (High Volume US/CA/ANZ ; Enterprise UK/EU)
3. Product Preset Groups
4. Product Defaults
5. Service Mapping
6. Automation Rules
```

**Déclencheurs d'exécution** — l'automatisation s'exécute quand une commande :
- est importée / créée en statut *Awaiting Shipment* ou *On Hold*
- passe de *Awaiting Payment* → *Awaiting Shipment*
- est retraitée manuellement via **`Reprocess Automation Rules`**

> Le bouton **Reprocess** rejoue **Product Defaults, Service Mapping et Automation Rules** sur les commandes *Awaiting Shipment* (pas Auto‑Routing ni Auto‑Split).

Emplacement : **`Settings > Automation > Automation Rules`**.

### 3.2 Automation Rules — logique

Modèle **IF / THEN** : « IF/THEN logic to identify which orders to perform an action on ».

Structure d'une règle :
```
Rule Name
  IF   [criteria 1]  [operator]  [value]
  AND/OR [criteria 2] …           ← Advanced rules : groupes AND/OR imbriqués
  THEN [action 1]
       [action 2] …
```

Deux modes documentés : **Basic Automation Rules** (conditions simples) et **Advanced Automation Rules** (groupes de conditions, logique complexe).

Opérateurs typiques (variables selon le type de champ) : `equal`, `contain`, `start with`, `end with`, `is blank`, `greater than`, `less than`, `is between` `[à vérifier — liste exacte par type de champ]`. Pour les **Custom Fields**, la doc confirme : `equal / contain / start with / end with / blank`.

### 3.3 Automation Rules — CRITERIA (liste exhaustive)

**Address Information**
- `Address Verified` (Verified / Warning / Error)
- `Address Line 1`
- `Address Line 2`
- `City`
- `State`
- `Postal Code`
- `Country`
- `Residential / Commercial`

**Customer & Order Identification**
- `Customer`
- `Buyer ID`
- `Recipient Name`
- `Recipient Company`
- `Assigned User`

**Order Financials**
- `Amount Paid`
- `Order Subtotal`
- `Order Total`
- `Shipping Paid`
- `Tax Paid`

**Order Details**
- `Order #`
- `Order Date`
- `Order Tags`
- `Order Weight`
- `Total Quantity`
- `# of Line Items`
- `Package`
- `Brand` (3PL uniquement)
- `Gift Order`

**Item‑Specific** (⚠ commandes **mono‑ligne** uniquement)
- `Item Name`
- `Item SKU`
- `Warehouse Location`

**Shipping & Delivery**
- `Carrier`
- `Ship from Location`
- `Ship By Date`
- `Deliver by Date`
- `Requested Service (Mapped)`
- `Requested Service (Marketplace Value)`
- `Shipping Account` (My Account / Third Party / Recipient)
- `International Order`
- `USPS Zone`

**Source & Notes**
- `Marketplace`
- `Order Source`
- `Store`
- `Internal Notes`
- `Notes to the Buyer`
- `Notes from Buyer`

**Custom Fields**
- `Custom Field 1`
- `Custom Field 2`
- `Custom Field 3`

### 3.4 Automation Rules — ACTIONS (liste exhaustive)

**Order Notes & Tags**
- `Add Note to the Buyer…`
- `Add an Internal Note…`
- `Add a Tag...`
- `Set Custom Field 1…`
- `Set Custom Field 2…`
- `Set Custom Field 3…`

**Order Management**
- `Assign to a user…`
- `Hold Until…`
- `Hold the Order for…`
- `Create an Alert…`
- `Stop Processing Rules for the Order`
- `Don't Import the Order`

**Shipping Configuration**
- `Set Carrier/Service/Package…`
- `Set Ship From Location…`
- `Charge Shipping to My Account…`
- `Charge Shipping to 3rd Party…`

**Shipping Options**
- `Enable Saturday Delivery (UPS / FedEx)`
- `Enable Shipper Release (UPS only)`
- `Do Not Prepay Postage (Endicia Only)`
- `Set the Order as Containing Alcohol (FedEx)`
- `Set the Order as Containing Dry Ice (UPS / FedEx)`
- `Mark Shipment(s) as 'Non-Machinable'`
- `Collect Payment on Delivery (C.O.D.)...`
- `Show Postage Paid on the Label`

**Package & Weight**
- `Set Package Dimensions…`
- `Adjust the Order Weight…`
- `Set the Total Order Weight…`
- `Set the Dry Ice Weight (UPS / FedEx)`

**International & Customs**
- `Set Customs Content Type…`
- `Set Declaration Statement (FedEx only)`
- `Prepay Duties and Taxes`
- `Bill Int'l Duties to Payor of Shipping Charges`
- `Set International Non-Delivery…`
- `Set Tax Identifiers`

**Fulfillment & Logistics**
- `Set Fulfillment Provider…`
- `Block Amazon Logistics`
- `Use Blank Box`
- `Set Shipping Strategy`

**Dates & Delivery**
- `Set Ship By Date`
- `Include a Return Label with the Outbound Label`
- `Request Confirmation…`

**Insurance & Services**
- `Insure the Package…` (montant par défaut = **Amount Paid** de la commande)
- `Set Notifications (Royal Mail / Parcelforce)`

**Notifications & Communication**
- `Send an email…`
- `Do Not Notify Marketplace of Shipment`
- `Use email template for Delivery Notification…`
- `Use email template for Shipment Notification…`
- `Use a specific Packing Slip…`

### 3.5 Shipping Presets

Champs stockables dans un preset (« as few or as many as you need in each preset ») :
- `Ship From Location`
- `Shipping Service`
- `Package Type`
- `Confirmation`
- `Insurance`
- `Weight`
- `Size` (dimensions)

**Flux de création** :
1. Orders grid → sélectionner une commande
2. Section Shipping de la sidebar → **`Apply Preset`** → **`Manage Presets`**
   *(ou `Other Actions` > `Manage Presets` sans sélection préalable)*
3. **`New Preset`** dans le popup
4. **`Add Shipping Options`** → cocher les réglages voulus
5. Saisir le **nom du preset** (obligatoire) + assigner un **hotkey** (optionnel)
6. Save

**UI Manage Presets** : liste des presets, boutons **`Edit`** / **`Delete`**, icône settings pour trier les services par carrier ou par account, bouton **`Print Hotkeys and Barcodes`**. Max **36 presets** avec hotkey.

### 3.6 Rate Shopper (add‑on)

`Settings > Shipping > Rate Shopper`. Sélection automatique du tarif optimal. Disponible US, Canada, Australie, Nouvelle‑Zélande. Inclus dans High Volume, add‑on ailleurs.

**Création d'une règle** : bouton **`Create New`** → deux parcours : **`Start from Recommended`** ou **`Build from Scratch`**.

Champs :
| Champ | Détails |
|---|---|
| `Name` | identifie la règle dans les menus de services |
| `Select Service` (dropdown) | ajoute carriers/services à comparer, validation par **`Apply`** |
| `Transit Time` (dropdown) | restreint les services éligibles. Défaut : **`No Restriction`** |
| `Fallback Transit Time` | conditionnel, si `Use Deliver by Date` |
| Preference toggle | active la préférence de service |
| `Use this service` (dropdown) | carrier préféré |
| `If cheapest label is within` | tolérance de prix pour appliquer la préférence |
| `Package type` / `Confirmation type` | AU/NZ uniquement |
| `Add another service` | AU/NZ, comparaison multi‑services |
| **`Publish`** | finalise la règle |
| **`Available`** toggle | (coin sup. de chaque règle) affiche/masque la règle dans les menus de service |

Icône **`X`** pour retirer un service de la comparaison.

### 3.7 Service Mapping

« The process of telling ShipStation to automatically assign a specific shipping service to an order. »

**Niveau order** : lien **`unmapped`** à côté de `Requested Service` dans la Shipping Sidebar ou Order Details → modale :
- select **Shipping Service**
- select **Package Type**
- bouton **`Save Mapping`**
- une fois créé, le lien devient **`Mapped`** (réouvre la modale)
- **Effet** : s'applique à **toutes les commandes Awaiting Shipment du même store** ayant la même valeur de requested service

**Niveau store** : `Account Settings > Selling Channels > Store Setup > [store] > Edit Store Details > Shipping Services tab`
- Liste des mappings existants, avec `Add`, `Edit`, `Delete`
- Bouton **`Save Changes`**
- Les nouveaux mappings n'affectent que les commandes *Awaiting Shipment* **sans service déjà choisi**
- Modifier un mapping existant **n'affecte pas** les commandes ouvertes
- Case à cocher : **« On order import, automatically set the Shipping Service selected by the customer at checkout »** (Checkout Rates) — **écrase** les autres mappings quand activée. US/CA/AU/NZ.

### 3.8 Product Defaults & Product Preset Groups

**Product Defaults** = « the details stored in your ShipStation product records ». S'appliquent automatiquement aux commandes **ne contenant que ce produit**.

Trois voies de configuration :
1. Product Details screen (individuel)
2. **Bulk CSV Import**
3. Pendant l'expédition d'une commande (sauvegarder la config comme défaut)

Champs par onglet :

| Onglet | Champs |
|---|---|
| **General** | `Description`, `Image URL`, `Reporting Category`, `Order Tags`, `UPC`, `Returnable` |
| **Shipping** | `Preset Group`, `Domestic` (service/package/confirmation), `International`, `Weight`, `Dimensions`, `Warehouse Location`, `Fulfillment SKU` |
| **Customs** | `Do not create customs`, `Description`, `Declared Value`, `Harmonization Code`, `Origin Country` |
| **Store Aliases** | `SKU`, `Store` |

Portée : uniquement les **nouvelles commandes** à l'import. Case **`Apply changes to open orders`** pour propager aux commandes *Awaiting Shipment* existantes.

Pour les **Advanced Product Types** : les défauts du **Parent SKU** s'appliquent d'abord, puis les overrides du **variant**.

**Product Preset Groups** : « Groups multiple product records with shared shipment and customs defaults » — s'exécutent **avant** les Product Defaults dans l'ordre d'automatisation.

### 3.9 Order Routing / Auto‑Routing (allocation d'entrepôt)

`Settings > Automation > Order Routing`. Requis : compte **US ou Canada**, plan **Premium/High Volume**, tous les produits dans le catalogue avec Ship From Locations assignés.

**Flux de configuration** :
1. **Export CSV** des produits → renseigner la colonne **`ActiveShipFroms`** (plusieurs emplacements séparés par le **pipe `|`**)
2. **Upload** du CSV via l'interface Order Routing
3. **Review** des assignations produit→emplacement dans Products
4. Choisir la **priorité de fulfillment** :
   - **`Products Closest to Customer`** — proximité géographique, split de commandes si nécessaire
   - **`Fewest Ship From Location(s)`** — minimise le nombre d'emplacements, même plus éloignés
5. **Toggle Order Routing** → activation pour les nouvelles commandes importées

Limites : ne s'applique pas aux commandes manuelles ni aux commandes Shopify avec articles à quantité zéro ; les mises à jour marketplace ne s'appliquent pas aux shipments splittés ; se désactive si les adresses ne peuvent être vérifiées ou si des produits n'ont pas d'emplacement.

**Auto‑Split** : « Split orders into multiple shipments based on the products included in the order. »

---
