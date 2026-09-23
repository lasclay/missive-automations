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

// ---------------------------------------------- 5. l'aperçu agrandi, sans script
{
  const CDN = 'https://cdn.shopify.com/s/files/1/0475/8932/7010/files/f.png';
  const z = { cle: 'i7', href: '/produits/7', titre: 'Foulard' };
  const avec = V.miniature(CDN, 'FOULARD', { zoom: z });
  const sans = V.miniature(CDN, 'FOULARD');

  t('la vignette devient un lien vers le panneau',
    avec.includes('href="#z-i7"') && avec.includes('class="mini mini-z"'));
  t('le panneau porte l\'identifiant que la vignette vise',
    avec.includes('id="z-i7"'));

  // Le geste qui suit « je regarde la pièce de près » est presque toujours
  // « je vais voir sa fiche ». L'agrandissement est donc un lien, et le dit.
  t('l\'image agrandie mène à la fiche produit',
    avec.includes('class="zoom-i" href="/produits/7"'));
  t('le panneau annonce où il mène',
    avec.includes('ouvrir la fiche'));

  // Tant que l'ancre n'est pas posée, le panneau est en display:none et son
  // image porte loading="lazy" : elle n'est pas demandée. Vérifié au
  // navigateur — 0 requête en 900 px à l'affichage, 1 après le clic.
  t('l\'image agrandie est différée', /width="900"[^>]*/.test(avec)
    && avec.includes('loading="lazy"'));
  t('elle est demandée redimensionnée, jamais en taille d\'origine',
    avec.includes('?width=900') && !/src="[^"]*f\.png"/.test(avec));

  // Refermer doit ramener à la vignette, pas en haut d'une liste de trente
  // lignes : c'est la différence entre « j'ai regardé » et « j'ai perdu ma
  // place ».
  t('la fermeture ramène à la vignette, pas en haut de page',
    (avec.match(/href="#r-i7"/g) || []).length === 2 && avec.includes('id="r-i7"'));

  t('sans option de zoom, la vignette reste un simple encadré',
    sans.includes('<span class="mini">') && !sans.includes('zoom'));
  t('sans photo, aucun panneau n\'est engendré',
    !V.miniature('', 'FOULARD', { zoom: z }).includes('zoom'));

  // Une « data: » URI ne doit pas davantage ouvrir un panneau : elle ferait
  // porter l'image à la page, deux fois plutôt qu'une.
  t('une « data: » URI n\'ouvre pas de panneau',
    !V.miniature('data:image/png;base64,AAAA', 'FOULARD', { zoom: z })
      .includes('zoom'));
}

// ------------------------------------------- 6. l'échelle réelle sur la grille
{
  const V_ = require('../vues.js');
  const base = { id: 1, code: 'X', nom: 'X', nom_court: 'X', photo: '' };
  const grille = (p) => V_.vueProduits({ user: { nom: 'V', role: 'admin' },
    produits: [{ ...base, ...p }], msg: null });

  // Trois cache-cous, même pièce en trois tailles, même photo de catalogue
  // depuis qu'ils ont chacun leur fiche : le nom les distingue, l'image non.
  const adulte = grille({ cote_l: '29,9', cote_h: '27,1' });
  const petit  = grille({ cote_l: '22,1', cote_h: '19,9' });

  t('la cote hors tout sort un indicateur d\'échelle',
    adulte.includes('v-ech') && adulte.includes('29,9 × 27,1 cm'));

  // Le rectangle est à l'échelle, pas décoratif : 29,9 cm doit faire plus de
  // pixels que 22,1. Sans ça, trois tailles donnent trois carrés identiques
  // et l'indicateur ment en ayant l'air de dire quelque chose.
  const px = (h) => { const m = h.match(/width:(\d+)px;height:(\d+)px/);
                      return m ? [Number(m[1]), Number(m[2])] : null; };
  const [la, ha] = px(adulte) || [0, 0];
  const [lp, hp] = px(petit)  || [0, 0];
  t('le rectangle suit la cote : l\'adulte est plus grand que le petit enfant',
    la > lp && ha > hp, `${la}×${ha} vs ${lp}×${hp}`);
  t('et il garde la proportion de la pièce',
    Math.abs((la / ha) - (29.9 / 27.1)) < 0.05, `${(la / ha).toFixed(3)}`);

  // Rien à inventer là où la cote manque : trente et un produits sur
  // trente-quatre n'en ont pas, et un rectangle par défaut serait un mensonge.
  t('sans cote, aucun indicateur', !grille({}).includes('v-ech'));
  t('une cote seule ne suffit pas',
    !grille({ cote_l: '29,9' }).includes('v-ech'));
  t('une cote illisible est ignorée',
    !grille({ cote_l: 'À FIXER', cote_h: 'À FIXER' }).includes('v-ech'));
  t('une cote nulle aussi', !grille({ cote_l: '0', cote_h: '0' }).includes('v-ech'));

  // La photo est cadrée, plus rognée : une besace sans ses anses n'est plus
  // une besace, et c'est la forme qu'on vient reconnaître.
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  t('la photo de la grille est cadrée, pas rognée',
    /\.vignette img\{[^}]*object-fit:contain/.test(css));
  t('et elle a de l\'air autour', /\.vignette img\{[^}]*padding:1[0-9]px/.test(css));
}

