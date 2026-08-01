/**
 * Préréglages d'expédition, mappings de service et référentiel produit étendu (§13.5, §13.6).
 *
 * Quatre fonctions de ShipStation réunies ici :
 *   • les **préréglages d'expédition** — une configuration enregistrée, appliquée à la demande
 *     sur une sélection. À ne pas confondre avec les défauts produit, qui s'appliquent seuls
 *     à l'import : ceux-ci se choisissent. C'est le geste le plus répété de l'entrepôt —
 *     17 préréglages pour 19 671 expéditions.
 *   • les **mappings de service** — le libellé de livraison choisi au checkout traduit en
 *     service transporteur réel.
 *   • les **alias de SKU** — plusieurs SKU de boutiques différentes désignant la même fiche.
 *   • les **bundles** — un SKU vendu qui recouvre plusieurs produits à prélever.
 *
 * Trois ajouts par rapport à ShipStation :
 *   • **Raccourci clavier** (`hotkey`). Les 17 préréglages du compte ont tous `hotKey: null` :
 *     l'accélérateur existait et n'a jamais servi (exigence C3, « tout au clavier »).
 *   • **Canal logistique** en enum sur les mappings. Chez ShipStation, « Entrepôt Lasclay »,
 *     « Défricheuses » ou « DDD » ne vivent que comme sous-chaînes cherchées dans un texte
 *     libre saisi dans Shopify : une faute de frappe et la règle cesse de se déclencher, sans
 *     rien signaler (constat OBS6).
 *   • **Précédence explicite** du poids et des dimensions. ShipStation ne documente nulle part
 *     qui gagne entre le préréglage, le profil produit, le produit et le type de colis — or
 *     c'est ce qui détermine le poids facturé.
 */
const { all, one, run, tx, parse, dump, journaliser } = require("./db");

// ------------------------------------------------------- préréglages d'expédition

const presets = () => all("SELECT * FROM shipping_presets ORDER BY position, name")
  .map((p) => ({ ...p, dimensions: parse(p.dimensions), insurance: parse(p.insurance),
    is_default: !!p.is_default }));

function sauverPreset(p) {
  const champs = [p.name, p.carrier_code || null, p.service_id || null, p.package_id || null,
    p.confirmation ?? null, p.weight_g ?? null, dump(p.dimensions || null),
    dump(p.insurance || null), p.warehouse_id || null, p.is_default ? 1 : 0, p.position || 0,
    p.hotkey || null, p.notes || null];
  if (p.is_default) run("UPDATE shipping_presets SET is_default = 0");
  // Un raccourci ne peut désigner qu'un préréglage : on libère le précédent porteur.
  if (p.hotkey) run("UPDATE shipping_presets SET hotkey = NULL WHERE hotkey = ? AND name <> ?", String(p.hotkey), p.name);
  if (p.id) {
    run(`UPDATE shipping_presets SET name=?, carrier_code=?, service_id=?, package_id=?,
         confirmation=?, weight_g=?, dimensions=?, insurance=?, warehouse_id=?, is_default=?,
         position=?, hotkey=?, notes=? WHERE id=?`, ...champs, p.id);
    return p.id;
  }
  // Le nom fait foi : recharger la configuration ShipStation ne doit pas créer de doublons.
  run(`INSERT INTO shipping_presets (name,carrier_code,service_id,package_id,confirmation,
       weight_g,dimensions,insurance,warehouse_id,is_default,position,hotkey,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(name) DO UPDATE SET carrier_code=excluded.carrier_code,
         service_id=excluded.service_id, package_id=excluded.package_id,
         confirmation=excluded.confirmation, weight_g=excluded.weight_g,
         dimensions=excluded.dimensions, insurance=excluded.insurance,
         warehouse_id=excluded.warehouse_id, position=excluded.position,
         hotkey=excluded.hotkey, notes=excluded.notes`, ...champs);
  return one("SELECT id FROM shipping_presets WHERE name = ?", p.name).id;
}

const supprimerPreset = (id) => run("DELETE FROM shipping_presets WHERE id = ?", id);

/**
 * Applique un préréglage à des commandes. Les champs vides du préréglage ne touchent à rien :
 * un préréglage « service seulement » ne doit pas effacer les poids déjà saisis.
 */
