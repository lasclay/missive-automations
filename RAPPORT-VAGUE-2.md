# Vague 2 — rapport de fin de vague

Parité opérationnelle avec ShipStation. Branche `claude/shipstation-audit-clone-0gwmgr`.
Rédigé le 2026-08-03, à la suite de `RAPPORT-VAGUE-1.md`.

Tests : `verifier_criteres.js` **87/87**, `verifier_vues.js` **53/53**, `verifier.js` sans point
bloquant. Chaque écran a été rejoué au navigateur **sur la base migrée** — 39 122 commandes,
34 077 expéditions, 37 158 clients — et non sur le jeu de développement de 427 lignes.

---

## Les quarante items

Trente-six sur quarante sont faits. Les quatre restants — V2-01 et V2-02 pour la partie
production, et les deux dépendances de la migration — attendent la décision de bascule.

### Ce qui manquait entièrement et existe maintenant

| Écran | Avant | Après |
|---|---|---|
| **Expéditions** | 8 colonnes, aucune case à cocher | 14 colonnes dont les **6 jalons de communication** (pictogramme + horodatage), sélection de lignes, 5 actions en masse, filtre « client non prévenu » |
| **Cueillettes** | `GET /api/pickups` → 404 | écran complet, 5 comptes transporteur, programmer / confirmer / annuler |
| **Fiche client** | aucune ligne ouvrable sur 37 158 | identité, adresses distinctes, cumuls **recalculés**, historique cliquable |
| **Permissions** | 12 domaines stockés, aucun cochable | éditeur complet + garde-fou sur la dernière clé de gestion des comptes |
| **Page de lot** | modale en lecture seule, un bouton `Fermer` | la grille filtrée sur le lot, avec ses 21 actions |
| **Retours** | 278 attendus, 0 en base | 278 reconstitués depuis les étiquettes de retour |

### Ce qui existait mais mentait

| Défaut | Ce que l'écran disait | Ce qu'il dit maintenant |
|---|---|---|
| **BUG-041** sélection | « 100 sélectionnées » sur 856 | « Les 100 de cette page — sélectionner les 856 du filtre » |
| **BUG-042** recherche rapide | « Aucune commande » sur une commande qui existe | « Résultats pour "…" — toutes les commandes, tous statuts » |
| **BUG-036** tri | 7 en-têtes sur 12 réagissaient sans trier | les 12 trient, `aria-sort` suit |
| **BUG-040** actions | menu fermé quand la grille est vide | ouvert, entrées globales actives, les autres grisées **avec le motif** |
| **BUG-071** ⟳ | ouvrait un import — un bouton mutant à un clic | rafraîchit, et dit depuis quand l'écran date |
| **BUG-049** communication | rien | on voit enfin ce qui est parti sans prévenir le client |
| **BUG-054** retours | RMA rattaché à la première commande de la base | commande cherchée, **montrée**, confirmée |
| **BUG-055** motif | texte libre, donnée inexploitable | 13 motifs normalisés + précision libre à côté |
| **BUG-076** règles | `{"service_id":"99","package_id":"115317"}` | « Expedited Parcel », « Polymailer Small » |
| **BUG-067** tarifs | partait de « Jean-Simon Begin » | part de « LAS Capucins », l'entrepôt par défaut |
| **BUG-070** analytique | trois cartes vides, sans un mot | « aucune donnée » distingué de « le composant a planté » |
| **BUG-082** réglages | un tableau captait la molette, Sécurité inatteignable | 0 conteneur piégeant |

---

## Ce que la base migrée a appris, et que rien d'autre n'aurait montré

Le jeu de développement fait 427 lignes. Ces cinq constats n'apparaissent qu'à l'échelle réelle,
et quatre d'entre eux ne sont dans aucun rapport d'audit.

| Constat | Avant | Après |
|---|---|---|
| Écran Lots | **5,4 s** — deux tables balayées une fois par lot | **479 ms** (huit index) |
| Écrans qui s'écrasaient | « Lots » affiché au-dessus de la liste des clients, deux erreurs de page | chaque rendu numéroté ; les lectures en vol sont abandonnées à la navigation |
| Pagination hors bornes | « 10 251–856 sur 856 » | ramenée dans les bornes, puis rechargée |
| Compteur « en drop-off » | **0** sur 33 789 expéditions | 15 879 **admissibles** — le drapeau n'existe pas chez ShipStation, dire « non » était faux |
| Migration des produits | aurait écrit **403** lignes sur 473 | 473, dont 39 sans SKU et 32 doublons |

Le dernier mérite un mot : la contrainte `products.sku TEXT UNIQUE NOT NULL` aurait fondu les 39
produits sans SKU en un seul et perdu un produit de chaque paire de SKU en double — **sans une
erreur**, puisque l'enregistrement fait un `UPDATE` dès qu'il retrouve le SKU. C'est le genre de
perte qu'on ne découvre que des mois plus tard, en cherchant un produit qui n'existe plus.

## Accessibilité

Balayage de tous les éléments visibles porteurs de texte, seuil AA ajusté à la taille et à la
graisse : **0 échec en thème clair, 0 en thème sombre**.

Les trois échecs du rapport sont corrigés sur mesure (`.puce.g` 3,96 → 7,11 ; `.puce.v` 4,36 →
5,76 ; `--doux` sur le fond de page 4,38 → 5,39). Le balayage en a trouvé **deux autres, absents
du rapport** : en thème sombre les couleurs pleines sont claires, et le blanc posé dessus tombe à
2,12 sur le bouton « Créer + imprimer les étiquettes » et 2,92 sur la pastille d'alertes. Une
variable `--sur-plein` bascule du blanc au presque-noir selon le thème.

---

## Ce qui reste

**Vague 3 — parité fonctionnelle** : SmartFill, Rate Shopper, onglets de fiche produit, héritage
groupe → produit, import/export de produits, bloc douanier complet.

**Vague 4** : synchronisation continue, simulation généralisée, alerte de marge par commande,
diagnostic d'intégration réel.

**Toujours bloqué sur le propriétaire**, inchangé depuis la Vague 1 :

| Sujet | Ce qui manque |
|---|---|
| Relais de suivi Etsy et Faire | `ETSY_API_KEY`, `ETSY_TOKEN`, `ETSY_SHOP_ID`, `FAIRE_ACCESS_TOKEN` |
| Code de confirmation `5` | une étiquette réelle à examiner — 20 261 commandes en dépendent |
| Tarifs réels | les identifiants du compte transporteur |
| Bascule en production | la migration est prouvée en recette ; `node migrer.js --confirmer` après une sauvegarde relue |

L'achat d'étiquettes reste désactivé (`CLONE_ALLOW_LABELS` absent), conformément à la consigne.
