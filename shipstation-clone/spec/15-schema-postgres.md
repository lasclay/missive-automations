# 15. Schéma relationnel PostgreSQL proposé

> Extrait de la spec ShipStation — Lasclay. Voir `00-INDEX.md` pour la carte complète.
> Libellés d'UI en anglais (langue source du produit). `[à vérifier]` = non confirmé par une source officielle.

# 7. Schéma relationnel proposé (PostgreSQL)

Modèle unifié fusionnant les concepts v1 et v2, conçu pour une application multi‑tenant.

## 7.1 Vue d'ensemble des entités

```
account ─┬─ user
         ├─ store ──┬─ store_status_mapping
         │          └─ store_refresh_log
         ├─ marketplace (référentiel global)
         ├─ warehouse
         ├─ carrier_account ─┬─ carrier_service
         │                   └─ carrier_package_type
         ├─ tag
         ├─ product ─┬─ product_tag
         │           └─ product_category
         ├─ customer ─┬─ customer_marketplace_identity
         │            └─ customer_tag
         ├─ order ─┬─ order_item ── order_item_option
         │         ├─ order_tag
         │         ├─ order_customs_item
         │         └─ order_status_history
         ├─ shipment ─┬─ shipment_package ── package_product
         │            ├─ shipment_item
         │            └─ shipment_customs_item
         ├─ label ─┬─ label_rate_detail
         │         └─ label_refund
         ├─ rate_request ── rate
         ├─ batch ── batch_shipment
         ├─ manifest ── manifest_label
         ├─ tracking_record ── tracking_event
         ├─ return_request ── return_item
         ├─ fulfillment
         ├─ webhook_subscription ── webhook_delivery
         └─ address (partagée / dénormalisée)
```

## 7.2 Types énumérés

```sql
CREATE TYPE order_status AS ENUM (
  'awaiting_payment','awaiting_shipment','pending_fulfillment',
  'shipped','on_hold','cancelled','rejected_fulfillment');

CREATE TYPE shipment_status AS ENUM (
  'pending','processing','label_purchased','cancelled');

CREATE TYPE label_status AS ENUM ('processing','completed','error','voided');

CREATE TYPE batch_status AS ENUM (
  'open','queued','processing','completed','completed_with_errors',
  'archived','notifying','invalid');

CREATE TYPE confirmation_type AS ENUM (
  'none','delivery','signature','adult_signature','direct_signature',
  'delivery_mailed','verbal_confirmation','delivery_code',
  'age_verification_16_plus');

CREATE TYPE weight_unit AS ENUM ('pound','ounce','gram','kilogram');
CREATE TYPE dimension_unit AS ENUM ('inch','centimeter');

CREATE TYPE address_verification_status AS ENUM (
  'unverified','verified','warning','error');

CREATE TYPE residential_indicator AS ENUM ('unknown','yes','no');

CREATE TYPE insurance_provider AS ENUM (
  'none','shipsurance','parcelguard','xcover','carrier','third_party');

CREATE TYPE customs_contents AS ENUM (
  'merchandise','documents','gift','returned_goods','sample',
  'e_commerce_goods','commercial_sale_of_goods_b2b','other');

CREATE TYPE non_delivery_option AS ENUM ('return_to_sender','treat_as_abandoned');

CREATE TYPE label_format AS ENUM ('pdf','png','zpl');
CREATE TYPE label_layout AS ENUM ('4x6','letter');
CREATE TYPE display_scheme AS ENUM ('label','paperless','label_and_paperless');
CREATE TYPE charge_event AS ENUM ('carrier_default','on_creation','on_carrier_acceptance');
CREATE TYPE validate_address_mode AS ENUM ('no_validation','validate_only','validate_and_clean');
CREATE TYPE bill_to_party AS ENUM ('my_account','my_other_account','recipient','third_party');
CREATE TYPE refund_status AS ENUM (
  'request_scheduled','pending','approved','rejected','excluded');
CREATE TYPE tracking_status_code AS ENUM ('UN','AC','IT','DE','EX','AT','NY','SP');
CREATE TYPE rate_response_status AS ENUM ('working','completed','partial','error');
```

## 7.3 Tables — socle

