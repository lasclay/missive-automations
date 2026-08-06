#!/usr/bin/env node
/**
 * Fusion des commandes en double — réparation d'après migration.
 *
 * Pourquoi cet outil existe
 * -------------------------
 * Le clone remplit ses commandes par **deux chemins** : l'import Shopify direct et la
 * migration ShipStation. Chacun dédoublonne sur `order_key`, mais les deux ne fabriquent pas
 * la même clé pour une même commande. La L-45672 existe donc deux fois, une copie par chemin,
 * et aucun des deux imports ne peut voir celle de l'autre. Résultat en production le 5 août
 * 2026 : 63 248 commandes là où ShipStation en compte 38 858.
 *
 * Qui a raison sur quoi
 * ---------------------
 * **Shopify est la vérité de la commande** : client, articles, montants, adresse. ShipStation
 * n'a jamais été qu'un outil d'expédition ; ce qu'il apporte d'irremplaçable, c'est
 * **l'historique de ce qui a été expédié** — étiquettes achetées, numéros de suivi, coûts,
 * transporteur, poids réellement pesé.
 *
 * Fusionner, pas choisir. Une version antérieure de cet outil supprimait la copie Shopify et
 * gardait celle de ShipStation : elle aurait effacé la source de vérité pour garder la copie.
 *
 * Ce que la fusion préserve
 * -------------------------
 *   survivante  = la copie Shopify (ou, à défaut de Shopify, la plus riche)
 *   déplacés    → expéditions, étiquettes, suivis, lots, préparations externes, étiquettes de
 *                 tri (tags), lignes d'articles si la survivante n'en a aucune
 *   comblés     → transporteur, service, colis, confirmation, poids, dimensions, entrepôt,
 *                 champs personnalisés 1-3 : repris de ShipStation **là où Shopify est vide**,
 *                 jamais par-dessus une valeur existante
 *   notes       → concaténées, aucune n'est perdue
 *   statut      → si ShipStation dit « expédiée » et Shopify non, la réalité est qu'un colis
 *                 est parti : c'est ShipStation qui a raison, et le statut suit
 *   raw         → celui de ShipStation est rangé dans `orders.raw_shipstation`, jamais jeté
 *
 * Rien n'est supprimé avant que tout ait été déplacé, et le tout dans une transaction : une
 * interruption au milieu ne peut pas laisser une expédition orpheline.
 *
 *   node dedoublonner.js               simule, n'écrit rien
 *   node dedoublonner.js --confirmer   fusionne réellement
 *   node dedoublonner.js --limite 100  ne traite que les 100 premiers groupes
 *
 * Sans `--confirmer`, RIEN n'est écrit. C'est la consigne du §2.1 de l'audit.
 */
const { all, one, run, tx, journaliser } = require("./lib/db");

const args = process.argv.slice(2);
const confirme = args.includes("--confirmer");
const limite = Number((args[args.indexOf("--limite") + 1] || 0)) || 0;

const V = "\x1b[32m✓\x1b[0m", A = "\x1b[33m!\x1b[0m", G = "\x1b[90m", R = "\x1b[0m";

/** Champs d'expédition que Shopify ne connaît pas et que ShipStation peut combler. */
const COMBLABLES = ["carrier_code", "service_id", "package_id", "confirmation",
  "weight_g", "dimensions", "warehouse_id", "requested_service",
  "custom_field1", "custom_field2", "custom_field3"];

/** Une valeur « vide » au sens où il vaut la peine de la combler. */
const vide = (v) => v === null || v === undefined || v === "" || v === 0;

function fiche(id) {
  const o = one("SELECT * FROM orders WHERE id = ?", id);
  return {
    id, o,
    ss: !!(o.raw && String(o.raw).includes('"orderId"')),
    envois: one("SELECT COUNT(*) n FROM shipments WHERE order_id = ?", id).n,
    lignes: one("SELECT COUNT(*) n FROM order_items WHERE order_id = ?", id).n,
  };
}

/**
 * D'où vient l'écart avec ShipStation, une fois les doublons fusionnés.
 *
 * Le clone en compte 51 016, ShipStation 38 858. Un excédent n'est pas forcément une erreur :
 * Shopify garde tout depuis l'ouverture de la boutique, ShipStation ne connaît que ce qui lui
 * a été transmis pour expédition. Une commande annulée avant préparation, un ramassage local,
 * une carte-cadeau : Shopify les a, ShipStation jamais.
 *
 * Ce rapport ne conclut pas à la place de personne. Il montre les trois populations et leurs
 * dates, pour qu'on voie si l'excédent ressemble à de l'historique supplémentaire — auquel cas
 * tout va bien — ou à des doublons que le numéro de commande n'a pas rapprochés.
 */
