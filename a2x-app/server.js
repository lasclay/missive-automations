/**
 * a2x-app — l'interface web du remplacement d'A2X.
 *
 * Visualiser les payouts Shopify, prévisualiser l'écriture de journal, la publier
 * dans QuickBooks, et éditer les mappings de comptes. Aucune dépendance npm :
 * http natif + une page unique, pour tenir sur un service Render gratuit.
 *
 * Variables :
 *   PORT                      (Render le fournit)
 *   A2X_APP_SECRET            mot de passe de l'interface (obligatoire hors localhost)
 *   SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET  (ou SHOPIFY_ADMIN_TOKEN)
 *   FINANCE_PROXY_URL, FINANCE_PROXY_SECRET
 *   GITHUB_TOKEN, GITHUB_REPO (facultatif : versionne mappings.tsv à chaque sauvegarde)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const A2X = path.join(__dirname, "..", "a2x");
const { listPayouts, getPayout, payoutTransactions } = require(path.join(A2X, "lib/payouts"));
const { ordersByIds } = require(path.join(A2X, "lib/orders"));
const { buildJournalEntry } = require(path.join(A2X, "lib/journal"));
const { rawCsv } = require(path.join(A2X, "lib/rawcsv"));
const { qbo } = require(path.join(A2X, "lib/qbo"));
const { monthRange, recentMonths, ordersForMonth, buildMonthlyEntry } = require(path.join(A2X, "lib/monthly"));
const { postedJournals, findExisting, relatedByPeriod, invalidate, monthlyJournals, findExistingMonthly } = require(path.join(A2X, "lib/posted"));
const { gid, tokenScopes, STORE, VER } = require(path.join(A2X, "lib/shopify"));
const mapper = require(path.join(A2X, "lib/mapper"));
const config = require(path.join(A2X, "config.json"));

const PORT = process.env.PORT || 3000;
const SECRET = process.env.A2X_APP_SECRET || "";
const TSV = path.join(A2X, "mappings.tsv");
const PUBLIC = path.join(__dirname, "public");

// ---------------------------------------------------------------- utilitaires

const json = (res, code, body) => {
  const b = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(b) });
  res.end(b);
};

function authorized(req) {
  if (!SECRET) return true;
  const h = req.headers["x-app-secret"] || "";
  return h === SECRET;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) {
    chunks.push(c);
    if (chunks.reduce((n, x) => n + x.length, 0) > 2 * 1024 * 1024) throw new Error("Corps de requête trop gros.");
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/** Recharge mappings.json depuis le TSV (après édition), sans repasser par QBO. */
function regenerate() {
  delete require.cache[require.resolve(path.join(A2X, "lib/mapper"))];
  const { execFileSync } = require("child_process");
  execFileSync(process.execPath, [path.join(A2X, "tools/import_mappings.js"), "--offline"], { stdio: "pipe" });
  delete require.cache[require.resolve(path.join(A2X, "lib/mapper"))];
  return require(path.join(A2X, "lib/mapper"));
}

/** Versionne mappings.tsv sur GitHub si un jeton est configuré (Render a un disque éphémère). */
async function commitToGithub(message) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || "lasclay/missive-automations";
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!token) return { pushed: false, reason: "GITHUB_TOKEN absent — sauvegarde locale seulement (perdue au prochain déploiement)." };
  const api = `https://api.github.com/repos/${repo}/contents/a2x/mappings.tsv`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "a2x-app" };
  const cur = await fetch(`${api}?ref=${branch}`, { headers });
  const sha = cur.ok ? (await cur.json()).sha : undefined;
  const res = await fetch(api, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ message, branch, sha, content: fs.readFileSync(TSV).toString("base64") }),
  });
  if (!res.ok) return { pushed: false, reason: `GitHub ${res.status} ${(await res.text()).slice(0, 200)}` };
  return { pushed: true, reason: `Commit sur ${repo}@${branch}.` };
}

