#!/usr/bin/env node
/**
 * Joint l'intensité d'achat par municipalité au revenu des ménages du
 * Recensement de 2021 (tableau 98-10-0060-01 de Statistique Canada, niveau
 * subdivision de recensement).
 *
 *   node geodemo/revenus_municipalites.js <analyse.json> <98100060.csv> [sortie]
 *
 * Le fichier de Statistique Canada est volumineux : on ne retient que les
 * lignes « tous genres de ménages / tous types de construction » (coordonnée
 * se terminant par .1.1) et les subdivisions du Québec (IDUGD 2021A000524…).
 */

const fs = require('fs');
const path = require('path');

const [, , analysePath, statcanPath, outDirArg] = process.argv;
if (!analysePath || !statcanPath) {
  console.error('usage: node geodemo/revenus_municipalites.js <analyse.json> <98100060.csv> [sortie]');
  process.exit(1);
}
const outDir = outDirArg || path.dirname(analysePath);

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/^st[- ]/, 'saint-').replace(/^ste[- ]/, 'sainte-')
  .replace(/[^a-z]/g, '');

/** Subdivisions de recensement du Québec : nom plié -> { menages, revenus }. */
function loadCsd(file) {
  const par = new Map();
  const lignes = fs.readFileSync(file, 'utf8').split('\n');
  for (const line of lignes) {
    if (!line.startsWith('2021;')) continue;
    const f = line.split(';');
    const dguid = f[2];
    if (!dguid.startsWith('2021A000524')) continue;   // subdivisions du Québec
    if (!/\.1\.1$/.test(f[5])) continue;              // total ménages / total construction
    const menages = Number(f[6]);
    const revenuMedian = Number(f[8]);
    const revenuApresImpot = Number(f[10]);
    if (!Number.isFinite(menages) || !Number.isFinite(revenuMedian) || !revenuMedian) continue;
    const cle = fold(f[1]);
    const rec = { nom: f[1], dguid, menages, revenuMedian, revenuApresImpot };
    if (!par.has(cle)) par.set(cle, []);
    par.get(cle).push(rec);
  }
  return par;
}

function main() {
  const analyse = JSON.parse(fs.readFileSync(analysePath, 'utf8'));
  const csd = loadCsd(statcanPath);

  const lignes = [];
  const nonAppariees = [];

  for (const m of analyse.municipalites) {
    const [prov, nomPlie] = m.cle.split('|');
    if (prov !== 'QC') continue;
    const candidats = csd.get(fold(nomPlie));
    if (!candidats || !candidats.length) { nonAppariees.push(m.lieu); continue; }
    // Homonymes au Québec : on retient la plus peuplée et on signale le doute.
    const tries = [...candidats].sort((a, b) => b.menages - a.menages);
    const homonyme = tries.length > 1 && tries[1].menages > tries[0].menages * 0.2;
    const c = tries[0];
    lignes.push({
      municipalite: c.nom,
      clients: m.clients,
      commandes: m.commandes,
      ventes: m.ventes,
      commandesParClient: m.commandesParClient,
      tauxRecurrence: m.tauxRecurrence,
      valeurMoyenne: m.valeurMoyenne,
      menages: c.menages,
      revenuMedian: c.revenuMedian,
      revenuApresImpot: c.revenuApresImpot,
      clientsPar1000Menages: +(m.clients / c.menages * 1000).toFixed(2),
      commandesPar1000Menages: +(m.commandes / c.menages * 1000).toFixed(2),
      homonymeIncertain: homonyme || undefined,
    });
  }

  lignes.sort((a, b) => b.commandes - a.commandes);

  const cols = ['municipalite', 'clients', 'commandes', 'ventes', 'menages', 'revenuMedian',
    'revenuApresImpot', 'clientsPar1000Menages', 'commandesPar1000Menages',
    'commandesParClient', 'tauxRecurrence', 'valeurMoyenne'];
  fs.writeFileSync(path.join(outDir, 'municipalites_revenus.tsv'),
    [cols.join('\t'), ...lignes.map((r) => cols.map((c) => r[c] ?? '').join('\t'))].join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'municipalites_revenus.json'),
    JSON.stringify({ genere: new Date().toISOString(), lignes, nonAppariees }, null, 2));

  const $ = (n) => Number(n).toLocaleString('fr-CA');
  console.log(`${lignes.length} municipalités québécoises appariées (${nonAppariees.length} sans correspondance : ${nonAppariees.slice(0, 6).join(', ')}${nonAppariees.length > 6 ? '…' : ''})\n`);

  const tete = (titre, rows) => {
    console.log(`=== ${titre} ===`);
    console.log('municipalité                clients  commandes  cmd/1000 mén.  revenu médian  valeur moy.');
    for (const r of rows) {
      console.log(`${r.municipalite.slice(0, 26).padEnd(27)} ${$(r.clients).padStart(7)} ${$(r.commandes).padStart(10)} ` +
        `${String(r.commandesPar1000Menages).padStart(14)} ${($(r.revenuMedian) + ' $').padStart(14)} ${($(r.valeurMoyenne) + ' $').padStart(12)}`);
    }
    console.log('');
  };

  tete('Volume — 15 premières municipalités', lignes.slice(0, 15));
  tete('Pénétration — 15 premières (≥ 2 000 ménages)',
    [...lignes].filter((r) => r.menages >= 2000)
      .sort((a, b) => b.commandesPar1000Menages - a.commandesPar1000Menages).slice(0, 15));
}

main();
