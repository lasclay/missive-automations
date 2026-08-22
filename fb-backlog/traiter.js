#!/usr/bin/env node
/**
 * Lasclay — traitement du backlog de commentaires Facebook
 * --------------------------------------------------------------------------
 * Ce script porte tout ce qui est MÉCANIQUE : moissonner, choisir, cadencer,
 * publier, vérifier, journaliser. Il ne rédige rien. La rédaction reste à
 * Claude, parce qu'elle demande du jugement et que chaque réponse doit être
 * unique. Le partage est volontaire :
 *
 *   node fb-backlog/traiter.js candidats --tir A --n 8   → JSON des commentaires à traiter
 *   node fb-backlog/traiter.js publier reponses.json     → publie, vérifie, enregistre
 *   node fb-backlog/traiter.js image <url> [fichier]     → télécharge une pièce jointe
 *   node fb-backlog/traiter.js etat                      → où en est chaque tir
 *
 * Pourquoi un script plutôt que des instructions à une session : une session
 * lancée par une Routine n'a ni connecteur MCP, ni droit d'émettre des requêtes
 * HTTP arbitraires. Elle a le droit de lancer `node connectors_client.js`, et
 * donc ce script. C'est la seule surface qui tient sans surveillance.
 *
 * Accès Facebook : par le General Proxy (connecteur `facebook`), qui dérive les
 * jetons de Page côté serveur. Aucun jeton ne transite ici.
 *
 * CADENCE — 24 h sur 24, mais pondérée
 * Le traitement ne s'arrête jamais, pour que les commentaires du jour soient
 * pris vite. Mais l'intensité suit une journée humaine : forte l'après-midi,
 * molle le soir, presque nulle la nuit. Un débit plat sur 24 heures serait une
 * signature aussi nette qu'une cadence régulière.
 *
 * PRIORITÉ — dynamique, jamais un quota fixe
 * Les commentaires du JOUR passent avant tout et sont traités en entier. Le
 * backlog prend ensuite TOUT ce qui reste de capacité, sans plafond : une
 * journée calme bascule d'elle-même à 100 % de backlog. Dans le backlog, les
 * questions à intention d'achat passent devant.
 */

const fs = require("node:fs");
const path = require("node:path");

const URL = process.env.GENERAL_PROXY_URL || "https://general-proxy-5muf.onrender.com";
const SECRET = process.env.GENERAL_PROXY_SECRET || process.env.PROXY_SECRET;
const RACINE = __dirname;
const ETAT = path.join(RACINE, "etat");

const TIRS = {
  A: { pages: ["104242204750257", "114311920399404"], nom: "Lasclay + Asclépiade" },
  B: { pages: ["368305119707866"], nom: "The Milkweed Company" },
  C: { pages: ["262382158951470"], nom: "Milkweed & Monarchs" },
};
const REGISTRE = {
  104242204750257: "sobre",
  368305119707866: "sobre",
  262382158951470: "chaleureux",
  114311920399404: "chaleureux",
};
const NOMS = {
  104242204750257: "Lasclay",
  368305119707866: "Lasclay: The Milkweed Company",
  262382158951470: "Milkweed & Monarchs",
  114311920399404: "Asclépiade & papillons monarques",
};

// ---- Appel du proxy -------------------------------------------------------

