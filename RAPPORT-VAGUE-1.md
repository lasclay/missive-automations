# Vague 1 — rapport de fin de vague

Chantier de remise à niveau du clone ShipStation, à partir du rapport d'audit comparatif.
Branche `claude/shipstation-audit-clone-0gwmgr`. Rédigé le 2026-08-03.

Tests : `verifier_criteres.js` **87/87**, `verifier_vues.js` **53/53**, `verifier.js` sans point
bloquant. Chaque correctif d'interface a été rejoué au navigateur, pas seulement lu dans le DOM.

---

## Ce qui est fait

| Item | Avant | Après |
|---|---|---|
| **V1-05** Sauvegarde | `/api/backup` : 502 après 30 s d'indisponibilité du service | NDJSON en flux, 810 Ko en 0,17 s, service répondant pendant la copie ; route `/api/backup/verifier` qui relit et détecte une troncature |
| **V1-06** Moteur de filtres | vue « QC-ON » : **0** commande | **257** ; les 27 vues rendent le même compte en SQL et en mémoire |
| **V1-07 à V1-10** Poste de scan | une commande déjà expédiée s'ouvrait avec le bouton d'impression actif ; saisie partielle → `orders[0]` | refus motivé avec date et suivi ; correspondance exacte, 25 candidats listés en cas d'ambiguïté ; champ vidé dans un `finally` |
| **V1-11** Raccourci `B` | appelait `acheterLot()` | ouvre la création de lot ; `S` exige une confirmation chiffrée |
| **V1-14** Gabarits de courriel | absents | transposés ; une variable inconnue est refusée à l'enregistrement |
| **V1-15** Erreurs d'API | jamais affichées | squelette de chargement, panneau d'erreur avec `Réessayer`, bandeau « données périmées », `toast()` |
| **V1-16/17** Sécurité HTTP | `/api/config` public livrait la configuration ; aucun en-tête | 4 champs sans session ; CSP à nonce, HSTS, COOP, CORP, Permissions-Policy |
| **V1-18** Second facteur | réglage décoratif ; un compte au courriel `lasclay.myshopify.com` | enrôlement forcé, retrait interdit, **activation refusée** tant qu'un compte actif n'a pas d'adresse valide — avec la liste |
| **V1-21/22** Règles | un `<select>` hors vocabulaire retombait sur l'index 0 ; deux règles en position 10 | les quatre sélecteurs gardent la valeur inconnue, la signalent, bloquent l'enregistrement ; index unique et renumérotation |
| **V1-24** Boutiques | **1** boutique portait tout ; compteurs « En attente » vides | **3** boutiques (LAS Shopify 850, Manual Orders 5, LAS Etsy 1) ; `on_hold` et `awaiting_payment` reconnus |
| **V1-25** Montants | `Produits = total − taxes − livraison`, faux dès qu'il y a une remise | reconstitué depuis les lignes ; remise, remboursement et quantité courante importés ; ce qui ne se referme pas est **annoncé** |
| **V1-27** Sélection hors vue | le panneau configurait une commande absente de la grille | il le dit, propose de l'afficher ou de vider ; chaque action en masse annonce son périmètre |
| **V1-28** Modale ⇄ panneau | bouton d'achat actif d'un côté, grisé de l'autre ; entrepôt différent selon l'écran | `etatAchat()` et `entrepotResolu()` sont les règles uniques — parité vérifiée sur six commandes |
| **V1-01 à V1-04** Migration | jamais lancée | **jouée en recette de bout en bout**, voir ci-dessous |

## La migration, en recette

Jouée sur une **copie** de la base, jamais sur la production — `node migrer.js --recette`.
Durée 814 s (13 min 34 s), dix étapes sur dix terminées.

| Objet | Migré | Note |
|---|---|---|
| Commandes | **38 852** | dont ~10 300 antérieures à ce que l'import Shopify avait ramené — l'historique remonte à 2022 |
| Lignes de commande | 77 017 | |
| Expéditions | 19 671 | 31 368 lignes rattachées ; 2 709 sans commande (purgée chez ShipStation), conservées car elles portent le coût réel |
| Exécutions (fulfillments) | **14 406** | |
| Lots | **955** | reconstitués depuis le `batchNumber` de chaque expédition |
| Produits | **473** | dont **39 sans SKU** et **32 SKU en double** |
| Clients | **37 694** lus, 37 158 fiches | 38 973 commandes rattachées à un client |
| Retours | **278** | reconstitués depuis les étiquettes de retour |
| Services / types de colis | 117 / 28 | |
| Coût cumulé des expéditions | 231 431,11 $ | |

