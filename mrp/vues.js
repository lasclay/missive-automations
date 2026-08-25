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
const TYPES_JALON = { livraison:'Livraison', deadline:'Deadline',
                      evenement:'Événement', prevente:'Prévente' };

/** Normalise une URL Google Drive en lien d'image affichable. */
function urlImage(u) {
  const s = String(u || '').trim();
  const m = s.match(/drive\.google\.com\/file\/d\/([\w-]+)/)
        || s.match(/drive\.google\.com\/open\?id=([\w-]+)/)
        || s.match(/[?&]id=([\w-]+)/);
  return m ? `https://lh3.googleusercontent.com/d/${m[1]}` : s;
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
    ${lien('/ordres', 'Ordres de production', 'ordres')}
    ${lien('/produits', 'Produits', 'produits')}
    ${lien('/cedule', 'Cédule', 'cedule')}
  </nav>
  <span class="qui">${e(user.nom)}${user.role === 'atelier' ? ' · atelier' : ''}
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
      <td class="num">${it.quantite.toLocaleString('fr-CA')}</td>
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
      ${p.photo ? `<img src="${e(urlImage(p.photo))}" alt="" loading="lazy">`
                : `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" alt="">`}
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
      <img src="${e(urlImage(f.url))}" alt="${e(f.legende)}" loading="lazy">
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
        <td><img src="${e(urlImage(f.url))}" alt="" style="width:70px;height:50px;
            object-fit:cover;border-radius:4px;background:#eef0f2"></td>
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

module.exports = { e, urlImage, dateFR, dateHeureFR, jauge, page, vueConnexion,
                   vueAccueil, vueOrdres, vueOrdre, vueOrdreForm,
                   vueProduits, vueProduit, vueProduitForm, vueCedule,
                   STATUTS, TYPES_JALON };
