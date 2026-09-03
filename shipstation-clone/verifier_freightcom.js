/**
 * Vérification de l'intégration Freightcom.
 *
 *   node shipstation-clone/verifier_freightcom.js          hors ligne, `fetch` espionné
 *   node shipstation-clone/verifier_freightcom.js --reel   appelle GET /services, en lecture
 *   node shipstation-clone/verifier_freightcom.js --assurance   quel `insurance.type` passe
 *   node shipstation-clone/verifier_freightcom.js --panel [--poids 300]   qui répond, et si
 *     l'assurance ou le délai fait disparaître un transporteur du panel
 *   node shipstation-clone/verifier_freightcom.js --catalogue   quels transporteurs le compte
 *     porte réellement — un seul appel, la réponse la plus courte sur « où est Postes Canada »
 *
 * Le mode hors ligne valide la forme des requêtes, la conversion des unités, le cache,
 * l'idempotence et les refus d'achat — sans clé, sans réseau, sans dépense. Le mode `--reel`
 * ne fait qu'un `GET /services` : aucune cotation facturable, aucune réservation.
 */
const fc = require("./lib/freightcom");
const { run } = require("./lib/db");

const V = "\x1b[32m✓\x1b[0m", X = "\x1b[31m✗\x1b[0m", G = "\x1b[90m", R = "\x1b[0m";
let passes = 0, echecs = 0;
const verifier = (t, c, d = "") => {
  if (c) { passes++; console.log(`${V} ${t}${d ? `  ${G}${d}${R}` : ""}`); }
  else { echecs++; console.log(`${X} ${t}${d ? `  ${G}${d}${R}` : ""}`); }
};

const vraiFetch = global.fetch;
/** Espion : rend des réponses scriptées et garde la trace de ce qui est parti. */
function espion(reponses) {
  const vus = [];
  let i = 0;
  global.fetch = async (url, opts) => {
    vus.push({ url: String(url), methode: opts?.method, entetes: opts?.headers,
      corps: opts?.body ? JSON.parse(opts.body) : null });
    const r = reponses[Math.min(i++, reponses.length - 1)];
    return { ok: (r.statut || 200) < 400, status: r.statut || 200,
      text: async () => JSON.stringify(r.corps ?? {}) };
  };
  return vus;
}

const ENVOI = {
  orderId: 50774,
  from: { name: "Lasclay", company: "Les Produits Lasclay", street1: "1 rue des Capucins",
    city: "Québec", state: "QC", country: "CA", postalCode: "G1M 2S6",
    phone: "418-555-0100", email: "expedition@lasclay.test" },
  // Volontairement sans téléphone ni courriel : c'est le cas d'une commande manuelle, et
  // c'est celui qui faisait échouer la réservation sur un « bad or missing data » muet.
  to: { name: "Josée Ferland", street1: "12 rue Saint-Denis", city: "Montréal", state: "QC",
    country: "CA", postalCode: "h2x 1y4", residential: true },
  parcel: { weightG: 483, lengthIn: 9, widthIn: 6, heightIn: 2 },
  value: 42, currency: "CAD",
};

const TARIF = (id, cents, nom) => ({
  carrier_name: "Canada Post", service_name: nom, service_id: id,
  total: { currency: "CAD", value: String(cents) },
  base: { currency: "CAD", value: String(cents - 90) },
  surcharges: [{ type: "fuel", name: "Carburant", amount: { currency: "CAD", value: "60" } }],
  valid_until: { year: 2099, month: 12, day: 31 },
  transit_time_days: 1,
});

