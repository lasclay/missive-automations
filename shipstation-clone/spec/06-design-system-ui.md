# 6. Design system & patterns UI

> Extrait de la spec ShipStation — Lasclay. Voir `00-INDEX.md` pour la carte complète.
> Libellés d'UI en anglais (langue source du produit). `[à vérifier]` = non confirmé par une source officielle.

## 6. Design system / patterns UI

### 6.1 Layout général

**Modèle à 3 colonnes** sur l'écran Orders (le plus dense) :
```
[ sidebar statuts/vues ~200px ]  [ zone centrale flex ]  [ shipping sidebar ~340px ]
```
Les autres écrans (Products, Customers, Shipments) suivent le même modèle : **sidebar de vues à gauche + grille au centre**, panneau de détail à droite ou en modal.

**Hiérarchie verticale de la zone centrale** :
1. Onglets de Custom Views (avec compteurs)
2. Filter Bar
3. Action Bar (bulk actions) + bouton `Columns`
4. Grille
5. Pagination / compteur de résultats

### 6.2 Densité

**Très haute densité** — c'est un outil d'opérateur d'entrepôt, pas un dashboard marketing :
- Lignes de grille compactes
- Beaucoup de colonnes visibles simultanément avec scroll horizontal + **pinned columns** (2 max)
- Multi‑item expansion inline (chevron) plutôt que navigation
- Sidebar droite persistante pour éviter les allers‑retours modaux

### 6.3 Couleurs et sémantique

Couleurs confirmées :
| Élément | Couleur | Sens |
|---|---|---|
| Marque produit | **indigo / bleu profond** | branding ShipStation |
| Bouton `Create Label` (mode normal) | **vert** | action primaire de validation |
| Bouton `Create Label` + icône QuickShip (mode QuickShip actif) | **bleu** | mode alternatif actif |
| Icône QuickShip inactive | **gris** | état désactivé |
| Coche de validation (ex. ajout de catégorie) | **vert** | confirmation |
| Address Validated (Domestic) | **icône immeuble vert** | succès |
| Address Validated (Residential, US) | **icône maison verte** | succès |
| Address Validated (International) | **icône globe vert** | succès |
| Address Not Verified / Not Found | **cercle noir avec `?`** | inconnu |
| Address Warning | **triangle orange** | avertissement |
| Address Error | **cercle rouge avec `!`** | erreur |
| Tracking number voidé | **texte barré (strikethrough)** | annulé |
| Order Tags | **palette de couleurs configurable** | classification utilisateur |

Palette sémantique à répliquer : **vert = validé/succès**, **orange = avertissement**, **rouge = erreur**, **noir/gris = neutre/inconnu**, **bleu = mode/action secondaire active**.

### 6.4 Iconographie

