/**
 * missive-proxy — proxy HTTP restreint vers l'API Missive
 * --------------------------------------------------------------------------
 * Petit serveur qui s'interpose entre un assistant (Claude Code, un script,
 * une automatisation) et l'API Missive. Le JETON MISSIVE reste ICI, côté
 * serveur, et n'est JAMAIS renvoyé ni journalisé. L'appelant s'authentifie
 * avec un PROXY_SECRET distinct, révocable, qui ne déverrouille que les
 * quelques actions listées ci-dessous.
 *
 * Périmètre volontairement RESTREINT (rien de destructeur : ni suppression,
 * ni fusion, ni accès brut à l'API) :
 *
 *   GET  /health                      → sonde (sans auth)
 *   POST /structure  {}               → carte de la boîte : organisations, équipes,
 *                                       étiquettes partagées (avec hiérarchie), membres.
 *                                       Chaque bloc dégrade seul → champ `errors`.
 *   POST /list       {filter}         → liste des conversations (ex. "shared_label=ID")
 *   POST /conversation {id, limit}    → fil complet nettoyé (qui parle, daté). Chaque message
 *                                       porte son `id` et, s'il y a lieu, `attachments[]`.
 *   POST /attachment {messageId,
 *                     attachmentId}   → télécharge UNE pièce jointe et la renvoie en base64.
 *                                       `attachmentId` facultatif : à défaut, la première.
 *                                       Plafond ~25 Mo. Les `messageId` viennent de /conversation.
 *   POST /messageraw {messageId}      → message BRUT tel que Missive le renvoie. Sert à voir
 *                                       la forme réelle de `from_field`, `to_fields` et du
 *                                       compte de canal sur un message non courriel (Messenger,
 *                                       SMS), que /conversation aplatit volontairement.
 *   POST /drafts     {id, limit, raw} → brouillons du fil. `limit` pagine au-delà des 10 de
 *                                       l'API Missive (max 500).
 *   POST /comments   {id}             → notes internes (commentaires) — dégrade si non listable
 *   POST /users      {}               → membres de l'org (id, nom, courriel) pour les assignations
 *   POST /task       {id, title, assignees[], label} → crée une tâche (assignée si assignees)
 *   POST /task-state {taskId, state}  → change l'état d'une tâche (todo|in_progress|closed)
 *   POST /postraw    {id}             → post brut (voir l'avertissement sur getPost plus bas)
 *   POST /note       {id, markdown}   → note interne
 *   POST /labels     {id, add[], remove[], keepClosed} → étiquettes partagées d'un fil
 *   POST /close      {id, note}       → ferme le fil (+ note)
 *   POST /reply      {id, from, to[], cc[], subject, body, send, closeAfter,
 *                     attachments[]}  → crée un brouillon dans le fil (send=true pour envoyer),
 *                                       ferme après si closeAfter=true.
 *                                       attachments: [{base64_data, filename}] (≤ ~20 Mo au total)
 *   POST /contact-books {}            → carnets d'adresses accessibles (id, nom)
 *   POST /contacts   {search, book, limit} → retrouve un contact déjà connu de la boîte.
 *                                       `search` porte sur nom, courriel, téléphone,
 *                                       organisation. Sans `book`, balaie tous les carnets.
 *   POST /send       {from, to[], cc[], bcc[], subject, body, send,
 *                     attachments[]}  → COURRIEL NEUF, hors de tout fil existant.
 *                                       Défaut = BROUILLON. Il faut send=true pour que ça parte.
 *                                       Maximum 5 destinataires : cette route sert au contact
 *                                       ciblé, pas à l'envoi de masse.
 *
 * AUTH : chaque route (sauf /health) exige l'en-tête  X-Proxy-Secret: <PROXY_SECRET>.
 * Le proxy est joignable publiquement une fois déployé : ce secret est la seule
 * porte. Garde-le long, et révoque-le en changeant la variable.
 *
 * Node 18+ (fetch natif). AUCUNE dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN           jeton API Missive (missive_pat-...)                  [requis]
 *   MISSIVE_PROXY_SECRET    secret que l'appelant envoie en en-tête              [requis]
 *                           (repli accepté : PROXY_SECRET)
 *   MISSIVE_ORG             id d'organisation Missive                       [facultatif]
 *                           Absent : détecté automatiquement au premier appel
 *                           (première organisation visible par le jeton).
 *   MISSIVE_SELF_ADDRESSES  adresses « c'est nous », séparées par des virgules
 *                           — sert à marquer `us: true` sur les messages sortants
 *                           d'un fil.                                       [facultatif]
 *   PORT                    port d'écoute (fourni par l'hébergeur)               [auto]
 */

