/**
 * Ventilation d'une commande Shopify en composantes typées « à la A2X ».
 *
 * Convention de signe : un montant POSITIF augmente un revenu ou un passif
 * (donc crédit au grand livre) ; un montant NÉGATIF est un rabais, un
 * remboursement ou une dépense (donc débit). Tous les montants sont en CENTS
 * de la devise de la boutique (shopMoney), pour éviter les flottants.
 */

const cents = (v) => Math.round((parseFloat(v == null ? 0 : v) || 0) * 100);
const money = (m) => cents(m && m.shopMoney ? m.shopMoney.amount : m && m.amount);
const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
const nodes = (conn) => ((conn && conn.edges) || []).map((e) => e.node);

/** Pays A2X : « CA-QC », « US », « EU », ou « * » si inconnu. */
const EU = new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"]);

function orderCountry(order) {
  const addr = order.shippingAddress || order.billingAddress || null;
  const c = addr && addr.countryCodeV2;
  if (!c) return "*";
  if (EU.has(c)) return "EU";
  const p = addr.provinceCode;
  return p ? `${c}-${p}` : c;
}

/**
 * Marketplace A2X. `sourceName` de Shopify est exactement ce qu'A2X affiche :
 * « web » → Online store, « pos » → Point of sale, « shopify_draft_order » →
 * Manual order, et un identifiant numérique d'app pour les canaux tiers
 * (ex. 3890849 = l'app Shop).
 */
function orderMarketplace(order) {
  const src = String(order.sourceName || "").toLowerCase();
  if (src === "web" || src === "online_store") return "online";
  if (src === "pos" || src === "point_of_sale") {
    const loc = order.physicalLocation && order.physicalLocation.id;
    const legacy = loc ? String(loc).split("/").pop() : null;
    return legacy ? `pos:${legacy}` : "pos";
  }
  if (src === "shopify_draft_order" || src === "draft_order") return "manual";
  if (src === "exchange" || src === "edit") return src;
  if (/^\d+$/.test(src)) return src;
  const handle = order.channelInformation && order.channelInformation.channelDefinition
    && String(order.channelInformation.channelDefinition.handle || "").toLowerCase();
  if (handle === "web" || handle === "online_store") return "online";
  if (handle === "pos") return "pos";
  if (handle === "draft_orders") return "manual";
  const appId = order.app && order.app.id ? String(order.app.id).split("/").pop() : null;
  return appId || src || "*";
}

function ctx(order) {
  return { country: orderCountry(order), marketplace: orderMarketplace(order), order: order.name };
}

/**
 * Rabais réellement appliqué à une ligne.
 *
 * `totalDiscountSet` ne porte QUE les rabais propres à la ligne : un code de
 * rabais appliqué à toute la commande (allocationMethod ACROSS) y reste à zéro
 * et n'apparaît que dans `discountAllocations`. Vérifié sur L-50760 : deux
 * lignes à 29,99 avec totalDiscount à 0, mais 4,50 + 4,49 en allocations, et un
 * sous-total de 50,99. `discountAllocations` couvre les deux familles — c'est
 * donc la seule source à utiliser, jamais la somme des deux.
 */
const discountOf = (line) =>
  sum(line.discountAllocations || [], (d) => money(d.allocatedAmountSet)) || money(line.totalDiscountSet);

/** Composantes de la VENTE (hors frais de paiement, hors remboursements). */
function saleComponents(order) {
  const items = nodes(order.lineItems);
  const ships = nodes(order.shippingLines);

  const tipAmount = money(order.totalTipReceivedSet);

  // Chez Shopify, le pourboire arrive DEUX fois : comme article de commande
  // (« Tip », sans produit ni variante, non taxable) et dans totalTipReceived.
  // Le compter des deux côtés gonflerait les ventes du montant du pourboire —
  // vérifié sur L-50762 : 9,80 + 173,84 + 18,37 = 202,01, le total de la commande.
  const isTip = (i) =>
    !i.product && !i.variant && /^\s*(tip|pourboire|gratuity)/i.test(i.title || "");

  const gift = items.filter((i) => i.product && i.product.isGiftCard);
  const goods = items.filter((i) => !(i.product && i.product.isGiftCard) && !isTip(i));

  const goodsGross = sum(goods, (i) => money(i.originalTotalSet));
  const goodsDiscount = sum(goods, discountOf);
  const goodsTax = sum(goods, (i) => sum(i.taxLines || [], (t) => money(t.priceSet)));

  const giftGross = sum(gift, (i) => money(i.originalTotalSet));
  const giftDiscount = sum(gift, discountOf);

  const shipGross = sum(ships, (i) => money(i.originalPriceSet));
  const shipNet = sum(ships, (i) => money(i.discountedPriceSet));
  const shipTax = sum(ships, (i) => sum(i.taxLines || [], (t) => money(t.priceSet)));
  const shipAllocated = sum(ships, discountOf);
  const shipDiscount = shipAllocated || shipGross - shipNet;

  // Si le pourboire n'apparaît pas en article (commandes anciennes), on le prend
  // dans totalTipReceived ; sinon les deux coïncident et rien n'est perdu.
  const tip = tipAmount || sum(items.filter(isTip), (i) => money(i.originalTotalSet));

  const taxed = goodsTax > 0;
  const shipTaxed = shipTax > 0;
  const out = [];
  const push = (category, details, amount) => { if (amount) out.push({ category, details, amount }); };

  push("Sales", taxed ? "ProductSales" : "ProductSalesNotTaxed", goodsGross);
  push("Discounts", taxed ? "Discount" : "DiscountNotTaxed", -goodsDiscount);
  push("Gift Card Liabilities", "GiftCardSaleLiability", giftGross);
  push("Gift Card Liabilities", "GiftCardDiscount", -giftDiscount);
  push("Shipping Income", shipTaxed ? "Shipping" : "ShippingNotTaxed", shipGross);
  push("Shipping Income", "ShippingDiscountNotTaxed", -shipDiscount);
  push("Sales Tax", "Tax", goodsTax);
  push("Shipping Tax", "ShippingTax", shipTax);
  push("Other Income", "Tip", tip);
  return out;
}

