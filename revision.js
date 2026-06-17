/**
 * Lasclay — revision.js
 * ---------------------
 * Ramasse les fils étiquetés « Draft AI Révisé », et pour chacun extrait:
 *   - le sujet et l'adresse du client (anonymisée: prénom + initiale),
 *   - le brouillon IA tel qu'il a été créé,
 *   - tous les commentaires internes postés APRÈS la création du brouillon
 *     (les corrections de Gabriel, donc; les notes ⚠️ « Support IA » sont filtrées),
 *   - une étiquette « 100% » si un commentaire correspond exactement.
 *
 * Sortie: un rapport markdown déposé en brouillon dans « Archives support »,
 *         qui me servira à proposer la v2.5 de support.js.
 *
 * Aucun envoi, aucun draft de réponse, aucune modification de fil.
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement:
 *   MISSIVE_TOKEN                          requis
 *   REVISED_LABEL                          défaut: « Draft AI Révisé » (019ed5a7-…)
 *   EXPORT_CONV, MISSIVE_ORG, EXPORT_FROM  overrides
 */

const TOKEN = process.env.MISSIVE_TOKEN;
const REVISED_LABEL = process.env.REVISED_LABEL || "019ed5a7-2515-7bbf-8f62-b1866e4e8b8f";
const EXPORT_CONV = process.env.EXPORT_CONV || "019eb488-6d42-7195-a2ae-11751d0a7a27"; // Archives support
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36";
const EXPORT_FROM = process.env.EXPORT_FROM || "hey@lasclay.com";

const API = "https://public.missiveapp.com/v1";
const mHeaders = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (!TOKEN) { console.error("Manque MISSIVE_TOKEN."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Appels Missive (patron éprouvé) ---
async function api(path) {
  let netTries = 0;
  while (true) {
    await sleep(260);
    let res;
    try { res = await fetch(`${API}${path}`, { headers: mHeaders }); }
    catch (e) {
      if (++netTries > 5) throw new Error(`${path} → réseau: ${e.message}`);
      console.warn(`Réseau (${e.message}), tentative ${netTries}/5…`);
      await sleep(netTries * 10000);
      continue;
    }
    if (res.status === 429) { await sleep(30000); continue; }
    if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
    return res.json();
  }
}

async function apiPost(path, body) {
  const payload = JSON.stringify(body);
  await sleep(260);
  const res = await fetch(`${API}${path}`, { method: "POST", headers: mHeaders, body: payload });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json().catch(() => ({}));
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

async function listComments(convId) {
  const byId = new Map();
  let until = null;
  while (true) {
    // L'endpoint /comments plafonne limit à 10 (contrairement aux autres: max 50).
    let path = `/conversations/${convId}/comments?limit=10`;
    if (until) path += `&until=${until}`;
    const { comments = [] } = await api(path);
    if (comments.length === 0) break;
    const before = byId.size;
    for (const c of comments) byId.set(c.id, c);
    const oldest = comments[comments.length - 1].created_at;
    if (comments.length < 10 || byId.size === before || oldest === until) break;
    until = oldest;
  }
  return [...byId.values()].sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
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
  return [...byId.values()].sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
}

async function listMessages(convId) {
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
        try {
          const r = await api(`/messages/${id}`);
          const m = Array.isArray(r.messages) ? r.messages[0] : r.messages;
          if (m) bodies.set(id, m.body || m.preview || "");
        } catch {}
      }
    }
  }
  return bodies;
}

const SELF = ["hey@lasclay.com", "admin@lasclay.com", "operations@lasclay.com"];
const isUs = (m) => SELF.includes((m.from_field?.address || "").toLowerCase()) || !!m.author?.name;

// --- Anonymisation: prénom + initiale du nom de famille, ou local-part tronqué ---
function anonymize(name, address) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    return parts[0];
  }
  if (address) {
    const local = address.split("@")[0];
    return local.length > 3 ? local.slice(0, 3) + "***" : local;
  }
  return "?";
}

