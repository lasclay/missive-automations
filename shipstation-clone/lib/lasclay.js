/**
 * Configuration réelle du compte Lasclay — la charge utile de migration.
 *
 * Ce fichier contient ce qu'**aucune API ne rend** : les 11 règles d'automatisation, les
 * 27 vues sauvegardées, les 17 préréglages d'expédition, les 17 types de colis, les 6
 * étiquettes et les mappings de service. Tout vient de la spécification
 * SHIPSTATIONSPECLASCLAY (§12.4, §12.5, §13), relevée sur l'API interne du navigateur
 * authentifié — c'est la seule voie d'extraction possible, et c'est ce qui rend la sortie
 * de ShipStation réversible.
 *
 * Trois pièges de migration sont reproduits **volontairement**, ne pas les « corriger » :
 *
 *   • `DDD ` porte une **espace finale** (§12.4, règle 10). C'est la valeur qui sert de clé
 *     de regroupement dans les rapports existants ; la nettoyer casserait l'historique.
 *   • La liste d'exclusion des vues 1/2/3/13 contient une **barre verticale isolée** `"|"`,
 *     qui est une vraie valeur d'exclusion et non un séparateur : elle écarte les SKU
 *     composites du type `4459028||8x10|digital-print|none` (tirages Jean-Simon Begin).
 *   • Le préréglage « 11x11x12 » déclare **10 g** pour une boîte de 11 × 11 × 12 po. C'est
 *     manifestement faux, mais c'est l'état du compte : la valeur est reprise telle quelle
 *     et signalée dans `notes`, pour que la correction soit une décision, pas un effet de
 *     bord de la migration.
 *
 * Une divergence assumée par rapport à ShipStation : **l'ordre des règles 2 et 3 est
 * inversé**. Voir `REGLES` ci-dessous.
 */
const { all, one, run, tx, dump, parse, maintenant, poserReglage, journaliser } = require("./db");

// ================================================================ référentiels

/** Emplacements d'expédition (§13.2) — cinq entités logistiques dans un seul compte. */
const ENTREPOTS = [
  { id: 153232, name: "LAS Capucins", is_default: 1, origin_address: {
      name: "Lasclay", company: "Lasclay", street1: "254 Boulevard des Capucins",
      city: "Québec", state: "QC", postalCode: "G1J 3R4", country: "CA" } },
  { id: 372441, name: "Jean-Simon Begin", is_default: 0, origin_address: {
      name: "Jean-Simon Begin", company: "Photographe animalier", street1: "298 Boulevard des Capucins",
      city: "Québec", state: "QC", postalCode: "G1J 3R4", country: "CA" } },
  { id: 463467, name: "Lasclay JCC", is_default: 0, origin_address: {
      name: "Lasclay JCC", company: "JCC", street1: "839 27e Rue",
      city: "Saint-Zacharie", state: "QC", postalCode: "G0M 2C0", country: "CA" } },
  { id: 601259, name: "Monarch Botanika", is_default: 0, origin_address: {
      name: "Monarch Botanika", company: "Monarch Botanika", street1: "1565 Calle La Cumbre",
      city: "Camarillo", state: "CA", postalCode: "93010", country: "US" } },
  { id: 590291, name: "Unique Plastique", is_default: 0, origin_address: {
      name: "Unique Plastique", company: "Unique Plastique", street1: "16 rue du Tisserand",
      city: "Lévis", state: "QC", postalCode: "G6V 7E4", country: "CA" } },
];

/** Boutiques (§13.1). Le GUID est ce que référencent les règles et les vues. */
const BOUTIQUES = [
  { id: 198670, name: "LAS Shopify", marketplace: "shopify", active: 1, auto_refresh: 1,
    guid: "93980608-de51-43e7-8380-4553fa960626" },
  { id: 198711, name: "LAS Etsy", marketplace: "etsy", active: 1, auto_refresh: 1,
    guid: "082beef5-09ed-4983-9b57-98a00ae6e417" },
  { id: 361089, name: "FAIRE Lasclay", marketplace: "faire", active: 1, auto_refresh: 1,
    guid: "4e156b52-86a2-4c9f-b823-fda8c1662bdb",
    settings: { alerte: "Failed to import chez ShipStation depuis le 27/05/2026 — à rebrancher ici" } },
  // Manuelle : exclue du rafraîchissement automatique par construction. Le compteur
  // « 3 Active Stores » de ShipStation vient de là ; ici la distinction est nommée.
  { id: 194366, name: "Manual Orders", marketplace: "manual", active: 1, auto_refresh: 0,
    guid: "4def72a0-cae5-4f28-89e9-dd94d7a5c543" },
  { id: 256900, name: "Fake Poparide Store", marketplace: "shopify", active: 0, auto_refresh: 0 },
  { id: 360675, name: "JS begin", marketplace: "autre", active: 0, auto_refresh: 0 },
  { id: 368792, name: "JSB - SHOPIFY", marketplace: "shopify", active: 0, auto_refresh: 0 },
  { id: 368332, name: "New Shopify Store", marketplace: "shopify", active: 0, auto_refresh: 0 },
  { id: 371264, name: "New Shopify Store (2)", marketplace: "shopify", active: 0, auto_refresh: 0 },
  { id: 371961, name: "TSURU COUTEAUX", marketplace: "shopify", active: 0, auto_refresh: 0 },
  { id: 378993, name: "Unique Plastique", marketplace: "shopify", active: 0, auto_refresh: 0 },
];

