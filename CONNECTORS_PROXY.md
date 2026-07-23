# connectors-proxy — proxy général pour connecteurs custom

Un seul service HTTP qui relaie, de façon **restreinte et lecture seule**, vers plusieurs API tierces.
Chaque connecteur garde **ses secrets côté serveur** (variables Render) ; les appelants n'utilisent
qu'un `PROXY_SECRET` distinct et révocable. Même philosophie que `missive-proxy`, mais **multi-connecteurs**.

Premier connecteur : **ShipStation** (API v1 « legacy », commandes / expéditions / suivi).

---

## Routes

| Méthode | Route | Auth | Rôle |
|---|---|---|---|
| `GET`  | `/health` | non | sonde |
| `GET`  | `/connectors` | non | liste connecteurs + actions dispo (aucun secret) |
| `POST` | `/:connecteur/:action` | `X-Proxy-Secret` | exécute une action (params en JSON) |

Réponse : `{ ok: true, connector, action, data }` ou `{ error }`.

### Actions ShipStation (lecture seule)

| Action | Params utiles | Renvoie |
|---|---|---|
| `orders` | `orderNumber`, `orderStatus` (`awaiting_shipment`\|`shipped`\|`on_hold`\|`cancelled`…), `customerName`, `storeId`, `createDateStart`/`End`, `page`, `pageSize` (max 500) | commandes + articles |
| `order` | `orderId` (entier interne ShipStation) | une commande |
| `shipments` | `orderNumber`, `trackingNumber`, `carrierCode`, `shipDateStart`/`End` | expéditions + **numéro de suivi** |
| `fulfillments` | `orderNumber`, `trackingNumber` | fulfillments (expédiés hors étiquette SS) |
| `carriers` | — | transporteurs configurés |
| `stores` | `showInactive` | boutiques reliées |
| `warehouses` | — | entrepôts |
| `listtags` | — | tags de commande |

---

## Où trouver les clés ShipStation

Dans ShipStation : **Account → API Settings** (Settings ⚙️ → Account → API Settings).
Clique **Generate API Keys** si ce n'est pas déjà fait. Tu obtiens :

- **API Key**
- **API Secret**

> Ce sont les clés de l'**API v1** (`ssapi.shipstation.com`, auth Basic). C'est celle qu'utilise ce proxy.
> (ShipStation propose aussi une API v2 `api.shipstation.com` avec un en-tête `API-Key` ; on n'en a pas
> besoin pour les lectures commandes/suivi.)

Limite de débit v1 : **40 requêtes / minute**. Le proxy respecte l'en-tête `X-Rate-Limit-Reset` sur 429.

---

## Variables d'environnement (Render)

| Variable | Valeur |
|---|---|
| `CONNECTORS_PROXY_SECRET` | secret **propre à ce proxy** (recommandé — distinct du missive-proxy, révocable à part). À défaut, repli sur `PROXY_SECRET`. |
| `SHIPSTATION_API_KEY` | API Key ShipStation (v1) |
| `SHIPSTATION_API_SECRET` | API Secret ShipStation (v1) |
| `PORT` | (auto, fourni par Render) |

> **Nom du secret** : ce proxy et le `missive-proxy` sont deux services. Sur Render, chacun a son env
> isolé (pas de conflit). Mais dans l'environnement de Claude (un seul `.env`), deux secrets DIFFÉRENTS
> exigent deux NOMS différents : `PROXY_SECRET` (Missive) et `CONNECTORS_PROXY_SECRET` (ce proxy). Si tu
> laisses `CONNECTORS_PROXY_SECRET` vide partout, les deux proxies partagent `PROXY_SECRET`.

Un connecteur sans ses variables est simplement **désactivé** (les autres fonctionnent). `/connectors`
indique `enabled: true/false` par connecteur.

---

## Déployer sur Render

Service **séparé** du `missive-proxy`. `server.js` est à la **racine** du repo :

1. **New → Web Service**, repo `lasclay/missive-automations`, **Root Directory** = *(laisser vide — racine)*.
2. **Runtime** Node · **Build** `npm install` (ou vide) · **Start** `node server.js`.
3. **Environment** : les variables ci-dessus.
4. Déploie. L'URL ressemblera à `https://connectors-proxy.onrender.com`.

> `server.js` (le proxy) et `missive-proxy/server.js` (le proxy Missive) sont deux services Render
> distincts : celui-ci tourne depuis la racine, l'autre depuis son sous-dossier `missive-proxy/`.

---

## Tester

**Avant de déployer** — valider les clés en local (ne modifie rien) :

```
SHIPSTATION_API_KEY=xxx SHIPSTATION_API_SECRET=yyy node shipstation_check.js L-50468
```

**Une fois déployé** — sonde + introspection (sans secret) :

```
curl https://connectors-proxy.onrender.com/health
curl https://connectors-proxy.onrender.com/connectors
```

Une action (avec secret) :

```
curl -X POST https://connectors-proxy.onrender.com/shipstation/orders \
  -H "X-Proxy-Secret: TON_SECRET" -H "Content-Type: application/json" \
  -d '{"orderNumber":"L-50468"}'

curl -X POST https://connectors-proxy.onrender.com/shipstation/shipments \
  -H "X-Proxy-Secret: TON_SECRET" -H "Content-Type: application/json" \
  -d '{"trackingNumber":"1Z..."}'
```

---

## Ajouter un connecteur plus tard

Dans `server.js`, copie le bloc `shipstation` : donne-lui un `name`, une fonction `enabled()` (ses
variables d'env), et un objet `actions` (l'allowlist des appels permis). Ajoute-le à `CONNECTEURS`.
Rien d'autre à changer — le routage `/:connecteur/:action`, l'auth et la gestion 429 sont génériques.
