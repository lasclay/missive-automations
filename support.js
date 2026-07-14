/**
 * Lasclay — support.js (v2.13)
 * -------------------------
 * Réponses automatiques pour la shared inbox LAS Support, 3 fois par jour.
 * Pour chaque fil ouvert où le dernier mot revient au client, Sonnet rédige
 * une réponse dans la voix de Lasclay, nourrie du document de connaissance.
 *
 * v2.8 — ENVOI AUTOMATIQUE (optionnel, éteint par défaut):
 *   - Un brouillon PROPRE (verifRequise === false: aucune note, action ni
 *     alerte de voix) est ENVOYÉ directement si AUTO_SEND=true, dans une
 *     catégorie permise (SEND_CATEGORIES) et sous le plafond (SEND_LIMIT).
 *   - Tout brouillon avec la moindre note/action/alerte reste en BROUILLON,
 *     avec sa note interne, comme avant (jamais d'envoi auto).
 *   - Une NOTICE de transparence IA (avec numéro à appeler) est ajoutée au
 *     corps de TOUS les messages, envoyés comme brouillons.
 *   - AUTO_SEND absent/false => comportement identique à la v2.7 (brouillons).
 *
 * Mécanique anti-doublon: label « Draft AI Support », posé à la création du
 * brouillon, retiré quand le fil est fermé. Un message ENVOYÉ ne reçoit PAS ce
 * label (il dédoublonne des brouillons, pas des messages envoyés).
 *
 * GARDE-FOUS: DRY_RUN=true par défaut (ne crée/n'envoie RIEN), AUTO_SEND=false
 * par défaut (aucun envoi), DRAFT_LIMIT=5 par défaut.
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN, ANTHROPIC_API_KEY   requis
 *   MODEL          défaut claude-sonnet-4-6
 *   DRY_RUN        "false" = agit pour vrai; tout autre = simulation (défaut "true")
 *   AUTO_SEND      "true" = envoie les brouillons propres. Défaut false (brouillons only).
 *   SEND_LIMIT     plafond d'ENVOIS par run (défaut 0 = aucun plafond)
 *   SEND_CATEGORIES catégories permises à l'envoi auto, séparées par des virgules
 *                  (ex. "question_pre_achat"). Vide = toutes les catégories propres.
 *   SEND_ACTIONS   "true" = envoie aussi les brouillons qui PROMETTENT une action
 *                  (remboursement, annulation, rabais, renvoi); l'action part dans
 *                  un digest à traiter. Défaut false. Une note à VÉRIFIER ou une
 *                  alerte de voix bloque toujours l'envoi.
 *   ACTIONS_CONV   conversation où déposer le digest des actions/remboursements
 *                  (défaut: EXPORT_CONV « Archives support »).
 *   SEND_QC        "true" (défaut) = un 2e modèle (Opus) contrôle chaque candidat à
 *                  l'envoi; refus => rétrogradé en brouillon. "false" pour désactiver.
 *   QC_MODEL       modèle du contrôle qualité d'envoi (défaut claude-opus-4-8).
 *   QC_SKIP_SAFE   "true" (défaut) = un brouillon SANS aucun signal de risque (aucune alerte,
 *                  aucune note, aucune action, catégorie non sensible) est envoyé SANS QC Opus.
 *                  "false" = tout candidat passe au QC (comportement v2.13).
 *   QC_LEAN        "true" (défaut) = le QC Opus reçoit un contexte allégé (catalogue + voix +
 *                  corrections, sans les 224 canned), pour réduire le coût par relecture.
 *   QC_ESCALADE    "true" (défaut) = Sonnet, en associé, peut escalader un cas difficile ou à enjeu
 *                  vers la relecture Opus (en plus des signaux et catégories sensibles). "false"
 *                  ignore son jugement d'escalade (le plancher déterministe reste actif).
 *   DIGEST_SUPPORT "true" = poste un « pouls du service » (digest bref, escalade
 *                  sélective) une fois par jour. Défaut false.
 *   DIGEST_HOUR    heure UTC du run où poster le pouls (défaut 10; -1 = chaque run).
 *   RESUME_CONV    conversation « Résumé Support » où poster le pouls (sinon log seul).
 *   DIGEST_MODEL   modèle du pouls (défaut = MODEL; claude-opus-4-8 pour un meilleur tri).
 *   RELANCE_LABEL  label « Relance » posé sur un fil envoyé qui demande un suivi de notre
 *                  part (l'API Missive n'a pas de snooze temporisé; on ferme + on étiquette).
 *
 * v2.12: Opus ne fait plus que retenir, il CORRIGE les brouillons réparables avant l'envoi.
 * Après un envoi: le fil est FERMÉ (se rouvre si le client répond). Si le suivi dépend de
 * NOUS (ex. vente), on ferme + label « Relance » + note datée (le délai idéal vient de l'IA).
 *   DRAFT_LIMIT    plafond de sorties (brouillons + envois) par run (défaut 5; 0 = illimité)
 *   MAX_FILS       plafond de fils analysés par run (défaut 40)
 *   KNOWLEDGE_FILE chemin du document de connaissance (défaut ./connaissance_support.md)
 *   TEAMS, DRAFT_LABEL, EXPORT_CONV, MISSIVE_ORG, EXPORT_FROM   overrides
 */

const fs = require("node:fs");
const zlib = require("node:zlib");

const TOKEN = process.env.MISSIVE_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || "claude-sonnet-4-6";
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false";
const DRAFT_LIMIT = parseInt(process.env.DRAFT_LIMIT || "5", 10);
const MAX_FILS = parseInt(process.env.MAX_FILS || "40", 10);
const KNOWLEDGE_FILE = process.env.KNOWLEDGE_FILE || "./connaissance_support.md";

// v2.8 — Envoi automatique des brouillons propres (verifRequise === false).
const AUTO_SEND = (process.env.AUTO_SEND || "").toLowerCase() === "true";
const SEND_LIMIT = parseInt(process.env.SEND_LIMIT || "0", 10) || 0; // 0 = pas de plafond
const SEND_CATEGORIES = (process.env.SEND_CATEGORIES || "")
  .split(",").map((s) => s.trim()).filter(Boolean); // vide = toutes catégories
// v2.9 — envoie aussi les brouillons qui promettent une ACTION (ex. remboursement);
// l'action part dans un digest. Une note à vérifier ou une alerte bloque toujours.
const SEND_ACTIONS = (process.env.SEND_ACTIONS || "").toLowerCase() === "true";
// v2.10 — deuxième avis d'Opus avant chaque envoi (Sonnet rédige, Opus contrôle).
const SEND_QC = (process.env.SEND_QC || "true").toLowerCase() !== "false"; // défaut ON quand on envoie
const QC_MODEL = process.env.QC_MODEL || "claude-opus-4-8";
// v2.14 — Lever 1: sauter le QC sur les envois sans aucun risque. Lever 2: contexte QC allégé.
const QC_SKIP_SAFE = (process.env.QC_SKIP_SAFE || "true").toLowerCase() !== "false";
const QC_LEAN = (process.env.QC_LEAN || "true").toLowerCase() !== "false";
// Catégories où même un brouillon « propre » mérite le contrôle Opus (enjeu client réel).
const CATS_SENSIBLES = new Set([
  "retour_echange_remboursement", "probleme_produit_garantie", "wholesale_b2b", "douane_international",
]);
// v2.15 — Sonnet agit en associé au service client: il escalade (escalade=true) les cas difficiles
// ou à enjeu vers le QC Opus. ADDITIF: son jugement ajoute du QC, ne saute jamais un signal ni une
// catégorie sensible. Un détecteur d'enjeu déterministe complète son jugement (gratuit).
const QC_ESCALADE = (process.env.QC_ESCALADE || "true").toLowerCase() !== "false";
// v2.11 — pouls du service (digest bref, escalade sélective). Un seul par jour: on
// ne poste qu'au run dont l'heure UTC = DIGEST_HOUR (-1 = à chaque run).
const DIGEST_SUPPORT = (process.env.DIGEST_SUPPORT || "").toLowerCase() === "true";
const DIGEST_HOUR = parseInt(process.env.DIGEST_HOUR || "10", 10);
const RESUME_CONV = process.env.RESUME_CONV || ""; // conversation « Résumé Support » (absent = log seul)
const DIGEST_MODEL = process.env.DIGEST_MODEL || MODEL;
// v2.12 — fermeture des fils envoyés, et capture de relance (le snooze n'existe pas
// dans l'API Missive). RELANCE_LABEL: label « Relance » à créer dans Missive.
const RELANCE_LABEL = process.env.RELANCE_LABEL || "019f5d2f-51ca-70f0-83cc-2175b52d5a41"; // « Relance »

// Notice de transparence IA, ajoutée en pied de TOUS les messages (envoyés et
// brouillons). Ajoutée APRÈS la détection d'alertes, pour que son numéro de
// téléphone ne déclenche pas l'alerte de voix. Rédigée sans tu/vous.
const NOTICE_HTML =
  "<br><br>Petit mot en toute transparence : ce message a été préparé par un nouveau " +
  "système de réponse assisté par intelligence artificielle, présentement en rodage. " +
  "S'il y a le moindre problème, il est possible de me joindre directement au " +
  "581-982-5857 pour régler le dossier rapidement.";

// Équipes balayées (inbox ET fermés). Surchargeable via TEAMS="id1,id2,...".
const DEFAULT_TEAMS = [
  "e184d153-4472-4edd-9b35-f8867cf437a8", // LAS Support
  // "0db185c1-3a93-4a44-9f50-dcfe8c0683dd", // Mise à jour commande: RETIRÉE (gérée en masse via Klaviyo)
  "cc587c84-63b9-4e88-993c-4f4b5b328173", // RETOURS-ÉCHANGES
  "d6f28d2f-06ef-4aa5-aae0-b68f014e3216", // Vente - info pré-achat
  "13d8a7bd-ed2e-4e0c-8cf3-2329ebaed217", // USA
  "9240aa4e-3e81-40aa-a07a-84f6b1c2231e", // Expéditions prioritaires
  "80ae6958-8266-4898-9d80-38851eb3ba69", // LAS R&D
];
const TEAMS = (process.env.TEAMS || "").split(",").map((s) => s.trim()).filter(Boolean);
const TEAM_IDS = TEAMS.length > 0 ? TEAMS : DEFAULT_TEAMS;
const LIST_TEAMS = (process.env.LIST_TEAMS || "").toLowerCase() === "true";
const DRAFT_LABEL = process.env.DRAFT_LABEL || "019eb935-9b22-7d14-8aeb-614a1e303e24"; // « Draft AI Support » (dédié à ce script)
const EXPORT_CONV = process.env.EXPORT_CONV || "019eb488-6d42-7195-a2ae-11751d0a7a27"; // « Archives support » (mémoire excuses)
const ACTIONS_CONV = process.env.ACTIONS_CONV || EXPORT_CONV; // digest des actions/remboursements à faire
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36";
const EXPORT_FROM = process.env.EXPORT_FROM || "hey@lasclay.com";

// Tri v1 (simple, à raffiner selon les corrections de Gabriel)
const TRI_LABELS = {
  suivi_livraison: "4bdc81b5-74a9-4246-9ced-3d9c1b13b0ed",                 // Mise à jour commande
  modification_annulation_commande: "4bdc81b5-74a9-4246-9ced-3d9c1b13b0ed", // Mise à jour commande
  retour_echange_remboursement: "b2ff154e-65f1-498f-8bfd-40c52854fd69",    // RETOURS - ECHANGES
  probleme_produit_garantie: "b2ff154e-65f1-498f-8bfd-40c52854fd69",       // RETOURS - ECHANGES
  question_pre_achat: "cf24d86b-ba38-41b2-bed7-0a4f43b1b2e4",              // Ventes - info pré-achat
  douane_international: "7150fdfb-af9c-4844-835d-96c73da211d6",            // USA
};

