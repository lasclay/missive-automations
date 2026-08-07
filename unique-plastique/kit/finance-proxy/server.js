/**
 * Unique Plastique — finance-proxy (v1)
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
 *   GET  /token-status        → état de la connexion QuickBooks (sans secret, sans valeur)
 *   GET  /authorize?secret=…  → réautorisation Intuit en un clic
 *   GET  /callback            → retour d'Intuit (appelé par le navigateur)
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
 *   QBO_REDIRECT_URI       retour OAuth ; défaut <URL du service>/callback      [facultatif]
 *   PORT                   (auto, fourni par Render)
 *
 * Déploiement : New → Web Service, repo <ton-org>/unique-plastique-automations,
 * Root Directory = finance-proxy, Start = node server.js. Voir FINANCE_PROXY.md.
 *
 * Node 18+. Aucune dépendance.
 */

const http = require("node:http");
const fs = require("node:fs");
const crypto = require("node:crypto");

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
  // 300 caractères coupaient le refus de QuickBooks juste avant son motif : le
  // message générique tient dans les 300 premiers, la cause réelle est dans le
  // champ « Detail » qui suit. Sans elle, une écriture refusée est indébogable.
  if (!res.ok) throw new Error(`${method} ${url.replace(/https?:\/\/[^/]+/, "")} → ${res.status} ${text.slice(0, 2000)}`);
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

/**
 * Historique des derniers refresh tokens.
 *
 * Intuit ROULE le jeton : chaque rafraîchissement en émet un nouveau et périme
 * l'ancien (les 100 jours annoncés sont la durée de vie maximale, pas celle du
 * jeton qu'on détient). Si la sauvegarde du nouveau échoue — écriture Render
 * ratée, redémarrage au mauvais moment, deux rafraîchissements simultanés — on
 * se retrouve avec un jeton mort et il faut tout réautoriser à la main.
 * Garder les précédents permet de retomber dessus au lieu de casser.
 */
const history = [];
let lastRotation = null;
let lastSyncOk = null;
const remember = (rt) => {
  if (!rt) return;
  const i = history.indexOf(rt);
  if (i !== -1) history.splice(i, 1);
  history.unshift(rt);
  history.splice(5);
};

function loadRefresh() {
  if (refresh) return refresh;
  if (TOKEN_FILE) {
    try {
      const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
      refresh = saved.refresh_token || null;
      for (const rt of saved.history || []) remember(rt);
    } catch { /* premier run */ }
  }
  remember(refresh);
  remember(SEED);
  return refresh || SEED || null;
}

/**
 * Vérifie que la sauvegarde du jeton MARCHERA, sans attendre la prochaine
 * rotation. Une clé Render invalide ou un mauvais RENDER_SERVICE_ID ne se
 * voyaient qu'au moment où le jeton tournait — c'est-à-dire trop tard, une fois
 * l'ancien déjà périmé. Un GET est sans effet de bord : il ne redéploie rien.
 */
let persistCheck = { testee: false, ok: null, motif: null };
async function checkPersistence() {
  if (TOKEN_FILE) { persistCheck = { testee: true, ok: true, motif: `fichier ${TOKEN_FILE}` }; return persistCheck; }
  if (!(RENDER_KEY && RENDER_SVC)) {
    persistCheck = { testee: true, ok: false, motif: "RENDER_API_KEY et/ou RENDER_SERVICE_ID absents" };
    return persistCheck;
  }
  try {
    const r = await fetch(`https://api.render.com/v1/services/${RENDER_SVC}/env-vars?limit=1`, {
      headers: { Authorization: `Bearer ${RENDER_KEY}`, Accept: "application/json" },
    });
    persistCheck = r.ok
      ? { testee: true, ok: true, motif: "env Render accessible en écriture" }
      : { testee: true, ok: false, motif: `API Render → ${r.status} ${r.status === 401 ? "(clé invalide)" : r.status === 404 ? "(RENDER_SERVICE_ID ne correspond à aucun service)" : ""}`.trim() };
  } catch (e) {
    persistCheck = { testee: true, ok: false, motif: `API Render injoignable : ${e.message}` };
  }
  return persistCheck;
}

async function saveRefresh(rt) {
  refresh = rt;
  remember(rt);
  lastRotation = new Date().toISOString();
  if (TOKEN_FILE) {
    try { fs.writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: rt, history, saved_at: new Date().toISOString() })); }
    catch (e) { console.warn(`écriture ${TOKEN_FILE}: ${e.message}`); }
  }
  if (RENDER_KEY && RENDER_SVC) {
    try {
      const r = await fetch(`https://api.render.com/v1/services/${RENDER_SVC}/env-vars/QBO_REFRESH_TOKEN`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${RENDER_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ value: rt }),
      });
      lastSyncOk = r.ok;
      // Un échec ici est la panne annoncée : le jeton tourné ne survivra pas au
      // redémarrage. On le crie plutôt que de le murmurer.
      if (!r.ok) console.error(`⚠️  SYNC ENV RENDER ÉCHOUÉE → ${r.status} ${(await r.text()).slice(0, 200)} — le refresh token tourné N'EST PAS sauvegardé.`);
      else console.log("refresh token tourné et sauvegardé dans l'env Render.");
    } catch (e) { lastSyncOk = false; console.error(`⚠️  SYNC ENV RENDER ÉCHOUÉE : ${e.message} — le refresh token tourné N'EST PAS sauvegardé.`); }
  } else if (!TOKEN_FILE) {
    console.warn("refresh token tourné mais AUCUNE persistance (RENDER_API_KEY+RENDER_SERVICE_ID ou QBO_TOKEN_FILE): perdu au prochain redémarrage.");
  }
}

