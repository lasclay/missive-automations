/**
 * Construction de l'écriture de journal QBO à partir d'un payout Shopify.
 * Le format reproduit exactement celui d'A2X (relevé sur la pièce 11170 dans QBO) :
 *   DocNumber      A2XSH-21Jul-27Jul-592
 *   TxnDate        date de la première transaction du payout
 *   Description    "ProductSales  - CA - Online store"
 *   TaxCodeRef     seulement sur les lignes « Détaxé on Sales » (+ TaxApplicableOn/TaxAmount)
 *   dernière ligne "Balance of settlement for: 2026-07-21" au compte de dépôt
 */
const { resolve, taxCodeId } = require("./mapper");
const { ctx, saleComponents, refundComponents, prorate, money, sum, nodes } = require("./breakdown");
const { txFamily } = require("./payouts");
const { gid } = require("./shopify");
const config = require("../config.json");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (iso) => { const d = new Date(iso); return `${String(d.getUTCDate()).padStart(2, "0")}${MONTHS[d.getUTCMonth()]}`; };
const isoDate = (iso) => new Date(iso).toISOString().slice(0, 10);

const PAYS = { "*": "N/A" };
function countryLabel(c) {
  if (!c || c === "*") return "N/A";
  return c.includes("-") ? `${c.split("-")[0]} (${c.split("-")[1]})` : c;
}
function marketplaceLabel(m) {
  if (!m || m === "*") return "N/A";
  if (m === "online") return "Online store";
  if (m === "manual") return "Manual order";
  if (m.startsWith("pos")) return "Point of sale";
  if (m === "exchange") return "exchange";
  if (m === "edit") return "Edit Order";
  return m;
}

/**
 * Transforme les transactions de solde d'un payout en groupes de lignes mappées.
 * @param {object} payout
 * @param {Array} btx  transactions de solde du payout
 * @param {Map<string,object>} ordersById  commandes indexées par id numérique
 */
function buildLines(payout, btx, ordersById) {
  /** @type {Map<string, object>} clé = compte|posting|description */
  const groups = new Map();
  const unmapped = [];
  const notes = [];

  const add = (category, details, country, marketplace, amountCents, source) => {
    if (!amountCents) return;
    const hit = resolve(category, details, country, marketplace);
    const description = `${details}  - ${countryLabel(country)} - ${marketplaceLabel(marketplace)}`;
    if (!hit.accountId) {
      unmapped.push({ category, details, country, marketplace, amount: amountCents / 100, description, source });
      return;
    }
    const key = `${hit.accountId}|${hit.tax || ""}|${description}`;
    const g = groups.get(key) || {
      accountId: hit.accountId, accountName: hit.accountName, acctNum: hit.acctNum,
      tax: hit.tax, description, category, details, country, marketplace,
      amount: 0, fallback: hit.fallback, matched: hit.matched, sources: [],
    };
    g.amount += amountCents;
    if (source && g.sources.length < 50) g.sources.push(source);
    groups.set(key, g);
  };

  for (const t of btx) {
    const fam = txFamily(t.type);
    if (fam === "transfer") continue;

    const orderId = t.associatedOrder && gid(t.associatedOrder.id);
    const order = orderId ? ordersById.get(String(orderId)) : null;
    const amount = money(t.amount);
    const fee = money(t.fee);
    const src = (t.associatedOrder && t.associatedOrder.name) || t.sourceType || t.type;

    if (!order) {
      // Transaction sans commande rattachée : ajustement, litige, frais divers.
      const category = fam === "dispute" ? "Adjustments" : fam === "adjustment" ? "Adjustments" : "Other";
      const details = fam === "dispute" ? "Dispute" : fam === "adjustment"
        ? (t.adjustmentReason || "Dispute") : "NonOrderTransaction";
      add(category, details, "*", "*", amount, src);
      if (fee) add("Payment and Selling Fees", "ShopifyFee", "*", "*", -fee, src);
      if (fam === "other" || fam === "adjustment") {
        notes.push(`Transaction ${t.type} sans commande (${(amount / 100).toFixed(2)}) → ${details}.`);
      }
      continue;
    }

    const { country, marketplace } = ctx(order);

    if (fam === "refund") {
      // On rattache le remboursement Shopify correspondant, sinon on ventile au prorata.
      const refunds = order.refunds || [];
      const target = refunds.find((r) =>
        nodes(r.transactions).some((x) => String(gid(x.id)) === String(t.sourceOrderTransactionId))
      );
      const comps = target ? refundComponents(target)
        : refunds.length === 1 ? refundComponents(refunds[0]) : null;
      if (comps && comps.length) {
        const expected = sum(comps, (c) => c.amount);
        for (const c of prorate(comps, amount, expected)) add(c.category, c.details, country, marketplace, c.amount, src);
      } else {
        add("Refunds", "RefundNotTaxed", country, marketplace, amount, src);
        notes.push(`${src} : remboursement sans détail Shopify, imputé en bloc.`);
      }
      if (fee) add("Payment and Selling Fees", "ShopifyFee", country, marketplace, -fee, src);
      continue;
    }

    if (fam === "dispute") {
      add("Adjustments", "Dispute", country, marketplace, amount, src);
      if (fee) add("Payment and Selling Fees", "ShopifyFee", country, marketplace, -fee, src);
      continue;
    }

    // Vente (charge) : on ventile la commande au prorata du montant réellement encaissé.
    const comps = saleComponents(order);
    const expected = sum(comps, (c) => c.amount);
    if (expected !== amount) {
      notes.push(`${src} : encaissé ${(amount / 100).toFixed(2)} vs commande ${(expected / 100).toFixed(2)} → ventilation au prorata.`);
    }
    for (const c of prorate(comps, amount, expected)) add(c.category, c.details, country, marketplace, c.amount, src);
    if (fee) add("Payment and Selling Fees", "ShopifyFee", country, marketplace, -fee, src);
  }

  return { groups: [...groups.values()], unmapped, notes };
}

