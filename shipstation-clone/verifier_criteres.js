#!/usr/bin/env node
/**
 * Vérification du moteur de critères, des 11 règles et des 27 vues.
 *
 * Ce que ce script prouve, sur une base jetable :
 *
 *   1. **Les deux chemins d'évaluation s'accordent.** Chaque vue est jouée en SQL (ce que
 *      fait la grille) et en JavaScript (ce que fait le moteur de règles). Les deux
 *      ensembles de commandes doivent être identiques — sinon une règle et une vue qui
 *      décrivent la même chose sélectionneraient des commandes différentes, ce qui est
 *      exactement le défaut de ShipStation.
 *   2. **La sémantique « même colonne = OU » est celle qu'il faut.** La vue QC-ON doit
 *      ramener les commandes du Québec ET celles de l'Ontario ; en ET pur elle serait vide.
 *   3. **Les portées multi-articles font ce qu'elles annoncent** (exigence D1) : `any`,
 *      `all`, `only`, `none` sur une commande de plusieurs lignes.
 *   4. **L'ordre corrigé des règles 2 et 3 renseigne le centre de coût** — le piège du §12.3.
 *
 * Usage : node shipstation-clone/verifier_criteres.js
 */
process.env.CLONE_DB = process.env.CLONE_DB_TEST ||
  require("path").join(require("os").tmpdir(), `clone-test-${process.pid}.db`);

const fs = require("fs");
const db = require("./lib/db");
const criteres = require("./lib/criteres");
const lasclay = require("./lib/lasclay");
const orders = require("./lib/orders");
const rules = require("./lib/rules");

let echecs = 0, verifs = 0;
const vert = (s) => `\x1b[32m${s}\x1b[0m`, rouge = (s) => `\x1b[31m${s}\x1b[0m`;

function verifier(nom, condition, detail = "") {
  verifs++;
  if (condition) console.log(`  ${vert("✓")} ${nom}`);
  else { echecs++; console.log(`  ${rouge("✗")} ${nom}${detail ? `\n      ${detail}` : ""}`); }
}

// ------------------------------------------------------------------ jeu d'essai

/** Commandes construites pour toucher chaque piège documenté. */
const ESSAIS = [
  { order_number: "T-QC", order_key: "t1", store_id: 198670, order_total: 40, amount_paid: 40,
    shipping_paid: 0, weight_g: 50, requested_service: "Free Shipping",
    ship_to: { name: "A", city: "Québec", state: "CA-QC", country: "CA", postalCode: "G1J 3R4" },
    items: [{ sku: "ASCL-SYRIACA-1.25ML-x1", name: "Graines d'asclépiade", quantity: 1, unit_price: 8 }] },

  { order_number: "T-ON", order_key: "t2", store_id: 198670, order_total: 40, amount_paid: 40,
    shipping_paid: 12, weight_g: 900, requested_service: "Canada Post Expedited Parcel",
    ship_to: { name: "B", city: "Toronto", state: "CA-ON", country: "CA", postalCode: "M5V 2T6" },
    items: [{ sku: "MIT-001", name: "Mitaines urbaines", quantity: 1, unit_price: 40 }] },

  { order_number: "T-BC", order_key: "t3", store_id: 198670, order_total: 40, amount_paid: 40,
    shipping_paid: 12, weight_g: 900, requested_service: "Standard",
    ship_to: { name: "C", city: "Vancouver", state: "CA-BC", country: "CA", postalCode: "V6B 1A1" },
    items: [{ sku: "TUQ-001", name: "Tuque isolée", quantity: 1, unit_price: 40 }] },

  { order_number: "T-USA", order_key: "t4", store_id: 198670, order_total: 55, amount_paid: 55,
    shipping_paid: 3, weight_g: 120, requested_service: "Free Shipping",
    ship_to: { name: "D", city: "Camarillo", state: "CA", country: "US", postalCode: "93010" },
    items: [{ sku: "SEEDBMB-12", name: "Bombes semencières x12", quantity: 1, unit_price: 55 }] },

  // Multi-articles : le cas que ShipStation traite mal (exigence D1).
  { order_number: "T-MIXTE", order_key: "t5", store_id: 198670, order_total: 90, amount_paid: 90,
    shipping_paid: 0, weight_g: 700, requested_service: "Entrepôt Lasclay",
    ship_to: { name: "E", city: "Québec", state: "CA-QC", country: "CA", postalCode: "G1J 3R4" },
    items: [
      { sku: "ASCL-SYRIACA-1.25ML-x1", name: "Graines d'asclépiade", quantity: 1, unit_price: 8 },
      { sku: "MANIQ-01", name: "Manique isolée", quantity: 2, unit_price: 20 },
    ] },

  // SKU composite : c'est lui que la barre verticale de la liste E doit écarter.
  { order_number: "T-JSB", order_key: "t6", store_id: 198670, order_total: 120, amount_paid: 120,
    shipping_paid: 15, weight_g: 400, requested_service: "Standard",
    ship_to: { name: "F", city: "Québec", state: "CA-QC", country: "CA", postalCode: "G1J 3R4" },
    items: [{ sku: "4459028||8x10|digital-print|none", name: "Tirage 8x10", quantity: 1, unit_price: 120 }] },

  { order_number: "T-DDD", order_key: "t7", store_id: 198670, order_total: 30, amount_paid: 30,
    shipping_paid: 0, weight_g: 60, requested_service: "Livraison DDD",
    ship_to: { name: "G", city: "Montréal", state: "CA-QC", country: "CA", postalCode: "H2X 1Y4" },
    items: [{ sku: "PIN-02", name: "Pince à cheveux moyenne", quantity: 1, unit_price: 30 }] },

  { order_number: "T-LUCIE", order_key: "t8", store_id: 198711, order_total: 75, amount_paid: 75,
    shipping_paid: 5, weight_g: 80, requested_service: "Standard",
    ship_to: { name: "H", city: "Lévis", state: "CA-QC", country: "CA", postalCode: "G6V 7E4" },
    items: [{ sku: "BIJ-01", name: "Bague Asclepias", quantity: 1, unit_price: 75 }] },

  { order_number: "T-KASEME", order_key: "t9", store_id: 198670, order_total: 0, amount_paid: 0,
    shipping_paid: 0, weight_g: 0, customer_notes: "commande kaseme à archiver",
    ship_to: { name: "I", city: "Québec", state: "CA-QC", country: "CA", postalCode: "G1J 3R4" },
    items: [] },
];

