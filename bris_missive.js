/**
 * Lasclay — bris_missive.js
 * ---------------------------------------------------------------------------
 * Extrait de la boîte Missive ce que les clients disent des produits QUI
 * CASSENT, groupé par produit, avec les photos qu'ils ont jointes.
 *
 * POURQUOI CET OUTIL EXISTE
 *
 * L'atelier en Tunisie ne lit pas la boîte support. Il reçoit des consignes,
 * pas des raisons. « Renforcer l'attache de ganse » se discute ; « la ganse
 * s'est décousue après trois semaines, je m'en servais tous les jours pour
 * aller travailler », avec la photo, ne se discute pas. Ce script va chercher
 * ces phrases-là et les amène dans le MRP.
 *
 * LE GISEMENT EXISTE DÉJÀ
 *
 * Personne n'a à deviner quel fil parle de quel produit : la boîte porte des
 * étiquettes « Support/R&D/<produit> » depuis des années, plus « RETOURS -
 * ECHANGES » et « Produit défectueux ». On part de là plutôt que de balayer
 * les 3 214 fils de la boîte, ce qui serait lent et bien moins précis.
 *
 * TROIS ÉTAPES, SÉPARÉES EXPRÈS
 *
 *   collecte   lit les fils étiquetés et les met en cache local (reprend où il
 *              s'est arrêté ; un fil déjà lu n'est jamais relu)
 *   trier      pré-filtre par mots de bris, ne garde que ce que le CLIENT a
 *              écrit, et sort un TSV à relire à la main
 *   photos     télécharge les images jointes des fils retenus
 *
 * Rien n'entre dans le MRP directement : le TSV se relit avant, comme
 * qualite-amorce.tsv. Un faux positif dans un protocole coûte plus cher qu'un
 * signalement manquant.
 *
 *   node bris_missive.js collecte [--gisement=rd|retours|tout]
 *   node bris_missive.js trier    [--gisement=…] > mrp/donnees/bris-missive.tsv
 *   node bris_missive.js photos   <dossier>
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CACHE = path.join(__dirname, '.cache-bris-missive');
fs.mkdirSync(CACHE, { recursive: true });

/**
 * Les étiquettes, avec le produit qu'elles désignent quand elles le désignent.
 * `produit` est un code du MRP ; null = à déterminer à la lecture.
 */
const GISEMENTS = {
  rd: [
    ['R&D',                     'fa3615d0-a970-4913-a16c-258b30721d43', null],
    ['R&D/cache-cou',           'a647f1f8-fe4b-42ac-b946-52b3f30fe0bd', 'CACHE-COU'],
    ['R&D/Étui cellulaire',     '1456d145-91c1-429c-b76e-97183d16bb31', 'ETUI-TEL'],
    ['R&D/Glacière',            '4c1ab074-5a7d-4e8a-b21e-e6109ad11179', 'GLACIERE'],
    ['R&D/Glacière abimée',     '7e0a1507-8bd9-4b90-968a-f2b82a3705ed', 'GLACIERE'],
    ['R&D/glacière brisée',     '821956e0-44b3-4d83-93e5-8c45e7432f2e', 'GLACIERE'],
    ['R&D/Mitaine',             '67eaaa92-7976-4877-b733-719f55d22a78', null],
    ['R&D/Mitaine de four',     'f0cc9ac9-5704-4155-8460-7b1b104e1a1b', null],
    ['R&D/Sac lunch',           'd34c4efb-70e5-48a6-8b8b-4bd90e00f25a', 'SAC-LUNCH'],
    ['R&D/Semelle',             '67589e17-6c9b-4aa9-9c0c-250f90c8a7fc', null],
    ['R&D/Tuque sport',         '917b120f-9a27-419f-b0e2-6f284e154780', 'TUQUE-SPORT'],
    ['Produit défectueux',      '4a03e6f7-01d3-4784-a1ea-e88902476a2e', null],
  ],
  // Réponses à une infolettre : de l'enthousiasme et des questions de taille,
  // pas des bris. Gisement séparé — les mélanger a produit 48 faux « bris de
  // tuque » qui étaient des gens ravis posant une question sur les manteaux.
  infolettre: [
    ['R&D/Feedbacks manteaux',  '60eb077f-b94b-4551-874d-0a25b328d273', null],
  ],
  retours: [
    ['RETOURS - ECHANGES',      'b2ff154e-65f1-498f-8bfd-40c52854fd69', null],
  ],
};
GISEMENTS.tout = [...GISEMENTS.rd, ...GISEMENTS.retours, ...GISEMENTS.infolettre];

