#!/usr/bin/env node
/**
 * Croise l'intensité d'achat par RTA (région de tri d'acheminement — les trois
 * premiers caractères du code postal) avec le revenu des ménages du
 * Recensement de 2021 de Statistique Canada.
 *
 * Entrées :
 *   1. analyse.json         — produit par geodemo/prenoms_regions.js
 *   2. fsa_income_raw.csv   — lignes du profil du recensement 98-401-X2021013
 *                             (RTA) filtrées sur les caractéristiques 1, 50,
 *                             243 et 244. Voir geodemo/README.md.
 *
 *   node geodemo/croisement_revenus.js <analyse.json> <fsa_income_raw.csv> [sortie]
 */

const fs = require('fs');
const path = require('path');

const [, , analysePath, incomePath, outDirArg] = process.argv;
if (!analysePath || !incomePath) {
  console.error('usage: node geodemo/croisement_revenus.js <analyse.json> <fsa_income_raw.csv> [sortie]');
  process.exit(1);
}
const outDir = outDirArg || path.dirname(analysePath);

/** Première lettre de la RTA -> province. */
const FSA_PROVINCE = {
  A: 'NL', B: 'NS', C: 'PE', E: 'NB', G: 'QC', H: 'QC', J: 'QC',
  K: 'ON', L: 'ON', M: 'ON', N: 'ON', P: 'ON', R: 'MB', S: 'SK',
  T: 'AB', V: 'BC', X: 'NT/NU', Y: 'YT',
};

/** Découpe une ligne CSV en respectant les guillemets. */
function splitCsv(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const CARACT = { 1: 'population', 50: 'menages', 243: 'revenuMedian', 244: 'revenuApresImpot' };

/** Charge le profil du recensement filtré : RTA -> indicateurs. */
function loadIncome(file) {
  const rta = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const f = splitCsv(line);
    const code = f[2];
    const champ = CARACT[Number(f[8])];
    if (!champ || !/^[A-Z]\d[A-Z]$/.test(code)) continue;
    const brut = (f[11] || '').trim();
    const val = brut === '' || brut === '...' || brut === 'F' || brut === 'x' ? null : Number(brut);
    if (!rta.has(code)) rta.set(code, { rta: code, province: FSA_PROVINCE[code[0]] || null });
    rta.get(code)[champ] = Number.isFinite(val) ? val : null;
  }
  return rta;
}

/** Corrélation de Pearson. */
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return dx && dy ? +(num / Math.sqrt(dx * dy)).toFixed(3) : null;
}

