/**
 * Les silhouettes de produits — la seule chose de l'app qui ne soit pas en
 * français.
 *
 * POURQUOI PAS LA PHOTO. On a 678 photos Shopify et elles sont gratuites. Mais
 * une vignette, c'est une requête vers le CDN par ligne de tableau : trente
 * ordres affichés, trente allers-retours sur la connexion tunisienne. Et à
 * 18 px, un manteau noir et une besace noire sont deux taches sombres — la
 * photo ne distingue que ce qui est déjà gros. La photo reste où on la
 * regarde vraiment : la fiche produit et le contrôle qualité.
 *
 * POURQUOI PAS UNE BALISE <svg> EN LIGNE. Un tracé pèse 150 à 250 octets et se
 * répète à chaque ligne. Servies en masque CSS depuis `style.css`, les vingt et
 * une formes sont téléchargées une fois, mises en cache un jour, et le balisage
 * d'une ligne retombe à `<i class="sil s-tuque"></i>` — vingt-huit octets.
 * Le masque prend la couleur du texte : rien à refaire pour le mode sombre.
 *
 * VINGT ET UNE FORMES POUR TRENTE-QUATRE PRODUITS. Deux tailles de semelle ont
 * la même silhouette, et c'est voulu : la forme dit la famille, le nom dit
 * lequel. Une silhouette par variante ferait vingt icônes indistinctes.
 */

