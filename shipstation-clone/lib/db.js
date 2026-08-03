/**
 * Base de données du clone — SQLite natif (node:sqlite), aucune dépendance npm.
 *
 * Le schéma reprend le modèle de données relevé sur l'API ShipStation (AUDIT.md §4) et
 * l'étend là où ShipStation ne donnait rien par API : règles d'automatisation, gabarits,
 * lots, vues sauvegardées, permissions, notifications.
 *
 * Choix : les champs de forme libre (adresses, options, articles) sont stockés en JSON dans
 * une colonne texte, avec des colonnes dédiées pour ce sur quoi on filtre et on trie. C'est
 * ce qui permet de garder la souplesse de ShipStation sans 40 tables.
 *
 * Variable : CLONE_DB — chemin du fichier (défaut shipstation-clone/data/clone.db).
 */
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const CHEMIN = process.env.CLONE_DB || path.join(__dirname, "..", "data", "clone.db");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------ référentiels

CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, marketplace TEXT,
  active INTEGER DEFAULT 1, auto_refresh INTEGER DEFAULT 1,
  last_refresh TEXT, settings TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  origin_address TEXT NOT NULL, return_address TEXT, is_default INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS carriers (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, account TEXT,
  balance REAL DEFAULT 0, requires_funding INTEGER DEFAULT 0, active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY, carrier_code TEXT NOT NULL, name TEXT NOT NULL,
  domestic INTEGER DEFAULT 1, international INTEGER DEFAULT 0, drop_off INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY, carrier_code TEXT, name TEXT NOT NULL, domestic INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, color TEXT DEFAULT '#888888'
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE,
  active INTEGER DEFAULT 1, permissions TEXT DEFAULT '{}', created_at TEXT,
  password_hash TEXT,              -- scrypt$N$r$p$sel$clé ; NULL = compte sans accès
  must_change INTEGER DEFAULT 0,   -- mot de passe provisoire, à changer à la connexion
  totp_secret TEXT,                -- secret base32 du second facteur
  totp_enabled INTEGER DEFAULT 0,  -- 1 seulement après vérification d'un premier code
  totp_last_step INTEGER DEFAULT 0,-- dernier pas de temps consommé : empêche le rejeu
  recovery_codes TEXT              -- JSON de codes de secours hachés, à usage unique
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,     -- sha256 du jeton ; le jeton lui-même n'est jamais stocké
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT, last_seen TEXT, expires_at TEXT NOT NULL, ip TEXT, agent TEXT,
  pending INTEGER DEFAULT 0        -- 1 = mot de passe validé, second facteur encore attendu
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, at TEXT, ok INTEGER, ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_attempts ON login_attempts(email, at);

-- ------------------------------------------------------------------ commandes

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL,
  order_key TEXT UNIQUE,                    -- clé externe (upsert par la boutique)
  store_id INTEGER REFERENCES stores(id),
  status TEXT NOT NULL DEFAULT 'awaiting_shipment',
  order_date TEXT, paid_at TEXT, created_at TEXT, modified_at TEXT,
  ship_by_date TEXT, hold_until TEXT,
  customer_id INTEGER, customer_email TEXT, customer_name TEXT,
  bill_to TEXT, ship_to TEXT NOT NULL,      -- JSON Address
  order_total REAL DEFAULT 0, amount_paid REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0, shipping_paid REAL DEFAULT 0,
  customer_notes TEXT, internal_notes TEXT,
  gift INTEGER DEFAULT 0, gift_message TEXT,
  requested_service TEXT,
  carrier_code TEXT, service_id TEXT, package_id TEXT, confirmation TEXT,
  weight_g REAL DEFAULT 0, dimensions TEXT,
  warehouse_id INTEGER REFERENCES warehouses(id),
  insurance TEXT, customs TEXT,             -- JSON
  custom_field1 TEXT, custom_field2 TEXT, custom_field3 TEXT,
  source TEXT, assigned_user TEXT REFERENCES users(id),
  parent_id INTEGER REFERENCES orders(id),  -- scission : la commande d'origine
  merged_into INTEGER REFERENCES orders(id),
  externally_fulfilled INTEGER DEFAULT 0,
  raw TEXT                                  -- payload d'origine, pour ne rien perdre
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  line_key TEXT, sku TEXT, name TEXT, image_url TEXT,
  quantity INTEGER DEFAULT 1, unit_price REAL DEFAULT 0,
  weight_g REAL DEFAULT 0, tax REAL DEFAULT 0,
  warehouse_location TEXT, upc TEXT, product_id INTEGER,
  adjustment INTEGER DEFAULT 0,             -- ligne de remise, pas un article physique
  options TEXT DEFAULT '[]',
  shipment_id INTEGER                       -- scission : à quelle expédition va cette ligne
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_items_sku ON order_items(sku);

CREATE TABLE IF NOT EXISTS order_tags (
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (order_id, tag_id)
);

-- ------------------------------------------------------------------ expéditions

CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, created_at TEXT,
  created_by TEXT REFERENCES users(id),
  status TEXT DEFAULT 'open',               -- open | processing | done | error
  notes TEXT
);

CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES orders(id),
  batch_id INTEGER REFERENCES batches(id),
  label_id TEXT, tracking_number TEXT,
  carrier_code TEXT, service_id TEXT, package_id TEXT, confirmation TEXT,
  cost REAL DEFAULT 0, insurance_cost REAL DEFAULT 0, currency TEXT DEFAULT 'CAD',
  drop_off INTEGER DEFAULT 0,
  ship_date TEXT, created_at TEXT,
  weight_g REAL, dimensions TEXT,
  ship_to TEXT, warehouse_id INTEGER REFERENCES warehouses(id),
  is_return INTEGER DEFAULT 0, voided INTEGER DEFAULT 0, voided_at TEXT,
  marketplace_notified INTEGER DEFAULT 0, notify_error TEXT,
  label_pdf TEXT, customs_pdf TEXT,         -- base64 ou URL
  manifest_id INTEGER, user_id TEXT REFERENCES users(id),
  raw TEXT
);
CREATE INDEX IF NOT EXISTS idx_ship_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_ship_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_ship_date ON shipments(ship_date);

CREATE TABLE IF NOT EXISTS manifests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, carrier_code TEXT, warehouse_id INTEGER,
  created_at TEXT, ship_date TEXT, shipment_count INTEGER DEFAULT 0,
  document TEXT, status TEXT DEFAULT 'created'
);

CREATE TABLE IF NOT EXISTS tracking_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  occurred_at TEXT, status TEXT, description TEXT, location TEXT,
  UNIQUE(shipment_id, occurred_at, status)
);

-- ------------------------------------------------------------------ retours

CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rma TEXT UNIQUE NOT NULL,
  order_id INTEGER REFERENCES orders(id),
  shipment_id INTEGER REFERENCES shipments(id),  -- l'étiquette de retour
  status TEXT DEFAULT 'requested',   -- requested | approved | in_transit | received | refunded | rejected
  reason TEXT, resolution TEXT,      -- refund | exchange | store_credit
  requested_at TEXT, closed_at TEXT, notes TEXT, items TEXT DEFAULT '[]'
);

-- ------------------------------------------------------------------ produits

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE,                  -- identité de la source (productId ShipStation)
  sku TEXT, name TEXT, image_url TEXT, upc TEXT,   -- le SKU manque sur 39 produits, et se répète
  weight_g REAL DEFAULT 0, dimensions TEXT,
  price REAL DEFAULT 0, active INTEGER DEFAULT 1,
  warehouse_location TEXT, category TEXT,
  customs_description TEXT, hs_code TEXT, country_of_origin TEXT DEFAULT 'CA',
  default_carrier TEXT, default_service TEXT, default_package TEXT,
  preset_group_id INTEGER REFERENCES preset_groups(id),
  fulfillment_sku TEXT, is_bundle INTEGER DEFAULT 0, bundle_items TEXT DEFAULT '[]'
);

