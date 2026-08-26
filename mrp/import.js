#!/usr/bin/env node
/**
 * import.js — charge les données réelles dans la base du MRP.
 *
 *   node import.js            aperçu : ce qui serait fait, sans rien écrire
 *   node import.js --ecrire   applique
 *   node import.js --ecrire --vider   repart des produits à zéro
 *
 * Ce que ça fait :
 *   donnees/correspondances.tsv  → la liste des produits de production
 *   donnees/shopify-produits.tsv → nom, description, lien boutique
 *   donnees/shopify-images.tsv   → photos (URL seulement, rien d'hébergé)
 *   donnees/nomenclatures.tsv    → matières, nomenclature calculable, coût
 *   donnees/cogs-tunisie.tsv     → prix, coût, marge, en note technique
 *   donnees/production-tunisie.md → consignes d'atelier, en note technique
 *   donnees/plan-production-2627.tsv → l'ordre de production de la saison
 *
 * L'ordre de production vient du plan 26-27 : un item par produit planifié,
 * à l'avancement 0. Les avancements réels se saisissent dans l'app, jamais ici
 * — un import ne doit pas écraser ce que l'atelier a déclaré.
 *
 * L'import est IDEMPOTENT : relancé, il met à jour au lieu de dupliquer. Le
 * pivot est le code produit de correspondances.tsv, pas le nom.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { db, uniteAffichee } = require('./db.js');
const chiffrier = require('./chiffrier.js');

const DOSSIER = path.join(__dirname, 'donnees');
const ECRIRE = process.argv.includes('--ecrire');
const VIDER = process.argv.includes('--vider');

const dire = (...a) => console.log(...a);

/** Lit un TSV en objets, en-tête sur la première ligne. */
function tsv(nom) {
  // Les lignes « # » portent la provenance d'un fichier tenu à la main ; elles
  // se lisent avant l'en-tête et ne doivent pas être prises pour des données.
  const brut = fs.readFileSync(path.join(DOSSIER, nom), 'utf8').trim().split('\n')
    .filter(l => !l.startsWith('#'));
  const cols = brut[0].split('\t');
  return brut.slice(1).map(l => {
    const c = l.split('\t');
    return Object.fromEntries(cols.map((k, i) => [k, (c[i] ?? '').trim()]));
  });
}

/** Un peu de HTML de description Shopify → texte lisible. */
function texte(html, max = 600) {
  let t = String(html || '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#39;|&rsquo;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  if (t.length > max) t = t.slice(0, max).replace(/\s\S*$/, '') + '…';
  return t;
}

// ------------------------------------------------------------------ sources
const corresp = tsv('correspondances.tsv').filter(r => r.code);
const shopify = new Map(tsv('shopify-produits.tsv').map(r => [r.handle, r]));
const cogs = new Map(tsv('cogs-tunisie.tsv').map(r => [r.produit, r]));

/**
 * Le plan de production de la saison, indexé par son libellé exact.
 * `plan-production-2627.tsv` est la recopie fidèle du chiffrier — on ne l'édite
 * pas, sinon l'extrait ne se compare plus à sa source. Les quantités décidées
 * verbalement après coup vivent dans `ajouts-production.tsv` et se superposent
 * ici, chacune avec son origine.
 */
const plan = new Map([...tsv('plan-production-2627.tsv'), ...tsv('ajouts-production.tsv')]
  .filter(r => Number(r.quantite_prevue) > 0)
  .map(r => [r.produit, r]));
const variantesPlan = new Map();
for (const r of tsv('plan-variantes-2627.tsv')) {
  if (!variantesPlan.has(r.produit)) variantesPlan.set(r.produit, []);
  variantesPlan.get(r.produit).push(r);
}

const imagesParHandle = new Map();
for (const r of tsv('shopify-images.tsv')) {
  if (!imagesParHandle.has(r.handle)) imagesParHandle.set(r.handle, []);
  imagesParHandle.get(r.handle).push(r);
}

const bomParProduit = new Map();
for (const r of tsv('nomenclatures.tsv')) {
  if (!bomParProduit.has(r.produit)) bomParProduit.set(r.produit, []);
  bomParProduit.get(r.produit).push(r);
}

/* --------------------------------------------------------------- matières
 * Le chiffrier liste les matières PAR PRODUIT : « Vegeto 150gsm » revient sur
 * cinq lignes, une par produit qui en consomme. L'inventaire, lui, en veut une
 * seule — c'est un rouleau, pas cinq.
 *
 * On regroupe donc par nom, et on choisit le prix et l'unité les plus fréquents
 * du groupe. Quand le groupe n'est pas d'accord avec lui-même — « Marilite
 * bleu » est à 3,60 $ sur la besace et à 6,00 $ sur le tote bag — on garde le
 * plus fréquent ET on l'écrit dans la note. Trancher en silence ferait
 * disparaître une question qui appartient au chiffrier, pas au MRP.
 */
const CODES_PRIS = new Set();

/** « Vegeto 150gsm » → « VEGETO-150GSM », unique dans la base. */
function codeMatiere(nom) {
  let base = String(nom).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28)
    || 'MATIERE';
  let c = base, n = 2;
  while (CODES_PRIS.has(c)) c = `${base}-${n++}`;
  CODES_PRIS.add(c);
  return c;
}

