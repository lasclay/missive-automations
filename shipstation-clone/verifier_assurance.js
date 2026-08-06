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

  global.fetch = vraiFetch;
  console.log("\n" + "─".repeat(64));
  console.log(`${echecs ? X : V} ${passes}/${passes + echecs} contrôles passés`);
  console.log(`\n  ${G}Le type Freightcom se prouve contre le compte réel :`);
  console.log(`  node shipstation-clone/verifier_freightcom.js --assurance${R}`);
  if (echecs) process.exit(1);
})().catch((e) => { console.error("\nÉCHEC :", e); process.exit(1); });
