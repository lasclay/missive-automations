/**
 * Langage de critères — commun aux règles d'automatisation (§12) et aux vues sauvegardées (§12.5).
 *
 * ShipStation a deux moteurs de filtre distincts : `orderFilterSet` pour les règles,
 * `gridConfig.criterionArgumentValue` pour les vues. Mêmes colonnes, mêmes opérateurs, deux
 * implémentations, deux comportements. Ici il n'y en a qu'un, décliné de deux façons :
 *
 *   • `evaluer(cmd, criteres)` — en mémoire, sur une commande déjà chargée. C'est ce dont le
 *     moteur de règles a besoin, parce qu'il évalue l'état **courant** après chaque règle.
 *   • `compiler(criteres)` — en SQL, pour la grille. Rejouer une vue sur 38 000 commandes en
 *     JavaScript prendrait des secondes ; en SQL c'est l'affaire de quelques millisecondes.
 *
 * Les deux chemins partagent la table `CHAMPS` et doivent rendre le même verdict : c'est ce
 * que vérifie `verifier_criteres.js` (chaque critère est évalué des deux façons sur les mêmes
 * commandes, et les deux ensembles doivent coïncider).
 *
 * Sémantique de combinaison (§12.3) :
 *   1. colonnes différentes  → ET
 *   2. valeurs d'un critère  → OU
 *   3. **même colonne et même portée** → OU  (sans quoi la vue « QC-ON » serait vide)
 *
 * Portée des critères d'article (exigence D1) : `any`, `all`, `only`, `none`. ShipStation ne
 * la déclare pas — c'est sa limite la plus reprochée sur les commandes multi-articles.
 */

// ------------------------------------------------------------------ utilitaires

/**
 * Normalisation de texte : minuscules **et** sans diacritiques. « Défricheuses » doit
 * correspondre à « defricheuses » — les libellés de checkout viennent de Shopify, où
 * l'accentuation dépend de qui a saisi le nom de la méthode de livraison.
 */
const txt = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Normalisation d'un code de subdivision (province ou état) — BUG-007.
 *
 * ShipStation stocke la forme ISO 3166-2 complète (`CA-ON`), Shopify n'envoie que le code de
 * province (`ON`). Les 27 vues importées portent la forme ShipStation ; la base porte celle de
 * Shopify. Comparées telles quelles, `state egal CA-ON` ne ramène jamais rien — c'est la vraie
 * cause du « 0 au lieu de 417 » de la vue QC-ON, et non un ET appliqué à la place d'un OU.
 *
 * On compare donc sur la partie subdivision des deux côtés.
 */
const SUBDIVISION = /^[a-z]{2}-(.+)$/;
const sub = (v) => {
  const t = txt(v);
  const m = SUBDIVISION.exec(t);
  return m ? m[1] : t;
};

/**
 * Clés héritées — BUG-072.
 *
 * Des règles enregistrées portent `weight_g`, qui n'est pas dans le vocabulaire : le critère
 * était alors ignoré **en silence**, et la règle s'appliquait à tout. On traduit à la lecture
 * plutôt que de laisser tomber, et `migrerCles()` corrige la donnée une fois pour toutes.
 */
const ALIAS_CHAMPS = {
  weight_g: "order_weight",
  weight: "order_weight",
  total: "order_total",
  sku: "item_sku",
  name: "item_name",
  province: "state",
  pays: "country",
};

/** Résout une clé de critère vers le vocabulaire, alias hérités compris. */
const cleChamp = (f) => (CHAMPS[f] ? f : (ALIAS_CHAMPS[f] && CHAMPS[ALIAS_CHAMPS[f]] ? ALIAS_CHAMPS[f] : null));

/**
 * Valide un critère à l'écriture. Rend `null` si tout va bien, sinon le motif du refus.
 * Un champ hors vocabulaire ne doit **jamais** être accepté en silence : c'est ainsi qu'une
 * règle finit par s'appliquer à toutes les commandes sans que personne ne le voie.
 */
