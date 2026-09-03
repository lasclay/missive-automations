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

// ---------------------------------------------- priorité et liste à fabriquer
const { listeFabrication, sansMouvement, progressionRecente } = require('../db.js');

// une échéance passée sur l'ordre, pour vérifier le drapeau de retard
db.prepare(`INSERT INTO ordre_jalons (ordre_id, titre, date, type)
            VALUES (?,?,date('now','-4 days'),'deadline')`).run(1, 'Date ratée');

let fab = listeFabrication();
t('la liste ne retient que ce qui reste à produire',
  fab.every(l => l.avancement < 100) && fab.length >= 2, String(fab.length));
t("le retard est un drapeau, pas une échéance négative",
  fab.every(l => l.en_retard === true) && fab.every(l => l.jours === null || l.jours >= 0),
  JSON.stringify(fab.map(l => [l.code, l.en_retard, l.jours])));

const restantCC = fab.find(l => l.code === 'CC-ADULTE');
t('quantité restante = quantité × (100 − avancement)',
  restantCC.restant === 600, String(restantCC?.restant));

const prio = ex('definir_priorite', { ordre: o1.numero, produit: 'TQ-SPORT',
  priorite: 'haute' }, c);
t('priorité posée', prio.ok && prio.priorite === 'haute', JSON.stringify(prio));

fab = listeFabrication();
t('la priorité haute passe en tête', fab[0].code === 'TQ-SPORT', fab[0].code);

ex('definir_priorite', { ordre: o1.numero, produit: 'TQ-SPORT', priorite: 'basse' }, c);
fab = listeFabrication();
t('la priorité basse passe en queue', fab.at(-1).code === 'TQ-SPORT', fab.at(-1).code);

const prioAtelier = ex('definir_priorite', { ordre: o1.numero, produit: 'CC-ADULTE',
  priorite: 'haute' }, m);
t("l'atelier ne pose pas de priorité", Boolean(prioAtelier.erreur));

const prioInvalide = ex('definir_priorite', { ordre: o1.numero, produit: 'CC-ADULTE',
  priorite: 'urgente' }, c);
t('priorité hors liste refusée', Boolean(prioInvalide.erreur), JSON.stringify(prioInvalide));

const listeOutil = ex('a_fabriquer', { limite: 3 }, m);
t("l'atelier peut consulter la liste de fabrication",
  Array.isArray(listeOutil.liste)
  && listeOutil.liste.length === Math.min(3, listeOutil.total_items),
  JSON.stringify(listeOutil).slice(0, 90));
t('la liste porte ses totaux et son compte de retards',
  listeOutil.total_items === fab.length && listeOutil.unites_restantes > 0
  && listeOutil.en_retard === fab.filter(l => l.en_retard).length,
  `${listeOutil.total_items}/${fab.length}`);

// ------------------------------------------- familles de production
const { FAMILLES } = require('../db.js');
db.prepare(`UPDATE produits SET famille='isotherme' WHERE code='CC-ADULTE'`).run();
db.prepare(`UPDATE produits SET famille='hiver'     WHERE code='TQ-SPORT'`).run();
db.prepare(`UPDATE ordre_items SET priorite='normale'`).run();

fab = listeFabrication();
const iCC = fab.findIndex(l => l.code === 'CC-ADULTE');
const iTQ = fab.findIndex(l => l.code === 'TQ-SPORT');
t("l'hiver passe devant l'isotherme à date égale", iTQ < iCC,
  fab.map(l => `${l.code}:${l.famille}`).join(' '));

db.prepare(`UPDATE produits SET famille='nouveau' WHERE code='TQ-SPORT'`).run();
fab = listeFabrication();
t("le nouveau passe quand même devant l'isotherme",
  fab.findIndex(l => l.code === 'TQ-SPORT') < fab.findIndex(l => l.code === 'CC-ADULTE'));

// une priorité manuelle doit rester plus forte que la famille
ex('definir_priorite', { ordre: o1.numero, produit: 'CC-ADULTE', priorite: 'haute' }, c);
fab = listeFabrication();
t('la priorité manuelle bat la famille', fab[0].code === 'CC-ADULTE', fab[0].code);
ex('definir_priorite', { ordre: o1.numero, produit: 'CC-ADULTE', priorite: 'normale' }, c);

const fam = ex('definir_famille', { produit: 'CC-ADULTE', famille: 'hiver' }, c);
t('famille changée par l\'outil', fam.ok && fam.famille === 'hiver', JSON.stringify(fam));

const famKo = ex('definir_famille', { produit: 'CC-ADULTE', famille: 'automne' }, c);
t('famille hors liste refusée', Boolean(famKo.erreur), JSON.stringify(famKo));

const famAtelier = ex('definir_famille', { produit: 'CC-ADULTE', famille: 'autre' }, m);
t("l'atelier ne change pas de famille", Boolean(famAtelier.erreur));

t('les quatre familles sont ordonnées',
  Object.keys(FAMILLES).join(',') === 'hiver,nouveau,isotherme,autre',
  Object.keys(FAMILLES).join(','));

// le type de jalon « expedition » doit être accepté
const jExp = ex('ajouter_jalon', { ordre: o1.numero, titre: 'Expédition Canada',
  date: '2026-10-01', type: 'expedition' }, c);
t('jalon d\'expédition accepté', jExp.ok && jExp.type === 'expedition',
  JSON.stringify(jExp));

// ------------------------------------------------------------------- suivi
// un item entamé, figé depuis 12 jours
db.prepare(`UPDATE ordre_items SET maj_le = datetime('now','-12 days')
            WHERE id = (SELECT i.id FROM ordre_items i JOIN produits p ON p.id=i.produit_id
                        WHERE p.code='CC-ADULTE')`).run();
// L'ordre reste « planifie » : c'est l'état d'un ordre importé du plan, sur
// lequel l'atelier a déjà commencé sans que personne n'ait changé le statut.
// Le blocage doit se voir quand même — sinon le détecteur est muet sur un
// ordre entier, et c'est le seul bloc du suivi qui appelle une action.
db.prepare(`UPDATE ordres SET statut='planifie' WHERE id=?`).run(1);

let fige = sansMouvement(7);
t('un item figé est signalé même sur un ordre encore « planifie »',
  fige.some(x => x.code === 'CC-ADULTE'), JSON.stringify(fige.map(x => x.code)));

db.prepare(`UPDATE ordres SET statut='en_cours' WHERE id=?`).run(1);
fige = sansMouvement(7);
t('un item entamé et figé est signalé',
  fige.some(x => x.code === 'CC-ADULTE'), JSON.stringify(fige.map(x => x.code)));

db.prepare(`UPDATE ordres SET statut='termine' WHERE id=?`).run(1);
t('un ordre terminé ne signale plus rien',
  !sansMouvement(7).some(x => x.code === 'CC-ADULTE'));
db.prepare(`UPDATE ordres SET statut='en_cours' WHERE id=?`).run(1);
fige = sansMouvement(7);
t('un item à 0 % n\'est pas « immobile », il n\'a pas commencé',
  fige.every(x => x.avancement > 0), JSON.stringify(fige.map(x => [x.code, x.avancement])));

const prog = progressionRecente(30);
t('la progression compte des unités, pas des pourcentages',
  prog.length > 0 && prog[0].unites_avancees > 0, JSON.stringify(prog));

const suivi = ex('suivi_production', { jours: 7 }, m);
t("l'atelier peut consulter le suivi",
  Array.isArray(suivi.sans_mouvement) && Array.isArray(suivi.dernieres_maj),
  JSON.stringify(suivi).slice(0, 80));

