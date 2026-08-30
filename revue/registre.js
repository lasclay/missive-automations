#!/usr/bin/env node
/**
 * Lasclay — Registre des améliorations issues de la revue quotidienne.
 * --------------------------------------------------------------------
 * Une amélioration n'est jamais appliquée le jour où elle est proposée :
 * elle attend une approbation humaine. Ce script est la seule façon de
 * changer un état — ne modifie pas registre.json à la main, la vue
 * REGISTRE.md serait aussitôt fausse.
 *
 * États : proposee → approuvee → appliquee
 *                  ↘ refusee   ↘ reportee
 *
 * Usage :
 *   node revue/registre.js liste [etat]
 *   node revue/registre.js ajouter                 # JSON (objet ou tableau) sur stdin
 *   node revue/registre.js approuver R-20260829-01 R-20260829-03
 *   node revue/registre.js refuser  R-20260829-02 --note "pas notre problème"
 *   node revue/registre.js reporter R-20260829-04 --note "après la migration"
 *   node revue/registre.js appliquee R-20260829-01 --commit abc1234
 *   node revue/registre.js md                      # régénère REGISTRE.md
 *
 * Champs d'une amélioration ajoutée (les autres sont posés par le script) :
 *   titre, gravite (bloquant|majeur|mineur), constat, preuve, proposition,
 *   portee, risque, effort, source
 */

const fs = require("fs");
const path = require("path");

const FICHIER = path.join(__dirname, "registre.json");
const VUE = path.join(__dirname, "REGISTRE.md");
const FUSEAU = "America/Toronto";
const ETATS = ["proposee", "approuvee", "appliquee", "refusee", "reportee"];
const GRAVITES = ["bloquant", "majeur", "mineur"];

function jourLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function lire() {
  if (!fs.existsSync(FICHIER)) return { version: 1, ameliorations: [] };
  return JSON.parse(fs.readFileSync(FICHIER, "utf8"));
}

function ecrire(reg) {
  reg.ameliorations.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));   // le plus récent d'abord
  fs.writeFileSync(FICHIER, JSON.stringify(reg, null, 1) + "\n");
  ecrireVue(reg);
}

function prochainId(reg, jour) {
  const prefixe = "R-" + jour.replace(/-/g, "") + "-";
  const n = reg.ameliorations.filter((a) => a.id.startsWith(prefixe)).length;
  return prefixe + String(n + 1).padStart(2, "0");
}

function ecrireVue(reg) {
  const par = (e) => reg.ameliorations.filter((a) => a.etat === e);
  const l = [];
  l.push("# Registre des améliorations — revue quotidienne");
  l.push("");
  l.push("Vue générée par `node revue/registre.js md`. **Ne pas éditer à la main** :");
  l.push("la source est `revue/registre.json`, et tout changement d'état passe par le script.");
  l.push("");
  l.push("| État | Nombre |");
  l.push("| --- | --- |");
  for (const e of ETATS) l.push("| " + e + " | " + par(e).length + " |");
  l.push("");

  const bloc = (titre, items, colonnes) => {
    l.push("## " + titre + " (" + items.length + ")");
    l.push("");
    if (!items.length) { l.push("_rien._", ""); return; }
    for (const a of items) {
      l.push("### " + a.id + " — " + a.titre);
      l.push("");
      l.push("- **Gravité** : " + a.gravite + " · **Effort** : " + (a.effort || "?") + " · **Proposé le** : " + a.propose_le);
      if (a.source) l.push("- **Source** : " + a.source);
      l.push("- **Constat** : " + a.constat);
      if (a.preuve) l.push("- **Preuve** : " + a.preuve);
      l.push("- **Proposition** : " + a.proposition);
      if (a.portee) l.push("- **Portée** : " + a.portee);
      if (a.risque) l.push("- **Risque** : " + a.risque);
      if (a.decide_le) l.push("- **Décidé le** : " + a.decide_le);
      if (a.applique_le) l.push("- **Appliqué le** : " + a.applique_le + (a.commit ? " (`" + a.commit + "`)" : ""));
      if (a.note) l.push("- **Note** : " + a.note);
      l.push("");
    }
  };

  bloc("En attente d'approbation", par("proposee"));
  bloc("Approuvées, à appliquer au prochain tour", par("approuvee"));
  bloc("Reportées", par("reportee"));
  bloc("Appliquées", par("appliquee"));
  bloc("Refusées", par("refusee"));

  fs.writeFileSync(VUE, l.join("\n"));
}

