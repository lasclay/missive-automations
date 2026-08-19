/**
 * Lasclay — connectors-proxy (v1)
 * --------------------------------------------------------------------------
 * Proxy HTTP GÉNÉRAL entre Claude/les scripts et plusieurs API tierces
 * (« connecteurs custom »). Chaque connecteur garde SES secrets ICI, côté
 * serveur (variables Render) : ils ne sont JAMAIS renvoyés ni exposés. Les
 * appelants n'utilisent qu'un PROXY_SECRET distinct (révocable) et ne voient
 * donc jamais les clés des API tierces.
 *
 * Même philosophie que missive-proxy : périmètre VOLONTAIREMENT RESTREINT. Un
 * connecteur n'expose QUE les actions listées dans son registre (allowlist).
 * On démarre en LECTURE SEULE — rien de destructeur d'emblée.
 *
 * ROUTAGE :
 *   GET  /health                       → sonde (sans auth)
 *   GET  /connectors                   → liste les connecteurs + actions dispo (sans secret)
 *   POST /:connecteur/:action  {..params}  → exécute l'action (auth requise)
 *
 * Premier connecteur : SHIPSTATION (API v1 « legacy », ssapi.shipstation.com,
 * auth Basic clé:secret). Actions LECTURE : orders, order, shipments,
 * fulfillments, carriers, stores, warehouses, listtags.
 * Actions ÉCRITURE (accès complet, ajoutées sur demande) : addtag, removetag,
 * holduntil, restorefromhold, markasshipped, createorder, deleteorder,
 * getrates (sans effet de bord), createlabelfororder, createlabel, voidlabel.
 * ATTENTION : createlabelfororder/createlabel DÉBITENT le wallet (argent réel);
 * deleteorder annule la commande; voidlabel annule une étiquette (remboursée).
 *
 * AUTH : chaque route (sauf /health et /connectors) exige l'en-tête
 *   X-Proxy-Secret: <PROXY_SECRET>
 * Le proxy est public sur Render : ce secret est la seule porte. Révocable en
 * changeant la variable.
 *
 * Node 18+ (fetch natif). Aucune dépendance.
 *
 * Variables d'environnement (secrets Render) :
 *   GENERAL_PROXY_SECRET    secret PROPRE à ce proxy (distinct du missive-proxy,     [requis*]
 *                           révocable à part). À défaut, repli sur PROXY_SECRET.
 *   PROXY_SECRET            repli si GENERAL_PROXY_SECRET absent.                     [*ou celui-ci]
 *   SHIPSTATION_API_KEY     clé API ShipStation (Account → API Settings)     [connecteur ShipStation]
 *   SHIPSTATION_API_SECRET  secret API ShipStation                          [connecteur ShipStation]
 *   OMNISEND_API_KEY        clé API Omnisend (Store settings → API keys)     [connecteur Omnisend]
 *   KLAVIYO_API_KEY         clé privée Klaviyo pk_... (Settings → API keys),  [connecteur Klaviyo]
 *                           lecture seule suffit (scopes read). Sert à
 *                           l'export exhaustif/migration.
 *   KLAVIYO_REVISION        révision d'API Klaviyo (défaut 2025-04-15).       [optionnel]
 *   COMPOSIO_API_KEY        clé de PROJET Composio (Developer Platform →      [connecteur Facebook]
 *                           Project Settings → API Keys ; en-tête x-api-key).
 *                           Voie par défaut : Composio détient la connexion
 *                           Facebook, le proxy lui demande les jetons de Page.
 *                           ATTENTION : la clé « ck_… » de Connect → Sessions &
 *                           API Key est une clé CLIENT MCP et ne fonctionne PAS ici.
 *   COMPOSIO_FB_ACCOUNT     identifiant du compte Facebook connecté chez        [optionnel]
 *                           Composio (défaut facebook_grice-absume).
 *   FB_USER_TOKEN           voie alternative, prioritaire si présente :         [optionnel]
 *                           jeton Meta longue durée (utilisateur ou
 *                           utilisateur système) avec pages_show_list,
 *                           pages_read_engagement, pages_read_user_content
 *                           et pages_manage_engagement. Le proxy en dérive
 *                           lui-même les jetons de Page ; ceux-ci ne sortent
 *                           jamais du serveur.
 *   FB_GRAPH_VERSION        version de l'API Graph (défaut v23.0).            [optionnel]
 *   (QuickBooks : service dédié finance-proxy/ — voir finance-proxy/FINANCE_PROXY.md)
 *   PORT                    port d'écoute (fourni par Render)               [auto]
 *
 * Un connecteur sans ses variables est simplement « désactivé » (les autres
 * fonctionnent). Ajouter un connecteur = ajouter une entrée dans CONNECTEURS.
 */

const http = require("node:http");

// Secret propre à CE proxy : GENERAL_PROXY_SECRET en priorité (distinct de celui du
// missive-proxy, révocable indépendamment), repli sur PROXY_SECRET si non défini.
const PROXY_SECRET = process.env.GENERAL_PROXY_SECRET || process.env.PROXY_SECRET;
const PORT = process.env.PORT || 3000;

