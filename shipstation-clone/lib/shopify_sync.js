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
const { one, all, run, tx, parse, dump, maintenant, journaliser, reglage, poserReglage } = require("./db");
const orders = require("./orders");
const automation = require("./automation");

const client = () => require(path.join(__dirname, "..", "..", "a2x", "lib", "shopify"));

const configure = () => !!(process.env.SHOPIFY_STORE &&
  (process.env.SHOPIFY_ADMIN_TOKEN || (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET)));

// ------------------------------------------------------------------ conversion

/**
 * Champs lus sur chaque commande.
 *
 * Les préfixes `current…` ne sont pas décoratifs : ce sont les montants **après** remises,
 * modifications de commande et remboursements. Lire `originalUnitPriceSet` et `quantity`
 * pendant qu'on lit `currentTotalPriceSet` produit exactement la contradiction relevée à
 * l'audit — des lignes au prix catalogue sous un total à zéro (BUG-016). Les deux versions
 * sont donc rapatriées : la courante pour ce qui est dû, l'originale pour la trace.
 */
const CHAMPS_COMMANDE = `
  id name createdAt processedAt cancelledAt closedAt
  displayFinancialStatus displayFulfillmentStatus
  sourceName channelInformation { channelDefinition { handle channelName } }
  email note tags
  currentTotalPriceSet { shopMoney { amount } }
  currentTotalTaxSet { shopMoney { amount } }
  currentSubtotalPriceSet { shopMoney { amount } }
  currentTotalDiscountsSet { shopMoney { amount } }
  totalDiscountsSet { shopMoney { amount } }
  currentShippingPriceSet { shopMoney { amount } }
  totalShippingPriceSet { shopMoney { amount } }
  totalRefundedSet { shopMoney { amount } }
  totalReceivedSet { shopMoney { amount } }
  customer { id email firstName lastName }
  shippingAddress { firstName lastName name company address1 address2 city provinceCode zip countryCodeV2 phone }
  billingAddress  { firstName lastName name company address1 address2 city provinceCode zip countryCodeV2 phone }
  shippingLine { title }
  customAttributes { key value }
  lineItems(first: 100) {
    edges { node {
      id sku name quantity currentQuantity
      originalUnitPriceSet { shopMoney { amount } }
      discountedUnitPriceSet { shopMoney { amount } }
      totalDiscountSet { shopMoney { amount } }
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
    // `currentQuantity` tombe à 0 quand la ligne est remboursée ou retirée d'une commande
    // modifiée. C'est ce que ShipStation affiche, et c'est ce qu'il reste à préparer.
    const commandee = n.quantity ?? 0;
    const courante = n.currentQuantity ?? commandee;
    // La ligne garde le prix catalogue — c'est ce qui figure sur le bordereau et ce que le
    // préparateur reconnaît. La remise est portée à part, au prorata de ce qu'il reste :
    // une ligne remboursée n'emporte plus sa remise, sinon le résumé ne se referme pas.
    const remise = montant(n.totalDiscountSet) * (commandee ? courante / commandee : 0);
    return {
      line_key: String(n.id).split("/").pop(),
      sku: n.sku || null,
      name: n.name || null,
      quantity: courante,
      quantity_ordered: commandee,
      unit_price: montant(n.originalUnitPriceSet),
      discount: Math.round(remise * 100) / 100,
      weight_g: w ? (Number(w.value) || 0) * (GRAMMES[w.unit] || 1) : 0,
      adjustment: false,
    };
  });

  // Le montant réellement encaissé : ce qui est entré moins ce qui est ressorti. Le seul
  // chiffre qui compte quand un client rappelle pour un remboursement partiel.
  const rembourse = montant(o.totalRefundedSet);
  const recu = montant(o.totalReceivedSet);
  const paye = o.totalReceivedSet ? Math.round((recu - rembourse) * 100) / 100
    : (o.displayFinancialStatus === "PAID" ? montant(o.currentTotalPriceSet) : 0);
  // La remise retenue est celle des lignes, prorata compris : c'est la seule qui referme
  // le résumé avec les prix qu'on vient d'y écrire. La remise de commande ne sert que
  // lorsqu'aucune ligne n'en porte — une remise de livraison, par exemple.
  const remiseLignes = Math.round(items.reduce((s, i) => s + i.discount, 0) * 100) / 100;
  const remise = remiseLignes || montant(o.currentTotalDiscountsSet ?? o.totalDiscountsSet);

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
    amount_paid: paye,
    tax_amount: montant(o.currentTotalTaxSet),
    shipping_paid: montant(o.currentShippingPriceSet ?? o.totalShippingPriceSet),
    discount_amount: remise,
    refunded_amount: rembourse,
    customer_notes: o.note || null,
    requested_service: o.shippingLine?.title || null,
    gift: /gift|cadeau/i.test(o.tags?.join(" ") || ""),
    custom_field2: (adresse(o.shippingAddress).country === "US") ? "USA" : null,
    custom_field3: "LASCLAY",
    source: "shopify",
    items,
    raw: { shopify_gid: o.id, tags: o.tags, attributs,
      marche: marcheDe(o), source_name: o.sourceName || null,
      canal: o.channelInformation?.channelDefinition?.channelName || null },
  };
}

/**
 * Statut Shopify → statut interne. L'ordre des tests compte.
 *
 * `ON_HOLD` et `SCHEDULED` étaient absents : les compteurs « En attente » du panneau
 * gauche restaient vides alors que ShipStation en comptait deux (BUG-013).
 */
function statut(o) {
  if (o.cancelledAt) return "cancelled";
  const f = o.displayFulfillmentStatus;
  if (f === "FULFILLED") return "shipped";
  if (f === "ON_HOLD" || f === "SCHEDULED" || f === "REQUEST_DECLINED") return "on_hold";
  if (o.displayFinancialStatus === "PENDING" || o.displayFinancialStatus === "AUTHORIZED")
    return "awaiting_payment";
  if (f === "PARTIALLY_FULFILLED" || f === "IN_PROGRESS") return "pending_fulfillment";
  return "awaiting_shipment";
}

// ------------------------------------------------------------------ import

/**
 * La boutique Shopify du référentiel, pour rattacher les commandes importées.
 *
 * Ne prend que des boutiques **actives** : l'ancienne version triait par identifiant sur
 * toutes les boutiques `shopify`, ce qui pouvait rattacher l'arriéré à « Fake Poparide
 * Store ». Et elle n'invente une boutique que si le référentiel n'a jamais été chargé —
 * la boutique fantôme « Shopify (direct) » observée à l'audit venait de là.
 */
function storeShopify() {
  const s = one(`SELECT id FROM stores WHERE lower(marketplace) = 'shopify' AND active = 1
                 ORDER BY id LIMIT 1`)
    || one("SELECT id FROM stores WHERE lower(marketplace) = 'shopify' ORDER BY id LIMIT 1");
  if (s) return s.id;
  run(`INSERT INTO stores (id, name, marketplace, active, auto_refresh) VALUES (?,?,?,1,1)`,
    900001, "Shopify (direct)", "Shopify");
  return 900001;
}

/**
 * Boutique d'origine d'une commande (BUG-013).
 *
 * Chez ShipStation, `LAS Shopify`, `LAS Etsy`, `Manual Orders` et `FAIRE Lasclay` sont
 * quatre boutiques distinctes, et les sous-entrées du panneau gauche comptent les commandes
 * de chacune. Le clone les recevant toutes par Shopify, la provenance se lit sur la
 * commande elle-même — `sourceName` ou le canal de vente — au lieu d'être écrasée par la
 * boutique Shopify principale. Sans cela, la règle « LAS Incoming Orders Warehouse
 * Selection », qui filtre sur trois identifiants de boutique, n'en verrait jamais qu'un.
 */
const MARCHES = [
  [/etsy/i, "etsy"],
  [/faire/i, "faire"],
  [/(^|\W)(pos|draft|manual)(\W|$)|shopify_draft_order|iphone|android/i, "manual"],
];

function marcheDe(o) {
  const indices = [o.sourceName, o.channelInformation?.channelDefinition?.handle,
    o.channelInformation?.channelDefinition?.channelName].filter(Boolean).join(" ");
  for (const [motif, marche] of MARCHES) if (motif.test(indices)) return marche;
  return "shopify";
}

/** Cache des boutiques par marché — une requête par import, pas une par commande. */
function boutiquesParMarche() {
  const m = {};
  for (const s of all(`SELECT id, marketplace FROM stores WHERE active = 1 ORDER BY id`)) {
    const k = String(s.marketplace || "").toLowerCase();
    if (!(k in m)) m[k] = s.id;
  }
  return m;
}

const boutiqueDe = (o, table, defaut) => table[marcheDe(o)] ?? defaut;

/**
 * Importe une commande par son identifiant Shopify (numérique ou GID).
 * Idempotent : réimporter met à jour, ne duplique pas.
 */
async function importerUne(idOuGid, { appliquerRegles = true } = {}) {
  if (!configure()) throw new Error("Shopify non configuré (SHOPIFY_STORE + identifiants)");
  const gid = String(idOuGid).startsWith("gid://") ? idOuGid : `gid://shopify/Order/${idOuGid}`;
  const d = await client().gql(`query($id: ID!) { order(id: $id) { ${CHAMPS_COMMANDE} } }`, { id: gid });
  if (!d.order) throw new Error(`commande Shopify introuvable : ${idOuGid}`);
  const cmd = convertir(d.order, { storeId: boutiqueDe(d.order, boutiquesParMarche(), storeShopify()) });
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

  let apres = null, n = 0, nouvelles = 0, ignorees = 0, annulees = 0, plusRecent = debut;
  const defaut = storeShopify();
  const marches = boutiquesParMarche();

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
      const cmd = convertir(e.node, { storeId: boutiqueDe(e.node, marches, defaut) });
      const avant = one("SELECT id, status FROM orders WHERE order_key = ?", cmd.order_key);
      // Une commande déjà expédiée ici n'est plus retouchée : passé l'achat de l'étiquette,
      // l'entrepôt a raison contre la boutique. Seule une annulation tardive est notée.
      if (avant && ["shipped", "cancelled"].includes(avant.status)) {
        if (cmd.status === "cancelled" && avant.status !== "cancelled") {
          run(`UPDATE orders SET internal_notes = TRIM(COALESCE(internal_notes,'') || char(10) || ?) WHERE id = ?`,
            "Annulée chez Shopify après expédition", avant.id);
          annulees++;
        }
        ignorees++; n++;
        if (e.node.updatedAt > plusRecent) plusRecent = e.node.updatedAt;
        continue;
      }
      const id = orders.upsert(cmd);
      // Pipeline complet des 6 couches (§3.1) : routage, profils produit, défauts, mapping de
      // service, puis règles. L'ordre compte — « Do Not Safe Drop Auto » réagit au service que
      // le mapping vient d'attribuer. Seules les nouvelles commandes y passent : rejouer sur
      // une commande en cours écraserait les décisions prises à la main.
      if (!avant) { automation.traiter(id); nouvelles++; }
      if (e.node.updatedAt > plusRecent) plusRecent = e.node.updatedAt;
      n++;
    }
    journal(`  ${n} commandes traitées (${nouvelles} nouvelles)`);
    if (!d.orders?.pageInfo?.hasNextPage || n >= max) break;
    apres = d.orders.pageInfo.endCursor;
  }

  poserReglage("shopify_dernier_import", plusRecent);
  journaliser("shopify.rattrapage", "order", null, { traitees: n, nouvelles, ignorees, annulees, depuis: debut });
  return { traitees: n, nouvelles, ignorees, annulees, depuis: debut, jusqua: plusRecent };
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

