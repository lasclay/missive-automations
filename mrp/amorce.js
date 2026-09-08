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
 *   — Le CATALOGUE (produits, photos, matériaux, plan de production) se charge
 *     sur une base vide, PUIS chaque fois que les fichiers de `donnees/`
 *     changent. Il vient de Shopify et du chiffrier ; le relancer à chaque
 *     démarrage écraserait ce que quelqu'un aurait corrigé dans l'app, mais ne
 *     jamais le relancer était pire : une quantité ajoutée au plan restait
 *     dans le dépôt sans jamais atteindre la production. L'empreinte du
 *     dossier tranche — elle ne bouge que si on a touché à la source de
 *     vérité, et c'est là, et seulement là, qu'on recharge. Le compromis est
 *     assumé : modifier un fichier de données reprend la main sur les fiches
 *     produits, ce qui est bien ce qu'on demande en le modifiant.
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
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const { db } = require('./db.js');

/**
 * L'empreinte des données versionnées : le dossier `donnees/` et le script qui
 * le lit. Changer une quantité dans un TSV la fait bouger ; redémarrer le
 * service dix fois de suite, non.
 *
 * 900 Ko à lire au démarrage — sans commune mesure avec le coût d'une donnée
 * corrigée dans le dépôt qui n'arrive jamais à l'atelier.
 */
function empreinteDonnees() {
  const h = crypto.createHash('sha256');
  const dossier = path.join(__dirname, 'donnees');
  for (const f of fs.readdirSync(dossier).sort()) {
    const p = path.join(dossier, f);
    if (!fs.statSync(p).isFile()) continue;
    h.update(f).update('\0').update(fs.readFileSync(p));
  }
  h.update(fs.readFileSync(path.join(__dirname, 'import.js')));
  return h.digest('hex').slice(0, 16);
}

const etatLu = (cle) =>
  db.prepare(`SELECT valeur FROM amorce_etat WHERE cle = ?`).get(cle)?.valeur || null;

const etatPose = (cle, valeur) => db.prepare(
  `INSERT INTO amorce_etat (cle, valeur, maj_le) VALUES (?,?,datetime('now'))
     ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur, maj_le = excluded.maj_le`)
  .run(cle, valeur);

const ETAPES = [
  { script: 'import.js',         args: ['--ecrire'], quoi: 'catalogue',
    // Base vide, ou fichiers de données modifiés depuis le dernier chargement.
    // La raison est renvoyée pour qu'elle apparaisse dans le journal Render :
    // « pourquoi le catalogue a-t-il bougé » est la première question qu'on
    // se pose devant une quantité qui change toute seule.
    pourquoi: () => {
      if (!db.prepare(`SELECT 1 FROM produits LIMIT 1`).get()) return 'base vide';
      return empreinteDonnees() !== etatLu('empreinte_donnees')
        ? 'les fichiers de donnees/ ont changé' : null;
    },
    apres: () => etatPose('empreinte_donnees', empreinteDonnees()) },
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
      const raison = e.pourquoi ? e.pourquoi() : '';
      if (e.pourquoi && !raison) {
        console.log(`[mrp] ${e.quoi} : inchangé depuis le dernier chargement.`);
        continue;
      }
      execFileSync(process.execPath,
        ['--no-warnings', path.join(__dirname, e.script), ...e.args],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
      // L'empreinte ne se pose qu'APRÈS un import réussi : un fichier
      // malformé doit être réessayé au prochain démarrage, pas oublié.
      if (e.apres) e.apres();
      console.log(`[mrp] ${e.quoi} : chargé${raison ? ` (${raison})` : ''}.`);
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