/** Transporteurs porteurs de services (§13.3). */
const TRANSPORTEURS = [
  { code: "canada_post", name: "Canada Post", account: "LASCLAY", active: 1, requires_funding: 0 },
  { code: "canada_post_ob", name: "Canada Post One Balance™", account: null, active: 1, requires_funding: 1 },
  { code: "fedex_ob", name: "FedEx One Balance", account: null, active: 1, requires_funding: 1 },
  { code: "ups_walleted", name: "UPS by ShipStation", account: "G98E98", active: 1, requires_funding: 1 },
  { code: "purolator_ob", name: "Purolator Canada One Balance", account: null, active: 1, requires_funding: 1 },
  { code: "dhl_ob", name: "DHL Express One Balance", account: null, active: 1, requires_funding: 1 },
  { code: "canpar_walleted", name: "Canpar One Balance™", account: null, active: 1, requires_funding: 1 },
  { code: "shippingchimp", name: "ShippingChimp", account: null, active: 1, requires_funding: 1 },
];

/**
 * Services Canada Post du compte propre (§13.3), identifiés par leur `serviceId`
 * ShipStation — c'est ce que référencent la règle 6 et les préréglages. `code` porte le
 * code API v1, qui est ce que portent les commandes déjà migrées.
 */
const SERVICES_CP = [
  { id: "98",  code: "regular_parcel", name: "Regular Parcel (Carbon Neutral)", domestic: 1, international: 0, hidden: 1 },
  { id: "99",  code: "expedited_parcel", name: "Expedited Parcel (Carbon Neutral)", domestic: 1, international: 0, defaut: true },
  { id: "100", code: "xpresspost", name: "Xpresspost", domestic: 1, international: 0 },
  { id: "101", code: "xpresspost_certified", name: "Xpresspost Certified", domestic: 1, international: 0, hidden: 1 },
  { id: "102", code: "priority", name: "Priority", domestic: 1, international: 0 },
  { id: "103", code: "library_books", name: "Library Books", domestic: 1, international: 0, hidden: 1 },
  { id: "104", code: "expedited_parcel_usa", name: "Expedited Parcel USA", domestic: 0, international: 1 },
  { id: "105", code: "priority_worldwide_envelope_usa", name: "Priority Worldwide Envelope USA", domestic: 0, international: 1 },
  { id: "106", code: "priority_worldwide_pak_usa", name: "Priority Worldwide pak USA", domestic: 0, international: 1 },
  { id: "107", code: "priority_worldwide_parcel_usa", name: "Priority Worldwide Parcel USA", domestic: 0, international: 1 },
  { id: "108", code: "small_packet_usa_air", name: "Small Packet Air - USA", domestic: 0, international: 1 },
  { id: "109", code: "tracked_packet_usa", name: "Tracked Packet - USA", domestic: 0, international: 1 },
  { id: "110", code: "tracked_packet_usa_lvm", name: "Tracked Packet - USA (LVM)", domestic: 0, international: 1 },
  { id: "111", code: "xpresspost_usa", name: "Xpresspost USA", domestic: 0, international: 1 },
  { id: "112", code: "xpresspost_international", name: "Xpresspost International", domestic: 0, international: 1 },
  { id: "113", code: "international_parcel_air", name: "International Parcel Air", domestic: 0, international: 1 },
  { id: "114", code: "international_parcel_surface", name: "International Parcel Surface", domestic: 0, international: 1 },
  { id: "115", code: "priority_worldwide_envelope_intl", name: "Priority Worldwide Envelope Intl", domestic: 0, international: 1 },
  { id: "116", code: "priority_worldwide_pak_intl", name: "Priority Worldwide pak Intl", domestic: 0, international: 1 },
  { id: "117", code: "priority_worldwide_parcel_intl", name: "Priority Worldwide parcel Intl", domestic: 0, international: 1 },
  { id: "118", code: "small_packet_international_air", name: "Small Packet International Air", domestic: 0, international: 1 },
  { id: "119", code: "small_packet_international_surface", name: "Small Packet International Surface", domestic: 0, international: 1 },
  { id: "120", code: "tracked_packet_international", name: "Tracked Packet - International", domestic: 0, international: 1 },
];

/** Codes de confirmation (§13.3). Le 5 est propre à Canada Post et central chez Lasclay. */
const CONFIRMATIONS = [
  { id: "0", nom: "Aucune confirmation" },
  { id: "1", nom: "Confirmation de livraison" },
  { id: "2", nom: "Signature requise" },
  { id: "5", nom: "Do Not Safe Drop", note: "Canada Post — ne pas laisser à la porte" },
];

