/**
 * tests/outils.js — les outils de l'assistant, sans appeler l'API.
 *
 * C'est la partie qui écrit dans la base : elle se teste seule, et c'est là que
 * les erreurs coûtent cher. On vérifie surtout les refus (droits, ambiguïté,
 * valeurs invalides) et l'annulation, parce que c'est ce qui autorise à laisser
 * l'assistant agir sans confirmation.
 *
 *   node tests/outils.js
 */
'use strict';
process.env.MRP_DB = process.env.MRP_DB
  || require('node:path').join(require('node:os').tmpdir(), `mrp-outils-${process.pid}.db`);

const { db } = require('../db.js');
const outils = require('../outils.js');
const auth = require('../auth.js');

let ok = 0, ko = 0;
const t = (nom, cond, detail = '') => {
  if (cond) { ok++; console.log(`  [OK ] ${nom}`); }
  else { ko++; console.log(`  [KO ] ${nom}${detail ? ' — ' + detail : ''}`); }
};

// ------------------------------------------------------------------- décor
const creer = (courriel, nom, role) => {
  auth.creerUtilisateur({ courriel, mdp: 'motdepasse1', nom, role });
  return db.prepare(`SELECT * FROM utilisateurs WHERE courriel = ?`).get(courriel);
};
const admin = creer('a@test.com', 'Claudia', 'admin');
const atelier = creer('m@test.com', 'Montassar', 'atelier');

const tour = (user) => {
  const id = db.prepare(`INSERT INTO agent_tours (utilisateur_id, fil, demande)
                         VALUES (?,?,?)`).run(user.id, 'test'.padEnd(18, '0'), 'test')
    .lastInsertRowid;
  return { user, tourId: id, faits: [] };
};
const ex = (nom, args, ctx) => outils.executer(nom, args, ctx);

console.log('\nOutils de l\'assistant\n');

// ------------------------------------------------------------- créer, lire
let c = tour(admin);
const p1 = ex('creer_produit', { code: 'CC-ADULTE', nom: 'Cache-cou adulte M-L',
  notes_tech: 'Coupe en largeur' }, c);
t('création d\'un produit', p1.ok && p1.code === 'CC-ADULTE', JSON.stringify(p1));

ex('creer_produit', { code: 'CC-ENFANT', nom: 'Cache-cou enfant' }, c);
ex('creer_produit', { code: 'TQ-SPORT', nom: 'Tuque sport' }, c);

const dup = ex('creer_produit', { code: 'cc-adulte', nom: 'Doublon' }, c);
t('code déjà pris refusé', Boolean(dup.erreur), JSON.stringify(dup));

const o1 = ex('creer_ordre', { titre: 'Production automne 2026' }, c);
t('création d\'un ordre', o1.ok && /^OP-\d{4}-\d{4}$/.test(o1.numero), JSON.stringify(o1));

// ------------------------------------------------------------- résolution
const amb = ex('lire_produit', { produit: 'Cache-cou' }, c);
t('référence ambiguë refusée, pas devinée',
  Boolean(amb.erreur) && amb.erreur.includes('CC-ADULTE') && amb.erreur.includes('CC-ENFANT'),
  JSON.stringify(amb));

const introuv = ex('lire_produit', { produit: 'sac à dos' }, c);
t('produit introuvable signalé', Boolean(introuv.erreur), JSON.stringify(introuv));

const parNom = ex('lire_produit', { produit: 'Tuque' }, c);
t('résolution par bout de nom', parNom.code === 'TQ-SPORT', JSON.stringify(parNom));

const parTitre = ex('lire_ordre', { ordre: 'automne' }, c);
t('ordre résolu par bout de titre', parTitre.numero === o1.numero, JSON.stringify(parTitre));

// ------------------------------------------------------------------ items
const it = ex('ajouter_item', { ordre: o1.numero, produit: 'CC-ADULTE', quantite: 2000 }, c);
t('item ajouté', it.ok && it.quantite === 2000, JSON.stringify(it));

