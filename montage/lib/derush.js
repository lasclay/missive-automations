/**
 * derush.js — inventaire d'un dossier de rushes.
 *
 * Le script fait la partie mécanique : il trouve les fichiers, les sonde (durée,
 * définition, cadence, audio) et en extrait des trames JPEG horodatées.
 * Claude fait ensuite la partie de jugement : il LIT les trames et remplit
 * `description`, `sujet`, `qualite`, `moments` et `garder` dans derush.json.
 */
const fs = require("fs");
const path = require("path");
const { run, probe, typeDe } = require("./ff");

/** Nombre de trames à extraire pour un plan : assez pour juger, pas plus. */
function budgetTrames(duree) {
  if (duree <= 2) return 2;
  return Math.max(3, Math.min(8, Math.ceil(duree / 3)));
}

function fichiersMedia(dossier) {
  const trouves = [];
  const pile = [dossier];
  while (pile.length) {
    const d = pile.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) pile.push(p);
      else if (typeDe(e.name)) trouves.push(p);
    }
  }
  return trouves.sort();
}

/** Extrait les trames d'un plan et renvoie leurs chemins + horodatages. */
function trames(source, type, meta, sortie, largeur) {
  fs.mkdirSync(sortie, { recursive: true });
  if (type === "image") {
    const dest = path.join(sortie, "t_00-00.jpg");
    run(["-i", source, "-vf", `scale=${largeur}:-2`, "-frames:v", "1", dest]);
    return [{ t: 0, fichier: dest }];
  }
  const n = budgetTrames(meta.duree);
  const liste = [];
  for (let i = 0; i < n; i++) {
    // Réparties dans le plan, en évitant la toute première et la toute dernière image.
    const t = meta.duree * ((i + 0.5) / n);
    const mm = String(Math.floor(t / 60)).padStart(2, "0");
    const ss = String(Math.floor(t % 60)).padStart(2, "0");
    const cs = String(Math.floor((t % 1) * 100)).padStart(2, "0");
    const dest = path.join(sortie, `t_${mm}-${ss}-${cs}.jpg`);
    run(["-ss", t.toFixed(3), "-i", source, "-vf", `scale=${largeur}:-2`, "-frames:v", "1", dest]);
    liste.push({ t: Math.round(t * 100) / 100, fichier: dest });
  }
  return liste;
}

/**
 * Construit derush.json. Conserve les annotations déjà écrites pour les fichiers
 * déjà connus : on peut relancer `derush` après avoir ajouté des rushes sans
 * perdre le travail de lecture.
 */
function derusher(dossier, projet, { largeur = 512 } = {}) {
  const sources = fichiersMedia(dossier);
  if (!sources.length) throw new Error(`Aucun média dans ${dossier}`);

  const cheminJson = path.join(projet, "derush.json");
  const ancien = fs.existsSync(cheminJson)
    ? JSON.parse(fs.readFileSync(cheminJson, "utf8"))
    : { clips: [] };
  const parFichier = new Map((ancien.clips || []).map((c) => [c.fichier, c]));

  const clips = [];
  let nv = 0, ni = 0;
  for (const src of sources) {
    const type = typeDe(src);
    if (type === "audio") continue; // les pistes sonores vivent dans plan.json
    const rel = path.relative(dossier, src);
    const precedent = parFichier.get(rel);
    const id = precedent?.id || `${type === "image" ? "p" : "c"}${String(type === "image" ? ++ni : ++nv).padStart(2, "0")}`;
    const meta = probe(src);
    const repTrames = path.join(projet, "trames", id);

    const dejaExtrait = precedent && fs.existsSync(repTrames) && fs.readdirSync(repTrames).length;
    const t = dejaExtrait
      ? precedent.trames
      : trames(src, type, meta, repTrames, largeur).map((x) => ({
          t: x.t,
          fichier: path.relative(projet, x.fichier),
        }));

    clips.push({
      id,
      fichier: rel,
      type,
      duree: type === "image" ? null : meta.duree,
      largeur: meta.largeur,
      hauteur: meta.hauteur,
      fps: type === "image" ? null : meta.fps,
      orientation: meta.largeur >= meta.hauteur ? "paysage" : "portrait",
      audio: meta.audio,
      trames: t,
      // ---- rempli par Claude après lecture des trames ----
      description: precedent?.description || "",
      sujet: precedent?.sujet || [],
      qualite: precedent?.qualite || "",
      moments: precedent?.moments || [],
      garder: precedent?.garder ?? null,
    });
  }

  const doc = {
    dossier: path.resolve(dossier),
    genere: new Date().toISOString(),
    clips,
  };
  fs.mkdirSync(projet, { recursive: true });
  fs.writeFileSync(cheminJson, JSON.stringify(doc, null, 2) + "\n");
  return doc;
}

module.exports = { derusher, fichiersMedia };
