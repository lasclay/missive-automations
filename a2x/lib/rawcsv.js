/**
 * Export « raw data » d'un versement, au format exact du fichier qu'A2X propose
 * sous « download the raw data ». Sert au contrôle qualité : on ouvre les deux
 * fichiers côte à côte, ou on les compare avec tools/csv_test.js.
 *
 *   "date","order_number","order_id","transaction_id","type","desc","amount",
 *   "gateway_meta","sku","sku_quantity","business_entity_id","business_entity_name"
 */
const { ctx, saleRows, refundComponents, money, sum, nodes } = require("./breakdown");
const { txFamily } = require("./payouts");
const { gid } = require("./shopify");
const { countryLabel, marketplaceLabel, isoDate } = require("./journal");
const config = require("../config.json");

const HEADER = ["date", "order_number", "order_id", "transaction_id", "type", "desc", "amount",
  "gateway_meta", "sku", "sku_quantity", "business_entity_id", "business_entity_name"];

/** Tri d'A2X : types par ordre alphabétique, articles dans l'ordre de la commande. */
const sortLikeA2x = (rows) =>
  rows.map((r, i) => ({ ...r, i })).sort((a, b) => a.type.localeCompare(b.type, "en") || a.i - b.i);

const q = (v) => (v === null || v === undefined || v === "" ? "" : `"${String(v).replace(/"/g, '""')}"`);
const amount = (cents) => (cents / 100).toFixed(2);

/**
 * @param {object} payout
 * @param {Array} btx transactions de solde du versement
 * @param {Map} ordersById
 * @returns {string} le CSV
 */
function rawCsv(payout, btx, ordersById) {
  const entity = config.businessEntityId || "";
  const entityName = config.businessEntityName || "";
  const lines = [HEADER.map(q).join(",")];

  for (const t of btx) {
    if (txFamily(t.type) === "transfer") continue;
    const orderId = t.associatedOrder && gid(t.associatedOrder.id);
    const order = orderId ? ordersById.get(String(orderId)) : null;
    const date = isoDate(t.transactionDate);
    const orderNumber = order ? String(order.name || "").replace(/^L-/, "") : "";
    const txId = t.sourceOrderTransactionId ? String(t.sourceOrderTransactionId) : "";

    if (!order) {
      lines.push([date, "", "", txId, t.type, "", amount(money(t.amount)), "", "", 0, entity, entityName].map(q).join(","));
      continue;
    }

    const { country, marketplace } = ctx(order);
    const desc = ` - ${countryLabel(country)} - ${marketplaceLabel(marketplace)}`;
    const row = (type, cents, sku, qty, transactionId) =>
      lines.push([date, orderNumber, gid(order.id), transactionId || "", type, desc, amount(cents),
        "", sku || "", qty || 0, entity, entityName].map(q).join(","));

    if (txFamily(t.type) === "refund") {
      const refunds = order.refunds || [];
      const target = refunds.find((r) =>
        nodes(r.transactions).some((x) => String(gid(x.id)) === String(t.sourceOrderTransactionId))
      ) || (refunds.length === 1 ? refunds[0] : null);
      const rows = (target ? refundComponents(target) : []).map((c) => ({ type: c.details, amount: c.amount }));
      for (const r of sortLikeA2x(rows)) row(r.type, r.amount, r.sku, r.quantity);
    } else {
      // A2X trie les types par ordre alphabétique dans chaque commande, les
      // frais Shopify mis à part : on fait pareil pour que les deux fichiers se
      // comparent ligne à ligne.
      for (const r of sortLikeA2x(saleRows(order))) row(r.type, r.amount, r.sku, r.quantity);
    }

    // Les frais Shopify viennent de la transaction de solde, pas de la commande.
    if (money(t.fee)) row("ShopifyFee", -money(t.fee), "", 0, txId);
  }

  return lines.join("\n") + "\n";
}

module.exports = { rawCsv };