// ------------------------------------------------- lieu de fabrication
// Tout n'est pas fait en Tunisie : ce qui est fabriqué ailleurs ne doit pas
// apparaître comme du travail d'atelier, mais ne doit pas disparaître non plus.
{
  const { fabriqueAilleurs } = require('../db.js');
  const av = listeFabrication().length;

  const lieuAtelier = ex('definir_fabrication', { produit: 'CC-ADULTE', lieu: 'chine' }, m);
  t("l'atelier ne change pas un lieu de fabrication", Boolean(lieuAtelier.erreur));

  const lieu = ex('definir_fabrication', { produit: 'CC-ADULTE', lieu: 'chine' }, c);
  t('le lieu de fabrication se pose', lieu.ok && lieu.lieu === 'chine', JSON.stringify(lieu));

  const apres = listeFabrication();
  t("ce qui est fait ailleurs sort de la liste de l'atelier",
    apres.length === av - 1 && !apres.some(l => l.code === 'CC-ADULTE'),
    av + ' → ' + apres.length);

  const ailleurs = fabriqueAilleurs();
  t('mais reste visible ailleurs, avec son restant',
    ailleurs.some(l => l.code === 'CC-ADULTE' && l.restant > 0),
    JSON.stringify(ailleurs.map(l => [l.code, l.restant])));

  const dit = ex('a_fabriquer', {}, m);
  t("l'assistant dit ce qu'il n'a pas compté",
    Array.isArray(dit.fabrique_ailleurs)
      && dit.fabrique_ailleurs.some(l => l.produit === 'CC-ADULTE'),
    JSON.stringify(dit.fabrique_ailleurs));

  const lieuKo = ex('definir_fabrication', { produit: 'CC-ADULTE', lieu: 'maroc' }, c);
  t('un lieu hors liste est refusé', Boolean(lieuKo.erreur));

  ex('definir_fabrication', { produit: 'CC-ADULTE', lieu: 'tunisie' }, c);
  t('remis à Tunisie, la ligne revient dans la liste',
    listeFabrication().some(l => l.code === 'CC-ADULTE'));
}

// ------------------------------------------- lecture visuelle des variantes
{
  const V = require('../variantes.js');

  t('un coloris est reconnu et reçoit sa teinte',
    V.typeVariante('Gris foncé') === 'couleur' && V.teinte('Gris foncé') === '#4a5158');
  t("l'accent et la casse ne changent rien",
    V.teinte('GRIS FONCE') === V.teinte('Gris foncé'));
  t('une taille est reconnue, sans teinte',
    V.typeVariante('2XL') === 'taille' && V.teinte('2XL') === null);
  t('une pointure est reconnue', V.typeVariante('8F/6H') === 'pointure');
  t("« nouveau » accolé ne masque pas la pointure",
    V.typeVariante('13H nouveau') === 'pointure');
  t('ce qui n\'est ni l\'un ni l\'autre reste « autre »',
    V.typeVariante('250g/m² (0 à -18°C)') === 'autre');

  const melange = ['XL', 'S', '2XL', 'M', 'XS', 'L'];
  t('les tailles se trient comme un corps, pas comme un alphabet',
    melange.slice().sort((a, b) => V.rangVariante(a) - V.rangVariante(b))
      .join(' ') === 'XS S M L XL 2XL',
    melange.slice().sort((a, b) => V.rangVariante(a) - V.rangVariante(b)).join(' '));

  const pts = ['11H', '6F', '13H nouveau', '8F/6H'];
  t('les pointures se trient par leur nombre',
    pts.slice().sort((a, b) => V.rangVariante(a) - V.rangVariante(b))
      .join(' ') === '6F 8F/6H 11H 13H nouveau');

  t('le noir est sombre, le gris pâle ne l\'est pas',
    V.estSombre(V.teinte('Noir')) && !V.estSombre(V.teinte('Gris pale')));
}

// ------------------------------------------------------ répartition
{
  const { variantesItem } = require('../db.js');
  const it = db.prepare(`SELECT i.id, i.quantite FROM ordre_items i
      JOIN produits p ON p.id = i.produit_id WHERE p.code = 'CC-ADULTE'`).get();
  t('sans répartition, la variante vaut null', variantesItem(it.id) === null);

  const pose = db.prepare(`INSERT INTO item_variantes
      (item_id, groupe, nom, quantite, rang) VALUES (?,?,?,?,?)`);
  pose.run(it.id, '', 'Noir', Math.floor(it.quantite / 2), 1);
  pose.run(it.id, '', 'Gris', it.quantite - Math.floor(it.quantite / 2), 2);
  const v = variantesItem(it.id);
  t('une répartition qui boucle ne signale aucun écart',
    v.lignes.length === 2 && v.somme === it.quantite && v.ecart === 0, JSON.stringify(v));
  t('un seul axe donne un seul groupe, sans nom',
    v.groupes.length === 1 && v.groupes[0].nom === '' && v.croise === false);

  pose.run(it.id, '', 'Rouge', 7, 3);
  const v2 = variantesItem(it.id);
  t("l'écart au plan est calculé, pas corrigé",
    v2.ecart === 7 && v2.quantite === it.quantite, JSON.stringify(v2));

  db.prepare('DELETE FROM item_variantes WHERE item_id = ?').run(it.id);

  // Deux axes : un coloris ET une taille. Chaque groupe garde sa somme, sinon
  // quatre coloris de tailles égales s'affichent comme quatre barres égales.
  let r = 0;
  for (const [g, n, q] of [['Noir','S',60], ['Noir','M',40],
                           ['Violet','S',6], ['Violet','M',4]])
    pose.run(it.id, g, n, q, ++r);
  const v3 = variantesItem(it.id);
  t('deux axes donnent deux groupes nommés',
    v3.croise === true && v3.groupes.length === 2
      && v3.groupes.map(x => x.nom).join(',') === 'Noir,Violet',
    JSON.stringify(v3.groupes.map(x => x.nom)));
  t('chaque groupe porte sa propre somme',
    v3.groupes[0].somme === 100 && v3.groupes[1].somme === 10,
    JSON.stringify(v3.groupes.map(x => x.somme)));
  t('la somme totale reste celle de toutes les feuilles', v3.somme === 110);

  db.prepare('DELETE FROM item_variantes WHERE item_id = ?').run(it.id);
}

