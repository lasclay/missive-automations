/**
 * Lasclay — veille/collecte.js
 * --------------------------------------------------------------------------
 * LES CAPTEURS. Chaque adaptateur lit une source, en tire des signaux et les
 * remet à l'ardoise. Un adaptateur ne décide rien, n'écrit nulle part ailleurs,
 * et ne sait pas ce que les autres font.
 *
 * Deux familles de signaux, volontairement dans la même ardoise :
 *
 *   • le VERBATIM (Missive) — ce que les clients disent. Riche, ambigu, c'est
 *     là que se trouvent les marchés qu'on n'a pas planifiés.
 *   • la MESURE (proxys d'opérations) — ce que les systèmes constatent. Pauvre
 *     en nuance, mais daté et incontestable.
 *
 * Les garder ensemble est le point de tout l'exercice : une vague de « où est
 * ma commande » ne veut rien dire seule, et un arriéré d'expédition non plus.
 * Côte à côte sur la même ligne de temps, l'un explique l'autre. C'est la seule
 * raison pour laquelle ce fichier parle à la fois à Missive et à ShipStation.
 *
 * Chaque adaptateur est INCRÉMENTAL : il lit son curseur, ne traite que le
 * nouveau, repose son curseur. Relancer une collecte deux fois de suite est
 * sans effet — c'est ce qui la rend planifiable sans surveillance.
 *
 * Variables d'environnement :
 *   MISSIVE_PROXY_URL / MISSIVE_PROXY_SECRET   (adaptateur Missive)
 *   GENERAL_PROXY_URL / GENERAL_PROXY_SECRET   (adaptateur ShipStation)
 *
 * Node 18+. Aucune dépendance.
 */

const fs = require("node:fs");
const path = require("node:path");
const ardoise = require("./ardoise");
const pretri = require("./pretri");

const FLUX = path.join(__dirname, "flux.json");

// --- Clients de proxy ------------------------------------------------------

async function missive(route, corps) {
  const url = process.env.MISSIVE_PROXY_URL || "https://proxy-missive.onrender.com";
  const secret = process.env.MISSIVE_PROXY_SECRET || process.env.PROXY_SECRET;
  if (!secret) throw new Error("MISSIVE_PROXY_SECRET absent.");
  const res = await fetch(`${url}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Proxy-Secret": secret },
    body: JSON.stringify(corps || {}),
  });
  const texte = await res.text();
  if (!res.ok) throw new Error(`${route} → ${res.status} ${texte.slice(0, 200)}`);
  return JSON.parse(texte);
}

async function general(connecteur, action, params) {
  const url = process.env.GENERAL_PROXY_URL || "https://general-proxy-5muf.onrender.com";
  const secret = process.env.GENERAL_PROXY_SECRET;
  if (!secret) throw new Error("GENERAL_PROXY_SECRET absent.");
  const res = await fetch(`${url}/${connecteur}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Proxy-Secret": secret },
    body: JSON.stringify(params || {}),
  });
  const texte = await res.text();
  if (!res.ok) throw new Error(`${connecteur}/${action} → ${res.status} ${texte.slice(0, 200)}`);
  return JSON.parse(texte);
}

// --- Nettoyage du verbatim -------------------------------------------------
// Un courriel de réponse traîne la citation du message précédent, la signature,
// et le corps de l'infolettre à laquelle il répond. Sans cette coupe, le
// pré-tri classe l'infolettre de Lasclay au lieu du propos du client.

const COUPURES = [
  /\n\s*On \w+ \d+, \d{4},? at/i,
  /\n\s*On \w{3}, \w{3} \d+, \d{4}/i,
  /\n\s*Le \d+ \w+\.? \d{4}/i,
  /\n\s*Le (?:lun|mar|mer|jeu|ven|sam|dim)\b/i,
  /\n\s*De\s*:\s*Lasclay/i,
  /\n\s*From:\s*Lasclay/i,
  /\n\s*-{2,}\s*\n/,
  /\n\s*_{2,}\s*\n/,
  /\n>\s/,
  /\n\s*Envoyé de mon /i,
  /\n\s*Sent from my /i,
  /\n\s*Obtenir Outlook pour /i,
  /\n\s*Téléchargez Outlook pour /i,
];

