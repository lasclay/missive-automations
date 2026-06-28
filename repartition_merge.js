/**
 * Missive — repartition_merge.js (v1)
 * --------------------------------------------------------------------------
 * Vide la boîte d'équipe MERGE en renvoyant chaque fil dans le bon inbox.
 *
 * Routage, dans l'ordre de priorité :
 *   1. LABEL d'override  → équipe dédiée (ex. label « Helpers » → boîte Helpers).
 *   2. Sinon, ADRESSE DE RÉCEPTION du dernier message entrant :
 *        admin@lasclay.com      → Lasclay Admin
 *        operations@lasclay.com → LAS Operations
 *        hey@lasclay.com        → LAS Support
 *   3. Sinon → NON ROUTÉ : laissé dans MERGE et journalisé (jamais déplacé au hasard).
 *
 * ATTENTION : le déplacement (add_to_team_inbox) est tiré de la doc Missive et
 * n'a JAMAIS été exécuté chez Lasclay. DRY_RUN=true par défaut. Premier vrai run :
 * LIMIT=1, vérifier dans Missive que le fil arrive dans la bonne boîte ET quitte
 * MERGE, avant tout lot.
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN   token API (missive_pat-...)                        [requis]
 *   MISSIVE_ORG     id d'organisation (défaut Lasclay)              [facultatif]
 *   DRY_RUN         "false" pour agir. DÉFAUT "true" (simulation).
 *   LIMIT           nombre max de fils déplacés par run (0 = illimité). Défaut 0.
 *   MOVE_CLOSED     "true" pour inclure les fils FERMÉS de MERGE. Défaut false
 *                   (ouverts seulement, pour ne pas inonder les inbox).
 *   STRIP_LABEL     "false" pour garder « À fusionner ». Défaut true (on le retire).
 *   MERGE_TEAM_ID   override de l'id de la boîte MERGE (sinon résolu via /teams).
 */

const VERSION = "v1";

const TOKEN = process.env.MISSIVE_TOKEN;
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36"; // Lasclay
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false"; // défaut: simulation
const LIMIT = parseInt(process.env.LIMIT || "0", 10) || 0;
const MOVE_CLOSED = (process.env.MOVE_CLOSED || "").toLowerCase() === "true";
const STRIP_LABEL = (process.env.STRIP_LABEL || "true").toLowerCase() !== "false";
const MERGE_LABEL = "7c922a57-5644-4d88-b731-5a040cbb681a"; // « À fusionner »

// --- Équipes (ids confirmés par les logs de production) ---
const TEAM = {
  SUPPORT: "e184d153-4472-4edd-9b35-f8867cf437a8",
  ADMIN: "a6c74be0-2a27-4c79-9294-a74b447e6dc0",
  OPERATIONS: "7c925f0d-3eca-4535-be20-424078619cef",
  HELPERS: "9deb87bb-c321-4134-98d0-7b184125939a",
};

// --- Routage par adresse de réception ---
const RECEIVING_MAP = {
  "admin@lasclay.com": { team: TEAM.ADMIN, name: "Lasclay Admin" },
  "operations@lasclay.com": { team: TEAM.OPERATIONS, name: "LAS Operations" },
  "hey@lasclay.com": { team: TEAM.SUPPORT, name: "LAS Support" },
};
const OUR_ADDRESSES = new Set(Object.keys(RECEIVING_MAP));

// --- Override par label (PRIORITAIRE sur l'adresse) ---
// Renseigne ici les labels qui forcent une destination. Match par NOM normalisé
// (ou par id si tu préfères). Seed : le label « Helpers » → boîte Helpers.
// Ajoute des lignes au besoin : { match: "nom du label", team: TEAM.XXX, name: "..." }
const OVERRIDE_LABELS = [
  { match: "helpers", team: TEAM.HELPERS, name: "Helpers" },
];

