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
  if (f.sans_groupe) add("(preset_group_id IS NULL OR preset_group_id = 0)");
  const where = w.length ? "WHERE " + w.join(" AND ") : "";
  const total = one(`SELECT COUNT(*) n FROM products ${where}`, ...p).n;
  // Tri : liste blanche stricte — la clé vient de l'URL et finit dans du SQL.
  const TRIS = { sku: "sku", name: "name", weight_g: "weight_g", price: "price",
    hs_code: "hs_code", country_of_origin: "country_of_origin",
    warehouse_location: "warehouse_location", upc: "upc", active: "active",
    preset_group_id: "preset_group_id", created_at: "created_at" };
  const tri = TRIS[f.sort] || "sku";
  const dir = String(f.dir).toLowerCase() === "desc" ? "DESC" : "ASC";
  const lignes = all(`SELECT * FROM products ${where} ORDER BY ${tri} ${dir}, sku LIMIT ? OFFSET ?`,
    ...p, Math.min(Number(f.limit) || 200, 1000), Number(f.offset) || 0);
  return { total, products: lignes.map(hydraterProduit) };
}

/**
 * Actions de masse sur une sélection de produits — ShipStation en a onze ; les deux qui
 * comptent chez Lasclay sont le rattachement à un groupe de préréglages (c'est lui qui porte
 * les poids et les dimensions de tout le catalogue) et l'activation.
 */
function masseProduits(ids, champs = {}) {
  const liste = (Array.isArray(ids) ? ids : []).map(Number).filter(Boolean);
  if (!liste.length) return { n: 0 };
  const trous = liste.map(() => "?").join(",");
  let n = 0;
  tx(() => {
    // `products` n'a pas de colonne `updated_at` — la traçabilité de l'action passe par le
    // journal ci-dessous, pas par une colonne qui n'existe pas.
    if (champs.preset_group_id !== undefined) {
      const g = champs.preset_group_id ? Number(champs.preset_group_id) : null;
      if (g && !one("SELECT id FROM preset_groups WHERE id = ?", g)) throw new Error("groupe inconnu");
      run(`UPDATE products SET preset_group_id = ? WHERE id IN (${trous})`, g, ...liste);
      n = liste.length;
    }
    if (champs.active !== undefined) {
      run(`UPDATE products SET active = ? WHERE id IN (${trous})`, champs.active ? 1 : 0, ...liste);
      n = liste.length;
    }
  });
  journaliser("product.masse", "product", null, { n, champs }, champs.userId || null);
  return { n };
}

const hydraterProduit = (r) => r && ({
  ...r, dimensions: parse(r.dimensions), bundle_items: parse(r.bundle_items, []),
  active: !!r.active, is_bundle: !!r.is_bundle,
  herite: heritage(r.preset_group_id),
  inventory: all(`SELECT i.*, w.name warehouse_name FROM inventory i
                  JOIN warehouses w ON w.id = i.warehouse_id WHERE i.product_id = ?`, r.id),
});

const produit = (id) => hydraterProduit(one("SELECT * FROM products WHERE id = ?", id));
const produitParSku = (sku) => hydraterProduit(one("SELECT * FROM products WHERE sku = ?", sku));

/**
 * Enregistre un produit — BUG-002.
 *
 * L'identité est `external_id` quand la source en fournit un (le `productId` de
 * ShipStation), sinon le SKU. Chercher d'abord par SKU faisait fondre en un seul produit
 * les 39 articles du catalogue qui n'en ont pas, et écrasait un produit de chaque paire de
 * SKU en double. Un produit sans SKU reste un produit.
 */