-- Préréglages d'expédition (§13.5) : une configuration complète enregistrée puis appliquée
-- en masse. Distincts des défauts produit — ceux-ci s'appliquent à l'import, ceux-là à la
-- demande. La colonne hotkey est un ajout : les 17 préréglages du compte ShipStation
-- avaient tous hotKey null, alors que c'était l'accélérateur le plus évident du poste.
CREATE TABLE IF NOT EXISTS shipping_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
  carrier_code TEXT, service_id TEXT, package_id TEXT, confirmation TEXT,
  weight_g REAL, dimensions TEXT, insurance TEXT, warehouse_id INTEGER,
  is_default INTEGER DEFAULT 0, position INTEGER DEFAULT 0,
  hotkey TEXT, notes TEXT
);

-- Alias de SKU : plusieurs SKU de boutiques différentes pointant sur une même fiche produit.
CREATE TABLE IF NOT EXISTS product_aliases (
  alias TEXT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id INTEGER
);

CREATE TABLE IF NOT EXISTS preset_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
  settings TEXT DEFAULT '{}'   -- service, colis, douane appliqués au groupe
);

CREATE TABLE IF NOT EXISTS inventory (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  on_hand INTEGER DEFAULT 0, allocated INTEGER DEFAULT 0, low_threshold INTEGER DEFAULT 0,
  PRIMARY KEY (product_id, warehouse_id)
);

-- ------------------------------------------------------------------ clients

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE, name TEXT, phone TEXT, address TEXT,
  store_id INTEGER, order_count INTEGER DEFAULT 0, total_spent REAL DEFAULT 0,
  first_order TEXT, last_order TEXT, notes TEXT
);

-- ------------------------------------------------------------------ automatisation

CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1, position INTEGER DEFAULT 0,
  match_all INTEGER DEFAULT 1,       -- 1 = toutes les conditions, 0 = au moins une
  conditions TEXT NOT NULL DEFAULT '[]',
  actions TEXT NOT NULL DEFAULT '[]',
  stop_after INTEGER DEFAULT 0,      -- arrêter l'évaluation si la règle s'applique
  run_count INTEGER DEFAULT 0, last_run TEXT
);

CREATE TABLE IF NOT EXISTS views (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  scope TEXT DEFAULT 'orders',       -- orders | shipments | returns | products
  filters TEXT DEFAULT '{}', columns TEXT, sort TEXT,
  owner TEXT REFERENCES users(id), shared INTEGER DEFAULT 1,
  UNIQUE(name, scope)
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  kind TEXT NOT NULL,                -- packing_slip | email | label_message
  body TEXT NOT NULL, is_default INTEGER DEFAULT 0, store_id INTEGER,
  subject TEXT
);

CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, target_url TEXT NOT NULL,
  store_id INTEGER, friendly_name TEXT, active INTEGER DEFAULT 1, created_at TEXT
);

-- Journal de livraison des webhooks (exigences G1 à G3).
-- ShipStation n'offre aucune garantie de redélivrance — « do not assume you will receive
-- every webhook ». Ici chaque tentative est tracée et rejouable : sans journal, un abonné
-- qui a raté un événement n'a aucun moyen de le savoir, ni de le récupérer.
CREATE TABLE IF NOT EXISTS webhook_livraisons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,            -- identifiant d'événement, stable entre les tentatives
  event TEXT NOT NULL,
  payload TEXT NOT NULL,             -- la charge utile COMPLÈTE, telle qu'envoyée
  tentative INTEGER DEFAULT 1,
  statut_http INTEGER, reponse TEXT, erreur TEXT,
  reussi INTEGER DEFAULT 0,
  cree_le TEXT, prochaine_tentative TEXT
);
CREATE INDEX IF NOT EXISTS idx_wl_webhook ON webhook_livraisons(webhook_id, cree_le);
CREATE INDEX IF NOT EXISTS idx_wl_retry ON webhook_livraisons(prochaine_tentative) WHERE reussi = 0;

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, order_id INTEGER, shipment_id INTEGER,
  recipient TEXT, subject TEXT, body TEXT, sent_at TEXT, status TEXT DEFAULT 'queued', error TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, user_id TEXT,
  action TEXT, entity TEXT, entity_id TEXT, detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT
);

