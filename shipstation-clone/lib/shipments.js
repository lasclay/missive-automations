/**
 * Expéditions, lots et manifestes.
 *
 * L'achat d'étiquette passe TOUJOURS par l'adaptateur transporteur (lib/carrier.js) : ce
 * module ne connaît aucun transporteur. Il gère le cycle de vie côté clone — cotation,
 * achat, annulation, lots, manifestes, suivi.
 *
 * Le traitement par lot n'est pas une commodité : 96 % des étiquettes du compte audité sont
 * achetées en lot (AUDIT.md §2). C'est le chemin principal, pas un cas particulier.
 */
const { all, one, run, tx, parse, dump, maintenant, journaliser } = require("./db");
const orders = require("./orders");
const { adaptateur, choisirTarif, SEUIL_DROPOFF_G } = require("./carrier");

// ------------------------------------------------------------------ cotation

/** Construit l'objet d'envoi attendu par l'adaptateur à partir d'une commande. */
function envoiDepuisCommande(cmd) {
  const entrepot = cmd.warehouse_id
    ? one("SELECT * FROM warehouses WHERE id = ?", cmd.warehouse_id)
    : one("SELECT * FROM warehouses ORDER BY is_default DESC, id LIMIT 1");
  const origine = entrepot ? parse(entrepot.origin_address, {}) : {};
  const dims = cmd.dimensions || {};
  return {
    from: origine,
    to: cmd.ship_to || {},
    parcel: {
      weightG: cmd.weight_g || 0,
      lengthIn: dims.length || 9, widthIn: dims.width || 6, heightIn: dims.height || 1,
    },
    value: cmd.order_total || 0,
    currency: "CAD",
    signature: cmd.confirmation === "signature",
    insurance: cmd.insurance || null,
    customs: cmd.customs || null,
  };
}

async function coter(orderId) {
  const cmd = orders.parId(orderId);
  if (!cmd) throw new Error("commande inconnue");
  if (!cmd.weight_g) throw new Error("poids manquant — corriger la commande avant de coter");
  const envoi = envoiDepuisCommande(cmd);
  const tarifs = await adaptateur().quote(envoi);
  return { envoi, tarifs, recommande: choisirTarif(tarifs, envoi, politiqueTarif(cmd)) };
}

/** Politique de choix : le service imposé sur la commande, sinon le moins cher drop-off d'abord. */
function politiqueTarif(cmd) {
  return {
    serviceImpose: cmd.service_id || null,
    dropOffAutorise: String(cmd.internal_notes || "").includes("[no_dropoff]") ? false : true,
  };
}

// ------------------------------------------------------------------ marge

/**
 * Marge sur un envoi : ce que le client a payé pour la livraison, moins ce que l'étiquette
 * coûte. Exigence A3, constat OBS9 — sur le compte audité la marge d'expédition était de
 * **−703,52 $ en juillet 2026**, et rien dans ShipStation ne le disait avant l'achat.
 *
 * `niveau` : `ok` · `attention` (marge négative) · `alerte` (perte supérieure au seuil).
 * L'achat n'est jamais bloqué — une commande doit pouvoir partir à perte quand c'est le bon
 * choix commercial — mais il faut que ce soit vu.
 */
function marge(cmd, prix) {
  const paye = Number(cmd.shipping_paid || 0);
  const cout = Number(prix || 0);
  const ecart = Math.round((paye - cout) * 100) / 100;
  const seuil = Number(require("./db").reglage("seuil_alerte_marge", 5));
  const niveau = ecart >= 0 ? "ok" : (ecart <= -seuil ? "alerte" : "attention");
  return {
    paye, cout, ecart, niveau, seuil,
    message: ecart >= 0 ? null
      : `Livraison facturée ${paye.toFixed(2)} $, étiquette ${cout.toFixed(2)} $ — perte de ${(-ecart).toFixed(2)} $ sur cette commande.`,
  };
}

// ------------------------------------------------------------------ achat

/**
 * ACHÈTE une étiquette. Argent réel dès que l'adaptateur n'est plus le bouchon.
 * `serviceId` facultatif : sans lui, on prend le tarif recommandé (rate shopping).
 *
 * `margeMax` (facultatif) refuse l'achat si la perte dépasse ce montant : c'est le garde-fou
 * des achats en lot, où personne ne lit ligne à ligne.
 */
