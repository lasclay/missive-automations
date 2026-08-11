#!/usr/bin/env python3
"""La proposition de partenariat à Wassim Gharmoul, version d'août 2026.

Par rapport à la version de juillet, tout va dans le sens de la simplicité :

1. la part se calcule sur **Lasclay au complet**, plus seulement sur la
   production tunisienne — il n'y a plus de périmètre à définir ni à auditer ;
2. les fonds sont déposés **en dollars canadiens** au compte de Lasclay ;
3. l'apport est **fixé à 100 000 $**, la part reste 30 %, le plafond descend de
   600 000 $ à **500 000 $** ;
4. les petits caractères disent ce que c'est : du **capital de risque**, des
   montants de profit **estimés**, un plafond **fixe** ;
5. une **option de renouvellement** : redéposer 100 000 $ pour conserver les
   30 % jusqu'au terme et relever le plafond de 200 000 $.

Trois changements de plus, en août, et le premier déplace beaucoup d'argent :

6. la base est le **bénéfice après impôts, hors aides publiques et fiscales**.
   Le partenaire ne touche plus une part des subventions et des crédits de
   recherche — de l'argent public accordé pour la recherche, pas du profit gagné
   sur les ventes — ni une part de l'impôt. Sur la lecture optimiste, la part
   cumulée de trois exercices passe de 500 000 $ à 446 507 $ ; sur la lecture
   prudente, de 305 604 $ à **144 599 $**, dont **zéro** la première année ;
7. les versements sont **mensuels**, à compter du troisième mois suivant le
   dépôt, en acomptes sur le résultat cumulatif avec une retenue de prudence de
   50 % et une régularisation annuelle. Sans la retenue, la saisonnalité ferait
   sortir en décembre de l'argent que l'été reprendrait : en lecture prudente,
   37 523 $ auraient été versés sur un exercice qui ne doit rien ;
8. la **commission sur les ventes européennes est supprimée**. Elle payait sur
   le chiffre d'affaires — 30 % du CA quand la contribution rendue en Europe
   tourne autour de 55 %, avant toute logistique et tout marketing — donc elle
   rendait chaque vente européenne déficitaire, et elle mettait les deux
   parties de deux côtés de la table à chaque décision de prix.

Tous les chiffres viennent du scénario optimiste du classeur audité, celui que
`Inputs!C70 = 3` active, et la lecture prudente du scénario 1. Aucun n'est saisi
ici : ils sortent de `pdf_data.json`, comme ceux du mémo des prêteurs. Les deux
documents ne peuvent donc pas diverger.

    python3 proposition_wassim.py
"""
import json

from design_pdf import (CSS, GRIS, INK, LIGNE, ORANGE, VERT, fr, pct, rendre)

D = json.load(open('pdf_data.json', encoding='utf8'))
O = D['opt']

APPORT = 100_000.0
PART = 0.30
PLAFOND = 500_000.0
PLAFOND_RENOUV = 700_000.0
ANS = ('2026-2027', '2027-2028', '2028-2029')


def quotes_parts(plafond, lecture=O):
    """La part de 30 %, exercice par exercice, arrêtée au plafond.

    La base est le **bénéfice après impôts, hors aides publiques et fiscales** :
    l'argent que Lasclay garde, gagné sur ses ventes et non reçu de l'État. Un
    exercice sans bénéfice sur cette base ne verse rien — d'où le `max(0, …)`,
    et non un montant négatif reporté sur l'exercice suivant.
    """
    out, cum = [], 0.0
    for i in range(3):
        base = lecture['net_hors'][i + 1]
        brut = max(0.0, PART * base)
        verse = min(brut, max(0.0, plafond - cum))
        cum += verse
        out.append({'base': base, 'pai': lecture['pai'][i + 1], 'brut': brut,
                    'verse': verse, 'cum': cum})
    return out


