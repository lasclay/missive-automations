/**
 * Lasclay — archive.js (v2, pensé pour Render)
 * --------------------------------------------
 * Archive brute d'une shared inbox Missive (filtre team_all) vers un JSONL,
 * puis EXPORT en pièce jointe gzippée dans un brouillon Missive (jamais envoyé),
 * parce que le disque Render est éphémère : sans export, le fichier disparaît
 * à la fin du run.
 *
 * LECTURE SEULE côté conversations clients. Seule écriture : le ou les
 * brouillons d'export dans la conversation EXPORT_CONV.
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN            requis (missive_pat-...)
 *   TEAM                     id d'équipe (défaut : LAS Support)
 *   MAX_AGE_DAYS             profondeur d'historique (défaut 730 = 2 ans)
 *   LIMIT_CONV               plafond de conversations ce run
 *                            (défaut 10 = test prudent; 0 = sans limite)
 *   OUT                      fichier de travail (défaut archive_support.jsonl)
 *   BATCH_IDS                nb de messages par GET groupé (défaut 10; 1 si échec)
 *   MISSIVE_SELF_ADDRESSES   nos adresses, séparées par virgules
 *                            (défaut hey@, admin@, operations@lasclay.com)
 *   EXPORT_CONV              id de la conversation Missive où attacher l'archive
 *                            (défaut : « Archives support »; mettre une valeur
 *                            VIDE pour désactiver l'export, utile en local).
 *   EXPORT_FROM              alias d'envoi du brouillon (défaut hey@lasclay.com)
 *   MISSIVE_ORG              org (défaut Lasclay)
 *
 * Sur Render : pas de reprise possible entre les runs (disque effacé).
 * Un run doit aller au bout; s'il plante, on repart de zéro.
 */

const fs = require("node:fs");
const zlib = require("node:zlib");

const TOKEN = process.env.MISSIVE_TOKEN;
const TEAM = process.env.TEAM || "e184d153-4472-4edd-9b35-f8867cf437a8"; // LAS Support
const MAX_AGE_DAYS = parseInt(process.env.MAX_AGE_DAYS || "730", 10);
const LIMIT_CONV = parseInt(process.env.LIMIT_CONV || "10", 10);
const OUT = process.env.OUT || "archive_support.jsonl";
const BATCH_IDS = Math.max(1, parseInt(process.env.BATCH_IDS || "10", 10));
const SELF = (process.env.MISSIVE_SELF_ADDRESSES ||
  "hey@lasclay.com,admin@lasclay.com,operations@lasclay.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
// Conversation « Archives support » (dans LAS Support) où déposer les brouillons d'export.
const EXPORT_CONV = process.env.EXPORT_CONV || "019eb488-6d42-7195-a2ae-11751d0a7a27";
const EXPORT_FROM = process.env.EXPORT_FROM || "hey@lasclay.com";
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36";

const API = "https://public.missiveapp.com/v1";
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (!TOKEN) { console.error("Manque MISSIVE_TOKEN."); process.exit(1); }

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
// Nettoyage : HTML → texte, puis coupe du texte cité (l'historique répété).
// ---------------------------------------------------------------------------

// Coupe au niveau HTML : tout ce qui suit le premier bloc de citation.
// (Le contenu cité est en fin de message; on accepte de perdre le rare
// texte écrit SOUS la citation.)
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

// HTML → texte lisible (repris du digest, éprouvé).
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

// Coupe au niveau texte : marqueurs de citation que le HTML n'a pas attrapés.
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
// Pagination team_all jusqu'à la profondeur voulue.
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
    console.log(`  pages: ${pages}, fils: ${byId.size}, plus ancien: ${new Date(oldest * 1000).toISOString().slice(0, 10)}`);
    if (oldest < cutoffTs) break;                                 // assez profond
    if (conversations.length < limit || oldest === until) break;  // dernière page
    until = oldest;
  }
  return [...byId.values()].filter((c) => (c.last_activity_at || 0) >= cutoffTs);
}

// ---------------------------------------------------------------------------
// Messages d'un fil : liste paginée, puis corps complets par fetch groupé.
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

// Corps complets via GET /messages/:id1,:id2,… (groupé). Repli unitaire si échec.
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
// Export : gzip + brouillon(s) Missive avec pièce jointe. JAMAIS send:true.
// ---------------------------------------------------------------------------