async function acheterEtiquette(orderId, { serviceId = null, userId = null, batchId = null, margeMax = null } = {}) {
  const cmd = orders.parId(orderId);
  if (!cmd) throw new Error("commande inconnue");
  if (cmd.status === "shipped") throw new Error("commande déjà expédiée");
  const { envoi, tarifs, recommande } = await coter(orderId);
  const choisi = serviceId ? tarifs.find((t) => t.serviceId === serviceId) : recommande;
  if (!choisi) throw new Error(serviceId ? `service indisponible : ${serviceId}` : "aucun tarif applicable");

  const m = marge(cmd, choisi.price);
  if (margeMax !== null && m.ecart < -Math.abs(Number(margeMax)))
    throw new Error(`perte de ${(-m.ecart).toFixed(2)} $ supérieure au plafond de ${Number(margeMax).toFixed(2)} $ — ${m.message}`);

  const label = await adaptateur().buy(envoi, choisi.serviceId);

  return tx(() => {
    run(`INSERT INTO shipments (order_id,batch_id,label_id,tracking_number,carrier_code,service_id,
           package_id,confirmation,cost,currency,drop_off,ship_date,created_at,weight_g,dimensions,
           ship_to,warehouse_id,is_return,label_pdf,customs_pdf,user_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)`,
      orderId, batchId, label.labelId, label.trackingNumber, choisi.carrier, choisi.serviceId,
      cmd.package_id, cmd.confirmation, label.price, label.currency || "CAD",
      choisi.dropOff ? 1 : 0, new Date().toISOString().slice(0, 10), maintenant(),
      cmd.weight_g, dump(cmd.dimensions), dump(cmd.ship_to), cmd.warehouse_id,
      label.labelPdf || null, label.customsPdf || null, userId);
    const shipmentId = one("SELECT last_insert_rowid() r").r;
    orders.changerStatut(orderId, "shipped", userId);
    journaliser("shipment.buy", "shipment", shipmentId,
      { orderId, service: choisi.serviceId, prix: label.price, dropOff: !!choisi.dropOff }, userId);
    // Le renvoi du suivi vers la boutique part en arrière-plan : un canal indisponible ne doit
    // jamais faire échouer un achat déjà payé. L'échec reste dans la file de reprise.
    setImmediate(() => require("./channels").notifier(shipmentId).catch(() => {}));
    return { shipmentId, ...label, dropOff: !!choisi.dropOff, marge: m };
  });
}

