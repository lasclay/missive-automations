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
 * PRIORITÉ — la règle du 70 %
 * Les commentaires du JOUR passent avant tout et sont traités en entier. Le
 * reste du lot va au vieux backlog, plafonné pour que le jour garde au moins
 * 70 % du lot. Exception explicite : si aucun commentaire n'est arrivé
 * aujourd'hui, tout le lot va au backlog — sinon une journée calme ne ferait
 * rien avancer.
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
function typeDe(m) {
  return m.includes("?") ? "question" : "récit";
}

function eligible(c, dejaVus) {
  if (!c || !c.id || dejaVus.has(c.id)) return false;
  if (c.is_hidden) return false;
  if (c.comment_count && c.comment_count > 0) return false;
  if (c.from && NOMS[c.from.id]) return false; // écrit par la Page elle-même
  const m = (c.message || "").trim();
  if (m.length < 13) return false;
  // Un récit doit avoir un peu de substance : « Beautiful! » n'appelle rien.
  if (!m.includes("?") && m.length < 40) return false;
  // « Prénom Nom …» en tête : ce sont des réponses entre abonnés, pas des messages à la marque.
  if (/^[A-ZÀ-Ý][\p{L}'-]+\s+[A-ZÀ-Ý]/u.test(m)) return false;
  return true;
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
        c._type = typeDe(c.message || "");
        c._post = po.id;
        c._post_url = po.permalink_url;
        out.push(c);
      }
    }
  }
  return out;
}

// La règle du 70 % : le jour d'abord, en entier ; le backlog ne prend que ce
// qui lui reste sans faire descendre le jour sous 70 % du lot.
function repartir(candidats, n) {
  const jour = aujourdhui();
  const duJour = candidats.filter((c) => (c.created_time || "").slice(0, 10) === jour);
  const anciens = candidats.filter((c) => (c.created_time || "").slice(0, 10) !== jour);

  // Journée calme : rien de neuf, tout le lot va au backlog.
  if (duJour.length === 0) {
    return { duJour: [], anciens: melanger(anciens).slice(0, n), regle: "aucun commentaire du jour — lot entier au backlog" };
  }
  const prisJour = duJour.slice(0, n); // le jour d'abord, dans l'ordre d'arrivée
  const plafondAnciens = Math.min(
    Math.floor((prisJour.length * 3) / 7), // garantit jour ≥ 70 % du lot
    n - prisJour.length
  );
  return {
    duJour: prisJour,
    anciens: melanger(anciens).slice(0, Math.max(0, plafondAnciens)),
    regle: `${prisJour.length} du jour + ${Math.max(0, plafondAnciens)} anciens (jour ≥ 70 %)`,
  };
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
  const vus = idsRepondus(tir);
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
    horizon_jours: HORIZON_JOURS,
    candidats_du_jour: candidats.filter((c) => (c.created_time || "").slice(0, 10) === aujourdhui()).length,
    lot: lot.map((c) => ({
      id: c.id,
      page_id: c._page_id,
      page: c._page,
      registre: c._registre,
      origine: c._origine,
      type: c._type,
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
    if (cmd === "etat") return cmdEtat();
    console.error("Commandes : candidats --tir A --n 8 | publier <fichier.json> --tir A | etat");
    process.exit(1);
  } catch (e) {
    console.error("Erreur:", e.message);
    process.exit(1);
  }
})();
