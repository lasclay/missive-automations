/**
 * Missive — merge.js (v2.1)
 * --------------------------------------------------------------------------
 * Un seul cron qui REMPLACE le webhook (missive-auto-flag.js), la rule Missive
 * et le balayage (backfill.js). Il détecte les fils en doublon par empreinte
 * client et pose le label « À fusionner ». La fusion automatique est codée mais
 * DORMANTE par défaut (MERGE=false) : phase 1 = étiquetage seulement.
 *
 * DEUX RÈGLES DE LA BOÎTE, ET LE RESTE EN DÉCOULE
 * ----------------------------------------------
 * 1. MÊME CLIENT = MÊME FIL, quelle que soit la date. Réunir un fil de l'an dernier et un
 *    fil d'aujourd'hui du même client n'est pas un problème : c'est le but. L'adresse
 *    courriel identique tranche, sans aucune contrainte de temps ni de sujet.
 * 2. ON NE FUSIONNE QUE DES FILS OUVERTS. Un fil fermé sert à la DÉTECTION — savoir qu'un
 *    client a déjà écrit — jamais de source ni de survivant. Ce n'est pas un réglage.
 *
 * Ce qui restait à corriger, c'est donc l'inverse : les fils qui NE SONT PAS du même client
 * et que le script soudait quand même. Jusqu'à la v1.5, un simple numéro de commande vu
 * n'importe où dans le texte — y compris dans une chaîne de réponses citée — suffisait à
 * relier deux fils. Deux cas réels mesurés dans la boîte : la commande L-42916 citée par
 * martine.gascon@ et far1090@ à 233 jours d'écart, et L-49227 citée par gc.lavoie@ et
 * chntlhbrd@ à 444 jours. Une commande transférée, un cadeau, une plainte relayée — et deux
 * clientes différentes se retrouvaient dans un même fil, IRRÉVERSIBLEMENT.
 *
 * D'où la ligne de partage de la v2.1 :
 *
 *   ADRESSE IDENTIQUE  → doublon, sans condition. Aucun plafond de date, de durée ni de
 *                        taille de groupe : un client fidèle a droit à tous ses fils.
 *
 *   ADRESSES DIFFÉRENTES (le lien ne tient qu'à un numéro de commande ou à un nom) → il faut
 *   prouver que c'est le même épisode, sinon on soude deux clients :
 *     1. FENÊTRE   — écart ≤ DUP_WINDOW_DAYS (10 j) si commande ou sujet de base commun,
 *                    sinon ≤ DUP_TIGHT_WINDOW_DAYS (3 j).
 *     2. ÉTENDUE   — le fil résultant ne couvre pas plus de DUP_MAX_SPAN_DAYS (45 j), porté
 *                    à DUP_MAX_SPAN_ORDER_DAYS (120 j) si un numéro de commande les relie.
 *     3. COMMANDES — numéros de commande DISJOINTS : jamais un doublon
 *                    (DUP_ORDER_CONFLICT=false pour désactiver).
 *     4. AGRÉGATS  — un fil portant plus de DUP_BLOB_SUBJECTS (4) sujets distincts, ou
 *                    couvrant déjà plus de DUP_BLOB_DAYS (120 j), ne se relie PAS par ces
 *                    clés faibles. Il garde le droit de rejoindre les fils de SON client
 *                    (adresse identique) — mais il n'aimante plus d'inconnus.
 *   Et deux plafonds de groupe, eux aussi réservés aux groupes à adresses mêlées : au-delà de
 *   DUP_MAX_GROUP (4) fils ou de l'étendue max, le groupe est SIGNALÉ, ni étiqueté ni
 *   fusionné. En phase 2, la fusion exige une CLIQUE : chaque paire valide par elle-même,
 *   jamais par transitivité (A~B, B~C n'implique pas A~C).
 *
 * Les numéros de commande sont lus dans le texte NON CITÉ seulement : un L-XXXXX qui traîne
 * dans une chaîne de réponses citée ne relie plus deux fils étrangers.
 *
 * L'IDENTITÉ d'un fil, c'est son PREMIER EXPÉDITEUR EXTERNE, pas l'ensemble des adresses qu'il
 * contient. Un fil où une cliente transfère la commande d'une autre porte les deux adresses :
 * s'en servir comme clés soude deux clientes (mesuré sur L-49227, gc.lavoie@ et chntlhbrd@,
 * 444 jours). Les autres adresses ne servent qu'au journal.
 *
 * Et toute adresse de NOTRE domaine (MISSIVE_SELF_DOMAINS, défaut lasclay.com) est à nous,
 * qu'elle figure ou non dans MISSIVE_SELF_ADDRESSES. media@lasclay.com manquait à cette liste
 * tenue à la main : il passait pour un client et servait de pont entre les fils de deux
 * clientes sans rapport.
 *
 * Détection : empreintes courriel / numéro de commande (nom facultatif), regroupées par
 * union-find sur les PAIRES VALIDÉES. Le regroupement se fait sur l'IDENTITÉ du client,
 * pas sur la boîte : un client avec un fil dans LAS Support et un autre dans Vente
 * pré-achat est détecté comme doublon, où qu'il soit, et les deux reçoivent le label.
 *
 * PÉRIMÈTRE : seules les 6 BOÎTES CLIENTS sont ratissées (pas Admin, Operations, Corpo,
 * Media, R&D, etc.). Les expéditeurs SYSTÈMES (noreply, Shopify, Etsy...) sont exclus :
 * jamais de label sur eux.
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN           token API (missive_pat-...)                [requis]
 *   MISSIVE_SELF_ADDRESSES  tes adresses (hey@, admin@, operations@),
 *                           séparées par des virgules                 [requis]
 *   MISSIVE_LABEL_ID        override du label (sinon le défaut « À fusionner »
 *                           7c922a57-... codé en dur)               [facultatif]
 *   MISSIVE_TEAMS           override : ids d'équipes à ratisser, séparés par des
 *                           virgules. Si absent, les 6 boîtes clients par défaut.
 *   MISSIVE_SELF_DOMAINS    nos domaines (défaut « lasclay.com »), séparés par des virgules.
 *                           Toute adresse s'y terminant est à nous, jamais un client. [facultatif]
 *   MISSIVE_SYSTEM_SENDERS  motifs d'adresses systèmes à exclure EN PLUS des
 *                           défauts (noreply, no-reply, shopify.com, etsy.com),
 *                           séparés par des virgules.                [facultatif]
 *   MISSIVE_ORG             id d'organisation (défaut Lasclay)        [facultatif]
 *   DRY_RUN                 "true" = simulation totale (rien posé, rien fusionné).
 *                           DÉFAUT "false" : la phase 1 (étiquetage) est réversible.
 *                           En phase 2 (MERGE=true), METTRE DRY_RUN=true au 1er essai.
 *   MERGE                   "true" = phase 2, fusionne vraiment.   DÉFAUT false.
 *   MERGE_ONLY_EMAIL        "true" (défaut) = ne fusionne QUE les groupes reliés
 *                           par adresse courriel exacte. La fusion ne touche JAMAIS un fil
 *                           FERMÉ, quel que soit ce réglage.
 *   MERGE_LIMIT             plafond du nombre de fusions par run (0 = illimité).
 *
 *   --- garde-fous v2.0 (tous facultatifs, valeurs par défaut entre parenthèses) ---
 *   Ces seuils ne concernent QUE les liens entre adresses DIFFÉRENTES. Deux fils portant la
 *   même adresse courriel sont réunis sans condition.
 *
 *   DUP_WINDOW_DAYS         (10)  écart max quand une commande ou le sujet de base concorde.
 *   DUP_TIGHT_WINDOW_DAYS   (3)   écart max quand ni l'un ni l'autre ne concorde.
 *   DUP_MAX_SPAN_DAYS       (45)  étendue max du fil résultant.
 *   DUP_MAX_SPAN_ORDER_DAYS (120) étendue max quand un numéro de commande commun relie
 *                                 les deux fils.
 *   DUP_MAX_GROUP           (4)   taille max d'un groupe étiquetable/fusionnable.
 *   DUP_BLOB_DAYS           (120) au-delà, le fil est un agrégat : exclu du regroupement.
 *   DUP_BLOB_SUBJECTS       (4)   idem, en nombre de sujets de base distincts.
 *   DUP_ORDER_CONFLICT      ("true") des numéros de commande disjoints bloquent le lien.
 *   DUP_EXPLAIN             ("true") journalise les paires REJETÉES et pourquoi
 *                                 (audit des faux positifs).
 *
 * ATTENTION : la FUSION (POST /conversations/:id/merge) est IRRÉVERSIBLE.
 * DRY_RUN=true d'abord, puis MERGE_LIMIT=3.
 */

