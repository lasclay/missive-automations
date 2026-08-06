/**
 * Vérification de l'assurance — hors ligne, sans clé, sans réseau, sans dépense.
 *
 *   node shipstation-clone/verifier_assurance.js
 *
 * XCover appartient à ShipStation et s'éteint avec l'abonnement. À partir de la bascule, la
 * seule couverture disponible est celle que le transporteur ou le courtier vend par l'API —
 * et elle ne part que si un nombre juste arrive jusqu'au corps de la requête.
 *
 * Trois formes cohabitent en base : celle de ShipStation (`{provider, insureShipment,
 * insuredValue}`), celle de l'écran d'expédition du clone (`{montant, devise}`), et le nombre
 * nu qu'une règle d'automatisation peut poser. Les adaptateurs n'en attendent qu'une. Ce
 * contrôle vérifie que la normalisation les ramène toutes à un nombre, puis que ce nombre
 * arrive intact dans ce que chaque fournisseur reçoit vraiment.
 */
const { montantAssure } = require("./lib/shipments");
const { run } = require("./lib/db");

const V = "\x1b[32m✓\x1b[0m", X = "\x1b[31m✗\x1b[0m", G = "\x1b[90m", R = "\x1b[0m";
let passes = 0, echecs = 0;
const verifier = (t, c, d = "") => {
  if (c) { passes++; console.log(`${V} ${t}${d ? `  ${G}${d}${R}` : ""}`); }
  else { echecs++; console.log(`${X} ${t}${d ? `  ${G}${d}${R}` : ""}`); }
};

const vraiFetch = global.fetch;
function espion(reponses) {
  const vus = [];
  let i = 0;
  global.fetch = async (url, opts) => {
    vus.push({ url: String(url), corps: opts?.body ? JSON.parse(opts.body) : null });
    const r = reponses[Math.min(i++, reponses.length - 1)];
    return { ok: (r.statut || 200) < 400, status: r.statut || 200,
      text: async () => JSON.stringify(r.corps ?? {}) };
  };
  return vus;
}

const ENVOI = {
  from: { name: "Lasclay", street1: "1 rue des Capucins", city: "Québec", state: "QC",
    country: "CA", postalCode: "G1M 2S6", phone: "418-555-0100" },
  to: { name: "Josée Ferland", street1: "12 rue Saint-Denis", city: "Montréal", state: "QC",
    country: "CA", postalCode: "H2X 1Y4", residential: true },
  parcel: { weightG: 483, lengthIn: 9, widthIn: 6, heightIn: 2 },
  value: 42, currency: "CAD",
};

