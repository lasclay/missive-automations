-- =====================================================================
-- Lasclay MRP — schéma de données v0.1  (PostgreSQL)
-- Dérivé de la Charte produits Lasclay (Miro, 64 frames, 26 produits)
--
-- Principes retenus
--   1. Tout est un « item » : matière, composant, étiquette, emballage,
--      semi-fini et produit fini. C'est ce qui rend la nomenclature
--      multi-niveaux possible sans table spéciale.
--   2. Une variante vendable = taille × couleur. Aucun autre axe.
--   3. Une ligne de nomenclature peut être portée par une taille et/ou
--      une couleur. C'est ce qui encode « le vert est en 12 oz, le reste
--      en 10 oz » et « la taille XL consomme plus de shell ».
--   4. Le patron est une entité à part : il est partagé entre produits.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- Référentiels
-- ---------------------------------------------------------------------

CREATE TABLE uom (
  code        text PRIMARY KEY,           -- 'm', 'm2', 'g', 'kg', 'pce', 'cm'
  libelle     text NOT NULL,
  dimension   text NOT NULL               -- 'longueur','surface','masse','unite'
);

CREATE TABLE site (
  id          serial PRIMARY KEY,
  code        text UNIQUE NOT NULL,       -- 'TUN', 'CHN', 'CAN', 'ENTREPOT_QC'
  nom         text NOT NULL,
  pays        text NOT NULL,
  type        text NOT NULL               -- 'production','sous_traitant','entrepot'
    CHECK (type IN ('production','sous_traitant','entrepot')),
  actif       boolean NOT NULL DEFAULT true
);

CREATE TABLE echelle_taille (
  id          serial PRIMARY KEY,
  code        text UNIQUE NOT NULL,       -- 'VET_FEMME','VET_HOMME','UNISEXE_XS_XL',
  nom         text NOT NULL               -- 'SM_ML','POINTURE','UNIQUE','ENFANT'
);

CREATE TABLE taille (
  id          serial PRIMARY KEY,
  echelle_id  int NOT NULL REFERENCES echelle_taille(id),
  code        text NOT NULL,              -- 'XS','S','M','s/m','9F','Standard','Petit enfant'
  ordre       int NOT NULL,
  UNIQUE (echelle_id, code)
);

CREATE TABLE couleur (
  id          serial PRIMARY KEY,
  code        text UNIQUE NOT NULL,       -- 'NOIR','ROUGE','VERT','GRIS_PALE','CARAMEL'
  nom_fr      text NOT NULL,
  nom_en      text,
  hex         char(7) NOT NULL            -- '#1a1a1a'
);

-- Le patron est partagé : « Patron mitaine plein air » sert à la mitaine
-- plein air ET à la mitaine de cuir. C'est une ressource, pas un attribut.
CREATE TABLE patron (
  id          serial PRIMARY KEY,
  code        text UNIQUE NOT NULL,
  nom         text NOT NULL,              -- 'Patron mitaine plein air'
  echelle_id  int REFERENCES echelle_taille(id),
  fichier_dxf text,                       -- lien vers le DXF / HPGL
  version     text,
  notes       text
);

-- ---------------------------------------------------------------------
-- Items : matières, composants, semi-finis, produits finis
-- ---------------------------------------------------------------------

CREATE TABLE item (
  id             serial PRIMARY KEY,
  sku            text UNIQUE NOT NULL,
  type           text NOT NULL
    CHECK (type IN ('matiere','composant','isolant','etiquette','emballage',
                    'semi_fini','produit_fini')),
  nom            text NOT NULL,
  uom_stock      text NOT NULL REFERENCES uom(code),
  -- approvisionnement
  mode           text NOT NULL DEFAULT 'achete'
    CHECK (mode IN ('achete','fabrique','sous_traite')),
  actif          boolean NOT NULL DEFAULT true,
  -- attributs libres : grammage, oz de coton, maille de fermeture éclair,
  -- longueur, dimensions d'étiquette…
  attributs      jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes          text
);
CREATE INDEX ON item (type);
CREATE INDEX ON item USING gin (attributs);

