/**
 * Analytique — les rapports de ShipStation, plus celui qui manquait.
 *
 * Le rapport qui compte ici est `economieDropOff()` : il mesure en continu l'écart entre ce
 * qu'on paie et ce qu'on paierait au tarif drop-off. C'est le tableau de bord du projet.
 */
const { all, one } = require("./db");

/** Résumé du haut de page. */
function resume({ from = null, to = null } = {}) {
  const w = [], p = [];
  if (from) { w.push("s.ship_date >= ?"); p.push(from); }
  if (to) { w.push("s.ship_date <= ?"); p.push(to); }
  w.push("s.voided = 0");
  const where = "WHERE " + w.join(" AND ");
  // `drop_off` n'existe que sur les expéditions achetées ici : ShipStation ne l'enregistre
  // pas, et 34 000 envois migrés le portent donc à zéro. Compter l'**admissibilité** au
  // dépôt — sous le seuil de poids, hors retour — dit quelque chose de vrai sur
  // l'historique, là où le drapeau ne dirait que « on ne sait pas » en faisant croire à
  // « non ». C'est la même règle que celle qui décide au moment de coter.
  const r = one(`SELECT COUNT(*) n, COALESCE(SUM(cost),0) cout, COALESCE(AVG(cost),0) moyen,
                   COALESCE(SUM(CASE WHEN drop_off = 1 THEN 1 ELSE 0 END),0) drop_off,
                   COALESCE(SUM(CASE WHEN is_return = 0 AND weight_g > 0 AND weight_g < 500
                                     THEN 1 ELSE 0 END),0) admissibles_depot,
                   COALESCE(SUM(CASE WHEN is_return = 1 THEN 1 ELSE 0 END),0) retours
                 FROM shipments s ${where}`, ...p);
  return {
    expeditions: r.n, cout_total: round(r.cout), cout_moyen: round(r.moyen),
    drop_off: r.drop_off, admissibles_depot: r.admissibles_depot, retours: r.retours,
    backlog: one("SELECT COUNT(*) n FROM orders WHERE status = 'awaiting_shipment'").n,
    en_attente: one("SELECT COUNT(*) n FROM orders WHERE status = 'on_hold'").n,
  };
}

const round = (v) => Math.round((Number(v) || 0) * 100) / 100;

/** Volume et coût par mois — la saisonnalité. */
const parMois = () => all(
  `SELECT substr(ship_date,1,7) mois, COUNT(*) n, ROUND(SUM(cost),2) cout, ROUND(AVG(cost),2) moyen
   FROM shipments WHERE voided = 0 AND ship_date IS NOT NULL
   GROUP BY mois ORDER BY mois DESC LIMIT 24`);

/** Performance par transporteur et service. */
const parService = () => all(
  `SELECT carrier_code, service_id, COUNT(*) n, ROUND(SUM(cost),2) cout, ROUND(AVG(cost),2) moyen,
     SUM(drop_off) drop_off
   FROM shipments WHERE voided = 0 GROUP BY carrier_code, service_id ORDER BY n DESC`);

/** Répartition par bande de poids — la vue qui a révélé le gisement. */
function parPoids() {
  return all(
    `SELECT CASE
       WHEN weight_g < 500 THEN '0-500 g'
       WHEN weight_g < 1000 THEN '500 g - 1 kg'
       WHEN weight_g < 2000 THEN '1-2 kg'
       WHEN weight_g < 5000 THEN '2-5 kg'
       ELSE '> 5 kg' END bande,
       CASE WHEN weight_g < 500 THEN 1 WHEN weight_g < 1000 THEN 2 WHEN weight_g < 2000 THEN 3
            WHEN weight_g < 5000 THEN 4 ELSE 5 END ordre,
       COUNT(*) n, ROUND(SUM(cost),2) cout, ROUND(AVG(cost),2) moyen
     FROM shipments WHERE voided = 0 AND weight_g > 0 GROUP BY bande, ordre ORDER BY ordre`);
}

/**
 * L'écart au tarif drop-off. `tarif` est le prix unitaire visé pour les colis sous le seuil.
 * Renvoie ce qui est déjà capté et ce qui reste sur la table.
 */
