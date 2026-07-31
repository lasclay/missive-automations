# Paramètres du service

Deux familles : les **variables d'environnement** (au démarrage, dans le tableau de bord Render)
et les **réglages en base** (dans l'interface, modifiables à chaud).

Aucun secret ne doit être écrit dans le dépôt. Dans `render.yaml`, ceux marqués `sync: false`
sont saisis dans Render et n'y figurent jamais.

---

## 1. Variables d'environnement

### Indispensables

| Variable | Défaut | Rôle |
|---|---|---|
| `CLONE_DB` | `shipstation-clone/data/clone.db` | Fichier SQLite. **Sur Render, doit pointer dans le disque persistant** (`/var/data/clone.db`) — ailleurs, la base est effacée à chaque redéploiement. `verifier.js` le contrôle. |
| `GENERAL_PROXY_SECRET` | — | Secret d'appel du General Proxy. Requis pour la migration depuis ShipStation. Repli accepté : `PROXY_SECRET`. |
| `CLONE_ADMIN_EMAIL` | `admin@lasclay.com` | Courriel du premier administrateur, créé au tout premier démarrage. |

### Sécurité

| Variable | Défaut | Rôle |
|---|---|---|
| `CLONE_ADMIN_PASSWORD` | — | Mot de passe du premier administrateur. **Facultatif** : sans lui, un mot de passe est généré et affiché **une seule fois** dans les logs de démarrage. |
| `CLONE_COOKIE_SECURE` | activé | Cookies de session `Secure`. Mettre `0` **uniquement** en HTTP local. En production HTTPS, laisser tel quel : à `0`, les sessions circuleraient en clair. |
| `CLONE_SESSION_HEURES` | `12` | Durée d'une session, glissante — toute activité repousse l'expiration. |
| `CLONE_2FA_EMETTEUR` | `Lasclay Expéditions` | Nom affiché dans l'application d'authentification à côté du code. |

### Transport

| Variable | Défaut | Rôle |
|---|---|---|
| `CARRIER_ADAPTER` | `bouchon` | `bouchon` = tarifs de démonstration, aucun appel réel. `clickship` à réception des identifiants. |
| `CLONE_ALLOW_LABELS` | non | `1` autorise l'**achat réel** d'étiquettes. Sans lui, la route renvoie 403 ; cotation et simulation de lot restent ouvertes. |
| `CLICKSHIP_API_KEY` | — | Clé de l'API ClickShip / Freightcom. Sans effet tant que `CARRIER_ADAPTER=bouchon`. |

Les deux verrous sont indépendants : `CLONE_ALLOW_LABELS=1` sur le bouchon ne dépense rien.
Il faut **les deux** pour qu'un achat coûte de l'argent.

### Renvoi du suivi aux boutiques

Sans elles, les clients perdent leur numéro de suivi à la bascule. Chaque canal est actif
seulement si **toutes** ses variables sont présentes ; l'onglet Réglages indique lesquels le sont.

| Variable | Canal | Rôle |
|---|---|---|
| `SHOPIFY_STORE` | Shopify | `lasclay.myshopify.com` |
| `SHOPIFY_CLIENT_ID` | Shopify | App « Render connector » — la même que `support.js` et A2X |
| `SHOPIFY_CLIENT_SECRET` | Shopify | idem |
| `SHOPIFY_ADMIN_TOKEN` | Shopify | Repli hérité : un jeton `shpat_` fixe, si l'app n'est pas utilisée |
| `SHOPIFY_API_VERSION` | Shopify | Défaut `2025-07`, porté par le client partagé |
| `ETSY_API_KEY` | Etsy | Clé de l'application Etsy (`x-api-key`) |
| `ETSY_TOKEN` | Etsy | Jeton OAuth de la boutique |
| `ETSY_SHOP_ID` | Etsy | Identifiant numérique de la boutique |
| `FAIRE_ACCESS_TOKEN` | Faire | Jeton d'accès à l'API externe |

Le clone réutilise `a2x/lib/shopify.js`, donc l'app **« Render connector »** en *client
credentials* — la même que `support.js`, `shopify_check.js` et A2X. Le jeton dure ~24 h et se
renouvelle seul : il n'y a qu'une app dont gérer les portées, et aucun secret permanent ne dort
dans les variables du service.

**Une portée est à ajouter** sur l'app, puis re-release et réinstallation :
`write_merchant_managed_fulfillment_orders`. Les portées actuelles sont toutes en lecture ; sans
elle, la création de fulfillment échoue avec « access denied ». Voir `SHOPIFY_SETUP.md`.

### Réseau

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3100` | Render le fournit automatiquement. |
| `HOST` | `0.0.0.0` | Ne pas restreindre sur Render, sinon le service est injoignable. |
| `GENERAL_PROXY_URL` | `https://general-proxy-5muf.onrender.com` | À changer si le proxy déménage. |
| `NODE_VERSION` | — | Render seulement. **`22.22.2`** — la version où tout a été testé. Minimum absolu 22.5 : `node:sqlite` n'existe pas avant. |

`RENDER` et `RENDER_SERVICE_ID` sont injectées par la plateforme ; le service s'en sert
uniquement pour durcir ses contrôles (une base hors disque persistant devient bloquante).

---

## 2. Réglages en base

Modifiables dans l'interface, conservés dans la table `settings`. Ils survivent aux
redéploiements — contrairement aux variables, ils n'exigent pas de redémarrage.

| Réglage | Défaut | Où | Rôle |
|---|---|---|---|
| `marque` | Lasclay | Réglages | Nom, courriel, adresse, logo, message de bas de bordereau. Alimente bordereaux et courriels. |
| `tarif_dropoff_cible` | `6.31` | Réglages | Prix visé sous le seuil. Sert de référence à l'écart mesuré dans Analytique. |
| `exiger_2fa` | non | Réglages | Impose le second facteur à tous à la prochaine connexion, et interdit de le retirer. |
| `bascule_canaux` | non posé | Réglages | Date à partir de laquelle le clone notifie les boutiques. **Rien d'antérieur n'est jamais notifié.** À poser le jour où vous cessez d'acheter vos étiquettes dans ShipStation. |
| `derniere_migration` | — | automatique | Horodatage de la dernière migration. |
| `amorce` | — | automatique | Marque l'amorçage initial (gabarits et règles de départ). |

Le **seuil de poids du drop-off** (500 g) n'est pas un réglage : il vient du programme Canada Post
« envoi unique sous 1,1 lb » et vit dans `lib/carrier.js` (`SEUIL_DROPOFF_G`).

---

## 3. Configuration minimale par situation

**Développement local** — lecture et tri, aucun risque :

```bash
CLONE_COOKIE_SECURE=0 GENERAL_PROXY_SECRET='…' ./shipstation-clone/demarrer.sh
```

**Production, avant ClickShip** — les employés trient, personne ne peut dépenser :

```
CLONE_DB=/var/data/clone.db
NODE_VERSION=22.22.2
GENERAL_PROXY_SECRET=…
CLONE_ADMIN_EMAIL=…
SHOPIFY_STORE=lasclay.myshopify.com
SHOPIFY_CLIENT_ID=…        SHOPIFY_CLIENT_SECRET=…
ETSY_API_KEY=…             ETSY_TOKEN=…            ETSY_SHOP_ID=…
FAIRE_ACCESS_TOKEN=…
```

**Production, après ClickShip** — ajouter ces deux-là, et seulement quand vous le voulez :

```
CARRIER_ADAPTER=clickship
CLICKSHIP_API_KEY=…
CLONE_ALLOW_LABELS=1
```

---

## 4. Vérifier

```bash
node shipstation-clone/verifier.js
```

Contrôle version de Node, base réellement persistante, droits d'écriture, cookies Secure,
comptes et 2FA, données migrées, règles actives, proxy joignable. Code de sortie 1 s'il reste un
point bloquant.
