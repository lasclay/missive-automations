/**
 * Lasclay — filtrage.js (v1)
 * --------------------------------------------------------------------------
 * Ferme, dans les boîtes ADMIN (admin@lasclay.com) et OPERATIONS
 * (operations@lasclay.com), les courriels qui NE NÉCESSITENT AUCUNE ACTION :
 * reçus de paiement, confirmations de paiement, avis automatiques informatifs.
 * Exemples typiques : « Your receipt from Anthropic, PBC », « Merci! Nous avons
 * reçu votre paiement » (Virgin Plus), rechargements automatiques, relevés à
 * solde nul, etc. Ces boîtes ne sont PAS du service client : le but est de
 * garder l'inbox propre sans jamais fermer un courriel qui demande un geste.
 *
 * PHILOSOPHIE (identique à support.js) : déterministe d'abord, garde-fous qui
 * priment toujours, IA (Sonnet) seulement en appoint et seulement pour trancher
 * les cas automatiques ambigus. En cas de doute : on GARDE le fil ouvert.
 *
 * CHAÎNE DE DÉCISION, pour chaque fil OUVERT d'Admin/Operations :
 *   0. Fil assigné à quelqu'un ................................. GARDÉ (humain dessus)
 *   1. Dernier message = NOUS ................................... GARDÉ (en attente d'une réponse)
 *   2. Un SIGNAL D'ACTION est présent (exclusion) .............. GARDÉ, toujours, même si un
 *      (action requise, échec/refus de paiement, à payer,          signal « sans action » coexiste.
 *       vérifiez/confirmez, suspension, urgent, expire,            L'exclusion l'emporte SYSTÉMATIQUEMENT.
 *       litige/rétrofacturation, remboursement demandé…)
 *   3. Déterministe : expéditeur AUTOMATIQUE + phrase « sans
 *      action » (reçu, paiement reçu, confirmation…) ........... FERMÉ
 *   4. USE_AI=true : Sonnet juge les candidats automatiques non
 *      tranchés (réponse close/keep + confiance) .............. FERMÉ si close & confiance ≥ SEUIL
 *   5. Sinon .................................................... GARDÉ
 *
 * FERMETURE : POST /posts avec close:true + une courte note interne (l'API exige
 * un markdown). Aucune notification poussée (on ne veut pas de bruit). Le fil se
 * rouvre tout seul si quelqu'un y répond. Option CLOSED_LABEL_ID pour étiqueter.
 *
 * GARDE-FOUS :
 *   DRY_RUN=true par défaut : liste ce qui SERAIT fermé/gardé, ne touche à RIEN.
 *   Premier vrai run conseillé : DRY_RUN=false + CLOSE_LIMIT=3, vérifier à l'œil
 *   dans Missive que les 3 fils fermés étaient bien sans action, avant tout lot.
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN     token API (missive_pat-...)                        [requis]
 *   MISSIVE_ORG       id d'organisation (défaut Lasclay)              [facultatif]
 *   TEAMS             override : ids d'équipes à filtrer, séparés par des virgules
 *                     (défaut : Admin + Operations).                  [facultatif]
 *   LIST_TEAMS        "true" = imprime les équipes de l'org et sort.  [facultatif]
 *   DRY_RUN           "false" pour agir. DÉFAUT "true" (simulation).
 *   CLOSE_LIMIT       plafond de fils fermés par run (0 = illimité). Défaut 0.
 *   MAX_FILS          plafond de fils analysés par run (0 = illimité). Défaut 0.
 *   SKIP_ASSIGNED     "false" pour traiter aussi les fils assignés. Défaut true
 *                     (un fil pris en charge par un humain est laissé tel quel).
 *   AUTO_REQUIRED     "false" pour ne pas exiger un expéditeur automatique au
 *                     déterministe. Défaut true (plus prudent).
 *   USE_AI            "true" = Sonnet tranche les candidats automatiques ambigus.
 *                     Défaut false (mode déterministe gratuit).
 *   ANTHROPIC_API_KEY clé Anthropic (requise seulement si USE_AI=true).
 *   MODEL             modèle du juge (défaut claude-sonnet-4-6).
 *   AI_SEUIL          confiance minimale pour fermer via l'IA (0-1). Défaut 0.85.
 *   NOTIF_DOMAINS     domaines d'expéditeurs à considérer comme automatiques, EN
 *                     PLUS des défauts, séparés par des virgules.     [facultatif]
 *   CLOSED_LABEL_ID   label posé sur les fils fermés (traçabilité).   [facultatif]
 *   RESUME_CONV       conversation où poster un bref récapitulatif du run.
 *   MISSIVE_SELF_ADDRESSES  nos adresses (défaut hey@, admin@, operations@).
 */

const VERSION = "v1";

