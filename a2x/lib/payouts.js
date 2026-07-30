/**
 * Payouts Shopify Payments + transactions de solde (l'équivalent du « Payout » d'A2X).
 * Portées requises : read_shopify_payments_payouts (+ read_shopify_payments_accounts).
 */
const { gql, paginate, gid } = require("./shopify");

const PAYOUTS_Q = `
query Payouts($first: Int!, $after: String, $query: String) {
  shopifyPaymentsAccount {
    id
    defaultCurrency
    payouts(first: $first, after: $after, query: $query, sortKey: ISSUED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      edges { node {
        id legacyResourceId status transactionType issuedAt
        net { amount currencyCode }
        summary {
          adjustmentsFee { amount } adjustmentsGross { amount }
          chargesFee { amount } chargesGross { amount }
          refundsFee { amount } refundsFeeGross { amount }
          reservedFundsFee { amount } reservedFundsGross { amount }
          retriedPayoutsFee { amount } retriedPayoutsGross { amount }
        }
      } }
    }
  }
}`;

const BTX_Q = `
query BalanceTx($first: Int!, $after: String, $query: String) {
  shopifyPaymentsAccount {
    balanceTransactions(first: $first, after: $after, query: $query, hideTransfers: true) {
      pageInfo { hasNextPage endCursor }
      edges { node {
        id type test transactionDate sourceId sourceType sourceOrderTransactionId adjustmentReason
        amount { amount currencyCode }
        fee { amount currencyCode }
        net { amount currencyCode }
        associatedOrder { id name }
        associatedPayout { id status }
        adjustmentsOrders { name link orderTransactionId amount { amount currencyCode } }
      } }
    }
  }
}`;

/** Liste les payouts, du plus récent au plus ancien. `since` = YYYY-MM-DD (issued_at >=). */
async function listPayouts({ limit = 20, since = null, status = null } = {}) {
  const terms = [];
  if (since) terms.push(`issued_at:>=${since}`);
  if (status) terms.push(`status:${status}`);
  const query = terms.join(" AND ") || null;
  return paginate(
    PAYOUTS_Q,
    { query },
    (d) => d && d.shopifyPaymentsAccount && d.shopifyPaymentsAccount.payouts,
    { pageSize: 50, max: limit }
  );
}

async function getPayout(payoutIdOrLegacy) {
  const legacy = String(gid(payoutIdOrLegacy));
  const list = await paginate(
    PAYOUTS_Q,
    { query: `id:${legacy}` },
    (d) => d && d.shopifyPaymentsAccount && d.shopifyPaymentsAccount.payouts,
    { pageSize: 10, max: 10 }
  );
  return list.find((p) => String(p.legacyResourceId) === legacy) || list[0] || null;
}

/** Toutes les transactions de solde rattachées à un payout. */
async function payoutTransactions(payoutIdOrLegacy) {
  const legacy = String(gid(payoutIdOrLegacy));
  const all = await paginate(
    BTX_Q,
    { query: `payments_transfer_id:${legacy}` },
    (d) => d && d.shopifyPaymentsAccount && d.shopifyPaymentsAccount.balanceTransactions,
    { pageSize: 100 }
  );
  // Filet de sécurité : le filtre de recherche Shopify est « best effort ».
  return all.filter((t) => !t.associatedPayout || String(gid(t.associatedPayout.id)) === legacy);
}

/** Normalise le type d'une transaction de solde en famille exploitable. */
function txFamily(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("refund")) return "refund";
  if (t.includes("dispute") || t.includes("chargeback")) return "dispute";
  if (t.includes("adjustment")) return "adjustment";
  if (t.includes("payout") || t.includes("transfer")) return "transfer";
  if (t.includes("charge") || t.includes("sale")) return "charge";
  return "other";
}

module.exports = { listPayouts, getPayout, payoutTransactions, txFamily };