const SELF = (process.env.MISSIVE_SELF_ADDRESSES ||
  "hey@lasclay.com,admin@lasclay.com,operations@lasclay.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const SELF_NAMES = new Set((process.env.MISSIVE_SELF_NAMES || "lasclay").split(",").map(norm).filter(Boolean));

const API = "https://public.missiveapp.com/v1";
const mHeaders = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (!TOKEN) { console.error("Manque MISSIVE_TOKEN."); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error("Manque ANTHROPIC_API_KEY."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const noDash = (s) => (s || "").replace(/\s*[—–]\s*/g, ", ");
const sanit = (s) => (s || "")
  .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
  .replace(/(^|[^\uD800-\uDBFF])([\uDC00-\uDFFF])/g, "$1");

// --- Appels Missive avec retry réseau + 429 (patron validé d'analyse.js) ---
async function api(path) {
  let netTries = 0;
  while (true) {
    await sleep(260);
    let res;
    try { res = await fetch(`${API}${path}`, { headers: mHeaders }); }
    catch (e) {
      if (++netTries > 5) throw new Error(`${path} → réseau: ${e.message}`);
      console.warn(`Réseau Missive (${e.message}), tentative ${netTries}/5…`);
      await sleep(netTries * 10000);
      continue;
    }
    if (res.status === 429) { await sleep(30000); continue; }
    if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
    return res.json();
  }
}

async function apiPost(path, body) {
  const payload = JSON.stringify(body);
  let netTries = 0;
  while (true) {
    await sleep(260);
    let res;
    try { res = await fetch(`${API}${path}`, { method: "POST", headers: mHeaders, body: payload }); }
    catch (e) {
      if (++netTries > 5) throw new Error(`${path} → réseau: ${e.message}`);
      console.warn(`Réseau Missive (${e.message}), tentative ${netTries}/5…`);
      await sleep(netTries * 10000);
      continue;
    }
    if (res.status === 429) { await sleep(30000); continue; }
    if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
    return res.json().catch(() => ({}));
  }
}

// --- Appel Anthropic (system en TABLEAU pour le cache de prompt) ---
async function claude(systemBlocks, user, maxTokens) {
  const payload = JSON.stringify({
    model: MODEL,
    max_tokens: maxTokens || 1500,
    system: systemBlocks,
    messages: [{ role: "user", content: sanit(user) }],
  });
  for (let attempt = 1; attempt <= 6; attempt++) {
    await sleep(800);
    let res;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: payload,
      });
    } catch (e) {
      console.warn(`Réseau Anthropic (${e.message}), tentative ${attempt}/6…`);
      await sleep(attempt * 15000);
      continue;
    }
    if (res.status === 429 || res.status === 529) { await sleep(attempt * 20000); continue; }
    if (!res.ok) throw new Error(`Anthropic → ${res.status} ${await res.text()}`);
    const data = await res.json();
    return (data.content || []).map((b) => b.text || "").join("\n").trim();
  }
  throw new Error("Anthropic: trop de tentatives.");
}

function parseJsonLoose(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("Pas de JSON dans la réponse.");
  return JSON.parse(cleaned.slice(start, cleaned.lastIndexOf("}") + 1));
}