// ------------------------------------------------------------------ exécution

console.log("\n=== Base de test :", db.CHEMIN, "===\n");

console.log("Chargement de la configuration Lasclay…");
const bilan = lasclay.charger();
console.log("  " + JSON.stringify(bilan) + "\n");

console.log("1. Configuration chargée");
const etat = lasclay.etat();
for (const [cle, attendu] of Object.entries(etat.attendus)) {
  verifier(`${cle} : ${etat[cle]} / ${attendu} attendus`, etat[cle] >= attendu,
    `obtenu ${etat[cle]}`);
}

console.log("\n2. Écriture du jeu d'essai");
const ids = ESSAIS.map((c) => orders.upsert(c));
verifier(`${ids.length} commandes écrites`, ids.length === ESSAIS.length);
const parNumero = Object.fromEntries(ESSAIS.map((c, i) => [c.order_number, ids[i]]));

console.log("\n3. Portées multi-articles (exigence D1) — commande T-MIXTE");
const mixte = orders.parId(parNumero["T-MIXTE"]);
const portees = [
  ["any  contient « graines »", { field: "item_name", op: "contient", scope: "any", value: ["graines"] }, true],
  ["all  contient « graines »", { field: "item_name", op: "contient", scope: "all", value: ["graines"] }, false],
  ["none contient « graines »", { field: "item_name", op: "contient", scope: "none", value: ["graines"] }, false],
  ["none contient « tuque »",   { field: "item_name", op: "contient", scope: "none", value: ["tuque"] }, true],
  ["all  contient « a »",       { field: "item_name", op: "contient", scope: "all", value: ["a"] }, true],
];
for (const [nom, critere, attendu] of portees) {
  const js = criteres.evaluerCritere(mixte, critere);
  const c = criteres.compiler([critere]);
  const sql = db.all(`SELECT o.id FROM orders o WHERE o.id = ? AND ${c.sql}`, mixte.id, ...c.params).length > 0;
  verifier(`${nom} → ${attendu}`, js === attendu && sql === attendu, `js=${js} sql=${sql}`);
}