// ------------------------------------------------ charge et calendrier
{
  const C = require('../charge.js');

  const chrono = C.tempsChrono();
  // Le piège : « Semelles 6-7-8F » porte une ligne Total ET ses postes.
  // Les additionner double la durée — c'est l'erreur qui a faussé les
  // variantes, elle ne doit pas se répéter ici.
  const sem = chrono.get('Semelles 6-7-8F');
  t('une ligne Total l\'emporte sur la somme des postes',
    sem.base === 'total' && sem.secondes === 143, JSON.stringify(sem.secondes));
  t('la somme des postes reste disponible, pour montrer l\'écart',
    sem.postes === 323 && sem.ecartPostes === 180,
    sem.postes + ' / ' + sem.ecartPostes);

  const cc = chrono.get('Cache-cou');
  t('sans ligne Total, on somme les postes',
    cc.base === 'postes' && cc.secondes === 1030, String(cc.secondes));

  // La conversion coût → temps, telle que le suivi Tunisie l'établit.
  const couts = C.coutsConfection();
  const bmb = C.assemblageBMB(), est = C.assemblageEstime();
  const u = (code, perim = 'tout') =>
    C.tempsUnitaire(code, chrono, couts, bmb, perim, est);

  // --- les deux étapes
  // Le chronomètre mesure la préparation, le prix BMB paie l'assemblage. Les
  // confondre change le total du simple au double : le cache-cou porte les deux.
  const cc2 = u('CACHE-COU');
  t('préparation et assemblage sont comptés séparément',
    cc2.preparation === 1030 && cc2.assemblage === Math.round((3 / C.TAUX_HORAIRE) * 3600)
      && cc2.secondes === cc2.preparation + cc2.assemblage,
    JSON.stringify({ p: cc2.preparation, a: cc2.assemblage, t: cc2.secondes }));
  t('les deux étapes se voient dans la source',
    cc2.source === 'deux', cc2.source);

  t('le prix BMB se convertit au taux horaire',
    u('GANTS-MAGIQUES').assemblage === Math.round((3 / C.TAUX_HORAIRE) * 3600),
    String(u('GANTS-MAGIQUES').assemblage));

  // Une ligne « Total » couvre déjà la couture : y ajouter l'assemblage
  // compterait la semelle deux fois.
  const semU = u('SEMELLE-678');
  t('un chronomètre « Total » ne reçoit pas d\'assemblage en plus',
    semU.total === true && semU.assemblage === 0 && semU.secondes === semU.preparation,
    JSON.stringify({ t: semU.total, a: semU.assemblage }));
  t('« Confection Lasclay » compte aussi comme un total',
    u('MIT-POLAR').total === true && u('MIT-POLAR').assemblage === 0);

  // Une somme de postes ne dit pas ce qui n'a PAS été chronométré.
  t('une somme de postes est marquée partielle',
    cc2.partiel === true && semU.partiel === false);

  // Un prix par produit vaut mieux qu'une fiche COGS empruntée à un voisin :
  // MIT-CUIR et MIT-LAINE pointaient tous deux vers « Mitaines polar ».
  t('le prix BMB du produit passe avant une fiche COGS partagée',
    u('MIT-CUIR').asmSource === 'bmb'
      && u('MIT-CUIR').assemblage !== u('MIT-LAINE').assemblage,
    [u('MIT-CUIR').assemblage, u('MIT-LAINE').assemblage].join(' / '));
  t('une source qui en contredit une autre est signalée',
    typeof u('MIT-CUIR').divergent === 'string');

  // --- périmètre
  t('le périmètre change le total sans changer les étapes',
    u('CACHE-COU', 'assemblage').secondes === cc2.assemblage
      && u('CACHE-COU', 'preparation').secondes === cc2.preparation
      && u('CACHE-COU', 'assemblage').preparation === cc2.preparation);
  t('le périmètre a un défaut prudent, marqué comme tel',
    C.perimetre().defaut === true && C.perimetre().valeur === 'tout');
  t('un périmètre inconnu est refusé',
    Boolean(C.poserPerimetre('nimporte-quoi').erreur));
  t('un périmètre valide est retenu',
    C.poserPerimetre('assemblage').ok === true
      && C.perimetre().valeur === 'assemblage' && C.perimetre().defaut === false);
  C.poserPerimetre(C.PERIMETRE_DEFAUT);

  // --- estimation à la main
  const oreiller = u('OREILLER');
  t('une estimation à la main comble le trou, marquée « estimé »',
    oreiller.asmSource === 'estime' && oreiller.secondes > 0
      && oreiller.ancrage.includes('OREILLER-CAMPING'),
    JSON.stringify({ s: oreiller.asmSource, sec: oreiller.secondes }));

  t('un produit sans mesure ni coût vaut zéro, et le dit',
    u('PRODUIT-QUI-NEXISTE-PAS').source === 'aucune');

  // --- capacité
  // On vérifie le marquage, pas le chiffre : le défaut suit l'équipe annoncée
  // et changera encore. Ce qui doit tenir, c'est qu'il se déclare comme défaut.
  t('la capacité a une valeur par défaut, marquée comme telle',
    C.capacite().defaut === true && C.capacite().postes === C.CAPACITE_DEFAUT.postes);
  t('une capacité hors bornes est refusée',
    Boolean(C.poserCapacite({ postes: 0, heures_jour: 8, jours_semaine: 5 }).erreur));
  t('une capacité valide est retenue',
    C.poserCapacite({ postes: 10, heures_jour: 8, jours_semaine: 5 }).ok === true
      && C.capacite().postes === 10 && C.capacite().defaut === false);

  // --- calendrier
  // La quantité doit dépasser une journée d'atelier, sinon doubler les postes
  // ne change rien : 100 cache-cous tiennent dans un seul jour à 4 postes
  // comme à 8, et les deux calendriers finissent le même soir. 1 000 pièces
  // font ~286 h, soit neuf jours à 32 h/jour contre cinq à 64 h/jour.
  const lignes = [
    { code: 'CACHE-COU', restant: 1000, produit_id: 1 },
    { code: 'PRODUIT-QUI-NEXISTE-PAS', restant: 50, produit_id: 2 },
  ];
  const cal4 = C.calendrier(lignes, { depart: '2026-09-01',
    cap: { postes: 4, heures_jour: 8, jours_semaine: 5 } });
  const cal8 = C.calendrier(lignes, { depart: '2026-09-01',
    cap: { postes: 8, heures_jour: 8, jours_semaine: 5 } });

  // 1 030 s de préparation + l'assemblage BMB du cache-cou, par pièce.
  const parCC = C.tempsUnitaire('CACHE-COU').secondes;
  t('la charge est la même quelle que soit la capacité',
    Math.round(cal4.heuresTotal) === Math.round(cal8.heuresTotal)
      && Math.round(cal4.heuresTotal) === Math.round(parCC * 1000 / 3600),
    String(Math.round(cal4.heuresTotal)));
  t('doubler les postes raccourcit le calendrier',
    cal8.fin < cal4.fin, cal4.fin + ' → ' + cal8.fin);
  t('un item sans temps connu est compté à part, pas oublié',
    cal4.sansTemps === 1 && cal4.taches.length === 2);
  t('un item à zéro heure ne décale pas le calendrier',
    cal4.taches[1].debut === cal4.taches[1].fin);
  t('le calendrier commence un jour ouvré',
    new Date(cal4.debut + 'T00:00:00Z').getUTCDay() !== 0, cal4.debut);

  // --- ce que les items sans temps connu coûteraient
  // « La charge réelle est plus élevée » est vrai et inutilisable : dix heures
  // ou mille ? La fourchette est ce qui rend une marge jugeable.
  const inc = C.chargeInconnue(cal4.taches);
  t('les items sans temps sont comptés en pièces, pas en items seulement',
    inc.items === 1 && inc.pieces === 50, JSON.stringify(inc));
  t('la fourchette encadre la médiane',
    inc.bas <= inc.median && inc.median <= inc.haut,
    [inc.bas, inc.median, inc.haut].join(' / '));
  t('la fourchette est bâtie sur les temps du plan lui-même',
    Math.abs(inc.bas - (parCC * 50) / 3600) < 1e-6, String(inc.bas));
  t('sans aucun item chiffré, on ne prétend pas savoir',
    C.chargeInconnue([{ code: 'INCONNU', restant: 10 }]).connu === false);
  t('sans item manquant, la fourchette est vide',
    C.chargeInconnue([{ code: 'CACHE-COU', restant: 10 }]).pieces === 0);
  // une tâche qui porte déjà son temps ne doit pas relire les fichiers
  t('le temps déjà calculé est réutilisé',
    C.chargeInconnue([{ code: 'PEU-IMPORTE', restant: 4,
                        temps: { secondes: 3600, source: 'chrono' } },
                      { code: 'AUTRE', restant: 7,
                        temps: { secondes: 0, source: 'aucune' } }]).median === 7,
    'médiane attendue 7 h');

  // remise en état pour les tests suivants
  C.poserCapacite(C.CAPACITE_DEFAUT);
}

