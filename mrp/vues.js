/**
 * Lasclay — MRP : vues
 * ---------------------------------------------------------------------------
 * Génération HTML par fonctions. Pas de moteur de gabarits, pas de JS côté
 * client : chaque action est un formulaire qui poste et redirige. C'est ce qui
 * rend l'application utilisable sur une connexion lente.
 */
'use strict';
const U = require('./unites.js');
const SIL = require('./silhouettes.js');
const PIC = require('./pictos.js');

/**
 * Le numéro de version de la feuille de style — l'empreinte de son contenu.
 *
 * POURQUOI. La feuille est servie avec un cache d'un jour, ce qui est juste :
 * quatre-vingt-dix kilo-octets sur la connexion tunisienne ne se retéléchargent
 * pas à chaque page. Mais sans version dans l'adresse, un déploiement restait
 * invisible pendant vingt-quatre heures — la page nouvelle avec la feuille
 * d'hier. Ça s'est vu : les anneaux d'avancement, dont toute la géométrie
 * vivait dans la feuille, sont sortis en disques noirs de trois cents pixels.
 *
 * L'empreinte change avec le contenu, donc l'adresse change avec lui, donc le
 * navigateur redemande la feuille le jour où elle bouge — et seulement ce
 * jour-là. Calculée une fois au démarrage : le fichier ne change pas en cours
 * d'exécution, seul un redéploiement le change, et un redéploiement relance
 * le processus.
 */
const VERSION_CSS = require('node:crypto').createHash('sha256')
  .update(require('node:fs').readFileSync(
    require('node:path').join(__dirname, 'public', 'style.css')))
  .update(SIL.css())
  .digest('hex').slice(0, 10);
const { CATEGORIES: CATEGORIES_M, qte: qteFR,
        MOTS_RAPPORT } = require('./db.js');

// ------------------------------------------------------------------ utilitaires
const e = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const STATUTS = { brouillon:'Brouillon', planifie:'Planifié', en_cours:'En cours',
                  termine:'Terminé', annule:'Annulé' };
const TYPES_JALON = { expedition:'Expédition', livraison:'Livraison',
                      deadline:'Deadline', evenement:'Événement',
                      prevente:'Prévente' };
const FAMILLES = { hiver:'Hiver', nouveau:'Nouveau',
                   isotherme:'Sacs', autre:'Autre' };
const LIEUX = { tunisie:'Tunisie', chine:'Chine' };
const V = require('./variantes.js');
const C = require('./charge.js');
const D = require('./db.js');
const { TYPES_QC, SECTIONS_CHARTE, TYPES_FIL } = D;
/* Les deux rôles portent leur lieu : ce n'est pas une hiérarchie, c'est un
   partage géographique du travail. Les valeurs stockées restent `admin` et
   `atelier` ; seuls les libellés changent. */
const ROLES = { admin:'Admin QC', atelier:'Atelier Tunisie' };

/**
 * Normalise une URL d'image et demande la TAILLE STRICTEMENT NÉCESSAIRE.
 *
 * L'application n'héberge aucun fichier : elle ne stocke que des liens vers
 * Shopify, Google Drive ou tout autre hébergeur. Les deux CDN acceptent un
 * paramètre de largeur, et la différence est considérable sur une connexion
 * lente — mesuré sur une image Lasclay réelle :
 *
 *   Shopify  168 Ko brut  →  61 Ko en width=400  →  17 Ko en width=200
 *   Drive     39 Ko brut  →  18 Ko en w400       →   6 Ko en w200
 *
 * @param {string} u        l'URL enregistrée
 * @param {number} largeur  largeur voulue en pixels (0 = taille d'origine)
 */
function urlImage(u, largeur = 0) {
  const s = String(u || '').trim();
  if (!s) return '';

  // Google Drive, sous toutes ses formes de partage → lh3, redimensionnable
  const d = s.match(/drive\.google\.com\/file\/d\/([\w-]+)/)
        || s.match(/drive\.google\.com\/open\?id=([\w-]+)/)
        || s.match(/lh3\.googleusercontent\.com\/d\/([\w-]+)/)
        || s.match(/docs\.google\.com\/uc\?[^ ]*id=([\w-]+)/);
  if (d) return `https://lh3.googleusercontent.com/d/${d[1]}`
              + (largeur ? `=w${largeur}` : '');

  // CDN Shopify → paramètre width (l'URL porte déjà souvent un ?v=…)
  if (largeur && /(^|\/\/|\.)cdn\.shopify\.com\//.test(s) && !/[?&]width=/.test(s))
    return s + (s.includes('?') ? '&' : '?') + `width=${largeur}`;

  return s;
}

/**
 * Une URL d'image est-elle acceptable ?
 *
 * On refuse tout ce qui ferait porter le poids du fichier à l'app : une
 * `data:` URI embarque l'image entière dans la base ET dans chaque page
 * servie — exactement ce qu'on veut éviter sur la connexion tunisienne.
 * Seuls http et https passent ; la source reste chez l'hébergeur d'origine.
 */
function urlAcceptable(u) {
  const s = String(u || '').trim();
  if (!s) return false;
  try { return ['http:', 'https:'].includes(new URL(s).protocol); }
  catch { return false; }
}

/**
 * Même règle, plus le seul chemin interne que l'app sert elle-même.
 *
 * Les photos de clients ne sont pas sur un CDN : ce sont des correspondances,
 * et une URL publique les rendrait lisibles par quiconque a le lien. Elles
 * vivent donc dans le dépôt et sortent par `/photo-client/<uuid>.jpg`,
 * derrière la session. Tout le reste tombe sous la règle générale — surtout
 * une « data: » URI, qui ferait porter l'image à chaque page servie.
 */
const PHOTO_INTERNE = /^\/photo-client\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;
function photoRetroAcceptable(u) {
  const s = String(u || '').trim();
  return PHOTO_INTERNE.test(s) || urlAcceptable(s);
}

/**
 * Les photos d'un bris, dans l'ordre où le client les a envoyées.
 *
 * Un même signalement arrive souvent avec trois clichés de la même couture :
 * de loin, de près, la doublure retournée. Les trois ont de la valeur — c'est
 * ce qui fait comprendre le bris à quelqu'un qui n'a jamais tenu la pièce —
 * donc `photo_url` accepte plusieurs adresses séparées par une espace. Une
 * seule adresse, le cas courant, ressort en liste d'un élément.
 */
function photosBris(u) {
  return String(u || '').trim().split(/\s+/).filter(urlAcceptable);
}

/** Largeurs demandées selon le contexte d'affichage. */
const TAILLES = { mini: 160, vignette: 320, galerie: 640, plein: 900 };

/** Balise <img> complète : taille adaptée, chargement différé, pas de fuite de référent. */
function img(url, { largeur, hauteur, alt = '', classe = '', style = '' } = {}) {
  const src = urlImage(url, largeur);
  return `<img src="${e(src)}" alt="${e(alt)}" loading="lazy" decoding="async"`
       + ` referrerpolicy="no-referrer"`
       + (largeur ? ` width="${largeur}"` : '')
       + (hauteur ? ` height="${hauteur}"` : '')
       + (classe ? ` class="${classe}"` : '')
       + (style ? ` style="${style}"` : '') + `>`;
}

/**
 * La pastille produit : la photo de la fiche, 46 px, dans la liste de travail.
 *
 * C'est le seul changement qui rende ces pages vraiment visuelles. Un code
 * comme « MIT-POLAR » demande un aller-retour dans la tête ; la mitaine, non.
 * L'atelier de Tunis reconnaît la pièce avant d'avoir lu le nom, et c'est
 * précisément ce qu'on veut sur une liste de trente lignes.
 *
 * Le coût réseau est nul pour l'app : rien n'est hébergé ici, l'adresse part
 * chez le CDN d'origine avec une largeur de 96 px (deux fois 46, pour les
 * écrans à densité double) — une dizaine de kilo-octets, hors du HTML, et
 * `loading="lazy"` ne les demande que si la ligne arrive à l'écran. Sur la
 * connexion tunisienne, une ligne jamais atteinte ne coûte rien.
 *
 * Sans photo, la silhouette du produit. Avant, c'étaient les deux premières
 * lettres du code — « CA » pour le cache-cou, « MI » pour cinq mitaines
 * différentes : un monogramme ne distingue que ce qui commence différemment.
 * La forme, elle, se reconnaît sans lire, et sans coûter une requête. Le code
 * reste en dernier recours, pour un produit qu'on n'a pas encore dessiné.
 */
function miniature(url, code = '', { taille = 46, zoom = null } = {}) {
  const c = 'mini' + (taille === 46 ? '' : ` mini-${taille}`);
  if (urlAcceptable(url)) {
    const vignette = img(url, { largeur: taille * 2, alt: '' });
    return zoom ? `<a class="${c} mini-z" id="r-${zoom.cle}" href="#z-${zoom.cle}"
      title="Agrandir ${e(zoom.titre)}">${vignette}</a>${agrandissement(url, zoom)}`
      : `<span class="${c}">${vignette}</span>`;
  }
  const forme = SIL.cle(code);
  if (forme)
    return `<span class="${c} mini-nu" aria-hidden="true"
      ><i class="sil s-${forme}"></i></span>`;
  return `<span class="${c} mini-nu" aria-hidden="true">${
    e(String(code).replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase())}</span>`;
}

/**
 * L'image agrandie, et le seul geste qui vaille une fois qu'on la regarde.
 *
 * POURQUOI `:target` ET PAS DU JAVASCRIPT. Zéro script client est une
 * contrainte de l'app, pas une préférence : l'atelier retournerait à WhatsApp
 * si les pages pesaient. Une ancre `#z-…` et une règle `:target` font la même
 * chose en CSS, avec en prime la touche Retour du navigateur pour refermer.
 *
 * POURQUOI ELLE NE COÛTE RIEN TANT QU'ON NE CLIQUE PAS. Le panneau est en
 * `display:none` et l'image porte `loading="lazy"` : le navigateur ne la
 * demande qu'au moment où elle devient visible. Trente vignettes ouvertes,
 * c'est trente images de 92 px — pas trente de 900.
 *
 * POURQUOI ELLE EST UN LIEN. Regarder une pièce de près, c'est presque
 * toujours le début d'une question sur la pièce. L'agrandissement mène donc
 * à la fiche, et le dit en toutes lettres sous l'image — une image cliquable
 * qui ne l'annonce pas ne se clique pas.
 *
 * La fermeture ramène à `#r-<clé>`, l'ancre de la vignette : on revient là où
 * on était dans la liste, pas en haut de la page.
 */
function agrandissement(url, { cle, href, titre }) {
  return `<span class="zoom" id="z-${cle}">
    <a class="zoom-fond" href="#r-${cle}" aria-label="Fermer l'aperçu"></a>
    <span class="zoom-f">
      <a class="zoom-i" href="${e(href)}">${
        img(url, { largeur: TAILLES.plein, alt: titre })}
        <span class="zoom-l">${e(titre)} <b>— ouvrir la fiche</b></span></a>
      <a class="zoom-x" href="#r-${cle}" aria-label="Fermer l'aperçu">&times;</a>
    </span>
  </span>`;
}

const dateFR = (d) => {
  if (!d) return '';
  const [a, m, j] = String(d).slice(0, 10).split('-');
  return j && m && a ? `${j}/${m}/${a}` : d;
};

/**
 * « il y a trois jours » — la seule forme qui fasse réagir.
 *
 * Une demande de mise à jour datée du 28 août ne dit rien ; « il y a 6 jours »
 * dit tout. On garde la date exacte en `title`, pour qui veut vérifier.
 */
function depuis(t) {
  if (!t) return '';
  const j = Math.floor((Date.now() - new Date(String(t).replace(' ', 'T') + 'Z'))
                       / 86400000);
  if (!Number.isFinite(j) || j < 0) return "à l'instant";
  return j === 0 ? "aujourd'hui" : j === 1 ? 'hier' : `il y a ${j} jours`;
}

const dateHeureFR = (t) => {
  if (!t) return '';
  const d = new Date(String(t).replace(' ', 'T') + 'Z');
  if (isNaN(d)) return t;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} `
       + `${p(d.getHours())} h ${p(d.getMinutes())}`;
};

/**
 * L'avancement, en anneau. La couleur dit l'état, pas la marque.
 *
 * Avant, tout ce qui n'était ni 0 ni 100 était ambre : un item à 90 % avait
 * l'air aussi inquiétant qu'un item à 10 %. Trois seuils valent mieux — pas
 * commencé, en route, presque fini —, et le vert n'arrive qu'au bout.
 * La couleur ne porte jamais seule : le pourcentage est écrit à côté.
 *
 * POURQUOI UN ANNEAU ET PLUS UNE BARRE. Une barre a besoin de quatre-vingt-dix
 * pixels de large pour se lire ; sur une ligne de tableau, elle mangeait la
 * colonne. Un anneau de vingt pixels dit la même chose dans un carré, et rend
 * la colonne à ce qui compte. La fraction, elle, ne bouge pas : c'est elle
 * qu'on vient lire, l'anneau ne fait que la rendre visible de loin.
 *
 * `pathLength="100"` normalise la circonférence : le tiret vaut alors
 * directement le pourcentage, sans passer par 2πr.
 */
/**
 * La silhouette d'un produit — voir `silhouettes.js` pour le pourquoi.
 *
 * Elle ne remplace jamais le nom, elle le précède : une forme se reconnaît de
 * loin, un nom se lit. Et comme elle ne porte aucune information que le texte
 * à côté ne porte pas déjà, elle est `aria-hidden` : un lecteur d'écran n'a
 * rien à y gagner et tout à y perdre.
 */
function silhouette(code, nom = '') {
  const k = SIL.cle(code, nom);
  return k ? `<i class="sil s-${k}" aria-hidden="true"></i>` : '';
}

function classeAvancement(pct) {
  return pct === 0 ? 'zero' : pct === 100 ? 'plein'
       : pct < 40 ? 'bas' : pct < 80 ? 'part' : 'haut';
}

function jauge(pct) {
  const cls = classeAvancement(pct);
  return `<svg class="don ${cls}" viewBox="0 0 20 20" width="20" height="20"`
       + ` fill="none" stroke-width="4.5" aria-hidden="true">`
       + `<circle class="don-p" cx="10" cy="10" r="7.5" pathLength="100"/>`
       + (pct > 0 ? `<circle class="don-v" cx="10" cy="10" r="7.5" pathLength="100"`
                  + ` stroke="currentColor" stroke-dasharray="${pct} 100"/>` : '')
       + `</svg>`;
}

/**
 * Le même anneau en grand, le pourcentage posé au centre.
 *
 * Le bandeau d'un ordre affichait « 28 % » en corps 42 à côté d'une barre qui
 * disait la même chose : deux objets pour une information. Le chiffre entre
 * dans l'anneau, et le bandeau rend la moitié de sa largeur au compte de
 * pièces — qui est, lui, ce qu'on vient vraiment chercher.
 */
function donutGrand(pct) {
  return `<svg class="don-g ${classeAvancement(pct)}" viewBox="0 0 40 40"
    width="74" height="74" fill="none" stroke-width="4.5"
    role="img" aria-label="${pct} % fait">
    <circle class="don-p" cx="20" cy="20" r="16" pathLength="100"/>
    ${pct > 0 ? `<circle class="don-v" cx="20" cy="20" r="16" pathLength="100"
      stroke="currentColor" stroke-dasharray="${pct} 100"/>` : ''}
    <text class="don-t" x="20" y="20" fill="currentColor"
      font-size="13" font-weight="700" text-anchor="middle"
      dominant-baseline="central">${pct}<tspan class="don-u"> %</tspan></text>
  </svg>`;
}

// ------------------------------------------------------------------- ossature
function page({ titre, user, corps, actif = '', msg = null }) {
  const lien = (h, t, k) =>
    `<a href="${h}"${actif === k ? ' class="on"' : ''}>${t}</a>`;
  // Le compteur de tâches se calcule ici plutôt que d'être passé par chaque vue :
  // une pastille qui ne s'affiche que sur une page ne sert à rien. Une requête
  // indexée par rendu, c'est le prix d'un badge qu'on voit de partout.
  // Un gabarit ne doit jamais faire tomber une page. Sans id — un aperçu, un
  // test — la pastille disparaît simplement.
  const enAttente = user && user.id ? D.compteTaches(user.id) : { n: 0, retard: 0 };
  const lienTaches = `<a href="/taches"${actif === 'taches' ? ' class="on"' : ''}>Tâches${
    enAttente.n ? `<span class="pastille${enAttente.retard ? ' urgent' : ''}"
      >${enAttente.n}</span>` : ''}</a>`;
  return `<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(titre)} — Lasclay MRP</title>
<link rel="stylesheet" href="/style.css?v=${VERSION_CSS}">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/favicon-180.png">
</head><body>
<header class="top"><div class="top-in">
  <a class="marque" href="/">Lasclay <span>MRP</span></a>
  ${user ? `<nav class="top">
    ${lien('/', 'Tableau', 'accueil')}
    ${lien('/ordres', 'Ordres', 'ordres')}
    ${lienTaches}
    <i class="sep"></i>
    ${lien('/produits', 'Produits', 'produits')}
    ${lien('/qualite', 'Qualité', 'qualite')}
    ${lien('/inventaire', 'Inventaire', 'inventaire')}
    ${lien('/besoins', 'Besoins', 'besoins')}
    <i class="sep"></i>
    ${lien('/calendrier', 'Calendrier', 'calendrier')}
    ${lien('/cedule', 'Cédule', 'cedule')}
    <i class="sep"></i>
    ${lien('/suivi', 'Activité', 'suivi')}
  </nav>
  <span class="qui">${lien('/assistant', 'Assistant', 'assistant')} · <a href="/compte"
    >${e(user.nom)}</a> · ${ROLES[user.role] || e(user.role)}
    · <a href="/deconnexion">Sortir</a></span>` : ''}
</div></header>
<main>
${msg ? `<div class="msg ${msg.type}">${e(msg.texte)}</div>` : ''}
${corps}
</main></body></html>`;
}

// ------------------------------------------------------------------ connexion
const vueConnexion = ({ erreur }) => `<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connexion — Lasclay MRP</title><link rel="stylesheet" href="/style.css?v=${VERSION_CSS}">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/favicon-180.png"></head><body>
<div class="connexion">
  <h1 style="margin-bottom:4px">Lasclay <span class="muted">MRP</span></h1>
  <p class="muted" style="margin-bottom:16px">Ordres de production et fiches produits</p>
  ${erreur ? `<div class="msg err">${e(erreur)}</div>` : ''}
  <div class="carte"><form method="post" action="/connexion">
    <div class="champ"><label for="c">Courriel</label>
      <input id="c" type="email" name="courriel" required autofocus autocomplete="username"></div>
    <div class="champ"><label for="m">Mot de passe</label>
      <input id="m" type="password" name="mdp" required autocomplete="current-password"></div>
    <button class="btn" style="width:100%">Se connecter</button>
  </form></div>
