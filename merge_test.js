/**
 * Tests des règles de doublon de merge.js (v2.0). Aucune API, aucun réseau :
 * seules les fonctions pures sont chargées (merge.js n'exécute main() que s'il est
 * lancé directement).
 *
 *   node merge_test.js
 *
 * Chaque cas vient d'un faux positif VU EN PRODUCTION ou d'un vrai doublon qu'il ne
 * faut pas perdre. Si tu assouplis un garde-fou, ce fichier dit ce que ça casse.
 */

process.env.MISSIVE_TOKEN = process.env.MISSIVE_TOKEN || "test";
process.env.MISSIVE_SELF_ADDRESSES = process.env.MISSIVE_SELF_ADDRESSES || "hey@lasclay.com";

const {
  isDuplicatePair,
  baseSubject,
  unquoted,
  plainText,
  extractOrders,
} = require("./merge.js");

const J = 86400;
const D = (s) => Math.floor(new Date(`${s}T12:00:00Z`).getTime() / 1000);

// Fabrique une empreinte de fil : dates lisibles, reste par défaut.
const fil = ({ email = "client@exemple.com", orders = [], subjects = [], du, au, blob = null, name = null }) => ({
  email,
  name,
  orders,
  subjects: subjects.map(baseSubject),
  firstAt: D(du),
  lastAt: D(au || du),
  blob,
});

let echecs = 0;
function cas(nom, a, b, attendu) {
  const r = isDuplicatePair(a, b);
  const ok = r.ok === attendu;
  if (!ok) echecs++;
  console.log(`${ok ? "  ok  " : "ÉCHEC "} ${nom}\n         → ${r.ok ? "DOUBLON" : "écarté"} : ${r.why}`);
}
function egal(nom, obtenu, attendu) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs++;
  console.log(`${ok ? "  ok  " : "ÉCHEC "} ${nom}${ok ? "" : `\n         → obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`}`);
}

console.log("\n--- FAUX POSITIFS vus en production (doivent être ÉCARTÉS) ---\n");

// Le cas signalé : un client fidèle, deux commandes à un an d'écart.
cas(
  "client fidèle, commandes à 12 mois d'écart",
  fil({ orders: ["L-31442"], subjects: ["Suivi de votre commande L-31442"], du: "2025-06-17" }),
  fil({ orders: ["L-50778"], subjects: ["Commande L-50778 confirmée"], du: "2026-08-21", au: "2026-08-31" }),
  false
);

// Le blob réel : négo B2B de décembre + invitation Agenda + colis introuvable + flacon cassé.
cas(
  "fil-agrégat (déjà fusionné à tort) : exclu de tout regroupement",
  fil({ email: "audreygt@fokalcollection.com", subjects: ["Huile d'asclépiade"], du: "2025-12-03", au: "2026-08-25", blob: "étendue 265 j > 120" }),
  fil({ email: "audreygt@fokalcollection.com", subjects: ["Nouvelle question"], du: "2026-08-26" }),
  false
);

// Deux réponses à deux infolettres différentes : même adresse, rien d'autre en commun.
cas(
  "réponses à deux infolettres différentes, 2 mois d'écart",
  fil({ subjects: ["Re: Dévoilement - Nouveaux produits d'asclépiade 😮"], du: "2026-06-10" }),
  fil({ subjects: ["Re: 🦋 Prévente automnale - Produits d'asclépiade 🍁"], du: "2026-08-14" }),
  false
);

// Même semaine, mais deux commandes explicitement différentes : deux dossiers.
cas(
  "deux commandes différentes la même semaine",
  fil({ orders: ["L-50778"], subjects: ["Commande L-50778 confirmée"], du: "2026-08-24" }),
  fil({ orders: ["L-50911"], subjects: ["Commande L-50911 confirmée"], du: "2026-08-27" }),
  false
);

// Adresse identique, sujets sans rapport, 7 jours : au-delà de la fenêtre serrée.
cas(
  "même adresse, sujets sans rapport, 7 jours d'écart",
  fil({ subjects: ["Question sur un produit"], du: "2026-08-14" }),
  fil({ subjects: ["Bordereau de retour"], du: "2026-08-21" }),
  false
);

