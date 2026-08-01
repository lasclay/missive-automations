# 11. Shipping API v2 — schémas complets

> Extrait de la spec ShipStation — Lasclay. Voir `00-INDEX.md` pour la carte complète.
> Libellés d'UI en anglais (langue source du produit). `[à vérifier]` = non confirmé par une source officielle.

# 3. Shipping API v2

## 3.1 Conventions

| Élément | Valeur |
|---|---|
| Base URL | `https://api.shipstation.com/v2` (équivalent `https://api.shipengine.com/v1`) |
| Endpoint UE | `https://api.eu.shipengine.com` |
| Auth | En‑tête `API-Key: <clé>` |
| Sandbox | Clés préfixées `TEST_`, 20 req/min |
| TLS | TLS 1.1+ |
| Rate limit | **200 requêtes / minute**, en‑tête `Retry-After` sur 429 |
| Nommage | `snake_case` |
| IDs | chaînes préfixées `se-` |

### Format d'erreur v2
```json
{
  "request_id": "uuid",
  "errors": [{
    "error_source": "carrier",
    "error_type": "validation",
    "error_code": "invalid_field_value",
    "message": "…",
    "field_name": "ship_to.postal_code",
    "field_value": "ABC"
  }]
}
```
`request_id` est l'identifiant à fournir au support. Voir §4.11 pour les enums d'erreur.

### Pagination v2 (HATEOAS)
```json
{
  "shipments": [ … ],
  "total": 1234, "page": 1, "pages": 25,
  "links": {
    "first": { "href": "…", "type": "…" },
    "last":  { "href": "…" },
    "prev":  { "href": "…" },
    "next":  { "href": "…" }
  }
}
```
`prev` est vide si `page <= 1`, `next` vide si `page >= pages`.

---

## 3.2 Inventaire complet des endpoints v2