-- Correspondance « libellé de service au checkout » → service transporteur (§13.6).
-- Chez ShipStation c'est du texte libre par boutique, et les libellés opérationnels de
-- Lasclay (« Entrepôt Lasclay », « Défricheuses », « DDD », « timbre ») n'y figurent même
-- pas : les règles les rattrapent en recherche de sous-chaîne. Ici le canal logistique est
-- un enum de premier ordre (constat OBS6), et la colonne channel porte cette valeur.
CREATE TABLE IF NOT EXISTS service_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER, requested TEXT NOT NULL, channel TEXT,
  carrier_code TEXT, service_id TEXT, package_id TEXT, confirmation TEXT,
  match_mode TEXT DEFAULT 'contains',   -- contains | equals
  position INTEGER DEFAULT 0,
  UNIQUE(store_id, requested)
);
`;

/**
 * Colonnes ajoutées après coup. `CREATE TABLE IF NOT EXISTS` ne touche pas une table
 * existante : sans ceci, une base créée avant l'authentification resterait sans
 * `password_hash` et le service refuserait toute connexion sans dire pourquoi.
 */
const AJOUTS = [
  ["users", "password_hash", "TEXT"],
  ["users", "must_change", "INTEGER DEFAULT 0"],
  ["users", "totp_secret", "TEXT"],
  ["users", "totp_enabled", "INTEGER DEFAULT 0"],
  ["users", "totp_last_step", "INTEGER DEFAULT 0"],
  ["users", "recovery_codes", "TEXT"],
  ["sessions", "pending", "INTEGER DEFAULT 0"],
  // Règle sans condition : « toutes les commandes », rendu explicite (§12.4, règle 1).
  ["rules", "sans_condition", "INTEGER DEFAULT 0"],
  ["rules", "notes", "TEXT"],
  // Vues : les 27 vues de Lasclay portent des critères d'article, hors de portée de
  // l'ancien objet `filters` qui ne connaissait que les colonnes simples.
  ["views", "criteres", "TEXT"],
  ["views", "match_all", "INTEGER DEFAULT 1"],
  ["views", "position", "INTEGER DEFAULT 0"],
  ["views", "notes", "TEXT"],
  // Référentiels : dimensions des types de colis, code API du service, GUID de boutique.
  ["packages", "dimensions", "TEXT"],
  ["packages", "custom", "INTEGER DEFAULT 0"],
  ["services", "code", "TEXT"],
  ["services", "hidden", "INTEGER DEFAULT 0"],
  ["stores", "guid", "TEXT"],
  // Suivi de l'impression d'étiquette (exigence E3) : imprimée ≠ achetée.
  ["orders", "print_state", "TEXT"],   // bordereau et étiquette imprimés
  // Un lot regroupe des commandes AVANT l'achat des étiquettes : chez ShipStation, la colonne
  // « Batch » de la grille Orders est renseignée bien avant qu'une expédition existe.
  ["orders", "batch_id", "INTEGER"],
  ["shipping_presets", "hotkey", "TEXT"],
  ["shipping_presets", "notes", "TEXT"],
  // Colonnes de la grille Orders de ShipStation (§2.5) qui manquaient encore. Chaque
  // événement sortant est tracé séparément — c'est le modèle de la vue « Shipped » (§3.2),
  // où « bordereau imprimé », « étiquette créée », « étiquette imprimée » et « marketplace
  // notifiée » sont quatre indicateurs distincts, pas un seul champ d'état.
  ["orders", "deliver_by_date", "TEXT"],
  ["orders", "packing_slip_printed_at", "TEXT"],
  ["orders", "pick_list_printed_at", "TEXT"],
  ["orders", "label_printed_at", "TEXT"],
  ["orders", "allocation_status", "TEXT"],     // allocated | partial | unallocated
  ["orders", "picking_status", "TEXT"],        // ready_to_pick | picking | picked
  ["orders", "tote", "TEXT"],
  ["orders", "zone", "INTEGER"],
  ["orders", "shipping_account", "TEXT"],      // my_account | third_party | recipient
  ["orders", "buyer_id", "TEXT"],
  ["orders", "premium_programs", "TEXT"],
  // Secret de signature par abonnement (exigence G2) : rotatif, propre à chaque cible.
  ["webhooks", "secret", "TEXT"],
  // Réconciliation des montants (BUG-016). Sans ces quatre colonnes, une commande remisée
  // ou remboursée affiche des lignes au prix catalogue sous un total à zéro : l'écran se
  // contredit lui-même. La remise et le remboursement sont des montants à part entière,
  // pas des différences à deviner entre le total et la somme des lignes.
  ["orders", "discount_amount", "REAL DEFAULT 0"],
  ["orders", "refunded_amount", "REAL DEFAULT 0"],
  ["order_items", "quantity_ordered", "INTEGER"],   // quantité d'origine ; `quantity` est la courante
  ["order_items", "discount", "REAL DEFAULT 0"],    // remise allouée à la ligne
  // Vérification au poste de scan (BUG-069). L'avancement vivait dans une `Set` en mémoire :
  // un rechargement de page perdait toutes les cases cochées sans un mot.
  ["order_items", "verified_at", "TEXT"],
  ["order_items", "verified_by", "TEXT"],
];

/**
 * `sansaccent(x)` — repli de casse ET de diacritiques, côté SQL.
 *
 * Le moteur de critères normalise le texte en JavaScript (`NFD` puis suppression des marques
 * combinantes) pour que « Défricheuses » corresponde à « defricheuses ». Sans l'équivalent en
 * SQL, la grille et l'évaluateur en mémoire donnent deux résultats différents pour la même vue :
 * c'est exactement le genre d'écart qui rend un moteur de filtres impossible à croire.
 */
function enregistrerFonctions(d) {
  d.function("sansaccent", { deterministic: true, varargs: false },
    (v) => (v == null ? null
      : String(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()));
}
/**
 * Contraintes d'idempotence — § 6.3 étape 0 de l'audit.
 *
 * Sans elles, une migration interrompue puis reprise crée des doublons au lieu de reprendre
 * là où elle s'était arrêtée. La plupart existent déjà en clause `UNIQUE` de colonne
 * (`orders.order_key`, `products.sku`, `customers.email`, `returns.rma`) ; ce qui manquait,
 * c'est l'unicité de `rules.position` — deux règles portaient la position 10, et toute
 * nouvelle règle naissait en collision (BUG-073).
 */
function renumeroterRegles(d) {
  const lignes = d.prepare("SELECT id, position FROM rules ORDER BY position, id").all();
  const doublons = lignes.length !== new Set(lignes.map((r) => r.position)).size;
  if (!doublons) return;
  // Renumérotation par pas de 10 : laisse de la place pour insérer sans tout renuméroter.
  const maj = d.prepare("UPDATE rules SET position = ? WHERE id = ?");
  lignes.forEach((r, i) => maj.run((i + 1) * 10, r.id));
}

/**
 * Identité des produits — BUG-002.
 *
 * `products.sku TEXT UNIQUE NOT NULL` supposait que tout produit a un SKU, et qu'il est
 * unique. Le compte ShipStation dit le contraire : sur 473 produits, **39 n'ont aucun SKU**
 * et une dizaine de SKU sont portés par deux produits. Migrer sous cette contrainte aurait
 * fondu les 39 en un seul et perdu un produit de chaque paire — silencieusement, puisque
 * `sauverProduit` fait un `UPDATE` quand il trouve le SKU.
 *
 * L'identité devient `external_id` (le `productId` de ShipStation) ; le SKU redevient ce
 * qu'il est, un attribut facultatif qui sert au rapprochement quand il existe. La table est
 * reconstruite plutôt qu'altérée : SQLite ne sait pas retirer une contrainte de colonne.
 */
function reconstruireProduits(d) {
  const cols = d.prepare("PRAGMA table_info(products)").all().map((c) => c.name);
  if (cols.includes("external_id")) return;

  // `ALTER TABLE … RENAME` repointerait les clés étrangères des autres tables vers l'ancien
  // nom. On désactive donc la propagation le temps de l'échange, et les clés étrangères
  // pendant la bascule — elles sont revérifiées juste après.
  d.exec("PRAGMA foreign_keys = OFF");
  try {
    d.exec(`
      CREATE TABLE products_nouveau (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        external_id TEXT UNIQUE,           -- productId ShipStation : l'identité réelle
        sku TEXT, name TEXT, image_url TEXT, upc TEXT,
        weight_g REAL DEFAULT 0, dimensions TEXT,
        price REAL DEFAULT 0, active INTEGER DEFAULT 1,
        warehouse_location TEXT, category TEXT,
        customs_description TEXT, hs_code TEXT, country_of_origin TEXT DEFAULT 'CA',
        default_carrier TEXT, default_service TEXT, default_package TEXT,
        preset_group_id INTEGER REFERENCES preset_groups(id),
        fulfillment_sku TEXT, is_bundle INTEGER DEFAULT 0, bundle_items TEXT DEFAULT '[]'
      );
      INSERT INTO products_nouveau (id, sku, name, image_url, upc, weight_g, dimensions, price,
        active, warehouse_location, category, customs_description, hs_code, country_of_origin,
        default_carrier, default_service, default_package, preset_group_id, fulfillment_sku,
        is_bundle, bundle_items)
        SELECT id, sku, name, image_url, upc, weight_g, dimensions, price,
          active, warehouse_location, category, customs_description, hs_code, country_of_origin,
          default_carrier, default_service, default_package, preset_group_id, fulfillment_sku,
          is_bundle, bundle_items FROM products;
      DROP TABLE products;
      ALTER TABLE products_nouveau RENAME TO products;
      CREATE INDEX IF NOT EXISTS ix_products_sku ON products(sku);
    `);
  } finally {
    d.exec("PRAGMA foreign_keys = ON");
  }
  const orphelins = d.prepare("PRAGMA foreign_key_check").all();
  if (orphelins.length) console.warn(`[db] ${orphelins.length} référence(s) orpheline(s) après la reconstruction de products`);
}

function migrer(d) {
  reconstruireProduits(d);
  for (const [table, colonne, type] of AJOUTS) {
    const cols = d.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(colonne)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${colonne} ${type}`);
  }
  try {
    renumeroterRegles(d);
    d.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_rules_position ON rules(position)");
  } catch (e) {
    // Une contrainte impossible à poser ne doit pas empêcher le service de démarrer : on le
    // dit dans les logs, l'exploitant tranche.
    console.warn("[db] unicité des positions de règle non posée :", e.message);
  }
  // Table de suivi de migration : reprise au curseur, § 6.3 étape 1. Une migration de
  // 37 693 clients interrompue à 20 000 doit reprendre à 20 000, pas à zéro.
  d.exec(`CREATE TABLE IF NOT EXISTS migration_suivi (
    objet TEXT PRIMARY KEY,          -- produits | clients | expeditions | retours | …
    curseur TEXT,                    -- dernier identifiant source traité
    lus INTEGER DEFAULT 0, ecrits INTEGER DEFAULT 0, ignores INTEGER DEFAULT 0,
    statut TEXT DEFAULT 'en_attente',-- en_attente | en_cours | termine | echec
    demarre_le TEXT, fini_le TEXT, erreur TEXT
  )`);
}

