/**
 * tests/boucle.js — la boucle agentique, avec une fausse API Anthropic.
 *
 * On veut vérifier ce qui ne dépend pas du modèle : que les appels d'outils
 * s'enchaînent, que les résultats lui reviennent, que le tour est journalisé,
 * que l'historique permet de reprendre le fil, et que la boucle s'arrête.
 * Le vrai modèle se teste à la main (voir README) ; ici on teste la mécanique.
 *
 *   node tests/boucle.js
 */
'use strict';
const os = require('node:os'), path = require('node:path'), fs = require('node:fs');
process.env.MRP_DB = path.join(os.tmpdir(), `mrp-boucle-${process.pid}.db`);
process.env.ANTHROPIC_API_KEY = 'test-sans-reseau';

const { db } = require('../db.js');
const auth = require('../auth.js');

// --- fausse API : on scripte les réponses avant de charger l'assistant ------
let scenario = [], appels = [];
global.fetch = async (url, opts) => {
  appels.push(JSON.parse(opts.body));
  const suivant = scenario.shift();
  if (!suivant) throw new Error('scénario épuisé — la boucle a tourné trop longtemps');
  return { ok: true, status: 200, json: async () => suivant };
};

const assistant = require('../assistant.js');

const dit = (texte) => ({ content: [{ type: 'text', text: texte }] });
const outil = (name, input, texte) => ({ content: [
  ...(texte ? [{ type: 'text', text: texte }] : []),
  { type: 'tool_use', id: 'tu_' + Math.abs(name.length * 7 + (appels.length || 1)), name, input },
] });

let ok = 0, ko = 0;
const t = (nom, cond, detail = '') => {
  if (cond) { ok++; console.log(`  [OK ] ${nom}`); }
  else { ko++; console.log(`  [KO ] ${nom}${detail ? ' — ' + detail : ''}`); }
};

auth.creerUtilisateur({ courriel: 'a@test.com', mdp: 'motdepasse1',
  nom: 'Claudia', role: 'admin' });
auth.creerUtilisateur({ courriel: 'm@test.com', mdp: 'motdepasse2',
  nom: 'Montassar', role: 'atelier' });
const u = (c) => db.prepare(`SELECT * FROM utilisateurs WHERE courriel = ?`).get(c);
const admin = u('a@test.com'), atelier = u('m@test.com');
const FIL = 'a'.repeat(18);

