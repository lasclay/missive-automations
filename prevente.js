/**
 * Lasclay — prevente.js
 * ---------------------
 * Script léger, mono-tâche, à TRIGGER MANUEL. Balaie la boîte « Mise à jour commande »,
 * lit chaque fil, et quand il s'agit d'une commande de la PRÉVENTE printanière
 * (datée du 30 mai 2026 ou après, OU numéro L-50153 ou ultérieur) dont le client
 * s'inquiète d'un délai / demande un suivi / semble ignorer que c'est une prévente,
 * crée un BROUILLON en réponse avec le rappel de prévente personnalisé (prénom).
 *
 * FR seulement (la prévente s'est faite en français).
 * JAMAIS d'envoi (send). Toujours un brouillon que Gabriel valide et envoie.
 *
 * Reprend les briques éprouvées de support.js (lecture fil, appel Sonnet, brouillon
 * en réponse, signature, liens cliquables), SANS les 35 règles de voix de support.js:
 * ici une seule consigne, un seul message.
 *
 * GARDE-FOUS:
 *   DRY_RUN=true par défaut: affiche les brouillons sans rien créer.
 *   DRAFT_LIMIT: plafond de brouillons créés (0 = illimité, défaut 0).
 *   Saute les fils qui ont déjà un brouillon (drafts_count>0): pas d'empilement
 *     si on trigger plusieurs fois.
 *
 * Node 18+. Aucune dépendance.
 * Variables: MISSIVE_TOKEN, ANTHROPIC_API_KEY (requis), DRY_RUN, DRAFT_LIMIT,
 *            TEAM, MODEL, EXPORT_FROM, MISSIVE_ORG.
 */

const TOKEN = process.env.MISSIVE_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false";
const DRAFT_LIMIT = parseInt(process.env.DRAFT_LIMIT || "0", 10);
const TEAM = process.env.TEAM || "0db185c1-3a93-4a44-9f50-dcfe8c0683dd"; // Mise à jour commande
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36";
const EXPORT_FROM = process.env.EXPORT_FROM || "hey@lasclay.com";
const MODEL = process.env.MODEL || "claude-sonnet-4-6";
const TEAM_PREACHAT = "d6f28d2f-06ef-4aa5-aae0-b68f014e3216"; // Vente - info pré-achat (équipe destination)
const LABEL_PREACHAT = "cf24d86b-ba38-41b2-bed7-0a4f43b1b2e4"; // label de tri Ventes (la rule route vers l'équipe)