- Icônes fonctionnelles fines et monochromes
- Icônes récurrentes : engrenage (settings/gear pour options de groupement), crayon (édition inline), épingle (pin note / pin column), calculatrice (rate calculator), balance (poids), imprimante, code‑barres, globe/maison/immeuble (validation d'adresse), corbeille, `+` (ajouter), `×` (retirer), chevrons (expansion/tri)
- Tuiles de marque pour les **Direct Integrations** : « A store or carrier integration built directly into ShipStation » avec **tuiles brandées** dans les écrans de settings — grille de logos carriers/marketplaces

### 6.5 Patterns de modales et popups

Types identifiés :
- **Pop‑up de configuration** : Manage Columns, Manage Presets, Manage Tags, Split Ship, Mark as Shipped, Combine (avec radio buttons), Service Mapping
- **Modales de confirmation** : Void Label (`Continue` → résultat → `Done`)
- **Modales plein écran / détail** : Order Details, Product Details (avec onglets), Customer History
- **Modales multi‑étapes** : CSV Import (upload → mapping → `Start Import`)
- **Règle** : fermer une modale sans `Save` **jette** les modifications (comportement explicite du Split Ship pop‑up)
- Boutons d'action typiquement en bas à droite : `Cancel` (secondaire) / `Save` ou `Apply` (primaire)

### 6.6 Toasts et notifications système

- Notifications de succès/échec après actions asynchrones (void label, envoi d'email, impression)
- **Label Queue** (QuickShip) : traitement en arrière‑plan avec statut de lot (`Label Batch Status`, affichable/masquable)
- **Alerts** persistantes (pastille numérotée) distinctes des toasts éphémères
- Erreurs d'étiquette persistées dans les champs `LabelErrorMessage`, `LabelInfoMessage`, `EmailErrorMessage`, `InsuranceErrorMessage`, `NotifyErrorMessage` → à afficher au niveau de l'enregistrement, pas seulement en toast

### 6.7 Pagination

- Compteur de résultats visible (les Custom Views affichent le nombre de commandes correspondantes)
- Pagination classique par pages sur Customers (« browse pages »)
- `[à vérifier]` : taille de page par défaut et présence d'un sélecteur de nombre de lignes

### 6.8 Sélection multiple

- Checkbox par ligne + checkbox « select all » en en‑tête
- `Shift + Click` = plage
- `Ctrl + Click` = toggle
- La barre d'actions se contextualise selon la sélection
- Quand plusieurs commandes sont sélectionnées, la sidebar droite affiche les articles groupés par **`Orders`** ou par **`Items`** (gear icon)

### 6.9 Drag & drop

Trois usages confirmés :
1. **Colonnes de grille** — réordonner par drag des en‑têtes
2. **Sections de la Shipping Sidebar** — « Drag and drop the shipping sidebar sections into any sequence »
3. **Éditeur d'emails visuel (WYSIWYG)** — blocs de contenu

### 6.10 Panneaux latéraux

- **Sidebar gauche** : navigation contextuelle (statuts, vues, catégories) — toujours visible
- **Sidebar droite (Shipping Sidebar)** : détail + actions sur la sélection — persistante, sections réordonnables, accordéons repliables
- Pattern d'accordéon pour `Other Shipping Options` (options carrier avancées)

### 6.11 États vides et de chargement

`[à vérifier]` — non documentés publiquement. Recommandations pour la réplication :
- **État vide de grille** : illustration + message contextuel selon le statut (ex. « No orders awaiting shipment ») + CTA (`Connect a Store`, `Create Order`, `Update all stores`)
- **Chargement** : skeleton rows pour la grille, spinner sur les boutons d'action asynchrones (`Get Rate`, `Create Label`)
- **Chargement de tarif** : le bouton `Create + Print Label` affiche le tarif — prévoir un état « calcul en cours » sur ce bouton, puisque « The rate automatically updates as you configure your shipment »
- **État `Rate Expired`** : indicateur sur un tarif obsolète nécessitant un recalcul

### 6.12 Persistance et scope des préférences

Important pour l'architecture :
| Préférence | Scope |
|---|---|
| Custom Views / Saved Filters | **Compte** (visibles par tous les utilisateurs) |
| Colonnes d'une vue | Compte (attaché à la vue) |
| Shipping Presets | Compte |
| Order Tags | Compte |
| Display Options (langue, format date/heure, unités, écran de login) | **Utilisateur** |
| QuickShip settings (Show Warnings, Errors, Cost Summary…) | **Utilisateur** |
| Layout Legacy vs New | **Compte entier** — « if your account has multiple users, every user on the account must use the same layout » |
| Permissions / Restrictions | Utilisateur |
| Batch assignment | Utilisateur (verrou d'écriture) |

---

## 7. Notes de réplication — priorisation suggérée

1. **Socle** : modèle de données Order / Shipment / Product / Customer / Store + relation Order↔Shipment N:N.
2. **Grille configurable** générique (colonnes, tri, pin 2 colonnes, drag reorder, expansion inline, sélection multi) réutilisée sur Orders / Shipments / Products / Customers.
3. **Filter Bar + Custom Views** — moteur de filtres générique avec les ~45 critères Orders, persistance de vues.
4. **Configure Shipment Widget** — le composant le plus dense ; sortir la logique de tarification en service (rate quote) avec debounce et invalidation (`Rate Expired`).
5. **Automation engine** avec l'ordre d'exécution strict des 6 couches (§3.1) — c'est la partie la plus différenciante et la plus facile à rater.
6. **Hotkeys** — implémenter dès le début (système de key‑sequence à 2 touches type `G+O`, `M+S`), car cela contraint l'architecture de focus/événements.
7. **Printing** — abstraire les types de documents et les destinations (`Print via Connect` / `Preview in Browser` / `Download PDF` / `Always prompt`) derrière une seule interface.
8. **Templates** (packing slips + emails) avec field replacements `[ ]` + Liquid.

Points d'attention connus (issus du feedback communautaire) :
- Les colonnes personnalisées se réinitialisent parfois (bug rapporté) → persister côté serveur, par vue, pas en localStorage.
- Le bouton `Other Actions` peut être masqué derrière un menu « … » sur écrans étroits → prévoir un overflow responsive dès la conception.
- Pas de hotkey natif pour le tagging → opportunité d'amélioration.

---
