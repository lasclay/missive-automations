/**
 * Sort le Gantt de production dans une page autonome, à ouvrir ou à envoyer.
 *
 * L'app est faite pour la connexion tunisienne : pas de JS, tout au plus
 * quelques kilo-octets. Cet export a un autre métier — il est regardé sur un
 * écran, discuté, transmis. Il peut donc se permettre ce que l'app s'interdit :
 * de vraies polices, un axe de temps dessiné, et le basculement entre les trois
 * périmètres, qui est LA question ouverte du plan.
 *
 * Les chiffres viennent de la même base que la page /cedule. Rien n'est recopié
 * à la main : régénérer après chaque révision du plan.
 *
 *   node mrp/tools/gantt_export.js > /chemin/gantt.html
 */
'use strict';
const C = require('../charge.js');
const { db, listeFabrication } = require('../db.js');

const e = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ------------------------------------------------------------------ données
const lignes = listeFabrication();
if (!lignes.length) { console.error('Rien à fabriquer.'); process.exit(1); }

const auj = new Date().toISOString().slice(0, 10);
const cap = C.capacite();
const jalons = db.prepare(`SELECT titre, date, type FROM ordre_jalons
                           WHERE date >= ? ORDER BY date`).all(auj);
const echeance = jalons.length ? jalons[0] : null;
const noms = Object.fromEntries(
  db.prepare(`SELECT code, nom FROM produits`).all().map(p => [p.code, p.nom]));

/** Les jours ouvrés d'ici l'échéance : le dénominateur du verdict. */
function joursOuvres(du, au) {
  let n = 0;
  for (let x = new Date(du + 'T00:00:00Z'); x < new Date(au + 'T00:00:00Z');
       x = new Date(x.getTime() + 864e5)) {
    const j = x.getUTCDay();
    if (j !== 0 && j <= cap.jours_semaine) n++;
  }
  return n;
}
const jours = echeance ? joursOuvres(auj, echeance.date) : 0;
const dispo = jours * cap.postes * cap.heures_jour;

const PERIMS = [
  ['tout', 'Préparation + assemblage'],
  ['assemblage', 'Assemblage seulement'],
  ['preparation', 'Préparation seulement'],
];

const scenarios = PERIMS.map(([cle, libelle]) => {
  const cal = C.calendrier(lignes, { perim: cle, cap });
  return { cle, libelle, cal };
});

// La fenêtre du diagramme est commune aux trois : sinon changer de périmètre
// ferait bouger l'échelle, et on croirait que les barres ont bougé.
const bornes = [
  ...scenarios.map(s => s.cal.debut), ...scenarios.map(s => s.cal.fin),
  ...jalons.map(j => j.date),
].filter(Boolean).sort();
const d0 = new Date(bornes[0] + 'T00:00:00Z');
const d1 = new Date(bornes[bornes.length - 1] + 'T00:00:00Z');
const etendue = Math.max(1, (d1 - d0) / 864e5);
const pos = (iso) => ((new Date(iso + 'T00:00:00Z') - d0) / 864e5 / etendue) * 100;

const mois = [];
{
  // La fenêtre commence en cours de mois : le 1er de ce mois-là est hors cadre,
  // et sans repère au départ tout le premier pan du rail reste anonyme.
  mois.push({ x: 0, nom: d0.toLocaleDateString('fr-CA', { month: 'long', timeZone: 'UTC' }),
              muet: true });
  const c = new Date(d0); c.setUTCDate(1);
  while (c <= d1) {
    const iso = c.toISOString().slice(0, 10);
    if (c > d0) mois.push({ x: pos(iso),
      nom: c.toLocaleDateString('fr-CA', { month: 'long', timeZone: 'UTC' }) });
    c.setUTCMonth(c.getUTCMonth() + 1);
  }
}