function valider(c) {
  if (!c || !c.field) return "critère sans champ";
  const cle = cleChamp(c.field);
  if (!cle) return `champ inconnu « ${c.field} »`;
  if (!c.op) return `critère « ${c.field} » sans opérateur`;
  const op = OPERATEURS[c.op];
  if (!op) return `opérateur inconnu « ${c.op} »`;
  const champ = CHAMPS[cle];
  // Un opérateur numérique sur un champ texte compose des règles qui ne se déclenchent jamais.
  const numerique = ["superieur", "superieur_egal", "inferieur", "inferieur_egal", "entre"];
  if (numerique.includes(c.op) && !champ.num && !champ.date)
    return `opérateur « ${op.libelle} » incompatible avec « ${cle} » (champ non numérique)`;
  if (champ.article && c.scope && !PORTEES.some((p) => p.cle === c.scope))
    return `portée inconnue « ${c.scope} »`;
  return null;
}

/** Réécrit les clés héritées d'une liste de critères. Utilisé à la migration et à l'écriture. */
const migrerCles = (criteres) => (criteres || []).map((c) => {
  const cle = cleChamp(c.field);
  return cle && cle !== c.field ? { ...c, field: cle } : c;
});

/** Valeurs multiples : tableau, ou chaîne séparée par « ; » comme dans les filtres ShipStation. */
function vals(v) {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined) return [];
  return String(v).split(";").map((x) => x.trim()).filter((x) => x !== "");
}

/** Échappement pour LIKE — les SKU Lasclay contiennent des `_` et la vue 1 exclut un `|`. */
const echapper = (s) => String(s).replace(/[\\%_]/g, (c) => "\\" + c);

// ------------------------------------------------------------------ champs

/**
 * Colonnes filtrables. Chaque champ sait se lire en mémoire (`lire`) et se rendre en SQL
 * (`sql`, sur l'alias `o`). `article: true` marque les colonnes de ligne de commande, qui
 * portent une portée ; leur `sql` s'exprime alors sur l'alias `i`.
 *
 * Les noms ShipStation sont donnés en commentaire : c'est la clé de lecture du §12.3.
 */
