/**
 * Lasclay — MRP : vues
 * ---------------------------------------------------------------------------
 * Génération HTML par fonctions. Pas de moteur de gabarits, pas de JS côté
 * client : chaque action est un formulaire qui poste et redirige. C'est ce qui
 * rend l'application utilisable sur une connexion lente.
 */
'use strict';

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

/** Largeurs demandées selon le contexte d'affichage. */
const TAILLES = { mini: 160, vignette: 320, galerie: 640 };

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

const dateFR = (d) => {
  if (!d) return '';
  const [a, m, j] = String(d).slice(0, 10).split('-');
  return j && m && a ? `${j}/${m}/${a}` : d;
};

const dateHeureFR = (t) => {
  if (!t) return '';
  const d = new Date(String(t).replace(' ', 'T') + 'Z');
  if (isNaN(d)) return t;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} `
       + `${p(d.getHours())} h ${p(d.getMinutes())}`;
};

function jauge(pct) {
  const cls = pct === 0 ? 'zero' : pct === 100 ? '' : 'part';
  return `<div class="jauge ${cls}"><i style="width:${pct}%"></i></div>`;
}

// ------------------------------------------------------------------- ossature
function page({ titre, user, corps, actif = '', msg = null }) {
  const lien = (h, t, k) =>
    `<a href="${h}"${actif === k ? ' class="on"' : ''}>${t}</a>`;
  return `<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(titre)} — Lasclay MRP</title>
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="data:,">
</head><body>
<header class="top"><div class="top-in">
  <a class="marque" href="/">Lasclay <span>MRP</span></a>
  ${user ? `<nav class="top">
    ${lien('/', 'Tableau de bord', 'accueil')}
    ${lien('/priorites', 'À fabriquer', 'priorites')}
    ${lien('/ordres', 'Ordres de production', 'ordres')}
    ${lien('/suivi', 'Suivi', 'suivi')}
    ${lien('/produits', 'Produits', 'produits')}
    ${lien('/cedule', 'Cédule', 'cedule')}
    ${lien('/assistant', 'Assistant', 'assistant')}
  </nav>
  <span class="qui"><a href="/compte">${e(user.nom)}</a>${user.role === 'atelier' ? ' · atelier' : ''}
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
<title>Connexion — Lasclay MRP</title><link rel="stylesheet" href="/style.css">
<link rel="icon" href="data:,"></head><body>
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



/* ------------------------------------------------------------------ compte
 * Changer son mot de passe sans passer par un shell. Ça paraît accessoire ;
 * ça ne l'est pas : un mot de passe transmis par message doit pouvoir être
 * changé par celui qui le reçoit, et l'atelier n'a pas de shell.
 */
function vueCompte({ user, msg }) {
  const corps = `
  <div class="entete"><div>
    <h1>Mon compte</h1>
    <p class="muted">${e(user.courriel)} · ${user.role === 'admin'
      ? 'administration' : 'atelier'}</p>
  </div></div>

  <div class="carte" style="max-width:420px">
    <h2>Mon nom</h2>
    <p class="muted" style="font-size:13px;margin:6px 0 14px">C'est lui qui
    signe tes mises à jour dans le suivi. « Administration » n'apprend rien
    quand deux personnes partagent le rôle.</p>
    <form method="post" action="/compte/nom">
      <div class="champ"><label for="nom">Nom affiché</label>
        <input id="nom" type="text" name="nom" required minlength="2" maxlength="60"
               value="${e(user.nom)}"></div>
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
function vueAccueil({ user, ordres, jalons }) {
  const enCours = ordres.filter(o => o.statut === 'en_cours' || o.statut === 'planifie');
  const corps = `
  <div class="entete"><div>
    <h1>Tableau de bord</h1>
    <p class="muted">${enCours.length} ordre${enCours.length > 1 ? 's' : ''} en cours ou planifié${enCours.length > 1 ? 's' : ''}</p>
  </div>${user.role === 'admin'
    ? `<a class="btn" href="/ordres/nouveau">Nouvel ordre de production</a>` : ''}</div>

  <div class="carte"><h2>Production en cours</h2>
  ${enCours.length ? `<div class="tbl"><table>
    <tr><th>Ordre</th><th>Avancement</th><th class="num">Items</th><th>Prochaine échéance</th></tr>
    ${enCours.map(o => `<tr>
      <td><a href="/ordres/${o.id}"><b>${e(o.numero)}</b></a><br>
          <span class="muted">${e(o.titre)}</span></td>
      <td><div style="display:flex;align-items:center;gap:8px">
          ${jauge(o.pct)}<span class="pct">${o.pct} %</span></div></td>
      <td class="num">${o.items}</td>
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
  </div>`;
  return page({ titre: 'Tableau de bord', user, corps, actif: 'accueil' });
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

// =================================================== DÉTAIL D'UN ORDRE (clé)
function vueOrdre({ user, o, items, jalons, commentaires, produits, pct, msg }) {
  const admin = user.role === 'admin';
  const auj = new Date().toISOString().slice(0, 10);

  // sélecteur d'avancement : 0 → 100 par tranches de 10, un simple formulaire
  const selecteur = (it) => `<form class="av" method="post"
      action="/ordres/${o.id}/items/${it.id}/avancement">
    ${[0,10,20,30,40,50,60,70,80,90,100].map(v =>
      `<button name="valeur" value="${v}"${v === it.avancement ? ' class="on"' : ''}
        title="${v} %">${v}</button>`).join('')}
  </form>`;

  const corps = `
  <div class="entete"><div>
    <h1>${e(o.numero)} <span class="et et-${o.statut}">${STATUTS[o.statut]}</span></h1>
    <p class="muted">${e(o.titre)}</p>
  </div><div class="actions">
    ${admin ? `<a class="btn sec" href="/ordres/${o.id}/modifier">Modifier</a>` : ''}
  </div></div>

  <div class="carte">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <label style="margin-bottom:6px">Avancement global (pondéré par les quantités)</label>
        ${jauge(pct)}
      </div>
      <div style="font-size:30px;font-weight:650;font-variant-numeric:tabular-nums">${pct} %</div>
    </div>
    ${o.note ? `<p class="muted" style="margin:12px 0 0;white-space:pre-wrap">${e(o.note)}</p>` : ''}
  </div>

  <div class="carte"><h2>Items à produire</h2>
  ${items.length ? `<div class="tbl tbl-items"><table class="items">
    <thead><tr><th>Produit</th><th class="num">Quantité</th>
        <th style="min-width:290px">Avancement</th>
        <th>Note</th>${admin ? '<th></th>' : ''}</tr></thead>
    <tbody>
    ${items.map(it => `<tr id="i${it.id}">
      <td><a href="/produits/${it.produit_id}"><b>${e(it.produit_nom)}</b></a><br>
          <span class="muted">${e(it.produit_code)}</span></td>
      <td class="num">${it.quantite.toLocaleString('fr-CA')}
        ${it.variantes ? `<details class="rep-var">
          <summary>${it.variantes.lignes.length} variantes${it.variantes.ecart
            ? ` <span class="ecart">${it.variantes.ecart > 0 ? '+' : ''}${it.variantes.ecart}</span>`
            : ''}</summary>
          <ul>${it.variantes.lignes.map(v => `<li><span>${e(v.nom)}</span>
            <b>${v.quantite.toLocaleString('fr-CA')}</b></li>`).join('')}</ul>
          ${it.variantes.ecart ? `<p class="ecart-note">La répartition totalise
            ${it.variantes.somme.toLocaleString('fr-CA')} pour
            ${it.variantes.quantite.toLocaleString('fr-CA')} au plan. Les deux
            chiffres viennent du chiffrier ; l'écart n'est pas résolu.</p>` : ''}
        </details>` : ''}
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          ${jauge(it.avancement)}<span class="pct">${it.avancement} %</span>
        </div>
        ${selecteur(it)}
        ${it.maj_le ? `<div class="muted" style="margin-top:4px;font-size:12px">
           Dernière mise à jour ${dateHeureFR(it.maj_le)}</div>` : ''}
      </td>
      <td class="muted note-c">${e(it.note) || '—'}</td>
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
function vueProduits({ user, produits, msg }) {
  const corps = `
  <div class="entete"><div><h1>Produits</h1>
    <p class="muted">${produits.length} fiche${produits.length > 1 ? 's' : ''}</p></div>
    ${user.role === 'admin'
      ? `<a class="btn" href="/produits/nouveau">Nouvelle fiche</a>` : ''}</div>
  ${produits.length ? `<div class="grille">
    ${produits.map(p => `<a class="vignette" href="/produits/${p.id}">
      ${p.photo ? img(p.photo, { largeur: TAILLES.vignette, alt: p.nom })
                : `<div class="sans-photo">Pas de photo</div>`}
      <div class="b"><b>${e(p.nom)}</b>
        <span class="muted">${e(p.code)}</span></div>
    </a>`).join('')}
  </div>` : `<div class="carte"><p class="vide">Aucune fiche produit.</p></div>`}`;
  return page({ titre: 'Produits', user, corps, actif: 'produits', msg });
}

function vueProduit({ user, p, photos, materiaux, patrons, ordres, msg }) {
  const admin = user.role === 'admin';
  const studio = photos.filter(f => f.type === 'studio');
  const contexte = photos.filter(f => f.type === 'contexte');
  const galerie = (liste) => `<div class="photos">${liste.map(f => `<figure>
      <a href="${e(urlImage(f.url))}" rel="noopener" title="Voir en taille réelle">
        ${img(f.url, { largeur: TAILLES.galerie, alt: f.legende || p.nom })}</a>
      ${f.legende ? `<figcaption>${e(f.legende)}</figcaption>` : ''}
    </figure>`).join('')}</div>`;

  const corps = `
  <div class="entete"><div>
    <h1>${e(p.nom)}</h1><p class="muted">${e(p.code)}</p>
  </div>${admin ? `<a class="btn sec" href="/produits/${p.id}/modifier">Modifier</a>` : ''}</div>

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
  return page({ titre: p.nom, user, corps, actif: 'produits', msg });
}

function vueProduitForm({ user, p = null, photos = [], materiaux = [], patrons = [], msg }) {
  const t = p ? `Modifier ${p.nom}` : 'Nouvelle fiche produit';
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

// ==================================================================== cédule
function vueCedule({ user, jalons, msg }) {
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
  const corps = `
  <div class="entete"><div><h1>Cédule</h1>
    <p class="muted">Toutes les dates clés, tous ordres confondus</p></div></div>
  ${Object.keys(parMois).length ? Object.entries(parMois).map(([mois, liste]) => `
    <div class="carte"><h2 style="text-transform:capitalize">${nomMois(mois)}</h2>
      ${liste.map(j => `<div class="jalon${j.date < auj ? ' passe' : ''}">
        <span class="d">${dateFR(j.date)}</span>
        <span class="et et-${j.type}">${TYPES_JALON[j.type]}</span>
        <span style="flex:1">${e(j.titre)}
          <a class="muted" href="/ordres/${j.ordre_id}">· ${e(j.numero)} ${e(j.ordre_titre)}</a>
          ${j.note ? `<br><span class="muted">${e(j.note)}</span>` : ''}</span>
      </div>`).join('')}
    </div>`).join('')
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
function vueAssistant({ user, msg, tours, fil, dispo, exemples, annulable }) {
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

  <p class="intro">Donne un ordre, il l'exécute. « Mets les cache-cous à 70 % »,
  « crée un ordre pour 500 tuques sport livrables le 15 novembre »,
  « qu'est-ce qui s'en vient le mois prochain ». ${user.role === 'atelier'
    ? `Tu es à l'atelier : l'assistant peut mettre à jour les avancements et
       commenter, pas créer d'ordres.`
    : ''}</p>

  <div class="fil">${tours.length
    ? tours.map(bulle).join('')
    : `<p class="vide">Rien encore. Essaie une de ces phrases :</p>
       <ul class="exemples">${exemples.map(x =>
         `<li><button form="demande" name="demande" value="${e(x)}"
              class="lien">${e(x)}</button></li>`).join('')}</ul>`}
  </div>

  <form method="post" action="/assistant" id="demande" class="saisie">
    <input type="hidden" name="fil" value="${e(fil)}">
    <label for="q" class="sr">Ta demande</label>
    <textarea id="q" name="demande" rows="3" required
      placeholder="Ce que tu veux faire, en une phrase…"${dispo ? '' : ' disabled'}
      ></textarea>
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
    return `
    <tr id="i${l.id}" class="p-${l.priorite}">
      <td class="num">${i + 1}</td>
      <td class="prod">
        <a href="/produits/${l.produit_id}"><b>${e(l.code)}</b></a>
        <span class="fam f-${l.famille}">${FAMILLES[l.famille] || l.famille}</span>
        <span class="sec">${e(l.nom)}</span>
        ${l.note ? `<span class="note">${e(l.note)}</span>` : ''}
      </td>
      <td class="qte"><b>${l.restant.toLocaleString('fr-CA')}</b>
        <span class="sec">sur ${l.quantite.toLocaleString('fr-CA')}</span></td>
      <td class="av">${jauge(l.avancement)}<span class="sec">${l.avancement} %</span></td>
      <td class="ech u-${u.cls}">
        ${l.echeance ? `<b>${dateFR(l.echeance)}</b>` : ''}
        <span class="sec">${u.txt}${l.echeance && l.en_retard && l.jours !== null
          ? ` · prochaine dans ${l.jours} j` : ''}</span>
        ${l.echeance_titre ? `<span class="note">${e(l.echeance_titre)}</span>` : ''}
      </td>
      <td class="ord"><a href="/ordres/${l.ordre_id}">${e(l.numero)}</a>
        <span class="sec">${e(l.ordre_titre)}</span></td>
      <td class="pri">${admin ? `<form method="post" action="/priorites/${l.id}">
          <select name="priorite" onchange="this.form.submit()">
            ${sel('haute')}${sel('normale')}${sel('basse')}</select>
          <button class="sr-btn">OK</button></form>`
        : PRIORITES[l.priorite]}</td>
    </tr>`;
  };

  const corps = `
  <h1>À fabriquer</h1>
  <p class="intro">Tout ce qui reste à produire <b>à l'atelier</b>, tous ordres
  confondus, dans l'ordre où s'y mettre. Le rang se calcule : priorité posée à la main, puis
  retard, puis <b>date d'expédition</b>, puis la famille — hiver, nouveaux
  produits, isothermes —, puis quantité restante. ${admin
    ? 'Change une priorité et la liste se réordonne.'
    : 'Les priorités sont posées par l\'administration.'}</p>

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
  <h1>Suivi de production</h1>
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
        <td><b>${e(x.code)}</b> <span class="sec">${e(x.nom)}</span></td>
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

  return page({ titre: 'Suivi', user, corps, actif: 'suivi', msg });
}

module.exports = { e, urlImage, urlAcceptable, img, TAILLES, dateFR, dateHeureFR, jauge, page, vueConnexion,
                   vueCompte,
                   vueAccueil, vueOrdres, vueOrdre, vueOrdreForm,
                   vueProduits, vueProduit, vueProduitForm, vueCedule, vueAssistant,
                   vuePriorites, vueSuivi, PRIORITES, urgence,
                   STATUTS, TYPES_JALON, LIEUX };
