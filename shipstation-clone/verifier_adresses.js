#!/usr/bin/env node
/**
 * Autocomplétion d'adresse et menus de régions.
 *
 * Deux moitiés, testées ensemble parce qu'elles servent le même formulaire :
 *
 *   1. `lib/adresses.js` — la traduction des réponses de Google Places en `ship_to`. C'est
 *      là que se jouent les erreurs coûteuses : une province en toutes lettres au lieu du
 *      code, un code postal canadien sans espace, une ville vide sur une adresse rurale.
 *   2. Les listes de pays et de subdivisions du fichier unique, extraites et jouées ici —
 *      un « QC » resté en place sous un pays devenu « États-Unis » est une adresse fausse
 *      qui a l'air remplie.
 *
 * Aucune clé n'est requise : `fetch` est espionné.
 *
 * Usage : node shipstation-clone/verifier_adresses.js
 */
const fs = require("fs");
const path = require("path");

const V = "\x1b[32m✓\x1b[0m", X = "\x1b[31m✗\x1b[0m", G = "\x1b[90m", R = "\x1b[0m";
let ok = 0, ko = 0;
const verifier = (nom, cond, detail = "") => {
  console.log(`  ${cond ? V : X} ${nom}${detail ? `  ${G}${detail}${R}` : ""}`);
  cond ? ok++ : ko++;
};

const vraiFetch = global.fetch;
function espion(reponses) {
  const vus = [];
  let i = 0;
  global.fetch = async (url, opts) => {
    vus.push({ url: String(url), methode: opts?.method || "GET", entetes: opts?.headers || {},
      corps: opts?.body ? JSON.parse(opts.body) : null });
    const r = reponses[Math.min(i++, reponses.length - 1)];
    return { ok: (r.statut || 200) < 400, status: r.statut || 200,
      text: async () => JSON.stringify(r.corps ?? {}) };
  };
  return vus;
}

const CO = (types, long, court = null) => ({ types, longText: long, shortText: court || long });