const API = "https://public.missiveapp.com/v1";
const mHeaders = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
if (!TOKEN || !ANTHROPIC_KEY) { console.error("Manque MISSIVE_TOKEN ou ANTHROPIC_API_KEY."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sanit = (s) => (s || "").replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");

// --- Le message de prévente (modifiable ici, c'est tout l'objet du script) ---
const DATE_EXPEDITION = "mi-octobre 2026";
const VIDEO_PIVOT = "https://www.youtube.com/watch?v=GKyHh-Ok9JU";

const CONSIGNE = `Tu analyses un fil de la boîte « Mise à jour commande » de Lasclay (produits isolés à la
soie d'asclépiade, Québec) et tu décides quoi en faire. Tu peux rédiger une réponse signée par
Gabriel (un homme: accorde au masculin), en français québécois naturel, direct, chaleureux.

CONTEXTE: la PRÉVENTE printanière des 30-31 mai 2026 a généré beaucoup de commandes, livrables à
l'AUTOMNE 2026. Plusieurs clients ne réalisent pas que c'est une prévente et s'inquiètent du délai.
L'infolettre qui invitait à la prévente avait des sujets comme « Prévente dans 2 heures »,
« Il reste moins de 2 jours à la prévente », etc.

CLASSE LE FIL DANS UN DES TROIS CAS (champ "action"):

1) action = "rappel" : le client a passé une commande DE PRÉVENTE et s'inquiète d'un délai, demande
   un suivi/statut, ou semble croire que sa commande aurait dû arriver. Signes d'une commande de prévente:
   - commande datée du 30 mai 2026 ou APRÈS, OU numéro L-50153 ou ULTÉRIEUR, OU
   - le fil CONTIENT l'infolettre invitant à la prévente (le client a répondu à ce courriel: sujets
     « Prévente dans 2 heures », « ...prévente... », mention « précommander », « livrables pour l'hiver »).
   Dans ce cas, rédige le BROUILLON de rappel (voir gabarit plus bas).

2) action = "router_preachat" : le client N'A PAS RÉUSSI à passer sa commande (bug, problème technique,
   page qui ne fonctionnait pas), OU demande l'information nécessaire POUR pouvoir commander
   (disponibilité, comment précommander, etc.). Bref, il n'a pas encore de commande et a besoin d'aide
   pour en passer une. Dans ce cas, NE rédige PAS de brouillon (brouillon vide): on va seulement
   déplacer le fil vers l'équipe Vente - info pré-achat.

3) action = "rien" : tout le reste. Notamment un simple ajustement sur une commande EXISTANTE
   (ex.: code rabais oublié à appliquer, changement d'adresse, modif de commande déjà passée): ça reste
   dans Mise à jour commande, on n'y touche pas. Aussi: retours, défauts, sujets sans rapport, ou fil
   déjà conclu. Pas de brouillon, pas de déplacement.

GABARIT DU RAPPEL (action "rappel"): reprends-le FIDÈLEMENT, personnalise le prénom, garde le fond,
le ton et les phrases-clés. Mets le lien de la vidéo sur le mot "vidéo" si possible.

"""
Bonjour [Prénom],

On a fait un suivi par infolettre le 18 juin dernier, mais comme certains ne semblent pas l'avoir reçu, je te le renvoie directement ici.

La prévente printanière de Lasclay, lancée à la fin mai, fut un énorme succès!

Maintenant que la poussière est retombée, je voulais te remercier très chaleureusement pour ton soutien dans tous nos défis et pour ta précommande. J'avais tellement peur que vous nous laissiez tomber après avoir révélé notre pivot dans cette vidéo (${VIDEO_PIVOT}), ça me fait vraiment chaud au cœur de voir tout ce soutien.

MERCI, MERCI MERCI!

Puisque nous sommes plus en avance cette année, nous devrions amplement être dans les temps pour livrer l'ensemble des précommandes tôt l'automne prochain. Nous visons pour l'instant la ${DATE_EXPEDITION} pour l'expédition!

Un dernier petit truc qui aide beaucoup: ajoute hey@lasclay.com à tes contacts courriel. Ça augmente les chances que nos suivis se rendent bien à toi, au lieu de tomber dans les indésirables.

Merci d'être encore là.
"""

TON: chaleureux, reconnaissant, RASSURANT. Ce n'est PAS un retard, donc NE T'EXCUSE PAS d'un délai.
Commence par « Bonjour [Prénom], ». Ne signe pas. Pas d'emoji. Pas de tiret cadratin.

RÉPONDS UNIQUEMENT en JSON:
{
  "action": "rappel" | "router_preachat" | "rien",
  "raison": "<courte explication de la décision>",
  "prenom": "<prénom du client, forme complète si abréviation évidente>",
  "brouillon": "<si action=rappel: le texte, sauts de ligne \\n, sans signature; sinon chaîne vide>"
}`;

// --- API Missive ---
async function api(path, method = "GET") {
  let netTries = 0;
  while (true) {
    await sleep(260);
    let res;
    try { res = await fetch(`${API}${path}`, { method, headers: mHeaders }); }
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
async function listThreadMessages(convId) {
  const byId = new Map();
  let until = null;
  while (true) {
    let path = `/conversations/${convId}/messages?limit=10`;
    if (until) path += `&until=${until}`;
    const { messages = [] } = await api(path);
    if (messages.length === 0) break;
    const before = byId.size;
    for (const m of messages) byId.set(m.id, m);
    const oldest = messages[messages.length - 1].delivered_at;
    if (messages.length < 10 || oldest === until || byId.size === before) break;
    until = oldest;
  }
  return [...byId.values()].sort((a, b) => (a.delivered_at || a.created_at || 0) - (b.delivered_at || b.created_at || 0));
}
async function fetchBodies(ids) {
  const bodies = new Map();
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    try {
      const r = await api(`/messages/${chunk.join(",")}`);
      const arr = Array.isArray(r.messages) ? r.messages : [r.messages];
      for (const m of arr) if (m && m.id) bodies.set(m.id, m.body || m.preview || "");
    } catch {
      for (const id of chunk) {
        try { const r = await api(`/messages/${id}`); const m = Array.isArray(r.messages) ? r.messages[0] : r.messages; if (m) bodies.set(id, m.body || m.preview || ""); } catch {}
      }
    }
  }
  return bodies;
}

// --- Nettoyage corps ---
function stripHtml(s) {
  if (!s) return "";
  let t = s.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  t = t.replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;|&rsquo;/gi, "'").replace(/&quot;/gi, '"');
  return t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function cutQuoted(text) {
  if (!text) return "";
  const markers = [/^\s*Le .{0,120}? a écrit\s*:/im, /^\s*On .{0,120}? wrote\s*:/im];
  let cut = text.length;
  for (const re of markers) { const m = text.search(re); if (m !== -1 && m < cut) cut = m; }
  return text.slice(0, cut).trim();
}
const cleanBody = (html) => cutQuoted(stripHtml(html));

// --- Anthropic ---
async function claude(user) {
  const payload = JSON.stringify({
    model: MODEL, max_tokens: 1500,
    system: [{ type: "text", text: sanit(CONSIGNE) }],
    messages: [{ role: "user", content: sanit(user) }],
  });
  for (let attempt = 1; attempt <= 6; attempt++) {
    await sleep(800);
    let res;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: payload,
      });
    } catch (e) { console.warn(`Réseau Anthropic (${e.message}), tentative ${attempt}/6…`); await sleep(attempt * 15000); continue; }
    if (res.status === 429 || res.status === 529) { await sleep(attempt * 20000); continue; }
    if (!res.ok) throw new Error(`Anthropic → ${res.status} ${await res.text()}`);
    const data = await res.json();
    return (data.content || []).map((b) => b.text || "").join("\n").trim();
  }
  throw new Error("Anthropic: trop de tentatives.");
}
function parseJsonLoose(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("Pas de JSON.");
  return JSON.parse(cleaned.slice(start, cleaned.lastIndexOf("}") + 1));
}

