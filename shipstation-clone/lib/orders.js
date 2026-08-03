/**
 * Commandes — le module central.
 *
 * Couvre ce que fait l'onglet Orders de ShipStation : recherche et filtres cumulables,
 * tri, statuts, Hold, assignation, tags, scission (split), fusion (combine), alertes,
 * champs personnalisés, et l'upsert par clé externe utilisé par l'ingestion.
 */
const { all, one, run, tx, parse, dump, maintenant, plier, sansAccent, journaliser } = require("./db");

const STATUTS = ["awaiting_payment", "awaiting_shipment", "pending_fulfillment", "shipped", "on_hold", "cancelled"];

// ------------------------------------------------------------------ lecture

/**
 * Colonnes triables — BUG-036.
 *
 * Sept en-têtes sur douze réagissaient au survol et ne triaient rien : le curseur promettait
 * un tri qui n'existait pas. Plutôt que de retirer l'affordance, on l'honore — ShipStation
 * trie sur les douze. Les colonnes qui portent sur les articles ou les étiquettes trient sur
 * une expression, pas sur une colonne : c'est ce qui manquait pour qu'elles existent.
 */
const TRIABLE = new Map([
  ["order_number", "o.order_number"], ["order_date", "o.order_date"],
  ["created_at", "o.created_at"], ["status", "o.status"],
  ["customer_name", "o.customer_name"], ["order_total", "o.order_total"],
  ["weight_g", "o.weight_g"], ["ship_by_date", "o.ship_by_date"],
  ["hold_until", "o.hold_until"], ["age", "o.order_date"],
  ["amount_paid", "o.amount_paid"], ["requested_service", "o.requested_service"],
  ["quantity", "(SELECT COALESCE(SUM(i.quantity),0) FROM order_items i WHERE i.order_id = o.id AND i.adjustment = 0)"],
  ["item_sku", "(SELECT MIN(i.sku) FROM order_items i WHERE i.order_id = o.id AND i.adjustment = 0)"],
  ["item_name", "(SELECT MIN(i.name) FROM order_items i WHERE i.order_id = o.id AND i.adjustment = 0)"],
  ["batch", "o.batch_id"],
  ["gift", "o.gift"],
  ["notes", "(CASE WHEN COALESCE(o.customer_notes,'') <> '' OR COALESCE(o.internal_notes,'') <> '' " +
            "OR COALESCE(o.gift_message,'') <> '' THEN 1 ELSE 0 END)"],
  ["tags", "(SELECT COUNT(*) FROM order_tags t WHERE t.order_id = o.id)"],
]);

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
  // Boutique et étiquette acceptent plusieurs valeurs : chez Lasclay « Shopify OU Etsy »
  // est un cas quotidien, et le filtre mono-valeur obligeait à faire deux passes. Une liste
  // au même endroit = OU, comme le fait déjà le moteur de critères des vues.
  const liste = (v) => (Array.isArray(v) ? v : String(v).split(","))
    .map((x) => String(x).trim()).filter(Boolean);
  if (f.store_id) {
    const l = liste(f.store_id).map(Number).filter(Boolean);
    if (l.length === 1) add("o.store_id = ?", l[0]);
    else if (l.length) add(`o.store_id IN (${l.map(() => "?").join(",")})`, ...l);
  }
  if (f.warehouse_id) add("o.warehouse_id = ?", Number(f.warehouse_id));
  if (f.country) add("json_extract(o.ship_to,'$.country') = ?", f.country);
  if (f.state) add("json_extract(o.ship_to,'$.state') = ?", f.state);
  if (f.carrier_code) add("o.carrier_code = ?", f.carrier_code);
  if (f.service_id) add("o.service_id = ?", f.service_id);
  if (f.assigned_user) add("o.assigned_user = ?", f.assigned_user);
  // « Non assignée » manquait : c'est pourtant la file de travail par défaut d'un poste
  // d'emballage — ce que personne n'a encore pris.
  if (f.non_assignee) add("(o.assigned_user IS NULL OR o.assigned_user = '')");
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
  if (f.tag_id) {
    const l = liste(f.tag_id).map(Number).filter(Boolean);
    if (l.length) add(
      `EXISTS (SELECT 1 FROM order_tags t WHERE t.order_id = o.id AND t.tag_id IN (${l.map(() => "?").join(",")}))`, ...l);
  }
  if (f.untagged) add("NOT EXISTS (SELECT 1 FROM order_tags t WHERE t.order_id = o.id)");
  if (f.sku) add("EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND sansaccent(COALESCE(i.sku,'')) LIKE ?)", `%${sansAccent(f.sku)}%`);
  // Champs de la recherche avancée — chacun cherche « contient », et ils se cumulent.
  // Sans eux, « les commandes annulées de LAS Etsy contenant des mitaines » était hors de
  // portée : le clone n'offrait que six des dix champs de ShipStation.
  if (f.order_number) add("sansaccent(COALESCE(o.order_number,'')) LIKE ?", `%${sansAccent(f.order_number)}%`);
  if (f.destinataire) add("sansaccent(COALESCE(o.customer_name,'')) LIKE ?", `%${sansAccent(f.destinataire)}%`);
  if (f.courriel) add("sansaccent(COALESCE(o.customer_email,'')) LIKE ?", `%${sansAccent(f.courriel)}%`);
  if (f.item_name) add(
    "EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND sansaccent(COALESCE(i.name,'')) LIKE ?)",
    `%${sansAccent(f.item_name)}%`);
  if (f.item_option) add(
    "EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND sansaccent(COALESCE(i.options,'')) LIKE ?)",
    `%${sansAccent(f.item_option)}%`);
  if (f.single_item) add("(SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id AND i.adjustment = 0) = 1");
  if (f.batch_id) add("o.batch_id = ?", Number(f.batch_id));
  if (f.sans_lot) add("o.batch_id IS NULL");

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

  /**
   * Recherche libre — sur l'index plié (`orders.recherche`), mot à mot.
   *
   * Trois défauts corrigés d'un coup. Les accents : `lower('Josee') LIKE '%josée%'` est
   * faux, donc chercher « josée ferland » ne trouvait jamais « Josee Ferland » — que
   * ShipStation, lui, trouvait. Les mots multiples : « josée ferland » était un seul motif
   * contigu, et « Ferland, Josée » n'y répondait pas. Et la portée : le suivi, le nom
   * d'article, l'adresse et les notes n'étaient pas cherchés du tout.
   *
   * Chaque mot doit être présent (ET), n'importe où et dans n'importe quel ordre. Un repli
   * de secours sur les colonnes brutes couvre les commandes pas encore réindexées.
   */
  if (f.q) {
    const mots = plier(f.q).split(" ").filter(Boolean).slice(0, 8);
    for (const m of mots) {
      const like = `%${m}%`;
      add(`(o.recherche LIKE ?
            OR (o.recherche IS NULL AND (lower(o.order_number) LIKE ? OR lower(o.customer_name) LIKE ?
                OR lower(o.customer_email) LIKE ?)))`,
        like, like, like, like);
    }
  }

  const where = w.length ? "WHERE " + w.join(" AND ") : "";
  const tri = TRIABLE.has(f.sort) ? f.sort : "order_date";
  const col = TRIABLE.get(tri);
  // « âge décroissant » = les plus vieilles d'abord = date croissante. On inverse pour
  // que l'interface parle d'âge sans que l'utilisateur ait à y penser.
  const sens = (f.dir === "asc") === (tri === "age") ? "DESC" : "ASC";
  const limite = Math.min(Number(f.limit) || 200, 1000);
  const offset = Number(f.offset) || 0;

  const total = one(`SELECT COUNT(*) n FROM orders o ${where}`, ...p).n;
  // Les colonnes « Rate », « Ship Date » et « Fulfillment Status » de ShipStation lisent
  // l'expédition, pas la commande. Trois sous-requêtes corrélées valent mieux qu'un aller-
  // retour par ligne : à 1 000 lignes, la boucle côté application coûterait 3 000 requêtes.
  const lignes = all(
    `SELECT o.*, CAST(julianday('now') - julianday(o.order_date) AS INTEGER) AS age,
            (SELECT s.cost FROM shipments s WHERE s.order_id = o.id AND s.voided = 0
               ORDER BY s.id DESC LIMIT 1) AS ship_cost,
            (SELECT s.ship_date FROM shipments s WHERE s.order_id = o.id AND s.voided = 0
               ORDER BY s.id DESC LIMIT 1) AS ship_date,
            (SELECT COUNT(*) FROM shipments s WHERE s.order_id = o.id AND s.voided = 0) AS n_shipments
     FROM orders o ${where} ORDER BY ${col} ${sens} LIMIT ? OFFSET ?`, ...p, limite, offset);

  // Répartition par statut et par boutique — le rail gauche de ShipStation pendant une
  // recherche (« All Search Results 1 », « LAS Shopify 1 », « Shipped 1 »). Sans elle, un
  // résultat unique dans « Expédiée » se cherche à l'aveugle statut par statut. Calculée
  // seulement pendant une recherche : sur une grille ordinaire, ce sont deux agrégats de
  // plus pour rien.
  const repartition = f.q ? {
    statuts: Object.fromEntries(all(`SELECT o.status s, COUNT(*) n FROM orders o ${where} GROUP BY o.status`, ...p)
      .map((r) => [r.s, r.n])),
    boutiques: Object.fromEntries(all(`SELECT o.store_id s, COUNT(*) n FROM orders o ${where} GROUP BY o.store_id`, ...p)
      .filter((r) => r.s != null).map((r) => [r.s, r.n])),
  } : null;

  return { total, orders: lignes.map(hydrater), ...(repartition ? { repartition } : {}) };
}

