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
 *   QBO_CLIENT_ID           Client ID de l'app Intuit (developer.intuit.com) [connecteur QuickBooks]
 *   QBO_CLIENT_SECRET       Client Secret de l'app Intuit                    [connecteur QuickBooks]
 *   QBO_REALM_ID            Realm ID (Company ID) QuickBooks                 [connecteur QuickBooks]
 *   QBO_REFRESH_TOKEN       refresh token OAuth2 initial (voir qbo_auth.js)  [connecteur QuickBooks]
 *   QBO_ENV                 "production" (défaut) ou "sandbox"               [facultatif]
 *   QBO_TOKEN_FILE          fichier où persister le refresh token tournant   [facultatif]
 *   RENDER_API_KEY + RENDER_SERVICE_ID   sync auto de QBO_REFRESH_TOKEN dans l'env Render
 *                           (RECOMMANDÉ: le disque Render est éphémère et Intuit fait
 *                           tourner le refresh token ~24 h; sans sync, il faut refaire
 *                           l'autorisation après chaque redéploiement vieux de +24 h)
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

      // ---- ÉCRITURE (accès complet) ----
      // Tarifs (POST mais SANS effet de bord — devis seulement).
      // Params: carrierCode, fromPostalCode, toPostalCode, toCountry, weight {value, units},
      // et facultatifs serviceCode, packageCode, toState, toCity, dimensions, confirmation, residential.
      getrates: (p) => post("/shipments/getrates", requis(p, "carrierCode", "fromPostalCode", "toPostalCode", "toCountry", "weight")),
      // Tag sur une commande (réversible, aucun coût). Params: orderId, tagId (voir listtags).
      addtag: (p) => post("/orders/addtag", requis(p, "orderId", "tagId")),
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

// ==========================================================================
// CONNECTEUR : QuickBooks Online (API v3, OAuth2) — LECTURE SEULE
// --------------------------------------------------------------------------
// Pourquoi ici : le connecteur QuickBooks officiel de Claude est une app Intuit
// US-only (« isn't available for use in your country » pour une entreprise
// canadienne). On passe donc par NOTRE propre app Intuit (developer.intuit.com),
// valide au Canada, avec ses clés côté Render.
//
// OAuth2 Intuit : access token 60 min; REFRESH TOKEN TOURNANT (Intuit remplace
// sa valeur ~toutes les 24 h; seule la plus récente reste valide, 100 jours max
// sans usage). Le plus récent doit SURVIVRE aux redémarrages, sinon il faut
// refaire l'autorisation (qbo_auth.js). Ordre de vérité au démarrage :
// mémoire > fichier QBO_TOKEN_FILE > variable d'env QBO_REFRESH_TOKEN (seed).
// Sur Render (disque éphémère), la persistance FIABLE est la sync de la
// variable d'env via l'API Render (RENDER_API_KEY + RENDER_SERVICE_ID).
// ==========================================================================
const quickbooks = (() => {
  const fsq = require("node:fs");
  const CLIENT_ID = process.env.QBO_CLIENT_ID || "";
  const CLIENT_SECRET = process.env.QBO_CLIENT_SECRET || "";
  const REALM = process.env.QBO_REALM_ID || "";
  const SEED = process.env.QBO_REFRESH_TOKEN || "";
  const BASE = (process.env.QBO_ENV || "production").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
  const MINOR = process.env.QBO_MINORVERSION || "75";
  const TOKEN_FILE = process.env.QBO_TOKEN_FILE || "";
  const RENDER_KEY = process.env.RENDER_API_KEY || "";
  const RENDER_SVC = process.env.RENDER_SERVICE_ID || "";

  let access = { token: null, exp: 0 };
  let refresh = null; // dernier refresh token connu (mémoire)

  function loadRefresh() {
    if (refresh) return refresh;
    if (TOKEN_FILE) {
      try { refresh = JSON.parse(fsq.readFileSync(TOKEN_FILE, "utf8")).refresh_token || null; } catch { /* fichier absent au 1er run */ }
    }
    return refresh || SEED || null;
  }

  async function saveRefresh(rt) {
    refresh = rt;
    if (TOKEN_FILE) {
      try { fsq.writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: rt, saved_at: new Date().toISOString() })); }
      catch (e) { console.warn(`quickbooks: écriture ${TOKEN_FILE}: ${e.message}`); }
    }
    if (RENDER_KEY && RENDER_SVC) {
      try {
        const r = await fetch(`https://api.render.com/v1/services/${RENDER_SVC}/env-vars/QBO_REFRESH_TOKEN`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${RENDER_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ value: rt }),
        });
        if (!r.ok) console.warn(`quickbooks: sync env Render → ${r.status}`);
      } catch (e) { console.warn(`quickbooks: sync env Render: ${e.message}`); }
    } else if (!TOKEN_FILE) {
      console.warn("quickbooks: refresh token tourné mais AUCUNE persistance configurée (RENDER_API_KEY+RENDER_SERVICE_ID ou QBO_TOKEN_FILE): il sera perdu au prochain redémarrage.");
    }
  }

  async function token() {
    if (access.token && Date.now() < access.exp) return access.token;
    const rt = loadRefresh();
    if (!rt) throw new Error("quickbooks: aucun refresh token (QBO_REFRESH_TOKEN; voir qbo_auth.js)");
    const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: rt }).toString(),
    });
    if (!res.ok) {
      const t = (await res.text()).slice(0, 200);
      throw new Error(`quickbooks token → ${res.status} ${t}${/invalid_grant/.test(t) ? " (refresh token périmé/tourné ailleurs: refaire l'autorisation avec qbo_auth.js)" : ""}`);
    }
    const j = await res.json();
    access = { token: j.access_token, exp: Date.now() + Math.max(60, (j.expires_in || 3600) - 120) * 1000 };
    if (j.refresh_token && j.refresh_token !== rt) await saveRefresh(j.refresh_token);
    else refresh = rt;
    return access.token;
  }

  const get = async (path, params) =>
    httpJson({
      method: "GET",
      url: `${BASE}/v3/company/${encodeURIComponent(REALM)}${path}${qs({ minorversion: MINOR, ...(params || {}) })}`,
      headers: { Authorization: `Bearer ${await token()}`, Accept: "application/json" },
    });

  return {
    name: "quickbooks",
    description: "QuickBooks Online (rapports P&L/bilan/balance de vérification, requêtes, infos compagnie) — lecture seule.",
    enabled: () => !!(CLIENT_ID && CLIENT_SECRET && REALM && (SEED || TOKEN_FILE)),
    actions: {
      // Rapport comptable. Params: name (requis: ProfitAndLoss | BalanceSheet | TrialBalance |
      // GeneralLedger | CashFlow | AgedReceivables | AgedPayables ...) + options du rapport:
      // start_date/end_date (AAAA-MM-JJ), summarize_column_by (Month|Quarters|Years...),
      // accounting_method (Accrual|Cash), date_macro... Ex. P&L mensuel FY2026 :
      // { name:"ProfitAndLoss", start_date:"2025-09-01", end_date:"2026-08-31",
      //   summarize_column_by:"Month", accounting_method:"Accrual" }
      report: (p) => {
        if (!p || !p.name) throw new Error("name requis (ex. ProfitAndLoss, BalanceSheet)");
        const { name, ...rest } = p;
        return get(`/reports/${encodeURIComponent(name)}`, rest);
      },
      // Requête SQL-like de l'API v3. Params: { query: "select * from Account maxresults 200" }
      query: (p) => {
        if (!p || !p.query) throw new Error("query requis");
        return get("/query", { query: p.query });
      },
      // Infos compagnie (test d'auth minimal).
      companyinfo: () => get(`/companyinfo/${encodeURIComponent(REALM)}`),
    },
  };
})();

// ==========================================================================
// REGISTRE DES CONNECTEURS — ajouter un nouveau connecteur = ajouter une entrée.
// ==========================================================================
const CONNECTEURS = {
  [shipstation.name]: shipstation,
  [quickbooks.name]: quickbooks,
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

    // Auth
    if ((req.headers["x-proxy-secret"] || "") !== PROXY_SECRET) return json(res, 401, { error: "unauthorized" });

    // Routage /:connecteur/:action
    const parts = route.split("/").filter(Boolean);
    if (parts.length !== 2) return json(res, 404, { error: "route attendue : /:connecteur/:action" });
    const [cname, aname] = parts;

    const conn = CONNECTEURS[cname];
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
});
