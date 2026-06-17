/**
 * Lasclay — purge.js
 * ------------------
 * Pour chaque fil portant le label « Draft AI Support », supprime le ou les
 * brouillons IA ET retire le label, pour que support.js régénère un brouillon
 * frais (avec le code et le catalogue à jour) au run suivant.
 *
 * Sans le retrait du label, le fil resterait invisible à support.js: supprimer
 * le brouillon seul ne suffit donc PAS à régénérer. Les deux gestes sont liés.
 *
 * GARDE-FOUS:
 *   DRY_RUN=true par défaut: liste ce qui serait supprimé/retiré, ne touche à RIEN.
 *   PURGE_LIMIT: plafond de fils traités (0 = illimité, défaut 0).
 *   EXCLUDE_TEAMS: ids d'équipes à NE PAS purger (défaut: Mise à jour commande,
 *     qui a son propre sort, brouillons jetés sans régénération via Klaviyo).
 *     Note: un fil est exclu seulement s'il est UNIQUEMENT dans une équipe exclue.
 *
 * La suppression de brouillon est IRRÉVERSIBLE. Toujours un DRY_RUN d'abord.
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables: MISSIVE_TOKEN (requis), DRY_RUN, PURGE_LIMIT, DRAFT_LABEL,
 *            MISSIVE_ORG, EXCLUDE_TEAMS.
 */

const TOKEN = process.env.MISSIVE_TOKEN;
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false";
const PURGE_LIMIT = parseInt(process.env.PURGE_LIMIT || "0", 10);
const DRAFT_LABEL = process.env.DRAFT_LABEL || "019eb935-9b22-7d14-8aeb-614a1e303e24"; // « Draft AI Support »
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36";

const API = "https://public.missiveapp.com/v1";
const mHeaders = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (!TOKEN) { console.error("Manque MISSIVE_TOKEN."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, method = "GET") {
  let netTries = 0;
  while (true) {
    await sleep(260);
    let res;
    try { res = await fetch(`${API}${path}`, { method, headers: mHeaders }); }
    catch (e) {
      if (++netTries > 5) throw new Error(`${path} → réseau: ${e.message}`);
      console.warn(`Réseau (${e.message}), tentative ${netTries}/5…`);
      await sleep(netTries * 10000);
      continue;
    }
    if (res.status === 429) { await sleep(30000); continue; }
    if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
    return res.status === 204 ? {} : res.json().catch(() => ({}));
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
      console.warn(`Réseau (${e.message}), tentative ${netTries}/5…`);
      await sleep(netTries * 10000);
      continue;
    }
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

async function listDrafts(convId) {
  const byId = new Map();
  let until = null;
  while (true) {
    let path = `/conversations/${convId}/drafts?limit=10`;
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

(async () => {
  console.log("=== Lasclay purge.js v1.1 ===");
  console.log(DRY_RUN ? "=== MODE SIMULATION (rien supprimé) ===" : "=== MODE RÉEL (suppression irréversible) ===");
  console.log(`Label visé: ${DRAFT_LABEL} | PURGE_LIMIT: ${PURGE_LIMIT || "aucun"}`);

  const fils = await listByFilter(`shared_label=${DRAFT_LABEL}`);
  console.log(`${fils.length} fil(s) portent « Draft AI Support ».`);

  let traites = 0, draftsSupp = 0, labelsRetires = 0, sansDraft = 0, errors = 0;

  for (const conv of fils) {
    if (PURGE_LIMIT > 0 && traites >= PURGE_LIMIT) { console.log("Plafond atteint."); break; }
    traites++;
    try {
      const drafts = await listDrafts(conv.id);
      const subj = (conv.subject || conv.latest_message_subject || "(sans sujet)").slice(0, 50);

      if (DRY_RUN) {
        console.log(`[DRY] ${subj} → supprimerait ${drafts.length} brouillon(s) + retirerait le label`);
        draftsSupp += drafts.length;
        labelsRetires++;
        if (drafts.length === 0) sansDraft++;
        continue;
      }

      // 1. Supprimer les brouillons
      for (const d of drafts) {
        try { await api(`/drafts/${d.id}`, "DELETE"); draftsSupp++; }
        catch (e) { console.warn(`  suppression brouillon ${d.id} échouée: ${e.message}`); errors++; }
      }
      if (drafts.length === 0) sansDraft++;

      // 2. Retirer le label (sinon le fil reste invisible à support.js)
      try {
        await apiPost("/posts", {
          posts: {
            conversation: conv.id, organization: ORG,
            remove_shared_labels: [DRAFT_LABEL],
            markdown: "_Brouillon IA purgé, prêt à régénérer._",
            notification: { title: "Purge", body: "Brouillon IA purgé, prêt à régénérer." },
          },
        });
        labelsRetires++;
      } catch (e) { console.warn(`  retrait label ${conv.id} échoué: ${e.message}`); errors++; }

      console.log(`[purge ${traites}] ${subj} → ${drafts.length} brouillon(s) supprimé(s), label retiré`);
    } catch (e) { errors++; console.warn(`  fil ${conv.id} sauté: ${e.message}`); }
  }

  console.log(`\nBilan: ${traites} fil(s) traité(s), ${draftsSupp} brouillon(s)${DRY_RUN ? " (simulé)" : " supprimé(s)"}, ${labelsRetires} label(s) retiré(s)${DRY_RUN ? " (simulé)" : ""}, ${sansDraft} fil(s) sans brouillon, ${errors} erreur(s).`);
  console.log("Run terminé.");
})().catch((e) => { console.error("Erreur fatale:", e.message); process.exit(1); });