</div></body></html>`;



/* ------------------------------------------------------- répartition visuelle
 * « 2 000 mitaines » ne dit pas quoi couper. La barre montre la proportion,
 * les pastilles donnent le compte, et un coloris porte sa vraie teinte —
 * plus vite lu qu'un mot.
 *
 * Rendu côté serveur, sans image ni script : une barre est faite de <i> à
 * largeur calculée, une pastille d'un carré coloré. Ça coûte quelques
 * centaines d'octets par ligne, une fois compressé.
 */
function repartition(v, { compact = false } = {}) {
  if (!v || !v.lignes.length) return '';
  const total = v.somme || 1;

  const chip = (l) => {
    const t = V.teinte(l.nom);
    const type = V.typeVariante(l.nom);
    return `<span class="ch ch-${type}">${t
      ? `<i class="pastille" style="background:${t}"></i>` : ''}<span
      class="ch-n">${e(l.nom)}</span><b>${l.quantite.toLocaleString('fr-CA')}</b></span>`;
  };

  // Une barre par groupe : sans ça, les tailles de tous les coloris se
  // mélangent et la proportion ne veut plus rien dire.
  // Un écart de quelques unités vient de l'arrondi des pourcentages du
  // chiffrier ; un écart de 300 est une question. Ne pas les afficher pareil.
  const notable = Math.abs(v.ecart) > Math.max(2, Math.round(v.quantite * 0.01));

  /**
   * `sommeG` cadre les segments à l'intérieur du groupe ; `part` donne au
   * groupe sa largeur relative à l'item. Sans ce second cadrage, quatre
   * coloris de 923, 274, 204 et 99 s'affichent en quatre barres identiques :
   * chaque chiffre est juste et le dessin ment.
   */
  const barre = (lignes, sommeG, part = 100) => `<div class="rep-barre"
    style="width:${part.toFixed(2)}%">${lignes.map((l, i) => {
    const t = V.teinte(l.nom);
    const part = (l.quantite / (sommeG || 1)) * 100;
    // Sans coloris, on échelonne l'accent : la nuance suit le rang de taille.
    // Sans coloris, la nuance suit le rang : du plus clair au plus foncé, pour
    // que la proportion reste lisible même quand rien n'a de couleur propre.
    const fond = t || `color-mix(in srgb, var(--vert) ${22 + (i * 70 / Math.max(1, lignes.length - 1))}%, var(--carte))`;
    return `<i style="width:${part.toFixed(2)}%;background:${fond}"
      title="${e(l.nom)} — ${l.quantite.toLocaleString('fr-CA')}"></i>`;
  }).join('')}</div>`;

  const bloc = (g) => {
    const lignes = [...g.lignes].sort((a, b) =>
      V.rangVariante(a.nom) - V.rangVariante(b.nom));
    return `<div class="rep-g">
      ${g.nom ? `<div class="rep-titre">${V.teinte(g.nom)
        ? `<i class="pastille" style="background:${V.teinte(g.nom)}"></i>` : ''}${e(g.nom)}
        <b>${g.somme.toLocaleString('fr-CA')}</b></div>` : ''}
      ${barre(lignes, g.somme, (g.somme / total) * 100)}
      <div class="rep-chips">${lignes.map(chip).join('')}</div>
    </div>`;
  };

  // Dans « À fabriquer », on montre la liste, pas un résumé. La question de
  // cet écran est « par quoi je commence », et on n'y répond pas avec « 20
  // coloris et tailles » : il faut voir que le violet en L, c'est 40 pièces.
  // La barre reste en tête — elle donne la proportion d'un coup d'œil — et les
  // compteurs sont dépliés dessous. Le plus gros item du plan en compte vingt ;
  // en pastilles qui reviennent à la ligne, ça tient en trois lignes d'écran.
  if (compact) {
    // Le libellé nomme les DEUX axes quand le chiffrier les croise, et il les
    // nomme d'après les étiquettes elles-mêmes. « 20 tailles » sur la mitaine
    // polar était faux — ce sont 4 coloris × 5 tailles — et deviner l'axe des
    // groupes à « coloris » l'était tout autant : le manteau croise Homme et
    // Femme, qui ne sont pas des couleurs.
    const AXE = { couleur: 'coloris', pointure: 'pointures', taille: 'tailles',
                  genre: 'coupes', modele: 'modèles', chaleur: 'chaleurs',
                  autre: 'déclinaisons' };
    // Deux axes que le chiffrier croise et que `typeVariante` ne connaît pas,
    // parce qu'ils ne sont ni une couleur ni une taille : la coupe du manteau
    // et le modèle du bandeau. Les appeler « déclinaisons » était juste et ne
    // disait rien.
    const GENRE = /^(homme|femme|enfant|unisexe)$/i;
    const MODELE = /^(sport|torsad)/i;
    // Le sac de couchage se décline en chaleur, pas en taille : le plan écrit
    // « 150 g/m² (0 à 15 °C) » et « 250 g/m² (0 à -18 °C) ».
    const CHALEUR = /g\/m²|°\s*C/i;
    const axe = (noms) => {
      const c = {};
      for (const nom of noms) {
        const t = GENRE.test(nom.trim()) ? 'genre'
                : MODELE.test(nom.trim()) ? 'modele'
                : CHALEUR.test(nom) ? 'chaleur'
                : V.typeVariante(nom);
        c[t] = (c[t] || 0) + 1;
      }
      const [gagnant] = Object.entries(c).sort((a, b) => b[1] - a[1])[0] || [];
      return AXE[gagnant] || 'déclinaisons';
    };
    const n = v.lignes.length;
    const croise = v.groupes.length > 1 && Boolean(v.groupes[0].nom);
    // Les groupes n'ont pas tous le même nombre de lignes — Homme a cinq
    // tailles, Femme en a six. On compte les étiquettes DISTINCTES, pas une
    // moyenne, qui n'existerait nulle part dans le chiffrier.
    const distinctes = new Set(v.lignes.map(l => l.nom)).size;
    const quoi = croise
      ? `${v.groupes.length} ${axe(v.groupes.map(g => g.nom))}`
        + ` × ${distinctes} ${axe(v.lignes.map(l => l.nom))}`
      : `${n} ${axe(v.lignes.map(l => l.nom))}`;
    return `<div class="rep rep-c">
      <div class="rep-tete">
        <span class="rep-rangee">${v.groupes.map(g => barre(
          [...g.lignes].sort((a, b) => V.rangVariante(a.nom) - V.rangVariante(b.nom)),
          g.somme, (g.somme / total) * 100)).join('')}</span>
        <span class="rep-quoi">${quoi}</span>
      </div>
      ${v.groupes.map(g => `<div class="rep-g">
        ${g.nom ? `<div class="rep-titre">${V.teinte(g.nom)
          ? `<i class="pastille" style="background:${V.teinte(g.nom)}"></i>` : ''}${e(g.nom)}
          <b>${g.somme.toLocaleString('fr-CA')}</b></div>` : ''}
        <div class="rep-chips">${[...g.lignes]
          .sort((a, b) => V.rangVariante(a.nom) - V.rangVariante(b.nom))
          .map(chip).join('')}</div>
      </div>`).join('')}
      ${notable ? `<p class="rep-ecart">${v.somme.toLocaleString('fr-CA')} en
        variantes pour ${v.quantite.toLocaleString('fr-CA')} au plan —
        <b>${v.ecart > 0 ? '+' : ''}${v.ecart.toLocaleString('fr-CA')}</b></p>` : ''}
    </div>`;
  }

  return `<div class="rep">
    ${v.groupes.map(bloc).join('')}
    ${notable ? `<p class="rep-ecart">La répartition totalise
      ${v.somme.toLocaleString('fr-CA')} pour ${v.quantite.toLocaleString('fr-CA')}
      au plan. Les deux chiffres viennent du chiffrier ; l'écart n'est pas
      résolu.</p>` : ''}
  </div>`;
}

/* ------------------------------------------------------------------ compte
 * Changer son mot de passe sans passer par un shell. Ça paraît accessoire ;
 * ça ne l'est pas : un mot de passe transmis par message doit pouvoir être
 * changé par celui qui le reçoit, et l'atelier n'a pas de shell.
 */
function vueCompte({ user, msg }) {
  const corps = `
  <div class="entete"><div>
    <h1>Mon compte</h1>
    <p class="muted">${e(user.courriel)} · ${ROLES[user.role] || e(user.role)}</p>
  </div></div>

  <div class="carte" style="max-width:420px">
    <h2>Mon nom</h2>
    <p class="muted" style="font-size:13px;margin:6px 0 14px">C'est lui qui
    signe tes mises à jour dans le suivi. « Admin QC » n'apprend rien quand
    deux personnes partagent le rôle.</p>
    <form method="post" action="/compte/nom">
      <div class="champ"><label for="nom">Nom affiché</label>
        <input id="nom" type="text" name="nom" required minlength="2" maxlength="60"
               value="${e(user.nom)}"></div>
      <button class="btn" style="width:100%">Enregistrer</button>
    </form>
  </div>

  <div class="carte" style="max-width:420px">
    <h2>Unités</h2>
    <p class="muted" style="font-size:13px;margin:6px 0 14px">Les fournisseurs
    écrivent la toile en onces et les longueurs en pouces ; l'atelier travaille
    en métrique. La source ne change pas — seulement ce que tu lis.</p>
    <form method="post" action="/compte/unites">
      <div class="champ"><label for="u">Afficher les mesures en</label>
        <select id="u" name="unites">${Object.entries(U.MODES).map(([cle, lib]) =>
          `<option value="${e(cle)}"${(user.unites || U.MODE_DEFAUT) === cle
            ? ' selected' : ''}>${e(lib)}</option>`).join('')}</select></div>
      <button class="btn" style="width:100%">Enregistrer</button>
    </form>
  </div>

  <div class="carte" style="max-width:420px">
    <h2>Changer mon mot de passe</h2>
    <p class="muted" style="font-size:13px;margin:6px 0 14px">Huit caractères
    minimum. Les sessions ouvertes ailleurs seront fermées — sur les autres
    appareils, il faudra se reconnecter.</p>
    <form method="post" action="/compte">
      <div class="champ"><label for="a">Mot de passe actuel</label>
        <input id="a" type="password" name="ancien" required
               autocomplete="current-password"></div>
      <div class="champ"><label for="n">Nouveau mot de passe</label>
        <input id="n" type="password" name="nouveau" required minlength="8"
               autocomplete="new-password"></div>
      <div class="champ"><label for="n2">Le répéter</label>
        <input id="n2" type="password" name="nouveau2" required minlength="8"
               autocomplete="new-password"></div>
      <button class="btn" style="width:100%">Changer</button>
    </form>
  </div>`;
  return page({ titre: 'Mon compte', user, corps, msg });
}

// ============================================================== tableau de bord
/**
 * La barre de l'assistant, posée en haut de l'accueil.
 *
 * L'assistant a sa page, avec tout le fil. Ici on ne met que ce qui sert à
 * démarrer : une phrase à écrire, et le dernier échange pour qu'on voie qu'il
 * y a quelqu'un au bout. Le reste est à un lien.
 *
 * C'est un formulaire ordinaire — il part et la page revient. Rien à charger,
 * rien qui casse si le JS ne s'exécute pas : l'atelier est au bout d'une
 * connexion lente, et c'est la première chose qu'il voit en arrivant.
 */
/**
 * La barre du volet Produits : fiches, qualité, ce qui casse.
 *
 * Ces trois pages parlent de la même chose — ce qu'on fabrique — et se
 * répondent : la fiche dit de quoi la pièce est faite, le protocole dit quoi
 * vérifier, le mur montre ce qui a cassé quand on ne l'a pas vérifié. Les
 * séparer en trois onglets de tête faisait trois sujets ; les regrouper en
 * fait un seul, qu'on parcourt.
 */
function sousNavProduits(page) {
  const l = (href, texte, cle) =>
    `<a href="${href}"${page === cle ? ' class="on" aria-current="page"' : ''}>${texte}</a>`;
  return `<nav class="sous-nav">
    ${l('/produits', 'Fiches produits', 'fiches')}
    ${l('/qualite', 'Qualité', 'qualite')}
    ${l('/retroactions', 'Rétroactions clients négatives', 'retroactions')}
  </nav>`;
}

function barreAssistant({ user, ia, salut = null }) {
  if (!ia) return '';
  const { dispo, fil, dernier, annulable, gabarits = [] } = ia;
  const ecrit = dernier ? dernier.actions.filter(a => a.defaire) : [];
  const restant = ecrit.filter(a => !a.defait);

  return `<div class="carte ia">
    <div class="ia-tete">
      <h2>${salut ? `${e(salut.bonjour)}` : 'Demander à l\'assistant'}</h2>
      <a class="muted" href="/assistant">Tout le fil →</a>
    </div>
    ${salut ? `<p class="ia-suite">${e(salut.suite)}</p>` : ''}
    ${dispo ? '' : `<p class="msg err">L'assistant n'est pas branché :
      il manque <code>ANTHROPIC_API_KEY</code> côté serveur.</p>`}

    <form method="post" action="/assistant" id="ia-form" class="saisie">
      <input type="hidden" name="fil" value="${e(fil)}">
      <input type="hidden" name="retour" value="/">
      <label for="ia-q" class="sr">Ta demande</label>
      <textarea id="ia-q" name="demande" rows="2" required
        placeholder="Dis ce que tu veux faire — il l'exécute…"${
        dispo ? '' : ' disabled'}></textarea>
      <div class="actions-saisie">
        <button id="ia-envoi" class="primaire"${dispo ? '' : ' disabled'}>Envoyer</button>
      </div>
    </form>

    ${dernier ? `<div class="tour ia-dernier">
      <p class="dem"><b>${e(user.nom)}</b> ${e(dernier.demande)}</p>
      ${dernier.erreur ? `<p class="rep err">${e(dernier.erreur)}</p>`
                       : `<div class="rep">${para(dernier.reponse)}</div>`}
      ${ecrit.length ? `<div class="faits">
        <b>${restant.length ? 'Fait' : 'Annulé'}</b>
        <ul>${ecrit.map(a =>
          `<li${a.defait ? ' class="off"' : ''}>${e(a.resume)}</li>`).join('')}</ul>
        ${restant.length && dernier.id === annulable
          ? `<form method="post" action="/assistant/${dernier.id}/annuler">
             <input type="hidden" name="retour" value="/">
             <button class="lien">Annuler ces ${restant.length} modification${
               restant.length > 1 ? 's' : ''}</button></form>` : ''}
      </div>` : ''}
    </div>`
    : gabarits.length ? `<ul class="exemples ia-ex">${gabarits.map(g =>
        `<li><a href="/assistant?m=${e(g.cle)}">${e(g.libelle)}</a></li>`
      ).join('')}</ul>` : ''}
  </div>

