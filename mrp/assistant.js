/**
 * assistant.js — la boucle agentique.
 *
 * Une phrase entre (« mets les cache-cous à 70 % et préviens que le conteneur
 * part le 2 octobre »), des actions sortent. Le modèle appelle les outils de
 * outils.js, lit les résultats, enchaîne, et rend compte à la fin.
 *
 * Ce n'est pas un chatbot posé à côté de l'app : les outils écrivent dans la
 * même base que les formulaires, avec les mêmes droits et les mêmes
 * contraintes. Une phrase mal comprise ne peut donc rien faire qu'un clic
 * n'aurait pu faire — et tout est annulable.
 *
 * Variables d'environnement :
 *   ANTHROPIC_API_KEY   requis pour que l'assistant réponde
 *   MRP_MODELE          défaut claude-sonnet-5
 */
'use strict';
const { db } = require('./db.js');
const outils = require('./outils.js');

const CLE = process.env.ANTHROPIC_API_KEY;
const MODELE = process.env.MRP_MODELE || 'claude-sonnet-5';
const TOURS_MAX = 12;             // garde-fou : jamais de boucle infinie
const HISTORIQUE_MAX = 16;        // messages conservés d'un tour à l'autre

const disponible = () => Boolean(CLE);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Surrogates orphelins : la dictée vocale en produit, l'API les refuse. */
const sanit = (s) => String(s || '')
  .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
  .replace(/(^|[^\uD800-\uDBFF])([\uDC00-\uDFFF])/g, '$1');

function consigne(user) {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return `Tu es l'assistant du MRP de Lasclay, une entreprise québécoise qui
fabrique des vêtements et accessoires isolés à la soie d'asclépiade. La
production se fait en Tunisie, la coordination depuis Québec.

Tu ne fais pas que répondre : tu EXÉCUTES. Quand on te donne un ordre —
« mets les cache-cous à 70 % », « crée un ordre pour 500 tuques », « ajoute
une deadline le 2 octobre » — tu appelles les outils et tu le fais. Tu ne
demandes pas la permission pour une action ordinaire, tu agis puis tu dis ce
que tu as fait. Toutes tes écritures sont annulables d'un clic, l'utilisateur
n'est jamais coincé.

Tu parles à ${user.nom} (${user.role === 'admin' ? 'Admin QC' : 'Atelier Tunisie'}),
le ${aujourdhui}.

Comment travailler :
- Vérifie avant d'écrire quand la référence est floue. lire_ordre ou
  chercher_produit coûtent moins cher qu'une erreur.
- Enchaîne les outils sans repasser par l'utilisateur : créer un ordre, y
  ajouter quatre items et deux jalons, c'est une seule demande.
- Si une référence est ambiguë ou introuvable, l'outil te le dit. Pose alors
  UNE question précise au lieu de deviner. Ne choisis jamais à la place de
  quelqu'un entre deux produits qui se ressemblent.
- Un avancement va par tranches de 10 %. C'est Montassar qui donne le chiffre :
  ne l'invente pas, ne l'arrondis pas depuis une description vague. Si on te dit
  « presque fini », demande le chiffre.
- Les dates sont en AAAA-MM-JJ. « Le 2 octobre » sans année veut dire la
  prochaine occurrence à partir d'aujourd'hui.
- Une réponse à une question technique récurrente (sens de coupe, matière,
  usage) mérite d'aller dans la fiche produit avec maj_produit, pas seulement
  dans la conversation. Propose-le quand ça s'applique.

Comment répondre :
- En français, court, concret. Deux ou trois phrases suffisent presque toujours.
- Dis ce que tu as fait, pas ce que tu vas faire. Pas de préambule.
- Ne réinvente pas les chiffres : cite ceux que les outils t'ont renvoyés.
- Si tu n'as rien pu faire, dis-le franchement et dis ce qui manque.`;
}

