/**
 * Lasclay — MRP : le rappel hebdomadaire de l'atelier
 * ---------------------------------------------------------------------------
 * L'atelier doit déclarer où il en est AU MOINS une fois par semaine.
 *
 * Pourquoi ce fichier existe : le 14 septembre 2026, l'ordre affichait 42 %
 * d'avancement à Tunis et 0 % dans toute analyse faite de loin. Les cache-cous
 * étaient finis depuis des jours et personne à Québec ne le savait. Un plan de
 * chargement de conteneur a été calculé sur des chiffres périmés, jusqu'à ce
 * que quelqu'un ouvre l'app et dise « les cache-cous sont faits ».
 *
 * Une donnée qui n'est pas déclarée n'existe pas — c'est la même règle que
 * pour les imports, appliquée à l'atelier.
 *
 * COMMENT, ET PAS AILLEURS
 *
 * Le rappel vit DANS l'app, pas dans un courriel ni dans un agenda. C'est là
 * que le geste se fait : voir le rappel et déclarer l'avancement sont à deux
 * clics l'un de l'autre. Un rappel qui arrive dans une boîte courriel demande
 * d'ouvrir un autre outil, et c'est l'autre outil qu'on n'ouvre pas.
 *
 * LA SEMAINE EST CELLE DE TUNIS
 *
 * Le serveur vit en UTC, l'atelier vit à Tunis (UTC+1, sans heure d'été). Un
 * lundi calculé sur l'heure du serveur commencerait la semaine une heure trop
 * tôt — sans conséquence ici, mais c'est le même raisonnement que salutation.js
 * et il n'y a pas de raison d'avoir deux vérités sur l'heure qu'il est.
 *
 * REJOUABLE SANS DOMMAGE
 *
 * La tâche porte la date du lundi dans son titre. Poser le rappel deux fois le
 * même jour, ou redémarrer le service trois fois, ne crée jamais un doublon :
 * on cherche la tâche de CETTE semaine avant de l'écrire.
 */
'use strict';
const { db } = require('./db.js');
const { envoyerRappel, coupure } = require('./courriel.js');

const FUSEAU = 'Africa/Tunis';

/**
 * Le courriel part le VENDREDI MATIN, heure de Tunis.
 *
 * La tâche, elle, est posée le lundi : l'obligation reste visible toute la
 * semaine dans l'app. Le courriel n'est pas l'obligation, c'est le coup de
 * sonnette — et il sonne le jour de l'échéance, quand il reste une journée
 * pour agir. Sonner le lundi pour quelque chose qui est dû vendredi, c'est
 * garantir qu'on le remette à plus tard.
 *
 * `HEURE_ENVOI` est l'heure locale à partir de laquelle la minuterie horaire a
 * le droit de partir. 7 h : la journée d'atelier a commencé, la boîte est
 * ouverte. Si le service dort tout le vendredi matin, l'envoi se fait au
 * premier passage de l'après-midi — tard vaut mieux que jamais, mais on ne
 * déborde pas sur samedi.
 */
const HEURE_ENVOI = Number(process.env.MRP_RAPPEL_HEURE) || 7;

/** L'heure locale à Tunis, 0-23. */
function heureTunis(maintenant = new Date()) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: FUSEAU,
    hour: 'numeric', hourCycle: 'h23' }).formatToParts(maintenant);
  return Number(p.find(x => x.type === 'hour').value);
}

/** Vendredi, à Tunis, et l'atelier est ouvert. */
function estMomentEnvoi(maintenant = new Date()) {
  const jour = new Date(aujourdhuiTunis(maintenant) + 'T00:00:00Z').getUTCDay();
  return jour === 5 && heureTunis(maintenant) >= HEURE_ENVOI;
}

/** La date du jour à Tunis, en AAAA-MM-JJ. */
function aujourdhuiTunis(maintenant = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU,
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(maintenant);
  const v = (t) => p.find(x => x.type === t).value;
  return `${v('year')}-${v('month')}-${v('day')}`;
}

/** Le lundi de la semaine d'une date, et le vendredi qui suit. */
function semaineDe(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  // getUTCDay : 0 = dimanche. Le lundi est le début de semaine ici, donc
  // dimanche appartient à la semaine qui vient de finir, pas à celle qui commence.
  const recul = (d.getUTCDay() + 6) % 7;
  const lundi = new Date(d.getTime() - recul * 864e5);
  const vendredi = new Date(lundi.getTime() + 4 * 864e5);
  return { lundi: lundi.toISOString().slice(0, 10),
           vendredi: vendredi.toISOString().slice(0, 10) };
}

const titrePour = (lundi) => `Déclarer l'avancement — semaine du ${
  new Date(lundi + 'T00:00:00Z').toLocaleDateString('fr-CA',
    { day: 'numeric', month: 'long', timeZone: 'UTC' })}`;

const DETAILS = "Ouvrir chaque lot de l'ordre en cours et poser son pourcentage, "
  + "même s'il n'a pas bougé : « toujours à 60 % » est une information, le silence non. "
  + "Une note sur ce qui bloque vaut encore mieux.";

