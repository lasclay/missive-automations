/**
 * Construction de l'écriture de journal QBO à partir d'un payout Shopify.
 * Le format reproduit exactement celui d'A2X (relevé sur la pièce 11170 dans QBO) :
 *   DocNumber      A2XSH-21Jul-27Jul-592
 *   TxnDate        date de la première transaction du payout
 *   Description    "ProductSales  - CA - Online store"
 *   TaxCodeRef     seulement sur les lignes « Détaxé on Sales » (+ TaxApplicableOn/TaxAmount)
 *   dernière ligne "Balance of settlement for: 2026-07-21" au compte de dépôt
 */
const { resolve } = require("./mapper");
const { ctx, saleComponents, refundComponents, prorate, money, sum, nodes } = require("./breakdown");
const { txFamily } = require("./payouts");
const { gid } = require("./shopify");
const config = require("../config.json");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Les dates de Shopify sont en UTC, mais A2X raisonne dans le fuseau de la
 * boutique : une transaction du 22 juillet 02 h UTC est du 21 juillet à
 * Montréal, et A2X titre bien « Payout — 21 Jul 2026 ». Sans cette conversion
 * la période et la date de l'écriture décalent d'un jour.
 */
const TZ = config.timezone || "America/New_York";

/** Pour un horodatage réel (transaction) : la date telle que la voit la boutique. */
const isoDate = (iso) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(iso));

/**
 * Pour la date d'émission d'un versement, qui est une DATE et non un instant :
 * Shopify la renvoie à minuit UTC, la convertir la reculerait d'un jour.
 */
const isoDay = (iso) => new Date(iso).toISOString().slice(0, 10);

const label = (ymd) => { const [, mm, dd] = ymd.split("-"); return `${dd}${MONTHS[parseInt(mm, 10) - 1]}`; };
const dayLabel = (iso) => label(isoDate(iso));

/**
 * Libellé de pays dans la description. A2X écrit « CA », pas « CA (QC) », et
 * regroupe donc les provinces sur une seule ligne. On fait pareil : sur les 349
 * règles, une seule voit son compte changer selon la province (`Underpayment`
 * en Ontario), et elle ne concerne aucun type produit ici. La province reste
 * utilisée pour CHOISIR le compte — seul l'affichage est regroupé.
 */
