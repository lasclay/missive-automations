#!/usr/bin/env node
/**
 * Test d'acceptation du moteur de filtres — les 27 vues (§7.6 du rapport d'audit).
 *
 * Deux contrôles, et le second compte autant que le premier :
 *
 *   1. **Accord SQL / mémoire.** Chaque vue est évaluée deux fois — compilée en SQL pour la
 *      grille, et jouée en JavaScript pour les règles d'automatisation. Les deux chemins
 *      doivent rendre le même nombre. Un écart signifie qu'une commande verrait sa règle
 *      s'appliquer sans apparaître dans la vue qui la décrit, ou l'inverse.
 *
 *   2. **Sémantique de combinaison** (§7.3) : ET entre colonnes, OU entre les valeurs d'un
 *      critère, OU entre deux critères de même colonne et même opérateur, ET entre deux
 *      critères de même colonne et opérateurs différents.
 *
 * Usage : node verifier_vues.js  (base pointée par CLONE_DB)
 */
const db = require("./lib/db");
const criteres = require("./lib/criteres");
const orders = require("./lib/orders");

const V = "\x1b[32m✓\x1b[0m", X = "\x1b[31m✗\x1b[0m";
let ok = 0, ko = 0;
const verifier = (nom, condition, detail = "") => {
  console.log(`  ${condition ? V : X} ${nom}${detail ? `  \x1b[90m${detail}\x1b[0m` : ""}`);
  condition ? ok++ : ko++;
};

function compterSQL(crit, matchAll) {
  const c = criteres.compiler(crit, matchAll);
  return c.sql
    ? db.one(`SELECT COUNT(*) n FROM orders o WHERE ${c.sql}`, ...c.params).n
    : db.one("SELECT COUNT(*) n FROM orders").n;
}

const compterJS = (cmds, crit, matchAll) =>
  cmds.filter((o) => criteres.evaluer(o, crit, matchAll)).length;

console.log("\nTest d'acceptation du moteur de filtres");
console.log("─".repeat(70));

const vues = db.all("SELECT * FROM views WHERE scope = 'orders' ORDER BY position, id");
const cmds = db.all("SELECT * FROM orders").map(orders.hydrater);
console.log(`${vues.length} vues, ${cmds.length} commandes en base\n`);

/**
 * Une suite qui n'a rien à vérifier ne « passe » pas — elle échoue.
 *
 * Sur une base vide, la boucle des 27 vues ne tournait tout simplement pas et le bilan
 * annonçait « 26/26 vérifications passées » en vert. Un vert obtenu parce que le
 * dénominateur est nul n'est pas un succès : c'est exactement le défaut que l'audit
 * reproche à l'écran Douanes (« 0 produit sans code SH » sur un catalogue vide).
 *
 * La suite exige donc les 27 vues attendues, et dit comment les remettre en place.
 */
const VUES_ATTENDUES = 27;
if (vues.length < VUES_ATTENDUES) {
  console.error(`\x1b[31m✗ ${vues.length} vue(s) en base sur ${VUES_ATTENDUES} attendues.\x1b[0m`);
  console.error("  La moitié des contrôles ne peut pas tourner, et un bilan vert le cacherait.");
  console.error("  Chargez la configuration Lasclay d'abord :");
  console.error("    node -e \"require('./lib/lasclay').charger()\"\n");
  process.exit(1);
}

// ── 1. accord SQL / mémoire sur chaque vue ─────────────────────────────────
console.log("1. Accord SQL / mémoire sur les vues sauvegardées");
for (const v of vues) {
  const crit = db.parse(v.criteres, []);
  const matchAll = v.match_all !== 0;
  const nSQL = compterSQL(crit, matchAll);
  const nJS = compterJS(cmds, crit, matchAll);
  verifier(v.name.padEnd(34), nSQL === nJS,
    nSQL === nJS ? `${nSQL} commandes` : `SQL ${nSQL} ≠ mémoire ${nJS}`);
}

// ── 2. sémantique de combinaison ───────────────────────────────────────────
console.log("\n2. Sémantique de combinaison (§7.3)");

const cmd = (o) => ({
  order_number: "T-1", status: "awaiting_shipment", order_total: 50, weight_g: 100,
  ship_to: { country: "CA", state: "QC" }, items: [], tags: [], ...o,
});
const art = (sku, name = "") => ({ sku, name, quantity: 1, adjustment: false });
const ev = (c, crit, matchAll = true) => criteres.evaluer(c, crit, matchAll);

// Règle 1 — colonnes différentes : ET
verifier("colonnes différentes = ET (les deux vraies)",
  ev(cmd({ order_total: 50 }), [
    { field: "country", op: "egal", value: ["CA"] },
    { field: "order_total", op: "inferieur_egal", value: 65 }]));
verifier("colonnes différentes = ET (une fausse ⇒ faux)",
  !ev(cmd({ order_total: 80 }), [
    { field: "country", op: "egal", value: ["CA"] },
    { field: "order_total", op: "inferieur_egal", value: 65 }]));

// Règle 2 — valeurs multiples d'un critère : OU
verifier("valeurs multiples d'un critère = OU",
  ev(cmd({ ship_to: { country: "CA", state: "ON" } }),
    [{ field: "state", op: "egal", value: ["CA-ON", "CA-QC"] }]));
verifier("valeurs multiples en chaîne « a;b;c » = OU",
  ev(cmd({ requested_service: "Free Shipping" }),
    [{ field: "requested_service", op: "contient", value: "Expedited;Free Shipping" }]));

// Règle 3 — même colonne, même opérateur : OU
verifier("même colonne + même opérateur = OU (QC-ON)",
  ev(cmd({ ship_to: { country: "CA", state: "ON" } }), [
    { field: "country", op: "egal", value: ["CA"] },
    { field: "state", op: "egal", value: ["CA-ON"] },
    { field: "state", op: "egal", value: ["CA-QC"] }]));
verifier("même colonne + même opérateur = OU (l'autre branche)",
  ev(cmd({ ship_to: { country: "CA", state: "QC" } }), [
    { field: "state", op: "egal", value: ["CA-ON"] },
    { field: "state", op: "egal", value: ["CA-QC"] }]));
verifier("même colonne + même opérateur : hors des deux ⇒ faux",
  !ev(cmd({ ship_to: { country: "CA", state: "BC" } }), [
    { field: "state", op: "egal", value: ["CA-ON"] },
    { field: "state", op: "egal", value: ["CA-QC"] }]));

// Règle 3 bis — même colonne, opérateurs différents : ET
const graines = [
  { field: "item_sku", op: "contient", scope: "none", value: ["22", "23", "SEEDBMB"] },
  { field: "item_sku", op: "egal", scope: "any", value: ["ASCL-SYRIACA-1.25ML-x1"] },
];
verifier("même colonne + opérateurs différents = ET (cas passant)",
  ev(cmd({ items: [art("ASCL-SYRIACA-1.25ML-x1")] }), graines));
verifier("même colonne + opérateurs différents = ET (l'exclusion doit exclure)",
  !ev(cmd({ items: [art("ASCL-SYRIACA-1.25ML-x1"), art("SEEDBMB-12")] }), graines),
  "sans l'opérateur dans la clé de groupe, ce cas passait à tort");

// Règle 4 — subdivision et unités
verifier("subdivision : « CA-ON » correspond à « ON »",
  ev(cmd({ ship_to: { country: "CA", state: "ON" } }),
    [{ field: "state", op: "egal", value: ["CA-ON"] }]));
verifier("subdivision : « ON » correspond à « CA-ON »",
  ev(cmd({ ship_to: { country: "CA", state: "CA-ON" } }),
    [{ field: "state", op: "egal", value: ["ON"] }]));
verifier("seuil de poids en grammes (73 g)",
  ev(cmd({ weight_g: 70 }), [{ field: "order_weight", op: "inferieur_egal", value: 73 }]) &&
  !ev(cmd({ weight_g: 80 }), [{ field: "order_weight", op: "inferieur_egal", value: 73 }]));

// Diacritiques — les libellés de checkout viennent de Shopify
verifier("alias hérité « weight_g » traduit en « order_weight » (BUG-072)",
  ev(cmd({ weight_g: 70 }), [{ field: "weight_g", op: "inferieur_egal", value: 73 }]) &&
  !ev(cmd({ weight_g: 80 }), [{ field: "weight_g", op: "inferieur_egal", value: 73 }]));
verifier("champ hors vocabulaire refusé à l'écriture",
  !!criteres.valider({ field: "chose_inconnue", op: "egal", value: "x" }));
verifier("opérateur numérique sur champ texte refusé",
  !!criteres.valider({ field: "item_sku", op: "superieur", value: 3 }));
verifier("critère valide accepté",
  criteres.valider({ field: "order_total", op: "superieur", value: 3 }) === null);

verifier("les accents ne cassent pas la correspondance",
  ev(cmd({ requested_service: "Défricheuses" }),
    [{ field: "requested_service", op: "contient", value: ["defricheuses"] }]));

// Portée d'article
const mixte = cmd({ items: [art("MIT22-S-BK", "Mitaines"), art("SEEDBMB-12", "Bombes")] });
verifier("portée « any »", ev(mixte, [{ field: "item_sku", op: "contient", scope: "any", value: ["MIT"] }]));
verifier("portée « all »", !ev(mixte, [{ field: "item_sku", op: "contient", scope: "all", value: ["MIT"] }]));
verifier("portée « none »", !ev(mixte, [{ field: "item_sku", op: "contient", scope: "none", value: ["MIT"] }]));
verifier("portée « none » sur un SKU absent",
  ev(mixte, [{ field: "item_sku", op: "contient", scope: "none", value: ["LUNCHB"] }]));

// Aucun critère
verifier("aucun critère ⇒ toutes les commandes", ev(cmd({}), []));

// ── 3. accord SQL / mémoire sur les cas de portée ──────────────────────────
console.log("\n3. Accord SQL / mémoire sur les portées d'article");
for (const scope of ["any", "all", "none", "only"]) {
  const crit = [{ field: "item_sku", op: "contient", scope, value: ["ASCL"] }];
  const nSQL = compterSQL(crit, true), nJS = compterJS(cmds, crit, true);
  verifier(`portée « ${scope} »`.padEnd(34), nSQL === nJS,
    nSQL === nJS ? `${nSQL} commandes` : `SQL ${nSQL} ≠ mémoire ${nJS}`);
}

console.log("─".repeat(70));
console.log(`\n=== ${ok}/${ok + ko} vérifications passées ===\n`);
process.exit(ko ? 1 : 0);