async function stdin() {
  const bouts = [];
  for await (const b of process.stdin) bouts.push(b);
  return Buffer.concat(bouts).toString("utf8");
}

function changerEtat(reg, ids, etat, note, commit) {
  const jour = jourLocal();
  const touches = [];
  for (const id of ids) {
    const a = reg.ameliorations.find((x) => x.id === id);
    if (!a) { console.error("Inconnu : " + id); process.exitCode = 1; continue; }
    a.etat = etat;
    if (etat === "appliquee") { a.applique_le = jour; if (commit) a.commit = commit; }
    else a.decide_le = jour;
    if (note) a.note = note;
    touches.push(a);
  }
  return touches;
}

(async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || "liste";
  const reg = lire();

  const iNote = args.indexOf("--note");
  const note = iNote > -1 ? args[iNote + 1] : null;
  const iCommit = args.indexOf("--commit");
  const commit = iCommit > -1 ? args[iCommit + 1] : null;
  const ids = args.slice(1).filter((a) => /^R-\d{8}-\d{2}$/.test(a));

  if (cmd === "liste") {
    const filtre = args[1] && ETATS.includes(args[1]) ? args[1] : null;
    const items = filtre ? reg.ameliorations.filter((a) => a.etat === filtre) : reg.ameliorations;
    if (!items.length) { console.log(filtre ? "Aucune amélioration à l'état " + filtre + "." : "Registre vide."); return; }
    for (const a of items) console.log([a.id, a.etat.padEnd(10), (a.gravite || "?").padEnd(8), a.titre].join("  "));
    return;
  }

  if (cmd === "json") { console.log(JSON.stringify(reg, null, 1)); return; }

  if (cmd === "ajouter") {
    const brut = JSON.parse(await stdin());
    const liste = Array.isArray(brut) ? brut : [brut];
    const jour = jourLocal();
    const ajoutes = [];
    for (const item of liste) {
      for (const champ of ["titre", "constat", "proposition"]) {
        if (!item[champ]) throw new Error("Champ obligatoire manquant : " + champ + " — " + JSON.stringify(item).slice(0, 160));
      }
      if (item.gravite && !GRAVITES.includes(item.gravite)) throw new Error("Gravité inconnue : " + item.gravite + " (attendu : " + GRAVITES.join(", ") + ")");
      const a = {
        id: prochainId(reg, jour),
        titre: item.titre,
        gravite: item.gravite || "mineur",
        etat: "proposee",
        propose_le: jour,
        source: item.source || null,
        constat: item.constat,
        preuve: item.preuve || null,
        proposition: item.proposition,
        portee: item.portee || null,
        risque: item.risque || null,
        effort: item.effort || null,
      };
      reg.ameliorations.push(a);
      ajoutes.push(a);
    }
    ecrire(reg);
    console.log(ajoutes.map((a) => a.id + "  " + a.gravite + "  " + a.titre).join("\n"));
    return;
  }

  const table = { approuver: "approuvee", refuser: "refusee", reporter: "reportee", appliquee: "appliquee", proposer: "proposee" };
  if (table[cmd]) {
    if (!ids.length) throw new Error("Aucun identifiant R-AAAAMMJJ-NN donné.");
    const touches = changerEtat(reg, ids, table[cmd], note, commit);
    ecrire(reg);
    console.log(touches.map((a) => a.id + " → " + a.etat).join("\n") || "(rien)");
    return;
  }

  if (cmd === "md") { ecrireVue(reg); console.log("REGISTRE.md régénéré (" + reg.ameliorations.length + " items)."); return; }

  console.error("Commande inconnue : " + cmd + "\nliste | json | ajouter | approuver | refuser | reporter | appliquee | md");
  process.exit(1);
})().catch((e) => { console.error("registre.js : " + (e.message || e)); process.exit(1); });
