#!/usr/bin/env python3
"""Le mémo de Wassim : le même modèle, lu sur le scénario optimiste.

Ce n'est pas le mémo des prêteurs avec d'autres chiffres. Un prêteur veut
savoir si l'entreprise couvre son service de la dette ; un partenaire veut
savoir où va le plafond et ce qu'il y ajoute. Les deux documents partent des
mêmes données — `pdf_data.json`, produit par le classeur audité — mais ils ne
racontent pas la même chose.

Ce que ce mémo montre et que l'autre ne montre pas : les trois lectures du
modèle côte à côte, ce que l'Europe ajouterait, et pourquoi la trajectoire
optimiste n'est pas un pari sur un chiffre mais sur un rythme déjà tenu.

Ce qu'il ne montre pas : la couverture du service de la dette, les covenants,
le moratoire BDC. Ce n'est pas son sujet.

    python3 memo_wassim.py
"""
import json

from design_pdf import (CSS, GRIS, INK, LIGNE, ORANGE, VERT, YR, bar_chart,
                        fibre_chart, fr, moteurs_chart, pct, rendre)

D = json.load(open('pdf_data.json', encoding='utf8'))
C, A, O = D['cons'], D['amb'], D['opt']
E = D['ete']
S = D['sommaire']

TOT = 8


def foot(n, tot=TOT):
    return (f'<div class="foot"><span>LASCLAY · LECTURE OPTIMISTE · '
            f'CONFIDENTIEL</span><span>{n} / {tot}</span></div></div>')


HIST = [280000, 404000, 505000, 879000, D['revenu_total_fy26']]
HIST_LAB = ['2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026']
CROISS_LIGNE = (O['dtc'][3] / O['dtc'][0]) ** (1 / 3) - 1
CROISS_HIST = (HIST[4] / HIST[0]) ** (1 / 4) - 1

P = []

# ------------------------------------------------------------------ COUVERTURE
P.append(f"""<div class="page cover">
  <div class="mark">LASCLAY</div><div class="rule"></div>
  <div class="ctype">MÉMO · LECTURE OPTIMISTE</div>
  <h1>Le même modèle, lu sur sa trajectoire haute</h1>
  <div class="clede">Le chiffrier de Lasclay porte trois lectures, qu'une seule
    cellule bascule. Ce document est la troisième : celle qui reprend la
    trajectoire annoncée en juillet 2026, mais construite avec les deux moteurs
    de l'entreprise au lieu d'un seul, et vérifiée ligne à ligne contre
    QuickBooks.</div>

  <div class="ctiles">
    <div class="tile"><div class="v">{fr(O['ventes'][3] / 1e6, 2, '')} M$</div>
      <div class="n">Ventes nettes visées en 2028-2029</div></div>
    <div class="tile"><div class="v">{fr(O['pai'][3] / 1000, 0, '')} k$</div>
      <div class="n">Bénéfice avant impôts, même exercice</div></div>
    <div class="tile"><div class="v">{pct(CROISS_LIGNE, 0)}</div>
      <div class="n">Croissance du commerce en ligne, par an</div></div>
    <div class="tile"><div class="v">{O['pdv'][3]:,.0f}</div>
      <div class="n">Points de vente au détail au 31 août 2029</div></div>
  </div>
  <div class="cfoot">LES PRODUITS LASCLAY INC. &nbsp;·&nbsp; QUÉBEC (LIMOILOU)
    &nbsp;·&nbsp; AOÛT 2026<br>Document confidentiel préparé pour Wassim
    Gharmoul. Exercice financier du 1<sup>er</sup> septembre au 31 août.</div>
</div>""")

