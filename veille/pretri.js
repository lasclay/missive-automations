/**
 * Lasclay — veille/pretri.js
 * --------------------------------------------------------------------------
 * PRÉ-TRI DÉTERMINISTE : donne un type, des thèmes et des produits à un signal
 * brut, sans appeler de modèle.
 *
 * Pourquoi un tri lexical alors qu'un modèle ferait mieux ? Parce que la
 * collecte doit pouvoir tourner TOUS LES JOURS, gratuitement, même sans clé
 * d'API et même quand un service est en panne. Le pré-tri n'a pas à être
 * juste : il a à être assez bon pour que la distillation (elle, avec modèle)
 * reçoive un corpus déjà rangé et n'ait à trancher que l'ambigu. C'est le même
 * partage que dans filtrage.js — le déterministe fait le gratuit et l'évident,
 * le modèle fait le jugement.
 *
 * Le vocabulaire vient du corpus réel de la boîte, pas d'une liste inventée :
 * il a été construit en lisant les fils des étiquettes R&D et des avis.
 * Quand un mot manque, ça se voit — le signal ressort `inclassé`, et le taux
 * d'inclassés est la mesure de santé de ce fichier.
 *
 * Node 18+. Aucune dépendance.
 */

// --- Produits du catalogue, tels que les clients les nomment ---------------
// Les clés sont les noms canoniques ; les valeurs, les formes rencontrées.

const PRODUITS = {
  semelle: /\bsemelle?s?\b/i,
  mitaine: /\bmitaine?s?\b|\bmoufle?s?\b|\bmitten?s?\b|\bgant/i,
  tuque: /\btuque?s?\b|\bbeanie\b|\btoque?s?\b/i,
  bandeau: /\bbandeau?x?\b|\bcache[- ]oreille/i,
  "cache-cou": /\bcache[- ]cou\b|\bcol\b|\bfoulard\b|\bneck ?warmer\b|\bscarf\b/i,
  manteau: /\bmanteau?x?\b|\bjacket\b|\bcoat\b|\bparka\b/i,
  veste: /\bveste?s?\b|\bsans manche/i,
  pantoufle: /\bpantoufle?s?\b|\bslipper?s?\b|\bslide?s?\b/i,
  glaciere: /\bglaci[eè]re?s?\b|\bsac isotherme\b|\bsac[- ]?[àa][- ]dos glaci/i,
  "sac-a-lunch": /\bsac [àa] lunch\b|\bbo[îi]te [àa] lunch\b|\blunch ?bag\b/i,
  "mitaine-de-four": /\bmitaine?s? de (?:four|cuisine)\b|\bmanique?s?\b|\bpoign[ée]e?s? de four\b|\boven mitt/i,
  "etui-cellulaire": /\b[ée]tui (?:[àa] )?cellulaire\b|\bsac isolant pour t[ée]l[ée]phone\b|\bphone (?:case|pouch)\b/i,
  manchon: /\bmanchon?s?\b|\bporte[- ]gobelet\b|\bkoozie\b|\bcann?ette\b/i,
  "sac-bouteille": /\bsac [àa] bouteille\b|\bsac [àa] vin\b|\bwine ?bag\b/i,
  coussin: /\bcoussin d'assise\b|\bcoussin thermal\b/i,
  semences: /\bsemences?\b|\bgraines?\b|\bbombes? de (?:semences|graines)\b|\bseeds?\b|\basclépiade [àa] planter\b/i,
  isolant: /\bisolant\b|\bbourre\b|\bsoie en vrac\b|\bbulk milkweed\b|\bbatting\b/i,
  // Catégories réclamées mais absentes du catalogue : les compter séparément
  // permet de voir monter une demande avant qu'elle existe comme produit.
  literie: /\bsac de couchage\b|\bcouette?s?\b|\bduvet de lit\b|\bjet[ée]s?\b|\btaies? d'oreiller\b|\boreiller?s?\b|\bsleeping ?bag\b|\bduvet cover\b|\bmatelas\b|\btatami\b/i,
  chaussette: /\bchaussette?s?\b|\bbas\b(?! de )|\bfeutres?\b|\bchausson?s?\b|\bsock?s?\b/i,
  vetement: /\bboxers?\b|\bleggings?\b|\bpantalon\b|\bsous[- ]v[êe]tement|\bjupe\b|\bponcho\b|\bcape\b|\bgu[êe]tres?\b/i,
  animal: /\bpour (?:mon |le |les )?chiens?\b|\bbottes? pour chien|\bdog (?:boots?|coat)\b|\btapis pour chien\b|\bpet\b/i,
};

