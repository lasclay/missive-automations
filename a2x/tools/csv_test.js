/**
 * csv_test.js — compare la ventilation du moteur à celle d'A2X, COMMANDE PAR
 * COMMANDE, à partir des données brutes exportées d'A2X (« download the raw
 * data »), conservées dans a2x/reference/.
 *
 *   node a2x/tools/csv_test.js
 *
 * C'est la validation la plus serrée dont on dispose : les CSV d'A2X donnent le
 * type, le pays, le canal et le montant de chaque composante qu'il a reconnue.
 * Les commandes Shopify correspondantes sont figées ici en fixtures, relevées
 * le 31 juillet 2026 via l'API. Aucun appel réseau.
 *
 * Les lignes `ShopifyFee` des CSV viennent de la transaction de solde du
 * versement, pas de la commande : elles sont vérifiées à part, dans
 * l'assemblage de l'écriture (voir selftest.js).
 */
const fs = require("fs");
const path = require("path");
const { saleComponents, saleRows, ctx } = require("../lib/breakdown");

const REF = path.join(__dirname, "..", "reference");
const m = (a) => ({ shopMoney: { amount: String(a) } });

/** @param taxes tableau des taxes de la ligne ; allocs = rabais alloués. */
const li = (total, taxes, opts = {}) => ({
  title: opts.title || "Article", quantity: 1,
  originalTotalSet: m(total),
  totalDiscountSet: m(0),
  discountAllocations: (opts.allocs || []).map((a) => ({ allocatedAmountSet: m(a) })),
  taxLines: taxes.map((t) => ({ priceSet: m(t) })),
  product: { id: "p", isGiftCard: false },
  variant: { id: "v" },
});
const sl = (orig, disc, taxes) => ({
  originalPriceSet: m(orig), discountedPriceSet: m(disc), discountAllocations: [],
  taxLines: taxes.map((t) => ({ priceSet: m(t) })),
});
const order = (num, country, province, items, ships) => ({
  name: `L-${num}`, sourceName: "web",
  shippingAddress: { countryCodeV2: country, provinceCode: province },
  totalTipReceivedSet: m(0),
  lineItems: { edges: items.map((node) => ({ node })) },
  shippingLines: { edges: (ships || []).map((node) => ({ node })) },
  refunds: [], transactions: [],
});

/** Commandes Shopify réelles, relevées via l'API le 31 juillet 2026. */
const ORDERS = {
  50734: order(50734, "CA", "QC", [li(9.99, [0.5, 1.0])], [sl(2.99, 2.99, [0.3, 0.15])]),
  50735: order(50735, "CA", "QC", [li(79.98, [4.0, 7.98])], [sl(9.99, 0, [0, 0])]),
  50736: order(50736, "US", "CO", [li(155.75, [])], [sl(0, 0, [])]),
  50739: order(50739, "CA", "QC", [li(59.99, [2.55, 5.09], { allocs: [8.99] })], [sl(0, 0, [])]),
  50740: order(50740, "CA", "QC", [li(59.99, [2.55, 5.09], { allocs: [8.99] })], [sl(9.99, 9.99, [1.0, 0.5])]),
  50741: order(50741, "CA", "QC", [li(129.99, [6.5, 12.97])], [sl(0, 0, [{ v: 0 }].map(() => 0))]),
  50749: order(50749, "CA", "QC", [
    li(59.99, [2.55, 5.09], { allocs: [8.99] }),
    li(59.99, [2.55, 5.09], { allocs: [8.99] }),
  ], [sl(0, 0, [0, 0])]),
  50751: order(50751, "CA", "QC", [
    li(21.99, [1.1, 2.19]),
    li(79.98, [4.0, 7.98]),
  ], [sl(0, 0, [0, 0])]),
};

/** Types que le CSV porte mais qui ne viennent pas de la commande. */
const NOT_FROM_ORDER = new Set(["ShopifyFee", "ForeignCurrencyGainLoss"]);

