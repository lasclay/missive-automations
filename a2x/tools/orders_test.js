/**
 * orders_test.js — vérifie la ventilation sur de VRAIES commandes Lasclay,
 * relevées le 31 juillet 2026 via l'API Shopify. Hors-ligne, aucun appel réseau.
 *
 *   node a2x/tools/orders_test.js
 *
 * Chaque cas contrôle deux choses : la somme des composantes égale le total
 * réel de la commande (rien de perdu, rien de compté deux fois), et chaque
 * composante trouve un compte dans les mappings.
 */
const { saleComponents, ctx } = require("../lib/breakdown");
const { resolve } = require("../lib/mapper");

const m = (a) => ({ shopMoney: { amount: String(a) } });
const li = (total, discount, taxes, opts = {}) => ({
  id: "li", title: opts.title || "Article", quantity: 1,
  originalTotalSet: m(total), totalDiscountSet: m(opts.allocations ? 0 : discount),
  // Un rabais appliqué à toute la commande n'apparaît QUE dans discountAllocations.
  discountAllocations: (opts.allocations || (discount ? [discount] : [])).map((a) => ({ allocatedAmountSet: m(a) })),
  taxLines: taxes.map((t) => ({ priceSet: m(t) })),
  product: opts.product === undefined ? { id: "p", isGiftCard: !!opts.giftCard } : opts.product,
  variant: opts.variant === undefined ? { id: "v" } : opts.variant,
});
const sl = (orig, disc, taxes) => ({
  id: "sl", title: "Livraison",
  originalPriceSet: m(orig), discountedPriceSet: m(disc),
  taxLines: taxes.map((t) => ({ priceSet: m(t) })),
});
const tip = (amount) => li(amount, 0, [], { title: "Tip", product: null, variant: null });

const order = (o) => ({
  refunds: [], shippingLines: { edges: [] }, lineItems: { edges: [] },
  totalTipReceivedSet: m(0), ...o,
  lineItems: { edges: (o.items || []).map((node) => ({ node })) },
  shippingLines: { edges: (o.ships || []).map((node) => ({ node })) },
});

