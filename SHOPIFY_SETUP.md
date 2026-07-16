# Brancher Shopify sur `support.js` (vérification du vrai statut de commande)

Quand Shopify est configuré, `support.js` retrouve chaque commande (numéro `L-xxxxx` repéré dans le
sujet ou le fil) et injecte son **vrai statut** dans le prompt avant de rédiger :
date, articles, payée, **expédiée / en préparation**, numéro + **lien de suivi**, et l'**état du
colis rapporté par Shopify** (`shipment_status` : en transit, en cours de livraison, livré, tentative…).
Aucun appel externe : l'état du colis vient de Shopify lui-même.

Sans configuration Shopify, le script se comporte **exactement comme avant** (formulations prudentes).
C'est 100 % additif et sans risque. Utile surtout pour la boîte **« Mise à jour commande »**.

---

## L'app Shopify : « Render connector » (Dev Dashboard)

> Depuis fin 2025, on **ne crée plus** de « custom app » dans l'admin du magasin : tout passe par le
> **Dev Dashboard**. On crée **une seule** app réutilisable par plusieurs scripts (« Render connector »),
> et on l'authentifie en **client credentials** (server-to-server, sans OAuth navigateur ni jeton à
> copier à la main : le script échange `client_id` + `client_secret` contre un jeton de ~24 h, renouvelé
> automatiquement).

### Étapes (dans l'app « Render connector »)

1. **URLs → App URL** : `https://proxy-missive.onrender.com`
   *(URL réelle que vous possédez ; jamais appelée en client credentials. Décochez « Embed app in Shopify admin ». Redirect URLs / POS / App proxy : vides.)*
2. **API access → Scopes** (liste séparée par des virgules) :
   `read_orders,read_fulfillments,read_all_orders,read_products,read_inventory`
   *(lecture seule. `read_all_orders` = commandes de **plus de 60 jours** (Retours-Échanges anciens).
   `read_products` + `read_inventory` = **stock réel** injecté au catalogue, pour que l'IA réponde
   aux questions de disponibilité au lieu d'escalader. Sans ces deux derniers, le script retombe sur
   la disponibilité publique du storefront (moins fiable).)*
3. **Release** la version.
4. **Installer l'app sur la boutique** `lasclay` (distribution personnalisée / custom distribution).
5. Récupérer, dans les réglages de l'app, le **Client ID** et le **Client Secret**.

> `read_orders` couvre les 60 derniers jours par défaut, ce qui inclut toute la prévente de la fin mai.
> Pour des commandes plus anciennes, demandez `read_all_orders` dans la même page de portées.

---

## Variables à mettre dans Render (service qui exécute `support.js`)

| Variable                | Valeur                                   |
|-------------------------|------------------------------------------|
| `SHOPIFY_STORE`         | `lasclay.myshopify.com`                  |
| `SHOPIFY_CLIENT_ID`     | Client ID de l'app « Render connector »  |
| `SHOPIFY_CLIENT_SECRET` | Client Secret de l'app                   |
| `SHOPIFY_API_VERSION`   | `2024-10` (facultatif)                   |

*(Alternative héritée : si vous avez déjà un jeton Admin fixe `shpat_…`, mettez plutôt
`SHOPIFY_ADMIN_TOKEN` — le script accepte les deux modes.)*

Au prochain run, le log affichera :
`Shopify (statut commande + état du colis): ACTIF (lasclay.myshopify.com, API 2024-10, auth client credentials).`

### Vérifier avant de déployer

```
SHOPIFY_STORE=lasclay.myshopify.com \
SHOPIFY_CLIENT_ID=xxx SHOPIFY_CLIENT_SECRET=yyy \
node shopify_check.js L-50468
```
Affiche le vrai statut d'une commande (statut d'expédition, état du colis, articles, lien de suivi),
ou un message clair si l'auth / la portée `read_orders` sont invalides. Lecture seule.

---

## Déployer `support.js` sur Render (rappel)

`support.js` est un **script batch** (pas le proxy), lancé comme **Cron Job** Render :

1. **New → Cron Job**, repo `lasclay/missive-automations`, **Root Directory** vide (racine).
2. **Runtime** Node · **Build** `npm install` (ou vide) · **Command** `node support.js`.
3. **Schedule** : ex. `0 12,17,21 * * *` (3 fois/jour).
4. **Environment** (secrets) : `MISSIVE_TOKEN`, `ANTHROPIC_API_KEY`, les variables Shopify ci-dessus.
   **Rodage** : `DRY_RUN=true` d'abord (log seulement), puis `DRY_RUN=false` (brouillons),
   puis éventuellement `AUTO_SEND=true`.

> Le proxy (`missive-proxy/`) reste un service **séparé** : il ne fait que relayer des appels Missive
> et n'a besoin ni de la clé Anthropic ni des identifiants Shopify.
