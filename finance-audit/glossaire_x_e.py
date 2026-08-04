# -*- coding: utf-8 -*-
"""Glossaire du chiffrier, partie E — annotations du résultat, trésorerie, Inputs."""

IDENTIQUE = [
    'CMV', 'CMO', 'MOD', 'PARI-CNRC', 'Preuve', 'temps',
    'LIEN COGS LASCLAY', 'Conservateur', 'Ambitieux',
    'Inputs!C57', 'Inputs!D57', 'Inputs!E57', 'Inputs!C59', 'Inputs!D59',
    'Inputs!E59', 'Inputs!G11', 'Inputs!H11', 'Inputs!I11', 'Inputs!C54',
    "'Ventes prévisionnelles '!BD10", "'Ventes prévisionnelles '!BD83",
    "'Ventes prévisionnelles '!BD141", "'Ventes prévisionnelles '!BD155",
    "'Ventes prévisionnelles '!BD186", "'Ventes prévisionnelles '!BD243",
    "'Ventes prévisionnelles '!BS10", "'Ventes prévisionnelles '!BS83",
    "'Ventes prévisionnelles '!BS141", "'Ventes prévisionnelles '!BS155",
    "'Ventes prévisionnelles '!BS186", "'Ventes prévisionnelles '!BS243",
]

