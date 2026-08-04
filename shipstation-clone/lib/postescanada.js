/**
 * Postes Canada — client direct de l'API « Ship & Track » (SOA).
 *
 * Pourquoi ce module existe
 * -------------------------
 * ShipStation ouvre une fenêtre contextuelle pour brancher un compte Postes Canada. Cette
 * fenêtre, c'est le **DRC** (*Developer Registration & Consent*) : une plateforme enregistrée
 * chez Postes Canada envoie le marchand se connecter chez Postes Canada, qui lui rend en
 * retour les identifiants d'API du marchand. Il faut un `platform-id` pour l'utiliser, et
 * Postes Canada ne l'accorde qu'aux plateformes multi-marchands. Le clone dessert **un seul**
 * marchand : le chemin correct n'est pas la fenêtre, c'est la clé d'API du compte lui-même,
 * saisie une fois. Voir POSTESCANADA.md pour la marche à suivre et les contacts.
 *
 * Réserve honnête (AUDIT.md § 7 bis, ligne « API Canada Post directe ») : l'audit avait écarté
 * l'API directe parce qu'elle **perd le tarif drop-off à 6,31 $**, qui est tout le gisement du
 * projet. Ce module ne contredit pas ce constat — il ouvre l'achat d'étiquette au **tarif
 * contractuel Niveau 9** du compte, ce qui permet de tester la chaîne complète tout de suite
 * sans attendre le courtier. Aucun tarif renvoyé ici n'est marqué `dropOff` : le drapeau reste
 * faux tant que Postes Canada n'expose pas ce tarif, et le comparateur le dira franchement
 * plutôt que de laisser croire à une économie qui n'existe pas sur ce chemin.
 *
 * Forme de l'API
 * --------------
 * XML des deux côtés, authentification HTTP Basic, un type MIME par service :
 *
 *   cotation       POST /rs/ship/price                      vnd.cpc.ship.rate-v4+xml
 *   expédition     POST /rs/{client}/{mobo}/shipment        vnd.cpc.shipment-v8+xml
 *   annulation     DELETE .../shipment/{id}                 (avant transmission)
 *   remboursement  POST .../shipment/{id}/refund            vnd.cpc.shipment-v8+xml
 *   manifeste      POST /rs/{client}/{mobo}/manifest        vnd.cpc.manifest-v8+xml
 *   artefact       GET  /rs/artifact/{client}/{id}          application/pdf
 *   suivi          GET  /vis/track/pin/{pin}/detail         vnd.cpc.track+xml
 *
 * Deux environnements : `ct.soa-gw.canadapost.ca` (essai, étiquettes non facturées et non
 * livrables) et `soa-gw.canadapost.ca` (production, **argent réel**). Chaque environnement a
 * sa propre paire d'identifiants ; celle de l'essai ne fonctionne pas en production.
 *
 * Aucune dépendance : `fetch` natif de Node 22, XML lu par l'analyseur minimal ci-dessous.
 */
const { reglage, poserReglage, journaliser } = require("./db");

const HOTES = {
  prod: "https://soa-gw.canadapost.ca",
  essai: "https://ct.soa-gw.canadapost.ca",
};

/** Services domestiques et transfrontaliers, avec leur nom français affichable. */
const SERVICES = {
  "DOM.RP": "Colis standard",
  "DOM.EP": "Colis accélérés",
  "DOM.XP": "Xpresspost",
  "DOM.XP.CERT": "Xpresspost certifié",
  "DOM.PC": "Priorité",
  "DOM.LIB": "Livres de bibliothèque",
  "USA.EP": "Colis accélérés — É.-U.",
  "USA.PW.ENV": "Xpresspost É.-U. — enveloppe",
  "USA.PW.PAK": "Xpresspost É.-U. — pochette",
  "USA.PW.PARCEL": "Xpresspost É.-U. — colis",
  "USA.SP.AIR": "Petit paquet É.-U. — air",
  "USA.TP": "Priorité mondiale — É.-U.",
  "USA.XP": "Xpresspost É.-U.",
  "INT.XP": "Xpresspost international",
  "INT.IP.AIR": "Colis international — air",
  "INT.IP.SURF": "Colis international — surface",
  "INT.SP.AIR": "Petit paquet international — air",
  "INT.SP.SURF": "Petit paquet international — surface",
  "INT.TP": "Priorité mondiale",
};

