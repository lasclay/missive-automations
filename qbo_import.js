/**
 * qbo_import.js — import QuickBooks → chiffrier de prévisions (chantier « automatiser
 * l'import QBO »). Va chercher le P&L et le BILAN mensuels d'un exercice (1er sept –
 * 31 août) via le connectors-proxy et produit des TSV au format EXACT des feuilles
 * « QBO P&L à maj » et « QBOBS à maj » :
 *
 *   colonne A = étiquette de mappage (la clé des SUMIF du moteur P&L, ex. « Ventes
 *               B2C -CAN ») — remplie automatiquement depuis qbo_mapping.json ;
 *   colonne B = libellé de compte QBO avec indentation (3 espaces par niveau) ;
 *   colonnes suivantes = mois de l'exercice (+ colonne Total de QBO).
 *
 * Un compte QBO ABSENT du mappage sort avec une étiquette vide et est signalé en fin
 * d'exécution : l'ajouter à qbo_mapping.json (numéro de compte → étiquette du modèle).
 * C'est le seul geste manuel restant — le mappage est l'intelligence à préserver.
 *
 * Usage :
 *   node qbo_import.js                 # P&L + bilan de l'exercice en cours
 *   node qbo_import.js --fy 2026       # exercice précis (FY2026 = sept 2025 à août 2026)
 *   node qbo_import.js --report pl     # pl | bs | both (défaut both)
 *
 * Sorties : qbo_pl_FY<N>.tsv et/ou qbo_bs_FY<N>.tsv dans le dossier courant. À coller
 * dans les feuilles correspondantes (P&L FY2026 = colonnes AA à AL).
 *
 * Environnement : GENERAL_PROXY_URL + GENERAL_PROXY_SECRET (repli PROXY_SECRET) — le
 * proxy détient les secrets Intuit (voir CONNECTORS_PROXY.md, section QuickBooks).
 * Node 18+. Aucune dépendance.
 */

const fs = require("node:fs");
const path = require("node:path");

const PROXY_URL = (process.env.GENERAL_PROXY_URL || "https://general-proxy-5muf.onrender.com").replace(/\/+$/, "");
// Secret: QBO_PROXY_SECRET (secret dédié aux finances) en priorité; repli sur le général
// tant que l'isolation n'est pas activée côté proxy.
const SECRET = process.env.QBO_PROXY_SECRET || process.env.GENERAL_PROXY_SECRET || process.env.PROXY_SECRET || "";
const MAPPING_FILE = process.env.QBO_MAPPING_FILE || path.join(__dirname, "qbo_mapping.json");

if (!SECRET) { console.error("Manque GENERAL_PROXY_SECRET (ou PROXY_SECRET)."); process.exit(1); }

// --- arguments ---
const args = process.argv.slice(2);
function argVal(name, def) { const i = args.indexOf(name); return i !== -1 && args[i + 1] ? args[i + 1] : def; }
const now = new Date();
const fyDefaut = now.getUTCMonth() + 1 >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
const FY = parseInt(argVal("--fy", String(fyDefaut)), 10);
const REPORT = argVal("--report", "both").toLowerCase();
const START = `${FY - 1}-09-01`, END = `${FY}-08-31`;

// --- mappage compte → étiquette (extrait des feuilles du chiffrier) ---
let MAPPING = { pl: {}, bs: {} };
try { MAPPING = JSON.parse(fs.readFileSync(MAPPING_FILE, "utf8")); }
catch (e) { console.warn(`Mappage introuvable (${MAPPING_FILE}): étiquettes vides partout. ${e.message}`); }

// Étiquette d'un libellé de compte : par numéro (ex. « 4011 ») d'abord, sinon par libellé complet.
function tagPour(mapping, label) {
  const l = (label || "").trim();
  const m = l.match(/^(\d{3,4}(?:\.\d)?)\s/);
  if (m && mapping[m[1]] !== undefined) return mapping[m[1]];
  if (mapping[l] !== undefined) return mapping[l];
  return null;
}

