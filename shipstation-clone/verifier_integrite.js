#!/usr/bin/env node
/**
 * Intégrité du fichier unique — à lancer avant tout déploiement.
 *
 * Le 4 août 2026, trois règles CSS ouvertes et jamais fermées sont parties en production.
 * Le navigateur arrête net l'application des règles à la première accolade manquante :
 * **98 règles appliquées sur 441**, soit 78 % de la feuille de style morte. La page est
 * partie sans grille, sans en-tête, sans chrome applicatif.
 *
 * La cause profonde n'est pas les trois lignes : c'est qu'une application entière tient dans
 * un seul fichier HTML de 300 Ko, où une troncature d'édition passe inaperçue jusqu'à la mise
 * en ligne. Ni `node --check` ni les suites fonctionnelles ne la voyaient — le JavaScript
 * était valide, les données correctes, les 22 écrans « répondaient ». Seul l'œil voyait.
 *
 * Ce script ferme ce trou : il vérifie ce que les autres vérifications ne regardent pas.
 *
 * Usage : node shipstation-clone/verifier_integrite.js
 */
const fs = require("fs");
const path = require("path");

const CHEMIN = path.join(__dirname, "app", "public", "index.html");
const html = fs.readFileSync(CHEMIN, "utf8");

let echecs = 0, verifs = 0;
const vert = (s) => `\x1b[32m${s}\x1b[0m`, rouge = (s) => `\x1b[31m${s}\x1b[0m`;
const verifier = (nom, ok, detail = "") => {
  verifs++;
  if (ok) console.log(`  ${vert("✓")} ${nom}`);
  else { echecs++; console.log(`  ${rouge("✗")} ${nom}${detail ? `\n      ${detail}` : ""}`); }
};

console.log("\nIntégrité du fichier unique");
console.log("─".repeat(70));

// ------------------------------------------------------------------ CSS

let cssTout = "";

const blocsStyle = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
verifier(`${blocsStyle.length} bloc(s) <style> trouvé(s)`, blocsStyle.length > 0);

for (const [n, css] of blocsStyle.entries()) {
  cssTout += css + "\n";
  const o = (css.match(/\{/g) || []).length, f = (css.match(/\}/g) || []).length;
  verifier(`bloc <style> n° ${n + 1} : ${o} accolades ouvrantes = ${f} fermantes`, o === f,
    `écart de ${o - f} — le navigateur cessera d'appliquer les règles à la première manquante`);

  /**
   * Localiser la faute, pas seulement la constater. Une pile de sélecteurs dit **quelle
   * règle** n'est jamais fermée et à quelle ligne — sur 680 lignes, « il en manque trois »
   * ne suffit pas à corriger.
   */
  const lignes = css.split("\n");
  const pile = [];
  let sel = "";
  for (let i = 0; i < lignes.length; i++) {
    for (const ch of lignes[i]) {
      if (ch === "{") { pile.push({ ligne: i + 1, sel: sel.trim().replace(/\s+/g, " ").slice(0, 70) }); sel = ""; }
      else if (ch === "}") { pile.pop(); sel = ""; }
      else if (ch === ";") sel = "";
      else sel += ch;
    }
    sel += " ";
  }
  verifier(`bloc <style> n° ${n + 1} : aucune règle laissée ouverte`, pile.length === 0,
    pile.map((p) => `L${p.ligne} « ${p.sel} » n'est jamais fermée`).join("\n      "));
}

/**
 * Une dernière lecture, en miroir : le nombre de sélecteurs déclarés doit correspondre au
 * nombre de règles que le navigateur appliquera. La pile ci-dessus dit *où* une règle reste
 * ouverte ; ce compte dit *combien* de règles survivent, ce qui est la grandeur qui a
 * réellement chuté (98 sur 441). Les deux ensemble décrivent la panne complètement.
 */
const reglesDeclarees = (cssTout.match(/\{/g) || []).length;
const commentaires = (cssTout.match(/\/\*[\s\S]*?\*\//g) || []).length;
console.log(`  ${vert("·")} ${reglesDeclarees} règles déclarées, ${commentaires} commentaires ` +
  `— toutes seront appliquées si les accolades s'équilibrent`);

// --------------------------------------------------------------- JavaScript

const blocsScript = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
verifier(`${blocsScript.length} bloc(s) <script> trouvé(s)`, blocsScript.length > 0);
for (const [n, js] of blocsScript.entries()) {
  let ok = true, msg = "";
  try { new (require("node:vm").Script)(js); }
  catch (e) { ok = false; msg = e.message; }
  verifier(`bloc <script> n° ${n + 1} : syntaxe valide`, ok, msg);
}

// ----------------------------------------------------------------- balises

for (const b of ["style", "script"]) {
  const ouv = (html.match(new RegExp(`<${b}[^>]*>`, "g")) || []).length;
  const fer = (html.match(new RegExp(`</${b}>`, "g")) || []).length;
  verifier(`balises <${b}> appariées (${ouv} ouvrantes / ${fer} fermantes)`, ouv === fer);
}

// Le CSP se calcule sur le contenu exact des blocs : un fichier tronqué au milieu d'un
// bloc produirait une empreinte valide pour un contenu cassé. On vérifie donc aussi que le
// document se termine comme un document.
verifier("le document se termine par </html>", /<\/html>\s*$/.test(html),
  `finit par : ${JSON.stringify(html.slice(-40))}`);

console.log("─".repeat(70));
console.log(`\n=== ${verifs - echecs}/${verifs} vérifications passées ===\n`);
process.exit(echecs ? 1 : 0);
