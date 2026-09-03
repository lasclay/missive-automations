/**
 * tests/calendrier.js — l'étalement du plan sur le calendrier de l'atelier.
 *
 * C'est le calcul le plus facile à casser sans le voir : une barre décalée
 * d'un jour ne saute pas aux yeux, et une journée en surcapacité ressemble à
 * une bonne nouvelle. On vérifie donc les invariants plutôt que des dates :
 *
 *   · aucune journée ne dépasse la capacité disponible ;
 *   · aucun travail un dimanche, un jour chômé, ou pendant une fermeture ;
 *   · les tâches se suivent sans trou ;
 *   · fermer l'atelier N jours ouvrés recule la fin d'exactement N jours
 *     ouvrés — c'est le domino, et c'est la promesse faite à l'écran.
 *
 *   node tests/calendrier.js
 */
'use strict';
process.env.MRP_DB = process.env.MRP_DB
  || require('node:path').join(require('node:os').tmpdir(), `mrp-cal-${process.pid}.db`);

const { db, listeFabrication } = require('../db.js');
const C = require('../charge.js');

let ok = 0, ko = 0;
const t = (nom, cond, detail = '') => {
  if (cond) { ok++; console.log(`  [OK ] ${nom}`); }
  else { ko++; console.log(`  [KO ] ${nom}${detail ? ' — ' + detail : ''}`); }
};

// ------------------------------------------------------------------- décor
//
// `calendrier()` prend ses lignes en argument : on les fabrique à la main
// plutôt que par la base. Deux raisons — le test ne dépend pas de l'état du
// plan importé, et surtout il faut des CODES dont le temps unitaire est connu.
// Un code inventé n'a aucun temps, donc zéro heure, donc zéro journée
// occupée : les invariants passeraient à vide en annonçant tout vert.
const LIGNES = [
  { id: 1, produit_id: 1, code: 'CACHE-COU',  nom: 'Cache-cou',  famille: 'hiver',
    restant: 1000, quantite: 1000, avancement: 0 },
  { id: 2, produit_id: 2, code: 'TUQUE-SPORT', nom: 'Tuque sport', famille: 'hiver',
    restant: 800, quantite: 800, avancement: 0 },
  { id: 3, produit_id: 3, code: 'GLACIERE',   nom: 'Glacière',   famille: 'isotherme',
    restant: 300, quantite: 300, avancement: 0 },
];

C.poserCapacite({ postes: 2, heures_jour: 8, jours_semaine: 5 });
// Un lundi, pour que le décor ne dépende pas du jour où le test tourne.
C.poserDepart('2026-09-07');

const cap = C.capacite();
const lignes = () => LIGNES;

// Le décor ne vaut rien si les temps sont inconnus : on le vérifie d'abord.
t('le décor porte des temps unitaires connus',
  LIGNES.every(l => C.tempsUnitaire(l.code).secondes > 0),
  LIGNES.map(l => `${l.code}=${C.tempsUnitaire(l.code).source}`).join(' '));
t('le décor produit donc des heures',
  C.calendrier(LIGNES).heuresTotal > 0);
const jourMs = 864e5;
const jourDe = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();

/** Les invariants qu'aucun calendrier ne doit violer, quelle que soit l'entrée. */
function invariants(cal, etiquette) {
  const jours = [...cal.parJour.keys()].sort();
  t(`${etiquette} : aucune journée en surcapacité`,
    jours.every(j => cal.parJour.get(j).reduce((n, x) => n + x.heures, 0)
                     <= cal.capaciteJour + 1e-6));
  t(`${etiquette} : aucun dimanche occupé`,
    jours.every(j => jourDe(j) !== 0));
  t(`${etiquette} : aucun jour hors semaine de travail`,
    jours.every(j => jourDe(j) <= cap.jours_semaine));
  t(`${etiquette} : aucun jour de fermeture occupé`,
    jours.every(j => !cal.fermes.has(j)));

  // Pas de trou : entre deux journées occupées consécutives, tout ce qui est
  // sauté doit être chômé ou fermé. Une journée ouvrée vide au milieu du plan
  // serait de la capacité perdue, donc un défaut.
  let creux = null;
  for (let i = 1; i < jours.length && !creux; i++) {
    for (let d = new Date(new Date(jours[i - 1] + 'T00:00:00Z').getTime() + jourMs);
         d < new Date(jours[i] + 'T00:00:00Z'); d = new Date(d.getTime() + jourMs)) {
      const iso = d.toISOString().slice(0, 10);
      const js = d.getUTCDay();
      const chome = js === 0 || js > cap.jours_semaine;
      if (!chome && !cal.fermes.has(iso)) { creux = iso; break; }
    }
  }
  t(`${etiquette} : aucune journée ouvrée laissée vide`, creux === null,
    creux ? `${creux} est ouvrée et vide` : '');

  // La fin d'une tâche est son dernier jour occupé, pas la position du curseur.
  const dernier = jours[jours.length - 1];
  t(`${etiquette} : la fin du plan est son dernier jour occupé`,
    cal.fin === dernier, `${cal.fin} ≠ ${dernier}`);
}

const base = C.calendrier(lignes());
t('le plan démarre à la date posée', base.debut === '2026-09-07', base.debut);
invariants(base, 'sans pause');