const VERSION = "v2.1";
// v2.1: DEUX RÈGLES DE LA BOÎTE. (a) Adresse courriel identique = même client = doublon, SANS
// contrainte de temps : la v2.0 exigeait aussi la proximité temporelle et écartait des fils qu'il
// fallait bien réunir. Les garde-fous de temps, d'étendue et de taille ne s'appliquent plus qu'aux
// liens entre adresses DIFFÉRENTES — là où vivaient les vrais faux positifs (deux clientes soudées
// par une commande transférée). (b) La FUSION ne touche QUE des fils OUVERTS : MERGE_CLOSED
// n'existe plus, un fil fermé sert à la détection et rien d'autre. Chaque fil retient désormais
// toutes les adresses qu'il contient, pour qu'un fil déjà fusionné reconnaisse encore son client.
// v2.0: FAUX POSITIFS. La détection n'avait aucune notion de temps : deux fils du même client
// à un an d'écart étaient un « doublon ». Ajout de la fenêtre temporelle, de l'étendue max, du
// conflit de numéros de commande, de l'exclusion des fils-agrégats, du plafond de taille de
// groupe et de l'exigence de clique avant fusion. Les numéros de commande ne sont plus lus dans
// le texte cité. Le journal explique chaque rejet (DUP_EXPLAIN).
// v1.5: FUSION DES DOUBLONS FERMÉS (MERGE_CLOSED, défaut true). Les fils fermés ne servaient qu'à la
// détection; ils PARTICIPENT maintenant à la fusion — un doublon fermé se replie dans le fil OUVERT
// du client (survivant choisi ouvert en priorité, puis le plus récent). Les fils fermés ne sont
// toujours JAMAIS étiquetés (le label ne sert qu'aux ouverts). Exclusions système élargies aux
// expéditeurs automatisés vus en prod (dmarc, postmaster, mailer-daemon, amazonses, instagram,
// apple/testflight, judge.me, bounce) : jamais fusionnés.
// v1.4: la détection inclut aussi un lot borné de fils FERMÉS récents (INCLUDE_CLOSED, défaut true;
// INCLUDE_CLOSED_PAGES pages/boîte, défaut 10). Un client avec 1 fil ouvert + 1 fil fermé est ainsi
// détecté comme doublon. Les fils fermés ne sont JAMAIS étiquetés (détection seule pour l'étiquetage).

const TOKEN = process.env.MISSIVE_TOKEN;
const LABEL = process.env.MISSIVE_LABEL_ID || "7c922a57-5644-4d88-b731-5a040cbb681a"; // « À fusionner »
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36"; // Lasclay
const DRY_RUN = (process.env.DRY_RUN || "false").toLowerCase() !== "false"; // défaut: réel
const MERGE = (process.env.MERGE || "").toLowerCase() === "true"; // défaut: phase 1
const MERGE_ONLY_EMAIL = (process.env.MERGE_ONLY_EMAIL || "true").toLowerCase() !== "false";
const MERGE_LIMIT = parseInt(process.env.MERGE_LIMIT || "0", 10) || 0; // 0 = illimité
// Les fils FERMÉS ne fusionnent JAMAIS. Ce n'est pas un réglage : c'est une règle de la boîte.
// Ils servent uniquement à la DÉTECTION (savoir qu'un client a déjà écrit), jamais de source ni de
// survivant. La v1.5 les fusionnait (MERGE_CLOSED=true) — cette variable n'existe plus et est
// ignorée si elle traîne dans l'environnement du cron.
// Empreinte par nom : éteinte par défaut (source de faux groupes sur les expéditeurs
// récurrents et les homonymes). Mettre USE_NAME=true pour la réactiver.
const USE_NAME = (process.env.USE_NAME || "").toLowerCase() === "true";

