# Audit exhaustif de MRPeasy — référence fonctionnelle pour la conception d'un MRP sur mesure (Lasclay)

> **Nature du document.** Ce fichier est écrit pour être **lu par un LLM** qui doit concevoir ou implémenter
> un MRP/ERP manufacturier sur mesure. Il décrit *ce que fait* MRPeasy, *comment* il le fait (règles de
> calcul, machines à états, algorithmes), *où* sont les limites, et *ce qu'il faut en retenir ou en rejeter*.
> Il est volontairement redondant sur les règles métier : chaque règle est énoncée explicitement plutôt
> que renvoyée à une section.
>
> **Version de référence :** MRPeasy tel que documenté publiquement au 24 août 2026.
> **Sources :** manuel utilisateur officiel (187 pages, `www.mrpeasy.com/resources/user-manual/*`),
> spécifications OpenAPI v1 et v2 (`api.mrpeasy.com/rest/v{1,2}/openapi.json` — 49 chemins, 116 et 135
> schémas), grille tarifaire publique, documentation développeur (`mrpeasy.readme.io`).

---

## 0. Portée, méthode et limite d'accès

### 0.1 Ce qui a été audité

| Axe | Couverture | Source |
| --- | --- | --- |
| Arborescence des modules et sous-sections | 100 % | Manuel, table des matières complète |
| Champs et paramètres de chaque écran | ~95 % | Manuel, page par page |
| Règles de calcul (coût, durée, ordonnancement, OEE) | 100 % des règles documentées | Manuel |
| Machines à états (statuts et transitions) | 100 % | Manuel + enums OpenAPI |
| Modèle de données (entités, champs, types) | ~90 % | OpenAPI v1 + v2 |
| Droits d'accès et sécurité | 100 % | Manuel |
| Intégrations | 100 % de la liste, détail sur 8/17 | Manuel |
| Plafonds et limites techniques | 100 % des limites documentées | Manuel |
| Tarification et découpage des paquets | 100 % | Page tarifs publique |

### 0.2 Limite d'accès à signaler explicitement

**Je n'ai pas pu me connecter à `app.mrpeasy.com` avec le compte Lasclay** : aucune identification n'est
disponible dans cet environnement (ni variable d'environnement, ni secret sur les proxys Render, ni session
navigateur). L'application est entièrement derrière authentification et ne publie aucune démo accessible
sans compte.

**Conséquence :** cet audit couvre **la totalité du périmètre fonctionnel** de MRPeasy, mais pas
**la configuration réelle de votre instance** (quelles fonctions Pro/Enterprise sont activées chez vous,
combien d'articles/nomenclatures existent, quels postes de travail sont définis, l'état de vos données).

**Ce qu'il faudrait pour compléter :** soit des identifiants (idéalement un utilisateur en lecture seule
créé pour l'occasion dans Settings → Human resources), soit une session où vous ouvrez chaque écran et je
guide la capture. Le PDF joint (`GUIDE-CAPTURES-MRPEASY.pdf`) est précisément le **plan de capture** à
exécuter dans ce cas : il liste écran par écran ce qu'il faut photographier et ce qu'il faut annoter.

### 0.3 Comment lire ce document

- **§1 à §3** : le modèle mental. À lire en premier, c'est là que se trouve la valeur conceptuelle.
- **§4** : les moteurs (MRP, ordonnancement, coût). C'est le cœur technique d'un MRP ; tout le reste est du CRUD.
- **§5 à §12** : audit module par module, exhaustif, sous forme de spécification.
- **§13 à §16** : transversal (droits, intégrations, API, limites).
- **§17** : synthèse critique et recommandations pour Lasclay.
- **Annexes** : énumérations, formules, spécifications d'import CSV, endpoints API.

---

## 1. Vue d'ensemble du produit

### 1.1 Positionnement

MRPeasy se définit comme un **ERP/MRP infonuagique en libre-service pour petits manufacturiers et
distributeurs de 10 à 200 employés**. Trois traits structurent tout le produit :

1. **Libre-service assumé.** Le support officiel forme sur la fonctionnalité mais refuse explicitement de
   conseiller sur l'usage métier ou de configurer les intégrations. La complexité est donc reportée sur des
   consultants agréés tiers.
2. **Découpage par paquets payants.** Le noyau est volontairement mince ; une grande partie de ce qu'on
   attend d'un MRP (codes-barres, multi-entrepôt, contrôle qualité, numéros de série, sous-traitance,
   MPS, RMA) est vendue dans les paliers Professional / Enterprise. **Chaque fonction activée modifie
   l'interface** : de nouveaux champs, colonnes, sections et onglets apparaissent. C'est un principe
   d'architecture à retenir : *le produit est un noyau + un système de drapeaux de fonctionnalités*.
3. **Traçabilité par lot comme fondation.** Tout — coût réel, FIFO, péremption, qualité, rappel — repose
   sur un objet interne appelé **stock lot**. Il n'y a pas de valorisation « moyenne globale » : chaque
   réception et chaque production crée un lot avec son propre coût unitaire.

### 1.2 Les huit sections de l'application

| Section | Persona | Rôle |
| --- | --- | --- |
| **Dashboard** | Direction | 24 widgets d'indicateurs, cliquables vers le rapport détaillé |
| **CRM** | Ventes | Commandes clients, clients, factures/devis, listes de prix, prévisions d'encaissement, retours (RMA) |
| **Production planning** | Planificateur | Ordres de fabrication, calendrier/Gantt, postes de travail, nomenclatures, gammes, MPS |
| **Stock** | Magasinier | Articles, lots, expéditions, transferts, inventaire, seuils critiques, radiations, mouvements |
| **Procurement** | Acheteur | Bons de commande, fournisseurs, prévisions d'appro, inspections, besoins |
| **My production plan / Internet-kiosk** | Opérateur atelier | Déclaration temps réel des opérations et de la consommation matière |
| **Accounting** | Comptable | Plan comptable, grand livre, bilan, résultat, écritures automatiques |
| **Settings** | Administrateur | Paramètres système, fonctions Pro/Enterprise, RH, intégrations, éditeurs PDF/étiquettes/courriel, maintenance BD |

Un panneau **Tasks** (tâches internes avec échéance, pièces jointes, commentaires) est accessible depuis
tous les écrans sauf le kiosque.

### 1.3 Flux métier canonique

```
                     ┌─────────────────────────────────────────────────┐
                     │           DONNÉES DE BASE (seed data)           │
                     │  Articles ─ Nomenclatures (BOM) ─ Gammes        │
                     │  Postes de travail ─ Groupes ─ Clients ─ Frs    │
                     │  Conditions d'achat ─ Unités ─ Emplacements     │
                     └───────────────────────┬─────────────────────────┘
                                             │
   ┌─────────────────────────────────────────┼──────────────────────────────────────┐
   │                                         │                                      │
   ▼ MAKE-TO-ORDER                           ▼ MAKE-TO-STOCK                        ▼ PRÉVISIONNEL
Commande client (CO)                  Point de commande (ROP)                Sales Forecast (IA)
   │  « Check stock and book items »       │  Stock → Critical on-hand              │
   │                                       │                                        ▼
   ├─ produits dispo ─────► Booking        ├──► crée MO                        MPS (plan directeur)
   │                                       └──► crée PO                             │
   ├─ produits manquants ──► crée MO(s)                                             ├─► Required Capacity
   │                     └─► crée PO(s)                                             └─► Procurement Schedule
   │                                                                                     │
   ▼                                                                                     ▼
Ordre de fabrication (MO)  ◄──────── Procurement → Requirements ──────────► Bon de commande (PO)
   │  matières réservées (booking FIFO/FEFO sur lots)                          │
   │  opérations planifiées sur postes (capacité finie)                        │  réception → lot
   ▼                                                                           │  (statut On hold si QC)
Atelier : My production plan / Internet-kiosk                                  ▼
   │  Start / Pause / Finish ; consommation matière ; n° de série       Inspection (QC)
   │                                                                     ├─ approuvé → stock
   ▼                                                                     └─ rejeté → lot Rejected
MO terminé → lot produit fini (coût = matières + MOD + frais généraux)         │
   │                                                                           └─► Service order (réparation)
   ▼
Expédition (Shipment) : pick → sortie de stock → COGS
   │
   ├─► Facture / avoir / acompte
   └─► Retour client (RMA) → inspection → réparation / remplacement / avoir
```

---

## 2. Modèle de données canonique

Cette section est la plus directement réutilisable pour concevoir un schéma de base de données. Les noms de
champs proviennent des spécifications OpenAPI officielles ; ils reflètent le schéma interne réel.

### 2.1 Article — la dualité `product_id` / `article_id`

**Le point d'architecture le plus important de MRPeasy.** Un article possède deux identifiants :

- `product_id` : identifie **le modèle d'article** (le « produit générique »).
- `article_id` : identifie **une variation concrète** de cet article (une combinaison de valeurs de
  paramètres). Si la fonction Matrix BOM est désactivée, `article_id` = un pour un avec `product_id`.
  Si Matrix BOM est activée **et** que l'article a des paramètres, `article_id` est `null` au niveau du
  produit et n'existe qu'au niveau des variations.