/**
 * Options Postes Canada utilisées par Lasclay.
 *
 * `DNS` est le pendant exact du `Confirmation = 5` de ShipStation, appliqué systématiquement
 * sur les services Canada Post par la règle 6 du compte audité (§ 99-config, règle « Do Not
 * Safe Drop Auto »). Le reproduire à l'identique fait partie de la bascule sans couture.
 */
const OPTIONS = {
  DC: "Confirmation de livraison",
  SO: "Signature requise",
  DNS: "Ne pas laisser sans surveillance",
  LAD: "Laisser à la porte",
  COV: "Valeur déclarée",
  PA18: "Preuve d'âge 18 ans",
  PA19: "Preuve d'âge 19 ans",
  HFP: "Garder au bureau de poste",
};

// ------------------------------------------------------------------- identifiants

/**
 * Les identifiants viennent de l'environnement en priorité, de la base sinon.
 *
 * L'ordre n'est pas anodin : sur Render les secrets vivent dans les variables
 * d'environnement, jamais dans le dépôt. La base sert au cas où l'on préfère les saisir
 * depuis l'écran Réglages — c'est ce que fait ShipStation — mais l'environnement gagne
 * toujours, pour qu'une valeur oubliée en base ne prenne jamais le pas sur la vraie.
 */
function identifiants() {
  const e = process.env;
  const lire = (env, cle) => {
    const v = e[env];
    return v !== undefined && v !== "" ? String(v) : reglage(cle, "") || "";
  };
  const milieu = (lire("CP_ENV", "cp.env") || "essai").toLowerCase();
  return {
    username: lire("CP_USERNAME", "cp.username"),
    password: lire("CP_PASSWORD", "cp.password"),
    client: lire("CP_CUSTOMER", "cp.customer").replace(/\s/g, ""),
    contrat: lire("CP_CONTRACT", "cp.contract").replace(/\s/g, ""),
    // Le « mobo » (*mailed on behalf of*) vaut le numéro de client sauf mandat explicite.
    mobo: lire("CP_MOBO", "cp.mobo").replace(/\s/g, ""),
    milieu: milieu === "prod" || milieu === "production" ? "prod" : "essai",
    depuisEnv: {
      username: !!e.CP_USERNAME, password: !!e.CP_PASSWORD, client: !!e.CP_CUSTOMER,
      contrat: !!e.CP_CONTRACT, milieu: !!e.CP_ENV,
    },
  };
}

/** Ce que l'interface a le droit de voir : jamais le mot de passe, seulement sa présence. */
function etat() {
  const id = identifiants();
  return {
    configure: !!(id.username && id.password && id.client),
    username: id.username ? masquer(id.username) : "",
    motdepasse_present: !!id.password,
    client: id.client,
    contrat: id.contrat,
    mobo: id.mobo || id.client,
    milieu: id.milieu,
    production: id.milieu === "prod",
    verrouille_par_env: id.depuisEnv,
    hote: HOTES[id.milieu],
    services: Object.entries(SERVICES).map(([code, nom]) => ({ code, nom })),
    options: Object.entries(OPTIONS).map(([code, nom]) => ({ code, nom })),
  };
}

/** Une clé d'API se reconnaît à ses bords ; le milieu n'a pas à traverser le réseau. */
function masquer(s) {
  const t = String(s);
  return t.length <= 8 ? "•".repeat(t.length) : `${t.slice(0, 4)}${"•".repeat(6)}${t.slice(-4)}`;
}

/**
 * Enregistre les identifiants saisis à l'écran. Un champ absent du corps est **laissé tel
 * quel** : rouvrir le formulaire pour changer le seul numéro de contrat ne doit pas effacer
 * la clé, qui n'est jamais renvoyée au navigateur et ne peut donc pas être réaffichée.
 */
