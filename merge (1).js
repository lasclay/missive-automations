/**
 * Missive — merge.js (v1)
 * --------------------------------------------------------------------------
 * Un seul cron qui REMPLACE le webhook (missive-auto-flag.js), la rule Missive
 * et le balayage (backfill.js). Il détecte les fils en doublon par empreinte
 * client et pose le label « À fusionner ». La fusion automatique est codée mais
 * DORMANTE par défaut (MERGE=false) : phase 1 = étiquetage seulement.
 *
 * Détection : reprise de la logique éprouvée de backfill.js (3 empreintes
 * courriel / nom / numéro de commande L-XXXXX, regroupées par union-find).
 * Le regroupement se fait sur l'IDENTITÉ du client, pas sur la boîte : un client
 * avec un fil dans LAS Support et un autre dans Operations est détecté comme
 * doublon, où qu'il soit, et les deux reçoivent le label.
 *
 * Node 18+. Aucune dépendance.
 *
 * Variables d'environnement :
 *   MISSIVE_TOKEN           token API (missive_pat-...)                [requis]
 *   MISSIVE_SELF_ADDRESSES  tes adresses (hey@, admin@, operations@),
 *                           séparées par des virgules                 [requis]
 *   MISSIVE_LABEL_ID        override du label (sinon le défaut « À fusionner »
 *                           7c922a57-... codé en dur)               [facultatif]
 *   MISSIVE_TEAMS           ids d'équipes à ratisser, séparés par des virgules.
 *                           Si absent, le script LISTE les équipes via /teams et
 *                           ratisse toutes celles dont le nom n'est PAS « MERGE ».
 *   MISSIVE_ORG             id d'organisation (défaut Lasclay)        [facultatif]
 *   DRY_RUN                 "true" = simulation totale (rien posé, rien fusionné).
 *                           DÉFAUT "false" : la phase 1 (étiquetage) est réversible,
 *                           donc on l'exécute. En phase 2 (MERGE=true), METTRE
 *                           DRY_RUN=true au premier essai.
 *   MERGE                   "true" = phase 2, fusionne vraiment.   DÉFAUT false.
 *   MERGE_ONLY_EMAIL        "true" (défaut) = ne fusionne QUE les groupes reliés
 *                           par adresse courriel exacte. Les groupes reliés
 *                           seulement par nom ou commande sont étiquetés mais
 *                           JAMAIS fusionnés automatiquement.
 *   MERGE_LIMIT             plafond du nombre de fusions par run (0 = illimité).
 *
 * ATTENTION : la FUSION (POST /conversations/:id/merge) est IRRÉVERSIBLE et n'a
 * JAMAIS été exécutée chez Lasclay (codée selon la doc). Passe à MERGE=true en
 * simulation d'abord (DRY_RUN=true), puis MERGE_LIMIT=3 en réel avant le volume.
 */

const VERSION = "v1";

const TOKEN = process.env.MISSIVE_TOKEN;
const LABEL = process.env.MISSIVE_LABEL_ID || "7c922a57-5644-4d88-b731-5a040cbb681a"; // « À fusionner »
const ORG = process.env.MISSIVE_ORG || "d2b9b52d-ceff-4811-aea7-1f092ec95f36"; // Lasclay
const DRY_RUN = (process.env.DRY_RUN || "false").toLowerCase() !== "false"; // défaut: réel (étiquetage réversible)
const MERGE = (process.env.MERGE || "").toLowerCase() === "true"; // défaut: phase 1 (pas de fusion)
const MERGE_ONLY_EMAIL = (process.env.MERGE_ONLY_EMAIL || "true").toLowerCase() !== "false";
const MERGE_LIMIT = parseInt(process.env.MERGE_LIMIT || "0", 10) || 0; // 0 = illimité

// Équipe à NE JAMAIS ratisser (destination des fils déjà fusionnés : la scraper serait circulaire).
const EXCLUDE_TEAM_NAME = "merge";

