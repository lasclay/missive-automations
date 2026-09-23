#!/usr/bin/env node
'use strict';
//
// Nano Banana — générer une image avec Gemini, et la regarder.
//
//   node .claude/skills/nano-banana/scripts/image.js "une consigne" sortie.webp
//     --ref <fichier-ou-url>     photo de référence (répétable, jusqu'à 6)
//     --suite <image>            l'image précédente d'une série, pour la continuité
//     --taille <px>              largeur de la vignette produite (défaut 320, 0 = aucune)
//     --qualite <1-100>          qualité WebP du grand format (défaut 88)
//     --png                      garder le PNG brut au lieu de convertir
//     --modele <id>              défaut gemini-3.1-flash-image
//
// Il faut GEMINI_API_KEY dans l'environnement. Elle s'ajoute aux réglages de
// l'environnement infonuagique, JAMAIS dans le dépôt, et c'est une NOUVELLE
// session qui la voit — un conteneur déjà démarré ne la verra pas.
//
// Sort deux fichiers : sortie.webp et sortie-mini.webp. Le WebP est l'original,
// pas un dérivé : un dessin au trait y perd dix fois son poids sans différence
// visible, et de toute façon une régénération ne redonne jamais le même dessin.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const API = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const REVISION = '2026-05-20';

function args() {
  const a = process.argv.slice(2);
  const o = { refs: [], modele: 'gemini-3.1-flash-image', taille: 320, qualite: 88 };
  const libres = [];
  for (let i = 0; i < a.length; i++) {
    switch (a[i]) {
      case '--ref':     o.refs.push(a[++i]); break;
      case '--suite':   o.suite = a[++i]; break;
      case '--taille':  o.taille = Number(a[++i]); break;
      case '--qualite': o.qualite = Number(a[++i]); break;
      case '--modele':  o.modele = a[++i]; break;
      case '--png':     o.png = true; break;
      default:          libres.push(a[i]);
    }
  }
  [o.prompt, o.sortie] = libres;
  return o;
}

function mimeDe(nom) {
  const e = path.extname(nom).toLowerCase();
  return e === '.png' ? 'image/png' : e === '.webp' ? 'image/webp' : 'image/jpeg';
}

async function bloc(ref) {
  let octets;
  if (/^https?:\/\//.test(ref)) {
    const r = await fetch(ref);
    if (!r.ok) throw new Error(`référence ${r.status} — ${ref}`);
    octets = Buffer.from(await r.arrayBuffer());
  } else {
    octets = fs.readFileSync(ref);
  }
  return { type: 'image', data: octets.toString('base64'), mime_type: mimeDe(ref) };
}

async function main() {
  const o = args();
  if (!o.prompt || !o.sortie) {
    console.error('usage : image.js "consigne" sortie.webp [--ref f] [--suite img] [--taille n]');
    process.exit(2);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY absente de l'environnement.");
    console.error("Elle s'ajoute aux réglages de l'environnement infonuagique (barre de titre");
    console.error("de la session, puis Edit) et c'est une NOUVELLE session qui la voit.");
    process.exit(1);
  }

  const entree = [{ type: 'text', text: o.prompt }];

  // Les références d'abord : elles empêchent le modèle d'inventer un objet
  // plausible mais faux. Plusieurs vues valent mieux qu'une phrase.
  if (o.refs.length) {
    entree.push({
      type: 'text',
      text: `The next ${o.refs.length} photograph(s) show the ACTUAL subject. They are the `
          + 'authority on its shape, proportions, seams, hardware and colours — including '
          + 'details the instruction does not mention. Draw THAT subject, never a generic '
          + 'equivalent, and invent nothing you cannot see in them.',
    });
    for (const r of o.refs) entree.push(await bloc(r));
  }

  // La suite d'une série : sans ça chaque image est dessinée seule et l'objet
  // change de forme d'une étape à l'autre.
  if (o.suite) {
    entree.push({
      type: 'text',
      text: 'The next image is the PREVIOUS picture in this same series. Keep the very same '
          + 'subject: same shape, same proportions, same colours, same details in the same '
          + 'places, same drawing style, same background. This is the next moment of that '
          + 'same scene, not a different view of it.',
    });
    entree.push(await bloc(o.suite));
  }

  const rep = await fetch(API, {
    method: 'POST',
    headers: {
      'x-goog-api-key': process.env.GEMINI_API_KEY,
      'Content-Type': 'application/json',
      'Api-Revision': REVISION,
    },
    body: JSON.stringify({ model: o.modele, input: entree }),
  });
  const corps = await rep.json();
  if (!rep.ok) throw new Error(`API ${rep.status} — ${JSON.stringify(corps).slice(0, 400)}`);

  let png = null;
  for (const e of corps.steps || [])
    for (const b of e.content || [])
      if (b.type === 'image' && b.data) { png = Buffer.from(b.data, 'base64'); break; }
  if (!png) throw new Error(`aucune image dans la réponse — ${JSON.stringify(corps).slice(0, 400)}`);

  const base = o.sortie.replace(/\.(webp|png)$/i, '');
  fs.mkdirSync(path.dirname(path.resolve(o.sortie)), { recursive: true });

  if (o.png) {
    fs.writeFileSync(`${base}.png`, png);
    console.log(`${base}.png   ${(png.length / 1024).toFixed(0)} Ko`);
    return;
  }

  const tmp = `${base}.tmp.png`;
  fs.writeFileSync(tmp, png);
  try {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tmp,
      '-c:v', 'libwebp', '-quality', String(o.qualite), `${base}.webp`]);
    if (o.taille > 0) {
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tmp,
        '-vf', `scale=${o.taille}:-1`, '-c:v', 'libwebp', '-quality', '80', `${base}-mini.webp`]);
    }
  } finally { fs.unlinkSync(tmp); }

  const k = f => (fs.statSync(f).size / 1024).toFixed(0);
  console.log(`${base}.webp   ${k(`${base}.webp`)} Ko`
    + (o.taille > 0 ? `   + vignette ${k(`${base}-mini.webp`)} Ko` : ''));
}

main().catch(e => { console.error(e.message); process.exit(1); });
