/**
 * Lasclay — MRP : charge de travail et calendrier
 * ---------------------------------------------------------------------------
 * Combien d'heures d'atelier chaque item demande, et quand elles tombent.
 *
 * DEUX SOURCES POUR UN TEMPS UNITAIRE, DANS CET ORDRE
 *
 *   1. Le chronomètre. `donnees/temps-operations.tsv` porte des mesures
 *      réelles pour huit familles. Quand une ligne « Total » existe, c'est
 *      elle qui compte : c'est le chiffre qui a servi au calcul de coût. Sinon
 *      la somme des postes. Jamais les deux — additionner un total et ses
 *      composantes double la durée.
 *
 *   2. Le coût de confection. Le suivi Tunisie établit la conversion sur les
 *      mitaines polar : « 12,01 $ à 26 $/h » donne 27 min 42 s, soit
 *      exactement 12,01 / 26 heures. On applique la même règle au poste
 *      « assemblage » des fiches COGS. C'est une déduction, pas une mesure —
 *      et l'app le dit à chaque fois qu'elle s'en sert.
 *
 * CE QUI N'EXISTE PAS : LA CAPACITÉ
 *
 * Aucune source ne dit combien de personnes travaillent, ni combien d'heures.
 * Sans ça, des heures ne deviennent pas des dates. Plutôt que d'inventer un
 * chiffre qui aurait l'air d'une donnée, la capacité est un réglage : posé par
 * Québec, affiché partout où il sert, et modifiable en un champ. Le calendrier
 * dit alors « avec cette capacité-là », ce qui est vrai, au lieu de « voici les
 * dates », qui ne le serait pas.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { db } = require('./db.js');

const DOSSIER = path.join(__dirname, 'donnees');

/** Le taux horaire qui sert à convertir un coût en temps, d'après le suivi. */
const TAUX_HORAIRE = 26;

function tsv(nom) {
  const l = fs.readFileSync(path.join(DOSSIER, nom), 'utf8')
    .trim().split('\n').filter(x => !x.startsWith('#'));
  const cols = l[0].split('\t');
  return l.slice(1).map(r => {
    const v = r.split('\t');
    return Object.fromEntries(cols.map((k, i) => [k, (v[i] ?? '').trim()]));
  });
}

const secondes = (t) => {
  const p = String(t || '').split(':').map(Number);
  return p.length === 3 && p.every(Number.isFinite) ? p[0] * 3600 + p[1] * 60 + p[2] : 0;
};

/** Temps chronométrés, une entrée par famille du fichier de mesures. */
function tempsChrono() {
  const par = new Map();
  for (const o of tsv('temps-operations.tsv')) {
    if (!par.has(o.produit)) par.set(o.produit, []);
    par.get(o.produit).push(o);
  }
  const out = new Map();
  for (const [famille, lignes] of par) {
    const total = lignes.find(x => /^total/i.test(x.operation));
    const postes = lignes.filter(x => !/^total/i.test(x.operation))
                         .reduce((s, x) => s + secondes(x.temps_moyen), 0);
    const retenu = total ? secondes(total.temps_moyen) : postes;
    out.set(famille, {
      secondes: retenu,
      base: total ? 'total' : 'postes',
      // Les deux chiffres divergent parfois — les postes des semelles sont
      // notés « par pad », le total « par paire ». On garde l'écart visible
      // plutôt que de trancher en silence.
      postes, ecartPostes: total ? postes - retenu : 0,
      operations: lignes.filter(x => !/^total/i.test(x.operation))
        .map(x => ({ nom: x.operation, secondes: secondes(x.temps_moyen) })),
    });
  }
  return out;
}

/** Coût de confection par produit COGS, pour la déduction. */
function coutsConfection() {
  const out = new Map();
  for (const r of tsv('cogs-tunisie.tsv')) {
    const c = Number(r.assemblage);
    if (Number.isFinite(c) && c > 0) out.set(r.produit, c);
  }
  return out;
}

/**
 * Le pont entre un code produit de l'app et les libellés des fichiers de
 * mesure, qui ne suivent pas la même nomenclature. Explicite exprès : deviner
 * par ressemblance de nom rattacherait « Mitaines bébé » à « Mitaines polar ».
 */