const it2 = ex('ajouter_item', { ordre: o1.numero, produit: 'CC-ADULTE', quantite: 5 }, c);
t('doublon d\'item refusé', Boolean(it2.erreur), JSON.stringify(it2));

const qNeg = ex('ajouter_item', { ordre: o1.numero, produit: 'TQ-SPORT', quantite: -3 }, c);
t('quantité négative refusée', Boolean(qNeg.erreur), JSON.stringify(qNeg));

ex('ajouter_item', { ordre: o1.numero, produit: 'TQ-SPORT', quantite: 500 }, c);

// ------------------------------------------------------------- avancement
const av = ex('maj_avancement', { ordre: o1.numero, produit: 'CC-ADULTE', valeur: 70 }, c);
t('avancement mis à 70 %', av.ok && av.apres === 70, JSON.stringify(av));

const av75 = ex('maj_avancement', { ordre: o1.numero, produit: 'CC-ADULTE', valeur: 75 }, c);
t('avancement hors tranche de 10 % refusé', Boolean(av75.erreur), JSON.stringify(av75));

const av200 = ex('maj_avancement', { ordre: o1.numero, produit: 'CC-ADULTE', valeur: 200 }, c);
t('avancement > 100 refusé', Boolean(av200.erreur), JSON.stringify(av200));

const absent = ex('maj_avancement', { ordre: o1.numero, produit: 'CC-ENFANT', valeur: 10 }, c);
t('produit absent de l\'ordre signalé', Boolean(absent.erreur), JSON.stringify(absent));

const statut = db.prepare(`SELECT statut FROM ordres WHERE numero = ?`).get(o1.numero).statut;
t('ordre planifié bascule en cours au premier avancement', statut === 'en_cours', statut);

const hist = db.prepare(`SELECT COUNT(*) n FROM avancement_historique`).get().n;
t('avancement tracé dans l\'historique', hist === 1, String(hist));

// ---------------------------------------------------------------- jalons
const j = ex('ajouter_jalon', { ordre: o1.numero, titre: 'Départ conteneur',
  date: '2026-10-02', type: 'deadline' }, c);
t('jalon ajouté', j.ok && j.date === '2026-10-02', JSON.stringify(j));

const jMauvaise = ex('ajouter_jalon', { ordre: o1.numero, titre: 'X', date: '2 octobre' }, c);
t('date mal formée refusée', Boolean(jMauvaise.erreur), JSON.stringify(jMauvaise));

// ------------------------------------------------------------------ droits
const m = tour(atelier);
const refusOrdre = ex('creer_ordre', { titre: 'Par l\'atelier' }, m);
t('l\'atelier ne peut pas créer d\'ordre', Boolean(refusOrdre.erreur), JSON.stringify(refusOrdre));

const refusProduit = ex('creer_produit', { code: 'X-1', nom: 'X' }, m);
t('l\'atelier ne peut pas créer de produit', Boolean(refusProduit.erreur));

const refusRetrait = ex('retirer_item', { ordre: o1.numero, produit: 'TQ-SPORT' }, m);
t('l\'atelier ne peut pas retirer d\'item', Boolean(refusRetrait.erreur));

const avOk = ex('maj_avancement', { ordre: o1.numero, produit: 'TQ-SPORT', valeur: 30 }, m);
t('l\'atelier peut mettre à jour un avancement', avOk.ok === true, JSON.stringify(avOk));

const comOk = ex('commenter', { ordre: o1.numero, texte: 'Manque du molleton noir' }, m);
t('l\'atelier peut commenter', comOk.ok === true, JSON.stringify(comOk));

const vus = outils.schemas('atelier').map(s => s.name);
t('l\'atelier ne voit que ses outils',
  !vus.includes('creer_ordre') && vus.includes('maj_avancement'), vus.join(','));
t('l\'administration voit tout', outils.schemas('admin').length === outils.OUTILS.length);