const API = "https://public.missiveapp.com/v1";
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (!TOKEN) {
  console.error("Manque MISSIVE_TOKEN.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const norm = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

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
  const text = await res.text();
  if (!res.ok) console.error(`POST ${path} → ${res.status} ${text}`);
  return { ok: res.ok, status: res.status, text };
}

// Résout l'id de la boîte MERGE (sinon override par MERGE_TEAM_ID).
async function resolveMergeTeam() {
  if (process.env.MERGE_TEAM_ID) return process.env.MERGE_TEAM_ID;
  const data = await api(`/teams`);
  const all = data.teams || data || [];
  const merge = all.find((t) => norm(t.name) === "merge");
  if (!merge) throw new Error("Équipe « MERGE » introuvable via /teams. Fournis MERGE_TEAM_ID.");
  return merge.id;
}

// Liste les fils d'un inbox (ouverts via team_inbox, fermés via team_closed).
async function listTeam(filter, teamId) {
  const byId = new Map();
  let until = null;
  while (true) {
    let path = `/conversations?${filter}=${teamId}&limit=50`;
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

// Labels d'un fil (id + nom normalisé), depuis l'objet liste.
function convLabels(conv) {
  const labels = conv.shared_labels || [];
  return labels.map((l) => ({
    id: l.id || (typeof l === "string" ? l : null),
    name: norm(l.name),
  }));
}

// Override par label : retourne la 1re destination dont le label est présent.
function overrideFor(conv) {
  const labels = convLabels(conv);
  for (const ov of OVERRIDE_LABELS) {
    const hit = labels.some((l) => l.name === norm(ov.match) || l.id === ov.match);
    if (hit) return ov;
  }
  return null;
}

// Adresse de réception : le « to/cc » à nous du message ENTRANT le plus récent.
async function receivingAddress(convId) {
  const { messages = [] } = await api(`/conversations/${convId}/messages?limit=10`);
  const sorted = messages
    .slice()
    .sort((a, b) => (b.delivered_at || b.created_at || 0) - (a.delivered_at || a.created_at || 0));
  const seen = new Set();
  let pick = null;
  for (const m of sorted) {
    const from = m.from_field?.address?.toLowerCase();
    const inbound = from && !OUR_ADDRESSES.has(from); // expéditeur externe = message entrant
    if (!inbound) continue;
    const tos = [...(m.to_fields || []), ...(m.cc_fields || [])]
      .map((f) => f.address?.toLowerCase())
      .filter(Boolean);
    const hit = tos.find((a) => OUR_ADDRESSES.has(a));
    if (hit) {
      if (!pick) pick = hit; // le plus récent gagne
      seen.add(hit);
    }
  }
  return { address: pick, ambiguous: seen.size > 1, candidates: [...seen] };
}

// Déplace un fil vers une équipe + retire « À fusionner ».
// NOTE : add_to_team_inbox est tiré de la doc, jamais exécuté chez Lasclay.
async function moveTo(convId, teamId) {
  const post = {
    conversation: convId,
    organization: ORG,
    add_to_team_inbox: true,
    team: teamId,
    reopen: true,
    notification: { title: "Réparti depuis MERGE", body: "Fil renvoyé dans sa boîte." },
    text: "↪️ Fil réparti depuis MERGE vers sa boîte d'origine.",
  };
  if (STRIP_LABEL) post.remove_shared_labels = [MERGE_LABEL];
  return apiPost(`/posts`, { posts: post });
}

async function main() {
  console.log(`=== Lasclay repartition_merge.js ${VERSION} ===`);
  console.log(DRY_RUN ? "MODE SIMULATION (rien déplacé)" : "MODE RÉEL");
  console.log(`Fils fermés inclus : ${MOVE_CLOSED ? "oui" : "non"} | Retrait « À fusionner » : ${STRIP_LABEL ? "oui" : "non"} | LIMIT : ${LIMIT || "illimité"}`);

  const mergeId = await resolveMergeTeam();
  console.log(`Boîte MERGE : ${mergeId}`);

  let convs = await listTeam("team_inbox", mergeId);
  if (MOVE_CLOSED) {
    const closed = await listTeam("team_closed", mergeId);
    const byId = new Map(convs.map((c) => [c.id, c]));
    for (const c of closed) byId.set(c.id, c);
    convs = [...byId.values()];
  }
  console.log(`${convs.length} fil(s) dans MERGE à traiter.\n`);

  const plan = []; // { conv, target, reason }
  const unrouted = [];

  for (const conv of convs) {
    const ov = overrideFor(conv);
    if (ov) {
      plan.push({ conv, team: ov.team, reason: `label « ${ov.name} »` });
      continue;
    }
    const { address, ambiguous, candidates } = await receivingAddress(conv.id);
    if (address && RECEIVING_MAP[address]) {
      const dest = RECEIVING_MAP[address];
      const note = ambiguous ? ` (ambigu: ${candidates.join(", ")}, on prend le plus récent)` : "";
      plan.push({ conv, team: dest.team, reason: `reçu à ${address} → ${dest.name}${note}` });
    } else {
      unrouted.push(conv);
    }
  }

  // Aperçu du plan
  for (const p of plan) {
    console.log(`  ${p.conv.id}  [${p.reason}]  ${(p.conv.subject || "(sans sujet)").slice(0, 60)}`);
  }
  if (unrouted.length) {
    console.log(`\n${unrouted.length} fil(s) NON ROUTÉ(S) (laissés dans MERGE) :`);
    for (const c of unrouted) {
      console.log(`  ${c.id}  ${(c.subject || "(sans sujet)").slice(0, 60)}`);
    }
  }

  // Exécution
  console.log(`\n${plan.length} fil(s) à déplacer, ${unrouted.length} laissé(s).`);
  let done = 0;
  for (const p of plan) {
    if (LIMIT && done >= LIMIT) {
      console.log(`Plafond LIMIT=${LIMIT} atteint, arrêt.`);
      break;
    }
    if (DRY_RUN) {
      done++;
      continue;
    }
    const r = await moveTo(p.conv.id, p.team);
    if (r.ok) done++;
  }
  console.log(`\n${done} fil(s) ${DRY_RUN ? "à déplacer (simulation)" : "déplacé(s)"}.`);
  console.log("Run terminé.");
}

main().catch((e) => {
  console.error("Erreur :", e.message);
  process.exit(1);
});
