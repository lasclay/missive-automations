/**
 * Ingestion — remplir le clone.
 *
 * Deux chemins :
 *   1. `migrerDepuisShipStation()` — récupère tout le compte par le General Proxy. À lancer
 *      AVANT toute résiliation : l'accès API disparaît avec l'abonnement (AUDIT.md §8).
 *   2. `importerCommandes()` — le format normalisé qu'utiliseront les connecteurs Shopify,
 *      Etsy et Faire. Les règles d'automatisation s'appliquent à l'import, comme chez
 *      ShipStation.
 */
const { all, one, run, tx, dump, maintenant, journaliser, poserReglage } = require("./db");
const orders = require("./orders");
const rules = require("./rules");
const catalog = require("./catalog");

const PROXY = process.env.GENERAL_PROXY_URL || "https://general-proxy-5muf.onrender.com";
const SECRET = process.env.GENERAL_PROXY_SECRET || process.env.PROXY_SECRET || "";

async function ss(action, params) {
  const res = await fetch(`${PROXY}/shipstation/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET },
    body: JSON.stringify(params || {}),
  });
  const txt = await res.text();
  let j; try { j = JSON.parse(txt); } catch { j = null; }
  if (!res.ok || !j || j.error) throw new Error(`${action} → ${res.status} ${txt.slice(0, 200)}`);
  return j.data;
}

/** Poids en grammes quelle que soit l'unité — ShipStation en mélange trois. */
function grammes(w) {
  if (!w || !w.value) return 0;
  const u = String(w.units || "").toLowerCase();
  if (u.startsWith("ounce")) return w.value * 28.3495;
  if (u.startsWith("pound")) return w.value * 453.592;
  return w.value;
}

// ------------------------------------------------------- conversion ShipStation

function convertirCommande(o) {
  return {
    order_number: o.orderNumber,
    order_key: o.orderKey || `ss-${o.orderId}`,
    store_id: (o.advancedOptions || {}).storeId || null,
    status: o.orderStatus,
    order_date: o.orderDate, paid_at: o.paymentDate,
    ship_by_date: o.shipByDate, hold_until: o.holdUntilDate,
    customer_email: o.customerEmail,
    customer_name: (o.shipTo || {}).name || o.customerUsername,
    bill_to: o.billTo, ship_to: o.shipTo || {},
    order_total: o.orderTotal || 0, amount_paid: o.amountPaid || 0,
    tax_amount: o.taxAmount || 0, shipping_paid: o.shippingAmount || 0,
    customer_notes: o.customerNotes, internal_notes: o.internalNotes,
    gift: !!o.gift, gift_message: o.giftMessage,
    requested_service: o.requestedShippingService,
    carrier_code: o.carrierCode, service_id: o.serviceCode, package_id: o.packageCode,
    confirmation: o.confirmation === "none" ? null : o.confirmation,
    weight_g: grammes(o.weight),
    dimensions: o.dimensions,
    warehouse_id: (o.advancedOptions || {}).warehouseId || null,
    insurance: o.insuranceOptions && o.insuranceOptions.insureShipment ? o.insuranceOptions : null,
    customs: o.internationalOptions && o.internationalOptions.customsItems ? o.internationalOptions : null,
    custom_field1: (o.advancedOptions || {}).customField1,
    custom_field2: (o.advancedOptions || {}).customField2,
    custom_field3: (o.advancedOptions || {}).customField3,
    source: (o.advancedOptions || {}).source,
    externally_fulfilled: !!o.externallyFulfilled,
    items: (o.items || []).map((i) => ({
      line_key: i.lineItemKey, sku: i.sku, name: i.name, image_url: i.imageUrl,
      quantity: i.quantity, unit_price: i.unitPrice, weight_g: grammes(i.weight),
      tax: i.taxAmount, warehouse_location: i.warehouseLocation, upc: i.upc,
      adjustment: !!i.adjustment, options: i.options || [],
    })),
    raw: o,
  };
}

// ------------------------------------------------------------------ migration

/**
 * Migration complète. `journal` reçoit les messages de progression (console par défaut).
 * Respecte la limite de 40 requêtes/minute en pageant à 500.
 */
async function migrerDepuisShipStation({ journal = console.error, maxPagesCommandes = 100, depuis = null } = {}) {
  if (!SECRET) throw new Error("GENERAL_PROXY_SECRET requis pour la migration");
  const bilan = {};

  // -- référentiels
  journal("Référentiels…");
  const carriers = await ss("carriers");
  tx(() => {
    for (const c of carriers) {
      run(`INSERT INTO carriers (code,name,account,balance,requires_funding,active) VALUES (?,?,?,?,?,1)
           ON CONFLICT(code) DO UPDATE SET name=excluded.name, balance=excluded.balance`,
        c.code, c.nickname || c.name, c.accountNumber, c.balance || 0, c.requiresFundedAccount ? 1 : 0);
    }
  });
  bilan.transporteurs = carriers.length;

  const stores = await ss("stores");
  tx(() => {
    for (const s of stores) {
      run(`INSERT INTO stores (id,name,marketplace,active,auto_refresh,last_refresh) VALUES (?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, active=excluded.active`,
        s.storeId, s.storeName, s.marketplaceName, s.active ? 1 : 0, s.autoRefresh ? 1 : 0, s.refreshDate);
    }
  });
  bilan.boutiques = stores.length;

  const warehouses = await ss("warehouses");
  tx(() => {
    for (const w of warehouses) {
      run(`INSERT INTO warehouses (id,name,origin_address,return_address,is_default) VALUES (?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, origin_address=excluded.origin_address`,
        w.warehouseId, w.warehouseName, dump(w.originAddress), dump(w.returnAddress), w.isDefault ? 1 : 0);
    }
  });
  bilan.entrepots = warehouses.length;

  const tags = await ss("listtags");
  tx(() => {
    for (const t of tags) {
      run("INSERT INTO tags (id,name,color) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
        t.tagId, t.name, t.color);
    }
  });
  bilan.tags = tags.length;

  // -- commandes
  journal("Commandes…");
  let nCommandes = 0;
  for (const statut of ["awaiting_shipment", "on_hold", "awaiting_payment", "shipped", "cancelled"]) {
    for (let page = 1; page <= maxPagesCommandes; page++) {
      const params = { orderStatus: statut, pageSize: 500, page };
      if (depuis) params.createDateStart = depuis;
      const d = await ss("orders", params);
      const lot = d.orders || [];
      tx(() => { for (const o of lot) { orders.upsert(convertirCommande(o)); nCommandes++; } });
      journal(`  ${statut} p${page} : ${lot.length} (cumul ${nCommandes})`);
      if (lot.length < 500) break;
    }
  }
  bilan.commandes = nCommandes;

  // -- expéditions
  journal("Expéditions…");
  let nExp = 0;
  for (let page = 1; page <= maxPagesCommandes; page++) {
    const params = { pageSize: 500, page };
    if (depuis) params.shipDateStart = depuis;
    const d = await ss("shipments", params);
    const lot = d.shipments || [];
    tx(() => {
      for (const s of lot) {
        const cmd = one("SELECT id FROM orders WHERE order_key = ? OR order_number = ?",
          s.orderKey || `ss-${s.orderId}`, s.orderNumber);
        run(`INSERT INTO shipments (order_id,label_id,tracking_number,carrier_code,service_id,package_id,
               confirmation,cost,insurance_cost,ship_date,created_at,weight_g,dimensions,ship_to,
               warehouse_id,is_return,voided,voided_at,marketplace_notified,raw)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          cmd ? cmd.id : null, String(s.shipmentId), s.trackingNumber, s.carrierCode, s.serviceCode,
          s.packageCode, s.confirmation, s.shipmentCost || 0, s.insuranceCost || 0,
          s.shipDate, s.createDate, grammes(s.weight), dump(s.dimensions), dump(s.shipTo),
          s.warehouseId, s.isReturnLabel ? 1 : 0, s.voided ? 1 : 0, s.voidDate,
          s.marketplaceNotified ? 1 : 0, dump(s));
        nExp++;
      }
    });
    journal(`  expéditions p${page} : ${lot.length} (cumul ${nExp})`);
    if (lot.length < 500) break;
  }
  bilan.expeditions = nExp;

  // -- fulfillments (envois sans étiquette ShipStation)
  journal("Fulfillments…");
  let nFul = 0;
  for (let page = 1; page <= maxPagesCommandes; page++) {
    const d = await ss("fulfillments", { pageSize: 500, page });
    const lot = d.fulfillments || [];
    tx(() => {
      for (const f of lot) {
        const cmd = one("SELECT id FROM orders WHERE order_number = ?", f.orderNumber);
        run(`INSERT INTO shipments (order_id,tracking_number,carrier_code,cost,ship_date,created_at,
               ship_to,voided,marketplace_notified,raw) VALUES (?,?,?,0,?,?,?,?,?,?)`,
          cmd ? cmd.id : null, f.trackingNumber || null, f.carrierCode, f.shipDate, f.createDate,
          dump(f.shipTo), f.voided ? 1 : 0, f.marketplaceNotified ? 1 : 0, dump(f));
        nFul++;
      }
    });
    journal(`  fulfillments p${page} : ${lot.length} (cumul ${nFul})`);
    if (lot.length < 500) break;
  }
  bilan.fulfillments = nFul;

  // -- produits (action ajoutée au proxy ; absente tant qu'elle n'est pas déployée)
  try {
    journal("Produits…");
    let nProd = 0;
    for (let page = 1; page <= 40; page++) {
      const d = await ss("products", { pageSize: 500, page });
      const lot = d.products || [];
      tx(() => {
        for (const p of lot) {
          catalog.sauverProduit({
            sku: p.sku, name: p.name, image_url: p.imageUrl, upc: p.upc,
            weight_g: grammes({ value: p.weightOz, units: "ounces" }),
            price: p.price, active: p.active !== false,
            warehouse_location: p.warehouseLocation,
            customs_description: p.customsDescription, hs_code: p.customsTariffNo,
            country_of_origin: p.customsCountryCode || "CA",
            default_carrier: p.defaultCarrierCode, default_service: p.defaultServiceCode,
            default_package: p.defaultPackageCode, fulfillment_sku: p.fulfillmentSku,
          });
          nProd++;
        }
      });
      if (lot.length < 500) break;
    }
    bilan.produits = nProd;
  } catch (e) {
    journal(`  produits ignorés : ${e.message.slice(0, 120)}`);
    bilan.produits = `non migrés (${String(e.message).slice(0, 80)})`;
  }

  // -- dérivés
  journal("Reconstruction des clients…");
  bilan.clients = catalog.reconstruireClients();

  poserReglage("derniere_migration", maintenant());
  journaliser("migration.shipstation", "system", null, bilan);
  journal("Terminé.");
  return bilan;
}

