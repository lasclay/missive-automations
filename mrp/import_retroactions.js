/**
 * Importe dans le MRP les rétroactions clients distillées de Missive.
 *
 * La source est `donnees/retroactions.tsv`, produit par
 * `voix-client/outils/distiller.js` à partir de 2 282 fils de correspondance.
 *
 * CE QUI N'ENTRE PAS : le nom du client, son courriel, son numéro de commande,
 * le fil lui-même. L'atelier a besoin du défaut, pas de la personne. Seule la
 * référence opaque du fil reste, pour qui doit remonter à la source depuis le
 * dépôt privé.
 *
 * L'import n'efface QUE ce qu'il a lui-même écrit (`cree_par IS NULL` et une
 * `source_ref` commençant par « missive: »). Une rétroaction saisie à la main
 * dans l'app survit à un réimport — c'est la même règle que partout ailleurs.
 *
 *   node mrp/import_retroactions.js            aperçu
 *   node mrp/import_retroactions.js --ecrire   applique
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { db } = require('./db.js');

const ECRIRE = process.argv.includes('--ecrire');
const FICHIER = process.argv.find(a => a.endsWith('.tsv'))
  || path.join(__dirname, 'donnees', 'retroactions.tsv');

if (!fs.existsSync(FICHIER)) {
  console.error(`Fichier absent : ${FICHIER}`);
  console.error('Produis-le avec : node mrp/voix-client/outils/distiller.js');
  process.exit(1);
}

const brut = fs.readFileSync(FICHIER, 'utf8').trim().split('\n')
  .filter(x => x.trim() && !x.startsWith('#'));
const cols = brut[0].split('\t');
const rangs = brut.slice(1).map(r => {
  const v = r.split('\t');
  return Object.fromEntries(cols.map((k, i) => [k, (v[i] ?? '').trim()]));
});

const parCode = new Map(db.prepare(`SELECT id, code FROM produits`).all()
  .map(p => [p.code, p.id]));

const FAMILLES = new Set(['mitaines', 'manteaux', 'tuques']);

/**
 * Les photos gardées, et l'adresse à laquelle le MRP les sert.
 *
 * EXCEPTION ASSUMÉE À « L'APP N'HÉBERGE AUCUN FICHIER ». Cette règle existait
 * pour ne pas dupliquer le CDN de Shopify. Ici il n'y a pas de CDN : ce sont
 * des photos de correspondance client, et les poser sur une URL publique
 * (Drive, lh3) les rendrait lisibles par quiconque a le lien. Elles vivent
 * donc dans le dépôt privé et se servent derrière le mot de passe de l'app.
 *
 * 67 des 247 images reçues ont été écartées à l'œil — reçus, captures de
 * paiement, courriels, visages. Voir voix-client/photos-ecartees.tsv.
 */
const DOSSIER_PHOTOS = path.join(__dirname, 'photos-clients');
const dispo = fs.existsSync(DOSSIER_PHOTOS)
  ? new Set(fs.readdirSync(DOSSIER_PHOTOS).map(f => f.replace(/\.jpg$/, '')))
  : new Set();

const adressesPhotos = (ids) => String(ids || '').split(' ').filter(Boolean)
  .filter(id => dispo.has(id))
  .map(id => `/photo-client/${id}.jpg`)
  .join(' ');

const retenus = [];
const soucis = [];
for (const r of rangs) {
  if (!r.citation || !r.probleme) { soucis.push(['ligne vide', r.cible]); continue; }
  const estFamille = r.portee === 'famille';
  const produitId = estFamille ? null : parCode.get(r.cible);
  if (!estFamille && !produitId) { soucis.push(['produit inconnu', r.cible]); continue; }
  if (estFamille && !FAMILLES.has(r.cible)) { soucis.push(['famille inconnue', r.cible]); continue; }
  retenus.push({
    produit_id: produitId || null,
    famille: estFamille ? r.cible : '',
    probleme: r.probleme, titre: r.titre,
    categorie: r.famille || 'bris',
    citation: r.citation,
    photos: adressesPhotos(r.images),
    survenu_le: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null,
    source_ref: r.fil ? `missive:${r.fil}` : '',
  });
}

const avant = db.prepare(
  `SELECT COUNT(*) n FROM produit_retroactions WHERE cree_par IS NULL`).get().n;

console.log(`\n  ${rangs.length} lignes lues · ${retenus.length} retenues`);
if (soucis.length) {
  console.log(`\n  ${soucis.length} écartée(s) :`);
  const g = {};
  for (const [quoi, quoi2] of soucis) (g[quoi] = g[quoi] || []).push(quoi2);
  for (const [quoi, l] of Object.entries(g))
    console.log(`    ${String(l.length).padStart(4)} ${quoi} — ${[...new Set(l)].slice(0,6).join(', ')}`);
}

if (!ECRIRE) {
  const parP = {};
  for (const r of retenus) {
    const cle = r.produit_id ? [...parCode].find(([, id]) => id === r.produit_id)[0]
                             : `~${r.famille}`;
    parP[cle] = (parP[cle] || 0) + 1;
  }
  console.log(`\n  En base aujourd'hui : ${avant} (importées)`);
  console.log('\n  Ce qui serait écrit :');
  for (const [p, n] of Object.entries(parP).sort((a,b)=>b[1]-a[1]))
    console.log(`    ${String(n).padStart(4)}  ${p}`);
  console.log('\n  Relancer avec --ecrire pour appliquer.\n');
  process.exit(0);
}

db.exec('BEGIN');
try {
  db.prepare(`DELETE FROM produit_retroactions
               WHERE cree_par IS NULL AND source_ref LIKE 'missive:%'`).run();
  const ins = db.prepare(`INSERT OR IGNORE INTO produit_retroactions
    (produit_id, famille, probleme, titre, categorie, citation, photos,
     survenu_le, source_ref)
    VALUES (@produit_id, @famille, @probleme, @titre, @categorie, @citation,
            @photos, @survenu_le, @source_ref)`);
  for (const r of retenus) ins.run(r);
  db.exec('COMMIT');
} catch (e) { db.exec('ROLLBACK'); throw e; }

const apres = db.prepare(`SELECT COUNT(*) n FROM produit_retroactions`).get().n;
console.log(`\n  Écrit. ${apres} rétroactions en base.\n`);
