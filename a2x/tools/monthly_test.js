#!/usr/bin/env node
/**
 * Vérifie l'écriture mensuelle hors Shopify Payments sur les quatre situations
 * qu'on retrouve dans les vraies écritures d'A2X (pièces 10834 à 10837) :
 *
 *   1. commande payée en PayPal                → vente reconnue, PayPal au débit
 *   2. commande manuelle facturée, non payée   → vente reconnue, créance au débit
 *   3. encaissement sur commande déjà réglée
 *      par Shopify Payments                    → aucune vente, attente au crédit
 *   4. commande payée par Shopify Payments     → totalement ignorée ici
 *
 * Aucun appel réseau : les commandes sont fabriquées au format de l'API Shopify.
 *
 *   node a2x/tools/monthly_test.js
 */
const { buildMonthlyEntry, monthRange, recentMonths } = require("../lib/monthly");

const MONTH = "2026-06";
let ok = 0, ko = 0;
const check = (label, cond, detail = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${label}${cond || !detail ? "" : `  — ${detail}`}`);
  cond ? ok++ : ko++;
};

const m = (amount) => ({ shopMoney: { amount: String(amount), currencyCode: "CAD" } });
const conn = (arr) => ({ edges: arr.map((node) => ({ node })) });

/** Une commande Shopify minimale mais complète pour la ventilation. */
function order({ name, id, processedAt, transactions = [], items = [], shipping = [], refunds = [] }) {
  return {
    id: `gid://shopify/Order/${id}`,
    name,
    processedAt,
    test: false,
    currencyCode: "CAD",
    sourceName: name.startsWith("D-") ? "shopify_draft_order" : "web",
    shippingAddress: { countryCodeV2: "CA", provinceCode: "QC" },
    totalTipReceivedSet: m(0),
    taxLines: [],
    lineItems: conn(items.map((i) => ({
      id: `gid://shopify/LineItem/${Math.random()}`,
      title: i.title || "Article", quantity: 1, sku: i.sku || "SKU",
      originalTotalSet: m(i.price),
      totalDiscountSet: m(i.discount || 0),
      discountAllocations: i.discount ? [{ allocatedAmountSet: m(i.discount) }] : [],
      taxLines: i.tax ? [{ title: "TPS/TVQ", priceSet: m(i.tax) }] : [],
      product: null, variant: { id: "gid://shopify/ProductVariant/1" },
    }))),
    shippingLines: conn(shipping.map((s) => ({
      id: "gid://shopify/ShippingLine/1", title: "Livraison",
      originalPriceSet: m(s.price), discountedPriceSet: m(s.price),
      discountAllocations: [],
      taxLines: s.tax ? [{ title: "TPS/TVQ", priceSet: m(s.tax) }] : [],
    }))),
    refunds,
    transactions,
  };
}

const tx = (kind, gateway, amount, processedAt, status = "SUCCESS") =>
  ({ id: `gid://shopify/OrderTransaction/${Math.random()}`, kind, status, gateway, processedAt, amountSet: m(amount), fees: [] });

// ---------------------------------------------------------------- les commandes

const orders = [
  // 1. Vente PayPal complète : 100 + 15 de taxe + 10 de livraison + 1,50 = 126,50.
  order({
    name: "L-90001", id: 90001, processedAt: "2026-06-10T14:00:00Z",
    items: [{ price: 100, tax: 15 }],
    shipping: [{ price: 10, tax: 1.5 }],
    transactions: [tx("SALE", "paypal", 126.5, "2026-06-10T14:00:00Z")],
  }),
  // 2. Commande manuelle facturée, aucun paiement : 200 + 30 de taxe.
  order({
    name: "D-90002", id: 90002, processedAt: "2026-06-12T10:00:00Z",
    items: [{ price: 200, tax: 30 }],
    transactions: [],
  }),
  // 3. Commande réglée par Shopify Payments, plus une capture manuelle de 9,70
  //    dans le mois : c'est exactement la pièce 10836 d'A2X.
  order({
    name: "L-90003", id: 90003, processedAt: "2026-06-15T09:00:00Z",
    items: [{ price: 300, tax: 45 }],
    transactions: [
      tx("SALE", "shopify_payments", 335.3, "2026-06-15T09:00:00Z"),
      tx("CAPTURE", "manual", 9.7, "2026-06-20T09:00:00Z"),
    ],
  }),
  // 4. Commande entièrement Shopify Payments : elle appartient à un versement.
  order({
    name: "L-90004", id: 90004, processedAt: "2026-06-18T09:00:00Z",
    items: [{ price: 50, tax: 7.5 }],
    transactions: [tx("SALE", "shopify_payments", 57.5, "2026-06-18T09:00:00Z")],
  }),
  // 5. Commande d'un autre mois, payée PayPal en juillet : hors période.
  order({
    name: "L-90005", id: 90005, processedAt: "2026-07-02T09:00:00Z",
    items: [{ price: 80, tax: 12 }],
    transactions: [tx("SALE", "paypal", 92, "2026-07-02T09:00:00Z")],
  }),
];