function countryLabel(c) {
  if (!c || c === "*") return "N/A";
  const [base, prov] = c.split("-");
  return config.groupByProvince && prov ? `${base} (${prov})` : base;
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
 * Description d'une ligne, à la façon d'A2X.
 *
 * Format courant : « ProductSales  - CA - Online store » (deux espaces avant le
 * tiret — c'est le champ « passerelle » resté vide). Sur les lignes de
 * passerelle, A2X remplit ce champ et laisse tomber le pays quand il est N/A :
 * « Sale Gateway paypal - Online store ». Relevé sur les pièces 10999 et 10835.
 */
function describe(details, country, marketplace, { gateway = false } = {}) {
  const parts = [];
  if (!(gateway && country === "*")) parts.push(countryLabel(country));
  parts.push(marketplaceLabel(marketplace));
  return `${details}${gateway ? "" : " "} - ${parts.join(" - ")}`;
}

/**
 * Accumulateur de lignes : additionne les composantes par (compte, taxe,
 * description) et met de côté ce qui n'a pas de compte. Partagé par l'écriture
 * d'un versement et par l'écriture mensuelle hors Shopify Payments.
 */
function grouper() {
  /** @type {Map<string, object>} clé = compte|taxe|description */
  const groups = new Map();
  const unmapped = [];
  const notes = [];

  const add = (category, details, country, marketplace, amountCents, source, opts = {}) => {
    if (!amountCents) return;
    const hit = resolve(category, details, country, marketplace);
    const description = describe(details, country, marketplace, opts);
    if (!hit.accountId) {
      unmapped.push({ category, details, country, marketplace, amount: amountCents / 100, description, source });
      return;
    }
    const key = `${hit.accountId}|${(hit.tax && hit.tax.value) || ""}|${description}`;
    const g = groups.get(key) || {
      accountId: hit.accountId, accountName: hit.accountName, acctNum: hit.acctNum,
      tax: hit.tax, description, category, details, country, marketplace,
      amount: 0, fallback: hit.fallback, matched: hit.matched, sources: [],
    };
    g.amount += amountCents;
    if (source && g.sources.length < 50) g.sources.push(source);
    groups.set(key, g);
  };

  return { add, unmapped, notes, values: () => [...groups.values()] };
}

/**
 * Assemble le corps QBO à partir de groupes de lignes déjà mappés.
 * `extraLines` (arrondi de change, contrepartie du versement) est ajouté tel
 * quel APRÈS les lignes de composantes, et ne compte pas dans la base taxable.
 */
function buildBody(groups, { docNumber, txnDate, privateNote, taxMode, extraLines = [] }) {
  const mode = taxMode || config.taxCodeMode || "full";
  // Base imposable par TAUX de taxe : le code va sur la ligne, les taux qu'il
  // regroupe vont dans le TxnTaxDetail de l'écriture.
  const netParTaux = new Map();
  const Line = [];
  // Les groupes dans l'ordre exact des lignes produites : c'est ce qui permet à
  // l'interface de rattacher une ligne d'écriture à sa règle de mapping.
  const lineGroups = [];

  for (const g of groups.slice().sort((a, b) => a.description.localeCompare(b.description, "fr"))) {
    const amount = Math.round(Math.abs(g.amount)) / 100;
    if (!amount) continue;
    const detail = {
      PostingType: g.amount > 0 ? "Credit" : "Debit",
      AccountRef: { value: String(g.accountId) },
    };
    // Le bloc de taxe est repris tel que QuickBooks le RENVOIE sur les écritures
    // d'A2X ; il n'est pas garanti qu'il soit accepté tel quel en création selon
    // la version d'API. `taxCodeMode` permet de le réduire sans toucher au code.
    if (g.tax && g.tax.codeId && mode !== "none") {
      detail.TaxCodeRef = { value: String(g.tax.codeId) };
      if (mode === "full") {
        detail.TaxApplicableOn = g.tax.applicableOn || "Sales";
        detail.TaxAmount = 0;
      }
      const signe = g.amount > 0 ? 1 : -1;
      for (const t of g.tax.taux || []) {
        const cur = netParTaux.get(t.id) || { pct: t.pct, cents: 0 };
        cur.cents += signe * Math.round(amount * 100);
        netParTaux.set(t.id, cur);
      }
    }
    Line.push({ Description: g.description, Amount: amount, DetailType: "JournalEntryLineDetail", JournalEntryLineDetail: detail });
    lineGroups.push(g);
  }

  Line.push(...extraLines);

  const body = {
    DocNumber: docNumber,
    TxnDate: txnDate,
    PrivateNote: privateNote,
    CurrencyRef: { value: config.currency || "CAD" },
    ExchangeRate: 1,
    Line,
  };

  /**
   * Sans ce bloc, QuickBooks refuse l'écriture : « erreur lors du calcul de la
   * taxe ». Un code de taxe sur les lignes ne suffit pas — il faut aussi lui
   * donner le TAUX et la base au niveau de la transaction, sinon il tente de
   * calculer lui-même et échoue. Relevé sur la pièce 11170 d'A2X, où
   * NetAmountTaxable vaut l'opposé de la somme signée des lignes détaxées.
   */
  if (mode === "full" && netParTaux.size) {
    const taxLines = [...netParTaux].filter(([, v]) => v.cents).map(([id, v]) => ({
      Amount: 0,
      DetailType: "TaxLineDetail",
      TaxLineDetail: {
        TaxRateRef: { value: String(id) },
        PercentBased: true,
        TaxPercent: v.pct,
        NetAmountTaxable: -v.cents / 100,
      },
    }));
    if (taxLines.length) body.TxnTaxDetail = { TaxLine: taxLines };
  }

  const balanced = Math.abs(sum(Line, (l) =>
    (l.JournalEntryLineDetail.PostingType === "Debit" ? 1 : -1) * Math.round(l.Amount * 100))) === 0;

  return { body, balanced, lineGroups };
}

/**
 * Transforme les transactions de solde d'un payout en groupes de lignes mappées.
 * @param {object} payout
 * @param {Array} btx  transactions de solde du payout
 * @param {Map<string,object>} ordersById  commandes indexées par id numérique
 */
function buildLines(payout, btx, ordersById) {
  const { add, unmapped, notes, values } = grouper();

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

    // Vente (charge).
    const comps = saleComponents(order);
    const expected = sum(comps, (c) => c.amount);
    const pendingDetails = "PendingPayment - Gateway shopify_payments";

    // Déjà encaissé sur cette commande AVANT cette transaction. On exclut
    // explicitement la transaction qui EST celle-ci : son horodatage précède
    // celui de la transaction de solde, elle serait sinon comptée en double et
    // toute commande passerait à tort en paiement en attente.
    const already = sum(
      (order.transactions || []).filter((x) =>
        /^(SALE|CAPTURE)$/i.test(x.kind || "") &&
        /^SUCCESS$/i.test(x.status || "") &&
        String(gid(x.id)) !== String(t.sourceOrderTransactionId) &&
        x.processedAt && t.transactionDate && new Date(x.processedAt) < new Date(t.transactionDate)
      ),
      (x) => money(x.amountSet)
    );

    const missing = expected - (already + amount);
    // Un écart de quelques cents sur une commande en devise étrangère est une
    // conversion, pas un impayé : A2X le porte en ForeignCurrencyGainLoss et
    // reconnaît la vente entière (vérifié sur L-50736, 0,02 $ sur 155,75 $).
    const fxOnly = missing !== 0 && Math.abs(missing) <= Math.max(10, Math.round(Math.abs(expected) * 0.01));
    const reallyPending = missing > 0 && !fxOnly;

    if (reallyPending) {
      // Commande pas encore soldée : comme A2X, on parque l'encaissement plutôt
      // que de reconnaître une vente — et surtout une TAXE — partielle. Vérifié
      // sur L-50755 : A2X porte les 79,39 $ reçus sur une commande de 429,39 $
      // au 1110, sans rien toucher au 2121.
      add("Pending Payments", pendingDetails, country, marketplace, amount, src);
      notes.push(`${src} : ${(amount / 100).toFixed(2)} encaissé sur une commande de ${(expected / 100).toFixed(2)} → paiement en attente, aucune vente reconnue.`);
    } else {
      for (const c of comps) add(c.category, c.details, country, marketplace, c.amount, src);
      if (already) {
        add("Pending Payments", pendingDetails, country, marketplace, -already, src);
        notes.push(`${src} : commande soldée, ${(already / 100).toFixed(2)} de paiement en attente repris.`);
      }
      if (missing) add("Other Expenses", "ForeignCurrencyGainLoss", country, marketplace, -missing, src);
    }
    if (fee) add("Payment and Selling Fees", "ShopifyFee", country, marketplace, -fee, src);
  }

  return { groups: values(), unmapped, notes };
}

/** Assemble le corps QBO d'une écriture de journal. */
function buildJournalEntry(payout, btx, ordersById, opts = {}) {
  const { groups, unmapped, notes } = buildLines(payout, btx, ordersById);
  const settlementAccountId = opts.settlementAccountId || config.settlementAccountId;
  const roundingAccountId = opts.roundingAccountId || config.roundingAccountId;
  const prefix = opts.docNumberPrefix || config.docNumberPrefix || "CLONE";

  // A2X nomme le payout « première transaction → date d'émission » (ex. 21Jul-27Jul).
  const dates = btx.map((t) => t.transactionDate).filter(Boolean).sort();
  const start = dates[0] || payout.issuedAt;
  const end = payout.issuedAt || dates[dates.length - 1];
  const legacy = String(payout.legacyResourceId || gid(payout.id) || "");
  const startDay = isoDate(start);   // horodatage de transaction → fuseau boutique
  const endDay = isoDay(end);        // date d'émission du versement → telle quelle
  const docNumber = `${prefix}-${label(startDay)}-${label(endDay)}-${legacy.slice(-3)}`;
  // QuickBooks refuse un DocNumber de plus de 21 caractères.
  if (docNumber.length > 21) {
    throw new Error(`DocNumber « ${docNumber} » fait ${docNumber.length} caractères (max 21) — raccourcis docNumberPrefix dans a2x/config.json.`);
  }

  // Contrepartie : le net réellement déposé (somme des nets des transactions du payout).
  const settlement = sum(btx, (t) => money(t.net));
  /**
   * L'écart va au compte de change — mais il se calcule sur TOUTES les
   * composantes, y compris celles qu'on n'a pas su mapper. Sans ça, une
   * composante sans compte disparaissait de l'écriture et son montant
   * réapparaissait tel quel en « CurrencyConversionRounding » : l'écriture
   * s'équilibrait, l'erreur était invisible, et un montant sans rapport
   * atterrissait au 9100. Vu sur CLONE-19Aug-26Aug-611, où les 2,54 $ de
   * « PendingPayment - Gateway shopify_payments - CA - 3890849 » étaient
   * devenus 2,54 $ de perte de change.
   */
  const unmappedTotal = Math.round(sum(unmapped, (u) => u.amount * 100));
  const lineTotal = sum(groups, (g) => g.amount);
  const drift = settlement - lineTotal - unmappedTotal;
  const extraLines = [];

  if (drift) {
    extraLines.push({
      Description: "CurrencyConversionRounding USD-CAD",
      Amount: Math.abs(drift) / 100,
      DetailType: "JournalEntryLineDetail",
      JournalEntryLineDetail: { PostingType: drift > 0 ? "Credit" : "Debit", AccountRef: { value: String(roundingAccountId) } },
    });
  }

  if (settlement) {
    extraLines.push({
      Description: `Balance of settlement for: ${startDay}`,
      Amount: Math.abs(settlement) / 100,
      DetailType: "JournalEntryLineDetail",
      JournalEntryLineDetail: { PostingType: settlement > 0 ? "Debit" : "Credit", AccountRef: { value: String(settlementAccountId) } },
    });
  }

  const { body, balanced, lineGroups } = buildBody(groups, {
    docNumber,
    txnDate: startDay,
    // Trace l'origine : c'est ce qui distingue nos écritures de celles d'A2X,
    // dont le suffixe de DocNumber n'est pas reconstituable.
    privateNote: `Versement Shopify Payments ${legacy} · ${startDay} → ${endDay} · publié par a2x-app`,
    taxMode: opts.taxMode,
    extraLines,
  });

  return {
    body,
    docNumber,
    payoutId: legacy,
    period: { start: startDay, end: endDay },
    settlement: settlement / 100,
    payoutNet: parseFloat((payout.net && payout.net.amount) || 0),
    drift: drift / 100,
    groups: groups.map((g) => ({ ...g, amount: g.amount / 100 })),
    lineGroups,
    unmapped,
    notes,
    balanced,
  };
}

module.exports = {
  buildLines, buildJournalEntry, grouper, buildBody, describe,
  countryLabel, marketplaceLabel, isoDate, isoDay, dayLabel, label, MONTHS,
};
