/**
 * tests/qualite.js — le contrôle qualité par ordre de production.
 *
 * Ce qui est épinglé, et pourquoi :
 *
 *   1. L'ordre des trois refus. Checklist incomplète, puis compte rendu trop
 *      court, puis média inhébergeable. L'ordre compte : dire « il manque 40
 *      mots » à quelqu'un qui n'a encore rien contrôlé l'envoie écrire au lieu
 *      d'aller regarder les pièces.
 *   2. Le seuil de 50 mots, compté sur des mots, pas des caractères. « ok ok ok
 *      ok… » cinquante fois passerait — c'est assumé : le seuil force à
 *      raconter, il ne prétend pas juger.
 *   3. Les catégories ne sont pas exclusives. Un manteau de 1 200 unités est à
 *      la fois un grand volume et un produit gradué : il doit apparaître dans
 *      les deux onglets, sans quoi cocher l'un le ferait disparaître de
 *      l'autre et le contrôle serait sauté.
 *   4. Signer fait disparaître le lot de PARTOUT. C'est la demande explicite,
 *      et c'est le seul comportement qui rend les onglets non exclusifs sûrs.
 *   5. Le compte rendu remplace le précédent au lieu de s'empiler : un lot a un
 *      compte rendu, pas un historique de brouillons.
 *
 *   node tests/qualite.js
 */
'use strict';
process.env.MRP_DB = process.env.MRP_DB
  || require('node:path').join(require('node:os').tmpdir(), `mrp-qc-${process.pid}.db`);

const { db, deposerRapport, rapportItem, qcOrdre, compterMots,
        CATEGORIES_QC, MOTS_RAPPORT, SEUIL_VOLUME } = require('../db.js');
const auth = require('../auth.js');

let ok = 0, ko = 0;
const t = (nom, cond, detail = '') => {
  if (cond) { ok++; console.log(`  [OK ] ${nom}`); }
  else { ko++; console.log(`  [KO ] ${nom}${detail ? ' — ' + detail : ''}`); }
};
const mots = n => Array.from({ length: n }, (_, i) => `mot${i}`).join(' ');

console.log('\n  Contrôle qualité\n');

/* =============================================== le décor minimal ======== */

const u = auth.creerUtilisateur({ courriel: `qc${process.pid}@l.com`,
  mdp: 'test1234', nom: 'Test', role: 'admin' }).lastInsertRowid;

// Deux produits : un gros volume gradué (les deux catégories à la fois) et un
// petit lot d'un produit neuf.
const pGrad = db.prepare(
  `INSERT INTO produits (code, nom, famille) VALUES (?,?,?)`)
  .run(`T-GRAD-${process.pid}`, 'Manteau gradué', 'manteau').lastInsertRowid;
const pNeuf = db.prepare(
  `INSERT INTO produits (code, nom, famille) VALUES (?,?,?)`)
  .run(`T-NEUF-${process.pid}`, 'Produit neuf', 'nouveau').lastInsertRowid;

// Deux tailles sur le produit gradué : c'est ce qui le rend « gradué ».
for (const taille of ['S', 'M'])
  db.prepare(`INSERT INTO charte (produit_id, section, texte)
              VALUES (?,'taille',?)`).run(pGrad, taille);

const ordre = db.prepare(
  `INSERT INTO ordres (numero, titre, statut) VALUES (?,?, 'planifie')`)
  .run(`T${process.pid}`, 'Ordre de test').lastInsertRowid;

// 1 200 unités : au-dessus du seuil de grand volume.
const iGrad = db.prepare(
  `INSERT INTO ordre_items (ordre_id, produit_id, quantite) VALUES (?,?,?)`)
  .run(ordre, pGrad, SEUIL_VOLUME + 200).lastInsertRowid;
const iNeuf = db.prepare(
  `INSERT INTO ordre_items (ordre_id, produit_id, quantite) VALUES (?,?,?)`)
  .run(ordre, pNeuf, 10).lastInsertRowid;

// Un point de contrôle sur chaque produit, pour avoir une checklist à remplir.
const ptGrad = db.prepare(
  `INSERT INTO qc_points (produit_id, titre) VALUES (?,?)`)
  .run(pGrad, 'Symétrie gauche-droite').lastInsertRowid;
const ptNeuf = db.prepare(
  `INSERT INTO qc_points (produit_id, titre) VALUES (?,?)`)
  .run(pNeuf, 'Coutures fermées').lastInsertRowid;

const cocher = (itemId, pointId) => db.prepare(
  `INSERT INTO qc_controles (item_id, point_id, verdict, utilisateur_id)
   VALUES (?,?,'conforme',?)`).run(itemId, pointId, u);