// ------------------------------------------------- 7. les planches de contrôle
{
  const PIC = require('../pictos.js');
  const HREF = '/qualite/planche/fils';

  // Sous un point : la bande entière, chaque panneau cliquable vers SON geste.
  // Le premier jet n'en montrait qu'un, sur un calcul en octets BRUTS ; c'est
  // le compressé qui part sur le réseau, et les sept bandes d'une page y
  // coûtent 770 octets de plus que sept amorces.
  const bande = PIC.planche('Fils qui dépassent — les retirer et les couper',
    { href: HREF });
  t('un point connu sort sa bande', bande.includes('class="pi"'));
  t('la bande montre les quatre panneaux',
    (bande.match(/class="pi-p"/g) || []).length === 4);
  t('chaque panneau mène à SON geste, pas au premier',
    [1, 2, 3, 4].every(i => bande.includes(`href="${HREF}#p${i}"`)));
  t('sans lien, les panneaux ne sont pas cliquables',
    !PIC.planche('Fils qui dépassent — les retirer et les couper').includes('<a '));
  // Ce qui compte n'est ni le brut, ni une bande isolée : c'est la PAGE, où
  // sept bandes se compressent les unes contre les autres. Mesurée seule, une
  // bande fait 1,2 Ko ; les sept ensemble en font 2,3 — la structure se répète
  // d'un panneau à l'autre et gzip en vit.
  const gz = (x) => require('node:zlib').gzipSync(Buffer.from(x), { level: 9 }).length;
  // Ce qu'une PAGE porte vraiment : les sept procédés généraux, qui
  // apparaissent sous chaque produit. Mesurer les quinze planches du module
  // reviendrait à mesurer ce que personne ne télécharge d'un coup.
  const GENERAUX = ['fils', 'frottement_sec', 'lavage', 'frottement_gel',
    'comparer', 'etiquette', 'photo_boutique'];
  const page = GENERAUX.map(k => PIC.PLANCHES[k].join('')).join('');
  t('les sept procédés généraux d\'une page tiennent sous 3 Ko compressés',
    gz(page) < 3000, gz(page) + ' o');

  // La page : tous les panneaux, chacun avec son ancre. Arriver par #p3 amène
  // au troisième geste, pas en haut de la page — c'est ce qui permet de
  // cliquer une étape dans la liste et de tomber dessus.
  const bd = PIC.plancheBD('Fils qui dépassent — les retirer et les couper');
  t('la page porte les quatre panneaux',
    (bd.match(/class="pi-g"/g) || []).length === 4);
  t('chaque panneau porte son ancre',
    ['p1', 'p2', 'p3', 'p4'].every(a => bd.includes(`id="${a}"`)));
  t('les panneaux sont numérotés dans l\'ordre',
    bd.indexOf('>1<') < bd.indexOf('>2<') && bd.indexOf('>2<') < bd.indexOf('>3<'));

  // La décision se montre par le RÉSULTAT : le fil qui vient est un ✗, le fil
  // qui résiste un ✓. C'est la nuance qu'un texte français fait perdre.
  t('la planche des fils montre les deux issues',
    bd.includes('#2f7d52') && bd.includes('#d4342a'));

  // Aucun mot, jamais. Les seuls écrits sont des chiffres : ils se lisent
  // pareil en français, en arabe et en anglais.
  const ecrits = [...Object.values(PIC.PLANCHES).flat().join('')
    .matchAll(/>([^<>]+)<\/(?:text|tspan)>/g)].map(m => m[1].trim());
  const motsInterdits = ecrits.filter(x => !/^(\d+|min|h|s)$/.test(x));
  t('aucun mot dans les planches, seulement des chiffres et leurs unités',
    motsInterdits.length === 0, motsInterdits.join(' | '));

  // Les couleurs sont ÉCRITES dans le dessin, pas prises au thème : une
  // notice doit être la même partout, et un tissu qui change de vert entre
  // deux téléphones cesse d'être une référence.
  t('la pièce porte sa vraie couleur, pas celle du thème',
    bd.includes('#3c7a59') && !bd.includes('var(--'));
  // La couture en pointillé est ce qui fait lire « textile » et pas « bois ».
  t('la pièce porte sa couture', bd.includes('stroke-dasharray'));

  t('le titre se reconnaît sans accents ni ponctuation',
    PIC.cle('fils qui depassent  les retirer et les couper') === 'fils');
  t('un point sans planche n\'en invente pas',
    PIC.cle('Vérifier la couleur du fil') === null
    && PIC.planche('Vérifier la couleur du fil') === '');
  t('un titre vide non plus', PIC.cle('') === null && PIC.cle(null) === null);

  // Toute clé nommée doit exister, et toute planche dessinée doit être
  // atteignable : une planche orpheline est du poids mort, une clé sans
  // planche est une page blanche.
  const cles = [...PIC.PAR_TITRE.values()];
  t('chaque titre pointe une planche qui existe',
    cles.every(k => PIC.PLANCHES[k]), cles.filter(k => !PIC.PLANCHES[k]).join(', '));
  const orphelines = Object.keys(PIC.PLANCHES).filter(k => !cles.includes(k));
  t('aucune planche dessinée ne reste inatteignable',
    orphelines.length === 0, orphelines.join(', '));
}