(async () => {
  console.log("\nAutocomplétion d'adresse\n" + "─".repeat(64));

  const ad = require("./lib/adresses");
  verifier("sans clé, le module se déclare inactif", ad.actif() === false);

  process.env.GOOGLE_MAPS_API_KEY = "cle-essai";
  delete require.cache[require.resolve("./lib/adresses")];
  const a = require("./lib/adresses");
  verifier("avec une clé, le module s'active", a.actif() === true);

  // --------------------------------------------------------------- suggestions
  let vus = espion([{ corps: { suggestions: [{ placePrediction: {
    placeId: "ChIJ-1", place: "places/ChIJ-1",
    text: { text: "220 Railway Close SE, Langdon, AB, Canada" },
    structuredFormat: { mainText: { text: "220 Railway Close SE" },
      secondaryText: { text: "Langdon, AB, Canada" } } } }] } }]);
  const sug = await a.suggestions("220 Railway", { pays: "CA", jeton: "jet-1" });

  verifier("appel sur POST /places:autocomplete",
    vus[0].url.endsWith("/places:autocomplete") && vus[0].methode === "POST", vus[0].url);
  verifier("la clé part en en-tête, jamais dans l'URL",
    vus[0].entetes["X-Goog-Api-Key"] === "cle-essai" && !/key=/.test(vus[0].url));
  verifier("le pays du formulaire restreint la recherche",
    JSON.stringify(vus[0].corps.includedRegionCodes) === '["ca"]',
    "sinon une rue de Langdon en Angleterre remonte devant celle de l'Alberta");
  // Sans jeton de session, Google facture chaque frappe séparément.
  verifier("le jeton de session est transmis", vus[0].corps.sessionToken === "jet-1");
  verifier("seuls les types d'adresse postale sont demandés",
    vus[0].corps.includedPrimaryTypes.includes("street_address"),
    vus[0].corps.includedPrimaryTypes.join(", "));
  verifier("la suggestion est rendue en trois morceaux affichables",
    sug.length === 1 && sug[0].id === "ChIJ-1"
    && sug[0].principal === "220 Railway Close SE" && sug[0].secondaire === "Langdon, AB, Canada");

  // Deux frappes coûtent deux requêtes : on ne part pas avant d'avoir de quoi chercher.
  vus = espion([{ corps: { suggestions: [] } }]);
  const court = await a.suggestions("22", { pays: "CA" });
  verifier("sous trois caractères, aucune requête n'est envoyée",
    court.length === 0 && vus.length === 0, "chaque frappe est facturée");

  // ------------------------------------------------------------------ détails
  vus = espion([{ corps: { formattedAddress: "220 Railway Close SE, Langdon, AB T0J 1X1, Canada",
    addressComponents: [
      CO(["street_number"], "220"),
      CO(["route"], "Railway Close Southeast", "Railway Close SE"),
      CO(["locality", "political"], "Langdon"),
      CO(["administrative_area_level_1", "political"], "Alberta", "AB"),
      CO(["country", "political"], "Canada", "CA"),
      CO(["postal_code"], "T0J 1X1"),
    ] } }]);
  const d = await a.details("ChIJ-1", { jeton: "jet-1" });

  verifier("lecture sur GET /places/{id}", /\/places\/ChIJ-1/.test(vus[0].url), vus[0].url);
  verifier("le masque de champs limite la réponse — et la facture",
    vus[0].entetes["X-Goog-FieldMask"] === "addressComponents,formattedAddress");
  verifier("le jeton de session clôt la session sur le détail",
    /sessionToken=jet-1/.test(vus[0].url));
  verifier("numéro et rue réunis en une ligne d'adresse",
    d.street1 === "220 Railway Close SE", d.street1);
  // La province en toutes lettres se fait refuser à l'achat de l'étiquette.
  verifier("la province sort en code court, pas en toutes lettres",
    d.state === "AB", d.state);
  verifier("le pays aussi", d.country === "CA", d.country);
  verifier("le code postal canadien garde son espace",
    d.postalCode === "T0J 1X1", `${d.postalCode} — Chit Chats refuse « T0J1X1 »`);
  verifier("la ville est lue", d.city === "Langdon", d.city);

  // Une adresse rurale ou britannique n'a pas de `locality` : une ville vide bloque la
  // cotation sans dire pourquoi.
  espion([{ corps: { addressComponents: [
    CO(["street_number"], "10"), CO(["route"], "High Street"),
    CO(["postal_town"], "Ipswich"),
    CO(["administrative_area_level_1"], "England", "ENG"),
    CO(["country"], "United Kingdom", "GB"), CO(["postal_code"], "IP1 3QJ")] } }]);
  const gb = await a.details("ChIJ-2");
  verifier("sans locality, postal_town prend le relais", gb.city === "Ipswich", gb.city);

  // Un appartement doit atterrir en ligne 2, pas se perdre.
  espion([{ corps: { addressComponents: [
    CO(["subpremise"], "Apt 4B", "4B"), CO(["street_number"], "12"), CO(["route"], "rue Saint-Denis"),
    CO(["locality"], "Montréal"), CO(["administrative_area_level_1"], "Québec", "QC"),
    CO(["country"], "Canada", "CA"), CO(["postal_code"], "H2X 1Y4")] } }]);
  const app = await a.details("ChIJ-3");
  verifier("l'appartement va en deuxième ligne", app.street2 === "4B" && app.street1 === "12 rue Saint-Denis",
    `${app.street1} / ${app.street2}`);

  // Une panne chez Google n'est pas une panne du formulaire : l'erreur doit être lisible.
  espion([{ statut: 403, corps: { error: { message: "API key not valid" } } }]);
  let refus = "";
  try { await a.suggestions("220 Railway"); } catch (e) { refus = e.message; }
  verifier("une erreur Google est rendue avec son message",
    /403/.test(refus) && /API key not valid/.test(refus), refus);

  global.fetch = vraiFetch;

  // ------------------------------------------------- pays et subdivisions de l'écran
  console.log("\nPays et régions du formulaire\n" + "─".repeat(64));

  const SRC = fs.readFileSync(path.join(__dirname, "app", "public", "index.html"), "utf8");
  /** Le corps d'une déclaration, du délimiteur nommé jusqu'à son pendant. */
  function extraire(entete, ouvre = "{") {
    const dep = SRC.indexOf(entete);
    if (dep < 0) throw new Error(`introuvable : ${entete}`);
    let i = SRC.indexOf(ouvre, dep), n = 0;
    const ferme = ouvre === "(" ? ")" : "}";
    for (let j = i; j < SRC.length; j++) {
      if (SRC[j] === ouvre) n++;
      else if (SRC[j] === ferme) { n--; if (!n) return SRC.slice(dep, j + 1); }
    }
    throw new Error(`non refermé : ${entete}`);
  }

  const code = [extraire("const PAYS_CODES = (", "(") + '.trim().split(" ")',
    extraire("const SUBDIVISIONS = {"),
    extraire('function champRegion(id, pays, valeur = "") {'),
    extraire('function optionsPays(choisi = "CA") {')].join(";\n");
  const monter = new Function("ctx", `const {esc, langue, nomPays} = ctx;\n${code}\n` +
    "return { PAYS_CODES, SUBDIVISIONS, champRegion, optionsPays };");
  const ui = monter({ esc: (x) => String(x), langue: () => "fr", nomPays: (c) => `Pays ${c}` });

  verifier("la liste des pays dépasse largement CA et US",
    ui.PAYS_CODES.length > 200, `${ui.PAYS_CODES.length} pays`);
  verifier("aucun code déprécié dans la liste",
    !["UK", "SU", "YU", "ZR", "AN", "TP"].some((c) => ui.PAYS_CODES.includes(c)));
  verifier("le Canada et les États-Unis sont épinglés en tête",
    /^<option value="CA"/.test(ui.optionsPays("CA")));
  verifier("le pays choisi est bien celui qui est sélectionné",
    ui.optionsPays("FR").includes('<option value="FR" selected>'));
  // Un pays absent remplacé en silence par le premier de la liste envoie le colis ailleurs.
  verifier("un pays vide n'est pas remplacé par le premier venu",
    ui.optionsPays("").includes('<option value="" selected>'));
  verifier("un code inconnu est conservé et signalé",
    ui.optionsPays("ZZ").includes('value="ZZ" selected') && /code inconnu/.test(ui.optionsPays("ZZ")));

  verifier("le Québec figure dans les provinces canadiennes",
    ui.SUBDIVISIONS.CA.some(([c]) => c === "QC") && ui.SUBDIVISIONS.CA.length === 13,
    `${ui.SUBDIVISIONS.CA.length} provinces et territoires`);
  verifier("les cinquante États plus DC, territoires et forces armées",
    ui.SUBDIVISIONS.US.length === 59, `${ui.SUBDIVISIONS.US.length} entrées`);
  verifier("un pays connu rend une liste déroulante",
    /^<select /.test(ui.champRegion("np", "CA", "QC")));
  verifier("la valeur en cours est présélectionnée",
    ui.champRegion("np", "CA", "AB").includes('value="AB" selected'));
  verifier("un pays sans liste rend un champ libre",
    /^<input /.test(ui.champRegion("np", "FR", "Bretagne")));
  // Une province héritée d'un import ne doit pas disparaître de l'écran sans qu'on le sache.
  verifier("une valeur hors liste est conservée et marquée",
    ui.champRegion("np", "CA", "Québec").includes("hors liste"));
})().then(() => {
  console.log("\n" + "─".repeat(64));
  console.log(ko ? `${X} ${ko} contrôle(s) en échec sur ${ok + ko}` : `${V} ${ok}/${ok} contrôles passés`);
  process.exit(ko ? 1 : 0);
}).catch((e) => { console.error("\nÉCHEC :", e.message); process.exit(1); });
