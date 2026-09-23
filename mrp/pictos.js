/**
 * Les planches de contrôle — comment faire le geste, sans un mot.
 *
 * POURQUOI PAS DES IMAGES ENGENDRÉES. Ce qui fait qu'une notice IKEA se lit
 * en Tunisie comme au Québec, ce n'est pas le réalisme : c'est la CONTRAINTE.
 * Même trait, même main, mêmes flèches, le ✓ et le ✗ toujours au même endroit,
 * d'une planche à l'autre. Un générateur d'images donnerait cent cinquante
 * styles, cent cinquante mains, et des coutures qui ne veulent rien dire.
 * Et le MRP n'héberge rien : cent cinquante images matricielles, ce sont cent
 * cinquante requêtes sur la connexion tunisienne. Une planche vectorielle
 * pèse quatre cents octets compressés et prend la couleur du thème.
 *
 * LA GRAMMAIRE, qui vaut plus que les dessins eux-mêmes :
 *   — un panneau = un geste, numéroté, lu de gauche à droite ;
 *   — aucun texte, jamais. Les seuls signes écrits sont des CHIFFRES
 *     (3 minutes, 2 heures) et ils sont les mêmes dans les trois langues ;
 *   — une flèche dit le mouvement, jamais une légende ;
 *   — le ✓ et le ✗ ne qualifient pas le geste, ils qualifient le RÉSULTAT :
 *     c'est la seule façon de montrer une décision sans la raconter ;
 *   — le trait ne se remplit pas. Un aplat devient illisible en mode sombre.
 */

// ---------------------------------------------------------------- vocabulaire
// Tout est tracé dans une boîte de 100 × 78. Les pièces reviennent d'une
// planche à l'autre : c'est ce qui fait qu'on les reconnaît sans les apprendre.

/** Un morceau de tissu, vu à plat. Le bord ondule : c'est ce qui le distingue
 *  d'une boîte, et la seule liberté qu'on prend avec la ligne droite. */
const tissu = (x, y, l, h) =>
  `<path d="M${x} ${y + 4}q${l / 4} -5 ${l / 2} 0t${l / 2} 0v${h - 8}q-${l / 4} 5 -${l / 2} 0t-${l / 2} 0z"/>`;

/**
 * Une main. Trois doigts, pas cinq : à cette taille, cinq doigts font une
 * tache. Quatre variantes ont été dessinées et regardées à la taille réelle —
 * la mitaine et le pincement ne se lisaient pas, celle-ci se lit.
 */
const main = (x, y, r = 0, e = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${r}) scale(${e})">`
  + `<path d="M5 16V9a2.6 2.6 0 0 1 5.2 0v5M10.2 14V6a2.6 2.6 0 0 1 5.2 0v8`
  + `M15.4 14V8a2.6 2.6 0 0 1 5.2 0v14a8 8 0 0 1-8 8h-3a7 7 0 0 1-7-7v-7`
  + `a2.6 2.6 0 0 1 5.2 0v2"/></g>`;

/** Retourner la pièce : une flèche en U, à deux têtes. Elle dit « l'autre
 *  face » sans dire laquelle, ce qui est exactement le propos. */
const retourner = (x, y, e = 1) =>
  `<g transform="translate(${x} ${y}) scale(${e})">`
  + `<path d="M3 6v6a9 9 0 0 0 18 0V6M21 6l-4 4M21 6l4 4M3 6l-3 4M3 6l3 4"/></g>`;

/** Une flèche. Le seul mot du langage. */
const fleche = (x1, y1, x2, y2) => {
  const a = Math.atan2(y2 - y1, x2 - x1), t = 4.6;
  const p = (d) => `${(x2 - t * Math.cos(a - d)).toFixed(1)} ${(y2 - t * Math.sin(a - d)).toFixed(1)}`;
  return `<path d="M${x1} ${y1}L${x2} ${y2}"/><path d="M${p(0.45)}L${x2} ${y2}L${p(-0.45)}"/>`;
};

/** Un va-et-vient : deux flèches opposées sur la même ligne. */
const vaEtVient = (x, y, l) =>
  fleche(x + l * 0.35, y, x, y) + fleche(x + l * 0.65, y, x + l, y);

