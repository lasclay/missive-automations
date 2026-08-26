/**
 * outils.js — ce que l'assistant peut FAIRE dans l'app.
 *
 * Chaque outil est une action réelle sur la base, pas une suggestion. Trois
 * règles tiennent l'ensemble :
 *
 *   1. Les droits sont les mêmes qu'à la main. L'atelier peut mettre à jour un
 *      avancement et commenter ; il ne peut pas créer d'ordre. L'assistant ne
 *      doit jamais servir d'échelle pour passer par-dessus le mur : le rôle est
 *      vérifié ici, pas seulement dans les routes HTTP.
 *   2. Toute écriture est journalisée avec de quoi la défaire. L'assistant agit
 *      immédiatement — c'est ce qu'on lui demande — mais rien n'est
 *      irréversible : chaque tour porte son bouton « Annuler ».
 *   3. Aucune suppression d'ordre ni de produit. Retirer un item ou un jalon,
 *      oui, c'est du travail courant et ça se défait. Supprimer un ordre
 *      complet sur un ordre verbal mal entendu, non.
 *
 * Les références sont floues par nature à l'oral : « les cache-cous », « l'ordre
 * d'automne ». resoudreProduit / resoudreOrdre acceptent un code, un numéro, un
 * identifiant ou un bout de nom, et refusent explicitement l'ambiguïté plutôt
 * que de deviner.
 */
'use strict';
const D = require('./db.js');
const { db, prochainNumero, avancementOrdre, listeFabrication, dernieresMaj,
        sansMouvement, progressionRecente, fabriqueAilleurs,
        FAMILLES, LIEUX } = D;
const { urlAcceptable } = require('./vues.js');

// Tables que le journal a le droit de rétablir. Liste blanche : ce qui n'est
// pas écrit ici ne peut pas être touché par une annulation.
const TABLES = new Set(['ordres', 'ordre_items', 'ordre_jalons',
  'ordre_commentaires', 'produits', 'produit_photos', 'produit_materiaux',
  'produit_patrons', 'taches']);

// --------------------------------------------------------------- résolution
class Refus extends Error {}
const refuser = (m) => { throw new Refus(m); };

function resoudreProduit(ref) {
  const s = String(ref ?? '').trim();
  if (!s) refuser('Il faut préciser un produit (code, nom ou identifiant).');
  const parCode = db.prepare(
    `SELECT * FROM produits WHERE code = ? COLLATE NOCASE`).get(s);
  if (parCode) return parCode;
  if (/^\d+$/.test(s)) {
    const p = db.prepare(`SELECT * FROM produits WHERE id = ?`).get(Number(s));
    if (p) return p;
  }
  const flous = db.prepare(
    `SELECT * FROM produits WHERE (nom LIKE ? OR code LIKE ?) AND actif = 1
     ORDER BY nom`).all(`%${s}%`, `%${s}%`);
  if (flous.length === 1) return flous[0];
  if (flous.length > 1) refuser(
    `« ${s} » correspond à ${flous.length} produits : `
    + flous.map(p => `${p.code} (${p.nom})`).join(', ')
    + '. Demande lequel plutôt que de choisir.');
  refuser(`Aucun produit ne correspond à « ${s} ».`);
}

function resoudreOrdre(ref) {
  const s = String(ref ?? '').trim();
  if (!s) refuser('Il faut préciser un ordre (numéro, titre ou identifiant).');
  const parNum = db.prepare(
    `SELECT * FROM ordres WHERE numero = ? COLLATE NOCASE`).get(s);
  if (parNum) return parNum;
  if (/^\d+$/.test(s)) {
    const o = db.prepare(`SELECT * FROM ordres WHERE id = ?`).get(Number(s));
    if (o) return o;
  }
  const flous = db.prepare(
    `SELECT * FROM ordres WHERE titre LIKE ? OR numero LIKE ?
     ORDER BY cree_le DESC`).all(`%${s}%`, `%${s}%`);
  if (flous.length === 1) return flous[0];
  if (flous.length > 1) refuser(
    `« ${s} » correspond à ${flous.length} ordres : `
    + flous.map(o => `${o.numero} (${o.titre})`).join(', ')
    + '. Demande lequel.');
  refuser(`Aucun ordre ne correspond à « ${s} ».`);
}

/**
 * Une personne de l'équipe, par son nom. Comme pour les produits, on refuse
 * plutôt que de choisir : assigner une tâche à la mauvaise personne, c'est
 * une tâche que personne ne fait.
 */
function resoudreMembre(ref) {
  const s = String(ref ?? '').trim();
  if (!s) refuser('Il faut dire de qui on parle.');
  const l = D.equipe();
  const exact = l.filter(m => m.nom.toLowerCase() === s.toLowerCase());
  if (exact.length === 1) return exact[0];
  const flous = l.filter(m => m.nom.toLowerCase().includes(s.toLowerCase()));
  if (flous.length === 1) return flous[0];
  if (flous.length > 1) refuser(
    `« ${s} » correspond à ${flous.length} personnes : `
    + flous.map(m => m.nom).join(', ') + '. Demande laquelle.');
  refuser(`Personne ne s'appelle « ${s} ». L'équipe : `
    + l.map(m => m.nom).join(', ') + '.');
}

/**
 * Une tâche par son titre. On ne cherche que dans celles qui concernent la
 * personne connectée — terminer la tâche d'un tiers par ressemblance de titre
 * serait exactement le genre de dégât qu'on veut éviter.
 */