<script>
(function () {
  // Une demande peut prendre dix secondes sur la connexion tunisienne : sans
  // ça on croit que le clic n'a pas pris, et on reclique.
  var f = document.getElementById('ia-form'), b = document.getElementById('ia-envoi');
  if (!f || !b) return;
  f.addEventListener('submit', function () {
    b.disabled = true; b.textContent = 'L\u2019assistant travaille\u2026';
  });
})();
</script>`;
}

/* ------------------------------------------------- la grille des produits
 * « 27 243 pièces à faire » ne dit pas DE QUOI. La question du matin n'est
 * pas combien, c'est lesquels : ce qui est fini, ce qui n'a pas bougé.
 *
 * Une tuile par pièce, la photo en grand, le pourcentage posé dessus. On lit
 * la grille d'un balayage : les vignettes pâles en tête sont ce qui n'a pas
 * commencé, les vertes au bout sont faites. Aucun chiffre à comparer de tête.
 *
 * Les images ne pèsent rien pour l'app — l'adresse part chez le CDN d'origine
 * en 240 px de large, et `loading="lazy"` ne demande que ce qui arrive à
 * l'écran. Sur la connexion tunisienne, la troisième rangée ne coûte rien
 * tant qu'on n'y descend pas.
 */
function tuileProduit(x) {
  const etat = x.pct === 100 ? 'fini' : x.pct === 0 ? 'neuf' : 'route';
  const ailleurs = x.fabrication !== 'tunisie';
  return `<a class="tuile t-${etat}" href="/ordres/${x.ordre_id}#i${x.id}"
    title="${e(x.nom)} — ${x.pct} %">
    <span class="tuile-img">${urlAcceptable(x.photo)
      ? img(x.photo, { largeur: 240, alt: '' })
      : `<span class="tuile-nu">${silhouette(x.code, x.nom)
          || e(String(x.code).replace(/[^A-Za-z0-9]/g, '')
               .slice(0, 2).toUpperCase())}</span>`}
      <b class="tuile-pct">${x.pct}<i>&nbsp;%</i></b>
      ${ailleurs ? `<span class="tuile-lieu">${LIEUX[x.fabrication]
        || e(x.fabrication)}</span>` : ''}
    </span>
    <span class="tuile-b">
      <b class="tuile-code">${silhouette(x.code, x.nom)}${e(x.code)}</b>
      <span class="tuile-q">${x.pct === 100
        ? `${x.quantite.toLocaleString('fr-CA')} faites`
        // « 3 500 sur 3 500 » se lit comme trois mille cinq cents FAITES.
        // C'est le contraire : le mot manquait.
        : `reste <b>${x.restant.toLocaleString('fr-CA')}</b><span class="tq-sur"
            > sur ${x.quantite.toLocaleString('fr-CA')}</span>`}</span>
    </span>
  </a>`;
}

function grilleProduits(apercu) {
  if (!apercu.length) return '';
  const finis  = apercu.filter(x => x.pct === 100).length;
  const neufs  = apercu.filter(x => x.pct === 0).length;
  const encours = apercu.length - finis - neufs;
  return `<div class="carte">
    <div class="entete-liste">
      <h2>Les pièces <span class="cpt">${apercu.length}</span></h2>
      <span class="legende">
        <i class="lg lg-neuf"></i>${neufs} pas commencée${neufs > 1 ? 's' : ''}
        <i class="lg lg-route"></i>${encours} en route
        <i class="lg lg-fini"></i>${finis} finie${finis > 1 ? 's' : ''}
      </span>
    </div>
    <div class="tuiles">${apercu.map(tuileProduit).join('')}</div>
  </div>`;
}

function vueAccueil({ user, ordres, jalons, ia = null, salut = null,
                      attentes = [], apercu = [] }) {
  const enCours = ordres.filter(o => o.statut === 'en_cours' || o.statut === 'planifie');

  /* Un tableau de bord sans chiffre en tête n'est pas un tableau de bord.
   * Quatre nombres : la taille du morceau, où en est l'ensemble, ce qu'on a
   * déjà laissé passer, et le temps avant la prochaine date. C'est ce qu'on
   * vient chercher en ouvrant la page, et jusqu'ici il fallait le
   * reconstituer de tête en lisant deux tableaux. */
  const unites  = enCours.reduce((n, o) => n + (o.unites  || 0), 0);
  const restant = enCours.reduce((n, o) => n + (o.restant || 0), 0);
  const global  = unites ? Math.round((unites - restant) * 100 / unites) : 0;
  const auj = new Date().toISOString().slice(0, 10);
  const prochain = jalons.find(j => j.date >= auj) || null;
  const joursAvant = prochain
    ? Math.round((new Date(prochain.date + 'T00:00:00Z')
                - new Date(auj + 'T00:00:00Z')) / 86400000) : null;
  const passes = jalons.filter(j => j.date < auj).length;

  const corps = `
  <div class="entete"><div>
    <h1>Tableau de bord</h1>
    <p class="muted">${enCours.length} ordre${enCours.length > 1 ? 's' : ''} en cours ou planifié${enCours.length > 1 ? 's' : ''}</p>
  </div>${user.role === 'admin'
    ? `<a class="btn" href="/ordres/nouveau">Nouvel ordre de production</a>` : ''}</div>

  ${unites ? `<div class="chiffres">
    <div class="c"><b>${restant.toLocaleString('fr-CA')}</b>pièces à faire</div>
    <div class="c"><b>${global} %</b>de l'ensemble fait</div>
    <div class="c${passes ? ' alerte' : ''}"><b>${passes}</b>échéance${
      passes > 1 ? 's' : ''} dépassée${passes > 1 ? 's' : ''}</div>
    <div class="c${joursAvant !== null && joursAvant <= 14 ? ' veille' : ''}"
      >${joursAvant === null ? '<b>—</b>rien de daté'
       : `<b>${joursAvant} j</b>avant la prochaine date
          <span class="sec">${e(prochain.titre)} · ${dateFR(prochain.date)}</span>`}</div>
  </div>` : ''}

  ${attentes.length ? `<div class="carte carte-att">
    <h2>En attente de réponse <span class="cpt">${attentes.length}</span></h2>
    <p class="muted" style="margin:0 0 10px">Une question posée sur un lot ne se voit
      que si on ouvre son ordre. Elle est remontée ici jusqu'à ce qu'on y réponde.</p>
    ${attentes.map(a => `<div class="jalon">
      <span class="et et-${a.type === 'demande' ? 'deadline' : 'evenement'}"
        >${a.type === 'demande' ? 'Mise à jour' : 'Question'}</span>
      <span style="flex:1"><a href="/ordres/${a.ordre_id}#i${a.item_id}"
          ><b>${e(a.produit)}</b></a>
        <span class="muted">· ${e(a.numero)}</span>
        ${a.texte ? `<br><span class="muted">${e(a.texte)}</span>` : ''}</span>
      <span class="muted" title="${e(dateHeureFR(a.cree_le))}">${depuis(a.cree_le)}</span>
    </div>`).join('')}
  </div>` : ''}

  ${grilleProduits(apercu)}

  <div class="carte"><h2>Production en cours</h2>
  ${enCours.length ? `<div class="tbl"><table>
    <tr><th>Ordre</th><th>Avancement</th><th class="num">Reste</th><th>Prochaine échéance</th></tr>
    ${enCours.map(o => `<tr>
      <td><a href="/ordres/${o.id}"><b>${e(o.numero)}</b></a><br>
          <span class="muted">${e(o.titre)}</span></td>
      <td><div style="display:flex;align-items:center;gap:8px">
          ${jauge(o.pct)}<span class="pct">${o.pct} %</span></div></td>
      <td class="num"><b>${(o.restant || 0).toLocaleString('fr-CA')}</b><br>
        <span class="muted">${o.items} item${o.items > 1 ? 's' : ''}</span></td>
      <td>${o.prochain
            ? `<span class="et et-${o.prochain.type}">${TYPES_JALON[o.prochain.type]}</span>
               ${dateFR(o.prochain.date)}` : '<span class="muted">—</span>'}</td>
    </tr>`).join('')}
  </table></div>` : `<p class="vide">Aucun ordre en cours.</p>`}
  </div>

  <div class="carte"><h2>Prochaines échéances</h2>
  ${jalons.length ? jalons.map(j => {
      const passe = j.date < new Date().toISOString().slice(0, 10);
      return `<div class="jalon${passe ? ' passe' : ''}">
        <span class="d">${dateFR(j.date)}</span>
        <span class="et et-${j.type}">${TYPES_JALON[j.type]}</span>
        <span style="flex:1">${e(j.titre)}
          <a class="muted" href="/ordres/${j.ordre_id}">· ${e(j.numero)}</a></span>
      </div>`; }).join('')
    : `<p class="vide">Aucune échéance enregistrée.</p>`}
  </div>

  ${barreAssistant({ user, ia, salut })}`;
  return page({ titre: 'Tableau de bord', user, corps, actif: 'accueil' });
}

// ========================================================== contrôle qualité
const ICONE_QC = { critique: '!', probleme: '~', mesure: '=', cyclage: '↻',
                   esthetique: '\u25c8', emballage: '\u25a1' };

/**
 * Un point de protocole.
 *
 * Une mesure se lit d'un coup d'œil — valeur, tolérance, unité alignées. Le
 * reste se lit comme une phrase : la consigne, puis ce qui arrive si on la
 * rate, qui est la seule chose qui la rend convaincante.
 */
/**
 * Le schéma d'un point de contrôle : le dessin qui dit de quoi à quoi.
 *
 * « 24 cm » ne veut rien dire sans le trait. Un point de mesure porte donc
 * l'adresse d'un schéma — jamais le fichier : l'app n'héberge rien, et le CDN
 * de la source le sert redimensionné, ce qui compte sur la ligne tunisienne.
 * Cliquer ouvre la pleine taille, parce que c'est là qu'on lit les cotes.
 */
function schemaQC(q, largeur) {
  const u = String(q.schema_url || '').trim();
  if (!urlAcceptable(u)) return '';
  return `<a class="qc-schema" href="${e(u)}" rel="noopener"
     title="Ouvrir le schéma en taille réelle"><img src="${e(urlImage(u, largeur))}"
     loading="lazy" alt="Schéma — ${e(q.titre)}"></a>`;
}

function pointQC({ q, produitId, editable, action = null, unites }) {
  const mesure = q.type === 'mesure';
  // La cote porte son unité dans une colonne à part : « 1 » + « po ». Le
  // texte du détail, lui, peut en contenir en toutes lettres.
  const cote = U.convertirMesure(q.valeur, q.unite, unites);
  const detail = U.convertir(q.detail, unites);
  const REGLE = { tout: 'toutes les pièces', lot: 'une fois par lot' };
  const regle = q.ech_type === 'ratio' ? `1 pièce sur ${q.ech_valeur}`
              : q.ech_type === 'fixe' ? `${q.ech_valeur} pièces par lot`
              : REGLE[q.ech_type] || '';
  return `<li class="qc qc-${q.type}">
    <div class="qc-quoi">
      <b>${e(q.titre)}</b>
      ${q.produit_id === null ? '<span class="ck-gen">général</span>' : ''}
      ${mesure && q.valeur ? `<span class="qc-val">${e(cote.valeur)}${
        cote.unite ? ' ' + e(cote.unite) : ''}${
        q.tolerance ? ` <span class="qc-tol">± ${e(q.tolerance)}</span>` : ''}</span>` : ''}
      ${q.variante ? `<span class="qc-var">${e(q.variante)}</span>` : ''}
      ${detail ? `<span class="qc-det">${e(detail)}</span>` : ''}
      ${q.consequence ? `<span class="qc-cons">Sinon : ${e(q.consequence)}</span>` : ''}
      ${q.appuis ? `<span class="qc-appui">${q.appuis} signalement${
        q.appuis > 1 ? 's' : ''} sur le terrain</span>` : ''}
      ${schemaQC(q, TAILLES.vignette)}
      ${PIC.planche(q.titre)}
      ${(() => {
        // Les morceaux du pied se joignent par « · ». Les concaténer avec un
        // séparateur en préfixe laisse un « · » orphelin dès que le premier
        // morceau manque — ce qui est le cas général.
        const bouts = [];
        if (regle) bouts.push(`<b>${e(regle)}</b>`);
        if (q.frequence) bouts.push(e(q.frequence));
        if (q.source) bouts.push(e(q.source));
        if (q.auteur) bouts.push(`ajouté par ${e(q.auteur)}`);
        return bouts.length ? `<span class="qc-pied">${bouts.join(' · ')}</span>` : '';
      })()}
    </div>
    ${editable ? (q.produit_id === null && !action
      ? `<form method="post" action="/qualite/${produitId}/${q.id}/hors-sujet"
           class="qc-hs-f">
          <input type="text" name="motif" maxlength="300" required
            placeholder="Pourquoi ça ne s'applique pas ici">
          <button class="lien danger">Écarter d'ici</button></form>`
      : `<form method="post" action="${
          action || `/qualite/${produitId}/${q.id}/supprimer`}">
        <button class="lien danger">Retirer</button></form>`) : ''}
  </li>`;
}

/**
 * La checklist d'un lot : le protocole du produit, à cocher pièce par pièce.
 *
 * Chaque point est un mini-formulaire à deux boutons — conforme, non conforme —
 * plutôt qu'une case et un bouton « enregistrer ». Deux raisons : un clic vaut
 * mieux que deux sur un téléphone d'atelier, et un verdict qui part tout seul
 * ne se perd pas quand la page se recharge sur une connexion capricieuse.
 */
function vueChecklist({ user, msg, ordre, c }) {
  const { item, points, total, verifies, ecarts, restants, complet, vide } = c;

  const ligne = (q) => {
    const fait = Boolean(q.verdict);
    const ko = q.verdict === 'non_conforme';
    return `<li class="ck ${fait ? (ko ? 'ck-ko' : 'ck-ok') : 'ck-attente'}" id="p${q.id}">
      <div class="ck-tete">
        <span class="q-pip q-${q.type}">${ICONE_QC[q.type] || '·'}</span>
        <b>${e(q.titre)}</b>
        ${q.general ? '<span class="ck-gen">général</span>' : ''}
        ${fait ? `<span class="ck-etat">${ko ? 'non conforme' : 'conforme'}</span>` : ''}
      </div>
      ${q.detail ? `<p class="qc-det">${e(q.detail)}</p>` : ''}
      ${q.valeur ? `<p class="ck-cible">Cible <b>${e(q.valeur)}${
        q.unite ? ' ' + e(q.unite) : ''}</b>${
        q.tolerance ? ` ± ${e(q.tolerance)}` : ''}${
        q.variante ? ` · ${e(q.variante)}` : ''}</p>` : ''}
      ${q.consequence ? `<p class="qc-cons">Sinon : ${e(q.consequence)}</p>` : ''}
      ${schemaQC(q, TAILLES.vignette)}
      ${PIC.planche(q.titre)}
      ${q.ech && q.ech.pieces !== null ? `<p class="ck-ech">
        <b>${e(q.ech.texte)}</b>${q.ech.regle ? ` <span>(${e(q.ech.regle)})</span>` : ''}
      </p>` : ''}
      ${q.frequence ? `<p class="qc-pied"><b>${e(q.frequence)}</b></p>` : ''}
      ${fait ? `<p class="ck-signe">${ko ? 'Écart relevé' : 'Vérifié'} par
        ${e(q.verifie_par || '—')} · ${dateHeureFR(q.verifie_le)}
        ${q.releve ? ` · relevé <b>${e(q.releve)}</b>` : ''}
        ${q.pieces_vues ? ` · <b>${Number(q.pieces_vues).toLocaleString('fr-CA')}</b> pièces vues` : ''}
        ${q.note_controle ? `<br><span class="ck-note">${e(q.note_controle)}</span>` : ''}</p>` : ''}
      <form method="post" action="/ordres/${ordre.id}/items/${item.id}/qualite/${q.id}"
            class="ck-form">
        ${q.type === 'mesure' ? `<input name="mesure" class="ck-mes"
          placeholder="Relevé${q.unite ? ' en ' + e(q.unite) : ''}" maxlength="40"
          value="">` : ''}
        ${q.ech && q.ech.pieces > 1 ? `<input name="pieces" class="ck-mes"
          type="number" min="0" max="999999" placeholder="${q.ech.pieces} vues"
          title="Combien de pièces tu as réellement vérifiées">` : ''}
        <input name="note" class="ck-com" maxlength="200"
          placeholder="${ko || !fait ? 'Ce que tu as vu (facultatif)' : 'Note (facultatif)'}">
        <button name="verdict" value="conforme" class="btn-mini"
          >${fait && !ko ? 'Revérifier conforme' : 'Conforme'}</button>
        <button name="verdict" value="non_conforme" class="btn-mini rouge"
          >Non conforme</button>
      </form>
    </li>`;
  };

  const corps = `
  <div class="entete"><div>
    <p class="fil-ariane"><a href="/ordres/${ordre.id}">${e(ordre.numero)}</a> ·
      <a href="/qualite/${item.produit_id}">protocole du produit</a></p>
    <h1>${e(item.code)}</h1>
    <p class="muted">${e(item.nom)} — <b>${item.quantite.toLocaleString('fr-CA')} pièces</b>
      au lot, ${item.avancement} % déclaré. Les échantillons ci-dessous sont
      calculés sur ce volume.</p>
  </div></div>

  ${vide ? `<div class="carte ck-vide">
    <h2>Aucun protocole pour ce produit</h2>
    <p>Rien n'est exigé au contrôle qualité tant que rien n'est écrit. Ce lot
    peut être déclaré fini — mais c'est un trou, pas une permission.</p>
    <a class="btn" href="/qualite/${item.produit_id}">Écrire le protocole</a>
  </div>`
  : `<div class="carte ck-bilan ${ecarts.length ? 'mauvais' : complet ? 'bon' : 'attente'}">
    <div class="chiffres">
      <div class="c"><b>${verifies} / ${total}</b>points vérifiés</div>
      ${ecarts.length ? `<div class="c"><b>${ecarts.length}</b>non-conformité${
        ecarts.length > 1 ? 's' : ''}</div>` : ''}
    </div>
    <p class="verdict-txt">${
      ecarts.length ? `<b>Le lot ne peut pas être déclaré fini.</b> Corrige les
        écarts, puis revérifie les points concernés.`
      : complet ? `<b>Contrôle passé.</b> Le lot peut être déclaré à 100 %.`
      : `<b>${restants.length} point${restants.length > 1 ? 's' : ''} à vérifier</b>
         avant de pouvoir déclarer ce lot fini.`}</p>
  </div>

  <div class="carte">
    <h2>Protocole du lot</h2>
    <p class="sec">Il suit le protocole du produit : un point ajouté après coup
    apparaît ici, même sur un lot déjà avancé.</p>
    <ul class="ck-liste">${points.map(ligne).join('')}</ul>
  </div>`}`;

  return page({ titre: `Qualité — ${item.code}`, user, corps, msg, actif: 'ordres' });
}

/**
 * Le formulaire d'ajout, le même pour un produit et pour le protocole général.
 * Deux copies divergeraient : un champ ajouté d'un côté manquerait de l'autre.
 */
function formulaireQC(action, { general = false } = {}) {
  return `<form method="post" action="${action}" class="qc-form">
    <div class="champ"><label for="qtype${general ? 'g' : ''}">Volet</label>
      <select id="qtype${general ? 'g' : ''}" name="type">
        ${Object.entries(TYPES_QC).map(([k, v]) =>
          `<option value="${k}"${general && k === 'emballage' ? ' selected' : ''}
            >${v}</option>`).join('')}
      </select></div>
    <div class="champ champ-large"><label for="qtitre${general ? 'g' : ''}">Quoi</label>
      <input id="qtitre${general ? 'g' : ''}" name="titre" required maxlength="200"
             placeholder="${general
               ? 'Plier en trois, sachet kraft, étiquette sur le rabat'
               : "Presser le col avant d'insérer l'isolant"}"></div>
    <div class="champ champ-large"><label for="qdetail${general ? 'g' : ''}">Comment</label>
      <input id="qdetail${general ? 'g' : ''}" name="detail" maxlength="500"
             placeholder="Facultatif — le geste, l'outil, le gabarit"></div>
    <div class="champ champ-large"><label for="qcons${general ? 'g' : ''}">Sinon…</label>
      <input id="qcons${general ? 'g' : ''}" name="consequence" maxlength="300"
             placeholder="Ce qui arrive si on le rate"></div>
    <div class="champ"><label for="qval${general ? 'g' : ''}">Valeur</label>
      <input id="qval${general ? 'g' : ''}" name="valeur" maxlength="40" placeholder="4 à 5"></div>
    <div class="champ"><label for="qtol${general ? 'g' : ''}">Tolérance</label>
      <input id="qtol${general ? 'g' : ''}" name="tolerance" maxlength="40" placeholder="0,5"></div>
    <div class="champ"><label for="quni${general ? 'g' : ''}">Unité</label>
      <input id="quni${general ? 'g' : ''}" name="unite" maxlength="20" placeholder="g"></div>
    ${general ? '' : `<div class="champ"><label for="qvar">Taille / variante</label>
      <input id="qvar" name="variante" maxlength="40" placeholder="M"></div>`}
    <div class="champ"><label for="qech${general ? 'g' : ''}">Combien de pièces</label>
      <select id="qech${general ? 'g' : ''}" name="ech_type">
        <option value="">Non précisé</option>
        <option value="ratio">1 pièce sur…</option>
        <option value="fixe">Un nombre fixe</option>
        <option value="tout">Toutes les pièces</option>
        <option value="lot">Une fois par lot</option>
      </select></div>
    <div class="champ"><label for="qechv${general ? 'g' : ''}">Sur / combien</label>
      <input id="qechv${general ? 'g' : ''}" type="number" min="1" max="100000"
             name="ech_valeur" placeholder="20"></div>
    <div class="champ"><label for="qfreq${general ? 'g' : ''}">Autre fréquence</label>
      <input id="qfreq${general ? 'g' : ''}" name="frequence" maxlength="60"
             placeholder="50 lavages à 30 °C"></div>
    <div class="champ"><label for="qsrc${general ? 'g' : ''}">Source</label>
      <input id="qsrc${general ? 'g' : ''}" name="source" maxlength="80"
             placeholder="Rapport d'amélioration BMB"></div>
    <div class="champ champ-large"><label for="qsch${general ? 'g' : ''}">Schéma</label>
      <input id="qsch${general ? 'g' : ''}" name="schema_url" type="url" maxlength="500"
             placeholder="Adresse d'une image — « bas du zipper » est ambigu en mots"></div>
    <button class="btn">Ajouter${general ? ' au protocole général' : ' au protocole'}</button>
  </form>`;
}

const ORIGINES = { client: 'Client', atelier: 'Atelier', retour: 'Retour',
                   essai: 'Essai' };

/**
 * Un bris signalé : le commentaire mot pour mot, la photo, la zone.
 *
 * Le commentaire n'est pas reformulé. « La ganse a lâché après trois
 * semaines » dit plus qu'« usure prématurée de l'attache », et c'est le genre
 * de phrase qui fait écrire une consigne.
 */
function ligneBris({ b, produitId, editable }) {
  const ph = photosBris(b.photo_url);
  return `<li class="br${b.point_id ? '' : ' br-nu'}">
    ${ph.length ? `<a class="br-photo" href="${e(ph[0])}" rel="noopener">
      <img src="${e(urlImage(ph[0], 160))}" alt="Bris signalé${
        b.zone ? ' — ' + e(b.zone) : ''}" loading="lazy">${
      ph.length > 1 ? `<span class="br-n">${ph.length}</span>` : ''}</a>` : ''}
    <div class="br-quoi">
      <div class="br-tete">
        <span class="br-orig br-${b.origine}">${ORIGINES[b.origine] || b.origine}</span>
        ${b.zone ? `<b>${e(b.zone)}</b>` : ''}
        ${b.survenu_le ? `<span class="br-date">${dateFR(b.survenu_le)}</span>` : ''}
      </div>
      ${b.texte ? `<p class="br-txt">« ${e(b.texte)} »</p>` : ''}
      <p class="br-pied">
        ${b.point_id
          ? `A fait écrire : <a href="#">${e(b.point_titre || 'un point')}</a>`
          : '<span class="br-alerte">Aucune consigne n\'en a encore été tirée</span>'}
        ${b.auteur ? ` · saisi par ${e(b.auteur)}` : ''}</p>
      ${editable && !b.point_id ? `
        <form method="post" action="/qualite/${produitId}/bris/${b.id}/consigne"
              class="br-form">
          <input name="titre" required maxlength="200"
                 placeholder="La consigne qui l'évite : « Renforcer l'attache de ganse »">
          <select name="type">
            <option value="critique">Point critique</option>
            <option value="probleme" selected>Problème fréquent</option>
            <option value="cyclage">Cyclage et tests</option>
          </select>
          <button class="btn-mini">En faire un point</button>
        </form>` : ''}
      ${editable ? `<form method="post" action="/qualite/${produitId}/bris/${b.id}/supprimer"
        ><button class="lien danger">Retirer</button></form>` : ''}
    </div>
  </li>`;
}

function navQC(page) {
  const l = (href, texte, cle) =>
    `<a href="${href}"${page === cle ? ' class="on" aria-current="page"' : ''}>${texte}</a>`;
  return `<nav class="sous-nav">
    ${l('/qualite', 'Contrôle qualité', 'accueil')}
    ${l('/qualite/ordres', 'Par ordre de production', 'ordres')}
    ${l('/qualite/produits', 'Par produit', 'produits')}
    ${l('/qualite/general', 'Général', 'general')}
  </nav>`;
}

/**
 * L'accueil du contrôle qualité : par où entrer.
 *
 * Trois portes sur une seule base. « Par ordre » est la première parce que
 * c'est la seule qui porte une ÉCHÉANCE — un conteneur part, et ce qui n'a pas
 * été contrôlé part avec. Les deux autres sont des référentiels : on y va pour
 * savoir, pas pour faire.
 */
function vueQualiteAccueil({ user, msg, aFaire = 0, ordresActifs = 0,
                             produits = 0, general = 0 }) {
  const nb = (n) => Number(n || 0).toLocaleString('fr-CA');
  const porte = (href, titre, sous, chiffre, libelle, classe) => `
    <a class="porte ${classe}" href="${href}">
      <h2>${titre}</h2>
      <p>${sous}</p>
      <span class="porte-cpt"><b>${nb(chiffre)}</b> ${libelle}</span>
    </a>`;

  const corps = `
  ${navQC('accueil')}
  <div class="entete"><div><h1>Contrôle qualité</h1>
    <p class="muted">Ce qu'on vérifie, sur quoi, et ce qui reste à faire</p></div></div>

  <div class="portes">
    ${porte('/qualite/ordres', 'Par ordre de production',
      "Ce qui attend un contrôle, lot par lot. C'est ici qu'on travaille : "
      + 'un conteneur part, et ce qui n\'a pas été contrôlé part avec.',
      aFaire, aFaire > 1 ? 'lots à contrôler' : 'lot à contrôler', 'porte-1')}
    ${porte('/qualite/produits', 'Par produit',
      'Le protocole de chaque pièce : points critiques, cotes, cyclage, '
      + 'emballage. La source de vérité, celle qu\'on consulte.',
      produits, produits > 1 ? 'fiches' : 'fiche', 'porte-2')}
    ${porte('/qualite/general', 'Général',
      'Les gestes qui valent pour toutes les pièces — fils qui dépassent, '
      + 'étiquetage, essais de tenue.',
      general, general > 1 ? 'procédés' : 'procédé', 'porte-3')}
  </div>

  <p class="qc-pied"><a class="lien" href="/retroactions">Ce que les clients ont
    écrit quand ça n'allait pas — 487 rétroactions négatives, par produit</a></p>`;
  return page({ titre: 'Contrôle qualité', user, corps, actif: 'qualite', msg });
}

