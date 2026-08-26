/**
 * Amorce les protocoles de contrôle qualité depuis donnees/qualite-amorce.tsv.
 *
 * Le fichier n'est pas une source : c'est une relecture à la main des notes
 * techniques, où ces consignes dormaient mêlées aux coûts. L'import est donc
 * conçu pour être RELANCÉ après correction du fichier — il remplace les points
 * dont la source est « notes techniques » et ne touche jamais à ce que
 * quelqu'un a écrit dans l'app.
 *
 *   node mrp/import_qualite.js            aperçu, rien n'est écrit
 *   node mrp/import_qualite.js --ecrire   applique
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { db, TYPES_QC } = require('./db.js');

const ECRIRE = process.argv.includes('--ecrire');
const SOURCE = 'notes techniques';
const FICHIER = path.join(__dirname, 'donnees', 'qualite-amorce.tsv');

const lignes = fs.readFileSync(FICHIER, 'utf8').trim().split('\n')
  .filter(l => !l.startsWith('#'));
const cols = lignes[0].split('\t');
const rangs = lignes.slice(1).map(r => {
  const v = r.split('\t');
  return Object.fromEntries(cols.map((k, i) => [k, (v[i] ?? '').trim()]));
});

let ajoutes = 0, ignores = 0;
const inconnus = [], mauvaisVolet = [];

const produit = db.prepare(`SELECT id, code FROM produits WHERE code = ?`);
const efface = db.prepare(`DELETE FROM qc_points WHERE source = ?`);
const insere = db.prepare(`INSERT INTO qc_points
  (produit_id, type, titre, detail, consequence, valeur, tolerance, unite,
   frequence, source, rang)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`);

if (ECRIRE) efface.run(SOURCE);

const parProduit = new Map();
for (const r of rangs) {
  const p = produit.get(r.produit);
  if (!p) { inconnus.push(r.produit); ignores++; continue; }
  if (!TYPES_QC[r.volet]) { mauvaisVolet.push(`${r.produit} : « ${r.volet} »`); ignores++; continue; }
  if (!r.titre) { ignores++; continue; }
  const n = (parProduit.get(p.id) || 0) + 1;
  parProduit.set(p.id, n);
  if (ECRIRE)
    insere.run(p.id, r.volet, r.titre, r.detail, r.consequence,
      r.valeur, r.tolerance, r.unite, r.frequence, r.source || SOURCE, n);
  ajoutes++;
}

const par = {};
for (const r of rangs) par[r.volet] = (par[r.volet] || 0) + 1;

console.log(`\n${ECRIRE ? 'Écrit' : 'Aperçu'} — protocoles de contrôle qualité\n`);
console.log(`  ${ajoutes} points sur ${parProduit.size} produits`);
for (const [v, n] of Object.entries(par))
  console.log(`    ${(TYPES_QC[v] || v).padEnd(24)} ${String(n).padStart(3)}`);
if (inconnus.length)
  console.log(`\n  ${inconnus.length} produit(s) inconnu(s) : ${[...new Set(inconnus)].join(', ')}`);
if (mauvaisVolet.length)
  console.log(`  volet invalide : ${mauvaisVolet.join(', ')}`);
if (ignores) console.log(`  ${ignores} ligne(s) ignorée(s)`);

// Ce qui reste sans rien, trié par volume : c'est la vraie sortie du script.
const nus = db.prepare(`
  SELECT p.code, (SELECT SUM(i.quantite) FROM ordre_items i
                    JOIN ordres o ON o.id = i.ordre_id
                   WHERE i.produit_id = p.id AND o.statut IN ('planifie','en_cours')) AS q
    FROM produits p
   WHERE p.actif = 1 AND p.fabrication = 'tunisie'
     AND NOT EXISTS (SELECT 1 FROM qc_points x WHERE x.produit_id = p.id)
   ORDER BY COALESCE(q, 0) DESC`).all();
if (nus.length) {
  console.log(`\n  Sans aucun protocole (${nus.length}), le plus gros volume d'abord :`);
  for (const n of nus.slice(0, 10))
    console.log(`    ${n.code.padEnd(22)}${n.q ? n.q.toLocaleString('fr-CA') + ' à produire' : ''}`);
  if (nus.length > 10) console.log(`    … et ${nus.length - 10} autres`);
}
if (!ECRIRE) console.log('\n  Relancer avec --ecrire pour appliquer.\n');
else console.log('');
