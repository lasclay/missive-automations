/**
 * Détection des écritures déjà comptabilisées, côté QuickBooks.
 *
 * Le suffixe du DocNumber d'A2X (« A2XSH-21Jul-27Jul-592 ») est un compteur
 * interne à A2X : il ne se déduit pas de l'id du versement Shopify. S'en servir
 * pour apparier donnait des faux positifs (3 chiffres, donc des collisions entre
 * périodes sans rapport) et des faux négatifs — un versement déjà comptabilisé
 * par A2X apparaissait comme à faire, ce qui invite au doublon.
 *
 * On apparie donc sur ce qui est vérifiable : la période (préfixe du DocNumber,
 * suffixe ignoré) et, à défaut, le montant de la ligne « Balance of settlement »
 * dans une fenêtre de dates.
 */
const { qbo } = require("./qbo");

let cache = null;

async function postedJournals(force = false) {
  if (cache && !force) return cache;
  const res = await qbo("query", {
    query: "select * from JournalEntry where DocNumber like 'A2XSH-%' orderby TxnDate desc maxresults 400",
  });
  const list = (res.data && res.data.QueryResponse && res.data.QueryResponse.JournalEntry) || [];
  cache = list.map((je) => {
    const line = (je.Line || []).find((l) => /^Balance of settlement/i.test(l.Description || ""));
    const detail = line && line.JournalEntryLineDetail;
    return {
      id: je.Id,
      docNumber: je.DocNumber,
      txnDate: je.TxnDate,
      settlementCents: line ? Math.round(line.Amount * 100) * (detail && detail.PostingType === "Credit" ? -1 : 1) : null,
    };
  });
  return cache;
}

const invalidate = () => { cache = null; };

/** Le DocNumber sans son suffixe : « A2XSH-21Jul-27Jul- ». */
const docPrefix = (docNumber) => String(docNumber).replace(/-[^-]*$/, "-");

/**
 * @param {{docNumber: string, settlement: number, issuedAt: string}} journal
 * @returns {Promise<null|{id, docNumber, txnDate, match}>}
 */
async function findExisting({ docNumber, settlement, issuedAt }, force = false) {
  const all = await postedJournals(force);
  const cents = settlement == null ? null : Math.round(settlement * 100);

  // A2X produit aussi des journaux mensuels pour les paiements hors Shopify
  // Payments (« A2XSH-01Jun-01Jul-469 ») : ils n'ont pas de ligne de règlement
  // et ne correspondent à aucun versement. On ne les laisse jamais apparier.
  const prefix = docPrefix(docNumber);
  const periodHits = all.filter((j) => String(j.docNumber).startsWith(prefix));
  const exact = periodHits.find((j) => j.settlementCents !== null && j.settlementCents === cents);
  if (exact) return { ...exact, match: "période et montant" };
  const periodOnly = periodHits.find((j) => j.settlementCents !== null);
  if (periodOnly) return { ...periodOnly, match: "période" };

  if (cents == null) return null;
  const end = issuedAt ? new Date(issuedAt) : null;
  const byAmount = all.find((j) => {
    if (j.settlementCents !== cents) return false;
    if (!end || !j.txnDate) return true;
    const days = (end - new Date(j.txnDate)) / 86400000;
    return days >= -2 && days <= 21;
  });
  return byAmount ? { ...byAmount, match: "montant" } : null;
}

module.exports = { postedJournals, findExisting, docPrefix, invalidate };
