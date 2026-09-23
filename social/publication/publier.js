#!/usr/bin/env node
/**
 * Routine « Publication Instagram » — trois publications par semaine sur @lasclay (FR) et
 * @milkweed.company (EN), médias tirés du Drive Lasclay, programmées dans Buffer.
 *
 * Le partage des rôles, comme pour le backlog Facebook : ce script porte tout ce qui est
 * MÉCANIQUE (créneau, rotation des angles, vivier de médias, rendu d'image, contrôles de
 * texte, appel Buffer, journal). La session ne fait que ce qu'un script ne sait pas faire :
 * REGARDER les médias, CHOISIR, ÉCRIRE les légendes.
 *
 *   node social/publication/publier.js preparer [--theme <id>] [--n 8]
 *        → le créneau à remplir, l'angle, et N médias candidats avec leur aperçu à regarder
 *   node social/publication/publier.js noter <annotations.json>
 *        → consigne ce que tu as vu (description, verdict) : la banque s'annote au fil des tirs
 *   node social/publication/publier.js apercu <publication.json>
 *        → rend l'image finale telle qu'Instagram la recevra + contrôle des légendes
 *   node social/publication/publier.js programmer <publication.json>
 *        → programme dans Buffer les deux publications (FR puis EN) et journalise
 *   node social/publication/publier.js etat
 *
 * Tout passe par le General Proxy (connecteur buffer) : aucune clé ici.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const drive = require("../drive");

const ICI = __dirname;
const RACINE_DEPOT = path.join(ICI, "..", "..");
const ETAT = path.join(ICI, "etat");
const JOURNAL = path.join(ETAT, "journal.jsonl");
const VUS = path.join(ETAT, "vus.json");
const THEMES = require("./themes.json").themes;
const LOT = path.join(drive.TMP, "lot.json");

// Canaux Buffer, vérifiés le 23 sept. 2026 : publication automatique (pas de mode rappel).
const CANAUX = {
  fr: { compte: "main", channelId: "68e6c20cca3a4e6b746c45e7", nom: "@lasclay" },
  en: { compte: "3", channelId: "69a761e23f3b94a12111f98a", nom: "@milkweed.company" },
};

// Créneaux, heure de l'Est (America/Toronto). jour : 0 = dimanche.
// Choisis d'après l'historique de @lasclay (39 publications, voir ROUTINE.md) : les deux records
// de vues sont des dimanches matin, et les publications de midi à 14 h sont sous la médiane de
// leur période. Indice, pas preuve : à revoir après 20 publications. EN décalé d'une heure :
// le public anglophone s'étale jusqu'à la côte ouest.
const CRENEAUX = [
  { jour: 2, h: 8, m: 0 },
  { jour: 4, h: 8, m: 0 },
  { jour: 0, h: 9, m: 0 },
];
const DECALAGE_EN_MIN = 60;
const DELAI_MIN_AVANT_CRENEAU_MIN = 90; // jamais programmer un créneau qui part dans moins de 1 h 30

// Vivier : seuls les chemins qui parlent de la plante, de ses insectes ou de ses graines.
// Tout le reste (produits, usine, portraits, tournages de mode) est hors sujet ici.
const PERTINENT = /ascl[ée]pi|monarq|milkweed|chenill|chrysalid|saguenay|fleur|graine|plantul|r[ée]colte|culture ascl|bombe|papillon/i;
const HORS_VIVIER = /image avec informations|etsy|sachet|small jpgs|downsize|reduced|resize|png test|photoshop|old stuff|prod mitaines|coussin|si[èe]ge|bijoux|animation|psd|logo/i;
const MIMES_IMAGE = /^image\/(jpeg|png|heif|heic|webp|tiff)$/;

// ---------------------------------------------------------------------------------------
// Heure de Toronto, sans dépendance
function decalageToronto(date) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(date);
  const g = (t) => +p.find((x) => x.type === t).value;
  return (Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - Math.floor(date.getTime() / 60000) * 60000) / 60000;
}
function torontoVersUTC(a, mo, j, h, mi) {
  const naif = Date.UTC(a, mo - 1, j, h, mi);
  let t = naif - decalageToronto(new Date(naif)) * 60000;
  t = naif - decalageToronto(new Date(t)) * 60000; // second passage : juste autour des changements d'heure
  return new Date(t);
}
function localToronto(date) {
  const p = new Intl.DateTimeFormat("fr-CA", { timeZone: "America/Toronto", weekday: "long", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
  return p;
}
function prochainCreneau(maintenant = new Date()) {
  const seuil = maintenant.getTime() + DELAI_MIN_AVANT_CRENEAU_MIN * 60000;
  const off = decalageToronto(maintenant);
  const local = new Date(maintenant.getTime() + off * 60000); // champs UTC = heure de Toronto
  for (let d = 0; d < 9; d++) {
    const jour = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + d));
    for (const c of CRENEAUX) {
      if (jour.getUTCDay() !== c.jour) continue;
      const fr = torontoVersUTC(jour.getUTCFullYear(), jour.getUTCMonth() + 1, jour.getUTCDate(), c.h, c.m);
      if (fr.getTime() < seuil) continue;
      const en = new Date(fr.getTime() + DECALAGE_EN_MIN * 60000);
      return { fr: fr.toISOString(), en: en.toISOString(), libelle: localToronto(fr), mois: jour.getUTCMonth() + 1 };
    }
  }
  throw new Error("aucun créneau dans les 9 prochains jours — CRENEAUX vide ?");
}

// ---------------------------------------------------------------------------------------
// État
const lireJson = (f, defaut) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return defaut; } };
const journal = () => (fs.existsSync(JOURNAL) ? fs.readFileSync(JOURNAL, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const ecrireJournal = (e) => { fs.mkdirSync(ETAT, { recursive: true }); fs.appendFileSync(JOURNAL, JSON.stringify(e) + "\n"); };

function buffer(action, params) {
  const out = execFileSync("node", [path.join(RACINE_DEPOT, "connectors_client.js"), "buffer", action, JSON.stringify(params)], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const r = JSON.parse(out);
  if (!r.ok) throw new Error(`buffer ${action} : ${out.slice(0, 800)}`);
  return r.data;
}

async function inventaireFrais() {
  const inv = lireJson(drive.INVENTAIRE, null);
  const age = inv ? (Date.now() - Date.parse(inv.genere)) / 86400000 : Infinity;
  if (inv && age < 7) return inv;
  console.error(`inventaire ${inv ? `vieux de ${age.toFixed(1)} j` : "absent"} : nouveau parcours du Drive (≈ 2 min)…`);
  return drive.inventaire();
}

// ---------------------------------------------------------------------------------------
// preparer
function choisirTheme(mois, force) {
  if (force) {
    const t = THEMES.find((x) => x.id === force);
    if (!t) throw new Error(`angle inconnu : ${force} — connus : ${THEMES.map((x) => x.id).join(", ")}`);
    return t;
  }
  const dernier = {};
  journal().forEach((e, i) => { dernier[e.theme] = i; });
  const saison = THEMES.filter((t) => t.mois.includes(mois));
  const pool = saison.length ? saison : THEMES;
  // Le moins récemment servi ; à égalité, tirage.
  return pool.map((t) => ({ t, r: dernier[t.id] ?? -1, x: Math.random() })).sort((a, b) => a.r - b.r || a.x - b.x)[0].t;
}

function candidats(inv, theme, n) {
  const utilises = new Set(journal().map((e) => e.media_id));
  const vus = lireJson(VUS, {});
  // Correspondance en DÉBUT de mot : « graine » attrape « graines », mais « vol » n'attrape
  // pas « Volcano » (ce qui faisait remonter tout le dossier VOLCANO pour l'angle des graines).
  const mots = theme.mots_cles.map((k) => new RegExp(`(^|[^\\p{L}])${k.toLowerCase()}`, "u"));
  const pool = inv.medias.filter((m) => {
    if (utilises.has(m.id)) return false;
    if (vus[m.id] && vus[m.id].verdict === "rejete") return false;
    if (!PERTINENT.test(m.chemin) || HORS_VIVIER.test(`${m.chemin}/${m.nom}`)) return false;
    if (m.type === "image") return MIMES_IMAGE.test(m.mime || "image/jpeg");
    return m.type === "video";
  });
  const score = (m) => {
    const texte = `${m.chemin} ${m.nom} ${(vus[m.id] && [vus[m.id].description, ...(vus[m.id].tags || [])].join(" ")) || ""}`.toLowerCase();
    let s = mots.some((re) => re.test(texte)) ? 4 : 0;
    if (vus[m.id] && vus[m.id].verdict === "ok") s += 1 + (vus[m.id].note || 3) / 2;
    if (m.priorite === 1) s += 1.5;
    if (m.type === "video") s -= 0.5; // photo d'abord : aucun recadrage vidéo possible ici
    return s + Math.random() * 1.5;
  };
  const tries = pool.map((m) => ({ m, s: score(m) })).sort((a, b) => b.s - a.s);
  // Au moins deux médias jamais regardés, pour que la banque s'annote au fil des tirs.
  const choix = tries.slice(0, Math.max(0, n - 2)).map((x) => x.m);
  const jamais = tries.filter((x) => !vus[x.m.id] && !choix.includes(x.m)).slice(0, n - choix.length).map((x) => x.m);
  return { pool: pool.length, choix: [...choix, ...jamais] };
}

async function preparer(args) {
  const creneau = prochainCreneau();
  const deja = journal().find((e) => e.creneau_fr === creneau.fr && e.statut !== "annule");
  if (deja) {
    console.log(JSON.stringify({ deja: true, creneau, publication: deja }, null, 2));
    return;
  }
  const inv = await inventaireFrais();
  const theme = choisirTheme(creneau.mois, args.theme);
  const n = +args.n || 8;
  const { pool, choix } = candidats(inv, theme, n);
  const vus = lireJson(VUS, {});
  const liste = [];
  for (const m of choix) {
    try {
      const v = await drive.vignette(m.id, 1024, m.type);
      const meta = m.type === "video" ? await drive.video(m.id) : await drive.dims(m.id);
      liste.push({ id: m.id, type: m.type, chemin: `${m.chemin}/${m.nom}`, apercu: v.fichier, ...(m.type === "video" ? { video: meta } : { original: meta }), deja_vu: vus[m.id] || null });
    } catch (e) {
      liste.push({ id: m.id, type: m.type, chemin: `${m.chemin}/${m.nom}`, erreur: e.message });
    }
  }
  const lot = { creneau, theme: { id: theme.id, titre: theme.titre, angle: theme.angle, faits: theme.faits, pieges: theme.pieges }, vivier: pool, candidats: liste };
  fs.mkdirSync(drive.TMP, { recursive: true });
  fs.writeFileSync(LOT, JSON.stringify(lot, null, 2));
  console.log(JSON.stringify(lot, null, 2));
}

// ---------------------------------------------------------------------------------------
// noter
function noter(fichier) {
  const entrees = lireJson(fichier, null);
  if (!Array.isArray(entrees)) throw new Error(`${fichier} : tableau JSON attendu`);
  const vus = lireJson(VUS, {});
  for (const e of entrees) {
    if (!e.id || !["ok", "rejete"].includes(e.verdict)) throw new Error(`entrée invalide (id et verdict ok|rejete requis) : ${JSON.stringify(e)}`);
    vus[e.id] = { description: e.description || "", tags: e.tags || [], verdict: e.verdict, raison: e.raison || "", note: e.note || null, vu_le: new Date().toISOString().slice(0, 10) };
  }
  fs.mkdirSync(ETAT, { recursive: true });
  fs.writeFileSync(VUS, JSON.stringify(vus, null, 1));
  console.log(JSON.stringify({ ok: true, notes: entrees.length, banque_annotee: Object.keys(vus).length }));
}

// ---------------------------------------------------------------------------------------
// Rendu du média final
const FORMATS = {
  "4:5": { ratio: 0.8, opt: "w1080-h1350-p", w: 1080, h: 1350 },
  "1:1": { ratio: 1, opt: "w1080-h1080-p", w: 1080, h: 1080 },
  "1.91:1": { ratio: 1.91, opt: "w1080-h566-p", w: 1080, h: 566 },
};

async function media(pub) {
  const inv = lireJson(drive.INVENTAIRE, { medias: [] });
  const m = inv.medias.find((x) => x.id === pub.media_id);
  if (!m) throw new Error(`media_id ${pub.media_id} absent de l'inventaire`);
  const erreurs = [];
  const avis = [];
  if (m.type === "video") {
    const v = await drive.video(m.id);
    if (!(v.duree_s >= 3 && v.duree_s <= 90)) erreurs.push(`vidéo de ${v.duree_s} s : il faut entre 3 et 90 s`);
    if (v.octets > 250 * 1048576) erreurs.push(`vidéo de ${v.mo} Mo : plafond fixé à 250 Mo`);
    if (v.ratio && (v.ratio < 0.5 || v.ratio > 1.91)) erreurs.push(`ratio vidéo ${v.ratio} hors de 0,5 à 1,91`);
    if (v.ratio && v.ratio > 1) avis.push(`vidéo horizontale (${v.ratio}) : le Reel s'affichera avec des bandes ; une verticale ferait mieux`);
    return { m, url: v.url, asset: { video: { url: v.url } }, type: "reel", info: v, erreurs, avis };
  }
  const d = await drive.dims(m.id);
  if (!d) throw new Error(`dimensions illisibles pour ${m.id}`);
  let url;
  if (pub.format === "original") {
    if (d.ratio < 0.8 || d.ratio > 1.91) erreurs.push(`format « original » impossible : ratio ${d.ratio} hors de 0,8 à 1,91 (Instagram refuse) — choisis 4:5, 1:1 ou 1.91:1`);
    if (d.largeur < 1080) avis.push(`original de ${d.largeur} px de large : moins que 1080`);
    url = drive.urlImage(m.id, "w1080");
  } else {
    const f = FORMATS[pub.format];
    if (!f) throw new Error(`format inconnu « ${pub.format} » — 4:5, 1:1, 1.91:1 ou original`);
    // Facteur d'agrandissement que le recadrage imposerait à l'original.
    const echelle = d.ratio < f.ratio ? f.w / d.largeur : f.h / d.hauteur;
    if (echelle > 1.35) erreurs.push(`original trop petit (${d.largeur}×${d.hauteur}) : agrandi ×${echelle.toFixed(2)} en ${pub.format}`);
    else if (echelle > 1.05) avis.push(`original légèrement agrandi (×${echelle.toFixed(2)})`);
    url = drive.urlImage(m.id, f.opt);
  }
  return { m, url, asset: { image: { url } }, type: "post", info: d, erreurs, avis };
}

// ---------------------------------------------------------------------------------------
// Contrôle des légendes. Erreur = bloque la programmation. Avis = à trancher par la session.
const INTERDITS = [
  [/sauv\w* (les |un |des |le )?(papillons? )?monarques?/i, "« sauver les monarques » : le lien est systémique, jamais un achat qui sauve"],
  [/\bsav(e|es|ed|ing) (the |a )?monarchs?\b|#savethemonarchs/i, "« save the monarchs » : même garde-fou qu'en français"],
  [/made in (qu[ée]bec|canada)|fabriqu\w* (au|ici|localement)|fait (au qu[ée]bec|ici)|produit (québécois|local)|100 ?% (local|québécois)/i, "origine de fabrication : seul l'ISOLANT est fait au Québec, jamais le produit fini"],
  [/100 ?%|z[ée]ro impact|zero impact|carbon[e]? neutre|carbon neutral/i, "absolu environnemental interdit"],
  [/imperm[ée]able|waterproof/i, "dire « hydrophobe » ou « résistante à l'eau », jamais imperméable"],
  [/plus chaud\w* que le duvet|warmer than (goose )?down/i, "comparaison absolue au duvet interdite (la fibre, pas le produit, et avec la source)"],
  [/—/, "cadratin : convention Lasclay, remplacer par virgule, deux-points ou parenthèses"],
  [/curassavica|tropical milkweed|ascl[ée]piade tropicale/i, "l'asclépiade tropicale n'est ni vendue ni promue par Lasclay"],
];
const AVIS = [
  [/\b(nos champs|on (plante|cultive)|we (grow|plant)|our fields)\b/i, "Lasclay achète à des cultivateurs, elle ne cultive pas : vérifier la phrase"],
  [/ce n'est pas .{1,60}, c'est|ce n'est pas .{1,60}\. c'est|non seulement|it'?s not .{1,60}, it'?s|not (just|only) .{1,60}, but/i, "tic d'antithèse (« ce n'est pas X, c'est Y ») : à réécrire"],
  [/https?:\/\//i, "lien dans une légende Instagram : non cliquable"],
  [/\b(achetez|commandez|magasinez|shop now|buy now|order now)\b/i, "appel à l'achat : la publication célèbre la plante, elle ne vend pas"],
];

function controler(pub) {
  const erreurs = [];
  const avis = [];
  for (const langue of ["fr", "en"]) {
    const b = pub[langue];
    if (!b || !b.legende) { erreurs.push(`${langue} : légende manquante`); continue; }
    const t = b.legende;
    if (t.length > 2200) erreurs.push(`${langue} : ${t.length} caractères, plafond Instagram 2200`);
    if (t.length > 900) avis.push(`${langue} : ${t.length} caractères, on vise une légende COURTE (≈ 300 à 700)`);
    if (t.length < 120) avis.push(`${langue} : ${t.length} caractères, probablement trop mince pour expliquer quoi que ce soit`);
    const tags = t.match(/#[\p{L}\p{N}_]+/gu) || [];
    if (tags.length > 5) erreurs.push(`${langue} : ${tags.length} hashtags, 5 au plus`);
    if ((t.match(/\p{Extended_Pictographic}/gu) || []).length > 2) avis.push(`${langue} : plus de deux émojis`);
    if (!b.alt || b.alt.length < 20) erreurs.push(`${langue} : texte alternatif (alt) manquant ou trop court`);
    for (const [re, msg] of INTERDITS) if (re.test(t)) erreurs.push(`${langue} : ${msg}`);
    for (const [re, msg] of AVIS) if (re.test(t)) avis.push(`${langue} : ${msg}`);
  }
  if (pub.fr && /\b(tu|toi|ton|ta|tes)\b/i.test(pub.fr.legende || "")) avis.push("fr : tutoiement repéré, Lasclay vouvoie");
  if (pub.fr && pub.en && pub.fr.legende && pub.en.legende) {
    const a = pub.fr.legende.split(/\s+/).length;
    const b = pub.en.legende.split(/\s+/).length;
    if (Math.abs(a - b) / Math.max(a, b) < 0.08) avis.push("fr et en de longueur quasi identique : vérifier que l'anglais est écrit pour son public et non traduit mot à mot");
  }
  return { erreurs, avis };
}

async function apercu(fichier, silencieux = false) {
  const pub = lireJson(fichier, null);
  if (!pub || !pub.media_id) throw new Error(`${fichier} : { media_id, format, theme, fr:{legende,alt}, en:{legende,alt} } attendu`);
  const md = await media(pub);
  const txt = controler(pub);
  let rendu = null;
  if (md.type === "post") {
    const r = await drive.get(md.url);
    const buf = Buffer.from(await r.arrayBuffer());
    rendu = path.join(drive.TMP, `rendu-${pub.media_id}.jpg`);
    fs.writeFileSync(rendu, buf);
    const d = drive.dimensions(buf) || {};
    rendu = { fichier: rendu, largeur: d.w, hauteur: d.h };
  }
  const res = { creneau: prochainCreneau(), media: { id: md.m.id, chemin: `${md.m.chemin}/${md.m.nom}`, type: md.type, url: md.url, info: md.info }, rendu, erreurs: [...md.erreurs, ...txt.erreurs], avis: [...md.avis, ...txt.avis] };
  if (!silencieux) console.log(JSON.stringify(res, null, 2));
  return { pub, md, res };
}

// ---------------------------------------------------------------------------------------
// programmer
async function programmer(fichier) {
  const { pub, md, res } = await apercu(fichier, true);
  if (res.erreurs.length) {
    console.log(JSON.stringify({ programme: false, erreurs: res.erreurs, avis: res.avis }, null, 2));
    process.exit(2);
  }
  const creneau = res.creneau;
  if (journal().find((e) => e.creneau_fr === creneau.fr && e.statut !== "annule")) throw new Error(`créneau ${creneau.libelle} déjà rempli`);
  if (journal().find((e) => e.media_id === pub.media_id)) throw new Error(`média ${pub.media_id} déjà publié`);

  const entree = { date: new Date().toISOString(), creneau_fr: creneau.fr, creneau_en: creneau.en, libelle: creneau.libelle, theme: pub.theme, media_id: pub.media_id, chemin: res.media.chemin, format: pub.format || null, url: md.url, legende_fr: pub.fr.legende, legende_en: pub.en.legende, statut: "programme" };
  for (const langue of ["fr", "en"]) {
    const c = CANAUX[langue];
    const asset = md.type === "post" ? { image: { url: md.url, metadata: { altText: pub[langue].alt } } } : { video: { url: md.url } };
    try {
      const post = buffer("createpost", {
        compte: c.compte,
        channelId: c.channelId,
        text: pub[langue].legende,
        assets: [asset],
        metadata: { instagram: { type: md.type, shouldShareToFeed: true } },
        mode: "customScheduled",
        dueAt: langue === "fr" ? creneau.fr : creneau.en,
        schedulingType: "automatic",
      });
      entree[langue] = { canal: c.nom, id: post.id, statut: post.status, dueAt: post.dueAt };
    } catch (e) {
      entree[langue] = { canal: c.nom, erreur: String(e.message).slice(0, 600) };
      entree.statut = langue === "fr" ? "echec" : "partiel";
      ecrireJournal(entree);
      console.log(JSON.stringify({ programme: langue !== "fr", entree }, null, 2));
      process.exit(3);
    }
  }
  ecrireJournal(entree);
  console.log(JSON.stringify({ programme: true, entree, avis: res.avis }, null, 2));
}

// ---------------------------------------------------------------------------------------
function etat() {
  const j = journal();
  const inv = lireJson(drive.INVENTAIRE, null);
  const vus = lireJson(VUS, {});
  const usage = {};
  j.forEach((e) => { usage[e.theme] = (usage[e.theme] || 0) + 1; });
  console.log(JSON.stringify({
    prochain_creneau: prochainCreneau(),
    publications: j.length,
    dernieres: j.slice(-6).map((e) => ({ libelle: e.libelle, theme: e.theme, statut: e.statut, fr: e.fr && (e.fr.id || e.fr.erreur), en: e.en && (e.en.id || e.en.erreur) })),
    angles: THEMES.map((t) => ({ id: t.id, publies: usage[t.id] || 0 })),
    inventaire: inv ? { genere: inv.genere, ...inv.compte } : null,
    banque_annotee: { total: Object.keys(vus).length, ok: Object.values(vus).filter((v) => v.verdict === "ok").length, rejetes: Object.values(vus).filter((v) => v.verdict === "rejete").length },
  }, null, 2));
}

module.exports = { prochainCreneau, controler, CRENEAUX };

if (require.main === module) {
  (async () => {
    const [cmd, ...reste] = process.argv.slice(2);
    const args = {};
    for (let i = 0; i < reste.length; i++) if (reste[i].startsWith("--")) args[reste[i].slice(2)] = reste[i + 1];
    try {
      if (cmd === "preparer") await preparer(args);
      else if (cmd === "noter") noter(reste[0]);
      else if (cmd === "apercu") await apercu(reste[0]);
      else if (cmd === "programmer") await programmer(reste[0]);
      else if (cmd === "etat") etat();
      else {
        console.error("Usage : node social/publication/publier.js preparer [--theme id] [--n 8] | noter <f.json> | apercu <pub.json> | programmer <pub.json> | etat");
        process.exit(1);
      }
    } catch (e) {
      console.error("Erreur :", e.message);
      process.exit(1);
    }
  })();
}
