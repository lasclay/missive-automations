/**
 * Cueillettes transporteur — BUG-051.
 *
 * ShipStation offre `Carrier Pickups > Scheduled Pickups` avec cinq couples
 * transporteur/compte chez Lasclay ; le clone n'en avait rien. C'est un geste **quotidien**
 * — on programme le ramassage du lendemain en fin de journée — et sa perte à la bascule se
 * paierait tous les matins.
 *
 * Une précaution qui structure tout le module : une cueillette **notée ici** n'est pas une
 * cueillette **confirmée par le transporteur**. Tant qu'aucun adaptateur réel n'a répondu,
 * `confirmation` reste vide et le statut dit `demande`. Laisser croire qu'un camion viendra
 * parce qu'une ligne existe en base serait pire que de ne rien afficher : l'entrepôt
 * préparerait des colis pour rien.
 */
const { all, one, run, maintenant, journaliser } = require("./db");

const STATUTS = ["demande", "confirme", "annule", "effectue"];

/** Comptes de ramassage du compte Lasclay (§ audit BUG-051) — cinq couples. */
const COMPTES = [
  { carrier_code: "canada_post", compte: "LASCLAY", nom: "Canada Post (LASCLAY)" },
  { carrier_code: "canada_post", compte: "Rotule", nom: "Canada Post (Rotule)" },
  { carrier_code: "ups", compte: "CC Gabriel", nom: "CC Gabriel — UPS" },
  { carrier_code: "purolator", compte: "CC Gabriel", nom: "CC Gabriel — Purolator Canada" },
  { carrier_code: "dhl_express", compte: "CC Gabriel", nom: "CC Gabriel — DHL Express" },
];

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Programme une cueillette.
 *
 * Rien n'est envoyé à un transporteur : l'adaptateur de tarification est un bouchon, et il
 * n'y a pas d'API de ramassage sans identifiants de compte. La demande est donc **notée**,
 * avec ce qu'il faut pour la reprendre à la main ou la rejouer le jour où les identifiants
 * existent. Le module ne prétend pas confirmer ce qu'il ne peut pas confirmer.
 */
function programmer(p, userId = null) {
  const compte = COMPTES.find((c) => c.carrier_code === p.carrier_code && c.compte === p.compte);
  if (!compte) throw new Error(`compte de ramassage inconnu : ${p.carrier_code} / ${p.compte}`);
  if (!JOUR.test(String(p.date || ""))) throw new Error("date attendue au format AAAA-MM-JJ");
  if (p.date < new Date().toISOString().slice(0, 10))
    throw new Error("on ne programme pas un ramassage dans le passé");
  for (const [cle, v] of [["creneau_debut", p.creneau_debut], ["creneau_fin", p.creneau_fin]])
    if (v && !HEURE.test(String(v))) throw new Error(`${cle} attendu au format HH:MM`);
  if (p.creneau_debut && p.creneau_fin && p.creneau_fin <= p.creneau_debut)
    throw new Error("la fin du créneau doit suivre son début");

  // Deux ramassages du même compte le même jour, c'est une erreur de saisie bien plus
  // souvent qu'une intention : le transporteur ne vient qu'une fois.
  const doublon = one(`SELECT id FROM pickups WHERE carrier_code = ? AND compte = ? AND date = ?
                       AND statut IN ('demande','confirme')`, p.carrier_code, p.compte, p.date);
  if (doublon) throw new Error(`un ramassage est déjà programmé pour ${compte.nom} le ${p.date}`);

  run(`INSERT INTO pickups (carrier_code, compte, warehouse_id, date, creneau_debut, creneau_fin,
         colis, poids_g, contact, telephone, instructions, statut, cree_le, cree_par)
       VALUES (?,?,?,?,?,?,?,?,?,?,?, 'demande', ?, ?)`,
    p.carrier_code, p.compte, p.warehouse_id || null, p.date,
    p.creneau_debut || null, p.creneau_fin || null,
    Number(p.colis) || 0, Number(p.poids_g) || 0,
    p.contact || null, p.telephone || null, p.instructions || null,
    maintenant(), userId);
  const id = one("SELECT last_insert_rowid() r").r;
  journaliser("pickup.create", "pickup", id, { carrier: compte.nom, date: p.date }, userId);
  return { id, ...compte, date: p.date, statut: "demande" };
}

function majStatut(id, statut, { confirmation = null, erreur = null } = {}, userId = null) {
  if (!STATUTS.includes(statut)) throw new Error(`statut de ramassage inconnu : ${statut}`);
  const p = one("SELECT * FROM pickups WHERE id = ?", Number(id));
  if (!p) throw new Error("ramassage inconnu");
  if (p.statut === "annule") throw new Error("ce ramassage est déjà annulé");
  run(`UPDATE pickups SET statut = ?, confirmation = COALESCE(?, confirmation),
       erreur = ?, annule_le = CASE WHEN ? = 'annule' THEN ? ELSE annule_le END WHERE id = ?`,
    statut, confirmation, erreur, statut, maintenant(), Number(id));
  journaliser(`pickup.${statut}`, "pickup", Number(id), { confirmation }, userId);
  return { id: Number(id), statut };
}

/**
 * Ramassages, avec le volume réellement prêt ce jour-là.
 *
 * Le nombre de colis saisi à la programmation vieillit dès qu'une étiquette de plus est
 * achetée. On l'affiche à côté du compte réel : c'est l'écart qui dit s'il faut rappeler le
 * transporteur.
 */
function lister({ depuis = null, jusqua = null, statut = null } = {}) {
  const w = [], p = [];
  if (depuis) { w.push("date >= ?"); p.push(depuis); }
  if (jusqua) { w.push("date <= ?"); p.push(jusqua); }
  if (statut) { w.push("statut = ?"); p.push(statut); }
  const where = w.length ? "WHERE " + w.join(" AND ") : "";
  return all(`SELECT * FROM pickups ${where} ORDER BY date DESC, id DESC LIMIT 200`, ...p)
    .map((r) => {
      const c = COMPTES.find((x) => x.carrier_code === r.carrier_code && x.compte === r.compte);
      const reel = one(`SELECT COUNT(*) n, COALESCE(SUM(weight_g),0) poids FROM shipments
                        WHERE carrier_code = ? AND ship_date LIKE ? AND voided = 0`,
        r.carrier_code, `${r.date}%`);
      return { ...r, nom: c ? c.nom : `${r.carrier_code} / ${r.compte || "—"}`,
        colis_reels: reel.n, poids_reel_g: Math.round(reel.poids) };
    });
}

const prochains = () => lister({ depuis: new Date().toISOString().slice(0, 10) })
  .filter((p) => p.statut === "demande" || p.statut === "confirme");

module.exports = { COMPTES, STATUTS, programmer, majStatut, lister, prochains };