/** Types de colis personnalisés (§13.4). `souple` = pas de dimensions rigides. */
const COLIS = [
  { id: "115317", name: "Polymailer Small", souple: true },
  { id: "115318", name: "Polymailer Medium", souple: true },
  { id: "123516", name: "Kraft mailer", souple: true },
  { id: "133384", name: "Petite enveloppe kraft", souple: true },
  { id: "126003", name: "7.5 x 2.5 x 4.5", dimensions: { length: 7.5, width: 4.5, height: 2.5, units: "inches" } },
  { id: "123521", name: "Boite 8.5 x 4 x 4", dimensions: { length: 8.5, width: 4, height: 4, units: "inches" } },
  { id: "124753", name: "box 6x6x6", dimensions: { length: 6, width: 6, height: 6, units: "inches" } },
  { id: "115209", name: "Box 12 x 6 x 6", dimensions: { length: 12, width: 6, height: 6, units: "inches" } },
  { id: "115939", name: "Box 12 x 12 x 6", dimensions: { length: 12, width: 12, height: 6, units: "inches" } },
  { id: "115962", name: "Box 18.5 x 14 x 7", dimensions: { length: 18.5, width: 14, height: 7, units: "inches" } },
  { id: "135865", name: "box 11x11x12", dimensions: { length: 11, width: 11, height: 12, units: "inches" } },
  { id: "135864", name: "boite casse tete JSB", dimensions: { length: 16, width: 6.5, height: 6, units: "inches" } },
  { id: "127886", name: "JSB 1 LIVRE", dimensions: { length: 12.5, width: 12.5, height: 2, units: "inches" } },
  { id: "127887", name: "JSB Calendrier Box", dimensions: { length: 19.5, width: 12, height: 4, units: "inches" } },
  { id: "127888", name: "JSB Grosse boite", dimensions: { length: 17, width: 12, height: 12, units: "inches" } },
  { id: "127879", name: "JSB Kft 12x19", souple: true },
  { id: "133007", name: "JSB Couteaux", dimensions: { length: 18, width: 4, height: 3.5, units: "inches" } },
  // Type générique du transporteur, référencé par le préréglage « 9x6x2 ».
  { id: "package", name: "Package", generique: true },
];

/** Étiquettes (§13.7) — identifiants et couleurs repris tels quels (la vue 10 vise 37367). */
const ETIQUETTES = [
  { id: 37964, name: "JSB traité par LASCLAY", color: "#FF00FF" },
  { id: 43269, name: "Non expédiable avec Chit Chats", color: "#FF0000" },
  { id: 37367, name: "Non expédié", color: "#FFCC00" },
  { id: 15051, name: "Priority", color: "#FF6600" },
  { id: 37675, name: "Réexpédition", color: "#00FF00" },
  { id: 10614, name: "Timbre", color: "#00CCFF" },
];

const po = (l, w, h) => ({ length: l, width: w, height: h, units: "inches" });

/** Préréglages d'expédition (§13.5). `hotkey` est un ajout : ShipStation n'en avait aucun. */
const PRESETS = [
  { name: "11x11x12", warehouse_id: 153232, package_id: "135865", confirmation: "5", service_id: "99",
    weight_g: 10, dimensions: po(11, 11, 12), hotkey: "1",
    notes: "10 g pour une boîte 11×11×12 po : valeur du compte ShipStation, manifestement erronée — à corriger sciemment." },
  { name: "7.5 x 2.5 x 4.5", warehouse_id: 153232, package_id: "126003", confirmation: "5", service_id: "99",
    weight_g: 80, dimensions: po(7.5, 4.5, 2.5), hotkey: "2" },
  { name: "9x6x2", warehouse_id: 590291, package_id: "package", confirmation: "5", service_id: "99",
    weight_g: 60, dimensions: po(9, 6, 2) },
  { name: "Boite 8.5x4x4", warehouse_id: 153232, package_id: "123521", confirmation: "5", service_id: "99",
    weight_g: 500, dimensions: po(8.5, 4, 4), hotkey: "3" },
  { name: "box 6x6x6", warehouse_id: 153232, package_id: "124753", confirmation: "5", service_id: "99",
    weight_g: 100, dimensions: po(6, 6, 6), hotkey: "4" },
  { name: "kraft mailer 6x9", warehouse_id: 153232, package_id: "123516", confirmation: "5", service_id: "99",
    weight_g: 100, hotkey: "5" },
  { name: "Small Poly 1 mit", warehouse_id: 153232, package_id: "115317", confirmation: "5", service_id: "99",
    weight_g: 100, hotkey: "6" },
  { name: "USA Small poly", warehouse_id: 153232, package_id: "115317", confirmation: "1", service_id: "109",
    weight_g: 100, hotkey: "7" },
  { name: "prorec", warehouse_id: 153232, package_id: "127888", confirmation: "2", service_id: "102",
    weight_g: 9000, dimensions: po(20, 19, 18),
    notes: "Dimensions déclarées (20×19×18) supérieures au type de colis « JSB Grosse boite » (17×12×12) : le préréglage prime, comme chez ShipStation." },
  { name: "boite 1 casse tete JSB", warehouse_id: 372441, package_id: "135864", confirmation: "5", service_id: "99",
    dimensions: po(16, 6.5, 6) },
  { name: "Boite Blanche", warehouse_id: 372441, package_id: "127887", confirmation: "5", service_id: "99",
    dimensions: po(19.5, 12, 4) },
  { name: "JBS Combo livre", warehouse_id: 372441, package_id: "115939", confirmation: "5", service_id: "99",
    weight_g: 2005, dimensions: po(12, 12, 6) },
  { name: "JSB 1Livre", warehouse_id: 372441, package_id: "127886", confirmation: "5", service_id: "99",
    dimensions: po(12.5, 12.5, 2) },
  { name: "JSB Couteaux Tsuru", warehouse_id: 372441, package_id: "133007", confirmation: "2", service_id: "99",
    weight_g: 600, dimensions: po(18, 4, 3.5) },
  { name: "JSB Grosse boite", warehouse_id: 372441, package_id: "127888", confirmation: "5", service_id: "99",
    dimensions: po(17, 12, 12) },
  { name: "JSB Kraft", warehouse_id: 372441, package_id: "127879", confirmation: "5", service_id: "99", weight_g: 900 },
  { name: "JSB Poly", warehouse_id: 372441, package_id: "115318", confirmation: "5", service_id: "99", weight_g: 900 },
].map((p, i) => ({ ...p, carrier_code: "canada_post", position: i + 1 }));

