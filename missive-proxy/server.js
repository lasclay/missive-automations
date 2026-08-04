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
 *   POST /structure  {}               → carte de la boîte : organisations, équipes,
 *                                       étiquettes partagées (avec hiérarchie), membres.
 *                                       Chaque bloc dégrade seul → champ `errors`.
 *   POST /list       {filter}         → liste des conversations (ex. "shared_label=ID")
 *   POST /conversation {id}           → fil complet nettoyé (NOUS/EUX, daté)
 *   POST /drafts     {id}             → brouillons laissés par le script IA (réponse déjà rédigée)
 *   POST /comments   {id}             → notes internes (commentaires) — dégrade si non listable
 *   POST /users      {}               → membres de l'org (id, nom, courriel) pour les assignations
 *   POST /task       {id, title, assignees[], label} → crée une tâche (assignée si assignees); renvoie taskId
 *   POST /task-state {taskId, state}  → change l'état d'une tâche (todo|in_progress|closed=accomplie)
 *   POST /postraw    {id}             → post brut (pour retrouver l'id de tâche d'un post existant)
 *   POST /note       {id, markdown}   → note interne (commentaire)
 *   POST /close      {id, note}       → ferme le fil (+ note)
 *   POST /reply      {id, from, to[], cc[], subject, body, send, closeAfter,
 *                     attachments[]}  → crée un brouillon (send=true pour envoyer),
 *                                       ferme après si closeAfter=true.
 *                                       attachments: [{base64_data, filename}] (≤ ~20 Mo au total)
 *
 * AUTH : chaque route (sauf /health) exige l'en-tête  X-Proxy-Secret: <PROXY_SECRET>.
 * Le proxy est public sur Render : ce secret est la seule porte. Révocable en
 * changeant la variable. Il ne déverrouille QUE ces quelques actions.
 *
 * Node 18+ (fetch natif). Aucune dépendance.
 *
 * Variables d'environnement (secrets Render) :
 *   MISSIVE_TOKEN         jeton API Missive (missive_pat-...)                 [requis]
 *   MISSIVE_PROXY_SECRET  secret que Claude envoie en en-tête (repli PROXY_SECRET)  [requis]
 *   MISSIVE_ORG     id d'organisation (défaut Lasclay)               [facultatif]
 *   PORT            port d'écoute (fourni par Render)                 [auto]
 */

const http = require("node:http");

const TOKEN = process.env.MISSIVE_TOKEN;
const PROXY_SECRET = process.env.MISSIVE_PROXY_SECRET || process.env.PROXY_SECRET;
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36"; // Lasclay
const PORT = process.env.PORT || 3000;
const API = "https://public.missiveapp.com/v1";

if (!TOKEN) { console.error("Manque MISSIVE_TOKEN."); process.exit(1); }
if (!PROXY_SECRET) { console.error("Manque MISSIVE_PROXY_SECRET (ou PROXY_SECRET)."); process.exit(1); }

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

