/**
 * tests/inventaire.js — le stock, les besoins, et la lecture du chiffrier.
 *
 * Trois choses sont vérifiées ici, parce que ce sont les trois qui peuvent
 * faire commander du tissu pour rien, ou n'en pas commander assez :
 *
 *   1. La lecture du chiffrier : conversion d'unités, rendements inversés,
 *      tolérance d'arrondi. C'est le seul endroit où une virgule mal lue
 *      devient une erreur de plusieurs milliers de dollars.
 *   2. Le stock comme somme de ses mouvements, et le comptage qui remplace au
 *      lieu de s'ajouter.
 *   3. La frontière entre « il en manque » et « on ne sait pas » — la nuance
 *      qui décide si une alerte est crédible.
 *
 *   node tests/inventaire.js
 */
'use strict';
process.env.MRP_DB = process.env.MRP_DB
  || require('node:path').join(require('node:os').tmpdir(), `mrp-inv-${process.pid}.db`);

const { db, etatMatieres, alertesStock, nomenclatureProduit, detailBesoin,
        stocksMatieres, qte } = require('../db.js');
const chiffrier = require('../chiffrier.js');
const outils = require('../outils.js');
const auth = require('../auth.js');

let ok = 0, ko = 0;
const t = (nom, cond, detail = '') => {
  if (cond) { ok++; console.log(`  [OK ] ${nom}`); }
  else { ko++; console.log(`  [KO ] ${nom}${detail ? ' — ' + detail : ''}`); }
};
const proche = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

/* ============================================ 1. lecture du chiffrier ==== */

// Le cas d'école : un prix au mètre linéaire ET un prix au mètre carré dans la
// même case. Se tromper de colonne donne un coût 52 % trop élevé.
{
  const p = chiffrier.prix('12.50', 'm (8,22 $/m²)');
  t('deux prix dans une case : le linéaire est la base',
    p.base.prix === 12.5 && p.base.unite === 'm');
  t('deux prix dans une case : le carré est reconnu',
    p.alt && p.alt.prix === 8.22 && p.alt.unite === 'm2');
}

// « 2 pads (4,80 pads/m) » : deux pièces, à raison de 4,80 par mètre.
{
  const c = chiffrier.litConsommation('2 pads (4,80 pads/m)');
  t('rendement entre parenthèses : 2 / 4,80 = 0,4167 m',
    c && proche(c.valeur, 2 / 4.8, 1e-9) && c.unite === 'm',
    c && String(c.valeur));
}

// Le piège symétrique : ici le 27 EST le rendement, pas un compte de pièces.
// Le lire comme des pièces donnerait 27/27 = 1 mètre par semelle, 27 fois trop.
{
  const c = chiffrier.litConsommation('27 pads/m');
  t('rendement seul : 1 / 27, pas 27 / 27',
    c && proche(c.valeur, 1 / 27, 1e-9), c && String(c.valeur));
}

t('« voir fiche » ne se lit pas comme un nombre',
  chiffrier.litConsommation('voir fiche') === null);
t('« 2 par pad » donne son nombre sans prétendre à une unité',
  (() => { const c = chiffrier.litConsommation('2 par pad');
           return c && c.valeur === 2 && c.unite === null; })());

t('conversion g → kg', proche(chiffrier.convertir(51.25, 'g', 'kg'), 0.05125));
t('conversion po → m', proche(chiffrier.convertir(45, 'pouce', 'm'), 1.143));
t('des dimensions étrangères ne se convertissent pas',
  chiffrier.convertir(1, 'kg', 'm') === null);

// 51,25 g d'asclépiade à 105 $/kg = 5,38 $. La phrase parle en grammes, le prix
// en kilos : sans conversion, la vérification crierait au désaccord de 100 %.
{
  const c = chiffrier.consommationDe({ cout_unite: '105.00', unite: 'kg',
    consommation: '51,25 g', cout_par_produit: '5.38' });
  t('g contre prix au kilo : les deux lectures concordent',
    c.source === 'chiffrier' && c.unite === 'kg' && proche(c.consommation, 0.05124, 1e-4),
    `${c.source} ${c.consommation}`);
}