/** Assemble le corps QBO d'une écriture de journal. */
function buildJournalEntry(payout, btx, ordersById, opts = {}) {
  const { groups, unmapped, notes } = buildLines(payout, btx, ordersById);
  const settlementAccountId = opts.settlementAccountId || config.settlementAccountId;
  const roundingAccountId = opts.roundingAccountId || config.roundingAccountId;
  const prefix = opts.docNumberPrefix || config.docNumberPrefix || "CLONE";
  const taxId = taxCodeId();

  // A2X nomme le payout « première transaction → date d'émission » (ex. 21Jul-27Jul).
  const dates = btx.map((t) => t.transactionDate).filter(Boolean).sort();
  const start = dates[0] || payout.issuedAt;
  const end = payout.issuedAt || dates[dates.length - 1];
  const legacy = String(payout.legacyResourceId || gid(payout.id) || "");
  const docNumber = `${prefix}-${dayLabel(start)}-${dayLabel(end)}-${legacy.slice(-3)}`;
  // QuickBooks refuse un DocNumber de plus de 21 caractères.
  if (docNumber.length > 21) {
    throw new Error(`DocNumber « ${docNumber} » fait ${docNumber.length} caractères (max 21) — raccourcis docNumberPrefix dans a2x/config.json.`);
  }

  const Line = [];
  for (const g of groups.sort((a, b) => a.description.localeCompare(b.description, "fr"))) {
    const amount = Math.round(Math.abs(g.amount)) / 100;
    if (!amount) continue;
    const detail = {
      PostingType: g.amount > 0 ? "Credit" : "Debit",
      AccountRef: { value: String(g.accountId) },
    };
    if (g.tax === "detaxe" && taxId) {
      detail.TaxCodeRef = { value: String(taxId) };
      detail.TaxApplicableOn = "Sales";
      detail.TaxAmount = 0;
    }
    Line.push({ Description: g.description, Amount: amount, DetailType: "JournalEntryLineDetail", JournalEntryLineDetail: detail });
  }

  // Contrepartie : le net réellement déposé (somme des nets des transactions du payout).
  const settlement = sum(btx, (t) => money(t.net));
  const lineTotal = sum(groups, (g) => g.amount);
  const drift = settlement - lineTotal;

  if (drift) {
    Line.push({
      Description: "CurrencyConversionRounding USD-CAD",
      Amount: Math.abs(drift) / 100,
      DetailType: "JournalEntryLineDetail",
      JournalEntryLineDetail: { PostingType: drift > 0 ? "Credit" : "Debit", AccountRef: { value: String(roundingAccountId) } },
    });
  }

  if (settlement) {
    Line.push({
      Description: `Balance of settlement for: ${isoDate(start)}`,
      Amount: Math.abs(settlement) / 100,
      DetailType: "JournalEntryLineDetail",
      JournalEntryLineDetail: { PostingType: settlement > 0 ? "Debit" : "Credit", AccountRef: { value: String(settlementAccountId) } },
    });
  }

  const body = {
    DocNumber: docNumber,
    TxnDate: isoDate(start),
    // Trace l'origine : c'est ce qui distingue nos écritures de celles d'A2X,
    // dont le suffixe de DocNumber n'est pas reconstituable.
    PrivateNote: `Versement Shopify Payments ${legacy} · ${isoDate(start)} → ${isoDate(end)} · publié par a2x-app`,
    CurrencyRef: { value: config.currency || "CAD" },
    ExchangeRate: 1,
    Line,
  };

  return {
    body,
    docNumber,
    payoutId: legacy,
    period: { start: isoDate(start), end: isoDate(end) },
    settlement: settlement / 100,
    payoutNet: parseFloat((payout.net && payout.net.amount) || 0),
    drift: drift / 100,
    groups: groups.map((g) => ({ ...g, amount: g.amount / 100 })),
    unmapped,
    notes,
    balanced: Math.abs(sum(Line, (l) => (l.JournalEntryLineDetail.PostingType === "Debit" ? 1 : -1) * Math.round(l.Amount * 100))) === 0,
  };
}

module.exports = { buildLines, buildJournalEntry, countryLabel, marketplaceLabel, isoDate, dayLabel };