function enregistrer(corps = {}, userId = null) {
  const champs = { username: "cp.username", password: "cp.password", customer: "cp.customer",
    contract: "cp.contract", mobo: "cp.mobo", env: "cp.env" };
  const touches = [];
  for (const [entree, cle] of Object.entries(champs)) {
    if (corps[entree] === undefined || corps[entree] === null) continue;
    const v = String(corps[entree]).trim();
    if (entree === "password" && v === "") continue; // vide = « ne change pas »
    poserReglage(cle, v);
    touches.push(entree);
  }
  journaliser("carrier_credentials", "postescanada", "cp",
    { champs: touches, milieu: identifiants().milieu }, userId);
  return etat();
}

/** Efface les identifiants stockés en base. Ne touche pas aux variables d'environnement. */
function oublier(userId = null) {
  for (const c of ["cp.username", "cp.password", "cp.customer", "cp.contract", "cp.mobo"]) poserReglage(c, "");
  journaliser("carrier_credentials_cleared", "postescanada", "cp", {}, userId);
  return etat();
}

// ------------------------------------------------------------------- XML

const ECHAPPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const ech = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ECHAPPE[c]);
const decoder = (s) => String(s)
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&amp;/g, "&");

/** Balise simple, omise si la valeur est vide — l'API refuse les éléments vides. */
const t = (nom, v) => (v === undefined || v === null || v === "" ? "" : `<${nom}>${ech(v)}</${nom}>`);

/**
 * Analyseur XML minimal, suffisant pour les réponses de Postes Canada : pas d'attributs à
 * lire (sauf les liens, traités à part), pas de CDATA, pas de namespaces significatifs.
 *
 * Un élément sans enfant devient sa chaîne de texte, un élément répété devient un tableau.
 * `tableau()` sert à lire sans se demander lequel des deux on a reçu — c'est le piège
 * classique de ce genre d'analyseur, et il est ici cantonné à une seule fonction.
 */
