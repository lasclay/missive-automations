/**
 * Import direct des commandes Shopify — disponible sans passer par ShipStation.
 *
 * C'est la moitié manquante de `channels.js` : celui-ci renvoie le suivi *vers* Shopify,
 * celui-là ramène les commandes *depuis* Shopify. Ensemble ils ferment la boucle et le clone
 * n'a plus besoin de ShipStation du tout.
 *
 * Trois choix qui comptent :
 *
 * 1. **`order_key` = identifiant numérique Shopify**, exactement comme le `orderKey` que
 *    ShipStation stocke pour ses commandes Shopify. Les 38 000 commandes migrées et les
 *    commandes importées directement convergent donc sur la même clé : réimporter une
 *    commande déjà migrée la met à jour, elle ne la duplique pas.
 * 2. **Synchronisation vivante** (exigence B1 du §18, le défaut architectural n°1 de
 *    ShipStation) : la fenêtre de rattrapage se cale sur `updatedAt`, pas sur `createdAt`.
 *    Une adresse corrigée ou une commande annulée après l'import redescend.
 * 3. **Ne jamais écraser le travail de l'entrepôt.** Une commande déjà expédiée côté clone
 *    n'est pas retouchée, et les champs pilotés par les règles (service, colis, entrepôt,
 *    champs personnalisés) ne sont réécrits que lorsqu'on demande explicitement un
 *    retraitement.
 *
 * Réutilise le client partagé `a2x/lib/shopify.js` — l'app « Render connector » en
 * *client credentials*, donc aucun jeton permanent dans les variables du service.
 */
const { all, one, run, tx, parse, dump, maintenant, reglage, poserReglage, journaliser } = require("./db");
const orders = require("./orders");
const automation = require("./automation");
const catalog = require("./catalog");

/** Identifiant de la boutique LAS Shopify chez ShipStation — repris tel quel (§13.1). */
const STORE_ID = Number(process.env.CLONE_SHOPIFY_STORE_ID || 198670);

const client = () => require(require("path").join(__dirname, "..", "..", "a2x", "lib", "shopify"));

const configure = () => !!(process.env.SHOPIFY_STORE &&
  (process.env.SHOPIFY_ADMIN_TOKEN || (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET)));

// ------------------------------------------------------------------ requête

const CHAMPS = `
  id
  name
  createdAt
  processedAt
  updatedAt
  cancelledAt
  closedAt
  test
  email
  phone
  note
  tags
  totalWeight
  displayFinancialStatus
  displayFulfillmentStatus
  customAttributes { key value }
  customer { id firstName lastName email numberOfOrders }
  shippingAddress {
    name firstName lastName company address1 address2 city provinceCode countryCodeV2 zip phone
  }
  billingAddress {
    name company address1 address2 city provinceCode countryCodeV2 zip phone
  }
  totalPriceSet { shopMoney { amount currencyCode } }
  netPaymentSet { shopMoney { amount } }
  totalTaxSet { shopMoney { amount } }
  totalShippingPriceSet { shopMoney { amount } }
  shippingLines(first: 5) { edges { node { title code source } } }
  lineItems(first: 250) { edges { node {
    id sku name title quantity requiresShipping
    originalUnitPriceSet { shopMoney { amount } }
    discountedTotalSet { shopMoney { amount } }
    image { url }
    product { id }
    variant { id sku barcode inventoryItem { measurement { weight { value unit } } } }
  } } }
`;

const REQUETE = `
  query($q: String!, $n: Int!, $apres: String) {
    orders(first: $n, after: $apres, query: $q, sortKey: UPDATED_AT, reverse: false) {
      pageInfo { hasNextPage endCursor }
      edges { node { ${CHAMPS} } }
    }
  }`;

// ------------------------------------------------------------------ conversion

const EN_GRAMMES = { GRAMS: 1, KILOGRAMS: 1000, OUNCES: 28.349523125, POUNDS: 453.59237 };

const nombre = (x) => (x === null || x === undefined || x === "" ? 0 : Number(x) || 0);
const numerique = (gid) => String(gid || "").split("/").pop();

/** Adresse Shopify → adresse du clone (même forme que celle de ShipStation). */
function adresse(a) {
  if (!a) return null;
  return {
    name: a.name || [a.firstName, a.lastName].filter(Boolean).join(" ") || null,
    company: a.company || null,
    street1: a.address1 || null,
    street2: a.address2 || null,
    city: a.city || null,
    state: a.provinceCode || null,
    postalCode: a.zip || null,
    country: a.countryCodeV2 || null,
    phone: a.phone || null,
    residential: !a.company,
  };
}

/**
 * Statut du clone à partir des statuts Shopify.
 *
 * `pending_fulfillment` sert aux commandes payées mais retenues côté Shopify (précommande,
 * révision antifraude) : ShipStation les mélangeait à « awaiting shipment », ce qui pollue
 * la file de l'entrepôt.
 */