const FAMILLE_CHRONO = {
  'CACHE-COU': 'Cache-cou',
  'CACHE-COU-ENF-18M4A': 'Cache-cou',
  'CACHE-COU-ENF-5A13A': 'Cache-cou',
  'TUQUE-SPORT': 'Tuque sport',
  'BESACE': 'Besace / sac à lunch',
  'SAC-LUNCH': 'Besace / sac à lunch',
  'FOULARD': 'Foulard',
  'SEMELLE-678': 'Semelles 6-7-8F',
  'SEMELLE-9': 'Semelles 9F+',
  'MIT-POLAR': 'Mitaines polar',
  'GLACIERE': 'Glacière',
};

const FAMILLE_COGS = {
  'BANDEAU': 'Bandeau',
  'MIT-PLEIN-AIR': 'Mitaines plein air',
  'MIT-LAINE': 'Mitaines polar',
  'MIT-CUIR': 'Mitaines polar',
  'MIT-BEBE': 'Mitaines bébé 0-2',
  'COUSSIN': "Coussin d'assise",
  'TOTE': 'Tote bag',
  'GANTS-MAGIQUES': 'Gants magiques',
  'MANTEAU-HIVER': 'Manteau',
  'MANTEAU-3SAISONS': 'Manteau',
  'VESTE': 'Manteau',
  'SAC-COUCHAGE-0': 'Sac de couchage 0C',
  'SAC-COUCHAGE-18': 'Sac de couchage -18',
};

/**
 * Le temps unitaire d'un produit, avec d'où il vient.
 * `source` vaut 'chrono', 'cout' ou 'aucune' — jamais caché à l'affichage.
 */
function tempsUnitaire(code, chrono = tempsChrono(), couts = coutsConfection()) {
  const f = FAMILLE_CHRONO[code];
  if (f && chrono.has(f)) {
    const c = chrono.get(f);
    return { secondes: c.secondes, source: 'chrono', famille: f,
             base: c.base, ecartPostes: c.ecartPostes, operations: c.operations };
  }
  const g = FAMILLE_COGS[code];
  if (g && couts.has(g)) {
    const cout = couts.get(g);
    return { secondes: Math.round((cout / TAUX_HORAIRE) * 3600),
             source: 'cout', famille: g, cout };
  }
  return { secondes: 0, source: 'aucune' };
}

// ----------------------------------------------------------------- capacité
/**
 * La capacité de l'atelier, en réglages. Un seul jeu pour tout le monde :
 * ce n'est pas une préférence d'affichage, c'est une donnée d'exploitation.
 *
 * 20 postes : l'équipe annoncée par Québec en août 2026. C'est un chiffre
 * DÉCLARÉ, pas observé — et « 20 personnes dans l'atelier » n'est pas tout à
 * fait « 20 personnes qui cousent » : encadrement, coupe et finition en font
 * partie. Tant que personne n'a confirmé le réglage dans l'app, la page le dit.
 */
const CAPACITE_DEFAUT = { postes: 20, heures_jour: 8, jours_semaine: 5 };

db.exec(`CREATE TABLE IF NOT EXISTS reglages (
  cle    TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
)`);

function capacite() {
  const l = db.prepare(`SELECT cle, valeur FROM reglages
                        WHERE cle IN ('postes','heures_jour','jours_semaine')`).all();
  const c = { ...CAPACITE_DEFAUT };
  let pose = false;
  for (const r of l) {
    const v = Number(r.valeur);
    if (Number.isFinite(v) && v > 0) { c[r.cle] = v; pose = true; }
  }
  c.defaut = !pose;
  c.heures_semaine = c.postes * c.heures_jour * c.jours_semaine;
  return c;
}

function poserCapacite({ postes, heures_jour, jours_semaine }) {
  const bornes = { postes: [1, 200], heures_jour: [1, 24], jours_semaine: [1, 7] };
  const vals = { postes, heures_jour, jours_semaine };
  const pose = db.prepare(`INSERT INTO reglages (cle, valeur) VALUES (?,?)
                           ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`);
  for (const [k, v] of Object.entries(vals)) {
    const n = Number(v);
    const [min, max] = bornes[k];
    if (!Number.isFinite(n) || n < min || n > max)
      return { erreur: `${k} doit être entre ${min} et ${max}.` };
  }
  for (const [k, v] of Object.entries(vals)) pose.run(k, String(Number(v)));
  return { ok: true, capacite: capacite() };
}

