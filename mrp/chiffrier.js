/**
 * Lasclay — MRP : lecture du chiffrier COGS
 * ---------------------------------------------------------------------------
 * `donnees/nomenclatures.tsv` est la recopie d'un chiffrier tenu à la main.
 * Ses trois colonnes de calcul ne parlent pas la même langue :
 *
 *   cout_unite         « 12.50 »            un nombre, propre
 *   unite              « m (8,22 $/m²) »    DEUX prix dans une seule case
 *   consommation       « 2 pads (4,80 pads/m) »   une phrase
 *   cout_par_produit   « 1.81 »             un nombre, propre
 *
 * Le MRP a besoin d'un nombre : combien de mètres, de grammes, de pouces part
 * dans un produit. Ce module l'établit.
 *
 * LA RÈGLE : le coût est la source, la phrase est le témoin.
 *
 * On ne lit pas la consommation dans la phrase, on la DÉDUIT du coût —
 * consommation = cout_par_produit / prix effectif. C'est le seul chemin qui
 * garantit que l'inventaire et le coût de revient racontent la même histoire :
 * multiplier la consommation par le prix redonne exactement le chiffre que la
 * direction a validé. La phrase sert à deux choses, et deux seulement : dire
 * dans QUELLE unité on compte, et servir de contre-vérification.
 *
 * Quand les deux divergent de plus de 5 %, on garde le coût et on le signale.
 * Le chiffrier a raison sur l'argent — c'est lui qui a servi à fixer les prix
 * de vente ; c'est la phrase qui est suspecte, et c'est elle qu'il faut aller
 * corriger à la source.
 */
'use strict';

