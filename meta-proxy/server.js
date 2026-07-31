/**
 * Lasclay — meta-proxy (v1)
 * --------------------------------------------------------------------------
 * Proxy HTTP DÉDIÉ À META : Facebook, Instagram et Meta Ads, sur un service
 * Render SÉPARÉ du connectors-proxy général. Même raisonnement que le
 * finance-proxy : ce périmètre est sensible et vit donc seul.
 *
 *   - le jeton Meta ne cohabite avec AUCUN autre connecteur ;
 *   - le secret d'appel (META_PROXY_SECRET) est distinct du GENERAL_PROXY_SECRET
 *     et n'a AUCUN repli : sans lui, le service refuse de démarrer ;
 *   - les environnements opérationnels (cron support.js, etc.) ne reçoivent
 *     JAMAIS ce secret — une fuite de leur env n'ouvre ni le budget publicitaire,
 *     ni la messagerie, ni la voix publique de la marque.
 *
 * POURQUOI C'EST SENSIBLE (trois surfaces, trois garde-fous) :
 *   1. ARGENT   — créer ou activer une campagne engage du budget réel.
 *   2. PUBLIC   — publier, commenter ou supprimer parle au nom de Lasclay,
 *                 publiquement et irréversiblement.
 *   3. PRIVÉ    — la messagerie touche des conversations clients (et les règles
 *                 Meta : fenêtre de 24 h, tags autorisés).
 * Chaque action porte donc un NIVEAU DE RISQUE — mais l'ÉCRITURE EST OUVERTE
 * PAR DÉFAUT : le service exécute, et les interrupteurs servent à FERMER, pas
 * à ouvrir.
 *   META_READONLY=1     → seules les lectures passent (mode audit/veille).
 *   META_BLOCK_SPEND=1  → bloque ce qui engage du budget.
 *   META_BLOCK_DELETE=1 → bloque ce qui détruit (post, commentaire, objet pub).
 *
 * DRY-RUN : n'importe quelle action accepte « "dryRun": true ». Le proxy valide
 * les params, construit l'appel Graph EXACT… et ne l'envoie pas : il renvoie
 * l'aperçu (méthode, chemin, query, corps, jeton utilisé). C'est le mode
 * d'entraînement — on voit ce qui partirait avant de le laisser partir. Il vaut
 * pour toutes les actions, y compris les lectures.
 *
 * PÉRIMÈTRE D'ACTIFS : META_ALLOWED_PAGE_IDS / META_ALLOWED_AD_ACCOUNT_IDS
 * limitent, si définis, les Pages et comptes publicitaires adressables — le
 * proxy refuse un id hors liste avant même d'appeler Graph.
 *
 * ROUTAGE (pas de préfixe connecteur — service mono-usage) :
 *   GET  /health              → sonde (sans auth)
 *   GET  /actions             → liste des actions + niveau de risque (sans secret)
 *   GET  /token-status        → état du jeton Meta (sans jamais exposer sa valeur)
 *   POST /:action  {..params} → exécute (en-tête X-Proxy-Secret: META_PROXY_SECRET)
 *
 * Cinq usages couverts : (1) audit et analyse des campagnes, (2) gestion des
 * campagnes, (3) gestion des commentaires, (4) gestes automatisés, (5) veille.
 *
 * ⚠️ CONDITIONS META : les gestes automatisés ne sont légitimes que sur NOS
 * PROPRES actifs. Automatiser des « j'aime », des commentaires ou des messages
 * sur les contenus de tiers, et envoyer des messages non sollicités, violent les
 * Platform Terms et exposent l'app à la suspension. Messenger : répondre dans
 * les 24 h suivant le dernier message du client, au-delà uniquement avec un tag
 * autorisé (HUMAN_AGENT, POST_PURCHASE_UPDATE, ACCOUNT_UPDATE,
 * CONFIRMED_EVENT_UPDATE).
 *
 * Le jeton ne sort JAMAIS du proxy : toute réponse est nettoyée de ses champs
 * « access_token » (ex. /me/accounts renvoie les jetons de Page).
 *
 * Variables d'environnement (Render) :
 *   META_PROXY_SECRET        secret d'appel de CE service (aucun repli)        [requis]
 *   META_ACCESS_TOKEN        jeton longue durée d'un utilisateur système       [requis]
 *                            Business Manager (portées : ads_read,
 *                            ads_management, pages_show_list,
 *                            pages_read_engagement, pages_manage_posts,
 *                            pages_manage_engagement, pages_messaging,
 *                            read_insights, business_management +
 *                            instagram_basic / instagram_manage_comments).
 *   META_PAGE_TOKEN          jeton de Page si distinct du précédent           [facultatif]
 *   META_PAGE_ID             Page Facebook par défaut                         [recommandé]
 *   META_AD_ACCOUNT_ID       compte publicitaire par défaut (act_123456789)   [recommandé]
 *   META_IG_USER_ID          compte Instagram Business relié à la Page        [facultatif]
 *   META_ALLOWED_PAGE_IDS    liste blanche de Pages (séparées par des virgules) [facultatif]
 *   META_ALLOWED_AD_ACCOUNT_IDS  liste blanche de comptes publicitaires        [facultatif]
 *   META_READONLY            "1" → lectures seulement                         [facultatif]
 *   META_BLOCK_SPEND         "1" → bloque les actions qui engagent du budget  [facultatif]
 *   META_BLOCK_DELETE        "1" → bloque les suppressions                    [facultatif]
 *   META_GRAPH_VERSION       version de l'API Graph (défaut v25.0)            [facultatif]
 *   PORT                     (auto, fourni par Render)
 *
 * Déploiement : New → Web Service, repo lasclay/missive-automations,
 * Root Directory = meta-proxy, Start = node server.js. Voir META_PROXY.md.
 *
 * Node 18+. Aucune dépendance.
 */