function economieDropOff({ tarif = 6.31, seuil = 500, from = null, to = null } = {}) {
  const w = ["voided = 0", "weight_g > 0", "weight_g < ?", "is_return = 0"], p = [seuil];
  if (from) { w.push("ship_date >= ?"); p.push(from); }
  if (to) { w.push("ship_date <= ?"); p.push(to); }
  const where = "WHERE " + w.join(" AND ");
  const r = one(`SELECT COUNT(*) n, COALESCE(SUM(cost),0) cout,
                   SUM(CASE WHEN drop_off = 1 THEN 1 ELSE 0 END) deja,
                   COALESCE(SUM(CASE WHEN drop_off = 0 THEN cost ELSE 0 END),0) cout_non_capte,
                   SUM(CASE WHEN drop_off = 0 THEN 1 ELSE 0 END) n_non_capte
                 FROM shipments ${where}`, ...p);
  const total = one(`SELECT COUNT(*) n, COALESCE(SUM(cost),0) c FROM shipments WHERE voided = 0`);
  return {
    tarif_cible: tarif, seuil_g: seuil,
    admissibles: r.n, deja_en_drop_off: r.deja || 0,
    non_captes: r.n_non_capte || 0,
    cout_actuel_non_captes: round(r.cout_non_capte),
    cout_cible_non_captes: round((r.n_non_capte || 0) * tarif),
    economie_restante: round(r.cout_non_capte - (r.n_non_capte || 0) * tarif),
    part_admissible_pct: total.n ? round(100 * r.n / total.n) : 0,
    depense_totale: round(total.c),
  };
}

/**
 * Coût réel contre frais de port encaissés — le Shipping Cost Report de ShipStation.
 * C'est lui qui dit si on perd de l'argent sur la livraison gratuite.
 */
const coutContreEncaisse = ({ from = null, to = null } = {}) => {
  const w = ["s.voided = 0"], p = [];
  if (from) { w.push("s.ship_date >= ?"); p.push(from); }
  if (to) { w.push("s.ship_date <= ?"); p.push(to); }
  const where = "WHERE " + w.join(" AND ");
  const r = one(`SELECT COUNT(*) n, COALESCE(SUM(s.cost),0) cout,
                   COALESCE(SUM(o.shipping_paid),0) encaisse
                 FROM shipments s JOIN orders o ON o.id = s.order_id ${where}`, ...p);
  return { expeditions: r.n, cout: round(r.cout), encaisse: round(r.encaisse), ecart: round(r.encaisse - r.cout) };
};

/** Destinations. */
const parDestination = () => all(
  `SELECT json_extract(ship_to,'$.country') pays, json_extract(ship_to,'$.state') province,
     COUNT(*) n, ROUND(AVG(cost),2) moyen
   FROM shipments WHERE voided = 0 GROUP BY pays, province ORDER BY n DESC LIMIT 40`);

/** Produits les plus expédiés. */
const topProduits = (limite = 25) => all(
  `SELECT i.sku, MAX(i.name) nom, SUM(i.quantity) qte, COUNT(DISTINCT i.order_id) commandes
   FROM order_items i WHERE i.adjustment = 0 AND i.sku IS NOT NULL AND i.sku <> ''
   GROUP BY i.sku ORDER BY qte DESC LIMIT ?`, limite);

/** Délai entre la commande et l'expédition — la vitesse de traitement. */
const delaiTraitement = () => one(
  `SELECT COUNT(*) n, ROUND(AVG(julianday(s.ship_date) - julianday(o.order_date)),2) jours_moyen
   FROM shipments s JOIN orders o ON o.id = s.order_id
   WHERE s.voided = 0 AND s.ship_date IS NOT NULL AND o.order_date IS NOT NULL`);

/** Export CSV d'un jeu de lignes — l'export brut de ShipStation. */
/**
 * Sérialisation CSV — BUG-057.
 *
 * L'ancienne version rendait une chaîne **vide** quand le jeu était vide : six exports sur
 * neuf produisaient un fichier de 3 octets (le seul BOM), sans même une ligne d'en-tête. On
 * ne pouvait donc pas distinguer « aucune donnée » de « l'export a échoué ». Les colonnes
 * peuvent désormais être déclarées, ce qui garantit un en-tête même sur un jeu vide.
 */
function csv(lignes, colonnes = null) {
  const cols = colonnes || (lignes.length ? Object.keys(lignes[0]) : []);
  if (!cols.length) return "";
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...lignes.map((l) => cols.map((c) => esc(l[c])).join(","))].join("\n");
}

/** Tout le tableau de bord en un appel. */
const tableauDeBord = (opts = {}) => ({
  resume: resume(opts),
  drop_off: economieDropOff(opts),
  cout_vs_encaisse: coutContreEncaisse(opts),
  delai: delaiTraitement(),
  par_mois: parMois(),
  par_poids: parPoids(),
  par_service: parService(),
});

module.exports = {
  resume, parMois, parService, parPoids, economieDropOff, coutContreEncaisse,
  parDestination, topProduits, delaiTraitement, csv, tableauDeBord,
};
