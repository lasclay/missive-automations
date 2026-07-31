/**
 * set_tax.js — applique une option de taxe en masse dans mappings.tsv.
 *
 *   node a2x/tools/set_tax.js 5:Sales --all          # toutes les règles
 *   node a2x/tools/set_tax.js 5:Sales --empty        # seulement celles sans taxe
 *   node a2x/tools/set_tax.js "" --category "Sales Tax"
 *   node a2x/tools/set_tax.js 5:Sales --all --dry-run
 *
 * Écrit le fichier puis régénère mappings.json. Réversible : relancer avec une
 * autre valeur, ou restaurer le fichier depuis git.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const TSV = path.join(__dirname, "..", "mappings.tsv");
const args = process.argv.slice(2);
const value = args[0] === undefined ? null : args[0];
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i === -1 ? null : args[i + 1]; };

if (value === null || (!flag("all") && !flag("empty") && !opt("category"))) {
  console.log(`Usage : node a2x/tools/set_tax.js <valeur|""> (--all | --empty | --category "Sales") [--dry-run]`);
  process.exit(1);
}

const lines = fs.readFileSync(TSV, "utf8").split("\n");
const cat = opt("category");
let touched = 0;

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (!l.trim() || l.startsWith("#")) continue;
  const c = l.split("\t");
  if (c.length < 4) continue;
  if (cat && c[0] !== cat) continue;
  while (c.length < 6) c.push("");
  const current = (c[5] || "").trim();
  if (flag("empty") && current) continue;
  if (current === value) continue;
  c[5] = value;
  lines[i] = c.join("\t").replace(/\t+$/, "");
  touched++;
}

console.log(`${touched} ligne(s) ${flag("dry-run") ? "seraient modifiées" : "modifiées"} → taxe « ${value || "(aucune)"} ».`);
if (flag("dry-run") || !touched) process.exit(0);

fs.writeFileSync(TSV, lines.join("\n"));
execFileSync(process.execPath, [path.join(__dirname, "import_mappings.js")], { stdio: "inherit" });
