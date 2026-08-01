/**
 * Commandes — le module central.
 *
 * Couvre ce que fait l'onglet Orders de ShipStation : recherche et filtres cumulables,
 * tri, statuts, Hold, assignation, tags, scission (split), fusion (combine), alertes,
 * champs personnalisés, et l'upsert par clé externe utilisé par l'ingestion.
 */
const { all, one, run, tx, parse, dump, maintenant, journaliser } = require("./db");

const STATUTS = ["awaiting_payment", "awaiting_shipment", "pending_fulfillment", "shipped", "on_hold", "cancelled"];

// ------------------------------------------------------------------ lecture

/** Colonnes triables — liste blanche, l'entrée vient de l'interface. */
const TRIABLE = new Set(["order_number", "order_date", "created_at", "status", "customer_name",
  "order_total", "weight_g", "ship_by_date", "hold_until", "age"]);

/**
 * Recherche filtrée. Chaque filtre est facultatif et se cumule aux autres — c'est
 * exactement ce qui rend la grille utile pour trier un arriéré.
 */
function chercher(f = {}) {
  const w = [], p = [];
  const add = (sql, ...v) => { w.push(sql); p.push(...v); };

  if (f.status) Array.isArray(f.status)
    ? add(`o.status IN (${f.status.map(() => "?").join(",")})`, ...f.status)
    : add("o.status = ?", f.status);
  if (f.store_id) add("o.store_id = ?", Number(f.store_id));
  if (f.warehouse_id) add("o.warehouse_id = ?", Number(f.warehouse_id));
  if (f.country) add("json_extract(o.ship_to,'$.country') = ?", f.country);
  if (f.state) add("json_extract(o.ship_to,'$.state') = ?", f.state);
  if (f.carrier_code) add("o.carrier_code = ?", f.carrier_code);
  if (f.service_id) add("o.service_id = ?", f.service_id);
  if (f.assigned_user) add("o.assigned_user = ?", f.assigned_user);
  if (f.source) add("o.source = ?", f.source);
  if (f.weight_min) add("o.weight_g >= ?", Number(f.weight_min));
  if (f.weight_max) add("o.weight_g <= ?", Number(f.weight_max));
  if (f.total_min) add("o.order_total >= ?", Number(f.total_min));
  if (f.no_weight) add("(o.weight_g IS NULL OR o.weight_g = 0)");
  if (f.gift) add("o.gift = 1");
  if (f.date_from) add("o.order_date >= ?", f.date_from);
  if (f.date_to) add("o.order_date <= ?", f.date_to);
  if (f.age_min) add("julianday('now') - julianday(o.order_date) >= ?", Number(f.age_min));
  if (f.age_max) add("julianday('now') - julianday(o.order_date) <= ?", Number(f.age_max));
  if (f.drop_off === "oui") add("o.weight_g > 0 AND o.weight_g < ?", Number(f.seuil || 500));
  if (f.drop_off === "non") add("(o.weight_g = 0 OR o.weight_g >= ?)", Number(f.seuil || 500));
  if (f.tag_id) add("EXISTS (SELECT 1 FROM order_tags t WHERE t.order_id = o.id AND t.tag_id = ?)", Number(f.tag_id));
  if (f.untagged) add("NOT EXISTS (SELECT 1 FROM order_tags t WHERE t.order_id = o.id)");
  if (f.sku) add("EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.sku LIKE ?)", `%${f.sku}%`);
  if (f.single_item) add("(SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id AND i.adjustment = 0) = 1");

  // Critères d'une vue sauvegardée (§12.5) — compilés en SQL par `criteres.js`, le même
  // langage que les règles d'automatisation. C'est ce qui permet de rejouer les 27 vues de
  // ShipStation sur l'arriéré complet sans sortir les commandes de la base.
  if (f.criteres && (Array.isArray(f.criteres) ? f.criteres.length : true)) {
    const c = require("./criteres").compiler(
      Array.isArray(f.criteres) ? f.criteres : parse(f.criteres, []),
      f.match_all !== false && f.match_all !== 0);
    if (c.sql) add(c.sql, ...c.params);
  }
  if (f.view_id) {
    const v = one("SELECT criteres, match_all FROM views WHERE id = ?", Number(f.view_id));
    const c = v && require("./criteres").compiler(parse(v.criteres, []), v.match_all !== 0);
    if (c && c.sql) add(c.sql, ...c.params);
  }

  if (f.q) {
    const q = `%${String(f.q).toLowerCase()}%`;
    add(`(lower(o.order_number) LIKE ? OR lower(o.customer_name) LIKE ? OR lower(o.customer_email) LIKE ?
          OR lower(json_extract(o.ship_to,'$.city')) LIKE ? OR lower(json_extract(o.ship_to,'$.postalCode')) LIKE ?
          OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND lower(i.sku) LIKE ?))`,
      q, q, q, q, q, q);
  }

  const where = w.length ? "WHERE " + w.join(" AND ") : "";
  const tri = TRIABLE.has(f.sort) ? f.sort : "order_date";
  const col = tri === "age" ? "o.order_date" : `o.${tri}`;
  // « âge décroissant » = les plus vieilles d'abord = date croissante. On inverse pour
  // que l'interface parle d'âge sans que l'utilisateur ait à y penser.
  const sens = (f.dir === "asc") === (tri === "age") ? "DESC" : "ASC";
  const limite = Math.min(Number(f.limit) || 200, 1000);
  const offset = Number(f.offset) || 0;

  const total = one(`SELECT COUNT(*) n FROM orders o ${where}`, ...p).n;
  const lignes = all(
    `SELECT o.*, CAST(julianday('now') - julianday(o.order_date) AS INTEGER) AS age
     FROM orders o ${where} ORDER BY ${col} ${sens} LIMIT ? OFFSET ?`, ...p, limite, offset);

  return { total, orders: lignes.map(hydrater) };
}