// Les 6 boîtes clients (ids confirmés par les logs de production). Override via MISSIVE_TEAMS.
const DEFAULT_CLIENT_TEAMS = [
  { id: "e184d153-4472-4edd-9b35-f8867cf437a8", name: "LAS Support" },
  { id: "cc587c84-63b9-4e88-993c-4f4b5b328173", name: "RETOURS-ÉCHANGES" },
  { id: "d6f28d2f-06ef-4aa5-aae0-b68f014e3216", name: "Vente - info pré-achat" },
  { id: "13d8a7bd-ed2e-4e0c-8cf3-2329ebaed217", name: "USA" },
  { id: "9240aa4e-3e81-40aa-a07a-84f6b1c2231e", name: "Expéditions prioritaires" },
  { id: "0db185c1-3a93-4a44-9f50-dcfe8c0683dd", name: "Mise à jour commande" },
];

const ENV_TEAMS = (process.env.MISSIVE_TEAMS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SELF = (process.env.MISSIVE_SELF_ADDRESSES || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Nos DOMAINES. MISSIVE_SELF_ADDRESSES est une liste tenue à la main, et elle a été
// incomplète : media@lasclay.com n'y figurait pas, était donc pris pour un client, et servait
// de pont entre des fils de deux clients différents (mesuré : misscujo@ soudée à denis.roy58@).
// Une adresse de notre domaine n'est jamais un client, qu'on ait pensé à l'inscrire ou non.
const SELF_DOMAINS = (process.env.MISSIVE_SELF_DOMAINS || "lasclay.com")
  .split(",")
  .map((s) => s.trim().toLowerCase().replace(/^@/, ""))
  .filter(Boolean);
const isSelfAddress = (addr) => {
  if (!addr) return false;
  const a = addr.toLowerCase();
  return SELF.includes(a) || SELF_DOMAINS.some((d) => a.endsWith(`@${d}`));
};

// Expéditeurs systèmes (notifications automatisées) : jamais traités comme des clients.
// Comparaison par sous-chaîne sur l'adresse, en minuscules.
const SYSTEM_PATTERNS = [
  "noreply",
  "no-reply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "shopify.com",
  "etsy.com",
  "klaviyo.com",
  // Rapports/notifications automatisés vus en production (JAMAIS des clients — ne jamais fusionner).
  "dmarc", // dmarcreport@microsoft.com, dmarc.report@polymtl.ca, reports@fastmaildmarc.com, dmarc@infomaniak.com...
  "postmaster", // postmaster@amazonses.com
  "mailer-daemon", // rebonds (bounces)
  "amazonses.com",
  "mail.instagram.com", // security@ / activity-recap@ / follow-suggestions@ mail.instagram.com
  "email.apple.com", // notifications Apple / TestFlight
  "judge.me", // app d'avis
  "bounce",
  ...(process.env.MISSIVE_SYSTEM_SENDERS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
];
const isSystemSender = (addr) => {
  if (!addr) return false;
  const a = addr.toLowerCase();
  return SYSTEM_PATTERNS.some((p) => a.includes(p));
};

// Noms de nos propres pages/comptes sociaux (l'expéditeur y est un nom de page).
const DEFAULT_SELF_NAMES = [
  "Asclépiade & papillons monarques",
  "Lasclay",
  "Lasclay: The Milkweed Company",
  "Milkweed & Monarchs",
];
const ENV_SELF_NAMES = (process.env.MISSIVE_SELF_NAMES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const norm = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const SELF_NAMES = new Set(
  (ENV_SELF_NAMES.length > 0 ? ENV_SELF_NAMES : DEFAULT_SELF_NAMES).map(norm)
);

const ORDER_RE = /\bL-\d{4,6}\b/gi;

const API = "https://public.missiveapp.com/v1";
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (!TOKEN) {
  console.error("Manque MISSIVE_TOKEN.");
  process.exit(1);
}
if (SELF.length === 0) {
  console.error("Manque MISSIVE_SELF_ADDRESSES (tes propres adresses, séparées par des virgules).");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, tries = 0) {
  await sleep(260);
  let res;
  try {
    res = await fetch(`${API}${path}`, { headers });
  } catch (e) {
    if (tries < 4) {
      console.warn(`Réseau (${e.message}) sur GET ${path}, pause ${(tries + 1) * 5}s...`);
      await sleep((tries + 1) * 5000);
      return api(path, tries + 1);
    }
    throw e;
  }
  if (res.status === 429) {
    console.warn("Limite de débit atteinte, pause 30 s...");
    await sleep(30000);
    return api(path, tries);
  }
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function apiPost(path, body, tries = 0) {
  await sleep(260);
  let res;
  try {
    res = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (e) {
    if (tries < 4) {
      console.warn(`Réseau (${e.message}) sur POST ${path}, pause ${(tries + 1) * 5}s...`);
      await sleep((tries + 1) * 5000);
      return apiPost(path, body, tries + 1);
    }
    throw e;
  }
  if (res.status === 429) {
    console.warn("Limite de débit atteinte, pause 30 s...");
    await sleep(30000);
    return apiPost(path, body, tries);
  }
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }
  if (!res.ok) console.error(`POST ${path} → ${res.status} ${text}`);
  return { ok: res.ok, status: res.status, json, text };
}

// PATCH silencieux (changement de label sans commentaire ni notification).
async function apiPatch(path, body, tries = 0) {
  await sleep(260);
  let res;
  try {
    res = await fetch(`${API}${path}`, { method: "PATCH", headers, body: JSON.stringify(body) });
  } catch (e) {
    if (tries < 4) {
      console.warn(`Réseau (${e.message}) sur PATCH ${path}, pause ${(tries + 1) * 5}s...`);
      await sleep((tries + 1) * 5000);
      return apiPatch(path, body, tries + 1);
    }
    throw e;
  }
  if (res.status === 429) {
    console.warn("Limite de débit atteinte, pause 30 s...");
    await sleep(30000);
    return apiPatch(path, body, tries);
  }
  const text = await res.text();
  if (!res.ok) console.error(`PATCH ${path} → ${res.status} ${text}`);
  return { ok: res.ok, status: res.status, text };
}

// Les équipes à ratisser : MISSIVE_TEAMS si fourni, sinon les 6 boîtes clients.
function resolveTeams() {
  if (ENV_TEAMS.length > 0) {
    console.log(`Équipes (MISSIVE_TEAMS) : ${ENV_TEAMS.length}`);
    return ENV_TEAMS.map((id) => ({ id, name: id }));
  }
  console.log(`Équipes : ${DEFAULT_CLIENT_TEAMS.length} boîtes clients`);
  for (const t of DEFAULT_CLIENT_TEAMS) console.log(`  ${t.id}  →  ${t.name}`);
  return DEFAULT_CLIENT_TEAMS;
}

// filterKey: "team_inbox" (ouverts) ou "team_closed" (fermés). maxPages borne le balayage
// (utile pour les fermés, potentiellement nombreux). tagClosed: marque les fils comme fermés.
async function paginateInto(byId, teamId, { filterKey = "team_inbox", maxPages = Infinity, tagClosed = false } = {}) {
  let until = null;
  let pages = 0;
  const limit = 50;
  while (pages < maxPages) {
    let path = `/conversations?${filterKey}=${teamId}&limit=${limit}`;
    if (until) path += `&until=${until}`;
    const { conversations = [] } = await api(path);
    if (conversations.length === 0) break;
    pages++;
    for (const c of conversations) {
      // Un fil OUVERT prime sur sa version fermée (ne jamais réécrire un ouvert avec _closed=true).
      if (byId.has(c.id) && !byId.get(c.id)._closed) continue;
      byId.set(c.id, tagClosed ? { ...c, _closed: true } : c);
    }
    const oldest = conversations[conversations.length - 1].last_activity_at;
    if (conversations.length < limit || oldest === until) break;
    until = oldest;
  }
  return pages;
}

// Balaie les fils OUVERTS (tous) puis, par défaut, un lot borné de fils FERMÉS récents.
// Les fermés ENRICHISSENT la détection de doublons (ex.: 1 fil ouvert + 1 fil fermé du même
// client) mais ne sont JAMAIS étiquetés ni fusionnés (voir shouldLabel/phase 1). Borne via
// INCLUDE_CLOSED_PAGES (défaut 10 pages = ~500 fermés/boîte). INCLUDE_CLOSED=false pour désactiver.
const INCLUDE_CLOSED = (process.env.INCLUDE_CLOSED || "true").toLowerCase() !== "false";
const CLOSED_PAGES = parseInt(process.env.INCLUDE_CLOSED_PAGES || "10", 10) || 10;
async function collectOpenConversations(teams) {
  const byId = new Map();
  let allOk = true;
  for (const t of teams) {
    try {
      const pages = await paginateInto(byId, t.id);
      let cpages = 0;
      if (INCLUDE_CLOSED) cpages = await paginateInto(byId, t.id, { filterKey: "team_closed", maxPages: CLOSED_PAGES, tagClosed: true });
      console.log(`  ${t.name || t.id} : ${pages} page(s) ouverte(s)${INCLUDE_CLOSED ? ` + ${cpages} page(s) fermée(s)` : ""}`);
    } catch (e) {
      allOk = false;
      console.warn(`  ${t.name || t.id} : ignorée (${e.message})`);
    }
  }
  return { convs: [...byId.values()], allOk };
}

// ===========================================================================
// Empreintes et règles de doublon (v2.0)
// ===========================================================================

const DAY = 86400;
const numEnv = (name, def) => {
  const v = parseInt(process.env[name] || "", 10);
  return Number.isFinite(v) && v >= 0 ? v : def;
};
const WINDOW_DAYS = numEnv("DUP_WINDOW_DAYS", 10);
const TIGHT_WINDOW_DAYS = numEnv("DUP_TIGHT_WINDOW_DAYS", 3);
const MAX_SPAN_DAYS = numEnv("DUP_MAX_SPAN_DAYS", 45);
// Un numéro de commande commun est une empreinte bien plus forte qu'une adresse commune :
// c'est elle qui a trouvé le seul vrai doublon à deux adresses sur 806 fils. On lui accorde
// donc une étendue plus large qu'à un simple lien par courriel.
const MAX_SPAN_ORDER_DAYS = numEnv("DUP_MAX_SPAN_ORDER_DAYS", 120);
const MAX_GROUP = numEnv("DUP_MAX_GROUP", 4);
const BLOB_DAYS = numEnv("DUP_BLOB_DAYS", 120);
const BLOB_SUBJECTS = numEnv("DUP_BLOB_SUBJECTS", 4);
const ORDER_CONFLICT = (process.env.DUP_ORDER_CONFLICT || "true").toLowerCase() !== "false";
const EXPLAIN = (process.env.DUP_EXPLAIN || "true").toLowerCase() !== "false";

function extractOrders(text) {
  const found = (text || "").match(ORDER_RE) || [];
  return found.map((s) => s.toUpperCase());
}

// Le corps d'un message Missive est du HTML. On en tire du texte, en COUPANT à la
// première citation : un numéro de commande qui traîne dans une chaîne de réponses
// n'appartient pas au fil courant et ne doit relier personne.
function plainText(html) {
  if (!html) return "";
  let h = String(html);
  for (const re of [/<blockquote/i, /class="?gmail_quote/i, /id="?(divRplyFwdMsg|appendonsend)/i]) {
    const i = h.search(re);
    if (i >= 0) h = h.slice(0, i);
  }
  return h
    .replace(/<(br|\/p|\/div|\/tr|\/li)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

// Coupe aux en-têtes de citation en clair (Outlook, Gmail, Missive, Apple Mail) et
// retire les lignes préfixées « > ».
const QUOTE_CUTS = [
  /^\s*On .{5,80}\s+wrote\s*:/mi,
  /^\s*Le .{5,80}\s+a écrit\s*:/mi,
  /^\s*-{2,}\s*(Original Message|Message d'origine|Forwarded message|Message transféré)/mi,
  /^\s*(De|From)\s*:\s*.{3,}$/mi,
  /^\s*(Envoyé|Sent)\s*:\s*.{3,}$/mi,
  /^\s*_{5,}\s*$/m,
];
function unquoted(text) {
  if (!text) return "";
  let t = String(text);
  let cut = t.length;
  for (const re of QUOTE_CUTS) {
    const m = t.match(re);
    if (m && m.index != null && m.index < cut) cut = m.index;
  }
  return t
    .slice(0, cut)
    .split("\n")
    .filter((l) => !/^\s*>/.test(l))
    .join("\n");
}

// Sujet « de base » : sans les Re:/Fwd: empilés, sans emoji, sans numéro de commande.
// Sert à savoir si deux fils parlent visiblement de la même chose.
const baseSubject = (s) =>
  norm(s)
    .replace(/^\s*((re|ré|rép|reponse|réponse|fwd|fw|tr)\s*(\[\d+\])?\s*:\s*)+/i, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\bl-\d{4,6}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const iso = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : "?");

// Empreintes d'un fil. Si l'expéditeur externe est un système (noreply, Shopify,
// Etsy...), on renvoie des empreintes VIDES : le fil ne se groupe avec rien.
async function fingerprints(conv) {
  const { messages = [] } = await api(`/conversations/${conv.id}/messages?limit=10`);
  const sorted = messages
    .slice()
    .sort((a, b) => (a.delivered_at || a.created_at || 0) - (b.delivered_at || b.created_at || 0));

  let email = null;
  let name = null;
  const emails = new Set();
  const orders = new Set();
  const subjects = new Set();
  const stamps = [];

  for (const o of extractOrders(conv.subject)) orders.add(o);
  if (conv.subject) subjects.add(baseSubject(conv.subject));

  for (const m of sorted) {
    const at = m.delivered_at || m.created_at || 0;
    if (at) stamps.push(at);
    if (m.subject) subjects.add(baseSubject(m.subject));

    // Sujet : jamais cité, donc fiable. Corps : texte non cité seulement.
    for (const o of extractOrders(m.subject)) orders.add(o);
    for (const o of extractOrders(unquoted(plainText(m.body) || m.preview))) orders.add(o);

    const addr = m.from_field?.address?.toLowerCase() || null;
    const dispName = norm(m.from_field?.name);
    const isSelf = isSelfAddress(addr) || (dispName && SELF_NAMES.has(dispName));
    if (isSelf) continue;

    if (addr) emails.add(addr);
    if (!email && addr) email = addr;

    if (!name && dispName) name = dispName;
  }

  subjects.delete("");
  const last = conv.last_activity_at || 0;
  if (last) stamps.push(last);
  const firstAt = stamps.length ? Math.min(...stamps) : last;
  const lastAt = stamps.length ? Math.max(...stamps) : last;

  // Expéditeur système → aucune empreinte (jamais de label, jamais de groupe).
  if (isSystemSender(email)) {
    return { email: null, autresAdresses: [], name: null, orders: [], subjects: [], firstAt, lastAt, blob: null };
  }
  // Les autres adresses du fil sont CONSERVÉES POUR LE JOURNAL seulement, jamais pour relier :
  // un fil où une cliente transfère la commande d'une autre contient les deux adresses, et
  // s'en servir comme clé soude deux clientes (mesuré : la commande L-49227, gc.lavoie@ et
  // chntlhbrd@, 444 jours). L'identité d'un fil, c'est son PREMIER expéditeur externe.
  const autresAdresses = [...emails].filter((a) => a !== email && !isSystemSender(a));

  // Fil INFUSIONNABLE. Deux cas, journalisés distinctement :
  //  - « trop étendu » : un fil qui couvre déjà plus de BLOB_DAYS. Souvent parfaitement
  //    légitime (un dossier repris un an plus tard), mais y coller quoi que ce soit
  //    produirait un fil encore plus large — donc jamais de fusion.
  //  - « agrégat » : trop de sujets distincts. C'est la signature d'une fusion abusive
  //    antérieure. Il porte désormais TOUTES les adresses et TOUS les numéros de commande
  //    du client : sans cette exclusion, il aimante de nouveaux fils à chaque run.
  const spanDays = (lastAt - firstAt) / DAY;
  let blob = null;
  if (BLOB_SUBJECTS && subjects.size > BLOB_SUBJECTS) blob = `agrégat : ${subjects.size} sujets distincts > ${BLOB_SUBJECTS}`;
  else if (BLOB_DAYS && spanDays > BLOB_DAYS) blob = `trop étendu : ${Math.round(spanDays)} j > ${BLOB_DAYS} j`;

  return { email, autresAdresses, name, orders: [...orders], subjects: [...subjects], firstAt, lastAt, blob };
}

// Écart, en jours, entre les périodes d'activité de deux fils (0 s'ils se chevauchent).
function gapDays(a, b) {
  if (a.lastAt >= b.firstAt && b.lastAt >= a.firstAt) return 0;
  const g = a.firstAt > b.lastAt ? a.firstAt - b.lastAt : b.firstAt - a.lastAt;
  return g / DAY;
}
const spanDaysOf = (list) =>
  (Math.max(...list.map((f) => f.lastAt)) - Math.min(...list.map((f) => f.firstAt))) / DAY;

const shareSubject = (a, b) => a.subjects.some((s) => s && b.subjects.includes(s));
const sharedOrders = (a, b) => a.orders.filter((o) => b.orders.includes(o));

/**
 * Deux fils sont-ils le même client ?
 *
 * ADRESSE IDENTIQUE = MÊME CLIENT, point. Aucune contrainte de temps : réunir un fil de
 * l'an dernier et un fil d'aujourd'hui du même client est voulu. C'est la règle de la boîte,
 * et c'est ce qui distingue la v2.1 de la v2.0 (qui exigeait aussi la proximité temporelle,
 * trop strictement).
 *
 * Le RESTE reste gardé, parce que c'est là que vivaient les vrais faux positifs : quand
 * seuls un NUMÉRO DE COMMANDE ou un NOM relient deux fils, rien ne prouve qu'il s'agisse du
 * même client. Deux cas réels mesurés dans la boîte : la commande L-42916 citée par
 * martine.gascon@ et far1090@ à 233 jours d'écart, et L-49227 citée par gc.lavoie@ et
 * chntlhbrd@ à 444 jours. Une commande transférée, un cadeau, une plainte relayée — et deux
 * clientes différentes se retrouvaient dans un même fil, irréversiblement.
 */
function isDuplicatePair(a, b) {
  const memeAdresse = a.email && b.email && a.email === b.email;
  const common = sharedOrders(a, b);
  const sameName = USE_NAME && a.name && b.name && a.name === b.name;

  // 1. Même adresse courriel : même client, on s'arrête là.
  if (memeAdresse) {
    return { ok: true, why: `même client (${a.email}), écart ${Math.round(gapDays(a, b))} j` };
  }

  if (common.length === 0 && !sameName) return { ok: false, why: "aucune empreinte commune" };

  // 2. Adresses DIFFÉRENTES. Le lien ne tient qu'à un numéro de commande (ou un nom) : il
  // faut alors que les deux fils soient un même épisode, sinon on soude deux clients.
  if (a.blob) return { ok: false, why: `fil infusionnable (${a.blob})` };
  if (b.blob) return { ok: false, why: `fil infusionnable (${b.blob})` };

  if (ORDER_CONFLICT && common.length === 0 && a.orders.length && b.orders.length) {
    return { ok: false, why: `adresses différentes, commandes disjointes (${a.orders.join(",")} vs ${b.orders.join(",")})` };
  }

  const span = spanDaysOf([a, b]);
  const spanMax = common.length > 0 ? MAX_SPAN_ORDER_DAYS : MAX_SPAN_DAYS;
  if (spanMax && span > spanMax) {
    return { ok: false, why: `adresses différentes, étendue ${Math.round(span)} j > ${spanMax} j` };
  }

  const proche = common.length > 0 || shareSubject(a, b);
  const limit = proche ? WINDOW_DAYS : TIGHT_WINDOW_DAYS;
  const gap = gapDays(a, b);
  if (gap > limit) {
    return { ok: false, why: `adresses différentes, écart ${Math.round(gap)} j > ${limit} j` };
  }

  const lien = [common.length ? `commande ${common.join(",")}` : "", sameName ? "nom" : ""].filter(Boolean).join("+");
  return { ok: true, why: `adresses différentes reliées par ${lien}, écart ${Math.round(gap)} j, étendue ${Math.round(span)} j` };
}
function hasMergeLabel(conv) {
  const labels = conv.shared_labels || conv.shared_label_ids || [];
  return labels.some((l) => (l && (l.id || l)) === LABEL);
}

// Pose/retrait de label SILENCIEUX via PATCH (aucun commentaire, aucune notification,
// pas de remontée du fil en haut de la boîte).
async function addLabel(conversationId) {
  return apiPatch(`/conversations/${conversationId}`, {
    conversations: [{ id: conversationId, organization: ORG, add_shared_labels: [LABEL] }],
  });
}

async function removeLabel(conversationId) {
  return apiPatch(`/conversations/${conversationId}`, {
    conversations: [{ id: conversationId, organization: ORG, remove_shared_labels: [LABEL] }],
  });
}

async function mergeInto(sourceId, targetId) {
  const r = await apiPost(`/conversations/${sourceId}/merge`, { target: targetId });
  const returnedId = r.json?.conversation?.id || r.json?.id || null;
  return { ok: r.ok, returnedId };
}


async function main() {
  console.log(`=== Lasclay merge.js ${VERSION} ===`);
  console.log(DRY_RUN ? "MODE SIMULATION (rien posé, rien fusionné)" : "MODE RÉEL");
  console.log(`Label : ${LABEL}`);
  console.log(`Empreintes actives : courriel, numéro de commande${USE_NAME ? ", nom" : " (nom désactivé)"}`);
  console.log(
    "Adresse identique = même client = doublon, sans contrainte de temps.\n" +
      `Garde-fous (adresses DIFFÉRENTES seulement) : fenêtre ${WINDOW_DAYS} j (${TIGHT_WINDOW_DAYS} j sans commande ni sujet commun) | ` +
      `étendue max ${MAX_SPAN_DAYS} j (${MAX_SPAN_ORDER_DAYS} j si commande commune) | ` +
      `groupe max ${MAX_GROUP} | agrégat > ${BLOB_DAYS} j ou > ${BLOB_SUBJECTS} sujets | ` +
      `conflit de commandes ${ORDER_CONFLICT ? "bloquant" : "ignoré"}`
  );
  console.log(`Phase : ${MERGE ? "2 (FUSION active)" : "1 (étiquetage seulement)"}`);
  if (MERGE) {
    console.log(`  MERGE_ONLY_EMAIL=${MERGE_ONLY_EMAIL} | MERGE_LIMIT=${MERGE_LIMIT || "illimité"}`);
  }

  const teams = resolveTeams();
  console.log(`Récupération des conversations (ouvertes${INCLUDE_CLOSED ? " + fermées récentes" : ""})...`);
  const { convs, allOk } = await collectOpenConversations(teams);
  const nbFermes = convs.filter((c) => c._closed).length;
  console.log(`${convs.length} conversation(s) unique(s) (dont ${nbFermes} fermée(s)).`);

  const fps = [];
  let i = 0;
  for (const c of convs) {
    i++;
    if (i % 50 === 0) console.log(`  ...${i}/${convs.length} analysées`);
    fps.push(await fingerprints(c));
  }

  const blobs = fps.filter((f) => f.blob);
  const agregats = blobs.filter((f) => f.blob.startsWith("agrégat"));
  if (blobs.length) {
    console.log(
      `${blobs.length} fil(s) exclu(s) du regroupement : ${agregats.length} agrégat(s) (fusion abusive antérieure) ` +
        `+ ${blobs.length - agregats.length} fil(s) trop étendu(s) (> ${BLOB_DAYS} j).`
    );
    for (const f of agregats) console.log(`     • agrégat : ${f.subjects.slice(0, 6).join(" | ")}`);
  }

  // --- Regroupement : union-find sur les PAIRES VALIDÉES, jamais sur une clé brute. ---
  const parent = convs.map((_, idx) => idx);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // Index des candidats : deux fils ne sont comparés que s'ils partagent au moins une clé.
  const buckets = new Map();
  const push = (key, idx) => {
    if (!key) return;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(idx);
  };
  fps.forEach((fp, idx) => {
    if (fp.email) push(`email:${fp.email}`, idx);
    // Les clés faibles (nom, numéro de commande) ne servent pas à un fil-agrégat : c'est par
    // elles qu'il aimanterait un client étranger.
    if (fp.blob) return;
    if (USE_NAME && fp.name) push(`name:${fp.name}`, idx);
    for (const o of fp.orders) push(`order:${o}`, idx);
  });

  const verdicts = new Map(); // "i|j" → {ok, why}
  const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const verdict = (a, b) => {
    const k = pairKey(a, b);
    if (!verdicts.has(k)) verdicts.set(k, isDuplicatePair(fps[a], fps[b]));
    return verdicts.get(k);
  };

  const rejets = [];
  for (const idxs of buckets.values()) {
    const uniq = [...new Set(idxs)];
    for (let x = 0; x < uniq.length; x++) {
      for (let y = x + 1; y < uniq.length; y++) {
        const v = verdict(uniq[x], uniq[y]);
        if (v.ok) union(uniq[x], uniq[y]);
        else if (EXPLAIN) rejets.push([uniq[x], uniq[y], v.why]);
      }
    }
  }

  const groups = new Map();
  convs.forEach((_, idx) => {
    const root = find(idx);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(idx);
  });

  // --- Validation au niveau du GROUPE : la transitivité de l'union-find peut souder
  // A et C via B alors que A et C n'ont rien à voir. Un groupe trop gros ou trop étalé
  // est SIGNALÉ, jamais étiqueté ni fusionné. ---
  // Un groupe MONO-CLIENT (une adresse commune à tous ses fils) échappe aux plafonds : c'est
  // un client fidèle, ses fils lui appartiennent tous, peu importe combien et sur quelle durée.
  const monoClient = (g) => {
    const e = fps[g[0]].email;
    return !!e && g.every((idx) => fps[idx].email === e);
  };

  const dupes = [];
  const suspects = [];
  for (const g of [...groups.values()].filter((g) => g.length >= 2)) {
    if (monoClient(g)) {
      dupes.push(g);
      continue;
    }
    const span = spanDaysOf(g.map((idx) => fps[idx]));
    if (MAX_GROUP && g.length > MAX_GROUP) {
      suspects.push([g, `${g.length} fils d'adresses différentes > ${MAX_GROUP} (chaîne probable)`]);
      continue;
    }
    const partageCommande = g.some((x) => g.some((y) => x !== y && sharedOrders(fps[x], fps[y]).length));
    const spanMax = partageCommande ? MAX_SPAN_ORDER_DAYS : MAX_SPAN_DAYS;
    if (spanMax && span > spanMax) {
      suspects.push([g, `adresses différentes, étendue du groupe ${Math.round(span)} j > ${spanMax} j`]);
      continue;
    }
    dupes.push(g);
  }

  const decrire = (idx) => {
    const c = convs[idx];
    const f = fps[idx];
    return `     • ${iso(f.firstAt)}→${iso(f.lastAt)}  ${c._closed ? "[fermé] " : ""}${JSON.stringify(c.subject || "(sans sujet)")}  ${f.email || "?"}${f.orders.length ? "  " + f.orders.join(",") : ""}`;
  };

  const shouldLabel = new Set();
  for (const g of dupes) for (const idx of g) shouldLabel.add(convs[idx].id);

  console.log(`\n${dupes.length} groupe(s) en doublon retenu(s) :`);
  for (const g of dupes) {
    const emails = new Set(g.map((idx) => fps[idx].email).filter(Boolean));
    const orders = new Set(g.flatMap((idx) => fps[idx].orders));
    const parEmail = emails.size === 1 && g.every((idx) => fps[idx].email);
    console.log(
      `  ${g.length} fils ${parEmail ? "[email]" : "[commande]"} — étendue ${Math.round(spanDaysOf(g.map((idx) => fps[idx])))} j` +
        `${emails.size ? `  •  ${[...emails].join(", ")}` : ""}${orders.size ? `  •  ${[...orders].join(", ")}` : ""}`
    );
    for (const idx of g) console.log(decrire(idx));
  }

  if (suspects.length) {
    console.log(`\n${suspects.length} groupe(s) SIGNALÉ(S) mais NON traité(s) (ni label, ni fusion) :`);
    for (const [g, why] of suspects) {
      console.log(`  ${g.length} fils — ${why}`);
      for (const idx of g) console.log(decrire(idx));
    }
  }

  if (EXPLAIN && rejets.length) {
    console.log(`\n${rejets.length} paire(s) écartée(s) (empreinte commune, mais pas le même épisode) :`);
    for (const [a, b, why] of rejets.slice(0, 40)) {
      console.log(`  ${why}`);
      console.log(decrire(a));
      console.log(decrire(b));
    }
    if (rejets.length > 40) console.log(`  ... et ${rejets.length - 40} autre(s).`);
  }

  // Phase 1 : pose des labels sur les doublons.
  let posed = 0;
  let retires = 0;

  for (const g of dupes) {
    for (const idx of g) {
      const conv = convs[idx];
      if (conv._closed) continue; // JAMAIS d'écriture sur un fil fermé (il n'a servi qu'à la détection)
      if (hasMergeLabel(conv)) continue;
      if (DRY_RUN) {
        posed++;
        continue;
      }
      const r = await addLabel(conv.id);
      if (r.ok) posed++;
    }
  }

  // Nettoyage : retire « À fusionner » de TOUT fil qui le porte mais n'est plus
  // un doublon client valide. C'est ce qui répare les faux positifs des versions
  // antérieures : au premier run v2.0, les labels posés à tort tombent d'eux-mêmes.
  // (Les fils déjà DÉPLACÉS dans la boîte MERGE, eux, se renvoient avec
  // repartition_merge.js — le label seul ne les ramène pas.)
  // Sauté si une boîte n'a pas pu être lue (données incomplètes = risque de retrait à tort).
  if (!allOk) {
    console.warn("\nUne boîte n'a pas pu être lue : nettoyage des labels orphelins sauté ce run (prudence).");
  } else {
    try {
      let until = null;
      const toClean = [];
      while (true) {
        let path = `/conversations?shared_label=${LABEL}&limit=50`;
        if (until) path += `&until=${until}`;
        const { conversations = [] } = await api(path);
        if (conversations.length === 0) break;
        for (const c of conversations) {
          if (!shouldLabel.has(c.id)) toClean.push(c.id);
        }
        const oldest = conversations[conversations.length - 1].last_activity_at;
        if (conversations.length < 50 || oldest === until) break;
        until = oldest;
      }
      for (const id of toClean) {
        if (DRY_RUN) {
          retires++;
          continue;
        }
        const r = await removeLabel(id);
        if (r.ok) retires++;
      }
    } catch (e) {
      console.warn(`Nettoyage des labels orphelins ignoré (${e.message}).`);
    }
  }

  console.log(
    `\nÉtiquetage : ${posed} label(s) ${DRY_RUN ? "à poser" : "posé(s)"}, ` +
      `${retires} ${DRY_RUN ? "à retirer" : "retiré(s)"}.`
  );

  if (!MERGE) {
    console.log("\nPhase 1 seulement (MERGE absent/false). Aucune fusion.");
    console.log("Run terminé.");
    return;
  }

  console.log("\n=== Phase 2 : fusion ===");
  console.log("  Fils FERMÉS : exclus de la fusion (détection seulement).");
  let fusions = 0;
  for (const gAll of dupes) {
    // Fusion sur les fils OUVERTS seulement. Un fil fermé a servi à repérer le groupe ; on n'y
    // touche pas. Un groupe qui n'a plus qu'un fil ouvert n'a donc rien à fusionner.
    const g = gAll.filter((idx) => !convs[idx]._closed);
    if (g.length < 2) {
      if (gAll.length >= 2) console.log(`  Groupe non fusionné (moins de 2 fils ouverts) : étiqueté seulement.`);
      continue;
    }
    if (MERGE_LIMIT && fusions >= MERGE_LIMIT) {
      console.log(`Plafond MERGE_LIMIT=${MERGE_LIMIT} atteint, arrêt des fusions.`);
      break;
    }
    const emails = new Set(g.map((idx) => fps[idx].email).filter(Boolean));
    const parEmail = emails.size === 1 && g.every((idx) => fps[idx].email);
    if (MERGE_ONLY_EMAIL && !parEmail) {
      console.log(`  Groupe non fusionné (relié par nom/commande, pas par courriel exact) : étiqueté seulement.`);
      continue;
    }

    // CLIQUE obligatoire : la fusion est irréversible, elle ne se contente pas de la
    // transitivité. Chaque paire du groupe doit tenir par elle-même.
    let clique = true;
    let pourquoiPas = "";
    for (let x = 0; x < g.length && clique; x++) {
      for (let y = x + 1; y < g.length; y++) {
        const v = verdict(g[x], g[y]);
        if (!v.ok) {
          clique = false;
          pourquoiPas = v.why;
          break;
        }
      }
    }
    if (!clique) {
      console.log(`  Groupe non fusionné (pas une clique : ${pourquoiPas}) : étiqueté seulement.`);
      for (const idx of g) console.log(decrire(idx));
      continue;
    }

    // Survivant : le fil ouvert le plus récent, pour que le résultat reste actif dans la boîte.
    const ordered = g.slice().sort((a, b) => (convs[b].last_activity_at || 0) - (convs[a].last_activity_at || 0));
    const survivor = convs[ordered[0]];
    const sources = ordered.slice(1).map((idx) => convs[idx]);

    for (const src of sources) {
      if (MERGE_LIMIT && fusions >= MERGE_LIMIT) break;
      if (src._closed || survivor._closed) continue; // ceinture ET bretelles
      if (DRY_RUN) {
        console.log(`  [SIMULATION] fusionner ${src.id} → ${survivor.id}`);
        fusions++;
        continue;
      }
      const r = await mergeInto(src.id, survivor.id);
      if (r.ok) {
        fusions++;
        console.log(`  fusionné ${src.id} → ${survivor.id} (id résultant: ${r.returnedId || "?"})`);
      } else {
        console.error(`  échec fusion ${src.id} → ${survivor.id}`);
      }
    }
  }
  console.log(`\nFusion : ${fusions} ${DRY_RUN ? "simulée(s)" : "exécutée(s)"}.`);
  console.log("Run terminé.");
}

// Exécuté directement = on lance le run. Requis par un test = on n'expose que les
// fonctions pures (les règles de doublon se testent sans toucher à la boîte).
if (require.main === module) {
  main().catch((e) => {
    console.error("Erreur :", e.message);
    process.exit(1);
  });
} else {
  module.exports = {
    VERSION,
    isDuplicatePair,
    baseSubject,
    unquoted,
    plainText,
    extractOrders,
    gapDays,
    spanDaysOf,
    isSystemSender,
    isSelfAddress,
  };
}
