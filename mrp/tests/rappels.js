/**
 * Le rappel hebdomadaire de l'atelier : la tâche, la semaine, et le courriel
 * qui ne part pas tant qu'on ne l'a pas armé explicitement.
 */
'use strict';
const os = require('node:os'), path = require('node:path'), fs = require('node:fs');
process.env.MRP_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rap-')), 't.db');
delete process.env.MRP_COURRIEL_ARME;

const { db } = require('../db.js');
const R = require('../rappels.js');
const C = require('../courriel.js');

let ok = 0, ko = 0;
const t = (nom, v) => { if (v) { ok++; console.log(`  [OK ] ${nom}`); }
  else { ko++; console.log(`  [ÉCHEC] ${nom}`); } };

// ------------------------------------------------------------------ la semaine
// Le lundi est le début : un dimanche appartient à la semaine qui finit, pas à
// celle qui commence. C'est le décalage classique de (getDay() - 1).
t('lundi : la semaine commence ce jour-là', R.semaineDe('2026-09-14').lundi === '2026-09-14');
t('mercredi : on remonte au lundi',          R.semaineDe('2026-09-16').lundi === '2026-09-14');
t('dimanche : la semaine qui finit',         R.semaineDe('2026-09-20').lundi === '2026-09-14');
t('lundi suivant : nouvelle semaine',        R.semaineDe('2026-09-21').lundi === '2026-09-21');
t("l'échéance tombe le vendredi",            R.semaineDe('2026-09-14').vendredi === '2026-09-18');

// ------------------------------------------------------------------ la tâche
db.prepare(`INSERT INTO utilisateurs (courriel, mdp_hash, nom, role)
            VALUES ('m@atelier.test','x','Montassar','atelier')`).run();
db.prepare(`INSERT INTO utilisateurs (courriel, mdp_hash, nom, role)
            VALUES ('g@admin.test','x','Gabriel','admin')`).run();

const a = R.poserRappelHebdo(new Date('2026-09-16T09:00:00Z'));
t('une tâche est posée pour l\'atelier', a.poses.length === 1 && a.poses[0] === 'Montassar');
t("l'administration n'en reçoit pas",
  db.prepare(`SELECT COUNT(*) n FROM taches`).get().n === 1);

const b = R.poserRappelHebdo(new Date('2026-09-16T15:00:00Z'));
t('repasser le même jour ne crée pas de doublon',
  b.poses.length === 0 && db.prepare(`SELECT COUNT(*) n FROM taches`).get().n === 1);

const c = R.poserRappelHebdo(new Date('2026-09-22T09:00:00Z'));
t('la semaine suivante en pose une neuve',
  c.poses.length === 1 && db.prepare(`SELECT COUNT(*) n FROM taches`).get().n === 2);

const tache = db.prepare(`SELECT * FROM taches ORDER BY id LIMIT 1`).get();
t("la tâche porte une échéance au vendredi", tache.echeance === '2026-09-18');
t("elle n'est créée par personne — c'est la règle, pas quelqu'un",
  tache.cree_par === null);
t("elle dit quoi faire, pas seulement qu'il faut le faire",
  /pourcentage/i.test(tache.details));

// ------------------------------------------------------------------ le silence
t("sans aucune déclaration, le silence est signalé", R.silenceAtelier().jamais === true);
const it = db.prepare(`SELECT id FROM ordre_items LIMIT 1`).get();
if (it) {
  db.prepare(`INSERT INTO avancement_historique (item_id, utilisateur_id, avant, apres)
              VALUES (?,1,0,10)`).run(it.id);
  const s = R.silenceAtelier();
  t('après une déclaration, le silence est daté', s.jamais === false && s.jours === 0);
}

// ------------------------------------------------------- le courriel, désarmé
// LE POINT IMPORTANT DE CE FICHIER. La première version s'armait dès que le
// secret Missive existait dans l'environnement — et le premier appel de
// vérification est parti pour de vrai. La présence d'une clé n'est pas un
// consentement à s'en servir.
process.env.MISSIVE_PROXY_SECRET = 'un-secret-qui-traine';
delete require.cache[require.resolve('../courriel.js')];
const C2 = require('../courriel.js');
t("un secret présent n'arme PAS l'envoi",
  C2.coupure() === 'MRP_COURRIEL_ARME absent');

// ------------------------------------------------------- le moment de l'envoi
// Vendredi matin, heure de Tunis. La tâche est posée le lundi et reste visible
// toute la semaine ; le courriel sonne le jour de l'échéance, quand il reste
// une journée pour agir.
t('vendredi 9 h à Tunis : on envoie',    R.estMomentEnvoi(new Date('2026-09-18T08:00:00Z')));
t('vendredi 5 h : trop tôt',            !R.estMomentEnvoi(new Date('2026-09-18T04:00:00Z')));
t('lundi matin : on n\'envoie pas',      !R.estMomentEnvoi(new Date('2026-09-14T08:00:00Z')));
t('samedi : la semaine est finie',      !R.estMomentEnvoi(new Date('2026-09-19T08:00:00Z')));
t('jeudi soir : pas encore',            !R.estMomentEnvoi(new Date('2026-09-17T20:00:00Z')));

// Le message est STANDARD : le même tous les vendredis, sans chiffre qui
// vieillit. C'est ce qui le rend aussi planifiable ailleurs.
C2.envoyerRappel({ courriel: 'x@y.z', nom: 'Test', echeance: '2026-09-18',
                   restants: 12, aujourdhui: true })
  .then(r => {
    t('sans armement, rien ne part', r.envoye === false);
    t('mais le message est composé et lisible',
      !!r.apercu && /déclarer/i.test(r.apercu.corps) && r.apercu.a === 'x@y.z');
    // L'objet porte une date LISIBLE : « 2026-09-18 » ne se lit pas dans une
    // liste de courriels, et c'est là que la date doit sauter aux yeux.
    // Envoyé LE jour de l'échéance : « avant vendredi », un vendredi matin,
    // se lit comme une erreur.
    t("envoyé le jour même, le message dit « aujourd'hui »",
      /aujourd'hui/.test(r.apercu.objet) && /aujourd'hui/.test(r.apercu.corps));
    t("aucune date ISO nulle part", !/2026-09-18/.test(r.apercu.objet + r.apercu.corps));
    t('le message dit qu\'il est automatique',
      /automatique/i.test(r.apercu.corps));
    t('il dit où répondre — pas dans la boîte support',
      /écris la note dans l'app/.test(r.apercu.corps));
    // Un rappel hebdomadaire se lit en diagonale dès la deuxième fois : ce qui
    // dépasse six lignes utiles ne sera pas lu.
    t('le corps tient en douze lignes',
      r.apercu.corps.split('\n').length <= 14);
    t('le pied de page annonce le bon jour',
      /chaque vendredi/.test(r.apercu.corps));
    t("aucun chiffre vivant : le texte ne vieillit pas",
      !/12/.test(r.apercu.corps) && !/lots? à 0/.test(r.apercu.corps));
    console.log(`\n  ${ok} réussites, ${ko} échecs`);
    process.exit(ko ? 1 : 0);
  });
