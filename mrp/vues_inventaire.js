/**
 * Lasclay — MRP : vues de l'inventaire
 * ---------------------------------------------------------------------------
 * Séparé de `vues.js`, qui est déjà long, et parce que l'inventaire répond à
 * d'autres questions que la production : pas « où en est-on », mais « avec
 * quoi va-t-on finir ».
 *
 * L'ordre des écrans suit l'ordre des décisions :
 *   /inventaire   ce qui manquera, puis ce qui est bas, puis tout le reste
 *   /besoins      le calculateur : un produit consomme ceci, en voici assez ou pas
 *   /matieres/:id une matière : son stock, son histoire, qui la consomme
 */
'use strict';
const { e, page, img, dateFR, dateHeureFR } = require('./vues.js');
const { CATEGORIES, MOTIFS, UNITES, qte, uniteAffichee } = require('./db.js');

const uniteFR = (u, n) => (u ? uniteAffichee(u, n === undefined ? 1 : n) : '');
const argent = (n) => n === null || n === undefined ? '—'
  : n.toLocaleString('fr-CA', { maximumFractionDigits: n < 100 ? 2 : 0 }) + ' $';

/**
 * L'état d'une matière en un mot. La nuance qui compte est entre « rien en
 * stock » et « jamais compté » : la première est un fait, la seconde est un
 * trou dans les données. Les confondre ferait passer 39 matières inconnues
 * pour 39 ruptures.
 */
function pastille(m) {
  if (!m.suivi_stock) return '<span class="etat hors">hors inventaire</span>';
  if (m.jamais_compte) return '<span class="etat inconnu">jamais compté</span>';
  if (m.manque > 0)    return '<span class="etat rupture">il en manquera</span>';
  if (m.sous_seuil)    return '<span class="etat bas">sous le seuil</span>';
  return '<span class="etat ok">suffisant</span>';
}

/* ===================================================================== hub */

