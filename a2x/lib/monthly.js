/**
 * Écriture MENSUELLE hors Shopify Payments — ce qu'A2X publiait une fois par
 * mois en plus des écritures de versement : PayPal, cartes-cadeaux, commandes
 * manuelles, échanges, et les remboursements qui ne transitent pas par un
 * versement.
 *
 * Modèle relevé sur les vraies écritures d'A2X (pièces 10819, 10834 à 10837,
 * 10998 à 11000) :
 *
 *   A2XSH-01May-01Jun-418   TxnDate 2026-05-01
 *     CT 12248.92  ProductSales  - CA - Online store              125
 *     DT  2215.54  Discount  - CA - Online store                  127
 *     CT  1502.69  Tax  - CA - Online store                       132
 *     DT 13627.48  Sale Gateway paypal - Online store              25   ← contrepartie
 *
 * La règle, par commande, tient en une ligne :
 *
 *     PendingPayment = encaissé hors Shopify Payments − revenu reconnu
 *
 * — une commande payée entièrement en PayPal : revenu reconnu = encaissé, donc
 *   pas de ligne d'attente (pièce 10835) ;
 * — une commande manuelle facturée et pas encore payée : rien d'encaissé, donc
 *   PendingPayment au DÉBIT, c'est la créance (pièce 10837, 94,42 $) ;
 * — un encaissement sur une commande déjà réglée par Shopify Payments :
 *   aucun revenu ici (le versement s'en charge), donc PendingPayment au CRÉDIT
 *   en contrepartie de la passerelle (pièce 10836, 9,70 $).
 *
 * Une commande qui a le moindre paiement Shopify Payments n'est donc JAMAIS
 * reconnue ici : son écriture de versement la reconnaît en entier et reprend au
 * passage ce qui dormait en paiement en attente. C'est ce qui garantit qu'aucun
 * revenu n'est compté deux fois entre les deux familles d'écritures.
 */
const { grouper, buildBody, isoDate, label, countryLabel, marketplaceLabel } = require("./journal");
const { ctx, saleComponents, refundComponents, money, sum, nodes } = require("./breakdown");
const { ordersInRange, ordersUpdatedInRange } = require("./orders");
const { gid } = require("./shopify");
const config = require("../config.json");

const SHOPIFY_PAYMENTS = /shopify[_ -]?payments/i;
const isSuccess = (t) => /^SUCCESS$/i.test(t.status || "");
const isSale = (t) => /^(SALE|CAPTURE)$/i.test(t.kind || "");
const isRefund = (t) => /^REFUND$/i.test(t.kind || "");
const gatewayOf = (t) => String(t.gateway || "").trim() || "No_Gateway";

/** Bornes d'un mois « YYYY-MM » : premier jour, dernier jour, premier du mois suivant. */
function monthRange(month) {
  const m = String(month || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`Mois « ${month} » invalide — attendu AAAA-MM.`);
  const [, y, mm] = m;
  const first = `${y}-${mm}-01`;
  const nextDate = new Date(Date.UTC(+y, +mm, 1));
  const next = nextDate.toISOString().slice(0, 10);
  const last = new Date(nextDate - 86400000).toISOString().slice(0, 10);
  return { month: `${y}-${mm}`, start: first, end: last, next };
}

/** Les N derniers mois, du plus récent au plus ancien (« 2026-08 », …). */
function recentMonths(n = 13, from = new Date()) {
  const out = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    if (--m < 0) { m = 11; y--; }
  }
  return out;
}

/**
 * Charge tout ce qui peut alimenter l'écriture du mois : les commandes du mois,
 * plus celles simplement MODIFIÉES pendant le mois — un remboursement ou une
 * capture de janvier sur une commande de décembre n'apparaît que par là.
 */
async function ordersForMonth(month, { max = 2000 } = {}) {
  const { start, end } = monthRange(month);
  const [processed, updated] = await Promise.all([
    ordersInRange(start, end, { max }),
    ordersUpdatedInRange(start, end, { max }),
  ]);
  const byId = new Map();
  for (const o of [...processed, ...updated]) byId.set(String(gid(o.id)), o);
  return [...byId.values()];
}

/**
 * @param {string} month  « AAAA-MM »
 * @param {Array} orders  commandes candidates (voir ordersForMonth)
 */
