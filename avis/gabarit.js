// Produit le fichier d'importation Judge.me à partir des éloges repérés dans Missive.
// Colonnes et conventions reprises telles quelles des importations passées du Drive.
const fs = require("fs");
const DIR = __dirname;

const COLONNES = ["title","body","rating","review_date","source","curated","reviewer_name",
  "reviewer_email","product_id","product_handle","reply","reply_date","picture_urls",
  "ip_address","location","metaobject_handle"];

const lire = (f, def) => { try { return JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8")); } catch { return def; } };

// Personnes déjà importées lors des vagues précédentes : on ne les repasse pas.
const importes = lire("importes.json", []);
const dejaImporte = new Set();
for (const r of importes) if (r.courriel) dejaImporte.add(String(r.courriel).toLowerCase().trim());

// Produits achetés par le client, relevés dans Shopify. Fait foi sur le texte.
const achats = lire("achats_client.json", {});

// Repli quand Shopify ne dit rien : le produit nommé dans l'éloge lui-même.
const MOTS = [
  [/\bmitaines? (de )?ville|mitaines urbaines\b/i, "mitaines-ville-asclepiade"],
  [/\bmitaines?|mitts?\b/i, "mittens"],
  [/\bcache[- ]cous?|\bcols?\b|neck ?warmer/i, "neckwarmer"],
  [/\bfoulards?|scarf/i, "scarf"],
  [/\bbandeaux?|headband/i, "headband"],
  [/\btuque de sport|tuque sport/i, "tuque-sport-asclepiade"],
  [/\btuques?|beanie/i, "tuque-ville-asclepiade"],
  [/\bsemelles?|insoles?/i, "thermal-insoles"],
  [/\bsac (à|a) lunch|lunch ?bag|bo(î|i)te (à|a) lunch/i, "lunchbag"],
  [/\bsac (à|a) dos|glaci(è|e)re|cooler/i, "milkweed-cooler-backpack-30l"],
  [/\bsac (à|a) bouteille|bouteille de vin/i, "sac-bouteille-vin"],
  [/\bbesace/i, "besace"],
  [/\bcoussin/i, "coussin-assise-thermal-pliable"],
  [/\bmanchons?|canettes?|cans?\b/i, "manchon-isotherme-canettes-bouteilles"],
  [/\bpantoufles?|slippers/i, "pantoufles-dasclepiade"],
  [/\b(é|e)tui.{0,15}(t(é|e)l(é|e)phone|phone)/i, "etui-telephone-asclepiade"],
  [/\bmitaines? (de |pour )?four|oven mitts?/i, "milkweed-oven-mitts"],
  [/\bmanteau|coat/i, "manteau-asclepiade"],
  [/\bgraines?|semences?|seeds?|bombes? semenci(è|e)res?/i, "milkweed-seeds"],
  [/\bsac tote|tote bag/i, "insulated-tote-bag"],
];

const IDS = lire("mapping_produits.json", {});

function produits(d) {
  const cle = (d.courriel || "").toLowerCase().trim();
  const parAchat = achats[cle];
  if (parAchat && parAchat.length) return parAchat.map((p) => ({ handle: p.handle, id: p.id }));
  const txt = `${d.extrait || ""} ${d.sujet || ""}`;
  const vus = new Set();
  for (const [re, handle] of MOTS) if (re.test(txt) && !vus.has(handle)) vus.add(handle);
  return [...vus].map((h) => ({ handle: h, id: IDS[h] || "" }));
}

// « 2025-09-04 17:18:05 UTC », le format des importations passées.
function quand(d) {
  const t = d.date ? new Date(typeof d.date === "number" ? d.date * 1000 : d.date) : null;
  if (!t || isNaN(t)) return "";
  return t.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

const decisions = fs.readFileSync(`${DIR}/decisions.jsonl`, "utf8").split("\n")
  .filter((l) => l.trim()).map((l) => JSON.parse(l)).filter((d) => d.action === "ajouter");

const lignes = [COLONNES.join("\t")];
const sansProduit = [], sansCourriel = [], ecartes = [];
let nbAvis = 0;

for (const d of decisions) {
  const courriel = (d.courriel || "").toLowerCase().trim();
  if (!courriel) { sansCourriel.push(d); continue; }
  if (dejaImporte.has(courriel)) { ecartes.push(d); continue; }
  const prods = produits(d);
  if (!prods.length) { sansProduit.push(d); continue; }
  nbAvis++;
  for (const p of prods) {
    const l = {
      title: "", body: (d.extrait || "").replace(/[\t\n\r]+/g, " ").trim(),
      rating: "5", review_date: quand(d), source: "web", curated: "ok",
      reviewer_name: d.client || "", reviewer_email: d.courriel || "",
      product_id: p.id, product_handle: p.handle,
      reply: "", reply_date: "", picture_urls: "", ip_address: "", location: "", metaobject_handle: "",
    };
    lignes.push(COLONNES.map((c) => l[c]).join("\t"));
  }
}

fs.writeFileSync(`${DIR}/import_judgeme.tsv`, lignes.join("\n") + "\n");
fs.writeFileSync(`${DIR}/a_verifier.json`, JSON.stringify({ sansProduit, sansCourriel, ecartes }, null, 2));
console.log(JSON.stringify({
  candidats: decisions.length, avis_retenus: nbAvis, lignes_produites: lignes.length - 1,
  ecartes_deja_importes: ecartes.length, sans_produit: sansProduit.length, sans_courriel: sansCourriel.length,
}));
