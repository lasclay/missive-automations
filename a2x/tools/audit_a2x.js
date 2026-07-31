/**
 * audit_a2x.js — compare mon mappage à celui d'A2X, ligne par ligne, sur les
 * écritures qu'A2X a réellement publiées dans QuickBooks.
 *
 *   node a2x/tools/audit_a2x.js [--limit 400] [--verbose]
 *
 * Chaque ligne d'écriture A2X porte son libellé d'origine
 * (« ProductSales  - CA - Online store ») et le compte qu'A2X a choisi. On
 * réinjecte ce libellé dans le moteur de mappage et on compare le compte obtenu
 * et le code de taxe. C'est la seule façon de valider le mappage contre des
 * milliers de cas réels sans avoir accès aux versements Shopify.
 *
 * Ce que ça valide : le choix du compte et du code de taxe pour chaque
 * combinaison (type, pays, canal) réellement rencontrée.
 * Ce que ça ne valide pas : les montants, qui viennent des versements Shopify.
 */
const { qbo } = require("../lib/qbo");
const mapper = require("../lib/mapper");

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? def : process.argv[i + 1];
};
const verbose = process.argv.includes("--verbose");

/** « CA (QC) » → « CA-QC », « N/A » → « * ». */
function parseCountry(label) {
  const s = (label || "").trim();
  if (!s || s === "N/A" || s === "-") return "*";
  if (/EU Country$/.test(s)) return "EU";
  const m = s.match(/^([A-Z]{2})\s*\(([A-Z]{2})\)$/);
  return m ? `${m[1]}-${m[2]}` : s;
}

/** « Online store » → « online », « Point of sale (location: … - 123) » → « pos:123 ». */
function parseMarketplace(label) {
  const s = (label || "").trim();
  if (!s || s === "N/A" || s === "-") return "*";
  if (/^online store$/i.test(s)) return "online";
  if (/^manual order$/i.test(s)) return "manual";
  if (/^edit order$/i.test(s)) return "edit";
  if (/^exchange$/i.test(s)) return "exchange";
  if (/^point of sale/i.test(s)) {
    const m = s.match(/(\d{6,})/);
    return m ? `pos:${m[1]}` : "pos";
  }
  return s;
}

/**
 * « RefundAdjustmentNotTaxed  - CA - Online store - refund_discrepancy »
 *   → { details: "RefundAdjustmentNotTaxed - refund_discrepancy", country: "CA", marketplace: "online" }
 */
const SEP = "";
const isCountryLabel = (s) => /^(N\/A|EU Country|Non-Registered EU Country|[A-Z]{2}(\s\([A-Z]{2}\))?)$/.test(s);

function parseDescription(desc) {
  let d = String(desc || "").trim();
  // Lignes de contrepartie d'A2X, hors périmètre du mappage.
  if (!d || /^Balance of (settlement|carried forward)|^Balance carried forward/i.test(d)) return null;

  // L'étiquette du point de vente contient « - » (« Point of sale (location:
  // Entrepôt Lasclay - 58394280098) ») : on la protège avant de découper.
  d = d.replace(/Point of sale \(location: ([^)]*)\)/g,
    (_, inner) => `Point of sale (location: ${inner.replace(/ - /g, SEP)})`);
  const restore = (s) => (s || "").split(SEP).join(" - ");

  let details, rest;
  const double = d.match(/^(.*?)\s{2}-\s(.+)$/);
  if (double) {
    details = double[1].trim();
    rest = double[2].split(" - ").map((x) => x.trim());
  } else {
    const single = d.match(/^(.*?)\s-\s(.+)$/);
    if (!single) return { details: restore(d), country: "*", marketplace: "*", shape: "simple" };
    details = single[1].trim();
    rest = single[2].split(" - ").map((x) => x.trim());
  }

  // Le pays n'est pas toujours présent (lignes de passerelle : « Sale Gateway
  // paypal - Online store »).
  let country = "*", marketplace = "*", extras;
  if (isCountryLabel(rest[0])) {
    country = parseCountry(rest[0]);
    marketplace = parseMarketplace(restore(rest[1]));
    extras = rest.slice(2);
  } else {
    marketplace = parseMarketplace(restore(rest[0]));
    extras = rest.slice(1);
  }

  // A2X rejette en fin de libellé les qualificatifs qui, dans la table de
  // mappings, font partie du type : « … - refund_discrepancy ».
  if (extras.length) details = `${details} - ${extras.map(restore).join(" - ")}`;
  // Dans ses écritures A2X écrit « NonShopifyPayment Gateway gift_card - » là où
  // sa table de mappings dit « NonShopifyPayment gift_card - ». Même règle.
  details = details.replace(/^(NonShopifyPayment|NonShopifyRefund) Gateway /, "$1 ");
  return { details: restore(details), country, marketplace, shape: double ? "complet" : "passerelle" };
}

/** Retrouve la catégorie d'un type, pour pouvoir tester le repli d'automapping. */
function categoryOf(details) {
  const all = mapper.all();
  for (const e of Object.values(all.index)) if (e.details === details) return e.category;
  const base = details.split(" - ")[0];
  for (const e of Object.values(all.index)) if (e.details.split(" - ")[0] === base) return e.category;
  return null;
}

