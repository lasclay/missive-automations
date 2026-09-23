/**
 * Le distillat : d'un fil de correspondance, une rétroaction utilisable.
 *
 * CE QUI SORT D'ICI N'EST PAS UN FIL. README.md le pose : « Le MRP recevra le
 * distillat — un défaut, son produit, sa zone, la citation qui le décrit, la
 * photo qui le montre — pas le fil d'où il vient. » Aucun nom, aucune adresse,
 * aucun numéro de commande ne sort de ce fichier. `fils/` reste dans le dépôt
 * privé ; ce qui va dans le MRP est anonyme par construction.
 *
 *   node outils/distiller.js            → écrit le TSV et un rapport
 *   node outils/distiller.js --exemples <cle>   → lit les citations d'un problème
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { proseClient, notreVoix } = require('./deciter.js');
const { PRODUITS, AMBIGUS, PROBLEMES } = require('./lexique.js');

const ICI = __dirname;
const FILS = path.join(ICI, '..', 'fils');
const SORTIE = path.join(ICI, '..', '..', 'donnees', 'retroactions.tsv');

const sansAccent = (s) => String(s || '').normalize('NFD')
  .replace(/[̀-ͯ]/g, '').toLowerCase();

/** Tous les produits nommés dans un texte, sans doublon. */
function produitsNommes(t) {
  const vus = [];
  for (const [code, motifs] of PRODUITS)
    if (motifs.some(re => re.test(t)) && !vus.includes(code)) vus.push(code);
  return vus;
}

/** Le produit nommé dans le texte, ou la famille si c'est ambigu. */
function attribuer(t) {
  const v = produitsNommes(t);
  if (v.length) return { code: v[0], famille: null };
  for (const [re, fam] of AMBIGUS) if (re.test(t)) return { code: null, famille: fam };
  return { code: null, famille: null };
}

/**
 * À QUEL produit se rapporte CE défaut-là.
 *
 * Prendre le premier produit du fil donnait des attributions fausses et
 * crédibles : « une couture de mon manteau a cédé » rangé sous GLACIERE,
 * parce que le mot « glacière » traînait trente lignes plus loin. Un atelier
 * enverrait quelqu'un réparer le mauvais produit.
 *
 * La règle : le produit doit être nommé PRÈS du défaut. Si rien n'est nommé
 * autour, on n'accepte le fil entier que s'il ne parle que d'un seul produit —
 * là, il n'y a pas d'ambiguïté à trancher.
 */
const FENETRE = 500;

/** Toutes les mentions — produit précis ET famille — avec leur position. */
function mentions(t) {
  const out = [];
  for (const [code, motifs] of PRODUITS)
    for (const re of motifs) {
      const m = new RegExp(re.source, 'g'); let x;
      while ((x = m.exec(t))) out.push({ code, famille: null, i: x.index });
    }
  for (const [re, fam] of AMBIGUS) {
    const m = new RegExp(re.source, 'g'); let x;
    while ((x = m.exec(t))) out.push({ code: null, famille: fam, i: x.index });
  }
  return out;
}

function attribuerPres(t, i, tousDuFil, toutes) {
  // LA PLUS PROCHE gagne, produit précis et famille confondus. Ne regarder que
  // les produits précis rangeait « une couture de mon manteau a cédé » sous
  // GLACIERE : « manteau » est un terme de famille, donc invisible, et un mot
  // « glacière » trente lignes plus loin remportait l'attribution.
  let best = null;
  for (const m of toutes) {
    const d = Math.abs(m.i - i);
    if (d <= FENETRE && (!best || d < best.d)) best = { ...m, d };
  }
  if (best) return best.code
    ? { code: best.code, famille: null, sur: 'proximite' }
    : { code: null, famille: best.famille, sur: 'famille' };
  if (tousDuFil.length === 1) return { code: tousDuFil[0], famille: null, sur: 'fil' };
  if (tousDuFil.length > 1) return { code: null, famille: null, sur: 'ambigu' };
  for (const [re, fam] of AMBIGUS) if (re.test(t))
    return { code: null, famille: fam, sur: 'famille' };
  return { code: null, famille: null, sur: 'rien' };
}

/**
 * La phrase qui porte le défaut, pas le paragraphe.
 *
 * On rend le texte D'ORIGINE (accents, majuscules) : une citation qu'on
 * montre à l'atelier doit être lisible, pas normalisée. L'index vient du
 * texte sans accents, qui a la même longueur — c'est pour ça que `sansAccent`
 * ne fait que retirer des diacritiques, sans jamais changer le nombre de
 * caractères.
 */
function citation(origine, t, re) {
  const m = re.exec(t);
  if (!m) return '';
  const i = m.index;
  let d = i, f = i + m[0].length;
  while (d > 0 && !/[.!?\n]/.test(t[d - 1])) d--;
  while (f < t.length && !/[.!?\n]/.test(t[f])) f++;
  let c = origine.slice(d, Math.min(f + 1, origine.length)).trim();
  if (c.length > 320) {
    const g = Math.max(0, i - 140);
    c = (g > 0 ? '…' : '') + origine.slice(g, i + 180).trim() + '…';
  }
  return c.replace(/\s+/g, ' ');
}