const CHAMPS = {
  // --- commande
  order_number:   { lire: (c) => c.order_number, sql: "o.order_number", ss: "OrderNumber" },
  order_total:    { num: true, lire: (c) => c.order_total || 0, sql: "o.order_total", ss: "OrderTotal" },
  amount_paid:    { num: true, lire: (c) => c.amount_paid || 0, sql: "o.amount_paid", ss: "AmountPaid" },
  shipping_paid:  { num: true, lire: (c) => c.shipping_paid || 0, sql: "o.shipping_paid", ss: "ShippingPaid" },
  order_weight:   { num: true, unite: "g", ss: "OrderWeight",
                    lire: (c) => c.weight_g || 0, sql: "COALESCE(o.weight_g,0)" },
  quantity:       { num: true, ss: "Quantity",
                    lire: (c) => (c.items || []).filter((i) => !i.adjustment).reduce((s, i) => s + (i.quantity || 0), 0),
                    sql: "(SELECT COALESCE(SUM(i2.quantity),0) FROM order_items i2 WHERE i2.order_id = o.id AND i2.adjustment = 0)" },
  line_count:     { num: true,
                    lire: (c) => (c.items || []).filter((i) => !i.adjustment).length,
                    sql: "(SELECT COUNT(*) FROM order_items i2 WHERE i2.order_id = o.id AND i2.adjustment = 0)" },
  order_date:     { date: true, lire: (c) => c.order_date, sql: "o.order_date", ss: "OrderDateTime" },
  status:         { lire: (c) => c.status, sql: "o.status" },
  // --- destination
  country:        { lire: (c) => (c.ship_to || {}).country, sql: "json_extract(o.ship_to,'$.country')", ss: "shipToCountryCode" },
  // `norm` : fonction de normalisation appliquée à la valeur ET au critère avant comparaison.
  // `sqlNorm` : son équivalent SQL, pour que la grille et le moteur en mémoire s'accordent.
  state:          { lire: (c) => (c.ship_to || {}).state, sql: "json_extract(o.ship_to,'$.state')",
                    ss: "shipToState", norm: sub,
                    sqlNorm: (col) => `CASE WHEN ${col} LIKE '__-%' THEN substr(${col}, 4) ELSE ${col} END` },
  postal_code:    { lire: (c) => (c.ship_to || {}).postalCode, sql: "json_extract(o.ship_to,'$.postalCode')" },
  city:           { lire: (c) => (c.ship_to || {}).city, sql: "json_extract(o.ship_to,'$.city')" },
  is_international: { bool: true, ss: "IsInternational",
                    lire: (c) => ((c.ship_to || {}).country || "CA") !== "CA",
                    sql: "(CASE WHEN COALESCE(json_extract(o.ship_to,'$.country'),'CA') <> 'CA' THEN 1 ELSE 0 END)" },
  residential:    { bool: true, lire: (c) => !!(c.ship_to || {}).residential,
                    sql: "(CASE WHEN json_extract(o.ship_to,'$.residential') IN (1,'true') THEN 1 ELSE 0 END)" },
  // --- canal
  store_id:       { lire: (c) => c.store_id, sql: "o.store_id", ss: "StoreGuid" },
  source:         { lire: (c) => c.source || "", sql: "o.source" },
  requested_service: { lire: (c) => c.requested_service || "", sql: "o.requested_service", ss: "RequestedServiceMarketPlace" },
  service_id:     { lire: (c) => c.service_id || "", sql: "o.service_id", ss: "RequestedServiceMapped" },
  carrier_code:   { lire: (c) => c.carrier_code || "", sql: "o.carrier_code" },
  package_id:     { lire: (c) => c.package_id || "", sql: "o.package_id" },
  warehouse_id:   { lire: (c) => c.warehouse_id, sql: "o.warehouse_id", ss: "ShipFromId" },
  confirmation:   { lire: (c) => c.confirmation || "", sql: "o.confirmation" },
  // --- contenu et annotations
  notes_from_buyer: { lire: (c) => c.customer_notes || "", sql: "o.customer_notes", ss: "NotesFromBuyer" },
  internal_notes: { lire: (c) => c.internal_notes || "", sql: "o.internal_notes" },
  gift:           { bool: true, lire: (c) => !!c.gift, sql: "COALESCE(o.gift,0)" },
  customer_email: { lire: (c) => c.customer_email || "", sql: "o.customer_email" },
  customer_name:  { lire: (c) => c.customer_name || "", sql: "o.customer_name" },
  custom_field1:  { lire: (c) => c.custom_field1 || "", sql: "o.custom_field1", ss: "CustomField1" },
  custom_field2:  { lire: (c) => c.custom_field2 || "", sql: "o.custom_field2", ss: "CustomField2" },
  custom_field3:  { lire: (c) => c.custom_field3 || "", sql: "o.custom_field3", ss: "CustomField3" },
  assigned_user:  { lire: (c) => c.assigned_user || "", sql: "o.assigned_user" },
  // --- étiquettes : champ-liste, traité à part des deux côtés
  tag:            { liste: true, ss: "tag",
                    lire: (c) => (c.tags || []).map((t) => t.name),
                    sqlListe: "SELECT 1 FROM order_tags ot JOIN tags t ON t.id = ot.tag_id WHERE ot.order_id = o.id AND sansaccent(t.name)" },
  tag_id:         { liste: true,
                    lire: (c) => (c.tags || []).map((t) => String(t.id)),
                    sqlListe: "SELECT 1 FROM order_tags ot WHERE ot.order_id = o.id AND sansaccent(CAST(ot.tag_id AS TEXT))" },
  // --- articles : portée obligatoire (any par défaut)
  item_sku:       { article: true, lire: (i) => i.sku || "", sql: "i.sku", ss: "ItemSku" },
  item_name:      { article: true, lire: (i) => i.name || "", sql: "i.name", ss: "ItemName" },
  item_quantity:  { article: true, num: true, lire: (i) => i.quantity || 0, sql: "COALESCE(i.quantity,0)" },
  item_price:     { article: true, num: true, lire: (i) => i.unit_price || 0, sql: "COALESCE(i.unit_price,0)" },
  item_location:  { article: true, lire: (i) => i.warehouse_location || "", sql: "i.warehouse_location" },
};

/** Portées d'un critère d'article — le cœur de l'exigence D1. */
const PORTEES = {
  any:  "au moins un article",
  all:  "tous les articles",
  only: "uniquement ces articles (aucun autre)",
  none: "aucun article",
};

// ------------------------------------------------------------------ opérateurs

