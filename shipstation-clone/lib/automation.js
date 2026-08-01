/**
 * Pipeline d'automatisation — les 6 couches, dans l'ordre exact de ShipStation (§3.1).
 *
 *   1. Auto-Routing         (choix de l'entrepôt d'expédition)
 *   2. Auto-Split           (scission automatique par SKU)
 *   3. Product Preset Groups (profils produit)
 *   4. Product Defaults      (défauts de la fiche produit)
 *   5. Service Mapping       (libellé du checkout → service réel)
 *   6. Automation Rules      (les 11 règles de Lasclay)
 *
 * L'ordre n'est pas cosmétique : les règles s'exécutent **en dernier** et voient donc ce que
 * les couches précédentes ont écrit. C'est ce qui permet à « Do Not Safe Drop Auto » de
 * réagir au service que le mapping vient d'attribuer.
 *
 * ShipStation ne rejoue que les couches 4, 5 et 6 sur le bouton *Reprocess Automation Rules*,
 * avec l'avertissement « This may overwrite any shipping settings that have been made since
 * the orders were imported ». Le même découpage est repris ici, en nommant explicitement ce
 * qui sera écrasé — c'est le minimum quand on rejoue de l'automatisation sur un arriéré.
 */
const { all, one, run, tx, parse, dump, journaliser } = require("./db");
const orders = require("./orders");
const rules = require("./rules");
const presets = require("./presets");
const catalog = require("./catalog");

const COUCHES = {
  routing:   { n: 1, nom: "Auto-Routing", rejouable: false },
  split:     { n: 2, nom: "Auto-Split", rejouable: false },
  groupes:   { n: 3, nom: "Product Preset Groups", rejouable: true },
  defauts:   { n: 4, nom: "Product Defaults", rejouable: true },
  mapping:   { n: 5, nom: "Service Mapping", rejouable: true },
  regles:    { n: 6, nom: "Automation Rules", rejouable: true },
};

/** 1. Auto-Routing : entrepôt par défaut si la commande n'en porte pas. */
function routing(cmd, { dryRun }) {
  if (cmd.warehouse_id) return null;
  const w = one("SELECT id, name FROM warehouses ORDER BY is_default DESC, id LIMIT 1");
  if (!w) return null;
  if (!dryRun) run("UPDATE orders SET warehouse_id = ? WHERE id = ?", w.id, cmd.id);
  return `entrepôt → ${w.name}`;
}

/** 3. Profils produit : le groupe de préréglages du premier article qui en porte un. */
function groupes(cmd, { dryRun }) {
  for (const it of (cmd.items || []).filter((i) => !i.adjustment && i.sku)) {
    const p = one("SELECT preset_group_id FROM products WHERE sku = ?", it.sku);
    if (!p || !p.preset_group_id) continue;
    const g = one("SELECT * FROM preset_groups WHERE id = ?", p.preset_group_id);
    if (!g) continue;
    const s = parse(g.settings, {}) || {};
    if (!dryRun) {
      run(`UPDATE orders SET carrier_code = COALESCE(carrier_code, ?), service_id = COALESCE(service_id, ?),
           package_id = COALESCE(package_id, ?), confirmation = COALESCE(confirmation, ?) WHERE id = ?`,
        s.carrier_code || null, s.service_id || null, s.package_id || null, s.confirmation || null, cmd.id);
    }
    return `profil produit « ${g.name} »`;
  }
  return null;
}

/** 4. Défauts produit : poids manquants et service par défaut de la fiche. */
function defauts(cmd, { dryRun }) {
  const notes = [];
  let poids = cmd.weight_g || 0;
  if (!poids) {
    poids = (cmd.items || []).filter((i) => !i.adjustment).reduce((s, i) => {
      const d = i.sku ? catalog.defautsPour(i.sku) : {};
      return s + ((i.weight_g || d.weight_g || 0) * (i.quantity || 1));
    }, 0);
    if (poids && !dryRun) run("UPDATE orders SET weight_g = ? WHERE id = ?", poids, cmd.id);
    if (poids) notes.push(`poids → ${Math.round(poids)} g`);
  }
  const premier = (cmd.items || []).find((i) => !i.adjustment && i.sku);
  if (premier && !cmd.service_id) {
    const d = catalog.defautsPour(premier.sku);
    if (d.default_service) {
      if (!dryRun) run(`UPDATE orders SET carrier_code = COALESCE(carrier_code, ?), service_id = ?,
                        package_id = COALESCE(package_id, ?) WHERE id = ?`,
        d.default_carrier || null, d.default_service, d.default_package || null, cmd.id);
      notes.push(`service produit → ${d.default_service}`);
    }
  }
  return notes.length ? notes.join(", ") : null;
}

