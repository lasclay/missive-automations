/**
 * Amorce les protocoles de contrôle qualité depuis donnees/qualite-amorce.tsv.
 *
 * Le fichier n'est pas une source : c'est une relecture à la main des notes
 * techniques, où ces consignes dormaient mêlées aux coûts. L'import est donc
 * conçu pour être RELANCÉ après correction du fichier — il remplace les points
 * dont la source est « notes techniques » et ne touche jamais à ce que
 * quelqu'un a écrit dans l'app.
 *
 *   node mrp/import_qualite.js               aperçu, rien n'est écrit
 *   node mrp/import_qualite.js --ecrire      applique
 *   node mrp/import_qualite.js --squelettes  charge aussi les squelettes de
 *                                            cyclage et de fit (produit « * »
 *                                            = protocole général)
 *   node mrp/import_qualite.js --charte      charge aussi les vérifications de
 *                                            la charte produits — la colonne
 *                                            jaune du tableau de production
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { db, TYPES_QC } = require('./db.js');

const ECRIRE = process.argv.includes('--ecrire');
const SQUELETTES = process.argv.includes('--squelettes');
const CHARTE = process.argv.includes('--charte');
const SOURCE = 'notes techniques';
const SOURCE_SQ = 'squelette — à compléter';
// La charte porte sa source dans le fichier, ligne par ligne : c'est elle
// qu'on efface avant de réécrire, sans toucher au reste.
const SOURCE_CH = 'charte produits';

function tsv(nom) {
  const l = fs.readFileSync(path.join(__dirname, 'donnees', nom), 'utf8')
    .trim().split('\n').filter(x => !x.startsWith('#'));
  const cols = l[0].split('\t');
  return l.slice(1).map(r => {
    const v = r.split('\t');
    return Object.fromEntries(cols.map((k, i) => [k, (v[i] ?? '').trim()]));
  });
}

const rangs = tsv('qualite-amorce.tsv')
  .concat(SQUELETTES ? tsv('qualite-squelettes.tsv') : [])
  .concat(CHARTE ? tsv('qualite-charte.tsv') : []);

let ajoutes = 0, ignores = 0;
const inconnus = [], mauvaisVolet = [];

const produit = db.prepare(`SELECT id, code FROM produits WHERE code = ?`);
const efface = db.prepare(`DELETE FROM qc_points WHERE source = ?`);
const insere = db.prepare(`INSERT INTO qc_points
  (produit_id, type, titre, detail, consequence, valeur, tolerance, unite,
   ech_type, ech_valeur, frequence, source, rang, schema_url)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

if (ECRIRE) {
  efface.run(SOURCE);
  if (SQUELETTES) efface.run(SOURCE_SQ);
  if (CHARTE) efface.run(SOURCE_CH);
}

/**
 * Deux fichiers peuvent dire la même chose du même produit.
 *
 * « Presser la pochette avant d'insérer l'isolant » venait à la fois de ma
 * relecture des notes techniques et de la charte de l'équipe — même consigne,
 * un « y » de différence. Sur la liste à cocher de l'atelier, ça fait deux
 * cases pour un seul geste, et la seconde ne se coche jamais.
 *
 * On compare des titres NORMALISÉS : sans accents, sans ponctuation, sans les
 * petits mots qui varient d'une plume à l'autre.
 */
function empreinte(titre) {
  return String(titre).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(y|d|de|des|du|la|le|les|l|a|au|aux|un|une)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}
const vus = new Map();
const doublons = [];

const parProduit = new Map();
// Le décompte par volet ne compte QUE les points retenus : un doublon écarté
// ne doit pas gonfler le tableau récapitulatif.
const par = {};
for (const r of rangs) {
  // « * » = protocole général : le point n'appartient à aucun produit et
  // s'applique à tous. C'est le cas des essais de cyclage et de port, qui sont
  // les mêmes gestes quelle que soit la pièce.
  const general = r.produit === '*';
  const p = general ? { id: null, code: '(général)' } : produit.get(r.produit);
  if (!p) { inconnus.push(r.produit); ignores++; continue; }
  if (!TYPES_QC[r.volet]) { mauvaisVolet.push(`${r.produit} : « ${r.volet} »`); ignores++; continue; }
  if (!r.titre) { ignores++; continue; }
  // Le premier fichier lu l'emporte : l'ordre de `rangs` est l'ordre d'autorité.
  const cleDoublon = `${general ? '*' : p.id}|${empreinte(r.titre)}`;
  if (vus.has(cleDoublon)) {
    doublons.push(`${r.produit} : « ${r.titre} » (déjà posé par « ${vus.get(cleDoublon)} »)`);
    ignores++; continue;
  }
  vus.set(cleDoublon, r.source || SOURCE);
  const cle = general ? '*' : p.id;
  const n = (parProduit.get(cle) || 0) + 1;
  parProduit.set(cle, n);
  const ech = ['', 'tout', 'ratio', 'fixe', 'lot'].includes(r.ech_type) ? r.ech_type : '';
  const ev = Number(r.ech_valeur);
  if (ECRIRE)
    insere.run(p.id, r.volet, r.titre, r.detail, r.consequence,
      r.valeur, r.tolerance, r.unite, ech,
      Number.isInteger(ev) && ev > 0 ? ev : null,
      r.frequence, r.source || SOURCE, n, r.schema || '');
  par[r.volet] = (par[r.volet] || 0) + 1;
  ajoutes++;
}

console.log(`\n${ECRIRE ? 'Écrit' : 'Aperçu'} — protocoles de contrôle qualité\n`);
const gen = parProduit.get('*') || 0;
console.log(`  ${ajoutes} points sur ${parProduit.size - (gen ? 1 : 0)} produits`
  + (gen ? `, plus ${gen} au protocole général` : ''));
if (!SQUELETTES)
  console.log('  (--squelettes ajoute le cyclage de couture et les essais portés)');
if (!CHARTE)
  console.log('  (--charte ajoute les vérifications de la charte produits)');
for (const [v, n] of Object.entries(par))
  console.log(`    ${(TYPES_QC[v] || v).padEnd(24)} ${String(n).padStart(3)}`);
if (inconnus.length)
  console.log(`\n  ${inconnus.length} produit(s) inconnu(s) : ${[...new Set(inconnus)].join(', ')}`);
if (mauvaisVolet.length)
  console.log(`  volet invalide : ${mauvaisVolet.join(', ')}`);
if (doublons.length) {
  console.log(`\n  ${doublons.length} doublon(s) écarté(s) — deux fichiers disent`
    + ' la même chose du même produit :');
  for (const d of doublons) console.log(`    ${d}`);
}
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
