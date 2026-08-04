# -*- coding: utf-8 -*-
"""Glossaire du chiffrier, partie H — les dernières chaînes."""

IDENTIQUE = [
    'Lasclay Payables', 'Avance Gabriel', 'Nouvelle dette', 'partiel',
    '2036 CC shipping (Laurence)', '2513 BDC 11K',
]

TRADUIT = {
    'Outils de vente en ligne': 'E-commerce tools',
    'Outils de gestion et RH': 'Management and HR tools',
    'Nouvelle dette': 'New debt',
    'partiel': 'partial',
    'Avance Gabriel': 'Gabriel advance',
    'Dividendes à payer': 'Dividends payable',
    '80 000 $ reçus le 15 août 2026, remboursables sur 12 mois à 8 % (sept. 2026 → août 2027)':
        '$80,000 received on 15 August 2026, repayable over 12 months at 8% (Sept. 2026 → Aug. 2027)',
    'Total de contrôle ( écart à concilier)': 'Control total (difference to reconcile)',
    "TVQ déclarée au mois, TPS à l'année avec un solde dû au 30 novembre. Le solde se construit par ses mouvements à partir du réel d'août 2026 : chaque mois accumule sa TPS et sa TVQ, la TVQ du mois précédent se verse, et novembre acquitte la TPS de l'exercice écoulé. Les taux sont calés sur les vrais montants de 2025-2026, Inputs rangées 142 à 161.":
        'QST filed monthly, GST annually with a balance due 30 November. The balance is built from its movements starting with the August 2026 actual: each month accrues its GST and QST, the prior month’s QST is remitted, and November settles the GST for the year just ended. The rates are calibrated on the actual 2025-2026 amounts, Inputs rows 142 to 161.',
    'Dont stock en consignation chez les détaillants (mémo, compris dans l’inventaire de produits finis)':
        'Of which inventory on consignment at retailers (memo, included in finished goods inventory)',
    'Lasclay en reste propriétaire jusqu’à la vente au consommateur. Pilotes dans Inputs : vente annuelle par point de vente (126), mois de couverture (132).':
        'Lasclay retains ownership until the sale to the consumer. Drivers in Inputs: annual sales per point of sale (126), months of cover (132).',

    # -------------------------------------------------- disposition d'actifs
    'DISPOSITION 2025-2026 — détail (chiffrier « Vente équipements », comptable)':
        'DISPOSAL 2025-2026 — detail (accountant’s “Equipment sale” workbook)',
    'Produit de vente des actifs inscrits au compte 1630':
        'Proceeds from the sale of assets recorded in account 1630',
    'Produit de vente des rackings (coût déjà passé en charges, hors registre)':
        'Proceeds from the sale of the racking (cost already expensed, off register)',
    'VNC sortie du registre (coût 67 899,95 − amort. cumulé 28 229,93)':
        'Net book value removed from the register (cost $67,899.95 − accumulated depreciation $28,229.93)',
    'Perte sur les actifs inscrits': 'Loss on the registered assets',
    'Perte nette sur disposition (portée au résultat)':
        'Net loss on disposal (taken to the income statement)',
    'Encaissement total de la disposition (porté aux investissements)':
        'Total cash from the disposal (taken to investing activities)',

    # ------------------------------------------------------ comptes payables
    'Comptes payables du début': 'Opening accounts payable',
    'Achats (excluant salaires)': 'Purchases (excluding salaries)',
    'Déboursés (excluant salaires)': 'Disbursements (excluding salaries)',
    "Budgets annuels d'achats matières (2026-2027 col B, 2027-2028 col C); ~13% des ventes nettes (réel 4 ans)":
        'Annual material purchase budgets (2026-2027 col B, 2027-2028 col C); ~13% of net sales (4-year actual)',
    '2026-2027: courbe automne plafonnée (~10-12k achats court terme; Vegeto + 27k inventaire déjà chez BMB); AT24 = 10k matières achetées par BMB en Tunisie; douane 18% + bateau inclus dans le x1.26 de la sous-traitance':
        '2026-2027: autumn curve capped (~10-12k of short-term purchases; Vegeto + 27k of inventory already at BMB); AT24 = 10k of materials bought by BMB in Tunisia; 18% customs + sea freight included in the ×1.26 on subcontracting',
    "Budget annuel d'achats de matières 2026-2027 (dérivé du résultat, ligne 34)":
        'Annual material purchase budget 2026-2027 (derived from the income statement, row 34)',
    "Budget annuel d'achats de matières 2027-2028 (dérivé du résultat, ligne 34)":
        'Annual material purchase budget 2027-2028 (derived from the income statement, row 34)',

    # ---------------------------------------------------------------- dette
    'Solde au 31 août 2026': 'Balance at 31 August 2026',
    'Solde au 31 août 2027': 'Balance at 31 August 2027',
    'Solde au 31 août 2028': 'Balance at 31 August 2028',
    'Intérêts nouvelle facilité (9.9 %)': 'Interest on the new facility (9.9%)',
    'Capital avance actionnaire (80 000 $ le 15 août 2026, 12 mois, 8 %)':
        'Shareholder advance principal ($80,000 on 15 August 2026, 12 months, 8%)',
    'Solde prêt actionnaire Gabriel': 'Gabriel shareholder loan balance',
    'Intérêts avance actionnaire (8 % sur solde décroissant)':
        'Shareholder advance interest (8% on the declining balance)',

    # ------------------------------------------------------- autres canaux
    'Autres canaux': 'Other channels',
    'Ventes B2B et distributeurs': 'B2B and distributor sales',
    'Revenu annuel en AP / mensuel à droite':
        'Annual revenue in column AP / monthly to the right',
    'Produits vendus hors catalogue modélisé':
        'Products sold outside the modelled catalogue',

    # -------------------------------------- comptes ajoutés depuis le collage
    'Comptes ajoutés par QuickBooks depuis le dernier collage':
        'Accounts added by QuickBooks since the last paste',
    '1650 Intérêts Merchant Growth': '1650 Merchant Growth interest',
    '2503 Prêt AccordD 003 8k': '2503 Accord D loan 003 — 8K',
    '2510 Prêt BDC 100K': '2510 BDC loan 100K',
    '2512 Prêt BDC 10K': '2512 BDC loan 10K',
    '2606 Merchant Growth Capital': '2606 Merchant Growth Capital',
    '2607 Shopify Capital #4 250K': '2607 Shopify Capital #4 — 250K',
}

GLOSSAIRE = {**{s: s for s in IDENTIQUE}, **TRADUIT}