const http = require("node:http");
const { AsyncLocalStorage } = require("node:async_hooks");

const SECRET = process.env.META_PROXY_SECRET;
const PORT = process.env.PORT || 3000;
if (!SECRET) { console.error("Manque META_PROXY_SECRET (aucun repli, par design)."); process.exit(1); }

const TOKEN = process.env.META_ACCESS_TOKEN || "";
if (!TOKEN) { console.error("Manque META_ACCESS_TOKEN."); process.exit(1); }
const PAGE_TOKEN = process.env.META_PAGE_TOKEN || TOKEN;

const PAGE_ID = process.env.META_PAGE_ID || "";
const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID || "";
const IG_ID = process.env.META_IG_USER_ID || "";
const V = process.env.META_GRAPH_VERSION || "v25.0";
const BASE = process.env.META_GRAPH_BASE || `https://graph.facebook.com/${V}`;

const vrai = (v) => /^(1|true|oui|yes|on)$/i.test(String(v || ""));
// L'écriture est ouverte par défaut : ces interrupteurs FERMENT.
const READONLY = vrai(process.env.META_READONLY);
const BLOCK_SPEND = vrai(process.env.META_BLOCK_SPEND);
const BLOCK_DELETE = vrai(process.env.META_BLOCK_DELETE);

