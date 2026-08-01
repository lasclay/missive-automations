/**
 * Classification douanière — codes SH (§16).
 *
 * État du compte ShipStation : **69 produits sur 472 ont un code SH** (14,6 %). Les 403
 * autres partent à l'international sans classement, ce qui est une infraction douanière
 * ordinaire tant que personne ne contrôle, et un colis bloqué le jour où quelqu'un contrôle.
 *
 * Le moteur ci-dessous classe par mots-clés, **SKU d'abord puis nom de produit**, du plus
 * spécifique au plus générique — l'ordre du tableau fait foi, la première famille qui
 * correspond gagne. Sur les 403 produits sans code, 387 sont classés (96 %).
 *
 * ⚠️ Trois codes hérités sont repris **sans être validés** : `3407.00` (pâtes à modeler) pour
 * les bombes semencières, `9505.90` (confettis) et `2309.90` (aliments pour chiens) pour des
 * produits à base de graines. Ce sont vraisemblablement des contournements des contrôles
 * phytosanitaires à l'exportation vers les États-Unis. Une déclaration douanière inexacte
 * engage l'exportateur : ces trois codes sont marqués `revalider: true`, remontés par
 * `alertes()`, et doivent être tranchés avec un courtier avant la bascule.
 */
const { all, one, run, tx } = require("./db");

/**
 * Familles, dans l'ordre d'évaluation. `sku` et `nom` sont des listes de sous-chaînes
 * cherchées en minuscules ; `exclut` empêche un faux positif (le plus fréquent : « sac »
 * qui attrape « sac de couchage » et « sac à main » indistinctement).
 */
