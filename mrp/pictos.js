/**
 * Les planches de contrôle — comment faire le geste, sans un mot.
 *
 * POURQUOI PAS DES IMAGES ENGENDRÉES. Ce qui fait qu'une notice se lit en
 * Tunisie comme au Québec, ce n'est pas le réalisme : c'est la CONSTANCE.
 * Même tissu, même main, mêmes flèches, d'une planche à l'autre. Un
 * générateur donnerait cent cinquante styles et des coutures qui ne veulent
 * rien dire. Et le MRP n'héberge rien : cent cinquante images matricielles
 * seraient cent cinquante requêtes sur la connexion tunisienne.
 *
 * LA GRAMMAIRE, qui vaut plus que les dessins eux-mêmes :
 *   — un panneau = un geste, numéroté, lu de gauche à droite ;
 *   — aucun texte, jamais. Les seuls signes écrits sont des CHIFFRES
 *     (3 minutes, 2 heures) et ils sont les mêmes dans les trois langues ;
 *   — une flèche ROUGE cernée de blanc dit le mouvement : elle se détache du
 *     dessin, on voit le geste avant l'objet ;
 *   — le ✓ et le ✗ qualifient le RÉSULTAT, jamais le geste — c'est la seule
 *     façon de montrer une décision sans la raconter ;
 *   — la pièce porte toujours sa COUTURE en pointillé. C'est elle qui fait
 *     lire « textile » plutôt que « planche de bois ».
 *
 * Chaque panneau est tracé dans une boîte de 176 × 140.
 */

const SIL = require('./silhouettes.js');

const T = { trait:'#17140f', creme:'#f7f2e6', tissu:'#3c7a59', tissuO:'#2a5940',
  tissuC:'#8fc0a6', peau:'#eec19b', peauO:'#c88f61', acier:'#ccd2d8', acierO:'#8a939c',
  rouge:'#d4342a', verre:'#dfeaf0', fil:'#e8e3d6', bois:'#b98a52' };

// ---- le tissu : une pièce souple, avec sa COUTURE. C'est la couture qui fait
// qu'on lit « textile » et pas « planche de bois ».
const piece = (x, y, e = 1, coul = T.tissu, ombre = T.tissuO) =>
 `<g transform="translate(${x} ${y}) scale(${e})">
  <path d="M2 22C26 8 72 6 104 18L104 44C72 34 26 36 2 50Z" fill="${coul}"/>
  <path d="M2 50C26 36 72 34 104 44l0 8C72 42 26 44 2 58Z" fill="${ombre}"/>
  <path d="M2 22C26 8 72 6 104 18l0 34C72 42 26 44 2 58Z" fill="none"/>
  <path d="M8 44C30 31 70 29 99 39" fill="none" stroke="${T.tissuC}"
        stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round"/>
 </g>`;

// ---- les fils qui dépassent, partant du bord de la couture
const filsLibres = (x, y) => `<g transform="translate(${x} ${y})" fill="none"
  stroke="${T.trait}" stroke-width="2" stroke-linecap="round">
  <path d="M0 0c8-2 10-8 18-11"/><path d="M1 8c9 0 14-5 22-6"/>
  <path d="M0 15c7 3 15 0 21 4"/></g>`;

// ---- une main plus anatomique : paume pleine, pouce distinct, ombre au creux
const main = (x, y, r = 0, e = 1) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${e})">
  <path d="M7 24V6.5a3.2 3.2 0 0 1 6.4 0V13M13.4 13V3.2a3.2 3.2 0 0 1 6.4 0V13
           M19.8 13V6.5a3.2 3.2 0 0 1 6.4 0v18.5a9.5 9.5 0 0 1-9.5 9.5h-3.4
           A8.3 8.3 0 0 1 5 39.2V26a3.2 3.2 0 0 1 2-3z" fill="${T.peau}"/>
  <path d="M13.4 13V3.2M19.8 13V6.5" fill="none" stroke="${T.peauO}" stroke-width="1.6"/>
  <path d="M8 27c3 2 5 6 5 10" fill="none" stroke="${T.peauO}" stroke-width="1.4" opacity=".75"/>
 </g>`;

// ---- de vrais ciseaux : deux lames croisées, deux anneaux, une vis
const ciseaux = (x, y, r = 0, e = 1) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${e})">
  <path d="M2 0 22 30l-4 3L0 5Z" fill="${T.acier}"/>
  <path d="M26 0 6 30l4 3L28 5Z" fill="${T.acier}"/>
  <circle cx="20" cy="42" r="6.5" fill="none" stroke-width="3.4"/>
  <circle cx="8" cy="42" r="6.5" fill="none" stroke-width="3.4"/>
  <circle cx="14" cy="31" r="2.4" fill="${T.acierO}"/></g>`;

