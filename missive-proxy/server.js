/**
 * Lasclay — missive-proxy (v1)
 * --------------------------------------------------------------------------
 * Petit proxy HTTP entre Claude et l'API Missive. Le JETON MISSIVE reste ICI,
 * côté serveur (secret Render) et n'est JAMAIS renvoyé ni exposé. Claude appelle
 * ce proxy avec un PROXY_SECRET distinct (révocable, à périmètre limité) et ne
 * voit donc jamais la clé Missive.
 *
 * Périmètre volontairement RESTREINT (rien de destructeur d'emblée) :
 *   GET  /health                      → sonde (sans auth)
 *   POST /list       {filter}         → liste des conversations (ex. "shared_label=ID")
 *   POST /conversation {id}           → fil complet nettoyé (NOUS/EUX, daté)
 *   POST /note       {id, markdown}   → note interne (commentaire)
 *   POST /close      {id, note}       → ferme le fil (+ note)
 *   POST /reply      {id, from, to[], cc[], subject, body, send, closeAfter}
 *                                     → crée un brouillon (send=true pour envoyer),
 *                                       ferme après si closeAfter=true
 *
 * AUTH : chaque route (sauf /health) exige l'en-tête  X-Proxy-Secret: <PROXY_SECRET>.
 * Le proxy est public sur Render : ce secret est la seule porte. Révocable en
 * changeant la variable. Il ne déverrouille QUE ces quelques actions.
 *
 * Node 18+ (fetch natif). Aucune dépendance.
 *
 * Variables d'environnement (secrets Render) :
 *   MISSIVE_TOKEN   jeton API Missive (missive_pat-...)                 [requis]
 *   PROXY_SECRET    secret partagé que Claude envoie en en-tête         [requis]
 *   MISSIVE_ORG     id d'organisation (défaut Lasclay)               [facultatif]
 *   PORT            port d'écoute (fourni par Render)                 [auto]
 */

const http = require("node:http");

const TOKEN = process.env.MISSIVE_TOKEN;
const PROXY_SECRET = process.env.PROXY_SECRET;
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36"; // Lasclay
const PORT = process.env.PORT || 3000;
const API = "https://public.missiveapp.com/v1";

if (!TOKEN) { console.error("Manque MISSIVE_TOKEN."); process.exit(1); }
if (!PROXY_SECRET) { console.error("Manque PROXY_SECRET."); process.exit(1); }

const mHeaders = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Appels Missive (retry 429) ---
async function mGet(path, tries = 0) {
  await sleep(260);
  const res = await fetch(`${API}${path}`, { headers: mHeaders });
  if (res.status === 429 && tries < 3) { await sleep(30000); return mGet(path, tries + 1); }
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}
async function mSend(method, path, body, tries = 0) {
  await sleep(260);
  const res = await fetch(`${API}${path}`, { method, headers: mHeaders, body: JSON.stringify(body) });
  if (res.status === 429 && tries < 3) { await sleep(30000); return mSend(method, path, body, tries + 1); }
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  try { return JSON.parse(text); } catch { return {}; }
}

