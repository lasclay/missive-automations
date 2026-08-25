/* Démo : deux rôles, navigation entre les vues pré-rendues, et les deux gestes
   réels de l'app — l'atelier déclare un avancement, Québec pose une priorité.
   Chaque geste recalcule ce que le serveur recalculerait. Rien ne sort du
   navigateur. */

const CLE = 'mrp-demo-v2';
const RANG_PRIORITE = { haute: 0, normale: 1, basse: 2 };
const RANG_FAMILLE = { hiver: 0, nouveau: 1, isotherme: 2, autre: 3 };

const depart = Object.fromEntries(ITEMS.map(i => [i.id, { av: i.av, pri: i.pri }]));
const etat = {};
for (const k in depart) etat[k] = { ...depart[k] };

let role = 'admin';
let journal = [];          // ce qui a été posé pendant la démo, le plus récent d'abord

try {
  const gardé = JSON.parse(localStorage.getItem(CLE) || 'null');
  if (gardé && gardé.etat) {
    for (const k in gardé.etat) if (k in etat) etat[k] = gardé.etat[k];
    journal = Array.isArray(gardé.journal) ? gardé.journal : [];
    if (gardé.role === 'atelier' || gardé.role === 'admin') role = gardé.role;
  }
} catch (e) { /* navigation privée, stockage bloqué : la démo marche pareil */ }

const garde = () => {
  try { localStorage.setItem(CLE, JSON.stringify({ etat, journal, role })); } catch (e) {}
};