let _db = null;

/**
 * Ouvre la base, en expliquant la panne la plus probable plutôt qu'en laissant remonter un
 * EACCES nu. Sur Render, `CLONE_DB=/var/data/clone.db` sans disque monté donne exactement ça :
 * le dossier n'existe pas, et le service n'a pas le droit de créer à la racine.
 *
 * On ne se rabat PAS sur un dossier temporaire : ce serait démarrer sur une base vide, effacée
 * au prochain déploiement, sans que personne ne s'en aperçoive avant d'avoir perdu des données.
 */
function db() {
  if (_db) return _db;
  const dossier = path.dirname(CHEMIN);
  try {
    fs.mkdirSync(dossier, { recursive: true });
  } catch (e) {
    {
      const surRender = !!process.env.RENDER || !!process.env.RENDER_SERVICE_ID;
      throw new Error(
        `Impossible de créer « ${dossier} » (${e.code}) — la base ne peut pas être ouverte.\n\n` +
        (surRender
          ? `  Sur Render, cela veut presque toujours dire qu'AUCUN DISQUE n'est monté à cet endroit.\n` +
            `  CLONE_DB vaut « ${CHEMIN} », donc un disque doit exister avec ce Mount Path.\n\n` +
            `  Corriger, au choix :\n` +
            `    • Settings → Disks → Add Disk : Name « donnees », Mount Path « ${dossier} », 1 GB\n` +
            `      (un disque exige l'offre Starter ; le plan gratuit n'en a pas)\n` +
            `    • ou aligner CLONE_DB sur le Mount Path du disque déjà en place\n\n` +
            `  Sans disque, la base serait de toute façon effacée à chaque redéploiement.`
          : `  Vérifier les droits sur ce dossier, ou pointer CLONE_DB ailleurs.`)
      );
    }
  }
  try {
    _db = new DatabaseSync(CHEMIN);
  } catch (e) {
    throw new Error(`Base « ${CHEMIN} » illisible : ${e.message}`);
  }
  _db.exec(SCHEMA);
  migrer(_db);
  enregistrerFonctions(_db);
  return _db;
}

