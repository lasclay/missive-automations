/**
 * Lasclay — ops_triage.js (v1.0)
 * ---------------------------------------------------------------------------
 * Trie la boîte d'équipe Operations (ou Admin) et ferme ce qui est PUREMENT du
 * bruit de notification. Écrit après un ménage manuel du 18 septembre 2026 qui a
 * trouvé 61 fils ouverts, dont 58 où la balle était dans notre camp — et dont la
 * moitié n'était que des accusés automatiques jamais refermés.
 *
 * LA RÈGLE QUI PRIME : on ferme sur une LISTE BLANCHE d'expéditeurs machine, pas
 * sur une liste noire d'humains. Un expéditeur inconnu n'est jamais fermé. Le
 * doute profite toujours au fil.
 *
 * Trois pièges, chacun payé par une erreur réelle du ménage manuel :
 *
 *   1. UN RELAIS N'EST PAS UNE NOTIFICATION. `conversations@mail.etsy.com` et
 *      `no-reply@account.etsy.com` ressemblent à des robots mais transportent le
 *      message d'une VRAIE cliente. Trois fils Etsy ont failli être fermés comme
 *      du bruit : l'un d'eux était une acheteuse qui demandait si elle paierait
 *      des droits de douane. Les relais sont traités comme des humains, point.
 *
 *   2. UNE NOTIFICATION PEUT CACHER UNE URGENCE. « Your Microsoft 365
 *      subscription has expired » et « Ship by Sep 19 » viennent d'automates et
 *      ne se ferment surtout pas. D'où la détection de signaux d'action, qui
 *      bascule un fil de SUPERFLU vers ACTION.
 *
 *   3. LE DERNIER MESSAGE DÉCIDE, PAS LE PREMIER. Un fil ouvert par un automate
 *      où un humain a répondu ensuite est un fil humain.
 *
 * Usage :
 *   node ops_triage.js                      rapport, ne touche à rien
 *   node ops_triage.js --close              ferme la catégorie SUPERFLU
 *   node ops_triage.js --equipe admin       l'autre boîte
 *   node ops_triage.js --json               sortie machine
 *   node ops_triage.js --limite 25          plafonne le nombre de fils lus
 *
 * Variables d'environnement : MISSIVE_PROXY_SECRET (repli PROXY_SECRET),
 * MISSIVE_PROXY_URL facultative. Aucune clé n'est écrite en dur.
 *
 * Node 18+. Aucune dépendance.
 */

const URL = process.env.MISSIVE_PROXY_URL || "https://proxy-missive.onrender.com";
const SECRET = process.env.MISSIVE_PROXY_SECRET || process.env.PROXY_SECRET;

// Ids d'équipe — viennent de `node missive_client.js structure`, jamais devinés.
const EQUIPES = {
  operations: { id: "7c925f0d-3eca-4535-be20-424078619cef", nom: "LAS Operations" },
  admin: { id: "a6c74be0-2a27-4c79-9294-a74b447e6dc0", nom: "Lasclay Admin" },
  support: { id: "e184d153-4472-4edd-9b35-f8867cf437a8", nom: "LAS Support" },
};