const http = require("node:http");

const TOKEN = process.env.MISSIVE_TOKEN;
const PROXY_SECRET = process.env.MISSIVE_PROXY_SECRET || process.env.PROXY_SECRET;
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

// --- Organisation ---
// Presque tous les POST de Missive exigent un `organization`. Plutôt que de coder
// un identifiant en dur (il change d'un compte à l'autre), on prend celui de
// MISSIVE_ORG, sinon on demande à Missive la première organisation que le jeton voit.
// Résolu une seule fois, puis gardé en mémoire.
let ORG = process.env.MISSIVE_ORG || null;
async function orgId() {
  if (ORG) return ORG;
  const { organizations = [] } = await mGet("/organizations?limit=200");
  if (!organizations.length) {
    throw new Error("Aucune organisation visible par ce jeton Missive : pose MISSIVE_ORG.");
  }
  ORG = organizations[0].id;
  const extra = organizations.length > 1
    ? ` — ${organizations.length} organisations visibles, pose MISSIVE_ORG pour en choisir une autre.`
    : "";
  console.log(`Organisation : ${organizations[0].name || ORG} (${ORG})${extra}`);
  return ORG;
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

// « Est-ce nous qui parlons ? » — utile pour lire un fil sans confondre les deux voix.
// Deux indices : l'adresse d'envoi figure dans MISSIVE_SELF_ADDRESSES, ou le message
// porte un `author` (Missive ne le met que sur ce qui sort de la boîte).
const SELF = (process.env.MISSIVE_SELF_ADDRESSES || "")
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

// La profondeur de lecture est réglable, et `tronque` dit franchement qu'il reste des
// messages non lus au lieu de laisser croire au fil complet. Sans ça, on répond à un fil
// de 25 messages en n'ayant lu que les 10 derniers, sans le savoir.
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
  const pieces = new Map();
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    try {
      const r = await mGet(`/messages/${chunk.join(",")}`);
      const arr = Array.isArray(r.messages) ? r.messages : [r.messages];
      for (const m of arr) if (m && m.id) {
        bodies.set(m.id, m.body || m.preview || "");
        if (Array.isArray(m.attachments) && m.attachments.length) pieces.set(m.id, m.attachments);
      }
    } catch { /* on garde le preview */ }
  }
  const out = sorted.map((m) => {
    const ts = (m.delivered_at || m.created_at || 0) * 1000;
    // Sans cette liste, un courriel qui dit « voici le rapport » renvoie un texte vide à
    // cet endroit, ce qui se lit comme une absence d'information plutôt que comme un
    // fichier non téléchargé.
    const jointes = (pieces.get(m.id) || m.attachments || []).map((a) => ({
      id: a.id,
      filename: a.filename || null,
      extension: a.extension || null,
      media_type: [a.media_type, a.sub_type].filter(Boolean).join("/") || null,
      size: a.size ?? null,
    }));
    const o = {
      id: m.id,                       // requis pour aller chercher une pièce jointe ensuite
      from: m.from_field?.name || m.from_field?.address || "?",
      address: m.from_field?.address || null,
      us: isUs(m),
      date: ts ? new Date(ts).toISOString().slice(0, 10) : null,
      subject: m.subject || null,
      text: stripHtml(bodies.get(m.id) || m.body || m.preview || ""),
    };
    if (jointes.length) o.attachments = jointes;
    return o;
  });
  // On s'est arrêté au plafond demandé => il reste probablement des messages avant.
  out.tronque = messages.length >= vise;
  return out;
}

