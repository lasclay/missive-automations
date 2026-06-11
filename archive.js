/**
 * Lasclay — archive.js (v3.5)
 * ---------------------------
 * v3.3 : correctif de la détection nous/client sur les canaux sociaux
 * (Messenger « Lasclay » sans adresse courriel) via MISSIVE_SELF_NAMES
 * et le champ author des messages sortants.
 * Archive brute du service client Missive en JSONL, exportée PAR TRANCHES en
 * pièces jointes gzippées dans des brouillons Missive (jamais envoyés).
 *
 * DEUX PASSES :
 *   1. EXEMPLES : tous les fils du label « exemple service client »,
 *      SANS limite de date, AVEC les commentaires internes de l'équipe.
 *      C'est le corpus en profondeur (logiques de décision incluses).
 *   2. GÉNÉRALE : team_all de l'équipe sur MAX_AGE_DAYS, messages seulement.
 *      C'est le volume statistique. Les fils du label en sont exclus.
 *
 * Reprise : relit les pièces jointes déjà exportées dans EXPORT_CONV et saute
 * ce qui est fait. Un fil archivé jadis SANS commentaires sera réarchivé par
 * la passe exemples (record en double, le plus riche gagne à l'analyse).
 *
 * LECTURE SEULE côté fils clients. Seule écriture : les brouillons d'export.
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN            requis (missive_pat-...)
 *   TEAMS                    ids d'équipes séparés par virgules (défaut: LAS Support,
 *                            Mise à jour commande, RETOURS-ÉCHANGES, USA, Vente pré-achat)
 *   LABEL_EXEMPLES           label des exemples (défaut : « exemple service client »)
 *   MAX_AGE_DAYS             profondeur de la passe générale (défaut 730)
 *   LIMIT_CONV               plafond de fils de la PASSE GÉNÉRALE ce run
 *                            (défaut 10 = test; 0 = sans limite).
 *                            La passe exemples est toujours complète.
 *   TRANCHE                  fils par tranche d'export (défaut 2500)
 *   BATCH_IDS                messages par GET groupé (défaut 10)
 *   MISSIVE_SELF_ADDRESSES   nos adresses (défaut hey@, admin@, operations@)
 *   MISSIVE_SELF_NAMES       nos noms de page sociale (défaut « lasclay »)
 *   EXPORT_CONV              conversation d'export (défaut : « Archives support »)
 *   EXPORT_FROM              alias du brouillon (défaut hey@lasclay.com)
 *   MISSIVE_ORG              org (défaut Lasclay)
 */

const zlib = require("node:zlib");