// ------------------------------------------------------------------ le contrôle

console.log(`\n  Écriture mensuelle ${MONTH} — ${orders.length} commande(s) en entrée\n`);
const j = buildMonthlyEntry(MONTH, orders);

const ligne = (re) => j.body.Line.find((l) => re.test(l.Description));
const val = (re) => { const l = ligne(re); return l ? `${l.JournalEntryLineDetail.PostingType} ${l.Amount}` : "(absente)"; };

for (const l of j.body.Line) {
  const d = l.JournalEntryLineDetail;
  console.log(`     ${d.PostingType === "Debit" ? "DT" : "CT"} ${String(l.Amount).padStart(9)}  ${l.Description}  → compte ${d.AccountRef.value}`);
}
console.log();

check("équilibrée", j.balanced);
check("DocNumber au format d'A2X", /^[A-Z]+-01Jun-01Jul-M26$/.test(j.docNumber), j.docNumber);
check("DocNumber ≤ 21 caractères", j.docNumber.length <= 21, `${j.docNumber.length}`);
check("datée du 1er du mois", j.body.TxnDate === "2026-06-01", j.body.TxnDate);
check("aucune composante non mappée", j.unmapped.length === 0,
  j.unmapped.map((u) => u.description).join(" | "));

check("3 commandes retenues sur 5", j.orders.length === 3, j.orders.map((o) => o.name).join(", "));
check("la commande Shopify Payments pure est ignorée", !j.orders.some((o) => o.name === "L-90004"));
check("la commande de juillet est ignorée", !j.orders.some((o) => o.name === "L-90005"));

// 1. PayPal : vente reconnue, PayPal au débit du montant encaissé.
check("Sale Gateway paypal au débit de 126,50", val(/^Sale Gateway paypal/) === "Debit 126.5", val(/^Sale Gateway paypal/));
check("description sans pays sur la passerelle, comme A2X",
  !!ligne(/^Sale Gateway paypal - Online store$/), ligne(/Sale Gateway paypal/) && ligne(/Sale Gateway paypal/).Description);

// 3. Capture manuelle : contrepartie en attente, aucune vente reconnue.
check("Capture Gateway manual au débit de 9,70", val(/^Capture Gateway manual/) === "Debit 9.7", val(/^Capture Gateway manual/));
check("L-90003 n'est PAS reconnue ici", j.orders.find((o) => o.name === "L-90003").reconnue === false);
check("L-90004 absente des ventes", !ligne(/L-90004/));

// 2. Commande manuelle non payée : la créance est au débit.
const manuel = ligne(/^PendingPayment  - CA - Manual order$/);
check("PendingPayment au débit de 230 sur la commande manuelle",
  !!manuel && manuel.JournalEntryLineDetail.PostingType === "Debit" && manuel.Amount === 230,
  manuel ? `${manuel.JournalEntryLineDetail.PostingType} ${manuel.Amount}` : "(absente)");

// Les ventes reconnues : 100 + 200 de produits, 15 + 30 de taxe, 10 + 1,50 de livraison.
const dt = j.body.Line.filter((l) => l.JournalEntryLineDetail.PostingType === "Debit").reduce((t, l) => t + l.Amount, 0);
const ct = j.body.Line.filter((l) => l.JournalEntryLineDetail.PostingType === "Credit").reduce((t, l) => t + l.Amount, 0);
check("débits = crédits", Math.round(dt * 100) === Math.round(ct * 100), `${dt.toFixed(2)} ≠ ${ct.toFixed(2)}`);
check("ProductSales de 300 (100 PayPal + 200 manuel)",
  Math.round((ligne(/^ProductSales  - CA - Online store$/) || { Amount: 0 }).Amount * 100)
  + Math.round((ligne(/^ProductSales  - CA - Manual order$/) || { Amount: 0 }).Amount * 100) === 30000);

// Les passerelles rencontrées, pour l'interface.
check("passerelles listées : paypal et manual",
  j.gateways.map((g) => g.gateway).sort().join(",") === "manual,paypal",
  j.gateways.map((g) => `${g.gateway} ${g.amount}`).join(" · "));

// ------------------------------------------------- les bornes de mois, à part
const r = monthRange("2026-02");
check("février 2026 : 01 → 28", r.start === "2026-02-01" && r.end === "2026-02-28" && r.next === "2026-03-01",
  `${r.start} → ${r.end} (suivant ${r.next})`);
const r2 = monthRange("2026-12");
check("décembre bascule sur janvier", r2.next === "2027-01-01", r2.next);
check("les 13 derniers mois sont distincts et décroissants",
  new Set(recentMonths(13)).size === 13 && recentMonths(13)[0] > recentMonths(13)[12]);

console.log(`\n  ${ok} vérification(s) réussie(s), ${ko} en échec.\n`);
process.exit(ko ? 1 : 0);
