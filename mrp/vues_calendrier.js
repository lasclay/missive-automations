/**
 * Lasclay — MRP : le calendrier mensuel
 * ---------------------------------------------------------------------------
 * Une grille de mois, comme le « Mensuel » du chiffrier de production, mais
 * remplie par le calcul au lieu d'être tenue à la main.
 *
 * Ce qu'elle montre, par journée : ce que l'atelier fabrique, combien d'heures
 * ça prend, ce qui est dû ce jour-là, et pourquoi une journée est vide quand
 * elle l'est. Rien n'y est saisi — tout vient de `charge.calendrier()`, qui
 * étale le plan sur la capacité disponible.
 *
 * C'est ce qui rend les blocs « dynamiques » au sens où Gabriel le demande :
 * il n'y a aucune date stockée à recaler. Fermer l'atelier une semaine,
 * changer la capacité, allonger une quantité, et la grille se redessine sans
 * trou ni chevauchement — parce qu'elle est recalculée, pas déplacée.
 *
 * Sous 720 px la grille devient une liste verticale : sept colonnes sur un
 * téléphone d'atelier ne se lisent pas, et un défilement latéral encore moins.
 */
'use strict';
const { e, page, dateFR, TYPES_JALON } = require('./vues.js');

const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const iso = (d) => d.toISOString().slice(0, 10);
const jourMs = 864e5;
/** Lundi de la semaine d'une date — le calendrier de l'atelier commence lundi. */
function lundi(d) {
  const x = new Date(d.getTime());
  const j = x.getUTCDay();                       // 0 = dimanche
  x.setUTCDate(x.getUTCDate() - (j === 0 ? 6 : j - 1));
  return x;
}
const moisNom = (cle) => {
  const [a, m] = cle.split('-').map(Number);
  return `${MOIS[m - 1]} ${a}`;
};
const decale = (cle, n) => {
  const [a, m] = cle.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

/**
 * Huit teintes qui tournent, attribuées par ordre de fabrication. La couleur
 * ne veut rien dire en soi : elle sert à suivre un même item d'une case à
 * l'autre. Les classes vivent dans la feuille de style pour que le mode sombre
 * les suive — une couleur écrite en dur dans le HTML ne s'adapte à rien.
 */
const TEINTES = 8;

function vueCalendrier({ user, msg, mois, cal, jalons, teintes }) {
  const auj = iso(new Date());
  const cap = cal.capaciteJour;

  // Les jalons, indexés par jour.
  const parJour = {};
  for (const j of jalons) (parJour[j.date] ||= []).push(j);

  // La grille couvre des semaines entières : un mois qui commence un jeudi
  // laisse trois cases au mois précédent, et c'est bien — la semaine est
  // l'unité de travail de l'atelier, pas le mois.
  const [an, mo] = mois.split('-').map(Number);
  const premier = new Date(Date.UTC(an, mo - 1, 1));
  const dernier = new Date(Date.UTC(an, mo, 0));
  const depart = lundi(premier);
  const semaines = [];
  for (let d = new Date(depart); d <= dernier || semaines.length === 0
       || (semaines[semaines.length - 1].length < 7);
       d = new Date(d.getTime() + jourMs)) {
    if (!semaines.length || semaines[semaines.length - 1].length === 7)
      semaines.push([]);
    semaines[semaines.length - 1].push(new Date(d));
    if (d >= dernier && semaines[semaines.length - 1].length === 7) break;
  }

  const heuresDuJour = (k) => (cal.parJour.get(k) || [])
    .reduce((n, x) => n + x.heures, 0);

  const chip = (x) => {
    const t = teintes.get(x.code) ?? 0;
    const h = x.heures >= 10 ? Math.round(x.heures) : x.heures.toFixed(1);
    return `<a class="cal-chip t${t % TEINTES}" href="/produits/${x.produit_id}"
      title="${e(x.nom)} — ${h} h ce jour-là">${e(x.code)}<b>${h} h</b></a>`;
  };

  const case_ = (d) => {
    const k = iso(d);
    const horsMois = d.getUTCMonth() !== mo - 1;
    const js = d.getUTCDay();
    const ferme = cal.fermes.has(k);
    const chome = js === 0 || js > cal.cap.jours_semaine;
    const items = cal.parJour.get(k) || [];
    const heures = heuresDuJour(k);
    const pleine = cap ? Math.min(100, Math.round((heures / cap) * 100)) : 0;
    const cls = ['cal-j'];
    if (horsMois) cls.push('hors');
    if (k === auj) cls.push('auj');
    if (ferme) cls.push('ferme');
    else if (chome) cls.push('chome');
    if (items.length) cls.push('occupe');

    return `<td class="${cls.join(' ')}">
      <div class="cal-tete">
        <span class="cal-num">${d.getUTCDate()}${d.getUTCDate() === 1
          ? ` <span class="cal-mo">${MOIS[d.getUTCMonth()].slice(0, 4)}</span>` : ''}</span>
        ${heures > 0 ? `<span class="cal-h">${Math.round(heures)} h</span>` : ''}
      </div>
      ${heures > 0 ? `<div class="cal-jauge"><i style="width:${pleine}%"></i></div>` : ''}
      ${(parJour[k] || []).map(j => `<a class="cal-jalon jt-${j.type}"
         href="/ordres/${j.ordre_id}"
         title="${e(TYPES_JALON[j.type] || j.type)} — ${e(j.titre)}"
         >${e(j.titre)}</a>`).join('')}
      ${items.map(chip).join('')}
      ${ferme && !items.length ? `<span class="cal-note"
         >${e(cal.fermes.get(k))}</span>` : ''}
    </td>`;
  };

  // Le résumé du mois : ce que la grille dit, en trois nombres, pour ceux qui
  // arrivent sans vouloir tout lire.
  const duMois = [...cal.parJour.entries()].filter(([k]) => k.startsWith(mois));
  const heuresMois = duMois.reduce((n, [, v]) =>
    n + v.reduce((m, x) => m + x.heures, 0), 0);
  const codesMois = new Set(duMois.flatMap(([, v]) => v.map(x => x.code)));
  const jalonsMois = jalons.filter(j => j.date.startsWith(mois));

  const corps = `
  <div class="entete"><div>
    <h1>Calendrier</h1>
    <p class="muted">Ce que l'atelier fabrique, jour par jour</p>
  </div>
  <div class="cal-nav">
    <a class="btn sec" href="/calendrier?mois=${decale(mois, -1)}"
       title="Mois précédent">‹</a>
    <a class="btn sec" href="/calendrier">Aujourd'hui</a>
    <a class="btn sec" href="/calendrier?mois=${decale(mois, 1)}"
       title="Mois suivant">›</a>
  </div></div>

  <h2 class="cal-titre">${moisNom(mois)}</h2>

  <div class="chiffres cal-somm">
    <div class="c"><b>${Math.round(heuresMois).toLocaleString('fr-CA')}</b>heures de
      production ce mois-ci</div>
    <div class="c"><b>${codesMois.size}</b>item${codesMois.size > 1 ? 's' : ''} en
      fabrication</div>
    <div class="c"><b>${jalonsMois.length}</b>date${jalonsMois.length > 1 ? 's' : ''} clé${
      jalonsMois.length > 1 ? 's' : ''}</div>
    <div class="c"><b>${cap}</b>heures d'atelier par jour
      <span class="sec">${cal.cap.postes} postes × ${cal.cap.heures_jour} h</span></div>
  </div>

  <div class="tbl cal-cadre"><table class="cal">
    <thead><tr>${JOURS.map((j, i) =>
      `<th${i >= cal.cap.jours_semaine ? ' class="chome"' : ''}>${j}</th>`).join('')}</tr></thead>
    <tbody>${semaines.map(sem =>
      `<tr>${sem.map(case_).join('')}</tr>`).join('')}</tbody>
  </table></div>

  <div class="cal-legende">
    <span><i class="ex-occupe"></i> journée de production, remplissage à
      l'échelle des ${cap} h disponibles</span>
    <span><i class="ex-ferme"></i> atelier fermé — pause posée à la cédule</span>
    <span><i class="ex-chome"></i> hors des ${cal.cap.jours_semaine} jours
      travaillés par semaine</span>
  </div>

  <div class="carte">
    <p class="sec" style="margin:0">Aucune de ces dates n'est enregistrée :
    elles sont recalculées à chaque affichage, en étalant ce qui reste à produire
    sur la capacité disponible. C'est pour ça qu'il n'y a jamais de trou ni de
    chevauchement — fermer l'atelier une semaine ou changer une quantité
    redessine tout le mois, et les jours suivants se recalent d'eux-mêmes.
    Les leviers sont à la <a href="/cedule">cédule</a> : date de départ,
    capacité, pauses, et la priorité de chaque item à
    <a href="/priorites">À fabriquer</a>.</p>
  </div>`;

  return page({ titre: `Calendrier — ${moisNom(mois)}`, user, corps,
                actif: 'calendrier', msg });
}

module.exports = { vueCalendrier, moisNom, decale, lundi, TEINTES, MOIS, JOURS };
