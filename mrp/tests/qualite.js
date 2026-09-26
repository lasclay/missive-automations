/**
 * tests/qualite.js — le contrôle qualité par ordre de production.
 *
 * Ce qui est épinglé, et pourquoi :
 *
 *   1. L'ordre des trois refus. Checklist incomplète, puis compte rendu trop
 *      court, puis média inhébergeable. L'ordre compte : dire « il manque 40
 *      mots » à quelqu'un qui n'a encore rien contrôlé l'envoie écrire au lieu
 *      d'aller regarder les pièces.
 *   2. Le seuil de MOTS_RAPPORT mots (10), compté sur des mots, pas des caractères. « ok ok ok
 *      ok… » dix fois passerait — c'est assumé : le seuil force à
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

/* ============================ 6. le volet « esthétique et quotidien » ==== */

{
  const { TYPES_QC } = require('../db.js');
  t('le volet « esthétique et quotidien » existe',
    TYPES_QC.esthetique === 'Esthétique et quotidien');
  // La contrainte vit dans un CHECK : sans reconstruction de table, l'insertion
  // échoue et le protocole général reste muet sur tout ce qui est esthétique.
  const p = db.prepare(`INSERT INTO produits (code, nom) VALUES (?, ?)`)
    .run(`T-EST-${process.pid}`, 'Produit esthétique').lastInsertRowid;
  let passe = true;
  try {
    db.prepare(`INSERT INTO qc_points (produit_id, type, titre)
                VALUES (?, 'esthetique', ?)`).run(p, 'Fils qui dépassent');
  } catch { passe = false; }
  t('un point « esthetique » s\'écrit en base', passe);
}

/* ================== 7. l'import se réclame ses propres lignes ============ */

{
  // La règle par `source` ne peut atteindre que les sources ENCORE écrites
  // dans le TSV. Renommer une source laissait les anciennes lignes orphelines
  // pour toujours : trois points du protocole général ont survécu comme ça à
  // deux imports, en doublon, sans que rien ne le signale.
  const p = db.prepare(`INSERT INTO produits (code, nom) VALUES (?, ?)`)
    .run(`T-IMP-${process.pid}`, 'Produit import').lastInsertRowid;
  const pose = (src) => db.prepare(
    `INSERT INTO qc_points (produit_id, type, titre, source, import_src)
     VALUES (?, 'critique', 'Un point', ?, 'essai.tsv')`).run(p, src);

  pose('ancienne source');
  pose('nouvelle source');
  // Ce que fait l'import : il efface tout ce que SON fichier a écrit.
  db.prepare(`DELETE FROM qc_points WHERE import_src = ? AND cree_par IS NULL`)
    .run('essai.tsv');
  t('effacer par fichier emporte aussi les sources qui ne sont plus utilisées',
    db.prepare(`SELECT COUNT(*) n FROM qc_points WHERE produit_id = ?`).get(p).n === 0);

  // Le garde-fou historique tient toujours : ce qu'une personne a écrit reste.
  const u = db.prepare(`INSERT INTO utilisateurs (courriel, mdp_hash, nom, role)
    VALUES (?,?,?,'admin')`).run(`i${process.pid}@l.com`, 'x', 'T').lastInsertRowid;
  db.prepare(`INSERT INTO qc_points (produit_id, type, titre, source, import_src, cree_par)
              VALUES (?, 'critique', 'Écrit à la main', '', 'essai.tsv', ?)`).run(p, u);
  db.prepare(`DELETE FROM qc_points WHERE import_src = ? AND cree_par IS NULL`)
    .run('essai.tsv');
  t('… mais jamais ce qu\'une personne a écrit dans l\'app',
    db.prepare(`SELECT COUNT(*) n FROM qc_points WHERE produit_id = ?`).get(p).n === 1);
}

