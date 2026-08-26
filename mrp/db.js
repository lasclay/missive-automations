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
  -- Le chiffrier croise parfois deux axes : un coloris ET une taille, ou un
  -- genre ET une taille. « groupe » porte le premier, « nom » le second.
  -- Vide quand il n'y a qu'un seul axe.
  groupe        TEXT NOT NULL DEFAULT '',
  nom           TEXT NOT NULL,        -- « Gris foncé », « M », « XL »
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
-- ------------------------------------------------------------ contrôle qualité
-- Le protocole d'un produit : ce qui rate souvent, ce qu'il ne faut pas rater,
-- ce qui se mesure, ce qui se teste.
--
-- Une seule table pour les quatre, parce que ce sont quatre façons de dire la
-- même chose — « voici comment on sait que c'est bon ». Les colonnes de mesure
-- restent vides pour les autres types ; c'est moins coûteux que quatre tables
-- qu'il faudrait rejoindre pour afficher une fiche.
--
-- « consequence » est la colonne qui fait la différence entre une consigne et
-- un protocole : « presser le col avant l'isolant » se discute, « sinon il fond
-- et devient rigide » ne se discute pas.
CREATE TABLE IF NOT EXISTS qc_points (
  id            INTEGER PRIMARY KEY,
  -- NULL = protocole GÉNÉRAL : le point s'applique à tous les produits.
  -- L'emballage, l'étiquetage, la finition ne se réécrivent pas trente fois.
  produit_id    INTEGER REFERENCES produits(id) ON DELETE CASCADE,
  type          TEXT NOT NULL DEFAULT 'critique'
                CHECK (type IN ('critique','probleme','mesure','cyclage','emballage')),
  titre         TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',
  consequence   TEXT NOT NULL DEFAULT '',   -- ce qui arrive si on le rate
  -- mesures : une dimension peut dépendre de la taille, d'où « variante ».
  variante      TEXT NOT NULL DEFAULT '',
  valeur        TEXT NOT NULL DEFAULT '',
  tolerance     TEXT NOT NULL DEFAULT '',
  unite         TEXT NOT NULL DEFAULT '',
  -- Combien de pièces vérifier. Structuré, pas en texte libre : « 1 sur 20 »
  -- ne veut pas dire la même chose sur un lot de 100 et sur un lot de 3 500,
  -- et c'est justement le nombre qu'on veut voir écrit.
  --   tout   toutes les pièces        ratio  1 pièce sur ech_valeur
  --   fixe   ech_valeur pièces        lot    une fois pour le lot
  ech_type      TEXT NOT NULL DEFAULT ''
                CHECK (ech_type IN ('','tout','ratio','fixe','lot')),
  ech_valeur    INTEGER,
  -- texte libre, pour ce qui ne se chiffre pas (« 50 lavages à 30 °C »)
  frequence     TEXT NOT NULL DEFAULT '',
  source        TEXT NOT NULL DEFAULT '',   -- d'où vient la consigne
  rang          INTEGER NOT NULL DEFAULT 0,
  cree_par      INTEGER REFERENCES utilisateurs(id),
  cree_le       TEXT NOT NULL DEFAULT (datetime('now')),
  maj_le        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_qc_produit ON qc_points(produit_id, type, rang);

-- Le protocole appliqué à un lot précis. C'est ce qui transforme une page de
-- consignes en checklist obligatoire : tant qu'un point n'a pas de verdict,
-- l'item ne peut pas être déclaré fini.
--
-- Journal, pas état : chaque vérification s'ajoute, aucune n'écrase la
-- précédente. Le verdict courant est la dernière ligne. C'est plus lourd d'une
-- sous-requête, et ça garde ce qu'une table d'état perdrait — une non-conformité
-- corrigée reste visible, et c'est exactement ce qui nourrit la colonne
-- « problèmes fréquents » du protocole.
CREATE TABLE IF NOT EXISTS qc_controles (
  id            INTEGER PRIMARY KEY,
  item_id       INTEGER NOT NULL REFERENCES ordre_items(id) ON DELETE CASCADE,
  point_id      INTEGER NOT NULL REFERENCES qc_points(id) ON DELETE CASCADE,
  verdict       TEXT NOT NULL CHECK (verdict IN ('conforme','non_conforme')),
  mesure        TEXT NOT NULL DEFAULT '',   -- la valeur relevée, pour une cote
  pieces        INTEGER,                    -- combien de pièces ont été vues
  note          TEXT NOT NULL DEFAULT '',
  utilisateur_id INTEGER REFERENCES utilisateurs(id),
  cree_le       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_qcc_item ON qc_controles(item_id, point_id, id);

-- Ce qui casse, et où. La preuve de terrain qui justifie un point du protocole.
--
-- Un commentaire client, une photo de couture ouverte, un retour d'atelier :
-- c'est de la PREUVE, pas une consigne. Plusieurs bris justifient un même
-- point — d'où une table à part, avec un lien facultatif vers le point qu'ils
-- ont fait écrire. « Sinon la ganse lâche » convainc mal ; « sinon la ganse
-- lâche, 7 signalements » ne se discute pas.
--
-- Aucune photo n'est hébergée ici : une URL, comme partout dans l'app.
CREATE TABLE IF NOT EXISTS qc_bris (
  id            INTEGER PRIMARY KEY,
  produit_id    INTEGER REFERENCES produits(id) ON DELETE CASCADE,
  -- L'endroit sur la pièce : emmanchure, attache de ganse, fond de sac. C'est
  -- ce qui permet de voir qu'une même zone casse sur plusieurs produits.
  zone          TEXT NOT NULL DEFAULT '',
  origine       TEXT NOT NULL DEFAULT 'client'
                CHECK (origine IN ('client','atelier','retour','essai')),
  texte         TEXT NOT NULL DEFAULT '',   -- le commentaire, mot pour mot
  -- Une ou plusieurs adresses, séparées par une espace : un client envoie
  -- souvent trois clichés du même bris — de loin, de près, retourné. Des
  -- ADRESSES, jamais un fichier : l'app n'héberge rien et le CDN de la source
  -- sert les images redimensionnées, ce qui compte sur la ligne tunisienne.
  photo_url     TEXT NOT NULL DEFAULT '',
  survenu_le    TEXT,                       -- AAAA-MM-JJ, quand c'est arrivé
  -- Le point du protocole que ce bris a fait écrire, s'il y en a un. NULL =
  -- personne n'en a encore tiré de consigne : c'est la file de travail.
  point_id      INTEGER REFERENCES qc_points(id) ON DELETE SET NULL,
  -- D'où vient le signalement quand il est importé : « missive:<convId> ».
  -- C'est ce qui rend l'import rejouable — corriger une ligne du TSV et
  -- relancer met à jour au lieu d'empiler un doublon.
  source_ref    TEXT NOT NULL DEFAULT '',
  cree_par      INTEGER REFERENCES utilisateurs(id),
  cree_le       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bris_produit ON qc_bris(produit_id, point_id);
CREATE INDEX IF NOT EXISTS idx_bris_zone    ON qc_bris(zone);

-- ---------------------------------------------------------------------- tâches
-- « Montassar me demande des choses, et vice versa. » Ces demandes-là vivaient
-- dans Missive, dans WhatsApp, ou dans la tête de quelqu'un. Ici elles ont un
-- porteur, un état, et une date.
--
-- Ce n'est PAS une hiérarchie : n'importe qui assigne à n'importe qui, dans les
-- deux sens. Québec ne donne pas d'ordres à l'atelier par ce canal — les deux
-- côtés se demandent des choses.
CREATE TABLE IF NOT EXISTS taches (
  id            INTEGER PRIMARY KEY,
  titre         TEXT NOT NULL,
  details       TEXT NOT NULL DEFAULT '',
  -- qui demande, et à qui. « assigne_a » NULL = personne encore : une tâche
  -- posée sans porteur reste visible plutôt que d'être refusée.
  cree_par      INTEGER REFERENCES utilisateurs(id),
  assigne_a     INTEGER REFERENCES utilisateurs(id),
  statut        TEXT NOT NULL DEFAULT 'a_faire'
                CHECK (statut IN ('a_faire','faite')),
  echeance      TEXT,                 -- AAAA-MM-JJ, facultative
  -- rattachement facultatif : « vérifier le molleton noir » a du sens à côté
  -- de son produit, et l'ouvrir depuis la fiche évite de chercher.
  ordre_id      INTEGER REFERENCES ordres(id) ON DELETE SET NULL,
  produit_id    INTEGER REFERENCES produits(id) ON DELETE SET NULL,
  cree_le       TEXT NOT NULL DEFAULT (datetime('now')),
  faite_le      TEXT,
  faite_par     INTEGER REFERENCES utilisateurs(id)
);
-- La charte produits : de quoi la pièce est faite.
--
-- Pas un protocole — ça, c'est la table qc_points. Ici on décrit : les matières
-- face par face, le grammage d'asclépiade, les fermetures et les sangles, la
-- température de presse. C'est ce qu'on lit AVANT de couper, et ce qui permet
-- de dire qu'une pièce n'est pas conforme au patron plutôt que mal cousue.
--
-- Une ligne = une phrase de la charte. Le format long, plutôt que six colonnes
-- larges, parce que le nombre de matières varie d'un produit à l'autre et
-- qu'une colonne vide sur trente lignes ne raconte rien.
CREATE TABLE IF NOT EXISTS charte (
  id         INTEGER PRIMARY KEY,
  produit_id INTEGER NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  section    TEXT NOT NULL DEFAULT 'matiere'
             CHECK (section IN ('matiere','isolant','garniture','parametre','note')),
  texte      TEXT NOT NULL,
  rang       INTEGER NOT NULL DEFAULT 0,
  source     TEXT NOT NULL DEFAULT 'charte produits',
  cree_le    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_charte_produit ON charte(produit_id, section, rang);

CREATE INDEX IF NOT EXISTS idx_taches_assigne ON taches(assigne_a, statut);
CREATE INDEX IF NOT EXISTS idx_taches_cree    ON taches(cree_par, statut);

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
  `ALTER TABLE item_variantes ADD COLUMN groupe TEXT NOT NULL DEFAULT ''`,
]) { try { db.exec(sql); } catch { /* colonne déjà présente */ } }

/**
 * qc_points a changé de forme : produit_id devient NULLABLE (protocole général),
 * le volet « emballage » s'ajoute, et l'échantillonnage passe du texte libre à
 * deux colonnes. SQLite ne sait modifier ni un NOT NULL ni un CHECK : il faut
 * reconstruire. On ne le fait que si l'ancienne forme est encore là.
 */
{
  const t = db.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='qc_points'`).get();
  if (t && !/emballage/.test(t.sql)) {
    db.exec('BEGIN');
    try {
      db.exec(`
        CREATE TABLE qc_points_n (
          id            INTEGER PRIMARY KEY,
          produit_id    INTEGER REFERENCES produits(id) ON DELETE CASCADE,
          type          TEXT NOT NULL DEFAULT 'critique'
                        CHECK (type IN ('critique','probleme','mesure','cyclage','emballage')),
          titre         TEXT NOT NULL,
          detail        TEXT NOT NULL DEFAULT '',
          consequence   TEXT NOT NULL DEFAULT '',
          variante      TEXT NOT NULL DEFAULT '',
          valeur        TEXT NOT NULL DEFAULT '',
          tolerance     TEXT NOT NULL DEFAULT '',
          unite         TEXT NOT NULL DEFAULT '',
          ech_type      TEXT NOT NULL DEFAULT ''
                        CHECK (ech_type IN ('','tout','ratio','fixe','lot')),
          ech_valeur    INTEGER,
          frequence     TEXT NOT NULL DEFAULT '',
          source        TEXT NOT NULL DEFAULT '',
          rang          INTEGER NOT NULL DEFAULT 0,
          cree_par      INTEGER REFERENCES utilisateurs(id),
          cree_le       TEXT NOT NULL DEFAULT (datetime('now')),
          maj_le        TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO qc_points_n (id, produit_id, type, titre, detail, consequence,
            variante, valeur, tolerance, unite, frequence, source, rang,
            cree_par, cree_le, maj_le)
          SELECT id, produit_id, type, titre, detail, consequence,
                 variante, valeur, tolerance, unite, frequence, source, rang,
                 cree_par, cree_le, maj_le FROM qc_points;
        DROP TABLE qc_points;
        ALTER TABLE qc_points_n RENAME TO qc_points;
        CREATE INDEX IF NOT EXISTS idx_qc_produit ON qc_points(produit_id, type, rang);`);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
}
try { db.exec(`ALTER TABLE qc_controles ADD COLUMN pieces INTEGER`); } catch { /* déjà là */ }
// Le nom d'usage, celui que tout le monde dit : « Manteau 3 saisons ». Le
// champ `nom` porte le titre Shopify, écrit pour vendre — « Manteau hivernal
// isolé à l'asclépiade » — et deux produits différents peuvent y avoir des
// titres qu'on confond. Le nom court vient de correspondances.tsv, qui est la
// liste de production ; il est vide tant que l'import ne l'a pas rempli, et
// l'affichage retombe alors sur `nom`.
try { db.exec(`ALTER TABLE produits ADD COLUMN nom_court TEXT NOT NULL DEFAULT ''`); }
catch { /* déjà là */ }

// Un point de mesure sans schéma se discute : « 24 cm » de quoi à quoi ? Le
// schéma de la charte tranche. Une ADRESSE, comme partout — l'app n'héberge
// rien, et le CDN sert l'image redimensionnée.
try { db.exec(`ALTER TABLE qc_points ADD COLUMN schema_url TEXT NOT NULL DEFAULT ''`); }
catch { /* déjà là */ }

try { db.exec(`ALTER TABLE qc_bris ADD COLUMN source_ref TEXT NOT NULL DEFAULT ''`); }
catch { /* déjà là */ }
// L'index vient APRÈS la colonne : dans le schéma il partirait avant la
// migration et échouerait sur toute base créée avant elle.
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bris_ref ON qc_bris(source_ref)
         WHERE source_ref != ''`);

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
           p.code, ${NOM_PRODUIT} AS nom, p.famille, p.fabrication,
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
           u.nom AS auteur, p.code, ${NOM_PRODUIT} AS nom, o.numero, o.titre AS ordre_titre,
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
           o.numero, o.titre AS ordre_titre, p.code, ${NOM_PRODUIT} AS nom,
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
    SELECT i.id, i.quantite, i.avancement, p.code, ${NOM_PRODUIT} AS nom, p.fabrication,
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
  const l = db.prepare(`SELECT groupe, nom, quantite FROM item_variantes
                        WHERE item_id = ? ORDER BY rang`).all(itemId);
  if (!l.length) return null;
  const somme = l.reduce((n, v) => n + v.quantite, 0);
  const it = db.prepare(`SELECT quantite FROM ordre_items WHERE id = ?`).get(itemId);

  // Regroupé quand le chiffrier croise deux axes : « Noir » puis ses tailles.
  const groupes = [];
  for (const v of l) {
    const g = groupes.find(x => x.nom === v.groupe);
    if (g) { g.lignes.push(v); g.somme += v.quantite; }
    else groupes.push({ nom: v.groupe, lignes: [v], somme: v.quantite });
  }
  return { lignes: l, groupes, somme, quantite: it ? it.quantite : 0,
           ecart: it ? somme - it.quantite : 0,
           croise: groupes.length > 1 || Boolean(groupes[0] && groupes[0].nom) };
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

// --------------------------------------------------------- contrôle qualité
/** Les quatre volets d'un protocole, dans l'ordre où on les lit à l'atelier. */
const TYPES_QC = {
  critique:  'Points critiques',
  probleme:  'Problèmes fréquents',
  mesure:    'Mesures et dimensions',
  cyclage:   'Cyclage et tests',
  emballage: 'Emballage et finition',
};

/**
 * Combien de pièces vérifier sur un lot, et comment le dire.
 *
 * C'est le cœur du « dynamique en fonction du volume » : « 1 sur 20 » ne veut
 * pas dire la même chose sur un lot de 100 et sur un lot de 3 500. La page
 * écrit le nombre, pas la règle — personne ne devrait faire la division en
 * ayant les pièces dans les mains.
 */
function echantillon(point, quantite) {
  const q = Math.max(0, Number(quantite) || 0);
  const n = Number(point.ech_valeur) || 0;
  switch (point.ech_type) {
    case 'tout':
      return { pieces: q, texte: `Toutes les pièces (${q.toLocaleString('fr-CA')})` };
    case 'ratio': {
      if (n < 1) return { pieces: null, texte: '' };
      const p = Math.max(1, Math.ceil(q / n));
      return { pieces: p, ratio: n,
        texte: `${p.toLocaleString('fr-CA')} pièce${p > 1 ? 's' : ''} sur ${
          q.toLocaleString('fr-CA')}`,
        regle: `1 sur ${n}`,
        pct: q ? Math.round((p / q) * 100) : null };
    }
    case 'fixe': {
      if (n < 1) return { pieces: null, texte: '' };
      const p = q ? Math.min(n, q) : n;
      return { pieces: p, texte: `${p.toLocaleString('fr-CA')} pièce${p > 1 ? 's' : ''}`,
        regle: `${n} pièces, quel que soit le volume` };
    }
    case 'lot':
      return { pieces: 1, texte: 'Une fois pour le lot' };
    default:
      return { pieces: null, texte: '' };
  }
}

/**
 * Le nom d'usage d'un produit, dans une requête.
 *
 * `produits.nom` porte le titre Shopify, écrit pour vendre : « Manteau
 * hivernal isolé à l'asclépiade ». `nom_court` porte celui de la liste de
 * production, celui que l'atelier dit : « Manteau 3 saisons ». Partout où on
 * affiche une LIGNE, c'est le second qu'on veut — deux manteaux dont les
 * titres Shopify ne diffèrent que par un mot ne se distinguent pas dans une
 * liste. Le titre Shopify reste sur la fiche, qui montre les deux.
 */
const NOM_PRODUIT = `COALESCE(NULLIF(p.nom_court, ''), p.nom)`;

/** Le protocole d'un produit, groupé par volet. */
function protocole(produitId, { generalCompris = true } = {}) {
  const l = db.prepare(
    `SELECT q.*, u.nom AS auteur FROM qc_points q
       LEFT JOIN utilisateurs u ON u.id = q.cree_par
      WHERE q.produit_id IS ?${generalCompris ? ' OR q.produit_id IS NULL' : ''}
      -- Le général passe en dernier : on lit d'abord ce qui est propre au
      -- produit, l'emballage vient à la fin de toute façon.
      ORDER BY (q.produit_id IS NULL), q.rang, q.id`).all(produitId);
  const par = {};
  for (const cle of Object.keys(TYPES_QC)) par[cle] = [];
  for (const q of l) (par[q.type] ||= []).push(q);
  return { points: l, par, total: l.length };
}

/** Les libellés des sections de la charte, dans l'ordre où on les lit. */
const SECTIONS_CHARTE = {
  matiere:   'Matières',
  isolant:   'Isolant',
  garniture: 'Garnitures',
  parametre: 'Réglages',
  note:      'À savoir',
};

/**
 * La charte d'un produit, groupée par section.
 *
 * L'ordre des sections est celui de la fabrication, pas l'alphabet : on choisit
 * la matière, on pose l'isolant, on monte les garnitures, on règle la presse.
 * `vide` évite au gabarit d'avoir à compter lui-même.
 */
function charteProduit(produitId) {
  const l = db.prepare(
    `SELECT * FROM charte WHERE produit_id = ? ORDER BY rang, id`).all(produitId);
  const par = {};
  for (const cle of Object.keys(SECTIONS_CHARTE)) par[cle] = [];
  for (const c of l) (par[c.section] ||= []).push(c);
  return { lignes: l, par, total: l.length, vide: l.length === 0 };
}

/**
 * Lit un tableau de tailles écrit à la main, une ligne par taille :
 *
 *     Homme / S = 102 ± 1,5
 *     Homme / M = 110 +/- 1.5
 *     L         = 118
 *
 * Un tableau de mensurations se recopie d'un chiffrier ; le saisir taille par
 * taille dans un formulaire à douze champs, personne ne le fera deux fois.
 * Le « ± » s'écrit aussi « +/- », et la virgule décimale est acceptée telle
 * quelle — c'est comme ça qu'on écrit un nombre ici.
 */
function lireTableauTailles(texte) {
  const lignes = String(texte || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = [], rejets = [];
  for (const l of lignes) {
    const m = l.match(/^(.+?)\s*[=:]\s*(.+)$/);
    if (!m) { rejets.push(l); continue; }
    const taille = m[1].trim();
    // On coupe sur ± ou +/-, le reste est la tolérance.
    const v = m[2].split(/\s*(?:±|\+\/-)\s*/);
    const valeur = (v[0] || '').trim();
    if (!taille || !valeur) { rejets.push(l); continue; }
    out.push({ taille, valeur, tolerance: (v[1] || '').trim() });
  }
  return { lignes: out, rejets };
}

/**
 * Les bris signalés sur un produit, du plus récent au plus ancien.
 * `orphelins` = ceux dont personne n'a encore tiré de consigne.
 */
function brisProduit(produitId) {
  const l = db.prepare(`
    SELECT b.*, u.nom AS auteur, q.titre AS point_titre
      FROM qc_bris b
      LEFT JOIN utilisateurs u ON u.id = b.cree_par
      LEFT JOIN qc_points q    ON q.id = b.point_id
     WHERE b.produit_id IS ?
     ORDER BY COALESCE(b.survenu_le, b.cree_le) DESC, b.id DESC`).all(produitId);
  // Les zones, comptées et triées : c'est la lecture utile d'une pile de
  // signalements. Dix fois « couture de bretelle » ne se voit pas en lisant
  // dix commentaires à la file, ça se voit sur une ligne.
  const z = new Map();
  for (const b of l) if (b.zone) {
    const cle = b.zone.toLowerCase();
    z.set(cle, (z.get(cle) || 0) + 1);
  }
  const zones = [...z.entries()].sort((a, b) => b[1] - a[1])
    .map(([zone, n]) => ({ zone, n }));
  return { tous: l, orphelins: l.filter(b => !b.point_id), zones,
           photos: l.filter(b => b.photo_url).length };
}

/** Combien de bris appuient chaque point d'un protocole. */
function brisParPoint(produitId) {
  const out = {};
  for (const r of db.prepare(
    `SELECT point_id, COUNT(*) n FROM qc_bris
      WHERE point_id IS NOT NULL AND produit_id IS ?
      GROUP BY point_id`).all(produitId)) out[r.point_id] = r.n;
  return out;
}

/**
 * Le mur des bris : tout ce que les clients ont dit, groupé par produit.
 *
 * C'est la page que l'atelier regarde. Pas une liste de consignes — des
 * phrases de gens et des photos de pièces cassées. Un ouvrier qui lit « la
 * ganse s'est décousue après trois semaines, je m'en servais tous les jours
 * pour aller travailler » comprend l'enjeu autrement qu'avec « renforcer
 * l'attache ».
 *
 * Les produits avec photos passent devant : c'est ce qui se regarde.
 */
function murDesBris({ produitId = null } = {}) {
  const l = db.prepare(`
    SELECT b.*, p.id AS pid, p.code, ${NOM_PRODUIT} AS produit_nom, q.titre AS point_titre
      FROM qc_bris b
      LEFT JOIN produits p  ON p.id = b.produit_id
      LEFT JOIN qc_points q ON q.id = b.point_id
     WHERE (? IS NULL OR b.produit_id = ?)
     ORDER BY COALESCE(b.survenu_le, b.cree_le) DESC, b.id DESC`)
    .all(produitId, produitId);

  const par = new Map();
  for (const b of l) {
    const cle = b.pid || 0;
    if (!par.has(cle)) par.set(cle, {
      id: b.pid, code: b.code || '(produit inconnu)', nom: b.produit_nom || '',
      bris: [], photos: 0, zones: new Map(), sansConsigne: 0 });
    const g = par.get(cle);
    g.bris.push(b);
    if (b.photo_url) g.photos++;
    if (!b.point_id) g.sansConsigne++;
    if (b.zone) g.zones.set(b.zone.toLowerCase(),
      (g.zones.get(b.zone.toLowerCase()) || 0) + 1);
  }
  return [...par.values()]
    .map(g => ({ ...g, zones: [...g.zones.entries()]
      .sort((a, b) => b[1] - a[1]).map(([z, n]) => ({ zone: z, n })) }))
    // Ce qui a des photos d'abord : c'est ce qu'on vient regarder.
    .sort((a, b) => b.photos - a.photos || b.bris.length - a.bris.length);
}

/**
 * Les zones qui cassent le plus, tous produits confondus.
 *
 * C'est la question que les commentaires clients permettent enfin de poser :
 * est-ce que c'est CE produit qui a un problème, ou est-ce que la même couture
 * lâche partout ? Une zone qui revient sur cinq produits n'est pas un défaut
 * de produit, c'est un défaut de méthode.
 */
function zonesFragiles({ limite = 12 } = {}) {
  return db.prepare(`
    SELECT b.zone,
           COUNT(*) AS bris,
           COUNT(DISTINCT b.produit_id) AS produits,
           SUM(CASE WHEN b.point_id IS NULL THEN 1 ELSE 0 END) AS sans_consigne
      FROM qc_bris b
     WHERE b.zone != ''
     GROUP BY LOWER(b.zone)
     ORDER BY bris DESC, produits DESC
     LIMIT ?`).all(limite);
}

/**
 * Les non-conformités relevées à l'atelier sur les lots.
 *
 * Une case « non conforme » cochée par Montassar est une observation de
 * terrain, au même titre qu'un commentaire client — et elle arrive plus tôt.
 * Elle apparaît donc au même endroit.
 */
function nonConformites({ produitId = null, limite = 50 } = {}) {
  return db.prepare(`
    SELECT c.*, q.titre AS point_titre, q.type AS point_type,
           p.id AS produit_id, p.code, ${NOM_PRODUIT} AS produit_nom,
           o.numero, u.nom AS auteur
      FROM qc_controles c
      JOIN qc_points q    ON q.id = c.point_id
      JOIN ordre_items i  ON i.id = c.item_id
      JOIN produits p     ON p.id = i.produit_id
      JOIN ordres o       ON o.id = i.ordre_id
      LEFT JOIN utilisateurs u ON u.id = c.utilisateur_id
     WHERE c.verdict = 'non_conforme'
       AND (? IS NULL OR p.id = ?)
       -- seulement si c'est encore le dernier mot sur ce point pour ce lot
       AND c.id = (SELECT MAX(x.id) FROM qc_controles x
                    WHERE x.item_id = c.item_id AND x.point_id = c.point_id)
     ORDER BY c.id DESC LIMIT ?`).all(produitId, produitId, limite);
}

/** Les points qui s'appliquent à tous les produits. */
const protocoleGeneral = () => db.prepare(
  `SELECT q.*, u.nom AS auteur FROM qc_points q
     LEFT JOIN utilisateurs u ON u.id = q.cree_par
    WHERE q.produit_id IS NULL ORDER BY q.rang, q.id`).all();

/**
 * L'état de la qualité sur tout le catalogue.
 *
 * Ce qui compte n'est pas le nombre de points mais QUELS produits n'ont rien
 * qui leur soit propre : un protocole vide sur un produit qu'on fabrique à
 * 3 500 unités est l'information la plus utile de la page.
 *
 * On ne compte QUE les points du produit. Le protocole général s'applique
 * partout : l'inclure ferait disparaître le trou qu'on cherche à montrer.
 */
function couvertureQC({ lieu = 'tunisie' } = {}) {
  return db.prepare(`
    SELECT p.id, p.code, ${NOM_PRODUIT} AS nom, p.famille, p.fabrication,
           COUNT(q.id) AS points,
           SUM(CASE WHEN q.type = 'critique' THEN 1 ELSE 0 END) AS critiques,
           SUM(CASE WHEN q.type = 'probleme' THEN 1 ELSE 0 END) AS problemes,
           SUM(CASE WHEN q.type = 'mesure'   THEN 1 ELSE 0 END) AS mesures,
           SUM(CASE WHEN q.type = 'cyclage'  THEN 1 ELSE 0 END) AS cyclages,
           (SELECT SUM(i.quantite) FROM ordre_items i
             JOIN ordres o ON o.id = i.ordre_id
            WHERE i.produit_id = p.id AND o.statut IN ('planifie','en_cours')) AS a_produire
      FROM produits p
      LEFT JOIN qc_points q ON q.produit_id = p.id
     WHERE p.actif = 1 AND p.fabrication = ?
     GROUP BY p.id
     -- Sans protocole d'abord, et parmi ceux-là le plus gros volume en tête :
     -- c'est là que l'absence coûte le plus cher.
     ORDER BY (COUNT(q.id) = 0) DESC, COALESCE(a_produire, 0) DESC, p.code`).all(lieu);
}

/**
 * La checklist d'un item : le protocole du produit, avec le dernier verdict.
 *
 * Dynamique par construction. Le protocole n'est jamais recopié dans le lot :
 * ajouter un point critique le fait apparaître non vérifié sur TOUS les lots en
 * cours, y compris ceux déjà à 90 %. C'est voulu — on vient d'apprendre quelque
 * chose, et les lots en cours sont précisément ceux à qui ça sert.
 */
/**
 * Une variante d'un point correspond-elle à une variante du lot ?
 *
 * Le chiffrier écrit « L » là où le lot écrit « Homme / L » : on accepte les
 * deux, sinon une mesure juste passerait pour une mesure d'une taille absente.
 */
const memeVariante = (etiquette, v) => {
  const a = String(etiquette || '').trim().toLowerCase();
  if (!a) return true;                        // pas de taille = toutes
  const nom = String(v.nom || '').trim().toLowerCase();
  const plein = [v.groupe, v.nom].filter(Boolean).join(' / ').trim().toLowerCase();
  return a === nom || a === plein;
};

function checklistItem(itemId) {
  const it = db.prepare(
    `SELECT i.*, p.code, ${NOM_PRODUIT} AS nom FROM ordre_items i
       JOIN produits p ON p.id = i.produit_id WHERE i.id = ?`).get(itemId);
  if (!it) return null;
  // Les variantes du lot : une mesure de taille L s'échantillonne sur les
  // pièces en L, pas sur le lot entier — et une taille absente du lot n'a
  // aucune mesure à vérifier.
  const variantes = db.prepare(
    `SELECT groupe, nom, quantite FROM item_variantes WHERE item_id = ?`).all(itemId);
  const points = db.prepare(`
    SELECT q.*,
           c.verdict, c.mesure AS releve, c.note AS note_controle,
           c.pieces AS pieces_vues, c.cree_le AS verifie_le, u.nom AS verifie_par
      FROM qc_points q
      LEFT JOIN qc_controles c
        ON c.id = (SELECT MAX(x.id) FROM qc_controles x
                    WHERE x.point_id = q.id AND x.item_id = ?)
      LEFT JOIN utilisateurs u ON u.id = c.utilisateur_id
     WHERE q.produit_id IS ? OR q.produit_id IS NULL
     ORDER BY (q.produit_id IS NULL), q.rang, q.id`).all(itemId, it.produit_id)
    // L'échantillon se calcule ici, contre la quantité de CE lot : c'est ce qui
    // rend la consigne utilisable sans faire de division.
    .map(q => {
      // Combien de pièces ce point concerne : celles de sa taille s'il en vise
      // une, sinon tout le lot.
      const cible = q.variante && variantes.length
        ? variantes.filter(v => memeVariante(q.variante, v))
        : null;
      const portee = cible ? cible.reduce((n, v) => n + v.quantite, 0) : it.quantite;
      return { ...q, general: q.produit_id === null,
               portee, horsLot: Boolean(cible && !cible.length),
               ech: echantillon(q, portee) };
    })
    // Une taille que ce lot ne produit pas n'a rien à faire dans sa checklist :
    // exiger une mesure sur des pièces qui n'existent pas bloquerait pour rien.
    .filter(q => !q.horsLot);

  const total = points.length;
  const verifies = points.filter(x => x.verdict).length;
  const ecarts = points.filter(x => x.verdict === 'non_conforme');
  const restants = points.filter(x => !x.verdict);
  return { item: it, points, total, verifies,
           ecarts, restants,
           // « Complet » veut dire : tout a un verdict ET aucun n'est en écart.
           complet: total > 0 && !restants.length && !ecarts.length,
           vide: total === 0 };
}

/**
 * Pourquoi un item ne peut pas être déclaré fini, ou null s'il le peut.
 *
 * Le seul endroit où la règle est écrite : le formulaire et l'assistant y
 * passent tous les deux, donc l'un ne peut pas contourner l'autre.
 */
function blocageQC(itemId, valeur) {
  if (Number(valeur) !== 100) return null;
  const c = checklistItem(itemId);
  if (!c || c.vide) return null;          // pas de protocole, rien à exiger
  if (c.ecarts.length)
    return { raison: 'ecart', restants: c.restants.length, ecarts: c.ecarts,
      message: `${c.ecarts.length} non-conformité${c.ecarts.length > 1 ? 's' : ''} `
        + `sur ${c.item.code} : ${c.ecarts.map(x => `« ${x.titre} »`).join(', ')}. `
        + 'Corrige et revérifie avant de déclarer le lot fini.' };
  if (c.restants.length)
    return { raison: 'restants', restants: c.restants.length, ecarts: [],
      message: `${c.restants.length} point${c.restants.length > 1 ? 's' : ''} de `
        + `contrôle qualité pas encore vérifié${c.restants.length > 1 ? 's' : ''} `
        + `sur ${c.item.code} : ${c.restants.map(x => `« ${x.titre} »`).join(', ')}.` };
  return null;
}

/** L'état qualité de chaque item d'un ordre, pour la page de l'ordre. */
function etatQCOrdre(ordreId) {
  const l = db.prepare(`SELECT id FROM ordre_items WHERE ordre_id = ?`).all(ordreId);
  const out = {};
  for (const { id } of l) {
    const c = checklistItem(id);
    out[id] = { total: c.total, verifies: c.verifies,
                ecarts: c.ecarts.length, complet: c.complet, vide: c.vide };
  }
  return out;
}

// ------------------------------------------------------------------- tâches
/**
 * Les tâches, avec les noms des deux personnes concernées.
 *
 * Le tri met devant ce qui a une échéance, la plus proche d'abord ; les
 * sans-date suivent, par ancienneté. Une tâche sans échéance n'est pas
 * urgente, mais elle ne doit pas disparaître pour autant.
 */
const SELECT_TACHE = `
  SELECT t.*,
         d.nom AS demandeur, d.role AS demandeur_role,
         a.nom AS porteur,   a.role AS porteur_role,
         o.numero AS ordre_numero, p.code AS produit_code
    FROM taches t
    LEFT JOIN utilisateurs d ON d.id = t.cree_par
    LEFT JOIN utilisateurs a ON a.id = t.assigne_a
    LEFT JOIN ordres o       ON o.id = t.ordre_id
    LEFT JOIN produits p     ON p.id = t.produit_id`;

const ORDRE_TACHE = `
  ORDER BY CASE WHEN t.echeance IS NULL THEN 1 ELSE 0 END,
           t.echeance, t.id`;

function taches({ pour, par, statut = 'a_faire', limite = 200 } = {}) {
  const ou = ['t.statut = ?'], args = [statut];
  // « pour: null » veut dire « non assignées » — c'est un filtre valide, donc
  // on teste la présence de la clé, pas sa véracité.
  if (pour !== undefined) { ou.push('t.assigne_a IS ?'); args.push(pour); }
  if (par !== undefined) { ou.push('t.cree_par = ?'); args.push(par); }
  return db.prepare(`${SELECT_TACHE} WHERE ${ou.join(' AND ')} ${ORDRE_TACHE}
                     LIMIT ?`).all(...args, limite);
}

const tache = (id) => db.prepare(`${SELECT_TACHE} WHERE t.id = ?`).get(id);

/** Ce qui attend quelqu'un : le chiffre que l'accueil affiche. */
function compteTaches(utilisateurId) {
  const auj = new Date().toISOString().slice(0, 10);
  const r = db.prepare(
    `SELECT COUNT(*) AS n,
            SUM(CASE WHEN echeance IS NOT NULL AND echeance < ? THEN 1 ELSE 0 END) AS retard
       FROM taches WHERE assigne_a = ? AND statut = 'a_faire'`).get(auj, utilisateurId);
  return { n: r.n || 0, retard: r.retard || 0 };
}

/** Les gens à qui on peut assigner : les comptes actifs, soi compris. */
const equipe = () => db.prepare(
  `SELECT id, nom, role FROM utilisateurs WHERE actif = 1 ORDER BY nom`).all();

module.exports = { db, prochainNumero, avancementOrdre, CHEMIN,
                   taches, tache, compteTaches, equipe,
                   protocole, couvertureQC, TYPES_QC, echantillon,
                   charteProduit, SECTIONS_CHARTE,
                   protocoleGeneral, memeVariante, lireTableauTailles,
                   brisProduit, brisParPoint, zonesFragiles, nonConformites,
                   murDesBris,
                   checklistItem, blocageQC, etatQCOrdre,
                   listeFabrication, dernieresMaj, sansMouvement,
                   progressionRecente, fabriqueAilleurs, variantesItem,
                   RANG_PRIORITE, RANG_FAMILLE, FAMILLES, LIEUX };
