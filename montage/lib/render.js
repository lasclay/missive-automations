/**
 * render.js — fabrique la vidéo à partir de plan.json.
 *
 * Chaque plan est rendu séparément dans un cache indexé par empreinte. Changer
 * la durée du plan 3 ne re-rend que le plan 3 : le re-rendu après un ajustement
 * verbal prend quelques secondes, pas quelques minutes.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { run, probe } = require("./ff");
const { police } = require("./ff");
const { duree } = require("./plan");

/** Position du recadrage quand la source n'a pas le format de sortie. */
const CADRAGES = {
  centre: { x: "(iw-ow)/2", y: "(ih-oh)/2" },
  haut: { x: "(iw-ow)/2", y: "0" },
  bas: { x: "(iw-ow)/2", y: "ih-oh" },
  gauche: { x: "0", y: "(ih-oh)/2" },
  droite: { x: "iw-ow", y: "(ih-oh)/2" },
};

/** drawtext ne coupe pas les lignes : on le fait nous-mêmes. */
function replier(texte, parLigne = 24) {
  const lignes = [];
  for (const paragraphe of String(texte).split("\n")) {
    let courante = "";
    for (const mot of paragraphe.split(/\s+/).filter(Boolean)) {
      if (!courante) courante = mot;
      else if ((courante + " " + mot).length <= parLigne) courante += " " + mot;
      else { lignes.push(courante); courante = mot; }
    }
    lignes.push(courante);
  }
  return lignes.filter((l) => l !== "").join("\n");
}

function empreinte(obj) {
  return crypto.createHash("sha1").update(JSON.stringify(obj)).digest("hex").slice(0, 16);
}

/**
 * Les seuls champs d'un plan qui changent l'image. `n` et `note` sont des
 * étiquettes : renuméroter après un déplacement ne doit rien re-rendre.
 */
const CHAMPS_RENDUS = [
  "source", "in", "out", "duree", "vitesse", "cadrage", "mouvement", "audio",
  "texte", "texte_taille", "texte_position", "texte_marge", "texte_par_ligne",
];
function specRendu(p) {
  const s = {};
  for (const k of CHAMPS_RENDUS) if (p[k] !== undefined) s[k] = p[k];
  return s;
}

/** Fondus effectifs : `transition: "fondu"` = fondu au noir entre les deux plans. */
function fondus(plan) {
  return plan.plans.map((p, i) => {
    const suivant = plan.plans[i + 1];
    const entree = Number(p.fondu_entree ?? (p.transition === "fondu" ? 0.4 : i === 0 ? Number(plan.fondu_ouverture || 0) : 0));
    const sortie = Number(
      p.fondu_sortie ??
        (suivant?.transition === "fondu" ? 0.4 : !suivant ? Number(plan.fondu_fermeture || 0) : 0)
    );
    return { entree, sortie };
  });
}

/** Chaîne de filtres d'un plan vidéo. */
function filtreVideo(p, clip, L, H, FPS, d) {
  const cad = CADRAGES[p.cadrage] || CADRAGES.centre;
  const v = Number(p.vitesse) || 1;
  const f = [
    `scale=${L}:${H}:force_original_aspect_ratio=increase`,
    `crop=${L}:${H}:${cad.x}:${cad.y}`,
    "setsar=1",
  ];
  if (v !== 1) f.push(`setpts=PTS/${v}`);
  f.push(`fps=${FPS}`);
  return f;
}

/** Chaîne de filtres d'une photo : recadrage + mouvement d'appareil simulé. */
function filtrePhoto(p, L, H, FPS, d) {
  const images = Math.max(1, Math.round(d * FPS));
  const mouv = p.mouvement || "zoom_avant";
  const AMPL = 0.3;
  const inc = (AMPL / images).toFixed(6);
  let z = "1", x = "iw/2-(iw/zoom/2)", y = "ih/2-(ih/zoom/2)";
  if (mouv === "zoom_avant") z = `min(zoom+${inc},${1 + AMPL})`;
  else if (mouv === "zoom_arriere") z = `if(eq(on,0),${1 + AMPL},max(zoom-${inc},1.0))`;
  else if (mouv === "pan_droite") { z = "1.15"; x = `(iw-iw/zoom)*on/${images}`; }
  else if (mouv === "pan_gauche") { z = "1.15"; x = `(iw-iw/zoom)*(1-on/${images})`; }
  // On agrandit avant le zoompan : sinon le mouvement saccade au pixel près.
  return [
    `scale=${L * 2}:${H * 2}:force_original_aspect_ratio=increase`,
    `crop=${L * 2}:${H * 2}`,
    `zoompan=z='${z}':d=${images}:x='${x}':y='${y}':s=${L}x${H}:fps=${FPS}`,
    "setsar=1",
  ];
}