const ciseaux = (x, y) =>
  `<g transform="translate(${x} ${y})"><path d="M0 0l11 13M11 0L0 13"/>`
  + `<circle cx="1.5" cy="15.5" r="2.8"/><circle cx="9.5" cy="15.5" r="2.8"/></g>`;

const loupe = (x, y) =>
  `<g transform="translate(${x} ${y})"><circle cx="8" cy="8" r="7.5"/>`
  + `<path d="M13.5 13.5L19 19"/></g>`;

/** Un chronomètre. Le chiffre est le seul écrit toléré : il se lit pareil en
 *  français, en arabe et en anglais. */
const chrono = (x, y, n, u) =>
  `<g transform="translate(${x} ${y})"><circle cx="11" cy="12" r="10"/>`
  + `<path d="M7.5 0h7M11 2v-2"/>`
  + `<text x="11" y="16" class="pi-n">${n}</text>`
  + (u ? `<text x="11" y="32" class="pi-u">${u}</text>` : '') + `</g>`;

const soleil = (x, y) =>
  `<g transform="translate(${x} ${y})"><circle cx="9" cy="9" r="5"/>`
  + `<path d="M9 0v2.5M9 15.5V18M0 9h2.5M15.5 9H18M2.6 2.6l1.8 1.8M13.6 13.6l1.8 1.8`
  + `M15.4 2.6l-1.8 1.8M4.4 13.6l-1.8 1.8"/></g>`;

const flocon = (x, y, e = 1) =>
  `<g transform="translate(${x} ${y}) scale(${e})"><path d="M12 2v20M3.3 7l17.4 10`
  + `M3.3 17l17.4-10M9 5l3 3 3-3M9 19l3-3 3 3M4 11.5l.6 3.5 3.4.2`
  + `M20 12.5l-.6-3.5-3.4-.2M4 12.5l.6-3.5 3.4-.2M20 11.5l-.6 3.5-3.4.2"/></g>`;

const goutte = (x, y, e = 1) =>
  `<g transform="translate(${x} ${y}) scale(${e})"><path d="M5 0C5 0 0 6.2 0 9a5 5 0 0 0 10 0C10 6.2 5 0 5 0z"/></g>`;

/** Un appareil photo : la preuve AVANT. Sans elle, l'essai ne prouve rien. */
const appareil = (x, y) =>
  `<g transform="translate(${x} ${y})"><path d="M0 4h5l2.5-3h9L19 4h5v14H0z"/>`
  + `<circle cx="12" cy="11" r="4.5"/></g>`;

/** Un téléphone montrant la fiche en ligne. */
const telephone = (x, y) =>
  `<g transform="translate(${x} ${y})"><rect x="0" y="0" width="17" height="27" rx="3"/>`
  + `<path d="M6 3h5"/><path d="M3.5 8h10v11h-10z"/></g>`;

const oui = (x, y) =>
  `<g transform="translate(${x} ${y})" class="pi-oui"><circle cx="9" cy="9" r="8.5"/>`
  + `<path d="M4.8 9.3l3 3 5.5-6.4"/></g>`;
const non = (x, y) =>
  `<g transform="translate(${x} ${y})" class="pi-non"><circle cx="9" cy="9" r="8.5"/>`
  + `<path d="M5.5 5.5l7 7M12.5 5.5l-7 7"/></g>`;

/** Le numéro du panneau, posé en haut à gauche comme sur une notice. */
const numero = (n) =>
  `<g class="pi-num"><circle cx="11" cy="11" r="8.5"/>`
  + `<text x="11" y="15" class="pi-n">${n}</text></g>`;

// ------------------------------------------------------------------ planches
// Chaque entrée : une suite de panneaux. Un panneau = un geste.