// ------------------------------------------------------------------- photos
const photoData = ex('ajouter_photo', { produit: 'CC-ADULTE',
  url: 'data:image/png;base64,iVBOR' }, c);
t('data: URI refusée aussi par l\'assistant', Boolean(photoData.erreur), JSON.stringify(photoData));

const photoOk = ex('ajouter_photo', { produit: 'CC-ADULTE',
  url: 'https://cdn.shopify.com/s/files/1/x.png', legende: 'À plat' }, c);
t('photo par URL acceptée', photoOk.ok === true, JSON.stringify(photoOk));

// ------------------------------------------------------------------ annuler
const cA = tour(admin);
ex('maj_avancement', { ordre: o1.numero, produit: 'CC-ADULTE', valeur: 90 }, cA);
ex('ajouter_jalon', { ordre: o1.numero, titre: 'Salon Québec', date: '2026-11-14' }, cA);
const retire = ex('retirer_item', { ordre: o1.numero, produit: 'TQ-SPORT' }, cA);
t('item retiré', retire.ok === true, JSON.stringify(retire));

const avant = {
  av: db.prepare(`SELECT avancement a FROM ordre_items i JOIN produits p ON p.id=i.produit_id
                  WHERE p.code='CC-ADULTE'`).get().a,
  jalons: db.prepare(`SELECT COUNT(*) n FROM ordre_jalons`).get().n,
  items: db.prepare(`SELECT COUNT(*) n FROM ordre_items`).get().n,
};
t('état avant annulation', avant.av === 90 && avant.jalons === 2 && avant.items === 1,
  JSON.stringify(avant));

const n = outils.annulerTour(cA.tourId);
t('trois écritures annulées', n === 3, String(n));

const apres = {
  av: db.prepare(`SELECT avancement a FROM ordre_items i JOIN produits p ON p.id=i.produit_id
                  WHERE p.code='CC-ADULTE'`).get().a,
  jalons: db.prepare(`SELECT COUNT(*) n FROM ordre_jalons`).get().n,
  items: db.prepare(`SELECT COUNT(*) n FROM ordre_items`).get().n,
};
t('avancement rendu à sa valeur précédente', apres.av === 70, String(apres.av));
t('jalon ajouté retiré', apres.jalons === 1, String(apres.jalons));
t('item retiré rétabli', apres.items === 2, String(apres.items));

const tqRetabli = db.prepare(`SELECT i.quantite, i.avancement FROM ordre_items i
  JOIN produits p ON p.id = i.produit_id WHERE p.code = 'TQ-SPORT'`).get();
t('item rétabli avec sa quantité et son avancement',
  tqRetabli.quantite === 500 && tqRetabli.avancement === 30, JSON.stringify(tqRetabli));

t('annuler deux fois ne fait rien de plus', outils.annulerTour(cA.tourId) === 0);

// LIFO : on ne défait que le dernier tour encore en place
t('le dernier tour est celui du décor une fois cA défait',
  outils.dernierTourAnnulable(admin.id) === c.tourId,
  String(outils.dernierTourAnnulable(admin.id)));

const cB = tour(admin);
ex('commenter', { ordre: o1.numero, texte: 'Note plus récente' }, cB);
t('un nouveau tour devient le seul annulable',
  outils.dernierTourAnnulable(admin.id) === cB.tourId);

// ------------------------------------------------------------------- lecture
const lu = ex('lire_ordre', { ordre: o1.numero }, tour(atelier));
t('lecture accessible à l\'atelier', Array.isArray(lu.items), JSON.stringify(lu).slice(0, 80));

const inconnu = ex('outil_qui_nexiste_pas', {}, c);
t('outil inconnu signalé sans planter', Boolean(inconnu.erreur));

console.log(`\n  ${ok} réussites, ${ko} échecs\n`);
try { require('node:fs').rmSync(process.env.MRP_DB, { force: true }); } catch {}
process.exit(ko ? 1 : 0);