/** Un seul échange à la fois : deux en parallèle en périment mutuellement un. */
let inFlight = null;

async function exchange(rt) {
  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: rt }).toString(),
  });
  const text = await res.text();
  if (!res.ok) { const e = new Error(text.slice(0, 300)); e.status = res.status; e.invalidGrant = /invalid_grant/.test(text); throw e; }
  return JSON.parse(text);
}

async function refreshAccess() {
  const current = loadRefresh();
  if (!current) throw new Error("aucun refresh token (QBO_REFRESH_TOKEN; voir ../qbo_auth.js)");

  // Le courant d'abord, puis les précédents : Intuit laisse un court sursis à
  // l'ancien jeton, ce qui rattrape une sauvegarde perdue au redémarrage.
  const candidates = [current, ...history.filter((x) => x !== current)];
  let last;
  for (const rt of candidates) {
    try {
      const j = await exchange(rt);
      access = { token: j.access_token, exp: Date.now() + Math.max(60, (j.expires_in || 3600) - 120) * 1000 };
      if (j.refresh_token && j.refresh_token !== rt) await saveRefresh(j.refresh_token);
      else { refresh = rt; remember(rt); }
      if (rt !== current) console.warn("refresh token courant refusé — repli sur un précédent, qui a fonctionné.");
      return access.token;
    } catch (e) {
      last = e;
      if (!e.invalidGrant) break;
    }
  }
  throw new Error(`token → ${last && last.status ? last.status : ""} ${last ? last.message : ""}`.trim() +
    (last && last.invalidGrant
      ? ` (tous les refresh tokens connus sont périmés — refaire l'autorisation : node qbo_auth.js url puis exchange, et remettre QBO_REFRESH_TOKEN sur ce service)`
      : ""));
}

async function token() {
  if (access.token && Date.now() < access.exp) return access.token;
  if (!inFlight) inFlight = refreshAccess().finally(() => { inFlight = null; });
  return inFlight;
}

// --------------------------------------------------------------------------
// Réautorisation en un clic.
//
// Sans ça, retrouver un refresh token vivant demandait un terminal, les deux
// secrets de l'app Intuit sous la main, et un copier-coller de jeton vers
// Render — assez pénible pour qu'on repousse, et l'intégration reste morte
// entre-temps. Le service a déjà CLIENT_ID et CLIENT_SECRET : il peut mener
// tout le parcours lui-même et sauvegarder le résultat par le chemin habituel.
// --------------------------------------------------------------------------
const SELF_URL = (process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || "").replace(/\/+$/, "");
const REDIRECT_URI = process.env.QBO_REDIRECT_URI || (SELF_URL ? `${SELF_URL}/callback` : "");
const pending = new Map(); // state → péremption

function authorizeUrl(state) {
  const u = new URL("https://appcenter.intuit.com/connect/oauth2");
  u.searchParams.set("client_id", CLIENT_ID);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "com.intuit.quickbooks.accounting");
  u.searchParams.set("redirect_uri", REDIRECT_URI);
  u.searchParams.set("state", state);
  return u.toString();
}