```sql
-- ─────────────── Compte et utilisateurs ───────────────
CREATE TABLE account (
  account_id        bigserial PRIMARY KEY,
  name              text NOT NULL,
  plan_code         text,
  timezone          text NOT NULL DEFAULT 'America/Los_Angeles',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
  user_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        bigint NOT NULL REFERENCES account,
  user_name         text NOT NULL,
  display_name      text,
  email             citext,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_name)
);

-- ─────────────── Référentiel marketplaces ───────────────
CREATE TABLE marketplace (
  marketplace_id            integer PRIMARY KEY,   -- ID stable global
  name                      text NOT NULL,
  order_source_code         text,                  -- enum v2 (§4.10)
  can_refresh               boolean NOT NULL DEFAULT false,
  supports_custom_mappings  boolean NOT NULL DEFAULT false,
  supports_custom_statuses  boolean NOT NULL DEFAULT false,
  can_confirm_shipments     boolean NOT NULL DEFAULT false
);

-- ─────────────── Boutiques ───────────────
CREATE TABLE store (
  store_id            bigserial PRIMARY KEY,
  account_id          bigint NOT NULL REFERENCES account,
  marketplace_id      integer NOT NULL REFERENCES marketplace,
  store_name          text NOT NULL,
  account_name        text,
  integration_url     text,          -- endpoint custom store
  auth_username       text,          -- Basic auth vers le custom store
  auth_password_enc   bytea,         -- chiffré au repos
  active              boolean NOT NULL DEFAULT true,
  auto_refresh        boolean NOT NULL DEFAULT true,
  company_name        text,
  phone               text,
  public_email        citext,
  website             text,
  refresh_date        timestamptz,   -- dernier import réussi
  last_refresh_attempt timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  modified_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON store (account_id, active) WHERE active;

CREATE TABLE store_status_mapping (
  store_id      bigint NOT NULL REFERENCES store ON DELETE CASCADE,
  order_status  order_status NOT NULL,
  status_key    text NOT NULL,       -- sensible à la casse
  PRIMARY KEY (store_id, order_status)
);

CREATE TABLE store_refresh_log (
  refresh_id    bigserial PRIMARY KEY,
  store_id      bigint NOT NULL REFERENCES store,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  window_start  timestamptz,
  window_end    timestamptz,
  pages_fetched integer,
  orders_upserted integer,
  status        text NOT NULL,       -- running | success | failed
  error_message text
);
```

## 7.4 Tables — adresses, entrepôts, transporteurs