function buildMonthlyEntry(month, orders, opts = {}) {
  const range = monthRange(month);
  const { add, unmapped, notes, values } = grouper();
  const inMonth = (iso) => {
    if (!iso) return false;
    const d = isoDate(iso);
    return d >= range.start && d <= range.end;
  };

  const kept = [];
  const gateways = new Map();

  for (const order of orders) {
    if (order.test) continue;
    const { country, marketplace } = ctx(order);

    const paiements = (order.transactions || []).filter((t) => isSuccess(t) && isSale(t));
    const horsShopifyPayments = paiements.filter((t) => !SHOPIFY_PAYMENTS.test(gatewayOf(t)) && inMonth(t.processedAt));

    // Un remboursement réglé par Shopify Payments revient dans un versement :
    // on ne garde ici que ceux qui n'y passent pas (PayPal, carte-cadeau, ou
    // remboursement sans transaction du tout).
    const remboursements = (order.refunds || []).filter((r) =>
      inMonth(r.createdAt) && !nodes(r.transactions).some((x) => SHOPIFY_PAYMENTS.test(gatewayOf(x)))
    );

    /**
     * Dès qu'une commande TOUCHE Shopify Payments — même par une transaction
     * encore en attente — sa vente appartient à l'écriture du versement, jamais
     * à celle-ci. C'est le garde-fou contre le double comptage : on regarde
     * toutes les transactions, pas seulement celles qui ont abouti.
     */
    const toucheShopifyPayments = (order.transactions || []).some((t) => SHOPIFY_PAYMENTS.test(gatewayOf(t)));

    // La vente n'est reconnue ici que si AUCUN paiement Shopify Payments ne
    // viendra la reconnaître dans une écriture de versement.
    const reconnue = !toucheShopifyPayments && inMonth(order.processedAt);

    // Une commande facturée et pas encore payée n'a aucune transaction : elle
    // n'apparaîtrait nulle part sans ce cas-là. A2X la reconnaît quand même et
    // porte la créance en paiement en attente (pièce 10837, 94,42 $ au débit).
    if (!horsShopifyPayments.length && !remboursements.length && !reconnue) continue;

    // Somme signée de tout ce qu'on ajoute pour cette commande : ce qui reste au
    // bout est, par construction, le paiement en attente.
    let net = 0;
    const put = (category, details, amount) => {
      if (!amount) return;
      net += amount;
      add(category, details, country, marketplace, amount, order.name);
    };

    /**
     * La contrepartie d'un encaissement n'a PAS de pays : un règlement PayPal
     * n'appartient à aucun territoire de vente. A2X écrit « Sale Gateway paypal
     * - Online store » (sans pays) et ses 20 règles de passerelle ont toutes la
     * colonne pays à « - » — alors que « ForeignCurrencyGainLoss Gateway paypal
     * - US - Online store », qui est une charge, garde le sien.
     */
    const putPasserelle = (category, details, amount) => {
      if (!amount) return;
      net += amount;
      add(category, details, "*", marketplace, amount, order.name, { gateway: true });
    };

    if (reconnue) for (const c of saleComponents(order)) put(c.category, c.details, c.amount);
    for (const r of remboursements) for (const c of refundComponents(r)) put(c.category, c.details, c.amount);

    for (const t of horsShopifyPayments) {
      const gw = gatewayOf(t);
      const mot = /^CAPTURE$/i.test(t.kind) ? "Capture" : "Sale";
      const categorie = /gift[_ ]?card/i.test(gw) ? "Gift Card Liabilities" : "Gateway Transactions";
      putPasserelle(categorie, `${mot} Gateway ${gw}`, -money(t.amountSet));
      gateways.set(gw, (gateways.get(gw) || 0) + money(t.amountSet));
    }
    for (const r of remboursements) {
      for (const x of nodes(r.transactions).filter((x) => isRefund(x) && isSuccess(x))) {
        const gw = gatewayOf(x);
        putPasserelle("Gateway Transactions", `Refund Gateway ${gw}`, money(x.amountSet));
        gateways.set(gw, (gateways.get(gw) || 0) - money(x.amountSet));
      }
    }

    // Ce qui n'est ni encaissé ni reconnu dort en paiement en attente — au débit
    // (créance sur une commande facturée) ou au crédit (encaissement d'avance,
    // que l'écriture de versement viendra reprendre).
    if (net) put("Pending Payments", "PendingPayment", -net);

    kept.push({
      name: order.name,
      country,
      marketplace,
      reconnue,
      encaisse: sum(horsShopifyPayments, (t) => money(t.amountSet)) / 100,
      passerelles: [...new Set(horsShopifyPayments.map(gatewayOf))],
    });
    if (!reconnue && horsShopifyPayments.length) {
      notes.push(`${order.name} : encaissement hors Shopify Payments sur une commande réglée par versement — porté en paiement en attente, aucune vente reconnue ici.`);
    }
  }

  const groups = values();
  const prefix = opts.docNumberPrefix || config.docNumberPrefix || "CLONE";
  // Même forme que chez A2X (« A2XSH-01Jun-01Jul-469 »), mais un suffixe qui
  // dit ce que c'est : « M » + l'année. Le compteur d'A2X ne se reconstitue pas,
  // et QuickBooks limite le DocNumber à 21 caractères.
  const docNumber = `${prefix}-${label(range.start)}-${label(range.next)}-M${range.month.slice(2, 4)}`;
  if (docNumber.length > 21) {
    throw new Error(`DocNumber « ${docNumber} » fait ${docNumber.length} caractères (max 21) — raccourcis docNumberPrefix dans a2x/config.json.`);
  }

  const { body, balanced, lineGroups } = buildBody(groups, {
    docNumber,
    txnDate: range.start,
    privateNote: `Ventes hors Shopify Payments ${range.month} · ${range.start} → ${range.end} · publié par a2x-app`,
    taxMode: opts.taxMode,
  });

  return {
    body,
    docNumber,
    month: range.month,
    period: { start: range.start, end: range.end },
    groups: groups.map((g) => ({ ...g, amount: g.amount / 100 })),
    lineGroups,
    orders: kept,
    gateways: [...gateways].map(([gateway, cents]) => ({ gateway, amount: cents / 100 })).sort((a, b) => b.amount - a.amount),
    unmapped,
    notes,
    balanced,
    total: sum(body.Line, (l) => (l.JournalEntryLineDetail.PostingType === "Debit" ? Math.round(l.Amount * 100) : 0)) / 100,
  };
}

module.exports = { monthRange, recentMonths, ordersForMonth, buildMonthlyEntry, countryLabel, marketplaceLabel };
