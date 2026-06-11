/**
 * Lasclay — analyse.js (v1)
 * -------------------------
 * Transforme l'archive du service client en savoir exploitable :
 * `connaissance_support.md`, bâti sur TROIS PILIERS :
 *   1. CANNED RESPONSES (GET /responses) : le savoir officiel, intégré au complet.
 *   2. EXEMPLES (fils du label, avec commentaires internes) : logiques de décision.
 *   3. ARCHIVE GÉNÉRALE : volume statistique, ton réel, patrons de réponse.
 *
 * Pipeline :
 *   A. relit les tranches d'archive depuis les brouillons de EXPORT_CONV
 *      (dédoublonne, corrige les directions des vieilles tranches, filtre le bruit)
 *   B. fetch les canned responses
 *   C. classification Sonnet par lots de 20 fils (checkpoint exporté en brouillon,
 *      reprise possible)
 *   D. échantillonnage stratifié (catégorie × mois × langue; rares au complet)
 *   E. distillation Sonnet par catégorie + exemples + ton + canned responses
 *   F. assemble le .md et l'ENVOIE PAR COURRIEL (send:true) à REPORT_TO,
 *      avec copie en brouillon dans EXPORT_CONV.
 *
 * Écritures Missive : le checkpoint (brouillon), la copie du rapport (brouillon),
 * et UN courriel réel à REPORT_TO. Rien d'autre.
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN        requis
 *   ANTHROPIC_API_KEY    requis
 *   MODEL                défaut claude-sonnet-4-6 (Sonnet minimum, pas de Haiku)
 *   EXPORT_CONV          conversation des archives (défaut « Archives support »)
 *   REPORT_TO            destinataire du rapport (défaut hey@lasclay.com)
 *   EXPORT_FROM          alias d'envoi (défaut hey@lasclay.com)
 *   MISSIVE_ORG          org (défaut Lasclay)
 *   SAMPLE_MAX           plafond de fils par catégorie (défaut 80)
 *   TEST_LIMIT           0 = analyse complète; N = limite l'archive aux N fils
 *                        les plus récents (smoke test à petit prix)
 *   SEND_REPORT          "true" (défaut) = envoie le courriel; "false" = brouillon seulement
 */

const zlib = require("node:zlib");

const TOKEN = process.env.MISSIVE_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || "claude-sonnet-4-6";
const EXPORT_CONV = process.env.EXPORT_CONV || "019eb488-6d42-7195-a2ae-11751d0a7a27";
const REPORT_TO = process.env.REPORT_TO || "hey@lasclay.com";
const EXPORT_FROM = process.env.EXPORT_FROM || "hey@lasclay.com";
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36";
const SAMPLE_MAX = parseInt(process.env.SAMPLE_MAX || "80", 10);
const TEST_LIMIT = parseInt(process.env.TEST_LIMIT || "0", 10);
const SEND_REPORT = (process.env.SEND_REPORT || "true").toLowerCase() !== "false";

const SELF = ["hey@lasclay.com", "admin@lasclay.com", "operations@lasclay.com"];
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const SELF_NAMES = new Set(["lasclay"]);
const DMARC_RE = /^(\[preview\]\s*)?report domain:\s*lasclay\.com/i;

