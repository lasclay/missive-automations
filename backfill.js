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
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36"; // Lasclay
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false";
// Mode "lister les équipes" : affiche les ID/noms puis quitte. Mets LIST_TEAMS=true.
const LIST_TEAMS = (process.env.LIST_TEAMS || "").toLowerCase() === "true";
// Filtre : IDs d'équipes à ratisser. Par défaut, les 7 boîtes clients de Lasclay.
// (Tu peux surcharger via la variable MISSIVE_TEAMS si besoin un jour.)
const DEFAULT_TEAMS = [
  "e184d153-4472-4edd-9b35-f8867cf437a8", // LAS Support
  "d6f28d2f-06ef-4aa5-aae0-b68f014e3216", // Vente - info pré-achat
  "9240aa4e-3e81-40aa-a07a-84f6b1c2231e", // Expéditions prioritaires
  "0db185c1-3a93-4a44-9f50-dcfe8c0683dd", // Mise à jour commande
  "cc587c84-63b9-4e88-993c-4f4b5b328173", // RETOURS-ÉCHANGES
  "13d8a7bd-ed2e-4e0c-8cf3-2329ebaed217", // USA
  "1c57f5cd-3877-4067-b6d4-8344c5d29af9", // APM
];
const ENV_TEAMS = (process.env.MISSIVE_TEAMS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const TEAMS = ENV_TEAMS.length > 0 ? ENV_TEAMS : DEFAULT_TEAMS;
const SELF = (process.env.MISSIVE_SELF_ADDRESSES || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Noms de TES propres pages/comptes sociaux, à ne JAMAIS prendre pour un client.
// (Sur Messenger/Instagram l'expéditeur est un nom de page, pas une adresse.)
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
// On normalise pour comparer (minuscules, sans accents, espaces compactés).
const norm = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // enlève les accents
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const SELF_NAMES = new Set(
  (ENV_SELF_NAMES.length > 0 ? ENV_SELF_NAMES : DEFAULT_SELF_NAMES).map(norm)
);

// Numéro de commande Lasclay : L-XXXXX (insensible à la casse, 4 à 6 chiffres).
const ORDER_RE = /\bL-\d{4,6}\b/gi;

const API = "https://public.missiveapp.com/v1";
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (!TOKEN) {
  console.error("Manque MISSIVE_TOKEN.");
  process.exit(1);
}
// En mode liste d'équipes, on n'a besoin que du token.
if (!LIST_TEAMS && !LABEL) {
  console.error("Manque MISSIVE_LABEL_ID.");
  process.exit(1);
}
if (!LIST_TEAMS && SELF.length === 0) {
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

// Liste les équipes (ID + nom) pour t'aider à choisir lesquelles ratisser.
async function listTeams() {
  const data = await api(`/teams`);
  const teams = data.teams || data || [];
  console.log("\n=== Tes équipes ===");
  for (const t of teams) {
    console.log(`  ${t.id}  →  ${t.name || t.organization || "(sans nom)"}`);
  }
  console.log(
    "\nCopie les ID voulus dans la variable MISSIVE_TEAMS (séparés par des virgules)."
  );
}

// Parcourt une boîte (un team_inbox précis, ou l'Inbox globale) et empile dans la Map.
async function paginateInto(byId, baseFilter) {
  let until = null;
  let pages = 0;
  const limit = 50;
  while (true) {
    let path = `/conversations?${baseFilter}&limit=${limit}`;
    if (ACCOUNT) path += `&account=${ACCOUNT}`;
    if (until) path += `&until=${until}`;

    const { conversations = [] } = await api(path);
    if (conversations.length === 0) break;
    pages++;
    for (const c of conversations) byId.set(c.id, c); // dédoublonnage par ID

    const oldest = conversations[conversations.length - 1].last_activity_at;
    if (conversations.length < limit || oldest === until) break;
    until = oldest;
  }
  return pages;
}

// 1) Récupère les conversations ouvertes. Si MISSIVE_TEAMS est fourni, on se limite
//    à ces équipes (un passage chacune); sinon on prend l'Inbox globale du token.
async function listOpenConversations() {
  const byId = new Map();
  let pages = 0;
  if (TEAMS.length > 0) {
    for (const teamId of TEAMS) {
      pages += await paginateInto(byId, `team_inbox=${teamId}`);
    }
    console.log(`(${TEAMS.length} équipe(s), ${pages} pages, ${byId.size} conversations uniques)`);
  } else {
    pages = await paginateInto(byId, `inbox=true`);
    console.log(`(toutes les boîtes, ${pages} pages, ${byId.size} conversations uniques)`);
  }
  return [...byId.values()];
}

// 2) Extrait les "empreintes" d'un fil servant à le relier à d'autres :
//    - email   : adresse de l'expéditeur externe
//    - name    : nom d'affichage de l'expéditeur externe (normalisé)
//    - orders  : ensemble des numéros L-XXXXX trouvés dans le sujet + les corps
function extractOrders(text) {
  const found = (text || "").match(ORDER_RE) || [];
  return found.map((s) => s.toUpperCase()); // L-50234 canonique
}

async function fingerprints(conv) {
  const { messages = [] } = await api(`/conversations/${conv.id}/messages?limit=10`);
  const sorted = messages
    .slice()
    .sort((a, b) => (a.delivered_at || a.created_at || 0) - (b.delivered_at || b.created_at || 0));

  let email = null;
  let name = null;
  const orders = new Set();

  // Numéros de commande : on cherche partout (sujet du fil + corps de chaque message)
  for (const o of extractOrders(conv.subject)) orders.add(o);

  for (const m of sorted) {
    for (const o of extractOrders(m.body || m.preview)) orders.add(o);
    for (const o of extractOrders(m.subject)) orders.add(o);

    const addr = m.from_field?.address?.toLowerCase() || null;
    const dispName = norm(m.from_field?.name);
    const isSelf = (addr && SELF.includes(addr)) || (dispName && SELF_NAMES.has(dispName));
    if (isSelf) continue; // c'est nous (courriel ou page sociale) → on ignore

    // 1er expéditeur externe rencontré = le client
    if (!email && addr) email = addr;
    if (!name && dispName) name = dispName;
  }

  return { email, name, orders: [...orders] };
}



async function main() {
  // Mode "liste des équipes" : affiche les ID/noms et s'arrête là.
  if (LIST_TEAMS) {
    await listTeams();
    return;
  }

  console.log(DRY_RUN ? "=== MODE SIMULATION (rien n'est modifié) ===" : "=== MODE RÉEL ===");

  console.log("Récupération des conversations ouvertes...");
  const convs = await listOpenConversations();
  console.log(`${convs.length} conversations ouvertes trouvées.`);

  // Calcule les empreintes de chaque fil
  const fps = []; // index aligné avec convs : { email, name, orders }
  let i = 0;
  for (const c of convs) {
    i++;
    if (i % 25 === 0) console.log(`  ...${i}/${convs.length} analysées`);
    fps.push(await fingerprints(c));
  }

  // Union-Find : on relie les fils qui partagent une empreinte
  const parent = convs.map((_, idx) => idx);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // Pour chaque type d'empreinte, on regroupe les index qui la partagent
  const link = (keyFn) => {
    const seen = new Map(); // valeur d'empreinte -> 1er index vu
    fps.forEach((fp, idx) => {
      for (const key of keyFn(fp)) {
        if (!key) continue;
        if (seen.has(key)) union(seen.get(key), idx);
        else seen.set(key, idx);
      }
    });
  };
  link((fp) => (fp.email ? [`email:${fp.email}`] : []));
  link((fp) => (fp.name ? [`name:${fp.name}`] : []));
  link((fp) => fp.orders.map((o) => `order:${o}`));

  // Rassemble les fils par groupe (racine union-find)
  const groups = new Map(); // racine -> [index]
  convs.forEach((_, idx) => {
    const root = find(idx);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(idx);
  });

  // Garde les groupes de 2 fils ou plus
  const dupes = [...groups.values()].filter((g) => g.length >= 2);

  console.log(`\n${dupes.length} groupe(s) en doublon :`);
  for (const g of dupes) {
    // Empreintes communes du groupe, pour que tu puisses juger
    const emails = new Set(g.map((idx) => fps[idx].email).filter(Boolean));
    const names = new Set(g.map((idx) => fps[idx].name).filter(Boolean));
    const orders = new Set(g.flatMap((idx) => fps[idx].orders));
    const desc = [
      emails.size ? `courriels: ${[...emails].join(", ")}` : "",
      names.size ? `noms: ${[...names].join(" | ")}` : "",
      orders.size ? `commandes: ${[...orders].join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("  •  ");
    console.log(`  ${g.length} fils → ${desc}`);
  }

  if (DRY_RUN) {
    console.log("\nSimulation terminée. Aucun label posé.");
    console.log("Pour appliquer pour de vrai, relance avec DRY_RUN=false.");
    return;
  }

  console.log("\nApplication des labels...");
  const org = await resolveOrganization();
  console.log(`Organisation : ${org}`);
  let labeled = 0;
  for (const g of dupes) {
    for (const idx of g) {
      await applyLabel(convs[idx].id, org);
      labeled++;
    }
  }
  console.log(`Terminé. ${labeled} conversations étiquetées « À fusionner ».`);
}

main().catch((e) => {
  console.error("Erreur :", e.message);
  process.exit(1);
});