/**
 * Pose le rappel de la semaine courante pour chaque compte d'atelier actif.
 *
 * Renvoie ce qui a été fait, pour que le journal de démarrage le dise : un
 * rappel qui se pose en silence est un rappel dont on ne saura jamais s'il
 * fonctionne.
 */
function poserRappelHebdo(maintenant = new Date()) {
  const { lundi, vendredi } = semaineDe(aujourdhuiTunis(maintenant));
  const titre = titrePour(lundi);
  const gens = db.prepare(
    `SELECT id, nom FROM utilisateurs WHERE actif = 1 AND role = 'atelier'`).all();
  const dejaLa = db.prepare(
    `SELECT 1 FROM taches WHERE titre = ? AND assigne_a = ?`);
  const pose = db.prepare(
    `INSERT INTO taches (titre, details, assigne_a, echeance) VALUES (?,?,?,?)`);

  const poses = [];
  for (const g of gens) {
    if (dejaLa.get(titre, g.id)) continue;
    // `cree_par` reste NULL : ce rappel ne vient de personne en particulier,
    // c'est la règle de la maison. La vue dit « demandé par l'application ».
    pose.run(titre, DETAILS, g.id, vendredi);
    poses.push(g.nom);
  }
  return { titre, echeance: vendredi, poses, comptes: gens.length };
}

/**
 * Depuis combien de temps l'atelier n'a rien déclaré.
 *
 * `sansMouvement()` regarde les lots qui stagnent ; celui-ci regarde la
 * PERSONNE. Un atelier qui n'a rien déclaré depuis douze jours est un chiffre
 * que l'administration doit voir sans avoir à le chercher — et il reste vrai
 * même quand tous les lots sont à 0 %, ce que le détecteur de stagnation ne
 * voit pas, lui, puisqu'il ne suit que ce qui a déjà bougé.
 */
function silenceAtelier() {
  const r = db.prepare(`
    SELECT a.cree_le, u.nom,
           CAST(julianday('now') - julianday(a.cree_le) AS INTEGER) AS jours
      FROM avancement_historique a
      LEFT JOIN utilisateurs u ON u.id = a.utilisateur_id
     ORDER BY a.id DESC LIMIT 1`).get();
  if (!r) return { jamais: true, jours: null, quand: null, qui: null };
  return { jamais: false, jours: r.jours ?? 0, quand: r.cree_le, qui: r.nom || null };
}

/**
 * Le tour complet : poser la tâche de la semaine, puis frapper à la porte.
 *
 * Les deux sont séparés exprès. La tâche est la trace — elle reste dans l'app
 * même si le courriel échoue, et c'est elle qui compte comme obligation. Le
 * courriel n'est qu'un coup de sonnette, et il se retente la semaine suivante
 * s'il rate. On ne bloque jamais l'un sur l'autre.
 *
 * Marqueur d'envoi dans `amorce_etat` : redémarrer le service trois fois un
 * lundi ne doit pas envoyer trois courriels.
 */
async function verifierRappels(maintenant = new Date()) {
  const r = poserRappelHebdo(maintenant);
  const journal = [];
  if (r.poses.length) journal.push(`tâche posée pour ${r.poses.join(', ')}`);

  if (!estMomentEnvoi(maintenant))
    return { ...r, journal, courriels: [], attente: 'pas vendredi matin à Tunis' };

  const cle = `rappel_courriel_${r.echeance}`;
  const deja = db.prepare(`SELECT 1 FROM amorce_etat WHERE cle = ?`).get(cle);
  if (deja) return { ...r, journal, courriels: [] };

  const gens = db.prepare(
    `SELECT id, nom, courriel FROM utilisateurs WHERE actif = 1 AND role = 'atelier'`).all();
  // Ce qui n'a jamais été déclaré : le chiffre qui donne envie d'ouvrir l'app.
  const restants = db.prepare(`
    SELECT COUNT(*) n FROM ordre_items i JOIN ordres o ON o.id = i.ordre_id
     WHERE o.statut IN ('planifie','en_cours') AND i.avancement = 0`).get().n;

  const courriels = [];
  let auMoinsUn = false;
  for (const g of gens) {
    const rep = await envoyerRappel({ courriel: g.courriel, nom: g.nom,
                                      echeance: r.echeance, restants,
                                      // Sonner le jour même change la phrase :
                                      // « avant vendredi » un vendredi matin
                                      // se lit comme une erreur.
                                      aujourdhui: r.echeance === aujourdhuiTunis(maintenant) });
    courriels.push({ nom: g.nom, ...rep });
    if (rep.envoye) auMoinsUn = true;
  }
  // Le marqueur ne se pose que si quelque chose est VRAIMENT parti : un échec
  // réseau doit pouvoir être retenté au prochain passage de la minuterie.
  if (auMoinsUn)
    db.prepare(`INSERT INTO amorce_etat (cle, valeur, maj_le)
                VALUES (?,?,datetime('now'))
                ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur,
                                               maj_le = excluded.maj_le`)
      .run(cle, courriels.filter(c => c.envoye).map(c => c.nom).join(', '));
  return { ...r, journal, courriels };
}

module.exports = { poserRappelHebdo, verifierRappels, silenceAtelier,
                   semaineDe, aujourdhuiTunis, heureTunis, estMomentEnvoi,
                   titrePour, coupure, HEURE_ENVOI };