// -------------------------------------------------------- contrôle qualité
{
  const D = require('../db.js');
  const cQ = tour(admin), mQ = tour(atelier);

  const q1 = ex('ajouter_point_qc', { produit: 'CC-ADULTE', volet: 'critique',
    titre: "Presser le col avant d'insérer l'isolant",
    consequence: 'L\'isolant fond et devient rigide' }, cQ);
  t('un point critique s\'ajoute au protocole', q1.ok === true, JSON.stringify(q1));

  // C'est l'atelier qui VOIT les défauts : lui interdire d'écrire garderait
  // l'information là où elle ne sert à personne.
  const q2 = ex('ajouter_point_qc', { produit: 'CC-ADULTE', volet: 'probleme',
    titre: 'Matelassage pas droit', consequence: 'Aspect irrégulier' }, mQ);
  t('l\'atelier peut écrire dans le protocole', q2.ok === true, JSON.stringify(q2));

  const q3 = ex('ajouter_point_qc', { produit: 'CC-ADULTE', volet: 'mesure',
    titre: 'Fibre par pièce', valeur: '4 à 5', unite: 'g',
    frequence: 'chaque pièce' }, cQ);
  t('une mesure porte sa valeur et son unité', q3.ok === true);

  t('un volet inconnu est refusé, avec les quatre possibles', (() => {
    const r = ex('ajouter_point_qc', { produit: 'CC-ADULTE', volet: 'esthetique',
      titre: 'X' }, cQ);
    return Boolean(r.erreur) && r.erreur.includes('critique');
  })());
  t('un point sans titre est refusé',
    Boolean(ex('ajouter_point_qc', { produit: 'CC-ADULTE', volet: 'critique',
      titre: '  ' }, cQ).erreur));
  t('un produit inconnu est refusé',
    Boolean(ex('ajouter_point_qc', { produit: 'ZZZ-INEXISTANT', volet: 'critique',
      titre: 'X' }, cQ).erreur));

  // Lecture
  const lu = ex('lire_qualite', { produit: 'CC-ADULTE' }, mQ);
  t('le protocole se lit, groupé par volet',
    lu.total === 3 && lu.points_critiques.length === 1
      && lu.problemes_frequents.length === 1 && lu.mesures.length === 1,
    JSON.stringify({ t: lu.total }));
  t('la conséquence remonte : c\'est elle qui fait respecter la consigne',
    lu.points_critiques[0].consequence.includes('fond'));
  t('une mesure se lit d\'un bloc',
    lu.mesures[0].mesure === '4 à 5 g', lu.mesures[0].mesure);
  t('une tolérance s\'affiche avec la valeur', (() => {
    ex('ajouter_point_qc', { produit: 'TQ-SPORT', volet: 'mesure',
      titre: 'Tour de tête', valeur: '56', tolerance: '1', unite: 'cm' }, cQ);
    return ex('lire_qualite', { produit: 'TQ-SPORT' }, cQ).mesures[0].mesure === '56 cm ± 1';
  })());

  const vide = ex('lire_qualite', { produit: 'CC-ENFANT' }, cQ);
  t('un produit sans protocole le dit au lieu de rendre du vide',
    vide.total === 0 && vide.note.includes('ajouter_point_qc'), JSON.stringify(vide));

  // Le protocole rendu à la vue
  const p1 = db.prepare(`SELECT id FROM produits WHERE code = 'CC-ADULTE'`).get().id;
  const proto = D.protocole(p1);
  t('la vue reçoit tous les volets, même vides',
    Object.keys(proto.par).length === Object.keys(D.TYPES_QC).length
      && Array.isArray(proto.par.cyclage) && Array.isArray(proto.par.emballage),
    Object.keys(proto.par).join(','));
  t('chaque point sait qui l\'a écrit',
    proto.par.probleme[0].auteur === 'Montassar', proto.par.probleme[0].auteur);

  // Couverture
  const couv = D.couvertureQC();
  const cc = couv.find(x => x.code === 'CC-ADULTE');
  t('la couverture compte par volet',
    cc.points === 3 && cc.critiques === 1 && cc.mesures === 1, JSON.stringify(cc));
  t('les produits sans protocole passent devant',
    couv[0].points === 0, couv[0].code + ' = ' + couv[0].points);

  // Annulation : un point ajouté par l'assistant se défait comme le reste
  const avant = D.protocole(p1).total;
  outils.annulerTour(cQ.tourId);
  t('les points ajoutés par l\'assistant s\'annulent',
    D.protocole(p1).total < avant,
    `${avant} → ${D.protocole(p1).total}`);
}

// ------------------ échantillonnage selon le volume, et protocole général
{
  const D = require('../db.js');
  const ech = (t, v, q) => D.echantillon({ ech_type: t, ech_valeur: v }, q);

  // « 1 sur 20 » ne veut pas dire la même chose sur 100 et sur 3 500 pièces.
  t('un ratio donne un nombre, pas une règle',
    ech('ratio', 20, 100).pieces === 5 && ech('ratio', 20, 3500).pieces === 175,
    `${ech('ratio', 20, 100).pieces} / ${ech('ratio', 20, 3500).pieces}`);
  t('le pourcentage reste constant, le nombre varie',
    ech('ratio', 20, 100).pct === 5 && ech('ratio', 20, 3500).pct === 5);
  t('un ratio vérifie toujours au moins une pièce',
    ech('ratio', 20, 3).pieces === 1, String(ech('ratio', 20, 3).pieces));
  t('« toutes les pièces » suit la quantité du lot',
    ech('tout', null, 250).pieces === 250);
  t('un nombre fixe ne dépasse pas le lot',
    ech('fixe', 5, 3).pieces === 3 && ech('fixe', 5, 900).pieces === 5);
  t('« une fois par lot » vaut une pièce quel que soit le volume',
    ech('lot', null, 4665).pieces === 1);
  t('sans règle, aucun nombre n\'est inventé',
    ech('', null, 500).pieces === null && ech('ratio', 0, 500).pieces === null);
  t('le texte dit le nombre, la règle reste en second',
    ech('ratio', 20, 3500).texte.includes('175')
      && ech('ratio', 20, 3500).regle === '1 sur 20',
    ech('ratio', 20, 3500).texte);

  // --- protocole général
  const cG = tour(admin);
  db.prepare(`INSERT INTO qc_points (produit_id, type, titre, ech_type, ech_valeur)
              VALUES (NULL, 'emballage', ?, 'ratio', 50)`)
    .run('Plier en trois, sachet kraft, étiquette sur le rabat');
  t('le protocole général existe sans produit',
    D.protocoleGeneral().length === 1 && D.protocoleGeneral()[0].produit_id === null);

  const p1 = db.prepare(`SELECT id FROM produits WHERE code = 'CC-ADULTE'`).get().id;
  const avecGeneral = D.protocole(p1);
  const sansGeneral = D.protocole(p1, { generalCompris: false });
  t('le protocole d\'un produit reprend le général',
    avecGeneral.total === sansGeneral.total + 1,
    `${avecGeneral.total} vs ${sansGeneral.total}`);
  t('le général passe après ce qui est propre au produit',
    avecGeneral.points[avecGeneral.points.length - 1].produit_id === null);

  // Il doit apparaître sur la checklist de TOUS les lots, et bloquer comme le reste.
  const oG = ex('creer_ordre', { titre: 'Lot général' }, cG);
  ex('creer_produit', { code: 'GEN-TEST', nom: 'Produit neuf' }, cG);
  ex('ajouter_item', { ordre: oG.numero, produit: 'GEN-TEST', quantite: 1000 }, cG);
  const itG = db.prepare(`SELECT i.id FROM ordre_items i JOIN produits p
                          ON p.id = i.produit_id WHERE p.code = 'GEN-TEST'`).get().id;
  const ckG = D.checklistItem(itG);
  t('un produit sans protocole propre hérite quand même du général',
    ckG.total === 1 && ckG.points[0].general === true, JSON.stringify({ t: ckG.total }));
  t('l\'échantillon du général se calcule sur le lot',
    ckG.points[0].ech.pieces === 20, String(ckG.points[0].ech.pieces));
  t('le général bloque le 100 % comme un point de produit',
    Boolean(D.blocageQC(itG, 100)));
  t('un lot qui n\'a QUE des points généraux n\'est pas « vide »',
    ckG.vide === false);

  // Le volet emballage est un volet comme les autres
  t('le volet emballage existe', D.TYPES_QC.emballage === 'Emballage et finition');
  t('un point d\'emballage s\'ajoute par l\'assistant',
    ex('ajouter_point_qc', { produit: 'GEN-TEST', volet: 'emballage',
      titre: 'Sachet individuel avant mise en carton' }, cG).ok === true);

  // Un protocole général s'applique à TOUT, y compris aux lots des blocs
  // suivants. On le retire : sinon ce bloc décide de ce que les autres testent.
  db.prepare(`DELETE FROM qc_points WHERE produit_id IS NULL`).run();
  t('le général retiré, il ne reste que les protocoles de produit',
    D.protocoleGeneral().length === 0);
}