async function exportArchive() {
  if (!EXPORT_CONV) {
    console.log("EXPORT_CONV non défini: pas d'export Missive (fichier local seulement).");
    console.log("Sur Render, le fichier sera PERDU à la fin du run sans export.");
    return;
  }
  const raw = fs.readFileSync(OUT, "utf8");
  const lines = raw.split("\n").filter(Boolean);

  // Découpage en parts : on vise un gzip+base64 sous ~6 Mo par pièce jointe
  // (limite Missive: 10 Mo par requête JSON). Texte brut ~15 Mo par part.
  const RAW_TARGET = 15 * 1024 * 1024;
  const B64_MAX = 6.5 * 1024 * 1024;
  const parts = [];
  let chunk = [];
  let size = 0;
  for (const line of lines) {
    chunk.push(line);
    size += line.length + 1;
    if (size >= RAW_TARGET) { parts.push(chunk.join("\n")); chunk = []; size = 0; }
  }
  if (chunk.length) parts.push(chunk.join("\n"));

  console.log(`\nExport: ${lines.length} fils, ${(raw.length / 1048576).toFixed(1)} Mo brut, en ${parts.length} part(s).`);

  const stamp = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < parts.length; i++) {
    let pieces = [parts[i]];
    // Si une part gzippée dépasse quand même la limite, on la coupe en deux.
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
      const suffix = pieces.length > 1 ? `${i + 1}${"abcdefgh"[j]}` : `${i + 1}`;
      const filename = `archive_support_${stamp}_part${suffix}.jsonl.gz`;
      await apiPost("/drafts", {
        drafts: {
          conversation: EXPORT_CONV,
          organization: ORG,
          from_field: { address: EXPORT_FROM },
          to_fields: [{ address: EXPORT_FROM }],
          subject: `[NE PAS ENVOYER] Archive support ${stamp} (part ${suffix}/${parts.length})`,
          body: "Archive JSONL gzippée en pièce jointe. Brouillon technique, à télécharger puis supprimer.",
          attachments: [{ base64_data: b64, filename }],
        },
      });
      console.log(`  brouillon créé: ${filename} (${(b64.length / 1048576).toFixed(1)} Mo en base64)`);
    }
  }
  console.log("Export terminé. Va chercher les pièces jointes dans la conversation, puis supprime les brouillons.");
}

// ---------------------------------------------------------------------------
// Run principal
// ---------------------------------------------------------------------------

(async () => {
  console.log("=== Lasclay archive.js v2 ===");
  console.log(`Équipe: ${TEAM}`);
  console.log(`Fenêtre: ${MAX_AGE_DAYS} jours | Plafond ce run: ${LIMIT_CONV || "aucun"} | Export: ${EXPORT_CONV ? "oui" : "NON"}`);

  const cutoffTs = Math.floor(Date.now() / 1000) - MAX_AGE_DAYS * 86400;

  // Reprise (utile en local seulement; sur Render le fichier n'existe jamais au départ).
  const done = new Set();
  if (fs.existsSync(OUT)) {
    for (const line of fs.readFileSync(OUT, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try { done.add(JSON.parse(line).id); } catch {}
    }
    console.log(`Reprise: ${done.size} fils déjà dans ${OUT}, ils seront sautés.`);
  }

  console.log("Balayage de la liste des conversations (team_all)…");
  const all = await listAllConversations(TEAM, cutoffTs);
  console.log(`${all.length} fils dans la fenêtre de ${MAX_AGE_DAYS} jours.`);

  let todo = all.filter((c) => !done.has(c.id));
  if (LIMIT_CONV > 0) todo = todo.slice(0, LIMIT_CONV);
  console.log(`À archiver ce run: ${todo.length} fils.\n`);

  let n = 0, msgTotal = 0, emptyBodies = 0;
  for (const conv of todo) {
    n++;
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

    fs.appendFileSync(OUT, JSON.stringify(record) + "\n");
    msgTotal += msgs.length;
    console.log(`[${n}/${todo.length}] ${record.subject || "(sans sujet)"} — ${msgs.length} msg`);
  }

  console.log(`\nArchivage: ${n} fils, ${msgTotal} messages, ${emptyBodies} corps vides après nettoyage.`);
  if (emptyBodies > 0) console.log("Corps vides: à inspecter (caviardage possible, ou nettoyage trop agressif).");

  await exportArchive();
  console.log("Run terminé.");
})().catch((e) => { console.error("Erreur fatale:", e.message); process.exit(1); });
