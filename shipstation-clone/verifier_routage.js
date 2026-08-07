/**
 * Vérification du routage par fournisseur — hors ligne, sans clé, sans réseau, sans dépense.
 *
 *   node shipstation-clone/verifier_routage.js
 *
 * Le clone compare plusieurs fournisseurs avant d'acheter. Rien ne garantit que le gagnant
 * soit celui du réglage par défaut — c'est même tout l'intérêt de comparer. Encore faut-il
 * que la suite du geste aille au même endroit : l'achat chez celui qui a donné le tarif,
 * l'annulation chez celui qui a vendu l'étiquette, le suivi chez celui qui la transporte.
 *
 * Et l'assurance avec. Chaque fournisseur porte la sienne — Freightcom la vend dans
 * `insurance`, Chit Chats dans `insurance_requested`, Postes Canada en option `COV`. Router
 * l'achat, c'est router l'assurance : un colis acheté chez le mauvais fournisseur part avec
 * la mauvaise couverture, ou sans aucune.
 */
const V = "\x1b[32m✓\x1b[0m", X = "\x1b[31m✗\x1b[0m", G = "\x1b[90m", R = "\x1b[0m";
let passes = 0, echecs = 0;
const verifier = (t, c, d = "") => {
  if (c) { passes++; console.log(`${V} ${t}${d ? `  ${G}${d}${R}` : ""}`); }
  else { echecs++; console.log(`${X} ${t}${d ? `  ${G}${d}${R}` : ""}`); }
};

const carrier = require("./lib/carrier");
const { all, one, run } = require("./lib/db");

/**
 * Deux fournisseurs de laboratoire, distincts jusque dans leurs identifiants de service.
 * Chacun note ce qu'on lui demande — c'est la trace qui sert de preuve.
 */
const journal = [];
function faux(nom, prefixe) {
  return {
    nom,
    async quote(envoi) {
      journal.push({ nom, geste: "quote", assurance: envoi.insurance ?? null });
      return [{ serviceId: `${prefixe}-express`, service: `${nom} Express`, carrier: nom,
        price: nom === "alpha" ? 9.5 : 7.25, prixHT: nom === "alpha" ? 9.5 : 7.25 }];
    },
    async buy(envoi, serviceId) {
      journal.push({ nom, geste: "buy", serviceId, assurance: envoi.insurance ?? null });
      return { labelId: `${prefixe}-L1`, trackingNumber: `${prefixe}-T1`, price: 7.25, currency: "CAD" };
    },
    async void_(labelId) { journal.push({ nom, geste: "void", labelId }); return { ok: true }; },
    async track(labelId) { journal.push({ nom, geste: "track", labelId }); return []; },
  };
}

const vraiAdaptateur = carrier.adaptateur;
const vraiFournisseurs = carrier.fournisseurs;

