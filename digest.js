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
const MAX_IA = parseInt(process.env.MAX_IA || "200", 10);
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false";
// Fenêtre d'âge : 0 = tout l'ouvert (hebdo). 1 = seulement ≤1 jour (quotidien « frais »).
const MAX_AGE_DAYS = parseInt(process.env.MAX_AGE_DAYS || "0", 10);
// Org Lasclay (requis pour poser un label / créer une tâche).
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36";
// Label-marqueur « tâche créée » : si défini, le script crée de vraies tâches Missive
// pour les fils 🔴 et pose ce label pour ne jamais recréer la même tâche.
// Laisse vide pour désactiver la création de tâches.
const TASK_LABEL = process.env.MISSIVE_TASK_LABEL || "";

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

// Contexte d'entreprise : lu depuis contexte_lasclay.md (dans le dépôt, à côté du
// script). Sert de « Knowledge » pour que les brouillons sonnent vrais. Repli court
// si le fichier est absent.
const fs = require("node:fs");
const path = require("node:path");
const CONTEXTE_COURT =
  "Lasclay (lasclay.com), entreprise québécoise de produits à base d'asclépiade " +
  "(milkweed) : isolation/fibres textiles durables. Gabriel Gouveia, co-fondateur. " +
  "Signe les courriels : « Chaleureusement, Gabriel Gouveia, Co-fondateur, Lasclay.com ».";
let CONTEXTE_LASCLAY = CONTEXTE_COURT;
try {
  const p = path.join(__dirname, "contexte_lasclay.md");
  if (fs.existsSync(p)) {
    CONTEXTE_LASCLAY = fs.readFileSync(p, "utf8");
    console.log(`Contexte chargé (${CONTEXTE_LASCLAY.length} caractères).`);
  } else {
    console.warn("contexte_lasclay.md absent — contexte court utilisé.");
  }
} catch (e) {
  console.warn(`Lecture du contexte impossible (${e.message}) — contexte court.`);
}

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

// --- Analyse un fil : dernier message externe ? jours d'attente ? sujet ? extrait ? ---
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

  // Sujet : conversation, sinon sujet d'un message, sinon null (l'IA fera un titre).
  const subject =
    (conv.subject && conv.subject.trim()) ||
    (sorted.map((m) => m.subject).find((s) => s && s.trim())) ||
    null;

  // Extrait pour l'IA : 3 derniers messages, datés, nettoyés, tronqués à ~1500 caractères.
  const fmtDate = (m) => {
    let t = m.delivered_at || m.created_at || 0;
    if (t && t < 1e12) t *= 1000;
    return t ? new Date(t).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" }) : "date inconnue";
  };
  const extrait = sorted.slice(-3).map((m) => {
    const who = m.from_field?.name || m.from_field?.address || "?";
    return `[${who}, ${fmtDate(m)}] ${stripHtml(m.body || m.preview).slice(0, 1500)}`;
  }).join("\n---\n");

  // Expéditeur : nom, sinon adresse, sinon "?"
  const sender = last.from_field?.name || last.from_field?.address || "?";
  return { id: conv.id, subject, sender, days, extrait };
}