/** Transforme une ligne SQL en objet utilisable (JSON décodé, articles, tags). */
function hydrater(r) {
  if (!r) return null;
  const o = {
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
  o.couts = couts(o);
  return o;
}

/**
 * Résumé des coûts — reconstitué depuis les lignes, pas déduit du total (BUG-016).
 *
 * L'ancien calcul affichait `Produits = total − taxes − livraison`. Une remise ou un
 * remboursement le rendait faux sans que rien ne le signale : 879 commandes montraient
 * `Total 0,00 $` au-dessus de lignes valorisées, et l'écart dépassait un cent sur 8 758
 * commandes. Ici les lignes sont la vérité — c'est ce que l'entrepôt a sous les yeux — et
 * ce qui ne se referme pas est **annoncé** plutôt que masqué par une soustraction.
 *
 * `coherent` est faux quand le total déclaré par la boutique s'écarte de plus d'un cent de
 * ce que les lignes, la remise, la livraison et les taxes permettent de reconstituer. Ce
 * n'est pas une erreur de calcul : c'est le signe que l'import n'a pas tout rapatrié.
 */
const CENT = 0.01;
const sou = (n) => Math.round((Number(n) || 0) * 100) / 100;

function couts(o) {
  const lignes = (o.items || []).filter((i) => !i.adjustment);
  const ajustements = (o.items || []).filter((i) => i.adjustment);
  const produits = sou(lignes.reduce((s, i) => s + (i.unit_price || 0) * (i.quantity ?? 0), 0));
  const remiseLignes = sou(lignes.reduce((s, i) => s + (i.discount || 0), 0));
  // La remise de commande l'emporte sur la somme des remises de ligne quand les deux
  // existent : Shopify alloue les remises de panier aux lignes, les additionner doublerait.
  const remise = sou(o.discount_amount || remiseLignes);
  const ajuste = sou(ajustements.reduce((s, i) => s + (i.unit_price || 0) * (i.quantity ?? 0), 0));
  const livraison = sou(o.shipping_paid);
  const taxes = sou(o.tax_amount);
  const rembourse = sou(o.refunded_amount);
  const reconstitue = sou(produits - remise + ajuste + livraison + taxes);
  const declare = sou(o.order_total);
  const ecart = sou(declare - reconstitue);

  // Une commande dont TOUTES les quantités courantes sont à zéro est entièrement
  // remboursée : total nul et lignes nulles se répondent, il n'y a rien à signaler.
  const toutRembourse = lignes.length > 0 && lignes.every((i) => (i.quantity ?? 0) === 0);

  return {
    produits, remise, ajustements: ajuste, livraison, taxes,
    total: declare, reconstitue, ecart,
    paye: sou(o.amount_paid), rembourse,
    coherent: Math.abs(ecart) <= CENT,
    tout_rembourse: toutRembourse,
    // Ce que l'opérateur doit savoir en une phrase, quand il y a quelque chose à savoir.
    motif: Math.abs(ecart) <= CENT ? null
      : declare === 0 && produits > 0
        ? "total à zéro alors que les lignes sont valorisées — remises ou remboursements non importés"
        : `le total de la boutique s'écarte de ${sou(Math.abs(ecart))} $ de la somme des lignes`,
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
      discount_amount: cmd.discount_amount || 0, refunded_amount: cmd.refunded_amount || 0,
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
      run(`INSERT INTO order_items (order_id,line_key,sku,name,image_url,quantity,quantity_ordered,
             unit_price,discount,weight_g,tax,warehouse_location,upc,product_id,adjustment,options)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, it.line_key || null, it.sku || null, it.name || null, it.image_url || null,
        it.quantity ?? 1, it.quantity_ordered ?? it.quantity ?? 1,
        it.unit_price || 0, it.discount || 0, it.weight_g || 0, it.tax || 0,
        it.warehouse_location || null, it.upc || null, it.product_id || null,
        it.adjustment ? 1 : 0, dump(it.options || []));
    }

    // Poids de la commande : celui fourni, sinon la somme des articles physiques.
    if (!champs.weight_g) {
      const s = one(`SELECT COALESCE(SUM(weight_g * quantity),0) w FROM order_items
                     WHERE order_id = ? AND adjustment = 0`, id).w;
      if (s) run("UPDATE orders SET weight_g = ? WHERE id = ?", s, id);
    }

    indexerRecherche(id);
    journaliser(existante ? "order.update" : "order.create", "order", id, { order_number: cmd.order_number });
    return id;
  });
}

/**
 * (Re)calcule l'index de recherche d'une commande.
 *
 * Tout ce sur quoi on peut vouloir retomber sur une commande finit dans une seule colonne
 * pliée : numéro, client, courriel, adresse complète, SKU, noms d'articles, numéros de
 * suivi, notes, champs personnalisés. La recherche devient alors un simple LIKE par mot,
 * insensible aux accents et à la casse.
 *
 * Appelé après l'écriture des articles — l'index les contient, il ne peut pas être calculé
 * avant qu'ils existent.
 */
function indexerRecherche(id) {
  const o = one("SELECT * FROM orders WHERE id = ?", id);
  if (!o) return;
  const adr = parse(o.ship_to, {}) || {};
  const arts = all("SELECT sku, name, upc FROM order_items WHERE order_id = ?", id);
  const suivis = all("SELECT tracking_number FROM shipments WHERE order_id = ?", id);
  const morceaux = [
    o.order_number, o.customer_name, o.customer_email,
    adr.name, adr.company, adr.street1, adr.street2, adr.city, adr.state, adr.postalCode, adr.country, adr.phone,
    o.requested_service, o.customer_notes, o.internal_notes, o.gift_message,
    o.custom_field1, o.custom_field2, o.custom_field3,
    ...arts.flatMap((a) => [a.sku, a.name, a.upc]),
    ...suivis.map((s) => s.tracking_number),
  ];
  // Sur un identifiant, les séparateurs sont cosmétiques : « L-27344 » se tape aussi
  // « l27344 », et un code postal « G8T 1A1 » se colle en « g8t1a1 ». On indexe donc les
  // deux formes — mais seulement pour les identifiants, jamais pour les noms : recoller
  // « josee ferland » en « joseeferland » n'aide personne et gonfle l'index.
  const identifiants = [o.order_number, adr.postalCode,
    ...arts.flatMap((a) => [a.sku, a.upc]), ...suivis.map((s) => s.tracking_number)];

  // Les doublons sont retirés : sur une commande de dix lignes du même produit, l'index
  // répéterait dix fois le même nom pour rien.
  const texte = [...new Set([
    ...morceaux.map(plier),
    ...identifiants.map((x) => plier(x).replace(/ /g, "")),
  ].filter(Boolean))].join(" ");
  run("UPDATE orders SET recherche = ? WHERE id = ?", texte, id);
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
    // Deux commandes sans code postal ni nom ne sont pas « le même destinataire » : elles
    // sont deux adresses inconnues. Les regrouper proposait de fusionner des commandes
    // sans rapport, ce qui est la pire suggestion possible avant un achat d'étiquette.
    fusionnables: q(`SELECT json_extract(ship_to,'$.postalCode') cp, json_extract(ship_to,'$.name') nom,
                     COUNT(*) n, GROUP_CONCAT(id) ids FROM orders
                   WHERE status = 'awaiting_shipment' AND merged_into IS NULL
                     AND json_extract(ship_to,'$.postalCode') IS NOT NULL
                     AND TRIM(json_extract(ship_to,'$.postalCode')) <> ''
                     AND json_extract(ship_to,'$.name') IS NOT NULL
                     AND TRIM(json_extract(ship_to,'$.name')) <> ''
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
  // Le panneau gauche de ShipStation déplie « À expédier » par boutique : ce sont ces
  // compteurs-là, pas ceux de toutes les commandes de la boutique.
  const parBoutique = all(`SELECT store_id, COUNT(*) n FROM orders
                           WHERE status = 'awaiting_shipment' GROUP BY store_id`);
  const a = alertes();
  return {
    statuts: parStatut,
    boutiques: Object.fromEntries(parBoutique.map((r) => [String(r.store_id), r.n])),
    alertes: Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.length])),
  };
}