// --- Types de signal -------------------------------------------------------
// L'ordre compte : le premier motif qui accroche gagne. Les types les plus
// spécifiques et les plus coûteux à rater passent en premier.

const TYPES = [
  {
    type: "risque_securite",
    // Un produit qui blesse. Rare, et jamais à noyer dans « défaut ».
    motif: /\bbr[ûu]l(?:e|é|er|ure)\b|\bse br[ûu]le\b|\bburn(?:ed|s|ing)?\b|\bblessur/i,
  },
  {
    type: "offre_partenariat",
    // Quelqu'un qui apporte une capacité : fabrication, média, expertise,
    // matière première, terre. Ces messages arrivent une fois et ne reviennent
    // pas — les rater coûte plus cher que de les sur-détecter.
    // « offrir » exige « vous » devant : sans ça, « ce vêtement doit offrir une
    // protection » se fait prendre pour une offre de partenariat.
    motif: /\bcollabor|\bpartenariat\b|\bje (?:peux|pourrais) (?:vous (?:aider|fournir|offrir|mettre en contact)|aider|fournir|mettre en contact)\b|\bmon r[ée]seau d'affaires\b|\bj'ai travaill[ée] (?:durant|pendant)\b|\bcontactez[- ]les\b|\bseriez[- ]vous (?:d'accord|int[ée]ress)|\bje r[ée]colte\b|\bgousses?\b.*\bint[ée]ress|\bradio-canada\b|\bjournalist|\bje dispose d'une (?:grande )?terre\b|\bl'ascl[ée]piade pousse (?:d[ée]j[àa]|naturellement)\b|\bculture d'ascl[ée]piade sur mon terrain\b|\bvotre programme\b|\bmes? champs?\b|\bje suis (?:agricult|producteur|artisan)|\bvous pourriez en offrir\b/i,
  },
  {
    type: "idee_produit",
    motif: /\bsuggestion\b|\bid[ée]e de produit\b|\bavez[- ]vous (?:pens[ée]|pr[ée]vu|l'intention)\b|\bpr[ée]voyez[- ]vous\b|\bserait[- ]il possible de (?:faire|d[ée]velopper|fabriquer)\b|\bpourriez[- ]vous (?:faire|d[ée]velopper|cr[ée]er|offrir)\b|\bce serait (?:g[ée]nial|super|bien|chouette|int[ée]ressant)\b|\bj'aimerais (?:que vous|avoir un)\b|\bdo you (?:sell|have plans|make)\b|\bit would be (?:great|amazing)\b|\bhave you considered\b|\bversion 2\.0\b|\bil serait (?:pertinent|int[ée]ressant) que vous\b|\bje me demandais si (?:vous|ce)\b|\b[àa] quand\b|\bfait[- ]il partie de vos projets\b|\bvendez[- ]vous de l'\b|\bpensez[- ]vous (?:faire|offrir|d[ée]velopper)\b|\bun produit en demande\b|\bpourquoi pas (?:des|un|une)\b/i,
  },
  {
    type: "taille_ajustement",
    motif: /\btrop (?:petit|grand|large|[ée]troit|long|court)\b|\bgrande?s? tailles?\b|\bcharte des (?:grandeurs|tailles)\b|\bguide des tailles\b|\btour de t[êe]te\b|\bpointure\b|\bne me fait pas\b|\btoo (?:small|big|large|long|tight)\b|\blarger sizes?\b|\b\d?xl\b|\b5x\b/i,
  },
  {
    type: "defaut_produit",
    motif: /\bse d[ée]cou[ds]|\bd[ée]coll|\beffiloch|\bs'use\b|\busure\b|\bus[ée]es?\b|\bbris[ée]e?s?\b|\bd[ée]chir|\bratatine|\bbouchonn|\bse plisse\b|\bne (?:reste|tiennent) pas en place\b|\bmottons?\b|\btappon\b|\bagglutin|\bpi[èe]tre qualit[ée]\b|\bfinition (?:d[ée]cevante|manque)\b|\bmanque de finition\b|\bd[ée]fectueu|\bcoutures? (?:qui|s'|se)\b|\bfell apart\b|\bwore out\b/i,
  },
  {
    type: "objection_achat",
    // Ce qui empêche d'acheter. La catégorie la plus chère à ignorer.
    motif: /\bj'h[ée]site\b|\bje n'ach[èe]terais pas\b|\bce n'est pas pour moi\b|\bd[ée]courag|\bj'ai lu (?:les|plusieurs) (?:commentaires|avis)\b|\btrop cher\b|\ble prix\b.*\b(?:[ée]lev|trop)\b|\bje suis d[ée][çc]u.*\bavant m[êe]me\b|\bfelt discouraged\b|\bmultiple comments saying\b|\btannée? du noir\b|\bque du noir\b|\bseulement (?:la|en) (?:couleur )?noire?\b/i,
  },
  {
    type: "segment_usage",
    // Le signal le plus précieux : un usage ou un public qu'on n'a pas visé.
    motif: /\bpour (?:mon|notre) (?:travail|m[ée]tier|entreprise)\b|\binspect(?:eur|rice|ion)\b|\bchantier\b|\bsignaleu|\barpenteur\b|\bmotoneige\b|\bski (?:alpin|de fond)\b|\bsnowboard\b|\bchasse\b|\bp[êe]che\b|\bcamouflage\b|\bexp[ée]dition photo|\bphotograph|\bv[ée]lo d'hiver\b|\bcourse [àa] pied\b|\bjogging\b|\bkayak\b|\braquette\b|\bepipen\b|\bauto[- ]injecteur\b|\ballerg|\bv[ée]gan|\borthot[èi]|\bcamp de jour\b|\bferme\b|\bhorticult|\bp[ée]pini[èe]re\b|\btricot|\bcouture personnelle\b|\bmes projets personnels\b|\bcorporati|\brevendeur\b|\bgrossiste\b|\bb2b\b/i,
  },
  {
    type: "friction_operation",
    motif: /\bpas (?:encore )?re[çc]u\b|\btoujours pas re[çc]u\b|\bd[ée]lai\b|\bquand (?:vais|allez|pensez)|\bo[ùu] est ma commande\b|\bretard\b|\bhaven't received\b|\bstatus of my order\b|\bimpossible (?:de|à) command/i,
  },
  {
    type: "eloge",
    motif: /\bbravo\b|\bf[ée]licitations\b|\bmerci (?:beaucoup|pour|d'exister|de)\b|\bj'adore\b|\btr[èe]s (?:satisfait|content)|\bexcellent\b|\bwow\b|\bg[ée]nial\b|\bcontinuez\b|\bl[âa]chez pas\b|\bi love\b|\bamazing\b|\bbon succ[èe]s\b|\bbien h[âa]te\b|\bbelle (?:d[ée]couverte|initiative)\b|\bproud of you\b|\bparfait\b|\bbonne continu/i,
  },
];

// --- Thèmes transversaux ---------------------------------------------------
// Un signal peut en porter plusieurs. Ce sont les axes qui reviennent assez
// souvent pour mériter d'être comptés dans le temps.

const THEMES = {
  couleur: /\bcouleur?s?\b|\bnoir\b|\bcharbon\b|\bgris fonc[ée]\b|\bcamouflage\b|\bcolou?r\b/i,
  taille: /\btaille?s?\b|\bgrandeur?s?\b|\bpointure\b|\bsizing\b|\b5x\b|\b2x\b/i,
  rigidite: /\brigide\b|\braide\b|\bsouple\b|\bdext[ée]rit[ée]\b|\bagripper\b|\bmanœuvrer\b|\bstiff\b/i,
  durabilite: /\busure\b|\bdurab|\bapr[èe]s (?:quelques|deux|2|une)\s*(?:semaines?|mois|lavages?)\b|\bne (?:dure|durent) pas\b/i,
  local: /\bqu[ée]b[ée]cois\b|\bfait ici\b|\bfabriqu[ée] (?:au|ici)\b|\bd[ée]localis|\bchine\b|\bvietnam\b|\blocal(?:e|ement)?\b|\bmade in\b/i,
  ecologie: /\bmonarque?s?\b|\b[ée]colog|\benvironnement\b|\bbiodiversit[ée]\b|\b[ée]conomie circulaire\b|\bpfas\b|\bv[ée]gan|\bplume?s?\b|\bduvet\b/i,
  prix: /\bprix\b|\babordable\b|\btrop cher\b|\b\$\d|\bco[ûu]te\b|\bafford/i,
  "grandes-tailles": /\b5x\b|\b[2-4]x\b|\bgrandes tailles\b|\bplus size\b|\bbig (?:folk|heads|feet|hands)\b|\blarge humans\b/i,
  "capuchon-poches": /\bcapuch|\bcapuce\b|\bhood\b|\bpoche?s? (?:int[ée]rieure?s?|[àa] t[ée]l[ée]phone)\b|\bpocket\b/i,
  "vent-coutures": /\ble vent (?:passe|se faufile|entre)\b|\bpont thermique\b|\bcoutures? (?:scell|non scell)\b|\bwind\b/i,
  precommande: /\bpr[ée]commande\b|\bpr[ée]vente\b|\bpre-?order\b|\bkickstarter\b|\bsociofinancement\b|\bautofinancement\b/i,
  // Un avis est PUBLIC : le même défaut y coûte bien plus cher qu'en privé.
  // Le compter comme thème plutôt que comme type laisse le contenu être classé
  // pour ce qu'il dit, tout en gardant visible qu'il est exposé.
  "avis-public": /a [ée]crit (?:l'|un )avis \d+ [ée]toile|a mis [àa] jour son avis|\bwrote a \d+[- ]star review\b/i,
  "avis-negatif": /a [ée]crit (?:l'|un )avis [12] [ée]toile|a mis [àa] jour son avis [12] [ée]toile/i,
  "avis-positif": /a [ée]crit (?:l'|un )avis [45] [ée]toile|a mis [àa] jour son avis [45] [ée]toile/i,
};

function detecte(dictionnaire, texte) {
  const trouves = [];
  for (const [nom, motif] of Object.entries(dictionnaire)) {
    if (motif.test(texte)) trouves.push(nom);
  }
  return trouves;
}

/**
 * Classe un texte brut. Renvoie {type, themes[], produits[]}.
 * `type` vaut "inclassé" quand aucun motif n'accroche — c'est un résultat
 * utile, pas un échec : le taux d'inclassés dit quand ce fichier a vieilli.
 */
function classe(texte) {
  const t = String(texte || "");
  const trouve = TYPES.find((r) => r.motif.test(t));
  return {
    type: trouve ? trouve.type : "inclassé",
    themes: detecte(THEMES, t),
    produits: detecte(PRODUITS, t),
  };
}

/** Agrégats sur un lot de signaux — la vue que lit un humain pressé. */
function agrege(signaux) {
  const compte = (cle) => {
    const m = new Map();
    for (const s of signaux) {
      const vals = Array.isArray(s[cle]) ? s[cle] : [s[cle]];
      for (const v of vals) if (v) m.set(v, (m.get(v) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    total: signaux.length,
    par_type: compte("type"),
    par_theme: compte("themes"),
    par_produit: compte("produits"),
    par_statut: compte("statut"),
  };
}

module.exports = { classe, agrege, PRODUITS, THEMES, TYPES };
