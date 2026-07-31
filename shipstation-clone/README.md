# shipstation-clone — remplacer ShipStation sans abonnement

Une application complète : commandes, expéditions, lots, manifestes, retours, produits,
inventaire, clients, automatisation, gabarits, analytique, utilisateurs, webhooks, migration.
Aucune dépendance npm — `http` et `node:sqlite` natifs, une page unique.

```bash
export GENERAL_PROXY_SECRET=…            # pour la migration depuis ShipStation
node shipstation-clone/app/server.js     # http://localhost:3100
```

| Fichier | Rôle |
|---|---|
| `AUDIT.md` | l'audit : volumétrie réelle, modèle de données, inventaire fonctionnel, économie du drop-off, risques |
| `BRIEF_CLICKSHIP.md` | les questions à poser aux conseillers techniques ClickShip, dans l'ordre |
| `lib/` | la logique métier, un module par domaine |
| `app/` | le serveur HTTP et l'interface |
| `data/` | relevés de l'audit + la base SQLite du clone |

**L'enjeu :** pas l'abonnement, mais le tarif Canada Post drop-off à 6,31 $ —
**33 120 $ par an** sur les 12 derniers mois réels (`AUDIT.md` §7 bis).

---

## Ce qui est fait, ce qui ne l'est pas

Le clone couvre la surface fonctionnelle relevée dans l'audit. Une seule chose manque, et elle
ne dépend pas de nous.

| Domaine | État |
|---|---|
| Commandes : grille, filtres cumulables, tri, vues sauvegardées, recherche | fait |
| Statuts, Hold avec retour automatique, assignation, tags, champs personnalisés | fait |
| Scission (split) et fusion (combine) | fait |
| Alertes : poids manquant, adresse incomplète, sans courriel, douane, fusionnables, vieilles | fait |
| Lots : simulation de coût, achat groupé, tolérance aux échecs | fait |
| Expéditions : recherche, annulation, marquage expédié, suivi | fait |
| Manifestes de fin de journée | fait |
| Retours : RMA, cycle de vie complet | fait |
| Produits : fiches, défauts, groupes de préréglages, codes SH | fait |
| Inventaire : stock par entrepôt, seuils, alertes | fait |
| Clients : agrégats reconstruits depuis les commandes | fait |
| Automatisation : moteur SI/ALORS, règles chaînées, essai à blanc | fait |
| Gabarits : bordereaux et courriels en HTML + variables, aperçu | fait |
| Analytique : coûts, volumes, poids, services, coût vs encaissé, **écart au drop-off** | fait |
| Utilisateurs et permissions par domaine, rôles pré-remplis | fait |
| Webhooks, file de notifications, journal d'audit | fait |
| Exports CSV | fait |
| Migration depuis ShipStation | fait |
| **Achat réel d'étiquettes** | **bloqué — en attente de l'API ClickShip** |

Deux choses que ShipStation a et que le clone n'aura pas : l'application mobile (picking,
scan) et le portail de retours public. Elles sont documentées dans `AUDIT.md` §5 ; ni l'une ni
l'autre n'est utilisée aujourd'hui.

## Le seul point bloquant

L'adaptateur ClickShip est un **squelette qui échoue explicitement**. Aucun code n'a été écrit
contre une API que nous n'avons pas pu lire — les domaines Freightcom et ClickShip sont bloqués
par la politique réseau, et l'accès commercial est en cours.

Par défaut, l'application tourne sur un **bouchon** qui reprend les prix réellement observés.
Tout est exerçable — cotation, simulation de lot, achat, annulation, manifestes — sans dépenser
un sou et sans identifiants.

Quand les identifiants arriveront : compléter `lib/carrier.js` (quatre fonctions), lancer avec
`CARRIER_ADAPTER=clickship`, et **rien d'autre ne change**. C'est tout l'intérêt de la couture.

## Garde-fous

