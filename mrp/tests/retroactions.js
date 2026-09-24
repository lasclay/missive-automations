/**
 * tests/retroactions.js — la voix des clients dans le MRP.
 *
 * Ce qui est épinglé, et pourquoi :
 *
 *   1. L'ANONYMAT. C'est la règle qui justifie que ce corpus existe dans
 *      l'app. Aucune citation ne doit porter de courriel, de numéro de
 *      commande ou de numéro de suivi. Un seul passage à travers, et ce sont
 *      les données d'un client qui s'affichent à l'atelier tunisien.
 *   2. La décitation. 87 % du « texte client » était notre propre courriel
 *      recopié. Sans ce filtre, on attribue nos phrases aux clients — et le
 *      distillat sortait « nos glacières sont conçues pour… » comme une
 *      plainte.
 *   3. L'attribution par proximité. Le produit doit être nommé PRÈS du
 *      défaut : « une couture de mon manteau a cédé » se rangeait sous
 *      GLACIERE parce que le mot traînait trente lignes plus loin, ce qui
 *      enverrait corriger le mauvais produit.
 *   4. Les rétroactions de famille ne se font pas passer pour des certitudes.
 *   5. L'import ne touche pas ce qui a été écrit à la main.
 *
 *   node tests/retroactions.js
 */
'use strict';
process.env.MRP_DB = process.env.MRP_DB
  || require('node:path').join(require('node:os').tmpdir(), `mrp-retro-${process.pid}.db`);

const { db, retroactionsProduit, couvertureRetro, familleRetro } = require('../db.js');
const { deciter, notreVoix } = require('../voix-client/outils/deciter.js');
const { attribuerPres, mentions, sansAccent } = require('../voix-client/outils/distiller.js');

let ok = 0, ko = 0;
const t = (nom, cond, detail = '') => {
  if (cond) { ok++; console.log(`  [OK ] ${nom}`); }
  else { ko++; console.log(`  [KO ] ${nom}${detail ? ' — ' + detail : ''}`); }
};

console.log('\n  Rétroactions clients\n');

/* ================================================= 1. la décitation ====== */

t('un courriel cité est coupé',
  deciter("Mes mitaines sont décousues.\n\nLe 3 mars, lasclay <hey@lasclay.com> a écrit :\n"
        + "Nos mitaines sont conçues pour l'hiver.") === 'Mes mitaines sont décousues.');

t('une citation en chevrons est coupée',
  deciter('Trop petites.\n> Bonjour, merci de votre commande') === 'Trop petites.');

t('« From: Lasclay » coupe aussi',
  deciter('Le zipper a lâché.\nFrom: Lasclay <hey@lasclay.com>\nblabla') === 'Le zipper a lâché.');

t('une adresse courriel ne survit jamais à la décitation',
  !/@/.test(deciter('Écrivez-moi à jean.tremblay@exemple.com pour la suite')),
  deciter('Écrivez-moi à jean.tremblay@exemple.com pour la suite'));

t('une URL ne survit pas non plus',
  !/https?:/.test(deciter('Voir https://exemple.com/ma-commande-12345')));

// Notre voix, même arrivée par un message marqué « pas de nous ».
t('« nos glacières » est reconnu comme notre voix, accents compris',
  notreVoix('Pour info, nos glacières sont conçues pour quelques heures.'));
t('« 20 % de rabais » est notre voix', notreVoix('Sac à dos glacière 30L — 20 % de rabais'));
t('une vraie plainte n\'est pas prise pour notre voix',
  !notreVoix('Ma glacière est arrivée avec une attache cassée.'));

/* ========================================= 2. l'attribution par proximité = */

{
  // Le cas qui a motivé la règle : deux produits dans le même fil.
  const texte = sansAccent(
    "j'ai commande une glaciere le mois dernier. "
    + 'x'.repeat(700)
    + " je vous ecris puisqu'une couture de mon manteau a cede.");
  const i = texte.indexOf('cede');
  const a = attribuerPres(texte, i, ['GLACIERE'], mentions(texte));
  t('« une couture de mon manteau a cédé » ne se range PAS sous la glacière',
    a.code !== 'GLACIERE', `rangé sous ${a.code || a.famille}`);
  t('… et se range sous la famille « manteaux »',
    a.famille === 'manteaux', String(a.famille));
}
{
  // Un fil qui ne parle que d'un produit : pas d'ambiguïté à trancher.
  const texte = sansAccent('bonjour ' + 'x'.repeat(900) + " l'attache est cassee");
  const a = attribuerPres(texte, texte.indexOf('cassee'), ['GLACIERE'], mentions(texte));
  t('un fil qui ne nomme qu\'un produit lui attribue le défaut, même de loin',
    a.code === 'GLACIERE' && a.sur === 'fil', `${a.code}/${a.sur}`);
}
{
  const texte = sansAccent('bonjour ' + 'x'.repeat(900) + ' tout est decousu');
  const a = attribuerPres(texte, texte.indexOf('decousu'), ['GLACIERE', 'CACHE-COU'], mentions(texte));
  t('deux produits, aucun à proximité : on n\'attribue pas au hasard',
    !a.code && !a.famille, String(a.code || a.famille));
}

/* ============================================ 3. l'anonymat, en base ===== */

