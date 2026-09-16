/**
 * ff.js — accès à ffmpeg/ffprobe. Aucune dépendance npm : on appelle les binaires.
 * Le skill `video` les installe (python3 .claude/skills/video/scripts/setup.py).
 */
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function bin(nom) {
  const r = spawnSync("command", ["-v", nom], { shell: true, encoding: "utf8" });
  const p = (r.stdout || "").trim();
  if (!p) {
    throw new Error(
      `${nom} introuvable. Installe-le : python3 .claude/skills/video/scripts/setup.py --skip-whisper`
    );
  }
  return p;
}

let _ffmpeg = null, _ffprobe = null;
const ffmpeg = () => (_ffmpeg ||= bin("ffmpeg"));
const ffprobe = () => (_ffprobe ||= bin("ffprobe"));

/** Lance ffmpeg. Jette avec les dernières lignes de stderr si ça casse. */
function run(args, { silencieux = true } = {}) {
  const r = spawnSync(ffmpeg(), ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: silencieux ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (r.status !== 0) {
    const err = (r.stderr || "").trim().split("\n").slice(-12).join("\n");
    throw new Error(`ffmpeg a échoué (${r.status})\n${err}`);
  }
  return r;
}

/** Métadonnées d'un fichier : durée, dimensions, cadence, présence d'audio. */
function probe(fichier) {
  const out = execFileSync(
    ffprobe(),
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", fichier],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
  );
  const j = JSON.parse(out);
  const v = (j.streams || []).find((s) => s.codec_type === "video");
  const a = (j.streams || []).find((s) => s.codec_type === "audio");
  const ratio = (s) => {
    if (!s) return 0;
    const [n, d] = String(s).split("/").map(Number);
    return d ? n / d : Number(s) || 0;
  };
  // Une image fixe a un stream vidéo mais pas de durée exploitable.
  const duree = Number(j.format?.duration) || Number(v?.duration) || 0;
  return {
    duree: Math.round(duree * 1000) / 1000,
    largeur: v ? Number(v.width) : 0,
    hauteur: v ? Number(v.height) : 0,
    fps: Math.round(ratio(v?.avg_frame_rate || v?.r_frame_rate) * 100) / 100,
    audio: Boolean(a),
    codec: v?.codec_name || null,
    octets: Number(j.format?.size) || 0,
  };
}

const IMAGES = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff", ".bmp"]);
const VIDEOS = new Set([".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm", ".mpg", ".mpeg", ".3gp"]);
const AUDIOS = new Set([".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg"]);

const typeDe = (f) => {
  const e = path.extname(f).toLowerCase();
  if (IMAGES.has(e)) return "image";
  if (VIDEOS.has(e)) return "video";
  if (AUDIOS.has(e)) return "audio";
  return null;
};

/** Première police utilisable pour drawtext, ou null. */
function police(prefere) {
  const candidats = [
    prefere,
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  ].filter(Boolean);
  for (const c of candidats) if (fs.existsSync(c)) return c;
  // Dernier recours : n'importe quel .ttf du système.
  for (const rep of ["/usr/share/fonts", "/usr/local/share/fonts"]) {
    if (!fs.existsSync(rep)) continue;
    const pile = [rep];
    while (pile.length) {
      const d = pile.pop();
      let entrees = [];
      try { entrees = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
      for (const e of entrees) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) pile.push(p);
        else if (/\.(ttf|otf)$/i.test(e.name)) return p;
      }
    }
  }
  return null;
}

module.exports = { ffmpeg, ffprobe, run, probe, typeDe, police };
