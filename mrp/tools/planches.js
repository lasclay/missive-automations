#!/usr/bin/env node
// Planche-contact des produits : une page par produit de production, avec ses
// photos Shopify, sa composition (charte Miro) et ses vérifications.
//
//   node mrp/tools/planches.js > planches.html
//   chromium --headless --print-to-pdf=PLANCHES-PRODUITS.pdf file://$PWD/planches.html
//
// Les images ne sont PAS hébergées : la page pointe le CDN Shopify avec
// ?width=N, comme l'app. C'est le navigateur qui les cherche à l'impression.

const fs = require('node:fs');
const path = require('node:path');
const D = path.join(__dirname, '..', 'donnees');

const tsv = (f) => {
  const l = fs.readFileSync(path.join(D, f), 'utf8').split('\n')
    .filter(x => x.trim() && !x.startsWith('#'));
  const cols = l[0].split('\t');
  return l.slice(1).map(r => {
    const c = r.split('\t'); const o = {};
    cols.forEach((k, i) => o[k] = (c[i] || '').trim());
    return o;
  });
};

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const corr = tsv('correspondances.tsv');
const plan = tsv('plan-production-2627.tsv');
const ajouts = tsv('ajouts-production.tsv');
const charte = tsv('charte-produits.tsv');
const qual = tsv('qualite-charte.tsv');
const imgs = tsv('shopify-images.tsv');
const bmb = tsv('assemblage-bmb.tsv');

const parImage = new Map();
for (const i of imgs) {
  if (!i.handle || !i.url) continue;
  if (!parImage.has(i.handle)) parImage.set(i.handle, []);
  parImage.get(i.handle).push(i);
}

const qte = (c) => {
  const a = ajouts.find(x => x.produit === c.produit_production);
  if (a && a.quantite_prevue) return +a.quantite_prevue;
  const p = plan.find(x => x.produit === c.alias_plan);
  return p && p.quantite_prevue ? +p.quantite_prevue : null;
};

// --local <dossier> : réécrit les images vers des fichiers rapatriés, pour une
// impression PDF hors ligne (Chromium ne franchit pas le proxy TLS de certains
// environnements). Sans l'option, la page pointe le CDN, comme l'app.
const iLocal = process.argv.indexOf('--local');
const LOCAL = iLocal > -1 ? process.argv[iLocal + 1] : null;
const MAX_PHOTOS = 4;
const nomLocal = (u) => require('node:crypto').createHash('sha1')
  .update(u).digest('hex').slice(0, 16) + '.img';
const url = (u, w) => LOCAL
  ? LOCAL.replace(/\/$/, '') + '/' + nomLocal(u)
  : u + (u.includes('?') ? '&' : '?') + 'width=' + w;

const ORDRE = ['matiere', 'isolant', 'garniture', 'parametre', 'note'];
const TITRE = {
  matiere: 'Matières', isolant: 'Isolant', garniture: 'Garnitures',
  parametre: 'Paramètres machine', note: 'Notes'
};

let pages = '';
let n = 0;
for (const c of corr) {
  // En mode local, une image qui n'a pas pu être rapatriée est écartée plutôt
  // que laissée en cadre cassé : un trou propre vaut mieux qu'une alt sprawlée.
  const ph = (parImage.get(c.handle_shopify) || [])
    .filter(i => !LOCAL || fs.existsSync(path.join(LOCAL, nomLocal(i.url))))
    .slice(0, MAX_PHOTOS);
  const ch = charte.filter(x => x.produit === c.code);
  const qc = qual.filter(x => x.produit === c.code);
  const b = bmb.find(x => x.produit === c.code);
  const q = qte(c);
  n++;

  const compo = ORDRE.map(sec => {
    const li = ch.filter(x => x.section === sec);
    if (!li.length) return '';
    return `<div class="bloc"><h3>${TITRE[sec]}</h3><ul>` +
      li.map(x => `<li>${esc(x.texte)}</li>`).join('') + `</ul></div>`;
  }).join('');

  const verifs = qc.length
    ? `<div class="bloc verif"><h3>Vérifications avant emballage</h3><ul>` +
      qc.map(x => `<li><strong>${esc(x.titre)}</strong>` +
        (x.detail ? ` — ${esc(x.detail)}` : '') +
        (x.consequence ? `<em class="sinon">Sinon : ${esc(x.consequence)}</em>` : '') +
        `</li>`).join('') + `</ul></div>`
    : `<div class="bloc vide"><h3>Vérifications</h3><p>Aucun protocole relevé pour ce produit.</p></div>`;

  const photos = ph.length
    ? `<div class="photos">` + ph.map(i =>
        `<figure><img src="${esc(url(i.url, 400))}" loading="eager"
           alt="${esc(i.texte_alternatif || '')}"><figcaption>${esc((i.texte_alternatif || '').slice(0, 90))}</figcaption></figure>`
      ).join('') + `</div>`
    : `<div class="photos aucune">Aucune photo rattachée — ${c.handle_shopify ? 'le handle ne rend pas d\'image' : 'aucune fiche Shopify'}.</div>`;

  pages += `
<section class="page">
  <header>
    <div class="ligne">
      <span class="code">${esc(c.code)}</span>
      <h2>${esc(c.produit_production)}</h2>
    </div>
    <div class="meta">
      <span class="tag f-${esc(c.famille)}">${esc(c.famille)}</span>
      <span class="tag fab">${esc(c.fabrication)}</span>
      <span class="tag conf conf-${c.confiance.replace(/\s+/g, '-')}">${esc(c.confiance)}</span>
      ${q ? `<span class="tag qte">${q.toLocaleString('fr-CA')} au plan</span>` : ''}
      ${b ? `<span class="tag bmb">BMB ${esc(b.assemblage_bmb)} $/u</span>` : ''}
    </div>
  </header>
  ${photos}
  <div class="colonnes">
    <div class="col">${compo || '<div class="bloc vide"><h3>Composition</h3><p>Pas de fiche à la charte.</p></div>'}</div>
    <div class="col">${verifs}</div>
  </div>
  ${c.note ? `<footer class="note"><strong>Note de rattachement :</strong> ${esc(c.note)}</footer>` : ''}
  <div class="folio">${n} / ${corr.length} · Planche produits Lasclay</div>
</section>`;
}

