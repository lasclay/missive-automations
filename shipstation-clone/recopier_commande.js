/**
 * Recopier une commande de ShipStation dans le clone, une à la fois.
 *
 *   node shipstation-clone/recopier_commande.js 100760
 *   node shipstation-clone/recopier_commande.js 100760 --confirmer
 *   node shipstation-clone/recopier_commande.js --nom Tammy --province AB
 *
 * Toute la logique est dans `ingest.recopierCommande` — l'écran Réglages appelle la même.
 * Ce fichier ne fait que lire la ligne de commande et mettre en forme.
 *
 * Sans `--confirmer`, rien n'est écrit : on montre ce qui serait créé.
 */
const ingest = require("./lib/ingest");

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const confirmer = args.includes("--confirmer");
const drapeaux = new Set(["--nom", "--province"]);
const numero = args.find((a, i) => !a.startsWith("--") && !drapeaux.has(args[i - 1]));

const V = "\x1b[32m✓\x1b[0m", X = "\x1b[31m✗\x1b[0m", G = "\x1b[90m", R = "\x1b[0m", B = "\x1b[1m";

function montrer(c) {
  console.log(`  ${B}${c.order_number}${R}  ${G}${c.date} · ${c.statut}${R}`);
  console.log(`  ${c.nom || "—"}${c.entreprise ? ` (${c.entreprise})` : ""}`);
  console.log(`  ${c.adresse}`);
  console.log(`  ${c.ville}, ${c.province} ${c.code_postal} ${c.pays}`);
  console.log(`  ${G}boutique ${c.store_id} · entrepôt ${c.warehouse_id} · ` +
    `${c.transporteur || "—"} / ${c.service || "—"} · ${c.poids_g} g · ` +
    `${c.lignes} ligne(s)${c.lignes ? "" : " — aucune, comme chez ShipStation"}${R}`);
}

(async () => {
  const nom = opt("--nom"), province = opt("--province");
  if (!numero && !nom) {
    console.log("\nusage : node shipstation-clone/recopier_commande.js <numéro> [--confirmer]");
    console.log("        node shipstation-clone/recopier_commande.js --nom Tammy --province AB\n");
    process.exit(1);
  }

  console.log(`\nRecherche ${numero ? `de la commande ${numero}` : `« ${nom} »${province ? ` en ${province}` : ""}`}` +
    ` chez ShipStation\n` + "─".repeat(64));
  const r = await ingest.recopierCommande({ numero, nom, province, confirmer,
    journal: (m) => console.error(`  ${G}${m}${R}`) });

  if (!r.trouvees) { console.log(`${X} aucune commande`); process.exit(1); }
  if (r.trouvees > 1) {
    console.log(`${r.trouvees} commandes correspondent :\n`);
    for (const c of r.candidates) { montrer(c); console.log(""); }
    console.log(`  ${G}Relancer avec le numéro voulu.${R}\n`);
    process.exit(0);
  }

  console.log("");
  montrer(r.commande);

  console.log("\n" + "─".repeat(64));
  if (r.existante) {
    console.log(`${G}Déjà dans le clone : #${r.existante.id} (${r.existante.statut}).`);
    console.log(`La recopie la met à jour — elle ne crée pas de doublon.${R}`);
  }
  console.log(`  boutique dans le clone : ${r.boutique || `${X} ${G}absente — la commande n'en aura aucune${R}`}`);
  console.log(`  entrepôt dans le clone : ${r.entrepot || `${X} ${G}absent — expédiée depuis l'entrepôt par défaut${R}`}`);
  if (!r.expeditions.length) console.log(`  ${G}aucune expédition chez ShipStation${R}`);
  for (const e of r.expeditions) {
    console.log(`  expédition ${e.suivi || "sans suivi"} ${G}${e.transporteur || "—"} / ${e.service || "—"} · ` +
      `${e.date} · ${e.cout.toFixed(2)} $${e.assurance ? ` + ${e.assurance.toFixed(2)} $ assurance` : ""}` +
      `${e.annulee ? " · ANNULÉE" : ""}${e.deja_en_base ? " · déjà en base" : ""}${R}`);
  }

  if (r.simulation) {
    console.log(`\n${G}Simulation. Rien n'a été écrit.`);
    console.log(`Relancer avec --confirmer pour recopier.${R}\n`);
    return;
  }

  console.log(`\n${V} Commande ${r.commande.order_number} ${r.creee ? "créée" : "mise à jour"} dans le clone — #${r.id}`);
  console.log(`  ${G}${r.lignes} ligne(s), poids ${Math.round(r.poids_g)} g, statut ${r.statut}, ` +
    `${r.expeditions_ecrites} expédition(s) écrite(s)` +
    `${r.expeditions_deja_en_base ? `, ${r.expeditions_deja_en_base} déjà en base` : ""}${R}\n`);
})().catch((e) => { console.error("\nÉCHEC :", e.message); process.exit(1); });
