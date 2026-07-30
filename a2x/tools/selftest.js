/**
 * selftest.js — rejoue le payout du 21 au 27 juillet 2026 (celui de la capture A2X)
 * à partir d'une commande synthétique, et compare l'écriture produite à celle
 * qu'A2X a réellement envoyée dans QBO (pièce 11170).
 *
 *   node a2x/tools/selftest.js
 *
 * Aucun appel réseau : c'est un test hors-ligne du moteur de ventilation et de mappage.
 */
const assert = require("assert");
const { buildJournalEntry } = require("../lib/journal");

const m = (a) => ({ shopMoney: { amount: String(a), currencyCode: "CAD" } });

const order = {
  id: "gid://shopify/Order/1",
  name: "L-50700",
  processedAt: "2026-07-21T14:00:00Z",
  sourceName: "web",
  shippingAddress: { countryCodeV2: "CA", provinceCode: null },
  billingAddress: { countryCodeV2: "CA", provinceCode: null },
  totalTipReceivedSet: m(0),
  taxLines: [{ title: "GST", rate: 0.05, priceSet: m(18.28) }],
  lineItems: { edges: [{ node: {
    id: "li1", title: "Article", quantity: 2,
    originalTotalSet: m(119.98), totalDiscountSet: m(17.98),
    taxLines: [{ title: "TAX", priceSet: m(15.28) }],
    product: { id: "p1", isGiftCard: false },
  } }] },
  shippingLines: { edges: [{ node: {
    id: "sl1", title: "Express",
    originalPriceSet: m(19.98), discountedPriceSet: m(19.98),
    taxLines: [{ title: "TAX", priceSet: m(3.0) }],
  } }] },
  refunds: [],
  transactions: [],
};

const payout = { id: "gid://shopify/ShopifyPaymentsPayout/592", legacyResourceId: "592", issuedAt: "2026-07-27T00:00:00Z", net: { amount: "136.02", currencyCode: "CAD" } };

const btx = [{
  id: "gid://shopify/ShopifyPaymentsBalanceTransaction/1",
  type: "CHARGE",
  transactionDate: "2026-07-21T14:00:00Z",
  amount: m(140.26), fee: m(4.24), net: m(136.02),
  associatedOrder: { id: order.id, name: order.name },
  associatedPayout: { id: payout.id, status: "PAID" },
}];

// A2X, pièce QBO 11170 : description → [PostingType, montant, compte]
const EXPECTED = {
  "Discount  - CA - Online store":     ["Debit", 17.98, "127"],
  "ProductSales  - CA - Online store": ["Credit", 119.98, "125"],
  "Shipping  - CA - Online store":     ["Credit", 19.98, "128"],
  "ShippingTax  - CA - Online store":  ["Credit", 3, "132"],
  "ShopifyFee  - CA - Online store":   ["Debit", 4.24, "23"],
  "Tax  - CA - Online store":          ["Credit", 15.28, "132"],
  "Balance of settlement for: 2026-07-21": ["Debit", 136.02, "13"],
};

const j = buildJournalEntry(payout, btx, new Map([["1", order]]));

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { failures++; console.log(`  ✗ ${label}\n      attendu ${JSON.stringify(expected)}\n      obtenu  ${JSON.stringify(actual)}`); }
  else console.log(`  ✓ ${label}`);
};

check("DocNumber", j.docNumber, "A2XSH-21Jul-27Jul-592");
check("TxnDate", j.body.TxnDate, "2026-07-21");
check("équilibrée", j.balanced, true);
check("aucune composante non mappée", j.unmapped.length, 0);
check("nombre de lignes", j.body.Line.length, Object.keys(EXPECTED).length);

for (const l of j.body.Line) {
  const d = l.JournalEntryLineDetail;
  const exp = EXPECTED[l.Description];
  if (!exp) { failures++; console.log(`  ✗ ligne inattendue : « ${l.Description} »`); continue; }
  check(`ligne « ${l.Description} »`, [d.PostingType, l.Amount, d.AccountRef.value], exp);
}

// Les lignes de taxe d'A2X n'ont pas de code de taxe ; les lignes de revenu, oui.
const byDesc = Object.fromEntries(j.body.Line.map((l) => [l.Description, l.JournalEntryLineDetail]));
check("code détaxé sur ProductSales", !!byDesc["ProductSales  - CA - Online store"].TaxCodeRef, true);
check("pas de code de taxe sur Tax", !!byDesc["Tax  - CA - Online store"].TaxCodeRef, false);
check("pas de code de taxe sur ShopifyFee", !!byDesc["ShopifyFee  - CA - Online store"].TaxCodeRef, false);

console.log(failures ? `\n  ${failures} écart(s) avec l'écriture A2X de référence.\n` : "\n  Écriture identique à celle produite par A2X. ✅\n");
process.exit(failures ? 1 : 0);