console.log("\n4. Vue « QC-ON » — deux critères sur la même colonne = OU (§12.3)");
const qcon = db.one("SELECT * FROM views WHERE name = 'QC-ON'");
const rQcOn = orders.chercher({ view_id: qcon.id, limit: 100 });
const numeros = rQcOn.orders.map((o) => o.order_number).sort();
verifier(`ramène QC et ON (${numeros.join(", ")})`,
  numeros.includes("T-QC") && numeros.includes("T-ON") && !numeros.includes("T-BC") && !numeros.includes("T-USA"),
  `obtenu : ${numeros.join(", ")}`);

console.log("\n5. Vue « Graines x1 » — la barre verticale de la liste E est une exclusion");
const gx1 = db.one("SELECT * FROM views WHERE name = 'Graines x1'");
const rGx1 = orders.chercher({ view_id: gx1.id, limit: 100 }).orders.map((o) => o.order_number);
verifier("T-QC (graines seules) retenue", rGx1.includes("T-QC"), `obtenu : ${rGx1.join(", ")}`);
verifier("T-JSB (SKU composite avec « | ») écartée", !rGx1.includes("T-JSB"));
verifier("T-MIXTE (contient une manique) écartée", !rGx1.includes("T-MIXTE"));

console.log("\n6. Vue « TIMBRE 2.0 » — seuil de 73 g");
const timbre = db.one("SELECT * FROM views WHERE name = 'TIMBRE 2.0'");
const rTimbre = orders.chercher({ view_id: timbre.id, limit: 100 }).orders.map((o) => o.order_number);
verifier("T-QC (50 g) retenue", rTimbre.includes("T-QC"), `obtenu : ${rTimbre.join(", ")}`);
verifier("T-ON (900 g) écartée", !rTimbre.includes("T-ON"));

console.log("\n7. Accord SQL / JavaScript sur les 27 vues");
const toutes = orders.chercher({ limit: 1000 }).orders;
for (const v of db.all("SELECT * FROM views WHERE scope = 'orders' ORDER BY position")) {
  const cs = db.parse(v.criteres, []);
  const parSql = new Set(orders.chercher({ view_id: v.id, limit: 1000 }).orders.map((o) => o.id));
  const parJs = new Set(toutes.filter((o) => criteres.evaluer(o, cs, v.match_all !== 0)).map((o) => o.id));
  const meme = parSql.size === parJs.size && [...parSql].every((id) => parJs.has(id));
  verifier(`« ${v.name} » — ${parSql.size} commande(s)`, meme,
    `SQL=[${[...parSql]}] JS=[${[...parJs]}]`);
}

console.log("\n8. Règles — simulation à sec (exigence D2)");
const sec = rules.appliquer(parNumero["T-QC"], { dryRun: true });
verifier("la simulation n'écrit rien",
  db.one("SELECT custom_field3 FROM orders WHERE id = ?", parNumero["T-QC"]).custom_field3 === null);
verifier(`${sec.declenchees.length} règle(s) se déclencheraient`, sec.declenchees.length > 0,
  JSON.stringify(sec.declenchees.map((d) => d.name)));

console.log("\n9. Règles — application réelle, et le piège de l'ordre 2/3 (§12.3)");
for (const id of ids) rules.appliquer(id);

const t1 = orders.parId(parNumero["T-QC"]);
verifier("entrepôt affecté à LAS Capucins (règle 2)", t1.warehouse_id === 153232, `obtenu ${t1.warehouse_id}`);
verifier("centre de coût CF3 = LASCLAY (règle 3 — ne se déclenchait jamais chez ShipStation)",
  t1.custom_field3 === "LASCLAY", `obtenu ${JSON.stringify(t1.custom_field3)}`);
verifier("confirmation par défaut appliquée puis remplacée", t1.confirmation !== null);

const tUsa = orders.parId(parNumero["T-USA"]);
verifier("CF2 = USA sur l'envoi international", tUsa.custom_field2 === "USA", `obtenu ${tUsa.custom_field2}`);

const tDdd = orders.parId(parNumero["T-DDD"]);
verifier("CF1 = « DDD » AVEC son espace finale",
  tDdd.custom_field1 === "DDD ", `obtenu ${JSON.stringify(tDdd.custom_field1)}`);

const tOn = orders.parId(parNumero["T-ON"]);
verifier("règle MIT : service 99 et colis Polymailer Small",
  tOn.service_id === "99" && tOn.package_id === "115317",
  `service=${tOn.service_id} colis=${tOn.package_id}`);
