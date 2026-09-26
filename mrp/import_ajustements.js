#!/usr/bin/env node
/**
 * import_ajustements.js — les ajustements d'ordres que le plan ne porte pas.
 *
 * Lit donnees/ajustements-ordres.tsv (voir son en-tête) et applique chaque
 * ligne UNE fois : rejouer le fichier au démarrage suivant ne change rien.
 *
 * Pourquoi un fichier et pas un clic : ces décisions doivent atteindre la
 * base de production, qui n'est joignable que par l'app — et une retouche
 * faite à la main sur un ordre importé serait défaite par le prochain import
 * si le plan disait le contraire.
 *
 *   node import_ajustements.js            aperçu
 *   node import_ajustements.js --ecrire   applique
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { db } = require('./db.js');

const ECRIRE = process.argv.includes('--ecrire');
const FICHIER = path.join(__dirname, 'donnees', 'ajustements-ordres.tsv');

function lire() {
  if (!fs.existsSync(FICHIER)) return [];
  const l = fs.readFileSync(FICHIER, 'utf8').trim().split('\n').filter(x => x && !x.startsWith('#'));
  const cols = l[0].split('\t');
  return l.slice(1).map(r => {
    const v = r.split('\t');
    return Object.fromEntries(cols.map((k, i) => [k, (v[i] ?? '').trim()]));
  });
}

const produit = db.prepare(`SELECT id FROM produits WHERE code = ?`);
const ordre = db.prepare(`SELECT id, numero FROM ordres WHERE titre = ?`);
const itemDe = db.prepare(`SELECT * FROM ordre_items WHERE ordre_id = ? AND produit_id = ?`);

/** Les tables qui pointent un item, et comment on les déplace. */
const DEPLACABLES = ['item_fil', 'avancement_historique', 'qc_controles', 'cotes_releves', 'qc_discussion'];

function retirer(r, journal) {
  const p = produit.get(r.produit), o = ordre.get(r.ordre);
  if (!p || !o) return journal.push(`retirer ${r.produit} : produit ou ordre introuvable`);
  const it = itemDe.get(o.id, p.id);
  if (!it) return;                                   // déjà fait
  // Le même produit, ailleurs, dans un ordre vivant : c'est là qu'il vit.
  const dest = db.prepare(`SELECT i.* FROM ordre_items i JOIN ordres o ON o.id = i.ordre_id
     WHERE i.produit_id = ? AND i.id <> ? AND o.statut IN ('planifie','en_cours')
       AND i.attente = '' ORDER BY i.id LIMIT 1`).get(p.id, it.id);
  if (!dest) {
    const trace = db.prepare(`SELECT
        (SELECT COUNT(*) FROM item_fil WHERE item_id = ?) +
        (SELECT COUNT(*) FROM qc_controles WHERE item_id = ?) AS n`).get(it.id, it.id).n;
    if (it.avancement > 0 || trace > 0)
      return journal.push(`retirer ${r.produit} de ${o.numero} : déjà commencé et nulle part où le déplacer — laissé`);
  } else if (ECRIRE) {
    for (const t of DEPLACABLES)
      db.prepare(`UPDATE ${t} SET item_id = ? WHERE item_id = ?`).run(dest.id, it.id);
    // Le compte rendu qualité est unique par item : on ne l'écrase pas.
    if (!db.prepare(`SELECT 1 FROM qc_rapports WHERE item_id = ?`).get(dest.id))
      db.prepare(`UPDATE qc_rapports SET item_id = ? WHERE item_id = ?`).run(dest.id, it.id);
    // Un avancement déclaré sur le mauvais ordre n'est pas perdu : si l'item
    // qui reste n'a rien, il le reprend.
    if (dest.avancement === 0 && it.avancement > 0)
      db.prepare(`UPDATE ordre_items SET avancement = ? WHERE id = ?`).run(it.avancement, dest.id);
  }
  if (ECRIRE) db.prepare(`DELETE FROM ordre_items WHERE id = ?`).run(it.id);
  journal.push(`${r.produit} retiré de ${o.numero}${dest ? ' (son historique suit l\'autre item)' : ''}`);
}

