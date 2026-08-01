# 20. Plan de build & migration

> Document de synthèse. Il ne décrit pas ShipStation — il décrit **comment le remplacer sans rupture d'exploitation**.

---

## 1. Ce que « seamless » veut dire, concrètement

La transition est réussie si, le lundi matin après la bascule :

1. Les commandes Shopify arrivent seules dans la grille, avec le même délai qu'avant.
2. Les commandes portent déjà le bon transporteur, le bon service, le bon type de colis et le bon poids — parce que les règles d'automatisation ont tourné.
3. Une commande s'expédie en autant de clics qu'avant (idéalement au clavier, cf. hotkeys).
4. L'étiquette sort de l'imprimante 4×6 au même format, sans réglage.
5. Le tracking remonte vers Shopify et le client reçoit sa notification.
6. L'historique d'expédition des 12 derniers mois est consultable et cherchable.
7. Personne n'a besoin de tenir une liste papier de « ce que ShipStation faisait tout seul ».

Les points 2, 4 et 7 sont ceux qu'on rate. Ils dépendent entièrement de `99-config-lasclay.md`, pas de la qualité du code.

Critère de sortie proposé : **deux semaines de double exploitation** — les deux systèmes importent les mêmes commandes, on expédie depuis le nouveau, ShipStation reste le filet. On compare quotidiennement les décisions d'automatisation des deux côtés jusqu'à convergence.

---

## 2. Architecture proposée

Rien d'exotique — ShipStation est un CRUD dense avec un moteur de règles et des intégrations transporteurs. Le risque n'est pas technique, il est dans la densité fonctionnelle.

```
┌───────────────────────────────────────────────────────────┐
│  Web app (SPA)                                            │
│  · DataGrid générique (Orders/Shipments/Products/Customers)│
│  · FilterEngine + Custom Views                             │
│  · Configure Shipment Widget                               │
│  · Hotkey layer (séquences 2 touches)                      │
└──────────────────────────┬────────────────────────────────┘
                           │ API interne (REST ou tRPC)
┌──────────────────────────┴────────────────────────────────┐
│  Backend                                                  │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │ Order svc   │ │ Automation   │ │ Rating svc         │  │
│  │ (upsert     │ │ engine       │ │ (quote + cache +   │  │
│  │  idempotent)│ │ (6 couches)  │ │  invalidation)     │  │
│  └─────────────┘ └──────────────┘ └────────────────────┘  │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │ Label svc   │ │ Printing svc │ │ Notification svc   │  │
│  │ (idempotent)│ │ (abstraction │ │ (marketplace +     │  │
│  │             │ │  document/   │ │  client, avec      │  │
│  │             │ │  destination)│ │  file de réessai)  │  │
│  └─────────────┘ └──────────────┘ └────────────────────┘  │
└──────────────────────────┬────────────────────────────────┘
        ┌──────────────────┼──────────────────┐
   ┌────┴─────┐      ┌─────┴──────┐    ┌──────┴──────┐
   │ Postgres │      │ Job queue  │    │ Adapters    │
   │ (§15)    │      │ (import,   │    │ Shopify /   │
   │          │      │  tracking, │    │ transporteur│
   │          │      │  notif)    │    │ (v2-like)   │
   └──────────┘      └────────────┘    └─────────────┘
```

**Décisions structurantes, à trancher avant la première ligne de code :**