verifier("Do Not Safe Drop appliqué après le service Canada Post (règle 6)",
  tOn.confirmation === "5", `obtenu ${tOn.confirmation}`);

const courriels = db.all("SELECT recipient, order_id FROM notifications WHERE kind = 'rule'");
verifier("courriel de sous-traitance à Lucie mis en file",
  courriels.some((c) => c.recipient === "lucieveilleux@live.ca"), JSON.stringify(courriels));
verifier("aucun courriel DDD (règle inactive chez ShipStation, inactive ici)",
  !courriels.some((c) => c.recipient === "info@boutiqueddd.com"));

console.log("\n10. Préréglages et mappings de service");
const presets = require("./lib/presets");
verifier("17 préréglages", presets.presets().length === 17, `obtenu ${presets.presets().length}`);
const usa = presets.presetParNom("USA Small poly");
verifier("« USA Small poly » : confirmation 1, service 109",
  usa.confirmation === "1" && usa.service_id === "109");
const p11 = presets.presetParNom("11x11x12");
verifier("« 11x11x12 » conserve ses 10 g erronés, avec la note", p11.weight_g === 10 && !!p11.notes);
verifier("« Entrepôt Lasclay » résout vers le canal « ramassage »",
  presets.resoudre("Entrepôt Lasclay - ramassage sur place")?.channel === "ramassage");
verifier("« Stamp (no tracking) » résout vers Polymailer Small",
  presets.resoudre("Stamp (no tracking)")?.package_id === "115317");

console.log("\n11. Classification douanière (§16.3)");
const hs = require("./lib/hs");
const echantillon = [
  ["ASCL-SYRIACA-1.25ML-x1", "Graines d'asclépiade", "1209.30"],
  ["MIT-001", "Mitaines urbaines", "6116.93"],
  ["TUQ-001", "Tuque isolée", "6505.00"],
  ["SEEDBMB-12", "Bombes semencières x12", "3407.00"],
  ["PIN-02", "Pince à cheveux moyenne", "9615.90"],
  ["BIJ-01", "Bague Asclepias", "7117.19"],
  ["MANIQ-01", "Manique isolée", "6307.90"],
  ["LUNCHB-23", "Sac à lunch isotherme", "4202.92"],
];
for (const [sku, name, attendu] of echantillon) {
  const f = hs.classer({ sku, name });
  verifier(`${name} → ${attendu}`, f && f.code === attendu, `obtenu ${f ? f.code : "aucun"}`);
}

console.log("\n12. Alerte de marge (exigence A3, constat OBS9)");
const shipments = require("./lib/shipments");
const perte = shipments.marge({ shipping_paid: 0 }, 9.09);
verifier("livraison gratuite à 9,09 $ → alerte", perte.niveau === "alerte" && perte.ecart === -9.09, JSON.stringify(perte));
const gain = shipments.marge({ shipping_paid: 15 }, 9.09);
verifier("15 $ facturés pour 9,09 $ → ok", gain.niveau === "ok" && gain.ecart === 5.91);

console.log("\n13. Réconciliation des montants (BUG-016)");
const cmds = require("./lib/orders");
const art = (p, q, r = 0) => ({ unit_price: p, quantity: q, discount: r, adjustment: false });

// L-50765, relevé à l'audit : une ligne à 59,99 $ sous « Produits 51,00 $ ». L'écart de
// 8,99 $ était une remise que rien n'affichait — le bloc se contredisait tout seul.
const remisee = cmds.couts({ items: [art(59.99, 1, 8.99)], order_total: 70.13,
  shipping_paid: 9.99, tax_amount: 9.14, discount_amount: 8.99, amount_paid: 70.13 });
verifier("commande remisée : le résumé se referme", remisee.coherent && remisee.ecart === 0,
  `produits ${remisee.produits} − remise ${remisee.remise} + 9,99 + 9,14 = ${remisee.reconstitue}`);
verifier("la remise apparaît comme un montant, pas comme un écart", remisee.remise === 8.99);

// L-46628 : 4 lignes remboursées, quantités à zéro chez Shopify comme chez ShipStation.
// Total nul et lignes nulles se répondent : il n'y a rien à signaler.
const remboursee = cmds.couts({ items: [art(114.99, 0), art(89.99, 0), art(39.99, 0), art(114.99, 0)],
  order_total: 0, shipping_paid: 0, tax_amount: 0, amount_paid: 0, refunded_amount: 351.83 });
