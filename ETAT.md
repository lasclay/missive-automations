# État du chantier — remise à niveau du clone ShipStation

Suivi des items du backlog de l'audit comparatif (`RAPPORT-TECHNIQUE.md`, § 11).
Conventions : `à faire` · `en cours` · `fait` · `bloqué (raison)`.

Dernière mise à jour : 2026-08-03. Rapport de fin de Vague 1 : `RAPPORT-VAGUE-1.md`.

Tests : `verifier_criteres.js` **87/87**, `verifier_vues.js` **53/53**, `verifier.js` sans point
bloquant. Chaque correctif d'interface est vérifié au navigateur, pas seulement dans le DOM —
un test qui lit l'arbre peut passer pendant que l'écran est cassé (leçon du z-index des menus).

---

## Vague 1 — avant toute mise en production

| # | Item | Anomalie | État | Note |
|---|---|---|---|---|
| V1-05 | `/api/backup` en NDJSON avec contre-pression | BUG-011 | **fait** | + route `/api/backup/verifier` : une sauvegarde qu'on n'a jamais relue n'est pas une sauvegarde |
| V1-16 | Restreindre `/api/config` anonyme | BUG-020 | **fait** | 4 champs sans session ; le reste exige une session |
| V1-17 | En-têtes de sécurité (CSP, HSTS, Permissions-Policy, COOP, CORP) | BUG-021 | **fait** | |
| V1-11 | Découpler la touche `B` de `acheterLot()` | BUG-010 | **fait** | `B` ouvre la création de lot ; `S` exige une confirmation chiffrée |
| V1-12 | Neutraliser les raccourcis mutants derrière une modale | BUG-026 | **fait** | |
| V1-13 | Fuite d'écouteurs `keydown` | BUG-034 | **fait** | un seul écouteur global |
| V1-26 | Router sur `hashchange` / `popstate` | BUG-053 | **fait** | |
| V1-07 | Scan : refuser toute commande non expédiable | BUG-008 | **fait** | bandeau bloquant, impression retirée |
| V1-08 | Scan : correspondance exacte, désambiguïsation | BUG-009 | **fait** | jamais `orders[0]` |
| V1-09 | Scan : `try/catch`, effacement avant appel, bip | BUG-015 | **fait** | |
| V1-10 | Scan : vider le champ après chaque lecture | BUG-032 | **fait** | |
| V1-15 | Afficher les erreurs d'API | BUG-014 | **fait** | squelette de chargement, panneau d'erreur avec `Réessayer`, bandeau « données périmées », `toast()` ; reste à propager aux écrans secondaires |
| V1-14 | Transposer les gabarits de courriel | BUG-012 | **fait** | variables inconnues refusées à l'enregistrement |
| V1-06 | Sémantique du moteur de filtres | BUG-007 | **fait** | voir « arbitrages » ci-dessous — la cause n'était pas celle du rapport |
| V1-22 | `position` unique sur les règles | BUG-073 | **fait** | index unique + renumérotation par dizaines au démarrage |
| V1-20 | `weight_g` → `order_weight`, actions normalisées | BUG-072/074/075 | **fait** | |
| V1-21 | Valider les règles à l'écriture ; pas de repli sur l'index 0 | BUG-017 | **fait** | les quatre sélecteurs (champ, portée, opérateur, action) gardent une valeur hors vocabulaire, la signalent et bloquent l'enregistrement — vérifié sur une règle piégée insérée en base |
| V1-30 | Marquer les tarifs de démonstration dans le tableau | BUG-018 | **fait** | bandeau non refermable, mention par ligne |
| V1-27 | Sélection hors vue | BUG-025 | **fait** | le panneau refuse de configurer une commande absente de la grille et propose de l'afficher ; chaque action en masse annonce son périmètre |
| V1-18 | Second facteur obligatoire + compte au courriel invalide | BUG-023/039 | **fait** | activation refusée tant qu'un compte actif n'a pas d'adresse valide, avec la liste ; liste blanche des réglages modifiables |
| V1-23 | Trancher `confirmation 5` | BUG-077 | **bloqué** | exige une étiquette réelle — voir « à trancher » |
| V1-19 | Relais de suivi Etsy et Faire | BUG-019 | **bloqué** | variables d'environnement non fournies |
| V1-01 à V1-04 | Migration ShipStation (produits, groupes, clients) | BUG-001/002/003/006 | **fait en recette** | jouée de bout en bout sur une copie : 38 852 commandes, 19 671 expéditions, 14 406 exécutions, 955 lots, 473 produits, 37 694 clients, 278 retours en 814 s. Le passage en production appartient au propriétaire — voir `RAPPORT-VAGUE-1.md` |
| V1-24 | Attribution des boutiques à l'import | BUG-013 | **fait** | la provenance se lit sur la commande ; `reparerBoutiques()` réattribue l'arriéré, à blanc par défaut |
| V1-25 | Réconciliation des montants | BUG-016 | **fait** | remises, remboursements et quantités courantes importés ; le résumé se reconstitue depuis les lignes et annonce ce qui ne se referme pas |
| V1-28 | Unifier bouton d'achat et `Expédié de` entre modale et panneau | BUG-028/029 | **fait** | `etatAchat()` et `entrepotResolu()` sont les règles uniques ; parité vérifiée au navigateur sur six commandes |
| V1-29 | Modale de mappage pré-remplie, propagation décochée | BUG-030 | **fait** | pré-remplie depuis la commande ; propagation à décocher | |

---

## Arbitrages et divergences avec le rapport

**BUG-007 — la cause n'est pas celle qui était supposée.** Le rapport attribue le « 0 au lieu de
417 » de la vue QC-ON à un ET appliqué là où il faut un OU. La reproduction montre que le OU sur
même colonne **était déjà implémenté** : le SQL généré contient bien
`state IN (?) OR state IN (?)`. Le défaut réel est un **écart de domaine de valeurs** — la vue
porte `CA-ON` / `CA-QC` (format ISO 3166-2 de ShipStation) alors que la base stocke `ON` / `QC`
(code de province tel que Shopify l'envoie). Corrigé par une normalisation des subdivisions des
deux côtés de la comparaison, ce qui traite aussi les futures vues importées.

**Règle 3 bis, elle, manquait vraiment.** Le regroupement se faisait sur `champ + portée` sans
l'opérateur : deux critères sur la même colonne avec des opérateurs différents étaient combinés en
OU alors qu'ils doivent l'être en ET. C'est ce qui fait fonctionner les vues « Graines x1/x5/x10 ».
Corrigé.

**BUG-077 — à trancher par le propriétaire.** Le code de confirmation `5` vaut-il « Do Not Safe
Drop » ou « Delivery Code » ? 20 261 commandes en dépendent. La configuration Lasclay le documente
comme « Do Not Safe Drop » (§13.3 de la spécification) et c'est ce que le clone applique, mais la
vérification sur une étiquette réelle n'a pas pu être faite ici.

---

## Ce qui reste bloqué et pourquoi

| Sujet | Ce qui manque |
|---|---|
| ~~Migration~~ | **Débloquée.** Le General Proxy expose 33 actions ShipStation et répond ; la migration existait et n'avait jamais été lancée. Faite en recette, reste à confirmer en production |
| Relais de suivi Etsy et Faire | Les variables d'environnement du service |
| `confirmation 5` | Une étiquette réelle à examiner |
| Tarifs réels | Les identifiants du compte transporteur ; l'adaptateur est un bouchon et le dit désormais dans chaque ligne du tableau |
