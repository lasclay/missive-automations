/**
 * Le catalogue des champs exportables — et le SQL qui les produit.
 *
 * L'export ne passait plus par la grille : il rappelait `orders.chercher()` mille lignes à la
 * fois, et chaque appel refaisait le travail complet d'un écran — index de recherche, tags,
 * sous-requêtes d'articles, hydratation JSON. Sur 28 500 commandes, c'est vingt-neuf fois ce
 * travail pour produire un fichier plat. D'où « très long d'exporter ».
 *
 * Ici, une colonne est une expression SQL. On n'assemble que celles qu'on a demandées, en une
 * seule requête, et SQLite écrit directement les valeurs voulues. Ce qui coûtait des minutes
 * coûte une requête.
 *
 * Le nom EXPORTÉ est celui de ShipStation, en anglais : ces fichiers alimentent ClickShip,
 * eShipper, Dymo et les chiffriers du comptable, tous construits sur les en-têtes de
 * ShipStation. Traduire les en-têtes casserait chaque mappage en aval — c'est le seul endroit
 * de l'application où le français cède, et c'est un choix, pas un oubli.
 */

/** `sql` produit la valeur, `t` est l'en-tête écrit dans le fichier. */
const CHAMPS = {
  orders: {
    table: `orders o`,
    // Les jointures ne sont ajoutées que si un champ demandé en a besoin : exporter un numéro
    // de commande ne doit pas coûter une jointure sur les expéditions.
    jointures: {
      store: `LEFT JOIN stores st ON st.id = o.store_id`,
      warehouse: `LEFT JOIN warehouses wh ON wh.id = o.warehouse_id`,
      user: `LEFT JOIN users u ON u.id = o.assigned_user`,
      shipment: `LEFT JOIN shipments sh ON sh.id = (
        SELECT s2.id FROM shipments s2 WHERE s2.order_id = o.id AND s2.voided = 0
        ORDER BY s2.id DESC LIMIT 1)`,
    },
    champs: {
      order_number:      { t: "Order - Number",            sql: "o.order_number" },
      order_date:        { t: "Order - Date",              sql: "o.order_date" },
      order_status:      { t: "Order - Status",            sql: "o.status" },
      paid_date:         { t: "Order - Paid Date",         sql: "o.paid_at" },
      ship_by_date:      { t: "Order - Ship By Date",      sql: "o.ship_by_date" },
      order_source:      { t: "Order - Source",            sql: "o.source" },
      store_name:        { t: "Order - Store",             sql: "st.name", j: ["store"] },
      requested_service: { t: "Order - Requested Service", sql: "o.requested_service" },
      customer_notes:    { t: "Order - Customer Notes",    sql: "o.customer_notes" },
      internal_notes:    { t: "Order - Internal Notes",    sql: "o.internal_notes" },
      gift:              { t: "Order - Gift",              sql: "CASE WHEN o.gift THEN 'Yes' ELSE 'No' END" },
      gift_message:      { t: "Order - Gift Message",      sql: "o.gift_message" },
      custom_field1:     { t: "Order - Custom Field 1",    sql: "o.custom_field1" },
      custom_field2:     { t: "Order - Custom Field 2",    sql: "o.custom_field2" },
      custom_field3:     { t: "Order - Custom Field 3",    sql: "o.custom_field3" },
      assigned_to:       { t: "Order - Assigned To",       sql: "u.name", j: ["user"] },

      amount_order_total:    { t: "Amount - Order Total",     sql: "ROUND(o.order_total,2)" },
      amount_order_subtotal: { t: "Amount - Order Subtotal",  sql: "ROUND(o.order_total - o.tax_amount - o.shipping_paid,2)" },
      amount_order_tax:      { t: "Amount - Order Tax",       sql: "ROUND(o.tax_amount,2)" },
      amount_order_shipping: { t: "Amount - Order Shipping",  sql: "ROUND(o.shipping_paid,2)" },
      amount_paid_by_customer: { t: "Amount - Paid by Customer", sql: "ROUND(o.amount_paid,2)" },
      amount_shipping_cost:  { t: "Amount - Shipping Cost",    sql: "ROUND(COALESCE(sh.cost,0),2)", j: ["shipment"] },

      recipient_name:    { t: "Recipient - Name",     sql: "json_extract(o.ship_to,'$.name')" },
      recipient_company: { t: "Recipient - Company",  sql: "json_extract(o.ship_to,'$.company')" },
      recipient_street1: { t: "Recipient - Address 1", sql: "json_extract(o.ship_to,'$.street1')" },
      recipient_street2: { t: "Recipient - Address 2", sql: "json_extract(o.ship_to,'$.street2')" },
      recipient_city:    { t: "Recipient - City",     sql: "json_extract(o.ship_to,'$.city')" },
      recipient_state:   { t: "Recipient - State",    sql: "json_extract(o.ship_to,'$.state')" },
      recipient_postal:  { t: "Recipient - Postal Code", sql: "json_extract(o.ship_to,'$.postalCode')" },
      recipient_country: { t: "Recipient - Country",  sql: "json_extract(o.ship_to,'$.country')" },
      recipient_phone:   { t: "Recipient - Phone",    sql: "json_extract(o.ship_to,'$.phone')" },
      recipient_email:   { t: "Recipient - Email",    sql: "o.customer_email" },
      residential:       { t: "Recipient - Residential", sql: "CASE WHEN json_extract(o.ship_to,'$.residential') THEN 'Yes' ELSE 'No' END" },

      weight_g:   { t: "Weight - Grams",  sql: "ROUND(o.weight_g,1)" },
      weight_oz:  { t: "Weight - Ounces", sql: "ROUND(o.weight_g / 28.3495, 2)" },
      weight_lb:  { t: "Weight - Pounds", sql: "ROUND(o.weight_g / 453.592, 3)" },
      length_in:  { t: "Dimensions - Length", sql: "json_extract(o.dimensions,'$.length')" },
      width_in:   { t: "Dimensions - Width",  sql: "json_extract(o.dimensions,'$.width')" },
      height_in:  { t: "Dimensions - Height", sql: "json_extract(o.dimensions,'$.height')" },

      carrier:      { t: "Shipping - Carrier",   sql: "o.carrier_code" },
      service:      { t: "Shipping - Service",   sql: "o.service_id" },
      package:      { t: "Shipping - Package",   sql: "o.package_id" },
      confirmation: { t: "Shipping - Confirmation", sql: "o.confirmation" },
      warehouse:    { t: "Shipping - Ship From",  sql: "wh.name", j: ["warehouse"] },
      insurance:    { t: "Shipping - Insured Value", sql: "json_extract(o.insurance,'$.montant')" },

      tracking_number: { t: "Shipment - Tracking Number", sql: "sh.tracking_number", j: ["shipment"] },
      ship_date:       { t: "Shipment - Ship Date",       sql: "sh.ship_date",       j: ["shipment"] },
      shipped_carrier: { t: "Shipment - Carrier",         sql: "sh.carrier_code",    j: ["shipment"] },
      shipped_service: { t: "Shipment - Service",         sql: "sh.service_id",      j: ["shipment"] },
      drop_off:        { t: "Shipment - Drop-Off",        sql: "CASE WHEN sh.drop_off THEN 'Yes' ELSE 'No' END", j: ["shipment"] },

      item_count: { t: "Items - Count",
        sql: "(SELECT COALESCE(SUM(i.quantity),0) FROM order_items i WHERE i.order_id = o.id AND i.adjustment = 0)" },
      item_skus:  { t: "Items - SKUs",
        sql: "(SELECT group_concat(i.sku, ' | ') FROM order_items i WHERE i.order_id = o.id AND i.adjustment = 0)" },
      item_names: { t: "Items - Names",
        sql: "(SELECT group_concat(i.name, ' | ') FROM order_items i WHERE i.order_id = o.id AND i.adjustment = 0)" },
      tags: { t: "Order - Tags",
        sql: "(SELECT group_concat(t.name, ' | ') FROM order_tags ot JOIN tags t ON t.id = ot.tag_id WHERE ot.order_id = o.id)" },
    },
    /** Ce qu'on exporte quand personne n'a rien choisi : la vue courante de la grille. */
    defaut: ["order_number", "order_date", "order_status", "recipient_name", "recipient_city",
      "recipient_state", "recipient_country", "weight_g", "amount_order_total", "requested_service"],
  },

  "order-items": {
    table: `order_items i JOIN orders o ON o.id = i.order_id`,
    jointures: { store: `LEFT JOIN stores st ON st.id = o.store_id` },
    filtreFixe: "i.adjustment = 0",
    champs: {
      order_number: { t: "Order - Number", sql: "o.order_number" },
      order_date:   { t: "Order - Date",   sql: "o.order_date" },
      order_status: { t: "Order - Status", sql: "o.status" },
      store_name:   { t: "Order - Store",  sql: "st.name", j: ["store"] },
      sku:          { t: "Item - SKU",     sql: "i.sku" },
      name:         { t: "Item - Name",    sql: "i.name" },
      quantity:     { t: "Item - Quantity", sql: "i.quantity" },
      unit_price:   { t: "Item - Unit Price", sql: "ROUND(i.unit_price,2)" },
      line_total:   { t: "Item - Line Total", sql: "ROUND(i.unit_price * i.quantity,2)" },
      item_weight:  { t: "Item - Weight (g)", sql: "ROUND(i.weight_g,1)" },
      location:     { t: "Item - Warehouse Location", sql: "i.warehouse_location" },
      upc:          { t: "Item - UPC",     sql: "i.upc" },
      recipient_name:    { t: "Recipient - Name",    sql: "json_extract(o.ship_to,'$.name')" },
      recipient_city:    { t: "Recipient - City",    sql: "json_extract(o.ship_to,'$.city')" },
      recipient_country: { t: "Recipient - Country", sql: "json_extract(o.ship_to,'$.country')" },
    },
    defaut: ["order_number", "order_date", "sku", "name", "quantity", "unit_price", "item_weight", "order_status"],
  },
};

