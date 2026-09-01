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
  isSelfAddress,
} = require("./merge.js");

const J = 86400;
const D = (s) => Math.floor(new Date(`${s}T12:00:00Z`).getTime() / 1000);

// Fabrique une empreinte de fil : dates lisibles, reste par défaut.
const fil = ({ email = "client@exemple.com", emails = null, orders = [], subjects = [], du, au, blob = null, name = null }) => ({
  email,
  emails: emails || (email ? [email] : []),
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

console.log("\n--- RÈGLE 1 : MÊME ADRESSE = MÊME CLIENT, sans contrainte de temps ---\n");

// La règle de la boîte : réunir vieux et neuf du même client est voulu, pas subi.
cas(
  "client fidèle, deux commandes à 14 mois d'écart",
  fil({ orders: ["L-31442"], subjects: ["Suivi de votre commande L-31442"], du: "2025-06-17" }),
  fil({ orders: ["L-50778"], subjects: ["Commande L-50778 confirmée"], du: "2026-08-21", au: "2026-08-31" }),
  true
);
cas(
  "réponses à deux infolettres différentes, 2 mois d'écart",
  fil({ subjects: ["Re: Dévoilement - Nouveaux produits d'asclépiade 😮"], du: "2026-06-10" }),
  fil({ subjects: ["Re: 🦋 Prévente automnale - Produits d'asclépiade 🍁"], du: "2026-08-14" }),
  true
);
cas(
  "même client, deux commandes différentes la même semaine",
  fil({ orders: ["L-50778"], subjects: ["Commande L-50778 confirmée"], du: "2026-08-24" }),
  fil({ orders: ["L-50911"], subjects: ["Commande L-50911 confirmée"], du: "2026-08-27" }),
  true
);

// Un fil très étendu reste réunissable avec les autres fils de SON client : les plafonds ne
// s'appliquent qu'aux adresses différentes.
cas(
  "fil-agrégat + fil neuf, même adresse",
  fil({ email: "audreygt@fokalcollection.com", subjects: ["Huile d'asclépiade"], du: "2025-12-03", au: "2026-08-25", blob: "trop étendu : 265 j > 120 j" }),
  fil({ email: "audreygt@fokalcollection.com", subjects: ["Nouvelle question"], du: "2026-08-26" }),
  true
);

// L'identité d'un fil est son PREMIER expéditeur externe, pas l'ensemble des adresses qu'il
// contient. Cas réel (L-49227) : un fil où chntlhbrd@ transfère la commande de gc.lavoie@.
// Retenir les deux adresses comme clés soudait les deux clientes, à 444 jours d'écart.
cas(
  "fil contenant l'adresse d'une AUTRE cliente (transfert) : pas un pont",
  fil({ email: "chntlhbrd@gmail.com", orders: ["L-49227"], subjects: ["Commande # L-49227"], du: "2025-02-17", au: "2026-04-29" }),
  fil({ email: "gc.lavoie@hotmail.com", orders: ["L-49227"], subjects: ["Commande L-49227 confirmée"], du: "2026-04-23", au: "2026-05-07" }),
  false
);

// Expéditeur système : aucune empreinte, donc rien à relier.
cas(
  "expéditeur système (empreintes vides)",
  fil({ email: null, subjects: [], du: "2026-08-25" }),
  fil({ email: null, subjects: [], du: "2026-08-26" }),
  false
);

console.log("\n--- RÈGLE 2 : ADRESSES DIFFÉRENTES → il faut prouver le même épisode ---\n");

// Cas réel : deux CLIENTES différentes soudées par une commande transférée.
cas(
  "commande L-42916 citée par deux clientes différentes, 233 j d'écart",
  fil({ email: "martine.gascon@videotron.ca", orders: ["L-42916"], subjects: ["Plainte – absence de réponse"], du: "2026-04-21", au: "2026-08-23" }),
  fil({ email: "far1090@hotmail.com", orders: ["L-42916"], subjects: ["Commande"], du: "2026-01-02", au: "2026-01-09" }),
  false
);

// Adresses différentes, aucun sujet ni commande en commun, 7 j : rien ne prouve le lien.
cas(
  "adresses différentes, sujets sans rapport, 7 jours d'écart",
  fil({ email: "a@exemple.com", name: "jean tremblay", orders: [], subjects: ["Question sur un produit"], du: "2026-08-14" }),
  fil({ email: "b@exemple.com", name: "jean tremblay", orders: [], subjects: ["Bordereau de retour"], du: "2026-08-21" }),
  false
);

// Un fil-agrégat ne se relie plus à un INCONNU par une clé faible.
cas(
  "fil-agrégat + fil d'une autre adresse, reliés par une seule commande",
  fil({ email: "x@exemple.com", orders: ["L-40000"], subjects: ["Dossier"], du: "2025-12-03", au: "2026-08-25", blob: "agrégat : 6 sujets distincts > 4" }),
  fil({ email: "y@exemple.com", orders: ["L-40000"], subjects: ["Autre chose"], du: "2026-08-26" }),
  false
);

console.log("\n--- VRAIS DOUBLONS À ADRESSES DIFFÉRENTES (doivent être RETENUS) ---\n");

// Le client répond à la vieille notification d'expédition ET écrit un nouveau courriel,
// depuis deux adresses : c'est le numéro de commande qui les rattache.
cas(
  "même commande, deux adresses, 2 jours d'écart",
  fil({ email: "c1@exemple.com", orders: ["L-50825"], subjects: ["Une commande L-50825 a été livrée"], du: "2026-08-24" }),
  fil({ email: "c2@exemple.com", orders: ["L-50825"], subjects: ["Colis jamais reçu"], du: "2026-08-26" }),
  true
);

// Le doublon réel trouvé sur 806 fils : deux adresses, un seul numéro de commande.
cas(
  "deux adresses du même client, reliées par le numéro de commande",
  fil({ email: "quelquun@icloud.com", orders: ["L-44108"], subjects: ["Commande L-44108"], du: "2026-08-20" }),
  fil({ email: "quelquun@hotmail.com", orders: ["L-44108"], subjects: ["Cache-cou manquant"], du: "2026-08-23" }),
  true
);

// Cas réel (L-46517) : deux adresses de la même cliente, même sujet, 8 jours. La fenêtre
// large (10 j) s'applique parce que la commande et le sujet concordent.
cas(
  "adresses différentes, même commande et même sujet, 8 jours d'écart",
  fil({ email: "marie.andree.moisan@gmail.com", orders: ["L-46517"], subjects: ["Fwd: Tuque reçue trop petite"], du: "2026-02-16" }),
  fil({ email: "mam@smbinfo.ca", orders: ["L-46517"], subjects: ["Tuque reçue trop petite"], du: "2026-02-24" }),
  true
);

// Le NOM seul ne relie rien tant que USE_NAME n'est pas activé : deux homonymes ne sont pas
// un doublon, et c'est le comportement par défaut.
cas(
  "adresses différentes, même nom, aucune commande commune (USE_NAME éteint)",
  fil({ email: "m1@exemple.com", name: "marie moisan", subjects: ["Question"], du: "2026-08-14" }),
  fil({ email: "m2@exemple.com", name: "marie moisan", subjects: ["Autre question"], du: "2026-08-15" }),
  false
);

// Cas réel (L-48019) : deux adresses à une lettre près, même commande, fils qui se
// chevauchent mais dont l'un s'étale sur 4 mois. Le plafond d'étendue « adresse seule »
// (45 j) le rejetterait ; le plafond « commande commune » (120 j) le retient.
cas(
  "même commande, deux adresses proches, fil long de 117 j",
  fil({ email: "nwolpmann@gmail.com", orders: ["L-48019"], subjects: ["Order L-48019"], du: "2026-03-21", au: "2026-07-16" }),
  fil({ email: "wolpmannn@gmail.com", orders: ["L-48019"], subjects: ["A shipment from order L-48019 is on the way"], du: "2026-03-25", au: "2026-04-16" }),
  true
);

console.log("\n--- Le plafond élargi ne rouvre pas la porte aux faux positifs ---\n");

// Cas réel (L-49227) : deux personnes différentes citant la même commande, à 444 j
// d'étendue. Même avec le plafond « commande commune » à 120 j, c'est écarté.
cas(
  "même commande citée par deux clients différents, étendue 444 j",
  fil({ email: "gc.lavoie@hotmail.com", orders: ["L-49227"], subjects: ["Commande L-49227 confirmée"], du: "2026-04-23", au: "2026-05-07" }),
  fil({ email: "chntlhbrd@gmail.com", orders: ["L-49227"], subjects: ["Commande # L-49227"], du: "2025-02-17", au: "2026-04-29" }),
  false
);

console.log("\n--- Nos propres adresses ne sont jamais un client ---\n");

// media@lasclay.com ne figurait pas dans MISSIVE_SELF_ADDRESSES : il était pris pour un
// client et servait de pont entre les fils de misscujo@ et de denis.roy58@. Toute adresse de
// notre domaine est à nous, inscrite ou non.
egal("adresse de notre domaine absente de la liste", isSelfAddress("media@lasclay.com"), true);
egal("adresse déclarée dans MISSIVE_SELF_ADDRESSES", isSelfAddress("hey@lasclay.com"), true);
egal("adresse d'un client", isSelfAddress("cliente@hotmail.com"), false);
egal("domaine qui ressemble sans en être un", isSelfAddress("info@notlasclay.com"), false);

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
