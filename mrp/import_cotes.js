#!/usr/bin/env node
/**
 * import_cotes.js — les cotes théoriques finies des produits gradés.
 *
 * Lit deux fichiers de donnees/ :
 *   cotes-patrons.tsv   les cotes des patrons, sur la ligne de couture
 *   cotes-produits.tsv  quel produit suit quelle famille, et son épaisseur à plat
 *
 * et en tire la cote FINIE, celle qu'on mesure sur la pièce posée à plat :
 *
 *   finie = couture − bords × (π/2 − 1) × épaisseur / 2
 *
 * POURQUOI CETTE FORMULE. Une pièce rembourrée posée à plat a deux faces
 * cousues bord à bord. Au bord, chaque face s'arrondit sur un quart de cercle
 * de rayon épaisseur/2 : elle y consomme π/4 × épaisseur de tissu, et n'avance
 * à plat que de épaisseur/2. Chaque bord replié coûte donc (π/2 − 1) ×
 * épaisseur/2 à la cote vue de dessus. Une largeur traverse deux bords, une
 * longueur fermée d'un seul bout (le bout des doigts) n'en traverse qu'un.
 *
 * La valeur de couture, elle, est déjà retirée : les cotes de patron sont
 * prises sur la ligne de couture, pas sur la ligne de coupe.
 *
 * Rechargée à chaque démarrage. La table ne porte que du calculé : aucune
 * saisie ne s'y perd, et les relevés de l'atelier vivent dans une autre table,
 * clés par produit, numéro et taille.
 *
 *   node import_cotes.js            aperçu
 *   node import_cotes.js --ecrire   écrit
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { db } = require('./db.js');

const ECRIRE = process.argv.includes('--ecrire');
const DOSSIER = path.join(__dirname, 'donnees');
const ORDRE_TAILLES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

function tsv(nom) {
  const l = fs.readFileSync(path.join(DOSSIER, nom), 'utf8').trim().split('\n')
    .filter(x => !x.startsWith('#'));
  const cols = l[0].split('\t');
  return l.slice(1).map(r => {
    const v = r.split('\t');
    return Object.fromEntries(cols.map((k, i) => [k, (v[i] ?? '').trim()]));
  });
}

const PERTE = Math.PI / 2 - 1;

/** La cote finie d'une ligne de patron pour une épaisseur donnée. */
function coteFinie(couture, bords, epaisseur) {
  if (couture === null || !Number.isFinite(couture)) return null;
  return Math.round((couture - bords * PERTE * epaisseur / 2) * 10) / 10;
}

function importer() {
  const patrons = tsv('cotes-patrons.tsv').map(r => ({
    ...r, num: Number(r.num), bords: Number(r.bords) || 0,
    couture: r.couture_mm === '' ? null : Number(r.couture_mm),
  }));
  const produits = tsv('cotes-produits.tsv');

  const idProduit = db.prepare(`SELECT id FROM produits WHERE code = ?`);
  const ins = db.prepare(`INSERT INTO cotes_theoriques
    (produit_id, num, nom, taille, rang_taille, couture_mm, valeur_mm, tolerance,
     titre_point, ep_statut, ep_detail) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);

  let n = 0; const inconnus = [];
  if (ECRIRE) db.exec('BEGIN');
  try {
    if (ECRIRE) db.exec('DELETE FROM cotes_theoriques');
    for (const p of produits) {
      const pr = idProduit.get(p.produit);
      if (!pr) { inconnus.push(p.produit); continue; }
      const ep = { corps: Number(p.ep_corps) || 0, pouce: Number(p.ep_pouce) || 0,
                   manchette: Number(p.ep_manchette) || 0, aucune: 0 };
      const detail = `corps ${ep.corps} mm, pouce ${ep.pouce} mm, manchette ${ep.manchette} mm`;
      for (const c of patrons.filter(x => x.famille === p.famille)) {
        const rang = ORDRE_TAILLES.indexOf(c.taille);
        if (ECRIRE)
          ins.run(pr.id, c.num, c.nom, c.taille, rang < 0 ? 99 : rang, c.couture,
            coteFinie(c.couture, c.bords, ep[c.zone] ?? 0), c.tolerance,
            p.titre_point, p.statut, detail);
        n++;
      }
    }
    if (ECRIRE) db.exec('COMMIT');
  } catch (e) { if (ECRIRE) db.exec('ROLLBACK'); throw e; }

  console.log(`${ECRIRE ? 'Écrit' : 'Aperçu'} — ${n} cotes théoriques`
    + (inconnus.length ? ` (produits inconnus : ${inconnus.join(', ')})` : ''));
}

if (require.main === module) importer();

module.exports = { coteFinie, PERTE };