/** Étiquette de retour — rattachée à la commande, comptée à part. */
async function acheterRetour(orderId, { serviceId = null, userId = null } = {}) {
  const cmd = orders.parId(orderId);
  if (!cmd) throw new Error("commande inconnue");
  const envoi = envoiDepuisCommande(cmd);
  const retour = { ...envoi, from: envoi.to, to: envoi.from, isReturn: true };
  const tarifs = await adaptateur().quote(retour);
  const choisi = serviceId ? tarifs.find((t) => t.serviceId === serviceId) : choisirTarif(tarifs, retour);
  if (!choisi) throw new Error("aucun tarif applicable pour le retour");
  const label = await adaptateur().buy(retour, choisi.serviceId);
  run(`INSERT INTO shipments (order_id,label_id,tracking_number,carrier_code,service_id,cost,currency,
         ship_date,created_at,weight_g,ship_to,is_return,label_pdf,user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
    orderId, label.labelId, label.trackingNumber, choisi.carrier, choisi.serviceId,
    label.price, label.currency || "CAD", new Date().toISOString().slice(0, 10), maintenant(),
    cmd.weight_g, dump(retour.to), label.labelPdf || null, userId);
  const id = one("SELECT last_insert_rowid() r").r;
  journaliser("shipment.return", "shipment", id, { orderId }, userId);
  return { shipmentId: id, ...label };
}

/** Annule une étiquette. Remise de la commande en file si c'était son unique expédition. */
async function annuler(shipmentId, userId = null) {
  const s = one("SELECT * FROM shipments WHERE id = ?", shipmentId);
  if (!s) throw new Error("expédition inconnue");
  if (s.voided) throw new Error("étiquette déjà annulée");
  const r = await adaptateur().void_(s.label_id);
  run("UPDATE shipments SET voided = 1, voided_at = ? WHERE id = ?", maintenant(), shipmentId);
  const restantes = one("SELECT COUNT(*) n FROM shipments WHERE order_id = ? AND voided = 0 AND is_return = 0", s.order_id).n;
  if (!restantes && s.order_id) orders.changerStatut(s.order_id, "awaiting_shipment", userId);
  journaliser("shipment.void", "shipment", shipmentId, r, userId);
  return r;
}

/** Marque expédié sans acheter d'étiquette — l'équivalent des « fulfillments ». */
function marquerExpedie(orderId, { carrier, trackingNumber, shipDate, userId = null, notifier = true } = {}) {
  const cmd = orders.parId(orderId);
  if (!cmd) throw new Error("commande inconnue");
  run(`INSERT INTO shipments (order_id,tracking_number,carrier_code,cost,ship_date,created_at,
         ship_to,warehouse_id,user_id) VALUES (?,?,?,0,?,?,?,?,?)`,
    orderId, trackingNumber || null, carrier || null,
    shipDate || new Date().toISOString().slice(0, 10), maintenant(),
    dump(cmd.ship_to), cmd.warehouse_id, userId);
  const id = one("SELECT last_insert_rowid() r").r;
  orders.changerStatut(orderId, "shipped", userId);
  journaliser("shipment.mark_shipped", "shipment", id, { orderId, notifier }, userId);
  if (notifier) setImmediate(() => require("./channels").notifier(id).catch(() => {}));
  return { shipmentId: id, notifier };
}

// ------------------------------------------------------------------ lots

function creerLot(orderIds, { name = null, userId = null } = {}) {
  run("INSERT INTO batches (name, created_at, created_by, status) VALUES (?,?,?,'open')",
    name || `Lot du ${new Date().toISOString().slice(0, 16).replace("T", " ")}`, maintenant(), userId);
  const batchId = one("SELECT last_insert_rowid() r").r;
  journaliser("batch.create", "batch", batchId, { n: orderIds.length }, userId);
  return { batchId, orderIds };
}

/**
 * Traite un lot : achète les étiquettes une à une, poursuit malgré les échecs et rend le
 * détail. C'est le comportement attendu — une commande sans poids ne doit pas faire échouer
 * les 199 autres.
 */
async function traiterLot(batchId, orderIds, { userId = null, serviceId = null } = {}) {
  run("UPDATE batches SET status = 'processing' WHERE id = ?", batchId);
  const resultats = [];
  for (const orderId of orderIds) {
    try {
      const r = await acheterEtiquette(orderId, { serviceId, userId, batchId });
      resultats.push({ orderId, ok: true, ...r });
    } catch (e) {
      resultats.push({ orderId, ok: false, erreur: String(e.message || e) });
    }
  }
  const echecs = resultats.filter((r) => !r.ok).length;
  run("UPDATE batches SET status = ? WHERE id = ?", echecs ? "error" : "done", batchId);
  // Un lot de 200 étiquettes, c'est 200 suivis à renvoyer : on vide la file d'un coup.
  await require("./channels").traiterFile({ limite: resultats.length + 10 }).catch(() => {});
  journaliser("batch.process", "batch", batchId,
    { total: resultats.length, echecs, cout: resultats.filter(r => r.ok).reduce((s, r) => s + (r.price || 0), 0) }, userId);
  return { batchId, total: resultats.length, reussis: resultats.length - echecs, echecs, resultats };
}

const lot = (id) => ({
  ...one("SELECT * FROM batches WHERE id = ?", id),
  shipments: all("SELECT s.*, o.order_number FROM shipments s LEFT JOIN orders o ON o.id = s.order_id WHERE s.batch_id = ?", id),
});

const lots = () => all(`SELECT b.*, COUNT(s.id) n, COALESCE(SUM(s.cost),0) cout
                        FROM batches b LEFT JOIN shipments s ON s.batch_id = b.id
                        GROUP BY b.id ORDER BY b.id DESC LIMIT 100`);

// ------------------------------------------------------------------ manifestes

/**
 * Clôture de fin de journée. En drop-off, beaucoup de transporteurs ne l'exigent pas —
 * le document reste utile comme bordereau de dépôt et comme trace interne.
 */
function creerManifeste(carrierCode, { shipDate = null, warehouseId = null, userId = null } = {}) {
  const date = shipDate || new Date().toISOString().slice(0, 10);
  const candidates = all(
    `SELECT * FROM shipments WHERE carrier_code = ? AND ship_date = ? AND voided = 0
       AND manifest_id IS NULL ${warehouseId ? "AND warehouse_id = ?" : ""}`,
    ...(warehouseId ? [carrierCode, date, warehouseId] : [carrierCode, date]));
  if (!candidates.length) throw new Error("aucune expédition à clôturer pour ce transporteur et cette date");

  run(`INSERT INTO manifests (carrier_code, warehouse_id, created_at, ship_date, shipment_count, document, status)
       VALUES (?,?,?,?,?,?, 'created')`,
    carrierCode, warehouseId, maintenant(), date, candidates.length,
    dump({ trackingNumbers: candidates.map((s) => s.tracking_number).filter(Boolean) }));
  const manifestId = one("SELECT last_insert_rowid() r").r;
  for (const s of candidates) run("UPDATE shipments SET manifest_id = ? WHERE id = ?", manifestId, s.id);
  journaliser("manifest.create", "manifest", manifestId, { carrierCode, date, n: candidates.length }, userId);
  return { manifestId, carrierCode, date, shipments: candidates.length };
}

const manifestes = () => all("SELECT * FROM manifests ORDER BY id DESC LIMIT 100");

// ------------------------------------------------------------------ recherche et suivi

const TRIABLE = new Set(["ship_date", "created_at", "cost", "tracking_number", "carrier_code"]);

function chercher(f = {}) {
  const w = [], p = [];
  const add = (sql, ...v) => { w.push(sql); p.push(...v); };
  if (f.tracking_number) add("s.tracking_number LIKE ?", `%${f.tracking_number}%`);
  if (f.order_number) add("o.order_number LIKE ?", `%${f.order_number}%`);
  if (f.carrier_code) add("s.carrier_code = ?", f.carrier_code);
  if (f.batch_id) add("s.batch_id = ?", Number(f.batch_id));
  if (f.date_from) add("s.ship_date >= ?", f.date_from);
  if (f.date_to) add("s.ship_date <= ?", f.date_to);
  if (f.voided === "oui") add("s.voided = 1");
  if (f.voided === "non") add("s.voided = 0");
  if (f.returns === "oui") add("s.is_return = 1");
  if (f.drop_off === "oui") add("s.drop_off = 1");
  if (f.no_manifest) add("s.manifest_id IS NULL");
  const where = w.length ? "WHERE " + w.join(" AND ") : "";
  const tri = TRIABLE.has(f.sort) ? f.sort : "created_at";
  const sens = f.dir === "asc" ? "ASC" : "DESC";
  const total = one(`SELECT COUNT(*) n FROM shipments s LEFT JOIN orders o ON o.id = s.order_id ${where}`, ...p).n;
  const lignes = all(
    `SELECT s.*, o.order_number, o.customer_name FROM shipments s
     LEFT JOIN orders o ON o.id = s.order_id ${where}
     ORDER BY s.${tri} ${sens} LIMIT ? OFFSET ?`, ...p, Math.min(Number(f.limit) || 200, 1000), Number(f.offset) || 0);
  return {
    total,
    shipments: lignes.map((s) => ({ ...s, ship_to: parse(s.ship_to, {}), voided: !!s.voided,
      is_return: !!s.is_return, drop_off: !!s.drop_off, label_pdf: undefined, customs_pdf: undefined })),
    cout_total: one(`SELECT COALESCE(SUM(s.cost),0) c FROM shipments s LEFT JOIN orders o ON o.id = s.order_id ${where}`, ...p).c,
  };
}

async function rafraichirSuivi(shipmentId) {
  const s = one("SELECT * FROM shipments WHERE id = ?", shipmentId);
  if (!s || !s.label_id) throw new Error("expédition sans étiquette");
  const evts = await adaptateur().track(s.label_id);
  for (const e of evts) {
    run(`INSERT OR IGNORE INTO tracking_events (shipment_id, occurred_at, status, description, location)
         VALUES (?,?,?,?,?)`, shipmentId, e.date || maintenant(), e.status || "", e.description || "", e.location || null);
  }
  return all("SELECT * FROM tracking_events WHERE shipment_id = ? ORDER BY occurred_at", shipmentId);
}

module.exports = {
  marge,
  coter, acheterEtiquette, acheterRetour, annuler, marquerExpedie,
  creerLot, traiterLot, lot, lots, creerManifeste, manifestes,
  chercher, rafraichirSuivi, envoiDepuisCommande, SEUIL_DROPOFF_G,
};
