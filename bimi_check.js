/**
 * bimi_check.js — état des lieux BIMI pour un domaine (lecture seule, ne modifie RIEN).
 * --------------------------------------------------------------------------
 * Vérifie, dans l'ordre où les boîtes de réception le font :
 *   1. SPF          — l'enregistrement existe, et qui est autorisé à envoyer
 *   2. DKIM         — sonde les sélecteurs connus (Google Workspace, Klaviyo, Shopify…)
 *   3. DMARC        — politique en vigueur; BIMI exige p=quarantine (pct=100) ou p=reject
 *   4. BIMI         — l'enregistrement <sélecteur>._bimi.<domaine>, le logo (l=) et
 *                     le certificat (a=)
 *   5. Le SVG       — conformité au profil « SVG Tiny Portable/Secure » exigé par BIMI,
 *                     que le fichier soit local ou déjà publié
 *
 *   node bimi_check.js                        # lasclay.com, + le SVG de bimi/
 *   node bimi_check.js lasclay.com            # idem, explicite
 *   node bimi_check.js lasclay.com bimi/lasclay-bimi-inverse.svg
 *
 * Variables d'environnement (toutes facultatives) :
 *   BIMI_SELECTOR   sélecteur BIMI à sonder (défaut « default »)
 *   BIMI_SVG        chemin du SVG local à valider (défaut bimi/lasclay-bimi.svg)
 *
 * Sortie : rapport lisible + code de sortie 0 si tout passe, 1 s'il reste une étape.
 * Node 18+ (fetch natif). Aucune dépendance.
 */
const dns = require("node:dns").promises;
const fs = require("node:fs");
const path = require("node:path");

const DOMAINE = process.argv[2] || "lasclay.com";
const SELECTEUR = process.env.BIMI_SELECTOR || "default";
const SVG_LOCAL = process.argv[3] || process.env.BIMI_SVG || path.join(__dirname, "bimi", "lasclay-bimi.svg");

// Sélecteurs DKIM des services que Lasclay utilise ou pourrait utiliser. La sonde est
// gratuite : un sélecteur absent ne veut pas dire que le service est mal configuré, il
// veut dire qu'il ne signe pas SOUS CE DOMAINE (donc pas d'alignement DMARC possible).
const SELECTEURS_DKIM = [
  ["google", "Google Workspace"],
  ["kl", "Klaviyo (SendGrid)"],
  ["kl2", "Klaviyo (SendGrid, rotation)"],
  ["shopifyemail", "Shopify (notifications + Shopify Email)"],
  ["s1", "SendGrid / Shopify (automated security)"],
  ["s2", "SendGrid / Shopify (automated security)"],
  ["omnisend", "Omnisend"],
  ["mandrill", "Mailchimp Transactional"],
  ["pm", "Postmark"],
  ["selector1", "Microsoft 365"],
  ["selector2", "Microsoft 365"],
];

const MAX_SVG = 32 * 1024; // BIMI : 32 Ko maximum
const OK = "   ok   ", KO = " MANQUE ", ATT = " À FAIRE";
const bilan = [];
const note = (statut, texte) => { bilan.push({ statut, texte }); console.log(`[${statut}] ${texte}`); };
const detail = (texte) => console.log(`         ${texte}`);

async function txt(nom) {
  try { return (await dns.resolveTxt(nom)).map((morceaux) => morceaux.join("")); }
  catch { return []; }
}
async function cname(nom) {
  try { return await dns.resolveCname(nom); } catch { return []; }
}