const SIGNATURE_FR = "Chaleureusement,<br>__<br><b>Gabriel Gouveia</b><br>Co-fondateur<br>Lasclay.com";
const SELF = ["hey@lasclay.com", "admin@lasclay.com", "operations@lasclay.com", "lasclay"];
const isUs = (m) => SELF.includes((m.from_field?.address || "").toLowerCase()) || !!m.author?.name;

function threadText(conv, msgs, bodies) {
  const lignes = [];
  for (const m of msgs) {
    const who = isUs(m) ? "NOUS" : `CLIENT (${m.from_field?.name || m.from_field?.address || "?"})`;
    const d = m.delivered_at ? new Date(m.delivered_at * 1000).toISOString().slice(0, 10) : "?";
    lignes.push(`[${d}] ${who}: ${cleanBody(bodies.get(m.id) || m.preview || "") || "(vide)"}`);
  }
  return lignes.join("\n").slice(0, 12000);
}

(async () => {
  console.log("=== Lasclay prevente.js v1 ===");
  console.log(DRY_RUN ? "=== MODE SIMULATION (aucun brouillon créé) ===" : "=== MODE RÉEL ===");
  console.log(`Boîte: ${TEAM.slice(0, 8)}… | DRAFT_LIMIT: ${DRAFT_LIMIT || "aucun"} | Modèle: ${MODEL}`);

  const inbox = await listByFilter(`team_inbox=${TEAM}`);
  console.log(`${inbox.length} fil(s) ouverts dans la boîte.`);

  let analyses = 0, crees = 0, ecartes = 0, routes = 0, dejaBrouillon = 0, errors = 0;

  for (const conv of inbox) {
    if (DRAFT_LIMIT > 0 && crees >= DRAFT_LIMIT) { console.log("Plafond de brouillons atteint."); break; }
    if ((conv.drafts_count || 0) > 0) { dejaBrouillon++; continue; }
    try {
      const msgs = await listThreadMessages(conv.id);
      if (msgs.length === 0) continue;
      const last = msgs[msgs.length - 1];
      if (isUs(last)) { ecartes++; continue; } // dernier mot à nous: rien à faire

      const bodies = await fetchBodies(msgs.map((m) => m.id));
      const subj = conv.subject || conv.latest_message_subject || "";
      const user = `SUJET: ${subj}\n\nFIL:\n${threadText(conv, msgs, bodies)}`;
      analyses++;

      let out;
      try { out = parseJsonLoose(await claude(user)); }
      catch (e) { errors++; console.warn(`  ${conv.id}: parse/appel échoué (${e.message})`); continue; }

      const action = out.action || "rien";

      // CAS 3: rien à faire (ajustement de code rabais, hors sujet, etc.)
      if (action === "rien") {
        ecartes++;
        console.log(`[rien] ${subj.slice(0, 50)} → ${out.raison || ""}`);
        continue;
      }

      // CAS 2: router vers pré-achat (client n'a pas pu commander / a besoin d'info pour commander)
      if (action === "router_preachat") {
        routes++;
        if (DRY_RUN) {
          console.log(`[DRY route→pré-achat] ${subj.slice(0, 50)} → ${out.raison || ""}`);
          continue;
        }
        try {
          await apiPost("/posts", {
            posts: {
              conversation: conv.id, organization: ORG,
              add_shared_labels: [LABEL_PREACHAT],
              markdown: "_Routé vers Vente - info pré-achat (client n'a pas pu commander / besoin d'info)._",
              notification: { title: "Tri", body: "Routé vers pré-achat." },
            },
          });
          console.log(`[route→pré-achat] ${subj.slice(0, 50)}`);
        } catch (e) { errors++; console.warn(`  label pré-achat échoué sur ${conv.id}: ${e.message}`); }
        continue;
      }

      // CAS 1: rappel de prévente (brouillon)
      if (!out.brouillon) {
        ecartes++;
        console.log(`[skip] ${subj.slice(0, 50)} → action rappel mais brouillon vide`);
        continue;
      }

      const toAddr = last.from_field?.address;
      const corpsHtml = sanit(out.brouillon).replace(/\n/g, "<br>")
        .replace(/(https?:\/\/[^\s<>"]+)/g, (u) => { const c = u.replace(/[.,;:)]+$/, ""); return `<a href="${c}">${c}</a>${u.match(/[.,;:)]+$/)?.[0] || ""}`; });
      const body = corpsHtml + `<br><br>${SIGNATURE_FR}`;

      if (DRY_RUN) {
        crees++;
        console.log(`\n[DRY ${crees}] ${subj.slice(0, 55)} | to: ${toAddr || "?"} | prénom: ${out.prenom}`);
        console.log(`---\n${out.brouillon}\n---`);
        continue;
      }

      await apiPost("/drafts", {
        drafts: {
          conversation: conv.id, organization: ORG,
          from_field: { address: EXPORT_FROM },
          to_fields: toAddr ? [{ address: toAddr }] : undefined,
          subject: subj ? `Re: ${subj.replace(/^re:\s*/i, "")}` : undefined,
          body,
          quote_previous_message: true,
          // PAS de send: jamais d'envoi automatique.
        },
      });
      crees++;
      console.log(`[brouillon ${crees}] ${subj.slice(0, 55)} → ${out.prenom}`);
    } catch (e) { errors++; console.warn(`  fil ${conv.id} sauté: ${e.message}`); }
  }

  console.log(`\nBilan: ${analyses} analysé(s), ${crees} rappel(s)${DRY_RUN ? " (simulé)" : ""}, ${routes} routé(s) pré-achat, ${ecartes} écarté(s), ${dejaBrouillon} avec brouillon existant, ${errors} erreur(s).`);
  console.log("Run terminé.");
})().catch((e) => { console.error("Erreur fatale:", e.message); process.exit(1); });
