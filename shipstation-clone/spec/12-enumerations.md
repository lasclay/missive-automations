# 12. Énumérations complètes

> Extrait de la spec ShipStation — Lasclay. Voir `00-INDEX.md` pour la carte complète.
> Libellés d'UI en anglais (langue source du produit). `[à vérifier]` = non confirmé par une source officielle.

# 4. Énumérations complètes

## 4.1 `orderStatus` (v1)
| Valeur API | Libellé UI | Sémantique |
|---|---|---|
| `awaiting_payment` | Awaiting Payment | Non payée, non expédiable |
| `awaiting_shipment` | Awaiting Shipment | Payée, prête à expédier |
| `pending_fulfillment` | Pending Fulfillment | Déléguée à un prestataire, pas encore traitée |
| `shipped` | Shipped | Expédiée (étiquette imprimée ou marquée expédiée) |
| `on_hold` | On Hold | En attente (manuelle ou par règle d'automatisation) |
| `cancelled` | Cancelled | Annulée dans ShipStation |
| `rejected_fulfillment` | Rejected Fulfillment | Rejetée par le prestataire de fulfillment |

## 4.2 `confirmation` — types de confirmation de livraison
**v1 (5 valeurs) :** `none`, `delivery`, `signature`, `adult_signature`, `direct_signature` (FedEx uniquement).
**v2 (9 valeurs) :** `none`, `delivery`, `signature`, `adult_signature`, `direct_signature`, `delivery_mailed`, `verbal_confirmation`, `delivery_code`, `age_verification_16_plus`.

## 4.3 `packageCode` — types de colis (exemple USPS/Stamps)
`cubic` · `dvd_flat_rate_box` · `flat_rate_envelope` · `flat_rate_legal_envelope` · `flat_rate_padded_envelope` · `large_envelope_or_flat` · `large_flat_rate_box` · `large_package` (côté > 12") · `large_video_flat_rate_box` · `letter` · `medium_flat_rate_box` · `package` · `regional_rate_box_a` · `regional_rate_box_b` · `regional_rate_box_c` · `small_flat_rate_box` · `thick_envelope`

Chaque code porte des drapeaux `domestic` / `international` distincts (ex. `cubic` = domestique seulement ; `dvd_flat_rate_box` = international seulement).
> La liste est **dépendante du transporteur** : il faut interroger `listpackages` par transporteur. `package` est le code générique universel.

## 4.4 `insuranceOptions.provider` / `insurance_provider`
**v1 :** `shipsurance`, `carrier`, `provider`, `xcover`, `parcelguard`
**v2 :** `none`, `shipsurance`, `parcelguard`, `xcover`, `carrier`, `third_party`

## 4.5 `carrierCode` — codes transporteur courants
Confirmés dans la doc : `stamps_com`, `ups`, `fedex`, `endicia`, `express_1`, `dhl_express`, `usps`, `newgistics`.
> `[à vérifier]` La liste exhaustive n'est pas publiée ; elle dépend des comptes connectés. Il faut la découvrir dynamiquement via `GET /carriers`. Autres codes fréquemment rencontrés en pratique : `globalpost`, `dhl_ecommerce`, `ontrac`, `canada_post`, `australia_post`, `royal_mail`, `sendle`, `apc`, `asendia`, `firstmile`, `purolator_ca`, `dhl_express_canada`, `dhl_express_uk`, `dhl_express_au`, `seko`.

## 4.6 `contents` — types de contenu douanier
**v1 (5) :** `merchandise`, `documents`, `gift`, `returned_goods`, `sample`
**v2 (8) :** `merchandise`, `documents`, `gift`, `returned_goods`, `sample`, `e_commerce_goods`, `commercial_sale_of_goods_b2b`, `other` (nécessite `contents_explanation`)

## 4.7 `terms_of_trade_code` — Incoterms (v2)
`exw` · `fca` · `cpt` · `cip` · `dpu` · `dap` · `ddp` · `fas` · `fob` · `cfr` · `cif` · `ddu` · `daf` · `deq` · `des`

## 4.8 `identifier_type` — identifiants fiscaux (v2)
`vat` · `eori` · `ssn` · `ein` · `tin` · `ioss` · `pan` · `voec` · `pccc` · `oss` · `passport` · `abn` · `ukims`
`taxable_entity_type` : `shipper` · `recipient` · `ior`

## 4.9 `nonDelivery` / `non_delivery`
`return_to_sender` · `treat_as_abandoned`

## 4.10 `order_source_code` (v2) — 20 valeurs
`amazon_ca` · `amazon_us` · `brightpearl` · `channel_advisor` · `cratejoy` · `ebay` · `etsy` · `jane` · `groupon_goods` · `magento` · `paypal` · `seller_active` · `shopify` · `stitch_labs` · `squarespace` · `three_dcart` · `tophatter` · `walmart` · `woo_commerce` · `volusion`

## 4.11 Unités, formats et divers

| Enum | Valeurs |
|---|---|
| Poids v1 (`units`) | `pounds`, `ounces`, `grams` |
| Poids v2 (`unit`) | `pound`, `ounce`, `gram`, `kilogram` |
| Dimensions v1 (`units`) | `inches`, `centimeters` |
| Dimensions v2 (`unit`) | `inch`, `centimeter` |
| XML custom store — poids | `Pounds`, `Ounces`, `Grams` |
| XML custom store — dimensions | `Inch`, `Centimeter` |
| `label_format` | `pdf`, `png`, `zpl` |
| `label_layout` | `4x6`, `letter` |
| `label_download_type` | `url`, `inline` |
| `display_scheme` | `label`, `paperless`, `label_and_paperless` |
| `validate_address` | `no_validation`, `validate_only`, `validate_and_clean` |
| `charge_event` | `carrier_default`, `on_creation`, `on_carrier_acceptance` |
| Label `status` | `processing`, `completed`, `error`, `voided` |
| `void_type` | `refund_assist`, `manual` |
| `refund_status` | `request_scheduled`, `pending`, `approved`, `rejected`, `excluded` |
| `address_residential_indicator` | `unknown`, `yes`, `no` |
| Statut de validation d'adresse v2 | `unverified`, `verified`, `warning`, `error` |
| Statut de validation d'adresse v1 | `Address not yet validated`, `Address validated successfully`, `Address validation warning`, `Address validation failed` |
| `bill_to_party` v2 | `recipient`, `third_party` |
| `billToParty` v1 | `my_account`, `my_other_account`, `recipient`, `third_party` |
| `origin_type` | `pickup`, `drop_off` |
| `movement_indicator` | `c2c`, `b2c`, `c2b`, `b2b` |
| COD `payment_type` | `any`, `cash`, `cash_equivalent`, `none` |
| `packaging_group` | `i`, `ii`, `iii` |
| `transport_mean` | `ground`, `water`, `cargo_aircraft_only`, `passenger_aircraft` |
| `regulation_level` | `lightly_regulated`, `fully_regulated`, `limited_quantities`, `excepted_quantity` |
| `packaging_instruction_section` | `section_1`, `section_2`, `section_1a`, `section_1b` |
| `regulated_content_type` | `day_old_poultry`, `other_live_animal` |
| `manufacturer_product_id_type` | `undefined`, `gtin`, `ean`, `isbn`, `upc`, `mpn`, `sku` |
| `rate_type` | `check`, `shipment` |
| `validation_status` (rate) | `valid`, `invalid`, `has_warnings`, `unknown` |
| `rate_response.status` | `working`, `completed`, `partial`, `error` |
| `rate_attributes` / stratégies rate shopper | `cheapest`, `fastest`, `best_value` |
| `connection_status` (carrier) | `pending_approval`, `approved` |
| Manifest `status` | `in_progress`, `completed` |
| `error_source` | `carrier`, `order_source`, `ShipStation`, `shipengine` |
| `error_type` | `account_status`, `business_rules`, `validation`, `security`, `system`, `integrations` |
| Couleurs de tag | hex libre `#RRGGBB` (pas d'enum fermé) |

### `error_code` (v2) — liste complète
`auto_fund_not_supported` · `batch_cannot_be_modified` · `carrier_conflict` · `carrier_disconnected` · `carrier_not_connected` · `carrier_not_supported` · `confirmation_not_supported` · `default_warehouse_cannot_be_deleted` · `field_conflict` · `field_value_required` · `forbidden` · `identifier_conflict` · `identifiers_must_match` · `insufficient_funds` · `invalid_address` · `invalid_billing_plan` · `invalid_field_value` · `invalid_identifier` · `invalid_status` · `invalid_string_length` · `label_images_not_supported` · `meter_failure` · `order_source_not_active` · `rate_limit_exceeded` · `refresh_not_supported` · `request_body_required` · `return_label_not_supported` · `settings_not_supported` · `subscription_inactive` · `terms_not_accepted` · `tracking_not_supported` · `trial_expired` · `unauthorized` · `unknown` · `unspecified` · `verification_failure` · `warehouse_conflict` · `webhook_event_type_conflict` · `customs_items_required` · `incompatible_paired_labels` · `invalid_charge_event` · `invalid_object` · `no_rates_returned`

## 4.12 `batch.status` (8 valeurs)
`open` · `queued` · `processing` · `completed` · `completed_with_errors` · `archived` · `notifying` · `invalid`

## 4.13 Statuts de suivi

### `status_code` (haut niveau, 8 valeurs)
| Code | Signification | `tracking_status` du label |
|---|---|---|
| `UN` | Unknown | `unknown` |
| `AC` | Accepted | — |
| `IT` | In Transit | `in_transit` |
| `DE` | Delivered | `delivered` |
| `EX` | Exception | `error` |
| `AT` | Delivery Attempt | — |
| `NY` | Not Yet In System | `in_transit` |
| `SP` | Delivered To The Collection Location | `delivered_to_service_point` |

### `status_detail_code` (60+ codes granulaires — extraits)
- **Pré‑expédition :** `AWAITING_DESPATCH`, `COLLECTION_REQUESTED`, `COLLECTION_MADE`
- **En transit :** `DESPATCHED`, `IN_TRANSIT`, `HUB_SCAN_OUT`, `OUT_FOR_DELIVERY`
- **Livraison :** `DELIVERED`, `ATTEMPTED_DELIVERY`, `ATTEMPTED_DELIVERY_2ND`, `ATTEMPTED_DELIVERY_3RD`
- **Douane :** `CUSTOMS_CLEARED`, `CUSTOMS_PROCESSING`, `HELD_BY_CUSTOMS`
- **Exceptions :** `PARCEL_LOST`, `PARCEL_DAMAGED`, `REFUSED_BY_CUSTOMER`, `RETURN_TO_SENDER`, `CANCELLED`
- **Lieux alternatifs :** `DELIVERED_TO_NEIGHBOUR`, `DELIVERED_TO_PO_BOX`, `DELIVERED_SPECIFIED_SAFE_PLACE`, `DELIVERED_TO_LOCKER_COLLECTION_POINT`

`[à vérifier]` La liste exhaustive des 60+ codes est disponible dans `docs.shipstation.com/openapi/tracking/get_tracking_log.md`.

---

<a name="5"></a>