/**
 * Mappings de service (§13.6) — libellé du checkout → service réel.
 *
 * `channel` est l'ajout de fond : chez ShipStation les canaux logistiques de Lasclay
 * (ramassage à l'entrepôt, Défricheuses, DDD, timbre) n'existent que comme sous-chaînes
 * cherchées dans un texte libre saisi dans Shopify. Une faute de frappe côté boutique et la
 * règle ne se déclenche plus, sans rien signaler (constat OBS6).
 */
const MAPPINGS = [
  { requested: "Canada Post Expedited Parcel", channel: "colis", carrier_code: "canada_post", service_id: "99", package_id: "package" },
  { requested: "Free Shipping", channel: "colis", carrier_code: "canada_post", service_id: "99", package_id: "package" },
  { requested: "Free Shipping / Livraison gratuite", channel: "colis", carrier_code: "canada_post", service_id: "99", package_id: "package" },
  { requested: "Standard", channel: "colis", carrier_code: "canada_post", service_id: "99", package_id: "package" },
  { requested: "Stamp (no tracking)", channel: "timbre", carrier_code: "canada_post", service_id: "99", package_id: "115317" },
  { requested: "timbre", channel: "timbre", carrier_code: "canada_post", service_id: "99", package_id: "115317" },
  { requested: "Entrepôt Lasclay", channel: "ramassage", carrier_code: null, service_id: null, package_id: null },
  { requested: "ramassage", channel: "ramassage", carrier_code: null, service_id: null, package_id: null },
  { requested: "capucins", channel: "ramassage", carrier_code: null, service_id: null, package_id: null },
  { requested: "Défricheuses", channel: "defricheuses", carrier_code: null, service_id: null, package_id: null },
  { requested: "DDD", channel: "ddd", carrier_code: null, service_id: null, package_id: null },
].map((m, i) => ({ store_id: 198670, match_mode: "contains", position: i + 1, ...m }));

// ================================================================== règles

const SERVICES_CP_CANADA = ["98", "99", "100", "101", "102",
  "regular_parcel", "expedited_parcel", "xpresspost", "xpresspost_certified", "priority"];

/**
 * Les 11 règles (§12.4), dans l'ordre d'exécution **corrigé**.
 *
 * Chez ShipStation, la règle « LAS Cost Centre » (ordre 2) filtre sur
 * `ShipFromId ∈ {153232}` et écrit `CustomField3 = LASCLAY`, tandis que la règle
 * « Warehouse Selection » (ordre 3) *assigne* justement cet entrepôt. Le filtre s'évaluant
 * sur l'état courant, la règle de centre de coût ne se déclenche jamais pour les commandes
 * que la suivante va rattacher : le centre de coût de facturation Postes Canada reste vide
 * là où il compte. Les deux règles sont donc inversées ici, ce que la spécification
 * recommande explicitement. L'ordre ShipStation d'origine est conservé dans `notes`.
 *
 * L'ordre 8 correspond à une règle supprimée chez ShipStation ; deux filtres orphelins
 * (`ShippingPaid < 1`, `ShippingPaid < 2.99`) subsistent sans règle. Ils ne sont pas repris.
 */
const REGLES = [
  {
    name: "Default Confirmation", position: 1, enabled: true, sans_condition: true,
    conditions: [], actions: [{ type: "set_confirmation", value: "0" }],
    notes: "ShipStation ordre 1. Filtre vide = toutes les commandes ; rendu explicite par sans_condition.",
  },
  {
    name: "LAS Incoming Orders Warehouse Selection", position: 2, enabled: true,
    conditions: [{ field: "store_id", op: "dans", value: ["198670", "198711", "194366"] }],
    actions: [{ type: "set_warehouse", value: 153232 }],
    notes: "ShipStation ordre 3 — remontée avant le centre de coût (voir en-tête). Boutiques : LAS Shopify, LAS Etsy, Manual Orders.",
  },
  {
    name: "LAS Cost Centre (Postes Canada Billing)", position: 3, enabled: true,
    conditions: [{ field: "warehouse_id", op: "dans", value: ["153232"] }],
    actions: [{ type: "set_custom_field3", value: "LASCLAY" }],
    notes: "ShipStation ordre 2 — descendue après l'affectation d'entrepôt, sans quoi elle ne se déclenche jamais.",
  },
  {
    name: "1x Sac Lunch Package Dimensions Expedited", position: 4, enabled: true,
    conditions: [
      { field: "item_sku", op: "commence_par", scope: "any", value: ["LUNCHB-23"] },
      { field: "requested_service", op: "contient", value: ["Expedited", "Free Shipping"] },
      { field: "quantity", op: "egal_num", value: 1 },
    ],
    actions: [{ type: "set_service", value: { carrier_code: "canada_post", service_id: "99", package_id: "115317" } }],
    notes: "Cas mono-article : c'est précisément la limite du moteur ShipStation. Ici la portée « any » est déclarée.",
  },
  {
    name: "1x MIT Package Dimensions Expedited", position: 5, enabled: true,
    conditions: [
      { field: "item_sku", op: "commence_par", scope: "any", value: ["MIT"] },
      { field: "quantity", op: "egal_num", value: 1 },
    ],
    actions: [{ type: "set_service", value: { carrier_code: "canada_post", service_id: "99", package_id: "115317" } }],
  },
  {
    name: "Do Not Safe Drop Auto", position: 6, enabled: true,
    conditions: [{ field: "service_id", op: "dans", value: SERVICES_CP_CANADA }],
    actions: [{ type: "set_confirmation", value: "5" }],
    notes: "Services Canada Post domestiques. Les valeurs numériques (identifiants ShipStation) et les codes API " +
           "sont tous deux listés : les commandes migrées portent le code, les nouvelles portent l'identifiant.",
  },
  {
    name: "LAS Incoming Orders USA", position: 7, enabled: true,
    conditions: [{ field: "is_international", op: "vrai" }],
    actions: [{ type: "set_custom_field2", value: "USA" }],
    notes: "CF2 = zone. Nommée « USA » mais déclenchée par tout envoi hors Canada.",
  },
  {
    name: "LAS Incoming Orders LOCAL", position: 8, enabled: true,
    conditions: [{ field: "requested_service", op: "contient", value: ["Entrepôt Lasclay"] }],
    actions: [{ type: "set_custom_field1", value: "CAPUCINS LOCAL" }],
  },
  {
    name: "LAS Incoming Orders DDD", position: 9, enabled: true,
    conditions: [{ field: "requested_service", op: "contient", value: ["DDD"] }],
    actions: [{ type: "set_custom_field1", value: "DDD " }],
    notes: "La valeur « DDD » porte une espace finale dans le compte ShipStation. Reprise telle quelle : " +
           "c'est la clé de regroupement des rapports existants.",
  },
  {
    name: "LAS Incoming Orders DDD email", position: 10, enabled: false,
    conditions: [{ field: "requested_service", op: "contient", value: ["DDD"] }],
    actions: [{ type: "email", value: { to: "info@boutiqueddd.com", template: "DDD Template",
      subject: "Nouvelle commande à préparer" } }],
    notes: "Inactive chez ShipStation — reprise inactive. Sous-traitance par courriel vers la boutique DDD.",
  },
  {
    name: "LAS Incoming Orders Lucie", position: 11, enabled: true,
    conditions: [{ field: "item_name", op: "contient", scope: "any", value: ["Bague", "Pendentif"] }],
    actions: [{ type: "email", value: { to: "lucieveilleux@live.ca", template: "Lucie Veilleux",
      subject: "Nouvelle commande de bijoux" } }],
    notes: "Sous-traitance par courriel (bijoux monarque).",
  },
];

