/**
 * Récupération des commandes Shopify avec tout ce qu'il faut pour ventiler une écriture :
 * articles, livraison, taxes, rabais, pourboires, remboursements, paiements et frais.
 */
const { gql, paginate, gid } = require("./shopify");

const ORDER_FIELDS = `
  id
  name
  processedAt
  createdAt
  test
  currencyCode
  presentmentCurrencyCode
  sourceName
  app { id name }
  channelInformation { channelId channelDefinition { channelName handle subChannelName } }
  physicalLocation { id name }
  shippingAddress { countryCodeV2 provinceCode }
  billingAddress { countryCodeV2 provinceCode }
  totalTipReceivedSet { shopMoney { amount currencyCode } }
  totalPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
  taxesIncluded
  taxLines { title rate priceSet { shopMoney { amount } } }
  shippingLines(first: 25) { edges { node {
    id title
    originalPriceSet { shopMoney { amount } }
    discountedPriceSet { shopMoney { amount } }
    taxLines { title priceSet { shopMoney { amount } } }
  } } }
  lineItems(first: 250) { edges { node {
    id title quantity
    originalTotalSet { shopMoney { amount } }
    totalDiscountSet { shopMoney { amount } }
    taxLines { title priceSet { shopMoney { amount } } }
    product { id isGiftCard }
    variant { id }
  } } }
  refunds(first: 50) {
    id createdAt
    totalRefundedSet { shopMoney { amount } }
    refundLineItems(first: 250) { edges { node {
      quantity
      subtotalSet { shopMoney { amount } }
      totalTaxSet { shopMoney { amount } }
    } } }
    refundShippingLines(first: 25) { edges { node {
      subtotalAmountSet { shopMoney { amount } }
      taxAmountSet { shopMoney { amount } }
    } } }
    transactions(first: 25) { edges { node { id kind status gateway amountSet { shopMoney { amount } } } } }
  }
  transactions(first: 50) {
    id kind status gateway processedAt
    amountSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    fees { amount { amount currencyCode } type rate rateName taxAmount { amount } }
  }
`;

const BY_IDS_Q = `query OrdersByIds($ids: [ID!]!) { nodes(ids: $ids) { ... on Order { ${ORDER_FIELDS} } } }`;

const BY_QUERY_Q = `
query OrdersByQuery($first: Int!, $after: String, $query: String) {
  orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT) {
    pageInfo { hasNextPage endCursor }
    edges { node { ${ORDER_FIELDS} } }
  }
}`;

/** Récupère des commandes par id (gid ou id numérique), par lots de 25. */
async function ordersByIds(ids) {
  const gids = [...new Set(ids.filter(Boolean))].map((id) =>
    String(id).startsWith("gid://") ? String(id) : `gid://shopify/Order/${gid(id)}`
  );
  const out = [];
  for (let i = 0; i < gids.length; i += 25) {
    const data = await gql(BY_IDS_Q, { ids: gids.slice(i, i + 25) });
    out.push(...(data.nodes || []).filter(Boolean));
  }
  return out;
}

/** Commandes traitées dans un intervalle [from, to] (YYYY-MM-DD, bornes incluses). */
async function ordersInRange(from, to, { max = Infinity } = {}) {
  const query = `processed_at:>='${from}' AND processed_at:<='${to}T23:59:59Z'`;
  return paginate(BY_QUERY_Q, { query }, (d) => d && d.orders, { pageSize: 50, max });
}

module.exports = { ordersByIds, ordersInRange };
