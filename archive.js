/**
 * Lasclay — archive.js (v3, gros volume sur Render)
 * --------------------------------------------------
 * Archive brute d'une shared inbox Missive (team_all) en JSONL, exporté PAR
 * TRANCHES en pièces jointes gzippées dans des brouillons Missive (jamais
 * envoyés) au fil du run.
 *
 * Nouveautés v3 (pensées pour ~20 000 fils, run de plusieurs heures) :
 *   - REPRISE : au démarrage, relit les pièces jointes d'archive déjà
 *     présentes dans la conversation d'export et saute les fils déjà faits.
 *     Un run interrompu reprend où il était au Trigger Run suivant.
 *   - EXPORT PAR TRANCHES : un brouillon tous les TRANCHE fils (défaut 2500),
 *     donc mémoire stable et rien de perdu si le job meurt.
 *   - TOLÉRANCE : une erreur sur un fil est loguée et on continue.
 *
 * LECTURE SEULE côté conversations clients. Seule écriture : les brouillons
 * d'export dans EXPORT_CONV.
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN            requis (missive_pat-...)
 *   TEAM                     id d'équipe (défaut : LAS Support)
 *   MAX_AGE_DAYS             profondeur (défaut 730 = 2 ans)
 *   LIMIT_CONV               plafond de fils ce run (défaut 10 = test; 0 = sans limite)
 *   TRANCHE                  fils par tranche d'export (défaut 2500)
 *   BATCH_IDS                messages par GET groupé (défaut 10; 1 si échec)
 *   MISSIVE_SELF_ADDRESSES   nos adresses, séparées par virgules
 *                            (défaut hey@, admin@, operations@lasclay.com)
 *   EXPORT_CONV              conversation d'export (défaut : « Archives support »)
 *   EXPORT_FROM              alias du brouillon (défaut hey@lasclay.com)
 *   MISSIVE_ORG              org (défaut Lasclay)
 */

const zlib = require("node:zlib");

const TOKEN = process.env.MISSIVE_TOKEN;
const TEAM = process.env.TEAM || "e184d153-4472-4edd-9b35-f8867cf437a8"; // LAS Support
const MAX_AGE_DAYS = parseInt(process.env.MAX_AGE_DAYS || "730", 10);
const LIMIT_CONV = parseInt(process.env.LIMIT_CONV || "10", 10);
const TRANCHE = Math.max(50, parseInt(process.env.TRANCHE || "2500", 10));
const BATCH_IDS = Math.max(1, parseInt(process.env.BATCH_IDS || "10", 10));
const SELF = (process.env.MISSIVE_SELF_ADDRESSES ||
  "hey@lasclay.com,admin@lasclay.com,operations@lasclay.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
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
// Nettoyage : HTML → texte, puis coupe du texte cité (identique à v2, éprouvé
// sur le run de test : 0 corps vides).
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
  const done = new Set();
  let files = 0;
  let drafts = [];
  try {
    drafts = await listExportDrafts();
  } catch (e) {
    console.warn(`Lecture des brouillons d'export impossible (${e.message}). Reprise désactivée.`);
    return done;
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
          try { done.add(JSON.parse(line).id); } catch {}
        }
        files++;
      } catch (e) {
        console.warn(`  pièce jointe ${a.filename} illisible (${e.message}), ignorée.`);
      }
    }
  }
  console.log(`Reprise: ${files} archive(s) relue(s), ${done.size} fils déjà faits.`);
  return done;
}

// ---------------------------------------------------------------------------
// Balayage team_all et lecture des fils (identiques à v2, validés au test).
// ---------------------------------------------------------------------------