function statut(o) {
  if (o.cancelledAt) return "cancelled";
  const f = o.displayFulfillmentStatus;
  if (f === "FULFILLED") return "shipped";
  if (o.displayFinancialStatus === "PENDING" || o.displayFinancialStatus === "AUTHORIZED") return "awaiting_payment";
  if (f === "ON_HOLD" || f === "SCHEDULED") return "pending_fulfillment";
  return "awaiting_shipment";
}

/** Commande Shopify → commande normalisée pour `orders.upsert`. */
function convertir(o) {
  const lignes = (o.lineItems?.edges || []).map((e) => e.node).filter((l) => l.requiresShipping !== false);
  const service = (o.shippingLines?.edges || [])[0]?.node || {};
  const attributs = Object.fromEntries((o.customAttributes || []).map((a) => [a.key, a.value]));

  let poids = nombre(o.totalWeight);
  const items = lignes.map((l) => {
    const m = l.variant?.inventoryItem?.measurement?.weight;
    const g = m ? nombre(m.value) * (EN_GRAMMES[m.unit] || 1) : 0;
    return {
      line_key: numerique(l.id),
      sku: l.sku || l.variant?.sku || "",
      name: l.name || l.title || "",
      image_url: l.image?.url || null,
      quantity: l.quantity || 1,
      unit_price: nombre(l.originalUnitPriceSet?.shopMoney?.amount),
      weight_g: g,
      upc: l.variant?.barcode || null,
      product_id: null,
      options: [],
    };
  });
  if (!poids) poids = items.reduce((s, i) => s + (i.weight_g || 0) * (i.quantity || 1), 0);

  const exp = adresse(o.shippingAddress);
  return {
    order_number: o.name,                       // « #1234 » — le numéro que voit le client
    order_key: numerique(o.id),                 // identifiant numérique : converge avec la migration
    store_id: STORE_ID,
    status: statut(o),
    order_date: o.processedAt || o.createdAt,
    paid_at: o.displayFinancialStatus === "PAID" ? (o.processedAt || o.createdAt) : null,
    ship_to: exp || {},
    bill_to: adresse(o.billingAddress),
    customer_email: o.email || o.customer?.email || null,
    customer_name: exp?.name || [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(" ") || null,
    order_total: nombre(o.totalPriceSet?.shopMoney?.amount),
    amount_paid: nombre(o.netPaymentSet?.shopMoney?.amount || o.totalPriceSet?.shopMoney?.amount),
    tax_amount: nombre(o.totalTaxSet?.shopMoney?.amount),
    shipping_paid: nombre(o.totalShippingPriceSet?.shopMoney?.amount),
    customer_notes: o.note || null,
    gift: !!attributs.gift || !!attributs.Cadeau,
    gift_message: attributs.gift_message || attributs["Message cadeau"] || null,
    // Le libellé du checkout : c'est sur lui que portent les règles 4, 9, 10 et les vues
    // 6, 7, 9, 14, 16 (« Entrepôt Lasclay », « Défricheuses », « DDD », « timbre »…).
    requested_service: service.title || service.code || null,
    weight_g: poids,
    source: "shopify",
    items,
    raw: { id: o.id, tags: o.tags, financial: o.displayFinancialStatus, fulfillment: o.displayFulfillmentStatus },
  };
}

// ------------------------------------------------------------------ import

/**
 * Ramène les commandes Shopify modifiées depuis `depuis` (ISO 8601).
 *
 * `filtre` permet de restreindre : `{ nonExpediees: true }` ne prend que ce qui reste à
 * expédier — c'est le mode courant de la file de l'entrepôt.
 */
async function tirer({ depuis = null, filtre = {}, max = 2000, journal = () => {} } = {}) {
  if (!configure()) throw new Error(
    "Shopify n'est pas configuré : il faut SHOPIFY_STORE et SHOPIFY_CLIENT_ID/SHOPIFY_CLIENT_SECRET " +
    "(l'app « Render connector », les mêmes que support.js et A2X).");

  const { gql } = client();
  const morceaux = [];
  if (depuis) morceaux.push(`updated_at:>='${depuis}'`);
  if (filtre.nonExpediees) morceaux.push("fulfillment_status:unshipped");
  if (filtre.depuisCreation) morceaux.push(`created_at:>='${filtre.depuisCreation}'`);
  if (filtre.numero) morceaux.push(`name:${filtre.numero}`);
  if (!filtre.avecTests) morceaux.push("test:false");
  const q = morceaux.join(" AND ");

  const lot = [];
  let apres = null, pages = 0;
  for (;;) {
    const d = await gql(REQUETE, { q, n: 50, apres });
    const edges = d.orders?.edges || [];
    for (const e of edges) lot.push(e.node);
    pages++;
    journal(`  page ${pages} — ${lot.length} commande(s)`);
    if (!d.orders?.pageInfo?.hasNextPage || lot.length >= max) break;
    apres = d.orders.pageInfo.endCursor;
  }
  return lot;
}

/**
 * Import complet : tirage, conversion, écriture, application des règles.
 *
 * Ne touche pas aux commandes déjà expédiées côté clone — l'entrepôt a raison contre la
 * boutique une fois l'étiquette achetée.
 */
async function importer({ depuis = null, filtre = {}, max = 2000, appliquerRegles = true, journal = () => {} } = {}) {
  const debut = maintenant();
  journal(`Shopify — tirage des commandes${depuis ? ` modifiées depuis ${depuis}` : ""}…`);
  const brutes = await tirer({ depuis, filtre, max, journal });
  journal(`${brutes.length} commande(s) reçue(s). Écriture…`);

  const bilan = { recues: brutes.length, creees: 0, majs: 0, ignorees: 0, annulees: 0, erreurs: [] };
  const nouvelles = [];

  tx(() => {
    for (const brute of brutes) {
      try {
        const cmd = convertir(brute);
        const existante = one("SELECT id, status FROM orders WHERE order_key = ?", cmd.order_key);

        // Déjà expédiée ici : on ne réécrit ni le service ni l'adresse, on note seulement
        // une annulation tardive, qui est la seule information encore utile.
        if (existante && ["shipped", "cancelled"].includes(existante.status)) {
          if (cmd.status === "cancelled" && existante.status !== "cancelled") {
            run("UPDATE orders SET internal_notes = TRIM(COALESCE(internal_notes,'') || char(10) || ?) WHERE id = ?",
              `Annulée chez Shopify le ${brute.cancelledAt}`, existante.id);
            bilan.annulees++;
          }
          bilan.ignorees++;
          continue;
        }

        // Défauts produit pour ce que Shopify ne porte pas (poids d'article manquant).
        for (const it of cmd.items) {
          if (!it.weight_g && it.sku) {
            const d = catalog.defautsPour(it.sku);
            if (d.weight_g) it.weight_g = d.weight_g;
          }
        }
        if (!cmd.weight_g) cmd.weight_g = cmd.items.reduce((s, i) => s + (i.weight_g || 0) * (i.quantity || 1), 0);

        const id = orders.upsert(cmd);
        if (existante) bilan.majs++; else { bilan.creees++; nouvelles.push(id); }
      } catch (e) {
        bilan.erreurs.push({ commande: brute.name, erreur: String(e.message) });
      }
    }
  });

  // Les règles ne tournent que sur les commandes nouvelles : rejouer sur les anciennes
  // écraserait les décisions prises à la main dans l'entrepôt (le « Reprocess Automation
  // Rules » de ShipStation, avec son avertissement, reste disponible à part).
  if (appliquerRegles && nouvelles.length) {
    journal(`Application des règles sur ${nouvelles.length} nouvelle(s) commande(s)…`);
    // Pipeline complet des 6 couches (§3.1) : routage, profils, défauts produit, mapping de
    // service, puis règles. L'ordre compte — « Do Not Safe Drop Auto » réagit au service que
    // le mapping vient d'attribuer.
    bilan.regles = Object.keys(automation.traiterLot(nouvelles)).length;
  }

  poserReglage("shopify_dernier_import", debut);
  journaliser("import.shopify", "system", null, bilan);
  journal(`Terminé — ${bilan.creees} créée(s), ${bilan.majs} mise(s) à jour, ${bilan.ignorees} ignorée(s).`);
  return bilan;
}

/**
 * Rattrapage périodique. Reprend 30 minutes avant le dernier import : Shopify horodate
 * `updatedAt` côté serveur et une commande peut arriver légèrement en retard.
 */
async function rattraper({ journal = () => {} } = {}) {
  const dernier = reglage("shopify_dernier_import");
  const depuis = dernier
    ? new Date(new Date(dernier).getTime() - 30 * 60000).toISOString()
    : new Date(Date.now() - 7 * 86400000).toISOString();
  return importer({ depuis, journal });
}

/** Minuterie de synchronisation — désactivée si CLONE_SHOPIFY_SYNC_MIN vaut 0. */
function demarrerSync() {
  const minutes = Number(process.env.CLONE_SHOPIFY_SYNC_MIN ?? 20);
  if (!minutes || !configure()) return null;
  const tic = () => rattraper({ journal: (m) => console.error("[shopify]", m) })
    .catch((e) => console.error("[shopify] échec de la synchronisation :", e.message));
  const t = setInterval(tic, minutes * 60000);
  t.unref?.();
  setTimeout(tic, 15000).unref?.();   // un premier passage peu après le démarrage
  return t;
}

const etat = () => ({
  configure: configure(),
  boutique: process.env.SHOPIFY_STORE || null,
  store_id: STORE_ID,
  dernier_import: reglage("shopify_dernier_import"),
  sync_minutes: Number(process.env.CLONE_SHOPIFY_SYNC_MIN ?? 20),
  commandes: one("SELECT COUNT(*) n FROM orders WHERE source = 'shopify'").n,
});

module.exports = { importer, tirer, rattraper, convertir, demarrerSync, etat, configure, STORE_ID };