// =================================================================== vues

/**
 * Liste E — exclusion partagée par les vues 1, 2, 3 et 13 (§12.5).
 * Le `"|"` est une valeur d'exclusion à part entière : il écarte les SKU composites.
 */
const LISTE_E = ["22", "23", "SEEDBMB", "21", "20", "|"];

const GRAINES = (suffixe) => [
  `ASCL-SYRIACA-1.25ML-${suffixe}`,
  `ASCL-INCARNATA-1ML-${suffixe}`,
  `ASCL-TUBEROSA-1ML-${suffixe}`,
  `ASCL-SPECIOSA-1ML-${suffixe}`,
];

/** Les 18 termes d'exclusion des vues « bombes en petite enveloppe » (11 et 12). */
const TERMES_NON_BOMBES = ["plantules", "pantoufles", "mitaines", "tuque", "sac", "besace", "foulard",
  "cache-cou", "bandeau", "semelles", "maniques", "sous-plat", "crème", "nettoyant", "bague",
  "pendentif", "boucles", "coussin"];

const CANAUX_HORS_COLIS = ["timbre", "entrepôt", "ramassage", "capucins", "défricheuses"];

const CASSE_TETES = ["Casse-tête - Caribou automne", "Casse-tête - Huard", "Casse-tête - Orignal"];

/**
 * Les 27 vues sauvegardées (§12.5), traduites dans le langage de critères commun.
 *
 * Elles encodent l'essentiel du savoir de l'entrepôt : le seuil de 73 g qui sépare le tarif
 * timbre du colis, les seuils de 65 $ / 80 $ pour les bombes semencières, le zonage QC+ON,
 * et la convention « kaseme » dans la note de l'acheteur qui sort une commande du flux.
 *
 * Les exclusions d'articles sont exprimées avec la portée `none` (« aucun article ne
 * contient… »), qui est la lecture non ambiguë du `DoesNotContain` de ShipStation sur une
 * commande multi-articles.
 */
