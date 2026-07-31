/**
 * meta_check.js — vérifie un jeton Meta AVANT de le poser sur Render.
 * Ne modifie RIEN : lectures seulement.
 *
 *   META_ACCESS_TOKEN=EAAG... node meta_check.js
 *
 * Affiche : identité du jeton, portées accordées, date d'expiration, Pages
 * administrées, comptes publicitaires, compte Instagram relié — et signale les
 * portées manquantes pour chacun des cinq usages visés (audit, gestion des
 * campagnes, commentaires, gestes automatisés, veille).
 *
 * Node 18+ (fetch natif). Aucune dépendance.
 */

const TOKEN = process.env.META_ACCESS_TOKEN || "";
const V = process.env.META_GRAPH_VERSION || "v25.0";
const BASE = `https://graph.facebook.com/${V}`;

if (!TOKEN) {
  console.error("Manque META_ACCESS_TOKEN.");
  process.exit(1);
}

async function get(path, params = {}) {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  const res = await fetch(`${BASE}${path}${q ? `?${q}` : ""}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const e = json && json.error;
    throw new Error(`GET ${path} → ${res.status} ${e ? `${e.type}/${e.code} ${e.message}` : text.slice(0, 200)}`);
  }
  return json;
}

// Portées nécessaires par usage (voir meta-proxy/META_PROXY.md).
const BESOINS = {
  "1. Audit / analyse des campagnes": ["ads_read"],
  "2. Gestion des campagnes": ["ads_management"],
  "3. Gestion des commentaires": ["pages_read_engagement", "pages_manage_engagement"],
  "4. Gestes automatisés (publier, messagerie)": ["pages_manage_posts", "pages_messaging"],
  "5. Veille (insights de Page)": ["pages_read_engagement", "read_insights"],
  "Instagram (facultatif)": ["instagram_basic", "instagram_manage_comments"],
};

(async () => {
  // 1. Identité du jeton.
  const moi = await get("/me", { fields: "id,name" });
  console.log(`OK — jeton valide. Identité : ${moi.name || "(sans nom)"} (${moi.id})`);

  // 2. Portées + expiration (debug_token s'inspecte lui-même avec le même jeton).
  let portees = [];
  try {
    const dbg = await get("/debug_token", { input_token: TOKEN });
    const d = (dbg && dbg.data) || {};
    portees = d.scopes || [];
    const exp = d.expires_at ? (d.expires_at === 0 ? "jamais (jeton permanent)" : new Date(d.expires_at * 1000).toISOString().slice(0, 16).replace("T", " ")) : "inconnue";
    console.log(`  Type : ${d.type || "?"} · app ${d.app_id || "?"} · expire : ${exp}`);
    console.log(`  Portées (${portees.length}) : ${portees.join(", ") || "(aucune)"}`);
  } catch (e) {
    console.log(`  (portées non lisibles : ${e.message})`);
  }

  // 3. Couverture des cinq usages.
  if (portees.length) {
    console.log("\nCouverture des usages :");
    for (const [usage, requises] of Object.entries(BESOINS)) {
      const manquantes = requises.filter((s) => !portees.includes(s));
      console.log(`  ${manquantes.length ? "✗" : "✓"} ${usage}${manquantes.length ? ` — manque : ${manquantes.join(", ")}` : ""}`);
    }
  }

  // 4. Pages administrées (les jetons de Page ne sont PAS affichés).
  try {
    const { data = [] } = await get("/me/accounts", { fields: "id,name,category,tasks", limit: 25 });
    console.log(`\nPages administrées (${data.length}) :`);
    for (const p of data) console.log(`  ${p.name} — META_PAGE_ID=${p.id} · ${p.category || "?"} · tâches : ${(p.tasks || []).join(",") || "?"}`);
    if (!data.length) console.log("  (aucune — vérifier pages_show_list et les rôles sur la Page)");

    // 5. Compte Instagram relié à la première Page.
    if (data[0]) {
      try {
        const ig = await get(`/${data[0].id}`, { fields: "instagram_business_account{id,username,followers_count}" });
        const c = ig.instagram_business_account;
        if (c) console.log(`  Instagram relié : @${c.username} — META_IG_USER_ID=${c.id} (${c.followers_count ?? "?"} abonnés)`);
      } catch { /* portée instagram_basic absente : sans importance ici */ }
    }
  } catch (e) {
    console.log(`\nPages : ${e.message}`);
  }

  // 6. Comptes publicitaires.
  try {
    const { data = [] } = await get("/me/adaccounts", { fields: "id,name,currency,account_status,amount_spent", limit: 25 });
    console.log(`\nComptes publicitaires (${data.length}) :`);
    for (const a of data) {
      const etat = a.account_status === 1 ? "actif" : `statut ${a.account_status}`;
      console.log(`  ${a.name} — META_AD_ACCOUNT_ID=${a.id} · ${a.currency} · ${etat} · dépensé : ${(Number(a.amount_spent || 0) / 100).toFixed(2)}`);
    }
    if (!data.length) console.log("  (aucun — vérifier ads_read et l'accès à l'actif dans Business Manager)");
  } catch (e) {
    console.log(`\nComptes publicitaires : ${e.message}`);
  }

  console.log("\nRappel : poser ces variables sur Render (service meta-proxy), jamais dans le dépôt.");
})().catch((e) => { console.error("Erreur:", e.message); process.exit(1); });