/** Transforme une ligne SQL en objet utilisable (JSON décodé, articles, tags). */
function hydrater(r) {
  if (!r) return null;
  return {
    ...r,
    ship_to: parse(r.ship_to, {}),
    bill_to: parse(r.bill_to, {}),
    dimensions: parse(r.dimensions),
    insurance: parse(r.insurance),
    customs: parse(r.customs),
    gift: !!r.gift,
    externally_fulfilled: !!r.externally_fulfilled,
    items: all("SELECT * FROM order_items WHERE order_id = ? ORDER BY id", r.id)
      .map((i) => ({ ...i, options: parse(i.options, []), adjustment: !!i.adjustment })),
    tags: all("SELECT t.id, t.name, t.color FROM order_tags ot JOIN tags t ON t.id = ot.tag_id WHERE ot.order_id = ?", r.id),
    raw: undefined,
  };
}

const parId = (id) => hydrater(one("SELECT *, CAST(julianday('now') - julianday(order_date) AS INTEGER) AS age FROM orders WHERE id = ?", id));
const parNumero = (n) => hydrater(one("SELECT * FROM orders WHERE order_number = ?", n));

// ------------------------------------------------------------------ écriture

/**
 * Crée ou met à jour une commande, par `order_key` (la clé de la boutique d'origine).
 * Même sémantique que le `createorder` de ShipStation : les champs fournis écrasent.
 */