if (!PROXY_SECRET) { console.error("Manque GENERAL_PROXY_SECRET (ou PROXY_SECRET)."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Construit une query string à partir d'un objet (ignore null/undefined/"").
function qs(params) {
  if (!params || typeof params !== "object") return "";
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/**
 * Appel HTTP JSON générique avec retry réseau + gestion 429.
 * @param {object} o { method, url, headers, body, rateReset }
 *   rateReset: nom d'un en-tête (secondes) à respecter sur 429 (ex. ShipStation).
 */
async function httpJson({ method = "GET", url, headers = {}, body, rateReset }, tries = 0) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Accept: "application/json", ...headers, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (tries < 3) { await sleep((tries + 1) * 2000); return httpJson({ method, url, headers, body, rateReset }, tries + 1); }
    throw new Error(`réseau: ${e.message}`);
  }
  if (res.status === 429 && tries < 3) {
    let wait = 10;
    const h = rateReset && res.headers.get(rateReset);
    if (h && !Number.isNaN(Number(h))) wait = Math.min(Number(h) + 1, 65);
    else { const ra = res.headers.get("retry-after"); if (ra && !Number.isNaN(Number(ra))) wait = Math.min(Number(ra) + 1, 65); }
    await sleep(wait * 1000);
    return httpJson({ method, url, headers, body, rateReset }, tries + 1);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url.replace(/https?:\/\/[^/]+/, "")} → ${res.status} ${text.slice(0, 300)}`);
  try { return text ? JSON.parse(text) : {}; } catch { return { raw: text }; }
}

// ==========================================================================
// CONNECTEUR : ShipStation (API v1 « legacy » — ssapi.shipstation.com)
// Auth : HTTP Basic base64(API_KEY:API_SECRET). Limite : 40 requêtes / minute
// (en-tête X-Rate-Limit-Reset = secondes avant réarmement, respecté sur 429).
// ==========================================================================
const shipstation = (() => {
  const KEY = process.env.SHIPSTATION_API_KEY || "";
  const SECRET = process.env.SHIPSTATION_API_SECRET || "";
  const BASE = process.env.SHIPSTATION_BASE || "https://ssapi.shipstation.com";
  const auth = () => "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64");
  const get = (path, params) =>
    httpJson({
      method: "GET",
      url: `${BASE}${path}${qs(params)}`,
      headers: { Authorization: auth() },
      rateReset: "x-rate-limit-reset",
    });
  const post = (path, body) =>
    httpJson({
      method: "POST",
      url: `${BASE}${path}`,
      headers: { Authorization: auth() },
      body: body || {},
      rateReset: "x-rate-limit-reset",
    });
  const del = (path) =>
    httpJson({
      method: "DELETE",
      url: `${BASE}${path}`,
      headers: { Authorization: auth() },
      rateReset: "x-rate-limit-reset",
    });
  const requis = (p, ...champs) => {
    for (const c of champs) if (!p || p[c] === undefined || p[c] === null || p[c] === "") throw new Error(`${c} requis`);
    return p;
  };
  return {
    name: "shipstation",
    description: "ShipStation v1 (commandes, expéditions, suivi) — accès complet (lecture + écriture; les étiquettes débitent le wallet).",
    enabled: () => !!(KEY && SECRET),
    // Chaque action = une entrée de l'allowlist. { params } arrive du corps JSON.
    actions: {
      // Liste de commandes. Filtres utiles : orderNumber, orderStatus
      // (awaiting_payment|awaiting_shipment|shipped|on_hold|cancelled),
      // customerName, storeId, createDateStart/End, modifyDateStart/End,
      // page, pageSize (max 500), sortBy, sortDir.
      orders: (p) => get("/orders", p),
      // Une commande par son orderId ShipStation (entier interne).
      order: (p) => {
        if (!p || !p.orderId) throw new Error("orderId requis");
        return get(`/orders/${encodeURIComponent(p.orderId)}`);
      },
      // Expéditions (donne trackingNumber, carrierCode, shipDate, voided...).
      // Filtres : orderNumber, trackingNumber, recipientName, carrierCode,
      // shipDateStart/End, page, pageSize.
      shipments: (p) => get("/shipments", p),
      // Fulfillments (commandes marquées expédiées hors étiquette ShipStation).
      fulfillments: (p) => get("/fulfillments", p),
      // Référentiels.
      carriers: () => get("/carriers"),
      stores: (p) => get("/stores", p),
      warehouses: () => get("/warehouses"),
      listtags: () => get("/accounts/listtags"),

      // ---- LECTURE (suite) : reste de la surface v1, aucun effet de bord ----
      // Un transporteur précis (soldes, exigences de compte). Params: carrierCode.
      carrier: (p) => get("/carriers/getcarrier", requis(p, "carrierCode")),
      // Services d'un transporteur = catalogue des serviceCode utilisables. Params: carrierCode.
      listservices: (p) => get("/carriers/listservices", requis(p, "carrierCode")),
      // Types de colis d'un transporteur = catalogue des packageCode. Params: carrierCode.
      listpackages: (p) => get("/carriers/listpackages", requis(p, "carrierCode")),
      // Fiches produit (SKU, poids, douane, entrepôt, défauts d'expédition).
      // Filtres : sku, name, productCategoryId, tagId, showInactive, page, pageSize (max 500).
      products: (p) => get("/products", p),
      product: (p) => { requis(p, "productId"); return get(`/products/${encodeURIComponent(p.productId)}`); },
      // Clients agrégés par ShipStation (adresse, nombre de commandes, valeur).
      // Filtres : stateCode, countryCode, marketplaceId, tagId, page, pageSize.
      customers: (p) => get("/customers", p),
      customer: (p) => { requis(p, "customerId"); return get(`/customers/${encodeURIComponent(p.customerId)}`); },
      // Utilisateurs du compte (userId GUID utilisé dans shipments/fulfillments).
      users: (p) => get("/users", p),
      // Un entrepôt / « Ship From Location » précis. Params: warehouseId.
      warehouse: (p) => { requis(p, "warehouseId"); return get(`/warehouses/${encodeURIComponent(p.warehouseId)}`); },
      // Une boutique précise + état de rafraîchissement. Params: storeId.
      store: (p) => { requis(p, "storeId"); return get(`/stores/${encodeURIComponent(p.storeId)}`); },
      storerefreshstatus: (p) => get("/stores/getrefreshstatus", requis(p, "storeId")),
      // Force la synchronisation d'une boutique. Écrit après avoir vu quatre commandes
      // créées dans Shopify rester invisibles dans ShipStation : sans ce déclencheur, on
      // attend le prochain cycle automatique sans pouvoir rien faire. Params : storeId
      // (facultatif — sans lui, ShipStation rafraîchit toutes les boutiques).
      refreshstore: (p) => post("/stores/refreshstore" + qs(p && p.storeId ? { storeId: p.storeId } : null), {}),
      // Marketplaces intégrables (catalogue des canaux de vente supportés).
      marketplaces: () => get("/stores/marketplaces"),
      // Commandes portant un tag donné. Params: orderStatus, tagId (+ page, pageSize).
      listbytag: (p) => get("/orders/listbytag", requis(p, "orderStatus", "tagId")),
      // Abonnements webhook existants (ORDER_NOTIFY, SHIP_NOTIFY, ITEM_*, FULFILLMENT_*).
      webhooks: () => get("/webhooks"),

      // ---- ÉCRITURE (accès complet) ----
      // Tarifs (POST mais SANS effet de bord — devis seulement).
      // Params: carrierCode, fromPostalCode, toPostalCode, toCountry, weight {value, units},
      // et facultatifs serviceCode, packageCode, toState, toCity, dimensions, confirmation, residential.
      getrates: (p) => post("/shipments/getrates", requis(p, "carrierCode", "fromPostalCode", "toPostalCode", "toCountry", "weight")),
      // Tag sur une commande (réversible, aucun coût). Params: orderId, tagId (voir listtags).
      addtag: (p) => post("/orders/addtag", requis(p, "orderId", "tagId")),
      // Assigne un utilisateur a des commandes. Params : orderIds[], userId (voir `users`,
      // avec showInactive:true pour comprendre qui est encore actif).
      assignuser: (p) => post("/orders/assignuser", {
        orderIds: requis(p, "orderIds", "userId").orderIds,
        userId: p.userId,
      }),
      removetag: (p) => post("/orders/removetag", requis(p, "orderId", "tagId")),
      // Mise en attente / retour en file. Params: orderId (+ holdUntilDate AAAA-MM-JJ).
      holduntil: (p) => post("/orders/holduntil", requis(p, "orderId", "holdUntilDate")),
      restorefromhold: (p) => post("/orders/restorefromhold", requis(p, "orderId")),
      // Marque expédiée SANS étiquette (déclenche la notif client sauf notifyCustomer:false).
      // Params: orderId, carrierCode (+ trackingNumber, shipDate, notifyCustomer, notifySalesChannel).
      markasshipped: (p) => post("/orders/markasshipped", requis(p, "orderId", "carrierCode")),
      // Crée OU MODIFIE une commande (upsert par orderKey; sans orderKey = création).
      // Params min: orderNumber, orderDate, orderStatus, billTo, shipTo. ATTENTION: avec un
      // orderKey existant, les champs fournis ÉCRASENT ceux de la commande.
      createorder: (p) => post("/orders/createorder", requis(p, "orderNumber", "orderDate", "orderStatus", "billTo", "shipTo")),
      // Supprime (annule) une commande. DESTRUCTEUR. Params: orderId.
      deleteorder: (p) => { requis(p, "orderId"); return del(`/orders/${encodeURIComponent(p.orderId)}`); },
      // ACHÈTE une étiquette pour une commande existante — ARGENT RÉEL (wallet One Balance /
      // compte transporteur). Params: orderId, carrierCode, serviceCode, confirmation, shipDate
      // (+ packageCode, weight, dimensions, testLabel:true pour essayer sans frais).
      createlabelfororder: (p) => post("/orders/createlabelfororder", requis(p, "orderId", "carrierCode", "serviceCode", "shipDate")),
      // ACHÈTE une étiquette « hors commande » (ou étiquette de RETOUR avec isReturnLabel:true).
      // ARGENT RÉEL. Params: carrierCode, serviceCode, shipDate, shipFrom, shipTo, weight
      // (+ packageCode, dimensions, isReturnLabel, testLabel).
      createlabel: (p) => post("/shipments/createlabel", requis(p, "carrierCode", "serviceCode", "shipDate", "shipFrom", "shipTo", "weight")),
      // Annule une étiquette (généralement remboursée par le transporteur). Params: shipmentId.
      voidlabel: (p) => post("/shipments/voidlabel", requis(p, "shipmentId")),
    },
  };
})();

// QuickBooks : DÉMÉNAGÉ dans le service dédié finance-proxy/ (isolation des finances —
// secrets Intuit et secret d'appel séparés de ce proxy). Voir finance-proxy/FINANCE_PROXY.md.

// ==========================================================================
// CONNECTEUR : Omnisend (API v3 — api.omnisend.com/v3, en-tête X-API-KEY)
// Marketing par courriel/SMS. Limite : 400 requêtes / minute (Retry-After sur 429,
// géré par httpJson). Lecture des contacts/campagnes/commandes + écritures utiles :
// créer/mettre à jour un contact (abonnements) et déclencher un événement custom
// (point d'entrée des automations Omnisend).
// ==========================================================================
// ==========================================================================
// CONNECTEUR : ShipStation API v2 (api.shipstation.com/v2)
// Auth : en-tête `API-Key`, PAS le Basic de la v1 — ce sont deux API distinctes
// avec deux jeux d'identifiants. Ajouté quand une clé v2 de production a été mise
// en place côté Render, parce que la v1 n'a AUCUNE ressource « batches » : les lots
// d'expédition n'existent que dans la v2.
//
// ⚠️ Piège à connaître avant de s'en servir : un lot v2 se construit à partir de
// `shipment_ids` ou de `rate_ids` de la v2 (format `se-…`), jamais à partir des
// `orderId` numériques de la v1. Les deux API ne désignent pas les mêmes objets.
// Il faut donc VÉRIFIER que la v2 voit bien les envois avant de promettre un lot.
//
// L'achat d'étiquettes en lot (`/batches/{id}/process/labels`) n'est PAS exposé :
// il débite le wallet. Il faudra une décision explicite pour l'ajouter.
// ==========================================================================
const shipstation2 = (() => {
  const KEY = process.env.SHIPSTATION_APIV2_KEY || "";
  const BASE = process.env.SHIPSTATION_V2_BASE || "https://api.shipstation.com/v2";
  const hdr = () => ({ "API-Key": KEY });
  const get = (path, params) =>
    httpJson({ method: "GET", url: `${BASE}${path}${qs(params)}`, headers: hdr() });
  const post = (path, body) =>
    httpJson({ method: "POST", url: `${BASE}${path}`, headers: hdr(), body: body || {} });
  const requis = (p, ...champs) => {
    for (const c of champs) if (!p || p[c] === undefined || p[c] === null || p[c] === "") throw new Error(`${c} requis`);
    return p;
  };
  return {
    name: "shipstation2",
    description: "ShipStation API v2 — envois et LOTS (batches), inexistants en v1. Lecture + création de lot; l'achat d'étiquettes en lot n'est pas exposé.",
    enabled: () => !!KEY,
    actions: {
      // Sonde : confirme que la clé v2 répond et que le compte y est visible.
      carriers: () => get("/carriers"),
      // Envois vus par la v2. C'est ICI qu'on vérifie si les commandes de la v1
      // existent aussi côté v2, avant d'espérer les regrouper en lot.
      shipments: (p) => get("/shipments", p),
      shipment: (p) => get(`/shipments/${encodeURIComponent(requis(p, "shipmentId").shipmentId)}`),
      // Lots
      batches: (p) => get("/batches", p),
      batch: (p) => get(`/batches/${encodeURIComponent(requis(p, "batchId").batchId)}`),
      // Crée un lot. Params : shipment_ids[] et/ou rate_ids[], external_batch_id,
      // batch_notes. Aucune étiquette n'est achetée à cette étape.
      createbatch: (p) => post("/batches", {
        ...(p && p.external_batch_id ? { external_batch_id: p.external_batch_id } : {}),
        ...(p && p.batch_notes ? { batch_notes: p.batch_notes } : {}),
        ...(p && p.shipment_ids ? { shipment_ids: p.shipment_ids } : {}),
        ...(p && p.rate_ids ? { rate_ids: p.rate_ids } : {}),
      }),
      // Assigne un membre de l'equipe a des envois. Le lot affiche « Assigned To » dans
      // l'interface, mais l'objet lot de l'API ne porte AUCUN champ d'assignation : c'est
      // ici que ca se joue, sur les envois. Un lot cree par une cle appartenant a un
      // utilisateur desactive s'affiche a son nom — d'ou cette route.
      // Params : shipment_ids[] (max 500), user_id (UUID d'un utilisateur ACTIF).
      assignuser: (p) => post("/shipments/user", {
        shipment_ids: requis(p, "shipment_ids", "user_id").shipment_ids,
        user_id: p.user_id,
      }),
      addtobatch: (p) => post(`/batches/${encodeURIComponent(requis(p, "batchId").batchId)}/add`, {
        ...(p.shipment_ids ? { shipment_ids: p.shipment_ids } : {}),
        ...(p.rate_ids ? { rate_ids: p.rate_ids } : {}),
      }),
    },
  };
})();

const omnisend = (() => {
  const KEY = process.env.OMNISEND_API_KEY || "";
  const BASE = process.env.OMNISEND_BASE || "https://api.omnisend.com/v3";
  const call = (method, path, { params, body } = {}) =>
    httpJson({
      method,
      url: `${BASE}${path}${qs(params)}`,
      headers: { "X-API-KEY": KEY },
      body,
    });
  return {
    name: "omnisend",
    description: "Omnisend v3 (contacts, campagnes, commandes, événements) — lecture + gestion des contacts/événements.",
    enabled: () => !!KEY,
    actions: {
      // ---- LECTURE ----
      // Liste de contacts. Params: email, status (subscribed|unsubscribed|nonSubscribed),
      // segmentID, limit (max 250), after (curseur de pagination).
      contacts: (p) => call("GET", "/contacts", { params: p }),
      // Un contact par son contactID.
      contact: (p) => {
        if (!p || !p.contactID) throw new Error("contactID requis");
        return call("GET", `/contacts/${encodeURIComponent(p.contactID)}`);
      },
      // Campagnes (params: status, limit, after) / une campagne par campaignID.
      campaigns: (p) => call("GET", "/campaigns", { params: p }),
      campaign: (p) => {
        if (!p || !p.campaignID) throw new Error("campaignID requis");
        return call("GET", `/campaigns/${encodeURIComponent(p.campaignID)}`);
      },
      // Commandes / produits / paniers synchronisés (params: limit, after, email...).
      orders: (p) => call("GET", "/orders", { params: p }),
      products: (p) => call("GET", "/products", { params: p }),
      carts: (p) => call("GET", "/carts", { params: p }),

      // ---- ÉCRITURE (contacts + événements) ----
      // Crée/abonne un contact. body = objet Omnisend v3, ex.
      // { identifiers: [{ type:"email", id:"x@y.com", channels:{ email:{ status:"subscribed" } } }], firstName, tags... }
      createcontact: (p) => {
        if (!p || !p.body) throw new Error("body requis (objet contact Omnisend v3)");
        return call("POST", "/contacts", { body: p.body });
      },
      // Met à jour un contact (statut d'abonnement, champs, tags). PATCH partiel.
      updatecontact: (p) => {
        if (!p || !p.contactID || !p.body) throw new Error("contactID et body requis");
        return call("PATCH", `/contacts/${encodeURIComponent(p.contactID)}`, { body: p.body });
      },
      // Déclenche un ÉVÉNEMENT custom (démarre les automations Omnisend qui l'écoutent).
      // body ex.: { eventID ou systemName, email, fields: {...} }
      triggerevent: (p) => {
        if (!p || !p.body) throw new Error("body requis (événement Omnisend v3)");
        return call("POST", "/events", { body: p.body });
      },
    },
  };
})();

// ==========================================================================
// CONNECTEUR : Facebook Pages (Graph API v23.0 — graph.facebook.com)
// Auth : un SEUL secret côté Render, FB_USER_TOKEN — jeton utilisateur longue
// durée ou jeton d'utilisateur système, avec les permissions pages_show_list,
// pages_read_engagement, pages_read_user_content et pages_manage_engagement.
// Le proxy en dérive lui-même les jetons de PAGE via /me/accounts et les garde
// EN MÉMOIRE seulement (cache de 30 min). Aucun jeton de Page n'est jamais
// renvoyé à l'appelant ni écrit sur disque.
//
// C'est le point important : Meta exige que chaque appel visant une Page porte
// le jeton DE CETTE Page. Utiliser le jeton d'une autre Page produit une erreur
// « (#10) pages_read_user_content ». Le connecteur choisit donc toujours le bon
// jeton à partir du page_id demandé, et refuse un page_id inconnu.
// ==========================================================================
const facebook = (() => {
  const FB_TOKEN = process.env.FB_USER_TOKEN || "";
  const CKEY = process.env.COMPOSIO_API_KEY || "";
  const CBASE = process.env.COMPOSIO_BASE || "https://backend.composio.dev/api/v3";
  const CACCT = process.env.COMPOSIO_FB_ACCOUNT || "facebook_grice-absume";
  const V = process.env.FB_GRAPH_VERSION || "v23.0";
  const BASE = `https://graph.facebook.com/${V}`;
  const TTL = 30 * 60 * 1000;

  let cache = { at: 0, pages: null, via: null, forme: null };

  // --- Voie 1 : jeton Meta détenu ici. /me/accounts rend les jetons de Page. ---
  async function viaMeta() {
    const out = {};
    let url = `${BASE}/me/accounts${qs({ fields: "id,name,access_token", limit: 100, access_token: FB_TOKEN })}`;
    while (url) {
      const r = await httpJson({ method: "GET", url });
      for (const p of r.data || []) out[p.id] = { id: p.id, name: p.name, token: p.access_token };
      url = (r.paging && r.paging.next) || null;
    }
    return out;
  }

  // --- Voie 2 : Composio détient la connexion Facebook et exécute l'outil pour nous. ---
  // Le nom des champs du corps a changé entre versions de l'API Composio et n'est pas
  // documenté de façon stable. Plutôt que de parier, on essaie les formes connues dans
  // l'ordre et on retient celle qui passe : `forme` est ensuite exposée par l'action diag.
  const FORMES = [
    ["connected_account_id + arguments", (a) => ({ connected_account_id: CACCT, arguments: a })],
    ["connected_account_id + input", (a) => ({ connected_account_id: CACCT, input: a })],
    ["user_id + arguments", (a) => ({ user_id: CACCT, arguments: a })],
    ["arguments seul", (a) => ({ arguments: a })],
  ];
  async function viaComposio() {
    const args = { fields: "id,name,access_token", limit: 25 };
    const echecs = [];
    for (const [nom, faire] of FORMES) {
      try {
        const r = await httpJson({
          method: "POST",
          url: `${CBASE}/tools/execute/FACEBOOK_LIST_MANAGED_PAGES`,
          headers: { "x-api-key": CKEY },
          body: faire(args),
        });
        // Composio emballe la réponse de l'outil ; Meta emballe la sienne dans data.
        const d = r && (r.data || r.response || r);
        const liste = (d && (d.data || d.pages)) || [];
        const arr = Array.isArray(liste) ? liste : liste.data || [];
        if (arr.length) {
          const out = {};
          for (const p of arr) if (p && p.access_token) out[p.id] = { id: p.id, name: p.name, token: p.access_token };
          if (Object.keys(out).length) { cache.forme = nom; return out; }
        }
        echecs.push(`${nom} → réponse sans jetons`);
      } catch (e) {
        echecs.push(`${nom} → ${String(e.message).slice(0, 160)}`);
      }
    }
    throw new Error(`Composio n'a rendu aucun jeton. Essais : ${echecs.join(" | ")}`);
  }

  async function pages() {
    if (cache.pages && Date.now() - cache.at < TTL) return cache.pages;
    let out = null, via = null;
    if (FB_TOKEN) { out = await viaMeta(); via = "meta"; }
    else if (CKEY) { out = await viaComposio(); via = "composio"; }
    else throw new Error("ni FB_USER_TOKEN ni COMPOSIO_API_KEY ne sont configurés");
    if (!out || !Object.keys(out).length) throw new Error(`aucune Page rendue par la voie « ${via} »`);
    cache = { ...cache, at: Date.now(), pages: out, via };
    return out;
  }

  // Jeton de la Page demandée. Erreur explicite si le page_id est inconnu, plutôt que
  // de retomber silencieusement sur une autre Page — c'est ce silence qui avait fait
  // échouer trois Pages sur quatre au premier passage, avec une erreur (#10) opaque.
  async function tok(pageId) {
    if (!pageId) throw new Error("page_id requis");
    const all = await pages();
    const p = all[String(pageId)];
    if (!p) throw new Error(`page_id inconnu : ${pageId} — Pages accessibles : ${Object.keys(all).join(", ")}`);
    return p.token;
  }

  const get = async (path, p = {}) => {
    const { page_id, ...params } = p;
    return httpJson({ method: "GET", url: `${BASE}${path}${qs({ ...params, access_token: await tok(page_id) })}` });
  };
  // Graph accepte les paramètres d'écriture en query string : pas de corps JSON.
  const post = async (path, p = {}) => {
    const { page_id, ...params } = p;
    return httpJson({ method: "POST", url: `${BASE}${path}${qs({ ...params, access_token: await tok(page_id) })}` });
  };
  const need = (p, ...champs) => {
    for (const c of champs) if (!p || !p[c]) throw new Error(`${c} requis`);
  };

  return {
    name: "facebook",
    description:
      "Facebook Pages (Graph v23.0) — publications, commentaires, réponses, masquage. Jetons de Page dérivés côté serveur (FB_USER_TOKEN, sinon Composio) ; page_id requis partout.",
    enabled: () => !!(FB_TOKEN || CKEY),
    actions: {
      // Sonde : quelle voie d'authentification est vivante, sans rien exposer.
      // À appeler en premier quand quelque chose ne marche pas.
      diag: async () => {
        const r = { fb_user_token: !!FB_TOKEN, composio_api_key: !!CKEY, compte_composio: CACCT };
        try {
          const all = await pages();
          return { ...r, ok: true, via: cache.via, forme_corps: cache.forme, pages: Object.values(all).map(({ id, name }) => ({ id, name })) };
        } catch (e) {
          return { ...r, ok: false, erreur: String(e.message).slice(0, 900) };
        }
      },
      // Les Pages accessibles (id + nom seulement — jamais les jetons).
      pages: async () => ({ data: Object.values(await pages()).map(({ id, name }) => ({ id, name })) }),
      // Publications d'une Page. Params : page_id, limit, after, fields.
      posts: (p) => {
        need(p, "page_id");
        return get(`/${encodeURIComponent(p.page_id)}/posts`, {
          fields: "id,created_time,message,permalink_url",
          limit: 25,
          ...p,
        });
      },
      // Commentaires d'une publication OU d'un commentaire. Params : page_id,
      // object_id, limit, after, filter (stream|toplevel), order.
      comments: (p) => {
        need(p, "page_id", "object_id");
        const { object_id, ...q } = p;
        return get(`/${encodeURIComponent(object_id)}/comments`, {
          fields: "id,created_time,message,from,is_hidden,comment_count,permalink_url",
          filter: "stream",
          limit: 100,
          ...q,
        });
      },
      // Un commentaire précis.
      comment: (p) => {
        need(p, "page_id", "comment_id");
        const { comment_id, ...q } = p;
        return get(`/${encodeURIComponent(comment_id)}`, {
          fields: "id,created_time,message,from,is_hidden,comment_count,permalink_url",
          ...q,
        });
      },

      // ---- ÉCRITURE ----
      // Répond publiquement à un commentaire. Params : page_id, comment_id, message.
      reply: (p) => {
        need(p, "page_id", "comment_id", "message");
        return post(`/${encodeURIComponent(p.comment_id)}/comments`, { page_id: p.page_id, message: p.message });
      },
      // Masque / démasque un commentaire (réversible, sans notification).
      hide: (p) => {
        need(p, "page_id", "comment_id");
        return post(`/${encodeURIComponent(p.comment_id)}`, { page_id: p.page_id, is_hidden: "true" });
      },
      unhide: (p) => {
        need(p, "page_id", "comment_id");
        return post(`/${encodeURIComponent(p.comment_id)}`, { page_id: p.page_id, is_hidden: "false" });
      },
      // Corrige le texte d'un commentaire DE LA PAGE : garde sa place dans le fil et
      // ne renotifie personne, contrairement à supprimer puis republier.
      edit: (p) => {
        need(p, "page_id", "comment_id", "message");
        return post(`/${encodeURIComponent(p.comment_id)}`, { page_id: p.page_id, message: p.message });
      },
    },
  };
})();