const API = "https://public.missiveapp.com/v1";
const mHeaders = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (!TOKEN) { console.error("Manque MISSIVE_TOKEN."); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error("Manque ANTHROPIC_API_KEY."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Règle transversale absolue : aucun tiret cadratin ni demi-cadratin.
const noDash = (s) => (s || "").replace(/\s*[—–]\s*/g, ", ");

async function api(path) {
  await sleep(260);
  const res = await fetch(`${API}${path}`, { headers: mHeaders });
  if (res.status === 429) { await sleep(30000); return api(path); }
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function apiPost(path, body) {
  await sleep(260);
  const res = await fetch(`${API}${path}`, { method: "POST", headers: mHeaders, body: JSON.stringify(body) });
  if (res.status === 429) { await sleep(30000); return apiPost(path, body); }
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json().catch(() => ({}));
}

// --- Appel Anthropic, avec retry sur 429/529 ---
async function claude(system, user, maxTokens) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await sleep(800);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens || 2000,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (res.status === 429 || res.status === 529) {
      console.warn(`Anthropic ${res.status}, pause ${attempt * 20} s…`);
      await sleep(attempt * 20000);
      continue;
    }
    if (!res.ok) throw new Error(`Anthropic → ${res.status} ${await res.text()}`);
    const data = await res.json();
    return (data.content || []).map((b) => b.text || "").join("\n").trim();
  }
  throw new Error("Anthropic: trop de tentatives.");
}

function parseJsonLoose(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = Math.min(...["[", "{"].map((c) => { const i = cleaned.indexOf(c); return i === -1 ? Infinity : i; }));
  if (start === Infinity) throw new Error("Pas de JSON dans la réponse.");
  return JSON.parse(cleaned.slice(start));
}

// --- Nettoyage HTML (canned responses) ---
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

// ---------------------------------------------------------------------------
// A. Relecture de l'archive depuis les brouillons
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

async function downloadGz(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`téléchargement HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return zlib.gunzipSync(buf).toString("utf8");
}

function fixDirections(rec) {
  for (const m of rec.messages || []) {
    const addr = (m.from || "").toLowerCase();
    const isUs = SELF.includes(addr) || SELF_NAMES.has(norm(m.from)) || !!m.author;
    m.direction = isUs ? "nous" : "client";
    // Scorie d'archivage: fragment de balise en fin de corps (coupe au milieu d'un tag).
    if (m.body) m.body = m.body.replace(/<[a-z][^>]*$/i, "").trim();
  }
  return rec;
}

async function loadArchive(drafts) {
  const byId = new Map();
  let files = 0;
  for (const d of drafts) {
    for (const a of d.attachments || []) {
      if (!/^archive_support_.*\.jsonl\.gz$/.test(a.filename || "")) continue;
      const text = await downloadGz(a.url);
      files++;
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        let rec;
        try { rec = JSON.parse(line); } catch { continue; }
        const prev = byId.get(rec.id);
        // Le plus riche gagne : exemple > plus de messages.
        if (!prev || (rec.exemple && !prev.exemple) ||
            (!!rec.exemple === !!prev.exemple && (rec.messages || []).length >= (prev.messages || []).length)) {
          byId.set(rec.id, rec);
        }
      }
    }
  }
  let fils = [...byId.values()].map(fixDirections);
  const beforeFilter = fils.length;
  fils = fils.filter((r) =>
    r.id !== EXPORT_CONV &&
    !DMARC_RE.test((r.subject || "").trim()) &&
    (r.messages || []).length > 0
  );
  if (TEST_LIMIT > 0) {
    fils.sort((a, b) => (b.last_activity_at || 0) - (a.last_activity_at || 0));
    fils = fils.slice(0, TEST_LIMIT);
  }
  console.log(`Archive: ${files} tranche(s), ${beforeFilter} fils bruts, ${fils.length} retenus${TEST_LIMIT ? " (TEST_LIMIT)" : ""}.`);
  return fils;
}

// ---------------------------------------------------------------------------
// B. Canned responses
// ---------------------------------------------------------------------------

async function fetchCannedResponses() {
  const all = new Map();
  for (const orgParam of [`&organization=${ORG}`, ""]) {
    let offset = 0;
    while (true) {
      const { responses = [] } = await api(`/responses?limit=200&offset=${offset}${orgParam}`);
      for (const r of responses) all.set(r.id, r);
      if (responses.length < 200) break;
      offset += 200;
    }
  }
  const list = [...all.values()].map((r) => ({
    titre: r.title || "(sans titre)",
    sujet: r.subject || null,
    corps: stripHtml(r.body || ""),
  })).filter((r) => r.corps);
  console.log(`Canned responses: ${list.length}.`);
  return list;
}

// ---------------------------------------------------------------------------
// C. Classification (par lots de 20, avec checkpoint en brouillon)
// ---------------------------------------------------------------------------

const CATEGORIES = [
  "suivi_livraison", "modification_annulation_commande", "retour_echange_remboursement",
  "question_pre_achat", "probleme_produit_garantie", "wholesale_b2b",
  "douane_international", "reponse_marketing", "spam_bruit", "autre",
];

function excerptFor(fil) {
  const first = (fil.messages || []).find((m) => m.direction === "client" && m.body);
  const reply = (fil.messages || []).find((m) => m.direction === "nous" && m.body);
  const parts = [`sujet: ${fil.subject || "(aucun)"}${fil.team ? " | équipe: " + fil.team : ""}`];
  if (first) parts.push(`client: ${first.body.slice(0, 350)}`);
  else parts.push(`client: (aucun message texte, pièces jointes: ${(fil.messages || []).flatMap((m) => m.attachments || []).slice(0, 3).join(", ") || "non"})`);
  if (reply) parts.push(`nous: ${reply.body.slice(0, 200)}`);
  return parts.join("\n");
}

async function loadCheckpoint(drafts) {
  const map = new Map();
  const cps = [];
  for (const d of drafts) for (const a of d.attachments || []) {
    if (/^analyse_classif_.*\.json\.gz$/.test(a.filename || "")) cps.push(a);
  }
  if (cps.length === 0) return map;
  cps.sort((a, b) => (a.filename < b.filename ? 1 : -1)); // le plus récent d'abord
  try {
    const obj = JSON.parse(await downloadGz(cps[0].url));
    for (const [id, v] of Object.entries(obj)) map.set(id, v);
    console.log(`Checkpoint de classification relu: ${map.size} fils déjà classés (${cps[0].filename}).`);
  } catch (e) {
    console.warn(`Checkpoint illisible (${e.message}), classification de zéro.`);
  }
  return map;
}

async function saveCheckpoint(map) {
  const obj = Object.fromEntries(map.entries());
  const b64 = zlib.gzipSync(Buffer.from(JSON.stringify(obj))).toString("base64");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  await apiPost("/drafts", {
    drafts: {
      conversation: EXPORT_CONV, organization: ORG,
      from_field: { address: EXPORT_FROM }, to_fields: [{ address: EXPORT_FROM }],
      subject: `[NE PAS ENVOYER] Checkpoint classification (${map.size} fils)`,
      body: "Checkpoint technique de analyse.js.",
      attachments: [{ base64_data: b64, filename: `analyse_classif_${stamp}.json.gz` }],
    },
  });
  console.log(`Checkpoint sauvegardé (${map.size} fils).`);
}

async function classifyAll(fils, classif) {
  const todo = fils.filter((f) => !classif.has(f.id));
  console.log(`Classification: ${todo.length} fils à classer (${classif.size} déjà faits).`);
  const system = noDash(
    "Tu classes des fils du service client de Lasclay (produits isolés à la soie d'asclépiade, Québec). " +
    `Catégories permises: ${CATEGORIES.join(", ")}. ` +
    "reponse_marketing = réponse d'un client à une infolettre ou promotion. " +
    "spam_bruit = spam, notifications automatiques, démarchage de fournisseurs. " +
    "Langues: fr, en, autre. " +
    'Réponds UNIQUEMENT avec un tableau JSON: [{"n":1,"categorie":"...","langue":"fr"}, ...]. Rien d\'autre.'
  );
  const BATCH = 20;
  let sinceSave = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    const user = chunk.map((f, j) => `--- fil ${j + 1} ---\n${excerptFor(f)}`).join("\n\n");
    let parsed = null;
    for (let attempt = 1; attempt <= 2 && !parsed; attempt++) {
      try { parsed = parseJsonLoose(await claude(system, user, 1500)); }
      catch (e) { console.warn(`  lot ${i / BATCH + 1}: réponse illisible (${e.message}), tentative ${attempt}/2`); }
    }
    for (let j = 0; j < chunk.length; j++) {
      const hit = Array.isArray(parsed) ? parsed.find((p) => p.n === j + 1) : null;
      classif.set(chunk[j].id, {
        c: hit && CATEGORIES.includes(hit.categorie) ? hit.categorie : "autre",
        l: hit && ["fr", "en", "autre"].includes(hit.langue) ? hit.langue : "autre",
      });
    }
    sinceSave += chunk.length;
    if ((i / BATCH) % 10 === 0) console.log(`  classés: ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
    if (sinceSave >= 2000) { await saveCheckpoint(classif); sinceSave = 0; }
  }
  if (todo.length > 0) await saveCheckpoint(classif);
  return classif;
}