function ecart() {
  console.log("\nD'où vient l'écart avec ShipStation\n" + "─".repeat(72));
  const q = (where) => one(`SELECT COUNT(*) n, MIN(order_date) d1, MAX(order_date) d2 FROM orders WHERE ${where}`);
  const ss = "json_extract(raw,'$.orderId') IS NOT NULL";
  const fus = "raw_shipstation IS NOT NULL";

  const pops = [
    ["Connue des deux (fusionnée)", fus],
    ["ShipStation seulement", `${ss} AND raw_shipstation IS NULL`],
    ["Shopify seulement", `NOT (${ss}) AND raw_shipstation IS NULL`],
  ];
  for (const [nom, w] of pops) {
    const r = q(w);
    console.log(`${nom.padEnd(30)} ${String(r.n).padStart(7)}` +
      `  ${G}${(r.d1 || "—").slice(0, 10)} → ${(r.d2 || "—").slice(0, 10)}${R}`);
  }

  console.log(`\nCommandes vues seulement par Shopify, par année :`);
  for (const r of all(`SELECT substr(order_date,1,4) a, COUNT(*) n FROM orders
      WHERE NOT (${ss}) AND raw_shipstation IS NULL GROUP BY a ORDER BY a`)) {
    console.log(`  ${r.a || "—"}  ${String(r.n).padStart(6)}`);
  }

  console.log(`\n  ${G}Une année antérieure au branchement de ShipStation explique l'excédent sans`);
  console.log(`  qu'il y ait rien à corriger. Un excédent concentré sur les années récentes,`);
  console.log(`  au contraire, signale des doublons que le numéro de commande n'a pas rapprochés.${R}`);

  console.log(`\nCommandes sans expédition ni numéro de suivi, par statut :`);
  for (const r of all(`SELECT status, COUNT(*) n FROM orders o
      WHERE NOT EXISTS (SELECT 1 FROM shipments s WHERE s.order_id = o.id)
      GROUP BY status ORDER BY n DESC`)) {
    console.log(`  ${String(r.status).padEnd(20)} ${String(r.n).padStart(6)}`);
  }
  return 0;
}

