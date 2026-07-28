/**
 * Lasclay — bot-guard (anti-bots Shopify)
 * --------------------------------------------------------------------------
 * Reçoit les webhooks Shopify (customers/create, orders/create) sur le proxy
 * général et neutralise la vague de bots « prénom.nom numéroté » (anna.taylor262@
 * gmail.com, david.jones48@outlook.com, …) qui a pollué la base clients
 * (3 300+ profils purgés le 2026-07-28, commandes de card testing remboursées).
 *
 * DÉTECTION (deux niveaux, volontairement prudente) :
 *   1. BOT CONFIRMÉ  — email `prenom.nom<numéro>@gmail|outlook.com` dont le
 *      prénom.nom figure dans la liste NOMS_BOTS (les 8 clusters observés,
 *      extensible via BOT_GUARD_NAMES). → tag `bot` + ANNULATION de commande.
 *   2. SUSPECT       — même forme d'email mais nom hors liste. → tag
 *      `bot-suspect` seulement, AUCUNE annulation (zéro faux positif coûteux).
 *
 * ACTIONS :
 *   customers/create → tagsAdd `bot` (ou `bot-suspect`) sur le client.
 *   orders/create    → si bot confirmé : orderCancel (raison FRAUD, restock,
 *                      remboursement, sans courriel au « client ») + tag client.
 *
 * SÉCURITÉ : la route /webhooks/shopify est SANS X-Proxy-Secret (Shopify ne
 * peut pas l'envoyer). Elle est protégée par la signature HMAC-SHA256 de
 * Shopify (en-tête X-Shopify-Hmac-Sha256, secret = clé secrète API de l'app
 * admin, variable SHOPIFY_WEBHOOK_SECRET). Sans variable, la route répond 503.
 *
 * Variables d'environnement (Render, service general-proxy) :
 *   SHOPIFY_STORE           sous-domaine de la boutique (ex. `lasclay`).      [requis]
 *   SHOPIFY_ADMIN_TOKEN     jeton Admin API (app custom; scopes:              [requis]
 *                           read/write_customers, read/write_orders).
 *   SHOPIFY_WEBHOOK_SECRET  clé secrète API de l'app (signature webhooks).    [requis]
 *   BOT_GUARD_NAMES         noms additionnels `prenom.nom` séparés par des    [optionnel]
 *                           virgules, ajoutés à la liste des bots confirmés.
 *
 * Enregistrement des webhooks (une fois, après déploiement + variables) :
 *   node bot_guard_setup.js   — voir BOT_GUARD.md
 */

const crypto = require("node:crypto");

const STORE = process.env.SHOPIFY_STORE || "";
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || "";
const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || "";
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-07";

// Les 8 clusters observés en 2026 (~400 variantes chacun) + extensions via env.
const NOMS_BOTS = new Set(
  [
    "anna.taylor", "david.jones", "emily.davis", "james.smith",
    "john.johnson", "michael.brown", "robert.williams", "sarah.wilson",
    ...(process.env.BOT_GUARD_NAMES || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  ],
);

// Forme générique des emails de la vague : prenom.nom + 1-4 chiffres @gmail/outlook.
const RE_EMAIL_BOT = /^([a-z]+\.[a-z]+)\d{1,4}@(gmail|outlook)\.com$/;

/** Classe un email : "bot" (confirmé), "suspect" (même forme, nom inconnu) ou null. */
function classifierEmail(email) {
  const m = RE_EMAIL_BOT.exec(String(email || "").trim().toLowerCase());
  if (!m) return null;
  return NOMS_BOTS.has(m[1]) ? "bot" : "suspect";
}

const enabled = () => !!(STORE && TOKEN && WEBHOOK_SECRET);

function verifierHmac(rawBody, header) {
  if (!header) return false;
  const digest = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest); const b = Buffer.from(String(header));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function adminGraphql(query, variables) {
  const res = await fetch(`https://${STORE}.myshopify.com/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.errors) throw new Error(`Admin API ${res.status}: ${JSON.stringify(out.errors || out).slice(0, 300)}`);
  return out.data;
}

const tagCustomer = (gid, tags) =>
  adminGraphql(
    `mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }`,
    { id: gid, tags },
  );

const cancelOrder = (gid) =>
  adminGraphql(
    `mutation($id: ID!) { orderCancel(orderId: $id, reason: FRAUD, refund: true, restock: true,
        notifyCustomer: false, staffNote: "bot-guard: commande bot annulée automatiquement") {
      job { id } orderCancelUserErrors { message } userErrors { message } } }`,
    { id: gid },
  );

/** Traite un webhook déjà vérifié. Retourne un résumé loggable. */
async function traiter(topic, payload) {
  if (topic === "customers/create") {
    const verdict = classifierEmail(payload.email);
    if (!verdict) return { verdict: "ok" };
    const gid = payload.admin_graphql_api_id || `gid://shopify/Customer/${payload.id}`;
    await tagCustomer(gid, verdict === "bot" ? ["bot"] : ["bot-suspect"]);
    return { verdict, customer: payload.email };
  }
  if (topic === "orders/create") {
    const email = payload.email || (payload.customer && payload.customer.email);
    const verdict = classifierEmail(email);
    if (verdict !== "bot") return { verdict: verdict || "ok" };
    const orderGid = payload.admin_graphql_api_id || `gid://shopify/Order/${payload.id}`;
    await cancelOrder(orderGid);
    if (payload.customer) {
      const cGid = payload.customer.admin_graphql_api_id || `gid://shopify/Customer/${payload.customer.id}`;
      await tagCustomer(cGid, ["bot", "bot-card-testing"]).catch(() => {});
    }
    return { verdict: "bot", cancelled: payload.name, customer: email };
  }
  return { verdict: "ignored", topic };
}

/**
 * Handler HTTP pour POST /webhooks/shopify (appelé par server.js AVANT l'auth
 * par X-Proxy-Secret). Lit le corps BRUT (nécessaire au HMAC), vérifie la
 * signature, répond 200 vite (Shopify réessaie sinon) puis agit.
 */
function handleWebhook(req, res) {
  const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (!enabled()) return json(503, { error: "bot-guard non configuré (SHOPIFY_STORE / SHOPIFY_ADMIN_TOKEN / SHOPIFY_WEBHOOK_SECRET)" });

  let raw = "";
  req.on("data", (c) => { raw += c; if (raw.length > 2e6) req.destroy(); });
  req.on("end", async () => {
    if (!verifierHmac(raw, req.headers["x-shopify-hmac-sha256"])) return json(401, { error: "signature invalide" });
    const topic = String(req.headers["x-shopify-topic"] || "");
    let payload;
    try { payload = JSON.parse(raw); } catch { return json(400, { error: "invalid JSON" }); }
    json(200, { ok: true }); // répondre avant d'agir : Shopify exige < 5 s
    try {
      const resume = await traiter(topic, payload);
      if (resume.verdict !== "ok" && resume.verdict !== "ignored") console.log(`bot-guard ${topic}:`, JSON.stringify(resume));
    } catch (e) {
      console.error(`bot-guard ${topic} ÉCHEC:`, String(e.message || e).slice(0, 300));
    }
  });
}

module.exports = { handleWebhook, classifierEmail, enabled };