// ==========================================================================
// CONNECTEUR : Composio (API de plateforme v3 — backend.composio.dev, en-tête
// x-api-key). LECTURE SEULE, à visée de DIAGNOSTIC : sert à voir ce que le
// projet auquel appartient COMPOSIO_API_KEY contient réellement — quels
// toolkits, quels outils, quels comptes connectés. Existe parce qu'un
// « Tool not found » ne dit pas si l'outil n'existe pas, si le toolkit n'est
// pas activé, ou si la clé appartient à un autre projet que le compte connecté.
// N'expose aucune clé et n'exécute aucun outil.
// ==========================================================================
const composio = (() => {
  const KEY = process.env.COMPOSIO_API_KEY || "";
  const BASE = process.env.COMPOSIO_BASE || "https://backend.composio.dev/api/v3";
  const get = (path, params) =>
    httpJson({ method: "GET", url: `${BASE}${path}${qs(params)}`, headers: { "x-api-key": KEY } });
  return {
    name: "composio",
    description:
      "Composio (plateforme v3, lecture seule) — diagnostic : toolkits, outils, comptes connectés du projet auquel appartient la clé.",
    enabled: () => !!KEY,
    actions: {
      // Comptes connectés du projet. Params : toolkit_slugs, limit.
      accounts: (p) => get("/connected_accounts", p),
      // Toolkits disponibles/activés. Params : limit, search.
      toolkits: (p) => get("/toolkits", { limit: 50, ...p }),
      // Outils. Params : toolkit_slugs (ex. "facebook"), search, limit.
      tools: (p) => get("/tools", { limit: 100, ...p }),
      // Un outil précis, pour vérifier son slug exact et son schéma.
      tool: (p) => {
        if (!p || !p.slug) throw new Error("slug requis");
        return get(`/tools/${encodeURIComponent(p.slug)}`);
      },
    },
  };
})();

