/**
 * Lasclay — MRP : lecture visuelle des variantes
 * ---------------------------------------------------------------------------
 * « 3 500 cache-cous » ne dit pas quoi couper. « 1 285 gris foncé, 1 078 noirs,
 * 473 rouges » le dit — et un carré de la vraie couleur le dit plus vite qu'un
 * mot.
 *
 * Ce module ne sait qu'une chose : reconnaître ce qu'une étiquette de variante
 * désigne. Un coloris reçoit sa pastille, une taille sa case, et l'ordre des
 * tailles suit celui du corps humain plutôt que l'alphabet — XS, S, M, L, XL
 * et non 2XL, L, M, S, XL.
 */
'use strict';

/** Sans accents ni casse : « Gris pâle », « GRIS PALE » et « gris pale » sont un. */
const plat = (t) => String(t || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().trim();

/**
 * Les coloris du catalogue, avec leur teinte d'affichage.
 *
 * Ce ne sont pas les couleurs exactes des tissus — personne n'a de nuancier
 * ici. Ce sont des repères : assez justes pour qu'on reconnaisse la pastille
 * d'un coup d'œil, et assumés comme approximatifs.
 */
const COULEURS = {
  'noir':        '#1c1f22',
  'gris fonce':  '#4a5158',
  'gris':        '#7c858d',
  'gris pale':   '#b9c0c6',
  'blanc':       '#f1f3f4',
  'beige':       '#d9c9a8',
  'casonnade':   '#a9784a',   // cassonade — le chiffrier écrit « Casonnade »
  'cassonade':   '#a9784a',
  'brun':        '#7a5233',
  'rouge':       '#b3322c',
  'rose':        '#d98aa4',
  'orange':      '#c76a2a',
  'jaune':       '#d9b23c',
  'vert':        '#2f6b46',
  'vert foret':  '#1f4d33',
  'bleu':        '#2f5d8f',
  'marine':      '#22334d',
  'violet':      '#6b4a9e',
};

/** L'ordre du corps, pas celui de l'alphabet. */
const ORDRE_TAILLE = ['xs','s','s/m','petit','small','m','m/l','moyen','standard',
                      'l','grand','large','king','xl','2xl','3xl'];

/** Une pointure : « 6F », « 8F/6H », « 11H ». */
const POINTURE = /^\d{1,2}\s*[fh](\s*\/\s*\d{1,2}\s*[fh])?/i;

/**
 * Ce que l'étiquette désigne : 'couleur', 'taille', 'pointure' ou 'autre'.
 * « autre » couvre ce qui n'est ni l'un ni l'autre — « 250g/m² (0 à -18°C) »
 * est une spécification thermique, pas une taille.
 */
function typeVariante(nom) {
  const p = plat(nom).replace(/\s+nouveau$/, '');
  if (COULEURS[p]) return 'couleur';
  if (POINTURE.test(p)) return 'pointure';
  if (ORDRE_TAILLE.includes(p)) return 'taille';
  return 'autre';
}

/** La teinte d'un coloris, ou null si ce n'en est pas un. */
function teinte(nom) {
  return COULEURS[plat(nom).replace(/\s+nouveau$/, '')] || null;
}

/**
 * Le rang d'une étiquette dans son axe, pour trier.
 * Les pointures se trient par leur premier nombre ; le reste garde l'ordre
 * du chiffrier, qui a sa propre logique qu'on n'a pas à deviner.
 */
function rangVariante(nom) {
  const p = plat(nom).replace(/\s+nouveau$/, '');
  const i = ORDRE_TAILLE.indexOf(p);
  if (i >= 0) return i;
  const m = p.match(/^(\d{1,2})/);
  if (m) return 100 + Number(m[1]);
  return 500;
}

/**
 * Une pastille de couleur assez sombre pour qu'on écrive dessus en blanc ?
 * Sert à ne pas poser du texte pâle sur du gris pâle.
 */
function estSombre(hex) {
  if (!hex) return false;
  const n = parseInt(hex.slice(1), 16);
  const [r, v, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // luminance perçue, approximation courante et suffisante ici
  return (0.299 * r + 0.587 * v + 0.114 * b) < 140;
}

module.exports = { typeVariante, teinte, rangVariante, estSombre,
                   COULEURS, ORDRE_TAILLE };
