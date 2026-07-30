/**
 * Client du finance-proxy (QuickBooks Online). Mêmes variables que finance_client.js :
 *   FINANCE_PROXY_URL, FINANCE_PROXY_SECRET
 */
const URL = (process.env.FINANCE_PROXY_URL || "").replace(/\/+$/, "");
const SECRET = process.env.FINANCE_PROXY_SECRET || "";

async function qbo(action, params = {}, { retries = 3 } = {}) {
  if (!URL) throw new Error("FINANCE_PROXY_URL manquante.");
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${URL}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET },
        body: JSON.stringify(params),
      });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      if (res.status >= 500 || res.status === 429) throw new Error(`${action} → ${res.status} ${text.slice(0, 300)}`);
      if (!res.ok) { const e = new Error(`${action} → ${res.status} ${text.slice(0, 500)}`); e.fatal = true; throw e; }
      return json;
    } catch (e) {
      lastErr = e;
      if (e.fatal || attempt === retries) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastErr;
}

/** Renvoie la première entité d'une requête, ou null. */
async function queryOne(query) {
  const res = await qbo("query", { query });
  const qr = (res.data && res.data.QueryResponse) || {};
  const first = Object.values(qr).find((v) => Array.isArray(v) && v.length);
  return first ? first[0] : null;
}

module.exports = { qbo, queryOne };