(async () => {
  console.log("\nNormalisation du montant assuré\n" + "─".repeat(64));

  // Les trois formes écrites en base, plus les refus qui comptent autant que les acceptations.
  const cas = [
    ["ShipStation, assurée", { provider: "xcover", insureShipment: true, insuredValue: 250 }, 250],
    ["ShipStation, case décochée", { provider: "xcover", insureShipment: false, insuredValue: 250 }, 0],
    ["écran du clone", { montant: 180, devise: "CAD" }, 180],
    ["nombre nu", 95, 95],
    ["chaîne", "42.50", 42.5],
    ["null", null, 0],
    ["objet vide", {}, 0],
    ["montant négatif", { montant: -10 }, 0],
    ["montant zéro", { montant: 0 }, 0],
  ];
  for (const [nom, entree, attendu] of cas) {
    const r = montantAssure(entree);
    verifier(`${nom} → ${attendu}`, r === attendu, r === attendu ? "" : `obtenu ${r}`);
  }

  // L'objet ShipStation passé tel quel donnait `NaN` en cents chez Freightcom et un booléen
  // toujours vrai chez Chit Chats. Ce contrôle est là pour que la régression se voie.
  verifier("aucune forme ne produit NaN",
    cas.every(([, e]) => Number.isFinite(montantAssure(e))));

  console.log("\nLa règle par défaut\n" + "─".repeat(64));

  // XCover s'appliquait par une règle ShipStation, pas commande par commande. Après la
  // bascule, 51 000 commandes n'ont aucun montant inscrit : sans règle, un lot les
  // expédierait toutes nues. C'est le contrôle qui garde ce filet en place.
  const { assuranceParDefaut } = require("./lib/shipments");
  const { poserReglage } = require("./lib/db");
  poserReglage("assurance_active", "1");
  poserReglage("assurance_defaut", 100);
  poserReglage("assurance_seuil", 300);

  const casRegle = [
    ["commande à 40 $ — jamais plus qu'elle ne vaut", 40, 40],
    ["commande à 150 $ — le plancher", 150, 100],
    ["commande à 299 $ — encore le plancher", 299, 100],
    ["commande à 300 $ — bascule sur la valeur", 300, 300],
    ["commande à 850 $ — la valeur", 850, 850],
  ];
  for (const [nom, total, attendu] of casRegle) {
    const r = assuranceParDefaut({ order_total: total });
    verifier(`${nom} → ${attendu} $`, r === attendu, r === attendu ? "" : `obtenu ${r}`);
  }

  poserReglage("assurance_active", "0");
  verifier("règle désactivée : aucune couverture d'office",
    assuranceParDefaut({ order_total: 850 }) === 0);
  poserReglage("assurance_active", "1");

  // Un montant inscrit sur la commande gagne : la règle comble un vide, elle ne contredit pas.
  const { envoiDepuisCommande } = require("./lib/shipments");
  run("INSERT OR IGNORE INTO warehouses (id,name,origin_address,is_default) VALUES (1,'T','{}',1)");
  const envoiDe = (total, insurance) => envoiDepuisCommande({
    id: 1, store_id: null, warehouse_id: null, order_total: total, ship_to: {},
    weight_g: 100, insurance, items: [] });
  verifier("la règle s'applique quand la commande ne dit rien",
    envoiDe(850, null).insurance === 850);
  verifier("un montant inscrit l'emporte sur la règle",
    envoiDe(850, { montant: 200, devise: "CAD" }).insurance === 200);
  // Le cas ShipStation « case décochée » vaut 0 après normalisation : la règle reprend donc
  // la main, et c'est voulu — sans elle ce colis partirait nu.
  verifier("case ShipStation décochée : la règle reprend la main",
    envoiDe(850, { insureShipment: false, insuredValue: 900 }).insurance === 850);

  console.log("\nCe que chaque fournisseur reçoit vraiment\n" + "─".repeat(64));

  // -- Freightcom : montant en **cents, chaîne** ; le type est réglable.
  {
    process.env.FREIGHTCOM_API_KEY = "cle-essai";
    process.env.FREIGHTCOM_ASSURANCE_TYPE = "freightcom";
    const fc = require("./lib/freightcom");
    const vus = espion([
      { corps: { request_id: "r1" } },
      { corps: { status: { done: 1, total: 1, complete: true }, rates: [] } },
    ]);
    try { await fc.coter({ ...ENVOI, insurance: 250 }, { deadlineMs: 2000 }); } catch { /* le vide suffit */ }
    const a = vus[0]?.corps?.details?.insurance;
    verifier("Freightcom — assurance présente", !!a, JSON.stringify(a || null));
    verifier("Freightcom — montant en cents, chaîne", a?.total_cost?.value === "25000",
      `reçu ${JSON.stringify(a?.total_cost?.value)}`);
    verifier("Freightcom — type réglable", a?.type === "freightcom", `reçu ${a?.type}`);

    // Sans assurance, le champ ne doit pas exister : un `insurance` à zéro se facture chez
    // certains transporteurs comme une couverture minimale.
    const vus2 = espion([
      { corps: { request_id: "r2" } },
      { corps: { status: { done: 1, total: 1, complete: true }, rates: [] } },
    ]);
    try { await fc.coter({ ...ENVOI, insurance: 0 }, { deadlineMs: 2000 }); } catch { /* idem */ }
    verifier("Freightcom — aucun champ assurance si montant nul",
      vus2[0]?.corps?.details?.insurance === undefined);
    delete process.env.FREIGHTCOM_ASSURANCE_TYPE;
  }

  // -- Chit Chats : un booléen, pas un montant — la valeur déclarée vient des articles.
  {
    process.env.CHITCHATS_TOKEN = "jeton-essai";
    process.env.CHITCHATS_CLIENT_ID = "0000";
    const cc = require("./lib/chitchats");
    const corps = cc.corpsExpedition({ ...ENVOI, insurance: 250 });
    verifier("Chit Chats — assurance demandée", corps.insurance_requested === true);
    const sans = cc.corpsExpedition({ ...ENVOI, insurance: 0 });
    verifier("Chit Chats — non demandée si montant nul", sans.insurance_requested === false);
    // Le piège d'origine : `!!objet` valait vrai même pour une case décochée.
    const decoche = cc.corpsExpedition({ ...ENVOI,
      insurance: montantAssure({ insureShipment: false, insuredValue: 250 }) });
    verifier("Chit Chats — case ShipStation décochée n'assure pas",
      decoche.insurance_requested === false);
  }

  console.log("\nLa preuve rendue par chaque fournisseur\n" + "─".repeat(64));

  // Un routage qui marche mais qu'on ne voit pas ne vaut rien à l'écran : c'est la promesse
  // « ce colis est assuré » qu'on ne peut pas vérifier après le sinistre. Chaque tarif doit
  // donc porter ce que l'API a répondu — y compris quand elle a répondu « non ».
  {
    process.env.FREIGHTCOM_API_KEY = "cle-essai";
    const fc = require("./lib/freightcom");
    const TARIF = (surcharges) => ({
      carrier_name: "GLS", service_name: "Standard", service_id: "gls-standard",
      total: { currency: "CAD", value: "1106" }, base: { currency: "CAD", value: "900" },
      surcharges, valid_until: { year: 2099, month: 12, day: 31 },
    });

    const couvert = fc.lireTarif(TARIF([
      { type: "fuel", name: "Carburant", amount: { currency: "CAD", value: "60" } },
      { type: "insurance", name: "Declared Value Coverage", amount: { currency: "CAD", value: "350" } },
    ]), 240);
    verifier("Freightcom — couverture reconnue dans les surcharges", couvert.assurance.appliquee === true);
    verifier("Freightcom — coût de la couverture lu", couvert.assurance.cout === 3.5,
      `${couvert.assurance.cout} $`);
    verifier("Freightcom — champ prouvant la couverture",
      couvert.assurance.mention === "Declared Value Coverage", couvert.assurance.mention);
    verifier("Freightcom — la couverture compte dans le prix HT",
      couvert.prixHT === 13.1, `${couvert.prixHT} $`);

    // Le cas dangereux : l'appel réussit, aucune couverture n'est vendue, le colis part nu.
    const nu = fc.lireTarif(TARIF([{ type: "fuel", name: "Carburant", amount: { currency: "CAD", value: "60" } }]), 240);
    verifier("Freightcom — demandée sans réponse : signalée", nu.assurance.appliquee === false && !!nu.assurance.note,
      nu.assurance.note);
    const rien = fc.lireTarif(TARIF([]), 0);
    verifier("Freightcom — rien demandé, rien promis",
      rien.assurance.appliquee === false && rien.assurance.demandee === 0);
  }

  {
    process.env.CHITCHATS_TOKEN = "jeton-essai";
    process.env.CHITCHATS_CLIENT_ID = "0000";
    const cc = require("./lib/chitchats");
    const t = cc.lireTarif({ postage_type: "chit_chats_us_edge", postage_description: "US Edge",
      purchase_amount: "7.25", payment_amount: "7.25",
      insurance_description: "Chit Chats Insurance up to $100" }, { insurance_requested: true });
    verifier("Chit Chats — couverture reconnue", t.assurance.appliquee === true, t.assurance.mention);
    verifier("Chit Chats — type nommé", t.assurance.type === "chitchats");
    const sans = cc.lireTarif({ postage_type: "chit_chats_canada_tracked",
      purchase_amount: "7.14", payment_amount: "7.14" }, { insurance_requested: true });
    verifier("Chit Chats — demandée sans réponse : signalée",
      sans.assurance.appliquee === false && !!sans.assurance.note, sans.assurance.note);
  }

  global.fetch = vraiFetch;
  console.log("\n" + "─".repeat(64));
  console.log(`${echecs ? X : V} ${passes}/${passes + echecs} contrôles passés`);
  console.log(`\n  ${G}Le type Freightcom se prouve contre le compte réel :`);
  console.log(`  node shipstation-clone/verifier_freightcom.js --assurance${R}`);
  if (echecs) process.exit(1);
})().catch((e) => { console.error("\nÉCHEC :", e); process.exit(1); });
