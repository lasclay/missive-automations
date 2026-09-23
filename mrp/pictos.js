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

// -------------------------------------------------------------- les planches
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
  frottement_sec: [
    appareil(16, 40) + fleche('M68 74h24v-7l16 11-16 11v-7H68z') + piece(108, 52, 0.55),
    piece(10, 54, 0.95) + `<ellipse cx="72" cy="78" rx="20" ry="11" fill="none"
        stroke="${T.rouge}" stroke-width="2.6" stroke-dasharray="6 4"/>`
      + main(64, 6, 0, 1.0)
      + fleche('M36 124h84v-6l13 9-13 9v-6H36z') + fleche('M120 124H36v-6l-13 9 13 9v-6z'),
    chrono(62, 34, '3', 'min'),
  ],
  lavage: [
    bac(30, 52) + flocon(72, 66, 1.3) + goutte(44, 22, 1.3) + goutte(104, 26, 1.3),
    soleil(70, 10, 1.1) + piece(30, 62, 0.95) + table(16, 116),
  ],
  frottement_gel: [
    goutte(44, 20, 1.5) + goutte(78, 16, 1.5) + goutte(112, 22, 1.5) + piece(26, 62, 0.9),
    flocon(32, 44, 1.6) + chrono(96, 40, '2', 'h'),
    piece(10, 54, 0.95) + `<ellipse cx="72" cy="78" rx="20" ry="11" fill="none"
        stroke="${T.rouge}" stroke-width="2.6" stroke-dasharray="6 4"/>`
      + main(64, 6, 0, 1.0)
      + fleche('M36 124h84v-6l13 9-13 9v-6H36z') + fleche('M120 124H36v-6l-13 9 13 9v-6z'),
    chrono(62, 34, '3', 'min'),
  ],
  comparer: [
    piece(30, 56, 0.95) + table(16, 110),
    appareil(8, 50) + fleche('M58 76h16v-6l13 9-13 9v-6H58z') + piece(88, 58, 0.7)
      + loupe(118, 26, 0.9),
    oui(36, 52, 1.3) + non(102, 52, 1.3),
  ],
  etiquette: [
    piece(14, 34, 1.3) + etiquette(56, 86, 0) + oui(128, 96, 0.85),
    piece(14, 34, 1.3) + etiquette(56, 86, 180) + non(128, 96, 0.85),
    piece(14, 34, 1.3) + etiquetteDecousue(56, 86) + non(128, 96, 0.85),
  ],
  photo_boutique: [
    soleil(74, 6, 0.95) + telephone(22, 52) + loupe(70, 58, 0.8) + piece(96, 66, 0.6),
    oui(36, 52, 1.3) + non(102, 52, 1.3),
  ],
};

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
].map(([t, k]) => [empreinte(t), k]));

/** La clé de planche d'un titre, ou null. Null est le cas normal : la plupart
 *  des points n'ont pas de planche, et un dessin approximatif serait pire. */
const cle = (titre) => PAR_TITRE.get(empreinte(titre)) || null;

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
function planche(titre, { href = null } = {}) {
  const k = cle(titre);
  if (!k) return '';
  const p = PLANCHES[k];
  const corps = p.map((d, i) => href
    ? `<a class="pi-l" href="${href}#p${i + 1}"
        aria-label="Agrandir l'étape ${i + 1} sur ${p.length}">${panneau(d, i)}</a>`
    : panneau(d, i)).join('');
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
  const p = PLANCHES[k];
  return `<ol class="bd">${p.map((d, i) => `<li class="bd-p" id="p${i + 1}">
    ${panneau(d, i, 'pi-g')}</li>`).join('')}</ol>`;
}

module.exports = { PLANCHES, PAR_TITRE, planche, plancheBD, cle, empreinte };