verifier("commande entièrement remboursée : cohérente et signalée comme telle",
  remboursee.coherent && remboursee.tout_rembourse && remboursee.rembourse === 351.83);

// Le cas que l'audit voulait voir dénoncé : total à zéro sous des lignes valorisées.
const muette = cmds.couts({ items: [art(6.49, 1)], order_total: 0, shipping_paid: 0,
  tax_amount: 0, amount_paid: 0 });
verifier("total nul sous des lignes valorisées : incohérence annoncée",
  !muette.coherent && /remises ou remboursements non importés/.test(muette.motif || ""),
  muette.motif || "aucun motif");

// L'ajustement (frais, don, emballage cadeau) entre dans le total sans être un article.
const avecAjustement = cmds.couts({
  items: [art(20, 1), { unit_price: 5, quantity: 1, adjustment: true }],
  order_total: 25, shipping_paid: 0, tax_amount: 0, amount_paid: 25 });
verifier("les ajustements comptent dans le total sans compter dans les produits",
  avecAjustement.coherent && avecAjustement.produits === 20 && avecAjustement.ajustements === 5);

// Conversion Shopify : les champs « current… » doivent primer sur les champs d'origine.
const sync = require("./lib/shopify_sync");
const brut = sync.convertir({
  id: "gid://shopify/Order/999", name: "L-99999", createdAt: "2026-07-01T00:00:00Z",
  displayFinancialStatus: "PARTIALLY_REFUNDED", displayFulfillmentStatus: "UNFULFILLED",
  sourceName: "etsy",
  currentTotalPriceSet: { shopMoney: { amount: "51.00" } },
  currentTotalTaxSet: { shopMoney: { amount: "0.00" } },
  currentShippingPriceSet: { shopMoney: { amount: "0.00" } },
  totalReceivedSet: { shopMoney: { amount: "70.13" } },
  totalRefundedSet: { shopMoney: { amount: "19.13" } },
  lineItems: { edges: [{ node: { id: "gid://shopify/LineItem/1", sku: "MIT-001", name: "Mitaines",
    quantity: 2, currentQuantity: 1,
    originalUnitPriceSet: { shopMoney: { amount: "59.99" } },
    totalDiscountSet: { shopMoney: { amount: "17.98" } } } }] },
});
verifier("conversion : la quantité courante l'emporte sur la commandée",
  brut.items[0].quantity === 1 && brut.items[0].quantity_ordered === 2);
verifier("conversion : la remise de ligne est mise au prorata du restant",
  brut.items[0].discount === 8.99, `obtenu ${brut.items[0].discount}`);
verifier("conversion : le montant payé est net du remboursement",
  brut.amount_paid === 51 && brut.refunded_amount === 19.13,
  `payé ${brut.amount_paid}, remboursé ${brut.refunded_amount}`);
verifier("conversion : la provenance Etsy est reconnue", sync.marcheDe({ sourceName: "etsy" }) === "etsy");
verifier("conversion : une commande web reste sur la boutique Shopify",
  sync.marcheDe({ sourceName: "web" }) === "shopify");
verifier("conversion : un brouillon part sur les commandes manuelles",
  sync.marcheDe({ sourceName: "shopify_draft_order" }) === "manual");
verifier("statut : ON_HOLD devient « en attente »",
  sync.statut({ displayFulfillmentStatus: "ON_HOLD" }) === "on_hold");

// ---------------------------------------------- catalogue : import et héritage
/**
 * L'import CSV est la seule réponse raisonnable aux ~3 800 saisies qu'aurait coûté la
 * reconstruction manuelle du catalogue. Trois propriétés doivent tenir, parce que les trois
 * détruisent des données quand elles lâchent :
 *
 *   1. **Rien n'est écrit sans passage à blanc.** Le rapport à blanc doit compter juste et
 *      ne rien laisser en base.
 *   2. **Un CSV partiel ne vide pas les colonnes qu'il n'apporte pas.** `sauverProduit`
 *      réécrit toutes les colonnes ; un fichier « sku,poids » effacerait sinon tous les noms.
 *   3. **La collision de nom de groupe est un cas nommé**, pas un message brut de SQLite.
 */