const VUES = [
  { name: "Graines x1", criteres: [
    { field: "item_sku", op: "contient", scope: "none", value: LISTE_E },
    { field: "item_sku", op: "egal", scope: "any", value: GRAINES("x1") },
    { field: "item_name", op: "contient", scope: "none", value: ["four", "manique", "sous-plat", "bombes"] },
  ] },
  { name: "Graines x5", criteres: [
    { field: "item_sku", op: "contient", scope: "none", value: LISTE_E },
    { field: "item_sku", op: "egal", scope: "any", value: GRAINES("x5") },
    { field: "item_name", op: "contient", scope: "none", value: ["bombes"] },
  ], notes: "Les 4 SKU en -x5 sont dérivés des SKU -x1 : la spécification les résume par « …-x5 ». À confirmer sur le catalogue." },
  { name: "Graines x10", criteres: [
    { field: "item_sku", op: "contient", scope: "none", value: LISTE_E },
    { field: "item_sku", op: "egal", scope: "any", value: GRAINES("x10") },
  ], notes: "Idem : SKU -x10 dérivés." },
  { name: "Échange", criteres: [
    { field: "item_name", op: "contient", scope: "any", value: ["Échange"] },
    { field: "quantity", op: "egal_num", value: 1 },
  ] },
  { name: "USA textile", criteres: [
    { field: "custom_field2", op: "contient", value: ["USA"] },
    { field: "item_name", op: "contient", scope: "none", value: ["graines", "bombes"] },
  ] },
  { name: "CAPUCINS", criteres: [
    { field: "requested_service", op: "egal", value: ["Entrepôt Lasclay"] },
  ] },
  { name: "Défricheuses", criteres: [
    { field: "requested_service", op: "contient", value: ["Défricheuses"] },
  ] },
  { name: "QC-ON", criteres: [
    { field: "country", op: "egal", value: ["CA"] },
    { field: "state", op: "egal", value: ["CA-ON"] },
    { field: "state", op: "egal", value: ["CA-QC"] },
  ], notes: "Deux critères sur la même colonne = OU (§12.3). C'est le cas de test de cette sémantique : " +
            "en ET pur, la vue serait vide." },
  { name: "TIMBRE 2.0", criteres: [
    { field: "country", op: "egal", value: ["CA"] },
    { field: "order_weight", op: "inferieur_egal", value: 73 },
    { field: "requested_service", op: "ne_contient_pas", value: ["défricheuses", "lasclay"] },
  ], notes: "Seuil de 73 g : sépare le tarif timbre (lettre) du colis. Unité = gramme (UnitOfMeasure:Weight)." },
  { name: "Commandes pas encore expédiées", criteres: [
    { field: "tag_id", op: "dans", value: ["37367"] },
  ] },
  { name: "CAN Bmb - petite env.", criteres: [
    { field: "requested_service", op: "ne_contient_pas", value: ["DDD", "Capucins", "Lasclay"] },
    { field: "item_name", op: "contient", scope: "any", value: ["bombes"] },
    { field: "item_name", op: "contient", scope: "none", value: TERMES_NON_BOMBES },
    { field: "country", op: "egal", value: ["CA"] },
    { field: "order_total", op: "inferieur_egal", value: 65 },
  ], notes: "Seuil d'emballage : 65 $ au Canada." },
  { name: "USA Bmb - petite env.", criteres: [
    { field: "item_name", op: "contient", scope: "any", value: ["bombes"] },
    { field: "item_name", op: "contient", scope: "none", value: TERMES_NON_BOMBES },
    { field: "country", op: "different", value: ["CA"] },
    { field: "order_total", op: "inferieur_egal", value: 80 },
  ], notes: "Seuil d'emballage : 80 $ à l'international." },
  { name: "Graines x 1 CAN", criteres: [
    { field: "item_sku", op: "contient", scope: "none", value: LISTE_E },
    { field: "item_sku", op: "egal", scope: "any", value: GRAINES("x1") },
    { field: "item_name", op: "contient", scope: "none", value: ["bombes", "four", "manique", "sous-plat"] },
    { field: "country", op: "egal", value: ["CA"] },
  ] },
  { name: "ROC", criteres: [
    { field: "item_name", op: "contient", scope: "none", value: ["plantules"] },
    { field: "country", op: "egal", value: ["CA"] },
    { field: "order_weight", op: "superieur", value: 73 },
    { field: "item_name", op: "contient", scope: "any", value: TERMES_NON_BOMBES.filter((t) => t !== "plantules") },
    { field: "requested_service", op: "ne_contient_pas", value: ["Défricheuses", "Capucins", "Lasclay"] },
    { field: "state", op: "different", value: ["CA-QC", "CA-ON"] },
  ], a_verifier: true,
     notes: "Rest of Canada. La spécification annonce 20 termes textiles inclus sans les énumérer : " +
            "la liste ci-dessus reprend les 17 termes documentés ailleurs. À recompléter depuis le " +
            "dump de l'Annexe C avant de s'en servir pour décider d'un emballage." },
  { name: "Kaseme - archivage", criteres: [
    { field: "notes_from_buyer", op: "contient", value: ["kaseme"] },
    { field: "quantity", op: "egal_num", value: 0 },
  ], notes: "Convention « kaseme » : mot-clé dans la note de l'acheteur qui sort la commande du flux d'expédition." },
  { name: "Colis Canada", criteres: [
    { field: "country", op: "egal", value: ["CA"] },
    { field: "requested_service", op: "ne_contient_pas", value: CANAUX_HORS_COLIS },
  ] },
  { name: "à expédier JSB (sans kaseme)", criteres: [
    { field: "quantity", op: "superieur", value: 0 },
    { field: "notes_from_buyer", op: "ne_contient_pas", value: ["kaseme"] },
    { field: "item_name", op: "contient", scope: "none", value: ["alu", "impression"] },
  ] },
  { name: "1er dec", criteres: [
    { field: "quantity", op: "superieur", value: 0 },
    { field: "notes_from_buyer", op: "ne_contient_pas", value: ["kaseme"] },
    { field: "item_name", op: "contient", scope: "none", value: ["alu", "impression", "galaxy", "canva"] },
    { field: "item_name", op: "egal", scope: "none", value: CASSE_TETES },
  ], campagne: true, notes: "Vue datée (campagne ponctuelle) — voir constat OBS7 : il manque un objet « campagne »." },
  { name: "Canada", criteres: [{ field: "country", op: "egal", value: ["CA"] }] },
  { name: "à expédier (sans kaseme, canva, alu, impr)", criteres: [
    { field: "quantity", op: "superieur", value: 0 },
    { field: "notes_from_buyer", op: "ne_contient_pas", value: ["kaseme"] },
    { field: "item_name", op: "contient", scope: "none", value: ["alu", "impression", "canva"] },
  ] },
  { name: "concours voyage", criteres: [
    { field: "order_date", op: "entre_dates", value: ["2025-10-18", "2025-12-15"] },
    { field: "order_total", op: "superieur_egal", value: 114 },
    { field: "store_id", op: "egal", value: ["198670"] },
    { field: "country", op: "egal", value: ["CA"] },
  ], campagne: true },
  { name: "Concours prix secondaires", criteres: [
    { field: "order_date", op: "entre_dates", value: ["2025-10-18", "2025-12-15"] },
    { field: "order_total", op: "superieur", value: 25 },
    { field: "country", op: "egal", value: ["CA"] },
    { field: "store_id", op: "egal", value: ["198670"] },
  ], campagne: true },
  { name: "3 mars", criteres: [
    { field: "country", op: "egal", value: ["CA"] },
    { field: "requested_service", op: "ne_contient_pas", value: CANAUX_HORS_COLIS },
  ], campagne: true, a_verifier: true,
     notes: "La spécification mentionne une exclusion de 3 produits précis sans les nommer. " +
            "Le critère manquant n'a pas été inventé : à compléter depuis le dump de l'Annexe C." },
  { name: "Influenceuses 0$", criteres: [{ field: "amount_paid", op: "inferieur", value: 1 }] },
  { name: "Distributeur", criteres: [{ field: "item_name", op: "egal", scope: "any", value: ["Carton"] }] },
  { name: "Kit premium", criteres: [{ field: "amount_paid", op: "egal_num", value: 82.48 }] },
  { name: "Canadiens", criteres: [{ field: "item_name", op: "contient", scope: "any", value: ["Canadiens"] }] },
].map((v, i) => ({ scope: "orders", match_all: true, position: i + 1, ...v }));