// ------------------------------------------------------------------ import normalisé

/**
 * Import de commandes au format normalisé, avec application des règles.
 * C'est le point d'entrée des connecteurs Shopify/Etsy/Faire à venir.
 */
function importerCommandes(liste, { appliquerRegles = true } = {}) {
  const ids = [];
  tx(() => {
    for (const c of liste) {
      // Les défauts produit complètent ce que la boutique n'envoie pas.
      if (!c.weight_g && c.items) {
        for (const it of c.items) {
          if (!it.weight_g && it.sku) {
            const d = catalog.defautsPour(it.sku);
            if (d.weight_g) it.weight_g = d.weight_g;
          }
        }
      }
      ids.push(orders.upsert(c));
    }
  });
  const regles = appliquerRegles ? rules.appliquerLot(ids) : {};
  journaliser("import.orders", "order", null, { n: ids.length });
  return { importees: ids.length, ids, regles };
}

/** Amorçage : réglages, rôles, gabarits et règles de départ sur une base vierge. */
function amorcer() {
  const templates = require("./templates");
  const accounts = require("./accounts");
  const { reglage } = require("./db");
  if (reglage("amorce")) return { deja: true };
  tx(() => {
    poserReglage("marque", accounts.MARQUE_DEFAUT);
    poserReglage("tarif_dropoff_cible", 6.31);
    for (const t of templates.gabaritsParDefaut()) templates.sauver(t);
    poserReglage("amorce", maintenant());
  });
  // La configuration réelle de ShipStation est chargée d'emblée : c'est ce qui rend la
  // bascule utilisable dès le premier démarrage plutôt qu'après une journée de re-saisie.
  // Les règles y sont dans l'état exact du compte — la règle DDD email reste inactive.
  const config = require("./lasclay").charger();
  return { amorce: true, config };
}

module.exports = { migrerDepuisShipStation, importerCommandes, convertirCommande, grammes, amorcer, ss };