/**
 * Validation d'adresse. Volontairement **non destructive** : on qualifie, on n'écrase pas.
 * ShipStation réécrit le code postal en silence (« Postal Code changed from 94305 to
 * 94305-1014 ») et l'utilisateur ne l'apprend qu'en lisant le journal d'activité. Ici le
 * verdict et ses motifs sont enregistrés, la correction reste une décision humaine.
 *
 * Retourne `{ statut: verified | warning | error, motifs: [] }`.
 */
function validerAdresse(o) {
  const a = (o && o.ship_to) || {};
  const motifs = [];
  if (!a.street1) motifs.push("adresse manquante");
  if (!a.city) motifs.push("ville manquante");
  if (!a.postalCode) motifs.push("code postal manquant");
  if (!a.country) motifs.push("pays manquant");
  const statut = motifs.length ? "error" : (() => {
    const m = [];
    // Les formats postaux CA et US sont les seuls que Lasclay expédie en volume ; ailleurs
    // on ne prétend pas savoir, on ne signale donc rien plutôt que d'inventer une erreur.
    if (a.country === "CA" && !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(String(a.postalCode).trim()))
      m.push("code postal canadien mal formé");
    if (a.country === "US" && !/^\d{5}(-\d{4})?$/.test(String(a.postalCode).trim()))
      m.push("code postal américain mal formé");
    if ((a.country === "CA" || a.country === "US") && !a.state) m.push("province ou état manquant");
    motifs.push(...m);
    return m.length ? "warning" : "verified";
  })();
  run("UPDATE orders SET ship_to = ? WHERE id = ?",
    dump({ ...a, verification: { statut, motifs, le: maintenant() } }), o.id);
  return { statut, motifs };
}

