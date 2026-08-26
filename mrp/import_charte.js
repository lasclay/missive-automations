/**
 * Charge la charte produits depuis donnees/charte-produits.tsv.
 *
 * La charte décrit la pièce ; elle ne dit pas quoi vérifier. Les vérifications
 * de la colonne jaune du tableau passent par `import_qualite.js --charte` et
 * deviennent de vrais points de contrôle, qui remontent dans la liste
 * obligatoire de chaque ordre. Les deux fichiers viennent du même PDF, ils
 * n'ont pas le même statut : l'un se lit, l'autre se coche.
 *
 * L'import est conçu pour être RELANCÉ : il efface les lignes dont la source
 * est « charte produits » et les réécrit. Ce que quelqu'un ajoute dans l'app
 * porte une autre source et n'est jamais touché.
 *
 *   node mrp/import_charte.js            aperçu, rien n'est écrit
 *   node mrp/import_charte.js --ecrire   applique
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { db, SECTIONS_CHARTE } = require('./db.js');

const ECRIRE = process.argv.includes('--ecrire');
const SOURCE = 'charte produits';
const FICHIER = process.argv.find(a => a.endsWith('.tsv'))
  || path.join(__dirname, 'donnees', 'charte-produits.tsv');

if (!fs.existsSync(FICHIER)) {
  console.error(`Fichier absent : ${FICHIER}`);
  process.exit(1);
}

const l = fs.readFileSync(FICHIER, 'utf8').trim().split('\n').filter(x => !x.startsWith('#'));
const cols = l[0].split('\t');
const rangs = l.slice(1).map(r => {
  const v = r.split('\t');
  return Object.fromEntries(cols.map((k, i) => [k, (v[i] ?? '').trim()]));
});

const produit = db.prepare(`SELECT id, code FROM produits WHERE code = ?`);
const efface = db.prepare(`DELETE FROM charte WHERE source = ?`);
const insere = db.prepare(
  `INSERT INTO charte (produit_id, section, texte, rang, source) VALUES (?,?,?,?,?)`);

if (ECRIRE) efface.run(SOURCE);

let ecrites = 0, ignorees = 0;
const inconnus = [], mauvaiseSection = [];
const parProduit = new Map(), parSection = {};

for (const r of rangs) {
  const p = r.produit ? produit.get(r.produit) : null;
  if (!p) { inconnus.push(r.produit || '(vide)'); ignorees++; continue; }
  if (!SECTIONS_CHARTE[r.section]) {
    mauvaiseSection.push(`${r.produit} : « ${r.section} »`); ignorees++; continue;
  }
  if (!r.texte) { ignorees++; continue; }
  const n = (parProduit.get(p.id) || 0) + 1;
  parProduit.set(p.id, n);
  parSection[r.section] = (parSection[r.section] || 0) + 1;
  if (ECRIRE) insere.run(p.id, r.section, r.texte, n, SOURCE);
  ecrites++;
}

console.log(`\n${ECRIRE ? 'Écrit' : 'Aperçu'} — charte produits\n`);
console.log(`  ${ecrites} lignes sur ${parProduit.size} produits`);
for (const [c, lib] of Object.entries(SECTIONS_CHARTE))
  if (parSection[c]) console.log(`    ${lib.padEnd(14)} ${String(parSection[c]).padStart(3)}`);
if (inconnus.length)
  console.log(`\n  ${inconnus.length} produit(s) inconnu(s) : ${[...new Set(inconnus)].join(', ')}`);
if (mauvaiseSection.length)
  console.log(`  section invalide : ${mauvaiseSection.join(', ')}`);
if (ignorees) console.log(`  ${ignorees} ligne(s) ignorée(s)`);

// Ce qui reste sans charte, trié par volume : un produit qu'on fabrique en
// milliers d'unités sans savoir de quoi il est fait mérite d'être nommé.
const nus = db.prepare(`
  SELECT p.code, COALESCE(SUM(i.quantite), 0) AS qte
    FROM produits p
    LEFT JOIN ordre_items i ON i.produit_id = p.id
   WHERE NOT EXISTS (SELECT 1 FROM charte c WHERE c.produit_id = p.id)
   GROUP BY p.id ORDER BY qte DESC, p.code`).all();
if (nus.length) {
  console.log(`\n  Sans charte (${nus.length}), le plus gros volume d'abord :`);
  for (const n of nus.slice(0, 10))
    console.log(`    ${n.code.padEnd(20)} ${n.qte ? n.qte + ' à produire' : ''}`);
  if (nus.length > 10) console.log(`    … et ${nus.length - 10} autres`);
}
if (!ECRIRE) console.log('\n  Relancer avec --ecrire pour appliquer.\n');
else console.log('');
