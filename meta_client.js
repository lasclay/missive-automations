/**
 * Client du meta-proxy (service Render dédié à Meta : Facebook, Instagram, Ads).
 * Utilisé par Claude dans l'environnement Claude Code (pas déployé). Env requis :
 *   META_PROXY_URL     ex. https://meta-proxy-xxxx.onrender.com
 *   META_PROXY_SECRET  le secret du service meta-proxy (PAS le général, PAS celui des finances)
 *
 * Usage :
 *   node meta_client.js health
 *   node meta_client.js actions        (actions + niveau de risque + garde-fous actifs)
 *   node meta_client.js token          (état du jeton Meta, sans jamais l'exposer)
 *   node meta_client.js <action> ['{"param":"valeur"}']
 *
 * 1. Audit / analyse des campagnes :
 *   node meta_client.js adaccount
 *   node meta_client.js campaigns '{"effective_status":["ACTIVE"]}'
 *   node meta_client.js insights '{"level":"campaign","date_preset":"last_30d"}'
 *   node meta_client.js insights '{"objectId":"1234567890","level":"ad","time_range":{"since":"2026-07-01","until":"2026-07-31"},"breakdowns":["publisher_platform"]}'
 *
 * 2. Gestion des campagnes (⚠️ exige META_ALLOW_SPEND=1 sur le service) :
 *   node meta_client.js setstatus '{"objectId":"1234567890","status":"PAUSED"}'
 *   node meta_client.js update '{"objectId":"1234567890","body":{"daily_budget":5000}}'
 *
 * 3. Commentaires :
 *   node meta_client.js posts '{"limit":10}'
 *   node meta_client.js comments '{"objectId":"POST_ID"}'
 *   node meta_client.js replycomment '{"commentId":"COMMENT_ID","message":"Merci !"}'
 *   node meta_client.js hidecomment '{"commentId":"COMMENT_ID"}'
 *
 * 4. Gestes automatisés :
 *   node meta_client.js createpost '{"message":"…","published":false}'
 *   node meta_client.js conversations '{"platform":"messenger"}'
 *   node meta_client.js sendmessage '{"recipientId":"PSID","message":"…"}'   (fenêtre de 24 h)
 *
 * 5. Veille :
 *   node meta_client.js pageinsights '{"period":"week"}'
 *   node meta_client.js adlibrary '{"search_terms":"asclépiade","ad_reached_countries":["CA"]}'
 *
 * Doc complète : meta-proxy/META_PROXY.md
 */

const URL = (process.env.META_PROXY_URL || "").replace(/\/+$/, "");
const SECRET = process.env.META_PROXY_SECRET || "";

if (!URL) { console.error("Manque META_PROXY_URL."); process.exit(1); }

async function call(route, body, method = "POST") {
  const opts = { method, headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET } };
  if (method === "POST") opts.body = JSON.stringify(body || {});
  const res = await fetch(`${URL}${route}`, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  // 403 = garde-fou du service (lecture seule, dépense ou suppression bloquée) :
  // le motif est explicite et actionnable, on le remonte tel quel.
  if (!res.ok) throw new Error(`${route} → ${res.status} ${(json && json.error) || text.slice(0, 300)}`);
  return json;
}

(async () => {
  const [a1, a2] = process.argv.slice(2);
  try {
    if (!a1 || a1 === "health") { console.log(JSON.stringify(await call("/health", null, "GET"), null, 2)); return; }
    if (a1 === "actions") { console.log(JSON.stringify(await call("/actions", null, "GET"), null, 2)); return; }
    if (a1 === "token" || a1 === "token-status") { console.log(JSON.stringify(await call("/token-status", null, "GET"), null, 2)); return; }
    const params = a2 ? JSON.parse(a2) : {};
    console.log(JSON.stringify(await call(`/${a1}`, params), null, 2));
  } catch (e) { console.error("Erreur:", e.message); process.exit(1); }
})();