// ---------------------------- ce qui casse : la preuve devient consigne
{
  const D = require('../db.js');
  const cB = tour(admin), mB = tour(atelier);

  const b1 = ex('signaler_bris', { produit: 'CC-ADULTE', zone: 'Attache de ganse',
    origine: 'client', texte: 'La ganse a lâché après trois semaines',
    survenu_le: '2026-08-10' }, cB);
  t('un commentaire client s\'enregistre', b1.ok === true, JSON.stringify(b1));
  t('...et l\'outil rappelle qu\'aucune consigne n\'en découle',
    b1.rappel.includes('consigne'));

  // L'atelier voit les défauts en premier : il signale comme Québec.
  t('l\'atelier peut signaler un bris',
    ex('signaler_bris', { produit: 'CC-ADULTE', zone: 'attache de ganse',
      origine: 'atelier', texte: 'Deux sur vingt se décousent au montage' }, mB).ok === true);

  t('une photo doit être une adresse web, pas un fichier',
    Boolean(ex('signaler_bris', { produit: 'CC-ADULTE', zone: 'X',
      photo_url: 'data:image/png;base64,iVBOR' }, cB).erreur));
  t('une date mal formée est refusée',
    Boolean(ex('signaler_bris', { produit: 'CC-ADULTE', zone: 'X',
      survenu_le: '10 août' }, cB).erreur));
  t('un bris sans zone est refusé',
    Boolean(ex('signaler_bris', { produit: 'CC-ADULTE', zone: '  ' }, cB).erreur));

  const pB = db.prepare(`SELECT id FROM produits WHERE code = 'CC-ADULTE'`).get().id;
  const av = D.brisProduit(pB);
  t('les signalements sont visibles sur le produit',
    av.tous.length === 2 && av.orphelins.length === 2,
    JSON.stringify({ t: av.tous.length, o: av.orphelins.length }));
  t('le commentaire est gardé mot pour mot',
    av.tous.some(b => b.texte === 'La ganse a lâché après trois semaines'));

  // Une zone qui revient sur plusieurs produits est un défaut de méthode.
  ex('signaler_bris', { produit: 'TQ-SPORT', zone: 'Attache de ganse',
    origine: 'retour' }, cB);
  const z = D.zonesFragiles().find(x => /attache/i.test(x.zone));
  t('les zones se regroupent sans tenir compte de la casse',
    z.bris === 3 && z.produits === 2, JSON.stringify(z));
  t('une zone dit combien de signalements n\'ont pas de consigne',
    z.sans_consigne === 3);

  // Tirer une consigne rattache TOUS les bris de la même zone.
  const brisId = av.tous[0].id;
  const pointId = (() => {
    const rang = 99;
    return db.prepare(`INSERT INTO qc_points (produit_id, type, titre, cree_par, rang)
                       VALUES (?, 'probleme', ?, ?, ?)`)
      .run(pB, "Renforcer l'attache de ganse", admin.id, rang).lastInsertRowid;
  })();
  db.prepare(`UPDATE qc_bris SET point_id = ? WHERE produit_id = ? AND point_id IS NULL
                AND LOWER(zone) = LOWER(?)`)
    .run(pointId, pB, av.tous[0].zone);
  const ap = D.brisProduit(pB);
  t('une consigne rattache tous les bris de la même zone',
    ap.orphelins.length === 0 && ap.tous.every(b => b.point_id === pointId),
    JSON.stringify({ o: ap.orphelins.length }));
  t('le point sait combien de signalements l\'appuient',
    D.brisParPoint(pB)[pointId] === 2, JSON.stringify(D.brisParPoint(pB)));
  t('la zone d\'un autre produit reste orpheline',
    D.zonesFragiles().find(x => /attache/i.test(x.zone)).sans_consigne === 1);

  // L'assistant remonte le terrain avec le protocole : c'est ce qui rend la
  // réponse convaincante en atelier.
  const lu = ex('lire_qualite', { produit: 'CC-ADULTE' }, mB);
  t('lire_qualite remonte les signalements',
    lu.terrain && lu.terrain.signalements === 2, JSON.stringify(lu.terrain));
  t('...avec la consigne qui en a été tirée',
    lu.terrain.derniers.some(d => d.consigne_tiree === "Renforcer l'attache de ganse"));

  // Une non-conformité d'atelier est une observation de terrain, plus tôt.
  const itNC = db.prepare(`SELECT i.id FROM ordre_items i JOIN produits p
                           ON p.id = i.produit_id WHERE p.code = 'CC-ADULTE'`).get().id;
  db.prepare(`INSERT INTO qc_controles (item_id, point_id, verdict, note, utilisateur_id)
              VALUES (?,?,'non_conforme',?,?)`)
    .run(itNC, pointId, 'Trois pièces sur vingt', atelier.id);
  const nc = D.nonConformites();
  t('les non-conformités d\'atelier remontent avec les bris',
    nc.length === 1 && nc[0].note === 'Trois pièces sur vingt', JSON.stringify(nc.length));
  db.prepare(`INSERT INTO qc_controles (item_id, point_id, verdict, utilisateur_id)
              VALUES (?,?,'conforme',?)`).run(itNC, pointId, atelier.id);
  t('une non-conformité corrigée sort de la liste des ouvertes',
    D.nonConformites().length === 0);

  db.prepare(`DELETE FROM qc_bris`).run();
  db.prepare(`DELETE FROM qc_controles`).run();
  db.prepare(`DELETE FROM qc_points WHERE id = ?`).run(pointId);
}

// ------------------ conformité dimensionnelle : une mesure par taille
{
  const D = require('../db.js');
  const cM = tour(admin);

  // Lecture d'un tableau recopié d'un chiffrier
  const t1 = D.lireTableauTailles(
    'Homme / S = 104 ± 1,5\nHomme / M = 112 +/- 1.5\nL = 120\nXL: 128 ± 2\n\nn importe quoi');
  t('un tableau de tailles se lit ligne par ligne',
    t1.lignes.length === 4 && t1.rejets.length === 1, JSON.stringify(t1.rejets));
  t('« ± » et « +/- » disent la même chose',
    t1.lignes[0].tolerance === '1,5' && t1.lignes[1].tolerance === '1.5');
  t('« : » vaut « = »', t1.lignes[3].taille === 'XL' && t1.lignes[3].valeur === '128');
  t('une taille sans tolérance reste valide', t1.lignes[2].tolerance === '');
  t('une ligne sans séparateur est rejetée, pas devinée',
    t1.rejets[0] === 'n importe quoi');
  t('un tableau vide ne produit rien',
    D.lireTableauTailles('').lignes.length === 0
      && D.lireTableauTailles(null).lignes.length === 0);

  // Une mesure de taille s'échantillonne sur les pièces de CETTE taille
  const oM = ex('creer_ordre', { titre: 'Lot manteaux' }, cM);
  ex('creer_produit', { code: 'MTX', nom: 'Manteau test' }, cM);
  ex('ajouter_item', { ordre: oM.numero, produit: 'MTX', quantite: 150 }, cM);
  const itM = db.prepare(`SELECT i.id FROM ordre_items i JOIN produits p
                          ON p.id = i.produit_id WHERE p.code = 'MTX'`).get().id;
  const pM = db.prepare(`SELECT id FROM produits WHERE code = 'MTX'`).get().id;
  const v = db.prepare(`INSERT INTO item_variantes (item_id, groupe, nom, quantite, rang)
                        VALUES (?,?,?,?,?)`);
  v.run(itM, 'Homme', 'L', 34, 1);
  v.run(itM, 'Homme', 'M', 25, 2);
  v.run(itM, 'Femme', 'XS', 3, 3);

  const mes = db.prepare(`INSERT INTO qc_points (produit_id, type, titre, variante,
                valeur, unite, ech_type, ech_valeur)
                VALUES (?,'mesure','Tour de poitrine',?,?,'cm','ratio',10)`);
  mes.run(pM, 'Homme / L', '120');
  mes.run(pM, 'M', '112');            // le lot écrit « Homme / M » : doit matcher
  mes.run(pM, 'Homme / 4XL', '150');  // taille absente du lot
  mes.run(pM, '', '82');              // toutes tailles

  const ck = D.checklistItem(itM);
  const parVar = Object.fromEntries(ck.points.map(x => [x.variante || '(toutes)', x]));

  t('une taille absente du lot n\'est pas exigée',
    !('Homme / 4XL' in parVar), Object.keys(parVar).join(' | '));
  t('« M » reconnaît « Homme / M » du lot', 'M' in parVar);
  t('une mesure de taille porte sur les pièces de cette taille',
    parVar['Homme / L'].portee === 34 && parVar['M'].portee === 25,
    `${parVar['Homme / L'].portee} / ${parVar['M'].portee}`);
  t('...et son échantillon se calcule là-dessus, pas sur le lot',
    parVar['Homme / L'].ech.pieces === 4 && parVar['M'].ech.pieces === 3,
    `${parVar['Homme / L'].ech.pieces} / ${parVar['M'].ech.pieces}`);
  t('une mesure sans taille porte sur tout le lot',
    parVar['(toutes)'].portee === 150 && parVar['(toutes)'].ech.pieces === 15);
  t('une taille à trois pièces demande quand même une vérification', (() => {
    mes.run(pM, 'Femme / XS', '88');
    const c2 = D.checklistItem(itM);
    const xs = c2.points.find(x => x.variante === 'Femme / XS');
    return xs && xs.portee === 3 && xs.ech.pieces === 1;
  })());

  // Sans variantes déclarées, on ne peut rien écarter : tout reste exigé.
  ex('creer_produit', { code: 'MTX2', nom: 'Sans variantes' }, cM);
  ex('ajouter_item', { ordre: oM.numero, produit: 'MTX2', quantite: 90 }, cM);
  const it2 = db.prepare(`SELECT i.id FROM ordre_items i JOIN produits p
                          ON p.id = i.produit_id WHERE p.code = 'MTX2'`).get().id;
  db.prepare(`INSERT INTO qc_points (produit_id, type, titre, variante, valeur,
              ech_type, ech_valeur) VALUES ((SELECT id FROM produits WHERE code='MTX2'),
              'mesure','Tour de tête','L','58','ratio',10)`).run();
  const ck2 = D.checklistItem(it2);
  t('sans répartition connue, aucune taille n\'est écartée',
    ck2.total === 1 && ck2.points[0].portee === 90,
    JSON.stringify({ t: ck2.total, p: ck2.points[0] && ck2.points[0].portee }));

  db.prepare(`DELETE FROM qc_points WHERE produit_id IN (?, (SELECT id FROM produits WHERE code='MTX2'))`)
    .run(pM);
}

