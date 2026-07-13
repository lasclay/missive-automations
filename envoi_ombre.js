/**
 * Missive — envoi_ombre.js (v1)
 * --------------------------------------------------------------------------
 * MODE OMBRE de l'envoi automatique. Évalue les brouillons « Draft AI Support »
 * DÉJÀ créés par support.js et détermine lesquels seraient admissibles à un envoi
 * automatique, SANS RIEN ENVOYER. Ce script ne contient aucune capacité d'envoi
 * (aucun send:true) : il ne peut donc pas envoyer par accident.
 *
 * Pour chaque fil étiqueté « Draft AI Support » :
 *   - récupère le brouillon (GET /conversations/:id/drafts),
 *   - lit les notes internes (GET /conversations/:id/posts) pour repérer une
 *     alerte ⚠️ de support.js (verrou verifRequise),
 *   - verdict : ADMISSIBLE si un brouillon existe ET aucune alerte bloquante,
 *   - sur les admissibles, pose en SILENCE (PATCH) le label « Prêt à envoyer (ombre) »
 *     si son id est fourni, pour une vue filtrable dans Missive,
 *   - montre l'avertissement qui serait ajouté au message.
 *
 * Ton travail ensuite : ouvrir la vue des admissibles, lire chaque brouillon, et te
 * poser une seule question : « est-ce que j'aurais cliqué Envoyer sans rien changer ? ».
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN     token API (missive_pat-...)                      [requis]
 *   MISSIVE_ORG       id d'organisation (défaut Lasclay)           [facultatif]
 *   READY_LABEL_ID    id du label « Prêt à envoyer (ombre) » à créer dans Missive
 *                     (Resource IDs). Si absent, le script rapporte sans étiqueter.
 *   MAX_FILS          plafond de fils analysés (0 = illimité). Défaut 0.
 */

const VERSION = "v1";

const TOKEN = process.env.MISSIVE_TOKEN;
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36"; // Lasclay
const DRAFT_LABEL = "019eb935-9b22-7d14-8aeb-614a1e303e24"; // « Draft AI Support »
const READY_LABEL = process.env.READY_LABEL_ID || null; // « Prêt à envoyer (ombre) »
const MAX_FILS = parseInt(process.env.MAX_FILS || "0", 10) || 0;

// L'avertissement ajouté à TOUT message (montré ici, appliqué au vrai envoi plus tard).
// Rédigé sans tu/vous pour rester cohérent avec n'importe quel registre de brouillon.
const DISCLAIMER =
  "Petit mot en toute transparence : nous testons présentement un système de " +
  "réponses assisté par intelligence artificielle. Si cette réponse a raté son " +
  "coup ou passe à côté de la question, il est possible de me joindre directement " +
  "au 581-982-5857.";

// Étiquettes de tri (pour afficher la catégorie de chaque fil).
const TRI = {
  "4bdc81b5-74a9-4246-9ced-3d9c1b13b0ed": "Mise à jour commande",
  "b2ff154e-65f1-498f-8bfd-40c52854fd69": "Retours-échanges",
  "cf24d86b-ba38-41b2-bed7-0a4f43b1b2e4": "Pré-achat",
  "7150fdfb-af9c-4844-835d-96c73da211d6": "USA",
  "fa3615d0-a970-4913-a16c-258b30721d43": "R&D",
  "381b1d43-f684-4add-9d09-5608a7067c67": "Expéditions prioritaires",
};

// Marqueurs d'une note bloquante posée par support.js.
const ALERT_MARKERS = ["⚠️", "ne pas envoyer", "note ia", "support ia", "[voix]", "action"];