const nb = (n) => Math.round(n).toLocaleString('fr-CA').replace(/ | /g, ' ');
const dateFR = (d) => {
  const x = new Date(d + 'T00:00:00Z');
  const jour = x.getUTCDate();
  const m = x.toLocaleDateString('fr-CA', { month: 'long', timeZone: 'UTC' });
  // « 1er octobre », pas « 1 octobre » : c'est le seul jour du mois qui s'écrit
  // en ordinal, et c'est justement celui de l'expédition.
  return `${jour === 1 ? '1er' : jour} ${m}`;
};

/** Ce que porte une ligne, et à quel point on peut s'y fier. */
const PROVENANCE = {
  'deux':         ['mesuré',  'préparation chronométrée + assemblage facturé'],
  'chrono-total': ['mesuré',  'chronométré, total complet'],
  'chrono':       ['mesuré',  'chronométré, relevé partiel — plancher'],
  'bmb':          ['facturé', "prix d'assemblage BMB"],
  'cout':         ['facturé', 'coût de confection de la fiche COGS'],
  'estime':       ['estimé',  'estimation à la main, ancrée sur un produit voisin'],
  'aucune':       ['inconnu', 'aucune source'],
};
const CLASSE = { 'mesuré': 'mesure', 'facturé': 'facture', 'estimé': 'estime', 'inconnu': 'estime' };

const min = (s) => Math.round(s / 60);
function composition(t) {
  const p = [];
  if (t.preparation) p.push(`${min(t.preparation)} min de préparation`);
  if (t.assemblage) p.push(`${min(t.assemblage)} min d'assemblage`);
  return p.join(' + ') || 'aucun temps connu';
}

// ------------------------------------------------------------------- rendu
function rangee(t, i) {
  const g = pos(t.debut), l = Math.max(0.7, pos(t.fin) - g);
  const tard = echeance && t.fin > echeance.date;
  const retard = tard ? joursOuvres(echeance.date, t.fin) : 0;
  const [etiquette, explication] = PROVENANCE[t.temps.source] || ['inconnu', ''];
  const titre = `${t.code} — ${nb(t.heures)} h, du ${dateFR(t.debut)} au ${dateFR(t.fin)}`
    + `\n${nb(t.restant)} pièces × ${composition(t.temps)}`
    + `\n${explication}${tard ? `\n${retard} jours ouvrés après l'expédition` : ''}`;
  return `<tr${tard ? ' class="tard"' : ''}>
  <td class="rang">${i + 1}</td>
  <td class="quoi">
    <span class="code">${e(t.code)}</span>
    <span class="nom">${e(noms[t.code] || '')}</span>
  </td>
  <td class="heures">${nb(t.heures)} h</td>
  <td class="prov"><span class="jeton ${CLASSE[etiquette]}">${etiquette}</span>${
    t.temps.divergent ? '<span class="jeton alerte">sources divergentes</span>' : ''}</td>
  <td class="piste">
    <div class="rail" title="${e(titre)}">
      ${mois.filter(m => !m.muet).map(m => `<i class="mois" style="left:${m.x}%"></i>`).join('')}
      ${jalons.map(j => `<i class="jalon" style="left:${pos(j.date)}%"></i>`).join('')}
      <i class="barre${tard ? ' barre-tard' : ''}" style="left:${g}%;width:${l}%"></i>
      ${tard ? (() => {
        // Près du bord droit, l'étiquette passe À GAUCHE de la barre : sinon
        // elle sort du rail et « +6 j » se lit « +6 ».
        const fin = g + l;
        return fin > 86
          ? `<b class="retard avant" style="right:${100 - g}%">+${retard} j</b>`
          : `<b class="retard" style="left:${fin}%">+${retard} j</b>`;
      })() : ''}
    </div>
  </td>
</tr>`;
}