// Tracés dans une boîte de 24 × 24. Remplissage plein, pas de contour : un
// contour de 1 px disparaît quand le masque est réduit à 16 px.
const TRACES = {
  tube:      'M12 3c4 0 7 1.4 7 3.2v11.6c0 1.8-3 3.2-7 3.2s-7-1.4-7-3.2V6.2C5 4.4 8 3 12 3zm0 1.8c-3 0-5.2.9-5.2 1.4S9 7.6 12 7.6s5.2-.9 5.2-1.4S15 4.8 12 4.8z',
  bandeau:   'M12 4c5.5 0 10 4.5 10 10v4h-5.6v-4a4.4 4.4 0 0 0-8.8 0v4H2v-4C2 8.5 6.5 4 12 4z',
  tuque:     'M12 3.2c3.9 0 7 3.1 7 7v3.6H5v-3.6c0-3.9 3.1-7 7-7zM4 15h16c1.1 0 2 .9 2 2s-.9 2-2 2H4c-1.1 0-2-.9-2-2s.9-2 2-2z',
  foulard:   'M5.2 3.4h13.6v13.4H5.2zM6.4 17.6h2.2v3.6H6.4zM9.9 17.6h2.2v3.6H9.9zM13.4 17.6h2.2v3.6h-2.2zM16.9 17.6h1.9v3.6h-1.9z',
  mitaine:   'M8.2 8.4a3.8 3.8 0 0 1 7.6 0v2.2h1a2.1 2.1 0 0 1 0 4.2h-1v4a2.4 2.4 0 0 1-2.4 2.4h-2.8A2.4 2.4 0 0 1 8.2 18.6zM5.4 6.6a1.9 1.9 0 0 1 3.4 1.7l-1.6 3.4a1.9 1.9 0 0 1-3.4-1.7z',
  gant:      'M5.6 11.4V7a1.2 1.2 0 0 1 2.4 0v2.6h.9V4.4a1.2 1.2 0 0 1 2.4 0v5.2h.9V4a1.2 1.2 0 0 1 2.4 0v5.6h.9V6.6a1.2 1.2 0 0 1 2.4 0v7.6a6.6 6.6 0 0 1-6.6 6.6 5.7 5.7 0 0 1-5.7-5.7z',
  semelle:   'M12 8.6c3 0 5 2.6 5 5.6 0 1.6-.4 2.7-.8 3.7-.5 1.2-.9 2.2-.9 3.3 0 1.4-1.4 2.2-3.3 2.2s-3.3-.8-3.3-2.2c0-1.1-.4-2.1-.9-3.3-.4-1-.8-2.1-.8-3.7 0-3 2-5.6 5-5.6zM8.1 4.6a1.6 1.8 0 1 1 0 3.6 1.6 1.8 0 0 1 0-3.6zM11.2 2.4a1.5 1.8 0 1 1 0 3.6 1.5 1.8 0 0 1 0-3.6zM14.1 2.6a1.4 1.7 0 1 1 0 3.4 1.4 1.7 0 0 1 0-3.4zM16.6 4.4a1.3 1.5 0 1 1 0 3 1.3 1.5 0 0 1 0-3z',
  coussin:   'M6 4.6h12c2 0 3.4 1.8 3 3.7l-1.4 9c-.3 1.9-1.4 3.1-3.3 3.1H7.7c-1.9 0-3-1.2-3.3-3.1l-1.4-9c-.4-1.9 1-3.7 3-3.7z',
  oreiller:  'M4.6 5.6h14.8c1.9 0 3.2 1.2 3.2 2.9 0 1.2-.7 1.9-1.5 2.4-.8.5-1.3.9-1.3 1.4s.5.9 1.3 1.4c.8.5 1.5 1.2 1.5 2.4 0 1.7-1.3 2.9-3.2 2.9H4.6c-1.9 0-3.2-1.2-3.2-2.9 0-1.2.7-1.9 1.5-2.4.8-.5 1.3-.9 1.3-1.4s-.5-.9-1.3-1.4c-.8-.5-1.5-1.2-1.5-2.4 0-1.7 1.3-2.9 3.2-2.9z',
  besace:    'M9 5.6V4.8a3 3 0 0 1 6 0v.8h-2V4.8a1 1 0 0 0-2 0v.8zM7.6 5.6h8.8l2.4 4.4H5.2zM5.2 11.4h13.6v7.4a2.6 2.6 0 0 1-2.6 2.6H7.8a2.6 2.6 0 0 1-2.6-2.6z',
  saclunch:  'M7.2 4.4h9.6L18.6 8H5.4zM5.4 9.4h13.2v9.4a2.4 2.4 0 0 1-2.4 2.4H7.8a2.4 2.4 0 0 1-2.4-2.4z',
  tote:      'M9.4 8V6a2.6 2.6 0 0 1 5.2 0v2h-1.8V6a.8.8 0 0 0-1.6 0v2zM5 8h14l-1.1 11.8a1.6 1.6 0 0 1-1.6 1.4H7.7a1.6 1.6 0 0 1-1.6-1.4z',
  glaciere:  'M9.8 2.8h4.4c.6 0 1 .4 1 1v2.2h-6.4V3.8c0-.6.4-1 1-1zM3.4 7.4h17.2v3.2H3.4zM4.6 11.8h14.8v7.4a2.2 2.2 0 0 1-2.2 2.2H6.8a2.2 2.2 0 0 1-2.2-2.2z',
  manteau:   'M9.4 2.6 12 5.6l2.6-3 4.6 2.2 1.8 6.6-3.2 1v9.2H6.2V12.4l-3.2-1 1.8-6.6zm1.7 3.9h1.8v13h-1.8z',
  veste:     'M9.2 2.6 4.8 5v16.4h5V9.8h4.4v11.6h5V5l-4.4-2.4L12 7z',
  tshirt:    'M9 2.8 3.6 5.4 5.8 9.8 8.4 8.6V21h7.2V8.6l2.6 1.2 2.2-4.4L15 2.8a3.2 3.2 0 0 1-6 0z',
  chandail:  'M9.4 2.8h5.2l5.2 3-2.4 6.6-2-1V21H8.6v-9.6l-2 1-2.4-6.6z',
  couchage:  'M7.4 3.2h5.2c4.6 0 8.4 3.8 8.4 8.4v6.6a3 3 0 0 1-3 3H7.4a4 4 0 0 1-4-4V7.2a4 4 0 0 1 4-4zm1 2.6a1.3 1.3 0 0 0 0 2.6h4.4a1.3 1.3 0 0 0 0-2.6z',
  etui:      'M8.4 2.2h7.2a2.6 2.6 0 0 1 2.6 2.6v14.4a2.6 2.6 0 0 1-2.6 2.6H8.4a2.6 2.6 0 0 1-2.6-2.6V4.8a2.6 2.6 0 0 1 2.6-2.6zm1.4 2.2a.8.8 0 0 0 0 1.6h4.4a.8.8 0 0 0 0-1.6z',
  manchon:   'M7.2 4.6h9.6l-1 14.6a2.2 2.2 0 0 1-2.2 2h-3.2a2.2 2.2 0 0 1-2.2-2zm9.9 3.2h1.3a2.6 2.6 0 0 1 0 5.2h-1.6l.1-2h1.5a.6.6 0 0 0 0-1.2h-1.4z',
  sacvin:    'M10.4 2.2h3.2v2h-3.2zM10.8 4.4h2.4v4.6h-2.4zM7.4 9.2h9.2l.9 10.4a1.7 1.7 0 0 1-1.7 1.8H8.2a1.7 1.7 0 0 1-1.7-1.8z',
  pantoufle: 'M3.6 15.4c0-1.2.8-2.1 2-2.5 2.6-.9 4-2.2 5.4-3.6a4.6 4.6 0 0 1 3.3-1.4h.3a5.6 5.6 0 0 1 5.6 5.6v1.7a3.4 3.4 0 0 1-3.4 3.4H6.4a2.8 2.8 0 0 1-2.8-2.8zM14.6 9.6c-1.7 0-3 .8-3.8 2.1l3.8 1.4 3.8-1.4c-.8-1.3-2.1-2.1-3.8-2.1z',
};