/** « 8,22 » ou « 8.22 » → 8.22 ; vide ou illisible → null. */
function nombre(t) {
  if (t === null || t === undefined) return null;
  const s = String(t).trim().replace(/\s| /g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Normalise les unités telles qu'écrites au chiffrier. */
const UNITE = new Map(Object.entries({
  'm': 'm', 'm²': 'm2', 'm2': 'm2', 'mètre': 'm', 'metre': 'm', 'mètres': 'm',
  'kg': 'kg', 'g': 'g', 'gr': 'g', 'gramme': 'g', 'grammes': 'g',
  'pied': 'pied', 'pieds': 'pied', 'pi': 'pied',
  'po': 'pouce', 'pouce': 'pouce', 'pouces': 'pouce',
  'verge': 'verge', 'verges': 'verge',
  'rouleau': 'rouleau', 'rouleaux': 'rouleau',
  'paire': 'paire', 'paires': 'paire',
  'unite': 'unite', 'unité': 'unite', 'unités': 'unite', 'unites': 'unite',
}));
const normUnite = (u) => UNITE.get(String(u || '').toLowerCase().trim()) || null;

/**
 * Les facteurs de conversion, vers une unité de référence par dimension.
 * Le chiffrier mélange les échelles dans une même ligne : un prix au kilo et
 * une consommation en grammes, un prix au mètre et une consommation en pouces.
 * Sans conversion, la contre-vérification crie au désaccord là où les deux
 * lectures disent exactement la même chose.
 */
const REFERENCE = {
  m: ['m', 1], pouce: ['m', 0.0254], pied: ['m', 0.3048], verge: ['m', 0.9144],
  kg: ['kg', 1], g: ['kg', 0.001],
  m2: ['m2', 1],
};

/** Convertit `v` de `de` vers `vers`, ou null si les deux ne se comparent pas. */
function convertir(v, de, vers) {
  if (v === null || !de || !vers) return null;
  if (de === vers) return v;
  const a = REFERENCE[de], b = REFERENCE[vers];
  if (!a || !b || a[0] !== b[0]) return null;
  return v * a[1] / b[1];
}

/**
 * La colonne `unite` porte parfois deux prix : « m (8,22 $/m²) » veut dire
 * 12,50 $ le mètre linéaire, ce qui fait 8,22 $ le mètre carré une fois la
 * laisse prise en compte. Les deux servent — le tissu s'achète au mètre et se
 * consomme au mètre carré.
 */
function prix(coutUniteBrut, uniteBrute) {
  const base = nombre(coutUniteBrut);
  const t = String(uniteBrute || '').trim();
  const par = t.match(/\(\s*([\d.,\s]+)\s*\$\s*\/\s*([^)\s]+)\s*\)/);
  const uniteBase = normUnite(t.replace(/\(.*\)/, '').trim()) || 'unite';
  const alt = par ? { prix: nombre(par[1]), unite: normUnite(par[2]) } : null;
  return {
    base: { prix: base, unite: uniteBase },
    alt: alt && alt.prix && alt.unite ? alt : null,
  };
}

/**
 * Ce que dit la phrase de consommation, quand elle dit quelque chose.
 * Trois formes se rencontrent :
 *
 *   « 0,22 m² »               une quantité directe
 *   « 2 pads (4,80 pads/m) »  N pièces à raison de M par unité → N / M
 *   « 19,20 bandeaux/m »      un rendement seul → 1 / M
 *
 * Retourne { valeur, unite } ou null. `unite` peut manquer quand la phrase ne
 * la porte pas (« 0,05 » pour un rouleau) : c'est l'appelant qui complète.
 */
function litConsommation(texte) {
  const t = String(texte || '').trim();
  if (!t || /^voir\b/i.test(t)) return null;

  // Un rendement dit combien de pièces sortent d'une unité de matière :
  // « 19,20 bandeaux/m », « 22 unités/largeur ». Il compte à l'envers — la
  // consommation est son inverse.
  //
  // Deux écritures, et les confondre coûte cher : « 27 pads/m » donne le
  // rendement seul (un pad par produit), tandis que « 2 pads (4,80 pads/m) »
  // annonce d'abord COMBIEN de pièces il en faut, le rendement venant entre
  // parenthèses. Lire le 27 comme un nombre de pièces rendrait 27/27 = 1 m.
  const entreParen = t.match(/\(\s*([\d.,]+)\s*[a-zà-ÿ]+\s*\/\s*(m²|m2|m|largeur|pad)\s*\)/i);
  const rend = entreParen
    || t.match(/^([\d.,]+)\s*(?:[a-zà-ÿ]+)\s*\/\s*(m²|m2|m|largeur|pad)\b/i);

  if (rend) {
    const parUnite = nombre(rend[1]);
    if (parUnite) {
      const tete = entreParen ? t.match(/^([\d.,]+)/) : null;
      const n = tete ? nombre(tete[1]) : 1;
      const u = /largeur|pad/i.test(rend[2]) ? 'm' : (normUnite(rend[2]) || 'm');
      return { valeur: n / parUnite, unite: u, forme: 'rendement' };
    }
  }

  // « 2 par pad », « 1 par pad » : un compte de pièces dont l'unité de matière
  // n'est pas donnée. Le nombre est réel, l'unité manque — on le dit plutôt
  // que de supposer des mètres.
  const parPiece = t.match(/^([\d.,]+)\s*par\s+/i);
  if (parPiece) return { valeur: nombre(parPiece[1]), unite: null, forme: 'par_piece' };

  // quantité directe : « 0,22 m² », « 36,6 g/paire », « 2 x 1 po », « 45 po »
  const mult = t.match(/^([\d.,]+)\s*x\s*([\d.,]+)\s*([a-zà-ÿ²]+)/i);
  if (mult) {
    const a = nombre(mult[1]), b = nombre(mult[2]), u = normUnite(mult[3]);
    if (a && b) return { valeur: a * b, unite: u, forme: 'produit' };
  }

  const direct = t.match(/^([\d.,]+)\s*([a-zà-ÿ²]*)/i);
  if (direct) {
    const v = nombre(direct[1]);
    if (v !== null) return { valeur: v, unite: normUnite(direct[2]), forme: 'directe' };
  }
  return null;
}

/**
 * Établit la consommation d'une ligne de nomenclature.
 *
 * Retourne :
 *   consommation  nombre dans l'unité retenue, ou null si indéterminable
 *   unite         l'unité de la matière (celle dans laquelle on comptera le stock)
 *   source        'chiffrier'   déduite du coût, et la phrase est d'accord
 *                 'deduit'      déduite du coût, la phrase ne dit rien d'utile
 *                 'a_confirmer' déduite du coût, la phrase dit autre chose
 *                 null          ni coût ni phrase exploitables
 *   ecart         écart relatif entre les deux lectures, quand les deux existent
 */
function consommationDe(ligne) {
  const p = prix(ligne.cout_unite, ligne.unite);
  const dit = litConsommation(ligne.consommation);
  const cout = nombre(ligne.cout_par_produit);

  // L'unité de comptage est celle d'un PRIX, jamais celle de la phrase seule :
  // on comptera le stock dans l'unité où la matière s'achète. Si la phrase
  // parle en m² et qu'un prix au m² existe, c'est celui-là ; sinon le prix de
  // base, et c'est la phrase qu'on convertira pour la comparaison.
  const versAlt = Boolean(dit && p.alt && dit.unite === p.alt.unite);
  const tarif = versAlt ? p.alt : p.base;
  const unite = tarif.unite;

  if (!tarif.prix || cout === null) {
    // Pas de prix unitaire : ligne de coût agrégée (« Tissus & autres »), ou
    // colonne vide. Rien à mettre en tablette, mais le coût reste bon.
    return { consommation: dit ? dit.valeur : null, unite,
             prix_unitaire: tarif.prix ?? null,
             source: dit ? 'saisi' : null, ecart: null,
             suivi_stock: Boolean(tarif.prix) };
  }

  const deduit = cout / tarif.prix;
  const base = { consommation: deduit, unite, suivi_stock: true,
                 prix_unitaire: tarif.prix };
  if (!dit || dit.valeur === null || dit.unite === null)
    return { ...base, source: 'deduit', ecart: null };

  // La phrase et le prix comptent-ils dans la même dimension ? « 51,25 g »
  // contre un prix au kilo, « 45 po » contre un prix au mètre : même quantité,
  // échelle différente.
  const ditIci = convertir(dit.valeur, dit.unite, unite);
  if (ditIci === null) return { ...base, source: 'deduit', ecart: null };

  /*
   * La tolérance n'est pas un pourcentage fixe : elle dépend de ce que le
   * chiffrier a arrondi. Un coût noté « 0,01 $ » porte ±0,005 $ d'incertitude,
   * soit ±50 % — deux lectures qui divergent de 30 % y sont parfaitement
   * d'accord. Le même écart sur un coût de 5,38 $ est un vrai désaccord.
   * On additionne les deux arrondis, coût et prix unitaire, avec un plancher
   * de 5 % pour le bruit qui reste.
   */
  const tolerance = Math.max(0.05, 0.005 / Math.abs(cout)
                                 + 0.005 / Math.abs(tarif.prix));
  const ecart = Math.abs(deduit - ditIci) / Math.max(ditIci, 1e-9);

  return { ...base, ecart, dit: ditIci, dit_unite: dit.unite, tolerance,
           source: ecart <= tolerance ? 'chiffrier' : 'a_confirmer' };
}

module.exports = { nombre, normUnite, convertir, prix,
                   litConsommation, consommationDe };
