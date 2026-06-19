/**
 * Lasclay — refresh.js
 * --------------------
 * Rafraîchissement léger: retire le label « Draft AI Support » des fils FERMÉS
 * des 7 équipes de support. C'est exactement l'étape de rafraîchissement de support.js,
 * extraite pour pouvoir tourner SOUVENT (ex.: chaque heure) sans appeler Sonnet.
 *
 * Pourquoi: un fil fermé garde son label. Quand le client relance, le fil rouvre; si le
 * label est encore là, support.js le saute (il croit qu'un brouillon existe déjà) et
 * aucune réponse n'est régénérée. En retirant le label dès la fermeture, on garde la
 * boucle propre: à la prochaine activité du client, support.js retraite le fil.
 *
 * GRATUIT (aucun appel Sonnet). Idempotent: repasser ne fait que retirer ce qui reste.
 *
 * Node 18+. Aucune dépendance.
 * Variables: MISSIVE_TOKEN (requis), DRY_RUN, DRAFT_LABEL, TEAMS, MISSIVE_ORG.
 */

const TOKEN = process.env.MISSIVE_TOKEN;
const DRY_RUN = (process.env.DRY_RUN || "false").toLowerCase() === "true";
const DRAFT_LABEL = process.env.DRAFT_LABEL || "019eb935-9b22-7d14-8aeb-614a1e303e24"; // « Draft AI Support »
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36";

const DEFAULT_TEAMS = [
  "e184d153-4472-4edd-9b35-f8867cf437a8", // LAS Support
  "cc587c84-63b9-4e88-993c-4f4b5b328173", // RETOURS-ÉCHANGES
  "d6f28d2f-06ef-4aa5-aae0-b68f014e3216", // Vente - info pré-achat
  "13d8a7bd-ed2e-4e0c-8cf3-2329ebaed217", // USA
  "9240aa4e-3e81-40aa-a07a-84f6b1c2231e", // Expéditions prioritaires
  "80ae6958-8266-4898-9d80-38851eb3ba69", // LAS R&D
  "0db185c1-3a93-4a44-9f50-dcfe8c0683dd", // Mise à jour commande (encore nettoyée même si support ne la traite plus)
];
const TEAMS = (process.env.TEAMS || "").split(",").map((s) => s.trim()).filter(Boolean);
const TEAM_IDS = TEAMS.length > 0 ? TEAMS : DEFAULT_TEAMS;

const API = "https://public.missiveapp.com/v1";
const mHeaders = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
if (!TOKEN) { console.error("Manque MISSIVE_TOKEN."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path) {
  let netTries = 0;
  while (true) {
    await sleep(260);
    let res;
    try { res = await fetch(`${API}${path}`, { headers: mHeaders }); }
    catch (e) { if (++netTries > 5) throw new Error(`${path} → réseau: ${e.message}`); await sleep(netTries * 10000); continue; }
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
    catch (e) { if (++netTries > 5) throw new Error(`${path} → réseau: ${e.message}`); await sleep(netTries * 10000); continue; }
    if (res.status === 429) { await sleep(30000); continue; }
    if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
    return res.json().catch(() => ({}));
  }
}

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

(async () => {
  console.log("=== Lasclay refresh.js v1.1 ===");
  if (DRY_RUN) console.log("=== MODE SIMULATION ===");

  // Fils étiquetés « Draft AI Support »
  const drafted = new Set((await listByFilter(`shared_label=${DRAFT_LABEL}`)).map((c) => c.id));
  console.log(`${drafted.size} fil(s) portent « Draft AI Support ».`);

  // Fermés des équipes
  const closed = new Set();
  for (const t of TEAM_IDS) {
    for (const c of await listByFilter(`team_closed=${t}`)) closed.add(c.id);
  }
  console.log(`${closed.size} fil(s) fermé(s) au total dans ${TEAM_IDS.length} équipes.`);

  // Intersection: étiqueté ET fermé → retirer le label
  const aRetirer = [...drafted].filter((id) => closed.has(id));
  console.log(`${aRetirer.length} fil(s) étiqueté(s) ET fermé(s) → label à retirer.`);

  let r = 0, errors = 0;
  for (const id of aRetirer) {
    if (DRY_RUN) { r++; continue; }
    try {
      await apiPost("/posts", {
        posts: {
          conversation: id, organization: ORG,
          remove_shared_labels: [DRAFT_LABEL],
          reopen: true, // empêche la réouverture du fil fermé (paramètre Missive contre-intuitif)
          markdown: "_Brouillon obsolète, label retiré (fil fermé)._",
          notification: { title: "Suivi", body: "Brouillon obsolète, label retiré." },
        },
      });
      r++;
    } catch (e) { errors++; console.warn(`  retrait échoué sur ${id}: ${e.message}`); }
  }

  console.log(`\nBilan: ${r} label(s) retiré(s)${DRY_RUN ? " (simulé)" : ""}, ${errors} erreur(s).`);
  console.log("Run terminé.");
})().catch((e) => { console.error("Erreur fatale:", e.message); process.exit(1); });