// --- Nettoyage des corps (patron validé d'archive.js) ---
function cutQuotedHtml(html) {
  if (!html) return "";
  const markers = [/<blockquote/i, /class="gmail_quote/i];
  let cut = html.length;
  for (const re of markers) { const m = html.search(re); if (m !== -1 && m < cut) cut = m; }
  return html.slice(0, cut);
}
function stripHtml(s) {
  if (!s) return "";
  let t = s.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  t = t.replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
       .replace(/&gt;/gi, ">").replace(/&#39;|&rsquo;/gi, "'").replace(/&quot;/gi, '"');
  return t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function cutQuotedText(text) {
  if (!text) return "";
  const markers = [
    /^\s*Le .{0,120}? a écrit\s*:/im, /^\s*On .{0,120}? wrote\s*:/im,
    /^\s*-{2,}\s*(Original Message|Message d'origine|Forwarded message|Message transféré)/im,
  ];
  let cut = text.length;
  for (const re of markers) { const m = text.search(re); if (m !== -1 && m < cut) cut = m; }
  return text.slice(0, cut).replace(/<[a-z][^>]*$/i, "").trim();
}
const cleanBody = (html) => cutQuotedText(stripHtml(cutQuotedHtml(html)));

// --- Listages Missive ---
async function listByFilter(filter) {
  const byId = new Map();
  let until = null;
  while (true) {
    let path = `/conversations?${filter}&limit=50`;
    if (until) path += `&until=${until}`;
    const { conversations = [] } = await api(path);
    if (conversations.length === 0) break;
    for (const c of conversations) byId.set(c.id, c);
    const oldest = conversations[conversations.length - 1].last_activity_at;
    if (conversations.length < 50 || oldest === until) break;
    until = oldest;
  }
  return [...byId.values()];
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
  return [...byId.values()].sort((a, b) => (a.delivered_at || a.created_at || 0) - (b.delivered_at || b.created_at || 0));
}

async function fetchBodies(ids) {
  const bodies = new Map();
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    try {
      const r = await api(`/messages/${chunk.join(",")}`);
      const arr = Array.isArray(r.messages) ? r.messages : [r.messages];
      for (const m of arr) if (m && m.id) bodies.set(m.id, m.body || m.preview || "");
    } catch (e) {
      for (const id of chunk) {
        try {
          const r = await api(`/messages/${id}`);
          const m = Array.isArray(r.messages) ? r.messages[0] : r.messages;
          if (m) bodies.set(id, m.body || m.preview || "");
        } catch {}
      }
    }
  }
  return bodies;
}

const isUs = (m) => {
  const addr = (m.from_field?.address || "").toLowerCase();
  return SELF.includes(addr) || SELF_NAMES.has(norm(m.from_field?.name || m.from_field?.username)) || !!m.author?.name;
};

// --- Mémoires persistantes (brouillon-stockage, patron validé des checkpoints) ---
async function loadJsonMemory(drafts, pattern, label) {
  const cps = [];
  for (const d of drafts) for (const a of d.attachments || []) {
    if (pattern.test(a.filename || "")) cps.push(a);
  }
  if (cps.length === 0) return new Map();
  cps.sort((a, b) => (a.filename < b.filename ? 1 : -1));
  try {
    const res = await fetch(cps[0].url);
    const obj = JSON.parse(zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString());
    console.log(`${label} relue: ${Object.keys(obj).length} entrée(s).`);
    return new Map(Object.entries(obj));
  } catch (e) {
    console.warn(`${label} illisible (${e.message}), repart à neuf.`);
    return new Map();
  }
}

async function saveJsonMemory(map, prefix, sujet) {
  const b64 = zlib.gzipSync(Buffer.from(JSON.stringify(Object.fromEntries(map.entries())))).toString("base64");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  await apiPost("/drafts", {
    drafts: {
      conversation: EXPORT_CONV, organization: ORG,
      from_field: { address: EXPORT_FROM }, to_fields: [{ address: EXPORT_FROM }],
      subject: `[NE PAS ENVOYER] ${sujet} (${map.size})`,
      body: "Stockage technique de support.js.",
      attachments: [{ base64_data: b64, filename: `${prefix}_${stamp}.json.gz` }],
    },
  });
  console.log(`${sujet} sauvegardée (${map.size} entrée(s)).`);
}

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

// --- Catalogue produits (Shopify) ---
// Collections à charger. products.json donne les données structurées; repli HTML sinon.
const CATALOG_COLLECTIONS = (process.env.CATALOG_COLLECTIONS ||
  "https://lasclay.com/collections/produits-products,https://lasclay.com/collections/garden")
  .split(",").map((s) => s.trim()).filter(Boolean);

async function fetchText(url, attempts = 3) {
  for (let a = 1; a <= attempts; a++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "LasclaySupportBot/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (a === attempts) { console.warn(`  catalogue: ${url} échoue (${e.message})`); return null; }
      await sleep(a * 3000);
    }
  }
}

function htmlToPlain(s) {
  return (s || "").replace(/<\/(p|div|li|h[1-6]|br)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#39;|&rsquo;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function chargerCatalogue() {
  const fiches = [];
  const vus = new Set();
  for (const col of CATALOG_COLLECTIONS) {
    const base = col.replace(/\/$/, "");
    // products.json paginé (250 max par page).
    let page = 1, viaJson = false;
    while (page <= 5) {
      const txt = await fetchText(`${base}/products.json?limit=250&page=${page}`);
      if (!txt) break;
      let data;
      try { data = JSON.parse(txt); } catch { break; }
      const prods = data.products || [];
      if (prods.length === 0) break;
      viaJson = true;
      for (const p of prods) {
        if (vus.has(p.id)) continue;
        vus.add(p.id);
        const variantes = (p.variants || []).map((v) => {
          const dispo = v.available === false ? "ÉPUISÉ" : "disponible";
          return `${v.title} (${v.price ? v.price + " $" : "prix ?"}, ${dispo})`;
        }).join("; ");
        const desc = htmlToPlain(p.body_html || "").slice(0, 800);
        fiches.push(
          `### ${p.title}\n` +
          `URL: ${base.replace(/\/collections\/.*$/, "")}/products/${p.handle}\n` +
          (p.product_type ? `Type: ${p.product_type}\n` : "") +
          (variantes ? `Variantes: ${variantes}\n` : "") +
          (desc ? `Description: ${desc}\n` : "")
        );
      }
      if (prods.length < 250) break;
      page++;
    }
    if (!viaJson) {
      // Repli HTML: au moins capter les noms de produits visibles.
      const html = await fetchText(base);
      if (html) {
        const noms = [...html.matchAll(/\/products\/([a-z0-9-]+)"[^>]*>([^<]{3,80})</gi)]
          .map((m) => m[2].trim()).filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 60);
        if (noms.length) fiches.push(`### (Liste partielle via HTML de ${base})\n` + noms.join("\n"));
      }
    }
  }
  if (fiches.length === 0) {
    console.warn("Catalogue: aucun produit chargé (réseau ou structure). Le script continue sans catalogue.");
    return null;
  }
  const txt = fiches.join("\n\n");
  console.log(`Catalogue chargé: ${fiches.length} produit(s), ${(txt.length / 1024).toFixed(0)} Ko.`);
  return txt;
}

// --- Instructions de voix (acquis du digest + nouveautés support) ---
const VOICE = noDash(`
Tu rédiges des brouillons de réponse au service client de Lasclay, dans la voix de Gabriel:
gestionnaire occupé, droit au but sans être raide, accessible, jamais vendeur.

RÈGLES ABSOLUES:
- Réponds dans la LANGUE du dernier message du client (français → français québécois, anglais → anglais).
- Salutation: « Bonjour [Prénom], » (FR) / « Hi [First name], » (EN) / « Bonjour, » si prénom inconnu.
  TOUJOURS « Bonjour », JAMAIS « Bonsoir »: le brouillon peut être envoyé à n'importe quelle heure.
- PRÉNOM: utilise le vrai prénom (signature du client ou nom de commande), JAMAIS un prénom déduit de
  l'adresse courriel (« karo.trudo@ » n'est pas « Karo »). Si le prénom est incertain, écris
  « Bonjour, » / « Hi, » sans prénom plutôt que de risquer le mauvais.
- NE SIGNE PAS et NE CONCLUS PAS: pas de « Chaleureusement », pas de « Merci », pas de nom à la fin.
  Termine sur la dernière phrase utile. La signature Missive (qui contient déjà « Chaleureusement, »)
  s'ajoute automatiquement.
- LIS TOUT LE FIL avant de répondre, y compris l'infolettre ou le message d'origine: la réponse
  au problème du client s'y trouve souvent. Réponds au CONTENU RÉEL; ne pose jamais de question
  dont la réponse est déjà dans le fil.
- COHÉRENCE TEMPORELLE (règle critique): utilise la DATE D'AUJOURD'HUI fournie. Beaucoup de fils
  datent de plusieurs mois. Sur un fil VIEUX (dernier message du client il y a plus de ~3 semaines):
  ne promets RIEN d'actif (pas « j'ajoute à ta commande », « j'expédie », « je t'envoie le lien »):
  la commande est presque sûrement déjà traitée ou expédiée. Le bon réflexe par défaut: s'excuser
  du délai et DEMANDER si la demande est encore d'actualité, sans relancer une action obsolète.
- CATALOGUE PRODUITS: le bloc CATALOGUE PRODUITS ACTUEL est la source de vérité sur ce qui existe.
  Ne dis JAMAIS « on ne fait pas ce produit » ou « on n'a pas ça » sans avoir vérifié le catalogue:
  Lasclay a lancé beaucoup de nouveautés (manteaux/parkas, gants, oreiller, mitaines laine/cuir,
  sac de couchage, isolant en vrac et rouleau, etc.), souvent EN PRÉCOMMANDE pour l'automne 2026.
  Quand c'est pertinent, mentionne le bon produit avec son lien et son statut, et invite à voir le
  catalogue: https://lasclay.com/collections/produits-products (jardin: /collections/garden).
- LIENS PAYS: pour un client des USA, les liens du site utilisent le préfixe /en-us (prix en USD):
  https://lasclay.com/en-us/products/... Pour un client canadien anglophone, préfixe /en (CAD).
  En français, pas de préfixe (racine). Le script corrige au besoin, mais vise le bon préfixe.
- N'invente AUCUN fait: prix, délais, politiques et liens viennent du document de connaissance ou du catalogue.

JAMAIS DIRE « JE NE SAIS PAS » NI FAIRE D'AVEU AU CLIENT: le client doit repartir avec une réponse,
pas avec « je vérifie et je reviens » (sauf pour un colis non livré à vérifier avec Postes Canada).
Si une info te manque (ex.: pourquoi un article n'était pas ajoutable au panier), affirme l'explication
la PLUS PLAUSIBLE (95 % du temps un article non ajoutable = épuisé) et mets la vérification en note_interne.
N'avoue jamais un « bug connu », une faille, une ignorance: ça mine la confiance.

INFO OU STOCK À VÉRIFIER, LAISSER UN BLANC: si une disponibilité ou une donnée précise est incertaine,
ne tranche PAS au hasard dans le brouillon. Écris la phrase avec un champ à compléter
(ex.: « on a encore des [modèle] en [TAILLE À CONFIRMER] ») et mets la vérification en note_interne.
Mieux vaut un blanc à remplir qu'une affirmation fausse à corriger.

DÉLAIS: ne CHIFFRE jamais le nombre de jours ou de mois de retard dans le brouillon (« 137 jours »,
« 5 mois »): ça souligne notre incompétence. On s'excuse d'un délai « beaucoup trop long » /
« inacceptable », sans le quantifier.

DEMANDE D'ADRESSE: on a déjà l'adresse au dossier. Ne demande jamais « donne-moi ton adresse », et
ne dis jamais « on ne t'appelle pas ». Formule une simple reconfirmation: « L'adresse postale est-elle
toujours au [insérer adresse]? ». Le champ adresse est à compléter (laisser un blanc).

NOTES INTERNES DU FIL: si le fil contient des commentaires internes de l'équipe (anciennes notes,
to-dos, « lis ma note du... »), ils contiennent souvent la marche à suivre exacte (client à intégrer
au programme R&D, modèle à offrir, travail déjà fait). Lis-les et tiens-en compte avant de rédiger.

ÉTAT D'UNE COMMANDE (règle critique): tu ne VOIS PAS la commande Shopify. N'affirme JAMAIS:
un montant de commande, qu'un code promo a été appliqué ou non, le contenu de la commande,
son statut d'expédition, ou des frais qui s'y rattacheraient. Le brouillon reste neutre et vrai
dans tous les cas. PAS BESOIN de note_interne pour dire de consulter Shopify: Gabriel le fait
systématiquement avant d'envoyer, c'est implicite.

EXCUSES GRADUÉES (selon le CONTEXTE D'ATTENTE fourni):
- 3 jours ou moins: pas d'excuse nécessaire, ou très légère.
- Fil sans grief réel (le client remercie, a résolu lui-même, ou tout va bien): n'invente AUCUNE excuse,
  un mot chaleureux suffit. Ne t'excuse jamais d'un délai qui n'existe pas.
- STRUCTURE DE L'EXCUSE (RÈGLE CRITIQUE): une excuse de délai n'est JAMAIS creuse. « Désolé du délai,
  c'est beaucoup trop long » ou « désolé du délai à te répondre » tout court, qui ne font que répéter ou
  constater le délai, sont BANNIS: robotiques et vides. Toute excuse porte un complément: soit un
  POURQUOI concret (prévente intense, manque de temps, enjeux de main-d'oeuvre), soit un cadrage « ce
  n'est pas dans nos habitudes / ça ne nous ressemble pas ». Jamais l'excuse nue, jamais en ouverture.
- 4 à 10 jours: excuse simple et sincère (période chargée, manque de temps), jamais en ouverture,
  PLUS une courte admission qu'on aurait dû répondre plus vite et qu'on va faire mieux.
- Plus de 10 jours, OU 2 messages et plus du client sans réponse (fils ouverts du même client inclus):
  excuse APPUYÉE: reconnaître que ce délai est inacceptable et que ce n'est pas dans nos habitudes,
  en faire un peu plus, sans s'aplatir. Entrer d'abord dans le sujet en une phrase, puis l'excuse forte.
- INTERDIT comme formulation d'excuse: « c'est plus long qu'à l'habitude de notre côté en ce moment »
  et ses variantes contournées: c'est bizarre. Des excuses naturelles et variées.
- Un mois et plus: excuse MAXIMALE: en plus de ce qui précède, fournir une explication concrète et
  plausible (courriel tombé dans les indésirables, enjeux de main-d'œuvre, période très intense),
  avouer que ce n'est pas à la hauteur de nos standards, et promettre de faire mieux.

SOBRIÉTÉ DE L'EXCUSE (RÈGLE CRITIQUE, ne pas en beurrer épais): même pour une excuse appuyée ou
maximale, UN SEUL marqueur d'excuse, DEUX au grand maximum. On ne s'auto-flagelle JAMAIS. Le client
veut une excuse sincère et brève, puis du service, pas un étalage de culpabilité.
- INTERDIT (autoflagellation): « tu méritais mieux », « tu méritais une réponse bien avant »,
  « ça ne me ressemble pas », « je suis gêné », « c'est gênant », « c'est désolant »,
  « on n'est pas fiers », et tout empilement du genre « inacceptable + pas à la hauteur + tu méritais ».
- « pas à la hauteur de nos standards » et « ce n'est pas dans nos habitudes »: au plus UN des deux,
  jamais les deux, jamais en plus de « inacceptable ».
- Dire « pas dans nos habitudes », JAMAIS « pas notre façon de faire ».
- MIEUX: après une excuse brève, se tourner vers l'AVENIR (« on promet de faire mieux à l'avenir »,
  « on va se reprendre ») plutôt que de s'appesantir sur la faute passée. Le ton regarde devant.
- « inacceptable » est permis mais à DOSER: pas dans chaque phrase, varie le vocabulaire
  (« beaucoup trop long », « on aurait dû te répondre avant », « désolé du gros délai »).
- VIDÉO DU PIVOT (à utiliser avec parcimonie): pour une excuse maximale où une vraie explication
  s'impose, on peut référer à notre vidéo qui raconte honnêtement le pivot de notre modèle d'affaires
  et la perte d'employés: https://www.youtube.com/watch?v=GKyHh-Ok9JU
  (ex.: « si ça t'intéresse de comprendre ce qui s'est passé chez nous, on l'explique ici: lien »).
  JAMAIS deux fois au même client: si tu la sers, inclus-la dans excuse_utilisee.
- TOUJOURS une seule excuse par message, formulation variée, et JAMAIS une excuse déjà servie
  à ce client (liste fournie).
- INTERDIT: « on te reçoit bien », « on reçoit bien tes courriels » et toute formulation qui confirme
  la réception des messages: c'est bizarre et ça n'excuse rien.

CONNAISSANCES CORRIGÉES PAR GABRIEL (priment sur le document de connaissance):
- Expédition par timbre régulier SANS suivi: UNIQUEMENT les graines, ou une commande d'un SEUL petit
  article léger (cache-cou, tuque, étui de cellulaire). L'huile d'asclépiade n'est PAS expédiée par
  timbre. En cas de doute sur le mode d'expédition d'une commande: n'affirme RIEN sur le mode,
  la commande est en route, point.
- DÉLAI des envois par timbre (graines comme petits articles): 5 à 12 jours ouvrables MAXIMUM selon
  la destination, et souvent moins. C'est le seul délai chiffré autorisé pour ces envois.
- Bombes semencières qui ont germé pendant le transport: germer n'est NI une faute NI un défaut,
  c'est même bon signe (ça dépend des espèces, certaines germent très facilement). L'enjeu est
  seulement que les pousses ne MEURENT pas en transit. Ne pas dramatiser, ne pas s'attribuer une
  faute (« c'est notre responsabilité » ne veut rien dire ici); si les pousses sont mortes, on en
  renvoie, et sinon on encourage à planter.
- PRÉVENTES: Lasclay vend beaucoup par préventes saisonnières. Une commande passée pendant une
  prévente s'expédie PLUS TARD que la normale, et ce n'est PAS un retard: c'est le modèle.
  Si le fil ou la date de commande suggère une prévente, explique calmement que l'expédition
  suit le calendrier de la prévente, et mets en note_interne de confirmer la fenêtre d'expédition.
- Défaut de fabrication évident (ex.: couture qui lâche près du pouce): on assume pleinement et sans
  hésiter, on s'en occupe, et on précise que c'est très inhabituel.
- FABRICATION ET « FAIT AU QUÉBEC » (prime sur les mentions d'assemblage local du document de
  connaissance, périmées depuis le pivot de 2026). La provenance suit LE PRODUIT, pas la marque:
  1) La MATIÈRE (asclépiade cultivée, cueillie, transformée) est faite au Québec à 100 %, pour toujours.
     C'est le coeur de la marque, à dire avec fierté.
  2) Produits assemblés à l'étranger (mitaines, cache-cous, manteaux): depuis 2026 l'assemblage final se
     fait hors Québec (Tunisie) à partir de l'isolant d'asclépiade fait ici. Mets l'asclépiade
     québécoise en avant, mais ne dis JAMAIS que le produit fini est « fabriqué au Québec » ni « fait au
     Canada ».
  3) Produits réellement faits ici (articles volumineux comme oreillers et coussins; soins pour la peau
     et cosmétiques à l'huile d'asclépiade): « fabriqué au Québec » est vrai, permis et encouragé.
  Le garde-fou est donc conditionnel au produit, pas global. Si tu n'es pas sûr d'OÙ un produit précis
  est fait, n'affirme pas le lieu et mets-le en note_interne. MANIEMENT: n'ouvre pas ce sujet toi-même,
  seulement si le client le soulève ou s'en inquiète. Si on demande pourquoi ça varie: on fabrique là où
  ça rend l'asclépiade la plus accessible, ici quand c'est possible, ailleurs quand ça permet de
  rejoindre plus de gens. N'explique le POURQUOI du pivot (recentrage sur la mission: cultivateurs,
  habitats du monarque, faire connaître l'asclépiade; l'assemblage artisanal avait atteint ses limites
  au volume actuel) QUE si le client insiste. Bref, franc, digne, jamais un long plaidoyer.

FILS QUI SE CONCLUENT BIEN (le client a résolu lui-même, remercie, ou tout est réglé): réponds quand
même avec un court mot sympathique (1-2 phrases: remercier, souhaiter de profiter des produits).
Réserve "repondre": false au spam, démarchage, notifications automatiques et réponses d'infolettre
sans aucune question.

L'INFORMATION QUI NOUS APPARTIENT: ne demande JAMAIS au client de nous fournir nos propres
informations (conditions d'une promo, contenu de notre infolettre, état de notre stock), et ne le
renvoie JAMAIS vérifier lui-même sur notre site ou dans nos courriels. Si l'info n'est pas dans le
document de connaissance: mets-la dans "note_interne" et formule le brouillon sans l'affirmer.

CONDITIONS DE PROMO: n'affirme JAMAIS la portée, les exclusions ou les produits couverts d'une
promotion si ce n'est pas écrit noir sur blanc dans le document de connaissance. Au besoin:
note_interne, et le brouillon reste général.

ACTIONS (remboursement, renvoi, correction, application de rabais): formule-les comme un engagement
au futur proche (« je m'en occupe aujourd'hui », « on applique le rabais et tu recevras une
confirmation »), JAMAIS comme déjà accomplies (« c'est fait », « je viens d'annuler »,
« I've cancelled », « it's done on our end »: au moment du brouillon, rien n'est fait).
Cette règle vaut EN FRANÇAIS COMME EN ANGLAIS. Liste l'action dans "action_requise" pour que
Gabriel l'exécute avant d'envoyer.

COHÉRENCE BROUILLON-NOTE (règle critique): tout fait que ta note_interne dit de VÉRIFIER ne doit
PAS être affirmé dans le brouillon. Le brouillon utilise une formulation qui reste vraie dans tous
les cas (« on regarde si on a des attaches de rechange et si oui, on t'en poste une » plutôt que
« bonne nouvelle, on en a »). Si une information du CLIENT manque (adresse, choix, précision),
le brouillon la DEMANDE au lieu de promettre par-dessus le trou. Un brouillon qui contredit sa
propre note est un brouillon raté.

PAS D'INTERROGATOIRE DU CLIENT: ne demande jamais au client s'il a reçu son courriel d'expédition
ou ce que son suivi indique (c'est NOTRE information, on la voit dans Shopify). Suggérer de jeter
un œil aux indésirables ou à la boîte postale communautaire est correct; le faire enquêter à notre
place ne l'est pas.

OFFRES ENTRANTES (terrain, approvisionnement, partenariat, collaboration, distribution): ne JAMAIS
accepter ni décliner sur le fond au nom de l'entreprise. Accusé de réception chaleureux, on regarde
ça, et "action_requise" pour Gabriel.

RETOURS NON DEMANDÉS: ne JAMAIS offrir spontanément un retour ou un remboursement que le client
n'a pas demandé, surtout pour les produits de grande valeur (manteaux ~300 $). Offrir un CRÉDIT
est acceptable.

RÉPONSES COQUILLES VIDES: interdites. « Ta commande est dans notre système et suivra son cours
normalement » ne dit rien. Chaque réponse de suivi contient de la substance: où on en est
(même en général: la commande s'en vient, enjeux de main-d'œuvre), un engagement concret,
et l'excuse au bon palier.

DÉLAIS CHIFFRÉS: cite un nombre de jours UNIQUEMENT s'il vient du document de connaissance.
Sinon, formulation prudente (« quelques jours », « d'ici une à deux semaines, on te confirme »).

NUMÉRO DE COMMANDE: ne le demande JAMAIS au client (on le retrouve nous-mêmes via Shopify).
Formule comme si on consultait son dossier nous-mêmes, sans affirmer de fait précis non vérifié.

SUIVI DE COMMANDE SANS DONNÉES DISPONIBLES: la commande s'en vient, on est dessus, petits enjeux
de main-d'œuvre ou période chargée, avec l'excuse graduée qui convient. INTERDIT ABSOLU: avouer
qu'on ne sait pas où est la commande (« pas de données de suivi sous la main », « on n'a pas
l'information », « on va vérifier et on te revient » seul): ce sont des non-réponses qui donnent
l'air incompétent. Affirme que ça avance, jamais qu'on est dans le noir.

RABAIS OU CODE PROMO MANQUANT (souvent en réponse à une infolettre): la cause habituelle est que
le code n'a pas été entré à la caisse. L'expliquer gentiment, sans accuser, et offrir d'appliquer
le rabais nous-mêmes sur la commande.

RETOUR / REMBOURSEMENT, RÉSISTANCE DOUCE: au PREMIER message du client à ce sujet, propose d'abord
la solution produit quand elle existe (assouplissement à l'usage, échange de taille, ajustement),
invite à nous revenir, et NE DONNE PAS la procédure de remboursement tout de suite. Si le client
insiste dans un message ultérieur, donne la procédure complète de bonne grâce, sans chigner.
Jugement requis: il ne faut jamais avoir l'air de fuir le remboursement, juste offrir mieux d'abord.

STYLE:
- ACCORDS TOUJOURS AU MASCULIN: ces courriels sont signés par Gabriel, un homme.
  Écris « content de le savoir », « content de l'apprendre », « je suis désolé »:
  JAMAIS « contente », « désolée », « heureuse », « ravie », « navrée », « certaine », même dans les
  mots courts et joyeux (c'est exactement là que l'erreur se glisse: « contente que tu... » est une
  FAUTE, écrire « content que tu... »).
- COHÉRENCE TU/VOUS: choisis le tutoiement OU le vouvoiement selon le ton du client (s'il te tutoie,
  tutoie; s'il vouvoie, vouvoie), et tiens-t'y du début à la fin du message. JAMAIS mélanger « tu »
  et « vous » pour le même client dans le même courriel.
- PAS D'EMOJI: aucun emoji dans les brouillons (😊, 👍, etc.), même pour un ton chaleureux.
- PRÉNOMS: si le prénom affiché est une abréviation évidente, utilise la forme complète probable
  (P-Paul → Pierre-Paul, J-F → Jean-François, Marie-H → Marie-Hélène). En cas de doute, garder tel quel.
- Français québécois: jamais le mot « dense » (dire intense, chargé, occupé); éviter les tournures de France.
- MÉTAPHORES DE COURRIEL PERDU, CATÉGORIE ENTIÈREMENT BANNIE: ne JAMAIS écrire que le message
  « a glissé », « est passé sous le radar », « entre les mailles du filet », « entre les craques »,
  « dans le flot », « slipped through », ni AUCUNE variante imagée du courriel égaré. Ce sont des
  platitudes vagues. Pour excuser un délai: dire simplement et concrètement ce qui s'est passé
  (période très intense, manque de temps, enjeux de main-d'œuvre), sans métaphore.
- Pas de coquilles vides: « des messages ont glissé », « ta commande suivra son cours »,
  « on te reçoit bien »: interdites. Chaque phrase dit quelque chose de concret.
- Pas de dramatisation: « on ne se reconnaît pas là-dedans » et formules du même calibre sont INTERDITES
  (on n'a tué personne); l'excuse forte reste factuelle et digne.
- Pas de remplissage: « dans le portrait », « dans l'équation » et autres bouts de phrase superflus.
- JAMAIS le mot « Nota » (« Nota pris », « Nota bene »): écrire « C'est noté » ou « Bien noté ».
- Pas de jargon technique côté client: « PCI-DSS », « certifié », noms de protocoles. Expliquer simplement
  (ex.: les paiements passent par Shopify, on ne voit jamais ton numéro de carte au complet).
- Ton NATUREL, pas « trop AI »: évite le lissé corporate et les transitions trop parfaites; écris
  comme un humain occupé et direct. Interdits: structure « ce n'est pas X, c'est Y » et ses formes
  déguisées; jargon corporate (« aligner les détails », « valeur ajoutée », « explorer les synergies »);
  formules creuses (« j'espère que ce message vous trouve bien », « je serais ravi de », « that's on me »);
  tics de transition mécaniques (« cela dit » / « ceci dit » à répétition,
  « je comprends ta frustration » en formule toute faite: si tu comprends, montre-le concrètement).
- « N'hésitez pas... », « do not hesitate », « écris-nous si... »: corrects, mais galvaudés. À utiliser
  avec PARCIMONIE, jamais en clôture réflexe de chaque message. Une invitation concrète et ciblée vaut
  mieux qu'une formule de disponibilité passe-partout.
- JAMAIS de tiret cadratin ni demi-cadratin: virgule, deux-points ou parenthèses.
- Si une canned response du document couvre le cas, INSPIRE-T'EN fortement pour le CONTENU, les faits et
  le quand-l'utiliser (c'est le savoir officiel), en l'adaptant au fil. Mais NE COPIE JAMAIS sa SURFACE:
  salutations, clôtures, émojis, « Chaleureusement ». Beaucoup de canned sont plus
  vieilles que ta voix actuelle: la forme est régie par les RÈGLES ABSOLUES et la voix ci-dessus, jamais
  par les canned. Attention aussi aux canned marquées [À VÉRIFIER].

NOTES INTERNES COURTES ET RARES: note_interne et action_requise doivent se lire en moins de
15 secondes. Style télégraphique, jamais de répétition entre les deux champs: note_interne = le
doute, action_requise = le geste. LA NOTE EST L'EXCEPTION, PAS LE RÉFLEXE: ne note JAMAIS les
vérifications routinières évidentes (consulter le statut ou le contenu d'une commande dans
Shopify avant de répondre: implicite dans tout fil de commande). Réserve note_interne au
NON-ÉVIDENT: affirmation du client qui cloche, légitimité d'un rabais douteuse, stock incertain
derrière une promesse, contradiction dans le fil, frais de procédure hors sujet. Détaille
seulement si le cas est réellement complexe (longue saga, plusieurs enjeux entremêlés).

TON RÔLE ET L'ESCALADE: agis comme un associé au service client de Lasclay, très compétent et
connaissant. Tu traites toi-même la vaste majorité des cas, de bout en bout. Mais comme un bon associé,
tu LÈVES LA MAIN (escalade=true) quand un cas mérite un second regard avant l'envoi, dans deux cas:
- DIFFICILE: tu improvises, un fait t'échappe ou tu en doutes, cas inhabituel, réponse que tu n'es pas
  certain d'avoir bien calibrée.
- À ENJEU: une mauvaise réponse coûterait cher, soit client fâché ou menaçant, risque d'avis négatif ou
  de plainte, remboursement ou garantie à trancher, sujet sensible (fabrication, santé), longue saga
  tendue.
N'escalade PAS un remerciement, une confirmation ou une info simple dont tu es sûr. L'escalade est un
outil de jugement, pas un réflexe: escalade quand un collègue d'expérience voudrait vérifier avant que
ça parte, sinon non.

RÉPONSE ATTENDUE: UNIQUEMENT un objet JSON:
{
  "repondre": true|false,        // false si spam, démarchage, notifications, réponse d'infolettre sans question
  "raison": "<si false, pourquoi, court>",
  "categorie": "<suivi_livraison|modification_annulation_commande|retour_echange_remboursement|question_pre_achat|probleme_produit_garantie|wholesale_b2b|douane_international|autre>",
  "langue": "fr|en",
  "brouillon": "<le texte du brouillon, sauts de ligne avec \\n>",
  "excuse_utilisee": "<si une excuse de délai/retard a été servie, sa phrase exacte, sinon null>",
  "note_interne": "<télégraphique: ce que Gabriel doit VÉRIFIER avant d'envoyer, sinon null. JAMAIS dans le corps du brouillon.>",
  "action_requise": "<télégraphique: le geste que Gabriel doit POSER avant d'envoyer, sinon null>",
  "suivi": "<qui a le prochain geste: 'client' si on attend une réponse ou une action du client; 'nous' si on doit le relancer (typique d'une vente ou d'un pré-achat: on répond, puis on vérifie plus tard s'il a commandé); 'aucun' si rien n'est en attente (remerciement, info donnée)>",
  "relance_jours": "<si suivi='nous', dans combien de jours relancer (un nombre), en choisissant le délai IDÉAL selon le cas (ex. 3 pour une vente chaude, 7 à 10 pour un suivi moins pressant); sinon null>",
  "relance_raison": "<si suivi='nous', une COURTE justification du délai choisi, pour aider l'opérateur (ex. 'vente chaude, relancer vite s'il n'a pas commandé' ou 'laisser le temps de recevoir avant de vérifier sa satisfaction'); sinon null>",
  "escalade": true|false,
  "escalade_raison": "<si escalade=true, une phrase courte disant pourquoi (ex. 'cas de garantie ambigu', 'client menace un avis négatif', 'question de fabrication délicate', 'je ne suis pas certain du fait X'); sinon null>"
}
`);

// --- Construit le texte du fil pour Sonnet ---
function threadText(conv, msgs, bodies) {
  const lines = [`SUJET: ${conv.subject || conv.latest_message_subject || "(aucun)"}`];
  // Premier message du fil conservé (l'origine des longues sagas), puis les 11 derniers.
  const picked = msgs.length > 12 ? [msgs[0], ...msgs.slice(-11)] : msgs;
  let prev = null;
  for (const m of picked) {
    if (prev && msgs.indexOf(m) - msgs.indexOf(prev) > 1) lines.push(`[… ${msgs.indexOf(m) - msgs.indexOf(prev) - 1} message(s) plus ancien(s) omis …]`);
    prev = m;
    const d = m.delivered_at ? new Date(m.delivered_at * 1000).toISOString().slice(0, 10) : "?";
    const who = isUs(m) ? "NOUS" : `CLIENT (${m.from_field?.name || m.from_field?.address || m.from_field?.username || "?"})`;
    const att = (m.attachments || []).map((a) => a.filename).filter(Boolean);
    const attTxt = att.length ? ` [PIÈCES JOINTES: ${att.join(", ")}]` : "";
    lines.push(`[${d}] ${who}${attTxt}: ${cleanBody(bodies.get(m.id) || m.preview || "") || "(sans texte)"}`);
  }
  return lines.join("\n").slice(0, 14000);
}

// --- Contrôle qualité Opus avant envoi (v2.10) ---
// Opus reçoit LES MÊMES blocs système que Sonnet (connaissance + catalogue + voix),
// plus cette consigne qui le fait juger au lieu de rédiger. Il vérifie donc AUSSI les
// faits (produit inexistant, prix/statut faux, info contredite par la connaissance).
const QC_INSTRUCTION = noDash(`CONTRÔLE ET CORRECTION (tu ne pars pas de zéro): on te fournit un fil client, un BROUILLON déjà
rédigé selon toutes les règles ci-dessus (document de connaissance, catalogue, voix), et parfois des
SIGNAUX automatiques. Tu as accès aux mêmes informations que le rédacteur. Décide de l'UN de trois verdicts:

- "envoyer": le brouillon est bon tel quel, ou les signaux sont de faux positifs. Envoyable sans retouche.
- "corriger": le brouillon a un ou des défauts RÉPARABLES (voix, formule bannie, accord féminin, tu/vous,
  ton, ou un fait à ajuster selon le catalogue ou la connaissance). Tu réécris le brouillon CORRIGÉ, en
  gardant le fond et le ton, prêt à envoyer.
- "bloquer": le brouillon exige un jugement humain (fait invérifiable même avec ton contexte, décision
  délicate, réponse hors sujet impossible à sauver, risque réel pour le client). Tu ne le corriges pas.

Corrige DÈS QUE c'est réparable; ne bloque que ce qui a vraiment besoin d'un humain. Le brouillon corrigé
doit suivre TOUTES les règles: accords au masculin, aucune formule bannie ni antithèse, AUCUN numéro de
téléphone, langue du client, aucune affirmation de commande non vérifiable (montant, statut, code), action
au futur. N'ajoute NI signature NI notice (ajoutées après). Vérifie aussi les FAITS: un produit inexistant
au catalogue, un prix ou statut faux, une info contredite par le catalogue ou les corrections de voix = corriger ou bloquer.

Réponds UNIQUEMENT par un objet JSON, sans texte autour:
{"verdict":"envoyer"|"corriger"|"bloquer","brouillon_corrige":"<le texte corrigé si verdict=corriger, sauts de ligne avec \\n, sinon null>","raison":"une phrase","problemes":["code court", ...]}`);

let qcCalls = 0, qcBlocks = 0, qcSkipped = 0;
let escalCount = 0, enjeuCount = 0;
const qcUsage = { in: 0, cacheRead: 0, cacheCreate: 0, out: 0 };
// Tarifs Opus (estimation à vérifier, $ US / million de tokens).
const QC_RATE_IN = 15 / 1e6, QC_RATE_CACHE = 1.5 / 1e6, QC_RATE_OUT = 75 / 1e6;

async function opusQC(systemBlocks, fil, brouillon, out, flags) {
  const flagsTxt = flags && flags.length
    ? `\n\nSIGNAUX AUTOMATIQUES (corrige-les s'ils sont justes, ignore-les si faux positifs):\n- ${flags.join("\n- ")}`
    : "";
  const contexte = `FIL CLIENT :\n${fil}\n\nBROUILLON À CONTRÔLER (catégorie ${out.categorie}, langue ${out.langue}) :\n${brouillon}${flagsTxt}\n\nRends ton verdict JSON.`;
  // Mêmes blocs que Sonnet (connaissance + catalogue déjà mis en cache) + la consigne de contrôle.
  const qcSystem = [...systemBlocks, { type: "text", text: sanit(QC_INSTRUCTION) }];
  const payload = JSON.stringify({
    model: QC_MODEL, max_tokens: 500,
    system: qcSystem,
    messages: [{ role: "user", content: sanit(contexte) }],
  });
  for (let attempt = 1; attempt <= 5; attempt++) {
    await sleep(600);
    let res;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: payload,
      });
    } catch (e) {
      if (attempt === 5) throw e;
      await sleep(attempt * 8000);
      continue;
    }
    if (res.status === 429 || res.status === 529) { await sleep(attempt * 15000); continue; }
    if (!res.ok) throw new Error(`Anthropic QC → ${res.status} ${await res.text()}`);
    const data = await res.json();
    const u = data.usage || {};
    qcUsage.in += u.input_tokens || 0; qcUsage.out += u.output_tokens || 0;
    qcUsage.cacheRead += u.cache_read_input_tokens || 0; qcUsage.cacheCreate += u.cache_creation_input_tokens || 0;
    qcCalls++;
    const txt = (data.content || []).map((b) => b.text || "").join("").trim();
    return parseJsonLoose(txt);
  }
  throw new Error("QC Opus: trop de tentatives.");
}

// --- Digest des actions/remboursements à faire (v2.9) ---
function ligneDigest(i) {
  return `### ${i.nom} — ${(i.subject || "(sans sujet)").slice(0, 60)}\n` +
    `- Fil: ${i.url}\n` +
    `- Catégorie: ${i.categorie} | Langue: ${i.langue}\n` +
    `- Action à faire: ${i.action || "(voir le fil)"}\n` +
    (i.montants && i.montants.length
      ? `- Montant(s) mentionné(s): ${i.montants.join(", ")}\n`
      : `- Montant: à confirmer dans Shopify\n`);
}
function construireDigest(items) {
  const remb = items.filter((i) => i.rembours);
  const autres = items.filter((i) => !i.rembours);
  let md = `# Actions à faire (réponses déjà envoyées automatiquement)\n\n`;
  md += `Date: ${new Date().toISOString().slice(0, 16).replace("T", " ")}\n`;
  md += `À traiter (idéalement via Cowork). Chaque client a DÉJÀ reçu une réponse promettant l'action.\n\n`;
  md += `## Remboursements à traiter (${remb.length})\n`;
  md += (remb.length ? remb.map(ligneDigest).join("\n\n") : "Aucun.") + "\n\n";
  md += `## Autres actions (${autres.length})\n`;
  md += autres.length ? autres.map(ligneDigest).join("\n\n") : "Aucune.";
  return md;
}
async function deposeDigest(md) {
  const b64 = Buffer.from(md, "utf8").toString("base64");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  await apiPost("/drafts", {
    drafts: {
      conversation: ACTIONS_CONV, organization: ORG,
      from_field: { address: EXPORT_FROM }, to_fields: [{ address: EXPORT_FROM }],
      subject: `[ACTIONS À FAIRE] ${stamp}`,
      body: "Digest des actions et remboursements à traiter (pièce jointe). À donner à Cowork.",
      attachments: [{ base64_data: b64, filename: `actions_a_faire_${stamp}.md` }],
    },
  });
}

// --- Pouls du service (v2.11): tenir Gabriel au courant, escalader le vrai signal ---
const POULS_CONTEXTE = "Lasclay (lasclay.com): marque québécoise de produits isolés à la soie d'asclépiade " +
  "(manteaux, gants, accessoires plein air, glacières, semences), vendus en ligne FR et EN. " +
  "Gabriel Gouveia, cofondateur. Préventes saisonnières fréquentes.";
const POULS_INSTRUCTIONS = noDash(`Tu es le RESPONSABLE du service client de Lasclay qui fait un point bref à Gabriel, le cofondateur,
un dirigeant très occupé. L'IA vient de répondre automatiquement à la plupart des courriels de ce run.
Ton rôle n'est PAS de donner une liste de tâches: c'est de tenir Gabriel au courant et de ne faire
remonter QUE ce qu'il doit vraiment savoir. Un point calme vaut mieux qu'une longue liste.

Tu reçois les fils traités à ce run, condensés, avec le STATUT de ce que l'IA a fait. Produis:
1) un POULS: 2 à 3 phrases sur le volume, le ton général des clients, et ce que l'IA a géré.
2) un THÈME dominant s'il y en a un, sinon null.
3) des ESCALADES: SEULEMENT les fils que Gabriel doit connaître. Le seuil est HAUT. N'escalade que:
   - un client très fâché ou qui menace (rétrofacturation, avis public, mise en demeure, plainte formelle)
   - une opportunité (grossiste, partenariat, média, influenceur, gros client)
   - un DÉFAUT PRODUIT qui revient chez plusieurs clients (une tendance, pas un cas isolé)
   - un cas délicat où l'IA a probablement mal répondu ou calé
   - un contact VIP ou notable (partenaire connu, presse)
   Tu peux aussi escalader une réponse ENVOYÉE automatiquement si le sujet est sensible et que Gabriel
   voudra suivre. N'escalade JAMAIS le routine (suivi normal, question simple, remerciement). Si rien
   ne mérite son attention, renvoie une liste VIDE: c'est un excellent résultat. Ne gonfle jamais la liste.

Voix: français québécois, direct, sobre. AUCUN tiret cadratin ni demi-cadratin.

Réponds UNIQUEMENT par un objet JSON, sans texte autour:
{"pouls":"2 à 3 phrases","theme":"sujet dominant ou null","escalades":[{"ref":<numéro #>,"pourquoi":"une phrase concise","gravite":"info|attention|urgent"}]}`);

async function poulsIA(records) {
  const lot = records.map((r, i) =>
    `[#${i + 1}] DE: ${r.expediteur} | SUJET: ${r.sujet} | CAT: ${r.categorie} | ATTENTE: ${r.jours}j | STATUT IA: ${r.statut}\n` +
    `DERNIER MSG CLIENT: ${r.extrait || "(vide)"}`
  ).join("\n\n").slice(0, 14000);
  const system = [
    { type: "text", text: sanit("CONTEXTE:\n" + POULS_CONTEXTE), cache_control: { type: "ephemeral" } },
    { type: "text", text: sanit(POULS_INSTRUCTIONS) },
  ];
  const user = `Date: ${new Date().toISOString().slice(0, 10)}. ${records.length} fil(s) traités ce run.\n\nLES FILS:\n${lot}\n\nRends ton JSON.`;
  const payload = JSON.stringify({ model: DIGEST_MODEL, max_tokens: 1200, system, messages: [{ role: "user", content: sanit(user) }] });
  for (let a = 1; a <= 5; a++) {
    await sleep(500);
    let res;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: payload,
      });
    } catch (e) { if (a === 5) throw e; await sleep(a * 8000); continue; }
    if (res.status === 429 || res.status === 529) { await sleep(a * 15000); continue; }
    if (!res.ok) throw new Error(`Anthropic pouls → ${res.status} ${await res.text()}`);
    const data = await res.json();
    return parseJsonLoose((data.content || []).map((b) => b.text || "").join("").trim());
  }
  throw new Error("Pouls IA: trop de tentatives.");
}

