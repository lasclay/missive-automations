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

async function call(route, body, method = "POST") {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET || "" },
  };
  if (method === "POST") opts.body = JSON.stringify(body || {});
  const res = await fetch(`${URL}${route}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${route} → ${res.status} ${text.slice(0, 200)}`);
  return json;
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
  const equipeNom = (args[args.indexOf("--equipe") + 1] || "operations").toLowerCase();
  const limite = args.includes("--limite") ? parseInt(args[args.indexOf("--limite") + 1], 10) : Infinity;

  const equipe = EQUIPES[equipeNom];
  if (!equipe) throw new Error(`Équipe inconnue : ${equipeNom}. Choix : ${Object.keys(EQUIPES).join(", ")}`);
  if (!SECRET) throw new Error("MISSIVE_PROXY_SECRET absent de l'environnement.");

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

  const ferme = [];
  if (fermer) {
    for (const r of superflu) {
      try {
        await call("/close", {
          id: r.id,
          note: `Fermé automatiquement par \`ops_triage.js\` : ${r.raison}. Aucune action requise, aucun humain en attente. Rouvrir si ce jugement est faux — et si ça arrive, corriger la liste blanche du script plutôt que de refermer à la main.`,
        });
        ferme.push(r.id);
      } catch (e) {
        r.erreurFermeture = e.message;
      }
    }
  }

  if (enJson) {
    console.log(JSON.stringify({ equipe: equipe.nom, total: resultats.length, ferme, resultats }, null, 2));
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
  console.log(
    fermer
      ? `✅ ${ferme.length} fil(s) SUPERFLU fermé(s).`
      : `ℹ️  Essai à blanc — rien n'a été fermé. Relancer avec --close pour fermer les ${superflu.length} fils SUPERFLU.`
  );
}

main().catch((e) => {
  console.error("Erreur:", e.message);
  process.exit(1);
});