```sql
-- Adresse normalisée et réutilisable
CREATE TABLE address (
  address_id        bigserial PRIMARY KEY,
  account_id        bigint NOT NULL REFERENCES account,
  name              text,
  company_name      text,
  phone             text,
  email             citext,
  address_line1     text,
  address_line2     text,
  address_line3     text,
  city_locality     text,
  state_province    text,
  postal_code       text,
  country_code      char(2),
  residential       residential_indicator NOT NULL DEFAULT 'unknown',
  verification_status address_verification_status NOT NULL DEFAULT 'unverified',
  verification_messages jsonb,
  matched_address   jsonb,           -- version normalisée par le validateur
  instructions      text,
  geolocation       jsonb,           -- [{type:'what3words', value:'…'}]
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON address (account_id, postal_code, country_code);

CREATE TABLE warehouse (
  warehouse_id        bigserial PRIMARY KEY,
  account_id          bigint NOT NULL REFERENCES account,
  name                text NOT NULL,
  origin_address_id   bigint NOT NULL REFERENCES address,
  return_address_id   bigint REFERENCES address,
  is_default          boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON warehouse (account_id) WHERE is_default;

CREATE TABLE carrier_account (
  carrier_account_id  bigserial PRIMARY KEY,
  account_id          bigint NOT NULL REFERENCES account,
  carrier_code        text NOT NULL,      -- fedex, ups, stamps_com…
  account_number      text,
  nickname            text,
  friendly_name       text,
  connection_status   text,               -- pending_approval | approved
  requires_funded_amount boolean NOT NULL DEFAULT false,
  balance_amount      numeric(12,2),
  balance_currency    char(3) DEFAULT 'USD',
  funding_source_id   text,
  is_primary          boolean NOT NULL DEFAULT false,
  has_multi_package_supporting_services boolean DEFAULT false,
  supports_label_messages boolean DEFAULT false,
  disabled_by_billing_plan boolean DEFAULT false,
  send_rates          boolean DEFAULT true,
  settings            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, carrier_code, account_number)
);

CREATE TABLE carrier_service (
  carrier_service_id  bigserial PRIMARY KEY,
  carrier_account_id  bigint NOT NULL REFERENCES carrier_account ON DELETE CASCADE,
  service_code        text NOT NULL,
  name                text NOT NULL,
  domestic            boolean NOT NULL DEFAULT true,
  international       boolean NOT NULL DEFAULT false,
  is_multi_package_supported boolean DEFAULT false,
  send_rates          boolean DEFAULT true,
  UNIQUE (carrier_account_id, service_code)
);

CREATE TABLE carrier_package_type (
  package_type_id     bigserial PRIMARY KEY,
  carrier_account_id  bigint REFERENCES carrier_account ON DELETE CASCADE,
  account_id          bigint REFERENCES account,   -- NULL = standard transporteur
  package_code        text NOT NULL,
  name                text NOT NULL,
  domestic            boolean DEFAULT true,
  international       boolean DEFAULT false,
  length numeric(9,2), width numeric(9,2), height numeric(9,2),
  dimension_unit      dimension_unit,
  description         text,
  UNIQUE (carrier_account_id, package_code)
);

CREATE TABLE carrier_funding_transaction (
  transaction_id      bigserial PRIMARY KEY,
  carrier_account_id  bigint NOT NULL REFERENCES carrier_account,
  amount              numeric(12,2) NOT NULL CHECK (amount BETWEEN 10 AND 10000),
  currency            char(3) NOT NULL DEFAULT 'USD',
  balance_after       numeric(12,2),
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

## 7.5 Tables — clients, produits, tags

```sql
CREATE TABLE customer (
  customer_id       bigserial PRIMARY KEY,
  account_id        bigint NOT NULL REFERENCES account,
  name              text,
  company           text,
  email             citext,
  phone             text,
  address_id        bigint REFERENCES address,
  created_at        timestamptz NOT NULL DEFAULT now(),
  modified_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON customer (account_id, email);

-- Déduplication multi-canal : une identité par marketplace
CREATE TABLE customer_marketplace_identity (
  customer_user_id  bigserial PRIMARY KEY,
  customer_id       bigint NOT NULL REFERENCES customer ON DELETE CASCADE,
  marketplace_id    integer NOT NULL REFERENCES marketplace,
  username          text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  modified_at       timestamptz,
  UNIQUE (marketplace_id, username)
);

CREATE TABLE tag (
  tag_id      bigserial PRIMARY KEY,
  account_id  bigint NOT NULL REFERENCES account,
  name        text NOT NULL,
  color       char(7) NOT NULL DEFAULT '#808080'
              CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  UNIQUE (account_id, name)
);

CREATE TABLE customer_tag (
  customer_id bigint REFERENCES customer ON DELETE CASCADE,
  tag_id      bigint REFERENCES tag ON DELETE CASCADE,
  PRIMARY KEY (customer_id, tag_id)
);

CREATE TABLE product_category (
  category_id bigserial PRIMARY KEY,
  account_id  bigint NOT NULL REFERENCES account,
  name        text NOT NULL,
  UNIQUE (account_id, name)
);

CREATE TABLE product (
  product_id            bigserial PRIMARY KEY,
  account_id            bigint NOT NULL REFERENCES account,
  sku                   text NOT NULL,
  name                  text,
  price                 numeric(12,2),
  default_cost          numeric(12,2),
  length numeric(9,2), width numeric(9,2), height numeric(9,2),
  dimension_unit        dimension_unit DEFAULT 'inch',
  weight_value          numeric(10,3),
  weight_unit           weight_unit DEFAULT 'ounce',
  internal_notes        text,
  fulfillment_sku       text,
  active                boolean NOT NULL DEFAULT true,
  category_id           bigint REFERENCES product_category,
  product_type          text,
  warehouse_location    text,
  -- valeurs par défaut d'expédition
  default_carrier_code       text,
  default_service_code       text,
  default_package_code       text,
  default_confirmation       confirmation_type,
  default_intl_carrier_code  text,
  default_intl_service_code  text,
  default_intl_package_code  text,
  default_intl_confirmation  confirmation_type,
  -- douane
  customs_description   text,
  customs_value         numeric(12,2),
  customs_tariff_no     text,
  customs_country_code  char(2),
  no_customs            boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  modified_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, sku)
);

