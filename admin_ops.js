/**
 * Lasclay — admin_ops.js (v3)
 * --------------------------------------------------------------------------
 * v3 — FUSION de digest.js. Une SEULE passe sur les boîtes Admin/Operations, un
 * SEUL appel IA par fil, qui fait DEUX choses : (1) TRIER (close / spam / à voir /
 * keep) et (2) pour les fils qui attendent une réponse de Gabriel ("keep"),
 * PRIORISER + préparer un brouillon. On poste ensuite UN digest priorisé
 * (🔴/💰/🟢) dans la conversation « Résumé » de chaque équipe, et on peut créer
 * des tâches Missive et des brouillons. digest.js devient inutile (son cron est
 * à désactiver). Fini les deux passes IA et le résumé en double.
 *
 * Trie les boîtes ADMIN (admin@lasclay.com) et OPERATIONS (operations@lasclay.com)
 * et désencombre l'inbox sans jamais escamoter un courriel qui demande un geste.
 * Ces boîtes ne sont PAS du service client.
 *
 * v2.1 — le juge IA reçoit le FIL COMPLET (NOUS/EUX, du plus ancien au plus récent),
 * plus seulement le dernier message (qui l'induisait en erreur sur les « Re: »). Le
 * déterministe, lui, continue de ne regarder que le dernier message (prudence).
 *
 * v2 — deux correctifs majeurs après le 1er run réel (v1.1 gardait tout car il
 * jugeait à l'aveugle) :
 *   1. LECTURE RÉELLE du courriel : sujet via latest_message_subject (souvent
 *      vide dans conv.subject) + CHARGEMENT DU CORPS du dernier message (le
 *      listage des messages ne renvoie pas le body). Sans ça, aucun texte à juger.
 *   2. L'IA (Opus) devient le MOTEUR, pas un simple appoint : elle voit le vrai
 *      sujet+corps et tranche chaque courriel entrant. Le déterministe reste un
 *      raccourci gratuit (reçus évidents) + les garde-fous.
 *
 * QUATRE ISSUES pour un fil :
 *   • FERMÉ  — pur bruit réglé, plus rien à en faire (reçu, paiement reçu).
 *   • SPAM   — démarchage/sollicitation froide non désirée (ex. agence qui
 *              prospecte, « petite question rapide » déguisée en vente). Action
 *              réelle réglée par SPAM_ACTION (l'API Missive n'a pas de « spam »).
 *   • À VOIR — aucune urgence MAIS action douce/éventuelle ou info à connaître
 *              (ex. « The new HelpCenter is live now »). GARDÉ OUVERT + label
 *              de revue optionnel. Ne se ferme JAMAIS par commodité.
 *   • GARDÉ  — une action réelle est plausible/attendue, ou dans le doute.
 *
 * CHAÎNE DE DÉCISION, pour chaque fil OUVERT :
 *   0. Fil assigné à quelqu'un ................................. GARDÉ (humain dessus)
 *   1. Dernier message = NOUS ................................... GARDÉ (balle dans leur camp)
 *   2. Fast-path gratuit : reçu AUTOMATIQUE sans action .......  FERMÉ (sans appel IA)
 *   3. IA (Opus) sur le FIL COMPLET .......................... close / spam / a_voir / keep
 *      - un SIGNAL D'ACTION clair interdit close/spam (garde-fou : devient keep)
 *      - close & spam seulement si confiance ≥ AI_SEUIL / SPAM_SEUIL
 *      - keep = fil qui attend Gabriel → PRIORISÉ + brouillon → entre au DIGEST
 *
 * DIGEST : les fils "keep" sont regroupés par équipe et postés en résumé priorisé
 * (🔴 à traiter / 💰 opportunités / 🟢 vite fait) dans la conversation « Résumé »
 * de chaque boîte, avec sous-tâches et brouillons prêts à relire. Option : vraies
 * tâches Missive (MISSIVE_TASK_LABEL) et vrais brouillons (CREATE_DRAFTS).
 *
 * ACTIONS API : fermeture = POST /posts close:true + note. Spam : SPAM_ACTION =
 * "close" (défaut) | "trash" | "label". « À voir » = label silencieux. Tout fil se
 * rouvre s'il reçoit une réponse. (Missive n'expose ni archive ni « mark as spam ».)
 *
 * GARDE-FOUS :
 *   DRY_RUN=true par défaut : liste tout, ne touche à RIEN (l'IA tourne quand même
 *   pour montrer ses verdicts → un run DRY avec IA a un coût de tokens).
 *   Premier vrai run conseillé : DRY_RUN=false + CLOSE_LIMIT=3.
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN     token API (missive_pat-...)                        [requis]
 *   ANTHROPIC_API_KEY clé Anthropic (requise pour le juge IA; sinon repli déterministe)
 *   MISSIVE_ORG       id d'organisation (défaut Lasclay)              [facultatif]
 *   TEAMS             override : ids d'équipes (défaut Admin + Operations). [facultatif]
 *   LIST_TEAMS        "true" = imprime les équipes de l'org et sort.  [facultatif]
 *   DRY_RUN           "false" pour agir. DÉFAUT "true" (simulation).
 *   USE_AI            "false" pour couper le juge IA. DÉFAUT true (moteur principal).
 *   MODEL             modèle du juge (défaut claude-opus-4-8).
 *   AI_SEUIL          confiance min. pour FERMER/SPAM via l'IA (0-1). Défaut 0.85.
 *   SPAM_ACTION       "close" (défaut) | "trash" | "label" — geste sur le démarchage.
 *   SPAM_LABEL_ID     label « Spam » posé si SPAM_ACTION="label".     [facultatif]
 *   CLOSE_LIMIT       plafond de fermetures + spams par run (0 = illimité). Défaut 0.
 *   MAX_FILS          plafond de fils analysés par run (0 = illimité). Défaut 0.
 *   SKIP_ASSIGNED     "false" pour traiter aussi les fils assignés. Défaut true.
 *   AUTO_REQUIRED     "false" pour permettre le fast-path même sans expéditeur
 *                     automatique. Défaut true (le fast-path reste prudent).
 *   NOTIF_DOMAINS     domaines expéditeurs à traiter comme automatiques, en plus
 *                     des défauts, séparés par des virgules.          [facultatif]
 *   CLOSED_LABEL_ID   label posé sur les fils fermés (traçabilité).   [facultatif]
 *   REVIEW_LABEL_ID   label posé sur les fils « à voir » (gardés ouverts). [facultatif]
 *   SPAM_SEUIL        confiance min. pour le spam (0-1). Défaut 0.85 (prudent).
 *   --- DIGEST (fusion digest.js) ---
 *   POST_DIGEST       "false" pour ne pas poster de digest. DÉFAUT true.
 *   DIGEST_HOUR       ne poster qu'au run de cette heure UTC (-1 = à chaque run). Défaut -1.
 *   DIGEST_SKIP_WEEKEND  "false" pour poster aussi sam/dim. Défaut true (heure Québec).
 *   MAX_IA            plafond d'appels IA par run (0 = illimité). Défaut 0.
 *   MISSIVE_TASK_LABEL   label-marqueur : si défini, crée de vraies tâches pour les 🔴.
 *   CREATE_DRAFTS     "true" = crée de vrais brouillons de réponse. Défaut false.
 *   MISSIVE_DRAFT_LABEL  label-marqueur anti-doublon des brouillons.
 *   DRAFT_LIMIT       plafond de brouillons créés par run (0 = illimité).
 *   MISSIVE_SELF_ADDRESSES  nos adresses (défaut hey@, admin@, operations@).
 *   KNOWLEDGE : contexte_lasclay.md (à côté du script) nourrit les brouillons.
 */

const VERSION = "v3.2";

const fs = require("node:fs");
const path = require("node:path");

