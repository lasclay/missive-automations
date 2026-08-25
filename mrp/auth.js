/**
 * Lasclay — MRP : authentification
 * ---------------------------------------------------------------------------
 * Mots de passe : scrypt (node:crypto), sel aléatoire par utilisateur.
 * Sessions    : jeton aléatoire en base, cookie HttpOnly + SameSite=Lax.
 * Aucune dépendance externe.
 *
 * Deux rôles :
 *   admin   — Québec : tout, y compris créer des ordres et des fiches produits
 *   atelier — Tunisie : consulter, mettre à jour l'avancement, commenter
 */
'use strict';
const crypto = require('node:crypto');
const { db } = require('./db.js');

const DUREE_SESSION_JOURS = 30;

// ------------------------------------------------------------------ mots de passe
function hacher(mdp) {
  const sel = crypto.randomBytes(16);
  const dk = crypto.scryptSync(mdp, sel, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${sel.toString('base64')}$${dk.toString('base64')}`;
}

function verifier(mdp, stocke) {
  try {
    const [alg, N, r, p, sel64, dk64] = stocke.split('$');
    if (alg !== 'scrypt') return false;
    const attendu = Buffer.from(dk64, 'base64');
    const calcule = crypto.scryptSync(mdp, Buffer.from(sel64, 'base64'), attendu.length,
                                      { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(attendu, calcule);
  } catch { return false; }
}

// ---------------------------------------------------------------------- sessions
function ouvrirSession(utilisateurId) {
  const jeton = crypto.randomBytes(32).toString('base64url');
  const exp = new Date(Date.now() + DUREE_SESSION_JOURS * 864e5).toISOString();
  db.prepare(`INSERT INTO sessions (jeton, utilisateur_id, expire_le) VALUES (?,?,?)`)
    .run(jeton, utilisateurId, exp);
  return jeton;
}

function fermerSession(jeton) {
  if (jeton) db.prepare(`DELETE FROM sessions WHERE jeton = ?`).run(jeton);
}

function utilisateurDeSession(jeton) {
  if (!jeton) return null;
  const r = db.prepare(`
    SELECT u.id, u.courriel, u.nom, u.role
      FROM sessions s JOIN utilisateurs u ON u.id = s.utilisateur_id
     WHERE s.jeton = ? AND s.expire_le > datetime('now') AND u.actif = 1`).get(jeton);
  return r || null;
}

/** Purge les sessions expirées. Appelée au démarrage. */
function menage() {
  db.prepare(`DELETE FROM sessions WHERE expire_le <= datetime('now')`).run();
}

// ------------------------------------------------------------------ utilisateurs
function creerUtilisateur({ courriel, mdp, nom, role = 'atelier' }) {
  return db.prepare(
    `INSERT INTO utilisateurs (courriel, mdp_hash, nom, role) VALUES (?,?,?,?)`
  ).run(courriel.trim().toLowerCase(), hacher(mdp), nom.trim(), role);
}

/**
 * Change le mot de passe d'un utilisateur, après avoir vérifié l'ancien.
 *
 * Toutes les autres sessions sont fermées : un mot de passe qu'on change
 * parce qu'il a fuité ne sert à rien si la session ouverte avec l'ancien
 * continue de fonctionner. Celle du navigateur courant est épargnée, sinon
 * on se déconnecte soi-même en changeant son mot de passe.
 */
function changerMotDePasse({ utilisateurId, ancien, nouveau, jetonAGarder = null }) {
  const u = db.prepare(`SELECT * FROM utilisateurs WHERE id = ? AND actif = 1`)
              .get(utilisateurId);
  if (!u) return { erreur: 'Compte introuvable.' };
  if (!verifier(String(ancien || ''), u.mdp_hash))
    return { erreur: 'Mot de passe actuel incorrect.' };
  const n = String(nouveau || '');
  if (n.length < 8)
    return { erreur: 'Le nouveau mot de passe doit faire au moins 8 caractères.' };
  if (verifier(n, u.mdp_hash))
    return { erreur: 'Le nouveau mot de passe est identique à l\'ancien.' };

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE utilisateurs SET mdp_hash = ? WHERE id = ?`).run(hacher(n), u.id);
    if (jetonAGarder)
      db.prepare(`DELETE FROM sessions WHERE utilisateur_id = ? AND jeton <> ?`)
        .run(u.id, jetonAGarder);
    else
      db.prepare(`DELETE FROM sessions WHERE utilisateur_id = ?`).run(u.id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { ok: true };
}

function connecter(courriel, mdp) {
  const u = db.prepare(
    `SELECT * FROM utilisateurs WHERE courriel = ? AND actif = 1`
  ).get(String(courriel || '').trim().toLowerCase());
  if (!u) {
    // coût constant : on hache quand même pour ne pas révéler l'existence du compte
    hacher(String(mdp || 'x'));
    return null;
  }
  if (!verifier(String(mdp || ''), u.mdp_hash)) return null;
  return { id: u.id, courriel: u.courriel, nom: u.nom, role: u.role };
}

module.exports = { hacher, verifier, ouvrirSession, fermerSession,
                   utilisateurDeSession, creerUtilisateur, connecter, menage,
                   changerMotDePasse };