CREATE TABLE product_tag (
  product_id bigint REFERENCES product ON DELETE CASCADE,
  tag_id     bigint REFERENCES tag ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
```

## 7.6 Tables — commandes

```sql
CREATE TABLE "order" (
  order_id              bigserial PRIMARY KEY,
  account_id            bigint NOT NULL REFERENCES account,
  store_id              bigint NOT NULL REFERENCES store,
  order_number          text NOT NULL,
  order_key             text NOT NULL,   -- clé d'idempotence de l'upsert
  external_order_id     text,            -- ID côté canal
  order_date            timestamptz NOT NULL,
  payment_date          timestamptz,
  ship_by_date          timestamptz,
  hold_until_date       date,
  ship_date             date,
  order_status          order_status NOT NULL,
  customer_id           bigint REFERENCES customer,
  customer_username     text,
  customer_email        citext,
  bill_to_address_id    bigint REFERENCES address,
  ship_to_address_id    bigint NOT NULL REFERENCES address,
  -- montants
  currency_code         char(3) NOT NULL DEFAULT 'USD',
  order_total           numeric(12,2),
  amount_paid           numeric(12,2),
  tax_amount            numeric(12,2),
  shipping_amount       numeric(12,2),
  -- notes
  customer_notes        text,
  internal_notes        text,
  is_gift               boolean NOT NULL DEFAULT false,
  gift_message          text,
  payment_method        text,
  requested_shipping_service text,
  -- préférences d'expédition
  carrier_code          text,
  service_code          text,
  package_code          text,
  confirmation          confirmation_type DEFAULT 'none',
  weight_value          numeric(10,3),
  weight_unit           weight_unit,
  dim_length numeric(9,2), dim_width numeric(9,2), dim_height numeric(9,2),
  dim_unit              dimension_unit,
  -- assurance
  insurance_provider    insurance_provider DEFAULT 'none',
  insure_shipment       boolean NOT NULL DEFAULT false,
  insured_value         numeric(12,2),
  -- douane
  customs_contents      customs_contents,
  customs_non_delivery  non_delivery_option,
  -- options avancées
  warehouse_id          bigint REFERENCES warehouse,
  non_machinable        boolean NOT NULL DEFAULT false,
  saturday_delivery     boolean NOT NULL DEFAULT false,
  contains_alcohol      boolean NOT NULL DEFAULT false,
  custom_field1         text,
  custom_field2         text,
  custom_field3         text,
  source                text,
  bill_to_party         bill_to_party,
  bill_to_account       text,
  bill_to_postal_code   text,
  bill_to_country_code  char(2),
  advanced_options      jsonb,           -- déversoir pour les options v2 étendues
  -- fusion / scission
  merged_or_split       boolean NOT NULL DEFAULT false,
  parent_order_id       bigint REFERENCES "order",
  -- assignation et fulfillment externe
  assigned_user_id      uuid REFERENCES app_user,
  externally_fulfilled  boolean NOT NULL DEFAULT false,
  externally_fulfilled_by text,
  externally_fulfilled_by_id bigint,
  externally_fulfilled_by_name text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  modified_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_order_key UNIQUE (store_id, order_key)
);
CREATE INDEX ON "order" (account_id, order_status, modified_at DESC);
CREATE INDEX ON "order" (account_id, order_number);
CREATE INDEX ON "order" (store_id, modified_at);
CREATE INDEX ON "order" (account_id, hold_until_date)
  WHERE order_status = 'on_hold';

CREATE TABLE order_merge (
  parent_order_id bigint REFERENCES "order" ON DELETE CASCADE,
  merged_order_id bigint REFERENCES "order" ON DELETE CASCADE,
  PRIMARY KEY (parent_order_id, merged_order_id)
);

CREATE TABLE order_item (
  order_item_id       bigserial PRIMARY KEY,
  order_id            bigint NOT NULL REFERENCES "order" ON DELETE CASCADE,
  line_item_key       text,
  product_id          bigint REFERENCES product,
  sku                 text,
  name                text NOT NULL,     -- ne peut pas être NULL (contrainte API)
  image_url           text,
  upc                 text,
  quantity            integer NOT NULL CHECK (quantity > 0),
  unit_price          numeric(12,2),
  tax_amount          numeric(12,2),
  shipping_amount     numeric(12,2),
  weight_value        numeric(10,3),
  weight_unit         weight_unit,
  warehouse_location  text,
  fulfillment_sku     text,
  is_adjustment       boolean NOT NULL DEFAULT false,  -- ligne non physique
  created_at          timestamptz NOT NULL DEFAULT now(),
  modified_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, line_item_key)
);
CREATE INDEX ON order_item (order_id);
CREATE INDEX ON order_item (sku);

CREATE TABLE order_item_option (
  option_id     bigserial PRIMARY KEY,
  order_item_id bigint NOT NULL REFERENCES order_item ON DELETE CASCADE,
  name          text NOT NULL,
  value         text NOT NULL,
  weight_value  numeric(10,3)     -- présent dans le XML custom store
);

CREATE TABLE order_tag (
  order_id bigint REFERENCES "order" ON DELETE CASCADE,
  tag_id   bigint REFERENCES tag ON DELETE CASCADE,
  tagged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, tag_id)
);

CREATE TABLE order_customs_item (
  customs_item_id       bigserial PRIMARY KEY,
  order_id              bigint NOT NULL REFERENCES "order" ON DELETE CASCADE,
  order_item_id         bigint REFERENCES order_item,
  description           text,
  quantity              integer NOT NULL,
  value                 numeric(12,2) NOT NULL,
  value_currency        char(3) DEFAULT 'USD',
  harmonized_tariff_code text,
  country_of_origin     char(2),
  unit_of_measure       text,
  sku                   text
);