// Exactement le format du serveur : il sépare les milliers avec une espace
// insécable étroite. Normaliser en espace ordinaire ferait que les nombres
// retouchés ici ne s'aligneraient plus avec ceux rendus par l'app.
const nb = n => Math.round(n).toLocaleString('fr-CA');
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const item = id => ITEMS.find(i => i.id === id);
const ech = s => String(s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Rien n'a encore été touché : les chiffres du serveur font foi. */
const intact = () => !journal.length
  && ITEMS.every(i => etat[i.id].av === depart[i.id].av
                   && etat[i.id].pri === depart[i.id].pri);

// ------------------------------------------------------------- navigation
function vuesDe(nom) {
  return $$(`[data-vue="${nom}"][data-role="${role}"]`);
}

function montre(nom) {
  let cibles = vuesDe(nom);
  if (!cibles.length) { nom = 'accueil'; cibles = vuesDe(nom); }
  $$('.vue').forEach(v => v.classList.toggle('on', cibles.includes(v)));
  // Les photos ne prennent leur source qu'à l'affichage : la page s'ouvre vite
  // même avec toutes les fiches à l'intérieur.
  cibles.forEach(c => $$('img[data-img]', c).forEach(im => {
    if (!im.getAttribute('src')) im.src = IMG[im.dataset.img] || '';
  }));
  $$('nav.top a').forEach(a => a.classList.toggle('on', a.hash === '#' + nom));
  window.scrollTo(0, 0);
}

const vueCourante = () => (location.hash || '#accueil').slice(1);
function route() { montre(vueCourante()); }
addEventListener('hashchange', route);

// ------------------------------------------------------------ les gestes
function poseAvancement(id, valeur) {
  const it = item(id);
  const avant = etat[id].av;
  if (avant === valeur) return;
  etat[id].av = valeur;
  journal.unshift({ code: it.code, avant, apres: valeur, q: it.q, par: signature() });
  journal = journal.slice(0, 40);
  garde();
  toutRendre();
}

function posePriorite(id, valeur) {
  if (etat[id].pri === valeur) return;
  etat[id].pri = valeur;
  garde();
  toutRendre();
}

const signature = () => role === 'atelier' ? 'Montassar' : 'Direction';

// ------------------------------------------------------------- rendu
function jauge(el, pct) {
  if (!el) return;
  el.className = 'jauge ' + (pct === 0 ? 'zero' : pct === 100 ? '' : 'part');
  const barre = el.querySelector('i');
  if (barre) barre.style.width = pct + '%';
}

function rendItems() {
  for (const it of ITEMS) {
    const pct = etat[it.id].av;

    // la ligne de l'ordre de production, dans les deux rôles
    for (const form of $$(`form.av[action$="/items/${it.id}/avancement"]`)) {
      $$('button', form).forEach(b => b.classList.toggle('on', Number(b.value) === pct));
      const cell = form.closest('td');
      jauge(cell.querySelector('.jauge'), pct);
      const lbl = cell.querySelector('.pct');
      if (lbl) lbl.textContent = pct + ' %';
      const quand = cell.querySelector('.muted');
      if (quand) quand.textContent = 'Dernière mise à jour à l’instant';
    }

    // la ligne d'À fabriquer : le restant et la priorité
    for (const ligne of $$(`[data-vue="priorites"] #i${it.id}`)) {
      jauge(ligne.querySelector('.av .jauge'), pct);
      const sec = ligne.querySelector('.av .sec');
      if (sec) sec.textContent = pct + ' %';
      const qte = ligne.querySelector('.qte b');
      if (qte) qte.textContent = nb(it.q * (100 - pct) / 100);
      ligne.className = 'p-' + etat[it.id].pri;
      const sel = ligne.querySelector('.pri select');
      if (sel) sel.value = etat[it.id].pri;
      const fixe = ligne.querySelector('.pri');
      if (fixe && !sel) fixe.textContent =
        { haute: 'Haute', normale: 'Normale', basse: 'Basse' }[etat[it.id].pri];
    }
  }
}

/** Le tri de db.js, à l'identique. Changer une priorité réordonne la liste. */
function rendTri() {
  for (const vue of $$('[data-vue="priorites"]')) {
    const corps = vue.querySelector('table.fab tbody');
    if (!corps) continue;
    const rangs = $$('tr', corps).map(tr => {
      const it = item(Number(tr.id.slice(1)));
      return { tr, it };
    }).filter(r => r.it);
    rangs.sort((a, b) =>
         RANG_PRIORITE[etat[a.it.id].pri] - RANG_PRIORITE[etat[b.it.id].pri]
      || (b.it.retard - a.it.retard)
      || (a.it.jours ?? 99999) - (b.it.jours ?? 99999)
      || (RANG_FAMILLE[a.it.fam] ?? 3) - (RANG_FAMILLE[b.it.fam] ?? 3)
      || (b.it.q * (100 - etat[b.it.id].av)) - (a.it.q * (100 - etat[a.it.id].av)));
    rangs.forEach((r, i) => {
      corps.appendChild(r.tr);
      const n = r.tr.querySelector('.num');
      if (n) n.textContent = i + 1;
    });
  }
}

function rendOrdre() {
  let total = 0, faits = 0;
  for (const i of ITEMS) { total += i.q; faits += i.q * etat[i.id].av / 100; }
  const pct = total ? Math.round(faits * 100 / total) : 0;
  for (const vue of $$('[data-vue="ordres/1"]')) {
    jauge(vue.querySelector('.carte .jauge'), pct);
    const gros = vue.querySelector('.carte div[style*="font-size:30px"]');
    if (gros) gros.textContent = pct + ' %';
  }
}

function rendResume() {
  // « À fabriquer » ne compte que l'atelier : les lignes fabriquées ailleurs
  // ne sont pas dans le tableau, donc pas dans ces totaux non plus.
  for (const vue of $$('[data-vue="priorites"]')) {
    const ids = $$('table.fab tbody tr', vue).map(tr => Number(tr.id.slice(1)));
    const parFamille = {};
    let restant = 0, aProduire = 0;
    for (const id of ids) {
      const it = item(id); if (!it) continue;
      const r = it.q * (100 - etat[id].av) / 100;
      restant += r;
      if (etat[id].av < 100) aProduire++;
      parFamille[it.fam] = (parFamille[it.fam] || 0) + r;
    }
    const c = $$('.chiffres .c b', vue);
    if (c[2]) c[2].textContent = nb(aProduire);
    if (c[3]) c[3].textContent = nb(restant);
    const chiffres = $$('.repartition b', vue);
    ['hiver', 'nouveau', 'isotherme', 'autre'].forEach((f, n) => {
      if (chiffres[n]) chiffres[n].textContent = nb(parFamille[f] || 0);
    });
  }
}

/** Le suivi se remplit à mesure : c'est la boucle complète de la méthode. */
function rendSuivi() {
  for (const vue of $$('[data-vue="suivi"]')) {
    const blocs = $$('section.bloc', vue);
    const avance = blocs[1], flux = blocs[2];
    if (!avance || !flux) continue;

    if (!journal.length) continue;   // les états vides du serveur font foi

    const unites = journal.reduce((s, j) => s + j.q * (j.apres - j.avant) / 100, 0);
    avance.innerHTML = `<h2>Avancé sur 7 jours</h2>
      <div class="tbl"><table class="items">
        <thead><tr><th>Ordre</th><th>Mises à jour</th><th>Unités avancées</th></tr></thead>
        <tbody><tr>
          <td><b>OP-2026-0001</b> <span class="sec">Plan de production 26-27 — prévente automne</span></td>
          <td class="c-maj">${journal.length}</td>
          <td class="c-unites"><b>${nb(unites)}</b></td>
        </tr></tbody>
      </table></div>
      <p class="sec">« Unités avancées » = la progression convertie en pièces :
      passer 2000 cache-cous de 40 à 70 % compte pour 600.</p>`;

    flux.innerHTML = `<h2>Dernières mises à jour</h2>
      <ul class="flux">${journal.map(j => `<li>
        <span class="quand">à l’instant</span>
        <b>${ech(j.par)}</b>
        <a href="#ordres/1">${ech(j.code)}</a>
        <span class="saut">${j.avant} %&nbsp;→&nbsp;<b>${j.apres} %</b></span>
        <span class="sec">OP-2026-0001</span>
      </li>`).join('')}</ul>`;
  }
}

// Une fois qu'on a retouché le DOM, il faut continuer à le retoucher — y
// compris pour revenir à l'état de départ. Sans ce drapeau, annuler une
// priorité laissait la page sur l'état précédent : `intact()` redevenait vrai
// et le rendu s'arrêtait avant d'avoir défait quoi que ce soit.
let dejaRendu = false;

function toutRendre() {
  if (intact() && !dejaRendu) return;   // rien touché : le HTML du serveur fait foi
  dejaRendu = true;
  rendItems();
  rendTri();
  rendOrdre();
  rendResume();
  rendSuivi();
}

// ------------------------------------------------------------------ écoute
function changeRole(r) {
  role = r;
  garde();
  $$('.ruban button[data-role]').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.role === r)));
  const qui = document.getElementById('qui');
  if (qui) qui.textContent = r === 'atelier' ? 'Montassar · atelier' : 'Direction';
  montre(vueCourante());
}

