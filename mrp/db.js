/**
 * Lasclay — MRP : base de données
 * ---------------------------------------------------------------------------
 * SQLite via `node:sqlite`, intégré à Node 22 : aucune dépendance externe,
 * un seul fichier, transactionnel. Même philosophie que le reste du dépôt.
 *
 * Le fichier vit dans MRP_DB (défaut ./data/mrp.db). Sur Render, pointer cette
 * variable vers un disque persistant, sinon la base disparaît au redéploiement.
 */
'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const CHEMIN = process.env.MRP_DB || path.join(__dirname, 'data', 'mrp.db');
fs.mkdirSync(path.dirname(CHEMIN), { recursive: true });

const db = new DatabaseSync(CHEMIN);
db.exec('PRAGMA journal_mode = WAL');      // lectures concurrentes pendant l'écriture
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS utilisateurs (
  id            INTEGER PRIMARY KEY,
  courriel      TEXT NOT NULL UNIQUE,
  mdp_hash      TEXT NOT NULL,
  nom           TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'atelier'   -- 'admin' | 'atelier'
                CHECK (role IN ('admin','atelier')),
  actif         INTEGER NOT NULL DEFAULT 1,
  cree_le       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  jeton         TEXT PRIMARY KEY,
  utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  cree_le       TEXT NOT NULL DEFAULT (datetime('now')),
  expire_le     TEXT NOT NULL
);

-- ------------------------------------------------------------------ produits
CREATE TABLE IF NOT EXISTS produits (
  id            INTEGER PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  nom           TEXT NOT NULL,
  description   TEXT DEFAULT '',      -- c'est quoi
  usage         TEXT DEFAULT '',      -- à quoi ça sert, comment ça s'utilise
  notes_tech    TEXT DEFAULT '',      -- sens de coupe, contraintes, particularités
  actif         INTEGER NOT NULL DEFAULT 1,
  cree_le       TEXT NOT NULL DEFAULT (datetime('now')),
  maj_le        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS produit_photos (
  id            INTEGER PRIMARY KEY,
  produit_id    INTEGER NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'studio' CHECK (type IN ('studio','contexte')),
  legende       TEXT DEFAULT '',
  rang          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS produit_materiaux (
  id            INTEGER PRIMARY KEY,
  produit_id    INTEGER NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,
  detail        TEXT DEFAULT '',
  rang          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS produit_patrons (
  id            INTEGER PRIMARY KEY,
  produit_id    INTEGER NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,
  url           TEXT DEFAULT '',
  format        TEXT DEFAULT '',      -- pdf | ai | dxf | hpgl
  dimensions    TEXT DEFAULT '',      -- ex. « 67,9 x 52,1 cm »
  note          TEXT DEFAULT '',
  rang          INTEGER NOT NULL DEFAULT 0
);

-- --------------------------------------------------- ordres de production
CREATE TABLE IF NOT EXISTS ordres (
  id            INTEGER PRIMARY KEY,
  numero        TEXT NOT NULL UNIQUE,
  titre         TEXT NOT NULL,
  statut        TEXT NOT NULL DEFAULT 'planifie'
                CHECK (statut IN ('brouillon','planifie','en_cours','termine','annule')),
  note          TEXT DEFAULT '',
  cree_par      INTEGER REFERENCES utilisateurs(id),
  cree_le       TEXT NOT NULL DEFAULT (datetime('now')),
  maj_le        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ordre_items (
  id            INTEGER PRIMARY KEY,
  ordre_id      INTEGER NOT NULL REFERENCES ordres(id) ON DELETE CASCADE,
  produit_id    INTEGER NOT NULL REFERENCES produits(id),
  quantite      INTEGER NOT NULL CHECK (quantite > 0),
  avancement    INTEGER NOT NULL DEFAULT 0
                CHECK (avancement BETWEEN 0 AND 100 AND avancement % 10 = 0),
  note          TEXT DEFAULT '',
  rang          INTEGER NOT NULL DEFAULT 0,
  maj_le        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- cédule : dates de livraison, deadlines, événements, préventes
CREATE TABLE IF NOT EXISTS ordre_jalons (
  id            INTEGER PRIMARY KEY,
  ordre_id      INTEGER NOT NULL REFERENCES ordres(id) ON DELETE CASCADE,
  titre         TEXT NOT NULL,
  date          TEXT NOT NULL,        -- AAAA-MM-JJ
  type          TEXT NOT NULL DEFAULT 'deadline'
                CHECK (type IN ('livraison','deadline','evenement','prevente')),
  note          TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS ordre_commentaires (
  id            INTEGER PRIMARY KEY,
  ordre_id      INTEGER NOT NULL REFERENCES ordres(id) ON DELETE CASCADE,
  utilisateur_id INTEGER REFERENCES utilisateurs(id),
  texte         TEXT NOT NULL,
  cree_le       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- trace de chaque mise à jour d'avancement : qui, quand, de combien à combien
CREATE TABLE IF NOT EXISTS avancement_historique (
  id            INTEGER PRIMARY KEY,
  item_id       INTEGER NOT NULL REFERENCES ordre_items(id) ON DELETE CASCADE,
  utilisateur_id INTEGER REFERENCES utilisateurs(id),
  avant         INTEGER NOT NULL,
  apres         INTEGER NOT NULL,
  cree_le       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_ordre    ON ordre_items(ordre_id);
CREATE INDEX IF NOT EXISTS idx_jalons_ordre   ON ordre_jalons(ordre_id);
CREATE INDEX IF NOT EXISTS idx_jalons_date    ON ordre_jalons(date);
CREATE INDEX IF NOT EXISTS idx_comm_ordre     ON ordre_commentaires(ordre_id);
CREATE INDEX IF NOT EXISTS idx_hist_item      ON avancement_historique(item_id);
CREATE INDEX IF NOT EXISTS idx_photos_produit ON produit_photos(produit_id);
`;
db.exec(SCHEMA);

/** Numéro d'ordre séquentiel : OP-2026-0001 */
function prochainNumero() {
  const an = new Date().getFullYear();
  const r = db.prepare(
    `SELECT numero FROM ordres WHERE numero LIKE ? ORDER BY numero DESC LIMIT 1`
  ).get(`OP-${an}-%`);
  const n = r ? parseInt(r.numero.slice(-4), 10) + 1 : 1;
  return `OP-${an}-${String(n).padStart(4, '0')}`;
}

/**
 * Avancement global d'un ordre, PONDÉRÉ PAR LES QUANTITÉS.
 * 2000 cache-cous à 50 % ne pèsent pas comme 10 tuques à 100 %.
 */
function avancementOrdre(ordreId) {
  const r = db.prepare(`
    SELECT COALESCE(SUM(quantite * avancement), 0) AS num,
           COALESCE(SUM(quantite), 0)              AS den,
           COUNT(*)                                AS n
    FROM ordre_items WHERE ordre_id = ?`).get(ordreId);
  return { pct: r.den ? Math.round(r.num / r.den) : 0, items: r.n };
}

module.exports = { db, prochainNumero, avancementOrdre, CHEMIN };
