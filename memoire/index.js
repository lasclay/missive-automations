#!/usr/bin/env node
/**
 * Lasclay — Mémoire partagée : ce qui est vrai maintenant.
 * ---------------------------------------------------------
 * Écrit `memoire/ETAT.md`, la page que toute session — humaine ou agent —
 * lit avant de travailler. Elle répond à quatre questions, dans cet ordre :
 *
 *   1. Qu'est-ce qui attend une décision de Gabriel ?
 *   2. Que fait la flotte, et qui s'est tu ?
 *   3. Qu'est-ce qui a bougé depuis hier ?
 *   4. Qu'est-ce qui traîne sans être déployé ?
 *
 * Elle est DÉRIVÉE, jamais saisie : on la régénère, on ne l'édite pas.
 *
 * Usage :
 *   node memoire/index.js              # régénère ETAT.md (fenêtre 24 h)
 *   node memoire/index.js --heures 72  # fenêtre plus large
 *   node memoire/index.js attente      # seulement ce qui attend Gabriel
 *   node memoire/index.js flotte       # seulement l'état des agents
 *   node memoire/index.js json         # tout, en JSON
 */

const fs = require("fs");
const path = require("path");
const S = require("./sources");

function construire(heures) {
  const maintenant = new Date();
  const depuis = new Date(maintenant.getTime() - heures * 3600 * 1000);
  const evenements = [...S.backlogFacebook(depuis), ...S.commits(depuis), ...S.journalManuel(depuis)]
    .sort((a, b) => (a.t < b.t ? 1 : -1));
  return {
    genere_le: maintenant.toISOString(),
    fenetre_h: heures,
    attente: S.enAttenteDeGabriel(),
    flotte: S.flotte(maintenant),
    evenements,
    branches: S.branchesEnAttente(),
  };
}

function rendre(e) {
  const l = [];
  l.push("# État — mémoire partagée de Lasclay");
  l.push("");
  l.push("Page **dérivée**, régénérée par `node memoire/index.js`. Ne l'édite pas : elle est");
  l.push("reconstruite à partir des traces que les agents laissent déjà. Fenêtre : " + e.fenetre_h + " h.");
  l.push("Générée le " + S.heureLocale(e.genere_le) + " (heure de l'Est).");
  l.push("");

  l.push("## 1. Ce qui attend une décision");
  l.push("");
  if (!e.attente.length) {
    l.push("_Rien. Personne n'est bloqué sur toi._");
  } else {
    for (const a of e.attente) {
      l.push("- **" + a.quoi + "**");
      l.push("  - " + a.pourquoi + (a.gravite ? " · gravité " + a.gravite : "") + (a.depuis ? " · depuis le " + a.depuis : ""));
      if (a.comment) l.push("  - `" + a.comment + "`");
    }
  }
  l.push("");

  l.push("## 2. La flotte");
  l.push("");
  l.push("| Agent | Horaire | Dernière trace | État |");
  l.push("| --- | --- | --- | --- |");
  for (const f of e.flotte) {
    const derniere = f.derniere ? S.heureLocale(f.derniere) + " (" + f.age_h + " h)" : "—";
    const etat = { actif: "actif", silencieux: "**SILENCIEUX**", "invérifiable": "invérifiable", "aucune trace": "**aucune trace**" }[f.etat] || f.etat;
    l.push("| " + f.nom + " | " + (f.horaire || "—") + " | " + derniere + " | " + etat + " |");
  }
  const muets = e.flotte.filter((f) => f.etat === "silencieux" || f.etat === "aucune trace");
  const aveugles = e.flotte.filter((f) => f.etat === "invérifiable");
  l.push("");
  if (muets.length) l.push("⚠️ Silencieux au-delà de leur seuil : " + muets.map((f) => f.nom).join(", ") + ".");
  if (aveugles.length) l.push("Invérifiables — ne laissent aucune trace dans le dépôt, on ne peut ni les déclarer sains ni en panne : " + aveugles.map((f) => f.nom).join(", ") + ".");
  l.push("");

  l.push("## 3. Ce qui a bougé (" + e.fenetre_h + " h)");
  l.push("");
  if (!e.evenements.length) {
    l.push("_Rien._");
  } else {
    const parAgent = new Map();
    for (const ev of e.evenements) (parAgent.get(ev.agent) || parAgent.set(ev.agent, []).get(ev.agent)).push(ev);
    for (const [, liste] of parAgent) liste.sort((a, b) => (a.t < b.t ? 1 : -1));
    for (const [agent, liste] of [...parAgent].sort((a, b) => b[1].length - a[1].length)) {
      l.push("**" + agent + "** — " + liste.length + " événement" + (liste.length > 1 ? "s" : ""));
      for (const ev of liste.slice(0, 8)) l.push("- `" + S.heureLocale(ev.t) + "` " + ev.resume + (ev.preuve ? "  ·  " + ev.preuve : ""));
      if (liste.length > 8) l.push("- _… et " + (liste.length - 8) + " autres_");
      l.push("");
    }
  }

  l.push("## 4. Ce qui n'est pas déployé");
  l.push("");
  l.push("Les services Render suivent `main` : tant qu'une branche n'y est pas fusionnée, son travail ne tourne nulle part.");
  l.push("");
  if (!e.branches.length) {
    l.push("_Tout est dans `main`._");
  } else {
    l.push("**" + e.branches.length + " branches** portent du travail absent de `main`. Les douze plus récentes :");
    l.push("");
    l.push("| Branche | Commits hors `main` | Dernier |");
    l.push("| --- | --- | --- |");
    for (const b of e.branches.slice(0, 12)) l.push("| `" + b.branche + "` | " + b.commits_hors_main + " | " + S.heureLocale(b.dernier) + " |");
    if (e.branches.length > 12) {
      l.push("");
      l.push("_… et " + (e.branches.length - 12) + " autres. Un tel arriéré est un constat en soi : soit ce travail vaut d'être fusionné, soit ces branches valent d'être fermées._");
    }
  }
  l.push("");
  return l.join("\n");
}

(function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--heures");
  const heures = i > -1 ? Number(args[i + 1]) : 24;
  const e = construire(heures);

  const cmd = args.find((a) => !a.startsWith("--") && a !== String(heures));
  if (cmd === "json") { console.log(JSON.stringify(e, null, 1)); return; }
  if (cmd === "attente") {
    if (!e.attente.length) { console.log("Rien n'attend de décision."); return; }
    for (const a of e.attente) console.log("- " + a.quoi + "\n  " + a.pourquoi + (a.comment ? "\n  " + a.comment : ""));
    return;
  }
  if (cmd === "flotte") {
    for (const f of e.flotte) console.log((f.etat === "actif" ? "   " : "!! ") + f.nom.padEnd(48) + f.etat + (f.age_h != null ? "  (" + f.age_h + " h)" : ""));
    return;
  }

  const sortie = path.join(__dirname, "ETAT.md");
  fs.writeFileSync(sortie, rendre(e));
  console.log("memoire/ETAT.md régénéré — " + e.attente.length + " en attente, " +
    e.flotte.filter((f) => f.etat === "silencieux").length + " agent(s) silencieux, " +
    e.evenements.length + " événements sur " + heures + " h, " + e.branches.length + " branche(s) hors main.");
})();