(async () => {
  // On remplace la résolution d'adaptateur, pas les modules : c'est exactement le point de
  // bascule qu'on veut éprouver.
  const FAUX = { alpha: faux("alpha", "A"), beta: faux("beta", "B") };
  carrier.adaptateur = (nom = "alpha") => FAUX[nom] || vraiAdaptateur(nom);
  carrier.fournisseurs = () => [
    { nom: "alpha", libelle: "Alpha", configure: true, demonstration: false },
    { nom: "beta", libelle: "Beta", configure: true, demonstration: false },
  ];

  // `shipments` capture `adaptateur` à l'import : il faut le charger APRÈS la substitution.
  const shipments = require("./lib/shipments");

  run("INSERT OR IGNORE INTO warehouses (id,name,origin_address,is_default) VALUES (1,'T',?,1)",
    JSON.stringify({ name: "Lasclay", street1: "1 rue des Capucins", city: "Québec",
      state: "QC", country: "CA", postalCode: "G1M 2S6", phone: "418-555-0100" }));
  run("INSERT OR IGNORE INTO stores (id,name,marketplace) VALUES (77,'T','shopify')");
  run(`INSERT INTO orders (order_key,order_number,store_id,status,order_date,ship_to,weight_g,
         warehouse_id,shipping_paid,order_total,insurance)
       VALUES (?,?,77,'awaiting_shipment','2026-08-06',?,483,1,12,240,?)`,
    `rt-${Date.now()}`, `L-ROUTE-${Date.now() % 100000}`,
    JSON.stringify({ name: "Josée Ferland", street1: "12 rue Saint-Denis", city: "Montréal",
      state: "QC", country: "CA", postalCode: "H2X 1Y4", residential: true }),
    // La forme ShipStation : c'est celle des 38 000 commandes migrées.
    JSON.stringify({ provider: "xcover", insureShipment: true, insuredValue: 240 }));
  const id = one("SELECT last_insert_rowid() r").r;

  console.log("\nCotation croisée puis achat\n" + "─".repeat(64));

  const cot = await shipments.coter(id, { fournisseur: "tous" });
  verifier("les deux fournisseurs répondent", cot.tarifs.length === 2, `${cot.tarifs.length} tarifs`);
  verifier("chaque tarif porte sa provenance",
    cot.tarifs.every((t) => t.fournisseur), cot.tarifs.map((t) => t.fournisseur).join(", "));
  verifier("le moins cher est en tête", cot.tarifs[0].fournisseur === "beta",
    `${cot.tarifs[0].fournisseur} à ${cot.tarifs[0].price} $`);

  // Le cœur du contrôle : on choisit le service de `beta` alors que le défaut est `alpha`.
  journal.length = 0;
  const achat = await shipments.acheterEtiquette(id, { serviceId: "B-express", fournisseur: "tous" });
  const acheteurs = journal.filter((j) => j.geste === "buy");
  verifier("l'achat part chez le fournisseur du tarif retenu",
    acheteurs.length === 1 && acheteurs[0].nom === "beta",
    acheteurs.map((a) => a.nom).join(", ") || "aucun");
  verifier("aucun achat chez le fournisseur par défaut",
    !journal.some((j) => j.geste === "buy" && j.nom === "alpha"));

  // L'assurance suit le même chemin, et sous forme de nombre.
  verifier("le montant assuré arrive à l'achat",
    acheteurs[0] && acheteurs[0].assurance === 240, `reçu ${acheteurs[0]?.assurance}`);
  verifier("la forme ShipStation est normalisée en nombre",
    typeof acheteurs[0]?.assurance === "number");

  const exp = one("SELECT * FROM shipments WHERE id = ?", achat.shipmentId);
  verifier("l'expédition retient son fournisseur", exp.provider === "beta", `provider = ${exp.provider}`);

  console.log("\nAnnulation et suivi — au même endroit\n" + "─".repeat(64));

  journal.length = 0;
  await shipments.rafraichirSuivi(achat.shipmentId);
  const suivis = journal.filter((j) => j.geste === "track");
  verifier("le suivi interroge le vendeur de l'étiquette",
    suivis.length === 1 && suivis[0].nom === "beta", suivis.map((s) => s.nom).join(", ") || "aucun");

  journal.length = 0;
  await shipments.annuler(achat.shipmentId);
  const annules = journal.filter((j) => j.geste === "void");
  verifier("l'annulation part chez le vendeur de l'étiquette",
    annules.length === 1 && annules[0].nom === "beta", annules.map((a) => a.nom).join(", ") || "aucun");

  console.log("\nFournisseur nommé explicitement\n" + "─".repeat(64));

  run("UPDATE orders SET status = 'awaiting_shipment' WHERE id = ?", id);
  journal.length = 0;
  const achat2 = await shipments.acheterEtiquette(id, { serviceId: "A-express", fournisseur: "alpha" });
  verifier("« alpha » demandé, « alpha » servi",
    journal.filter((j) => j.geste === "buy").every((j) => j.nom === "alpha"));
  verifier("l'expédition le retient aussi",
    one("SELECT provider p FROM shipments WHERE id = ?", achat2.shipmentId).p === "alpha");

  console.log("\nLot : chaque commande avec les options qui lui sont mappées\n" + "─".repeat(64));

  // Un lot n'a pas de menu déroulant : on sélectionne cinquante commandes et on lance. C'est
  // le comportement de ShipStation qu'on reproduit — chaque commande part avec SON service,
  // SON assurance, SON fournisseur, et non avec un réglage global appliqué à tout le lot.
  const faireCommande = (numero, service, assurance) => {
    run(`INSERT INTO orders (order_key,order_number,store_id,status,order_date,ship_to,weight_g,
           warehouse_id,shipping_paid,order_total,service_id,insurance)
         VALUES (?,?,77,'awaiting_shipment','2026-08-06',?,483,1,12,240,?,?)`,
      `lot-${numero}`, numero,
      JSON.stringify({ name: "Josée Ferland", street1: "12 rue Saint-Denis", city: "Montréal",
        state: "QC", country: "CA", postalCode: "H2X 1Y4", residential: true }),
      service, assurance === null ? null : JSON.stringify({ montant: assurance, devise: "CAD" }));
    return one("SELECT last_insert_rowid() r").r;
  };
  // Les deux services ont été notés au référentiel par la cotation croisée plus haut.
  // La règle par défaut est éteinte de série — les transporteurs incluent déjà une
  // responsabilité de base. On l'allume ici parce que c'est SON acheminement qu'on éprouve.
  require("./lib/db").poserReglage("assurance_active", "1");
  const chezA = faireCommande("L-LOT-A", "A-express", 300);
  const chezB = faireCommande("L-LOT-B", "B-express", null);

  journal.length = 0;
  const lot = await shipments.traiterLot(
    shipments.creerLotVide({ name: "Lot d'essai" }).batchId, [chezA, chezB], {});
  verifier("les deux étiquettes sont achetées", lot.reussis === 2,
    lot.resultats.map((r) => r.erreur).filter(Boolean).join(" | ") || "");
  const parNom = Object.fromEntries(all(
    "SELECT o.order_number n, s.provider p FROM shipments s JOIN orders o ON o.id = s.order_id " +
    "WHERE o.order_number LIKE 'L-LOT-%'").map((r) => [r.n, r.p]));
  verifier("la commande mappée sur alpha achète chez alpha", parNom["L-LOT-A"] === "alpha", parNom["L-LOT-A"]);
  verifier("la commande mappée sur beta achète chez beta", parNom["L-LOT-B"] === "beta", parNom["L-LOT-B"]);
  verifier("un seul fournisseur global n'a PAS été imposé",
    parNom["L-LOT-A"] !== parNom["L-LOT-B"]);

  // L'assurance suit la commande, pas le lot. Et là où la commande ne dit rien, c'est la
  // règle par défaut qui comble — sinon ce colis-là partirait nu au milieu du lot.
  const achats = journal.filter((j) => j.geste === "buy");
  const chez = (n) => achats.find((a) => a.nom === n);
  verifier("le montant inscrit sur la commande la suit dans le lot",
    chez("alpha")?.assurance === 300, `alpha ${chez("alpha")?.assurance}`);
  verifier("la commande sans montant reçoit la règle par défaut",
    chez("beta")?.assurance === 100, `beta ${chez("beta")?.assurance} (commande à 240 $)`);

  carrier.adaptateur = vraiAdaptateur;
  carrier.fournisseurs = vraiFournisseurs;
  console.log("\n" + "─".repeat(64));
  console.log(`${echecs ? X : V} ${passes}/${passes + echecs} contrôles passés`);
  if (echecs) process.exit(1);
})().catch((e) => { console.error("\nÉCHEC :", e); process.exit(1); });
