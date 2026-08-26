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
  t('la vue reçoit les quatre volets, même vides',
    Object.keys(proto.par).length === 4 && Array.isArray(proto.par.cyclage));
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

const inconnu = ex('outil_qui_nexiste_pas', {}, c);
t('outil inconnu signalé sans planter', Boolean(inconnu.erreur));

console.log(`\n  ${ok} réussites, ${ko} échecs\n`);
try { require('node:fs').rmSync(process.env.MRP_DB, { force: true }); } catch {}
process.exit(ko ? 1 : 0);
