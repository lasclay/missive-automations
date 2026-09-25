/**
 * Charge les schémas et détails d'atelier depuis donnees/schemas-produits.tsv.
 *
 * POURQUOI ILS NE POINTENT PAS MIRO. L'API Miro rend une adresse SIGNÉE qui
 * expire en quelques heures : la stocker donnerait un cadre vide le lendemain.
 * Les images sont donc rapatriées une fois et redéposées sur le Drive, que
 * `urlImage()` convertit en lh3.googleusercontent.com et fait redimensionner.
 * L'app continue de n'héberger aucun fichier.
 *
 * POURQUOI PAS UN WIDGET MIRO. Un `live-embed` charge plusieurs mégaoctets de
 * canevas dans une page qui en fait cinq kilo-octets, et rendrait l'atelier à
 * la navigation d'un tableau de 633 objets. Ici, la bonne vignette est à côté
 * du bon point de contrôle, pour quelques kilo-octets.
 *
 * L'import est conçu pour être RELANCÉ : il efface les photos dont la source
 * est « miro » et les réécrit. Une image ajoutée à la main dans l'app porte une
 * source vide et n'est jamais touchée.
 *
 *   node mrp/import_schemas.js            aperçu, rien n'est écrit
 *   node mrp/import_schemas.js --ecrire   applique
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { db } = require('./db.js');

const ECRIRE = process.argv.includes('--ecrire');
const SOURCE = 'miro';
const FICHIER = process.argv.find(a => a.endsWith('.tsv'))
  || path.join(__dirname, 'donnees', 'schemas-produits.tsv');

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
const efface  = db.prepare(`DELETE FROM produit_photos WHERE source = ?`);
const insere  = db.prepare(
  `INSERT INTO produit_photos (produit_id, url, type, legende, rang, source)
   VALUES (?,?,'schema',?,?,?)`);

if (ECRIRE) efface.run(SOURCE);

let ecrites = 0, ignorees = 0;
const inconnus = [], mauvaiseUrl = [];
const parProduit = new Map();
const images = new Set();

for (const r of rangs) {
  const p = r.produit ? produit.get(r.produit) : null;
  if (!p) { inconnus.push(r.produit || '(vide)'); ignorees++; continue; }
  // Une `data:` URI ferait porter le fichier à la base ET à chaque page servie.
  // Une adresse RACINE (« /schema/… ») n'a ni l'un ni l'autre défaut : elle est
  // courte en base et le fichier se sert une fois, mis en cache. Elle est donc
  // admise — c'est par elle que passe l'image du bandeau de tuque, la photo
  // Miro fléchée que le MRP a fabriquée et sert lui-même.
  if (!/^https?:\/\//.test(r.url)
      && !/^\/[\w/-]+\.(png|jpe?g|webp|svg)$/.test(r.url)) {
    mauvaiseUrl.push(`${r.produit} : ${r.url || '(vide)'}`); ignorees++; continue;
  }
  const rang = Number(r.rang) || (parProduit.get(p.id) || 0) + 1;
  parProduit.set(p.id, Math.max(parProduit.get(p.id) || 0, rang));
  images.add(r.url);
  if (ECRIRE) insere.run(p.id, r.url, r.legende || '', rang, SOURCE);
  ecrites++;
}

console.log(`\n${ECRIRE ? 'Écrit' : 'Aperçu'} — schémas et détails d'atelier\n`);
console.log(`  ${ecrites} rattachement(s) sur ${parProduit.size} produits`);
console.log(`  ${images.size} image(s) distincte(s) — plusieurs produits partagent la même`);
if (inconnus.length)
  console.log(`\n  ${inconnus.length} produit(s) inconnu(s) : ${[...new Set(inconnus)].join(', ')}`);
if (mauvaiseUrl.length)
  console.log(`  adresse refusée : ${mauvaiseUrl.join(', ')}`);
if (ignorees) console.log(`  ${ignorees} ligne(s) ignorée(s)`);

// Ce qui n'a AUCUN schéma, le plus gros volume d'abord. Un produit fabriqué en
// milliers d'unités dont l'atelier n'a aucun dessin est le plus cher à rater.
const nus = db.prepare(`
  SELECT p.code, COALESCE(SUM(i.quantite), 0) AS qte
    FROM produits p
    LEFT JOIN ordre_items i ON i.produit_id = p.id
   WHERE NOT EXISTS (SELECT 1 FROM produit_photos f
                      WHERE f.produit_id = p.id AND f.type = 'schema')
   GROUP BY p.id ORDER BY qte DESC, p.code`).all();
if (nus.length) {
  console.log(`\n  Sans schéma (${nus.length}), le plus gros volume d'abord :`);
  for (const n of nus.slice(0, 10))
    console.log(`    ${n.code.padEnd(22)} ${n.qte ? n.qte + ' à produire' : ''}`);
  if (nus.length > 10) console.log(`    … et ${nus.length - 10} autres`);
}
if (!ECRIRE) console.log('\n  Relancer avec --ecrire pour appliquer.\n');
else console.log('');