const ENV_TEAMS = (process.env.MISSIVE_TEAMS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SELF = (process.env.MISSIVE_SELF_ADDRESSES || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Noms de nos propres pages/comptes sociaux (l'expéditeur y est un nom de page, pas une adresse).
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

// Normalisation pour comparer les noms (minuscules, sans accents, espaces compactés).
const norm = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
if (SELF.length === 0) {
  console.error("Manque MISSIVE_SELF_ADDRESSES (tes propres adresses, séparées par des virgules).");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET avec respect du débit (~260 ms), retry 429 ET retry réseau (fetch failed).
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

// POST avec mêmes garde-fous. Retourne { ok, status, json }.
async function apiPost(path, body, tries = 0) {
  await sleep(260);
  let res;
  try {
    res = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (e) {
    if (tries < 4) {
      console.warn(`Réseau (${e.message}) sur POST ${path}, pause ${(tries + 1) * 5}s...`);
      await sleep((tries + 1) * 5000);
      return apiPost(path, body, tries + 1);
    }
    throw e;
  }
  if (res.status === 429) {
    console.warn("Limite de débit atteinte, pause 30 s...");
    await sleep(30000);
    return apiPost(path, body, tries);
  }
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }
  if (!res.ok) console.error(`POST ${path} → ${res.status} ${text}`);
  return { ok: res.ok, status: res.status, json, text };
}

// Résout les équipes à ratisser : MISSIVE_TEAMS si fourni, sinon toutes celles
// de /teams dont le nom n'est pas « MERGE ».
async function resolveTeams() {
  if (ENV_TEAMS.length > 0) {
    console.log(`Équipes (MISSIVE_TEAMS) : ${ENV_TEAMS.length}`);
    return ENV_TEAMS.map((id) => ({ id, name: id }));
  }
  const data = await api(`/teams`);
  const all = data.teams || data || [];
  const kept = all.filter((t) => norm(t.name) !== EXCLUDE_TEAM_NAME);
  const dropped = all.length - kept.length;
  console.log(
    `Équipes via /teams : ${all.length} au total, ${kept.length} ratissées` +
      (dropped ? ` (${dropped} « MERGE » exclue)` : "")
  );
  for (const t of kept) console.log(`  ${t.id}  →  ${t.name || "(sans nom)"}`);
  return kept.map((t) => ({ id: t.id, name: t.name }));
}

// Pagination des conversations OUVERTES d'une équipe, dédoublonnées par ID.
async function paginateInto(byId, teamId) {
  let until = null;
  let pages = 0;
  const limit = 50;
  while (true) {
    let path = `/conversations?team_inbox=${teamId}&limit=${limit}`;
    if (until) path += `&until=${until}`;
    const { conversations = [] } = await api(path);
    if (conversations.length === 0) break;
    pages++;
    for (const c of conversations) byId.set(c.id, c);
    const oldest = conversations[conversations.length - 1].last_activity_at;
    if (conversations.length < limit || oldest === until) break;
    until = oldest;
  }
  return pages;
}

async function collectOpenConversations(teams) {
  const byId = new Map();
  for (const t of teams) {
    try {
      const pages = await paginateInto(byId, t.id);
      console.log(`  ${t.name || t.id} : ${pages} page(s)`);
    } catch (e) {
      // Une équipe inaccessible ne doit pas tuer le run.
      console.warn(`  ${t.name || t.id} : ignorée (${e.message})`);
    }
  }
  return [...byId.values()];
}

function extractOrders(text) {
  const found = (text || "").match(ORDER_RE) || [];
  return found.map((s) => s.toUpperCase());
}

// Empreintes d'un fil : email + nom (normalisé) du 1er expéditeur EXTERNE, et
// l'ensemble des numéros de commande trouvés (sujet + corps).
async function fingerprints(conv) {
  const { messages = [] } = await api(`/conversations/${conv.id}/messages?limit=10`);
  const sorted = messages
    .slice()
    .sort((a, b) => (a.delivered_at || a.created_at || 0) - (b.delivered_at || b.created_at || 0));

  let email = null;
  let name = null;
  const orders = new Set();

  for (const o of extractOrders(conv.subject)) orders.add(o);

  for (const m of sorted) {
    for (const o of extractOrders(m.body || m.preview)) orders.add(o);
    for (const o of extractOrders(m.subject)) orders.add(o);

    const addr = m.from_field?.address?.toLowerCase() || null;
    const dispName = norm(m.from_field?.name);
    const isSelf = (addr && SELF.includes(addr)) || (dispName && SELF_NAMES.has(dispName));
    if (isSelf) continue;

    if (!email && addr) email = addr;
    if (!name && dispName) name = dispName;
  }

  return { email, name, orders: [...orders] };
}

// Le fil porte-t-il déjà le label « À fusionner » (best effort, selon ce que la
// liste expose) ?
function hasMergeLabel(conv) {
  const labels = conv.shared_labels || conv.shared_label_ids || [];
  return labels.some((l) => (l && (l.id || l)) === LABEL);
}

// Pose le label sur un fil.
async function addLabel(conversationId, count) {
  return apiPost(`/posts`, {
    posts: {
      conversation: conversationId,
      organization: ORG,
      add_shared_labels: [LABEL],
      reopen: true, // garde un fil fermé fermé (convention refresh.js)
      notification: {
        title: "Doublon détecté",
        body: `${count} fils du même contact, à fusionner.`,
      },
      text: `⚠️ Doublon détecté (${count} fils du même contact), à fusionner.`,
    },
  });
}

// Retire le label d'un fil (quand il n'a plus de jumeau).
async function removeLabel(conversationId) {
  return apiPost(`/posts`, {
    posts: {
      conversation: conversationId,
      organization: ORG,
      remove_shared_labels: [LABEL],
      reopen: true,
      notification: { title: "Doublon résolu", body: "Plus qu'un fil pour ce contact." },
      text: "✅ Plus qu'un fil ouvert pour ce contact.",
    },
  });
}

// Fusionne la source dans la cible (survivant). IRRÉVERSIBLE.
async function mergeInto(sourceId, targetId) {
  const r = await apiPost(`/conversations/${sourceId}/merge`, { target: targetId });
  const returnedId = r.json?.conversation?.id || r.json?.id || null;
  return { ok: r.ok, returnedId };
}

async function main() {
  console.log(`=== Lasclay merge.js ${VERSION} ===`);
  console.log(DRY_RUN ? "MODE SIMULATION (rien posé, rien fusionné)" : "MODE RÉEL");
  console.log(`Label : ${LABEL}`);
  console.log(`Phase : ${MERGE ? "2 (FUSION active)" : "1 (étiquetage seulement)"}`);
  if (MERGE) {
    console.log(
      `  MERGE_ONLY_EMAIL=${MERGE_ONLY_EMAIL} | MERGE_LIMIT=${MERGE_LIMIT || "illimité"}`
    );
  }

  // 1) Équipes + conversations ouvertes
  const teams = await resolveTeams();
  console.log("Récupération des conversations ouvertes...");
  const convs = await collectOpenConversations(teams);
  console.log(`${convs.length} conversation(s) ouverte(s) unique(s).`);

  // 2) Empreintes
  const fps = [];
  let i = 0;
  for (const c of convs) {
    i++;
    if (i % 50 === 0) console.log(`  ...${i}/${convs.length} analysées`);
    fps.push(await fingerprints(c));
  }

  // 3) Union-Find : relier les fils qui partagent une empreinte
  const parent = convs.map((_, idx) => idx);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const link = (keyFn) => {
    const seen = new Map();
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

  const groups = new Map();
  convs.forEach((_, idx) => {
    const root = find(idx);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(idx);
  });
  const dupes = [...groups.values()].filter((g) => g.length >= 2);

  // Ensemble des ids qui DOIVENT porter le label (membres d'un groupe de 2+)
  const shouldLabel = new Set();
  for (const g of dupes) for (const idx of g) shouldLabel.add(convs[idx].id);

  console.log(`\n${dupes.length} groupe(s) en doublon :`);
  for (const g of dupes) {
    const emails = new Set(g.map((idx) => fps[idx].email).filter(Boolean));
    const names = new Set(g.map((idx) => fps[idx].name).filter(Boolean));
    const orders = new Set(g.flatMap((idx) => fps[idx].orders));
    const parEmail = emails.size === 1 && g.every((idx) => fps[idx].email);
    const desc = [
      emails.size ? `courriels: ${[...emails].join(", ")}` : "",
      names.size ? `noms: ${[...names].join(" | ")}` : "",
      orders.size ? `commandes: ${[...orders].join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("  •  ");
    console.log(`  ${g.length} fils ${parEmail ? "[email]" : "[nom/commande]"} → ${desc}`);
  }

  // 4) Phase 1 : étiquetage
  let posed = 0;
  let retires = 0;

  for (const g of dupes) {
    for (const idx of g) {
      const conv = convs[idx];
      if (hasMergeLabel(conv)) continue; // déjà étiqueté (best effort)
      if (DRY_RUN) {
        posed++;
        continue;
      }
      const r = await addLabel(conv.id, g.length);
      if (r.ok) posed++;
    }
  }

  // Retrait des labels devenus inutiles : on se limite aux fils OUVERTS qu'on a
  // ratissés (donc dans byId), pour ne jamais toucher un fil fermé.
  const scrapedIds = new Set(convs.map((c) => c.id));
  try {
    let until = null;
    const labeledOpenToClean = [];
    while (true) {
      let path = `/conversations?shared_label=${LABEL}&limit=50`;
      if (until) path += `&until=${until}`;
      const { conversations = [] } = await api(path);
      if (conversations.length === 0) break;
      for (const c of conversations) {
        if (scrapedIds.has(c.id) && !shouldLabel.has(c.id)) labeledOpenToClean.push(c.id);
      }
      const oldest = conversations[conversations.length - 1].last_activity_at;
      if (conversations.length < 50 || oldest === until) break;
      until = oldest;
    }
    for (const id of labeledOpenToClean) {
      if (DRY_RUN) {
        retires++;
        continue;
      }
      const r = await removeLabel(id);
      if (r.ok) retires++;
    }
  } catch (e) {
    console.warn(`Nettoyage des labels orphelins ignoré (${e.message}).`);
  }

  console.log(
    `\nÉtiquetage : ${posed} label(s) ${DRY_RUN ? "à poser" : "posé(s)"}, ` +
      `${retires} ${DRY_RUN ? "à retirer" : "retiré(s)"}.`
  );

  // 5) Phase 2 : fusion (seulement si MERGE=true)
  if (!MERGE) {
    console.log("\nPhase 1 seulement (MERGE absent/false). Aucune fusion.");
    console.log("Run terminé.");
    return;
  }

  console.log("\n=== Phase 2 : fusion ===");
  let fusions = 0;
  for (const g of dupes) {
    if (MERGE_LIMIT && fusions >= MERGE_LIMIT) {
      console.log(`Plafond MERGE_LIMIT=${MERGE_LIMIT} atteint, arrêt des fusions.`);
      break;
    }
    const emails = new Set(g.map((idx) => fps[idx].email).filter(Boolean));
    const parEmail = emails.size === 1 && g.every((idx) => fps[idx].email);
    if (MERGE_ONLY_EMAIL && !parEmail) {
      console.log(`  Groupe non fusionné (relié par nom/commande, pas par courriel exact) : étiqueté seulement.`);
      continue;
    }

    // Survivant = activité la plus récente. Les autres y sont fusionnés.
    const ordered = g
      .slice()
      .sort(
        (a, b) =>
          (convs[b].last_activity_at || 0) - (convs[a].last_activity_at || 0)
      );
    const survivor = convs[ordered[0]];
    const sources = ordered.slice(1).map((idx) => convs[idx]);

    for (const src of sources) {
      if (MERGE_LIMIT && fusions >= MERGE_LIMIT) break;
      if (DRY_RUN) {
        console.log(`  [SIMULATION] fusionner ${src.id} → ${survivor.id}`);
        fusions++;
        continue;
      }
      const r = await mergeInto(src.id, survivor.id);
      if (r.ok) {
        fusions++;
        console.log(`  fusionné ${src.id} → ${survivor.id} (id résultant: ${r.returnedId || "?"})`);
      } else {
        console.error(`  échec fusion ${src.id} → ${survivor.id}`);
      }
    }
  }
  console.log(`\nFusion : ${fusions} ${DRY_RUN ? "simulée(s)" : "exécutée(s)"}.`);
  console.log("Run terminé.");
}

main().catch((e) => {
  console.error("Erreur :", e.message);
  process.exit(1);
});
