/**
 * Lasclay — nettoyage.js
 * ----------------------
 * Pour chaque fil FERMÉ d'une boîte de tri (RETOURS, Vente, USA, Mise à jour commande,
 * Expéditions prioritaires, R&D), retire les labels de tri et renvoie le fil dans
 * LAS Support (fermé). But: garder tout le service client archivable depuis un seul endroit,
 * sans laisser les boîtes de tri encombrées de vieux fils réglés.
 *
 * Mécanisme (confirmé doc Missive): un POST avec
 *   - remove_shared_labels: [labels de tri présents]
 *   - add_to_team_inbox + team: LAS Support
 *   - close: true (reste fermé), reopen: true (empêche la réouverture par le post)
 * Un POST exige TOUJOURS un markdown/texte (sinon erreur 400).
 *
 * Ne touche JAMAIS aux labels « Draft AI Support » / « Draft AI Révisé » ni aux fils ouverts.
 *
 * GARDE-FOUS:
 *   DRY_RUN=true par défaut: liste ce qui serait fait, ne touche à RIEN.
 *   CLEAN_LIMIT: plafond de fils traités (0 = illimité, défaut 0).
 *
 * Node 18+. Aucune dépendance.
 * Variables: MISSIVE_TOKEN (requis), DRY_RUN, CLEAN_LIMIT, MISSIVE_ORG.
 */

const TOKEN = process.env.MISSIVE_TOKEN;
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false";
const CLEAN_LIMIT = parseInt(process.env.CLEAN_LIMIT || "0", 10);
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36";

const API = "https://public.missiveapp.com/v1";
const mHeaders = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
if (!TOKEN) { console.error("Manque MISSIVE_TOKEN."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Équipe de destination
const TEAM_SUPPORT = "e184d153-4472-4edd-9b35-f8867cf437a8"; // LAS Support

// Boîtes de tri à nettoyer (équipe → labels de tri à retirer pour cette boîte)
const TRI = [
  { team: "cc587c84-63b9-4e88-993c-4f4b5b328173", nom: "RETOURS-ÉCHANGES", label: "b2ff154e-65f1-498f-8bfd-40c52854fd69" },
  { team: "d6f28d2f-06ef-4aa5-aae0-b68f014e3216", nom: "Vente - info pré-achat", label: "cf24d86b-ba38-41b2-bed7-0a4f43b1b2e4" },
  { team: "13d8a7bd-ed2e-4e0c-8cf3-2329ebaed217", nom: "USA", label: "7150fdfb-af9c-4844-835d-96c73da211d6" },
  { team: "9240aa4e-3e81-40aa-a07a-84f6b1c2231e", nom: "Expéditions prioritaires", label: "381b1d43-f684-4add-9d09-5608a7067c67" },
  { team: "80ae6958-8266-4898-9d80-38851eb3ba69", nom: "LAS R&D", label: "fa3615d0-a970-4913-a16c-258b30721d43" },
  { team: "0db185c1-3a93-4a44-9f50-dcfe8c0683dd", nom: "Mise à jour commande", label: "4bdc81b5-74a9-4246-9ced-3d9c1b13b0ed" },
];
// Tous les labels de tri (on les retire tous, peu importe la boîte d'origine)
const TOUS_LABELS_TRI = TRI.map((t) => t.label);

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

async function listClosed(teamId) {
  const byId = new Map();
  let until = null;
  while (true) {
    let path = `/conversations?team_closed=${teamId}&limit=50`;
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
  console.log("=== Lasclay nettoyage.js v1 ===");
  console.log(DRY_RUN ? "=== MODE SIMULATION (rien modifié) ===" : "=== MODE RÉEL ===");
  console.log(`Destination: LAS Support (fermé) | CLEAN_LIMIT: ${CLEAN_LIMIT || "aucun"}`);

  // Collecte des fils fermés de chaque boîte de tri (dédoublonnés)
  const filsById = new Map();
  for (const t of TRI) {
    const fils = await listClosed(t.team);
    console.log(`  ${fils.length} fil(s) fermé(s) dans ${t.nom}`);
    for (const c of fils) filsById.set(c.id, c);
  }
  const fils = [...filsById.values()];
  console.log(`${fils.length} fil(s) fermé(s) uniques à nettoyer.`);

  let traites = 0, deplaces = 0, errors = 0;
  for (const conv of fils) {
    if (CLEAN_LIMIT > 0 && traites >= CLEAN_LIMIT) { console.log("Plafond atteint."); break; }
    traites++;
    const subj = (conv.subject || "(sans sujet)").slice(0, 50);
    // Labels de tri réellement présents sur ce fil
    const presents = (conv.shared_labels || []).map((l) => l.id || l).filter((id) => TOUS_LABELS_TRI.includes(id));

    if (DRY_RUN) {
      console.log(`[DRY] ${subj} → retirerait ${presents.length} label(s) de tri + renverrait dans LAS Support`);
      deplaces++;
      continue;
    }
    try {
      await apiPost("/posts", {
        posts: {
          conversation: conv.id, organization: ORG,
          remove_shared_labels: presents.length ? presents : undefined,
          add_to_team_inbox: true, team: TEAM_SUPPORT,
          close: true, reopen: true,
          markdown: "_Fil fermé renvoyé dans LAS Support, labels de tri retirés (nettoyage automatique)._",
          notification: { title: "Nettoyage", body: "Fil fermé consolidé dans LAS Support." },
        },
      });
      deplaces++;
      console.log(`[net ${traites}] ${subj} → ${presents.length} label(s) retiré(s), renvoyé dans LAS Support`);
    } catch (e) { errors++; console.warn(`  fil ${conv.id} échoué: ${e.message}`); }
  }

  console.log(`\nBilan: ${traites} fil(s) traité(s), ${deplaces}${DRY_RUN ? " (simulé)" : " déplacé(s)"}, ${errors} erreur(s).`);
  console.log("Run terminé.");
})().catch((e) => { console.error("Erreur fatale:", e.message); process.exit(1); });