function readCsv(file) {
  const rows = fs.readFileSync(path.join(REF, file), "utf8").trim().split("\n").slice(1);
  const out = [];
  for (const line of rows) {
    if (!line.trim()) continue;
    const c = line.match(/("([^"]*)"|)(,|$)/g).map((x) => x.replace(/^"|",?$|,$/g, ""));
    const [, order_number, , , type, desc, amount] = c;
    out.push({ order: order_number, type, desc: (desc || "").trim(), amount: Math.round(parseFloat(amount) * 100) });
  }
  return out;
}

let failures = 0;
const files = fs.readdirSync(REF).filter((f) => f.endsWith(".csv")).sort();

for (const file of files) {
  console.log(`\n  ${file}`);
  const rows = readCsv(file);
  const byOrder = new Map();
  for (const r of rows) {
    if (!byOrder.has(r.order)) byOrder.set(r.order, []);
    byOrder.get(r.order).push(r);
  }

  for (const [num, lines] of byOrder) {
    const o = ORDERS[num];
    if (!o) { console.log(`     L-${num} : pas de fixture, ignorée`); continue; }

    // Ce qu'A2X a reconnu à partir de la commande.
    const expected = {};
    for (const r of lines) {
      if (NOT_FROM_ORDER.has(r.type)) continue;
      expected[r.type] = (expected[r.type] || 0) + r.amount;
    }

    const got = {};
    for (const c of saleComponents(o)) got[c.details] = (got[c.details] || 0) + c.amount;

    const types = [...new Set([...Object.keys(expected), ...Object.keys(got)])].sort();
    const diffs = types.filter((t) => (expected[t] || 0) !== (got[t] || 0));
    const { country, marketplace } = ctx(o);

    if (!diffs.length) {
      const total = Object.values(got).reduce((a, b) => a + b, 0);
      console.log(`     ✓ L-${num} (${country}/${marketplace}) — ${types.length} composante(s), ${(total / 100).toFixed(2)} $`);
    } else {
      failures += diffs.length;
      console.log(`     ✗ L-${num} (${country}/${marketplace})`);
      for (const t of diffs) {
        console.log(`         ${t.padEnd(28)} A2X ${((expected[t] || 0) / 100).toFixed(2).padStart(9)}   moi ${((got[t] || 0) / 100).toFixed(2).padStart(9)}`);
      }
    }

    // La version détaillée (celle du CSV) doit totaliser comme l'agrégée.
    const rowTotals = {};
    for (const r of saleRows(o)) rowTotals[r.type] = (rowTotals[r.type] || 0) + r.amount;
    for (const t of new Set([...Object.keys(rowTotals), ...Object.keys(got)])) {
      if ((rowTotals[t] || 0) !== (got[t] || 0)) {
        failures++;
        console.log(`         détail CSV ≠ agrégé pour ${t} : ${((rowTotals[t] || 0) / 100).toFixed(2)} vs ${((got[t] || 0) / 100).toFixed(2)}`);
      }
    }

    // Nombre de lignes par type, comme A2X (une par article).
    const a2xCount = {};
    for (const r of lines) if (!NOT_FROM_ORDER.has(r.type)) a2xCount[r.type] = (a2xCount[r.type] || 0) + 1;
    const myCount = {};
    for (const r of saleRows(o)) myCount[r.type] = (myCount[r.type] || 0) + 1;
    for (const t of Object.keys(a2xCount)) {
      if (a2xCount[t] !== (myCount[t] || 0)) {
        failures++;
        console.log(`         granularité ${t} : A2X ${a2xCount[t]} ligne(s), moi ${myCount[t] || 0}`);
      }
    }

    // A2X écrit le pays sans la province : « - CA - Online store ».
    const descs = [...new Set(lines.filter((r) => !NOT_FROM_ORDER.has(r.type)).map((r) => r.desc))];
    for (const d of descs) {
      const expectedDesc = `- ${country.split("-")[0]} - Online store`;
      if (d !== expectedDesc) {
        failures++;
        console.log(`         libellé A2X « ${d} » ≠ attendu « ${expectedDesc} »`);
      }
    }
  }
}

console.log(failures
  ? `\n  ${failures} écart(s) avec la ventilation d'A2X.\n`
  : `\n  Ventilation identique à celle d'A2X sur toutes les commandes de référence. ✅\n`);
process.exit(failures ? 1 : 0);
