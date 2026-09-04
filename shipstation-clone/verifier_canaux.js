#!/usr/bin/env node
/**
 * Le renvoi du suivi aux boutiques — qui est notifié, et qui ne l'est pas.
 *
 * Le défaut qu'on fige ici : la première étiquette réelle achetée dans le clone s'est
 * imprimée, le colis est parti, et Shopify n'a rien reçu — ni exécution, ni numéro de suivi.
 * La date de bascule n'était pas posée, et le renvoi se taisait sans laisser de trace.
 *
 * La bascule protège l'HISTORIQUE : elle existe pour ne pas réécrire à des clients dont
 * ShipStation a déposé le suivi il y a des mois. Une étiquette achetée ICI n'a jamais été
 * notifiée par personne — la retenir laisse un client sans suivi sur une commande qu'on
 * vient d'expédier. Le discriminant est `provider` : les expéditions migrées n'en portent
 * aucun, celles achetées ici portent le nom de leur fournisseur.
 *
 * Aucun réseau : sans variables de canal, `notifier` s'arrête sur « canal non configuré ».
 * C'est justement la preuve qu'il a franchi le garde-fou de la bascule.
 *
 * Usage : node shipstation-clone/verifier_canaux.js
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

process.env.CLONE_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "clone-canaux-")), "essai.db");
// Le canal Shopify ne doit pas être joignable : on éprouve la décision, pas l'envoi.
delete process.env.SHOPIFY_STORE;
delete process.env.SHOPIFY_TOKEN;

const { run, one, dump, poserReglage } = require("./lib/db");
const channels = require("./lib/channels");

const V = "\x1b[32m✓\x1b[0m", X = "\x1b[31m✗\x1b[0m", G = "\x1b[90m", R = "\x1b[0m";
let ok = 0, ko = 0;
const verifier = (nom, cond, detail = "") => {
  console.log(`  ${cond ? V : X} ${nom}${detail ? `  ${G}${detail}${R}` : ""}`);
  cond ? ok++ : ko++;
};

const HIER = "2026-08-01T10:00:00.000Z";
const AUJOURDHUI = "2026-09-03T10:00:00.000Z";

let _cle = 6000000000;
function commande(numero) {
  // `order_key` porte l'identifiant Shopify : le canal le refuse s'il n'est pas numérique.
  run(`INSERT INTO orders (order_key,order_number,store_id,status,order_date,ship_to,weight_g)
       VALUES (?,?,?,'shipped','2026-09-01',?,400)`,
    String(++_cle), numero, 198670,
    dump({ name: "Nathalie Carpentier", street1: "508A Chemin du Tour-du-Lac",
      city: "Lac-Beauport", state: "QC", postalCode: "G3B 0V6", country: "CA" }));
  return one("SELECT last_insert_rowid() r").r;
}

function expedition(orderId, { provider = null, cree = AUJOURDHUI } = {}) {
  run(`INSERT INTO shipments (order_id,label_id,tracking_number,carrier_code,created_at,provider,
         marketplace_notified,voided,is_return)
       VALUES (?,?,?,?,?,?,0,0,0)`,
    orderId, `lbl-${orderId}`, `TRK${orderId}`, "purolator", cree, provider);
  return one("SELECT last_insert_rowid() r").r;
}

(async () => {
  console.log("\nRenvoi du suivi aux boutiques\n" + "─".repeat(64));

  // La boutique Shopify doit exister, sinon aucun canal ne s'applique et le test ne dit rien.
  run(`INSERT INTO stores (id,name,marketplace,active) VALUES (198670,'LAS Shopify','shopify',1)
       ON CONFLICT(id) DO NOTHING`);

  poserReglage("bascule_canaux", null);
  verifier("au départ, aucune bascule n'est posée", !channels.dateBascule());

  // --- l'étiquette achetée ici, sans bascule : c'est le cas réel
  const c1 = commande("L-51031");
  const e1 = expedition(c1, { provider: "freightcom" });
  const r1 = await channels.notifier(e1);
  verifier("une étiquette achetée ici franchit l'absence de bascule",
    !/bascule/.test(String(r1.ignore || "")), r1.ignore || r1.erreur || JSON.stringify(r1));
  verifier("elle atteint bien le canal Shopify",
    /canal shopify non configur/i.test(String(r1.erreur || "")), r1.erreur || "");

  // --- l'expédition migrée, sans bascule : elle doit rester tranquille
  const c2 = commande("L-40000");
  const e2 = expedition(c2, { provider: null, cree: HIER });
  const r2 = await channels.notifier(e2);
  verifier("une expédition migrée est retenue tant que la bascule n'est pas posée",
    /bascule non posée/.test(String(r2.ignore || "")), r2.ignore || "");
  // Un renvoi qui n'a pas lieu doit se lire, pas se deviner.
  verifier("le motif est écrit sur l'expédition, pas seulement renvoyé",
    /bascule non posée/.test(String(one("SELECT notify_error e FROM shipments WHERE id = ?", e2).e || "")));

  // --- bascule posée : l'historique reste derrière, le reste passe
  poserReglage("bascule_canaux", "2026-09-01T00:00:00.000Z");
  verifier("la bascule est posée", !!channels.dateBascule(), channels.dateBascule());

  const r2b = await channels.notifier(e2);
  verifier("une expédition antérieure à la bascule reste à ShipStation",
    /antérieure à la bascule/.test(String(r2b.ignore || "")), r2b.ignore || "");

  const c3 = commande("L-51032");
  const e3 = expedition(c3, { provider: null, cree: AUJOURDHUI });
  const r3 = await channels.notifier(e3);
  verifier("une expédition postérieure à la bascule est notifiée",
    /canal shopify non configur/i.test(String(r3.erreur || "")), r3.erreur || r3.ignore || "");

  // --- le geste explicite passe outre
  const r2c = await channels.notifier(e2, { force: true });
  verifier("le renvoi forcé rattrape une expédition laissée derrière",
    /canal shopify non configur/i.test(String(r2c.erreur || "")), r2c.erreur || r2c.ignore || "");

  // --- la file et le compteur d'historique
  const file = channels.enAttente(50).map((x) => x.order_number);
  verifier("la file contient l'étiquette achetée ici", file.includes("L-51031"), file.join(", "));
  verifier("elle ne contient pas l'historique migré", !file.includes("L-40000"), file.join(", "));

  poserReglage("bascule_canaux", null);
  verifier("sans bascule, l'étiquette achetée ici reste dans la file",
    channels.enAttente(50).map((x) => x.order_number).includes("L-51031"));
  verifier("et l'historique ignoré ne compte que les expéditions migrées",
    channels.historiqueIgnore() >= 1 && !channels.enAttente(50).map((x) => x.order_number).includes("L-40000"));

  // --- ce qui ne doit jamais partir
  run("UPDATE shipments SET voided = 1 WHERE id = ?", e3);
  verifier("une étiquette annulée n'est jamais notifiée",
    /annulée/.test(String((await channels.notifier(e3)).ignore || "")));

  const c4 = commande("L-51033");
  const e4 = expedition(c4, { provider: "chitchats" });
  run("UPDATE shipments SET is_return = 1 WHERE id = ?", e4);
  verifier("une étiquette de retour n'est jamais notifiée",
    /retour/.test(String((await channels.notifier(e4)).ignore || "")));

  const e5 = expedition(c1, { provider: "freightcom" });
  run("UPDATE shipments SET marketplace_notified = 1 WHERE id = ?", e5);
  verifier("une expédition déjà notifiée ne l'est pas deux fois",
    (await channels.notifier(e5)).deja === true);

  // ------------------------------------------------- le refus de Shopify, traduit
  console.log("\nPortées Shopify\n" + "─".repeat(64));

  /*
   * « GraphQL: Access denied for fulfillmentOrders field. » nomme un champ, pas un droit,
   * et il tombe une fois l'étiquette payée. Le clone est le seul endroit qui sache quelles
   * portées il demande : c'est donc ici qu'on le traduit en geste.
   */
  const shopify = channels.CANAUX.shopify;
  verifier("le canal déclare les portées dont il a besoin",
    shopify.portees.includes("read_merchant_managed_fulfillment_orders")
    && shopify.portees.includes("write_merchant_managed_fulfillment_orders"),
    shopify.portees.join(", "));

  // Le canal doit joindre Shopify pour pousser : sans variables, on ne teste que la
  // traduction du message, ce qui est justement la part qui n'exige aucun réseau.
  process.env.SHOPIFY_STORE = "essai.myshopify.com";
  process.env.SHOPIFY_CLIENT_ID = "id-essai";
  process.env.SHOPIFY_CLIENT_SECRET = "secret-essai";
  const vraiClient = shopify.client;
  shopify.client = () => ({
    gql: async () => { throw new Error("GraphQL: Access denied for fulfillmentOrders field."); },
    tokenScopes: async () => ({ mode: "client credentials", scopes: ["read_orders", "read_products"] }),
  });

  const c6 = commande("L-51034");
  const e6 = expedition(c6, { provider: "freightcom" });
  const refus = await channels.notifier(e6);
  verifier("le refus d'accès nomme les portées manquantes",
    /read_merchant_managed_fulfillment_orders/.test(String(refus.erreur || "")),
    String(refus.erreur || "").slice(0, 80));
  verifier("et il dit où les ajouter",
    /Admin API access scopes/.test(String(refus.erreur || "")) && /réinstaller/.test(String(refus.erreur || "")));
  verifier("le motif est conservé sur l'expédition",
    /portées/.test(String(one("SELECT notify_error e FROM shipments WHERE id = ?", e6).e || "")));

  /*
   * Le délai d'une heure.
   *
   * Le jeton vaut une heure et porte les portées qu'il avait à l'émission. Après la
   * publication d'une nouvelle version de l'app, l'appel continue d'être refusé jusqu'à son
   * expiration — un délai qui ressemble à une panne, pendant lequel on cherche un problème
   * déjà réglé. Un refus d'accès doit donc valoir une reprise, avec un jeton neuf.
   */
  {
    let appels = 0, oublis = 0;
    shopify.client = () => ({
      oublierJeton: () => { oublis++; },
      tokenScopes: async () => ({ mode: "client credentials", scopes: [] }),
      gql: async () => {
        appels++;
        // Premier appel : le vieux jeton, refusé. Second : le jeton neuf, accepté.
        if (oublis === 0) throw new Error("GraphQL: Access denied for fulfillmentOrders field.");
        if (appels === 2) return { order: { id: "gid://shopify/Order/1", fulfillmentOrders: { edges: [
          { node: { id: "gid://shopify/FulfillmentOrder/1", status: "OPEN" } }] } } };
        return { fulfillmentCreate: { fulfillment: { id: "gid://shopify/Fulfillment/1",
          status: "SUCCESS", trackingInfo: { number: "TRK", company: "Purolator", url: "https://x" } },
          userErrors: [] } };
      },
    });
    const c7 = commande("L-51035");
    const e7 = expedition(c7, { provider: "freightcom" });
    const rep = await channels.notifier(e7);
    verifier("un refus d'accès déclenche une reprise avec un jeton neuf",
      oublis === 1, `${oublis} rafraîchissement(s)`);
    verifier("et l'expédition passe sans attendre l'expiration du jeton",
      rep.suivi === "TRK" && !rep.erreur, rep.erreur || `suivi ${rep.suivi}`);
    verifier("elle est marquée notifiée",
      one("SELECT marketplace_notified n FROM shipments WHERE id = ?", e7).n === 1);
  }
  {
    // Un vrai manque de portée se reproduit à l'identique : une seule reprise, puis le
    // message. Sans cette borne, un droit réellement absent bouclerait.
    let appels = 0, oublis = 0;
    shopify.client = () => ({
      oublierJeton: () => { oublis++; },
      tokenScopes: async () => ({ mode: "client credentials", scopes: [] }),
      gql: async () => { appels++; throw new Error("GraphQL: Access denied for fulfillmentOrders field."); },
    });
    const c8 = commande("L-51036");
    const e8 = expedition(c8, { provider: "freightcom" });
    const rep = await channels.notifier(e8);
    verifier("un droit réellement absent ne boucle pas", appels === 2 && oublis === 1,
      `${appels} appel(s), ${oublis} rafraîchissement(s)`);
    verifier("et le message reste celui qui nomme les portées",
      /read_merchant_managed_fulfillment_orders/.test(String(rep.erreur || "")));
  }

  shopify.client = () => ({
    gql: async () => { throw new Error("GraphQL: Access denied for fulfillmentOrders field."); },
    tokenScopes: async () => ({ mode: "client credentials", scopes: ["read_orders", "read_products"] }),
  });
  const p = await shopify.verifierPortees();
  verifier("les portées manquantes se lisent avant d'expédier",
    p.connues === true && p.manquantes.length === 2, p.manquantes.join(", "));

  shopify.client = () => ({
    gql: async () => ({}),
    tokenScopes: async () => ({ mode: "client credentials",
      scopes: ["read_orders", "read_merchant_managed_fulfillment_orders", "write_merchant_managed_fulfillment_orders"] }),
  });
  const p2 = await shopify.verifierPortees();
  verifier("une app correctement outillée ne signale rien",
    p2.connues === true && p2.manquantes.length === 0);

  // Un jeton fixe n'expose pas ses portées : ne rien affirmer vaut mieux qu'annoncer un
  // manque qui n'existe peut-être pas.
  shopify.client = () => ({ gql: async () => ({}),
    tokenScopes: async () => ({ mode: "jeton fixe", scopes: null, note: "portées non lisibles" }) });
  const p3 = await shopify.verifierPortees();
  verifier("un jeton dont les portées sont illisibles n'invente pas de manque",
    p3.connues === false && p3.manquantes.length === 0, p3.note);

  shopify.client = vraiClient;
})().then(() => {
  console.log("\n" + "─".repeat(64));
  console.log(ko ? `${X} ${ko} contrôle(s) en échec sur ${ok + ko}` : `${V} ${ok}/${ok} contrôles passés`);
  process.exit(ko ? 1 : 0);
}).catch((e) => { console.error("\nÉCHEC :", e.message); process.exit(1); });
