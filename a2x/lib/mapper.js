/**
 * Résolution (catégorie, details, pays, marketplace) → compte QBO + code de taxe,
 * avec la même logique de repli qu'A2X : du plus précis au plus général, puis la
 * règle d'automapping de la catégorie.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "mappings.json");

let cache = null;
function load() {
  if (cache) return cache;
  if (!fs.existsSync(FILE)) {
    throw new Error("a2x/mappings.json absent — lance d'abord : node a2x/tools/import_mappings.js");
  }
  cache = JSON.parse(fs.readFileSync(FILE, "utf8"));
  return cache;
}

const baseCountry = (c) => (c && c.includes("-") ? c.split("-")[0] : c);
const baseMarketplace = (m) => (m && m.startsWith("pos:") ? "pos" : m);

/**
 * A2X a deux familles de règles : les génériques, où pays et canal sont des
 * colonnes (« PendingPayment / CA / exchange »), et celles où pays et canal sont
 * écrits DANS le type (« PendingPayment - CA - exchange », colonnes à N/A).
 * Les secondes l'emportent — vérifié sur ses propres écritures : pour
 * « PendingPayment / CA / exchange » A2X impute 4013, la règle composée, et non
 * 1110 que donnerait la règle générique.
 */
const A2X_MARKETPLACE = { online: "Online store", manual: "Manual order", edit: "Edit Order", exchange: "exchange" };

function composedKeys(details, country, marketplace) {
  const cfg = require("../config.json");
  const cFull = country === "*" ? null : country.split("-").join(" - ");
  const cBase = country === "*" ? null : baseCountry(country);
  const mk = marketplace === "*" ? null
    : marketplace.startsWith("pos:")
      ? `Point of sale (location: ${cfg.posLocationLabel || "Entrepôt Lasclay"} - ${marketplace.slice(4)})`
      : A2X_MARKETPLACE[marketplace] || marketplace;

  const out = [];
  if (cFull && mk) out.push(`${details} - ${cFull} - ${mk}`);
  if (cBase && cBase !== cFull && mk) out.push(`${details} - ${cBase} - ${mk}`);
  if (mk) out.push(`${details} - ${mk}`);
  if (cFull) out.push(`${details} - ${cFull}`);
  if (cBase && cBase !== cFull) out.push(`${details} - ${cBase}`);
  return out;
}

/** Clé d'index — doit rester identique à celle de tools/import_mappings.js. */
const key = (details, country, marketplace) => details + "|" + country + "|" + marketplace;

/** Les clés candidates, de la plus précise à la plus générale. */
function candidates(details, country, marketplace) {
  const countries = [...new Set([country, baseCountry(country), "*"].filter(Boolean))];
  const markets = [...new Set([marketplace, baseMarketplace(marketplace), "*"].filter(Boolean))];
  const out = [];
  for (const m of markets) for (const c of countries) out.push(key(details, c, m));
  // On privilégie un pays exact avec marketplace générique plutôt que l'inverse.
  return out.sort((a, b) => score(b) - score(a));
}

function score(k) {
  const [, c, m] = k.split("|");
  return (c === "*" ? 0 : c.includes("-") ? 3 : 2) * 10 + (m === "*" ? 0 : 2);
}

/**
 * @returns {{accountId, accountName, acctNum, tax, matched, fallback}} — `matched`
 * indique la clé retenue ; `fallback` vaut « exact », « repli » ou « automapping ».
 */
function resolve(category, details, country, marketplace) {
  const m = load();
  const exact = key(details, country, marketplace);

  const keys = candidates(details, country, marketplace);
  for (const k of keys) {
    const hit = m.index[k];
    if (hit && hit.accountId) {
      return { ...hit, matched: k, fallback: k === exact ? "exact" : "repli" };
    }
  }

  // Puis les règles composées, qui couvrent ce que les génériques n'ont pas
  // (le point de vente, notamment).
  for (const composed of composedKeys(details, country, marketplace)) {
    const hit = m.index[key(composed, "*", "*")];
    if (hit && hit.accountId) return { ...hit, matched: composed, fallback: "règle composée" };
  }
  const def = m.defaults[category];
  if (def && def.accountId) return { ...def, matched: `${category} (automapping)`, fallback: "automapping" };
  return { accountId: null, accountName: null, acctNum: null, tax: def ? def.tax : null, matched: null, fallback: "non mappé" };
}

const taxCodeId = () => load().taxCodes && load().taxCodes.detaxe;
const taxRateId = () => load().taxRates && load().taxRates.detaxe;
const meta = () => { const m = load(); return { generatedAt: m.generatedAt, counts: m.counts }; };
const all = () => load();

module.exports = { resolve, taxCodeId, taxRateId, meta, all, candidates, baseCountry, baseMarketplace };
