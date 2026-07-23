/**
 * Client du finance-proxy (service Render dédié aux finances / QuickBooks).
 * Utilisé par Claude dans l'environnement Claude Code (pas déployé). Env requis :
 *   FINANCE_PROXY_URL     ex. https://finance-proxy-xxxx.onrender.com
 *   FINANCE_PROXY_SECRET  le secret du service finance-proxy (PAS le général)
 *
 * Usage :
 *   node finance_client.js health
 *   node finance_client.js actions
 *   node finance_client.js <action> ['{"param":"valeur"}']
 *
 * Exemples :
 *   node finance_client.js companyinfo
 *   node finance_client.js report '{"name":"ProfitAndLoss","start_date":"2025-09-01","end_date":"2026-08-31","summarize_column_by":"Month","accounting_method":"Accrual"}'
 *   node finance_client.js query '{"query":"select * from Account maxresults 200"}'
 *   node finance_client.js read '{"entity":"purchase","id":"123"}'
 *   node finance_client.js create '{"entity":"journalentry","body":{...}}'
 */

const URL = (process.env.FINANCE_PROXY_URL || "").replace(/\/+$/, "");
const SECRET = process.env.FINANCE_PROXY_SECRET || "";

if (!URL) { console.error("Manque FINANCE_PROXY_URL."); process.exit(1); }

async function call(route, body, method = "POST") {
  const opts = { method, headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET } };
  if (method === "POST") opts.body = JSON.stringify(body || {});
  const res = await fetch(`${URL}${route}`, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${route} → ${res.status} ${text.slice(0, 300)}`);
  return json;
}

(async () => {
  const [a1, a2] = process.argv.slice(2);
  try {
    if (!a1 || a1 === "health") { console.log(JSON.stringify(await call("/health", null, "GET"), null, 2)); return; }
    if (a1 === "actions") { console.log(JSON.stringify(await call("/actions", null, "GET"), null, 2)); return; }
    const params = a2 ? JSON.parse(a2) : {};
    console.log(JSON.stringify(await call(`/${a1}`, params), null, 2));
  } catch (e) { console.error("Erreur:", e.message); process.exit(1); }
})();