// --- Pièces jointes ---
// L'URL du fichier exige le même jeton que l'API : on la télécharge ICI et on renvoie du
// base64, pour que la clé Missive ne sorte jamais du proxy.
async function getAttachment({ messageId, attachmentId }) {
  const r = await mGet(`/messages/${messageId}`);
  const msg = Array.isArray(r.messages) ? r.messages[0] : (r.messages || r.message);
  const liste = (msg && msg.attachments) || [];
  if (!liste.length) throw new Error(`le message ${messageId} n'a aucune pièce jointe`);
  const a = attachmentId ? liste.find((x) => x.id === attachmentId) : liste[0];
  if (!a) throw new Error(`pièce jointe ${attachmentId} absente du message ${messageId}`);
  if (!a.url) throw new Error(`pièce jointe ${a.id} sans URL téléchargeable`);
  const dl = await fetch(a.url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!dl.ok) throw new Error(`téléchargement pièce jointe → ${dl.status}`);
  const buf = Buffer.from(await dl.arrayBuffer());
  // La réponse JSON transite en base64 : au-delà de ~25 Mo on refuse plutôt que d'étouffer l'appelant.
  if (buf.length > 25e6) throw new Error(`pièce jointe trop lourde (${buf.length} octets)`);
  return {
    id: a.id,
    filename: a.filename || null,
    extension: a.extension || null,
    media_type: [a.media_type, a.sub_type].filter(Boolean).join("/") || null,
    size: buf.length,
    base64: buf.toString("base64"),
  };
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

// Brouillons d'un fil. L'API Missive plafonne les brouillons à 10 par page, comme elle le
// fait pour les messages : sans pagination, on ne voit jamais que les dix derniers.
async function getDrafts(id, raw, limit) {
  const vise = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 500);
  const parId = new Map();
  let until = null;
  while (parId.size < vise) {
    let p = `/conversations/${id}/drafts?limit=10`;
    if (until) p += `&until=${until}`;
    const { drafts: lot = [] } = await mGet(p);
    if (!lot.length) break;
    const avant = parId.size;
    for (const d of lot) parId.set(d.id, d);
    const plusVieux = lot[lot.length - 1].delivered_at || lot[lot.length - 1].created_at || null;
    if (lot.length < 10 || parId.size === avant || !plusVieux || plusVieux === until) break;
    until = plusVieux;
  }
  const drafts = [...parId.values()].slice(0, vise);
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

// Notes internes (commentaires/posts) laissées par l'équipe ou une automatisation.
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

// Membres de l'organisation — sert à retrouver l'id d'un coéquipier avant de lui assigner
// une tâche.
async function listUsers() {
  const { users = [] } = await mGet(`/users?limit=200`);
  return users.map((u) => ({ id: u.id, name: u.name || null, email: u.email || null }));
}

// Carte de la boîte : les Resource ID nécessaires avant tout filtre utile.
// Aucune donnée client là-dedans — que de la structure, donc mettable en cache sur disque.
// Chaque bloc est isolé : une permission manquante sur un type laisse les autres exploitables.
async function getStructure() {
  const org = await orgId();
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
    async () => (await pages(`/teams?organization=${org}`, "teams")).map((t) => ({
      id: t.id, name: t.name || null, organization: t.organization || org,
    })), []);

  const shared_labels = await safe("shared_labels",
    async () => (await pages(`/shared_labels?organization=${org}`, "shared_labels")).map((l) => ({
      id: l.id,
      name: l.name || null,
      name_with_parent_names: l.name_with_parent_names || l.name || null,
      parent_id: l.parent_id || null,
      organization: l.organization || org,
      visibility: l.visibility || null,
      archived: !!l.archived,
    })), []);

  const users = await safe("users", listUsers, []);

  return { organization: org, organizations, teams, shared_labels, users, errors };
}

// Crée une TÂCHE sur un fil, éventuellement assignée à des utilisateurs.
// add_assignees exige `organization` (toujours envoyé). Les assignés existants restent.
async function createTask({ id, title, assignees, label, markdown }) {
  const t = String(title || "").slice(0, 1000);
  const post = {
    conversation: id, organization: await orgId(),
    task: { title: t, state: "todo" },
    // Missive exige un corps (text/markdown/attachments) même pour une tâche.
    markdown: String(markdown || t) || "Tâche",
    notification: { title: "Tâche créée", body: t.slice(0, 120) || "Tâche" },
  };
  if (Array.isArray(assignees) && assignees.length) post.add_assignees = assignees;
  if (label) post.add_shared_labels = [label];
  return mSend("POST", "/posts", { posts: post });
}

// Récupère un post brut. ATTENTION : Missive n'expose PAS `GET /posts/:id` — l'appel
// répond 404 « Invalid request URL ». La fonction reste exposée par symétrie, mais
// elle échouera tant que Missive n'ajoutera pas la route.
async function getPost(id) { return mGet(`/posts/${id}`); }