// `limit` plafonnait à 10 messages : sur un fil de 25, on répondait en n'ayant lu que les 10
// derniers, sans le savoir. La profondeur est maintenant réglable, et `tronque` dit franchement
// qu'il reste des messages non lus au lieu de laisser croire au fil complet.
async function getConversation(id, limit) {
  // L'API Missive REFUSE limit > 10 sur les messages. Pour remonter un fil complet il faut
  // paginer avec `until`, exactement comme listConversations le fait pour les conversations.
  const vise = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 200);
  const parId = new Map();
  let until = null;
  while (parId.size < vise) {
    let p = `/conversations/${id}/messages?limit=10`;
    if (until) p += `&until=${until}`;
    const { messages: lot = [] } = await mGet(p);
    if (!lot.length) break;
    for (const m of lot) parId.set(m.id, m);
    const plusVieux = lot[lot.length - 1].delivered_at || lot[lot.length - 1].created_at;
    if (lot.length < 10 || plusVieux === until) break;
    until = plusVieux;
  }
  const messages = [...parId.values()];
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
  const out = sorted.map((m) => {
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
  // On s'est arrêté au plafond demandé => il reste probablement des messages avant.
  out.tronque = messages.length >= vise;
  return out;
}

// Le listage des brouillons ne renvoie qu'un `preview` tronqué (~130 caractères), jamais le
// corps complet — comme pour les messages. On va donc chercher le corps un brouillon à la fois,
// sinon on ne peut pas relire un brouillon avant de l'envoyer. Les routes possibles diffèrent
// selon la ressource, d'où la chaîne d'essais; à défaut on dégrade sur le preview.
async function fetchDraftBody(draftId) {
  for (const path of [`/drafts/${draftId}`, `/messages/${draftId}`]) {
    try {
      const r = await mGet(path);
      const d = r.drafts || r.messages || r.draft || r.message;
      const one = Array.isArray(d) ? d[0] : d;
      if (one && (one.body || one.preview)) return one.body || one.preview;
    } catch { /* on essaie la route suivante */ }
  }
  return null;
}

// Brouillons laissés par le script IA (support.js) — la réponse déjà rédigée.
async function getDrafts(id, raw) {
  const { drafts = [] } = await mGet(`/conversations/${id}/drafts?limit=10`);
  if (raw) return { raw: drafts };
  const sorted = drafts.slice().sort((a, b) => (a.delivered_at || a.created_at || 0) - (b.delivered_at || b.created_at || 0));
  const bodies = new Map();
  for (const d of sorted) {
    if (d.body) continue;
    const b = await fetchDraftBody(d.id);
    if (b) bodies.set(d.id, b);
  }
  return sorted.map((d) => {
    const ts = (d.delivered_at || d.created_at || 0) * 1000;
    const body = d.body || bodies.get(d.id) || "";
    return {
      id: d.id,
      from: d.from_field?.address || null,
      to: (d.to_fields || []).map((f) => f.address).filter(Boolean),
      subject: d.subject || null,
      date: ts ? new Date(ts).toISOString().slice(0, 10) : null,
      body: stripHtml(body),
      // Vrai quand seul le preview tronqué a pu être récupéré : le brouillon N'EST PAS
      // relisible en entier, donc pas envoyable les yeux fermés.
      tronque: !body || (!d.body && !bodies.has(d.id)) ? true : undefined,
      preview: d.preview || null,
    };
  });
}

// Notes internes (commentaires/posts) laissées par le script IA ou l'équipe.
// L'endpoint de listage des commentaires n'est pas garanti par l'API publique :
// on dégrade proprement (liste vide + note) plutôt que d'échouer en 502.
async function getComments(id) {
  try {
    const { comments = [] } = await mGet(`/conversations/${id}/comments?limit=10`);
    const sorted = comments.slice().sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    return { comments: sorted.map((c) => {
      const ts = (c.created_at || 0) * 1000;
      return {
        id: c.id,
        author: c.author?.name || c.author?.email || c.author?.address || null,
        date: ts ? new Date(ts).toISOString().slice(0, 10) : null,
        text: stripHtml(c.body || c.markdown || c.text || ""),
      };
    }) };
  } catch (e) {
    return { comments: [], note: `Commentaires non listables via l'API (${String(e.message || e).slice(0, 120)}).` };
  }
}

// Membres de l'organisation (pour retrouver un id d'assigné : Gabriel, Catherine...).
async function listUsers() {
  const { users = [] } = await mGet(`/users?limit=200`);
  return users.map((u) => ({ id: u.id, name: u.name || null, email: u.email || null }));
}

// Carte de la boîte : les Resource ID dont Claude a besoin avant tout filtre utile.
// Aucune donnée client là-dedans — que de la structure, donc mettable en cache dans le dépôt.
// Chaque bloc est isolé : une permission manquante sur un type laisse les autres exploitables.
async function getStructure() {
  const errors = {};
  const safe = async (key, fn, fallback) => {
    try { return await fn(); }
    catch (e) { errors[key] = String(e.message || e).slice(0, 200); return fallback; }
  };

  // Les listes Missive paginent par `offset`; on s'arrête à la page incomplète.
  // Déduplication par id : si un endpoint ignore `offset`, on ne double pas la liste.
  const pages = async (path, field) => {
    const byId = new Map();
    for (let offset = 0; offset < 2000; offset += 200) {
      const r = await mGet(`${path}${path.includes("?") ? "&" : "?"}limit=200&offset=${offset}`);
      const batch = r[field] || [];
      const before = byId.size;
      for (const item of batch) if (item && item.id) byId.set(item.id, item);
      if (batch.length < 200 || byId.size === before) break;
    }
    return [...byId.values()];
  };

  const organizations = await safe("organizations",
    async () => (await pages("/organizations", "organizations")).map((o) => ({ id: o.id, name: o.name || null })), []);

  const teams = await safe("teams",
    async () => (await pages(`/teams?organization=${ORG}`, "teams")).map((t) => ({
      id: t.id, name: t.name || null, organization: t.organization || ORG,
    })), []);

  const shared_labels = await safe("shared_labels",
    async () => (await pages(`/shared_labels?organization=${ORG}`, "shared_labels")).map((l) => ({
      id: l.id,
      name: l.name || null,
      name_with_parent_names: l.name_with_parent_names || l.name || null,
      parent_id: l.parent_id || null,
      organization: l.organization || ORG,
      visibility: l.visibility || null,
      archived: !!l.archived,
    })), []);

  const users = await safe("users", listUsers, []);

  return { organization: ORG, organizations, teams, shared_labels, users, errors };
}

// Crée une TÂCHE sur un fil, éventuellement assignée à des utilisateurs.
// add_assignees exige `organization` (toujours envoyé). Les assignés existants restent.
async function createTask({ id, title, assignees, label, markdown }) {
  const t = String(title || "").slice(0, 1000);
  const post = {
    conversation: id, organization: ORG,
    task: { title: t, state: "todo" },
    // Missive exige un corps (text/markdown/attachments) même pour une tâche.
    markdown: String(markdown || t) || "Tâche",
    notification: { title: "Tâche créée", body: t.slice(0, 120) || "Tâche" },
  };
  if (Array.isArray(assignees) && assignees.length) post.add_assignees = assignees;
  if (label) post.add_shared_labels = [label];
  return mSend("POST", "/posts", { posts: post });
}

// Récupère un post brut (pour retrouver l'id de tâche d'un post créé).
async function getPost(id) { return mGet(`/posts/${id}`); }

// Change l'état d'une tâche existante : "todo" | "in_progress" | "closed" (= accomplie).
async function setTaskState({ taskId, state, conversation, markdown }) {
  const st = state || "closed";
  const post = {
    organization: ORG,
    task: { id: taskId, state: st },
    markdown: markdown || (st === "closed" ? "_Tâche accomplie._" : `_Tâche : ${st}._`),
    notification: { title: "Tâche mise à jour", body: st === "closed" ? "Accomplie" : st },
  };
  if (conversation) post.conversation = conversation;
  return mSend("POST", "/posts", { posts: post });
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

// Étiquettes partagées d'un fil. `close` ne touche pas aux étiquettes, et support.js ne retire
// « Draft AI Support » que des fils fermés : sans cette route, un fil répondu mais laissé ouvert
// (parce qu'un envoi reste dû) garde son étiquette de brouillon indéfiniment.
// `keepClosed` reprend la mécanique de support.js : sur un fil déjà fermé, poster sans ce drapeau
// le rouvrirait.
async function setLabels({ id, add, remove, markdown, keepClosed }) {
  const post = {
    conversation: id, organization: ORG,
    markdown: markdown || "_Étiquettes mises à jour._",
    notification: { title: "Étiquettes", body: (markdown || "Étiquettes mises à jour").slice(0, 100) },
  };
  if (Array.isArray(add) && add.length) post.add_shared_labels = add;
  if (Array.isArray(remove) && remove.length) post.remove_shared_labels = remove;
  if (keepClosed) post.reopen = true;
  return mSend("POST", "/posts", { posts: post });
}

async function reply({ id, from, to, cc, subject, body, send, closeAfter, attachments }) {
  const draft = {
    conversation: id, organization: ORG,
    from_field: { address: from },
    to_fields: (to || []).map((a) => ({ address: a })),
    body: (body || "").replace(/\n/g, "<br>"),
  };
  if (subject) draft.subject = subject;
  if (cc && cc.length) draft.cc_fields = cc.map((a) => ({ address: a }));
  if (Array.isArray(attachments) && attachments.length) {
    draft.attachments = attachments
      .filter((a) => a && a.base64_data && a.filename)
      .map((a) => ({ base64_data: a.base64_data, filename: String(a.filename).slice(0, 255) }));
  }
  if (send) draft.send = true;
  const res = await mSend("POST", "/drafts", { drafts: draft });
  if (closeAfter) await closeConversation(id, "_Réponse envoyée, fil fermé._");
  return res;
}

// --- Serveur HTTP ---
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 30e6) req.destroy(); }); // 30 Mo : laisse passer les pièces jointes base64
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

    if (route === "/structure") {
      return json(res, 200, await getStructure());
    }
    if (route === "/list") {
      if (!body.filter) return json(res, 400, { error: "filter requis (ex. shared_label=ID)" });
      return json(res, 200, { conversations: await listConversations(body.filter) });
    }
    if (route === "/conversation") {
      if (!body.id) return json(res, 400, { error: "id requis" });
      const msgs = await getConversation(body.id, body.limit);
      return json(res, 200, { messages: msgs, tronque: msgs.tronque || undefined });
    }
    if (route === "/drafts") {
      if (!body.id) return json(res, 400, { error: "id requis" });
      const d = await getDrafts(body.id, body.raw);
      return json(res, 200, body.raw ? d : { drafts: d });
    }
    if (route === "/comments") {
      if (!body.id) return json(res, 400, { error: "id requis" });
      return json(res, 200, await getComments(body.id));
    }
    if (route === "/users") {
      return json(res, 200, { users: await listUsers() });
    }
    if (route === "/task") {
      if (!body.id || !body.title) return json(res, 400, { error: "id et title requis" });
      const r = await createTask(body);
      if (body.raw) return json(res, 200, { raw: r });
      return json(res, 200, { ok: true, post: r.posts?.id || null, taskId: r.posts?.task?.id || null, assignees: body.assignees || [] });
    }
    if (route === "/postraw") {
      if (!body.id) return json(res, 400, { error: "id requis" });
      return json(res, 200, await getPost(body.id));
    }
    if (route === "/task-state") {
      if (!body.taskId || !body.state) return json(res, 400, { error: "taskId et state requis (todo|in_progress|closed)" });
      const r = await setTaskState(body);
      return json(res, 200, { ok: true, raw: r });
    }
    if (route === "/note") {
      if (!body.id || !body.markdown) return json(res, 400, { error: "id et markdown requis" });
      await postNote(body.id, body.markdown); return json(res, 200, { ok: true });
    }
    if (route === "/labels") {
      if (!body.id) return json(res, 400, { error: "id requis" });
      if (!body.add && !body.remove) return json(res, 400, { error: "add[] ou remove[] requis" });
      await setLabels(body); return json(res, 200, { ok: true });
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