/**
 * Ampleur de la désynchronisation des montants, sur toute la base (BUG-016).
 *
 * Le SQL fait le gros du tri — 28 565 commandes ne passent pas par la mémoire — puis les
 * seules candidates sont rejouées ligne à ligne pour obtenir l'écart exact. Le chiffre
 * sert autant à mesurer les progrès d'une réconciliation qu'à décider s'il faut la lancer.
 */
function reconciliation({ limite = 200 } = {}) {
  const suspectes = all(`
    SELECT o.id, o.order_number, o.status, o.order_total, o.amount_paid, o.tax_amount,
           o.shipping_paid, o.discount_amount, o.refunded_amount,
           (SELECT COALESCE(SUM(i.unit_price * i.quantity), 0) FROM order_items i
             WHERE i.order_id = o.id AND i.adjustment = 0) AS somme_lignes
      FROM orders o
     WHERE ABS(o.order_total - o.tax_amount - o.shipping_paid + COALESCE(o.discount_amount,0)
               - (SELECT COALESCE(SUM(i.unit_price * i.quantity), 0) FROM order_items i
                    WHERE i.order_id = o.id AND i.adjustment = 0)) > 0.01
     ORDER BY o.order_date DESC`);

  const detail = suspectes.map((r) => {
    const o = parId(r.id);
    return { id: r.id, order_number: r.order_number, status: r.status, ...o.couts };
  }).filter((c) => !c.coherent && !c.tout_rembourse);

  const total = one("SELECT COUNT(*) n FROM orders").n;
  const nulles = detail.filter((c) => c.total === 0 && c.produits > 0);
  return {
    commandes: total,
    incoherentes: detail.length,
    part: total ? Math.round((detail.length / total) * 1000) / 10 : 0,
    a_expedier: detail.filter((c) => c.status === "awaiting_shipment").length,
    total_nul_lignes_valorisees: { n: nulles.length, valeur: sou(nulles.reduce((s, c) => s + c.produits, 0)) },
    ecart_cumule: sou(detail.reduce((s, c) => s + Math.abs(c.ecart), 0)),
    exemples: detail.slice(0, limite),
  };
}

module.exports = {
  indexerRecherche,
  STATUTS, chercher, parId, parNumero, hydrater, upsert, changerStatut, hold, restaurer,
  libererHolds, assigner, ajouterTag, retirerTag, poserChamps, supprimer, scinder, fusionner,
  alertes, compteurs, validerAdresse, couts, reconciliation,
};