// ── Liste blanche : expéditeurs dont le courrier est du bruit transactionnel ──
// Une entrée ne vaut que si le domaine correspond ET que le nom local ressemble à
// un automate. Ajouter ici demande une preuve : un fil réel, refermé sans regret.
const AUTOMATES = [
  { domaine: "account.tiktok.com", quoi: "notification de compte TikTok" },
  { domaine: "email.openai.com", quoi: "infolettre OpenAI" },
  { domaine: "email.shopify.com", quoi: "marketing Shopify" },
  { domaine: "shopifysvc.com", quoi: "marketing Shopify" },
  { domaine: "microsoft.com", local: /^microsoft-noreply$/, quoi: "notification Microsoft" },
  { domaine: "uline.ca", quoi: "confirmation de commande Uline" },
  { domaine: "uline.com", quoi: "confirmation de commande Uline" },
  { domaine: "clients.cybercat.ca", quoi: "rapport Location Sauvageau" },
  { domaine: "omnisend.com", quoi: "notification Omnisend" },
  { domaine: "soundestlink.com", quoi: "notification Omnisend" },
  { domaine: "intercom-clicks.com", quoi: "notification Intercom" },
  { domaine: "mail.notion.so", quoi: "notification Notion" },
  { domaine: "slack.com", quoi: "notification Slack" },
  { domaine: "github.com", local: /^(noreply|notifications)$/, quoi: "notification GitHub" },
  { domaine: "google.com", local: /^(no-?reply|forms-receipts)/, quoi: "notification Google" },
  { domaine: "calendar-notification.google.com", quoi: "rappel d'agenda" },
  { domaine: "stripe.com", local: /^(no-?reply|receipts)/, quoi: "reçu Stripe" },
  { domaine: "quickbooks.com", local: /^(no-?reply|quickbooks)/, quoi: "notification QuickBooks" },
  { domaine: "intuit.com", local: /^(no-?reply|quickbooks)/, quoi: "notification Intuit" },
  { domaine: "1password.com", quoi: "alerte de connexion 1Password" },
  { domaine: "1password.ca", quoi: "alerte de connexion 1Password" },
  { domaine: "zoom.us", local: /^no-?reply/, quoi: "notification Zoom" },
  { domaine: "dropbox.com", local: /^no-?reply/, quoi: "notification Dropbox" },
  { domaine: "canva.com", quoi: "notification Canva" },
];

// Note sur 1Password et les alertes de connexion : une alerte de routine est du
// bruit, une alerte anormale ne l'est pas. On ne tente pas de distinguer la
// géographie — ce sont les SIGNAUX_ACTION (« unauthorized », « unusual sign-in »,
// « code de vérification ») qui font remonter les cas qui méritent un regard.
// Une connexion TikTok depuis le New Jersey le 17 septembre est passée à travers
// cette maille : c'est le genre de cas où on élargit les signaux, jamais où on
// rétrécit la liste blanche.

// ── Relais : adresse de robot, contenu d'humain. JAMAIS fermés automatiquement. ──
// C'est la liste qui a manqué le 18 septembre. Un relais transporte la parole d'un
// client ; le fermer, c'est laisser un client sans réponse en croyant faire du ménage.
const RELAIS_HUMAINS = [
  { motif: /mail\.etsy\.com|account\.etsy\.com/i, quoi: "message client relayé par Etsy" },
  { motif: /facebookmail\.com|messenger\.com/i, quoi: "message relayé par Facebook" },
  { motif: /instagram\.com/i, quoi: "message relayé par Instagram" },
  { motif: /shopify(-email)?\.com.*contact|contact.*shopify/i, quoi: "formulaire de contact de la boutique" },
  { motif: /typeform|jotform|wufoo|formstack|tally\.so/i, quoi: "formulaire rempli par une personne" },
  { motif: /linkedin\.com/i, quoi: "message relayé par LinkedIn" },
];