const TOKEN = process.env.MISSIVE_TOKEN;
// Équipes balayées par la passe générale (team_all). TEAMS=ids séparés par virgules.
const TEAMS = (process.env.TEAMS || process.env.TEAM || [
  "e184d153-4472-4edd-9b35-f8867cf437a8", // LAS Support
  "0db185c1-3a93-4a44-9f50-dcfe8c0683dd", // Mise à jour commande
  "cc587c84-63b9-4e88-993c-4f4b5b328173", // RETOURS-ÉCHANGES
  "13d8a7bd-ed2e-4e0c-8cf3-2329ebaed217", // USA
  "d6f28d2f-06ef-4aa5-aae0-b68f014e3216", // Vente - info pré-achat
].join(",")).split(",").map((s) => s.trim()).filter(Boolean);
const LABEL_EXEMPLES = process.env.LABEL_EXEMPLES || "c72b0a84-d467-4fb7-a95d-13b5e30f0e35";
const MAX_AGE_DAYS = parseInt(process.env.MAX_AGE_DAYS || "730", 10);
const LIMIT_CONV = parseInt(process.env.LIMIT_CONV || "10", 10);
const TRANCHE = Math.max(50, parseInt(process.env.TRANCHE || "2500", 10));
const BATCH_IDS = Math.max(1, parseInt(process.env.BATCH_IDS || "10", 10));
const SELF = (process.env.MISSIVE_SELF_ADDRESSES ||
  "hey@lasclay.com,admin@lasclay.com,operations@lasclay.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
// Noms d'expéditeur qui sont « nous » (pages sociales, ex. Messenger « Lasclay »).
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const SELF_NAMES = new Set((process.env.MISSIVE_SELF_NAMES || "lasclay")
  .split(",").map(norm).filter(Boolean));
const EXPORT_CONV = process.env.EXPORT_CONV || "019eb488-6d42-7195-a2ae-11751d0a7a27";
const EXPORT_FROM = process.env.EXPORT_FROM || "hey@lasclay.com";
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36";

const API = "https://public.missiveapp.com/v1";
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (!TOKEN) { console.error("Manque MISSIVE_TOKEN."); process.exit(1); }
if (!EXPORT_CONV) { console.error("Manque EXPORT_CONV (essentiel sur Render)."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path) {
  await sleep(260); // limite Missive ~300/min
  const res = await fetch(`${API}${path}`, { headers });
  if (res.status === 429) { console.warn("429, pause 30 s…"); await sleep(30000); return api(path); }
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function apiPost(path, body) {
  await sleep(260);
  const res = await fetch(`${API}${path}`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  if (res.status === 429) { console.warn("429, pause 30 s…"); await sleep(30000); return apiPost(path, body); }
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json().catch(() => ({}));
}

// ---------------------------------------------------------------------------
// Nettoyage : HTML → texte + coupe du texte cité (validé : 0 corps vides).
// ---------------------------------------------------------------------------

function cutQuotedHtml(html) {
  if (!html) return "";
  const markers = [/<blockquote/i, /class="gmail_quote/i];
  let cut = html.length;
  for (const re of markers) {
    const m = html.search(re);
    if (m !== -1 && m < cut) cut = m;
  }
  return html.slice(0, cut);
}

function stripHtml(s) {
  if (!s) return "";
  let t = s;
  t = t.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  t = t.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, txt) => {
    const clean = txt.replace(/<[^>]+>/g, "").trim();
    if (href && !href.startsWith("mailto:") && clean && !clean.includes(href)) return `${clean} (${href})`;
    return clean || href;
  });
  t = t.replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
       .replace(/&gt;/gi, ">").replace(/&#39;|&rsquo;/gi, "'").replace(/&quot;/gi, '"');
  t = t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

function cutQuotedText(text) {
  if (!text) return "";
  const markers = [
    /^\s*Le .{0,120}? a écrit\s*:/im,
    /^\s*On .{0,120}? wrote\s*:/im,
    /^\s*-{2,}\s*(Original Message|Message d'origine|Forwarded message|Message transféré)/im,
    /^\s*De\s?:\s.{0,150}\n\s*(Envoyé|Date|Sent)\s?:/im,
  ];
  let cut = text.length;
  for (const re of markers) {
    const m = text.search(re);
    if (m !== -1 && m < cut) cut = m;
  }
  return text.slice(0, cut).trim();
}

function cleanBody(html) {
  return cutQuotedText(stripHtml(cutQuotedHtml(html)));
}

// ---------------------------------------------------------------------------
// REPRISE : relire les archives déjà exportées dans EXPORT_CONV.
// ---------------------------------------------------------------------------

async function listExportDrafts() {
  const byId = new Map();
  let until = null;
  while (true) {
    let path = `/conversations/${EXPORT_CONV}/drafts?limit=10`;
    if (until) path += `&until=${until}`;
    const { drafts = [] } = await api(path);
    if (drafts.length === 0) break;
    const before = byId.size;
    for (const d of drafts) byId.set(d.id, d);
    const last = drafts[drafts.length - 1];
    const oldest = last.delivered_at || last.created_at || null;
    if (drafts.length < 10 || byId.size === before || !oldest || oldest === until) break;
    until = oldest;
  }
  return [...byId.values()];
}

async function loadDoneFromMissive() {
  const done = new Set();        // fils archivés, peu importe la profondeur
  const doneExemple = new Set(); // fils archivés AVEC commentaires (passe exemples)
  let files = 0;
  let drafts = [];
  try {
    drafts = await listExportDrafts();
  } catch (e) {
    console.warn(`Lecture des brouillons d'export impossible (${e.message}). Reprise désactivée.`);
    return { done, doneExemple };
  }
  for (const d of drafts) {
    for (const a of d.attachments || []) {
      if (!/^archive_support_.*\.jsonl\.gz$/.test(a.filename || "")) continue;
      try {
        const res = await fetch(a.url); // URL signée, pas d'en-tête d'auth
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const text = zlib.gunzipSync(buf).toString("utf8");
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          try {
            const rec = JSON.parse(line);
            done.add(rec.id);
            if (rec.exemple) doneExemple.add(rec.id);
          } catch {}
        }
        files++;
      } catch (e) {
        console.warn(`  pièce jointe ${a.filename} illisible (${e.message}), ignorée.`);
      }
    }
  }
  console.log(`Reprise: ${files} archive(s) relue(s), ${done.size} fils faits dont ${doneExemple.size} exemple(s).`);
  return { done, doneExemple };
}

// ---------------------------------------------------------------------------
// Listages : label (exhaustif, tous états) et team_all (fenêtré).
// ---------------------------------------------------------------------------

async function paginateConversations(baseFilter, cutoffTs, logEvery) {
  const byId = new Map();
  let until = null;
  const limit = 50;
  let pages = 0;
  while (true) {
    let path = `/conversations?${baseFilter}&limit=${limit}`;
    if (until) path += `&until=${until}`;
    const { conversations = [] } = await api(path);
    if (conversations.length === 0) break;
    pages++;
    for (const c of conversations) byId.set(c.id, c);
    const oldest = conversations[conversations.length - 1].last_activity_at;
    if (logEvery && pages % logEvery === 0) {
      console.log(`  pages: ${pages}, fils: ${byId.size}, plus ancien: ${new Date(oldest * 1000).toISOString().slice(0, 10)}`);
    }
    if (cutoffTs && oldest < cutoffTs) break;
    if (conversations.length < limit || oldest === until) break;
    until = oldest;
  }
  const all = [...byId.values()];
  return cutoffTs ? all.filter((c) => (c.last_activity_at || 0) >= cutoffTs) : all;
}

// ---------------------------------------------------------------------------
// Lecture d'un fil : messages (toujours), commentaires (passe exemples).
// ---------------------------------------------------------------------------

async function listThreadMessages(convId) {
  const byId = new Map();
  let until = null;
  while (true) {
    let path = `/conversations/${convId}/messages?limit=10`;
    if (until) path += `&until=${until}`;
    const { messages = [] } = await api(path);
    if (messages.length === 0) break;
    const before = byId.size;
    for (const m of messages) byId.set(m.id, m);
    const oldest = messages[messages.length - 1].delivered_at;
    if (messages.length < 10 || oldest === until || byId.size === before) break;
    until = oldest;
  }
  return [...byId.values()].sort(
    (a, b) => (a.delivered_at || a.created_at || 0) - (b.delivered_at || b.created_at || 0)
  );
}

async function listThreadComments(convId) {
  const byId = new Map();
  let until = null;
  while (true) {
    let path = `/conversations/${convId}/comments?limit=10`;
    if (until) path += `&until=${until}`;
    const { comments = [] } = await api(path);
    if (comments.length === 0) break;
    const before = byId.size;
    for (const c of comments) byId.set(c.id, c);
    const oldest = comments[comments.length - 1].created_at;
    if (comments.length < 10 || oldest === until || byId.size === before) break;
    until = oldest;
  }
  return [...byId.values()].sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
}

async function fetchBodies(ids) {
  const bodies = new Map();
  for (let i = 0; i < ids.length; i += BATCH_IDS) {
    const chunk = ids.slice(i, i + BATCH_IDS);
    try {
      const r = await api(`/messages/${chunk.join(",")}`);
      const arr = Array.isArray(r.messages) ? r.messages : [r.messages];
      for (const m of arr) if (m && m.id) bodies.set(m.id, m.body || m.preview || "");
    } catch (e) {
      console.warn(`  fetch groupé échoué (${e.message}), repli unitaire…`);
      for (const id of chunk) {
        try {
          const r = await api(`/messages/${id}`);
          const m = Array.isArray(r.messages) ? r.messages[0] : r.messages;
          if (m) bodies.set(id, m.body || m.preview || "");
        } catch (e2) {
          console.warn(`  message ${id} irrécupérable: ${e2.message}`);
        }
      }
    }
  }
  return bodies;
}

const stats = { msgTotal: 0, emptyBodies: 0 };

async function buildRecord(conv, withComments) {
  const msgs = await listThreadMessages(conv.id);
  const bodies = await fetchBodies(msgs.map((m) => m.id));
  const record = {
    id: conv.id,
    subject: conv.subject || conv.latest_message_subject || null,
    team: conv.team?.name || null,
    last_activity_at: conv.last_activity_at,
    labels: (conv.shared_labels || []).map((l) => l.name || l.id),
    messages_count: msgs.length,
    messages: msgs.map((m) => {
      const raw = bodies.get(m.id) || m.body || m.preview || "";
      const body = cleanBody(raw);
      if (!body) stats.emptyBodies++;
      const addr = (m.from_field?.address || "").toLowerCase();
      const fromName = norm(m.from_field?.name || m.from_field?.username || "");
      // « nous » si: adresse connue, OU nom de page connu (Messenger/Instagram),
      // OU message authored par un membre de l'équipe (champ présent en sortant).
      const isUs = SELF.includes(addr) || SELF_NAMES.has(fromName) || !!m.author?.name;
      const rec = {
        id: m.id,
        date: m.delivered_at || m.created_at || null,
        type: m.type || null,
        from: m.from_field?.address || m.from_field?.name || m.from_field?.username || null,
        direction: isUs ? "nous" : "client",
        body,
      };
      if (m.author?.name) rec.author = m.author.name; // qui a répondu chez nous
      const att = (m.attachments || []).map((a) => a.filename).filter(Boolean);
      if (att.length) rec.attachments = att; // ex.: photo d'un produit défectueux
      return rec;
    }),
  };
  stats.msgTotal += msgs.length;
  if (withComments) {
    record.exemple = true;
    const comments = await listThreadComments(conv.id);
    record.comments = comments.map((c) => {
      const com = {
        date: c.created_at || null,
        author: c.author?.name || null,
        body: (c.body || "").trim(),
      };
      if (c.task?.description) com.task = c.task.description;
      return com;
    }).filter((c) => c.body || c.task);
  }
  return record;
}

// ---------------------------------------------------------------------------
// Export d'une tranche : gzip + brouillon avec pièce jointe. JAMAIS send:true.
// ---------------------------------------------------------------------------

const RUN_STAMP = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
let trancheSeq = 0;

async function exportTranche(lines, tag) {
  if (lines.length === 0) return;
  trancheSeq++;
  let pieces = [lines.join("\n")];
  const B64_MAX = 6.5 * 1024 * 1024;
  while (true) {
    const tooBig = pieces.findIndex(
      (p) => zlib.gzipSync(Buffer.from(p)).toString("base64").length > B64_MAX
    );
    if (tooBig === -1) break;
    const ls = pieces[tooBig].split("\n");
    const mid = Math.ceil(ls.length / 2);
    pieces.splice(tooBig, 1, ls.slice(0, mid).join("\n"), ls.slice(mid).join("\n"));
  }
  for (let j = 0; j < pieces.length; j++) {
    const b64 = zlib.gzipSync(Buffer.from(pieces[j])).toString("base64");
    const suffix = pieces.length > 1 ? `${trancheSeq}${"abcdefgh"[j]}` : `${trancheSeq}`;
    const filename = `archive_support_${RUN_STAMP}_t${suffix}.jsonl.gz`;
    await apiPost("/drafts", {
      drafts: {
        conversation: EXPORT_CONV,
        organization: ORG,
        from_field: { address: EXPORT_FROM },
        to_fields: [{ address: EXPORT_FROM }],
        subject: `[NE PAS ENVOYER] Archive support${tag ? " " + tag : ""}, tranche ${suffix} (${lines.length} fils)`,
        body: "Archive JSONL gzippée en pièce jointe. Brouillon technique: ne pas envoyer, ne pas supprimer (sert à la reprise et à l'analyse).",
        attachments: [{ base64_data: b64, filename }],
      },
    });
    console.log(`  >> tranche exportée: ${filename} (${(b64.length / 1048576).toFixed(2)} Mo en base64)`);
  }
}

// ---------------------------------------------------------------------------
// Run principal
// ---------------------------------------------------------------------------

(async () => {
  console.log("=== Lasclay archive.js v3.5 ===");
  console.log(`Équipes: ${TEAMS.length} | Label exemples: ${LABEL_EXEMPLES}`);
  console.log(`Fenêtre générale: ${MAX_AGE_DAYS} j | Plafond général: ${LIMIT_CONV || "aucun"} | Tranche: ${TRANCHE}`);

  const cutoffTs = Math.floor(Date.now() / 1000) - MAX_AGE_DAYS * 86400;
  const { done, doneExemple } = await loadDoneFromMissive();

  let buffer = [];
  let ok = 0, errors = 0;

  async function processList(convs, withComments, label) {
    let n = 0;
    const t0 = Date.now();
    for (const conv of convs) {
      n++;
      try {
        buffer.push(JSON.stringify(await buildRecord(conv, withComments)));
        done.add(conv.id);
        ok++;
      } catch (e) {
        errors++;
        console.warn(`[${label} ${n}/${convs.length}] ERREUR sur ${conv.id}: ${e.message} (on continue)`);
      }
      if (n % 50 === 0) {
        const mins = (Date.now() - t0) / 60000;
        const eta = (mins / n) * (convs.length - n);
        console.log(`[${label} ${n}/${convs.length}] ok: ${ok}, erreurs: ${errors}, ~${eta.toFixed(0)} min restantes`);
      }
      if (buffer.length >= TRANCHE) {
        await exportTranche(buffer, label);
        buffer = [];
      }
    }
  }

  // --- PASSE 1 : exemples (label complet, avec commentaires internes) ---
  console.log("\nPasse 1: fils du label « exemple service client » (exhaustif, avec commentaires)…");
  const exemples = await paginateConversations(`shared_label=${LABEL_EXEMPLES}`, null, 0);
  const todoEx = exemples.filter((c) => !doneExemple.has(c.id) && c.id !== EXPORT_CONV);
  console.log(`${exemples.length} fils sous le label, ${todoEx.length} à archiver.`);
  await processList(todoEx, true, "exemples");
  await exportTranche(buffer, "exemples");
  buffer = [];

  // --- PASSE 2 : générale (team_all des équipes listées, messages seulement) ---
  console.log("\nPasse 2: balayage team_all…");
  const labelIds = new Set(exemples.map((c) => c.id));
  const allById = new Map();
  for (const teamId of TEAMS) {
    console.log(`  équipe ${teamId}…`);
    const convs = await paginateConversations(`team_all=${teamId}`, cutoffTs, 20);
    for (const c of convs) allById.set(c.id, c);
    console.log(`  → ${convs.length} fils dans la fenêtre (cumul: ${allById.size}).`);
  }
  const all = [...allById.values()];
  console.log(`${all.length} fils uniques dans la fenêtre de ${MAX_AGE_DAYS} jours, toutes équipes.`);
  let todo = all.filter((c) => !done.has(c.id) && !labelIds.has(c.id) && c.id !== EXPORT_CONV);
  // Bruit technique exclu d'office : rapports DMARC (« Report Domain: lasclay.com ... »).
  // Motif étroit pour ne pas risquer d'écarter une vraie conversation.
  const DMARC_RE = /^(\[preview\]\s*)?report domain:\s*lasclay\.com/i;
  const beforeDmarc = todo.length;
  todo = todo.filter((c) => !DMARC_RE.test((c.subject || c.latest_message_subject || "").trim()));
  console.log(`Rapports DMARC écartés: ${beforeDmarc - todo.length}.`);
  if (LIMIT_CONV > 0) todo = todo.slice(0, LIMIT_CONV);
  console.log(`À archiver ce run: ${todo.length} fils.`);
  await processList(todo, false, "général");
  await exportTranche(buffer, "général");

  console.log(`\nArchivage: ${ok} fils ok, ${errors} erreurs, ${stats.msgTotal} messages, ${stats.emptyBodies} corps vides.`);
  console.log("Run terminé. Les brouillons d'archive servent de stockage: ne pas les supprimer.");
})().catch((e) => { console.error("Erreur fatale:", e.message); process.exit(1); });