/** Rend un plan dans le cache, ou renvoie le fichier déjà en cache. */
function rendrePlan(p, clip, ctx) {
  const { racine, projet, L, H, FPS, cache, styleTexte, fonte, qualite, fondu, echelle } = ctx;
  const source = path.join(racine, clip.fichier);
  const st = fs.statSync(source);
  const d = duree(p);

  const cle = empreinte({
    p: specRendu(p), L, H, FPS, qualite, fondu, styleTexte, echelle,
    src: [clip.fichier, st.size, st.mtimeMs],
    fonte: Boolean(fonte),
  });
  const dest = path.join(cache, `${cle}.mp4`);
  if (fs.existsSync(dest)) return { fichier: dest, cache: true };

  const args = [];
  let filtres;
  let indexAudio = null;

  if (clip.type === "image") {
    args.push("-loop", "1", "-t", d.toFixed(3), "-i", source);
    filtres = filtrePhoto(p, L, H, FPS, d);
  } else {
    const v = Number(p.vitesse) || 1;
    args.push("-ss", Number(p.in).toFixed(3), "-t", (d * v).toFixed(3), "-i", source);
    filtres = filtreVideo(p, clip, L, H, FPS, d);
    if (p.audio && clip.audio) indexAudio = 0;
  }

  // Texte incrusté — écrit dans un fichier pour éviter tout échappement hasardeux.
  if (p.texte && fonte) {
    // La taille suit l'échelle : sinon le brouillon en demi-définition ment sur le rendu final.
    const taille = Math.max(12, Math.round(Number(p.texte_taille || styleTexte.taille || 58) * echelle));
    const marge = Math.round(Number(p.texte_marge ?? styleTexte.marge ?? 180) * echelle);
    const bord = Math.max(1, Math.round(4 * echelle));
    // Largeur utile du cadre, moins une gouttière de 8 % de chaque côté.
    // 0,55 × la taille est la largeur moyenne d'un caractère dans une sans-serif.
    const budget = Math.max(8, Math.floor((L * 0.84) / (taille * 0.55)));
    const parLigne = Number(p.texte_par_ligne || styleTexte.par_ligne || 0) || budget;
    const fTexte = path.join(cache, `${cle}.txt`);
    fs.writeFileSync(fTexte, replier(p.texte, parLigne));
    const pos = p.texte_position || styleTexte.position || "bas";
    const y = pos === "haut" ? `${marge}` : pos === "centre" ? "(h-text_h)/2" : `h-text_h-${marge}`;
    filtres.push(
      `drawtext=fontfile='${fonte}':textfile='${fTexte}':` +
        `fontsize=${taille}:fontcolor=${styleTexte.couleur || "white"}:` +
        `borderw=${bord}:bordercolor=${styleTexte.contour || "black@0.7"}:` +
        `line_spacing=${Math.round(12 * echelle)}:x=(w-text_w)/2:y=${y}`
    );
  }

  if (fondu.entree > 0) filtres.push(`fade=t=in:st=0:d=${fondu.entree}`);
  if (fondu.sortie > 0) filtres.push(`fade=t=out:st=${Math.max(0, d - fondu.sortie).toFixed(3)}:d=${fondu.sortie}`);

  // Toujours une piste sonore, même muette : le concat exige des flux identiques.
  const chaines = [`[0:v]${filtres.join(",")}[v]`];
  if (indexAudio === null) {
    args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
  } else {
    const v = Number(p.vitesse) || 1;
    const audio = ["aresample=48000"];
    let reste = v;
    // atempo n'accepte que 0,5 à 2,0 : au-delà on enchaîne les étages.
    while (reste > 2.0) { audio.push("atempo=2.0"); reste /= 2; }
    while (reste < 0.5) { audio.push("atempo=0.5"); reste /= 0.5; }
    if (Math.abs(reste - 1) > 0.001) audio.push(`atempo=${reste.toFixed(4)}`);
    audio.push("asetpts=PTS-STARTPTS");
    chaines.push(`[0:a]${audio.join(",")}[a]`);
  }
  args.push("-filter_complex", chaines.join(";"), "-map", "[v]");
  args.push("-map", indexAudio === null ? "1:a" : "[a]");

  args.push(
    "-t", d.toFixed(3),
    "-c:v", "libx264", "-preset", qualite.preset, "-crf", String(qualite.crf),
    "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart",
    dest
  );
  run(args);
  return { fichier: dest, cache: false };
}