// ------------------------------------------------------------------- domaine

/** Payout + transactions + commandes + écriture calculée. */
async function computeJournal(ref, opts = {}) {
  const payout = await getPayout(ref);
  if (!payout) throw new Error(`Payout ${ref} introuvable.`);
  const btx = await payoutTransactions(payout.legacyResourceId);
  const orderIds = [...new Set(btx.map((t) => t.associatedOrder && t.associatedOrder.id).filter(Boolean))];
  const orders = await ordersByIds(orderIds);
  const byId = new Map(orders.map((o) => [String(gid(o.id)), o]));
  const journal = buildJournalEntry(payout, btx, byId, opts);
  const rebuild = (o) => buildJournalEntry(payout, btx, byId, o);
  return { payout, journal, rebuild, counts: { transactions: btx.length, orders: orders.length } };
}

/**
 * Publie l'écriture, en allégeant le bloc de taxe si QuickBooks le refuse.
 *
 * Le bloc a été relevé sur les écritures d'A2X telles que QBO les RENVOIE
 * (TaxCodeRef + TaxApplicableOn + TaxAmount) ; en création il répond « erreur
 * lors du calcul de la taxe ». On réessaie donc avec le code de taxe seul, puis
 * sans code du tout. Les MONTANTS sont identiques dans les trois cas — seule
 * l'annotation de taxe de la ligne change — donc dégrader ne fausse aucun
 * chiffre. Le mode retenu est renvoyé pour qu'on sache lequel a marché.
 */
const TAX_MODES = ["full", "code", "none"];
const isTaxFault = (e) => /taxe|\btax\b/i.test(String(e && e.message));

async function createJournal(journal, rebuild) {
  const start = Math.max(0, TAX_MODES.indexOf(config.taxCodeMode || "full"));
  let lastErr;
  for (const mode of TAX_MODES.slice(start)) {
    const body = mode === (config.taxCodeMode || "full") ? journal.body : rebuild({ taxMode: mode }).body;
    try {
      const res = await qbo("create", { entity: "journalentry", body });
      return { je: res.data && res.data.JournalEntry, taxMode: mode };
    } catch (e) {
      lastErr = e;
      if (!isTaxFault(e)) throw e;
      console.warn(`QBO refuse le bloc de taxe en mode « ${mode} » — nouvel essai en mode dégradé.`);
    }
  }
  throw lastErr;
}

/**
 * Comme A2X, une composante sans compte BLOQUE la publication : mieux vaut une
 * écriture manquante qu'une écriture fausse. Le message nomme ce qui manque —
 * A2X, lui, se contentait de refuser.
 */
function unmappedError(unmapped) {
  const quoi = unmapped.slice(0, 6).map((u) => `· ${u.description} (${u.amount.toFixed(2)} $)`).join("\n");
  const reste = unmapped.length > 6 ? `\n· …et ${unmapped.length - 6} autre(s)` : "";
  return new Error(
    `${unmapped.length} composante(s) sans compte — publication bloquée :\n${quoi}${reste}\n` +
    `Ajoute la règle dans l'onglet Mappings (bouton « Créer la règle »), ou coche « forcer » pour publier sans ces lignes.`
  );
}

// L'appariement des écritures déjà comptabilisées vit dans a2x/lib/posted.js,
// partagé avec le CLI (voir l'en-tête du module : le suffixe du DocNumber d'A2X
// n'est pas exploitable, on apparie sur la période puis sur le montant déposé).

let accountsCache = null;
async function chartOfAccounts(force = false) {
  if (accountsCache && !force) return accountsCache;
  const res = await qbo("query", { query: "select Id, Name, AcctNum, AccountType, Active from Account maxresults 500" });
  const list = (res.data && res.data.QueryResponse && res.data.QueryResponse.Account) || [];
  accountsCache = list
    .filter((a) => a.Active !== false)
    .map((a) => ({ id: a.Id, num: a.AcctNum || "", name: a.Name, type: a.AccountType }))
    .sort((a, b) => (a.num || "zzz").localeCompare(b.num || "zzz"));
  return accountsCache;
}

