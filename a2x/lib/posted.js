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
const config = require("../config.json");

/** Les nôtres (« CLONE-… ») et celles d'A2X (« A2XSH-… »). */
const PREFIXES = [config.docNumberPrefix || "CLONE", ...(config.legacyDocNumberPrefixes || [])];

let cache = null;

async function postedJournals(force = false) {
  if (cache && !force) return cache;
  // Le langage de requête de QuickBooks n'a pas de OR : un appel par préfixe.
  const list = [];
  for (const p of PREFIXES) {
    const res = await qbo("query", {
      query: `select * from JournalEntry where DocNumber like '${p}-%' orderby TxnDate desc maxresults 400`,
    });
    list.push(...((res.data && res.data.QueryResponse && res.data.QueryResponse.JournalEntry) || []));
  }
  cache = list.map((je) => {
    const line = (je.Line || []).find((l) => /^Balance of settlement/i.test(l.Description || ""));
    const detail = line && line.JournalEntryLineDetail;
    const note = je.PrivateNote || "";
    const mine = /publié par a2x-app/i.test(note);
    return {
      id: je.Id,
      docNumber: je.DocNumber,
      txnDate: je.TxnDate,
      settlementCents: line ? Math.round(line.Amount * 100) * (detail && detail.PostingType === "Credit" ? -1 : 1) : null,
      source: mine ? "app" : "a2x",
      payoutId: mine ? (note.match(/Versement Shopify Payments (\d+)/) || [])[1] || null : null,
      month: mine ? (note.match(/hors Shopify Payments (\d{4}-\d{2})/) || [])[1] || null : null,
    };
  });
  return cache;
}

const invalidate = () => { cache = null; };

/**
 * La partie « période » d'un DocNumber : « 21Jul-27Jul ». On compare là-dessus
 * plutôt que sur le DocNumber entier, pour qu'une de nos écritures
 * (« CLONE-21Jul-27Jul-115 ») reconnaisse celle d'A2X sur la même période
 * (« A2XSH-21Jul-27Jul-592 ») malgré le préfixe différent.
 */
function periodKey(docNumber) {
  const m = String(docNumber).match(/-(\d{2}[A-Za-z]{3}-\d{2}[A-Za-z]{3})-/);
  return m ? m[1] : null;
}

/**
 * Le DocNumber ne porte pas l'année (« 28Jul-31Jul ») : sans garde-fou, une
 * écriture de juillet 2025 est apparue comme couvrant un versement de juillet
 * 2026. On exige donc aussi que la date de la pièce précède de peu l'émission
 * du versement.
 */
const samePeriodAs = (docNumber, issuedAt) => {
  const k = periodKey(docNumber);
  const end = issuedAt ? new Date(issuedAt) : null;
  return (j) => {
    if (k === null || periodKey(j.docNumber) !== k) return false;
    if (!end || !j.txnDate) return true;
    const days = (end - new Date(j.txnDate)) / 86400000;
    return days >= -2 && days <= 60;
  };
};

/**
 * @param {{docNumber: string, settlement: number, issuedAt: string}} journal
 * @returns {Promise<null|{id, docNumber, txnDate, match}>}
 */
async function findExisting({ docNumber, settlement, issuedAt, payoutId }, force = false) {
  const all = await postedJournals(force);
  const cents = settlement == null ? null : Math.round(settlement * 100);

  // Nos propres écritures portent l'id du versement en note : appariement certain.
  if (payoutId) {
    const mine = all.find((j) => j.payoutId && String(j.payoutId) === String(payoutId));
    if (mine) return { ...mine, match: "id du versement" };
  }

  if (cents == null) return null;

  // Le montant déposé est le seul critère fiable pour les écritures d'A2X : sur
  // les 320 écritures existantes, les 320 montants de règlement sont distincts.
  // La période, elle, ne suffit JAMAIS : A2X produit plusieurs journaux couvrant
  // les mêmes dates (et des journaux mensuels hors Shopify Payments). Apparier
  // sur la période seule désignait une écriture sans rapport.
  const inPeriod = samePeriodAs(docNumber, issuedAt);
  const exact = all.find((j) => j.settlementCents === cents && inPeriod(j));
  if (exact) return { ...exact, match: "période et montant" };

  const end = issuedAt ? new Date(issuedAt) : null;
  const byAmount = all.find((j) => {
    if (j.settlementCents !== cents) return false;
    if (!end || !j.txnDate) return true;
    const days = (end - new Date(j.txnDate)) / 86400000;
    return days >= -2 && days <= 21;
  });
  return byAmount ? { ...byAmount, match: "montant" } : null;
}

/**
 * Écritures couvrant la même période mais d'un AUTRE montant. Ce ne sont pas
 * des correspondances — juste un contexte utile à afficher pour comprendre ce
 * qui existe déjà autour de ce versement.
 */
async function relatedByPeriod({ docNumber, settlement, issuedAt }, force = false) {
  const all = await postedJournals(force);
  const cents = settlement == null ? null : Math.round(settlement * 100);
  const inPeriod = samePeriodAs(docNumber, issuedAt);
  return all
    .filter((j) => j.settlementCents !== null && j.settlementCents !== cents && inPeriod(j))
    .map((j) => ({ ...j, settlement: j.settlementCents / 100 }));
}

/**
 * Écritures MENSUELLES hors Shopify Payments déjà comptabilisées pour un mois.
 *
 * Elles n'ont pas de ligne « Balance of settlement » — c'est justement leur
 * signature, et c'est ce qui les tient à l'écart de l'appariement des
 * versements. Côté A2X on les reconnaît à la date (le 1er du mois) et au
 * DocNumber qui commence la période au 1er ; côté nous, à la note privée.
 *
 * A2X en publiait PLUSIEURS par mois (une par lot traité : 5 en mai 2026). On
 * les renvoie toutes : une seule suffit à bloquer une publication en double,
 * mais les voir toutes évite de croire qu'il n'en manque qu'une.
 *
 * @returns {Promise<{mine: object|null, a2x: object[]}>}
 */
async function monthlyJournals(month, force = false) {
  const all = await postedJournals(force);
  const firstOfMonth = `${month}-01`;
  const mine = all.find((j) => j.month === month) || null;
  const a2x = all.filter((j) =>
    j.source === "a2x" &&
    j.settlementCents === null &&
    j.txnDate === firstOfMonth &&
    /-01[A-Za-z]{3}-\d{2}[A-Za-z]{3}-/.test(j.docNumber || "")
  );
  return { mine, a2x };
}

/** La première écriture qui couvre déjà ce mois, ou null. */
async function findExistingMonthly(month, force = false) {
  const { mine, a2x } = await monthlyJournals(month, force);
  if (mine) return { ...mine, match: "mois publié par cette app" };
  if (a2x.length) return { ...a2x[0], match: "écriture mensuelle d'A2X", siblings: a2x.length };
  return null;
}

module.exports = {
  postedJournals, findExisting, relatedByPeriod, periodKey, invalidate, PREFIXES,
  monthlyJournals, findExistingMonthly,
};
