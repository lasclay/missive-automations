/**
 * Produits, inventaire, clients et retours — les onglets secondaires de ShipStation.
 *
 * La fiche produit est le référentiel qui alimente les douanes et la configuration
 * d'expédition. L'audit a montré que les codes SH manquaient sur le compte : ici le champ
 * existe, `alertesDouane()` signale les manques, et l'export les liste.
 */
const { all, one, run, tx, parse, dump, maintenant, journaliser } = require("./db");

// ================================================================== produits

function chercherProduits(f = {}) {
  const w = [], p = [];
  const add = (sql, ...v) => { w.push(sql); p.push(...v); };
  if (f.q) { const q = `%${String(f.q).toLowerCase()}%`; add("(lower(sku) LIKE ? OR lower(name) LIKE ?)", q, q); }
  if (f.category) add("category = ?", f.category);
  if (f.active !== undefined && f.active !== "") add("active = ?", f.active === "oui" || f.active === true ? 1 : 0);
  if (f.no_hs) add("(hs_code IS NULL OR hs_code = '')");
  if (f.no_weight) add("(weight_g IS NULL OR weight_g = 0)");
  if (f.preset_group_id) add("preset_group_id = ?", Number(f.preset_group_id));
  const where = w.length ? "WHERE " + w.join(" AND ") : "";
  const total = one(`SELECT COUNT(*) n FROM products ${where}`, ...p).n;
  const lignes = all(`SELECT * FROM products ${where} ORDER BY sku LIMIT ? OFFSET ?`,
    ...p, Math.min(Number(f.limit) || 200, 1000), Number(f.offset) || 0);
  return { total, products: lignes.map(hydraterProduit) };
}

const hydraterProduit = (r) => r && ({
  ...r, dimensions: parse(r.dimensions), bundle_items: parse(r.bundle_items, []),
  active: !!r.active, is_bundle: !!r.is_bundle,
  inventory: all(`SELECT i.*, w.name warehouse_name FROM inventory i
                  JOIN warehouses w ON w.id = i.warehouse_id WHERE i.product_id = ?`, r.id),
});

const produit = (id) => hydraterProduit(one("SELECT * FROM products WHERE id = ?", id));
const produitParSku = (sku) => hydraterProduit(one("SELECT * FROM products WHERE sku = ?", sku));

function sauverProduit(p) {
  const champs = {
    sku: p.sku, name: p.name || null, image_url: p.image_url || null, upc: p.upc || null,
    weight_g: p.weight_g || 0, dimensions: dump(p.dimensions || null), price: p.price || 0,
    active: p.active === false ? 0 : 1, warehouse_location: p.warehouse_location || null,
    category: p.category || null, customs_description: p.customs_description || null,
    hs_code: p.hs_code || null, country_of_origin: p.country_of_origin || "CA",
    default_carrier: p.default_carrier || null, default_service: p.default_service || null,
    default_package: p.default_package || null, preset_group_id: p.preset_group_id || null,
    fulfillment_sku: p.fulfillment_sku || null, is_bundle: p.is_bundle ? 1 : 0,
    bundle_items: dump(p.bundle_items || []),
  };
  const existe = one("SELECT id FROM products WHERE sku = ?", p.sku);
  if (existe) {
    run(`UPDATE products SET ${Object.keys(champs).map((k) => `${k}=?`).join(",")} WHERE id = ?`,
      ...Object.values(champs), existe.id);
    return existe.id;
  }
  const cols = Object.keys(champs);
  run(`INSERT INTO products (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`, ...Object.values(champs));
  return one("SELECT last_insert_rowid() r").r;
}

/**
 * Défauts produit + groupe de préréglages appliqués à une commande.
 * Le défaut individuel l'emporte sur le groupe — même règle que ShipStation.
 */
