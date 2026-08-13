/**
 * Lasclay — veille/ardoise.js
 * --------------------------------------------------------------------------
 * L'ARDOISE : la mémoire longue du système de veille.
 *
 * Le reste du dépôt produit des RAPPORTS — analyse.js, revision.js, digest.js
 * écrivent un markdown, un humain le lit une fois, et le savoir retombe à zéro
 * au run suivant. L'ardoise fait l'inverse : elle ACCUMULE. Un signal entré
 * une fois y reste, avec sa provenance, sa date et son état. C'est ce qui
 * distingue un système qui se souvient d'un système qui recommence.
 *
 * Trois propriétés tenues ici, et nulle part ailleurs :
 *
 *   1. IDEMPOTENCE — un même signal réingéré ne crée pas de doublon. La clé est
 *      un hachage stable (source + référence + type + début du texte). On peut
 *      donc relancer une collecte sans précaution, ce qui est la condition pour
 *      qu'elle tourne en tâche planifiée sans surveillance.
 *
 *   2. CURSEURS — chaque flux retient jusqu'où il a lu. Une collecte ne repasse
 *      pas sur l'histoire entière : elle reprend où elle s'était arrêtée. Sans
 *      ça, le coût de la veille croît avec l'âge de l'entreprise et le système
 *      finit par être trop cher pour tourner souvent.
 *
 *   3. ÉTAT DE RATIFICATION — un signal naît `neuf`. Un humain le passe à
 *      `ratifie` (c'est vrai, on en tient compte) ou `rejete` (bruit). Cet état
 *      est lui-même de la donnée : c'est ce qui permet de mesurer plus tard si
 *      le pré-tri s'améliore. Rien ne devient de la connaissance de marque sans
 *      ce passage — le système propose, l'humain ratifie.
 *
 * DONNÉES CLIENTES. L'ardoise contient du verbatim client. Elle n'est PAS
 * versionnée (voir .gitignore) et le texte est pseudonymisé à l'entrée :
 * prénom + initiale, courriels et téléphones retirés. Les numéros de commande
 * sont conservés — ils servent au recoupement et vivent déjà partout ailleurs.
 *
 * Node 18+. Aucune dépendance.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const RACINE = __dirname;
const ARDOISE = process.env.VEILLE_ARDOISE || path.join(RACINE, "ardoise.jsonl");
const ETAT = process.env.VEILLE_ETAT || path.join(RACINE, "etat.json");

const ETATS = ["neuf", "ratifie", "rejete", "traite"];

// --- Pseudonymisation ------------------------------------------------------
// Appliquée à TOUT texte qui entre. Volontairement prudente : mieux vaut
// retirer un mot de trop qu'écrire une adresse dans un fichier de travail.

function pseudonymise(texte) {
  if (!texte) return "";
  return String(texte)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[courriel]")
    .replace(/\+?\d{1,2}[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[téléphone]")
    .replace(/https?:\/\/\S{40,}/g, "[lien]")
    .trim();
}

// « Isabelle Brosseau » → « Isabelle B. » ; une adresse seule → « (inconnu) ».
function initiale(nom) {
  if (!nom) return "(inconnu)";
  const propre = String(nom).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "").trim();
  if (!propre) return "(inconnu)";
  const bouts = propre.split(/\s+/).filter(Boolean);
  if (bouts.length === 1) return bouts[0];
  return `${bouts[0]} ${bouts[bouts.length - 1][0].toUpperCase()}.`;
}

// --- Clé de déduplication --------------------------------------------------
// Le début du texte entre dans la clé : deux signaux différents tirés du même
// fil (une idée produit ET un défaut, par exemple) restent deux signaux.

function cle(signal) {
  const graine = [
    signal.source || "",
    signal.ref || "",
    signal.type || "",
    pseudonymise(signal.texte || "").slice(0, 220),
  ].join("|");
  return crypto.createHash("sha1").update(graine).digest("hex").slice(0, 16);
}

// --- Lecture / écriture ----------------------------------------------------

function charger() {
  if (!fs.existsSync(ARDOISE)) return [];
  return fs
    .readFileSync(ARDOISE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    })
    .filter(Boolean);
}

function lireEtat() {
  if (!fs.existsSync(ETAT)) return { curseurs: {}, collectes: [] };
  try { return JSON.parse(fs.readFileSync(ETAT, "utf8")); } catch { return { curseurs: {}, collectes: [] }; }
}

function ecrireEtat(etat) {
  fs.mkdirSync(path.dirname(ETAT), { recursive: true });
  fs.writeFileSync(ETAT, JSON.stringify(etat, null, 2));
}

function curseur(flux) {
  return lireEtat().curseurs[flux] || null;
}

function poserCurseur(flux, valeur) {
  const etat = lireEtat();
  etat.curseurs[flux] = valeur;
  ecrireEtat(etat);
}

/**
 * Ajoute des signaux. Renvoie {ajoutes, doublons}.
 * Normalise, pseudonymise et déduplique — l'appelant n'a rien à faire de tout ça.
 */
function ajouter(signaux, { horodatage } = {}) {
  const existants = new Set(charger().map((s) => s.cle));
  const jour = horodatage || new Date().toISOString().slice(0, 10);
  const lignes = [];
  let doublons = 0;

  for (const brut of signaux) {
    const s = {
      source: brut.source,
      flux: brut.flux || null,
      ref: brut.ref || null,
      date: brut.date || null,
      type: brut.type || "inclassé",
      themes: brut.themes || [],
      produits: brut.produits || [],
      personne: initiale(brut.personne),
      texte: pseudonymise(brut.texte).slice(0, 2000),
      statut: ETATS.includes(brut.statut) ? brut.statut : "neuf",
      vu_le: jour,
    };
    s.cle = cle(s);
    if (existants.has(s.cle)) { doublons++; continue; }
    existants.add(s.cle);
    lignes.push(JSON.stringify(s));
  }

  if (lignes.length) {
    fs.mkdirSync(path.dirname(ARDOISE), { recursive: true });
    fs.appendFileSync(ARDOISE, lignes.join("\n") + "\n");
  }
  return { ajoutes: lignes.length, doublons };
}

/**
 * Change l'état de signaux (ratification humaine). Réécrit l'ardoise en place :
 * c'est le seul geste qui ne soit pas un ajout, et il est volontairement rare.
 */
function statuer(cles, statut) {
  if (!ETATS.includes(statut)) throw new Error(`Statut inconnu: ${statut}`);
  const vise = new Set(cles);
  const tous = charger();
  let touches = 0;
  for (const s of tous) {
    if (vise.has(s.cle) && s.statut !== statut) { s.statut = statut; touches++; }
  }
  fs.writeFileSync(ARDOISE, tous.map((s) => JSON.stringify(s)).join("\n") + "\n");
  return touches;
}

function journaliser(collecte) {
  const etat = lireEtat();
  etat.collectes = (etat.collectes || []).slice(-49);
  etat.collectes.push({ quand: new Date().toISOString(), ...collecte });
  ecrireEtat(etat);
}

module.exports = {
  ARDOISE, ETAT, ETATS,
  pseudonymise, initiale, cle,
  charger, ajouter, statuer,
  lireEtat, ecrireEtat, curseur, poserCurseur, journaliser,
};
