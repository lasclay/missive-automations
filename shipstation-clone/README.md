# shipstation-clone — remplacer ShipStation sans abonnement

Une application complète : commandes, expéditions, lots, manifestes, retours, produits,
inventaire, clients, automatisation, gabarits, analytique, utilisateurs, webhooks, migration.
Aucune dépendance npm — `http` et `node:sqlite` natifs, une page unique.

## Déployer comme service web

L'application est un service multi-utilisateur : chaque employé a un **compte nominatif**, se
connecte avec un mot de passe, et ses droits sont vérifiés côté serveur. Il n'y a plus de secret
partagé — il ne disait pas qui avait fait quoi, ne se révoquait pas pour une seule personne, et
circulait dans les URL.

### Sur Render (recommandé)

`render.yaml` est un blueprint prêt à appliquer : New → Blueprint, pointer sur ce dépôt.

**Le disque persistant n'est pas optionnel.** Sans lui, le disque d'une instance Render est
effacé à chaque redéploiement et la base SQLite disparaît avec les 12 460 commandes migrées.
Cela impose l'offre *Starter* (le plan gratuit n'a pas de disque) — environ 7 $ US/mois plus le
disque. C'est le coût d'un service partagé ; il reste sans commune mesure avec les 33 000 $ en jeu.

Variables à saisir dans le tableau de bord Render, jamais dans le dépôt :

| Variable | Rôle |
|---|---|
| `GENERAL_PROXY_SECRET` | migration depuis ShipStation |
| `CLONE_ADMIN_EMAIL` | courriel du premier administrateur |
| `CLONE_ADMIN_PASSWORD` | facultatif — sinon un mot de passe est généré et affiché **une fois** dans les logs |
| `CLICKSHIP_API_KEY` | quand ClickShip aura répondu |

Render sert le service en HTTPS avec un domaine `*.onrender.com` ; les cookies de session sont
`Secure` par défaut. Pour un domaine à vous, l'ajouter dans Render — rien à changer dans le code.

Rappel : Render suit `main`. La branche `claude/shipstation-audit-clone-0gwmgr` doit être
fusionnée avant le premier déploiement.

### Premier démarrage

1. Le service crée un compte administrateur et **affiche son mot de passe dans les logs Render**.
   Le récupérer là, puis le changer à la première connexion — il n'est stocké que haché et ne
   réapparaîtra pas.
2. **Réglages → Lancer la migration** pour verser les données de ShipStation (quelques minutes).
   Sans migration, la grille est vide : c'est normal, pas une panne.
3. **Utilisateurs → Nouvel employé** : chaque compte reçoit un mot de passe provisoire affiché
   une seule fois, à transmettre de vive voix. L'employé doit le changer à sa première connexion.
   Clic droit sur une ligne pour réinitialiser un mot de passe oublié.

### Les rôles

| Rôle | Peut |
|---|---|
| `admin` | tout, y compris utilisateurs et réglages |
| `expediteur` | commandes, expéditions, **achat et annulation d'étiquettes**, retours |
| `preparateur` | consultation seule des commandes, expéditions et produits |
| `comptable` | consultation et rapports |

Les permissions sont vérifiées **au niveau des routes**, pas seulement dans l'interface : un
préparateur qui appellerait `/api/shipments/buy` directement reçoit un 403. Les menus auxquels il
n'a pas droit ne s'affichent pas non plus, mais c'est du confort, pas la sécurité.

### En local (développement)

```bash
git clone https://github.com/lasclay/missive-automations.git
cd missive-automations && git checkout claude/shipstation-audit-clone-0gwmgr
export GENERAL_PROXY_SECRET='…'
CLONE_COOKIE_SECURE=0 ./shipstation-clone/demarrer.sh     # cookies non-Secure car HTTP
```

**Node 22.5 ou plus récent** — l'application utilise `node:sqlite`. Aucune dépendance npm.

### Quand faudra-t-il PostgreSQL ?

SQLite sur un disque persistant convient à une équipe qui prépare des envois : les lectures sont
concurrentes, une seule écriture à la fois, et le volume est modeste (~700 envois/mois). Il faudra
migrer si vous voulez **plusieurs instances Render** simultanées, ou des sauvegardes ponctuelles
sans arrêt de service. `lib/db.js` est alors le seul fichier à reprendre : tout le reste passe par
`all/one/run/tx`.

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
| `CLONE_DB` | `data/clone.db` | fichier SQLite — sur Render, pointer dans le disque persistant |
| `GENERAL_PROXY_SECRET` | — | requis uniquement pour la migration |
| `CLONE_COOKIE_SECURE` | oui | mettre `0` uniquement en HTTP local |
| `CLONE_SESSION_HEURES` | 12 | durée d'une session (glissante) |
| `PORT` / `HOST` | 3100 / `0.0.0.0` | Render fournit `PORT` |

Les permissions sont vérifiées côté serveur, pas seulement dans l'interface : `labels_buy`,
`orders_delete`, `settings_edit` et les autres bloquent la route même appelée directement.
Tout passe au journal d'audit.

Pour autoriser l'achat, `./shipstation-clone/demarrer.sh --etiquettes` en local, ou
`CLONE_ALLOW_LABELS=1` sur Render. Sur un adaptateur réel, le script demande une confirmation
tapée avant de démarrer.

Côté authentification : mots de passe hachés en scrypt avec sel par compte, jetons de session
stockés hachés, cookies `HttpOnly` + `SameSite=Strict` + `Secure`, huit tentatives de connexion
par quart d'heure et par compte, sessions fermées d'office au changement de mot de passe.

## Architecture

```
lib/db.js         schéma SQLite (29 tables), transactions réentrantes, migrations, audit
lib/auth.js       comptes, scrypt, sessions par cookie, limitation des tentatives
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