const FAMILLES = [
  { code: "8211.92", libelle: "Couteaux à lame fixe",
    sku: ["tsuru", "gyuto", "nakiri", "petty", "sujihiki", "hakata"],
    nom: ["gyuto", "nakiri", "petty", "sujihiki", "hakata", "couteau", "silencieux"] },
  { code: "9615.90", libelle: "Pinces et barrettes à cheveux",
    sku: ["pin-"], nom: ["pince à cheveux", "barrette", "pince petite", "pince moyenne", "pince à mitaines"] },
  { code: "7117.19", libelle: "Bijouterie de fantaisie",
    nom: ["bague", "pendentif", "boucles d'oreilles", "boucle d'oreille"] },
  { code: "3926.90", libelle: "Étuis de protection en matière plastique",
    nom: ["étui de téléphone", "phone case", "iphone", "galaxy", "pixel", "étui téléphone"] },
  { code: "9503.00", libelle: "Puzzles et casse-tête", nom: ["casse-tête", "casse tete", "puzzle"] },
  { code: "9504.40", libelle: "Cartes à jouer", nom: ["jeu de cartes", "cartes à jouer", "playing cards"] },
  { code: "4910.00", libelle: "Calendriers imprimés", nom: ["calendrier"] },
  { code: "4909.00", libelle: "Cartes postales et cartes de vœux imprimées",
    nom: ["carte de vœux", "cartes de vœux", "carte de souhait", "greeting card"] },
  { code: "4820.10", libelle: "Registres, cahiers, carnets", nom: ["cahier", "carnet", "notebook"] },
  { code: "4911.99", libelle: "Autres imprimés", nom: ["signet", "bookmark"] },
  { code: "4821.10", libelle: "Étiquettes en papier imprimées", nom: ["étiquette imprimée", "étiquettes"] },
  { code: "3919.90", libelle: "Feuilles auto-adhésives en plastique", nom: ["autocollant", "sticker", "vinyle"] },
  { code: "4819.10", libelle: "Boîtes et caisses en carton ondulé", nom: ["carton", "présentoir"] },
  { code: "4911.91", libelle: "Images, gravures, photographies imprimées",
    nom: ["tirage", "impression", "print", "illustration", "affiche", "photographie"] },
  { code: "6912.00", libelle: "Vaisselle en céramique", nom: ["tasse céramique", "mug céramique", "tasse en céramique"] },
  { code: "7323.94", libelle: "Articles de ménage en acier émaillé", nom: ["tasse émail", "émaillée", "enamel mug"] },
  { code: "6116.93", libelle: "Gants et mitaines en bonneterie, fibres synthétiques",
    sku: ["mit"], nom: ["mitaine", "gant", "ski mitten"], exclut: ["mitaine de four", "mitaines de four"] },
  { code: "6117.10", libelle: "Châles, écharpes, foulards en bonneterie",
    nom: ["foulard", "cache-cou", "cache cou", "neck warmer", "quilted scarf", "écharpe"] },
  { code: "6505.00", libelle: "Chapeaux et coiffures en bonneterie", nom: ["tuque", "bonnet", "beanie"] },
  { code: "6117.80", libelle: "Autres accessoires vestimentaires en bonneterie", nom: ["bandeau", "headband"] },
  { code: "6405.20", libelle: "Chaussures à dessus en matières textiles", nom: ["pantoufle", "chausson", "slipper"] },
  { code: "6406.90", libelle: "Autres parties de chaussures", nom: ["semelle"] },
  { code: "6301.40", libelle: "Couvertures en fibres synthétiques", nom: ["couverture", "throw", "jeté"] },
  { code: "6307.10", libelle: "Serpillières, lavettes, chamoisettes", nom: ["microfibre", "serviette", "linge"] },
  { code: "9404.90", libelle: "Articles de literie rembourrés",
    nom: ["oreiller", "coussin", "pillow"] },
  // Ne PAS y rattacher les sacs à lunch : le compte ShipStation a un unique produit en
  // 6307.90 nommé « Insulated lunch bag », mais le §16.3 range les 60 contenants isothermes
  // en 4202.92. C'est la convention retenue ; l'ancien code isolé est l'exception.
  { code: "6307.90", libelle: "Autres articles textiles confectionnés",
    nom: ["manique", "poignée de four", "sous-plat", "sous plat", "mitaine de four"] },
  { code: "4202.92", libelle: "Contenants à surface extérieure textile ou plastique",
    sku: ["lunchb", "besace", "tote"],
    nom: ["besace", "sac à lunch", "sac isotherme", "tote bag", "sac à dos", "glacière", "manchon",
          "sac à bouteille", "étui isolé", "sac réutilisable", "sac en coton", "sac"] },
  { code: "1209.30", libelle: "Semences de plantes herbacées cultivées pour leurs fleurs",
    sku: ["ascl-", "-x1", "-x5", "-x10"], nom: ["graine", "semence", "milkweed seed"] },
  { code: "0602.90", libelle: "Autres plants vivants", nom: ["plantule", "plant vivant", "seedling"] },
  { code: "1404.90", libelle: "Autres produits végétaux",
    nom: ["soie d'asclépiade", "soie en vrac", "milkweed floss", "fibre en vrac"] },
  { code: "3304.99", libelle: "Préparations de beauté et soins de la peau",
    nom: ["huile", "crème", "nettoyant", "baume", "sérum"] },
  { code: "2309.90", libelle: "Aliments pour chiens", revalider: true,
    nom: ["coussin pour animaux", "pour chien"] },
  { code: "9505.90", libelle: "Confettis", revalider: true, nom: ["confetti"] },
  { code: "3407.00", libelle: "Pâtes à modeler", revalider: true,
    sku: ["seedbmb"], nom: ["bombe semencière", "bombes semencières", "seed bomb", "bombes"] },
  { code: null, libelle: "Non expédiable — exclure des douanes", exclureDouane: true,
    sku: ["giftcard", "gift-card"], nom: ["carte-cadeau", "carte cadeau", "gift card"] },
];

/** Familles conservées pour de futurs produits, absentes du catalogue actif (§16.3). */
const FAMILLES_LATENTES = [
  { code: "6201.40", libelle: "Manteaux et vestes isolés (homme)", nom: ["manteau", "parka"] },
  { code: "6202.40", libelle: "Manteaux et vestes isolés (femme)", nom: [] },
  { code: "6110.30", libelle: "Chandails en fibres synthétiques", nom: ["chandail", "polaire", "hoodie"] },
  { code: "9404.30", libelle: "Sacs de couchage", nom: ["sac de couchage", "sleeping bag"] },
];

const bas = (s) => String(s || "").toLowerCase();

