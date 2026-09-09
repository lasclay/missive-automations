/**
 * Client Shopify Admin GraphQL — mêmes identifiants que support.js / shopify_check.js.
 *   SHOPIFY_STORE          lasclay.myshopify.com
 *   SHOPIFY_CLIENT_ID      + SHOPIFY_CLIENT_SECRET   (app « Render connector », client credentials)
 *   SHOPIFY_ADMIN_TOKEN    (alternative héritée : jeton fixe shpat_…)
 *   SHOPIFY_API_VERSION    défaut 2025-07 (les payouts Shopify Payments demandent ≥ 2024-04)
 *
 * Portées nécessaires pour l'app A2X-maison :
 *   read_orders, read_all_orders, read_shopify_payments_payouts,
 *   read_shopify_payments_disputes, read_locations
 */
const STORE = process.env.SHOPIFY_STORE || "";
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || "";
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || "";
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || "";
const VER = process.env.SHOPIFY_API_VERSION || "2025-07";

let cachedToken = null;
let cachedUntil = 0;
let cachedScopes = null;

async function accessToken({ fresh = false } = {}) {
  if (TOKEN) return TOKEN;
  if (fresh) { cachedToken = null; cachedUntil = 0; }
  if (cachedToken && Date.now() < cachedUntil) return cachedToken;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Manque SHOPIFY_ADMIN_TOKEN ou SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET.");
  }
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
  const res = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`client_credentials → ${res.status} ${await res.text()}`);
  const j = await res.json();
  cachedToken = j.access_token;
  cachedScopes = j.scope || "";
  cachedUntil = Date.now() + Math.max(60, (j.expires_in || 3600) - 120) * 1000;
  console.log(`Shopify : jeton obtenu (expire dans ${j.expires_in || "?"}s) — portées : ${cachedScopes || "(non communiquées)"}`);
  return cachedToken;
}

/**
 * Jette le jeton en cache — à appeler quand les portées de l'app ont changé.
 *
 * Le jeton vaut une heure et porte les portées qu'il avait à l'émission. Publier une
 * nouvelle version de l'app ne le met pas à jour : jusqu'à son expiration, les appels
 * continuent d'être refusés alors que le droit est accordé. C'est un délai d'une heure qui
 * ressemble à une panne, et qui pousse à chercher un problème qui n'existe plus.
 */
function oublierJeton() { cachedToken = null; cachedUntil = 0; cachedScopes = null; }

/**
 * Diagnostic : demande un jeton neuf et rapporte les portées qu'il porte réellement.
 * C'est la seule façon de distinguer « portée pas encore released » de
 * « app pas réinstallée après l'ajout de la portée ».
 */
async function tokenScopes() {
  if (TOKEN) return { mode: "jeton fixe", scopes: null, note: "SHOPIFY_ADMIN_TOKEN : les portées viennent de l'installation de l'app." };
  await accessToken({ fresh: true });
  const scopes = (cachedScopes || "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    mode: "client credentials",
    scopes,
    payouts: scopes.includes("read_shopify_payments_payouts"),
    accounts: scopes.includes("read_shopify_payments_accounts") || scopes.includes("read_shopify_payments"),
  };
}

/** Exécute une requête GraphQL avec backoff sur throttling / 5xx. */
async function gql(query, variables = {}, { retries = 5 } = {}) {
  if (!STORE) throw new Error("SHOPIFY_STORE manquante.");
  const token = await accessToken();
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`https://${STORE}/admin/api/${VER}/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query, variables }),
      });
      const text = await res.text();
      if (res.status === 429 || res.status >= 500) throw new Error(`Shopify ${res.status} ${text.slice(0, 200)}`);
      const j = JSON.parse(text);
      if (j.errors && j.errors.length) {
        const throttled = j.errors.some((e) => (e.extensions && e.extensions.code) === "THROTTLED");
        if (throttled) throw new Error("THROTTLED");
        const e = new Error("GraphQL: " + j.errors.map((x) => x.message).join(" | "));
        e.fatal = true;
        e.graphQLErrors = j.errors;
        throw e;
      }
      return j.data;
    } catch (e) {
      lastErr = e;
      if (e.fatal || attempt === retries) break;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    }
  }
  throw lastErr;
}

/** Parcourt une connexion paginée. `pick` extrait la connexion depuis `data`. */
async function paginate(query, variables, pick, { pageSize = 100, max = Infinity } = {}) {
  const out = [];
  let after = null;
  for (;;) {
    const data = await gql(query, { ...variables, first: Math.min(pageSize, max - out.length), after });
    const conn = pick(data);
    if (!conn) break;
    const nodes = (conn.edges || []).map((e) => e.node);
    out.push(...nodes);
    if (out.length >= max || !conn.pageInfo || !conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return out;
}

const gid = (v) => (typeof v === "string" && v.includes("/") ? v.split("/").pop() : v);

module.exports = { gql, paginate, gid, tokenScopes, oublierJeton, STORE, VER };
