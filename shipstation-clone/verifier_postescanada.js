/**
 * Vérification de l'intégration Postes Canada.
 *
 *   node shipstation-clone/verifier_postescanada.js          hors ligne, `fetch` remplacé
 *   node shipstation-clone/verifier_postescanada.js --reel   appelle vraiment la cotation
 *
 * Le mode hors ligne est le mode par défaut, et c'est voulu : il valide la **forme** des
 * requêtes XML et la lecture des réponses sans identifiants, sans réseau et sans un sou.
 * Le mode `--reel` ne fait qu'une cotation, qui est en lecture pure — jamais un achat.
 *
 * Sort en code 1 au premier échec : un contrôle vert sur une intégration cassée coûte plus
 * cher que pas de contrôle du tout.
 */
const cp = require("./lib/postescanada");

const V = "\x1b[32m✓\x1b[0m", X = "\x1b[31m✗\x1b[0m", G = "\x1b[90m", R = "\x1b[0m";
let passes = 0, echecs = 0;
const verifier = (titre, condition, detail = "") => {
  if (condition) { passes++; console.log(`${V} ${titre}${detail ? `  ${G}${detail}${R}` : ""}`); }
  else { echecs++; console.log(`${X} ${titre}${detail ? `  ${G}${detail}${R}` : ""}`); }
};

// ------------------------------------------------------------------ analyseur XML

console.log("\nPostes Canada — analyseur XML\n" + "─".repeat(64));

const simple = cp.lireXml(`<?xml version="1.0"?><a><b>1</b><c>deux</c></a>`);
verifier("élément à enfants → objet", simple.a && simple.a.b === "1" && simple.a.c === "deux");

const repete = cp.lireXml(`<l><i>1</i><i>2</i><i>3</i></l>`);
verifier("éléments répétés → tableau", Array.isArray(repete.l.i) && repete.l.i.length === 3);
verifier("tableau() normalise l'unique", cp.tableau(cp.lireXml(`<l><i>1</i></l>`).l.i).length === 1);
verifier("tableau() normalise l'absent", cp.tableau(undefined).length === 0);

const espace = cp.lireXml(`<ns:a xmlns:ns="x"><ns:b>ok</ns:b></ns:a>`);
verifier("préfixe de namespace ignoré", espace.a?.b === "ok");

const vide = cp.lireXml(`<a><b/><c>x</c></a>`);
verifier("balise auto-fermante lue", vide.a && vide.a.b === "" && vide.a.c === "x");

const entites = cp.lireXml(`<a><b>Fr&#233;d&amp;rique &lt;test&gt;</b></a>`);
verifier("entités décodées", entites.a.b === "Fréd&rique <test>", entites.a.b);

const attrs = cp.lireXml(`<links><link rel="label" href="https://x/y"/><link rel="self" href="https://x/z"/></links>`);
const liens = cp.tableau(attrs.links.link).map((l) => l["@"]);
verifier("attributs des liens lus", liens.length === 2 && liens[0].rel === "label" && liens[0].href === "https://x/y");

const erreur = cp.lireXml(`<messages xmlns="http://www.canadapost.ca/ws/messages"><message><code>9111</code><description>Numéro de client non valide</description></message></messages>`);
verifier("message d'erreur lisible",
  cp.tableau(erreur.messages.message)[0].code === "9111");

// ------------------------------------------------------------------ requêtes

console.log("\nRequêtes construites\n" + "─".repeat(64));

/** Remplace `fetch` par un espion qui capture la requête et rend une réponse plausible. */
function espion(reponse, statut = 200) {
  const vus = [];
  global.fetch = async (url, opts) => {
    vus.push({ url, opts });
    return {
      ok: statut >= 200 && statut < 300, status: statut,
      text: async () => reponse,
      arrayBuffer: async () => new TextEncoder().encode(reponse).buffer,
    };
  };
  return vus;
}
const vraiFetch = global.fetch;

process.env.CP_USERNAME = "essai_user";
process.env.CP_PASSWORD = "essai_mdp";
process.env.CP_CUSTOMER = "0005082011";
process.env.CP_CONTRACT = "0042708517";
process.env.CP_ENV = "essai";

const TARIFS_XML = `<?xml version="1.0"?>
<price-quotes xmlns="http://www.canadapost.ca/ws/ship/rate-v4">
  <price-quote>
    <service-code>DOM.EP</service-code><service-name>Expedited Parcel</service-name>
    <price-details><base>7.29</base><due>8.38</due>
      <taxes><gst>0.42</gst><pst>0.00</pst><hst>0.00</hst></taxes></price-details>
    <service-standard><expected-transit-time>1</expected-transit-time>
      <expected-delivery-date>2026-08-05</expected-delivery-date></service-standard>
  </price-quote>
  <price-quote>
    <service-code>DOM.XP</service-code><service-name>Xpresspost</service-name>
    <price-details><base>7.85</base><due>9.01</due></price-details>
    <service-standard><expected-transit-time>1</expected-transit-time></service-standard>
  </price-quote>
</price-quotes>`;