function defautsPour(sku) {
  const p = produitParSku(sku);
  if (!p) return {};
  const groupe = p.preset_group_id
    ? parse((one("SELECT settings FROM preset_groups WHERE id = ?", p.preset_group_id) || {}).settings, {})
    : {};
  const individuel = {
    carrier_code: p.default_carrier, service_id: p.default_service, package_id: p.default_package,
    weight_g: p.weight_g || undefined, customs_description: p.customs_description || undefined,
    hs_code: p.hs_code || undefined, country_of_origin: p.country_of_origin || undefined,
  };
  const fusion = { ...groupe };
  for (const [k, v] of Object.entries(individuel)) if (v !== null && v !== undefined) fusion[k] = v;
  return fusion;
}

/** Produits sans code SH — bloquants pour une déclaration douanière conforme. */
const alertesDouane = () => all(
  `SELECT id, sku, name FROM products WHERE active = 1 AND (hs_code IS NULL OR hs_code = '') ORDER BY sku`);

// ------------------------------------------------------------ préréglages

const groupes = () => all("SELECT * FROM preset_groups ORDER BY name")
  .map((g) => ({ ...g, settings: parse(g.settings, {}) }));

function sauverGroupe(g) {
  if (g.id) { run("UPDATE preset_groups SET name=?, settings=? WHERE id=?", g.name, dump(g.settings || {}), g.id); return g.id; }
  run("INSERT INTO preset_groups (name, settings) VALUES (?,?)", g.name, dump(g.settings || {}));
  return one("SELECT last_insert_rowid() r").r;
}

// ------------------------------------------------------------- inventaire

function poserStock(productId, warehouseId, { on_hand, low_threshold }) {
  run(`INSERT INTO inventory (product_id, warehouse_id, on_hand, low_threshold) VALUES (?,?,?,?)
       ON CONFLICT(product_id, warehouse_id) DO UPDATE SET
         on_hand = COALESCE(excluded.on_hand, inventory.on_hand),
         low_threshold = COALESCE(excluded.low_threshold, inventory.low_threshold)`,
    productId, warehouseId, on_hand ?? null, low_threshold ?? null);
}

/** Décrémente le stock à l'expédition. */
function consommerStock(orderId) {
  const lignes = all(`SELECT i.sku, i.quantity, o.warehouse_id FROM order_items i
                      JOIN orders o ON o.id = i.order_id WHERE i.order_id = ? AND i.adjustment = 0`, orderId);
  for (const l of lignes) {
    const p = one("SELECT id FROM products WHERE sku = ?", l.sku);
    if (!p || !l.warehouse_id) continue;
    run(`UPDATE inventory SET on_hand = on_hand - ? WHERE product_id = ? AND warehouse_id = ?`,
      l.quantity || 0, p.id, l.warehouse_id);
  }
}

const stockBas = () => all(
  `SELECT p.id, p.sku, p.name, i.on_hand, i.low_threshold, w.name warehouse_name
   FROM inventory i JOIN products p ON p.id = i.product_id JOIN warehouses w ON w.id = i.warehouse_id
   WHERE i.low_threshold > 0 AND i.on_hand <= i.low_threshold ORDER BY i.on_hand`);

// ================================================================== clients

/**
 * Recalcule les agrégats client depuis les commandes.
 *
 * Non destructif : un client importé de ShipStation garde son téléphone et son adresse
 * postale — que les commandes ne portent pas toujours — et ne reçoit que ses compteurs
 * remis à jour. Un DELETE global perdrait ces champs à chaque recalcul.
 */
function reconstruireClients() {
  return tx(() => {
    const lignes = all(`SELECT customer_email email, MAX(customer_name) name, MAX(store_id) store_id,
        COUNT(*) n, COALESCE(SUM(order_total),0) total, MIN(order_date) premiere, MAX(order_date) derniere,
        MAX(ship_to) adresse
      FROM orders WHERE customer_email IS NOT NULL AND customer_email <> '' GROUP BY customer_email`);
    for (const l of lignes) {
      run(`INSERT INTO customers (email,name,address,store_id,order_count,total_spent,first_order,last_order)
           VALUES (?,?,?,?,?,?,?,?)
           ON CONFLICT(email) DO UPDATE SET
             name = COALESCE(customers.name, excluded.name),
             address = COALESCE(customers.address, excluded.address),
             store_id = COALESCE(customers.store_id, excluded.store_id),
             order_count = excluded.order_count,
             total_spent = excluded.total_spent,
             first_order = excluded.first_order,
             last_order = excluded.last_order`,
        l.email, l.name, l.adresse, l.store_id, l.n, l.total, l.premiere, l.derniere);
    }
    journaliser("customers.rebuild", "customer", null, { n: lignes.length });
    return lignes.length;
  });
}