// ==========================================================================
// CONNECTEUR : Klaviyo (API JSON:API — a.klaviyo.com/api, en-tête Authorization
// « Klaviyo-API-Key pk_... » + en-tête revision obligatoire). LECTURE SEULE :
// sert à l'export exhaustif (migration/sauvegarde) — profils, listes, segments,
// flows, campagnes, templates, événements. Pagination par curseur : passer
// "page[cursor]" (valeur extraite de links.next) et "page[size]" (max 100)
// directement dans les params. Limites de débit par endpoint (429 + Retry-After,
// géré par httpJson).
// ==========================================================================
const klaviyo = (() => {
  const KEY = process.env.KLAVIYO_API_KEY || "";
  const BASE = process.env.KLAVIYO_BASE || "https://a.klaviyo.com/api";
  const REVISION = process.env.KLAVIYO_REVISION || "2025-04-15";
  const get = (path, params) =>
    httpJson({
      method: "GET",
      url: `${BASE}${path}${qs(params)}`,
      headers: { Authorization: `Klaviyo-API-Key ${KEY}`, revision: REVISION },
    });
  const un = (p, champ = "id") => {
    if (!p || !p[champ]) throw new Error(`${champ} requis`);
    return encodeURIComponent(p[champ]);
  };
  // Retire les clés « réservées » (id) des params avant de les passer en query string.
  const reste = (p) => { const { id, ...q } = p || {}; return q; };
  return {
    name: "klaviyo",
    description:
      "Klaviyo (lecture seule — export/migration) : profils, listes, segments, flows, campagnes, templates, événements, métriques.",
    enabled: () => !!KEY,
    actions: {
      // Profils. Params utiles : "page[size]" (max 100), "page[cursor]",
      // "additional-fields[profile]": "subscriptions" (statuts de consentement),
      // filter (ex. equals(email,"x@y.com")), sort.
      profiles: (p) => get("/profiles", p),
      profile: (p) => get(`/profiles/${un(p)}`, reste(p)),
      // Listes + membres d'une liste (id requis; pagination par curseur).
      lists: (p) => get("/lists", p),
      list: (p) => get(`/lists/${un(p)}`, reste(p)),
      listprofiles: (p) => get(`/lists/${un(p)}/profiles`, reste(p)),
      // Segments + définition + membres.
      segments: (p) => get("/segments", p),
      segment: (p) => get(`/segments/${un(p)}`, reste(p)),
      segmentprofiles: (p) => get(`/segments/${un(p)}/profiles`, reste(p)),
      // Flows (additional-fields[flow]: "definition" pour la définition complète).
      flows: (p) => get("/flows", p),
      flow: (p) => get(`/flows/${un(p)}`, reste(p)),
      // Campagnes (filter OBLIGATOIRE côté Klaviyo, ex. equals(messages.channel,'email')).
      campaigns: (p) => get("/campaigns", p),
      campaign: (p) => get(`/campaigns/${un(p)}`, reste(p)),
      campaignmessage: (p) => get(`/campaign-messages/${un(p)}`, reste(p)),
      // Templates (HTML complet dans attributes.html).
      templates: (p) => get("/templates", p),
      template: (p) => get(`/templates/${un(p)}`, reste(p)),
      // Événements (archivage/échantillonnage; filter + page[cursor]).
      events: (p) => get("/events", p),
      // Référentiels.
      metrics: (p) => get("/metrics", p),
      tags: (p) => get("/tags", p),
      forms: (p) => get("/forms", p),
      images: (p) => get("/images", p),
      coupons: (p) => get("/coupons", p),
    },
  };
})();