function construirePouls(res, records) {
  const today = new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
  const lien = (id) => `https://mail.missiveapp.com/#inbox/conversations/${id}`;
  const icone = { urgent: "🔴", attention: "🟡", info: "🔵" };
  let md = `**🎧 Pouls du service client, ${today}**\n\n${noDash(res.pouls || "")}\n`;
  if (res.theme) md += `\n*Thème du moment: ${noDash(res.theme)}*\n`;
  const esc = (res.escalades || []).filter((e) => e.ref >= 1 && e.ref <= records.length);
  if (esc.length === 0) {
    md += `\n**À ton attention**\nRien de spécial à signaler, le service roule.`;
  } else {
    const ordre = { urgent: 0, attention: 1, info: 2 };
    esc.sort((a, b) => (ordre[a.gravite] ?? 3) - (ordre[b.gravite] ?? 3));
    md += `\n**À ton attention** (${esc.length})\n`;
    for (const e of esc) {
      const r = records[e.ref - 1];
      md += `- ${icone[e.gravite] || "🔵"} **${r.expediteur}** · ${r.sujet.slice(0, 45)} · [ouvrir](${lien(r.id)})\n  ${noDash(e.pourquoi)}\n`;
    }
  }
  return md;
}

async function postPouls(markdown) {
  await apiPost("/posts", {
    posts: {
      conversation: RESUME_CONV, organization: ORG,
      notification: { title: "Pouls du service", body: "Ton point du service client est prêt." },
      markdown,
    },
  });
}