function resoudreTache(ref, utilisateurId) {
  const s = String(ref ?? '').trim();
  if (!s) refuser('Il faut dire de quelle tâche il s\'agit.');
  const l = db.prepare(
    `SELECT * FROM taches WHERE statut = 'a_faire'
       AND (assigne_a = ? OR cree_par = ? OR assigne_a IS NULL)`)
    .all(utilisateurId, utilisateurId);
  if (/^\d+$/.test(s)) {
    const t = l.find(x => x.id === Number(s));
    if (t) return t;
  }
  const flous = l.filter(t => t.titre.toLowerCase().includes(s.toLowerCase()));
  if (flous.length === 1) return flous[0];
  if (flous.length > 1) refuser(
    `« ${s} » correspond à ${flous.length} tâches : `
    + flous.map(t => `« ${t.titre} »`).join(', ') + '. Précise laquelle.');
  refuser(`Aucune tâche en cours ne correspond à « ${s} ».`);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const exigerDate = (d) => DATE.test(String(d || '')) ? d
  : refuser(`Date attendue au format AAAA-MM-JJ, reçu « ${d} ».`);

const exigerEntier = (n, quoi, min = 1) => {
  const v = Number(n);
  if (!Number.isInteger(v) || v < min)
    refuser(`${quoi} : entier ≥ ${min} attendu, reçu « ${n} ».`);
  return v;
};

// ------------------------------------------------------------------ journal
/**
 * Enregistre une écriture et de quoi la défaire.
 * defaire : {table, op:'insert', id} | {table, op:'update', id, avant:{…}}
 *         | {table, op:'delete', ligne:{…}}
 */
function noter(ctx, outil, resume, defaire = null) {
  db.prepare(`INSERT INTO agent_actions (tour_id, outil, resume, defaire)
              VALUES (?,?,?,?)`)
    .run(ctx.tourId, outil, resume, defaire ? JSON.stringify(defaire) : null);
  ctx.faits.push(resume);
}

/** Rejoue une action à l'envers. Retourne true si quelque chose a bougé. */
function defaireAction(action) {
  if (action.defait || !action.defaire) return false;
  const d = JSON.parse(action.defaire);
  if (!TABLES.has(d.table)) return false;
  if (d.op === 'insert') {
    db.prepare(`DELETE FROM ${d.table} WHERE id = ?`).run(d.id);
  } else if (d.op === 'update') {
    const cols = Object.keys(d.avant);
    db.prepare(`UPDATE ${d.table} SET ${cols.map(c => `${c} = ?`).join(', ')}
                WHERE id = ?`).run(...cols.map(c => d.avant[c]), d.id);
  } else if (d.op === 'delete') {
    const cols = Object.keys(d.ligne);
    db.prepare(`INSERT INTO ${d.table} (${cols.join(', ')})
                VALUES (${cols.map(() => '?').join(', ')})`)
      .run(...cols.map(c => d.ligne[c]));
  } else return false;
  db.prepare(`UPDATE agent_actions SET defait = 1 WHERE id = ?`).run(action.id);
  return true;
}

/**
 * Le seul tour qu'on a le droit d'annuler : le dernier de cet utilisateur qui
 * a encore des écritures en place.
 *
 * Pourquoi si strict — annuler un tour ancien qui avait créé un ordre le
 * supprimerait en cascade, emportant les items ajoutés par les tours suivants,
 * sans que rien ne le dise. Un défaire se lit du plus récent au plus ancien,
 * comme partout ailleurs.
 */
function dernierTourAnnulable(utilisateurId) {
  const r = db.prepare(
    `SELECT t.id FROM agent_tours t
     WHERE t.utilisateur_id = ? AND EXISTS (
       SELECT 1 FROM agent_actions a
       WHERE a.tour_id = t.id AND a.defaire IS NOT NULL AND a.defait = 0)
     ORDER BY t.id DESC LIMIT 1`).get(utilisateurId);
  return r ? r.id : null;
}

/** Annule toutes les écritures d'un tour, les plus récentes d'abord. */
function annulerTour(tourId) {
  const actions = db.prepare(
    `SELECT * FROM agent_actions WHERE tour_id = ? AND defaire IS NOT NULL
       AND defait = 0 ORDER BY id DESC`).all(tourId);
  let n = 0;
  db.exec('BEGIN');
  try {
    for (const a of actions) if (defaireAction(a)) n++;
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return n;
}

// -------------------------------------------------------------------- outils
// forme : { nom, description, params (JSON Schema), role, executer(a, ctx) }
// role 'atelier' = tout le monde ; role 'admin' = administration seulement.

const OUTILS = [
  // ------------------------------------------------------------- lectures
  {
    nom: 'lister_ordres',
    description: "Liste les ordres de production avec leur avancement global "
      + "pondéré par les quantités. À utiliser pour « où on en est », « c'est "
      + "quoi les ordres en cours ».",
    role: 'atelier',
    params: { type: 'object', properties: {
      statut: { type: 'string', enum: ['brouillon','planifie','en_cours','termine','annule'],
        description: 'Filtre facultatif.' } } },
    executer: (a) => {
      const ordres = (a.statut
        ? db.prepare(`SELECT * FROM ordres WHERE statut = ? ORDER BY cree_le DESC`).all(a.statut)
        : db.prepare(`SELECT * FROM ordres ORDER BY cree_le DESC`).all())
        .map(o => ({ numero: o.numero, titre: o.titre, statut: o.statut,
                     avancement: avancementOrdre(o.id).pct + ' %' }));
      return { ordres, total: ordres.length };
    },
  },
  {
    nom: 'lire_ordre',
    description: "Détail complet d'un ordre : items avec quantités et "
      + "avancements, jalons de la cédule, commentaires.",
    role: 'atelier',
    params: { type: 'object', required: ['ordre'], properties: {
      ordre: { type: 'string', description: 'Numéro (OP-2026-0001), titre ou identifiant.' } } },
    executer: (a) => {
      const o = resoudreOrdre(a.ordre);
      return {
        numero: o.numero, titre: o.titre, statut: o.statut, note: o.note,
        avancement: avancementOrdre(o.id).pct + ' %',
        items: db.prepare(`SELECT p.code, p.nom, i.quantite, i.avancement, i.note
            FROM ordre_items i JOIN produits p ON p.id = i.produit_id
            WHERE i.ordre_id = ? ORDER BY i.rang, i.id`).all(o.id),
        jalons: db.prepare(`SELECT titre, date, type, note FROM ordre_jalons
            WHERE ordre_id = ? ORDER BY date`).all(o.id),
        commentaires: db.prepare(`SELECT u.nom AS auteur, c.texte, c.cree_le
            FROM ordre_commentaires c LEFT JOIN utilisateurs u ON u.id = c.utilisateur_id
            WHERE c.ordre_id = ? ORDER BY c.cree_le DESC LIMIT 20`).all(o.id),
      };
    },
  },
  {
    nom: 'chercher_produit',
    description: 'Cherche des produits par code ou par nom. Sans terme, liste tout.',
    role: 'atelier',
    params: { type: 'object', properties: {
      q: { type: 'string', description: 'Bout de code ou de nom.' } } },
    executer: (a) => {
      const q = String(a.q || '').trim();
      const r = q
        ? db.prepare(`SELECT id, code, nom FROM produits
             WHERE (code LIKE ? OR nom LIKE ?) AND actif = 1 ORDER BY nom`)
            .all(`%${q}%`, `%${q}%`)
        : db.prepare(`SELECT id, code, nom FROM produits WHERE actif = 1 ORDER BY nom`).all();
      return { produits: r, total: r.length };
    },
  },
  {
    nom: 'lire_produit',
    description: "Fiche produit complète : description, usage, notes techniques "
      + "(sens de coupe…), matériaux, patrons, photos, et les ordres où il apparaît.",
    role: 'atelier',
    params: { type: 'object', required: ['produit'], properties: {
      produit: { type: 'string', description: 'Code (CC-ADULTE), nom ou identifiant.' } } },
    executer: (a) => {
      const p = resoudreProduit(a.produit);
      return {
        code: p.code, nom: p.nom, famille: p.famille, description: p.description,
        usage: p.usage, notes_techniques: p.notes_tech,
        materiaux: db.prepare(`SELECT nom, detail FROM produit_materiaux
            WHERE produit_id = ? ORDER BY rang, id`).all(p.id),
        patrons: db.prepare(`SELECT nom, format, dimensions, note FROM produit_patrons
            WHERE produit_id = ? ORDER BY rang, id`).all(p.id),
        photos: db.prepare(`SELECT type, legende FROM produit_photos
            WHERE produit_id = ? ORDER BY rang, id`).all(p.id),
        dans_les_ordres: db.prepare(`SELECT o.numero, o.titre, i.quantite, i.avancement
            FROM ordre_items i JOIN ordres o ON o.id = i.ordre_id
            WHERE i.produit_id = ? ORDER BY o.cree_le DESC`).all(p.id),
      };
    },
  },
  {
    nom: 'a_fabriquer',
    description: "La liste de fabrication : tout ce qui reste à produire À "
      + "L'ATELIER, tous ordres confondus, déjà triée dans l'ordre où s'y "
      + "mettre (priorité, puis échéance, puis quantité restante). C'est la "
      + "réponse à « qu'est-ce que je fais en premier », « qu'est-ce qui "
      + "presse », « c'est quoi la suite ». Ce qui se fabrique ailleurs "
      + "(la tuque beanie, tricotée en Chine) est retourné à part dans "
      + "`fabrique_ailleurs` — au plan, mais pas du travail d'atelier.",
    role: 'atelier',
    params: { type: 'object', properties: {
      limite: { type: 'integer', description: 'Nombre de lignes (défaut 15).' } } },
    executer: (a) => {
      const n = Number.isInteger(a.limite) && a.limite > 0 ? Math.min(a.limite, 60) : 15;
      const tout = listeFabrication();
      return {
        total_items: tout.length,
        en_retard: tout.filter(l => l.en_retard).length,
        unites_restantes: tout.reduce((s, l) => s + l.restant, 0),
        // Ne rien dire de ce qui est écarté ferait répondre « il reste 15 000
        // unités » alors que le plan en compte plus : le silence ment.
        fabrique_ailleurs: fabriqueAilleurs().map(l => ({
          produit: l.code, nom: l.nom, restant: l.restant, lieu: l.fabrication })),
        liste: tout.slice(0, n).map((l, i) => ({
          rang: i + 1, produit: l.code, nom: l.nom, famille: l.famille,
          ordre: l.numero,
          restant: l.restant, sur: l.quantite, avancement: l.avancement + ' %',
          priorite: l.priorite,
          echeance: l.echeance || null,
          jours_restants: l.jours,
          en_retard: l.en_retard,
          echeance_titre: l.echeance_titre || null })),
      };
    },
  },
  {
    nom: 'definir_famille',
    description: "Change la famille de production d'un produit : hiver, "
      + "nouveau, isotherme ou autre. La famille commande l'ordre de "
      + "fabrication à date d'expédition égale — l'hiver d'abord, puis les "
      + "nouveaux produits, puis les isothermes.",
    role: 'admin',
    params: { type: 'object', required: ['produit','famille'], properties: {
      produit: { type: 'string' },
      famille: { type: 'string', enum: ['hiver','nouveau','isotherme','autre'] } } },
    executer: (a, ctx) => {
      const p = resoudreProduit(a.produit);
      if (!Object.keys(FAMILLES).includes(a.famille))
        refuser(`Famille attendue : ${Object.keys(FAMILLES).join(', ')}.`);
      if (p.famille === a.famille)
        return { ok: true, inchange: true,
                 message: `${p.code} était déjà en famille ${a.famille}.` };
      db.prepare(`UPDATE produits SET famille = ?, maj_le = datetime('now')
                  WHERE id = ?`).run(a.famille, p.id);
      noter(ctx, 'definir_famille',
        `${p.code} : famille ${p.famille} → ${a.famille}`,
        { table: 'produits', op: 'update', id: p.id,
          avant: { famille: p.famille, maj_le: p.maj_le } });
      return { ok: true, produit: p.code, famille: a.famille };
    },
  },
  {
    nom: 'definir_fabrication',
    description: "Dit où un produit se fabrique : « tunisie » (l'atelier) ou "
      + "« chine ». Ce qui se fabrique ailleurs sort de la liste de l'atelier "
      + "— Montassar ne le produit pas — mais reste au plan et se suit sur "
      + "l'ordre. Sert quand un produit change de lieu, ou quand on découvre "
      + "qu'il n'a jamais été fait à l'atelier.",
    role: 'admin',
    params: { type: 'object', required: ['produit','lieu'], properties: {
      produit: { type: 'string' },
      lieu: { type: 'string', enum: ['tunisie','chine'] } } },
    executer: (a, ctx) => {
      const p = resoudreProduit(a.produit);
      if (!Object.keys(LIEUX).includes(a.lieu))
        refuser(`Lieu attendu : ${Object.keys(LIEUX).join(', ')}.`);
      if (p.fabrication === a.lieu)
        return { ok: true, inchange: true,
                 message: `${p.code} se fabriquait déjà en ${LIEUX[a.lieu]}.` };
      db.prepare(`UPDATE produits SET fabrication = ?, maj_le = datetime('now')
                  WHERE id = ?`).run(a.lieu, p.id);
      noter(ctx, 'definir_fabrication',
        `${p.code} : fabrication ${p.fabrication} → ${a.lieu}`,
        { table: 'produits', op: 'update', id: p.id,
          avant: { fabrication: p.fabrication, maj_le: p.maj_le } });
      return { ok: true, produit: p.code, lieu: a.lieu };
    },
  },
  {
    nom: 'definir_priorite',
    description: "Pose la priorité de fabrication d'un item : haute, normale ou "
      + "basse. Une priorité haute passe devant les échéances plus proches — "
      + "c'est le seul moyen de contredire le calendrier.",
    role: 'admin',
    params: { type: 'object', required: ['ordre','produit','priorite'], properties: {
      ordre: { type: 'string' }, produit: { type: 'string' },
      priorite: { type: 'string', enum: ['haute','normale','basse'] } } },
    executer: (a, ctx) => {
      const o = resoudreOrdre(a.ordre), p = resoudreProduit(a.produit);
      const it = db.prepare(`SELECT * FROM ordre_items
          WHERE ordre_id = ? AND produit_id = ?`).get(o.id, p.id);
      if (!it) refuser(`${p.code} n'est pas dans ${o.numero}.`);
      if (!['haute','normale','basse'].includes(a.priorite))
        refuser(`Priorité attendue : haute, normale ou basse.`);
      if (it.priorite === a.priorite)
        return { ok: true, inchange: true,
                 message: `${p.code} était déjà en priorité ${a.priorite}.` };
      db.prepare(`UPDATE ordre_items SET priorite = ? WHERE id = ?`)
        .run(a.priorite, it.id);
      noter(ctx, 'definir_priorite',
        `${p.code} dans ${o.numero} : priorité ${it.priorite} → ${a.priorite}`,
        { table: 'ordre_items', op: 'update', id: it.id,
          avant: { priorite: it.priorite } });
      return { ok: true, ordre: o.numero, produit: p.code, priorite: a.priorite };
    },
  },
  {
    nom: 'suivi_production',
    description: "L'état du suivi : ce qui a bougé récemment, ce qui ne bouge "
      + "plus depuis un moment, et de combien on a avancé. Répond à « est-ce "
      + "que ça avance », « qu'est-ce qui traîne », « qui a mis à jour quoi ».",
    role: 'atelier',
    params: { type: 'object', properties: {
      jours: { type: 'integer', description: 'Fenêtre en jours (défaut 7).' } } },
    executer: (a) => {
      const j = Number.isInteger(a.jours) && a.jours > 0 ? Math.min(a.jours, 90) : 7;
      return {
        fenetre_jours: j,
        sans_mouvement: sansMouvement(j).map(x => ({
          produit: x.code, ordre: x.numero, avancement: x.avancement + ' %',
          jours_sans_maj: x.jours_sans_maj })),
        progression: progressionRecente(j).map(p => ({
          ordre: p.numero, titre: p.titre, mises_a_jour: p.maj,
          unites_avancees: Math.round(p.unites_avancees) })),
        dernieres_maj: dernieresMaj(12).map(h => ({
          quand: h.cree_le, qui: h.auteur, produit: h.code, ordre: h.numero,
          de: h.avant + ' %', a: h.apres + ' %' })),
      };
    },
  },
  {
    nom: 'cedule',
    description: "Jalons à venir tous ordres confondus : deadlines, livraisons, "
      + "préventes, événements. Pour « qu'est-ce qui s'en vient ».",
    role: 'atelier',
    params: { type: 'object', properties: {
      jours: { type: 'integer', description: 'Horizon en jours (défaut 90).' } } },
    executer: (a) => {
      const j = Number.isInteger(a.jours) && a.jours > 0 ? a.jours : 90;
      return { horizon_jours: j, jalons: db.prepare(
        `SELECT o.numero, j.titre, j.date, j.type, j.note FROM ordre_jalons j
         JOIN ordres o ON o.id = j.ordre_id
         WHERE j.date >= date('now') AND j.date <= date('now', ?)
         ORDER BY j.date`).all(`+${j} days`) };
    },
  },

  // ------------------------------------------- écritures ouvertes à l'atelier
  {
    nom: 'maj_avancement',
    description: "Met à jour l'avancement d'un item d'un ordre, par tranches de "
      + "10 % (0, 10, 20 … 100). C'est l'action la plus courante : « les "
      + "cache-cous sont rendus à 70 % ».",
    role: 'atelier',
    params: { type: 'object', required: ['ordre','produit','valeur'], properties: {
      ordre:   { type: 'string' },
      produit: { type: 'string' },
      valeur:  { type: 'integer', description: 'Multiple de 10, entre 0 et 100.' } } },
    executer: (a, ctx) => {
      const o = resoudreOrdre(a.ordre), p = resoudreProduit(a.produit);
      const it = db.prepare(
        `SELECT * FROM ordre_items WHERE ordre_id = ? AND produit_id = ?`).get(o.id, p.id);
      if (!it) refuser(`${p.code} n'est pas dans l'ordre ${o.numero}.`);
      const v = Number(a.valeur);
      if (!Number.isInteger(v) || v < 0 || v > 100 || v % 10)
        refuser(`Avancement par tranches de 10 % seulement (0 à 100), reçu « ${a.valeur} ».`);
      if (v === it.avancement)
        return { ok: true, inchange: true,
                 message: `${p.code} était déjà à ${v} % dans ${o.numero}.` };

      db.prepare(`UPDATE ordre_items SET avancement = ?, maj_le = datetime('now')
                  WHERE id = ?`).run(v, it.id);
      db.prepare(`INSERT INTO avancement_historique (item_id, utilisateur_id, avant, apres)
                  VALUES (?,?,?,?)`).run(it.id, ctx.user.id, it.avancement, v);
      noter(ctx, 'maj_avancement',
        `${p.code} dans ${o.numero} : ${it.avancement} % → ${v} %`,
        { table: 'ordre_items', op: 'update', id: it.id,
          avant: { avancement: it.avancement, maj_le: it.maj_le } });

      // même bascule qu'à la main : un ordre planifié qui démarre passe en cours
      if (o.statut === 'planifie' && v > 0) {
        db.prepare(`UPDATE ordres SET statut='en_cours', maj_le=datetime('now')
                    WHERE id=?`).run(o.id);
        noter(ctx, 'maj_avancement', `${o.numero} : planifié → en cours`,
          { table: 'ordres', op: 'update', id: o.id,
            avant: { statut: o.statut, maj_le: o.maj_le } });
      }
      return { ok: true, ordre: o.numero, produit: p.code,
               avant: it.avancement, apres: v,
               avancement_ordre: avancementOrdre(o.id).pct + ' %' };
    },
  },
  {
    nom: 'commenter',
    description: "Ajoute un commentaire à un ordre : question technique, "
      + "explication, blocage. Signé au nom de l'utilisateur connecté.",
    role: 'atelier',
    params: { type: 'object', required: ['ordre','texte'], properties: {
      ordre: { type: 'string' }, texte: { type: 'string' } } },
    executer: (a, ctx) => {
      const o = resoudreOrdre(a.ordre);
      const t = String(a.texte || '').trim();
      if (!t) refuser('Commentaire vide.');
      const id = db.prepare(`INSERT INTO ordre_commentaires (ordre_id, utilisateur_id, texte)
                             VALUES (?,?,?)`).run(o.id, ctx.user.id, t).lastInsertRowid;
      noter(ctx, 'commenter', `Commentaire ajouté à ${o.numero}`,
        { table: 'ordre_commentaires', op: 'insert', id });
      return { ok: true, ordre: o.numero };
    },
  },

  // ------------------------------------------------------------------ tâches
  // Les tâches vont dans les deux sens : c'est le seul module où l'atelier a
  // exactement les mêmes droits que Québec. Montassar demande des choses, on
  // lui en demande.
  {
    nom: 'lister_taches',
    description: "Les tâches en cours. Sans argument : celles de l'utilisateur "
      + "connecté. Sert à « qu'est-ce que j'ai à faire », « qu'est-ce que j'ai "
      + "demandé à Montassar », « qu'est-ce qui traîne ».",
    role: 'atelier',
    params: { type: 'object', properties: {
      qui: { type: 'string', description:
        "Nom de la personne. Vide = l'utilisateur connecté." },
      demandees: { type: 'boolean', description:
        'true = ce que cette personne a DEMANDÉ, au lieu de ce qui lui est assigné.' },
      faites: { type: 'boolean', description: 'true = les tâches terminées.' } } },
    executer: (a, ctx) => {
      const m = a.qui ? resoudreMembre(a.qui) : { id: ctx.user.id, nom: ctx.user.nom };
      const statut = a.faites ? 'faite' : 'a_faire';
      const l = a.demandees ? D.taches({ par: m.id, statut })
                            : D.taches({ pour: m.id, statut });
      return { qui: m.nom, sens: a.demandees ? 'demandées par' : 'assignées à',
        nombre: l.length,
        taches: l.map(t => ({ id: t.id, titre: t.titre, details: t.details || undefined,
          echeance: t.echeance || undefined,
          demandeur: t.demandeur || undefined, porteur: t.porteur || undefined })) };
    },
  },
  {
    nom: 'creer_tache',
    description: "Demande quelque chose à quelqu'un. « Demande à Montassar de "
      + "vérifier le stock de molleton », « rappelle-moi de chronométrer le "
      + "chandail ». Sans destinataire, la tâche reste sans porteur et "
      + "n'importe qui peut la prendre.",
    role: 'atelier',
    params: { type: 'object', required: ['titre'], properties: {
      titre: { type: 'string', description: 'Ce qu\'il faut faire, en une ligne.' },
      pour: { type: 'string', description:
        "Nom de la personne. « moi » pour l'utilisateur connecté. Vide = personne." },
      details: { type: 'string', description: 'Ce qu\'il faut savoir pour la faire.' },
      echeance: { type: 'string', description: 'AAAA-MM-JJ, facultative.' } } },
    executer: (a, ctx) => {
      const titre = String(a.titre || '').trim();
      if (!titre) refuser('Il faut dire ce qu\'il y a à faire.');
      let porteur = null, nomPorteur = 'personne';
      if (a.pour && !/^(personne|aucun)$/i.test(a.pour)) {
        const m = /^(moi|me)$/i.test(a.pour)
          ? { id: ctx.user.id, nom: ctx.user.nom } : resoudreMembre(a.pour);
        porteur = m.id; nomPorteur = m.nom;
      }
      if (a.echeance && !/^\d{4}-\d{2}-\d{2}$/.test(a.echeance))
        refuser(`Date mal formée : « ${a.echeance} ». Il faut AAAA-MM-JJ.`);
      const id = db.prepare(`INSERT INTO taches (titre, details, cree_par, assigne_a, echeance)
                             VALUES (?,?,?,?,?)`)
        .run(titre, String(a.details || '').trim(), ctx.user.id, porteur,
             a.echeance || null).lastInsertRowid;
      noter(ctx, 'creer_tache', `Tâche « ${titre} » pour ${nomPorteur}`,
        { table: 'taches', op: 'insert', id });
      return { ok: true, id, titre, pour: nomPorteur,
               echeance: a.echeance || undefined };
    },
  },
  {
    nom: 'terminer_tache',
    description: "Marque une tâche comme faite. Donne son titre ou un bout du "
      + "titre — pas besoin du numéro.",
    role: 'atelier',
    params: { type: 'object', required: ['tache'], properties: {
      tache: { type: 'string', description: 'Titre ou bout de titre.' } } },
    executer: (a, ctx) => {
      const t = resoudreTache(a.tache, ctx.user.id);
      const avant = { statut: t.statut, faite_le: t.faite_le, faite_par: t.faite_par,
                      assigne_a: t.assigne_a };
      db.prepare(`UPDATE taches SET statut = 'faite', faite_le = datetime('now'),
                  faite_par = ?, assigne_a = COALESCE(assigne_a, ?) WHERE id = ?`)
        .run(ctx.user.id, ctx.user.id, t.id);
      noter(ctx, 'terminer_tache', `Tâche « ${t.titre} » marquée faite`,
        { table: 'taches', op: 'update', id: t.id, avant });
      return { ok: true, titre: t.titre };
    },
  },

  // ------------------------------------------------- écritures administration
  {
    nom: 'creer_ordre',
    description: "Crée un ordre de production. Le numéro est attribué "
      + "automatiquement. Ajoute ensuite les items avec ajouter_item.",
    role: 'admin',
    params: { type: 'object', required: ['titre'], properties: {
      titre: { type: 'string' },
      note:  { type: 'string', description: 'Contexte, priorités, explications.' },
      statut:{ type: 'string', enum: ['brouillon','planifie','en_cours'] } } },
    executer: (a, ctx) => {
      const titre = String(a.titre || '').trim();
      if (!titre) refuser('Titre requis.');
      const numero = prochainNumero();
      const id = db.prepare(`INSERT INTO ordres (numero, titre, statut, note, cree_par)
                             VALUES (?,?,?,?,?)`)
        .run(numero, titre, a.statut || 'planifie', String(a.note || '').trim(), ctx.user.id)
        .lastInsertRowid;
      noter(ctx, 'creer_ordre', `Ordre ${numero} créé — ${titre}`,
        { table: 'ordres', op: 'insert', id });
      return { ok: true, numero, id };
    },
  },
  {
    nom: 'ajouter_item',
    description: "Ajoute un produit à produire dans un ordre, avec sa quantité.",
    role: 'admin',
    params: { type: 'object', required: ['ordre','produit','quantite'], properties: {
      ordre: { type: 'string' }, produit: { type: 'string' },
      quantite: { type: 'integer' },
      note: { type: 'string', description: 'Coloris, tailles, précisions.' } } },
    executer: (a, ctx) => {
      const o = resoudreOrdre(a.ordre), p = resoudreProduit(a.produit);
      const q = exigerEntier(a.quantite, 'Quantité');
      const deja = db.prepare(`SELECT id FROM ordre_items
          WHERE ordre_id = ? AND produit_id = ?`).get(o.id, p.id);
      if (deja) refuser(`${p.code} est déjà dans ${o.numero} — utilise maj_item.`);
      const id = db.prepare(`INSERT INTO ordre_items (ordre_id, produit_id, quantite, note, rang)
          VALUES (?,?,?,?, (SELECT COALESCE(MAX(rang),0)+1 FROM ordre_items WHERE ordre_id=?))`)
        .run(o.id, p.id, q, String(a.note || '').trim(), o.id).lastInsertRowid;
      noter(ctx, 'ajouter_item', `${q} × ${p.code} ajouté à ${o.numero}`,
        { table: 'ordre_items', op: 'insert', id });
      return { ok: true, ordre: o.numero, produit: p.code, quantite: q };
    },
  },
  {
    nom: 'maj_item',
    description: "Change la quantité ou la note d'un item déjà dans un ordre.",
    role: 'admin',
    params: { type: 'object', required: ['ordre','produit'], properties: {
      ordre: { type: 'string' }, produit: { type: 'string' },
      quantite: { type: 'integer' }, note: { type: 'string' } } },
    executer: (a, ctx) => {
      const o = resoudreOrdre(a.ordre), p = resoudreProduit(a.produit);
      const it = db.prepare(`SELECT * FROM ordre_items
          WHERE ordre_id = ? AND produit_id = ?`).get(o.id, p.id);
      if (!it) refuser(`${p.code} n'est pas dans ${o.numero}.`);
      const maj = {}, avant = {};
      if (a.quantite !== undefined) {
        maj.quantite = exigerEntier(a.quantite, 'Quantité'); avant.quantite = it.quantite;
      }
      if (a.note !== undefined) { maj.note = String(a.note).trim(); avant.note = it.note; }
      if (!Object.keys(maj).length) refuser('Rien à changer.');
      avant.maj_le = it.maj_le;
      const cols = Object.keys(maj);
      db.prepare(`UPDATE ordre_items SET ${cols.map(c => `${c}=?`).join(', ')},
                  maj_le = datetime('now') WHERE id = ?`)
        .run(...cols.map(c => maj[c]), it.id);
      noter(ctx, 'maj_item',
        `${p.code} dans ${o.numero} : ` + cols.map(c => `${c} ${avant[c]} → ${maj[c]}`).join(', '),
        { table: 'ordre_items', op: 'update', id: it.id, avant });
      return { ok: true, ordre: o.numero, produit: p.code, ...maj };
    },
  },
  {
    nom: 'retirer_item',
    description: "Retire un produit d'un ordre. Réversible.",
    role: 'admin',
    params: { type: 'object', required: ['ordre','produit'], properties: {
      ordre: { type: 'string' }, produit: { type: 'string' } } },
    executer: (a, ctx) => {
      const o = resoudreOrdre(a.ordre), p = resoudreProduit(a.produit);
      const it = db.prepare(`SELECT * FROM ordre_items
          WHERE ordre_id = ? AND produit_id = ?`).get(o.id, p.id);
      if (!it) refuser(`${p.code} n'est pas dans ${o.numero}.`);
      db.prepare(`DELETE FROM ordre_items WHERE id = ?`).run(it.id);
      noter(ctx, 'retirer_item', `${p.code} retiré de ${o.numero} (${it.quantite} unités)`,
        { table: 'ordre_items', op: 'delete', ligne: it });
      return { ok: true, ordre: o.numero, produit: p.code };
    },
  },
  {
    nom: 'maj_ordre',
    description: "Change le titre, le statut ou la note d'un ordre.",
    role: 'admin',
    params: { type: 'object', required: ['ordre'], properties: {
      ordre: { type: 'string' }, titre: { type: 'string' },
      statut: { type: 'string', enum: ['brouillon','planifie','en_cours','termine','annule'] },
      note: { type: 'string' } } },
    executer: (a, ctx) => {
      const o = resoudreOrdre(a.ordre);
      const maj = {}, avant = {};
      for (const c of ['titre','statut','note'])
        if (a[c] !== undefined) { maj[c] = String(a[c]).trim(); avant[c] = o[c]; }
      if (!Object.keys(maj).length) refuser('Rien à changer.');
      avant.maj_le = o.maj_le;
      const cols = Object.keys(maj);
      db.prepare(`UPDATE ordres SET ${cols.map(c => `${c}=?`).join(', ')},
                  maj_le = datetime('now') WHERE id = ?`).run(...cols.map(c => maj[c]), o.id);
      noter(ctx, 'maj_ordre',
        `${o.numero} : ` + cols.map(c => `${c} « ${avant[c]} » → « ${maj[c]} »`).join(', '),
        { table: 'ordres', op: 'update', id: o.id, avant });
      return { ok: true, numero: o.numero, ...maj };
    },
  },
  {
    nom: 'ajouter_jalon',
    description: "Ajoute une date à la cédule d'un ordre : deadline, livraison, "
      + "prévente ou événement. C'est ce qui rend visible « ce qui s'en vient ».",
    role: 'admin',
    params: { type: 'object', required: ['ordre','titre','date'], properties: {
      ordre: { type: 'string' }, titre: { type: 'string' },
      date: { type: 'string', description: 'AAAA-MM-JJ' },
      type: { type: 'string', enum: ['expedition','livraison','deadline','evenement','prevente'] },
      note: { type: 'string' } } },
    executer: (a, ctx) => {
      const o = resoudreOrdre(a.ordre);
      const titre = String(a.titre || '').trim();
      if (!titre) refuser('Titre du jalon requis.');
      const date = exigerDate(a.date);
      const type = ['expedition','livraison','deadline','evenement','prevente'].includes(a.type)
        ? a.type : 'deadline';
      const id = db.prepare(`INSERT INTO ordre_jalons (ordre_id, titre, date, type, note)
          VALUES (?,?,?,?,?)`).run(o.id, titre, date, type, String(a.note || '').trim())
        .lastInsertRowid;
      noter(ctx, 'ajouter_jalon', `Jalon « ${titre} » le ${date} sur ${o.numero}`,
        { table: 'ordre_jalons', op: 'insert', id });
      return { ok: true, ordre: o.numero, titre, date, type };
    },
  },
  {
    nom: 'retirer_jalon',
    description: "Retire un jalon de la cédule d'un ordre, par son titre.",
    role: 'admin',
    params: { type: 'object', required: ['ordre','titre'], properties: {
      ordre: { type: 'string' }, titre: { type: 'string' } } },
    executer: (a, ctx) => {
      const o = resoudreOrdre(a.ordre);
      const t = String(a.titre || '').trim();
      const js = db.prepare(`SELECT * FROM ordre_jalons WHERE ordre_id = ? AND titre LIKE ?`)
        .all(o.id, `%${t}%`);
      if (!js.length) refuser(`Aucun jalon « ${t} » sur ${o.numero}.`);
      if (js.length > 1) refuser(
        `${js.length} jalons correspondent : ` + js.map(j => `${j.titre} (${j.date})`).join(', '));
      db.prepare(`DELETE FROM ordre_jalons WHERE id = ?`).run(js[0].id);
      noter(ctx, 'retirer_jalon', `Jalon « ${js[0].titre} » (${js[0].date}) retiré de ${o.numero}`,
        { table: 'ordre_jalons', op: 'delete', ligne: js[0] });
      return { ok: true, ordre: o.numero, retire: js[0].titre };
    },
  },
  {
    nom: 'creer_produit',
    description: "Crée une fiche produit. Le code doit être unique (ex. CC-ADULTE).",
    role: 'admin',
    params: { type: 'object', required: ['code','nom'], properties: {
      code: { type: 'string' }, nom: { type: 'string' },
      description: { type: 'string', description: "C'est quoi." },
      usage: { type: 'string', description: "À quoi ça sert, comment ça s'utilise." },
      notes_tech: { type: 'string', description: 'Sens de coupe, contraintes, particularités.' } } },
    executer: (a, ctx) => {
      const code = String(a.code || '').trim().toUpperCase();
      const nom = String(a.nom || '').trim();
      if (!code || !nom) refuser('Code et nom requis.');
      if (db.prepare(`SELECT 1 FROM produits WHERE code = ? COLLATE NOCASE`).get(code))
        refuser(`Le code ${code} existe déjà.`);
      const id = db.prepare(`INSERT INTO produits (code, nom, description, usage, notes_tech)
          VALUES (?,?,?,?,?)`).run(code, nom, String(a.description || '').trim(),
          String(a.usage || '').trim(), String(a.notes_tech || '').trim()).lastInsertRowid;
      noter(ctx, 'creer_produit', `Fiche ${code} créée — ${nom}`,
        { table: 'produits', op: 'insert', id });
      return { ok: true, code, id };
    },
  },
  {
    nom: 'maj_produit',
    description: "Met à jour une fiche produit : nom, description, usage ou "
      + "notes techniques. Sert à répondre durablement à une question technique "
      + "— « le bandeau se coupe dans le sens de la longueur » va dans notes_tech.",
    role: 'admin',
    params: { type: 'object', required: ['produit'], properties: {
      produit: { type: 'string' }, nom: { type: 'string' },
      description: { type: 'string' }, usage: { type: 'string' },
      notes_tech: { type: 'string' } } },
    executer: (a, ctx) => {
      const p = resoudreProduit(a.produit);
      const maj = {}, avant = {};
      for (const c of ['nom','description','usage','notes_tech'])
        if (a[c] !== undefined) { maj[c] = String(a[c]).trim(); avant[c] = p[c]; }
      if (!Object.keys(maj).length) refuser('Rien à changer.');
      avant.maj_le = p.maj_le;
      const cols = Object.keys(maj);
      db.prepare(`UPDATE produits SET ${cols.map(c => `${c}=?`).join(', ')},
                  maj_le = datetime('now') WHERE id = ?`).run(...cols.map(c => maj[c]), p.id);
      noter(ctx, 'maj_produit', `Fiche ${p.code} : ${cols.join(', ')} mis à jour`,
        { table: 'produits', op: 'update', id: p.id, avant });
      return { ok: true, code: p.code, champs: cols };
    },
  },
  {
    nom: 'ajouter_materiau',
    description: "Ajoute un matériau à une fiche produit (tissu, quincaillerie, "
      + "fourniture, étiquette).",
    role: 'admin',
    params: { type: 'object', required: ['produit','nom'], properties: {
      produit: { type: 'string' }, nom: { type: 'string' },
      detail: { type: 'string', description: 'Coloris, grammage, position.' } } },
    executer: (a, ctx) => {
      const p = resoudreProduit(a.produit);
      const nom = String(a.nom || '').trim();
      if (!nom) refuser('Nom du matériau requis.');
      const id = db.prepare(`INSERT INTO produit_materiaux (produit_id, nom, detail, rang)
          VALUES (?,?,?, (SELECT COALESCE(MAX(rang),0)+1 FROM produit_materiaux WHERE produit_id=?))`)
        .run(p.id, nom, String(a.detail || '').trim(), p.id).lastInsertRowid;
      noter(ctx, 'ajouter_materiau', `Matériau « ${nom} » ajouté à ${p.code}`,
        { table: 'produit_materiaux', op: 'insert', id });
      return { ok: true, produit: p.code, materiau: nom };
    },
  },
  {
    nom: 'ajouter_patron',
    description: "Rattache un patron à une fiche produit (format hpgl, dxf, pdf, ai).",
    role: 'admin',
    params: { type: 'object', required: ['produit','nom'], properties: {
      produit: { type: 'string' }, nom: { type: 'string' },
      format: { type: 'string', enum: ['hpgl','dxf','pdf','ai'] },
      dimensions: { type: 'string', description: 'ex. « 67,9 x 52,1 cm »' },
      url: { type: 'string', description: 'Lien http(s) — aucun fichier n\'est hébergé ici.' },
      note: { type: 'string' } } },
    executer: (a, ctx) => {
      const p = resoudreProduit(a.produit);
      const nom = String(a.nom || '').trim();
      if (!nom) refuser('Nom du patron requis.');
      const url = String(a.url || '').trim();
      if (url && !urlAcceptable(url))
        refuser("L'adresse du patron doit être un lien http(s) : l'app n'héberge aucun fichier.");
      const id = db.prepare(`INSERT INTO produit_patrons
          (produit_id, nom, url, format, dimensions, note, rang)
          VALUES (?,?,?,?,?,?, (SELECT COALESCE(MAX(rang),0)+1 FROM produit_patrons WHERE produit_id=?))`)
        .run(p.id, nom, url, String(a.format || '').trim(), String(a.dimensions || '').trim(),
             String(a.note || '').trim(), p.id).lastInsertRowid;
      noter(ctx, 'ajouter_patron', `Patron « ${nom} » rattaché à ${p.code}`,
        { table: 'produit_patrons', op: 'insert', id });
      return { ok: true, produit: p.code, patron: nom };
    },
  },
  {
    nom: 'ajouter_photo',
    description: "Rattache une photo à une fiche produit. L'app n'héberge aucun "
      + "fichier : il faut une URL http(s) (Shopify, Drive), qui sera "
      + "redimensionnée à l'affichage par le CDN d'origine.",
    role: 'admin',
    params: { type: 'object', required: ['produit','url'], properties: {
      produit: { type: 'string' }, url: { type: 'string' },
      type: { type: 'string', enum: ['studio','contexte'] },
      legende: { type: 'string' } } },
    executer: (a, ctx) => {
      const p = resoudreProduit(a.produit);
      if (!urlAcceptable(a.url))
        refuser("Adresse d'image refusée : il faut un lien http(s). "
              + "L'app n'héberge aucun fichier.");
      const id = db.prepare(`INSERT INTO produit_photos (produit_id, url, type, legende, rang)
          VALUES (?,?,?,?, (SELECT COALESCE(MAX(rang),0)+1 FROM produit_photos WHERE produit_id=?))`)
        .run(p.id, String(a.url).trim(), a.type === 'contexte' ? 'contexte' : 'studio',
             String(a.legende || '').trim(), p.id).lastInsertRowid;
      noter(ctx, 'ajouter_photo', `Photo ajoutée à ${p.code}`,
        { table: 'produit_photos', op: 'insert', id });
      return { ok: true, produit: p.code };
    },
  },
];

const PAR_NOM = new Map(OUTILS.map(o => [o.nom, o]));

/** Outils visibles pour un rôle — l'atelier ne voit même pas les autres. */
const pourRole = (role) =>
  OUTILS.filter(o => role === 'admin' || o.role === 'atelier');

/** Schémas au format attendu par l'API Anthropic. */
const schemas = (role) => pourRole(role).map(o => ({
  name: o.nom, description: o.description, input_schema: o.params,
}));

/**
 * Exécute un outil. Ne lève jamais : renvoie {erreur} que le modèle peut lire
 * et corriger tout seul (mauvais code produit, ordre ambigu…).
 */
function executer(nom, args, ctx) {
  const outil = PAR_NOM.get(nom);
  if (!outil) return { erreur: `Outil inconnu : ${nom}` };
  if (outil.role === 'admin' && ctx.user.role !== 'admin')
    return { erreur: `« ${nom} » est réservé à Admin QC. `
           + `${ctx.user.nom} est à l'atelier : avancement et commentaires seulement.` };
  try {
    return outil.executer(args || {}, ctx);
  } catch (e) {
    if (e instanceof Refus) return { erreur: e.message };
    console.error(`[assistant] ${nom} :`, e);
    return { erreur: `Échec de ${nom} : ${e.message}` };
  }
}

module.exports = { OUTILS, schemas, executer, annulerTour, pourRole,
                   dernierTourAnnulable,
                   resoudreOrdre, resoudreProduit, resoudreMembre, resoudreTache };