function distiller() {
  const fichiers = fs.readdirSync(FILS).filter(f => f.endsWith('.json'));
  const lignes = [];
  const ecartes = { sansTexte: 0, sansProbleme: 0, sansProduit: 0 };
  const parFamille = {};

  for (const nom of fichiers) {
    const fil = JSON.parse(fs.readFileSync(path.join(FILS, nom), 'utf8'));
    const origine = proseClient(fil);
    if (!origine) { ecartes.sansTexte++; continue; }
    const t = sansAccent(origine);

    // Quels problèmes ce fil décrit-il ? Un fil peut en porter plusieurs.
    const trouves = [];
    for (const p of PROBLEMES) {
      if (p.sauf && p.sauf.some(re => re.test(t))) continue;
      const re = p.motifs.find(re => re.test(t));
      if (re) trouves.push({ p, re });
    }
    if (!trouves.length) { ecartes.sansProbleme++; continue; }

    const tousDuFil = produitsNommes(t);
    const toutesMentions = mentions(t);

    // « Pièce cassée (autre) » est un filet : si un problème précis a déjà
    // touché, le filet n'apporte rien et noierait le groupe utile.
    const precis = trouves.filter(x => x.p.cle !== 'casse-gen');
    const retenus = precis.length ? precis : trouves;

    let placee = false;
    for (const { p, re } of retenus) {
      re.lastIndex = 0;
      const m = re.exec(t);
      if (!m) continue;
      const c = citation(origine, t, re);
      if (!c || c.length < 25) continue;   // une citation trop courte n'apprend rien
      if (notreVoix(c)) continue;          // notre infolettre n'est pas une rétroaction

      const a = attribuerPres(t, m.index, tousDuFil, toutesMentions);
      if (!a.code && !a.famille) { continue; }

      lignes.push({
        produit: a.code || '', portee: a.code ? 'produit' : 'famille',
        cible: a.code || a.famille,
        probleme: p.cle, titre: p.titre, famille: p.famille,
        date: (fil.messages || []).find(m2 => !m2.us)?.date || '',
        citation: c,
        images: (fil.attachments || [])
          .filter(x => /image/.test(x.media_type || x.type || ''))
          .map(x => x.id).filter(Boolean).join(' '),
        fil: fil.id,
      });
      placee = true;
      if (a.famille) parFamille[a.famille] = (parFamille[a.famille] || 0) + 1;
    }
    if (!placee) ecartes.sansProduit++;
  }
  return { lignes, ecartes, parFamille, total: fichiers.length };
}

function ecrire(lignes) {
  const entete = ['cible','portee','probleme','titre','famille','date','citation','images','fil'];
  const corps = lignes.map(l => entete.map(k =>
    String(l[k] ?? '').replace(/[\t\n\r]/g, ' ')).join('\t'));
  fs.writeFileSync(SORTIE, `# Distillat des rétroactions clients — produit par outils/distiller.js
# ANONYME PAR CONSTRUCTION : aucun nom, adresse ou numéro de commande. La
# colonne « fil » est l'identifiant Missive, pour remonter à la source depuis
# le dépôt privé — elle n'est pas affichée dans le MRP.
${entete.join('\t')}
${corps.join('\n')}\n`);
}

if (require.main === module) {
  const { lignes, ecartes, parFamille, total } = distiller();
  if (process.argv[2] === '--exemples') {
    const cle = process.argv[3];
    for (const l of lignes.filter(x => !cle || x.probleme === cle).slice(0, 25))
      console.log(`[${l.cible}${l.portee === 'famille' ? ' ~famille' : ''}] ${l.citation}\n`);
    process.exit(0);
  }
  ecrire(lignes);
  const parProbleme = {};
  for (const l of lignes) parProbleme[l.titre] = (parProbleme[l.titre] || 0) + 1;
  const parProduit = {};
  for (const l of lignes) parProduit[l.cible] = (parProduit[l.cible] || 0) + 1;

  console.log(`\n  ${lignes.length} rétroactions distillées, sur ${total} fils lus.\n`);
  console.log('  Écartés :');
  console.log(`    ${ecartes.sansTexte} sans prose du client (tout était cité)`);
  console.log(`    ${ecartes.sansProbleme} sans problème identifiable — expédition, prix, remerciements`);
  console.log(`    ${ecartes.sansProduit} avec un problème mais SANS produit nommé`);
  if (Object.keys(parFamille).length) {
    console.log('      dont, nommant seulement une famille :');
    for (const [f, n] of Object.entries(parFamille).sort((a,b)=>b[1]-a[1]))
      console.log(`        ${String(n).padStart(4)} « ${f} »`);
  }
  console.log('\n  Par problème :');
  for (const [t, n] of Object.entries(parProbleme).sort((a,b)=>b[1]-a[1]))
    console.log(`    ${String(n).padStart(4)}  ${t}`);
  console.log('\n  Par produit :');
  for (const [p, n] of Object.entries(parProduit).sort((a,b)=>b[1]-a[1]))
    console.log(`    ${String(n).padStart(4)}  ${p}`);
  console.log(`\n  → ${path.relative(process.cwd(), SORTIE)}\n`);
}

module.exports = { distiller, attribuer, attribuerPres, produitsNommes, mentions, citation, sansAccent };