// ------------------------------------- la checklist obligatoire d'un lot
// Un protocole qu'on peut ignorer n'est pas un protocole. Le verrou vit dans
// db.js et les DEUX chemins d'écriture y passent — c'est ça qu'on vérifie.
{
  const D = require('../db.js');
  const cK = tour(admin);

  const oQ = ex('creer_ordre', { titre: 'Lot de contrôle' }, cK);
  ex('creer_produit', { code: 'CK-TEST', nom: 'Produit contrôlé' }, cK);
  ex('ajouter_item', { ordre: oQ.numero, produit: 'CK-TEST', quantite: 100 }, cK);
  const itId = db.prepare(`SELECT i.id FROM ordre_items i JOIN produits p
                           ON p.id = i.produit_id WHERE p.code = 'CK-TEST'`).get().id;

  // Sans protocole, rien n'est exigé : c'est un trou, pas une permission.
  t('sans protocole, un lot peut être déclaré fini',
    D.blocageQC(itId, 100) === null);
  t('un lot sans protocole le dit au lieu d\'exiger le vide',
    D.checklistItem(itId).vide === true);

  ex('ajouter_point_qc', { produit: 'CK-TEST', volet: 'critique',
    titre: 'Presser avant l\'isolant', consequence: 'Il fond' }, cK);
  ex('ajouter_point_qc', { produit: 'CK-TEST', volet: 'mesure',
    titre: 'Tour de cou', valeur: '52', unite: 'cm' }, cK);

  t('un point non vérifié bloque le 100 %',
    Boolean(D.blocageQC(itId, 100)) && D.blocageQC(itId, 100).raison === 'restants');
  t('le blocage nomme les points qui manquent',
    D.blocageQC(itId, 100).message.includes('Tour de cou'));
  t('un avancement intermédiaire n\'est jamais bloqué',
    D.blocageQC(itId, 90) === null && D.blocageQC(itId, 10) === null);

  // Le chemin de l'assistant passe par le même verrou.
  const refus = ex('maj_avancement', { ordre: oQ.numero, produit: 'CK-TEST',
    valeur: 100 }, cK);
  t('l\'assistant ne contourne pas le contrôle qualité',
    Boolean(refus.erreur) && refus.erreur.includes('contrôle qualité'),
    JSON.stringify(refus));
  t('...et l\'avancement n\'a pas bougé',
    db.prepare(`SELECT avancement a FROM ordre_items WHERE id = ?`).get(itId).a !== 100);
  t('l\'assistant peut toujours avancer sans finir',
    ex('maj_avancement', { ordre: oQ.numero, produit: 'CK-TEST', valeur: 90 }, cK).ok === true);

  const pts = db.prepare(`SELECT q.id FROM qc_points q JOIN produits p ON p.id = q.produit_id
                          WHERE p.code = 'CK-TEST' ORDER BY q.id`).all().map(x => x.id);
  const cocher = db.prepare(`INSERT INTO qc_controles (item_id, point_id, verdict,
                             utilisateur_id) VALUES (?,?,?,?)`);

  cocher.run(itId, pts[0], 'conforme', admin.id);
  t('un point sur deux ne suffit pas', D.blocageQC(itId, 100).restants === 1);

  cocher.run(itId, pts[1], 'non_conforme', admin.id);
  t('une non-conformité bloque, et se distingue d\'un oubli',
    D.blocageQC(itId, 100).raison === 'ecart',
    D.blocageQC(itId, 100).raison);

  cocher.run(itId, pts[1], 'conforme', admin.id);
  t('écart corrigé, le lot passe', D.blocageQC(itId, 100) === null);
  t('l\'assistant peut alors déclarer le lot fini',
    ex('maj_avancement', { ordre: oQ.numero, produit: 'CK-TEST', valeur: 100 }, cK).ok === true);

  // Journal, pas état : une non-conformité corrigée reste visible.
  t('l\'historique des contrôles est conservé',
    db.prepare(`SELECT COUNT(*) n FROM qc_controles WHERE item_id = ?`).get(itId).n === 3);
  t('le verdict courant est le dernier, pas le premier',
    D.checklistItem(itId).points[1].verdict === 'conforme');

  // Dynamique : un point appris en cours de route s'applique aux lots ouverts.
  ex('ajouter_point_qc', { produit: 'CK-TEST', volet: 'probleme',
    titre: 'Appris en cours de route' }, cK);
  t('un point ajouté après coup rebloque un lot déjà fini',
    Boolean(D.blocageQC(itId, 100)),
    'checklist : ' + JSON.stringify(D.checklistItem(itId).restants.map(x => x.titre)));

  // L'état rendu à la page de l'ordre
  const etat = D.etatQCOrdre(db.prepare(
    `SELECT ordre_id FROM ordre_items WHERE id = ?`).get(itId).ordre_id);
  t('la page de l\'ordre reçoit l\'état de chaque item',
    etat[itId].total === 3 && etat[itId].verifies === 2 && etat[itId].complet === false,
    JSON.stringify(etat[itId]));
}

