/**
 * import_mappings.js — transforme a2x/mappings.tsv en a2x/mappings.json (index prêt à l'exécution)
 * et, si le finance-proxy est joignable, résout chaque numéro de compte vers son Id QBO.
 *
 *   node a2x/tools/import_mappings.js            # avec résolution QBO (recommandé)
 *   node a2x/tools/import_mappings.js --offline  # sans appel QBO (Ids conservés du fichier existant)
 *
 * Le TSV reste la source de vérité éditable à la main ; mappings.json est un artefact généré.
 */
const fs = require("fs");
const path = require("path");
const { qbo } = require("../lib/qbo");

const DIR = path.join(__dirname, "..");
const TSV = path.join(DIR, "mappings.tsv");
const OUT = path.join(DIR, "mappings.json");

function parseTsv(text) {
  const rows = [];
  let lineNo = 0;
  for (const raw of text.split("\n")) {
    lineNo++;
    const line = raw.replace(/\r$/, "");
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const c = line.split("\t");
    if (c.length < 4) throw new Error(`mappings.tsv:${lineNo} — au moins 4 colonnes attendues, ${c.length} trouvée(s)`);
    const [category, details, country, marketplace, account, tax] = c.map((x) => (x || "").trim());
    rows.push({
      line: lineNo,
      category,
      details: details === "*" ? "*" : details,
      country: normCountry(country),
      marketplace: normMarketplace(marketplace),
      acctNum: account || null,
      tax: (tax || "").toLowerCase() === "detaxe" ? "detaxe" : null,
    });
  }
  return rows;
}

function normCountry(v) {
  const s = (v || "").trim();
  if (!s || s === "-" || s.toUpperCase() === "N/A") return "*";
  return s.toUpperCase();
}

function normMarketplace(v) {
  const s = (v || "").trim();
  if (!s || s === "-" || s.toUpperCase() === "N/A") return "*";
  return s.toLowerCase();
}

/** Clé d'index : details | pays | marketplace (tous déjà normalisés). */
function key(details, country, marketplace) {
  return details + "|" + country + "|" + marketplace;
}

async function loadQboAccounts() {
  const res = await qbo("query", { query: "select Id, Name, AcctNum, AccountType, Active from Account maxresults 500" });
  const list = (res.data && res.data.QueryResponse && res.data.QueryResponse.Account) || [];
  const byNum = new Map();
  for (const a of list) if (a.AcctNum) byNum.set(String(a.AcctNum), a);
  return byNum;
}

async function loadQboTaxCodes() {
  const res = await qbo("query", { query: "select Id, Name, Active from TaxCode maxresults 100" });
  const list = (res.data && res.data.QueryResponse && res.data.QueryResponse.TaxCode) || [];
  return list;
}

(async () => {
  const offline = process.argv.includes("--offline");
  const rows = parseTsv(fs.readFileSync(TSV, "utf8"));

  let accountsByNum = new Map();
  let taxCodeId = null;
  const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : null;

  if (offline) {
    for (const [num, a] of Object.entries((previous && previous.accounts) || {})) accountsByNum.set(num, a);
    taxCodeId = previous && previous.taxCodes && previous.taxCodes.detaxe;
  } else {
    accountsByNum = await loadQboAccounts();
    const codes = await loadQboTaxCodes();
    const detaxe = codes.find((c) => /^d[ée]tax/i.test(c.Name || "")) || null;
    if (!detaxe) console.warn("⚠️  Aucun code de taxe « Détaxé » trouvé dans QBO — les lignes détaxées partiront sans TaxCodeRef.");
    taxCodeId = detaxe ? detaxe.Id : null;
  }

  const rules = [];
  const defaults = {};
  const accounts = {};
  const problems = [];
  const seen = new Set();

  for (const r of rows) {
    let acct = null;
    if (r.acctNum) {
      const a = accountsByNum.get(r.acctNum);
      if (!a) {
        problems.push(`ligne ${r.line} : compte ${r.acctNum} introuvable dans QBO`);
      } else {
        if (a.Active === false) problems.push(`ligne ${r.line} : compte ${r.acctNum} (${a.Name}) est INACTIF dans QBO`);
        acct = { num: r.acctNum, id: a.Id || a.id, name: a.Name || a.name, type: a.AccountType || a.type };
        accounts[r.acctNum] = acct;
      }
    }

    const entry = {
      category: r.category,
      details: r.details,
      country: r.country,
      marketplace: r.marketplace,
      acctNum: r.acctNum,
      accountId: acct ? acct.id : null,
      accountName: acct ? acct.name : null,
      tax: r.tax,
      line: r.line,
    };

    if (r.details === "*") {
      if (defaults[r.category]) problems.push(`ligne ${r.line} : deuxième règle d'automapping pour « ${r.category} »`);
      defaults[r.category] = entry;
      continue;
    }

    const k = key(r.details, r.country, r.marketplace);
    if (seen.has(k)) problems.push(`ligne ${r.line} : doublon exact (${r.details} / ${r.country} / ${r.marketplace})`);
    seen.add(k);
    rules.push(entry);
  }

  const index = {};
  for (const e of rules) index[key(e.details, e.country, e.marketplace)] = e;

  const out = {
    generatedAt: new Date().toISOString(),
    source: "a2x/mappings.tsv",
    counts: { rules: rules.length, defaults: Object.keys(defaults).length, total: rows.length },
    taxCodes: { detaxe: taxCodeId },
    accounts,
    defaults,
    index,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

  console.log(`mappings.json écrit — ${rows.length} lignes (${rules.length} règles + ${Object.keys(defaults).length} automapping).`);
  console.log(`Comptes QBO résolus : ${Object.keys(accounts).length}. Code de taxe « Détaxé » : ${taxCodeId || "aucun"}.`);
  if (problems.length) {
    console.log(`\n⚠️  ${problems.length} problème(s) :`);
    for (const p of problems) console.log("   - " + p);
    process.exitCode = 1;
  }
})().catch((e) => {
  console.error("Erreur:", e.message);
  process.exit(1);
});
