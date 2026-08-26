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

-- ----------------------------------------------------------------- matières
-- Les matières premières et fournitures : tissus, isolants, quincaillerie,
-- étiquettes, emballage. C'est l'amont de la production — ce qui se commande,
-- se reçoit, se consomme, et qui manque.
--
-- "suivi_stock = 0" marque les lignes de COÛT qui ne sont pas des matières
-- réelles : « Tissus & autres 3,23 $ » du chiffrier des mitaines agrège une
-- dizaine d'articles sous un seul prix. Elles comptent dans le coût de revient
-- et ne comptent pas dans l'inventaire — leur donner un stock inventerait un
-- article qui n'existe pas en tablette.
CREATE TABLE IF NOT EXISTS matieres (
  id            INTEGER PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  nom           TEXT NOT NULL,
  nom_ar        TEXT DEFAULT '',      -- l'atelier lit l'arabe ; voir README
  categorie     TEXT NOT NULL DEFAULT 'autre'
                CHECK (categorie IN ('tissu','isolant','entoilage','quincaillerie',
                                     'etiquette','fil','emballage','autre')),
  description   TEXT DEFAULT '',
  unite         TEXT NOT NULL DEFAULT 'unite',   -- m, m2, kg, g, pied, pouce, unite
  cout_unite    REAL,                 -- $ CAD par unité ; NULL = inconnu
  fournisseur   TEXT DEFAULT '',
  delai_jours   INTEGER,              -- délai d'approvisionnement observé
  seuil_alerte  REAL NOT NULL DEFAULT 0,
  emplacement   TEXT DEFAULT '',      -- « Atelier Tunisie », « Entrepôt QC »
  suivi_stock   INTEGER NOT NULL DEFAULT 1,
  photo_url     TEXT DEFAULT '',
  note          TEXT DEFAULT '',
  actif         INTEGER NOT NULL DEFAULT 1,
  cree_le       TEXT NOT NULL DEFAULT (datetime('now')),
  maj_le        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- La nomenclature calculable : combien de CETTE matière part dans UN produit.
-- "produit_materiaux" reste à côté, en texte libre, pour ce que la fiche
-- raconte à l'humain. Celle-ci sert au calcul des besoins ; elle a besoin
-- d'un nombre, pas d'une phrase.
--
-- "consommation" est dans l'unité de la matière. "consommation_texte" garde
-- ce que disait le chiffrier — « 2 pads (4,80 pads/m) », « 36,6 g/paire » —
-- parce que c'est ça que l'atelier reconnaît, et parce qu'un nombre déduit
-- sans sa phrase d'origine ne se vérifie plus.
CREATE TABLE IF NOT EXISTS nomenclature (
  id            INTEGER PRIMARY KEY,
  produit_id    INTEGER NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  matiere_id    INTEGER NOT NULL REFERENCES matieres(id) ON DELETE CASCADE,
  consommation  REAL,                 -- par unité de produit fini ; NULL = à établir
  consommation_texte TEXT DEFAULT '',
  cout_par_produit   REAL,            -- $ CAD, tel que posé au chiffrier COGS
  source        TEXT NOT NULL DEFAULT 'chiffrier'
                CHECK (source IN ('chiffrier','deduit','saisi','a_confirmer')),
  note          TEXT DEFAULT '',
  rang          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (produit_id, matiere_id)
);
CREATE INDEX IF NOT EXISTS idx_nomen_produit ON nomenclature(produit_id);
CREATE INDEX IF NOT EXISTS idx_nomen_matiere ON nomenclature(matiere_id);

-- Les mouvements de stock. Le stock N'EST PAS une colonne : c'est la somme de
-- ses mouvements. Une colonne se désynchronise en silence le jour où une
-- écriture oublie de la mettre à jour ; une somme ne peut pas mentir sur son
-- propre historique, et elle répond en plus à « pourquoi il en reste si peu ».
-- Le volume le permet : quelques milliers de lignes par saison.
--
-- Signe : positif = entrée, négatif = sortie. Un ajustement d'inventaire est
-- un mouvement comme un autre — l'écart constaté au comptage, avec son motif.
CREATE TABLE IF NOT EXISTS mouvements (
  id            INTEGER PRIMARY KEY,
  matiere_id    INTEGER REFERENCES matieres(id) ON DELETE CASCADE,
  produit_id    INTEGER REFERENCES produits(id) ON DELETE CASCADE,
  quantite      REAL NOT NULL,        -- signé
  motif         TEXT NOT NULL DEFAULT 'ajustement'
                CHECK (motif IN ('reception','consommation','ajustement',
                                 'production','expedition','perte','inventaire')),
  reference     TEXT DEFAULT '',      -- n° d'ordre, bon de commande, n° de lot
  note          TEXT DEFAULT '',
  utilisateur_id INTEGER REFERENCES utilisateurs(id),
  cree_le       TEXT NOT NULL DEFAULT (datetime('now')),
  -- un mouvement porte sur une matière OU un produit fini, jamais les deux
  CHECK ((matiere_id IS NULL) <> (produit_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_mvt_matiere ON mouvements(matiere_id);
CREATE INDEX IF NOT EXISTS idx_mvt_produit ON mouvements(produit_id);
CREATE INDEX IF NOT EXISTS idx_mvt_date    ON mouvements(cree_le);

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
                CHECK (type IN ('expedition','livraison','deadline',
                                'evenement','prevente')),
  note          TEXT DEFAULT ''
);

-- La répartition d'un item par taille et par coloris. Sans elle, « 3 500
-- cache-cous » ne dit pas quoi couper : c'est 1 285 gris foncé, 1 078 noirs,
-- 473 rouges… L'avancement reste au niveau de l'item — une tranche de 10 %
-- par variante multiplierait la saisie par cinq pour rien.
CREATE TABLE IF NOT EXISTS item_variantes (
  id            INTEGER PRIMARY KEY,
  item_id       INTEGER NOT NULL REFERENCES ordre_items(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,        -- « Gris foncé », « M », « Noir / L »
  quantite      INTEGER NOT NULL CHECK (quantite >= 0),
  rang          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variantes_item ON item_variantes(item_id);

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

-- ------------------------------------------------------------------ assistant
-- Chaque demande faite à l'assistant, avec l'historique de la conversation
-- (JSON des messages) pour pouvoir enchaîner « et pour les mitaines ? ».
CREATE TABLE IF NOT EXISTS agent_tours (
  id            INTEGER PRIMARY KEY,
  utilisateur_id INTEGER REFERENCES utilisateurs(id),
  fil           TEXT NOT NULL,        -- regroupe les tours d'une même conversation
  demande       TEXT NOT NULL,
  reponse       TEXT DEFAULT '',
  messages      TEXT NOT NULL DEFAULT '[]',
  erreur        TEXT DEFAULT '',
  cree_le       TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Journal des écritures faites par l'assistant. Chaque ligne porte de quoi la
-- défaire : l'assistant agit tout de suite, mais rien n'est irréversible.
CREATE TABLE IF NOT EXISTS agent_actions (
  id            INTEGER PRIMARY KEY,
  tour_id       INTEGER NOT NULL REFERENCES agent_tours(id) ON DELETE CASCADE,
  outil         TEXT NOT NULL,
  resume        TEXT NOT NULL,        -- « avancement CC-ADULTE : 40 % → 70 % »
  defaire       TEXT,                 -- JSON {table, op, id, avant|ligne} ; NULL = lecture
  defait        INTEGER NOT NULL DEFAULT 0,
  cree_le       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tours_fil     ON agent_tours(fil);
CREATE INDEX IF NOT EXISTS idx_actions_tour  ON agent_actions(tour_id);
CREATE INDEX IF NOT EXISTS idx_items_ordre    ON ordre_items(ordre_id);
CREATE INDEX IF NOT EXISTS idx_jalons_ordre   ON ordre_jalons(ordre_id);
CREATE INDEX IF NOT EXISTS idx_jalons_date    ON ordre_jalons(date);
CREATE INDEX IF NOT EXISTS idx_comm_ordre     ON ordre_commentaires(ordre_id);
CREATE INDEX IF NOT EXISTS idx_hist_item      ON avancement_historique(item_id);
CREATE INDEX IF NOT EXISTS idx_photos_produit ON produit_photos(produit_id);
`;
db.exec(SCHEMA);

/**
 * Migrations. Le schéma se crée avec CREATE TABLE IF NOT EXISTS, ce qui ne
 * touche jamais une table existante : les colonnes ajoutées après coup doivent
 * l'être ici, en ignorant l'erreur si elles sont déjà là.
 */
for (const sql of [
  `ALTER TABLE ordre_items ADD COLUMN priorite TEXT NOT NULL DEFAULT 'normale'`,
  `ALTER TABLE produits ADD COLUMN famille TEXT NOT NULL DEFAULT 'autre'`,
  // Tout n'est pas fait en Tunisie : la tuque beanie est tricotée en Chine,
  // seul son bandeau amovible sort de l'atelier. Un produit fabriqué ailleurs
  // n'a rien à faire dans la liste de Montassar — il ne le fabrique pas.
  `ALTER TABLE produits ADD COLUMN fabrication TEXT NOT NULL DEFAULT 'tunisie'`,
  // Stock de produits finis. Le seuil vaut 0 par défaut : tant que personne
  // n'a dit combien il faut en garder, l'app n'a rien à alerter.
  `ALTER TABLE produits ADD COLUMN seuil_alerte REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE produits ADD COLUMN emplacement TEXT NOT NULL DEFAULT ''`,
]) { try { db.exec(sql); } catch { /* colonne déjà présente */ } }

/**
 * Le type « expedition » a été ajouté après coup, et SQLite ne sait pas
 * modifier une contrainte CHECK : il faut reconstruire la table. On ne le fait
 * que si l'ancienne contrainte est encore là.
 */
{
  const t = db.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='ordre_jalons'`).get();
  if (t && !/expedition/.test(t.sql)) {
    db.exec('BEGIN');
    try {
      db.exec(`
        CREATE TABLE ordre_jalons_n (
          id       INTEGER PRIMARY KEY,
          ordre_id INTEGER NOT NULL REFERENCES ordres(id) ON DELETE CASCADE,
          titre    TEXT NOT NULL,
          date     TEXT NOT NULL,
          type     TEXT NOT NULL DEFAULT 'deadline'
                   CHECK (type IN ('expedition','livraison','deadline',
                                   'evenement','prevente')),
          note     TEXT DEFAULT ''
        );
        INSERT INTO ordre_jalons_n SELECT id, ordre_id, titre, date, type, note
          FROM ordre_jalons;
        DROP TABLE ordre_jalons;
        ALTER TABLE ordre_jalons_n RENAME TO ordre_jalons;
        CREATE INDEX IF NOT EXISTS idx_jalons_ordre ON ordre_jalons(ordre_id);
        CREATE INDEX IF NOT EXISTS idx_jalons_date  ON ordre_jalons(date);`);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
}

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


// Ordre de tri des priorités manuelles. « haute » passe devant tout, « basse »
// derrière tout, y compris devant une échéance plus proche : c'est le point
// d'une priorité manuelle — elle doit pouvoir contredire le calendrier.
const RANG_PRIORITE = { haute: 0, normale: 1, basse: 2 };

/**
 * L'ordre des familles de production, tel que posé par la direction :
 * l'hiver d'abord — c'est ce que la prévente d'automne vend —, puis les
 * nouveaux produits, puis les sacs isothermes.
 *
 * Un produit à la fois d'hiver ET nouveau compte comme nouveau : c'est la
 * nouveauté qui porte le risque (échantillon à valider, patron à confirmer),
 * et le chandail — un vêtement d'hiver — a été donné comme exemple de
 * « nouveau ». La famille se change produit par produit dans l'app.
 */
const RANG_FAMILLE = { hiver: 0, nouveau: 1, isotherme: 2, autre: 3 };
const FAMILLES = { hiver: 'Hiver', nouveau: 'Nouveau',
                   isotherme: 'Sacs', autre: 'Autre' };

/**
 * La liste de fabrication : tout ce qui reste à produire, tous ordres
 * confondus, dans l'ordre où s'y mettre.
 *
 * Le tri suit trois clés, dans cet ordre :
 *   1. la priorité posée à la main (haute → normale → basse) ;
 *   2. l'échéance la plus proche de l'ordre — un item sans échéance passe
 *      après tous ceux qui en ont une, il n'est pas urgent par défaut ;
 *   3. la quantité restante, décroissante — à échéance égale, le gros morceau
 *      d'abord, parce que c'est lui qui risque de ne pas rentrer.
 *
 * « Quantité restante » est une estimation : quantité × (100 − avancement).
 * Ce n'est pas un compte de pièces réelles, et c'est assumé — l'avancement est
 * déclaré par tranches de 10 %, pas mesuré.
 */
function listeFabrication({ inclureTermines = false, lieu = 'tunisie' } = {}) {
  const lignes = db.prepare(`
    SELECT i.id, i.ordre_id, i.produit_id, i.quantite, i.avancement, i.note,
           i.priorite, i.maj_le,
           o.numero, o.titre AS ordre_titre, o.statut,
           p.code, p.nom, p.famille, p.fabrication,
           (SELECT MIN(date) FROM ordre_jalons j
             WHERE j.ordre_id = o.id AND j.date >= date('now')) AS echeance,
           (SELECT COUNT(*) FROM ordre_jalons j
             WHERE j.ordre_id = o.id AND j.date < date('now')) AS jalons_passes,
           (SELECT j.titre FROM ordre_jalons j
             WHERE j.ordre_id = o.id AND j.date >= date('now')
             ORDER BY j.date LIMIT 1) AS echeance_titre
    FROM ordre_items i
    JOIN ordres o   ON o.id = i.ordre_id
    JOIN produits p ON p.id = i.produit_id
    WHERE o.statut IN ('planifie','en_cours')
      ${inclureTermines ? '' : 'AND i.avancement < 100'}
      ${lieu ? 'AND p.fabrication = ?' : ''}`).all(...(lieu ? [lieu] : []));

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const jours = (d) => d
    ? Math.round((new Date(d + 'T00:00:00Z') - new Date(aujourdhui + 'T00:00:00Z')) / 86400000)
    : null;

  return lignes.map(l => ({
    ...l,
    // Le retard est un DRAPEAU, pas une échéance. Afficher un jalon vieux de
    // deux ans comme « 730 j de retard » serait exact et inutilisable :
    // l'échéance qui compte reste celle vers laquelle on travaille.
    en_retard: l.jalons_passes > 0,
    jours: jours(l.echeance),
    restant: Math.round(l.quantite * (100 - l.avancement) / 100),
  })).sort((a, b) =>
       RANG_PRIORITE[a.priorite] - RANG_PRIORITE[b.priorite]
       // un ordre en retard passe devant tout ce qui a encore du temps
    || (b.en_retard - a.en_retard)
       // puis la date d'expédition vers le Canada, qui commande tout le reste
    || (a.jours ?? 99999) - (b.jours ?? 99999)
       // à date égale, la hiérarchie des familles
    || (RANG_FAMILLE[a.famille] ?? 3) - (RANG_FAMILLE[b.famille] ?? 3)
    || b.restant - a.restant);
}

/** Les N dernières mises à jour d'avancement, tous ordres confondus. */
function dernieresMaj(limite = 30) {
  return db.prepare(`
    SELECT h.avant, h.apres, h.cree_le,
           u.nom AS auteur, p.code, p.nom, o.numero, o.titre AS ordre_titre,
           i.ordre_id, i.id AS item_id
    FROM avancement_historique h
    JOIN ordre_items i ON i.id = h.item_id
    JOIN ordres o      ON o.id = i.ordre_id
    JOIN produits p    ON p.id = i.produit_id
    LEFT JOIN utilisateurs u ON u.id = h.utilisateur_id
    ORDER BY h.cree_le DESC, h.id DESC LIMIT ?`).all(limite);
}

/**
 * Les items commencés qui ne bougent plus.
 *
 * Un item à 0 % n'est pas « immobile », il n'a pas commencé — c'est la liste
 * de fabrication qui s'en occupe. Ce qu'on cherche ici, c'est le travail
 * entamé puis abandonné : c'est ce qui passe entre les mailles.
 */
function sansMouvement(jours = 7) {
  return db.prepare(`
    SELECT i.id, i.ordre_id, i.quantite, i.avancement, i.maj_le, i.priorite,
           o.numero, o.titre AS ordre_titre, p.code, p.nom,
           CAST(julianday('now') - julianday(i.maj_le) AS INTEGER) AS jours_sans_maj
    FROM ordre_items i
    JOIN ordres o   ON o.id = i.ordre_id
    JOIN produits p ON p.id = i.produit_id
    -- Même périmètre que « À fabriquer » : un ordre encore « planifie » dont
    -- les items avancent est du travail commencé, et son blocage doit se voir.
    -- Exiger 'en_cours' rendait le détecteur muet sur un ordre entier tant que
    -- personne n'avait pensé à changer son statut.
    WHERE o.statut IN ('planifie','en_cours')
      AND i.avancement > 0 AND i.avancement < 100
      AND julianday('now') - julianday(i.maj_le) >= ?
    ORDER BY jours_sans_maj DESC`).all(jours);
}

/**
 * Les lieux de fabrication. `tunisie` est le défaut : c'est l'atelier, et
 * c'est ce que « À fabriquer » veut dire. Ce qui vient d'ailleurs reste au
 * plan et se suit à l'ordre, mais ne s'affiche pas comme du travail à faire.
 */
const LIEUX = { tunisie: 'Tunisie', chine: 'Chine' };

/**
 * Ce qui est au plan mais fabriqué ailleurs. Sert à le dire à l'écran :
 * une ligne qui disparaît d'une liste sans explication est une ligne perdue.
 */
function fabriqueAilleurs() {
  return db.prepare(`
    SELECT i.id, i.quantite, i.avancement, p.code, p.nom, p.fabrication,
           o.numero, i.ordre_id
    FROM ordre_items i
    JOIN ordres o   ON o.id = i.ordre_id
    JOIN produits p ON p.id = i.produit_id
    WHERE o.statut IN ('planifie','en_cours')
      AND i.avancement < 100
      AND p.fabrication <> 'tunisie'
    ORDER BY i.quantite DESC`).all()
    .map(l => ({ ...l, restant: Math.round(l.quantite * (100 - l.avancement) / 100) }));
}

/**
 * La répartition d'un item, avec l'écart au total s'il y en a un.
 * Le chiffrier ne boucle pas toujours : 3 505 en variantes pour 3 500 au plan.
 * On montre les deux plutôt que d'en choisir un — l'écart est l'information.
 */
function variantesItem(itemId) {
  const l = db.prepare(`SELECT nom, quantite FROM item_variantes
                        WHERE item_id = ? ORDER BY rang`).all(itemId);
  if (!l.length) return null;
  const somme = l.reduce((n, v) => n + v.quantite, 0);
  const it = db.prepare(`SELECT quantite FROM ordre_items WHERE id = ?`).get(itemId);
  return { lignes: l, somme, quantite: it ? it.quantite : 0,
           ecart: it ? somme - it.quantite : 0 };
}

/** Progression réalisée sur une fenêtre glissante, par ordre. */
function progressionRecente(jours = 7) {
  return db.prepare(`
    SELECT o.numero, o.titre,
           COUNT(*) AS maj,
           SUM((h.apres - h.avant) * i.quantite / 100.0) AS unites_avancees
    FROM avancement_historique h
    JOIN ordre_items i ON i.id = h.item_id
    JOIN ordres o      ON o.id = i.ordre_id
    WHERE h.cree_le >= datetime('now', ?)
    GROUP BY o.id ORDER BY unites_avancees DESC`).all(`-${jours} days`);
}

/* =========================================================================
 *                              INVENTAIRE
 * ---------------------------------------------------------------------------
 * Trois questions, dans cet ordre d'importance :
 *   1. Qu'est-ce qui va manquer ?      → besoin engagé contre stock
 *   2. Qu'est-ce qui est bas ?         → stock contre seuil
 *   3. Qu'est-ce qu'il me reste ?      → le stock lui-même
 *
 * La première est la seule qui regarde devant. Un seuil d'alerte dit « il en
 * reste peu » sans savoir ce qui s'en vient ; le besoin engagé dit « il en
 * manquera 340 mètres pour finir ce qui est déjà promis ». C'est la deuxième
 * qui fait agir, et c'est pour ça qu'elle passe en premier à l'écran.
 * ========================================================================= */

const CATEGORIES = {
  tissu: 'Tissu', isolant: 'Isolant', entoilage: 'Entoilage',
  quincaillerie: 'Quincaillerie', etiquette: 'Étiquette', fil: 'Fil',
  emballage: 'Emballage', autre: 'Autre',
};

// L'ordre d'affichage suit la nomenclature d'un vêtement : ce qui se coupe,
// ce qui se glisse dedans, ce qui se pose dessus.
const RANG_CATEGORIE = { tissu: 0, isolant: 1, entoilage: 2, quincaillerie: 3,
                         fil: 4, etiquette: 5, emballage: 6, autre: 7 };

const MOTIFS = {
  reception: 'Réception', consommation: 'Consommation', production: 'Production',
  expedition: 'Expédition', ajustement: 'Ajustement', perte: 'Perte',
  inventaire: 'Comptage',
};

/** Les unités qu'on rencontre réellement dans les fiches COGS. */
const UNITES = ['m', 'm2', 'kg', 'g', 'pied', 'pouce', 'verge', 'rouleau',
                'paire', 'unite'];

/**
 * L'unité telle qu'on l'écrit, pas telle qu'on la stocke : la base garde des
 * identifiants sans accent ni exposant pour rester saisissables, l'écran doit
 * lire correctement. Seules les unités comptables prennent le pluriel — on ne
 * dit pas « 12 ms ».
 */
const UNITES_AFFICHEES = { m2: ['m²', 'm²'], unite: ['unité', 'unités'],
                           paire: ['paire', 'paires'], pied: ['pied', 'pieds'],
                           pouce: ['pouce', 'pouces'], verge: ['verge', 'verges'],
                           rouleau: ['rouleau', 'rouleaux'] };

function uniteAffichee(unite, n = 1) {
  const f = UNITES_AFFICHEES[unite];
  if (!f) return unite;
  return Math.abs(n) >= 2 ? f[1] : f[0];
}

/** Affiche une quantité sans traîner de décimales inutiles. */
function qte(n, unite = '') {
  if (n === null || n === undefined) return '—';
  const a = Math.abs(n);
  const d = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
  const arrondi = Number(n.toFixed(d));
  const t = arrondi.toLocaleString('fr-CA');
  return unite ? `${t} ${uniteAffichee(unite, arrondi)}` : t;
}

/**
 * Le besoin engagé, par matière : ce que les ordres encore ouverts vont
 * consommer. Deux chiffres, parce qu'ils ne répondent pas à la même question —
 * `besoin` est ce qu'il RESTE à consommer (l'avancement déclaré est déjà
 * déduit), `besoin_total` est ce que le plan complet demandait.
 *
 * Les lignes de nomenclature sans consommation chiffrée sont comptées à part
 * plutôt qu'ignorées : une matière dont le besoin est inconnu n'a pas un
 * besoin de zéro, et afficher zéro serait un mensonge tranquille.
 */
function besoinsMatieres() {
  const chiffres = db.prepare(`
    SELECT n.matiere_id,
           SUM(i.quantite * (100 - i.avancement) / 100.0 * n.consommation) AS besoin,
           SUM(i.quantite * n.consommation)                                AS besoin_total,
           COUNT(DISTINCT i.produit_id)                                    AS produits
    FROM ordre_items i
    JOIN ordres o       ON o.id = i.ordre_id
    JOIN nomenclature n ON n.produit_id = i.produit_id
    WHERE o.statut IN ('planifie','en_cours')
      AND i.avancement < 100
      AND n.consommation IS NOT NULL
    GROUP BY n.matiere_id`).all();

  const flous = db.prepare(`
    SELECT n.matiere_id, COUNT(DISTINCT i.produit_id) AS produits
    FROM ordre_items i
    JOIN ordres o       ON o.id = i.ordre_id
    JOIN nomenclature n ON n.produit_id = i.produit_id
    WHERE o.statut IN ('planifie','en_cours')
      AND i.avancement < 100
      AND n.consommation IS NULL
    GROUP BY n.matiere_id`).all();

  const m = new Map();
  for (const r of chiffres)
    m.set(r.matiere_id, { besoin: r.besoin || 0, besoin_total: r.besoin_total || 0,
                          produits: r.produits, produits_flous: 0 });
  for (const r of flous) {
    const e = m.get(r.matiere_id)
           || { besoin: 0, besoin_total: 0, produits: 0, produits_flous: 0 };
    e.produits_flous = r.produits;
    m.set(r.matiere_id, e);
  }
  return m;
}

/** Le stock d'une matière est la somme de ses mouvements, jamais une colonne. */
function stocksMatieres() {
  return new Map(db.prepare(`
    SELECT matiere_id, SUM(quantite) AS stock, COUNT(*) AS n,
           MAX(cree_le) AS dernier
    FROM mouvements WHERE matiere_id IS NOT NULL
    GROUP BY matiere_id`).all().map(r => [r.matiere_id, r]));
}

function stocksProduits() {
  return new Map(db.prepare(`
    SELECT produit_id, SUM(quantite) AS stock, MAX(cree_le) AS dernier
    FROM mouvements WHERE produit_id IS NOT NULL
    GROUP BY produit_id`).all().map(r => [r.produit_id, r]));
}

/**
 * L'état de chaque matière : stock, besoin engagé, manque, seuil.
 *
 * `manque` est le chiffre qui commande tout le reste : ce qu'il faut
 * commander pour finir ce qui est déjà promis. Il ne vaut que si la matière
 * est suivie en stock — une ligne de coût agrégée n'a pas de tablette.
 */
function etatMatieres({ inclureInactives = false } = {}) {
  const lignes = db.prepare(`
    SELECT * FROM matieres ${inclureInactives ? '' : 'WHERE actif = 1'}`).all();
  const stocks = stocksMatieres();
  const besoins = besoinsMatieres();

  return lignes.map(m => {
    const s = stocks.get(m.id);
    const b = besoins.get(m.id) || { besoin: 0, besoin_total: 0,
                                     produits: 0, produits_flous: 0 };
    const stock = s ? s.stock : 0;
    const jamaisCompte = !s;          // aucun mouvement : ce n'est pas « zéro »
    const manque = m.suivi_stock ? Math.max(0, b.besoin - stock) : 0;
    return {
      ...m, stock, jamais_compte: jamaisCompte, dernier_mouvement: s?.dernier || null,
      besoin: b.besoin, besoin_total: b.besoin_total,
      produits: b.produits, produits_flous: b.produits_flous,
      manque,
      cout_manque: manque && m.cout_unite ? manque * m.cout_unite : 0,
      // Sous le seuil sans être en rupture : « il en reste peu », pas « il en
      // manquera ». Un seuil à 0 ne déclenche rien — personne ne l'a posé.
      sous_seuil: Boolean(m.suivi_stock && m.seuil_alerte > 0 && stock <= m.seuil_alerte),
    };
  }).sort((a, b) =>
       (RANG_CATEGORIE[a.categorie] ?? 7) - (RANG_CATEGORIE[b.categorie] ?? 7)
    || a.nom.localeCompare(b.nom, 'fr'));
}

/** L'état des produits finis : ce qui est prêt à expédier, et ce qui est bas. */
function etatProduits() {
  const stocks = stocksProduits();
  return db.prepare(`
    SELECT id, code, nom, famille, seuil_alerte, emplacement, fabrication
    FROM produits WHERE actif = 1 ORDER BY nom`).all().map(p => {
    const s = stocks.get(p.id);
    const stock = s ? s.stock : 0;
    return { ...p, stock, jamais_compte: !s, dernier_mouvement: s?.dernier || null,
             sous_seuil: Boolean(p.seuil_alerte > 0 && stock <= p.seuil_alerte) };
  });
}

/**
 * Ce qui demande une décision, en un appel. Trois familles, du plus urgent au
 * moins : ce qui manquera pour finir, ce qui est bas, ce qui n'a jamais été
 * compté. La troisième n'est pas une alerte de stock — c'est une alerte de
 * données : une matière sans un seul mouvement n'a pas un stock de zéro, elle
 * a un stock inconnu, et les deux ne se traitent pas pareil.
 */
function alertesStock() {
  const mats = etatMatieres();
  const prods = etatProduits();
  return {
    // Une matière jamais comptée est exclue des ruptures, même si son besoin
    // dépasse le zéro qu'on lui suppose. « Il en manquera 1 031 m² » est une
    // affirmation ; sans un seul comptage, on n'en sait rien. La ranger ici
    // ferait de trente-six inconnues trente-six fausses urgences, et l'atelier
    // cesserait de lire la liste — c'est ainsi qu'une alerte meurt.
    ruptures: mats.filter(m => m.manque > 0 && !m.jamais_compte)
                  .sort((a, b) => b.cout_manque - a.cout_manque || b.manque - a.manque),
    bas: mats.filter(m => m.sous_seuil && m.manque === 0 && !m.jamais_compte)
             .sort((a, b) => a.stock - b.stock),
    // Triées par ce que la production leur demande : c'est l'ordre dans lequel
    // aller les compter, le plus engagé d'abord.
    jamais_comptees: mats.filter(m => m.suivi_stock && m.jamais_compte)
      .sort((a, b) => (b.besoin * (b.cout_unite || 0)) - (a.besoin * (a.cout_unite || 0))
                   || b.besoin - a.besoin),
    produits_bas: prods.filter(p => p.sous_seuil),
    // Une matière utilisée par un ordre ouvert sans consommation chiffrée :
    // son besoin ne se calcule pas, donc son manque non plus.
    a_chiffrer: mats.filter(m => m.produits_flous > 0),
  };
}

/** La nomenclature d'un produit, avec l'état de stock de chaque matière. */
function nomenclatureProduit(produitId) {
  const l = db.prepare(`
    SELECT n.*, m.code, m.nom, m.categorie, m.unite, m.cout_unite,
           m.suivi_stock, m.actif AS matiere_active
    FROM nomenclature n JOIN matieres m ON m.id = n.matiere_id
    WHERE n.produit_id = ?`).all(produitId);
  const stocks = stocksMatieres();
  return l.map(x => ({ ...x, stock: stocks.get(x.matiere_id)?.stock ?? 0 }))
          .sort((a, b) =>
               (RANG_CATEGORIE[a.categorie] ?? 7) - (RANG_CATEGORIE[b.categorie] ?? 7)
            || a.rang - b.rang || a.nom.localeCompare(b.nom, 'fr'));
}

/** Les produits qui consomment une matière — l'aval, vu depuis la tablette. */
function produitsUtilisant(matiereId) {
  return db.prepare(`
    SELECT n.consommation, n.consommation_texte, n.cout_par_produit, n.source,
           p.id, p.code, p.nom, p.famille, p.actif
    FROM nomenclature n JOIN produits p ON p.id = n.produit_id
    WHERE n.matiere_id = ? ORDER BY p.actif DESC, p.nom`).all(matiereId);
}

/**
 * Le détail du besoin d'une matière : quel ordre, quel produit, combien.
 * C'est la réponse à « pourquoi il m'en faut 340 mètres ».
 */
function detailBesoin(matiereId) {
  return db.prepare(`
    SELECT o.numero, o.titre AS ordre_titre, i.ordre_id,
           p.code, p.nom, i.quantite, i.avancement, n.consommation,
           i.quantite * (100 - i.avancement) / 100.0                 AS restant,
           i.quantite * (100 - i.avancement) / 100.0 * n.consommation AS besoin
    FROM ordre_items i
    JOIN ordres o       ON o.id = i.ordre_id
    JOIN produits p     ON p.id = i.produit_id
    JOIN nomenclature n ON n.produit_id = i.produit_id AND n.matiere_id = ?
    WHERE o.statut IN ('planifie','en_cours') AND i.avancement < 100
    ORDER BY besoin DESC NULLS LAST, p.nom`).all(matiereId);
}

/** Les derniers mouvements, d'une matière, d'un produit, ou de tout. */
function mouvements({ matiereId = null, produitId = null, limite = 50 } = {}) {
  const ou = matiereId ? 'WHERE mv.matiere_id = ?'
           : produitId ? 'WHERE mv.produit_id = ?' : '';
  const arg = matiereId || produitId;
  return db.prepare(`
    SELECT mv.*, u.nom AS auteur, m.nom AS matiere_nom, m.code AS matiere_code,
           m.unite, p.nom AS produit_nom, p.code AS produit_code
    FROM mouvements mv
    LEFT JOIN utilisateurs u ON u.id = mv.utilisateur_id
    LEFT JOIN matieres m     ON m.id = mv.matiere_id
    LEFT JOIN produits p     ON p.id = mv.produit_id
    ${ou} ORDER BY mv.cree_le DESC, mv.id DESC LIMIT ?`)
    .all(...(arg ? [arg, limite] : [limite]));
}

/**
 * Le coût matière d'un produit, tel que le chiffrier le pose.
 * On additionne `cout_par_produit` plutôt que consommation × prix : c'est le
 * chiffre que la direction a validé, et le recalculer donnerait un troisième
 * nombre à réconcilier pour rien.
 */
function coutMatiere(produitId) {
  const r = db.prepare(`
    SELECT COALESCE(SUM(cout_par_produit), 0) AS cout,
           SUM(CASE WHEN cout_par_produit IS NULL THEN 1 ELSE 0 END) AS sans_cout,
           COUNT(*) AS lignes
    FROM nomenclature WHERE produit_id = ?`).get(produitId);
  return r;
}

module.exports = { db, prochainNumero, avancementOrdre, CHEMIN,
                   listeFabrication, dernieresMaj, sansMouvement,
                   progressionRecente, fabriqueAilleurs, variantesItem,
                   RANG_PRIORITE, RANG_FAMILLE, FAMILLES, LIEUX,
                   CATEGORIES, RANG_CATEGORIE, MOTIFS, UNITES, qte,
                   uniteAffichee,
                   etatMatieres, etatProduits, alertesStock, besoinsMatieres,
                   stocksMatieres, stocksProduits, nomenclatureProduit,
                   produitsUtilisant, detailBesoin, mouvements, coutMatiere };