**Conséquence pour un MRP custom :** il faut décider dès le départ si les variantes (taille, couleur,
format d'emballage) sont des articles distincts ou des variations d'un article-modèle. MRPeasy a choisi la
seconde voie, ce qui lui permet une nomenclature paramétrique unique, mais lui coûte cher : de nombreuses
fonctionnalités (MPS, rapports « où utilisé », export CSV des nomenclatures) sont **partiellement ou pas
supportées** pour les articles paramétriques. Voir §16.

Champs de l'entité `Product` :

| Champ | Type | Sens |
| --- | --- | --- |
| `product_id` | int | ID du modèle d'article |
| `article_id` | int / null | ID de la variation (null si paramétrique au niveau modèle) |
| `variations` | array | Liste des variations |
| `code` | string | Numéro de pièce unique (« Part Number »). Généré automatiquement, modifiable |
| `title` | string | Nom / description courte. **Obligatoire** |
| `barcode` | string / null | Code-barres UPC-A/EAN-13 (si fonction Barcodes) |
| `deleted` | bool | Les articles ne sont **jamais supprimés**, seulement archivés (suffixe `del`) |
| `unit_id` / `unit` | int / string | Unité de mesure de stock |
| `group_id` / `group_code` / `group_title` | | Groupe de produits (porte le compte d'inventaire comptable) |
| `is_raw` | bool | `true` = article acheté ; `false` = article fabriqué |
| `not_for_sale` | bool | Exclu de la sélection dans CO, devis, factures (reste dispo en RMA) |
| `standalone_mo` | bool | Interdit l'imbrication de cet article comme sous-ensemble dans un MO multiniveau |
| `min_manufacturing_quantity` | decimal | Quantité minimale de lancement en fabrication |
| `selling_price` | decimal | Prix de vente par défaut |
| `location_id` | array (par site) | Emplacement de stockage par défaut, **par site** |
| `min_quantity` | array (par site) | Point de commande (ROP), **par site** |
| `weight` + `weight_unit_id` | decimal + enum(1=g,2=oz,3=lbs,4=kg) | Poids unitaire (fonction Packing) |
| `revision` | string / null | Révision courante (fonction VCS) |
| `quality_control` | bool | Soumis à inspection à la réception (fonction QC) |
| `onhold_period` | int | Jours de quarantaine avant inspection |
| `serials` | bool | Suivi par numéro de série |
| `shelf_life` | int | Durée de vie en jours (fonction Expiry date) |
| `custom_values` | array | Champs personnalisés (max 30 dans tout le système) |

Attributs non exposés en API mais présents à l'écran : « This is an inventory item » (Oui/Non,
**non modifiable après création**), « Show parts » (afficher les composants sur les PDF d'expédition et
de facturation), fichiers attachés, notes.

### 2.2 Nomenclature (BOM)

| Champ | Sens |
| --- | --- |
| `bom_id`, `code`, `title` | Identité |
| `product_id` | Article fabricable auquel la nomenclature appartient |
| `type` | `1` = nomenclature normale, `2` = nomenclature de **désassemblage** |
| `routings` | IDs des gammes compatibles avec cette nomenclature |
| `components[]` | Lignes de composants |
| `packing` | Matériel d'emballage + quantité de produits par colis (fonction Packing) |

Ligne de composant (`BomComponent`) :

| Champ | Sens |
| --- | --- |
| `component_id`, `ord` | Identité et rang (à partir de 1) |
| `article_id` / `product_id` | Article consommé |
| `relation_id` | Alternative à `article_id` : une **relation** paramétrique remplace l'article au lancement du MO |
| `def_params` | Valeurs de paramètres par défaut, en JSON (`{"1":"2","3":"4"}`) |
| `quantity` | Quantité pour **une** unité de produit fini |
| `quantity_matrix[]` | Quantité par valeur de paramètre, quand un paramètre modifie les quantités (max **150 colonnes**) |
| `quantity_fixed` | Quantité **fixe**, non multipliée par la quantité du MO (fonction Fixed Quantity) |
| `cost_percent` | Pourcentage d'allocation de coût (nomenclature de désassemblage ; la somme doit faire 100 %) |
| `description` | Texte libre (instructions de manipulation) |

Une nomenclature possède aussi une section **Additional products** (co-produits, rebuts valorisés) avec un
pourcentage d'allocation de coût par unité.

### 2.3 Gamme (Routing) et opération

| Champ (gamme) | Sens |
| --- | --- |
| `routing_id`, `code`, `title`, `product_id` | Identité |
| `bom_ids[]` | Nomenclatures reliées (relation N-N gamme ↔ nomenclature) |
| `fixed_cost`, `variable_cost`, `capacity` | Coûts « autres » ajoutés au MO, hors opérations |
| `operations[]` | Opérations, ordonnées |

| Champ (opération) | Sens |
| --- | --- |
| `operation_id`, `ord` | Identité et rang |
| `workstation_group_id` | **Groupe** de postes (jamais un poste précis) — seul champ obligatoire |
| `vendor_id` | Alternative : opération sous-traitée chez un fournisseur (fonction Subcontracting) |
| `description` | Description libre |
| `setup_time` | Temps de préparation fixe, en minutes (null pour traitement passif) |
| `cycle_time` | Temps par cycle, en minutes |
| `capacity` | Nombre de pièces traitées par cycle (four, mélangeur…). Défaut 1 |
| `fixed_cost` | Frais généraux liés au setup |
| `variable_cost` | Frais généraux par cycle |
| `time_payment` | Rémunération au temps (activé par défaut) |
| `piece_payment` | Rémunération à la pièce (fonction Piece Payment) |
| `sequence[]` | Étapes d'ordonnancement (base 0) ; opérations partageant une étape = parallèles |
| `overlap` | Quantité de chevauchement : l'opération suivante peut démarrer après N pièces |
| `parallelize` | Éclatement de l'opération sur tous les postes libres du groupe |
| `assignments[]` | Départements et travailleurs assignés par défaut |
| `subtasks[]` | Liste ordonnée de sous-tâches (checklist atelier, **sans effet sur l'ordonnancement**) |

### 2.4 Poste de travail et groupe

| Champ (poste) | Sens |
| --- | --- |
| `workstation_id`, `code`, `title` | Identité |
| `workstation_group_id` | Groupe d'appartenance (**un seul**, obligatoire) |
| `hourly_rate` | Taux horaire de frais généraux ; **prioritaire sur les coûts de la gamme** |
| `productivity` | Coefficient de productivité relatif au premier poste du groupe (2 = deux fois plus rapide) |
| `site_id` | Site (fonction Multi-Stock) — un poste appartient à un seul site |
| `assignments[]` | Travailleurs/départements par défaut ; **prioritaire sur la gamme** |
| `idle[]` | Périodes d'indisponibilité planifiées (maintenance, arrêt) |
| — | Cycle de maintenance en heures / pièces / jours (fonction MMS) |

| Champ (groupe) | Sens |
| --- | --- |
| `workstation_group_id`, `code`, `title` | Identité |
| `type` | `10` = **Active processing** (capacité finie, postes réels, opérateurs, coûts) ; `20` = **Passive processing** (séchage, refroidissement, quarantaine : disponible 24/7, capacité illimitée, aucun coût de MOD ni frais généraux, durée = un seul cycle quelle que soit la quantité). **Non modifiable après création.** |
| `colour` | Couleur dans le diagramme de Gantt |
| `work_hours` | Horaires personnalisés (null = horaires de l'entreprise) |
| `holidays[]` | Congés personnalisés en `MM-dd` récurrents |

L'idée du type « traitement passif » est excellente et rarement bien traitée dans les MRP : elle modélise
proprement les temps d'attente qui ne consomment ni capacité ni main-d'œuvre.

### 2.5 Lot de stock (`Lot`) — l'objet pivot

| Champ | Sens |
| --- | --- |
| `lot_id`, `code` | Identité (numérotation automatique `L00001`) |
| `article_id` / `product_id` | Article |
| `status` | Voir l'énumération complète en annexe A.3 |
| `created`, `available_from` | Horodatages Unix |
| `quantity` | Quantité initiale du lot |
| `available` | Quantité disponible pour réservation |
| `booked` | Quantité réservée |
| `item_cost`, `total_cost` | **Coût réel unitaire et total** de ce lot |
| `pur_ord_id` / `man_ord_id` / `transfer_id` / `rma_ord_id` | Document source (achat, fabrication, transfert, retour) |
| `locations[]` | Répartition physique par emplacement de stockage |
| `serials[]` | Numéros de série contenus |
| `expiry_date` | Date de péremption (fonction Expiry) |
| `revision` | Révision (fonction VCS) |

**Doctrine officielle :** « c'est un objet interne du logiciel, normalement créé automatiquement, servant à
fournir la méthode FIFO ; au quotidien vous ne devriez pas avoir à manipuler ces lots. » En pratique, la
moitié des procédures de correction d'erreur passent par l'ouverture manuelle d'un lot — c'est un signal
d'alerte d'ergonomie à ne pas reproduire (voir §17.3).

Un lot **n'est jamais gonflable** : on ne peut pas augmenter la quantité d'un lot existant, il faut créer un
nouveau lot. Pour conserver un numéro de lot fournisseur à travers un transfert entre sites, il faut passer
par un **champ personnalisé « persistant »**.

### 2.6 Booking — la réservation

Objet technique reliant **une source** (un lot) à **une destination** (MO, CO, transfert, RMA, radiation).

- Un booking peut être « non réservé » (`not booked`) : la demande existe mais aucun lot n'est alloué.
- Aucun double booking possible : le moteur gère l'exclusivité.
- La consommation se fait **selon le booking**, jamais librement dans le stock (quand Tracing est actif).

C'est le concept central du moteur MRP de MRPeasy. Voir §4.1.

### 2.7 Ordre de fabrication (`ManufacturingOrder`)

| Champ | Sens |
| --- | --- |
| `man_ord_id`, `code` | Identité (`MO00001`) |
| `article_id`, `product_id`, `item_code`, `item_title` | Produit fabriqué |
| `quantity` | Quantité |
| `status` | 10 New, 15 Not scheduled, 20 Scheduled, 30 In progress, 35 Paused, 40 Done, 50 Shipped, 60 Closed, 70+ Archived/Cancelled |
| `part_status` | 4 Requested, 3 Not booked, 2 Delayed, 1 Expected, 0 Received |
| `created`, `due_date`, `start_date`, `finish_date` | Dates |
| `item_cost`, `total_cost` | Coût unitaire et total (réels après clôture) |
| `assigned_id` | Responsable |
| `bom_id`, `routing_id` | Nomenclature et gamme retenues |
| `target_lots[]` | Lots produits |

Sections de l'écran de détail : Parts (matières), Operations (opérations), Subcontracts (si sous-traitance),
Serial numbers, Notes, Files, Target lot.

### 2.8 Commande client (`CustomerOrder`)

Quatre machines à états **indépendantes** cohabitent sur une même commande — c'est un design remarquable :

| Dimension | Valeurs |
| --- | --- |
| `status` | 10 Quotation, 20 Waiting for confirmation, 30 Confirmed, 40 Waiting for production, 50 In production, 60 Ready for shipment, 70 Shipped, 80 Delivered, Cancelled, Archived |
| `part_status` (produits) | 10 Not booked, 12 Not enough, 15 Requested, 20 Delayed, 25 Possibly delayed, 30 Expected on time, 40 Ready for shipment, Delivered |
| `invoice_status` | 10 Not invoiced, 20 Partially invoiced, 30 Invoiced |
| `payment_status` | 10 Not paid, 20 Partially paid, 30 Paid |

Autres champs : `reference` (n° de commande d'origine côté client, sans contrôle d'unicité),
`shipping_address` (structurée ou texte libre), `delivery_date` et `actual_delivery_date`, `total_price`,
`total_cost`, `profit`, `discount_rate`, devise et taux, listes de prix, notes internes.

Un champ **Source** indique, produit par produit, de quel MO/PO/TO proviennent les articles, avec un code
couleur d'état propre.

### 2.9 Bon de commande (`PurchaseOrder`)

| Champ | Sens |
| --- | --- |
| `status` | 5 RFQ, 10 New, 20 Ordered, 30 Shipped, 40 Received, 110 Archived, 120 Cancelled |
| `expected_date`, `arrival_date`, `order_date`, `shipped_date` | Cycle de vie |
| `order_number`, `invoice_number`, `invoice_date`, `due_date` | Références fournisseur |
| `currency`, `currency_rate` | Devise fournisseur |
| `discount_rate`, `fees_taxable_sum`, `tax_rate` | Remise, frais taxables, taxe |
| `bills[]` | Factures multiples (si « Several invoices per PO ») |

Le statut **RFQ** est particulier : tant que le PO est en RFQ, **aucun lot de stock n'est créé**, donc
le système ne considère pas les articles comme attendus et ne peut pas les réserver.

### 2.10 Expédition (`Shipment`)

| Champ | Sens |
| --- | --- |
| `status` | 10 New, 15 Ready for shipment, 20 Shipped, 30 Cancelled — **tous assignés automatiquement** |
| `orders[]` | Une expédition peut couvrir **plusieurs commandes** (CO, PO de sous-traitance, RMA) |
| `tracking_number` | Importé automatiquement depuis ShipStation |
| `shipping_address`, `waybill_notes`, `packing_notes` | |
| `products[]` | Lignes expédiées, avec lots et numéros de série |

### 2.11 Autres entités notables

- **Purchase Term** : lien article ↔ fournisseur. Prix par unité, délai en **jours ouvrables**, n° de pièce
  fournisseur, quantité minimale de commande, **priorité** (nombre : plus haut = prioritaire), unité de
  mesure fournisseur avec taux de conversion et caractère indivisible, nomenclature de sous-traitance.
- **Relation** (Matrix BOM) : table associant des combinaisons de valeurs de paramètres à des articles
  concrets. Une relation ne remplace **qu'une seule ligne** de nomenclature.
- **Parameter** : nom + liste de valeurs, chaque valeur ayant un code (suffixe du numéro de pièce) et
  éventuellement un ajustement de prix de vente. Drapeau « ce paramètre modifie les quantités de matières ».
- **Department** : groupe de travailleurs interchangeables. Un utilisateur peut appartenir à plusieurs
  départements → matrice de compétences implicite.
- **Site** : entrepôt / site de production géographiquement distinct (fonction Multi-Stock).
- **Storage location** : bac, étagère, zone à l'intérieur d'un site. **Pas de hiérarchie native** —
  la convention officielle est de nommer « Salle 1, A1 ».

---

## 3. Le système de drapeaux de fonctionnalités

MRPeasy n'est pas un produit monolithique : c'est un noyau plus **29 drapeaux de fonctionnalités** qui,
lorsqu'ils sont activés, injectent des champs, des colonnes, des sections, des onglets de menu et des
statuts supplémentaires dans toute l'application. **C'est le mécanisme d'architecture le plus imitable
du produit** — et aussi la source de sa complexité.

### 3.1 Fonctions Professional (16)

| Fonction | Ce que l'activation change concrètement |
| --- | --- |
| **B2B Customer Portal** | Boutique web B2B : catalogue, panier, mes commandes, mes factures. Invitation par lien unique depuis la fiche client. Visibilité produits pilotée par la liste de prix assignée |
| **Co-Product BOM** | Section « Additional products » dans la nomenclature ; saisie des quantités de co-produits/rebuts lors de la déclaration atelier ; allocation de coût en % |
| **Custom Fields** (toujours actif) | Jusqu'à 30 champs personnalisés (texte, nombre, date, liste déroulante), sur 14 types d'objets ; champs « obligatoires » ; champs « persistants » pour les lots |
| **Disassembly BOM** | Case « This is a disassembly BOM » ; MO de désassemblage ; répartition du coût du produit sur les composants en % |
| **Expiry Date** | Champ « Expiry date » sur les lots, « Shelf life » sur l'article, bascule FIFO → **FEFO**, widget « Expire in 30 days ». **Exige Tracing actif** |
| **Fixed Quantity** | Colonne « Fixed quantity » dans la nomenclature : quantité non multipliée par la quantité du MO |
| **Non-inventory items** | Champ « This is an inventory item » (Oui/Non, **irréversible**). Articles utilisables uniquement en PO, CO et factures ; jamais en nomenclature, MO ou expédition |
| **Overlap and special sequences** | Colonnes « Overlap » et « Sequence » dans les gammes : chevauchement d'opérations et chaînes parallèles/convergentes |
| **Parallel execution** | Colonne « Parallelize » : éclatement d'une opération sur tous les postes libres du groupe |
| **Matrix BOM / Product Configurator** | Sections Parameters et Relations dans Stock settings ; section Variations sur l'article ; colonnes de quantité par valeur de paramètre dans la nomenclature ; sous-options : auto-création des variations, numéros de variation uniques, séparateur, prix de vente variables |
| **Piece Payment** | Colonnes « Piece-payment » et « Time-payment » dans les gammes |
| **Quality Control** | Onglet Procurement → Inspections ; statuts de lot « On hold » et « Rejected » ; champs QC et « On-hold period » sur l'article ; taux de rejet par fournisseur. **Exige Tracing actif** |
| **Serial Numbers** | Section Stock → Serial numbers ; section n° de série dans lots et MO ; étiquettes n° de série ; champs personnalisés sur n° de série |
| **Subcontracting** | Fournisseur sélectionnable comme groupe de postes ; section Subcontracts dans le MO ; sections Materials et Shipments dans le PO ; tolérance de sur-expédition en % |
| **Tiered Pricing** | Section CRM → Pricelists ; paliers de prix par quantité sur l'article ; liste de prix par défaut par client |
| **Unscheduled Manufacturing Orders** | Boutons « Add to schedule » / « Remove from schedule » ; options « ne pas réserver les matières / les postes » ; statut MO « Not Scheduled » ; colonne dédiée dans le Gantt |

### 3.2 Fonctions Enterprise (13)

| Fonction | Ce que l'activation change concrètement |
| --- | --- |
| **Approval System** | Statut « New » bloquant sur MO et PO au-dessus d'un seuil ; droit utilisateur « peut approuver » ; bouton Send PO désactivé avant approbation ; MO invisible pour l'atelier avant approbation ; révocation possible tant que non démarré |
| **Backward Production Scheduling** | Saisie d'une date d'échéance déclenchant un ordonnancement au plus tard ; paramètre « Buffer (days) » avant la date de livraison de la CO |
| **Barcode System** | Génération et impression EAN-13 / UPC-A / CODE128 / QR ; **28 actions contextuelles au scan** selon l'écran ouvert (voir §5.9) |
| **Maintenance Management System** | Cycle de maintenance par poste en heures / pièces / jours ; colonnes « Until maintenance » ; historique de maintenance ; notification |
| **Master Production Schedule (MPS)** | Trois vues : MPS, Required Capacity, Procurement Schedule. Horizon jusqu'à 5 ans, période hebdo/mensuelle/trimestrielle |
| **Multiple Stocks and Production Sites** | Page Settings → Production sites/Stocks ; Stock → Transfer Orders ; site obligatoire sur chaque ligne de PO, chaque MO, chaque réservation de CO ; ROP et emplacement par défaut **par site** |
| **Packing** | Champ poids sur l'article ; section Packing dans la nomenclature ; section Shipment packing ; colonnes Weight / Product packages / Packaged ; étiquettes de colis ; poids net et brut |
| **Return Merchandise Authorization (RMA)** | Page CRM → Customer returns ; page Procurement → Inspections ; 7 types de retour ; avoirs et ordres de service depuis le retour |
| **Revision / Version Control System** | Champ « Revision » sur article et lot ; chaque sauvegarde d'une nomenclature ou d'une gamme crée une révision ; restauration d'une version antérieure ; PDF d'une version antérieure |
| **Sales Forecasting** | Page Production Planning → Sales forecasting ; prévision assistée par IA sur l'historique des CO ; liaison au MPS |
| **Sales Management** | Section CRM → Sales management : rapports de performance commerciale (contacts, changements de statut, factures) |
| **Two-factor authentication** | 2FA TOTP par utilisateur, code redemandé une fois tous les 7 jours |

### 3.3 Paramètres logiciels globaux (Software settings)

Ces bascules ne sont pas vendues séparément mais modifient profondément le comportement du moteur :

| Paramètre | Effet |
| --- | --- |
| **Tracing** (le plus structurant) | ON : réservations manuelles sur lots précis, traçabilité complète. OFF : le système alloue automatiquement en FIFO en arrière-plan, l'utilisateur ne voit ni ne choisit jamais un lot. **Voir §4.1** |
| **Edit mode** | Force un clic sur « Edit » avant modification → pose un verrou sur le document (résout les écrasements concurrents) |
| **Worker sees in My production plan** | Toutes les opérations du MO / la sienne + précédente + suivante / la sienne seulement |
| **Different tax rates** | Taux de taxe par ligne de facture ; cascade client → article → entreprise |
| **Flexible CO quantity** | Si un MO auto-créé depuis une CO se termine avec une quantité différente, la CO est mise à jour |
| **Materials requisition** | Active le PDF et le CSV de bon de sortie matière, y compris consolidé multi-MO |
| **Several invoices per PO** | Passe de « 1 PO = 1 facture » à « 1 PO = N factures » ; ajoute une section Invoices, et optionnellement une section Deliveries séparée |
| **Separate invoices and deliveries** | Sous-option de la précédente : sépare le flux physique du flux comptable |
| **Update purchase terms from PO** | Met à jour automatiquement le prix de la condition d'achat depuis le PO |
| **MO partial completion** | Réception en stock des produits finis dès qu'on met en pause la dernière opération, au lieu d'attendre la clôture du MO. **Non rétroactif** : un MO existant garde le comportement en vigueur à sa création |
| **Use planned goods** | Autorise la consommation/expédition d'articles au statut Planned ou On hold. Puissant mais **dangereux** : coût initial 0, transactions rétrodatées, historique de stock temporairement faussé (voir §16.3) |
| **Decimal places** | 2 décimales par défaut, jusqu'à 4 pour le prix unitaire CRM/achat. Règle générale : > 0,1 arrondi à 2 décimales, < 0,1 non arrondi jusqu'à 10 décimales |
| **Update currency rates** | Mise à jour nocturne via openexchangerates.org ; exige des codes ISO 4217 à 3 lettres |
| **Standard Accounting module** | Active toute la section comptabilité |

---

## 4. Les moteurs — cœur technique

C'est ici que se joue la différence entre un MRP et un simple CRUD de stocks.

### 4.1 Moteur de réservation (booking) : Tracing ON vs OFF

MRPeasy propose **deux modèles de gestion des stocks mutuellement exclusifs**, contrôlés par un seul
paramètre. C'est une décision de conception forte et intéressante à reproduire.

#### Tracing = OFF (mode « allocation automatique »)

- Les marchandises disponibles sont **redistribuées automatiquement entre les commandes** en arrière-plan,
  à chaque fois que la disponibilité ou la demande change.
- Priorisation : commandes clients **sans** date de livraison d'abord, puis par date de livraison
  croissante ; ordres de fabrication par date de début.
- L'utilisateur ne voit ni ne choisit jamais un lot. La consommation prend le lot selon FIFO.
- Le statut des pièces se calcule sur la disponibilité, pas sur des allocations figées.
- Statuts spécifiques à ce mode : **Not enough** (« après les commandes prioritaires, il n'en restera pas
  assez pour celle-ci »).
- Une CO doit passer au statut **Confirmed** pour générer la demande.

#### Tracing = ON (mode « réservation explicite »)

- Chaque besoin est rattaché à un **lot précis** par un objet Booking.
- Les réservations existantes ne changent que par action manuelle de l'utilisateur.
- On peut réserver des marchandises spécifiques pour une commande donnée, inutilisables ailleurs.
- La consommation ne peut se faire **que depuis le lot réservé**.
- Les lots apparaissent sur les expéditions et peuvent figurer sur les documents de transport.
- Actions groupées : « Book all parts », « Release all booked parts », « Rebook parts for all planned MOs ».
- **Obligatoire pour** : Expiry date, Quality Control, et le rapport Shortages.

**Avertissement officiel :** basculer Tracing déclenche des actions automatiques immédiates ; sauvegarder
la base avant.

**Recommandation pour un MRP custom :** ce choix binaire est judicieux. La plupart des PME n'ont pas besoin
de traçabilité par lot au quotidien et sont écrasées par la charge cognitive du mode ON. Mais l'implémenter
comme un **interrupteur global irréversible en pratique** est un défaut : il vaudrait mieux le rendre
**par famille d'articles** (traçabilité obligatoire sur les matières critiques, automatique sur la
visserie).

### 4.2 Moteur d'ordonnancement à capacité finie

#### Principe

L'ordonnancement prend en compte **toutes** les contraintes de ressources : les autres travaux déjà
planifiés, les temps d'indisponibilité programmés des machines, et — en planification avant seulement —
les délais d'approvisionnement des matières manquantes. Il exige que l'article possède **une nomenclature
et une gamme, reliées entre elles**.

#### Séquence de calcul au lancement d'un MO

1. Calculer un ordonnancement possible **pour chaque nomenclature** de l'article, et pour chaque gamme
   reliée à cette nomenclature.
2. Retenir, par nomenclature, la gamme dont **la date de fin est la plus précoce**.
3. Pour un MO multiniveau : la nomenclature du sous-ensemble est choisie **par ordre alphabétique de son
   numéro**, et la gamme reliée également par ordre alphabétique. *(Règle arbitraire et peu transparente
   — à ne pas reproduire telle quelle.)*
4. Proposer les réservations de matières en FIFO (ou FEFO si les péremptions sont actives). Les matières
   manquantes s'affichent en **rouge italique**.
5. En planification avant, tenir compte du délai d'appro des matières manquantes.
6. Estimer le coût total = matières + frais généraux de fabrication + main-d'œuvre.

#### Planification avant (forward, par défaut)

Le logiciel place le MO **au premier créneau disponible**. Une date de début saisie signifie « pas avant
cette date ». Les délais matière **sont** pris en compte.

**Cas d'incomplétude explicite :** si la disponibilité d'une matière est inconnue (sous-ensemble
indisponible sans nomenclature, ou article acheté sans condition d'achat), le MO est planifié **au plus
tôt en ignorant les délais**, car l'information est incorrecte ou incomplète. *C'est un choix discutable :
un système silencieusement optimiste produit des plans faux. Une alternative saine serait de bloquer et
de signaler.*

#### Planification arrière (backward, Enterprise)

Déclenchée par la saisie d'une **date d'échéance**. Le logiciel cherche le créneau le plus tardif pour
finir juste à temps (idéalement la veille). **Les délais matière sont ignorés** en planification arrière.
Depuis une CO, un paramètre « Buffer (days) » permet de finir N jours avant la date de livraison promise.

#### Calcul de la durée d'une opération

```
Durée = ( Temps de setup + Temps de cycle × Quantité / Capacité du cycle ) / Productivité du poste
```

- Le temps de cycle est **arrondi au cycle complet supérieur** si la quantité du dernier cycle est
  inférieure à la capacité.
- Si `Parallelize` est actif, on divise en plus par le nombre de postes disponibles du groupe.
- Pour une opération **passive**, la durée est **un seul temps de cycle, quelle que soit la quantité**
  (séchage 60 min = 60 min pour 1 ou 1000 pièces).
- Unité minimale d'ordonnancement : **1 minute**. Conséquence sur le chevauchement : si
  `Overlap × Cycle time < 1 min`, l'arrondi à 1 minute peut multiplier la durée par 20. La parade
  officielle est de reparamétrer avec `Cycle time = 1 min` et `Capacity = 1 / cycle réel`.

#### Chevauchement et séquences spéciales

- **Overlap** : l'opération N+1 démarre après N pièces terminées à l'opération N. L'opération est
  découpée en de nombreuses sous-opérations. Recommandations officielles : viser
  `Cycle time × Overlap ≥ 1 min` et un `Overlap` multiple de la `Capacity`. Ne s'applique pas à la
  première opération, et n'empêche **pas** de déclarer le démarrage de l'opération suivante manuellement.
- **Sequence** : liste des opérations qui doivent être terminées avant. `0` = peut démarrer
  immédiatement. Permet des chaînes parallèles, convergentes et divergentes dans une même gamme.

#### Replanification

Cinq voies : glisser-déposer dans le calendrier, glisser-déposer dans le Gantt, retrait/réinsertion du
planning (fonction Unscheduled MO), édition manuelle des dates d'opérations, suppression et recréation.

Différence importante entre les deux modes de glisser-déposer :

| | Calendrier | Gantt |
| --- | --- | --- |
| Surbooking d'un poste | **Interdit** — cherche le prochain créneau libre | **Autorisé au choix** |
| Replanification des opérations suivantes du MO | Automatique | Au choix |
| Vérification de la disponibilité matière | Oui, avec fenêtre de confirmation | **Non** |

**Règle de base :** replanifier un MO **ne replanifie jamais les autres MO**. Il n'y a donc pas de
réordonnancement global automatique. Le manuel argumente d'ailleurs qu'il n'est pas toujours souhaitable
de replanifier — position pragmatique et défendable.

#### Réservation de masse

Le bouton « Rebook parts for all planned MOs » libère toutes les matières des MO en statut Scheduled /
Not scheduled / New, puis les réserve à nouveau en partant du MO le plus précoce. Sert à réaligner la
consommation FIFO après des insertions de MO antérieurs.

### 4.3 Moteur de coût de revient

MRPeasy distingue **quatre niveaux de précision de coût**, du plus exact au plus approximatif :

| Niveau | Définition | Où il est utilisé |
| --- | --- | --- |
| **Coût réel** (actual) | Coût du lot précis. Achat : prix payé + frais additionnels répartis. Fabrication : coût total du MO | Réservations, entrées et sorties de stock, COGS |
| **Coût moyen pondéré** | Moyenne des coûts réels des lots **en stock actuellement** | Colonne Cost dans Stock → Items, page Inventory, estimation de nomenclature si la matière est en stock |
| **Coût approché** | Coût réel des lots utilisé comme base d'estimation d'un produit | Estimation d'une nomenclature, estimation de coût sur une CO |
| **Coût estimé** | Pour un article hors stock. Achat : prix de la **condition d'achat la plus prioritaire** (à priorité égale, le prix le plus bas ; les quantités minimales sont **ignorées**). Fabrication : somme du coût estimé de la nomenclature + de la gamme | Colonne Cost, estimation grossière |

#### Trois composantes du coût de fabrication

```
Coût d'un produit fabriqué = Coût des matières directes
                           + Frais généraux de fabrication appliqués (applied manufacturing overhead)
                           + Coût de la main-d'œuvre directe
```

**Main-d'œuvre :**
```
Estimation : Coût MOD = Durée d'opération × Taux horaire du travailleur + Taux à la pièce × Quantité du MO
Réel      : Coût MOD = Durée déclarée    × Taux horaire du travailleur + Taux à la pièce × Quantité déclarée
```
Le taux horaire est saisi dans la fiche utilisateur et doit inclure charges et taxes.

**Frais généraux :**
```
Si le poste n'a PAS de taux horaire :
   FG = Coût fixe + Coût variable × Quantité + Autre coût variable × Quantité
Si le poste A un taux horaire (prioritaire sur la gamme) :
   FG estimé = Durée × Taux horaire du poste + Autre coût fixe + Autre coût variable × Quantité
   FG réel   = Durée déclarée × Taux horaire du poste + Autre coût fixe + Autre coût variable × Quantité
```

**Matières :**
```
Estimation : Coût matières = Coût des matières réservées + Coût estimé des matières non réservées
Réel       : Coût matières = Coût des matières consommées
Coût matière unitaire = Coût des matières consommées / Nombre de produits de l'ordre
```

#### Répartition des coûts sur les co-produits

```
Coût des N produits principaux = N × p% × Coût_total_MO / (N × p% + M × q%)
Coût des M co-produits         = M × q% × Coût_total_MO / (N × p% + M × q%)
```
où `p%` et `q%` sont les pourcentages d'allocation **unitaires** définis dans la nomenclature.
Pour trouver `q%` : `q = coût unitaire du co-produit / somme des coûts unitaires de tous les produits`.

**Limite :** dans un MO multiniveau, l'allocation de coût aux co-produits ne fonctionne **qu'au premier
niveau**. Les co-produits de sous-ensembles ont un coût de **0**, quel que soit le pourcentage saisi.

#### Répartition des coûts de désassemblage

Identique dans la forme, avec des pourcentages dont la somme doit faire **exactement 100 %**. La quantité
du composant dans la nomenclature de désassemblage **n'intervient pas** dans le calcul du pourcentage.

#### Frais additionnels (landed cost)

Sur un PO, les champs « Taxable fees » et « Additional fees » (transport, douane) sont répartis
proportionnellement au coût de chaque lot cible :
```
Frais par article = Coût de l'article / Coût total du PO × Frais additionnels
```
Même logique sur les ordres de transfert. **La taxe est ignorée** dans le calcul du coût des articles
achetés (elle ne sert qu'au total du PO et au rapport de trésorerie).

#### Coût dans un MO multiniveau — piège majeur

Tous les coûts (composants, MOD, sous-ensembles) sont ajoutés **directement au coût du MO de niveau
supérieur**. Le coût d'un sous-ensemble produit dans le même MO :

- **n'est pas** inclus sur la ligne de total du composant où il est consommé ;
- apparaît sur la ligne inférieure référençant sa source (« Manufacturing Order … ») comme **la somme des
  articles achetés dont il est directement fait** — hors coûts de ses propres sous-ensembles.

De plus, dans les rapports Production planning → Statistics, les composantes matières/frais généraux/MOD
ne sont **pas « pures »** : le coût total d'un composant fabriqué dans un autre MO est comptabilisé
intégralement comme « coût matière » du MO consommateur. En revanche, dans CRM → Statistics, les
composantes **sont** pures (décomposées récursivement). Deux rapports, deux conventions : source classique
de confusion.

#### Cas où le coût ne peut pas être estimé

- Article acheté sans condition d'achat.
- Article fabriqué sans nomenclature ni gamme.
- Coût d'un composant inconnu.
- Matrix BOM utilisé dans la nomenclature.
- Plus de 1000 nomenclatures ou gammes dans la base (calcul de masse abandonné).

### 4.4 Moteur de traçabilité

- Chaque achat crée un lot unique ; chaque production crée un lot unique.
- Le système propose automatiquement le lot source (FIFO, ou FEFO si péremption).
- Aucun sur-booking possible.
- L'atelier voit quels lots prendre, dans quelles quantités, à quels emplacements.
- Rapports par lot : **Stock history** (mouvements), **Bookings**, **Movements** (entre emplacements),
  **Engagement** (« quels lots contiennent des articles de ce lot » — traçabilité **aval**),
  **Content** (« de quels lots ce lot est fait » — traçabilité **amont**, y compris les lots des
  sous-ensembles).

La paire Engagement/Content est le mécanisme de rappel produit. C'est bien conçu et à reprendre.

**Nuance importante à connaître :** un lot **n'est pas** un numéro de lot fabricant. Deux livraisons du
même lot fournisseur créent deux lots MRPeasy. Deux contournements officiels : encoder le n° fabricant en
suffixe du n° de lot, ou utiliser un champ personnalisé (persistant si l'on veut qu'il survive aux
transferts entre sites).

### 4.5 Moteur de propagation des statuts

Les statuts « produit » d'une CO se calculent à partir des dates des documents amont :

| Statut | Condition |
| --- | --- |
| **Possibly delayed** | Date de fin du MO = date de livraison de la CO, **ou** date attendue du PO = date de livraison, **ou** date de livraison = aujourd'hui et produits non reçus |
| **Delayed** | Date de fin du MO > date de livraison, **ou** date attendue du PO > date de livraison, **ou** date de livraison passée et produits non reçus |

Recalcul : lors de toute action manuelle sur CO/MO/PO, **et** automatiquement une fois par jour entre 1 h
et 3 h du matin. Le suspenseur automatique des opérations non mises en pause tourne dans la même fenêtre.

### 4.6 Calcul de l'OEE / TEEP

```
OEE = Disponibilité × Performance × Qualité

Disponibilité = temps de marche déclaré / temps planifié          (plafonné à 100 % dans l'OEE)
Performance   = (pièces produites × temps de cycle de la gamme) / temps de marche déclaré   (plafonné à 100 %)
Qualité       = pièces approuvées / pièces produites  (= 100 % si Quality Control désactivé)

TEEP = temps total planifié / (horizon en jours × 24 × 60) × OEE
```

Une valeur > 100 % est affichée en rouge : c'est un signal que la gamme doit être recalibrée (temps de
cycle trop long ou trop court). Calcul en temps réel ; recalcul historique possible sur **1 mois maximum**.

### 4.7 Suivi du temps atelier

- L'opérateur déclare Start / Pause / Finish ; les horodatages des clics font foi.
- Si une opération n'est pas mise en pause en fin de journée, le système la met en pause automatiquement
  **entre 1 h et 3 h du matin**, en fixant l'heure de fin à la fin de la journée de travail.
- Si l'opérateur met en pause ou termine après les heures, **tout le temps écoulé est compté**.
- Si une opération traverse la nuit et se termine le lendemain pendant les heures ouvrées, **les heures
  non ouvrées sont exclues**.
- Une opération n'est **pas** mise en pause automatiquement s'il n'y a pas de coupure entre deux journées
  de travail (cas des horaires 00:00–23:59 pour du 3×8).

---

## 5. Module STOCK (magasinier)

### 5.1 Stock → Items

Vue centrale de l'inventaire. **Onze colonnes quantitatives** dont il faut comprendre la sémantique exacte :

| Colonne | Définition |
| --- | --- |
| **In stock** | Quantité physiquement présente. `In stock = Available + Booked + Rejected + (Expired − Booked from expired)` |
| **Available** | En stock et non réservé. Affiché en **rouge** sous le point de commande. **Peut devenir négatif** quand la demande dépasse l'offre. `Available = In stock − Booked − Rejected − (Expired − Booked from expired)` |
| **Booked** | Réservé **plus** ce qui est demandé sans être réservé. Cliquer affiche les bookings |
| **Expected, Total** | Attendu (PO/MO), moins ce qui a déjà été déclaré consommé (possible si « Use planned goods »). Inclut les articles reçus mais en attente d'inspection |
| **Expected, Available** | `Expected Total − Expected Booked` |
| **Expected, Booked** | Attendu et déjà réservé |
| **Work in progress** | Consommé dans des MO encore en cours. **Sorti de l'inventaire**, pas encore en produits finis |
| **Virtual stock** | Combien de ce produit on pourrait fabriquer avec le stock actuel de composants. Calculé **à la volée**, non persisté, sans effet sur les autres calculs |
| **Packaged** | Quantité conditionnée (fonction Packing) |
| **Expired** | Quantité périmée (fonction Expiry) |
| **Rejected** | Quantité rejetée au contrôle qualité (fonction QC) |

Déclenchement du rapport « Critical on-hand » : `Available + Expected Available < Reorder Point`.
**Un point de commande vide n'est pas équivalent à zéro** : un article sans ROP n'apparaît jamais dans le
rapport, même à stock négatif. Il faut saisir explicitement `0`.

Autres fonctions de l'écran : impression d'étiquettes et de codes-barres, édition en masse (100 lignes
max), import CSV (3000 lignes max), rapports par article, restauration d'articles archivés (recherche
du suffixe `del`).

### 5.2 Rapports par article

| Rapport | Contenu |
| --- | --- |
| **Stock history** | Niveaux historiques en graphique + mouvements et solde détaillés en tableau |
| **Bookings** | MO et CO où l'article est réservé ; éditable |
| **Expected lots** | Lots à venir et leur source (PO/MO) |
| **Manufacturing orders** | MO fabriqués + graphique du coût de fabrication unitaire (articles fabriqués seulement) |
| **Purchases** | Achats + graphique du prix d'achat historique (articles achetés seulement) |
| **Engagement** | Rapport « où utilisé » : nomenclatures contenant cet article. Les quantités multi-niveaux sont **sommées et affichées au niveau le plus bas**. Pour un Matrix BOM, seule la référence est affichée avec quantité **0** |
| **Relations** | Relations contenant cet article |
| **Serial numbers** | Tous les numéros de série de cet article |

### 5.3 Stock → Stock lots

Liste de tous les lots, actuels, attendus et historiques. **Les lots épuisés sont masqués par défaut**
(filtrer sur quantité totale = 0 pour les retrouver).

Fonctions : édition et changement de statut, impression d'étiquettes (deux variantes : lot entier, ou
par emplacement de stockage), déplacement d'articles entre emplacements (unitaire ou en masse jusqu'à
100 lignes), pièces jointes (certificats de conformité, bons de livraison), gestion des numéros de série,
création d'un ordre de service pour un lot rejeté, import CSV.