/** Rend le montage complet. */
function rendre(projet, plan, derush, { brouillon = false, force = false, sortie } = {}) {
  const racine = derush.dossier;
  const echelle = brouillon ? 0.5 : 1;
  const L = Math.round((plan.largeur * echelle) / 2) * 2;
  const H = Math.round((plan.hauteur * echelle) / 2) * 2;
  const FPS = plan.fps || 30;
  const cache = path.join(projet, "cache");
  fs.mkdirSync(cache, { recursive: true });
  if (force) for (const f of fs.readdirSync(cache)) fs.unlinkSync(path.join(cache, f));

  const fonte = police(plan.texte?.police);
  if (!fonte && plan.plans.some((p) => p.texte)) {
    console.error("⚠ aucune police trouvée — les textes incrustés seront omis.");
  }

  const parId = new Map(derush.clips.map((c) => [c.id, c]));
  const ctx = {
    racine, projet, L, H, FPS, cache, fonte, echelle,
    styleTexte: plan.texte || {},
    qualite: brouillon ? { preset: "ultrafast", crf: 28 } : { preset: "medium", crf: 20 },
  };
  const fd = fondus(plan);

  const morceaux = [];
  let reutilises = 0;
  plan.plans.forEach((p, i) => {
    const clip = parId.get(p.source);
    if (!clip) throw new Error(`plan ${p.n ?? i + 1} : source « ${p.source} » inconnue`);
    const r = rendrePlan(p, clip, { ...ctx, fondu: fd[i] });
    if (r.cache) reutilises++;
    else process.stderr.write(`  plan ${String(p.n ?? i + 1).padStart(2)} rendu (${duree(p).toFixed(1)}s)\n`);
    morceaux.push(r.fichier);
  });

  const liste = path.join(cache, "concat.txt");
  fs.writeFileSync(liste, morceaux.map((m) => `file '${m.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  const assemble = path.join(cache, "assemble.mp4");
  run(["-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", "-movflags", "+faststart", assemble]);

  const finale = sortie || path.join(projet, brouillon ? "brouillon.mp4" : "sortie.mp4");
  const mus = plan.musique?.fichier;
  if (mus) {
    const fMus = path.isAbsolute(mus) ? mus : path.join(racine, mus);
    const total = plan.plans.reduce((s, p) => s + duree(p), 0);
    const vol = Number(plan.musique.volume ?? 0.7);
    const fadeOut = Number(plan.musique.fade_out ?? 1.5);
    const debut = Number(plan.musique.debut ?? 0);
    const a = [
      `[1:a]atrim=start=${debut}:end=${debut + total},asetpts=PTS-STARTPTS,`,
      `volume=${vol},afade=t=out:st=${Math.max(0, total - fadeOut).toFixed(2)}:d=${fadeOut}[m];`,
      `[0:a][m]amix=inputs=2:normalize=0:duration=first[a]`,
    ].join("");
    run([
      "-i", assemble, "-i", fMus,
      "-filter_complex", a,
      "-map", "0:v", "-c:v", "copy", "-map", "[a]", "-c:a", "aac", "-b:a", "192k",
      "-movflags", "+faststart", finale,
    ]);
  } else {
    fs.copyFileSync(assemble, finale);
  }
  return { fichier: finale, plans: plan.plans.length, reutilises, meta: probe(finale) };
}

module.exports = { rendre, replier };