const TOKEN = process.env.MISSIVE_TOKEN;
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36"; // Lasclay
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false"; // défaut: simulation
const CLOSE_LIMIT = parseInt(process.env.CLOSE_LIMIT || "0", 10) || 0;
const MAX_FILS = parseInt(process.env.MAX_FILS || "0", 10) || 0;
const SKIP_ASSIGNED = (process.env.SKIP_ASSIGNED || "true").toLowerCase() !== "false";
const AUTO_REQUIRED = (process.env.AUTO_REQUIRED || "true").toLowerCase() !== "false";
// v2 — le juge IA (Opus) est le MOTEUR par défaut : les boîtes Admin/Operations sont
// hétérogènes et à faible volume, le déterministe seul est trop aveugle (cf. run v1.1).
// Dégradation gracieuse : si USE_AI mais pas de clé, on prévient et on retombe sur le
// déterministe (au lieu de planter), pour qu'un run parte toujours.
const USE_AI = (process.env.USE_AI || "true").toLowerCase() !== "false";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const AI_ON = USE_AI && !!ANTHROPIC_KEY;
const MODEL = process.env.MODEL || "claude-opus-4-8";
const AI_SEUIL = parseFloat(process.env.AI_SEUIL || "0.85");
const LIST_TEAMS = (process.env.LIST_TEAMS || "").toLowerCase() === "true";
// Détail ligne par ligne des GARDÉS (sinon décompte par raison, log lisible).
const SHOW_KEPT = (process.env.SHOW_KEPT || "").toLowerCase() === "true";
const CLOSED_LABEL_ID = process.env.CLOSED_LABEL_ID || "";
// Label optionnel posé sur les fils « à voir » (action douce / éventuelle, gardés OUVERTS) :
// donne à Gabriel une pile filtrée « à regarder un jour » sans encombrer l'inbox principale.
const REVIEW_LABEL_ID = process.env.REVIEW_LABEL_ID || "";
// v2 — Spam / démarchage non désiré. L'API Missive n'a PAS de « mark as spam »; on
// choisit l'action réelle : "close" (défaut prudent, simple fermeture), "trash"
// (met à la corbeille), ou "label" (pose SPAM_LABEL_ID + ferme).
const SPAM_ACTION = (process.env.SPAM_ACTION || "close").toLowerCase();
const SPAM_LABEL_ID = process.env.SPAM_LABEL_ID || "";
// Seuil de confiance PROPRE au spam. HAUT par défaut (0.85) : le spam est rare et
// dangereux (un faux positif écarte une occasion/communication importante — cf. les
// invitations institutionnelles type PARI, qui NE sont PAS du spam). À ne baisser
// qu'avec prudence, et jamais avec SPAM_ACTION="trash".
const SPAM_SEUIL = parseFloat(process.env.SPAM_SEUIL || "0.85");

// === v3 — DIGEST fusionné (ex digest.js) ===================================
// Pour les fils qui ATTENDENT une réponse de Gabriel (gardés/actionnables), le
// même appel IA rend aussi les champs de priorisation + un brouillon. On poste un
// digest priorisé dans la conversation « Résumé » de chaque équipe, et on peut
// créer des tâches Missive et des brouillons. Remplace entièrement digest.js.
const POST_DIGEST = (process.env.POST_DIGEST || "true").toLowerCase() !== "false";
// Ne poster le digest qu'au run dont l'heure UTC == DIGEST_HOUR (-1 = à chaque run).
const DIGEST_HOUR = parseInt(process.env.DIGEST_HOUR || "-1", 10);
// Pas de digest la fin de semaine (heure du Québec). Le tri/fermeture, lui, tourne.
const DIGEST_SKIP_WEEKEND = (process.env.DIGEST_SKIP_WEEKEND || "true").toLowerCase() !== "false";
const MAX_IA = parseInt(process.env.MAX_IA || "0", 10) || 0; // plafond d'appels IA (0 = illimité)
// Création de vraies tâches Missive pour les fils 🔴 (priorité haute). Vide = désactivé.
const TASK_LABEL = process.env.MISSIVE_TASK_LABEL || "";
// Création de brouillons de réponse (opportunités / relances). Anti-doublon par label.
const CREATE_DRAFTS = (process.env.CREATE_DRAFTS || "false").toLowerCase() === "true";
const DRAFT_LABEL = process.env.MISSIVE_DRAFT_LABEL || "d0fad8a6-2ce4-427e-a971-949b2313d118";
const DRAFT_LIMIT = parseInt(process.env.DRAFT_LIMIT || "0", 10);

// Contexte d'entreprise (pour que les brouillons sonnent vrais) : lu depuis
// contexte_lasclay.md à côté du script, repli court si absent.
const CONTEXTE_COURT =
  "Lasclay (lasclay.com), entreprise québécoise de produits à base d'asclépiade " +
  "(milkweed) : isolation/fibres textiles durables. Gabriel Gouveia, co-fondateur.";
let CONTEXTE_LASCLAY = CONTEXTE_COURT;
try {
  const p = path.join(__dirname, "contexte_lasclay.md");
  if (fs.existsSync(p)) CONTEXTE_LASCLAY = fs.readFileSync(p, "utf8");
} catch (_) {}

// --- Équipes ciblées : id, nom, conversation « Résumé » où poster le digest,
//     adresse d'envoi pour les brouillons (ids confirmés, ex digest.js). ---
const DEFAULT_TEAMS = [
  { id: "a6c74be0-2a27-4c79-9294-a74b447e6dc0", name: "Lasclay Admin",
    digestConversation: "9e3f9ab8-9bb4-4a89-8040-9cf76284949d", fromAddress: "admin@lasclay.com" },
  { id: "7c925f0d-3eca-4535-be20-424078619cef", name: "LAS Operations",
    digestConversation: "8b0001c6-97ba-4c62-a12a-9ac6247326c9", fromAddress: "operations@lasclay.com" },
];
const ENV_TEAMS = (process.env.TEAMS || "").split(",").map((s) => s.trim()).filter(Boolean);
const TEAMS = ENV_TEAMS.length > 0 ? ENV_TEAMS.map((id) => ({ id, name: id })) : DEFAULT_TEAMS;