// Les notifications d'avis (Judge.me) arrivent enveloppées dans un gabarit :
// « X a écrit l'avis N étoile(s) suivant pour le produit P : … » puis un pavé
// sur le badge « acheteur vérifié ». Sans cette coupe, le pré-tri classe le
// gabarit au lieu de l'avis, et tous les avis se ressemblent.
const GABARIT_AVIS = [
  /Nous ajouterons le badge[\s\S]*$/i,
  /Ceci est un avis web[\s\S]*$/i,
  /Pour mod[ée]rer cet avis[\s\S]*$/i,
];

function nettoie(texte) {
  if (!texte) return "";
  let s = String(texte).replace(/\r/g, "");
  for (const c of COUPURES) {
    const m = s.match(c);
    if (m && m.index > 40) s = s.slice(0, m.index);
  }
  for (const g of GABARIT_AVIS) s = s.replace(g, "");
  return s
    .replace(/[͏­​]+/g, "")   // caractères de bourrage des infolettres
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function lireFlux() {
  if (!fs.existsSync(FLUX)) throw new Error(`Configuration absente : ${FLUX}`);
  return JSON.parse(fs.readFileSync(FLUX, "utf8"));
}

// --- Adaptateur : conversations Missive ------------------------------------

/**
 * Lit les étiquettes déclarées dans flux.json et en tire un signal par fil,
 * à partir des messages ENTRANTS seulement (ce que le client dit, pas ce
 * qu'on lui répond).
 */
async function collecteMissive({ limite = 0, journal = () => {}, deposer } = {}) {
  const conf = lireFlux();
  const signaux = [];
  const curseursNeufs = {};

  for (const flux of conf.missive.filter((f) => f.actif !== false)) {
    const nomFlux = `missive:${flux.nom}`;
    const depuis = ardoise.curseur(nomFlux) || 0;

    let fils;
    try {
      const r = await missive("/list", { filter: `shared_label=${flux.etiquette}` });
      fils = r.conversations || [];
    } catch (e) {
      journal(`  ${flux.nom} — ÉCHEC (${e.message.slice(0, 80)})`);
      continue;
    }

    const neufs = fils.filter((c) => (c.last_activity_at || 0) > depuis);
    const aTraiter = limite ? neufs.slice(0, limite) : neufs;
    journal(`  ${flux.nom} — ${fils.length} fils, ${neufs.length} nouveaux depuis le curseur`);
    if (!aTraiter.length) continue;

    const duFlux = [];
    let plusHaut = depuis;
    for (const c of aTraiter) {
      let msgs;
      try {
        msgs = (await missive("/conversation", { id: c.id })).messages || [];
      } catch { continue; }

      const entrants = msgs.filter((m) => !m.us);
      if (!entrants.length) continue;

      const texte = entrants.map((m) => nettoie(m.text)).filter((t) => t.length > 25).join("\n---\n");
      if (!texte) continue;

      const { type, themes, produits } = pretri.classe(texte);
      duFlux.push({
        source: "missive",
        flux: flux.nom,
        ref: c.id,
        date: entrants[entrants.length - 1].date || null,
        type,
        themes,
        produits,
        personne: entrants[0].from,
        texte,
      });
      plusHaut = Math.max(plusHaut, c.last_activity_at || 0);
    }

    // Le curseur n'avance que si tout le lot a été traité : une collecte
    // écourtée par `limite` doit pouvoir reprendre là où elle s'est arrêtée.
    const complet = !limite || aTraiter.length === neufs.length;

    // Dépôt À CHAQUE FLUX, pas à la fin. Le premier passage lit des centaines
    // de fils sur une vingtaine de minutes : tout garder en mémoire jusqu'au
    // bout signifierait qu'une coupure de réseau au dernier flux jette le
    // travail des quinze précédents. Écrire tôt et souvent ne coûte rien —
    // la déduplication de l'ardoise rend chaque dépôt sans risque.
    if (deposer && duFlux.length) deposer(duFlux, complet ? { [nomFlux]: plusHaut } : {});
    else {
      signaux.push(...duFlux);
      if (complet) curseursNeufs[nomFlux] = plusHaut;
    }
  }

  return { signaux, curseurs: curseursNeufs };
}

// --- Adaptateur : mesures d'opérations (ShipStation) -----------------------

/**
 * Une mesure par run : l'arriéré de commandes payées non expédiées, et l'âge
 * de la plus vieille. C'est le meilleur prédicteur connu de la catégorie de
 * support la plus volumineuse (« où est ma commande », 3728 fils sur deux ans).
 * Un signal par jour, pas un par commande : l'ardoise garde une série, pas un
 * déversoir.
 */
async function collecteOperations({ journal = () => {} } = {}) {
  const jour = new Date().toISOString().slice(0, 10);
  const nomFlux = "shipstation:arriere";
  if (ardoise.curseur(nomFlux) === jour) {
    journal("  shipstation:arriere — déjà mesuré aujourd'hui");
    return { signaux: [], curseurs: {} };
  }

  let commandes;
  try {
    const r = await general("shipstation", "orders", { orderStatus: "awaiting_shipment", pageSize: 500 });
    commandes = r.orders || r.data?.orders || [];
  } catch (e) {
    journal(`  shipstation:arriere — ÉCHEC (${e.message.slice(0, 80)})`);
    return { signaux: [], curseurs: {} };
  }

  const maintenant = Date.now();
  const ages = commandes
    .map((o) => o.orderDate && (maintenant - new Date(o.orderDate).getTime()) / 86400000)
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => b - a);

  const vieux = ages.filter((a) => a > 7).length;
  const texte =
    `Arriéré d'expédition : ${commandes.length} commandes payées en attente, ` +
    `dont ${vieux} de plus de 7 jours. Plus ancienne : ${Math.round(ages[0] || 0)} jours.`;

  journal(`  shipstation:arriere — ${texte}`);
  return {
    signaux: [{
      source: "shipstation",
      flux: "arriere",
      ref: `arriere-${jour}`,
      date: jour,
      type: "mesure_ops",
      tri: "adaptateur",   // chiffre, pas verbatim : le lexique n'a rien à en dire
      themes: ["operations"],
      produits: [],
      personne: null,
      texte,
    }],
    curseurs: { [nomFlux]: jour },
  };
}