/**
 * 5. Mapping de service. Écrit aussi le **canal logistique** dans le champ personnalisé 1
 * quand la commande n'en porte pas : c'est ce qui remplace la recherche de sous-chaîne dans
 * un texte libre (constat OBS6).
 */
function mapping(cmd, { dryRun }) {
  if (!cmd.requested_service) return null;
  const m = presets.resoudre(cmd.requested_service, cmd.store_id);
  if (!m) return null;
  if (!dryRun) {
    run(`UPDATE orders SET carrier_code = COALESCE(?, carrier_code), service_id = COALESCE(?, service_id),
         package_id = COALESCE(?, package_id) WHERE id = ?`,
      m.carrier_code, m.service_id, m.package_id, cmd.id);
  }
  return `« ${cmd.requested_service} » → canal ${m.channel || "?"}${m.service_id ? `, service ${m.service_id}` : ""}`;
}

/**
 * Exécute le pipeline sur une commande.
 *
 * `couches` limite l'exécution — `["defauts","mapping","regles"]` reproduit le
 * *Reprocess Automation Rules* de ShipStation.
 */
function traiter(orderId, { dryRun = false, couches = null } = {}) {
  const actives = couches || Object.keys(COUCHES);
  const trace = [];
  const etape = (cle, fn) => {
    if (!actives.includes(cle)) return;
    const cmd = orders.parId(orderId);
    if (!cmd) return;
    try {
      const r = fn(cmd, { dryRun });
      if (r) trace.push({ couche: COUCHES[cle].n, nom: COUCHES[cle].nom, effet: r });
    } catch (e) {
      trace.push({ couche: COUCHES[cle].n, nom: COUCHES[cle].nom, erreur: String(e.message) });
    }
  };

  etape("routing", routing);
  // Auto-Split : porté par l'action `split_by_sku` des règles, pas par une couche séparée.
  etape("groupes", groupes);
  etape("defauts", defauts);
  etape("mapping", mapping);

  if (actives.includes("regles")) {
    const r = rules.appliquer(orderId, { dryRun });
    const declenchees = dryRun ? r.declenchees : r;
    for (const d of declenchees)
      trace.push({ couche: 6, nom: "Automation Rules", regle: d.name, actions: d.actions });
    if (dryRun && r.arret) trace.push({ couche: 6, nom: "Automation Rules", arret: r.arret });
  }
  return trace;
}

function traiterLot(orderIds, opts = {}) {
  const r = {};
  for (const id of orderIds) r[id] = traiter(id, opts);
  if (!opts.dryRun) journaliser("automation.run", "order", null, { n: orderIds.length, couches: opts.couches || "toutes" });
  return r;
}

/**
 * Retraitement à la ShipStation : couches 4, 5 et 6 seulement, sur les commandes ouvertes.
 * Rend le décompte de ce qui a changé — l'avertissement de ShipStation restait vague.
 */
function retraiter({ statuts = ["awaiting_shipment", "on_hold"], limite = 5000, dryRun = false } = {}) {
  const ids = all(
    `SELECT id FROM orders WHERE status IN (${statuts.map(() => "?").join(",")}) ORDER BY id LIMIT ?`,
    ...statuts, limite).map((r) => r.id);
  const r = traiterLot(ids, { dryRun, couches: ["defauts", "mapping", "regles"] });
  const touchees = Object.values(r).filter((t) => t.length).length;
  return { commandes: ids.length, touchees, dryRun, detail: dryRun ? r : undefined };
}

module.exports = { COUCHES, traiter, traiterLot, retraiter };
