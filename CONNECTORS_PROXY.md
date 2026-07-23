# connectors-proxy — proxy général pour connecteurs custom

Un seul service HTTP qui relaie, de façon **restreinte** (allowlist d'actions), vers plusieurs API tierces.
Chaque connecteur garde **ses secrets côté serveur** (variables Render) ; les appelants n'utilisent
qu'un `PROXY_SECRET` distinct et révocable. Même philosophie que `missive-proxy`, mais **multi-connecteurs**.

Connecteurs actuels :

- **ShipStation** (API v1 « legacy », commandes / expéditions / suivi), en **accès complet** :
  lecture + écriture (tags, hold, marquage expédié, création/suppression de commande, achat et
  annulation d'étiquettes). ⚠️ Les actions d'étiquette **débitent de l'argent réel**.
- **QuickBooks Online** (API v3, OAuth2), **lecture seule** : rapports (P&L, bilan, balance de
  vérification…), requêtes SQL-like, infos compagnie. Pourquoi ici : le connecteur QuickBooks
  officiel de Claude est une app Intuit US-only, bloquée pour une entreprise canadienne
  (« isn't available for use in your country ») ; on passe par notre propre app Intuit.

---

## Routes

| Méthode | Route | Auth | Rôle |
|---|---|---|---|
| `GET`  | `/health` | non | sonde |
| `GET`  | `/connectors` | non | liste connecteurs + actions dispo (aucun secret) |
| `POST` | `/:connecteur/:action` | `X-Proxy-Secret` | exécute une action (params en JSON) |

Réponse : `{ ok: true, connector, action, data }` ou `{ error }`.

### Actions ShipStation — lecture

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

### Actions ShipStation — écriture (accès complet)

Classées par risque. Les params marqués **requis** sont validés par le proxy avant l'appel.

| Action | Params (— requis en gras) | Effet / risque |
|---|---|---|
| `getrates` | **carrierCode, fromPostalCode, toPostalCode, toCountry, weight** `{value, units}` (+ serviceCode, packageCode, dimensions, confirmation, residential) | 🟢 devis de tarifs, **aucun effet de bord** |
| `addtag` / `removetag` | **orderId, tagId** (voir `listtags`) | 🟢 réversible, aucun coût |
| `holduntil` | **orderId, holdUntilDate** (AAAA-MM-JJ) | 🟢 met la commande en attente |
| `restorefromhold` | **orderId** | 🟢 remet la commande en file |
| `markasshipped` | **orderId, carrierCode** (+ trackingNumber, shipDate, notifyCustomer, notifySalesChannel) | 🟡 marque expédiée SANS étiquette; **notifie le client** sauf `notifyCustomer:false` |
| `createorder` | **orderNumber, orderDate, orderStatus, billTo, shipTo** (+ items, orderKey…) | 🟡 crée OU **modifie** (upsert par `orderKey`: les champs fournis écrasent) |
| `deleteorder` | **orderId** | 🔴 supprime/annule la commande (destructeur) |
| `createlabelfororder` | **orderId, carrierCode, serviceCode, shipDate** (+ weight, packageCode, testLabel) | 🔴 **achète** une étiquette = argent réel (wallet One Balance / compte) — `testLabel:true` pour essayer sans frais |
| `createlabel` | **carrierCode, serviceCode, shipDate, shipFrom, shipTo, weight** (+ isReturnLabel, testLabel) | 🔴 **achète** une étiquette hors commande (ou de RETOUR avec `isReturnLabel:true`) = argent réel |
| `voidlabel` | **shipmentId** | 🟡 annule une étiquette (généralement remboursée) |

### Actions QuickBooks (lecture seule)

| Action | Params | Renvoie |
|---|---|---|
| `report` | **name** (`ProfitAndLoss`, `BalanceSheet`, `TrialBalance`, `GeneralLedger`, `CashFlow`, `AgedReceivables`…) + options : `start_date`/`end_date` (AAAA-MM-JJ), `summarize_column_by` (`Month`…), `accounting_method` (`Accrual`\|`Cash`), `date_macro`… | le rapport (Columns + Rows) |
| `query` | **query** (SQL-like v3, ex. `select * from Account maxresults 200`) | résultats de la requête |
| `companyinfo` | — | infos compagnie (test d'auth) |

Exemple — le P&L mensuel de l'exercice (le format du chiffrier de prévisions) :

```
curl -X POST https://general-proxy-5muf.onrender.com/quickbooks/report \
  -H "X-Proxy-Secret: TON_SECRET" -H "Content-Type: application/json" \
  -d '{"name":"ProfitAndLoss","start_date":"2025-09-01","end_date":"2026-08-31","summarize_column_by":"Month","accounting_method":"Accrual"}'
```

---

## Mettre en place QuickBooks (une fois)

Le connecteur officiel Claude ↔ QuickBooks étant US-only, on utilise **notre app Intuit** :

1. **Créer l'app** : https://developer.intuit.com → *Create an app* → QuickBooks Online and
   Payments, scope `com.intuit.quickbooks.accounting`.
2. **Keys & credentials** (onglet **Production** pour la vraie compta) : noter **Client ID** et
   **Client Secret**, et ajouter l'URI de redirection
   `https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl`.
3. **Autoriser** (une fois) : `QBO_CLIENT_ID=... node qbo_auth.js url`, ouvrir l'URL, se
   connecter au compte QuickBooks Lasclay, autoriser, récupérer `code` et `realmId` dans l'URL
   de redirection, puis `QBO_CLIENT_ID=... QBO_CLIENT_SECRET=... node qbo_auth.js exchange <code> <realmId>`.
4. **Variables Render** (service General Proxy) : coller ce que l'étape 3 affiche
   (`QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REALM_ID`, `QBO_REFRESH_TOKEN`).
5. **Valider avant de déployer** : mêmes variables en local + `node qbo_check.js`.

### ⚠️ Rotation du refresh token (le piège classique QBO)

Intuit **remplace la valeur du refresh token ~toutes les 24 h** (seule la plus récente reste
valide; 100 jours max sans usage). Le disque Render étant éphémère, la seule persistance fiable
est la **sync automatique de la variable d'env via l'API Render** — le proxy le fait tout seul si :

| Variable | Valeur |
|---|---|
| `RENDER_API_KEY` | clé API Render (Account Settings → API Keys) |
| `RENDER_SERVICE_ID` | l'ID `srv-...` du service General Proxy (dans l'URL du dashboard) |

Sans ces deux variables, l'intégration casse au premier redémarrage passé 24 h
(`invalid_grant`) et il faut refaire l'autorisation (étape 3). `QBO_TOKEN_FILE` existe aussi
pour un disque persistant monté, mais sur le plan standard Render, la sync API est la bonne option.

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
| `GENERAL_PROXY_SECRET` | secret **propre à ce proxy** (distinct du missive-proxy, révocable à part). À défaut, repli sur `PROXY_SECRET`. |
| `SHIPSTATION_API_KEY` | API Key ShipStation (v1) |
| `SHIPSTATION_API_SECRET` | API Secret ShipStation (v1) |
| `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` | app Intuit (Keys & credentials, Production) |
| `QBO_REALM_ID` | Company ID QuickBooks (fourni par l'autorisation) |
| `QBO_REFRESH_TOKEN` | refresh token initial (sortie de `qbo_auth.js exchange`) |
| `RENDER_API_KEY` + `RENDER_SERVICE_ID` | sync auto du refresh token tournant (voir section QuickBooks) |
| `QBO_ENV` | `production` (défaut) ou `sandbox` |
| `PORT` | (auto, fourni par Render) |

> **Nom du secret** : ce proxy (service Render « General Proxy ») et le `missive-proxy` (« Proxy Missive »)
> sont deux services. Sur Render, chacun a son env isolé (pas de conflit). Mais dans l'environnement de
> Claude (un seul `.env`), deux secrets DIFFÉRENTS exigent deux NOMS différents :
> `MISSIVE_PROXY_SECRET` (Missive) et `GENERAL_PROXY_SECRET` (ce proxy). Si tu laisses
> `GENERAL_PROXY_SECRET` vide partout, ce proxy retombe sur `PROXY_SECRET`.

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
