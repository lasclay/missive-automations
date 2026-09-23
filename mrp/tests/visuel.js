/**
 * tests/visuel.js — ce qui se lit sans lire.
 *
 * Trois ajouts visuels qui ont chacun une raison de casser en silence :
 *
 *   1. Les silhouettes. Elles sont servies en masque CSS depuis `style.css`,
 *      pas en balises : si une classe est engendrée sans son tracé, ou un
 *      produit rattaché à une forme qui n'existe pas, rien ne plante — la
 *      case reste simplement vide, et personne ne s'en aperçoit. On épingle
 *      donc les deux sens : tout produit du catalogue a une forme, et toute
 *      forme sort bien dans la feuille.
 *   2. L'anneau d'avancement. Zéro et cent sont les deux cas où un dessin
 *      ment le plus volontiers : un anneau plein à 0 %, ou vide à 100 %,
 *      se lit de travers et ne lève aucune erreur.
 *   3. Les images entrées par formulaire — schéma d'un point de contrôle,
 *      photo d'une matière. L'app n'héberge rien : une « data: » URI ferait
 *      porter l'image à chaque affichage de la page. Elle doit être refusée
 *      à l'écriture, pas seulement à l'affichage.
 *
 *   node tests/visuel.js
 */
'use strict';
process.env.MRP_DB = process.env.MRP_DB
  || require('node:path').join(require('node:os').tmpdir(), `mrp-vis-${process.pid}.db`);

const fs = require('node:fs');
const path = require('node:path');
const SIL = require('../silhouettes.js');
const V = require('../vues.js');

let ok = 0, ko = 0;
const t = (nom, cond, detail = '') => {
  if (cond) { ok++; console.log(`  [OK ] ${nom}`); }
  else { ko++; console.log(`  [KO ] ${nom}${detail ? ' — ' + detail : ''}`); }
};

console.log('\n  Silhouettes, anneaux et images\n');

