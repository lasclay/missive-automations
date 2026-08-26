/**
 * Lasclay — filtrage.js (v2.1)
 * --------------------------------------------------------------------------
 * v2.1 — le juge IA reçoit désormais le FIL COMPLET (tous les messages, NOUS/EUX,
 * du plus ancien au plus récent), plus seulement le dernier message. Le dernier
 * message seul l'induisait en erreur sur les « Re: » (ex. faux « démarchage »
 * sur un fil PARI où le contexte était dans les messages précédents). Le
 * déterministe, lui, continue de ne regarder que le dernier message (prudence).
 *
 * Trie les boîtes ADMIN (admin@lasclay.com) et OPERATIONS (operations@lasclay.com)
 * et désencombre l'inbox sans jamais escamoter un courriel qui demande un geste.
 * Ces boîtes ne sont PAS du service client.
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
 *   1. Dernier message = NOUS ................................... GARDÉ (en attente d'une réponse)
 *   2. Un SIGNAL D'ACTION est présent (exclusion) .............. GARDÉ, toujours (prime sur tout)
 *   3. Fast-path gratuit : expéditeur AUTOMATIQUE + phrase « sans
 *      action » et PAS une diffusion ........................... FERMÉ (sans appel IA)
 *   4. IA (Opus) sur le vrai sujet+corps ...................... close / spam / a_voir / keep
 *      (close & spam seulement si confiance ≥ AI_SEUIL)
 *   5. Sans IA (pas de clé) ................................... GARDÉ (prudence)
 *
 * ACTIONS API : fermeture = POST /posts close:true + note interne, sans push.
 * Spam : SPAM_ACTION = "close" (défaut) | "trash" (corbeille, close+trash:true) |
 * "label" (SPAM_LABEL_ID + close). « À voir » = PATCH silencieux add_shared_labels.
 * Tout fil se rouvre s'il reçoit une réponse. (L'API Missive n'expose ni archive
 * ni « mark as spam » : trash est le geste le plus proche.)
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
 *   RESUME_CONV       conversation où poster un bref récapitulatif du run.
 *   MISSIVE_SELF_ADDRESSES  nos adresses (défaut hey@, admin@, operations@).
 */

const VERSION = "v2.3";

const { noter, avecTtl } = require("./tokens");

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
const RESUME_CONV = process.env.RESUME_CONV || "";

