#!/usr/bin/env node
// Detecte les commerces qui louent de l'espace a des createurs au lieu de
// prendre en consignation. Les deux modeles sont incompatibles: chez eux le
// detaillant n'assume aucun risque et le fournisseur paie d'avance.
//
// Ce controle manquait. Le pointage recompensait au contraire les mots
// « local », « maker », « market » et « collective », qui sont precisement le
// vocabulaire de ces marches. BIPOC + Local Maker Marketplace, premier rang de
// sa zone, a repondu qu'il loue des tablettes a 175 $ par mois.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const PAGES = ['', '/pages/vendors', '/vendors', '/pages/vendor-application',
  '/rent', '/pages/rent', '/louer', '/kiosques', '/about', '/pages/about', '/faq'];

// formules qui trahissent la location d'espace plutot que la consignation
const LOCATION = [
  'rental based', 'rent a shelf', 'shelf rental', 'booth rental', 'rent a booth',
  'rent space', 'space rental', 'rental space', 'vendor fee', 'monthly rent',
  'per month on a', 'vendor application', 'become a vendor', 'vendor spots',
  'rent your own', 'rental market', 'artisan rental', 'per shelf', 'shelf space for rent',
  'louer un kiosque', 'location de kiosque', 'espace a louer', 'louer une tablette',
  'devenir exposant', 'frais de location', 'par mois pour',
];
// mentions explicites de consignation: signal contraire, on l'affiche aussi
const CONSIGNE = ['consignment', 'consignation', 'on consignment', 'we consign'];

function get(url) {
  return new Promise((r) => execFile('curl',
    ['-sSL', '--max-time', '12', '--connect-timeout', '6', '--compressed',
     '-A', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36', url],
    { maxBuffer: 8e6 }, (e, o) => r(e ? '' : (o || '').slice(0, 400000))));
}

async function examiner(f) {
  const res = { ...f, modele: 'indetermine', preuves: [] };
  if (!f.web || !/^https?:/.test(f.web)) return res;
  const base = f.web.replace(/\/$/, '');
  for (const p of PAGES) {
    const html = await get(base + p);
    if (!html || html.length < 200) { if (p === '') break; else continue; }
    const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
    for (const m of LOCATION) {
      if (t.includes(m) && !res.preuves.includes(m)) {
        res.modele = 'location';
        const i = t.indexOf(m);
        res.preuves.push(m);
        res.extrait = res.extrait || t.slice(Math.max(0, i - 70), i + 110).trim();
      }
    }
    if (res.modele !== 'location' && CONSIGNE.some(m => t.includes(m))) res.modele = 'consignation possible';
    if (res.modele === 'location') break;
  }
  return res;
}

(async () => {
  const file = JSON.parse(fs.readFileSync(path.join(__dirname, 'file_attente.json'), 'utf8'));
  const cibles = file.filter(f => f.vague === 1 && f.canal === 'courriel'
    && ['en_attente', 'envoye'].includes(f.etat) && f.web);
  console.error(`${cibles.length} commerces a examiner`);
  const out = [];
  let i = 0, n = 0;
  async function w() {
    while (i < cibles.length) {
      out.push(await examiner(cibles[i++]));
      if (++n % 20 === 0) console.error(`${n}/${cibles.length}`);
    }
  }
  await Promise.all(Array.from({ length: 25 }, w));
  fs.writeFileSync(path.join(__dirname, 'modeles_affaires.json'), JSON.stringify(out, null, 1));
  const loc = out.filter(x => x.modele === 'location');
  console.log(`\nLOCATION D'ESPACE detectee: ${loc.length}`);
  loc.forEach(x => console.log(`  [${x.etat}] ${x.nom.slice(0, 34).padEnd(36)} ${x.zone.slice(0, 26).padEnd(28)} ${x.preuves.slice(0, 2).join(', ')}`));
  console.log(`\nconsignation mentionnee: ${out.filter(x => x.modele === 'consignation possible').length}`);
  console.log(`indetermine            : ${out.filter(x => x.modele === 'indetermine').length}`);
})();
