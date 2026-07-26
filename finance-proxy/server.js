/**
 * Lasclay — finance-proxy (v1)
 * --------------------------------------------------------------------------
 * Proxy HTTP DÉDIÉ AUX FINANCES : QuickBooks Online uniquement, sur un service
 * Render SÉPARÉ du connectors-proxy général. Périmètre volontairement isolé :
 *
 *   - les secrets Intuit ne cohabitent avec AUCUN autre connecteur ;
 *   - le secret d'appel (FINANCE_PROXY_SECRET) est distinct du GENERAL_PROXY_SECRET
 *     et n'a AUCUN repli : sans lui, le service refuse de démarrer ;
 *   - les environnements opérationnels (cron support.js, etc.) ne reçoivent JAMAIS
 *     ce secret — une fuite de leur env n'expose pas la comptabilité.
 *
 * ROUTAGE (pas de préfixe connecteur — service mono-usage) :
 *   GET  /health              → sonde (sans auth)
 *   GET  /actions             → liste des actions (sans secret)
 *   POST /:action  {..params} → exécute (en-tête X-Proxy-Secret: FINANCE_PROXY_SECRET)
 *
 * Actions LECTURE : report, query, companyinfo, read
 * Actions ÉCRITURE (tenue de livres) : create, update, remove
 * NB : la file « À réviser » du flux bancaire n'est pas exposée par l'API Intuit ;
 * on crée les transactions directement et QBO les apparie aux lignes bancaires.
 *
 * OAuth2 Intuit : access token 60 min ; REFRESH TOKEN TOURNANT (~24 h). Le plus
 * récent doit survivre aux redémarrages : sync automatique de la variable d'env
 * QBO_REFRESH_TOKEN de CE service via l'API Render (RENDER_API_KEY +
 * RENDER_SERVICE_ID = l'ID srv-... de CE service, pas du proxy général).
 *
 * Variables d'environnement (Render) :
 *   FINANCE_PROXY_SECRET   secret d'appel de CE service (aucun repli)          [requis]
 *   QBO_CLIENT_ID          Client ID de l'app Intuit (developer.intuit.com)    [requis]
 *   QBO_CLIENT_SECRET      Client Secret de l'app Intuit                       [requis]
 *   QBO_REALM_ID           Realm ID (Company ID) QuickBooks                    [requis]
 *   QBO_REFRESH_TOKEN      refresh token OAuth2 (voir ../qbo_auth.js)          [requis]
 *   RENDER_API_KEY         clé API Render (sync du refresh token tournant)     [recommandé]
 *   RENDER_SERVICE_ID      ID srv-... de CE service                            [recommandé]
 *   QBO_ENV                "production" (défaut) ou "sandbox"                  [facultatif]
 *   QBO_MINORVERSION       défaut "75"                                         [facultatif]
 *   QBO_TOKEN_FILE         persistance fichier (si disque persistant monté)    [facultatif]
 *   PORT                   (auto, fourni par Render)
 *
 * Déploiement : New → Web Service, repo lasclay/missive-automations,
 * Root Directory = finance-proxy, Start = node server.js. Voir FINANCE_PROXY.md.
 *
 * Node 18+. Aucune dépendance.
 */

const http = require("node:http");
const fs = require("node:fs");