# ------------------------------------------------------------------ 01
P.append(f"""<div class="page">
  <div class="kicker">La matière</div>
  <div class="sect"><span class="num">01</span><h2>Une fibre que personne n'avait
    réussi à commercialiser</h2></div>
  <div class="lede">L'asclépiade se vend au prix du duvet pour une performance
    supérieure. Ce n'est pas la demande qui a manqué pendant dix ans, c'est la
    capacité de récolter et de transformer.</div>

  {fibre_chart()}
  <div class="fig">Prix indicatif au kilo des principaux isolants textiles,
    échelle logarithmique. La fibre est creuse et vide à 80 % : isolante, légère,
    hydrophobe, antibactérienne. 20 % plus chaude que le duvet d'oie à poids
    égal selon l'Université de Sherbrooke ; trois fois plus isolante que le
    polyester selon le Groupe CTT.</div>

  <div class="two">
    <div class="card"><h4>Ce qui bloquait</h4>
      <p style="font-size:8.5pt;margin:0">Une fenêtre de récolte de deux
      semaines, qu'aucune grande exploitation n'arrive à tenir. La Garde côtière,
      Postes Canada, les Forces armées, Quartz co. : chaque fois que la matière
      est mise en marché, elle trouve preneur — et chaque fois la filière casse
      faute d'approvisionnement.</p></div>
    <div class="card"><h4>Ce que Lasclay tient</h4>
      <p style="font-size:8.5pt;margin:0">Du follicule au colis livré : la soie
      brute achetée aux cultivateurs, l'isolant fabriqué, les produits conçus, la
      marque, la vente en ligne, le service. Personne d'autre dans cette filière
      ne couvre cette amplitude — c'est ce qui permet d'agir aux intersections au
      lieu d'attendre que le maillon voisin se débloque.</p></div>
  </div>

  <h3>Ce qui ne change jamais</h3>
  <p>La culture et la transformation de la soie restent <strong>100 % au
  Québec</strong>. Le virage manufacturier déplace l'assemblage, pas la
  matière ni le savoir-faire. C'est le cœur de la mission et l'avantage que
  personne ne peut copier.</p>
  {foot(1)}""")

# ------------------------------------------------------------------ 02
P.append(f"""<div class="page">
  <div class="kicker">La preuve</div>
  <div class="sect"><span class="num">02</span><h2>Six ans de ventes, et une
    demande testée trois fois</h2></div>
  <div class="lede">En 2020, une publication devient virale. Six ans plus tard,
    70 000 clients et 3 M$ cumulés. Ce sont des contraintes techniques, et non le
    marché, qui ont limité la suite.</div>

  {bar_chart([('Revenu', HIST, VERT)], HIST_LAB, height=160,
             fmt=lambda v: fr(v / 1000, 0, ' k$'))}
  <div class="fig">Revenu par exercice, après escomptes et transport de vente
    compris. 2021-2022 selon les registres internes ; 2022-2023 à 2024-2025 selon
    les états financiers compilés ; 2025-2026 selon QuickBooks pour onze mois,
    août 2026 projeté. Croissance composée sur quatre ans :
    <strong>{pct(CROISS_HIST, 1)} par année</strong>.</div>

  <div class="three">
    <div class="card"><h4>2020, le départ</h4>
      <p style="font-size:8.4pt;margin:0">Une publication virale avant qu'un
      produit existe. 10 000 inscriptions à l'infolettre en deux semaines,
      1 000 paires de mitaines vendues en prévente. Ni usine, ni stock, ni
      procédé.</p></div>
    <div class="card"><h4>Nov.-déc. 2025, le sommet</h4>
      <p style="font-size:8.4pt;margin:0">Plus de 500 000 $ en deux mois, soit
      l'équivalent d'un exercice complet deux ans plus tôt. Le seul mois de
      décembre a fait 275 271 $.</p></div>
    <div class="card o"><h4>Mai 2026, l'épreuve du feu</h4>
      <p style="font-size:8.4pt;margin:0">Une vidéo de quarante minutes annonce
      la fin du « fabriqué ici ». La prévente suit trois jours plus tard :
      82 692 $, 508 commandes, <strong>85,2 % de clients existants</strong>, un
      panier supérieur de 58 % à la moyenne.</p></div>
  </div>

  <p style="margin-top:8px">Ce dernier point compte plus que les deux autres pour
  toi. Le risque qu'un virage manufacturier fasse fuir une communauté bâtie sur
  le « fabriqué au Québec » a été testé grandeur nature, en pleine transparence,
  avant que le virage ne soit fait. <strong>La communauté a jugé, et elle a
  acheté.</strong></p>
  {foot(2)}""")