/** Applique une modification à une ligne du TSV (repérée par son numéro de ligne). */
function editTsvLine(lineNo, { acctNum, tax }) {
  const lines = fs.readFileSync(TSV, "utf8").split("\n");
  const i = lineNo - 1;
  if (i < 0 || i >= lines.length) throw new Error(`Ligne ${lineNo} hors du fichier.`);
  const cols = lines[i].split("\t");
  if (cols.length < 4) throw new Error(`Ligne ${lineNo} n'est pas une règle.`);
  while (cols.length < 6) cols.push("");
  if (acctNum !== undefined) cols[4] = acctNum || "";
  // La colonne accepte « <idDuCode>:Sales » ; vide = aucune taxe.
  if (tax !== undefined) cols[5] = tax || "";
  lines[i] = cols.join("\t").replace(/\t+$/, "");
  fs.writeFileSync(TSV, lines.join("\n"));
  return lines[i];
}

/** Ajoute une règle à la fin du bloc de sa catégorie. */
function addTsvRule({ category, details, country, marketplace, acctNum, tax }) {
  // Une nouvelle règle part sur « Détaxé on Sales » comme les autres lignes de
  // revenu, sauf choix explicite — c'est le cas de très loin le plus fréquent.
  if (tax === undefined) tax = config.defaultTaxOption || "";
  const lines = fs.readFileSync(TSV, "utf8").split("\n");
  let last = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i].startsWith(category + "\t")) last = i;
  if (last === -1) throw new Error(`Catégorie « ${category} » absente du fichier.`);
  const row = [category, details, country || "-", marketplace || "-", acctNum || "", tax ? "detaxe" : ""].join("\t").replace(/\t+$/, "");
  lines.splice(last + 1, 0, row);
  fs.writeFileSync(TSV, lines.join("\n"));
  return { line: last + 2, row };
}

// -------------------------------------------------------------------- routes