/* ======== un redémarrage ne doit rien effacer de ce que l'atelier a fait == */
// L'import des protocoles tourne à CHAQUE démarrage du service. Il effaçait
// puis réinsérait ses points : nouvel identifiant à chaque fois, et en cascade
// les contrôles signés, les points écartés par une personne, le lien entre un
// bris et sa consigne. Chaque déploiement vidait le travail de l'atelier.
{
  const { execFileSync } = require('node:child_process');
  const importer = () => execFileSync(process.execPath,
    ['--no-warnings', require('node:path').join(__dirname, '..', 'import_qualite.js'),
     '--charte', '--squelettes', '--ecrire'],
    { env: process.env, encoding: 'utf8' });
  if (!db.prepare(`SELECT 1 FROM produits WHERE code = 'MIT-POLAR'`).get())
    db.prepare(`INSERT INTO produits (code, nom, famille) VALUES ('MIT-POLAR','Mitaine polar','hiver')`).run();
  const mp = db.prepare(`SELECT id FROM produits WHERE code = 'MIT-POLAR'`).get().id;
  importer();
  const pt = db.prepare(`SELECT id FROM qc_points WHERE produit_id = ? AND cree_par IS NULL
                          ORDER BY id LIMIT 1`).get(mp);
  const gen = db.prepare(`SELECT id FROM qc_points WHERE produit_id IS NULL AND cree_par IS NULL
                           ORDER BY id LIMIT 1`).get();
  const o = db.prepare(`INSERT INTO ordres (numero, titre, statut) VALUES (?,?, 'planifie')`)
    .run(`OP-RED-${process.pid}`, 'Redémarrage').lastInsertRowid;
  const it = db.prepare(`INSERT INTO ordre_items (ordre_id, produit_id, quantite) VALUES (?,?,?)`)
    .run(o, mp, 10).lastInsertRowid;
  db.prepare(`INSERT INTO qc_controles (item_id, point_id, verdict, utilisateur_id)
              VALUES (?,?,'conforme',?)`).run(it, pt.id, u);
  if (gen) db.prepare(`INSERT INTO qc_hors_sujet (produit_id, point_id, motif, cree_par)
              VALUES (?,?,'essai',?)`).run(mp, gen.id, u);
  importer();
  t('un redémarrage garde les contrôles signés par l\'atelier',
    db.prepare(`SELECT COUNT(*) n FROM qc_controles WHERE item_id = ?`).get(it).n === 1);
  t('… et l\'identifiant du point ne change pas',
    !!db.prepare(`SELECT 1 FROM qc_points WHERE id = ?`).get(pt.id));
  t('… et un point écarté par une personne reste écarté',
    !gen || db.prepare(`SELECT COUNT(*) n FROM qc_hors_sujet WHERE cree_par = ?`).get(u).n === 1);
}