function main() {
  if (args.includes("--ecart")) return ecart();
  console.log(`\nFusion des commandes en double — ${confirme ? "\x1b[31mMODE RÉEL\x1b[0m" : "simulation"}\n` + "─".repeat(72));

  const total = one("SELECT COUNT(*) n FROM orders").n;
  const avecRaw = one("SELECT COUNT(*) n FROM orders WHERE raw IS NOT NULL AND json_extract(raw,'$.orderId') IS NOT NULL").n;
  console.log(`Commandes en base : ${total.toLocaleString("fr-CA")}`);
  console.log(`  portant un orderId ShipStation : ${avecRaw.toLocaleString("fr-CA")}`);
  console.log(`  sans orderId (import Shopify)  : ${(total - avecRaw).toLocaleString("fr-CA")}`);

  const groupes = all(`
    SELECT order_number, COALESCE(store_id, -1) sid, COUNT(*) n, GROUP_CONCAT(id) ids
    FROM orders
    WHERE order_number IS NOT NULL AND order_number <> ''
    GROUP BY order_number, sid HAVING n > 1
    ORDER BY n DESC, order_number
    ${limite ? `LIMIT ${limite}` : ""}`);

  if (!groupes.length) {
    console.log(`\n${V} aucun doublon : chaque numéro de commande n'apparaît qu'une fois par boutique.`);
    return 0;
  }

  const plans = [];
  for (const g of groupes) {
    const fiches = String(g.ids).split(",").map(Number).map(fiche);
    // La survivante est la copie Shopify — la vérité de la commande. Si toutes viennent de
    // ShipStation (commande jamais passée par Shopify), on garde la plus riche.
    const shopify = fiches.filter((f) => !f.ss);
    const candidats = shopify.length ? shopify : fiches;
    candidats.sort((a, b) => b.lignes - a.lignes || b.envois - a.envois || a.id - b.id);
    const garde = candidats[0];
    const donneurs = fiches.filter((f) => f.id !== garde.id);

    const comble = COMBLABLES.filter((c) => vide(garde.o[c]) && donneurs.some((d) => !vide(d.o[c])));
    plans.push({
      numero: g.order_number, garde, donneurs,
      envoisDeplaces: donneurs.reduce((s, d) => s + d.envois, 0),
      lignesReprises: garde.lignes === 0 ? donneurs.reduce((s, d) => s + d.lignes, 0) : 0,
      comble,
      statut: donneurs.some((d) => d.o.status === "shipped") && garde.o.status !== "shipped"
        && garde.o.status !== "cancelled" ? "shipped" : null,
    });
  }

  const nDonneurs = plans.reduce((s, p) => s + p.donneurs.length, 0);
  console.log(`\nGroupes en double  : ${groupes.length.toLocaleString("fr-CA")}`);
  console.log(`Lignes à fusionner : ${nDonneurs.toLocaleString("fr-CA")}`);
  console.log(`Après fusion       : ${(total - nDonneurs).toLocaleString("fr-CA")}` +
    `  ${G}(ShipStation en compte 38 858)${R}`);
  console.log(`Survivantes Shopify: ${plans.filter((p) => !p.garde.ss).length.toLocaleString("fr-CA")}` +
    ` sur ${plans.length.toLocaleString("fr-CA")}`);
  console.log(`\nCe qui est récupéré depuis ShipStation :`);
  console.log(`  expéditions déplacées : ${plans.reduce((s, p) => s + p.envoisDeplaces, 0).toLocaleString("fr-CA")}`);
  console.log(`  articles repris (survivante sans ligne) : ${plans.reduce((s, p) => s + p.lignesReprises, 0).toLocaleString("fr-CA")}`);
  console.log(`  statuts corrigés en « expédiée » : ${plans.filter((p) => p.statut).length.toLocaleString("fr-CA")}`);
  const parChamp = {};
  for (const p of plans) for (const c of p.comble) parChamp[c] = (parChamp[c] || 0) + 1;
  for (const [c, n] of Object.entries(parChamp).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(20)} comblé sur ${n.toLocaleString("fr-CA")} commande(s)`);
  }

  console.log("\nÉchantillon :");
  for (const p of plans.slice(0, 6)) {
    console.log(`  ${String(p.numero).padEnd(12)} garde #${String(p.garde.id).padEnd(7)}` +
      `${p.garde.ss ? "(ShipStation)" : "(Shopify)"} ${p.garde.lignes} ligne(s)` +
      ` ← fusionne ${p.donneurs.map((d) => `#${d.id}`).join(", ")}` +
      ` [${p.envoisDeplaces} envoi(s)${p.comble.length ? `, comble ${p.comble.join("/")}` : ""}${
        p.statut ? ", → expédiée" : ""}]`);
  }

  if (!confirme) {
    console.log(`\n${A} Simulation — rien n'a été écrit.`);
    console.log(`  Relancer avec ${G}--confirmer${R} pour fusionner.`);
    console.log(`  ${G}Aucune donnée n'est jetée : le raw ShipStation est rangé dans orders.raw_shipstation.${R}`);
    return 0;
  }

  let n = 0, envois = 0;
  const rates = [];
  for (const p of plans) {
    // Une transaction par groupe : une interruption ne peut pas laisser une expédition
    // orpheline entre le déplacement et la suppression.
    //
    // Et un groupe qui échoue ne fait plus tomber la course entière. La première version
    // s'est arrêtée sur une trace de pile après plusieurs milliers de fusions déjà commises,
    // laissant l'exploitant sans bilan ni idée de l'état de sa base. Un cas particulier se
    // note et se traite après ; il ne prend pas les 12 000 autres en otage.
    try {
    tx(() => {
      for (const d of p.donneurs) {
        // TOUT ce qui pointe vers la commande absorbée doit être repointé avant de la
        // supprimer. La première version n'avait déplacé que les expéditions et les
        // étiquettes, et le DELETE a échoué sur « FOREIGN KEY constraint failed » à mi-course
        // — les retours, les notifications et les liens de scission/fusion restaient
        // accrochés. La liste vient de PRAGMA foreign_key_list, pas de mémoire.
        run("UPDATE shipments SET order_id = ? WHERE order_id = ?", p.garde.id, d.id);
        run("UPDATE returns SET order_id = ? WHERE order_id = ?", p.garde.id, d.id);
        run("UPDATE notifications SET order_id = ? WHERE order_id = ?", p.garde.id, d.id);
        // Auto-références : une commande scindée pointe vers sa mère, une commande fusionnée
        // vers celle qui l'a absorbée. Les laisser pendantes bloquerait la suppression.
        run("UPDATE orders SET parent_id = ? WHERE parent_id = ?", p.garde.id, d.id);
        run("UPDATE orders SET merged_into = ? WHERE merged_into = ?", p.garde.id, d.id);
        run("UPDATE orders SET parent_id = NULL WHERE id = ? AND parent_id = ?", p.garde.id, p.garde.id);
        run("UPDATE orders SET merged_into = NULL WHERE id = ? AND merged_into = ?", p.garde.id, p.garde.id);
        envois += d.envois;
        run("INSERT OR IGNORE INTO order_tags(order_id, tag_id) SELECT ?, tag_id FROM order_tags WHERE order_id = ?",
          p.garde.id, d.id);
        if (p.lignesReprises) run("UPDATE order_items SET order_id = ? WHERE order_id = ?", p.garde.id, d.id);

        for (const c of p.comble) {
          if (!vide(d.o[c])) run(`UPDATE orders SET ${c} = ? WHERE id = ? AND (${c} IS NULL OR ${c} = '' OR ${c} = 0)`,
            d.o[c], p.garde.id);
        }
        if (d.o.internal_notes && d.o.internal_notes !== p.garde.o.internal_notes) {
          run("UPDATE orders SET internal_notes = TRIM(COALESCE(internal_notes,'') || ' ' || ?) WHERE id = ?",
            d.o.internal_notes, p.garde.id);
        }
        if (d.ss && d.o.raw) run("UPDATE orders SET raw_shipstation = ? WHERE id = ?", d.o.raw, p.garde.id);

        run("DELETE FROM order_items WHERE order_id = ?", d.id);
        run("DELETE FROM order_tags WHERE order_id = ?", d.id);
        run("DELETE FROM orders WHERE id = ?", d.id);
        n++;
      }
      if (p.statut) run("UPDATE orders SET status = ? WHERE id = ?", p.statut, p.garde.id);
    });
    } catch (e) { rates.push({ numero: p.numero, garde: p.garde.id, erreur: String(e.message || e) }); }
    // Rendre la main régulièrement : douze mille transactions enchaînées monopolisent
    // l'unique écrivain de SQLite, et l'application n'arrivait plus à créer une session de
    // connexion. Une pause tous les deux cents groupes suffit à laisser passer les écritures
    // de l'application, pour un coût total de quelques secondes sur la course entière.
    if (n % 200 === 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    if (n % 100 === 0) process.stderr.write(`  fusionnées : ${n.toLocaleString("fr-CA")}\n`);
  }
  process.stderr.write(`\r  fusionnées : ${n.toLocaleString("fr-CA")}\n`);

  if (rates.length) {
    console.log(`\n${A} ${rates.length} groupe(s) non fusionné(s) — laissés intacts :`);
    for (const r of rates.slice(0, 10)) console.log(`  ${String(r.numero).padEnd(12)} ${r.erreur}`);
    if (rates.length > 10) console.log(`  … et ${rates.length - 10} autre(s).`);
    console.log(`  ${G}Relancer l'outil les reprendra : il est rejouable sans risque.${R}`);
  }

  journaliser("orders.fusion", "system", null,
    { groupes: plans.length, fusionnees: n, envois_deplaces: envois }, null);

  const reste = one("SELECT COUNT(*) n FROM orders").n;
  const orphelins = one("SELECT COUNT(*) n FROM shipments WHERE order_id IS NOT NULL AND order_id NOT IN (SELECT id FROM orders)").n;
  console.log(`\n${V} ${n.toLocaleString("fr-CA")} doublon(s) fusionné(s), ${envois.toLocaleString("fr-CA")} expédition(s) rattachée(s).`);
  console.log(`  Commandes restantes : ${reste.toLocaleString("fr-CA")}`);
  console.log(orphelins ? `${A} ${orphelins} expédition(s) orpheline(s) — à signaler.`
    : `${V} aucune expédition orpheline.`);
  console.log(`  ${G}Vérifier ensuite avec « Compter des deux côtés » dans les Réglages.${R}`);
  return orphelins ? 1 : 0;
}

process.exit(main());
