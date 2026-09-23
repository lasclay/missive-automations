/**
 * Les unités impériales, converties à l'AFFICHAGE.
 *
 * Les fournisseurs nord-américains écrivent la toile en onces par verge carrée
 * et les longueurs en pouces. L'atelier tunisien, lui, travaille en métrique.
 * Convertir à la saisie ferait perdre la trace de la source ; écrire les deux
 * partout alourdit chaque ligne d'une parenthèse qu'un des deux lecteurs
 * n'utilise jamais. On garde donc la source telle quelle et on convertit au
 * rendu, selon le réglage de la personne connectée.
 *
 * Trois modes : `metrique` (le défaut), `imperial` (la source, intacte),
 * `deux` (les deux, pour qui fait le pont entre un fournisseur et l'atelier).
 *
 * ATTENTION à l'once. Elle désigne deux choses sans le dire : une masse
 * (28,35 g) et une masse SURFACIQUE (once par verge carrée, 33,91 g/m²). Dans
 * tout le corpus Lasclay, « 12 oz » est toujours une toile — jamais un poids.
 * Si un jour une once de masse apparaît, cette règle la convertira faux.
 */
'use strict';

const MODES = { metrique: 'Métrique', imperial: 'Impérial', deux: 'Les deux' };
const MODE_DEFAUT = 'metrique';

// 1 oz/yd² = 28,349523125 g / 0,83612736 m²
const OZ_YD2_EN_GSM = 33.90574691;

const nb = (s) => Number(String(s).replace(',', '.'));
const fr = (n, dec) => n.toFixed(dec).replace('.', ',').replace(/,0+$/, '');

/**
 * L'ordre compte : `po²` doit être testé AVANT `po`, sinon « 300 fils/po² »
 * se fait convertir comme une longueur et sort en centimètres.
 */
const REGLES = [
  { re: /(\d+(?:[.,]\d+)?)\s*fils\/po²/gi,
    rendu: (v) => `${fr(v / 6.4516, 0)} fils/cm²` },
  { re: /(\d+(?:[.,]\d+)?)\s*oz\b/gi,
    rendu: (v) => `${fr(v * OZ_YD2_EN_GSM, 0)} g/m²` },
  { re: /(\d+(?:[.,]\d+)?)\s*(?:pouces?|po)\b/gi,
    rendu: (v) => `${fr(v * 2.54, 1)} cm` },
  { re: /(\d+(?:[.,]\d+)?)\s*pieds?\b/gi,
    rendu: (v) => `${fr(v * 30.48, 0)} cm` },
  { re: /(\d+(?:[.,]\d+)?)\s*verges?\b/gi,
    rendu: (v) => `${fr(v * 0.9144, 2)} m` },
];

/**
 * Convertit les mesures impériales d'un texte selon le mode.
 * Le texte revient inchangé s'il n'en contient aucune — c'est le cas le plus
 * fréquent, et il ne doit rien coûter.
 */
function convertir(texte, mode = MODE_DEFAUT) {
  const t = String(texte ?? '');
  if (mode === 'imperial' || !t) return t;
  let out = t;
  for (const { re, rendu } of REGLES) {
    out = out.replace(re, (tout, val) => {
      const v = nb(val);
      if (!Number.isFinite(v)) return tout;
      const m = rendu(v);
      return mode === 'deux' ? `${tout} (${m})` : m;
    });
  }
  return out;
}

/** Y a-t-il quelque chose à convertir ? Sert à n'afficher le réglage que là
 *  où il change quelque chose. */
const aDeLImperial = (texte) =>
  REGLES.some(({ re }) => { re.lastIndex = 0; return re.test(String(texte ?? '')); });

/**
 * Une cote structurée : la valeur et l'unité vivent dans deux colonnes.
 * « 1 » + « po » ne se convertit pas en passant le texte — il n'y a pas
 * d'unité dedans. On recompose, on convertit, on redécoupe.
 *
 * Une valeur composée (« 66,0 x 50,8 ») se convertit terme à terme : chaque
 * nombre porte la même unité.
 */
function convertirMesure(valeur, unite, mode = MODE_DEFAUT) {
  const v = String(valeur ?? '').trim();
  const u = String(unite ?? '').trim();
  if (mode === 'imperial' || !v || !u) return { valeur: v, unite: u };
  const converti = convertir(`${v} ${u}`, mode);
  if (converti === `${v} ${u}`) return { valeur: v, unite: u };
  // « 2,5 cm » → valeur « 2,5 », unité « cm ». Ce qui ne se sépare pas
  // proprement revient d'un bloc dans la valeur, plutôt que d'être tronqué.
  const m = converti.match(/^(.*?)\s*([a-zµ²\/]+)$/i);
  return m ? { valeur: m[1], unite: m[2] } : { valeur: converti, unite: '' };
}

module.exports = { convertir, convertirMesure, aDeLImperial,
                   MODES, MODE_DEFAUT, OZ_YD2_EN_GSM };