SANS = quotes_parts(PLAFOND)
AVEC = quotes_parts(PLAFOND_RENOUV)
PRUDENT = quotes_parts(PLAFOND, D['cons'])
# Quand la mise est-elle récupérée ? On interpole dans l'exercice qui fait
# passer le cumul au-dessus de l'apport ; None si l'horizon n'y arrive pas.
RECUP = None
for _i, _s in enumerate(SANS):
    if _s['cum'] >= APPORT:
        _avant = SANS[_i - 1]['cum'] if _i else 0.0
        RECUP = (_i, (APPORT - _avant) / _s['verse'] if _s['verse'] else 0.0)
        break
# Le plafond est-il atteint dans l'horizon du modèle ?
PLAFOND_ATTEINT = SANS[2]['cum'] >= PLAFOND


def foot(n, tot=6):
    return (f'<div class="foot"><span>LASCLAY · PROPOSITION DE PARTENARIAT · '
            f'CONFIDENTIEL</span><span>{n} / {tot}</span></div></div>')


P = []

# ------------------------------------------------------------------ COUVERTURE
P.append(f"""<div class="page cover">
  <div class="mark">LASCLAY</div><div class="rule"></div>
  <div class="ctype">OPPORTUNITÉ DE PARTENARIAT · VERSION RÉVISÉE</div>
  <h1>Faire passer l'asclépiade de curiosité artisanale à fleuron d'envergure
    mondiale, basé au Québec et en Tunisie.</h1>
  <div class="clede">Une fibre que personne d'autre ne maîtrise, une communauté
    qui s'enflamme, et un virage manufacturier qui est maintenant <em>fait</em>.
    Depuis juillet, la production québécoise est arrêtée, l'assemblage part vers
    la Tunisie, et les livres de juillet sont fermés. Voici la proposition, revue
    et simplifiée.</div>

  <div class="ctiles">
    <div class="tile"><div class="v">{fr(APPORT, 0, '')} $</div>
      <div class="n">Ton apport, en dollars canadiens</div></div>
    <div class="tile"><div class="v">{pct(PART, 0)}</div>
      <div class="n">Du bénéfice net de Lasclay, hors aides publiques</div></div>
    <div class="tile"><div class="v">{fr(PLAFOND / 1000, 0, '')} k$</div>
      <div class="n">Plafond fixe, soit 5× ta mise</div></div>
    <div class="tile"><div class="v">Mensuel</div>
      <div class="n">Versements, dès le 3<sup>e</sup> mois</div></div>
  </div>
  <div class="cfoot">LES PRODUITS LASCLAY INC. &nbsp;·&nbsp; QUÉBEC (LIMOILOU)
    &nbsp;·&nbsp; AOÛT 2026<br>Document confidentiel préparé pour Wassim
    Gharmoul. Chiffres indicatifs et non contractuels.</div>
</div>""")

