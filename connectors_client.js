/**
 * Client du connectors-proxy (General Proxy) — utilisé par Claude DANS l'environnement
 * Claude Code (pas déployé). Lit l'URL et le secret depuis l'environnement, jamais en dur :
 *   GENERAL_PROXY_URL     ex. https://general-proxy-5muf.onrender.com
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
 * Exemples QuickBooks (lecture seule) :
 *   node connectors_client.js quickbooks companyinfo
 *   node connectors_client.js quickbooks report '{"name":"ProfitAndLoss","start_date":"2025-09-01","end_date":"2026-08-31","summarize_column_by":"Month","accounting_method":"Accrual"}'
 *   node connectors_client.js quickbooks query '{"query":"select * from Account maxresults 200"}'
 */

const URL = process.env.GENERAL_PROXY_URL || "https://general-proxy-5muf.onrender.com";
const SECRET = process.env.GENERAL_PROXY_SECRET || process.env.PROXY_SECRET;
// Secrets DÉDIÉS par connecteur (isolation des périmètres sensibles): quickbooks exige
// QBO_PROXY_SECRET quand il est configuré côté proxy (le secret général y est refusé).
const SECRETS_DEDIES = { quickbooks: process.env.QBO_PROXY_SECRET };

async function call(route, body, method = "POST") {
  const connecteur = (route.split("/").filter(Boolean)[0] || "").toLowerCase();
  const secret = SECRETS_DEDIES[connecteur] || SECRET;
  const opts = { method, headers: { "Content-Type": "application/json", "X-Proxy-Secret": secret || "" } };
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
