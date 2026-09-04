# connectors-proxy — proxy général pour connecteurs custom

Un seul service HTTP qui relaie, de façon **restreinte** (allowlist d'actions), vers plusieurs API tierces.
Chaque connecteur garde **ses secrets côté serveur** (variables Render) ; les appelants n'utilisent
qu'un `PROXY_SECRET` distinct et révocable. Même philosophie que `missive-proxy`, mais **multi-connecteurs**.

Connecteurs actuels :

- **ShipStation** (API v1 « legacy », commandes / expéditions / suivi), en **accès complet** :
  lecture + écriture (tags, hold, marquage expédié, création/suppression de commande, achat et
  annulation d'étiquettes). ⚠️ Les actions d'étiquette **débitent de l'argent réel**.
- **Omnisend** (API v3, marketing courriel/SMS) : contacts, campagnes, commandes, produits,
  paniers en lecture ; création/mise à jour de contacts et déclenchement d'événements
  (automations) en écriture.
- **Happy Returns** (API partenaire, `partner.happyreturns.com`) : la plateforme de **retours**
  de Lasclay. Lecture des retours (par no de commande, courriel ou code express), des envois
  groupés et du NPS ; écritures : approbation d'articles (⚠️ **rembourse le client**), contenu
  des sacs reçus en entrepôt, et retours « headless » (création / expiration).
- **QuickBooks Online** : DÉMÉNAGÉ dans un service dédié (`finance-proxy/`) pour isoler les
  finances — secrets Intuit et secret d'appel séparés de ce proxy. Voir
  `finance-proxy/FINANCE_PROXY.md`.

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
| `carrier` | **carrierCode** | un transporteur (solde, compte à provisionner) |
| `listservices` | **carrierCode** | **catalogue des `serviceCode`** du transporteur |
| `listpackages` | **carrierCode** | **catalogue des `packageCode`** du transporteur |
| `products` | `sku`, `name`, `productCategoryId`, `tagId`, `showInactive`, `page`, `pageSize` | fiches produit (poids, douane, défauts d'expédition) |
| `product` | **productId** | une fiche produit |
| `customers` | `stateCode`, `countryCode`, `marketplaceId`, `tagId`, `page`, `pageSize` | clients agrégés (adresse, volume) |
| `customer` | **customerId** | un client |
| `users` | `showInactive` | utilisateurs du compte (le `userId` GUID des expéditions) |
| `warehouse` | **warehouseId** | un entrepôt / *Ship From Location* |
| `store` | **storeId** | une boutique |
| `storerefreshstatus` | **storeId** | état du dernier import de la boutique |
| `marketplaces` | — | catalogue des canaux de vente intégrables |
| `listbytag` | **orderStatus, tagId** | commandes portant un tag |
| `webhooks` | — | abonnements webhook (`ORDER_NOTIFY`, `SHIP_NOTIFY`…) |

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

### Actions Omnisend

| Action | Params | Effet |
|---|---|---|
| `contacts` | `email`, `status` (`subscribed`\|`unsubscribed`\|`nonSubscribed`), `segmentID`, `limit` (max 250), `after` | 🟢 liste de contacts |
| `contact` | **contactID** | 🟢 un contact |
| `campaigns` / `campaign` | `status`, `limit`, `after` / **campaignID** | 🟢 campagnes |
| `orders` / `products` / `carts` | `limit`, `after`, `email`… | 🟢 données synchronisées |
| `createcontact` | **body** (objet contact v3 : `identifiers[{type:"email",id,channels:{email:{status}}}]`, `firstName`, `tags`…) | 🟡 crée/abonne un contact |
| `updatecontact` | **contactID, body** (PATCH partiel) | 🟡 modifie statut/champs/tags |
| `triggerevent` | **body** (`eventID` ou `systemName`, `email`, `fields`) | 🟡 déclenche les automations qui écoutent cet événement |

Limite de débit Omnisend : 400 requêtes / minute (Retry-After respecté sur 429).

### Actions Klaviyo (lecture seule — export / migration)

Auth Klaviyo : clé privée `pk_...` + en-tête `revision` (défaut `2025-04-15`, surchargée par
`KLAVIYO_REVISION`). Pagination par curseur : passer `"page[cursor]"` (extrait de `links.next`
de la réponse précédente) et `"page[size]"` (max 100) dans les params. Les limites de débit
varient par endpoint (429 + `Retry-After`, gérés par le proxy).

| Action | Params | Effet |
|---|---|---|
| `profiles` | `filter`, `sort`, `"page[size]"`, `"page[cursor]"`, `"additional-fields[profile]": "subscriptions"` | 🟢 profils (avec consentements) |
| `profile` | **id** | 🟢 un profil |
| `lists` / `list` / `listprofiles` | — / **id** / **id** + pagination | 🟢 listes et membres |
| `segments` / `segment` / `segmentprofiles` | — / **id** (+ `"additional-fields[segment]": "profile_count"`) / **id** + pagination | 🟢 segments, définitions, membres |
| `flows` / `flow` | — / **id** + `"additional-fields[flow]": "definition"` | 🟢 flows (définition complète réimportable) |
| `campaigns` / `campaign` / `campaignmessage` | `filter` **obligatoire** (ex. `equals(messages.channel,'email')`) / **id** / **id** | 🟢 campagnes et messages |
| `templates` / `template` | — / **id** (HTML dans `attributes.html`) | 🟢 gabarits courriel |
| `events` | `filter`, pagination | 🟢 événements (échantillonnage/archives) |
| `metrics` / `tags` / `forms` / `images` / `coupons` | pagination | 🟢 référentiels |

**Export en masse** : `node klaviyo_export.js profiles <dossier>` exporte TOUS les profils
(consentements email/SMS + horodatages — preuve LCAP) en CSV réimportable, avec reprise sur
interruption (fichier `.cursor`). Aussi : `list <ID>`, `segment <ID>`, `suppressed`.

### Actions Happy Returns

Auth Happy Returns : un seul en-tête, `X-Hr-Apikey: <HAPPY_RETURNS_API_KEY>`. L'identifiant du
détaillant (`happyReturnsRetailerID`) est **injecté par le proxy** depuis
`HAPPY_RETURNS_RETAILER_ID` ; on peut toujours le passer explicitement dans les params, il a
alors priorité. Limite de débit : *leaky bucket* — un 429 dit dans son **corps** combien de
secondes attendre (`too many requests: limit 0.5 requests/sec, leaky bucket size X`), sans
en-tête `Retry-After` garanti. Donc : pas de rafales, un retour à la fois.

| Action | Params (— requis en gras) | Effet |
|---|---|---|
| `return` | **un seul** de `orderNumber` \| `email` \| `happyReturnsExpressCode` (+ `cursor`) | 🟢 état d'un retour : articles, motifs, remboursements, suivi. `204` sans corps = aucun retour trouvé (pas une erreur). Deux critères à la fois = refusé |
| `outboundshipments` | `startDateTime`, `endDateTime` (AAAA-MM-JJ ou ISO-8601 UTC ; défaut 24 h) | 🟢 envois groupés Happy Returns → entrepôt |
| `outboundshipment` | **id** (+ `"page[after]"`, `"page[before]"`, `"page[size]"` — défaut 50, max 1000) | 🟢 contenu article par article d'un envoi groupé |
| `npsoverview` | **days** (1 à 30) | 🟢 NPS agrégé |
| `npsdetailed` | **days** (1 à 30) (+ `cursor`) | 🟢 NPS détaillé, 300 enregistrements par page |
| `returncontents` | **items** `[{happyReturnsItemID, returnBagBarcode, checkedInAt, disposition}]` (max 1000) | 🟡 déclare à Happy Returns ce qu'on a reçu en entrepôt. `happyReturnsItemID: "unidentified"` exige `unidentifiedItemType` + `unidentifiedItemIndex` |
| `approve` | **id** (`happyReturnsRMAID` ou `confirmationCode`, ex. `HRAB2BFE`), **returning** `[{happyReturnsItemID, approve, condition}]` | 🔴 **REMBOURSE** chaque article `approve:true`. Aucune annulation par l'API. `condition` ∈ `damaged`\|`sellable`\|`missing`\|`wrong-item` |
| `eligibility` | **email**, `returning[]`, `return_fee`… | 🟢 méthodes de retour offertes, aucun effet de bord *(headless)* |
| `createreturn` | **email**, `returning[]`, `dropoff_method_id` (`return-bar`\|`in-store`\|`mail`\|`mail-nolabel`\|`mail-nobox-nolabel`) | 🔴 crée un **vrai** retour : courriel au client, étiquette ou code QR émis *(headless)* |
| `expire` | **id** | 🟡 referme un retour créé par l'API partenaire. Idempotent (déjà expiré → 200) ; `409` si le retour a déjà un état final *(headless)* |

Les trois actions *headless* (`eligibility`, `createreturn`, `expire`) exigent une permission
distincte chez Happy Returns : sans elle, la réponse est `401`/`403` — ce n'est pas un bris du
proxy. L'onboarding de compte UPS (`/ups-byoa/authorization`) n'est **pas** exposé (il sert à un
partenaire qui embarque des marchands). Le service *agentic returns* (`mcp.happyreturns.com`) est
un MCP distinct avec sa propre auth : hors de ce proxy.

> **QuickBooks** : actions, mise en place et rotation du refresh token → `finance-proxy/FINANCE_PROXY.md`.

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
| `OMNISEND_API_KEY` | clé API Omnisend (Store settings → Integrations & API → API keys) |
| `KLAVIYO_API_KEY` | clé privée Klaviyo `pk_...` (Settings → Account → API keys). Créer une clé **lecture seule** (scopes read) : le connecteur n'expose que des lectures. |
| `KLAVIYO_REVISION` | (optionnel) révision d'API Klaviyo, défaut `2025-04-15` |
| `HAPPY_RETURNS_API_KEY` | clé API Happy Returns (en-tête `X-Hr-Apikey`), fournie par Happy Returns à l'intégration |
| `HAPPY_RETURNS_RETAILER_ID` | (optionnel) identifiant Happy Returns du détaillant, injecté dans les appels qui l'exigent — sans lui, il faut passer `happyReturnsRetailerID` à chaque appel |
| `HAPPY_RETURNS_BASE` | (optionnel) base de l'API, défaut `https://partner.happyreturns.com` |
| `PORT` | (auto, fourni par Render) |

> QuickBooks : variables déménagées dans le service dédié — voir `finance-proxy/FINANCE_PROXY.md`.
> Retirer de ce service les anciennes `QBO_*`, `RENDER_API_KEY` et `RENDER_SERVICE_ID` une fois
> le finance-proxy en ligne.

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

curl -X POST https://connectors-proxy.onrender.com/happyreturns/return \
  -H "X-Proxy-Secret: TON_SECRET" -H "Content-Type: application/json" \
  -d '{"orderNumber":"L-50468"}'
```

---

## Ajouter un connecteur plus tard

Dans `server.js`, copie le bloc `shipstation` : donne-lui un `name`, une fonction `enabled()` (ses
variables d'env), et un objet `actions` (l'allowlist des appels permis). Ajoute-le à `CONNECTEURS`.
Rien d'autre à changer — le routage `/:connecteur/:action`, l'auth et la gestion 429 sont génériques.