const loupe = (x, y, e = 1) => `<g transform="translate(${x} ${y}) scale(${e})">
  <circle cx="14" cy="14" r="12.5" fill="${T.verre}"/>
  <path d="M9 9a7 7 0 0 1 6-3" fill="none" stroke="#fff" stroke-width="2.6" opacity=".85"/>
  <path d="M23 23 34 34" fill="none" stroke-width="5" stroke-linecap="round"/></g>`;

const fleche = (d) => `<g><path d="${d}" fill="${T.rouge}" stroke="#fff"
  stroke-width="4" stroke-linejoin="round"/><path d="${d}" fill="${T.rouge}"
  stroke="${T.trait}" stroke-width="1.6" stroke-linejoin="round"/></g>`;

const oui = (x,y,e=1) => `<g transform="translate(${x} ${y}) scale(${e})"><circle cx="14" cy="14" r="13"
  fill="#2f7d52"/><path d="M7.5 14.5l4.5 4.5 9-10" fill="none" stroke="#fff" stroke-width="3.4"/></g>`;
const non = (x,y,e=1) => `<g transform="translate(${x} ${y}) scale(${e})"><circle cx="14" cy="14" r="13"
  fill="${T.rouge}"/><path d="M8.5 8.5l11 11M19.5 8.5l-11 11" fill="none" stroke="#fff" stroke-width="3.4"/></g>`;

const num = (n) => `<g><rect x="6" y="6" width="26" height="26" rx="7" fill="${T.trait}"/>
  <text x="19" y="26" fill="#fff" stroke="none" text-anchor="middle"
    font-family="system-ui,sans-serif" font-weight="700" font-size="17">${n}</text></g>`;


// ---- l'appareil photo : la preuve AVANT. Sans elle, l'essai ne prouve rien.
const appareil = (x, y, e = 1) => `<g transform="translate(${x} ${y}) scale(${e})">
  <path d="M0 10h10l5-7h20l5 7h10a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z"
        fill="${T.acier}"/>
  <circle cx="27" cy="27" r="11" fill="${T.verre}"/>
  <circle cx="27" cy="27" r="5" fill="${T.acierO}"/></g>`;

// ---- le chronomètre. Le chiffre est le seul écrit toléré : il se lit pareil
// en français, en arabe et en anglais.
const chrono = (x, y, n, u, e = 1) => `<g transform="translate(${x} ${y}) scale(${e})">
  <rect x="12" y="-6" width="16" height="7" rx="2" fill="${T.acierO}"/>
  <circle cx="20" cy="22" r="21" fill="${T.acier}"/>
  <circle cx="20" cy="22" r="16" fill="${T.creme}"/>
  <text x="20" y="29" fill="${T.trait}" stroke="none" text-anchor="middle"
    font-family="system-ui,sans-serif" font-weight="700" font-size="19">${n}</text>
  ${u ? `<text x="20" y="57" fill="${T.trait}" stroke="none" text-anchor="middle"
    font-family="system-ui,sans-serif" font-weight="600" font-size="13">${u}</text>` : ''}</g>`;

// ---- le bac d'eau froide
const bac = (x, y, e = 1) => `<g transform="translate(${x} ${y}) scale(${e})">
  <path d="M0 0h116v34a14 14 0 0 1-14 14H14A14 14 0 0 1 0 34Z" fill="${T.verre}"/>
  <path d="M0 0h116" fill="none"/></g>`;

const flocon = (x, y, e = 1) => `<g transform="translate(${x} ${y}) scale(${e})"
  fill="none" stroke="#2f6d93" stroke-width="3" stroke-linecap="round">
  <path d="M0 -16V16M-13.8 -8 13.8 8M-13.8 8 13.8 -8"/>
  <path d="M-4 -11 0 -7l4-4M-4 11 0 7l4 4M-14 -2l-1 5 4 3M14 2l1-5-4-3M-14 2l-1-5 4-3M14 -2l1 5-4 3"/></g>`;

const goutte = (x, y, e = 1) => `<g transform="translate(${x} ${y}) scale(${e})">
  <path d="M7 0C7 0 0 9 0 13a7 7 0 0 0 14 0C14 9 7 0 7 0z" fill="#79b4d4"/></g>`;

const soleil = (x, y, e = 1) => `<g transform="translate(${x} ${y}) scale(${e})">
  <circle cx="18" cy="18" r="11" fill="#f0b429"/>
  <path d="M18 0v5M18 31v5M0 18h5M31 18h5M5.3 5.3l3.5 3.5M27.2 27.2l3.5 3.5M30.7 5.3l-3.5 3.5M8.8 27.2l-3.5 3.5"
        fill="none" stroke="#f0b429" stroke-width="3.4" stroke-linecap="round"/></g>`;