// ── Signaux d'action : basculent une notification de SUPERFLU vers ACTION. ──
// Chacun correspond à un cas réel où fermer aurait coûté de l'argent ou un client.
const SIGNAUX_ACTION = [
  { motif: /\bexpir(ed|é|ée|e)\b|a expiré|has expired/i, quoi: "quelque chose a expiré" },
  { motif: /past due|overdue|en souffrance|échu|impayé|unpaid/i, quoi: "montant en souffrance" },
  { motif: /action required|action requise|requires? your action/i, quoi: "action explicitement demandée" },
  { motif: /ship by|expédier avant|date limite|deadline|avant le \d/i, quoi: "date limite d'expédition" },
  { motif: /payment (failed|declined)|paiement (refusé|échoué)|carte refusée/i, quoi: "paiement refusé" },
  { motif: /suspend(ed|u)|désactivé|deactivat|account on hold/i, quoi: "compte suspendu" },
  { motif: /unauthorized|unusual (activity|sign)|activité inhabituelle|non autoris/i, quoi: "alerte de sécurité" },
  { motif: /verification code|code de vérification|\b\d{6} is your\b/i, quoi: "code de vérification demandé" },
  { motif: /dernier avis|final notice|mise en demeure|last reminder/i, quoi: "dernier avis" },
  { motif: /failed delivery|non livré|delivery failed|retour à l'expéditeur/i, quoi: "échec de livraison" },
  { motif: /renew|renouvel|subscription end|fin d'abonnement/i, quoi: "renouvellement d'abonnement" },
];

const dors = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Appel au proxy, avec reprise. Render endort le service au repos : le premier
 * appel d'un passage peut prendre une dizaine de secondes ou mourir carrément.
 * Sans reprise, un ménage sur trois échouait au tout premier appel — et comme
 * la Routine tourne sans personne devant, l'échec passait inaperçu.
 *
 * On ne reprend QUE ce qui est sûrement rejouable : une erreur réseau, un 429,
 * ou un 5xx. Un 401 (mauvais secret) et un 404 (route absente) ne se corrigent
 * pas en réessayant — les rejouer ne fait que retarder le diagnostic.
 */
async function call(route, body, method = "POST", essai = 0) {
  const MAX = 4;
  const opts = {
    method,
    headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET || "" },
    signal: AbortSignal.timeout(90000),
  };
  if (method === "POST") opts.body = JSON.stringify(body || {});

  let res, text;
  try {
    res = await fetch(`${URL}${route}`, opts);
    text = await res.text();
  } catch (e) {
    // Panne réseau ou délai dépassé : rejouable.
    if (essai < MAX) {
      await dors(2000 * 2 ** essai);
      return call(route, body, method, essai + 1);
    }
    throw new Error(`${route} → injoignable après ${MAX + 1} tentatives (${e.message})`);
  }

  if (!res.ok) {
    const rejouable = res.status === 429 || res.status >= 500;
    if (rejouable && essai < MAX) {
      await dors(2000 * 2 ** essai);
      return call(route, body, method, essai + 1);
    }
    throw new Error(`${route} → ${res.status} ${text.slice(0, 200)}`);
  }

  try { return JSON.parse(text); } catch { return { raw: text }; }
}

/**
 * Réveille le service avant le vrai travail. `/health` ne coûte rien et absorbe
 * le démarrage à froid, ce qui évite qu'un fil soit classé HUMAIN « lecture
 * impossible » simplement parce qu'il est passé pendant le réveil.
 */
async function reveiller() {
  try {
    await call("/health", null, "GET");
    return true;
  } catch (e) {
    throw new Error(`le proxy Missive ne répond pas : ${e.message}`);
  }
}

const adresseDe = (s) => String(s || "").toLowerCase().trim();
const domaineDe = (a) => adresseDe(a).split("@")[1] || "";
const localDe = (a) => adresseDe(a).split("@")[0] || "";

function estRelaisHumain(adresse) {
  return RELAIS_HUMAINS.find((r) => r.motif.test(adresseDe(adresse))) || null;
}

function estAutomate(adresse) {
  const d = domaineDe(adresse), l = localDe(adresse);
  if (!d) return null;
  for (const a of AUTOMATES) {
    if (d !== a.domaine && !d.endsWith("." + a.domaine)) continue;
    if (a.local && !a.local.test(l)) continue;
    return a;
  }
  return null;
}

function signauxDe(texte) {
  const t = String(texte || "");
  return SIGNAUX_ACTION.filter((s) => s.motif.test(t)).map((s) => s.quoi);
}

/**
 * Classe un fil. Renvoie {categorie, raison, ...}.
 * Catégories : SUPERFLU (fermable), ACTION (note + garder ouvert),
 * HUMAIN (ne jamais toucher), NOTRE_TOUR (on a répondu), VIDE (fil système).
 */
function classer(conv, messages) {
  if (!messages || messages.length === 0)
    return { categorie: "VIDE", raison: "aucun message lisible (fil système ou interne)" };

  const dernier = messages[messages.length - 1];

  if (dernier.us === true)
    return { categorie: "NOTRE_TOUR", raison: "le dernier mot est le nôtre — on attend leur réponse" };

  const relais = estRelaisHumain(dernier.address);
  if (relais)
    return { categorie: "HUMAIN", raison: `${relais.quoi} — un robot transporte la parole d'une personne` };

  const automate = estAutomate(dernier.address);
  if (!automate)
    return { categorie: "HUMAIN", raison: "expéditeur hors liste blanche — on ne ferme jamais au doute" };

  // Expéditeur machine reconnu : reste à vérifier qu'il ne cache pas une urgence.
  const signaux = signauxDe(`${conv.subject || ""}\n${dernier.subject || ""}\n${dernier.text || ""}`);
  if (signaux.length)
    return { categorie: "ACTION", raison: `${automate.quoi}, MAIS : ${signaux.join(", ")}`, signaux };

  return { categorie: "SUPERFLU", raison: automate.quoi };
}

const joursDepuis = (d) => {
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : Math.round((Date.now() - t) / 86400000);
};

async function main() {
  const args = process.argv.slice(2);
  const fermer = args.includes("--close");
  const enJson = args.includes("--json");
  // `indexOf` renvoie -1 quand le drapeau est absent, et `-1 + 1 === 0` : la
  // valeur lue devenait args[0], c'est-à-dire le premier drapeau venu. Résultat,
  // `ops_triage.js --close` mourait sur « Équipe inconnue : --close » — la
  // commande même que la Routine lance à chaque passage. Un défaut invisible à
  // l'essai à blanc, fatal dès qu'on ferme.
  const valeurDe = (drapeau, defaut = null) => {
    const i = args.indexOf(drapeau);
    return i === -1 ? defaut : (args[i + 1] ?? defaut);
  };

  const equipeNom = String(valeurDe("--equipe", "operations")).toLowerCase();
  const limiteBrute = valeurDe("--limite");
  const limite = limiteBrute === null ? Infinity : parseInt(limiteBrute, 10);
  if (Number.isNaN(limite)) throw new Error(`--limite attend un nombre, reçu : ${limiteBrute}`);

  const equipe = EQUIPES[equipeNom];
  if (!equipe) throw new Error(`Équipe inconnue : ${equipeNom}. Choix : ${Object.keys(EQUIPES).join(", ")}`);
  if (!SECRET)
    throw new Error(
      "MISSIVE_PROXY_SECRET absent de l'environnement (repli PROXY_SECRET). " +
      "Sans lui, aucun appel n'aboutit : c'est une panne de configuration, pas une boîte vide."
    );

  // Réveil d'abord. Render endort le service, et un démarrage à froid pendant la
  // lecture ferait passer des fils pour illisibles.
  await reveiller();

  const { conversations = [] } = await call("/list", { filter: `team_inbox=${equipe.id}` });
  const cibles = conversations.slice(0, limite);

  // Lecture par lots : le proxy pagine déjà chaque fil, inutile de le bousculer.
  const resultats = [];
  for (let i = 0; i < cibles.length; i += 6) {
    const lot = cibles.slice(i, i + 6);
    const lus = await Promise.all(
      lot.map(async (c) => {
        try {
          const { messages } = await call("/conversation", { id: c.id });
          return { conv: c, messages: messages || [] };
        } catch (e) {
          return { conv: c, messages: null, erreur: e.message };
        }
      })
    );
    for (const r of lus) {
      const verdict = r.erreur
        ? { categorie: "HUMAIN", raison: `lecture impossible (${r.erreur}) — on ne ferme jamais à l'aveugle` }
        : classer(r.conv, r.messages);
      const dernier = (r.messages || [])[(r.messages || []).length - 1] || {};
      resultats.push({
        id: r.conv.id,
        sujet: (r.conv.subject || "(sans objet)").slice(0, 80),
        de: dernier.from || null,
        adresse: dernier.address || null,
        date: dernier.date || null,
        jours: dernier.date ? joursDepuis(dernier.date) : null,
        messages: (r.messages || []).length,
        ...verdict,
      });
    }
  }

  const par = (c) => resultats.filter((r) => r.categorie === c);
  const superflu = par("SUPERFLU");

  // Les fils qu'on n'a pas pu lire restent classés HUMAIN (donc intouchés), mais
  // il faut le DIRE : un tri partiel qui se présente comme complet est un piège.
  // Sans ce compte, un ménage qui n'a lu que la moitié de la boîte a l'air réussi.
  const illisibles = resultats.filter((r) => /lecture impossible/.test(r.raison || ""));

  // `--close-ids a,b,c` ferme exactement ces fils, s'ils sont bien classés SUPERFLU.
  // Sert au passage de la Routine : elle vérifie le rapport, puis ne ferme que ce
  // qu'elle a vraiment vu, sans relire la boîte une deuxième fois.
  const cibleIdsBrut = valeurDe("--close-ids");
  const cibleIds = cibleIdsBrut === null
    ? null
    : String(cibleIdsBrut).split(",").map((s) => s.trim()).filter(Boolean);

  const aFermer = cibleIds
    ? superflu.filter((r) => cibleIds.includes(r.id))
    : superflu;

  const refuses = cibleIds
    ? cibleIds.filter((id) => !superflu.some((r) => r.id === id))
    : [];

  const ferme = [];
  const echecs = [];
  if (fermer || cibleIds) {
    for (const r of aFermer) {
      try {
        await call("/close", {
          id: r.id,
          note: `Fermé automatiquement par \`ops_triage.js\` : ${r.raison}. Aucune action requise, aucun humain en attente. Rouvrir si ce jugement est faux — et si ça arrive, corriger la liste blanche du script plutôt que de refermer à la main.`,
        });
        ferme.push(r.id);
      } catch (e) {
        r.erreurFermeture = e.message;
        echecs.push({ id: r.id, sujet: r.sujet, erreur: e.message });
      }
    }
  }

  if (enJson) {
    console.log(JSON.stringify(
      { equipe: equipe.nom, total: resultats.length, ferme, echecs, refuses, illisibles: illisibles.length, resultats },
      null, 2
    ));
    // Même en JSON, un échec doit faire sortir en erreur : c'est ce qui le rend visible.
    if (echecs.length) process.exit(2);
    return;
  }

  const ligne = (r) => `  [${r.jours ?? "?"}j] ${r.id}  ${r.de || "?"} — ${r.sujet}\n        ↳ ${r.raison}`;
  console.log(`\n=== Boîte ${equipe.nom} — ${resultats.length} fils ouverts ===\n`);
  for (const cat of ["ACTION", "HUMAIN", "NOTRE_TOUR", "SUPERFLU", "VIDE"]) {
    const lot = par(cat);
    if (!lot.length) continue;
    lot.sort((a, b) => (b.jours || 0) - (a.jours || 0));
    console.log(`── ${cat} (${lot.length}) ──`);
    console.log(lot.map(ligne).join("\n"));
    console.log("");
  }

  if (illisibles.length) {
    console.log(`⚠️  ${illisibles.length} fil(s) n'ont pas pu être lus et sont restés intouchés.`);
    console.log(`    Le tri est donc PARTIEL. Ces fils sont classés HUMAIN par prudence :`);
    console.log(illisibles.map((r) => `      ${r.id} — ${r.sujet}`).join("\n"));
    console.log("");
  }

  if (refuses.length) {
    console.log(`⚠️  ${refuses.length} id(s) demandé(s) via --close-ids n'étaient PAS classés SUPERFLU — non fermés :`);
    console.log(refuses.map((id) => `      ${id}`).join("\n"));
    console.log("");
  }

  if (echecs.length) {
    console.log(`🔴 ${echecs.length} FERMETURE(S) ÉCHOUÉE(S) — ces fils sont encore ouverts :`);
    console.log(echecs.map((e) => `      ${e.id} — ${e.sujet}\n        ↳ ${e.erreur}`).join("\n"));
    console.log("");
  }

  if (fermer || cibleIds) {
    console.log(`${echecs.length ? "⚠️ " : "✅"} ${ferme.length} fil(s) fermé(s)${echecs.length ? `, ${echecs.length} en échec` : ""}.`);
  } else {
    console.log(`ℹ️  Essai à blanc — rien n'a été fermé. Relancer avec --close pour fermer les ${superflu.length} fils SUPERFLU.`);
  }

  // Un code de sortie non nul est la seule chose qu'une Routine ne peut pas
  // confondre avec un succès. Un échec de fermeture silencieux produirait un
  // rapport qui annonce du ménage jamais fait.
  if (echecs.length) process.exit(2);
}

main().catch((e) => {
  console.error("Erreur:", e.message);
  process.exit(1);
});
