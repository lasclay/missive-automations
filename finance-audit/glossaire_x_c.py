# -*- coding: utf-8 -*-
"""Glossaire du chiffrier, partie C — le reste du plan comptable QuickBooks."""

IDENTIQUE = [
    '6331 Facebook Ads', '6333 SMS', '6334 Email', '6335 Etsy Ads',
    '2121 Shopify Sales Tax Collected', '2122 Etsy Sales Tax Collected',
    '2601 Emprunt - Shopify Capital', '2401 Prêt de Gabriel Gouveia-Fortin',
    'PROFIT', 'Capital',
]

TRADUIT = {
    # ------------------------------------------------------ passif, suite
    '2035 (CATHERINE) VISA 5015': '2035 (CATHERINE) VISA 5015',
    'Total 2030 Cartes de crédit': 'Total 2030 Credit cards',
    'Total Cartes de crédit': 'Total credit cards',
    "2015 Revenus perçus d'avance": '2015 Deferred revenue',
    '2039 Frais courus à payer': '2039 Accrued liabilities',
    '2050 Compte d’attente pour la TPS/TVH - TVQ':
        '2050 Suspense account for GST/HST and QST',
    '2053 Compte d’attente pour la TVP (SK)': '2053 Suspense account for PST (SK)',
    '2551 Compte d’attente pour la TVP (C.-B.)':
        '2551 Suspense account for PST (BC)',
    '2100 Taxes & impôts à payer': '2100 Sales and income taxes payable',
    '2110 TPS/TVH - TVQ à payer': '2110 GST/HST and QST payable',
    '2111 TVP (C.-B.) à payer': '2111 PST (BC) payable',
    '2112 TVP (MB) à payer': '2112 PST (MB) payable',
    '2113 TVP (SK) à payer': '2113 PST (SK) payable',
    '2120 Taxes perçues à redistribuer (E-Commerces)':
        '2120 Taxes collected for remittance (e-commerce)',
    'Total 2120 Taxes perçues à redistribuer (E-Commerces)':
        'Total 2120 Taxes collected for remittance (e-commerce)',
    'Total 2100 Taxes & impôts à payer': 'Total 2100 Sales and income taxes payable',
    '2300 Cartes-cadeaux': '2300 Gift cards',
    '2301 Cartes-cadeaux Shopify+Rise': '2301 Gift cards, Shopify + Rise',
    'Total 2300 Cartes-cadeaux': 'Total 2300 Gift cards',
    'Total Passif à court terme': 'Total current liabilities',
    'Passifs à long terme': 'Long-term liabilities',
    '2400 Prêts des actionnaires': '2400 Shareholder loans',
    'Total 2400 Prêts des actionnaires': 'Total 2400 Shareholder loans',
    '2500 Prêts bancaires': '2500 Bank loans',
    '2501 Prêt AccordD 001 - 20K': '2501 Accord D loan 001 — 20K',
    '2502 Prêt AccordD 002 20k': '2502 Accord D loan 002 — 20K',
    '2504 Prêt AccordD 004 40k': '2504 Accord D loan 004 — 40K',
    '2511 Prêt BDC 18K': '2511 BDC loan 18K',
    'Total 2500 Prêts bancaires': 'Total 2500 Bank loans',
    '2600 Prêts privés et corporatifs': '2600 Private and corporate loans',
    '2602 Prêt privé de Philippe Langlois': '2602 Private loan from Philippe Langlois',
    '2603 Emprunt Shopify Capital #2 100K': '2603 Shopify Capital loan #2 — 100K',
    '2604 Prêt Privé de Philippe Langlois #2 10K':
        '2604 Private loan from Philippe Langlois #2 — 10K',
    '2605 Emprunt Shopify Capital #3 180K': '2605 Shopify Capital loan #3 — 180K',
    'Total 2600 Prêts privés et corporatifs':
        'Total 2600 Private and corporate loans',
    'Total Passifs à long terme': 'Total long-term liabilities',
    'Total des obligations': 'Total liabilities',
    '3002 Capital action': '3002 Share capital',
    '3003 Capital d’ouverture': '3003 Opening capital',
    'Bénéfices non répartis': 'Retained earnings',
    'Bénéfice de l’année': 'Profit for the year',
    'Total Capital': 'Total equity',
    'Total des obligations et du capital': 'Total liabilities and equity',

    # --------------------------------------------------- charges QuickBooks
    '6050 Frais gouvernementaux, permis et licences':
        '6050 Government fees, permits and licences',
    '6060 Recherche et développement': '6060 Research and development',
    '6061 RSDE - Salaires et avantages sociaux':
        '6061 SR&ED — salaries and benefits',
    '6062 RSDE - Sous-traitance': '6062 SR&ED — subcontracting',
    '6063 RSDE - Matériaux': '6063 SR&ED — materials',
    '6065 Salaires et avantages sociaux - Design':
        '6065 Salaries and benefits — design',
    '6066 Sous-traitance - Design': '6066 Subcontracting — design',
    'Total 6060 Recherche et développement': 'Total 6060 Research and development',
    'Total 6000 Frais généraux': 'Total 6000 Overhead',
    '6100 Expédition clients': '6100 Customer shipping',
    '6110 Expédition Canada': '6110 Shipping — Canada',
    '6120 Expédition USA': '6120 Shipping — USA',
    'Total 6100 Expédition clients': 'Total 6100 Customer shipping',
    '6200 Frais de vente': '6200 Selling expenses',
    "6210 Packaging / Fournitures d'expédition":
        '6210 Packaging and shipping supplies',
    '6220 Logiciels de commerce en ligne': '6220 E-commerce software',
    "6230 Logiciel d'expédition de colis": '6230 Parcel shipping software',
    'Total 6200 Frais de vente': 'Total 6200 Selling expenses',
    '6300 Marketing': '6300 Marketing',
    '6301 Salaires et avantages sociaux - Marketing':
        '6301 Salaries and benefits — marketing',
    '6310 Agences/Consultants/Sous-traitants marketing':
        '6310 Marketing agencies, consultants and subcontractors',
    '6315 Production de contenu': '6315 Content production',
    '6320 Cartes-cadeaux promotionnelles': '6320 Promotional gift cards',
    '6330 Publicité numérique': '6330 Digital advertising',
    '6339 Autres pub': '6339 Other advertising',
    'Total 6330 Publicité numérique': 'Total 6330 Digital advertising',
    '6350 Logiciels marketing': '6350 Marketing software',
    'Total 6300 Marketing': 'Total 6300 Marketing',
    '6400 Administration et RH': '6400 Administration and HR',
    '6401 Logiciels Admin et RH': '6401 Admin and HR software',
    '6402 Frais du service de paie': '6402 Payroll service fees',
    '6420 Salaires et avantages sociaux - ADMIN':
        '6420 Salaries and benefits — ADMIN',
    '6450 Frais juridiques et honoraires': '6450 Legal and professional fees',
    '6451 Frais juridiques': '6451 Legal fees',
    '6452 Comptabilité et finances': '6452 Accounting and finance',
    '6453 Autres honoraires professionnels': '6453 Other professional fees',
    'Total 6450 Frais juridiques et honoraires':
        'Total 6450 Legal and professional fees',
    '6510 Frais de formation': '6510 Training costs',
    '6511 Coaching entrepreneurial': '6511 Entrepreneurial coaching',
    '6512 Autres formations': '6512 Other training',
    'Total 6510 Frais de formation': 'Total 6510 Training costs',
    '6520 Frais de repas': '6520 Meal expenses',
    '6521 Repas en déplacement': '6521 Meals while travelling',
    'Total 6520 Frais de repas': 'Total 6520 Meal expenses',
    'Total 6400 Administration et RH': 'Total 6400 Administration and HR',
    '6530 Cadeaux employés/fournisseurs': '6530 Employee and supplier gifts',
    '6540 Divertissements & hébergements': '6540 Entertainment and accommodation',
    '7000 Frais financiers': '7000 Finance costs',
    '7001 Frais bancaires': '7001 Bank charges',
    '7010 Intérêts': '7010 Interest',
    '7011 Intérêts sur marge de crédit EDC': '7011 Interest on EDC line of credit',
    '7012 Intérêts Shopify Capital': '7012 Shopify Capital interest',
    '7013 Intérêts prêts AccordD': '7013 Accord D loan interest',
    '7014 Intérêts Prêt BDC 100k': '7014 BDC 100K loan interest',
    '7015 Intérêts Prêt Phil Langlois 10K':
        '7015 Phil Langlois 10K loan interest',
    '7016 Intérêts Prêt BDC 18K': '7016 BDC 18K loan interest',
    '7020 Intérêts Merchant Growth': '7020 Merchant Growth interest',
    'Total 7010 Intérêts': 'Total 7010 Interest',
    '7050 Frais marchand': '7050 Merchant fees',
    '7051 Frais Paypal': '7051 PayPal fees',
    '7052 Frais Shopify': '7052 Shopify fees',
    '7053 Frais Etsy': '7053 Etsy fees',
    'Total 7050 Frais marchand': 'Total 7050 Merchant fees',
    'Total 7000 Frais financiers': 'Total 7000 Finance costs',
    '7500 Frais fiscaux': '7500 Tax costs',
    '7503 Intérêts et pénalités - Taxes et impôts':
        '7503 Interest and penalties — sales and income taxes',
    'Total 7500 Frais fiscaux': 'Total 7500 Tax costs',
    'Total des dépenses': 'Total expenses',

    # ------------------------------------------------- autres revenus/dépenses
    'AUTRES REVENUS': 'OTHER INCOME',
    '8000 Autres Revenus': '8000 Other income',
    '8001 Intérêts créditeurs': '8001 Interest income',
    '8010 Remises annuelles de cartes de crédit':
        '8010 Annual credit card rebates',
    '8050 TVQ 2023': '8050 QST 2023',
    '8100 Subventions publiques': '8100 Public grants',
    '8200 Subventions privées': '8200 Private grants',
    "8300 Crédits d'impôt": '8300 Tax credits',
    'Total 8000 Autres Revenus': 'Total 8000 Other income',
    'Total des autres revenus': 'Total other income',
    'AUTRES DÉPENSES': 'OTHER EXPENSES',
    '9000 Autres dépenses': '9000 Other expenses',
    '9030 Divergences de rapprochement': '9030 Reconciliation discrepancies',
    '9060 Autres dépenses variées': '9060 Other miscellaneous expenses',
    "9700 Charge d'amortissement": '9700 Depreciation expense',
    "9710 Charge d'amortissement - Matériel informatique":
        '9710 Depreciation expense — computer equipment',
    "9720 Charge d'amortissement - Véhicules":
        '9720 Depreciation expense — vehicles',
    "9730 Charge d'amortissement - Équipements":
        '9730 Depreciation expense — equipment',
    "9740 Charge d'amortissement - Améliorations locatives":
        '9740 Depreciation expense — leasehold improvements',
    "Total 9700 Charge d'amortissement": 'Total 9700 Depreciation expense',
    'Total 9000 Autres dépenses': 'Total 9000 Other expenses',
    '9100 Perte ou gain relié au taux de change':
        '9100 Foreign exchange gain or loss',
    'Total des autres dépenses': 'Total other expenses',
}

GLOSSAIRE = {**{s: s for s in IDENTIQUE}, **TRADUIT}
