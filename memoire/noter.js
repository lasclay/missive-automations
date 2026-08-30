#!/usr/bin/env node
/**
 * Lasclay — Noter dans la mémoire partagée ce qu'aucune trace ne porte.
 * ---------------------------------------------------------------------
 * Les publications, les commits et les journaux se lisent tout seuls. Ce qui
 * se perd, c'est le reste : une décision prise, un blocage, une question qui
 * attend Gabriel. C'est ce que ce script consigne.
 *
 * Usage :
 *   node memoire/noter.js decision "<agent>" "<ce qui a été décidé>" [--preuve "<lien ou fichier>"]
 *   node memoire/noter.js blocage  "<agent>" "<ce qui bloque>"       [--preuve "…"]
 *   node memoire/noter.js attente  "<agent>" "<ce qu'on attend de Gabriel>"
 *   node memoire/noter.js constat  "<agent>" "<ce qu'on a observé>"
 *   node memoire/noter.js resoudre <n>       # marque la n-ième entrée comme résolue
 *   node memoire/noter.js liste              # les entrées encore ouvertes
 *
 * Un blocage ou une attente reste dans « Ce qui attend une décision » de
 * memoire/ETAT.md tant qu'il n'est pas résolu. C'est voulu : une question
 * posée à Gabriel et jamais reprise est le défaut que cette mémoire corrige.
 */

const fs = require("fs");
const path = require("path");

const JOURNAL = path.join(__dirname, "journal.jsonl");
const TYPES = ["decision", "blocage", "attente", "constat"];

function lire() {
  if (!fs.existsSync(JOURNAL)) return [];
  return fs.readFileSync(JOURNAL, "utf8").split("\n").filter((l) => l.trim())
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function ecrire(entrees) {
  fs.writeFileSync(JOURNAL, entrees.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === "liste") {
  const ouvertes = lire().map((e, i) => ({ ...e, n: i + 1 })).filter((e) => !e.resolu);
  if (!ouvertes.length) { console.log("Aucune entrée ouverte."); process.exit(0); }
  for (const e of ouvertes) console.log(e.n + "  " + e.t.slice(0, 16) + "  " + e.type.padEnd(9) + e.agent.padEnd(22) + e.resume);
  process.exit(0);
}

if (cmd === "resoudre") {
  const n = Number(args[1]);
  const entrees = lire();
  if (!Number.isInteger(n) || n < 1 || n > entrees.length) {
    console.error("Numéro hors bornes. `node memoire/noter.js liste` donne les numéros.");
    process.exit(1);
  }
  entrees[n - 1].resolu = new Date().toISOString();
  ecrire(entrees);
  console.log("Résolu : " + entrees[n - 1].resume);
  process.exit(0);
}

if (!TYPES.includes(cmd) || !args[1] || !args[2]) {
  console.error("Usage : node memoire/noter.js <" + TYPES.join("|") + "> \"<agent>\" \"<résumé>\" [--preuve \"…\"]\n" +
    "        node memoire/noter.js liste | resoudre <n>");
  process.exit(1);
}

const iP = args.indexOf("--preuve");
const entree = {
  t: new Date().toISOString(),
  agent: args[1],
  type: cmd,
  resume: args[2],
  preuve: iP > -1 ? args[iP + 1] : null,
};
fs.appendFileSync(JOURNAL, JSON.stringify(entree) + "\n");
console.log("Noté : [" + cmd + "] " + args[1] + " — " + args[2]);