(async () => {
  const limit = parseInt(arg("limit", "400"), 10);
  const res = await qbo("query", {
    query: `select * from JournalEntry where DocNumber like 'A2XSH-%' orderby TxnDate desc maxresults ${limit}`,
  });
  const journals = (res.data && res.data.QueryResponse && res.data.QueryResponse.JournalEntry) || [];
  const taxId = String(mapper.taxCodeId() || "");

  const stats = { journaux: journals.length, lignes: 0, reglement: 0, testees: 0, accord: 0, desaccord: 0, sansRegle: 0, taxeDesaccord: 0 };
  const disagreements = new Map();
  const missing = new Map();
  const taxIssues = new Map();
  const seen = new Map();

  for (const je of journals) {
    for (const line of je.Line || []) {
      stats.lignes++;
      const parsed = parseDescription(line.Description);
      if (!parsed) { stats.reglement++; continue; }

      const detail = line.JournalEntryLineDetail || {};
      const actualAccount = String((detail.AccountRef || {}).value || "");
      const actualTax = detail.TaxCodeRef ? String(detail.TaxCodeRef.value) : null;

      const category = categoryOf(parsed.details);
      const hit = mapper.resolve(category, parsed.details, parsed.country, parsed.marketplace);
      const key = `${parsed.details} | ${parsed.country} | ${parsed.marketplace}`;
      seen.set(key, (seen.get(key) || 0) + 1);

      if (!hit.accountId) {
        stats.sansRegle++;
        const e = missing.get(key) || { count: 0, a2xAccount: actualAccount, example: je.DocNumber, desc: line.Description };
        e.count++;
        missing.set(key, e);
        continue;
      }

      stats.testees++;
      if (String(hit.accountId) === actualAccount) {
        stats.accord++;
      } else {
        stats.desaccord++;
        const e = disagreements.get(key) || { count: 0, mine: hit.accountId, mineNum: hit.acctNum, theirs: actualAccount, via: hit.fallback, example: je.DocNumber };
        e.count++;
        disagreements.set(key, e);
      }

      const expectTax = hit.tax === "detaxe" ? taxId : null;
      if ((expectTax || "") !== (actualTax || "")) {
        stats.taxeDesaccord++;
        const e = taxIssues.get(key) || { count: 0, mine: expectTax || "aucun", theirs: actualTax || "aucun" };
        e.count++;
        taxIssues.set(key, e);
      }
    }
  }

  const pct = (n) => (stats.testees ? ((n / stats.testees) * 100).toFixed(2) : "0") + " %";
  console.log(`
  AUDIT — mon mappage contre celui d'A2X, sur ses propres écritures

  ${stats.journaux} écritures A2X · ${stats.lignes} lignes
    ${stats.reglement} ligne(s) de règlement (« Balance of settlement »), hors périmètre
    ${stats.sansRegle} ligne(s) sans règle dans mes mappings
    ${stats.testees} ligne(s) comparables

  Comptes   : ${stats.accord} identiques (${pct(stats.accord)}) · ${stats.desaccord} différents
  Codes taxe: ${stats.testees - stats.taxeDesaccord} identiques · ${stats.taxeDesaccord} différents
  ${seen.size} combinaison(s) distincte(s) rencontrée(s)`);

  if (disagreements.size) {
    console.log(`\n  ⚠️  COMPTES DIFFÉRENTS — ${disagreements.size} combinaison(s) :\n`);
    for (const [key, e] of [...disagreements].sort((a, b) => b[1].count - a[1].count)) {
      console.log(`     ${String(e.count).padStart(5)} ligne(s)  ${key}`);
      console.log(`            moi : ${e.mineNum} (Id ${e.mine}, par ${e.via})   A2X : Id ${e.theirs}   ex. ${e.example}`);
    }
  }

  if (taxIssues.size) {
    console.log(`\n  ⚠️  CODES DE TAXE DIFFÉRENTS — ${taxIssues.size} combinaison(s) :\n`);
    for (const [key, e] of [...taxIssues].sort((a, b) => b[1].count - a[1].count)) {
      console.log(`     ${String(e.count).padStart(5)} ligne(s)  ${key}  →  moi : ${e.mine}, A2X : ${e.theirs}`);
    }
  }

  if (missing.size) {
    console.log(`\n  Lignes sans règle chez moi — ${missing.size} combinaison(s) :\n`);
    for (const [key, e] of [...missing].sort((a, b) => b[1].count - a[1].count)) {
      console.log(`     ${String(e.count).padStart(5)} ligne(s)  ${key}`);
      if (verbose) console.log(`            A2X : Id ${e.a2xAccount}  ·  libellé « ${e.desc} »  ·  ex. ${e.example}`);
    }
  }

  const clean = !disagreements.size && !taxIssues.size;
  console.log(clean
    ? `\n  Aucun écart de compte ni de taxe sur ${stats.testees} lignes réelles. ✅\n`
    : `\n  ${stats.desaccord + stats.taxeDesaccord} ligne(s) en écart — à examiner ci-dessus.\n`);
  process.exit(clean ? 0 : 1);
})().catch((e) => { console.error("Erreur:", e.message); process.exit(1); });
