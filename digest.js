/**
 * Lasclay — Digest matinal Admin + Operations
 * -------------------------------------------
 * Pour chaque équipe (Admin, Operations) :
 *   1. récupère les conversations ouvertes (team_inbox)
 *   2. garde celles où le DERNIER message vient d'un externe (= balle dans ton camp)
 *   3. calcule depuis combien de jours ça attend
 *   4. demande à Claude : catégorie, type d'action, phrase courte, sous-tâches, brouillon
 *   5. poste un digest court et priorisé dans la conversation « Résumé » de l'équipe
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN          token API Missive (missive_pat-...)
 *   ANTHROPIC_API_KEY      clé API Anthropic (sk-ant-...)   ← SECRET, jamais en dur
 *   MISSIVE_SELF_ADDRESSES (optionnel) tes adresses, séparées par virgules
 *   MISSIVE_SELF_NAMES     (optionnel) tes noms d'expéditeur, séparés par virgules
 *   MODEL                  (optionnel) modèle Claude, défaut claude-sonnet-4-6
 *   MAX_IA                 (optionnel) plafond de fils analysés par IA / équipe (défaut 25)
 *   DRY_RUN                "true" (défaut) = affiche dans les logs sans rien poster
 */

const TOKEN = process.env.MISSIVE_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || "claude-sonnet-4-6";
const MAX_IA = parseInt(process.env.MAX_IA || "25", 10);
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false";

// Équipes balayées + conversation « Résumé » où poster pour chacune.
const TEAMS = [
  {
    name: "Admin",
    teamId: "a6c74be0-2a27-4c79-9294-a74b447e6dc0",
    digestConversation: "9e3f9ab8-9bb4-4a89-8040-9cf76284949d",
  },
  {
    name: "Operations",
    teamId: "7c925f0d-3eca-4535-be20-424078619cef",
    digestConversation: "8b0001c6-97ba-4c62-a12a-9ac6247326c9",
  },
];

// Tes propres adresses / noms d'expéditeur → un fil dont le dernier message vient
// de l'un d'eux est « en attente de l'autre », pas de toi.
const norm = (s) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const SELF = (process.env.MISSIVE_SELF_ADDRESSES ||
  "admin@lasclay.com,operations@lasclay.com,info@lasclay.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const SELF_NAMES = new Set(
  (process.env.MISSIVE_SELF_NAMES ||
    "Lasclay,Lasclay Admin,Lasclay Operations,Gabriel Gouveia")
    .split(",").map(norm).filter(Boolean)
);

// Petit contexte pour améliorer les brouillons (à étoffer si tu veux).
const CONTEXTE_LASCLAY =
  "Lasclay (lasclay.com), entreprise québécoise de produits à base d'asclépiade " +
  "(milkweed) : isolation/fibres textiles durables. Gabriel Gouveia, co-fondateur. " +
  "Signe les courriels : « Chaleureusement, Gabriel Gouveia, Co-fondateur, Lasclay.com ».";