# ------------------------------------------------------------------ 03
P.append(f"""<div class="page">
  <div class="kicker">Le virage</div>
  <div class="sect"><span class="num">03</span><h2>L'été qu'on a choisi de ne pas
    faire</h2></div>
  <div class="lede">L'activité de l'été 2026 n'a pas été subie, elle a été
    arrêtée. Servir la saison chaude demandait de produire au Québec, et le
    Québec avait déjà démontré qu'il ne payait pas.</div>

  <table>
    <tr><th></th><th>Juin 2025</th><th>Juillet 2025</th><th>Les deux mois</th></tr>
    <tr><td>Ventes nettes</td><td>{fr(E['juin25']['ventes'])}</td>
      <td>{fr(E['juillet25']['ventes'])}</td>
      <td>{fr(E['juin25']['ventes'] + E['juillet25']['ventes'])}</td></tr>
    <tr><td>Contribution marginale</td>
      <td>{fr(E['juin25']['contrib'])} ({pct(E['juin25']['contrib'] / E['juin25']['ventes'], 0)})</td>
      <td>{fr(E['juillet25']['contrib'])} ({pct(E['juillet25']['contrib'] / E['juillet25']['ventes'], 0)})</td>
      <td>{fr(E['juin25']['contrib'] + E['juillet25']['contrib'])}</td></tr>
    <tr><td>Frais généraux</td><td>{fr(E['juin25']['fg'])}</td>
      <td>{fr(E['juillet25']['fg'])}</td>
      <td>{fr(E['juin25']['fg'] + E['juillet25']['fg'])}</td></tr>
    <tr class="hi"><td>Reste, avant vente, marketing et administration</td>
      <td class="neg">{fr(E['juin25']['reste'])}</td>
      <td>{fr(E['juillet25']['reste'])}</td>
      <td class="neg">{fr(E['juin25']['reste'] + E['juillet25']['reste'])}</td></tr>
    <caption>Novembre et décembre de la même année dégagent
      {pct(E['nov25_pct'], 0)} et {pct(E['dec25_pct'], 0)} de contribution
      marginale. L'été en dégage {pct(E['juin25']['contrib'] / E['juin25']['ventes'], 0)}
      et {pct(E['juillet25']['contrib'] / E['juillet25']['ventes'], 0)}, et c'est
      là que la main-d'œuvre de production atteint son sommet de l'année.
      Source : QuickBooks.</caption>
  </table>

  <h3>Ce que la décision laisse dans les livres</h3>
  <table>
    <tr><th>Mai à juillet</th><th>2025</th><th>2026</th><th></th></tr>
    <tr><td>Main-d'œuvre de production</td><td>{fr(E['mod'][0])}</td>
      <td>{fr(E['mod'][1])}</td>
      <td class="neg">{pct(E['mod'][1] / E['mod'][0] - 1, 0)}</td></tr>
    <tr><td>Publicité numérique</td><td>{fr(E['pub'][0])}</td>
      <td>{fr(E['pub'][1])}</td>
      <td class="neg">{pct(E['pub'][1] / E['pub'][0] - 1, 0)}</td></tr>
    <tr class="hi"><td>Achats de matières premières</td><td>{fr(E['mp'][0])}</td>
      <td>{fr(E['mp'][1])}</td>
      <td>+{pct(E['mp'][1] / E['mp'][0] - 1, 0)}</td></tr>
    <caption>Une entreprise à court d'argent coupe ses achats. Les nôtres montent
      de {pct(E['mp'][1] / E['mp'][0] - 1, 0)} pendant que la main-d'œuvre tombe
      de {pct(1 - E['mod'][1] / E['mod'][0], 0)} : c'est du stock constitué
      d'avance, pour un assemblage fait ailleurs.</caption>
  </table>

  <p><strong>La publicité suit la production, pas l'inverse.</strong> On n'achète
  pas de la demande qu'on ne pourrait servir qu'à perte. Le budget baisse dès
  avril, quand la décision est prise, et tombe à zéro en juillet.</p>
  {foot(3)}""")

