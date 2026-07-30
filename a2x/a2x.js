#!/usr/bin/env node
/**
 * a2x.js — remplacement maison d'A2X : Shopify Payments → écriture de journal QuickBooks.
 *
 *   node a2x/a2x.js payouts [--limit 20] [--since 2026-07-01]
 *   node a2x/a2x.js preview <payoutId>            # aperçu façon A2X, ne touche à rien
 *   node a2x/a2x.js post <payoutId> [--force]     # crée l'écriture dans QBO (idempotent)
 *   node a2x/a2x.js sync [--since 2026-07-01] [--dry-run]
 *   node a2x/a2x.js check                         # audite les mappings
 *
 * Variables : SHOPIFY_STORE, SHOPIFY_CLIENT_ID/SECRET (ou SHOPIFY_ADMIN_TOKEN),
 *             FINANCE_PROXY_URL, FINANCE_PROXY_SECRET
 */
const { listPayouts, getPayout, payoutTransactions } = require("./lib/payouts");
const { ordersByIds } = require("./lib/orders");
const { buildJournalEntry } = require("./lib/journal");
const { qbo, queryOne } = require("./lib/qbo");
const { gid } = require("./lib/shopify");
const mapper = require("./lib/mapper");

const args = process.argv.slice(2);
const cmd = args[0] || "help";
const flag = (name, def = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : true;
};
const has = (name) => args.includes(`--${name}`);
const fmt = (n) => (n < 0 ? "-" : "") + Math.abs(n).toFixed(2).padStart(9);

/** Charge payout + transactions + commandes, et construit l'écriture. */
async function compute(payoutRef) {
  const payout = await getPayout(payoutRef);
  if (!payout) throw new Error(`Payout ${payoutRef} introuvable.`);
  const btx = await payoutTransactions(payout.legacyResourceId);
  const orderIds = [...new Set(btx.map((t) => t.associatedOrder && t.associatedOrder.id).filter(Boolean))];
  const orders = await ordersByIds(orderIds);
  const byId = new Map(orders.map((o) => [String(gid(o.id)), o]));
  return { payout, btx, orders, journal: buildJournalEntry(payout, btx, byId) };
}

