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
 *   3. Le prix d'assemblage BMB. `donnees/assemblage-bmb.tsv` porte ce que le
 *      sous-traitant facture par unité, pour 23 produits — dont cinq que les
 *      fiches COGS ignorent. Même conversion, même taux.
 *
 * DEUX ÉTAPES, PAS DEUX VERSIONS DU MÊME CHIFFRE
 *
 * Le chronomètre et le prix BMB ne mesurent pas la même chose. Le premier
 * chronomètre les opérations d'asclépiade — coupe, matelassage, remplissage,
 * mélange — c'est-à-dire la PRÉPARATION. Le second est le prix de la couture,
 * c'est-à-dire l'ASSEMBLAGE. Les additionner ou en choisir un change le total
 * du simple au double, et rien dans les sources ne dit lequel est bon.
 *
 * La preuve que ce sont deux étapes : sur le cache-cou, six opérations
 * chronométrées donnent 17 min, et BMB facture 3 $ (≈ 7 min). Sur la tuque
 * sport, trois opérations donnent 2 min et BMB facture 4 $ (≈ 9 min). Un
 * rapport constant existerait si c'était la même mesure ; il n'y en a pas.
 *
 * Deux exceptions, marquées : une ligne « Total » (semelles, glacière) et
 * « Confection Lasclay » (mitaines polar) sont déjà des totaux. On ne leur
 * ajoute pas l'assemblage, ce serait le compter deux fois.
 *
 * CE QUI N'EXISTE PAS : LA CAPACITÉ, NI LE PÉRIMÈTRE
 *
 * Aucune source ne dit combien de personnes travaillent, ni combien d'heures.
 * Sans ça, des heures ne deviennent pas des dates. Plutôt que d'inventer un
 * chiffre qui aurait l'air d'une donnée, la capacité est un réglage : posé par
 * Québec, affiché partout où il sert, et modifiable en un champ. Le calendrier
 * dit alors « avec cette capacité-là », ce qui est vrai, au lieu de « voici les
 * dates », qui ne le serait pas.
 *
 * Même traitement pour le périmètre : personne n'a dit si l'atelier qu'on
 * planifie fait la préparation, l'assemblage, ou les deux. C'est un réglage.
 * Par défaut « les deux » — c'est la lecture prudente, et c'est celle qui ne
 * rentre pas : partir de l'hypothèse optimiste enterrerait le risque.
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

/** Prix d'assemblage BMB, par code produit — la source la plus complète. */
function assemblageBMB() {
  const out = new Map();
  for (const r of tsv('assemblage-bmb.tsv')) {
    const p = Number(r.assemblage_bmb);
    if (Number.isFinite(p) && p > 0)
      out.set(r.produit, { prix: p, note: r.note || '' });
  }
  return out;
}

/**
 * Estimations à la main, pour ce que rien d'autre ne couvre. Chargées à part
 * exprès : le fichier BMB est extrait et régénérable, celui-ci est un jugement.
 */