# ------------------------------------------------------------------ 04
P.append(f"""<div class="page">
  <div class="kicker">Ce que le virage libère</div>
  <div class="sect"><span class="num">04</span><h2>Une croissance qui coûtait de
    l'argent devient une croissance qui en génère</h2></div>
  <div class="lede">Le changement n'est pas une coupe, c'est un changement de
    nature : le coût de production passe de fixe à variable.</div>

  <div class="two">
    <div class="card"><h4>Main-d'œuvre de production</h4>
      <p class="big">{fr(D['mod_production']['avant'] - D['mod_production']['apres'])}</p>
      <p style="font-size:8.5pt;color:{GRIS};margin:0">L'isolant devient un
      produit industriel en rouleau :
      {fr(D['mod_production']['apres'])} de main-d'œuvre pour couvrir une année
      entière, contre {fr(D['mod_production']['avant'])} en 2025-2026. Le procédé
      artisanal demandait sept à huit personnes en haute saison.</p></div>
    <div class="card"><h4>Loyer, par la sous-location</h4>
      <p class="big">{fr(D['loyer'][0] - D['loyer'][1])}</p>
      <p style="font-size:8.5pt;color:{GRIS};margin:0">De {fr(D['loyer'][0])} à
      {fr(D['loyer'][1])} dès 2026-2027, puis {fr(D['loyer'][3])} en 2028-2029
      une fois les 3 200 pi² conservés libérés.</p></div>
  </div>

  <p style="margin-top:7px"><strong>{fr(D['mod_production']['avant'] - D['mod_production']['apres'] + D['loyer'][0] - D['loyer'][1])}
  de structure fixe libérés chaque année</strong>, dès 2026-2027, sans compter
  les {fr(52129)} d'infrastructure numérique qui ne sont pas dans les
  projections.</p>

  <h3>Ce qui monte, et pourquoi c'est une bonne nouvelle</h3>
  <p>La sous-traitance d'assemblage, elle, augmente : elle suit le volume au lieu
  d'être portée à l'année. C'est exactement le but. Une usine qui facture à la
  pièce ne coûte rien quand on ne vend pas, et ne plafonne pas quand on vend
  beaucoup — alors qu'un atelier québécois coûtait toute l'année et plafonnait à
  sa capacité.</p>

  <div class="two">
    <div class="card"><h4>Marge brute</h4>
      <p style="font-size:8.5pt;margin:0">De
      <strong>{pct(O['brute'][0] / O['ventes'][0], 1)}</strong> en 2025-2026 à
      <strong>{pct(O['brute'][3] / O['ventes'][3], 1)}</strong> en 2028-2029 sur
      la lecture optimiste. Le produit coûte moins cher à fabriquer et la structure qui le
      portait a disparu.</p></div>
    <div class="card"><h4>Qualité et portes ouvertes</h4>
      <p style="font-size:8.5pt;margin:0">Une qualité d'usine constante ouvre le
      détail, qui était fermé à un produit artisanal. C'est le second moteur de
      la trajectoire, et il n'existait pas avant le virage.</p></div>
  </div>
  {foot(4)}""")