function vueInventaire({ user, msg, matieres, alertes, produits, categorie }) {
  const admin = user.role === 'admin';

  const alerte = (titre, lignes, rendu, explication) => !lignes.length ? '' : `
    <section class="bloc-alerte">
      <h2>${e(titre)} <span class="compte">${lignes.length}</span></h2>
      <p class="pourquoi">${explication}</p>
      <ul class="alertes">${lignes.map(rendu).join('')}</ul>
    </section>`;

  const lienM = (m) => `<a href="/matieres/${m.id}">${e(m.nom)}</a>`;

  const corps = `
  <h1>Inventaire</h1>
  <p class="intro">Ce qu'il y a en tablette, ce que la production va consommer,
  et l'écart entre les deux.</p>

  ${alerte('Il en manquera', alertes.ruptures, m => `<li>
      ${lienM(m)} — <b>${qte(m.manque, uniteFR(m.unite))}</b> de trop peu
      <span class="sec">stock ${qte(m.stock, uniteFR(m.unite))} ·
      besoin ${qte(m.besoin, uniteFR(m.unite))}${
        m.cout_manque ? ` · ${argent(m.cout_manque)} à commander` : ''}</span>
    </li>`,
    `Ces matières ont été comptées, et le compte ne couvre pas ce que les ordres
     ouverts vont consommer. C'est la seule liste qui regarde devant.`)}

  ${alerte('Sous le seuil', alertes.bas, m => `<li>
      ${lienM(m)} — ${qte(m.stock, uniteFR(m.unite))}
      <span class="sec">seuil ${qte(m.seuil_alerte, uniteFR(m.unite))}</span>
    </li>`,
    `Assez pour ce qui est engagé, mais sous le plancher qu'on a posé.`)}

  ${alerte('Produits finis sous le seuil', alertes.produits_bas, p => `<li>
      <a href="/produits/${p.id}">${e(p.nom)}</a> — ${qte(p.stock)} en stock
      <span class="sec">seuil ${qte(p.seuil_alerte)}</span>
    </li>`,
    `Ce qui est prêt à expédier passe sous son plancher.`)}

  ${alerte('Consommation à chiffrer', alertes.a_chiffrer, m => `<li>
      ${lienM(m)}
      <span class="sec">${m.produits_flous} produit${m.produits_flous > 1 ? 's' : ''}
      en production sans consommation établie</span>
    </li>`,
    `Ces matières partent en production sans qu'on sache combien. Leur besoin
     ne se calcule pas, donc leur manque non plus — un stock qui paraît
     suffisant ici ne prouve rien.`)}

  ${alertes.jamais_comptees.length ? `
  <section class="bloc-alerte doux">
    <h2>Jamais comptées <span class="compte">${alertes.jamais_comptees.length}</span></h2>
    <p class="pourquoi">Aucun mouvement enregistré : leur stock est
    <b>inconnu</b>, pas nul. Tant qu'un premier comptage n'est pas saisi,
    l'inventaire ne peut rien dire de ce qui manque.
    ${alertes.jamais_comptees.length > 6
      ? `Le plus rapide est de partir de <a href="/besoins">Besoins</a> :
         il donne l'ordre dans lequel compter — le plus engagé d'abord.` : ''}</p>
    <p class="liste-plate">${alertes.jamais_comptees.slice(0, 24).map(m =>
      `<a href="/matieres/${m.id}">${e(m.nom)}</a>`).join(' · ')}${
      alertes.jamais_comptees.length > 24 ? ' …' : ''}</p>
  </section>` : ''}

  <section>
    <div class="entete-liste">
      <h2>Matières <span class="compte">${matieres.length}</span></h2>
      ${admin ? `<a class="btn" href="/matieres/nouveau">Nouvelle matière</a>` : ''}
    </div>

    <form method="get" class="filtre">
      <label for="cat" class="sr">Catégorie</label>
      <select id="cat" name="categorie">
        <option value="">Toutes les catégories</option>
        ${Object.entries(CATEGORIES).map(([k, v]) =>
          `<option value="${k}"${categorie === k ? ' selected' : ''}>${e(v)}</option>`).join('')}
      </select>
      <button class="btn menu">Filtrer</button>
      ${categorie ? `<a class="lien" href="/inventaire">Tout revoir</a>` : ''}
    </form>

    ${matieres.length ? `<table class="tab stock">
      <thead><tr>
        <th>Matière</th><th class="num">Stock</th><th class="num">Besoin engagé</th>
        <th class="num">Manque</th><th>État</th>
      </tr></thead>
      <tbody>${matieres.map(m => `<tr>
        <td data-l="Matière"><a href="/matieres/${m.id}">${e(m.nom)}</a>
          <span class="sec">${e(CATEGORIES[m.categorie] || m.categorie)}${
            m.cout_unite ? ` · ${argent(m.cout_unite)}/${uniteFR(m.unite)}` : ''}</span></td>
        <td data-l="Stock" class="num">${m.suivi_stock
          ? (m.jamais_compte ? '<span class="sec">—</span>'
                             : qte(m.stock, uniteFR(m.unite)))
          : '<span class="sec">n/a</span>'}</td>
        <td data-l="Besoin" class="num">${m.besoin
          ? qte(m.besoin, uniteFR(m.unite)) : '<span class="sec">—</span>'}</td>
        <td data-l="Manque" class="num">${m.manque
          ? `<b class="rouge">${qte(m.manque, uniteFR(m.unite))}</b>`
          : '<span class="sec">—</span>'}</td>
        <td data-l="État">${pastille(m)}</td>
      </tr>`).join('')}</tbody>
    </table>` : `<p class="vide">Aucune matière${categorie ? ' dans cette catégorie' : ''}.
      ${admin ? 'Charge-les avec <code>node import.js --ecrire</code>.' : ''}</p>`}
  </section>

  <section>
    <h2>Produits finis</h2>
    <p class="pourquoi">Ce qui est fabriqué et prêt à partir. Le stock se déclare
    par un mouvement, comme pour les matières : la production entre, l'expédition
    sort.</p>
    ${produits.filter(p => !p.jamais_compte || p.seuil_alerte > 0).length
      ? `<table class="tab stock"><thead><tr>
          <th>Produit</th><th class="num">Prêt</th><th class="num">Seuil</th>
        </tr></thead><tbody>${produits
          .filter(p => !p.jamais_compte || p.seuil_alerte > 0).map(p => `<tr>
          <td data-l="Produit"><a href="/produits/${p.id}">${e(p.nom)}</a></td>
          <td data-l="Prêt" class="num">${p.sous_seuil
            ? `<b class="rouge">${qte(p.stock)}</b>` : qte(p.stock)}</td>
          <td data-l="Seuil" class="num">${p.seuil_alerte
            ? qte(p.seuil_alerte) : '<span class="sec">—</span>'}</td>
        </tr>`).join('')}</tbody></table>`
      : `<p class="vide">Aucun stock de produit fini déclaré. Il se saisit depuis
         la fiche d'un produit.</p>`}
  </section>`;

  return page({ titre: 'Inventaire', user, corps, actif: 'inventaire', msg });
}

/* ================================================================ matière */

function vueMatiere({ user, msg, m, mouvements, besoin, produits }) {
  const admin = user.role === 'admin';
  const u = uniteFR(m.unite);

  // Le formulaire de mouvement est en haut, pas en bas : c'est la raison
  // pour laquelle quelqu'un ouvre cette page depuis l'atelier.
  const saisie = `
    <section class="carte saisie-mvt">
      <h2>Enregistrer un mouvement</h2>
      <form method="post" action="/matieres/${m.id}/mouvements" class="mvt">
        <div class="champ">
          <label for="motif">Quoi</label>
          <select id="motif" name="motif">
            <option value="reception">Réception — il en arrive</option>
            <option value="consommation">Consommation — il en part en production</option>
            <option value="inventaire">Comptage — je déclare ce qu'il y a</option>
            <option value="perte">Perte, rebut</option>
            <option value="ajustement">Correction</option>
          </select>
        </div>
        <div class="champ">
          <label for="q">Quantité (${e(u)})</label>
          <input id="q" name="quantite" type="text" inputmode="decimal" required
                 placeholder="ex. 45,5">
        </div>
        <div class="champ large">
          <label for="ref">Référence <span class="sec">bon de commande, lot, n° d'ordre</span></label>
          <input id="ref" name="reference" type="text" maxlength="60">
        </div>
        <div class="champ large">
          <label for="n">Note</label>
          <input id="n" name="note" type="text" maxlength="200">
        </div>
        <button class="btn primaire">Enregistrer</button>
      </form>
      <p class="pourquoi">Une <b>consommation</b> et une <b>perte</b> se saisissent
      en positif : c'est le motif qui décide du signe. Un <b>comptage</b> ne
      s'ajoute pas au stock, il le REMPLACE — c'est le geste de l'inventaire
      physique, et l'écart avec ce que la base croyait est enregistré tel quel.</p>
    </section>`;

  const corps = `
  <p class="fil-ariane"><a href="/inventaire">Inventaire</a> ›
    ${e(CATEGORIES[m.categorie] || m.categorie)}</p>

  <div class="entete-liste">
    <h1>${e(m.nom)}${m.nom_ar ? ` <span class="ar" lang="ar" dir="rtl">${e(m.nom_ar)}</span>` : ''}</h1>
    ${admin ? `<a class="btn" href="/matieres/${m.id}/modifier">Modifier</a>` : ''}
  </div>
  <p class="sec"><code>${e(m.code)}</code>
    ${m.description ? ` · ${e(m.description)}` : ''}
    ${m.cout_unite ? ` · ${argent(m.cout_unite)} / ${e(u)}` : ''}
    ${m.fournisseur ? ` · ${e(m.fournisseur)}` : ''}
    ${m.delai_jours ? ` · délai ${m.delai_jours} j` : ''}</p>

  ${m.note ? `<div class="msg doux">${e(m.note)}</div>` : ''}

  ${m.suivi_stock ? `
  <section class="chiffres">
    <div class="chiffre${m.jamais_compte ? ' inconnu' : ''}">
      <b>${m.jamais_compte ? '?' : qte(m.stock, u)}</b>
      <span>en stock${m.emplacement ? ` · ${e(m.emplacement)}` : ''}</span>
    </div>
    <div class="chiffre">
      <b>${m.besoin ? qte(m.besoin, u) : '—'}</b>
      <span>besoin engagé</span>
    </div>
    <div class="chiffre${m.manque > 0 ? ' alerte' : ''}">
      <b>${m.manque > 0 ? qte(m.manque, u) : '—'}</b>
      <span>${m.manque > 0 ? `à commander · ${argent(m.cout_manque)}` : 'aucun manque'}</span>
    </div>
    <div class="chiffre">
      <b>${m.seuil_alerte ? qte(m.seuil_alerte, u) : '—'}</b>
      <span>seuil d'alerte</span>
    </div>
  </section>
  ${m.jamais_compte ? `<div class="msg doux">Cette matière n'a <b>aucun
    mouvement</b>. Son stock est inconnu, pas nul — le manque affiché ci-dessus
    la suppose à zéro, ce qui est le pire cas. Un comptage règle la question.</div>` : ''}
  ${saisie}` : `<div class="msg doux">Ligne de coût agrégée du chiffrier, pas un
    article en tablette : elle compte dans le coût de revient et reste hors de
    l'inventaire. ${admin ? 'Le suivi de stock se rétablit dans la fiche.' : ''}</div>`}

  <section>
    <h2>D'où vient le besoin</h2>
    ${besoin.length ? `<table class="tab"><thead><tr>
      <th>Produit</th><th class="num">Reste à produire</th>
      <th class="num">Par unité</th><th class="num">Besoin</th><th>Ordre</th>
    </tr></thead><tbody>${besoin.map(b => `<tr>
      <td data-l="Produit">${e(b.nom)}</td>
      <td data-l="Reste" class="num">${qte(b.restant)}</td>
      <td data-l="Par unité" class="num">${b.consommation === null
        ? '<span class="rouge">à chiffrer</span>' : qte(b.consommation, u)}</td>
      <td data-l="Besoin" class="num">${b.besoin === null
        ? '<span class="sec">—</span>' : `<b>${qte(b.besoin, u)}</b>`}</td>
      <td data-l="Ordre"><a href="/ordres/${b.ordre_id}">${e(b.numero)}</a></td>
    </tr>`).join('')}</tbody></table>`
    : `<p class="vide">Aucun ordre ouvert ne la consomme.</p>`}
  </section>

  <section>
    <h2>Produits qui l'utilisent</h2>
    ${produits.length ? `<ul class="flux">${produits.map(p => `<li>
      <a href="/produits/${p.id}">${e(p.nom)}</a>
      <span class="saut">${p.consommation === null ? 'consommation à établir'
        : qte(p.consommation, u) + ' par unité'}</span>
      <span class="sec">${p.cout_par_produit ? argent(p.cout_par_produit) + '/unité' : ''}${
        p.source === 'a_confirmer' ? ' · chiffrier à vérifier' : ''}${
        p.consommation_texte ? ` · « ${e(p.consommation_texte)} »` : ''}</span>
    </li>`).join('')}</ul>`
    : `<p class="vide">Aucune nomenclature ne la référence.</p>`}
  </section>

  <section>
    <h2>Mouvements</h2>
    ${mouvements.length ? `<ul class="flux">${mouvements.map(x => `<li>
      <span class="quand">${dateHeureFR(x.cree_le)}</span>
      <b class="${x.quantite < 0 ? 'rouge' : 'vert'}">${x.quantite > 0 ? '+' : ''}${
        qte(x.quantite, u)}</b>
      <span class="saut">${e(MOTIFS[x.motif] || x.motif)}</span>
      <span class="sec">${e(x.auteur || 'import')}${
        x.reference ? ` · ${e(x.reference)}` : ''}${x.note ? ` · ${e(x.note)}` : ''}</span>
    </li>`).join('')}</ul>`
    : `<p class="vide">Aucun mouvement.</p>`}
  </section>`;

  return page({ titre: m.nom, user, corps, actif: 'inventaire', msg });
}

/* ========================================================== fiche à éditer */

function vueMatiereForm({ user, m = null, msg }) {
  const v = (k, d = '') => e(m ? (m[k] ?? d) : d);
  const corps = `
  <p class="fil-ariane"><a href="/inventaire">Inventaire</a>${
    m ? ` › <a href="/matieres/${m.id}">${e(m.nom)}</a>` : ''}</p>
  <h1>${m ? 'Modifier' : 'Nouvelle matière'}</h1>

  <form method="post" action="${m ? `/matieres/${m.id}/modifier` : '/matieres/nouveau'}"
        class="carte formulaire">
    <div class="grille2">
      <div class="champ"><label for="code">Code</label>
        <input id="code" name="code" required maxlength="40" value="${v('code')}"
               ${m ? '' : 'placeholder="ex. VEGETO-150GSM"'}></div>
      <div class="champ"><label for="nom">Nom</label>
        <input id="nom" name="nom" required maxlength="120" value="${v('nom')}"></div>

      <div class="champ"><label for="nom_ar">Nom en arabe
        <span class="sec">l'atelier le lit dans sa langue</span></label>
        <input id="nom_ar" name="nom_ar" maxlength="120" lang="ar" dir="rtl"
               value="${v('nom_ar')}"></div>
      <div class="champ"><label for="cat">Catégorie</label>
        <select id="cat" name="categorie">${Object.entries(CATEGORIES).map(([k, l]) =>
          `<option value="${k}"${m && m.categorie === k ? ' selected' : ''}>${e(l)}</option>`
        ).join('')}</select></div>

      <div class="champ"><label for="unite">Unité de comptage</label>
        <select id="unite" name="unite">${UNITES.map(u =>
          `<option value="${u}"${m && m.unite === u ? ' selected' : ''}>${uniteFR(u)}</option>`
        ).join('')}</select></div>
      <div class="champ"><label for="cout">Coût par unité ($ CAD)</label>
        <input id="cout" name="cout_unite" type="text" inputmode="decimal"
               value="${m && m.cout_unite !== null ? e(m.cout_unite) : ''}"></div>

      <div class="champ"><label for="seuil">Seuil d'alerte
        <span class="sec">0 = pas d'alerte</span></label>
        <input id="seuil" name="seuil_alerte" type="text" inputmode="decimal"
               value="${v('seuil_alerte', 0)}"></div>
      <div class="champ"><label for="empl">Emplacement</label>
        <input id="empl" name="emplacement" maxlength="80" value="${v('emplacement')}"
               placeholder="ex. Atelier Tunisie"></div>

      <div class="champ"><label for="four">Fournisseur</label>
        <input id="four" name="fournisseur" maxlength="120" value="${v('fournisseur')}"></div>
      <div class="champ"><label for="delai">Délai d'approvisionnement (jours)</label>
        <input id="delai" name="delai_jours" type="number" min="0" max="999"
               value="${m && m.delai_jours !== null ? e(m.delai_jours) : ''}"></div>
    </div>

    <div class="champ"><label for="desc">Description</label>
      <input id="desc" name="description" maxlength="300" value="${v('description')}"></div>
    <div class="champ"><label for="photo">Photo <span class="sec">URL seulement —
      l'app n'héberge aucun fichier</span></label>
      <input id="photo" name="photo_url" type="url" maxlength="500" value="${v('photo_url')}"></div>
    <div class="champ"><label for="note">Note</label>
      <textarea id="note" name="note" rows="3">${v('note')}</textarea></div>

    <label class="case"><input type="checkbox" name="suivi_stock" value="1"
      ${!m || m.suivi_stock ? 'checked' : ''}> Suivre son stock
      <span class="sec">décoché : ligne de coût agrégée, hors inventaire</span></label>

    ${m ? `<label class="case"><input type="checkbox" name="actif" value="1"
      ${m.actif ? 'checked' : ''}> Active</label>` : ''}

    <div class="actions">
      <button class="btn primaire">Enregistrer</button>
      <a class="lien" href="${m ? `/matieres/${m.id}` : '/inventaire'}">Annuler</a>
    </div>
  </form>`;

  return page({ titre: m ? 'Modifier une matière' : 'Nouvelle matière',
                user, corps, actif: 'inventaire', msg });
}

/* ============================================================= calculateur
 * « 1 produit = tissu + isolant + quincaillerie + étiquette. » La question de
 * Gabriel, telle quelle. On y répond dans les deux sens :
 *
 *   en haut   pour N unités de CE produit, il faut ceci — et en ai-je assez
 *   en bas    tous ordres confondus, voici ce qu'il faut acheter
 *
 * Le premier sert à décider (« peut-on lancer les 500 tuques ? »), le second
 * à commander. C'est le même calcul lu par les deux bouts.
 */

function vueBesoins({ user, msg, produits, choix, quantite, calcul, engages }) {
  const total = (l) => l.reduce((n, x) => n + (x.cout_unite && x.besoin
    ? x.besoin * x.cout_unite : 0), 0);

  const simulateur = `
  <section class="carte">
    <h2>Pour combien d'unités ?</h2>
    <form method="get" class="calc">
      <div class="champ">
        <label for="p">Produit</label>
        <select id="p" name="produit">
          <option value="">Choisir…</option>
          ${produits.map(p => `<option value="${p.id}"${
            choix && choix.id === p.id ? ' selected' : ''}>${e(p.nom)}</option>`).join('')}
        </select>
      </div>
      <div class="champ">
        <label for="q">Quantité</label>
        <input id="q" name="quantite" type="number" min="1" max="1000000"
               value="${e(quantite || 100)}">
      </div>
      <button class="btn primaire">Calculer</button>
    </form>
  </section>

  ${!choix ? '' : !calcul.length
    ? `<p class="vide">Aucune nomenclature pour ${e(choix.nom)}.
       ${user.role === 'admin'
         ? `Elle se remplit depuis <a href="/produits/${choix.id}/modifier">sa fiche</a>.`
         : ''}</p>`
    : `<section>
    <h2>${e(choix.nom)} × ${Number(quantite).toLocaleString('fr-CA')}</h2>
    <table class="tab"><thead><tr>
      <th>Matière</th><th class="num">Par unité</th><th class="num">Il en faut</th>
      <th class="num">En stock</th><th>Verdict</th>
    </tr></thead><tbody>${calcul.map(x => `<tr>
      <td data-l="Matière"><a href="/matieres/${x.matiere_id}">${e(x.nom)}</a>
        <span class="sec">${e(CATEGORIES[x.categorie] || x.categorie)}</span></td>
      <td data-l="Par unité" class="num">${x.consommation === null
        ? '<span class="rouge">à chiffrer</span>' : qte(x.consommation, uniteFR(x.unite))}</td>
      <td data-l="Il en faut" class="num">${x.requis === null
        ? '<span class="sec">—</span>' : `<b>${qte(x.requis, uniteFR(x.unite))}</b>`}</td>
      <td data-l="En stock" class="num">${!x.suivi_stock ? '<span class="sec">n/a</span>'
        : x.jamais_compte ? '<span class="sec">inconnu</span>'
        : qte(x.stock, uniteFR(x.unite))}</td>
      <td data-l="Verdict">${
        !x.suivi_stock ? '<span class="etat hors">hors inventaire</span>'
        : x.requis === null ? '<span class="etat inconnu">à chiffrer</span>'
        : x.jamais_compte ? '<span class="etat inconnu">jamais compté</span>'
        : x.stock >= x.requis ? '<span class="etat ok">assez</span>'
        : `<span class="etat rupture">manque ${qte(x.requis - x.stock, uniteFR(x.unite))}</span>`}</td>
    </tr>`).join('')}</tbody></table>
    <p class="pourquoi">Coût matière de la série :
      <b>${argent(calcul.reduce((n, x) =>
        n + (x.cout_par_produit ? x.cout_par_produit * quantite : 0), 0))}</b>,
      soit ${argent(calcul.reduce((n, x) => n + (x.cout_par_produit || 0), 0))} par unité.
      ${calcul.some(x => x.cout_par_produit === null)
        ? 'Des lignes sans coût sont exclues du total.' : ''}
      Ce calcul ignore ce que les <b>autres</b> ordres ont déjà engagé sur les
      mêmes matières ; la liste du bas, elle, en tient compte.</p>
  </section>`}`;

  const corps = `
  <h1>Besoins en matières</h1>
  <p class="intro">Ce qu'un produit consomme, et ce que la production entière
  va demander.</p>

  ${simulateur}

  <section>
    <h2>Engagé par les ordres ouverts <span class="compte">${engages.length}</span></h2>
    <p class="pourquoi">Ce qu'il reste à consommer pour finir tout ce qui est
    déjà lancé — l'avancement déclaré est déduit. Trié par ce qui manque, puis
    par valeur : c'est l'ordre dans lequel commander, et l'ordre dans lequel
    compter ce qui n'a jamais été compté.</p>
    ${engages.length ? `<table class="tab"><thead><tr>
      <th>Matière</th><th class="num">Besoin</th><th class="num">Stock</th>
      <th class="num">Manque</th><th class="num">À commander</th>
    </tr></thead><tbody>${engages.map(m => `<tr>
      <td data-l="Matière"><a href="/matieres/${m.id}">${e(m.nom)}</a>
        <span class="sec">${m.produits} produit${m.produits > 1 ? 's' : ''}${
          m.produits_flous ? ` · ${m.produits_flous} à chiffrer` : ''}</span></td>
      <td data-l="Besoin" class="num">${qte(m.besoin, uniteFR(m.unite))}</td>
      <td data-l="Stock" class="num">${m.jamais_compte
        ? '<span class="sec">inconnu</span>' : qte(m.stock, uniteFR(m.unite))}</td>
      <td data-l="Manque" class="num">${m.manque
        ? `<b class="rouge">${qte(m.manque, uniteFR(m.unite))}</b>`
        : '<span class="sec">—</span>'}</td>
      <td data-l="À commander" class="num">${m.cout_manque
        ? argent(m.cout_manque) : '<span class="sec">—</span>'}</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="4">Valeur des matières engagées</td>
      <td class="num"><b>${argent(total(engages))}</b></td></tr>
    <tr><td colspan="4">Dont à commander</td>
      <td class="num"><b class="rouge">${argent(
        engages.reduce((n, m) => n + m.cout_manque, 0))}</b></td></tr></tfoot>
    </table>` : `<p class="vide">Aucun ordre ouvert ne consomme de matière chiffrée.</p>`}
  </section>`;

  return page({ titre: 'Besoins', user, corps, actif: 'besoins', msg });
}

module.exports = { vueInventaire, vueMatiere, vueMatiereForm, vueBesoins,
                   pastille, uniteFR, argent };
