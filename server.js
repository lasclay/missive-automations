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
 *
 * AUTH : chaque route (sauf /health et /connectors) exige l'en-tête
 *   X-Proxy-Secret: <PROXY_SECRET>
 * Le proxy est public sur Render : ce secret est la seule porte. Révocable en
 * changeant la variable.
 *
 * Node 18+ (fetch natif). Aucune dépendance.
 *
 * Variables d'environnement (secrets Render) :
 *   PROXY_SECRET            secret partagé envoyé en en-tête                 [requis]
 *   SHIPSTATION_API_KEY     clé API ShipStation (Account → API Settings)     [connecteur ShipStation]
 *   SHIPSTATION_API_SECRET  secret API ShipStation                          [connecteur ShipStation]
 *   PORT                    port d'écoute (fourni par Render)               [auto]
 *
 * Un connecteur sans ses variables est simplement « désactivé » (les autres
 * fonctionnent). Ajouter un connecteur = ajouter une entrée dans CONNECTEURS.
 */

const http = require("node:http");

const PROXY_SECRET = process.env.PROXY_SECRET;
const PORT = process.env.PORT || 3000;

if (!PROXY_SECRET) { console.error("Manque PROXY_SECRET."); process.exit(1); }

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
  return {
    name: "shipstation",
    description: "ShipStation v1 (commandes, expéditions, suivi) — lecture seule.",
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
    },
  };
})();

// ==========================================================================
// REGISTRE DES CONNECTEURS — ajouter un nouveau connecteur = ajouter une entrée.
// ==========================================================================
const CONNECTEURS = {
  [shipstation.name]: shipstation,
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