# ------------------------------------------------------------------ 05
P.append(f"""<div class="page">
  <div class="kicker">Les deux moteurs</div>
  <div class="sect"><span class="num">05</span><h2>Le plus gros existe déjà</h2></div>
  <div class="lede">Le commerce en ligne a porté seul les six premières années.
    Le canal détail part de un point de vente et se construit ville par ville.</div>

  {moteurs_chart(YR, O['dtc'], O['detail'])}
  <div class="fig">Lecture optimiste, ventes nettes par moteur. Le commerce en
    ligne passe de {fr(O['dtc'][0])} à {fr(O['dtc'][3])}, soit
    {pct(CROISS_LIGNE, 1)} par année — le rythme même qu'il a tenu de 2021-2022 à
    2025-2026 ({pct(CROISS_HIST, 1)}). Le canal détail se construit à partir de
    zéro.</div>

  <div class="two">
    <div class="card"><h4>Le commerce en ligne ne demande rien de neuf</h4>
      <p style="font-size:8.5pt;margin:0">Pas de nouveau marché, pas de nouveau
      canal, pas de nouvelle compétence. Le même moteur, débridé par une
      production qui suit enfin la demande. C'est pour ça que la trajectoire ne
      repose pas sur un pari : elle repose sur un rythme déjà tenu cinq années de
      suite.</p></div>
    <div class="card"><h4>Le détail est vérifiable ville par ville</h4>
      <p style="font-size:8.5pt;margin:0">Quarante villes nommées,
      {D['detail']['nb_points']} points de vente possibles, un registre bâti sur
      les rapports de consignation réels des Défricheuses et les ventes en ligne
      par ville de facturation. {O['pdv'][3]:,.0f} points ouverts au 31 août 2029
      dans cette lecture, sur un plafond de
      {fr(D['detail']['plafond'])}.</p></div>
  </div>

  <p style="margin-top:7px">Le canal détail porte
  <strong>{pct(O['detail'][3] / O['ventes'][3], 0)}</strong> des ventes de
  2028-2029. C'est le risque principal du plan — un canal qui compte un seul
  point de vente aujourd'hui — et c'est aussi ce qui rend la trajectoire moins
  fragile : elle ne repose pas sur un seul moteur.</p>
  {foot(5)}""")

# ------------------------------------------------------------------ 06
P.append(f"""<div class="page">
  <div class="kicker">La trajectoire</div>
  <div class="sect"><span class="num">06</span><h2>Trois lectures du même
    modèle</h2></div>
  <div class="lede">Une seule cellule les bascule. Elles partagent le même réel,
    la même structure de coûts et le même canal détail ; elles diffèrent par le
    rythme du commerce en ligne et la vitesse du déploiement.</div>

  <table>
    <tr><th>2028-2029</th><th>Prudente</th><th>Ambitieuse</th><th>Optimiste</th></tr>
    <tr class="hi"><td>Ventes nettes</td><td>{fr(C['ventes'][3])}</td>
      <td>{fr(A['ventes'][3])}</td><td>{fr(O['ventes'][3])}</td></tr>
    <tr><td style="padding-left:14px">dont commerce en ligne</td>
      <td>{fr(C['dtc'][3])}</td><td>{fr(A['dtc'][3])}</td>
      <td>{fr(O['dtc'][3])}</td></tr>
    <tr><td style="padding-left:14px">dont canal détail</td>
      <td>{fr(C['detail'][3])}</td><td>{fr(A['detail'][3])}</td>
      <td>{fr(O['detail'][3])}</td></tr>
    <tr><td>Croissance du commerce en ligne, par an</td>
      <td>{pct((C['dtc'][3] / C['dtc'][0]) ** (1 / 3) - 1, 1)}</td>
      <td>{pct((A['dtc'][3] / A['dtc'][0]) ** (1 / 3) - 1, 1)}</td>
      <td>{pct(CROISS_LIGNE, 1)}</td></tr>
    <tr><td>Points de vente au 31 août 2029</td>
      <td>{C['pdv'][3]:,.0f}</td><td>{A['pdv'][3]:,.0f}</td>
      <td>{O['pdv'][3]:,.0f}</td></tr>
    <tr><td>EBITDA</td><td>{fr(C['ebitda'][3])}</td><td>{fr(A['ebitda'][3])}</td>
      <td>{fr(O['ebitda'][3])}</td></tr>
    <tr class="hi"><td>Bénéfice avant impôts</td><td>{fr(C['pai'][3])}</td>
      <td>{fr(A['pai'][3])}</td><td>{fr(O['pai'][3])}</td></tr>
    <tr><td>Bénéfice hors aides publiques</td><td>{fr(C['hors'][3])}</td>
      <td>{fr(A['hors'][3])}</td><td>{fr(O['hors'][3])}</td></tr>
    <caption>Le rythme historique du commerce en ligne est de
      {pct(CROISS_HIST, 1)} par année. La lecture prudente le divise par deux ;
      l'optimiste le reconduit tel quel.</caption>
  </table>

  <h3>La lecture optimiste, exercice par exercice</h3>
  <table>
    <tr><th>Exercice clos le 31 août</th><th>2025-2026</th><th>2026-2027</th>
      <th>2027-2028</th><th>2028-2029</th></tr>
    <tr class="hi"><td>Ventes nettes</td>
      {''.join(f'<td>{fr(v)}</td>' for v in O['ventes'])}</tr>
    <tr><td>EBITDA</td>{''.join(f'<td>{fr(v)}</td>' for v in O['ebitda'])}</tr>
    <tr><td>Bénéfice avant impôts</td>
      {''.join(f'<td>{fr(v)}</td>' for v in O['pai'])}</tr>
    <tr><td>Capitaux propres au 31 août</td>
      {''.join(f'<td>{fr(v)}</td>' for v in O['equity'])}</tr>
    <caption>Onze mois de 2025-2026 sont du réel, collés depuis QuickBooks compte
      par compte ; seul août 2026 est projeté.</caption>
  </table>
  {foot(6)}""")