/** Appel à l'API, avec reprise sur 429/529 et coupures réseau. */
async function appeler(corps) {
  for (let essai = 1; essai <= 4; essai++) {
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': CLE,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(corps),
      });
    } catch (e) {
      if (essai === 4) throw new Error(`Réseau Anthropic : ${e.message}`);
      await sleep(essai * 2000);
      continue;
    }
    if (res.status === 429 || res.status === 529) {
      if (essai === 4) throw new Error(`Anthropic saturé (${res.status}).`);
      await sleep(essai * 3000);
      continue;
    }
    if (!res.ok) throw new Error(`Anthropic ${res.status} : ${await res.text()}`);
    return res.json();
  }
}

/**
 * Traite une demande de bout en bout.
 * Retourne { tourId, reponse, faits[], erreur }.
 */
async function traiter({ demande, user, fil }) {
  const texte = sanit(demande).trim();
  if (!texte) return { erreur: 'Demande vide.' };
  if (!disponible())
    return { erreur: "L'assistant n'est pas configuré : il manque ANTHROPIC_API_KEY "
                   + 'côté serveur.' };

  // On reprend l'historique du fil pour que « et les mitaines ? » ait un sens.
  const precedent = db.prepare(
    `SELECT messages FROM agent_tours WHERE fil = ? AND utilisateur_id = ?
     ORDER BY id DESC LIMIT 1`).get(fil, user.id);
  let messages = [];
  try { messages = JSON.parse(precedent?.messages || '[]'); } catch { messages = []; }
  messages = messages.slice(-HISTORIQUE_MAX);
  messages.push({ role: 'user', content: texte });

  const tourId = db.prepare(
    `INSERT INTO agent_tours (utilisateur_id, fil, demande) VALUES (?,?,?)`)
    .run(user.id, fil, texte).lastInsertRowid;

  const ctx = { user, tourId, faits: [] };
  const tools = outils.schemas(user.role);
  let reponse = '';

  try {
    for (let tour = 0; tour < TOURS_MAX; tour++) {
      const data = await appeler({
        model: MODELE, max_tokens: 2000, system: consigne(user), tools, messages,
      });
      const blocs = data.content || [];
      messages.push({ role: 'assistant', content: blocs });

      const appels = blocs.filter(b => b.type === 'tool_use');
      const dit = blocs.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      if (dit) reponse = dit;

      if (!appels.length) break;

      // Les outils s'exécutent en série : l'ordre compte (créer puis remplir).
      const resultats = appels.map(a => ({
        type: 'tool_result',
        tool_use_id: a.id,
        content: JSON.stringify(outils.executer(a.name, a.input, ctx)),
      }));
      messages.push({ role: 'user', content: resultats });

      if (tour === TOURS_MAX - 1)
        reponse = (reponse ? reponse + '\n\n' : '')
          + `J'ai arrêté après ${TOURS_MAX} étapes pour ne pas boucler. `
          + 'Vérifie ce qui a été fait et relance-moi si besoin.';
    }
  } catch (e) {
    console.error('[assistant]', e);
    db.prepare(`UPDATE agent_tours SET erreur = ?, messages = ? WHERE id = ?`)
      .run(e.message, JSON.stringify(messages.slice(-HISTORIQUE_MAX)), tourId);
    return { tourId, erreur: e.message, faits: ctx.faits };
  }

  db.prepare(`UPDATE agent_tours SET reponse = ?, messages = ? WHERE id = ?`)
    .run(reponse, JSON.stringify(messages.slice(-HISTORIQUE_MAX)), tourId);
  return { tourId, reponse, faits: ctx.faits };
}

/** Les tours d'un fil, du plus ancien au plus récent, avec leurs actions. */
function fil(identifiant, utilisateurId, limite = 12) {
  const tours = db.prepare(
    `SELECT * FROM agent_tours WHERE fil = ? AND utilisateur_id = ?
     ORDER BY id DESC LIMIT ?`).all(identifiant, utilisateurId, limite).reverse();
  const actions = db.prepare(
    `SELECT tour_id, resume, defaire, defait FROM agent_actions
     WHERE tour_id = ? ORDER BY id`);
  return tours.map(t => ({ ...t, actions: actions.all(t.id) }));
}

module.exports = { traiter, fil, disponible, MODELE };