/**
 * Réparation de l'attribution des boutiques sur l'arriéré déjà importé (BUG-013).
 *
 * Ne relit pas Shopify : la provenance est déjà dans `raw.marche` pour tout ce qui a été
 * importé depuis, et se déduit du reste par le préfixe du numéro de commande. Ce qu'on ne
 * sait pas rattacher reste où il est plutôt que d'être rangé au hasard.
 *
 * **À blanc par défaut.** Rien n'est écrit sans `appliquer: true` : c'est une réécriture de
 * masse sur des commandes réelles, elle se regarde avant de se lancer.
 */
function reparerBoutiques({ appliquer = false } = {}) {
  const marches = boutiquesParMarche();
  const defaut = storeShopify();
  const fantomes = all(`SELECT id, name FROM stores WHERE id >= 900000`);

  const cible = (r) => {
    const m = parse(r.raw, {}).marche;
    if (m && marches[m]) return marches[m];
    // Repli sur le numéro : les commandes Etsy et Faire portent un préfixe distinct.
    const n = String(r.order_number || "");
    if (/etsy/i.test(n)) return marches.etsy ?? null;
    if (/faire/i.test(n)) return marches.faire ?? null;
    return null;
  };

  const lignes = all(`SELECT id, order_number, store_id, raw FROM orders`);
  const mouvements = [];
  for (const r of lignes) {
    const vers = cible(r) ?? (fantomes.some((f) => f.id === r.store_id) || r.store_id == null ? defaut : null);
    if (vers && vers !== r.store_id) mouvements.push({ id: r.id, de: r.store_id, vers });
  }

  const repartition = (col) => Object.fromEntries(
    all(`SELECT s.name, COUNT(*) n FROM orders o LEFT JOIN stores s ON s.id = o.store_id
         WHERE o.status = 'awaiting_shipment' GROUP BY ${col} ORDER BY n DESC`)
      .map((r) => [r.name || "— sans boutique —", r.n]));

  const avant = repartition("o.store_id");
  if (!appliquer) return { a_blanc: true, mouvements: mouvements.length, avant, fantomes };

  tx(() => {
    for (const m of mouvements) run("UPDATE orders SET store_id = ? WHERE id = ?", m.vers, m.id);
    // La boutique fantôme ne disparaît qu'une fois vidée — sinon on casserait la référence.
    for (const f of fantomes)
      if (!one("SELECT 1 x FROM orders WHERE store_id = ?", f.id))
        run("DELETE FROM stores WHERE id = ?", f.id);
  });
  const apres = repartition("o.store_id");
  journaliser("shopify.boutiques", "store", null, { deplacees: mouvements.length, avant, apres });
  return { a_blanc: false, mouvements: mouvements.length, avant, apres, fantomes };
}

const etat = () => ({
  configure: configure(),
  boutique: process.env.SHOPIFY_STORE || null,
  store_id: storeShopify(),
  dernier_import: reglage("shopify_dernier_import", null),
  secret_webhook: !!(process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_CLIENT_SECRET),
  sync_minutes: Number(process.env.CLONE_SHOPIFY_SYNC_MIN ?? 20),
  commandes: one("SELECT COUNT(*) n FROM orders WHERE source = 'shopify'").n,
});

module.exports = {
  configure, convertir, statut, importerUne, rattraper, traiterWebhook, reparerBoutiques,
  marcheDe, boutiquesParMarche,
  signatureValide, abonnerWebhooks, webhooksExistants, etat, SUJETS, storeShopify,
};
