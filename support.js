/**
 * Lasclay — support.js (v2.2)
 * -------------------------
 * Réponses automatiques (en BROUILLON, jamais envoyées) pour la shared inbox
 * LAS Support, 3 fois par jour. Pour chaque fil ouvert où le dernier mot
 * revient au client, Sonnet rédige une réponse dans la voix de Lasclay,
 * nourrie du document de connaissance (connaissance_support .md, dans le dépôt).
 *
 * Mécanique anti-doublon: label « Draft AI Support » (dédié à ce script):
 * posé à la création du brouillon, retiré quand le fil est fermé
 * (intersection étiqueté ∩ team_closed), pour qu'une réponse du client
 * régénère un brouillon frais.
 *
 * Tri: le label de la catégorie est posé en même temps; la rule Missive
 * existante route vers la boîte dédiée.
 *
 * Mémoire des excuses: brouillon-stockage JSON dans « Archives support »
 * (client → excuses déjà servies), pour ne jamais resservir la même.
 *
 * GARDE-FOUS: DRY_RUN=true par défaut (ne crée RIEN), DRAFT_LIMIT=5 par
 * défaut, aucun send:true nulle part.
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN, ANTHROPIC_API_KEY   requis
 *   MODEL          défaut claude-sonnet-4-6
 *   DRY_RUN        "false" = crée pour vrai; tout autre = simulation (défaut "true")
 *   DRAFT_LIMIT    plafond de brouillons par run (défaut 5; 0 = illimité)
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

// Équipes balayées (inbox ET fermés). Surchargeable via TEAMS="id1,id2,...".
// R&D: id d'équipe à ajouter quand connu (LIST_TEAMS=true pour lister les équipes).
const DEFAULT_TEAMS = [
  "e184d153-4472-4edd-9b35-f8867cf437a8", // LAS Support
  "0db185c1-3a93-4a44-9f50-dcfe8c0683dd", // Mise à jour commande
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

// --- Mémoire des excuses (brouillon-stockage, patron validé des checkpoints) ---
async function loadExcuses() {
  const drafts = await listExportDrafts();
  const cps = [];
  for (const d of drafts) for (const a of d.attachments || []) {
    if (/^memoire_excuses_.*\.json\.gz$/.test(a.filename || "")) cps.push(a);
  }
  if (cps.length === 0) return new Map();
  cps.sort((a, b) => (a.filename < b.filename ? 1 : -1));
  try {
    const res = await fetch(cps[0].url);
    const obj = JSON.parse(zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString());
    console.log(`Mémoire des excuses relue: ${Object.keys(obj).length} client(s).`);
    return new Map(Object.entries(obj));
  } catch (e) {
    console.warn(`Mémoire des excuses illisible (${e.message}), repart à neuf.`);
    return new Map();
  }
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

async function saveExcuses(map) {
  if (DRY_RUN) { console.log("[DRY] Mémoire des excuses non sauvegardée (simulation)."); return; }
  const b64 = zlib.gzipSync(Buffer.from(JSON.stringify(Object.fromEntries(map.entries())))).toString("base64");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  await apiPost("/drafts", {
    drafts: {
      conversation: EXPORT_CONV, organization: ORG,
      from_field: { address: EXPORT_FROM }, to_fields: [{ address: EXPORT_FROM }],
      subject: `[NE PAS ENVOYER] Mémoire des excuses (${map.size} clients)`,
      body: "Stockage technique de support.js.",
      attachments: [{ base64_data: b64, filename: `memoire_excuses_${stamp}.json.gz` }],
    },
  });
  console.log(`Mémoire des excuses sauvegardée (${map.size} client(s)).`);
}

// --- Instructions de voix (acquis du digest + nouveautés support) ---
const VOICE = noDash(`
Tu rédiges des brouillons de réponse au service client de Lasclay, dans la voix de Gabriel:
gestionnaire occupé, droit au but sans être raide, accessible, jamais vendeur.

RÈGLES ABSOLUES:
- Réponds dans la LANGUE du dernier message du client (français → français québécois, anglais → anglais).
- Salutation: « Bonjour [Prénom], » (FR) / « Hi [First name], » (EN) / « Bonjour, » si prénom inconnu.
  TOUJOURS « Bonjour », JAMAIS « Bonsoir »: le brouillon peut être envoyé à n'importe quelle heure.
- NE SIGNE PAS et NE CONCLUS PAS: pas de « Chaleureusement », pas de « Merci », pas de nom à la fin.
  Termine sur la dernière phrase utile. La signature Missive (qui contient déjà « Chaleureusement, »)
  s'ajoute automatiquement.
- LIS TOUT LE FIL avant de répondre, y compris l'infolettre ou le message d'origine: la réponse
  au problème du client s'y trouve souvent. Réponds au CONTENU RÉEL; ne pose jamais de question
  dont la réponse est déjà dans le fil.
- COHÉRENCE TEMPORELLE: utilise la DATE D'AUJOURD'HUI fournie. Les dates du fil peuvent être
  vieilles de plusieurs mois: ne promets JAMAIS une saison ou un mois déjà passé (« envoi pour mai »
  alors qu'on est en juin), et adapte les références saisonnières à la date réelle.
- N'invente AUCUN fait: prix, délais, politiques et liens viennent UNIQUEMENT du document de connaissance.

ÉTAT D'UNE COMMANDE (règle critique): tu ne VOIS PAS la commande Shopify. N'affirme JAMAIS:
un montant de commande, qu'un code promo a été appliqué ou non, le contenu de la commande,
son statut d'expédition, ou des frais qui s'y rattacheraient. Tout ça va dans "note_interne"
et le brouillon reste neutre. Ne mentionne pas non plus de frais de procédure (échange, retour)
que le client n'a pas évoqués et qui ne sont pas clairement requis par sa demande.

EXCUSES GRADUÉES (selon le CONTEXTE D'ATTENTE fourni):
- 3 jours ou moins: pas d'excuse nécessaire, ou très légère.
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
  JAMAIS « contente », « désolée », « heureuse », « ravie », même dans les mots courts et joyeux
  (c'est exactement là que l'erreur se glisse).
- PRÉNOMS: si le prénom affiché est une abréviation évidente, utilise la forme complète probable
  (P-Paul → Pierre-Paul, J-F → Jean-François, Marie-H → Marie-Hélène). En cas de doute, garder tel quel.
- Français québécois: jamais le mot « dense » (dire intense, chargé, occupé); éviter les tournures de France.
- Pas de dramatisation: « on ne se reconnaît pas là-dedans » et formules du même calibre sont INTERDITES
  (on n'a tué personne); l'excuse forte reste factuelle et digne.
- Pas de remplissage: « dans le portrait », « dans l'équation » et autres bouts de phrase superflus.
- JAMAIS le mot « Nota » (« Nota pris », « Nota bene »): écrire « C'est noté » ou « Bien noté ».
- Pas de jargon technique côté client: « PCI-DSS », « certifié », noms de protocoles. Expliquer simplement
  (ex.: les paiements passent par Shopify, on ne voit jamais ton numéro de carte au complet).
- Interdits: structure « ce n'est pas X, c'est Y » et ses formes déguisées; jargon corporate
  (« aligner les détails », « valeur ajoutée », « explorer les synergies »); formules creuses
  (« j'espère que ce message vous trouve bien », « n'hésitez pas à », « je serais ravi de »,
  « fell through the cracks », « that's on me », « glissé entre les mailles »).
- JAMAIS de tiret cadratin ni demi-cadratin: virgule, deux-points ou parenthèses.
- Si une canned response du document couvre le cas, INSPIRE-T'EN fortement (c'est le savoir officiel),
  en l'adaptant au fil; attention aux canned marquées [À VÉRIFIER].

NOTES INTERNES COURTES: note_interne et action_requise doivent se lire en moins de 15 secondes.
Style télégraphique (« Vérifier rabais 30% sur L-50449 dans Shopify », pas de phrases longues,
pas de raisonnement). Ne répète JAMAIS la même chose dans les deux champs: note_interne = le doute
à vérifier, action_requise = le geste à poser. Détaille seulement si le cas est réellement complexe
(longue saga, plusieurs enjeux entremêlés).

RÉPONSE ATTENDUE: UNIQUEMENT un objet JSON:
{
  "repondre": true|false,        // false si spam, démarchage, notifications, réponse d'infolettre sans question
  "raison": "<si false, pourquoi, court>",
  "categorie": "<suivi_livraison|modification_annulation_commande|retour_echange_remboursement|question_pre_achat|probleme_produit_garantie|wholesale_b2b|douane_international|autre>",
  "langue": "fr|en",
  "brouillon": "<le texte du brouillon, sauts de ligne avec \\n>",
  "excuse_utilisee": "<si une excuse de délai/retard a été servie, sa phrase exacte, sinon null>",
  "note_interne": "<télégraphique: ce que Gabriel doit VÉRIFIER avant d'envoyer, sinon null. JAMAIS dans le corps du brouillon.>",
  "action_requise": "<télégraphique: le geste que Gabriel doit POSER avant d'envoyer, sinon null>"
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

// --- Run principal ---
(async () => {
  if (LIST_TEAMS) {
    const { teams = [] } = await api("/teams?limit=50");
    console.log("Équipes de l'organisation:");
    for (const t of teams) console.log(`  ${t.id}  ${t.name}`);
    return;
  }
  console.log("=== Lasclay support.js v2.2 ===");
  console.log(DRY_RUN ? "=== MODE SIMULATION (rien créé) ===" : "=== MODE RÉEL ===");
  console.log(`Modèle: ${MODEL} | DRAFT_LIMIT: ${DRAFT_LIMIT || "aucun"} | MAX_FILS: ${MAX_FILS}`);

  // 0. Document de connaissance (depuis le dépôt)
  if (!fs.existsSync(KNOWLEDGE_FILE)) {
    console.error(`Document de connaissance introuvable: ${KNOWLEDGE_FILE}. L'ajouter au dépôt.`);
    process.exit(1);
  }
  const knowledge = fs.readFileSync(KNOWLEDGE_FILE, "utf8");
  console.log(`Connaissance chargée: ${(knowledge.length / 1024).toFixed(0)} Ko.`);
  const systemBlocks = [
    { type: "text", text: sanit("DOCUMENT DE CONNAISSANCE DU SERVICE CLIENT LASCLAY:\n\n" + noDash(knowledge)), cache_control: { type: "ephemeral" } },
    { type: "text", text: sanit(VOICE) },
  ];

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
  for (const t of TEAM_IDS) {
    const convs = await listByFilter(`team_inbox=${t}`);
    console.log(`  ${convs.length} fil(s) ouverts dans l'équipe ${t.slice(0, 8)}…`);
    for (const c of convs) inboxById.set(c.id, c);
  }
  const inbox = [...inboxById.values()].sort((a, b) => (b.last_activity_at || 0) - (a.last_activity_at || 0));
  console.log(`${inbox.length} fil(s) ouverts uniques dans ${TEAM_IDS.length} boîtes.`);
  const excuses = await loadExcuses();

  // Index: adresse d'auteur → fils ouverts (pour voir qu'un client a écrit sur plusieurs fils).
  // Champ `authors` des conversations: déduit de la doc, jamais validé; si absent, l'index reste vide.
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

  let analysed = 0, created = 0, skipped = 0, noReply = 0, errors = 0, verifs = 0, dejaBrouillon = 0;
  for (const conv of inbox) {
    if (drafted.has(conv.id) || conv.id === EXPORT_CONV) { skipped++; continue; }
    // Aucun deuxième brouillon, jamais: si le fil a déjà un brouillon (IA périmé ou
    // brouillon humain en cours), on n'y touche pas.
    if ((conv.drafts_count || 0) > 0) { dejaBrouillon++; continue; }
    if (analysed >= MAX_FILS) break;
    if (DRAFT_LIMIT > 0 && created >= DRAFT_LIMIT) { console.log("Plafond de brouillons atteint."); break; }

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

      // Contexte d'attente: depuis quand le client attend, et combien de fois il a écrit
      // sans réponse de notre part (pilote l'intensité de l'excuse).
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
      const alertes = [];
      if (/\b(désolée|contente|heureuse|ravie|navrée)\b/i.test(corps) &&
          !/(vous|tu|t'|elle|cliente?)\s+(êtes|es|est|seras?|serez|sois|soyez)?\s*(désolée|contente|heureuse|ravie|navrée)/i.test(corps)) {
        alertes.push("féminin de 1re personne probable");
      }
      for (const [re, lbl] of [
        [/n'hésite[zs]? pas/i, "« n'hésitez pas »"],
        [/on (te|vous) reçoit bien|on reçoit bien (tes|vos)/i, "« on te reçoit bien »"],
        [/suivra son cours/i, "coquille vide « suivra son cours »"],
        [/plus long qu'à l'habitude de notre côté/i, "formulation d'excuse bizarre"],
        [/ne (se|nous) reconna/i, "dramatisation"],
        [/^bonsoir/i, "« Bonsoir » (toujours Bonjour)"],
        [/\bnota\b/i, "« Nota » (écrire « c'est noté »)"],
        [/ce n('est|était) pas (une?\s)?[^,.;:]{2,40},\s?(c'est|c'était|juste|mais)/i, "antithèse « ce n'est pas X, c'est Y »"],
        [/it('s| is| was)? ?not [^,.;:]{2,40}, (it's|it is|just|but)/i, "antithèse EN « not X, it's Y »"],
        [/\b(PCI|DSS|SSL)\b/, "jargon technique"],
      ]) {
        if (re.test(corps)) alertes.push(lbl);
      }

      // Montants non sourcés: tout montant en $ du brouillon doit exister dans le fil
      // ou dans le document de connaissance, sinon il est probablement halluciné.
      const source = (filTexte + knowledge).replace(/[\s\u00a0]/g, "");
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

      // Verrou humain: tout brouillon avec note, action ou alerte exige une vérification
      // avant envoi. C'est AUSSI la future porte du mode automatique: un brouillon marqué
      // verifRequise ne sera JAMAIS admissible à l'envoi auto (il restera en draft).
      const verifRequise = noteLigne.length > 0;

      // Signature: l'API Missive n'insère JAMAIS la signature d'alias dans un brouillon
      // (confirmé doc + test réel). Le script l'ajoute lui-même, selon la langue.
      // Canaux sociaux: ni signature ni citation (format courriel seulement).
      const estCourriel = !last.type || /email/.test(last.type);
      const SIGNATURE_FR = "Chaleureusement,<br>__<br><b>Gabriel Gouveia</b><br>Co-fondateur<br>+1 (581) 982-5857<br>Lasclay.com";
      const SIGNATURE_EN = "Warmly,<br>__<br><b>Gabriel Gouveia</b><br>Co-founder<br>+1 (581) 982-5857<br>Lasclay.com";
      const signature = estCourriel ? `<br><br>${out.langue === "en" ? SIGNATURE_EN : SIGNATURE_FR}` : "";

      if (DRY_RUN) {
        created++;
        if (verifRequise) verifs++;
        console.log(`\n[DRY draft ${created}] ${subj.slice(0, 60) || "(sans sujet)"} | ${out.categorie} | ${out.langue} | to: ${toAddr || "(social, sans adresse)"}`);
        if (verifRequise) console.log("  ⚠️⚠️ VÉRIFICATION HUMAINE REQUISE AVANT ENVOI ⚠️⚠️");
        for (const l of noteLigne) console.log(`  >> ${l}`);
        console.log(`---\n${corps}\n---`);
      } else {
        const draft = {
          conversation: conv.id,
          organization: ORG,
          from_field: { address: EXPORT_FROM },
          subject: subj ? `Re: ${subj.replace(/^re:\s*/i, "")}` : undefined,
          body: corps.replace(/\n/g, "<br>") + signature,
          quote_previous_message: estCourriel, // apparence de réponse: cite le dernier message du fil
          add_shared_labels: labels,
          // PAS de send:true, JAMAIS. Et le jour où un mode d'envoi automatique existera:
          // verifRequise === true devra TOUJOURS forcer le brouillon (jamais d'envoi auto).
        };
        if (toAddr) draft.to_fields = [{ address: toAddr }];
        try {
          await apiPost("/drafts", { drafts: draft });
          created++;
          if (verifRequise) verifs++;
          drafted.add(conv.id);
          console.log(`[draft ${created}] ${subj.slice(0, 60) || "(sans sujet)"} | ${out.categorie} | ${out.langue}${verifRequise ? " | ⚠️ VÉRIFICATION REQUISE" : ""}`);
          // Notes et actions: post interne dans le fil (mécanisme validé du digest),
          // pour que Gabriel les voie à côté du brouillon avant d'envoyer.
          if (verifRequise) {
            try {
              await apiPost("/posts", {
                posts: {
                  conversation: conv.id,
                  organization: ORG,
                  notification: { title: "⚠️ Brouillon IA: VÉRIFIER AVANT D'ENVOYER", body: noteLigne.join(" | ").slice(0, 200) },
                  username: "Support IA",
                  markdown: "## ⚠️ NE PAS ENVOYER TEL QUEL: vérifications requises\n" + noteLigne.map((l) => `- ${l}`).join("\n"),
                },
              });
            } catch (e) { console.warn(`  post interne échoué sur ${conv.id}: ${e.message}`); }
          }
          if (out.excuse_utilisee) {
            const list = excuses.get(clientKey) || [];
            list.push({ date: new Date().toISOString().slice(0, 10), texte: String(out.excuse_utilisee).slice(0, 200) });
            excuses.set(clientKey, list);
          }
        } catch (e) {
          errors++;
          console.warn(`  draft échoué sur ${conv.id} (canal ${last.type || "?"}): ${e.message}`);
        }
      }
    } catch (e) {
      errors++;
      console.warn(`  fil ${conv.id} sauté: ${e.message}`);
    }
  }

  if (created > 0 && !DRY_RUN) await saveExcuses(excuses);
  console.log(`\nBilan: ${analysed} analysés, ${created} brouillon(s) dont ${verifs} avec vérification requise, ${noReply} sans réponse requise, ${skipped} sautés, ${dejaBrouillon} avec brouillon existant, ${errors} erreur(s).`);
  console.log("Run terminé.");
})().catch((e) => { console.error("Erreur fatale:", e.message); process.exit(1); });