(async () => {
  console.log('\nBoucle agentique (fausse API)\n');

  // ---------------------------------------------- enchaînement de plusieurs outils
  scenario = [
    outil('creer_produit', { code: 'CC-ADULTE', nom: 'Cache-cou adulte' }),
    outil('creer_ordre', { titre: 'Production automne 2026' }),
    outil('ajouter_item', { ordre: 'Production automne 2026',
                            produit: 'CC-ADULTE', quantite: 2000 }),
    outil('ajouter_jalon', { ordre: 'Production automne 2026',
                             titre: 'Départ conteneur', date: '2026-10-02' }),
    dit('Ordre créé avec 2000 cache-cous et une deadline au 2 octobre.'),
  ];
  appels = [];
  let r = await assistant.traiter({ user: admin, fil: FIL,
    demande: 'Crée un ordre pour 2000 cache-cous, départ conteneur le 2 octobre' });

  t('quatre outils enchaînés en une demande', r.faits.length === 4,
    JSON.stringify(r.faits));
  t('réponse finale rendue', /2 octobre/.test(r.reponse || ''), r.reponse);
  t('cinq appels au modèle (4 outils + conclusion)', appels.length === 5,
    String(appels.length));
  t("l'ordre existe vraiment en base",
    db.prepare(`SELECT COUNT(*) n FROM ordres`).get().n === 1);
  t("l'item existe vraiment en base",
    db.prepare(`SELECT quantite q FROM ordre_items`).get()?.q === 2000);

  // le résultat d'outil est bien renvoyé au modèle
  const renvoi = appels[1].messages.find(m => Array.isArray(m.content)
    && m.content[0]?.type === 'tool_result');
  t("le résultat de l'outil retourne au modèle", Boolean(renvoi),
    JSON.stringify(appels[1].messages.map(m => m.role)));

  const tourId = r.tourId;
  t('tour journalisé',
    db.prepare(`SELECT COUNT(*) n FROM agent_actions WHERE tour_id = ?`).get(tourId).n === 4);

  // ------------------------------------------------------- reprise du fil
  scenario = [dit('Il y a un seul ordre en cours.')];
  appels = [];
  r = await assistant.traiter({ user: admin, fil: FIL, demande: 'Et les mitaines ?' });
  const envoyes = appels[0].messages;
  t('la conversation précédente est reprise', envoyes.length > 1,
    `${envoyes.length} messages`);
  t('la nouvelle demande est le dernier message',
    envoyes[envoyes.length - 1].content === 'Et les mitaines ?');

  scenario = [dit('Rien à signaler.')];
  appels = [];
  await assistant.traiter({ user: admin, fil: 'b'.repeat(18), demande: 'Autre fil' });
  t('un autre fil repart de zéro', appels[0].messages.length === 1,
    String(appels[0].messages.length));

  // ------------------------------------------------ erreur d'outil rattrapable
  scenario = [
    outil('maj_avancement', { ordre: 'automne', produit: 'BANDEAU', valeur: 70 }),
    outil('maj_avancement', { ordre: 'automne', produit: 'CC-ADULTE', valeur: 70 }),
    dit('Les cache-cous sont à 70 %.'),
  ];
  appels = [];
  r = await assistant.traiter({ user: admin, fil: FIL,
    demande: 'Mets le bandeau à 70 %' });
  const premierResultat = JSON.parse(appels[1].messages.at(-1).content[0].content);
  t("l'échec d'un outil revient au modèle au lieu de planter",
    Boolean(premierResultat.erreur), JSON.stringify(premierResultat));
  // 2 écritures : l'avancement, plus la bascule planifié → en cours qu'il entraîne
  t('le modèle peut corriger et réussir ensuite', r.faits.length === 2,
    JSON.stringify(r.faits));

  // --------------------------------------------------------- droits atelier
  scenario = [
    outil('creer_ordre', { titre: 'Tentative' }),
    dit("Je ne peux pas créer d'ordre depuis l'atelier."),
  ];
  appels = [];
  r = await assistant.traiter({ user: atelier, fil: 'c'.repeat(18),
    demande: 'Crée un ordre' });
  const refus = JSON.parse(appels[1].messages.at(-1).content[0].content);
  t("l'atelier est refusé même en passant par l'assistant",
    Boolean(refus.erreur) && /Admin QC/.test(refus.erreur), JSON.stringify(refus));
  t('aucune écriture au journal pour un refus', r.faits.length === 0);
  t("l'atelier ne reçoit pas les schémas d'admin",
    !(appels[0].tools || []).some(x => x.name === 'creer_ordre'));

  // ------------------------------------------------------- garde-fou boucle
  scenario = Array.from({ length: 14 }, () =>
    outil('lister_ordres', {}));
  appels = [];
  r = await assistant.traiter({ user: admin, fil: 'd'.repeat(18), demande: 'Boucle' });
  t('la boucle s\'arrête au plafond', appels.length === 12, String(appels.length));
  t('le plafond est expliqué à l\'utilisateur', /12 étapes/.test(r.reponse || ''), r.reponse);

  // ----------------------------------------------------------- cas dégradés
  r = await assistant.traiter({ user: admin, fil: FIL, demande: '   ' });
  t('demande vide refusée', Boolean(r.erreur));

  scenario = [];
  appels = [];
  r = await assistant.traiter({ user: admin, fil: FIL, demande: 'API en panne' });
  t("panne d'API rapportée, pas avalée", Boolean(r.erreur), JSON.stringify(r));
  t('le tour en échec est conservé avec son erreur',
    db.prepare(`SELECT erreur FROM agent_tours WHERE id = ?`).get(r.tourId).erreur.length > 0);

  // ------------------------------------------------------------- historique
  const fil = assistant.fil(FIL, admin.id);
  t('le fil rend les tours dans l\'ordre chronologique',
    fil.length >= 3 && fil[0].id < fil[1].id);
  t('chaque tour porte ses actions', fil[0].actions.length === 4);

  console.log(`\n  ${ok} réussites, ${ko} échecs\n`);
  fs.rmSync(process.env.MRP_DB, { force: true });
  fs.rmSync(process.env.MRP_DB + '-wal', { force: true });
  fs.rmSync(process.env.MRP_DB + '-shm', { force: true });
  process.exit(ko ? 1 : 0);
})();
