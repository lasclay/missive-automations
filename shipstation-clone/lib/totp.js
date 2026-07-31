/**
 * TOTP — second facteur par application d'authentification (RFC 6238).
 *
 * Choix : TOTP plutôt que SMS. Pas de coût par message, pas de dépendance à un opérateur,
 * pas de vulnérabilité au détournement de carte SIM, et ça marche avec ce que les gens ont
 * déjà — Google Authenticator, Authy, 1Password, le trousseau iOS.
 *
 * Tout est fait avec node:crypto. Le secret ne quitte JAMAIS le serveur : le QR code est
 * généré localement (lib/qr.js), pas par une API tierce à qui on enverrait le secret.
 */
const crypto = require("crypto");

const PAS = 30;          // secondes par pas de temps
const CHIFFRES = 6;
const DERIVE = 1;        // ±1 pas accepté, soit ±30 s d'écart d'horloge

// ------------------------------------------------------------------ base32

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encoder(buf) {
  let bits = 0, valeur = 0, sortie = "";
  for (const octet of buf) {
    valeur = (valeur << 8) | octet;
    bits += 8;
    while (bits >= 5) { sortie += ALPHABET[(valeur >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) sortie += ALPHABET[(valeur << (5 - bits)) & 31];
  return sortie;
}

function base32Decoder(s) {
  let bits = 0, valeur = 0;
  const out = [];
  for (const c of String(s).toUpperCase().replace(/[\s=-]/g, "")) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("secret base32 invalide");
    valeur = (valeur << 5) | i;
    bits += 5;
    if (bits >= 8) { out.push((valeur >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

// ------------------------------------------------------------------ HOTP / TOTP

/** Un secret de 20 octets — la taille recommandée pour HMAC-SHA1. */
const genererSecret = () => base32Encoder(crypto.randomBytes(20));

function hotp(secretBase32, compteur, chiffres = CHIFFRES) {
  const cle = base32Decoder(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(compteur));
  const h = crypto.createHmac("sha1", cle).update(buf).digest();
  const offset = h[h.length - 1] & 0x0f;
  const code = ((h[offset] & 0x7f) << 24 | h[offset + 1] << 16 | h[offset + 2] << 8 | h[offset + 3])
    % 10 ** chiffres;
  return String(code).padStart(chiffres, "0");
}

const pasCourant = (maintenant = Date.now()) => Math.floor(maintenant / 1000 / PAS);

const totp = (secret, t = Date.now(), chiffres = CHIFFRES) => hotp(secret, pasCourant(t), chiffres);

/**
 * Vérifie un code. Renvoie le pas de temps utilisé (pour empêcher le rejeu) ou null.
 *
 * `dernierPas` est le dernier pas déjà consommé par ce compte : on refuse tout code d'un pas
 * antérieur ou égal. Sans cela, un code intercepté reste valide pendant sa fenêtre de 30 s.
 */
function verifier(secret, code, { dernierPas = 0, t = Date.now(), derive = DERIVE } = {}) {
  const saisi = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(saisi)) return null;
  const actuel = pasCourant(t);
  for (let d = -derive; d <= derive; d++) {
    const pas = actuel + d;
    if (pas <= dernierPas) continue;                       // rejeu
    const attendu = hotp(secret, pas);
    // Comparaison à temps constant, même sur six chiffres.
    if (crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(saisi))) return pas;
  }
  return null;
}

/** URI otpauth:// à encoder dans le QR code. */
function uri(secret, { compte, emetteur = "Lasclay Expéditions" }) {
  const label = encodeURIComponent(`${emetteur}:${compte}`);
  const p = new URLSearchParams({
    secret, issuer: emetteur, algorithm: "SHA1",
    digits: String(CHIFFRES), period: String(PAS),
  });
  return `otpauth://totp/${label}?${p}`;
}

/** Secret formaté par groupes de quatre, pour la saisie manuelle si le scan échoue. */
const lisible = (secret) => String(secret).replace(/(.{4})/g, "$1 ").trim();

// ------------------------------------------------- codes de secours

/**
 * Codes de récupération : le téléphone se perd, se casse, se remplace. Sans eux, un employé
 * bloqué doit attendre qu'un administrateur soit disponible.
 * Usage unique, stockés hachés — comme des mots de passe.
 */
function genererCodesSecours(n = 10) {
  return Array.from({ length: n }, () =>
    crypto.randomBytes(5).toString("hex").replace(/(.{5})/, "$1-").toUpperCase());
}

const hacherCode = (c) => crypto.createHash("sha256")
  .update(String(c).toUpperCase().replace(/[\s-]/g, "")).digest("hex");

/** Consomme un code de secours. Renvoie la liste restante, ou null si le code est faux. */
function consommerCodeSecours(codesHaches, saisi) {
  const h = hacherCode(saisi);
  const reste = codesHaches.filter((x) => x !== h);
  return reste.length === codesHaches.length ? null : reste;
}

module.exports = {
  genererSecret, totp, hotp, verifier, uri, lisible, pasCourant,
  genererCodesSecours, hacherCode, consommerCodeSecours,
  base32Encoder, base32Decoder, PAS, CHIFFRES,
};