// --- Nettoyage HTML léger ---
function stripHtml(s) {
  if (!s) return "";
  let t = s.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  t = t.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, txt) => {
    const clean = txt.replace(/<[^>]+>/g, "").trim();
    return href && !href.startsWith("mailto:") && clean && !clean.includes(href) ? `${clean} (${href})` : (clean || href);
  });
  t = t.replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
       .replace(/&#39;|&rsquo;/gi, "'").replace(/&quot;/gi, '"');
  return t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

const SELF = (process.env.MISSIVE_SELF_ADDRESSES ||
  "hey@lasclay.com,admin@lasclay.com,operations@lasclay.com,info@lasclay.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const isUs = (m) => SELF.includes((m.from_field?.address || "").toLowerCase()) || !!m.author?.name;

// --- Handlers ---
async function listConversations(filter) {
  const byId = new Map();
  let until = null;
  while (true) {
    let path = `/conversations?${filter}&limit=50`;
    if (until) path += `&until=${until}`;
    const { conversations = [] } = await mGet(path);
    if (conversations.length === 0) break;
    for (const c of conversations) byId.set(c.id, { id: c.id, subject: c.subject || c.latest_message_subject || null, last_activity_at: c.last_activity_at });
    const oldest = conversations[conversations.length - 1].last_activity_at;
    if (conversations.length < 50 || oldest === until) break;
    until = oldest;
  }
  return [...byId.values()];
}

async function getConversation(id) {
  const { messages = [] } = await mGet(`/conversations/${id}/messages?limit=10`);
  const sorted = messages.slice().sort((a, b) => (a.delivered_at || a.created_at || 0) - (b.delivered_at || b.created_at || 0));
  const ids = sorted.map((m) => m.id).filter(Boolean);
  const bodies = new Map();
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    try {
      const r = await mGet(`/messages/${chunk.join(",")}`);
      const arr = Array.isArray(r.messages) ? r.messages : [r.messages];
      for (const m of arr) if (m && m.id) bodies.set(m.id, m.body || m.preview || "");
    } catch { /* on garde le preview */ }
  }
  return sorted.map((m) => {
    const ts = (m.delivered_at || m.created_at || 0) * 1000;
    return {
      from: m.from_field?.name || m.from_field?.address || "?",
      address: m.from_field?.address || null,
      us: isUs(m),
      date: ts ? new Date(ts).toISOString().slice(0, 10) : null,
      subject: m.subject || null,
      text: stripHtml(bodies.get(m.id) || m.body || m.preview || ""),
    };
  });
}

async function postNote(id, markdown) {
  return mSend("POST", "/posts", {
    posts: { conversation: id, organization: ORG,
      notification: { title: "Note", body: (markdown || "").slice(0, 100) }, markdown: markdown || "_(note)_" },
  });
}

async function closeConversation(id, note) {
  return mSend("POST", "/posts", {
    posts: { conversation: id, organization: ORG, close: true,
      notification: { title: "Fermé", body: (note || "Fil fermé").slice(0, 100) },
      markdown: note || "_Fil fermé._" },
  });
}

async function reply({ id, from, to, cc, subject, body, send, closeAfter }) {
  const draft = {
    conversation: id, organization: ORG,
    from_field: { address: from },
    to_fields: (to || []).map((a) => ({ address: a })),
    body: (body || "").replace(/\n/g, "<br>"),
  };
  if (subject) draft.subject = subject;
  if (cc && cc.length) draft.cc_fields = cc.map((a) => ({ address: a }));
  if (send) draft.send = true;
  const res = await mSend("POST", "/drafts", { drafts: draft });
  if (closeAfter) await closeConversation(id, "_Réponse envoyée, fil fermé._");
  return res;
}

// --- Serveur HTTP ---
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve(null); } });
  });
}
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true, service: "missive-proxy" });
    if (req.method !== "POST") return json(res, 404, { error: "not found" });

    // Auth
    if ((req.headers["x-proxy-secret"] || "") !== PROXY_SECRET) return json(res, 401, { error: "unauthorized" });

    const body = await readBody(req);
    if (body === null) return json(res, 400, { error: "invalid JSON" });
    const route = req.url.split("?")[0];

    if (route === "/list") {
      if (!body.filter) return json(res, 400, { error: "filter requis (ex. shared_label=ID)" });
      return json(res, 200, { conversations: await listConversations(body.filter) });
    }
    if (route === "/conversation") {
      if (!body.id) return json(res, 400, { error: "id requis" });
      return json(res, 200, { messages: await getConversation(body.id) });
    }
    if (route === "/note") {
      if (!body.id || !body.markdown) return json(res, 400, { error: "id et markdown requis" });
      await postNote(body.id, body.markdown); return json(res, 200, { ok: true });
    }
    if (route === "/close") {
      if (!body.id) return json(res, 400, { error: "id requis" });
      await closeConversation(body.id, body.note); return json(res, 200, { ok: true });
    }
    if (route === "/reply") {
      if (!body.id || !body.from || !body.body) return json(res, 400, { error: "id, from, body requis" });
      const r = await reply(body); return json(res, 200, { ok: true, sent: !!body.send, closed: !!body.closeAfter, draft: r.drafts?.id || null });
    }
    return json(res, 404, { error: "route inconnue" });
  } catch (e) {
    return json(res, 502, { error: String(e.message || e).slice(0, 300) });
  }
});

server.listen(PORT, () => console.log(`missive-proxy à l'écoute sur :${PORT}`));
