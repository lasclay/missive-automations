#!/usr/bin/env node
/**
 * Analyse géodémographique de la clientèle Shopify de Lasclay.
 *
 * Entrée  : export JSONL d'une opération en lot Shopify (clients ayant au moins
 *           une commande) — champs firstName, numberOfOrders, amountSpent,
 *           defaultAddress { city, province, provinceCode, zip, countryCodeV2 }.
 * Sortie  : prénoms les plus fréquents, intensité d'achat par province, par
 *           municipalité et par RTA (les trois premiers caractères du code
 *           postal), le tout en JSON + TSV pour croisement avec les revenus
 *           des ménages de Statistique Canada.
 *
 *   node geodemo/prenoms_regions.js <customers.jsonl> <dossier-de-sortie>
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const [, , inputPath, outDirArg] = process.argv;
if (!inputPath) {
  console.error('usage: node geodemo/prenoms_regions.js <customers.jsonl> [dossier-de-sortie]');
  process.exit(1);
}
const outDir = outDirArg || path.join(__dirname, 'sortie');
fs.mkdirSync(outDir, { recursive: true });

/** Retire les diacritiques pour obtenir une clé de regroupement stable. */
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Met un prénom en casse d'affichage : « jean-luc » -> « Jean-Luc ». */
function titleCase(s) {
  return s.replace(/[^\s'’-]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Nettoie un prénom saisi au checkout. Renvoie null quand la valeur n'est
 * manifestement pas un prénom (courriel, chiffres, initiale seule, nom
 * d'entreprise évident).
 */
function normalizeFirstName(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/\s+/g, ' ');
  s = s.replace(/^["'`.\-]+|["'`.,\-]+$/g, '').trim();
  if (!s) return null;
  if (s.includes('@') || /\d/.test(s)) return null;
  if (/^(n\/a|na|test|aucun|none|null|undefined|x+)$/i.test(s)) return null;
  if (s.length < 2) return null;                 // initiale seule
  if (s.split(' ').length > 3) return null;      // phrase, pas un prénom
  if (!/[a-zà-öø-ÿ]/i.test(s)) return null;      // aucune lettre
  return titleCase(s);
}

/** Uniformise les abréviations de toponymes québécois. */
function normalizeCity(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/\s+/g, ' ');
  if (!s) return null;
  s = titleCase(s);
  s = s.replace(/^St[- ]/i, 'Saint-').replace(/^Ste[- ]/i, 'Sainte-');
  s = s.replace(/\bSt[- ]/gi, 'Saint-').replace(/\bSte[- ]/gi, 'Sainte-');
  return s;
}

const PROVINCE_NAMES = {
  QC: 'Québec', ON: 'Ontario', BC: 'Colombie-Britannique', AB: 'Alberta',
  MB: 'Manitoba', SK: 'Saskatchewan', NS: 'Nouvelle-Écosse',
  NB: 'Nouveau-Brunswick', PE: 'Île-du-Prince-Édouard',
  NL: 'Terre-Neuve-et-Labrador', YT: 'Yukon', NT: 'Territoires du Nord-Ouest',
  NU: 'Nunavut',
};

/** Agrégateur : compte clients, commandes et ventes par clé. */
function bucket(map, key, label, cust) {
  if (!key) return;
  let b = map.get(key);
  if (!b) {
    b = { key, label, clients: 0, commandes: 0, ventes: 0, recurrents: 0, villes: new Map() };
    map.set(key, b);
  }
  if (cust.city) b.villes.set(cust.city, (b.villes.get(cust.city) || 0) + 1);
  b.clients += 1;
  b.commandes += cust.orders;
  b.ventes += cust.spent;
  if (cust.orders > 1) b.recurrents += 1;
  if (label && label.length < b.label.length) b.label = label;
}

/** Choisit la graphie la plus fréquente d'une clé (« Genevieve » vs « Geneviève »). */
function bestSurface(surfaces) {
  return [...surfaces.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

async function main() {
  const names = new Map();        // clé pliée -> { clients, commandes, ventes, surfaces }
  const namesQC = new Map();
  const provinces = new Map();
  const cities = new Map();
  const fsas = new Map();

  const stats = {
    lignes: 0, sansCommande: 0, sansPrenom: 0, sansAdresse: 0,
    clientsCA: 0, clientsUS: 0, clientsAutres: 0,
    commandesTotal: 0, ventesTotal: 0,
  };

  const rl = readline.createInterface({
    input: fs.createReadStream(inputPath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    stats.lignes += 1;
    let c;
    try { c = JSON.parse(line); } catch { continue; }

    const orders = Number(c.numberOfOrders || 0);
    const spent = Number((c.amountSpent && c.amountSpent.amount) || 0);

    // Le filtre `number_of_orders:>0` de l'opération en lot n'est pas appliqué
    // par l'API : on écarte ici les fiches sans aucune commande (abonnés à
    // l'infolettre, comptes créés sans achat).
    if (orders < 1) { stats.sansCommande += 1; continue; }

    stats.commandesTotal += orders;
    stats.ventesTotal += spent;

    const addr = c.defaultAddress || {};
    const country = addr.countryCodeV2 || null;
    if (!addr.city && !addr.zip) stats.sansAdresse += 1;
    if (country === 'CA') stats.clientsCA += 1;
    else if (country === 'US') stats.clientsUS += 1;
    else if (country) stats.clientsAutres += 1;

    const cust = { orders, spent, city: normalizeCity(addr.city) };

    // --- Prénoms -------------------------------------------------------
    const prenom = normalizeFirstName(c.firstName);
    if (!prenom) stats.sansPrenom += 1;
    else {
      const key = fold(prenom);
      for (const map of [names, ...(addr.provinceCode === 'QC' ? [namesQC] : [])]) {
        let n = map.get(key);
        if (!n) {
          n = { key, clients: 0, commandes: 0, ventes: 0, surfaces: new Map() };
          map.set(key, n);
        }
        n.clients += 1;
        n.commandes += orders;
        n.ventes += spent;
        n.surfaces.set(prenom, (n.surfaces.get(prenom) || 0) + 1);
      }
    }

    // --- Géographie ----------------------------------------------------
    if (country === 'CA' && addr.provinceCode) {
      const pc = addr.provinceCode;
      bucket(provinces, pc, PROVINCE_NAMES[pc] || addr.province || pc, cust);

      const city = cust.city;
      if (city) bucket(cities, `${pc}|${fold(city)}`, `${city} (${pc})`, cust);

      const zip = String(addr.zip || '').toUpperCase().replace(/\s+/g, '');
      const fsa = zip.slice(0, 3);
      if (/^[A-Z]\d[A-Z]$/.test(fsa)) bucket(fsas, fsa, fsa, cust);
    }
  }

  // --- Mise en forme ---------------------------------------------------
  const topNames = (map, n) => [...map.values()]
    .map((v) => ({
      prenom: bestSurface(v.surfaces),
      clients: v.clients,
      commandes: v.commandes,
      ventes: Math.round(v.ventes),
      commandesParClient: +(v.commandes / v.clients).toFixed(2),
      valeurMoyenne: Math.round(v.ventes / v.clients),
    }))
    .sort((a, b) => b.clients - a.clients || a.prenom.localeCompare(b.prenom))
    .slice(0, n);

  const geoRows = (map, min) => [...map.values()]
    .filter((b) => b.clients >= min)
    .map((b) => ({
      cle: b.key,
      lieu: b.label,
      villePrincipale: b.villes.size
        ? [...b.villes.entries()].sort((x, y) => y[1] - x[1])[0][0]
        : null,
      clients: b.clients,
      commandes: b.commandes,
      ventes: Math.round(b.ventes),
      commandesParClient: +(b.commandes / b.clients).toFixed(2),
      tauxRecurrence: +(b.recurrents / b.clients).toFixed(4),
      valeurMoyenne: Math.round(b.ventes / b.clients),
    }))
    .sort((a, b) => b.commandes - a.commandes);

  const result = {
    genere: new Date().toISOString(),
    source: path.basename(inputPath),
    stats: { ...stats, ventesTotal: Math.round(stats.ventesTotal) },
    prenomsTop25: topNames(names, 25),
    prenomsTop25QC: topNames(namesQC, 25),
    provinces: geoRows(provinces, 1),
    municipalites: geoRows(cities, 10),
    rta: geoRows(fsas, 5),
  };

  const jsonPath = path.join(outDir, 'analyse.json');
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

  const tsv = (rows, cols) =>
    [cols.join('\t'), ...rows.map((r) => cols.map((c) => r[c]).join('\t'))].join('\n') + '\n';

  fs.writeFileSync(path.join(outDir, 'prenoms.tsv'),
    tsv(result.prenomsTop25, ['prenom', 'clients', 'commandes', 'ventes', 'commandesParClient', 'valeurMoyenne']));
  fs.writeFileSync(path.join(outDir, 'municipalites.tsv'),
    tsv(result.municipalites, ['lieu', 'clients', 'commandes', 'ventes', 'commandesParClient', 'tauxRecurrence', 'valeurMoyenne']));
  fs.writeFileSync(path.join(outDir, 'rta.tsv'),
    tsv(result.rta, ['cle', 'villePrincipale', 'clients', 'commandes', 'ventes', 'commandesParClient', 'tauxRecurrence', 'valeurMoyenne']));

  console.log(`fiches lues            : ${stats.lignes}`);
  console.log(`dont sans commande     : ${stats.sansCommande} (écartées)`);
  console.log(`acheteurs retenus      : ${stats.lignes - stats.sansCommande}`);
  console.log(`commandes cumulées     : ${stats.commandesTotal}`);
  console.log(`ventes cumulées        : ${Math.round(stats.ventesTotal).toLocaleString('fr-CA')} $`);
  console.log(`prénoms inexploitables : ${stats.sansPrenom}`);
  console.log(`sans adresse           : ${stats.sansAdresse}`);
  console.log(`municipalités retenues : ${result.municipalites.length}  |  RTA retenues : ${result.rta.length}`);
  console.log(`\n→ ${jsonPath}`);
  console.log('\nTop 10 des prénoms (tous marchés) :');
  result.prenomsTop25.slice(0, 10).forEach((n, i) =>
    console.log(`${String(i + 1).padStart(2)}. ${n.prenom.padEnd(14)} ${String(n.clients).padStart(5)} clients   ${String(n.commandes).padStart(6)} commandes`));
  console.log('\nTop 10 des prénoms (clients du Québec) :');
  result.prenomsTop25QC.slice(0, 10).forEach((n, i) =>
    console.log(`${String(i + 1).padStart(2)}. ${n.prenom.padEnd(14)} ${String(n.clients).padStart(5)} clients   ${String(n.commandes).padStart(6)} commandes`));
}

main().catch((e) => { console.error(e); process.exit(1); });
