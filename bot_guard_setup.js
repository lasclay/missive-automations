/**
 * Lasclay — bot_guard_setup.js
 * --------------------------------------------------------------------------
 * Enregistre (une fois) les webhooks Shopify du bot-guard vers le proxy
 * général : customers/create et orders/create → POST /webhooks/shopify.
 * Idempotent : liste d'abord les webhooks existants et ne crée que les
 * manquants; relançable sans risque.
 *
 * Prérequis (mêmes variables que bot_guard.js, + l'URL publique du proxy) :
 *   SHOPIFY_STORE        sous-domaine de la boutique (ex. `lasclay`)
 *   SHOPIFY_ADMIN_TOKEN  jeton Admin API (scope write nécessaire pour créer
 *                        les webhooks; la signature utilisera la clé secrète
 *                        de la MÊME app → SHOPIFY_WEBHOOK_SECRET côté proxy)
 *   GENERAL_PROXY_URL    URL publique du proxy (défaut :
 *                        https://general-proxy-5muf.onrender.com)
 *
 * Usage : node bot_guard_setup.js
 */

const STORE = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const PROXY_URL = (process.env.GENERAL_PROXY_URL || "https://general-proxy-5muf.onrender.com").replace(/\/$/, "");
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-07";
const CALLBACK = `${PROXY_URL}/webhooks/shopify`;
const TOPICS = ["CUSTOMERS_CREATE", "ORDERS_CREATE"];

if (!STORE || !TOKEN) { console.error("Manque SHOPIFY_STORE et/ou SHOPIFY_ADMIN_TOKEN."); process.exit(1); }

async function gql(query, variables) {
  const res = await fetch(`https://${STORE}.myshopify.com/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const out = await res.json();
  if (!res.ok || out.errors) throw new Error(JSON.stringify(out.errors || out).slice(0, 400));
  return out.data;
}

(async () => {
  const existants = await gql(`{
    webhookSubscriptions(first: 50) { edges { node { id topic endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } } } } }
  }`);
  const deja = new Set(
    existants.webhookSubscriptions.edges
      .filter((e) => e.node.endpoint && e.node.endpoint.callbackUrl === CALLBACK)
      .map((e) => e.node.topic),
  );

  for (const topic of TOPICS) {
    if (deja.has(topic)) { console.log(`${topic} → déjà enregistré (${CALLBACK})`); continue; }
    const data = await gql(
      `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
          webhookSubscription { id }
          userErrors { field message }
        }
      }`,
      { topic, sub: { callbackUrl: CALLBACK, format: "JSON" } },
    );
    const r = data.webhookSubscriptionCreate;
    if (r.userErrors && r.userErrors.length) console.error(`${topic} → ERREUR:`, r.userErrors);
    else console.log(`${topic} → créé (${r.webhookSubscription.id})`);
  }
  console.log("Terminé. Vérifie que /webhooks/shopify répond bien 401 sans signature (proxy déployé + variables).");
})().catch((e) => { console.error("Échec:", e.message); process.exit(1); });