/* ============================== cotes : théorique à côté du réel ========= */
{
  const { coteFinie, PERTE } = require('../import_cotes.js');
  const D = require('../db.js');
  const V = require('../vues.js');
  // La formule : une largeur perd (π/2 − 1) × épaisseur, une longueur fermée
  // d'un seul bout la moitié, un diamètre rien.
  t('une largeur à plat perd (π/2 − 1) × épaisseur',
    Math.abs(coteFinie(143, 2, 16) - (143 - PERTE * 16)) < 0.06);
  t('une longueur fermée d\'un bout n\'en perd que la moitié',
    Math.abs(coteFinie(314, 1, 16) - (314 - PERTE * 8)) < 0.06);
  t('sans cote de patron, pas de théorique (pièce étalon)', coteFinie(null, 1, 12) === null);
  // Le jugement.
  t('dans la tolérance = vert', D.ecartCote(134, 136, '± 3').etat === 'ok');
  t('hors tolérance = rouge', D.ecartCote(134, 140, '± 3').etat === 'ko');
  t('un minimum se juge par-dessous seulement',
    D.ecartCote(140, 150, 'min').etat === 'ok' && D.ecartCote(140, 130, 'min').etat === 'ko');
  t('sans théorique, on montre sans juger', D.ecartCote(null, 200, '± 5').etat === 'info');

  const mp = db.prepare(`SELECT id FROM produits WHERE code = 'MIT-POLAR'`).get().id;
  db.prepare(`DELETE FROM cotes_theoriques WHERE produit_id = ?`).run(mp);
  const insT = db.prepare(`INSERT INTO cotes_theoriques (produit_id, num, nom, taille, rang_taille,
    couture_mm, valeur_mm, tolerance, titre_point, ep_statut, ep_detail) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const TITRE = 'Cotes hors-tout et incréments de gradation, contre le patron';
  insT.run(mp, 1, 'Largeur', 'S', 1, 133, 125, '± 3', TITRE, 'supposée', 'corps 14 mm');
  insT.run(mp, 1, 'Largeur', 'M', 2, 143, 135, '± 3', TITRE, 'supposée', 'corps 14 mm');
  insT.run(mp, 3, 'Bout du pouce → bas, le long de la couture', 'M', 2, null, null, '± 5', TITRE, 'supposée', 'corps 14 mm');
  const o2 = db.prepare(`INSERT INTO ordres (numero, titre, statut) VALUES (?,?, 'planifie')`)
    .run(`OP-COT-${process.pid}`, 'Cotes').lastInsertRowid;
  const lotA = db.prepare(`INSERT INTO ordre_items (ordre_id, produit_id, quantite) VALUES (?,?,?)`)
    .run(o2, mp, 5).lastInsertRowid;
  const lotB = db.prepare(`INSERT INTO ordre_items (ordre_id, produit_id, quantite) VALUES (?,?,?)`)
    .run(o2, mp, 5).lastInsertRowid;
  const r1 = D.enregistrerReleves(mp, lotA, u,
    { v_1_M: '136,5', v_1_S: '', v_3_M: '202', v_9_M: '10', v_1_XL: '99', v_1_S2: 'x', retour: '/' });
  t('la virgule décimale passe, une case vide n\'écrit rien, une cote inconnue est ignorée',
    r1.n === 2 && r1.illisibles.length === 0, JSON.stringify(r1));
  const r2 = D.enregistrerReleves(mp, lotA, u, { v_1_M: '136.5', v_1_S: 'abc' });
  t('une valeur inchangée n\'est pas une nouvelle mesure ; l\'illisible est nommé',
    r2.n === 0 && r2.illisibles.length === 1, JSON.stringify(r2));
  D.enregistrerReleves(mp, lotB, u, { v_1_M: '141' });
  const gA = D.grilleCotes(mp, { itemId: lotA });
  const gB = D.grilleCotes(mp, { itemId: lotB });
  const cM = (g, n) => g.lignes.find(l => l.num === n).cases.M;
  t('chaque lot voit SES mesures', cM(gA, 1).reel.valeur_mm === 136.5 && cM(gB, 1).reel.valeur_mm === 141);
  t('136,5 contre 135 ± 3 : vert ; 141 : rouge', cM(gA, 1).etat === 'ok' && cM(gB, 1).etat === 'ko');
  t('la cote 3 sans théorique garde sa mesure', cM(gA, 3).theo === null && cM(gA, 3).reel.valeur_mm === 202);
  const h = V.grilleCotesHTML(gA, { action: '/ordres/1/items/1/cotes', retour: '/x' });
  t('la grille éditable a un champ par case, prérempli, et le bouton',
    h.includes('name="v_1_M"') && h.includes('value="136,5"') && h.includes('Enregistrer les mesures réelles'));
  t('elle dit que l\'épaisseur est supposée', h.includes('épaisseur supposée'));
  const hl = V.grilleCotesHTML(D.grilleCotes(mp));
  t('en lecture seule, pas de champ', !hl.includes('<input') && hl.includes('gc-ko'));
}

/* ======= semelles : mesures hors lot, et mesures transmises par écrit ===== */
{
  const D = require('../db.js');
  const { execFileSync } = require('node:child_process');
  if (!db.prepare(`SELECT 1 FROM produits WHERE code = 'SEMELLE-9'`).get())
    db.prepare(`INSERT INTO produits (code, nom, famille) VALUES ('SEMELLE-9','Semelle 9F+','hiver')`).run();
  const sp = db.prepare(`SELECT id FROM produits WHERE code = 'SEMELLE-9'`).get().id;
  const lancer = () => execFileSync(process.execPath, ['--no-warnings',
    require('node:path').join(__dirname, '..', 'import_cotes.js'), '--ecrire'],
    { env: process.env, encoding: 'utf8' });
  // Les cotes 3-4-5 des mitaines ont changé de sens le 26/09/2026 : une mesure
  // d'avant ne doit pas s'afficher sous la nouvelle définition.
  const mpol = db.prepare(`SELECT id FROM produits WHERE code = 'MIT-POLAR'`).get().id;
  const insR = db.prepare(`INSERT INTO cotes_releves (produit_id, num, taille, valeur_mm, cree_le)
    VALUES (?,?,?,?,?)`);
  const avant = insR.run(mpol, 4, 'M', 50, '2026-09-25 10:00:00').lastInsertRowid;
  const apres = insR.run(mpol, 4, 'M', 53, '2026-09-27 10:00:00').lastInsertRowid;
  lancer(); lancer();
  const numDe = (id) => db.prepare(`SELECT num FROM cotes_releves WHERE id = ?`).get(id).num;
  t('une cote 4 de mitaine mesurée avant la redéfinition passe à 104, une d\'après reste 4',
    numDe(avant) === 104 && numDe(apres) === 4, `${numDe(avant)} ${numDe(apres)}`);
  t('une mesure transmise par écrit n\'entre qu\'une fois, même après deux démarrages',
    db.prepare(`SELECT COUNT(*) n FROM cotes_releves WHERE produit_id = ? AND taille = '12F-10H' AND num = 1`)
      .get(sp).n === 1);
  const g = D.grilleCotes(sp, { horsLot: true });
  t('les pointures gardent l\'ordre du fichier',
    g.tailles[0] === '9F-7H' && g.tailles[g.tailles.length - 1] === '14H', g.tailles.join(' '));
  t('le 12F-10H porte ses 282 × 95 mm, sans théorique',
    g.lignes[0].cases['12F-10H'].reel.valeur_mm === 282 && g.lignes[1].cases['12F-10H'].reel.valeur_mm === 95
    && g.lignes[0].cases['12F-10H'].theo === null);
  const o3 = db.prepare(`INSERT INTO ordres (numero, titre, statut) VALUES (?,?, 'planifie')`)
    .run(`OP-SEM-${process.pid}`, 'Semelles').lastInsertRowid;
  const lot = db.prepare(`INSERT INTO ordre_items (ordre_id, produit_id, quantite) VALUES (?,?,?)`)
    .run(o3, sp, 10).lastInsertRowid;
  D.enregistrerReleves(sp, lot, u, { 'v_1_12F-10H': '284' });
  D.enregistrerReleves(sp, null, u, { 'v_2_9F-7H': '88' });
  t('hors lot et lot ne se mélangent pas',
    D.grilleCotes(sp, { horsLot: true }).lignes[0].cases['12F-10H'].reel.valeur_mm === 282
    && D.grilleCotes(sp, { itemId: lot }).lignes[0].cases['12F-10H'].reel.valeur_mm === 284
    && D.grilleCotes(sp, { itemId: lot }).lignes[1].cases['9F-7H'].reel === null);
  const V = require('../vues.js');
  // La page du protocole range les « mesure » à part (tableau par taille) :
  // la grille doit passer par CE chemin aussi, pas seulement par la liste.
  if (!db.prepare(`SELECT 1 FROM qc_points WHERE produit_id = ? AND titre = ?`).get(sp, g.titrePoint))
    db.prepare(`INSERT INTO qc_points (produit_id, type, titre) VALUES (?, 'mesure', ?)`).run(sp, g.titrePoint);
  const pageP = V.vueProtocole({ user: { nom: 'x', role: 'admin', unites: 'mm' }, msg: {},
    p: db.prepare(`SELECT * FROM produits WHERE id = ?`).get(sp), proto: D.protocole(sp),
    grille: D.grilleCotes(sp, { horsLot: true }) });
  t('la page du protocole montre la grille, éditable hors lot',
    pageP.includes('class="grille-cotes') && pageP.includes(`action="/qualite/${sp}/cotes"`));
  t('sans patron, la grille le dit au lieu de parler d\'épaisseur',
    V.grilleCotesHTML(g).includes('aucun patron numérisé') && !V.grilleCotesHTML(g).includes('épaisseur'));
}

console.log(`\n  ${ok} ok, ${ko} ko\n`);
process.exit(ko ? 1 : 0);