function upsert(cmd) {
  return tx(() => {
    const existante = cmd.order_key ? one("SELECT id FROM orders WHERE order_key = ?", cmd.order_key) : null;
    const champs = {
      order_number: cmd.order_number, order_key: cmd.order_key || null,
      store_id: cmd.store_id || null, status: cmd.status || "awaiting_shipment",
      order_date: cmd.order_date || maintenant(), paid_at: cmd.paid_at || null,
      modified_at: maintenant(), ship_by_date: cmd.ship_by_date || null,
      hold_until: cmd.hold_until || null,
      customer_email: cmd.customer_email || null,
      customer_name: cmd.customer_name || (cmd.ship_to && cmd.ship_to.name) || null,
      bill_to: dump(cmd.bill_to || null), ship_to: dump(cmd.ship_to || {}),
      order_total: cmd.order_total || 0, amount_paid: cmd.amount_paid || 0,
      tax_amount: cmd.tax_amount || 0, shipping_paid: cmd.shipping_paid || 0,
      customer_notes: cmd.customer_notes || null, internal_notes: cmd.internal_notes || null,
      gift: cmd.gift ? 1 : 0, gift_message: cmd.gift_message || null,
      requested_service: cmd.requested_service || null,
      carrier_code: cmd.carrier_code || null, service_id: cmd.service_id || null,
      package_id: cmd.package_id || null, confirmation: cmd.confirmation || null,
      weight_g: cmd.weight_g || 0, dimensions: dump(cmd.dimensions || null),
      warehouse_id: cmd.warehouse_id || null,
      insurance: dump(cmd.insurance || null), customs: dump(cmd.customs || null),
      custom_field1: cmd.custom_field1 || null, custom_field2: cmd.custom_field2 || null,
      custom_field3: cmd.custom_field3 || null, source: cmd.source || null,
      externally_fulfilled: cmd.externally_fulfilled ? 1 : 0,
      raw: dump(cmd.raw || null),
    };

    let id;
    if (existante) {
      id = existante.id;
      const sets = Object.keys(champs).map((k) => `${k} = ?`).join(", ");
      run(`UPDATE orders SET ${sets} WHERE id = ?`, ...Object.values(champs), id);
      run("DELETE FROM order_items WHERE order_id = ?", id);
    } else {
      champs.created_at = maintenant();
      const cols = Object.keys(champs);
      run(`INSERT INTO orders (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
        ...Object.values(champs));
      id = one("SELECT last_insert_rowid() r").r;
    }

    for (const it of cmd.items || []) {
      run(`INSERT INTO order_items (order_id,line_key,sku,name,image_url,quantity,unit_price,
             weight_g,tax,warehouse_location,upc,product_id,adjustment,options)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, it.line_key || null, it.sku || null, it.name || null, it.image_url || null,
        it.quantity ?? 1, it.unit_price || 0, it.weight_g || 0, it.tax || 0,
        it.warehouse_location || null, it.upc || null, it.product_id || null,
        it.adjustment ? 1 : 0, dump(it.options || []));
    }

    // Poids de la commande : celui fourni, sinon la somme des articles physiques.
    if (!champs.weight_g) {
      const s = one(`SELECT COALESCE(SUM(weight_g * quantity),0) w FROM order_items
                     WHERE order_id = ? AND adjustment = 0`, id).w;
      if (s) run("UPDATE orders SET weight_g = ? WHERE id = ?", s, id);
    }

    journaliser(existante ? "order.update" : "order.create", "order", id, { order_number: cmd.order_number });
    return id;
  });
}

/** Change le statut, avec les effets de bord attendus. */
function changerStatut(id, statut, userId = null) {
  if (!STATUTS.includes(statut)) throw new Error(`statut inconnu : ${statut}`);
  run("UPDATE orders SET status = ?, modified_at = ? WHERE id = ?", statut, maintenant(), id);
  if (statut !== "on_hold") run("UPDATE orders SET hold_until = NULL WHERE id = ?", id);
  journaliser("order.status", "order", id, { statut }, userId);
}

/** Met en attente jusqu'à une date. Le retour en file est automatique (voir libererHolds). */
function hold(id, jusqua, userId = null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jusqua)) throw new Error("date attendue au format AAAA-MM-JJ");
  run("UPDATE orders SET status = 'on_hold', hold_until = ?, modified_at = ? WHERE id = ?",
    jusqua, maintenant(), id);
  journaliser("order.hold", "order", id, { jusqua }, userId);
}

