// Assemble les avis rédigés par les agents en un fichier d'importation Judge.me.
const fs = require("fs");
const DIR = __dirname;
const COL = ["title","body","rating","review_date","source","curated","reviewer_name",
  "reviewer_email","product_id","product_handle","reply","reply_date","picture_urls",
  "ip_address","location","metaobject_handle"];

const lire = (f, def) => { try { return JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8")); } catch { return def; } };
const horo = lire("horodatage.json", {});
const importes = lire("importes.json", []);

const cat = new Map();
for (const l of fs.readFileSync(`${DIR}/catalogue.tsv`, "utf8").split("\n")) {
  const [h, id] = l.split("\t");
  if (h && id) cat.set(h.trim(), id.trim());
}

// Ce qui a déjà été versé lors des vagues précédentes : même personne, même produit.
const dejaVerse = new Set();
for (const r of importes) {
  const m = (r.courriel || "").toLowerCase().trim();
  if (m && r.produit_handle) dejaVerse.add(`${m}|${r.produit_handle}`);
}

const avis = [];
for (let i = 1; i <= 12; i++) {
  const p = `${DIR}/redige_${i}.jsonl`;
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try { avis.push(JSON.parse(l)); } catch {}
  }
}

// Produits réellement commandés, relevés dans Shopify. Ils servent de repli quand le client
// dit « j'adore vos produits » sans nommer d'article : le texte ne tranche pas, la commande si.
const achats = {};
for (const f of ["achats_A.json", "achats_B.json", "achats_C.json"]) {
  const p = `${DIR}/${f}`;
  if (!fs.existsSync(p)) continue;
  try {
    const o = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const [m, lot] of Object.entries(o)) {
      const cle = m.toLowerCase().trim();
      if (!achats[cle]) achats[cle] = [];
      for (const x of lot || []) if (!achats[cle].some((y) => y.handle === x.handle)) achats[cle].push(x);
    }
  } catch {}
}
// Une seule commande d'un seul produit ne laisse aucune ambiguïté. Au-delà de trois articles,
// on ne sait plus lequel le client louait : mieux vaut le laisser à la revue humaine.
const PLAFOND_REPLI = 3;

const net = (s) => (s || "").replace(/[\t\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
const lignes = [COL.join("\t")], doublons = [COL.join("\t")], sansProduit = [];
const vus = new Set();
let nbAvis = 0, nbLignes = 0, nbViaCommande = 0;

for (const a of avis) {
  const courriel = (a.courriel || "").toLowerCase().trim();
  const date = (horo[a.id] && horo[a.id][a.date]) || (a.date ? `${a.date} 12:00:00 UTC` : "");
  let prods = (a.produits || []).filter(Boolean);
  let viaCommande = false;
  if (!prods.length && courriel && achats[courriel] && achats[courriel].length) {
    const cmd = achats[courriel];
    if (cmd.length <= PLAFOND_REPLI) { prods = cmd.map((x) => x.handle); viaCommande = true; }
  }
  if (!prods.length) { sansProduit.push(a); continue; }
  nbAvis++;
  if (viaCommande) nbViaCommande++;
  for (const h of prods) {
    const cle = `${courriel}|${h}|${a.date}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    const l = {
      title: net(a.titre), body: net(a.corps), rating: String(a.note || 5),
      review_date: date, source: "web", curated: "ok",
      reviewer_name: net(a.nom), reviewer_email: a.courriel || "",
      product_id: cat.get(h) || ((achats[courriel] || []).find((x) => x.handle === h) || {}).id || "",
      product_handle: h,
      reply: "", reply_date: "", picture_urls: "", ip_address: "", location: "", metaobject_handle: "",
    };
    const ligne = COL.map((c) => l[c]).join("\t");
    if (courriel && dejaVerse.has(`${courriel}|${h}`)) doublons.push(ligne);
    else { lignes.push(ligne); nbLignes++; }
  }
}

fs.writeFileSync(`${DIR}/import_judgeme.tsv`, lignes.join("\n") + "\n");
fs.writeFileSync(`${DIR}/import_judgeme_doublons.tsv`, doublons.join("\n") + "\n");
fs.writeFileSync(`${DIR}/sans_produit.json`, JSON.stringify(sansProduit, null, 2));
const manquants = [...new Set([...vus].map((k) => k.split("|")[1]))].filter((h) => !cat.has(h));
console.log(JSON.stringify({
  avis_rediges: avis.length, avis_avec_produit: nbAvis, produit_via_commande_shopify: nbViaCommande, lignes_a_importer: nbLignes,
  lignes_doublons: doublons.length - 1, avis_sans_produit: sansProduit.length,
  handles_hors_catalogue: manquants,
}, null, 1));
