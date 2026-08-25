/**
 * Construit la démo : une page unique qui contient l'app telle qu'elle est.
 *
 * Le parti pris : on ne réécrit rien. Chaque vue est le HTML que le serveur
 * produit vraiment, récupéré tel quel ; seuls les liens et les images sont
 * réadressés vers l'intérieur du fichier. Ce qui se voit dans la démo est donc
 * ce qui se verra dans l'app, pas une maquette qui lui ressemble.
 *
 * Chaque vue est récupérée DEUX FOIS, une par rôle. Le partage des
 * responsabilités — l'atelier déclare l'avancement, Québec pose les priorités —
 * ne se raconte pas, il se voit : on bascule de rôle et les commandes changent,
 * parce que ce sont deux pages réellement différentes.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Le dossier de travail : cookies de session, modèle de données, photos
// rapatriées. Il vit hors du dépôt (rien de lourd n'est versionné).
const SC = process.env.MRP_DEMO_TRAVAIL || __dirname;
const BASE = process.env.MRP_DEMO_BASE || 'http://127.0.0.1:8799';
const RACINE = path.resolve(__dirname, '..', '..');

const ROLES = [
  { id: 'admin',   cookie: path.join(SC, 'ck-admin') },
  { id: 'atelier', cookie: path.join(SC, 'ck-atelier') },
];

const get = (url, cookie) =>
  execFileSync('curl', ['-s', '-b', cookie, BASE + url], { maxBuffer: 64e6 }).toString();

const data = JSON.parse(fs.readFileSync(path.join(SC, 'demo-data.json'), 'utf8'));

// ------------------------------------------------------------------- images
// Une clé par URL : chaque photo n'apparaît qu'une fois dans le fichier, même
// quand plusieurs fiches — ou les deux rôles — la partagent.
const IMGDIR = path.join(SC, 'demoimg3');
const cle = new Map();
const donnees = {};
for (const l of fs.readFileSync(path.join(IMGDIR, 'map.tsv'), 'utf8').trim().split('\n')) {
  const [url, f, code] = l.split('\t');
  if (code !== '200') continue;
  const k = f.replace('.jpg', '');
  cle.set(url, k);
  donnees[k] = 'data:image/jpeg;base64,'
    + fs.readFileSync(path.join(IMGDIR, f)).toString('base64');
}

// -------------------------------------------------------------------- vues
const vues = [
  ['accueil',   '/'],
  ['priorites', '/priorites'],
  ['suivi',     '/suivi'],
  ['ordres',    '/ordres'],
  ['ordres/1',  '/ordres/1'],
  ['produits',  '/produits'],
  ['cedule',    '/cedule'],
  ...data.produits.map(p => [`produits/${p.id}`, `/produits/${p.id}`]),
];
const connues = new Set(vues.map(v => v[0]));

function extrait(html) {
  const m = html.match(/<main>([\s\S]*?)<\/main>/);
  if (!m) throw new Error('pas de <main> — session expirée ?');
  let corps = m[1];

  // Les octets des photos sont embarqués : une page publiée n'a pas le droit
  // d'aller chercher le CDN. C'est la seule différence assumée avec l'app,
  // qui elle ne stocke que des adresses.
  corps = corps.replace(/src="([^"]+)"/g, (t, u) => {
    const propre = u.replace(/&amp;/g, '&').replace(/&(width|format)=[^&"]*/g, '');
    const k = cle.get(propre);
    return k ? `data-img="${k}" src=""` : t;
  });

  // Liens internes → ancres ; tout ce qui écrirait sur le serveur devient inerte.
  corps = corps.replace(/href="\/([^"]*)"/g, (t, chemin) => {
    const c = chemin.replace(/#.*$/, '') || 'accueil';
    return connues.has(c) ? `href="#${c}"` : 'href="#" data-inerte="1"';
  });

  // Les gestionnaires en ligne partent : `this.form.submit()` est un envoi
  // programmatique, et un envoi programmatique NE déclenche PAS les écouteurs
  // `submit` — la page quittait la démo sans que rien ne l'arrête. C'est le
  // script de la démo qui écoute `change` et `click` à la place.
  corps = corps.replace(/\s(onchange|onsubmit|onclick)="[^"]*"/g, '');

  return corps;
}

