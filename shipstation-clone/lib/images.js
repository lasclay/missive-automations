/**
 * Rapatriement d'images — logos de boutique.
 *
 * Le clone n'affiche que ce qu'il sert lui-même : la politique de sécurité du document est
 * `img-src 'self' data:`, et c'est un des points que l'audit lui compte comme une force
 * (« 1 hôte contre 25, 0 pixel de suivi »). Coller l'URL d'un logo dans la base reviendrait
 * à la relâcher, et à faire dépendre l'affichage d'un serveur tiers qui peut changer d'avis,
 * compter les visites, ou simplement disparaître.
 *
 * D'où ce module : l'URL sert **une fois**, à la configuration. L'image devient une URI de
 * données rangée dans la base, et plus rien ne sort du clone ensuite.
 */
const { lookup } = require("node:dns/promises");

/** Formats acceptés. Le SVG est admis parce qu'il pèse peu ; il est assaini avant stockage. */
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

/** Plafond du téléchargement : bien au-delà d'une icône, bien en deçà d'une photo d'appareil. */
const MAX_TELECHARGEMENT = 4 * 1024 * 1024;
/** Plafond du stockage. Une icône de 64 px pèse 1 à 4 ko ; 96 ko laisse toute la marge utile. */
const MAX_STOCKAGE = 96 * 1024;

/**
 * Google Drive ne sert pas d'image sur un lien de partage : `…/file/d/ID/view` rend une page
 * HTML. La forme qui rend l'octet est `lh3.googleusercontent.com/d/ID`. Réécrire ici évite
 * de demander à l'utilisateur de connaître cette subtilité — il colle ce qu'il a sous la main.
 */
function normaliserUrl(url) {
  const u = String(url || "").trim();
  const drive = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,})/)
    || u.match(/docs\.google\.com\/.*[?&]id=([\w-]{10,})/);
  if (drive) return `https://lh3.googleusercontent.com/d/${drive[1]}`;
  return u;
}

/**
 * Refuse les adresses internes.
 *
 * Sans ce contrôle, un champ « URL du logo » devient une porte pour faire émettre au serveur
 * des requêtes vers son propre réseau — `http://169.254.169.254/`, un service interne, la
 * base voisine. Le formulaire est réservé aux administrateurs, mais un garde-fou qui dépend
 * du fait que personne d'hostile n'est administrateur n'en est pas un.
 */
async function verifierHote(u) {
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("seules les URL http(s) sont acceptées");
  let adresses;
  try { adresses = await lookup(u.hostname, { all: true }); }
  catch { throw new Error(`nom d'hôte introuvable : ${u.hostname}`); }
  for (const { address, family } of adresses) {
    if (family === 4) {
      const [a, b] = address.split(".").map(Number);
      if (a === 127 || a === 10 || a === 0 || a === 169 && b === 254
        || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168)
        throw new Error(`adresse interne refusée : ${u.hostname} → ${address}`);
    } else if (address === "::1" || /^f[cd]/i.test(address) || /^fe80/i.test(address)) {
      throw new Error(`adresse interne refusée : ${u.hostname} → ${address}`);
    }
  }
}

/** Un SVG peut contenir du script ou appeler l'extérieur. Ni l'un ni l'autre n'a sa place ici. */
function assainirSvg(texte) {
  return String(texte)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|xlink:href)\s*=\s*("|')\s*(javascript|data):[^"']*\2/gi, "")
    .replace(/<(image|use)\b[^>]*\b(?:xlink:)?href\s*=\s*("|')https?:[^"']*\2[^>]*>/gi, "");
}

/** Va chercher l'image et la rend en URI de données. Ne l'enregistre pas : c'est l'appelant. */
async function rapatrier(url) {
  const brut = normaliserUrl(url);
  let u;
  try { u = new URL(brut); } catch { throw new Error("URL invalide"); }
  await verifierHote(u);

  let r;
  try {
    r = await fetch(u, { redirect: "follow", headers: { Accept: "image/*" } });
  } catch (e) {
    throw new Error(`image injoignable : ${e.message}`);
  }
  if (!r.ok) throw new Error(`l'adresse a répondu ${r.status} — vérifier que le fichier est partagé publiquement`);

  const type = String(r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!TYPES.has(type)) {
    throw new Error(type.startsWith("text/html")
      ? "cette adresse rend une page web, pas une image — utiliser le lien direct du fichier, ou déposer l'image"
      : `format non accepté (${type || "inconnu"}) — PNG, JPEG, WebP, GIF ou SVG`);
  }
  const octets = Buffer.from(await r.arrayBuffer());
  if (octets.length > MAX_TELECHARGEMENT) throw new Error("image trop lourde (plus de 4 Mo)");

  const donnees = type === "image/svg+xml"
    ? Buffer.from(assainirSvg(octets.toString("utf8")), "utf8")
    : octets;
  return { data_uri: `data:${type};base64,${donnees.toString("base64")}`,
    type, octets: donnees.length, source: brut };
}

/**
 * Valide une URI de données avant de la ranger. L'image déposée depuis l'écran est déjà
 * réduite par le navigateur ; ce contrôle est là pour ce qui arriverait autrement.
 */
function validerDataUri(valeur) {
  const s = String(valeur || "");
  const m = s.match(/^data:([\w.+/-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new Error("l'image doit être une URI de données en base64");
  const type = m[1].toLowerCase();
  if (!TYPES.has(type)) throw new Error(`format non accepté (${type})`);
  const octets = Buffer.from(m[2], "base64");
  if (octets.length > MAX_STOCKAGE) {
    throw new Error(`image trop lourde une fois rangée (${Math.round(octets.length / 1024)} ko, maximum ${MAX_STOCKAGE / 1024} ko) — une icône de 64 px suffit`);
  }
  if (type === "image/svg+xml") {
    const propre = assainirSvg(octets.toString("utf8"));
    return { data_uri: `data:${type};base64,${Buffer.from(propre, "utf8").toString("base64")}`,
      type, octets: Buffer.byteLength(propre) };
  }
  return { data_uri: s, type, octets: octets.length };
}

module.exports = { rapatrier, validerDataUri, normaliserUrl, assainirSvg, TYPES, MAX_STOCKAGE };