// --- Équipes ciblées (ids confirmés par repartition_merge.js / logs prod) ---
const DEFAULT_TEAMS = [
  { id: "a6c74be0-2a27-4c79-9294-a74b447e6dc0", name: "Lasclay Admin" },
  { id: "7c925f0d-3eca-4535-be20-424078619cef", name: "LAS Operations" },
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
    noter("filtrage", MODEL, data.usage);
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
async function listTeamInbox(teamId) {
  const byId = new Map();
  let until = null;
  while (true) {
    let path = `/conversations?team_inbox=${teamId}&limit=50`;
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
    markdown: `_Fermé automatiquement par filtrage.js : notification sans action requise (${categorie})._\n_Se rouvrira si quelqu'un y répond._`,
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
    markdown: `_Filtrage.js : démarchage/sollicitation non désiré (${categorie}). Action : ${SPAM_ACTION}._`,
  };
  if (SPAM_ACTION === "trash") { post.close = true; post.trash = true; }
  else if (SPAM_ACTION === "label") { post.close = true; if (SPAM_LABEL_ID) post.add_shared_labels = [SPAM_LABEL_ID]; }
  else { post.close = true; } // "close" (défaut)
  return apiPost("/posts", { posts: post });
}

// ==========================================================================
//  Juge IA (Opus par défaut) — appoint conservateur, seulement si USE_AI
// ==========================================================================
const AI_SYSTEM = avecTtl([
  {
    type: "text",
    cache_control: { type: "ephemeral" },
    text:
`Tu tries les boîtes ADMIN et OPERATIONS de l'entreprise Lasclay (asclépiade / papillons monarques).
Ces boîtes reçoivent des courriels administratifs et opérationnels : reçus, factures, confirmations de paiement,
avis de fournisseurs, notifications et mises à jour de plateformes (Shopify, Stripe, Google, outils SaaS...),
infolettres de service. Ce N'EST PAS du service client. Tu ne rédiges rien, tu ne réponds à personne.

Classe le courriel dans UNE de quatre cases :

1. action="close" — À FERMER. Purs courriels informatifs, définitivement réglés, sans AUCUN geste ni maintenant
   ni plus tard, et sans rien d'important à retenir :
     - reçus et confirmations de paiement (« paiement reçu », « your receipt », rechargement automatique, solde à 0)
     - accusés de réception, « pour vos dossiers », « aucune action requise »
     - notifications automatiques jetables (statut « livré » sans problème, etc.).
   Ferme seulement si, une fois lu, il n'y a STRICTEMENT plus rien à en faire.

2. action="a_voir" — À GARDER OUVERT MAIS SIGNALÉ. Aucune urgence, mais une action douce/éventuelle ou une
   info qu'il faut vraiment connaître.
     - mise à jour / nouvelle fonctionnalité d'un outil qu'on utilise déjà
       (EXEMPLE TYPE : « The new HelpCenter is live now » — à explorer et à savoir)
     - changement de conditions/prix/politique d'un fournisseur, à prendre en note
     - ARGENT QUI SORT du compte (prélèvement, versement NÉGATIF, ex. « Payout -343$ » dû à des
       remboursements) : "a_voir", jamais "close" — il faut pouvoir le remarquer. Un versement POSITIF
       purement informatif (argent qui entre, rien à faire), lui, peut être "close".
     - rappel léger / migration à planifier.
   En cas d'hésitation entre "close" et "a_voir" : choisis "a_voir".

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

Réponds STRICTEMENT en JSON, sans texte autour :
{"action":"close"|"a_voir"|"spam"|"keep","categorie":"recu|confirmation_paiement|avis_informatif|maj_outil|info_a_retenir|demarchage|pourriel|facture_a_payer|action_requise|humain|autre","confiance":0.0-1.0,"raison":"courte phrase"}`,
  },
]);

async function jugerIA(sujet, fil, expediteur, boite, diffusion, dateStr) {
  const user =
`AUJOURD'HUI : ${dateStr}
BOÎTE : ${boite}
DERNIER EXPÉDITEUR EXTERNE : ${expediteur}
DIFFUSION (infolettre / envoi de masse) : ${diffusion ? "oui" : "non"}
SUJET : ${sujet}

FIL COMPLET (du plus ancien au plus récent; NOUS = Lasclay, EUX = l'externe).
Lis TOUT le fil avant de juger : le dernier message seul peut induire en erreur.
------
${fil || "(aucun contenu)"}
------`;
  const raw = await claude(AI_SYSTEM, user, 400);
  const out = parseJsonLoose(raw);
  const valides = new Set(["close", "a_voir", "spam", "keep"]);
  if (!out || !valides.has(out.action)) {
    return { action: "keep", categorie: "autre", confiance: 0, raison: "réponse IA illisible → gardé" };
  }
  return out;
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

  console.log(`=== Lasclay filtrage.js ${VERSION} ===`);
  console.log(DRY_RUN ? "MODE SIMULATION (rien fermé)" : "MODE RÉEL");
  console.log(`Boîtes : ${TEAMS.map((t) => t.name).join(", ")}`);
  console.log(`Juge IA : ${AI_ON ? `OUI (${MODEL}, seuil ${AI_SEUIL})` : (USE_AI ? "demandé mais SANS clé → déterministe seul" : "non (déterministe seul)")}` +
    ` | Fils assignés : ${SKIP_ASSIGNED ? "sautés" : "traités"}`);
  console.log(`Spam/démarchage : action = ${SPAM_ACTION}${SPAM_ACTION === "label" && !SPAM_LABEL_ID ? " (SPAM_LABEL_ID absent → ferme seulement)" : ""}`);
  console.log(`CLOSE_LIMIT : ${CLOSE_LIMIT || "illimité"} | MAX_FILS : ${MAX_FILS || "illimité"}\n`);

  // 1. Collecte des fils ouverts (dédoublonnés entre les deux boîtes)
  const byId = new Map();
  const boiteDe = new Map(); // convId → nom de boîte (la 1re rencontrée)
  for (const t of TEAMS) {
    const convs = await listTeamInbox(t.id);
    console.log(`  ${convs.length} fil(s) ouvert(s) dans « ${t.name} »`);
    for (const c of convs) {
      if (!byId.has(c.id)) { byId.set(c.id, c); boiteDe.set(c.id, t.name); }
    }
  }
  let convs = [...byId.values()].sort((a, b) => (b.last_activity_at || 0) - (a.last_activity_at || 0));
  if (MAX_FILS && convs.length > MAX_FILS) convs = convs.slice(0, MAX_FILS);
  console.log(`\n${convs.length} fil(s) ouvert(s) unique(s) à examiner.\n`);

  const dateStr = new Date().toISOString().slice(0, 10);
  const aFermer = []; // { conv, categorie, source, raison }
  const aVoir = [];   // { conv, boite, categorie, raison } — gardés ouverts + label de revue
  const aSpam = [];   // { conv, boite, categorie, raison } — démarchage → SPAM_ACTION
  const gardes = [];  // { conv, raison }
  let analyses = 0;

  for (const conv of convs) {
    analyses++;
    const boite = boiteDe.get(conv.id) || "?";
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

    // 1. Dernier message = nous → en attente d'une réponse, on garde.
    if (isUs(last)) { gardes.push({ conv, boite, raison: "dernier message = nous" }); continue; }

    const expediteur = last.from_field?.address || last.from_field?.name || "?";
    const auto = isAutomatedSender(last.from_field?.address);

    // v2 — CORRECTIF CLÉ : on charge les VRAIS corps (le listage des messages ne renvoie
    // pas le body). En lot pour tout le fil : sert au déterministe (dernier message) ET
    // au juge IA (fil complet).
    const bodies = await fetchBodies(msgs.map((m) => m.id));
    const corps = stripHtml(bodies.get(last.id) || last.body || last.preview || "");
    // Déterministe : on ne regarde QUE le dernier message (éviter le bruit des vieux
    // messages / citations, cf. faux positifs de support.js).
    const texte = `${sujet}\n${corps}`;
    const broadcast = isBroadcast(texte);

    // 2. Signal d'action présent → GARDE, toujours (l'exclusion prime).
    if (hasActionSignal(texte)) {
      gardes.push({ conv, boite, raison: "signal d'action détecté" });
      continue;
    }

    // 3. Fast-path déterministe GRATUIT : expéditeur automatique + phrase « sans action »,
    //    et PAS une diffusion (une infolettre peut cacher un « à voir »). Économise un appel IA.
    const autoOk = auto || !AUTO_REQUIRED;
    if (autoOk && !broadcast && hasNoActionSignal(texte)) {
      aFermer.push({ conv, boite, categorie: "recu/sans action", source: "det", raison: `expéditeur ${auto ? "auto" : "?"}, phrase sans action` });
      continue;
    }

    // 4. Juge IA (Opus) : le MOTEUR. Il reçoit le FIL COMPLET (v2.1) et tranche TOUT
    //    courriel entrant non réglé ci-dessus (close / spam / a_voir / keep).
    if (AI_ON) {
      const fil = construireFil(msgs, bodies);
      let verdict;
      try { verdict = await jugerIA(sujet, fil, expediteur, boite, broadcast, dateStr); }
      catch (e) { gardes.push({ conv, boite, raison: `IA en erreur (${e.message}) → gardé` }); continue; }
      const conf = verdict.confiance ?? 0;
      if (verdict.action === "close" && conf >= AI_SEUIL) {
        aFermer.push({ conv, boite, categorie: verdict.categorie || "sans action (IA)", source: "ia", raison: `IA: ${verdict.raison || ""} (conf. ${conf})` });
      } else if (verdict.action === "spam" && conf >= SPAM_SEUIL) {
        aSpam.push({ conv, boite, categorie: verdict.categorie || "démarchage", raison: `IA spam: ${verdict.raison || ""} (conf. ${conf})` });
      } else if (verdict.action === "a_voir") {
        aVoir.push({ conv, boite, categorie: verdict.categorie || "à voir", raison: `IA à voir: ${verdict.raison || ""} (conf. ${conf})` });
      } else {
        // Verdict close/spam SOUS le seuil → gardé par prudence, mais on le DIT (audit).
        const sous = (verdict.action === "close" || verdict.action === "spam") ? `${verdict.action}<seuil ` : "";
        gardes.push({ conv, boite, raison: `IA garde: ${sous}${verdict.raison || verdict.action} (conf. ${conf})` });
      }
      continue;
    }

    // 5. Sans IA : on garde (le déterministe seul ne va pas plus loin, prudence).
    gardes.push({ conv, boite, raison: broadcast ? "diffusion (activer USE_AI pour classer)" : (auto ? "automatique, pas de phrase sans action" : "non automatique (activer USE_AI pour juger)") });
  }

  // --- Aperçu ---
  // Les GARDÉS d'abord (souvent nombreux) : détail seulement si SHOW_KEPT, sinon un
  // décompte par raison. Ainsi les buckets ACTIONNABLES (fermer/spam/à voir) restent
  // en bas du log, visibles sans dérouler des dizaines de lignes.
  const titre = (c) => (c.subject || c.latest_message_subject || "(sans sujet)").slice(0, 60);
  const clefRaison = (r) =>
    r.startsWith("IA garde") ? "IA a jugé → gardé" :
    r.startsWith("signal d'action") ? "signal d'action" :
    r.startsWith("dernier message = nous") ? "dernier message = nous" :
    r.startsWith("assigné") ? "assigné à un humain" :
    r.startsWith("aucun message") ? "interne / sans courriel" :
    r.startsWith("IA en erreur") ? "IA en erreur → gardé" : "autre";
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

  // --- Exécution ---
  console.log(`\n${aFermer.length} à fermer, ${aSpam.length} spam(${SPAM_ACTION}), ${aVoir.length} à voir, ${gardes.length} gardé(s). (${analyses} analysé(s))`);
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

  // --- Récapitulatif optionnel dans une conversation Missive ---
  if (RESUME_CONV && !DRY_RUN && (fermes > 0 || spammes > 0)) {
    const l1 = aFermer.slice(0, fermes).map((p) => `- ✔ [${p.boite}] ${titre(p.conv)}`).join("\n");
    const l2 = aSpam.slice(0, spammes).map((p) => `- ⊘ [${p.boite}] ${titre(p.conv)}`).join("\n");
    try {
      await apiPost("/posts", {
        posts: {
          conversation: RESUME_CONV, organization: ORG,
          notification: { title: "Filtrage Admin/Operations", body: `${fermes} fermé(s), ${spammes} spam(${SPAM_ACTION}).` },
          markdown: `**Filtrage Admin/Operations**\n${fermes} sans action fermé(s), ${spammes} démarchage → ${SPAM_ACTION}, ${aVoir.length} « à voir ».\n${l1}${l2 ? "\n" + l2 : ""}`,
        },
      });
    } catch (e) { console.warn(`Récapitulatif non posté (${e.message}).`); }
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
