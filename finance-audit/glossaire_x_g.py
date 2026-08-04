# -*- coding: utf-8 -*-
"""Glossaire du chiffrier, partie G — Inputs, canal détail, taxes, bilan."""

IDENTIQUE = [
    'Inputs!D48', 'ACTIF', 'VILLE', 'PROVINCE', 'INDICE', 'Hors Québec',
    'Mirabel', 'Montréal', 'Laval', 'Longueuil', 'Terrebonne', 'Repentigny',
    'Châteauguay', 'Brossard', 'Drummondville', 'Toronto', 'Calgary', 'Ottawa',
    'Edmonton', 'Winnipeg', 'Mississauga', 'Vancouver', 'Brampton', 'Hamilton',
    'Surrey', 'Halifax', 'London', 'Markham', 'Vaughan', 'Saskatoon',
    'Kitchener', 'Burnaby', 'Windsor', 'Regina', 'Oakville',
    'Saint-Jean-sur-Richelieu', 'Saint-Jérôme', 'Gatineau', 'Saguenay',
    'Blainville', 'Granby', 'Sherbrooke', 'Lévis', 'Saint-Hyacinthe',
    'Trois-Rivières',
]

TRADUIT = {
    'Québec': 'Québec City',

    # ------------------------------------- Inputs, hypothèses d'exploitation
    "HYPOTHÈSES D'EXPLOITATION — montants annuels des postes fixes":
        'OPERATING ASSUMPTIONS — annual amounts for the fixed items',
    'Ligne du résultat': 'Income statement row',
    'Ces postes étaient tapés mois par mois dans les blocs de prévision : 360 cellules qu’un analyste ne pouvait pas inspecter. Ils sont maintenant ici, et les mois s’en déduisent.':
        'These items were typed month by month in the forecast blocks: 360 cells an analyst could not inspect. They now live here, and the months are derived from them.',
    'Carburant et immatriculation': 'Fuel and vehicle registration',
    'Abonnements logiciels (opérations)': 'Software subscriptions (operations)',
    'Sous-traitance marketing (agence, création)':
        'Marketing subcontracting (agency, creative)',
    'Licences logicielles marketing': 'Marketing software licences',
    'Assurance biens et responsabilité': 'Property and liability insurance',
    'Résultats l. 48': 'Income stmt row 48',
    'Résultats l. 50': 'Income stmt row 50',
    'Résultats l. 52': 'Income stmt row 52',
    'Résultats l. 56': 'Income stmt row 56',
    'Résultats l. 58': 'Income stmt row 58',
    'Résultats l. 73': 'Income stmt row 73',
    'Résultats l. 75': 'Income stmt row 75',
    'Résultats l. 82': 'Income stmt row 82',
    'Résultats l. 87': 'Income stmt row 87',
    'Résultats l. 95': 'Income stmt row 95',
    'Résultats l. 96': 'Income stmt row 96',
    'Résultats l. 97': 'Income stmt row 97',

    # ------------------------------------------------- avance de l'actionnaire
    'AVANCE DE L’ACTIONNAIRE — entente de juillet 2026':
        'SHAREHOLDER ADVANCE — July 2026 agreement',
    'Montant avancé par Gabriel (15 août 2026)':
        'Amount advanced by Gabriel (15 August 2026)',
    'Taux d’intérêt annuel': 'Annual interest rate',
    'Terme (mois, capital égal)': 'Term (months, equal principal)',
    'Remboursée de septembre 2026 à août 2027. Intérêt sur le solde décroissant ; demi-mois en août 2026, l’argent arrivant le 15. Un prêteur à terme exigera très probablement une convention de postposition : l’avance serait alors gelée et l’échéancier ci-dessous repoussé d’autant.':
        'Repaid from September 2026 to August 2027. Interest on the declining balance; half a month in August 2026, the money arriving on the 15th. A term lender will very likely require a subordination agreement: the advance would then be frozen and the schedule below deferred accordingly.',

    # ------------------------------------------------------------ canal détail
    'CANAL DÉTAIL — CONSIGNATION AU CANADA':
        'RETAIL CHANNEL — CONSIGNMENT ACROSS CANADA',
    'Points de vente ouverts au 31 août 2027': 'Points of sale open at 31 August 2027',
    'Points de vente ouverts au 31 août 2028': 'Points of sale open at 31 August 2028',
    'Points de vente ouverts au 31 août 2029': 'Points of sale open at 31 August 2029',
    'Vente au détail annuelle moyenne par point de vente ouvert (prix payé par le consommateur)':
        'Average annual retail sales per open point of sale (price paid by the consumer)',
    'Marge accordée au détaillant': 'Margin granted to the retailer',
    'Part du prix de détail encaissée par Lasclay':
        'Share of the retail price collected by Lasclay',
    'Transport et préparation de commandes vers les points de vente (% du revenu encaissé)':
        'Shipping and order preparation to points of sale (% of revenue collected)',
    'Commission de représentation et déplacements (% du revenu encaissé)':
        'Sales commission and travel (% of revenue collected)',
    'Présentoir et implantation, par point de vente ouvert ($)':
        'Display unit and set-up, per point of sale opened ($)',
    'Stock en consignation (mois de coût des marchandises chez les détaillants)':
        'Consignment inventory (months of cost of goods held at retailers)',
    'Coût des marchandises du canal, % du revenu encaissé (2026-2027 / 2027-2028 / 2028-2029)':
        'Channel cost of goods, % of revenue collected (2026-2027 / 2027-2028 / 2028-2029)',
    'Le produit coûte le même prix à fabriquer, qu’il se vende en ligne ou en magasin, mais Lasclay n’encaisse que 60 % du prix de détail : le coût des marchandises du canal est donc celui du web divisé par 0,60. En échange, le canal ne consomme aucune publicité — et la publicité coûte 22 % du revenu brut du web.':
        'The product costs the same to make whether it sells online or in store, but Lasclay collects only 60% of the retail price: the channel’s cost of goods is therefore the web figure divided by 0.60. In exchange, the channel consumes no advertising — and advertising costs 22% of gross web revenue.',
    'La consignation veut dire que Lasclay reste propriétaire du stock chez le détaillant jusqu’à la vente au consommateur. Ce stock est au bilan (inventaire de produits finis) et il consomme de la trésorerie : c’est le vrai coût d’entrée du canal, et il est chiffré rangée 132.':
        'Consignment means Lasclay retains ownership of the inventory at the retailer until it sells to the consumer. That inventory sits on the balance sheet (finished goods) and it consumes cash: it is the channel’s real cost of entry, quantified on row 132.',
    'Profil saisonnier du canal détail (part du détail annuel, sept. à août)':
        'Seasonal profile of the retail channel (share of annual retail, Sept. to Aug.)',
    "Profil observé chez Les Défricheuses en 2025-2026, avec un plancher de 2,5 % de mars à août : l'effondrement du printemps est une rupture de stock, pas une saison morte.":
        'Profile observed at Les Défricheuses in 2025-2026, with a 2.5% floor from March to August: the spring collapse is a stock-out, not a dead season.',
    "Coordination du canal détail — coût annuel chargé (2026-2027 / 2027-2028 / 2028-2029)":
        'Retail channel coordination — annual loaded cost (2026-2027 / 2027-2028 / 2028-2029)',
    "Aucune ressource en 2026-2027 : le réseau se gère depuis l'interne. Une demi-ressource en 2027-2028, une complète en 2028-2029. La consignation n'a ni facturation ni compte client ; il reste à cadencer les réapprovisionnements et les envois hebdomadaires aux points de ramassage.":
        'No resource in 2026-2027: the network is run in house. Half a resource in 2027-2028, a full one in 2028-2029. Consignment has no invoicing and no customer account; what remains is pacing restocks and the weekly shipments to pickup points.',
    'Revenu du canal détail encaissé par Lasclay — 2026-2027':
        'Retail channel revenue collected by Lasclay — 2026-2027',
    'Revenu du canal détail encaissé par Lasclay — 2027-2028':
        'Retail channel revenue collected by Lasclay — 2027-2028',
    'Revenu du canal détail encaissé par Lasclay — 2028-2029':
        'Retail channel revenue collected by Lasclay — 2028-2029',
    'Construit ville par ville dans « Détail par ville », à partir des rapports de consignation des Défricheuses et des ventes en ligne par ville chez Shopify.':
        'Built city by city in “Retail by city”, from the Les Défricheuses consignment reports and Shopify online sales by city.',

    # ------------------------------------------------------------------ taxes
    'TPS ANNUELLE ET TVQ MENSUELLE': 'ANNUAL GST AND MONTHLY QST',
    'TPS/TVH perçue chez Shopify, 1er sept. 2025 au 30 juil. 2026':
        'GST/HST collected in Shopify, 1 Sept. 2025 to 30 July 2026',
    "Part fédérale des taxes perçues, calculée région par région : TVH entièrement fédérale en Ontario et dans l'Atlantique, TPS seule en Alberta et dans les territoires, 5/14,975 au Québec, 5/12 en Colombie-Britannique et au Manitoba, 5/11 en Saskatchewan, rien aux États-Unis.":
        'Federal share of the tax collected, computed region by region: HST entirely federal in Ontario and Atlantic Canada, GST only in Alberta and the territories, 5/14.975 in Quebec, 5/12 in British Columbia and Manitoba, 5/11 in Saskatchewan, nothing in the United States.',
    'TPS perçue sur les factures QuickBooks, même période':
        'GST collected on QuickBooks invoices, same period',
    'TxnTaxDetail.TaxLine des factures, rapproché de la liste des TaxRate. Les mêmes factures portent 5 225,32 $ de TVQ.':
        'TxnTaxDetail.TaxLine from the invoices, matched against the TaxRate list. The same invoices carry $5,225.32 of QST.',
    'CTI sur les achats et les dépenses, même période':
        'Input tax credits on purchases and expenses, same period',
    "Mêmes lignes sur les Bill et les Purchase : 32 462,59 $ de « TPS (CTI) » et 5,91 $ de « TVH (CTI) ON ». Les mêmes pièces portent 59 896,40 $ de RTI.":
        'Same lines on Bills and Purchases: $32,462.59 of “GST (ITC)” and $5.91 of “HST (ITC) ON”. The same documents carry $59,896.40 of QST input credits.',
    'Août 2026, estimé : TPS perçue moins le CTI moyen':
        'August 2026, estimated: GST collected less the average input tax credit',
    "Le seul mois qui manque. Ses ventes projetées, 5 070 $, portent la TPS au taux observé ; son CTI suit la moyenne des onze mois, 2 952 $.":
        'The only month missing. Its projected sales, $5,070, carry GST at the observed rate; its input tax credit follows the eleven-month average, $2,952.',
    'TPS nette de 2025-2026, versée le 30 nov. 2026':
        'Net GST for 2025-2026, paid 30 Nov. 2026',
    "Onze mois réels et un mois estimé. Aucun ratio : c'est la somme des quatre lignes ci-dessus.":
        'Eleven actual months and one estimated month. No ratio: it is the sum of the four rows above.',
    'Paramètres de projection, calés sur le réel ci-dessus':
        'Projection parameters, calibrated on the actuals above',
    'Taux effectif de TPS/TVH perçue, % des ventes nettes':
        'Effective rate of GST/HST collected, % of net sales',
    "49 077 $ perçus sur 981 313 $ de ventes nettes. Au-dessus de 5 % parce que la taxe porte sur les ventes brutes et sur le transport, pas sur les ventes nettes.":
        '$49,077 collected on $981,313 of net sales. Above 5% because the tax applies to gross sales and to shipping, not to net sales.',
    'Taux effectif de TVQ perçue, % des ventes nettes':
        'Effective rate of QST collected, % of net sales',
    '82 284 $ perçus sur les mêmes ventes, Shopify et factures réunis.':
        '$82,284 collected on the same sales, Shopify and invoices combined.',
    'Taux de TPS': 'GST rate',
    'Taux de TVQ': 'QST rate',
    'Base de CTI hors couture, % des ventes nettes':
        'GST input base excluding sewing, % of net sales',
    "35 420 $ de CTI sur l'exercice supposent 708 404 $ d'achats taxés, dont 189 745 $ de sous-traitance de couture. Le reste, 518 659 $, fait 52,58 % des ventes nettes.":
        '$35,420 of input tax credits over the year implies $708,404 of taxed purchases, of which $189,745 is sewing subcontracting. The remainder, $518,659, is 52.58% of net sales.',
    'Base de RTI hors couture, % des ventes nettes':
        'QST input base excluding sewing, % of net sales',
    "65 342 $ de RTI supposent 655 053 $ d'achats taxés au Québec, soit 465 308 $ hors couture. Plus petite que la base de CTI : une partie des achats se fait hors du Québec.":
        '$65,342 of QST input credits implies $655,053 of purchases taxed in Quebec, that is $465,308 excluding sewing. Smaller than the GST base: part of the purchasing happens outside Quebec.',
    "Sous-traitance d'assemblage encore réalisée au Québec":
        'Assembly subcontracting still performed in Quebec',
    'TPS nette par exercice, payable le 30 novembre suivant':
        'Net GST by fiscal year, payable the following 30 November',
    '2024-2025 (versée le 30 novembre 2025)': '2024-2025 (paid 30 November 2025)',
    'Montant réellement versé, visible au mouvement du compte 2110 en novembre 2025.':
        'Amount actually paid, visible in the movement of account 2110 in November 2025.',
    '2025-2026 (versée le 30 novembre 2026)': '2025-2026 (paid 30 November 2026)',
    'Le réel, repris de la ligne ci-dessus.': 'The actual, taken from the row above.',
    '2026-2027 (versée le 30 novembre 2027)': '2026-2027 (paid 30 November 2027)',
    '2027-2028 (versée le 30 novembre 2028)': '2027-2028 (paid 30 November 2028)',
    '2028-2029 (versée le 30 novembre 2029)': '2028-2029 (paid 30 November 2029)',

    # ------------------------------------------------------- marge de crédit
    'MARGE DE CRÉDIT — limite et contrôle du tirage':
        'LINE OF CREDIT — limit and draw control',
    "Le tirage n'est pas bridé dans le modèle : plafonner le tirage cacherait le besoin au lieu de le montrer. Ces trois rangées le posent en clair.":
        'The draw is not capped in the model: capping it would hide the need instead of showing it. These rows state it plainly.',
    'Marge de crédit autorisée ($)': 'Line of credit authorised ($)',
    'Tirage le plus élevé des 48 mois ($)': 'Highest draw across the 48 months ($)',
    "Le sommet est octobre 2025, et c'est du réel : ce qui a été tiré, pas ce que le modèle projette.":
        'The peak is October 2025, and it is actual: what was drawn, not what the model projects.',
    'Tirage le plus élevé des mois projetés ($)':
        'Highest draw across the projected months ($)',
    'Septembre 2026 à août 2029.': 'September 2026 to August 2029.',
    'Dépassement de la limite autorisée ($)': 'Excess over the authorised limit ($)',
    'Doit rester à zéro.': 'Must stay at zero.',

    # --------------------------------------------------------- détail par ville
    'CANAL DÉTAIL — POTENTIEL PAR VILLE': 'RETAIL CHANNEL — POTENTIAL BY CITY',
    "Vingt plus grandes villes du Québec et vingt-cinq plus grandes du Canada, soit quarante villes distinctes. L'univers de déploiement est borné : il n'y a pas de quarante-et-unième point de vente dans ce modèle.":
        'The twenty largest cities in Quebec and the twenty-five largest in Canada, forty distinct cities in all. The rollout universe is bounded: there is no forty-first city in this model.',
    'RÉFÉRENCE — LES DÉFRICHEUSES, MONTRÉAL, 2025-2026':
        'BENCHMARK — LES DÉFRICHEUSES, MONTREAL, 2025-2026',
    'sept. 2025': 'Sep 2025', 'oct. 2025': 'Oct 2025', 'nov. 2025': 'Nov 2025',
    'déc. 2025': 'Dec 2025', 'janv. 2026': 'Jan 2026', 'févr. 2026': 'Feb 2026',
    'juill. 2026': 'Jul 2026', 'août 2026': 'Aug 2026',
    'Encaissé par Lasclay, 2025-2026': 'Collected by Lasclay, 2025-2026',
    'Prix payé par le consommateur (Lasclay encaisse 60 %)':
        'Price paid by the consumer (Lasclay collects 60%)',
    "Calibre d'un point de vente majeur — conservateur":
        'Calibration of a major point of sale — conservative',
    "Calibre d'un point de vente majeur — ambitieux":
        'Calibration of a major point of sale — ambitious',
    'Calibre retenu par le scénario actif': 'Calibration used by the active scenario',
    "Combien de fois Les Défricheuses. La gamme y est passée de 18 à 40 lignes en cours d'année, la tablette n'a pas été réapprovisionnée après février, et le point de vente n'avait ni présentoir, ni chargé de comptes, ni poussée saisonnière. Le scénario ambitieux suppose en plus des détaillants d'un autre calibre, que l'isolant en rouleau rend accessibles.":
        'How many times Les Défricheuses. Its range went from 18 to 40 lines during the year, the shelf was not restocked after February, and the point of sale had no display unit, no account manager and no seasonal push. The ambitious scenario further assumes retailers of a different calibre, which roll insulation makes reachable.',
    "Revenu annuel d'un point de vente majeur à Montréal":
        'Annual revenue of a major point of sale in Montreal',
    'Facteur hors Québec': 'Outside-Quebec factor',
    "Hors Québec, les ventes en ligne valent 8,3 % du chiffre canadien pour 77 % de la population : elles mesurent l'absence de marketing et non l'absence de potentiel. L'indice s'y prend donc sur la taille du marché, escomptée de ce facteur.":
        'Outside Quebec, online sales are 8.3% of the Canadian total for 77% of the population: they measure the absence of marketing, not the absence of potential. The index is therefore taken on market size instead, discounted by this factor.',
    'POPULATION (2021)': 'POPULATION (2021)',
    'VENTES EN LIGNE 2025-2026': 'ONLINE SALES 2025-2026',
    'PAR HABITANT': 'PER CAPITA',
    "INDICE D'AFFINITÉ": 'AFFINITY INDEX',
    'POINTS DE VENTE POSSIBLES': 'POSSIBLE POINTS OF SALE',
    'REVENU DU 1er POINT DE VENTE': 'REVENUE OF THE 1ST POINT OF SALE',
    'POTENTIEL TOTAL DE LA VILLE': 'TOTAL CITY POTENTIAL',
    'TOTAL — 40 villes': 'TOTAL — 40 cities',
    "REGISTRE DES POINTS DE VENTE, EN ORDRE D'OUVERTURE":
        'REGISTER OF POINTS OF SALE, IN OPENING ORDER',
    'RANG DANS LA VILLE': 'RANK WITHIN THE CITY',
    'REVENU ANNUEL': 'ANNUAL REVENUE',
    'OUVERTURE — CONSERVATEUR': 'OPENING — CONSERVATIVE',
    'OUVERTURE — AMBITIEUX': 'OPENING — AMBITIOUS',
    'ouverte (Les Défricheuses)': 'open (Les Défricheuses)',
    'non déployé': 'not deployed',
    'PLAFOND DU CANAL — 109 points de vente': 'CHANNEL CEILING — 109 points of sale',
    'DÉPLOIEMENT': 'ROLLOUT',
    'POINTS DE VENTE AU 31 AOÛT': 'POINTS OF SALE AT 31 AUGUST',
    'REVENU ENCAISSÉ PAR LASCLAY': 'REVENUE COLLECTED BY LASCLAY',
    '2025-2026 (réel, Les Défricheuses)': '2025-2026 (actual, Les Défricheuses)',
    '2026-2027 — conservateur': '2026-2027 — conservative',
    '2027-2028 — conservateur': '2027-2028 — conservative',
    '2028-2029 — conservateur': '2028-2029 — conservative',
    '2026-2027 — ambitieux': '2026-2027 — ambitious',
    '2027-2028 — ambitieux': '2027-2028 — ambitious',
    '2028-2029 — ambitieux': '2028-2029 — ambitious',

    # --------------------------------------------- budget de caisse et bilan
    '2023-2024 et 2024-2025 : réels, tirés de Résultats2024 et Résultats2025maj':
        '2023-2024 and 2024-2025: actuals, taken from Résultats2024 and Résultats2025maj',
    'Exercices 2024 à 2029 (1er septembre au 31 août)':
        'Fiscal years 2024 to 2029 (1 September to 31 August)',
    'Subventions encaissées (dérivées du résultat, lignes 121 à 134)':
        'Grants received (derived from the income statement, rows 121 to 134)',
    'Nouveaux emprunts encaissés': 'New borrowings received',
    'Remboursements de capital (dette à long terme et avances)':
        'Principal repayments (long-term debt and advances)',
    'Dividende à l’actionnaire (0 $ : aucun pendant le terme des prêts)':
        'Shareholder dividend ($0: none during the term of the loans)',
    'Dividende Gabriel (5% du bénéfice net N-1)':
        'Gabriel dividend (5% of prior-year net profit)',
    'Trésorerie cumulative avant marge de crédit':
        'Cumulative cash before the line of credit',
    'Trésorerie après marge de crédit': 'Cash after the line of credit',
    'À reconcilier avec AccèsD et QBO avant dépôt (QBO : 30 551 $ chèques + 6 346 $ PayPal)':
        'To be reconciled with AccèsD and QBO before submission (QBO: $30,551 chequing + $6,346 PayPal)',
    'Écart entre le détail mensuel ci-dessus et l’état des flux':
        'Difference between the monthly detail above and the cash flow statement',
    'CONTRÔLE — encaisse réelle au 30 juin 2026 (QuickBooks)':
        'CONTROL — actual cash at 30 June 2026 (QuickBooks)',
    'Encaisse modélisée au 31 août 2026': 'Modelled cash at 31 August 2026',
    'Bilan réel de QuickBooks : dix mois, sept. 2025 à juin 2026 (colonnes AC à AL de « QBOBS à maj »). Juillet et août 2026 restent prévisionnels : la colonne juillet de QuickBooks est une photo du mois en cours, pas un mois fermé.':
        'Actual QuickBooks balance sheet: ten months, Sept. 2025 to June 2026 (columns AC to AL of “QBOBS to update”). July and August 2026 remain forecast: the QuickBooks July column is a snapshot of the month in progress, not a closed month.',
    "Pour l'exercice se terminant le 31 août 2026, 2027, 2028 et 2029":
        'For the fiscal years ending 31 August 2026, 2027, 2028 and 2029',
    'Encaisse après tirage de la marge (Résultats l. 189)':
        'Cash after drawing on the line (Income stmt row 189)',
    'Solde courant : + crédits comptabilisés, − encaissement au printemps':
        'Running balance: + credits recorded, − collection in the spring',
    'Inclut le stock en consignation chez les détaillants ; la part en consignation est isolée rangée 84. Seul le stock propre suit le facteur de croissance.':
        'Includes inventory on consignment at retailers; the consignment share is isolated on row 84. Only owned inventory follows the growth factor.',
    'Marge de crédit saisonnière (Résultats l. 183)':
        'Seasonal line of credit (Income stmt row 183)',
}

GLOSSAIRE = {**{s: s for s in IDENTIQUE}, **TRADUIT}
