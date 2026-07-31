/**
 * Ingestion Shopify directe — le clone reçoit les commandes sans passer par ShipStation.
 *
 * Deux chemins, complémentaires :
 *   • webhook `orders/create` et `orders/updated` — temps réel, signature HMAC vérifiée ;
 *   • `rattraper()` — reprise par l'API, pour l'historique et pour combler ce qu'un webhook
 *     manqué aurait laissé passer. Un webhook perdu ne doit pas signifier une commande perdue.
 *
 * Réutilise le client partagé `a2x/lib/shopify.js` (app « Render connector », client
 * credentials) — pas de second jeu d'identifiants.
 */
const crypto = require("crypto");
const path = require("path");
const { one, run, parse, dump, maintenant, journaliser, reglage, poserReglage } = require("./db");
const orders = require("./orders");
const rules = require("./rules");

const client = () => require(path.join(__dirname, "..", "..", "a2x", "lib", "shopify"));

const configure = () => !!(process.env.SHOPIFY_STORE &&
  (process.env.SHOPIFY_ADMIN_TOKEN || (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET)));

// ------------------------------------------------------------------ conversion

const CHAMPS_COMMANDE = `
  id name createdAt processedAt cancelledAt closedAt
  displayFinancialStatus displayFulfillmentStatus
  email note tags
  currentTotalPriceSet { shopMoney { amount } }
  currentTotalTaxSet { shopMoney { amount } }
  totalShippingPriceSet { shopMoney { amount } }
  customer { id email firstName lastName }
  shippingAddress { firstName lastName name company address1 address2 city provinceCode zip countryCodeV2 phone }
  billingAddress  { firstName lastName name company address1 address2 city provinceCode zip countryCodeV2 phone }
  shippingLine { title }
  customAttributes { key value }
  lineItems(first: 100) {
    edges { node {
      id sku name quantity
      originalUnitPriceSet { shopMoney { amount } }
      variant { id inventoryItem { measurement { weight { value unit } } } }
    } }
  }`;

const GRAMMES = { GRAMS: 1, KILOGRAMS: 1000, OUNCES: 28.3495, POUNDS: 453.592 };

const montant = (o) => Number(o?.shopMoney?.amount || 0);

/** Adresse Shopify → forme interne. */
function adresse(a) {
  if (!a) return {};
  return {
    name: a.name || [a.firstName, a.lastName].filter(Boolean).join(" "),
    company: a.company || null,
    street1: a.address1 || "", street2: a.address2 || null,
    city: a.city || "", state: a.provinceCode || "",
    postalCode: a.zip || "", country: a.countryCodeV2 || "CA",
    phone: a.phone || null,
  };
}

/**
 * Commande Shopify → commande du clone.
 *
 * `order_key` reprend l'identifiant numérique Shopify, comme le faisait ShipStation : c'est
 * ce qui permet à la migration et à l'ingestion directe de converger sur la même commande
 * plutôt que de la dupliquer.
 */
function convertir(o, { storeId = null } = {}) {
  const num = String(o.id).split("/").pop();
  const attributs = Object.fromEntries((o.customAttributes || []).map((a) => [a.key, a.value]));
  const items = (o.lineItems?.edges || []).map((e) => {
    const n = e.node;
    const w = n.variant?.inventoryItem?.measurement?.weight;
    return {
      line_key: String(n.id).split("/").pop(),
      sku: n.sku || null,
      name: n.name || null,
      quantity: n.quantity || 0,
      unit_price: montant(n.originalUnitPriceSet),
      weight_g: w ? (Number(w.value) || 0) * (GRAMMES[w.unit] || 1) : 0,
      adjustment: false,
    };
  });

  return {
    order_number: o.name,                              // « L-50123 »
    order_key: num,
    store_id: storeId,
    status: statut(o),
    order_date: o.createdAt, paid_at: o.processedAt,
    customer_email: o.email || o.customer?.email || null,
    customer_name: adresse(o.shippingAddress).name || null,
    ship_to: adresse(o.shippingAddress),
    bill_to: adresse(o.billingAddress),
    order_total: montant(o.currentTotalPriceSet),
    amount_paid: o.displayFinancialStatus === "PAID" ? montant(o.currentTotalPriceSet) : 0,
    tax_amount: montant(o.currentTotalTaxSet),
    shipping_paid: montant(o.totalShippingPriceSet),
    customer_notes: o.note || null,
    requested_service: o.shippingLine?.title || null,
    gift: /gift|cadeau/i.test(o.tags?.join(" ") || ""),
    custom_field2: (adresse(o.shippingAddress).country === "US") ? "USA" : null,
    custom_field3: "LASCLAY",
    source: "shopify",
    items,
    raw: { shopify_gid: o.id, tags: o.tags, attributs },
  };
}