// Découpe « v=DMARC1; p=none; rua=… » en objet.
function balises(enr) {
  const out = {};
  for (const part of enr.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}

async function verifierSpf() {
  console.log("\n— SPF —");
  const enr = (await txt(DOMAINE)).filter((t) => t.toLowerCase().startsWith("v=spf1"));
  if (enr.length === 0) return note(KO, `aucun SPF sur ${DOMAINE}`);
  if (enr.length > 1) note(KO, `${enr.length} SPF sur ${DOMAINE} — un seul est permis, les boîtes rejettent le lot`);
  else note(OK, "SPF présent");
  for (const e of enr) detail(e);
  const inclus = enr.join(" ").match(/include:[^\s]+/g) || [];
  if (inclus.length) detail(`autorisés : ${inclus.map((i) => i.slice(8)).join(", ")}`);
  const tout = enr.join(" ").match(/[~\-?+]all/);
  if (tout) detail(`terminaison : ${tout[0]}  ${tout[0] === "-all" ? "(strict)" : "(souple)"}`);
}

async function verifierDkim() {
  console.log("\n— DKIM —");
  let trouves = 0;
  for (const [sel, service] of SELECTEURS_DKIM) {
    const nom = `${sel}._domainkey.${DOMAINE}`;
    const [t, c] = await Promise.all([txt(nom), cname(nom)]);
    if (t.length) { trouves++; note(OK, `${sel} — ${service} (clé publiée sur ${DOMAINE})`); }
    else if (c.length) { trouves++; note(OK, `${sel} — ${service} → ${c[0]}`); }
  }
  if (!trouves) note(KO, "aucun sélecteur DKIM connu — rien ne peut s'aligner en DMARC");
  const absents = SELECTEURS_DKIM.filter(([s]) => !bilan.some((b) => b.texte.startsWith(`${s} —`)));
  if (absents.length) detail(`non publiés : ${absents.map(([s]) => s).join(", ")}`);
  // Cas particulier Shopify : sans shopifyemail._domainkey, Shopify réécrit l'expéditeur
  // des confirmations de commande en @shopifyemail.com — le logo BIMI de lasclay.com ne
  // s'affichera JAMAIS sur ces courriels, quoi qu'on fasse par ailleurs.
  if (absents.some(([s]) => s === "shopifyemail")) {
    note(ATT, "domaine expéditeur Shopify non authentifié — les confirmations de commande partent de @shopifyemail.com et resteront sans logo");
  }
}

async function verifierDmarc() {
  console.log("\n— DMARC —");
  const enr = (await txt(`_dmarc.${DOMAINE}`)).filter((t) => t.toLowerCase().startsWith("v=dmarc1"));
  if (!enr.length) { note(KO, `aucun DMARC sur _dmarc.${DOMAINE}`); return null; }
  detail(enr[0]);
  const b = balises(enr[0]);
  const p = (b.p || "none").toLowerCase();
  const pct = b.pct === undefined ? 100 : Number(b.pct);
  const applique = (p === "quarantine" || p === "reject") && pct === 100;
  if (applique) note(OK, `politique p=${p} (pct=${pct}) — suffisante pour BIMI`);
  else note(ATT, `politique p=${p}${b.pct ? ` pct=${b.pct}` : ""} — BIMI exige p=quarantine avec pct=100, ou p=reject`);
  if (b.sp) detail(`sous-domaines : sp=${b.sp}`);
  if (b.rua) detail(`rapports agrégés : ${b.rua}`);
  else note(ATT, "pas de rua= — sans rapports agrégés, on durcit la politique à l'aveugle");
  return b;
}

async function verifierBimi() {
  console.log("\n— BIMI —");
  const nom = `${SELECTEUR}._bimi.${DOMAINE}`;
  const enr = (await txt(nom)).filter((t) => t.toLowerCase().startsWith("v=bimi1"));
  if (!enr.length) { note(ATT, `aucun enregistrement BIMI sur ${nom}`); return null; }
  detail(enr[0]);
  const b = balises(enr[0]);
  if (b.l) note(OK, `logo : ${b.l}`);
  else note(KO, "balise l= absente — pas de logo à afficher");
  if (b.a) note(OK, `certificat : ${b.a}`);
  else note(ATT, "balise a= absente — Gmail et Apple Mail n'afficheront rien sans VMC ou CMC");
  return b;
}

// Profil « SVG Tiny Portable/Secure » (SVG Tiny 1.2 restreint) exigé par BIMI.
function validerSvg(svg, source) {
  const pb = [];
  const octets = Buffer.byteLength(svg);
  if (octets > MAX_SVG) pb.push(`${(octets / 1024).toFixed(1)} Ko — la limite BIMI est de 32 Ko`);
  if (/<!DOCTYPE/i.test(svg)) pb.push("contient un <!DOCTYPE> (interdit)");
  const racine = svg.match(/<svg\b[^>]*>/i);
  if (!racine) { pb.push("aucune balise <svg> racine"); return { octets, pb }; }
  const r = racine[0];
  if (!/\bversion\s*=\s*["']1\.2["']/.test(r)) pb.push('version="1.2" absent de la balise <svg>');
  if (!/\bbaseProfile\s*=\s*["']tiny-ps["']/.test(r)) pb.push('baseProfile="tiny-ps" absent de la balise <svg>');
  for (const attr of ["x", "y", "width", "height"]) {
    if (new RegExp(`\\s${attr}\\s*=`, "i").test(r)) pb.push(`attribut ${attr} sur <svg> (interdit : seul viewBox est permis)`);
  }
  const vb = r.match(/viewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)/i);
  if (!vb) pb.push("viewBox absent");
  else {
    const [, , , w, h] = vb.map(Number);
    if (Math.abs(w - h) > 0.01) pb.push(`viewBox ${w}×${h} — le logo doit être carré (1:1)`);
  }
  const apresRacine = svg.slice(racine.index + r.length);
  const premier = apresRacine.match(/<([a-zA-Z][\w:-]*)/);
  if (!premier) pb.push("<svg> vide");
  else if (premier[1].toLowerCase() !== "title") pb.push(`<title> doit être le premier élément (trouvé <${premier[1]}>)`);
  for (const el of ["script", "image", "foreignObject", "animate", "animateTransform", "animateMotion", "set", "filter", "use"]) {
    if (new RegExp(`<${el}\\b`, "i").test(svg)) pb.push(`élément <${el}> présent (interdit par tiny-ps)`);
  }
  if (/xlink:href|\bhref\s*=/i.test(svg)) pb.push("référence href/xlink:href (aucun lien externe permis)");
  const externes = (svg.match(/https?:\/\/[^"'\s>]+/g) || []).filter((u) => !u.startsWith("http://www.w3.org/"));
  if (externes.length) pb.push(`URL externe : ${externes[0]}`);
  if (!pb.length) note(OK, `SVG conforme au profil tiny-ps — ${source} (${(octets / 1024).toFixed(1)} Ko)`);
  else { note(KO, `SVG non conforme — ${source}`); for (const p of pb) detail(`• ${p}`); }
  return { octets, pb };
}

async function verifierSvg(urlPubliee) {
  console.log("\n— Logo SVG —");
  if (fs.existsSync(SVG_LOCAL)) validerSvg(fs.readFileSync(SVG_LOCAL, "utf8"), SVG_LOCAL);
  else note(ATT, `aucun SVG local à ${SVG_LOCAL}`);
  if (!urlPubliee) return;
  try {
    const res = await fetch(urlPubliee, { redirect: "follow" });
    if (!res.ok) return note(KO, `${urlPubliee} → HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (!/image\/svg\+xml/i.test(ct)) note(KO, `Content-Type « ${ct} » — doit être image/svg+xml`);
    validerSvg(await res.text(), urlPubliee);
  } catch (e) {
    note(KO, `${urlPubliee} injoignable : ${String(e.message || e).slice(0, 120)}`);
  }
}

(async () => {
  console.log(`BIMI — état des lieux pour ${DOMAINE} (sélecteur « ${SELECTEUR} »)`);
  await verifierSpf();
  await verifierDkim();
  await verifierDmarc();
  const bimi = await verifierBimi();
  await verifierSvg(bimi && bimi.l);

  const manquants = bilan.filter((b) => b.statut !== OK);
  console.log("\n— Bilan —");
  if (!manquants.length) console.log("Tout est en place : le logo peut s'afficher.");
  else {
    console.log(`${manquants.length} point(s) à régler :`);
    for (const m of manquants) console.log(`  • ${m.texte}`);
    console.log("\nLa marche à suivre complète est dans bimi/README.md.");
  }
  process.exit(manquants.length ? 1 : 0);
})();