const API = "https://public.missiveapp.com/v1";
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (!TOKEN) {
  console.error("Manque MISSIVE_TOKEN.");
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

// PATCH silencieux (pose de label sans commentaire ni notification).
async function apiPatch(path, body, tries = 0) {
  await sleep(260);
  let res;
  try {
    res = await fetch(`${API}${path}`, { method: "PATCH", headers, body: JSON.stringify(body) });
  } catch (e) {
    if (tries < 4) {
      await sleep((tries + 1) * 5000);
      return apiPatch(path, body, tries + 1);
    }
    throw e;
  }
  if (res.status === 429) {
    await sleep(30000);
    return apiPatch(path, body, tries);
  }
  const text = await res.text();
  if (!res.ok) console.error(`PATCH ${path} → ${res.status} ${text}`);
  return { ok: res.ok };
}

// Liste les fils portant « Draft AI Support » (ouverts et fermés).
async function listDraftFils() {
  const byId = new Map();
  let until = null;
  while (true) {
    let path = `/conversations?shared_label=${DRAFT_LABEL}&limit=50`;
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

const strip = (html) =>
  (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// Récupère le brouillon d'un fil (le plus récent), ou null.
async function getDraft(convId) {
  try {
    const data = await api(`/conversations/${convId}/drafts`);
    const drafts = data.drafts || [];
    if (drafts.length === 0) return null;
    return drafts[drafts.length - 1]; // le plus récent
  } catch (e) {
    console.warn(`  brouillon illisible sur ${convId} (${e.message})`);
    return null;
  }
}

// Détecte une note interne bloquante de support.js.
async function hasBlockingNote(convId) {
  try {
    const data = await api(`/conversations/${convId}/posts?limit=10`);
    const posts = data.posts || [];
    for (const p of posts) {
      const txt = `${p.text || ""} ${p.markdown || ""} ${p.notification?.title || ""} ${
        p.notification?.body || ""
      }`.toLowerCase();
      if (ALERT_MARKERS.some((m) => txt.includes(m))) return true;
    }
    return false;
  } catch (e) {
    // En cas de doute, on considère qu'il y a une alerte (prudence : ne pas déclarer
    // admissible un fil dont on n'a pas pu vérifier les notes).
    console.warn(`  notes illisibles sur ${convId} (${e.message}) → traité comme bloquant`);
    return true;
  }
}

function categorie(conv) {
  const labels = conv.shared_labels || [];
  for (const l of labels) {
    const id = l.id || l;
    if (TRI[id]) return TRI[id];
  }
  return "(non trié)";
}

async function addReadyLabel(convId) {
  if (!READY_LABEL) return;
  await apiPatch(`/conversations/${convId}`, {
    conversations: [{ id: convId, organization: ORG, add_shared_labels: [READY_LABEL] }],
  });
}

async function main() {
  console.log(`=== Lasclay envoi_ombre.js ${VERSION} ===`);
  console.log("MODE OMBRE : aucune capacité d'envoi, rien ne part.");
  console.log(READY_LABEL ? `Label admissibles : ${READY_LABEL}` : "Pas de READY_LABEL_ID : rapport seul, aucun étiquetage.");
  console.log(`\nAvertissement qui serait ajouté à chaque envoi :\n  « ${DISCLAIMER} »\n`);

  const fils = await listDraftFils();
  console.log(`${fils.length} fil(s) « Draft AI Support » à évaluer.\n`);

  let admissibles = 0;
  let bloques = 0;
  let sansBrouillon = 0;
  const parCategorie = {};
  let traites = 0;

  for (const conv of fils) {
    if (MAX_FILS && traites >= MAX_FILS) {
      console.log(`Plafond MAX_FILS=${MAX_FILS} atteint, arrêt.`);
      break;
    }
    traites++;

    const draft = await getDraft(conv.id);
    if (!draft) {
      sansBrouillon++;
      continue;
    }

    const bloquant = await hasBlockingNote(conv.id);
    const cat = categorie(conv);
    const sujet = (conv.subject || draft.subject || "(sans sujet)").slice(0, 55);

    if (bloquant) {
      bloques++;
      console.log(`  BLOQUÉ    [${cat}] ${sujet}  (alerte support.js)`);
      continue;
    }

    admissibles++;
    parCategorie[cat] = (parCategorie[cat] || 0) + 1;
    const apercu = strip(draft.body).slice(0, 180).replace(/\n/g, " ");
    console.log(`  ADMISSIBLE [${cat}] ${sujet}`);
    console.log(`     → ${apercu}${apercu.length >= 180 ? "..." : ""}`);
    await addReadyLabel(conv.id);
  }

  console.log(`\n===== BILAN OMBRE =====`);
  console.log(`Admissibles à l'envoi auto : ${admissibles}`);
  console.log(`Bloqués (alerte)           : ${bloques}`);
  console.log(`Sans brouillon             : ${sansBrouillon}`);
  console.log(`Répartition des admissibles par catégorie :`);
  for (const [cat, n] of Object.entries(parCategorie).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${cat}`);
  }
  console.log(`\nRappel : rien n'a été envoyé. ${READY_LABEL ? "Les admissibles portent le label « Prêt à envoyer (ombre) »." : ""}`);
  console.log("Run terminé.");
}

main().catch((e) => {
  console.error("Erreur :", e.message);
  process.exit(1);
});