| Décision | Recommandation | Pourquoi |
|---|---|---|
| Modèle de données de référence | **v2** pour la forme (multi-colis, multidevise, `snake_case`, IDs opaques), **v1** pour le cycle de vie de la commande et le modèle multi-boutique | v2 est mieux typé mais ne modélise pas bien la commande ; v1 modélise la commande mais est mono-colis et implicitement USD |
| Achat d'étiquettes | **Ne pas intégrer les transporteurs en direct.** Passer par un agrégateur : **ShipEngine, EasyPost ou Shippo** | L'intégration directe UPS/FedEx/Postes Canada représente des mois de certification. Ce n'est pas là que se trouve la valeur du projet. ⚠️ **Ne pas retenir l'API ShipStation comme agrégateur** : ce serait contradictoire avec la résiliation prévue en J+30 (§4.2), et l'API v1 est officiellement annoncée comme destinée à être dépréciée. |
| Multidevise | CAD par défaut, devise explicite sur **chaque** montant stocké | Lasclay vend en CAD, achète en USD chez certains transporteurs, et déclare en douane en USD ou CAD selon la destination |
| Fuseaux | `timestamptz` UTC partout, conversion à l'affichage en `America/Toronto` | v1 stocke en PST sans fuseau — bug de conception documenté en §16 |
| Idempotence | Clé d'idempotence obligatoire sur `createLabel` et sur l'upsert de commande | Le double achat d'étiquette est l'incident coûteux le plus courant |
| Historique | Table `order_status_history` + `shipment_status_history` dès le jour 1 | ShipStation ne l'expose pas ; c'est le manque le plus cité |

---

## 3. Découpage en 8 phases

L'ordre est contraint : chaque phase débloque la suivante. Les phases 1 à 4 forment le **MVP exploitable** — au bout de la phase 4, on peut déjà expédier en production.

### Phase 1 — Socle données & import (fondation)
- Schéma Postgres de `15-schema-postgres.md`, au moins : `store`, `order`, `order_item`, `address`, `customer`, `product`, `tag`, `warehouse`, `carrier`, `service`, `package_type`
- Adapter Shopify : import initial + incrémental, upsert idempotent sur `(store_id, order_key)`
- Mapping de statuts Shopify → statuts internes (§14)
- Job queue et un simple écran de liste, sans fioritures
- **Sortie de phase** : les commandes Shopify apparaissent, sans doublon, avec leurs articles et adresses

