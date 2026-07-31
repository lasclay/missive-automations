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

  const token = crypto.randomBytes(32).toString("base64url");
  const expire = new Date(Date.now() + DUREE_SESSION_H * 3600000).toISOString();
  run("INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip, agent) VALUES (?,?,?,?,?,?)",
    hacherJeton(token), u.id, maintenant(), expire, ip, String(agent || "").slice(0, 200));
  journaliser("auth.login", "user", u.id, { ip }, u.id);
  return { token, expire, user: publiciser(u) };
}

const hacherJeton = (t) => crypto.createHash("sha256").update(t).digest("hex");

/** Retrouve l'utilisateur d'un jeton de session, ou null. Prolonge la session glissante. */
function session(token) {
  if (!token) return null;
  const s = one("SELECT * FROM sessions WHERE token_hash = ?", hacherJeton(token));
  if (!s) return null;
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

module.exports = {
  hacher, verifier, valider, suggerer, creerCompte, changerMotDePasse,
  connecter, session, deconnecter, menage, sessionsDe, publiciser,
  lireCookie, poserCookie, effacerCookie, NOM_COOKIE, amorcerAdmin, DUREE_SESSION_H,
};
