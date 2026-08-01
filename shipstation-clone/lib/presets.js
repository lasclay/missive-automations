/**
 * Préréglages d'expédition et mappings de service (§13.5, §13.6).
 *
 * Un préréglage applique d'un coup entrepôt, transporteur, service, colis, confirmation,
 * poids et dimensions à une sélection de commandes. C'est le geste le plus répété de
 * l'entrepôt — chez Lasclay, 17 préréglages pour 19 671 expéditions.
 *
 * Deux ajouts par rapport à ShipStation :
 *   • **Raccourci clavier** (`hotkey`). Les 17 préréglages du compte ont tous `hotKey: null` :
 *     l'accélérateur existait et n'a jamais été utilisé. Ici il est assigné et l'interface
 *     l'écoute (exigence C3, « tout au clavier »).
 *   • **Précédence explicite.** ShipStation ne documente nulle part qui gagne entre le
 *     préréglage, le profil produit, le produit et le type de colis — or c'est ce qui
 *     détermine le poids facturé. L'ordre est fixé ici et rendu dans `expliquer()`.
 */
const { all, one, run, tx, parse, dump, journaliser } = require("./db");

const hydrater = (p) => p && ({ ...p, dimensions: parse(p.dimensions), insurance: parse(p.insurance) });

const lister = () => all("SELECT * FROM shipping_presets ORDER BY position, name").map(hydrater);
const parId = (id) => hydrater(one("SELECT * FROM shipping_presets WHERE id = ?", id));
const parNom = (nom) => hydrater(one("SELECT * FROM shipping_presets WHERE name = ?", nom));
const parRaccourci = (touche) => hydrater(one("SELECT * FROM shipping_presets WHERE hotkey = ?", String(touche)));

function sauver(p) {
  const champs = [p.name, p.warehouse_id || null, p.carrier_code || null, p.service_id || null,
    p.package_id || null, p.confirmation ?? null, p.weight_g ?? null, dump(p.dimensions || null),
    p.hotkey || null, p.position || 0, p.notes || null];
  if (p.id) {
    run(`UPDATE shipping_presets SET name=?, warehouse_id=?, carrier_code=?, service_id=?, package_id=?,
         confirmation=?, weight_g=?, dimensions=?, hotkey=?, position=?, notes=? WHERE id=?`, ...champs, p.id);
    return p.id;
  }
  run(`INSERT INTO shipping_presets (name,warehouse_id,carrier_code,service_id,package_id,confirmation,
       weight_g,dimensions,hotkey,position,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(name) DO UPDATE SET warehouse_id=excluded.warehouse_id, carrier_code=excluded.carrier_code,
         service_id=excluded.service_id, package_id=excluded.package_id, confirmation=excluded.confirmation,
         weight_g=excluded.weight_g, dimensions=excluded.dimensions, hotkey=excluded.hotkey`, ...champs);
  return one("SELECT id FROM shipping_presets WHERE name = ?", p.name).id;
}

const supprimer = (id) => run("DELETE FROM shipping_presets WHERE id = ?", id);

/**
 * Applique un préréglage à des commandes.
 *
 * `garderPoids` (défaut vrai) protège un poids déjà pesé : le préréglage donne un poids
 * *présumé*, la balance donne le poids *réel*, et écraser le second par le premier fait
 * payer le mauvais tarif. ShipStation écrase sans demander.
 */
function appliquer(presetId, orderIds, { garderPoids = true, userId = null } = {}) {
  const p = parId(presetId);
  if (!p) throw new Error("préréglage introuvable");
  let n = 0;
  tx(() => {
    for (const id of orderIds) {
      const cmd = one("SELECT id, weight_g FROM orders WHERE id = ?", Number(id));
      if (!cmd) continue;
      const poids = (garderPoids && cmd.weight_g) ? cmd.weight_g : (p.weight_g ?? cmd.weight_g);
      run(`UPDATE orders SET warehouse_id = COALESCE(?, warehouse_id), carrier_code = COALESCE(?, carrier_code),
           service_id = COALESCE(?, service_id), package_id = COALESCE(?, package_id),
           confirmation = COALESCE(?, confirmation), weight_g = ?, dimensions = COALESCE(?, dimensions),
           modified_at = datetime('now') WHERE id = ?`,
        p.warehouse_id, p.carrier_code, p.service_id, p.package_id, p.confirmation,
        poids, dump(p.dimensions || null), cmd.id);
      n++;
    }
  });
  journaliser("preset.applied", "order", null, { preset: p.name, n }, userId);
  return { applique: n, preset: p.name };
}

/**
 * Précédence des dimensions et du poids — décidée ici, faute de documentation ShipStation.
 *
 * Ordre retenu : **préréglage > profil produit > produit > type de colis**, avec une
 * exception : un poids **mesuré** (saisi sur la commande) l'emporte sur tout. Rend la liste
 * des sources consultées pour que l'écran puisse l'afficher — c'est ce qui manque le plus
 * quand un colis part avec le mauvais poids.
 */