# ------------------------------------------------------------------ 01
P.append(f"""<div class="page">
  <div class="kicker">Ce qui a changé</div>
  <div class="sect"><span class="num">01</span><h2>Le virage n'est plus un
    projet, il est en cours</h2></div>
  <div class="lede">En juillet, je te présentais une intention. En août, elle est
    exécutée : la production québécoise est arrêtée, les employés de production
    sont partis, l'assemblage se transfère.</div>

  <h3>Ce que les livres montrent, de mai à juillet</h3>
  <table>
    <tr><th></th><th>2025</th><th>2026</th><th></th></tr>
    <tr><td>Main-d'œuvre de production</td><td>{fr(D['ete']['mod'][0])}</td>
      <td>{fr(D['ete']['mod'][1])}</td>
      <td class="neg">{pct(D['ete']['mod'][1] / D['ete']['mod'][0] - 1, 0)}</td></tr>
    <tr><td>Publicité numérique</td><td>{fr(D['ete']['pub'][0])}</td>
      <td>{fr(D['ete']['pub'][1])}</td>
      <td class="neg">{pct(D['ete']['pub'][1] / D['ete']['pub'][0] - 1, 0)}</td></tr>
    <tr class="hi"><td>Achats de matières premières</td>
      <td>{fr(D['ete']['mp'][0])}</td><td>{fr(D['ete']['mp'][1])}</td>
      <td>+{pct(D['ete']['mp'][1] / D['ete']['mp'][0] - 1, 0)}</td></tr>
    <caption>Une entreprise à court d'argent coupe ses achats. Les nôtres montent
      de {pct(D['ete']['mp'][1] / D['ete']['mp'][0] - 1, 0)} pendant que la
      main-d'œuvre de production tombe de
      {pct(1 - D['ete']['mod'][1] / D['ete']['mod'][0], 0)} : c'est du stock
      constitué d'avance, pour un assemblage fait ailleurs. Source :
      QuickBooks.</caption>
  </table>

  <p>L'été n'a pas été subi, il a été arrêté. Servir la saison chaude demandait
  de produire au Québec, et l'été 2025 l'avait déjà chiffré : juin et juillet
  2025 dégagent {pct(D['ete']['juin25']['contrib'] / D['ete']['juin25']['ventes'], 0)}
  et {pct(D['ete']['juillet25']['contrib'] / D['ete']['juillet25']['ventes'], 0)}
  de contribution marginale, contre {pct(D['ete']['nov25_pct'], 0)} et
  {pct(D['ete']['dec25_pct'], 0)} en novembre et décembre — et ils ne couvrent
  même pas leurs frais généraux. Faire de la publicité pour vendre à perte
  n'aurait servi à rien.</p>

  <h3>Ce que le virage libère, chaque année</h3>
  <div class="two">
    <div class="card"><h4>Main-d'œuvre de production</h4>
      <p class="big">{fr(D['mod_production']['avant'] - D['mod_production']['apres'])}</p>
      <p style="font-size:8.5pt;color:{GRIS};margin:0">L'isolant devient un
      produit en rouleau : {fr(D['mod_production']['apres'])} de main-d'œuvre
      pour couvrir une année entière, contre
      {fr(D['mod_production']['avant'])} en 2025-2026.</p></div>
    <div class="card"><h4>Loyer, par la sous-location</h4>
      <p class="big">{fr(D['loyer'][0] - D['loyer'][1])}</p>
      <p style="font-size:8.5pt;color:{GRIS};margin:0">De {fr(D['loyer'][0])} à
      {fr(D['loyer'][1])} dès 2026-2027, et {fr(D['loyer'][3])} en 2028-2029
      une fois l'excédent libéré.</p></div>
  </div>
  <p style="margin-top:6px"><strong>{fr(D['mod_production']['avant'] - D['mod_production']['apres'] + D['loyer'][0] - D['loyer'][1])}
  par année</strong>, dès 2026-2027. L'assemblage, lui, ne disparaît pas : il
  devient variable, il monte avec les ventes au lieu d'être porté à l'année.
  C'est le vrai changement — une croissance qui coûtait de l'argent devient une
  croissance qui en génère.</p>
  {foot(1)}""")