const TOKEN = process.env.MISSIVE_TOKEN;
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36"; // Lasclay
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false"; // défaut: simulation
const CLOSE_LIMIT = parseInt(process.env.CLOSE_LIMIT || "0", 10) || 0;
const MAX_FILS = parseInt(process.env.MAX_FILS || "0", 10) || 0;
const SKIP_ASSIGNED = (process.env.SKIP_ASSIGNED || "true").toLowerCase() !== "false";
const AUTO_REQUIRED = (process.env.AUTO_REQUIRED || "true").toLowerCase() !== "false";
const USE_AI = (process.env.USE_AI || "").toLowerCase() === "true";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || "claude-sonnet-4-6";
const AI_SEUIL = parseFloat(process.env.AI_SEUIL || "0.85");
const LIST_TEAMS = (process.env.LIST_TEAMS || "").toLowerCase() === "true";
const CLOSED_LABEL_ID = process.env.CLOSED_LABEL_ID || "";
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
  if (USE_AI && !ANTHROPIC_KEY) { console.error("USE_AI=true mais ANTHROPIC_API_KEY manque."); process.exit(1); }
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

// ==========================================================================
//  Juge IA (Sonnet) — appoint conservateur, seulement si USE_AI
// ==========================================================================
const AI_SYSTEM = [
  {
    type: "text",
    cache_control: { type: "ephemeral" },
    text:
`Tu tries les boîtes ADMIN et OPERATIONS de l'entreprise Lasclay (asclépiade / papillons monarques).
Ces boîtes reçoivent des courriels administratifs et opérationnels : reçus, factures, confirmations de paiement,
avis de fournisseurs, notifications de plateformes (Shopify, Stripe, Google...), etc. Ce N'EST PAS du service client.

Ta seule tâche : décider si un courriel peut être FERMÉ parce qu'il ne demande AUCUNE action, AUCUNE réponse,
AUCUNE tâche et AUCUN suivi de la part de l'équipe. Tu ne rédiges rien, tu ne réponds à personne.

FERME (action="close") UNIQUEMENT les purs courriels informatifs sans geste à poser :
  - reçus et confirmations de paiement (« paiement reçu », « your receipt », rechargement automatique, solde à 0)
  - avis automatiques purement informatifs (« pour vos dossiers », « aucune action requise »)
  - accusés de réception qui ne demandent rien.

GARDE (action="keep") dès qu'un geste, une décision ou une vérification est plausible :
  - toute facture À PAYER, échec/refus de paiement, montant dû, solde à régler
  - « action requise », « vérifiez », « confirmez », suspension, expiration, alerte de sécurité
  - tout ce qui touche une commande à traiter, un remboursement, un litige, une livraison problématique
  - tout courriel écrit par une vraie personne qui attend quoi que ce soit
  - le moindre doute : GARDE.

Réponds STRICTEMENT en JSON, sans texte autour :
{"action":"close"|"keep","categorie":"reçu|confirmation_paiement|avis_informatif|facture_a_payer|action_requise|autre","confiance":0.0-1.0,"raison":"courte phrase"}`,
  },
];