// ------------------------------------------------- 8. les points de rupture
{
  const PIC = require('../pictos.js');
  const SIL2 = require('../silhouettes.js');

  // Les zones viennent du corpus voix-client, pas d'une intuition. Une zone
  // qui pointe une forme inexistante ne planterait pas : elle sortirait une
  // planche sans produit, et personne ne verrait que la pièce a disparu.
  const formes = Object.values(PIC.RUPTURES).map(([f]) => f);
  t('chaque rupture pointe une silhouette qui existe',
    formes.every(f => SIL2.TRACES[f]),
    formes.filter(f => !SIL2.TRACES[f]).join(', '));

  // La zone doit tomber DANS la pièce : la silhouette tient dans une boîte de
  // 24 × 24, une zone hors de cette boîte cerclerait du vide.
  const hors = Object.entries(PIC.RUPTURES)
    .filter(([, [, x, y]]) => x < 0 || x > 24 || y < 0 || y > 24);
  t('chaque zone tombe dans la pièce', hors.length === 0,
    hors.map(([k]) => k).join(', '));

  // Le geste est le même partout — tirer de part et d'autre —, seule la zone
  // change. Trois panneaux génériques pour vingt zones valent mieux que
  // soixante dessins qui divergent.
  for (const k of Object.keys(PIC.RUPTURES)) {
    const p_ = PIC.PLANCHES[k];
    if (!p_) { t(`la planche ${k} existe`, false); continue; }
    if (k === Object.keys(PIC.RUPTURES)[0])
      t('une planche de rupture fait quatre panneaux', p_.length === 4);
  }
  const gestes = Object.keys(PIC.RUPTURES).map(k => PIC.PLANCHES[k].slice(1).join(''));
  t('le geste est identique d\'une rupture à l\'autre',
    gestes.every(g => g === gestes[0]));

  // Et chaque premier panneau est DIFFÉRENT : c'est le seul qui porte le
  // produit et sa zone. S'ils se ressemblaient, la planche ne dirait plus où.
  const zones = Object.keys(PIC.RUPTURES).map(k => PIC.PLANCHES[k][0]);
  t('chaque rupture montre SA zone sur SON produit',
    new Set(zones).size === zones.length);

  // Tout titre du fichier de ruptures doit trouver sa planche, sinon le point
  // arrive en atelier sans le dessin qui le rend faisable.
  const fs2 = require('node:fs');
  const tsvR = fs2.readFileSync(
    path.join(__dirname, '..', 'donnees', 'qualite-ruptures.tsv'), 'utf8');
  const titres = tsvR.split('\n').slice(1)
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('\t'))
    .map(l => l.split('\t')[2]).filter(x => x && x !== 'titre');
  t('le fichier de ruptures est lu', titres.length >= 6, `${titres.length} lignes`);
  const sansPlanche = [...new Set(titres)].filter(x => !PIC.cle(x));
  t('chaque point de rupture a sa planche',
    sansPlanche.length === 0, sansPlanche.join(' | '));
}