function lireXml(texte) {
  const src = String(texte).replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const racine = { nom: "#racine", enfants: [], texte: "" };
  const pile = [racine];
  const jeton = /<\s*(\/?)\s*([\w:.-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)\s*>/g;
  let dernier = 0, m;
  while ((m = jeton.exec(src))) {
    const courant = pile[pile.length - 1];
    courant.texte += src.slice(dernier, m.index);
    dernier = jeton.lastIndex;
    if (m[1]) { if (pile.length > 1) pile.pop(); continue; }
    const n = { nom: m[2].split(":").pop(), enfants: [], texte: "", attrs: m[3] || "" };
    courant.enfants.push(n);
    if (!m[4]) pile.push(n);
  }
  racine.texte += src.slice(dernier);
  return simplifier(racine);
}

function simplifier(n) {
  const attributs = {};
  for (const a of String(n.attrs || "").matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) {
    if (a[1] === "xmlns" || a[1].startsWith("xmlns:")) continue; // le namespace n'est pas une donnée
    attributs[a[1]] = decoder(a[2]);
  }
  const aDesAttributs = Object.keys(attributs).length > 0;
  // Une feuille sans attribut vaut son texte — c'est le cas de 99 % des éléments. Une feuille
  // AVEC attributs ne le peut pas : `<link rel="label" href="…"/>` ne porte sa donnée que là,
  // et la réduire à sa chaîne vide perdait l'URL de l'étiquette.
  if (!n.enfants.length) return aDesAttributs ? { "@": attributs, "#": decoder(n.texte).trim() } : decoder(n.texte).trim();
  const o = {};
  if (aDesAttributs) o["@"] = attributs;
  for (const e of n.enfants) {
    const v = simplifier(e);
    if (o[e.nom] === undefined) o[e.nom] = v;
    else if (Array.isArray(o[e.nom])) o[e.nom].push(v);
    else o[e.nom] = [o[e.nom], v];
  }
  return o;
}

const tableau = (x) => (Array.isArray(x) ? x : x === undefined || x === null || x === "" ? [] : [x]);

// ------------------------------------------------------------------- transport

/**
 * Appel HTTP authentifié.
 *
 * Les erreurs de Postes Canada arrivent en XML `<messages><message><code/><description/>`.
 * Les remonter telles quelles, avec leur code, est ce qui distingue un diagnostic d'une
 * page blanche : « 9111 — le numéro de client n'est pas valide » se corrige, « 400 » non.
 */
async function appel(methode, chemin, { accept, contentType, corps = null, langue = "fr-CA", brut = false } = {}) {
  const id = identifiants();
  if (!id.username || !id.password) {
    throw new Error("Postes Canada non configuré — saisir la clé d'API dans Réglages ▸ Transporteurs");
  }
  const url = `${HOTES[id.milieu]}${chemin}`;
  const entetes = {
    Authorization: `Basic ${Buffer.from(`${id.username}:${id.password}`).toString("base64")}`,
    "Accept-language": langue,
  };
  if (accept) entetes.Accept = accept;
  if (contentType) entetes["Content-Type"] = contentType;

  let r;
  try {
    r = await fetch(url, { method: methode, headers: entetes, body: corps });
  } catch (e) {
    throw new Error(`Postes Canada injoignable (${HOTES[id.milieu]}) : ${e.message}`);
  }
  if (brut) {
    if (!r.ok) throw new Error(`Postes Canada ${r.status} sur ${chemin}`);
    return Buffer.from(await r.arrayBuffer());
  }
  const texte = await r.text();
  if (!r.ok) {
    const msgs = tableau(lireXml(texte)?.messages?.message)
      .map((m) => `${m.code || "?"} — ${m.description || ""}`.trim());
    throw new Error(msgs.length
      ? `Postes Canada : ${msgs.join(" · ")}`
      : `Postes Canada ${r.status} sur ${chemin}${texte ? ` : ${texte.slice(0, 200)}` : ""}`);
  }
  return lireXml(texte);
}

// ------------------------------------------------------------------- cotation

const NS_TARIF = "http://www.canadapost.ca/ws/ship/rate-v4";
const NS_ENVOI = "http://www.canadapost.ca/ws/shipment-v8";

const cp = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const cm = (pouces) => Math.max(0.1, Math.round(Number(pouces || 0) * 2.54 * 10) / 10);
const kg = (g) => Math.max(0.001, Math.round(Number(g || 0) / 1000 * 1000) / 1000);

/** Le bloc destination change de forme selon le pays — c'est la seule vraie branche. */
function destinationXml(vers) {
  const pays = String(vers.country || "CA").toUpperCase();
  if (pays === "CA") return `<domestic>${t("postal-code", cp(vers.postalCode))}</domestic>`;
  if (pays === "US") return `<united-states>${t("zip-code", String(vers.postalCode || "").replace(/\s/g, ""))}</united-states>`;
  return `<international>${t("country-code", pays)}${t("postal-code", String(vers.postalCode || "").trim())}</international>`;
}

/** Options d'envoi déduites de la politique Lasclay et de la commande. */
function optionsDe(envoi) {
  const codes = [];
  if (envoi.signature) codes.push("SO");
  // Systématique sur les services Postes Canada, comme la règle 6 du compte ShipStation.
  else if (String(envoi.to?.country || "CA").toUpperCase() === "CA") codes.push("DNS");
  if (envoi.insurance) codes.push("COV");
  return codes;
}

function optionsXml(envoi) {
  const codes = optionsDe(envoi);
  if (!codes.length) return "";
  const lignes = codes.map((c) => `<option>${t("option-code", c)}${
    c === "COV" ? t("option-amount", Number(envoi.insurance || envoi.value || 0).toFixed(2)) : ""}</option>`);
  return `<options>${lignes.join("")}</options>`;
}

/**
 * Cotation — lecture pure, aucun effet de bord, aucun argent. C'est aussi le test de
 * connexion : si le tarif revient, la clé, le numéro de client et le contrat sont bons.
 */
async function coter(envoi) {
  const id = identifiants();
  const p = envoi.parcel || {};
  const corps =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<mailing-scenario xmlns="${NS_TARIF}">` +
      t("customer-number", id.client) +
      t("contract-id", id.contrat) +
      t("quote-type", id.contrat ? "commercial" : "counter") +
      optionsXml(envoi) +
      `<parcel-characteristics>` +
        t("weight", kg(p.weightG)) +
        `<dimensions>${t("length", cm(p.lengthIn))}${t("width", cm(p.widthIn))}${t("height", cm(p.heightIn))}</dimensions>` +
      `</parcel-characteristics>` +
      t("origin-postal-code", cp(envoi.from?.postalCode)) +
      `<destination>${destinationXml(envoi.to || {})}</destination>` +
    `</mailing-scenario>`;

  const r = await appel("POST", "/rs/ship/price", {
    accept: "application/vnd.cpc.ship.rate-v4+xml",
    contentType: "application/vnd.cpc.ship.rate-v4+xml",
    corps,
  });
  return tableau(r["price-quotes"]?.["price-quote"]).map((q) => {
    const code = q["service-code"] || "";
    const jours = q["service-standard"]?.["expected-transit-time"];
    return {
      carrier: "Canada Post",
      compte: id.client,
      service: SERVICES[code] || q["service-name"] || code,
      serviceId: code,
      price: Math.round(Number(q["price-details"]?.due || 0) * 100) / 100,
      base: Math.round(Number(q["price-details"]?.base || 0) * 100) / 100,
      taxes: Math.round(
        ["gst", "pst", "hst"].reduce((s, k) => s + Number(q["price-details"]?.taxes?.[k] || 0), 0) * 100) / 100,
      currency: "CAD",
      transitDays: jours ? Number(jours) : null,
      livraisonPrevue: q["service-standard"]?.["expected-delivery-date"] || null,
      // Le tarif de dépôt au comptoir n'est pas exposé par cette API : ne pas le prétendre.
      dropOff: false,
      options: optionsDe(envoi),
    };
  }).sort((a, b) => a.price - b.price);
}

/**
 * Test de connexion. Un envoi type Québec → Montréal, 500 g : assez réel pour valider le
 * contrat, assez anodin pour être lancé autant de fois qu'on veut. Aucune étiquette créée.
 */
async function tester(envoi = null) {
  const debut = Date.now();
  const scenario = envoi || {
    from: { postalCode: "G1M2S6", country: "CA" },
    to: { postalCode: "H2X1Y4", country: "CA" },
    parcel: { weightG: 500, lengthIn: 9, widthIn: 6, heightIn: 2 },
    value: 40, currency: "CAD",
  };
  const id = identifiants();
  try {
    const tarifs = await coter(scenario);
    return {
      ok: true, milieu: id.milieu, production: id.milieu === "prod",
      client: id.client, contrat: id.contrat || null,
      ms: Date.now() - debut, n: tarifs.length,
      tarifs: tarifs.map((x) => ({ serviceId: x.serviceId, service: x.service, price: x.price, transitDays: x.transitDays })),
      // Un compte sans contrat cote au tarif du comptoir : c'est visible et il faut le dire.
      avis: id.contrat ? null : "Aucun numéro de contrat : les tarifs renvoyés sont ceux du comptoir, pas les tarifs négociés.",
    };
  } catch (e) {
    return { ok: false, milieu: id.milieu, client: id.client, ms: Date.now() - debut, erreur: String(e.message || e) };
  }
}

// ------------------------------------------------------------------- expédition

function adresseXml(balise, a = {}, { avecContact = false } = {}) {
  const pays = String(a.country || "CA").toUpperCase();
  return `<${balise}>` +
    t("name", a.name) +
    t("company", a.company || a.name) +
    (avecContact ? t("contact-phone", a.phone) : "") +
    `<address-details>` +
      t("address-line-1", a.street1) +
      t("address-line-2", a.street2) +
      t("city", a.city) +
      (pays === "CA" || pays === "US" ? t("prov-state", a.state) : "") +
      t("country-code", pays) +
      t("postal-zip-code", pays === "CA" ? cp(a.postalCode) : String(a.postalCode || "").trim()) +
    `</address-details>` +
  `</${balise}>`;
}

/** Déclaration douanière — obligatoire hors Canada, ignorée au domestique. */
function douaneXml(envoi) {
  const pays = String(envoi.to?.country || "CA").toUpperCase();
  if (pays === "CA") return "";
  const d = envoi.customs || {};
  const articles = tableau(d.items).length ? tableau(d.items) : [{
    description: "Produits textiles isolés à l'asclépiade",
    quantity: 1, unitWeightG: envoi.parcel?.weightG || 0,
    unitValue: envoi.value || 0, hsCode: d.hsCode || "", origin: "CA",
  }];
  return `<customs>` +
    t("currency", envoi.currency || "CAD") +
    t("reason-for-export", d.reason || "SOG") +
    `<sku-list>` + articles.map((a) => `<item>` +
      t("customs-number-of-units", a.quantity || 1) +
      t("customs-description", String(a.description || "").slice(0, 45)) +
      t("unit-weight", kg(a.unitWeightG || 0)) +
      t("customs-value-per-unit", Number(a.unitValue || 0).toFixed(2)) +
      t("hs-tariff-code", a.hsCode) +
      t("country-of-origin", a.origin || "CA") +
    `</item>`).join("") + `</sku-list>` +
  `</customs>`;
}

/**
 * ACHÈTE une étiquette. **Argent réel** en milieu `prod`.
 *
 * L'appelant est `lib/shipments.js`, lui-même derrière `CLONE_ALLOW_LABELS` et la permission
 * `labels_buy`. Ce module n'ajoute pas de garde-fou supplémentaire : deux verrous au même
 * endroit se désactivent ensemble, et un verrou qu'on croit actif est pire qu'aucun.
 */
async function acheter(envoi, serviceId, { reference = null, groupe = null } = {}) {
  const id = identifiants();
  if (!id.client) throw new Error("numéro de client Postes Canada manquant");
  const p = envoi.parcel || {};
  const mobo = id.mobo || id.client;
  const corps =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<shipment xmlns="${NS_ENVOI}">` +
      t("group-id", groupe || `LAS-${new Date().toISOString().slice(0, 10)}`) +
      t("requested-shipping-point", cp(envoi.from?.postalCode)) +
      `<delivery-spec>` +
        t("service-code", serviceId) +
        adresseXml("sender", envoi.from, { avecContact: true }) +
        adresseXml("destination", envoi.to, { avecContact: true }) +
        optionsXml(envoi) +
        `<parcel-characteristics>` +
          t("weight", kg(p.weightG)) +
          `<dimensions>${t("length", cm(p.lengthIn))}${t("width", cm(p.widthIn))}${t("height", cm(p.heightIn))}</dimensions>` +
        `</parcel-characteristics>` +
        `<print-preferences>${t("output-format", "4x6")}${t("encoding", "PDF")}</print-preferences>` +
        `<preferences>${t("show-packing-instructions", "true")}${t("show-postage-rate", "false")}${t("show-insured-value", "true")}</preferences>` +
        (reference ? `<references>${t("customer-ref-1", reference)}</references>` : "") +
        douaneXml(envoi) +
        `<settlement-info>${t("contract-id", id.contrat)}${t("intended-method-of-payment", id.contrat ? "Account" : "CreditCard")}</settlement-info>` +
      `</delivery-spec>` +
    `</shipment>`;

  const r = await appel("POST", `/rs/${id.client}/${mobo}/shipment`, {
    accept: "application/vnd.cpc.shipment-v8+xml",
    contentType: "application/vnd.cpc.shipment-v8+xml",
    corps,
  });
  const env = r["shipment-info"] || r.shipment || r;
  const liens = tableau(env.links?.link).map((l) => l["@"] || {});
  const label = liens.find((l) => l.rel === "label");
  const pdf = label?.href ? await telecharger(label.href) : null;
  return {
    labelId: env["shipment-id"] || null,
    trackingNumber: env["tracking-pin"] || null,
    carrier: "Canada Post",
    service: SERVICES[serviceId] || serviceId,
    serviceId,
    price: null, // Postes Canada ne facture pas à la création : le prix vient de la cotation.
    currency: "CAD",
    labelPdf: pdf ? pdf.toString("base64") : null,
    customsPdf: null,
    liens,
    milieu: id.milieu,
  };
}

/** Un lien d'artefact est déjà absolu et déjà authentifié par les mêmes identifiants. */
async function telecharger(href) {
  const chemin = href.startsWith("http") ? new URL(href).pathname + new URL(href).search : href;
  return await appel("GET", chemin, { accept: "application/pdf", brut: true });
}

/**
 * Annule une étiquette. Avant transmission, Postes Canada la supprime ; après, il faut une
 * demande de remboursement, qui n'est pas instantanée. Les deux cas sont distingués dans la
 * réponse pour que l'interface ne dise pas « remboursé » quand elle veut dire « demandé ».
 */
async function annuler(shipmentId, { courriel = null } = {}) {
  const id = identifiants();
  const mobo = id.mobo || id.client;
  try {
    await appel("DELETE", `/rs/${id.client}/${mobo}/shipment/${shipmentId}`, {
      accept: "application/vnd.cpc.shipment-v8+xml",
    });
    return { labelId: shipmentId, refunded: true, mode: "supprime" };
  } catch (e) {
    if (!courriel) throw e;
    const corps = `<?xml version="1.0" encoding="UTF-8"?>` +
      `<shipment-refund-request xmlns="${NS_ENVOI}">${t("email", courriel)}</shipment-refund-request>`;
    const r = await appel("POST", `/rs/${id.client}/${mobo}/shipment/${shipmentId}/refund`, {
      accept: "application/vnd.cpc.shipment-v8+xml",
      contentType: "application/vnd.cpc.shipment-v8+xml",
      corps,
    });
    return { labelId: shipmentId, refunded: false, mode: "demande",
      ticket: r["shipment-refund-request-info"]?.["service-ticket-id"] || null,
      raison: String(e.message || e) };
  }
}

/**
 * Transmission de fin de journée — l'équivalent Postes Canada du manifeste. Sans elle, les
 * étiquettes contractuelles restent en état « créé » et ne sont pas facturées.
 */
async function transmettre({ groupe, adresse, telephone = null }) {
  const id = identifiants();
  const mobo = id.mobo || id.client;
  const corps = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<transmit-set xmlns="http://www.canadapost.ca/ws/manifest-v8">` +
      `<group-ids>${tableau(groupe).map((g) => t("group-id", g)).join("")}</group-ids>` +
      adresseXml("manifest-address", adresse) +
      t("detailed-manifests", "true") +
      t("method-of-payment", id.contrat ? "Account" : "CreditCard") +
      (telephone ? t("manifest-phone", telephone) : "") +
    `</transmit-set>`;
  const r = await appel("POST", `/rs/${id.client}/${mobo}/manifest`, {
    accept: "application/vnd.cpc.manifest-v8+xml",
    contentType: "application/vnd.cpc.manifest-v8+xml",
    corps,
  });
  return { manifestes: tableau(r.manifests?.link).map((l) => l["@"]?.href).filter(Boolean) };
}

/** Suivi par numéro (PIN). Lecture pure, ne nécessite ni contrat ni numéro de client. */
async function suivre(pin) {
  const r = await appel("GET", `/vis/track/pin/${encodeURIComponent(pin)}/detail`, {
    accept: "application/vnd.cpc.track+xml",
  });
  const d = r["tracking-detail"] || {};
  return tableau(d["significant-events"]?.occurrence).map((o) => ({
    date: `${o["event-date"] || ""}${o["event-time"] ? `T${o["event-time"]}` : ""}` || null,
    status: o["event-identifier"] || null,
    description: o["event-description"] || "",
    lieu: [o["event-site"], o["event-province"]].filter(Boolean).join(", ") || null,
  }));
}

// ------------------------------------------------------------------- adaptateur

/**
 * L'adaptateur au contrat de `lib/carrier.js`. Rien d'autre du clone ne connaît Postes
 * Canada — c'est ce qui permettra de basculer vers le courtier sans toucher à l'interface.
 */
const adaptateurPostesCanada = {
  nom: "postescanada",
  async quote(envoi) { return await coter(envoi); },
  async buy(envoi, serviceId) { return await acheter(envoi, serviceId); },
  async void_(labelId) { return await annuler(labelId); },
  async track(labelId) { return await suivre(labelId); },
};

module.exports = {
  adaptateurPostesCanada, identifiants, etat, enregistrer, oublier,
  coter, tester, acheter, annuler, transmettre, suivre,
  lireXml, tableau, SERVICES, OPTIONS, HOTES,
};
