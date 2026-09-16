/**
 * plan.js — le plan de montage. C'est LE fichier qu'on ajuste à la voix :
 * « le plan 3 est trop long », « commence par le lac », « enlève le texte du 5 ».
 * Chaque phrase se traduit par une petite modification de plan.json, puis un re-rendu.
 */
const fs = require("fs");
const path = require("path");

const FORMATS = {
  "9:16": { largeur: 1080, hauteur: 1920 },
  "4:5": { largeur: 1080, hauteur: 1350 },
  "1:1": { largeur: 1080, hauteur: 1080 },
  "16:9": { largeur: 1920, hauteur: 1080 },
};

const DEFAUTS = {
  titre: "Sans titre",
  format: "9:16",
  fps: 30,
  musique: null,
  texte: { taille: 58, couleur: "white", contour: "black@0.7", position: "bas", marge: 180 },
  plans: [],
};

function chemin(projet) {
  return path.join(projet, "plan.json");
}

function charger(projet) {
  const p = chemin(projet);
  if (!fs.existsSync(p)) throw new Error(`Pas de plan de montage : ${p}`);
  const brut = JSON.parse(fs.readFileSync(p, "utf8"));
  const plan = { ...DEFAUTS, ...brut, texte: { ...DEFAUTS.texte, ...(brut.texte || {}) } };
  const dim = FORMATS[plan.format];
  if (!dim) throw new Error(`Format inconnu : ${plan.format} (connus : ${Object.keys(FORMATS).join(", ")})`);
  plan.largeur = brut.largeur || dim.largeur;
  plan.hauteur = brut.hauteur || dim.hauteur;
  return plan;
}

function ecrire(projet, plan) {
  fs.writeFileSync(chemin(projet), JSON.stringify(plan, null, 2) + "\n");
}

/** Durée écran d'un plan, une fois la vitesse appliquée. */
function duree(p) {
  const v = Number(p.vitesse) || 1;
  if (p.duree != null) return Number(p.duree);
  const brute = Number(p.out) - Number(p.in);
  return Math.round((brute / v) * 1000) / 1000;
}

function tc(s) {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, "0")}`;
}

/** Valide le plan contre le dérushage. Renvoie une liste de problèmes. */
function verifier(plan, derush) {
  const parId = new Map(derush.clips.map((c) => [c.id, c]));
  const soucis = [];
  plan.plans.forEach((p, i) => {
    const n = p.n ?? i + 1;
    const clip = parId.get(p.source);
    if (!clip) return soucis.push(`plan ${n} : source « ${p.source} » absente du dérushage`);
    if (clip.type === "image") {
      if (!p.duree) soucis.push(`plan ${n} : une photo exige « duree »`);
    } else {
      if (p.in == null || p.out == null) return soucis.push(`plan ${n} : « in » et « out » requis`);
      if (Number(p.out) <= Number(p.in)) soucis.push(`plan ${n} : out (${p.out}) ≤ in (${p.in})`);
      if (clip.duree && Number(p.out) > clip.duree + 0.05)
        soucis.push(`plan ${n} : out ${p.out}s dépasse la durée du rush (${clip.duree}s)`);
    }
    if (duree(p) < 0.3) soucis.push(`plan ${n} : ${duree(p)}s — trop court pour être lu`);
  });
  if (plan.musique?.fichier) {
    const m = path.isAbsolute(plan.musique.fichier)
      ? plan.musique.fichier
      : path.join(derush.dossier, plan.musique.fichier);
    if (!fs.existsSync(m)) soucis.push(`musique introuvable : ${m}`);
  }
  return soucis;
}

/** Le plan sous forme lisible — c'est ce qu'on relit avant de dire quoi changer. */
function markdown(plan, derush) {
  const parId = new Map(derush.clips.map((c) => [c.id, c]));
  const lignes = [];
  const total = plan.plans.reduce((s, p) => s + duree(p), 0);
  lignes.push(`# ${plan.titre}`);
  lignes.push("");
  lignes.push(
    `${plan.format} · ${plan.largeur}×${plan.hauteur} · ${plan.fps} img/s · ` +
      `${plan.plans.length} plans · **${total.toFixed(1)} s**` +
      (plan.musique?.fichier ? ` · musique : ${path.basename(plan.musique.fichier)}` : "")
  );
  lignes.push("");
  lignes.push("| # | à | durée | source | extrait | à l'écran | texte |");
  lignes.push("| --- | --- | --- | --- | --- | --- | --- |");
  let t = 0;
  plan.plans.forEach((p, i) => {
    const clip = parId.get(p.source);
    const d = duree(p);
    const extrait =
      clip?.type === "image"
        ? "photo"
        : `${Number(p.in).toFixed(1)}→${Number(p.out).toFixed(1)}s` +
          (p.vitesse && p.vitesse !== 1 ? ` ×${p.vitesse}` : "");
    lignes.push(
      `| ${p.n ?? i + 1} | ${tc(t)} | ${d.toFixed(1)} s | ${p.source} | ${extrait} | ` +
        `${(p.note || clip?.description || "").replace(/\|/g, "/")} | ${(p.texte || "").replace(/\|/g, "/")} |`
    );
    t += d;
  });
  return lignes.join("\n");
}

/** Plan de départ : tous les rushes gardés, dans l'ordre, 3 s chacun. */
function gabarit(derush, titre) {
  const gardes = derush.clips.filter((c) => c.garder !== false);
  return {
    titre: titre || "Sans titre",
    format: "9:16",
    fps: 30,
    musique: null,
    texte: { ...DEFAUTS.texte },
    plans: gardes.map((c, i) => {
      const base = { n: i + 1, source: c.id, cadrage: "centre", texte: "", note: c.description || "" };
      if (c.type === "image") return { ...base, duree: 3, mouvement: "zoom_avant" };
      const m = c.moments?.[0];
      const dep = m ? Number(m.in) : 0;
      const fin = m ? Number(m.out) : Math.min(c.duree || 3, dep + 3);
      return { ...base, in: dep, out: fin, vitesse: 1, audio: false };
    }),
  };
}

module.exports = { FORMATS, charger, ecrire, chemin, duree, verifier, markdown, gabarit, tc };
