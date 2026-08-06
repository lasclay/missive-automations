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
const { all, one, run, tx, parse, dump, maintenant, sansAccent, journaliser } = require("./db");
const orders = require("./orders");
const { adaptateur, choisirTarif, SEUIL_DROPOFF_G } = require("./carrier");

// ------------------------------------------------------------------ cotation

/** Construit l'objet d'envoi attendu par l'adaptateur à partir d'une commande. */
/**
 * Le montant à assurer, en dollars, quelle que soit la façon dont il a été écrit.
 *
 * Trois formes cohabitent en base, et les adaptateurs n'en attendaient qu'une — un nombre.
 * ShipStation écrit `{provider, insureShipment, insuredValue}` ; l'écran d'expédition du clone
 * écrit `{montant, devise}` ; une règle d'automatisation peut poser un nombre nu. Passer
 * l'objet tel quel à Freightcom donnait `NaN` en cents, et à Chit Chats un `!!objet` toujours
 * vrai — donc une assurance demandée là où personne ne l'avait demandée, ou l'inverse.
 *
 * Ce n'est pas un détail de forme : XCover appartient à ShipStation et disparaît avec
 * l'abonnement. À partir de là, la seule assurance disponible est celle que le transporteur
 * ou le courtier vend par l'API, et elle ne part que si ce montant arrive juste.
 */