# ------------------------------------------------------------------ 02
P.append(f"""<div class="page">
  <div class="kicker">La trajectoire</div>
  <div class="sect"><span class="num">02</span><h2>Où ça mène, et sur quoi ça
    repose</h2></div>
  <div class="lede">Deux moteurs, pas un. Le commerce en ligne, qui a porté seul
    les six premières années, et le canal détail, construit ville par ville.</div>

  <table>
    <tr><th>Exercice clos le 31 août</th><th>2025-2026</th><th>2026-2027</th>
      <th>2027-2028</th><th>2028-2029</th></tr>
    <tr class="hi"><td>Ventes nettes</td>
      {''.join(f'<td>{fr(v)}</td>' for v in O['ventes'])}</tr>
    <tr><td style="padding-left:14px">dont commerce en ligne</td>
      {''.join(f'<td>{fr(v)}</td>' for v in O['dtc'])}</tr>
    <tr><td style="padding-left:14px">dont canal détail</td>
      {''.join(f'<td>{fr(v)}</td>' for v in O['detail'])}</tr>
    <tr><td>Points de vente au 31 août</td>
      {''.join(f'<td>{v:,.0f}</td>'.replace(',', ' ') for v in O['pdv'])}</tr>
    <tr><td>EBITDA</td>{''.join(f'<td>{fr(v)}</td>' for v in O['ebitda'])}</tr>
    <tr><td>Bénéfice avant impôts</td>
      {''.join(f'<td>{fr(v)}</td>' for v in O['pai'])}</tr>
    <tr><td style="padding-left:14px">moins les aides publiques et fiscales</td>
      {''.join(f'<td>{fr(-v)}</td>' for v in O['aides'])}</tr>
    <tr><td style="padding-left:14px">moins les impôts</td>
      {''.join(f'<td>{fr(-v)}</td>' for v in O['impots'])}</tr>
    <tr class="hi"><td><strong>Base de ta part</strong></td>
      {''.join(f'<td>{fr(v)}</td>' for v in O['net_hors'])}</tr>
    <caption>Scénario optimiste du modèle financier, celui qui reprend la
      trajectoire annoncée en juillet 2026. Onze mois de 2025-2026 sont du réel,
      rapprochés de QuickBooks compte par compte.</caption>
  </table>

  <div class="two">
    <div class="card"><h4>Le commerce en ligne retrouve son rythme</h4>
      <p style="font-size:8.5pt;margin:0">Il croît de
      <strong>{pct((O['dtc'][3] / O['dtc'][0]) ** (1 / 3) - 1, 1)} par année</strong>
      de 2025-2026 à 2028-2029. C'est exactement le rythme tenu de 2021-2022 à
      2025-2026. Ce scénario ne demande à personne de croire qu'on fera mieux
      que ce qu'on a déjà fait cinq années de suite.</p></div>
    <div class="card"><h4>Le détail ne repose pas sur un pari</h4>
      <p style="font-size:8.5pt;margin:0">Quarante villes nommées,
      {D['detail']['nb_points']} points de vente possibles, un registre construit
      sur les rapports de consignation réels et les ventes en ligne par ville de
      facturation. {O['pdv'][3]:,.0f} points ouverts au 31 août 2029 dans ce
      scénario.</p></div>
  </div>

  <p style="margin-top:6px">La version de juillet atteignait 4,17 M$ avec le
  <strong>seul</strong> commerce en ligne, à 61,7 % de croissance par année, et
  ignorait le canal détail. Le modèle a été audité depuis : même destination,
  mais portée par deux moteurs au lieu d'un, et chaque hypothèse est traçable
  jusqu'à une ligne de QuickBooks ou de Shopify.</p>
  {foot(2)}""")

# ------------------------------------------------------------------ 03
P.append(f"""<div class="page">
  <div class="kicker">Ta place</div>
  <div class="sect"><span class="num">03</span><h2>La conquête de l'Europe</h2></div>
  <div class="lede">La prochaine frontière, c'est l'Europe, et la France en
    premier. Tu n'apportes pas juste du capital : tu ouvres un marché que tu
    connais mieux que moi.</div>

  <p>Tu deviens le <strong>double connecteur</strong> de Lasclay : l'usine en
  amont, déjà branchée grâce à toi, et la France en aval, où ta culture et ton
  réseau valent de l'or. Peu d'investisseurs peuvent faire les deux.</p>

  <div class="three">
    <div class="card"><h4>Représentation et ventes France</h4></div>
    <div class="card"><h4>Réseau et culture européenne</h4></div>
    <div class="card"><h4>Le pont Tunisie ↔ Amérique ↔ Europe</h4></div>
  </div>

  <h3>Ce que l'Europe n'est pas</h3>
  <p>Elle n'est pas dans les chiffres de la page précédente. Aucun revenu
  européen n'est budgété, ni dans le scénario optimiste ni dans les deux autres.
  Ce que tu ouvres est donc <strong>en plus</strong> de la trajectoire, pas
  dedans.</p>
  <p>Et c'est exactement pour ça qu'il n'y a <strong>pas de commission
  séparée</strong> sur l'Europe. Une commission t'aurait payé sur le chiffre
  d'affaires, que la vente européenne soit rentable ou non, et nous aurait mis
  de deux côtés de la table à chaque décision de prix. Ta part de profit fait
  l'inverse : chaque dollar de bénéfice que l'Europe ajoute grossit la base sur
  laquelle tes {pct(PART, 0)} se calculent. On gagne au même endroit, ou pas du
  tout.</p>

  <h3>Ce qui ne change jamais</h3>
  <p>La culture et la transformation de la soie d'asclépiade restent
  <strong>100 % au Québec</strong>. C'est le cœur de la mission et l'avantage
  que personne ne peut copier. On change la façon de produire, jamais la raison
  d'être.</p>
  {foot(3)}""")