// v2.12 — Ferme un fil après envoi. Si relanceJours > 0 (on doit relancer), pose le
// label « Relance » et une note qui SUGGÈRE à l'opérateur une durée et pourquoi, pour
// qu'il décide vite (l'API Missive n'a pas de snooze temporisé).
async function fermerFil(convId, relanceJours, relanceRaison) {
  const post = {
    conversation: convId, organization: ORG, close: true,
    notification: relanceJours
      ? { title: "Fermé, relance suggérée", body: `Relancer dans ~${relanceJours} j.` }
      : { title: "Fermé (réponse envoyée)", body: "En attente du client." },
  };
  if (relanceJours) {
    const due = new Date(Date.now() + relanceJours * 86400000).toISOString().slice(0, 10);
    post.markdown =
      `📌 **Suivi à prévoir.** Réponse envoyée, fil fermé.\n` +
      `Suggestion: relancer dans **~${relanceJours} jour(s)** (vers le **${due}**)` +
      (relanceRaison ? `, parce que ${relanceRaison}.` : ".") + `\n` +
      `Si le client répond avant, le fil se rouvre tout seul. Sinon, rouvre-le à cette date pour relancer (ou ajuste le moment selon ton jugement).`;
    if (RELANCE_LABEL) post.add_shared_labels = [RELANCE_LABEL];
  } else {
    post.markdown = "_Réponse envoyée, fil fermé (en attente du client; se rouvrira s'il répond)._";
  }
  await apiPost("/posts", { posts: post });
}