// ================================================================ réglages

/** Réglages du compte (§13.9). */
const REGLAGES = {
  unite_poids: "g",
  unite_dimension: "in",
  locale: "fr-CA",           // le compte était en en-CA ; l'interface du clone est en français
  format_date: "DD/MM/YYYY",
  format_heure: "HH:mm",
  devise: "CAD",
  confirmation_defaut: "0",
  service_defaut: "99",
  entrepot_defaut: 153232,
  seuil_timbre_g: 73,
  seuil_bombes_ca: 65,
  seuil_bombes_intl: 80,
  exercice_debut: "09-01",   // 1er septembre — exercice fiscal Lasclay
};

/** Gabarits de courriel référencés par les règles 11 et 12 (§13.8). */
const GABARITS = [
  { name: "DDD Template", kind: "email", subject: "Nouvelle commande à préparer — {{numero}}",
    body: "Bonjour,\n\nUne nouvelle commande est à préparer.\n\nCommande : {{numero}}\nClient : {{client}}\nArticles :\n{{articles}}\n\nMerci,\nLasclay" },
  { name: "Lucie Veilleux", kind: "email", subject: "Nouvelle commande de bijoux — {{numero}}",
    body: "Bonjour Lucie,\n\nUne nouvelle commande de bijoux est arrivée.\n\nCommande : {{numero}}\nClient : {{client}}\nArticles :\n{{articles}}\n\nMerci,\nLasclay" },
];

// ================================================================= chargement

/**
 * Écrit la configuration dans la base. Idempotent : relancer met à jour, ne duplique pas.
 *
 * Ne touche à aucune commande, à aucune expédition. `remplacer` vide d'abord les règles,
 * vues et préréglages — utile pour revenir à l'état ShipStation après avoir bricolé.
 */
