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
for (let i = 1; i <= 20; i++) {
  const p = `${DIR}/redige_${i}.jsonl`;
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try { avis.push(JSON.parse(l)); } catch {}
  }
}

// Produits réellement commandés, relevés dans Shopify. Ils servent de repli quand le client
// dit « j'adore vos produits » sans nommer d'article : le texte ne tranche pas, la commande si.
// Noms d'auteur. L'archive Missive ne garde souvent que l'adresse courriel dans le champ
// « from » : la reprendre telle quelle publierait l'adresse du client sur la boutique.
// Les vrais noms viennent de Shopify.
const noms = {};
for (const f of fs.readdirSync(DIR).filter((n) => /^noms(_.*)?\.json$/.test(n)).sort()) {
  const o = lire(f, {});
  for (const [m, n] of Object.entries(o)) {
    const cle = m.toLowerCase().trim();
    if (n && String(n).trim() && !String(n).includes("@")) noms[cle] = String(n).trim();
  }
}
// Un nom qui contient une arobase n'est pas un nom.
const nomPublic = (brut, courriel) => {
  const b = (brut || "").trim();
  if (b && !b.includes("@")) return b;
  return noms[courriel] || "";
};

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

// Un avis dont le texte est déjà publié mot pour mot sur Judge.me est un vrai doublon,
// même si la personne n'apparaît pas dans les importations passées.
const empreinte = (t) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 120);
const dejaPublie = new Set();
for (const a of lire("judgeme_avis.json", [])) {
  const e = empreinte(a.corps);
  if (e.length > 12) dejaPublie.add(e);
}