console.log("\n5. Catalogue — import CSV, héritage, collisions");
const catalog = require("./lib/catalog");

const csv1 = "sku,nom,poids,code_sh,longueur,largeur,hauteur\n" +
  "T-001,Mitaines,200,6116.93,7,12,2.25\nT-002,Sac,460,4202.92,12,6,6\nT-BAD,Mauvais,50,ABC,,,";
const blanc = catalog.importerProduits(csv1, { appliquer: false });
verifier("import à blanc : compte juste et n'écrit rien",
  blanc.lus === 3 && blanc.crees === 2 && blanc.refuses.length === 1 && blanc.a_blanc
  && catalog.chercherProduits({ q: "T-00" }).total === 0,
  `lus ${blanc.lus}, créés ${blanc.crees}, refusés ${blanc.refuses.length}`);
verifier("import : un code SH mal formé est refusé avec son motif",
  /code SH mal formé/.test(blanc.refuses[0].motif) && blanc.refuses[0].sku === "T-BAD");

const applique = catalog.importerProduits(csv1, { appliquer: true });
verifier("import appliqué : les produits valides entrent, l'invalide reste dehors",
  applique.crees === 2 && catalog.chercherProduits({ q: "T-" }).total === 2);
verifier("import : les dimensions sont reconstruites depuis longueur/largeur/hauteur",
  catalog.produitParSku("T-001").dimensions.length === 7
  && catalog.produitParSku("T-001").dimensions.height === 2.25);

// Un second passage n'apportant que le poids ne doit pas effacer le nom ni le code SH.
catalog.importerProduits("sku,poids\nT-001,250", { appliquer: true });
const apresPartiel = catalog.produitParSku("T-001");
verifier("import partiel : les colonnes absentes du fichier sont préservées",
  apresPartiel.weight_g === 250 && apresPartiel.name === "Mitaines" && apresPartiel.hs_code === "6116.93",
  `poids ${apresPartiel.weight_g}, nom ${apresPartiel.name}, SH ${apresPartiel.hs_code}`);

verifier("import : « ignorer » laisse la fiche existante intacte",
  catalog.importerProduits("sku,nom\nT-001,Écrasé", { appliquer: true, collision: "ignorer" }).ignores === 1
  && catalog.produitParSku("T-001").name === "Mitaines");
verifier("import : un fichier sans colonne « sku » est refusé, pas deviné",
  (() => { try { catalog.importerProduits("nom,poids\nX,1", {}); return false; }
           catch (e) { return /sku/.test(e.message); } })());

// Héritage groupe → produit : le mécanisme que la fiche affiche sous chaque champ.
const gid = catalog.sauverGroupe({ name: "Groupe d'essai",
  settings: { weight_g: 200, dimensions: { length: 7, width: 12, height: 2.25, unit: "in" },
    customs: { hs_code: "6116.93", value: 49 } } });
catalog.masseProduits([catalog.produitParSku("T-002").id], { preset_group_id: gid });
const herite = catalog.produitParSku("T-002").herite;
verifier("héritage : la fiche sait ce que son groupe lui fournit",
  herite.groupe === "Groupe d'essai" && herite.weight_g === 200 && herite.declared_value === 49,
  JSON.stringify(herite));
verifier("action de masse : le rattachement à un groupe inconnu est refusé",
  (() => { try { catalog.masseProduits([1], { preset_group_id: 999999 }); return false; }
           catch (e) { return /groupe inconnu/.test(e.message); } })());
verifier("groupe : un nom déjà pris est nommé comme collision, pas comme erreur SQLite",
  (() => { try { catalog.sauverGroupe({ name: "groupe d'essai", settings: {} }); return false; }
           catch (e) { return /s'appelle déjà/.test(e.message) && e.collision === gid; } })());
verifier("groupe : renommer un groupe existant ne se heurte pas à lui-même",
  catalog.sauverGroupe({ id: gid, name: "Groupe d'essai", settings: { weight_g: 210 } }) === gid);

// ------------------------------------------------------------------ bilan

console.log(`\n=== ${verifs - echecs}/${verifs} vérifications passées ===\n`);
try { fs.unlinkSync(db.CHEMIN); fs.rmSync(db.CHEMIN + "-wal", { force: true }); fs.rmSync(db.CHEMIN + "-shm", { force: true }); } catch {}
process.exit(echecs ? 1 : 0);