function restaurer(id, userId = null) {
  run(`UPDATE orders SET status = 'awaiting_shipment', hold_until = NULL, modified_at = ?
       WHERE id = ? AND status = 'on_hold'`, maintenant(), id);
  journaliser("order.restore", "order", id, null, userId);
}

/**
 * Remet en file toutes les commandes dont la date de hold est passée.
 * À appeler au démarrage et périodiquement — c'est ce que ShipStation fait en tâche de fond.
 */
function libererHolds() {
  const r = run(`UPDATE orders SET status = 'awaiting_shipment', hold_until = NULL, modified_at = ?
                 WHERE status = 'on_hold' AND hold_until IS NOT NULL AND hold_until <= date('now')`,
    maintenant());
  if (r.changes) journaliser("order.hold_released", "order", null, { n: r.changes });
  return r.changes;
}

const assigner = (id, userId) => {
  run("UPDATE orders SET assigned_user = ?, modified_at = ? WHERE id = ?", userId || null, maintenant(), id);
  journaliser("order.assign", "order", id, { userId });
};

const ajouterTag = (id, tagId) =>
  run("INSERT OR IGNORE INTO order_tags(order_id, tag_id) VALUES (?,?)", id, tagId);
const retirerTag = (id, tagId) =>
  run("DELETE FROM order_tags WHERE order_id = ? AND tag_id = ?", id, tagId);

/** Champs personnalisés — utilisés chez Lasclay pour la marque et le flux USA. */
function poserChamps(id, { custom_field1, custom_field2, custom_field3 }) {
  run(`UPDATE orders SET custom_field1 = COALESCE(?, custom_field1),
       custom_field2 = COALESCE(?, custom_field2), custom_field3 = COALESCE(?, custom_field3),
       modified_at = ? WHERE id = ?`,
    custom_field1 ?? null, custom_field2 ?? null, custom_field3 ?? null, maintenant(), id);
}

function supprimer(id, userId = null) {
  const c = parId(id);
  if (!c) throw new Error("commande inconnue");
  if (all("SELECT id FROM shipments WHERE order_id = ? AND voided = 0", id).length)
    throw new Error("commande déjà expédiée — annuler l'étiquette d'abord");
  changerStatut(id, "cancelled", userId);
  journaliser("order.cancel", "order", id, { order_number: c.order_number }, userId);
}

// ------------------------------------------------------- scission et fusion

/**
 * Scinde une commande : les lignes désignées partent dans une nouvelle commande enfant.
 * ShipStation appelle ça Split Ship. La commande d'origine garde le reste.
 */
function scinder(id, itemIds, userId = null) {
  return tx(() => {
    const source = parId(id);
    if (!source) throw new Error("commande inconnue");
    const restants = source.items.filter((i) => !itemIds.includes(i.id));
    if (!itemIds.length || !restants.length)
      throw new Error("la scission doit laisser au moins un article de chaque côté");

    const suffixe = one("SELECT COUNT(*) n FROM orders WHERE parent_id = ?", id).n + 1;
    const enfantId = upsert({
      ...source,
      order_number: `${source.order_number}-${suffixe}`,
      order_key: `${source.order_key || source.order_number}-split${suffixe}`,
      items: [], weight_g: 0, order_total: 0,
    });
    run("UPDATE orders SET parent_id = ? WHERE id = ?", id, enfantId);
    for (const iid of itemIds) run("UPDATE order_items SET order_id = ? WHERE id = ? AND order_id = ?", enfantId, iid, id);
    for (const oid of [id, enfantId]) {
      const w = one(`SELECT COALESCE(SUM(weight_g*quantity),0) w FROM order_items WHERE order_id = ? AND adjustment = 0`, oid).w;
      run("UPDATE orders SET weight_g = ? WHERE id = ?", w, oid);
    }
    journaliser("order.split", "order", id, { enfant: enfantId, articles: itemIds.length }, userId);
    return enfantId;
  });
}