async function proxy(action, params) {
  const res = await fetch(`${URL}/facebook/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET || "" },
    body: JSON.stringify(params || {}),
  });
  const texte = await res.text();
  let j;
  try { j = JSON.parse(texte); } catch { j = { raw: texte }; }
  if (!res.ok) throw new Error(`facebook/${action} → ${res.status} ${texte.slice(0, 400)}`);
  return j.data !== undefined ? j.data : j;
}

// Erreurs qui imposent l'arrêt immédiat, sans réessai : limite de débit Meta,
// code 368 (comportement jugé abusif), toute erreur de permission. Réessayer
// aggrave le dossier auprès de Meta au lieu de le régler.
function estFatale(msg) {
  return /rate limit|#4\b|#17\b|#32\b|#368|\(#10\)|\(#200\)|OAuthException|temporarily blocked/i.test(msg);
}

// ---- État -----------------------------------------------------------------

const lire = (f, defaut) => {
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return defaut; }
};
// Écriture atomique : un tir interrompu ne doit jamais laisser un état tronqué,
// sinon le tir suivant reprend une liste corrompue et republie.
const ecrire = (f, obj) => {
  const tmp = `${f}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n");
  fs.renameSync(tmp, f);
};
const fRepondus = (t) => path.join(ETAT, `${t}-repondus.json`);
const fARevoir = (t) => path.join(ETAT, `${t}-a-revoir.json`);
const fJournal = (t) => path.join(ETAT, `${t}-journal.jsonl`);

const repondus = (t) => lire(fRepondus(t), { tir: t, repondus: [], total: 0 });
const idsRepondus = (t) => new Set(repondus(t).repondus.map((r) => (typeof r === "string" ? r : r.id)));

// Un commentaire écarté par jugement (`<tir>-a-revoir.json`) revenait dans les
// candidats à chaque tir. Comme les plaintes de commande sont notées haut par
// l'intention d'achat, elles passaient devant les commentaires du jour encore
// sans réponse et vidaient le lot sans qu'une seule réponse soit publiée. Les
// candidats excluent donc aussi les écartés. C'est par tir : le jugement d'un
// ouvrier n'engage pas les autres. Une reprise reste possible — retirer
// l'entrée du fichier suffit, et `publier` ne consulte pas cette liste.
const idsARevoir = (t) =>
  new Set((lire(fARevoir(t), { a_revoir: [] }).a_revoir || []).map((e) => (typeof e === "string" ? e : e.id)));
const idsExclus = (t) => new Set([...idsRepondus(t), ...idsARevoir(t)]);

// Plafond par Page et par jour. Le tirage horaire ne connaît pas l'historique de
// la journée : une série de tirages hauts pourrait concentrer beaucoup de
// réponses sur une seule Page. Ce plafond est la seule chose qui regarde le
// cumul du jour, et c'est le garde-fou qui compte vraiment à haut débit.
const PLAFOND_PAGE_JOUR = Number(process.env.FB_PLAFOND_PAGE_JOUR || 110);

function publieesAujourdhui(tir) {
  const jour = aujourdhui();
  const parPage = {};
  for (const r of repondus(tir).repondus || []) {
    if ((r.quand || "").slice(0, 10) !== jour) continue;
    parPage[r.page_id] = (parPage[r.page_id] || 0) + 1;
  }
  return parPage;
}

// Retire du lot les Pages qui ont atteint leur plafond du jour.
function filtrerPlafond(lot, tir) {
  const deja = publieesAujourdhui(tir);
  const compte = { ...deja };
  const garde = [];
  const bloquees = new Set();
  for (const c of lot) {
    const pid = c._page_id || c.page_id;
    if ((compte[pid] || 0) >= PLAFOND_PAGE_JOUR) { bloquees.add(pid); continue; }
    compte[pid] = (compte[pid] || 0) + 1;
    garde.push(c);
  }
  return { garde, bloquees: [...bloquees], deja };
}

// ---- Sélection ------------------------------------------------------------

const norm = (s) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’ʼ]/g, "'").toLowerCase();

// La date du jour EN HEURE DE L'EST. En UTC, la journée bascule à 19 h ou 20 h
// heure locale : « les commentaires du jour » aurait changé de sens en pleine
// soirée, au moment précis où le fil est le plus actif.
const aujourdhui = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montreal",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

// Deux sortes de candidats, et c'est délibéré.
//
//   « question » — porte un point d'interrogation. Appelle une réponse utile.
//   « récit »    — quelqu'un raconte son expérience : ses cocons, ses semis,
//                  son plant qui a disparu. Pas de question, mais une présence
//                  qui mérite qu'on lui réponde.
//
// N'exiger que les questions était une erreur : sur les fils vivants, sept
// commentaires récents sur huit sont des récits. Les ignorer donnait une Page
// qui ne répond jamais à ce qui vient d'être écrit.
//
// Les filtres restent structurels. Le jugement éditorial — plainte de commande,
// diatribe, réponse entre abonnés, hors sujet — reste à Claude.
function typeDe(c) {
  const m = (c.message || "").trim();
  if (m.includes("?")) return "question";
  if (!m && c.attachment) return "photo";
  return "récit";
}

