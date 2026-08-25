# -*- coding: utf-8 -*-
"""Génère le rapport d'audit publicitaire en HTML autonome."""
import json, pathlib

D = pathlib.Path(__file__).parent
CH = json.load(open(D / "data" / "chart_data.json"))
OUT = pathlib.Path("/tmp/claude-0/-home-user-missive-automations/5492dddd-d9c2-5c12-9a65-149e51ca49f6/scratchpad/audit-pub-lasclay.html")

HTML = r"""<title>Où part la pub de Lasclay</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,800&family=IBM+Plex+Mono:wght@400;500;600&family=Public+Sans:wght@400;500;700&display=swap">
<style>
:root{
  --paper:#EDEFEA; --surface:#FAFBF8; --surface-2:#F2F4EE; --ink:#16211F; --ink-2:#3C4A45;
  --muted:#5D6862; --rule:#D5DAD1; --rule-2:#E4E8E0;
  --teal:#0080A0; --ochre:#BF6A16;
  --crit:#A32B22; --warn:#8E6207; --good:#2F6B45;
  --crit-bg:#F6E4E1; --warn-bg:#F6EEDC; --good-bg:#E2EFE6;
  --shadow:0 1px 2px rgba(22,33,31,.05), 0 8px 24px -16px rgba(22,33,31,.25);
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --paper:#111614; --surface:#1A211E; --surface-2:#222A26; --ink:#E6EAE4; --ink-2:#BDC6C0;
  --muted:#8C978F; --rule:#2E3833; --rule-2:#262F2B;
  --teal:#2A9CB8; --ochre:#C8842C;
  --crit:#E4796C; --warn:#D9A44E; --good:#6FBE8C;
  --crit-bg:#2E1B18; --warn-bg:#2C2415; --good-bg:#17281D;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px -16px rgba(0,0,0,.8);
}}
:root[data-theme="dark"]{
  --paper:#111614; --surface:#1A211E; --surface-2:#222A26; --ink:#E6EAE4; --ink-2:#BDC6C0;
  --muted:#8C978F; --rule:#2E3833; --rule-2:#262F2B;
  --teal:#2A9CB8; --ochre:#C8842C;
  --crit:#E4796C; --warn:#D9A44E; --good:#6FBE8C;
  --crit-bg:#2E1B18; --warn-bg:#2C2415; --good-bg:#17281D;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px -16px rgba(0,0,0,.8);
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font-family:"Public Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  font-size:16.5px; line-height:1.62; -webkit-font-smoothing:antialiased;
}
.wrap{max-width:1080px;margin:0 auto;padding:0 28px 96px}
h1,h2,h3{font-family:Fraunces,Georgia,serif;text-wrap:balance;margin:0}
.eyebrow{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;letter-spacing:.13em;
  text-transform:uppercase;color:var(--muted);font-weight:500}
.num{font-variant-numeric:tabular-nums}

/* ---- masthead ---- */
header.mast{padding:64px 0 40px;border-bottom:2px solid var(--ink)}
header.mast h1{font-size:clamp(38px,6.2vw,66px);line-height:1.02;font-weight:800;letter-spacing:-.022em;margin:14px 0 0}
header.mast .sub{max-width:62ch;margin-top:20px;color:var(--ink-2);font-size:18px}
.meta-line{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:26px}
.meta-line span{font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--muted)}

/* ---- verdict ---- */
.verdict{margin:40px 0 8px;padding:30px 32px;background:var(--surface);border:1px solid var(--rule);
  border-left:5px solid var(--ochre);border-radius:3px;box-shadow:var(--shadow)}
.verdict p{margin:0;font-family:Fraunces,Georgia,serif;font-size:clamp(20px,2.6vw,26px);
  line-height:1.42;font-weight:400;letter-spacing:-.01em}
.verdict p+p{margin-top:14px;font-family:"Public Sans",sans-serif;font-size:16.5px;color:var(--ink-2)}
.verdict b{font-weight:600;color:var(--ink)}

/* ---- kpi ---- */
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(178px,1fr));gap:1px;
  background:var(--rule);border:1px solid var(--rule);margin:36px 0 0;border-radius:3px;overflow:hidden}
.kpi{background:var(--surface);padding:20px 20px 18px}
.kpi .k{display:block;font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--muted);min-height:2.6em}
.kpi .v{display:block;font-family:Fraunces,Georgia,serif;font-size:31px;font-weight:600;
  line-height:1.1;margin-top:10px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.kpi .d{display:block;font-size:13px;color:var(--muted);margin-top:5px}
.kpi.up .v{color:var(--good)} .kpi.down .v{color:var(--crit)}

section{margin-top:76px}
h2{font-size:clamp(25px,3.4vw,33px);font-weight:600;letter-spacing:-.018em;line-height:1.14}
.lede{max-width:66ch;color:var(--ink-2);margin-top:12px}
.rule{height:1px;background:var(--rule);margin:26px 0 0}

/* ---- findings ---- */
.finding{background:var(--surface);border:1px solid var(--rule);border-radius:3px;
  margin-top:22px;overflow:hidden;box-shadow:var(--shadow)}
.finding>.top{display:flex;gap:18px;padding:22px 26px 20px;align-items:flex-start;
  border-left:5px solid var(--sev,var(--muted))}
.rank{font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:600;color:var(--muted);
  padding-top:5px;min-width:2.2em;font-variant-numeric:tabular-nums}
.finding h3{font-size:20.5px;font-weight:600;letter-spacing:-.012em;line-height:1.25}
.finding .body{margin-top:10px;color:var(--ink-2);max-width:70ch}
.finding .body p{margin:0 0 10px}
.finding .body p:last-child{margin-bottom:0}
.chip{display:inline-flex;align-items:center;gap:6px;font-family:"IBM Plex Mono",monospace;
  font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;
  padding:4px 9px;border-radius:2px;white-space:nowrap}
.chip.c{background:var(--crit-bg);color:var(--crit)}
.chip.w{background:var(--warn-bg);color:var(--warn)}
.chip.g{background:var(--good-bg);color:var(--good)}
.chip::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.finding .act{padding:15px 26px 17px 49px;background:var(--surface-2);border-top:1px solid var(--rule-2);
  font-size:15px;display:flex;gap:11px;align-items:baseline}
.finding .act .lbl{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--muted);flex:none;font-weight:600}
.hl{background:linear-gradient(transparent 62%,color-mix(in srgb,var(--ochre) 26%,transparent) 62%);
  font-weight:600;color:var(--ink)}

/* ---- tables ---- */
.tblwrap{overflow-x:auto;margin-top:18px;border:1px solid var(--rule);border-radius:3px;background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:14.5px;min-width:520px}
th,td{padding:9px 14px;text-align:right;border-bottom:1px solid var(--rule-2);white-space:nowrap}
th:first-child,td:first-child{text-align:left;white-space:normal}
thead th{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--muted);font-weight:600;background:var(--surface-2);border-bottom:1px solid var(--rule)}
tbody tr:last-child td{border-bottom:none}
tbody tr.tot td{font-weight:700;background:var(--surface-2)}
td.n{font-variant-numeric:tabular-nums}
td.bad{color:var(--crit);font-weight:600} td.ok{color:var(--good);font-weight:600}

/* ---- charts ---- */
figure{margin:26px 0 0;background:var(--surface);border:1px solid var(--rule);border-radius:3px;
  padding:22px 24px 18px;box-shadow:var(--shadow)}
figcaption{font-size:13.5px;color:var(--muted);margin-top:14px;max-width:74ch}
.fig-h{display:flex;justify-content:space-between;align-items:baseline;gap:18px;flex-wrap:wrap;margin-bottom:16px}
.fig-h .t{font-family:Fraunces,Georgia,serif;font-size:17.5px;font-weight:600;letter-spacing:-.01em}
.legend{display:flex;gap:16px;flex-wrap:wrap}
.legend i{display:inline-flex;align-items:center;gap:7px;font-style:normal;font-size:12.5px;color:var(--ink-2)}
.legend i::before{content:"";width:11px;height:11px;border-radius:2px;background:var(--c)}
.chart{position:relative;width:100%;overflow-x:auto}
svg{display:block;width:100%;height:auto;overflow:visible}
.grid line{stroke:var(--rule-2);stroke-width:1}
.axis text{font-family:"IBM Plex Mono",monospace;font-size:10px;fill:var(--muted)}
.tip{position:absolute;pointer-events:none;opacity:0;transition:opacity .12s;background:var(--ink);
  color:var(--paper);padding:8px 11px;border-radius:3px;font-size:12.5px;line-height:1.5;
  font-variant-numeric:tabular-nums;white-space:nowrap;z-index:5;box-shadow:0 4px 14px rgba(0,0,0,.28)}
.tip b{font-family:"IBM Plex Mono",monospace;font-weight:600}
.tip .sw{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px}

/* ---- plan ---- */
.plan{display:grid;gap:14px;margin-top:22px}
.step{display:grid;grid-template-columns:auto 1fr;gap:18px;background:var(--surface);
  border:1px solid var(--rule);border-radius:3px;padding:20px 24px;box-shadow:var(--shadow)}
.step .w{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;
  color:var(--ochre);font-weight:600;padding-top:4px;white-space:nowrap}
.step h3{font-size:17.5px;font-weight:600;letter-spacing:-.01em}
.step p{margin:7px 0 0;color:var(--ink-2);font-size:15px;max-width:72ch}
footer{margin-top:80px;padding-top:24px;border-top:1px solid var(--rule);font-size:13px;color:var(--muted);max-width:74ch}
footer p{margin:0 0 8px}
:focus-visible{outline:2px solid var(--teal);outline-offset:3px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
@media(max-width:640px){
  .wrap{padding:0 18px 64px}
  .finding>.top{flex-direction:column;gap:10px;padding:20px}
  .finding .act{padding-left:20px;flex-direction:column;gap:5px}
  .step{grid-template-columns:1fr;gap:8px}
}
</style>

<div class="wrap">

<header class="mast">
  <div class="eyebrow">Lasclay · audit publicitaire · août 2026</div>
  <h1>Où part la pub<br>de Lasclay</h1>
  <p class="sub">Trois ans de Meta Ads (Québec + USA) confrontés aux ventes réelles de Shopify et
  aux infolettres Klaviyo. Ce que le journal publicitaire ne montrait plus.</p>
  <div class="meta-line">
    <span>585 526 $ de pub mesurés</span><span>·</span>
    <span>25 juil. 2023 → 25 août 2026</span><span>·</span>
    <span>3 comptes Meta · 251 envois courriel</span>
  </div>
</header>

<div class="verdict">
  <p>La publicité fonctionne encore — mais elle coûte <b>2,3 fois plus cher qu'il y a deux ans</b>
  pour livrer la même vente, et le tableau de bord censé le signaler s'est arrêté de dire la vérité
  en mars&nbsp;2026.</p>
  <p>Trois choses payent : les campagnes de conversion, les journées d'infolettre, les préventes.
  Trois choses coûtent : la saturation d'audience, les campagnes d'engagement, et une mesure
  qui ne relie plus la dépense aux ventes.</p>
</div>

<div class="kpis">
  <div class="kpi"><span class="k">Dépense Meta mesurée</span><span class="v">585 526 $</span><span class="d">QC 394 696 $ · USA 190 830 $</span></div>
  <div class="kpi"><span class="k">MER réel FY2026</span><span class="v">3,10</span><span class="d">FY2024 : 5,26 · FY2025 : 3,32</span></div>
  <div class="kpi down"><span class="k">CPA Meta FY2026</span><span class="v">31,48 $</span><span class="d">+87 % vs FY2024 (16,86 $)</span></div>
  <div class="kpi down"><span class="k">Dépense hors conversion</span><span class="v">58 260 $</span><span class="d">ROAS 0,62 · 117 476 $ perdus</span></div>
  <div class="kpi up"><span class="k">Jour d'infolettre</span><span class="v">×3,2</span><span class="d">vs une journée sans envoi</span></div>
</div>

<section>
  <h2>La courbe qui résume tout</h2>
  <p class="lede">Dépense publicitaire et ventes nettes, mois par mois, dans la même unité.
  Jusqu'à l'automne 2025 les deux courbes s'écartent — chaque dollar de pub en rapporte plusieurs.
  À partir de janvier 2026 elles se rapprochent : la pub grimpe, les ventes ne suivent plus.</p>
  <figure>
    <div class="fig-h">
      <span class="t">Dépense Meta et ventes nettes Shopify</span>
      <span class="legend">
        <i style="--c:var(--ochre)">Dépense Meta</i>
        <i style="--c:var(--teal)">Ventes nettes Shopify</i>
      </span>
    </div>
    <div class="chart" id="c1"></div>
    <figcaption>Mensuel, dollars canadiens. Le pic de mai 2026 (82&nbsp;741&nbsp;$ de ventes pour
    3&nbsp;775&nbsp;$ de pub) est la journée de prévente du 30 mai, portée par l'infolettre et non par Meta.</figcaption>
  </figure>
  <figure>
    <div class="fig-h"><span class="t">MER réel — ventes nettes ÷ dépense publicitaire</span></div>
    <div class="chart" id="c2"></div>
    <figcaption>Le seul indicateur qui ne dépend d'aucune attribution déclarative. La ligne à 3,0
    marque le seuil sous lequel la croissance publicitaire coûte plus qu'elle ne rapporte.
    Huit des dix-huit derniers mois passent dessous, dont cinq d'affilée de mars à juillet 2025
    et trois d'affilée de janvier à mars 2026. Les cinq barres marquées d'un chevron dépassent
    l'échelle : juillet à novembre 2023, où la dépense était encore minime, et mai 2026 (21,9).</figcaption>
  </figure>
</section>

<section>
  <h2>Cinq constats, classés par ce qu'ils coûtent</h2>
  <p class="lede">Le numéro indique le rang par impact financier estimé, du plus lourd au plus léger.</p>

  <article class="finding" style="--sev:var(--crit)">
    <div class="top"><span class="rank">01</span><div>
      <span class="chip c">117 476 $ de manque à gagner</span>
      <h3 style="margin-top:9px">58 260 $ sont passés dans des campagnes qui ne vendent pas</h3>
      <div class="body">
        <p>Les campagnes d'engagement, de notoriété et de trafic ont consommé <span class="hl">58 260 $</span>
        sur les trois ans et rapporté 36 327 $ — un ROAS de <b>0,62</b>. Sur la même période, les campagnes
        de conversion ont tourné à <b>2,64</b>.</p>
        <p>Deux campagnes suffisent à expliquer la moitié du trou : « (FR) 2023-2024 Engagement »
        (11 909 $ → ROAS 0,63) et « engagement » (11 385 $ → ROAS <b>0,19</b>, soit 495 $ le achat).
        « video engagement » a brûlé 5 233 $ à 0,31.</p>
      </div>
    </div></div>
    <div class="act"><span class="lbl">À faire</span><span>Fermer toute campagne dont l'objectif n'est pas
    <em>Ventes</em>. L'engagement ne se paie pas : il se récolte en sous-produit des campagnes de conversion.</span></div>
  </article>

  <article class="finding" style="--sev:var(--crit)">
    <div class="top"><span class="rank">02</span><div>
      <span class="chip c">CPA ×1,9 en deux ans</span>
      <h3 style="margin-top:9px">L'audience québécoise est saturée</h3>
      <div class="body">
        <p>La fréquence moyenne du compte Québec est passée de <b>2,92</b> (FY2024) à <b>4,23</b> (FY2026),
        et le CPM de 3,35 $ à <span class="hl">9,28 $</span>. Le coût par achat a suivi : 16,86 $ → 31,48 $.</p>
        <p>Le cas extrême : l'ensemble de publicités « 2025-2026 Automne-Hiver FB Posts statiques »,
        95 196 $ dépensés à une fréquence cumulée de <b>11,5</b> — chaque personne touchée a vu la
        publicité onze fois. Il cible le Québec, sur <b>Facebook uniquement, fil d'actualité uniquement</b> :
        ni Instagram, ni Reels, ni Stories.</p>
      </div>
    </div></div>
    <div class="act"><span class="lbl">À faire</span><span>Ouvrir les placements Instagram et Reels sur les
    ensembles de conversion, et plafonner la fréquence à 3 sur une fenêtre de 7 jours.</span></div>
  </article>

  <article class="finding" style="--sev:var(--crit)">
    <div class="top"><span class="rank">03</span><div>
      <span class="chip c">Le tableau de bord ment</span>
      <h3 style="margin-top:9px">Le journal publicitaire a décroché de la réalité en mars 2026</h3>
      <div class="body">
        <p>Sur 33 mois comparables, le journal colle à l'API Meta au dollar près — sauf sur sept mois.
        Depuis mars 2026, l'écart n'est plus du bruit : le journal affiche
        <span class="hl">23 068 $ de dépense québécoise en avril 2026</span> alors que Meta en a
        facturé <b>3 833 $</b>. En mai : 16 916 $ affichés contre <b>567 $</b> réels.</p>
        <p>Les colonnes <em>sessions</em>, <em>commandes</em>, <em>taux de conversion</em> et
        <em>panier moyen</em> sont vides depuis février 2025 — 457 jours sans données.
        Le journal s'est arrêté le 22 mai 2026.</p>
      </div>
    </div></div>
    <div class="act"><span class="lbl">À faire</span><span>Remplacer le journal manuel par le chiffrier
    consolidé livré avec cet audit, alimenté depuis les API plutôt que recopié à la main.</span></div>
  </article>

  <article class="finding" style="--sev:var(--warn)">
    <div class="top"><span class="rank">04</span><div>
      <span class="chip w">27 % du CA non attribué</span>
      <h3 style="margin-top:9px">Shopify ne voit pas les infolettres</h3>
      <div class="body">
        <p>Sur les douze derniers mois, Klaviyo revendique <b>2 242 commandes</b> et 260 470 $ de revenu.
        Shopify n'attribue que <span class="hl">20 commandes</span> et 1 632 $ à la source « courriel ».</p>
        <p>La cause est mécanique : sur presque toutes les campagnes, l'option
        <code>add_tracking_params</code> est à <b>false</b>. Les clics d'infolettre arrivent sans UTM et
        se rangent dans les 1 121 029 $ de ventes « source inconnue ». Toute décision d'arbitrage
        entre pub payante et courriel se prend donc à l'aveugle.</p>
      </div>
    </div></div>
    <div class="act"><span class="lbl">À faire</span><span>Activer les paramètres de suivi dans les réglages
    Klaviyo par défaut (utm_source=klaviyo, utm_medium=email) — un seul réglage, toutes les campagnes futures.</span></div>
  </article>

  <article class="finding" style="--sev:var(--warn)">
    <div class="top"><span class="rank">05</span><div>
      <span class="chip w">La liste rétrécit</span>
      <h3 style="margin-top:9px">Plus d'envois, moins de monde, quatre automatisations</h3>
      <div class="body">
        <p>L'audience médiane d'un envoi de masse est passée de <b>20 714</b> (2023-24) à
        <b>22 215</b> (2024-25) puis <span class="hl">15 576</span> (2025-26) — pendant que le nombre
        d'envois montait de 41 à 66. On écrit plus souvent à moins de gens.</p>
        <p>Côté automatisations, il n'y en a que quatre, dont une encore en brouillon. Le panier
        abandonné n'a touché que 3 242 personnes en un an, pour 13 261 $. Aucun flux de bienvenue
        segmenté par marché, aucune relance post-achat, aucune reconquête, aucun retour en stock.
        Les trois campagnes SMS de l'année affichent <b>0 conversion</b>.</p>
      </div>
    </div></div>
    <div class="act"><span class="lbl">À faire</span><span>Diagnostiquer la perte de liste (désabonnements,
    nettoyage, segments), puis bâtir les flux manquants — le panier abandonné rapporte déjà 4,40 $ par
    destinataire, c'est le meilleur rendement de tout l'écosystème.</span></div>
  </article>
</section>

<section>
  <h2>L'infolettre est le levier le moins cher</h2>
  <p class="lede">L'intuition se vérifie, et l'écart est plus grand qu'attendu. Sur les douze derniers
  mois, 68 envois de masse répartis sur 45 journées.</p>
  <div class="kpis" style="margin-top:26px">
    <div class="kpi up"><span class="k">Ventes médianes — jour d'envoi</span><span class="v">3 696 $</span><span class="d">60 commandes</span></div>
    <div class="kpi"><span class="k">Ventes médianes — jour sans envoi</span><span class="v">1 153 $</span><span class="d">22 commandes</span></div>
    <div class="kpi up"><span class="k">Part du CA sur 34 % des jours</span><span class="v">62 %</span><span class="d">fenêtre J à J+2</span></div>
    <div class="kpi"><span class="k">Revenu par destinataire</span><span class="v">0,25 $</span><span class="d">panier abandonné : 4,40 $</span></div>
  </div>
  <figure>
    <div class="fig-h"><span class="t">Ventes nettes médianes par jour, selon la distance à un envoi</span></div>
    <div class="chart" id="c3"></div>
    <figcaption>L'effet ne s'éteint pas le soir même : trois jours après l'envoi, les ventes sont
    encore au double d'une journée ordinaire. Les 125 jours de la fenêtre J à J+2 pèsent 597 714 $
    contre 370 035 $ pour les 241 autres jours de l'année.</figcaption>
  </figure>
  <p class="lede" style="margin-top:26px">Les deux plus grosses journées de l'histoire récente sont
  des journées de prévente annoncée par courriel, pas des journées de pub :</p>
  <div class="tblwrap"><table>
    <thead><tr><th>Journée</th><th>Ventes nettes</th><th>Commandes</th><th>Ce qui est parti ce jour-là</th></tr></thead>
    <tbody>
      <tr><td>30 mai 2026</td><td class="n ok">56 239 $</td><td class="n">431</td><td>Réchauffement prévente 2026 #4 + SMS</td></tr>
      <tr><td>13 sept. 2025</td><td class="n ok">39 060 $</td><td class="n">342</td><td>Réchauffement #4 FR + EN + 2 SMS</td></tr>
      <tr><td>8 déc. 2025</td><td class="n">19 617 $</td><td class="n">168</td><td>AIDE clients QC</td></tr>
      <tr><td>6 déc. 2025</td><td class="n">17 284 $</td><td class="n">156</td><td>Campagne du 6 déc. + fin de concours</td></tr>
      <tr><td>24 janv. 2026</td><td class="n">12 894 $</td><td class="n">125</td><td>Vente de fin de saison 2026</td></tr>
    </tbody>
  </table></div>
  <p class="lede" style="margin-top:22px">Le mois de <b>mai 2026</b> est la démonstration la plus nette :
  3 775 $ de publicité, 82 741 $ de ventes nettes, un MER de <b>21,9</b>. Klaviyo y revendique
  74 348 $ — la quasi-totalité du mois.</p>
</section>

<section>
  <h2>Ce que valent les objectifs de campagne</h2>
  <p class="lede">Tout l'historique mesurable, comptes Québec et USA confondus.</p>
  <figure>
    <div class="fig-h"><span class="t">ROAS par objectif de campagne</span></div>
    <div class="chart" id="c4"></div>
    <figcaption>Le seuil de rentabilité brute se situe à 1,0 ; le seuil de rentabilité réelle,
    marge et frais compris, bien au-dessus.</figcaption>
  </figure>
  <div class="tblwrap"><table>
    <thead><tr><th>Objectif</th><th>Dépensé</th><th>Valeur d'achat</th><th>ROAS</th><th>Achats</th><th>Part</th></tr></thead>
    <tbody>
      <tr><td>Ventes (conversion)</td><td class="n">357 408 $</td><td class="n">943 525 $</td><td class="n ok">2,64</td><td class="n">14 888</td><td class="n">86,0 %</td></tr>
      <tr><td>Engagement</td><td class="n">33 080 $</td><td class="n">11 715 $</td><td class="n bad">0,35</td><td class="n">137</td><td class="n">8,0 %</td></tr>
      <tr><td>Trafic</td><td class="n">21 889 $</td><td class="n">23 438 $</td><td class="n bad">1,07</td><td class="n">306</td><td class="n">5,3 %</td></tr>
      <tr><td>Notoriété</td><td class="n">2 690 $</td><td class="n">913 $</td><td class="n bad">0,34</td><td class="n">12</td><td class="n">0,6 %</td></tr>
      <tr><td>Clics vers le site (ancien)</td><td class="n">602 $</td><td class="n">260 $</td><td class="n bad">0,43</td><td class="n">7</td><td class="n">0,1 %</td></tr>
      <tr class="tot"><td>Total mesuré</td><td class="n">415 668 $</td><td class="n">979 852 $</td><td class="n">2,36</td><td class="n">15 350</td><td class="n">100 %</td></tr>
    </tbody>
  </table></div>
  <p class="lede" style="margin-top:20px">Cinq campagnes portent 94 % de toute la valeur générée :
  « (FR) 2025-2026 Conversions » (146 728 $ → 465 731 $, ROAS 3,17), « 2024 Conversion USA »
  (119 539 $ → 251 691 $, ROAS 2,11), « Campagne USA hiver » (42 601 $ → 119 947 $, ROAS <b>2,82</b>),
  « Campagne textile été 2025 » (22 657 $ → 54 365 $) et « 2025 plantation Canada » (11 802 $ → 26 722 $).</p>
</section>

<section>
  <h2>L'écart entre le journal et l'API, mois par mois</h2>
  <p class="lede">Seuls les mois où l'écart dépasse 1 500 $ sont listés. Avant mars 2026, le journal
  sous-évaluait ; depuis, il surévalue massivement.</p>
  <div class="tblwrap"><table>
    <thead><tr><th>Mois</th><th>Journal</th><th>Meta réel</th><th>Écart</th><th>Écart %</th></tr></thead>
    <tbody>
      <tr><td>mars 2024</td><td class="n">4 225 $</td><td class="n">6 707 $</td><td class="n">−2 482 $</td><td class="n bad">−37 %</td></tr>
      <tr><td>avril 2024</td><td class="n">4 651 $</td><td class="n">7 654 $</td><td class="n">−3 003 $</td><td class="n bad">−39 %</td></tr>
      <tr><td>mai 2024</td><td class="n">5 581 $</td><td class="n">8 784 $</td><td class="n">−3 203 $</td><td class="n bad">−36 %</td></tr>
      <tr><td>nov. 2024</td><td class="n">7 536 $</td><td class="n">10 504 $</td><td class="n">−2 968 $</td><td class="n bad">−28 %</td></tr>
      <tr><td>déc. 2024</td><td class="n">8 283 $</td><td class="n">14 828 $</td><td class="n">−6 545 $</td><td class="n bad">−44 %</td></tr>
      <tr><td>mars 2026</td><td class="n">24 558 $</td><td class="n">15 581 $</td><td class="n">+8 977 $</td><td class="n bad">+58 %</td></tr>
      <tr><td>avril 2026</td><td class="n">23 068 $</td><td class="n">3 833 $</td><td class="n">+19 235 $</td><td class="n bad">+502 %</td></tr>
      <tr><td>mai 2026</td><td class="n">16 916 $</td><td class="n">567 $</td><td class="n">+16 350 $</td><td class="n bad">+2 886 %</td></tr>
    </tbody>
  </table></div>
</section>

<section>
  <h2>L'été 2026</h2>
  <p class="lede">La publicité s'est arrêtée après le 31 mai et les ventes avec elle. Le creux estival
  existait déjà en 2025, mais pas à cette profondeur.</p>
  <div class="tblwrap"><table>
    <thead><tr><th>Mois</th><th>Ventes nettes 2025</th><th>Ventes nettes 2026</th><th>Variation</th><th>Dépense Meta 2026</th></tr></thead>
    <tbody>
      <tr><td>Juin</td><td class="n">56 686 $</td><td class="n">8 181 $</td><td class="n bad">−86 %</td><td class="n">918 $</td></tr>
      <tr><td>Juillet</td><td class="n">38 379 $</td><td class="n">2 759 $</td><td class="n bad">−93 %</td><td class="n">0 $</td></tr>
      <tr><td>Août (au 25)</td><td class="n">25 869 $</td><td class="n">7 180 $</td><td class="n bad">−72 %</td><td class="n">1 064 $</td></tr>
    </tbody>
  </table></div>
  <p class="lede" style="margin-top:20px">Le compte <b>Lasclay ROC</b> est fermé et son historique
  n'est plus interrogeable par l'API — les données publicitaires du Canada hors Québec sont
  définitivement perdues, sauf ce qui a été exporté à la main dans le Drive.</p>
</section>

<section>
  <h2>Le suivi à mettre en place</h2>
  <p class="lede">Le chiffrier livré avec cet audit remplace le journal manuel : 60 mois consolidés,
  Meta + Shopify + Klaviyo dans le même tableau, plus le détail par campagne et par envoi.
  Ce qu'il reste à faire tient en cinq gestes.</p>
  <div class="plan">
    <div class="step"><span class="w">Cette semaine</span><div>
      <h3>Couper la dépense hors conversion</h3>
      <p>Aucune campagne d'engagement, de notoriété ou de trafic ne redémarre. Le budget repart
      entièrement sur les objectifs <em>Ventes</em>.</p></div></div>
    <div class="step"><span class="w">Cette semaine</span><div>
      <h3>Activer les UTM Klaviyo par défaut</h3>
      <p>Un seul réglage de compte. À partir de là, Shopify sait ce que rapporte l'infolettre et
      l'arbitrage courriel / pub payante se fait sur des chiffres.</p></div></div>
    <div class="step"><span class="w">Avant la prévente</span><div>
      <h3>Ouvrir Instagram et Reels, plafonner la fréquence</h3>
      <p>Les ensembles de conversion québécois tournent sur le seul fil Facebook. Ouvrir les
      placements élargit l'audience atteignable et fait redescendre le CPM.</p></div></div>
    <div class="step"><span class="w">Avant la prévente</span><div>
      <h3>Reconstruire les flux Klaviyo</h3>
      <p>Bienvenue segmentée par marché, relance post-achat, reconquête à 90 jours, retour en stock.
      Le panier abandonné rapporte déjà 4,40 $ par destinataire — dix-sept fois une campagne de masse.</p></div></div>
    <div class="step"><span class="w">Chaque mois</span><div>
      <h3>Rapprocher le chiffrier et l'API</h3>
      <p>Six chiffres à lire : MER réel, fréquence QC, CPA vs panier moyen, part hors conversion,
      revenu courriel, écart journal ↔ API. Si le MER passe sous 3,0 deux mois de suite, on coupe
      avant d'ajouter.</p></div></div>
  </div>
</section>

<footer>
  <p><b>Sources.</b> API Meta Marketing (comptes Lasclay Quebec 363736411681046 et Lasclay USA 359131645638217),
  ShopifyQL sur lasclay.myshopify.com, API Klaviyo (métrique de conversion « Placed Order »),
  et le chiffrier « Journal publicitaire » du Drive (979 jours, 17 sept. 2023 → 22 mai 2026).</p>
  <p><b>Limites.</b> L'API Meta ne remonte que 37 mois : tout ce qui précède le 25 juillet 2023 existe
  comme campagne mais sans métriques. Le compte Lasclay ROC, fermé, n'est pas interrogeable.
  Les ROAS Meta sont déclaratifs et sujets à la modélisation ; le MER réel, lui, ne l'est pas.
  Les montants Meta sont en dollars canadiens.</p>
</footer>
</div>

<script>
const D = __DATA__;
const fmt = n => n.toLocaleString('fr-CA').replace(/ | /g,' ');
const money = n => fmt(Math.round(n)) + ' $';
const MOIS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const label = m => MOIS[+m.slice(5,7)-1] + ' ' + m.slice(2,4);
const NS = 'http://www.w3.org/2000/svg';
const el = (t,a={}) => { const e=document.createElementNS(NS,t); for(const k in a) e.setAttribute(k,a[k]); return e; };
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function mkTip(host){ const t=document.createElement('div'); t.className='tip'; host.appendChild(t); return t; }
function place(tip,host,x,y){
  const w=host.clientWidth; tip.style.opacity=1;
  const tw=tip.offsetWidth;
  tip.style.left=Math.max(4,Math.min(x-tw/2,w-tw-4))+'px';
  tip.style.top=Math.max(0,y-tip.offsetHeight-12)+'px';
}

/* ---------- 1. lignes : dépense + ventes ---------- */
function chart1(){
  const host=document.getElementById('c1'); host.innerHTML='';
  const W=1000,H=330,mL=64,mR=16,mT=14,mB=34;
  const svg=el('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'Dépense Meta et ventes nettes Shopify par mois'});
  const n=D.mois.length, max=Math.max(...D.ventes,...D.dep)*1.06;
  const X=i=>mL+i*(W-mL-mR)/(n-1), Y=v=>H-mB-(v/max)*(H-mT-mB);
  const g=el('g',{class:'grid'});
  const ticks=[0,50000,100000,150000,200000,250000];
  const ax=el('g',{class:'axis'});
  ticks.forEach(t=>{ g.appendChild(el('line',{x1:mL,x2:W-mR,y1:Y(t),y2:Y(t)}));
    const tx=el('text',{x:mL-9,y:Y(t)+3.5,'text-anchor':'end'}); tx.textContent=t?fmt(t/1000)+'k':'0'; ax.appendChild(tx); });
  svg.append(g);
  D.mois.forEach((m,i)=>{ if(+m.slice(5,7)===1||i===0){
    const tx=el('text',{x:X(i),y:H-mB+17,'text-anchor':'middle'}); tx.textContent=m.slice(0,4); ax.appendChild(tx);
    g.appendChild(el('line',{x1:X(i),x2:X(i),y1:mT,y2:H-mB,stroke:css('--rule')}));
  }});
  svg.append(ax);
  const path=a=>a.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');
  const area=a=>path(a)+`L${X(n-1)} ${Y(0)} L${X(0)} ${Y(0)} Z`;
  svg.append(el('path',{d:area(D.ventes),fill:css('--teal'),'fill-opacity':'.09'}));
  svg.append(el('path',{d:path(D.dep),fill:'none',stroke:css('--ochre'),'stroke-width':2,'stroke-linejoin':'round','stroke-linecap':'round'}));
  svg.append(el('path',{d:path(D.ventes),fill:'none',stroke:css('--teal'),'stroke-width':2,'stroke-linejoin':'round','stroke-linecap':'round'}));
  const cross=el('line',{y1:mT,y2:H-mB,stroke:css('--muted'),'stroke-width':1,'stroke-dasharray':'3 3',opacity:0});
  svg.append(cross);
  [[D.ventes,css('--teal'),'Ventes nettes',-14],[D.dep,css('--ochre'),'Dépense Meta',30]].forEach(([a,col,txt,dy])=>{
    const i=a.indexOf(Math.max(...a));
    const t=el('text',{x:X(i)+9,y:Y(a[i])+dy,'text-anchor':'start'});
    t.style.fontFamily='"Public Sans",sans-serif'; t.style.fontSize='12px'; t.style.fontWeight='600';
    t.setAttribute('fill',col); t.textContent=txt; svg.append(t);
  });
  const d1=el('circle',{r:5,fill:css('--ochre'),stroke:css('--surface'),'stroke-width':2,opacity:0});
  const d2=el('circle',{r:5,fill:css('--teal'),stroke:css('--surface'),'stroke-width':2,opacity:0});
  svg.append(d1,d2);
  host.appendChild(svg); const tip=mkTip(host);
  svg.addEventListener('pointermove',ev=>{
    const r=svg.getBoundingClientRect(), px=(ev.clientX-r.left)/r.width*W;
    let i=Math.round((px-mL)/((W-mL-mR)/(n-1))); i=Math.max(0,Math.min(n-1,i));
    const sx=X(i)/W*r.width;
    cross.setAttribute('x1',X(i)); cross.setAttribute('x2',X(i)); cross.setAttribute('opacity',1);
    d1.setAttribute('cx',X(i)); d1.setAttribute('cy',Y(D.dep[i])); d1.setAttribute('opacity',1);
    d2.setAttribute('cx',X(i)); d2.setAttribute('cy',Y(D.ventes[i])); d2.setAttribute('opacity',1);
    tip.innerHTML=`<b>${label(D.mois[i])}</b><br><span class="sw" style="background:${css('--ochre')}"></span>Pub ${money(D.dep[i])}<br><span class="sw" style="background:${css('--teal')}"></span>Ventes ${money(D.ventes[i])}`;
    place(tip,host,sx,Y(Math.max(D.dep[i],D.ventes[i]))/H*r.height);
  });
  svg.addEventListener('pointerleave',()=>{tip.style.opacity=0;cross.setAttribute('opacity',0);d1.setAttribute('opacity',0);d2.setAttribute('opacity',0);});
}

/* ---------- 2. barres MER ---------- */
function chart2(){
  const host=document.getElementById('c2'); host.innerHTML='';
  const W=1000,H=250,mL=42,mR=66,mT=14,mB=34;
  const vals=D.mer.map(v=>v==null?0:Math.min(v,9));
  const svg=el('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'MER réel par mois'});
  const n=vals.length,max=9;
  const bw=(W-mL-mR)/n, Y=v=>H-mB-(v/max)*(H-mT-mB);
  const g=el('g',{class:'grid'}),ax=el('g',{class:'axis'});
  [0,3,6,9].forEach(t=>{ g.appendChild(el('line',{x1:mL,x2:W-mR,y1:Y(t),y2:Y(t)}));
    const tx=el('text',{x:mL-9,y:Y(t)+3.5,'text-anchor':'end'}); tx.textContent=t; ax.appendChild(tx); });
  svg.append(g);
  host.appendChild(svg); const tip=mkTip(host);
  vals.forEach((v,i)=>{
    if(!v) return;
    const h=Y(0)-Y(v), x=mL+i*bw+1;
    const r=el('rect',{x:x,y:Y(v),width:Math.max(bw-3,2),height:h,rx:3,
      fill: D.mer[i]>=3? css('--teal') : css('--ochre'), 'fill-opacity': D.mer[i]>=3?'1':'.85'});
    r.style.cursor='crosshair';
    r.addEventListener('pointerenter',()=>{
      const rc=svg.getBoundingClientRect();
      tip.innerHTML=`<b>${label(D.mois[i])}</b><br>MER réel ${D.mer[i].toLocaleString('fr-CA')}<br>Pub ${money(D.dep[i])} → ${money(D.ventes[i])}`;
      place(tip,host,(x+bw/2)/W*rc.width,Y(v)/H*rc.height);
    });
    r.addEventListener('pointerleave',()=>tip.style.opacity=0);
    svg.append(r);
    if(D.mer[i]>max){                       // barre écrêtée : chevron + valeur réelle
      const cx=x+(bw-3)/2, cy=Y(v)-6;
      svg.append(el('path',{d:`M${cx-4} ${cy} L${cx} ${cy-5} L${cx+4} ${cy}`,fill:'none',
        stroke:css('--teal'),'stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round'}));
    }
  });
  svg.append(el('line',{x1:mL,x2:W-mR,y1:Y(3),y2:Y(3),stroke:css('--crit'),'stroke-width':1.5,'stroke-dasharray':'5 4'}));
  const lb=el('text',{x:W-mR+8,y:Y(3)+3.5,'text-anchor':'start',class:'axis'});
  lb.setAttribute('fill',css('--crit')); lb.style.fontFamily='"IBM Plex Mono",monospace'; lb.style.fontSize='10px';
  lb.textContent='seuil 3,0'; svg.append(lb);
  D.mois.forEach((m,i)=>{ if(+m.slice(5,7)===1){
    const tx=el('text',{x:mL+i*bw+bw/2,y:H-mB+17,'text-anchor':'middle'}); tx.textContent=m.slice(0,4); ax.appendChild(tx);}});
  svg.append(ax);
}

/* ---------- 3. effet infolettre ---------- */
function chart3(){
  const host=document.getElementById('c3'); host.innerHTML='';
  const rows=[['Jour d’envoi',3696],['J+1',2516],['J+2',2564],['J+3',2363],['Jour sans envoi',1153]];
  const W=1000,H=210,mL=150,mR=76,mT=8,mB=8;
  const svg=el('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'Ventes nettes médianes selon la distance à un envoi'});
  const max=4000, bh=(H-mT-mB)/rows.length, X=v=>mL+(v/max)*(W-mL-mR);
  host.appendChild(svg); const tip=mkTip(host);
  rows.forEach(([lab,v],i)=>{
    const y=mT+i*bh+7, h=bh-16;
    const last=i===rows.length-1;
    const r=el('rect',{x:mL,y:y,width:X(v)-mL,height:h,rx:3,
      fill:last?css('--muted'):css('--teal'),'fill-opacity':last?'.45':(i?'.6':'1')});
    r.style.cursor='crosshair';
    r.addEventListener('pointerenter',()=>{ const rc=svg.getBoundingClientRect();
      tip.innerHTML=`<b>${lab}</b><br>${money(v)} — ×${(v/1153).toFixed(2)} vs jour sans envoi`;
      place(tip,host,(mL+(X(v)-mL)/2)/W*rc.width,y/H*rc.height); });
    r.addEventListener('pointerleave',()=>tip.style.opacity=0);
    svg.append(r);
    const t=el('text',{x:mL-14,y:y+h/2+4,'text-anchor':'end',class:'axis'});
    t.style.fontFamily='"Public Sans",sans-serif'; t.style.fontSize='13px';
    t.setAttribute('fill',css('--ink-2')); t.textContent=lab; svg.append(t);
    const val=el('text',{x:X(v)+10,y:y+h/2+4,class:'axis'});
    val.style.fontSize='12.5px'; val.setAttribute('fill',css('--ink')); val.textContent=money(v); svg.append(val);
  });
}

/* ---------- 4. ROAS par objectif ---------- */
function chart4(){
  const host=document.getElementById('c4'); host.innerHTML='';
  const rows=[['Ventes (conversion)',2.64,357408],['Trafic',1.07,21889],['Clics vers le site',0.43,602],
              ['Engagement',0.35,33080],['Notoriété',0.34,2690]];
  const W=1000,H=230,mL=180,mR=150,mT=8,mB=8;
  const svg=el('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'ROAS par objectif de campagne'});
  const max=3, bh=(H-mT-mB)/rows.length, X=v=>mL+(v/max)*(W-mL-mR);
  host.appendChild(svg); const tip=mkTip(host);
  svg.append(el('line',{x1:X(1),x2:X(1),y1:mT,y2:H-mB,stroke:css('--muted'),'stroke-width':1,'stroke-dasharray':'4 4'}));
  rows.forEach(([lab,v,sp],i)=>{
    const y=mT+i*bh+7, h=bh-16;
    const r=el('rect',{x:mL,y:y,width:Math.max(X(v)-mL,2),height:h,rx:3,fill:v>=1?css('--teal'):css('--crit')});
    r.style.cursor='crosshair';
    r.addEventListener('pointerenter',()=>{ const rc=svg.getBoundingClientRect();
      tip.innerHTML=`<b>${lab}</b><br>ROAS ${v.toLocaleString('fr-CA')} · ${money(sp)} dépensés`;
      place(tip,host,(mL+(X(v)-mL)/2)/W*rc.width,y/H*rc.height); });
    r.addEventListener('pointerleave',()=>tip.style.opacity=0);
    svg.append(r);
    const t=el('text',{x:mL-14,y:y+h/2+4,'text-anchor':'end'});
    t.style.fontFamily='"Public Sans",sans-serif'; t.style.fontSize='13px';
    t.setAttribute('fill',css('--ink-2')); t.textContent=lab; svg.append(t);
    const val=el('text',{x:X(v)+10,y:y+h/2+4});
    val.style.fontFamily='"IBM Plex Mono",monospace'; val.style.fontSize='12px';
    val.setAttribute('fill',css('--ink'));
    val.textContent=v.toLocaleString('fr-CA')+'  ·  '+money(sp); svg.append(val);
  });
  const t1=el('text',{x:X(1),y:H-mB+2,'text-anchor':'middle'});
  t1.style.fontFamily='"IBM Plex Mono",monospace'; t1.style.fontSize='10px';
  t1.setAttribute('fill',css('--muted')); t1.textContent='seuil 1,0'; svg.append(t1);
}

function draw(){ chart1(); chart2(); chart3(); chart4(); }
if(document.fonts && document.fonts.ready){ document.fonts.ready.then(draw); } else { draw(); }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',draw);
let rt; addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(draw,150);});
</script>
"""

HTML = HTML.replace("__DATA__", json.dumps(CH))
# garde-fou : aucune coquille dans les tokens
for _bad in ("council","undefined","NaN","lorem"):
    assert _bad not in HTML, f"token cassé: {_bad}"
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(HTML, encoding="utf-8")
print("écrit", OUT, len(HTML), "caractères")