/**
 * Assemble la requête. `colonnes` est la liste de clés voulues, dans l'ordre voulu — l'ordre
 * du fichier est celui que l'opérateur a construit, pas celui du catalogue.
 */
function requete(jeu, colonnes, { where = [], params = [], limite = 60000 } = {}) {
  const def = CHAMPS[jeu];
  if (!def) throw new Error(`jeu d'export inconnu : ${jeu}`);
  const cles = (colonnes && colonnes.length ? colonnes : def.defaut)
    .filter((c) => def.champs[c]);
  if (!cles.length) throw new Error("aucune colonne exportable retenue");

  // Une jointure n'est posée que si une colonne demandée en dépend.
  const besoins = new Set();
  for (const c of cles) for (const j of def.champs[c].j || []) besoins.add(j);
  const jointures = [...besoins].map((j) => def.jointures[j]).filter(Boolean).join("\n    ");

  const select = cles.map((c) => `${def.champs[c].sql} AS ${JSON.stringify(def.champs[c].t)}`).join(",\n         ");
  const conditions = [...(def.filtreFixe ? [def.filtreFixe] : []), ...where];

  return {
    sql: `SELECT ${select}
      FROM ${def.table}
      ${jointures}
      ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT ${Number(limite) || 60000}`,
    params,
    entetes: cles.map((c) => def.champs[c].t),
  };
}

/** Le catalogue tel que l'écran le présente : groupé par préfixe, comme chez ShipStation. */
function catalogue(jeu) {
  const def = CHAMPS[jeu];
  if (!def) return [];
  return Object.entries(def.champs).map(([cle, c]) => ({
    cle, titre: c.t, groupe: (c.t.split(" - ")[0] || "Autre").trim(),
  }));
}

module.exports = { CHAMPS, requete, catalogue, jeux: () => Object.keys(CHAMPS) };
