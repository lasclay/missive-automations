#!/usr/bin/env node
/**
 * Lasclay — « Fais le point ». Le brief que le Chief lit à chaque réveil.
 * -----------------------------------------------------------------------
 * memoire/ETAT.md est la page complète ; ceci en est la version téléphone.
 * Contrainte tenue volontairement : ça doit tenir sur un écran. Un brief
 * qu'on fait défiler n'est pas lu, et un Chief qui récite tout ne dirige rien.
 *
 * Usage :
 *   node chief/point.js              # le point, 24 h
 *   node chief/point.js --heures 72  # après une fin de semaine
 */

const { execFileSync } = require("child_process");
const path = require("path");
const S = require("../memoire/sources");

const args = process.argv.slice(2);
const i = args.indexOf("--heures");
const heures = i > -1 ? Number(args[i + 1]) : 24;

// La mémoire est dérivée : on la régénère avant de la lire, jamais l'inverse.
try {
  execFileSync("node", [path.join(__dirname, "..", "memoire", "index.js"), "--heures", String(heures)],
    { cwd: path.join(__dirname, ".."), stdio: "ignore" });
} catch { /* si l'index échoue, on lit quand même les sources directement */ }

const maintenant = new Date();
const depuis = new Date(maintenant.getTime() - heures * 3600 * 1000);
const attente = S.enAttenteDeGabriel();
const flotte = S.flotte(maintenant);
const evenements = [...S.backlogFacebook(depuis), ...S.commits(depuis), ...S.journalManuel(depuis)];
const branches = S.branchesEnAttente();

const l = [];
l.push("POINT — " + S.heureLocale(maintenant.toISOString()) + " · fenêtre " + heures + " h");
l.push("");

if (attente.length) {
  l.push("TON TOUR (" + attente.length + ")");
  for (const a of attente.slice(0, 5)) l.push("  · " + a.quoi + (a.gravite ? "  [" + a.gravite + "]" : ""));
  if (attente.length > 5) l.push("  · … et " + (attente.length - 5) + " autres — `node memoire/index.js attente`");
} else {
  l.push("TON TOUR — rien. Personne n'est bloqué sur toi.");
}
l.push("");

const muets = flotte.filter((f) => f.etat === "silencieux" || f.etat === "aucune trace");
const aveugles = flotte.filter((f) => f.etat === "invérifiable");
l.push("FLOTTE — " + flotte.filter((f) => f.etat === "actif").length + " actifs, " +
  muets.length + " silencieux, " + aveugles.length + " invérifiables");
for (const f of muets) l.push("  !! " + f.nom + " — rien depuis " + (f.age_h != null ? f.age_h + " h" : "toujours"));
l.push("");

const parAgent = new Map();
for (const e of evenements) parAgent.set(e.agent, (parAgent.get(e.agent) || 0) + 1);
if (parAgent.size) {
  l.push("A BOUGÉ");
  for (const [agent, n] of [...parAgent].sort((a, b) => b[1] - a[1]).slice(0, 6)) l.push("  · " + agent + " — " + n);
} else {
  l.push("A BOUGÉ — rien.");
}
l.push("");

l.push("PAS DÉPLOYÉ — " + branches.length + " branche(s) hors `main`" +
  (branches.length ? " ; la plus récente : " + branches[0].branche : ""));
l.push("");
l.push("Détail : memoire/ETAT.md");

console.log(l.join("\n"));