const CASES = [
  {
    name: "L-50760 — rabais de 15 % sur TOUTE la commande (hors totalDiscountSet)",
    total: 58.62,
    order: order({
      sourceName: "web",
      shippingAddress: null,
      billingAddress: { countryCodeV2: "CA", provinceCode: "QC" },
      items: [li(29.99, 0, [1.27, 2.54], { allocations: [4.5] }), li(29.99, 0, [1.28, 2.54], { allocations: [4.49] })],
      ships: [sl(0, 0, [])],
    }),
    expect: { ProductSales: 59.98, Discount: -8.99, Tax: 7.63 },
  },
  {
    name: "L-50757 — rabais de 10 % sur toute la commande, avec livraison taxée",
    total: 94.26,
    order: order({
      sourceName: "web",
      shippingAddress: { countryCodeV2: "CA", provinceCode: "QC" },
      items: [li(29.99, 0, [1.35, 2.69], { allocations: [3.0] }), li(49.99, 0, [2.25, 4.49], { allocations: [4.99] })],
      ships: [sl(9.99, 9.99, [0.5, 1.0])],
    }),
    expect: { ProductSales: 79.98, Discount: -7.99, Shipping: 9.99, Tax: 10.78, ShippingTax: 1.5 },
  },
  {
    name: "L-50762 — US avec pourboire (le pourboire est AUSSI un article)",
    total: 202.01,
    order: order({
      sourceName: "web",
      shippingAddress: { countryCodeV2: "US", provinceCode: "CA" },
      totalTipReceivedSet: m(18.37),
      items: [li(9.8, 0, []), li(173.84, 0, []), tip(18.37)],
      ships: [sl(0, 0, [])],
    }),
    expect: { ProductSalesNotTaxed: 183.64, Tip: 18.37 },
  },
  {
    name: "L-50748 — QC avec pourboire, taxes et livraison",
    total: 75.23,
    order: order({
      sourceName: "web",
      shippingAddress: { countryCodeV2: "CA", provinceCode: "QC" },
      totalTipReceivedSet: m(5.1),
      items: [li(59.99, 8.99, [2.55, 5.09]), tip(5.1)],
      ships: [sl(9.99, 9.99, [1.0, 0.5])],
    }),
    expect: { ProductSales: 59.99, Discount: -8.99, Shipping: 9.99, Tax: 7.64, ShippingTax: 1.5, Tip: 5.1 },
  },
  {
    name: "L-50747 — cartes-cadeaux seulement",
    total: 350.0,
    order: order({
      sourceName: "web",
      shippingAddress: null,
      billingAddress: { countryCodeV2: "CA", provinceCode: "QC" },
      items: [li(100, 0, [0], { giftCard: true }), li(250, 0, [0], { giftCard: true })],
    }),
    expect: { GiftCardSaleLiability: 350 },
  },
  {
    name: "L-50735 — livraison offerte (rabais de livraison)",
    total: 91.96,
    order: order({
      sourceName: "web",
      shippingAddress: { countryCodeV2: "CA", provinceCode: "QC" },
      items: [li(79.98, 0, [4.0, 7.98])],
      ships: [sl(9.99, 0, [0, 0])],
    }),
    expect: { ProductSales: 79.98, ShippingNotTaxed: 9.99, ShippingDiscountNotTaxed: -9.99, Tax: 11.98 },
  },
  {
    name: "L-50755 — Ontario, TVH sur une seule ligne de taxe",
    total: 429.39,
    order: order({
      sourceName: "web",
      shippingAddress: { countryCodeV2: "CA", provinceCode: "ON" },
      items: [li(379.99, 0, [49.4])],
      ships: [sl(0, 0, [0])],
    }),
    expect: { ProductSales: 379.99, Tax: 49.4 },
  },
  {
    name: "L-50725 — app Shop (canal 3890849)",
    total: 70.13,
    order: order({
      sourceName: "3890849",
      shippingAddress: { countryCodeV2: "CA", provinceCode: "QC" },
      items: [li(59.99, 8.99, [2.55, 5.09])],
      ships: [sl(9.99, 9.99, [1.0, 0.5])],
    }),
    expect: { ProductSales: 59.99, Discount: -8.99, Shipping: 9.99, Tax: 7.64, ShippingTax: 1.5 },
  },
];

let failures = 0;
for (const c of CASES) {
  const comps = saleComponents(c.order);
  const { country, marketplace } = ctx(c.order);
  const total = comps.reduce((t, x) => t + x.amount, 0);
  const expectedTotal = Math.round(c.total * 100);

  console.log(`\n  ${c.name}`);
  console.log(`  pays ${country} · canal ${marketplace}`);

  if (total !== expectedTotal) {
    failures++;
    console.log(`  ✗ somme des composantes ${(total / 100).toFixed(2)} ≠ total de la commande ${c.total.toFixed(2)}`);
  } else {
    console.log(`  ✓ somme des composantes = ${c.total.toFixed(2)}`);
  }

  const got = {};
  for (const x of comps) got[x.details] = (got[x.details] || 0) + x.amount;
  for (const [details, amount] of Object.entries(c.expect)) {
    const g = got[details];
    if (g === undefined || Math.abs(g - Math.round(amount * 100)) > 0) {
      failures++;
      console.log(`  ✗ ${details} : attendu ${amount.toFixed(2)}, obtenu ${g === undefined ? "absent" : (g / 100).toFixed(2)}`);
    }
  }
  for (const details of Object.keys(got)) {
    if (!(details in c.expect)) { failures++; console.log(`  ✗ composante inattendue : ${details} ${(got[details] / 100).toFixed(2)}`); }
  }

  for (const x of comps) {
    const hit = resolve(x.category, x.details, country, marketplace);
    if (!hit.accountId) {
      failures++;
      console.log(`  ✗ non mappé : ${x.category} / ${x.details} / ${country} / ${marketplace}`);
    }
  }
}

console.log(failures ? `\n  ${failures} écart(s).\n` : "\n  Toutes les commandes réelles se ventilent et se mappent correctement. ✅\n");
process.exit(failures ? 1 : 0);
