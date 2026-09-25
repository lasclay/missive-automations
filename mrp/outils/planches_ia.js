#!/usr/bin/env node
'use strict';
//
// Planches d'instruction dessinées par Nano Banana (Gemini image).
//
// Les planches actuelles sont du SVG tracé à la main : elles tiennent dans la
// page et ne coûtent aucune requête, mais elles ne ressemblent pas aux
// produits. Ici on demande un dessin à un modèle d'image, en lui donnant la
// VRAIE photo Shopify du produit comme référence — pour que la planche du sac
// à lunch montre celui de Lasclay et pas un générique.
//
//   node mrp/outils/planches_ia.js <planche>     une planche
//   node mrp/outils/planches_ia.js --tout        les quinze
//   node mrp/outils/planches_ia.js <planche> --sec   n'appelle rien, montre les consignes
//   node mrp/outils/planches_ia.js <planche> --refaire   régénère toute la planche
//   node mrp/outils/planches_ia.js <planche> --depuis 2   garde le 1, refait 2, 3, 4
//   node mrp/outils/planches_ia.js <planche> --depuis 2 --jusqua 3   ne refait que 2 et 3
//
// Il faut GEMINI_API_KEY dans l'environnement (réglages de l'environnement
// infonuagique, pas le dépôt). Sans elle le script s'arrête en le disant.
//
// Les images sortent dans mrp/statique/planches/ en WebP, versionnées dans le
// dépôt : ce sont des données de production, pas un cache — une régénération ne
// redonne PAS le même dessin, alors le fichier est l'original, pas une copie.
//
// Deux tailles, parce que la planche se lit en bande puis se zoome :
//   <planche>-<n>-mini.webp   260 px, la vignette   — la bande s'affiche à 150 px
//   <planche>-<n>.webp       1024 px, le zoom       — 30 Ko, chargé au clic
// Le PNG que rend le modèle ne survit pas : à qualité indiscernable il pèse dix
// fois plus. Conversion par ffmpeg, qui n'est requis que pour générer — jamais
// pour servir.

const fs   = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const RACINE   = path.join(__dirname, '..');
const PROMPTS  = path.join(RACINE, 'donnees', 'planches-prompts.tsv');
const PHOTOS   = path.join(RACINE, 'donnees', 'shopify-images.tsv');
const SORTIE   = path.join(RACINE, 'statique', 'planches');

const MODELE   = 'gemini-3.1-flash-image';
const API      = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const REVISION = '2026-05-20';

// Le style est le même partout : c'est lui qui fait qu'une planche ressemble à
// la suivante. Il ne se répète pas dans le TSV, on le colle devant chaque
// consigne. « Aucun texte » n'est pas une coquetterie : la planche est lue par
// un atelier tunisien, et la numérotation est faite par la page, pas l'image.
const STYLE = [
  'Technical instruction illustration, in the visual language of IKEA assembly',
  'manuals and LEGO building steps: clean flat vector drawing, confident dark',
  'outlines of even weight, a small flat colour palette, plain pale neutral',
  'background, no photographic texture, no gradient shading, no drop shadows.',
  'ABSOLUTELY NO text of any kind: no letters, no words, no numbers, no labels,',
  'no captions, no watermark, no signature anywhere in the image.',
  'Hands, when shown, are simple stylised instructional hands in a warm light skin',
  'tone that stands clearly apart from the product, no jewellery, no skin detail,',
  'no arms beyond the wrist.',
  'Movement is shown with bold red arrows outlined in white.',
  'Square composition, the subject centred and filling most of the frame.',
].join(' ');

function tsv(fichier) {
  const lignes = fs.readFileSync(fichier, 'utf8').split('\n')
    .filter(l => l.trim() && !l.startsWith('#'));
  const entetes = lignes.shift().split('\t');
  return lignes.map(l => {
    const cases = l.split('\t');
    return Object.fromEntries(entetes.map((e, i) => [e, (cases[i] || '').trim()]));
  });
}

