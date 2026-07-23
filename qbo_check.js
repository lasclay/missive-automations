/**
 * qbo_check.js — vérifie l'accès QuickBooks Online en lecture avant de déployer le
 * connecteur sur le proxy. Ne modifie RIEN (mais consomme une rotation potentielle du
 * refresh token: si Intuit en renvoie un nouveau, il est AFFICHÉ — le reporter dans Render).
 *
 *   QBO_CLIENT_ID=xxx QBO_CLIENT_SECRET=yyy QBO_REALM_ID=123 QBO_REFRESH_TOKEN=zzz \
 *   node qbo_check.js
 *
 * Affiche : le nom de la compagnie (test d'auth), puis les ventes nettes par mois du
 * P&L de l'exercice en cours (1er sept – 31 août), méthode d'exercice — le format
 * attendu par le chiffrier de prévisions.
 * Node 18+. Aucune dépendance.
 */

const CLIENT_ID = process.env.QBO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.QBO_CLIENT_SECRET || "";
const REALM = process.env.QBO_REALM_ID || "";
const REFRESH = process.env.QBO_REFRESH_TOKEN || "";
const BASE = (process.env.QBO_ENV || "production").toLowerCase() === "sandbox"
  ? "https://sandbox-quickbooks.api.intuit.com"
  : "https://quickbooks.api.intuit.com";
const MINOR = process.env.QBO_MINORVERSION || "75";

if (!CLIENT_ID || !CLIENT_SECRET || !REALM || !REFRESH) {
  console.error("Manque QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REALM_ID ou QBO_REFRESH_TOKEN.");
  process.exit(1);
}

// Exercice fiscal Lasclay : 1er septembre au 31 août.
function exerciceCourant() {
  const now = new Date();
  const debut = now.getUTCMonth() + 1 >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return { start: `${debut}-09-01`, end: `${debut + 1}-08-31`, fy: debut + 1 };
}

(async () => {
  // 1. Refresh token → access token.
  const tr = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: REFRESH }).toString(),
  });
  if (!tr.ok) {
    const t = await tr.text();
    console.error(`Échec du refresh (${tr.status}): ${t.slice(0, 300)}`);
    if (/invalid_grant/.test(t)) console.error("→ Refresh token périmé ou déjà tourné: refaire l'autorisation (node qbo_auth.js url).");
    process.exit(1);
  }
  const tok = await tr.json();
  console.log("OK — refresh réussi (access token 60 min).");
  if (tok.refresh_token && tok.refresh_token !== REFRESH) {
    console.log(`⚠ NOUVEAU refresh token émis (rotation Intuit) — METTRE À JOUR QBO_REFRESH_TOKEN partout :\n  ${tok.refresh_token}`);
  }

  const get = async (path) => {
    const res = await fetch(`${BASE}/v3/company/${encodeURIComponent(REALM)}${path}${path.includes("?") ? "&" : "?"}minorversion=${MINOR}`, {
      headers: { Authorization: `Bearer ${tok.access_token}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json();
  };

  // 2. Test d'auth API : infos compagnie.
  const ci = await get(`/companyinfo/${encodeURIComponent(REALM)}`);
  const c = ci.CompanyInfo || {};
  console.log(`Compagnie : ${c.CompanyName || "?"} (realm ${REALM}, pays ${c.Country || "?"}, début d'exercice ${c.FiscalYearStartMonth || "?"}).`);

  // 3. P&L mensuel de l'exercice en cours (le format du chiffrier).
  const { start, end, fy } = exerciceCourant();
  const pl = await get(`/reports/ProfitAndLoss?start_date=${start}&end_date=${end}&summarize_column_by=Month&accounting_method=Accrual`);
  const cols = (pl.Columns && pl.Columns.Column || []).map((col) => col.ColTitle).slice(1);
  // Ligne « Total Income » (ou équivalent FR) dans les sections du rapport.
  function findRow(rows, re) {
    for (const r of rows || []) {
      const label = r.Summary && r.Summary.ColData && r.Summary.ColData[0] && r.Summary.ColData[0].value || "";
      if (re.test(label)) return (r.Summary.ColData || []).slice(1).map((d) => d.value);
      const sub = findRow(r.Rows && r.Rows.Row, re);
      if (sub) return sub;
    }
    return null;
  }
  const income = findRow(pl.Rows && pl.Rows.Row, /total income|total.*revenu/i);
  console.log(`\nP&L FY${fy} (${start} → ${end}), colonnes Mois, méthode d'exercice :`);
  console.log("Mois     :", cols.join(" | "));
  console.log("Revenus  :", income ? income.join(" | ") : "(ligne Total Income non trouvée — voir le JSON brut)");
})().catch((e) => { console.error("Erreur:", e.message); process.exit(1); });