Si l'emplacement n'est pas défini à la création d'un lot : emplacement par défaut de l'article, sinon
premier emplacement de la liste (l'emplacement générique « indéfini », renommable dans les paramètres
régionaux).

### 5.4 Stock → Shipments

Une expédition peut être créée depuis quatre endroits : détail d'une CO, la liste Stock → Shipments,
détail d'un PO de sous-traitance (émission de matières au sous-traitant), détail d'un RMA.

**Préalable obligatoire quand Tracing est actif :** les produits doivent d'abord être réservés sur la
commande concernée.

Déclaration de sortie : bouton « Pick » ligne par ligne, ou « Pick all items ». Avec numéros de série, un
écran de sélection s'ouvre ; le collage en masse depuis un tableur n'est possible qu'avec « Pick »
individuel, pas avec « Pick all items ».

Documents produits : **Waybill** (bon de transport), **Picking list** (liste de prélèvement),
**Packing list** (liste de colisage), étiquettes d'expédition, étiquettes de colis.

Procédure officielle de correction d'une expédition depuis le mauvais lot (7 à 10 étapes selon les cas) :
annuler le prélèvement en saisissant une quantité **négative**, réduire la réservation, ouvrir le rapport
Bookings de la CO, cliquer « Return to stock » sur le lot, ajouter le bon lot, refaire l'expédition.
**C'est le meilleur exemple de la dette d'ergonomie du produit.**

### 5.5 Stock → Transfer Orders (fonction Multi-Stock)

Trois étapes : planification (création, choix des produits, impression du bon de transport et de la liste
de prélèvement), expédition (Pick), réception (passage manuel au statut Received).

Statuts : New, Ready for shipment, Shipped, Received (**manuel**), Cancelled.

Frais de transport dans le champ « Additional fees », répartis proportionnellement au coût de chaque lot
cible. Import CSV possible (100 lignes max, colonnes : n° de pièce obligatoire, quantité, lot, emplacement).

**Contrainte technique :** impossible de conserver le même numéro de lot après un transfert ; un nouveau
lot cible est créé. Parade : champ personnalisé « persistant ». Les dates de péremption, elles, sont
copiées et restent synchronisées avec le lot source.

### 5.6 Stock → Inventory

Vue des niveaux d'inventaire actuels **et historiques**, et outil d'ajustement après comptage.

**Le manuel entoure cet écran de six avertissements** — c'est révélateur du risque :
sauvegarder avant, ne pas l'utiliser au quotidien, enquêter avant d'ajuster, et surtout **restreindre le
droit Update à un seul utilisateur** (typiquement un membre de la direction).

Logique d'ajustement :
- Quantité supérieure → **création d'un nouveau lot**, au coût unitaire du dernier lot du même article
  (par date de disponibilité) ; sinon prix du fournisseur prioritaire ; sinon demande de saisie manuelle.
- Quantité inférieure → **création d'une radiation** depuis les lots Received en FIFO/FEFO. Le système
  essaie d'abord les articles disponibles ; s'il en manque, il **annule des réservations en LIFO** jusqu'à
  pouvoir écrire la radiation.

Trois voies alternatives d'ajustement, avec des compromis différents : Stock → Inventory (automatique),
Stock → Stock lots (création manuelle d'un lot avec tous les paramètres), Stock → Write-offs (radiation
avec code de motif).

**WIP :** les colonnes « WIP quantity » et « WIP cost » ne sont **pas** incluses dans le solde d'inventaire.

**Historique faussé — piège documenté :** avec « Use planned goods = Yes », une consommation antérieure à
la réception est enregistrée mais **masquée de l'historique** jusqu'à la réception effective. À la
réception, toutes les transactions sont écrites d'un coup, ce qui produit des soldes historiques faux — et
potentiellement **négatifs** — entre la date de consommation et la date de réception. Le manuel fournit un
tableau chronologique complet de ce phénomène. Parades : saisir en temps réel, rétrodater correctement la
date d'arrivée du PO (la consommation, elle, **ne peut pas** être rétrodatée), ou désactiver « Use planned
goods ».

### 5.7 Stock → Critical on-hand, Write-offs, Stock movement

**Critical on-hand :** liste des articles achetés **et** fabriqués sous leur ROP. Deux boutons d'action :
créer un PO (regroupe automatiquement tous les articles sous seuil du même fournisseur, pré-remplit prix,
quantité minimale et date attendue) ou créer un MO (quantité calculée pour remonter au ROP). Dans les deux
cas, à l'enregistrement, les articles sont **automatiquement réservés là où la demande existait** (FIFO).

**Write-offs :** radiations manuelles. Sélection article, notes, **type de radiation** (max 25 types
personnalisés : développement produit, cadeaux partenaires, casse…), puis quantité par lot, les lots étant
triés par statut (Received avant Planned), puis péremption, puis date de disponibilité. Numéros de série
sélectionnables.

**Stock movement :** rapport financier de mouvement de stock sur une période.

```
Ending = Beginning + Inward − Outward

Inward  = Purchases + Adjustments + Manufactured
          où Manufactured = Coût des matières + Frais généraux appliqués + Coût MOD
Outward = Sales + Write-offs (ventilées par type) + Used in manufacturing
```
Les lignes **Beginning WIP** et **Ending WIP** (matières engagées dans des MO en cours aux bornes de la
période) sont affichées mais **exclues** des soldes. Chaque nombre est cliquable vers le détail, avec
bascule « ligne par ligne » / « somme par article ».

### 5.8 Stock settings

- **Product groups** : regroupement logique **et** porteur du compte d'inventaire comptable. Conseil
  officiel : structurer les codes pour permettre le filtrage par préfixe (`5000*` = tous les emballages).
  Changer le compte d'un groupe **n'est pas rétroactif** : il faut passer une écriture manuelle.
- **Units of measurement** : unité principale + **conversions internes** (kg→g, m→km, lb→oz) utilisables
  en nomenclature et en MO. Distinct des unités fournisseur, définies dans les conditions d'achat.
- **Storage locations** : bacs/étagères/zones dans un site. L'emplacement n°1 (en italique) est
  l'emplacement générique « indéfini » et **ne peut pas être supprimé**. Import CSV, étiquettes.
- **Parameters** et **Relations** : socle du Matrix BOM (voir §6.4).

### 5.9 Stock → Serial numbers

Statuts : Planned, Received, Consumed, Shipped, Written off, Rejected, RMA, Returned — assignés
automatiquement.

Saisie : au clavier, par scan de code-barres, ou par **collage en masse depuis un tableur** (le logiciel
répartit une colonne collée sur les champs). Par blocs de **100 maximum**.

Contraintes de clôture d'un MO avec numéros de série :
- MO normal : les n° de série des **produits** sont obligatoires avant clôture ; ceux des composants
  peuvent rester non déclarés.
- MO de désassemblage : n° de série des **composants et des produits** obligatoires.
- MO d'auto-assemblage (kit) / auto-désassemblage : **pas de clôture automatique** si des n° de série sont
  requis ; clôture manuelle obligatoire.
- Sous-ensemble imbriqué dans un MO multiniveau : impossible d'assigner un n° de série normalement ; il
  faut le créer **au moment de la déclaration**, en indiquant quel composant sérialisé est entré dans quel
  produit sérialisé.

### 5.10 Stock → Statistics

Rapport **Stock aging** : articles non utilisés depuis N jours (60 par défaut), avec intervalles
paramétrables (0-30, 30-60, 60-90, 90-120, 120+).

---

## 6. Module PRODUCTION PLANNING (planificateur)

### 6.1 Manufacturing Orders

**Création d'un MO :** choix du produit, quantité, éventuellement date de début (planification avant) ou
date d'échéance (planification arrière), choix de la nomenclature, options « ne pas réserver les postes » /
« ne pas réserver les matières » (fonction Unscheduled MO).

Un bouton « View/Edit » sur la ligne de nomenclature ouvre une page de simulation complète : disponibilité
détaillée des matières, planning détaillé des opérations, coûts estimés détaillés, choix explicite de la
gamme, édition des réservations proposées, ajout d'opérateurs supplémentaires.

**Quantité minimale de fabrication :** à la création manuelle, une quantité inférieure surligne le champ
mais **l'enregistrement reste autorisé**. À la création automatique depuis une CO, la quantité est
**relevée automatiquement** au minimum, avec une note ajoutée au MO.

**Changement de quantité :**
- Avant démarrage : matières et opérations entièrement recalculées, réservation automatique,
  replanification. Si la quantité baisse, l'heure de début est conservée. Si elle augmente sans date
  d'échéance, le MO **peut avancer dans le temps** ; avec date d'échéance et planification arrière, la
  fin est conservée.
- Après démarrage : **seule la quantité du lot cible est mise à jour** ; matières et opérations ne bougent
  pas.

**Clôture :** trois voies. (a) Atelier : terminer toutes les opérations puis « Finish production » ;
(b) Internet-kiosk : la clôture est **automatique** à la fin de la dernière opération ;
(c) Manager : bouton **« Finish production as planned »**, qui marque le MO terminé même sans déclaration,
consomme toutes les matières réservées (avec un drapeau « Important notice » si des matières manquaient),
et **réécrit les dates** : opérations passées marquées selon leur estimation, opérations futures
rétro-planifiées depuis l'instant du clic.