// --- appel proxy ---
async function proxy(action, params) {
  const res = await fetch(`${PROXY_URL}/quickbooks/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET },
    body: JSON.stringify(params || {}),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(`${action} → ${res.status} ${(j.error || "").slice(0, 300)}`);
  return j.data;
}

// --- aplatissement d'un rapport QBO (Rows/Row récursif) au format des feuilles ---
// Chaque ligne: { label (indenté), values[], detail (vrai compte vs section/somme) }.
function flattenReport(report) {
  const nCols = ((report.Columns && report.Columns.Column) || []).length;
  const lignes = [];
  const indent = (d) => " ".repeat(3 * d);
  function valsFrom(colData) {
    return (colData || []).slice(1, nCols).map((c) => (c && c.value !== undefined && c.value !== null ? String(c.value) : ""));
  }
  function walk(rows, depth) {
    for (const r of rows || []) {
      if (r.type === "Section" || r.Rows) {
        const head = r.Header && r.Header.ColData && r.Header.ColData[0] ? String(r.Header.ColData[0].value || "") : "";
        if (head) lignes.push({ label: indent(depth) + head, values: valsFrom(r.Header.ColData), detail: false });
        walk(r.Rows && r.Rows.Row, depth + 1);
        if (r.Summary && r.Summary.ColData) {
          lignes.push({ label: indent(depth + 1) + String(r.Summary.ColData[0].value || ""), values: valsFrom(r.Summary.ColData), detail: false });
        }
      } else if (r.ColData) {
        lignes.push({ label: indent(depth) + String(r.ColData[0].value || ""), values: valsFrom(r.ColData), detail: true });
      }
    }
  }
  walk(report.Rows && report.Rows.Row, 0);
  const headers = ((report.Columns && report.Columns.Column) || []).slice(1).map((c) => c.ColTitle || "");
  return { headers, lignes };
}

// --- TSV au format des feuilles: étiquette \t libellé \t mois... ---
function toTsv(flat, mapping) {
  const inconnus = [];
  const out = [["", ""].concat(flat.headers).join("\t")]; // A vide, B vide, puis les mois
  for (const l of flat.lignes) {
    let tag = "";
    if (l.detail) {
      const t = tagPour(mapping, l.label);
      if (t === null) inconnus.push(l.label.trim());
      else tag = t;
    } else {
      const t = tagPour(mapping, l.label); // certaines lignes de section sont mappées aussi (bilan)
      if (t) tag = t;
    }
    out.push([tag, l.label, ...l.values].join("\t"));
  }
  return { tsv: out.join("\n") + "\n", inconnus };
}

(async () => {
  console.log(`Exercice FY${FY} (${START} → ${END}), via ${PROXY_URL}`);
  const jobs = [];
  if (REPORT === "pl" || REPORT === "both") jobs.push(["pl", "ProfitAndLoss", "QBO P&L à maj"]);
  if (REPORT === "bs" || REPORT === "both") jobs.push(["bs", "BalanceSheet", "QBOBS à maj"]);
  if (!jobs.length) { console.error(`--report doit être pl, bs ou both (reçu: ${REPORT}).`); process.exit(1); }

  for (const [key, name, feuille] of jobs) {
    const data = await proxy("report", {
      name, start_date: START, end_date: END,
      summarize_column_by: "Month", accounting_method: "Accrual",
    });
    const flat = flattenReport(data);
    const { tsv, inconnus } = toTsv(flat, MAPPING[key] || {});
    const fichier = `qbo_${key}_FY${FY}.tsv`;
    fs.writeFileSync(fichier, tsv);
    console.log(`\n${name} → ${fichier} (${flat.lignes.length} lignes, colonnes: ${flat.headers.join(" | ")})`);
    console.log(`À coller dans « ${feuille} »${key === "pl" && FY === 2026 ? " (FY2026 = colonnes AA à AL)" : ""}.`);
    if (inconnus.length) {
      console.log(`⚠ ${inconnus.length} compte(s) SANS étiquette de mappage (SUMIF les ignorera) — à ajouter dans qbo_mapping.json :`);
      for (const c of [...new Set(inconnus)]) console.log(`   - ${c}`);
    }
  }
})().catch((e) => { console.error("Erreur:", e.message); process.exit(1); });
