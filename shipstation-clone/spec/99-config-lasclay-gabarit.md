# 99. Configuration réelle du compte ShipStation — Lasclay

> ⚠️ **GABARIT NON REMPLI.** Ce fichier est le chaînon manquant entre « une app qui fait la même chose que ShipStation » et « une transition seamless ».
>
> Le reste du paquet décrit le produit. Ce fichier décrit **comment Lasclay s'en sert** — et c'est ce qui détermine si le lundi matin après la bascule se passe bien.
>
> Voir `00-INDEX.md § Comment remplir 99-config-lasclay.md` pour les trois méthodes d'extraction.

---

## Comment se servir de ce gabarit

Chaque section indique sa source : `[API]` si l'information s'obtient par l'API v1, `[UI]` si elle n'existe que dans l'interface et doit être transcrite depuis une capture d'écran.

Remplacer chaque bloc `<!-- À REMPLIR -->` par les données réelles. Ne pas supprimer les sections vides : une section vide est un signal explicite pour la session de build (« cette partie n'a pas été relevée »), alors qu'une section supprimée passe inaperçue.

---

## 1. Boutiques / Selling Channels `[API — GET /stores]`

<!-- À REMPLIR
Pour chaque boutique :
- storeId, storeName, marketplaceName
- accountName, integrationUrl
- active (oui/non)
- companyName, phone, publicEmail, website
- refreshDate, lastRefreshAttempt, autoRefresh
- statusMappings[] : orderStatus interne ← statusKey de la marketplace
-->

### 1.x Réglages par boutique `[UI — Settings → Selling Channels → Store Setup]`

<!-- À REMPLIR pour chaque boutique
- Import settings : plage d'import initiale, fréquence, quels statuts importer
- Faut-il importer les commandes non payées ?
- Notifications client activées côté ShipStation ou côté Shopify ?
- Branding appliqué
- Mapping des services d'expédition demandés par le client (requestedShippingService) → service réel
-->

---

## 2. Transporteurs & services `[API — GET /carriers, /carriers/listservices, /carriers/listpackages]`

<!-- À REMPLIR
Pour chaque transporteur connecté :
- carrierCode, name, accountNumber, nickname
- balance, requiresFundedAccount
- primary (oui/non)
- Services activés (code + nom) — et surtout ceux qui sont utilisés en pratique
- Types de colis disponibles + colis personnalisés définis
-->

### 2.x Service Mapping `[UI — Settings → Shipping → Service Mapping]`

<!-- À REMPLIR
Table : service demandé par le client (par boutique) → transporteur + service + type de colis appliqués
-->

### 2.x Réglages transporteur particuliers `[UI]`

<!-- À REMPLIR
- Assurance : fournisseur par défaut (transporteur / ShipSurance / aucune), seuil de valeur
- Confirmation par défaut (none / delivery / signature / adult_signature)
- Options de retour
- Comptes à provisionner et leur seuil d'alerte
-->

---

## 3. Entrepôts / Ship From Locations `[API — GET /warehouses]`

<!-- À REMPLIR
Pour chaque entrepôt :
- warehouseId, warehouseName, isDefault
- originAddress complète (nom, société, rue 1/2/3, ville, province, code postal, pays, téléphone, résidentiel)
- returnAddress complète si différente
-->

---

## 4. Règles d'automatisation `[UI UNIQUEMENT — Settings → Automation → Automation Rules]`

> ❗ Aucun endpoint API n'expose ces règles. C'est la donnée la plus critique du fichier et la seule qui doit être transcrite à la main.
>
> Pour chaque règle, capturer l'écran **règle ouverte**, pas seulement la liste.

<!-- À REMPLIR — un bloc par règle, dans l'ordre d'exécution affiché

### Règle N° _ : « nom exact de la règle »
- Active : oui / non
- S'applique à : toutes les boutiques / boutique X
- Déclencheur : à l'import / manuel / les deux
- Logique : TOUS les critères / N'IMPORTE QUEL critère
- Critères :
  - [champ] [opérateur] [valeur]
  - ...
- Actions :
  - [action] [paramètres]
  - ...
- Notes : pourquoi cette règle existe, quel cas d'usage elle couvre
-->

> Le champ « Notes » compte autant que la règle : dans six mois, personne ne se souviendra pourquoi une règle traite différemment les commandes de plus de 2 kg vers les Territoires.

---

## 5. Shipping Presets `[UI UNIQUEMENT — Settings → Shipping → Shipping Presets]`

<!-- À REMPLIR — un bloc par preset

### Preset : « nom exact »
- Transporteur / service / type de colis
- Confirmation
- Poids et dimensions par défaut
- Assurance
- Options avancées cochées
- Associé à quel raccourci / quelle règle ?
-->

---

## 6. Product Defaults & Preset Groups `[API partiel — GET /products / UI]`

<!-- À REMPLIR
- Produits ayant des défauts d'expédition (poids, dimensions, entrepôt, service, type de colis, fulfillment)
- Preset groups définis
- Aliases produits (mêmes SKU sous plusieurs noms selon la boutique)
- Bundles / kits
-->

---

## 7. Impression `[UI UNIQUEMENT — Settings → Printing]`

<!-- À REMPLIR
- Document Options : pour chaque type de document (label, packing slip, pick list, manifest) → format, taille, destination
- Format d'étiquette : 4x6 thermique / 8.5x11 / PDF / PNG / ZPL
- Imprimantes configurées et leur nom exact
- ShipStation Connect installé sur quelle machine ?
- Printing Presets définis
- Faut-il imprimer le packing slip avec l'étiquette ? Dans quel ordre ?
- Insert marketing joint aux colis ?
-->

### 7.x Template de packing slip `[UI]`

<!-- À REMPLIR — coller le HTML du template depuis l'éditeur, ou joindre un PDF imprimé -->

---

## 8. Douane & international `[UI — Settings → Shipping → International]`

<!-- À REMPLIR
- Contenu douanier par défaut (merchandise / gift / documents / sample / returned_goods)
- Option de non-livraison par défaut (return_to_sender / treat_as_abandoned)
- Codes HS utilisés, par produit ou par catégorie
- Pays d'origine déclaré (CA / TN pour la production tunisienne ?)
- Numéro IOSS si vente UE
- Numéro d'entreprise / EORI / taxe
- Seuils déclenchant une déclaration EEL/PFC
-->

> Point d'attention Lasclay : la production étant partiellement en Tunisie, le pays d'origine déclaré en douane peut différer du pays d'expédition. Vérifier ce qui est réellement paramétré dans ShipStation avant de le répliquer — et vérifier au passage que c'est correct.

---

## 9. Notifications & emails `[UI — Settings → Notifications]`

<!-- À REMPLIR
- Quels emails sont activés (expédition, livraison, retard, retour)
- Templates : coller le HTML, ou capturer
- Branding : logo, couleurs, expéditeur, domaine d'envoi
- Versions FR et EN — comment la langue est-elle choisie ?
- Y a-t-il double envoi ShipStation + Shopify + Klaviyo ? Qui envoie quoi ?
-->

> Question à trancher pendant le build : si Klaviyo ou Shopify envoie déjà la notification d'expédition, le nouveau système ne doit peut-être pas l'envoyer du tout — juste pousser le tracking.

---

## 10. Vues, colonnes et filtres `[UI — écran Orders]`

<!-- À REMPLIR
- Custom Views / Saved Filters définis : nom + critères
- Colonnes visibles dans la grille Orders, dans l'ordre exact
- Colonnes épinglées
- Tri par défaut
- Idem pour les grilles Shipments et Products si personnalisées
-->

---

## 11. Tags `[API — GET /accounts/listtags]`

<!-- À REMPLIR
tagId | name | color | à quoi il sert concrètement
-->

---

## 12. Utilisateurs & permissions `[API — GET /users]`

<!-- À REMPLIR
- Utilisateurs actifs, rôle, permissions
- Qui expédie au quotidien ? Qui administre ?
-->

---

## 13. Intégrations & API `[UI — Settings → Integrations]`

<!-- À REMPLIR
- Clés API générées et où elles sont utilisées
- Webhooks configurés : événement → URL cible
- Applications tierces connectées à ShipStation (ERP, compta, 3PL, Klaviyo...)
-->

> Chaque webhook et chaque application tierce est une dépendance à recréer. C'est la section la plus souvent oubliée, et celle qui casse des choses trois semaines après la bascule.

---

## 14. Volumétrie & contraintes d'exploitation

<!-- À REMPLIR
- Nombre de commandes par jour, en creux et en pointe (Black Friday ?)
- Saisonnalité
- Proportion national / États-Unis / international
- Poids et dimensions typiques par gamme de produit
- Combien de personnes expédient simultanément
- Contraintes matérielles : imprimante(s), balance connectée, scanner
- Plan ShipStation actuel et son coût mensuel (référence pour l'analyse de rentabilité)
-->