# ------------------------------------------------------------------ 07
P.append(f"""<div class="page">
  <div class="kicker">Ce qui n'est pas dedans</div>
  <div class="sect"><span class="num">07</span><h2>L'Europe, et les autres marchés
    hors chiffres</h2></div>
  <div class="lede">Trois marchés se négocient sur des cycles trop longs pour
    être inscrits dans un plan de trois ans. Aucun n'apporte un dollar aux
    tableaux qui précèdent.</div>

  <div class="three">
    <div class="card o"><h4>L'Europe, ta place</h4>
      <p style="font-size:8.4pt;margin:0">La France en premier. Aucun revenu
      européen n'est budgété. Ce que tu ouvres est <strong>en plus</strong> de la
      trajectoire, pas dedans.</p></div>
    <div class="card"><h4>L'international par la membrane</h4>
      <p style="font-size:8.4pt;margin:0">Un isolant en rouleau standardisé entre
      dans n'importe quelle usine textile du monde. Des marques internationales
      s'y intéressent ; sans format normalisé, ces conversations ne peuvent pas
      aboutir.</p></div>
    <div class="card"><h4>L'institutionnel et la Défense</h4>
      <p style="font-size:8.4pt;margin:0">La membrane est déjà dans les uniformes
      de la Garde côtière et de Postes Canada. Les Forces armées ont testé
      l'asclépiade en Arctique. Marchés considérables, aujourd'hui inaccessibles
      seul.</p></div>
  </div>

  <h3>Ce que le modèle ne suppose pas</h3>
  <ul>
    <li>Aucun revenu européen, ni dans cette lecture ni dans les deux autres</li>
    <li>Aucune subvention non demandée : le PARI-CNRC (75 000 $) et la bourse
      Vision Topping sont exclus</li>
    <li>Aucune économie d'infrastructure numérique, alors que {fr(52129)} sont sur
      la table</li>
    <li>Aucun dividende pendant le terme des prêts</li>
    <li>Aucune amélioration du rendement publicitaire : la publicité reste à
      22 %, 20,5 % puis 19,5 % du revenu brut du commerce en ligne</li>
  </ul>

  <h3>Facteurs de risque</h3>
  <div class="two">
    <div class="card o"><h4>Exécution du virage et du déploiement</h4>
      <p style="font-size:8.5pt;margin:0">Transférer l'assemblage sans accroc sur
      la qualité et les délais crée une dépendance logistique, un risque de
      change et de douanes. Et {pct(O['detail'][3] / O['ventes'][3], 0)} des
      ventes de 2028-2029 reposent sur un canal qui compte un seul point de vente
      aujourd'hui.</p></div>
    <div class="card o"><h4>La dette de transition</h4>
      <p style="font-size:8.5pt;margin:0">L'entreprise porte de la dette pendant
      la transition — {fr(S['capital_marchand'])} de capital marchand à
      refinancer au 31 août 2026 — et cherche en parallèle un financement
      institutionnel pour la restructurer. Les capitaux propres sont négatifs de
      {fr(O['equity'][0])} au départ.</p></div>
  </div>
  {foot(7)}""")