/**
 * Chaque opérateur existe en deux versions qui doivent s'accorder :
 *   `js(valeur, arguments)` et `sql(expression, arguments, params)` → fragment SQL.
 * `params` est le tableau de liaison, alimenté par effet de bord.
 */
const OPERATEURS = {
  egal: {
    libelle: "est", ss: "Equals",
    js: (a, b) => vals(b).some((x) => txt(a) === txt(x)),
    sql: (e, b, p) => { const v = vals(b); if (!v.length) return "0"; v.forEach((x) => p.push(txt(x)));
      return `sansaccent(COALESCE(${e},'')) IN (${v.map(() => "?").join(",")})`; },
  },
  different: {
    libelle: "n'est pas", ss: "NotEquals",
    js: (a, b) => !OPERATEURS.egal.js(a, b),
    sql: (e, b, p) => `NOT (${OPERATEURS.egal.sql(e, b, p)})`,
  },
  contient: {
    libelle: "contient", ss: "Contains",
    js: (a, b) => vals(b).some((x) => txt(a).includes(txt(x))),
    sql: (e, b, p) => { const v = vals(b); if (!v.length) return "0"; v.forEach((x) => p.push(txt(x)));
      return "(" + v.map(() => `instr(sansaccent(COALESCE(${e},'')), ?) > 0`).join(" OR ") + ")"; },
  },
  ne_contient_pas: {
    libelle: "ne contient pas", ss: "DoesNotContain",
    js: (a, b) => !OPERATEURS.contient.js(a, b),
    sql: (e, b, p) => `NOT (${OPERATEURS.contient.sql(e, b, p)})`,
  },
  commence_par: {
    libelle: "commence par", ss: "BeginsWith",
    js: (a, b) => vals(b).some((x) => txt(a).startsWith(txt(x))),
    sql: (e, b, p) => { const v = vals(b); if (!v.length) return "0"; v.forEach((x) => p.push(echapper(txt(x)) + "%"));
      return "(" + v.map(() => `sansaccent(COALESCE(${e},'')) LIKE ? ESCAPE '\\'`).join(" OR ") + ")"; },
  },
  finit_par: {
    libelle: "finit par", ss: "EndsWith",
    js: (a, b) => vals(b).some((x) => txt(a).endsWith(txt(x))),
    sql: (e, b, p) => { const v = vals(b); if (!v.length) return "0"; v.forEach((x) => p.push("%" + echapper(txt(x))));
      return "(" + v.map(() => `sansaccent(COALESCE(${e},'')) LIKE ? ESCAPE '\\'`).join(" OR ") + ")"; },
  },
  vide: {
    libelle: "est vide",
    js: (a) => a === null || a === undefined || a === "" || (Array.isArray(a) && !a.length),
    sql: (e) => `COALESCE(${e},'') = ''`,
  },
  non_vide: {
    libelle: "n'est pas vide",
    js: (a) => !OPERATEURS.vide.js(a),
    sql: (e) => `COALESCE(${e},'') <> ''`,
  },
  inferieur:      { libelle: "<",  num: true, ss: "Lt",  js: (a, b) => Number(a) < Number(vals(b)[0]),
                    sql: (e, b, p) => (p.push(Number(vals(b)[0])), `CAST(${e} AS REAL) < ?`) },
  inferieur_egal: { libelle: "≤",  num: true, ss: "Lte", js: (a, b) => Number(a) <= Number(vals(b)[0]),
                    sql: (e, b, p) => (p.push(Number(vals(b)[0])), `CAST(${e} AS REAL) <= ?`) },
  superieur:      { libelle: ">",  num: true, ss: "Gt",  js: (a, b) => Number(a) > Number(vals(b)[0]),
                    sql: (e, b, p) => (p.push(Number(vals(b)[0])), `CAST(${e} AS REAL) > ?`) },
  superieur_egal: { libelle: "≥",  num: true, ss: "Gte", js: (a, b) => Number(a) >= Number(vals(b)[0]),
                    sql: (e, b, p) => (p.push(Number(vals(b)[0])), `CAST(${e} AS REAL) >= ?`) },
  egal_num:       { libelle: "=",  num: true, ss: "Eq",  js: (a, b) => Number(a) === Number(vals(b)[0]),
                    sql: (e, b, p) => (p.push(Number(vals(b)[0])), `CAST(${e} AS REAL) = ?`) },
  entre: {
    libelle: "entre", num: true,
    js: (a, b) => { const [x, y] = vals(b); return Number(a) >= Number(x) && Number(a) <= Number(y); },
    sql: (e, b, p) => { const [x, y] = vals(b); p.push(Number(x), Number(y)); return `CAST(${e} AS REAL) BETWEEN ? AND ?`; },
  },
  entre_dates: {
    libelle: "entre les dates", date: true, ss: "dateCustomRange",
    js: (a, b) => { const [d1, d2] = vals(b); return String(a) >= String(d1) && String(a) <= String(d2 + "￿"); },
    sql: (e, b, p) => { const [d1, d2] = vals(b); p.push(String(d1), String(d2) + "￿"); return `${e} BETWEEN ? AND ?`; },
  },
  vrai: { libelle: "est vrai", bool: true, js: (a) => a === true || a === 1, sql: (e) => `${e} IN (1,'true')` },
  faux: { libelle: "est faux", bool: true, js: (a) => a === false || a === 0, sql: (e) => `COALESCE(${e},0) NOT IN (1,'true')` },
  dans: {
    libelle: "fait partie de", ss: "isIn",
    js: (a, b) => { const s = vals(b).map(txt); return Array.isArray(a) ? a.some((x) => s.includes(txt(x))) : s.includes(txt(a)); },
    sql: (e, b, p) => OPERATEURS.egal.sql(e, b, p),
  },
  pas_dans: {
    libelle: "ne fait pas partie de",
    js: (a, b) => !OPERATEURS.dans.js(a, b),
    sql: (e, b, p) => `NOT (${OPERATEURS.egal.sql(e, b, p)})`,
  },
};