async function listAllConversations(teamId, cutoffTs) {
  const byId = new Map();
  let until = null;
  const limit = 50;
  let pages = 0;
  while (true) {
    let path = `/conversations?team_all=${teamId}&limit=${limit}`;
    if (until) path += `&until=${until}`;
    const { conversations = [] } = await api(path);
    if (conversations.length === 0) break;
    pages++;
    for (const c of conversations) byId.set(c.id, c);
    const oldest = conversations[conversations.length - 1].last_activity_at;
    if (pages % 20 === 0) {
      console.log(`  pages: ${pages}, fils: ${byId.size}, plus ancien: ${new Date(oldest * 1000).toISOString().slice(0, 10)}`);
    }
    if (oldest < cutoffTs) break;
    if (conversations.length < limit || oldest === until) break;
    until = oldest;
  }
  return [...byId.values()].filter((c) => (c.last_activity_at || 0) >= cutoffTs);
}

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

// ---------------------------------------------------------------------------
// Export d'une tranche : gzip + brouillon avec pièce jointe. JAMAIS send:true.
// ---------------------------------------------------------------------------

const RUN_STAMP = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
let trancheSeq = 0;

async function exportTranche(lines) {
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
        subject: `[NE PAS ENVOYER] Archive support, tranche ${suffix} (${lines.length} fils)`,
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
  console.log("=== Lasclay archive.js v3 ===");
  console.log(`Équipe: ${TEAM}`);
  console.log(`Fenêtre: ${MAX_AGE_DAYS} j | Plafond: ${LIMIT_CONV || "aucun"} | Tranche: ${TRANCHE} fils | Export: ${EXPORT_CONV}`);

  const cutoffTs = Math.floor(Date.now() / 1000) - MAX_AGE_DAYS * 86400;

  const done = await loadDoneFromMissive();

  console.log("Balayage de la liste des conversations (team_all)…");
  const all = await listAllConversations(TEAM, cutoffTs);
  console.log(`${all.length} fils dans la fenêtre de ${MAX_AGE_DAYS} jours.`);

  let todo = all.filter((c) => !done.has(c.id) && c.id !== EXPORT_CONV);
  if (LIMIT_CONV > 0) todo = todo.slice(0, LIMIT_CONV);
  console.log(`À archiver ce run: ${todo.length} fils.\n`);

  let n = 0, ok = 0, errors = 0, msgTotal = 0, emptyBodies = 0;
  let buffer = [];
  const t0 = Date.now();

  for (const conv of todo) {
    n++;
    try {
      const msgs = await listThreadMessages(conv.id);
      const bodies = await fetchBodies(msgs.map((m) => m.id));
      const record = {
        id: conv.id,
        subject: conv.subject || conv.latest_message_subject || null,
        last_activity_at: conv.last_activity_at,
        labels: (conv.shared_labels || []).map((l) => l.name || l.id),
        messages_count: msgs.length,
        messages: msgs.map((m) => {
          const raw = bodies.get(m.id) || m.body || m.preview || "";
          const body = cleanBody(raw);
          if (!body) emptyBodies++;
          const addr = (m.from_field?.address || m.from_field?.username || "").toLowerCase();
          return {
            id: m.id,
            date: m.delivered_at || m.created_at || null,
            type: m.type || null,
            from: m.from_field?.address || m.from_field?.name || null,
            direction: SELF.includes(addr) ? "nous" : "client",
            body,
          };
        }),
      };
      buffer.push(JSON.stringify(record));
      msgTotal += msgs.length;
      ok++;
    } catch (e) {
      errors++;
      console.warn(`[${n}/${todo.length}] ERREUR sur ${conv.id}: ${e.message} (on continue)`);
    }

    if (n % 50 === 0) {
      const mins = (Date.now() - t0) / 60000;
      const eta = mins / n * (todo.length - n);
      console.log(`[${n}/${todo.length}] ok: ${ok}, erreurs: ${errors}, ~${eta.toFixed(0)} min restantes`);
    }

    if (buffer.length >= TRANCHE) {
      await exportTranche(buffer);
      buffer = [];
    }
  }

  await exportTranche(buffer);

  console.log(`\nArchivage: ${ok} fils ok, ${errors} erreurs, ${msgTotal} messages, ${emptyBodies} corps vides.`);
  console.log("Run terminé. Les brouillons d'archive servent de stockage: ne pas les supprimer.");
})().catch((e) => { console.error("Erreur fatale:", e.message); process.exit(1); });