### Addresses
| Méthode | Chemin | operationId |
|---|---|---|
| POST | `/v2/addresses/validate` | `validate_address` (jusqu'à **250 adresses** par requête) |
| PUT | `/v2/addresses/recognize` | `parse_address` |

### Rates
| Méthode | Chemin | Opération |
|---|---|---|
| POST | `/v2/rates` | Calculer les tarifs |
| POST | `/v2/rates/estimate` | Estimation sans compte transporteur |
| GET | `/v2/rates/{rate_id}` | Récupérer un tarif |
| GET | `/v2/shipments/{shipment_id}/rates` | Tarifs d'une expédition |

### Shipments
| Méthode | Chemin | Opération |
|---|---|---|
| GET | `/v2/shipments` | Lister |
| POST | `/v2/shipments` | Créer (en lot) |
| GET | `/v2/shipments/{shipment_id}` | Récupérer |
| PUT | `/v2/shipments/{shipment_id}` | Mettre à jour |
| PUT | `/v2/shipments/{shipment_id}/cancel` | Annuler |
| POST | `/v2/shipments/{shipment_id}/tags/{tag_name}` | Ajouter un tag |
| DELETE | `/v2/shipments/{shipment_id}/tags/{tag_name}` | Retirer un tag |
| GET | `/v2/shipments/external_shipment_id/{id}` | Par ID externe |

### Labels
| Méthode | Chemin | operationId |
|---|---|---|
| GET | `/v1/labels` | `list_labels` |
| POST | `/v1/labels` | `create_label` |
| GET | `/v1/labels/{label_id}` | `get_label_by_id` |
| GET | `/v1/labels/external_shipment_id/{id}` | `get_label_by_external_shipment_id` |
| POST | `/v1/labels/rates/{rate_id}` | `create_label_from_rate` |
| POST | `/v1/labels/rate_shopper_id/{rate_shopper_id}` | `create_label_from_rate_shopper` |
| POST | `/v1/labels/shipment/{shipment_id}` | `create_label_from_shipment` |
| POST | `/v1/labels/{label_id}/return` | `create_return_label` |
| GET | `/v1/labels/{label_id}/track` | `get_tracking_log_from_label` |
| PUT | `/v1/labels/{label_id}/void` | `void_label` |
| POST | `/v1/labels/{label_id}/cancel_refund` | `cancel_label_refund` |

### Batches
| Méthode | Chemin | operationId |
|---|---|---|
| GET | `/v1/batches` | `list_batches` |
| POST | `/v1/batches` | `create_batch` |
| GET | `/v1/batches/{batch_id}` | `get_batch_by_id` |
| GET | `/v1/batches/external_batch_id/{id}` | `get_batch_by_external_id` |
| PUT | `/v1/batches/{batch_id}` | `update_batch` |
| DELETE | `/v1/batches/{batch_id}` | `delete_batch` (archiver) |
| POST | `/v1/batches/{batch_id}/add` | `add_to_batch` |
| POST | `/v1/batches/{batch_id}/remove` | `remove_from_batch` |
| POST | `/v1/batches/{batch_id}/process/labels` | `process_batch` |
| GET | `/v1/batches/{batch_id}/errors` | `list_batch_errors` |

### Carriers
| Méthode | Chemin | operationId |
|---|---|---|
| GET | `/v1/carriers` | `list_carriers` |
| GET | `/v1/carriers/{carrier_id}` | `get_carrier_by_id` |
| DELETE | `/v1/carriers/{carrier_id}` | `disconnect_carrier_by_id` |
| PUT | `/v1/carriers/{carrier_id}/add_funds` | `add_funds_to_carrier` |
| GET | `/v1/carriers/{carrier_id}/options` | `get_carrier_options` |
| GET | `/v1/carriers/{carrier_id}/packages` | `list_carrier_package_types` |
| GET | `/v1/carriers/{carrier_id}/services` | `list_carrier_services` |

### Carrier accounts (connexions)
| Méthode | Chemin | operationId |
|---|---|---|
| POST | `/v1/connections/carriers/{carrier_name}` | `connect_carrier` |
| DELETE | `/v1/connections/carriers/{carrier_name}/{carrier_id}` | `disconnect_carrier` |
| GET | `/v1/connections/carriers/{carrier_name}/{carrier_id}/settings` | `get_carrier_settings` |
| PUT | `/v1/connections/carriers/{carrier_name}/{carrier_id}/settings` | `update_carrier_settings` |

### Insurance / Funding
| Méthode | Chemin | operationId |
|---|---|---|
| POST | `/v1/connections/insurance/shipsurance` | `connect_insurer` |
| DELETE | `/v1/connections/insurance/shipsurance` | `disconnect_insurer` |
| GET | `/v1/insurance/shipsurance/balance` | `get_insurance_balance` |
| PATCH | `/v1/insurance/shipsurance/add_funds` | `add_funds_to_insurance` |

### Manifests
| Méthode | Chemin | operationId |
|---|---|---|
| GET | `/v1/manifests` | `list_manifests` |
| POST | `/v1/manifests` | `create_manifest` |
| GET | `/v1/manifests/{manifest_id}` | `get_manifest_by_id` |
| GET | `/v1/manifests/requests/{manifest_request_id}` | `get_manifest_request_by_id` |

### Package types (colis personnalisés)
| Méthode | Chemin | operationId |
|---|---|---|
| GET | `/v1/packages` | `list_package_types` |
| POST | `/v1/packages` | `create_package_type` |
| GET | `/v1/packages/{package_id}` | `get_package_type_by_id` |
| PUT | `/v1/packages/{package_id}` | `update_package_type` |
| DELETE | `/v1/packages/{package_id}` | `delete_package_type` |

### Pickups
| Méthode | Chemin | operationId |
|---|---|---|
| GET | `/v1/pickups` | `list_scheduled_pickups` |
| POST | `/v1/pickups` | `schedule_pickup` |
| GET | `/v1/pickups/{pickup_id}` | `get_pickup_by_id` |
| DELETE | `/v1/pickups/{pickup_id}` | annuler `[à vérifier]` |

### Warehouses
`GET/POST /v2/warehouses`, `GET/PUT/DELETE /v2/warehouses/{warehouse_id}`

### Webhooks
| Méthode | Chemin | operationId |
|---|---|---|
| GET | `/v1/environment/webhooks` | `list_webhooks` |
| POST | `/v1/environment/webhooks` | `create_webhook` |
| GET | `/v1/environment/webhooks/{webhook_id}` | `get_webhook_by_id` |
| PUT | `/v1/environment/webhooks/{webhook_id}` | `update_webhook` |
| DELETE | `/v1/environment/webhooks/{webhook_id}` | `delete_webhook` |

### Account settings, documents, downloads
| Méthode | Chemin | operationId |
|---|---|---|
| GET | `/v1/account/settings` | `list_account_settings` |
| GET/POST | `/v1/account/settings/images` | `list_account_images` / `create_account_image` |
| GET/PUT/DELETE | `/v1/account/settings/images/{label_image_id}` | gestion des logos d'étiquette |
| POST | `/v1/documents/combined_labels` | `create_combined_label_document` |
| GET | `/v1/downloads/{dir}/{subdir}/{filename}` | `download_file` |

### Autres domaines v2 (hors périmètre détaillé)
Tracking (`/v2/tracking`), Service Points / PUDO, LTL Freight (devis, spot quotes, BOL), Sales Orders, Inventory API (add‑on : stock levels, warehouses, locations), Users (`/v2/users`), Products (`/v2/products`).

---

## 3.3 Objet `Shipment` v2 — schéma complet

### Champs racine
| Champ | Type | Requis | Description |
|---|---|---|---|
| `shipment_id` | string | ✅ | Identifiant unique |
| `carrier_id` | string \| null | | Compte transporteur facturé |
| `service_code` | string \| null | | ex. `usps_first_class_mail` |
| `requested_shipment_service` | string \| null | | Service demandé par l'acheteur |
| `external_order_id` | string \| null | | ID assigné par la source de commande |
| `external_shipment_id` | string \| null | | Clé unique définie par l'utilisateur (max 50 car.) |
| `shipment_number` | string \| null | | Numéro défini par l'utilisateur (max 50 car.) |
| `hold_until_date` | string \| null | | Date de mise en attente |
| `ship_by_date` | string \| null | | Date limite d'expédition |
| `deliver_by_date` | string \| null | | Date limite de livraison |
| `ship_date` | string \| null | | Date d'expédition |
| `created_at` | string | ✅ | Création |
| `modified_at` | string | ✅ | Dernière modification |
| `shipment_status` | string | ✅ | `pending` \| `processing` \| `label_purchased` \| `cancelled` |
| `store_id` | string | | Boutique associée |
| `warehouse_id` | string \| null | | Entrepôt source |
| `is_gift` | boolean | | Cadeau |
| `is_return` | boolean \| null | | Expédition de retour (défaut `false`) |
| `confirmation` | string | ✅ | Voir §4.2 |
| `insurance_provider` | string | ✅ | Voir §4.4 |
| `order_source_code` | string | | Voir §4.10 |
| `comparison_rate_type` | string \| null | | Type de grille tarifaire alternative (UPS/USPS seulement) |
| `zone` | integer \| null | | Zone tarifaire |
| `display_scheme` | string \| null | | `label` \| `paperless` \| `label_and_paperless` |
| `assigned_user` | string \| null | | Courriel de l'utilisateur assigné |
| `notes_from_buyer` | string \| null | | Notes de l'acheteur |
| `notes_to_buyer` | string \| null | | Notes au client |
| `notes_for_gift` | string \| null | | Message cadeau |
| `internal_notes` | string \| null | | Notes internes vendeur |
| `retail_rate` | Money \| null | | Tarif de détail |
| `amount_paid` | Money | | Montant payé |
| `shipping_paid` | Money | | Frais d'expédition payés |
| `tax_paid` | Money | | Taxes payées |
| `ship_to` | Address | ✅ | Destinataire |
| `ship_from` | Address | ✅ | Expéditeur |
| `return_to` | Address | ✅ | Adresse de retour (défaut = `ship_from`) |
| `items` | Item[] | | Articles |
| `packages` | Package[] | ✅ | Colis |
| `total_weight` | Weight | ✅ | Poids combiné |
| `tags` | `{name}[]` | ✅ | Tags |
| `tax_identifiers` | TaxIdentifier[] \| null | | Identifiants fiscaux |
| `customs` | Customs \| null | | Douane |
| `advanced_options` | AdvancedOptions | | Options avancées |

### `Money`
`{ currency: string (requis, ISO 4217), amount: number (requis) }`

### `Address` v2
| Champ | Type | Requis |
|---|---|---|
| `name` | string | ✅ |
| `phone` | string | ✅ |
| `email` | string \| null | |
| `company_name` | string \| null | |
| `address_line1` | string | ✅ |
| `address_line2` | string \| null | |
| `address_line3` | string \| null | |
| `city_locality` | string | ✅ |
| `state_province` | string | ✅ |
| `postal_code` | string | ✅ |
| `country_code` | string | ✅ (ISO 3166‑1 alpha‑2) |
| `address_residential_indicator` | string | ✅ (`unknown`\|`yes`\|`no`) |
| `instructions` | string \| null | |
| `geolocation` | `{type, value}[]` | `type` = `what3words` |

### `Item` (article de commande)
`name`, `sales_order_id`, `sales_order_item_id`, `quantity` (✅ integer), `sku`, `bundle_sku`, `external_order_id`, `external_order_item_id`, `asin`, `order_source_code`, `item_id`, `allocation_status`, `image_url`, `weight` (✅), `unit_price`, `tax_amount`, `shipping_amount`, `inventory_location`, `options[] {name, value}`, `product_id`, `fulfillment_sku`, `upc`.

### `Package` (colis)
| Champ | Type | Requis |
|---|---|---|
| `shipment_package_id` | string | |
| `package_id` | string | |
| `package_code` | string | |
| `package_name` | string | |
| `weight` | Weight | ✅ |
| `dimensions` | `{unit, length, width, height}` | |
| `insured_value` | Money | |
| `label_messages` | `{reference1, reference2, reference3}` | |
| `external_package_id` | string | |
| `content_description` | string \| null | |
| `products` | Product[] | (déclarations douanières détaillées) |

### `Customs` (douane)
| Champ | Type | Requis | Valeurs |
|---|---|---|---|
| `contents` | string | ✅ | voir §4.6 |
| `contents_explanation` | string | | requis si `contents = other` |
| `non_delivery` | string | ✅ | `return_to_sender` \| `treat_as_abandoned` |
| `terms_of_trade_code` | string | | Incoterms, voir §4.7 |
| `declaration` | string | | Déclaration pour facture commerciale |
| `pending_documents` | boolean | | Documents douaniers à téléverser |
| `invoice_additional_details` | object | | `freight_charge`, `insurance_charge`, `discount`, `estimated_import_charges{taxes,duties}`, `other_charge`, `other_charge_description` |
| `importer_of_record` | Address | | Importateur officiel |
| `customs_items` | CustomsItem[] | | Lignes de douane |

### `CustomsItem` v2
`customs_item_id`, `description`, `quantity` (✅), `value` (✅), `value_currency`, `weight {value, unit}`, `harmonized_tariff_code`, `country_of_origin`, `unit_of_measure`, `sku`, `sku_description`.

### `AdvancedOptions` v2 (très étendu par rapport à v1)
`bill_to_account`, `bill_to_country_code`, `bill_to_party` (`recipient`\|`third_party`), `bill_to_postal_code`, `contains_alcohol`, `delivered_duty_paid`, `dry_ice`, `dry_ice_weight`, `non_machinable`, `saturday_delivery`, `fedex_freight {shipper_load_and_count, booking_confirmation}`, `use_ups_ground_freight_pricing`, `freight_class` (NMFTA, ex. « 77.5 »), `custom_field1..3`, `origin_type` (`pickup`\|`drop_off`), `additional_handling`, `shipper_release`, `collect_on_delivery {payment_type, payment_amount}`, `third_party_consignee`, `dangerous_goods`, `dangerous_goods_contact {name, phone}`, `movement_indicator` (`c2c`\|`b2c`\|`c2b`\|`b2b`), `windsor_framework_details {not_at_risk, movement_indicator}`, `ancillary_endorsements_option`, `return_pickup_attempts`, `own_document_upload`, `limited_quantity`, `event_notification`, `fragile`, `delivery_as_addressed`, `return_after_first_attempt`, `regulated_content_type` (`day_old_poultry`\|`other_live_animal`), `netstamps_options {row, column}`.

### `TaxIdentifier`
| Champ | Type | Requis | Valeurs |
|---|---|---|---|
| `taxable_entity_type` | string | ✅ | `shipper` \| `recipient` \| `ior` |
| `identifier_type` | string | ✅ | voir §4.8 |
| `issuing_authority` | string | ✅ | ISO 3166 alpha‑2 |
| `value` | string | ✅ | |

### Paramètres `GET /v2/shipments`
`shipment_status`, `batch_id`, `pickup_id`, `created_at_start`/`_end`, `modified_at_start`/`_end`, `page`, `page_size`, `sales_order_id`, `sort_dir` (`asc`\|`desc`), `shipment_number`, `ship_to_name`, `item_keyword` (cherche dans SKU / description / options), `payment_date_start`/`_end`, `store_id`, `external_shipment_id`, `sort_by` (`modified_at`\|`created_at`).

---

## 3.4 Objet `Label` v2

### Requête `POST /v2/labels` — champs racine
| Champ | Type | Requis | Description |
|---|---|---|---|
| `shipment` | object | ✅ | Objet Shipment complet (voir §3.3) |
| `charge_event` | string | ✅ | `carrier_default` \| `on_creation` \| `on_carrier_acceptance` |
| `is_return_label` | boolean | | Étiquette de retour |
| `rma_number` | string \| null | | Numéro d'autorisation de retour |
| `outbound_label_id` | string | | Étiquette aller d'origine (pour retours) |
| `validate_address` | string | | `no_validation` \| `validate_only` \| `validate_and_clean` |
| `label_download_type` | string | | `url` \| `inline` |
| `label_format` | string | | `pdf` \| `png` \| `zpl` |
| `label_layout` | string | | `4x6` \| `letter` |
| `display_scheme` | string | | `label` \| `paperless` \| `label_and_paperless` |
| `label_image_id` | string \| null | | Logo personnalisé |
| `test_label` | boolean | | Étiquette de test |
| `ship_to_service_point_id` | string \| null | | Point relais destinataire (PUDO) |
| `ship_from_service_point_id` | string \| null | | Point de dépôt |

### Réponse `Label`
| Champ | Type | Requis | Description |
|---|---|---|---|
| `label_id` | string | ✅ | Identifiant |
| `status` | string | ✅ | `processing` \| `completed` \| `error` \| `voided` |
| `shipment_id` | string | ✅ | Expédition liée |
| `external_shipment_id` | string \| null | ✅ | |
| `external_order_id` | string \| null | | |
| `ship_date` | string | ✅ | |
| `created_at` | string | ✅ | |
| `shipment_cost` | Money | ✅ | Coût d'expédition |
| `insurance_cost` | Money | ✅ | Coût d'assurance |
| `requested_comparison_amount` | Money | | Montant de comparaison |
| `tracking_number` | string | ✅ | |
| `tracking_url` | string \| null | | |
| `tracking_status` | string | ✅ | `unknown` \| `in_transit` \| `error` \| `delivered` |
| `trackable` | boolean | ✅ | |
| `is_return_label` | boolean | ✅ | |
| `rma_number` | string \| null | ✅ | |
| `is_international` | boolean | ✅ | |
| `batch_id` | string | ✅ | Lot |
| `carrier_id` | string | ✅ | |
| `carrier_code` | string | ✅ | |
| `charge_event` | string | ✅ | |
| `service_code` | string | ✅ | |
| `package_code` | string | ✅ | |
| `confirmation` | string | | |
| `voided` | boolean | ✅ | |
| `voided_at` | string \| null | ✅ | |
| `void_type` | string \| null | | `refund_assist` \| `manual` |
| `refund_details` | object \| null | | voir ci‑dessous |
| `label_format` | string | ✅ | `pdf` \| `png` \| `zpl` |
| `label_layout` | string | ✅ | `4x6` \| `letter` |
| `display_scheme` | string | ✅ | |
| `label_image_id` | string \| null | ✅ | |
| `label_download` | `{href, pdf, png, zpl}` | ✅ | URLs de téléchargement |
| `form_download` | `{href, type}` \| null | ✅ | Formulaires douaniers |
| `qr_code_download` | `{href, type}` \| null | | QR code |
| `paperless_download` | `{href, instructions, handoff_code}` \| null | ✅ | Étiquette dématérialisée |
| `insurance_claim` | `{href, type}` \| null | ✅ | Lien de déclaration de sinistre |
| `packages` | Package[] | ✅ | Détail par colis (chacun avec son propre `tracking_number` et `label_download`) |
| `rate_details` | RateDetail[] | ✅ | Ventilation des frais |
| `alternative_identifiers` | `{type, value}[]` \| null | | Identifiants transporteur additionnels |
| `ship_to` | Address | | |

### `refund_details`
| Champ | Type | Valeurs |
|---|---|---|
| `refund_status` | string | `request_scheduled` \| `pending` \| `approved` \| `rejected` \| `excluded` |
| `request_date` | string | Date de soumission |
| `amount_paid` | Money \| null | |
| `amount_requested` | Money \| null | |
| `amount_approved` | Money \| null | |
| `amount_credited` | Money \| null | |

### Formats et layouts d'étiquette

| Format | Taille par défaut | Feuille Letter 8,5×11 | Note |
|---|---|---|---|
| `pdf` | 4"×6" (100×150 mm) | ✅ (2 étiquettes/feuille) | Adobe PDF |
| `png` | 4"×6" | ✅ | Image PNG |
| `zpl` | 4"×6" fixe | ❌ | Zebra Programming Language |

> ShipStation **n'imprime pas** de timbres standard ni d'étiquettes d'adresse 2"×3".

**`label_download_type`** : `url` (défaut — retourne les URLs pour les 3 formats) ou `inline` (retourne une étiquette unique encodée en Base64 dans le format demandé).

---

## 3.5 Objet `Rate` v2

### Requête `POST /v2/rates`
```json
{
  "shipment": { … } ou "shipment_id": "se-…",
  "rate_options": {
    "carrier_ids": ["se-123"],
    "service_codes": [ … ],
    "package_types": [ … ],
    "calculate_tax_amount": false,
    "preferred_currency": "usd",
    "is_return": false
  }
}
```
> On passe **soit** `shipment` complet **soit** `shipment_id`, jamais les deux.

### `rate_response`
| Champ | Type | Description |
|---|---|---|
| `rates` | Rate[] | Tarifs valides |
| `invalid_rates` | Rate[] | Tarifs rejetés |
| `rate_request_id` | string | Identifiant de la demande |
| `shipment_id` | string | Expédition associée |
| `created_at` | string | |
| `status` | string | `working` \| `completed` \| `partial` \| `error` |
| `errors` | Error[] | |

### `Rate`
| Champ | Type | Requis | Description |
|---|---|---|---|
| `rate_id` | string | ✅ | Identifiant du tarif (consommable pour créer une étiquette) |
| `rate_type` | string | ✅ | `check` \| `shipment` |
| `carrier_id` | string | ✅ | |
| `shipping_amount` | Money | ✅ | Coût de base |
| `insurance_amount` | Money | ✅ | |
| `confirmation_amount` | Money | ✅ | |
| `other_amount` | Money | ✅ | Frais et surcharges transporteur |
| `requested_comparison_amount` | Money | | |
| `tax_amount` | Money | | Droits et taxes (si `calculate_tax_amount`) |
| `zone` | integer \| null | ✅ | Zone tarifaire |
| `package_type` | string \| null | ✅ | |
| `delivery_days` | integer \| null | | Délai estimé |
| `guaranteed_service` | boolean | ✅ | Service garanti |
| `estimated_delivery_date` | string \| null | | |
| `carrier_delivery_days` | string | | Estimation du transporteur |
| `ship_date` | string | | |
| `negotiated_rate` | boolean | ✅ | Tarif négocié |
| `service_type` | string | ✅ | ex. « next_day » |
| `service_code` | string | ✅ | ex. `usps_priority_mail_express` |
| `trackable` | boolean | ✅ | |
| `carrier_code` | string | ✅ | |
| `carrier_nickname` | string | ✅ | |
| `carrier_friendly_name` | string | ✅ | |
| `validation_status` | string | ✅ | `valid` \| `invalid` \| `has_warnings` \| `unknown` |
| `warning_messages` | string[] | ✅ | |
| `error_messages` | string[] | ✅ | |
| `rate_details` | RateDetail[] | | Ventilation |

### `RateDetail`
`rate_detail_type` (ex. `shipping`, `additional_fees`), `carrier_description`, `carrier_billing_code`, `carrier_memo`, `amount` (Money), `billing_source` (`Carrier` \| `DutiesTax` — **PascalCase**, incohérent avec le reste).

### Rate Shopper
Stratégies : `cheapest`, `fastest`, `best_value`, ou GUID personnalisé.
- `cheapest` — option la moins chère
- `fastest` — livraison la plus rapide
- `best_value` — option la moins chère arrivant à une date spécifiée sous 4 jours, avec couverture transporteur gratuite jusqu'à 100 $

---

## 3.6 Objet `Batch` v2

| Champ | Type | Description |
|---|---|---|
| `batch_id` | string | Identifiant (`se-28529731`) |
| `batch_number` | string | Numéro de lot |
| `external_batch_id` | string \| null | Identifiant externe |
| `batch_notes` | string \| null | Notes |
| `status` | string | Voir §4.12 |
| `created_at` | string | Création |
| `processed_at` | string \| null | Traitement |
| `errors` | integer | Nombre d'erreurs |
| `process_errors` | Error[] | Détail des erreurs |
| `warnings` | integer | Nombre d'avertissements |
| `completed` | integer | Étiquettes générées |
| `forms` | integer | Formulaires douaniers |
| `count` | integer | Total = erreurs + avertissements + complétés |
| `label_layout` | string | `4x6` \| `letter` |
| `label_format` | string | `pdf` \| `png` \| `zpl` |
| `batch_shipments_url` | `{href, type}` | |
| `batch_labels_url` | `{href, type}` | |
| `batch_errors_url` | `{href, type}` | |
| `label_download` | `{href, pdf, png, zpl}` | |
| `form_download` | `{href, type}` | |
| `paperless_download` | `{href, instructions, handoff_code}` | |

**Paramètres `GET /v1/batches`** : `status`, `page`, `page_size`, `sort_dir` (`asc`\|`desc`), `batch_number`, `sort_by` (`ship_date`\|`processed_at`\|`created_at`).

---

## 3.7 Objet `Manifest` v2

| Champ | Type | Description |
|---|---|---|
| `manifest_id` | string | Identifiant |
| `form_id` | string | Identifiant du formulaire |
| `created_at` | string | Création |
| `ship_date` | string | Date d'enlèvement prévue |
| `shipments` | integer | Nombre d'expéditions incluses |
| `label_ids` | string[] | Étiquettes incluses |
| `warehouse_id` | string | Entrepôt |
| `submission_id` | string | Identifiant de soumission |
| `carrier_id` | string | Transporteur |
| `manifest_download` | `{href}` | Téléchargement du manifeste |

**Enveloppe de requête :** `manifest_request_id` + `status` (`in_progress` \| `completed`).
**Note :** à la création, on fournit `warehouse_id` **et non** une adresse `ship_from`.
**Filtres `GET /v1/manifests`** : `warehouse_id`, `carrier_id`, `label_ids`, plages de dates d'expédition et de création (ISO 8601).

---

## 3.8 Objet `Carrier` v2

| Champ | Type | Description |
|---|---|---|
| `carrier_id` | string | `se-28529731` |
| `carrier_code` | string | `fedex`, `dhl_express`, `stamps_com`… |
| `account_number` | string | |
| `connection_status` | string \| null | `pending_approval` \| `approved` |
| `requires_funded_amount` | boolean | Compte prépayé requis |
| `balance` | number | Solde |
| `nickname` | string | |
| `friendly_name` | string | Nom lisible |
| `funding_source_id` | string \| null | Source de financement |
| `primary` | boolean | Transporteur par défaut |
| `has_multi_package_supporting_services` | boolean | Multi‑colis supporté |
| `supports_label_messages` | boolean | Messages personnalisés sur étiquette |
| `disabled_by_billing_plan` | boolean | Désactivé par le plan |
| `send_rates` | boolean | Fournit des tarifs |
| `supports_user_managed_rates` | boolean | Tarifs gérés par l'utilisateur |
| `services` | Service[] | |
| `packages` | PackageType[] | |
| `options` | `{name, default_value, description}[]` | Options avancées supportées par ce transporteur |

### `Service` v2
`carrier_id`, `carrier_code`, `service_code`, `name`, `domestic`, `international`, `is_multi_package_supported`, `send_rates`.

### `PackageType` v2
`package_id`, `package_code` (✅), `name` (✅), `dimensions {unit, length, width, height}`, `description`.

### Funding
`PUT /v2/carriers/{carrier_id}/add_funds` → body `{ currency, amount }` → réponse `{ balance: { currency, amount } }`.

---

## 3.9 Objet `Warehouse` v2

| Champ | Type |
|---|---|
| `warehouse_id` | string |
| `name` | string |
| `is_default` | boolean \| null |
| `created_at` | string |
| `origin_address` | Address (v2) |
| `return_address` | Address (v2) |

---

## 3.10 Tracking v2

| Champ | Type | Requis | Description |
|---|---|---|---|
| `tracking_number` | string | ✅ | Format dépendant du transporteur |
| `tracking_url` | string | ✅ | Page de suivi du transporteur |
| `status_code` | string (enum) | ✅ | Voir §4.13 |
| `status_detail_code` | string (enum) | | 60+ codes granulaires |
| `status_description` | string | | |
| `status_detail_description` | string | | |
| `carrier_code` | string | ✅ | |
| `carrier_id` | integer | ✅ | |
| `carrier_status_code` | string | ✅ | Code brut du transporteur |
| `carrier_detail_code` | string | ✅ | |
| `carrier_status_description` | string | | |
| `ship_date` | string | | |
| `estimated_delivery_date` | string | | |
| `actual_delivery_date` | string | | |
| `exception_description` | string | | |
| `events` | TrackingEvent[] | ✅ | Historique |

### `TrackingEvent`
**Requis :** `occurred_at` (UTC), `city_locality`, `state_province`, `postal_code`, `carrier_detail_code`, `status_code`, `status_description`, `carrier_status_code`, `carrier_status_description`.
**Optionnels :** `carrier_occurred_at` (heure locale du transporteur), `description`, `country_code`, `company_name`, `signer`, `event_code`, `status_detail_code`, `status_detail_description`, `latitude`, `longitude`, `proof_of_delivery_url`.

> **Double horodatage à répliquer :** `occurred_at` (UTC normalisé) et `carrier_occurred_at` (heure locale brute). Ne pas les confondre.

---

## 3.11 Webhooks v2

### Objet `Webhook`
| Champ | Type |
|---|---|
| `webhook_id` | string (`se-28529731`) |
| `url` | string |
| `event` | string (enum) |
| `headers` | `{key, value}[]` — en‑têtes personnalisés |
| `name` | string |
| `store_id` | integer |

### Les 13 types d'événements v2
| Événement | `resource_type` du payload | Description |
|---|---|---|
| `track` | — | Mise à jour de suivi (payload **complet** avec `events[]`) |
| `batch` | `API_BATCH` | Traitement de lot terminé |
| `rate` | `API_RATE` | Tarifs d'expédition mis à jour |
| `carrier_connected` | `API_CARRIER_CONNECTED` | Compte transporteur connecté |
| `report_complete` | `API_REPORT_COMPLETE` | Rapport généré |
| `order_source_refresh_complete` | `API_ORDER_SOURCE_REFRESH_COMPLETE` | Synchro de source de commandes terminée |
| `sales_orders_imported` | `API_SALES_ORDERS_IMPORTED` | Commandes importées (bêta) — payload complet |
| `batch_processed_v2` | — | Nouvelle génération |
| `fulfillment_rejected_v2` | — | |
| `fulfillment_shipped_v2` | — | |
| `label_created_v2` | — | |
| `shipment_created_v2` | — | |
| `track_event_v2` | — | |

> **Deux générations coexistent** : les événements « classiques » (thin, avec `resource_url`) et les `*_v2` (payloads plus riches). Le webhook `track` est le seul « classique » à porter un payload complet.

---

<a name="4"></a>