function assemblageEstime() {
  const out = new Map();
  for (const r of tsv('assemblage-estime.tsv')) {
    const p = Number(r.assemblage_estime);
    if (Number.isFinite(p) && p > 0)
      out.set(r.produit, { prix: p, ancrage: r.ancrage || '' });
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

/** Un montant en dollars devient un temps au taux du suivi Tunisie. */
const enSecondes = (dollars) => Math.round((dollars / TAUX_HORAIRE) * 3600);

/**
 * Le temps unitaire d'un produit, découpé en ses deux étapes.
 *
 * Renvoie toujours `preparation` et `assemblage` séparément, chacun avec sa
 * provenance, plus `secondes` — ce que le calendrier consomme, selon le
 * périmètre demandé. Rien n'est masqué : une ligne du Gantt peut dire « 12 min
 * de préparation chronométrée + 7 min d'assemblage facturé ».
 *
 * `total: true` marque les familles dont le chronomètre porte déjà tout
 * (« Total », « Confection Lasclay ») : on ne leur ajoute pas l'assemblage.
 */
function tempsUnitaire(code, chrono = tempsChrono(), couts = coutsConfection(),
                       bmb = assemblageBMB(), perim = 'tout',
                       estimes = assemblageEstime()) {
  const out = { preparation: 0, assemblage: 0, prepSource: null, asmSource: null,
                total: false, partiel: false, divergent: null };

  const f = FAMILLE_CHRONO[code];
  if (f && chrono.has(f)) {
    const c = chrono.get(f);
    out.preparation = c.secondes;
    out.famille = f;
    out.operations = c.operations;
    out.ecartPostes = c.ecartPostes;
    // Une ligne « Total », ou une opération qui dit « confection », couvre déjà
    // la couture. Y ajouter l'assemblage compterait le produit deux fois.
    out.total = c.base === 'total' || c.operations.some(o => /confection/i.test(o.nom));
    out.prepSource = out.total ? 'chrono-total' : 'chrono';
    // Un relevé qui n'est qu'une somme de postes ne dit pas combien d'opérations
    // n'ont PAS été chronométrées : c'est un plancher, pas une mesure complète.
    out.partiel = !out.total;
  }

  if (bmb.has(code)) {
    const b = bmb.get(code);
    out.assemblage = enSecondes(b.prix);
    out.asmSource = 'bmb';
    out.prixBMB = b.prix;
    if (b.note && b.note.startsWith('divergent')) out.divergent = b.note;
  } else {
    // Pas de prix BMB : la fiche COGS fait l'affaire, mais elle est parfois
    // partagée par plusieurs produits — c'est une approximation, pas la mesure
    // de CE produit-là.
    const g = FAMILLE_COGS[code];
    if (g && couts.has(g)) {
      out.assemblage = enSecondes(couts.get(g));
      out.asmSource = 'cout';
      out.familleCogs = g;
      out.cout = couts.get(g);
    } else if (estimes.has(code)) {
      // Dernier recours : mieux vaut un chiffre contestable et marqué comme tel
      // que zéro heure, qui est le seul chiffre certainement faux.
      const e = estimes.get(code);
      out.assemblage = enSecondes(e.prix);
      out.asmSource = 'estime';
      out.ancrage = e.ancrage;
      out.prixEstime = e.prix;
    }
  }

  if (out.total) out.assemblage = 0;   // déjà compris dans la préparation

  out.secondes = perim === 'assemblage' ? (out.assemblage || out.preparation)
               : perim === 'preparation' ? out.preparation
               : out.preparation + out.assemblage;

  out.source = out.secondes === 0 ? 'aucune'
             : out.preparation && out.assemblage ? 'deux'
             : out.assemblage ? out.asmSource
             : out.prepSource;
  return out;
}

// ----------------------------------------------------------------- capacité
/**
 * La capacité de l'atelier, en réglages. Un seul jeu pour tout le monde :
 * ce n'est pas une préférence d'affichage, c'est une donnée d'exploitation.
 *
 * 20 postes : l'équipe annoncée par Québec en août 2026 — 20 couturières, donc
 * bien 20 postes de couture. C'est un chiffre DÉCLARÉ, pas une mesure de ce qui
 * sort de l'atelier par jour ; tant que personne ne l'a confirmé dans l'app,
 * la page le dit.
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

/* ------------------------------------------------------------------- pauses
 * Les jours où l'atelier ne produit pas : Aïd, congés, une rupture de matière,
 * un déménagement. Ce n'est pas un détail de confort — c'est le seul moyen
 * honnête de « repousser » du travail.
 *
 * Poser une pause ne déplace aucune tâche à la main : elle retire de la
 * capacité, et tout ce qui suit se recale de lui-même, sans trou ni
 * chevauchement. C'est le domino, et il tombe tout seul parce que le
 * calendrier n'est pas une liste de dates stockées mais un calcul refait à
 * chaque affichage.
 */
db.exec(`CREATE TABLE IF NOT EXISTS pauses (
  id      INTEGER PRIMARY KEY,
  debut   TEXT NOT NULL,
  fin     TEXT NOT NULL,
  motif   TEXT NOT NULL DEFAULT '',
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
)`);

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const pauses = () => db.prepare(
  `SELECT * FROM pauses ORDER BY debut, id`).all();

function poserPause({ debut, fin, motif }) {
  const d = String(debut || '').trim();
  const f = String(fin || '').trim() || d;
  if (!ISO.test(d) || !ISO.test(f))
    return { erreur: 'Dates attendues au format AAAA-MM-JJ.' };
  if (f < d) return { erreur: 'La fin ne peut pas précéder le début.' };
  const id = db.prepare(`INSERT INTO pauses (debut, fin, motif) VALUES (?,?,?)`)
    .run(d, f, String(motif || '').trim().slice(0, 120)).lastInsertRowid;
  return { ok: true, id };
}

const retirerPause = (id) => db.prepare(`DELETE FROM pauses WHERE id = ?`).run(id);

/** Un index date → motif, pour trancher en O(1) dans la boucle du calendrier. */
function joursEnPause(liste = pauses()) {
  const m = new Map();
  for (const p of liste) {
    const fin = new Date(p.fin + 'T00:00:00Z');
    for (let d = new Date(p.debut + 'T00:00:00Z'); d <= fin;
         d = new Date(d.getTime() + 864e5))
      m.set(d.toISOString().slice(0, 10), p.motif || 'atelier fermé');
  }
  return m;
}

/**
 * La date à laquelle le plan commence à consommer de la capacité.
 *
 * Par défaut aujourd'hui : c'est vrai, et ça évite de planifier dans le passé.
 * Posée à la main, elle décale TOUT le plan — c'est le levier le plus simple
 * quand la saison démarre plus tard qu'espéré.
 */
function depart() {
  const r = db.prepare(`SELECT valeur FROM reglages WHERE cle = 'depart'`).get();
  const auj = new Date().toISOString().slice(0, 10);
  if (!r || !ISO.test(r.valeur)) return { valeur: auj, defaut: true };
  // Un départ dans le passé ferait commencer la production avant aujourd'hui :
  // on le garde en base — c'est une décision — mais le calcul part d'aujourd'hui.
  return { valeur: r.valeur, defaut: false, passe: r.valeur < auj,
           effectif: r.valeur < auj ? auj : r.valeur };
}

function poserDepart(v) {
  const d = String(v || '').trim();
  if (!d) { db.prepare(`DELETE FROM reglages WHERE cle = 'depart'`).run();
            return { ok: true, depart: depart() }; }
  if (!ISO.test(d)) return { erreur: 'Date attendue au format AAAA-MM-JJ.' };
  db.prepare(`INSERT INTO reglages (cle, valeur) VALUES ('depart', ?)
              ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`).run(d);
  return { ok: true, depart: depart() };
}

/**
 * Ce que l'atelier planifié fait vraiment. Trois lectures, aucune dans les
 * sources — donc un réglage, comme la capacité.
 *
 * Le défaut est « tout » : c'est la lecture prudente, et c'est celle qui ne
 * rentre pas. Partir de l'hypothèse optimiste ferait disparaître le risque
 * sans rien changer à la réalité de l'atelier.
 */
const PERIMETRES = {
  tout:        'Préparation + assemblage',
  assemblage:  "Assemblage seulement (la préparation se fait ailleurs)",
  preparation: 'Préparation seulement',
};
const PERIMETRE_DEFAUT = 'tout';

function perimetre() {
  const r = db.prepare(`SELECT valeur FROM reglages WHERE cle = 'perimetre'`).get();
  const v = r && r.valeur;
  return { valeur: PERIMETRES[v] ? v : PERIMETRE_DEFAUT, defaut: !PERIMETRES[v] };
}

function poserPerimetre(v) {
  if (!PERIMETRES[v]) return { erreur: 'Périmètre inconnu.' };
  db.prepare(`INSERT INTO reglages (cle, valeur) VALUES ('perimetre', ?)
              ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`).run(v);
  return { ok: true, perimetre: perimetre() };
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
/**
 * Étale le plan sur le calendrier de l'atelier.
 *
 * Le principe tient en une phrase : les tâches se posent bout à bout et
 * consomment la capacité disponible jour après jour. Aucune date n'est
 * stockée — tout est recalculé à chaque affichage. C'est ce qui fait le
 * domino : allonger une tâche, en insérer une avant, fermer l'atelier une
 * semaine, changer la capacité, et tout ce qui suit se recale sans trou ni
 * chevauchement. Il n'y a rien à « repropager », parce qu'il n'y a rien de
 * figé à corriger.
 *
 * Retourne aussi `parJour` : ce que chaque journée ouvrée contient, avec les
 * heures prises par chaque item. C'est ce que le calendrier mensuel affiche.
 */
function calendrier(lignes, { depart: dep = null, cap = capacite(),
                              perim = null, pauses: lp = null } = {}) {
  const chrono = tempsChrono(), couts = coutsConfection();
  const bmb = assemblageBMB(), estimes = assemblageEstime();
  const p = perim || perimetre().valeur;
  const parJour = cap.postes * cap.heures_jour;

  const listePauses = lp === null ? pauses() : lp;
  const fermes = joursEnPause(listePauses);
  const iso = (d) => d.toISOString().slice(0, 10);

  const ouvre = (d) => {
    // jours_semaine = combien de jours travaillés par semaine, du lundi.
    const j = d.getUTCDay();               // 0 = dimanche
    if (j === 0 || j > cap.jours_semaine) return false;
    return !fermes.has(iso(d));
  };
  const jour = (d) => new Date(d.getTime() + 864e5);

  const d0 = dep || depart().effectif || depart().valeur;
  let curseur = new Date(d0 + 'T00:00:00Z');
  // Un plan qui démarre un dimanche, ou pendant une fermeture, commence au
  // premier jour ouvré suivant. Une garde de deux ans évite la boucle infinie
  // si quelqu'un ferme l'atelier pour toujours.
  const butoir = new Date(curseur.getTime() + 730 * 864e5);
  while (!ouvre(curseur) && curseur < butoir) curseur = jour(curseur);
  let resteJour = parJour;

  const occupation = new Map();          // iso → [{ code, nom, heures, produit_id }]
  const noter = (d, l, h) => {
    const k = iso(d);
    if (!occupation.has(k)) occupation.set(k, []);
    const jourLa = occupation.get(k);
    const deja = jourLa.find(x => x.code === l.code);
    if (deja) deja.heures += h;
    else jourLa.push({ code: l.code, nom: l.nom, produit_id: l.produit_id,
                       famille: l.famille, heures: h, item_id: l.id });
  };

  const taches = [];
  let heuresTotal = 0, sansTemps = 0;

  for (const l of lignes) {
    const t = tempsUnitaire(l.code, chrono, couts, bmb, p, estimes);
    const heures = (t.secondes * l.restant) / 3600;
    heuresTotal += heures;
    if (t.source === 'aucune') sansTemps++;

    const debut = iso(curseur);
    if (heures <= 0) {
      taches.push({ ...l, temps: t, heures: 0, debut, fin: debut, jours: 0 });
      continue;
    }

    let reste = heures;
    const occupes = [];
    while (reste > 1e-9 && curseur < butoir) {
      const pris = Math.min(reste, resteJour);
      reste -= pris; resteJour -= pris;
      noter(curseur, l, pris);
      if (!occupes.length || occupes[occupes.length - 1] !== iso(curseur))
        occupes.push(iso(curseur));
      if (resteJour <= 1e-9) {
        do { curseur = jour(curseur); } while (!ouvre(curseur) && curseur < butoir);
        resteJour = parJour;
      }
    }
    // La fin est le DERNIER jour occupé, pas la position du curseur : une tâche
    // qui remplit exactement une journée laissait le curseur au lendemain, et
    // la barre du Gantt s'étirait d'un jour de trop.
    taches.push({ ...l, temps: t, heures,
                  debut: occupes[0] || debut,
                  fin: occupes[occupes.length - 1] || debut,
                  jours: occupes.length });
  }

  return { taches, heuresTotal, sansTemps, cap, perimetre: p,
           parJour: occupation, capaciteJour: parJour,
           pauses: listePauses, fermes,
           debut: taches.length ? taches[0].debut : null,
           fin: taches.length ? taches.reduce((m, x) => x.fin > m ? x.fin : m,
                                              taches[0].fin) : null };
}

/**
 * Les jours ouvrés entre deux dates, pauses déduites. Sert au verdict — « 42
 * jours ouvrés d'ici l'expédition » n'est vrai que si on retire les
 * fermetures.
 */
function joursOuvres(du, au, cap = capacite(), fermes = joursEnPause()) {
  let n = 0;
  const f = new Date(au + 'T00:00:00Z');
  for (let d = new Date(du + 'T00:00:00Z'); d < f;
       d = new Date(d.getTime() + 864e5)) {
    const j = d.getUTCDay();
    if (j === 0 || j > cap.jours_semaine) continue;
    if (fermes.has(d.toISOString().slice(0, 10))) continue;
    n++;
  }
  return n;
}

module.exports = { tempsChrono, coutsConfection, assemblageBMB, assemblageEstime,
                   tempsUnitaire,
                   secondes, calendrier, chargeInconnue, joursOuvres,
                   pauses, poserPause, retirerPause, joursEnPause,
                   depart, poserDepart,
                   capacite, poserCapacite, CAPACITE_DEFAUT, TAUX_HORAIRE,
                   perimetre, poserPerimetre, PERIMETRES, PERIMETRE_DEFAUT,
                   FAMILLE_CHRONO, FAMILLE_COGS };