document.addEventListener('click', ev => {
  const bascule = ev.target.closest('.ruban button[data-role]');
  if (bascule) { changeRole(bascule.dataset.role); return; }

  if (ev.target.id === 'raz') {
    // On oublie la saisie et on recharge : la page revient au HTML du serveur
    // tel quel, plutôt qu'à une reconstitution qui pourrait en différer.
    try { localStorage.removeItem(CLE); } catch (e) {}
    location.reload();
    return;
  }

  if (ev.target.closest('[data-inerte]')) { ev.preventDefault(); return; }

  const b = ev.target.closest('form.av button');
  if (b) {
    ev.preventDefault();
    const m = b.form.getAttribute('action').match(/\/items\/(\d+)\/avancement/);
    if (m) poseAvancement(Number(m[1]), Number(b.value));
  }
});

document.addEventListener('change', ev => {
  const sel = ev.target.closest('form[action^="/priorites/"] select');
  if (!sel) return;
  const m = sel.form.getAttribute('action').match(/\/priorites\/(\d+)/);
  if (m) posePriorite(Number(m[1]), sel.value);
});

// Les formulaires du serveur ne mènent nulle part ici.
document.addEventListener('submit', ev => ev.preventDefault());

// ----------------------------------------------------------------- départ
changeRole(role);
toutRendre();
route();