(async () => {
  // La vraie clé est mise de côté puis rendue : sur Render, les contrôles hors ligne tournent
  // dans un processus qui a la clé de production en environnement, et l'écraser sans la
  // restaurer faisait échouer `--reel` juste après.
  const CLE_REELLE = process.env.FREIGHTCOM_API_KEY;
  process.env.FREIGHTCOM_API_KEY = "cle-essai";
  delete process.env.FREIGHTCOM_SERVICES;
  run("DELETE FROM rate_cache");

  console.log("\nRequête de cotation\n" + "─".repeat(64));
  let vus = espion([
    { statut: 202, corps: { request_id: "req-1" } },
    { corps: { status: { done: true, total: 2, complete: 2 },
      rates: [TARIF("cp-xp", 901, "Xpresspost"), TARIF("cp-ep-dropoff", 631, "Expedited Parcel Drop-Off Only")] } },
  ]);
  const r1 = await fc.coter(ENVOI, { deadlineMs: 5000 });

  verifier("soumission sur POST /rate", vus[0].url.endsWith("/rate") && vus[0].methode === "POST", vus[0].url);
  verifier("clé passée en en-tête Authorization brut, pas en Bearer",
    vus[0].entetes.Authorization === "cle-essai");
  verifier("interrogation sur GET /rate/{id}", vus[1].url.endsWith("/rate/req-1"));
  const d = vus[0].corps.details;
  verifier("code postal normalisé sans espace, en majuscules",
    d.destination.address.postal_code === "H2X1Y4", d.destination.address.postal_code);
  verifier("poids converti en kg, au palier supérieur",
    d.packaging_properties.packages[0].measurements.weight.value === 0.485, "483 g → palier 485 g → 0,485 kg");
  // La spec type les mesures en nombres. Les envoyer en chaînes valait un « 400 bad or
  // missing data » sans plus d explication ; le contrôle fige la distinction.
  verifier("les mesures partent en nombres, pas en chaînes",
    typeof d.packaging_properties.packages[0].measurements.weight.value === "number"
    && typeof d.packaging_properties.packages[0].measurements.cuboid.l === "number");
  verifier("chaque colis porte la description exigée",
    !!d.packaging_properties.packages[0].description, d.packaging_properties.packages[0].description);
  verifier("pas de pallet_type parasite dans la variante colis",
    !("pallet_type" in d.packaging_properties));
  verifier("dimensions converties en cm",
    JSON.stringify(d.packaging_properties.packages[0].measurements.cuboid) === '{"unit":"cm","l":23,"w":15,"h":5}',
    "9×6×2 po → 23×15×5 cm");
  verifier("destination marquée résidentielle", d.destination.residential === true);
  verifier("Freightcom n'écrit pas au client à notre place",
    d.origin.receives_email_updates === false && d.destination.receives_email_updates === false);

  /*
   * Les trois champs que ClickShip marque obligatoires des deux côtés — `Contact Name`,
   * `Phone Number`, `Email Address`. Une commande manuelle n'en porte aucun, et la
   * réservation était refusée par un « bad or missing data » qui ne nommait rien.
   */
  verifier("un destinataire sans téléphone reprend celui de l'expéditeur",
    d.destination.phone_number && d.destination.phone_number.number === "4185550100",
    d.destination.phone_number ? d.destination.phone_number.number : "absent");
  verifier("un destinataire sans courriel reprend celui de l'expéditeur",
    JSON.stringify(d.destination.email_addresses) === '["expedition@lasclay.test"]',
    JSON.stringify(d.destination.email_addresses));
  verifier("le nom du contact est renseigné des deux côtés",
    !!d.origin.contact_name && !!d.destination.contact_name,
    `${d.origin.contact_name} / ${d.destination.contact_name}`);
  // Et le sens inverse : un repli qui écraserait une vraie coordonnée client ferait appeler
  // Lasclay à la place du destinataire quand la livraison échoue.
  {
    // Le cache regroupe par scénario, et le téléphone n'en fait pas partie : on change donc
    // de destination plutôt que de vider le cache, que les contrôles suivants examinent.
    const espionne = espion([{ statut: 202, corps: { request_id: "req-tel" } },
      { corps: { status: { done: true, total: 1, complete: 1 }, rates: [TARIF("cp-ep", 700, "Expedited")] } }]);
    await fc.coter({ ...ENVOI, orderId: 77777,
      to: { ...ENVOI.to, postalCode: "J7X 1A1", phone: "514-555-0199", email: "josee@exemple.test" } });
    const dd = espionne[0].corps.details.destination;
    verifier("les coordonnées du client priment sur le repli",
      dd.phone_number.number === "5145550199"
      && JSON.stringify(dd.email_addresses) === '["josee@exemple.test"]',
      `${dd.phone_number.number} / ${dd.email_addresses}`);
  }

  // Sans rien nulle part, la réservation doit dire QUOI manque, pas « bad or missing data ».
  {
    espion([{ statut: 202, corps: { request_id: "req-nu" } },
      { corps: { status: { done: true, total: 1, complete: 1 }, rates: [TARIF("cp-ep", 700, "Expedited")] } }]);
    const nu = { ...ENVOI, orderId: 66666, to: { ...ENVOI.to, postalCode: "J8Y 2B2" },
      from: { ...ENVOI.from, phone: undefined, email: undefined } };
    let refus = "";
    try { await fc.reserver(nu, "cp-ep"); } catch (e) { refus = e.message; }
    verifier("une commande sans coordonnées est refusée en nommant les champs",
      /téléphone/.test(refus) && /courriel/.test(refus) && /Réglages/.test(refus), refus.slice(0, 120));
  }

  console.log("\nLecture des tarifs\n" + "─".repeat(64));
  verifier("2 tarifs lus", r1.tarifs.length === 2, r1.tarifs.map((t) => `${t.serviceId} ${t.price}$`).join(" · "));
  verifier("cents convertis en dollars", r1.tarifs[0].price === 6.31, `${r1.tarifs[0].price} $`);
  verifier("tri du moins cher au plus cher", r1.tarifs[0].price <= r1.tarifs[1].price);
  verifier("surcharges lues", r1.tarifs[0].surcharges[0].montant === 0.6);
  verifier("drop-off reconnu au libellé", r1.tarifs[0].dropOff === true && r1.tarifs[1].dropOff === false,
    "c'est le drapeau qui porte l'économie du projet");
  verifier("panel complet signalé", r1.complet === true && r1.source === "reseau");

  console.log("\nCache\n" + "─".repeat(64));
  vus = espion([{ statut: 500, corps: { message: "ne devrait pas être appelé" } }]);
  const r2 = await fc.coter(ENVOI);
  verifier("deuxième cotation servie par le cache, sans réseau", r2.source === "cache" && vus.length === 0);
  verifier("les tarifs du cache sont les mêmes", r2.tarifs[0].price === 6.31);

  const jumelle = { ...ENVOI, orderId: 99999, parcel: { ...ENVOI.parcel, weightG: 481 } };
  const r3 = await fc.coter(jumelle);
  verifier("un colis du même palier partage l'empreinte",
    r3.source === "cache", "481 g et 483 g → palier 485 g, une seule requête");

  // Le point que le premier jet ratait : l'empreinte et la cotation doivent employer le
  // MÊME poids, sinon deux colis se partagent un prix qui n'est celui que de l'un d'eux.
  const voisin = { ...ENVOI, orderId: 88888, parcel: { ...ENVOI.parcel, weightG: 488 } };
  vus = espion([{ statut: 202, corps: { request_id: "req-v" } },
    { corps: { status: { done: true, total: 1, complete: 1 }, rates: [TARIF("cp-ep", 700, "Expedited")] } }]);
  const r3b = await fc.coter(voisin);
  verifier("un colis d'un autre palier est bel et bien recoté",
    r3b.source === "reseau", "488 g → palier 490 g, empreinte distincte");
  verifier("le poids coté est le palier, jamais le gramme exact",
    vus[0].corps.details.packaging_properties.packages[0].measurements.weight.value === 0.49,
    "488 g coté à 0,49 kg — vers le haut, jamais en dessous du réel");
  // Le balayage de poids a montré que 495 g partait à 0,50 kg : un second arrondi inventait
  // cinq grammes et faisait perdre le tarif de dépôt sur toute la bande 491-500 g.
  verifier("un colis de 495 g ne franchit pas le seuil des 500 g",
    JSON.parse(JSON.stringify({ v: require("./lib/freightcom").scenario(
      { ...ENVOI, parcel: { ...ENVOI.parcel, weightG: 495 } }) }))
      .v.details.packaging_properties.packages[0].measurements.weight.value === 0.495,
    "495 g → 0,495 kg, pas 0,50");

  const ailleurs = { ...ENVOI, to: { ...ENVOI.to, postalCode: "K1A 0B1" } };
  vus = espion([{ statut: 202, corps: { request_id: "req-2" } },
    { corps: { status: { done: true, total: 1, complete: 1 }, rates: [TARIF("cp-ep", 1188, "Expedited Parcel")] } }]);
  const r4 = await fc.coter(ailleurs);
  verifier("une autre destination ne réutilise pas le cache", r4.source === "reseau" && vus.length === 2);

  console.log("\nPanel de services\n" + "─".repeat(64));
  process.env.FREIGHTCOM_SERVICES = "cp-ep-dropoff, cp-ep";
  vus = espion([{ statut: 202, corps: { request_id: "req-3" } },
    { corps: { status: { done: true, total: 2, complete: 2 }, rates: [TARIF("cp-ep-dropoff", 631, "Drop-Off Only")] } }]);
  await fc.coter({ ...ENVOI, parcel: { ...ENVOI.parcel, weightG: 700 } });
  verifier("le panel demandé restreint la recherche",
    JSON.stringify(vus[0].corps.services) === '["cp-ep-dropoff","cp-ep"]',
    "c'est le levier qui divise le temps de cotation");
  delete process.env.FREIGHTCOM_SERVICES;

  console.log("\nSortie anticipée\n" + "─".repeat(64));
  vus = espion([{ statut: 202, corps: { request_id: "req-4" } },
    { corps: { status: { done: false, total: 12, complete: 3 }, rates: [TARIF("cp-ep", 838, "Expedited")] } }]);
  const debut = Date.now();
  const r5 = await fc.coterDirect({ ...ENVOI, parcel: { ...ENVOI.parcel, weightG: 1200 } }, { deadlineMs: 900 });
  verifier("on rend les tarifs partiels au lieu d'attendre le panel entier",
    r5.tarifs.length === 1 && r5.complet === false, `${r5.statut.complete}/${r5.statut.total} services revenus`);
  verifier("la date limite est tenue", Date.now() - debut < 2500, `${Date.now() - debut} ms`);

  console.log("\nIdempotence et refus d'achat\n" + "─".repeat(64));
  const u1 = fc.identifiantUnique(ENVOI, "cp-ep-dropoff");
  const u2 = fc.identifiantUnique({ ...ENVOI }, "cp-ep-dropoff");
  verifier("la clé d'idempotence est déterministe", u1 === u2, u1);
  verifier("elle change si on la fait changer exprès",
    fc.identifiantUnique(ENVOI, "cp-ep-dropoff", 1) !== u1);
  verifier("elle tient dans les 128 caractères imposés", u1.length <= 128);

  vus = espion([{ statut: 202, corps: { request_id: "req-5" } },
    { corps: { status: { done: true, total: 1, complete: 1 }, rates: [TARIF("cp-ep", 838, "Expedited")] } }]);
  let msg = "";
  try { await fc.reserver(ENVOI, "service-inexistant"); } catch (e) { msg = e.message; }
  verifier("achat refusé sur un service absent de la cotation du serveur",
    msg.includes("absent de la cotation"), msg);

  vus = espion([{ statut: 202, corps: { request_id: "req-6" } },
    { corps: { status: { done: true, total: 1, complete: 1 },
      rates: [{ ...TARIF("cp-ep", 838, "Expedited"), valid_until: { year: 2020, month: 1, day: 1 } }] } }]);
  msg = "";
  try { await fc.reserver(ENVOI, "cp-ep"); } catch (e) { msg = e.message; }
  verifier("achat refusé sur un devis périmé", msg.includes("expiré"), msg);

  // La réservation est suivie d'une lecture de `/shipment/{id}` : c'est là que l'étiquette
  // apparaît. Sans elle, on achetait un document qu'on ne pouvait pas imprimer.
  // La réservation résout d'abord la méthode de paiement — le seul champ que la cotation ne
  // demande pas et que la réservation exige. La réponse s'intercale donc ici.
  vus = espion([{ statut: 202, corps: { request_id: "req-7" } },
    { corps: { status: { done: true, total: 1, complete: 1 }, rates: [TARIF("cp-ep-dropoff", 631, "Drop-Off Only")] } },
    { corps: { payment_methods: [{ id: "pm-1", name: "Compte JSB", default: true }] } },
    { corps: { shipment_id: "shp-77", tracking_number: "1234567890" } },
    { corps: { shipment: { state: "booked", primary_tracking_number: "1234567890",
      labels: [{ size: "4x6", format: "pdf", url: "https://f/e.pdf" }] } } }]);
  const achat = await fc.reserver(ENVOI, "cp-ep-dropoff", { references: ["L-50774"] });
  const reservation = vus.find((v) => v.methode === "POST" && v.url.endsWith("/shipment"));
  verifier("réservation sur POST /shipment", !!reservation);
  verifier("clé d'idempotence transmise", reservation.corps.unique_id === u1, reservation.corps.unique_id);
  verifier("recotation fraîche juste avant l'achat",
    vus.filter((v) => /\/rate/.test(v.url)).length === 2, "POST /rate puis GET /rate");
  verifier("référence de commande portée",
    JSON.stringify(reservation.corps.details.reference_codes) === '["L-50774"]');
  verifier("méthode de paiement du compte transmise",
    reservation.corps.payment_method_id === "pm-1", reservation.corps.payment_method_id || "absente");

  /*
   * Un identifiant imposé qui n'existe pas sur le compte.
   *
   * C'est le cas réel : le réglage gardait la méthode du bac à sable après le passage en
   * production. Elle partait telle quelle, et Freightcom refusait la réservation par
   * `{"payment_method_id":"not-found"}`. Le transmettre sans le confronter au compte, c'est
   * déplacer l'erreur jusqu'à la personne qui expédie.
   */
  {
    fc.oublierPaiement();
    process.env.FREIGHTCOM_PAYMENT_METHOD_ID = "pm-du-bac-a-sable";
    run("DELETE FROM rate_cache");
    espion([{ statut: 202, corps: { request_id: "req-pm" } },
      { corps: { status: { done: true, total: 1, complete: 1 }, rates: [TARIF("cp-ep", 700, "Expedited")] } },
      { corps: { payment_methods: [{ id: "pm-1", name: "Compte JSB", default: true }] } }]);
    let refus = "";
    try { await fc.reserver({ ...ENVOI, orderId: 55555, to: { ...ENVOI.to, postalCode: "J9A 1A1" } }, "cp-ep"); }
    catch (e) { refus = e.message; }
    verifier("un identifiant de paiement absent du compte est refusé avant l'appel",
      /n'existe pas sur ce compte/.test(refus), refus.slice(0, 100));
    verifier("le refus nomme les méthodes réelles du compte",
      /pm-1/.test(refus) && /Compte JSB/.test(refus));

    // Et l'inverse : un identifiant imposé qui existe bel et bien doit passer.
    fc.oublierPaiement();
    process.env.FREIGHTCOM_PAYMENT_METHOD_ID = "pm-1";
    run("DELETE FROM rate_cache");
    const vus2 = espion([{ statut: 202, corps: { request_id: "req-pm2" } },
      { corps: { status: { done: true, total: 1, complete: 1 }, rates: [TARIF("cp-ep", 700, "Expedited")] } },
      { corps: { payment_methods: [{ id: "pm-1", name: "Compte JSB", default: true }] } },
      { corps: { shipment_id: "shp-pm", tracking_number: "9" } },
      { corps: { shipment: { state: "booked", primary_tracking_number: "9",
        labels: [{ size: "4x6", format: "pdf", url: "https://f/e.pdf" }] } } }]);
    await fc.reserver({ ...ENVOI, orderId: 44444, to: { ...ENVOI.to, postalCode: "J9B 1B1" } }, "cp-ep");
    const envoye = vus2.find((v) => v.methode === "POST" && v.url.endsWith("/shipment"));
    verifier("un identifiant imposé et valide part tel quel",
      envoye && envoye.corps.payment_method_id === "pm-1");

    delete process.env.FREIGHTCOM_PAYMENT_METHOD_ID;
    fc.oublierPaiement();
  }

  /*
   * La carte VISA est bien enregistrée chez Freightcom — « Primary Card » dans le
   * portefeuille — et la liste revenait vide ici. Une liste vide n'est pas un compte sans
   * carte : c'est le plus souvent une enveloppe qu'on n'a pas su ouvrir. Chaque forme que
   * l'API peut rendre est donc éprouvée.
   */
  console.log("\nMéthodes de paiement — formes de réponse\n" + "─".repeat(64));
  const FORMES = {
    "tableau nu": [{ id: "pm-1", name: "VISA 9044", default: true }],
    "sous payment_methods": { payment_methods: [{ id: "pm-1", name: "VISA 9044", default: true }] },
    "sous data": { data: [{ id: "pm-1", name: "VISA 9044", is_default: true }] },
    "sous items": { items: [{ payment_method_id: "pm-1", nickname: "VISA 9044", primary: true }] },
    "objet indexé par identifiant": { payment_methods: { "pm-1": { name: "VISA 9044", default: true } } },
    "carte sans nom, avec last4": { payment_methods: [{ id: "pm-1", brand: "VISA", last4: "9044", is_primary: true }] },
  };
  for (const [forme, corps] of Object.entries(FORMES)) {
    espion([{ corps }]);
    const l = await fc.methodesPaiement();
    verifier(`${forme} : la méthode est lue`,
      l.length === 1 && l[0].id === "pm-1" && l[0].defaut === true,
      l.length ? `${l[0].id} · ${l[0].nom} · défaut ${l[0].defaut}` : "rien lu");
  }
  {
    // Rien à lire : la réponse entière voyage avec la liste, sinon le vide ne se diagnostique pas.
    espion([{ corps: { quelque_chose: "d'inattendu" } }]);
    const l = await fc.methodesPaiement();
    verifier("une réponse illisible garde sa forme brute pour l'écran",
      l.length === 0 && l.brut && l.brut.quelque_chose === "d'inattendu");
  }
  {
    // Et un identifiant imposé ne se fait pas refuser sur une liste qu'on n'a pas su lire.
    fc.oublierPaiement();
    process.env.FREIGHTCOM_PAYMENT_METHOD_ID = "pm-inconnu";
    espion([{ corps: { forme: "inconnue" } }]);
    const choisi = await fc.methodePaiement();
    verifier("liste illisible : l'identifiant imposé part quand même",
      choisi === "pm-inconnu", "Freightcom tranchera — refuser ici ferait chercher chez lui");
    delete process.env.FREIGHTCOM_PAYMENT_METHOD_ID;
    fc.oublierPaiement();
  }
  verifier("numéro de suivi et prix rendus",
    achat.trackingNumber === "1234567890" && achat.price === 6.31 && achat.dropOff === true);
  verifier("l'étiquette est récupérée après la réservation",
    achat.labelPdf === "https://f/e.pdf" && achat.documentsPrets === true,
    "sans ça, une étiquette payée qu'on ne peut pas imprimer");

  console.log("\nErreurs et secret\n" + "─".repeat(64));
  vus = espion([{ statut: 401, corps: { message: "Invalid API key" } }]);
  msg = "";
  try { await fc.coterDirect(ENVOI); } catch (e) { msg = e.message; }
  verifier("l'erreur de l'API est remontée telle quelle", msg.includes("401") && msg.includes("Invalid API key"), msg);

  const e = fc.etat();
  verifier("l'état ne divulgue jamais la clé", !JSON.stringify(e).includes("cle-essai") && e.configure === true);

  delete process.env.FREIGHTCOM_API_KEY;
  msg = "";
  try { await fc.coterDirect(ENVOI); } catch (x) { msg = x.message; }
  verifier("sans clé, le message dit où la mettre",
    msg.includes("environnement Render") && msg.includes("jamais en base"), msg);
  process.env.FREIGHTCOM_API_KEY = "cle-essai";

  console.log("\nPréchauffage\n" + "─".repeat(64));
  run("DELETE FROM rate_cache");
  // Le préchauffage cote en parallèle : un espion qui répond dans l'ordre d'appel ne suffit
  // plus, les requêtes de deux envois s'entrelacent. Celui-ci répond selon la route.
  let n = 0;
  global.fetch = async (url, opts) => {
    const u = String(url);
    const corps = opts?.method === "POST"
      ? { request_id: `req-p${++n}` }
      : { status: { done: true, total: 1, complete: 1 }, rates: [TARIF("cp-ep", 838, "Expedited")] };
    return { ok: true, status: opts?.method === "POST" ? 202 : 200, text: async () => JSON.stringify(corps) };
  };
  const lot = [ENVOI, { ...ENVOI, orderId: 2 }, { ...ENVOI, orderId: 3, to: { ...ENVOI.to, postalCode: "G1V 0A6" } }];
  const bilan = await fc.prechauffer(lot, { concurrence: 2 });
  verifier("le préchauffage cote et mutualise",
    bilan.demandes === 3 && bilan.cotes + bilan.deja === 3 && bilan.echecs === 0,
    `${bilan.cotes} cotées, ${bilan.deja} déjà en cache, ${bilan.echecs} échecs`);

  vus = espion([{ statut: 500, corps: { message: "panne" } }]);
  const bilan2 = await fc.prechauffer([{ ...ENVOI, orderId: 9, to: { ...ENVOI.to, postalCode: "T2P 1J9" } }]);
  verifier("un préchauffage en panne ne lève pas, il compte l'échec",
    bilan2.echecs === 1, "le chemin normal reste disponible");

  global.fetch = vraiFetch;
  run("DELETE FROM rate_cache");

  // `--coter` fait UNE cotation réelle sur l'envoi de référence de l'audit — Québec →
  // Lac-Beauport, 9 × 6 × 1 po, 45 g. C'est le devis exact qui avait donné 6,31 $ « Drop-Off
  // Only » dans l'interface web le 22 juillet 2026, et donc la seule façon de répondre à la
  // question A1 du brief : ce tarif sort-il de l'API ? Lecture pure, aucune réservation.
  // `--balayage` cote le MÊME envoi à plusieurs poids.
  //
  // « Postes Canada ne sort pas au-delà de 500 g » peut vouloir dire deux choses très
  // différentes : soit le programme Exclusive s'arrête là et un autre service Canada Post
  // prend le relais, soit le compte n'a QUE ce programme et Canada Post disparaît
  // complètement. La première se contourne, la seconde se règle chez Freightcom. Une seule
  // cotation ne permet pas de trancher ; une série au même envoi, si.
  if (process.argv.includes("--balayage")) {
    console.log("\nBalayage de poids — où Canada Post décroche\n" + "─".repeat(72));
    if (CLE_REELLE) process.env.FREIGHTCOM_API_KEY = CLE_REELLE;
    else delete process.env.FREIGHTCOM_API_KEY;
    const base = {
      from: { name: "Lasclay", company: "Les Produits Lasclay", street1: "1 rue des Capucins",
        city: "Québec", state: "QC", country: "CA", postalCode: "G1J 3R4" },
      to: { name: "Essai", street1: "1 chemin du Village", city: "Lac-Beauport", state: "QC",
        country: "CA", postalCode: "G3B 0P2", residential: true },
      parcel: { lengthIn: 9, widthIn: 6, heightIn: 1 }, value: 40, currency: "CAD",
    };
    const poids = [100, 400, 480, 495, 505, 600, 1000, 2000, 5000];
    console.log(`  ${"poids".padEnd(8)} ${"tarifs".padStart(6)}  ${"moins cher".padStart(11)}   services Canada Post`);
    for (const g of poids) {
      try {
        const r = await fc.coterDirect({ ...base, parcel: { ...base.parcel, weightG: g } },
          { deadlineMs: 25000 });
        const cp = r.tarifs.filter((t) => /canada.?post|canadapost/i.test(`${t.carrier} ${t.serviceId}`));
        const min = r.tarifs.length ? r.tarifs[0] : null;
        console.log(`  ${String(g + " g").padEnd(8)} ${String(r.tarifs.length).padStart(6)}` +
          `  ${String(min ? `${min.price} $ ${min.carrier}` : "—").padStart(11)}   ${
          cp.length ? cp.map((t) => `${t.serviceId} ${t.price}$`).join(", ") : `${G}aucun${R}`}`);
      } catch (e) { console.log(`  ${String(g + " g").padEnd(8)} ${X} ${e.message}`); }
    }
    console.log(`\n  ${G}Si Canada Post disparaît d'un seul coup et ne revient jamais, le compte n'a que`);
    console.log(`  le programme Exclusive : c'est un contrat à demander à Freightcom. S'il revient`);
    console.log(`  sous un autre identifiant, il n'y a rien à demander — juste à le reconnaître.${R}`);
    passes++;
  }

  // `--commande L-50145` cote une commande RÉELLE et montre ce qui part et ce qui revient.
  //
  // « Postes Canada n'apparaît pas dans les options » ne se répond pas par une hypothèse : il
  // faut voir le corps envoyé — poids, dimensions, destination — et le panel interrogé.
  // Freightcom dit combien de services il a cherchés ; si Canada Post n'est pas dans les
  // réponses alors que le panel était complet, c'est le transporteur qui décline, pas nous.
  const iCmd = process.argv.indexOf("--commande");
  if (iCmd >= 0) {
    const numero = process.argv[iCmd + 1];
    console.log(`\nCotation réelle de la commande ${numero}\n` + "─".repeat(64));
    if (CLE_REELLE) process.env.FREIGHTCOM_API_KEY = CLE_REELLE;
    else delete process.env.FREIGHTCOM_API_KEY;
    const { one } = require("./lib/db");
    const cmd = one("SELECT id FROM orders WHERE order_number = ? ORDER BY id DESC LIMIT 1", numero);
    if (!cmd) { console.log(`${X} commande introuvable : ${numero}`); echecs++; }
    else {
      const shipments = require("./lib/shipments");
      try {
        const r = await shipments.coter(cmd.id, { fournisseur: "freightcom" });
        const p = r.envoi.parcel;
        console.log(`  envoi : ${p.weightG} g · ${p.lengthIn}×${p.widthIn}×${p.heightIn} po` +
          ` · ${r.envoi.from.postalCode || "?"} → ${r.envoi.to.postalCode || "?"} (${r.envoi.to.country || "CA"})`);
        console.log(`  ${r.tarifs.length} tarif(s) :`);
        for (const t of r.tarifs) {
          console.log(`   ${t.dropOff ? "▼" : " "} ${String(t.price).padStart(7)} $  ${
            String(t.serviceId).padEnd(30)} ${t.carrier}`);
          // Le détail des surcharges : c est là que se lit l écart avec l interface web.
          // Une surtaxe résidentielle ou de zone étendue explique un dollar sans mystère.
          for (const x of t.surcharges || []) {
            if (x.montant) console.log(`        ${G}+${String(x.montant).padStart(6)} $  ${x.nom || x.type}${R}`);
          }
          for (const x of t.detailTaxes || []) {
            if (x.montant) console.log(`        ${G}+${String(x.montant).padStart(6)} $  TAXE ${x.type}${R}`);
          }
          if (t.base !== null && t.base !== undefined) {
            console.log(`        ${G} base ${t.base} $ · hors taxes ${t.prixHT} $ · total ${t.price} $${R}`);
          }
        }
        const cp = r.tarifs.filter((t) => /canada.?post/i.test(`${t.carrier} ${t.serviceId}`));
        console.log(cp.length
          ? `\n  ${V} Postes Canada répond : ${cp.map((t) => `${t.serviceId} ${t.price} $`).join(", ")}`
          : `\n  ${A} Postes Canada ne répond pas pour cet envoi.\n` +
            `  ${G}Le programme « Canada Post Exclusive » est réservé aux envois d'un seul colis\n` +
            `  sous 500 g. À ${p.weightG} g, ce n'est pas lui. Si AUCUN service Canada Post ne sort\n` +
            `  — ni Expedited, ni Xpresspost — c'est que le compte Freightcom n'a pas de contrat\n` +
            `  Canada Post ordinaire : à demander à Freightcom, ce n'est pas réglable ici.${R}`);
        passes++;
      } catch (e) { console.log(`${X} ${e.message}`); echecs++; }
    }
  }

  if (process.argv.includes("--coter")) {
    console.log("\nCotation réelle — envoi de référence de l'audit\n" + "─".repeat(64));
    if (CLE_REELLE) process.env.FREIGHTCOM_API_KEY = CLE_REELLE;
    else delete process.env.FREIGHTCOM_API_KEY;
    const reference = {
      from: { name: "Lasclay", company: "Les Produits Lasclay", street1: "1 rue des Capucins",
        city: "Québec", state: "QC", country: "CA", postalCode: "G1J 3R4" },
      to: { name: "Essai", street1: "1 chemin du Village", city: "Lac-Beauport", state: "QC",
        country: "CA", postalCode: "G3B 0P2", residential: true },
      parcel: { weightG: 45, lengthIn: 9, widthIn: 6, heightIn: 1 },
      value: 40, currency: "CAD",
    };
    try {
      const r = await fc.coterDirect(reference, { deadlineMs: 25000 });
      console.log(`${V} ${r.tarifs.length} tarif(s) en ${r.ms} ms  ${G}${
        r.statut.complete}/${r.statut.total} services interrogés, ${r.complet ? "panel complet" : "panel partiel"}${R}`);
      for (const t of r.tarifs) {
        console.log(`   ${t.dropOff ? "▼" : " "} ${String(t.price).padStart(7)} $  ${
          String(t.serviceId).padEnd(24)} ${t.carrier} · ${t.service}${t.transitDays ? ` · ${t.transitDays} j` : ""}`);
      }
      const depot = r.tarifs.filter((t) => t.dropOff);
      console.log(depot.length
        ? `\n   ${V} ${depot.length} tarif(s) de DÉPÔT exposés par l'API — c'est la réponse à la question A1`
        : `\n   ${G}aucun tarif marqué dépôt. Soit le compte d'essai ne les expose pas, soit ils\n` +
          `   portent un autre libellé : comparer avec l'interface web sur le même envoi.${R}`);
      passes++;
    } catch (e) { console.log(`${X} ${e.message}`); echecs++; }
  }

  // `--sync` existe pour être tapé sans guillemets : le Web Shell de Render mange les
  // séquences de collage, et un `node -e '…'` avec guillemets imbriqués n'y arrive jamais
  // intact. Un drapeau, aucune ponctuation, rien à échapper.
  if (process.argv.includes("--sync")) {
    console.log("\nSynchronisation du panel dans le référentiel\n" + "─".repeat(64));
    if (CLE_REELLE) process.env.FREIGHTCOM_API_KEY = CLE_REELLE;
    else delete process.env.FREIGHTCOM_API_KEY;
    try {
      const r = await fc.synchroniserServices();
      console.log(`${V} ${r.total} services versés  ${G}via ${r.via}, ${r.ajoutes} nouveaux, ${r.majs} mis à jour, ${r.depot} au tarif de dépôt${R}`);
      passes++;
    } catch (e) { console.log(`${X} ${e.message}`); echecs++; }
  }

  // ------------------------------------------------------------- assurance
  //
  // Quelle valeur `insurance.type` accepte le compte ? La question n'est pas théorique :
  // XCover s'éteint avec l'abonnement ShipStation, et ce champ est ce qui le remplace. Le
  // spécimen envoyé est une **cotation**, pas un achat — rien n'est réservé, rien n'est
  // facturé, et l'API répond ce qu'aurait coûté la couverture.
  //
  // Une valeur volontairement fausse est envoyée en dernier : c'est le message d'erreur qui
  // énumère les valeurs permises, comme Chit Chats l'avait fait pour `order_store`. Deviner
  // l'énumération coûte moins cher que la deviner mal en production.
  if (process.argv.includes("--assurance")) {
    console.log("\nAssurance Freightcom — quel `insurance.type` le compte accepte\n" + "─".repeat(64));
    if (CLE_REELLE) process.env.FREIGHTCOM_API_KEY = CLE_REELLE;
    else delete process.env.FREIGHTCOM_API_KEY;
    global.fetch = vraiFetch;
    const envoi = { ...ENVOI, insurance: 100, currency: "CAD" };
    for (const type of ["carrier", "freightcom", "valeur-inexistante"]) {
      process.env.FREIGHTCOM_ASSURANCE_TYPE = type;
      const sansAssurance = { ...ENVOI, insurance: 0 };
      try {
        const [avec, sans] = await Promise.all([
          fc.coter(envoi, { deadlineMs: 25000 }),
          type === "carrier" ? fc.coter(sansAssurance, { deadlineMs: 25000 }) : Promise.resolve(null),
        ]);
        const t = (avec.tarifs || [])[0];
        const t0 = sans && (sans.tarifs || [])[0];
        const prix = (x) => (x ? (x.prixHT ?? x.price) : null);
        const ecart = t && t0 ? ` ${G}(+${(prix(t) - prix(t0)).toFixed(2)} $ sur ${t.service_name || t.service})${R}` : "";
        verifier(`type « ${type} » accepté`, (avec.tarifs || []).length > 0,
          `${(avec.tarifs || []).length} tarif(s)${ecart}`);
      } catch (e) {
        // Sur la valeur bidon, l'échec EST le résultat cherché : il nomme les valeurs permises.
        const attendu = type === "valeur-inexistante";
        verifier(`type « ${type} » ${attendu ? "refusé, et l'erreur énumère" : "accepté"}`,
          attendu, String(e.message).slice(0, 220));
      }
    }
    delete process.env.FREIGHTCOM_ASSURANCE_TYPE;
    console.log(`\n  ${G}Le type retenu se fige avec FREIGHTCOM_ASSURANCE_TYPE dans les réglages Render.`);
    console.log(`  L'écart de prix ci-dessus est le coût réel de la couverture — à comparer aux`);
    console.log(`  1,10 % domestique / 1,50 % international que facturait XCover.${R}`);
  }

  // ----------------------------------------------------------- catalogue
  //
  // La question la plus courte, et un seul appel en lecture : quels transporteurs ce compte
  // porte-t-il ? Une cotation qui n'a jamais rendu Postes Canada peut s'expliquer de dix
  // façons ; un catalogue qui ne le contient pas n'en laisse qu'une.
  if (process.argv.includes("--catalogue")) {
    console.log("\nCatalogue du compte Freightcom — GET /services, lecture pure\n" + "─".repeat(64));
    if (CLE_REELLE) process.env.FREIGHTCOM_API_KEY = CLE_REELLE;
    else delete process.env.FREIGHTCOM_API_KEY;
    global.fetch = vraiFetch;
    try {
      // Quel hôte répond. Le compte d'essai (`…ssd-test.freightcom.com`) et le compte de
      // production n'ont pas le même catalogue : un programme présent chez l'un peut manquer
      // chez l'autre. Un panel qui a changé sans qu'on touche au code commence souvent ici.
      console.log(`  ${G}hôte interrogé : ${fc.BASE}${
        /ssd-test|sandbox|test\./i.test(fc.BASE) ? "   ← COMPTE D'ESSAI, pas la production" : ""}${R}\n`);
      const panel = await fc.services();
      const parTransporteur = new Map();
      for (const x of panel) {
        const t = x.transporteur || "—";
        if (!parTransporteur.has(t)) parTransporteur.set(t, []);
        parTransporteur.get(t).push(x);
      }
      console.log(`${panel.length} services, ${parTransporteur.size} transporteurs\n`);
      for (const [t, liste] of [...parTransporteur.entries()].sort()) {
        console.log(`  ${String(t).padEnd(28)} ${String(liste.length).padStart(3)} service(s)`);
      }
      const cp = panel.filter((x) => /canada\s*post|postes\s*canada/i.test(
        `${x.transporteur} ${x.nom} ${x.id}`));
      console.log("\n" + "─".repeat(64));

      // Un catalogue VIDE ne dit rien sur Postes Canada. Il dit que la lecture n'a rien
      // rendu — endpoint absent sur cet hôte, enveloppe différente, compte non provisionné.
      // Conclure « Postes Canada n'est pas au catalogue » sur zéro service, c'était affirmer
      // à partir de rien. La réponse crue est le seul moyen de trancher.
      if (!panel.length) {
        console.log(`${X} Lecture NON CONCLUANTE : le catalogue est revenu vide.`);
        console.log(`\n  ${G}Zéro service ne veut pas dire « Postes Canada absent » : ça veut dire`);
        console.log(`  que GET /services n'a rien rendu d'exploitable sur cet hôte. Réponse crue :${R}`);
        console.log(`  ${G}${JSON.stringify(panel.reponse).slice(0, 400)}${R}`);
        console.log(`\n  ${G}À regarder dans l'ordre :`);
        console.log(`  1. L'hôte ci-dessus. S'il porte « ssd-test », c'est le bac à sable de`);
        console.log(`     Freightcom, pas la production — son catalogue et ses prix ne sont pas`);
        console.log(`     ceux du compte réel, et une étiquette achetée là n'existe pas.`);
        console.log(`     La production répond sur https://external-api.freightcom.com :`);
        console.log(`     retirer FREIGHTCOM_URL des réglages Render suffit à y revenir, à`);
        console.log(`     condition que FREIGHTCOM_API_KEY soit la clé de production.`);
        console.log(`  2. Si l'hôte est déjà la production, l'enveloppe de la réponse a changé`);
        console.log(`     et c'est la lecture qu'il faut corriger — la réponse crue le dira.${R}`);
      } else if (cp.length) {
        console.log(`${V} Postes Canada EST au catalogue — ${cp.length} service(s) :`);
        for (const x of cp) console.log(`   ${G}${x.id.padEnd(36)} ${x.nom}${R}`);
        // `--catalogue` LIT le catalogue, il ne cote rien. Affirmer ici qu'aucun tarif ne
        // revient serait parler d'une mesure qu'on n'a pas faite — le défaut exact qu'on
        // reproche à un écran qui affirme au lieu de constater.
        const depot = cp.find((x) => /canadapost-exclusive/.test(String(x.id)));
        if (depot) {
          console.log(`\n  ${V} ${G}Dont « ${depot.id} » — le programme de dépôt au comptoir.`);
          console.log(`  C'est le tarif qui porte l'économie du projet : ~6,61 $ contre 11,82 $`);
          console.log(`  chez ShipStation.${R}`);
        }
        console.log(`\n  ${G}Reste à vérifier qu'ils RENDENT un tarif sur un envoi réel — le`);
        console.log(`  catalogue dit ce que le compte publie, pas ce qu'il cote :`);
        console.log(`    node shipstation-clone/verifier_freightcom.js --panel --poids 300${R}`);
      } else {
        console.log(`${X} Postes Canada n'est PAS au catalogue de ce compte.`);
        console.log(`\n  ${G}Aucun réglage du clone n'y changera rien : le clone ne peut pas coter`);
        console.log(`  un service que le courtier ne publie pas. C'est une demande à faire à`);
        console.log(`  Freightcom — activer le programme Canada Post sur le compte.`);
        console.log(`\n  À vérifier d'abord : ce programme a DÉJÀ rendu des tarifs sur ce projet`);
        console.log(`  (canadapost-exclusive.expedited-parcel, 7,28 $ à 483 g). S'il a disparu,`);
        console.log(`  soit l'hôte interrogé a changé — voir la ligne ci-dessus —, soit le`);
        console.log(`  programme a été retiré du compte depuis.`);
        console.log(`\n  Enjeu : le tarif de dépôt « canadapost-exclusive » à 6,61 $ contre`);
        console.log(`  11,82 $ chez ShipStation. En attendant, Chit Chats rend le même service`);
        console.log(`  au comptoir, à 7,14 $ — c'est le chemin de repli, pas une perte sèche.${R}`);
      }
      passes++;
    } catch (e) { console.log(`${X} ${e.message}`); echecs++; }
  }

  // --------------------------------------------------------------- panel
  //
  // Deux constats à expliquer, et une seule façon honnête de les départager : demander deux
  // fois le même envoi, une fois nu et une fois assuré, en attendant à chaque coup que
  // l'API ait fini de répondre.
  //
  //   1. Postes Canada absent du panel, même à 300 g.
  //   2. « NON assuré » sur tous les services.
  //
  // Si Postes Canada apparaît sans assurance et disparaît avec, c'est la demande de
  // couverture qui l'exclut — Freightcom ne rend pas les services qui ne peuvent pas la
  // porter. Si elle est absente des deux, ce n'est pas l'assurance : c'est le compte ou le
  // délai. Le troisième appel, borné au délai interactif, dit si le panel arrivait
  // simplement trop tard.
  if (process.argv.includes("--panel")) {
    const iP = process.argv.indexOf("--poids");
    const poids = iP >= 0 ? Number(process.argv[iP + 1]) : 300;
    console.log(`\nPanel Freightcom à ${poids} g — nu, assuré, et sous délai interactif\n` + "─".repeat(64));
    if (CLE_REELLE) process.env.FREIGHTCOM_API_KEY = CLE_REELLE;
    else delete process.env.FREIGHTCOM_API_KEY;
    global.fetch = vraiFetch;

    const base = { ...ENVOI, parcel: { ...ENVOI.parcel, weightG: poids } };
    const LONG = Number(process.env.FREIGHTCOM_DELAI_COMPLET_MS || 60000);
    const essais = [
      ["sans assurance, réponse complète", { ...base, insurance: 0 }, LONG],
      ["assuré 100 $, réponse complète", { ...base, insurance: 100 }, LONG],
      ["sans assurance, délai interactif", { ...base, insurance: 0 }, undefined],
    ];
    const vus = [];
    for (const [nom, envoi, delai] of essais) {
      try {
        const r = await fc.coter(envoi, { deadlineMs: delai, frais: true });
        const transporteurs = [...new Set(r.tarifs.map((t) => t.carrier))].sort();
        const cp = r.tarifs.filter((t) => /canada\s*post|postes\s*canada/i.test(
          `${t.carrier} ${t.service} ${t.serviceId}`));
        const assures = r.tarifs.filter((t) => t.assurance?.appliquee).length;
        vus.push({ nom, transporteurs, cp: cp.length, n: r.tarifs.length });
        console.log(`\n${nom}`);
        console.log(`  ${r.tarifs.length} tarif(s), ${r.complet ? "panel complet" : "PANEL INCOMPLET"}` +
          `${r.statut?.total ? ` (${r.statut.complete}/${r.statut.total} services)` : ""}, ${r.ms} ms`);
        console.log(`  transporteurs : ${G}${transporteurs.join(", ") || "aucun"}${R}`);
        console.log(`  Postes Canada : ${cp.length ? `${V} ${cp.length} tarif(s) — ` +
          cp.map((t) => `${t.serviceId} ${t.prixHT ?? t.price} $`).join(", ") : `${X} absent`}`);
        if (envoi.insurance) {
          console.log(`  assurance     : ${assures}/${r.tarifs.length} service(s) la portent` +
            `${assures ? "" : `  ${G}type demandé « ${process.env.FREIGHTCOM_ASSURANCE_TYPE || "carrier"} »${R}`}`);
          const ex = r.tarifs[0];
          if (ex) console.log(`  surcharges du 1er tarif : ${G}${
            (ex.surcharges || []).map((x) => `${x.nom} ${x.montant} $`).join(" · ") || "aucune"}${R}`);
        }
      } catch (e) { console.log(`\n${nom}\n  ${X} ${e.message}`); }
    }

    // Le panel du COMPTE, pas celui d'une cotation : si Postes Canada n'y figure pas, aucune
    // cotation ne le fera apparaître, et la question n'est plus technique mais commerciale.
    try {
      const panel = await fc.services();
      const cpPanel = panel.filter((x) => /canada\s*post|postes\s*canada/i.test(
        `${x.transporteur} ${x.nom} ${x.id}`));
      console.log(`\nCatalogue du compte — GET /services : ${panel.length} services`);
      console.log(`  services Postes Canada au catalogue : ${cpPanel.length ? `${V} ` +
        cpPanel.map((x) => x.id).join(", ") : `${X} aucun`}`);
      if (cpPanel.length) {
        console.log(`  ${G}Ils sont au catalogue mais ne rendent aucun tarif sur cet envoi :`);
        console.log(`  restriction de poids, de destination, ou compte non provisionné.${R}`);
      } else {
        console.log(`  ${G}Le programme Postes Canada n'est pas au catalogue de ce compte.`);
        console.log(`  Aucun réglage du clone n'y changera rien — c'est à activer chez Freightcom.${R}`);
      }
    } catch (e) { console.log(`\n${X} catalogue illisible : ${e.message}`); }

    console.log("\n" + "─".repeat(64));
    const [nu, assure, court] = vus;

    // Le coût caché de la demande d'assurance : ce n'est pas son prix, c'est ce qu'elle
    // retire du comparateur. Un transporteur absent ne se remarque pas.
    if (nu && assure) {
      const perdus = nu.transporteurs.filter((t) => !assure.transporteurs.includes(t));
      if (assure.n < nu.n) {
        console.log(`${X} ${G}DEMANDER L'ASSURANCE COÛTE ${nu.n - assure.n} TARIF(S) SUR ${nu.n}.`);
        if (perdus.length) console.log(`  Transporteurs qui disparaissent : ${perdus.join(", ")}`);
        console.log(`  Freightcom filtre les services qui ne peuvent pas honorer le champ.`);
        console.log(`  Avec un « type » que le compte n'accepte pas, il les filtre presque tous.${R}`);
      }
    }
    if (nu && assure) {
      if (nu.cp && !assure.cp) {
        console.log(`${X} ${G}L'ASSURANCE EXCLUT POSTES CANADA du panel. Demander une couverture`);
        console.log(`  retire les services qui ne peuvent pas la porter — et c'est le moins cher`);
        console.log(`  qui disparaît. Régler assurance_active à 0, ou n'assurer qu'à l'achat.${R}`);
      } else if (!nu.cp && !assure.cp) {
        console.log(`${G}Postes Canada est absent DANS LES DEUX CAS : l'assurance n'y est pour rien.`);
        console.log(`  Reste le compte (programme non activé chez Freightcom) ou le poids.`);
        console.log(`  À poser à Freightcom avec cette sortie en pièce jointe.${R}`);
      } else if (nu.cp && assure.cp) {
        console.log(`${V} ${G}Postes Canada répond dans les deux cas. Si l'écran ne le montre pas,`);
        console.log(`  c'est le délai : voir la troisième ligne ci-dessus.${R}`);
      }
    }
    if (court && nu && court.n < nu.n) {
      console.log(`\n${G}Le délai interactif ne rend que ${court.n} tarif(s) sur ${nu.n} :`);
      console.log(`  le panel affiché est tronqué. Le bouton « Attendre la réponse complète »`);
      console.log(`  de l'écran d'expédition sert exactement à ça.${R}`);
    }
  }

  if (process.argv.includes("--reel")) {
    console.log("\nAppel réel — GET /services, lecture pure\n" + "─".repeat(64));
    if (CLE_REELLE) process.env.FREIGHTCOM_API_KEY = CLE_REELLE;
    else delete process.env.FREIGHTCOM_API_KEY;
    const t = await fc.tester();
    if (t.ok) {
      console.log(`${V} ${t.n} services, ${t.transporteurs.length} transporteurs, ${t.ms} ms`);
      for (const s of t.depot) console.log(`   ${G}dépôt →${R} ${s.id.padEnd(28)} ${s.transporteur} · ${s.nom}`);
      if (!t.depot.length) console.log(`   ${G}aucun service au libellé « drop-off » dans le panel${R}`);
      if (t.avis) console.log(`   ${G}${t.avis}${R}`);
      passes++;
    } else { console.log(`${X} ${t.erreur}`); echecs++; }
  }

  console.log("\nDocuments, finance et manifeste — la spec 2.10\n" + "─".repeat(64));
  {
    process.env.FREIGHTCOM_API_KEY = "cle-essai";
    // L'étiquette n'existe pas à la réservation : `POST /shipment` rend un identifiant, les
    // documents arrivent après. Le clone écrivait donc `label_pdf` à NULL sur chaque achat.
    espion([{ corps: { shipment: { state: "booked", primary_tracking_number: "1Z9",
      tracking_numbers: ["1Z9", "1Z8"],
      labels: [{ size: "letter", format: "pdf", url: "https://f/l.pdf" },
               { size: "4x6", format: "pdf", url: "https://f/4x6.pdf" }],
      customs_invoice_url: "https://f/ci.pdf" } } }]);
    const d = await fc.attendreDocuments("SH1", { attenteMs: 0, pas: 1 });
    verifier("l'étiquette 4×6 est préférée au letter", d.etiquette === "https://f/4x6.pdf", d.format);
    verifier("la facture de douane ne se confond pas avec l'étiquette",
      d.douane === "https://f/ci.pdf");
    verifier("le suivi principal et les suivis multi-colis sont lus",
      d.suivi === "1Z9" && d.suivis.length === 2);

    espion([{ corps: { shipment: { state: "draft", labels: [] } } }]);
    const vide = await fc.attendreDocuments("SH1", { attenteMs: 0, pas: 1 });
    verifier("un brouillon ne fabrique pas d'étiquette", !vide.etiquette && vide.statut === "draft");
  }
  {
    // `payment_method_id` est exigé à la réservation et introuvable dans leur interface.
    const vus = espion([{ corps: { payment_methods: [
      { id: "pm_1", type: "prepaid", name: "Prépayé", default: true },
      { id: "pm_2", type: "credit_card", name: "Visa" }] } }]);
    const m = await fc.methodesPaiement();
    verifier("méthodes de paiement listées", m.length === 2 && m[0].id === "pm_1",
      m.map((x) => `${x.id} ${x.type}`).join(" · "));
    verifier("la méthode par défaut est reconnue", m[0].defaut === true);
    verifier("lecture sur GET /finance/payment-methods",
      /\/finance\/payment-methods$/.test(vus[0].url));
  }
  {
    const vus = espion([{ corps: { available_balances: { available: "412.55", currency: "CAD" } } }]);
    const b = await fc.soldeDisponible("pm_1");
    verifier("solde disponible lu", b.montant === "412.55" && b.devise === "CAD",
      `${b.montant} ${b.devise}`);
    verifier("lecture sur /finance/payment-method/{id}/available-balances",
      /available-balances$/.test(vus[0].url));
  }
  {
    // La preuve qu'un achat a eu lieu : c'est ce qui manquait pour trancher la commande
    // 100762, où l'écran disait « étiquette créée » et ClickShip ne montrait aucune facture.
    espion([{ corps: { invoices: [{ id: "in_1", number: "FC16401731", total: "10.41" }] } }]);
    const f = await fc.facturesDe("SH1");
    verifier("facture d'une expédition retrouvée", f.length === 1 && f[0].numero === "FC16401731");

    espion([{ corps: { invoices: [] } }]);
    const rien = await fc.facturesDe("SH2");
    verifier("aucune facture = aucun achat, et ça se voit", rien.length === 0);
  }
  {
    const vus = espion([{ corps: { manifest_id: "mf_1" } },
      { corps: { manifest: { status: "complete", documents: [{ url: "https://f/m.pdf" }] } } }]);
    const dem = await fc.demanderManifeste({ shipmentIds: ["SH1", "SH2"] });
    verifier("manifeste demandé sur POST /manifest", /\/manifest$/.test(vus[0].url) && dem.id === "mf_1");
    verifier("les expéditions partent dans la demande",
      JSON.stringify(vus[0].corps.shipment_ids) === '["SH1","SH2"]');
    const m = await fc.manifeste("mf_1");
    verifier("document du manifeste rendu", m.documents[0] === "https://f/m.pdf", m.statut);
  }
  {
    const vus = espion([{ corps: { pickup_confirmation_number: "PU-77" } }]);
    const r = await fc.planifierRamassage("SH1", { date: "2026-08-10" });
    verifier("ramassage planifié sur /shipment/{id}/schedule",
      /\/shipment\/SH1\/schedule$/.test(vus[0].url) && r.confirmation === "PU-77");
  }
  {
    // « Annulée » est acquis dès le 200 ; « remboursée » ne l'est que si l'API le dit. Le
    // promettre faisait afficher un remboursement qui n'avait pas eu lieu.
    espion([{ corps: {} }]);
    const a1 = await fc.annuler("SH1");
    verifier("annulation acquise, remboursement non supposé",
      a1.annule === true && a1.refunded === false, a1.remboursement);
    espion([{ corps: { refunded: true } }]);
    const a2 = await fc.annuler("SH1");
    verifier("remboursement retenu quand Freightcom le confirme", a2.refunded === true);
  }

  console.log("\n" + "─".repeat(64));
  console.log(`${echecs ? X : V} ${passes}/${passes + echecs} contrôles passés`);
  if (echecs) process.exit(1);
})().catch((e) => { console.error("\nÉCHEC :", e); process.exit(1); });