const PLANCHES = {
  fils: [
    // Les DEUX faces : la flèche en U le dit, la loupe dit qu'on regarde.
    tissu(8, 26, 54, 28) + `<path d="M24 38l-8 -8M38 36l-7 -9M52 40l-6 -10"/>`
      + loupe(66, 20) + retourner(34, 60, 0.9),
    // Tirer doucement AVANT de couper.
    tissu(4, 30, 40, 26) + `<path d="M34 42l24 -6"/>` + main(90, 43, 168, 0.95)
      + fleche(52, 66, 84, 58),
    // Le fil vient : la couture n'était pas arrêtée. On recoud, on ne coupe pas.
    tissu(4, 28, 38, 24) + `<path d="M32 40l26 -5"/>` + main(88, 41, 168, 0.9)
      + non(66, 58),
    // Le fil résiste : c'est un vrai fil à couper.
    tissu(6, 30, 46, 26) + `<path d="M40 42l14 -4"/>` + ciseaux(58, 30)
      + oui(74, 54),
  ],
  frottement_sec: [
    appareil(12, 20) + fleche(42, 30, 62, 30) + tissu(62, 22, 30, 22),
    tissu(10, 30, 54, 28) + `<circle cx="37" cy="44" r="11" stroke-dasharray="3 3"/>`
      + main(26, 6, 0, 0.95) + vaEtVient(20, 70, 34),
    chrono(38, 24, '3', 'min'),
  ],
  lavage: [
    // Eau froide : le flocon DANS le bac, plus gros que le bac ne l'écrase.
    `<path d="M12 32h58v18a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8z"/>` + flocon(30, 34, 1.05)
      + goutte(20, 12, 0.95) + goutte(56, 14, 0.95),
    // Au soleil ET à plat : les deux dans le même panneau, sinon ils se
    // ressemblent trop pour être deux gestes.
    soleil(42, 4) + tissu(14, 34, 62, 24) + `<path d="M8 66h84M18 73h64"/>`,
  ],
  frottement_gel: [
    goutte(26, 12, 1.15) + goutte(44, 10, 1.15) + goutte(62, 14, 1.15)
      + tissu(14, 38, 60, 24),
    flocon(20, 22, 1.15) + chrono(58, 24, '2', 'h'),
    tissu(10, 30, 54, 28) + `<circle cx="37" cy="44" r="11" stroke-dasharray="3 3"/>`
      + main(26, 6, 0, 0.95) + vaEtVient(20, 70, 34),
    chrono(38, 24, '3', 'min'),
  ],
  comparer: [
    tissu(14, 26, 62, 24) + `<path d="M8 58h84M18 65h64"/>`,
    appareil(6, 26) + `<path d="M32 36h10"/>` + tissu(46, 28, 42, 24) + loupe(60, 4),
    oui(24, 30) + non(58, 30),
  ],
  etiquette: [
    // Prise dans la couture sur toute sa largeur, à l'endroit.
    tissu(8, 18, 78, 22) + `<path d="M8 30h78"/>`
      + `<rect x="30" y="42" width="30" height="16" rx="1.5"/>`
      + `<path d="M36 48h18M36 53h12"/>` + oui(68, 44),
    // À l'envers.
    tissu(8, 18, 78, 22) + `<path d="M8 30h78"/>`
      + `<g transform="translate(60 58) rotate(180)"><rect x="0" y="0" width="30" height="16" rx="1.5"/>`
      + `<path d="M6 6h18M6 11h12"/></g>` + non(68, 44),
    // Pas prise sur toute sa largeur : un coin pend.
    tissu(8, 18, 78, 22) + `<path d="M8 30h78"/>`
      + `<path d="M30 42h30v16l-30 -5z"/>` + non(68, 44),
  ],
  photo_boutique: [
    // Le soleil couvre les DEUX : c'est le propos, « à la même lumière ».
    soleil(42, 2) + telephone(10, 28) + loupe(32, 38) + tissu(50, 34, 40, 22),
    oui(24, 30) + non(58, 30),
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

/** La planche d'un point, ou rien. Rien est un cas normal : la plupart des
 *  points n'en ont pas encore, et un dessin approximatif serait pire. */
function planche(titre) {
  const k = PAR_TITRE.get(empreinte(titre));
  if (!k || !PLANCHES[k]) return '';
  return `<div class="pi" role="img" aria-label="Procédure illustrée, ${
    PLANCHES[k].length} étapes">${PLANCHES[k].map((p, i) =>
    `<svg viewBox="0 0 100 78" class="pi-p">${numero(i + 1)}${p}</svg>`).join('')}</div>`;
}

module.exports = { PLANCHES, PAR_TITRE, planche, empreinte };
