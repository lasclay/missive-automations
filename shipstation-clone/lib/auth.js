/**
 * Authentification — comptes employés, mots de passe, sessions.
 *
 * Remplace le secret partagé unique, qui convenait à un outil local et ne convient plus à un
 * service accessible par plusieurs personnes : un secret partagé ne dit pas QUI a annulé une
 * commande, ne se révoque pas pour une seule personne, et circule dans les URL.
 *
 * Mots de passe : scrypt (node:crypto), sel aléatoire par compte, comparaison à temps
 * constant. Aucune dépendance externe.
 * Sessions : jeton aléatoire de 32 octets, stocké haché en base, cookie HttpOnly + SameSite,
 * Secure dès que le service est derrière HTTPS.
 */
const crypto = require("crypto");
const { all, one, run, maintenant, journaliser, dump, parse } = require("./db");
const totp = require("./totp");
const qr = require("./qr");

const EMETTEUR = process.env.CLONE_2FA_EMETTEUR || "Lasclay Expéditions";

const DUREE_SESSION_H = Number(process.env.CLONE_SESSION_HEURES || 12);
const SECURE = process.env.CLONE_COOKIE_SECURE !== "0";   // désactivable pour du HTTP local
const MAX_ESSAIS = 8;                                     // par compte et par fenêtre
const FENETRE_MIN = 15;

// ------------------------------------------------------------------ mots de passe

const N = 16384, r = 8, p = 1, LONGUEUR = 64;