const missive = (...args) => JSON.parse(execFileSync('node',
  [path.join(__dirname, 'missive_client.js'), ...args],
  { encoding: 'utf8', timeout: 600000, maxBuffer: 128e6 }));

const arg = (nom, defaut) => {
  const a = process.argv.find(x => x.startsWith(`--${nom}=`));
  return a ? a.slice(nom.length + 3) : defaut;
};

// --------------------------------------------------------------- collecte
function collecte() {
  const gis = GISEMENTS[arg('gisement', 'rd')] || GISEMENTS.rd;
  const vus = new Map();                    // convId → étiquettes qui le portent
  for (const [nom, id, produit] of gis) {
    let r;
    try { r = missive('list', `shared_label=${id}`); }
    catch (e) { console.error(`  ${nom} : ${String(e.message).slice(0, 80)}`); continue; }
    for (const c of r.conversations || []) {
      if (!vus.has(c.id)) vus.set(c.id, { etiquettes: [], produits: [], sujet: c.subject });
      vus.get(c.id).etiquettes.push(nom);
      if (produit) vus.get(c.id).produits.push(produit);
    }
    console.error(`  ${String((r.conversations || []).length).padStart(5)}  ${nom}`);
  }
  console.error(`\n  ${vus.size} fils distincts\n`);

  let lus = 0, deja = 0, rates = 0;
  for (const [id, meta] of vus) {
    const f = path.join(CACHE, `${id}.json`);
    if (fs.existsSync(f)) { deja++; continue; }
    try {
      const conv = missive('read', id);
      fs.writeFileSync(f, JSON.stringify({ id, ...meta, ...conv }));
      lus++;
      if (lus % 10 === 0) console.error(`  ${lus} lus…`);
    } catch (e) {
      rates++;
      console.error(`  ${id} : ${String(e.message).slice(0, 70)}`);
    }
  }
  console.error(`\n  ${lus} lus, ${deja} déjà en cache, ${rates} en échec`);
  console.error(`  cache : ${CACHE}`);
}

// ------------------------------------------------------------------ tri
/**
 * Les mots qui disent qu'une chose a cassé.
 *
 * Volontairement large : c'est un PRÉ-filtre. Un faux positif se jette à la
 * relecture ; un fil manqué ici ne revient jamais. « Petit » et « grand » n'y
 * sont pas — une question de taille n'est pas un bris, et les retours pour
 * taille sont l'essentiel du label RETOURS.
 */
const MOTS_BRIS = new RegExp([
  'bris\\w*', 'brise\\w*', 'brisé\\w*', 'cass\\w+', 'décous\\w+', 'decous\\w+',
  'défait\\w*', 'defait\\w*', 'déchir\\w+', 'dechir\\w+', 'troué\\w*', 'troue\\w*',
  'trou\\b', 'fissur\\w+', 'craqu\\w+', 'fendu\\w*', 'perc[ée]\\w*',
  'lâché\\w*', 'lache\\w*', 'arrach\\w+', 'détach\\w+', 'detach\\w+',
  'défectu\\w+', 'defectu\\w+', 'défaut', 'defaut', 'bris\\b',
  'coutur\\w+', 'fil qui', 'effiloch\\w+', 'usure', 'usé\\w*',
  'fermeture éclair', 'fermeture eclair', 'zip\\w*', 'glissière', 'glissiere',
  'curseur', 'boucle', 'sangle', 'bretelle', 'ganse', 'attache',
  'ne tient plus', "s'est ouvert", 'ne ferme plus', 'ne fonctionne plus',
  'garantie', 'réparer', 'reparer', 'réparation', 'reparation',
  'broken', 'ripped', 'torn', 'seam', 'stitch\\w*', 'came apart', 'fell apart',
  'defect\\w*', 'zipper', 'strap', 'handle',
].join('|'), 'i');