# ------------------------------------------------------------------ 08
P.append(f"""<div class="page">
  <div class="kicker">Méthode</div>
  <div class="sect"><span class="num">08</span><h2>D'où viennent ces chiffres</h2></div>
  <div class="lede">Une projection ne vaut que par la rigueur de son suivi.</div>

  <h3>Ancrage comptable</h3>
  <p>Le modèle est un chiffrier mensuel de 48 mois, de septembre 2025 à août
  2029. Chaque compte du grand livre QuickBooks est apparié à une ligne du modèle
  par son numéro de compte. <strong>Onze mois de 2025-2026 sont du réel</strong>,
  bilan comme état des résultats, collés directement depuis QuickBooks :
  septembre 2025 à juillet 2026. Seul août 2026 reste projeté. Le résultat avant
  impôts de juillet tombe au cent près sur celui de QuickBooks.</p>

  <h3>Les trois lectures</h3>
  <p>Elles vivent dans le <strong>même fichier</strong> et se basculent par une
  seule cellule. Elles partagent le réel, la structure de coûts, le plan
  d'embauche et le canal détail. La lecture optimiste reprend les facteurs de
  croissance de l'ambitieuse relevés d'un même écart, résolu pour que les ventes
  nettes de 2028-2029 retrouvent la trajectoire annoncée en juillet 2026.
  <strong>L'optimisme porte sur le volume, pas sur la structure de coûts.</strong></p>

  <h3>Ce que la révision a corrigé</h3>
  <ul>
    <li>Les 76 produits ont été recalés sur les <strong>unités réellement
      vendues</strong> chez Shopify</li>
    <li>Le canal détail a été reconstruit ville par ville sur les rapports de
      consignation et les ventes en ligne par ville de facturation</li>
    <li>Les coûts variables ont été rebranchés sur le volume, et la structure de
      coûts calibrée sur les trois derniers exercices réalisés</li>
    <li>Une seule chaîne de trésorerie sur 48 mois remplace les états parallèles
      qui divergeaient. <strong>La ligne de contrôle du bilan est à zéro sur les
      48 mois, dans les trois lectures</strong></li>
    <li>Le modèle porte un journal d'audit : ce qui a été corrigé, et ce qui reste
      à valider. Il est ouvert, et je te l'ouvre quand tu veux</li>
  </ul>

  <h3>Sources</h3>
  <p style="font-size:8pt;line-height:1.3;color:{GRIS}">États financiers compilés
  2022-2023 à 2024-2025 (mission de compilation, sans audit ni examen) ·
  QuickBooks Online pour le réel 2025-2026 · Shopify pour les ventes, commandes,
  clients, sessions et ventes par ville de facturation · rapports de consignation
  mensuels de Les Défricheuses · Statistique Canada, recensement de 2021 ·
  Groupe CTT pour les essais d'isolation · Chaire de recherche industrielle sur
  les matériaux innovants en composites de l'Université de Sherbrooke.</p>

  <div class="fine">
    <p><strong>Les projections de ce document sont des estimés.</strong> Elles
    proviennent de la lecture optimiste du modèle financier interne de la
    direction et reposent sur des hypothèses documentées qui peuvent ne pas se
    réaliser. Elles ne constituent ni une garantie, ni une offre, ni une
    sollicitation. Document confidentiel préparé pour Wassim Gharmoul.</p>
  </div>
  {foot(8)}""")

STYLE = CSS.replace('</style>', f"""
.three {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 9px;
  margin-top: 8px; }}
.big {{ font-family: 'Bitstream Charter',Georgia,serif; font-size: 19pt;
  color: {VERT}; margin: 2px 0 4px; }}
.card.o .big {{ color: {ORANGE}; }}
.fine {{ margin-top: 10px; padding-top: 7px; border-top: 1px solid {LIGNE};
  font-size: 7.4pt; line-height: 1.42; color: {GRIS}; }}
.fine p {{ margin: 0 0 5px; }}
.fine strong {{ color: {INK}; }}
</style>""")

if __name__ == '__main__':
    import design_pdf
    design_pdf.CSS = STYLE
    taille = rendre(P, 'Lasclay · Mémo · lecture optimiste · confidentiel',
                    'Lasclay - Memo lecture optimiste (Wassim) - aout 2026.pdf',
                    'memo_wassim.html')
    print(f'PDF produit {taille:,} octets')
