# -*- coding: utf-8 -*-
"""Glossaire du chiffrier, partie I — la page sommaire et le journal d'août.

Les noms d'onglet cités dans la colonne « OÙ REGARDER » du sommaire doivent
porter **le nom anglais de l'onglet**, celui que `ONGLETS` pose dans
`traduire_xlsx.py`. Un lecteur anglais qui suit « Résultats-Prev 2025-2029 »
cherche un onglet qui n'existe pas dans son classeur.
"""

GLOSSAIRE = {
    # ------------------------------------------------------------- en-tête
    'LASCLAY — SOMMAIRE DU MODÈLE': 'LASCLAY — MODEL SUMMARY',
    'Prévisions financières de 2025-2026 à 2028-2029. Exercice du 1er septembre au 31 août. Montants en dollars canadiens.':
        'Financial projections from 2025-2026 to 2028-2029. Fiscal year from 1 September to 31 August. Amounts in Canadian dollars.',
    'Réel : septembre 2025 à juillet 2026, onze mois tirés de QuickBooks. Projeté : août 2026 à août 2029.':
        'Actual: September 2025 to July 2026, eleven months taken from QuickBooks. Forecast: August 2026 to August 2029.',

    # Ces deux phrases vivent DANS une formule `IF`, pas dans la table des
    # chaînes : sans la passe sur les littéraux de formule, la copie anglaise
    # les affiche en français.
    'Scénario actif : CONSERVATEUR RÉALISTE (bailleurs institutionnels)':
        'Active scenario: REALISTIC CONSERVATIVE (institutional lenders)',
    'Scénario actif : AMBITIEUX (investisseur privé)':
        'Active scenario: AMBITIOUS (private investor)',
    # La clé est normalisée (espaces réduits) ; la valeur, elle, garde les
    # siennes, puisqu'elle est écrite telle quelle dans la formule.
    '— bascule dans Inputs, cellule C70.':
        '  —  switch in Inputs, cell C70.',

    # ------------------------------------------------------------- résultat
    'RÉSULTAT': 'INCOME STATEMENT',
    'Croissance des ventes nettes': 'Net sales growth',
    'Marge brute': 'Gross margin',
    'Marge brute en % des ventes nettes': 'Gross margin as % of net sales',
    'EBITDA hors aides publiques': 'EBITDA excluding public support',
    'Résultat avant impôts': 'Pre-tax result',

    # ---------------------------------------------------------- trésorerie
    'TRÉSORERIE, DETTE ET COUVERTURE': 'CASH, DEBT AND COVERAGE',
    'au 31 août 2026': 'at 31 August 2026',
    'au 31 août 2027': 'at 31 August 2027',
    'au 31 août 2028': 'at 31 August 2028',
    'au 31 août 2029': 'at 31 August 2029',
    'Encaisse à la fin de l’exercice': 'Cash at the end of the year',
    'Marge de crédit tirée à la fin de l’exercice':
        'Credit line drawn at the end of the year',
    'Mois le plus creux de l’exercice (encaisse)':
        'Lowest month of the year (cash)',
    'Tirage le plus élevé de l’exercice': 'Highest draw of the year',
    'Intérêts de l’exercice': 'Interest for the year',
    'Remboursements de capital, hors refinancement':
        'Principal repayments, excluding refinancing',
    'Couverture du service de la dette (EBITDA / service)':
        'Debt service coverage (EBITDA / service)',

    # --------------------------------------------------------- ce qui est réel
    'CE QUI EST DÉJÀ RÉEL — onze mois, sept. 2025 à juill. 2026':
        'WHAT IS ALREADY ACTUAL — eleven months, Sept. 2025 to July 2026',
    'Ventes nettes réalisées': 'Net sales realised',
    'Résultat avant impôts réalisé': 'Pre-tax result realised',
    'Encaisse au 31 juillet 2026': 'Cash at 31 July 2026',
    'Marge de crédit tirée au 31 juillet 2026':
        'Credit line drawn at 31 July 2026',
    'Part de l’exercice 2025-2026 déjà réalisée (ventes nettes)':
        'Share of 2025-2026 already realised (net sales)',

    # --------------------------------------------------- marge de crédit
    'MARGE DE CRÉDIT — LIMITE ET CONTRÔLE': 'CREDIT LINE — LIMIT AND CONTROL',
    'Marge de crédit autorisée': 'Authorised credit line',
    'Tirage le plus élevé des 48 mois': 'Highest draw across the 48 months',
    'Tirage le plus élevé des mois projetés':
        'Highest draw across the forecast months',
    'Dépassement de la limite sur les mois projetés':
        'Overrun of the limit on the forecast months',
    'Le tirage n’est pas bridé dans le modèle : plafonner le tirage cacherait le besoin de financement au lieu de le montrer. Le dépassement se lit ici.':
        'The draw is not capped in the model: capping it would hide the financing need instead of showing it. The overrun is read here.',

    # ------------------------------------------------------- où regarder
    'OÙ REGARDER': 'WHERE TO LOOK',
    'Le résultat mois par mois, 48 mois. Les colonnes D à O sont 2025-2026.':
        'The income statement month by month, 48 months. Columns D to O are 2025-2026.',
    'Le bilan aux mêmes 48 mois. La rangée 76 est un contrôle : elle doit rester à zéro partout.':
        'The balance sheet over the same 48 months. Row 76 is a control: it must stay at zero everywhere.',
    'Les encaissements et décaissements qui produisent la trésorerie du résultat.':
        'The receipts and disbursements that produce the income statement’s cash.',
    'Toutes les hypothèses, et la bascule de scénario (C70).':
        'All the assumptions, and the scenario switch (C70).',
    'Le moteur de ventes, produit par produit.':
        'The sales engine, product by product.',
    'Le canal détail : 40 villes, 109 points de vente possibles, calendrier de déploiement.':
        'The retail channel: 40 cities, 109 possible points of sale, rollout schedule.',
    'Les échéanciers de chaque emprunt.': 'The schedule for each loan.',
    'Le registre des immobilisations et leur amortissement.':
        'The capital asset register and its depreciation.',
    'Les achats, les déboursés et l’inventaire.':
        'Purchases, disbursements and inventory.',
    'Le réel de QuickBooks, collé. Les mois réels du résultat le lisent par SUMIF.':
        'The QuickBooks actuals, pasted. The income statement’s actual months read it by SUMIF.',
    'Le bilan réel de QuickBooks, collé.':
        'The QuickBooks actual balance sheet, pasted.',
    'Ce que la révision a corrigé, et ce qui reste à valider avant de déposer.':
        'What the revision corrected, and what remains to be validated before filing.',
    'Aucun chiffre de cette page n’est saisi : tout est une formule qui pointe vers les feuilles de détail. Une correction faite ailleurs se lit ici sans intervention.':
        'No figure on this page is typed in: every one is a formula pointing at the detail sheets. A correction made elsewhere shows up here with no intervention.',

    # Les noms d'onglet cités dans la colonne A du sommaire : ils doivent
    # correspondre aux onglets anglais, pas aux français.
    'Inputs': 'Inputs',
    'Résultats-Prev 2025-2029': 'Income-Forecast 2025-2029',
    'Bilan2026-27-28': 'BalanceSheet2026-27-28',
    'Ventes prévisionnelles': 'Sales forecast',
    'Détail par ville': 'Retail by city',
    'Immos': 'Capital assets',
    'Account payable': 'Accounts payable',
    'QBO P&L à maj': 'QBO P&L to update',
    'QBOBS à maj': 'QBOBS to update',
    'Notes d’audit': 'Audit log',

    # ------------------------------------------------------------- journal
    'JOURNAL D’AUDIT DU MODÈLE — révision du 30 juillet 2026, mise à jour le 4 août 2026':
        'MODEL AUDIT LOG — 30 July 2026 revision, updated 4 August 2026',
    '• RÉGLÉ : le bilan réel de QuickBooks couvre maintenant les onze mois comptabilisés, de septembre 2025 à juillet 2026 (« QBOBS à maj », colonnes AC à AM). Le résultat réel couvre les mêmes onze mois : les deux feuilles s’arrêtent au même endroit, ce qui est la condition pour que la prévision de trésorerie parte du bon solde.':
        '• SETTLED: the QuickBooks actual balance sheet now covers the eleven booked months, September 2025 to July 2026 (“QBOBS to update”, columns AC to AM). The actual income statement covers the same eleven months: both sheets stop at the same place, which is the condition for the cash forecast to start from the right balance.',
    '• Solde bancaire : au 31 juillet 2026, QuickBooks affiche -7 182 $ au compte chèques et -830 $ de trésorerie totale, avec la marge EDC tirée à 143 026 $. Le modèle ne porte plus d’ancrage codé en dur : il lit ces montants. Reste à rapprocher d’AccèsD (Budget de caisse, lignes 38 à 40) avant le dépôt.':
        '• Bank balance: at 31 July 2026 QuickBooks shows −$7,182 in the chequing account and −$830 of total cash, with the EDC line drawn at $143,026. The model no longer carries a hard-coded anchor: it reads these amounts. Still to be reconciled against AccèsD (Cash budget, rows 38 to 40) before filing.',
    '• Séance de tenue de livres du 30 juillet, rapatriée par fix_aq.py, puis relevée à nouveau le 4 août : juillet 2026 est comptabilisé à 3 267 $ de revenus, 7 879 $ de coût des marchandises et 44 304 $ de dépenses, soit une perte de 48 225 $. Juin a aussi bougé — 15 746 $ de transport sur achats au lieu de 525 $ — et le résultat du mois passe de -18 051 $ à -33 405 $.':
        '• Bookkeeping session of 30 July, brought back by fix_aq.py, then pulled again on 4 August: July 2026 is booked at $3,267 of revenue, $7,879 of cost of goods and $44,304 of expenses, a loss of $48,225. June moved too — $15,746 of freight on purchases instead of $525 — and the month’s result goes from −$18,051 to −$33,405.',
    '• Juillet 2026 est passé du prévisionnel au réel (fix_as.py). Un mois réel ne se distingue pas d’un mois prévisionnel par une case à cocher mais par la forme de ses formules : la colonne de juillet a reçu celle de juin, au résultat comme au bilan. Le résultat avant impôts du mois tombe à -48 225 $, exactement le PROFIT de QuickBooks, contre -39 272 $ en prévision.':
        '• July 2026 moved from forecast to actual (fix_as.py). An actual month is told apart from a forecast month not by a checkbox but by the shape of its formulas: July’s column received June’s, on the income statement as on the balance sheet. The month’s pre-tax result falls to −$48,225, exactly QuickBooks’ PROFIT, against −$39,272 in the forecast.',
    '• Ce que la bascule révèle : la marge de crédit était tirée à 143 026 $ au 31 juillet 2026, alors que le modèle projetait 27 825 $. Le sommet des mois projetés — août 2026 à août 2029 — s’établit à 141 878 $ en août 2027, soit 11 878 $ au-dessus de la limite de 130 000 $ retenue. Le modèle ne bride pas le tirage : plafonner cacherait le besoin au lieu de le montrer (Inputs, rangées 163 à 167).':
        '• What the switch reveals: the credit line was drawn at $143,026 at 31 July 2026, where the model projected $27,825. The peak across the forecast months — August 2026 to August 2029 — is $141,878 in August 2027, $11,878 above the $130,000 limit assumed. The model does not cap the draw: capping would hide the need instead of showing it (Inputs, rows 163 to 167).',
    '• L’exercice 2025-2026 se referme sur 977 339 $ de ventes nettes et -122 613 $ avant impôts, dont onze mois réels et un seul mois — août 2026 — encore projeté.':
        '• The 2025-2026 year closes at $977,339 of net sales and −$122,613 before tax, of which eleven months are actual and a single month — August 2026 — is still forecast.',
    '• Une page « Sommaire » ouvre le classeur. Elle ne contient aucune valeur saisie : chaque chiffre est une formule vers les feuilles de détail, et la bascule de scénario d’Inputs C70 la met à jour comme le reste du classeur.':
        '• A “Summary” page opens the workbook. It contains no typed value: every figure is a formula pointing at the detail sheets, and the scenario switch in Inputs C70 updates it like the rest of the workbook.',
    '• Vérifié après la bascule : le contrôle du bilan (rangée 76) reste à zéro sur les 48 mois, et aucune cellule des feuilles visibles ne rend d’erreur, dans l’un comme dans l’autre scénario.':
        '• Verified after the switch: the balance sheet control (row 76) stays at zero across all 48 months, and no cell on the visible sheets returns an error, in either scenario.',
    '• Défaut découvert par la bascule de juillet, et corrigé (fix_au.py) : le premier mois projeté ouvrait sur des soldes d’ancrage plutôt que sur le réel du mois précédent. Le bilan d’août lisait l’échéancier de dette — 202 609 $ d’emprunt Shopify là où QuickBooks en montre 186 437 $ au 31 juillet — et le modèle lisait la différence comme un encaissement. Avec Merchant Growth, 56 596 $ de liquidités que personne n’a avancées.':
        '• Defect uncovered by the July switch, and corrected (fix_au.py): the first forecast month opened on anchor balances rather than on the previous month’s actuals. The August balance sheet read the debt schedule — $202,609 of Shopify borrowing where QuickBooks shows $186,437 at 31 July — and the model read the difference as a cash receipt. With Merchant Growth, $56,596 of cash that nobody advanced.',
    '• Même mécanique au fonds de roulement : les produits finis passaient de 131 594 $ (réel de juillet) à 63 814 $ (l’an dernier majoré de 10 %), soit 67 780 $ d’encaissement en un mois sur un stock qui n’a pas bougé. Août ouvre désormais sur le solde réel de juillet et applique le mouvement prévu par le modèle : le niveau vient du réel, la variation vient du modèle.':
        '• Same mechanism in working capital: finished goods went from $131,594 (July actual) to $63,814 (last year plus 10%), $67,780 of cash in one month on inventory that had not moved. August now opens on July’s actual balance and applies the movement the model forecasts: the level comes from the actuals, the change comes from the model.',
    '• Conséquence, et c’est le point : le tirage de marge de crédit au 31 août 2026 passe de 25 248 $ à 131 134 $. Les 106 000 $ d’écart n’étaient pas une prévision, c’était l’artefact de la frontière. Le contrôle d’Inputs (rangée 166) balayait de septembre 2026 à août 2029 et sautait donc août 2026, le mois du sommet ; il part maintenant d’août 2026.':
        '• The consequence, and this is the point: the credit line drawn at 31 August 2026 goes from $25,248 to $131,134. The $106,000 gap was not a forecast, it was the artefact of the boundary. The Inputs control (row 166) swept September 2026 to August 2029 and therefore skipped August 2026, the peak month; it now starts at August 2026.',
    '• Ce qui reste ancré, sciemment : frais payés d’avance (bilan rangée 8), taxes à payer (35), cartes cadeaux (37), comptes à recevoir (7). Les écarts y sont de quelques milliers de dollars et leurs chaînes de 2026-2027 partent de la colonne d’août : les rebaser créerait une cassure en septembre pour corriger une broutille en août.':
        '• What is deliberately left anchored: prepaid expenses (balance sheet row 8), taxes payable (35), gift cards (37), accounts receivable (7). The gaps there are a few thousand dollars and their 2026-2027 chains start from the August column: rebasing them would create a break in September to fix a trifle in August.',
    '• À trancher avec Gabriel : QuickBooks porte 3 678 $ d’avance de l’actionnaire au 31 juillet 2026. Le modèle porte le solde à 80 000 $ au 15 août par l’entente, sans les additionner. Si les deux montants coexistent, le bilan d’août sous-estime la dette de 3 678 $.':
        '• To be settled with Gabriel: QuickBooks carries $3,678 of shareholder advance at 31 July 2026. The model brings the balance to $80,000 on 15 August under the agreement, without adding the two. If both amounts coexist, the August balance sheet understates the debt by $3,678.',
    '• Constat de clôture, scénario conservateur : 2025-2026 se referme sur 977 339 $ de ventes nettes et -122 613 $ avant impôts, dont onze mois réels. La marge de crédit demandée culmine à 143 026 $ — le réel du 31 juillet 2026 — et le sommet projeté atteint 141 878 $ en août 2027, le creux saisonnier d’avant-saison deux fois de suite. C’est le chiffre du dossier : la limite autorisée de 130 000 $ ne suffit pas, il en faut 150 000 $.':
        '• Closing observation, conservative scenario: 2025-2026 closes at $977,339 of net sales and −$122,613 before tax, of which eleven months are actual. The credit line requested peaks at $143,026 — the 31 July 2026 actual — and the forecast peak reaches $141,878 in August 2027, the pre-season trough two years running. That is the figure for the file: the $130,000 authorised limit is not enough, $150,000 is needed.',

    # ------------------------------------------------ avance de l'actionnaire
    '• Tranché avec Gabriel : les 3 678 $ d’avance de l’actionnaire inscrits chez QuickBooks au 31 juillet 2026 s’ajoutent aux 80 000 $ de l’entente du 15 août, ils ne sont pas remplacés par eux. Le solde du 31 août 2026 passe de 80 000 $ à 83 678 $. L’échéancier de l’entente reste douze versements égaux de septembre 2026 à août 2027, mais il s’arrête sur le solde préexistant au lieu de zéro, et ce solde reste au bilan jusqu’en août 2029 : le laisser tomber ferait sortir 3 678 $ de la caisse pour un remboursement que personne n’a décidé. Les 3 678 $ ne portent pas d’intérêt — l’entente fixe 8 % sur son propre capital.':
        '• Settled with Gabriel: the $3,678 of shareholder advance booked in QuickBooks at 31 July 2026 is ADDED to the $80,000 of the 15 August agreement, not replaced by it. The balance at 31 August 2026 goes from $80,000 to $83,678. The agreement’s schedule stays twelve equal instalments from September 2026 to August 2027, but it stops at the pre-existing balance instead of zero, and that balance stays on the balance sheet through August 2029: letting it drop would take $3,678 out of cash for a repayment nobody decided. The $3,678 bears no interest — the agreement sets 8% on its own principal.',
    'Remboursée de septembre 2026 à août 2027. Intérêt sur le solde décroissant ; demi-mois en août 2026, l’argent arrivant le 15. Un prêteur à terme exigera très probablement une convention de postposition : l’avance serait alors gelée et l’échéancier ci-dessous repoussé d’autant. S’ajoute aux 3 678 $ d’avance déjà inscrits au 31 juillet 2026 : le solde du 31 août 2026 est donc de 83 678 $. Ces 3 678 $ ne portent pas d’intérêt et n’ont pas d’échéance ; ils restent au bilan sur tout l’horizon.':
        'Repaid from September 2026 to August 2027. Interest on the declining balance; half a month in August 2026, the money arriving on the 15th. A term lender will very likely require a postponement agreement: the advance would then be frozen and the schedule below pushed back accordingly. It is added to the $3,678 of advance already booked at 31 July 2026: the balance at 31 August 2026 is therefore $83,678. That $3,678 bears no interest and has no maturity; it stays on the balance sheet across the whole horizon.',
    '• Vérifié après toutes les corrections : le contrôle du bilan (rangée 76) reste à zéro sur les 48 mois, dans le scénario conservateur comme dans l’ambitieux, et aucune cellule des feuilles visibles ne rend d’erreur. Le résultat avant impôts de juillet 2026 tombe au cent près sur le PROFIT de QuickBooks.':
        '• Verified after every correction: the balance sheet control (row 76) stays at zero across all 48 months, in the conservative scenario as in the ambitious one, and no cell on the visible sheets returns an error. July 2026’s pre-tax result lands on QuickBooks’ PROFIT to the cent.',

    # --------------------------------------------------- notes d'Inputs
    'Le sommet est juillet 2026, et c’est du réel : la marge EDC était tirée à 143 026 $ au 31 juillet, au-dessus de la limite de 130 000 $ retenue pour les mois projetés.':
        'The peak is July 2026, and it is actual: the EDC line was drawn at $143,026 at 31 July, above the $130,000 limit assumed for the forecast months.',
    'Août 2026 à août 2029. Août 2026 est le premier mois projeté : le réel du modèle s’arrête au 31 juillet.':
        'August 2026 to August 2029. August 2026 is the first forecast month: the model’s actuals stop at 31 July.',
    'Le dépassement est réel, pas une erreur de formule : la marge EDC était déjà tirée à 143 026 $ au 31 juillet 2026. C’est le besoin de financement que le modèle est censé montrer.':
        'The overrun is real, not a formula error: the EDC line was already drawn at $143,026 at 31 July 2026. That is the financing need the model is meant to show.',
}