# ------------------------------------------------------------------ 04
P.append(f"""<div class="page">
  <div class="kicker">La proposition</div>
  <div class="sect"><span class="num">04</span><h2>Les termes, révisés et
    simplifiés</h2></div>
  <div class="lede">Un partenariat, pas un prêt. Tu partages le profit que cette
    croissance crée, et le risque qui va avec, dans le respect de tes
    principes.</div>

  <table>
    <tr><th>Élément</th><th style="text-align:left">Ce qui est proposé</th></tr>
    <tr class="hi"><td>Ton apport</td>
      <td style="text-align:left"><strong>{fr(APPORT)}</strong>, déposés en
      <strong>dollars canadiens</strong> au compte de Lasclay. Montant fixe : ni
      palier, ni taux bonifié à négocier.</td></tr>
    <tr><td>La forme</td>
      <td style="text-align:left"><strong>Partage de profit, pas d'intérêt.</strong>
      Tu partages le profit et le risque, dans le respect de ta philosophie et de
      ta spiritualité.</td></tr>
    <tr class="hi"><td>Ta part</td>
      <td style="text-align:left"><strong>{pct(PART, 0)} du bénéfice après
      impôts de Lasclay au complet, hors aides publiques et fiscales.</strong>
      Plus seulement de la production tunisienne : il n'y a plus de périmètre à
      définir ni à auditer. Et la base est l'argent que l'entreprise
      <em>garde</em> — après impôts, et sans les subventions ni les crédits
      d'impôt, qui sont de l'argent public accordé pour la recherche et non du
      profit gagné sur les ventes.</td></tr>
    <tr><td>Les versements</td>
      <td style="text-align:left"><strong>Mensuels</strong>, à compter du
      <strong>troisième mois suivant le dépôt</strong> de ton apport, puis le
      même jour chaque mois. Régularisation annuelle aux états financiers. La
      mécanique est détaillée à la page suivante.</td></tr>
    <tr><td>Le plafond</td>
      <td style="text-align:left"><strong>{fr(PLAFOND)} reçus au total</strong>,
      soit 5× ta mise. Le plafond est <strong>fixe</strong> ; le profit réel
      décide si on l'atteint, et quand. Sur les trois exercices du modèle, même
      en lecture optimiste, il ne l'est pas.</td></tr>
    <tr><td>Le renouvellement</td>
      <td style="text-align:left">Quand le plafond est atteint, tu peux
      <strong>redéposer {fr(APPORT)}</strong> pour conserver tes {pct(PART, 0)}
      jusqu'au terme de l'entente et relever le plafond de
      <strong>{fr(200_000)}</strong>, à {fr(PLAFOND_RENOUV)}. À ta seule
      discrétion.</td></tr>
    <tr><td>Ton rôle</td>
      <td style="text-align:left">Ouvrir la <strong>France</strong> et l'Europe,
      et tenir le pont avec l'usine. Aucune commission séparée : ce que l'Europe
      ajoute au bénéfice grossit la base de tes {pct(PART, 0)}, et rien ne nous
      met de deux côtés de la table.</td></tr>
    <tr><td>La sortie</td>
      <td style="text-align:left">Une porte de sortie prévue d'avance, à une
      formule juste : ta position peut être rachetée. Ta rétribution récompense
      ton risque et ta contribution, pas une position passive.</td></tr>
  </table>

  <h3>Emploi des fonds</h3>
  <p>La production offshore se paie <strong>avant</strong> l'encaissement des
  ventes. L'apport finance ce décalage, ouvre l'Europe et sécurise la
  transition.</p>
  <table>
    <tr><td style="width:14%">50 %</td>
      <td style="text-align:left"><strong>Fonds de roulement, production
      Tunisie.</strong> Commandes usine, isolant et fret du Québec vers la
      Tunisie, douanes, inventaire de lancement des produits finis.</td></tr>
    <tr><td>30 %</td>
      <td style="text-align:left"><strong>Lancement Europe.</strong> Logistique
      et entreposage UE, conformité, premier inventaire, acquisition des premiers
      comptes de distribution.</td></tr>
    <tr><td>20 %</td>
      <td style="text-align:left"><strong>Coussin de transition.</strong>
      Traverser la basse saison et alléger la pression de la dette court terme
      pendant que le virage génère sa trésorerie.</td></tr>
  </table>
  {foot(4)}""")