function montantAssure(v) {
  if (v === null || v === undefined || v === false) return 0;
  if (typeof v === "number") return v > 0 ? v : 0;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }
  if (typeof v !== "object") return 0;
  // ShipStation : un montant sans `insureShipment` ne doit pas partir.
  if ("insureShipment" in v) return v.insureShipment ? Number(v.insuredValue || 0) || 0 : 0;
  const n = Number(v.montant ?? v.amount ?? v.valeur ?? v.value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function envoiDepuisCommande(cmd) {
  const entrepot = cmd.warehouse_id
    ? one("SELECT * FROM warehouses WHERE id = ?", cmd.warehouse_id)
    : one("SELECT * FROM warehouses ORDER BY is_default DESC, id LIMIT 1");
  const origine = entrepot ? parse(entrepot.origin_address, {}) : {};
  const dims = cmd.dimensions || {};
  return {
    // Chit Chats n a pas d endpoint de cotation : il faut créer un brouillon d expédition
    // pour connaître un prix. L identifiant de commande est ce qui permet de le retrouver et
    // de le réutiliser à l achat, au lieu d en créer un second à chaque cotation.
    orderId: cmd.id,
    // La boutique d origine, pour les fournisseurs qui la demandent (Chit Chats en a une
    // liste fermée de dix valeurs). Le marché de la boutique, pas son nom.
    boutique: (one("SELECT marketplace FROM stores WHERE id = ?", cmd.store_id) || {}).marketplace || null,
    description: (cmd.items || []).map((i) => i.name).filter(Boolean)[0] || null,
    from: origine,
    to: cmd.ship_to || {},
    parcel: {
      weightG: cmd.weight_g || 0,
      lengthIn: dims.length || 9, widthIn: dims.width || 6, heightIn: dims.height || 1,
    },
    value: cmd.order_total || 0,
    currency: "CAD",
    signature: cmd.confirmation === "signature",
    insurance: montantAssure(cmd.insurance) || null,
    customs: cmd.customs || null,
  };
}

/**
 * `fournisseur` permet de coter chez un autre que celui de `CARRIER_ADAPTER` — c'est ce qui
 * rend le premier menu de l'écran d'expédition possible, et ce qui permettra de comparer un
 * courtier à un compte propre sans changer une variable d'environnement.
 */
async function coter(orderId, { fournisseur = null } = {}) {
  const cmd = orders.parId(orderId);
  if (!cmd) throw new Error("commande inconnue");
  if (!cmd.weight_g) throw new Error("poids manquant — corriger la commande avant de coter");
  const envoi = envoiDepuisCommande(cmd);

  // « tous » : interroger chaque fournisseur configuré et fondre les résultats.
  //
  // C'est le seul mode qui répond à la vraie question — quel est le prix le plus bas, tous
  // comptes confondus. Sur la commande L-50145 : Chit Chats 7,25 $, Freightcom 7,28 $,
  // ShipStation 11,82 $. Sans vue commune, il faut changer de fournisseur à la main pour
  // voir trois cents d'écart, et personne ne le fait vingt fois par jour.
  if (fournisseur === "tous") return await coterPartout(cmd, envoi);

  const a = fournisseur ? adaptateur(fournisseur) : adaptateur();
  const tarifs = await a.quote(envoi);
  return { envoi, tarifs, fournisseur: a.nom,
    recommande: choisirTarif(tarifs, envoi, politiqueTarif(cmd)) };
}

/**
 * Cotation croisée. Un fournisseur en panne n'empêche pas les autres de répondre : son échec
 * est rapporté à côté des tarifs, jamais à leur place. Une comparaison amputée qui ne le dit
 * pas ferait choisir le moins cher d'une liste incomplète.
 */
async function coterPartout(cmd, envoi) {
  const { fournisseurs } = require("./carrier");
  const dispo = fournisseurs().filter((f) => f.configure && !f.demonstration);
  const liste = dispo.length ? dispo : fournisseurs().filter((f) => f.demonstration);

  const resultats = await Promise.all(liste.map(async (f) => {
    try {
      const tarifs = await adaptateur(f.nom).quote(envoi);
      // Chaque tarif porte son fournisseur : sans ça, deux services homonymes chez deux
      // courtiers deviennent indiscernables au moment d'acheter.
      return { nom: f.nom, libelle: f.libelle, tarifs: tarifs.map((t) => ({ ...t, fournisseur: f.nom })) };
    } catch (e) { return { nom: f.nom, libelle: f.libelle, tarifs: [], erreur: String(e.message || e) }; }
  }));

  const tarifs = resultats.flatMap((r) => r.tarifs)
    .sort((a, b) => (a.prixHT ?? a.price ?? 1e9) - (b.prixHT ?? b.price ?? 1e9));
  return {
    envoi, tarifs, fournisseur: "tous",
    sources: resultats.map((r) => ({ nom: r.nom, libelle: r.libelle, n: r.tarifs.length, erreur: r.erreur || null })),
    incomplet: resultats.some((r) => r.erreur),
    recommande: choisirTarif(tarifs, envoi, politiqueTarif(cmd)),
  };
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
async function acheterEtiquette(orderId, { serviceId = null, userId = null, batchId = null,
  margeMax = null, fournisseur = null } = {}) {
  const cmd = orders.parId(orderId);
  if (!cmd) throw new Error("commande inconnue");
  if (cmd.status === "shipped") throw new Error("commande déjà expédiée");
  const { envoi, tarifs, recommande } = await coter(orderId, { fournisseur });
  const choisi = serviceId ? tarifs.find((t) => t.serviceId === serviceId) : recommande;
  if (!choisi) throw new Error(serviceId ? `service indisponible : ${serviceId}` : "aucun tarif applicable");

  // L'achat part chez celui qui a donné CE tarif, pas chez le fournisseur par défaut.
  //
  // La cotation croisée marque chaque tarif de sa provenance ; c'est elle qui fait foi. Sans
  // cela, choisir un service Chit Chats dans la liste envoyait quand même l'achat chez
  // Freightcom, avec un identifiant de service qu'il ne connaît pas — et, quand par malchance
  // les deux panels partagent un identifiant, une étiquette achetée chez le mauvais
  // transporteur, au mauvais prix, avec la mauvaise assurance. Chaque fournisseur porte sa
  // propre couverture : Freightcom la vend en `insurance`, Chit Chats en
  // `insurance_requested`, Postes Canada en option `COV`. Router l'achat, c'est aussi router
  // l'assurance.
  const chez = choisi.fournisseur || (fournisseur && fournisseur !== "tous" ? fournisseur : null);
  const a = chez ? adaptateur(chez) : adaptateur();

  const m = marge(cmd, choisi.price);
  if (margeMax !== null && m.ecart < -Math.abs(Number(margeMax)))
    throw new Error(`perte de ${(-m.ecart).toFixed(2)} $ supérieure au plafond de ${Number(margeMax).toFixed(2)} $ — ${m.message}`);

  const label = await a.buy(envoi, choisi.serviceId);

  return tx(() => {
    run(`INSERT INTO shipments (order_id,batch_id,label_id,tracking_number,carrier_code,service_id,
           package_id,confirmation,cost,currency,drop_off,ship_date,created_at,weight_g,dimensions,
           ship_to,warehouse_id,is_return,label_pdf,customs_pdf,user_id,provider)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`,
      orderId, batchId, label.labelId, label.trackingNumber, choisi.carrier, choisi.serviceId,
      cmd.package_id, cmd.confirmation, label.price, label.currency || "CAD",
      choisi.dropOff ? 1 : 0, new Date().toISOString().slice(0, 10), maintenant(),
      cmd.weight_g, dump(cmd.dimensions), dump(cmd.ship_to), cmd.warehouse_id,
      label.labelPdf || null, label.customsPdf || null, userId, a.nom || chez || null);
    const shipmentId = one("SELECT last_insert_rowid() r").r;
    orders.changerStatut(orderId, "shipped", userId);
    // Le numéro de suivi entre dans l'index de recherche : c'est par lui qu'on retombe sur
    // une commande quand un client écrit « où est mon colis 1234567890 ».
    orders.indexerRecherche(orderId);
    journaliser("shipment.buy", "shipment", shipmentId,
      { orderId, fournisseur: a.nom || chez, service: choisi.serviceId, prix: label.price,
        assurance: envoi.insurance || 0, dropOff: !!choisi.dropOff }, userId);
    // Le renvoi du suivi vers la boutique part en arrière-plan : un canal indisponible ne doit
    // jamais faire échouer un achat déjà payé. L'échec reste dans la file de reprise.
    setImmediate(() => require("./channels").notifier(shipmentId).catch(() => {}));
    return { shipmentId, ...label, dropOff: !!choisi.dropOff, marge: m };
  });
}

/** Étiquette de retour — rattachée à la commande, comptée à part. */
async function acheterRetour(orderId, { serviceId = null, userId = null, fournisseur = null } = {}) {
  const cmd = orders.parId(orderId);
  if (!cmd) throw new Error("commande inconnue");
  const envoi = envoiDepuisCommande(cmd);
  const retour = { ...envoi, from: envoi.to, to: envoi.from, isReturn: true };
  // Un seul fournisseur du début à la fin : coter chez l'un et acheter chez l'autre donnerait
  // un identifiant de service inconnu, ou pire, un homonyme.
  const a = adaptateur(fournisseur || undefined);
  const tarifs = await a.quote(retour);
  const choisi = serviceId ? tarifs.find((t) => t.serviceId === serviceId) : choisirTarif(tarifs, retour);
  if (!choisi) throw new Error("aucun tarif applicable pour le retour");
  const label = await a.buy(retour, choisi.serviceId);
  run(`INSERT INTO shipments (order_id,label_id,tracking_number,carrier_code,service_id,cost,currency,
         ship_date,created_at,weight_g,ship_to,is_return,label_pdf,user_id,provider)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`,
    orderId, label.labelId, label.trackingNumber, choisi.carrier, choisi.serviceId,
    label.price, label.currency || "CAD", new Date().toISOString().slice(0, 10), maintenant(),
    cmd.weight_g, dump(retour.to), label.labelPdf || null, userId, a.nom || fournisseur || null);
  const id = one("SELECT last_insert_rowid() r").r;
  journaliser("shipment.return", "shipment", id, { orderId }, userId);
  return { shipmentId: id, ...label };
}

/** Annule une étiquette. Remise de la commande en file si c'était son unique expédition. */
async function annuler(shipmentId, userId = null) {
  const s = one("SELECT * FROM shipments WHERE id = ?", shipmentId);
  if (!s) throw new Error("expédition inconnue");
  if (s.voided) throw new Error("étiquette déjà annulée");
  // Chez celui qui l'a vendue. Une étiquette Chit Chats présentée à Freightcom est un
  // identifiant inconnu : l'annulation échoue, et le remboursement est perdu.
  const r = await adaptateur(s.provider || undefined).void_(s.label_id);
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
  orders.indexerRecherche(orderId);
  journaliser("shipment.mark_shipped", "shipment", id, { orderId, notifier }, userId);
  if (notifier) setImmediate(() => require("./channels").notifier(id).catch(() => {}));
  return { shipmentId: id, notifier };
}

// ------------------------------------------------------------------ lots

/**
 * Crée un lot **vide**. Chez ShipStation un lot est d'abord un contenant : on y dépose des
 * commandes au fil du tri, et l'achat des étiquettes vient plus tard. Le lot du panneau
 * gauche est donc un objet de premier ordre, pas un sous-produit d'un achat groupé.
 */
/**
 * Un nom de lot qui n'est pas déjà pris — BUG relevé à l'audit : « Créer un lot » proposait
 * par défaut `Lot du 2026-08-02`, identique au lot déjà ouvert, et la liste des lots ouverts
 * n'a pas de colonne identifiant pour distinguer les doublons. Deux lots homonymes dans le
 * panneau gauche, c'est une commande déposée dans le mauvais et découverte à l'expédition.
 *
 * Le nom reste lisible : on suffixe « (2) », « (3) »… plutôt que d'y coller un horodatage.
 */
function nomDeLotLibre(base = null) {
  const racine = (base || `Lot du ${new Date().toISOString().slice(0, 10)}`).trim();
  const pris = new Set(all("SELECT name FROM batches WHERE status = 'open'").map((b) => (b.name || "").trim()));
  if (!pris.has(racine)) return racine;
  for (let i = 2; i < 200; i++) if (!pris.has(`${racine} (${i})`)) return `${racine} (${i})`;
  return `${racine} ${new Date().toISOString().slice(11, 19)}`;
}

function creerLotVide({ name = null, userId = null } = {}) {
  run("INSERT INTO batches (name, created_at, created_by, status) VALUES (?,?,?,'open')",
    nomDeLotLibre(name), maintenant(), userId);
  const batchId = one("SELECT last_insert_rowid() r").r;
  journaliser("batch.create", "batch", batchId, { name }, userId);
  return { batchId };
}

/** Dépose des commandes dans un lot. Une commande n'appartient qu'à un lot à la fois. */
function ajouterAuLot(batchId, orderIds, userId = null) {
  const b = one("SELECT * FROM batches WHERE id = ?", batchId);
  if (!b) throw new Error("lot inconnu");
  if (b.status !== "open") throw new Error(`le lot « ${b.name} » n'est plus ouvert`);
  let n = 0;
  tx(() => { for (const id of orderIds) { run("UPDATE orders SET batch_id = ? WHERE id = ?", batchId, Number(id)); n++; } });
  journaliser("batch.add", "batch", batchId, { n }, userId);
  return { batchId, ajoutees: n, nom: b.name };
}

/** Retire des commandes de leur lot, sans le supprimer. */
function retirerDuLot(orderIds, userId = null) {
  let n = 0;
  tx(() => { for (const id of orderIds) { run("UPDATE orders SET batch_id = NULL WHERE id = ?", Number(id)); n++; } });
  journaliser("batch.remove", "order", null, { n }, userId);
  return { retirees: n };
}

/** Lots ouverts, avec le nombre de commandes qui y attendent — le panneau gauche. */
const lotsOuverts = () => all(`
  SELECT b.*, (SELECT COUNT(*) FROM orders o WHERE o.batch_id = b.id AND o.status NOT IN ('shipped','cancelled')) n
  FROM batches b WHERE b.status = 'open' ORDER BY b.id DESC LIMIT 50`);

/** Commandes en attente dans un lot. */
const commandesDuLot = (batchId) => all(
  "SELECT id FROM orders WHERE batch_id = ? AND status NOT IN ('shipped','cancelled') ORDER BY id", batchId)
  .map((r) => r.id);

/** Ferme un lot vide ou traité — il quitte le panneau gauche. */
function fermerLot(batchId, userId = null) {
  run("UPDATE batches SET status = 'done' WHERE id = ?", batchId);
  journaliser("batch.close", "batch", batchId, {}, userId);
  return { ok: true };
}

function creerLot(orderIds, { name = null, userId = null } = {}) {
  run("INSERT INTO batches (name, created_at, created_by, status) VALUES (?,?,?,'open')",
    nomDeLotLibre(name), maintenant(), userId);
  const batchId = one("SELECT last_insert_rowid() r").r;
  journaliser("batch.create", "batch", batchId, { n: orderIds.length }, userId);
  return { batchId, orderIds };
}

/**
 * Traite un lot : achète les étiquettes une à une, poursuit malgré les échecs et rend le
 * détail. C'est le comportement attendu — une commande sans poids ne doit pas faire échouer
 * les 199 autres.
 */
async function traiterLot(batchId, orderIds, { userId = null, serviceId = null, margeMax = null,
  fournisseur = null } = {}) {
  run("UPDATE batches SET status = 'processing' WHERE id = ?", batchId);
  const resultats = [];
  for (const orderId of orderIds) {
    try {
      const r = await acheterEtiquette(orderId, { serviceId, userId, batchId, margeMax, fournisseur });
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
  // La marge du lot est rendue avec le résultat : c'est le chiffre qui manquait au moment où
  // il pouvait encore servir (constat OBS9).
  const marges = resultats.filter((r) => r.ok && r.marge);
  return { batchId, total: resultats.length, reussis: resultats.length - echecs, echecs, resultats,
    marge_lot: Math.round(marges.reduce((s, r) => s + r.marge.ecart, 0) * 100) / 100,
    a_perte: marges.filter((r) => r.marge.ecart < 0).length };
}

const lot = (id) => ({
  ...one("SELECT * FROM batches WHERE id = ?", id),
  shipments: all("SELECT s.*, o.order_number FROM shipments s LEFT JOIN orders o ON o.id = s.order_id WHERE s.batch_id = ?", id),
});

const lots = () => all(`SELECT b.*, COUNT(s.id) n, COALESCE(SUM(s.cost),0) cout,
                          (SELECT COUNT(*) FROM orders o WHERE o.batch_id = b.id) en_attente
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

/**
 * Ce qui reste à clôturer un jour donné, transporteur par transporteur — l'onglet
 * « Open Shipments » de ShipStation, que le clone n'avait pas.
 *
 * Sans ce décompte, le bouton « Clôturer » était actif en permanence, y compris quand il
 * n'y avait rien à clôturer : on apprenait qu'il n'y avait rien à faire *après* avoir
 * cliqué, par un message d'erreur. Et le sélecteur de transporteur n'avait pas de « Tous »,
 * alors qu'une journée mêle Postes Canada et Purolator.
 */
function aCloturer(shipDate = null, warehouseId = null) {
  const date = shipDate || new Date().toISOString().slice(0, 10);
  const lignes = all(
    `SELECT s.carrier_code, COUNT(*) n, SUM(s.cost) cout,
            SUM(CASE WHEN s.drop_off = 1 THEN 1 ELSE 0 END) drop_off
       FROM shipments s
      WHERE s.ship_date = ? AND s.voided = 0 AND s.manifest_id IS NULL
        ${warehouseId ? "AND s.warehouse_id = ?" : ""}
      GROUP BY s.carrier_code ORDER BY n DESC`,
    ...(warehouseId ? [date, warehouseId] : [date]));
  return { date, transporteurs: lignes, total: lignes.reduce((s, l) => s + l.n, 0) };
}

/**
 * Clôture tous les transporteurs d'une journée d'un coup. Une journée de Lasclay mêle
 * Postes Canada et Purolator ; les clôturer un par un multipliait les allers-retours et
 * laissait facilement un transporteur oublié derrière.
 */
function cloturerJournee(shipDate = null, { warehouseId = null, userId = null } = {}) {
  const { date, transporteurs } = aCloturer(shipDate, warehouseId);
  if (!transporteurs.length) throw new Error(`aucune expédition à clôturer le ${date}`);
  return {
    date,
    manifestes: transporteurs.map((t) =>
      creerManifeste(t.carrier_code, { shipDate: date, warehouseId, userId })),
  };
}

// ------------------------------------------------------------------ recherche et suivi

const TRIABLE = new Set(["ship_date", "created_at", "cost", "tracking_number", "carrier_code"]);

function chercher(f = {}) {
  const w = [], p = [];
  const add = (sql, ...v) => { w.push(sql); p.push(...v); };
  if (f.order_id) add("s.order_id = ?", Number(f.order_id));
  if (f.tracking_number) add("sansaccent(COALESCE(s.tracking_number,'')) LIKE ?", `%${sansAccent(f.tracking_number)}%`);
  if (f.order_number) add("sansaccent(COALESCE(o.order_number,'')) LIKE ?", `%${sansAccent(f.order_number)}%`);
  if (f.carrier_code) add("s.carrier_code = ?", f.carrier_code);
  if (f.batch_id) add("s.batch_id = ?", Number(f.batch_id));
  if (f.date_from) add("s.ship_date >= ?", f.date_from);
  if (f.date_to) add("s.ship_date <= ?", f.date_to);
  if (f.voided === "oui") add("s.voided = 1");
  if (f.voided === "non") add("s.voided = 0");
  if (f.returns === "oui") add("s.is_return = 1");
  if (f.drop_off === "oui") add("s.drop_off = 1");
  if (f.no_manifest) add("s.manifest_id IS NULL");
  // Ce qui est parti sans que le client soit prévenu : la seule façon de le rattraper est
  // de pouvoir le lister (BUG-049).
  if (f.non_notifiees) add("s.voided = 0 AND s.shipment_notified_at IS NULL AND o.customer_email IS NOT NULL");
  if (f.boutique_non_notifiee) add("s.voided = 0 AND s.marketplace_notified_at IS NULL AND s.marketplace_notified = 0");
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
  const evts = await adaptateur(s.provider || undefined).track(s.label_id);
  for (const e of evts) {
    run(`INSERT OR IGNORE INTO tracking_events (shipment_id, occurred_at, status, description, location)
         VALUES (?,?,?,?,?)`, shipmentId, e.date || maintenant(), e.status || "", e.description || "", e.location || null);
  }
  return all("SELECT * FROM tracking_events WHERE shipment_id = ? ORDER BY occurred_at", shipmentId);
}

/**
 * Actions en masse sur des expéditions — BUG-050.
 *
 * Toutes suivent la même forme : on traite ce qui peut l'être, on refuse le reste **avec le
 * motif**, et on rend le détail. Un « 12 traitées » sur 15 sélectionnées sans dire lesquelles
 * ni pourquoi oblige à tout revérifier à la main.
 *
 * `annuler_etiquette` n'est pas dans cette liste : l'annulation touche l'argent et passe par
 * `annuler()`, une expédition à la fois, avec sa propre confirmation.
 */
const ACTIONS_MASSE = {
  notifier_client: {
    libelle: "Renvoyer la notification d'expédition",
    possible: (s) => (s.voided ? "étiquette annulée"
      : !s.customer_email ? "aucun courriel client" : null),
    faire: (s) => { run("UPDATE shipments SET shipment_notified_at = ? WHERE id = ?", maintenant(), s.id); },
  },
  notifier_boutique: {
    libelle: "Notifier la boutique",
    possible: (s) => (s.voided ? "étiquette annulée" : !s.order_id ? "commande absente" : null),
    faire: (s) => {
      run("UPDATE shipments SET marketplace_notified = 1, marketplace_notified_at = ? WHERE id = ?",
        maintenant(), s.id);
    },
  },
  bordereau_imprime: {
    libelle: "Marquer le bordereau imprimé",
    possible: () => null,
    faire: (s) => { run("UPDATE shipments SET packing_slip_printed_at = ? WHERE id = ?", maintenant(), s.id); },
  },
  etiquette_imprimee: {
    libelle: "Marquer l'étiquette imprimée",
    possible: (s) => (s.label_id ? null : "aucune étiquette achetée"),
    faire: (s) => { run("UPDATE shipments SET label_printed_at = ? WHERE id = ?", maintenant(), s.id); },
  },
  suivi: {
    libelle: "Mettre à jour le numéro de suivi",
    possible: (s) => (s.voided ? "étiquette annulée" : null),
    faire: (s, opts) => {
      if (!opts || !opts.tracking_number) throw new Error("numéro de suivi requis");
      run("UPDATE shipments SET tracking_number = ? WHERE id = ?", String(opts.tracking_number).trim(), s.id);
    },
  },
};

function actionMasse(action, ids, opts = {}, userId = null) {
  const def = ACTIONS_MASSE[action];
  if (!def) throw new Error(`action inconnue : ${action}`);
  if (!ids || !ids.length) throw new Error("aucune expédition désignée");
  // Le suivi ne se met pas à jour en masse : un même numéro sur dix colis est une erreur,
  // pas un gain de temps.
  if (action === "suivi" && ids.length > 1)
    throw new Error("le numéro de suivi se corrige une expédition à la fois");

  const faites = [], refusees = [];
  tx(() => {
    for (const id of ids) {
      const s = one(`SELECT s.*, o.customer_email, o.order_number FROM shipments s
                     LEFT JOIN orders o ON o.id = s.order_id WHERE s.id = ?`, Number(id));
      if (!s) { refusees.push({ id, motif: "expédition inconnue" }); continue; }
      const motif = def.possible(s);
      if (motif) { refusees.push({ id, order_number: s.order_number, motif }); continue; }
      def.faire(s, opts);
      faites.push({ id, order_number: s.order_number });
    }
  });
  journaliser(`shipment.${action}`, "shipment", null,
    { n: faites.length, refusees: refusees.length }, userId);
  return { action, libelle: def.libelle, faites: faites.length, refusees, detail: faites };
}

module.exports = {
  marge, ACTIONS_MASSE, actionMasse,
  coter, acheterEtiquette, acheterRetour, annuler, marquerExpedie,
  creerLot, creerLotVide, nomDeLotLibre, ajouterAuLot, retirerDuLot, lotsOuverts, commandesDuLot, fermerLot,
  traiterLot, lot, lots, creerManifeste, manifestes, aCloturer, cloturerJournee,
  chercher, rafraichirSuivi, envoiDepuisCommande, montantAssure, SEUIL_DROPOFF_G,
};