// ------------------------------------------------------- évaluation en mémoire

/** Évalue un critère sur une commande hydratée (avec `items` et `tags`). */
function evaluerCritere(cmd, c) {
  const champ = CHAMPS[cleChamp(c.field)];
  const op = OPERATEURS[c.op];
  if (!champ || !op) return false;

  if (champ.liste) {
    const valeurs = champ.lire(cmd);
    if (c.op === "vide" || c.op === "non_vide") return !!op.js(valeurs);
    return !!op.js(valeurs, c.value);
  }
  // `norm` : normalisation appliquée des DEUX côtés avant comparaison (subdivision, §BUG-007).
  if (!champ.article) {
    const brut = champ.lire(cmd);
    if (!champ.norm) return !!op.js(brut, c.value);
    const v = Array.isArray(c.value) ? c.value.map(champ.norm) : champ.norm(c.value);
    return !!op.js(champ.norm(brut), v);
  }

  const articles = (cmd.items || []).filter((i) => !i.adjustment);
  if (!articles.length) return (c.scope || "any") === "none";
  const m = articles.map((i) => !!op.js(champ.lire(i), c.value));
  switch (c.scope || "any") {
    case "all":  return m.every(Boolean);
    case "only": return m.every(Boolean);   // tous correspondent ⇒ aucun autre présent
    case "none": return !m.some(Boolean);
    default:     return m.some(Boolean);
  }
}

/**
 * Regroupe les critères selon la sémantique §12.3 : OU à l'intérieur d'un groupe
 * (même colonne, même portée), ET entre les groupes.
 */
/**
 * Regroupement des critères. La clé porte **le champ, l'opérateur et la portée**.
 *
 * Règle 3 — même colonne, **même opérateur** : OU. `state egal CA-ON` + `state egal CA-QC`
 * deviennent `state ∈ {ON, QC}` ; sans cela, la vue « QC-ON » serait vide par construction.
 *
 * Règle 3 bis — même colonne, opérateurs **différents** : ET. `item_sku ne contient pas (liste E)`
 * et `item_sku égal (les 4 SKU en -x1)` portent sur des articles différents d'une même commande
 * et doivent tous deux être vrais. C'est ce qui fait fonctionner les vues « Graines x1/x5/x10 ».
 * L'opérateur manquait dans la clé : les deux critères étaient combinés en OU, donc la négation
 * n'excluait plus rien dès qu'une affirmation passait.
 */