async function exchangeCode(code) {
  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`échange du code → ${res.status} ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

const page = (titre, corps) =>
  `<!doctype html><html lang="fr"><meta charset="utf-8">
   <meta name="viewport" content="width=device-width,initial-scale=1">
   <title>${titre}</title>
   <style>body{font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
   max-width:640px;margin:60px auto;padding:0 20px;color:#1a1d21}
   code{background:#f2f4f7;padding:2px 6px;border-radius:4px;font-size:13px}
   .ok{color:#157347}.bad{color:#b42318}</style>
   <h1>${titre}</h1>${corps}`;

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

    /**
     * État de la persistance du refresh token, SANS jamais exposer sa valeur.
     * C'est le seul moyen de voir venir la panne : sans persistance, le jeton
     * tourné est perdu au prochain redémarrage et l'intégration casse.
     */
    if (req.method === "GET" && route === "/token-status") {
      const persistance = TOKEN_FILE ? "fichier" : (RENDER_KEY && RENDER_SVC) ? "env Render" : "AUCUNE";
      const chk = await checkPersistence();
      return json(res, 200, {
        service: "finance-proxy",
        persistance,
        // « configuré » ne veut pas dire « fonctionnel » : on teste vraiment.
        durable: chk.ok === true,
        verification: chk.motif,
        jetonsConnus: history.length,
        accessValideJusqua: access.exp ? new Date(access.exp).toISOString() : null,
        derniereRotation: lastRotation,
        derniereSauvegarde: lastSyncOk === null ? "aucune depuis le démarrage" : lastSyncOk ? "réussie" : "ÉCHOUÉE",
        avertissement: chk.ok
          ? null
          : `Le refresh token tourné ne sera PAS sauvegardé (${chk.motif}) : il sera perdu au prochain redémarrage et il faudra refaire l'autorisation Intuit.`,
      });
    }
    if (req.method === "GET" && route === "/actions") return json(res, 200, { service: "finance-proxy", connector: "quickbooks", actions: Object.keys(ACTIONS) });

    // Démarrer la réautorisation. Protégée par le secret du service : sans ça,
    // n'importe qui pourrait lancer un parcours OAuth sur notre app Intuit.
    if (req.method === "GET" && route === "/authorize") {
      const url = new URL(req.url, "http://x");
      if (url.searchParams.get("secret") !== SECRET) {
        res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(page("Accès refusé", `<p class="bad">Ajoute <code>?secret=…</code> (le FINANCE_PROXY_SECRET) à l'URL.</p>`));
      }
      if (!REDIRECT_URI) {
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(page("Configuration incomplète",
          `<p class="bad">Aucune URL de redirection. Définis <code>QBO_REDIRECT_URI</code> sur ce service,
           et ajoute la même valeur dans les <i>Redirect URIs</i> de l'app Intuit.</p>`));
      }
      const state = crypto.randomBytes(16).toString("hex");
      pending.set(state, Date.now() + 10 * 60 * 1000);
      res.writeHead(302, { Location: authorizeUrl(state) });
      return res.end();
    }

    // Retour d'Intuit : on échange le code et on sauvegarde par le chemin normal.
    if (req.method === "GET" && route === "/callback") {
      const url = new URL(req.url, "http://x");
      const state = url.searchParams.get("state");
      const exp = pending.get(state);
      pending.delete(state);
      for (const [s, e] of pending) if (e < Date.now()) pending.delete(s);

      const fail = (msg) => {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(page("Échec de l'autorisation", `<p class="bad">${msg}</p>`));
      };
      if (!exp || exp < Date.now()) return fail("Requête non reconnue ou expirée. Relance depuis <code>/authorize</code>.");
      const code = url.searchParams.get("code");
      const realmId = url.searchParams.get("realmId");
      if (!code) return fail("Intuit n'a pas renvoyé de code.");
      // Garde-fou : autoriser la mauvaise entreprise écrirait dans les mauvais livres.
      if (realmId && REALM && String(realmId) !== String(REALM)) {
        return fail(`Ce compte QuickBooks (realm ${realmId}) n'est pas celui du service (${REALM}).
                     Reconnecte-toi au bon compte, rien n'a été changé.`);
      }
      try {
        const j = await exchangeCode(code);
        if (!j.refresh_token) return fail("Intuit n'a pas renvoyé de refresh token.");
        access = { token: j.access_token, exp: Date.now() + Math.max(60, (j.expires_in || 3600) - 120) * 1000 };
        await saveRefresh(j.refresh_token);
        const durable = TOKEN_FILE || (RENDER_KEY && RENDER_SVC);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(page("QuickBooks reconnecté ✅", `
          <p class="ok">Le nouveau jeton est en place${lastSyncOk === false ? "" : " et sauvegardé"}.</p>
          ${durable
            ? (lastSyncOk === false
                ? `<p class="bad">⚠️ Mais la sauvegarde a échoué : il sera perdu au prochain redémarrage.
                   Vérifie <code>RENDER_API_KEY</code> et <code>RENDER_SERVICE_ID</code>, puis regarde
                   <a href="/token-status">/token-status</a>.</p>`
                : `<p>Tu peux retourner dans l'app.</p>`)
            : `<p class="bad">⚠️ Aucune persistance configurée : ce jeton sera perdu au prochain redémarrage.
               Ajoute <code>RENDER_API_KEY</code> et <code>RENDER_SERVICE_ID</code> sur ce service.</p>`}
          <p><a href="/token-status">Voir l'état de la connexion</a></p>`));
      } catch (e) {
        return fail(String(e.message || e));
      }
    }
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
    return json(res, 502, { error: String(e.message || e).slice(0, 2500) });
  }
});

server.listen(PORT, async () => {
  console.log(`finance-proxy à l'écoute sur :${PORT} — QuickBooks realm ${REALM} (${BASE.includes("sandbox") ? "SANDBOX" : "production"}).`);
  const chk = await checkPersistence();
  console.log(chk.ok
    ? `Persistance du refresh token : OK (${chk.motif}).`
    : `⚠️  PERSISTANCE DU REFRESH TOKEN INOPÉRANTE — ${chk.motif}. Le jeton tourné sera perdu au prochain redémarrage et il faudra refaire l'autorisation Intuit (/authorize?secret=…).`);
});