COMMENT ON COLUMN item.attributs IS
  'Ex. isolant : {"famille":"vegeto","grammage_g":200}
   Ex. coton   : {"once":12}
   Ex. zip     : {"type":"spirale","maille":5,"separable":true,"longueur_cm":47}';

-- ---------------------------------------------------------------------
-- Produits et variantes vendables
-- ---------------------------------------------------------------------

CREATE TABLE produit (
  id                 serial PRIMARY KEY,
  code               text UNIQUE NOT NULL,   -- 'manteau-hiver'
  nom_fr             text NOT NULL,
  nom_en             text,
  famille            text NOT NULL,          -- 'Vêtements','Mitaines','Sacs','Camping','Literie'
  patron_id          int REFERENCES patron(id),
  echelle_id         int NOT NULL REFERENCES echelle_taille(id),
  shopify_product_id bigint,
  -- traçabilité vers la charte
  frame_fiche        int,
  frame_qc           int,
  frame_etiquette    int,
  actif              boolean NOT NULL DEFAULT true
);

-- Une variante = taille × couleur, et c'est un item de type produit_fini.
CREATE TABLE variante (
  id                 serial PRIMARY KEY,
  produit_id         int NOT NULL REFERENCES produit(id),
  taille_id          int NOT NULL REFERENCES taille(id),
  couleur_id         int NOT NULL REFERENCES couleur(id),
  item_id            int NOT NULL UNIQUE REFERENCES item(id),
  shopify_variant_id bigint,
  actif              boolean NOT NULL DEFAULT true,
  UNIQUE (produit_id, taille_id, couleur_id)
);

-- Toutes les combinaisons taille × couleur n'existent pas : le cache-cou
-- petit enfant n'est offert qu'en noir. On ne crée que les lignes réelles,
-- donc l'absence de ligne EST la règle d'exclusion.

-- ---------------------------------------------------------------------
-- Nomenclature multi-niveaux
-- ---------------------------------------------------------------------

CREATE TABLE nomenclature (
  id          serial PRIMARY KEY,
  item_id     int NOT NULL REFERENCES item(id),   -- ce qu'on fabrique
  site_id     int REFERENCES site(id),            -- NULL = tous sites
  version     int NOT NULL DEFAULT 1,
  valide_du   date NOT NULL DEFAULT CURRENT_DATE,
  valide_au   date,
  UNIQUE (item_id, site_id, version)
);

-- Une ligne peut être portée par une taille et/ou une couleur.
-- Résolution : pour un `role` donné, la ligne la plus spécifique gagne
-- (taille+couleur > couleur > taille > générique).
CREATE TABLE nomenclature_ligne (
  id               serial PRIMARY KEY,
  nomenclature_id  int NOT NULL REFERENCES nomenclature(id) ON DELETE CASCADE,
  role             text NOT NULL,        -- 'Extérieur','Intérieur','Poche','Col',
                                         -- 'Isolant','Fermeture éclair avant','Étiquette'…
  composant_id     int NOT NULL REFERENCES item(id),
  quantite         numeric(12,4) NOT NULL,
  uom              text NOT NULL REFERENCES uom(code),
  perte_pct        numeric(5,2) NOT NULL DEFAULT 0,   -- chutes de coupe
  scope_taille_id  int REFERENCES taille(id),         -- NULL = toutes tailles
  scope_couleur_id int REFERENCES couleur(id),        -- NULL = toutes couleurs
  notes            text
);
CREATE INDEX ON nomenclature_ligne (nomenclature_id, role);

COMMENT ON TABLE nomenclature_ligne IS
  'Deux usages du scope :
   (a) SUBSTITUTION — role=''Extérieur'', scope_couleur=Vert → coton 12 oz ;
       même role, scope_couleur=NULL → coton 10 oz. Le vert gagne pour le vert.
   (b) QUANTITÉ PAR TAILLE — role=''Extérieur'', scope_taille=XL → 1.85 m ;
       scope_taille=M → 1.60 m. Indispensable pour un MRP textile crédible.';

-- ---------------------------------------------------------------------
-- Gammes de fabrication
-- ---------------------------------------------------------------------