/** Statut Shopify → statut interne. L'ordre des tests compte. */
function statut(o) {
  if (o.cancelledAt) return "cancelled";
  const f = o.displayFulfillmentStatus;
  if (f === "FULFILLED") return "shipped";
  if (o.displayFinancialStatus === "PENDING" || o.displayFinancialStatus === "AUTHORIZED")
    return "awaiting_payment";
  return "awaiting_shipment";
}

// ------------------------------------------------------------------ import

/** La boutique Shopify du référentiel, pour rattacher les commandes importées. */
function storeShopify() {
  const s = one("SELECT id FROM stores WHERE lower(marketplace) = 'shopify' ORDER BY id LIMIT 1");
  if (s) return s.id;
  run(`INSERT INTO stores (id, name, marketplace, active, auto_refresh) VALUES (?,?,?,1,1)`,
    900001, "Shopify (direct)", "Shopify");
  return 900001;
}

/**
 * Importe une commande par son identifiant Shopify (numérique ou GID).
 * Idempotent : réimporter met à jour, ne duplique pas.
 */
async function importerUne(idOuGid, { appliquerRegles = true } = {}) {
  if (!configure()) throw new Error("Shopify non configuré (SHOPIFY_STORE + identifiants)");
  const gid = String(idOuGid).startsWith("gid://") ? idOuGid : `gid://shopify/Order/${idOuGid}`;
  const d = await client().gql(`query($id: ID!) { order(id: $id) { ${CHAMPS_COMMANDE} } }`, { id: gid });
  if (!d.order) throw new Error(`commande Shopify introuvable : ${idOuGid}`);
  const cmd = convertir(d.order, { storeId: storeShopify() });
  const existait = !!one("SELECT id FROM orders WHERE order_key = ?", cmd.order_key);
  const id = orders.upsert(cmd);
  // Les règles ne s'appliquent qu'à l'arrivée : les rejouer sur une commande déjà traitée
  // écraserait un choix fait à la main dans la grille.
  if (appliquerRegles && !existait) rules.appliquer(id);
  return { id, order_number: cmd.order_number, nouvelle: !existait };
}

/**
 * Rattrapage par l'API — historique et filet sous les webhooks.
 * `depuis` au format ISO ; par défaut, la date du dernier import réussi.
 */
async function rattraper({ depuis = null, max = 2000, journal = () => {} } = {}) {
  if (!configure()) throw new Error("Shopify non configuré");
  const { gql } = client();
  const debut = depuis || reglage("shopify_dernier_import", null) ||
    new Date(Date.now() - 30 * 86400000).toISOString();
  const filtre = `updated_at:>='${debut.slice(0, 19)}Z'`;

  let apres = null, n = 0, nouvelles = 0, plusRecent = debut;
  const storeId = storeShopify();

  for (;;) {
    const d = await gql(`
      query($q: String!, $after: String) {
        orders(first: 50, after: $after, query: $q, sortKey: UPDATED_AT) {
          pageInfo { hasNextPage endCursor }
          edges { node { updatedAt ${CHAMPS_COMMANDE} } }
        }
      }`, { q: filtre, after: apres });

    const lot = d.orders?.edges || [];
    for (const e of lot) {
      const cmd = convertir(e.node, { storeId });
      const existait = !!one("SELECT id FROM orders WHERE order_key = ?", cmd.order_key);
      const id = orders.upsert(cmd);
      if (!existait) { rules.appliquer(id); nouvelles++; }
      if (e.node.updatedAt > plusRecent) plusRecent = e.node.updatedAt;
      n++;
    }
    journal(`  ${n} commandes traitées (${nouvelles} nouvelles)`);
    if (!d.orders?.pageInfo?.hasNextPage || n >= max) break;
    apres = d.orders.pageInfo.endCursor;
  }

  poserReglage("shopify_dernier_import", plusRecent);
  journaliser("shopify.rattrapage", "order", null, { traitees: n, nouvelles, depuis: debut });
  return { traitees: n, nouvelles, depuis: debut, jusqua: plusRecent };
}