-- Journal d'audit du cycle de vie
CREATE TABLE order_status_history (
  history_id    bigserial PRIMARY KEY,
  order_id      bigint NOT NULL REFERENCES "order" ON DELETE CASCADE,
  from_status   order_status,
  to_status     order_status NOT NULL,
  reason        text,          -- label_created | hold | restore | import | manual …
  actor_user_id uuid REFERENCES app_user,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON order_status_history (order_id, occurred_at DESC);
```

## 7.7 Tables — expéditions, étiquettes, tarifs

```sql
CREATE TABLE shipment (
  shipment_id          bigserial PRIMARY KEY,
  account_id           bigint NOT NULL REFERENCES account,
  order_id             bigint REFERENCES "order",   -- NULL = étiquette autonome
  store_id             bigint REFERENCES store,
  external_shipment_id text,
  shipment_number      text,
  shipment_status      shipment_status NOT NULL DEFAULT 'pending',
  carrier_account_id   bigint REFERENCES carrier_account,
  service_code         text,
  package_code         text,
  confirmation         confirmation_type DEFAULT 'none',
  warehouse_id         bigint REFERENCES warehouse,
  ship_from_address_id bigint REFERENCES address,
  ship_to_address_id   bigint NOT NULL REFERENCES address,
  return_to_address_id bigint REFERENCES address,
  ship_date            date,
  hold_until_date      date,
  ship_by_date         date,
  deliver_by_date      date,
  is_return            boolean NOT NULL DEFAULT false,
  is_gift              boolean NOT NULL DEFAULT false,
  insurance_provider   insurance_provider DEFAULT 'none',
  total_weight_value   numeric(10,3),
  total_weight_unit    weight_unit,
  zone                 integer,
  display_scheme       display_scheme DEFAULT 'label',
  assigned_user_id     uuid REFERENCES app_user,
  notes_from_buyer     text,
  notes_to_buyer       text,
  notes_for_gift       text,
  internal_notes       text,
  amount_paid          numeric(12,2),
  shipping_paid        numeric(12,2),
  tax_paid             numeric(12,2),
  retail_rate          numeric(12,2),
  currency_code        char(3) DEFAULT 'USD',
  customs              jsonb,       -- objet customs v2 complet
  advanced_options     jsonb,       -- 40+ champs v2
  tax_identifiers      jsonb,
  batch_id             bigint,      -- FK ajoutée plus bas
  created_at           timestamptz NOT NULL DEFAULT now(),
  modified_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_shipment_id)
);
CREATE INDEX ON shipment (account_id, shipment_status, created_at DESC);
CREATE INDEX ON shipment (order_id);

CREATE TABLE shipment_package (
  shipment_package_id  bigserial PRIMARY KEY,
  shipment_id          bigint NOT NULL REFERENCES shipment ON DELETE CASCADE,
  sequence             integer NOT NULL DEFAULT 1,
  package_type_id      bigint REFERENCES carrier_package_type,
  package_code         text,
  package_name         text,
  weight_value         numeric(10,3) NOT NULL,
  weight_unit          weight_unit NOT NULL,
  dim_length numeric(9,2), dim_width numeric(9,2), dim_height numeric(9,2),
  dim_unit             dimension_unit,
  insured_value        numeric(12,2),
  insured_currency     char(3),
  external_package_id  text,
  content_description  text,
  label_reference1     text,
  label_reference2     text,
  label_reference3     text,
  tracking_number      text,
  UNIQUE (shipment_id, sequence)
);

CREATE TABLE shipment_item (
  shipment_item_id  bigserial PRIMARY KEY,
  shipment_id       bigint NOT NULL REFERENCES shipment ON DELETE CASCADE,
  order_item_id     bigint REFERENCES order_item,
  shipment_package_id bigint REFERENCES shipment_package,
  sku               text,
  name              text,
  quantity          integer NOT NULL,
  unit_price        numeric(12,2)
);