/**
 * Ce que les items sans temps connu coûteraient, en fourchette.
 *
 * « La charge réelle est plus élevée » est vrai mais inutilisable : on ne sait
 * pas si ça veut dire dix heures ou mille. Faute de mesure, on prête à ces
 * items les temps unitaires des items du MÊME plan — le plus court, la
 * médiane, le plus long. Ce n'est pas une estimation de leur durée : c'est
 * l'ordre de grandeur de ce qui manque au total, et ça suffit à savoir si une
 * marge tient debout.
 *
 * Rien n'est ajouté au calendrier : ces heures restent hors du Gantt, parce
 * qu'on ne sait pas où les placer. Elles servent à qualifier la marge.
 */
function chargeInconnue(lignes, chrono = null, couts = null) {
  // Chargés seulement si une ligne n'a pas déjà son temps : sur la page cédule,
  // les tâches viennent du calendrier et les fichiers ne sont pas relus.
  const mesures = () => (chrono ??= tempsChrono(), couts ??= coutsConfection());
  const connus = [], manquants = [];
  for (const l of lignes) {
    // Une tâche de calendrier porte déjà son temps : pas la peine de relire
    // les fichiers de mesure pour rien.
    const t = l.temps || (mesures(), tempsUnitaire(l.code, chrono, couts));
    if (t.source === 'aucune') manquants.push(l);
    else if (t.secondes > 0) connus.push(t.secondes);
  }
  const pieces = manquants.reduce((s, l) => s + l.restant, 0);
  if (!manquants.length || !connus.length || !pieces)
    return { items: manquants.length, pieces, bas: 0, median: 0, haut: 0, connu: Boolean(connus.length) };

  connus.sort((a, b) => a - b);
  const h = (sec) => (sec * pieces) / 3600;
  return {
    items: manquants.length, pieces, connu: true,
    bas:    h(connus[0]),
    median: h(connus[Math.floor(connus.length / 2)]),
    haut:   h(connus[connus.length - 1]),
  };
}

// ---------------------------------------------------------------- calendrier
/**
 * Place les items bout à bout dans l'ordre de fabrication, en consommant la
 * capacité jour après jour.
 *
 * L'atelier est modélisé comme UNE file : un item à la fois, tous les postes
 * dessus. C'est une simplification, et elle est du bon côté — supposer que
 * quatre produits avancent en parallèle donnerait des dates plus optimistes
 * sans que rien ne le justifie.
 *
 * Les jours non ouvrés sont sautés. Un item sans temps connu occupe zéro
 * heure : il apparaît quand même, marqué, pour qu'on voie qu'il manque au
 * calcul plutôt que de le croire gratuit.
 */
function calendrier(lignes, { depart = null, cap = capacite() } = {}) {
  const chrono = tempsChrono(), couts = coutsConfection();
  const parJour = cap.postes * cap.heures_jour;
  const ouvre = (d) => {
    // jours_semaine = combien de jours travaillés par semaine, du lundi.
    const j = d.getUTCDay();               // 0 = dimanche
    return j !== 0 && j <= cap.jours_semaine;
  };
  const jour = (d) => new Date(d.getTime() + 864e5);

  let curseur = depart ? new Date(depart + 'T00:00:00Z')
                       : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  while (!ouvre(curseur)) curseur = jour(curseur);
  let resteJour = parJour;

  const iso = (d) => d.toISOString().slice(0, 10);
  const taches = [];
  let heuresTotal = 0, sansTemps = 0;

  for (const l of lignes) {
    const t = tempsUnitaire(l.code, chrono, couts);
    const heures = (t.secondes * l.restant) / 3600;
    heuresTotal += heures;
    if (t.source === 'aucune') sansTemps++;

    const debut = iso(curseur);
    let reste = heures;
    if (reste <= 0) {
      taches.push({ ...l, temps: t, heures: 0, debut, fin: debut, jours: 0 });
      continue;
    }
    let jours = 0;
    while (reste > 1e-9) {
      const pris = Math.min(reste, resteJour);
      reste -= pris; resteJour -= pris;
      if (resteJour <= 1e-9) {
        do { curseur = jour(curseur); } while (!ouvre(curseur));
        resteJour = parJour;
        jours++;
      }
    }
    const fin = iso(curseur);
    taches.push({ ...l, temps: t, heures, debut, fin, jours: jours + 1 });
  }

  return { taches, heuresTotal, sansTemps, cap,
           debut: taches.length ? taches[0].debut : null,
           fin: taches.length ? taches[taches.length - 1].fin : null };
}

module.exports = { tempsChrono, coutsConfection, tempsUnitaire, secondes, calendrier,
                   chargeInconnue,
                   capacite, poserCapacite, CAPACITE_DEFAUT, TAUX_HORAIRE,
                   FAMILLE_CHRONO, FAMILLE_COGS };