CREATE TABLE gamme (
  id          serial PRIMARY KEY,
  item_id     int NOT NULL REFERENCES item(id),
  version     int NOT NULL DEFAULT 1,
  UNIQUE (item_id, version)
);

CREATE TABLE operation (
  id            serial PRIMARY KEY,
  gamme_id      int NOT NULL REFERENCES gamme(id) ON DELETE CASCADE,
  sequence      int NOT NULL,
  code          text NOT NULL,          -- 'COUPE','ASSEMBLAGE','PRESSE','REMBOURRAGE','EMBALLAGE'
  libelle       text NOT NULL,
  site_id       int NOT NULL REFERENCES site(id),
  temps_min     numeric(8,2),           -- minutes par unité
  parametres    jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (gamme_id, sequence)
);

COMMENT ON COLUMN operation.parametres IS
  'Ex. presse semelle et coussin thermal : {"temperature_c":170,"duree_s":45}';

-- L''oreiller est le cas qui justifie site_id au niveau de l''opération :
-- enveloppe cousue en Tunisie, rembourrage fait au Canada.

-- ---------------------------------------------------------------------
-- Contrôle qualité (les frames à bandeau jaune)
-- ---------------------------------------------------------------------

CREATE TABLE point_controle (
  id           serial PRIMARY KEY,
  produit_id   int REFERENCES produit(id),
  operation_id int REFERENCES operation(id),
  categorie    text,                    -- 'Fermeture éclair','Étiquette','Assemblage','Emballage'
  libelle      text NOT NULL,
  criticite    text NOT NULL DEFAULT 'normale'
    CHECK (criticite IN ('normale','majeure','bloquante')),
  ordre        int NOT NULL DEFAULT 0,
  CHECK (produit_id IS NOT NULL OR operation_id IS NOT NULL)
);

-- 'bloquante' est réservé aux points où l''erreur détruit le produit ou
-- crée un risque : presser le col avant d''insérer l''isolant (il fond),
-- ne pas comprimer les semelles à l''emballage, aucune pièce détachable
-- sur les produits pour enfants.

-- ---------------------------------------------------------------------
-- Étiquettes et imprimés
-- ---------------------------------------------------------------------

CREATE TABLE imprime (
  id           serial PRIMARY KEY,
  code         text UNIQUE NOT NULL,
  fichier      text NOT NULL,           -- 'LASCLAY_PRINT_Etiquette_ToteBag_133x86mm.pdf'
  type         text NOT NULL
    CHECK (type IN ('etiquette_textile','etiquette_carton','manchon','autre')),
  largeur_mm   numeric(8,2),
  hauteur_mm   numeric(8,2),
  item_id      int REFERENCES item(id)  -- l'étiquette consommée en nomenclature
);

CREATE TABLE produit_imprime (
  produit_id   int NOT NULL REFERENCES produit(id),
  imprime_id   int NOT NULL REFERENCES imprime(id),
  PRIMARY KEY (produit_id, imprime_id)
);

-- ---------------------------------------------------------------------
-- Approvisionnement
-- ---------------------------------------------------------------------

CREATE TABLE fournisseur (
  id           serial PRIMARY KEY,
  code         text UNIQUE NOT NULL,
  nom          text NOT NULL,
  pays         text,
  devise       char(3) NOT NULL DEFAULT 'CAD',
  contact      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE item_fournisseur (
  id             serial PRIMARY KEY,
  item_id        int NOT NULL REFERENCES item(id),
  fournisseur_id int NOT NULL REFERENCES fournisseur(id),
  reference      text,
  prix           numeric(12,4),
  devise         char(3) NOT NULL DEFAULT 'CAD',
  uom_achat      text NOT NULL REFERENCES uom(code),
  facteur_uom    numeric(12,6) NOT NULL DEFAULT 1,  -- uom_achat → uom_stock
  delai_jours    int NOT NULL DEFAULT 0,            -- lead time
  moq            numeric(12,4) NOT NULL DEFAULT 0,
  multiple       numeric(12,4),                     -- incrément de commande
  prefere        boolean NOT NULL DEFAULT false,
  UNIQUE (item_id, fournisseur_id, reference)
);

-- ---------------------------------------------------------------------
-- Stock, demande, planification
-- ---------------------------------------------------------------------

CREATE TABLE stock (
  item_id      int NOT NULL REFERENCES item(id),
  site_id      int NOT NULL REFERENCES site(id),
  quantite     numeric(14,4) NOT NULL DEFAULT 0,
  reserve      numeric(14,4) NOT NULL DEFAULT 0,
  stock_secu   numeric(14,4) NOT NULL DEFAULT 0,
  maj_le       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, site_id)
);

