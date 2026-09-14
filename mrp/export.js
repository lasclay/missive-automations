/**
 * Lasclay — MRP : l'export en lecture seule
 * ---------------------------------------------------------------------------
 * POURQUOI CE FICHIER EXISTE
 *
 * Le 14 septembre 2026, un plan de chargement de conteneur a été calculé sur
 * un ordre de production « à 0 % d'avancement ». Il était à 42 %. Les
 * cache-cous étaient finis depuis des jours.
 *
 * L'erreur n'était pas dans le calcul : elle était dans la source. L'analyse
 * lisait la copie locale du dépôt — celle qui se recrée depuis les TSV et ne
 * voit jamais ce que l'atelier déclare. Les vraies données vivent sur le disque
 * de Render, derrière une session, et rien ne permettait de les lire de
 * l'extérieur. Personne ne pouvait voir que l'analyse partait de zéro : ni
 * celui qui la produisait, ni celui qui la lisait.
 *
 * Cette route rend l'état réel lisible. Une analyse fausse restera possible ;
 * une analyse fausse SANS QU'ON PUISSE LE SAVOIR, non.
 *
 * CE QU'ELLE N'EST PAS
 *
 * Pas une API. Un instantané, en un seul appel, en lecture seule. Rien ne s'y
 * écrit, aucune donnée personnelle n'y passe : ni les comptes, ni les mots de
 * passe, ni le texte des signalements clients — qui, même anonymisé, n'a rien
 * à faire dans un export de production.
 *
 * ÉTEINTE PAR DÉFAUT
 *
 * Sans `MRP_JETON_EXPORT` dans l'environnement, la route n'existe pas : elle
 * retombe sur le routeur ordinaire, qui la traite comme n'importe quelle
 * adresse inconnue et renvoie vers la connexion. Rien ne dit qu'elle pourrait
 * exister, et surtout rien ne sort. Un jeton trop court est traité comme
 * absent plutôt qu'accepté en silence.
 */
'use strict';
const { timingSafeEqual } = require('node:crypto');
const { db } = require('./db.js');

const JETON = process.env.MRP_JETON_EXPORT || '';
const MIN = 24;

/** La route est-elle armée ? */
const armee = () => JETON.length >= MIN;

/** Pourquoi elle ne l'est pas, pour le journal de démarrage. */
function raisonCoupure() {
  if (!JETON) return 'MRP_JETON_EXPORT absent';
  if (JETON.length < MIN) return `MRP_JETON_EXPORT trop court (${JETON.length} < ${MIN})`;
  return null;
}

/**
 * Comparaison à durée constante.
 *
 * `a === b` sort à la première différence : le temps de réponse trahit alors
 * combien de caractères sont bons, et un jeton se devine caractère par
 * caractère. Les longueurs sont comparées d'abord parce que timingSafeEqual
 * lève si elles diffèrent — ce que la longueur révèle n'est pas un secret.
 */
function jetonValide(fourni) {
  const a = Buffer.from(String(fourni || ''));
  const b = Buffer.from(JETON);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * L'instantané.
 *
 * Tout ce qu'il faut pour répondre à « qu'est-ce qui est produit, et qu'est-ce
 * qui manque » — et rien d'autre. Un seul appel : une analyse qui doit faire
 * huit requêtes pour se faire une idée en fait sept et demie.
 */
function instantane() {
  const ordres = db.prepare(`
    SELECT id, numero, titre, statut, cree_le, maj_le FROM ordres
     WHERE statut IN ('brouillon','planifie','en_cours') ORDER BY id`).all();

  const items = db.prepare(`
    SELECT i.id, i.ordre_id, p.code, i.quantite, i.avancement, i.note, i.maj_le
      FROM ordre_items i JOIN produits p ON p.id = i.produit_id
     ORDER BY i.ordre_id, i.rang, i.id`).all();

  const variantes = db.prepare(`
    SELECT item_id, groupe, nom, quantite FROM item_variantes ORDER BY item_id, rang`).all();

  const jalons = db.prepare(`
    SELECT ordre_id, titre, date, type FROM ordre_jalons ORDER BY date`).all();

  // L'historique dit QUAND ça a bougé, ce que l'avancement seul ne dit pas.
  // Les trente derniers suffisent à voir si l'atelier déclare ou pas.
  const declarations = db.prepare(`
    SELECT a.item_id, p.code, a.avant, a.apres, a.cree_le
      FROM avancement_historique a
      JOIN ordre_items i ON i.id = a.item_id
      JOIN produits p ON p.id = i.produit_id
     ORDER BY a.id DESC LIMIT 30`).all();

  const parItem = {};
  for (const v of variantes) (parItem[v.item_id] ||= []).push(
    { nom: v.nom, groupe: v.groupe || undefined, quantite: v.quantite });

  const { silenceAtelier } = require('./rappels.js');

  return {
    genere_le: new Date().toISOString(),
    ordres: ordres.map(o => ({
      ...o,
      jalons: jalons.filter(j => j.ordre_id === o.id).map(({ ordre_id, ...j }) => j),
      items: items.filter(i => i.ordre_id === o.id).map(({ ordre_id, ...i }) => ({
        ...i, note: i.note || undefined, variantes: parItem[i.id] || [] })),
    })),
    declarations,
    silence_atelier: silenceAtelier(),
  };
}

/**
 * Sert la route si elle est armée et le jeton bon. Renvoie `false` quand ce
 * n'est pas son adresse, pour que le routeur continue son chemin.
 */
function servir(req, res, url) {
  if (url.pathname !== '/export.json') return false;
  // Non armée : on rend la main au routeur, qui répondra comme pour n'importe
  // quelle adresse inconnue. On ne dit pas « il manque un jeton » — ça
  // annoncerait une porte à qui n'en cherchait pas.
  if (!armee()) return false;

  const fourni = req.headers['x-mrp-jeton']
    || url.searchParams.get('jeton') || '';
  if (!jetonValide(fourni)) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'jeton invalide' }));
    return true;
  }
  const corps = JSON.stringify(instantane(), null, 2);
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8',
                       'cache-control': 'no-store' });
  res.end(corps);
  return true;
}

module.exports = { servir, instantane, armee, raisonCoupure, jetonValide };