const SELF = (process.env.MISSIVE_SELF_ADDRESSES ||
  "hey@lasclay.com,admin@lasclay.com,operations@lasclay.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const API = "https://public.missiveapp.com/v1";
const mHeaders = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (require.main === module) {
  if (!TOKEN) { console.error("Manque MISSIVE_TOKEN."); process.exit(1); }
  if (USE_AI && !ANTHROPIC_KEY) {
    console.warn("⚠️  USE_AI actif mais ANTHROPIC_API_KEY absente : repli sur le déterministe seul (performance réduite).");
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const sanit = (s) => (s || "")
  .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
  .replace(/(^|[^\uD800-\uDBFF])([\uDC00-\uDFFF])/g, "$1");

// ==========================================================================
//  Appels Missive (patron validé : retry réseau + 429)
// ==========================================================================
async function api(path, tries = 0) {
  await sleep(260);
  let res;
  try { res = await fetch(`${API}${path}`, { headers: mHeaders }); }
  catch (e) {
    if (tries < 4) {
      console.warn(`Réseau (${e.message}) sur GET ${path}, pause ${(tries + 1) * 5}s...`);
      await sleep((tries + 1) * 5000);
      return api(path, tries + 1);
    }
    throw e;
  }
  if (res.status === 429) { console.warn("Limite de débit, pause 30 s..."); await sleep(30000); return api(path, tries); }
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function apiPost(path, body, tries = 0) {
  await sleep(260);
  let res;
  try { res = await fetch(`${API}${path}`, { method: "POST", headers: mHeaders, body: JSON.stringify(body) }); }
  catch (e) {
    if (tries < 4) {
      console.warn(`Réseau (${e.message}) sur POST ${path}, pause ${(tries + 1) * 5}s...`);
      await sleep((tries + 1) * 5000);
      return apiPost(path, body, tries + 1);
    }
    throw e;
  }
  if (res.status === 429) { console.warn("Limite de débit, pause 30 s..."); await sleep(30000); return apiPost(path, body, tries); }
  const text = await res.text();
  if (!res.ok) console.error(`POST ${path} → ${res.status} ${text}`);
  return { ok: res.ok, status: res.status, text };
}

// PATCH silencieux (changement de label sans commentaire, sans notification, sans
// remontée du fil en haut de la boîte). Patron validé de merge.js.
async function apiPatch(path, body, tries = 0) {
  await sleep(260);
  let res;
  try { res = await fetch(`${API}${path}`, { method: "PATCH", headers: mHeaders, body: JSON.stringify(body) }); }
  catch (e) {
    if (tries < 4) {
      console.warn(`Réseau (${e.message}) sur PATCH ${path}, pause ${(tries + 1) * 5}s...`);
      await sleep((tries + 1) * 5000);
      return apiPatch(path, body, tries + 1);
    }
    throw e;
  }
  if (res.status === 429) { console.warn("Limite de débit, pause 30 s..."); await sleep(30000); return apiPatch(path, body, tries); }
  const text = await res.text();
  if (!res.ok) console.error(`PATCH ${path} → ${res.status} ${text}`);
  return { ok: res.ok, status: res.status, text };
}

async function apiDelete(path, tries = 0) {
  await sleep(260);
  let res;
  try { res = await fetch(`${API}${path}`, { method: "DELETE", headers: mHeaders }); }
  catch (e) {
    if (tries < 4) { await sleep((tries + 1) * 5000); return apiDelete(path, tries + 1); }
    throw e;
  }
  if (res.status === 429) { await sleep(30000); return apiDelete(path, tries); }
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

// --- Appel Anthropic (system en TABLEAU pour le cache de prompt), seulement si USE_AI ---
async function claude(systemBlocks, user, maxTokens) {
  const payload = JSON.stringify({
    model: MODEL,
    max_tokens: maxTokens || 400,
    system: systemBlocks,
    messages: [{ role: "user", content: sanit(user) }],
  });
  for (let attempt = 1; attempt <= 6; attempt++) {
    await sleep(600);
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
  const cleaned = (text || "").replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

// ==========================================================================
//  Nettoyage HTML (patron validé de support.js)
// ==========================================================================
function stripHtml(s) {
  if (!s) return "";
  let t = s.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  t = t.replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
       .replace(/&gt;/gi, ">").replace(/&#39;|&rsquo;/gi, "'").replace(/&quot;/gi, '"');
  return t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// ==========================================================================
//  Listage + messages
// ==========================================================================
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
const listTeamInbox = (teamId) => listByFilter(`team_inbox=${teamId}`);

async function threadMessages(convId) {
  const { messages = [] } = await api(`/conversations/${convId}/messages?limit=10`);
  return messages
    .slice()
    .sort((a, b) => (a.delivered_at || a.created_at || 0) - (b.delivered_at || b.created_at || 0));
}

const isUs = (m) => {
  const addr = (m.from_field?.address || "").toLowerCase();
  return SELF.includes(addr) || !!m.author?.name; // author = membre de l'équipe qui a écrit depuis Missive
};

async function fetchBody(messageId) {
  try {
    const r = await api(`/messages/${messageId}`);
    const m = Array.isArray(r.messages) ? r.messages[0] : r.messages;
    return m ? (m.body || m.preview || "") : "";
  } catch { return ""; }
}

// Corps de plusieurs messages en lot (patron validé de support.js) : GET /messages/:id,:id2
// renvoie les body. Fallback message par message si le lot échoue.
async function fetchBodies(ids) {
  const bodies = new Map();
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    try {
      const r = await api(`/messages/${chunk.join(",")}`);
      const arr = Array.isArray(r.messages) ? r.messages : [r.messages];
      for (const m of arr) if (m && m.id) bodies.set(m.id, m.body || m.preview || "");
    } catch {
      for (const id of chunk) bodies.set(id, await fetchBody(id));
    }
  }
  return bodies;
}

// Fil complet, du plus ancien au plus récent, pour le juge IA. Chaque tour est
// étiqueté NOUS / EUX afin qu'Opus comprenne le va-et-vient (le dernier message
// seul induit en erreur sur les « Re: », cf. le faux « démarchage » PARI).
function construireFil(msgs, bodies) {
  return msgs
    .map((m) => {
      const who = isUs(m) ? "NOUS" : `EUX (${m.from_field?.name || m.from_field?.address || "?"})`;
      const ts = m.delivered_at || m.created_at;
      const d = ts ? new Date(ts * 1000).toISOString().slice(0, 10) : "";
      const txt = stripHtml(bodies.get(m.id) || m.preview || "").slice(0, 1500);
      return `[${d}] ${who}: ${txt || "(sans texte)"}`;
    })
    .join("\n\n")
    .slice(0, 12000); // plafond de sécurité sur les très longs fils
}

// ==========================================================================
//  Détecteurs déterministes
// ==========================================================================

// Expéditeur automatique : local-part typique OU domaine de notification connu.
// (Les défauts couvrent les deux exemples fournis : anthropic.com, virginplus.ca.)
const AUTO_LOCALPARTS = [
  "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
  "mailer", "mail", "notification", "notifications", "notify",
  "billing", "receipt", "receipts", "invoice", "invoices", "statements",
  "payment", "payments", "auto", "automated", "bounce", "postmaster", "info-noreply",
];
const DEFAULT_NOTIF_DOMAINS = [
  "shopify.com", "etsy.com", "klaviyo.com", "stripe.com", "paypal.com",
  "intuit.com", "quickbooks.com", "anthropic.com", "virginplus.ca",
  "google.com", "googlemail.com", "amazon.com", "amazonaws.com",
];
const NOTIF_DOMAINS = [
  ...DEFAULT_NOTIF_DOMAINS,
  ...(process.env.NOTIF_DOMAINS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
];
function isAutomatedSender(addr) {
  if (!addr) return false;
  const a = addr.toLowerCase();
  const local = a.split("@")[0] || "";
  const domain = a.split("@")[1] || "";
  if (AUTO_LOCALPARTS.some((p) => local.includes(p))) return true;
  if (NOTIF_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) return true;
  return false;
}

// Diffusion (mailing list / infolettre) : marqueur de désabonnement dans le corps.
// Élargit le vivier de candidats du juge IA (une pub OU une mise à jour produit à voir),
// SANS jamais élargir la fermeture déterministe (qui reste ancrée à l'expéditeur).
const BROADCAST_RE = [
  /unsubscribe/i, /se d[ée]sabonner/i, /list-unsubscribe/i, /g[ée]rer (?:mes|vos) (?:pr[ée]f[ée]rences|abonnements)/i,
  /view (?:this|in) (?:email )?(?:in your )?browser/i, /consultez-le en ligne/i,
];
function isBroadcast(text) {
  return BROADCAST_RE.some((re) => re.test(text));
}

// Signaux « SANS ACTION » : reçus, confirmations de paiement, avis informatifs.
const NO_ACTION_RE = [
  /\breceipt\b/i, /\bre[çc]u\b/i, /your receipt/i, /votre re[çc]u/i, /receipt (from|for|#)/i,
  /payment received/i, /paiement re[çc]u/i, /nous avons re[çc]u votre paiement/i,
  /we (?:have )?received your payment/i, /thank you for your payment/i, /merci[^.]{0,40}paiement/i,
  /payment confirmation/i, /confirmation de paiement/i, /paiement pr[ée]autoris[ée]/i,
  /auto[- ]?recharge/i, /rechargement automatique/i,
  /invoice paid/i, /facture pay[ée]e/i, /\bpaid\b/i,
  /subscription (?:has been )?renewed/i, /abonnement[^.]{0,30}renouvel/i, /renewal (?:confirmation|receipt)/i,
  /solde[^.]{0,30}\b0[.,]00\b/i, /balance[^.]{0,30}\b(?:is )?\$?0[.,]00\b/i,
  /no action (?:is )?(?:required|needed)/i, /aucune action[^.]{0,20}(?:requise|n[ée]cessaire)/i,
  /for your records/i, /pour vos dossiers/i,
];
function hasNoActionSignal(text) {
  return NO_ACTION_RE.some((re) => re.test(text));
}

// SIGNAUX D'ACTION (exclusions) : présents → on GARDE, toujours. Priment sur tout.
const ACTION_RE = [
  // « action required/needed » MAIS pas la forme niée « no action needed » / « aucune action requise ».
  /(?<!no )(?<!aucune )action (?:is )?(?:required|needed|requested)/i,
  /(?<!aucune )action requise/i, /r[ée]ponse requise/i,
  /please (?:respond|reply|confirm|verify|review|complete|update|act)/i,
  /veuillez (?:r[ée]pondre|confirmer|v[ée]rifier|mettre [àa] jour|compl[ée]ter|agir)/i,
  /payment (?:failed|declined|unsuccessful|could not)/i, /[ée]chec (?:du|de) paiement/i,
  /paiement (?:refus[ée]|[ée]chou[ée])/i, /card (?:was )?declined/i, /carte refus[ée]e/i,
  /past due/i, /overdue/i, /en retard/i, /en souffrance/i, /\bunpaid\b/i, /impay[ée]/i,
  /amount due/i, /montant d[uû]/i, /balance due/i, /solde d[uû]/i, /[àa] payer/i, /to be paid/i,
  /verify your/i, /v[ée]rifiez votre/i, /confirm your/i, /confirmez votre/i, /confirm(?:er)? (?:your |votre )?(?:email|courriel|identity|identit[ée])/i,
  /suspend(?:ed|re|u)/i, /suspension/i, /account (?:on )?hold/i, /compte (?:suspendu|bloqu[ée]|en attente)/i,
  /\burgent\b/i, /immediately/i, /imm[ée]diatement/i, /dès que possible/i, /as soon as possible/i,
  /will expire/i, /expir(?:e|es|ing|era|ation)/i, /expire (?:bient[ôo]t|le)/i,
  /security alert/i, /alerte de s[ée]curit[ée]/i, /unusual (?:activity|sign)/i, /new sign-?in/i, /connexion inhabituelle/i,
  /dispute/i, /chargeback/i, /litige/i, /r[ée]trofacturation/i,
  /refund (?:request|requested)/i, /demande de remboursement/i, /rembours(?:ez|er)-moi/i,
  /cancel(?:l?ed|lation)?/i, /annulation/i, /r[ée]siliation/i,
  /shipment (?:delayed|held|failed)/i, /probl[èe]me[^.]{0,20}livraison/i, /delivery (?:failed|problem|issue)/i,
  /reset your password/i, /r[ée]initialis(?:er|ation)[^.]{0,20}mot de passe/i,
];
function hasActionSignal(text) {
  return ACTION_RE.some((re) => re.test(text));
}

// ==========================================================================
//  Fermeture d'un fil (sans action)
// ==========================================================================
async function fermerSansAction(convId, categorie) {
  const post = {
    conversation: convId, organization: ORG, close: true,
    // notification est REQUISE par POST /posts (sinon 400).
    notification: { title: "Fermé (sans action)", body: `Notification sans action (${categorie}).` },
    markdown: `_Fermé automatiquement par admin_ops.js : notification sans action requise (${categorie})._\n_Se rouvrira si quelqu'un y répond._`,
  };
  if (CLOSED_LABEL_ID) post.add_shared_labels = [CLOSED_LABEL_ID];
  return apiPost("/posts", { posts: post });
}

// Marque un fil « à voir » : garde OUVERT, pose le label de revue s'il est configuré.
// PATCH silencieux (pas de commentaire ni de remontée du fil). Sans label configuré,
// « à voir » se comporte comme un simple maintien ouvert (juste journalisé).
async function marquerAVoir(convId) {
  if (!REVIEW_LABEL_ID) return { ok: true, skipped: true };
  return apiPatch(`/conversations/${convId}`, {
    conversations: [{ id: convId, organization: ORG, add_shared_labels: [REVIEW_LABEL_ID] }],
  });
}

// Spam / démarchage. L'API Missive n'a pas de « mark as spam » : SPAM_ACTION choisit
// le geste réel. "trash" = corbeille (POST /posts trash:true, plus fort que close, mais
// réversible depuis la corbeille). "label" = pose SPAM_LABEL_ID + ferme. "close" = simple
// fermeture. On ferme aussi dans le cas trash pour sortir le fil de l'inbox proprement.
async function traiterSpam(convId, categorie) {
  const post = {
    conversation: convId, organization: ORG,
    // notification est REQUISE par POST /posts (sinon 400).
    notification: { title: "Démarchage écarté", body: `Sollicitation non désirée (${categorie}) → ${SPAM_ACTION}.` },
    markdown: `_admin_ops.js : démarchage/sollicitation non désiré (${categorie}). Action : ${SPAM_ACTION}._`,
  };
  if (SPAM_ACTION === "trash") { post.close = true; post.trash = true; }
  else if (SPAM_ACTION === "label") { post.close = true; if (SPAM_LABEL_ID) post.add_shared_labels = [SPAM_LABEL_ID]; }
  else { post.close = true; } // "close" (défaut)
  return apiPost("/posts", { posts: post });
}

// ==========================================================================
//  Juge IA (Opus par défaut) — appoint conservateur, seulement si USE_AI
// ==========================================================================
const AI_SYSTEM = [
  {
    type: "text",
    cache_control: { type: "ephemeral" },
    text: "CONTEXTE LASCLAY (référence interne, ne jamais citer comme source; sert à rendre les brouillons vrais) :\n\n" + CONTEXTE_LASCLAY,
  },
  {
    type: "text",
    cache_control: { type: "ephemeral" },
    text:
`Tu traites les boîtes ADMIN et OPERATIONS de Lasclay (asclépiade / papillons monarques) : courriels
administratifs et opérationnels (partenaires, gouvernement, opportunités, fournisseurs, reçus, factures,
notifications de plateformes...). Ce N'EST PAS du service client. Tu fais DEUX choses en un seul jugement :
d'abord TRIER (partie 1), puis, si le fil attend une réponse de Gabriel, le PRIORISER et préparer un brouillon
(partie 2).

== PARTIE 1 : TRIER == Classe le courriel dans UNE de quatre cases :

1. action="close" — À FERMER. Rien à FAIRE, ni maintenant ni plus tard, ET aucun suivi ni exploration à prévoir.
   Sois LARGE ici : tout le sans-suite se ferme (un digest garde la trace de chaque fermeture, donc c'est sans
   risque de fermer un simple informatif).
     - reçus, confirmations de paiement, accusés de réception, « aucune action requise », « pour vos dossiers »
     - notifications automatiques jetables (statut « livré » sans problème, etc.)
     - PUR INFORMATIF SANS SUITE : rapport de ventes/usage pour info, annonce produit d'un outil, mise à jour de
       politique/conditions à simplement noter, récapitulatif mensuel, avis dont on ne fera rien de concret
     - fil DÉJÀ RÉGLÉ où plus personne n'attend rien (échange conclu, question répondue, dossier clos).
   Le critère : après lecture, il ne reste ni geste, ni décision, ni suivi, ni raison d'y revenir → close.

2. action="a_voir" — À GARDER OUVERT MAIS SIGNALÉ. RÉSERVÉ à ce qui n'exige rien maintenant MAIS demandera un
   SUIVI, une EXPLORATION ou une DÉCISION plus tard. Ce n'est PAS un fourre-tout pour les informatifs (ceux-là
   se ferment, case 1).
     - outil qu'on utilise, à ALLER EXPLORER (EXEMPLE TYPE : « The new HelpCenter is live now »)
     - échéance/renouvellement à PLANIFIER (assurance à renouveler, retour d'appareil avec date limite)
     - ARGENT QUI SORT du compte (prélèvement, versement NÉGATIF, ex. « Payout -343$ ») : "a_voir", jamais
       "close" — il faut pouvoir le remarquer.
   Si, après lecture, il n'y a vraiment AUCUN suivi ni exploration à prévoir → ce n'est pas "a_voir", c'est "close".

3. action="spam" — RARE, à n'utiliser qu'en dernier recours. Uniquement le démarchage commercial CREUX d'un
   FOURNISSEUR/AGENCE/CONSULTANT PRIVÉ qui vend SES PROPRES services, sans aucune relation existante ET sans
   aucun lien avec la mission de Lasclay (asclépiade, monarques, textile isolant, semences, revente, etc.) :
     - agence/consultant qui prospecte à froid pour vendre du SEO, du dev, du marketing, du « financement »,
       du recrutement, un « partenariat » creux, un « quick question » déguisé en vente
       (SEUL EXEMPLE DE SPAM : « Petite question rapide… je parle avec des PME qui évaluent des projets
        numériques… est-ce vous qui regardez ça ? » — une agence privée qui vend ses services)
     - pourriel générique manifeste, liste commerciale sans aucun rapport avec nos activités.
   NE SONT JAMAIS DU SPAM, même non sollicités et même d'un inconnu — mets "keep" (ou "a_voir" si vraiment
   passif), PAS "spam" :
     - toute invitation à une séance d'information, un webinaire, un programme, une formation, surtout
       INSTITUTIONNEL / GOUVERNEMENTAL / d'innovation / de financement (ex. programmes type PARI, cybersécurité,
       export, subventions) — c'est IMPORTANT, ça peut demander une inscription ou une décision ;
     - tout ce qui touche la mission de Lasclay (asclépiade, monarques, semences, textile, revente, fournisseurs
       de matière), toute vraie personne, tout organisme public/paragouvernemental, tout partenaire potentiel.
   RÈGLE ABSOLUE : dans le moindre doute, ce N'EST PAS du spam → "keep". Mieux vaut garder cent courriels que
   d'écarter une seule occasion ou communication importante.

4. action="keep" — À GARDER, actif. Un geste, une décision ou une vérification est plausible ou attendu :
     - facture À PAYER, échec/refus de paiement, montant dû, solde à régler
     - « action requise », « vérifiez », « confirmez », suspension, expiration, alerte de sécurité
     - commande à traiter, remboursement, litige, livraison problématique
     - tout courriel écrit par une vraie personne (client, partenaire réel) qui attend quoi que ce soit
     - le moindre doute sur une action réelle : "keep".

Règle d'or : ne "close" ni "spam" JAMAIS par commodité. Un courriel qui mérite d'être connu ou revu est "a_voir".
Un vrai interlocuteur d'affaires est "keep", jamais "spam".

== PARTIE 2 (SEULEMENT si action="keep") : PRIORISER + PRÉPARER ==
Un fil "keep" attend une réponse/geste de Gabriel. Remplis alors AUSSI ces champs (sinon laisse-les vides) :
  "titre"      : 3 à 5 mots résumant le fil (surtout si le sujet est absent).
  "priorite"   : "haute" si échéance proche, montant en jeu, ou relance qui traîne; sinon "moyenne"/"basse".
  "phrase"     : l'action à poser, 15 mots max, concrète.
  "sous_taches": liste courte SI un document est à remplir/fournir (sinon []).
  "brouillon"  : une ébauche de réponse, UNIQUEMENT dans deux cas : (a) opportunité / développement d'affaires,
                 ou (b) relance (le contact a relancé, ou le fil attend > 60 jours). Sinon "".
                 N'écris un brouillon que si une réponse suffit SANS connaître un fait que tu ignores (date,
                 montant, statut) : sinon laisse "". Pour un fait inconnu, mets un marqueur {À COMPLÉTER}.
   (Ta "categorie" pour un keep : opportunite|developpement|gouvernement|relationnel|facture_a_payer|action_requise|autre.)

RÈGLES DE RÉDACTION DU BROUILLON (impératives) :
- Réagis à CE que la personne a écrit (offre, projet, chiffres). Jamais de questions génériques sur ce qu'elle a
  déjà dit. VOIX DE GABRIEL : gestionnaire occupé qui va droit au but, chaleureux mais efficace, langage accessible,
  jamais de platitudes, de flatterie ni de jargon corporate. Français QUÉBÉCOIS naturel quand tu écris en français.
- LANGUE : rédige DANS LA LANGUE du dernier message du contact.
- SALUTATION : commence toujours par « Bonjour [Prénom], » (FR) / « Hi [First name], » (EN); « Bonjour, » si prénom inconnu.
- Si le fil attend depuis longtemps : excuse-toi UNE fois, brièvement, jamais en ouverture, en l'attribuant à une
  période chargée (jamais à un manque d'intérêt). Varie la formulation.
- Rendez-vous : n'invente jamais de date; invite le contact à proposer une plage (idéalement pas un vendredi).
- INTERDITS : em dash « — » et « – » (utilise virgule/point/parenthèse); structure antithétique (« ce n'est pas X,
  c'est Y »); « n'hésitez pas à », « j'espère que ce message vous trouve bien », « glissé entre les mailles »,
  « fell through the cracks », « exactement le genre de », superlatifs de vendeur.
- NE SIGNE PAS (Missive ajoute la signature). Écris "brouillon" avec des \\n pour les sauts de ligne, jamais de vrai retour à la ligne.

Réponds STRICTEMENT en JSON (commence par { et finis par }), aucun texte autour, aucun « — » nulle part :
{"action":"close|a_voir|spam|keep","confiance":0.0-1.0,"raison":"courte phrase","categorie":"...","titre":"","priorite":"moyenne","phrase":"","sous_taches":[],"brouillon":""}`,
  },
];

const noDash = (s) => (s || "").replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",");

async function jugerIA(sujet, fil, expediteur, boite, diffusion, jours, dateStr) {
  const user =
`AUJOURD'HUI : ${dateStr}
BOÎTE : ${boite}
DERNIER EXPÉDITEUR EXTERNE : ${expediteur}
DIFFUSION (infolettre / envoi de masse) : ${diffusion ? "oui" : "non"}
CE FIL ATTEND UNE RÉPONSE DEPUIS : ${jours} jour(s)
SUJET : ${sujet}

FIL COMPLET (du plus ancien au plus récent; NOUS = Lasclay, EUX = l'externe). Une date proposée dans un vieux
message peut être DÉJÀ PASSÉE : ne confirme jamais une date dépassée. Lis TOUT le fil avant de juger.
------
${fil || "(aucun contenu)"}
------`;
  const raw = await claude(AI_SYSTEM, user, 1500);
  const out = parseJsonLoose(raw);
  const valides = new Set(["close", "a_voir", "spam", "keep"]);
  if (!out || !valides.has(out.action)) {
    return { action: "keep", categorie: "autre", confiance: 0, raison: "réponse IA illisible → gardé",
      titre: "", priorite: "moyenne", phrase: "à examiner", sous_taches: [], brouillon: "" };
  }
  return {
    action: out.action,
    confiance: out.confiance ?? 0,
    raison: noDash((out.raison || "").trim()),
    categorie: out.categorie || "autre",
    titre: noDash((out.titre || "").trim()),
    priorite: out.priorite || "moyenne",
    phrase: noDash((out.phrase || "à examiner").trim()),
    sous_taches: Array.isArray(out.sous_taches) ? out.sous_taches.map(noDash) : [],
    brouillon: noDash((out.brouillon || "").trim()),
  };
}

// ==========================================================================
//  DIGEST fusionné (ex digest.js) : priorisation, tâches, brouillons
// ==========================================================================
const missiveLink = (teamId, id) =>
  `https://mail.missiveapp.com/#team_unassigned/${teamId}_team_unassigned/conversations/${id}`;

// Construit le digest markdown priorisé pour une équipe (items = fils "keep").
// fermes/spams/avoirs = ce que le script a écarté ce run, listé pour que Gabriel
// puisse RATTRAPER une erreur (rouvrir un fil fermé/spammé à tort).
function buildDigest(teamName, teamId, items, fermes = [], spams = [], avoirs = []) {
  const today = new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
  const rouge = [], opp = [], vert = [];
  for (const it of items) {
    if (it.priorite === "haute") rouge.push(it);
    else if (it.categorie === "opportunite" || it.categorie === "developpement") opp.push(it);
    else vert.push(it);
  }
  const byAge = (a, b) => b.jours - a.jours;
  rouge.sort(byAge); opp.sort(byAge); vert.sort(byAge);
  const draftIcon = (it) => (it.brouillon ? " ✍️" : "");
  const line = (it) =>
    `- **${it.sender}** · ${(it.sujet || "").slice(0, 50)} · ${it.jours}j · [ouvrir](${missiveLink(teamId, it.conv.id)}) — ${it.phrase}${draftIcon(it)}`;

  let md = `**📋 Résumé ${teamName} — ${today}**\n*${items.length} fils en attente de toi*\n`;
  if (rouge.length) md += `\n🔴 **À traiter**\n` + rouge.map(line).join("\n") + "\n";
  if (opp.length) md += `\n💰 **Opportunités**\n` + opp.map(line).join("\n") + "\n";
  if (vert.length) {
    md += `\n🟢 **Vite fait**\n`;
    md += vert.slice(0, 8).map((it) =>
      `- **${it.sender}** · ${(it.sujet || "").slice(0, 50)} · ${it.jours}j · [ouvrir](${missiveLink(teamId, it.conv.id)})`).join("\n") + "\n";
    if (vert.length > 8) md += `- _+ ${vert.length - 8} autres fils mineurs_\n`;
  }
  const taches = rouge.filter((it) => it.sous_taches.length);
  if (taches.length) {
    md += `\n---\n**Sous-tâches**\n`;
    for (const it of taches.slice(0, 4)) {
      md += `\n_${it.sender} — ${(it.sujet || "").slice(0, 50)}_\n` + it.sous_taches.map((t) => `  - [ ] ${t}`).join("\n") + "\n";
    }
  }
  const drafts = [...rouge, ...opp, ...vert].filter((it) => it.brouillon).slice(0, 5);
  if (drafts.length) {
    md += `\n---\n**Brouillons prêts** _(à relire avant d'envoyer)_\n`;
    for (const it of drafts) md += `\n**✍️ ${it.sender} — ${(it.sujet || "").slice(0, 50)}**\n> ` + it.brouillon.replace(/\n/g, "\n> ") + "\n";
  }

  // --- FILET DE SÉCURITÉ : ce que le script a écarté, pour attraper ses erreurs ---
  const titreDe = (p) => (p.conv.subject || p.conv.latest_message_subject || "(sans sujet)").slice(0, 55);
  const raisonCourte = (r) => (r || "").replace(/\s*\(conf\.[^)]*\)/, "").replace(/^IA[^:]*:\s*/, "").slice(0, 90);
  const auditLine = (p) => `- ${titreDe(p)} · [ouvrir](${missiveLink(teamId, p.conv.id)}) — ${raisonCourte(p.raison)}`;
  if (fermes.length || spams.length || avoirs.length) {
    md += `\n---\n**🔎 Écarté ce run** _(vérifie qu'il n'y a pas d'erreur; tout se rouvre si tu réponds)_\n`;
    if (spams.length) md += `\n⊘ **Spam / démarchage (${spams.length})** _(un vrai contact ici = erreur)_\n` + spams.map(auditLine).join("\n") + "\n";
    if (fermes.length) md += `\n🗑️ **Fermé, sans action (${fermes.length})** _(un fil qui attendait une réponse ici = erreur)_\n` + fermes.map(auditLine).join("\n") + "\n";
    if (avoirs.length) md += `\n⧗ **À voir, gardé ouvert (${avoirs.length})**\n` + avoirs.map(auditLine).join("\n") + "\n";
  }
  return md;
}

async function postDigest(conversationId, markdown) {
  const r = await apiPost("/posts", {
    posts: { conversation: conversationId, organization: ORG,
      notification: { title: "Digest matinal", body: "Ton résumé priorisé est prêt." }, markdown },
  });
  let id = null;
  try { const j = JSON.parse(r.text || "{}"); id = j.posts?.id || j.post?.id || j.id || null; } catch (_) {}
  return { ok: r.ok, id };
}

// Ne garder que le digest le PLUS RÉCENT : supprime nos anciens digests de la conversation.
// Best-effort : dépend de la liste des commentaires (endpoint à confirmer). Si indisponible,
// on ne touche à rien (les vieux digests restent, aucun dégât).
const DIGEST_MARKER = "📋 Résumé";
async function listComments(convId) {
  // On tente l'endpoint dédié; s'il n'existe pas, on renvoie null (purge sautée).
  try {
    const r = await api(`/conversations/${convId}/comments?limit=50`);
    const arr = r.comments || r.posts || [];
    return Array.isArray(arr) ? arr : null;
  } catch (_) { return null; }
}
async function purgeVieuxDigests(convId, keepId) {
  const comments = await listComments(convId);
  if (!comments) return { supported: false, deleted: 0 };
  let deleted = 0;
  for (const c of comments) {
    const body = c.body || c.markdown || c.text || "";
    const estDigest = body.includes(DIGEST_MARKER);
    if (estDigest && c.id && c.id !== keepId) {
      const r = await apiDelete(`/posts/${c.id}`);
      if (r.ok) deleted++;
    }
  }
  return { supported: true, deleted };
}

// Ensemble des conversations portant déjà un label (anti-doublon tâches / brouillons).
async function conversationsWithLabel(labelId) {
  if (!labelId) return new Set();
  const ids = new Set();
  for (const c of await listByFilter(`shared_label=${labelId}`)) ids.add(c.id);
  return ids;
}

async function createTask(conversationId, title) {
  const r = await apiPost("/posts", {
    posts: { conversation: conversationId, organization: ORG,
      add_shared_labels: [TASK_LABEL],
      notification: { title: "Tâche créée", body: title.slice(0, 120) },
      task: { title: title.slice(0, 1000), state: "todo" } },
  });
  return r.ok;
}

async function createDraft(it) {
  const toFields = (it.toAddrs && it.toAddrs.length ? it.toAddrs : [it.senderAddress]).filter(Boolean).map((a) => ({ address: a }));
  const draft = {
    conversation: it.conv.id, organization: ORG,
    from_field: { address: it.fromAddress },
    to_fields: toFields,
    subject: it.sujet ? `Re: ${it.sujet}` : undefined,
    body: it.brouillon.replace(/\n/g, "<br>"),
    add_shared_labels: [DRAFT_LABEL],
  };
  if (it.ccAddrs && it.ccAddrs.length) draft.cc_fields = it.ccAddrs.map((a) => ({ address: a }));
  const r = await apiPost("/drafts", { drafts: draft });
  return r.ok;
}

// Adresses de réponse depuis le dernier message externe (hors nos propres adresses).
function replyAddresses(last) {
  const collect = (arr) => (Array.isArray(arr) ? arr.map((f) => f.address).filter(Boolean) : []);
  const isSelfAddr = (a) => SELF.includes((a || "").toLowerCase());
  const senderAddress = last.from_field?.address || "";
  const toAddrs = [...new Set([senderAddress, ...collect(last.to_fields)].filter((a) => a && !isSelfAddr(a)))];
  const ccAddrs = [...new Set(collect(last.cc_fields).filter((a) => a && !isSelfAddr(a) && !toAddrs.includes(a)))];
  return { senderAddress, toAddrs, ccAddrs };
}

function joursAttente(last) {
  let ts = last.delivered_at || last.created_at || 0;
  if (ts && ts < 1e12) ts *= 1000;
  return ts ? Math.floor((Date.now() - ts) / 86400000) : 0;
}

// ==========================================================================
//  Run principal
// ==========================================================================
async function main() {
  if (LIST_TEAMS) {
    const { teams = [] } = await api("/teams?limit=50");
    console.log("Équipes de l'organisation :");
    for (const t of teams) console.log(`  ${t.id}  ${t.name}`);
    return;
  }

  console.log(`=== Lasclay admin_ops.js ${VERSION} ===`);
  console.log(DRY_RUN ? "MODE SIMULATION (rien fermé)" : "MODE RÉEL");
  console.log(`Boîtes : ${TEAMS.map((t) => t.name).join(", ")}`);
  console.log(`Juge IA : ${AI_ON ? `OUI (${MODEL}, seuil ${AI_SEUIL})` : (USE_AI ? "demandé mais SANS clé → déterministe seul" : "non (déterministe seul)")}` +
    ` | Fils assignés : ${SKIP_ASSIGNED ? "sautés" : "traités"}`);
  console.log(`Spam/démarchage : action = ${SPAM_ACTION}${SPAM_ACTION === "label" && !SPAM_LABEL_ID ? " (SPAM_LABEL_ID absent → ferme seulement)" : ""}`);
  console.log(`Digest : ${POST_DIGEST ? "OUI" : "non"}${TASK_LABEL ? " + tâches" : ""}${CREATE_DRAFTS ? " + brouillons" : ""}` +
    ` | CLOSE_LIMIT ${CLOSE_LIMIT || "∞"} | MAX_FILS ${MAX_FILS || "∞"} | MAX_IA ${MAX_IA || "∞"}\n`);

  // Anti-doublon (une seule lecture) pour tâches et brouillons.
  const tasked = await conversationsWithLabel(TASK_LABEL);
  const drafted = await conversationsWithLabel(CREATE_DRAFTS ? DRAFT_LABEL : "");

  // 1. Collecte des fils ouverts (dédoublonnés entre les deux boîtes)
  const byId = new Map();
  const teamOf = new Map(); // convId → objet équipe (nom, digestConversation, fromAddress)
  for (const t of TEAMS) {
    const convs0 = await listTeamInbox(t.id);
    console.log(`  ${convs0.length} fil(s) ouvert(s) dans « ${t.name} »`);
    for (const c of convs0) { if (!byId.has(c.id)) { byId.set(c.id, c); teamOf.set(c.id, t); } }
  }
  let convs = [...byId.values()].sort((a, b) => (b.last_activity_at || 0) - (a.last_activity_at || 0));
  if (MAX_FILS && convs.length > MAX_FILS) convs = convs.slice(0, MAX_FILS);
  console.log(`\n${convs.length} fil(s) ouvert(s) unique(s) à examiner.\n`);

  const dateStr = new Date().toISOString().slice(0, 10);
  const aFermer = []; // { conv, boite, categorie, raison }
  const aVoir = [];   // { conv, boite, categorie, raison } — gardés ouverts + label de revue
  const aSpam = [];   // { conv, boite, categorie, raison } — démarchage → SPAM_ACTION
  const gardes = [];  // { conv, boite, raison }
  const keepByTeam = new Map(); // teamId → [items actionnables pour le digest]
  let analyses = 0, appelsIA = 0;

  // Enregistre un fil actionnable ("keep") pour le digest de son équipe.
  const pushKeep = (conv, team, last, sujet, v) => {
    const { senderAddress, toAddrs, ccAddrs } = replyAddresses(last);
    const item = {
      conv, boite: team.name, fromAddress: team.fromAddress,
      sender: last.from_field?.name || last.from_field?.address || "?",
      senderAddress, toAddrs, ccAddrs,
      sujet: sujet && sujet !== "(sans sujet)" ? sujet : (v.titre || "(sans sujet)"),
      jours: joursAttente(last),
      categorie: v.categorie || "autre", priorite: v.priorite || "moyenne",
      phrase: v.phrase || "à examiner", sous_taches: v.sous_taches || [], brouillon: v.brouillon || "",
    };
    if (!keepByTeam.has(team.id)) keepByTeam.set(team.id, []);
    keepByTeam.get(team.id).push(item);
  };

  for (const conv of convs) {
    analyses++;
    const team = teamOf.get(conv.id) || { id: "?", name: "?" };
    const boite = team.name;
    // v2 — Missive met souvent le sujet dans latest_message_subject, pas conv.subject.
    const sujet = conv.subject || conv.latest_message_subject || "(sans sujet)";

    // 0. Fil assigné → un humain s'en occupe.
    if (SKIP_ASSIGNED && Array.isArray(conv.assignees) && conv.assignees.length > 0) {
      gardes.push({ conv, boite, raison: "assigné à un humain" });
      continue;
    }

    let msgs;
    try { msgs = await threadMessages(conv.id); }
    catch (e) { gardes.push({ conv, boite, raison: `messages illisibles (${e.message})` }); continue; }
    // Fil sans message courriel (note/commentaire interne, ex. digests) → on garde.
    if (msgs.length === 0) { gardes.push({ conv, boite, raison: "aucun message courriel (interne)" }); continue; }

    const last = msgs[msgs.length - 1];

    // 1. Dernier message = nous → balle dans leur camp, pas dans le digest.
    if (isUs(last)) { gardes.push({ conv, boite, raison: "dernier message = nous" }); continue; }

    const expediteur = last.from_field?.address || last.from_field?.name || "?";
    const auto = isAutomatedSender(last.from_field?.address);

    // v2 — on charge les VRAIS corps en lot (le listage ne renvoie pas le body).
    const bodies = await fetchBodies(msgs.map((m) => m.id));
    const corps = stripHtml(bodies.get(last.id) || last.body || last.preview || "");
    const texte = `${sujet}\n${corps}`;              // déterministe : dernier message seulement
    const broadcast = isBroadcast(texte);
    const actionSig = hasActionSignal(texte);

    // 2. Fast-path déterministe GRATUIT : reçu automatique sans action → FERMÉ (pas d'IA).
    const autoOk = auto || !AUTO_REQUIRED;
    if (autoOk && !broadcast && !actionSig && hasNoActionSignal(texte)) {
      aFermer.push({ conv, boite, categorie: "recu/sans action", source: "det", raison: `expéditeur ${auto ? "auto" : "?"}, phrase sans action` });
      continue;
    }

    // 3. Juge IA (Opus) : tri + priorisation + brouillon en UN appel.
    if (AI_ON && (!MAX_IA || appelsIA < MAX_IA)) {
      appelsIA++;
      const fil = construireFil(msgs, bodies);
      let v;
      try { v = await jugerIA(sujet, fil, expediteur, boite, broadcast, joursAttente(last), dateStr); }
      catch (e) { gardes.push({ conv, boite, raison: `IA en erreur (${e.message}) → gardé` }); continue; }
      const conf = v.confiance ?? 0;
      // GARDE-FOU : un signal d'action clair interdit close/spam (l'exclusion prime).
      if (actionSig && (v.action === "close" || v.action === "spam")) {
        pushKeep(conv, team, last, sujet, { ...v, raison: `signal d'action (IA voulait ${v.action})` });
      } else if (v.action === "close" && conf >= AI_SEUIL) {
        aFermer.push({ conv, boite, categorie: v.categorie, source: "ia", raison: `IA: ${v.raison} (conf. ${conf})` });
      } else if (v.action === "spam" && conf >= SPAM_SEUIL) {
        aSpam.push({ conv, boite, categorie: v.categorie || "démarchage", raison: `IA spam: ${v.raison} (conf. ${conf})` });
      } else if (v.action === "a_voir") {
        aVoir.push({ conv, boite, categorie: v.categorie || "à voir", raison: `IA à voir: ${v.raison} (conf. ${conf})` });
      } else {
        // keep (ou close/spam sous le seuil) → fil actionnable, entre au digest.
        pushKeep(conv, team, last, sujet, v);
      }
      continue;
    }

    // 4. Sans IA (ou plafond MAX_IA atteint) : on garde.
    gardes.push({ conv, boite, raison: !AI_ON ? "IA off → gardé" : "plafond MAX_IA atteint → gardé" });
  }

  // --- Aperçu ---
  // Les GARDÉS d'abord (souvent nombreux) : détail seulement si SHOW_KEPT, sinon un
  // décompte par raison. Ainsi les buckets ACTIONNABLES (fermer/spam/à voir) restent
  // en bas du log, visibles sans dérouler des dizaines de lignes.
  const titre = (c) => (c.subject || c.latest_message_subject || "(sans sujet)").slice(0, 60);
  const clefRaison = (r) =>
    r.startsWith("keep → digest") ? "en attente de toi → digest" :
    r.startsWith("IA garde") ? "IA a jugé → gardé" :
    r.startsWith("signal d'action") ? "signal d'action" :
    r.startsWith("dernier message = nous") ? "dernier message = nous" :
    r.startsWith("assigné") ? "assigné à un humain" :
    r.startsWith("aucun message") ? "interne / sans courriel" :
    r.startsWith("IA en erreur") ? "IA en erreur → gardé" : "autre";
  const totalKeep = [...keepByTeam.values()].reduce((n, a) => n + a.length, 0);
  console.log(`GARDÉS (${gardes.length}) :`);
  if (SHOW_KEPT) {
    for (const g of gardes) console.log(`  · [${g.boite}] ${titre(g.conv)}  — ${g.raison}`);
  } else {
    const tally = {};
    for (const g of gardes) { const k = clefRaison(g.raison); tally[k] = (tally[k] || 0) + 1; }
    for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  · ${n.toString().padStart(3)} — ${k}`);
    console.log(`  (SHOW_KEPT=true pour le détail ligne par ligne)`);
  }
  console.log(`\nÀ VOIR — gardés ouverts${REVIEW_LABEL_ID ? " + label de revue" : ""} (${aVoir.length}) :`);
  for (const p of aVoir) console.log(`  ⧗ [${p.boite}] ${titre(p.conv)}  — ${p.raison}`);
  console.log(`\nSPAM / DÉMARCHAGE → ${SPAM_ACTION} (${aSpam.length}) :`);
  for (const p of aSpam) console.log(`  ⊘ [${p.boite}] ${titre(p.conv)}  — ${p.raison}`);
  console.log(`\nÀ FERMER (${aFermer.length}) :`);
  for (const p of aFermer) console.log(`  ✔ [${p.boite}] ${titre(p.conv)}  — ${p.raison}`);
  console.log(`\nDIGEST — en attente de toi (${totalKeep}) :`);
  for (const [tid, items] of keepByTeam) {
    const tname = (TEAMS.find((t) => t.id === tid) || {}).name || tid;
    for (const it of items.slice().sort((a, b) => b.jours - a.jours)) {
      const pr = it.priorite === "haute" ? "🔴" : (it.categorie === "opportunite" || it.categorie === "developpement") ? "💰" : "🟢";
      console.log(`  ${pr} [${tname}] ${(it.sujet || "").slice(0, 50)} · ${it.jours}j — ${it.phrase}${it.brouillon ? " ✍️" : ""}`);
    }
  }

  // --- Exécution ---
  console.log(`\n${aFermer.length} à fermer, ${aSpam.length} spam(${SPAM_ACTION}), ${aVoir.length} à voir, ${totalKeep} au digest, ${gardes.length} gardé(s). (${analyses} analysé(s), ${appelsIA} appel(s) IA)`);
  let fermes = 0;
  for (const p of aFermer) {
    if (CLOSE_LIMIT && fermes >= CLOSE_LIMIT) { console.log(`Plafond CLOSE_LIMIT=${CLOSE_LIMIT} atteint, arrêt.`); break; }
    if (DRY_RUN) { fermes++; continue; }
    const r = await fermerSansAction(p.conv.id, p.categorie);
    if (r.ok) fermes++;
    else console.error(`  échec fermeture ${p.conv.id}`);
  }
  console.log(`${fermes} fil(s) ${DRY_RUN ? "à fermer (simulation)" : "fermé(s)"}.`);

  // Spam / démarchage : SPAM_ACTION (close/trash/label). Même plafond que les fermetures.
  let spammes = 0;
  for (const p of aSpam) {
    if (CLOSE_LIMIT && (fermes + spammes) >= CLOSE_LIMIT) { console.log(`Plafond CLOSE_LIMIT atteint (spam), arrêt.`); break; }
    if (DRY_RUN) { spammes++; continue; }
    const r = await traiterSpam(p.conv.id, p.categorie);
    if (r.ok) spammes++;
    else console.error(`  échec spam ${p.conv.id}`);
  }
  console.log(`${spammes} fil(s) spam ${DRY_RUN ? `(simulation, action ${SPAM_ACTION})` : `→ ${SPAM_ACTION}`}.`);

  // Fils « à voir » : posent le label de revue (s'il est configuré), restent OUVERTS.
  let marques = 0;
  if (REVIEW_LABEL_ID) {
    for (const p of aVoir) {
      if (DRY_RUN) { marques++; continue; }
      const r = await marquerAVoir(p.conv.id);
      if (r.ok) marques++;
    }
    console.log(`${marques} fil(s) « à voir » ${DRY_RUN ? "à étiqueter (simulation)" : "étiqueté(s)"} (restent ouverts).`);
  } else if (aVoir.length) {
    console.log(`${aVoir.length} fil(s) « à voir » gardés ouverts (définis REVIEW_LABEL_ID pour les étiqueter).`);
  }

  // --- DIGEST : résumé priorisé + tâches + brouillons (ex digest.js) ---
  // Garde-fou fin de semaine (heure du Québec) : on ne poste pas le digest sam/dim.
  const jourQc = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Toronto" })).getDay();
  const weekend = jourQc === 0 || jourQc === 6;
  // Garde-fou horaire : ne poster qu'au run de DIGEST_HOUR (UTC), -1 = à chaque run.
  const heureUTC = new Date().getUTCHours();
  const bonneHeure = DIGEST_HOUR < 0 || heureUTC === DIGEST_HOUR;
  const postReel = bonneHeure && !(DIGEST_SKIP_WEEKEND && weekend); // conditions du VRAI post
  if (!POST_DIGEST) {
    console.log("Digest désactivé (POST_DIGEST=false).");
  } else {
    for (const t of TEAMS) {
      const items = keepByTeam.get(t.id) || [];
      const tFermes = aFermer.filter((p) => p.boite === t.name);
      const tSpams = aSpam.filter((p) => p.boite === t.name);
      const tVoirs = aVoir.filter((p) => p.boite === t.name);
      const md = buildDigest(t.name, t.id, items, tFermes, tSpams, tVoirs);
      // FILET DE SÉCURITÉ : si le script a fermé ou spammé quelque chose, on poste le
      // digest MÊME hors fenêtre (week-end/heure), pour que Gabriel puisse attraper une
      // erreur au prochain coup d'œil plutôt que dans 3 jours.
      const aRapporter = tFermes.length > 0 || tSpams.length > 0;
      if (DRY_RUN) {
        console.log(`\n--- DIGEST ${t.name} (simulation) ---\n${md}`);
      } else if ((postReel || aRapporter) && t.digestConversation) {
        const r = await postDigest(t.digestConversation, md);
        if (r.ok) {
          // Ne garder que ce digest-ci : supprimer les précédents. On NE purge que si on
          // connaît l'id du nouveau post (sinon on risquerait de supprimer le digest frais).
          let suffixe = "";
          if (r.id) {
            const purge = await purgeVieuxDigests(t.digestConversation, r.id);
            suffixe = purge.supported ? `, ${purge.deleted} ancien(s) supprimé(s)` : `, purge non supportée (vieux conservés)`;
          } else {
            suffixe = ", id du post inconnu → purge sautée";
          }
          console.log(`Digest ${t.name} posté (${items.length} en attente, ${tFermes.length} fermé(s), ${tSpams.length} spam${suffixe}).`);
        } else {
          console.log(`Digest ${t.name} NON posté.`);
        }
      } else {
        console.log(`Digest ${t.name} non posté (${weekend && DIGEST_SKIP_WEEKEND ? "week-end" : `heure ${heureUTC}h ≠ ${DIGEST_HOUR}h`}, rien d'écarté).`);
      }
    }
  }

  // Tâches Missive pour les fils 🔴 (priorité haute), jamais deux fois (label-marqueur).
  if (TASK_LABEL) {
    const aTacher = [...keepByTeam.values()].flat().filter((it) => it.priorite === "haute" && !tasked.has(it.conv.id));
    let nt = 0;
    for (const it of aTacher) {
      if (DRY_RUN) { nt++; continue; }
      if (await createTask(it.conv.id, `${it.sender} — ${it.phrase}`)) { nt++; tasked.add(it.conv.id); }
    }
    console.log(`${nt} tâche(s) ${DRY_RUN ? "à créer (simulation)" : "créée(s)"}.`);
  }

  // Brouillons pour les fils qui en ont un, jamais deux fois (label-marqueur), plafond DRAFT_LIMIT.
  if (CREATE_DRAFTS) {
    let aDrafter = [...keepByTeam.values()].flat().filter((it) => it.brouillon && it.senderAddress && !drafted.has(it.conv.id));
    if (DRAFT_LIMIT > 0) aDrafter = aDrafter.slice(0, DRAFT_LIMIT);
    let nd = 0;
    for (const it of aDrafter) {
      if (DRY_RUN) { nd++; continue; }
      if (await createDraft(it)) { nd++; drafted.add(it.conv.id); }
    }
    console.log(`${nd} brouillon(s) ${DRY_RUN ? "à créer (simulation)" : "créé(s)"}.`);
  }

  console.log("Run terminé.");
}

if (require.main === module) {
  main().catch((e) => {
    console.error("Erreur :", e.message);
    process.exit(1);
  });
}

module.exports = { hasNoActionSignal, hasActionSignal, isAutomatedSender, isBroadcast };
