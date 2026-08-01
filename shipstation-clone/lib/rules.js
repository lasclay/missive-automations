/**
 * Moteur d'automatisation — spécification SHIPSTATIONSPECLASCLAY §12.
 *
 * Une règle = un filtre + une liste ordonnée d'actions, exécutée à l'import.
 *
 * Trois choses que ShipStation fait mal et qui sont corrigées ici :
 *
 * 1. **Sémantique multi-articles** (exigence D1, la demande communautaire la plus ancienne).
 *    Chez ShipStation, un critère `ItemSku Contains X` sur une commande de cinq articles ne dit
 *    pas s'il faut qu'un article corresponde, que tous correspondent, ou que seuls ceux-là
 *    soient présents. Ici, chaque critère d'article déclare sa portée : `any`, `all`, `only`,
 *    `none`.
 * 2. **Combinaison des critères** (§12.3) : colonnes différentes = ET, valeurs d'un même
 *    critère = OU, et — c'est le point subtil — deux critères sur la **même colonne** = OU.
 *    Sans cette dernière règle, la vue « QC-ON » serait vide.
 * 3. **Ordre d'exécution et état mutant** (§12.3, piège critique). Le filtre s'évalue sur
 *    l'état **courant** de la commande, donc sur ce que les règles précédentes ont écrit.
 *    C'est explicite ici, et `dryRun` le montre.
 */
const { all, one, run, parse, dump, maintenant, journaliser } = require("./db");
const orders = require("./orders");
const criteres = require("./criteres");

// Le langage de filtre est celui de `criteres.js` — partagé avec les vues sauvegardées, pour
// qu'une règle et une vue qui décrivent la même chose sélectionnent exactement les mêmes
// commandes. ShipStation a deux moteurs distincts ; c'est une source d'écarts constante.
const { CHAMPS, OPERATEURS, PORTEES, vals, evaluerCritere: evaluerCondition } = criteres;

const txt = (v) => String(v ?? "").toLowerCase();

/**
 * Une règle s'applique si son filtre est satisfait.
 *
 * Combinaison (§12.3) : critères regroupés par colonne et par portée ; OU dans un groupe,
 * ET entre les groupes. `match_all: false` bascule le tout en OU global.
 *
 * Sans condition, une règle ne s'applique qu'avec `sans_condition: true` — l'équivalent
 * explicite du filtre vide de la règle 1 de Lasclay (« Default Confirmation », qui vise
 * bien toutes les commandes). Rendre ce cas explicite évite qu'une règle mal saisie
 * s'applique silencieusement à tout l'arriéré.
 */
function correspond(cmd, regle) {
  const conds = Array.isArray(regle.conditions) ? regle.conditions : (parse(regle.conditions, []) || []);
  if (!conds.length) return regle.sans_condition === true || regle.sans_condition === 1;
  return criteres.evaluer(cmd, conds, regle.match_all !== 0 && regle.match_all !== false);
}

// ------------------------------------------------------------------ actions