function eligible(c, dejaVus) {
  if (!c || !c.id || dejaVus.has(c.id)) return false;
  if (c.is_hidden) return false;
  if (c.comment_count && c.comment_count > 0) return false;
  if (c.from && NOMS[c.from.id]) return false; // écrit par la Page elle-même

  // Un commentaire situé dans un sous-fil n'est PAS rejeté d'office. Sur un fil
  // vivant il représente 39 % du volume, et beaucoup de ces messages posent une
  // vraie question ou s'adressent en fait à la marque. Il est transmis avec son
  // contexte (`adresse`, `repond_a`) et c'est le jugement qui tranche.
  const m = (c.message || "").trim();

  // Un commentaire sans texte mais avec une image n'est pas vide : quelqu'un
  // montre sa chenille ou son plant. C'est souvent le plus enthousiaste.
  if (!m) return !!c.attachment;

  if (m.length < 8) return false;
  // Un récit doit avoir un minimum de substance, mais le plancher était trop
  // haut : « I have my seeds ready & waiting!! » en fait 36 et méritait un mot.
  if (!m.includes("?") && m.length < 15) return false;
  return true;
}

// À qui ce commentaire s'adresse-t-il ? Sert au jugement, pas au filtrage.
function adresseDe(c) {
  const par = c.parent;
  if (!par) return "la Page";
  const pid = ((par.from || {}).id) || null;
  return NOMS[pid] ? "la Page (réponse à notre commentaire)" : "un autre abonné";
}

// Au-delà de cet âge, on arrête de remonter un fil : les commentaires plus vieux
// sont du backlog profond, et le but ici est de ne jamais rater les récents.
const HORIZON_JOURS = Number(process.env.FB_HORIZON_JOURS || 120);

async function moissonner(pages) {
  const out = [];
  const limiteAge = Date.now() - HORIZON_JOURS * 86400000;
  for (const pid of pages) {
    const limite = pid === "104242204750257" ? 25 : 50;
    let posts = [];
    const r = await proxy("posts", { page_id: pid, limit: limite });
    posts = (r && r.data) || [];
    for (const po of posts) {
      let cs = [];
      try {
        // `order: reverse_chronological` est ESSENTIEL. Le défaut de Graph est
        // chronologique ascendant : sur un fil de 2 500 commentaires, paginer
        // depuis le début ne rend que ceux du jour de la publication, et les
        // commentaires récents ne sont jamais atteints. C'est le défaut qui a
        // rendu la règle des 70 % inopérante pendant ses premiers tirs.
        const rc = await proxy("comments", {
          page_id: pid,
          object_id: po.id,
          limit: 100,
          order: "reverse_chronological",
        });
        cs = (rc && rc.data) || [];
        // Les plus récents d'abord : dès qu'on franchit l'horizon, inutile de
        // continuer à remonter ce fil.
        cs = cs.filter((c) => new Date(c.created_time || 0).getTime() >= limiteAge);
      } catch (e) {
        if (estFatale(e.message)) throw e;
        continue; // une publication illisible ne doit pas faire tomber le tir
      }
      for (const c of cs) {
        c._page_id = pid;
        c._page = NOMS[pid];
        c._registre = REGISTRE[pid];
        c._type = typeDe(c);
        c._adresse = adresseDe(c);
        c._repond_a = c.parent
          ? { auteur: ((c.parent.from || {}).name) || null, extrait: (c.parent.message || "").slice(0, 200) }
          : null;
        c._image = ((((c.attachment || {}).media || {}).image || {}).src) || null;
        c._post = po.id;
        c._post_url = po.permalink_url;
        out.push(c);
      }
    }
  }
  return out;
}

// Signaux d'intention d'achat. Une question qui peut mener à une commande vaut
// plus qu'une curiosité générale : on la traite en premier dans le backlog.
// Frontières de mot obligatoires — sans elles, « cat » se trouve dans
// « scatter » et « prix » dans « caprix ». Cette erreur a déjà été commise.
const SIGNAUX = [
  // acheter, commander
  [3, /\b(buy|purchase|order|ordering|checkout|cart)\b/i],
  [3, /\b(acheter|commander|commande|panier)\b/i],
  // où se procurer
  [3, /\b(where can i|where do i|where to|how do i get|link to)\b/i],
  [3, /\b(où (puis-je|est-ce|acheter|trouver)|comment commander)\b/i],
  // disponibilité, rupture
  [2, /\b(available|availability|in stock|sold out|restock|back in stock)\b/i],
  [2, /\b(disponible|disponibilité|en stock|rupture|réappro)\b/i],
  // livraison, expédition, pays
  [2, /\b(ship|shipping|shipped|deliver|delivery|customs|duty)\b/i],
  [2, /\b(livraison|livrer|expédi\w*|douane)\b/i],
  // prix, coût
  [2, /\b(price|cost|how much|expensive|discount|coupon)\b/i],
  [2, /\b(prix|coût|combien|rabais|promo)\b/i],
  // choix de produit ou d'espèce, préachat
  [2, /\b(which (one|kind|variety|species)|what (kind|variety) should|recommend)\b/i],
  [2, /\b(quelle (espèce|variété)|lequel|laquelle|recommand\w*)\b/i],
  // le site, la boutique
  [1, /\b(website|web site|store|shop|online)\b/i],
  [1, /\b(site web|boutique|en ligne)\b/i],
];