**Retour en production :** bouton « Return to production », visible **uniquement** pour les utilisateurs
ayant le droit « Lock handler ».

**Réservation et ajout de matières :** boutons « Add a booking », « Increase booking », « Return to
stock », « Book all parts », « Release all booked parts ». Une matière entièrement réservée doit d'abord
être libérée avant d'être retirée.

**MO multiniveau :** quand un sous-ensemble n'est pas en stock, MRPeasy **imbrique automatiquement** sa
production dans le même MO. Trois exceptions : article marqué `Standalone MO`, produit du MO qui est un kit
(auto-assemblage), et matériel d'emballage (fonction Packing) possédant une nomenclature.

Tri des sous-ensembles et des opérations dans un MO multiniveau : d'abord par **niveau décroissant** de
nomenclature (les niveaux les plus profonds d'abord — c'est l'ordre d'ordonnancement), puis par numéro de
séquence croissant à ce niveau. Le numéro de séquence `28.1.3.13` correspond au niveau 4, séquence 13.

**Surproduction de sous-ensembles :** tous les sous-ensembles produits dans un MO multiniveau sont
considérés comme consommés dans le produit fini. Trois contournements : créer le MO du sous-ensemble à
l'avance, créer un MO séparé pour l'excédent, ou utiliser la fonction Co-product BOM.

**Documents imprimables :** PDF du MO en 4 variantes (wide, medium, narrow, et depuis My production plan),
bon de sortie matière (PDF et CSV, individuel ou consolidé multi-MO), étiquette de MO, avec codes-barres
(MO, sous-ensemble, opération) si la fonction Barcode est active. Impression groupée depuis la liste des MO
ou depuis une CO (bouton « MO PDFs »).

### 6.2 Service Orders

Un ordre de service est un **MO spécial** de réparation ou de maintenance. Il apparaît normalement dans le
planning de production. Il ne peut être créé que depuis deux endroits : le détail d'un lot rejeté au
contrôle qualité, ou le détail d'un ordre RMA.

Particularité : les opérations d'un ordre de service ne peuvent utiliser que des groupes de postes de type
**Active processing**. La planification de capacité automatique ne fonctionne que si matières et opérations
sont saisies **à la création** ; si l'opérateur les ajoute en cours de route, il n'y a pas
d'ordonnancement.

### 6.3 Production Schedule

Deux vues : **calendrier** (bascule MO / opérations) et **Gantt** (bascule MO / charge des postes).
Zoom par clic sur un mois ou un jour dans l'en-tête du Gantt.

Code couleur du **fond** : non démarré / en cours / en pause / terminé / (hachuré rouge) en retard.
Code couleur du **texte** : statut de disponibilité des pièces (Not booked, Requested, Delayed, Expected,
Received). Ce double codage sur un même bloc est efficace et à reprendre.

### 6.4 Bills of Materials et Routings

Écrans dédiés en plus de l'accès depuis la fiche article. Fonctions propres :

- **Import CSV** de nomenclatures, y compris **multiniveaux** (chaque sous-ensemble est un article avec sa
  propre nomenclature ; l'imbrication se fait en utilisant le sous-ensemble comme composant du niveau
  supérieur). 3000 lignes max.
- **Substitute a part** : remplacement / suppression / ajout d'un composant **dans toutes les
  nomenclactures filtrées**. Opération potentiellement irréversible — sauvegarde conseillée.
- **Export CSV** réimportable (sauf Matrix BOM).
- **Mise à jour des MO existants** : à l'enregistrement d'une nomenclature ou d'une gamme modifiée, le
  logiciel liste les MO concernés et propose de les recalculer. Trois blocages : MO déjà démarrés, MO avec
  numéros de série déclarés, MO avec des PO de sous-traitance créés.
- **Révisions** (fonction VCS) : chaque enregistrement crée une version ; liste des versions avec date,
  notes et auteur ; restauration ; PDF d'une version antérieure ; recherche par numéro, date, nom, auteur.

**Distinction engineering BOM / manufacturing BOM.** Le manuel consacre une section entière à expliquer
que la nomenclature de production n'est pas la nomenclature d'ingénierie : elle intègre les pertes
(1 m de bâton consomme 1,2 m), les substituts réellement employés à l'atelier, et **simplifie la structure
d'assemblage**, souvent jusqu'à un seul niveau. C'est une position pédagogique juste et rarement énoncée.

**Nomenclature fantôme (phantom BOM).** Un article qui possède une nomenclature, **pas** de gamme, et
n'est pas marqué comme acheté, est traité comme une collection de pièces : dans un MO multiniveau, ses
composants sont tirés directement, sans opération d'assemblage. Mais si on lance un MO **pour lui seul**,
il est traité comme un kit auto-assemblé.

### 6.5 Workstations et Workstation Groups

Un poste est un endroit où **une seule opération à la fois** peut être exécutée : il définit la capacité.
Un groupe rassemble des postes interchangeables ; la gamme désigne toujours un **groupe**, jamais un poste.
L'affectation à un poste précis est faite par l'ordonnanceur.

Conseil officiel remarquable : quand une zone contient des dizaines d'outils (menuiserie), **ne pas
modéliser chaque machine**. Le groupe est la zone, et le nombre de postes du groupe est **le nombre moyen
d'opérations simultanées possibles**, généralement égal au nombre moyen quotidien d'opérateurs présents.

**Priorités de résolution (à retenir) :**
1. Taux horaire : poste > gamme.
2. Opérateur par défaut : poste > gamme > créateur du MO.
3. Coût MOD : lors de l'estimation, taux du département ; lors du calcul réel, taux de **l'utilisateur**.

Rapports par poste : Calendar, Production operations, Equipment usage chart, OEE, Maintenance.
Rapports sur tous les postes : Calendar (coloré par poste), All production operations (1 mois max),
**Execution** (opérations en cours ou en pause en temps réel), **MOs ready for operation** (files d'attente
par groupe de postes ou par sous-traitant), Equipment usage, OEE.

### 6.6 MPS — Master Production Schedule (Enterprise)

Trois vues articulées, période hebdo/mensuelle/trimestrielle, horizon jusqu'à **5 ans**, données
auto-sauvegardées.

**Vue MPS** (6 lignes par produit) :
```
Stock final = Stock initial − MAX(Prévision de ventes, Commandes fermes)
                            + MAX(Plan de production, Déjà ordonnancé)

Période courante : Stock final = Stock initial − Commandes fermes + MO ordonnancés
                   (la prévision et le plan de production sont ignorés)
```
- *Commandes fermes* : CO confirmées dont la date de livraison tombe dans la période ; la période courante
  inclut les CO en retard non livrées. Statuts retenus : Confirmed, Waiting for production, In production,
  Ready for shipment.
- *Déjà ordonnancé* : MO en statuts New, Scheduled, In progress ; la période courante inclut les MO en
  retard.
- Code couleur du stock final : **vert** ≥ ROP, **jaune** entre 0 et ROP, **orange** négatif.
- Le plan de production est surligné en orange s'il diffère de la quantité déjà ordonnancée.

**Vue Required Capacity** (2 lignes par groupe de postes) :
```
Capacité totale = heures hebdo du groupe × nombre de postes, arrondi à l'heure inférieure
                  (temps d'indisponibilité ignorés ; surchargeable manuellement → affiché en rouge)
Heures requises = Σ (heures de gamme × plan de production de la période), arrondi à l'heure supérieure
                  (temps de setup ignoré ; « Déjà ordonnancé » ignoré, pour permettre les simulations)
```
Code couleur : bleu clair sous la charge minimale, vert clair entre min et max, orange au-dessus.

**Vue Procurement Schedule** (5 lignes par composant) :
```
Demande par MPS = Σ [ quantité de la nomenclature × MAX(Plan de production, Déjà ordonnancé) ]
                  (période courante : seulement les MO ordonnancés)
Stock final = Stock initial − Demande par MPS + MAX(Quantité planifiée, Quantité commandée)
```

**Traitement des nomenclatures multiniveaux :** les sous-ensembles sont automatiquement pris en compte via
le produit de tête ; les ajouter séparément **crée des doublons de capacité et de matière**. Exception :
un kit ajouté comme produit de tête ne déclenche **pas** la prise en compte multiniveau ; il faut ajouter
les sous-ensembles séparément.

**Limites documentées :** les produits paramétriques ne sont que partiellement pris en charge — les
numéros de variation uniques sont obligatoires, les paramètres qui modifient les quantités sont supportés,
mais **les nomenclatures utilisant des relations sont exclues du calcul de besoin matière**.

### 6.7 Sales Forecasting (Enterprise)

Prévision de demande assistée par IA à partir de l'historique des commandes clients (quantités commandées
et dates de livraison ; les statuts Quotation et Cancelled sont exclus).

- Création en 2 étapes : nom + premier mois (jusqu'à 2 ans dans le futur) + horizon (3, 6, **12** ou
  18 mois) → sélection des produits.
- Bouton « Run forecast » : remplace les valeurs vides et les valeurs précédemment générées par l'IA ;
  **ne touche jamais aux valeurs saisies manuellement**. Bon design.