// ------------------------------------------------------------------ webhooks

/**
 * Vérifie la signature HMAC d'un webhook Shopify sur le corps BRUT.
 * Comparaison à temps constant ; un corps reparsé puis re-sérialisé ne donnerait pas la même
 * signature, d'où l'obligation de garder l'original.
 */
function signatureValide(corpsBrut, entete) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_CLIENT_SECRET || "";
  if (!secret || !entete) return false;
  const attendu = crypto.createHmac("sha256", secret).update(corpsBrut, "utf8").digest("base64");
  const a = Buffer.from(attendu), b = Buffer.from(String(entete));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Traite un webhook. La charge utile de Shopify est en REST même pour les webhooks : on n'en
 * retient que l'identifiant, et on relit la commande en GraphQL. C'est plus sûr — le webhook
 * peut arriver en retard, dans le désordre, ou tronqué.
 */
async function traiterWebhook(sujet, charge) {
  const id = charge?.id;
  if (!id) throw new Error("webhook sans identifiant de commande");
  switch (sujet) {
    case "orders/create":
    case "orders/updated":
    case "orders/edited":
      return { sujet, ...(await importerUne(id)) };
    case "orders/cancelled": {
      const cmd = one("SELECT id FROM orders WHERE order_key = ?", String(id));
      if (cmd) orders.changerStatut(cmd.id, "cancelled");
      return { sujet, annulee: !!cmd };
    }
    default:
      return { sujet, ignore: true };
  }
}

const SUJETS = ["orders/create", "orders/updated", "orders/cancelled"];

/** Abonne la boutique aux webhooks, en pointant sur l'URL publique du service. */
async function abonnerWebhooks(baseUrl) {
  const { gql } = client();
  const cible = `${String(baseUrl).replace(/\/+$/, "")}/webhooks/shopify`;
  const resultats = [];
  for (const sujet of SUJETS) {
    const topic = sujet.toUpperCase().replace("/", "_");
    try {
      const r = await gql(`
        mutation($topic: WebhookSubscriptionTopic!, $url: URL!) {
          webhookSubscriptionCreate(topic: $topic,
            webhookSubscription: { callbackUrl: $url, format: JSON }) {
            webhookSubscription { id }
            userErrors { field message }
          }
        }`, { topic, url: cible });
      const err = r.webhookSubscriptionCreate?.userErrors || [];
      resultats.push({ sujet, id: r.webhookSubscriptionCreate?.webhookSubscription?.id || null,
        erreur: err.length ? err.map((e) => e.message).join(" ; ") : null });
    } catch (e) {
      resultats.push({ sujet, erreur: String(e.message).slice(0, 200) });
    }
  }
  journaliser("shopify.webhooks", "system", null, { cible, resultats });
  return { cible, resultats };
}

/** Abonnements en place côté Shopify — pour l'écran de réglages. */
async function webhooksExistants() {
  const { gql } = client();
  const d = await gql(`{ webhookSubscriptions(first: 30) {
    edges { node { id topic endpoint { ... on WebhookHttpEndpoint { callbackUrl } } } } } }`);
  return (d.webhookSubscriptions?.edges || []).map((e) => ({
    id: e.node.id, topic: e.node.topic, url: e.node.endpoint?.callbackUrl || null,
  }));
}

const etat = () => ({
  configure: configure(),
  boutique: process.env.SHOPIFY_STORE || null,
  dernier_import: reglage("shopify_dernier_import", null),
  secret_webhook: !!(process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_CLIENT_SECRET),
});

module.exports = {
  configure, convertir, statut, importerUne, rattraper, traiterWebhook,
  signatureValide, abonnerWebhooks, webhooksExistants, etat, SUJETS, storeShopify,
};