CREATE TABLE label (
  label_id                bigserial PRIMARY KEY,
  account_id              bigint NOT NULL REFERENCES account,
  shipment_id             bigint NOT NULL REFERENCES shipment,
  batch_id                bigint,          -- FK ajoutée plus bas
  status                  label_status NOT NULL DEFAULT 'processing',
  tracking_number         text,
  tracking_url            text,
  tracking_status         text,            -- unknown|in_transit|error|delivered
  trackable               boolean NOT NULL DEFAULT true,
  carrier_account_id      bigint REFERENCES carrier_account,
  carrier_code            text,
  service_code            text,
  package_code            text,
  confirmation            confirmation_type,
  ship_date               date,
  is_return_label         boolean NOT NULL DEFAULT false,
  is_international        boolean NOT NULL DEFAULT false,
  rma_number              text,
  outbound_label_id       bigint REFERENCES label,
  charge_event            charge_event NOT NULL DEFAULT 'carrier_default',
  -- coûts
  shipment_cost           numeric(12,2),
  insurance_cost          numeric(12,2),
  currency_code           char(3) DEFAULT 'USD',
  requested_comparison_amount numeric(12,2),
  -- rendu
  label_format            label_format NOT NULL DEFAULT 'pdf',
  label_layout            label_layout NOT NULL DEFAULT '4x6',
  display_scheme          display_scheme NOT NULL DEFAULT 'label',
  label_image_id          text,
  is_test_label           boolean NOT NULL DEFAULT false,
  label_pdf_url           text,
  label_png_url           text,
  label_zpl_url           text,
  label_data              bytea,           -- stockage inline optionnel
  form_download_url       text,
  qr_code_download_url    text,
  paperless_href          text,
  paperless_instructions  text,
  paperless_handoff_code  text,
  insurance_claim_url     text,
  alternative_identifiers jsonb,
  -- annulation
  voided                  boolean NOT NULL DEFAULT false,
  voided_at               timestamptz,
  void_type               text,            -- refund_assist | manual
  -- notification marketplace
  marketplace_notified    boolean NOT NULL DEFAULT false,
  marketplace_notified_at timestamptz,
  notify_error_message    text,
  notify_attempts         integer NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON label (account_id, status, created_at DESC);
CREATE INDEX ON label (tracking_number);
CREATE INDEX ON label (account_id, marketplace_notified)
  WHERE NOT marketplace_notified AND NOT voided;

CREATE TABLE label_rate_detail (
  rate_detail_id      bigserial PRIMARY KEY,
  label_id            bigint NOT NULL REFERENCES label ON DELETE CASCADE,
  rate_detail_type    text,           -- shipping | additional_fees | …
  carrier_description text,
  carrier_billing_code text,
  carrier_memo        text,
  amount              numeric(12,2) NOT NULL,
  currency            char(3) NOT NULL DEFAULT 'USD',
  billing_source      text            -- Carrier | DutiesTax
);

CREATE TABLE label_refund (
  refund_id         bigserial PRIMARY KEY,
  label_id          bigint NOT NULL REFERENCES label ON DELETE CASCADE,
  status            refund_status NOT NULL,
  requested_at      timestamptz NOT NULL DEFAULT now(),
  amount_paid       numeric(12,2),
  amount_requested  numeric(12,2),
  amount_approved   numeric(12,2),
  amount_credited   numeric(12,2),
  currency          char(3) DEFAULT 'USD',
  resolved_at       timestamptz
);

-- ─────────────── Tarifs ───────────────
CREATE TABLE rate_request (
  rate_request_id bigserial PRIMARY KEY,
  account_id      bigint NOT NULL REFERENCES account,
  shipment_id     bigint REFERENCES shipment,
  status          rate_response_status NOT NULL DEFAULT 'working',
  rate_options    jsonb,
  errors          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz    -- les rate_id ont une durée de vie limitée
);

CREATE TABLE rate (
  rate_id                 bigserial PRIMARY KEY,
  rate_request_id         bigint NOT NULL REFERENCES rate_request ON DELETE CASCADE,
  rate_type               text,              -- check | shipment
  carrier_account_id      bigint REFERENCES carrier_account,
  carrier_code            text,
  carrier_nickname        text,
  carrier_friendly_name   text,
  service_code            text,
  service_type            text,
  package_type            text,
  is_valid                boolean NOT NULL DEFAULT true,
  validation_status       text,              -- valid|invalid|has_warnings|unknown
  shipping_amount         numeric(12,2),
  insurance_amount        numeric(12,2),
  confirmation_amount     numeric(12,2),
  other_amount            numeric(12,2),
  tax_amount              numeric(12,2),
  currency                char(3) DEFAULT 'USD',
  zone                    integer,
  delivery_days           integer,
  carrier_delivery_days   text,
  estimated_delivery_date timestamptz,
  guaranteed_service      boolean NOT NULL DEFAULT false,
  negotiated_rate         boolean NOT NULL DEFAULT false,
  trackable               boolean NOT NULL DEFAULT true,
  ship_date               date,
  rate_attributes         text[],            -- cheapest | fastest | best_value
  warning_messages        text[],
  error_messages          text[],
  rate_details            jsonb
);
CREATE INDEX ON rate (rate_request_id, shipping_amount);
```

## 7.8 Tables — lots, manifestes, suivi

```sql
CREATE TABLE batch (
  batch_id              bigserial PRIMARY KEY,
  account_id            bigint NOT NULL REFERENCES account,
  batch_number          text,
  external_batch_id     text,
  batch_notes           text,
  status                batch_status NOT NULL DEFAULT 'open',
  label_format          label_format NOT NULL DEFAULT 'pdf',
  label_layout          label_layout NOT NULL DEFAULT '4x6',
  count_total           integer NOT NULL DEFAULT 0,
  count_completed       integer NOT NULL DEFAULT 0,
  count_errors          integer NOT NULL DEFAULT 0,
  count_warnings        integer NOT NULL DEFAULT 0,
  count_forms           integer NOT NULL DEFAULT 0,
  process_errors        jsonb,
  label_download_url    text,
  form_download_url     text,
  paperless_download    jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  processed_at          timestamptz,
  archived_at           timestamptz,
  UNIQUE (account_id, external_batch_id)
);
ALTER TABLE shipment ADD CONSTRAINT fk_shipment_batch
  FOREIGN KEY (batch_id) REFERENCES batch;
ALTER TABLE label ADD CONSTRAINT fk_label_batch
  FOREIGN KEY (batch_id) REFERENCES batch;

CREATE TABLE batch_shipment (
  batch_id    bigint REFERENCES batch ON DELETE CASCADE,
  shipment_id bigint REFERENCES shipment ON DELETE CASCADE,
  rate_id     bigint REFERENCES rate,
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, shipment_id)
);