/** Composantes d'un remboursement (montants négatifs). */
function refundComponents(refund) {
  const rlis = nodes(refund.refundLineItems);
  const rshs = nodes(refund.refundShippingLines);

  const goods = sum(rlis, (r) => money(r.subtotalSet));
  const goodsTax = sum(rlis, (r) => money(r.totalTaxSet));
  const ship = sum(rshs, (r) => money(r.subtotalAmountSet));
  const shipTax = sum(rshs, (r) => money(r.taxAmountSet));
  const total = money(refund.totalRefundedSet);
  const discrepancy = total - (goods + goodsTax + ship + shipTax);

  const out = [];
  const push = (category, details, amount) => { if (amount) out.push({ category, details, amount }); };
  push("Refunds", goodsTax ? "Refund" : "RefundNotTaxed", -goods);
  push("Refunds Tax", "RefundTax", -goodsTax);
  push("Shipping Income", shipTax ? "ShippingRefund - shipping_refund" : "ShippingRefundNotTaxed - shipping_refund", -ship);
  push("Shipping Tax", "ShippingRefundTax - shipping_refund", -shipTax);
  push("Refunds", "RefundAdjustmentNotTaxed - refund_discrepancy", -discrepancy);
  return out;
}

/**
 * Répartit des composantes au prorata d'un montant réellement encaissé.
 * Utile quand un payout ne règle qu'une partie d'une commande (capture
 * partielle, paiement en plusieurs fois, commande à cheval sur deux payouts).
 * Le reliquat d'arrondi est ajouté à la plus grosse composante.
 */
function prorate(components, settled, expected) {
  if (!components.length) return [];
  if (expected === settled || !expected) return components.map((c) => ({ ...c }));
  const scaled = components.map((c) => ({ ...c, amount: Math.round((c.amount * settled) / expected) }));
  const drift = settled - sum(scaled, (c) => c.amount);
  if (drift) {
    let bigI = 0;
    for (let i = 1; i < scaled.length; i++) if (Math.abs(scaled[i].amount) > Math.abs(scaled[bigI].amount)) bigI = i;
    scaled[bigI].amount += drift;
  }
  return scaled.filter((c) => c.amount);
}

/**
 * Même ventilation, mais détaillée par article et par ligne de livraison —
 * la granularité des « raw data » d'A2X, pour pouvoir comparer les deux
 * fichiers ligne à ligne. La somme par type est identique à saleComponents
 * (vérifié dans tools/csv_test.js).
 */
function saleRows(order) {
  const items = nodes(order.lineItems);
  const ships = nodes(order.shippingLines);
  const isTip = (i) => !i.product && !i.variant && /^\s*(tip|pourboire|gratuity)/i.test(i.title || "");
  const gift = items.filter((i) => i.product && i.product.isGiftCard);
  const goods = items.filter((i) => !(i.product && i.product.isGiftCard) && !isTip(i));

  const goodsTax = sum(goods, (i) => sum(i.taxLines || [], (t) => money(t.priceSet)));
  const shipTax = sum(ships, (i) => sum(i.taxLines || [], (t) => money(t.priceSet)));
  const taxed = goodsTax > 0;
  const shipTaxed = shipTax > 0;

  const rows = [];
  const push = (type, amount, sku, qty) => { if (amount) rows.push({ type, amount, sku: sku || "", quantity: qty || 0 }); };

  for (const i of goods) {
    const sku = i.sku || (i.variant && i.variant.sku) || "";
    push(taxed ? "ProductSales" : "ProductSalesNotTaxed", money(i.originalTotalSet), sku, i.quantity);
    push(taxed ? "Discount" : "DiscountNotTaxed", -discountOf(i), sku, i.quantity);
    push("Tax", sum(i.taxLines || [], (t) => money(t.priceSet)), sku, i.quantity);
  }
  for (const i of gift) {
    const sku = i.sku || "";
    push("GiftCardSaleLiability", money(i.originalTotalSet), sku, i.quantity);
    push("GiftCardDiscount", -discountOf(i), sku, i.quantity);
  }
  for (const s of ships) {
    const orig = money(s.originalPriceSet);
    const alloc = discountOf(s) || orig - money(s.discountedPriceSet);
    push(shipTaxed ? "Shipping" : "ShippingNotTaxed", orig);
    push("ShippingDiscountNotTaxed", -alloc);
    push("ShippingTax", sum(s.taxLines || [], (t) => money(t.priceSet)));
  }
  push("Tip", money(order.totalTipReceivedSet) || sum(items.filter(isTip), (i) => money(i.originalTotalSet)));
  return rows;
}

module.exports = { cents, money, sum, nodes, ctx, orderCountry, orderMarketplace, saleComponents, saleRows, refundComponents, prorate, discountOf };