const liste = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
const PAGES_OK = liste(process.env.META_ALLOWED_PAGE_IDS);
const COMPTES_OK = liste(process.env.META_ALLOWED_AD_ACCOUNT_IDS).map((a) => (a.startsWith("act_") ? a : `act_${a}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function qs(params) {
  if (!params || typeof params !== "object") return "";
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

// Appel HTTP JSON générique avec retry réseau + gestion 429 (Retry-After).
async function httpJson({ method = "GET", url, headers = {}, body }, tries = 0) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Accept: "application/json", ...headers, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (tries < 3) { await sleep((tries + 1) * 2000); return httpJson({ method, url, headers, body }, tries + 1); }
    throw new Error(`réseau: ${e.message}`);
  }
  if (res.status === 429 && tries < 3) {
    const ra = res.headers.get("retry-after");
    const wait = ra && !Number.isNaN(Number(ra)) ? Math.min(Number(ra) + 1, 65) : 10;
    await sleep(wait * 1000);
    return httpJson({ method, url, headers, body }, tries + 1);
  }
  const text = await res.text();
  // Graph renvoie la vraie cause dans error.error_user_msg / error.message : on
  // garde large, un refus tronqué est indébogable (même leçon que le finance-proxy).
  if (!res.ok) {
    let motif = text.slice(0, 2000);
    try {
      const e = JSON.parse(text).error;
      if (e) motif = `${e.type || "erreur"}/${e.code}${e.error_subcode ? `.${e.error_subcode}` : ""} ${e.error_user_msg || e.message}`;
    } catch { /* corps non JSON : on garde le texte brut */ }
    throw new Error(`${method} ${url.replace(/https?:\/\/[^/]+/, "").split("?")[0]} → ${res.status} ${motif}`);
  }
  try { return text ? JSON.parse(text) : {}; } catch { return { raw: text }; }
}

// ==========================================================================
// Helpers Graph
// ==========================================================================

// Graph attend les sous-objets et tableaux SÉRIALISÉS en JSON dans la query
// string (time_range, filtering, breakdowns…). Vide les clés nulles au passage.
const plat = (p) => {
  const out = {};
  for (const [k, v] of Object.entries(p || {})) {
    if (v === null || v === undefined || v === "") continue;
    out[k] = typeof v === "object" ? JSON.stringify(v) : v;
  }
  return out;
};
// Retire des params les clés de routage (elles vont dans le chemin, pas dans la query).
const reste = (p, ...cles) => {
  const out = { ...(p || {}) };
  for (const c of cles) delete out[c];
  return out;
};
// Nettoie récursivement TOUT champ access_token d'une réponse : un secret ne
// doit jamais franchir le proxy, même renvoyé spontanément par Graph.
const sansJetons = (v) => {
  if (Array.isArray(v)) return v.map(sansJetons);
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === "access_token" || k === "page_token") continue;
      out[k] = sansJetons(val);
    }
    return out;
  }
  return v;
};

// Contexte de la requête en cours (dry-run). AsyncLocalStorage plutôt qu'une
// variable de module : deux requêtes concurrentes ne doivent pas se marcher
// dessus entre le début de l'action et l'appel réseau.
const contexte = new AsyncLocalStorage();

// jeton: "page" pour le contenu, les commentaires et la messagerie.
const call = async (method, path, { params, body, jeton } = {}) => {
  const t = jeton === "page" ? PAGE_TOKEN : TOKEN;
  const query = qs(plat(params));
  // DRY-RUN : les params ont été validés, l'appel est entièrement construit —
  // on le décrit au lieu de l'exécuter. Aucun effet de bord, aucun jeton exposé.
  if (contexte.getStore()?.dryRun) {
    return {
      dryRun: true,
      apercu: {
        method,
        url: `${BASE}${path}${query}`,
        path: `/${V}${path}`,
        query: query ? Object.fromEntries(new URLSearchParams(query.slice(1))) : {},
        body: body || null,
        jeton: jeton === "page" ? "jeton de Page" : "jeton principal",
      },
    };
  }
  const data = await httpJson({
    method,
    url: `${BASE}${path}${query}`,
    headers: { Authorization: `Bearer ${t}` },
    body,
  });
  return sansJetons(data);
};
const get = (path, params, jeton) => call("GET", path, { params, jeton });
const post = (path, body, jeton) => call("POST", path, { body: body || {}, jeton });
const del = (path, jeton) => call("DELETE", path, { jeton });

const requis = (p, ...champs) => {
  for (const c of champs) if (!p || p[c] === undefined || p[c] === null || p[c] === "") throw new Error(`${c} requis`);
  return p;
};
const id = (p, champ) => encodeURIComponent(requis(p, champ)[champ]);

// Compte publicitaire : celui des params, sinon celui de l'environnement — et
// toujours vérifié contre la liste blanche si elle est définie.
const compte = (p) => {
  let a = (p && p.adAccountId) || AD_ACCOUNT;
  if (!a) throw new Error("adAccountId requis (ou variable META_AD_ACCOUNT_ID)");
  if (!a.startsWith("act_")) a = `act_${a}`;
  if (COMPTES_OK.length && !COMPTES_OK.includes(a)) {
    throw new Error(`compte publicitaire ${a} hors périmètre (META_ALLOWED_AD_ACCOUNT_IDS)`);
  }
  return encodeURIComponent(a);
};
const page = (p) => {
  const g = String((p && p.pageId) || PAGE_ID || "");
  if (!g) throw new Error("pageId requis (ou variable META_PAGE_ID)");
  if (PAGES_OK.length && !PAGES_OK.includes(g)) {
    throw new Error(`Page ${g} hors périmètre (META_ALLOWED_PAGE_IDS)`);
  }
  return encodeURIComponent(g);
};
const ig = (p) => {
  const g = (p && p.igUserId) || IG_ID;
  if (!g) throw new Error("igUserId requis (ou variable META_IG_USER_ID)");
  return encodeURIComponent(g);
};

// ==========================================================================
// ACTIONS — allowlist. Chaque entrée porte son niveau de risque :
//   lecture     aucun effet de bord
//   ecriture    modifie ou publie (visible, réversible à la main)
//   argent      engage du budget publicitaire        → exige META_ALLOW_SPEND
//   destructeur supprime définitivement              → exige META_ALLOW_DELETE
// ==========================================================================
const A = (risque, doc, run) => ({ risque, doc, run });

const ACTIONS = {
  // ---- Diagnostic / référentiels ----
  me: A("lecture", "identité du jeton", (p) => get("/me", { fields: "id,name", ...reste(p) })),
  pages: A("lecture", "Pages administrées (jetons retirés)", (p) =>
    get("/me/accounts", { fields: "id,name,category,tasks", ...reste(p) })),
  adaccounts: A("lecture", "comptes publicitaires accessibles", (p) =>
    get("/me/adaccounts", { fields: "id,account_id,name,currency,account_status,amount_spent,balance", ...reste(p) })),
  adaccount: A("lecture", "détail d'un compte publicitaire (devise, solde, plafond)", (p) =>
    get(`/${compte(p)}`, { fields: "id,name,currency,account_status,amount_spent,balance,spend_cap,timezone_name", ...reste(p, "adAccountId") })),
  // Lecture générique d'un nœud Graph — aucun effet de bord possible (GET seul).
  read: A("lecture", "lecture générique d'un nœud Graph : nodeId (ex. \"123/comments\"), fields", (p) =>
    get(`/${requis(p, "nodeId").nodeId}`, reste(p, "nodeId"))),

  // ---- 1. AUDIT / ANALYSE DES CAMPAGNES ----
  campaigns: A("lecture", "campagnes du compte : effective_status, fields, limit, after", (p) =>
    get(`/${compte(p)}/campaigns`, {
      fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time,created_time",
      limit: 50, ...reste(p, "adAccountId"),
    })),
  adsets: A("lecture", "ensembles de publicités : campaignId ou adAccountId", (p) =>
    get(p && p.campaignId ? `/${id(p, "campaignId")}/adsets` : `/${compte(p)}/adsets`, {
      fields: "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,billing_event,optimization_goal,bid_strategy,targeting,start_time,end_time",
      limit: 50, ...reste(p, "adAccountId", "campaignId"),
    })),
  ads: A("lecture", "publicités : adsetId, campaignId ou adAccountId", (p) =>
    get(p && p.adsetId ? `/${id(p, "adsetId")}/ads` : p && p.campaignId ? `/${id(p, "campaignId")}/ads` : `/${compte(p)}/ads`, {
      fields: "id,name,adset_id,campaign_id,status,effective_status,creative,created_time",
      limit: 50, ...reste(p, "adAccountId", "adsetId", "campaignId"),
    })),
  adcreatives: A("lecture", "créatifs : titres, textes, visuels, liens", (p) =>
    get(`/${compte(p)}/adcreatives`, {
      fields: "id,name,title,body,object_story_spec,thumbnail_url,effective_object_story_id",
      limit: 50, ...reste(p, "adAccountId"),
    })),
  // Le cœur de l'audit. Sur le compte, ou sur un objet précis via objectId.
  // level (account|campaign|adset|ad), date_preset (last_7d, last_30d, this_month,
  // maximum…) ou time_range {since,until}, breakdowns (["age","gender"],
  // ["publisher_platform"]…), time_increment (1 = par jour), filtering.
  insights: A("lecture", "LES CHIFFRES : dépense, portée, CTR, CPC, CPA, ROAS — objectId, level, date_preset/time_range, breakdowns", (p) =>
    get(`/${p && p.objectId ? encodeURIComponent(p.objectId) : compte(p)}/insights`, {
      level: "campaign",
      fields: "campaign_name,adset_name,ad_name,impressions,reach,frequency,spend,clicks,ctr,cpc,cpm,actions,action_values,purchase_roas,cost_per_action_type",
      date_preset: "last_30d",
      limit: 100,
      ...reste(p, "adAccountId", "objectId"),
    })),

  // ---- 2. GESTION DES CAMPAGNES (budget réel) ----
  createcampaign: A("argent", "crée une campagne — body : name, objective, status (PAUSED conseillé), special_ad_categories: []", (p) =>
    post(`/${compte(p)}/campaigns`, requis(p, "body").body)),
  createadset: A("argent", "crée un ensemble (porte le BUDGET et le ciblage) — body : name, campaign_id, daily_budget (¢), billing_event, optimization_goal, targeting, status", (p) =>
    post(`/${compte(p)}/adsets`, requis(p, "body").body)),
  createad: A("argent", "crée une publicité — body : name, adset_id, creative, status", (p) =>
    post(`/${compte(p)}/ads`, requis(p, "body").body)),
  createadcreative: A("ecriture", "crée un créatif réutilisable (ne diffuse rien seul) — body", (p) =>
    post(`/${compte(p)}/adcreatives`, requis(p, "body").body)),
  update: A("argent", "modifie un objet publicitaire (budget, nom, ciblage, planification) — objectId, body", (p) =>
    post(`/${id(p, "objectId")}`, requis(p, "body").body)),
  // ACTIVE met en diffusion → argent. PAUSED/ARCHIVED arrête → simple écriture.
  setstatus: A("argent", "met en pause, relance ou archive — objectId, status (ACTIVE|PAUSED|ARCHIVED)", (p) =>
    post(`/${id(p, "objectId")}`, { status: requis(p, "status").status })),
  remove: A("destructeur", "supprime un objet publicitaire (préférer setstatus ARCHIVED) — objectId", (p) =>
    del(`/${id(p, "objectId")}`)),

  // ---- 3. GESTION DES COMMENTAIRES ----
  posts: A("lecture", "publications de la Page : pageId, edge (feed|published_posts), limit", (p) =>
    get(`/${page(p)}/${(p && p.edge) || "feed"}`, {
      fields: "id,message,created_time,permalink_url,status_type,shares,comments.summary(true).limit(0),reactions.summary(true).limit(0)",
      limit: 25, ...reste(p, "pageId", "edge"),
    }, "page")),
  post: A("lecture", "une publication — postId", (p) =>
    get(`/${id(p, "postId")}`, {
      fields: "id,message,created_time,permalink_url,comments.summary(true).limit(0),reactions.summary(true).limit(0)",
      ...reste(p, "postId"),
    }, "page")),
  comments: A("lecture", "commentaires d'une publication (ou réponses d'un commentaire) — objectId, order, filter, limit", (p) =>
    get(`/${id(p, "objectId")}/comments`, {
      fields: "id,message,created_time,from,like_count,comment_count,is_hidden,permalink_url,parent",
      order: "chronological", limit: 50, ...reste(p, "objectId"),
    }, "page")),
  comment: A("lecture", "un commentaire — commentId", (p) =>
    get(`/${id(p, "commentId")}`, {
      fields: "id,message,created_time,from,like_count,comment_count,is_hidden,permalink_url",
      ...reste(p, "commentId"),
    }, "page")),
  replycomment: A("ecriture", "répond PUBLIQUEMENT à un commentaire, au nom de la Page — commentId, message", (p) =>
    post(`/${id(p, "commentId")}/comments`, { message: requis(p, "message").message }, "page")),
  commentonpost: A("ecriture", "commente une publication au nom de la Page — postId, message", (p) =>
    post(`/${id(p, "postId")}/comments`, { message: requis(p, "message").message }, "page")),
  // Masquer plutôt que supprimer : réversible, et une critique légitime masquée
  // reste visible pour son auteur — pas de scandale de censure.
  hidecomment: A("ecriture", "masque (ou réaffiche) un commentaire — commentId, hidden (défaut true)", (p) =>
    post(`/${id(p, "commentId")}`, { is_hidden: p.hidden === undefined ? true : !!p.hidden }, "page")),
  deletecomment: A("destructeur", "supprime un commentaire, irréversible — réservé au pourriel et aux propos haineux — commentId", (p) =>
    del(`/${id(p, "commentId")}`, "page")),
  privatereply: A("ecriture", "réponse PRIVÉE à un commentaire (ouvre Messenger) — une seule par commentaire, sous 7 jours — commentId, message", (p) =>
    post(`/${id(p, "commentId")}/private_replies`, { message: requis(p, "message").message }, "page")),

  // ---- 4. GESTES AUTOMATISÉS (nos actifs seulement) ----
  like: A("ecriture", "« j'aime » de la Page sur NOTRE publication ou commentaire — objectId", (p) =>
    post(`/${id(p, "objectId")}/likes`, {}, "page")),
  unlike: A("ecriture", "retire le « j'aime » de la Page — objectId", (p) =>
    del(`/${id(p, "objectId")}/likes`, "page")),
  createpost: A("ecriture", "publie ou programme sur la Page — message, link, published, scheduled_publish_time (ou body)", (p) =>
    post(`/${page(p)}/feed`, (p && p.body) || reste(p, "pageId"), "page")),
  deletepost: A("destructeur", "supprime une publication de la Page — postId", (p) =>
    del(`/${id(p, "postId")}`, "page")),
  conversations: A("lecture", "fils Messenger / Instagram — platform (messenger|instagram), limit", (p) =>
    get(`/${page(p)}/conversations`, {
      fields: "id,updated_time,message_count,unread_count,participants,snippet",
      limit: 25, ...reste(p, "pageId"),
    }, "page")),
  messages: A("lecture", "messages d'une conversation — conversationId, limit", (p) =>
    get(`/${id(p, "conversationId")}/messages`, {
      fields: "id,created_time,from,to,message", limit: 25, ...reste(p, "conversationId"),
    }, "page")),
  // Fenêtre de 24 h : au-delà, Meta refuse sans tag autorisé. Le refus est propre
  // (code 10/2018278), mais l'insistance hors fenêtre met l'app en danger.
  sendmessage: A("ecriture", "envoie un message — recipientId, message (+ messaging_type, tag) ou body. FENÊTRE DE 24 H, sinon tag autorisé obligatoire", (p) =>
    post(`/${page(p)}/messages`, (p && p.body) || {
      recipient: { id: requis(p, "recipientId").recipientId },
      message: { text: requis(p, "message").message },
      messaging_type: p.messaging_type || "RESPONSE",
      ...(p.tag ? { tag: p.tag } : {}),
    }, "page")),

  // ---- 5. VEILLE STRATÉGIQUE ----
  pageinsights: A("lecture", "portée, engagement, abonnés de la Page — metric, period, since, until", (p) =>
    get(`/${page(p)}/insights`, {
      metric: "page_impressions_unique,page_post_engagements,page_fans,page_views_total",
      period: "day", ...reste(p, "pageId"),
    }, "page")),
  postinsights: A("lecture", "performance d'une publication — postId, metric", (p) =>
    get(`/${id(p, "postId")}/insights`, {
      metric: "post_impressions_unique,post_engaged_users,post_clicks,post_reactions_by_type_total",
      ...reste(p, "postId"),
    }, "page")),
  // Bibliothèque publicitaire : les pubs des CONCURRENTS, publiquement.
  adlibrary: A("lecture", "pubs des concurrents (Ad Library) — search_terms ou search_page_ids, ad_reached_countries (défaut CA), ad_active_status", (p) =>
    get("/ads_archive", {
      ad_reached_countries: ["CA"], ad_active_status: "ACTIVE",
      fields: "id,page_id,page_name,ad_creation_time,ad_delivery_start_time,ad_delivery_stop_time,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_titles,ad_snapshot_url,publisher_platforms",
      limit: 50, ...p,
    })),
  publicpage: A("lecture", "données publiques d'une Page tierce (exige Page Public Content Access) — publicPageId", (p) =>
    get(`/${id(p, "publicPageId")}`, { fields: "id,name,fan_count,followers_count,category,link", ...reste(p, "publicPageId") })),

  // ---- Instagram (compte Business relié à la Page) ----
  igaccount: A("lecture", "profil Instagram — igUserId", (p) =>
    get(`/${ig(p)}`, { fields: "id,username,name,followers_count,follows_count,media_count,biography", ...reste(p, "igUserId") }, "page")),
  igmedia: A("lecture", "publications Instagram — igUserId, limit", (p) =>
    get(`/${ig(p)}/media`, {
      fields: "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count",
      limit: 25, ...reste(p, "igUserId"),
    }, "page")),
  igcomments: A("lecture", "commentaires d'une publication Instagram — mediaId", (p) =>
    get(`/${id(p, "mediaId")}/comments`, {
      fields: "id,text,timestamp,username,like_count,hidden,replies{id,text,timestamp,username}",
      limit: 50, ...reste(p, "mediaId"),
    }, "page")),
  igreply: A("ecriture", "répond à un commentaire Instagram — commentId, message", (p) =>
    post(`/${id(p, "commentId")}/replies`, { message: requis(p, "message").message }, "page")),
  ighidecomment: A("ecriture", "masque (ou réaffiche) un commentaire Instagram — commentId, hidden", (p) =>
    post(`/${id(p, "commentId")}`, { hide: p.hidden === undefined ? true : !!p.hidden }, "page")),
  iginsights: A("lecture", "insights Instagram — metric, period, since, until", (p) =>
    get(`/${ig(p)}/insights`, { metric: "reach,follower_count,profile_views", period: "day", ...reste(p, "igUserId") }, "page")),
};

// Un appel est-il permis dans la configuration actuelle du service ?
// Renvoie null si oui, sinon le motif du refus (message rendu à l'appelant).
// L'écriture est ouverte par défaut : on ne refuse que si un interrupteur FERME.
// Un dry-run n'a aucun effet de bord : il traverse tous les garde-fous, ce qui
// permet justement de s'entraîner sur une action qu'on a fermée.
function refus(nom, action, dryRun) {
  if (dryRun) return null;
  if (READONLY && action.risque !== "lecture") {
    return `service en LECTURE SEULE (META_READONLY) : « ${nom} » est une action « ${action.risque} ». Réessaie avec "dryRun": true pour voir ce qui partirait.`;
  }
  if (action.risque === "argent" && BLOCK_SPEND) {
    return `« ${nom} » engage du budget publicitaire et META_BLOCK_SPEND=1 est actif sur le service.`;
  }
  if (action.risque === "destructeur" && BLOCK_DELETE) {
    return `« ${nom} » supprime définitivement et META_BLOCK_DELETE=1 est actif sur le service.`;
  }
  return null;
}

// ---- Serveur HTTP ----
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve(null); } });
  });
}
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  try {
    const route = (req.url || "").split("?")[0];

    if (req.method === "GET" && route === "/health") return json(res, 200, { ok: true, service: "meta-proxy" });

    // Vue publique : actions, risques et interrupteurs. Aucun secret, aucune donnée.
    if (req.method === "GET" && route === "/actions") {
      const actions = {};
      for (const [n, a] of Object.entries(ACTIONS)) {
        actions[n] = { risque: a.risque, permis: !refus(n, a, false), doc: a.doc };
      }
      return json(res, 200, {
        service: "meta-proxy",
        graph: V,
        dryRun: "toute action accepte \"dryRun\": true — elle est validée et construite, mais pas envoyée",
        garde_fous: {
          lectureSeule: READONLY,
          depenseBloquee: BLOCK_SPEND,
          suppressionBloquee: BLOCK_DELETE,
          pagesAutorisees: PAGES_OK.length ? PAGES_OK : "toutes celles du jeton",
          comptesAutorises: COMPTES_OK.length ? COMPTES_OK : "tous ceux du jeton",
        },
        defauts: { pageId: PAGE_ID || null, adAccountId: AD_ACCOUNT || null, igUserId: IG_ID || null },
        actions,
      });
    }

    /**
     * État du jeton Meta, SANS jamais exposer sa valeur. C'est le seul moyen de
     * voir venir la panne : un jeton d'utilisateur système peut être permanent,
     * mais une portée retirée ou une app repassée en mode dev casse tout d'un coup.
     */
    if (req.method === "GET" && route === "/token-status") {
      try {
        const dbg = await httpJson({
          method: "GET",
          url: `${BASE}/debug_token${qs({ input_token: TOKEN })}`,
          headers: { Authorization: `Bearer ${TOKEN}` },
        });
        const d = (dbg && dbg.data) || {};
        const expire = d.expires_at ? (d.expires_at === 0 ? null : new Date(d.expires_at * 1000).toISOString()) : null;
        const joursRestants = expire ? Math.round((new Date(expire) - Date.now()) / 86400000) : null;
        return json(res, 200, {
          service: "meta-proxy",
          valide: d.is_valid !== false,
          type: d.type || null,
          appId: d.app_id || null,
          permanent: d.expires_at === 0,
          expire,
          joursRestants,
          portees: d.scopes || [],
          avertissement: joursRestants !== null && joursRestants < 14
            ? `Le jeton expire dans ${joursRestants} jour(s) : régénérer l'utilisateur système avant la coupure.`
            : null,
        });
      } catch (e) {
        return json(res, 502, { service: "meta-proxy", valide: false, erreur: String(e.message || e).slice(0, 500) });
      }
    }

    if (req.method !== "POST") return json(res, 404, { error: "not found" });

    if ((req.headers["x-proxy-secret"] || "") !== SECRET) return json(res, 401, { error: "unauthorized" });

    const aname = route.split("/").filter(Boolean)[0] || "";
    const action = ACTIONS[aname];
    if (!action) return json(res, 404, { error: `action inconnue : ${aname}`, actions: Object.keys(ACTIONS) });

    const body = await readBody(req);
    if (body === null) return json(res, 400, { error: "invalid JSON" });

    // « dryRun » est un paramètre du proxy, pas de Graph : on le retire des
    // params avant de les passer à l'action, sinon il finirait en query string.
    const dryRun = vrai(body.dryRun) || body.dryRun === true;
    if ("dryRun" in body) delete body.dryRun;

    // Garde-fous d'exécution AVANT tout appel à Graph.
    const motif = refus(aname, action, dryRun);
    if (motif) return json(res, 403, { error: motif, risque: action.risque });

    const data = await contexte.run({ dryRun }, () => action.run(body));
    return json(res, 200, { ok: true, action: aname, risque: action.risque, ...(dryRun ? { dryRun: true } : {}), data });
  } catch (e) {
    return json(res, 502, { error: String(e.message || e).slice(0, 2000) });
  }
});

server.listen(PORT, () => {
  const modes = [
    READONLY ? "LECTURE SEULE" : "lecture + écriture",
    BLOCK_SPEND ? "dépense BLOQUÉE" : "dépense autorisée",
    BLOCK_DELETE ? "suppression BLOQUÉE" : "suppression autorisée",
  ];
  console.log(`meta-proxy à l'écoute sur :${PORT} — Graph ${V} · ${modes.join(" · ")}`);
  console.log(`  Page par défaut : ${PAGE_ID || "(aucune)"} · compte pub : ${AD_ACCOUNT || "(aucun)"} · Instagram : ${IG_ID || "(aucun)"}`);
  if (PAGES_OK.length) console.log(`  Pages autorisées : ${PAGES_OK.join(", ")}`);
  if (COMPTES_OK.length) console.log(`  Comptes publicitaires autorisés : ${COMPTES_OK.join(", ")}`);
  if (!PAGES_OK.length && !COMPTES_OK.length) console.log("  (aucune liste blanche d'actifs — définir META_ALLOWED_PAGE_IDS / META_ALLOWED_AD_ACCOUNT_IDS pour borner le périmètre)");
});
