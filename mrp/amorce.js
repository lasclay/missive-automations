/**
 * Charge les données du dépôt dans la base, au démarrage du service.
 *
 * Pourquoi ce fichier existe : les imports étaient documentés comme des
 * commandes à taper dans le Shell Render après chaque déploiement. Personne ne
 * les a tapées, et l'application est restée en ligne pendant des jours avec
 * « Aucun protocole écrit pour ce produit » sur des fiches dont le protocole
 * était dans le dépôt depuis le début. Une donnée versionnée qui n'arrive pas
 * en production n'existe pas.
 *
 * Deux régimes, et la différence compte :
 *
 *   — Le CATALOGUE (produits, photos, matériaux, plan de production) ne se
 *     charge QUE sur une base vide. Il vient de Shopify et du chiffrier ; le
 *     relancer écraserait ce que quelqu'un aurait corrigé dans l'app.
 *
 *   — Les PROTOCOLES, la CHARTE et les BRIS se rechargent à chaque démarrage.
 *     Ces imports-là n'effacent que les lignes dont ILS sont la source
 *     (« charte produits », « notes techniques », « missive:… ») : un point
 *     écrit à la main dans l'app porte le nom de son auteur et n'est jamais
 *     touché. Le service suit donc le dépôt sans rien perdre.
 *
 * Chaque import tourne dans son propre processus : un fichier de données
 * malformé fait échouer son import, pas le démarrage du service.
 */
'use strict';
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { db } = require('./db.js');

const ETAPES = [
  { script: 'import.js',         args: ['--ecrire'], quoi: 'catalogue',
    // Seulement sur une base vide : voir plus haut.
    siVide: () => !db.prepare(`SELECT 1 FROM produits LIMIT 1`).get() },
  { script: 'import_charte.js',  args: ['--ecrire'], quoi: 'charte produits' },
  { script: 'import_qualite.js', args: ['--charte', '--squelettes', '--ecrire'],
    quoi: 'protocoles qualité' },
  { script: 'import_bris.js',    args: ['--ecrire'], quoi: 'bris signalés' },
];

function amorcerDonnees() {
  // Les tests de bout en bout partent d'une base vide et comptent les lignes
  // qu'ils écrivent eux-mêmes : charger trente-quatre produits et cent
  // trente-trois points de contrôle sous leurs pieds ferait échouer des
  // assertions justes. Un interrupteur, plutôt qu'une base de test qui
  // ressemble de moins en moins à la production.
  if (process.env.MRP_SANS_AMORCE === '1') {
    console.log('[mrp] amorce des données désactivée (MRP_SANS_AMORCE=1).');
    return;
  }
  for (const e of ETAPES) {
    try {
      if (e.siVide && !e.siVide()) {
        console.log(`[mrp] ${e.quoi} : base déjà peuplée, on n'y touche pas.`);
        continue;
      }
      execFileSync(process.execPath,
        ['--no-warnings', path.join(__dirname, e.script), ...e.args],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
      console.log(`[mrp] ${e.quoi} : chargé.`);
    } catch (err) {
      // Un import qui échoue laisse le service démarrer : mieux vaut une page
      // sans protocole qu'un service qui ne répond pas.
      const detail = String(err.stderr || err.message).trim().split('\n').pop();
      console.error(`[mrp] ${e.quoi} : échec — ${detail.slice(0, 200)}`);
    }
  }
  const n = (t) => { try { return db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n; }
                     catch { return 0; } };
  console.log(`[mrp] en base : ${n('produits')} produits, ${n('charte')} lignes de charte,`
    + ` ${n('qc_points')} points de contrôle, ${n('qc_bris')} bris.`);
}

module.exports = { amorcerDonnees };