// --- HTML simple → texte lisible ---
function htmlToText(s) {
  if (!s) return "";
  return s.replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
          .replace(/&#39;|&rsquo;/gi, "'").replace(/&quot;/gi, '"')
          .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// --- Run principal ---
(async () => {
  console.log("=== Lasclay revision.js v1.4 ===");
  console.log(`Label révisé: ${REVISED_LABEL}`);

  const revised = await listByFilter(`shared_label=${REVISED_LABEL}`);
  console.log(`${revised.length} fil(s) étiqueté(s) « Draft AI Révisé ».`);
  if (revised.length === 0) { console.log("Rien à analyser."); return; }

  const items = [];
  let cent = 0, withFeedback = 0, noFeedback = 0, errors = 0;

  for (const conv of revised) {
    try {
      const [drafts, comments, msgs] = await Promise.all([
        listDrafts(conv.id), listComments(conv.id), listMessages(conv.id),
      ]);
      // Brouillon IA: le plus ancien créé (le plus récent serait une révision humaine éventuelle).
      const draft = drafts[0];
      if (!draft) { console.warn(`  ${conv.id}: aucun brouillon trouvé`); continue; }
      const draftCreated = draft.created_at || 0;

      // Note ⚠️ IA: posée par « Support IA » dans la fenêtre de création du brouillon.
      // (Auteur du commentaire: champ rendu par Missive — vérifié ci-dessous.)
      const isBot = (c) => /support\s*ia/i.test(c.author?.name || c.user?.name || c.username || "");
      const aiNotes = comments.filter((c) => isBot(c)).map((c) => htmlToText(c.body || c.text || "")).filter(Boolean);

      // Corrections humaines: commentaires non-bot postés APRÈS le brouillon.
      const feedback = comments
        .filter((c) => (c.created_at || 0) >= draftCreated && !isBot(c))
        .map((c) => htmlToText(c.body || c.text || "").trim())
        .filter(Boolean);

      const est100 = feedback.some((f) => /^\s*100\s*%\s*\.?\s*$/.test(f));
      if (est100) cent++; else if (feedback.length > 0) withFeedback++; else noFeedback++;

      // Fil ENTIER (tous les messages antérieurs au brouillon), pour le contexte maximal.
      // On marque ceux que support.js n'avait PAS montrés à Sonnet (hors fenêtre premier + 11 derniers),
      // pour garder la rigueur d'analyse sans amputer le contexte humain.
      const beforeDraft = msgs.filter((m) => (m.delivered_at || m.created_at || 0) < draftCreated);
      const vusParModele = new Set(
        (beforeDraft.length > 12 ? [beforeDraft[0], ...beforeDraft.slice(-11)] : beforeDraft).map((m) => m.id)
      );
      const bodies = await fetchBodies(beforeDraft.map((m) => m.id));

      const filLignes = [];
      for (const m of beforeDraft) {
        const d = m.delivered_at ? new Date(m.delivered_at * 1000).toISOString().slice(0, 10) : "?";
        const who = isUs(m) ? "NOUS" : `CLIENT (${anonymize(m.from_field?.name, m.from_field?.address)})`;
        const att = (m.attachments || []).map((a) => a.filename).filter(Boolean);
        const attTxt = att.length ? ` [PJ: ${att.join(", ")}]` : "";
        const nonVu = vusParModele.has(m.id) ? "" : " [NON VU PAR LE MODÈLE]";
        filLignes.push(`[${d}] ${who}${attTxt}${nonVu}: ${htmlToText(bodies.get(m.id) || m.preview || "") || "(sans texte)"}`);
      }

      // Catégorie déduite du label de tri posé par support.js (mapping de TRI_LABELS).
      const TRI = {
        "4bdc81b5-74a9-4246-9ced-3d9c1b13b0ed": "suivi_livraison OU modification_annulation_commande",
        "b2ff154e-65f1-498f-8bfd-40c52854fd69": "retour_echange_remboursement OU probleme_produit_garantie",
        "cf24d86b-ba38-41b2-bed7-0a4f43b1b2e4": "question_pre_achat",
        "7150fdfb-af9c-4844-835d-96c73da211d6": "douane_international",
      };
      // L'objet de la liste (filtre shared_label) ne contient pas toujours team/shared_labels.
      // Repli: GET du fil complet pour garantir le contexte.
      let full = conv;
      if (!conv.team && !conv.shared_labels && !conv.labels) {
        try {
          const r = await api(`/conversations/${conv.id}`);
          full = (Array.isArray(r.conversations) ? r.conversations[0] : r.conversations) || conv;
        } catch {}
      }
      const labels = (full.shared_labels || full.labels || []).map((l) => l.id || l);
      const triHits = labels.map((id) => TRI[id]).filter(Boolean);
      const categorieDeduite = triHits[0] || "(aucun label de tri posé: wholesale_b2b, autre, ou catégorie non triée)";
      // Tous les labels partagés du fil, pour traçabilité.
      const labelNames = (full.shared_labels || []).map((l) => l.name).filter(Boolean);

      const lastMsg = msgs[msgs.length - 1] || {};
      items.push({
        id: conv.id,
        subject: conv.subject || conv.latest_message_subject || "(sans sujet)",
        client: anonymize(lastMsg.from_field?.name, lastMsg.from_field?.address),
        team: full.team?.name || "?",
        labels: labelNames,
        categorieDeduite,
        fil: filLignes.join("\n").slice(0, 40000),
        draft: htmlToText(draft.body || ""),
        aiNotes,
        feedback,
        est100,
      });
    } catch (e) { errors++; console.warn(`  ${conv.id}: ${e.message}`); }
  }

  // Tri: les fils AVEC commentaire d'abord (matière à analyser), puis les 100%, puis le reste.
  items.sort((a, b) => {
    const sa = a.feedback.length > 0 && !a.est100 ? 0 : a.est100 ? 1 : 2;
    const sb = b.feedback.length > 0 && !b.est100 ? 0 : b.est100 ? 1 : 2;
    return sa - sb;
  });

  // Rapport
  const lines = [];
  lines.push(`# Révision des brouillons IA — échantillon`);
  lines.push("");
  lines.push(`Généré le ${new Date().toISOString().slice(0, 16).replace("T", " ")} à partir des fils étiquetés « Draft AI Révisé ».`);
  lines.push("");
  lines.push(`**Bilan**: ${items.length} fil(s) révisé(s), ${withFeedback} avec correction, ${cent} marqués « 100% », ${noFeedback} sans note.`);
  lines.push("");
  lines.push("---");
  lines.push("");
  for (const it of items) {
    lines.push(`## ${it.client} | ${it.team} | ${it.est100 ? "✅ 100%" : it.feedback.length > 0 ? "✏️ correction" : "⚪ sans note"}`);
    lines.push(`**Sujet**: ${it.subject}`);
    lines.push(`**Équipe actuelle**: ${it.team}${it.labels.length ? ` | **Labels**: ${it.labels.join(", ")}` : ""}`);
    lines.push(`**Catégorie déduite (tri IA)**: ${it.categorieDeduite}`);
    lines.push("");
    lines.push(`**Fil tel que vu par le modèle**:`);
    lines.push("```");
    lines.push(it.fil || "(aucun message antérieur trouvé)");
    lines.push("```");
    lines.push("");
    lines.push(`**Brouillon IA**:`);
    lines.push("```");
    lines.push(it.draft || "(brouillon vide)");
    lines.push("```");
    if (it.aiNotes.length > 0) {
      lines.push("");
      lines.push(`**Note interne IA (⚠️)**:`);
      for (const n of it.aiNotes) lines.push("> " + n.replace(/\n/g, "\n> "));
    }
    if (it.feedback.length > 0 && !it.est100) {
      lines.push("");
      lines.push(`**Correction(s) humaine(s)**:`);
      for (const f of it.feedback) lines.push("> " + f.replace(/\n/g, "\n> "));
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  const report = lines.join("\n");

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const filename = `revision_echantillon_${stamp}.md`;
  // Le rapport est joint en pièce jointe markdown, pour le téléversement direct.
  await apiPost("/drafts", {
    drafts: {
      conversation: EXPORT_CONV, organization: ORG,
      from_field: { address: EXPORT_FROM }, to_fields: [{ address: EXPORT_FROM }],
      subject: `[NE PAS ENVOYER] Révision échantillon (${items.length} fils, ${withFeedback} avec correction)`,
      body: `Rapport de révision pour raffiner support.js.<br><br>` +
            `Bilan: ${items.length} fil(s), ${withFeedback} avec correction, ${cent} à 100%, ${noFeedback} sans note.<br><br>` +
            `Le rapport complet est en pièce jointe (${filename}).`,
      attachments: [{
        base64_data: Buffer.from(report, "utf8").toString("base64"),
        filename,
      }],
    },
  });
  console.log(`Rapport déposé en brouillon dans « Archives support »: ${filename}`);
  console.log(`Bilan: ${items.length} fil(s), ${withFeedback} avec correction, ${cent} à 100%, ${noFeedback} sans note, ${errors} erreur(s).`);
  console.log("Run terminé.");
})().catch((e) => { console.error("Erreur fatale:", e.message); process.exit(1); });
