/**
 * Lasclay — qbo-proxy (v1)
 * --------------------------------------------------------------------------
 * Petit proxy HTTP LECTURE SEULE entre Claude et l'API QuickBooks Online.
 * Les CLÉS INTUIT (client id/secret + refresh token) restent ICI, côté serveur
 * (secrets Render), et ne sont JAMAIS renvoyées ni journalisées. Claude appelle
 * ce proxy avec un PROXY_SECRET distinct (révocable) et ne voit jamais Intuit.
 *
 * Pourquoi : le connecteur QuickBooks de Claude est bloqué pour les comptes
 * canadiens (app US-only). Une app développeur Intuit à soi n'a pas cette
 * limite; ce proxy la porte, sur le modèle de missive-proxy.
 *
 * Périmètre volontairement RESTREINT (lecture seulement) :
 *   GET  /health                 → sonde (sans auth)
 *   POST /company  {}            → infos compagnie (test de connexion)
 *   POST /report   {type, params}→ rapport QBO (ProfitAndLoss, BalanceSheet,
 *                                  TransactionList, GeneralLedger, AgedPayables,
 *                                  ProfitAndLossDetail, ...). params = query string
 *                                  Intuit (start_date, end_date, summarize_column_by...)
 *   POST /query    {q}           → requête QBO SQL — SELECT uniquement (garde-fou)
 *
 * AUTH : chaque route (sauf /health) exige l'en-tête X-Proxy-Secret.
 *
 * OAuth2 Intuit : le refresh token TOURNE à chaque rafraîchissement. On garde
 * en mémoire le plus récent; la variable d'environnement ne sert que d'amorce.
 * Si le service redémarre longtemps après la dernière rotation et que l'amorce
 * est périmée, re-seeder QBO_REFRESH_TOKEN (voir README).
 *
 * Node 18+ (fetch natif). Aucune dépendance.
 *
 * Variables d'environnement (secrets Render) :
 *   QBO_CLIENT_ID      clé client de TON app Intuit                     [requis]
 *   QBO_CLIENT_SECRET  secret client                                    [requis]
 *   QBO_REFRESH_TOKEN  refresh token OAuth2 (amorce)                    [requis]
 *   QBO_REALM_ID       id de compagnie QBO (realm)                      [requis]
 *   PROXY_SECRET       secret partagé que Claude envoie en en-tête      [requis]
 *   QBO_MINORVERSION   minorversion API (défaut 75)                  [facultatif]
 *   PORT               port d'écoute (fourni par Render)                  [auto]
 */

const http = require("node:http");

const CLIENT_ID = process.env.QBO_CLIENT_ID;
const CLIENT_SECRET = process.env.QBO_CLIENT_SECRET;
const SEED_REFRESH = process.env.QBO_REFRESH_TOKEN;
const REALM = process.env.QBO_REALM_ID;
const PROXY_SECRET = process.env.PROXY_SECRET;
const MINOR = process.env.QBO_MINORVERSION || "75";
const PORT = process.env.PORT || 3000;

const OAUTH_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const API = `https://quickbooks.api.intuit.com/v3/company/${REALM}`;

for (const [k, v] of Object.entries({ QBO_CLIENT_ID: CLIENT_ID, QBO_CLIENT_SECRET: CLIENT_SECRET, QBO_REFRESH_TOKEN: SEED_REFRESH, QBO_REALM_ID: REALM, PROXY_SECRET })) {
  if (!v) { console.error(`Manque ${k}.`); process.exit(1); }
}

// --- Jetons (rotation en mémoire) ---
let refreshToken = SEED_REFRESH;
let accessToken = null;
let accessExpiry = 0; // epoch ms

async function ensureAccessToken() {
  if (accessToken && Date.now() < accessExpiry - 60000) return accessToken;
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OAuth refresh → ${res.status} (re-seeder QBO_REFRESH_TOKEN si invalid_grant)`);
  const j = JSON.parse(text);
  accessToken = j.access_token;
  accessExpiry = Date.now() + (j.expires_in || 3600) * 1000;
  if (j.refresh_token && j.refresh_token !== refreshToken) refreshToken = j.refresh_token; // rotation
  return accessToken;
}

async function qboGet(path) {
  const tok = await ensureAccessToken();
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${API}${path}${sep}minorversion=${MINOR}`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path.split("?")[0]} → ${res.status} ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

// --- Garde-fous ---
const REPORT_TYPES = new Set([
  "ProfitAndLoss", "ProfitAndLossDetail", "BalanceSheet", "CashFlow",
  "TransactionList", "GeneralLedger", "TrialBalance",
  "AgedPayables", "AgedPayableDetail", "AgedReceivables", "AgedReceivableDetail",
  "VendorExpenses", "CustomerIncome", "AccountList",
]);
function selectOnly(q) {
  const t = String(q || "").trim();
  if (!/^select\s/i.test(t)) throw new Error("Seules les requêtes SELECT sont permises.");
  if (/;|--/.test(t)) throw new Error("Requête refusée.");
  return t;
}
function cleanParams(params) {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (/^[a-z_]+$/i.test(k) && typeof v !== "object") out.set(k, String(v));
  }
  return out.toString();
}

// --- Serveur ---
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, realm: REALM.slice(0, 4) + "…" });
    if (req.method !== "POST") return send(res, 405, { error: "POST seulement" });
    if (req.headers["x-proxy-secret"] !== PROXY_SECRET) return send(res, 401, { error: "unauthorized" });

    let body = "";
    for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};

    if (req.url === "/company") {
      return send(res, 200, await qboGet(`/companyinfo/${REALM}`));
    }
    if (req.url === "/report") {
      const type = String(data.type || "");
      if (!REPORT_TYPES.has(type)) return send(res, 400, { error: `type invalide; permis: ${[...REPORT_TYPES].join(", ")}` });
      const qs = cleanParams(data.params);
      return send(res, 200, await qboGet(`/reports/${type}${qs ? "?" + qs : ""}`));
    }
    if (req.url === "/query") {
      const q = selectOnly(data.q);
      return send(res, 200, await qboGet(`/query?query=${encodeURIComponent(q)}`));
    }
    return send(res, 404, { error: "route inconnue" });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e).slice(0, 500) });
  }
});

server.listen(PORT, () => console.log(`qbo-proxy à l'écoute sur :${PORT}`));
