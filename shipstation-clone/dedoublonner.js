#!/usr/bin/env node
/**
 * Dédoublonnage des commandes — réparation d'après migration.
 *
 * Pourquoi cet outil existe
 * -------------------------
 * Le clone remplit ses commandes par **deux chemins** : la migration ShipStation et l'import
 * Shopify direct. Chacun dédoublonne sur `order_key`, mais les deux ne fabriquent pas la même
 * clé pour une même commande. La L-45672 existe donc deux fois, une copie par chemin, et
 * aucun des deux imports ne peut voir celle de l'autre. Résultat en production le 5 août
 * 2026 : 63 248 commandes là où ShipStation en compte 38 858.
 *
 * Deux erreurs de ma part valent d'être écrites ici, parce qu'elles se répéteront sinon.
 *
 * 1. La répétition de migration partait d'une base **vide** : elle ne pouvait heurter aucune
 *    ligne préexistante, donc rien révéler. Une répétition se fait sur une copie de la
 *    PRODUCTION, pas sur une base neuve.
 * 2. La première version de cet outil groupait sur `raw.orderId` et a annoncé « aucun
 *    doublon » sur 63 248 commandes. C'était faux : les copies venues de Shopify n'ont pas
 *    d'identifiant ShipStation, elles étaient donc hors du groupement. Un contrôle qui ne
 *    regarde qu'une partie de la base doit dire laquelle, jamais conclure au vert.
 *
 * Ce que l'outil fait
 * -------------------
 * Il regroupe sur ce que les deux chemins ont forcément en commun — le **numéro de commande**
 * dans sa boutique — et ne conserve qu'une ligne par groupe.
 *
 * Laquelle ? **La plus riche**, pas la plus récente : le plus d'expéditions, puis le plus de
 * lignes d'articles, puis la copie venue de ShipStation (elle porte l'historique
 * transporteur), puis le plus grand `id`. Un doublon récent mais vide effacerait sinon un
 * historique complet.
 *
 *   node dedoublonner.js               simule, n'écrit rien
 *   node dedoublonner.js --confirmer   supprime réellement
 *   node dedoublonner.js --limite 100  ne traite que les 100 premiers groupes
 *
 * Sans `--confirmer`, RIEN n'est écrit. C'est la consigne du §2.1 de l'audit.
 */
const { all, one, run, tx, maintenant, journaliser } = require("./lib/db");

const args = process.argv.slice(2);
const confirme = args.includes("--confirmer");
const limite = Number((args[args.indexOf("--limite") + 1] || 0)) || 0;

const V = "\x1b[32m✓\x1b[0m", A = "\x1b[33m!\x1b[0m", G = "\x1b[90m", R = "\x1b[0m";