const pages = [];
for (const r of ROLES) {
  for (const [id, url] of vues) pages.push({ id, role: r.id, html: extrait(get(url, r.cookie)) });
}
console.log(pages.length + ' vues récupérées (' + vues.length + ' × ' + ROLES.length + ' rôles)');

// ------------------------------------------------------------------ modèle
// Ce que le tri et les recalculs demandent, et rien de plus.
const parProduit = new Map(data.produits.map(p => [p.id, p]));
const modele = data.items.map(i => ({
  id: i.id,
  code: (parProduit.get(i.produit_id) || {}).code || '',
  q: i.quantite,
  av: i.avancement,
  pri: i.priorite || 'normale',
  fam: (parProduit.get(i.produit_id) || {}).famille || 'autre',
  jours: i.jours == null ? null : Number(i.jours),
  retard: i.en_retard ? 1 : 0,
}));

// ------------------------------------------------------------------- sortie
const css = fs.readFileSync(path.join(RACINE, 'mrp/public/style.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, 'demo-app.js'), 'utf8');

const doc = `<title>Démo MRP Lasclay</title>
<style>
${css}

/* ------------- ce qui n'existe que dans la démo ------------- */
:root{ --demo:#7a4a12; }
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ --demo:#f0a868; } }
:root[data-theme="dark"]{ --demo:#f0a868; }

.ruban{background:var(--ambre-pale);border-bottom:1px solid var(--ambre-ligne);
  color:var(--demo);font-size:13px;line-height:1.45}
.ruban-in{max-width:1100px;margin:0 auto;padding:9px 16px;
  display:flex;gap:8px 16px;align-items:baseline;flex-wrap:wrap}
.ruban b{font-weight:650}
.ruban .quoi{flex:1;min-width:min(100%,34ch)}
.ruban .cmd{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.ruban button{font:inherit;color:inherit;background:transparent;cursor:pointer;
  border:1px solid currentColor;border-radius:4px;padding:3px 9px;opacity:.72}
.ruban button:hover{opacity:1}
.ruban button[aria-pressed="true"]{opacity:1;background:var(--demo);
  color:var(--ambre-pale);border-color:var(--demo)}
.ruban .sep{opacity:.5}

.vue{display:none}
.vue.on{display:block}
[data-inerte]{cursor:default;opacity:.6}
[data-inerte]:hover{text-decoration:none}
img[data-img]{background:var(--media)}
:focus-visible{outline:2px solid var(--vert);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>

<div class="ruban"><div class="ruban-in">
  <span class="quoi"><b>Démo.</b> Chaque écran est le HTML que le serveur produit
  vraiment, avec le plan 26-27. Rien n'est commencé : c'est l'atelier qui
  déclare, tranche par tranche. Ce que tu poses reste dans ce navigateur.</span>
  <span class="cmd">
    <span class="sep">Vu comme</span>
    <button type="button" data-role="atelier" aria-pressed="false">Montassar</button>
    <button type="button" data-role="admin" aria-pressed="true">Gab &amp; Cath</button>
    <span class="sep">·</span>
    <button type="button" id="raz">Repartir à zéro</button>
  </span>
</div></div>

<header class="top"><div class="top-in">
  <a class="marque" href="#accueil">Lasclay <span>MRP</span></a>
  <nav class="top">
    <a href="#accueil">Tableau de bord</a>
    <a href="#priorites">À fabriquer</a>
    <a href="#ordres">Ordres de production</a>
    <a href="#suivi">Suivi</a>
    <a href="#produits">Produits</a>
    <a href="#cedule">Cédule</a>
  </nav>
  <span class="qui" id="qui">Direction</span>
</div></header>

<main>
${pages.map(p => `<div class="vue" data-vue="${p.id}" data-role="${p.role}">${p.html}</div>`).join('\n')}
</main>

<script>
const IMG = ${JSON.stringify(donnees)};
const ITEMS = ${JSON.stringify(modele)};
${js}
</script>
`;

const sortie = path.join(process.argv[2] || SC, 'demo.html');
fs.writeFileSync(sortie, doc);
console.log(sortie, (Buffer.byteLength(doc) / 1e6).toFixed(2), 'Mo');
