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
      // « detaxe » est l'écriture historique ; le format courant est
      // « <idDuCode>:Sales » ou « <idDuCode>:Purchases », comme le menu d'A2X.
      tax: (tax || "").trim() || null,
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

/** « detaxe » (historique) ou « <idDuCode>:Sales » → l'option complète. */
function resolveTax(raw, options, detaxeId) {
  if (!raw) return null;
  const v = String(raw).trim();
  const wanted = /^detaxe$/i.test(v) ? `${detaxeId}:Sales` : v;
  return options.find((o) => o.value === wanted) || null;
}

async function loadQboTaxRates() {
  const res = await qbo("query", { query: "select Id, Name, RateValue, Active from TaxRate maxresults 200" });
  return (res.data && res.data.QueryResponse && res.data.QueryResponse.TaxRate) || [];
}

async function loadQboTaxCodes() {
  const res = await qbo("query", { query: "select * from TaxCode maxresults 100" });
  return (res.data && res.data.QueryResponse && res.data.QueryResponse.TaxCode) || [];
}

/**
 * Les options de taxe, telles qu'A2X les propose : un code × une direction,
 * « Détaxé on Sales », « TPS on Purchases »…
 *
 * Le CODE va sur chaque ligne (TaxCodeRef), les TAUX qu'il regroupe vont dans
 * le TxnTaxDetail de l'écriture — deux entités distinctes de QuickBooks. On
 * garde donc les taux et leur pourcentage avec chaque option, sans quoi il
 * faudrait redemander à QBO au moment de publier.
 */
function buildTaxOptions(codes, rates) {
  const byId = new Map(rates.map((r) => [String(r.Id), r]));
  const out = [];
  for (const c of codes) {
    if (c.Active === false) continue;
    for (const [dir, list] of [["Sales", c.SalesTaxRateList], ["Purchases", c.PurchaseTaxRateList]]) {
      const details = (list && list.TaxRateDetail) || [];
      if (!details.length) continue;
      const taux = details.map((d) => {
        const r = byId.get(String(d.TaxRateRef.value));
        return { id: String(d.TaxRateRef.value), nom: d.TaxRateRef.name || (r && r.Name) || "", pct: r ? Number(r.RateValue) || 0 : 0 };
      });
      out.push({
        value: `${c.Id}:${dir}`,
        label: `${c.Name} on ${dir}`,
        codeId: String(c.Id),
        applicableOn: dir,
        taux,
        pctTotal: taux.reduce((t, x) => t + x.pct, 0),
      });
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

(async () => {
  const offline = process.argv.includes("--offline");
  const rows = parseTsv(fs.readFileSync(TSV, "utf8"));

  let accountsByNum = new Map();
  let taxCodeId = null;
  let taxOptions = [];
  const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : null;

  if (offline) {
    for (const [num, a] of Object.entries((previous && previous.accounts) || {})) accountsByNum.set(num, a);
    taxCodeId = previous && previous.taxCodes && previous.taxCodes.detaxe;
    taxOptions = (previous && previous.taxOptions) || [];
  } else {
    accountsByNum = await loadQboAccounts();
    const codes = await loadQboTaxCodes();
    const rates = await loadQboTaxRates();
    taxOptions = buildTaxOptions(codes, rates);
    const detaxe = codes.find((c) => /^d[ée]tax/i.test(c.Name || "")) || null;
    if (!detaxe) console.warn("⚠️  Aucun code de taxe « Détaxé » trouvé dans QBO.");
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

    const tax = resolveTax(r.tax, taxOptions, taxCodeId);
    if (r.tax && !tax) problems.push(`ligne ${r.line} : option de taxe « ${r.tax} » inconnue`);

    const entry = {
      category: r.category,
      details: r.details,
      country: r.country,
      marketplace: r.marketplace,
      acctNum: r.acctNum,
      accountId: acct ? acct.id : null,
      accountName: acct ? acct.name : null,
      tax,
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
    taxOptions,
    accounts,
    defaults,
    index,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

  console.log(`mappings.json écrit — ${rows.length} lignes (${rules.length} règles + ${Object.keys(defaults).length} automapping).`);
  console.log(`Comptes QBO résolus : ${Object.keys(accounts).length}. ${taxOptions.length} option(s) de taxe, code « Détaxé » : ${taxCodeId || "aucun"}.`);
  if (problems.length) {
    console.log(`\n⚠️  ${problems.length} problème(s) :`);
    for (const p of problems) console.log("   - " + p);
    process.exitCode = 1;
  }
})().catch((e) => {
  console.error("Erreur:", e.message);
  process.exit(1);
});
