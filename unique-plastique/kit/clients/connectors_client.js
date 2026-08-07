/**
 * Client du connectors-proxy (General Proxy) — utilisé par Claude DANS l'environnement
 * Claude Code (pas déployé). Lit l'URL et le secret depuis l'environnement, jamais en dur :
 *   GENERAL_PROXY_URL     ex. https://<ton-service>.onrender.com
 *   GENERAL_PROXY_SECRET  le secret du service General Proxy (repli PROXY_SECRET)
 *
 * Usage :
 *   node connectors_client.js health
 *   node connectors_client.js connectors
 *   node connectors_client.js <connecteur> <action> ['{"param":"valeur"}']
 *
 * Exemples ShipStation (lecture) :
 *   node connectors_client.js shipstation carriers
 *   node connectors_client.js shipstation orders '{"orderNumber":"L-50468"}'
 *   node connectors_client.js shipstation shipments '{"trackingNumber":"1Z..."}'
 *
 * Exemples ShipStation (écriture — voir CONNECTORS_PROXY.md pour les risques) :
 *   node connectors_client.js shipstation addtag '{"orderId":123456,"tagId":7890}'
 *   node connectors_client.js shipstation holduntil '{"orderId":123456,"holdUntilDate":"2026-08-01"}'
 *   node connectors_client.js shipstation getrates '{"carrierCode":"canada_post","fromPostalCode":"G1K 3B2","toPostalCode":"H2X 1Y4","toCountry":"CA","weight":{"value":500,"units":"grams"}}'
 *   ⚠️ createlabelfororder / createlabel DÉBITENT le wallet (argent réel; testLabel:true = essai).
 *
 * Exemples Omnisend :
 *   node connectors_client.js omnisend contacts '{"email":"client@exemple.com"}'
 *   node connectors_client.js omnisend campaigns '{"limit":10}'
 *   node connectors_client.js omnisend triggerevent '{"body":{"systemName":"mon-evenement","email":"client@exemple.com"}}'
 *
 * QuickBooks : service dédié (isolation des finances) → utiliser finance_client.js
 * avec FINANCE_PROXY_URL + FINANCE_PROXY_SECRET. Voir finance-proxy/FINANCE_PROXY.md.
 */

const URL = (process.env.GENERAL_PROXY_URL || "").replace(/\/+$/, "");
const SECRET = process.env.GENERAL_PROXY_SECRET || process.env.PROXY_SECRET;

if (!URL) { console.error("Manque GENERAL_PROXY_URL (l'URL de ton service Render general-proxy)."); process.exit(1); }
async function call(route, body, method = "POST") {
  const opts = { method, headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET || "" } };
  if (method === "POST") opts.body = JSON.stringify(body || {});
  const res = await fetch(`${URL}${route}`, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${route} → ${res.status} ${text.slice(0, 300)}`);
  return json;
}

(async () => {
  const [a1, a2, a3] = process.argv.slice(2);
  try {
    if (!a1 || a1 === "health") { console.log(JSON.stringify(await call("/health", null, "GET"), null, 2)); return; }
    if (a1 === "connectors") { console.log(JSON.stringify(await call("/connectors", null, "GET"), null, 2)); return; }
    // /:connecteur/:action
    if (!a2) { console.error("Usage : node connectors_client.js <connecteur> <action> ['{params}']"); process.exit(1); }
    const params = a3 ? JSON.parse(a3) : {};
    console.log(JSON.stringify(await call(`/${a1}/${a2}`, params), null, 2));
  } catch (e) { console.error("Erreur:", e.message); process.exit(1); }
})();