function grouper(criteres) {
  const g = new Map();
  for (const c of criteres) {
    const cle = `${cleChamp(c.field) || c.field}|${c.op}|${c.scope || ""}|${c.groupe || ""}`;
    if (!g.has(cle)) g.set(cle, []);
    g.get(cle).push(c);
  }
  return [...g.values()];
}

/** Vrai si la commande satisfait l'ensemble des critères. `matchAll: false` = OU global. */
function evaluer(cmd, criteres, matchAll = true) {
  const cs = (criteres || []).filter((c) => c && c.field && c.op);
  if (!cs.length) return true;
  if (!matchAll) return cs.some((c) => evaluerCritere(cmd, c));
  return grouper(cs).every((g) => g.some((c) => evaluerCritere(cmd, c)));
}

// ------------------------------------------------------------ compilation SQL

const SOUS_REQUETE = "FROM order_items i WHERE i.order_id = o.id AND i.adjustment = 0";

/** Rend un critère unique en SQL, sur l'alias `o`. */
function compilerCritere(c, params) {
  const champ = CHAMPS[cleChamp(c.field)];
  const op = OPERATEURS[c.op];
  if (!champ || !op) return "0";

  if (champ.liste) {
    if (c.op === "vide")     return `NOT EXISTS (${champ.sqlListe} IS NOT NULL)`;
    if (c.op === "non_vide") return `EXISTS (${champ.sqlListe} IS NOT NULL)`;
    const v = vals(c.value);
    if (!v.length) return "0";
    const negatif = c.op === "different" || c.op === "pas_dans" || c.op === "ne_contient_pas";
    v.forEach((x) => params.push(txt(x)));
    const dedans = `${champ.sqlListe} IN (${v.map(() => "?").join(",")})`;
    return negatif ? `NOT EXISTS (${dedans})` : `EXISTS (${dedans})`;
  }

  if (!champ.article) {
    if (!champ.norm) return op.sql(champ.sql, c.value, params);
    const v = Array.isArray(c.value) ? c.value.map(champ.norm) : champ.norm(c.value);
    return op.sql(champ.sqlNorm(champ.sql), v, params);
  }

  // Champ d'article : la portée décide de la forme de la sous-requête.
  const portee = c.scope || "any";
  if (portee === "none") return `NOT EXISTS (SELECT 1 ${SOUS_REQUETE} AND ${op.sql(champ.sql, c.value, params)})`;
  if (portee === "all" || portee === "only")
    return `(EXISTS (SELECT 1 ${SOUS_REQUETE}) AND NOT EXISTS (SELECT 1 ${SOUS_REQUETE} AND NOT (${op.sql(champ.sql, c.value, params)})))`;
  return `EXISTS (SELECT 1 ${SOUS_REQUETE} AND ${op.sql(champ.sql, c.value, params)})`;
}

/**
 * Compile un jeu de critères en clause WHERE (alias `o` = orders).
 * Rend `{ sql, params }` ; `sql` vaut `null` si aucun critère exploitable.
 */
function compiler(criteres, matchAll = true) {
  const cs = (criteres || []).filter((c) => c && c.field && c.op && cleChamp(c.field) && OPERATEURS[c.op]);
  if (!cs.length) return { sql: null, params: [] };
  const params = [];
  const groupes = matchAll ? grouper(cs) : [cs];
  const morceaux = groupes.map((g) => "(" + g.map((c) => compilerCritere(c, params)).join(" OR ") + ")");
  return { sql: morceaux.join(matchAll ? " AND " : " OR "), params };
}

// ------------------------------------------------------------------ lisibilité

/** Rend un critère en français, pour l'interface et le journal d'audit. */
function decrire(c) {
  const champ = CHAMPS[cleChamp(c.field)];
  const op = OPERATEURS[c.op];
  if (!champ || !op) return `${c.field} ${c.op} ?`;
  const v = vals(c.value);
  const portee = champ.article ? ({ any: "un article", all: "tous les articles", only: "uniquement des articles", none: "aucun article" }[c.scope || "any"] + " dont ") : "";
  return `${portee}${c.field} ${op.libelle}${v.length ? " " + v.join(" ou ") : ""}`;
}

module.exports = { CHAMPS, OPERATEURS, PORTEES, ALIAS_CHAMPS, vals, evaluer, evaluerCritere,
  compiler, compilerCritere, grouper, decrire, valider, migrerCles, cleChamp };