// Le code produit décide, jamais le nom : un nom se renomme, un code non.
const PAR_CODE = {
  'CACHE-COU': 'tube', 'CACHE-COU-ENF-18M4A': 'tube', 'CACHE-COU-ENF-5A13A': 'tube',
  'BANDEAU': 'bandeau', 'BANDEAU-TUQUE': 'bandeau',
  'TUQUE-SPORT': 'tuque', 'TUQUE-VILLE': 'tuque',
  'FOULARD': 'foulard',
  'MIT-PLEIN-AIR': 'mitaine', 'MIT-POLAR': 'mitaine', 'MIT-LAINE': 'mitaine',
  'MIT-CUIR': 'mitaine', 'MIT-BEBE': 'mitaine',
  'GANTS-MAGIQUES': 'gant',
  'SEMELLE-678': 'semelle', 'SEMELLE-9': 'semelle',
  'COUSSIN': 'coussin', 'COUSSIN-ANIMAL': 'coussin',
  'OREILLER': 'oreiller', 'OREILLER-CAMPING': 'oreiller',
  'BESACE': 'besace',
  'SAC-LUNCH': 'saclunch',
  'TOTE': 'tote',
  'GLACIERE': 'glaciere',
  'MANTEAU-HIVER': 'manteau', 'MANTEAU-3SAISONS': 'manteau',
  'VESTE': 'veste',
  'CHANDAIL': 'chandail',
  'TSHIRT-BRODE': 'tshirt',
  'SAC-COUCHAGE-0': 'couchage', 'SAC-COUCHAGE-18': 'couchage',
  'ETUI-TEL': 'etui',
  'MANCHON': 'manchon',
  'SAC-VIN': 'sacvin',
  'PANTOUFLES': 'pantoufle',
};

// Un produit créé après coup n'a pas sa ligne ici. Plutôt que de ne rien
// montrer, on lit son nom — c'est faillible, donc ça ne sert qu'en dernier
// recours, et un code connu ne passe jamais par là.
const PAR_MOT = [
  [/cache[- ]?cou|tour de cou/i, 'tube'],
  [/bandeau/i,                   'bandeau'],
  [/tuque|bonnet/i,              'tuque'],
  [/foulard|écharpe|echarpe/i,   'foulard'],
  [/mitaine|moufle/i,            'mitaine'],
  [/gant/i,                      'gant'],
  [/semelle/i,                   'semelle'],
  [/oreiller/i,                  'oreiller'],
  [/coussin/i,                   'coussin'],
  [/besace/i,                    'besace'],
  [/sac à lunch|sac a lunch|lunch/i, 'saclunch'],
  [/tote/i,                      'tote'],
  [/glaci[èe]re/i,               'glaciere'],
  [/manteau|parka/i,             'manteau'],
  [/veste|gilet/i,               'veste'],
  [/t-?shirt|tee-?shirt/i,       'tshirt'],
  [/chandail|pull/i,             'chandail'],
  [/sac de couchage/i,           'couchage'],
  [/étui|etui|t[ée]l[ée]phone/i, 'etui'],
  [/manchon/i,                   'manchon'],
  [/vin|bouteille/i,             'sacvin'],
  [/pantoufle|chausson/i,        'pantoufle'],
];

/** La clé de silhouette d'un produit, ou null si on ne sait pas. */
function cle(code, nom = '') {
  if (code && PAR_CODE[code]) return PAR_CODE[code];
  for (const [re, k] of PAR_MOT) if (re.test(nom || '')) return k;
  return null;
}

/**
 * Le bloc CSS, concaténé à `style.css` au moment de le servir plutôt que
 * recopié dedans : une copie se désynchronise, une concaténation non.
 */
function css() {
  const regles = Object.entries(TRACES).map(([k, d]) => {
    // Encoder tout au pour-cent triplait le poids du fichier. Seuls ces
    // cinq caractères cassent une URI de données entre guillemets.
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>`
              + `<path fill-rule='evenodd' d='${d}'/></svg>`;
    const uri = `url("data:image/svg+xml,${svg.replace(/[<>#%"]/g,
      (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())}")`;
    return `.s-${k}{-webkit-mask-image:${uri};mask-image:${uri}}`;
  });
  return `\n/* silhouettes de produits — engendrées par silhouettes.js */\n`
       + `.sil{display:inline-block;width:1.15em;height:1.15em;vertical-align:-.22em;`
       + `flex:0 0 auto;background-color:currentColor;opacity:.72;margin-right:.34em;`
       + `-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;`
       + `-webkit-mask-position:center;mask-position:center;`
       + `-webkit-mask-size:contain;mask-size:contain}\n`
       + `a:hover>.sil,a:hover .sil{opacity:1}\n`
       + `.mini-nu .sil{margin-right:0}\n`
       + regles.join('\n') + '\n';
}

module.exports = { TRACES, PAR_CODE, cle, css };