CREATE TABLE mouvement_stock (
  id           bigserial PRIMARY KEY,
  item_id      int NOT NULL REFERENCES item(id),
  site_id      int NOT NULL REFERENCES site(id),
  quantite     numeric(14,4) NOT NULL,   -- signé
  type         text NOT NULL
    CHECK (type IN ('reception','consommation','production','vente',
                    'ajustement','transfert','retour')),
  reference    text,                     -- no de commande, de PO, de lot
  date_mvt     timestamptz NOT NULL DEFAULT now(),
  notes        text
);
CREATE INDEX ON mouvement_stock (item_id, date_mvt);

CREATE TABLE demande (
  id           bigserial PRIMARY KEY,
  item_id      int NOT NULL REFERENCES item(id),
  site_id      int REFERENCES site(id),
  origine      text NOT NULL
    CHECK (origine IN ('prevision','commande_client','commande_b2b','transfert','manuel')),
  quantite     numeric(14,4) NOT NULL,
  date_besoin  date NOT NULL,
  reference    text,
  cree_le      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON demande (item_id, date_besoin);

CREATE TABLE calcul_mrp (
  id           bigserial PRIMARY KEY,
  lance_le     timestamptz NOT NULL DEFAULT now(),
  horizon_fin  date NOT NULL,
  parametres   jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE ordre_planifie (
  id             bigserial PRIMARY KEY,
  calcul_id      bigint NOT NULL REFERENCES calcul_mrp(id) ON DELETE CASCADE,
  item_id        int NOT NULL REFERENCES item(id),
  site_id        int REFERENCES site(id),
  type           text NOT NULL CHECK (type IN ('achat','fabrication')),
  quantite       numeric(14,4) NOT NULL,
  date_lancement date NOT NULL,
  date_besoin    date NOT NULL,
  origine_id     bigint REFERENCES ordre_planifie(id),  -- explosion parent → enfant
  niveau         int NOT NULL DEFAULT 0,                -- profondeur dans la nomenclature
  ferme          boolean NOT NULL DEFAULT false
);
CREATE INDEX ON ordre_planifie (calcul_id, item_id);

-- ---------------------------------------------------------------------
-- Vue de service : nomenclature résolue pour une variante donnée
-- « la ligne la plus spécifique gagne, par rôle »
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW v_nomenclature_resolue AS
SELECT DISTINCT ON (v.id, nl.role)
  v.id                AS variante_id,
  v.produit_id,
  nl.role,
  nl.composant_id,
  nl.quantite,
  nl.uom,
  nl.perte_pct,
  nl.quantite * (1 + nl.perte_pct / 100) AS quantite_brute,
  (nl.scope_taille_id  IS NOT NULL)::int
  + (nl.scope_couleur_id IS NOT NULL)::int AS specificite
FROM variante v
JOIN item pf              ON pf.id = v.item_id
JOIN nomenclature n       ON n.item_id = pf.id
                         AND (n.valide_au IS NULL OR n.valide_au >= CURRENT_DATE)
JOIN nomenclature_ligne nl ON nl.nomenclature_id = n.id
WHERE (nl.scope_taille_id  IS NULL OR nl.scope_taille_id  = v.taille_id)
  AND (nl.scope_couleur_id IS NULL OR nl.scope_couleur_id = v.couleur_id)
ORDER BY v.id, nl.role,
         (nl.scope_taille_id IS NOT NULL)::int + (nl.scope_couleur_id IS NOT NULL)::int DESC,
         nl.id;