// --- Classification + brouillon par Claude (retourne un objet structuré) ---
async function classify(item) {
  // Instructions de tâche (légères, non mises en cache).
  const instructions =
    "Tu tries les courriels en attente d'une réponse de Gabriel (boîtes Admin/Operations : " +
    "partenaires, gouvernement, opportunités d'affaires, réseautage — PAS du service client). " +
    "Sers-toi du contexte Lasclay fourni pour que les brouillons sonnent vrais, jamais génériques. " +
    "N'utilise JAMAIS le tiret cadratin (—) ; utilise une virgule, un deux-points ou une parenthèse. " +
    "Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, avec ces clés :\n" +
    '{"titre": "3 à 5 mots résumant le sujet du fil",' +
    ' "categorie": "opportunite|developpement|gouvernement|relationnel|autre",' +
    ' "priorite": "haute|moyenne|basse",' +
    ' "action": "repondre|draft_courtoisie|draft_opportunite|tache|fermer",' +
    ' "phrase": "l\'action à poser, en 15 mots maximum (sois concis mais clair)",' +
    ' "sous_taches": ["..."],' +
    ' "brouillon": "..."}\n\n' +
    "Règles :\n" +
    "- priorite=haute si échéance proche, montant en jeu, ou relance qui traîne.\n" +
    "- action=tache si un document est à remplir/fournir (remplis alors sous_taches).\n" +
    "- N'écris un brouillon (champ brouillon non vide) QUE dans deux cas : (a) une opportunité " +
    "ou un fil de développement/affaires, ou (b) une relance (le contact a relancé, ou le fil " +
    "attend depuis plus de 60 jours). Pour TOUT le reste, brouillon=\"\" et action=repondre, " +
    "tache ou fermer selon le cas. Cela évite de rédiger pour rien.\n" +
    "- N'écris un brouillon que si une réponse suffit SANS connaître un fait que tu ignores " +
    "(date, montant, statut). Si un tel fait est requis : action=repondre, brouillon=\"\".\n" +
    "- Pour tout fait inconnu dans un brouillon, laisse un marqueur {À COMPLÉTER}. " +
    "Respecte les règles de prudence du contexte (ne jamais inventer de chiffres ou faits non publics).\n" +
    "- draft_opportunite : accepter ET élargir (poser questions utiles, proposer plus).\n" +
    "- action=fermer si non-essentiel (rien à faire, simple courtoisie sans suite).\n" +
    "- Si le fil attend depuis longtemps : excuse-toi UNE fois pour le délai, en l'attribuant à " +
    "une période chargée et un manque de temps (JAMAIS à un manque de volonté ou d'intérêt). " +
    "Mais NE COMMENCE PAS le courriel par l'excuse : entre d'abord dans le sujet (réponds, pose " +
    "ta question, montre l'intérêt), et glisse l'excuse brièvement après, ou à la fin. " +
    "VARIE la formulation : n'écris pas deux fois la même phrase d'excuse. Évite en particulier " +
    "de répéter « ces derniers mois ont été particulièrement chargés », trouve autre chose à chaque fois, " +
    "ou sois très bref (« Désolé pour le délai. »). Adapte au délai réel (semaines vs mois).\n" +
    "- N'écris JAMAIS de tournures robotiques comme « dans ce fil », « suite à ce fil », " +
    "« je reviens sur ce fil ». Écris comme un humain qui reprend une vraie conversation.\n" +
    "- N'utilise JAMAIS la structure antithétique, ni sous sa forme évidente « ce n'est pas X, " +
    "c'est Y », ni déguisée (« ce n'est pas un manque d'intérêt, plutôt... », « not an excuse but... », " +
    "« which isn't fair... »). Dis simplement la chose, sans la nier d'abord.\n" +
    "VOIX DE GABRIEL (impérative) : gestionnaire d'entreprise surchargé qui va droit au but, " +
    "sans être raide. Langage accessible, jamais vulgaire. Il déteste les platitudes, les intros " +
    "mielleuses et les expressions toutes faites. Pas de flatterie de remplissage. Chaleureux mais efficace. " +
    "Préfère une phrase simple et un peu imparfaite à une tournure trop polie ou trop léchée.\n" +
    "FORMULES INTERDITES (n'en utilise AUCUNE, ni leur traduction) : « glissé entre les mailles », " +
    "« passé entre les mailles », « fell through the cracks », « qui a du sens pour nous », " +
    "« exactly the kind of », « exactement le genre de... qui nous intéresse », « c'est exactement " +
    "le genre de partenariat », « je serais ravi/curieux de », « ça ne rend pas justice à », " +
    "« j'espère que ce message vous trouve bien », « n'hésitez pas à ». " +
    "Si une de ces idées doit être dite, reformule-la de façon banale et directe.\n" +
    "VARIÉTÉ : ne commence pas tous les courriels de la même façon (ni tous par une excuse, ni tous " +
    "par un remerciement). Varie aussi la fin : pas toujours trois questions en puces ; parfois une " +
    "seule question en une phrase, parfois aucune. Écris comme une vraie personne pressée, pas un gabarit.\n" +
    "STYLE : complet mais bref. Phrases courtes, paragraphes de 2 à 4 lignes, aucun remplissage. " +
    "Va droit au but. Termine par la signature de Gabriel.";

  // Bloc système : contexte d'entreprise MIS EN CACHE (identique à chaque appel,
  // donc facturé ~10% après le 1er appel) + instructions de tâche.
  const system = [
    {
      type: "text",
      text: "CONTEXTE LASCLAY (référence interne, ne jamais citer comme source) :\n\n" + CONTEXTE_LASCLAY,
      cache_control: { type: "ephemeral" },
    },
    { type: "text", text: instructions },
  ];

  const aujourdhui = new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
  const sujetLigne = item.subject
    ? `Sujet : ${item.subject}`
    : "Sujet : (absent — propose un titre de 3-5 mots dans le champ titre)";
  const user =
    `Date d'aujourd'hui : ${aujourdhui}.\n` +
    `${sujetLigne}\n` +
    `Ce fil attend une réponse de Gabriel depuis ${item.days} jour(s).\n` +
    `Chaque message ci-dessous est daté. ATTENTION : une date ou un rendez-vous proposé dans ` +
    `un message peut être DÉJÀ PASSÉ par rapport à aujourd'hui. Ne confirme jamais une date ` +
    `dépassée ; propose plutôt de replanifier.\n` +
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
      titre: (obj.titre || "").trim(),
      categorie: obj.categorie || "autre",
      priorite: obj.priorite || "moyenne",
      action: obj.action || "repondre",
      phrase: (obj.phrase || "à examiner").trim(),
      sous_taches: Array.isArray(obj.sous_taches) ? obj.sous_taches : [],
      brouillon: (obj.brouillon || "").trim(),
    };
  } catch (e) {
    console.error(`IA échouée sur ${item.id}: ${e.message}`);
    return { titre: "", categorie: "autre", priorite: "moyenne", action: "repondre",
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

// --- Anti-doublon : ensemble des conversations portant déjà le label-marqueur ---
async function conversationsAlreadyTasked() {
  if (!TASK_LABEL) return new Set();
  const ids = new Set();
  let until = null;
  const limit = 50;
  while (true) {
    let path = `/conversations?shared_label=${TASK_LABEL}&limit=${limit}`;
    if (until) path += `&until=${until}`;
    const { conversations = [] } = await api(path);
    if (conversations.length === 0) break;
    for (const c of conversations) ids.add(c.id);
    const oldest = conversations[conversations.length - 1].last_activity_at;
    if (conversations.length < limit || oldest === until) break;
    until = oldest;
  }
  return ids;
}

// --- Crée une vraie tâche (sous-tâche) dans la conversation + pose le label-marqueur ---
async function createTask(conversationId, title) {
  const body = {
    posts: {
      conversation: conversationId,
      organization: ORG,
      add_shared_labels: [TASK_LABEL], // marqueur anti-doublon, posé en même temps
      notification: { title: "Tâche créée", body: title.slice(0, 120) },
      task: { title: title.slice(0, 1000), state: "todo" },
    },
  };
  await sleep(260);
  const res = await fetch(`${API}/posts`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    console.error(`Tâche échouée sur ${conversationId}: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

async function processTeam(team, tasked) {
  console.log(`\n=== ${team.name} ===`);
  const convs = await teamInbox(team.teamId);
  console.log(`${convs.length} conversations ouvertes.`);

  // Garder celles en attente de toi (une conv problématique est sautée, pas fatale)
  let waiting = [];
  for (const c of convs) {
    try {
      const info = await inspect(c);
      if (info) waiting.push(info);
    } catch (e) {
      console.error(`  conv ${c.id} sautée: ${e.message}`);
    }
  }

  // Fenêtre d'âge : quotidien (≤ MAX_AGE_DAYS) vs hebdo (tout)
  if (MAX_AGE_DAYS > 0) {
    waiting = waiting.filter((w) => w.days <= MAX_AGE_DAYS);
    console.log(`Fenêtre : ≤ ${MAX_AGE_DAYS} jour(s).`);
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
    const c = await classify(it);
    // sujet d'affichage : vrai sujet, sinon titre généré par l'IA, sinon repli
    const subject = it.subject || c.titre || "(sans sujet)";
    items.push({ ...it, ...c, subject });
  }

  const md = buildDigest(team.name, team.teamId, items);

  if (DRY_RUN) {
    console.log(`\n--- DIGEST ${team.name} (simulation, non posté) ---\n${md}\n`);
  } else {
    await postDigest(team.digestConversation, md);
    console.log(`Digest ${team.name} posté.`);
  }

  // Création de tâches : seulement les fils 🔴 (priorité haute, hors « fermer »),
  // jamais ceux déjà tâchés (label-marqueur). Désactivé si TASK_LABEL absent.
  if (TASK_LABEL) {
    const aTacher = items.filter(
      (it) => it.priorite === "haute" && it.action !== "fermer" && !tasked.has(it.id)
    );
    if (DRY_RUN) {
      console.log(`\n[Tâches] ${aTacher.length} seraient créées (simulation) :`);
      for (const it of aTacher) console.log(`  - ${it.sender} — ${it.phrase}`);
    } else {
      let n = 0;
      for (const it of aTacher) {
        const title = `${it.sender} — ${it.phrase}`;
        if (await createTask(it.id, title)) { n++; tasked.add(it.id); }
      }
      console.log(`${n} tâche(s) créée(s) pour ${team.name}.`);
    }
  }
}

async function main() {
  console.log(DRY_RUN ? "=== MODE SIMULATION (rien posté) ===" : "=== MODE RÉEL ===");
  console.log(`Modèle : ${MODEL}`);
  if (MAX_AGE_DAYS > 0) console.log(`Mode quotidien : fils ≤ ${MAX_AGE_DAYS} jour(s).`);
  else console.log("Mode complet : tout l'ouvert.");

  // Fils déjà « tâchés » (pour ne pas recréer de tâches), récupérés une fois.
  const tasked = await conversationsAlreadyTasked();
  if (TASK_LABEL) console.log(`${tasked.size} fil(s) ont déjà une tâche.`);

  for (const team of TEAMS) {
    try {
      await processTeam(team, tasked);
    } catch (e) {
      console.error(`Équipe ${team.name} échouée: ${e.message}`);
    }
  }
  console.log("\nTerminé.");
}

main().catch((e) => { console.error("Erreur :", e.message); process.exit(1); });