const routes = {
  "GET /api/health": async () => ({
    ok: true,
    service: "a2x-app",
    mappings: mapper.meta(),
    shopify: !!process.env.SHOPIFY_STORE,
    qbo: !!process.env.FINANCE_PROXY_URL,
    github: !!process.env.GITHUB_TOKEN,
  }),

  /** Diagnostic : ce que le jeton Shopify contient vraiment, ici et maintenant. */
  "GET /api/shopify": async () => {
    const info = await tokenScopes();
    return { store: STORE, apiVersion: VER, ...info };
  },

  "GET /api/payouts": async (req, url) => {
    const limit = parseInt(url.searchParams.get("limit") || "25", 10);
    const since = url.searchParams.get("since") || null;
    const payouts = await listPayouts({ limit, since });
    // Une seule requête QBO, puis appariement par montant déposé + fenêtre de dates.
    // La liste ne connaît pas la période exacte d'un versement (il faudrait ses
    // transactions de solde) : l'appariement fin par période se fait à l'ouverture
    // du versement, dans GET /api/payouts/:id.
    const all = await postedJournals(url.searchParams.get("refresh") === "1");
    const used = new Set();
    return {
      payouts: payouts.map((p) => {
        const payoutId = String(p.legacyResourceId);
        const cents = Math.round(parseFloat(p.net.amount) * 100);
        const end = new Date(p.issuedAt);
        // Nos écritures portent l'id du versement : certitude. Sinon, celles
        // d'A2X ne sont reconnaissables qu'au montant déposé.
        let je = all.find((j) => j.payoutId && j.payoutId === payoutId);
        let match = je ? "id du versement" : "montant";
        if (!je) {
          je = all.find((j) => {
            if (used.has(j.id) || j.settlementCents !== cents) return false;
            if (!j.txnDate) return true;
            const days = (end - new Date(j.txnDate)) / 86400000;
            return days >= -2 && days <= 21;
          });
        }
        if (je) used.add(je.id);
        return {
          id: payoutId,
          issuedAt: p.issuedAt,
          status: p.status,
          net: parseFloat(p.net.amount),
          currency: p.net.currencyCode,
          posted: je ? { id: je.id, docNumber: je.docNumber, txnDate: je.txnDate, source: je.source, match } : null,
        };
      }),
    };
  },

  /** Données brutes du versement, au format « raw data » d'A2X. */
  "GET /api/payouts/:id/raw": async (req, url, params) => {
    const payout = await getPayout(params.id);
    if (!payout) throw new Error(`Versement ${params.id} introuvable.`);
    const btx = await payoutTransactions(payout.legacyResourceId);
    const ids = [...new Set(btx.map((t) => t.associatedOrder && t.associatedOrder.id).filter(Boolean))];
    const orders = await ordersByIds(ids);
    return { csv: rawCsv(payout, btx, new Map(orders.map((o) => [String(gid(o.id)), o]))) };
  },

  "GET /api/payouts/:id": async (req, url, params) => {
    const { payout, journal, counts } = await computeJournal(params.id);
    const existing = await findExisting({ docNumber: journal.docNumber, settlement: journal.settlement, issuedAt: payout.issuedAt, payoutId: journal.payoutId });
    const related = await relatedByPeriod({ docNumber: journal.docNumber, settlement: journal.settlement, issuedAt: payout.issuedAt });
    return {
      payout: { id: String(payout.legacyResourceId), issuedAt: payout.issuedAt, status: payout.status, net: parseFloat(payout.net.amount), currency: payout.net.currencyCode },
      counts,
      journal: {
        docNumber: journal.docNumber, period: journal.period, balanced: journal.balanced,
        settlement: journal.settlement, payoutNet: journal.payoutNet, drift: journal.drift,
        unmapped: journal.unmapped, notes: [...new Set(journal.notes)],
        lines: journal.body.Line.map((l) => ({
          description: l.Description,
          amount: l.Amount,
          posting: l.JournalEntryLineDetail.PostingType,
          accountId: l.JournalEntryLineDetail.AccountRef.value,
          tax: !!l.JournalEntryLineDetail.TaxCodeRef,
        })),
        body: journal.body,
      },
      existing,
      related,
    };
  },

  "POST /api/payouts/:id/post": async (req, url, params, body) => {
    const computed = await computeJournal(params.id);
    const { payout, journal } = computed;
    if (!journal.balanced) throw new Error("Écriture non équilibrée — publication refusée.");
    if (journal.unmapped.length && !body.force) throw unmappedError(journal.unmapped);
    // On relit QBO au moment de publier : le cache pourrait masquer une écriture
    // créée entre-temps (par A2X, ou dans un autre onglet).
    const existing = await findExisting(
      { docNumber: journal.docNumber, settlement: journal.settlement, issuedAt: payout.issuedAt, payoutId: journal.payoutId },
      true
    );
    if (existing && !body.force) {
      return { created: false, existing, message: `Déjà publiée dans QuickBooks (${existing.docNumber}, appariée par ${existing.match}).` };
    }
    const { je, taxMode } = await createJournal(journal, computed.rebuild);
    invalidate();
    return { created: true, id: je && je.Id, docNumber: journal.docNumber, taxMode };
  },

  /**
   * Publication en lot. Séquentielle et non transactionnelle : chaque versement
   * est traité indépendamment, et on renvoie le sort de chacun. Un échec
   * n'interrompt pas les suivants — mais tout ce qui a été créé l'est vraiment.
   */
  "POST /api/payouts/post-batch": async (req, url, params, body) => {
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    if (!ids.length) throw new Error("Aucun versement sélectionné.");
    if (ids.length > 50) throw new Error("Maximum 50 versements par lot.");

    const results = [];
    for (const id of ids) {
      try {
        const computed = await computeJournal(id);
        const { payout, journal } = computed;
        if (!journal.balanced) { results.push({ id, ok: false, reason: "écriture non équilibrée" }); continue; }
        if (journal.unmapped.length && !body.force) {
          results.push({ id, ok: false, reason: unmappedError(journal.unmapped).message, unmapped: journal.unmapped });
          continue;
        }
        const existing = await findExisting(
          { docNumber: journal.docNumber, settlement: journal.settlement, issuedAt: payout.issuedAt, payoutId: journal.payoutId },
          true
        );
        if (existing && !body.force) {
          results.push({ id, ok: false, skipped: true, reason: `déjà couvert par ${existing.docNumber} (pièce ${existing.id})` });
          continue;
        }
        const { je, taxMode } = await createJournal(journal, computed.rebuild);
        invalidate();
        results.push({ id, ok: true, pieceId: je && je.Id, docNumber: journal.docNumber, amount: journal.settlement, taxMode });
      } catch (e) {
        results.push({ id, ok: false, reason: e.message });
      }
    }
    return {
      results,
      created: results.filter((r) => r.ok).length,
      skipped: results.filter((r) => r.skipped).length,
      failed: results.filter((r) => !r.ok && !r.skipped).length,
    };
  },

  /**
   * Les mois et leur état — une seule requête QuickBooks, aucune requête
   * Shopify : de quoi voir d'un coup d'œil ce qu'A2X couvrait et ce qui reste à
   * faire depuis la résiliation, sans attendre le calcul des écritures.
   */
  "GET /api/monthly": async (req, url) => {
    const n = Math.min(36, parseInt(url.searchParams.get("months") || "13", 10));
    const force = url.searchParams.get("refresh") === "1";
    await postedJournals(force);
    const months = [];
    for (const m of recentMonths(n)) {
      const { mine, a2x } = await monthlyJournals(m);
      months.push({
        month: m,
        ...monthRange(m),
        mine: mine ? { id: mine.id, docNumber: mine.docNumber, txnDate: mine.txnDate } : null,
        a2x: a2x.map((j) => ({ id: j.id, docNumber: j.docNumber, txnDate: j.txnDate })),
      });
    }
    return { months };
  },

  /** Aperçu de l'écriture mensuelle hors Shopify Payments (lent : balaie les commandes). */
  "GET /api/monthly/:month": async (req, url, params) => {
    const orders = await ordersForMonth(params.month);
    const journal = buildMonthlyEntry(params.month, orders);
    const existing = await findExistingMonthly(params.month);
    const { a2x } = await monthlyJournals(params.month);
    return {
      month: journal.month,
      counts: { scanned: orders.length, kept: journal.orders.length },
      journal: {
        docNumber: journal.docNumber, period: journal.period, balanced: journal.balanced,
        total: journal.total, gateways: journal.gateways,
        unmapped: journal.unmapped, notes: [...new Set(journal.notes)].slice(0, 25),
        orders: journal.orders,
        lines: journal.body.Line.map((l) => ({
          description: l.Description,
          amount: l.Amount,
          posting: l.JournalEntryLineDetail.PostingType,
          accountId: l.JournalEntryLineDetail.AccountRef.value,
          tax: !!l.JournalEntryLineDetail.TaxCodeRef,
        })),
      },
      existing,
      a2x: a2x.map((j) => ({ id: j.id, docNumber: j.docNumber, txnDate: j.txnDate })),
    };
  },

  "POST /api/monthly/:month/post": async (req, url, params, body) => {
    const orders = await ordersForMonth(params.month);
    const journal = buildMonthlyEntry(params.month, orders);
    if (!journal.balanced) throw new Error("Écriture non équilibrée — publication refusée.");
    if (journal.unmapped.length && !body.force) throw unmappedError(journal.unmapped);
    const existing = await findExistingMonthly(params.month, true);
    if (existing && !body.force) {
      return { created: false, existing, message: `Ce mois est déjà couvert (${existing.docNumber}, ${existing.match}).` };
    }
    const { je, taxMode } = await createJournal(journal, (o) => buildMonthlyEntry(params.month, orders, o));
    invalidate();
    return { created: true, id: je && je.Id, docNumber: journal.docNumber, taxMode };
  },

  "GET /api/accounts": async (req, url) => ({ accounts: await chartOfAccounts(url.searchParams.get("refresh") === "1") }),

  "GET /api/mappings": async () => {
    const m = mapper.all();
    const rules = Object.values(m.index).map((e) => ({ ...e, kind: "rule" }));
    const defaults = Object.values(m.defaults).map((e) => ({ ...e, kind: "default" }));
    return {
      meta: { generatedAt: m.generatedAt, counts: m.counts, taxCodes: m.taxCodes },
      taxOptions: m.taxOptions || [],
      defaultTaxOption: config.defaultTaxOption || "",
      categories: [...new Set([...defaults, ...rules].map((e) => e.category))],
      mappings: [...defaults, ...rules].sort((a, b) =>
        a.category.localeCompare(b.category, "fr") || a.details.localeCompare(b.details, "fr")),
    };
  },

  "PUT /api/mappings": async (req, url, params, body) => {
    const edits = Array.isArray(body.edits) ? body.edits : [];
    if (!edits.length) throw new Error("Aucune modification transmise.");
    for (const e of edits) editTsvLine(e.line, { acctNum: e.acctNum, tax: e.tax });
    const m = regenerate();
    const git = await commitToGithub(`a2x: ${edits.length} mapping(s) modifié(s) via l'interface`);
    return { saved: edits.length, meta: m.meta(), git };
  },

  "POST /api/mappings": async (req, url, params, body) => {
    const added = addTsvRule(body);
    const m = regenerate();
    const git = await commitToGithub(`a2x: nouvelle règle ${body.category} / ${body.details}`);
    return { added, meta: m.meta(), git };
  },

  "GET /api/mappings.tsv": async () => ({ tsv: fs.readFileSync(TSV, "utf8") }),
};

