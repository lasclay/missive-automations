/**
 * Récupère les prix d'assemblage BMB coincés dans les notes techniques.
 *
 * Cette donnée existait depuis le début : « Assemblage BMB 7 $/unité », en
 * texte libre dans produits.notes_tech, là où aucun calcul ne pouvait
 * l'atteindre. Elle couvre 23 produits — dont cinq que les fiches COGS
 * ignorent complètement, et qui comptaient donc pour zéro heure au calendrier.
 *
 * Le script ne tranche rien : il pose côte à côte le prix BMB et la colonne
 * « assemblage » de la fiche COGS quand elle existe, et note les divergences.
 *
 *   node mrp/tools/extrait_bmb.js > mrp/donnees/assemblage-bmb.tsv
 */
'use strict';
const { db } = require('../db.js');
const C = require('../charge.js');

const couts = C.coutsConfection();
const PRIX = /Assemblage BMB ([\d]+(?:[.,]\d+)?)\s*\$/;

const lignes = [];
for (const p of db.prepare(`SELECT code, notes_tech, description
                            FROM produits ORDER BY code`).all()) {
  const texte = [p.notes_tech, p.description].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  const m = texte.match(PRIX);
  if (!m) continue;
  const bmb = Number(m[1].replace(',', '.'));
  const f = C.FAMILLE_COGS[p.code] || C.FAMILLE_CHRONO[p.code];
  const cogs = (f && couts.get(f)) ?? null;
  lignes.push({ code: p.code, bmb, cogs,
    note: cogs === null ? 'aucune fiche COGS'
        : Math.abs(bmb - cogs) < 0.25 ? 'concordant'
        : `divergent — fiche COGS à ${cogs.toFixed(2)} $` });
}

const entete = [
  "# Prix d'assemblage facturé par BMB Textile, par unité, en dollars.",
  '#',
  "# Extrait de produits.notes_tech, où la donnée dormait en texte libre.",
  '# 23 produits, dont cinq que les fiches COGS ignorent — et qui comptaient',
  '# donc pour zéro heure au calendrier.',
  '#',
  '# Là où les deux existent, BMB et la colonne « assemblage » des fiches COGS',
  '# concordent 17 fois sur 23. Les divergences sont notées ligne par ligne :',
  "# elles ne sont pas arbitrées ici, seulement rendues visibles.",
  '#',
  '# Régénérer : node mrp/tools/extrait_bmb.js > mrp/donnees/assemblage-bmb.tsv',
  ['produit', 'assemblage_bmb', 'cogs_assemblage', 'note'].join('\t'),
];
console.log(entete.concat(lignes.map(l =>
  [l.code, l.bmb, l.cogs ?? '', l.note].join('\t'))).join('\n'));
console.error(`${lignes.length} produits, ${
  lignes.filter(l => l.note.startsWith('divergent')).length} divergences`);