/** Par produit : les mêmes cartes que l'onglet Produits, vers le protocole. */
function vueQualiteProduits({ user, msg, produits }) {
  const sans = produits.filter(p => !p.points).length;
  const corps = `
  ${navQC('produits')}
  <div class="entete"><div><h1>Protocoles par produit</h1>
    <p class="muted">${produits.length} produit${produits.length > 1 ? 's' : ''}${
      sans ? ` · <b>${sans}</b> sans aucun protocole` : ''}</p></div></div>

  ${sans ? `<p class="sec">Un protocole vide sur un produit qu'on fabrique par
  milliers est l'information la plus utile de cette page : la carte le dit.</p>` : ''}

  ${produits.length ? `<div class="grille">
    ${produits.map(p => `<a class="vignette ${p.points ? '' : 'vgn-vide'}"
        href="/qualite/${p.id}">
      ${p.photo ? img(p.photo, { largeur: TAILLES.vignette, alt: p.nom })
                : `<div class="sans-photo">Pas de photo</div>`}
      <div class="b"><b>${e(p.nom_court || p.nom)}</b>
        <span class="muted">${e(p.code)}</span>
        ${p.points ? `<span class="qc-cpt">
          ${p.critiques ? `<i class="q-critique" title="points critiques">${p.critiques}</i>` : ''}
          ${p.problemes ? `<i class="q-probleme" title="problèmes fréquents">${p.problemes}</i>` : ''}
          ${p.mesures ? `<i class="q-mesure" title="mesures et cotes">${p.mesures}</i>` : ''}
          ${p.cyclages ? `<i class="q-cyclage" title="cyclage et tests">${p.cyclages}</i>` : ''}
          ${p.esthetiques ? `<i class="q-esthetique" title="esthétique et quotidien"
            >${p.esthetiques}</i>` : ''}
        </span>` : '<span class="qc-vide">aucun protocole</span>'}</div>
    </a>`).join('')}
  </div>` : `<div class="carte"><p class="vide">Aucune fiche produit.</p></div>`}`;
  return page({ titre: 'Qualité par produit', user, corps, actif: 'qualite', msg });
}

/**
 * Général : les gestes qui valent pour toutes les pièces.
 *
 * Numérotés, parce qu'un procédé se suit dans un ordre. Chacun porte sa
 * conséquence — c'est elle qui le rend incontestable — et son schéma quand il
 * y en a un.
 */
function vueQualiteGeneral({ user, msg, general = [] }) {
  const corps = `
  ${navQC('general')}
  <div class="entete"><div><h1>Procédés généraux</h1>
    <p class="muted">${general.length} procédé${general.length > 1 ? 's' : ''} ·
    s'appliquent à <b>toutes</b> les pièces</p></div></div>

  <p class="sec">Ces gestes n'appartiennent à aucun produit : couper les fils
  qui dépassent, poser l'étiquette du bon sens, éprouver la tenue. Ils
  apparaissent sur la liste à cocher de <b>chaque</b> lot, sans avoir à être
  réécrits trente fois. Un procédé absurde sur une pièce donnée ne se supprime
  pas — il s'écarte de ce produit-là, depuis sa fiche, avec un motif.</p>

  ${general.length ? `<ol class="procedes">
    ${general.map((q, i) => `<li class="proc proc-${e(q.type)}">
      <div class="proc-num">${i + 1}</div>
      <div class="proc-corps">
        <h3><span class="q-pip q-${e(q.type)}">${ICONE_QC[q.type] || '·'}</span>
          ${e(q.titre)}</h3>
        ${q.detail ? `<p class="proc-det">${e(U.convertir(q.detail, user.unites))}</p>` : ''}
        ${q.valeur ? `<p class="ck-cible">Cible <b>${e(q.valeur)}${
          q.unite ? ' ' + e(q.unite) : ''}</b>${
          q.tolerance ? ` ± ${e(q.tolerance)}` : ''}</p>` : ''}
        ${q.consequence ? `<p class="qc-cons">Sinon : ${e(q.consequence)}</p>` : ''}
        ${schemaQC(q, TAILLES.galerie)}
        ${PIC.planche(q.titre)}
        ${q.frequence ? `<p class="qc-pied"><b>${e(q.frequence)}</b></p>` : ''}
      </div>
    </li>`).join('')}
  </ol>` : `<div class="carte"><p class="vide">Aucun procédé général.
    Ce qui est écrit sans produit s'applique à tous.</p></div>`}`;
  return page({ titre: 'Procédés généraux', user, corps, actif: 'qualite', msg });
}

/** La liste des ordres où il reste du contrôle à faire. */
function vueQCOrdres({ user, msg, ordres }) {
  const nb = (n) => Number(n || 0).toLocaleString('fr-CA');
  const corps = `
  ${navQC('ordres')}
  <div class="entete"><div><h1>Contrôle par ordre de production</h1>
    <p class="muted">${ordres.length} ordre${ordres.length > 1 ? 's' : ''} en cours</p></div></div>

  ${ordres.length ? `<div class="grille-ordres">
    ${ordres.map(o => `<a class="carte-ordre${o.aFaire ? '' : ' fini'}"
        href="/qualite/ordres/${o.id}">
      <h2>${e(o.numero)}</h2>
      <p class="muted">${e(o.titre || '')}</p>
      <div class="co-chiffres">
        <span><b>${nb(o.aFaire)}</b> à contrôler</span>
        <span class="muted"><b>${nb(o.signes)}</b> signé${o.signes > 1 ? 's' : ''}</span>
      </div>
      ${o.ecarts ? `<span class="co-alerte">${o.ecarts} non-conformité${
        o.ecarts > 1 ? 's' : ''} ouverte${o.ecarts > 1 ? 's' : ''}</span>` : ''}
    </a>`).join('')}
  </div>` : `<div class="carte"><p class="vide">Aucun ordre en cours.</p></div>`}`;
  return page({ titre: 'Qualité par ordre', user, corps, actif: 'qualite', msg });
}

/**
 * Un ordre de production, côté contrôle qualité.
 *
 * DEUX VUES sur les mêmes lots, parce qu'on ne s'en sert pas au même moment :
 * les CARTES pour choisir quoi attaquer — on reconnaît une pièce à sa photo
 * bien avant à son code — et la LISTE pour travailler, où chaque point se
 * coche et se commente sans quitter la page.
 *
 * QUATRE CATÉGORIES NON EXCLUSIVES. Un manteau neuf à 1 200 unités est dans
 * les trois : ce sont trois raisons différentes de le regarder de près, et
 * n'en montrer qu'une en cacherait deux. Le compteur de chaque onglet dit
 * combien de lots RESTENT — un lot signé disparaît de partout à la fois.
 */
function vueQCOrdre({ user, msg, ordre, lignes, cat = 'tous', vue = 'cartes',
                      CATS, checklists = {}, ouvert = null }) {
  const nb = (n) => Number(n || 0).toLocaleString('fr-CA');
  const restants = lignes.filter(l => !l.signe);
  const dans = (l, c) => c === 'tous' || l.categories.includes(c);
  const compte = (c) => restants.filter(l => dans(l, c)).length;
  const visibles = restants.filter(l => dans(l, cat));
  const signes = lignes.filter(l => l.signe);

  const onglet = (cle) => {
    const n = compte(cle);
    return `<a href="/qualite/ordres/${ordre.id}?cat=${cle}&vue=${vue}"
      class="qc-onglet${cat === cle ? ' on' : ''}${n ? '' : ' vidé'}"
      ${cat === cle ? 'aria-current="page"' : ''}
      title="${e(CATS[cle].aide)}">${e(CATS[cle].titre)}
      <span class="qc-n">${n}</span></a>`;
  };

  const etat = (l) => l.vide
    ? '<span class="qc-vide">aucun protocole</span>'
    : l.ecarts ? `<span class="et-ko">${l.ecarts} non conforme${l.ecarts > 1 ? 's' : ''}</span>`
    : l.restants ? `<span class="et-attente">${l.verifies}/${l.total} vérifiés</span>`
    : '<span class="et-ok">tout vérifié · à signer</span>';

  // Le lien d'un lot ouvre SA liste de points, dépliée.
  //
  // Il portait « vue=liste » sans « ouvert » : cliquer un produit menait à la
  // liste des trente lots, tous fermés, avec le sien quelque part dedans. Le
  // geste voulait dire « montre-moi ce qu'il y a à contrôler sur celui-là »,
  // et il fallait un second clic pour l'obtenir.
  //
  // Le corps d'un lot (points à cocher, champs de commentaire, compte rendu)
  // pèse ~350 octets compressés. Les rendre tous coûtait 10,7 Ko sur un ordre
  // de 30 lots : le plafond de 12 Ko serait tombé vers 34 lots, et la page
  // aurait cassé le jour où un ordre grossit. Seul le lot demandé par
  // « ouvert » porte son corps ; les autres tiennent en une ligne cliquable.
  // Le poids ne dépend donc plus du nombre de lots.
  const lien = (l) => `/qualite/ordres/${ordre.id}?cat=${cat}&vue=liste`
    + `&ouvert=${l.id}#lot${l.id}`;

  const carte = (l) => `<div class="vignette qc-lot">
    <a href="${lien(l)}">
      ${l.photo ? img(l.photo, { largeur: TAILLES.vignette, alt: l.nom })
                : `<div class="sans-photo">Pas de photo</div>`}
    </a>
    <div class="b">
      <a class="qc-lot-nom" href="${lien(l)}"><b>${e(l.nom)}</b></a>
      <span class="muted">${e(l.code)} · ${nb(l.quantite)} unités</span>
      <span class="qc-etiq">${l.categories.map(c =>
        `<i class="cat cat-${c}" title="${e(CATS[c].aide)}">${e(CATS[c].titre)}</i>`).join('')}</span>
      ${etat(l)}
      <a class="lien" href="/qualite/${l.produit_id}" target="_blank" rel="noopener"
        >Procédé du produit ↗</a>
    </div>
  </div>`;

  const liste = (l) => {
    const c = checklists[l.id];
    const tete = `<span class="lot-nom"><b>${e(l.nom)}</b>
          <span class="muted">${e(l.code)} · ${nb(l.quantite)} unités</span></span>
        ${etat(l)}`;

    // fermé : une ligne, rien de plus — même allure, un lien au lieu d'un pli
    if (ouvert !== l.id)
      return `<a class="lot lot-ferme" id="lot${l.id}" href="${lien(l)}"
        >${tete}<span class="lot-chev" aria-hidden="true">›</span></a>`;

    return `<details class="lot" id="lot${l.id}" open>
      <summary>${tete}</summary>
      <div class="lot-corps">
        <p class="lot-liens">
          <a href="/qualite/${l.produit_id}" target="_blank" rel="noopener"
            >Protocole du produit ↗</a>
          <a href="/qualite/general" target="_blank" rel="noopener">Procédés généraux ↗</a>
          <a href="/ordres/${ordre.id}/items/${l.id}/qualite">Liste à cocher complète</a>
        </p>
        ${c && !c.vide ? `<ul class="ck-sous">
          ${c.points.map(q => `<li class="ck-mini ${q.verdict === 'non_conforme' ? 'ck-ko'
              : q.verdict ? 'ck-ok' : 'ck-attente'}">
            <span class="q-pip q-${e(q.type)}">${ICONE_QC[q.type] || '·'}</span>
            <span class="ck-t">${e(q.titre)}
              ${q.general ? '<span class="ck-gen">général</span>' : ''}
              ${q.valeur ? (($c) => `<span class="ck-cible">${e($c.valeur)}${
                $c.unite ? ' ' + e($c.unite) : ''}</span>`
                )(U.convertirMesure(q.valeur, q.unite, user.unites)) : ''}</span>
            <a class="ck-proc" href="/qualite/${l.produit_id}#p${q.id}"
               target="_blank" rel="noopener" title="Voir le procédé">↗</a>
            <form method="post"
                  action="/ordres/${ordre.id}/items/${l.id}/qualite/${q.id}" class="ck-mf">
              <input type="hidden" name="retour" value="liste">
              <input type="hidden" name="cat" value="${e(cat)}">
              <input name="note" maxlength="200" placeholder="Commentaire ou question">
              <button name="verdict" value="conforme" class="btn-mini">Conforme</button>
              <button name="verdict" value="non_conforme" class="btn-mini rouge">Non</button>
            </form>
          </li>`).join('')}
        </ul>` : `<p class="vide">Aucun protocole pour ce produit — rien n'est exigé.
          C'est un trou, pas une permission.</p>`}
        ${rapportForm({ ordre, l, c })}
      </div>
    </details>`;
  };

  const corps = `
  ${navQC('ordres')}
  <div class="entete"><div>
    <h1>${e(ordre.numero)}</h1>
    <p class="muted">${e(ordre.titre || '')} · <b>${restants.length}</b> lot${
      restants.length > 1 ? 's' : ''} à contrôler${
      signes.length ? ` · ${signes.length} signé${signes.length > 1 ? 's' : ''}` : ''}</p>
  </div>
  <a class="btn sec" href="/qualite/ordres">Tous les ordres</a></div>

  <div class="qc-barre">
    <div class="qc-onglets">${Object.keys(CATS).map(onglet).join('')}</div>
    <div class="qc-vues">
      <a href="/qualite/ordres/${ordre.id}?cat=${cat}&vue=cartes"
         class="${vue === 'cartes' ? 'on' : ''}">Cartes</a>
      <a href="/qualite/ordres/${ordre.id}?cat=${cat}&vue=liste"
         class="${vue === 'liste' ? 'on' : ''}">Liste à cocher</a>
    </div>
  </div>

  ${visibles.length === 0
    ? `<div class="carte"><p class="vide">${restants.length
        ? 'Aucun lot dans cette catégorie.'
        : 'Tout est contrôlé et signé pour cet ordre.'}</p></div>`
    : vue === 'cartes'
      ? `<div class="grille">${visibles.map(carte).join('')}</div>`
      : `<div class="lots">${visibles.map(liste).join('')}</div>`}

  ${signes.length ? `<details class="carte replie">
    <summary><b>${signes.length}</b> lot${signes.length > 1 ? 's' : ''} signé${
      signes.length > 1 ? 's' : ''}</summary>
    <ul class="signes">${signes.map(l => `<li>
      <b>${e(l.nom)}</b> <span class="muted">${e(l.code)} · ${nb(l.quantite)} unités</span>
      <a class="lien" href="/ordres/${ordre.id}/items/${l.id}/qualite">Voir le compte rendu</a>
    </li>`).join('')}</ul>
  </details>` : ''}`;
  return page({ titre: `Qualité — ${ordre.numero}`, user, corps, actif: 'qualite', msg });
}

/**
 * Le compte rendu qui ferme le contrôle d'un lot.
 *
 * Cinquante mots minimum, et le compteur est devant les yeux pendant qu'on
 * écrit — sinon on découvre le refus après avoir tapé « ok, tout est beau ».
 * Le formulaire ne s'affiche que quand la liste est finie : proposer de signer
 * un lot dont six points ne sont pas regardés, c'est inviter à le faire.
 */
function rapportForm({ ordre, l, c }) {
  if (l.signe) return `<p class="lot-signe">Contrôle signé.
    <a class="lien" href="/ordres/${ordre.id}/items/${l.id}/qualite">Voir le compte rendu</a></p>`;
  const pret = !c || c.vide || (!c.restants.length && !c.ecarts.length);
  if (!pret) return `<p class="lot-bloc">${c.ecarts.length
    ? `${c.ecarts.length} non-conformité${c.ecarts.length > 1 ? 's' : ''} à corriger`
    : `${c.restants.length} point${c.restants.length > 1 ? 's' : ''} à vérifier`}
    avant de pouvoir signer.</p>`;
  return `<form class="rapport" method="post"
        action="/ordres/${ordre.id}/items/${l.id}/rapport">
    <h4>Signer le contrôle</h4>
    <p class="muted">Ce que tu as vu : les pièces contrôlées, ce qui allait, ce
    qui a demandé une reprise. <b>${MOTS_RAPPORT} mots minimum</b> — dans six mois,
    quand un client signalera une couture, ce texte sera la seule chose qui dira
    ce qui s'est passé.</p>
    <textarea name="texte" rows="5" required minlength="1"
      placeholder="Sur les 3 500 cache-cous, j'ai contrôlé…"></textarea>
    <input name="medias" placeholder="Adresses de photos ou vidéos, séparées par une espace">
    <button class="btn">Signer le contrôle</button>
  </form>`;
}

function vueProtocole({ user, p, proto, msg, photos = [], bris = null,
                       appuis = {}, ecartes = [] }) {
  const editable = true;   // les deux rôles écrivent : c'est l'atelier qui voit les défauts
  // Chaque point sait combien de bris l'appuient : c'est ce qui le rend
  // incontestable en atelier.
  for (const q of proto.points) q.appuis = appuis[q.id] || 0;
  const volet = (cle, titre, aide) => `<div class="carte">
    <h2><span class="q-pip q-${cle}">${ICONE_QC[cle]}</span> ${titre}
      ${proto.par[cle].length ? `<span class="cpt">${proto.par[cle].length}</span>` : ''}</h2>
    ${proto.par[cle].length
      ? `<ul class="qc-liste">${proto.par[cle].map(q =>
          pointQC({ q, produitId: p.id, editable, unites: user.unites })).join('')}</ul>`
      : `<p class="vide">${aide}</p>`}
  </div>`;

  const corps = `
  <div class="entete"><div>
    <p class="fil-ariane"><a href="/qualite">Contrôle qualité</a> ·
      <a href="/produits/${p.id}">fiche produit</a></p>
    <h1>${silhouette(p.code, p.nom)}${e(p.code)}</h1>
    <p class="muted">${e(p.nom)}</p>
  </div></div>

  ${ecartes.length ? `<details class="carte qc-hs">
    <summary><b>Ne s'applique pas à ce produit</b>
      <span class="cpt">${ecartes.length}</span></summary>
    <p class="sec">Des points du protocole général, écartés d'ici. Ils valent
    toujours pour les autres produits — c'est sur celui-ci qu'ils ne veulent
    rien dire. Ils ne sont pas demandés sur la liste à cocher des lots.</p>
    <ul class="qc-liste">${ecartes.map(x => `<li class="qc qc-hs-l">
      <div class="qc-quoi"><b>${e(x.titre)}</b>
        <span class="ck-gen">général</span>
        <span class="qc-pourquoi">${e(x.motif)}</span>
        <span class="qc-pied">écarté le ${dateFR(x.cree_le)}${
          x.auteur ? ` par ${e(x.auteur)}` : ''}</span></div>
      <form method="post" action="/qualite/${p.id}/${x.point_id}/reprendre">
        <button class="lien">Remettre</button></form>
    </li>`).join('')}</ul>
  </details>` : ''}

  ${photos.length ? `<div class="carte qc-photos">
    ${photos.slice(0, 4).map(ph => `<img src="${e(urlImage(ph.url, 320))}"
      alt="${e(ph.legende || p.nom)}" loading="lazy">`).join('')}
  </div>` : ''}

  ${bris ? `<div class="carte qc-bris">
    <h2>Bris signalés <span class="cpt">${bris.tous.length}</span>
      ${bris.orphelins.length ? `<span class="br-todo">${bris.orphelins.length}
        sans consigne</span>` : ''}</h2>
    <p class="sec">Commentaires clients, photos, retours d'atelier. C'est la
    preuve qui fait écrire une consigne — et une consigne qui cite trois
    signalements ne se discute pas.</p>
    ${bris.tous.length
      ? `<ul class="br-liste">${bris.tous.map(b =>
          ligneBris({ b, produitId: p.id, editable: true })).join('')}</ul>`
      : `<p class="vide">Aucun signalement. Quand un client écrit « la ganse a
         lâché après trois semaines », c'est ici que ça va.</p>`}
    <details class="qc-plus"><summary>Signaler un bris</summary>
      <form method="post" action="/qualite/${p.id}/bris" class="qc-form">
        <div class="champ"><label for="bz">Où ça casse</label>
          <input id="bz" name="zone" maxlength="80" required
                 placeholder="Attache de ganse"></div>
        <div class="champ"><label for="bo">D'où ça vient</label>
          <select id="bo" name="origine">
            ${Object.entries(ORIGINES).map(([k, v]) =>
              `<option value="${k}">${v}</option>`).join('')}
          </select></div>
        <div class="champ"><label for="bd">Quand</label>
          <input id="bd" type="date" name="survenu_le"></div>
        <div class="champ champ-large"><label for="bt">Ce qui a été dit, mot pour mot</label>
          <input id="bt" name="texte" maxlength="600"
                 placeholder="La ganse a lâché après trois semaines d'utilisation normale"></div>
        <div class="champ champ-large"><label for="bp">Photo (adresse web)</label>
          <input id="bp" name="photo_url" maxlength="500" inputmode="url"
                 placeholder="https://…">
          <span class="aide">L'app n'héberge aucune image : colle l'adresse de
          la photo, elle est affichée redimensionnée.</span></div>
        <button class="btn">Enregistrer le signalement</button>
      </form>
    </details>
  </div>` : ''}

  ${volet('critique', 'Points critiques',
    'Rien encore. Ce sont les gestes qu\'on ne peut pas rattraper après coup.')}
  ${volet('probleme', 'Problèmes fréquents',
    'Rien encore. Ce qui revient d\'un lot à l\'autre, et comment l\'éviter.')}
  ${(() => {
    // Les mesures d'une même cote se lisent en tableau, pas en liste : « tour
    // de poitrine » sur six tailles, c'est six lignes d'un même tableau, et
    // les empiler verticalement en cache la logique.
    const l = proto.par.mesure;
    if (!l.length) return volet('mesure', 'Mesures et dimensions',
      'Rien encore. Les cotes à vérifier, avec leur tolérance.');
    const groupes = new Map();
    for (const q of l) {
      const cle = q.titre + '\u0000' + (q.unite || '');
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle).push(q);
    }
    return `<div class="carte">
      <h2><span class="q-pip q-mesure">=</span> Mesures et dimensions
        <span class="cpt">${l.length}</span></h2>
      ${[...groupes.values()].map(g => g.length > 1 && g.every(x => x.variante)
        ? `<div class="mes-bloc">
             <h3>${e(g[0].titre)}${g[0].unite ? ` <span>en ${e(g[0].unite)}</span>` : ''}
               ${g[0].produit_id === null ? '<span class="ck-gen">général</span>' : ''}</h3>
             ${g[0].detail ? `<p class="qc-det">${e(g[0].detail)}</p>` : ''}
             <div class="tbl"><table class="mes-tbl">
               <tr><th>Taille</th><th class="num">Cible</th><th class="num">Tolérance</th><th></th></tr>
               ${g.map(q => `<tr>
                 <td><b>${e(q.variante)}</b></td>
                 <td class="num">${e(q.valeur || '—')}</td>
                 <td class="num">${q.tolerance ? '± ' + e(q.tolerance) : '<span class="muted">—</span>'}</td>
                 <td><form method="post" action="/qualite/${p.id}/${q.id}/supprimer"
                   ><button class="lien danger">Retirer</button></form></td>
               </tr>`).join('')}
             </table></div>
           </div>`
        : `<ul class="qc-liste">${g.map(q =>
            pointQC({ q, produitId: p.id, editable: true,
                      unites: user.unites })).join('')}</ul>`).join('')}
    </div>`;
  })()}
  ${volet('cyclage', 'Cyclage et tests',
    'Rien encore. Lavages, compressions, tenue de l\'isolant.')}
  ${/* Ce volet manquait. Les sept points du protocole général sont tous de
        type « esthetique » : sans lui, ils n'apparaissaient nulle part sur la
        fiche d'un produit — seulement sur la page des procédés généraux, où
        personne ne va avant d'emballer. Un point de contrôle qu'on ne voit
        pas là où on travaille est un point de contrôle qui n'existe pas. */
    volet('esthetique', 'Esthétique et quotidien',
    'Rien encore. Fils, propreté, étiquette, tenue à l\'usage.')}
  ${volet('emballage', 'Emballage et finition',
    'Rien encore. Pliage, sachet, étiquette, mise en carton.')}

  <div class="carte">
    <h2>Ajouter un tableau de mensurations</h2>
    <p class="sec">Une cote, toutes ses tailles d'un coup — ça se recopie d'un
    chiffrier. Sur la checklist d'un lot, chaque taille ne sera exigée que si le
    lot en contient, et son échantillon se calcule sur les pièces de CETTE
    taille : quatre manteaux sur les trente-quatre en L, pas sur les cent
    cinquante du lot.</p>
    <form method="post" action="/qualite/${p.id}/mesures" class="qc-form">
      <div class="champ"><label for="mt">Quelle cote</label>
        <input id="mt" name="titre" required maxlength="200"
               placeholder="Tour de poitrine"></div>
      <div class="champ"><label for="mu">Unité</label>
        <input id="mu" name="unite" maxlength="20" placeholder="cm"></div>
      <div class="champ"><label for="mech">Combien de pièces</label>
        <select id="mech" name="ech_type">
          <option value="ratio">1 pièce sur…</option>
          <option value="fixe">Un nombre fixe</option>
          <option value="tout">Toutes les pièces</option>
          <option value="">Non précisé</option>
        </select></div>
      <div class="champ"><label for="mechv">Sur / combien</label>
        <input id="mechv" type="number" min="1" max="100000" name="ech_valeur"
               value="10"></div>
      <div class="champ champ-large"><label for="mdet">Comment mesurer</label>
        <input id="mdet" name="detail" maxlength="500"
               placeholder="À plat, d'emmanchure à emmanchure, vêtement fermé"></div>
      <div class="champ champ-large"><label for="mtab">Une ligne par taille</label>
        <textarea id="mtab" name="tableau" rows="6" required
          placeholder="Homme / S = 102 ± 1,5&#10;Homme / M = 110 ± 1,5&#10;Homme / L = 118 ± 1,5"
        ></textarea></div>
      <button class="btn">Créer le tableau</button>
    </form>
  </div>

  <div class="carte">
    <h2>Ajouter un point</h2>
    ${formulaireQC(`/qualite/${p.id}`)}
    <p class="sec">« 1 pièce sur 20 » se transforme tout seul en nombre réel
    selon le volume du lot : 5 pièces sur un lot de 100, 175 sur un lot de
    3 500. Personne ne devrait faire la division en ayant les pièces en main.</p>
  </div>`;

  return page({ titre: `Qualité — ${p.code}`, user, corps, msg, actif: 'qualite' });
}

// ==================================================================== tâches
/**
 * Les tâches qu'on se demande d'un bord à l'autre.
 *
 * Trois listes, dans l'ordre où on les regarde : ce qui m'attend, ce que
 * j'ai demandé, ce qui n'a personne. La quatrième — ce qui est fait — est
 * repliée : elle sert à vérifier, pas à travailler.
 */
function ligneTache({ t, user, ou }) {
  const auj = new Date().toISOString().slice(0, 10);
  const retard = t.statut === 'a_faire' && t.echeance && t.echeance < auj;
  const mien = t.assigne_a === user.id;
  return `<li class="tk${retard ? ' tk-retard' : ''}${t.statut === 'faite' ? ' tk-faite' : ''}">
    <div class="tk-quoi">
      <b>${e(t.titre)}</b>
      ${t.details ? `<span class="tk-det">${e(t.details)}</span>` : ''}
      <span class="tk-qui">
        ${t.echeance ? `<span class="tk-date${retard ? ' en-retard' : ''}">${
          retard ? 'en retard · ' : ''}${dateFR(t.echeance)}</span>` : ''}
        ${ou === 'moi' ? `demandé par ${e(t.demandeur || 'quelqu\'un')}`
          : ou === 'sansPorteur' ? 'personne ne l\'a prise'
          : `pour ${e(t.porteur || 'personne')}`}
        ${t.ordre_numero ? `· <a href="/ordres/${t.ordre_id}">${e(t.ordre_numero)}</a>` : ''}
        ${t.produit_code ? `· <a href="/produits/${t.produit_id}">${e(t.produit_code)}</a>` : ''}
        ${t.statut === 'faite' ? `· fait par ${e(t.porteur || '—')}` : ''}
      </span>
    </div>
    <div class="tk-actions">
      ${t.statut === 'a_faire' ? `
        ${mien || !t.assigne_a ? `<form method="post" action="/taches/${t.id}/faite">
          <button class="btn-mini">${mien ? 'Fait' : 'Je la prends et c\'est fait'}</button>
        </form>` : ''}
        ${!t.assigne_a ? `<form method="post" action="/taches/${t.id}/prendre">
          <button class="lien">Je la prends</button></form>` : ''}`
      : `<form method="post" action="/taches/${t.id}/rouvrir">
           <button class="lien">Rouvrir</button></form>`}
      ${t.cree_par === user.id ? `<form method="post" action="/taches/${t.id}/supprimer">
        <button class="lien danger">Supprimer</button></form>` : ''}
    </div>
  </li>`;
}

function vueTaches({ user, msg, pourMoi, demandees, orphelines, faites, equipe }) {
  const liste = (titre, l, ou, vide) => `<div class="carte">
    <h2>${titre}${l.length ? ` <span class="cpt">${l.length}</span>` : ''}</h2>
    ${l.length ? `<ul class="taches">${l.map(t =>
      ligneTache({ t, user, ou })).join('')}</ul>`
    : `<p class="vide">${vide}</p>`}
  </div>`;

  const corps = `
  <div class="entete"><div><h1>Tâches</h1>
    <p class="muted">Ce qu'on se demande d'un bord à l'autre</p></div></div>

  <div class="carte">
    <h2>Demander quelque chose</h2>
    <form method="post" action="/taches" class="tk-form">
      <div class="champ"><label for="tt">Quoi</label>
        <input id="tt" name="titre" required maxlength="200"
               placeholder="Vérifier le stock de molleton noir"></div>
      <div class="champ"><label for="ta">À qui</label>
        <select id="ta" name="assigne_a">
          <option value="">Personne pour l'instant</option>
          ${equipe.map(m => `<option value="${m.id}"${m.id === user.id ? ' selected' : ''}
            >${e(m.nom)}${m.id === user.id ? ' (moi)' : ''} — ${ROLES[m.role]}</option>`).join('')}
        </select></div>
      <div class="champ"><label for="te">Pour quand</label>
        <input id="te" type="date" name="echeance"></div>
      <div class="champ champ-large"><label for="td">Précisions</label>
        <input id="td" name="details" maxlength="500"
               placeholder="Facultatif — ce qu'il faut savoir pour la faire"></div>
      <button class="btn">Ajouter</button>
    </form>
  </div>

  ${liste('Pour moi', pourMoi, 'moi', 'Rien ne t\'attend.')}
  ${liste('Ce que j\'ai demandé', demandees, 'demandees',
          'Tu n\'as rien demandé à personne.')}
  ${orphelines.length
    ? liste('Sans porteur', orphelines, 'sansPorteur', '')
    : ''}

  ${faites.length ? `<details class="carte">
    <summary><h2 style="display:inline">Faites <span class="cpt">${faites.length}</span></h2></summary>
    <ul class="taches">${faites.map(t =>
      ligneTache({ t, user, ou: 'faites' })).join('')}</ul>
  </details>` : ''}`;

  return page({ titre: 'Tâches', user, corps, msg, actif: 'taches' });
}

// ============================================================ liste des ordres
function vueOrdres({ user, ordres, msg }) {
  const corps = `
  <div class="entete"><div><h1>Ordres de production</h1>
    <p class="muted">${ordres.length} ordre${ordres.length > 1 ? 's' : ''}</p></div>
    ${user.role === 'admin'
      ? `<a class="btn" href="/ordres/nouveau">Nouvel ordre</a>` : ''}</div>
  <div class="carte">
  ${ordres.length ? `<div class="tbl"><table>
    <tr><th>Numéro</th><th>Titre</th><th>Statut</th><th>Avancement</th>
        <th class="num">Items</th><th>Créé</th></tr>
    ${ordres.map(o => `<tr>
      <td><a href="/ordres/${o.id}"><b>${e(o.numero)}</b></a></td>
      <td>${e(o.titre)}</td>
      <td><span class="et et-${o.statut}">${STATUTS[o.statut]}</span></td>
      <td><div style="display:flex;align-items:center;gap:8px">
          ${jauge(o.pct)}<span class="pct">${o.pct} %</span></div></td>
      <td class="num">${o.items}</td>
      <td class="muted">${dateFR(o.cree_le)}</td>
    </tr>`).join('')}
  </table></div>` : `<p class="vide">Aucun ordre de production.</p>`}
  </div>`;
  return page({ titre: 'Ordres de production', user, corps, actif: 'ordres', msg });
}

/**
 * Le fil d'un item : ce qui se dit sur CE lot-là.
 *
 * Une question posée dans la carte « Commentaires » du bas se perd — trois
 * semaines plus tard, personne ne sait de quel produit elle parlait. Ici elle
 * est collée à sa ligne, à côté de la quantité et de l'avancement.
 *
 * Ce qui attend une réponse reste DEHORS du repli. Le reste se replie : une
 * conversation de douze messages ne doit pas repousser les quatre autres
 * produits hors de l'écran, mais une question sans réponse doit se voir sans
 * qu'on ait à cliquer, sinon elle n'appelle personne.
 */
function filItemBloc({ o, it, f, user, enEdition = 0 }) {
  const admin = user.role === 'admin';
  const base = `/ordres/${o.id}/items/${it.id}`;
  const lignes = f?.lignes || [];
  const ouvertes = f?.ouvertes || [];
  const demande = f?.demande || null;

  // Ce qui attend, en évidence. Une demande de mise à jour se distingue d'une
  // question : elle n'appelle pas une phrase, elle appelle un chiffre.
  const attente = ouvertes.map(x => `<div class="fil-att fil-${x.type}">
      <b>${x.type === 'demande' ? 'Mise à jour demandée' : 'Question'}</b>
      <span class="fil-quand" title="${e(dateHeureFR(x.cree_le))}">${depuis(x.cree_le)}${
        x.type === 'demande'
          ? ' · se referme dès qu\'un avancement est déclaré' : ''}</span>
      ${x.texte ? `<span class="fil-tx">${e(x.texte)}</span>` : ''}
      <form method="post" action="${base}/fil/${x.id}/regler">
        <button class="lien">Réglé</button></form>
    </div>`).join('');

  // On ne corrige que ses propres mots. Se faire réécrire par quelqu'un
  // d'autre ferait du fil une trace sans valeur — et c'est justement comme
  // trace qu'il sert, trois semaines plus tard.
  const sien = (x) => x.utilisateur_id === user.id;

  const messages = lignes.map(x => {
    const signature = `<div class="qui2">${e(x.auteur || 'Inconnu')} · ${dateHeureFR(x.cree_le)}
        ${x.type !== 'note' ? ` · ${TYPES_FIL[x.type]}` : ''}
        ${x.regle_le ? ` · réglée${x.regleur ? ` par ${e(x.regleur)}` : ''}` : ''}
        ${x.modifie_le ? ` · <span title="${e(dateHeureFR(x.modifie_le))}">modifié</span>` : ''}
      </div>`;

    // Corriger se fait SUR PLACE, dans le fil : sans JS, c'est un aller-retour
    // par l'URL, et la page revient avec ce message-là devenu formulaire.
    if (x.id === enEdition && sien(x)) return `<div class="comm fil-l fil-${x.type} fil-edit">
      ${signature}
      <form method="post" action="${base}/fil/${x.id}/modifier" class="fil-f">
        <textarea name="texte" rows="3" required>${e(x.texte)}</textarea>
        <div class="fil-btn">
          <button class="btn min">Enregistrer</button>
          <a class="btn sec min" href="/ordres/${o.id}#i${it.id}">Annuler</a>
        </div>
      </form>
      <form method="post" action="${base}/fil/${x.id}/supprimer" class="fil-sup"
        onsubmit="return confirm('Supprimer ce message ?')">
        <button class="lien danger">Supprimer</button></form>
    </div>`;

    return `<div class="comm fil-l fil-${x.type}">
      ${signature}
      ${x.texte ? `<p>${e(x.texte)}</p>`
                : `<p class="muted">— sans texte, juste la demande</p>`}
      ${sien(x) ? `<a class="fil-mod"
        href="/ordres/${o.id}?fil=${x.id}#i${it.id}">Modifier</a>` : ''}
    </div>`;
  }).join('');

  // Deux boutons de publication, pas un menu : « noter » et « demander » ne
  // s'écrivent pas pareil, et le choix doit se faire en appuyant.
  const formulaire = `<form method="post" action="${base}/fil" class="fil-f">
    <textarea name="texte" rows="2"
      placeholder="Un tissu qui manque, une couture qui tient mal…"></textarea>
    <div class="fil-btn">
      <button class="btn min" name="type" value="note">Noter</button>
      <button class="btn sec min" name="type" value="question">Poser une question</button>
      ${ouvertes.length ? `<button class="btn sec min" name="type" value="reponse"
        >Répondre et clore</button>` : ''}
    </div>
  </form>`;

  const corrige = lignes.some(x => x.id === enEdition && sien(x));

  return `${attente}
  <details class="fil"${corrige ? ' open' : ''}>
    <summary>Notes et questions${lignes.length
      ? ` <span class="cpt">${lignes.length}</span>` : ''}</summary>
    ${messages || '<p class="vide">Rien n\'a encore été dit sur ce lot.</p>'}
    ${formulaire}
  </details>
  ${admin && !demande ? `<form method="post" action="${base}/demander"
      style="margin-top:8px">
      <button class="btn sec min">Demander une mise à jour</button></form>` : ''}`;
}

// =================================================== DÉTAIL D'UN ORDRE (clé)
function vueOrdre({ user, o, items, jalons, commentaires, produits, pct, msg,
                    qc = {}, fils = {}, enEdition = 0 }) {
  const admin = user.role === 'admin';
  const auj = new Date().toISOString().slice(0, 10);
  // « 28 % » ne dit pas s'il reste trois cents pièces ou vingt-six mille.
  const total = items.reduce((n, it) => n + it.quantite, 0);
  const fait  = Math.round(items.reduce((n, it) => n + it.quantite * it.avancement, 0) / 100);

  // sélecteur d'avancement : 0 → 100 par tranches de 10, un simple formulaire
  const selecteur = (it) => `<form class="av" method="post"
      action="/ordres/${o.id}/items/${it.id}/avancement">
    ${[0,10,20,30,40,50,60,70,80,90,100].map(v =>
      `<button name="valeur" value="${v}" class="${
        v === it.avancement ? 'on' : v && v < it.avancement ? 'fait' : ''}"
        title="${v} %">${v}</button>`).join('')}
  </form>`;

  const corps = `
  <div class="entete"><div>
    <h1>${e(o.numero)} <span class="et et-${o.statut}">${STATUTS[o.statut]}</span></h1>
    <p class="muted">${e(o.titre)}</p>
  </div><div class="actions">
    ${admin ? `<a class="btn sec" href="/ordres/${o.id}/modifier">Modifier</a>` : ''}
  </div></div>

  <div class="carte bandeau">
    ${donutGrand(pct)}
    <div class="bandeau-j">
      <p class="muted">${total
        ? `<b>${(total - fait).toLocaleString('fr-CA')}</b> pièces restantes
           sur ${total.toLocaleString('fr-CA')} · pondéré par les quantités`
        : 'Aucune quantité au plan.'}</p>
    </div>
    ${o.note ? `<p class="bandeau-note">${e(o.note)}</p>` : ''}
  </div>

  <div class="carte"><h2>Items à produire</h2>
  ${items.length ? `<div class="tbl tbl-items"><table class="items">
    <thead><tr><th>Produit</th><th class="num">Quantité</th>
        <th style="min-width:290px">Avancement</th>
        <th style="min-width:250px">Notes et questions</th>${admin ? '<th></th>' : ''}</tr></thead>
    <tbody>
    ${items.map(it => `<tr id="i${it.id}">
      <td><div class="avec-mini">${miniature(it.photo, it.produit_code, {
        zoom: { cle: `i${it.id}`, href: `/produits/${it.produit_id}`,
                titre: it.produit_nom } })}<div>
        <a href="/produits/${it.produit_id}"><b>${e(it.produit_nom)}</b></a><br>
        <span class="muted">${e(it.produit_code)}</span></div></div></td>
      <td class="num">${it.quantite.toLocaleString('fr-CA')}
        ${it.variantes ? repartition(it.variantes) : ''}
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          ${jauge(it.avancement)}<span class="pct">${it.avancement} %</span>
        </div>
        ${selecteur(it)}
        ${(() => {
          // L'état qualité se lit à côté du sélecteur, parce que c'est là qu'on
          // s'apprête à déclarer 100 % et qu'on va se faire refuser.
          const q = qc[it.id];
          if (!q) return '';
          const lien = `/ordres/${o.id}/items/${it.id}/qualite`;
          if (q.vide) return `<div class="ck-etiq ck-rien"><a href="/qualite/${
            it.produit_id}">aucun protocole</a></div>`;
          if (q.ecarts) return `<div class="ck-etiq ck-ko"><a href="${lien}"
            >${q.ecarts} non-conformité${q.ecarts > 1 ? 's' : ''}</a></div>`;
          if (q.complet) return `<div class="ck-etiq ck-ok"><a href="${lien}"
            >contrôle passé · ${q.total}/${q.total}</a></div>`;
          return `<div class="ck-etiq ck-attente"><a href="${lien}"
            >qualité ${q.verifies}/${q.total}</a></div>`;
        })()}
        ${it.maj_le ? `<div class="muted" style="margin-top:4px;font-size:12px">
           Dernière mise à jour ${dateHeureFR(it.maj_le)}</div>` : ''}
      </td>
      <td class="note-c">
        ${it.note ? `<p class="it-note">${e(it.note)}</p>` : ''}
        ${filItemBloc({ o, it, f: fils[it.id], user, enEdition })}
      </td>
      ${admin ? `<td><form method="post" action="/ordres/${o.id}/items/${it.id}/supprimer"
         onsubmit="return confirm('Retirer cet item ?')">
         <button class="btn dgr min">Retirer</button></form></td>` : ''}
    </tr>`).join('')}
    </tbody>
  </table></div>` : `<p class="vide">Aucun item. ${admin ? 'Ajoutez-en un ci-dessous.' : ''}</p>`}

  ${admin ? `<form method="post" action="/ordres/${o.id}/items"
      style="margin-top:14px;padding-top:14px;border-top:1px solid var(--ligne)">
    <div class="rangee">
      <div class="champ" style="flex:2"><label>Produit</label>
        <select name="produit_id" required>
          <option value="">— choisir —</option>
          ${produits.map(p => `<option value="${p.id}">${e(p.code)} · ${e(p.nom)}</option>`).join('')}
        </select></div>
      <div class="champ"><label>Quantité</label>
        <input type="number" name="quantite" min="1" step="1" required placeholder="2000"></div>
      <div class="champ" style="flex:2"><label>Note (optionnel)</label>
        <input type="text" name="note" placeholder="Coloris, précisions…"></div>
      <div class="champ" style="flex:0 0 auto;align-self:flex-end">
        <button class="btn">Ajouter</button></div>
    </div>
  </form>` : ''}
  </div>

  <div class="carte"><h2>Cédule</h2>
  ${jalons.length ? jalons.map(j => `<div class="jalon${j.date < auj ? ' passe' : ''}">
      <span class="d">${dateFR(j.date)}</span>
      <span class="et et-${j.type}">${TYPES_JALON[j.type]}</span>
      <span style="flex:1">${e(j.titre)}${j.note ? `<br><span class="muted">${e(j.note)}</span>` : ''}</span>
      ${admin ? `<form method="post" action="/ordres/${o.id}/jalons/${j.id}/supprimer">
        <button class="btn dgr min">×</button></form>` : ''}
    </div>`).join('') : `<p class="vide">Aucune date enregistrée.</p>`}

  ${admin ? `<form method="post" action="/ordres/${o.id}/jalons"
      style="margin-top:14px;padding-top:14px;border-top:1px solid var(--ligne)">
    <div class="rangee">
      <div class="champ"><label>Date</label>
        <input type="date" name="date" required></div>
      <div class="champ"><label>Type</label>
        <select name="type">
          ${Object.entries(TYPES_JALON).map(([k, v]) =>
            `<option value="${k}">${v}</option>`).join('')}
        </select></div>
      <div class="champ" style="flex:2"><label>Titre</label>
        <input type="text" name="titre" required placeholder="Livraison Québec, lancement prévente…"></div>
      <div class="champ" style="flex:0 0 auto;align-self:flex-end">
        <button class="btn">Ajouter</button></div>
    </div>
  </form>` : ''}
  </div>

  <div class="carte"><h2>Commentaires</h2>
  ${commentaires.length ? commentaires.map(c => `<div class="comm">
      <div class="qui2">${e(c.auteur || 'Inconnu')} · ${dateHeureFR(c.cree_le)}</div>
      <p>${e(c.texte)}</p></div>`).join('')
    : `<p class="vide">Aucun commentaire.</p>`}
  <form method="post" action="/ordres/${o.id}/commentaires" style="margin-top:12px">
    <div class="champ"><label for="tx">Ajouter une explication ou une question</label>
      <textarea id="tx" name="texte" required
        placeholder="Précision sur un tissu, un sens de coupe, un retard…"></textarea></div>
    <button class="btn">Publier</button>
  </form>
  </div>`;
  return page({ titre: o.numero, user, corps, actif: 'ordres', msg });
}

// ===================================================== création / modification
function vueOrdreForm({ user, o = null, msg }) {
  const t = o ? `Modifier ${o.numero}` : 'Nouvel ordre de production';
  const corps = `
  <div class="entete"><h1>${e(t)}</h1></div>
  <div class="carte">
  <form method="post" action="${o ? `/ordres/${o.id}/modifier` : '/ordres/nouveau'}">
    <div class="champ"><label for="ti">Titre — ce qu'on produit</label>
      <input id="ti" type="text" name="titre" required maxlength="160"
        value="${e(o?.titre || '')}" placeholder="Production automne 2026 — cache-cous et tuques"></div>
    <div class="rangee">
      <div class="champ"><label for="st">Statut</label>
        <select id="st" name="statut">
          ${Object.entries(STATUTS).map(([k, v]) =>
            `<option value="${k}"${o?.statut === k ? ' selected' : ''}>${v}</option>`).join('')}
        </select></div>
    </div>
    <div class="champ"><label for="no">Note (contexte, contraintes, instructions)</label>
      <textarea id="no" name="note">${e(o?.note || '')}</textarea></div>
    <div class="actions">
      <button class="btn">${o ? 'Enregistrer' : 'Créer l\'ordre'}</button>
      <a class="btn sec" href="${o ? `/ordres/${o.id}` : '/ordres'}">Annuler</a>
    </div>
  </form>
  ${o ? `<form method="post" action="/ordres/${o.id}/supprimer"
      style="margin-top:16px;padding-top:14px;border-top:1px solid var(--ligne)"
      onsubmit="return confirm('Supprimer définitivement cet ordre et tout son contenu ?')">
      <button class="btn dgr">Supprimer cet ordre</button></form>` : ''}
  </div>
  ${!o ? `<div class="msg info">Après la création, vous ajouterez les items à produire
    et les dates de la cédule sur la page de l'ordre.</div>` : ''}`;
  return page({ titre: t, user, corps, actif: 'ordres', msg });
}

// ================================================================== produits
/**
 * L'échelle réelle d'une pièce, posée sur sa photo.
 *
 * LE PROBLÈME. Les trois cache-cous sont la même pièce en trois tailles, et
 * depuis qu'ils ont chacun leur fiche Shopify, ils portent la même photo de
 * catalogue : trois carrés noirs identiques dans la grille. Le nom les
 * distingue, la photo non — et c'est la photo qu'on regarde en premier.
 *
 * CE QU'ON DESSINE. Pas une infographie inventée : le rectangle est aux cotes
 * relevées au schéma de la charte, à une échelle commune à toute la grille.
 * 29,9 cm fait 33 px, 22,1 en fait 24 — l'écart se voit sans lire. La cote
 * est écrite à côté, parce qu'un dessin ne se mesure pas.
 *
 * POURQUOI ÇA N'APPARAÎT QUE LÀ. Trois produits sur trente-quatre ont leurs
 * deux cotes hors tout en base. Ce sont exactement les trois que leur photo
 * ne distingue pas. Le jour où d'autres cotes entrent, l'indicateur suit ;
 * il ne s'invente rien en attendant.
 */
const PX_PAR_CM = 1.12;

function echelle(p) {
  const n = (v) => { const x = parseFloat(String(v || '').replace(',', '.'));
                     return Number.isFinite(x) && x > 0 ? x : null; };
  const [l, h] = [n(p.cote_l), n(p.cote_h)];
  if (!l || !h) return '';
  const [pl, ph] = [Math.round(l * PX_PAR_CM), Math.round(h * PX_PAR_CM)];
  return `<span class="v-ech" title="Cotes hors tout relevées au schéma de la charte">
    <i style="width:${pl}px;height:${ph}px"></i>
    <b>${e(String(p.cote_l))} × ${e(String(p.cote_h))} cm</b></span>`;
}

function vueProduits({ user, produits, msg }) {
  const corps = `
  ${sousNavProduits('fiches')}
  <div class="entete"><div><h1>Produits</h1>
    <p class="muted">${produits.length} fiche${produits.length > 1 ? 's' : ''}</p></div>
    ${user.role === 'admin'
      ? `<a class="btn" href="/produits/nouveau">Nouvelle fiche</a>` : ''}</div>
  ${produits.length ? `<div class="grille">
    ${produits.map(p => `<a class="vignette" href="/produits/${p.id}">
      <span class="v-img">${p.photo
        ? img(p.photo, { largeur: TAILLES.vignette, alt: p.nom })
        : `<span class="sans-photo">${silhouette(p.code, p.nom)
            || 'Pas de photo'}</span>`}${echelle(p)}</span>
      <div class="b"><b>${e(p.nom_court || p.nom)}</b>
        <span class="muted">${e(p.code)}</span></div>
    </a>`).join('')}
  </div>` : `<div class="carte"><p class="vide">Aucune fiche produit.</p></div>`}`;
  return page({ titre: 'Produits', user, corps, actif: 'produits', msg });
}

/**
 * Une ligne de charte. Un coloris se lit AVEC sa couleur, pas seulement avec
 * son nom : « gris pâle » et « gris foncé » se confondent en mots et jamais à
 * l'œil, et c'est exactement la paire qui se trompe à l'atelier.
 *
 * Le code hexadécimal est écrit dans le texte — `Noir (#1a1a1a)` — plutôt que
 * dans une colonne de plus : la charte reste un texte qu'on lit tel quel dans
 * le TSV, et la pastille n'est qu'un rendu. Un coloris sans code s'affiche
 * sans pastille, ce qui se voit — et dit qu'il manque une référence.
 */
function ligneCharte(section, texte, unites) {
  const t = U.convertir(String(texte || ''), unites);
  if (section !== 'coloris') return `<li>${e(t)}</li>`;
  const m = t.match(/\(#([0-9a-fA-F]{6})\)/);
  const nom = t.replace(/\s*\(#[0-9a-fA-F]{6}\)/, '');
  return `<li class="col">${m
    ? `<span class="pastille" style="background:#${m[1]}"></span>` : ''}${e(nom)}</li>`;
}

/* ============================================================ rétroactions ==
 * Ce que les clients ont écrit, par produit.
 */

const PASTILLE_RETRO = { bris: '🔧', insatisfaction: '😕', ajustement: '📏' };

/**
 * Deux mises en garde qui changent la façon de lire toute cette page.
 *
 * Elles ne sont pas décoratives : sans elles, l'atelier tunisien lit ces
 * plaintes comme un bulletin sur son propre travail, alors que la plupart
 * portent sur des pièces qu'il n'a jamais cousues. Et il les lit comme un
 * verdict général, alors que rien de positif n'a été collecté.
 */
function avertissementHistorique() {
  return `<p class="avis avis-hist"><b>Ce sont des rétroactions négatives,
    et historiques.</b> Seules les plaintes ont été relevées — bris,
    insatisfaction, ajustement : rien de ce que les clients ont écrit de bon
    n'est ici, et l'absence de compliment ne veut donc rien dire. La majorité
    de ces pièces <b>n'ont pas été fabriquées en Tunisie</b> ; elles sont
    incluses par prudence, parce qu'un défaut vu ailleurs peut se répéter
    ici.</p>`;
}

/**
 * Un onglet Rétroactions par produit, groupé par problème.
 *
 * LE GROUPEMENT EST LE SUJET. Dérouler 227 citations à la file ne se lit pas,
 * et pèserait plus lourd que trois fiches produit sur la ligne tunisienne. On
 * montre les problèmes et leur compte ; la matière qualitative ne se déplie
 * qu'au clic, un groupe à la fois.
 */
function vueRetroactions({ user, p, retro, msg, ouvre = null }) {
  const { groupes, total, propres, famille } = retro;
  const deFamille = total - propres;

  // UN SEUL GROUPE PORTE SA MATIÈRE. Les replier tous en gardant leurs
  // citations dans le HTML faisait 15 Ko compressés sur les mitaines, au-delà
  // du plafond de 12 Ko : la page était légère à l'œil et lourde sur le fil.
  // Ici un groupe fermé ne coûte que son titre, et le poids ne dépend plus du
  // nombre de citations.
  const lien = (g) => `/produits/${p.id}/retroactions?ouvre=${
    encodeURIComponent(g.cle)}#g-${e(g.cle)}`;

  const groupe = (g) => {
    const tete = `<span class="retro-pastille r-${e(g.categorie)}" aria-hidden="true"
        >${PASTILLE_RETRO[g.categorie] || '·'}</span>
      <span class="retro-t">${e(g.titre)}</span>
      <span class="retro-n">${g.lignes.length}</span>
      ${g.photos ? `<span class="retro-ph" title="${g.photos} photo(s) de client"
        >${g.photos} 📷</span>` : ''}`;

    if (ouvre !== g.cle)
      return `<a class="retro-g retro-ferme" id="g-${e(g.cle)}" href="${lien(g)}"
        >${tete}<span class="retro-chev" aria-hidden="true">›</span></a>`;

    return `<details class="retro-g" id="g-${e(g.cle)}" open>
    <summary>${tete}</summary>
    <ul class="retro-l">
      ${g.lignes.map(l => `<li${l.de_famille ? ' class="de-famille"' : ''}>
        <blockquote>${e(l.citation)}</blockquote>
        <p class="retro-meta">
          ${l.survenu_le ? `<time>${e(l.survenu_le)}</time>` : ''}
          ${l.de_famille ? `<span class="retro-flou">dit « ${e(l.famille)} »
            sans préciser le modèle</span>` : ''}
        </p>
        ${(() => { const ph = l.listePhotos.filter(photoRetroAcceptable);
          return ph.length ? `<div class="retro-photos">${ph.slice(0, 6).map(u =>
          `<a href="${e(urlImage(u))}" rel="noopener" title="Photo du client">
            ${img(u, { largeur: TAILLES.vignette, alt: 'Photo envoyée par un client' })}</a>`
        ).join('')}${ph.length > 6
          ? `<span class="retro-plus">+${ph.length - 6}</span>` : ''}</div>` : ''; })()}
      </li>`).join('')}
    </ul>
  </details>`;
  };

  const corps = `
  ${sousNavProduits('retroactions')}
  <div class="entete"><div>
    <h1>Rétroactions clients négatives</h1>
    <p class="muted">${e(p.nom_court || p.nom)} · ${e(p.code)} —
      <b>${total}</b> rétroaction${total > 1 ? 's' : ''}</p>
  </div><a class="btn sec" href="/produits/${p.id}">Retour à la fiche</a></div>

  ${total === 0 ? `<div class="carte"><p class="vide">Aucune rétroaction client
    rattachée à ce produit. Ça ne veut pas dire qu'il n'y en a pas : ça veut
    dire que personne n'a écrit en le nommant. Un produit neuf, ou peu vendu,
    est normalement vide ici.</p></div>` : `

  <p class="sec">Les mots des clients, tels qu'ils les ont écrits. Rien d'autre
  n'en sort : ni nom, ni adresse, ni numéro de commande — l'atelier a besoin du
  défaut, pas de la personne. Toucher un problème déplie ce qui a été dit.</p>

  ${avertissementHistorique()}

  ${deFamille ? `<p class="avis">${deFamille} de ces ${total} rétroactions disent
    seulement « ${e(famille)} » sans nommer le modèle. Elles s'affichent sur
    chacun des modèles de la famille, marquées comme telles : rattacher au
    hasard enverrait corriger le mauvais produit.</p>` : ''}

  <div class="retro">${groupes.map(groupe).join('')}</div>`}`;

  return page({ titre: `Rétroactions négatives — ${p.nom_court || p.nom}`, user, corps,
                actif: 'produits', msg });
}

/** La porte d'entrée : quels produits ont de la matière, lesquels n'ont rien. */
function vueRetroactionsIndex({ user, produits, msg }) {
  const avec = produits.filter(p => p.total);
  const sans = produits.filter(p => !p.total);
  const corps = `
  ${sousNavProduits('retroactions')}
  <div class="entete"><div><h1>Rétroactions clients négatives</h1>
    <p class="muted">${avec.length} produit${avec.length > 1 ? 's' : ''} avec de la
      matière · ${sans.length} sans rien</p></div></div>

  <p class="sec">Distillées de 2 282 fils de correspondance. Ce qui est montré,
  c'est le défaut et les mots qui le décrivent — jamais qui l'a écrit.</p>

  ${avertissementHistorique()}

  <div class="grille">
    ${produits.map(p => `<a class="vignette ${p.total ? '' : 'vgn-vide'}"
        href="/produits/${p.id}/retroactions">
      ${p.photo ? img(p.photo, { largeur: TAILLES.vignette, alt: p.nom })
                : '<div class="sans-photo">Pas de photo</div>'}
      <div class="b"><b>${e(p.nom)}</b>
        <span class="muted">${e(p.code)}</span>
        ${p.total ? `<span class="retro-cpt">${p.directes ? `<i>${p.directes}</i>` : ''}
          ${p.deFamille ? `<i class="flou" title="dit « ${e(p.famille)} » sans préciser"
            >+${p.deFamille}</i>` : ''}</span>`
          : '<span class="qc-vide">rien d\'écrit</span>'}</div>
    </a>`).join('')}
  </div>`;
  return page({ titre: 'Rétroactions clients négatives', user, corps, actif: 'produits', msg });
}

function vueProduit({ user, p, photos, materiaux, patrons, ordres, msg, qc = null,
                      charte = null, bris = null, retro = 0,
                      nomenclature = [], stock = null, coutMatiere = null }) {
  const admin = user.role === 'admin';
  const studio = photos.filter(f => f.type === 'studio');
  const contexte = photos.filter(f => f.type === 'contexte');
  // Les schémas ne sont pas des photos produit : ce sont les dessins cotés et
  // les détails d'assemblage du tableau Miro, rapatriés. Ils ont leur bloc, en
  // haut, parce qu'on les regarde AVANT de coudre — pas dans la galerie.
  const schemas = photos.filter(f => f.type === 'schema');
  const galerie = (liste) => `<div class="photos">${liste.map(f => `<figure>
      <a href="${e(urlImage(f.url))}" rel="noopener" title="Voir en taille réelle">
        ${img(f.url, { largeur: TAILLES.galerie, alt: f.legende || p.nom })}</a>
      ${f.legende ? `<figcaption>${e(f.legende)}</figcaption>` : ''}
    </figure>`).join('')}</div>`;

  // Un bris sans consigne est une consigne qui manque : c'est le chiffre qui
  // fait agir, pas le total.
  const nus = bris ? bris.tous.filter(b => !b.point_id).length : 0;

  const corps = `
  ${sousNavProduits('fiches')}
  <div class="entete"><div>
    <h1>${silhouette(p.code, p.nom)}${e(p.nom_court || p.nom)}</h1>
    <p class="muted">${e(p.code)}${p.nom_court && p.nom !== p.nom_court
      ? ` · vendu sous « ${e(p.nom)} »` : ''}</p>
  </div><div class="entete-actions">
    <a class="btn sec" href="/produits/${p.id}/retroactions">Rétroactions négatives${
      retro ? ` <span class="retro-n">${retro}</span>` : ''}</a>
    ${admin ? `<a class="btn sec" href="/produits/${p.id}/modifier">Modifier</a>` : ''}
  </div></div>

  ${schemas.length ? `<div class="carte">
    <h2>Schémas et détails d'atelier</h2>
    <p class="sec">Les dessins de la charte, ici plutôt que dans Miro — l'atelier
      n'a pas à quitter la page, ni à charger un canevas de plusieurs mégaoctets
      sur la ligne tunisienne. Toucher une vignette ouvre la pleine taille.</p>
    <div class="schemas">${schemas.map(f => `<figure>
      <a href="${e(urlImage(f.url))}" rel="noopener" title="Ouvrir en taille réelle">
        ${img(f.url, { largeur: TAILLES.galerie, alt: f.legende || `Schéma — ${p.nom}` })}</a>
      ${f.legende ? `<figcaption>${e(f.legende)}</figcaption>` : ''}
    </figure>`).join('')}</div>
  </div>` : ''}

  ${charte && !charte.vide ? `<div class="carte">
    <h2>Charte produit</h2>
    <p class="sec">De quoi la pièce est faite. C'est ce qu'on lit avant de
      couper — pas ce qu'on vérifie après.</p>
    <div class="charte">${Object.entries(SECTIONS_CHARTE).map(([cle, lib]) =>
      (charte.par[cle] || []).length ? `<section class="ch-${cle}">
        <h3>${lib}</h3>
        <ul>${charte.par[cle].map(c =>
          ligneCharte(cle, c.texte, user.unites)).join('')}</ul>
      </section>` : '').join('')}</div>
  </div>` : ''}

  ${qc ? `<div class="carte qc-rappel">
    <h2><span class="q-pip q-critique">!</span> Contrôle qualité</h2>
    ${qc.total ? `<p class="sec">${qc.total} point${qc.total > 1 ? 's' : ''} au
      protocole${qc.par.critique.length
        ? ` — dont ${qc.par.critique.length} critique${
            qc.par.critique.length > 1 ? 's' : ''}` : ''}.</p>
      ${qc.par.critique.length ? `<ul class="qc-court">${qc.par.critique.slice(0, 3)
        .map(x => `<li><b>${e(x.titre)}</b>${x.consequence
          ? ` <span class="qc-cons">Sinon : ${e(x.consequence)}</span>` : ''}</li>`).join('')}
      </ul>` : ''}`
    : `<p class="vide">Aucun protocole écrit pour ce produit.</p>`}
    <a class="lien" href="/qualite/${p.id}">${qc.total
      ? 'Voir le protocole complet' : 'Écrire le protocole'} →</a>
  </div>` : ''}

  ${studio.length ? `<div class="carte"><h2>Photos studio</h2>${galerie(studio)}</div>` : ''}
  ${contexte.length ? `<div class="carte"><h2>En contexte d'utilisation</h2>
     ${galerie(contexte)}</div>` : ''}
  ${!photos.length ? `<div class="carte"><p class="vide">Aucune photo.</p></div>` : ''}

  ${p.description ? `<div class="carte"><h2>C'est quoi</h2>
     <p style="white-space:pre-wrap;margin:0">${e(p.description)}</p></div>` : ''}
  ${p.usage ? `<div class="carte"><h2>À quoi ça sert, comment ça s'utilise</h2>
     <p style="white-space:pre-wrap;margin:0">${e(p.usage)}</p></div>` : ''}
  ${p.notes_tech ? `<div class="carte"><h2>Notes techniques</h2>
     <p style="white-space:pre-wrap;margin:0">${e(p.notes_tech)}</p></div>` : ''}

  ${materiaux.length ? `<div class="carte"><h2>Matériaux</h2><div class="tbl"><table>
     ${materiaux.map(m => `<tr><td style="width:34%"><b>${e(m.nom)}</b></td>
       <td class="muted">${e(m.detail)}</td></tr>`).join('')}
     </table></div></div>` : ''}

  ${nomenclature.length ? `<div class="carte">
    <h2>Nomenclature <span class="muted">— ce qu'il faut pour en faire un</span></h2>
    <div class="tbl"><table>
     <tr><th>Matière</th><th>Catégorie</th><th class="num">Par unité</th>
         <th class="num">Coût</th><th class="num">En stock</th></tr>
     ${nomenclature.map(n => `<tr>
       <td><a href="/matieres/${n.matiere_id}"><b>${e(n.nom)}</b></a></td>
       <td class="muted">${e(CATEGORIES_M[n.categorie] || n.categorie)}</td>
       <td class="num">${n.consommation === null
         ? '<span class="muted">à chiffrer</span>'
         : qteFR(n.consommation, n.unite)}${n.source === 'a_confirmer'
         ? ' <span class="muted" title="Le chiffrier se contredit sur cette ligne">⚠</span>' : ''}</td>
       <td class="num">${n.cout_par_produit === null ? '<span class="muted">—</span>'
         : n.cout_par_produit.toFixed(2) + ' $'}</td>
       <td class="num">${!n.suivi_stock ? '<span class="muted">n/a</span>'
         : qteFR(n.stock, n.unite)}</td>
     </tr>`).join('')}
     ${coutMatiere && coutMatiere.cout ? `<tr><td colspan="3"><b>Coût matière</b></td>
       <td class="num"><b>${coutMatiere.cout.toFixed(2)} $</b></td><td></td></tr>` : ''}
     </table></div>
    <p class="muted" style="margin:10px 0 0">
      <a href="/besoins?produit=${p.id}&quantite=100">Calculer pour une série</a>
      — combien il en faut pour N unités, et si le stock suffit.</p>
  </div>` : ''}

  ${stock ? `<div class="carte">
    <h2>Stock de produits finis</h2>
    <p style="margin:0 0 10px">
      <b style="font-size:1.3rem">${stock.jamais_compte ? '—' : qteFR(stock.stock)}</b>
      prêt${stock.emplacement ? ` · ${e(stock.emplacement)}` : ''}
      ${stock.seuil_alerte ? `<span class="muted"> · seuil ${qteFR(stock.seuil_alerte)}</span>` : ''}
      ${stock.sous_seuil ? ' <span class="etat bas">sous le seuil</span>' : ''}
      ${stock.jamais_compte ? ' <span class="etat inconnu">jamais compté</span>' : ''}</p>
    <form method="post" action="/produits/${p.id}/mouvements" class="mvt">
      <div class="champ"><label for="mp">Quoi</label>
        <select id="mp" name="motif">
          <option value="production">Production — il en sort de l'atelier</option>
          <option value="expedition">Expédition — il en part</option>
          <option value="inventaire">Comptage — je déclare ce qu'il y a</option>
          <option value="perte">Perte, rebut</option>
        </select></div>
      <div class="champ"><label for="qp">Quantité</label>
        <input id="qp" name="quantite" type="number" min="0" step="1" required></div>
      <div class="champ"><label for="rp">Référence</label>
        <input id="rp" name="reference" type="text" maxlength="60"></div>
      <button class="btn primaire">Enregistrer</button>
    </form>
  </div>` : ''}

  ${patrons.length ? `<div class="carte"><h2>Patrons</h2><div class="tbl"><table>
     <tr><th>Nom</th><th>Format</th><th>Dimensions</th><th>Note</th></tr>
     ${patrons.map(t => `<tr>
       <td>${t.url ? `<a href="${e(t.url)}" rel="noopener">${e(t.nom)}</a>` : `<b>${e(t.nom)}</b>`}</td>
       <td>${e(t.format).toUpperCase()}</td>
       <td>${e(t.dimensions) || '<span class="muted">non déclarées</span>'}</td>
       <td class="muted">${e(t.note)}</td></tr>`).join('')}
     </table></div></div>` : ''}

  ${ordres.length ? `<div class="carte"><h2>Ordres de production</h2><div class="tbl"><table>
     <tr><th>Ordre</th><th class="num">Quantité</th><th>Avancement</th><th>Statut</th></tr>
     ${ordres.map(o => `<tr>
       <td><a href="/ordres/${o.ordre_id}"><b>${e(o.numero)}</b></a><br>
           <span class="muted">${e(o.titre)}</span></td>
       <td class="num">${o.quantite.toLocaleString('fr-CA')}</td>
       <td><div style="display:flex;align-items:center;gap:8px">
           ${jauge(o.avancement)}<span class="pct">${o.avancement} %</span></div></td>
       <td><span class="et et-${o.statut}">${STATUTS[o.statut]}</span></td>
     </tr>`).join('')}
     </table></div></div>` : ''}`;
  return page({ titre: p.nom_court || p.nom, user, corps, actif: 'produits', msg });
}

function vueProduitForm({ user, p = null, photos = [], materiaux = [], patrons = [], msg }) {
  const t = p ? `Modifier ${p.nom_court || p.nom}` : 'Nouvelle fiche produit';
  const ligneRepetee = (n, champs) => champs;

  const corps = `
  <div class="entete"><h1>${e(t)}</h1></div>
  <div class="carte"><form method="post"
      action="${p ? `/produits/${p.id}/modifier` : '/produits/nouveau'}">
    <div class="rangee">
      <div class="champ"><label for="co">Code</label>
        <input id="co" type="text" name="code" required maxlength="40"
          value="${e(p?.code || '')}" placeholder="CC-ADULTE"></div>
      <div class="champ" style="flex:3"><label for="nm">Nom</label>
        <input id="nm" type="text" name="nom" required maxlength="160"
          value="${e(p?.nom || '')}" placeholder="Cache-cou adulte M-L"></div>
    </div>
    <div class="champ"><label for="de">C'est quoi</label>
      <textarea id="de" name="description"
        placeholder="Description courte du produit.">${e(p?.description || '')}</textarea></div>
    <div class="champ"><label for="us">À quoi ça sert, comment ça s'utilise</label>
      <textarea id="us" name="usage"
        placeholder="Usage, enfilage, entretien.">${e(p?.usage || '')}</textarea></div>
    <div class="champ"><label for="nt">Notes techniques</label>
      <textarea id="nt" name="notes_tech"
        placeholder="Sens de coupe, extensibilité, contraintes de montage.">${e(p?.notes_tech || '')}</textarea></div>
    <div class="actions"><button class="btn">${p ? 'Enregistrer' : 'Créer la fiche'}</button>
      <a class="btn sec" href="${p ? `/produits/${p.id}` : '/produits'}">Annuler</a></div>
  </form></div>

  ${p ? `
  <div class="carte"><h2>Photos</h2>
    ${photos.length ? `<div class="tbl"><table>
      <tr><th>Aperçu</th><th>Type</th><th>Légende</th><th></th></tr>
      ${photos.map(f => `<tr>
        <td>${img(f.url, { largeur: TAILLES.mini, alt: '',
            style: 'width:70px;height:50px;object-fit:cover;border-radius:4px;background:#eef0f2' })}</td>
        <td>${f.type === 'studio' ? 'Studio' : 'Contexte'}</td>
        <td class="muted">${e(f.legende)}</td>
        <td><form method="post" action="/produits/${p.id}/photos/${f.id}/supprimer">
          <button class="btn dgr min">×</button></form></td>
      </tr>`).join('')}</table></div>` : '<p class="vide">Aucune photo.</p>'}
    <form method="post" action="/produits/${p.id}/photos"
        style="margin-top:12px;padding-top:12px;border-top:1px solid var(--ligne)">
      <div class="rangee">
        <div class="champ" style="flex:3"><label>URL de l'image</label>
          <input type="url" name="url" required
            placeholder="Lien Google Drive, Shopify, ou toute URL publique"></div>
        <div class="champ"><label>Type</label>
          <select name="type"><option value="studio">Studio</option>
            <option value="contexte">En contexte</option></select></div>
        <div class="champ" style="flex:2"><label>Légende</label>
          <input type="text" name="legende" placeholder="Optionnel"></div>
        <div class="champ" style="flex:0 0 auto;align-self:flex-end">
          <button class="btn">Ajouter</button></div>
      </div>
      <p class="muted" style="margin:6px 0 0">Les liens de partage Google Drive sont
        convertis automatiquement. Le fichier doit être accessible en lecture.</p>
    </form>
  </div>

  <div class="carte"><h2>Matériaux</h2>
    ${materiaux.length ? `<div class="tbl"><table>
      ${materiaux.map(m => `<tr><td style="width:34%"><b>${e(m.nom)}</b></td>
        <td class="muted">${e(m.detail)}</td>
        <td style="width:1%"><form method="post"
          action="/produits/${p.id}/materiaux/${m.id}/supprimer">
          <button class="btn dgr min">×</button></form></td></tr>`).join('')}
      </table></div>` : '<p class="vide">Aucun matériau.</p>'}
    <form method="post" action="/produits/${p.id}/materiaux"
        style="margin-top:12px;padding-top:12px;border-top:1px solid var(--ligne)">
      <div class="rangee">
        <div class="champ"><label>Matériau</label>
          <input type="text" name="nom" required placeholder="Polar 240 g"></div>
        <div class="champ" style="flex:3"><label>Détail</label>
          <input type="text" name="detail" placeholder="Coloris, laize, fournisseur…"></div>
        <div class="champ" style="flex:0 0 auto;align-self:flex-end">
          <button class="btn">Ajouter</button></div>
      </div>
    </form>
  </div>

  <div class="carte"><h2>Patrons</h2>
    ${patrons.length ? `<div class="tbl"><table>
      <tr><th>Nom</th><th>Format</th><th>Dimensions</th><th>Note</th><th></th></tr>
      ${patrons.map(t2 => `<tr>
        <td>${t2.url ? `<a href="${e(t2.url)}" rel="noopener">${e(t2.nom)}</a>` : e(t2.nom)}</td>
        <td>${e(t2.format).toUpperCase()}</td><td>${e(t2.dimensions)}</td>
        <td class="muted">${e(t2.note)}</td>
        <td><form method="post" action="/produits/${p.id}/patrons/${t2.id}/supprimer">
          <button class="btn dgr min">×</button></form></td></tr>`).join('')}
      </table></div>` : '<p class="vide">Aucun patron.</p>'}
    <form method="post" action="/produits/${p.id}/patrons"
        style="margin-top:12px;padding-top:12px;border-top:1px solid var(--ligne)">
      <div class="rangee">
        <div class="champ"><label>Nom</label>
          <input type="text" name="nom" required placeholder="Devant"></div>
        <div class="champ"><label>Format</label>
          <select name="format"><option value="">—</option>
            <option>pdf</option><option>ai</option><option>dxf</option><option>hpgl</option>
          </select></div>
        <div class="champ"><label>Dimensions</label>
          <input type="text" name="dimensions" placeholder="24,5 x 33,6 cm"></div>
        <div class="champ" style="flex:2"><label>Lien</label>
          <input type="url" name="url" placeholder="Google Drive"></div>
        <div class="champ" style="flex:0 0 auto;align-self:flex-end">
          <button class="btn">Ajouter</button></div>
      </div>
      <p class="muted" style="margin:6px 0 0">Inscrire les dimensions réelles évite
        les erreurs d'échelle au traçage.</p>
    </form>
  </div>` : `<div class="msg info">Après la création, vous pourrez ajouter photos,
    matériaux et patrons.</div>`}`;
  return page({ titre: t, user, corps, actif: 'produits', msg });
}

/**
 * Un bloc repliable.
 *
 * La cédule empile six sections dont trois sont des réglages qu'on touche une
 * fois par saison. Les laisser dépliées, c'est faire défiler trois écrans
 * avant d'atteindre le diagramme — et l'atelier consulte cette page sur un
 * téléphone.
 *
 * Le résumé reste lisible replié : un titre seul n'apprend rien, « 20 postes
 * × 8 h = 160 h/jour » dit déjà l'essentiel et évite d'ouvrir pour vérifier.
 *
 * `<details>` fait tout le travail — aucun script, et l'état de pliage n'a pas
 * à survivre au rechargement : ce qui doit être ouvert par défaut l'est.
 */
function pli({ titre, resume = '', corps, ouvert = false, id = '', classe = '' }) {
  return `<details class="carte pli${classe ? ' ' + classe : ''}"${
    ouvert ? ' open' : ''}${id ? ` id="${id}"` : ''}>
    <summary><span class="pli-t">${e(titre)}</span>${resume
      ? `<span class="pli-r">${resume}</span>` : ''}</summary>
    <div class="pli-c">${corps}</div>
  </details>`;
}

// ==================================================================== cédule
/* --------------------------------------------------------------------- Gantt
 * Un diagramme de charge : chaque item occupe l'atelier pendant le temps que
 * sa quantité demande, les uns après les autres, dans l'ordre de fabrication.
 *
 * Il ne sert pas à faire joli. Il sert à répondre à une seule question — est-ce
 * que ça rentre avant l'expédition ? — et à la répondre par non quand c'est
 * non. Le trait rouge est la date d'expédition ; ce qui le dépasse est marqué.
 *
 * Rendu côté serveur, sans script : chaque barre est un <i> dont la position
 * et la largeur sont des pourcentages de la fenêtre. Le tableau défile
 * horizontalement dans son propre cadre — un Gantt est large, la page ne doit
 * pas l'être.
 */
function gantt({ cal, jalons = [], admin = false }) {
  const t = cal.taches.filter(x => x.heures > 0);
  if (!t.length) return '';

  const jourMs = 864e5;
  const d0 = new Date(cal.debut + 'T00:00:00Z');
  // La fenêtre couvre le travail ET les jalons : une échéance hors cadre ne
  // se verrait pas, et c'est justement celle-là qu'il faut voir.
  const bornes = [new Date(cal.fin + 'T00:00:00Z'),
                  ...jalons.map(j => new Date(j.date + 'T00:00:00Z'))];
  const d1 = new Date(Math.max(...bornes.map(x => x.getTime())));
  const total = Math.max(1, (d1 - d0) / jourMs);
  const pos = (iso) => ((new Date(iso + 'T00:00:00Z') - d0) / jourMs / total) * 100;

  // Deux échelles superposées. Les mois donnent le repère large, les semaines
  // donnent la précision dont l'atelier a besoin : « la semaine du 15 » est
  // une consigne, « en octobre » n'en est pas une. Le cadre défile
  // horizontalement, donc la largeur ne coûte rien à la page.
  const mois = [];
  {
    const c = new Date(d0);
    c.setUTCDate(1);
    while (c <= d1) {
      const iso = c.toISOString().slice(0, 10);
      if (c >= d0) mois.push({ iso, x: pos(iso),
        nom: c.toLocaleDateString('fr-CA', { month: 'long', timeZone: 'UTC' }) });
      c.setUTCMonth(c.getUTCMonth() + 1);
    }
  }

  const semaines = [];
  {
    // On part du lundi de la semaine du départ, même s'il précède la fenêtre :
    // sinon la première colonne serait une semaine tronquée sans repère.
    const c = new Date(d0);
    c.setUTCDate(c.getUTCDate() - ((c.getUTCDay() + 6) % 7));
    while (c <= d1) {
      const iso = c.toISOString().slice(0, 10);
      semaines.push({ iso, x: pos(iso), jour: c.getUTCDate(),
        libelle: c.toLocaleDateString('fr-CA',
          { day: 'numeric', month: 'short', timeZone: 'UTC' }) });
      c.setUTCDate(c.getUTCDate() + 7);
    }
  }
  const aujIso = new Date().toISOString().slice(0, 10);
  const xAuj = aujIso >= cal.debut && aujIso <= d1.toISOString().slice(0, 10)
    ? pos(aujIso) : null;

  const SRC = {
    'deux':         'prép. + assemblage',
    'chrono':       'chronométré (partiel)',
    'chrono-total': 'chronométré',
    'bmb':          'prix BMB',
    'cout':         'déduit du coût',
    'estime':       'estimé',
    'aucune':       'inconnu',
  };
  // Le détail des deux étapes, en infobulle : « 17 min prép. + 7 min assemblage ».
  const detail = (t) => {
    const m = (s) => Math.round(s / 60) + ' min';
    const bouts = [];
    if (t.preparation) bouts.push(m(t.preparation) + ' de préparation');
    if (t.assemblage) bouts.push(m(t.assemblage) + " d'assemblage");
    return bouts.join(' + ') || 'aucun temps connu';
  };
  // Les pauses, en bandes : une journée fermée au milieu d'une barre explique
  // pourquoi elle est plus longue qu'on ne l'attendait.
  const fermetures = (cal.pauses || []).map(pz => {
    const x = pos(pz.debut);
    // La fin d'une pause est inclusive : on ajoute un jour pour que la bande
    // couvre bien le dernier jour fermé.
    const finPlus = new Date(new Date(pz.fin + 'T00:00:00Z').getTime() + jourMs)
      .toISOString().slice(0, 10);
    return { x, l: Math.max(0.4, pos(finPlus) - x),
             motif: (pz.motif || 'atelier fermé') + ' — du ' + dateFR(pz.debut)
                    + ' au ' + dateFR(pz.fin) };
  }).filter(f => f.l > 0 && f.x < 100);

  const dernier = jalons.length
    ? jalons.map(j => j.date).sort()[0] : null;   // la première échéance compte

  const ligne = (x) => {
    const g = pos(x.debut), l = Math.max(0.6, pos(x.fin) - g);
    const dehors = dernier && x.fin > dernier;
    return `<tr class="${dehors ? 'g-dehors' : ''}">
      <th scope="row"><a href="/produits/${x.produit_id}">${
        silhouette(x.code, x.nom)}${e(x.code)}</a>
        <span class="g-h">${Math.round(x.heures).toLocaleString('fr-CA')} h
          · ${x.jours} j</span>
        <span class="g-quand">${dateFR(x.debut)} → ${dateFR(x.fin)}</span>
        <span class="g-tags"><span class="g-src g-src-${x.temps.source}"
              title="${e(detail(x.temps))}">${SRC[x.temps.source] || x.temps.source}</span
        >${x.temps.divergent ? `<span class="g-src g-src-alerte"
          title="${e(x.temps.divergent)}">⚠ sources</span>` : ''}</span></th>
      <td><div class="g-piste">
        ${semaines.map(w => `<i class="g-sem" style="left:${w.x}%"></i>`).join('')}
        ${mois.map(m => `<i class="g-mois" style="left:${m.x}%"></i>`).join('')}
        ${fermetures.map(f => `<i class="g-ferme"
           style="left:${f.x}%;width:${f.l}%" title="${e(f.motif)}"></i>`).join('')}
        ${xAuj !== null ? `<i class="g-auj" style="left:${xAuj}%"
           title="aujourd'hui"></i>` : ''}
        ${jalons.map(j => `<i class="g-jalon" style="left:${pos(j.date)}%"
           title="${e(j.titre)} — ${dateFR(j.date)}"></i>`).join('')}
        <i class="g-barre" style="left:${g}%;width:${l}%"
           title="${e(x.code)} — ${dateFR(x.debut)} au ${dateFR(x.fin)}, ${
             x.jours} jour${x.jours > 1 ? 's' : ''} d'atelier"></i>
      </div></td>
    </tr>`;
  };

  return `
    <p class="sec">Chaque item occupe l'atelier le temps que sa quantité
    demande, dans l'ordre de fabrication. Le trait rouge est l'expédition,
    le vert est aujourd'hui.</p>

    <div class="tbl g-cadre"><table class="gantt">
      <thead>
        <tr><th></th><td><div class="g-echelle g-mois-band">
          ${mois.map(m => `<span style="left:${m.x}%">${m.nom}</span>`).join('')}
        </div></td></tr>
        <tr><th><span class="g-leg">semaine du</span></th>
          <td><div class="g-echelle g-sem-band">
          ${semaines.map(w => `<span style="left:${w.x}%">${w.libelle}</span>`).join('')}
        </div></td></tr>
      </thead>
      <tbody>${t.map(ligne).join('')}</tbody>
    </table></div>
    ${fermetures.length ? `<p class="sec" style="margin:8px 0 0">Les bandes
      hachurées sont les fermetures d'atelier. Elles ne suspendent pas le
      travail sur place : elles le repoussent, et tout ce qui suit avec.</p>` : ''}`;
}

function vueCedule({ user, jalons, msg, cal = null }) {
  const auj = new Date().toISOString().slice(0, 10);
  const parMois = {};
  for (const j of jalons) {
    const cle = j.date.slice(0, 7);
    (parMois[cle] ||= []).push(j);
  }
  const nomMois = (c) => {
    const [a, m] = c.split('-');
    return new Date(+a, +m - 1, 1).toLocaleDateString('fr-CA',
      { month: 'long', year: 'numeric' });
  };
  const admin = user.role === 'admin';

  /**
   * Le verdict, avant le dessin. Un Gantt qu'on regarde sans savoir s'il tient
   * est un joli graphique ; la seule question qui compte est « est-ce que ça
   * rentre », et elle se répond en trois nombres.
   */
  const perim = C.perimetre();
  const cap = C.capacite();
  const dep = C.depart();
  const pz = C.pauses();
  const joursDePause = (x) => Math.round(
    (new Date(x.fin + 'T00:00:00Z') - new Date(x.debut + 'T00:00:00Z')) / 864e5) + 1;
  // Les jours réellement retirés à l'atelier : une fermeture du samedi au
  // dimanche ne coûte rien quand on travaille cinq jours.
  const joursFermes = [...C.joursEnPause(pz).keys()].filter(k => {
    const j = new Date(k + 'T00:00:00Z').getUTCDay();
    return j !== 0 && j <= cap.jours_semaine;
  }).length;
  const verdict = () => {
    if (!cal || !cal.taches.length) return '';
    const echeance = jalons.filter(j => j.date >= auj).map(j => j.date).sort()[0];
    const c = cal.cap;
    let dispo = null, jours = 0;
    if (echeance) {
      // Les fermetures se déduisent : « 42 jours ouvrés d'ici l'expédition »
      // est faux si l'atelier ferme deux semaines au milieu, et c'est
      // exactement le genre de faux qui fait dire « ça rentre ».
      jours = C.joursOuvres(auj, echeance, c, C.joursEnPause(pz));
      dispo = jours * c.postes * c.heures_jour;
    }
    const manque = dispo !== null && cal.heuresTotal > dispo;
    const postesRequis = dispo !== null && jours > 0
      ? Math.ceil(cal.heuresTotal / (jours * c.heures_jour)) : null;

    // Ce que les items sans temps connu coûteraient. Une marge de 131 h ne veut
    // rien dire si ce qui n'est pas compté en demande 400 : le verdict doit le
    // dire, sinon « ça rentre » est un piège.
    const inc = C.chargeInconnue(cal.taches);
    const marge = dispo !== null ? dispo - cal.heuresTotal : null;
    const fragile = !manque && marge !== null && inc.connu && inc.median > marge;
    const nb = (h) => Math.round(h).toLocaleString('fr-CA');

    return `<div class="carte ${manque ? 'verdict-non'
      : fragile ? 'verdict-fragile' : 'verdict-oui'}">
      <div class="chiffres">
        <div class="c"><b>${Math.round(cal.heuresTotal).toLocaleString('fr-CA')}</b>heures de travail</div>
        ${dispo !== null ? `<div class="c"><b>${dispo.toLocaleString('fr-CA')}</b>heures disponibles
          <span class="sec">${jours} jours ouvrés d'ici le ${dateFR(echeance)}${
            joursFermes ? `, ${joursFermes} retiré${joursFermes > 1 ? 's' : ''} par les pauses` : ''}</span></div>` : ''}
        <div class="c"><b>${c.postes}</b>postes ${c.defaut
          ? '<span class="sec">équipe annoncée · non confirmée ici</span>' : ''}</div>
        <div class="c"><b style="font-size:15px;line-height:1.3">${
          C.PERIMETRES[perim.valeur]}</b>ce que l'atelier fait ${perim.defaut
          ? '<span class="sec">lecture prudente · non confirmée</span>' : ''}</div>
      </div>
      ${manque ? `<p class="verdict-txt"><b>Ça ne rentre pas.</b> Il manque
        ${nb(cal.heuresTotal - dispo)} heures.
        À ${c.heures_jour} h par jour, il faudrait <b>${postesRequis} postes</b>
        au lieu de ${c.postes} — ou déplacer une partie du plan.</p>`
      : fragile ? `<p class="verdict-txt"><b>Ça rentre sur le papier</b>, avec
        ${nb(marge)} heures de marge — soit
        ${Math.round((marge / dispo) * 100)} % du temps disponible. C'est moins
        que ce que les items non chiffrés demanderaient : la marge ne tient
        probablement pas.</p>`
      : dispo !== null ? `<p class="verdict-txt"><b>Ça rentre</b>, avec
        ${nb(marge)} heures de marge.</p>` : ''}
      ${cal.sansTemps ? `<p class="verdict-note">${cal.sansTemps} items n'ont
        aucun temps connu — ni chronométré, ni déductible d'un coût de
        confection. Ils comptent pour <b>zéro heure</b> dans le total
        ci-dessus.${inc.connu ? ` À leurs ${inc.pieces.toLocaleString('fr-CA')}
        pièces, en leur prêtant les temps des autres items du plan, il faudrait
        <b>entre ${nb(inc.bas)} et ${nb(inc.haut)} heures</b> de plus
        (${nb(inc.median)} h au temps médian). Le seul moyen de trancher est de
        les chronométrer.` : ''}</p>` : ''}
      <p class="verdict-note">Deux étapes, pas deux versions du même chiffre :
      le chronomètre mesure la <b>préparation</b> (coupe, matelassage,
      remplissage, mélange), le prix BMB paie l'<b>assemblage</b>. Tout est
      converti à ${C.TAUX_HORAIRE} $/h, la règle que le suivi Tunisie applique
      aux mitaines polar. Chaque ligne du diagramme dit ce qu'elle contient, et
      signale les sources qui se contredisent.</p>
    </div>

`;
  };

  /** Les hypothèses qui transforment des heures en dates. */
  const reglages = () => `${admin ? pli({
      titre: "Capacité de l'atelier",
      resume: `${cap.postes} postes × ${cap.heures_jour} h × ${cap.jours_semaine} j `
            + `= ${cap.heures_semaine.toLocaleString('fr-CA')} h/semaine`
            + (cap.defaut ? ' · à confirmer' : ''),
      corps: `<p class="sec">Aucune source ne la donne : c'est ce réglage qui
      transforme des heures en dates. Le changer redessine tout le calendrier.
      ${cap.defaut ? '<b>Les 20 postes viennent de l\'équipe annoncée — 20 couturières, donc bien 20 postes de couture — pas d\'une mesure de ce qui sort par jour.</b> Confirmer ici.' : ''}</p>
      <form method="post" action="/cedule/capacite" class="cap-form">
        <div class="champ"><label for="cp">Postes</label>
          <input id="cp" type="number" name="postes" min="1" max="200"
                 value="${cap.postes}" required></div>
        <div class="champ"><label for="ch">Heures par jour</label>
          <input id="ch" type="number" name="heures_jour" min="1" max="24"
                 value="${cap.heures_jour}" required></div>
        <div class="champ"><label for="cj">Jours par semaine</label>
          <input id="cj" type="number" name="jours_semaine" min="1" max="7"
                 value="${cap.jours_semaine}" required></div>
        <button class="btn">Recalculer</button>
      </form>` })
    + pli({
      titre: "Ce que l'atelier fait",
      resume: C.PERIMETRES[perim.valeur] + (perim.defaut ? ' · non confirmé' : ''),
      corps: `<p class="sec">Aucune source ne dit si l'atelier planifié fait la
      préparation, l'assemblage, ou les deux — et l'écart entre les trois
      lectures dépasse le simple au double. Par défaut « les deux » : c'est la
      lecture prudente. ${perim.defaut
        ? '<b>Personne ne l\'a encore confirmée.</b>' : ''}</p>
      <form method="post" action="/cedule/perimetre" class="cap-form">
        <div class="champ" style="min-width:min(100%,280px)">
          <label for="pe">Périmètre</label>
          <select id="pe" name="perimetre">
            ${Object.entries(C.PERIMETRES).map(([k, lib]) =>
              `<option value="${k}"${k === perim.valeur ? ' selected' : ''}>${e(lib)}</option>`).join('')}
          </select></div>
        <button class="btn">Recalculer</button>
      </form>` })
    + pli({
      titre: 'Date de départ du plan', id: 'depart',
      resume: dep.defaut ? "aujourd'hui" : dateFR(dep.valeur)
              + (dep.passe ? ' · passée, le calcul part d\'aujourd\'hui' : ''),
      corps: `<p class="sec">Le plan commence à consommer de la capacité ce
      jour-là. La déplacer décale <b>tout</b> le calendrier d'un bloc — c'est le
      levier le plus simple quand la saison démarre plus tard qu'espéré.</p>
      <form method="post" action="/cedule/depart" class="cap-form">
        <div class="champ"><label for="dp">Premier jour de production</label>
          <input id="dp" type="date" name="depart" value="${
            dep.defaut ? '' : e(dep.valeur)}"></div>
        <button class="btn">Recalculer</button>
      </form>
      <p class="sec" style="margin:8px 0 0">Vider le champ remet le départ à
      aujourd'hui.</p>` })
    + pli({
      titre: "Pauses d'atelier", id: 'pauses',
      resume: pz.length
        ? `${pz.length} pause${pz.length > 1 ? 's' : ''} · ${
            joursFermes} jour${joursFermes > 1 ? 's' : ''} fermé${
            joursFermes > 1 ? 's' : ''}`
        : 'aucune',
      corps: `<p class="sec">Les jours où l'atelier ne produit pas : Aïd,
      congés, une rupture de matière, un déménagement. C'est le vrai moyen de
      <b>repousser</b> du travail — on ne déplace aucune tâche à la main, on
      retire de la capacité, et tout ce qui suit se recale sans trou ni
      chevauchement.</p>
      ${pz.length ? `<ul class="pauses">${pz.map(x => `<li>
        <span class="p-d">${dateFR(x.debut)}${x.fin !== x.debut
          ? ` → ${dateFR(x.fin)}` : ''}</span>
        <span class="p-n">${e(x.motif) || 'atelier fermé'}
          <span class="sec">· ${joursDePause(x)} jour${
            joursDePause(x) > 1 ? 's' : ''}</span></span>
        <form method="post" action="/cedule/pauses/${x.id}/supprimer">
          <button class="btn dgr min">×</button></form>
      </li>`).join('')}</ul>` : ''}
      <form method="post" action="/cedule/pauses" class="cap-form">
        <div class="champ"><label for="pd">Du</label>
          <input id="pd" type="date" name="debut" required></div>
        <div class="champ"><label for="pf">Au <span class="sec">inclus</span></label>
          <input id="pf" type="date" name="fin"></div>
        <div class="champ" style="flex:2"><label for="pm">Motif</label>
          <input id="pm" type="text" name="motif" maxlength="120"
                 placeholder="Aïd, congés, rupture de molleton…"></div>
        <button class="btn">Ajouter</button>
      </form>` }) : ''}`;

  const moisCourant = auj.slice(0, 7);
  const corps = `
  <div class="entete"><div><h1>Cédule</h1>
    <p class="muted">La charge de l'atelier et les dates clés</p></div>
    <a class="btn sec" href="/calendrier">Voir le calendrier →</a></div>
  ${verdict()}
  ${cal ? pli({ titre: "Charge de l'atelier", ouvert: true,
      resume: cal.debut
        ? `${cal.taches.filter(x => x.heures > 0).length} items · du ${
            dateFR(cal.debut)} au ${dateFR(cal.fin)}` : '',
      corps: gantt({ cal, jalons: jalons.filter(j => j.date >= auj), admin }) }) : ''}
  ${reglages()}
  ${Object.keys(parMois).length ? Object.entries(parMois).map(([mois, liste]) => {
    // Un mois écoulé se replie : il ne se passera plus rien dedans, mais on
    // veut pouvoir y revenir — c'est l'historique des dates promises.
    const passe = mois < moisCourant;
    return pli({
      titre: nomMois(mois), ouvert: !passe, classe: 'mois',
      resume: `${liste.length} date${liste.length > 1 ? 's' : ''}${
        passe ? ' · écoulé' : ''}`,
      corps: liste.map(j => `<div class="jalon${j.date < auj ? ' passe' : ''}">
        <span class="d">${dateFR(j.date)}</span>
        <span class="et et-${j.type}">${TYPES_JALON[j.type]}</span>
        <span style="flex:1">${e(j.titre)}
          <a class="muted" href="/ordres/${j.ordre_id}">· ${e(j.numero)} ${e(j.ordre_titre)}</a>
          ${j.note ? `<br><span class="muted">${e(j.note)}</span>` : ''}</span>
      </div>`).join('') });
  }).join('')
   : `<div class="carte"><p class="vide">Aucune date enregistrée.</p></div>`}`;
  return page({ titre: 'Cédule', user, corps, actif: 'cedule', msg });
}


/* ------------------------------------------------------------------ assistant
 * L'assistant exécute des ordres : la page montre donc autant CE QU'IL A FAIT
 * que ce qu'il a répondu. Chaque tour porte la liste de ses écritures et un
 * bouton pour tout défaire — c'est ce qui permet de lui laisser la main.
 *
 * La dictée est du JavaScript facultatif (≈1,5 Ko) : la reconnaissance tourne
 * dans le navigateur et n'envoie que du texte au serveur. Sans elle — vieux
 * navigateur, micro refusé — le champ de saisie fonctionne normalement.
 */
/**
 * Les gabarits de demande, rendus comme des phrases à trous.
 *
 * Chaque gabarit est un formulaire GET : sans JavaScript, le clic recharge la
 * page avec la boîte de saisie déjà remplie. C'est un aller-retour, mais la
 * page fait 5 Ko et ça marche partout — y compris sur un téléphone d'atelier
 * dont on ne choisit pas le navigateur. Le script en bas de page court-circuite
 * l'aller-retour quand il peut.
 *
 * Le menu déroulant est DANS la phrase, à la place du trou, plutôt qu'à côté :
 * on lit ce qu'on est en train de demander.
 */
function gabarits({ modeles, produits, fil }) {
  if (!modeles || !modeles.length) return '';

  const options = {
    produit: () => produits.map(p =>
      `<option value="${p.id}">${e(p.nom)}</option>`).join(''),
    pct: () => Array.from({ length: 11 }, (_, i) => i * 10)
      .map(n => `<option value="${n}"${n === 100 ? ' selected' : ''}>${n} %</option>`).join(''),
    jours: () => [7, 14, 30].map(n =>
      `<option value="${n}"${n === 7 ? ' selected' : ''}>${n} jours</option>`).join(''),
  };
  const LIBELLE = { produit: 'Produit', pct: 'Avancement', jours: 'Délai' };

  const ligne = (m) => {
    // La phrase se découpe sur ses trous : le texte reste du texte, chaque
    // trou devient son menu, à sa place.
    const morceaux = m.texte.split(/(\{\w+\})/).map(t => {
      const c = t.match(/^\{(\w+)\}$/);
      if (!c) return e(t);
      const champ = c[1];
      if (!options[champ]) return e(t);
      const mot = champ === 'produit' ? ' data-mot="texte"' : '';
      return `<label class="sr" for="${m.cle}-${champ}">${LIBELLE[champ] || champ}</label>
        <select id="${m.cle}-${champ}" name="${champ}"${mot}>${options[champ]()}</select>`;
    }).join('');

    return `<li><form method="get" action="/assistant" class="modele"
        data-texte="${e(m.texte)}">
      <input type="hidden" name="fil" value="${e(fil)}">
      <input type="hidden" name="m" value="${e(m.cle)}">
      <span class="phrase">${morceaux}</span>
      <button class="lien inserer">Insérer</button>
    </form></li>`;
  };

  return `<details class="gabarits" open>
    <summary>Gabarits — remplissent la boîte, n'envoient rien</summary>
    <ul>${modeles.map(ligne).join('')}</ul>
  </details>`;
}

function vueAssistant({ user, msg, tours, fil, dispo, modeles, brouillon,
                       produits, annulable }) {
  const bulle = (t) => {
    const ecrit = t.actions.filter(a => a.defaire);
    const restant = ecrit.filter(a => !a.defait);
    return `
    <div class="tour">
      <p class="dem"><b>${e(user.nom)}</b> ${e(t.demande)}</p>
      ${t.erreur ? `<p class="rep err">${e(t.erreur)}</p>`
                 : `<div class="rep">${para(t.reponse)}</div>`}
      ${ecrit.length ? `<div class="faits">
        <b>${restant.length ? 'Fait' : 'Annulé'}</b>
        <ul>${ecrit.map(a =>
          `<li${a.defait ? ' class="off"' : ''}>${e(a.resume)}</li>`).join('')}</ul>
        ${restant.length && t.id === annulable
          ? `<form method="post" action="/assistant/${t.id}/annuler">
          <button class="lien">Annuler ces ${restant.length} modification${
            restant.length > 1 ? 's' : ''}</button></form>` : ''}
      </div>` : ''}
    </div>`;
  };

  const corps = `
  <h1>Assistant</h1>
  ${dispo ? '' : `<div class="msg err">L'assistant n'est pas branché :
    il manque <code>ANTHROPIC_API_KEY</code> côté serveur. La page reste
    consultable, mais aucune demande ne partira.</div>`}

  <p class="intro">Donne un ordre, il l'exécute. Choisis un gabarit ci-dessous
  pour remplir la boîte, complète-le, puis envoie. ${user.role === 'atelier'
    ? `Tu es à l'atelier en Tunisie : l'assistant peut mettre à jour les avancements et
       commenter, pas créer d'ordres.`
    : ''}</p>

  <div class="fil">${tours.length
    ? tours.map(bulle).join('')
    : `<p class="vide">Rien encore.</p>`}
  </div>

  ${gabarits({ modeles, produits, fil })}

  <form method="post" action="/assistant" id="demande" class="saisie">
    <input type="hidden" name="fil" value="${e(fil)}">
    <label for="q" class="sr">Ta demande</label>
    <textarea id="q" name="demande" rows="3" required
      placeholder="Ce que tu veux faire, en une phrase…"${dispo ? '' : ' disabled'}
      >${e(brouillon || '')}</textarea>
    <div class="actions-saisie">
      <button type="button" id="micro" hidden class="micro"
        aria-label="Dicter">🎙 Dicter</button>
      <select id="langue" hidden aria-label="Langue de dictée">
        <option value="fr-CA">Français</option>
        <option value="ar-TN">العربية</option>
        <option value="en-CA">English</option>
      </select>
      <button id="envoi" class="primaire"${dispo ? '' : ' disabled'}>Envoyer</button>
    </div>
  </form>
  ${tours.length ? `<p class="reinit"><a href="/assistant?fil=nouveau">Nouveau fil</a>
    — l'assistant oublie la conversation précédente.</p>` : ''}

<script>
(function () {
  var f = document.getElementById('demande'),
      q = document.getElementById('q'),
      env = document.getElementById('envoi');

  // Un gabarit REMPLIT la boîte, il ne l'envoie pas. Sans ce script, chaque
  // gabarit reste un formulaire GET qui fait le même travail en un
  // aller-retour : la fonction ne dépend pas de lui, seulement sa vitesse.
  Array.prototype.forEach.call(document.querySelectorAll('form.modele'), function (g) {
    g.addEventListener('submit', function (ev) {
      ev.preventDefault();
      q.value = g.getAttribute('data-texte').replace(/\{(\w+)\}/g, function (_, cle) {
        var sel = g.querySelector('[name="' + cle + '"]');
        if (!sel) return '__________';
        // Le produit s'insère par son nom, le reste par sa valeur : la phrase
        // porte déjà « % » et « jours ».
        return sel.getAttribute('data-mot') === 'texte'
          ? sel.options[sel.selectedIndex].text : sel.value;
      });
      q.focus();
      // Le curseur va au premier trou restant s'il y en a un, sinon à la fin :
      // ce qui manque est ce qu'on veut taper tout de suite.
      var trou = q.value.indexOf('______');
      if (trou >= 0) q.setSelectionRange(trou, trou + q.value.slice(trou).match(/^_+/)[0].length);
      else q.setSelectionRange(q.value.length, q.value.length);
      q.scrollIntoView({ block: 'center' });
    });
  });

  // Sur une connexion lente, une demande peut prendre dix secondes : on le dit
  // plutôt que de laisser croire que le clic n'a pas pris.
  f.addEventListener('submit', function () {
    env.disabled = true; env.textContent = 'L’assistant travaille…';
  });

  var Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Reco) return;                       // pas de dictée : le clavier suffit
  var mic = document.getElementById('micro'), lang = document.getElementById('langue');
  mic.hidden = false; lang.hidden = false;
  try { lang.value = localStorage.getItem('mrp-langue') || 'fr-CA'; } catch (e) {}

  var reco = null, actif = false, acquis = '';
  mic.addEventListener('click', function () {
    if (actif) { reco.stop(); return; }
    reco = new Reco();
    reco.lang = lang.value; reco.continuous = true; reco.interimResults = true;
    try { localStorage.setItem('mrp-langue', lang.value); } catch (e) {}
    acquis = q.value ? q.value.replace(/\s+$/, '') + ' ' : '';
    reco.onstart = function () {
      actif = true; mic.classList.add('on'); mic.textContent = '■ Arrêter';
    };
    reco.onresult = function (ev) {
      var provisoire = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) acquis += t + ' '; else provisoire += t;
      }
      q.value = acquis + provisoire;
    };
    reco.onerror = function (ev) {
      mic.textContent = ev.error === 'not-allowed'
        ? '🎙 Micro refusé' : '🎙 Dicter';
    };
    reco.onend = function () {
      actif = false; mic.classList.remove('on');
      if (mic.textContent.indexOf('refus') < 0) mic.textContent = '🎙 Dicter';
      q.focus();
    };
    reco.start();
  });
})();
</script>`;

  return page({ titre: 'Assistant', user, corps, actif: 'assistant', msg });
}

/** Texte libre du modèle → paragraphes, en échappant tout. */
function para(t) {
  return String(t || '').split(/\n{2,}/).filter(Boolean)
    .map(b => `<p>${e(b).replace(/\n/g, '<br>')}</p>`).join('') || '<p></p>';
}


/* --------------------------------------------------- liste de fabrication
 * La page qu'on ouvre le matin : quoi produire, dans quel ordre.
 *
 * Un choix qui structure tout le reste : le rang n'est pas un champ qu'on
 * saisit, c'est un calcul. Priorité posée à la main, puis échéance, puis
 * quantité restante. On ne maintient donc jamais une numérotation à la main —
 * ajouter un ordre urgent réordonne la liste tout seul.
 */
const PRIORITES = { haute: 'Haute', normale: 'Normale', basse: 'Basse' };

/**
 * Comment une échéance se lit.
 *
 * `enRetard` vient d'un jalon déjà passé sur l'ordre — c'est un état, pas une
 * distance. `jours` est le délai jusqu'au prochain jalon à venir. Les deux
 * coexistent : un ordre peut avoir raté une date ET en avoir une autre devant.
 */
function urgence(jours, enRetard) {
  if (enRetard) return { cls: 'retard', txt: 'en retard' };
  if (jours === null || jours === undefined) return { cls: 'sans', txt: 'sans date' };
  if (jours === 0) return { cls: 'retard',  txt: "aujourd'hui" };
  if (jours <= 7)  return { cls: 'urgent',  txt: `dans ${jours} j` };
  if (jours <= 21) return { cls: 'bientot', txt: `dans ${jours} j` };
  return { cls: 'loin', txt: `dans ${jours} j` };
}

function vuePriorites({ user, msg, lignes, ailleurs = [], jours = 7 }) {
  const admin = user.role === 'admin';
  const enRetard = lignes.filter(l => l.en_retard).length;
  const urgents  = lignes.filter(l => !l.en_retard && l.jours !== null && l.jours <= jours).length;
  const total    = lignes.reduce((n, l) => n + l.restant, 0);

  const rang = (l, i) => {
    const u = urgence(l.jours, l.en_retard);
    const sel = (v) => `<option value="${v}"${l.priorite === v ? ' selected' : ''}>${PRIORITES[v]}</option>`;
    // La répartition d'un item — sept pointures, cinq coloris — ne tient pas
    // dans une colonne de tableau : elle s'y empilait en colonne et faisait
    // des rangées de quatre cents pixels. Elle passe donc sur une ligne à
    // elle, sous l'item, où elle dispose de toute la largeur.
    const rep = l.variantes ? repartition(l.variantes, { compact: true }) : '';
    return `
    <tr id="i${l.id}" class="p-${l.priorite}${rep ? ' a-rep' : ''}">
      <td class="num">${i + 1}</td>
      <td class="prod"><div class="avec-mini">${miniature(l.photo, l.code, {
        zoom: { cle: `f${l.produit_id}`, href: `/produits/${l.produit_id}`,
                titre: l.nom || l.code } })}<div>
        <a href="/produits/${l.produit_id}"><b>${e(l.code)}</b></a>
        <span class="fam f-${l.famille}">${FAMILLES[l.famille] || l.famille}</span>
        <span class="sec">${e(l.nom)}</span>
        ${l.note ? `<span class="note">${e(l.note)}</span>` : ''}
      </div></div></td>
      <td class="qte"><b>${l.restant.toLocaleString('fr-CA')}</b>
        <span class="sec">sur ${l.quantite.toLocaleString('fr-CA')}</span></td>
      <td class="av">${jauge(l.avancement)}<span class="sec">${l.avancement} % fait</span></td>
      <td class="ech u-${u.cls}">
        <span class="quand">${u.txt}</span>
        ${l.echeance ? `<span class="sec">${dateFR(l.echeance)}${
          l.en_retard && l.jours !== null ? ` · prochaine dans ${l.jours} j` : ''}</span>` : ''}
        ${l.echeance_titre ? `<span class="note">${e(l.echeance_titre)}</span>` : ''}
      </td>
      <td class="ord"><a href="/ordres/${l.ordre_id}">${e(l.numero)}</a>
        <span class="sec">${e(l.ordre_titre)}</span></td>
      <td class="pri">${admin ? `<form method="post" action="/priorites/${l.id}">
          <select name="priorite" onchange="this.form.submit()">
            ${sel('haute')}${sel('normale')}${sel('basse')}</select>
          <button class="sr-btn">OK</button></form>`
        : PRIORITES[l.priorite]}</td>
    </tr>${rep ? `<tr class="rep-l p-${l.priorite}"><td colspan="7">${rep}</td></tr>` : ''}`;
  };

  const corps = `
  <h1>À fabriquer</h1>
  <p class="intro">Tout ce qui reste à produire <b>à l'atelier</b>, tous ordres
  confondus, dans l'ordre où s'y mettre. Le rang se calcule : priorité posée à la main, puis
  retard, puis <b>date d'expédition</b>, puis la famille — hiver, nouveaux
  produits, isothermes —, puis quantité restante. ${admin
    ? 'Change une priorité et la liste se réordonne.'
    : 'Les priorités sont posées par Admin QC.'}</p>

  <div class="chiffres">
    <div class="c${enRetard ? ' alerte' : ''}"><b>${enRetard}</b>en retard</div>
    <div class="c"><b>${urgents}</b>dans ${jours} jours</div>
    <div class="c"><b>${lignes.length}</b>items à produire</div>
    <div class="c"><b>${total.toLocaleString('fr-CA')}</b>unités restantes</div>
  </div>
  ${(() => {
    const parFam = {};
    for (const l of lignes) parFam[l.famille] = (parFam[l.famille] || 0) + l.restant;
    const ordre = ['hiver', 'nouveau', 'isotherme', 'autre'].filter(f => parFam[f]);
    if (ordre.length < 2) return '';
    return `<div class="repartition">${ordre.map(f =>
      `<span class="fam f-${f}">${FAMILLES[f]}</span>
       <b>${parFam[f].toLocaleString('fr-CA')}</b>`).join('')}</div>`;
  })()}

  ${ailleurs.length ? `<div class="ailleurs">
    <b>${ailleurs.reduce((n, l) => n + l.restant, 0).toLocaleString('fr-CA')} unités
    ne sont pas dans cette liste</b> : elles se fabriquent ailleurs qu'à
    l'atelier. Elles restent au plan et se suivent sur l'ordre.
    <ul>${ailleurs.map(l => `<li><a href="/ordres/${l.ordre_id}#i${l.id}">${e(l.code)}</a>
      <span class="sec">${e(l.nom)}</span>
      <b>${l.restant.toLocaleString('fr-CA')}</b>
      <span class="lieu">${LIEUX[l.fabrication] || e(l.fabrication)}</span></li>`).join('')}</ul>
  </div>` : ''}

  ${lignes.length ? `<div class="tbl tbl-fab"><table class="fab">
    <colgroup><col class="c-num"><col class="c-prod"><col class="c-qte"
      ><col class="c-av"><col class="c-ech"><col class="c-ord"><col class="c-pri"></colgroup>
    <thead><tr><th>#</th><th>Produit</th><th>Restant</th><th>Avancement</th>
      <th>Échéance</th><th>Ordre</th><th>Priorité</th></tr></thead>
    <tbody>${lignes.map(rang).join('')}</tbody>
  </table></div>`
  : `<div class="carte"><p class="vide">Rien à produire : tous les items des
     ordres planifiés et en cours sont à 100 %.</p></div>`}`;

  return page({ titre: 'À fabriquer', user, corps, actif: 'priorites', msg });
}

/* ----------------------------------------------------------------- suivi
 * Le pendant de la liste de fabrication : est-ce que ça bouge ?
 *
 * Trois questions, trois blocs. Ce qui a bougé récemment, ce qui ne bouge
 * plus, et combien on a avancé cette semaine. Le bloc du milieu est le seul
 * qui demande une action — les deux autres servent à ne pas avoir à demander.
 */
function vueSuivi({ user, msg, recentes, immobiles, progression, jours }) {
  const corps = `
  <h1>Activité de production</h1>
  <p class="intro">Ce qui a bougé, ce qui ne bouge plus, et de combien on a
  avancé. Chaque changement d'avancement est daté et signé — personne n'a à
  demander « où on en est ».</p>

  ${immobiles.length ? `<section class="bloc alerte-bloc">
    <h2>Sans mouvement depuis ${jours} jours ou plus</h2>
    <p class="sec">Du travail commencé qui n'avance plus. C'est le seul bloc
    de cette page qui demande une action.</p>
    <div class="tbl"><table class="items">
      <thead><tr><th>Produit</th><th>Avancement</th><th>Dernière maj</th><th>Ordre</th></tr></thead>
      <tbody>${immobiles.map(x => `<tr>
        <td><b>${silhouette(x.code, x.nom)}${e(x.code)}</b>
          <span class="sec">${e(x.nom)}</span></td>
        <td class="c-av">${jauge(x.avancement)}<span class="sec">${x.avancement} %</span></td>
        <td class="c-fige"><b>${x.jours_sans_maj} j</b>
          <span class="sec">depuis le ${dateHeureFR(x.maj_le)}</span></td>
        <td class="c-ord"><a href="/ordres/${x.ordre_id}#i${x.id}">${e(x.numero)}</a></td>
      </tr>`).join('')}</tbody>
    </table></div>
  </section>` : `<section class="bloc">
    <h2>Sans mouvement</h2>
    <p class="vide">Rien d'immobile depuis ${jours} jours. Tout ce qui est
    commencé avance.</p>
  </section>`}

  <section class="bloc">
    <h2>Avancé sur ${jours} jours</h2>
    ${progression.length ? `<div class="tbl"><table class="items">
      <thead><tr><th>Ordre</th><th>Mises à jour</th><th>Unités avancées</th></tr></thead>
      <tbody>${progression.map(p => `<tr>
        <td><b>${e(p.numero)}</b> <span class="sec">${e(p.titre)}</span></td>
        <td class="c-maj">${p.maj}</td>
        <td class="c-unites"><b>${Math.round(p.unites_avancees).toLocaleString('fr-CA')}</b></td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="sec">« Unités avancées » = la progression convertie en pièces :
    passer 2000 cache-cous de 40 à 70 % compte pour 600.</p>`
    : `<p class="vide">Aucune mise à jour sur la période.</p>`}
  </section>

  <section class="bloc">
    <h2>Dernières mises à jour</h2>
    ${recentes.length ? `<ul class="flux">${recentes.map(h => `<li>
      <span class="quand">${dateHeureFR(h.cree_le)}</span>
      <b>${e(h.auteur || 'quelqu\'un')}</b>
      <a href="/ordres/${h.ordre_id}#i${h.item_id}">${e(h.code)}</a>
      <span class="saut">${h.avant} %&nbsp;→&nbsp;<b>${h.apres} %</b></span>
      <span class="sec">${e(h.numero)}</span>
    </li>`).join('')}</ul>`
    : `<p class="vide">Aucune mise à jour enregistrée.</p>`}
  </section>`;

  return page({ titre: 'Activité', user, corps, actif: 'suivi', msg });
}

module.exports = { e, urlImage, urlAcceptable, img, miniature, silhouette,
  TAILLES, sousNavProduits,
  vueQualiteAccueil, vueQualiteProduits, vueQualiteGeneral, vueQCOrdres, vueQCOrdre, dateFR, dateHeureFR, jauge, page, vueConnexion,
                   vueCompte,
                   vueAccueil, vueOrdres, vueOrdre, vueOrdreForm,
                   vueProduits, vueProduit, vueProduitForm, vueCedule, vueAssistant,
                   vueRetroactions, vueRetroactionsIndex,
                   vuePriorites, vueSuivi, vueTaches, vueProtocole,
                   vueChecklist,
                   PRIORITES, urgence,
                   STATUTS, TYPES_JALON, LIEUX, ROLES };