# ------------------------------------------------------------------ 05
lignes = ''.join(
    f'<tr><td>{an}</td><td>{fr(s["pai"])}</td><td>{fr(s["base"])}</td>'
    f'<td>{fr(s["brut"])}</td><td>{fr(s["cum"])}</td></tr>'
    for an, s in zip(ANS, SANS))
lignes_p = ''.join(
    f'<tr><td>{an}</td><td>{fr(s["base"])}</td><td>{fr(s["brut"])}</td>'
    f'<td>{fr(s["cum"])}</td></tr>'
    for an, s in zip(ANS, PRUDENT))

if RECUP is None:
    recup = ('Sur cet horizon de trois exercices, le cumul atteint '
             f'{fr(SANS[2]["cum"])} : la mise est récupérée, le plafond ne l\'est pas.')
else:
    _i, _f = RECUP
    recup = (f'Ta mise de {fr(APPORT)} est récupérée en cours de '
             f'<strong>{ANS[_i]}</strong>, autour du '
             f'{"premier" if _f < 0.34 else "deuxième" if _f < 0.67 else "dernier"} '
             f'tiers de l\'exercice.')

P.append(f"""<div class="page">
  <div class="kicker">Le rendement</div>
  <div class="sect"><span class="num">05</span><h2>Ce que ça peut te
    rapporter</h2></div>
  <div class="lede">Ta part suit le bénéfice réel de Lasclay, après impôts et
    sans les aides publiques. Voici le chemin sur le scénario optimiste du
    modèle — celui de la page 2.</div>

  <table>
    <tr><th>Exercice</th><th>Bénéfice avant impôts</th>
      <th>Base : après impôts, hors aides</th><th>Ta part, {pct(PART, 0)}</th>
      <th>Cumulé</th></tr>
    {lignes}
    <caption>{recup} Le plafond de {fr(PLAFOND)} n'est
      {'' if PLAFOND_ATTEINT else 'pas '}atteint dans l'horizon du modèle : ce
      que tu reçois est le profit lui-même, pas le plafond.</caption>
  </table>

  <h3>Comment les versements tombent</h3>
  <ul>
    <li><strong>Mensuels</strong>, à compter du troisième mois suivant le dépôt
      de ton apport, puis le même jour chaque mois.</li>
    <li>Chaque acompte vaut {pct(PART, 0)} du résultat cumulatif de l'exercice
      sur la base convenue, moins ce qui a déjà été versé, <strong>avec une
      retenue de prudence de 50 %</strong> jusqu'aux états financiers.</li>
    <li><strong>Régularisation annuelle</strong> dans les 30 jours des états
      financiers : le solde part en un seul versement.</li>
    <li>Si les acomptes ont dépassé le dû, <strong>rien n'est à rembourser</strong> :
      l'excédent s'impute sur les acomptes de l'exercice suivant.</li>
    <li>Un exercice sans bénéfice sur cette base ne verse rien, et le déficit
      <strong>ne se reporte pas</strong> sur les exercices suivants.</li>
  </ul>
  <p style="font-size:8.5pt;color:{GRIS}">Pourquoi la retenue de 50 % : les
  ventes de Lasclay sont saisonnières. Novembre et décembre portent le résultat
  de l'année, le printemps et l'été en reprennent une partie. Verser en décembre
  {pct(PART, 0)} d'un cumul que l'été ramènera plus bas ferait sortir de la
  caisse de l'argent que l'exercice ne dégagera pas — et il faudrait te le
  redemander. La retenue évite cette conversation.</p>

  <h3>Si le plan va moins vite</h3>
  <table>
    <tr><th>Lecture prudente du modèle</th><th>Base : après impôts, hors aides</th>
      <th>Ta part, {pct(PART, 0)}</th><th>Cumulé</th></tr>
    {lignes_p}
    <caption>Le modèle porte trois lectures. Celle-ci est la plus basse des
      trois, et elle est celle que je dépose aux prêteurs. Je te la montre parce
      que tu dois voir les deux bouts : ta part suit le bénéfice réel, à la
      hausse comme à la baisse.</caption>
  </table>

  <h3>L'option de renouvellement</h3>
  <p>Au moment où le plafond de {fr(PLAFOND)} est atteint, tu peux redéposer
  {fr(APPORT)}. Tes {pct(PART, 0)} continuent de courir jusqu'au terme de
  l'entente, et le plafond total passe à {fr(PLAFOND_RENOUV)}. Tu décides à ce
  moment-là, avec plusieurs exercices de résultats réels sous les yeux — pas
  aujourd'hui, sur une projection.</p>
  {foot(5)}""")