// La photo de référence, prise sur la fiche Shopify du produit : c'est elle qui
// empêche le modèle d'inventer un produit plausible mais faux.
//
// Le premier visuel d'une fiche est choisi pour vendre, pas pour montrer la
// construction : les semelles y sont dans leur emballage, les bandeaux posés à
// sept couleurs côte à côte. « handle#rang » désigne donc une autre photo de la
// même fiche, celle qui montre la pièce qu'on doit contrôler.
// PLUSIEURS photos, pas une. Une seule vue laisse le modèle inventer le reste :
// il a rendu les bretelles de la glacière rembourrées et vertes alors que ce
// sont de simples sangles noires, parce qu'aucune photo fournie ne les montrait
// de près. Trois vues valent mieux qu'une consigne écrite.
//
//   « handle »        les trois premières photos de la fiche
//   « handle#2,5,9 »  ces vues-là, quand la première est un emballage ou un
//                     alignement de coloris qui ne montre pas la construction
// « fichier:chemin » désigne un schéma tracé à la main plutôt qu'une photo
// Shopify. Sert quand la géométrie doit être EXACTE et que le modèle ne la
// commet pas sur commande : un curseur d'un côté plutôt que de l'autre, une
// étiquette retournée. On lui donne alors le schéma comme référence et il le
// redessine dans le style des autres planches, au lieu d'inventer le miroir.
function photosDe(handle) {
  if (!handle) return [];
  if (handle.startsWith('fichier:')) {
    return handle.slice(8).split(',').map(f => path.join(RACINE, f.trim()));
  }
  const [nom, rangs] = handle.split('#');
  const toutes = tsv(PHOTOS).filter(x => x.handle === nom);
  if (rangs) {
    return rangs.split(',')
      .map(r => toutes.find(x => x.rang === r.trim()))
      .filter(Boolean).map(x => x.url);
  }
  return toutes
    .sort((a, b) => Number(a.rang) - Number(b.rang))
    .slice(0, 3).map(x => x.url);
}

async function reference(source) {
  let octets;
  if (/^https?:\/\//.test(source)) {
    const rep = await fetch(source);
    if (!rep.ok) throw new Error(`photo de référence ${rep.status} — ${source}`);
    octets = Buffer.from(await rep.arrayBuffer());
  } else {
    octets = fs.readFileSync(source);
  }
  const bas = source.toLowerCase().split('?')[0];
  const mime = bas.endsWith('.png') ? 'image/png'
    : bas.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return { type: 'image', data: octets.toString('base64'), mime_type: mime };
}

// Les panneaux se CHAÎNENT : chacun reçoit le précédent en référence. Sans ça
// chaque appel dessine seul, et l'objet change de forme d'un panneau à l'autre
// — au premier essai le tube du panneau 1 était devenu un carré plat au 3, et
// la traction s'exerçait sur la mauvaise couture. Une planche qui envoie
// inspecter le mauvais endroit est pire qu'une planche laide.
async function dessiner(cle, panneau, precedent) {
  const entree = [{ type: 'text', text: `${STYLE}\n\n${panneau.prompt}` }];

  if (panneau.handle) {
    const urls = photosDe(panneau.handle);
    if (!urls.length) throw new Error(`aucune photo pour le handle « ${panneau.handle} »`);
    entree.push({
      type: 'text',
      text: panneau.handle.startsWith('fichier:')
        ? 'The next image is a hand-drawn DIAGRAM, crude on purpose. It is not a '
          + 'style reference: it is the authority on GEOMETRY — which side things '
          + 'are on, which way they face, where they sit relative to each other. '
          + 'Reproduce that geometry exactly, mirrored nowhere, and redraw it in '
          + 'the flat instructional style described above.'
        : `The next ${urls.length} photographs are different views of the ACTUAL `
          + 'product. Study them together: they are the authority on its shape, its '
          + 'proportions, its seams, its stitching, its hardware and its colours — '
          + 'including the parts the written instruction does not mention. Draw THAT '
          + 'product, not a generic equivalent, and do not invent a detail you cannot '
          + 'see in them. Do not copy a photograph: redraw the product in the flat '
          + 'instructional style described above.',
    });
    for (const u of urls) entree.push(await reference(u));
  }

  if (precedent) {
    entree.push({
      type: 'text',
      text: 'The second image below is the PREVIOUS panel of this same instruction '
          + 'sequence. Keep the very same object: same shape, same proportions, same '
          + 'colour, same seams and hardware in the same places, same drawing style, '
          + 'same background. This panel is the next step of that same gesture on that '
          + 'same seam — do not switch to a different seam, a different side, or a '
          + 'different view of the product.',
    });
    entree.push({ type: 'image', data: precedent.data.toString('base64'), mime_type: precedent.mime });
  }

  const rep = await fetch(API, {
    method: 'POST',
    headers: {
      'x-goog-api-key': process.env.GEMINI_API_KEY,
      'Content-Type': 'application/json',
      'Api-Revision': REVISION,
    },
    body: JSON.stringify({ model: MODELE, input: entree }),
  });

  const corps = await rep.json();
  if (!rep.ok) throw new Error(`API ${rep.status} — ${JSON.stringify(corps).slice(0, 300)}`);

  for (const etape of corps.steps || [])
    for (const bloc of etape.content || [])
      if (bloc.type === 'image' && bloc.data) return Buffer.from(bloc.data, 'base64');

  throw new Error(`aucune image dans la réponse — ${JSON.stringify(corps).slice(0, 300)}`);
}

