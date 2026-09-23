/**
 * Le lexique du classement : quels produits, quels problèmes.
 *
 * SÉPARÉ DU CODE EXPRÈS. C'est la partie qui se corrige à la lecture des
 * résultats, pas à la relecture de l'algorithme. Chaque entrée est une
 * décision révisable ; le moteur, lui, ne bouge pas.
 *
 * Les motifs sont appliqués sur du texte SANS ACCENTS et en minuscules.
 */
'use strict';

/* ------------------------------------------------------------------ produits
 * Du plus spécifique au plus générique : le premier qui touche gagne. Un terme
 * générique qui désigne plusieurs produits (« mitaines », « manteau ») ne
 * suffit pas à attribuer — il donne une FAMILLE, et le fil reste à part.
 * TAXONOMIE.md : « Un fil sans produit identifiable est gardé à part plutôt
 * que rattaché au hasard. »
 */
const PRODUITS = [
  // — les sans ambiguïté
  ['GLACIERE',        [/\bglaciere(s)?\b/, /\bsac a dos glaciere\b/, /\bcooler\b/]],
  ['PANTOUFLES',      [/\bpantoufle(s)?\b/, /\bchausson(s)?\b/]],
  ['GANTS-MAGIQUES',  [/\bgant(s)? magique(s)?\b/]],
  ['OREILLER-CAMPING',[/\boreiller de camping\b/, /\boreiller gonflable\b/]],
  ['OREILLER',        [/\boreiller\b/]],
  ['COUSSIN-ANIMAL',  [/\bcoussin (pour |d')?(animaux|animal|chien|chat)\b/, /\blit pour (chien|chat)\b/]],
  ['COUSSIN',         [/\bcoussin d'assise\b/, /\bcoussin thermal\b/, /\bcoussin\b/]],
  ['SAC-VIN',         [/\bsac a (bouteille|vin)\b/, /\bporte-bouteille\b/]],
  ['MANCHON',         [/\bmanchon\b/]],
  ['ETUI-TEL',        [/\betui (pour )?(telephone|cellulaire)\b/, /\betui a telephone\b/]],
  ['TOTE',            [/\btote ?bag\b/, /\bsac fourre-tout\b/],],
  ['SAC-LUNCH',       [/\bsac a lunch\b/, /\bboite a lunch\b/]],
  ['BESACE',          [/\bbesace\b/]],
  ['CHANDAIL',        [/\bchandail\b/, /\bpull\b/, /\bpolar isole\b/]],
  ['VESTE',           [/\bveste sans manche(s)?\b/, /\bveste\b/, /\bsans manches? isole/]],
  ['FOULARD',         [/\bfoulard\b/]],
  ['BANDEAU-TUQUE',   [/\bbandeau tuque\b/, /\btuque urbaine\b/]],
  ['BANDEAU',         [/\bbandeau(x)?\b/]],
  ['TUQUE-SPORT',     [/\btuque sport\b/, /\btuque de sport\b/]],
  ['TUQUE-VILLE',     [/\btuque de ville\b/]],
  ['CACHE-COU-ENF-18M4A', [/\bcache-?cou (enfant |pour enfant )?18 ?mois/, /\bcache-?cou bambin\b/]],
  ['CACHE-COU-ENF-5A13A', [/\bcache-?cou (enfant |pour enfant )?5-?13\b/]],
  ['CACHE-COU',       [/\bcache-?cou(s)?\b/, /\bneck ?warmer\b/, /\bcache cou\b/]],
  ['MIT-BEBE',        [/\bmitaine(s)? (pour )?bebe(s)?\b/, /\bmitaine(s)? de bebe\b/]],
  ['MIT-CUIR',        [/\bmitaine(s)?[^.]{0,30}\bcuir\b/, /\bmitaine(s)? de mouton\b/]],
  ['MIT-LAINE',       [/\bmitaine(s)?[^.]{0,30}\blaine\b/]],
  ['MIT-POLAR',       [/\bmitaine(s)? (urbaine|polar)/, /\bmitaine(s)? de ville\b/]],
  ['MIT-PLEIN-AIR',   [/\bmitaine(s)? (de )?plein ?air\b/, /\bmitaine(s)? d'expedition\b/]],
  ['SEMELLE-9',       [/\bsemelle(s)?[^.]{0,20}\b(9|10|11|12|13)\b/]],
  ['SEMELLE-678',     [/\bsemelle(s)?\b/, /\binsole(s)?\b/]],
  ['MANTEAU-3SAISONS',[/\bmanteau[^.]{0,25}(3|trois) saisons?\b/, /\bmanteau mi-saison\b/]],
  ['MANTEAU-HIVER',   [/\bmanteau (hivernal|d'hiver)\b/, /\bparka\b/]],
  ['SAC-COUCHAGE-18', [/\bsac de couchage[^.]{0,25}-? ?18\b/]],
  ['SAC-COUCHAGE-0',  [/\bsac de couchage\b/, /\bcouverture de plein air\b/]],
];

/* Termes qui nomment une FAMILLE sans désigner un produit : on n'attribue pas. */
const AMBIGUS = [
  [/\bmitaine(s)?\b|\bmoufle(s)?\b/, 'mitaines'],
  [/\bmanteau(x)?\b|\bmantau\b/,     'manteaux'],
  [/\btuque(s)?\b/,                  'tuques'],
];

/* ----------------------------------------------------------------- problèmes
 * L'intitulé est ce que l'atelier lira en tête d'un groupe repliable. Il doit
 * nommer le geste ou la pièce, pas l'émotion : « Couture décousue » se
 * corrige, « mauvaise qualité » ne se corrige pas.
 *
 * `sauf` retire les faux amis que la lecture des fils a fait apparaître.
 */
const PROBLEMES = [
  // — bris
  { cle:'couture',    titre:'Couture décousue ou qui lâche', famille:'bris',
    motifs:[/\bdecous(u|ue|us|ues|)\b/, /\bcouture[^.]{0,25}\b(lache|lachee|cede|cedee|ouvert|ouverte|defait|defaite)\b/,
            /\bcouture[^.]{0,20}\bdefaut\b/, /\bpoint(s)? saute(s)?\b/],
    sauf:[/\blachez (pas|rien)\b/, /\bne lachez\b/] },
  { cle:'zip',        titre:'Fermeture éclair défaillante', famille:'bris',
    motifs:[/\bfermeture(s)? eclair[^.]{0,40}\b(brise|brisee|casse|cassee|bloque|bloquee|coince|coincee|defect|marche pas|fonctionne pas|arrache|arrachee|saute|sautee)\b/,
            /\bzipper[^.]{0,40}\b(brise|brisee|casse|cassee|bloque|bloquee|coince|arrache|saute|marche pas)\b/,
            /\bglissiere[^.]{0,30}\b(bloque|coince|brise|casse)\b/] },
  { cle:'quincaillerie', titre:'Quincaillerie cassée (attache, boucle, bretelle)', famille:'bris',
    motifs:[/\b(attache|boucle|bretelle|sangle|clip|mousqueton|oeillet|rivet)[^.]{0,35}\b(casse|cassee|brise|brisee|arrache|arrachee|lache|lachee|sorti|sortie|decousu)\b/,
            /\bquincaillerie[^.]{0,30}\b(brise|casse|lache|defect)\b/] },
  { cle:'decolle',    titre:'Pièce décollée (semelle, doublure, enduit)', famille:'bris',
    motifs:[/\b(decolle|decollee|decollent|se decolle|se decollent)\b/, /\bcolle (a )?(lache|cede)\b/] },
  { cle:'perce',      titre:'Tissu percé, déchiré ou effiloché', famille:'bris',
    motifs:[/\b(perce|percee|troue|trouee|dechire|dechiree|effiloche|effilochee|effiloche)\b/,
            /\btrou(s)? (dans|au|a la|sur)\b/] },
  { cle:'isolant',    titre:'Isolant qui migre ou se tasse', famille:'bris',
    motifs:[/\b(isolant|asclepiade|soie|fibre|rembourrage|duvet)[^.]{0,40}\b(migre|migrent|migration|tasse|tassee|deplace|sort|sortent|ressort|ressortent|agglomere|paquet)\b/,
            /\bbosse(s)? (d')?(isolant|rembourrage)\b/] },
  { cle:'casse-gen',  titre:'Pièce cassée ou brisée (autre)', famille:'bris',
    motifs:[/\b(casse|cassee|brise|brisee)\b/],
    sauf:[/\blacasse\b/, /\bfracasse\b/, /\bcasse-?croute\b/, /\bcasse-?tete\b/] },

  // — insatisfaction
  { cle:'raide',      titre:'Tissu raide, rigide ou cartonné', famille:'insatisfaction',
    motifs:[/\b(raide|rigide|cartonne|cartonnee|carton)\b/],
    sauf:[/\braide mort\b/] },
  { cle:'gratte',     titre:'Gratte, pique ou irrite la peau', famille:'insatisfaction',
    motifs:[/\b(gratte|grattant|pique|piquant|irrite|irritant|demange)\b/],
    sauf:[/\bpique-?nique\b/, /\bpique(r|z)? (une |votre )?curiosite\b/] },
  { cle:'odeur',      titre:'Odeur', famille:'insatisfaction',
    motifs:[/\bodeur(s)?\b/, /\bsent (mauvais|le |la )\b/, /\bpue\b/] },
  { cle:'pas-chaud',  titre:'Pas assez chaud', famille:'insatisfaction',
    motifs:[/\bpas (assez )?chaud(e|es|s)?\b/, /\bmoins chaud\b/, /\bfroid aux\b/, /\bj'ai (eu )?froid\b/] },
  { cle:'trop-chaud', titre:'Trop chaud', famille:'insatisfaction',
    motifs:[/\btrop chaud(e|es|s)?\b/] },
  { cle:'photo',      titre:'Ne correspond pas à la photo ou à la description', famille:'insatisfaction',
    motifs:[/\bne correspond (pas|vraiment pas)\b/, /\bpas comme sur (la |les )?photo/, /\brien a voir avec (la |les )?photo/,
            /\bdifferent(e)? de (la |l')?(photo|image|description)/, /\bcouleur[^.]{0,25}\bdifferente\b/] },
  { cle:'lourd',      titre:'Lourd ou encombrant', famille:'insatisfaction',
    motifs:[/\b(lourd|lourde|pesant|pesante|encombrant|encombrante)\b/] },
  { cle:'decu',       titre:'Déçu de la qualité à la réception', famille:'insatisfaction',
    motifs:[/\b(decu|decue|decus|decues|decevant|decevante|pas a la hauteur)\b[^.]{0,120}\b(qualite|tissu|couture|coutures|finition|fini|matiere|materiaux|fabrication|isolation|chaleur|solidite)\b/,
            /\b(qualite|tissu|couture|coutures|finition|fini|matiere|fabrication)\b[^.]{0,120}\b(decu|decue|decevant|decevante|pas a la hauteur)\b/,
            /\bqualite[^.]{0,25}\b(decevante|mediocre|ordinaire|moindre)\b/],
    sauf:[/\b(colis|livraison|expedition|poste|transporteur|commande pas (encore )?recue|toujours pas recu|sans nouvelle|delai|retard)\b/] },
  { cle:'inconfort',  titre:'Inconfortable', famille:'insatisfaction',
    motifs:[/\binconfortable\b/, /\bpas confortable\b/] },

  // — ajustement
  { cle:'petit',      titre:'Trop petit', famille:'ajustement',
    motifs:[/\btrop petit(e|es|s)?\b/, /\btrop serre(e|es|s)?\b/, /\btrop juste\b/, /\bentre pas\b/, /\bne rentre pas\b/] },
  { cle:'grand',      titre:'Trop grand', famille:'ajustement',
    motifs:[/\btrop grand(e|es|s)?\b/, /\btrop large(s)?\b/, /\btrop ample(s)?\b/, /\btrop long(ue|ues|s)?\b/] },
  { cle:'court',      titre:'Trop court', famille:'ajustement',
    motifs:[/\btrop court(e|es|s)?\b/] },
];

module.exports = { PRODUITS, AMBIGUS, PROBLEMES };