function sousLot(r, journal) {
  const p = produit.get(r.produit), o = ordre.get(r.ordre);
  const q = Math.round(Number(r.quantite));
  if (!p || !o || !(q > 0)) return journal.push(`sous-lot ${r.produit} : produit, ordre ou quantité invalide`);
  if (itemDe.get(o.id, p.id)) return;                // déjà là — et peut-être déjà levé
  let id = null;
  if (ECRIRE) id = db.prepare(`INSERT INTO ordre_items (ordre_id, produit_id, quantite, note, rang, attente)
      VALUES (?,?,?,?, (SELECT COALESCE(MAX(rang),0)+1 FROM ordre_items WHERE ordre_id=?), ?)`)
    .run(o.id, p.id, q, `Sous-lot${r.date ? ` décidé le ${r.date.split('-').reverse().join('/')}` : ''}`,
         o.id, r.attente).lastInsertRowid;
  // La répartition du modèle, ramenée à la quantité (plus grand reste).
  const m = r.modele ? ordre.get(r.modele) : null;
  const mi = m ? itemDe.get(m.id, p.id) : null;
  const vs = mi ? db.prepare(`SELECT groupe, nom, quantite FROM item_variantes WHERE item_id = ?
      ORDER BY rang, id`).all(mi.id) : [];
  const tot = vs.reduce((n, v) => n + v.quantite, 0);
  if (tot && ECRIRE) {
    const parts = vs.map(v => ({ ...v, x: v.quantite * q / tot }));
    parts.forEach(v => { v.q = Math.floor(v.x); });
    let reste = q - parts.reduce((n, v) => n + v.q, 0);
    [...parts].sort((a, b) => (b.x - b.q) - (a.x - a.q)).forEach(v => { if (reste > 0) { v.q++; reste--; } });
    parts.forEach((v, i) => db.prepare(`INSERT INTO item_variantes (item_id, groupe, nom, quantite, rang)
      VALUES (?,?,?,?,?)`).run(id, v.groupe, v.nom, v.q, i + 1));
  }
  journal.push(`sous-lot ${r.produit} × ${q} dans ${o.numero}${r.attente ? ', en attente' : ''}`);
}

function avis(r, journal) {
  const p = produit.get(r.produit);
  if (!p || !r.titre) return journal.push(`avis ${r.produit} : produit ou titre manquant`);
  if (db.prepare(`SELECT 1 FROM avis_modification WHERE produit_id = ? AND titre = ?`).get(p.id, r.titre)) return;
  if (ECRIRE) db.prepare(`INSERT INTO avis_modification (produit_id, titre, texte, point_titre, decide_le)
      VALUES (?,?,?,?,?)`).run(p.id, r.titre, r.texte, r.point, r.date);
  journal.push(`avis « ${r.titre} » sur ${r.produit}`);
}

// Chaque ligne ne s'applique qu'UNE fois, marquée dans amorce_etat. Sans ce
// marqueur, un sous-lot retiré dans l'app — ou un item retiré puis rajouté à
// dessein — renaîtrait au démarrage suivant : le fichier contredirait l'app.
const fait = db.prepare(`SELECT 1 FROM amorce_etat WHERE cle = ?`);
const marque = db.prepare(`INSERT OR REPLACE INTO amorce_etat (cle, valeur, maj_le)
  VALUES (?, 'fait', datetime('now'))`);
const cleDe = (r) => 'ajustement:' + [r.action, r.ordre, r.produit, r.titre, r.date].join('|');

function importer() {
  const journal = [];
  if (ECRIRE) db.exec('BEGIN');
  try {
    for (const r of lire()) {
      const cle = cleDe(r);
      if (fait.get(cle)) continue;
      const avant = journal.length;
      if (r.action === 'retirer') retirer(r, journal);
      else if (r.action === 'sous-lot') sousLot(r, journal);
      else if (r.action === 'avis') avis(r, journal);
      else { journal.push(`action inconnue : ${r.action}`); continue; }
      // Une ligne qui n'a pas pu s'appliquer (ordre absent…) se retente au
      // prochain démarrage ; celle qui a agi, ou n'avait rien à faire, non.
      const echec = journal.slice(avant).some(x => /introuvable|invalide|manquant|laissé/.test(x));
      if (ECRIRE && !echec) marque.run(cle);
    }
    if (ECRIRE) db.exec('COMMIT');
  } catch (e) { if (ECRIRE) db.exec('ROLLBACK'); throw e; }
  console.log(`${ECRIRE ? 'Écrit' : 'Aperçu'} — ${journal.length ? journal.join(' ; ') : 'rien de neuf'}`);
}

if (require.main === module) importer();
module.exports = { importer };