async function jugerIA(sujet, corps, expediteur, boite, dateStr) {
  const user =
`AUJOURD'HUI : ${dateStr}
BOÎTE : ${boite}
EXPÉDITEUR : ${expediteur}
SUJET : ${sujet}
CORPS (nettoyé, tronqué) :
${(corps || "").slice(0, 3000)}`;
  const raw = await claude(AI_SYSTEM, user, 400);
  const out = parseJsonLoose(raw);
  if (!out || (out.action !== "close" && out.action !== "keep")) {
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
  console.log(`Juge IA : ${USE_AI ? `OUI (${MODEL}, seuil ${AI_SEUIL})` : "non (déterministe seul)"}` +
    ` | Expéditeur automatique requis : ${AUTO_REQUIRED ? "oui" : "non"}` +
    ` | Fils assignés : ${SKIP_ASSIGNED ? "sautés" : "traités"}`);
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
  const gardes = [];  // { conv, raison }
  let analyses = 0;

  for (const conv of convs) {
    analyses++;
    const boite = boiteDe.get(conv.id) || "?";
    const sujet = conv.subject || "(sans sujet)";

    // 0. Fil assigné → un humain s'en occupe.
    if (SKIP_ASSIGNED && Array.isArray(conv.assignees) && conv.assignees.length > 0) {
      gardes.push({ conv, boite, raison: "assigné à un humain" });
      continue;
    }

    let msgs;
    try { msgs = await threadMessages(conv.id); }
    catch (e) { gardes.push({ conv, boite, raison: `messages illisibles (${e.message})` }); continue; }
    if (msgs.length === 0) { gardes.push({ conv, boite, raison: "aucun message lisible" }); continue; }

    const last = msgs[msgs.length - 1];

    // 1. Dernier message = nous → en attente d'une réponse, on garde.
    if (isUs(last)) { gardes.push({ conv, boite, raison: "dernier message = nous" }); continue; }

    const expediteur = last.from_field?.address || last.from_field?.name || "?";
    const auto = isAutomatedSender(last.from_field?.address);

    // Texte de décision : sujet + aperçu (léger). Corps complet chargé au besoin.
    const apercu = stripHtml(last.body || last.preview || "");
    let texte = `${sujet}\n${apercu}`;

    // 2. Signal d'action présent → GARDE, toujours (l'exclusion prime).
    if (hasActionSignal(texte)) {
      gardes.push({ conv, boite, raison: "signal d'action détecté" });
      continue;
    }

    // 3. Déterministe : automatique (si requis) + phrase « sans action ».
    const autoOk = auto || !AUTO_REQUIRED;
    if (autoOk && hasNoActionSignal(texte)) {
      aFermer.push({ conv, boite, categorie: "sans action (déterministe)", source: "det", raison: `expéditeur ${auto ? "auto" : "?"}, phrase sans action` });
      continue;
    }

    // 4. Juge IA (seulement candidats automatiques, seulement si USE_AI).
    if (USE_AI && auto) {
      // Corps complet pour un meilleur jugement.
      let corps = apercu;
      if (last.id) { const b = stripHtml(await fetchBody(last.id)); if (b) corps = b; }
      // Re-vérifier les exclusions sur le corps complet (l'aperçu peut les manquer).
      if (hasActionSignal(`${sujet}\n${corps}`)) {
        gardes.push({ conv, boite, raison: "signal d'action détecté (corps complet)" });
        continue;
      }
      let verdict;
      try { verdict = await jugerIA(sujet, corps, expediteur, boite, dateStr); }
      catch (e) { gardes.push({ conv, boite, raison: `IA en erreur (${e.message}) → gardé` }); continue; }
      if (verdict.action === "close" && (verdict.confiance ?? 0) >= AI_SEUIL) {
        aFermer.push({ conv, boite, categorie: verdict.categorie || "sans action (IA)", source: "ia", raison: `IA: ${verdict.raison || ""} (conf. ${verdict.confiance})` });
      } else {
        gardes.push({ conv, boite, raison: `IA garde: ${verdict.raison || verdict.action} (conf. ${verdict.confiance ?? "?"})` });
      }
      continue;
    }

    // 5. Sinon, on garde.
    gardes.push({ conv, boite, raison: auto ? "automatique mais pas de signal sans action clair" : "expéditeur non automatique" });
  }

  // --- Aperçu ---
  console.log(`À FERMER (${aFermer.length}) :`);
  for (const p of aFermer) {
    console.log(`  ✔ [${p.boite}] ${(p.conv.subject || "(sans sujet)").slice(0, 60)}  — ${p.raison}`);
  }
  console.log(`\nGARDÉS (${gardes.length}) :`);
  for (const g of gardes) {
    console.log(`  · [${g.boite}] ${(g.conv.subject || "(sans sujet)").slice(0, 60)}  — ${g.raison}`);
  }

  // --- Exécution ---
  console.log(`\n${aFermer.length} fil(s) à fermer, ${gardes.length} gardé(s). (${analyses} analysé(s))`);
  let fermes = 0;
  for (const p of aFermer) {
    if (CLOSE_LIMIT && fermes >= CLOSE_LIMIT) { console.log(`Plafond CLOSE_LIMIT=${CLOSE_LIMIT} atteint, arrêt.`); break; }
    if (DRY_RUN) { fermes++; continue; }
    const r = await fermerSansAction(p.conv.id, p.categorie);
    if (r.ok) fermes++;
    else console.error(`  échec fermeture ${p.conv.id}`);
  }
  console.log(`\n${fermes} fil(s) ${DRY_RUN ? "à fermer (simulation)" : "fermé(s)"}.`);

  // --- Récapitulatif optionnel dans une conversation Missive ---
  if (RESUME_CONV && !DRY_RUN && fermes > 0) {
    const lignes = aFermer.slice(0, fermes).map((p) => `- [${p.boite}] ${(p.conv.subject || "(sans sujet)").slice(0, 70)}`).join("\n");
    try {
      await apiPost("/posts", {
        posts: {
          conversation: RESUME_CONV, organization: ORG,
          notification: { title: "Filtrage Admin/Operations", body: `${fermes} courriel(s) sans action fermé(s).` },
          markdown: `**Filtrage Admin/Operations** — ${fermes} courriel(s) sans action fermé(s) :\n${lignes}`,
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

module.exports = { hasNoActionSignal, hasActionSignal, isAutomatedSender };