function charger({ remplacer = false, journal = () => {} } = {}) {
  const bilan = {};
  tx(() => {
    if (remplacer) {
      run("DELETE FROM rules");
      run("DELETE FROM views WHERE scope = 'orders'");
      run("DELETE FROM shipping_presets");
      run("DELETE FROM service_mappings");
    }

    for (const w of ENTREPOTS) {
      run(`INSERT INTO warehouses (id,name,origin_address,is_default) VALUES (?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, origin_address=excluded.origin_address,
             is_default=excluded.is_default`,
        w.id, w.name, dump(w.origin_address), w.is_default);
    }
    bilan.entrepots = ENTREPOTS.length;

    for (const s of BOUTIQUES) {
      run(`INSERT INTO stores (id,name,marketplace,active,auto_refresh,guid,settings) VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, marketplace=excluded.marketplace,
             active=excluded.active, auto_refresh=excluded.auto_refresh, guid=excluded.guid`,
        s.id, s.name, s.marketplace, s.active, s.auto_refresh, s.guid || null, dump(s.settings || {}));
    }
    bilan.boutiques = BOUTIQUES.length;

    for (const c of TRANSPORTEURS) {
      run(`INSERT INTO carriers (code,name,account,requires_funding,active) VALUES (?,?,?,?,?)
           ON CONFLICT(code) DO UPDATE SET name=excluded.name, account=COALESCE(excluded.account, carriers.account)`,
        c.code, c.name, c.account, c.requires_funding, c.active);
    }
    bilan.transporteurs = TRANSPORTEURS.length;

    for (const s of SERVICES_CP) {
      run(`INSERT INTO services (id,carrier_code,name,domestic,international,code,hidden) VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, code=excluded.code, hidden=excluded.hidden,
             domestic=excluded.domestic, international=excluded.international`,
        s.id, "canada_post", s.name, s.domestic, s.international, s.code, s.hidden ? 1 : 0);
      // Les commandes migrées portent le code API comme identifiant de service : on garde la
      // ligne correspondante et on l'aligne, plutôt que de la supprimer sous les pieds de
      // 38 000 commandes.
      run("UPDATE services SET name = ?, code = ? WHERE id = ? AND id <> ?", s.name, s.code, s.code, s.id);
    }
    bilan.services = SERVICES_CP.length;

    for (const p of COLIS) {
      run(`INSERT INTO packages (id,carrier_code,name,dimensions,custom) VALUES (?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, dimensions=excluded.dimensions, custom=excluded.custom`,
        p.id, p.generique ? null : "canada_post", p.name, dump(p.dimensions || null), p.generique ? 0 : 1);
    }
    bilan.colis = COLIS.length;

    for (const t of ETIQUETTES) {
      run(`INSERT INTO tags (id,name,color) VALUES (?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color`, t.id, t.name, t.color);
      run("UPDATE tags SET color = ? WHERE name = ? AND id <> ?", t.color, t.name, t.id);
    }
    bilan.etiquettes = ETIQUETTES.length;

    for (const p of PRESETS) {
      run(`INSERT INTO shipping_presets (name,warehouse_id,carrier_code,service_id,package_id,confirmation,
             weight_g,dimensions,hotkey,position,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(name) DO UPDATE SET warehouse_id=excluded.warehouse_id, carrier_code=excluded.carrier_code,
             service_id=excluded.service_id, package_id=excluded.package_id, confirmation=excluded.confirmation,
             weight_g=excluded.weight_g, dimensions=excluded.dimensions, hotkey=excluded.hotkey,
             position=excluded.position, notes=excluded.notes`,
        p.name, p.warehouse_id, p.carrier_code, p.service_id, p.package_id, p.confirmation,
        p.weight_g ?? null, dump(p.dimensions || null), p.hotkey || null, p.position, p.notes || null);
    }
    bilan.presets = PRESETS.length;

    for (const m of MAPPINGS) {
      run(`INSERT INTO service_mappings (store_id,requested,channel,carrier_code,service_id,package_id,match_mode,position)
           VALUES (?,?,?,?,?,?,?,?)
           ON CONFLICT(store_id,requested) DO UPDATE SET channel=excluded.channel, carrier_code=excluded.carrier_code,
             service_id=excluded.service_id, package_id=excluded.package_id, match_mode=excluded.match_mode`,
        m.store_id, m.requested, m.channel, m.carrier_code, m.service_id, m.package_id, m.match_mode, m.position);
    }
    bilan.mappings = MAPPINGS.length;

    const templates = require("./templates");
    for (const g of GABARITS) {
      const existant = one("SELECT id FROM templates WHERE name = ? AND kind = ?", g.name, g.kind);
      templates.sauver(existant ? { ...g, id: existant.id } : g);
    }
    bilan.gabarits = GABARITS.length;

    const rules = require("./rules");
    for (const r of REGLES) {
      const id = rules.sauver(r);
      if (r.notes) run("UPDATE rules SET notes = ? WHERE id = ?", r.notes, id);
    }
    bilan.regles = REGLES.length;

    for (const v of VUES) {
      run(`INSERT INTO views (name,scope,filters,criteres,match_all,position,notes,shared) VALUES (?,?,?,?,?,?,?,1)
           ON CONFLICT(name,scope) DO UPDATE SET criteres=excluded.criteres, match_all=excluded.match_all,
             position=excluded.position, notes=excluded.notes`,
        v.name, v.scope, "{}", dump(v.criteres), v.match_all ? 1 : 0, v.position,
        [v.notes, v.a_verifier ? "⚠ à vérifier" : null, v.campagne ? "campagne datée" : null]
          .filter(Boolean).join(" · ") || null);
    }
    bilan.vues = VUES.length;

    for (const [k, v] of Object.entries(REGLAGES)) poserReglage(k, v);
    poserReglage("config_lasclay", maintenant());
  });

  journaliser("config.lasclay", "system", null, bilan);
  journal(`Configuration Lasclay chargée : ${JSON.stringify(bilan)}`);
  return bilan;
}

/** Ce qui est déjà en place — pour l'écran de configuration. */
const etat = () => ({
  chargee: !!one("SELECT value FROM settings WHERE key = 'config_lasclay'"),
  entrepots: one("SELECT COUNT(*) n FROM warehouses").n,
  boutiques: one("SELECT COUNT(*) n FROM stores").n,
  services: one("SELECT COUNT(*) n FROM services").n,
  colis: one("SELECT COUNT(*) n FROM packages").n,
  etiquettes: one("SELECT COUNT(*) n FROM tags").n,
  presets: one("SELECT COUNT(*) n FROM shipping_presets").n,
  regles: one("SELECT COUNT(*) n FROM rules").n,
  vues: one("SELECT COUNT(*) n FROM views WHERE scope = 'orders'").n,
  mappings: one("SELECT COUNT(*) n FROM service_mappings").n,
  attendus: { entrepots: ENTREPOTS.length, boutiques: BOUTIQUES.length, services: SERVICES_CP.length,
    colis: COLIS.length, etiquettes: ETIQUETTES.length, presets: PRESETS.length,
    regles: REGLES.length, vues: VUES.length, mappings: MAPPINGS.length },
});

module.exports = {
  ENTREPOTS, BOUTIQUES, TRANSPORTEURS, SERVICES_CP, CONFIRMATIONS, COLIS, ETIQUETTES,
  PRESETS, MAPPINGS, REGLES, VUES, REGLAGES, GABARITS, LISTE_E,
  charger, etat,
};