function intentionAchat(c) {
  const m = c.message || "";
  let score = 0;
  for (const [poids, re] of SIGNAUX) if (re.test(m)) score += poids;
  // Une question porte plus loin qu'un récit : on peut y répondre utilement.
  if (m.includes("?")) score += 1;
  return score;
}

// La priorité est DYNAMIQUE, pas un quota fixe.
//
// Le jour d'abord, toujours, et en entier. Ensuite le backlog prend TOUT ce qui
// reste de capacité — il n'est jamais bridé par une proportion. C'est la
// correction d'un vrai défaut : plafonner le backlog à 3/7 du jour faisait que
// deux commentaires du jour donnaient un lot de deux, et le tir s'arrêtait là.
// Les 70 % sont un plancher de priorité pour le jour, pas un frein sur le reste.
//
// Dans le backlog, les questions à intention d'achat passent devant : quelqu'un
// qui demande où commander ou si vous livrez chez lui attend une réponse qui
// compte, et l'absence de réponse se paie.
function repartir(candidats, n) {
  const jour = aujourdhui();
  const duJour = candidats.filter((c) => (c.created_time || "").slice(0, 10) === jour);
  const anciens = candidats.filter((c) => (c.created_time || "").slice(0, 10) !== jour);

  const prisJour = duJour.slice(0, n);
  const reste = n - prisJour.length;

  // Backlog trié par intention d'achat, puis par fraîcheur. Un peu de hasard
  // entre ex æquo pour ne pas re-présenter éternellement le même ordre.
  const triés = melanger(anciens).sort((a, b) => {
    const d = intentionAchat(b) - intentionAchat(a);
    if (d !== 0) return d;
    return String(b.created_time || "").localeCompare(String(a.created_time || ""));
  });
  const prisAnciens = triés.slice(0, Math.max(0, reste));

  const total = prisJour.length + prisAnciens.length;
  const part = total ? Math.round((100 * prisJour.length) / total) : 0;
  const regle =
    prisJour.length === 0
      ? `aucun commentaire du jour — ${prisAnciens.length} du backlog, priorité à l'intention d'achat`
      : `${prisJour.length} du jour (${part} %) + ${prisAnciens.length} du backlog, priorité à l'intention d'achat`;

  return { duJour: prisJour, anciens: prisAnciens, regle };
}

