# 1. Modèle mental du produit & navigation globale

> Extrait de la spec ShipStation — Lasclay. Voir `00-INDEX.md` pour la carte complète.
> Libellés d'UI en anglais (langue source du produit). `[à vérifier]` = non confirmé par une source officielle.

## 0. Modèle mental du produit

ShipStation est un **hub d'expédition multi‑canal**. Le flux canonique :

```
Selling Channels (stores)  →  import  →  ORDERS (Awaiting Shipment)
                                            ↓ automation (routing, split, presets, service mapping, rules)
                                            ↓ Configure Shipment Widget (CSW)
                                            ↓ Create + Print Label
                                         SHIPMENTS  →  End of Day / Manifest
                                            ↓
                                    Notifications (marketplace + client)
                                            ↓
                                    Returns / RMA  →  Insights
```

Objets de données principaux (vocabulaire officiel du glossaire) :

| Objet | Définition officielle |
|---|---|
| **Order Record** | "The data object that contains all of the information for an order." |
| **Shipment Record** | "The data object containing all of the information for a shipment." |
| **Product Record** | "The data object that contains all of the information for a product in the Products grid." |
| **Customer Record** | Fiche client agrégée depuis les canaux de vente |
| **RMA** | "Return Merchandise Authorization Record… similar to an order record; it contains all of the details about the shipping label and item(s) that are included in the return." |
| **Batch** | Lot d'expéditions traitées ensemble |
| **Configure Shipment Widget (CSW)** | "The widget in ShipStation where all shipping options are set." |
| **Custom View** | "A set of enabled filters and page layout selections in your Orders and Shipments tabs that you can save." |
| **Ad Hoc Batch** | "A batch created in ShipStation when you create labels for multiple orders without first adding them to a normal batch." |

**Relation clé à ne pas rater** : un **Order** peut porter **plusieurs Shipments** (via Split), et un **Shipment** peut couvrir **plusieurs Orders** (via Combine). L'affichage grille montre `(1 of 2)`, `(2 of 2)` pour les orders splittés.

---

## 1. Structure de navigation globale

### 1.1 Barre de navigation principale (top toolbar)

Onglets principaux, dans l'ordre :

| Onglet | Sous‑onglets / vues | Description officielle |
|---|---|---|
| **Insights** (ex‑*Dashboard*) | Pages d'analyse + Reports | "provides variety of graphs to tell you about your sales and shipments" |
| **Orders** | Statuts + Custom Views (barre latérale gauche) | Espace de travail principal : gestion, configuration d'expédition, création d'étiquettes |
| **Shipments** | `Shipments`, `Fulfillments`, `Returns`, `Batches`, `End of Day`, `Pickup` | Enregistrements d'expédition, réimpression, tracking, void, EOD |
| **Products** | `Products`, `Inventory`, `Reporting Categories` (sidebar "Product Views") | Catalogue produit + valeurs par défaut |
| **Customers** | grille clients | Fiches clients, historique, tags |
| **Scan** | `Scan to Print`, `Scan to Verify`, `Scan to Verify & Print` | Poste de scan code‑barres |
| **Settings** (icône engrenage, coin sup. droit) | voir §4 | Configuration compte |

> Les hotkeys de navigation confirment l'arborescence exacte : `G+O` Orders, `G+S` Shipments, `G+F` Shipments > Fulfillments, `G+R` Shipments > Returns, `G+B` Shipments > Batches, `G+E` Shipments > End of Day, `G+K` Shipments > Pickup, `G+P` Products, `G+I` Products > Inventory, `G+C` Customers.

### 1.2 Barre supérieure (header)

Éléments, de gauche à droite :

1. **Logo ShipStation** (retour Insights)
2. **Onglets de navigation principale** (voir ci‑dessus)
3. **QuickSearch** — champ de recherche global. Hotkey `/` pour focus. Comportement **"starts with"**. Portée : order numbers, names, emails, addresses, items, SKUs, tracking numbers. **Limite : 2 ans d'historique.**
4. **Update / Refresh stores** — icône de mise à jour ("use the update icon in the top right corner to manually or automatically update orders"). Hotkey `U` = *Update all stores*.
5. **Alerts** — "a numbered oval next to the Profile icon" (pastille numérotée). Ouvre un popup listant les alertes. Menu `View Alerts` depuis le profil.
6. **Profile menu** — Nom d'utilisateur / avatar → `View Alerts`, sélecteur de langue, `Settings`, `Sign Out`. Langues UI supportées : **English, Spanish, French, French (Canada)**.
7. **Settings** (engrenage) — accès à l'espace Settings.
8. **Help / Support** `[à vérifier]`

### 1.3 Sélecteur de store

Il n'y a **pas** de sélecteur de store global unique dans le header : le filtrage par store se fait :
- via le **filtre `Store`** dans la Filter Bar des grilles Orders / Shipments,
- via **Group By > Store** sur Awaiting Shipment,
- via **Insights > Store Filter** (page Customer Engagement notamment),
- via **Settings > Selling Channels > Store Setup** pour la configuration.

### 1.4 Alertes (Order Alerts)

4 catégories officielles :

| Type | Déclencheur |
|---|---|
| **Combine Order Alerts** | "ShipStation detects multiple orders that could be shipped together" (le plus fréquent) |
| **New Product Records** | Nouveau product record créé depuis un order importé |
| **Low Inventory Alert** | Seuil défini dans `Settings > Inventory Settings` atteint |
| **Automation Rule Alerts** | Règle avec l'action `Create an Alert…` |

Affichage : pastille numérotée à côté de l'icône Profile. Sur le New Layout, les **Combine Order Alerts** s'affichent **aussi** comme un nombre dans la sidebar de l'écran Orders, à côté d'un dropdown *Order Alert*. Actions par alerte : voir l'order, appliquer l'action recommandée, **dismiss**.

---