function expliquer(commande, preset = null) {
  const sources = [];
  const catalog = require("./catalog");
  let poids = null, dims = null;

  if (preset) {
    if (preset.weight_g != null) { poids = preset.weight_g; sources.push({ champ: "poids", source: `préréglage « ${preset.name} »`, valeur: preset.weight_g }); }
    if (preset.dimensions) { dims = preset.dimensions; sources.push({ champ: "dimensions", source: `préréglage « ${preset.name} »`, valeur: preset.dimensions }); }
  }
  if (poids == null) {
    const somme = (commande.items || []).filter((i) => !i.adjustment)
      .reduce((s, i) => {
        const d = i.sku ? catalog.defautsPour(i.sku) : {};
        return s + ((i.weight_g || d.weight_g || 0) * (i.quantity || 1));
      }, 0);
    if (somme) { poids = somme; sources.push({ champ: "poids", source: "somme des poids produit", valeur: somme }); }
  }
  if (poids == null && commande.weight_g) { poids = commande.weight_g; sources.push({ champ: "poids", source: "commande", valeur: commande.weight_g }); }

  if (!dims && commande.package_id) {
    const colis = one("SELECT name, dimensions FROM packages WHERE id = ?", commande.package_id);
    const d = colis && parse(colis.dimensions);
    if (d) { dims = d; sources.push({ champ: "dimensions", source: `type de colis « ${colis.name} »`, valeur: d }); }
  }
  return { poids, dimensions: dims, sources };
}

// ------------------------------------------------------- mappings de service

const mappings = (storeId = null) => all(
  storeId ? "SELECT * FROM service_mappings WHERE store_id = ? ORDER BY position, id"
          : "SELECT * FROM service_mappings ORDER BY store_id, position, id",
  ...(storeId ? [storeId] : []));

function sauverMapping(m) {
  if (m.id) {
    run(`UPDATE service_mappings SET store_id=?, requested=?, channel=?, carrier_code=?, service_id=?,
         package_id=?, match_mode=?, position=? WHERE id=?`,
      m.store_id || null, m.requested, m.channel || null, m.carrier_code || null, m.service_id || null,
      m.package_id || null, m.match_mode || "contains", m.position || 0, m.id);
    return m.id;
  }
  run(`INSERT INTO service_mappings (store_id,requested,channel,carrier_code,service_id,package_id,match_mode,position)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(store_id,requested) DO UPDATE SET channel=excluded.channel, carrier_code=excluded.carrier_code,
         service_id=excluded.service_id, package_id=excluded.package_id, match_mode=excluded.match_mode`,
    m.store_id || null, m.requested, m.channel || null, m.carrier_code || null, m.service_id || null,
    m.package_id || null, m.match_mode || "contains", m.position || 0);
  return one("SELECT id FROM service_mappings WHERE requested = ? AND store_id IS ?", m.requested, m.store_id || null).id;
}

const supprimerMapping = (id) => run("DELETE FROM service_mappings WHERE id = ?", id);

/**
 * Résout le libellé de service du checkout en canal et service réel.
 *
 * Rend `null` si aucun mapping ne correspond — et c'est une information : chez ShipStation
 * un libellé non mappé passait en silence, et la commande partait au service par défaut.
 */
function resoudre(requested, storeId = null) {
  if (!requested) return null;
  const texte = String(requested).toLowerCase();
  // Les mappings propres à une boutique passent avant les mappings globaux ; sans boutique
  // précisée, tous sont candidats (c'est le cas du diagnostic des libellés non couverts).
  const lignes = storeId
    ? all(`SELECT * FROM service_mappings WHERE store_id IS NULL OR store_id = ?
           ORDER BY (store_id IS NULL), position, id`, storeId)
    : all("SELECT * FROM service_mappings ORDER BY (store_id IS NULL), position, id");
  for (const m of lignes) {
    const cible = String(m.requested).toLowerCase();
    const ok = m.match_mode === "equals" ? texte === cible : texte.includes(cible);
    if (ok) return { channel: m.channel, carrier_code: m.carrier_code, service_id: m.service_id,
                     package_id: m.package_id, via: m.requested };
  }
  return null;
}

/** Libellés vus dans les commandes et non couverts par un mapping — le diagnostic manquant. */
const libellesNonMappes = () => all(`
  SELECT requested_service AS libelle, COUNT(*) n
  FROM orders WHERE requested_service IS NOT NULL AND requested_service <> ''
  GROUP BY requested_service ORDER BY n DESC`)
  .filter((l) => !resoudre(l.libelle))
  .slice(0, 50);

module.exports = {
  lister, parId, parNom, parRaccourci, sauver, supprimer, appliquer, expliquer,
  mappings, sauverMapping, supprimerMapping, resoudre, libellesNonMappes,
};