// ------------------------------------------------------------------- tâches
// Le seul module où l'atelier a exactement les mêmes droits que Québec : les
// demandes vont dans les deux sens.
{
  const S = require('../salutation.js');
  const D = require('../db.js');

  const cT = tour(admin), mT = tour(atelier);
  const t1 = ex('creer_tache', { titre: 'Vérifier le stock de molleton noir',
    pour: 'Montassar', echeance: '2026-09-30' }, cT);
  t('Québec peut demander quelque chose à l\'atelier',
    t1.ok && t1.pour === 'Montassar', JSON.stringify(t1));

  const t2 = ex('creer_tache', { titre: 'Confirmer la quantité de bandeaux',
    pour: 'Claudia' }, mT);
  t('l\'atelier peut demander quelque chose à Québec',
    t2.ok === true, JSON.stringify(t2));

  const t3 = ex('creer_tache', { titre: 'Chronométrer le chandail', pour: 'moi' }, cT);
  t('« moi » se résout à l\'utilisateur connecté',
    t3.ok && t3.pour === 'Claudia', JSON.stringify(t3));

  const sansPorteur = ex('creer_tache', { titre: 'Sourcer le velcro 2,5 cm' }, cT);
  t('une tâche sans destinataire reste sans porteur, pas refusée',
    sansPorteur.ok && sansPorteur.pour === 'personne', JSON.stringify(sansPorteur));

  const fantome = ex('creer_tache', { titre: 'X', pour: 'Jean-Guy' }, cT);
  t('un destinataire inconnu est refusé, avec la liste de l\'équipe',
    Boolean(fantome.erreur) && fantome.erreur.includes('Claudia'), JSON.stringify(fantome));

  const mauvaiseDate = ex('creer_tache', { titre: 'Y', echeance: '30 septembre' }, cT);
  t('une échéance mal formée est refusée', Boolean(mauvaiseDate.erreur));

  t('une tâche vide est refusée', Boolean(ex('creer_tache', { titre: '  ' }, cT).erreur));

  // Lecture
  const mesTaches = ex('lister_taches', {}, mT);
  t('l\'atelier voit ce qu\'on lui a demandé',
    mesTaches.nombre === 1 && mesTaches.taches[0].titre.includes('molleton'),
    JSON.stringify(mesTaches));
  const demandees = ex('lister_taches', { demandees: true }, mT);
  t('on peut lister ce qu\'on a demandé plutôt que ce qu\'on doit faire',
    demandees.nombre === 1 && demandees.sens === 'demandées par', JSON.stringify(demandees));

  // Terminer
  const fini = ex('terminer_tache', { tache: 'molleton' }, mT);
  t('l\'atelier termine sa tâche', fini.ok === true, JSON.stringify(fini));
  t('la tâche finie sort de la liste à faire',
    ex('lister_taches', {}, mT).nombre === 0);
  t('la tâche finie se retrouve dans les faites',
    ex('lister_taches', { faites: true }, mT).nombre === 1);

  // On ne termine pas la tâche d'un tiers par ressemblance de titre.
  ex('creer_tache', { titre: 'Recompter les semelles 9F+', pour: 'Claudia' }, cT);
  t('on ne peut pas terminer une tâche qui ne nous concerne pas',
    Boolean(ex('terminer_tache', { tache: 'semelles 9F' }, mT).erreur));

  t('un titre ambigu est refusé plutôt que deviné', (() => {
    ex('creer_tache', { titre: 'Relancer BMB sur les prix', pour: 'moi' }, cT);
    ex('creer_tache', { titre: 'Relancer BMB sur les délais', pour: 'moi' }, cT);
    return Boolean(ex('terminer_tache', { tache: 'Relancer BMB' }, cT).erreur);
  })());

  // Compteur et équipe
  t('le compteur ne compte que ce qui est à faire',
    D.compteTaches(admin.id).n === ex('lister_taches', {}, cT).nombre);
  t('une échéance dépassée est comptée à part', (() => {
    ex('creer_tache', { titre: 'En retard', pour: 'moi', echeance: '2020-01-01' }, cT);
    return D.compteTaches(admin.id).retard === 1;
  })());
  t('l\'équipe ne liste que les comptes actifs', D.equipe().length === 2);

  // --- salutation
  const midiTunis = new Date('2026-09-15T10:00:00Z');   // 11 h à Tunis, 6 h à Québec
  t('le fuseau suit le rôle, pas le serveur',
    S.heureLocale('atelier', midiTunis) === 11 && S.heureLocale('admin', midiTunis) === 6,
    S.heureLocale('atelier', midiTunis) + ' / ' + S.heureLocale('admin', midiTunis));
  t('à la même seconde, l\'atelier et Québec ne reçoivent pas le même bonjour',
    S.saluer({ user: atelier, maintenant: midiTunis }).bonjour !==
    S.saluer({ user: admin, maintenant: midiTunis }).bonjour);
  t('« Bon matin » est bien du matin, chez celui qui lit',
    S.saluer({ user: atelier, maintenant: midiTunis }).bonjour === 'Bon matin Montassar');
  t('le prénom seul, pas le nom complet',
    S.prenom('Montassar Bel Hadj Amor') === 'Montassar');
  t('sans rien à signaler, la formule ouvre la conversation',
    S.saluer({ user: admin, maintenant: midiTunis }).suite === 'Des questions ?');
  t('ce qui est en retard passe avant le nombre de tâches',
    S.saluer({ user: admin, taches: { n: 5, retard: 2 }, maintenant: midiTunis })
      .suite.includes('dépassé'));
  t('une seule tâche se dit au singulier',
    S.saluer({ user: admin, taches: { n: 1, retard: 0 }, maintenant: midiTunis })
      .suite.startsWith('Une tâche'));
  t('sans tâche, c\'est l\'échéance qui parle',
    S.saluer({ user: admin, taches: { n: 0, retard: 0 }, echeance: '2026-09-16',
               maintenant: midiTunis }).suite.includes('demain'));
  for (const [h, attendu] of [[7, 'Bon matin'], [13, 'Bon après-midi'],
                              [20, 'Bonsoir'], [2, 'Bonne nuit']])
    t(`${h} h donne « ${attendu} »`, S.moment(h) === attendu, S.moment(h));
}

// ---------------------------- le nom d'usage l'emporte sur le titre Shopify
{
  const V = require('../vues.js');
  const pid = db.prepare(`SELECT id FROM produits WHERE code = 'CC-ADULTE'`).get().id;
  const avant = db.prepare(`SELECT nom, nom_court FROM produits WHERE id = ?`).get(pid);
  db.prepare(`UPDATE produits SET nom = ?, nom_court = ? WHERE id = ?`)
    .run("Manteau hivernal isolé à l'asclépiade", 'Manteau 3 saisons', pid);

  const p = db.prepare(`SELECT * FROM produits WHERE id = ?`).get(pid);
  const html = V.vueProduit({ user: admin, p, photos: [], materiaux: [],
    patrons: [], ordres: [], qc: null, charte: null, bris: null });
  t('la fiche titre avec le nom d\'usage',
    html.includes('<h1>Manteau 3 saisons</h1>'));
  // Le gabarit échappe l'apostrophe : on compare ce qui est réellement servi.
  t('le titre Shopify reste visible sous le code',
    html.includes('vendu sous « Manteau hivernal isolé à l&#39;asclépiade »'));

  // Sans nom court — un produit ajouté à la main — on retombe sur `nom`.
  db.prepare(`UPDATE produits SET nom_court = '' WHERE id = ?`).run(pid);
  const nu = V.vueProduit({ user: admin,
    p: db.prepare(`SELECT * FROM produits WHERE id = ?`).get(pid),
    photos: [], materiaux: [], patrons: [], ordres: [], qc: null,
    charte: null, bris: null });
  t('sans nom d\'usage, le titre Shopify sert de nom',
    nu.includes('<h1>Manteau hivernal isolé à l&#39;asclépiade</h1>'));
  t('...et la mention « vendu sous » ne s\'affiche pas',
    !nu.includes('vendu sous'));

  // Les listes prennent le nom d'usage par la requête, pas par le gabarit.
  db.prepare(`UPDATE produits SET nom_court = 'Manteau 3 saisons' WHERE id = ?`).run(pid);
  const D = require('../db.js');
  const l = D.listeFabrication().find(x => x.produit_id === pid);
  if (l) t('la liste de fabrication porte le nom d\'usage',
    l.nom === 'Manteau 3 saisons', l.nom);

  db.prepare(`UPDATE produits SET nom = ?, nom_court = ? WHERE id = ?`)
    .run(avant.nom, avant.nom_court, pid);
}

