#!/usr/bin/env node
/**
 * Drive Lasclay partagé PAR LIEN — lecture sans clé ni connecteur.
 *
 * Pourquoi ce fichier existe : une session lancée par une Routine n'a aucun outil `mcp__*`,
 * donc pas le connecteur Google Drive. Mais les dossiers médias de Lasclay (VOLCANO,
 * « 1.4.3 Photos - Vidéos - Illustration ») sont partagés « toute personne disposant du
 * lien, lecteur ». Trois points d'entrée publics de Google suffisent alors :
 *
 *   drive.google.com/embeddedfolderview?id=<dossier>   liste un dossier (HTML)
 *   lh3.googleusercontent.com/d/<fichier>=<options>    rend une image redimensionnée ou
 *                                                      recadrée (w1080-h1350-p = 4:5)
 *   drive.usercontent.google.com/download?id=<fichier> télécharge l'original (vidéo)
 *
 * Aucun secret, aucune écriture : ce module ne fait que lire.
 *
 *   node social/drive.js inventaire             # parcourt les racines → social/publication/etat/inventaire.json
 *   node social/drive.js liste <dossierId>      # un seul dossier, pour déboguer
 *   node social/drive.js vignette <id> [px]     # aperçu → /tmp/social/<id>.jpg (à lire avec Read)
 *   node social/drive.js video <id>             # durée, dimensions, codec d'un MP4/MOV (requêtes Range)
 */
const fs = require("fs");
const path = require("path");

const ICI = __dirname;
const INVENTAIRE = path.join(ICI, "publication", "etat", "inventaire.json");
const TMP = "/tmp/social";

// Racines parcourues, par ordre de priorité. La priorité 1 passe devant à qualité égale :
// ce sont les nouvelles photos et vidéos. Vérifié le 23 sept. 2026 : partage « anyone / reader ».
const RACINES = [
  { id: "1LCBc2GPZ4QHYQVlFUYQgwmrENMWX3Asx", nom: "VOLCANO", priorite: 1 },
  { id: "1iMqQw34W4UuoYbtZqxGrZAUNwLJpXpQF", nom: "1.4.3 Photos - Vidéos - Illustration", priorite: 2 },
];

// Sous-arbres jamais proposés à la publication. Photos de clients : pas de consentement de
// publication. Fichiers RAW : illisibles par Instagram. Bris, R&D, moulage, injection :
// coulisses techniques, hors sujet pour une publication qui célèbre la plante.
const EXCLUS = /clients?\b|raw|bris|r&d|r_d|moulage|injection|studio|shopify|catalogue|logo|illustration/i;

const IMAGE = /\.(jpe?g|png|heic|heif|webp)$/i;
const VIDEO = /\.(mp4|mov|m4v)$/i;

const dec = (s) =>
  s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function get(url, opts = {}) {
  for (let essai = 1; ; essai++) {
    try {
      const r = await fetch(url, { redirect: "follow", ...opts });
      if (r.status >= 500 && essai < 4) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) {
      if (essai >= 4) throw e;
      await new Promise((ok) => setTimeout(ok, 1500 * essai));
    }
  }
}

