/**
 * Missive — Backfill : étiqueter les doublons DÉJÀ présents
 * --------------------------------------------------------
 * À lancer UNE fois (puis le webhook s'occupe du futur).
 * Il parcourt les conversations ouvertes de la boîte de réception,
 * identifie l'expéditeur EXTERNE de chaque fil, regroupe par expéditeur,
 * et applique le label "À fusionner" à tous les fils d'un expéditeur qui
 * en a 2 ou plus.
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN           ton token API (missive_pat-...)
 *   MISSIVE_LABEL_ID        l'ID du label d'ORGANISATION "À fusionner"
 *   MISSIVE_SELF_ADDRESSES  TES adresses, séparées par des virgules, à NE PAS
 *                           traiter comme des clients.
 *                           ex: "info@laclay.com,ventes@laclay.com"
 *   MISSIVE_ACCOUNT         (optionnel) ID du compte partagé à cibler
 *   DRY_RUN                 "true" (défaut) = simulation, n'étiquette rien.
 *                           Mets "false" pour appliquer pour de vrai.
 *
 * Exemple (simulation d'abord) :
 *   MISSIVE_TOKEN=... MISSIVE_LABEL_ID=... \
 *   MISSIVE_SELF_ADDRESSES="info@laclay.com" node backfill.js
 *
 * Puis, une fois la liste vérifiée, pour appliquer :
 *   DRY_RUN=false MISSIVE_TOKEN=... ... node backfill.js
 */

const TOKEN = process.env.MISSIVE_TOKEN;
const LABEL = process.env.MISSIVE_LABEL_ID;
const ACCOUNT = process.env.MISSIVE_ACCOUNT || "";
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false";
const SELF = (process.env.MISSIVE_SELF_ADDRESSES || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const API = "https://public.missiveapp.com/v1";
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (!TOKEN || !LABEL) {
  console.error("Manque MISSIVE_TOKEN ou MISSIVE_LABEL_ID.");
  process.exit(1);
}
if (SELF.length === 0) {
  console.error("Manque MISSIVE_SELF_ADDRESSES (tes propres adresses, séparées par des virgules).");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Petit wrapper qui respecte la limite de débit (~4 appels/sec, < 300/min)
async function api(path) {
  await sleep(260);
  const res = await fetch(`${API}${path}`, { headers });
  if (res.status === 429) {
    console.warn("Limite de débit atteinte, pause 30 s...");
    await sleep(30000);
    return api(path);
  }
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

// 1) Parcourt toutes les conversations ouvertes (Inbox), page par page.
//    Les pages se CHEVAUCHENT aux frontières (l'API peut renvoyer plus que la
//    limite et pagine sur l'horodatage), donc on dédoublonne par ID via une Map.
async function listOpenConversations() {
  const byId = new Map(); // id -> conversation (dédoublonnage)
  let until = null;
  let pages = 0;
  const limit = 50;
  while (true) {
    let path = `/conversations?inbox=true&limit=${limit}`;
    if (ACCOUNT) path += `&account=${ACCOUNT}`;
    if (until) path += `&until=${until}`;

    const { conversations = [] } = await api(path);
    if (conversations.length === 0) break;
    pages++;

    for (const c of conversations) byId.set(c.id, c); // écrase les doublons

    const oldest = conversations[conversations.length - 1].last_activity_at;
    if (conversations.length < limit || oldest === until) break; // dernière page
    until = oldest;
  }
  console.log(`(${pages} pages parcourues, ${byId.size} conversations uniques)`);
  return [...byId.values()];
}

// 2) Trouve l'expéditeur EXTERNE d'un fil (1re adresse qui n'est pas une des tiennes)
async function externalSender(conversationId) {
  const { messages = [] } = await api(`/conversations/${conversationId}/messages?limit=10`);
  // du plus ancien au plus récent
  const sorted = messages
    .slice()
    .sort((a, b) => (a.delivered_at || a.created_at || 0) - (b.delivered_at || b.created_at || 0));
  for (const m of sorted) {
    const addr = m.from_field?.address?.toLowerCase();
    if (addr && !SELF.includes(addr)) return addr;
  }
  return null; // aucun expéditeur externe (fil purement interne)
}

// 3) Applique le label sur un fil
async function applyLabel(conversationId) {
  const body = {
    posts: {
      conversation: conversationId,
      add_shared_labels: [LABEL],
      text: "⚠️ Doublon détecté lors du balayage initial — à fusionner.",
    },
  };
  await sleep(260);
  const res = await fetch(`${API}/posts`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) console.error(`Label échoué sur ${conversationId}: ${res.status} ${await res.text()}`);
}

async function main() {
  console.log(DRY_RUN ? "=== MODE SIMULATION (rien n'est modifié) ===" : "=== MODE RÉEL ===");

  console.log("Récupération des conversations ouvertes...");
  const convs = await listOpenConversations();
  console.log(`${convs.length} conversations ouvertes trouvées.`);

  // Regroupe par expéditeur externe
  const bySender = new Map(); // email -> [ids]
  let i = 0;
  for (const c of convs) {
    i++;
    if (i % 25 === 0) console.log(`  ...${i}/${convs.length} analysées`);
    const sender = await externalSender(c.id);
    if (!sender) continue;
    if (!bySender.has(sender)) bySender.set(sender, []);
    bySender.get(sender).push(c.id);
  }

  // Garde seulement les expéditeurs avec 2 fils ouverts ou plus
  const dupes = [...bySender.entries()].filter(([, ids]) => ids.length >= 2);

  console.log(`\n${dupes.length} expéditeur(s) en doublon :`);
  for (const [sender, ids] of dupes) {
    console.log(`  ${sender} → ${ids.length} fils`);
  }

  if (DRY_RUN) {
    console.log("\nSimulation terminée. Aucun label posé.");
    console.log("Pour appliquer pour de vrai, relance avec DRY_RUN=false.");
    return;
  }

  console.log("\nApplication des labels...");
  let labeled = 0;
  for (const [, ids] of dupes) {
    for (const id of ids) {
      await applyLabel(id);
      labeled++;
    }
  }
  console.log(`Terminé. ${labeled} conversations étiquetées « À fusionner ».`);
}

main().catch((e) => {
  console.error("Erreur :", e.message);
  process.exit(1);
});