// Un fil qui, à lui seul, s'étale sur des mois n'a rien à fusionner.
cas(
  "fil long de 3 mois + fil neuf qui le chevauche",
  fil({ subjects: ["Collaboration"], du: "2026-05-20", au: "2026-08-25" }),
  fil({ subjects: ["Collaboration"], du: "2026-08-26" }),
  false
);

// Expéditeur système : aucune empreinte, donc rien à relier.
cas(
  "expéditeur système (empreintes vides)",
  fil({ email: null, subjects: [], du: "2026-08-25" }),
  fil({ email: null, subjects: [], du: "2026-08-26" }),
  false
);

console.log("\n--- VRAIS DOUBLONS (doivent être RETENUS) ---\n");

// Le client répond à la vieille notification d'expédition ET écrit un nouveau courriel.
cas(
  "même commande, 2 jours d'écart, sujets différents",
  fil({ orders: ["L-50825"], subjects: ["Une commande L-50825 a été livrée"], du: "2026-08-24" }),
  fil({ orders: ["L-50825"], subjects: ["Colis jamais reçu"], du: "2026-08-26" }),
  true
);

// Le doublon réel trouvé sur 806 fils : deux adresses, un seul numéro de commande.
cas(
  "deux adresses du même client, reliées par le numéro de commande",
  fil({ email: "quelquun@icloud.com", orders: ["L-44108"], subjects: ["Commande L-44108"], du: "2026-08-20" }),
  fil({ email: "quelquun@hotmail.com", orders: ["L-44108"], subjects: ["Cache-cou manquant"], du: "2026-08-23" }),
  true
);

// Le client réécrit le lendemain, sans référence de commande, parce qu'il n'a pas eu de réponse.
cas(
  "même adresse, le lendemain, pas de numéro de commande",
  fil({ subjects: ["Question sur un produit"], du: "2026-08-25" }),
  fil({ subjects: ["Toujours pas de vos nouvelles"], du: "2026-08-26" }),
  true
);

// Même sujet de base, 8 jours : fenêtre large parce que le sujet concorde.
cas(
  "même sujet de base, 8 jours d'écart",
  fil({ subjects: ["Mitaines / Question"], du: "2026-08-14" }),
  fil({ subjects: ["Re: Mitaines / Question"], du: "2026-08-22" }),
  true
);

console.log("\n--- Extraction des numéros de commande et des sujets ---\n");

egal("sujet de base : Re:/Fwd:/emoji/numéro retirés",
  baseSubject("Re: Fwd: 🦋 Commande L-50778 confirmée"), "commande confirmee");
egal("sujets équivalents malgré Re: et Ré:",
  baseSubject("Ré: Une commande est en transit"), baseSubject("Re: une commande est en transit"));

const corpsCite = `Bonjour, je voudrais un bordereau de retour.

Merci,
Stéphanie

On August 22, 2026 at 5:27 AM, Lasclay (hey@lasclay.com) wrote:
  Votre commande L-31442 est partie.`;
egal("le texte cité est coupé", extractOrders(unquoted(corpsCite)), []);
egal("le texte non cité est conservé", unquoted(corpsCite).includes("bordereau de retour"), true);

const html = `<div>Ma commande L-50778 n'est pas arrivée.</div><blockquote>Re: commande L-44108 livrée</blockquote>`;
egal("citation HTML (blockquote) coupée", extractOrders(unquoted(plainText(html))), ["L-50778"]);

const outlook = `Nouvelle question.\n\nDe : Lasclay <hey@lasclay.com>\nEnvoyé : 22 août 2026\nObjet : Commande L-36057`;
egal("en-tête de citation Outlook coupé", extractOrders(unquoted(outlook)), []);

console.log(`\n${echecs === 0 ? "TOUS LES CAS PASSENT" : `${echecs} ÉCHEC(S)`}\n`);
process.exit(echecs === 0 ? 0 : 1);
