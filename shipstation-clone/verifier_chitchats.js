/**
 * Vérification de l'intégration Chit Chats.
 *
 *   node shipstation-clone/verifier_chitchats.js          hors ligne, `fetch` espionné
 *   node shipstation-clone/verifier_chitchats.js --reel    GET /shipments/count, lecture pure
 *   node shipstation-clone/verifier_chitchats.js --menage  supprime les brouillons abandonnés
 *
 * Le mode hors ligne valide la forme des requêtes, les unités, la mémoire des brouillons et
 * les refus d'achat — sans jeton, sans réseau, sans dépense.
 */
const cc = require("./lib/chitchats");
const { run } = require("./lib/db");

const V = "\x1b[32m✓\x1b[0m", X = "\x1b[31m✗\x1b[0m", A = "\x1b[33m!\x1b[0m", G = "\x1b[90m", R = "\x1b[0m";
let passes = 0, echecs = 0;
const verifier = (t, c, d = "") => {
  if (c) { passes++; console.log(`${V} ${t}${d ? `  ${G}${d}${R}` : ""}`); }
  else { echecs++; console.log(`${X} ${t}${d ? `  ${G}${d}${R}` : ""}`); }
};

const vraiFetch = global.fetch;
const CLIENT_REEL = process.env.CHITCHATS_CLIENT_ID, JETON_REEL = process.env.CHITCHATS_TOKEN;

function espion(routes) {
  const vus = [];
  global.fetch = async (url, opts) => {
    const u = String(url), m = opts?.method || "GET";
    vus.push({ url: u, methode: m, entetes: opts?.headers, corps: opts?.body ? JSON.parse(opts.body) : null });
    for (const [motif, rep] of routes) {
      if (motif.test(`${m} ${u}`)) {
        return { ok: (rep.statut || 200) < 400, status: rep.statut || 200,
          headers: { get: () => null }, text: async () => JSON.stringify(rep.corps ?? {}) };
      }
    }
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => "{}" };
  };
  return vus;
}

const TARIF = (type, ht, total, extra = {}) => ({
  postage_type: type, postage_carrier_type: extra.carrier || "USPS",
  postage_description: extra.nom || type,
  delivery_time_description: "2 to 5 business days",
  tracking_type_description: "Tracked",
  signature_confirmation_description: extra.signature || null,
  delivery_duties_paid_description: extra.ddp || null,
  purchase_amount: String(ht), payment_amount: String(total),
  federal_tax: "0.00", provincial_tax: null, postage_fee: String(ht),
});

const ENVOI_US = {
  orderId: 4242,
  from: { company: "Les Produits Lasclay", street1: "1 rue des Capucins", city: "Québec",
    state: "QC", country: "CA", postalCode: "G1J 3R4" },
  to: { name: "Jane Doe", street1: "123 Anywhere St", city: "Burlington", state: "VT",
    country: "US", postalCode: "05401", residential: true },
  parcel: { weightG: 300, lengthIn: 9, widthIn: 5, heightIn: 2 },
  value: 120, currency: "CAD", signature: true,
};

