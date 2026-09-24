/**
 * tests/schemas.js — les schémas d'atelier rapatriés du tableau Miro.
 *
 * Ce qui est épinglé ici, et pourquoi :
 *
 *   1. Un schéma n'est JAMAIS la vignette d'une carte. C'est un dessin coté,
 *      pas une photo de produit : le mettre dans une liste ferait croire que
 *      le cache-cou ressemble à trois rectangles.
 *   2. L'import n'efface que SES lignes. Une image ajoutée à la main dans
 *      l'app porte une source vide et survit à une relance — c'est la règle
 *      de tous les imports du dépôt, et elle se casse en silence.
 *   3. Une adresse non http est refusée. Une `data:` URI ferait porter le
 *      fichier à la base ET à chaque page servie : exactement ce que
 *      l'architecture refuse sur la ligne tunisienne.
 *   4. Une image partagée entre produits reste UNE image. Les quatre mitaines
 *      montrent la même étiquette ; la dupliquer ferait diverger les légendes.
 *
 *   node tests/schemas.js
 */
'use strict';
process.env.MRP_DB = process.env.MRP_DB
  || require('node:path').join(require('node:os').tmpdir(), `mrp-sch-${process.pid}.db`);

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { db } = require('../db.js');

let ok = 0, ko = 0;
const t = (nom, cond, detail = '') => {
  if (cond) { ok++; console.log(`  [OK ] ${nom}`); }
  else { ko++; console.log(`  [KO ] ${nom}${detail ? ' — ' + detail : ''}`); }
};

const racine = path.join(__dirname, '..');
const run = (script, ...args) => execFileSync(process.execPath,
  [path.join(racine, script), ...args],
  { env: { ...process.env, MRP_DB: process.env.MRP_DB }, encoding: 'utf8' });

console.log('\n  Schémas d\'atelier\n');

run('import.js', '--ecrire');
run('import_schemas.js', '--ecrire');

const produit = (code) => db.prepare(`SELECT id FROM produits WHERE code = ?`).get(code);
const schemas = (code) => db.prepare(
  `SELECT f.* FROM produit_photos f JOIN produits p ON p.id = f.produit_id
    WHERE p.code = ? AND f.type = 'schema' ORDER BY f.rang`).all(code);

// 1. Les schémas sont bien là, et cotés.
const cc = schemas('CACHE-COU');
t('le cache-cou porte son schéma de cotes', cc.length === 1);
t('la légende donne les trois tailles',
  /22,1/.test(cc[0]?.legende || '') && /29,9/.test(cc[0]?.legende || ''));
t('l\'adresse est un CDN redimensionnable, pas Miro',
  /lh3\.googleusercontent\.com/.test(cc[0]?.url || ''));

// 2. Un schéma n'est jamais la vignette d'une carte.
{
  const p = produit('BANDEAU-TUQUE');
  const avant = db.prepare(
    `SELECT COUNT(*) n FROM produit_photos WHERE produit_id = ? AND type <> 'schema'`
  ).get(p.id).n;
  const vignette = db.prepare(`
    SELECT (SELECT f.url FROM produit_photos f WHERE f.produit_id = p.id
             AND f.type <> 'schema'
             ORDER BY CASE f.type WHEN 'studio' THEN 0 ELSE 1 END,
                      f.rang, f.id LIMIT 1) AS photo
      FROM produits p WHERE p.id = ?`).get(p.id).photo;
  t('un produit qui n\'a QUE des schémas n\'a pas de vignette',
    avant > 0 || vignette === null,
    `${avant} photo(s) hors schéma, vignette=${vignette}`);
  t('le bandeau de tuque a bien un schéma', schemas('BANDEAU-TUQUE').length === 1);
}

// 3. L'import n'efface que ses lignes.
{
  const p = produit('COUSSIN');
  db.prepare(`INSERT INTO produit_photos (produit_id, url, type, legende, rang, source)
              VALUES (?,?,'schema',?,99,'')`)
    .run(p.id, 'https://exemple.test/a-la-main.png', 'Ajouté dans l\'app');
  run('import_schemas.js', '--ecrire');
  const reste = db.prepare(
    `SELECT COUNT(*) n FROM produit_photos WHERE url = ?`
  ).get('https://exemple.test/a-la-main.png').n;
  t('une image ajoutée à la main survit à une relance de l\'import', reste === 1);
  const duMiro = db.prepare(
    `SELECT COUNT(*) n FROM produit_photos WHERE source = 'miro'`).get().n;
  t('relancer l\'import ne duplique pas ses propres lignes', duMiro === 13,
    `${duMiro} lignes de source miro`);
}

// 4. Une adresse non http est refusée — et l'import continue.
{
  const fs = require('node:fs');
  const os = require('node:os');
  const f = path.join(os.tmpdir(), `sch-${process.pid}.tsv`);
  fs.writeFileSync(f,
    'produit\turl\tlegende\trang\tmiro_item\n' +
    'CACHE-COU\tdata:image/png;base64,AAAA\tune data URI\t1\tx\n' +
    'CACHE-COU\thttps://lh3.googleusercontent.com/d/ZZZ\tune vraie adresse\t2\ty\n');
  const sortie = run('import_schemas.js', '--ecrire', f);
  t('une data: URI est refusée', /adresse refusée/.test(sortie));
  t('la ligne valide de la même feuille passe quand même',
    schemas('CACHE-COU').length === 1
    && /ZZZ/.test(schemas('CACHE-COU')[0].url));
  fs.unlinkSync(f);
}

// 5. Une image partagée reste une image.
{
  run('import_schemas.js', '--ecrire');
  const urls = db.prepare(
    `SELECT url, COUNT(*) n FROM produit_photos WHERE source = 'miro'
      GROUP BY url ORDER BY n DESC`).all();
  const etiquette = urls.find(u => u.n === 4);
  t('les quatre mitaines partagent la même image d\'étiquette',
    Boolean(etiquette), urls.map(u => `${u.n}×`).join(' '));
  t('sept images distinctes pour treize rattachements',
    urls.length === 7 && urls.reduce((s, u) => s + u.n, 0) === 13,
    `${urls.length} images, ${urls.reduce((s, u) => s + u.n, 0)} rattachements`);
}

console.log(`\n  ${ok} vérifications, ${ko} échec(s).`);
process.exit(ko ? 1 : 0);