/** La valeur la plus fréquente d'une liste ; à égalité, la première vue. */
function dominante(valeurs) {
  const n = new Map();
  for (const v of valeurs) n.set(v, (n.get(v) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

const matieres = new Map();     // clé normalisée → fiche matière
const cleMatiere = (nom) => String(nom).toLowerCase().replace(/\s+/g, ' ').trim();

for (const r of tsv('nomenclatures.tsv')) {
  if (!r.materiau) continue;
  const cle = cleMatiere(r.materiau);
  if (!matieres.has(cle))
    matieres.set(cle, { nom: r.materiau.trim(), lignes: [] });
  matieres.get(cle).lignes.push(r);
}

for (const m of matieres.values()) {
  const lus = m.lignes.map(r => ({ r, c: chiffrier.consommationDe(r) }));

  // Le prix et l'unité forment une PAIRE indissociable : le chiffrier donne
  // « m (8,22 $/m²) » — 12,50 $ le mètre linéaire, 8,22 $ le mètre carré. Les
  // choisir séparément afficherait 12,50 $/m², un prix qui n'existe nulle part.
  const paires = lus.filter(x => x.c.prix_unitaire)
                    .map(x => `${x.c.prix_unitaire}|${x.c.unite}`);
  const retenue = dominante(paires);

  m.code = codeMatiere(m.nom);
  m.categorie = dominante(m.lignes.map(r => r.categorie)) || 'autre';
  m.unite = retenue ? retenue.split('|')[1] : (dominante(lus.map(x => x.c.unite).filter(Boolean)) || 'unite');
  m.cout_unite = retenue ? Number(retenue.split('|')[0]) : null;
  const prix = [...new Set(paires)];
  m.description = m.lignes.map(r => r.description).find(Boolean) || '';
  // Une ligne de coût agrégée n'a pas de tablette : « Tissus & autres 3,23 $ »
  // recouvre une dizaine d'articles. Elle compte au coût, pas à l'inventaire.
  m.suivi_stock = lus.some(x => x.c.suivi_stock) ? 1 : 0;

  const notes = [];
  if (prix.length > 1)
    notes.push(`Le chiffrier lui donne ${prix.length} tarifs différents selon le `
      + `produit (${prix.map(p => {
            const [v, u] = p.split('|');
            return `${Number(v).toFixed(2)} $/${u === 'm2' ? 'm²' : u}`;
          }).join(', ')}) ; retenu : `
      + `${Number(m.cout_unite).toFixed(2)} $/${m.unite === 'm2' ? 'm²' : m.unite}. `
      + `À trancher au chiffrier — le stock et le coût de revient en dépendent.`);
  if (!m.suivi_stock)
    notes.push('Ligne de coût agrégée du chiffrier, pas un article en tablette : '
      + 'elle compte dans le coût de revient et pas dans l\'inventaire.');
  m.note = notes.join(' ');
}

/** Les consignes d'atelier, une par produit, tirées du markdown de suivi. */
const consignes = (() => {
  const m = new Map();
  const md = fs.readFileSync(path.join(DOSSIER, 'production-tunisie.md'), 'utf8');
  for (const l of md.split('\n')) {
    const c = l.match(/^\|\s*\*\*(.+?)\*\*(.*?)\|(.*?)\|(.*?)\|\s*$/);
    if (!c) continue;
    const nom = (c[1] + c[2]).replace(/\*\*/g, '').trim();
    const aFaire = c[4].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                       .replace(/\*\*/g, '').trim();
    if (nom && aFaire) m.set(nom.toLowerCase(), aFaire);
  }
  return m;
})();

/** Rapproche un produit de production d'une ligne de consignes. */
function consignePour(nomProduction) {
  const n = nomProduction.toLowerCase();
  for (const [cle, val] of consignes)
    if (n.startsWith(cle) || cle.startsWith(n)) return val;
  return '';
}

// -------------------------------------------------------------- composition
const NOTE_COUT = (c) => {
  if (!c) return '';
  const l = [];
  if (c.prix_vente && c.cout_produit)
    l.push(`Coût de production ${c.cout_produit} $ pour un prix de vente `
         + `${c.prix_vente} $ (marge brute ${c.marge_brute || '—'}).`);
  const d = [];
  if (c.tissus_autres) d.push(`tissus ${c.tissus_autres} $`);
  if (c.isolant) d.push(`isolant ${c.isolant} $`);
  if (c.assemblage) d.push(`assemblage ${c.assemblage} $`);
  if (c.douanes) d.push(`douanes ${c.douanes} $`);
  if (c.logistique) d.push(`logistique ${c.logistique} $`);
  if (d.length) l.push('Décomposition : ' + d.join(', ') + '.');
  l.push(`Saison de référence ${c.saison || '—'}.`);
  return l.join(' ');
};

const lignes = corresp.map(r => {
  const sh = r.handle_shopify ? shopify.get(r.handle_shopify) : null;
  const c = cogs.get(r.produit_production);
  const bom = bomParProduit.get(r.produit_production) || [];
  const photos = (r.handle_shopify && imagesParHandle.get(r.handle_shopify) || [])
    .slice(0, 6);

  const notes = [];
  const cons = consignePour(r.produit_production);
  if (cons) notes.push(cons);
  const nc = NOTE_COUT(c);
  if (nc) notes.push(nc);
  if (r.confiance !== 'sûr' && r.note)
    notes.push(`À clarifier (${r.confiance}) : ${r.note}`);

  const pl = r.alias_plan ? plan.get(r.alias_plan) : null;
  if (pl) {
    const v = variantesPlan.get(r.alias_plan) || [];
    notes.push(`Plan 26-27 : ${Number(pl.quantite_prevue).toLocaleString('fr-CA')} `
      + `unités prévues${Number(pl.prevente_2026) > 0
          ? `, dont ${pl.prevente_2026} déjà en prévente` : ''}`
      + `${pl.cout_unitaire_bmb ? `. Assemblage BMB ${pl.cout_unitaire_bmb} $/unité` : ''}`
      + (v.length ? `. Répartition : ${v.map(x => `${x.variante} ${x.quantite}`).join(', ')}` : '')
      + '.');
  }

  return {
    code: r.code,
    // Le titre Shopify l'emporte, sauf quand la fiche n'est empruntée que pour
    // les photos : deux tailles enfant rattachées au handle adulte prendraient
    // toutes les deux le nom de l'adulte, indistinguables dans la liste.
    nom: sh && r.confiance !== 'non vendu' ? sh.titre : r.produit_production,
    description: sh ? texte(sh.description_html || '') : '',
    usage: sh?.url_boutique ? `Fiche publique : ${sh.url_boutique}` : '',
    notes_tech: notes.join('\n\n'),
    famille: r.famille || 'autre',
    fabrication: r.fabrication || 'tunisie',
    actif: r.confiance === 'non vendu' || r.confiance === 'non produit' ? 0 : 1,
    photos, bom, plan: pl || null,
    _sh: Boolean(sh), _cogs: Boolean(c), _confiance: r.confiance,
  };
});

// ------------------------------------------------------------------ rapport
dire(`\nImport des données réelles ${ECRIRE ? '' : '(APERÇU — rien n\'est écrit)'}\n`);
dire(`  ${lignes.length} produits de production dans correspondances.tsv`);
dire(`  ${lignes.filter(l => l._sh).length} rattachés à une fiche Shopify`);
dire(`  ${lignes.filter(l => l._cogs).length} avec une fiche COGS`);
dire(`  ${lignes.reduce((n, l) => n + l.photos.length, 0)} photos (URL seulement)`);
dire(`  ${lignes.reduce((n, l) => n + l.bom.length, 0)} lignes de nomenclature`);
const auPlan = lignes.filter(l => l.plan);
dire(`  ${auPlan.length} au plan de production 26-27, `
   + `${auPlan.reduce((n, l) => n + Number(l.plan.quantite_prevue), 0).toLocaleString('fr-CA')} `
   + `unités\n`);
const orphelins = [...plan.keys()].filter(k => !corresp.some(c => c.alias_plan === k));
if (orphelins.length) {
  dire(`  ${orphelins.length} lignes du plan sans code MRP — elles ne seront PAS produites :`);
  for (const o of orphelins) dire(`    · ${o}`);
  dire('');
}

const parConfiance = {};
for (const l of lignes) parConfiance[l._confiance] = (parConfiance[l._confiance] || 0) + 1;
dire('  Fiabilité du rattachement Shopify :');
for (const [k, v] of Object.entries(parConfiance).sort((a, b) => b[1] - a[1]))
  dire(`    ${String(v).padStart(3)}  ${k}`);

// ------------------------------------------------------ rapport : matières
{
  const lus = [...matieres.values()].flatMap(m =>
    m.lignes.map(r => ({ m, r, c: chiffrier.consommationDe(r) })));
  const par = {};
  for (const x of lus) par[x.c.source || 'indéterminée'] =
    (par[x.c.source || 'indéterminée'] || 0) + 1;

  dire(`\n  Matières : ${matieres.size} distinctes pour ${lus.length} lignes de `
     + `nomenclature.`);
  dire('  Consommation par unité produite :');
  const QUOI = {
    chiffrier: 'déduite du coût, la phrase du chiffrier confirme',
    deduit: 'déduite du coût, la phrase ne dit rien de comparable',
    a_confirmer: 'déduite du coût, la phrase dit AUTRE CHOSE',
    saisi: 'lue dans la phrase, aucun prix unitaire pour la vérifier',
    'indéterminée': 'ni coût ni phrase exploitables',
  };
  for (const [k, v] of Object.entries(par).sort((a, b) => b[1] - a[1]))
    dire(`    ${String(v).padStart(3)}  ${QUOI[k] || k}`);

  // Ce qui ne concorde pas mérite d'être nommé ligne par ligne : c'est le
  // chiffrier qu'il faut aller corriger, et sans la liste personne n'ira.
  const ecarts = lus.filter(x => x.c.source === 'a_confirmer');
  if (ecarts.length) {
    dire(`\n  ${ecarts.length} lignes où le coût et la phrase ne disent pas la `
       + `même chose.\n  Le coût fait foi — c'est lui qui a servi à fixer les prix `
       + `de vente. La phrase est à corriger au chiffrier :`);
    for (const x of ecarts)
      dire(`    ${x.r.produit.slice(0, 22).padEnd(24)}${x.m.nom.slice(0, 26).padEnd(28)}`
         + `coût → ${x.c.consommation.toFixed(4)} ${x.c.unite}`.padEnd(26)
         + `texte → « ${x.r.consommation} »`);
  }

  const sansStock = [...matieres.values()].filter(m => !m.suivi_stock);
  if (sansStock.length)
    dire(`\n  ${sansStock.length} lignes de coût agrégées, hors inventaire : `
       + sansStock.map(m => m.nom).join(', ') + '.');
}

if (!ECRIRE) {
  dire('\n  Aperçu des dix premiers :');
  for (const l of lignes.slice(0, 10))
    dire(`    ${l.code.padEnd(16)} ${l.nom.slice(0, 42).padEnd(44)}`
       + `${l.photos.length} photo(s)  ${l.bom.length} matériau(x)`);
  dire('\n  Aperçu de dix matières :');
  for (const m of [...matieres.values()].slice(0, 10))
    dire(`    ${m.code.padEnd(26)} ${m.nom.slice(0, 26).padEnd(28)}`
       + `${m.cout_unite === null ? '   —   ' : (m.cout_unite.toFixed(2) + ' $').padStart(8)}`
       + ` / ${uniteAffichee(m.unite).padEnd(7)} ${m.suivi_stock ? '' : '(hors inventaire)'}`);
  dire('\n  Relancer avec --ecrire pour appliquer.\n');
  process.exit(0);
}

// ------------------------------------------------------------------ écriture
const nettoie = (s) => String(s || '').trim();

db.exec('BEGIN');
try {
  if (VIDER) {
    // Les ordres référencent les produits : on refuse de vider si des ordres
    // existent, plutôt que de casser des références en silence.
    const n = db.prepare(`SELECT COUNT(*) n FROM ordre_items`).get().n;
    if (n) throw new Error(
      `--vider refusé : ${n} items d'ordres référencent des produits. `
      + `Supprime les ordres d'abord, ou relance sans --vider.`);
    db.exec(`DELETE FROM produits`);
    dire('\n  Produits vidés.');
  }

  const trouve = db.prepare(`SELECT id FROM produits WHERE code = ?`);
  const insere = db.prepare(`INSERT INTO produits
      (code, nom, description, usage, notes_tech, actif, famille, fabrication)
      VALUES (?,?,?,?,?,?,?,?)`);
  const maj = db.prepare(`UPDATE produits SET nom=?, description=?, usage=?,
      notes_tech=?, actif=?, famille=?, fabrication=?,
      maj_le=datetime('now') WHERE id=?`);
  const videPhotos = db.prepare(`DELETE FROM produit_photos WHERE produit_id=?`);
  const videMat = db.prepare(`DELETE FROM produit_materiaux WHERE produit_id=?`);
  const posePhoto = db.prepare(`INSERT INTO produit_photos
      (produit_id, url, type, legende, rang) VALUES (?,?,?,?,?)`);
  const poseMat = db.prepare(`INSERT INTO produit_materiaux
      (produit_id, nom, detail, rang) VALUES (?,?,?,?)`);

  let cree = 0, misAJour = 0, photos = 0, mats = 0;

  for (const l of lignes) {
    const ex = trouve.get(l.code);
    let id;
    if (ex) {
      maj.run(l.nom, l.description, l.usage, l.notes_tech, l.actif, l.famille,
              l.fabrication, ex.id);
      id = ex.id; misAJour++;
    } else {
      id = insere.run(l.code, l.nom, l.description, l.usage,
                      l.notes_tech, l.actif, l.famille, l.fabrication).lastInsertRowid;
      cree++;
    }
    // Photos et matériaux se remplacent en bloc : ils viennent entièrement des
    // fichiers, aucune saisie manuelle n'est à préserver.
    videPhotos.run(id); videMat.run(id);
    l.photos.forEach((p, i) => {
      posePhoto.run(id, p.url, i === 0 ? 'studio' : 'contexte',
                    nettoie(p.texte_alternatif).slice(0, 300), i + 1);
      photos++;
    });
    l.bom.forEach((m, i) => {
      const det = [m.description, m.consommation && `consommation ${m.consommation}`,
                   m.cout_par_produit && `${m.cout_par_produit} $/unité`]
        .filter(Boolean).join(' · ');
      poseMat.run(id, m.materiau, det, i + 1);
      mats++;
    });
  }

  db.exec('COMMIT');
  dire(`\n  ${cree} produits créés, ${misAJour} mis à jour`);
  dire(`  ${photos} photos, ${mats} matériaux\n`);
} catch (e) {
  db.exec('ROLLBACK');
  console.error(`\n  Échec, rien n'a été écrit : ${e.message}\n`);
  process.exit(1);
}

// --------------------------------------------- matières et nomenclature
// Les matières s'écrivent APRÈS les produits : la nomenclature a besoin des
// deux identifiants.
//
// Ce que l'import possède : le nom, la catégorie, l'unité, le prix, la
// consommation. Ce qu'il ne touche JAMAIS : le seuil d'alerte, l'emplacement,
// le fournisseur, le nom arabe, le délai. Ces champs-là n'existent dans aucun
// fichier — ils se saisissent dans l'app, et un import qui les écraserait
// ferait perdre le seul travail que la machine ne peut pas refaire.
db.exec('BEGIN');
try {
  const idProduit = new Map(
    db.prepare(`SELECT id, code FROM produits`).all().map(p => [p.code, p.id]));
  const dejaLa = new Map(
    db.prepare(`SELECT id, code FROM matieres`).all().map(m => [m.code, m.id]));

  const insMat = db.prepare(`INSERT INTO matieres
      (code, nom, categorie, description, unite, cout_unite, suivi_stock, note)
      VALUES (?,?,?,?,?,?,?,?)`);
  const majMat = db.prepare(`UPDATE matieres SET nom=?, categorie=?, description=?,
      unite=?, cout_unite=?, suivi_stock=?, note=?, maj_le=datetime('now')
      WHERE id=?`);

  let matCrees = 0, matMaj = 0;
  const idMatiere = new Map();          // clé normalisée → id
  for (const [cle, m] of matieres) {
    const ex = dejaLa.get(m.code);
    if (ex) {
      majMat.run(m.nom, m.categorie, m.description, m.unite, m.cout_unite,
                 m.suivi_stock, m.note, ex);
      idMatiere.set(cle, ex); matMaj++;
    } else {
      idMatiere.set(cle, insMat.run(m.code, m.nom, m.categorie, m.description,
        m.unite, m.cout_unite, m.suivi_stock, m.note).lastInsertRowid);
      matCrees++;
    }
  }

  const insNom = db.prepare(`INSERT INTO nomenclature
      (produit_id, matiere_id, consommation, consommation_texte,
       cout_par_produit, source, rang) VALUES (?,?,?,?,?,?,?)`);
  const majNom = db.prepare(`UPDATE nomenclature SET consommation=?,
      consommation_texte=?, cout_par_produit=?, source=?, rang=?
      WHERE produit_id=? AND matiere_id=?`);
  const nomExistante = db.prepare(`SELECT id, source FROM nomenclature
      WHERE produit_id=? AND matiere_id=?`);
  const nomDuProduit = db.prepare(`SELECT matiere_id FROM nomenclature
      WHERE produit_id=?`);
  const supNom = db.prepare(`DELETE FROM nomenclature
      WHERE produit_id=? AND matiere_id=?`);

  let nCrees = 0, nMaj = 0, nGardees = 0, nRetirees = 0;
  for (const l of lignes) {
    const pid = idProduit.get(l.code);
    if (pid === undefined) continue;

    // Une matière qui reviendrait deux fois dans le même produit se cumule :
    // deux lignes de Vegeto sur un manteau, c'est une quantité, pas un conflit.
    const parMatiere = new Map();
    l.bom.forEach((r, i) => {
      const mid = idMatiere.get(cleMatiere(r.materiau));
      if (mid === undefined) return;
      const c = chiffrier.consommationDe(r);
      const cout = chiffrier.nombre(r.cout_par_produit);
      const e = parMatiere.get(mid);
      if (e) {
        e.consommation = e.consommation === null || c.consommation === null
          ? null : e.consommation + c.consommation;
        e.cout = e.cout === null || cout === null ? null : e.cout + cout;
        e.texte = [e.texte, r.consommation].filter(Boolean).join(' + ');
      } else {
        parMatiere.set(mid, { consommation: c.consommation, cout,
          texte: r.consommation || '', source: c.source || 'a_confirmer', rang: i + 1 });
      }
    });

    for (const [mid, v] of parMatiere) {
      const ex = nomExistante.get(pid, mid);
      if (!ex) {
        insNom.run(pid, mid, v.consommation, v.texte, v.cout, v.source, v.rang);
        nCrees++;
      } else if (ex.source === 'saisi') {
        // Quelqu'un a mesuré et saisi cette consommation dans l'app. Le
        // chiffrier ne la reprend pas : la mesure vaut mieux que la déduction.
        nGardees++;
      } else {
        majNom.run(v.consommation, v.texte, v.cout, v.source, v.rang, pid, mid);
        nMaj++;
      }
    }

    // Une matière retirée du chiffrier sort de la nomenclature — sauf si elle
    // y a été ajoutée à la main.
    for (const r of nomDuProduit.all(pid)) {
      if (parMatiere.has(r.matiere_id)) continue;
      const ex = nomExistante.get(pid, r.matiere_id);
      if (ex && ex.source === 'saisi') { nGardees++; continue; }
      supNom.run(pid, r.matiere_id); nRetirees++;
    }
  }

  db.exec('COMMIT');
  dire(`  ${matCrees} matières créées, ${matMaj} mises à jour`);
  dire(`  nomenclature : ${nCrees} lignes créées, ${nMaj} mises à jour`
     + `${nGardees ? `, ${nGardees} saisies à la main préservées` : ''}`
     + `${nRetirees ? `, ${nRetirees} retirées` : ''}\n`);
} catch (e) {
  db.exec('ROLLBACK');
  console.error(`\n  Matières : échec, rien n'a été écrit : ${e.message}\n`);
  process.exit(1);
}

// ------------------------------------------------- l'ordre de production
// Un seul ordre pour la saison, reconnaissable à son numéro. Relancer l'import
// met à jour les quantités SANS toucher aux avancements : c'est l'atelier qui
// les déclare, un import n'a pas à écraser ça.
const TITRE_ORDRE = 'Plan de production 26-27 — prévente automne';

db.exec('BEGIN');
try {
  let o = db.prepare(`SELECT * FROM ordres WHERE titre = ?`).get(TITRE_ORDRE);
  if (!o) {
    const { prochainNumero } = require('./db.js');
    const id = db.prepare(`INSERT INTO ordres (numero, titre, statut, note)
        VALUES (?,?,?,?)`).run(prochainNumero(), TITRE_ORDRE, 'planifie',
        'Importé du chiffrier « QUANTITÉS FINALES — PLAN DE PRODUCTION 26-27 ». '
      + 'Les quantités se remettent à jour par un nouvel import ; les avancements '
      + 'se saisissent dans l\'app.').lastInsertRowid;
    o = db.prepare(`SELECT * FROM ordres WHERE id = ?`).get(id);
    dire(`  Ordre ${o.numero} créé.`);
  }

  // La date d'expédition vers le Canada commande tout le reste : c'est elle
  // qui détermine ce qui doit être fini, et donc l'ordre de fabrication.
  const EXPEDITION = process.env.MRP_EXPEDITION || '2026-10-01';
  const dejaLa = db.prepare(`SELECT id FROM ordre_jalons
      WHERE ordre_id = ? AND type = 'expedition'`).get(o.id);
  if (!dejaLa) {
    db.prepare(`INSERT INTO ordre_jalons (ordre_id, titre, date, type, note)
        VALUES (?,?,?,?,?)`).run(o.id, 'Expédition vers le Canada', EXPEDITION,
        'expedition', 'Tout ce qui n\'est pas fini à cette date ne part pas.');
    dire(`  Jalon d'expédition posé au ${EXPEDITION}.`);
  }

  const trouveItem = db.prepare(`SELECT * FROM ordre_items
      WHERE ordre_id = ? AND produit_id = ?`);
  const poseItem = db.prepare(`INSERT INTO ordre_items
      (ordre_id, produit_id, quantite, note, rang) VALUES (?,?,?,?,?)`);
  const majItem = db.prepare(`UPDATE ordre_items SET quantite = ?, note = ?,
      maj_le = datetime('now') WHERE id = ?`);
  const idProduit = db.prepare(`SELECT id FROM produits WHERE code = ?`);

  // La répartition par taille et coloris se remplace en bloc : elle vient
  // entièrement du chiffrier, rien n'est saisi dessus dans l'app.
  const videVar = db.prepare(`DELETE FROM item_variantes WHERE item_id = ?`);
  const poseVar = db.prepare(`INSERT INTO item_variantes
      (item_id, nom, quantite, rang) VALUES (?,?,?,?)`);

  let nItems = 0, nMaj = 0, unites = 0, rang = 0, nVar = 0, ecarts = [];
  for (const l of lignes) {
    if (!l.plan) continue;
    const pr = idProduit.get(l.code); if (!pr) continue;
    const q = Number(l.plan.quantite_prevue);
    // « 0 déjà en prévente » n'apprend rien : pas de prévente, pas de note.
    const pv = Number(l.plan.prevente_2026) || 0;
    const note = pv > 0 ? `${pv} déjà en prévente` : '';
    const ex = trouveItem.get(o.id, pr.id);
    let itemId;
    if (ex) { majItem.run(q, note, ex.id); itemId = ex.id; nMaj++; }
    else { itemId = poseItem.run(o.id, pr.id, q, note, ++rang).lastInsertRowid; nItems++; }
    unites += q;

    const vs = variantesPlan.get(l.plan.produit) || [];
    videVar.run(itemId);
    let r = 0, somme = 0;
    for (const v of vs) {
      const qv = Number(v.quantite) || 0;
      poseVar.run(itemId, v.variante, qv, ++r);
      somme += qv; nVar++;
    }
    // Le chiffrier ne boucle pas toujours. On garde les deux chiffres et on
    // signale l'écart, plutôt que d'en corriger un au hasard.
    if (vs.length && somme !== q) ecarts.push(`${l.code} : ${somme} en variantes pour ${q} au plan`);
  }
  db.exec('COMMIT');
  dire(`  ${nItems} items créés, ${nMaj} mis à jour — `
     + `${unites.toLocaleString('fr-CA')} unités à produire`);
  dire(`  ${nVar} variantes réparties (taille, coloris)`);
  if (ecarts.length) {
    dire(`\n  ${ecarts.length} répartitions ne bouclent pas avec le plan :`);
    for (const x of ecarts) dire(`    ${x}`);
    dire('  Les deux chiffres sont conservés ; l\'écart s\'affiche dans l\'app.');
  }
  dire('  Les avancements déjà saisis n\'ont pas été touchés.\n');
} catch (e) {
  db.exec('ROLLBACK');
  console.error(`\n  Ordre de production non créé : ${e.message}\n`);
}

// -------------------------------------------------------- ce qui manque encore
dire('  Ce qui n\'a PAS été importé, faute de source :');
dire('    · les autres échéances — le plan ne donne que l\'expédition');
// La nomenclature dit ce que la production va CONSOMMER ; aucun fichier ne dit
// ce qu'il y a en tablette. Tant qu'un premier comptage n'est pas saisi, les
// besoins se calculent contre un stock inconnu, et l'app le dit plutôt que de
// supposer zéro.
dire('    · les QUANTITÉS en stock — la nomenclature est là, le comptage non');
dire('    · les emplacements (palettes, boîtes)');
dire('    · les seuils de réapprovisionnement');
dire('    · les patrons rattachés aux produits');
dire('    · les fournisseurs et délais par matière\n');
const flous = lignes.filter(l => l._confiance !== 'sûr');
if (flous.length) {
  dire(`  ${flous.length} rattachements Shopify restent à confirmer. Ils sont`);
  dire('  écrits en note technique sur la fiche, visibles dans l\'app :');
  for (const l of flous.slice(0, 8))
    dire(`    ${l.code.padEnd(16)} ${l._confiance}`);
  dire('');
}