/**
 * Fusionne des commandes dans une cible : une seule expédition, mais les deux dossiers
 * restent consultables et notifiables — comme chez ShipStation.
 */
function fusionner(cibleId, autresIds, userId = null) {
  return tx(() => {
    if (!parId(cibleId)) throw new Error("commande cible inconnue");
    for (const src of autresIds) {
      if (src === cibleId) continue;
      run("UPDATE order_items SET order_id = ? WHERE order_id = ?", cibleId, src);
      run("UPDATE orders SET merged_into = ?, status = 'cancelled', modified_at = ? WHERE id = ?",
        cibleId, maintenant(), src);
    }
    const w = one("SELECT COALESCE(SUM(weight_g*quantity),0) w FROM order_items WHERE order_id = ? AND adjustment = 0", cibleId).w;
    run("UPDATE orders SET weight_g = ? WHERE id = ?", w, cibleId);
    journaliser("order.merge", "order", cibleId, { fusionnees: autresIds }, userId);
    return cibleId;
  });
}

// ------------------------------------------------------------------ alertes

/**
 * Order Alerts — ce qui empêchera d'acheter une étiquette, détecté avant le lot plutôt
 * qu'au milieu. C'est la fonction qui fait gagner le plus de temps à l'usage.
 */
function alertes() {
  const q = (sql, ...p) => all(sql, ...p);
  return {
    sans_poids: q(`SELECT id, order_number, customer_name FROM orders
                   WHERE status = 'awaiting_shipment' AND (weight_g IS NULL OR weight_g = 0)`),
    adresse_incomplete: q(`SELECT id, order_number, customer_name FROM orders
                   WHERE status = 'awaiting_shipment' AND (
                     json_extract(ship_to,'$.street1') IS NULL OR json_extract(ship_to,'$.street1') = ''
                     OR json_extract(ship_to,'$.postalCode') IS NULL OR json_extract(ship_to,'$.postalCode') = ''
                     OR json_extract(ship_to,'$.country') IS NULL)`),
    sans_courriel: q(`SELECT id, order_number, customer_name FROM orders
                   WHERE status = 'awaiting_shipment' AND (customer_email IS NULL OR customer_email = '')`),
    douane_incomplete: q(`SELECT DISTINCT o.id, o.order_number, o.customer_name FROM orders o
                   JOIN order_items i ON i.order_id = o.id
                   LEFT JOIN products p ON p.sku = i.sku
                   WHERE o.status = 'awaiting_shipment' AND o.ship_to IS NOT NULL
                     AND json_extract(o.ship_to,'$.country') <> 'CA' AND i.adjustment = 0
                     AND (p.hs_code IS NULL OR p.hs_code = '')`),
    fusionnables: q(`SELECT json_extract(ship_to,'$.postalCode') cp, json_extract(ship_to,'$.name') nom,
                     COUNT(*) n, GROUP_CONCAT(id) ids FROM orders
                   WHERE status = 'awaiting_shipment' AND merged_into IS NULL
                   GROUP BY cp, nom HAVING n > 1`),
    vieilles: q(`SELECT id, order_number, customer_name,
                   CAST(julianday('now') - julianday(order_date) AS INTEGER) age FROM orders
                 WHERE status = 'awaiting_shipment' AND julianday('now') - julianday(order_date) > 14
                 ORDER BY order_date LIMIT 50`),
  };
}

/** Compteurs pour la barre latérale. */
function compteurs() {
  const parStatut = Object.fromEntries(
    all("SELECT status, COUNT(*) n FROM orders GROUP BY status").map((r) => [r.status, r.n]));
  const a = alertes();
  return {
    statuts: parStatut,
    alertes: Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.length])),
  };
}

module.exports = {
  STATUTS, chercher, parId, parNumero, hydrater, upsert, changerStatut, hold, restaurer,
  libererHolds, assigner, ajouterTag, retirerTag, poserChamps, supprimer, scinder, fusionner,
  alertes, compteurs,
};