const fs = require('node:fs');
const path = require('node:path');
const TSV = path.join(__dirname, '..', 'donnees', 'retroactions.tsv');
const brut = fs.existsSync(TSV)
  ? fs.readFileSync(TSV, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
  : [];
const entete = brut.length ? brut[0].split('\t') : [];
const iCit = entete.indexOf('citation');
const lignes = brut.slice(1).map(l => ({ citation: (l.split('\t')[iCit] || '') }));

if (!lignes.length) {
  ko++; console.log('  [KO ] donnees/retroactions.tsv absent — rien à prouver anonyme');
} else {
  const fuite = (re, quoi) => {
    const mauvais = lignes.filter(l => re.test(l.citation));
    t(`aucune citation ne porte ${quoi} (${lignes.length} citations)`,
      mauvais.length === 0, mauvais.slice(0, 2).map(x => x.citation.slice(0, 70)).join(' | '));
  };
  fuite(/[\w.+-]+@[\w.-]+\.\w{2,}/, 'une adresse courriel');
  fuite(/https?:\/\//i, 'une URL');
  fuite(/\bL-\d{4,}\b/, 'un numéro de commande');
  fuite(/\b\d{11,}\b/, 'un numéro de suivi');

  t('aucune citation vide ou dérisoire',
    lignes.every(l => l.citation.trim().length >= 25));
}

/* ================================== 4. les rétroactions de famille ======= */

t('MIT-POLAR appartient à la famille « mitaines »', familleRetro('MIT-POLAR') === 'mitaines');
t('la glacière n\'appartient à aucune famille', familleRetro('GLACIERE') === null);

{
  const p = db.prepare(`SELECT id FROM produits WHERE code = 'MIT-PLEIN-AIR'`).get();
  if (p) {
    const r = retroactionsProduit(p.id);
    t('une mitaine voit les rétroactions de sa famille', r.total >= r.propres);
    t('… et elles sont marquées comme telles, jamais fondues dans les siennes',
      r.groupes.every(g => g.lignes.every(l => typeof l.de_famille === 'boolean'))
      && r.total > r.propres === (r.total - r.propres > 0));
    t('les groupes sont ordonnés du plus fréquent au moins fréquent',
      r.groupes.every((g, i) => i === 0 || r.groupes[i-1].lignes.length >= g.lignes.length));
  }
}

{
  // Un produit sans rétroaction doit répondre, et dire son vide.
  //
  // Le produit était MANCHON, retiré du catalogue le 24/09/2026. Le test était
  // enveloppé dans un `if (p)` : il ne tombait donc pas, il DISPARAISSAIT — et
  // la suite restait verte en ayant cessé de vérifier quoi que ce soit. Plus
  // de garde : si le code choisi s'en va à son tour, le test le dit.
  // Le témoin est créé ICI, pas emprunté au catalogue : ce test tournait sur
  // MANCHON, et le jour où ce produit est sorti du catalogue il n'a pas
  // échoué — il a disparu, parce qu'un `if (p)` l'entourait. Un test qui
  // s'évapore quand sa donnée s'en va est pire qu'un test absent : la suite
  // reste verte en ayant cessé de vérifier.
  const id = db.prepare(`INSERT INTO produits (code, nom) VALUES (?, ?)`)
    .run(`TEMOIN-SANS-RETRO-${process.pid}`, 'Témoin sans rétroaction').lastInsertRowid;
  const r = retroactionsProduit(id);
  t('un produit sans rétroaction rend une réponse vide, pas une erreur',
    Boolean(r) && Array.isArray(r.groupes) && r.groupes.length === 0,
    JSON.stringify(r));
}

t('un produit inconnu rend null plutôt que de planter',
  retroactionsProduit(999999) === null);

/* ======================================== 5. l'import et la main ========= */

{
  const p = db.prepare(`SELECT id FROM produits LIMIT 1`).get();
  if (p) {
    // Une rétroaction écrite dans l'app porte un auteur ; l'import n'y touche pas.
    const u = db.prepare(`INSERT INTO utilisateurs (courriel, mdp_hash, nom, role)
      VALUES (?,?,?,'admin')`).run(`r${process.pid}@l.com`, 'x', 'T').lastInsertRowid;
    db.prepare(`INSERT INTO produit_retroactions
      (produit_id, probleme, titre, categorie, citation, source_ref, cree_par)
      VALUES (?,?,?,?,?,?,?)`).run(p.id, 'main', 'Écrit à la main', 'bris',
        "Relevé à l'atelier pendant le montage, pas venu de Missive.", '', u);
    db.prepare(`DELETE FROM produit_retroactions
                 WHERE cree_par IS NULL AND source_ref LIKE 'missive:%'`).run();
    t("une rétroaction écrite à la main survit au nettoyage de l'import",
      db.prepare(`SELECT COUNT(*) n FROM produit_retroactions WHERE cree_par = ?`)
        .get(u).n === 1);
  }
}

{
  // Un produit neuf, sans une seule rétroaction : il doit quand même paraître
  // dans la couverture. Un produit absent de la liste est un produit dont
  // personne ne se demande jamais ce que les clients en disent.
  const code = `T-VIDE-${process.pid}`;
  db.prepare(`INSERT INTO produits (code, nom) VALUES (?, ?)`).run(code, 'Produit vide');
  const c = couvertureRetro();
  const vide = c.find(x => x.code === code);
  t('un produit sans aucune rétroaction paraît quand même dans la couverture',
    Boolean(vide) && vide.total === 0, vide ? String(vide.total) : 'absent');
}

console.log(`\n  ${ok} ok, ${ko} ko\n`);
process.exit(ko ? 1 : 0);
