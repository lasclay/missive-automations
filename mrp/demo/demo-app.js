/* Démo : navigation entre les vues pré-rendues, et saisie d'avancement qui
   recalcule ce que le serveur recalculerait. Rien ne sort du navigateur. */

const CLE = 'mrp-demo-avancements';
const initial = Object.fromEntries(ITEMS.map(i => [i.id, i.av]));
const etat = Object.assign({}, initial);

try {
  const gardé = JSON.parse(localStorage.getItem(CLE) || '{}');
  for (const k in gardé) if (k in etat) etat[k] = gardé[k];
} catch (e) { /* navigation privée, stockage bloqué : la démo marche pareil */ }

const garde = () => {
  try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) {}
};

// Exactement le format du serveur : il sépare les milliers avec une espace
// insécable étroite. Normaliser en espace ordinaire ferait que les nombres
// retouchés ici ne s'aligneraient plus avec ceux rendus par l'app.
const nb = n => Math.round(n).toLocaleString('fr-CA');
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

// ------------------------------------------------------------- navigation
function montre(vue) {
  const cible = document.querySelector('[data-vue="' + vue + '"]')
             || document.querySelector('[data-vue="accueil"]');
  $$('.vue').forEach(v => v.classList.toggle('on', v === cible));
  // Les photos ne prennent leur source qu'à l'affichage : la page s'ouvre vite
  // même avec toutes les fiches à l'intérieur.
  $$('img[data-img]', cible).forEach(im => {
    if (!im.getAttribute('src')) im.src = IMG[im.dataset.img] || '';
  });
  $$('nav.top a').forEach(a => a.classList.toggle('on', a.hash === '#' + vue));
  window.scrollTo(0, 0);
}

function route() { montre((location.hash || '#accueil').slice(1)); }
addEventListener('hashchange', route);

// ------------------------------------------------------------- avancement
/** Applique une valeur, puis remet à jour tout ce qui en dépend. */
function pose(itemId, valeur) {
  etat[itemId] = valeur;
  garde();
  rendItem(itemId);
  rendOrdre();
  rendResume();
}

function jauge(el, pct) {
  if (!el) return;
  el.className = 'jauge ' + (pct === 0 ? 'zero' : pct === 100 ? '' : 'part');
  const barre = el.querySelector('i');
  if (barre) barre.style.width = pct + '%';
}

function rendItem(id) {
  const pct = etat[id];
  const it = ITEMS.find(i => i.id === id);

  // la ligne de l'ordre de production
  const form = document.querySelector('form.av[action$="/items/' + id + '/avancement"]');
  if (form) {
    $$('button', form).forEach(b => b.classList.toggle('on', Number(b.value) === pct));
    const cell = form.closest('td');
    jauge(cell.querySelector('.jauge'), pct);
    const lbl = cell.querySelector('.pct');
    if (lbl) lbl.textContent = pct + ' %';
    const quand = cell.querySelector('.muted');
    if (quand) quand.textContent = 'Dernière mise à jour à l’instant';
  }

  // la ligne d'À fabriquer : le restant se recalcule
  const ligne = document.querySelector('[data-vue="priorites"] #i' + id);
  if (ligne && it) {
    jauge(ligne.querySelector('.av .jauge'), pct);
    const sec = ligne.querySelector('.av .sec');
    if (sec) sec.textContent = pct + ' %';
    const qte = ligne.querySelector('.qte b');
    if (qte) qte.textContent = nb(it.q * (100 - pct) / 100);
  }
}

function rendOrdre() {
  const vue = document.querySelector('[data-vue="ordres/1"]');
  if (!vue) return;
  let total = 0, faits = 0;
  for (const i of ITEMS) { total += i.q; faits += i.q * etat[i.id] / 100; }
  const pct = total ? Math.round(faits * 100 / total) : 0;
  jauge(vue.querySelector('.carte .jauge'), pct);
  const gros = vue.querySelector('.carte div[style*="font-size:30px"]');
  if (gros) gros.textContent = pct + ' %';
}

function rendResume() {
  const vue = document.querySelector('[data-vue="priorites"]');
  if (!vue) return;
  const parFamille = {};
  let restant = 0, aProduire = 0;
  for (const i of ITEMS) {
    const r = i.q * (100 - etat[i.id]) / 100;
    restant += r;
    if (etat[i.id] < 100) aProduire++;
    parFamille[i.fam] = (parFamille[i.fam] || 0) + r;
  }
  const c = $$('.chiffres .c b', vue);
  if (c[2]) c[2].textContent = nb(aProduire);
  if (c[3]) c[3].textContent = nb(restant);

  const ordre = ['hiver', 'nouveau', 'isotherme', 'autre'];
  const chiffres = $$('.repartition b', vue);
  ordre.forEach((f, n) => {
    if (chiffres[n]) chiffres[n].textContent = nb(parFamille[f] || 0);
  });
}

// ------------------------------------------------------------------ écoute
document.addEventListener('click', ev => {
  const inerte = ev.target.closest('[data-inerte]');
  if (inerte) { ev.preventDefault(); return; }

  const b = ev.target.closest('form.av button');
  if (b) {
    ev.preventDefault();
    const m = b.form.getAttribute('action').match(/\/items\/(\d+)\/avancement/);
    if (m) pose(Number(m[1]), Number(b.value));
    return;
  }

  if (ev.target.id === 'raz') {
    // On oublie la saisie et on recharge : la page revient au HTML du serveur
    // tel quel, plutôt qu'à une reconstitution qui pourrait en différer.
    try { localStorage.removeItem(CLE); } catch (e) {}
    location.reload();
  }
});

// Les formulaires du serveur ne mènent nulle part ici.
document.addEventListener('submit', ev => ev.preventDefault());

// ----------------------------------------------------------------- départ
// Tant que rien n'a été touché, on laisse en place les chiffres rendus par le
// serveur : ce sont eux la référence. Le recalcul ne prend la main qu'à partir
// de la première saisie, sinon un écart du modèle ferait mentir la démo sans
// que rien ne le signale.
const touche = ITEMS.some(i => etat[i.id] !== initial[i.id]);
if (touche) {
  ITEMS.forEach(i => rendItem(i.id));
  rendOrdre();
  rendResume();
}
route();
