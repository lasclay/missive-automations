#!/usr/bin/env node
/**
 * Dédoublonnage des commandes — réparation d'après migration.
 *
 * Pourquoi cet outil existe
 * -------------------------
 * L'upsert de migration dédoublonne sur `order_key`. Or l'ancienne migration partielle avait
 * stocké certaines commandes sous une clé différente de celle que la migration corrigée
 * emploie : la même commande ShipStation existe alors deux fois, sous deux clés. Résultat
 * observé en production le 5 août 2026 : 61 937 expédiées là où ShipStation en compte 38 126.
 *
 * La répétition n'avait pas pu le voir : elle partait d'une base **vide**, donc sans rien à
 * heurter. C'est la limite d'une répétition sur copie neuve plutôt que sur copie de la
 * production, et elle est notée ici pour la prochaine fois.
 *
 * Ce que l'outil fait
 * -------------------
 * Il regroupe les commandes par identifiant ShipStation — `raw.orderId`, qui est le seul
 * identifiant que ShipStation garantit stable — et ne conserve qu'une ligne par groupe.
 *
 * Laquelle ? **La plus riche**, pas la plus récente : celle qui porte le plus d'expéditions,
 * puis le plus de lignes d'articles, puis le plus grand `id`. Un doublon récent mais vide
 * effacerait sinon un historique complet.
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

  // `json_extract` sur la charge d'origine : c'est là que vit l'identifiant ShipStation.
  // Une commande sans `raw.orderId` n'a pas été migrée depuis ShipStation — on n'y touche pas.
  const groupes = all(`
    SELECT json_extract(raw, '$.orderId') AS ss_id, COUNT(*) n, GROUP_CONCAT(id) ids
    FROM orders
    WHERE raw IS NOT NULL AND json_extract(raw, '$.orderId') IS NOT NULL
    GROUP BY ss_id HAVING n > 1
    ORDER BY n DESC, ss_id
    ${limite ? `LIMIT ${limite}` : ""}`);

  if (!groupes.length) {
    console.log(`${V} aucun doublon : chaque commande ShipStation n'apparaît qu'une fois.`);
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
    }));
    // La plus riche gagne : expéditions, puis lignes, puis id le plus grand.
    fiches.sort((a, b) => b.envois - a.envois || b.lignes - a.lignes || b.id - a.id);
    for (const f of fiches.slice(1)) aSupprimer.push({ ...f, ss_id: g.ss_id, garde: fiches[0].id });
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
    console.log(`  ss ${String(x.ss_id).padEnd(12)} supprime #${String(x.id).padEnd(7)}` +
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