**Ce que la migration aurait cassé si elle avait été lancée telle quelle.** La table `products`
portait `sku TEXT UNIQUE NOT NULL`. Sur 473 produits, 39 n'ont aucun SKU et 32 SKU sont portés par
deux produits : l'import aurait écrit **403 lignes au lieu de 473**, en silence, puisque
l'enregistrement fait un `UPDATE` dès qu'il retrouve le SKU. L'identité est désormais
`external_id` (le `productId` de ShipStation) et le SKU redevient un attribut facultatif.

## Ce que la migration a appris sur les montants

Sur un échantillon de 3 000 commandes réelles issues de ShipStation, **8,4 %** affichent un total
qui ne se reconstitue pas depuis leurs lignes, pour un écart moyen de 87,84 $. Le motif est
toujours le même et se lit à l'œil nu :

```
L-26416 : produits 83,98 $ · livraison 9,50 $ · taxes 14,01 $ · total annoncé 23,51 $
          23,51 = 9,50 + 14,01 — le produit ne compte pas
```

Ce sont des commandes remboursées : ShipStation met le total à zéro et laisse les lignes au prix
catalogue. Le clone ne peut pas inventer la donnée manquante — mais il ne prétend plus le
contraire. L'écran affiche « Montants non synchronisés » avec le montant reconstitué, et l'écran
Alertes chiffre l'ampleur. Par le chemin Shopify, qui expose remises et remboursements, la
réconciliation est exacte : les deux cas relevés à l'audit (L-50765 remisée de 8,99 $, L-46628
entièrement remboursée) se referment au cent près et sont couverts par des tests.

---

## Ce qui reste bloqué, et sur quoi

| Sujet | Ce qui manque | Qui peut le débloquer |
|---|---|---|
| Relais de suivi Etsy et Faire (V1-19) | `ETSY_API_KEY`, `ETSY_TOKEN`, `ETSY_SHOP_ID`, `FAIRE_ACCESS_TOKEN` sur le service Render | le propriétaire |
| Code de confirmation `5` (V1-23) | une étiquette réelle à examiner. 20 261 commandes en dépendent. La spécification Lasclay le documente comme « Do Not Safe Drop » et c'est ce que le clone applique | le propriétaire |
| Tarifs réels | les identifiants du compte transporteur ; l'adaptateur est un bouchon et le dit dans chaque ligne du tableau | le propriétaire |
| Motif et articles des 278 retours | ShipStation ne les stocke pas non plus — à ressaisir ou à laisser vides | — |

## Ce qui n'a pas été fait, et pourquoi

**La migration n'a pas été lancée en production.** La consigne du rapport (§2.1) est explicite :
aucun import de masse sans sauvegarde vérifiée et sans avoir joué la même opération sur une copie.
La copie est faite et le résultat est ci-dessus ; le passage en production est une décision du
propriétaire, pas une conséquence automatique. La commande est `node migrer.js --confirmer`, et il
faut d'abord une sauvegarde relue par `/api/backup/verifier`.

**L'achat d'étiquettes reste désactivé** (`CLONE_ALLOW_LABELS` absent), conformément à la consigne.

---

## Divergences avec le rapport d'audit

**BUG-007 — la cause n'était pas celle qui était supposée.** Le rapport attribue le « 0 au lieu de
417 » à un ET appliqué là où il faut un OU. Le OU sur même colonne était déjà implémenté : le SQL
généré contient bien `state IN (?) OR state IN (?)`. Le défaut réel est un **écart de domaine de
valeurs** — la vue porte `CA-ON` (ISO 3166-2, format ShipStation), la base stocke `ON` (code de
province Shopify). Corrigé par une normalisation des subdivisions des deux côtés, ce qui traite
aussi les vues importées plus tard.

**La règle 3 bis, elle, manquait vraiment.** Le regroupement se faisait sur `champ + portée` sans
l'opérateur : deux critères sur la même colonne avec des opérateurs différents étaient combinés en
OU au lieu de ET. C'est ce qui fait fonctionner les vues « Graines x1/x5/x10 ».

**La migration n'était pas bloquée sur un accès API.** Le rapport la donne pour impossible faute
d'identifiants ShipStation. Le General Proxy expose 33 actions ShipStation, dont `products`,
`customers` et `warehouses`, et il répond. Le code de migration existait et couvrait tout ; il
n'avait simplement jamais été exécuté.