/** Actions. Les sept réellement utilisées par Lasclay sont marquées d'un astérisque. */
const ACTIONS = {
  // * Set Carrier/Service/Package
  set_service: (cmd, v) => {
    const o = typeof v === "string" ? { service_id: v } : (v || {});
    run(`UPDATE orders SET carrier_code = COALESCE(?, carrier_code),
         service_id = COALESCE(?, service_id), package_id = COALESCE(?, package_id) WHERE id = ?`,
      o.carrier_code ?? null, o.service_id ?? null, o.package_id ?? null, cmd.id);
  },
  // * Request Confirmation (0 aucune, 1 livraison, 2 signature, 5 Do Not Safe Drop)
  set_confirmation: (cmd, v) => run("UPDATE orders SET confirmation = ? WHERE id = ?", String(v), cmd.id),
  // * Set Ship From Location
  set_warehouse: (cmd, v) => run("UPDATE orders SET warehouse_id = ? WHERE id = ?", Number(v), cmd.id),
  // * Set Custom Field 1 / 2 / 3
  set_custom_field1: (cmd, v) => run("UPDATE orders SET custom_field1 = ? WHERE id = ?", String(v), cmd.id),
  set_custom_field2: (cmd, v) => run("UPDATE orders SET custom_field2 = ? WHERE id = ?", String(v), cmd.id),
  set_custom_field3: (cmd, v) => run("UPDATE orders SET custom_field3 = ? WHERE id = ?", String(v), cmd.id),
  // * Send an email (mise en file — l'envoi dépend du transport configuré)
  email: (cmd, v) => {
    const o = typeof v === "string" ? { to: v } : (v || {});
    run(`INSERT INTO notifications (kind, order_id, recipient, subject, body, status)
         VALUES ('rule', ?, ?, ?, ?, 'queued')`,
      cmd.id, o.to || null, o.subject || `Commande ${cmd.order_number}`,
      o.template ? `[gabarit ${o.template}]` : (o.body || ""));
  },
  // Arrêt du chaînage — primitive qui rend l'ordre des règles maîtrisable
  stop: () => {},

  set_package: (cmd, v) => run("UPDATE orders SET package_id = ? WHERE id = ?", String(v), cmd.id),
  set_weight: (cmd, v) => run("UPDATE orders SET weight_g = ? WHERE id = ?", Number(v), cmd.id),
  adjust_weight: (cmd, v) => run("UPDATE orders SET weight_g = COALESCE(weight_g,0) + ? WHERE id = ?", Number(v), cmd.id),
  set_dimensions: (cmd, v) => run("UPDATE orders SET dimensions = ? WHERE id = ?", dump(v), cmd.id),
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
  internal_note: (cmd, v) => run(
    "UPDATE orders SET internal_notes = TRIM(COALESCE(internal_notes,'') || char(10) || ?) WHERE id = ?", String(v), cmd.id),
  set_ship_by_date: (cmd, v) => run("UPDATE orders SET ship_by_date = ? WHERE id = ?", String(v), cmd.id),
  set_customs_content: (cmd, v) => {
    const d = parse(one("SELECT customs FROM orders WHERE id = ?", cmd.id).customs, {}) || {};
    run("UPDATE orders SET customs = ? WHERE id = ?", dump({ ...d, contents: String(v) }), cmd.id);
  },
  set_non_delivery: (cmd, v) => {
    const d = parse(one("SELECT customs FROM orders WHERE id = ?", cmd.id).customs, {}) || {};
    run("UPDATE orders SET customs = ? WHERE id = ?", dump({ ...d, nonDelivery: String(v) }), cmd.id);
  },
  rate_shop: (cmd, v) => run("UPDATE orders SET carrier_code = NULL, service_id = NULL WHERE id = ?", cmd.id),
  /** Scission automatique par SKU — l'auto-split. */
  split_by_sku: (cmd, v) => {
    const cibles = cmd.items.filter((i) => !i.adjustment && txt(i.sku).includes(txt(v)));
    const autres = cmd.items.filter((i) => !i.adjustment && !cibles.includes(i));
    if (cibles.length && autres.length) orders.scinder(cmd.id, cibles.map((i) => i.id));
  },
};

// ---------------------------------------------------------------- exécution

/**
 * Applique les règles actives à une commande, dans l'ordre.
 *
 * Le filtre s'évalue sur l'état **courant** — la commande est relue avant chaque règle, donc
 * une règle voit ce que les précédentes ont écrit. C'est le comportement documenté au §12.3,
 * et c'est celui qui rend l'ordre des règles signifiant.
 *
 * `dryRun` n'écrit rien et rend le détail : quelles règles se déclenchent, avec quelles
 * actions, et laquelle arrête le chaînage (exigence D2).
 */