function bloc(s) {
  const h = s.cal.heuresTotal;
  const ecart = dispo - h;
  const rentre = ecart >= 0;
  return `<section class="scenario" id="s-${s.cle}" ${s.cle === 'tout' ? '' : 'hidden'}>
  <div class="verdict ${rentre ? 'ok' : 'non'}">
    <div class="chiffres">
      <div><span class="n">${nb(h)}</span><span class="l">heures de travail</span></div>
      <div><span class="n">${nb(dispo)}</span><span class="l">heures disponibles</span></div>
      <div><span class="n">${rentre ? '+' : '−'}${nb(Math.abs(ecart))}</span
        ><span class="l">${rentre ? 'de marge' : "d'écart"}</span></div>
    </div>
    <p>${rentre
      ? `<b>Ça rentre.</b> Le dernier item sort de l'atelier le ${dateFR(s.cal.fin)},
         ${nb(ecart)} heures avant l'expédition.`
      : `<b>Ça ne rentre pas.</b> Il manque ${nb(-ecart)} heures. Le plan se termine le
         ${dateFR(s.cal.fin)}. À ${cap.heures_jour} h par jour, il faudrait
         <b>${Math.ceil(h / (jours * cap.heures_jour))} postes</b> au lieu de
         ${cap.postes}, ou déplacer une partie du plan.`}</p>
  </div>

  <div class="cadre">
    <table class="gantt">
      <thead><tr>
        <th class="rang">#</th><th>Produit</th><th class="heures">Charge</th>
        <th>Temps</th>
        <th class="piste"><div class="echelle">
          ${mois.map(m => `<span style="left:${m.x}%">${m.nom}</span>`).join('')}
          ${jalons.map(j => `<b class="marque" style="left:${pos(j.date)}%">${
            e(j.titre)} · ${dateFR(j.date)}</b>`).join('')}
        </div></th>
      </tr></thead>
      <tbody>${s.cal.taches.map(rangee).join('')}</tbody>
    </table>
  </div>
</section>`;
}

// ------------------------------------------------------------------- page
const CSS = `
:root{
  color-scheme:light dark;
  --fond:#fbfbfa; --carte:#fff; --creux:#f4f5f4;
  --encre:#12161c; --encre2:#4a535d; --sourd:#767f89;
  --trait:#e2e6ea; --trait2:#eef1f3;
  /* Marques de données. Steps validés sur les deux fonds : bande de clarté,
     plancher de chroma, séparation daltonienne, contraste. */
  --barre:#127a4a; --barre-tard:#c62828;
  --mesure:#127a4a; --facture:#2f6fc4; --estime:#c25c12;
  --mesure-f:#e9f4ee; --facture-f:#eaf1fb; --estime-f:#fbeee4;
  --rail:#eceff1;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --fond:#0f1316; --carte:#171c21; --creux:#1c2228;
  --encre:#e6ebe6; --encre2:#b3bcc4; --sourd:#8b959e;
  --trait:#272e35; --trait2:#20262c;
  --barre:#22a065; --barre-tard:#ef5f4d;
  --mesure:#22a065; --facture:#5590e2; --estime:#cc7a2e;
  --mesure-f:#12251c; --facture-f:#121d2c; --estime-f:#2a1d10;
  --rail:#232a30;
}}
:root[data-theme="dark"]{
  --fond:#0f1316; --carte:#171c21; --creux:#1c2228;
  --encre:#e6ebe6; --encre2:#b3bcc4; --sourd:#8b959e;
  --trait:#272e35; --trait2:#20262c;
  --barre:#22a065; --barre-tard:#ef5f4d;
  --mesure:#22a065; --facture:#5590e2; --estime:#cc7a2e;
  --mesure-f:#12251c; --facture-f:#121d2c; --estime-f:#2a1d10;
  --rail:#232a30;
}
*{box-sizing:border-box}
body{margin:0;background:var(--fond);color:var(--encre);
  font:400 15px/1.55 "IBM Plex Sans","Segoe UI",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased}
.page{max-width:1180px;margin:0 auto;padding:36px 22px 72px;
  display:flex;flex-direction:column;gap:26px}

