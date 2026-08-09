#!/usr/bin/env python3
"""La proposition de partenariat à Wassim Gharmoul, version d'août 2026.

Cinq choses changent par rapport à la version de juillet, et elles vont toutes
dans le sens de la simplicité :

1. la part de profit se calcule sur **Lasclay au complet**, plus seulement sur
   la production tunisienne — il n'y a plus de périmètre à définir ni à auditer ;
2. les fonds sont déposés **en dollars canadiens** au compte de Lasclay ;
3. l'apport est **fixé à 100 000 $**, la part reste 30 %, le plafond descend de
   600 000 $ à **500 000 $** ;
4. les petits caractères disent ce que c'est : du **capital de risque**, des
   montants de profit **estimés**, un plafond **fixe** ;
5. une **option de renouvellement** : redéposer 100 000 $ pour conserver les
   30 % jusqu'au terme et relever le plafond de 200 000 $.

Tous les chiffres viennent du scénario optimiste du classeur audité, celui que
`Inputs!C70 = 3` active. Aucun n'est saisi ici : ils sortent de `pdf_data.json`,
comme ceux du mémo des prêteurs. Les deux documents ne peuvent donc pas
diverger.

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


def quotes_parts(plafond):
    """La part de 30 %, exercice par exercice, arrêtée au plafond."""
    out, cum = [], 0.0
    for i in range(3):
        brut = PART * O['pai'][i + 1]
        verse = min(brut, max(0.0, plafond - cum))
        cum += verse
        out.append({'pai': O['pai'][i + 1], 'brut': brut, 'verse': verse,
                    'cum': cum})
    return out


SANS = quotes_parts(PLAFOND)
AVEC = quotes_parts(PLAFOND_RENOUV)
# À quel moment de 2028-2029 le plafond de 500 000 $ est atteint.
RESTE = PLAFOND - SANS[1]['cum']
PART_AN3 = RESTE / (PART * O['pai'][3])
MULTIPLE = f"{quotes_parts(PLAFOND_RENOUV)[2]['cum'] / (2 * APPORT):.1f}".replace('.', ',')


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
      <div class="n">Du bénéfice de Lasclay au complet</div></div>
    <div class="tile"><div class="v">{fr(PLAFOND / 1000, 0, '')} k$</div>
      <div class="n">Plafond fixe, soit 5× ta mise</div></div>
    <div class="tile"><div class="v">1 an</div>
      <div class="n">Pour récupérer la mise</div></div>
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
    <tr class="hi"><td>Bénéfice avant impôts</td>
      {''.join(f'<td>{fr(v)}</td>' for v in O['pai'])}</tr>
    <tr><td>dont aides publiques comprises</td>
      {''.join(f'<td>{fr(v)}</td>' for v in O['aides'])}</tr>
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
  dedans — et c'est là que vit ton rendement de long terme, par la commission
  Europe, sans plafond.</p>

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
      <td style="text-align:left"><strong>{pct(PART, 0)} du bénéfice avant impôts
      de Lasclay au complet</strong> — plus seulement de la production
      tunisienne. Il n'y a donc plus de périmètre à définir, à isoler ni à
      auditer : c'est le résultat de l'entreprise, celui que le comptable
      produit.</td></tr>
    <tr><td>Le plafond</td>
      <td style="text-align:left"><strong>{fr(PLAFOND)} reçus au total</strong>,
      soit 5× ta mise. Le plafond est <strong>fixe</strong> ; c'est le rythme
      auquel on l'atteint qui dépend du profit réel.</td></tr>
    <tr><td>Le renouvellement</td>
      <td style="text-align:left">Quand le plafond est atteint, tu peux
      <strong>redéposer {fr(APPORT)}</strong> pour conserver tes {pct(PART, 0)}
      jusqu'au terme de l'entente et relever le plafond de
      <strong>{fr(200_000)}</strong>, à {fr(PLAFOND_RENOUV)}. À ta seule
      discrétion.</td></tr>
    <tr><td>Ton rôle</td>
      <td style="text-align:left">Ouvrir la <strong>France</strong> et l'Europe.
      En plus de ta part de profit : une <strong>commission de {pct(PART, 0)} sur
      les ventes européennes réalisées par ton démarchage</strong>, sans plafond,
      et hors du plafond ci-dessus.</td></tr>
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
    f'<tr><td>{an}</td><td>{fr(s["pai"])}</td><td>{fr(s["brut"])}</td>'
    f'<td>{fr(s["verse"])}</td><td>{fr(s["cum"])}</td></tr>'
    for an, s in zip(ANS, SANS))
lignes_r = ''.join(
    f'<tr><td>{an}</td><td>{fr(s["brut"])}</td><td>{fr(s["cum"])}</td></tr>'
    for an, s in zip(ANS, AVEC))

P.append(f"""<div class="page">
  <div class="kicker">Le rendement</div>
  <div class="sect"><span class="num">05</span><h2>Ce que ça peut te
    rapporter</h2></div>
  <div class="lede">Ta part suit le bénéfice réel de Lasclay. Voici le chemin sur
    le scénario optimiste du modèle — celui de la page 2.</div>

  <table>
    <tr><th>Exercice</th><th>Bénéfice avant impôts</th><th>Ta part, {pct(PART, 0)}</th>
      <th>Versé</th><th>Cumulé</th></tr>
    {lignes}
    <caption>Le plafond de {fr(PLAFOND)} est atteint à environ
      {pct(PART_AN3, 0)} de l'exercice 2028-2029, soit un peu moins de
      <strong>deux ans et demi</strong> après l'apport. La première année,
      {fr(SANS[0]['verse'])}, {'rend déjà ta mise en entier'
       if SANS[0]['verse'] >= APPORT
       else f"récupère déjà {pct(SANS[0]['verse'] / APPORT, 0)} de ta mise"}.</caption>
  </table>

  <div class="two">
    <div class="card"><h4>Sans renouvellement</h4>
      <p class="big">{fr(PLAFOND)}</p>
      <p style="font-size:8.5pt;color:{GRIS};margin:0">5× la mise, atteint en
      cours de 2028-2029. Ta part cesse ensuite ; la commission Europe, elle,
      continue.</p></div>
    <div class="card o"><h4>Avec renouvellement</h4>
      <p class="big">{fr(AVEC[2]['cum'])}</p>
      <p style="font-size:8.5pt;color:{GRIS};margin:0">Sur {fr(2 * APPORT)}
      engagés au total, soit {MULTIPLE}× la mise. Le
      plafond relevé à {fr(PLAFOND_RENOUV)} n'est pas atteint dans l'horizon du
      modèle : ce que tu reçois est le profit lui-même, pas le plafond.</p></div>
  </div>

  <h3>L'option de renouvellement, en clair</h3>
  <p>Au moment où le plafond de {fr(PLAFOND)} est atteint, tu peux redéposer
  {fr(APPORT)}. Tes {pct(PART, 0)} continuent de courir jusqu'au terme de
  l'entente, et le plafond total passe à {fr(PLAFOND_RENOUV)}. Tu décides à ce
  moment-là, avec deux exercices de résultats réels sous les yeux — pas
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
      d'ici est la plus haute. La lecture prudente donne
      {fr(D['cons']['pai'][3])} de bénéfice en 2028-2029 au lieu de
      {fr(O['pai'][3])} : ta part y serait plus lente, le plafond plus long à
      atteindre.</p></div>
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
    projections font varier, c'est le délai pour l'atteindre, pas son montant.
    La commission sur les ventes européennes issues du démarchage du partenaire
    est distincte de la part de profit et n'est pas plafonnée.</p>
    <p>La part de profit se calcule sur le <strong>bénéfice avant impôts</strong>
    de Les Produits Lasclay inc., tel qu'établi par ses états financiers. La
    définition exacte, la fréquence des versements, le terme de l'entente et la
    formule de rachat seront arrêtés dans la convention écrite.</p>
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
    print(f'  plafond atteint à {PART_AN3:.0%} de 2028-2029')
    print(f'  sans renouvellement {SANS[2]["cum"]:,.0f} $ ; '
          f'avec {AVEC[2]["cum"]:,.0f} $ sur {2 * APPORT:,.0f} $')