/** Une écriture existe-t-elle déjà pour ce DocNumber ? (couvre aussi celles d'A2X) */
async function existing(docNumber) {
  const esc = docNumber.replace(/'/g, "''");
  return queryOne(`select Id, DocNumber, TxnDate from JournalEntry where DocNumber = '${esc}'`);
}

function printJournal(j) {
  console.log(`\n  ${j.docNumber}   ${j.period.start} → ${j.period.end}   net ${j.settlement.toFixed(2)}`);
  console.log("  " + "-".repeat(88));
  for (const l of j.body.Line) {
    const d = l.JournalEntryLineDetail;
    const sign = d.PostingType === "Debit" ? "DT" : "CT";
    console.log(`  ${sign} ${fmt(l.Amount)}  ${String(l.Description).slice(0, 52).padEnd(52)} ${d.AccountRef.value}${d.TaxCodeRef ? "  [détaxé]" : ""}`);
  }
  console.log("  " + "-".repeat(88));
  console.log(`  Équilibrée : ${j.balanced ? "oui" : "NON ⚠️"}   payout Shopify : ${j.payoutNet.toFixed(2)}   écart de conversion : ${j.drift.toFixed(2)}`);
  if (j.unmapped.length) {
    console.log(`\n  ⚠️  ${j.unmapped.length} composante(s) non mappée(s) :`);
    for (const u of j.unmapped) console.log(`     ${u.amount.toFixed(2).padStart(10)}  ${u.description}  (${u.source || ""})`);
  }
  if (j.notes.length) {
    console.log(`\n  Notes :`);
    for (const n of [...new Set(j.notes)].slice(0, 15)) console.log("     - " + n);
  }
}

async function main() {
  if (cmd === "payouts") {
    const list = await listPayouts({ limit: parseInt(flag("limit", "20"), 10), since: flag("since") });
    console.log(`\n  ${list.length} payout(s)\n`);
    for (const p of list) {
      console.log(`  ${String(p.legacyResourceId).padEnd(14)} ${p.issuedAt.slice(0, 10)}  ${String(p.status).padEnd(10)} ${fmt(parseFloat(p.net.amount))} ${p.net.currencyCode}`);
    }
    console.log("\n  Aperçu :  node a2x/a2x.js preview <id>\n");
    return;
  }

  if (cmd === "preview") {
    const ref = args[1];
    if (!ref) throw new Error("Usage : node a2x/a2x.js preview <payoutId>");
    const { journal, btx, orders } = await compute(ref);
    console.log(`  ${btx.length} transaction(s) de solde, ${orders.length} commande(s).`);
    printJournal(journal);
    const dup = await existing(journal.docNumber);
    console.log(dup ? `\n  ⚠️  Déjà dans QBO : écriture ${dup.Id} (${dup.TxnDate}).\n` : `\n  Pas encore dans QBO. Publier : node a2x/a2x.js post ${journal.payoutId}\n`);
    return;
  }

  if (cmd === "post") {
    const ref = args[1];
    if (!ref) throw new Error("Usage : node a2x/a2x.js post <payoutId>");
    const { journal } = await compute(ref);
    printJournal(journal);
    if (journal.unmapped.length && !has("force")) {
      throw new Error(`${journal.unmapped.length} composante(s) non mappée(s) — corrige mappings.tsv, ou force avec --force.`);
    }
    if (!journal.balanced) throw new Error("L'écriture n'est pas équilibrée — publication refusée.");
    const dup = await existing(journal.docNumber);
    if (dup && !has("force")) {
      console.log(`\n  Déjà publiée : écriture QBO ${dup.Id}. Rien à faire.\n`);
      return;
    }
    const res = await qbo("create", { entity: "journalentry", body: journal.body });
    const je = res.data && res.data.JournalEntry;
    console.log(`\n  ✅ Écriture créée dans QBO : Id ${je && je.Id} — ${journal.docNumber}\n`);
    return;
  }

  if (cmd === "sync") {
    const since = flag("since");
    const list = await listPayouts({ limit: parseInt(flag("limit", "50"), 10), since });
    const dry = has("dry-run");
    let created = 0, skipped = 0, failed = 0;
    for (const p of list.reverse()) {
      try {
        const { journal } = await compute(p.legacyResourceId);
        const dup = await existing(journal.docNumber);
        if (dup) { skipped++; console.log(`  = ${journal.docNumber} déjà dans QBO (${dup.Id})`); continue; }
        if (journal.unmapped.length) { failed++; console.log(`  ⚠️  ${journal.docNumber} : ${journal.unmapped.length} composante(s) non mappée(s) — ignorée`); continue; }
        if (!journal.balanced) { failed++; console.log(`  ⚠️  ${journal.docNumber} : non équilibrée — ignorée`); continue; }
        if (dry) { created++; console.log(`  + ${journal.docNumber} (dry-run, ${journal.settlement.toFixed(2)})`); continue; }
        const res = await qbo("create", { entity: "journalentry", body: journal.body });
        created++;
        console.log(`  ✅ ${journal.docNumber} → QBO ${res.data && res.data.JournalEntry && res.data.JournalEntry.Id}`);
      } catch (e) {
        failed++;
        console.log(`  ❌ payout ${p.legacyResourceId} : ${e.message}`);
      }
    }
    console.log(`\n  ${created} créée(s), ${skipped} déjà présente(s), ${failed} en échec.\n`);
    return;
  }

  if (cmd === "check") {
    const m = mapper.all();
    console.log(`\n  mappings.json généré le ${m.generatedAt}`);
    console.log(`  ${m.counts.rules} règles + ${m.counts.defaults} automapping = ${m.counts.total} lignes.`);
    const suspicious = [];
    for (const [k, e] of Object.entries(m.index)) {
      if (!e.accountId) suspicious.push(`sans compte : ${k}`);
      const income = e.acctNum && /^4/.test(e.acctNum);
      if (/^(Capture|Sale|Refund) Gateway|^PendingPayment|^ShopCash/.test(e.details) && income) {
        suspicious.push(`compte de produits (${e.acctNum}) sur une ligne de règlement : ${k}`);
      }
    }
    console.log(`\n  Comptes distincts utilisés : ${Object.keys(m.accounts).length}`);
    for (const [num, a] of Object.entries(m.accounts).sort()) console.log(`     ${num}  ${a.name}  (Id ${a.id}, ${a.type})`);
    if (suspicious.length) {
      console.log(`\n  ⚠️  ${suspicious.length} mapping(s) à revoir (repris tels quels d'A2X) :`);
      for (const s of suspicious) console.log("     - " + s);
    }
    console.log();
    return;
  }

  console.log(`
  a2x.js — remplacement maison d'A2X (Shopify Payments → QuickBooks)

    node a2x/a2x.js payouts [--limit 20] [--since 2026-07-01]
    node a2x/a2x.js preview <payoutId>
    node a2x/a2x.js post <payoutId> [--force]
    node a2x/a2x.js sync [--since 2026-07-01] [--dry-run]
    node a2x/a2x.js check

  L'app web (visualisation + édition des mappings) : node a2x-app/server.js
`);
}

main().catch((e) => { console.error("\n  Erreur :", e.message, "\n"); process.exit(1); });