// ---- la table : deux traits sous la pièce. « À plat », pas sur une corde.
const table = (x, y) => `<g><path d="M${x} ${y}h144M${x + 14} ${y + 9}h116"
  fill="none" stroke-width="3" stroke-linecap="round"/></g>`;

// ---- l'étiquette, prise dans la couture sur toute sa largeur
const etiquette = (x, y, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r})">
  <rect x="0" y="0" width="52" height="26" rx="3" fill="${T.fil}"/>
  <path d="M9 9h34M9 17h22" fill="none" stroke-width="2.4"/></g>`;

// ---- la même, prise d'un seul côté : un coin pend
const etiquetteDecousue = (x, y) => `<g transform="translate(${x} ${y})">
  <path d="M0 0h52v26l-52-8Z" fill="${T.fil}"/>
  <path d="M9 8h30M9 16h18" fill="none" stroke-width="2.4"/></g>`;

const telephone = (x, y, e = 1) => `<g transform="translate(${x} ${y}) scale(${e})">
  <rect x="0" y="0" width="40" height="64" rx="7" fill="${T.acier}"/>
  <rect x="5" y="9" width="30" height="46" rx="2" fill="${T.verre}"/>
  <path d="M15 5h10" fill="none" stroke-width="2.4"/>
  <path d="M9 40C16 30 30 30 31 39l0 12H9Z" fill="${T.tissu}" stroke-width="1.8"/></g>`;

// ---- deux mains qui tirent de part et d'autre d'une couture
// Deux mains qui saisissent la couture et tirent. Les rotations tournent
// autour de l'origine, pas autour de la figure : les translations sont
// calculées à partir de la boîte tournée, sinon la main sort du panneau.
const traction = () =>
  main(46, 46, 90, 1.0) + main(130, 79, -90, 1.0)
  + fleche('M74 28H46v-6l-13 9 13 9v-6h28z')
  + fleche('M102 28h28v-6l13 9-13 9v-6h-28z');

// ---- un fragment de couture, vu de près : deux épaisseurs et le point
const couture = (x, y, e = 1, ouverte = false) =>
 `<g transform="translate(${x} ${y}) scale(${e})">
  <path d="M0 0h96v22H0Z" fill="${T.tissu}"/>
  <path d="M0 22h96v10H0Z" fill="${T.tissuO}"/>
  <path d="M0 0h96v32H0Z" fill="none"/>
  ${ouverte
    ? `<path d="M8 16h22M38 16h8M54 16h30" fill="none" stroke="${T.rouge}"
         stroke-width="3" stroke-linecap="round"/>
       <path d="M30 16l8 -9M46 16l8 9" fill="none" stroke="${T.trait}" stroke-width="2"/>`
    : `<path d="M8 16h80" fill="none" stroke="${T.tissuC}" stroke-width="3"
         stroke-dasharray="7 5" stroke-linecap="round"/>`}
 </g>`;

/**
 * Une planche de POINT DE RUPTURE : là où ce produit-là lâche vraiment.
 *
 * Panneau 1 : la pièce entière, la zone faible cerclée de rouge. C'est le seul
 * panneau propre au produit — le geste, lui, est le même partout : tirer de
 * part et d'autre de la couture. Trois panneaux génériques pour vingt zones
 * valent mieux que soixante dessins qui divergent.
 *
 * Les zones ne sont pas choisies : elles viennent du corpus voix-client. La
 * jonction main/pouce des mitaines, c'est dix-sept clients qui écrivent « le
 * pouce a décousu ». La sangle de la glacière, c'est « les sangles du haut
 * dont la couture casse et découd ».
 */
function rupture(forme, zx, zy) {
  const d = SIL.TRACES[forme];
  if (!d) return null;
  const E = 4.3, X = 37, Y = 18;
  const piece = `<g transform="translate(${X} ${Y}) scale(${E})">
    <path fill-rule="evenodd" d="${d}" fill="${T.tissu}" stroke="${T.trait}"
      stroke-width="${(2.4 / E).toFixed(2)}"/></g>`;
  const cx = (X + zx * E).toFixed(1), cy = (Y + zy * E).toFixed(1);
  return [
    piece + `<circle cx="${cx}" cy="${cy}" r="17" fill="none" stroke="${T.rouge}"
       stroke-width="3.6"/><circle cx="${cx}" cy="${cy}" r="24" fill="none"
       stroke="${T.rouge}" stroke-width="2" opacity=".4"/>`,
    couture(50, 52, 0.8) + traction(),
    couture(40, 50, 0.95, true) + non(124, 96, 0.95),
    couture(40, 50, 0.95) + oui(124, 96, 0.95),
  ];
}

// ---- une fermeture éclair : ruban, dents, curseur
const zip = (x, y, e = 1, ouvert = 0) => `<g transform="translate(${x} ${y}) scale(${e})">
  <path d="M0 0h104v13H0Z" fill="${T.tissu}"/><path d="M0 21h104v13H0Z" fill="${T.tissu}"/>
  <path d="M0 0h104v13H0ZM0 21h104v13H0Z" fill="none"/>
  ${[...Array(13)].map((_, i) => i * 8 > ouvert
    ? `<path d="M${i * 8 + 3} 13v8" stroke="${T.acierO}" stroke-width="3"/>`
    : `<path d="M${i * 8 + 3} 11v-4M${i * 8 + 3} 23v4" stroke="${T.acierO}" stroke-width="3"/>`
  ).join('')}
  <rect x="${ouvert - 5}" y="9" width="15" height="17" rx="3" fill="${T.acier}"/>
  <path d="M${ouvert + 2} 26v9" stroke="${T.trait}" stroke-width="2.6"/>
  <rect x="${ouvert - 3}" y="34" width="11" height="8" rx="2" fill="${T.acier}"/></g>`;

// ---- deux bandes de velcro, crochets contre boucles
const velcro = (x, y, ecart = 0) => `<g transform="translate(${x} ${y})">
  <rect x="0" y="0" width="80" height="17" rx="2" fill="${T.tissu}"/>
  <path d="${[...Array(9)].map((_, i) => `M${i * 9 + 6} 4v9`).join('')}"
    stroke="${T.tissuC}" stroke-width="2.4"/>
  <rect x="0" y="${21 + ecart}" width="80" height="17" rx="2" fill="${T.tissuO}"/>
  <path d="${[...Array(9)].map((_, i) => `M${i * 9 + 6} ${25 + ecart}v9`).join('')}"
    stroke="${T.tissuC}" stroke-width="2.4" stroke-dasharray="2 2"/>
  <rect x="0" y="0" width="80" height="17" rx="2" fill="none"/>
  <rect x="0" y="${21 + ecart}" width="80" height="17" rx="2" fill="none"/></g>`;

// ---- un cord-lock sur son cordon, avec sa bille d'arrêt
// `pos` fait coulisser le bloqueur le long du cordon : sans lui, les trois
// panneaux se ressemblent et le geste ne se voit pas.
const cordlock = (x, y, e = 1, pos = 0) => `<g transform="translate(${x} ${y}) scale(${e})">
  <path d="M6 10h68" fill="none" stroke="${T.trait}" stroke-width="3.6"/>
  <circle cx="6" cy="10" r="6" fill="${T.trait}"/>
  <circle cx="74" cy="10" r="6" fill="${T.trait}"/>
  <rect x="${14 + pos}" y="0" width="26" height="21" rx="6" fill="${T.acier}"/>
  <rect x="${22 + pos}" y="5" width="10" height="11" rx="2.5" fill="${T.acierO}"/></g>`;

// -------------------------------------------------------------- les planches
//
// LES POINTS DE RUPTURE. Chaque zone vient du corpus voix-client, pas d'une
// intuition. Entre parenthèses, ce que les clients ont écrit.
const RUPTURES = {
  // « le pouce a décousu », « décousue entre le pouce et le reste des doigts »,
  // « une couture s'est défaite au pouce » — la rupture la plus fréquente du
  // catalogue, toutes mitaines confondues.
  mitaine_pouce:  ['mitaine',  6.5, 10],
  // « les sangles du haut dont la couture casse et découd », « la sangle est
  // décousue », « l'attache principale s'est cassée ».
  glaciere_sangle:['glaciere', 12,  5],
  // « après un lavage la partie basse est décollée (décousue ?) », « il est
  // décollé, jamais porté ».
  cachecou_bas:   ['tube',     12,  19],
  // « le côté de la semelle gauche s'est décousu (ou décollé) », « le rebord
  // décollé, le tissu rebique et s'effile ».
  semelle_bord:   ['semelle',  16.5, 17],
  // « quand j'ai essayé de le mettre, une couture du torsadé s'est défaite ».
  bandeau_torsade:['bandeau',  12,  15],
};

const PLANCHES = {
  fils: [
    piece(10, 48, 1.05) + filsLibres(118, 58) + loupe(86, 16, 0.95)
      + fleche('M46 118c-11 0-18-7-18-15h-7l11-13 11 13h-7c0 4 4 7 10 7z')
      + fleche('M84 118c11 0 18-7 18-15h7l-11-13-11 13h7c0 4-4 7-10 7z'),
    piece(6, 54, 0.9) + `<path d="M96 70 140 82" fill="none" stroke-width="2.6"/>`
      + main(156, 86, 172, 0.95)
      + fleche('M66 118h32v-7l16 11-16 11v-7H66z'),
    piece(6, 52, 0.9) + `<path d="M84 66 138 78" fill="none" stroke-width="2.6"/>`
      + `<path d="M14 88C34 76 70 74 96 83" fill="none" stroke="${T.rouge}"
           stroke-width="3" stroke-dasharray="7 5"/>`
      + main(156, 82, 172, 0.95) + non(114, 104, 0.9),
    piece(6, 54, 0.9) + `<path d="M96 70 124 62" fill="none" stroke-width="2.6"/>`
      + ciseaux(108, 16, 0, 1.05) + oui(20, 100, 0.9),
  ],
  etiquette: [
    piece(14, 34, 1.3) + etiquette(56, 86, 0) + oui(128, 96, 0.85),
    piece(14, 34, 1.3) + etiquette(56, 86, 180) + non(128, 96, 0.85),
    piece(14, 34, 1.3) + etiquetteDecousue(56, 86) + non(128, 96, 0.85),
  ],
  // Ouvrir ET refermer, deux fois, sur toute la course.
  fermeture: [
    zip(36, 52, 1.0, 0) + loupe(120, 12, 0.8),
    zip(36, 52, 1.0, 48) + fleche('M40 118h56v-6l13 9-13 9v-6H40z'),
    zip(36, 52, 1.0, 96) + fleche('M136 118H40v-6l-13 9 13 9v-6h96z'),
    zip(36, 52, 1.0, 0) + oui(124, 100, 0.95),
  ],
  // Presser, puis TIRER : un velcro qui ne résiste pas ne tient rien.
  velcro: [
    velcro(48, 48, 22) + fleche('M88 24v22h-6l9 13 9-13h-6V24z'),
    velcro(48, 54, 0) + main(40, 40, 0, 0.8),
    velcro(48, 48, 22) + fleche('M88 46V24h-6l9-13 9 13h-6v22z') + oui(126, 98, 0.9),
  ],
  // Faire coulisser, relâcher : il doit tenir la position.
  cordlock: [
    // On le fait coulisser.
    cordlock(42, 52, 1.15, 0) + fleche('M56 104h44v-6l13 9-13 9v-6H56z'),
    // On relâche : s'il redescend, il ne bloque rien.
    cordlock(42, 52, 1.15, 34) + fleche('M120 104H76v-6l-13 9 13 9v-6h44z')
      + non(128, 20, 0.85),
    // S'il reste où on l'a mis, il fait son travail.
    cordlock(42, 52, 1.15, 34) + oui(128, 20, 0.85),
  ],
  photo_boutique: [
    soleil(74, 6, 0.95) + telephone(22, 52) + loupe(70, 58, 0.8) + piece(96, 66, 0.6),
    oui(36, 52, 1.3) + non(102, 52, 1.3),
  ],
};

for (const [k, [forme, zx, zy]] of Object.entries(RUPTURES)) {
  const p = rupture(forme, zx, zy);
  if (p) PLANCHES[k] = p;
}

/** Le titre d'un point de contrôle → sa planche. Comparé sans accents ni
 *  ponctuation : un identifiant change au prochain import, pas le titre. */
const empreinte = (s) => String(s || '').normalize('NFD')
  .replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const PAR_TITRE = new Map([
  ['Fils qui dépassent — les retirer et les couper', 'fils'],
  ['Double frottement — 1. à sec', 'frottement_sec'],
  ['Lavage à l’eau froide, séchage au soleil', 'lavage'],
  ['Double frottement — 2. après gel et humidité', 'frottement_gel'],
  ['Après la séquence : ce qu’on compare', 'comparer'],
  ['Étiquette — sens, position, lisibilité', 'etiquette'],
  ['Comparaison avec la photo de la boutique', 'photo_boutique'],
  // Un point né de la révision produit par produit : cinq retours « trop
  // petit » sur la tuque sport, et aucune mesure à plat ne les voyait.
  ['Essai porté par au moins six personnes de gabarits différents', 'essai_porte'],
  // Mitaines plein air, révision du 24/09/2026. Le vrai cuir est accepté en
  // dépannage : ce qui se contrôle n'est plus la matière, c'est qu'une paire
  // ne soit jamais dépareillée. Et les deux étiquettes ont désormais une
  // distance, pas seulement un sens.
  // La densité est un contrôle À PART du test de traction : l'un se vérifie à
  // la machine en comptant, l'autre sur la pièce finie en tirant. Le titre de
  // la charte garde sa planche de rupture ; celui-ci a la sienne.
  ['Densité de couture à la jonction main/pouce : 10 points par pouce',
   'points_pouce'],
  ['Paume : même cuir sur les deux mitaines d\'une paire', 'paire_cuir'],
  ['Étiquettes de taille et de composition : même sens, à 1 po à l\'intérieur',
   'etiquette_mitaine'],
  // Les points de rupture. Les deux premiers existaient déjà au protocole :
  // le corpus n'a fait que confirmer qu'ils portent sur la bonne zone.
  ['Assemblage de la jonction main/pouce solide', 'mitaine_pouce'],
  ['Assemblage de la sangle résistant',           'glaciere_sangle'],
  ['Couture du bas du cache-cou : tirer de part et d\'autre', 'cachecou_bas'],
  ['Pourtour de la semelle : tirer de part et d\'autre',      'semelle_bord'],
  ['Couture du torsadé : tirer de part et d\'autre',          'bandeau_torsade'],
  // Les garnitures que l'audit a trouvées sans contrôle.
  ['Ouvrir et fermer la fermeture éclair sur toute sa course', 'fermeture'],
  ['Ouvrir et fermer chaque fermeture éclair',                 'fermeture'],
  ['Velcro : accroche et tient',                               'velcro'],
  ['Cord-lock présent et qui bloque',                          'cordlock'],
  // Le même geste, écrit autrement d'un produit à l'autre. Les rattacher ne
  // coûte aucun dessin : c'est la même planche qui s'affiche.
  ['Fermeture éclair',                                         'fermeture'],
  ['Ouvrir et fermer la fermeture éclair',                     'fermeture'],
  ['Ouvrir et fermer la fermeture éclair à plusieurs reprises', 'fermeture'],
  ['La fermeture éclair ouvre et ferme facilement',            'fermeture'],
  ['Fermeture éclair bien tendue',                             'fermeture'],
  ['Fermeture droite et tendue',                               'fermeture'],
  ['Fermetures éclair : couleur et glissement problématiques',  'fermeture'],
  ['Velcro',                                                   'velcro'],
  ['Plier et attacher le coussin en accordéon au velcro, étiquette visible vers le haut', 'velcro'],
  ['Élastique du capuchon : coulisse et tient',                'cordlock'],
  // La bille n'est pas un cord-lock : c'est ce qui empêche le cord-lock de
  // sortir du cordon. Norme enfant — aucune pièce détachable.
  ['Billes pour bloquer le cord-lock noir',           'bille'],
  ['Lacet et élastique bien attachés au cord-lock',   'bille'],
  ['Logo de l\'étiquette droit',                               'etiquette'],
  ['Étiquette de taille présente et orientée du même sens que les autres', 'etiquette'],
  ['Étiquette intégrée à la base gauche de l\'étui',            'etiquette'],
  ['Taille sur l\'étiquette = taille du patron',                'etiquette'],
  ['Cuir synthétique conservé pour la paume',                  'mitaine_pouce'],
  ['Couture de la patch de cuir solide et droite',             'mitaine_pouce'],
  ['Assemblage sangle et boucle résistant',                    'glaciere_sangle'],
  ['Bretelles renforcées',                                     'glaciere_sangle'],
  ['Ganses solidement cousues',                                'glaciere_sangle'],
  ['Collage adéquat',                                          'semelle_bord'],
  ['Découpe finale droite et lisse sur la ligne intérieure',   'semelle_bord'],
  // ── les vingt-trois planches nées dessinées ────────────────────────────
  // Le double frottement, le lavage et la comparaison sont UNE procédure en
  // quatre temps : le protocole exige la même pièce d'un bout à l'autre.
  ['Double frottement — 1. à sec',                    'frottement'],
  ['Lavage à l\u2019eau froide, séchage au soleil',      'frottement'],
  ['Double frottement — 2. après gel et humidité',    'frottement'],
  ['Après la séquence : ce qu\u2019on compare',          'frottement'],
  ['Barre-tack (point de bride) présent à la base de la fermeture', 'fermeture'],
  // Quatre points d'élastique sont un seul examen de l'élastique.
  ['Élastique au poignet pas trop serré',             'elastique'],
  ['Élastique à la hauteur de la base du pouce',      'elastique'],
  ['Excédent d\'élastique',                            'elastique'],
  ['Élastiques bien pris dans la couture d\'assemblage', 'elastique'],
  ['Lacet bien intégré au niveau du poignet',         'lacet_poignet'],
  ['Crochets et lacet de la ganse : tirer',           'ganse_crochets'],
  ['Crochet métallique pour ganse',                   'ganse_crochets'],
  ['Sangle assemblée avec ses crochets métalliques, une par étui, placée à l\'intérieur du sac', 'ganse_crochets'],
  ['Lacet bien intégré pour la sangle',               'ganse_crochets'],
  ['Presser la pochette avant d\'y insérer l\'isolant', 'presser_isolant'],
  ['Presser le col avant d\'y insérer l\'isolant',      'presser_isolant'],
  ['Doublure de PVC sans trou',                       'doublure_trous'],
  ['Doublure de nylon sans trou',                     'doublure_trous'],
  ['Poche avant sans trou',                           'doublure_trous'],
  ['La fibre est répartie de manière uniforme',       'fibre_repartie'],
  ['La fibre ne doit pas être visible à la jonction de la base du gant', 'fibre_repartie'],
  ['Répartition de la fibre et des retailles de vegeto uniforme', 'fibre_repartie'],
  ['Fibre d\'asclépiade par gant',                     'fibre_repartie'],
  ['Matelassage droit',                               'matelassage'],
  ['Matelassage pas droit',                           'matelassage'],
  ['Début et fin du biais intégrés sous la sangle de rangement', 'biais_sangle'],
  ['Départ et fin du biais sous la ganse de rangement', 'biais_sangle'],
  ['Boutonnière à l\'arrière',                         'boutonniere'],
  ['Viseline pour solidifier les boutonnières',       'boutonniere'],
  ['AUCUNE pièce détachable — vérifier l\'absence',    'enfants_detachable'],
  ['Norme des produits pour enfants : aucune pièce ne doit être détachable', 'enfants_detachable'],
  ['Pas de tache de colle sur le produit',            'taches'],
  ['Pas de taches',                                   'taches'],
  ['Droit fil respecté, élasticité du bon côté',      'droit_fil'],
  ['Biais élastique des manches régulier',            'manches_egales'],
  ['Ouverture de la manche égale des deux côtés',     'manches_egales'],
  ['La mitaine gauche est identique à la droite',     'paire_identique'],
  ['Porter le gant pour l\'assouplir',                 'assouplir'],
  ['Finition des coutures intérieures',               'coutures_interieures'],
  ['Éviter l\'asclépiade dans les coutures',           'coutures_interieures'],
  ['Côté curseur selon le genre',                     'curseur_genre'],
  ['Rouler, dérouler, attacher',                      'rouler'],
  ['Emballage dans le carton sans comprimer',         'emballage_carton'],
  ['Emballage et estampe = bonne taille',             'emballage_carton'],
  ['Utiliser le gabarit du conteneur',                'emballage_carton'],
  ['Les 2 rubans de ganses à la même hauteur',        'ganses_hauteur'],
  ['Vérifier la concordance des lots de tissu',       'lots_tissu'],
  // Mesurer est un geste : à plat, ruban détendu, sans tirer.
  ['Dimensions de coupe',                             'mesures'],
  ['Dimensions finales selon le schéma des tailles',  'mesures'],
  ['Dimensions finies',                               'mesures'],
  ['Dimensions hors tout du bandeau',                 'mesures'],
  ['Hauteur hors tout',                               'mesures'],
  ['Largeur hors tout',                               'mesures'],
  ['Gradation — l\'écart entre tailles n\'est PAS uniforme', 'gradation'],
  ['Gradation — longueur de manche entre deux tailles', 'gradation'],
  ['Gradation — longueur du corps entre deux tailles', 'gradation'],
  ['Gradation — tour de hanche entre deux tailles',   'gradation'],
  ['Gradation — tour de poitrine entre deux tailles', 'gradation'],
].map(([t, k]) => [empreinte(t), k]));

/** La clé de planche d'un titre, ou null.
 *
 *  Null est le cas normal : tout point n'a pas de planche, et un dessin
 *  approximatif serait pire que rien. Une clé n'est rendue que si quelque chose
 *  existe derrière — images complètes ou tracé SVG. Un titre peut donc être
 *  rattaché à une planche dont les images ne sont pas encore générées : il se
 *  comporte alors comme s'il n'en avait pas, et s'allume tout seul le jour où
 *  elles arrivent. C'est ce qui permet de rattacher les titres AVANT de dessiner
 *  sans jamais afficher un cadre vide à l'atelier. */
const cle = (titre) => {
  const k = PAR_TITRE.get(empreinte(titre));
  if (!k) return null;
  return (DESSINS.has(k) || PLANCHES[k]) ? k : null;
};

const panneau = (d, i, classe = 'pi-p') =>
  `<svg viewBox="0 0 176 140" class="${classe}" aria-hidden="true">`
  + `<rect x="1.5" y="1.5" width="173" height="137" rx="12" class="pi-fond"/>`
  + d
  + `<g class="pi-num"><rect x="6" y="6" width="26" height="26" rx="7"/>`
  + `<text x="19" y="26">${i + 1}</text></g></svg>`;

/**
 * La bande sous un point de contrôle : tous les panneaux, dans l'ordre.
 *
 * CE QUE ÇA COÛTE VRAIMENT. Une bande de quatre panneaux pèse six kilo-octets
 * BRUTS, et c'est le chiffre qui a d'abord fait renoncer — à tort. Compressée,
 * la même bande en pèse deux cents : gzip écrase une structure qui se répète
 * d'un panneau à l'autre. Les sept bandes d'une page coûtent 770 octets de
 * plus que sept amorces. Raisonner sur le brut quand c'est le compressé qui
 * part sur le réseau, c'est se priver pour rien.
 *
 * Chaque panneau est un lien vers SON geste sur la page de la planche : on
 * clique le troisième, on arrive au troisième, en grand.
 */
// ── les planches dessinées ───────────────────────────────────────────────
//
// Quinze planches ont été dessinées d'après les vraies photos produit et vivent
// en WebP dans statique/planches/. Le SVG tracé à la main reste là : il sert de
// repli pour tout point qui n'a pas encore sa planche, et il ne coûte aucune
// requête. Une planche n'est prise pour dessinée que si ses QUATRE panneaux et
// leurs vignettes sont là — une série trouée se lit plus mal qu'un pictogramme.
const DOSSIER = require('node:path').join(__dirname, 'statique', 'planches');

const DESSINS = (() => {
  const fs = require('node:fs');
  const vus = new Set();
  let fichiers = [];
  try { fichiers = fs.readdirSync(DOSSIER); } catch { return vus; }
  const cles = new Set([...Object.keys(PLANCHES),
    ...fichiers.map(f => f.replace(/-\d(?:-mini)?\.webp$/, ''))]);
  for (const k of cles) {
    const complet = [1, 2, 3, 4].every(i =>
      fichiers.includes(`${k}-${i}.webp`) && fichiers.includes(`${k}-${i}-mini.webp`));
    if (complet) vus.add(k);
  }
  return vus;
})();

// Les images gardent leur nom d'une génération à l'autre : sans empreinte, un
// navigateur qui a déjà la planche garderait l'ancienne après une correction.
const VERSION_PL = (() => {
  const fs = require('node:fs');
  const h = require('node:crypto').createHash('sha256');
  for (const k of [...DESSINS].sort())
    for (let i = 1; i <= 4; i++) {
      const f = require('node:path').join(DOSSIER, `${k}-${i}.webp`);
      h.update(k + i + fs.statSync(f).size + fs.statSync(f).mtimeMs);
    }
  return h.digest('hex').slice(0, 8);
})();

const img = (k, i, mini) =>
  `<img class="${mini ? 'pi-i' : 'pi-ig'}" loading="lazy" decoding="async"`
  + ` width="${mini ? 320 : 1024}" height="${mini ? 320 : 1024}" alt=""`
  + ` src="/planches/${k}-${i}${mini ? '-mini' : ''}.webp?v=${VERSION_PL}">`;

function planche(titre, { href = null } = {}) {
  const k = cle(titre);
  if (!k) return '';
  const dessine = DESSINS.has(k);
  const p = PLANCHES[k] || (dessine ? [0, 1, 2, 3] : null);
  if (!p) return '';
  const corps = p.map((d, i) => {
    const vue = dessine ? img(k, i + 1, true) : panneau(d, i);
    return href
      ? `<a class="pi-l" href="${href}#p${i + 1}"
          aria-label="Agrandir l'étape ${i + 1} sur ${p.length}">${vue}</a>`
      : vue;
  }).join('');
  return `<div class="pi" role="img"
    aria-label="Procédure illustrée, ${p.length} étapes">${corps}</div>`;
}

/**
 * La planche en grand, un panneau par ligne — la page « bande dessinée ».
 *
 * Le panneau porte son ancre : arriver par `#p3` amène au troisième geste,
 * pas en haut de la page. C'est ce qui permet de cliquer une étape dans la
 * liste à cocher et de tomber dessus.
 */
function plancheBD(titre) {
  const k = cle(titre);
  if (!k) return '';
  const dessine = DESSINS.has(k);
  const p = PLANCHES[k] || (dessine ? [0, 1, 2, 3] : null);
  if (!p) return '';
  return `<ol class="bd">${p.map((d, i) => `<li class="bd-p" id="p${i + 1}">
    ${dessine ? img(k, i + 1, false) : panneau(d, i, 'pi-g')}</li>`).join('')}</ol>`;
}

module.exports = { DESSINS, VERSION_PL, PLANCHES, PAR_TITRE, RUPTURES, planche, plancheBD,
  cle, empreinte };