# ------------------------------------------------------------------ 06
P.append(f"""<div class="page">
  <div class="kicker">Cartes sur table</div>
  <div class="sect"><span class="num">06</span><h2>Le risque, et ce qu'il faut
    en savoir</h2></div>

  <div class="two">
    <div class="card o"><h4>Exécution du virage</h4>
      <p style="font-size:8.5pt;margin:0">Il faut transférer l'assemblage sans
      accroc sur la qualité et les délais. La dépendance logistique, le risque de
      change et les douanes sont réels. L'isolant et le savoir-faire critiques
      restent au Québec, ce qui limite l'exposition.</p></div>
    <div class="card o"><h4>La dette de transition</h4>
      <p style="font-size:8.5pt;margin:0">L'entreprise porte de la dette pendant
      la transition et cherche en parallèle un financement institutionnel pour la
      restructurer. Ton apport ne rembourse pas cette dette : il finance le
      décalage entre la production et l'encaissement.</p></div>
    <div class="card o"><h4>Le canal détail</h4>
      <p style="font-size:8.5pt;margin:0">{pct(O['detail'][3] / O['ventes'][3], 0)}
      des ventes de 2028-2029 reposent sur un canal qui compte
      <strong>un seul point de vente aujourd'hui</strong>. C'est le risque
      principal du plan, et il est le même dans les trois scénarios du
      modèle.</p></div>
  </div>
  <div class="two" style="margin-top:9px">
    <div class="card o"><h4>Le scénario retenu est l'optimiste</h4>
      <p style="font-size:8.5pt;margin:0">Le modèle porte trois lectures. Celle
      d'ici est la plus haute. En lecture prudente, ta part cumule
      {fr(PRUDENT[2]['cum'])} sur les trois exercices au lieu de
      {fr(SANS[2]['cum'])}, et <strong>2026-2027 ne verse rien</strong> : le
      bénéfice hors aides y est négatif. Le tableau est à la page
      précédente.</p></div>
    <div class="card"><h4>Ce que tu peux vérifier</h4>
      <p style="font-size:8.5pt;margin:0">Le modèle est un chiffrier mensuel de
      48 mois rapproché de QuickBooks compte par compte, avec son journal
      d'audit. Onze mois de 2025-2026 sont du réel. Je te l'ouvre quand tu
      veux.</p></div>
  </div>

  <p style="margin-top:8px">C'est précisément pour ça qu'un partenaire comme toi
  compte, et que ton apport arrive au bon moment. Je te le dis pour qu'on avance
  les yeux ouverts. Si ça t'allume : on cadre la structure proprement avec un
  avocat, dans le respect de ta philosophie, et on part à la conquête de
  l'Europe.</p>

  <div class="fine">
    <p><strong>Ce document décrit un investissement en capital de risque.</strong>
    Le capital engagé n'est pas garanti et peut être perdu en tout ou en partie.
    Lasclay n'offre ni intérêt, ni rendement minimal, ni garantie de
    remboursement.</p>
    <p><strong>Les montants de profit indiqués sont des estimés.</strong> Ils
    proviennent du scénario optimiste du modèle financier interne de la
    direction, dont onze mois de l'exercice 2025-2026 sont du réel rapproché de
    QuickBooks et dont les trois exercices suivants sont projetés. Ces
    projections reposent sur des hypothèses documentées qui peuvent ne pas se
    réaliser. Le rendement suit le bénéfice réel, à la hausse comme à la baisse,
    et peut être nul.</p>
    <p><strong>Le plafond, lui, est fixe.</strong> {fr(PLAFOND)} au total, porté
    à {fr(PLAFOND_RENOUV)} si l'option de renouvellement est exercée. Ce que les
    projections font varier, c'est le délai pour l'atteindre — s'il est atteint —
    pas son montant. Aucune commission, sur aucun territoire, ne s'ajoute à la
    part de profit.</p>
    <p>La part de profit se calcule sur le <strong>bénéfice après impôts de Les
    Produits Lasclay inc., duquel sont retranchées les aides publiques et
    fiscales</strong> — subventions, crédits d'impôt de recherche et
    développement et autres crédits d'impôt — tel qu'établi par les états
    financiers annuels. Les versements sont <strong>mensuels</strong>, à compter
    du troisième mois suivant le dépôt de l'apport, sous forme d'acomptes sur le
    résultat cumulatif de l'exercice, avec une retenue de prudence de 50 % et
    une régularisation dans les 30 jours des états financiers. Un exercice sans
    bénéfice sur cette base ne verse rien et son déficit ne se reporte pas. Le
    terme de l'entente, le rang de la part par rapport au service de la dette et
    la formule de rachat seront arrêtés dans la convention écrite.</p>
    <p>Document confidentiel préparé pour Wassim Gharmoul. Chiffres indicatifs et
    non contractuels ; ils ne constituent ni une garantie, ni une offre, ni une
    sollicitation. Toute entente ferait l'objet d'une convention écrite revue par
    conseil juridique et validée sur le plan de la conformité.</p>
  </div>
  {foot(6)}""")