function chercherClients(f = {}) {
  const w = [], p = [];
  if (f.q) { const q = `%${String(f.q).toLowerCase()}%`; w.push("(lower(email) LIKE ? OR lower(name) LIKE ?)"); p.push(q, q); }
  if (f.min_orders) { w.push("order_count >= ?"); p.push(Number(f.min_orders)); }
  const where = w.length ? "WHERE " + w.join(" AND ") : "";
  const total = one(`SELECT COUNT(*) n FROM customers ${where}`, ...p).n;
  const tri = ["order_count", "total_spent", "last_order", "name"].includes(f.sort) ? f.sort : "total_spent";
  return {
    total,
    customers: all(`SELECT * FROM customers ${where} ORDER BY ${tri} DESC LIMIT ? OFFSET ?`,
      ...p, Math.min(Number(f.limit) || 100, 500), Number(f.offset) || 0)
      .map((c) => ({ ...c, address: parse(c.address, {}) })),
  };
}

// ================================================================== retours

/** Numéro de RMA lisible et unique. */
function prochainRma() {
  const n = one("SELECT COUNT(*) n FROM returns").n + 1;
  return `RMA-${new Date().getFullYear()}-${String(n).padStart(5, "0")}`;
}

function creerRetour({ order_id, reason, resolution, items = [], notes = null, userId = null }) {
  const rma = prochainRma();
  run(`INSERT INTO returns (rma, order_id, status, reason, resolution, requested_at, notes, items)
       VALUES (?,?,'requested',?,?,?,?,?)`,
    rma, order_id || null, reason || null, resolution || "refund", maintenant(), notes, dump(items));
  const id = one("SELECT last_insert_rowid() r").r;
  journaliser("return.create", "return", id, { rma, order_id }, userId);
  return { id, rma };
}

const STATUTS_RETOUR = ["requested", "approved", "in_transit", "received", "refunded", "rejected"];

function majRetour(id, { status, resolution, notes, shipment_id }, userId = null) {
  if (status && !STATUTS_RETOUR.includes(status)) throw new Error(`statut de retour inconnu : ${status}`);
  run(`UPDATE returns SET status = COALESCE(?, status), resolution = COALESCE(?, resolution),
       notes = COALESCE(?, notes), shipment_id = COALESCE(?, shipment_id),
       closed_at = CASE WHEN ? IN ('refunded','rejected') THEN ? ELSE closed_at END WHERE id = ?`,
    status ?? null, resolution ?? null, notes ?? null, shipment_id ?? null, status ?? "", maintenant(), id);
  journaliser("return.update", "return", id, { status }, userId);
}

const chercherRetours = (f = {}) => {
  const w = [], p = [];
  if (f.status) { w.push("r.status = ?"); p.push(f.status); }
  if (f.q) { const q = `%${String(f.q).toLowerCase()}%`; w.push("(lower(r.rma) LIKE ? OR lower(o.order_number) LIKE ?)"); p.push(q, q); }
  const where = w.length ? "WHERE " + w.join(" AND ") : "";
  return {
    total: one(`SELECT COUNT(*) n FROM returns r LEFT JOIN orders o ON o.id = r.order_id ${where}`, ...p).n,
    returns: all(`SELECT r.*, o.order_number, o.customer_name FROM returns r
                  LEFT JOIN orders o ON o.id = r.order_id ${where} ORDER BY r.id DESC LIMIT ?`,
      ...p, Math.min(Number(f.limit) || 200, 1000)).map((r) => ({ ...r, items: parse(r.items, []) })),
  };
};

module.exports = {
  chercherProduits, produit, produitParSku, sauverProduit, defautsPour, alertesDouane,
  groupes, sauverGroupe, poserStock, consommerStock, stockBas,
  reconstruireClients, chercherClients,
  creerRetour, majRetour, chercherRetours, STATUTS_RETOUR,
};