(async () => {
  process.env.CHITCHATS_CLIENT_ID = "essai-client";
  process.env.CHITCHATS_TOKEN = "essai-jeton";
  delete process.env.CHITCHATS_ENV;
  run("DELETE FROM settings WHERE key LIKE 'chitchats.draft.%'");

  console.log("\nCréation de l'expédition\n" + "─".repeat(64));
  let vus = espion([[/POST .*\/shipments$/, { corps: { shipment: { id: 991, status: "unpaid",
    rates: [TARIF("chit_chats_us_edge_tracked", 8.5, 8.5, { ddp: "Delivery duties paid", nom: "US Edge Tracked" }),
            TARIF("chit_chats_us_select", 12.9, 12.9, { nom: "US Select" })] } } }]]);
  const r1 = await cc.coter(ENVOI_US, { ordre: 4242 });
  const req = vus[0], c = req.corps;

  verifier("bac à sable par défaut", req.url.startsWith("https://staging.chitchats.com/api/v1/clients/essai-client"),
    "aucune étiquette facturée tant que CHITCHATS_ENV n'est pas « prod »");
  verifier("jeton en en-tête Authorization brut", req.entetes.Authorization === "essai-jeton");
  verifier("code postal américain sans espace", c.postal_code === "05401" && c.country_code === "US");
  // Chit Chats EXIGE l espace dans un code postal canadien : sans lui, il répond
  // « return_postal_code field is invalid » puis déclare la province invalide en cascade,
  // ce qui envoie chercher le problème au mauvais endroit.
  verifier("code postal canadien AVEC son espace",
    cc.corpsExpedition({ ...ENVOI_US, to: { ...ENVOI_US.to, country: "CA", postalCode: "j8y6e1" } })
      .postal_code === "J8Y 6E1", "j8y6e1 → J8Y 6E1");
  verifier("province ramenée à deux lettres",
    cc.corpsExpedition({ ...ENVOI_US, to: { ...ENVOI_US.to, country: "CA", state: "Québec", postalCode: "j8y6e1" } }).province_code === "QC");
  verifier("poids en grammes, sans conversion inutile", c.weight === 300 && c.weight_unit === "g");
  verifier("dimensions converties en cm",
    c.size_unit === "cm" && c.size_x === 22.9 && c.size_y === 12.7 && c.size_z === 5.1,
    "9×5×2 po → 22,9×12,7×5,1 cm");
  verifier("signature demandée", c.signature_requested === true,
    "ce que Freightcom ne sait pas transmettre");
  verifier("DDP activé d'office vers les États-Unis", c.duties_paid_requested === true,
    "le client ne paie rien au facteur");
  // L adresse de retour vit dans le compte Chit Chats : en envoyer une autre a valu deux
  // refus sur des données pourtant correctes. Le champ que l API refuse cesse d exister.
  verifier("adresse de retour laissée au compte Chit Chats",
    c.return_postal_code === undefined && c.return_province_code === undefined);
  verifier("CHITCHATS_RETOUR=1 la remet, au bon format",
    (() => { process.env.CHITCHATS_RETOUR = "1";
      const x = cc.corpsExpedition(ENVOI_US);
      delete process.env.CHITCHATS_RETOUR;
      return x.return_postal_code === "G1J 3R4" && x.return_province_code === "QC"; })());
  verifier("numéro de commande porté", String(c.order_id) === "4242");

  console.log("\nLecture des tarifs\n" + "─".repeat(64));
  verifier("2 tarifs lus", r1.tarifs.length === 2, r1.tarifs.map((t) => `${t.serviceId} ${t.price}$`).join(" · "));
  verifier("tri du moins cher au plus cher", r1.tarifs[0].price <= r1.tarifs[1].price);
  verifier("DDP visible sur le tarif", r1.tarifs[0].ddp === "Delivery duties paid");
  verifier("dépôt toujours vrai", r1.tarifs.every((t) => t.dropOff === true),
    "Chit Chats est un consolidateur : jamais de ramassage");
  verifier("délai lisible conservé", r1.tarifs[0].delai === "2 to 5 business days");

  console.log("\nBrouillons\n" + "─".repeat(64));
  vus = espion([[/PATCH .*\/shipments\/991\/refresh$/, { corps: { shipment: { id: 991, status: "unpaid",
    rates: [TARIF("chit_chats_us_edge_tracked", 8.5, 8.5)] } } }]]);
  const r2 = await cc.coter(ENVOI_US, { ordre: 4242 });
  verifier("un envoi inchangé rafraîchit le brouillon au lieu d'en créer un autre",
    r2.reutilise === true && vus.length === 1 && vus[0].methode === "PATCH");

  vus = espion([
    [/DELETE .*\/shipments\/991$/, { corps: {} }],
    [/POST .*\/shipments$/, { corps: { shipment: { id: 992, status: "unpaid",
      rates: [TARIF("chit_chats_us_edge_tracked", 9.1, 9.1)] } } }],
  ]);
  await cc.coter({ ...ENVOI_US, parcel: { ...ENVOI_US.parcel, weightG: 900 } }, { ordre: 4242 });
  verifier("un envoi modifié supprime l'ancien brouillon avant d'en créer un neuf",
    vus.some((v) => v.methode === "DELETE") && vus.some((v) => v.methode === "POST"),
    "sinon le compte se remplit de brouillons que personne n'a demandés");

  vus = espion([
    [/POST .*\/shipments$/, { corps: { shipment: { id: 993, rates: [TARIF("x", 5, 5)] } } }],
    [/DELETE/, { corps: {} }],
  ]);
  await cc.coter(ENVOI_US);   // sans `ordre` : cotation exploratoire
  verifier("une cotation sans commande ne laisse rien derrière",
    vus.some((v) => v.methode === "DELETE"), "le brouillon est supprimé aussitôt lu");

  console.log("\nAchat\n" + "─".repeat(64));
  run("DELETE FROM settings WHERE key LIKE 'chitchats.draft.%'");
  vus = espion([
    [/POST .*\/shipments$/, { corps: { shipment: { id: 994, status: "unpaid",
      rates: [TARIF("chit_chats_us_edge_tracked", 8.5, 8.5, { ddp: "Delivery duties paid" })] } } }],
    [/PATCH .*\/994\/buy$/, { corps: { shipment: { id: 994, status: "postage_requested" } } }],
    [/GET .*\/shipments\/994$/, { corps: { shipment: { id: 994, status: "ready",
      carrier: "USPS", carrier_tracking_code: "9400111899223", purchase_amount: "8.50",
      payment_amount: "8.50", postage_label_pdf_url: "https://chitchats.com/labels/994.pdf",
      tracking_url: "https://chitchats.com/t/994" } } }],
  ]);
  const achat = await cc.acheter(ENVOI_US, "chit_chats_us_edge_tracked", { ordre: 4242 });
  verifier("l'achat nomme le postage_type",
    vus.find((v) => /buy$/.test(v.url))?.corps?.postage_type === "chit_chats_us_edge_tracked");
  verifier("l'achat attend que le statut soit terminé",
    achat.statut === "ready", "« postage_requested » n'est pas une étiquette");
  verifier("numéro de suivi et étiquette rendus",
    achat.trackingNumber === "9400111899223" && !!achat.labelPdf);
  verifier("prix hors taxes conservé à côté du débit", achat.prixHT === 8.5 && achat.price === 8.5);
  verifier("le brouillon est oublié après achat",
    !require("./lib/db").one("SELECT 1 v FROM settings WHERE key = ?", "chitchats.draft.4242"),
    "il ne doit jamais être réutilisé pour une seconde étiquette");

  run("DELETE FROM settings WHERE key LIKE 'chitchats.draft.%'");
  vus = espion([
    [/POST .*\/shipments$/, { corps: { shipment: { id: 995, rates: [TARIF("a", 5, 5)] } } }],
  ]);
  let msg = "";
  try { await cc.acheter(ENVOI_US, "service-inexistant", { ordre: 4242 }); } catch (e) { msg = e.message; }
  verifier("achat refusé sur un service absent de la cotation", msg.includes("absent de la cotation"), msg);

  run("DELETE FROM settings WHERE key LIKE 'chitchats.draft.%'");
  vus = espion([
    [/POST .*\/shipments$/, { corps: { shipment: { id: 996, rates: [TARIF("a", 5, 5)] } } }],
    [/PATCH .*\/996\/buy$/, { corps: {} }],
    [/GET .*\/shipments\/996$/, { corps: { shipment: { id: 996, status: "postage_purchase_failed" } } }],
  ]);
  msg = "";
  try { await cc.acheter(ENVOI_US, "a", { ordre: 4242 }); } catch (e) { msg = e.message; }
  verifier("un achat refusé par Chit Chats lève au lieu de rendre une étiquette vide",
    msg.includes("postage_purchase_failed"), msg);

  console.log("\nCanada, annulation et secret\n" + "─".repeat(64));
  vus = espion([[/POST .*\/shipments$/, { corps: { shipment: { id: 997, rates: [TARIF("a", 5, 5)] } } }], [/DELETE/, { corps: {} }]]);
  await cc.coter({ ...ENVOI_US, to: { ...ENVOI_US.to, country: "CA", postalCode: "H2X 1Y4" } });
  verifier("pas de DDP au domestique", vus[0].corps.duties_paid_requested === false);

  vus = espion([[/PATCH .*\/refund$/, { corps: {} }]]);
  const ann = await cc.annuler(994);
  verifier("annulation d'une étiquette achetée → remboursement",
    ann.refunded === true && ann.mode === "remboursement");

  vus = espion([[/PATCH .*\/refund$/, { statut: 422, corps: { error: "not purchased" } }], [/DELETE/, { corps: {} }]]);
  const ann2 = await cc.annuler(998);
  verifier("annulation d'un brouillon → suppression", ann2.mode === "brouillon supprimé",
    "Chit Chats distingue les deux, appeler l'un pour l'autre échoue");

  vus = espion([[/GET .*count/, { statut: 422, corps: { errors: { postal_code: ["is invalid"], weight: ["too heavy"] } } }]]);
  const ko = await cc.tester();
  verifier("un objet d erreurs devient un message lisible",
    !ko.ok && /postal_code : is invalid/.test(ko.erreur) && /weight : too heavy/.test(ko.erreur),
    ko.erreur);

  const e = cc.etat();
  verifier("l'état ne divulgue ni le jeton ni le client entier",
    !JSON.stringify(e).includes("essai-jeton") && e.jeton_present === true && e.client.includes("•"), e.client);
  verifier("milieu d'essai signalé non productif", e.production === false);

  delete process.env.CHITCHATS_TOKEN;
  msg = "";
  try { await cc.coter(ENVOI_US); } catch (x) { msg = x.message; }
  verifier("sans jeton, le message dit où le mettre",
    msg.includes("environnement Render") && msg.includes("jamais en base"), msg);

  global.fetch = vraiFetch;
  if (CLIENT_REEL) process.env.CHITCHATS_CLIENT_ID = CLIENT_REEL;
  if (JETON_REEL) process.env.CHITCHATS_TOKEN = JETON_REEL;
  run("DELETE FROM settings WHERE key LIKE 'chitchats.draft.%'");

  if (process.argv.includes("--reel")) {
    console.log("\nAppel réel — GET /shipments/count, lecture pure\n" + "─".repeat(64));
    const t = await cc.tester();
    if (t.ok) {
      console.log(`${V} connexion établie  ${G}${t.milieu} · client ${t.client} · ${t.ms} ms · ${t.expeditions ?? "?"} expédition(s)${R}`);
      if (t.avis) console.log(`   ${G}${t.avis}${R}`);
      passes++;
    } else {
      console.log(`${X} ${t.erreur}  ${G}(${t.hote})${R}`);
      if (t.piste) console.log(`   ${A} ${t.piste}`);
      echecs++;
    }
  }

  if (process.argv.includes("--menage")) {
    console.log("\nMénage des brouillons abandonnés\n" + "─".repeat(64));
    const m = await cc.menage();
    console.log(`${m.echecs ? A : V} ${m.supprimes} supprimé(s) sur ${m.examines} examiné(s), ${m.echecs} échec(s)`);
    passes++;
  }

  console.log("\n" + "─".repeat(64));
  console.log(`${echecs ? X : V} ${passes}/${passes + echecs} contrôles passés`);
  if (echecs) process.exit(1);
})().catch((e) => { console.error("\nÉCHEC :", e); process.exit(1); });