/** Corrélation de rang de Spearman (robuste aux valeurs extrêmes). */
function spearman(xs, ys) {
  const rank = (v) => {
    const idx = v.map((val, i) => [val, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const moy = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = moy;
      i = j + 1;
    }
    return r;
  };
  return pearson(rank(xs), rank(ys));
}

/** Découpe en quintiles pondérés par le nombre de ménages. */
function quintiles(rows) {
  const tries = [...rows].sort((a, b) => a.revenuMedian - b.revenuMedian);
  const totalMenages = tries.reduce((s, r) => s + r.menages, 0);
  const seuil = totalMenages / 5;
  const groupes = [[], [], [], [], []];
  let cumul = 0;
  for (const r of tries) {
    const q = Math.min(4, Math.floor(cumul / seuil));
    groupes[q].push(r);
    cumul += r.menages;
  }
  return groupes.map((g, i) => {
    const menages = g.reduce((s, r) => s + r.menages, 0);
    const clients = g.reduce((s, r) => s + r.clients, 0);
    const commandes = g.reduce((s, r) => s + r.commandes, 0);
    const ventes = g.reduce((s, r) => s + r.ventes, 0);
    const revenus = g.map((r) => r.revenuMedian).sort((a, b) => a - b);
    return {
      quintile: `Q${i + 1}`,
      revenuMin: revenus[0],
      revenuMax: revenus[revenus.length - 1],
      revenuMedianRTA: revenus[Math.floor(revenus.length / 2)],
      rta: g.length,
      menages,
      clients,
      commandes,
      ventes: Math.round(ventes),
      clientsPar1000Menages: +(clients / menages * 1000).toFixed(2),
      commandesPar1000Menages: +(commandes / menages * 1000).toFixed(2),
      valeurMoyenneClient: clients ? Math.round(ventes / clients) : 0,
      commandesParClient: clients ? +(commandes / clients).toFixed(2) : 0,
    };
  });
}

function main() {
  const analyse = JSON.parse(fs.readFileSync(analysePath, 'utf8'));
  const income = loadIncome(incomePath);

  const achats = new Map(analyse.rta.map((r) => [r.cle, r]));

  // Toutes les RTA du pays, y compris celles sans aucun client : sans elles la
  // pénétration serait calculée seulement là où Lasclay vend déjà.
  const rows = [];
  for (const [code, inc] of income) {
    if (!inc.menages || !inc.revenuMedian) continue;
    const a = achats.get(code);
    rows.push({
      rta: code,
      province: inc.province,
      menages: inc.menages,
      population: inc.population || null,
      revenuMedian: inc.revenuMedian,
      revenuApresImpot: inc.revenuApresImpot || null,
      clients: a ? a.clients : 0,
      commandes: a ? a.commandes : 0,
      ventes: a ? a.ventes : 0,
      clientsPar1000Menages: +((a ? a.clients : 0) / inc.menages * 1000).toFixed(3),
      commandesPar1000Menages: +((a ? a.commandes : 0) / inc.menages * 1000).toFixed(3),
    });
  }

  const qc = rows.filter((r) => r.province === 'QC');
  const canada = rows;

  const correlations = (set, label) => {
    const rev = set.map((r) => r.revenuMedian);
    const pen = set.map((r) => r.clientsPar1000Menages);
    const cmd = set.map((r) => r.commandesPar1000Menages);
    return {
      ensemble: label,
      rta: set.length,
      pearson_revenu_penetration: pearson(rev, pen),
      spearman_revenu_penetration: spearman(rev, pen),
      spearman_revenu_commandes: spearman(rev, cmd),
    };
  };

  const resultat = {
    genere: new Date().toISOString(),
    sources: {
      achats: path.basename(analysePath),
      revenus: 'Statistique Canada, Recensement de 2021, profil des RTA (98-401-X2021013), revenu des ménages de 2020',
    },
    couverture: {
      rtaAvecRevenu: rows.length,
      rtaAvecAuMoinsUnClient: rows.filter((r) => r.clients > 0).length,
      clientsAppariesRTA: rows.reduce((s, r) => s + r.clients, 0),
    },
    correlations: [correlations(qc, 'Québec'), correlations(canada, 'Canada')],
    quintilesQC: quintiles(qc),
    quintilesCanada: quintiles(canada),
    top30penetrationQC: [...qc].sort((a, b) => b.clientsPar1000Menages - a.clientsPar1000Menages)
      .filter((r) => r.menages >= 1000).slice(0, 30),
  };

  fs.writeFileSync(path.join(outDir, 'croisement_revenus.json'), JSON.stringify(resultat, null, 2));

  const cols = ['rta', 'province', 'menages', 'revenuMedian', 'revenuApresImpot', 'clients', 'commandes', 'ventes', 'clientsPar1000Menages', 'commandesPar1000Menages'];
  fs.writeFileSync(path.join(outDir, 'rta_revenus.tsv'),
    [cols.join('\t'), ...rows.sort((a, b) => b.commandes - a.commandes).map((r) => cols.map((c) => r[c]).join('\t'))].join('\n') + '\n');

  const $ = (n) => Number(n).toLocaleString('fr-CA');
  console.log(`RTA appariées : ${resultat.couverture.rtaAvecRevenu} (dont ${resultat.couverture.rtaAvecAuMoinsUnClient} avec au moins un client)\n`);
  for (const c of resultat.correlations) {
    console.log(`${c.ensemble} (${c.rta} RTA) — revenu médian vs pénétration : Pearson ${c.pearson_revenu_penetration}, Spearman ${c.spearman_revenu_penetration}`);
  }
  for (const [label, qs] of [['QUÉBEC', resultat.quintilesQC], ['CANADA', resultat.quintilesCanada]]) {
    console.log(`\n=== ${label} — quintiles de revenu médian des ménages (pondérés par les ménages) ===`);
    console.log('quintile  revenu médian RTA   ménages     clients  clients/1000  commandes/1000  valeur moy.');
    for (const q of qs) {
      console.log(
        `${q.quintile.padEnd(9)} ${($(q.revenuMin) + '–' + $(q.revenuMax) + ' $').padEnd(19)} ${$(q.menages).padStart(9)} ${$(q.clients).padStart(11)} ` +
        `${String(q.clientsPar1000Menages).padStart(13)} ${String(q.commandesPar1000Menages).padStart(15)} ${($(q.valeurMoyenneClient) + ' $').padStart(12)}`);
    }
  }
}

main();
