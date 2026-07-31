/**
 * Moteur d'automatisation — la logique SI/ALORS de ShipStation.
 *
 * Des conditions identifient les commandes, des actions leur sont appliquées à l'import.
 * Les règles sont ordonnées et chaînables : une règle voit le résultat des précédentes,
 * ce qui est le comportement de ShipStation et ce qui les rend réellement utiles.
 *
 * La règle qui compte chez Lasclay : « poids < 500 g → service drop-off ». C'est elle qui
 * matérialise les 33 000 $ de l'audit ; tout le reste est du confort.
 */
const { all, one, run, parse, dump, maintenant, journaliser } = require("./db");
const orders = require("./orders");

/** Champs sur lesquels une condition peut porter. */
const CHAMPS = {
  weight_g: (c) => c.weight_g || 0,
  order_total: (c) => c.order_total || 0,
  country: (c) => (c.ship_to || {}).country,
  state: (c) => (c.ship_to || {}).state,
  postal_code: (c) => (c.ship_to || {}).postalCode,
  city: (c) => (c.ship_to || {}).city,
  store_id: (c) => c.store_id,
  source: (c) => c.source,
  requested_service: (c) => c.requested_service || "",
  item_count: (c) => (c.items || []).filter((i) => !i.adjustment).reduce((s, i) => s + (i.quantity || 0), 0),
  line_count: (c) => (c.items || []).filter((i) => !i.adjustment).length,
  sku: (c) => (c.items || []).map((i) => i.sku).filter(Boolean),
  tag: (c) => (c.tags || []).map((t) => t.name),
  customer_email: (c) => c.customer_email || "",
  gift: (c) => !!c.gift,
  residential: (c) => !!(c.ship_to || {}).residential,
  custom_field1: (c) => c.custom_field1 || "",
  custom_field2: (c) => c.custom_field2 || "",
  custom_field3: (c) => c.custom_field3 || "",
};

/** Opérateurs. `contient`/`dans` acceptent aussi un champ multivalué (sku, tag). */
const OPERATEURS = {
  egal: (a, b) => (Array.isArray(a) ? a.includes(b) : String(a) === String(b)),
  different: (a, b) => !OPERATEURS.egal(a, b),
  contient: (a, b) => (Array.isArray(a) ? a.some((v) => String(v).toLowerCase().includes(String(b).toLowerCase()))
    : String(a).toLowerCase().includes(String(b).toLowerCase())),
  commence_par: (a, b) => (Array.isArray(a) ? a.some((v) => String(v).startsWith(b)) : String(a).startsWith(b)),
  inferieur: (a, b) => Number(a) < Number(b),
  inferieur_egal: (a, b) => Number(a) <= Number(b),
  superieur: (a, b) => Number(a) > Number(b),
  superieur_egal: (a, b) => Number(a) >= Number(b),
  entre: (a, b) => Number(a) >= Number(b[0]) && Number(a) <= Number(b[1]),
  dans: (a, b) => (Array.isArray(a) ? a.some((v) => b.includes(v)) : b.includes(a)),
  vide: (a) => a === null || a === undefined || a === "" || (Array.isArray(a) && !a.length),
  non_vide: (a) => !OPERATEURS.vide(a),
  vrai: (a) => a === true,
  faux: (a) => a === false,
};

/** Actions applicables. Chacune reçoit la commande hydratée et son paramètre. */
const ACTIONS = {
  set_service: (cmd, v) => run("UPDATE orders SET carrier_code = ?, service_id = ? WHERE id = ?",
    v.carrier_code || null, v.service_id || v, cmd.id),
  set_package: (cmd, v) => run("UPDATE orders SET package_id = ? WHERE id = ?", v, cmd.id),
  set_confirmation: (cmd, v) => run("UPDATE orders SET confirmation = ? WHERE id = ?", v, cmd.id),
  set_warehouse: (cmd, v) => run("UPDATE orders SET warehouse_id = ? WHERE id = ?", Number(v), cmd.id),
  set_weight: (cmd, v) => run("UPDATE orders SET weight_g = ? WHERE id = ?", Number(v), cmd.id),
  set_insurance: (cmd, v) => run("UPDATE orders SET insurance = ? WHERE id = ?", dump(v), cmd.id),
  add_tag: (cmd, v) => {
    const t = one("SELECT id FROM tags WHERE name = ? OR id = ?", String(v), Number(v) || -1);
    if (t) orders.ajouterTag(cmd.id, t.id);
  },
  remove_tag: (cmd, v) => {
    const t = one("SELECT id FROM tags WHERE name = ? OR id = ?", String(v), Number(v) || -1);
    if (t) orders.retirerTag(cmd.id, t.id);
  },
  assign_user: (cmd, v) => orders.assigner(cmd.id, v),
  hold_until: (cmd, v) => orders.hold(cmd.id, v),
  set_custom_field: (cmd, v) => orders.poserChamps(cmd.id, v),
  set_internal_notes: (cmd, v) => run("UPDATE orders SET internal_notes = ? WHERE id = ?", String(v), cmd.id),
  /** Rate Shopper : marque la commande pour cotation automatique à l'achat. */
  rate_shop: (cmd, v) => run("UPDATE orders SET service_id = NULL, carrier_code = NULL, internal_notes = COALESCE(internal_notes,'') || ? WHERE id = ?",
    `\n[rate_shop:${typeof v === "string" ? v : "moins_cher"}]`, cmd.id),
  /** Scission automatique par SKU — l'auto-split de ShipStation. */
  split_by_sku: (cmd, v) => {
    const cibles = cmd.items.filter((i) => !i.adjustment && String(i.sku || "").includes(String(v)));
    const autres = cmd.items.filter((i) => !cibles.includes(i));
    if (cibles.length && autres.length) orders.scinder(cmd.id, cibles.map((i) => i.id));
  },
};

