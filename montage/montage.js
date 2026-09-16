#!/usr/bin/env node
/**
 * montage.js — dérushage assisté et plan de montage exécutable.
 *
 *   node montage/montage.js derush <dossier> [--projet nom]   # inventaire + trames à lire
 *   node montage/montage.js trames <projet> [--clip c03]      # chemins des trames (pour Read)
 *   node montage/montage.js gabarit <projet> [--titre "..."]  # plan.json de départ
 *   node montage/montage.js plan <projet>                     # le plan de montage, lisible
 *   node montage/montage.js check <projet>                    # valide le plan contre les rushes
 *   node montage/montage.js render <projet> [--brouillon] [--force] [--sortie f.mp4]
 *
 * Le partage du travail : le script fait la mécanique (sonder, extraire, encoder),
 * Claude fait le jugement (décrire les plans, écrire et ajuster plan.json).
 *
 * Dépend de ffmpeg/ffprobe — installés par
 *   python3 .claude/skills/video/scripts/setup.py --skip-whisper
 */
const fs = require("fs");
const path = require("path");
const { derusher } = require("./lib/derush");
const P = require("./lib/plan");
const { rendre } = require("./lib/render");

const args = process.argv.slice(2);
const cmd = args[0] || "aide";
const flag = (nom, def = null) => {
  const i = args.indexOf(`--${nom}`);
  if (i === -1) return def;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : true;
};
const has = (nom) => args.includes(`--${nom}`);
const positionnel = args.slice(1).filter((a, i, t) => !a.startsWith("--") && !(t[i - 1] || "").startsWith("--"));

const RACINE_PROJETS = path.join(__dirname, "projets");

/** Un projet se désigne par son nom court ou par un chemin. */
function projetDe(ref) {
  if (!ref) throw new Error("Il faut nommer le projet.");
  if (ref.includes("/") || fs.existsSync(ref)) return path.resolve(ref);
  return path.join(RACINE_PROJETS, ref);
}

function chargerDerush(projet) {
  const f = path.join(projet, "derush.json");
  if (!fs.existsSync(f)) throw new Error(`Pas de dérushage : ${f}\nLance d'abord « derush ».`);
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

const AIDE = `montage — dérushage et plan de montage

  derush <dossier> [--projet nom]     inventorie les rushes, extrait les trames
  trames <projet> [--clip c03]        liste les trames à lire
  gabarit <projet> [--titre "..."]    écrit un plan.json de départ
  plan <projet>                       affiche le plan de montage
  check <projet>                      valide le plan contre les rushes
  render <projet> [--brouillon]       fabrique la vidéo
      --brouillon   demi-définition, encodage rapide — pour valider le rythme
      --force       ignore le cache et re-rend tout
      --sortie f    fichier de sortie

Les projets vivent dans montage/projets/<nom>/ :
  derush.json  l'inventaire annoté      plan.json  le plan de montage
  trames/      les images du dérushage  cache/     les plans déjà rendus
`;

async function main() {
  if (cmd === "derush") {
    const dossier = positionnel[0];
    if (!dossier) throw new Error("Usage : derush <dossier de rushes> [--projet nom]");
    if (!fs.existsSync(dossier)) throw new Error(`Dossier introuvable : ${dossier}`);
    const nom = flag("projet", path.basename(path.resolve(dossier)));
    const projet = projetDe(String(nom));
    const d = derusher(dossier, projet, { largeur: Number(flag("largeur", 512)) });

    const videos = d.clips.filter((c) => c.type === "video");
    const photos = d.clips.filter((c) => c.type === "image");
    const secondes = videos.reduce((s, c) => s + (c.duree || 0), 0);
    console.log(`Projet : ${projet}`);
    console.log(`${videos.length} vidéos (${secondes.toFixed(0)} s au total), ${photos.length} photos\n`);
    for (const c of d.clips) {
      const dim = `${c.largeur}×${c.hauteur}`;
      const dur = c.type === "image" ? "photo" : `${c.duree.toFixed(1)}s`;
      console.log(
        `${c.id}  ${dur.padStart(7)}  ${dim.padEnd(11)} ${c.orientation.padEnd(8)}` +
          `${c.audio ? "son " : "    "} ${c.fichier}`
      );
    }
    const aLire = d.clips.reduce((s, c) => s + c.trames.length, 0);
    console.log(`\n${aLire} trames extraites dans ${path.join(projet, "trames")}`);
    console.log("→ lis-les, puis remplis description / sujet / qualite / moments / garder dans derush.json");
    return;
  }

  if (cmd === "trames") {
    const projet = projetDe(positionnel[0]);
    const d = chargerDerush(projet);
    const filtre = flag("clip");
    for (const c of d.clips) {
      if (filtre && c.id !== filtre) continue;
      console.log(`\n# ${c.id} — ${c.fichier}${c.duree ? ` (${c.duree.toFixed(1)}s)` : ""}`);
      for (const t of c.trames) console.log(`${path.join(projet, t.fichier)}  t=${t.t}s`);
    }
    return;
  }

  if (cmd === "gabarit") {
    const projet = projetDe(positionnel[0]);
    const d = chargerDerush(projet);
    const f = P.chemin(projet);
    if (fs.existsSync(f) && !has("force")) throw new Error(`${f} existe déjà (--force pour écraser)`);
    const g = P.gabarit(d, flag("titre") === true ? null : flag("titre"));
    P.ecrire(projet, g);
    console.log(`Plan de départ écrit : ${f} (${g.plans.length} plans)`);
    return;
  }

  if (cmd === "plan") {
    const projet = projetDe(positionnel[0]);
    console.log(P.markdown(P.charger(projet), chargerDerush(projet)));
    return;
  }

  if (cmd === "check") {
    const projet = projetDe(positionnel[0]);
    const soucis = P.verifier(P.charger(projet), chargerDerush(projet));
    if (!soucis.length) return console.log("Plan valide.");
    console.log(`${soucis.length} problème(s) :`);
    for (const s of soucis) console.log(`  · ${s}`);
    process.exitCode = 1;
    return;
  }

  if (cmd === "render") {
    const projet = projetDe(positionnel[0]);
    const d = chargerDerush(projet);
    const plan = P.charger(projet);
    const soucis = P.verifier(plan, d);
    if (soucis.length) {
      console.error("Le plan ne passe pas la validation :");
      for (const s of soucis) console.error(`  · ${s}`);
      process.exitCode = 1;
      return;
    }
    const t0 = Date.now();
    const r = rendre(projet, plan, d, {
      brouillon: has("brouillon"),
      force: has("force"),
      sortie: flag("sortie") === true ? null : flag("sortie"),
    });
    const s = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `\n${r.fichier}\n${r.meta.largeur}×${r.meta.hauteur} · ${r.meta.duree.toFixed(1)}s · ` +
        `${(r.meta.octets / 1e6).toFixed(1)} Mo · ${r.plans} plans ` +
        `(${r.reutilises} repris du cache) · ${s}s`
    );
    return;
  }

  console.log(AIDE);
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