function hacher(motDePasse, sel = crypto.randomBytes(16).toString("hex")) {
  const dk = crypto.scryptSync(String(motDePasse), sel, LONGUEUR, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${sel}$${dk.toString("hex")}`;
}

function verifier(motDePasse, stocke) {
  try {
    const [algo, n, rr, pp, sel, hex] = String(stocke).split("$");
    if (algo !== "scrypt") return false;
    const dk = crypto.scryptSync(String(motDePasse), sel, Buffer.from(hex, "hex").length,
      { N: Number(n), r: Number(rr), p: Number(pp), maxmem: 64 * 1024 * 1024 });
    return crypto.timingSafeEqual(dk, Buffer.from(hex, "hex"));
  } catch { return false; }
}

/** Exigence minimale — pas de politique baroque, juste de quoi résister à une liste courte. */
function valider(motDePasse) {
  const m = String(motDePasse || "");
  if (m.length < 10) return "au moins 10 caractères";
  if (/^[0-9]+$/.test(m)) return "pas uniquement des chiffres";
  if (["motdepasse", "password1", "lasclay123", "1234567890"].includes(m.toLowerCase()))
    return "mot de passe trop courant";
  return null;
}

/** Proposition de mot de passe initial — lisible, à transmettre puis à changer. */
function suggerer() {
  const mots = ["asclepiade", "monarque", "capucins", "boreal", "erable", "quebec", "soie", "duvet",
    "riviere", "tundra", "cedre", "givre", "orignal", "harfang", "epinette"];
  const pick = () => mots[crypto.randomInt(mots.length)];
  return `${pick()}-${pick()}-${crypto.randomInt(100, 999)}`;
}

// ------------------------------------------------------------------ comptes

function creerCompte({ name, email, role = "preparateur", motDePasse = null, permissions = null }) {
  if (!email) throw new Error("courriel requis");
  const accounts = require("./accounts");
  const existe = one("SELECT id FROM users WHERE lower(email) = lower(?)", email);
  if (existe) throw new Error("un compte existe déjà avec ce courriel");
  const mdp = motDePasse || suggerer();
  const souci = valider(mdp);
  if (souci) throw new Error(`mot de passe : ${souci}`);
  const id = crypto.randomUUID();
  const perms = permissions || { role, ...(accounts.ROLES[role] || {}) };
  run(`INSERT INTO users (id,name,email,active,permissions,created_at,password_hash,must_change)
       VALUES (?,?,?,1,?,?,?,?)`,
    id, name, email.toLowerCase(), dump(perms), maintenant(), hacher(mdp), motDePasse ? 0 : 1);
  journaliser("auth.account_create", "user", id, { email, role });
  return { id, motDePasse: motDePasse ? null : mdp };
}

function changerMotDePasse(userId, nouveau, { parAdmin = false } = {}) {
  const souci = valider(nouveau);
  if (souci) throw new Error(`mot de passe : ${souci}`);
  run("UPDATE users SET password_hash = ?, must_change = ? WHERE id = ?", hacher(nouveau), parAdmin ? 1 : 0, userId);
  if (!parAdmin) run("DELETE FROM sessions WHERE user_id = ?", userId);   // déconnecte les autres appareils
  journaliser("auth.password_change", "user", userId, { parAdmin });
}

// ------------------------------------------------------------------ connexion

function tropDEssais(email) {
  const depuis = new Date(Date.now() - FENETRE_MIN * 60000).toISOString();
  return one(`SELECT COUNT(*) n FROM login_attempts WHERE lower(email) = lower(?) AND at > ? AND ok = 0`,
    email, depuis).n >= MAX_ESSAIS;
}

/**
 * Tente une connexion. Renvoie {token, user} ou lance. Le message d'erreur est
 * volontairement identique pour un courriel inconnu et un mot de passe faux.
 */
function connecter(email, motDePasse, { ip = null, agent = null } = {}) {
  const generique = new Error("courriel ou mot de passe incorrect");
  if (!email || !motDePasse) throw generique;
  if (tropDEssais(email)) {
    const e = new Error(`trop de tentatives — réessayer dans ${FENETRE_MIN} minutes`);
    e.code = 429;
    throw e;
  }
  const u = one("SELECT * FROM users WHERE lower(email) = lower(?)", email);
  const ok = !!u && u.active && !!u.password_hash && verifier(motDePasse, u.password_hash);
  run("INSERT INTO login_attempts (email, at, ok, ip) VALUES (?,?,?,?)",
    String(email).toLowerCase(), maintenant(), ok ? 1 : 0, ip);
  if (!ok) { journaliser("auth.login_failed", "user", u ? u.id : null, { email, ip }); throw generique; }

  // Second facteur activé : la session naît « en attente ». Tant qu'elle l'est, elle
  // n'ouvre aucun accès — le mot de passe seul ne suffit pas.
  const attente = !!u.totp_enabled;
  const token = crypto.randomBytes(32).toString("base64url");
  const expire = new Date(Date.now() + (attente ? 5 * 60000 : DUREE_SESSION_H * 3600000)).toISOString();
  run(`INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip, agent, pending)
       VALUES (?,?,?,?,?,?,?)`,
    hacherJeton(token), u.id, maintenant(), expire, ip, String(agent || "").slice(0, 200), attente ? 1 : 0);
  journaliser(attente ? "auth.login_facteur1" : "auth.login", "user", u.id, { ip }, u.id);
  return { token, expire, besoin2fa: attente, user: attente ? null : publiciser(u) };
}

// ------------------------------------------------------------------ second facteur

/**
 * Valide le second facteur d'une session en attente et la promeut en session pleine.
 * Accepte un code TOTP à six chiffres ou un code de secours à usage unique.
 */
function verifier2facteur(token, code, { ip = null } = {}) {
  const generique = new Error("code incorrect");
  const s = one("SELECT * FROM sessions WHERE token_hash = ?", hacherJeton(token || ""));
  if (!s || !s.pending) throw new Error("aucune connexion en attente — recommencer");
  if (s.expires_at <= maintenant()) {
    run("DELETE FROM sessions WHERE token_hash = ?", s.token_hash);
    throw new Error("délai dépassé — recommencer la connexion");
  }
  const u = one("SELECT * FROM users WHERE id = ? AND active = 1", s.user_id);
  if (!u || !u.totp_enabled) throw generique;

  // Même limitation que sur le mot de passe : six chiffres se devinent.
  if (tropDEssais(`2fa:${u.email}`)) { const e = new Error(`trop de tentatives — réessayer dans ${FENETRE_MIN} minutes`); e.code = 429; throw e; }

  const saisi = String(code || "").trim();
  let methode = null;

  const pas = totp.verifier(u.totp_secret, saisi, { dernierPas: u.totp_last_step || 0 });
  if (pas) {
    run("UPDATE users SET totp_last_step = ? WHERE id = ?", pas, u.id);   // interdit le rejeu
    methode = "totp";
  } else {
    const restants = totp.consommerCodeSecours(parse(u.recovery_codes, []) || [], saisi);
    if (restants) {
      run("UPDATE users SET recovery_codes = ? WHERE id = ?", dump(restants), u.id);
      methode = "secours";
      journaliser("auth.code_secours_utilise", "user", u.id, { restants: restants.length }, u.id);
    }
  }

  run("INSERT INTO login_attempts (email, at, ok, ip) VALUES (?,?,?,?)",
    `2fa:${u.email}`, maintenant(), methode ? 1 : 0, ip);
  if (!methode) { journaliser("auth.2fa_echec", "user", u.id, { ip }, u.id); throw generique; }

  const expire = new Date(Date.now() + DUREE_SESSION_H * 3600000).toISOString();
  run("UPDATE sessions SET pending = 0, expires_at = ? WHERE token_hash = ?", expire, s.token_hash);
  journaliser("auth.login", "user", u.id, { ip, methode }, u.id);
  return { expire, methode, user: publiciser(u) };
}

/**
 * Prépare l'activation : génère un secret, le stocke SANS activer, et rend de quoi le
 * transférer dans l'application d'authentification. Rien n'est actif tant qu'un premier
 * code n'a pas été vérifié — sinon une erreur de scan enfermerait l'employé dehors.
 */
function preparer2facteur(userId) {
  const u = one("SELECT * FROM users WHERE id = ?", userId);
  if (!u) throw new Error("compte inconnu");
  if (u.totp_enabled) throw new Error("le second facteur est déjà actif");
  const secret = totp.genererSecret();
  run("UPDATE users SET totp_secret = ? WHERE id = ?", secret, userId);
  const lien = totp.uri(secret, { compte: u.email, emetteur: EMETTEUR });
  return { secret, lisible: totp.lisible(secret), uri: lien, qr: qr.svg(lien, { module: 5 }) };
}

/** Active après vérification d'un premier code. Renvoie les codes de secours, affichés une fois. */
function activer2facteur(userId, code) {
  const u = one("SELECT * FROM users WHERE id = ?", userId);
  if (!u || !u.totp_secret) throw new Error("aucune configuration en cours");
  const pas = totp.verifier(u.totp_secret, code, { dernierPas: 0 });
  if (!pas) throw new Error("code incorrect — vérifier l'heure du téléphone");
  const codes = totp.genererCodesSecours(10);
  run("UPDATE users SET totp_enabled = 1, totp_last_step = ?, recovery_codes = ? WHERE id = ?",
    pas, dump(codes.map(totp.hacherCode)), userId);
  journaliser("auth.2fa_active", "user", userId, null, userId);
  return { codes };
}

/** Désactivation — exige le mot de passe, sinon une session volée suffirait à retirer le 2FA. */
function desactiver2facteur(userId, motDePasse) {
  const u = one("SELECT * FROM users WHERE id = ?", userId);
  if (!u || !verifier(motDePasse, u.password_hash)) throw new Error("mot de passe incorrect");
  run("UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_last_step = 0, recovery_codes = NULL WHERE id = ?", userId);
  journaliser("auth.2fa_desactive", "user", userId, null, userId);
}

/** Réinitialisation par un administrateur — pour un téléphone perdu sans code de secours. */
function reinitialiser2facteur(userId, parQui) {
  run("UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_last_step = 0, recovery_codes = NULL WHERE id = ?", userId);
  run("DELETE FROM sessions WHERE user_id = ?", userId);
  journaliser("auth.2fa_reinitialise", "user", userId, { parQui }, parQui);
}

const etat2facteur = (userId) => {
  const u = one("SELECT totp_enabled, recovery_codes FROM users WHERE id = ?", userId);
  return u ? { actif: !!u.totp_enabled, codes_restants: (parse(u.recovery_codes, []) || []).length } : null;
};

const hacherJeton = (t) => crypto.createHash("sha256").update(t).digest("hex");

/** Retrouve l'utilisateur d'un jeton de session, ou null. Prolonge la session glissante. */
function session(token) {
  if (!token) return null;
  const s = one("SELECT * FROM sessions WHERE token_hash = ?", hacherJeton(token));
  if (!s) return null;
  if (s.pending) return null;                    // mot de passe validé, second facteur non fourni
  if (s.expires_at <= maintenant()) { run("DELETE FROM sessions WHERE token_hash = ?", s.token_hash); return null; }
  const u = one("SELECT * FROM users WHERE id = ? AND active = 1", s.user_id);
  if (!u) return null;
  // Session glissante : toute activité repousse l'expiration, sans dépasser la durée nominale.
  run("UPDATE sessions SET expires_at = ?, last_seen = ? WHERE token_hash = ?",
    new Date(Date.now() + DUREE_SESSION_H * 3600000).toISOString(), maintenant(), s.token_hash);
  return publiciser(u);
}

function deconnecter(token) {
  if (!token) return;
  const s = one("SELECT user_id FROM sessions WHERE token_hash = ?", hacherJeton(token));
  run("DELETE FROM sessions WHERE token_hash = ?", hacherJeton(token));
  if (s) journaliser("auth.logout", "user", s.user_id, null, s.user_id);
}

/** Purge des sessions et tentatives périmées — appelée périodiquement. */
function menage() {
  const n = run("DELETE FROM sessions WHERE expires_at <= ?", maintenant()).changes;
  run("DELETE FROM login_attempts WHERE at < ?", new Date(Date.now() - 86400000).toISOString());
  return n;
}

/** Ce qu'on expose côté client : jamais le hachage. */
const publiciser = (u) => ({
  id: u.id, name: u.name, email: u.email, active: !!u.active,
  permissions: parse(u.permissions, {}), must_change: !!u.must_change,
  totp_enabled: !!u.totp_enabled,
  codes_secours_restants: (parse(u.recovery_codes, []) || []).length,
});

const sessionsDe = (userId) => all(
  "SELECT created_at, last_seen, expires_at, ip, agent FROM sessions WHERE user_id = ? ORDER BY created_at DESC", userId);

// ------------------------------------------------------------------ cookies

const NOM_COOKIE = "clone_session";

function lireCookie(req, nom = NOM_COOKIE) {
  const brut = req.headers.cookie || "";
  for (const part of brut.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === nom) return decodeURIComponent(v.join("="));
  }
  return null;
}

const poserCookie = (token, expire) =>
  `${NOM_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; ` +
  `Expires=${new Date(expire).toUTCString()}${SECURE ? "; Secure" : ""}`;

const effacerCookie = () =>
  `${NOM_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${SECURE ? "; Secure" : ""}`;

/**
 * Amorçage : s'il n'existe aucun compte, en créer un premier avec les pleins droits.
 * Le mot de passe est imprimé UNE fois dans les journaux du service, jamais stocké en clair.
 */
function amorcerAdmin({ email = process.env.CLONE_ADMIN_EMAIL, motDePasse = process.env.CLONE_ADMIN_PASSWORD } = {}) {
  if (one("SELECT COUNT(*) n FROM users WHERE password_hash IS NOT NULL").n) return null;
  const courriel = email || "admin@lasclay.com";
  const r = creerCompte({ name: "Administrateur", email: courriel, role: "admin", motDePasse: motDePasse || null });
  return { email: courriel, motDePasse: r.motDePasse, id: r.id };
}

/**
 * Reprise d'accès sans shell : `CLONE_ADMIN_RESET=1` dans les variables du service.
 *
 * Au démarrage suivant, le compte `CLONE_ADMIN_EMAIL` est créé s'il manque, remis en
 * administrateur actif, son mot de passe remplacé, son second facteur retiré et ses sessions
 * fermées. Le mot de passe est imprimé dans les logs.
 *
 * C'est une porte volontairement large, mais elle n'est ouverte qu'à qui contrôle déjà les
 * variables d'environnement du service — c'est-à-dire à qui pourrait de toute façon tout
 * faire. Elle existe parce que l'onglet Shell n'est pas disponible partout, et qu'un service
 * dont plus personne n'a la clé est inutilisable.
 */
function reprendreAcces({ email = process.env.CLONE_ADMIN_EMAIL, motDePasse = process.env.CLONE_ADMIN_PASSWORD } = {}) {
  const accounts = require("./accounts");
  const courriel = String(email || "admin@lasclay.com").trim().toLowerCase();
  const mdp = motDePasse || suggerer();
  const souci = valider(mdp);
  if (souci) {
    throw new Error(
      `CLONE_ADMIN_PASSWORD refusé : ${souci}.\n` +
      `  Le compte n'a PAS été modifié. Corriger la variable, ou la retirer pour qu'un mot de\n` +
      `  passe soit généré à la place.`);
  }

  // Un mot de passe choisi par l'exploitant n'a pas à être changé à la connexion suivante ;
  // un mot de passe généré, si.
  const impose = motDePasse ? 0 : 1;

  let u = one("SELECT * FROM users WHERE lower(email) = lower(?)", courriel);
  if (!u) {
    const r = creerCompte({ name: "Administrateur", email: courriel, role: "admin", motDePasse: mdp });
    u = { id: r.id };
    run("UPDATE users SET must_change = ? WHERE id = ?", impose, u.id);
  } else {
    run(`UPDATE users SET password_hash = ?, must_change = ?, active = 1, permissions = ?,
         totp_enabled = 0, totp_secret = NULL, totp_last_step = 0, recovery_codes = NULL
         WHERE id = ?`,
      hacher(mdp), impose, dump({ role: "admin", ...accounts.ROLES.admin }), u.id);
    run("DELETE FROM sessions WHERE user_id = ?", u.id);
  }
  run("DELETE FROM login_attempts WHERE lower(email) IN (?, ?)", courriel, `2fa:${courriel}`);
  journaliser("auth.reprise_acces", "user", u.id, { email: courriel });
  return { email: courriel, motDePasse: motDePasse ? null : mdp, id: u.id };
}

/** Comptes existants, sans aucun secret — pour que les logs disent avec quoi se connecter. */
const inventaireComptes = () => all(
  `SELECT email, name, active, totp_enabled, must_change, (password_hash IS NOT NULL) AS a_mdp
   FROM users ORDER BY name`);

module.exports = {
  hacher, verifier, valider, suggerer, creerCompte, changerMotDePasse,
  connecter, session, deconnecter, menage, sessionsDe, publiciser,
  lireCookie, poserCookie, effacerCookie, NOM_COOKIE, amorcerAdmin, DUREE_SESSION_H,
  verifier2facteur, preparer2facteur, activer2facteur, desactiver2facteur,
  reinitialiser2facteur, etat2facteur, EMETTEUR, reprendreAcces, inventaireComptes,
};