// Un coût noté « 0,01 $ » porte ±50 % d'incertitude d'arrondi : deux lectures
// qui divergent de 30 % y sont d'accord. Une tolérance fixe de 5 % ferait
// crier au loup sur toutes les petites lignes.
{
  const c = chiffrier.consommationDe({ cout_unite: '7.24', unite: 'kg',
    consommation: '2,00 g', cout_par_produit: '0.01' });
  t("la tolérance suit l'arrondi du chiffrier, pas un pourcentage fixe",
    c.source === 'chiffrier', `${c.source}, écart ${c.ecart}`);
}

// Le même écart sur un coût précis est un VRAI désaccord, et doit sortir.
{
  const c = chiffrier.consommationDe({ cout_unite: '17.00', unite: 'kg',
    consommation: '0,02 kg', cout_par_produit: '0.17' });
  t('un désaccord sur un coût précis est signalé',
    c.source === 'a_confirmer', c.source);
  t('le coût fait foi malgré le désaccord', proche(c.consommation, 0.01));
}

// Sans prix unitaire, il n'y a pas de tablette : c'est une ligne de coût.
{
  const c = chiffrier.consommationDe({ cout_unite: '', unite: 'unite',
    consommation: '', cout_par_produit: '3.23' });
  t('ligne de coût agrégée : hors inventaire', c.suivi_stock === false);
}

/* ================================================= 2. stock et mouvements */

const admin = (() => {
  auth.creerUtilisateur({ courriel: 'a@test.com', mdp: 'motdepasse1',
                          nom: 'Claudia', role: 'admin' });
  return db.prepare(`SELECT * FROM utilisateurs WHERE courriel = 'a@test.com'`).get();
})();

const mat = (code, o = {}) => db.prepare(`INSERT INTO matieres
    (code, nom, categorie, unite, cout_unite, seuil_alerte, suivi_stock)
    VALUES (?,?,?,?,?,?,?)`).run(code, o.nom || code, o.categorie || 'tissu',
    o.unite || 'm', o.cout ?? 10, o.seuil ?? 0, o.suivi ?? 1).lastInsertRowid;

const idTissu = mat('TISSU', { nom: 'Tissu témoin', cout: 5, seuil: 50 });
const idFil   = mat('FIL-AGREGE', { nom: 'Fil agrégé', suivi: 0 });
const idRare  = mat('RARE', { nom: 'Matière jamais comptée', cout: 100 });

const produit = db.prepare(`INSERT INTO produits (code, nom) VALUES ('P1','Produit 1')`)
  .run().lastInsertRowid;
db.prepare(`INSERT INTO nomenclature (produit_id, matiere_id, consommation,
    cout_par_produit, source) VALUES (?,?,?,?,'chiffrier')`)
  .run(produit, idTissu, 0.5, 2.5);
db.prepare(`INSERT INTO nomenclature (produit_id, matiere_id, consommation,
    cout_par_produit, source) VALUES (?,?,?,?,'chiffrier')`)
  .run(produit, idRare, 0.1, 10);
// Une ligne sans consommation chiffrée : son besoin ne se calcule pas.
db.prepare(`INSERT INTO nomenclature (produit_id, matiere_id, consommation,
    cout_par_produit, source) VALUES (?,?,NULL,?,'a_confirmer')`)
  .run(produit, idFil, 0.06);

const ordre = db.prepare(`INSERT INTO ordres (numero, titre, statut)
    VALUES ('OP-TEST','Test','en_cours')`).run().lastInsertRowid;
db.prepare(`INSERT INTO ordre_items (ordre_id, produit_id, quantite, avancement)
    VALUES (?,?,?,?)`).run(ordre, produit, 1000, 40);

const ctx = (() => {
  const id = db.prepare(`INSERT INTO agent_tours (utilisateur_id, fil, demande)
      VALUES (?,?,?)`).run(admin.id, 'test'.padEnd(18, '0'), 'test').lastInsertRowid;
  return { user: admin, tourId: id, faits: [] };
})();
const etat = (id) => etatMatieres({ inclureInactives: true }).find(m => m.id === id);
const ex = (n, a) => outils.executer(n, a, ctx);

ex('mouvement_stock', { matiere: 'TISSU', quantite: 300, motif: 'reception' });
t('une réception entre', etat(idTissu).stock === 300);

ex('mouvement_stock', { matiere: 'TISSU', quantite: 120, motif: 'consommation' });
t('une consommation sort, sans qu\'on ait tapé de signe', etat(idTissu).stock === 180);

