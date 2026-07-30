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
const { qbo, queryOne } = require(path.join(A2X, "lib/qbo"));
const { gid, tokenScopes, STORE, VER } = require(path.join(A2X, "lib/shopify"));
const mapper = require(path.join(A2X, "lib/mapper"));

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
async function computeJournal(ref) {
  const payout = await getPayout(ref);
  if (!payout) throw new Error(`Payout ${ref} introuvable.`);
  const btx = await payoutTransactions(payout.legacyResourceId);
  const orderIds = [...new Set(btx.map((t) => t.associatedOrder && t.associatedOrder.id).filter(Boolean))];
  const orders = await ordersByIds(orderIds);
  const byId = new Map(orders.map((o) => [String(gid(o.id)), o]));
  const journal = buildJournalEntry(payout, btx, byId);
  return { payout, journal, counts: { transactions: btx.length, orders: orders.length } };
}

async function findExisting(docNumber) {
  const esc = String(docNumber).replace(/'/g, "''");
  return queryOne(`select Id, DocNumber, TxnDate from JournalEntry where DocNumber = '${esc}'`);
}

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
  if (tax !== undefined) cols[5] = tax ? "detaxe" : "";
  lines[i] = cols.join("\t").replace(/\t+$/, "");
  fs.writeFileSync(TSV, lines.join("\n"));
  return lines[i];
}

/** Ajoute une règle à la fin du bloc de sa catégorie. */
function addTsvRule({ category, details, country, marketplace, acctNum, tax }) {
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
    // Une seule requête QBO pour savoir lesquels sont déjà comptabilisés.
    const res = await qbo("query", {
      query: `select Id, DocNumber, TxnDate from JournalEntry where DocNumber like 'A2XSH-%' orderby TxnDate desc maxresults 200`,
    });
    const posted = new Map();
    for (const je of (res.data && res.data.QueryResponse && res.data.QueryResponse.JournalEntry) || []) {
      const suffix = String(je.DocNumber).split("-").pop();
      posted.set(suffix, je);
    }
    return {
      payouts: payouts.map((p) => {
        const je = posted.get(String(p.legacyResourceId).slice(-3));
        return {
          id: String(p.legacyResourceId),
          issuedAt: p.issuedAt,
          status: p.status,
          net: parseFloat(p.net.amount),
          currency: p.net.currencyCode,
          posted: je ? { id: je.Id, docNumber: je.DocNumber, txnDate: je.TxnDate } : null,
        };
      }),
    };
  },

  "GET /api/payouts/:id": async (req, url, params) => {
    const { payout, journal, counts } = await computeJournal(params.id);
    const existing = await findExisting(journal.docNumber);
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
    };
  },

  "POST /api/payouts/:id/post": async (req, url, params, body) => {
    const { journal } = await computeJournal(params.id);
    if (!journal.balanced) throw new Error("Écriture non équilibrée — publication refusée.");
    if (journal.unmapped.length && !body.force) {
      throw new Error(`${journal.unmapped.length} composante(s) non mappée(s). Corrige les mappings, ou coche « forcer ».`);
    }
    const existing = await findExisting(journal.docNumber);
    if (existing && !body.force) return { created: false, existing, message: "Déjà publiée dans QuickBooks." };
    const res = await qbo("create", { entity: "journalentry", body: journal.body });
    const je = res.data && res.data.JournalEntry;
    return { created: true, id: je && je.Id, docNumber: journal.docNumber };
  },

  "GET /api/accounts": async (req, url) => ({ accounts: await chartOfAccounts(url.searchParams.get("refresh") === "1") }),

  "GET /api/mappings": async () => {
    const m = mapper.all();
    const rules = Object.values(m.index).map((e) => ({ ...e, kind: "rule" }));
    const defaults = Object.values(m.defaults).map((e) => ({ ...e, kind: "default" }));
    return {
      meta: { generatedAt: m.generatedAt, counts: m.counts, taxCodes: m.taxCodes },
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
  res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
  fs.createReadStream(full).pipe(res);
});

server.listen(PORT, () => {
  console.log(`a2x-app sur le port ${PORT}${SECRET ? "" : " — ⚠️  A2X_APP_SECRET non défini, l'interface est ouverte"}`);
});