// Chaque tâche doit occuper au moins un jour, et ses bornes doivent tenir.
t('chaque tâche chargée porte des dates cohérentes',
  base.taches.filter(x => x.heures > 0).every(x =>
    x.debut <= x.fin && x.jours >= 1));

/* ---------------------------------------------------- le domino, mesuré */

const ouvres = (du, au) => C.joursOuvres(du, au, cap, C.joursEnPause());
const finBase = base.fin;

// Une semaine complète de fermeture, du lundi au vendredi : 5 jours ouvrés.
const pz = C.poserPause({ debut: '2026-09-14', fin: '2026-09-18',
                          motif: 'Congés' });
t('une pause se pose', pz.ok === true);

const apres = C.calendrier(lignes());
invariants(apres, 'avec pause');

// La mesure du domino : la fin doit reculer d'exactement les jours ouvrés
// retirés, ni plus ni moins.
const perdus = 5;
const finAttendue = (() => {
  // on avance de `perdus` jours ouvrés après l'ancienne fin
  let d = new Date(finBase + 'T00:00:00Z'), n = 0;
  while (n < perdus) {
    d = new Date(d.getTime() + jourMs);
    const j = d.getUTCDay();
    if (j !== 0 && j <= cap.jours_semaine) n++;
  }
  return d.toISOString().slice(0, 10);
})();
t('fermer 5 jours ouvrés recule la fin de 5 jours ouvrés',
  apres.fin === finAttendue, `${apres.fin} au lieu de ${finAttendue}`);
t('le début ne bouge pas : la pause est après lui',
  apres.debut === base.debut);

// Retirer la pause doit rendre exactement le plan d'avant : le calendrier est
// un calcul, pas un état qui dérive.
C.retirerPause(pz.id);
const rendu = C.calendrier(lignes());
t('retirer la pause rend exactement le plan d\'avant',
  rendu.fin === finBase && rendu.debut === base.debut,
  `${rendu.debut} → ${rendu.fin}`);

// Une pause qui ne tombe que le week-end ne coûte rien.
const we = C.poserPause({ debut: '2026-09-12', fin: '2026-09-13', motif: 'week-end' });
t('une pause en fin de semaine ne décale rien',
  C.calendrier(lignes()).fin === finBase);
C.retirerPause(we.id);

/* ------------------------------------------------------ la date de départ */

C.poserDepart('2026-10-05');                       // un lundi, quatre semaines plus tard
const tard = C.calendrier(lignes());
t('déplacer le départ décale tout le plan', tard.debut === '2026-10-05');
t('le plan garde sa durée en jours ouvrés',
  ouvres(tard.debut, tard.fin) === ouvres(base.debut, finBase),
  `${ouvres(tard.debut, tard.fin)} vs ${ouvres(base.debut, finBase)}`);

// Un départ dans le passé est une décision qu'on garde, mais on ne produit
// pas avant aujourd'hui.
C.poserDepart('2020-01-06');
const d = C.depart();
t('un départ passé est conservé tel quel', d.valeur === '2020-01-06' && d.passe);
t('mais le calcul part d\'aujourd\'hui',
  C.calendrier(lignes()).debut >= new Date().toISOString().slice(0, 10));

C.poserDepart('');
t('vider le départ le remet à aujourd\'hui', C.depart().defaut === true);

// Un départ un dimanche doit glisser au premier jour ouvré.
C.poserDepart('2026-09-06');                       // dimanche
t('un départ un dimanche glisse au lundi',
  C.calendrier(lignes()).debut === '2026-09-07');

/* --------------------------------------------------------- garde-fous */

// Fermer l'atelier pour toujours ne doit pas boucler à l'infini.
const eternel = C.poserPause({ debut: '2026-09-07', fin: '2031-01-01',
                               motif: 'fermeture éternelle' });
const t0 = Date.now();
const bloque = C.calendrier(lignes());
t('une fermeture sans fin ne bloque pas le calcul',
  Date.now() - t0 < 5000, `${Date.now() - t0} ms`);
t('et n\'invente aucune journée de production',
  [...bloque.parJour.keys()].every(k => !bloque.fermes.has(k)));
C.retirerPause(eternel.id);

// joursOuvres doit déduire les fermetures, sinon le verdict « ça rentre » ment.
const p3 = C.poserPause({ debut: '2026-09-14', fin: '2026-09-18', motif: 'x' });
t('joursOuvres déduit les fermetures',
  C.joursOuvres('2026-09-07', '2026-09-21', cap, C.joursEnPause())
  === C.joursOuvres('2026-09-07', '2026-09-21', cap, new Map()) - 5);
C.retirerPause(p3.id);

// Une pause aux dates illisibles est refusée plutôt que stockée de travers.
t('des dates illisibles sont refusées',
  Boolean(C.poserPause({ debut: 'bientôt', fin: '2026-10-01' }).erreur));
t('une fin avant le début est refusée',
  Boolean(C.poserPause({ debut: '2026-10-10', fin: '2026-10-01' }).erreur));
t('une pause d\'un seul jour est acceptée sans « au »',
  (() => { const r = C.poserPause({ debut: '2026-12-24', motif: 'Noël' });
           if (!r.ok) return false;
           const x = C.pauses().find(y => y.id === r.id);
           C.retirerPause(r.id);
           return x.debut === x.fin; })());

console.log(`\n  ${ok} vérifications, ${ko} échec(s).`);
process.exit(ko ? 1 : 0);