// ------------------------------------------------------------------ évaluation

function evaluerCondition(cmd, cond) {
  const lecteur = CHAMPS[cond.field];
  if (!lecteur) return false;
  const op = OPERATEURS[cond.op];
  if (!op) return false;
  return !!op(lecteur(cmd), cond.value);
}

function correspond(cmd, regle) {
  const conds = parse(regle.conditions, []) || [];
  if (!conds.length) return false;                       // une règle sans condition ne s'applique jamais
  return regle.match_all ? conds.every((c) => evaluerCondition(cmd, c))
    : conds.some((c) => evaluerCondition(cmd, c));
}

/**
 * Applique les règles actives à une commande, dans l'ordre. Renvoie la liste des règles
 * déclenchées — utile pour expliquer à l'utilisateur pourquoi une commande a tel service.
 */
function appliquer(orderId, { dryRun = false } = {}) {
  const regles = all("SELECT * FROM rules WHERE enabled = 1 ORDER BY position, id");
  const declenchees = [];
  for (const r of regles) {
    let cmd = orders.parId(orderId);                     // relu à chaque règle : les règles se chaînent
    if (!cmd) break;
    if (!correspond(cmd, r)) continue;
    declenchees.push({ id: r.id, name: r.name, actions: [] });
    if (!dryRun) {
      for (const a of parse(r.actions, []) || []) {
        const fn = ACTIONS[a.type];
        if (!fn) { declenchees.at(-1).actions.push({ type: a.type, erreur: "action inconnue" }); continue; }
        try { fn(cmd, a.value); declenchees.at(-1).actions.push({ type: a.type, ok: true }); }
        catch (e) { declenchees.at(-1).actions.push({ type: a.type, erreur: String(e.message) }); }
      }
      run("UPDATE rules SET run_count = run_count + 1, last_run = ? WHERE id = ?", maintenant(), r.id);
    } else {
      declenchees.at(-1).actions = parse(r.actions, []) || [];
    }
    if (r.stop_after) break;
  }
  if (declenchees.length && !dryRun)
    journaliser("rules.applied", "order", orderId, { regles: declenchees.map((d) => d.name) });
  return declenchees;
}

/** Passe les règles sur un lot de commandes — l'application à l'import, ou en rattrapage. */
function appliquerLot(orderIds, opts) {
  const resultat = {};
  for (const id of orderIds) resultat[id] = appliquer(id, opts);
  return resultat;
}

// ------------------------------------------------------------------ CRUD

const lister = () => all("SELECT * FROM rules ORDER BY position, id")
  .map((r) => ({ ...r, conditions: parse(r.conditions, []), actions: parse(r.actions, []), enabled: !!r.enabled, match_all: !!r.match_all, stop_after: !!r.stop_after }));

function sauver(r) {
  const champs = [r.name, r.enabled === false ? 0 : 1, r.position || 0, r.match_all === false ? 0 : 1,
    dump(r.conditions || []), dump(r.actions || []), r.stop_after ? 1 : 0];
  if (r.id) {
    run(`UPDATE rules SET name=?, enabled=?, position=?, match_all=?, conditions=?, actions=?, stop_after=? WHERE id=?`,
      ...champs, r.id);
    return r.id;
  }
  run(`INSERT INTO rules (name,enabled,position,match_all,conditions,actions,stop_after) VALUES (?,?,?,?,?,?,?)`, ...champs);
  return one("SELECT last_insert_rowid() r").r;
}

const supprimer = (id) => run("DELETE FROM rules WHERE id = ?", id);

/**
 * Règles de départ, tirées de l'usage réel relevé dans l'audit. La première est celle
 * qui porte l'économie ; les autres reproduisent des habitudes observées sur le compte.
 */
function reglesParDefaut() {
  return [
    { name: "Drop-off sous 500 g", position: 10, match_all: true,
      conditions: [{ field: "weight_g", op: "inferieur", value: 500 },
                   { field: "weight_g", op: "superieur", value: 0 },
                   { field: "country", op: "egal", value: "CA" }],
      actions: [{ type: "set_service", value: { carrier_code: "canada_post", service_id: "cp_expedited_dropoff" } }] },
    { name: "Marque LASCLAY sur toutes les commandes", position: 20, match_all: true,
      conditions: [{ field: "custom_field3", op: "vide" }],
      actions: [{ type: "set_custom_field", value: { custom_field3: "LASCLAY" } }] },
    { name: "Marquer le flux USA", position: 30, match_all: true,
      conditions: [{ field: "country", op: "egal", value: "US" }],
      actions: [{ type: "set_custom_field", value: { custom_field2: "USA" } }] },
    { name: "Entrepôt par défaut : LAS Capucins", position: 40, match_all: true,
      conditions: [{ field: "store_id", op: "non_vide" }],
      actions: [{ type: "set_warehouse", value: 153232 }] },
    { name: "Signature au-delà de 300 $", position: 50, match_all: true,
      conditions: [{ field: "order_total", op: "superieur", value: 300 }],
      actions: [{ type: "set_confirmation", value: "signature" }] },
  ];
}

module.exports = {
  CHAMPS, OPERATEURS, ACTIONS, appliquer, appliquerLot, correspond, evaluerCondition,
  lister, sauver, supprimer, reglesParDefaut,
};