// ------------------------------------------------------------ 1. silhouettes
{
  // Le catalogue fait foi, pas la table du module : un produit ajouté au TSV
  // et oublié ici tombe sur le repli par mot-clé, ou sur rien du tout.
  const tsv = fs.readFileSync(
    path.join(__dirname, '..', 'donnees', 'correspondances.tsv'), 'utf8');
  const produits = tsv.split('\n').slice(1)
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split('\t'))
    .filter(c => c[0] && c[0].trim())
    .map(c => ({ code: c[0].trim(), nom: (c[1] || '').trim() }));

  t('le catalogue est lu', produits.length >= 30, `${produits.length} produits`);

  const sans = produits.filter(p => !SIL.cle(p.code, p.nom));
  t('chaque produit du catalogue a une silhouette',
    sans.length === 0, sans.map(p => p.code).join(', '));

  // Un code rattaché à une forme qui n'existe pas : la classe sortirait, le
  // masque non, et la case resterait vide sans rien signaler.
  const orphelins = Object.entries(SIL.PAR_CODE)
    .filter(([, forme]) => !SIL.TRACES[forme]);
  t('aucun produit ne pointe une forme absente',
    orphelins.length === 0, orphelins.map(([c]) => c).join(', '));

  // Et l'inverse : une forme dessinée que personne n'emploie est du poids mort
  // dans une feuille de style qui part sur la connexion tunisienne.
  const employees = new Set(Object.values(SIL.PAR_CODE));
  const inutiles = Object.keys(SIL.TRACES).filter(k => !employees.has(k));
  t('aucune forme dessinée ne reste inemployée',
    inutiles.length === 0, inutiles.join(', '));

  const css = SIL.css();
  const manquantes = Object.keys(SIL.TRACES).filter(k => !css.includes(`.s-${k}{`));
  t('chaque forme sort bien une règle dans la feuille',
    manquantes.length === 0, manquantes.join(', '));

  // Les cinq caractères qui cassent une URI de données entre guillemets. Les
  // laisser tels quels couperait la règle au premier, sans erreur visible.
  const uris = css.match(/data:image\/svg\+xml,[^"]*/g) || [];
  // Deux URI par forme : `-webkit-mask-image` et `mask-image`.
  t('toutes les formes sont encodées en URI de données',
    uris.length === Object.keys(SIL.TRACES).length * 2, `${uris.length} URI`);
  t('aucun chevron ni guillemet brut dans une URI',
    uris.every(u => !/[<>"#]/.test(u)));

  t('le code décide avant le nom',
    SIL.cle('TOTE', 'Manteau hivernal') === 'tote');
  t('sans code connu, le nom sert de repli',
    SIL.cle('XX-INCONNU', 'Grande tuque de ville') === 'tuque');
  t('sans rien de reconnaissable, aucune silhouette',
    SIL.cle('XX-INCONNU', 'Objet non identifié') === null);

  t('la balise reste minuscule',
    V.silhouette('TUQUE-SPORT').length < 50, V.silhouette('TUQUE-SPORT'));
  t('un produit sans forme ne laisse pas de balise vide',
    V.silhouette('XX-INCONNU', 'zzz') === '');
}

// ----------------------------------------------------------------- 2. anneau
{
  const a0 = V.jauge(0), a40 = V.jauge(40), a100 = V.jauge(100);

  // À zéro, aucun arc : sans ça, « rien de commencé » et « l'anneau n'a pas
  // chargé » se ressemblent. C'est la piste qui se fonce, par la classe.
  t('à 0 %, aucun arc de valeur n\'est tracé', !a0.includes('don-v'));
  t('à 0 %, la piste porte la classe qui la fonce', a0.includes('don zero'));

  t('à 40 %, le tiret vaut le pourcentage',
    a40.includes('stroke-dasharray="40 100"'));
  t('à 100 %, l\'anneau est plein',
    a100.includes('stroke-dasharray="100 100"') && a100.includes('don plein'));

  // pathLength normalise la circonférence : sans lui, le tiret devrait passer
  // par 2πr et tout changement de rayon fausserait silencieusement l'arc.
  t('la circonférence est normalisée à 100',
    (a40.match(/pathLength="100"/g) || []).length === 2);

  t('trois seuils, trois teintes',
    V.jauge(10).includes('don bas') && V.jauge(50).includes('don part')
    && V.jauge(90).includes('don haut'));

  // L'anneau ne porte rien qu'un lecteur d'écran doive entendre : le
  // pourcentage est écrit à côté, en toutes lettres.
  t('l\'anneau de ligne est muet pour un lecteur d\'écran',
    a40.includes('aria-hidden="true"'));
}

// ------------------------------------------------- 3. images entrées à la main
{
  const auth = require('../auth.js');
  const { db } = require('../db.js');
  auth.creerUtilisateur({ courriel: 'v@test.com', mdp: 'motdepasse1',
    nom: 'V', role: 'admin' });
  const admin = db.prepare(
    `SELECT * FROM utilisateurs WHERE courriel = 'v@test.com'`).get();

  const pid = db.prepare(`INSERT INTO produits (code, nom) VALUES (?,?)`)
    .run('T-VIS', 'Tuque de test').lastInsertRowid;

  // Le rendu : ce qui est affiché passe par le CDN redimensionné, et le lien
  // ouvre la pleine taille. Une image d'origine coûterait dix fois son prix.
  const CDN = 'https://cdn.shopify.com/s/files/1/0475/8932/7010/files/x.png';
  db.prepare(`INSERT INTO qc_points (produit_id, type, titre, schema_url)
              VALUES (?,?,?,?)`).run(pid, 'critique', 'Bas du zipper', CDN);

  const D = require('../db.js');
  const html = V.vueProtocole({ user: { ...admin, unites: 'metrique' },
    p: db.prepare(`SELECT * FROM produits WHERE id = ?`).get(pid),
    proto: D.protocole(pid) });

  t('le formulaire demande une adresse de schéma',
    html.includes('name="schema_url"'));
  t('le schéma s\'affiche redimensionné', html.includes('width='));
  t('le lien du schéma ouvre la pleine taille',
    html.includes(`href="${CDN}"`));

  // L'écriture : c'est là que ça compte. Refuser à l'affichage seulement
  // laisserait la « data: » URI en base, prête à ressortir ailleurs.
  t('une « data: » URI n\'est pas une adresse acceptable',
    V.urlAcceptable('data:image/png;base64,AAAA') === false);
  t('un chemin relatif non plus', V.urlAcceptable('/gabarit.png') === false);
  t('une adresse https l\'est', V.urlAcceptable(CDN) === true);
}

// ------------------------------------------------ 4. vignettes des matières
{
  const V_INV = require('../vues_inventaire.js');
  const { db } = require('../db.js');
  const admin = db.prepare(
    `SELECT * FROM utilisateurs WHERE courriel = 'v@test.com'`).get();

  const base = { id: 1, code: 'TIS-NOIR', nom: 'Softshell 3c noir',
    categorie: 'tissu', unite: 'm', suivi_stock: 1, jamais_compte: 1,
    stock: 0, besoin: 0, manque: 0, photo_url: '' };
  const args = { user: admin, msg: null, produits: [], categorie: '',
    alertes: { ruptures: [], bas: [], a_chiffrer: [], jamais_comptees: [],
               produits_bas: [] } };

  const sans = V_INV.vueInventaire({ ...args, matieres: [base] });
  const avec = V_INV.vueInventaire({ ...args,
    matieres: [{ ...base, photo_url: 'https://cdn.shopify.com/s/files/a.png' }] });

  // Trente-neuf carrés gris portant deux lettres du code n'apprennent rien :
  // la colonne n'apparaît que le jour où une matière a vraiment une photo.
  t('sans photo, aucune colonne de vignettes', !sans.includes('avec-mini'));
  t('dès qu\'une matière a une photo, la colonne apparaît',
    avec.includes('avec-mini'));
  t('le nom de la matière reste lisible dans les deux cas',
    sans.includes('Softshell 3c noir') && avec.includes('Softshell 3c noir'));
}

console.log(`\n  ${ok} réussites, ${ko} échecs\n`);
process.exit(ko ? 1 : 0);