// --- Run principal ---
(async () => {
  if (LIST_TEAMS) {
    const { teams = [] } = await api("/teams?limit=50");
    console.log("Équipes de l'organisation:");
    for (const t of teams) console.log(`  ${t.id}  ${t.name}`);
    return;
  }
  console.log("=== Lasclay support.js v2.13 ===");
  console.log(DRY_RUN ? "=== MODE SIMULATION (rien créé ni envoyé) ===" : "=== MODE RÉEL ===");
  console.log(`Modèle: ${MODEL} | DRAFT_LIMIT: ${DRAFT_LIMIT || "aucun"} | MAX_FILS: ${MAX_FILS}`);
  if (AUTO_SEND) {
    console.log(`*** ENVOI AUTO ACTIF *** SEND_LIMIT: ${SEND_LIMIT || "aucun"} | catégories: ${SEND_CATEGORIES.length ? SEND_CATEGORIES.join(",") : "toutes (brouillons propres)"}`);
    console.log(`    Envoi des actions (remboursements...): ${SEND_ACTIONS ? "OUI, avec digest à traiter" : "non (restent brouillons)"}`);
    console.log(`    Contrôle Opus avant envoi: ${SEND_QC ? `OUI (${QC_MODEL})${QC_LEAN ? ", contexte allégé" : ""}${QC_SKIP_SAFE ? ", sauté sur les envois sûrs" : ""}${QC_ESCALADE ? ", escalade associé + enjeu actifs" : ""}` : "NON"}`);
    console.log(`    Après envoi: fermeture du fil (close), + label Relance si suivi='nous'${RELANCE_LABEL ? "" : " [RELANCE_LABEL absent: note seule]"}.`);
    console.log("    Une note à vérifier ou un cas jugé « à humain » par Opus reste en brouillon.");
  } else {
    console.log("Envoi auto: NON (brouillons seulement, comme v2.7).");
  }
  if (DIGEST_SUPPORT) {
    console.log(`Pouls du service: ACTIF (${DIGEST_MODEL})${DIGEST_HOUR >= 0 ? `, posté au run de ${DIGEST_HOUR}h UTC` : ", chaque run"}${RESUME_CONV ? "" : " [pas de RESUME_CONV: log seul]"}.`);
  }

  // 0. Document de connaissance (depuis le dépôt)
  if (!fs.existsSync(KNOWLEDGE_FILE)) {
    console.error(`Document de connaissance introuvable: ${KNOWLEDGE_FILE}. L'ajouter au dépôt.`);
    process.exit(1);
  }
  const knowledge = fs.readFileSync(KNOWLEDGE_FILE, "utf8");
  console.log(`Connaissance chargée: ${(knowledge.length / 1024).toFixed(0)} Ko.`);

  // 0b. Catalogue produits (chargé en direct, mis en cache comme la connaissance).
  const catalogue = await chargerCatalogue();
  const systemBlocks = [
    { type: "text", text: sanit("DOCUMENT DE CONNAISSANCE DU SERVICE CLIENT LASCLAY:\n\n" + noDash(knowledge)), cache_control: { type: "ephemeral" } },
    catalogue
      ? { type: "text", text: sanit("CATALOGUE PRODUITS ACTUEL (source de vérité sur ce qui existe et son statut):\n\n" + noDash(catalogue)), cache_control: { type: "ephemeral" } }
      : null,
    { type: "text", text: sanit(VOICE), cache_control: { type: "ephemeral" } },
  ].filter(Boolean);
  // Lever 2: le contrôle Opus n'a pas besoin des 224 canned (le rédacteur les a déjà utilisées).
  // On lui donne le contexte allégé: catalogue + voix + corrections, là où vivent les faits
  // vérifiables. On retire seulement le document de connaissance (toujours en index 0).
  const qcSystemBlocks = QC_LEAN ? systemBlocks.slice(1) : systemBlocks;

  // 1. Rafraîchissement: étiquetés ∩ fermés → retirer le label
  const drafted = new Set((await listByFilter(`shared_label=${DRAFT_LABEL}`)).map((c) => c.id));
  console.log(`${drafted.size} fil(s) portent « Draft AI Support ».`);
  const closed = new Set();
  for (const t of TEAM_IDS) {
    for (const c of await listByFilter(`team_closed=${t}`)) closed.add(c.id);
  }
  const aRetirer = [...drafted].filter((id) => closed.has(id));
  if (DRY_RUN) {
    console.log(`[DRY] ${aRetirer.length} fil(s) fermé(s) verraient leur label retiré.`);
  } else {
    let r = 0;
    for (const id of aRetirer) {
      try {
        await apiPost("/posts", {
          posts: {
            conversation: id, organization: ORG,
            remove_shared_labels: [DRAFT_LABEL],
            reopen: true, // empêche la réouverture du fil fermé
            markdown: "_Brouillon obsolète, label retiré (fil fermé)._",
            notification: { title: "Suivi", body: "Brouillon obsolète, label retiré." },
          },
        });
        drafted.delete(id);
        r++;
      } catch (e) { console.warn(`  retrait label échoué sur ${id}: ${e.message}`); }
    }
    console.log(`Label retiré de ${r} fil(s) fermé(s).`);
  }

  // 2. Ciblage: inbox ouverte, dernier mot au client, pas déjà drafté
  const inboxById = new Map();
  const teamsByConv = new Map(); // convId → Set des équipes où le fil apparaît
  for (const t of TEAM_IDS) {
    const convs = await listByFilter(`team_inbox=${t}`);
    console.log(`  ${convs.length} fil(s) ouverts dans l'équipe ${t.slice(0, 8)}…`);
    for (const c of convs) {
      inboxById.set(c.id, c);
      if (!teamsByConv.has(c.id)) teamsByConv.set(c.id, new Set());
      teamsByConv.get(c.id).add(t);
    }
  }
  const inbox = [...inboxById.values()].sort((a, b) => (b.last_activity_at || 0) - (a.last_activity_at || 0));
  console.log(`${inbox.length} fil(s) ouverts uniques dans ${TEAM_IDS.length} boîtes.`);
  const exportDrafts = await listExportDrafts();
  const excuses = await loadJsonMemory(exportDrafts, /^memoire_excuses_.*\.json\.gz$/, "Mémoire des excuses");
  // Fils écartés (« rien à répondre »): convId → last_activity_at au moment du jugement.
  const ecartes = await loadJsonMemory(exportDrafts, /^memoire_ecartes_.*\.json\.gz$/, "Mémoire des fils écartés");
  let ecartesModifiee = false;

  // Index: adresse d'auteur → fils ouverts (pour voir qu'un client a écrit sur plusieurs fils).
  const filsParAuteur = new Map();
  let authorsVus = false;
  for (const c of inbox) {
    for (const a of c.authors || []) {
      const k = (a.address || "").toLowerCase();
      if (!k || SELF.includes(k)) continue;
      authorsVus = true;
      if (!filsParAuteur.has(k)) filsParAuteur.set(k, []);
      filsParAuteur.get(k).push(c);
    }
  }
  if (!authorsVus) console.warn("Note: champ `authors` absent des conversations; détection multi-fils inactive ce run.");

  const NOREPLY = /no-?reply|donotreply|ne-?pas-?repondre/i;

  let analysed = 0, created = 0, sent = 0, skipped = 0, noReply = 0, errors = 0, verifs = 0, dejaBrouillon = 0, ecarteSkips = 0;
  const actionsDigest = []; // actions/remboursements des réponses envoyées (v2.9)
  const poulsRecords = []; // condensés pour le pouls du service (v2.11)
  for (const conv of inbox) {
    if (drafted.has(conv.id) || conv.id === EXPORT_CONV) { skipped++; continue; }
    if ((conv.drafts_count || 0) > 0) { dejaBrouillon++; continue; }
    if (ecartes.has(conv.id)) {
      if (ecartes.get(conv.id) === (conv.last_activity_at || 0)) { ecarteSkips++; continue; }
      ecartes.delete(conv.id); // le fil a bougé: nouveau jugement complet
      ecartesModifiee = true;
    }
    if (analysed >= MAX_FILS) break;
    // Plafond de SORTIES (brouillons + envois) par run.
    if (DRAFT_LIMIT > 0 && (created + sent) >= DRAFT_LIMIT) { console.log("Plafond de sorties atteint."); break; }

    try {
      const msgs = await listThreadMessages(conv.id);
      if (msgs.length === 0) { skipped++; continue; }
      const last = msgs[msgs.length - 1];
      if (isUs(last)) { skipped++; continue; } // le dernier mot est à nous: on attend le client
      analysed++;

      const aLire = msgs.length > 12 ? [msgs[0], ...msgs.slice(-11)] : msgs;
      const bodies = await fetchBodies(aLire.map((m) => m.id));
      const clientKey = (last.from_field?.address || last.from_field?.username || last.from_field?.name || "inconnu").toLowerCase();
      const dejaServies = (excuses.get(clientKey) || []).map((e) => `- (${e.date}) ${e.texte}`).join("\n") || "(aucune)";

      let lastUsIdx = -1;
      msgs.forEach((m, i) => { if (isUs(m)) lastUsIdx = i; });
      const sansReponse = msgs.slice(lastUsIdx + 1).filter((m) => !isUs(m));
      const plusAncien = sansReponse[0];
      const joursAttente = plusAncien
        ? Math.max(0, Math.floor((Date.now() / 1000 - (plusAncien.delivered_at || plusAncien.created_at || Date.now() / 1000)) / 86400))
        : 0;

      const autres = (filsParAuteur.get(clientKey) || []).filter((c) => c.id !== conv.id);
      const autresLigne = autres.length
        ? `\nIMPORTANT: ce client a ${autres.length} AUTRE(S) fil(s) ouvert(s) chez nous en ce moment` +
          ` (sujets: ${autres.map((c) => (c.subject || c.latest_message_subject || "(sans sujet)").slice(0, 40)).join(" | ")}).` +
          ` Il a donc écrit plusieurs fois: ajuste l'intensité de l'excuse en conséquence, et si un de ces fils` +
          ` éclaire la demande, tiens-en compte.`
        : "";

      const filTexte = threadText(conv, msgs, bodies);
      const teamsDuFil = teamsByConv.get(conv.id) || new Set();
      const user = `DATE D'AUJOURD'HUI: ${new Date().toISOString().slice(0, 10)}\n\n` +
        `FIL À TRAITER:\n${filTexte}\n\n` +
        `CONTEXTE D'ATTENTE: le client attend depuis ${joursAttente} jour(s); ` +
        `${sansReponse.length} message(s) du client sans réponse de notre part.${autresLigne}\n\n` +
        `EXCUSES DÉJÀ SERVIES À CE CLIENT (ne JAMAIS les réutiliser):\n${dejaServies}`;
      let out;
      try { out = parseJsonLoose(await claude(systemBlocks, user, 1500)); }
      catch (e) { console.warn(`  [${conv.id}] réponse IA illisible: ${e.message}`); errors++; continue; }

      const subj = conv.subject || conv.latest_message_subject || "";
      if (!out.repondre || !out.brouillon) {
        noReply++;
        ecartes.set(conv.id, conv.last_activity_at || 0);
        ecartesModifiee = true;
        if (DIGEST_SUPPORT) poulsRecords.push({
          id: conv.id, expediteur: last.from_field?.name || last.from_field?.address || "?",
          sujet: subj || "(sans sujet)", categorie: out.categorie, jours: joursAttente,
          statut: "aucune réponse requise", extrait: cleanBody(bodies.get(last.id) || last.preview || "").slice(0, 400),
        });
        console.log(`[skip] ${subj.slice(0, 50) || "(sans sujet)"} → ${out.raison || "rien à répondre"}`);
        continue;
      }

      const labels = [DRAFT_LABEL];
      if (TRI_LABELS[out.categorie]) labels.push(TRI_LABELS[out.categorie]);
      let toAddr = last.from_field?.address || null;
      if (toAddr && NOREPLY.test(toAddr)) {
        console.log(`  (adresse no-reply « ${toAddr} »: brouillon sans destinataire, à router manuellement)`);
        toAddr = null;
      }

      // Texte final: le même en simulation et en réel (noDash appliqué partout).
      const corps = noDash(out.brouillon);

      // Alertes [VOIX]: détection déterministe des fuites connues, sans réécriture.
      // NOTE: la détection porte sur `corps` (le texte de Sonnet), PAS sur la notice IA
      // ajoutée ensuite au corps final, sinon le numéro de la notice ferait une fausse alerte.
      const alertes = [];
      if (/\b(désolée|contente|heureuse|ravie|navrée|certaine|surprise|déçue|confuse|enchantée)\b/i.test(corps) &&
          !/(vous|tu|t'|elle|cliente?|ta |votre |sa )\s*\w*\s*(êtes|es|est|seras?|serez|sois|soyez|semble|paraît)?\s*(désolée|contente|heureuse|ravie|navrée|certaine|surprise|déçue|confuse|enchantée)/i.test(corps)) {
        alertes.push("féminin de 1re personne probable");
      }
      for (const [re, lbl] of [
        [/on (te|vous) reçoit bien|on reçoit bien (tes|vos)/i, "« on te reçoit bien »"],
        [/fabriqu\w+ au québec|fait\w? au canada|made in canada|assembl\w+ au québec|produits? québécois/i, "affirmation d'origine (OK pour oreillers/coussins/cosmétiques, INTERDIT pour un produit assemblé à l'étranger: vérifier le produit)"],
        [/suivra son cours/i, "coquille vide « suivra son cours »"],
        [/plus long qu'à l'habitude de notre côté/i, "formulation d'excuse bizarre"],
        [/ne (se|nous) reconna/i, "dramatisation"],
        [/^bonsoir/i, "« Bonsoir » (toujours Bonjour)"],
        [/\bnota\b/i, "« Nota » (écrire « c'est noté »)"],
        [/(gliss\w+|pass\w+|perd\w+|slipped|fell)\b[^.]{0,40}(radar|craque|maille|filet|flot|crack)|entre les (craques|mailles)|sous (le|notre) radar|dans le flot|slipped through|fell through|slipped past/i, "platitude de courriel perdu (bannie)"],
        [/\b\d{1,3}\s?(jours?|mois|semaines?|days|weeks|months)\b[^.]{0,25}(silence|sans réponse|sans nouvelle|de retard|d'attente|without (a )?(reply|response|update|news)|since)|(silence|sans réponse|retard|attente|inacceptable)[^.]{0,25}\b\d{1,3}\s?(jours?|mois|semaines?|days|weeks|months)\b/i, "délai chiffré (ne pas quantifier le retard)"],
        [/\bbug connu\b/i, "aveu « bug connu » (ne pas avouer)"],
        [/581\D?982\D?5857|\(581\)/, "numéro de téléphone (à retirer)"],
        [/tu mérit\w+ (mieux|une réponse|d'être)|vous mérit\w+ (mieux|une réponse|d'être)|méritais (mieux|une réponse)/i, "autoflagellation « tu méritais mieux »"],
        [/ça ne (me|nous) ressemble pas|c'est gênant|je suis gêné|c'est désolant|on n'est pas fiers?/i, "autoflagellation (gêné/désolant/pas fiers)"],
        [/(notre|pas notre) façon de faire/i, "« notre façon de faire » (dire « habitudes »)"],
        [/ce n('est|était) pas (une?\s)?[^,.;:]{2,40},\s?(c'est|c'était|mais c'est|juste que)/i, "antithèse « ce n'est pas X, c'est Y »"],
        [/it('s| is| was)? ?not [^,.;:]{2,40}, (it's|it is|just|but it)/i, "antithèse EN « not X, it's Y »"],
        [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u2764]/u, "emoji (aucun dans les brouillons)"],
        [/\b(PCI|DSS|SSL)\b/, "jargon technique"],
      ]) {
        if (re.test(corps)) alertes.push(lbl);
      }

      // Tutoiement ET vouvoiement mélangés pour le même client.
      if (/\b(tu|ton|ta|tes|t'es|toi)\b/i.test(corps) && /\b(vous|votre|vos|vous-même)\b/i.test(corps)) {
        alertes.push("tu/vous mélangés (choisir l'un et s'y tenir)");
      }
      // Empilement d'excuses: 2+ marqueurs distincts = on beurre trop épais.
      const marqueurs = [
        /inacceptable/i, /pas à la hauteur|nos standards/i, /pas dans nos habitudes|notre façon de faire/i,
        /mérit\w+ mieux|méritais/i, /ne (me|nous) ressemble pas/i, /gêné|gênant|désolant/i,
      ].filter((re) => re.test(corps)).length;
      if (marqueurs >= 3) alertes.push(`excuse trop appuyée (${marqueurs} marqueurs: en garder 1, max 2)`);

      // Excuse de délai CREUSE: une excuse est présente mais sans complément (ni pourquoi, ni « pas dans
      // nos habitudes »). Structure robotique à bannir (ex. « désolé du délai, c'est beaucoup trop long »).
      const EXCUSE_DELAI = /(désolé\w*|navré\w*|excus\w+|sorry|apolog\w+)[^.!?]{0,40}(délai|retard|delay|d'?attente|répondre|reply|revenir|trop long|too long)/i;
      const COMPLEMENT_EXCUSE = /parce que|\bcar\b|on a (été|eu)|débordé|période (chargée|intense|de prévente)|manque de temps|main[- ]d'?oeuvre|lancement|prévente|indésirable|\bspam\b|pas dans nos habitudes|ne (me|nous) ressemble pas|pas à la hauteur|on (va|promet de|voulait) (faire mieux|se reprendre|mieux faire)|on aurait dû/i;
      if (EXCUSE_DELAI.test(corps) && !COMPLEMENT_EXCUSE.test(corps)) {
        alertes.push("excuse de délai creuse (sans raison ni « pas dans nos habitudes »): compléter ou retirer");
      }

      // Montants non sourcés: tout montant en $ du brouillon doit exister dans le fil,
      // le document de connaissance, OU le catalogue produits (prix légitimes), sinon halluciné.
      const source = (filTexte + knowledge + (catalogue || "")).replace(/[\s\u00a0]/g, "");
      for (const m of new Set(corps.match(/\d+(?:[.,]\d{1,2})?\s?\$|\$\s?\d+(?:[.,]\d{1,2})?/g) || [])) {
        const cle = m.replace(/[\s\u00a0]/g, "");
        const variante = cle.replace(",", ".");
        const variante2 = cle.replace(".", ",");
        if (!source.includes(cle) && !source.includes(variante) && !source.includes(variante2)) {
          alertes.push(`montant non sourcé: ${m} (absent du fil et du document)`);
        }
      }

      // Actions: déclarées accomplies (interdit) ou promises (permis, mais l'humain DOIT les faire).
      const ACTION_ACCOMPLIE = /(je viens (de |d')(annuler|rembourser|appliquer|corriger|envoyer|créditer|traiter)|(a|ont) été (traitée?s?|appliquée?s?|annulée?s?|remboursée?s?)|i('| ha)ve (cancelled|canceled|refunded|applied|processed|sent|credited)|(it's|it is|it has been) (done|processed|refunded|cancelled|canceled))/i;
      const ACTION_PROMISE = /(je m'en occupe|on s'en occupe|on (applique|annule|rembourse|crédite|renvoie|corrige)|on (t'|vous )envoie (une|de) nouvelle|(i'm|we're) (processing|sending|refunding)|we('ll| will) (send|refund|apply|credit|cancel)|i('ll| will) (send|refund|apply|credit|cancel|make the change)|tu recevras (un remboursement|une confirmation de remboursement)|vous recevrez (un remboursement|une confirmation de remboursement)|refund (is on its way|goes through))/i;
      if (ACTION_ACCOMPLIE.test(corps)) alertes.push("action déclarée ACCOMPLIE (interdite: rien n'est fait au moment du brouillon)");
      let actionAuto = null;
      if (!out.action_requise && (ACTION_PROMISE.test(corps) || ACTION_ACCOMPLIE.test(corps))) {
        actionAuto = "Le brouillon promet une action (remboursement, rabais, renvoi…): L'EXÉCUTER avant d'envoyer, sinon c'est une fausse promesse.";
      }

      const noteLigne = [
        out.note_interne ? `À VÉRIFIER: ${noDash(sanit(String(out.note_interne)))}` : null,
        out.action_requise ? `ACTION AVANT ENVOI: ${noDash(sanit(String(out.action_requise)))}` : null,
        actionAuto ? `ACTION AVANT ENVOI (détectée): ${actionAuto}` : null,
        alertes.length ? `[VOIX] ${alertes.join("; ")}` : null,
      ].filter(Boolean);

      // Verrou humain à deux niveaux: ALARME (action à poser ou alerte de voix) vs NOTE simple.
      // verifRequise === true => le brouillon N'EST PAS admissible à l'envoi auto (jamais).
      let verifRequise = noteLigne.length > 0;
      let alarme = !!(out.action_requise || actionAuto || alertes.length);

      // Signature (langue), citation, liens cliquables + préfixe pays. (Voir v2.7.)
      const filBas = filTexte.toLowerCase();
      const estUSA = teamsDuFil.has("13d8a7bd-ed2e-4e0c-8cf3-2329ebaed217") ||
        (out.langue === "en" && /\b(usa|united states|u\.s\.|america|\bus\b|usd|\$us)\b/i.test(filBas));
      const prefixe = estUSA ? "/en-us" : out.langue === "en" ? "/en" : "";
      const corrigerLien = (url) => {
        let u = url.replace(/(https?:\/\/(?:www\.)?lasclay\.com)(\/(?:en-us|en-ca|en|fr-ca|fr))?(\/|$)/i,
          (_, base, _old, tail) => `${base}${prefixe}${tail === "/" || tail === "" ? "/" : tail}`);
        return u;
      };
      const linkify = (html) => html.replace(/(https?:\/\/[^\s<>"]+)/g, (url) => {
        const clean = corrigerLien(url.replace(/[.,;:)]+$/, ""));
        return `<a href="${clean}">${clean}</a>${url.match(/[.,;:)]+$/)?.[0] || ""}`;
      });

      const estCourriel = !last.type || /email/.test(last.type);
      const SIGNATURE_FR = "Chaleureusement,<br>__<br><b>Gabriel Gouveia</b><br>Co-fondateur<br>Lasclay.com";
      const SIGNATURE_EN = "Warmly,<br>__<br><b>Gabriel Gouveia</b><br>Co-founder<br>Lasclay.com";
      const signature = estCourriel ? `<br><br>${out.langue === "en" ? SIGNATURE_EN : SIGNATURE_FR}` : "";

      // v2.12 — DÉCISION D'ENVOI.
      //  CANDIDAT à l'envoi = auto activé, catégorie permise, courriel, destinataire, sous plafond,
      //  et (si le brouillon promet une action) SEND_ACTIONS. Les alertes de voix et une note à
      //  vérifier NE bloquent PLUS ici: Opus les traite (corrige, ou bloque si vraiment humain).
      const catAutorisee = SEND_CATEGORIES.length === 0 || SEND_CATEGORIES.includes(out.categorie);
      const aAgir = !!(out.action_requise || actionAuto);
      const candidat = AUTO_SEND && catAutorisee && estCourriel && !!toAddr &&
        (aAgir ? SEND_ACTIONS : true) && (SEND_LIMIT === 0 || sent < SEND_LIMIT);

      // Opus contrôle ET CORRIGE (Sonnet rédige, Opus tranche): envoyer / corriger / bloquer.
      // Refus ou panne du contrôle => brouillon, jamais l'inverse.
      let envoyer = false, corpsFinal = corps, corrige = false, qcVerdict = null, qcBlocked = false;
      // Lever 1: un brouillon sans AUCUN signal de risque et hors catégorie sensible n'a pas
      // besoin d'Opus (Opus renvoyait « OK » sans rien corriger). Les filtres déterministes,
      // gratuits, l'ont déjà validé. Tout signal (alerte, note, action) ou catégorie sensible
      // garde le QC.
      const catSensible = CATS_SENSIBLES.has(out.categorie);
      // ENJEU déterministe (lu dans le fil du CLIENT, gratuit): menace, colère, saga tendue. Objectif,
      // donc on ne dépend pas de Sonnet pour le remarquer. Attrape le cas facile-mais-explosif.
      const ENJEU_RX = [
        /avis (google|négatif|1 étoile)|mauvaise (revue|critique|évaluation|note)|bad review|\bplainte\b|office de protection|\bopc\b|dénonc/i,
        /rétrofacturation|chargeback|conteste (le|ce) paiement|contestation de paiement|dispute (the|this) charge|rembours\w+ via (ma |la )?banque/i,
        /mise en demeure|\bavocat\b|poursuiv|poursuite|small claims|petites créances|legal action/i,
        /inacceptable|scandaleux|honteux|arnaque|\bfraude\b|\bscam\b|toujours (pas|rien) reçu|jamais reçu|où est ma commande|where('?s| is) my order|still (haven'?t|not) (received|got)|unacceptable/i,
      ];
      const nbClient = msgs.filter((m) => !isUs(m)).length;
      const enjeu = ENJEU_RX.some((re) => re.test(filTexte)) || (nbClient >= 3 && joursAttente >= 14);
      // Escalade par jugement de l'associé (Sonnet), honorée si QC_ESCALADE.
      const escalade = QC_ESCALADE && out.escalade === true;
      if (enjeu) enjeuCount++;
      if (escalade) escalCount++;
      // Porte du QC, union ADDITIVE de quatre entrées: signal déterministe de voix, catégorie sensible,
      // enjeu détecté, ou escalade de Sonnet. Rien de tout ça ne SAUTE un QC; ça ne fait qu'en ajouter.
      const sansRisque = QC_SKIP_SAFE && !verifRequise && !catSensible && !enjeu && !escalade;
      if (candidat && SEND_QC && !sansRisque) {
        try {
          qcVerdict = await opusQC(qcSystemBlocks, filTexte, corps, out, noteLigne);
          if (qcVerdict.verdict === "envoyer") {
            envoyer = true;
          } else if (qcVerdict.verdict === "corriger" && qcVerdict.brouillon_corrige) {
            envoyer = true; corrige = true; corpsFinal = noDash(sanit(String(qcVerdict.brouillon_corrige)));
          } else {
            qcBlocked = true;
          }
        } catch (e) {
          console.warn(`  contrôle Opus échoué sur ${conv.id} (${e.message}) → brouillon par prudence`);
          qcBlocked = true;
          qcVerdict = { verdict: "bloquer", raison: `contrôle indisponible (${e.message})`, problemes: ["QC indisponible"] };
        }
        if (qcBlocked) {
          noteLigne.push(`[CONTRÔLE OPUS] gardé en brouillon: ${qcVerdict.raison || "jugé non envoyable"}` +
            (qcVerdict.problemes?.length ? ` (${qcVerdict.problemes.join(", ")})` : ""));
          verifRequise = true; alarme = true; qcBlocks++;
        }
      } else if (candidat && (!SEND_QC || sansRisque)) {
        // Sans contrôle Opus (désactivé) OU brouillon sans risque (Lever 1): on n'envoie que le
        // propre (aucune alerte, aucune note). Un envoi sûr part directement, sans coût Opus.
        envoyer = alertes.length === 0 && !out.note_interne;
        if (sansRisque && SEND_QC && envoyer) qcSkipped++;
      }

      // Corps final (corrigé par Opus si applicable) rendu en HTML cliquable.
      const corpsHtml = linkify(corpsFinal.replace(/\n/g, "<br>"));

      // Suivi: qui a le prochain geste. Détermine close vs close+relance après envoi.
      const suivi = ["client", "nous", "aucun"].includes(out.suivi) ? out.suivi : "aucun";
      const relanceJours = suivi === "nous" ? Math.min(60, Math.max(1, parseInt(out.relance_jours, 10) || 3)) : 0;
      const relanceRaison = suivi === "nous" ? noDash(sanit(String(out.relance_raison || ""))) : "";

      // Item de digest si on ENVOIE une réponse qui promet une action.
      let itemDigest = null;
      if (envoyer && aAgir) {
        const actionTxt = noDash(sanit(String(out.action_requise || actionAuto || "")));
        const montants = [...new Set(corpsFinal.match(/\d+(?:[.,]\d{1,2})?\s?\$|\$\s?\d+(?:[.,]\d{1,2})?/g) || [])];
        const estRembours = /rembours|refund|crédit/i.test(`${actionTxt} ${corpsFinal}`);
        itemDigest = {
          url: `https://mail.missiveapp.com/#inbox/conversations/${conv.id}`,
          nom: last.from_field?.name || toAddr || "?", subject: subj,
          categorie: out.categorie, langue: out.langue, action: actionTxt, montants, rembours: estRembours,
        };
        actionsDigest.push(itemDigest);
      }

      if (DIGEST_SUPPORT) poulsRecords.push({
        id: conv.id, expediteur: last.from_field?.name || last.from_field?.address || "?",
        sujet: subj || "(sans sujet)", categorie: out.categorie, jours: joursAttente,
        statut: envoyer
          ? (itemDigest ? "réponse envoyée + action à faire" : "réponse envoyée")
          : qcBlocked ? "brouillon (Opus a retenu la réponse)"
          : alarme ? "brouillon + alerte de voix"
          : verifRequise ? "brouillon + note" : "brouillon",
        extrait: cleanBody(bodies.get(last.id) || last.preview || "").slice(0, 400),
      });

      if (DRY_RUN) {
        if (envoyer) {
          sent++;
          const opusTxt = corrige ? "Opus: CORRIGÉ" : qcVerdict ? "Opus: OK" : (sansRisque ? "sans QC (sûr)" : "sans QC");
          const finTxt = suivi === "nous" ? `close + relance ${relanceJours}j${relanceRaison ? " (" + relanceRaison.slice(0, 45) + ")" : ""}` : "close";
          const tags = `${escalade ? " | ESC" : ""}${enjeu ? " | ENJEU" : ""}`;
          console.log(`\n[DRY ENVOI ${sent}] ${subj.slice(0, 60) || "(sans sujet)"} | ${out.categorie} | ${out.langue}${tags} → ${toAddr} | ${opusTxt} | ${finTxt}`);
          if (escalade && out.escalade_raison) console.log(`  >> escalade: ${sanit(String(out.escalade_raison))}`);
          if (corrige && qcVerdict?.raison) console.log(`  >> correction: ${qcVerdict.raison}`);
          if (itemDigest) console.log(`  >> ${itemDigest.rembours ? "REMBOURSEMENT" : "ACTION"} au digest: ${itemDigest.action}`);
        } else {
          created++;
          if (verifRequise) verifs++;
          const pourquoi = qcBlocked
            ? `Opus bloque (${qcVerdict.raison || "jugement humain"})`
            : AUTO_SEND
            ? (!catAutorisee ? "catégorie non permise" : !estCourriel ? "canal social" : !toAddr ? "sans destinataire" : (aAgir && !SEND_ACTIONS) ? "action, SEND_ACTIONS off" : !SEND_QC ? "alerte/note, sans QC" : "plafond envois")
            : "envoi auto éteint";
          console.log(`\n[DRY draft ${created}] ${subj.slice(0, 60) || "(sans sujet)"} | ${out.categorie} | ${out.langue}${escalade ? " | ESC" : ""}${enjeu ? " | ENJEU" : ""} | to: ${toAddr || "(social)"} | reste brouillon: ${pourquoi}`);
          if (alarme) console.log("  ⚠️⚠️ VÉRIFICATION HUMAINE REQUISE AVANT ENVOI ⚠️⚠️");
          for (const l of noteLigne) console.log(`  >> ${l}`);
        }
        console.log(`---\n${corpsFinal}\n[+ notice IA ajoutée en pied]\n---`);
      } else {
        // Corps final identique pour envoi et brouillon: texte + signature + notice IA.
        const bodyFinal = corpsHtml + signature + NOTICE_HTML;
        const draft = {
          conversation: conv.id,
          organization: ORG,
          from_field: { address: EXPORT_FROM },
          subject: subj ? `Re: ${subj.replace(/^re:\s*/i, "")}` : undefined,
          body: bodyFinal,
          quote_previous_message: estCourriel, // apparence de réponse
        };
        if (toAddr) draft.to_fields = [{ address: toAddr }];
        if (envoyer) {
          draft.send = true; // ENVOI RÉEL (irréversible), approuvé par le contrôle Opus
          // Pas de label « Draft AI Support » sur un message ENVOYÉ (il dédoublonne des brouillons).
        } else {
          draft.add_shared_labels = labels;
        }

        try {
          await apiPost("/drafts", { drafts: draft });
          if (envoyer) {
            sent++;
            console.log(`[ENVOYÉ ${sent}] ${subj.slice(0, 60) || "(sans sujet)"} | ${out.categorie} | ${out.langue} → ${toAddr}${corrige ? " | CORRIGÉ" : ""}${suivi === "nous" ? ` | relance ${relanceJours}j` : ""}${itemDigest ? (itemDigest.rembours ? " | REMBOURSEMENT" : " | ACTION") : ""}`);
            // Fermer le fil (et poser la relance si on doit relancer).
            try { await fermerFil(conv.id, relanceJours, relanceRaison); }
            catch (e) { console.warn(`  fermeture échouée sur ${conv.id}: ${e.message}`); }
            if (itemDigest) {
              // Note légère sur le fil: l'action reste visible même hors digest.
              try {
                await apiPost("/posts", {
                  posts: {
                    conversation: conv.id, organization: ORG,
                    notification: { title: itemDigest.rembours ? "Remboursement à faire" : "Action à faire", body: itemDigest.action.slice(0, 200) },
                    username: "Support IA",
                    markdown: `**${itemDigest.rembours ? "Remboursement" : "Action"} à faire (réponse déjà envoyée):** ${itemDigest.action}\n\n(Ajouté au digest des actions à traiter.)`,
                  },
                });
              } catch (e) { console.warn(`  note action échouée sur ${conv.id}: ${e.message}`); }
            }
          } else {
            created++;
            drafted.add(conv.id);
            if (verifRequise) verifs++;
            console.log(`[draft ${created}] ${subj.slice(0, 60) || "(sans sujet)"} | ${out.categorie} | ${out.langue}${alarme ? " | ⚠️ VÉRIFICATION REQUISE" : verifRequise ? " | note" : ""}`);
            if (verifRequise) {
              try {
                await apiPost("/posts", {
                  posts: {
                    conversation: conv.id,
                    organization: ORG,
                    notification: alarme
                      ? { title: "⚠️ Brouillon IA: VÉRIFIER AVANT D'ENVOYER", body: noteLigne.join(" | ").slice(0, 200) }
                      : { title: "Note IA", body: noteLigne.join(" | ").slice(0, 200) },
                    username: "Support IA",
                    markdown: alarme
                      ? "## ⚠️ NE PAS ENVOYER TEL QUEL: vérifications requises\n" + noteLigne.map((l) => `- ${l}`).join("\n")
                      : "**Note IA:**\n" + noteLigne.map((l) => `- ${l}`).join("\n"),
                  },
                });
              } catch (e) { console.warn(`  post interne échoué sur ${conv.id}: ${e.message}`); }
            }
          }
          // Mémoire des excuses: vaut pour un envoi comme pour un brouillon.
          if (out.excuse_utilisee) {
            const list = excuses.get(clientKey) || [];
            list.push({ date: new Date().toISOString().slice(0, 10), texte: String(out.excuse_utilisee).slice(0, 200) });
            excuses.set(clientKey, list);
          }
        } catch (e) {
          errors++;
          console.warn(`  ${doSend ? "envoi" : "draft"} échoué sur ${conv.id} (canal ${last.type || "?"}): ${e.message}`);
        }
      }
    } catch (e) {
      errors++;
      console.warn(`  fil ${conv.id} sauté: ${e.message}`);
    }
  }

  if ((created > 0 || sent > 0) && !DRY_RUN) await saveJsonMemory(excuses, "memoire_excuses", "Mémoire des excuses");
  if (ecartesModifiee && !DRY_RUN) {
    for (const id of [...ecartes.keys()]) if (!inboxById.has(id)) ecartes.delete(id);
    await saveJsonMemory(ecartes, "memoire_ecartes", "Mémoire des fils écartés");
  }

  // Digest des actions/remboursements à faire (réponses déjà envoyées). À donner à Cowork.
  if (actionsDigest.length) {
    const md = construireDigest(actionsDigest);
    const nbRemb = actionsDigest.filter((i) => i.rembours).length;
    if (DRY_RUN) {
      console.log(`\n[DRY] Digest de ${actionsDigest.length} action(s) à faire (${nbRemb} remboursement(s)):\n${md}`);
    } else {
      try {
        await deposeDigest(md);
        console.log(`Digest déposé: ${actionsDigest.length} action(s) dont ${nbRemb} remboursement(s), dans ${ACTIONS_CONV}.`);
      } catch (e) {
        console.warn(`Dépôt du digest échoué (${e.message}). Digest complet:\n${md}`);
      }
    }
  }
  // Pouls du service (v2.11): un seul par jour (au run dont l'heure UTC = DIGEST_HOUR).
  if (DIGEST_SUPPORT && poulsRecords.length) {
    const heureUTC = new Date().getUTCHours();
    if (DIGEST_HOUR < 0 || heureUTC === DIGEST_HOUR) {
      try {
        const resP = await poulsIA(poulsRecords);
        const mdP = construirePouls(resP, poulsRecords);
        if (DRY_RUN || !RESUME_CONV) {
          console.log(`\n--- POULS SERVICE (${!RESUME_CONV ? "pas de RESUME_CONV" : "simulation"}) ---\n${mdP}\n`);
        } else {
          await postPouls(mdP);
          console.log(`Pouls du service posté (${(resP.escalades || []).length} escalade(s)).`);
        }
      } catch (e) { console.warn(`Pouls du service échoué (${e.message}).`); }
    } else {
      console.log(`Pouls du service: sauté (heure ${heureUTC} UTC, DIGEST_HOUR=${DIGEST_HOUR}).`);
    }
  }

  console.log(`\nBilan: ${analysed} analysés, ${sent} ENVOYÉ(S) (dont ${actionsDigest.length} avec action au digest), ${created} brouillon(s) dont ${verifs} avec note ou alarme, ${noReply} sans réponse requise, ${skipped} sautés, ${dejaBrouillon} avec brouillon existant, ${ecarteSkips} écartés en mémoire, ${errors} erreur(s).`);
  if (SEND_QC && (qcCalls > 0 || qcSkipped > 0)) {
    const coutQC = qcUsage.in * QC_RATE_IN + qcUsage.cacheCreate * QC_RATE_IN + qcUsage.cacheRead * QC_RATE_CACHE + qcUsage.out * QC_RATE_OUT;
    console.log(`Contrôle Opus: ${qcCalls} relecture(s)${QC_LEAN ? " (contexte allégé)" : ""}, ${qcBlocks} refus, ${qcSkipped} envoi(s) sûr(s) sans QC. Tokens in ${qcUsage.in}/cache ${qcUsage.cacheRead}/out ${qcUsage.out}. Coût QC estimé: ~ ${coutQC.toFixed(2)} $ US (tarifs à vérifier).`);
    console.log(`Escalades vers le QC: ${escalCount} par jugement de Sonnet (associé), ${enjeuCount} par enjeu détecté dans le fil.`);
  }
  console.log("Run terminé.");
})().catch((e) => { console.error("Erreur fatale:", e.message); process.exit(1); });