CREATE TABLE manifest (
  manifest_id           bigserial PRIMARY KEY,
  account_id            bigint NOT NULL REFERENCES account,
  manifest_request_id   text,
  form_id               text,
  submission_id         text,
  carrier_account_id    bigint REFERENCES carrier_account,
  warehouse_id          bigint REFERENCES warehouse,
  ship_date             date,
  shipment_count        integer NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'in_progress',  -- in_progress|completed
  manifest_download_url text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE manifest_label (
  manifest_id bigint REFERENCES manifest ON DELETE CASCADE,
  label_id    bigint REFERENCES label ON DELETE CASCADE,
  PRIMARY KEY (manifest_id, label_id)
);

CREATE TABLE tracking_record (
  tracking_id               bigserial PRIMARY KEY,
  account_id                bigint NOT NULL REFERENCES account,
  label_id                  bigint REFERENCES label,
  tracking_number           text NOT NULL,
  carrier_code              text NOT NULL,
  tracking_url              text,
  status_code               tracking_status_code NOT NULL DEFAULT 'UN',
  status_detail_code        text,
  status_description        text,
  status_detail_description text,
  carrier_status_code       text,
  carrier_detail_code       text,
  carrier_status_description text,
  ship_date                 timestamptz,
  estimated_delivery_date   timestamptz,
  actual_delivery_date      timestamptz,
  exception_description     text,
  last_polled_at            timestamptz,
  UNIQUE (carrier_code, tracking_number)
);

CREATE TABLE tracking_event (
  event_id            bigserial PRIMARY KEY,
  tracking_id         bigint NOT NULL REFERENCES tracking_record ON DELETE CASCADE,
  occurred_at         timestamptz NOT NULL,      -- UTC normalisé
  carrier_occurred_at timestamptz,               -- heure locale du transporteur
  description         text,
  city_locality       text,
  state_province      text,
  postal_code         text,
  country_code        char(2),
  company_name        text,
  signer              text,
  event_code          text,
  carrier_detail_code text,
  status_code         tracking_status_code,
  status_description  text,
  status_detail_code  text,
  status_detail_description text,
  carrier_status_code text,
  carrier_status_description text,
  latitude            numeric(9,6),
  longitude           numeric(9,6),
  proof_of_delivery_url text,
  UNIQUE (tracking_id, occurred_at, event_code, carrier_status_code)
);
CREATE INDEX ON tracking_event (tracking_id, occurred_at DESC);
```

## 7.9 Tables — fulfillments, retours, webhooks

```sql
CREATE TABLE fulfillment (
  fulfillment_id            bigserial PRIMARY KEY,
  account_id                bigint NOT NULL REFERENCES account,
  order_id                  bigint REFERENCES "order",
  order_number              text,
  tracking_number           text,
  carrier_code              text,
  service_code              text,
  ship_date                 date,
  ship_to_address_id        bigint REFERENCES address,
  customer_email            citext,
  fulfillment_provider_code text,
  fulfillment_service_code  text,
  fulfillment_fee           numeric(12,2),
  void_requested            boolean NOT NULL DEFAULT false,
  voided                    boolean NOT NULL DEFAULT false,
  void_date                 timestamptz,
  marketplace_notified      boolean NOT NULL DEFAULT false,
  notify_error_message      text,
  created_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON fulfillment (account_id, order_id);

CREATE TABLE return_request (
  return_id           bigserial PRIMARY KEY,
  account_id          bigint NOT NULL REFERENCES account,
  order_id            bigint REFERENCES "order",
  rma_number          text NOT NULL,
  origin              text NOT NULL,     -- portal | imported | manual
  status              text NOT NULL DEFAULT 'open',
                      -- open|label_created|in_transit|received|closed|cancelled
  resolution          text,              -- refund | exchange | store_credit
  return_label_id     bigint REFERENCES label,
  outbound_label_id   bigint REFERENCES label,
  requested_at        timestamptz NOT NULL DEFAULT now(),
  received_at         timestamptz,
  resolved_at         timestamptz,
  UNIQUE (account_id, rma_number)
);

CREATE TABLE return_item (
  return_item_id bigserial PRIMARY KEY,
  return_id      bigint NOT NULL REFERENCES return_request ON DELETE CASCADE,
  order_item_id  bigint REFERENCES order_item,
  sku            text,
  quantity       integer NOT NULL,
  reason_code    text,
  reason_note    text
);

CREATE TABLE webhook_subscription (
  webhook_id    bigserial PRIMARY KEY,
  account_id    bigint NOT NULL REFERENCES account,
  store_id      bigint REFERENCES store,      -- NULL = tout le compte
  event         text NOT NULL,
  target_url    text NOT NULL CHECK (length(target_url) <= 200),
  friendly_name text,
  headers       jsonb,                        -- en-têtes personnalisés (v2)
  active        boolean NOT NULL DEFAULT true,
  secret        text,                         -- pour signature HMAC
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON webhook_subscription (account_id, event) WHERE active;

CREATE TABLE webhook_delivery (
  delivery_id     bigserial PRIMARY KEY,
  webhook_id      bigint NOT NULL REFERENCES webhook_subscription ON DELETE CASCADE,
  event           text NOT NULL,
  resource_type   text,
  resource_url    text,
  payload         jsonb,
  attempt         integer NOT NULL DEFAULT 1,
  response_status integer,
  response_body   text,
  succeeded       boolean NOT NULL DEFAULT false,
  next_retry_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON webhook_delivery (webhook_id, created_at DESC);
CREATE INDEX ON webhook_delivery (next_retry_at) WHERE NOT succeeded;
```

## 7.10 Décisions de modélisation à retenir

| Décision | Justification |
|---|---|
| **`order_key` UNIQUE par `store_id`** | C'est la clé d'idempotence de l'upsert `createorder`. Sans elle, on duplique les commandes à chaque import. |
| **`address` en table dédiée** | ShipStation dénormalise (adresse inline dans Order et Shipment), mais une table permet de porter les statuts et messages de validation, et de mutualiser entre `warehouse.origin` / `return`. |
| **`order_status_history` séparée** | L'API n'expose pas d'historique de statut — c'est un manque connu. L'ajouter dès le départ. |
| **`customer` + `customer_marketplace_identity`** | Réplique la déduplication multi‑canal de ShipStation, indispensable pour l'historique client. |
| **`advanced_options` en `jsonb`** | 40+ champs v2, dont beaucoup sont spécifiques transporteur et évoluent. Colonnes typées pour les 15 champs communs, `jsonb` pour le reste. |
| **`label` séparée de `shipment`** | En v2 une expédition peut avoir 0..N étiquettes (retour, réémission). En v1 c'est 1:1, ce qui est trop rigide. |
| **`shipment_package` avec `sequence`** | Supporte le multi‑colis, absent de v1. |
| **Compteurs dénormalisés sur `batch`** | `count_completed` / `count_errors` / `count_warnings` sont lus très fréquemment pendant le traitement. |
| **`label.marketplace_notified` + index partiel** | Alimente directement la file de notification retour avec réessai. |
| **`tracking_event` avec double horodatage** | `occurred_at` (UTC) et `carrier_occurred_at` (local) sont sémantiquement distincts. |
| **Contrainte UNIQUE sur `tracking_event`** | Les transporteurs renvoient des événements en double lors du polling. |
| **`weight`/`dimension` en colonnes valeur+unité** | Ne jamais normaliser en une seule unité au stockage : on perd l'intention de l'utilisateur et l'arrondi transporteur. |
| **Devise explicite partout** | v1 est implicitement USD (`CustomsItem.value` « in USD »), v2 est multidevise. Adopter v2. |
| **`timestamptz` partout** | v1 stocke en PST sans fuseau — c'est un bug de conception à ne pas répliquer. |

---

<a name="8"></a>