function melanger(a) {
  const t = a.slice();
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

// ---- Cadence --------------------------------------------------------------

const expo = (moyenne) => -Math.log(1 - Math.random()) * moyenne;
const borne = (v, min, max) => Math.max(min, Math.min(max, v));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// L'heure de l'Est, calculée ici plutôt que dans le cron. Conséquence utile :
// le passage à l'heure normale en novembre ne demande plus rien — le cron tire
// toutes les heures en UTC, et c'est le script qui sait quelle heure locale il est.
function heureEst() {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Montreal",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  ) % 24;
}

// Le traitement tourne 24 h sur 24, mais PAS à plat. Un profil plat est une
// signature en soi : aucune personne ne répond autant à 4 h du matin qu'à 14 h,
// et c'est visible autant pour les modèles comportementaux de Meta que pour les
// abonnés. L'intensité suit donc une journée humaine — forte l'après-midi,
// molle le soir, presque nulle au cœur de la nuit sans jamais être exactement
// nulle, parce qu'un zéro quotidien à heure fixe est lui aussi un motif.
const INTENSITE = [
  0.15, 0.10, 0.05, 0.05, 0.05, 0.08, // 0 h – 5 h
  0.15, 0.35, 0.60, 1.00, 1.00, 0.95, // 6 h – 11 h
  0.45, 0.95, 1.00, 1.00, 0.95, 0.90, // 12 h – 17 h (creux du midi, atténué et non plus à zéro)
  0.75, 0.70, 0.65, 0.50, 0.35, 0.25, // 18 h – 23 h
];

// Combien ce tir publie, et s'il publie. Tout est tiré au sort, pondéré par
// l'heure : une cadence régulière se lit comme un automate.
function tirage() {
  const h = heureEst();
  const i = INTENSITE[h];
  const weekend = [0, 6].includes(new Date().getDay());
  const proba = i * 0.85 * (weekend ? 0.7 : 1);
  if (Math.random() > proba) {
    return { saute: true, motif: `heure ${h} h (Est), intensité ${i}${weekend ? ", week-end" : ""}` };
  }
  const n = borne(1 + Math.floor(expo(14 * i)), 1, 20);
  return { saute: false, n, heure: h, intensite: i, attenteInitiale: Math.round(45 + Math.random() * 375) };
}

// ---- Commandes ------------------------------------------------------------

async function cmdCandidats(tir, nDemande) {
  const conf = TIRS[tir];
  if (!conf) throw new Error(`tir inconnu : ${tir} (A, B ou C)`);
  const t = tirage();
  if (t.saute && !nDemande) {
    console.log(JSON.stringify({ tir, saute: true, motif: t.motif, candidats: [] }, null, 2));
    return;
  }
  const n = nDemande || t.n;
  const vus = idsExclus(tir);
  const bruts = await moissonner(conf.pages);
  const candidats = bruts.filter((c) => eligible(c, vus));
  const { duJour, anciens, regle } = repartir(candidats, n);
  const lotBrut = [...duJour.map((c) => ({ ...c, _origine: "jour" })), ...anciens.map((c) => ({ ...c, _origine: "backlog" }))];
  const { garde: lot, bloquees, deja } = filtrerPlafond(lotBrut, tir);

  console.log(JSON.stringify({
    tir,
    pages: conf.nom,
    heure_est: t.heure !== undefined ? t.heure : heureEst(),
    intensite: t.intensite !== undefined ? t.intensite : INTENSITE[heureEst()],
    n_vise: n,
    attente_initiale_s: t.attenteInitiale || 60,
    regle_priorite: regle,
    plafond_page_jour: PLAFOND_PAGE_JOUR,
    deja_publiees_aujourdhui: deja,
    pages_au_plafond: bloquees,
    total_candidats: candidats.length,
    dont_questions: candidats.filter((c) => c._type === "question").length,
    dont_recits: candidats.filter((c) => c._type === "récit").length,
    dont_photos: candidats.filter((c) => c._type === "photo").length,
    dont_sous_fil: candidats.filter((c) => c._adresse === "un autre abonné").length,
    horizon_jours: HORIZON_JOURS,
    candidats_du_jour: candidats.filter((c) => (c.created_time || "").slice(0, 10) === aujourdhui()).length,
    lot: lot.map((c) => ({
      id: c.id,
      page_id: c._page_id,
      page: c._page,
      registre: c._registre,
      origine: c._origine,
      type: c._type,
      adresse: c._adresse,
      intention_achat: intentionAchat(c),
      repond_a: c._repond_a,
      image: c._image,
      date: c.created_time,
      auteur: (c.from && c.from.name) || null,
      message: c.message,
      lien: c.permalink_url || c._post_url,
    })),
  }, null, 2));
}

// Attend `publier` un fichier JSON : [{ id, page_id, message }]
// Publie une réponse à la fois, à intervalles irréguliers, vérifie chacune
// auprès de Meta, et enregistre au fur et à mesure — pas à la fin. Un tir
// interrompu laisse un état juste.
async function cmdPublier(fichier, tir) {
  const lot = JSON.parse(fs.readFileSync(fichier, "utf8"));
  if (!Array.isArray(lot) || !lot.length) throw new Error("fichier vide ou mal formé");
  const vus = idsRepondus(tir);
  const etat = repondus(tir);
  let publiees = 0;
  const ecarts = [];

  for (let i = 0; i < lot.length; i++) {
    const r = lot[i];
    if (!r.id || !r.page_id || !r.message) throw new Error(`entrée ${i} incomplète (id, page_id, message requis)`);
    if (vus.has(r.id)) { console.error(`(déjà répondu, ignoré) ${r.id}`); continue; }
    const compteJour = publieesAujourdhui(tir);
    if ((compteJour[r.page_id] || 0) >= PLAFOND_PAGE_JOUR) {
      console.error(`(plafond du jour atteint pour la Page ${r.page_id}, ignoré) ${r.id}`);
      continue;
    }

    if (i > 0) {
      const ecart = Math.round(borne(expo(180), 60, 600));
      ecarts.push(ecart);
      await dormir(ecart * 1000);
    }

    let rep;
    try {
      rep = await proxy("reply", { page_id: r.page_id, comment_id: r.id, message: r.message });
    } catch (e) {
      if (estFatale(e.message)) {
        console.error(`ARRÊT D'URGENCE après ${publiees} publication(s) : ${e.message}`);
        ecrire(fRepondus(tir), etat);
        process.exit(2);
      }
      console.error(`échec non fatal sur ${r.id} : ${e.message}`);
      continue;
    }

    // Vérification : la réponse existe-t-elle vraiment chez Meta ?
    let confirme = false;
    try {
      const v = await proxy("comment", { page_id: r.page_id, comment_id: rep.id });
      confirme = !!(v && v.id);
    } catch { confirme = false; }

    vus.add(r.id);
    etat.repondus.push({
      id: r.id,
      reponse_id: rep.id,
      page_id: r.page_id,
      quand: new Date().toISOString(),
      confirme,
      texte: r.message,
    });
    etat.total = etat.repondus.length;
    etat.derniere_execution = new Date().toISOString();
    ecrire(fRepondus(tir), etat);
    fs.appendFileSync(fJournal(tir), JSON.stringify({ t: new Date().toISOString(), id: r.id, reponse: rep.id, confirme }) + "\n");
    publiees++;
    console.error(`${publiees}/${lot.length} publié ${r.id} → ${rep.id}${confirme ? "" : " (NON CONFIRMÉ)"}`);
  }

  console.log(JSON.stringify({ tir, publiees, ecarts_s: ecarts, total_cumule: etat.total }, null, 2));
}

// Télécharge l'image d'un commentaire dans /tmp pour que la session puisse
// l'ouvrir avec Read et voir réellement ce qu'elle contient. Une session ne peut
// pas émettre de requête HTTP arbitraire ; elle peut lancer ce script.
async function cmdImage(url, sortie) {
  if (!url) throw new Error("usage : image <url> [fichier de sortie]");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`téléchargement → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dossier = "/tmp/fb-images";
  fs.mkdirSync(dossier, { recursive: true });
  const nom = sortie || path.join(dossier, `img-${Date.now()}.jpg`);
  fs.writeFileSync(nom, buf);
  console.log(JSON.stringify({ fichier: nom, octets: buf.length }, null, 2));
}

function cmdEtat() {
  const out = {};
  for (const t of Object.keys(TIRS)) {
    const e = repondus(t);
    const jour = aujourdhui();
    out[t] = {
      pages: TIRS[t].nom,
      total: e.total || 0,
      aujourd_hui: (e.repondus || []).filter((r) => (r.quand || "").slice(0, 10) === jour).length,
      non_confirmees: (e.repondus || []).filter((r) => r.confirme === false).length,
      derniere_execution: e.derniere_execution || null,
      a_revoir: (lire(fARevoir(t), { a_revoir: [] }).a_revoir || []).length,
    };
  }
  console.log(JSON.stringify(out, null, 2));
}

// ---- Entrée ---------------------------------------------------------------

(async () => {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const opt = (nom, defaut) => {
    const i = args.indexOf(`--${nom}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : defaut;
  };
  try {
    if (!SECRET) throw new Error("GENERAL_PROXY_SECRET manquant");
    if (cmd === "candidats") return await cmdCandidats(opt("tir", "A"), Number(opt("n", 0)) || 0);
    if (cmd === "publier") {
      const f = args[1];
      if (!f || f.startsWith("--")) throw new Error("usage : publier <fichier.json> --tir A");
      return await cmdPublier(f, opt("tir", "A"));
    }
    if (cmd === "image") return await cmdImage(args[1], args[2]);
    if (cmd === "etat") return cmdEtat();
    console.error(
      "Commandes : candidats --tir A --n 8 | publier <fichier.json> --tir A | image <url> [fichier] | etat"
    );
    process.exit(1);
  } catch (e) {
    console.error("Erreur:", e.message);
    process.exit(1);
  }
})();
