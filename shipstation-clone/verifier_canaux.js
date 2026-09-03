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

function commande(numero) {
  run(`INSERT INTO orders (order_key,order_number,store_id,status,order_date,ship_to,weight_g)
       VALUES (?,?,?,'shipped','2026-09-01',?,400)`,
    `k-${numero}`, numero, 198670,
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
})().then(() => {
  console.log("\n" + "─".repeat(64));
  console.log(ko ? `${X} ${ko} contrôle(s) en échec sur ${ok + ko}` : `${V} ${ok}/${ok} contrôles passés`);
  process.exit(ko ? 1 : 0);
}).catch((e) => { console.error("\nÉCHEC :", e.message); process.exit(1); });