function main() {
  console.log(`\nDédoublonnage des commandes — ${confirme ? "\x1b[31mMODE RÉEL\x1b[0m" : "simulation"}\n` + "─".repeat(70));

  const total = one("SELECT COUNT(*) n FROM orders").n;
  console.log(`Commandes en base : ${total.toLocaleString("fr-CA")}`);

  // Diagnostic AVANT de conclure.
  //
  // La première version groupait sur `raw.orderId` et annonçait « aucun doublon » sur
  // 63 248 commandes. C'était faux, et le pire genre de faux : un vert sur une base qu'on
  // n'a pas regardée. Les deux copies d'une commande ne viennent pas de la même source —
  // l'une de la migration ShipStation, l'autre de l'import Shopify direct — donc elles
  // n'ont ni la même clé, ni le même `raw`, ni le même identifiant ShipStation. Grouper
  // là-dessus ne pouvait rien trouver.
  //
  // Le seul point commun de deux copies d'une même commande, c'est ce que le client a
  // acheté : son **numéro de commande**, dans sa boutique.
  const avecRaw = one("SELECT COUNT(*) n FROM orders WHERE raw IS NOT NULL AND json_extract(raw,'$.orderId') IS NOT NULL").n;
  console.log(`  dont porteuses d'un orderId ShipStation : ${avecRaw.toLocaleString("fr-CA")}`);
  console.log(`  dont sans orderId (import direct) : ${(total - avecRaw).toLocaleString("fr-CA")}`);

  const groupes = all(`
    SELECT order_number, COALESCE(store_id, -1) sid, COUNT(*) n, GROUP_CONCAT(id) ids
    FROM orders
    WHERE order_number IS NOT NULL AND order_number <> ''
    GROUP BY order_number, sid HAVING n > 1
    ORDER BY n DESC, order_number
    ${limite ? `LIMIT ${limite}` : ""}`);

  if (!groupes.length) {
    console.log(`${V} aucun doublon : chaque numéro de commande n'apparaît qu'une fois par boutique.`);
    return 0;
  }

  const aSupprimer = [];
  for (const g of groupes) {
    const ids = String(g.ids).split(",").map(Number);
    const fiches = ids.map((id) => ({
      id,
      envois: one("SELECT COUNT(*) n FROM shipments WHERE order_id = ?", id).n,
      lignes: one("SELECT COUNT(*) n FROM order_items WHERE order_id = ?", id).n,
      cle: one("SELECT order_key FROM orders WHERE id = ?", id).order_key,
      ss: !!one("SELECT 1 v FROM orders WHERE id = ? AND json_extract(raw,'$.orderId') IS NOT NULL", id),
    }));
    // La plus riche gagne : expéditions, puis lignes, puis provenance ShipStation (elle porte
    // l identifiant transporteur et l historique), puis id le plus grand.
    fiches.sort((a, b) => b.envois - a.envois || b.lignes - a.lignes || (b.ss ? 1 : 0) - (a.ss ? 1 : 0) || b.id - a.id);
    for (const f of fiches.slice(1)) aSupprimer.push({ ...f, ss_id: g.order_number, garde: fiches[0].id });
  }

  const avecEnvois = aSupprimer.filter((x) => x.envois > 0);
  console.log(`Groupes en double : ${groupes.length.toLocaleString("fr-CA")}`);
  console.log(`Lignes à supprimer : ${aSupprimer.length.toLocaleString("fr-CA")}`);
  console.log(`Après nettoyage    : ${(total - aSupprimer.length).toLocaleString("fr-CA")}`);
  if (avecEnvois.length) {
    console.log(`${A} ${avecEnvois.length} doublon(s) à supprimer portent pourtant des expéditions.`);
    console.log(`  ${G}Elles sont conservées : on ne supprime jamais une ligne qui porte un envoi,`);
    console.log(`  parce qu'une étiquette achetée ne se réinvente pas.${R}`);
  }

  console.log("\nÉchantillon :");
  for (const x of aSupprimer.slice(0, 8)) {
    console.log(`  ${String(x.ss_id).padEnd(12)} supprime #${String(x.id).padEnd(7)}` +
      ` (${x.lignes} ligne(s), ${x.envois} envoi(s), clé « ${String(x.cle).slice(0, 28)} »)` +
      ` → garde #${x.garde}`);
  }

  // Un doublon qui porte une expédition n'est pas un doublon inerte : le supprimer perdrait
  // une étiquette achetée. On le laisse et on le signale, quitte à ce que le compte reste
  // imparfait — un chiffre légèrement faux vaut mieux qu'une étiquette effacée.
  const sûrs = aSupprimer.filter((x) => x.envois === 0);
  console.log(`\nSuppressions sûres : ${sûrs.length.toLocaleString("fr-CA")} sur ${aSupprimer.length.toLocaleString("fr-CA")}`);

  if (!confirme) {
    console.log(`\n${A} Simulation — rien n'a été écrit.`);
    console.log(`  Relancer avec ${G}--confirmer${R} pour supprimer les ${sûrs.length.toLocaleString("fr-CA")} lignes sûres.`);
    return 0;
  }

  let n = 0;
  const paquet = 500;
  for (let i = 0; i < sûrs.length; i += paquet) {
    const lot = sûrs.slice(i, i + paquet);
    tx(() => {
      for (const x of lot) {
        run("DELETE FROM order_items WHERE order_id = ?", x.id);
        run("DELETE FROM order_tags WHERE order_id = ?", x.id);
        run("DELETE FROM orders WHERE id = ?", x.id);
        n++;
      }
    });
    process.stderr.write(`\r  supprimées : ${n.toLocaleString("fr-CA")}`);
  }
  process.stderr.write("\n");
  journaliser("orders.dedupe", "system", null,
    { groupes: groupes.length, supprimees: n, conservees_avec_envois: avecEnvois.length }, null);

  const reste = one("SELECT COUNT(*) n FROM orders").n;
  console.log(`\n${V} ${n.toLocaleString("fr-CA")} doublon(s) supprimé(s). Commandes restantes : ${reste.toLocaleString("fr-CA")}`);
  console.log(`  ${G}Vérifier ensuite avec « Compter des deux côtés » dans les Réglages.${R}`);
  return 0;
}

process.exit(main());