const achats = {};
// Les releves d'achats arrivent par lots successifs (A, B, C...). Une liste ecrite a la
// main en oublie toujours un et les avis perdent alors leur badge sans bruit : on balaie.
for (const f of fs.readdirSync(DIR).filter((n) => /^achats_.*\.json$/.test(n)).sort()) {
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
// Quand le client ne nomme aucun produit, l'avis va sur TOUT ce qu'il a acheté, relevé dans
// Shopify par son courriel. C'est la règle de la maison : un même éloge se publie sur chaque
// fiche concernée. Pas de plafond, sauf si son propre texte désigne un article précis.

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

// Familles de fiches qu'un client ne distingue pas en écrivant. Quand il dit « mitaines » et
// qu'il possède la version urbaine et non la version plein air, l'avis doit aller sur celle
// qu'il a réellement achetée : c'est la condition du badge « acheteur vérifié », et c'est
// simplement plus juste.
const FAMILLES = [
  ["mittens","mitaines-ville-asclepiade","mitaines-hiver-asclepiade-laine-cuir-naturel","mitaines-hiver-laine-asclepiade-naturelles","mitaines-bebe-asclepiade"],
  ["tuque-ville-asclepiade","tuque-sport-asclepiade"],
  ["neckwarmer","cache-cou-dasclepiade-imparfait","cache-cou-dasclepiade-imparfait-1"],
  ["lunchbag","sac-a-lunch-imparfait"],
  ["besace","besace-isotherme-en-asclepiade-imparfait"],
  ["thermal-insoles","semelles-interieures-isolantes-en-asclepiade-imparfait"],
  ["milkweed-cooler-backpack-30l","sac-a-dos-glaciere-30l-imparfait"],
  ["scarf","foulard-imparfait"],
  ["coussin-assise-thermal-pliable","coussin-dassise-thermal-pliable-imparfait"],
  ["manchon-isotherme-canettes-bouteilles","manchon-isotherme-pour-boissons-imparfait","manchon-isolant-canettes-slim"],
  ["insulated-tote-bag","sac-isotherme-type-tote-bag-imparfait"],
  ["milkweed-seeds","graines-semences-asclepiade-stratifiees-froid","milkweed-seed-bombs"],
  ["etui-telephone-asclepiade","etui-appareils-electroniques-asclepiade-2","etui-pour-tablette-isole-a-lasclepiade-imparfait"],
  ["manteau-asclepiade","manteau-hiver-asclepiade-quebecoise"],
];
const possede = {};
for (const [m, lot] of Object.entries(achats)) possede[m] = new Set(lot.map((x) => vivant(x.handle)));
function ajuste(h, courriel) {
  const a = possede[courriel];
  if (!a || a.size === 0 || a.has(h)) return h;
  const fam = FAMILLES.find((f) => f.includes(h));
  if (!fam) return h;
  const owned = fam.filter((x) => a.has(x));
  return owned.length === 1 ? owned[0] : h;
}
// Fiche archivée sans équivalent courant : un avis déposé là n'apparaîtrait nulle part.
// « giftcard » est la carte cadeau virtuelle : l'éloge du client porte sur ce qu'il a reçu
// avec, jamais sur le bon lui-même.
const MORTS = new Set(["glaciere-boissons-beer-cooler", "carte-cadeau", "giftcard", "crochet-a-mitaines",
  "illustrations-asclepiade-monarque", "mitaines-vente-fin-de-saison-2021"]);

// Fiches à l'état de brouillon dans Shopify : la page n'est pas publique, un avis déposé là
// resterait invisible. Aucune n'a d'équivalent vivant (l'étui pour tablette est discontinué,
// le sous-plat aussi), donc l'avis part vers les avis de boutique plutôt que d'être jeté.
const BROUILLONS = new Set(["etui-appareils-electroniques-asclepiade-2", "milkweed-large-trivet",
  "etui-pour-tablette-isole-a-lasclepiade-imparfait", "foulard-imparfait"]);

// Les fils Messenger et Instagram n'ont pas d'adresse : l'archive n'y garde qu'un nom
// d'affichage, qui atterrissait dans la colonne courriel. Judge.me identifie l'auteur par son
// adresse, une ligne sans adresse valable ne s'importe pas.
// Un avis ne peut jamais être signé par quelqu'un de la maison. Ces noms apparaissent dans
// l'archive parce que Missive stocke le nom d'affichage de l'expéditeur, y compris le nôtre
// sur les fils Messenger et Instagram.
// Avis écartés un par un, motif à l'appui. Le client a bien écrit ces mots, mais les publier
// tels quels le trahirait : le premier signale un défaut de couture, le second a retourné son
// cadeau. Les tronquer pour ne garder que l'éloge serait pire encore.
const REJETS = new Map([
  ["3d91b26e-009d-4bf3-95b1-00fb5292a9c5", "signale une couture décousue dans la même phrase"],
  ["431ba9ad-a3cc-4d3d-846e-a59f0040a035", "a demandé une étiquette de retour pour ces mitaines"],
]);

// Écartés nommément, preuve à l'appui dans le fil.
const ECARTES = new Set([
  "dominique.berthiaume@hotmail.com", // se présente comme représentant des ventes chez Red Bull
]);
const INTERNE = /@lasclay\.com|\blasclay\b|milkweed company|bedard[- ]?mercier|\bgouveia\b/i;
const ADRESSE = /^[^@\s,;]+@[^@\s,;]+\.[A-Za-z]{2,}$/;
const net = (s) => (s || "").replace(/[\t\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
const lignes = [COL.join("\t")], doublons = [COL.join("\t")], sansCourriel = [COL.join("\t")], sansNom = [COL.join("\t")], interne = [COL.join("\t")], aVerifier = [COL.join("\t")], sansProduit = [];
const provenance = {};
const rejetes = [];
const vus = new Set();
let nbAvis = 0, nbLignes = 0, nbViaCommande = 0;

for (const a of avis) {
  const courriel = (a.courriel || "").toLowerCase().trim();
  const date = (horo[a.id] && horo[a.id][a.date]) || (a.date ? `${a.date} 12:00:00 UTC` : "");
  let prods = (a.produits || []).filter(Boolean);
  let viaCommande = false;
  if (!prods.length && courriel && achats[courriel] && achats[courriel].length) {
    // Un client fidèle a pu acheter vingt articles en quatre ans. Son « j'apprécie beaucoup
    // vos produits » écrit un jour donné parle de ce qu'il vient de recevoir, pas de tout son
    // historique. On ne retient donc que la commande qui précède l'avis.
    const jour = (a.date || "").slice(0, 10);
    const parCommande = new Map();
    for (const x of achats[courriel]) {
      const d = (x.commande || "").slice(0, 10) || "0000-00-00";
      if (!parCommande.has(d)) parCommande.set(d, []);
      parCommande.get(d).push(x);
    }
    const dates = [...parCommande.keys()].sort();
    const avant = dates.filter((d) => !jour || d <= jour);
    const retenue = avant.length ? avant[avant.length - 1] : dates[0];
    const achetes = [...new Set(parCommande.get(retenue).map((x) => vivant(x.handle)))];
    // Si le client nomme un article dans son texte, on s'y tient et on ne distribue pas :
    // « I just got the ring and love it! » ne concerne que la bague, pas tout le panier.
    const cites = nommes(a.corps);
    const croises = achetes.filter((h) => cites.has(h));
    prods = (croises.length ? croises : (cites.size ? [...cites] : achetes)).filter((h) => !MORTS.has(h));
    viaCommande = true;
  }
  if (REJETS.has(a.id)) { rejetes.push([a.id, REJETS.get(a.id)]); continue; }
  // Le rabattement (vivant, ajuste) peut ramener vers une fiche brouillon : on filtre donc
  // sur le handle final, pas sur celui de départ.
  prods = [...new Set(prods.map((h) => ajuste(vivant(h), courriel)))].filter((h) => !BROUILLONS.has(h));
  if (!prods.length) { sansProduit.push(a); continue; }
  nbAvis++;
  if (viaCommande) nbViaCommande++;
  for (const h0 of prods) {
    const h = ajuste(vivant(h0), courriel);
    const cle = `${courriel}|${h}|${a.date}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    const l = {
      title: net(a.titre), body: net(a.corps), rating: String(a.note || 5),
      review_date: date, source: "web", curated: "ok",
      reviewer_name: nomPublic(net(a.nom), courriel), reviewer_email: a.courriel || "",
      product_id: cat.get(h) || ((achats[courriel] || []).find((x) => x.handle === h) || {}).id || "",
      product_handle: h,
      reply: "", reply_date: "", picture_urls: "", ip_address: "", location: "", metaobject_handle: "",
    };
    const ligne = COL.map((c) => l[c]).join("\t");
    // Judge.me identifie l'auteur par son courriel : sans lui, la ligne ne s'importe pas.
    if (!ADRESSE.test(courriel)) { sansCourriel.push(ligne); continue; }
    if (INTERNE.test(`${l.reviewer_name} ${courriel}`) || ECARTES.has(courriel)) { interne.push(ligne); continue; }
    // Publier une adresse courriel comme nom d'auteur exposerait le client. Jamais.
    if (!l.reviewer_name) { sansNom.push(ligne); continue; }
    if (dejaVerse.has(`${courriel}|${h}`) || dejaPublie.has(empreinte(l.body))) doublons.push(ligne);
    else {
      lignes.push(ligne); nbLignes++;
      // La page de controle qualite distingue le produit nomme par le client de celui
      // deduit de sa commande : le second merite un oeil, le premier non.
      provenance[`${courriel}|${h}|${date}`] = viaCommande ? "commande" : "texte";
    }
  }
}

// Un client fidèle écrit plusieurs fois « je suis satisfaite de mes achats » au fil des ans.
// Quatre fois le même éloge sur la même fiche produit se lit comme du remplissage : on garde
// le passage le plus complet, celui qui porte un titre et le texte le plus long.
const meilleur = new Map();
for (const ligne of lignes.slice(1)) {
  const c = ligne.split("\t");
  const cle = `${(c[7] || "").toLowerCase()}|${c[9]}`;
  const rang = (c[0] ? 1e6 : 0) + c[1].length;
  const vu = meilleur.get(cle);
  if (!vu || rang > vu.rang) meilleur.set(cle, { ligne, rang });
}
const retenues = [lignes[0], ...[...meilleur.values()].map((x) => x.ligne)];
const nbCondenses = lignes.length - retenues.length;
nbLignes = retenues.length - 1;

// Ces clients ont écrit au soutien pour un bris, une couture qui lâche ou une taille qui ne
// va pas, pas pour laisser un avis public. Publier leur message tel quel serait honnête sur
// la note et injuste envers eux : la maison a réglé le cas, l'avis, lui, resterait en ligne.
// Ils partent dans un fichier à part, que la personne qui importe tranche à la main.
const PANNE = new RegExp([
  "d(e|é)cous", "d(e|é)coll", "bris(e|é|er|ée)", "cass(e|é|ée|ées)", "d(e|é)chir", "effiloch",
  "trop (petit|petite|grand|grande|serr|court|large|juste)", "ne me fait pas", "ne lui fait pas",
  "insatisfait", "d(e|é)çue?", "ne (l'|les )?utiliser?a( pas|it pas)", "manque la bourrure",
  "ne tient pas", "a c(e|é)d(e|é)", "fermeture (e|é)clair n'est pas assez solide", "d(e|é)faut",
].join("|"), "i");

const publiables = [retenues[0]], aRelire = [retenues[0]];
for (const ligne of retenues.slice(1)) {
  const c = ligne.split("\t");
  // Une note de 5 signifie que le client n'a rien à redire : « sans avoir peur que ça se
  // découse » est un compliment, pas un bris. Le tri ne s'applique donc qu'en dessous.
  (c[2] === "3" || (c[2] === "4" && PANNE.test(c[1])) ? aRelire : publiables).push(ligne);
}
nbLignes = publiables.length - 1;

fs.writeFileSync(`${DIR}/import_judgeme.tsv`, publiables.join("\n") + "\n");
fs.writeFileSync(`${DIR}/import_judgeme_a_relire.tsv`, aRelire.join("\n") + "\n");
fs.writeFileSync(`${DIR}/import_judgeme_doublons.tsv`, doublons.join("\n") + "\n");
fs.writeFileSync(`${DIR}/import_judgeme_sans_nom.tsv`, sansNom.join("\n") + "\n");
fs.writeFileSync(`${DIR}/import_judgeme_a_verifier.tsv`, aVerifier.join("\n") + "\n");
fs.writeFileSync(`${DIR}/import_judgeme_sans_courriel.tsv`, sansCourriel.join("\n") + "\n");
fs.writeFileSync(`${DIR}/provenance.json`, JSON.stringify(provenance));
fs.writeFileSync(`${DIR}/sans_produit.json`, JSON.stringify(sansProduit, null, 2));
const manquants = [...new Set([...vus].map((k) => k.split("|")[1]))].filter((h) => !cat.has(h));
const boutique = [COL.join("\t")];
let nbBoutique = 0, boutiqueSansNom = 0, boutiqueDoublons = 0, boutiqueSansAdresse = 0, boutiqueInterne = 0;
for (const a of sansProduit) {
  const courriel = (a.courriel || "").toLowerCase().trim();
  if (!ADRESSE.test(courriel)) { boutiqueSansAdresse++; continue; }
  const nom = nomPublic(net(a.nom), courriel);
  if (!nom) { boutiqueSansNom++; continue; }
  const l = {
    title: net(a.titre), body: net(a.corps), rating: String(a.note || 5),
    review_date: (horo[a.id] && horo[a.id][a.date]) || (a.date ? `${a.date} 12:00:00 UTC` : ""),
    source: "web", curated: "ok", reviewer_name: nom, reviewer_email: a.courriel || "",
    product_id: "", product_handle: "",
    reply: "", reply_date: "", picture_urls: "", ip_address: "", location: "", metaobject_handle: "",
  };
  if (INTERNE.test(`${nom} ${courriel}`) || ECARTES.has(courriel)) { boutiqueInterne++; continue; }
  if (dejaPublie.has(empreinte(l.body))) { boutiqueDoublons++; continue; }
  boutique.push(COL.map((c) => l[c]).join("\t"));
  nbBoutique++;
}
fs.writeFileSync(`${DIR}/import_judgeme_boutique.tsv`, boutique.join("\n") + "\n");

console.log(JSON.stringify({
  avis_boutique: nbBoutique, boutique_ecartes_sans_nom: boutiqueSansNom, boutique_doublons: boutiqueDoublons, boutique_sans_adresse: boutiqueSansAdresse,
  avis_rediges: avis.length, avis_avec_produit: nbAvis, produit_via_commande_shopify: nbViaCommande, lignes_a_importer: nbLignes,
  lignes_condensees_meme_personne_meme_produit: nbCondenses, avis_rejetes_nommement: rejetes,
 lignes_a_relire_bris_ou_taille: aRelire.length - 1,
 lignes_a_verifier: aVerifier.length - 1, lignes_doublons_jetees: doublons.length - 1, lignes_sans_courriel: sansCourriel.length - 1, avis_sans_produit: sansProduit.length,
  handles_hors_catalogue: manquants,
}, null, 1));