(async () => {
  let vus = espion(TARIFS_XML);
  const envoi = {
    from: { postalCode: "G1M 2S6", country: "CA" },
    to: { postalCode: "h2x1y4", country: "CA", name: "Josée Ferland" },
    parcel: { weightG: 480, lengthIn: 9, widthIn: 6, heightIn: 2 },
    value: 42, currency: "CAD",
  };
  const tarifs = await cp.coter(envoi);
  const req = vus[0];
  const corps = String(req.opts.body);

  verifier("cotation → hôte d'essai", req.url === "https://ct.soa-gw.canadapost.ca/rs/ship/price", req.url);
  verifier("authentification Basic présente",
    req.opts.headers.Authorization === `Basic ${Buffer.from("essai_user:essai_mdp").toString("base64")}`);
  verifier("type MIME de cotation v4",
    req.opts.headers["Content-Type"] === "application/vnd.cpc.ship.rate-v4+xml");
  verifier("réponse en français demandée", req.opts.headers["Accept-language"] === "fr-CA");
  verifier("numéro de client transmis", corps.includes("<customer-number>0005082011</customer-number>"));
  verifier("contrat transmis → tarif commercial",
    corps.includes("<contract-id>0042708517</contract-id>") && corps.includes("<quote-type>commercial</quote-type>"));
  verifier("code postal normalisé sans espace",
    corps.includes("<origin-postal-code>G1M2S6</origin-postal-code>")
    && corps.includes("<postal-code>H2X1Y4</postal-code>"));
  verifier("poids converti en kg", corps.includes("<weight>0.48</weight>"), "480 g → 0,48 kg");
  verifier("dimensions converties en cm",
    corps.includes("<length>22.9</length>") && corps.includes("<width>15.2</width>") && corps.includes("<height>5.1</height>"),
    "9×6×2 po → 22,9×15,2×5,1 cm");
  verifier("option DNS appliquée au domestique", corps.includes("<option-code>DNS</option-code>"),
    "pendant du « Confirmation = 5 » de ShipStation");
  verifier("destination domestique", corps.includes("<domestic>"));

  verifier("2 tarifs lus", tarifs.length === 2, tarifs.map((t) => `${t.serviceId} ${t.price}$`).join(" · "));
  verifier("tarifs triés du moins cher au plus cher", tarifs[0].price <= tarifs[1].price);
  verifier("nom français du service", tarifs[0].service === "Colis accélérés", tarifs[0].service);
  verifier("prix dû, pas prix de base", tarifs[0].price === 8.38);
  verifier("taxes agrégées", tarifs[0].taxes === 0.42);
  verifier("délai lu", tarifs[0].transitDays === 1);
  verifier("dropOff jamais prétendu vrai", tarifs.every((t) => t.dropOff === false),
    "l'API directe n'expose pas le tarif de dépôt");

  // --- destination américaine et internationale
  vus = espion(TARIFS_XML);
  await cp.coter({ ...envoi, to: { postalCode: "10001", country: "US" } });
  verifier("destination É.-U. → <united-states><zip-code>",
    String(vus[0].opts.body).includes("<united-states><zip-code>10001</zip-code></united-states>"));
  verifier("pas de DNS hors Canada", !String(vus[0].opts.body).includes("DNS"));

  vus = espion(TARIFS_XML);
  await cp.coter({ ...envoi, to: { postalCode: "75001", country: "FR" } });
  verifier("destination internationale → <country-code>",
    String(vus[0].opts.body).includes("<international><country-code>FR</country-code>"));

  // --- signature
  vus = espion(TARIFS_XML);
  await cp.coter({ ...envoi, signature: true });
  verifier("signature → option SO, et DNS retiré",
    String(vus[0].opts.body).includes("<option-code>SO</option-code>")
    && !String(vus[0].opts.body).includes("DNS"));

  // --- erreurs
  vus = espion(`<messages xmlns="http://www.canadapost.ca/ws/messages"><message><code>9111</code><description>Le numéro de client n'est pas valide</description></message></messages>`, 400);
  let msg = "";
  try { await cp.coter(envoi); } catch (e) { msg = e.message; }
  verifier("erreur Postes Canada remontée avec son code",
    msg.includes("9111") && msg.includes("numéro de client"), msg);

  // --- test de connexion
  vus = espion(TARIFS_XML);
  const t = await cp.tester();
  verifier("tester() réussit et compte les services", t.ok && t.n === 2);
  verifier("tester() dit dans quel milieu il a parlé", t.milieu === "essai" && t.production === false);
  verifier("tester() n'achète rien", vus.length === 1 && vus[0].url.endsWith("/rs/ship/price"));

  vus = espion(`<messages><message><code>0001</code><description>Clé refusée</description></message></messages>`, 401);
  const ko = await cp.tester();
  verifier("tester() rend l'échec au lieu de lever", ko.ok === false && String(ko.erreur).includes("Clé refusée"));

  // --- achat (espionné, aucune requête réelle)
  console.log("\nAchat d'étiquette — forme de la requête (aucun appel réel)\n" + "─".repeat(64));
  const ENVOI_XML = `<?xml version="1.0"?>
<shipment-info xmlns="http://www.canadapost.ca/ws/shipment-v8">
  <shipment-id>347881315405043891</shipment-id>
  <shipment-status>created</shipment-status>
  <tracking-pin>12345678901234</tracking-pin>
  <links>
    <link rel="self" href="https://ct.soa-gw.canadapost.ca/rs/0005082011/0005082011/shipment/347881315405043891"/>
    <link rel="label" href="https://ct.soa-gw.canadapost.ca/rs/artifact/0005082011/1234"/>
  </links>
</shipment-info>`;
  vus = espion(ENVOI_XML);
  const etiquette = await cp.acheter(envoi, "DOM.EP", { reference: "L-27344" });
  const creation = vus[0];
  verifier("achat → /rs/{client}/{mobo}/shipment",
    creation.url.endsWith("/rs/0005082011/0005082011/shipment"), creation.url);
  verifier("type MIME d'expédition v8",
    creation.opts.headers["Content-Type"] === "application/vnd.cpc.shipment-v8+xml");
  verifier("service demandé", String(creation.opts.body).includes("<service-code>DOM.EP</service-code>"));
  verifier("étiquette 4x6 en PDF",
    String(creation.opts.body).includes("<output-format>4x6</output-format>")
    && String(creation.opts.body).includes("<encoding>PDF</encoding>"));
  verifier("règlement sur le contrat",
    String(creation.opts.body).includes("<contract-id>0042708517</contract-id>")
    && String(creation.opts.body).includes("<intended-method-of-payment>Account</intended-method-of-payment>"));
  verifier("référence de commande portée",
    String(creation.opts.body).includes("<customer-ref-1>L-27344</customer-ref-1>"));
  verifier("numéro de suivi lu", etiquette.trackingNumber === "12345678901234");
  verifier("identifiant d'expédition lu", etiquette.labelId === "347881315405043891");
  verifier("PDF de l'étiquette récupéré", vus.length === 2 && !!etiquette.labelPdf,
    `${vus.length} appels : création puis artefact`);

  // --- douane à l'international
  vus = espion(ENVOI_XML);
  await cp.acheter({ ...envoi, to: { ...envoi.to, country: "US", postalCode: "10001" } }, "USA.EP");
  verifier("douane jointe hors Canada", String(vus[0].opts.body).includes("<customs>"));
  vus = espion(ENVOI_XML);
  await cp.acheter(envoi, "DOM.EP");
  verifier("pas de douane au domestique", !String(vus[0].opts.body).includes("<customs>"));

  // --- annulation
  vus = espion(`<a/>`);
  const annule = await cp.annuler("347881315405043891");
  verifier("annulation avant transmission → DELETE",
    vus[0].opts.method === "DELETE" && annule.refunded === true && annule.mode === "supprime");

  // --- identifiants jamais divulgués
  console.log("\nIdentifiants\n" + "─".repeat(64));
  const e = cp.etat();
  verifier("état ne contient pas le mot de passe",
    !JSON.stringify(e).includes("essai_mdp") && e.motdepasse_present === true);
  verifier("nom d'utilisateur masqué", e.username.includes("•"), e.username);
  verifier("milieu d'essai signalé non productif", e.production === false && e.milieu === "essai");
  verifier("variables d'environnement signalées verrouillantes",
    e.verrouille_par_env.username && e.verrouille_par_env.password);

  global.fetch = vraiFetch;

  // ------------------------------------------------------------------ mode réel
  if (process.argv.includes("--reel")) {
    console.log("\nAppel réel — cotation seule\n" + "─".repeat(64));
    for (const k of ["CP_USERNAME", "CP_PASSWORD", "CP_CUSTOMER", "CP_CONTRACT", "CP_ENV"]) delete process.env[k];
    const r = await cp.tester();
    if (r.ok) {
      console.log(`${V} connexion établie  ${G}${r.milieu} · client ${r.client} · ${r.ms} ms${R}`);
      for (const x of r.tarifs) console.log(`   ${x.serviceId.padEnd(14)} ${String(x.price).padStart(7)} $  ${x.service}`);
      if (r.avis) console.log(`   ${G}${r.avis}${R}`);
      passes++;
    } else {
      console.log(`${X} ${r.erreur}`);
      echecs++;
    }
  }

  console.log("\n" + "─".repeat(64));
  console.log(`${echecs ? X : V} ${passes}/${passes + echecs} contrôles passés`);
  if (echecs) { console.log(`\n${echecs} échec(s).`); process.exit(1); }
})().catch((e) => { console.error("\nÉCHEC :", e); process.exit(1); });