// Change l'état d'une tâche existante : "todo" | "in_progress" | "closed" (= accomplie).
async function setTaskState({ taskId, state, conversation, markdown }) {
  const st = state || "closed";
  const post = {
    organization: await orgId(),
    task: { id: taskId, state: st },
    markdown: markdown || (st === "closed" ? "_Tâche accomplie._" : `_Tâche : ${st}._`),
    notification: { title: "Tâche mise à jour", body: st === "closed" ? "Accomplie" : st },
  };
  if (conversation) post.conversation = conversation;
  return mSend("POST", "/posts", { posts: post });
}

// `postNote` crée un POST, pas un COMMENT : les deux sont des objets distincts chez
// Missive. Conséquence à connaître : une note écrite ici ne ressort PAS de
// `GET /conversations/:id/comments`, donc getComments() ne la relira jamais. La note
// est bien déposée dans le fil, mais elle est invisible depuis l'API.
async function postNote(id, markdown) {
  return mSend("POST", "/posts", {
    posts: { conversation: id, organization: await orgId(),
      notification: { title: "Note", body: (markdown || "").slice(0, 100) }, markdown: markdown || "_(note)_" },
  });
}

async function closeConversation(id, note) {
  return mSend("POST", "/posts", {
    posts: { conversation: id, organization: await orgId(), close: true,
      notification: { title: "Fermé", body: (note || "Fil fermé").slice(0, 100) },
      markdown: note || "_Fil fermé._" },
  });
}

// Étiquettes partagées d'un fil. `close` ne touche pas aux étiquettes : sans cette route,
// un fil répondu mais laissé ouvert garde indéfiniment l'étiquette qui l'avait mis en file.
// `keepClosed` évite le piège inverse : sur un fil déjà fermé, poster sans ce drapeau le rouvre.
async function setLabels({ id, add, remove, markdown, keepClosed }) {
  const post = {
    conversation: id, organization: await orgId(),
    markdown: markdown || "_Étiquettes mises à jour._",
    notification: { title: "Étiquettes", body: (markdown || "Étiquettes mises à jour").slice(0, 100) },
  };
  if (Array.isArray(add) && add.length) post.add_shared_labels = add;
  if (Array.isArray(remove) && remove.length) post.remove_shared_labels = remove;
  // `reopen: true` ROUVRE le fil : le drapeau doit donc valoir false, pas true.
  if (keepClosed) post.reopen = false;
  return mSend("POST", "/posts", { posts: post });
}