TRADUIT = {
    # --------------------------------------------- fiches de coût de revient
    'matériaux': 'materials',
    'Matières premières': 'Raw materials',
    'matières premières': 'raw materials',
    'Sous traitance': 'Subcontracting',
    'S-T assemblage': 'Assembly subcontr.',
    'Tissu isolant au mètre': 'Insulating fabric by the metre',
    'Tissu isolant': 'Insulating fabric',
    'Fil à tricoter laine-asclépiade (Pelote 100m)':
        'Wool-milkweed knitting yarn (100 m skein)',
    "Huile de graines d'asclépiade (30mL)": 'Milkweed seed oil (30 mL)',
    'TOT. Matériaux': 'Materials total',
    'Étui iMac': 'iMac sleeve',
    'totaux hiver': 'winter totals',
    'Produits hiver': 'Winter products',
    'Manchons boissons': 'Drink sleeves',
    'Sac de couchage': 'Sleeping bag',
    'Couvert. camping matelassée': 'Quilted camping blanket',
    'totaux été': 'summer totals',
    'Produits été': 'Summer products',
    'Services horticoles': 'Horticultural services',
    'totaux horticoles': 'horticultural totals',
    'Produits horticoles': 'Horticultural products',
    'Nettoyant visage': 'Facial cleanser',
    'Crème hydratante': 'Moisturising cream',
    'Bombes de semence': 'Seed bombs',
    'Prix achat': 'Purchase price',
    "Prix d'achat": 'Purchase price',
    'Achat': 'Purchase',
    'transport': 'freight',
    'Total CMV-CMO': 'Total COGS incl. direct labour',
    'Total CMV (excluant CMO)': 'Total COGS (excluding direct labour)',
    'Sous-traitance QC / collabs (sans douane)':
        'QC subcontracting / collaborations (no customs)',
    'Economie MOD': 'Direct labour saving',
    'CMO unitaire': 'Direct labour per unit',
    'Total MOD': 'Total direct labour',
    'Après automatisation coupe': 'After cutting automation',
    'Grand total CMV': 'Grand total COGS',

    # ----------------------------------------- annotations du résultat
    'Budget de 2025-2026 tel qu’il avait été posé (constantes) : un exercice fermé ne se rebudgète pas. 2026-2027 à 2028-2029 sont pilotés par « Ventes prévisionnelles », un bloc de 15 colonnes par exercice.':
        'The 2025-2026 budget as it was originally set (constants): a closed year is not re-budgeted. 2026-2027 to 2028-2029 are driven by “Sales forecast”, a block of 15 columns per year.',
    "Net des ventes en consignation aux Défricheuses, reclassées à la rangée 12 : le total de l'exercice fermé ne bouge pas, le canal détail devient lisible.":
        'Net of consignment sales to Les Défricheuses, reclassified to row 12: the closed year’s total does not move, and the retail channel becomes readable.',
    'Ventes au détail — consignation (revenu encaissé par Lasclay)':
        'Retail sales — consignment (revenue collected by Lasclay)',
    "Revenu encaissé par Lasclay, soit 60 % du prix payé par le consommateur. 2025-2026 est le réel des rapports de consignation des Défricheuses ; 2026-2027 à 2028-2029 viennent de « Détail par ville ».":
        'Revenue collected by Lasclay, that is 60% of the price paid by the consumer. 2025-2026 is the actual from the Les Défricheuses consignment reports; 2026-2027 to 2028-2029 come from “Retail by city”.',
    'Points de vente au détail actifs (moyenne du mois)':
        'Active retail points of sale (monthly average)',
    'Ouverture linéaire sur l’exercice, du solde de l’an passé à la cible d’Inputs (rangées 123 à 125)':
        'Linear openings across the year, from last year’s closing count to the Inputs target (rows 123 to 125)',
    'Plantation et services agricoles (Défi-Québec)':
        'Planting and farm services (Défi-Québec)',
    'Inclut le chargé(e) de comptes du canal détail dès 2027-2028 (Inputs, rangée 137)':
        'Includes the retail channel account manager from 2027-2028 (Inputs, row 137)',
    'Canal détail : commission de représentation et déplacements (7 % du revenu encaissé) et présentoir de 800 $ par point de vente ouvert dans le mois.':
        'Retail channel: sales commission and travel (7% of revenue collected) and an $800 display unit per point of sale opened in the month.',
    'Perte nette sur disposition d’immobilisations':
        'Net loss on disposal of capital assets',
    'Produit de disposition d’immobilisations':
        'Proceeds from disposal of capital assets',
    'Hors scénario de base — voir « Sommaire bailleurs »':
        'Outside the base scenario — see “Lender summary”',
    "Économies d'optimisation (SaaS, expédition, télécom)":
        'Optimisation savings (SaaS, shipping, telecom)',
    "Retiré : une économie de coût n'est pas un revenu":
        'Removed: a cost saving is not revenue',
    'Profit (perte) avant impôts — HORS aides publiques':
        'Profit (loss) before tax — EXCLUDING public funding',
    'Dix mois réels : reprend le bénéfice cumulatif de QuickBooks':
        'Ten actual months: picks up the cumulative profit from QuickBooks',
    'EBITDA — HORS aides publiques': 'EBITDA — EXCLUDING public funding',
    'EBITDA (avant impôts, intérêts, amortissements et disposition)':
        'EBITDA (before tax, interest, depreciation and disposals)',
    'Impôts (mémo, déjà exclus du résultat avant impôts)':
        'Income tax (memo, already excluded from the pre-tax result)',
    'Aides publiques comprises dans le résultat':
        'Public funding included in the result',
    'Soldé en sept. 2026 par la nouvelle facilité':
        'Paid off in Sept. 2026 by the new facility',
    'Sept. 2026 : facilité de 460 000 $ (BDC fonds de roulement + prêt à terme de refinancement + Prêt d’Honneur). Solde Shopify Capital et Merchant Growth, et finance le stock d’automne. Amortissement 84 mois.':
        'Sept. 2026: a $460,000 facility (BDC working capital + refinancing term loan + Prêt d’Honneur). Pays off Shopify Capital and Merchant Growth, and finances autumn inventory. Amortised over 84 months.',
    'Postposée : aucun mouvement pendant le terme des prêts':
        'Subordinated: no movement during the term of the loans',

    # --------------------------------------------------------- la trésorerie
    'Encaisse cumulative avant marge de crédit':
        'Cumulative cash before line of credit',
    'Marge de crédit — solde tiré': 'Line of credit — drawn balance',
    'Variation de la marge de crédit': 'Change in the line of credit',
    'Encaisse au début': 'Opening cash',
    '(ancienne ligne « marge de crédit au début », remplacée par la r. 183)':
        '(former “opening line of credit” row, replaced by row 183)',
    'Encaisse à la fin (après marge)': 'Closing cash (after the line of credit)',
    'Marge de crédit à autoriser (tirage maximal du plan)':
        'Line of credit to authorise (the plan’s maximum draw)',
    'Contrôle : encaisse fin − (avant marge + marge)':
        'Control: closing cash − (before line + line)',

    # -------------------------------------------------------------- Inputs
    'Taux de change USD/CAD (hypothèse fixe, à réviser au besoin)':
        'USD/CAD exchange rate (fixed assumption, revise as needed)',
    'Publicité numérique (% du revenu brut) — réel 2025-2026 24,4 %':
        'Digital advertising (% of gross revenue) — 2025-2026 actual 24.4%',
    'Service client — automatisé, aucune ressource dédiée':
        'Customer service — automated, no dedicated resource',
    'Ressource ventes et service (retirée du plan)':
        'Sales and service resource (removed from the plan)',
    'Ressource marketing (dès sept. 2027)': 'Marketing resource (from Sept. 2027)',
    'Gestion logistique - production internationale (dès oct. 2026)':
        'Logistics management — international production (from Oct. 2026)',
    'Hausses salariales annuelles dès 2027-2028 (composées, 3 %/an)':
        'Annual salary increases from 2027-2028 (compounded, 3%/yr)',
    'Catherine & Gabriel :': 'Catherine and Gabriel:',
    'Autres ressources :': 'Other resources:',
    '→ pilotent Résultats-Prev rangées 45, 69, 81, 91 (2027-2028 et 2028-2029)':
        '→ these drive Income-Forecast rows 45, 69, 81, 91 (2027-2028 and 2028-2029)',
    'RSDE 2025-2026 — même méthode que 2026-2027 (55 % des salaires admissibles, majorés)':
        'SR&ED 2025-2026 — same method as 2026-2027 (55% of eligible salaries, grossed up)',
    'Pertes fiscales reportables fin 2025-2026 (estimé comptable, À VALIDER)':
        'Loss carryforwards at the end of 2025-2026 (accountant’s estimate, TO BE CONFIRMED)',
    'Croissance 2028-2029 appliquée au profil mensuel 2027-2028':
        '2028-2029 growth applied to the 2027-2028 monthly profile',
    'COÛT DES MARCHANDISES VENDUES — ratios de prévision':
        'COST OF GOODS SOLD — forecast ratios',
    'Réel 2023-2024 / 2024-2025 / 2025-2026':
        'Actual 2023-2024 / 2024-2025 / 2025-2026',
    'Achats de matières premières (% des ventes nettes)':
        'Raw material purchases (% of net sales)',
    'Transport et douanes sur achats (% des achats)':
        'Freight and customs on purchases (% of purchases)',
    "Sous-traitance d'assemblage (% des ventes nettes)":
        'Assembly subcontracting (% of net sales)',
    'MOD interne, production sous-traitée dès 2026-2027 ($/an)':
        'In-house direct labour, production subcontracted from 2026-2027 ($/yr)',
    'La sous-traitance monte (19,2 % en 2025-2026) parce que la production interne disparaît, puis redescend avec l’échelle et le passage au bateau. Les coûts unitaires cibles des fiches Tunisie (13-15 % du prix de vente) restent détaillés dans « Ventes prévisionnelles » lignes 260 à 499 : ils constituent le plancher, pas l’hypothèse retenue.':
        'Subcontracting rises (19.2% in 2025-2026) because in-house production disappears, then falls again with scale and the switch to sea freight. The target unit costs from the Tunisia sheets (13-15% of selling price) remain detailed in “Sales forecast” rows 260 to 499: they are the floor, not the assumption used.',
    "PLAN D'EMBAUCHE — une embauche par exercice, pas trois d'un coup":
        'HIRING PLAN — one hire per year, not three at once',
    '2026-2027 : gestion logistique / production internationale, 1er oct. 2026 (11 mois). C’est la personne qui pilote BMB Tunisie ; sans elle, le virage manufacturier ne tient pas.':
        '2026-2027: logistics management / international production, 1 Oct. 2026 (11 months). This is the person who runs BMB Tunisia; without them the manufacturing pivot does not hold.',
    '2027-2028 : ressource marketing, 1er sept. 2027, quand le volume la porte. D’ici là, le marketing passe par la sous-traitance (ligne 82 du résultat).':
        '2027-2028: marketing resource, 1 Sept. 2027, when volume supports it. Until then marketing goes through subcontracting (income statement row 82).',
    'Aucune ressource de service client : la boîte support est automatisée.':
        'No customer-service resource: the support inbox is automated.',
    'Expédition saisonnier : inchangé, oct. à déc., 25 h/sem.':
        'Seasonal shipping: unchanged, Oct. to Dec., 25 h/week.',
    'INVENTAIRE — croissance indexée sur celle des ventes nettes':
        'INVENTORY — growth indexed to net sales growth',
    'Facteur appliqué au même mois de l’exercice précédent':
        'Factor applied to the same month of the prior year',
    'TRÉSORERIE — plancher visé et marge de crédit saisonnière':
        'CASH — target floor and seasonal line of credit',
    'Plancher de trésorerie visé ($)': 'Target cash floor ($)',
    'Taux de la marge de crédit': 'Line of credit rate',
    'SCÉNARIO ACTIF → 1 = conservateur réaliste (bailleurs) 2 = ambitieux (investisseur privé)':
        'ACTIVE SCENARIO → 1 = realistic conservative (lenders) 2 = ambitious (private investor)',
    'Changer cette seule cellule bascule tout le classeur':
        'Changing this single cell switches the whole workbook',
    'Conservateur réaliste : le financement rétablit l’approvisionnement, le déploiement détail se fait à 6, 19 puis 43 points de vente, et le virage manufacturier livre une partie de son gain. C’est la version de la BDC, de Desjardins, du Prêt d’Honneur et du PARI.':
        'Realistic conservative: the financing restores supply, the retail rollout reaches 6, 19 then 43 points of sale, and the manufacturing pivot delivers part of its gain. This is the version for BDC, Desjardins, the Prêt d’Honneur and IRAP.',
    'Les nombres viennent des rangées 123 à 125.': 'The figures come from rows 123 to 125.',
    'Ambitieux : le déploiement détail va à 17, 53 puis 101 points de vente et le web croît plus vite, mais les ratios de coûts restent ceux du scénario conservateur. C’est la version de l’investisseur privé.':
        'Ambitious: the retail rollout reaches 17, 53 then 101 points of sale and the web grows faster, but the cost ratios stay those of the conservative scenario. This is the version for the private investor.',
    'HYPOTHÈSES QUI BASCULENT': 'ASSUMPTIONS THAT SWITCH',
    'Cellule pilotée': 'Cell driven',
    'Sensibilité baissière (non branchée)': 'Downside sensitivity (not wired in)',
    'Croissance 2026-2027 — accessoires hiver': 'Growth 2026-2027 — winter accessories',
    'Croissance 2026-2027 — produits été': 'Growth 2026-2027 — summer products',
    'Croissance 2026-2027 — horticole': 'Growth 2026-2027 — horticulture',
    'Croissance 2026-2027 — maison': 'Growth 2026-2027 — home',
    'Croissance 2026-2027 — produits dérivés': 'Growth 2026-2027 — merchandise',
    'Croissance 2026-2027 — matériaux': 'Growth 2026-2027 — materials',
    'Croissance 2027-2028 — accessoires hiver': 'Growth 2027-2028 — winter accessories',
    'Croissance 2027-2028 — produits été': 'Growth 2027-2028 — summer products',
    'Croissance 2027-2028 — horticole': 'Growth 2027-2028 — horticulture',
    'Croissance 2027-2028 — maison': 'Growth 2027-2028 — home',
    'Croissance 2027-2028 — produits dérivés': 'Growth 2027-2028 — merchandise',
    'Croissance 2027-2028 — matériaux': 'Growth 2027-2028 — materials',
    'Achats de matières premières, % des ventes nettes (2026-2027)':
        'Raw material purchases, % of net sales (2026-2027)',
    'Achats de matières premières (2027-2028)': 'Raw material purchases (2027-2028)',
    'Achats de matières premières (2028-2029)': 'Raw material purchases (2028-2029)',
    "Sous-traitance d'assemblage (2026-2027)": 'Assembly subcontracting (2026-2027)',
    "Sous-traitance d'assemblage (2027-2028)": 'Assembly subcontracting (2027-2028)',
    "Sous-traitance d'assemblage (2028-2029)": 'Assembly subcontracting (2028-2029)',
    'Publicité numérique, % du revenu brut (2026-2027)':
        'Digital advertising, % of gross revenue (2026-2027)',
    'Publicité numérique (2027-2028)': 'Digital advertising (2027-2028)',
    'Publicité numérique (2028-2029)': 'Digital advertising (2028-2029)',
    'Ressource marketing — 1er janvier 2028 en base, reportée sine die en prudent':
        'Marketing resource — 1 January 2028 in the base case, deferred indefinitely in the cautious case',
    'Hypothèse : Inputs ligne 102': 'Assumption: Inputs row 102',
    'Hypothèse : Inputs ligne 103': 'Assumption: Inputs row 103',
    'Hypothèse : Inputs ligne 104': 'Assumption: Inputs row 104',
    'Hypothèse : Inputs ligne 105': 'Assumption: Inputs row 105',
    'Hypothèse : Inputs ligne 106': 'Assumption: Inputs row 106',
    'Hypothèse : Inputs ligne 107': 'Assumption: Inputs row 107',
    'Hypothèse : Inputs ligne 108': 'Assumption: Inputs row 108',
    'Hypothèse : Inputs ligne 109': 'Assumption: Inputs row 109',
    'Hypothèse : Inputs ligne 110': 'Assumption: Inputs row 110',
    'Hypothèse : Inputs ligne 111': 'Assumption: Inputs row 111',
    'Hypothèse : Inputs ligne 112': 'Assumption: Inputs row 112',
    'Hypothèse : Inputs ligne 113': 'Assumption: Inputs row 113',
}

GLOSSAIRE = {**{s: s for s in IDENTIQUE}, **TRADUIT}