/* ---- en-tête */
.eyebrow{font:600 11px/1 "IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.14em;text-transform:uppercase;color:var(--sourd);margin:0 0 10px}
h1{font:700 clamp(30px,5vw,44px)/1.05 Archivo,"Segoe UI",system-ui,sans-serif;
  letter-spacing:-.022em;margin:0;text-wrap:balance}
.sous{margin:10px 0 0;max-width:62ch;color:var(--encre2);font-size:16px}
.meta{display:flex;flex-wrap:wrap;gap:8px 26px;margin-top:16px;
  font:400 13px/1.4 "IBM Plex Mono",ui-monospace,monospace;color:var(--sourd)}
.meta b{color:var(--encre2);font-weight:500}

/* ---- bascule de périmètre */
.bascule{background:var(--carte);border:1px solid var(--trait);border-radius:12px;padding:18px 20px}
.bascule h2{font:600 15px/1.3 Archivo,system-ui,sans-serif;margin:0 0 4px;letter-spacing:-.01em}
.bascule p{margin:0 0 14px;color:var(--encre2);font-size:14px;max-width:74ch}
.choix{display:flex;flex-wrap:wrap;gap:8px}
.choix button{font:500 14px/1 "IBM Plex Sans",system-ui,sans-serif;cursor:pointer;
  padding:9px 14px;border-radius:99px;border:1px solid var(--trait);
  background:var(--creux);color:var(--encre2);transition:none}
.choix button:hover{border-color:var(--sourd)}
.choix button:focus-visible{outline:2px solid var(--barre);outline-offset:2px}
.choix button[aria-pressed="true"]{background:var(--encre);color:var(--fond);border-color:var(--encre)}

/* ---- verdict */
.verdict{background:var(--carte);border:1px solid var(--trait);
  border-left:3px solid var(--barre);border-radius:12px;padding:20px 22px;margin-bottom:18px}
.verdict.non{border-left-color:var(--barre-tard)}
.chiffres{display:flex;flex-wrap:wrap;gap:12px 46px;margin-bottom:12px}
.chiffres .n{display:block;
  font:700 clamp(26px,4vw,36px)/1 Archivo,system-ui,sans-serif;
  letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.chiffres .l{display:block;margin-top:4px;font-size:13px;color:var(--sourd)}
.verdict p{margin:0;font-size:15.5px;line-height:1.55;max-width:76ch}
.verdict.ok p b:first-child{color:var(--barre)}
.verdict.non p b:first-child{color:var(--barre-tard)}

/* ---- diagramme */
.cadre{background:var(--carte);border:1px solid var(--trait);border-radius:12px;
  overflow-x:auto;-webkit-overflow-scrolling:touch}
table.gantt{width:100%;min-width:780px;border-collapse:collapse}
.gantt th{font:600 10.5px/1.2 "IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.1em;text-transform:uppercase;color:var(--sourd);
  text-align:left;vertical-align:bottom;padding:14px 10px 8px;
  border-bottom:1px solid var(--trait);white-space:nowrap}
.gantt td{padding:7px 10px;border-bottom:1px solid var(--trait2);vertical-align:middle}
.gantt tbody tr:last-child td{border-bottom:0}
.gantt th.rang,.gantt td.rang{width:1%;padding-left:16px;padding-right:4px;
  font:400 12px/1 "IBM Plex Mono",ui-monospace,monospace;color:var(--sourd);
  font-variant-numeric:tabular-nums;text-align:right}
.quoi{width:1%;max-width:210px}
.quoi .code{display:block;font:600 13px/1.25 "IBM Plex Sans",system-ui,sans-serif;
  white-space:nowrap}
.quoi .nom{display:block;font-size:11.5px;line-height:1.3;color:var(--sourd);
  margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:210px}
.heures{width:1%;white-space:nowrap;text-align:right;
  font:500 13px/1 "IBM Plex Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums}
.prov{width:1%;white-space:nowrap}
.jeton{display:inline-block;font:600 9.5px/1.5 "IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:99px;
  border:1px solid currentColor}
.jeton.mesure{color:var(--mesure);background:var(--mesure-f)}
.jeton.facture{color:var(--facture);background:var(--facture-f)}
.jeton.estime{color:var(--estime);background:var(--estime-f)}
.jeton.alerte{color:var(--barre-tard);background:transparent;border-style:dashed;margin-left:4px}
.piste{width:99%;min-width:300px}
.rail{position:relative;height:19px;background:var(--rail);border-radius:4px}
.mois{position:absolute;top:0;bottom:0;width:1px;background:var(--trait)}
.jalon{position:absolute;top:-1px;bottom:-1px;width:2px;background:var(--barre-tard);z-index:3}
.barre{position:absolute;top:3px;bottom:3px;background:var(--barre);
  border-radius:4px;min-width:3px;z-index:2}
/* Vert et rouge se ressemblent en vision deutane : la barre en retard porte
   AUSSI une trame et une étiquette. Jamais la couleur seule. */
.barre-tard{background:var(--barre-tard);
  background-image:repeating-linear-gradient(45deg,
    rgba(255,255,255,.42) 0 3px,transparent 3px 6px)}
.retard{position:absolute;top:50%;transform:translate(6px,-50%);z-index:4;
  font:600 10px/1 "IBM Plex Mono",ui-monospace,monospace;color:var(--barre-tard);
  white-space:nowrap;font-variant-numeric:tabular-nums}
.retard.avant{transform:translate(-6px,-50%)}
.echelle{position:relative;height:30px;min-width:300px}
.echelle span{position:absolute;bottom:0;transform:translateX(3px);
  font:600 10.5px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.08em;
  text-transform:uppercase;color:var(--sourd);white-space:nowrap}
.echelle .marque{position:absolute;top:0;transform:translateX(-100%);padding-right:7px;
  font:600 10px/1 "IBM Plex Mono",ui-monospace,monospace;color:var(--barre-tard);
  white-space:nowrap;text-transform:uppercase;letter-spacing:.06em}

/* ---- légende + notes */
.legende{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center;
  padding:14px 20px;background:var(--carte);border:1px solid var(--trait);border-radius:12px;
  font-size:12.5px;color:var(--encre2)}
.legende i{display:inline-block;width:22px;height:9px;border-radius:3px;
  vertical-align:middle;margin-right:7px}
.legende .l-ok{background:var(--barre)}
.legende .l-tard{background:var(--barre-tard);
  background-image:repeating-linear-gradient(45deg,
    rgba(255,255,255,.42) 0 3px,transparent 3px 6px)}
.legende .l-jalon{width:2px;height:15px;background:var(--barre-tard);margin-right:9px}
.notes{background:var(--carte);border:1px solid var(--trait);border-radius:12px;padding:20px 22px}
.notes h2{font:600 15px/1.3 Archivo,system-ui,sans-serif;margin:0 0 10px;letter-spacing:-.01em}
.notes p{margin:0 0 11px;font-size:14px;line-height:1.6;color:var(--encre2);max-width:78ch}
.notes p:last-child{margin-bottom:0}
.notes b{color:var(--encre);font-weight:600}
.pied{font-size:12px;color:var(--sourd);text-align:center;
  font-family:"IBM Plex Mono",ui-monospace,monospace}
@media (max-width:640px){
  .page{padding:26px 14px 52px}
  .chiffres{gap:12px 26px}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

const JS = `
const boutons=[...document.querySelectorAll('.choix button')];
boutons.forEach(b=>b.addEventListener('click',()=>{
  boutons.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  document.querySelectorAll('.scenario').forEach(s=>{
    s.hidden = s.id !== 's'+'-'+b.dataset.perim;
  });
}));
`;

const titre = "Cédule de production 26-27";
const html = `<title>${titre}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>${CSS}</style>

<div class="page">
  <header>
    <p class="eyebrow">Lasclay · atelier Tunisie</p>
    <h1>${nb(lignes.reduce((s, l) => s + l.restant, 0))} pièces avant le ${
      echeance ? dateFR(echeance.date) : '—'}</h1>
    <p class="sous">Ce que ${cap.postes} couturières peuvent sortir d'ici l'expédition,
    et ce qui déborde. Chaque ligne dit d'où vient son temps — mesuré, facturé,
    ou estimé.</p>
    <div class="meta">
      <span><b>${lignes.length}</b> items</span>
      <span><b>${cap.postes}</b> postes × ${cap.heures_jour} h × ${cap.jours_semaine} j</span>
      <span><b>${jours}</b> jours ouvrés restants</span>
      <span>Établi le <b>${dateFR(auj)}</b></span>
    </div>
  </header>

  <div class="bascule">
    <h2>Ce que l'atelier fait</h2>
    <p>Personne n'a encore tranché si les couturières font aussi la préparation —
    coupe, matelassage, remplissage, mélange d'asclépiade — ou seulement
    l'assemblage. C'est le seul réglage qui décide si le plan tient, et l'écart
    entre les trois lectures va du simple au double.</p>
    <div class="choix" role="group" aria-label="Périmètre de l'atelier">
      ${PERIMS.map(([cle, lib], i) => `<button type="button" data-perim="${cle}"
        aria-pressed="${i === 0}">${lib}</button>`).join('')}
    </div>
  </div>

  ${scenarios.map(bloc).join('')}

  <div class="legende">
    <span><i class="l-ok"></i>Sort avant l'expédition</span>
    <span><i class="l-tard"></i>Sort après — le nombre de jours est écrit sur la barre</span>
    <span><i class="l-jalon"></i>${echeance ? e(echeance.titre) : 'Échéance'}</span>
  </div>

  <div class="notes">
    <h2>D'où viennent les chiffres</h2>
    <p><b>Deux étapes, pas deux versions du même chiffre.</b> Le chronomètre mesure
    la préparation ; le prix BMB paie l'assemblage. Ce ne sont pas deux
    estimations du même travail : sur le cache-cou, six opérations chronométrées
    donnent 17 min et BMB facture 3 $, soit environ 7 min. Un rapport constant
    existerait si c'était la même mesure — il n'y en a pas.</p>
    <p><b>Tout se convertit à ${C.TAUX_HORAIRE} $/h</b>, la règle que le suivi
    Tunisie applique déjà aux mitaines polar : « 12,01 $ à 26 $/h » y donne
    27 min 42 s, soit exactement 12,01 / 26 heures.</p>
    <p><b>L'atelier est modélisé comme une file unique</b> — un item à la fois,
    tous les postes dessus. C'est une simplification, et elle est du bon côté :
    supposer plusieurs produits en parallèle donnerait des dates plus optimistes
    sans rien pour le justifier. Pour la question « est-ce que ça rentre », seul
    le total d'heures compte, et il ne dépend pas de l'ordre de passage.</p>
    <p><b>La capacité est déclarée, pas mesurée.</b> ${cap.postes} couturières,
    ${cap.heures_jour} h par jour, ${cap.jours_semaine} jours par semaine — c'est
    l'effectif annoncé, pas ce qui sort réellement de l'atelier par jour.</p>
    <p><b>« Sources divergentes »</b> marque les six produits dont le prix BMB et
    la fiche COGS ne disent pas la même chose. Rien n'est arbitré ici : l'écart
    est montré plutôt que masqué.</p>
  </div>

  <p class="pied">Généré depuis le MRP Lasclay · ${dateFR(auj)} ·
  régénérer après chaque révision du plan</p>
</div>
<script>${JS}</script>`;

console.log(html);
console.error(`${lignes.length} items · ${scenarios.map(s =>
  `${s.cle} ${Math.round(s.cal.heuresTotal)} h`).join(' · ')}`);