// Le comptage REMPLACE : c'est le geste de l'inventaire physique.
ex('mouvement_stock', { matiere: 'TISSU', quantite: 150, motif: 'inventaire' });
t('un comptage remplace le stock au lieu de s\'y ajouter', etat(idTissu).stock === 150);
t("l'écart du comptage est enregistré tel quel",
  db.prepare(`SELECT quantite FROM mouvements WHERE motif='inventaire'`).get().quantite === -30);

t('un comptage identique est refusé, pas enregistré',
  ex('mouvement_stock', { matiere: 'TISSU', quantite: 150, motif: 'inventaire' }).inchange === true);
t('une quantité négative est refusée',
  Boolean(ex('mouvement_stock', { matiere: 'TISSU', quantite: -1, motif: 'reception' }).erreur));
t('une ligne de coût agrégée refuse le stock',
  Boolean(ex('mouvement_stock', { matiere: 'FIL-AGREGE', quantite: 5, motif: 'reception' }).erreur));
t('une matière ET un produit ensemble sont refusés',
  Boolean(ex('mouvement_stock', { matiere: 'TISSU', produit: 'P1', quantite: 5,
                                  motif: 'reception' }).erreur));

/* ==================================================== 3. besoins et alertes */

// 1000 unités à 40 % → 600 restantes × 0,5 m = 300 m. Le stock est à 150.
t('le besoin déduit l\'avancement déclaré', proche(etat(idTissu).besoin, 300));
t('le manque est la part non couverte', proche(etat(idTissu).manque, 150));
t('le manque est chiffré en argent', proche(etat(idTissu).cout_manque, 750));

t('une ligne sans consommation est comptée à part, pas à zéro',
  etat(idFil).produits_flous === 1 && etat(idFil).besoin === 0);

const a = alertesStock();
t('une matière comptée et insuffisante est en rupture',
  a.ruptures.some(m => m.id === idTissu));
// Le point qui décide de la crédibilité des alertes.
t('une matière JAMAIS comptée n\'est pas déclarée en rupture',
  !a.ruptures.some(m => m.id === idRare));
t('elle est rangée dans les inconnues', a.jamais_comptees.some(m => m.id === idRare));
t('les inconnues sont triées par ce que la production leur demande',
  a.jamais_comptees[0].id === idRare);
t('une ligne agrégée reste hors de toutes les alertes',
  !a.ruptures.concat(a.bas, a.jamais_comptees).some(m => m.id === idFil));

// Le calculateur, dans le sens « pour N unités ».
{
  const r = ex('besoins_produit', { produit: 'P1', quantite: 200 });
  const tissu = r.matieres.find(m => m.matiere === 'Tissu témoin');
  t('le calculateur chiffre une série', tissu.il_en_faut === qte(100, 'm'));
  t('le calculateur tranche sur le stock', tissu.verdict === 'assez');
  t('il dit « inconnu » plutôt que « assez » sans comptage',
    r.matieres.find(m => m.matiere === 'Matière jamais comptée').verdict === 'stock inconnu');
  t('le coût matière de la série est chiffré, pas un objet',
    typeof r.cout_matiere_serie === 'number' && r.cout_matiere_serie > 0,
    String(r.cout_matiere_serie));
}
// Sans quantité, il prend ce qu'il reste à produire.
t('sans quantité, le calculateur prend le reste à produire',
  ex('besoins_produit', { produit: 'P1' }).quantite === 600);

t('le détail du besoin nomme l\'ordre qui le porte',
  detailBesoin(idTissu).some(b => b.numero === 'OP-TEST'));

// L'annulation d'un tour doit défaire les mouvements comme le reste.
{
  const avant = etat(idTissu).stock;
  const t2 = { user: admin, faits: [],
    tourId: db.prepare(`INSERT INTO agent_tours (utilisateur_id, fil, demande)
      VALUES (?,?,?)`).run(admin.id, 'b'.padEnd(18, '0'), 'x').lastInsertRowid };
  outils.executer('mouvement_stock', { matiere: 'TISSU', quantite: 40,
                                       motif: 'reception' }, t2);
  const pendant = etat(idTissu).stock;
  outils.annulerTour(t2.tourId);
  t('un mouvement de l\'assistant se défait',
    pendant === avant + 40 && etat(idTissu).stock === avant);
}

console.log(`\n  ${ok} vérifications, ${ko} échec(s).`);
process.exit(ko ? 1 : 0);