async function reply({ id, from, to, cc, subject, body, send, closeAfter, attachments }) {
  const draft = {
    conversation: id, organization: await orgId(),
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

// Carnets d'adresses. Missive range les contacts dans des « contact books »,
// privés ou partagés : il en faut l'id avant toute recherche.
async function contactBooks() {
  const { contact_books = [] } = await mGet("/contact_books?limit=200");
  return contact_books.map((b) => ({ id: b.id, name: b.name, organization: b.organization || null }));
}

// Retrouver quelqu'un déjà connu de la boîte, par nom, courriel, téléphone ou
// organisation. Missive fait la recherche côté serveur sur toutes les fiches.
// Sans `book`, on balaie tous les carnets accessibles et on fusionne.
async function findContacts({ search, book, limit }) {
  const books = book ? [{ id: book }] : await contactBooks();
  const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
  const vus = new Map();
  for (const b of books) {
    let path = `/contacts?contact_book=${encodeURIComponent(b.id)}&limit=${lim}`;
    if (search) path += `&search=${encodeURIComponent(search)}`;
    let lot = [];
    try { ({ contacts: lot = [] } = await mGet(path)); } catch { continue; } // un carnet illisible ne casse pas les autres
    for (const c of lot) {
      if (vus.has(c.id)) continue;
      const nom = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.nickname || null;
      const infos = (c.infos || []).map((i) => ({ kind: i.kind, value: i.value, label: i.label || null }));
      vus.set(c.id, {
        id: c.id, nom, job_title: c.job_title || null, notes: c.notes || null,
        carnet: b.name || b.id,
        courriels: infos.filter((i) => /email/i.test(i.kind || "")).map((i) => i.value),
        telephones: infos.filter((i) => /phone/i.test(i.kind || "")).map((i) => i.value),
        organisations: (c.memberships || []).map((m) => m.name || m.organization).filter(Boolean),
        autres_infos: infos.filter((i) => !/email|phone/i.test(i.kind || "")),
      });
    }
  }
  return [...vus.values()];
}

// Courriel NEUF, vers quelqu'un qui n'a jamais écrit (prospection, relance, prise de
// contact). Même endpoint Missive que reply(), à une différence près : on omet
// `conversation`, ce qui fait ouvrir un nouveau fil au lieu d'en continuer un.
//
// Le défaut est VOLONTAIREMENT le brouillon : sans `send: true`, le message
// apparaît dans Missive et attend qu'un humain appuie sur envoyer. C'est le
// garde-fou principal de cette route — un courriel envoyé ne se rappelle pas.
const MAX_DEST = 5; // barrière anti-envoi de masse : cette route sert au contact ciblé
async function sendNew({ from, to, cc, bcc, subject, body, send, attachments }) {
  const dest = [...(to || []), ...(cc || []), ...(bcc || [])];
  if (dest.length > MAX_DEST) {
    throw new Error(`${dest.length} destinataires demandés, maximum ${MAX_DEST}. Cette route sert au contact ciblé, pas à l'envoi de masse.`);
  }
  const draft = {
    organization: await orgId(),
    from_field: { address: from },
    to_fields: (to || []).map((a) => ({ address: a })),
    subject,
    body: (body || "").replace(/\n/g, "<br>"),
  };
  if (cc && cc.length) draft.cc_fields = cc.map((a) => ({ address: a }));
  if (bcc && bcc.length) draft.bcc_fields = bcc.map((a) => ({ address: a }));
  if (Array.isArray(attachments) && attachments.length) {
    draft.attachments = attachments
      .filter((a) => a && a.base64_data && a.filename)
      .map((a) => ({ base64_data: a.base64_data, filename: String(a.filename).slice(0, 255) }));
  }
  if (send) draft.send = true;
  return mSend("POST", "/drafts", { drafts: draft });
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
    if (route === "/messageraw") {
      if (!body.messageId) return json(res, 400, { error: "messageId requis" });
      const r = await mGet(`/messages/${body.messageId}`);
      const m = Array.isArray(r.messages) ? r.messages[0] : (r.messages || r.message);
      // On retire le corps : ce qui nous intéresse ici, c'est l'enveloppe.
      if (m && typeof m === "object") { delete m.body; delete m.preview; }
      return json(res, 200, { message: m });
    }
    if (route === "/attachment") {
      if (!body.messageId) return json(res, 400, { error: "messageId requis (attachmentId facultatif)" });
      return json(res, 200, await getAttachment(body));
    }
    if (route === "/drafts") {
      if (!body.id) return json(res, 400, { error: "id requis" });
      const d = await getDrafts(body.id, body.raw, body.limit);
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
      // `taskId` sera TOUJOURS null : `POST /posts` ne renvoie que {conversation, id}.
      // Ce n'est pas un défaut d'extraction, c'est ce que l'API rend. Conséquence à
      // connaître avant de bâtir dessus : une tâche créée ici ne peut être ni relue, ni
      // refermée, ni dédoublonnée par le proxy. Les tâches n'apparaissent pas non plus
      // dans /comments, et GET /posts/:id n'existe pas. Il n'y a donc AUCUN chemin de
      // vérification : ne crée jamais deux fois la même tâche en supposant que la
      // première a échoué. Tiens ton registre ailleurs.
      return json(res, 200, { ok: true, post: r.posts?.id || null, taskId: null, assignees: body.assignees || [] });
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
    if (route === "/contact-books") {
      return json(res, 200, { ok: true, books: await contactBooks() });
    }
    if (route === "/contacts") {
      const found = await findContacts(body);
      return json(res, 200, { ok: true, count: found.length, contacts: found });
    }
    if (route === "/send") {
      if (!body.from || !Array.isArray(body.to) || !body.to.length || !body.subject || !body.body) {
        return json(res, 400, { error: "from, to[], subject et body requis" });
      }
      const r = await sendNew(body);
      return json(res, 200, {
        ok: true,
        sent: !!body.send,
        draft: r.drafts?.id || null,
        conversation: r.drafts?.conversation || null,
      });
    }
    return json(res, 404, { error: "route inconnue" });
  } catch (e) {
    return json(res, 502, { error: String(e.message || e).slice(0, 300) });
  }
});

server.listen(PORT, () => console.log(`missive-proxy à l'écoute sur :${PORT}`));
