#!/usr/bin/env node
/**
 * Une composante sans compte ne doit PAS se retrouver au compte de change.
 *
 * Le calcul de l'arrondi était « net déposé − lignes mappées ». Une composante
 * qu'on ne savait pas mapper disparaissait donc de l'écriture, et son montant
 * réapparaissait tel quel en « CurrencyConversionRounding » : l'écriture
 * s'équilibrait parfaitement, l'erreur ne se voyait nulle part, et un montant
 * sans rapport atterrissait au 9100. Vu en vrai sur CLONE-19Aug-26Aug-611.
 *
 * Ce test fabrique le cas : une commande sur un canal inconnu, réglée en deux
 * fois, dont la ligne de paiement en attente n'a aucune règle.
 *
 *   node a2x/tools/drift_test.js
 */
const { buildJournalEntry } = require("../lib/journal");

let ok = 0, ko = 0;
const check = (label, cond, detail = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${label}${cond || !detail ? "" : `  — ${detail}`}`);
  cond ? ok++ : ko++;
};

const m = (a) => ({ shopMoney: { amount: String(a), currencyCode: "CAD" } });
const conn = (arr) => ({ edges: arr.map((node) => ({ node })) });

// Canal bidon : aucune règle de mapping ne le couvre, ni en exact ni en repli.
const CANAL_INCONNU = "999999999";

const order = {
  id: "gid://shopify/Order/70001", name: "L-70001",
  processedAt: "2026-08-20T12:00:00Z", test: false, currencyCode: "CAD",
  sourceName: CANAL_INCONNU,
  shippingAddress: { countryCodeV2: "CA", provinceCode: "QC" },
  totalTipReceivedSet: m(0), taxLines: [],
  lineItems: conn([{
    id: "gid://shopify/LineItem/1", title: "Article", quantity: 1, sku: "SKU",
    originalTotalSet: m(100), totalDiscountSet: m(0), discountAllocations: [],
    taxLines: [], product: null, variant: { id: "gid://shopify/ProductVariant/1" },
  }]),
  shippingLines: conn([]), refunds: [],
  transactions: [
    // Un premier encaissement, ANTÉRIEUR : c'est lui qui crée la ligne
    // « PendingPayment - Gateway shopify_payments », celle qu'on ne sait pas mapper.
    { id: "gid://shopify/OrderTransaction/1", kind: "SALE", status: "SUCCESS",
      gateway: "shopify_payments", processedAt: "2026-08-20T12:00:00Z", amountSet: m(40), fees: [] },
    { id: "gid://shopify/OrderTransaction/2", kind: "CAPTURE", status: "SUCCESS",
      gateway: "shopify_payments", processedAt: "2026-08-21T12:00:00Z", amountSet: m(60), fees: [] },
  ],
};

const payout = { id: "gid://shopify/ShopifyPaymentsPayout/1", legacyResourceId: "700001",
  status: "PAID", issuedAt: "2026-08-21T00:00:00Z", net: { amount: "60.00", currencyCode: "CAD" } };

const btx = [{
  id: "gid://shopify/ShopifyPaymentsBalanceTransaction/1", type: "charge", test: false,
  transactionDate: "2026-08-21T12:00:00Z", sourceOrderTransactionId: "gid://shopify/OrderTransaction/2",
  amount: m(60), fee: m(0), net: m(60),
  associatedOrder: { id: order.id, name: order.name },
}];

const j = buildJournalEntry(payout, btx, new Map([["70001", order]]));

console.log(`\n  ${j.docNumber}\n`);
for (const l of j.body.Line) {
  const d = l.JournalEntryLineDetail;
  console.log(`     ${d.PostingType === "Debit" ? "DT" : "CT"} ${String(l.Amount).padStart(8)}  ${l.Description}  → compte ${d.AccountRef.value}`);
}
for (const u of j.unmapped) console.log(`     ?? ${String(u.amount).padStart(8)}  ${u.description}  → SANS COMPTE`);
console.log();

const pending = j.unmapped.find((u) => /^PendingPayment/.test(u.details));
check("la ligne de paiement en attente est bien signalée sans compte", !!pending,
  j.unmapped.map((u) => u.description).join(" | ") || "(aucune)");
check("elle vaut −40 $ (le premier encaissement)", pending && Math.abs(pending.amount + 40) < 0.005,
  pending ? String(pending.amount) : "");

const arrondi = j.body.Line.find((l) => /CurrencyConversionRounding/.test(l.Description));
check("AUCUNE ligne d'arrondi de change n'est créée", !arrondi,
  arrondi ? `${arrondi.JournalEntryLineDetail.PostingType} ${arrondi.Amount}` : "");
check("l'arrondi calculé est nul", j.drift === 0, String(j.drift));
check("l'écriture est déclarée DÉSÉQUILIBRÉE, donc bloquée", j.balanced === false);

const dt = j.body.Line.filter((l) => l.JournalEntryLineDetail.PostingType === "Debit").reduce((t, l) => t + l.Amount, 0);
const ct = j.body.Line.filter((l) => l.JournalEntryLineDetail.PostingType === "Credit").reduce((t, l) => t + l.Amount, 0);
// La propriété qui compte : le déséquilibre visible vaut EXACTEMENT ce qui
// manque. Avant, il valait zéro et le total des composantes manquantes partait
// en perte de change.
const manquant = j.unmapped.reduce((t, u) => t + u.amount, 0);
check("le déséquilibre vaut exactement le total des composantes manquantes",
  Math.abs((dt - ct) - manquant) < 0.005,
  `débits ${dt.toFixed(2)} · crédits ${ct.toFixed(2)} · manquant ${manquant.toFixed(2)}`);

console.log(`\n  ${ok} vérification(s) réussie(s), ${ko} en échec.\n`);
process.exit(ko ? 1 : 0);