### Phase 2 — DataGrid & filtres (le composant réutilisé partout)
- Grille générique : colonnes configurables, tri, redimensionnement, réordonnancement par drag, 2 colonnes épinglées, expansion inline, sélection multiple avec shift-click
- **Persistance des préférences de colonnes côté serveur, par vue** — pas en `localStorage` (bug ShipStation documenté)
- FilterEngine : les critères d'Orders listés en `02-ecran-orders.md` §2.4, composables `[le décompte exact n'est pas publié par ShipStation — se fier à la liste, pas à un chiffre]`
- Custom Views / Saved Filters
- **Sortie de phase** : on retrouve n'importe quelle commande aussi vite qu'avant

### Phase 3 — Tarification & achat d'étiquette
- Rating service : quote multi-transporteurs, cache, debounce, invalidation avec état `Rate Expired`
- Configure Shipment Widget (§2.9) — le composant le plus dense du produit
- Achat d'étiquette idempotent, annulation (void)
- Rate browser / comparateur (§2.10)
- **Sortie de phase** : une étiquette s'achète depuis l'interface

### Phase 4 — Impression
- Abstraction document (label / packing slip / pick list / manifest) × destination (agent local d'impression / aperçu navigateur / téléchargement PDF / toujours demander)
- Formats 4×6 thermique et 8,5×11
- Templates de packing slip avec substitutions de champs
- Agent d'impression local (l'équivalent de ShipStation Connect) — ou, plus simple pour démarrer : impression PDF via le navigateur avec un profil d'imprimante préenregistré
- **Sortie de phase** : ⭐ **MVP exploitable — on peut basculer la production ici**

### Phase 5 — Moteur d'automatisation (le plus différenciant, le plus facile à rater)
- Les 6 couches dans l'ordre d'exécution strict de `03-automatisation.md` §3.1 — cet ordre **est** la spécification, pas un détail :
  `1. Auto-Routing → 2. Auto-Split → 3. Product Preset Groups → 4. Product Defaults → 5. Service Mapping → 6. Automation Rules`
- Automation Rules : critères et actions exhaustifs de §3.3 / §3.4
- Shipping Presets (§3.5) — attention, ce n'est **pas** une couche d'automatisation mais une action appliquée manuellement ou déclenchée par une règle
- Le bouton `Reprocess Automation Rules` ne rejoue que les couches 4, 5 et 6 — pas Auto-Routing ni Auto-Split
- Écran de test « à blanc » : appliquer les règles à une commande sans les exécuter, et montrer la trace de décision
- **Sortie de phase** : les commandes arrivent préconfigurées comme avant

> L'écran de test à blanc n'est pas un luxe : c'est l'outil qui permet de comparer les décisions du nouveau système à celles de ShipStation pendant la double exploitation.

### Phase 6 — Notifications & retour marketplace
- Écriture retour du tracking vers Shopify, avec file de réessai et index partiel sur `marketplace_notified`
- Emails clients : templates, branding, déclencheurs
- Polling de tracking transporteur + table `tracking_event` avec contrainte d'unicité (les transporteurs renvoient des doublons)
- **Sortie de phase** : le client est informé, Shopify est à jour

### Phase 7 — Productivité & volume
- Hotkeys (`02-ecran-orders.md` §2.12) — **l'architecture de focus et d'événements doit les prévoir dès la phase 2**, même si on les implémente ici. `[à vérifier : les hotkeys ont été retirées lors du passage à la V3 de ShipStation et leur retour est une demande communautaire récurrente. La liste de §2.12 reflète probablement la V2. Ne pas viser la « parité hotkeys » — viser ce qui sert réellement le débit d'expédition de Lasclay.]`
- Batches, Scan to Print / Scan to Verify
- End of Day / manifests / SCAN forms
- Actions en masse
- **Sortie de phase** : le débit égale ou dépasse ShipStation

### Phase 8 — Périphérie
- Insights / Reports
- Returns & RMA
- International / douane avancée (HS codes, IOSS, EEL/PFC)
- Inventaire
- Users & permissions

---

## 4. Plan de migration des données

### 4.1 Ce qu'il faut sortir de ShipStation, et comment

| Donnée | Source | Méthode | Volume attendu |
|---|---|---|---|
| Commandes historiques | API v1 `GET /orders` | Pagination par `modifyDateStart` / `modifyDateEnd`, fenêtres d'un mois | 12–24 mois |
| Expéditions & étiquettes | API v1 `GET /shipments?includeShipmentItems=true` | ⚠️ **Pas de filtre `modifyDate` sur cet endpoint** — utiliser `createDateStart`/`createDateEnd` (ou `shipDateStart`/`shipDateEnd`), fenêtres mensuelles. Passer `modifyDate*` est ignoré silencieusement et re-télécharge tout. | Idem |
| Clients | API v1 `GET /customers` | Pagination simple | — |
| Produits | API v1 `GET /products` | Pagination simple ; contient les défauts d'expédition par produit | — |
| Boutiques + mapping de statuts | API v1 `GET /stores` | Un appel | — |
| Transporteurs, services, colis | `GET /carriers`, `/carriers/listservices`, `/carriers/listpackages` | Un appel par transporteur | — |
| Entrepôts | `GET /warehouses` | Un appel | — |
| Tags | `GET /accounts/listtags` | Un appel | — |
| Utilisateurs | `GET /users` | Un appel | — |
| **Automation rules** | ❌ aucun endpoint | Captures d'écran, transcription manuelle | — |
| **Shipping presets** | ❌ aucun endpoint | Captures d'écran | — |
| **Config d'impression** | ❌ aucun endpoint | Captures d'écran | — |
| **Templates email / packing slip** | ❌ aucun endpoint | Copier le HTML depuis l'éditeur | — |
| **Custom views / colonnes** | ❌ aucun endpoint | Captures d'écran | — |
| **PDF d'étiquettes passées** | Partiel | Les URLs de label expirent — si l'archivage légal compte, télécharger avant la bascule | — |

> **Rate limiting v1** : 40 requêtes par minute. Trois en-têtes sont renvoyés : `X-Rate-Limit-Limit`, `X-Rate-Limit-Remaining`, `X-Rate-Limit-Reset`. Prévoir un backoff qui les respecte plutôt qu'un `sleep` fixe.
>
> Durée d'extraction : avec `pageSize=500` (le maximum), le volume de Lasclay tient probablement en quelques dizaines de requêtes, soit quelques minutes. Estimer précisément une fois `99-config-lasclay.md` §14 (volumétrie) rempli, et lancer quand même l'extraction avec de la marge avant la bascule.

> **Archivage des étiquettes** : `[à vérifier]` la durée de conservation des PDF d'étiquettes côté ShipStation. Si l'archivage a une valeur légale ou comptable pour Lasclay, télécharger les PDF **avant** la résiliation plutôt que de compter sur les URLs stockées.

### 4.2 Séquence de bascule proposée

```
J-30  Extraction historique complète (froide) + import dans le nouveau système
      Transcription des automation rules et presets depuis les captures
J-21  Double exploitation démarre : les deux systèmes importent Shopify
      On expédie encore depuis ShipStation
J-21→J-7  Chaque jour : comparer les décisions d'automatisation des deux côtés
      Corriger les écarts. C'est ici que se joue le "seamless".
J-7   Bascule de l'expédition sur le nouveau système, ShipStation reste actif en lecture
J-1   Extraction delta (commandes modifiées depuis J-30)
J     Coupure de l'import Shopify côté ShipStation
J+30  Résiliation ShipStation, après vérification de l'archivage
```

### 4.3 Réconciliation

Trois compteurs à vérifier à chaque étape, sinon la migration est silencieusement fausse :

- Nombre de commandes par statut et par mois, des deux côtés
- Somme des `orderTotal` par mois
- Nombre d'expéditions non annulées par mois

---

## 5. Checklist de parité avant bascule

Cocher avant de couper ShipStation. Une case non cochée = un irritant quotidien découvert en production.

**Flux quotidien**
- [ ] Import Shopify automatique, délai ≤ celui de ShipStation
- [ ] Commandes préconfigurées par les règles (transporteur, service, colis, poids)
- [ ] Achat d'étiquette en ≤ le même nombre de clics
- [ ] Impression 4×6 sans réglage manuel
- [ ] Packing slip identique visuellement
- [ ] Tracking renvoyé vers Shopify
- [ ] Email client envoyé avec le bon branding

**Robustesse**
- [ ] Double achat d'étiquette impossible (idempotence testée)
- [ ] Annulation d'étiquette fonctionnelle
- [ ] Reprise après échec d'import sans doublon
- [ ] File de notification avec réessai
- [ ] Historique de statut consultable

**Données**
- [ ] Historique 12 mois importé et cherchable
- [ ] Compteurs de réconciliation à zéro d'écart
- [ ] Adresses validées avec leur statut d'origine

**Exploitation**
- [ ] Sauvegarde Postgres automatique et restauration testée
- [ ] Alerte si l'import Shopify n'a rien ramené depuis N heures
- [ ] Alerte si la file de notification s'accumule
- [ ] Un mode dégradé : pouvoir acheter une étiquette même si l'automatisation est en panne

---

## 6. Ce qu'il faut faire *mieux* que ShipStation

Tant qu'à reconstruire, autant corriger ce qui est documenté comme faible (détail en §16) :

- **Historique de statut** — inexistant chez ShipStation, indispensable pour le support client
- **Idempotence explicite** sur l'achat d'étiquette
- **Webhooks à payload complet** — ceux de ShipStation ne renvoient qu'une URL à re-interroger, ce qui double les appels
- **Fuseaux horaires corrects** partout
- **Préférences de colonnes persistées côté serveur** — le bug de réinitialisation est un irritant connu
- **Trace de décision d'automatisation** — pouvoir répondre à « pourquoi cette commande a-t-elle pris ce service ? »
- **Hotkey de tagging** — absent chez ShipStation
- **Multi-colis natif** — v1 ne le supporte pas, v2 partiellement
