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
const noms = lire("noms.json", {});

// Quand le produit vient de la commande et non du texte, le panier peut contenir plusieurs
// articles et l'avis n'en viser qu'un. « I just got the ring and love it! » ne doit pas
// atterrir sur les bombes semencières. Si le texte nomme un produit, il a le dernier mot.
const MOTS_PRODUIT = [
  [/\bmitaines? de four|oven mitts?\b/i, "milkweed-oven-mitts"],
  [/\bmitaines?|mitts?\b/i, "mittens"],
  [/\bcache[- ]cous?|neck ?warmer\b/i, "neckwarmer"],
  [/\bfoulard|scarf\b/i, "scarf"], [/\bbandeau|headband\b/i, "headband"],
  [/\btuques?|beanie\b/i, "tuque-ville-asclepiade"], [/\bsemelles?|insoles?\b/i, "thermal-insoles"],
  [/\bsac (à|a) lunch|lunch ?bag\b/i, "lunchbag"], [/\bbesace\b/i, "besace"],
  [/\bcoussin\b/i, "coussin-assise-thermal-pliable"], [/\bmanchons?|porte-canettes?\b/i, "manchon-isotherme-canettes-bouteilles"],
  [/\bglaci(è|e)re|cooler\b/i, "milkweed-cooler-backpack-30l"], [/\bpantoufles?|slippers\b/i, "pantoufles-dasclepiade"],
  [/\bmanteau|coat\b/i, "manteau-asclepiade"], [/\bgraines?|semences?|seeds?\b/i, "milkweed-seeds"],
  [/\bbague\b|\bring\b/i, "bague-aile-monarque"], [/\bpendentif\b/i, "pendentif-asclepias"],
  [/\bboucles? d.oreilles?\b/i, "boucles-oreilles-asclepias"], [/\bhuile\b/i, "huile-asclepiade"],
];
const nommes = (t) => new Set(MOTS_PRODUIT.filter(([re]) => re.test(t || "")).map(([, h]) => h));

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

// Les commandes anciennes pointent vers des fiches de prévente ou de fin de saison, aujourd'hui
// archivées. Un avis rattaché là n'apparaîtrait sur aucune page vivante. On le ramène sur la
// fiche courante. Les fiches « IMPARFAIT », elles, sont bien en vente et gardent leurs avis.
const ARCHIVES = {
  "mitaines-prevente-noel-2020": "mittens",
  "mitaines-prevente-janvier-fevrier-2021": "mittens",
  "mittens-mitaines-preorder-2021": "mittens",
  "mitaines-vente-fin-de-saison-2021": "mittens",
  "mittens-preorder-2022": "mittens",
  "mitts-sale-2022": "mittens",
  "mitaines-urbaines-isolees-en-asclepiade-ancienne-version": "mitaines-ville-asclepiade",
  "foulard-scarf-preorder-2021": "scarf",
  "foulard-pre-vente-janvier-2021": "scarf",
  "foulard-vente-de-fin-de-saison-2022": "scarf",
  "foulard-copie": "scarf",
  "semelles-interieures-isolantes-copy": "thermal-insoles",
  "couverture-imprimee-asclepiade-monarques-modele-discontinue": "couverture-imprimee-asclepiade-monarques",
  "pince-a-mitaines": "pince-a-mitaines-1",
  "2x-sac-lunch": "lunchbag", "4x-sac-lunch": "lunchbag",
  "2x-besace": "besace", "4x-besace": "besace",
};
const vivant = (h) => ARCHIVES[h] || h;

const net = (s) => (s || "").replace(/[\t\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
const lignes = [COL.join("\t")], doublons = [COL.join("\t")], sansCourriel = [COL.join("\t")], aVerifier = [COL.join("\t")], sansProduit = [];
const vus = new Set();
let nbAvis = 0, nbLignes = 0, nbViaCommande = 0;

for (const a of avis) {
  const courriel = (a.courriel || "").toLowerCase().trim();
  const date = (horo[a.id] && horo[a.id][a.date]) || (a.date ? `${a.date} 12:00:00 UTC` : "");
  let prods = (a.produits || []).filter(Boolean);
  let viaCommande = false;
  if (!prods.length && courriel && achats[courriel] && achats[courriel].length) {
    const cmd = achats[courriel];
    if (cmd.length <= PLAFOND_REPLI) { prods = [...new Set(cmd.map((x) => vivant(x.handle)))]; viaCommande = true; }
  }
  if (!prods.length) { sansProduit.push(a); continue; }
  nbAvis++;
  if (viaCommande) nbViaCommande++;
  for (const h0 of prods) {
    const h = vivant(h0);
    const cle = `${courriel}|${h}|${a.date}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    const l = {
      title: net(a.titre), body: net(a.corps), rating: String(a.note || 5),
      review_date: date, source: "web", curated: "ok",
      reviewer_name: net(a.nom) || noms[courriel] || "", reviewer_email: a.courriel || "",
      product_id: cat.get(h) || ((achats[courriel] || []).find((x) => x.handle === h) || {}).id || "",
      product_handle: h,
      reply: "", reply_date: "", picture_urls: "", ip_address: "", location: "", metaobject_handle: "",
    };
    const ligne = COL.map((c) => l[c]).join("\t");
    // Judge.me identifie l'auteur par son courriel : sans lui, la ligne ne s'importe pas.
    if (!courriel) { sansCourriel.push(ligne); continue; }
    if (viaCommande) {
      const cites = nommes(a.corps);
      if (cites.size && !cites.has(h)) { aVerifier.push(ligne); continue; }
    }
    if (dejaVerse.has(`${courriel}|${h}`)) doublons.push(ligne);
    else { lignes.push(ligne); nbLignes++; }
  }
}

fs.writeFileSync(`${DIR}/import_judgeme.tsv`, lignes.join("\n") + "\n");
fs.writeFileSync(`${DIR}/import_judgeme_doublons.tsv`, doublons.join("\n") + "\n");
fs.writeFileSync(`${DIR}/import_judgeme_a_verifier.tsv`, aVerifier.join("\n") + "\n");
fs.writeFileSync(`${DIR}/import_judgeme_sans_courriel.tsv`, sansCourriel.join("\n") + "\n");
fs.writeFileSync(`${DIR}/sans_produit.json`, JSON.stringify(sansProduit, null, 2));
const manquants = [...new Set([...vus].map((k) => k.split("|")[1]))].filter((h) => !cat.has(h));
console.log(JSON.stringify({
  avis_rediges: avis.length, avis_avec_produit: nbAvis, produit_via_commande_shopify: nbViaCommande, lignes_a_importer: nbLignes,
  lignes_a_verifier: aVerifier.length - 1, lignes_doublons_jetees: doublons.length - 1, lignes_sans_courriel: sansCourriel.length - 1, avis_sans_produit: sansProduit.length,
  handles_hors_catalogue: manquants,
}, null, 1));