function sauverProduit(p) {
  const sku = p.sku && String(p.sku).trim() ? String(p.sku).trim() : null;
  const champs = {
    external_id: p.external_id != null ? String(p.external_id) : null,
    sku, name: p.name || null, image_url: p.image_url || null, upc: p.upc || null,
    weight_g: p.weight_g || 0, dimensions: dump(p.dimensions || null), price: p.price || 0,
    active: p.active === false ? 0 : 1, warehouse_location: p.warehouse_location || null,
    category: p.category || null, customs_description: p.customs_description || null,
    hs_code: p.hs_code || null, country_of_origin: p.country_of_origin || "CA",
    default_carrier: p.default_carrier || null, default_service: p.default_service || null,
    default_package: p.default_package || null, preset_group_id: p.preset_group_id || null,
    declared_value: p.declared_value === "" || p.declared_value == null ? null : Number(p.declared_value),
    fulfillment_sku: p.fulfillment_sku || null, is_bundle: p.is_bundle ? 1 : 0,
    bundle_items: dump(p.bundle_items || []),
  };
  const existe = (champs.external_id && one("SELECT id FROM products WHERE external_id = ?", champs.external_id))
    || (sku && one("SELECT id FROM products WHERE sku = ? AND (external_id IS NULL OR external_id = ?)",
        sku, champs.external_id ?? ""))
    || (sku && !champs.external_id && one("SELECT id FROM products WHERE sku = ?", sku));
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

/**
 * Ce que le produit hérite de son groupe, champ par champ — le mécanisme clé de la fiche
 * produit de ShipStation, qui affiche « Preset - 200 » sous chaque champ vide.
 *
 * Sans cet affichage, la règle d'héritage est affirmée dans l'aide et invérifiable à l'écran :
 * un poids vide sur la fiche peut vouloir dire « 0 g » ou « 200 g hérités », et rien ne
 * permet de trancher. Chez Lasclay ce sont les groupes qui portent tous les poids et toutes
 * les dimensions du catalogue.
 */
function heritage(preset_group_id) {
  if (!preset_group_id) return {};
  const g = one("SELECT name, settings FROM preset_groups WHERE id = ?", Number(preset_group_id));
  if (!g) return {};
  const s = parse(g.settings, {}) || {};
  return { groupe: g.name, weight_g: s.weight_g, dimensions: s.dimensions,
    package_id: s.package_id, confirmation: s.confirmation,
    hs_code: (s.customs || {}).hs_code, country_of_origin: (s.customs || {}).country_of_origin,
    customs_description: (s.customs || {}).description,
    declared_value: (s.customs || {}).value };
}

/** Produits sans code SH — bloquants pour une déclaration douanière conforme. */
const alertesDouane = () => all(
  `SELECT id, sku, name FROM products WHERE active = 1 AND (hs_code IS NULL OR hs_code = '') ORDER BY sku`);

// ------------------------------------------------------------ préréglages

const groupes = () => all("SELECT * FROM preset_groups ORDER BY name")
  .map((g) => ({ ...g, settings: parse(g.settings, {}) }));

/**
 * Le nom d'un groupe est unique en base. Créer « Mitaines Seules » quand il existe déjà
 * remontait le message brut de SQLite (`UNIQUE constraint failed: preset_groups.name`)
 * jusque dans une alerte native. La collision est un cas normal — on la nomme, on dit sur
 * quel groupe elle tombe, et l'appelant décide.
 */
function sauverGroupe(g) {
  const nom = String(g.name || "").trim();
  if (!nom) throw new Error("le nom du groupe est obligatoire");
  const homonyme = one("SELECT id FROM preset_groups WHERE name = ? COLLATE NOCASE", nom);
  if (homonyme && Number(homonyme.id) !== Number(g.id)) {
    const e = new Error(`Un groupe s'appelle déjà « ${nom} ». Ouvrez-le pour le modifier, ou donnez un autre nom.`);
    e.collision = homonyme.id;
    throw e;
  }
  if (g.id) { run("UPDATE preset_groups SET name=?, settings=? WHERE id=?", nom, dump(g.settings || {}), g.id); return g.id; }
  run("INSERT INTO preset_groups (name, settings) VALUES (?,?)", nom, dump(g.settings || {}));
  return one("SELECT last_insert_rowid() r").r;
}

/**
 * Import de produits par CSV — le catalogue ne pouvait pas être réparé depuis l'interface.
 *
 * L'audit chiffrait le coût de la saisie manuelle à ~3 800 champs. Un import est la seule
 * réponse raisonnable, et c'est aussi ce que ShipStation offre (avec un CSV d'exemple qui
 * sert de gabarit).
 *
 * Deux précautions. La stratégie de collision est **explicite** — mettre à jour ou ignorer —
 * parce qu'un import qui écrase sans le dire détruit un travail de saisie. Et rien n'est
 * écrit tant que `appliquer` n'est pas vrai : on regarde d'abord ce que l'import ferait.
 */
const COLONNES_IMPORT = ["sku", "name", "weight_g", "price", "hs_code", "country_of_origin",
  "warehouse_location", "customs_description", "declared_value", "upc", "length", "width", "height"];

function importerProduits(texte, { collision = "maj", appliquer = false, userId = null } = {}) {
  const lignes = String(texte || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lignes.length) throw new Error("fichier vide");

  const sep = (lignes[0].match(/;/g) || []).length > (lignes[0].match(/,/g) || []).length ? ";" : ",";
  const decouper = (l) => {
    const out = []; let cur = "", guill = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') { if (guill && l[i + 1] === '"') { cur += '"'; i++; } else guill = !guill; }
      else if (c === sep && !guill) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  };

  const entetes = decouper(lignes[0]).map((h) => h.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_]/g, "_"));
  const alias = { nom: "name", poids: "weight_g", poids_g: "weight_g", prix: "price",
    code_sh: "hs_code", origine: "country_of_origin", emplacement: "warehouse_location",
    description_douane: "customs_description", valeur_declaree: "declared_value",
    longueur: "length", largeur: "width", hauteur: "height" };
  const cles = entetes.map((h) => alias[h] || h);
  if (!cles.includes("sku")) throw new Error("colonne « sku » absente — c'est la clé de rapprochement");

  const rapport = { lus: 0, crees: 0, majs: 0, ignores: 0, refuses: [] };
  const ecrire = () => {
    for (let n = 1; n < lignes.length; n++) {
      const vals = decouper(lignes[n]);
      const o = {};
      cles.forEach((k, i) => { if (COLONNES_IMPORT.includes(k)) o[k] = vals[i] ?? ""; });
      rapport.lus++;
      const sku = String(o.sku || "").trim();
      if (!sku) { rapport.refuses.push({ ligne: n + 1, motif: "SKU vide" }); continue; }
      if (o.hs_code && !/^\d{4}\.?\d{2}$/.test(String(o.hs_code).trim())) {
        rapport.refuses.push({ ligne: n + 1, sku, motif: `code SH mal formé : ${o.hs_code}` });
        continue;
      }
      const existe = produitParSku(sku);
      if (existe && collision === "ignorer") { rapport.ignores++; continue; }
      if (!appliquer) { existe ? rapport.majs++ : rapport.crees++; continue; }
      // `sauverProduit` réécrit toutes les colonnes : un CSV sans colonne « nom » viderait
      // les noms existants. On part donc de la fiche telle qu'elle est et on ne pose que ce
      // que le fichier apporte réellement.
      const base = existe || {};
      const dims = (o.length || o.width || o.height)
        ? { length: Number(o.length) || 0, width: Number(o.width) || 0, height: Number(o.height) || 0, unit: "in" }
        : base.dimensions;
      const pose = (k, v) => (v === undefined || v === "" ? base[k] : v);
      sauverProduit({
        ...base, sku, dimensions: dims,
        name: pose("name", o.name),
        weight_g: pose("weight_g", o.weight_g === undefined || o.weight_g === "" ? undefined : Number(o.weight_g)),
        price: pose("price", o.price === undefined || o.price === "" ? undefined : Number(o.price)),
        hs_code: pose("hs_code", o.hs_code),
        country_of_origin: pose("country_of_origin", o.country_of_origin),
        warehouse_location: pose("warehouse_location", o.warehouse_location),
        customs_description: pose("customs_description", o.customs_description),
        declared_value: pose("declared_value", o.declared_value === undefined || o.declared_value === "" ? undefined : Number(o.declared_value)),
        upc: pose("upc", o.upc),
      });
      existe ? rapport.majs++ : rapport.crees++;
    }
  };
  appliquer ? tx(ecrire) : ecrire();
  if (appliquer) journaliser("product.import", "product", null,
    { lus: rapport.lus, crees: rapport.crees, majs: rapport.majs, refuses: rapport.refuses.length }, userId);
  return { ...rapport, a_blanc: !appliquer, colonnes_reconnues: cles.filter((k) => COLONNES_IMPORT.includes(k)) };
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
    // BUG-024 — `customer_id` était nul sur 100 % des commandes : le service après-vente ne
    // pouvait pas remonter l'historique d'un client, et une réexpédition demandait de
    // rechercher à la main. Le rattachement se fait ici, une fois les clients consolidés.
    const rattachees = run(`UPDATE orders SET customer_id = (
        SELECT c.id FROM customers c WHERE lower(c.email) = lower(orders.customer_email))
      WHERE customer_email IS NOT NULL AND customer_email <> ''
        AND (customer_id IS NULL OR customer_id NOT IN (SELECT id FROM customers))`).changes;

    journaliser("customers.rebuild", "customer", null, { n: lignes.length, commandes_rattachees: rattachees });
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