if (process.argv.includes('--liste-images')) {
  const vues = new Set();
  for (const c of corr)
    for (const i of (parImage.get(c.handle_shopify) || []).slice(0, MAX_PHOTOS))
      if (!vues.has(i.url)) { vues.add(i.url);
        process.stdout.write(nomLocal(i.url) + '\t' + i.url + '\n'); }
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
process.stdout.write(`<!doctype html><html lang="fr"><meta charset="utf-8">
<title>Planches produits Lasclay</title>
<style>
  @page { size: A4; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font: 10pt/1.45 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
         color: #1a1a1a; margin: 0; }
  .couv { page-break-after: always; padding: 40mm 10mm 0; }
  .couv h1 { font-size: 26pt; margin: 0 0 4mm; letter-spacing: -.5pt; }
  .couv p { max-width: 150mm; color: #444; }
  .couv table { margin-top: 8mm; border-collapse: collapse; font-size: 9pt; }
  .couv td { padding: 1.5mm 4mm 1.5mm 0; vertical-align: top; }
  .couv td:first-child { color: #777; white-space: nowrap; }
  .page { page-break-after: always; padding-bottom: 6mm; }
  .page:last-child { page-break-after: auto; }
  header { border-bottom: 2px solid #1a1a1a; padding-bottom: 2mm; margin-bottom: 3mm; }
  .ligne { display: flex; align-items: baseline; gap: 4mm; }
  .code { font: 700 8pt/1 ui-monospace,SFMono-Regular,Menlo,monospace;
          background: #1a1a1a; color: #fff; padding: 1.4mm 2mm; border-radius: 1mm; }
  h2 { font-size: 16pt; margin: 0; }
  .meta { margin-top: 2mm; display: flex; flex-wrap: wrap; gap: 2mm; }
  .tag { font-size: 7.5pt; padding: .8mm 2mm; border-radius: 1mm; background: #eee; color: #333; }
  .f-hiver { background: #dbe7f0; } .f-nouveau { background: #f0e4d6; }
  .f-isotherme { background: #dceadb; } .f-autre { background: #ececec; }
  .fab { background: #1a1a1a; color: #fff; }
  .conf-sûr { background: #d7ecd7; } .conf-à-confirmer { background: #fbecc8; }
  .conf-non-couvert, .conf-non-produit, .conf-non-vendu { background: #f3d9d9; }
  .conf-partiel { background: #fbecc8; }
  .qte { background: #1a1a1a; color: #fff; } .bmb { background: #efe7f5; }
  .photos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; margin-bottom: 4mm; }
  .photos figure { margin: 0; }
  .photos img { width: 100%; height: 52mm; object-fit: contain;
                background: #f6f6f6; border: 1px solid #e3e3e3; border-radius: 1mm; }
  figcaption { font-size: 6.5pt; color: #777; margin-top: .8mm; line-height: 1.25; }
  .photos.aucune { display: block; font-size: 8.5pt; color: #999; font-style: italic;
                   border: 1px dashed #ccc; padding: 6mm; text-align: center; border-radius: 1mm; }
  .colonnes { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .bloc { margin-bottom: 3.5mm; break-inside: avoid; }
  h3 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .4pt;
       color: #666; margin: 0 0 1.2mm; border-bottom: 1px solid #ddd; padding-bottom: .8mm; }
  ul { margin: 0; padding-left: 4mm; }
  li { margin-bottom: .8mm; }
  .verif h3 { color: #8a6d00; border-color: #e6d08a; }
  .sinon { display: block; color: #a11; font-size: 8pt; font-style: italic; }
  .vide p { color: #aaa; font-style: italic; margin: 0; }
  .note { margin-top: 3mm; font-size: 8pt; color: #555; background: #f7f7f7;
          border-left: 2px solid #ccc; padding: 2mm 3mm; border-radius: 0 1mm 1mm 0; }
  .folio { position: absolute; font-size: 7pt; color: #aaa; }
</style>
<section class="couv">
  <h1>Planches produits Lasclay</h1>
  <p>Une page par produit de production : ses photos, sa composition telle que la charte
  la décrit, et ce qu'il faut vérifier avant d'emballer. Document de référence pour l'atelier
  et pour la conception du MRP.</p>
  <p><strong>Les photos ne sont pas hébergées ici</strong> — ce sont des adresses du CDN Shopify,
  servies redimensionnées, exactement comme dans l'application. Une photo retirée de Shopify
  laissera un cadre vide : la source reste la seule vérité.</p>
  <table>
    <tr><td>Généré le</td><td>${today}</td></tr>
    <tr><td>Produits</td><td>${corr.length} produits de production</td></tr>
    <tr><td>Sources</td><td>correspondances.tsv · plan-production-2627.tsv · ajouts-production.tsv<br>
        charte-produits.tsv et qualite-charte.tsv (tableau Miro <code>uXjVHuYrQSA=</code>)<br>
        shopify-images.tsv · assemblage-bmb.tsv</td></tr>
    <tr><td>Régénérer</td><td><code>node mrp/tools/planches.js &gt; planches.html</code><br>
        puis impression PDF par Chromium sans en-tête</td></tr>
  </table>
</section>
${pages}
</html>`);