- Minimum **3 mois** de données historiques non vides, sinon indicateur gris « Not enough historical data ».
- Deux vues du tableau de saisie : **General** (ligne prévision seule) et **Detailed** (+ ligne réel,
  + même mois de l'année précédente, + variation annuelle en %).
- Section synthèse : total prévisionnel par période groupée, « Estimated year total » (réel écoulé +
  prévision restante) en regroupement par année civile, variation vs période précédente en absolu et en %,
  graphique historique + prévision.
- Liaison au MPS : la ligne « Sales forecast » du MPS se remplit depuis la prévision ; **toute
  modification manuelle d'une valeur dans le MPS délie la prévision**.
- Limites : **100 produits** par prévision, **20 produits** ajoutés à la fois.

### 6.8 Production planning → Statistics

| Rapport | Contenu |
| --- | --- |
| **Costs by manufacturing order** | Coût total, unitaire, matières/frais généraux/MOD (non purs), **dépassement de coût** (estimé vs réel, pour les MO terminés), CO liées, montant de vente |
| **Costs by product** | Même chose agrégée par produit |
| **Manufacturing efficiency** | Réel vs planifié : durée, coût total, coût unitaire, matières, frais généraux, MOD. Inclut les MO actifs **et** ceux terminés dans la période |
| **Shortages** | Composants non réservés ou en retard (exige Tracing). Colonnes : MO, dates début/échéance, article, quantité, statut, **source** (le PO/MO qui livrera), date de disponibilité, lot |
| **Revenue and profit by MO** | Seulement les MO dont des produits ont été vendus. `Profit = (Revenu unitaire moyen − Coût unitaire) × Quantité vendue` |

**Règle temporelle importante :** les valeurs planifiées sont figées **au démarrage du MO**, pas à sa
création. Tout ce qui change avant le démarrage est considéré comme planifié.

---

## 7. Module PRODUCTION REPORTING (atelier)

Deux interfaces alternatives, un même modèle sous-jacent.

### 7.1 My production plan (poste fixe / grande tablette)

Vue calendaire personnelle : opérations assignées à l'utilisateur **ou aux départements dont il fait
partie**. Même double code couleur que le planning.

Actions : Start / Pause / Finish (les horodatages des clics font foi) ; saisie de la quantité réalisée
depuis le dernier Start ; saisie des co-produits ; cases à cocher des sous-tâches (avec horodatage,
nom d'utilisateur et note libre, annulables) ; consommation matière ligne par ligne (bouton **Consume**,
quantité **négative** pour annuler) ou en masse (**Consume parts for end-products** :
`Quantité consommée = Quantité saisie × Quantité réservée / Quantité planifiée du MO`) ; ajout d'une
matière hors nomenclature ; réservation depuis un lot précis ; déclaration des numéros de série.

**Opérations sur poste passif :** le bouton Start demande combien de pièces **entrent** dans l'opération ;
Finish enregistre l'heure de fin. Après la fin, un bouton Start réapparaît sur fond jaune pour renvoyer
cette quantité en traitement (ce qui efface l'heure de fin réelle).

**Clôture du MO :** terminer toutes les opérations, puis « Finish production ». Si des matières réservées
n'ont pas été consommées, deux options sont proposées : **Consume all** ou **Release unused** (les
réservations sont annulées et une note documentant l'écart planifié/déclaré est ajoutée au MO).
Un opérateur **ne peut pas** clôturer un MO qui ne lui est pas entièrement assigné.

### 7.2 Internet-kiosk (téléphone / tablette)

Version simplifiée. Principe : l'opérateur prend l'opération **la plus haute** de la liste (tri par heure
de début, puis par numéro d'opération dans le MO ; les opérations terminées de MO non clos passent en bas).

Différences comportementales majeures avec My production plan :
- **La clôture du MO est automatique** à la fin de la dernière opération : toutes les matières réservées
  sont consommées, les produits entrent en stock, et des notes sont ajoutées si les besoins matière ou la
  quantité finale diffèrent du plan.
- **Toutes les matières sont marquées consommées automatiquement après la première opération.** La
  déclaration matière manuelle exige My production plan.
- **Les opérations sur postes passifs ne sont pas déclarables** depuis le kiosque.
- Mode **Advanced** (paramétrable) : ajoute la vue des matières, l'accès aux fichiers joints, la
  déclaration des numéros de série (composants et produits).
- **Multi-utilisateurs sur un même appareil** : plusieurs sessions simultanées, bascule par survol du nom
  d'utilisateur en haut à droite, déconnexion de tous à la fermeture du navigateur.

Champs affichables configurables dans l'éditeur de kiosque : MO, produit, quantité restante, opération,
poste, heure planifiée, commande client, client, date d'échéance, champs personnalisés. Visibilité des
opérations : « toutes celles assignées » ou « prêtes à exécuter » (uniquement après clôture des
précédentes).

### 7.3 Départements — planification par compétence

Un département est un groupe d'opérateurs interchangeables. Un utilisateur peut appartenir à plusieurs
départements, ce qui compose **une matrice de compétences implicite**.

Mécanisme : on assigne une **opération à un département** plutôt qu'à une personne. Tous les membres la
voient. Dès qu'un opérateur la démarre, elle lui est attribuée et **disparaît de la vue des autres**. Si
plusieurs opérateurs sont requis, elle reste visible jusqu'à ce que le compte soit atteint.
C'est un mécanisme de « pull » simple et efficace, à reprendre.

**Human resources planning :** tableau du nombre **maximum d'opérations parallèles** assignées à chaque
département chaque jour — c'est-à-dire le nombre de personnes nécessaires pour tenir le plan.

**Doctrine d'ordonnancement de MRPeasy, explicitée :**
1. Disponibilité **matière** (non négociable),
2. Capacité des **postes** (actifs coûteux, à charger au maximum),
3. Disponibilité des **opérateurs** (la ressource la plus flexible : négociation, réaffectation, heures
   supplémentaires).

Le manuel argumente explicitement contre la tentation de planifier les opérateurs comme des postes, qui
dégraderait le taux de charge machine et donc les délais. **Position défendable et à documenter dans tout
MRP custom.**

---

## 8. Module CRM (ventes)

### 8.1 Customer Orders

Deux vues : liste et **pipeline de vente** (kanban par statut). Bascule d'onglet « Customer orders » /
« Items » pour voir toutes les lignes de produits à plat.

**Cycle de vie type :** créer la CO → émettre un devis ou une confirmation de commande → estimer coûts et
dates → passer au statut Confirmed et réserver les produits → planifier une expédition et prélever →
facturer et encaisser.

*Note d'ergonomie :* « le PDF de la commande client n'est pas un document destiné au client, c'est un
document interne ». Les documents clients sont les factures, devis et confirmations, créés dans une
sous-section distincte.

**« Estimate costs and dates ».** Fonction de chiffrage remarquable : elle **simule** l'exécution complète
de la commande.
- Choix de la source du coût : *From stock* (considère d'abord le stock disponible en FIFO/FEFO, puis
  simule fabrication et achat pour le manquant) ou *From vendor* (ignore le stock, simule tout).
- Saisie d'une **marge** pour calculer le prix de vente.
- Sortie : prix de vente et **date de fin de production au plus tôt** par ligne, avec un détail cliquable
  ventilant matières / frais généraux / MOD.
- Un même article peut apparaître plusieurs fois à des coûts différents, la source du coût étant
  différente selon la quantité.
- Si les articles sont **déjà réservés**, le coût réel du lot est utilisé et le choix de source est ignoré.

**Réservation des produits (« Check stock and book items »).** Quatre stratégies :
1. *Book all items* : réserve tout le disponible (stock et attendu), en FIFO/FEFO.
2. *+ Create MOs for missing products* : crée **un MO par ligne de CO** (relation 1↔1). Choix de la
   nomenclature par ordre alphabétique, gamme à date de fin la plus précoce, planification arrière si
   activée, quantité relevée au minimum de fabrication si nécessaire. Si le produit n'est pas acheté, n'a
   pas de nomenclature, mais figure dans une nomenclature de désassemblage, **un MO de désassemblage est
   créé**.
3. *+ Create POs for missing parts* : crée aussi les achats, y compris les matières des MO qui viennent
   d'être créés.
4. *Book manually* : sélection lot par lot, avec possibilité de créer à la volée un PO, un MO ou un lot
   manuel.

Il existe une cinquième voie, la **création de demande** : réserver sans créer d'ordres rend simplement la
quantité disponible **négative**, et les articles apparaissent dans Critical on-hand et Requirements, où
l'acheteur et le planificateur peuvent consolider **plusieurs CO dans un seul MO ou PO**.

**Annulation et modification de réservations :** Cancel bookings ligne à ligne ou global. Si une partie est
déjà expédiée, il faut soit changer la quantité de la CO, soit modifier les bookings dans le rapport
Bookings.

**Import CSV de lignes** : 200 lignes max, colonnes n° de pièce (obligatoire), quantité, prix unitaire,
remise %, texte libre, date de livraison.

**Rapports par CO :** Bookings, Raw materials (toutes les matières employées pour cette commande),
Missing parts, Serial numbers expédiés.

### 8.2 Customers

- Contacts typés (téléphone, fax, Teams, courriel, web, adresse), une ligne par type.
- Adresses **structurées ou en texte libre** — mais l'intégration ShipStation exige des adresses
  structurées avec code postal valide.
- **Plusieurs adresses de livraison** ; la sélection se fait sur la CO et sur l'expédition, les adresses de
  livraison étant listées avant l'adresse de facturation.
- **Langue** des documents par client (défaut : langue d'inscription).
- **Délai de paiement** calculé soit depuis la date de facture, soit depuis la fin du mois de facturation.
- **Limite de crédit** : contrôle à l'enregistrement d'une facture, avec notification si dépassement.
  `Crédit disponible = Limite − Σ factures impayées` (hors factures Dummy). Champ vide = crédit illimité.
- **Statuts clients** renommables (défaut : No contact, No interest, Interested, Permanent buyer). Peuvent
  représenter des étapes de vente, des types de clients ou une classification ABC.
- **Next contact date** → alimente l'écran « Today's contacts ».

Rapports par client : Invoices, Customer orders (avec graphique et Gantt), Manufacturing orders, Products,
Raw materials. Rapports globaux : Bookings, **Execution** (état de production des produits commandés),
**Deliveries** (produits à expédier dans les 5 prochains jours, groupés par jour et par client, rafraîchi
chaque minute, **accessible par un lien direct sans authentification** — pensé pour un écran mural
d'atelier).

### 8.3 Invoices

Six types de documents : **Invoice**, **Credit-invoice**, **Prepayment invoice**, **Quotation**,
**Pro-forma invoice**, **Order confirmation**. Le type ne peut plus être changé après coup pour les types
invoice / prepayment / credit — il faut copier le document.

Statuts : **Dummy** (brouillon, ignoré en comptabilité et en statistiques), Unpaid, Paid partially, Paid,
Cancelled. Code couleur : jaune si échéance non dépassée, **rouge si dépassée**, vert si payé, incolore
si échéance non définie.

**Facturation consolidée multi-commandes** (fonctionnalité solide) : trois voies (champ « Customer order »
en en-tête, colonne « Order » par ligne, ou depuis une expédition). Contraintes : même devise obligatoire ;
des clients différents sont possibles (le client affiché est celui de la première commande) ; le type
Prepayment devient indisponible ; un paiement partiel est **alloué aux commandes par ordre d'échéance
croissante**.

**Acomptes :** la facture d'acompte crédite un compte de passif « Customer prepayments », **pas** le
compte de produits. L'allocation à la facture finale débite Customer prepayments et crédite Sales. Le
remboursement passe par un avoir.

### 8.4 Pricelists (Tiered Pricing)

Une liste de prix = numéro, nom, liste d'articles avec prix. Une liste par défaut peut être affectée à un
client. **Les prix d'une liste sont prioritaires sur le prix de vente de la fiche article.**

Paliers de prix par quantité : saisir plusieurs prix avec une quantité minimale ; le bon palier est
sélectionné automatiquement à la saisie d'une CO ou d'une facture.

Depuis la fiche article, on voit et met à jour le prix de cet article **dans toutes les listes** — vider un
prix retire l'article de la liste. Limite : 300 produits éditables à l'écran ; au-delà, import CSV.

### 8.5 Customer Returns / RMA (Enterprise)

**Sept types de retour** (assignables a priori ou après inspection) :
Credit only (remboursement sans retour physique) · Repair · Repair and ship back · Replacement ·
Receipt and credit · Receipt and no credit · Reject and ship back.

**Statuts :** New, Waiting for inspection, Waiting for action, In progress, Ready for shipment, Shipped,
Resolved (automatique s'il n'y a pas d'articles sortants et aucune action en attente), Delivered
(manuel), Cancelled, Archived.

Sections de l'écran : *Return items* (produits retournés), *Outbound items* (remplacements, réparations,
retours au client), *Invoices*, *Shipments*.

**Point de conception notable :** les articles reçus en RMA **ne comptent pas en inventaire**. Ils
existent dans Stock → Stock lots sous des statuts préfixés « RMA » (RMA waiting for inspection, RMA
waiting for repair, RMA ready for shipment, RMA returned). Pour les réintégrer, on passe manuellement le
lot au statut Received — et **son coût est 0**, à saisir manuellement. Ce cloisonnement est judicieux
(éviter de polluer le stock vendable avec du retour non qualifié), mais l'obligation de saisir le coût à
la main est une faiblesse.

Un avoir est **pré-rempli automatiquement** avec les lignes en type Credit only ou Receipt and credit.

### 8.6 Cash flow forecast et Statistics

**Prévision de trésorerie** hebdomadaire :
```
Prévision = (Factures de vente dues − Encaissements reçus) − (Factures fournisseurs dues − Décaissements)
```
Seules les factures de type « Invoice » et de statut ≠ Dummy sont considérées.

**CRM → Statistics**, calculé sur les articles **expédiés**, prix pris sur les CO (pas les factures) :

| Rapport | Contenu |
| --- | --- |
| **Customers** | Prix de vente, coût, profit, **retard moyen d'expédition** (moyenne du retard maximal par commande), % de livraison à l'heure (une commande est en retard si **au moins un** produit l'est) |
| **Goods shipped** | Par article : quantité, prix, coût, profit, matières/frais généraux/MOD **purs**, retard moyen, % à l'heure |
| **Customer orders** | Par commande : prix, coût (tous articles y compris non fabriqués), profit, composantes pures |

### 8.7 Sales Management (Enterprise)

Trois rapports de performance commerciale par période et par utilisateur, utilisables pour le calcul de
commissions : **Contacts** (clients contactés, déduits des mises à jour de fiche), **Changed statuses**
(nombre de changements de statut client), **Invoices** (factures créées). Export PDF et CSV.

### 8.8 B2B Customer Portal (Professional)

Boutique web B2B connectée au CRM. Pages : Catalog, Cart, My orders, Order details, My invoices,
Invoice details.

- Invitation par bouton « Invite to Portal » sur la fiche client → courriel pré-rempli avec un **lien
  unique**. Révocation par « Revoke customer from Portal » (le lien devient invalide).
- **Visibilité produits** : si une liste de prix est affectée au client, seuls ces produits ; sinon tous
  les articles ayant un prix de vente. Les articles « Not for sale » ne sont **jamais** affichés.
- Devise : celle du client, avec conversion depuis les devises additionnelles.
- Adresse de livraison choisie parmi celles du client ; à défaut « Pickup at Vendor's location ».
- Une commande passée arrive en statut **Confirmed** dans le CRM et **crée une tâche** pour le
  gestionnaire de compte. **Les factures ne sont pas créées automatiquement.**
- Mapping des statuts : Confirmed→Ordered, Waiting for production / In production→Processing,
  Ready for shipment→Ready for shipment, Shipped et Delivered→Shipped. Les autres statuts sont masqués.
- **Incompatibilité documentée :** l'auto-création de variations du Matrix BOM doit être désactivée.

---

## 9. Module PROCUREMENT (achats)

### 9.1 Purchase Orders

**Statut RFQ.** Un PO en RFQ ne crée **aucun lot** : le système ignore l'arrivée attendue et ne peut rien
réserver dessus. Méthode officielle de consultation multi-fournisseurs : créer un PO en RFQ, l'envoyer,
puis le **copier** pour le fournisseur suivant.

**Auto-remplissage par les conditions d'achat.** Règle de sélection de la condition (identique pour le
chiffrage) :
1. Condition de **priorité la plus élevée** satisfaisant la quantité minimale de commande.
2. À priorité égale, **prix le plus bas**.
3. Si aucune condition ne satisfait la quantité minimale, on prend la priorité la plus élevée (puis prix le
   plus bas).
4. *Cas du chiffrage hors stock :* les quantités minimales sont **ignorées** ; priorité la plus élevée, puis
   prix le plus bas.

Exemple documenté : quatre conditions (prio 30 à 4 $ à partir de 100, prio 25 à 4,50 $ à partir de 100,
prio 20 à 5 $ à partir de 20, prio 10 à 6 $ sans minimum) donnent 4 $ au-delà de 100, 5 $ entre 20 et 100,
6 $ en dessous de 20.

**Frais, remises, taxes.** Champs *Taxable fees* et *Additional fees* (transport, douane) répartis
proportionnellement → **coût de revient rendu (landed cost)** ajouté au coût du lot. Remise globale
appliquée à chaque ligne (une remise sur un seul article se traduit par une baisse du prix de la ligne).
La taxe sert au total du PO et au rapport de trésorerie, mais est **ignorée dans le coût des articles**.

**Commande ouverte (blanket order) :** une ligne par livraison, avec une date attendue par ligne. La
colonne « Expected date » apparaît alors sur le PDF.

**Devise :** choisie à la création, **non modifiable après enregistrement**. Prise par défaut de la fiche
fournisseur.

**Trois workflows de réception**, pilotés par deux paramètres logiciels :

| Workflow | Configuration | Mécanique |
| --- | --- | --- |
| **A** (défaut) | Several invoices per PO = No | 1 PO = 1 facture = N livraisons. Réception par saisie de la **date d'arrivée** ; ajuster « Expected quantity » pour une réception partielle |
| **B** | Several invoices = Yes, Separate invoices and deliveries = No | 1 PO = N factures = N livraisons, 1 facture = 1 livraison. Réception par **création d'une facture** ; la date de création de la facture devient la date d'arrivée |
| **C** | Several invoices = Yes, Separate invoices and deliveries = Yes | Flux physique et flux comptable séparés. Réception par **création d'une livraison** |

À la réception partielle, une **nouvelle ligne est créée** pour la quantité non reçue. La date d'arrivée
du PO se remplit automatiquement quand tout est reçu.

**Rangement (putaway).** Emplacement par défaut de l'article, sinon emplacement générique. Pour un
rangement différent : ouvrir le rapport Bookings du PO (ou de la livraison) et sélectionner le nouvel
emplacement, ligne par ligne ou globalement. Avec codes-barres : imprimer les étiquettes de lot, scanner
le lot puis scanner l'emplacement, vérifier le formulaire « Move product » pré-rempli et enregistrer.

**Facturation fournisseur :** factures multiples possibles, **facture d'un autre fournisseur** (transport)
rattachable au PO, devise différente possible si aucune ligne n'est sélectionnée, taux de taxe différent
possible. Acomptes fournisseurs et avoirs fournisseurs, **conditionnés à** « Several invoices per PO = Yes »
**et** « Separate invoices and deliveries = Yes » ; l'avoir exige en plus un compte comptable « purchase
credits » configuré.

**Documents :** PDF pour le fournisseur (avec logo), PDF interne, RFQ, bon de livraison, courriels
pré-remplis.

**Droit dédié :** « Hide prices in Procurement » masque tous les prix pour le magasinier et lui interdit
d'ajouter des lignes à un PO existant.

### 9.2 Dépannage documenté des PO — révélateur du modèle

Le manuel consacre une section entière à deux erreurs et à leur résolution. Elles sont instructives car
elles exposent la contrainte d'intégrité fondamentale du système :

> « Stock lot cannot be received partially because items have been consumed already. »
> « Purchase order cannot be deleted because items from its target lot have been consumed. »

**Explication :** des articles de ce lot ont déjà été consommés (MO, expédition, radiation, sous-traitance).
On ne peut pas recevoir moins que ce qui a déjà été consommé, ni supprimer le document source, car cela
créerait une incohérence (des matières consommées n'auraient jamais existé).

**Cause racine quasi systématique :** les articles ont été consommés depuis le **mauvais lot**, parce que
« Use planned goods » autorise la consommation d'articles au statut Planned — donc commandés mais pas reçus.

**Résolution :** ouvrir le lot cible → Reports → Bookings → corriger chaque booking dans son document
d'origine (MO, expédition, radiation, PO de sous-traitance).

**Leçon pour un MRP custom :** l'intégrité référentielle stricte est la bonne décision, mais elle doit
être accompagnée d'un **outil de correction en un écran** (« annuler cette consommation »), pas d'une
procédure en 6 étapes de navigation.

### 9.3 Vendors

Fiche fournisseur : contacts typés, langue des documents, **devise par défaut** (les conditions d'achat
sont libellées dans cette devise), taux de taxe, délai de paiement (depuis la date de facture ou la fin
du mois).

**Indicateurs de performance fournisseur** (affichés dans la liste) :
- *On-time delivery %* : chaque ligne de PO comptée séparément ; une ligne est à l'heure si le retard est
  **inférieur à 1 jour**. 10 produits dont 1 en retard → 90 %.
- *Average delay*
- *Rejected units* et *Rejected %* (si la fonction Quality Control est active)

Rapports : **Purchases** (inclut les PO dont la date d'arrivée tombe dans la période, **plus** les PO non
reçus dont la date attendue y tombe ; ignore les PO annulés) et **Purchase terms** (avec édition en masse).

### 9.4 Procurement → Requirements

Liste de **tous les composants achetables requis par des ordres précis**, avec la source, la date de
besoin et la **date d'action** (au plus tard pour commander, compte tenu du délai).

Création d'un PO pour une ligne, ou en masse pour plusieurs lignes **du même fournisseur** (astuce
d'interface : sélectionner une ligne active la case « tout sélectionner pour ce fournisseur »). Le PO
enregistré est automatiquement rattaché aux besoins d'origine.

Notes : les commandes clients pour lesquelles aucune réservation n'a jamais été tentée **n'apparaissent
pas** — il faut d'abord générer la demande. Affichage limité aux **10 000 premières lignes**.

### 9.5 Procurement → Procurement Critical on-hand

Variante du rapport Stock → Critical on-hand restreinte aux articles **achetés**. Même mécanique de
création groupée de PO par fournisseur, avec pré-remplissage complet.

### 9.6 Procurement → Forecasting

Prévision d'approvisionnement = **éclatement de nomenclature (BOM explosion)** + planification de matière
et de capacité.

Entrées : produits (avec nomenclature **et** gamme obligatoires) et quantités, date d'échéance
(planification arrière, Enterprise), nomenclature au choix par produit, et surtout le choix de
**considérer ou d'ignorer le stock disponible**.

Sorties : besoins bruts (stock ignoré) ou nets (stock considéré) ; date de démarrage au plus tôt de chaque
MO (planification avant) ou au plus tard (arrière) ; par matière : fournisseur, coût, date de livraison
requise et **date limite de commande** ; boutons de création en masse de MO et de PO.

**Multi-sites :** soit un site précis (création de MO/PO possible), soit « All sites » (calcul du besoin
total, **création d'ordres impossible**).

**Limites :** **12 produits maximum** par prévision ; import CSV impossible ; dans une hiérarchie
multiniveau, **seule la première nomenclature de sous-traitance rencontrée dans une branche est
éclatée** — celles situées plus bas ne le sont pas.

**Conseil officiel honnête :** la prévision d'appro est faite pour le make-to-stock. En make-to-order, il
vaut mieux créer directement des MO, qui génèrent la demande matière et sont toujours ordonnancés en
tenant compte des délais.

### 9.7 Procurement → Inspections (QC et RMA)

Liste des inspections en attente (lots reçus au statut On hold) et effectuées. Colonnes : producteur
(fournisseur pour un article acheté, responsable du MO pour un article fabriqué), taux de rejet, date
d'arrivée.

**Inspection sans numéros de série :** saisir la quantité approuvée (0 pour rejeter tout le lot), motiver
chaque rejet ligne par ligne dans la section Rejections (nouvelle ligne générée automatiquement), joindre
photos et fichiers, cliquer Approve/Reject. **La quantité approuvée n'est plus modifiable après
enregistrement.**

**Inspection avec numéros de série :** saisir les numéros rejetés avec un motif par numéro ; la quantité
approuvée se calcule (`quantité du lot − quantité rejetée`).

Conséquences : la quantité approuvée entre en stock ; la quantité rejetée reçoit **un nouveau numéro de
lot** (avec référence à l'original) au statut Rejected, indisponible, **et toutes ses réservations sont
annulées**. Les articles rejetés peuvent ensuite être réparés par un ordre de service ou radiés.

PDF d'inspection éditable, contenant date, lot, article, quantité, inspecteur, fichiers joints, détail des
rejets et des approbations avec numéros de série et notes.

### 9.8 Procurement → Statistics

- **Materials used in shipped goods** : matières des MO des produits expédiés, plus les articles revendus
  tels quels. Avertissement honnête : un article entré par ajustement manuel ne peut pas être décomposé —
  seul l'article lui-même et son coût de saisie apparaissent.
- **Premature orders** : délai entre l'arrivée prévue d'une matière et sa première utilisation, avec un
  lien vers le MO/CO/TO/RMA de première utilisation. Sert à repousser les commandes trop précoces.
  *Bon indicateur de fonds de roulement, rarement présent ailleurs.*

---

## 10. Module ACCOUNTING (comptabilité standard)

Module optionnel activé dans les paramètres logiciels. Contient : plan comptable, grand livre, bilan,
compte de résultat, écritures manuelles, clôture, paie.

### 10.1 Plan comptable

Dix catégories, chacune avec un type, un sens débiteur/créditeur et une affectation bilan/résultat :

| # | Catégorie | Type | Positif | Bilan | Résultat |
| --- | --- | --- | --- | --- | --- |
| 1 | Bank | Actif | Débit | ✔ | |
| 2 | Current assets | Actif | Débit | ✔ | |
| 3 | Fixed assets | Actif | Débit | ✔ | |
| 4 | Current liability | Passif | Crédit | ✔ | |
| 5 | Future liability | Passif | Crédit | ✔ | |
| 6 | Equity | Capitaux | Crédit | ✔ | |
| 7 | Sales | Produits | Crédit | | ✔ |
| 8 | Other income | Produits | Crédit | | ✔ |
| 9 | Direct expenses | Charges | Débit | | ✔ |
| 10 | Indirect expenses | Charges | Débit | | ✔ |

Sous-comptes possibles (compte parent). Chaque compte porte un ou plusieurs rôles « **Default account
for** » qui déterminent où atterrissent les écritures automatiques.

**Plan comptable par défaut (27 comptes)** — la colonne « rôle » est la plus intéressante :

| Code | Nom | Catégorie | Rôle par défaut |
| --- | --- | --- | --- |
| 1010 | Checking | Bank | paiements |
| 1020 | Cash | Bank | |
| 1100 | Accounts receivable | Actif circulant | factures impayées |
| 1210 | Purchases | Actif circulant | articles commandés non reçus |
| 12101 | Purchase credits | Actif circulant | avoirs fournisseurs |
| 1220 | Materials on hand | Actif circulant | matières reçues |
| 1230 | Work in progress | Actif circulant | en-cours |
| 1240 | Finished goods | Actif circulant | produits finis |
| 1260 | Non-inventory items | Actif circulant | articles hors stock |
| 1500 | Property and equipment | Immobilisations | |
| 2000 | Accounts payable | Passif circulant | commandes fournisseurs impayées |
| 2310 | Sales tax payable | Passif circulant | taxes de vente |
| 2350 | Customer prepayments | Passif circulant | acomptes clients |
| 2400 | Applied manufacturing overhead | Passif circulant | frais généraux appliqués |
| 2500 | Accrued payroll | Passif circulant | coûts de main-d'œuvre directe |
| 2700 | Transfer orders liability | Passif circulant | frais de transfert |
| 3000 | Equity | Capitaux | |
| 4000 | Sales | Produits | ventes |
| 5000 | Cost of goods sold | Charges directes | marchandises expédiées |
| 5800 | RMA service | Charges directes | ordres de service RMA |
| 5900 | Inventory adjustments | Charges directes | lots manuels, radiations manuelles |
| 6000 | Wages expense | Charges indirectes | |
| 6200 | Income tax expense | Charges indirectes | |
| 6400 | Utilities expense | Charges indirectes | |
| 6450 | Office supplies | Charges indirectes | |
| 6600 | Advertising expense | Charges indirectes | |
| 6700 | Bank fees | Charges indirectes | |

**Compte d'inventaire par groupe de produits** : configurable, mais le changement **n'est pas rétroactif**.

### 10.2 Écritures automatiques

Le manuel donne la table complète des événements. Voici les écritures structurantes :

**Achats**
```
Facture fournisseur saisie      D Purchases + D Sales Tax Payable    C Accounts Payable
Paiement fournisseur            D Accounts Payable                   C Bank
Réception des marchandises      D Materials on Hand                  C Purchases
Réception d'articles hors stock D Non-Inventory Items                C Purchases
Avoir fournisseur               D Accounts Payable                   C Purchase credits + Sales Tax Payable
```
**Fabrication**
```
Consommation de matières        D Work in Progress                   C Materials on Hand
Fin d'une opération             D Work in Progress                   C Accrued Payroll
                                D Work in Progress                   C Applied Manufacturing Overhead
Clôture du MO                   D Finished Goods                     C Work in Progress
```
**Ventes**
```
Prélèvement pour expédition     D Cost of Goods Sold                 C Finished Goods
Facture confirmée               D Accounts Receivable                C Sales + Sales Tax Payable
Encaissement                    D Bank                               C Accounts Receivable
Avoir confirmé                  D Sales + Sales Tax Payable          C Accounts Receivable
Facture d'acompte confirmée     D Accounts Receivable                C Customer Prepayments + Sales Tax Payable
Allocation de l'acompte         D Customer Prepayments               C Sales
```
**Inventaire**
```
Lot manuel créé                 D Materials on Hand / Finished Goods C Inventory Adjustments
Radiation manuelle              D Inventory Adjustments              C Materials on Hand / Finished Goods
```
**Sous-traitance**
```
Matières émises au sous-traitant D Work in Progress                  C Materials on Hand
PO de sous-traitance reçu (produit) D Finished Goods                 C Work in Progress + Purchases
PO de sous-traitance reçu (opération de MO) D Work in Progress       C Purchases
```
**RMA**
```
Article retourné remis en stock  D Materials on Hand / Finished Goods C Inventory Adjustments
Ordre de service : consommation  D RMA service                       C Materials on Hand
Ordre de service : opération     D RMA service                       C Accrued Payroll / Applied MOH
```
**Transferts** : `D Materials on Hand / Finished Goods C Transfer orders liability`

**Règles de datation.** Chaque écriture a une date d'imputation précise (date de facture, date d'arrivée,
date du clic sur « consume », date de fin réelle de l'opération, date de fin du MO…). Plusieurs sont
marquées « **la date de transaction est figée après création** ». Pour les réceptions, la règle est
« date du document **ou** date courante, la plus **ancienne** des deux ».

Modification et suppression d'un document source → les écritures sont **mises à jour ou annulées à la date
de la transaction d'origine**.

### 10.3 Clôture et ajustements

**Books closing date** (date incluse) : toute action affectant les comptes à cette date ou avant est
bloquée — sauf les actions journalisées dans le rapport « Adjustments to Books Closed Period ».

**Exception documentée majeure :** si « MO partial completion » est activé, les MO **en cours** démarrés
avant la date de clôture peuvent être modifiés **librement**. Toutes les conséquences financières
(inventaire, WIP, frais généraux appliqués, paie à payer, COGS) peuvent donc bouger dans une période
close — chaque ajustement étant journalisé avec le motif, l'ancien et le nouveau coût du lot. Une fois le
MO terminé, le blocage redevient effectif.

**Causes documentées de modification rétroactive des comptes (hors clôture) :**
- Modification ou suppression d'un ancien PO → effet en cascade sur le coût des matières.
- « Use planned goods » : le coût des marchandises utilisées est initialement **0**, puis corrigé.
- Ajout de frais additionnels à un PO → recalcul du coût de **tous** les articles du PO, y compris ceux
  reçus dans une période antérieure.
- Utilisation de « Finish production as planned ».

### 10.4 Paie

Rapport de paie par employé et par période : rémunération au temps (`durée × taux horaire`), à la pièce
(`prix × quantité`), ou les deux. Le détail des opérations réalisées est accessible en cliquant le nom.

Le traitement de la paie se fait **par écritures manuelles** ; MRPeasy fournit un exemple chiffré, avec
la mise à zéro périodique du compte « Accrued payroll » par contrepartie du compte de charges de salaires.
*Limite claire : ce n'est pas un module de paie, c'est un calcul de coût de main-d'œuvre.*

### 10.5 Calcul et arrondi de la taxe

```
Taxe = Σ ARRONDI( Sous-total de la ligne × Taux de taxe , décimales du paramètre "Subtotal" )
```
L'arrondi est fait **ligne par ligne, puis sommé** — jamais sur le total. Exemple officiel : deux lignes à
95 $ à 6,75 % donnent 6,41 + 6,41 = 12,82 (et non 12,83).

---

## 11. Module SETTINGS

### 11.1 System settings

- **Regional** : fuseau horaire (continent/ville), format de date, premier jour de la semaine, séparateur
  décimal, séparateur de milliers, séparateur CSV, **signe de la devise de base**, format d'affichage de la
  devise, nom de l'emplacement de stock indéfini.
  **Avertissement critique :** changer le signe de la devise de base sur une base vivante **ne recalcule
  rien** — seul le symbole change.
- **Company details** : raison sociale, coordonnées, courriel, site web, téléphone, n° d'enregistrement,
  n° de TVA, **taux de TVA/TPS par défaut**, coordonnées de paiement (texte libre imprimé sur factures et
  devis).
- **Holidays** : jours fériés globaux ; surchargeables par groupe de postes.
- **Working hours** : horaires par jour (défaut lundi–vendredi 08:00–17:00). Une journée avec des heures
  = un **jour ouvrable** (les délais matière sont exprimés en jours ouvrables). Le 24/24 se définit comme
  00:00–23:59. Surchargeables par groupe de postes.
- **Numbering formats** : 22 séquences documentaires paramétrables (voir annexe A.1).
- **Additional currencies** : devises et taux face à la devise de base. **Le stock n'a qu'une seule devise
  de base** ; les autres ne servent qu'à l'affichage sur les documents d'achat et de vente. Chaque lot est
  toujours valorisé en devise de base. Le taux est repris du référentiel à la création du document, puis
  modifiable document par document. Mise à jour automatique nocturne via openexchangerates.org (codes ISO
  4217 à 3 lettres obligatoires).
- **Allowed IPs** : liste blanche appliquée **uniquement** aux utilisateurs marqués « Access limited ».
  L'administrateur ne peut jamais être restreint.
- **Notifications** : 7 types d'alertes courriel paramétrables par utilisateur (nouvelle tâche assignée,
  nouveaux articles sous seuil — envoi **horaire**, demande d'approbation, planning hebdomadaire envoyé
  1 h avant le début de la semaine, poste à entretenir, nouvelle inspection — envoi horaire, changements
  de statut de commande avec choix des statuts). Avertissement explicite : le courriel n'est pas fiable.
- **Custom fields** : max 30, types texte / nombre / date / liste déroulante, marquables « obligatoire »,
  masqués par défaut dans les tableaux. Sauts de ligne dans les options via `\n` (rendu multiligne sur les
  PDF, monoligne à l'écran). Disponibles sur 14 objets : commandes clients, retours, clients, inspections,
  factures, ordres de fabrication (affichables dans My production plan), factures fournisseurs, bons de
  commande, conditions d'achat, numéros de série, expéditions, articles (ajoutables aux PDF), **lots**
  (option « persistant » : la valeur suit le nouveau lot créé par un transfert ou un rejet), ordres de
  transfert, fournisseurs.
- **Write-off types** : max 25 codes de motif.
- **Customer statuses**, **Delivery terms** : libellés paramétrables et réordonnables.
- **Usability settings** : tableau de bord en page d'accueil, thème de couleurs.

### 11.2 Les quatre éditeurs

| Éditeur | Portée |
| --- | --- |
| **PDF Editor** | Logo (GIF/JPG/PNG, **250 Ko max**, ~800×200 px recommandé, hébergé sur Dropbox/OneDrive/Drive/URL), titres de documents (le titre saisi s'applique à **toutes les langues** ; vider le champ pour retrouver la traduction automatique), orientation portrait/paysage, glisser-déposer des éléments d'en-tête et de pied de page, colonnes du tableau principal (ordre, largeur, alignement, visible/masqué), pieds de page par document jusqu'à **30 000 caractères**, pied de page général cumulatif, taille de police, choix des coordonnées d'entreprise affichées. Le logo n'apparaît **que** sur les documents externes |
| **Label Editor** | 9 types d'étiquettes (MO, colis, colis d'expédition, n° de série, expédition, article, lot, lot+emplacement, emplacement). Taille exacte en mm ou pouces, glisser-déposer des champs, redimensionnement, alignement, police, bordures. **Plusieurs mises en page par type** (invite au choix à l'impression). **Impression en lot** : plusieurs étiquettes par page, format papier et marges paramétrables |
| **E-mail Editor** | Objets et corps des courriels. Six variables : `[document]`, `[code]`, `[company]`, `[customer_company]`, `[vendor_company]`, `[link]`. Sur les factures, `[code]` devient `code (reference: référence de la CO)` si une référence existe |
| **Internet-kiosk Editor** | Visibilité des opérations (toutes celles assignées / prêtes à exécuter), mode avancé, sélection et ordre de 10 champs affichés |

### 11.3 Human Resources

- **Users** : courriel (identifiant), mot de passe, nom, **taux horaire** (doit inclure charges et taxes),
  départements, droits.
- **Utilisateur gratuit** : une fiche sans **aucun** droit coché. Non facturé, ne peut pas se connecter,
  mais **peut se voir assigner des opérations de fabrication**. Astuce utile pour modéliser des opérateurs
  sans licence.
- **Administrateur** : un seul, affiché en italique. Seul à pouvoir supprimer le compte, changer
  d'administrateur et utiliser « mot de passe oublié ». Ne peut pas être supprimé ni restreint par IP, et
  a toujours accès à la gestion des utilisateurs. **Ne peut pas accéder au kiosque.**
- **Suppression** : archivage, jamais suppression réelle ; restauration possible par recherche.
- **Journaux** : journal de base de données global (bouton Actions au-dessus de la table) et journal
  d'actions par utilisateur, filtrables par utilisateur, action et période.
- Rapports par utilisateur : Calendar, Production operations (avec écart planifié/réel en heures et en %),
  Invoices. Rapport global : synthèse par travailleur et par MO.
- **Departments** : groupe d'opérateurs. Taux horaire du département = moyenne des salaires des membres,
  ou montant saisi. Utilisé **uniquement pour l'estimation** ; le calcul réel utilise le taux de
  l'utilisateur.

### 11.4 Database maintenance

- **Sauvegarde** : téléchargement conseillé mensuellement. Fichier valide s'il a moins de **30 jours**,
  provient du **même compte** et n'a pas été modifié. La restauration **efface la base courante** et
  déconnecte tous les utilisateurs.
- **Archivage** : données non utilisées depuis 3 / 6 / 12 / 18 / 24 mois. Bouton « Find old data » avec
  décompte par type et export CSV préalable. Objets archivables : articles + nomenclatures + gammes
  (uniquement si hors stock ; les nomenclatures et gammes suivent l'article), clients (sans CO ni facture
  dans la période, hors clients créés dans la période et clients à commandes actives), commandes (CO
  Shipped/Delivered, PO Received, MO et SO Done/Shipped/Closed, RMA Shipped/Delivered/Resolved). Les codes
  reçoivent un suffixe `arch`. Restauration par bouton.
- **Export et mise à jour des liens de fichiers** : export CSV de tous les liens, puis remplacement en
  masse par upload d'un CSV ancien lien / nouveau lien. **Ne fonctionne pas pour Google Drive** (il faut
  détacher et rattacher manuellement).
- **Vidage** : « Empty the database » (tout sauf utilisateurs, paramètres système et sites ; **les
  paramètres de stock et les formats de numérotation sont réinitialisés**) ou « Delete orders and stock »
  (tous les ordres et les niveaux de stock ; les données de base sont conservées, la numérotation n'est pas
  réinitialisée).

### 11.5 Support intégré

Système de tickets à 5 catégories, chatbot IA « Mr. Peasy », heures de formation payantes, plans de support
avancé avec heures de visioconférence, consultants agréés tiers, et **accès support à la base** (activable
par le client, révocable par ticket, avec **obfuscation des données** : seuls codes, nombres et dates sont
visibles — pas les descriptions, noms, contacts, adresses, notes).

Politique affichée : les employés MRPeasy n'accèdent jamais aux données sauf accès explicitement autorisé
pour une question précise, ne saisissent ni ne modifient jamais de données client, ne gèrent jamais les
utilisateurs, et ne voient pas les informations de paiement.

---

## 12. Dashboard et Tasks

### 12.1 Dashboard — 24 widgets

Personnalisable (ajout/retrait, réordonnancement par glisser-déposer du titre), filtré par droits d'accès,
chaque widget étant cliquable vers le rapport détaillé.

| Widget | Définition |
| --- | --- |
| 7 Days Late Invoices | Factures impayées ou partiellement payées, en retard de ≥ 7 jours |
| Awaiting inspection | Lots à inspecter *(QC)* |
| Cash and cash equivalents | Solde de trésorerie du grand livre *(Compta)* |
| Cash flow | Solde des encaissements/décaissements depuis le début du mois |
| Cash flow forecast | Prévision sur 2 mois |
| CO ready to ship | CO en « Ready for shipment » |
| **Deliveries on time** | % de CO expédiées à l'heure depuis le début du mois. Considère : les commandes à livrer ce mois (statuts Confirmed→Delivered), les commandes en retard des mois précédents (Confirmed, Waiting for production, In production, Ready for shipment), les commandes livrées en avance. **Les commandes sans date de livraison sont ignorées ; les dates de ligne ne sont pas utilisées.** En cas d'expéditions multiples, la **dernière** date fait foi |
| Expenses / Income | Charges / produits du mois selon le grand livre *(Compta)* |
| Expire in 30 days | Lots périmant sous 30 jours *(Expiry)* |
| Items below reorder point | Articles sous le ROP |
| Late CO / Late MO / Late PO | Commandes en retard |
| **Manufacturing on time** | `MO terminés dont Due date ≥ Finish date / tous les MO dont Due date ≥ 1er du mois`. MO sans date d'échéance ignorés |
| MO in progress | MO en cours ou en pause |
| MO ready to start | MO dont les matières sont prêtes |
| OEE / TEEP | Efficacité globale des équipements depuis le début du mois |
| **Purchases on time** | `Lignes de PO à l'heure / toutes les lignes`. À l'heure si date de réception ≤ date attendue. Considère les lignes reçues dont la date attendue est dans le mois et les lignes non reçues dont la date attendue est antérieure au mois. **PO Cancelled et RFQ ignorés** |
| Rejection rate | Taux de rejet moyen du mois *(QC)* |
| Sales | Total des factures du mois |
| Stock | Coût total de l'inventaire |

### 12.2 Tasks

Panneau accessible en haut à droite depuis tous les écrans **sauf le kiosque**. Tâches avec échéance,
contenu et pièces jointes, commentaires d'équipe, case « Done ». Le bouton clignote sur nouveauté ; les
tâches non ouvertes sont en gras ; seules les tâches créées par l'utilisateur ou qui lui sont assignées
sont visibles ; rafraîchissement automatique **une fois par minute** ; pour retirer une tâche du panneau
il faut la supprimer.

---

## 13. Droits d'accès et sécurité

### 13.1 Modèle RBAC

Matrice **ressource × opération**, avec quatre opérations : **Create, Read, Update, Delete**. Une ressource
= une page ou une fonction. L'interface ne montre à l'utilisateur que les modules autorisés.

Ergonomie : cliquer sur un titre de ligne ou de colonne bascule tous les droits correspondants ;
possibilité de **copier les permissions d'un utilisateur existant**.

Exemple documenté de granularité fine, sur les numéros de série :
- *Read* : voir la liste Stock → Serial numbers et les rapports.
- *Create* : créer des numéros dans les MO, les lots ou le kiosque (sous réserve d'accès à ces écrans).
- *Update / Delete* : modifier ou supprimer (Update/Delete exigent Read pour agir depuis la liste).
- Cas d'usage : donner **Create seul** à un opérateur pour qu'il déclare sans pouvoir altérer l'existant.

### 13.2 Options utilisateur (au-delà du CRUD)

| Option | Effet |
| --- | --- |
| **Hide prices in Procurement** | Masque tous les prix de la section achats **et** interdit l'ajout de lignes à un PO existant |
| **Approval rights** | Droit d'approuver MO et/ou PO (fonction Approval System) |
| **Lock handler** | Peut reprendre le verrou d'un document laissé ouvert par un autre utilisateur (bouton « Take lock »). **Seul droit permettant de remettre un MO terminé en production.** Attention : l'utilisateur d'origine perdra ses modifications |
| **Access limited** | Soumet l'utilisateur à la liste blanche d'IP |
| **2FA** | Authentification à deux facteurs TOTP |
| **Internet-kiosk** | Donner **uniquement** ce droit place l'utilisateur en mode kiosque |

### 13.3 Authentification

Courriel + mot de passe, ou **Google / Microsoft** (uniquement pour un utilisateur MRPeasy existant dont
l'adresse correspond). 2FA TOTP (Google/Microsoft Authenticator), code redemandé **une fois tous les
7 jours**. Liste blanche d'IP (déconseillée sans IP statique).

Le changement de mot de passe est réservé aux utilisateurs ayant le droit **Update** sur Human Resources.

---

## 14. Intégrations

### 14.1 Liste complète (17 + API)

Amazon (via Zapier, **partiellement obsolète** — l'API FBA a été retirée par Amazon), BigCommerce, EDI
(via le partenaire Crossfire), External files (Google Drive, OneDrive, Dropbox, URL directe), HubSpot (via
Zapier), Magento, Microsoft Power BI, Pipedrive (native), QuickBooks Online, Salesforce (via Zapier),
ShipStation, Shopify, SolidWorks (macro Excel), Ware2Go, WooCommerce, Xero, Zapier, **API REST
(plan Unlimited uniquement)**.

### 14.2 Patron commun des intégrations e-commerce (Shopify, WooCommerce, BigCommerce, Magento)

Toutes suivent **le même modèle en quatre étapes**, ce qui est un bon signe de conception :

1. **Import de la commande** → une CO est créée ; une étiquette « In production » est posée côté boutique ;
   le numéro de commande boutique va dans le champ `Reference` de la CO ; le numéro MRPeasy est écrit dans
   les détails additionnels de la commande boutique.
2. **Réservation** → tentative automatique ; les produits non réservables laissent la CO en Confirmed avec
   un statut produit « Not booked » et **génèrent la demande**.
3. **Notification de disponibilité** → CO en « Ready for shipment » ; l'étiquette boutique passe de
   « In production » à « Ready for shipment ».
4. **Expédition** → marquer la commande comme traitée **dans la boutique** crée l'expédition dans MRPeasy
   et prélève automatiquement le stock. Les articles sérialisés doivent être prélevés manuellement.

Appariement des produits : **SKU boutique = Part Number MRPeasy**. Un article sans SKU correspondant est
ignoré (et noté côté boutique).

**Cas Shopify (le plus abouti, et le plus pertinent pour Lasclay) :**
- Deux modes exclusifs : **commandes individuelles** (suivi complet du cycle de vie) ou **import en masse**
  (les articles expédiés sont agrégés une fois par heure dans une CO unique par combinaison
  emplacement × devise, marquée prélevée et expédiée immédiatement). Le mode masse est recommandé au-delà
  de « milliers de commandes par mois » et **désactive la synchronisation des stocks**.
- Fenêtres temporelles : commandes non traitées **ou** créées dans les 30 derniers jours ; **au-delà de
  60 jours, MRPeasy ne peut plus accéder à la commande, même déjà importée**.
- Prix : tous les prix MRPeasy sont **hors taxe** ; un prix Shopify TTC est converti en net. Les taxes sont
  portées par les factures, pas par les commandes. Remises importées **par ligne, en pourcentage**.
- Synchronisation de stock : **une fois par heure**, MRPeasy pousse la quantité disponible vers Shopify.
  « Location » Shopify = « Site » MRPeasy (≠ « storage location »).
- Retours : si la fonction RMA est active, la clôture d'un retour Shopify crée un RMA, réceptionne les
  articles, tente de réserver et d'expédier les échanges, et crée un **avoir marqué payé** — même si le
  remboursement est de 0.
- Import initial des produits : Title→Part description, SKU→Part number, Price→Selling price,
  Quantity available→stock, Cost per item→coût du lot. Les variantes Shopify deviennent des articles
  distincts si Matrix BOM est désactivé, ou des variations si activé.
- Multi-boutiques supporté (une CO générique par boutique si les clients ne sont pas importés).

### 14.3 QuickBooks Online et Xero

Deux niveaux :
1. **Noyau** : synchronisation des documents d'achat et de vente (factures, avoirs, acomptes, bons de
   commande, factures fournisseurs), comptes d'achat et de vente distincts par article, synchronisation
   automatique des paiements.
2. **Approfondi (optionnel)** : les transactions d'inventaire et de fabrication **de chaque journée** sont
   poussées par **une écriture manuelle** — variations d'inventaire (compte par article possible), COGS
   (compte par article possible), en-cours, matières/MOD/frais généraux appliqués, frais de transfert.

Points à connaître : la suppression d'un document dans MRPeasy **ne supprime pas** le document
correspondant dans QuickBooks (il faut le faire à la main) ; MRPeasy **ne rétrodate pas** les écritures —
si l'on utilise la synchronisation de solde, elles sont postées comme « ajustements de périodes
antérieures » à la date de synchronisation.

### 14.4 Zapier — l'API de facto pour les plans non-Unlimited

Quatre capacités : créer une CO, mettre à jour une CO, chercher une CO, et **déclencher sur changement de
statut d'une CO** (avec filtres « statut avant » et « statut après »).

Structure de données d'entrée en trois blocs :
- *Commande* : nom du client (obligatoire), lignes (obligatoire), numéro de CO (unique, sinon généré),
  référence, notes internes, devise (ISO 4217), liste de prix, date de livraison (timestamp Unix),
  adresse de livraison.
- *Lignes* : SKU (obligatoire, = part number), quantité (obligatoire, > 0), prix unitaire, prix total,
  remise %, date de livraison.
- *Adresse* : rue 1, ville, état, code postal, code pays ISO 3166 à 2 lettres — les cinq obligatoires si
  l'adresse est importée.

Comportements : le statut par défaut est **Confirmed** ; « Confirmed ou supérieur » déclenche la
réservation ; « Shipped ou supérieur » crée et prélève une expédition ; l'option « marquer comme payé »
crée une facture taxes comprises et enregistre le paiement complet.
Codes retour : 10 (créée, tous produits importés), 20 (créée, produits ignorés), 30 (non créée).
**Piège documenté :** une ligne sans SKU du tout fait **rejeter la commande entière** par Zapier.

### 14.5 Power BI

Connexion au **Power BI Service** (pas Desktop) par jeux de données « push ». **Fenêtre de 12 mois.**
Onze tables prédéfinies avec relations pré-configurées : Customer Orders, Customers, Goods shipped,
Inspections, Invoiced items, Manufacturing efficiency, Purchase Orders, Revenue, RMA, Stock, Stock movement.

**Upload manuel uniquement** — justification officielle : chaque envoi écrase intégralement le jeu de
données, et le volume est important. Conseil : renommer le jeu existant avant un nouvel envoi (l'appariement
se fait par nom).

### 14.6 ShipStation

Intégration essentiellement **unidirectionnelle** : les expéditions préparées dans MRPeasy sont poussées
vers ShipStation, où se font le choix du transporteur, l'impression d'étiquette et le suivi. Le **numéro de
suivi revient dans MRPeasy** quand la commande est expédiée.

Données envoyées : n° de commande, date, statut, courriel client, puis par ligne SKU, nom, quantité, poids,
prix et taxe, et l'adresse. Correspondance des statuts : shipment « New » → ShipStation « On hold » ;
« Ready for shipment » ou « Shipped » → « Awaiting shipment ».

**Limites documentées** : adresses structurées obligatoires avec code postal valide (le texte libre n'est
pas supporté) ; **la devise n'est pas transmise** (affichage dans la devise par défaut de ShipStation) ;
expédition impossible si une ligne a une quantité **décimale** ; écarts de centimes possibles par arrondi ;
mises à jour de remise ou de taxe non fiables ; API ShipStation **V1 requise** (retirée de certains forfaits
depuis mai 2025).

### 14.7 External files — système documentaire

Pièces jointes depuis Dropbox, Google Drive, OneDrive ou **URL directe**, attachables à 18 types d'objets
(articles, lots, expéditions, transferts, radiations, clients, notes clients, CO, RMA, MO, postes, groupes
de postes, nomenclatures, gammes, fournisseurs, PO, inspections, factures fournisseurs, livraisons).

Prévisualisation intégrée : images (PNG, JPG, GIF, SVG, WEBP) et PDF via un bouton « Show images » (zone
déplaçable et redimensionnable, préférence mémorisée par utilisateur) ; **modèles 3D CAO** au format
Collada (.DAE) ou XML3D via WebGL.

Icônes d'article : image publique GIF/JPEG/PNG ≤ **50 Ko**, taille conseillée 160×120 px, rendue en
9×7 mm. Affichable dans la liste des articles, au survol dans les listes déroulantes, sur les PDF
(devis, facture, confirmation, acompte) et dans le portail client — **sauf si stockée sur Google Drive**.

Chaque utilisateur se connecte à **son propre** compte cloud ; personne n'accède au stockage d'un autre.

---

## 15. API REST

### 15.1 Généralités

- Deux versions coexistantes : **v1** (stable) et **v2** (beta, plus riche en schémas).
- Authentification **Basic** avec clé d'API et clé secrète, générées dans Settings → Integration →
  API access.
- **Disponible uniquement sur le plan Unlimited.**
- **Le support MRPeasy n'assiste pas sur l'API** : « il vous faut votre propre partenaire de développement
  qualifié ».
- Spécification OpenAPI publique ; un fichier `llms.txt` est publié pour les agents IA.

### 15.2 Couverture (49 chemins, identiques en v1 et v2)

| Domaine | Endpoints | Écriture ? |
| --- | --- | --- |
| Articles | `/items`, `/items/{id}` | ✔ CRUD complet |
| Nomenclatures | `/boms`, `/boms/{id}` | ✔ |
| Gammes | `/routings`, `/routings/{id}` | ✔ |
| Postes / groupes | `/work-centers`, `/work-center-types` | ✔ |
| Groupes de produits, unités, paramètres, relations | `/product-groups`, `/units`, `/parameters`, `/relations` | ✔ |
| Ordres de fabrication | `/manufacturing-orders`, `/{id}` | ✔ |
| Commandes clients | `/customer-orders`, `/{id}` | ✔ |
| Clients | `/customers`, `/{id}` | ✔ (pas de DELETE) |
| Factures | `/invoices`, `/{id}` | ✔ |
| RMA | `/rma`, `/{id}` | ✔ |
| **Bons de commande** | `/purchase-orders`, `/{id}` | ❌ **lecture seule** |
| **Fournisseurs** | `/vendors`, `/{id}` | ❌ lecture seule |
| **Lots** | `/lots`, `/{id}` | ❌ lecture seule |
| **Expéditions** | `/shipments`, `/{id}` | ❌ lecture seule |
| **Numéros de série** | `/serials`, `/{id}` | ❌ lecture seule |
| **Inventaire** | `/stock/inventory`, `/sum`, `/{article_id}` | ❌ lecture seule |
| Journal d'actions | `/users/actions`, `/list`, `/{id}` | ❌ lecture seule |
| Rapports | `/report/crm/shipped`, `/report/production/{orders,products,operations,coproducts}` | ❌ lecture seule |

**Constat majeur pour un projet d'intégration :** on ne peut **ni créer un bon de commande, ni créer une
expédition, ni créer un fournisseur, ni ajuster un stock** par l'API. Toute automatisation des achats et de
la logistique sortante doit passer par l'interface, par les intégrations natives, ou par Zapier (qui, lui,
ne couvre que les commandes clients). **C'est la limite technique la plus lourde du produit.**

---

## 16. Limites, plafonds et pièges documentés

### 16.1 Plafonds numériques

| Objet | Plafond |
| --- | --- |
| Champs personnalisés | 30 |
| Types de radiation | 25 |
| Colonnes de quantité par paramètre dans une nomenclature | 150 |
| Produits par prévision d'approvisionnement | **12** |
| Produits par prévision de ventes | 100 (20 ajoutés à la fois) |
| Postes créés automatiquement à la création d'un groupe | 20 |
| Import CSV : articles, nomenclatures, gammes | 3 000 lignes |
| Import CSV : lignes de commande client | 200 lignes |
| Import CSV : lignes de PO, facture fournisseur, ordre de transfert | 100 lignes |
| Édition en masse | 100 lignes |
| Liste de prix éditable à l'écran | 300 produits |
| Numéros de série saisis en une fois | 100 |
| Rapport Requirements | 10 000 lignes |
| Estimation de coût de masse | abandonnée au-delà de 1 000 nomenclatures ou gammes |
| Calcul d'OEE historique | 1 mois par requête |
| Rapport « All production operations » | 1 mois |
| Pied de page PDF | 30 000 caractères |
| Logo | 250 Ko |
| Icône d'article | 50 Ko |
| Chargement d'un tableau | 20 lignes, puis « Load more » |
| Fenêtre Power BI | 12 mois |
| Validité d'une sauvegarde | 30 jours |
| Fenêtre d'accès aux commandes Shopify | 60 jours |
| Horizon MPS | 5 ans |

### 16.2 Limites fonctionnelles structurelles

- **Une seule devise de base** pour tout le stock. Les devises additionnelles ne sont qu'un habillage
  documentaire.
- **Un MO = un seul produit** (en quantité quelconque). Impossible de produire plusieurs articles
  différents dans un même ordre — sauf par le mécanisme de co-produits.
- **Un MO est rattaché à un seul site.**
- Un poste appartient à **un seul groupe** et à **un seul site** (mais un groupe peut couvrir plusieurs
  sites).
- **Pas de hiérarchie d'emplacements de stockage** — contournement par convention de nommage.
- Le **type d'un groupe de postes** (actif/passif) n'est pas modifiable après création.
- **« This is an inventory item »** n'est pas modifiable après création de l'article.
- **La devise d'un PO** n'est pas modifiable après enregistrement.
- **Le type d'une facture** (invoice/prepayment/credit) n'est pas modifiable après coup.
- **La quantité approuvée d'une inspection** n'est pas modifiable après enregistrement.
- Les articles, clients, utilisateurs, nomenclatures et gammes **ne sont jamais supprimés**, seulement
  archivés.
- **Un lot ne peut pas être gonflé.**
- Le numéro de lot **ne survit pas** à un transfert entre sites.
- **Onglets multiples interdits** : le manuel indique que le logiciel dysfonctionne si l'on travaille dans
  plusieurs onglets ou sur deux comptes simultanément. *C'est l'aveu d'une architecture à état serveur
  fortement couplée à la session.*
- Pas de réordonnancement global automatique.
- L'administrateur **ne peut pas** accéder au kiosque.

### 16.3 Pièges à haut risque

1. **« Use planned goods » = Yes.** Permet de consommer des marchandises non reçues. Effets : coût initial
   **0** puis corrigé rétroactivement, historique de stock temporairement faux voire négatif, impossibilité
   de modifier ou d'annuler le PO/MO source, écritures comptables rétroactives (bloquées si les livres sont
   clos), et postage en « ajustements de périodes antérieures » vers QuickBooks/Xero.
2. **Matrix BOM après coup.** Ajouter un paramètre à un article existant rend les anciennes variations
   « incomplètement définies » : elles disparaissent des listes de sélection et les documents existants
   deviennent non modifiables. Trois issues : définir une valeur (souvent une valeur « N/A » créée pour
   l'occasion), retirer le paramètre, ou radier le stock. **Conseil officiel : créer un nouvel article
   plutôt que d'ajouter un paramètre.**
3. **Basculer Tracing.** Déclenche des actions automatiques immédiates. Sauvegarde impérative.
4. **Stock → Inventory.** Peut annuler des réservations existantes en LIFO. Droit à réserver à une seule
   personne.
5. **Substitute a part.** Modifie toutes les nomenclatures filtrées ; si aucun filtre n'est posé, **toutes
   les nomenclatures de la base**. Potentiellement non annulable.
6. **Changer le compte comptable d'un groupe de produits** n'est pas rétroactif.
7. **Changer le signe de la devise de base** ne recalcule rien.
8. **MO partial completion** ouvre une brèche dans la clôture comptable.
9. **Finish production as planned** réécrit les dates d'opérations et peut produire des consommations
   rétroactives incohérentes si les dates du MO ne correspondent pas à la réalité.

---

## 17. Analyse critique et recommandations pour un MRP Lasclay

### 17.1 Ce qui mérite d'être repris tel quel

| Concept | Pourquoi |
| --- | --- |
| **Lot de stock comme objet pivot** | Traçabilité amont/aval, FIFO/FEFO, coût réel, péremption et rappel produit découlent tous d'un seul objet bien conçu |
| **Booking comme lien source↔destination** | Un objet unique, explicite, sur lequel s'appuient réservation, consommation, statuts et corrections. Bien plus clair qu'un champ « quantité réservée » sur l'article |
| **Statuts multiples orthogonaux sur une commande** | Statut commande / statut produits / statut facturation / statut paiement : chacun répond à une question différente. À reprendre absolument |
| **Groupe de postes ≠ poste** | La gamme désigne un groupe, l'ordonnanceur choisit le poste. Les gammes restent stables quand le parc machine change |
| **Type « traitement passif »** | Modélise proprement séchage, refroidissement, quarantaine : 24/7, capacité illimitée, durée indépendante de la quantité, sans coût de MOD |
| **Assignation à un département avec prise en main (« pull »)** | L'opération est visible par tout le département jusqu'à ce que quelqu'un la démarre. Simple, sans surcouche de planification RH |
| **Double code couleur fond/texte** dans le planning | Avancement et disponibilité matière lus d'un coup d'œil sur le même bloc |
| **« Estimate costs and dates »** | Simulation complète d'une commande (achats et fabrications simulés) avant engagement. Fonction commerciale à très forte valeur |
| **Rapports Engagement / Content sur un lot** | Traçabilité aval et amont en deux clics : c'est le mécanisme de rappel |
| **Utilisateur « gratuit »** | Fiche sans droits, non facturée, mais assignable à des opérations. Résout élégamment le cas des opérateurs sans licence |
| **Rapport « Deliveries » en lien public** | Écran mural d'atelier sans authentification. Petite idée, gros effet |
| **Prévision IA qui n'écrase jamais la saisie manuelle** | Règle de gouvernance humain/machine correcte, à généraliser |
| **Doctrine explicite matière > machine > opérateur** | Documenter les principes d'ordonnancement dans le produit lui-même évite des débats sans fin |
| **Distinction pédagogique BOM d'ingénierie / BOM de production** | Devrait figurer dans la documentation de tout MRP |

### 17.2 Ce qu'il faut faire différemment

| Défaut de MRPeasy | Alternative recommandée |
| --- | --- |
| **Tracing en interrupteur global** | Rendre la traçabilité par lot **paramétrable par famille d'articles** : obligatoire sur les matières critiques, automatique sur la visserie |
| **Corrections d'erreur en 6 à 10 étapes de navigation** | Toute action réversible doit avoir un **bouton d'annulation en un clic** sur le document où l'erreur a été faite. « Annuler cette consommation », « annuler ce prélèvement » |
| **Ordonnancement silencieusement optimiste** quand un délai est inconnu | Bloquer et signaler : « le délai de X est inconnu, ce plan est irréaliste ». Un plan faux coûte plus cher qu'un plan absent |
| **Sélection alphabétique** de la nomenclature/gamme d'un sous-ensemble | Rendre le choix explicite : nomenclature marquée « par défaut », ou choix au lancement |
| **Deux conventions de coût** (rapports production « impurs », rapports CRM « purs ») | Une seule convention, avec explosion récursive systématique |
| **API en lecture seule sur PO, expéditions, fournisseurs, stock** | Une API complète en écriture dès le départ. C'est la condition de toute automatisation sérieuse |
| **API réservée au palier le plus cher** | Sans objet dans un produit interne, mais le principe reste : ne jamais mettre l'automatisation derrière un mur |
| **Interdiction des onglets multiples** | Concevoir sans état serveur de session : optimistic concurrency avec numéro de version, pas de verrou de document |
| **Verrouillage de document + rôle « lock handler »** | Remplacer par de la détection de conflit à l'enregistrement (comparaison de version) et une fusion assistée |
| **Coût 0 sur les articles retournés en RMA** | Reprendre le coût du lot d'origine via la traçabilité de la commande initiale — l'information existe |
| **Champs non modifiables après création** (inventoriable, type de groupe de postes, devise du PO) | Autoriser la migration avec une procédure de reprise contrôlée |
| **Prévision d'appro limitée à 12 produits** | Traitement asynchrone en tâche de fond ; aucune raison technique de limiter |
| **Pas de hiérarchie d'emplacements** | Emplacements en arbre dès le modèle de données (`parent_location_id`) |
| **« Use planned goods » qui casse l'historique** | Modéliser explicitement un statut « en transit / non réceptionné », avec un coût provisoire assumé et un rapport d'écart, plutôt qu'un coût 0 masqué |

### 17.3 Périmètre minimal viable pour Lasclay

Lasclay est un manufacturier québécois de produits isolés à la soie d'asclépiade, vendant en ligne
(Shopify), avec de la production textile confiée en partie à l'étranger. Le profil implique des choix
précis :

**Indispensable dès la v1**
1. Articles avec nomenclature et gamme, multi-niveaux, **plus** variations (taille/couleur) — le textile
   impose le Matrix BOM. Décider dès le premier jour de la stratégie variation vs article distinct.
2. Lots de stock avec coût réel, FIFO, traçabilité amont/aval.
3. Ordre de fabrication avec réservation matière et déclaration d'avancement.
4. Bon de commande fournisseur avec conditions d'achat, devise, **délai en jours ouvrables**, et surtout
   **frais additionnels répartis (landed cost)** — critique pour de l'import.
5. Commande client alimentée par Shopify, avec les quatre statuts orthogonaux.
6. Expédition avec prélèvement et sortie de stock ; poussée vers ShipStation (déjà en place via le
   General Proxy).
7. Point de commande par article et rapport de réappro.
8. Sous-traitance (méthode « PO + expédition de matières ») — c'est le modèle Tunisie.

**Utile en v2**
9. Ordonnancement à capacité finie et Gantt — seulement s'il existe un atelier interne à charger.
10. Déclaration atelier mobile (l'équivalent du kiosque).
11. Contrôle qualité à la réception, avec lot en quarantaine.
12. MPS et prévision de ventes — pertinent pour une saisonnalité forte (plein air).
13. Retours clients (RMA), déjà partiellement gérés dans le support Missive.

**À ne probablement pas construire**
- Module comptable interne : QuickBooks est déjà en place via le Finance Proxy. Construire l'équivalent
  des **écritures automatiques** (§10.2) et les pousser vers QBO, mais pas un grand livre parallèle.
- Portail client B2B, tant que le B2B n'est pas un canal significatif.
- Numéros de série : sans objet pour du textile.
- Multi-sites, tant qu'il n'y a qu'un entrepôt réel.

**Intégrations déjà disponibles chez Lasclay et à réutiliser plutôt qu'à reconstruire**
- Shopify (commandes, produits, stock) — connecteur MCP présent.
- ShipStation (expéditions, étiquettes, suivi) — 19 actions via le General Proxy.
- QuickBooks Online (comptabilité) — Finance Proxy.
- Klaviyo / Omnisend (marketing) — hors périmètre MRP.

### 17.4 Le point de décision structurant

La question qui déterminera l'architecture du MRP Lasclay est celle de **la granularité de traçabilité** :

- **Traçabilité par lot activée partout** → coût réel exact, rappel produit possible, mais charge de
  saisie quotidienne lourde et procédures de correction complexes (c'est le mode Tracing = ON de MRPeasy,
  et c'est là que se concentrent 80 % de ses problèmes d'ergonomie).
- **Allocation automatique FIFO** → charge de saisie minimale, coût moyen suffisant, mais pas de rappel
  ciblé.
- **Recommandation :** traçabilité **par famille d'articles**, activée sur la fibre d'asclépiade et les
  tissus (matières critiques, potentiellement soumises à des exigences de provenance et de certification),
  automatique sur les accessoires, fermetures, étiquettes et emballages.

MRPeasy n'offre pas cette granularité. C'est précisément le genre d'écart qui justifie un développement
sur mesure plutôt qu'un abonnement.

---

## Annexe A — Énumérations complètes

### A.1 Formats de numérotation par défaut (22 séquences)

| Document | Format | Document | Format |
| --- | --- | --- | --- |
| Customer orders | `CO00001` | Items | `A00001` |
| Customers | `CU00001` | Lots | `L00001` |
| Invoices | `I00001` | Shipments | `S00001` |
| Pro-forma invoices | `PI00001` | Transfer orders | `TO00001` |
| Quotations | `Q00001` | Product groups | `AG00001` |
| Order confirmations | `OC00001` | Relations | `RE00001` |
| Pricelists | `PL00001` | Bookings / Write-offs | `WO00001` |
| Manufacturing orders | `MO00001` | Purchase orders | `PO00001` |
| Workstations | `C00001` | Vendors | `V00001` |
| Workstation groups | `WCT00001` | Customer returns (RMA) | `RMA00001` |
| BOM | `BO00001` | Service orders | `SO00001` |
| Routings | `R00001` | Procurement forecasts | `PF00001` |

### A.2 Statuts d'ordre de fabrication

| Code | Statut | Assignation |
| --- | --- | --- |
| 10 | New | Automatique, si approbation requise |
| 15 | Not scheduled | Automatique, si hors planning (fonction Unscheduled MO) |
| 20 | Scheduled | Automatique à l'enregistrement |
| 30 | In progress | Au clic sur Start de la première opération |
| 35 | Paused | Au clic sur Pause, ou à la fin de la dernière opération avant clôture |
| 40 | Done | Clôture |
| 50 | Shipped | Manuel, par saisie de la date d'expédition |
| 60 | Closed | Manuel, par saisie de la date de clôture |
| 70+ | Archived / Cancelled | Archivage ou suppression |

**Statut des pièces d'un MO :** 4 Requested · 3 Not booked · 2 Delayed · 1 Expected · 0 Received.
En mode Tracing = OFF, s'ajoute **Not enough**.

### A.3 Statuts de lot de stock

| Statut | Sens |
| --- | --- |
| Requested | Demandé au responsable achats (PO en New) ou production (MO en New / Not scheduled). **Non consommable, non prélevable** |
| Planned | Attendu : PO passé, MO ordonnancé ou démarré. Consommable **seulement si « Use planned goods »** |
| Received | Reçu, disponible |
| On hold | Reçu, en attente d'inspection *(QC)* |
| Rejected | A échoué à l'inspection *(QC)* |
| Cancelled | Lot supprimé |
| RMA waiting for inspection | Retour reçu, à inspecter *(RMA)* |
| RMA waiting for repair | Retour inspecté, à réparer *(RMA)* |
| RMA ready for shipment | Retour réparé, à réexpédier *(RMA)* |
| RMA returned | Retourné par le client ; passer à Received pour réintégrer l'inventaire *(RMA)* |

### A.4 Statuts de commande client

10 Quotation · 20 Waiting for confirmation · 30 Confirmed · 40 Waiting for production · 50 In production ·
60 Ready for shipment · 70 Shipped · 80 Delivered · Cancelled · Archived.

Assignation : manuelle pour Quotation, Waiting for confirmation, Confirmed, Delivered et Cancelled ;
**automatique** pour Waiting for production, In production, Ready for shipment et Shipped.

Une CO expédiée **reste** en « Ready for shipment » si la quantité réservée dépasse le besoin.
Une CO annulée libère toutes les réservations et **ne peut pas être restaurée**.

### A.5 Statuts produit d'une commande client

10 Not booked · 12 Not enough *(Tracing OFF)* · 15 Requested · 20 Delayed · 25 Possibly delayed ·
30 Expected on time · 40 Ready for shipment · Delivered.

### A.6 Statuts de source (MO / PO / TO alimentant une CO)

- **MO** : Not booked · Requested · Expected on time · Possibly delayed · Delayed · Received
- **PO** : Requested · Expected on time · Delayed · Received
- **TO** : Expected on time · Possibly delayed · Delayed · Received

### A.7 Autres statuts

- **Bon de commande** : 5 RFQ · 10 New · 20 Ordered · 30 Shipped · 40 Received · 110 Archived · 120 Cancelled
  (+ Approved si la fonction Approval System est active)
- **Expédition** : 10 New · 15 Ready for shipment · 20 Shipped · 30 Cancelled — **tous automatiques**
- **Ordre de transfert** : New · Ready for shipment · Shipped · **Received (manuel)** · Cancelled
- **Facture** : Dummy · Unpaid · Paid partially · Paid · Cancelled
- **Facturation d'une CO** : Not invoiced · Part invoiced (avec %) · Invoiced
- **Paiement d'une CO** : Not paid · Part paid (avec %) · Paid
- **Numéro de série** : Planned · Received · Consumed · Shipped · Written off · Rejected · RMA · Returned
- **RMA** : New · Waiting for inspection · Waiting for action · In progress · Ready for shipment ·
  Shipped · Resolved · Delivered · Cancelled · Archived
- **Types de RMA** : Credit only · Repair · Repair and ship back · Replacement · Receipt and credit ·
  Receipt and no credit · Reject and ship back
- **Statuts clients par défaut** : No contact · No interest · Interested · Permanent buyer (renommables)

---

## Annexe B — Recueil des formules

```
── DISPONIBILITÉ ──────────────────────────────────────────────────────────────
In stock  = Available + Booked + Rejected + (Expired − Booked from expired)
Available = In stock − Booked − Rejected − (Expired − Booked from expired)
Expected, Available = Expected Total − Expected Booked
Déclenchement du réappro : Available + Expected Available < Reorder Point

── ORDONNANCEMENT ─────────────────────────────────────────────────────────────
Durée d'opération = (Setup time + Cycle time × Quantité / Capacité) / Productivité du poste
   • Cycle time arrondi au cycle complet supérieur
   • Si Parallelize : ÷ nombre de postes disponibles du groupe
   • Opération passive : durée = un seul cycle, indépendante de la quantité
   • Unité minimale d'ordonnancement : 1 minute
Quantité de matière d'un MO = Quantité du MO × Quantité BOM + Quantité fixe BOM

── COÛT ───────────────────────────────────────────────────────────────────────
Coût produit = Matières directes + Frais généraux appliqués + Main-d'œuvre directe

MOD estimée = Durée × Taux horaire travailleur + Taux pièce × Quantité MO
MOD réelle  = Durée déclarée × Taux horaire travailleur + Taux pièce × Quantité déclarée

FG (poste sans taux horaire) = Coût fixe + Coût variable × Qté + Autre coût variable × Qté
FG estimés (poste avec taux) = Durée × Taux poste + Autre coût fixe + Autre coût variable × Qté
FG réels                     = Durée déclarée × Taux poste + Autre coût fixe + Autre var. × Qté

Matières estimées = Coût des matières réservées + Coût estimé des non réservées
Matières réelles  = Coût des matières consommées
Coût matière unitaire = Coût matières consommées / Nombre de produits

Frais additionnels par article = Coût article / Coût total du document × Frais additionnels

Coût des N produits principaux = N × p% × Coût MO / (N × p% + M × q%)
Coût des M co-produits         = M × q% × Coût MO / (N × p% + M × q%)
   avec q% = coût unitaire du co-produit / somme des coûts unitaires

── STOCK ──────────────────────────────────────────────────────────────────────
Ending = Beginning + Inward − Outward
Inward  = Purchases + Adjustments + Manufactured
Manufactured = Coût matières + FG appliqués + Coût MOD
Outward = Sales + Write-offs + Used in manufacturing

── MPS ────────────────────────────────────────────────────────────────────────
Stock final = Stock initial − MAX(Prévision, Commandes fermes) + MAX(Plan prod., Déjà ordonnancé)
Stock final (période courante) = Stock initial − Commandes fermes + MO ordonnancés
Capacité totale = Heures hebdo du groupe × Nb de postes           (arrondi inférieur)
Heures requises = Σ (heures de gamme × Plan de production)         (arrondi supérieur, setup ignoré)
Demande matière = Σ [ Qté BOM × MAX(Plan prod., Déjà ordonnancé) ]
Stock final composant = Stock initial − Demande MPS + MAX(Qté planifiée, Qté commandée)

── PERFORMANCE ────────────────────────────────────────────────────────────────
OEE = Disponibilité × Performance × Qualité
   Disponibilité = temps de marche déclaré / temps planifié            (plafonné à 100 %)
   Performance   = (pièces × cycle time gamme) / temps de marche       (plafonné à 100 %)
   Qualité       = pièces approuvées / pièces produites  (100 % si QC désactivé)
TEEP = temps total planifié / (jours × 24 × 60) × OEE

Deliveries on time %   = CO expédiées à l'heure / CO considérées
Manufacturing on time % = MO terminés dont Due ≥ Finish / MO dont Due ≥ 1er du mois
Purchases on time %    = Lignes de PO à l'heure / toutes les lignes
On-time fournisseur %  = Lignes livrées avec < 1 jour de retard / toutes les lignes

── FINANCE ────────────────────────────────────────────────────────────────────
Crédit disponible = Limite de crédit − Σ factures impayées (hors Dummy)
Prévision de trésorerie = (Factures de vente dues − Encaissements)
                        − (Factures fournisseurs dues − Décaissements)
Taxe = Σ ARRONDI(Sous-total de ligne × Taux, décimales "Subtotal")
Profit MO = (Revenu unitaire moyen − Coût unitaire) × Quantité vendue

── CONSOMMATION EN MASSE (atelier) ────────────────────────────────────────────
Quantité consommée = Quantité saisie × (Quantité réservée / Quantité planifiée du MO)
```

---

## Annexe C — Spécifications d'import CSV

Toutes les imports partagent la même mécanique : appariement manuel colonne ↔ champ, option « la première
ligne est un en-tête », type « ne pas importer », et **génération d'un fichier de rejet ligne par ligne** en
cas d'erreur. Encodage **UTF-8** (ou Unicode) obligatoire pour les caractères non latins ; sous Excel,
enregistrer en « Texte Unicode (*.txt) » et importer le .txt comme CSV.

### C.1 Articles (`Stock → Items → Import from CSV`) — 3 000 lignes

Champs à la création : Part description (**obligatoire**), Part No., Product group (créé s'il n'existe pas),
Unit of measurement (créée si absente), Is inventory item (1/0), Selling price, Tiered prices
(**JSON dans une seule cellule** : `[{"q":0,"p":20},{"q":10,"p":15}]`), Net cost per 1 unit,
Quantity at stock (**une colonne par site**, à importer avec le coût sinon coût = 0), Default storage
location (une colonne par site ; emplacements pré-créés obligatoires), Reorder point (une colonne par site),
Is procured item (1/0, défaut 0), Not for sale (1/0), Icon URL, Quality control (1/0) + On-hold period,
Shelf life, Serial numbers (1/0), Barcode UPC-A/EAN-13, Revision, champs personnalisés, Min. quantity for
manufacturing.

**Une seule condition d'achat** importable à la création : Vendor (créé si absent), Vendor part no,
Vendor price per unit, Lead time in days (les trois derniers indissociables), Priority, Minimum purchase
quantity, Vendor UoM, Vendor UoM conversion rate, Vendor UoM indivisible (1/0).

En mise à jour, l'appariement se fait sur **Part No.** ; une page de confirmation liste les valeurs
modifiées, avec possibilité d'ignorer ligne par ligne. Champ « New part number » disponible **sauf** si
Matrix BOM est actif avec des variations à numéros uniques (passer alors par l'édition en masse).

### C.2 Nomenclatures — 3 000 lignes

Product number (**obligatoire**, sur chaque ligne si pas de numéro de BOM), Part No. (**obligatoire**),
Quantity (**obligatoire**), Unit of measurement (pour une unité secondaire), BOM number (groupe les lignes ;
crée ou met à jour ; obligatoire sur chaque ligne si présent), BOM name, Relation number (exclusif avec
Part No.), Notes, Fixed quantity.

**Multiniveau :** identique à l'import de plusieurs nomenclatures — chaque sous-ensemble est un article
avec sa propre nomenclature, et sert de composant au niveau supérieur.

Erreurs fréquentes documentées : numéros de pièce non appariés (attention aux **arrondis et zéros
supprimés par le tableur** — `0123,4560` devenant `123,46`), articles inexistants, numéro de produit absent
sur certaines lignes, type de colonne mal sélectionné.

### C.3 Gammes — 3 000 lignes

Routing number, Routing name, Product (**obligatoire**), Workstation group (**obligatoire**, créé si
absent), Vendor (exclusif avec le groupe de postes), Operation, Setup time, Cycle time, Fixed cost,
Variable cost, Capacity (défaut 1), Department/Worker (séparés par virgule, à mettre entre guillemets si
le séparateur CSV est la virgule), **Subtasks** (séparées par saut de ligne), Piece-payment, Overlap,
Parallelize (1/0), Operation order number (si utilisé : sur toutes les lignes, à partir de 1, pas de 1),
Sequence (si utilisé : sur toutes les lignes, au moins une à 0, valeurs séparées par virgule).

### C.4 Autres imports

| Import | Limite | Colonnes |
| --- | --- | --- |
| Commande client (lignes) | 200 | Part No.* · Quantity · Price per UoM · Discount · Free text · Delivery date |
| Bon de commande (lignes) | 100 | Part number* · Quantity · Price · Vendor part no. · Free text · Expected date · Site (création seulement) · Expiry date |
| Facture fournisseur | 100 | Part number* · Quantity |
| Ordre de transfert | 100 | Part Number* · Quantity · Stock lot · Storage location |
| Clients, Fournisseurs, Conditions d'achat, Lots, Niveaux d'inventaire, Emplacements, Listes de prix | — | Imports dédiés |

### C.5 Import depuis SolidWorks

Procédure documentée : exporter la nomenclature indentée vers Excel (hiérarchie en numéros décimaux :
7, 7.1, 7.2, 7.3.1…), appliquer une **macro de formule Excel** fournie par MRPeasy qui calcule pour chaque
ligne le numéro de pièce de son **parent direct**, supprimer manuellement les sous-ensembles dupliqués,
enregistrer en CSV, puis importer. Tous les articles, y compris les sous-ensembles, doivent exister
au préalable dans MRPeasy.

*Observation : le fait que l'import CAO exige une formule Excel à recopier manuellement en dit long sur le
niveau d'intégration réel avec l'ingénierie.*

---

## Annexe D — Tarification et packaging (août 2026)

| Palier | Prix / utilisateur / mois | À partir du 11ᵉ utilisateur |
| --- | --- | --- |
| **Starter** | 49 $ | 79 $ par tranche de 10 utilisateurs |
| **Professional** | 69 $ | 79 $ / 10 utilisateurs |
| **Enterprise** *(le plus populaire)* | 99 $ | 79 $ / 10 utilisateurs |
| **Unlimited** | 149 $ (minimum 2 utilisateurs) | 79 $ / 10 utilisateurs |

**Noyau inclus dans tous les paliers :** planification et déclaration de production, gestion des
nomenclatures, replanification par glisser-déposer, traçabilité par lot, déclaration via Internet-kiosk,
gestion de la chaîne d'approvisionnement, gestion d'entrepôt, planification de la main-d'œuvre, CRM,
comptabilité standard, multilingue, multidevise.

**Professional ajoute** les 13 fonctions listées en §3.1 (portail B2B, co-produits, champs personnalisés,
désassemblage, péremption, configurateur de produit, chevauchement et séquences spéciales, exécution
parallèle, paiement à la pièce, contrôle qualité, numéros de série, sous-traitance, prix par paliers).

**Enterprise ajoute** les 13 fonctions listées en §3.2 (approbations, codes-barres, planification arrière,
gestion de maintenance, MPS, multi-sites, colisage, RMA, contrôle de version, prévision de ventes, gestion
commerciale, 2FA).

**Unlimited ajoute** l'**API et les webhooks**, sans limite.

### Lecture stratégique du packaging

Le contrôle qualité, les numéros de série et la sous-traitance sont en Professional ; les codes-barres, le
multi-entrepôt, le MPS et les retours clients sont en Enterprise. Pour un manufacturier réel, le palier
d'entrée fonctionnellement viable est donc **Enterprise à 99 $/utilisateur/mois** — et l'**API n'est
accessible qu'à 149 $**, soit un surcoût de 50 % par utilisateur pour le seul droit d'automatiser.

Ordre de grandeur pour Lasclay avec 5 utilisateurs sur Enterprise : ~5 940 $ US/an, sans API.
Avec API (Unlimited) : ~8 940 $ US/an. **C'est le calcul de référence face auquel un développement sur
mesure doit être arbitré.**

---

## Annexe E — Conventions d'interface à reprendre

### E.1 Icônes et actions standard

Add · Edit/View · Bulk editing · Choose columns · Search · **Saved searches** (filtres personnels, mémorisant
colonnes, ordre et valeurs, avec option « par défaut ») · Reports · Important notice (drapeau) · Actions
(journal) · Rebook materials · Drag handle · Create a Purchase Order · Consume · Pick · Create a
Manufacturing Order · Return item to stock · Print barcode · Start / Pause / Stop · Show images · Move
window · **Quick help** · Tasks · Page navigation · List/detailed view · **Sales pipeline view** · View sums ·
Sign in for more users (kiosque) · Switch user.

### E.2 Comportement des tableaux

Tri par clic sur l'en-tête · réorganisation des colonnes par glisser-déposer · sélection de colonnes ·
**disposition mémorisée par utilisateur** · chargement de 20 lignes puis « Load more » · sélection multiple
dans les listes déroulantes avec Ctrl.

### E.3 Opérateurs de recherche

| Opérateur | Effet | Exemple |
| --- | --- | --- |
| `_` | Un caractère quelconque | `w__d` → wood |
| `%` | N caractères quelconques | `w%d` → wood, washed |
| `&&` | Tous les mots, ordre indifférent | `wood && table` |
| `\|\|` | Au moins un des mots | `wood \|\| table` |
| `-` | Exclusion (en début de chaîne ou après un espace) | `table && -plastic` |
| `""` | Lignes **vides** dans cette colonne | `""` |
| `-""` | Lignes non vides | `-""` |
| `( )` | Groupement et priorité | `table && -(plastic \|\| white)` |

*Ce moteur de recherche textuelle est nettement au-dessus de la moyenne des ERP de cette gamme et vaut la
peine d'être reproduit.*

### E.4 Autres conventions

- **Quick help** contextuel en haut à droite de chaque page.
- **Infobulles sur tous les champs** au survol du titre.
- Prérequis navigateur : cookies, JavaScript et données de site autorisés.
- 33 langues d'interface (dont le français) ; **support en anglais uniquement**.
- Applications iOS et Android, servant notamment de **lecteur de codes-barres par la caméra**.

---

## Annexe F — Récapitulatif des sources

| Source | Portée |
| --- | --- |
| `www.mrpeasy.com/resources/user-manual/` | 187 pages, table des matières complète, aspirée et analysée intégralement |
| `api.mrpeasy.com/rest/v1/openapi.json` | 49 chemins, 116 schémas |
| `api.mrpeasy.com/rest/v2/openapi.json` | 49 chemins, 135 schémas |
| `mrpeasy.readme.io` + `llms.txt` | Documentation développeur |
| `www.mrpeasy.com/pricing/` | Grille tarifaire et matrice de fonctionnalités |
| `app.mrpeasy.com` | **Non accessible** — voir §0.2 |

**Fin du document.**
