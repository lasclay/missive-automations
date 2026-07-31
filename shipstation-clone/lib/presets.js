/**
 * Préréglages d'expédition et référentiel produit étendu.
 *
 * Trois fonctions de ShipStation qui manquaient :
 *   • les **préréglages d'expédition** — une configuration enregistrée, appliquée à la demande
 *     sur une sélection. À ne pas confondre avec les défauts produit, qui s'appliquent seuls
 *     à l'import : ceux-ci se choisissent.
 *   • les **alias de SKU** — plusieurs SKU de boutiques différentes désignant la même fiche.
 *   • les **bundles** — un SKU vendu qui recouvre plusieurs produits à prélever.
 */
const { all, one, run, tx, parse, dump, journaliser } = require("./db");

// ------------------------------------------------------- préréglages d'expédition

const presets = () => all("SELECT * FROM shipping_presets ORDER BY position, name")
  .map((p) => ({ ...p, dimensions: parse(p.dimensions), insurance: parse(p.insurance),
    is_default: !!p.is_default }));

function sauverPreset(p) {
  const champs = [p.name, p.carrier_code || null, p.service_id || null, p.package_id || null,
    p.confirmation || null, p.weight_g || null, dump(p.dimensions || null),
    dump(p.insurance || null), p.warehouse_id || null, p.is_default ? 1 : 0, p.position || 0];
  if (p.is_default) run("UPDATE shipping_presets SET is_default = 0");
  if (p.id) {
    run(`UPDATE shipping_presets SET name=?, carrier_code=?, service_id=?, package_id=?,
         confirmation=?, weight_g=?, dimensions=?, insurance=?, warehouse_id=?, is_default=?,
         position=? WHERE id=?`, ...champs, p.id);
    return p.id;
  }
  run(`INSERT INTO shipping_presets (name,carrier_code,service_id,package_id,confirmation,
       weight_g,dimensions,insurance,warehouse_id,is_default,position)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`, ...champs);
  return one("SELECT last_insert_rowid() r").r;
}

const supprimerPreset = (id) => run("DELETE FROM shipping_presets WHERE id = ?", id);

/**
 * Applique un préréglage à des commandes. Les champs vides du préréglage ne touchent à rien :
 * un préréglage « service seulement » ne doit pas effacer les poids déjà saisis.
 */
function appliquerPreset(presetId, orderIds, userId = null) {
  const p = one("SELECT * FROM shipping_presets WHERE id = ?", presetId);
  if (!p) throw new Error("préréglage inconnu");
  const cols = ["carrier_code", "service_id", "package_id", "confirmation", "warehouse_id", "weight_g", "dimensions"];
  const sets = [], vals = [];
  for (const c of cols) if (p[c] !== null && p[c] !== undefined && p[c] !== "") { sets.push(`${c} = ?`); vals.push(p[c]); }
  if (p.insurance) { sets.push("insurance = ?"); vals.push(p.insurance); }
  if (!sets.length) return { n: 0, vide: true };
  let n = 0;
  tx(() => { for (const id of orderIds) { run(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`, ...vals, id); n++; } });
  journaliser("preset.apply", "order", null, { preset: p.name, n }, userId);
  return { n, preset: p.name };
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

module.exports = {
  presets, sauverPreset, supprimerPreset, appliquerPreset,
  alias, poserAlias, retirerAlias, produitDeSku,
  composants, definirBundle, listeDePrelevement,
};