STYLE = CSS.replace('</style>', f"""
.three {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 9px;
  margin-top: 8px; }}
.big {{ font-family: 'Bitstream Charter',Georgia,serif; font-size: 19pt;
  color: {VERT}; margin: 2px 0 4px; }}
.card.o .big {{ color: {ORANGE}; }}
.fine {{ margin-top: 12px; padding-top: 8px; border-top: 1px solid {LIGNE};
  font-size: 7.4pt; line-height: 1.42; color: {GRIS}; }}
.fine p {{ margin: 0 0 5px; }}
.fine strong {{ color: {INK}; }}
</style>""")

if __name__ == '__main__':
    import design_pdf
    design_pdf.CSS = STYLE
    taille = rendre(P, 'Lasclay · Proposition de partenariat · confidentiel',
                    'Lasclay - Proposition de partenariat (Wassim) - aout 2026.pdf',
                    'proposition_wassim.html')
    print(f'PDF produit {taille:,} octets')
    for nom, q in (('optimiste', SANS), ('prudent', PRUDENT)):
        print(f'  {nom:<10} ' + '  '.join(f'{a} {s["brut"]:>9,.0f}'
                                          for a, s in zip(ANS, q))
              + f'   cumul {q[2]["cum"]:>9,.0f} ({q[2]["cum"] / APPORT:.1f}x)')
    print(f'  plafond de {PLAFOND:,.0f} $ '
          f'{"atteint" if PLAFOND_ATTEINT else "NON atteint"} dans l’horizon ; '
          f'mise récupérée en {ANS[RECUP[0]] if RECUP else "—"}')