// Un dossier → [{ id, nom, type: dossier|image|video|autre, modifie }]
async function liste(dossierId) {
  const r = await get(`https://drive.google.com/embeddedfolderview?id=${dossierId}`);
  if (!r.ok) throw new Error(`dossier ${dossierId} : HTTP ${r.status} — partagé par lien ?`);
  const html = await r.text();
  const out = [];
  // Une entrée par bloc « flip-entry ». Un dossier se reconnaît à son lien /drive/folders/ ;
  // un fichier porte son type MIME dans l'icône de liste (…/type/image/jpeg).
  for (const bloc of html.split('<div class="flip-entry" id="entry-').slice(1)) {
    const id = (bloc.match(/^([\w-]+)"/) || [])[1];
    const nom = dec((bloc.match(/flip-entry-title">([^<]*)</) || [])[1] || "").trim();
    const modifie = dec((bloc.match(/flip-entry-last-modified"><div>([^<]*)</) || [])[1] || "").trim();
    const mime = (bloc.match(/\/type\/([\w.+-]+\/[\w.+-]+)"/) || [])[1] || "";
    if (!id) continue;
    let type = "autre";
    if (bloc.includes("/drive/folders/")) type = "dossier";
    else if (mime.startsWith("video/") || VIDEO.test(nom)) type = "video";
    else if (mime.startsWith("image/") || IMAGE.test(nom)) type = "image";
    out.push({ id, nom, type, mime, modifie });
  }
  return out;
}

// Parcours en largeur de toutes les racines, six dossiers à la fois. Les dossiers exclus ne
// sont pas visités. Un même dossier n'est lu qu'une fois même s'il est rangé à deux endroits.
async function inventaire() {
  const medias = [];
  const dossiers = [];
  const vus = new Set();
  const file = RACINES.map((r) => ({ id: r.id, chemin: r.nom, priorite: r.priorite }));
  const ouvrier = async () => {
    while (file.length) {
      const { id, chemin, priorite } = file.shift();
      if (vus.has(id)) continue;
      vus.add(id);
      let entrees;
      try {
        entrees = await liste(id);
      } catch (e) {
        dossiers.push({ id, chemin, erreur: e.message });
        continue;
      }
      dossiers.push({ id, chemin, n: entrees.length });
      for (const e of entrees) {
        if (e.type === "dossier") {
          if (!EXCLUS.test(e.nom)) file.push({ id: e.id, chemin: `${chemin}/${e.nom}`, priorite });
        } else if (e.type === "image" || e.type === "video") {
          medias.push({ id: e.id, nom: e.nom, type: e.type, mime: e.mime, chemin, dossier: id, priorite, modifie: e.modifie });
        }
      }
    }
  };
  // Les ouvriers se relaient : quand la file se vide momentanément, un ouvrier encore en
  // lecture peut la remplir ; on relance donc tant qu'il reste du travail.
  while (file.length) await Promise.all(Array.from({ length: 6 }, ouvrier));
  medias.sort((a, b) => a.priorite - b.priorite || a.chemin.localeCompare(b.chemin) || a.nom.localeCompare(b.nom));
  const doc = {
    genere: new Date().toISOString(),
    racines: RACINES,
    compte: { medias: medias.length, images: medias.filter((m) => m.type === "image").length, videos: medias.filter((m) => m.type === "video").length, dossiers: dossiers.length },
    dossiers,
    medias,
  };
  fs.mkdirSync(path.dirname(INVENTAIRE), { recursive: true });
  fs.writeFileSync(INVENTAIRE, JSON.stringify(doc, null, 1));
  return doc;
}

// Dimensions d'un JPEG/PNG à partir de ses octets (après rotation EXIF, puisque le service
// d'images de Google rend l'image déjà orientée).
function dimensions(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marqueur = buf[i + 1];
    const long = buf.readUInt16BE(i + 2);
    if (marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + long;
  }
  return null;
}

// URL d'une image rendue par Google. `s1600` borne le grand côté sans agrandir ;
// `w1080-h1350-p` recadre intelligemment en 4:5 (et AGRANDIT si l'original est petit).
const urlImage = (id, options) => `https://lh3.googleusercontent.com/d/${id}=${options}`;
const urlOriginal = (id) => `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;

// Aperçu local, à regarder avec Read. Pour une vidéo, Drive rend l'image d'affiche.
// Rend aussi les dimensions de l'aperçu : si le grand côté est < px, c'est la taille réelle
// de l'original (le service n'agrandit pas avec `s`).
async function vignette(id, px = 1600, type = "image") {
  fs.mkdirSync(TMP, { recursive: true });
  const url = type === "video" ? `https://drive.google.com/thumbnail?id=${id}&sz=w${px}` : urlImage(id, `s${px}`);
  const r = await get(url);
  if (!r.ok) throw new Error(`vignette ${id} : HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const fichier = path.join(TMP, `${id}.jpg`);
  fs.writeFileSync(fichier, buf);
  const d = dimensions(buf) || {};
  return { id, fichier, largeur: d.w, hauteur: d.h, ratio: d.w && d.h ? +(d.w / d.h).toFixed(3) : null, original_plus_grand: d.w && d.h ? Math.max(d.w, d.h) >= px : null };
}

// Dimensions réelles d'une image (bornées à 4000 px de grand côté), en ne lisant que
// l'en-tête du rendu : on coupe le flux dès que le marqueur SOF est passé.
async function dims(id) {
  const r = await get(urlImage(id, "s4000"));
  if (!r.ok) throw new Error(`dims ${id} : HTTP ${r.status}`);
  const morceaux = [];
  let total = 0;
  const lecteur = r.body.getReader();
  try {
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      morceaux.push(Buffer.from(value));
      total += value.length;
      const d = dimensions(Buffer.concat(morceaux));
      if (d || total > 1024 * 1024) return d ? { largeur: d.w, hauteur: d.h, ratio: +(d.w / d.h).toFixed(3) } : null;
    }
  } finally {
    lecteur.cancel().catch(() => {});
  }
  return null;
}

// ---- MP4 / MOV : durée, dimensions, codec, sans télécharger le fichier entier ----
async function plage(url, debut, fin) {
  const r = await get(url, { headers: { Range: `bytes=${debut}-${fin}` } });
  if (r.status !== 206 && r.status !== 200) throw new Error(`Range HTTP ${r.status}`);
  const taille = +(r.headers.get("content-range") || "").split("/")[1] || +r.headers.get("content-length");
  return { buf: Buffer.from(await r.arrayBuffer()), taille };
}

function boites(buf, debut, fin, cb) {
  let i = debut;
  while (i + 8 <= fin) {
    let long = buf.readUInt32BE(i);
    const type = buf.toString("latin1", i + 4, i + 8);
    let entete = 8;
    if (long === 1) { long = Number(buf.readBigUInt64BE(i + 8)); entete = 16; }
    if (long === 0) long = fin - i;
    if (long < 8) break;
    cb(type, i, i + entete, Math.min(i + long, buf.length), long);
    i += long;
  }
}

function lireMoov(buf, debut, fin) {
  const info = { pistes: [] };
  boites(buf, debut, fin, (type, i, c, f) => {
    if (type === "mvhd") {
      const v = buf[c];
      const echelle = v === 1 ? buf.readUInt32BE(c + 20) : buf.readUInt32BE(c + 12);
      const duree = v === 1 ? Number(buf.readBigUInt64BE(c + 24)) : buf.readUInt32BE(c + 16);
      info.duree_s = +(duree / echelle).toFixed(2);
    }
    if (type === "trak") {
      const piste = {};
      const fouille = (d, fn) => boites(buf, d, fn, (t, _i, cc, ff) => {
        if (t === "tkhd") {
          const v = buf[cc];
          const off = v === 1 ? cc + 88 : cc + 76;
          piste.largeur = buf.readUInt32BE(off) >> 16;
          piste.hauteur = buf.readUInt32BE(off + 4) >> 16;
        }
        // Le premier hdlr (celui de mdia) donne le genre de piste. En QuickTime, minf porte
        // un second hdlr (« alis », « url ») qui ne doit pas l'écraser.
        if (t === "hdlr" && !piste.genre) piste.genre = buf.toString("latin1", cc + 8, cc + 12);
        if (t === "stsd") piste.codec = buf.toString("latin1", cc + 12, cc + 16);
        if (["mdia", "minf", "stbl"].includes(t)) fouille(cc, ff);
      });
      fouille(c, f);
      info.pistes.push(piste);
    }
  });
  const v = info.pistes.find((p) => p.genre === "vide") || {};
  return { duree_s: info.duree_s, largeur: v.largeur, hauteur: v.hauteur, codec: v.codec, son: info.pistes.some((p) => p.genre === "soun") };
}

// Le moov est au début (fichier « faststart ») ou à la fin (sortie brute de caméra/iPhone).
async function video(id) {
  const url = urlOriginal(id);
  const tete = await plage(url, 0, 65535);
  let moov = null;
  boites(tete.buf, 0, tete.buf.length, (type, i, c, f, long) => {
    if (type === "moov") moov = { i, c, long };
  });
  let info;
  if (moov && moov.i + moov.long <= tete.buf.length) {
    info = lireMoov(tete.buf, moov.c, moov.i + moov.long);
  } else if (moov) {
    const tout = await plage(url, moov.i, moov.i + moov.long - 1);
    info = lireMoov(tout.buf, 8, tout.buf.length);
  } else {
    const n = Math.min(tete.taille, 8 * 1024 * 1024);
    const queue = await plage(url, tete.taille - n, tete.taille - 1);
    const pos = queue.buf.lastIndexOf(Buffer.from("moov"));
    if (pos < 4) throw new Error("boîte moov introuvable dans les 8 derniers Mo");
    info = lireMoov(queue.buf, pos + 4, queue.buf.length);
  }
  return { id, octets: tete.taille, mo: +(tete.taille / 1048576).toFixed(1), ...info, ratio: info.largeur && info.hauteur ? +(info.largeur / info.hauteur).toFixed(3) : null, url: url };
}

module.exports = { RACINES, INVENTAIRE, TMP, liste, inventaire, vignette, dims, video, dimensions, urlImage, urlOriginal, get };

if (require.main === module) {
  (async () => {
    const [cmd, a, b] = process.argv.slice(2);
    try {
      if (cmd === "inventaire") {
        const d = await inventaire();
        const erreurs = d.dossiers.filter((x) => x.erreur);
        console.log(JSON.stringify({ fichier: INVENTAIRE, ...d.compte, dossiers_illisibles: erreurs }, null, 2));
      } else if (cmd === "liste") console.log(JSON.stringify(await liste(a), null, 2));
      else if (cmd === "vignette") console.log(JSON.stringify(await vignette(a, +b || 1600), null, 2));
      else if (cmd === "video") console.log(JSON.stringify(await video(a), null, 2));
      else if (cmd === "dims") console.log(JSON.stringify(await dims(a), null, 2));
      else {
        console.error("Usage : node social/drive.js inventaire | liste <dossierId> | vignette <id> [px] | video <id>");
        process.exit(1);
      }
    } catch (e) {
      console.error("Erreur :", e.message);
      process.exit(1);
    }
  })();
}