// ------------------------------------------------------------------ aides

/** SELECT renvoyant plusieurs lignes. */
const all = (sql, ...p) => db().prepare(sql).all(...p);
/** SELECT renvoyant une ligne (ou undefined). */
const one = (sql, ...p) => db().prepare(sql).get(...p);
/** INSERT/UPDATE/DELETE — renvoie {changes, lastInsertRowid}. */
const run = (sql, ...p) => db().prepare(sql).run(...p);
/**
 * Exécute une fonction dans une transaction. Réentrant : un `tx` imbriqué ouvre un point de
 * sauvegarde plutôt qu'une seconde transaction — SQLite refuse celles-ci, et les modules
 * s'appellent entre eux (scinder → upsert, importer → upsert).
 */
let _profondeur = 0;
function tx(fn) {
  const d = db();
  const imbrique = _profondeur > 0;
  const point = `sp_${_profondeur}`;
  d.exec(imbrique ? `SAVEPOINT ${point}` : "BEGIN");
  _profondeur++;
  try {
    const r = fn();
    d.exec(imbrique ? `RELEASE ${point}` : "COMMIT");
    return r;
  } catch (e) {
    d.exec(imbrique ? `ROLLBACK TO ${point}; RELEASE ${point}` : "ROLLBACK");
    throw e;
  } finally {
    _profondeur--;
  }
}

/** JSON tolérant : une colonne vide ne doit jamais faire planter une page. */
const parse = (s, defaut = null) => { try { return s ? JSON.parse(s) : defaut; } catch { return defaut; } };
const dump = (o) => (o === undefined || o === null ? null : JSON.stringify(o));

const maintenant = () => new Date().toISOString();

/** Réglage global, avec valeur par défaut. */
function reglage(cle, defaut = null) {
  const r = one("SELECT value FROM settings WHERE key = ?", cle);
  return r ? parse(r.value, r.value) : defaut;
}
function poserReglage(cle, valeur) {
  run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    cle, dump(valeur));
}

/** Journal d'audit — qui a fait quoi. ShipStation n'expose pas ça ; nous si. */
function journaliser(action, entite, entiteId, detail, userId = null) {
  run("INSERT INTO audit_log(at,user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?,?)",
    maintenant(), userId, action, entite, String(entiteId ?? ""), dump(detail));
}

module.exports = { db, all, one, run, tx, parse, dump, maintenant, reglage, poserReglage, journaliser, CHEMIN };
