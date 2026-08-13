#!/usr/bin/env node
/**
 * Lasclay — veille/veille.js
 * --------------------------------------------------------------------------
 * La façade. Cinq commandes, une boucle.
 *
 *   node veille/veille.js collecte [--limite N] [--sans-ops]
 *       Lit les flux depuis leur curseur, range les nouveaux signaux dans
 *       l'ardoise. Idempotent : relancer ne duplique rien.
 *
 *   node veille/veille.js distille
 *       Réécrit veille/connaissance/decouvertes.md (agrégats + verbatim), et
 *       synthese.md si ANTHROPIC_API_KEY est présente.
 *
 *   node veille/veille.js etat
 *       Où en est chaque flux, ce que contient l'ardoise, quand ça a tourné.
 *
 *   node veille/veille.js montre [--type T] [--produit P] [--statut S] [--n N]
 *       Fouille l'ardoise en ligne de commande.
 *
 *   node veille/veille.js ratifie <statut> <clé> [<clé>…]
 *       Le geste humain : ratifie / rejete / traite. Sans lui, rien ne devient
 *       de la connaissance. C'est volontairement manuel.
 *
 *   node veille/veille.js boucle
 *       collecte puis distille. C'est ce que la tâche planifiée appelle.
 *
 * Node 18+. Aucune dépendance.
 */

const ardoise = require("./ardoise");
const pretri = require("./pretri");
const { collecte } = require("./collecte");
const { distille } = require("./distille");

function drapeau(nom, defaut = null) {
  const i = process.argv.indexOf(`--${nom}`);
  if (i === -1) return defaut;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

function etat() {
  const e = ardoise.lireEtat();
  const signaux = ardoise.charger();
  const agg = pretri.agrege(signaux);

  console.log(`Ardoise : ${agg.total} signaux — ${ardoise.ARDOISE}`);
  console.log("");
  console.log("Par type :");
  for (const [t, n] of agg.par_type) console.log(`  ${String(n).padStart(5)}  ${t}`);
  console.log("");
  console.log("Par statut :");
  for (const [s, n] of agg.par_statut) console.log(`  ${String(n).padStart(5)}  ${s}`);
  console.log("");
  console.log("Curseurs :");
  const c = e.curseurs || {};
  if (!Object.keys(c).length) console.log("  (aucun — la collecte n'a jamais tourné)");
  for (const [flux, v] of Object.entries(c)) {
    const lisible = typeof v === "number" ? new Date(v * 1000).toISOString().slice(0, 10) : v;
    console.log(`  ${flux} → ${lisible}`);
  }
  const dernieres = (e.collectes || []).slice(-5);
  if (dernieres.length) {
    console.log("");
    console.log("Dernières collectes :");
    for (const d of dernieres) {
      console.log(`  ${d.quand.slice(0, 16).replace("T", " ")}  +${d.ajoutes} (${d.doublons} doublons)`);
    }
  }

  // Le taux d'inclassés est la jauge de fraîcheur du pré-tri : quand il monte,
  // c'est que le vocabulaire des clients a bougé et que pretri.js a vieilli.
  const inclasses = (agg.par_type.find(([k]) => k === "inclassé") || [null, 0])[1];
  if (agg.total) {
    const taux = Math.round((inclasses / agg.total) * 100);
    console.log("");
    console.log(`Inclassés : ${taux} %${taux > 25 ? "  ← au-dessus de 25 %, le vocabulaire de pretri.js a vieilli" : ""}`);
  }
}

function montre() {
  const type = drapeau("type");
  const produit = drapeau("produit");
  const statut = drapeau("statut");
  const n = parseInt(drapeau("n", "20"), 10);

  let s = ardoise.charger();
  if (type) s = s.filter((x) => x.type === type);
  if (produit) s = s.filter((x) => (x.produits || []).includes(produit));
  if (statut) s = s.filter((x) => x.statut === statut);
  s.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  console.log(`${s.length} signaux correspondent.\n`);
  for (const x of s.slice(0, n)) {
    console.log(`${x.cle}  ${x.date || "?"}  [${x.type}]  ${x.personne}  (${x.flux || x.source})`);
    console.log(`   ${x.texte.replace(/\s+/g, " ").slice(0, 240)}`);
    console.log("");
  }
}

(async () => {
  const cmd = process.argv[2];
  try {
    if (cmd === "collecte") {
      await collecte({
        limite: parseInt(drapeau("limite", "0"), 10),
        sansOps: !!drapeau("sans-ops", false),
      });
    } else if (cmd === "distille") {
      await distille({});
    } else if (cmd === "boucle") {
      await collecte({ sansOps: !!drapeau("sans-ops", false) });
      console.log("");
      await distille({});
    } else if (cmd === "etat") {
      etat();
    } else if (cmd === "montre") {
      montre();
    } else if (cmd === "ratifie") {
      const statut = process.argv[3];
      const cles = process.argv.slice(4).filter((a) => !a.startsWith("--"));
      if (!ardoise.ETATS.includes(statut) || !cles.length) {
        console.error(`Usage : ratifie <${ardoise.ETATS.join("|")}> <clé> [<clé>…]`);
        process.exit(1);
      }
      console.log(`${ardoise.statuer(cles, statut)} signaux passés à « ${statut} ».`);
    } else {
      console.log(require("node:fs").readFileSync(__filename, "utf8").split("*/")[0]);
      process.exit(cmd ? 1 : 0);
    }
  } catch (e) {
    console.error("Erreur:", e.message);
    process.exit(1);
  }
})();