L'application ne peut pas dépenser d'argent par accident.

| Variable | Défaut | Effet |
|---|---|---|
| `CLONE_ALLOW_LABELS` | **non** | l'achat d'étiquettes renvoie 403. Cotation et simulation restent ouvertes |
| `CARRIER_ADAPTER` | `bouchon` | aucun appel transporteur réel |
| `CLONE_APP_SECRET` | — | mot de passe de l'interface. **À poser avant tout déploiement** |
| `CLONE_DB` | `data/clone.db` | fichier SQLite |
| `GENERAL_PROXY_SECRET` | — | requis uniquement pour la migration |
| `PORT` | 3100 | |

Les permissions sont vérifiées côté serveur, pas seulement dans l'interface : `labels_buy`,
`orders_delete`, `settings_edit` et les autres bloquent la route même appelée directement.
Tout passe au journal d'audit.

## Architecture

```
lib/db.js         schéma SQLite (26 tables), transactions réentrantes, journal d'audit
lib/orders.js     recherche filtrée, statuts, hold, tags, scission, fusion, alertes
lib/shipments.js  cotation, achat, annulation, lots, manifestes, suivi
lib/carrier.js    LE CONTRAT TRANSPORTEUR — quote/buy/void/track, bouchon, squelette ClickShip
lib/rules.js      moteur SI/ALORS : 18 champs, 14 opérateurs, 14 actions
lib/templates.js  moteur de gabarit (variables, if/else, for, filtres), échappement par défaut
lib/catalog.js    produits, préréglages, inventaire, clients, retours
lib/analytics.js  rapports, dont l'écart au tarif drop-off
lib/accounts.js   utilisateurs, permissions, webhooks, notifications
lib/ingest.js     migration ShipStation + import normalisé pour Shopify/Etsy/Faire
app/server.js     ~60 routes
app/public/       l'interface, une page
```

Le reste du code ne connaît **aucun transporteur** : tout passe par `lib/carrier.js`. Changer de
fournisseur, c'est écrire quatre fonctions.

## La règle qui porte l'économie

`lib/rules.js` livre cinq règles de départ, **créées désactivées** — à relire avant usage. La
première est celle qui compte :

```
SI poids < 500 g ET poids > 0 ET pays = CA
ALORS service = Canada Post Expedited Parcel (Drop-Off)
```

80,5 % des colis passent dessous. `choisirTarif()` dans `lib/carrier.js` applique la même
politique à l'achat : le moins cher, drop-off privilégié sous le seuil.

L'onglet **Analytique** mesure en continu l'écart entre ce qui est capté et ce qui reste sur la
table — c'est le tableau de bord du projet, pas un rapport décoratif.

## Migration — à faire avant toute résiliation

Réglages → *Lancer la migration*, ou :

```js
require("./lib/ingest").migrerDepuisShipStation({ depuis: "2025-08-01" });
```

Récupère commandes, articles, expéditions, fulfillments, produits, transporteurs, boutiques,
entrepôts et tags par le General Proxy, puis reconstruit les clients. **L'accès API disparaît
avec l'abonnement** — une fois résilié, ces données sont perdues.

## Prochaines étapes

1. **Obtenir l'accès API ClickShip** et coter un colis de 400 g Québec → Toronto. Si le tarif
   drop-off sort de l'API, le reste est de l'exécution (`BRIEF_CLICKSHIP.md` §A).
2. Compléter `lib/carrier.js`.
3. Brancher l'ingestion Shopify en direct (webhook `orders/create`), aujourd'hui via ShipStation.
4. Brancher un envoi SMTP : les notifications sont générées et mises en file, jamais envoyées.
5. Renvoyer le suivi vers Shopify, Etsy et Faire — ShipStation le fait aujourd'hui, le clone
   doit reprendre cette responsabilité (`AUDIT.md` §9).
6. Basculer entre mai et août : décembre fait 2 755 envois, juin en fait 142.