// ------------------------------- 9. la garniture déclarée doit être contrôlée
//
// Ce test existe à cause d'un trou réel. Le protocole général portait un
// « Fermeture éclair — glissement sur toute la course » appliqué à TOUS les
// produits, y compris ceux qui n'en ont pas. Il a été retiré le 23/09/2026, à
// raison. Mais le tote, LUI, a une fermeture de 28 cm — et s'est retrouvé sans
// aucun contrôle, sans que rien ne le signale. La besace aussi, 47 cm.
//
// Retirer un point générique laisse un trou chez ceux à qui il s'appliquait
// vraiment. C'est ce trou-là que ce test rend impossible de rouvrir.
//
// IL LIT LES FICHIERS, PAS LA BASE. Une première version interrogeait la base
// de test — qui ne contient aucun produit. Elle passait donc toujours, sans
// jamais rien vérifier : le pire des deux mondes, un test qui rassure et ne
// tient rien.
{
  const lireTsv = (nom) => {
    const brut = fs.readFileSync(
      path.join(__dirname, '..', 'donnees', nom), 'utf8').split('\n');
    const entete = brut.findIndex(l => l.startsWith('produit\t'));
    return brut.slice(entete + 1).filter(l => l.includes('\t')).map(l => l.split('\t'));
  };

  const garn = new Map();
  for (const c of lireTsv('charte-produits.tsv')) {
    if (c[1] !== 'garniture' || !c[0]) continue;
    if (!garn.has(c[0])) garn.set(c[0], []);
    garn.get(c[0]).push(c[2]);
  }
  t('la charte déclare des garnitures', garn.size >= 15, `${garn.size} produits`);

  // Tout ce qui peut porter un point de contrôle de produit.
  const points = new Map();
  for (const f of ['qualite-amorce.tsv', 'qualite-charte.tsv', 'qualite-cotes.tsv',
                   'qualite-ruptures.tsv', 'qualite-garnitures.tsv'])
    for (const c of lireTsv(f)) {
      if (!c[0] || c[0] === '*') continue;
      points.set(c[0], (points.get(c[0]) || '') + ' ' + c[2] + ' ' + (c[3] || ''));
    }
  t('les protocoles produits sont lus', points.size >= 20, `${points.size} produits`);

  // Les garnitures qui CASSENT ou se posent de travers. L'étiquette est
  // couverte par le protocole général : elle n'est pas de la partie.
  const CRITIQUES = {
    'fermeture éclair': /fermeture .?clair|glissi.re/i,
    'cord-lock':        /cord.?lock/i,
    'velcro':           /velcro/i,
  };
  const trous = [];
  let examines = 0;
  for (const [code, g] of garn) {
    const pts = points.get(code) || '';
    examines++;
    for (const [nom, re] of Object.entries(CRITIQUES))
      if (g.some(x => re.test(x)) && !re.test(pts)) trous.push(`${code} : ${nom}`);
  }
  // Sans ce garde-fou, le test passerait à vide le jour où la lecture casse.
  t('le test a vraiment examiné des produits', examines >= 15, `${examines}`);
  t('toute garniture qui casse est contrôlée quelque part',
    trous.length === 0, trous.join(' | '));
}

console.log(`\n  ${ok} réussites, ${ko} échecs\n`);
process.exit(ko ? 1 : 0);