const ligne = (id, cat) => {
  const l = qcOrdre(ordre).find(x => x.id === id);
  return l && (!cat || l.categories.includes(cat)) ? l : null;
};

/* ================================== 1-2. l'ordre des trois refus ========= */

// Rien n'est coché : c'est la checklist qu'on doit réclamer, pas les mots.
{
  const r = deposerRapport({ itemId: iGrad, texte: 'trop court', utilisateurId: u });
  t('checklist incomplète : refusée avant même de compter les mots',
    r.erreur && /pas encore vérifié/.test(r.erreur), r.erreur);
}

cocher(iGrad, ptGrad);
cocher(iNeuf, ptNeuf);

{
  const r = deposerRapport({ itemId: iGrad, texte: mots(MOTS_RAPPORT - 1),
    utilisateurId: u });
  t(`${MOTS_RAPPORT - 1} mots : refusé, il en faut ${MOTS_RAPPORT}`,
    r.erreur && r.erreur.includes(String(MOTS_RAPPORT)), r.erreur);
}
{
  const r = deposerRapport({ itemId: iGrad, texte: mots(MOTS_RAPPORT),
    medias: 'file:///photo.jpg', utilisateurId: u });
  t('média non http : refusé — l\'app n\'héberge aucun fichier',
    r.erreur && /adresse refus/i.test(r.erreur), r.erreur);
}

t('compterMots compte des mots, pas des espaces',
  compterMots('  deux   mots  ') === 2, String(compterMots('  deux   mots  ')));
t('compterMots ne compte rien dans le vide', compterMots('') === 0);

/* ================================== 3. les catégories se chevauchent ===== */

{
  const l = ligne(iGrad);
  t('1 200 unités graduées : grand volume ET gradué, dans les deux onglets',
    l && l.categories.includes('volume') && l.categories.includes('gradation'),
    l && l.categories.join(','));
  // « tous » n'est pas rangé dans categories : la vue le traite comme le cas
  // par défaut (`c === 'tous' || …`). L'épingler ici évite qu'on « corrige »
  // un jour l'un sans l'autre et qu'un onglet se vide.
  t('« tous » est le cas par défaut de la vue, pas une catégorie stockée',
    !l.categories.includes('tous') && CATEGORIES_QC.tous);
  t('un manteau gradué n\'est pas « nouveau » pour autant',
    l && !l.categories.includes('nouveau'), l && l.categories.join(','));
}
{
  const l = ligne(iNeuf);
  t('un produit jamais produit tombe dans « nouveau »',
    l && l.categories.includes('nouveau'), l && l.categories.join(','));
  t('10 unités ne font pas un grand volume',
    l && !l.categories.includes('volume'), l && l.categories.join(','));
}
t('les quatre onglets existent, « tous » compris',
  Object.keys(CATEGORIES_QC).join(',') === 'tous,volume,nouveau,gradation',
  Object.keys(CATEGORIES_QC).join(','));

/* ================================== 4. signer fait disparaître partout === */

{
  const r = deposerRapport({ itemId: iGrad, texte: mots(MOTS_RAPPORT + 5),
    medias: 'https://lh3.googleusercontent.com/d/abc=w1200', utilisateurId: u });
  t('checklist faite + 55 mots + média hébergé : le contrôle est signé',
    !r.erreur && r.mots === MOTS_RAPPORT + 5 && r.medias === 1,
    r.erreur || `${r.mots} mots, ${r.medias} média`);

  const l = ligne(iGrad);
  t('le lot signé est marqué signé', l && l.signe === true);
  const dans = (l, c) => c === 'tous' || l.categories.includes(c);   // = vues.js
  for (const cat of Object.keys(CATEGORIES_QC))
    t(`signé : disparaît de l'onglet « ${CATEGORIES_QC[cat].titre} »`,
      qcOrdre(ordre).filter(x => !x.signe && dans(x, cat))
        .every(x => x.id !== iGrad));

  t('le lot non signé, lui, reste à contrôler',
    qcOrdre(ordre).some(x => x.id === iNeuf && !x.signe));
}

/* ================================== 5. un lot, un compte rendu =========== */

{
  deposerRapport({ itemId: iGrad, texte: mots(MOTS_RAPPORT + 20), utilisateurId: u });
  const n = db.prepare(`SELECT count(*) n FROM qc_rapports WHERE item_id = ?`)
    .get(iGrad).n;
  t('réécrire le compte rendu le remplace, sans empiler de brouillons',
    n === 1, `${n} rangées`);
  t('c\'est bien le dernier texte qui est gardé',
    compterMots(rapportItem(iGrad).texte) === MOTS_RAPPORT + 20);
}

console.log(`\n  ${ok} ok, ${ko} ko\n`);
process.exit(ko ? 1 : 0);