function match(method, pathname) {
  const direct = routes[`${method} ${pathname}`];
  if (direct) return { handler: direct, params: {} };
  for (const [spec, handler] of Object.entries(routes)) {
    const [m, pattern] = spec.split(" ");
    if (m !== method || !pattern.includes(":")) continue;
    const p = pattern.split("/"), a = pathname.split("/");
    if (p.length !== a.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < p.length; i++) {
      if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(a[i]);
      else if (p[i] !== a[i]) { ok = false; break; }
    }
    if (ok) return { handler, params };
  }
  return null;
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/health") return json(res, 200, { ok: true, service: "a2x-app" });

  if (pathname.startsWith("/api/")) {
    const hit = match(req.method, pathname);
    if (!hit) return json(res, 404, { error: "Route inconnue." });
    if (pathname !== "/api/health" && !authorized(req)) return json(res, 401, { error: "Mot de passe requis." });
    try {
      const body = req.method === "GET" ? {} : await readBody(req);
      const out = await hit.handler(req, url, hit.params, body);
      return json(res, 200, out);
    } catch (e) {
      console.error(`${req.method} ${pathname} →`, e.message);
      return json(res, 400, { error: e.message });
    }
  }

  // Fichiers statiques (index.html par défaut).
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }
  // Pas de cache : l'interface évolue souvent, et une page périmée donne
  // l'impression qu'un correctif déployé n'a pas été appliqué.
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(full)] || "application/octet-stream",
    "Cache-Control": "no-cache, must-revalidate",
  });
  fs.createReadStream(full).pipe(res);
});

server.listen(PORT, () => {
  console.log(`a2x-app sur le port ${PORT}${SECRET ? "" : " — ⚠️  A2X_APP_SECRET non défini, l'interface est ouverte"}`);
});
