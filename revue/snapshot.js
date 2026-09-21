#!/usr/bin/env node
// Snapshot de la revue quotidienne — une seule écran, rien d'autre.
// Usage : node revue/snapshot.js [AAAA-MM-JJ]
// Tout se calcule depuis le dépôt : aucun appel réseau, aucune attente.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const FUSEAU = "America/Toronto";
const jourLocal = (d) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const JOUR = process.argv[2] || jourLocal(new Date());
const sh = (c) => { try { return execSync(c, { cwd: RACINE, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };
const jours = (depuis) => Math.floor((new Date(JOUR + "T12:00:00Z") - new Date(depuis)) / 86400000);
const lire = (p) => { try { return JSON.parse(fs.readFileSync(path.join(RACINE, p), "utf8")); } catch { return null; } };

// ── production du jour, depuis la collecte
const col = lire(`revue/jour/${JOUR}/collecte.json`);
const fb = col && col.facebook ? col.facebook : null;
const publiees = fb ? fb.total_publiees : null;
const nonConf = fb ? fb.total_non_confirmees : null;
const sante = (col && col.sante) || [];
const proxysOk = sante.filter((s) => s.ok).length;

// ── compteurs qui courent
const TIRS = ["A", "B", "C", "D"];
const aRevoir = {};
for (const t of TIRS) aRevoir[t] = (lire(`fb-backlog/etat/${t}-a-revoir.json`) || { a_revoir: [] }).a_revoir;

const escalades = TIRS.reduce((n, t) =>
  n + aRevoir[t].filter((x) => /A TRAITER PAR UN HUMAIN|traiter par un humain|SIGNALER|a signaler/i.test(x.motif || "")).length, 0);

const tirDSansDate = aRevoir.D.filter((x) => x.ecarte_le === undefined).length;

const ACHAT = /wouldn'?t go through|doesn'?t work|checkout|empty my cart|too hard to order|website was crap|can'?t order/i;
// Un rapport d'achat bloqué auquel on a répondu ne laisse aucune trace du commentaire du client :
// `*-repondus.json` ne garde que notre réponse. Sans ce second filtre, le compteur ne voit que les écartés.
const REPONSE_ACHAT = /which step it stalls|cart or checkout|couldn'?t (complete|place) (your|the) order|checkout (is|was) (failing|stuck|broken)/i;
const repondus = {};
for (const t of TIRS) repondus[t] = (lire(`fb-backlog/etat/${t}-repondus.json`) || { repondus: [] }).repondus || [];

const rapportsAchat = [
  ...TIRS.flatMap((t) =>
    aRevoir[t].filter((x) => ACHAT.test(x.message || x.extrait || ""))
              .map((x) => x.ecarte_le || String(x.quand || "").slice(0, 10))),
  ...TIRS.flatMap((t) =>
    repondus[t].filter((x) => REPONSE_ACHAT.test(x.texte || ""))
               .map((x) => String(x.quand || "").slice(0, 10))),
].filter(Boolean).sort();

const envois = (() => {
  const brut = sh("git show origin/claude/lasclay-retail-expansion-v6jay7:retail-expansion/journal_envois.json");
  try { const a = JSON.parse(brut); const d = a.map((x) => x.envoye_le || x.t || x.date || "").filter(Boolean).sort(); return d[d.length - 1] || null; }
  catch { return null; }
})();

const renderFusionne = sh("git branch -r --contains 0a81d48").includes("origin/main");

const reg = lire("revue/registre.json") || {};
const items = Array.isArray(reg) ? reg : (reg.items || reg.ameliorations || []);
const parEtat = {};
items.forEach((x) => { parEtat[x.etat] = (parEtat[x.etat] || 0) + 1; });

// ── rendu : une seule écran
const L = [];
const rouge = [];
if (rapportsAchat.length) {
  const dep = rapportsAchat[0], der = rapportsAchat[rapportsAchat.length - 1];
  rouge.push(`achat bloqué — ${rapportsAchat.length} rapports clients, du ${dep.slice(5)} au ${der.slice(5)}`);
}
if (envois) rouge.push(`campagne pts de vente — ${jours(envois)} j sans un seul envoi`);
if (escalades) rouge.push(`escalades sans sortie — ${escalades} en attente d'un humain`);
if (tirDSansDate) rouge.push(`écarts tir D — ${tirDSansDate} jamais comptés par la collecte`);
if (!renderFusionne) rouge.push(`correctif Render 0a81d48 — non fusionné dans main`);

L.push(`REVUE ${JOUR}`);
L.push("");
L.push(`PRODUCTION   ${publiees ?? "?"} réponses publiées · ${nonConf === 0 ? "toutes confirmées" : nonConf + " non confirmées"} · ${proxysOk}/${sante.length} proxys OK`);
L.push("");
L.push("ROUGE");
if (rouge.length) rouge.forEach((r) => L.push(`  • ${r}`));
else L.push("  — rien");
L.push("");
L.push(`DÉCISIONS    ${parEtat.proposee || 0} en attente · ${parEtat.approuvee || 0} approuvées · node revue/registre.js liste proposee`);
L.push(`DÉTAIL       revue/jour/${JOUR}/revue.md`);
console.log(L.join("\n"));