/**
 * Ce qui ressemble à une donnée personnelle et n'a rien à faire en atelier.
 *
 * L'atelier a besoin du problème, pas de la personne. On retire le courriel,
 * le numéro de commande, le téléphone, le code postal — et la signature, qui
 * est là où les noms de famille se trouvent. Le lien vers le fil Missive reste
 * dans le TSV pour qui doit remonter à la source.
 *
 * Ce n'est pas une anonymisation garantie : un client peut se nommer en plein
 * milieu d'une phrase. C'est pourquoi l'extrait n'est pas versionné.
 */
const SIGNATURE = new RegExp(
  '\\s*(?:' + [
    'Envoyé de mon\\b', 'Sent from my\\b', 'Envoyé à partir de\\b',
    'Merci (?:et )?(?:meilleures |bien )?(?:salutations|cordialement)',
    'Bien à vous', 'Cordialement', 'Au plaisir', 'Salutations distinguées',
  ].join('|') + ')[\\s\\S]*$', 'i');

function anonymiser(t) {
  return String(t || '')
    .replace(SIGNATURE, '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[courriel]')
    .replace(/\bL-?\s?\d{4,}\b/gi, '[commande]')
    .replace(/\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[téléphone]')
    .replace(/\b[A-Z]\d[A-Z][\s-]?\d[A-Z]\d\b/g, '[code postal]')
    .trim();
}

/**
 * Le message d'origine, sans l'historique cité.
 *
 * Un client répond en citant tout le fil : garder la citation ferait passer un
 * accusé de réception pour un signalement. On coupe au premier marqueur de
 * citation, et on garde le début — c'est là qu'est le problème.
 */
function sansCitation(t) {
  const s = String(t || '');
  // « Le dim. 18 mai 2025 à 12:06, X a écrit : » — le jour vient avant le
  // quantième, donc « Le » suivi d'un chiffre ne suffit pas. C'est ce détail
  // qui laissait passer l'infolettre entière dans le texte du client.
  const coupe = s.search(
    /\n\s*(?:Le\s+\S+.{0,40}?a\s+écrit\s*:|On\s+.{0,60}?wrote\s*:|-{2,}\s*(?:Forwarded|Message|Original)|De\s*:|From\s*:|Envoyé\s*:|>\s)/i);
  // Couper dès qu'on trouve la citation, même tôt. Le seuil de 40 caractères
  // gardait le courriel entier quand la réponse était courte — « Passionnant,
  // quelle quête ! » suivi de toute l'infolettre, mots de bris compris.
  return (coupe >= 0 ? s.slice(0, coupe) : s).replace(/\s+/g, ' ').trim();
}

/** Devine le produit d'après l'étiquette, puis d'après ce qui est écrit. */
const INDICES = [
  [/glaci[èe]re|sac ?[àa] ?dos isotherme/i, 'GLACIERE'],
  [/sac ?[àa] ?lunch|lunch ?bag/i,          'SAC-LUNCH'],
  [/besace/i,                                'BESACE'],
  [/tote/i,                                  'TOTE'],
  [/[ée]tui.*(t[ée]l[ée]phone|cellulaire)|phone case/i, 'ETUI-TEL'],
  [/cache-?cou|neck ?warmer/i,               'CACHE-COU'],
  [/foulard|scarf/i,                         'FOULARD'],
  [/bandeau|headband/i,                      'BANDEAU'],
  [/tuque|beanie/i,                          'TUQUE-SPORT'],
  [/semelle|insole/i,                        'SEMELLE-678'],
  [/manteau|coat|parka/i,                    'MANTEAU-HIVER'],
  [/veste|vest\b/i,                          'VESTE'],
  [/chandail|sweater|pull/i,                 'CHANDAIL'],
  [/mitaine|mitt/i,                          'MIT-PLEIN-AIR'],
  [/gants? magiques?/i,                      'GANTS-MAGIQUES'],
  [/coussin/i,                               'COUSSIN'],
  [/oreiller|pillow/i,                       'OREILLER'],
  [/sac de couchage|sleeping bag/i,          'SAC-COUCHAGE-18'],
];
function devinerProduit(conv, texte) {
  if (conv.produits && conv.produits.length) return conv.produits[0];
  const foin = `${conv.sujet || ''} ${texte}`;
  for (const [re, code] of INDICES) if (re.test(foin)) return code;
  return '';
}

function trier() {
  const fichiers = fs.readdirSync(CACHE).filter(f => f.endsWith('.json'));
  const lignes = [];
  let sansBris = 0, sansClient = 0, infolettre = 0, tropCourt = 0;

  for (const f of fichiers) {
    let c;
    try { c = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
    // Seuls les messages du CLIENT comptent : nos propres réponses citent le
    // problème et passeraient le filtre en disant l'inverse de ce qu'on cherche.
    // Les réponses à l'infolettre ne sont pas des bris. On les écarte ici et
    // pas seulement à la collecte : le cache garde ce qui a déjà été lu.
    const etq = c.etiquettes || [];
    if (etq.length && etq.every(x => /Feedbacks manteaux/i.test(x))) { infolettre++; continue; }

    const duClient = (c.messages || []).filter(m => m.us === false);
    if (!duClient.length) { sansClient++; continue; }

    // Le premier message du client porte le problème ; les suivants relancent.
    const premier = duClient[0];
    const texte = sansCitation(premier.text);
    // Ses mots à lui, jamais ce qu'il cite. Une réponse à l'infolettre embarque
    // tout le courriel de Lasclay, où figurent le mot « tuque » et le mot
    // « couture » : filtrer là-dessus a produit quarante-huit faux bris.
    const propre = duClient.map(m => sansCitation(m.text)).join(' ').trim();
    // Sous une quinzaine de caractères, le client n'a rien dit de propre —
    // c'est un « merci » ou un transfert. Rien à en tirer.
    if (propre.length < 15 && !MOTS_BRIS.test(c.sujet || '')) { tropCourt++; continue; }
    if (!MOTS_BRIS.test(`${c.sujet || ''} ${propre}`)) { sansBris++; continue; }

    const images = [];
    for (const m of c.messages || [])
      for (const a of m.attachments || [])
        if (/^image\//.test(a.media_type || '')) images.push(`${m.id}:${a.id}`);

    lignes.push({
      conv: c.id,
      produit: devinerProduit(c, propre),
      date: premier.date || '',
      sujet: anonymiser(c.sujet || ''),
      citation: anonymiser(texte).slice(0, 600),
      images: images.join(' '),
      etiquettes: (c.etiquettes || []).join(' | '),
    });
  }

  lignes.sort((a, b) => (a.produit || 'zzz').localeCompare(b.produit || 'zzz')
    || (b.date || '').localeCompare(a.date || ''));

  const COLS = ['garder', 'produit', 'zone', 'date', 'citation', 'images', 'conv',
                'sujet', 'etiquettes'];
  console.log(`# Bris signalés par les clients, extraits de Missive.
#
# CE FICHIER EST UN BROUILLON. Le pré-filtre est volontairement large : un faux
# positif se jette d'un coup d'œil, un fil manqué ne revient jamais. Relis,
# remplis « garder » et « zone », puis importe.
#
#   garder   o = à importer, vide ou n = à jeter
#   zone     où ça casse : « attache de ganse », « couture d'emmanchure ».
#            C'est la colonne qui permet de voir qu'une même zone lâche sur
#            plusieurs produits — remplis-la, c'est elle qui a le plus de valeur.
#   citation le client, mot pour mot, anonymisé. NE PAS reformuler.
#   images   « messageId:attachmentId », séparés par des espaces
#
# ${lignes.length} fils retenus · ${sansBris} sans mot de bris · ${infolettre} réponses
# d'infolettre · ${tropCourt} sans texte propre · ${sansClient} sans message client
#
# Importer : node mrp/import_bris.js --ecrire`);
  console.log(COLS.join('\t'));
  for (const l of lignes)
    console.log([l.produit ? 'o' : '', l.produit, '', l.date, l.citation,
                 l.images, l.conv, l.sujet, l.etiquettes]
      .map(x => String(x).replace(/[\t\n\r]/g, ' ')).join('\t'));

  console.error(`\n  ${lignes.length} fils retenus sur ${fichiers.length} en cache`);
  console.error(`  ${sansBris} sans mot de bris, ${infolettre} réponses d'infolettre, `
    + `${tropCourt} sans texte propre, ${sansClient} sans message du client`);
  const parProduit = {};
  for (const l of lignes) parProduit[l.produit || '(à déterminer)'] =
    (parProduit[l.produit || '(à déterminer)'] || 0) + 1;
  console.error('');
  for (const [p, n] of Object.entries(parProduit).sort((a, b) => b[1] - a[1]))
    console.error(`  ${String(n).padStart(4)}  ${p}`);
  console.error(`\n  ${lignes.filter(l => l.images).length} fils avec au moins une photo`);
}

// --------------------------------------------------------------- photos
function photos() {
  const dossier = process.argv[3];
  if (!dossier) { console.error('Il faut un dossier de sortie.'); process.exit(1); }
  fs.mkdirSync(dossier, { recursive: true });
  const src = process.argv.find(a => a.endsWith('.tsv'));
  if (!src) { console.error('Il faut le TSV relu en argument.'); process.exit(1); }

  const l = fs.readFileSync(src, 'utf8').trim().split('\n').filter(x => !x.startsWith('#'));
  const cols = l[0].split('\t');
  let pris = 0, rates = 0;
  for (const r of l.slice(1)) {
    const v = Object.fromEntries(cols.map((k, i) => [k, (r.split('\t')[i] ?? '').trim()]));
    if (v.garder !== 'o' || !v.images) continue;
    for (const paire of v.images.split(/\s+/)) {
      const [messageId, attachmentId] = paire.split(':');
      const nom = `${v.produit || 'inconnu'}_${v.conv.slice(0, 8)}_${attachmentId.slice(0, 8)}`;
      try {
        const r2 = missive('attachment', messageId, attachmentId);
        const ext = (r2.filename || '').split('.').pop() || 'jpg';
        fs.writeFileSync(path.join(dossier, `${nom}.${ext}`),
          Buffer.from(r2.base64 || r2.data || '', 'base64'));
        pris++;
      } catch (e) { rates++; console.error(`  ${nom} : ${String(e.message).slice(0, 70)}`); }
    }
  }
  console.error(`\n  ${pris} photos téléchargées, ${rates} en échec → ${dossier}`);
}

const cmd = process.argv[2];
if (cmd === 'collecte') collecte();
else if (cmd === 'trier') trier();
else if (cmd === 'photos') photos();
else {
  console.error(`Usage :
  node bris_missive.js collecte [--gisement=rd|retours|tout]
  node bris_missive.js trier    > mrp/donnees/bris-missive.tsv
  node bris_missive.js photos <dossier> <tsv-relu>`);
  process.exit(1);
}