function appliquer(orderId, { dryRun = false } = {}) {
  const regles = all("SELECT * FROM rules WHERE enabled = 1 ORDER BY position, id");
  const declenchees = [];
  let arret = null;

  for (const r of regles) {
    const cmd = orders.parId(orderId);
    if (!cmd) break;
    if (!correspond(cmd, r)) continue;

    const actions = parse(r.actions, []) || [];
    const trace = { id: r.id, name: r.name, position: r.position, actions: [] };
    declenchees.push(trace);

    for (const a of actions) {
      const fn = ACTIONS[a.type];
      if (!fn) { trace.actions.push({ type: a.type, erreur: "action inconnue" }); continue; }
      if (dryRun) { trace.actions.push({ type: a.type, value: a.value, simule: true }); continue; }
      try { fn(cmd, a.value); trace.actions.push({ type: a.type, value: a.value, ok: true }); }
      catch (e) { trace.actions.push({ type: a.type, erreur: String(e.message) }); }
    }

    if (!dryRun) run("UPDATE rules SET run_count = run_count + 1, last_run = ? WHERE id = ?", maintenant(), r.id);
    if (actions.some((a) => a.type === "stop") || r.stop_after) { arret = r.name; break; }
  }

  if (declenchees.length && !dryRun)
    journaliser("rules.applied", "order", orderId, { regles: declenchees.map((d) => d.name), arret });
  return dryRun ? { declenchees, arret } : declenchees;
}

function appliquerLot(orderIds, opts) {
  const resultat = {};
  for (const id of orderIds) resultat[id] = appliquer(id, opts);
  return resultat;
}

// ------------------------------------------------------------------- CRUD

const hydrater = (r) => ({
  ...r, conditions: parse(r.conditions, []), actions: parse(r.actions, []),
  enabled: !!r.enabled, match_all: !!r.match_all, stop_after: !!r.stop_after,
  sans_condition: !!r.sans_condition,
  resume: (parse(r.conditions, []) || []).map(criteres.decrire),
});

const lister = () => all("SELECT * FROM rules ORDER BY position, id").map(hydrater);
const parId = (id) => { const r = one("SELECT * FROM rules WHERE id = ?", id); return r ? hydrater(r) : null; };

function sauver(r) {
  const champs = [r.name, r.enabled === false ? 0 : 1, r.position || 0, r.match_all === false ? 0 : 1,
    dump(r.conditions || []), dump(r.actions || []), r.stop_after ? 1 : 0, r.sans_condition ? 1 : 0];
  if (r.id) {
    run(`UPDATE rules SET name=?, enabled=?, position=?, match_all=?, conditions=?, actions=?, stop_after=?, sans_condition=? WHERE id=?`, ...champs, r.id);
    return r.id;
  }
  // Le nom fait foi : réamorcer ne doit pas créer un doublon de « Default Confirmation ».
  const existante = one("SELECT id FROM rules WHERE name = ?", r.name);
  if (existante) {
    run(`UPDATE rules SET enabled=?, position=?, match_all=?, conditions=?, actions=?, stop_after=?, sans_condition=? WHERE id=?`,
      ...champs.slice(1), existante.id);
    return existante.id;
  }
  run(`INSERT INTO rules (name,enabled,position,match_all,conditions,actions,stop_after,sans_condition) VALUES (?,?,?,?,?,?,?,?)`, ...champs);
  return one("SELECT last_insert_rowid() r").r;
}

const supprimer = (id) => run("DELETE FROM rules WHERE id = ?", id);

/** Réordonnancement par glisser-déposer : la liste d'identifiants donne les positions. */
function reordonner(ids) {
  ids.forEach((id, i) => run("UPDATE rules SET position = ? WHERE id = ?", i + 1, Number(id)));
  journaliser("rules.reordered", "system", null, { ids });
}

/**
 * Jeu de règles de départ = la configuration réelle de Lasclay (§12.4), pas un exemple.
 * Chargé depuis `lasclay.js` pour que l'amorçage et la migration disent la même chose.
 */
const reglesParDefaut = () => require("./lasclay").REGLES;

module.exports = {
  CHAMPS, OPERATEURS, ACTIONS, PORTEES,
  appliquer, appliquerLot, correspond, evaluerCondition, vals,
  lister, parId, sauver, supprimer, reordonner, reglesParDefaut,
};
