/**
 * tests/ajustements.js — les ajustements d'ordres que le plan ne porte pas.
 *
 *   1. Retirer un produit d'un ordre DÉPLACE ce qui a été écrit dessus vers
 *      l'item du même produit dans l'autre ordre : le t-shirt resté dans le
 *      plan de la saison avait peut-être déjà un fil ou un avancement.
 *   2. Le sous-lot est créé en attente, avec la répartition de son modèle
 *      ramenée à sa quantité ; en attente, il ne compte nulle part.
 *   3. Chaque ligne ne s'applique qu'une fois : un sous-lot retiré dans l'app
 *      ne renaît pas au démarrage suivant.
 *   4. L'avis de modification mène au message avec photo sous le point.
 *
 *   node tests/ajustements.js
 */
'use strict';
const path = require('node:path'), os = require('node:os'), fs = require('node:fs');
process.env.MRP_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mrp-aj-')), 't.db');
const { execFileSync } = require('node:child_process');
const lancer = (s) => execFileSync(process.execPath, ['--no-warnings', path.join(__dirname, '..', s), '--ecrire'],
  { env: process.env, encoding: 'utf8' });

let ok = 0, ko = 0;
const t = (nom, cond, detail = '') => {
  if (cond) { ok++; console.log(`  [OK ] ${nom}`); }
  else { ko++; console.log(`  [KO ] ${nom}${detail ? ' — ' + detail : ''}`); }
};
console.log('\n  Ajustements d\'ordres\n');

lancer('import.js');
const D = require('../db.js'); const { db } = D;
const O1 = db.prepare(`SELECT id FROM ordres WHERE titre LIKE 'Plan de production 26-27%'`).get().id;
const O2 = db.prepare(`SELECT id FROM ordres WHERE titre LIKE 'T-shirts brodés%'`).get().id;
const pid = (c) => db.prepare(`SELECT id FROM produits WHERE code = ?`).get(c).id;
const TS = pid('TSHIRT-BRODE'), ML = pid('MIT-LAINE');

// L'état de la production : le t-shirt resté dans l'ordre de la saison, avec
// un fil et un avancement déclarés sur ce mauvais item.
const u = db.prepare(`INSERT INTO utilisateurs (courriel, mdp_hash, nom, role) VALUES ('a@x','x','A','atelier')`).run().lastInsertRowid;
const vieux = db.prepare(`INSERT INTO ordre_items (ordre_id, produit_id, quantite, avancement) VALUES (?,?,500,20)`)
  .run(O1, TS).lastInsertRowid;
db.prepare(`INSERT INTO item_fil (item_id, utilisateur_id, type, texte) VALUES (?,?, 'question', 'Quel fil ?')`).run(vieux, u);
const ts2 = db.prepare(`SELECT id FROM ordre_items WHERE ordre_id = ? AND produit_id = ?`).get(O2, TS).id;

lancer('import_ajustements.js');
t('le t-shirt sort de l\'ordre de la saison',
  !db.prepare(`SELECT 1 FROM ordre_items WHERE ordre_id = ? AND produit_id = ?`).get(O1, TS));
t('son fil suit l\'item du t-shirt dans son propre ordre',
  db.prepare(`SELECT COUNT(*) n FROM item_fil WHERE item_id = ?`).get(ts2).n === 1);
t('et son avancement aussi, l\'autre n\'ayant rien',
  db.prepare(`SELECT avancement FROM ordre_items WHERE id = ?`).get(ts2).avancement === 20);

const sl = db.prepare(`SELECT * FROM ordre_items WHERE ordre_id = ? AND produit_id = ?`).get(O2, ML);
t('le sous-lot de 200 mitaines de laine est dans l\'ordre des t-shirts, en attente',
  sl && sl.quantite === 200 && /En attente/.test(sl.attente));
const modele = db.prepare(`SELECT nom, quantite FROM item_variantes WHERE item_id =
  (SELECT id FROM ordre_items WHERE ordre_id = ? AND produit_id = ?) ORDER BY rang`).all(O1, ML);
const rep = db.prepare(`SELECT nom, quantite FROM item_variantes WHERE item_id = ? ORDER BY rang`).all(sl.id);
t('même répartition par taille que le lot d\'origine, ramenée à 200',
  rep.length === modele.length && rep.reduce((n, v) => n + v.quantite, 0) === 200
  && rep.every((v, i) => v.nom === modele[i].nom), JSON.stringify(rep));

const avO2 = D.avancementOrdre(O2);
t('en attente, il ne compte ni dans l\'ordre…', avO2.unites === 500, JSON.stringify(avO2));
t('… ni dans « À fabriquer »', !D.listeFabrication({ inclureTermines: true }).some(l => l.id === sl.id));
t('… ni dans le contrôle qualité', !D.qcOrdre(O2).some(l => l.id === sl.id));

// Une fois appliqué, jamais rejoué : Québec retire le sous-lot, il ne revient pas.
db.prepare(`DELETE FROM ordre_items WHERE id = ?`).run(sl.id);
lancer('import_ajustements.js');
t('un sous-lot retiré dans l\'app ne renaît pas au démarrage',
  !db.prepare(`SELECT 1 FROM ordre_items WHERE ordre_id = ? AND produit_id = ?`).get(O2, ML));

// L'avis, et son lien vers la photo source.
lancer('import_qualite.js');
const av = D.avisActifs().get(ML);
t('l\'avis de modification est posé sur la mitaine de laine', av && av.length === 1 && /ouverture/.test(av[0].titre));
const pt = db.prepare(`SELECT id FROM qc_points WHERE titre = ? AND produit_id = ?`).get(av[0].point_titre, ML);
t('son point source existe au protocole', !!pt && av[0].point_id === pt.id);
const m1 = D.ecrireDiscussion({ pointId: pt.id, produitId: ML, type: 'note', texte: 'sans photo', userId: u }).id;
const m2 = D.ecrireDiscussion({ pointId: pt.id, produitId: ML, type: 'image', texte: 'Ouverture trop petite',
  photoFichier: '1-abcdefabcdef.jpg', photoType: 'image/jpeg', userId: u }).id;
D.ecrireDiscussion({ pointId: pt.id, produitId: ML, type: 'note', texte: 'plus récent, sans photo', userId: u });
t('le lien mène au message AVEC photo, même s\'il y en a de plus récents', D.avisActifs().get(ML)[0].message_id === m2);
const V = require('../vues.js');
const h = V.avisHTML(D.avisActifs().get(ML));
t('le bandeau pointe la planche de l\'essai, ancré au message',
  h.includes(`/qualite/planche/essai_mitaine?point=${pt.id}&amp;produit=${ML}#m${m2}`), h.slice(0, 300));

console.log(`\n  ${ok} ok, ${ko} ko\n`);
process.exit(ko ? 1 : 0);