function appliquerPreset(presetId, orderIds, { userId = null, garderPoids = true } = {}) {
  const p = one("SELECT * FROM shipping_presets WHERE id = ?", presetId);
  if (!p) throw new Error("préréglage inconnu");
  const cols = ["carrier_code", "service_id", "package_id", "confirmation", "warehouse_id", "dimensions"];
  const sets = [], vals = [];
  for (const c of cols) if (p[c] !== null && p[c] !== undefined && p[c] !== "") { sets.push(`${c} = ?`); vals.push(p[c]); }
  if (p.insurance) { sets.push("insurance = ?"); vals.push(p.insurance); }
  // Le poids est traité à part : `garderPoids` protège un poids déjà pesé. Le préréglage donne
  // un poids *présumé*, la balance donne le poids *réel*, et écraser le second par le premier
  // fait payer le mauvais tarif. ShipStation écrase sans demander.
  if (p.weight_g != null && p.weight_g !== "")
    sets.push(garderPoids ? "weight_g = CASE WHEN COALESCE(weight_g,0) > 0 THEN weight_g ELSE ? END" : "weight_g = ?"),
    vals.push(p.weight_g);
  if (!sets.length) return { n: 0, vide: true };
  let n = 0;
  tx(() => { for (const id of orderIds) { run(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`, ...vals, id); n++; } });
  journaliser("preset.apply", "order", null, { preset: p.name, n, garderPoids }, userId);
  return { n, applique: n, preset: p.name };
}

// ------------------------------------------------------------------ alias de SKU

const alias = () => all(`SELECT a.alias, a.store_id, p.sku, p.name FROM product_aliases a
                         JOIN products p ON p.id = a.product_id ORDER BY p.sku, a.alias`);

function poserAlias(aliasSku, sku, storeId = null) {
  const p = one("SELECT id FROM products WHERE sku = ?", sku);
  if (!p) throw new Error(`produit inconnu : ${sku}`);
  if (aliasSku === sku) throw new Error("un alias ne peut pas être le SKU lui-même");
  run(`INSERT INTO product_aliases (alias, product_id, store_id) VALUES (?,?,?)
       ON CONFLICT(alias) DO UPDATE SET product_id = excluded.product_id`, aliasSku, p.id, storeId);
  journaliser("alias.set", "product", p.id, { alias: aliasSku, sku });
}

const retirerAlias = (aliasSku) => run("DELETE FROM product_aliases WHERE alias = ?", aliasSku);

/** Fiche produit d'un SKU, en suivant les alias. */
function produitDeSku(sku) {
  if (!sku) return null;
  return one("SELECT * FROM products WHERE sku = ?", sku)
    || one(`SELECT p.* FROM product_aliases a JOIN products p ON p.id = a.product_id
            WHERE a.alias = ?`, sku);
}

// ------------------------------------------------------------------ bundles

/**
 * Composants d'un bundle. Un SKU vendu comme un tout recouvre plusieurs produits qu'il faut
 * prélever séparément — c'est ce que la liste de prélèvement doit montrer.
 */
function composants(sku, quantite = 1) {
  const p = produitDeSku(sku);
  if (!p || !p.is_bundle) return null;
  const items = parse(p.bundle_items, []) || [];
  return items.map((i) => ({
    sku: i.sku, quantity: (i.quantity || 1) * quantite,
    name: (produitDeSku(i.sku) || {}).name || i.sku,
    warehouse_location: (produitDeSku(i.sku) || {}).warehouse_location || null,
  }));
}

function definirBundle(sku, items) {
  const p = one("SELECT id FROM products WHERE sku = ?", sku);
  if (!p) throw new Error(`produit inconnu : ${sku}`);
  const propre = (items || []).filter((i) => i.sku && i.sku !== sku)
    .map((i) => ({ sku: i.sku, quantity: Number(i.quantity) || 1 }));
  run("UPDATE products SET is_bundle = ?, bundle_items = ? WHERE id = ?",
    propre.length ? 1 : 0, dump(propre), p.id);
  journaliser("bundle.set", "product", p.id, { sku, composants: propre.length });
  return propre.length;
}

/**
 * Liste de prélèvement : ce qu'il faut aller chercher en entrepôt, agrégé par article et
 * trié par emplacement — les bundles éclatés en leurs composants.
 */
function listeDePrelevement(orderIds) {
  const lignes = all(`SELECT i.sku, i.name, i.quantity, i.warehouse_location
                      FROM order_items i WHERE i.adjustment = 0 AND i.order_id IN (${
                        orderIds.map(() => "?").join(",") || "NULL"})`, ...orderIds);
  const total = new Map();
  const ajouter = (sku, nom, qte, empl) => {
    const cle = sku || nom || "?";
    const e = total.get(cle) || { sku, name: nom, quantity: 0, warehouse_location: empl };
    e.quantity += qte;
    if (!e.warehouse_location && empl) e.warehouse_location = empl;
    total.set(cle, e);
  };
  for (const l of lignes) {
    const comp = composants(l.sku, l.quantity);
    if (comp) for (const c of comp) ajouter(c.sku, c.name, c.quantity, c.warehouse_location);
    else {
      const p = produitDeSku(l.sku);
      ajouter(l.sku, l.name, l.quantity, l.warehouse_location || (p && p.warehouse_location));
    }
  }
  return [...total.values()].sort((a, b) =>
    String(a.warehouse_location || "zzz").localeCompare(String(b.warehouse_location || "zzz"))
    || String(a.sku || "").localeCompare(String(b.sku || "")));
}


// ------------------------------------------------- raccourcis et fiche complète

const presetParNom = (nom) => presets().find((p) => p.name === nom) || null;
const presetParRaccourci = (touche) => presets().find((p) => p.hotkey === String(touche)) || null;

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
  presets, sauverPreset, supprimerPreset, appliquerPreset, presetParNom, presetParRaccourci,
  expliquer,
  mappings, sauverMapping, supprimerMapping, resoudre, libellesNonMappes,
  alias, poserAlias, retirerAlias, produitDeSku,
  composants, definirBundle, listeDePrelevement,
};
