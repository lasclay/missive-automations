/**
 * Importe dans le MRP les bris relevés dans Missive.
 *
 * Le TSV vient de `node bris_missive.js trier`, RELU À LA MAIN : le pré-filtre
 * est large exprès, et un faux positif dans un protocole coûte plus cher qu'un
 * signalement manquant. Seules les lignes marquées « o » entrent.
 *
 * Ce qui n'entre PAS : le nom du client, son courriel, son numéro de commande.
 * L'atelier a besoin du problème, pas de la personne. Le lien vers le fil
 * Missive reste dans le TSV pour qui doit remonter à la source.
 *
 *   node mrp/import_bris.js [chemin.tsv]            aperçu
 *   node mrp/import_bris.js [chemin.tsv] --ecrire   applique
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { db } = require('./db.js');

const ECRIRE = process.argv.includes('--ecrire');
const FICHIER = process.argv.find(a => a.endsWith('.tsv'))
  || path.join(__dirname, 'donnees', 'bris-missive.tsv');
const SOURCE_ORIGINE = 'client';

if (!fs.existsSync(FICHIER)) {
  console.error(`Fichier absent : ${FICHIER}`);
  console.error('Produis-le avec : node bris_missive.js trier > ' + FICHIER);
  process.exit(1);
}

const l = fs.readFileSync(FICHIER, 'utf8').trim().split('\n').filter(x => !x.startsWith('#'));
const cols = l[0].split('\t');
const rangs = l.slice(1).map(r => {
  const v = r.split('\t');
  return Object.fromEntries(cols.map((k, i) => [k, (v[i] ?? '').trim()]));
});

const produit = db.prepare(`SELECT id, code FROM produits WHERE code = ?`);
// L'idempotence tient au fil Missive : réimporter le même TSV ne duplique rien,
// et corriger une ligne puis relancer met à jour au lieu d'empiler.
const existe = db.prepare(`SELECT id FROM qc_bris WHERE source_ref = ?`);
const insere = db.prepare(`INSERT INTO qc_bris (produit_id, zone, origine, texte,
  photo_url, survenu_le, source_ref, cree_par) VALUES (?,?,?,?,?,?,?,NULL)`);
// La mise à jour reprend aussi les photos : elles arrivent après la relecture,
// dans un second passage, sur des lignes déjà importées.
const maj = db.prepare(`UPDATE qc_bris SET produit_id = ?, zone = ?, texte = ?,
  survenu_le = ?, photo_url = ? WHERE id = ?`);

let ajoutes = 0, majs = 0, sautes = 0, sansProduit = [], sansZone = 0, avecPhoto = 0;
const parProduit = {};

for (const r of rangs) {
  if (r.garder !== 'o') { sautes++; continue; }
  const p = r.produit ? produit.get(r.produit) : null;
  if (!p) { sansProduit.push(r.produit || '(vide)'); continue; }
  if (!r.zone) sansZone++;
  parProduit[p.code] = (parProduit[p.code] || 0) + 1;
  const ref = `missive:${r.conv}`;
  const deja = existe.get(ref);
  // Plusieurs clichés du même bris tiennent dans la colonne, séparés par une
  // espace : de loin, de près, la doublure retournée. L'app n'héberge rien —
  // ce sont des adresses, et le CDN les sert redimensionnées.
  const photos = (r.photos || '').trim();
  if (photos) avecPhoto++;
  if (ECRIRE) {
    if (deja) { maj.run(p.id, r.zone || '', r.citation || '', r.date || null,
                        photos, deja.id); majs++; }
    else { insere.run(p.id, r.zone || '', SOURCE_ORIGINE, r.citation || '', photos,
                      r.date || null, ref); ajoutes++; }
  } else { deja ? majs++ : ajoutes++; }
}

console.log(`\n${ECRIRE ? 'Écrit' : 'Aperçu'} — bris signalés par les clients\n`);
console.log(`  ${ajoutes} nouveaux, ${majs} mis à jour, ${sautes} non retenus`);
if (sansProduit.length)
  console.log(`  ${sansProduit.length} sans produit reconnu : `
    + [...new Set(sansProduit)].join(', '));
console.log(`  ${avecPhoto} avec au moins une photo`);
if (sansZone) console.log(`  ${sansZone} sans zone — c'est la colonne la plus utile, `
  + 'elle montre qu\'une même couture lâche sur plusieurs produits');
console.log('');
for (const [c, n] of Object.entries(parProduit).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(4)}  ${c}`);
if (!ECRIRE) console.log('\n  Relancer avec --ecrire pour appliquer.\n');
else console.log('');