// ---------------------------- la liste de production montre les variantes
{
  const V = require('../vues.js');
  const D = require('../db.js');
  const it = db.prepare(`SELECT id, produit_id, quantite FROM ordre_items LIMIT 1`).get();
  db.prepare(`DELETE FROM item_variantes WHERE item_id = ?`).run(it.id);
  const pose = (groupe, nom, q, rang) => db.prepare(
    `INSERT INTO item_variantes (item_id, groupe, nom, quantite, rang)
     VALUES (?,?,?,?,?)`).run(it.id, groupe, nom, q, rang);

  // Un croisement réel : deux coupes, des tailles différentes de chaque côté.
  pose('Homme', 'S', 8, 1); pose('Homme', 'M', 25, 2); pose('Homme', 'L', 34, 3);
  pose('Femme', 'XS', 3, 4); pose('Femme', 'S', 5, 5); pose('Femme', 'M', 16, 6);
  db.prepare(`UPDATE ordre_items SET quantite = 91 WHERE id = ?`).run(it.id);

  const v = D.variantesItem(it.id);
  const html = V.vuePriorites({ user: admin, lignes: [{
    id: it.id, produit_id: it.produit_id, code: 'X', nom: 'X', famille: 'hiver',
    note: '', restant: 91, quantite: 91, avancement: 0, echeance: null,
    jours: null, en_retard: false, priorite: 'normale', ordre_id: 1,
    numero: 'OP-1', ordre_titre: 'T', variantes: v }] });

  t('la liste n\'a plus de repli', !html.includes('<details class="rep'));
  t('chaque variante montre sa quantité',
    html.includes('>S</span><b>8</b>') || html.includes('S</span><b>8</b>'),
    'la pastille S doit porter 8');
  t('les six variantes sont là',
    (html.match(/class="ch ch-/g) || []).length === 6,
    String((html.match(/class="ch ch-/g) || []).length));
  t('le groupe porte son total', html.includes('Homme') && html.includes('>67<'));
  t('les deux axes sont nommés d\'après les étiquettes',
    html.includes('2 coupes × 4 tailles'),
    (html.match(/rep-quoi">([^<]+)</) || [])[1]);

  // Sans groupe, un seul axe et pas de « × ».
  db.prepare(`DELETE FROM item_variantes WHERE item_id = ?`).run(it.id);
  pose('', 'Noir', 60, 1); pose('', 'Rouge', 31, 2);
  const seul = V.vuePriorites({ user: admin, lignes: [{
    id: it.id, produit_id: it.produit_id, code: 'X', nom: 'X', famille: 'hiver',
    note: '', restant: 91, quantite: 91, avancement: 0, echeance: null,
    jours: null, en_retard: false, priorite: 'normale', ordre_id: 1,
    numero: 'OP-1', ordre_titre: 'T', variantes: D.variantesItem(it.id) }] });
  t('un seul axe se dit sans croisement',
    seul.includes('2 coloris') && !seul.includes('×'),
    (seul.match(/rep-quoi">([^<]+)</) || [])[1]);

  db.prepare(`DELETE FROM item_variantes WHERE item_id = ?`).run(it.id);
}

// ---------------------------- la charte produits sur la fiche
{
  const D = require('../db.js');
  const V = require('../vues.js');
  const pid = db.prepare(`SELECT id FROM produits WHERE code = 'CC-ADULTE'`).get().id;

  db.prepare(`DELETE FROM charte WHERE produit_id = ?`).run(pid);
  const pose = (section, texte, rang) => db.prepare(
    `INSERT INTO charte (produit_id, section, texte, rang, source)
     VALUES (?,?,?,?,'essai')`).run(pid, section, texte, rang);

  t('sans charte, la fiche le dit', D.charteProduit(pid).vide === true);

  pose('matiere', 'Extérieur : viscose', 1);
  pose('isolant', 'Vegeto 150 g', 2);
  pose('garniture', 'Cord-lock + bille', 3);
  const ch = D.charteProduit(pid);
  t('la charte se groupe par section',
    ch.total === 3 && ch.par.matiere.length === 1 && ch.par.isolant.length === 1,
    JSON.stringify(ch.par));
  t('les sections vides restent des tableaux',
    Array.isArray(ch.par.parametre) && ch.par.parametre.length === 0);

  // Une section inventée doit être refusée par la base, pas rangée ailleurs.
  let refuse = false;
  try { pose('couleur', 'Rouge', 4); } catch { refuse = true; }
  t('une section inconnue est refusée', refuse);

  const html = V.vueProduit({ user: admin, p: db.prepare(
      `SELECT * FROM produits WHERE id = ?`).get(pid),
    photos: [], materiaux: [], patrons: [], ordres: [],
    qc: D.protocole(pid), charte: ch, bris: D.brisProduit(pid) });
  t('la fiche montre la charte', html.includes('Charte produit')
    && html.includes('Vegeto 150 g'));
  t('le grammage est dans sa propre section', html.includes('ch-isolant'));

  // Les trois pages du volet se retrouvent sur la fiche.
  t('la fiche porte la sous-navigation du volet',
    html.includes('sous-nav') && html.includes('/qualite') && html.includes('/mur'));
  t('la page ouverte est marquée dans la sous-navigation',
    V.sousNavProduits('mur').includes('class="on" aria-current="page"'));

  db.prepare(`DELETE FROM charte WHERE source = 'essai'`).run();
}

// ---------------------------- le schéma d'un point de mesure
{
  const D = require('../db.js');
  const V = require('../vues.js');
  const pid = db.prepare(`SELECT id FROM produits WHERE code = 'CC-ADULTE'`).get().id;
  const pose = (url) => db.prepare(
    `INSERT INTO qc_points (produit_id, type, titre, valeur, unite, schema_url, source)
     VALUES (?, 'mesure', 'Dimensions finales', '24', 'cm', ?, 'essai')`).run(pid, url);

  pose('https://drive.google.com/file/d/SCHEMA1/view');
  const q = D.protocole(pid, { generalCompris: false }).par.mesure
    .find(x => x.source === 'essai');
  t('le schéma est retenu sur le point', q.schema_url.includes('SCHEMA1'));

  const html = V.vueProtocole({ user: admin, p: db.prepare(
      `SELECT * FROM produits WHERE id = ?`).get(pid),
    proto: D.protocole(pid), photos: [], bris: D.brisProduit(pid),
    appuis: {}, couverture: null });
  t('le protocole demande le schéma redimensionné',
    html.includes('lh3.googleusercontent.com/d/SCHEMA1=w320'), 'w320 attendu');
  t('le lien ouvre la pleine taille',
    html.includes('href="https://drive.google.com/file/d/SCHEMA1/view"'));

  // Une « data: » URI ferait porter le dessin entier à chaque page servie.
  db.prepare(`UPDATE qc_points SET schema_url = 'data:image/png;base64,iVBOR'
              WHERE source = 'essai'`).run();
  const sale = V.vueProtocole({ user: admin, p: db.prepare(
      `SELECT * FROM produits WHERE id = ?`).get(pid),
    proto: D.protocole(pid), photos: [], bris: D.brisProduit(pid),
    appuis: {}, couverture: null });
  t('un schéma en « data: » est écarté', !sale.includes('data:image'));

  db.prepare(`DELETE FROM qc_points WHERE source = 'essai'`).run();
}

// ---------------------------- les zones d'un produit se comptent
{
  const D = require('../db.js');
  const pid = db.prepare(`SELECT id FROM produits WHERE code = 'CC-ADULTE'`).get().id;
  const pose = (zone) => db.prepare(
    `INSERT INTO qc_bris (produit_id, zone, origine, texte) VALUES (?,?,'client','x')`)
    .run(pid, zone);
  pose('Couture de bretelle'); pose('couture de bretelle'); pose('Fond du sac');
  const b = D.brisProduit(pid);
  t('les zones sont comptées et triées',
    b.zones[0].zone === 'couture de bretelle' && b.zones[0].n === 2,
    JSON.stringify(b.zones));
  t('la casse ne fait pas deux zones', b.zones.length === 2);
  db.prepare(`DELETE FROM qc_bris WHERE produit_id = ?`).run(pid);
}

// ---------------------------- plusieurs clichés d'un même bris
{
  const V = require('../vues.js');
  // Trois photos de la même couture : de loin, de près, retournée. Le client
  // les envoie ensemble, elles doivent rester ensemble.
  const b = { id: 1, origine: 'client', zone: 'couture de bretelle',
    texte: 'La bretelle s\'est décousue', survenu_le: '2026-07-04',
    photo_url: 'https://drive.google.com/file/d/AAA1/view '
             + 'https://drive.google.com/file/d/BBB2/view '
             + 'https://drive.google.com/file/d/CCC3/view' };
  const html = V.vueMur({ user: admin, groupes: [
    { id: 1, code: 'GL-30', nom: 'Sac à dos glacière', bris: [b], photos: 1,
      sansConsigne: 1, zones: [] }] });

  t('la première photo est demandée en grand',
    html.includes('lh3.googleusercontent.com/d/AAA1=w640'));
  t('les autres suivent en vignettes',
    html.includes('lh3.googleusercontent.com/d/BBB2=w160')
    && html.includes('lh3.googleusercontent.com/d/CCC3=w160'));
  t('aucune photo n\'est servie en taille d\'origine',
    !/lh3\.googleusercontent\.com\/d\/[A-Z0-9]+["' ]/.test(html));

  // Une adresse unique, le cas courant, ne doit pas produire de bande vide.
  const seule = V.vueMur({ user: admin, groupes: [
    { id: 1, code: 'GL-30', nom: 'Sac', photos: 1, sansConsigne: 0, zones: [],
      bris: [{ ...b, photo_url: 'https://drive.google.com/file/d/AAA1/view' }] }] });
  t('une seule photo ne crée pas de bande de vignettes',
    !seule.includes('mur-plus'));

  // Une « data: » URI ferait porter l'image entière à chaque page servie.
  const sale = V.vueMur({ user: admin, groupes: [
    { id: 1, code: 'GL-30', nom: 'Sac', photos: 0, sansConsigne: 0, zones: [],
      bris: [{ ...b, photo_url: 'data:image/png;base64,iVBOR' }] }] });
  t('une « data: » URI est écartée du rendu', !sale.includes('data:image'));
}

const inconnu = ex('outil_qui_nexiste_pas', {}, c);
t('outil inconnu signalé sans planter', Boolean(inconnu.erreur));

console.log(`\n  ${ok} réussites, ${ko} échecs\n`);
try { require('node:fs').rmSync(process.env.MRP_DB, { force: true }); } catch {}
process.exit(ko ? 1 : 0);
