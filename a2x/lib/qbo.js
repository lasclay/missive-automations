/**
 * Client du finance-proxy (QuickBooks Online). Mêmes variables que finance_client.js :
 *   FINANCE_PROXY_URL, FINANCE_PROXY_SECRET
 */
const URL = (process.env.FINANCE_PROXY_URL || "").replace(/\/+$/, "");
const SECRET = process.env.FINANCE_PROXY_SECRET || "";

/**
 * Extrait le vrai motif de refus de QuickBooks. Intuit renvoie un message
 * générique (« Erreur de validation de l'entreprise ») et met la cause réelle
 * dans `Detail` — c'est la seule ligne utile, et elle était tronquée.
 */
function describeFault(text) {
  const m = String(text).match(/"Fault"\s*:\s*{[\s\S]*?"Error"\s*:\s*\[([\s\S]*?)\]/);
  if (!m) return null;
  const errors = [];
  const re = /"Message"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]*?"Detail"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]*?"code"\s*:\s*"([^"]*)"(?:[\s\S]*?"element"\s*:\s*"([^"]*)")?/g;
  let e;
  while ((e = re.exec(m[1]))) {
    const unesc = (s) => s.replace(/\\"/g, '"').replace(/\\n/g, " ").replace(/\\\\/g, "\\");
    errors.push(`[${e[3]}]${e[4] ? ` ${e[4]} :` : ""} ${unesc(e[2]) || unesc(e[1])}`);
  }
  return errors.length ? errors.join(" | ") : null;
}

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
      // Un refus de QuickBooks arrive parfois enveloppé dans un 502 du proxy :
      // on le traite comme une erreur définitive et on en extrait le détail,
      // sinon on retenterait trois fois une écriture que QBO refusera toujours.
      const fault = describeFault(text);
      if (fault) { const e = new Error(`${action} → ${fault}`); e.fatal = true; e.qbo = fault; throw e; }
      if (res.status >= 500 || res.status === 429) throw new Error(`${action} → ${res.status} ${text.slice(0, 300)}`);
      if (!res.ok) { const e = new Error(`${action} → ${res.status} ${text.slice(0, 800)}`); e.fatal = true; throw e; }
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