/** Classe un produit. Rend `null` si aucune famille ne correspond. */
function classer({ sku, name }) {
  const s = bas(sku), n = bas(name);
  for (const f of [...FAMILLES, ...FAMILLES_LATENTES]) {
    if ((f.exclut || []).some((x) => n.includes(x))) continue;
    const parSku = (f.sku || []).some((x) => s.includes(x));
    const parNom = (f.nom || []).some((x) => n.includes(x));
    if (parSku || parNom) return { ...f, via: parSku ? "sku" : "nom" };
  }
  return null;
}

/**
 * Simulation sur tout le catalogue. N'écrit rien — c'est la prévisualisation que
 * l'import CSV de ShipStation offrait et que l'écriture directe par API ne donnait pas.
 */
function simuler({ seulementSansCode = true } = {}) {
  const produits = all(
    `SELECT id, sku, name, hs_code, customs_description, active FROM products
     ${seulementSansCode ? "WHERE (hs_code IS NULL OR hs_code = '')" : ""} ORDER BY sku`);
  const classes = [], nonClasses = [], exclus = [];
  for (const p of produits) {
    const f = classer(p);
    if (!f) { nonClasses.push(p); continue; }
    if (f.exclureDouane) { exclus.push({ ...p, motif: f.libelle }); continue; }
    classes.push({ ...p, hs_code: f.code, customs_description: f.libelle, via: f.via, revalider: !!f.revalider });
  }
  return {
    total: produits.length,
    classes: classes.length, non_classes: nonClasses.length, exclus: exclus.length,
    taux: produits.length ? Math.round((classes.length / produits.length) * 1000) / 10 : 0,
    a_revalider: classes.filter((c) => c.revalider).length,
    detail: { classes, nonClasses, exclus },
  };
}

/** Applique la classification. `seulementSansCode` protège les 69 codes déjà en place. */
function appliquer({ seulementSansCode = true, userId = null } = {}) {
  const sim = simuler({ seulementSansCode });
  tx(() => {
    for (const p of sim.detail.classes) {
      run("UPDATE products SET hs_code = ?, customs_description = COALESCE(NULLIF(customs_description,''), ?) WHERE id = ?",
        p.hs_code, p.customs_description, p.id);
    }
  });
  require("./db").journaliser("hs.applied", "system", null,
    { classes: sim.classes, revalider: sim.a_revalider }, userId);
  return { applique: sim.classes, non_classes: sim.non_classes, a_revalider: sim.a_revalider };
}

/**
 * Alertes douanières. Deux niveaux : ce qui bloque un envoi international (aucun code) et
 * ce qui expose juridiquement (codes hérités non validés).
 */
function alertes() {
  const revalider = new Set(FAMILLES.filter((f) => f.revalider).map((f) => f.code));
  const parCode = all(`SELECT hs_code, COUNT(*) n FROM products
                       WHERE hs_code IS NOT NULL AND hs_code <> '' AND active = 1
                       GROUP BY hs_code ORDER BY n DESC`);
  return {
    sans_code: one("SELECT COUNT(*) n FROM products WHERE active = 1 AND (hs_code IS NULL OR hs_code = '')").n,
    avec_code: one("SELECT COUNT(*) n FROM products WHERE active = 1 AND hs_code IS NOT NULL AND hs_code <> ''").n,
    a_revalider: parCode.filter((c) => revalider.has(c.hs_code)),
    repartition: parCode,
    // Le cas qui coûte cher : une commande internationale prête à partir avec un article
    // sans code SH. ShipStation laissait passer ; ici c'est une alerte nommée (exigence F1).
    commandes_bloquantes: all(`
      SELECT o.id, o.order_number, COUNT(*) n
      FROM orders o JOIN order_items i ON i.order_id = o.id AND i.adjustment = 0
      LEFT JOIN products p ON p.sku = i.sku
      WHERE o.status IN ('awaiting_shipment','on_hold')
        AND COALESCE(json_extract(o.ship_to,'$.country'),'CA') <> 'CA'
        AND (p.id IS NULL OR p.hs_code IS NULL OR p.hs_code = '')
      GROUP BY o.id ORDER BY o.order_date LIMIT 100`),
  };
}

module.exports = { FAMILLES, FAMILLES_LATENTES, classer, simuler, appliquer, alertes };
