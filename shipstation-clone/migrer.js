#!/usr/bin/env node
/**
 * Migration ShipStation → clone, en ligne de commande.
 *
 * L'écran de réglages sait la lancer, mais une migration de 28 565 commandes et 14 406
 * envois ne se pilote pas depuis un onglet qu'on peut fermer : elle dure des minutes,
 * elle journalise beaucoup, et elle doit pouvoir tourner d'abord sur une **copie**.
 *
 *   node migrer.js --recette            copie la base courante et migre dans la copie
 *   node migrer.js --recette --objets produits,clients
 *   node migrer.js --confirmer          migre dans la base pointée par CLONE_DB
 *
 * Sans `--confirmer`, rien n'est écrit dans la base de production : c'est la consigne du
 * rapport d'audit (§2.1) — aucun import de masse sans avoir joué la même opération ailleurs.
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const a = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] || true) : null; };
const recette = args.includes("--recette");
const confirme = args.includes("--confirmer");
const objets = a("--objets") && String(a("--objets")).split(",").map((x) => x.trim());
const maxPages = Number(a("--max-pages")) || 100;
const depuis = a("--depuis") || null;

if (!recette && !confirme) {
  console.error(`Migration ShipStation → clone.

  --recette              copie la base courante et migre dans la copie (aucun risque)
  --confirmer            migre dans la base pointée par CLONE_DB
  --objets a,b,c         limite aux objets nommés (referentiels, commandes, expeditions,
                         lots, fulfillments, produits, clients, webhooks)
  --max-pages N          plafond de pages par statut (défaut 100 = 50 000 commandes)
  --depuis AAAA-MM-JJ    ne reprend que ce qui a changé depuis cette date

Rien n'est écrit sans l'un des deux premiers drapeaux.`);
  process.exit(2);
}

if (recette) {
  const src = process.env.CLONE_DB || path.join(__dirname, "data", "clone.db");
  const dst = path.join(path.dirname(src), `recette-${Date.now()}.db`);
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
  process.env.CLONE_DB = dst;
  console.error(`Recette : base copiée dans ${dst}`);
  console.error("La base de production n'est pas touchée.\n");
}

const db = require("./lib/db");
const ingest = require("./lib/ingest");

const compter = () => Object.fromEntries(["orders", "order_items", "shipments", "products",
  "customers", "stores", "warehouses", "carriers", "services", "packages", "tags", "batches",
  "users"].map((t) => [t, db.one(`SELECT COUNT(*) n FROM ${t}`).n]));

(async () => {
  const t0 = Date.now();
  const avant = compter();
  console.error("Avant :", JSON.stringify(avant));
  console.error("─".repeat(70));

  const bilan = await ingest.migrerDepuisShipStation({
    journal: (m) => console.error(m), maxPagesCommandes: maxPages, depuis, objets,
  });

  const apres = compter();
  console.error("─".repeat(70));
  console.error("Bilan :", JSON.stringify(bilan, null, 1));
  console.error("\nTables (avant → après) :");
  for (const [t, n] of Object.entries(apres)) {
    const d = n - avant[t];
    console.error(`  ${t.padEnd(14)} ${String(avant[t]).padStart(7)} → ${String(n).padStart(7)}` +
      (d ? `  (${d > 0 ? "+" : ""}${d})` : ""));
  }
  console.error(`\nDurée : ${Math.round((Date.now() - t0) / 1000)} s`);
  console.error(`Base  : ${db.CHEMIN}`);
})().catch((e) => { console.error("ÉCHEC :", e.message); process.exit(1); });