// ---------------------------------------------------------------------------
// D. Échantillonnage stratifié (catégorie × mois × langue)
// ---------------------------------------------------------------------------

function sampleCategory(fils) {
  if (fils.length <= SAMPLE_MAX) return fils; // panier rare: au complet
  const strata = new Map();
  for (const f of fils) {
    const month = new Date((f.last_activity_at || 0) * 1000).toISOString().slice(0, 7);
    const key = `${month}|${f._l}`;
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key).push(f);
  }
  // Dans chaque strate: fils avec réponse de nous d'abord, puis fils plus longs.
  for (const arr of strata.values()) {
    arr.sort((a, b) => {
      const aN = a.messages.some((m) => m.direction === "nous") ? 1 : 0;
      const bN = b.messages.some((m) => m.direction === "nous") ? 1 : 0;
      if (aN !== bN) return bN - aN;
      return b.messages.length - a.messages.length;
    });
  }
  const keys = [...strata.keys()].sort();
  const out = [];
  let idx = 0;
  while (out.length < SAMPLE_MAX) {
    let took = false;
    for (const k of keys) {
      const arr = strata.get(k);
      if (idx < arr.length) { out.push(arr[idx]); took = true; if (out.length >= SAMPLE_MAX) break; }
    }
    if (!took) break;
    idx++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// E. Distillation
// ---------------------------------------------------------------------------

function filText(fil, maxChars) {
  const head = `SUJET: ${fil.subject || "(aucun)"}${fil.team ? " | équipe: " + fil.team : ""} | labels: ${(fil.labels || []).join(", ") || "aucun"}`;
  const msgLines = (fil.messages || []).map((m) => {
    const d = m.date ? new Date((m.date < 1e12 ? m.date * 1000 : m.date)).toISOString().slice(0, 10) : "?";
    const who = m.direction === "nous" ? `NOUS${m.author ? " (" + m.author + ")" : ""}` : "CLIENT";
    const att = m.attachments ? ` [PJ: ${m.attachments.join(", ")}]` : "";
    return `[${d}] ${who}${att}: ${m.body || "(sans texte)"}`;
  }).join("\n");
  const comLines = (fil.comments || []).map((c) =>
    `[COMMENTAIRE INTERNE ${c.author || "?"}]: ${c.body}${c.task ? " (tâche: " + c.task + ")" : ""}`
  ).join("\n");
  // Les commentaires internes sont la valeur des exemples: JAMAIS tronqués.
  // C'est le fil de messages qui se comprime pour leur faire de la place.
  let budget = maxChars - head.length - comLines.length - 20;
  if (budget < 800) budget = 800; // minimum de contexte de messages, quitte à dépasser un peu
  let msgs = msgLines;
  if (msgs.length > budget) msgs = msgs.slice(0, budget) + " […]";
  return [head, msgs, comLines].filter(Boolean).join("\n");
}

const BASE_SYSTEM = noDash(
  "Tu analyses le service client de Lasclay (lasclay.com, produits isolés à la soie d'asclépiade, Québec) " +
  "pour bâtir un document de savoir qui servira à automatiser les réponses. " +
  "Sois factuel, concret, et cite de courtes formulations réellement utilisées quand elles sont représentatives. " +
  "Règle absolue: n'utilise JAMAIS de tiret cadratin ni demi-cadratin; utilise virgule, deux-points ou parenthèses."
);

const CHUNK_CHARS = 40000; // taille visée d'un appel de distillation

async function distillChunks(fils, perFilChars, instructions) {
  // Lots par volume: les fils longs ne gonflent pas un appel au hasard,
  // les fils courts voyagent plus nombreux par appel.
  const texts = fils.map((f) => filText(f, perFilChars));
  const chunks = [];
  let cur = [], size = 0;
  for (const t of texts) {
    if (size + t.length > CHUNK_CHARS && cur.length > 0) { chunks.push(cur); cur = []; size = 0; }
    cur.push(t);
    size += t.length;
  }
  if (cur.length) chunks.push(cur);
  const notes = [];
  for (const c of chunks) {
    const user = instructions + "\n\n" +
      c.map((t, j) => `===== FIL ${j + 1} =====\n${t}`).join("\n\n");
    notes.push(await claude(BASE_SYSTEM, user, 2500));
  }
  return notes;
}

async function synthesize(title, notes, instructions) {
  const user = `${instructions}\n\nNOTES À SYNTHÉTISER:\n\n${notes.join("\n\n----------\n\n")}`;
  return noDash(await claude(BASE_SYSTEM, user, 3500));
}

// ---------------------------------------------------------------------------
// F. Livraison
// ---------------------------------------------------------------------------

async function deliver(md, statsLine) {
  const b64 = Buffer.from(md, "utf8").toString("base64");
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `connaissance_support_${stamp}.md`;
  // Copie en brouillon (stockage)
  await apiPost("/drafts", {
    drafts: {
      conversation: EXPORT_CONV, organization: ORG,
      from_field: { address: EXPORT_FROM }, to_fields: [{ address: EXPORT_FROM }],
      subject: `[NE PAS ENVOYER] Rapport: connaissance support ${stamp}`,
      body: noDash(`Rapport en pièce jointe. ${statsLine}`),
      attachments: [{ base64_data: b64, filename }],
    },
  });
  console.log(`Rapport déposé en brouillon: ${filename}`);
  if (SEND_REPORT) {
    await apiPost("/drafts", {
      drafts: {
        send: true,
        organization: ORG,
        from_field: { address: EXPORT_FROM },
        to_fields: [{ address: REPORT_TO }],
        subject: `Connaissance support Lasclay, ${stamp}`,
        body: noDash(`Bonjour,<br><br>Le document de connaissance du service client est prêt (en pièce jointe). ${statsLine}<br><br>Généré automatiquement par analyse.js.`),
        attachments: [{ base64_data: b64, filename }],
      },
    });
    console.log(`Rapport envoyé par courriel à ${REPORT_TO}.`);
  }
}

// ---------------------------------------------------------------------------
// Run principal
// ---------------------------------------------------------------------------

(async () => {
  console.log("=== Lasclay analyse.js v1 ===");
  console.log(`Modèle: ${MODEL} | SAMPLE_MAX: ${SAMPLE_MAX} | TEST_LIMIT: ${TEST_LIMIT || "aucun"} | Envoi courriel: ${SEND_REPORT}`);

  const drafts = await listExportDrafts();
  const fils = await loadArchive(drafts);
  if (fils.length === 0) { console.error("Aucun fil dans l'archive."); process.exit(1); }
  const canned = await fetchCannedResponses();

  // C. classification
  const classif = await classifyAll(fils, await loadCheckpoint(drafts));
  for (const f of fils) { const c = classif.get(f.id) || {}; f._c = c.c || "autre"; f._l = c.l || "autre"; }

  const byCat = new Map();
  for (const f of fils) { if (!byCat.has(f._c)) byCat.set(f._c, []); byCat.get(f._c).push(f); }
  console.log("\nRépartition:");
  for (const [c, arr] of [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${c}: ${arr.length}`);
  }

  // D + E. par catégorie (on saute le bruit pur)
  const exemples = fils.filter((f) => f.exemple);
  const sections = [];
  for (const [cat, arr] of [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
    if (cat === "spam_bruit" || cat === "reponse_marketing") continue;
    const sample = sampleCategory(arr);
    console.log(`\nDistillation « ${cat} »: ${sample.length}/${arr.length} fils…`);
    const notes = await distillChunks(sample, 12000, noDash(
      `Voici des fils de la catégorie « ${cat} ». Extrais en notes structurées: ` +
      "1) les sous-types de demandes et leur fréquence apparente, 2) la logique de réponse observée " +
      "(que fait-on selon le cas, quelles conditions mènent à quelle décision), 3) les formulations typiques de NOUS, " +
      "4) les cas particuliers ou pièges, 5) ce qui reste sans réponse ou se règle mal."
    ));
    const synth = await synthesize(cat, notes, noDash(
      `Synthétise ces notes en une section de document de savoir pour la catégorie « ${cat} ». ` +
      "Format markdown, niveau ###, sous-sections: Demandes types, Logique de réponse, Formulations éprouvées, Cas particuliers. " +
      "Concis mais complet, en prose, sans listes à puces excessives."
    ));
    sections.push(`## ${cat} (${arr.length} fils sur 2 ans)\n\n${synth}`);
  }

  // E2. exemples (logiques internes)
  let exemplesSection = "";
  if (exemples.length > 0) {
    console.log(`\nDistillation des ${exemples.length} exemples étiquetés (avec commentaires internes)…`);
    const notes = await distillChunks(exemples, Infinity, noDash(
      "Ces fils sont des EXEMPLES choisis par Gabriel, avec les commentaires internes de l'équipe. " +
      "Extrais surtout: les logiques de décision internes (pourquoi on répond comme ça), les règles implicites, " +
      "les erreurs commentées et leurs leçons, et ce que ces fils enseignent qu'on ne voit pas ailleurs."
    ));
    exemplesSection = await synthesize("exemples", notes, noDash(
      "Synthétise ces notes en une section « Logiques de décision internes » du document de savoir. " +
      "Markdown niveau ###, organisé par règle ou leçon, chaque règle avec son contexte d'application."
    ));
  }

  // E3. ton de marque (à partir des messages de NOUS)
  console.log("\nDistillation du ton de marque…");
  const nousMsgs = fils.flatMap((f) => f.messages.filter((m) => m.direction === "nous" && m.body && m.body.length > 60 && m.body.length < 1200).map((m) => ({ l: f._l, body: m.body })));
  const tonePick = [];
  for (const lang of ["fr", "en"]) {
    const pool = nousMsgs.filter((m) => m.l === lang);
    for (let i = 0; i < pool.length && tonePick.length < (lang === "fr" ? 80 : 120); i += Math.max(1, Math.floor(pool.length / 60))) tonePick.push(pool[i]);
  }
  const toneNotes = [];
  for (let i = 0; i < tonePick.length; i += 30) {
    toneNotes.push(await claude(BASE_SYSTEM, noDash(
      "Voici des réponses réelles de l'équipe Lasclay. Décris le ton: salutations, niveau de langue, " +
      "longueur, structure, signatures de style, différences FR/EN, et donne 8 à 10 formulations représentatives.\n\n"
    ) + tonePick.slice(i, i + 30).map((m, j) => `--- ${j + 1} (${m.l}) ---\n${m.body}`).join("\n\n"), 2500));
  }
  const toneSection = await synthesize("ton", toneNotes, noDash(
    "Synthétise en une section « Ton de marque » du document de savoir: comment Lasclay écrit, en FR et en EN, " +
    "avec les formulations à réutiliser et celles à éviter. Markdown niveau ###."
  ));

  // E4. canned responses (intégrées au complet, organisées)
  console.log("\nOrganisation des canned responses…");
  let cannedSection = "(aucune canned response trouvée)";
  if (canned.length > 0) {
    const cannedText = canned.map((r, i) => `--- ${i + 1}. ${r.titre}${r.sujet ? " | sujet: " + r.sujet : ""} ---\n${r.corps.slice(0, 1200)}`).join("\n\n");
    cannedSection = await synthesize("canned", [cannedText], noDash(
      "Voici TOUTES les canned responses officielles de Lasclay. Organise-les en savoir: regroupe par thème, " +
      "et pour chacune: son titre exact, quand l'utiliser, et son contenu intégral ou à peine condensé " +
      "(ne perds aucune information factuelle: politiques, délais, montants, liens). " +
      "ATTENTION: certaines peuvent être désuètes. C'est une référence importante, pas la Bible: " +
      "marque « [À VÉRIFIER] » toute réponse qui semble datée (anciennes politiques, vieux délais, liens suspects) " +
      "ou qui contredit ce qu'on observerait dans la pratique récente. Markdown niveau ###."
    ));
  }

  // F. assemblage
  const stats = `Corpus: ${fils.length} fils (${exemples.length} exemples), ${canned.length} canned responses, fenêtre 2 ans.`;
  const md = noDash([
    `# Connaissance du service client Lasclay`,
    `> Générée le ${new Date().toISOString().slice(0, 10)} à partir de ${stats}`,
    `> Répartition: ${[...byCat.entries()].sort((a, b) => b[1].length - a[1].length).map(([c, a]) => `${c} ${a.length}`).join(", ")}.`,
    ``, `# 1. Ton de marque`, toneSection,
    ``, `# 2. Savoir officiel (canned responses)`,
    `> Référence importante mais possiblement désuète par endroits: en cas de conflit avec la pratique récente (sections 3 et 4), la pratique récente l'emporte, et l'élément est à valider avec Gabriel.`,
    cannedSection,
    ``, `# 3. Logiques de décision internes (exemples commentés)`, exemplesSection || "(aucun exemple étiqueté)",
    ``, `# 4. Catégories de demandes`, sections.join("\n\n"),
  ].join("\n"));

  await deliver(md, stats);
  console.log("\nRun terminé.");
})().catch((e) => { console.error("Erreur fatale:", e.message); process.exit(1); });