// --- Orchestration ---------------------------------------------------------

/**
 * Dépose un lot dans l'ardoise, PUIS avance les curseurs. Jamais l'inverse :
 * si le processus meurt entre les deux, la collecte suivante repasse sur le
 * même lot et la déduplication absorbe le doublon. Refaire du travail coûte
 * moins cher que d'en perdre.
 */
function deposeur(compteur, journal) {
  return (signaux, curseurs) => {
    const res = ardoise.ajouter(signaux);
    for (const [flux, valeur] of Object.entries(curseurs || {})) ardoise.poserCurseur(flux, valeur);
    compteur.ajoutes += res.ajoutes;
    compteur.doublons += res.doublons;
    if (res.ajoutes || res.doublons) journal(`    → ${res.ajoutes} déposés, ${res.doublons} déjà connus`);
    return res;
  };
}

async function collecte({ limite = 0, sansOps = false, journal = console.log } = {}) {
  const compteur = { ajoutes: 0, doublons: 0 };
  const deposer = deposeur(compteur, journal);

  journal("Collecte — Missive");
  await collecteMissive({ limite, journal, deposer });

  if (!sansOps) {
    journal("Collecte — opérations");
    const o = await collecteOperations({ journal });
    if (o.signaux.length) deposer(o.signaux, o.curseurs);
  }

  ardoise.journaliser(compteur);
  journal(`\n${compteur.ajoutes} signaux ajoutés, ${compteur.doublons} doublons ignorés.`);
  return compteur;
}

module.exports = { collecte, collecteMissive, collecteOperations, nettoie, missive, general };
