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
  const parCout = C.tempsUnitaire('GANTS-MAGIQUES', chrono, couts);
  t('un temps déduit vient du coût divisé par le taux horaire',
    parCout.source === 'cout'
      && parCout.secondes === Math.round((3 / C.TAUX_HORAIRE) * 3600),
    JSON.stringify(parCout));

  const parChrono = C.tempsUnitaire('CACHE-COU', chrono, couts);
  t('le chronomètre passe avant le coût',
    parChrono.source === 'chrono' && parChrono.secondes === 1030);

  t('un produit sans mesure ni coût vaut zéro, et le dit',
    C.tempsUnitaire('PRODUIT-QUI-NEXISTE-PAS', chrono, couts).source === 'aucune');

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

  t('la charge est la même quelle que soit la capacité',
    Math.round(cal4.heuresTotal) === Math.round(cal8.heuresTotal)
      && Math.round(cal4.heuresTotal) === Math.round(1030 * 1000 / 3600),
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
    Math.abs(inc.bas - (1030 * 50) / 3600) < 1e-6, String(inc.bas));
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

const inconnu = ex('outil_qui_nexiste_pas', {}, c);
t('outil inconnu signalé sans planter', Boolean(inconnu.erreur));

console.log(`\n  ${ok} réussites, ${ko} échecs\n`);
try { require('node:fs').rmSync(process.env.MRP_DB, { force: true }); } catch {}
process.exit(ko ? 1 : 0);