const SECRET = process.env.FINANCE_PROXY_SECRET;
const PORT = process.env.PORT || 3000;
if (!SECRET) { console.error("Manque FINANCE_PROXY_SECRET (aucun repli, par design)."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function qs(params) {
  if (!params || typeof params !== "object") return "";
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

// Appel HTTP JSON générique avec retry réseau + gestion 429 (Retry-After).
async function httpJson({ method = "GET", url, headers = {}, body }, tries = 0) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Accept: "application/json", ...headers, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (tries < 3) { await sleep((tries + 1) * 2000); return httpJson({ method, url, headers, body }, tries + 1); }
    throw new Error(`réseau: ${e.message}`);
  }
  if (res.status === 429 && tries < 3) {
    const ra = res.headers.get("retry-after");
    const wait = ra && !Number.isNaN(Number(ra)) ? Math.min(Number(ra) + 1, 65) : 10;
    await sleep(wait * 1000);
    return httpJson({ method, url, headers, body }, tries + 1);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url.replace(/https?:\/\/[^/]+/, "")} → ${res.status} ${text.slice(0, 300)}`);
  try { return text ? JSON.parse(text) : {}; } catch { return { raw: text }; }
}

// ==========================================================================
// QuickBooks Online (API v3, OAuth2) — voir l'en-tête pour la rotation du token.
// ==========================================================================
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

if (!CLIENT_ID || !CLIENT_SECRET || !REALM || !(SEED || TOKEN_FILE)) {
  console.error("Manque QBO_CLIENT_ID / QBO_CLIENT_SECRET / QBO_REALM_ID / QBO_REFRESH_TOKEN.");
  process.exit(1);
}

let access = { token: null, exp: 0 };
let refresh = null;

function loadRefresh() {
  if (refresh) return refresh;
  if (TOKEN_FILE) {
    try { refresh = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")).refresh_token || null; } catch { /* premier run */ }
  }
  return refresh || SEED || null;
}

async function saveRefresh(rt) {
  refresh = rt;
  if (TOKEN_FILE) {
    try { fs.writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: rt, saved_at: new Date().toISOString() })); }
    catch (e) { console.warn(`écriture ${TOKEN_FILE}: ${e.message}`); }
  }
  if (RENDER_KEY && RENDER_SVC) {
    try {
      const r = await fetch(`https://api.render.com/v1/services/${RENDER_SVC}/env-vars/QBO_REFRESH_TOKEN`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${RENDER_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ value: rt }),
      });
      if (!r.ok) console.warn(`sync env Render → ${r.status}`);
    } catch (e) { console.warn(`sync env Render: ${e.message}`); }
  } else if (!TOKEN_FILE) {
    console.warn("refresh token tourné mais AUCUNE persistance (RENDER_API_KEY+RENDER_SERVICE_ID ou QBO_TOKEN_FILE): perdu au prochain redémarrage.");
  }
}

async function token() {
  if (access.token && Date.now() < access.exp) return access.token;
  const rt = loadRefresh();
  if (!rt) throw new Error("aucun refresh token (QBO_REFRESH_TOKEN; voir ../qbo_auth.js)");
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
    throw new Error(`token → ${res.status} ${t}${/invalid_grant/.test(t) ? " (refresh token périmé/tourné ailleurs: refaire l'autorisation avec qbo_auth.js)" : ""}`);
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
    headers: { Authorization: `Bearer ${await token()}` },
  });
const post = async (path, body, params) =>
  httpJson({
    method: "POST",
    url: `${BASE}/v3/company/${encodeURIComponent(REALM)}${path}${qs({ minorversion: MINOR, ...(params || {}) })}`,
    headers: { Authorization: `Bearer ${await token()}` },
    body,
  });

// Entités permises en écriture (tenue de livres).
const ENTITES = new Set([
  "purchase", "journalentry", "deposit", "transfer", "bill", "billpayment",
  "invoice", "payment", "salesreceipt", "creditmemo", "vendorcredit", "refundreceipt",
  "vendor", "customer", "item", "account", "attachable",
]);
const entite = (p) => {
  const e = ((p && p.entity) || "").toLowerCase();
  if (!ENTITES.has(e)) throw new Error(`entity requis, parmi: ${[...ENTITES].join(", ")}`);
  return e;
};