/**
 * Motifs de retour de ShipStation (§4) — normalisés, pas en texte libre (BUG-055).
 *
 * « taille », « Taille », « trop petit » et « TROP PETIT » sont quatre motifs distincts pour
 * qui compte, et rendent la donnée inexploitable. La précision libre vit dans `notes`, à
 * côté : on garde la nuance sans perdre le dénombrement.
 */
const MOTIFS_RETOUR = ["courtesy", "wrong_item_ordered", "warranty", "changed_mind",
  "wrong_item_received", "rental", "damaged", "defective", "arrived_late",
  "missing_parts", "not_as_described", "other", "exchange"];

const RESOLUTIONS = ["refund", "exchange", "store_credit"];

function creerRetour({ order_id, reason, resolution, items = [], notes = null, userId = null }) {
  // La commande est obligatoire et doit exister : sans cette vérification, un champ vide
  // rattachait le RMA à la première commande venue (BUG-054).
  if (!order_id) throw new Error("un retour se rattache à une commande — numéro manquant");
  const cmd = one("SELECT id, order_number FROM orders WHERE id = ?", Number(order_id));
  if (!cmd) throw new Error(`commande inconnue : ${order_id}`);
  if (reason && !MOTIFS_RETOUR.includes(reason))
    throw new Error(`motif de retour inconnu : ${reason} — motifs possibles : ${MOTIFS_RETOUR.join(", ")}`);
  if (resolution && !RESOLUTIONS.includes(resolution))
    throw new Error(`résolution inconnue : ${resolution}`);
  const rma = prochainRma();
  run(`INSERT INTO returns (rma, order_id, status, reason, resolution, requested_at, notes, items)
       VALUES (?,?,'requested',?,?,?,?,?)`,
    rma, cmd.id, reason || null, resolution || "refund", maintenant(), notes, dump(items));
  const id = one("SELECT last_insert_rowid() r").r;
  journaliser("return.create", "return", id, { rma, order_id }, userId);
  return { id, rma };
}

const STATUTS_RETOUR = ["requested", "approved", "in_transit", "received", "refunded", "rejected"];

function majRetour(id, { status, resolution, notes, shipment_id }, userId = null) {
  if (status && !STATUTS_RETOUR.includes(status)) throw new Error(`statut de retour inconnu : ${status}`);
  if (resolution && !RESOLUTIONS.includes(resolution)) throw new Error(`résolution inconnue : ${resolution}`);
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
  groupes, sauverGroupe, heritage, importerProduits, masseProduits, COLONNES_IMPORT,
  poserStock, consommerStock, stockBas,
  reconstruireClients, chercherClients,
  creerRetour, majRetour, chercherRetours, STATUTS_RETOUR, MOTIFS_RETOUR, RESOLUTIONS,
};