const API = "https://public.missiveapp.com/v1";
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (!TOKEN) { console.error("Manque MISSIVE_TOKEN."); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error("Manque ANTHROPIC_API_KEY."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path) {
  await sleep(260); // respecte la limite Missive (~300/min)
  const res = await fetch(`${API}${path}`, { headers });
  if (res.status === 429) { await sleep(30000); return api(path); }
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

// --- Récupère les conversations ouvertes d'une équipe (paginé, dédoublonné) ---
async function teamInbox(teamId) {
  const byId = new Map();
  let until = null;
  const limit = 50;
  while (true) {
    let path = `/conversations?team_inbox=${teamId}&limit=${limit}`;
    if (until) path += `&until=${until}`;
    const { conversations = [] } = await api(path);
    if (conversations.length === 0) break;
    for (const c of conversations) byId.set(c.id, c);
    const oldest = conversations[conversations.length - 1].last_activity_at;
    if (conversations.length < limit || oldest === until) break;
    until = oldest;
  }
  return [...byId.values()];
}

const stripHtml = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// --- Analyse un fil : dernier message externe ? jours d'attente ? extrait ? ---
async function inspect(conv) {
  const { messages = [] } = await api(`/conversations/${conv.id}/messages?limit=10`);
  if (messages.length === 0) return null;
  const sorted = messages.slice().sort(
    (a, b) => (a.delivered_at || a.created_at || 0) - (b.delivered_at || b.created_at || 0)
  );
  const last = sorted[sorted.length - 1];

  // Le dernier message vient-il de nous ? Si oui → balle dans leur camp → on ignore.
  const lastAddr = last.from_field?.address?.toLowerCase() || "";
  const lastName = norm(last.from_field?.name);
  const fromUs = SELF.includes(lastAddr) || SELF_NAMES.has(lastName);
  if (fromUs) return null;

  let ts = last.delivered_at || last.created_at || 0;
  if (ts && ts < 1e12) ts *= 1000; // secondes → ms
  const days = ts ? Math.floor((Date.now() - ts) / 86400000) : 0;

  // Extrait pour l'IA : 3 derniers messages, nettoyés et tronqués à ~1500 caractères.
  const extrait = sorted.slice(-3).map((m) => {
    const who = m.from_field?.name || m.from_field?.address || "?";
    return `[${who}] ${stripHtml(m.body || m.preview).slice(0, 1500)}`;
  }).join("\n---\n");

  const sender = last.from_field?.name || last.from_field?.address || "?";
  return { id: conv.id, subject: conv.subject || "(sans sujet)", sender, days, extrait };
}

// --- Classification + brouillon par Claude (retourne un objet structuré) ---
async function classify(item) {
  const system =
    `${CONTEXTE_LASCLAY}\n\n` +
    "Tu tries les courriels en attente d'une réponse de Gabriel (boîtes Admin/Operations : " +
    "partenaires, gouvernement, opportunités d'affaires, réseautage — PAS du service client). " +
    "Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, avec ces clés :\n" +
    '{"categorie": "opportunite|developpement|gouvernement|relationnel|autre",' +
    ' "priorite": "haute|moyenne|basse",' +
    ' "action": "repondre|draft_courtoisie|draft_opportunite|tache|fermer",' +
    ' "phrase": "l\'action à poser, en 15 mots maximum (sois concis mais clair)",' +
    ' "sous_taches": ["..."],' +
    ' "brouillon": "..."}\n\n' +
    "Règles :\n" +
    "- priorite=haute si échéance proche, montant en jeu, ou relance qui traîne.\n" +
    "- action=tache si un document est à remplir/fournir (remplis alors sous_taches).\n" +
    "- action=draft_* SEULEMENT si une réponse polie/relationnelle suffit SANS connaître " +
    "de fait que tu ignores (date, montant, statut). Sinon action=repondre et brouillon=\"\".\n" +
    "- Pour tout fait inconnu dans un brouillon, laisse un marqueur {À COMPLÉTER}.\n" +
    "- draft_opportunite : accepter ET élargir (poser questions utiles, proposer plus).\n" +
    "- Brouillon en français, ton de Gabriel, avec sa signature. sous_taches vide sauf action=tache.\n" +
    "- action=fermer si non-essentiel (rien à faire, simple courtoisie sans suite).";

  const user = `Sujet : ${item.subject}\nEn attente depuis ${item.days} jour(s).\n` +
    `Derniers messages :\n${item.extrait}`;

  try {
    await sleep(200);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const obj = JSON.parse(clean);
    return {
      categorie: obj.categorie || "autre",
      priorite: obj.priorite || "moyenne",
      action: obj.action || "repondre",
      phrase: (obj.phrase || "à examiner").trim(),
      sous_taches: Array.isArray(obj.sous_taches) ? obj.sous_taches : [],
      brouillon: (obj.brouillon || "").trim(),
    };
  } catch (e) {
    console.error(`IA échouée sur ${item.id}: ${e.message}`);
    return { categorie: "autre", priorite: "moyenne", action: "repondre",
      phrase: "à examiner", sous_taches: [], brouillon: "" };
  }
}

// --- Construit le digest markdown pour une équipe ---
function buildDigest(teamName, teamId, items) {
  const link = (id) =>
    `https://mail.missiveapp.com/#team_unassigned/${teamId}_team_unassigned/conversations/${id}`;
  const today = new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long" });

  // Répartition en blocs
  const rouge = [], opp = [], vert = [];
  for (const it of items) {
    if (it.action === "fermer") vert.push(it);
    else if (it.priorite === "haute") rouge.push(it);
    else if (it.categorie === "opportunite" || it.categorie === "developpement") opp.push(it);
    else vert.push(it);
  }
  const byAge = (a, b) => b.days - a.days;
  rouge.sort(byAge); opp.sort(byAge); vert.sort(byAge);

  const draftIcon = (it) => (it.brouillon ? " ✍️" : "");
  const line = (it) =>
    `- **${it.sender}** · ${it.subject.slice(0, 50)} · ${it.days}j · [ouvrir](${link(it.id)}) — ${it.phrase}${draftIcon(it)}`;

  let md = `**📋 Résumé ${teamName} — ${today}**\n*${items.length} fils en attente de toi*\n`;

  if (rouge.length) md += `\n🔴 **À traiter**\n` + rouge.map(line).join("\n") + "\n";
  if (opp.length) md += `\n💰 **Opportunités**\n` + opp.map(line).join("\n") + "\n";
  if (vert.length) {
    md += `\n🟢 **Vite fait / à fermer**\n`;
    const show = vert.slice(0, 8);
    md += show.map((it) =>
      `- **${it.sender}** · ${it.subject.slice(0, 50)} · ${it.days}j · [ouvrir](${link(it.id)})`
    ).join("\n") + "\n";
    if (vert.length > 8) md += `- _+ ${vert.length - 8} autres fils mineurs_\n`;
  }

  // Sous-tâches (cas lourds) + brouillons, tout en bas, limités.
  const taches = rouge.filter((it) => it.sous_taches.length);
  if (taches.length) {
    md += `\n---\n**Sous-tâches**\n`;
    for (const it of taches.slice(0, 4)) {
      md += `\n_${it.sender} — ${it.subject.slice(0, 50)}_\n` +
        it.sous_taches.map((t) => `  - [ ] ${t}`).join("\n") + "\n";
    }
  }
  const drafts = [...rouge, ...opp, ...vert].filter((it) => it.brouillon).slice(0, 5);
  if (drafts.length) {
    md += `\n---\n**Brouillons prêts** _(à relire avant d'envoyer)_\n`;
    for (const it of drafts) {
      md += `\n**✍️ ${it.sender} — ${it.subject.slice(0, 50)}**\n> ` +
        it.brouillon.replace(/\n/g, "\n> ") + "\n";
    }
  }
  return md;
}

// --- Poste le digest dans la conversation Résumé de l'équipe ---
async function postDigest(conversationId, markdown) {
  const body = {
    posts: {
      conversation: conversationId,
      notification: { title: "Digest matinal", body: "Ton résumé priorisé est prêt." },
      markdown,
    },
  };
  await sleep(260);
  const res = await fetch(`${API}/posts`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) console.error(`Post digest échoué: ${res.status} ${await res.text()}`);
}

async function processTeam(team) {
  console.log(`\n=== ${team.name} ===`);
  const convs = await teamInbox(team.teamId);
  console.log(`${convs.length} conversations ouvertes.`);

  // Garder celles en attente de toi
  const waiting = [];
  for (const c of convs) {
    const info = await inspect(c);
    if (info) waiting.push(info);
  }
  waiting.sort((a, b) => b.days - a.days);
  console.log(`${waiting.length} en attente de toi.`);

  // Plafond IA
  const toAnalyze = waiting.slice(0, MAX_IA);
  if (waiting.length > MAX_IA) console.log(`(IA limitée aux ${MAX_IA} plus anciens)`);

  const items = [];
  let i = 0;
  for (const it of toAnalyze) {
    i++;
    if (i % 10 === 0) console.log(`  ...${i}/${toAnalyze.length} classés`);
    items.push({ ...it, ...(await classify(it)) });
  }

  const md = buildDigest(team.name, team.teamId, items);

  if (DRY_RUN) {
    console.log(`\n--- DIGEST ${team.name} (simulation, non posté) ---\n${md}\n`);
  } else {
    await postDigest(team.digestConversation, md);
    console.log(`Digest ${team.name} posté.`);
  }
}

async function main() {
  console.log(DRY_RUN ? "=== MODE SIMULATION (rien posté) ===" : "=== MODE RÉEL ===");
  for (const team of TEAMS) await processTeam(team);
  console.log("\nTerminé.");
}

main().catch((e) => { console.error("Erreur :", e.message); process.exit(1); });