const ACTIONS = {
  // ---- LECTURE ----
  // Rapport comptable: { name: "ProfitAndLoss"|"BalanceSheet"|"TrialBalance"|..., start_date,
  // end_date, summarize_column_by, accounting_method, ... }
  report: (p) => {
    if (!p || !p.name) throw new Error("name requis (ex. ProfitAndLoss, BalanceSheet)");
    const { name, ...rest } = p;
    return get(`/reports/${encodeURIComponent(name)}`, rest);
  },
  // Requête SQL-like v3: { query: "select * from Account maxresults 200" }
  query: (p) => {
    if (!p || !p.query) throw new Error("query requis");
    return get("/query", { query: p.query });
  },
  companyinfo: () => get(`/companyinfo/${encodeURIComponent(REALM)}`),
  // Une entité par Id (donne le SyncToken courant): { entity, id }
  read: (p) => {
    const e = entite(p);
    if (!p.id) throw new Error("id requis");
    return get(`/${e}/${encodeURIComponent(p.id)}`);
  },

  // Télécharger une pièce jointe (le sandbox de l'agent ne peut pas atteindre le
  // domaine de documents d'Intuit; le proxy relaie le binaire en base64): { id } = Attachable Id.
  download: async (p) => {
    if (!p || !p.id) throw new Error("id requis (Id d'un Attachable)");
    const a = await get(`/attachable/${encodeURIComponent(p.id)}`);
    const att = a && a.Attachable;
    if (!att || !att.TempDownloadUri) throw new Error("Attachable introuvable ou sans TempDownloadUri");
    let res;
    try { res = await fetch(att.TempDownloadUri); }
    catch (e) { throw new Error(`téléchargement: ${e.message}`); }
    if (!res.ok) throw new Error(`téléchargement → ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 15e6) throw new Error(`fichier trop gros (${buf.length} octets, max 15 Mo)`);
    return {
      fileName: att.FileName || `attachable-${p.id}`,
      contentType: res.headers.get("content-type") || "application/octet-stream",
      size: buf.length,
      base64: buf.toString("base64"),
    };
  },

  // ---- ÉCRITURE (tenue de livres) ----
  // Créer: { entity, body } — body = objet QBO v3 complet.
  create: (p) => {
    const e = entite(p);
    if (!p.body || typeof p.body !== "object") throw new Error("body requis (objet QBO v3)");
    return post(`/${e}`, p.body);
  },
  // Mettre à jour (SPARSE par défaut): { entity, body } avec Id + SyncToken frais (via read).
  update: (p) => {
    const e = entite(p);
    const b = p.body;
    if (!b || !b.Id || b.SyncToken === undefined) throw new Error("body avec Id et SyncToken requis");
    return post(`/${e}`, b.sparse === undefined ? { ...b, sparse: true } : b);
  },
  // Supprimer une TRANSACTION (destructeur; entités de liste → update Active:false).
  remove: (p) => {
    const e = entite(p);
    const b = p.body || p;
    if (!b.Id || b.SyncToken === undefined) throw new Error("Id et SyncToken requis");
    return post(`/${e}`, { Id: b.Id, SyncToken: b.SyncToken }, { operation: "delete" });
  },
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

const server = http.createServer(async (req, res) => {
  try {
    const route = (req.url || "").split("?")[0];
    if (req.method === "GET" && route === "/health") return json(res, 200, { ok: true, service: "finance-proxy" });
    if (req.method === "GET" && route === "/actions") return json(res, 200, { service: "finance-proxy", connector: "quickbooks", actions: Object.keys(ACTIONS) });
    if (req.method !== "POST") return json(res, 404, { error: "not found" });

    if ((req.headers["x-proxy-secret"] || "") !== SECRET) return json(res, 401, { error: "unauthorized" });

    const aname = route.split("/").filter(Boolean)[0] || "";
    const action = ACTIONS[aname];
    if (!action) return json(res, 404, { error: `action inconnue : ${aname}`, actions: Object.keys(ACTIONS) });

    const body = await readBody(req);
    if (body === null) return json(res, 400, { error: "invalid JSON" });

    const data = await action(body);
    return json(res, 200, { ok: true, action: aname, data });
  } catch (e) {
    return json(res, 502, { error: String(e.message || e).slice(0, 400) });
  }
});

server.listen(PORT, () => {
  console.log(`finance-proxy à l'écoute sur :${PORT} — QuickBooks realm ${REALM} (${BASE.includes("sandbox") ? "SANDBOX" : "production"}).`);
  if (!(RENDER_KEY && RENDER_SVC) && !TOKEN_FILE) {
    console.warn("⚠ Aucune persistance du refresh token tournant (RENDER_API_KEY + RENDER_SERVICE_ID recommandés).");
  }
});