// ==========================================================================
// REGISTRE DES CONNECTEURS — ajouter un nouveau connecteur = ajouter une entrée.
// ==========================================================================
const CONNECTEURS = {
  [shipstation.name]: shipstation,
  [shipstation2.name]: shipstation2,
  [omnisend.name]: omnisend,
  [klaviyo.name]: klaviyo,
  [facebook.name]: facebook,
  [composio.name]: composio,
};

// ---- Serveur HTTP ----
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve(null); } });
  });
}
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

// Vue publique du registre (aucun secret) : connecteurs + actions + activé ou non.
function describeConnectors() {
  const out = {};
  for (const [name, c] of Object.entries(CONNECTEURS)) {
    out[name] = { description: c.description || null, enabled: c.enabled(), actions: Object.keys(c.actions) };
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  try {
    const route = (req.url || "").split("?")[0];

    if (req.method === "GET" && route === "/health") return json(res, 200, { ok: true, service: "connectors-proxy" });
    if (req.method === "GET" && route === "/connectors") return json(res, 200, { connectors: describeConnectors() });
    if (req.method !== "POST") return json(res, 404, { error: "not found" });

    // Routage /:connecteur/:action (résolu AVANT l'auth: le secret exigé dépend du connecteur)
    const parts = route.split("/").filter(Boolean);
    const [cname, aname] = parts;
    const conn = parts.length === 2 ? CONNECTEURS[cname] : undefined;

    // Auth. Un connecteur peut exiger un secret DÉDIÉ (conn.secretEnv, ex. QBO_PROXY_SECRET
    // pour les finances): s'il est configuré, LUI SEUL est accepté pour ce connecteur — le
    // secret général est refusé. Sinon, repli sur le secret général du proxy.
    const dedie = conn && conn.secretEnv ? process.env[conn.secretEnv] : null;
    const attendu = dedie || PROXY_SECRET;
    if ((req.headers["x-proxy-secret"] || "") !== attendu) return json(res, 401, { error: "unauthorized" });

    if (parts.length !== 2) return json(res, 404, { error: "route attendue : /:connecteur/:action" });
    if (!conn) return json(res, 404, { error: `connecteur inconnu : ${cname}`, connecteurs: Object.keys(CONNECTEURS) });
    if (!conn.enabled()) return json(res, 503, { error: `connecteur « ${cname} » non configuré (variables d'environnement manquantes).` });

    const action = conn.actions[aname];
    if (!action) return json(res, 404, { error: `action inconnue : ${cname}/${aname}`, actions: Object.keys(conn.actions) });

    const body = await readBody(req);
    if (body === null) return json(res, 400, { error: "invalid JSON" });

    const data = await action(body);
    return json(res, 200, { ok: true, connector: cname, action: aname, data });
  } catch (e) {
    return json(res, 502, { error: String(e.message || e).slice(0, 400) });
  }
});

server.listen(PORT, () => {
  const actifs = Object.entries(CONNECTEURS).filter(([, c]) => c.enabled()).map(([n]) => n);
  console.log(`connectors-proxy à l'écoute sur :${PORT} — connecteurs actifs : ${actifs.join(", ") || "(aucun)"}`);
  for (const [n, c] of Object.entries(CONNECTEURS)) {
    if (c.secretEnv) console.log(`  ${n}: secret dédié ${c.secretEnv} ${process.env[c.secretEnv] ? "ACTIF (secret général refusé sur ce connecteur)" : "NON DÉFINI (repli sur le secret général — définir " + c.secretEnv + " pour isoler)"}`);
  }
});