// 1024 px pour le zoom, 320 px pour la vignette. La qualité 88 est le point où
// un aplat cesse de gagner à monter : 94 double le poids sans rien changer à
// l'œil sur un dessin au trait.
function convertir(png, base) {
  const tmp = `${base}.png`;
  fs.writeFileSync(tmp, png);
  try {
    // 260 px et non 320 : la bande s'affiche à 150 px, donc 260 laisse encore de
    // quoi pour un écran dense, et coupe un tiers du poids. Mesuré sur les
    // planches les plus chargées : 78 Ko la fiche produit à 320, 52 à 260, sans
    // différence visible à l'œil.
    for (const [suffixe, filtre, q] of [['', null, 88], ['-mini', 'scale=260:-1', 76]]) {
      const args = ['-loglevel', 'error', '-y', '-i', tmp];
      if (filtre) args.push('-vf', filtre);
      args.push('-c:v', 'libwebp', '-quality', String(q), `${base}${suffixe}.webp`);
      execFileSync('ffmpeg', args);
    }
  } finally {
    fs.unlinkSync(tmp);
  }
  return fs.statSync(`${base}.webp`).size + fs.statSync(`${base}-mini.webp`).size;
}

async function main() {
  const args    = process.argv.slice(2);
  const sec     = args.includes('--sec');
  const refaire = args.includes('--refaire');
  // Un panneau réussi ne se rejoue pas pour rien : il sert de repère au suivant.
  const depuis  = Number(args[args.indexOf('--depuis') + 1]) || 0;
  const jusqua  = Number(args[args.indexOf('--jusqua') + 1]) || Infinity;
  const tout    = args.includes('--tout');
  const voulue  = args.find(a => !a.startsWith('--'));

  if (!tout && !voulue) {
    console.error('usage : node mrp/outils/planches_ia.js <planche>|--tout [--sec] [--refaire]');
    process.exit(2);
  }

  const rangs = tsv(PROMPTS).filter(r => tout || r.planche === voulue);
  if (!rangs.length) {
    const connues = [...new Set(tsv(PROMPTS).map(r => r.planche))];
    console.error(`planche inconnue : ${voulue}`);
    console.error(`connues : ${connues.join(', ')}`);
    process.exit(2);
  }

  if (!sec && !process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY absente de l\'environnement.');
    console.error('Elle s\'ajoute aux réglages de l\'environnement infonuagique, et');
    console.error('c\'est une NOUVELLE session qui la voit. En attendant : --sec.');
    process.exit(1);
  }

  fs.mkdirSync(SORTIE, { recursive: true });

  let precedent = null;

  for (const r of rangs) {
    const base    = path.join(SORTIE, `${r.planche}-${r.panneau}`);
    const nom     = `${r.planche}-${r.panneau}.webp`;
    const chemin  = `${base}.webp`;

    if (sec) {
      console.log(`\n── ${nom}${r.handle ? '   (référence : ' + r.handle + ')' : ''}`);
      console.log(r.prompt.replace(/(.{88}\S*)\s/g, '$1\n'));
      continue;
    }

    if (r.panneau === '1') precedent = null;

    // Un panneau DESSINÉ À LA MAIN (tracé exact, pas un dessin de modèle) ne se
    // régénère jamais, même avec --refaire : un modèle d'image place mal une
    // flèche de cote, et c'est précisément ce qu'on a dû corriger.
    const exact = /^EXACT\b/.test(r.prompt);
    if (exact) { console.log(`  = ${nom}   (tracé exact, ${r.prompt.slice(6, 60)}…)`);
      if (fs.existsSync(chemin)) precedent = { data: fs.readFileSync(chemin), mime: 'image/webp' };
      continue; }
    const vise = depuis && Number(r.panneau) >= depuis && Number(r.panneau) <= jusqua;
    if (fs.existsSync(chemin) && !refaire && !vise) {
      console.log(`  = ${nom}`);
      precedent = { data: fs.readFileSync(chemin), mime: 'image/webp' };
      continue;
    }

    try {
      const image = await dessiner(r.planche, r, precedent);
      const poids = convertir(image, base);
      precedent = { data: image, mime: 'image/png' };
      console.log(`  + ${nom}   ${(poids / 1024).toFixed(0)} Ko (vignette comprise)`);
    } catch (e) {
      precedent = null;   // la chaîne est rompue : ne pas propager un faux repère
      console.log(`  ! ${nom}   ${e.message}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
