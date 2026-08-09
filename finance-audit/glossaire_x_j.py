# -*- coding: utf-8 -*-
"""Glossaire du chiffrier, partie J — la mise à jour RS&DE d'août 2026.

Le bloc d'hypothèses des rangées 169 à 186 d'Inputs et les entrées de journal
qui l'expliquent.
"""

GLOSSAIRE = {
    '• RS&DE 2025-2026, corrigé : le classeur portait 73 865 $, soit 55 % du salaire de deux personnes (Inputs C42 = C39×1,175 + C41×1,11). Le relevé de dépenses v2026-08-08 donne une base admissible de 246 193 $ sur trois projets — 146 060 $ de salaires au coût réel, 81 388 $ de matériaux, 18 745 $ de sous-traitance — et un estimé de 130 345 $ par la formule du relevé. Le cas central retenu est 140 000 $, dans la fourchette 130 000 à 155 000 $. Écart sur l’exercice : +66 135 $, sans effet sur la trésorerie de 2026 (voir Inputs, rangées 169 à 186).':
        '• SR&ED 2025-2026, corrected: the workbook carried $73,865, i.e. 55% of two people’s salary (Inputs C42 = C39×1.175 + C41×1.11). The expenditure schedule v2026-08-08 gives an eligible base of $246,193 across three projects — $146,060 of salaries at actual cost, $81,388 of materials, $18,745 of subcontracting — and an estimate of $130,345 by the schedule’s formula. The central case retained is $140,000, within the $130,000 to $155,000 range. Difference for the year: +$66,135, with no effect on 2026 cash (see Inputs, rows 169 to 186).',

    '• Ce qui autorise le raccord : le relevé note que les comptes 6061 et 6065 du grand livre totalisent 109 014 $ et excluent les charges de l’employeur. La rangée 45 du résultat cumule 109 014,39 $ sur les onze mois réels. Le relevé et le chiffrier lisent la même comptabilité.':
        '• What makes the reconciliation possible: the schedule notes that general ledger accounts 6061 and 6065 total $109,014 and exclude employer charges. Row 45 of the income statement totals $109,014.39 over the eleven actual months. The schedule and the workbook read the same books.',

    '• Pourquoi l’estimé du relevé n’est pas pris comme plafond : sur trois exercices, l’encaissement a toujours dépassé l’estimé — +11,6 % en 2023, +43,5 % en 2024, +4,0 % en 2025. Le cas central applique une correction de 1,15 arrondie vers le bas, et absorbe les deux sensibilités connues : août 2026 n’est pas encore comptabilisé (+5 000 à +8 000 $) et le bloc JCC de 12 564 $ pourrait être refusé (-3 518 $).':
        '• Why the schedule’s estimate is not taken as a ceiling: over three years, collections have always exceeded the estimate — +11.6% in 2023, +43.5% in 2024, +4.0% in 2025. The central case applies a correction of 1.15 rounded down, and absorbs the two known sensitivities: August 2026 is not yet booked (+$5,000 to +$8,000) and the $12,564 JCC block could be refused (−$3,518).',

    '• Exercices projetés : le relevé propose 20 % des charges totales en base admissible, ce qui donnerait 171 000 $, 220 000 $ et 269 000 $ de crédit de 2027 à 2029. Le classeur ne le retient pas — ce ratio a été observé pendant que Lasclay fabriquait au Québec, et le modèle transfère l’assemblage à l’étranger, où les travaux ne sont pas admissibles. La formule du relevé est appliquée aux dépenses de R&D que le modèle budgète lui-même (rangées 45, 46, 47), salaires majorés du facteur 1,340 observé en 2026 : 103 318 $, 101 699 $ et 104 292 $.':
        '• Forecast years: the schedule proposes 20% of total charges as the eligible base, which would give $171,000, $220,000 and $269,000 of credit from 2027 to 2029. The workbook does not retain this — that ratio was observed while Lasclay manufactured in Quebec, and the model moves assembly abroad, where the work is not eligible. The schedule’s formula is applied to the R&D spending the model budgets itself (rows 45, 46, 47), with salaries grossed up by the 1.340 factor observed in 2026: $103,318, $101,699 and $104,292.',

    '• Calendrier d’encaissement, corrigé : le crédit était encaissé en un seul versement de mai. Les trois dernières réclamations sont arrivées en deux virements, Québec puis fédéral, et le délai s’allonge — 4,6 et 6,3 mois en 2023, 8,0 et 4,7 en 2024, 7,7 et 9,9 en 2025. Hypothèse retenue : 35 % en avril, 65 % en juin, rien avant mars. Le budget de caisse suit. La réclamation de 2025 encaissée en 2025-2026 était portée en mai en un bloc ; les livres montrent 31 277 $ le 21 avril et 67 080 $ le 26 juin.':
        '• Collection calendar, corrected: the credit was received as a single payment in May. The last three claims arrived as two transfers, Quebec then federal, and the delay is lengthening — 4.6 and 6.3 months in 2023, 8.0 and 4.7 in 2024, 7.7 and 9.9 in 2025. Assumption retained: 35% in April, 65% in June, nothing before March. The cash budget follows. The 2025 claim collected in 2025-2026 was carried in May as one block; the books show $31,277 on 21 April and $67,080 on 26 June.',

    '• Pertes fiscales reportables : Inputs C43 valait 151 649 $, une constante posée avant la révision. Elle devient une formule — pertes au 1er septembre 2025 (29 036 $) moins le résultat de 2025-2026 — pour qu’un exercice moins déficitaire laisse moins de pertes à reporter. L’impôt des exercices suivants suit.':
        '• Loss carryforwards: Inputs C43 was $151,649, a constant set before the revision. It becomes a formula — losses at 1 September 2025 ($29,036) less the 2025-2026 result — so that a less loss-making year leaves fewer losses to carry forward. The following years’ tax follows.',

    '• Signalé, non provisionné : 2 279 $ de crédits de taxe sur intrants ont été réclamés sur une facture de fret d’exportation détaxée. C’est une erreur de TPS/TVQ sans lien avec la RS&DE, laissée en l’état sur décision de la direction. Montant immatériel ; inscrit à Inputs D186 pour mémoire.':
        '• Flagged, not provided for: $2,279 of input tax credits were claimed on a zero-rated export freight invoice. This is a GST/QST error unrelated to SR&ED, left as is by management decision. Immaterial amount; recorded at Inputs D186 for the record.',

    'RSDE 2025-2026 — cas central du relevé de dépenses (voir le bloc de la rangée 169)':
        'SR&ED 2025-2026 — central case of the expenditure schedule (see the block at row 169)',

    'Pertes fiscales reportables fin 2025-2026 (calculées)':
        'Loss carryforwards at the end of 2025-2026 (calculated)',

    'RS&DE — relevé de dépenses 2026 (v2026-08-08), mise à jour du 9 août 2026':
        'SR&ED — 2026 expenditure schedule (v2026-08-08), update of 9 August 2026',

    'Remplace l’ancienne méthode « 55 % du salaire de deux personnes ». Sources : relevé de dépenses RS&DE 2026, QuickBooks au 5 août 2026, compte 1250 pour l’historique d’encaissement.':
        'Replaces the former “55% of two people’s salary” method. Sources: 2026 SR&ED expenditure schedule, QuickBooks as at 5 August 2026, account 1250 for the collection history.',

    'Base admissible 2025-2026 — salaires au coût réel ($)':
        'Eligible base 2025-2026 — salaries at actual cost ($)',

    'Brut assurable reconstitué paie par paie, majoré des charges de l’employeur, sur trois projets. Réconcilié au grand livre à 756 $ près sur 24 périodes.':
        'Insurable gross reconstructed pay period by pay period, grossed up for employer charges, across three projects. Reconciled to the general ledger within $756 over 24 periods.',

    'Base admissible 2025-2026 — matériaux ($)':
        'Eligible base 2025-2026 — materials ($)',

    'Eko-Terre 42 195 $ (8 factures, bons de commande), semences 12 600 $, parts conventionnelles 9 800 $ (Fibra MR à 50 %, tissu et fret à 17 %), reste sur pièces.':
        'Eko-Terre $42,195 (8 invoices, purchase orders), seeds $12,600, conventional shares $9,800 (Fibra MR at 50%, fabric and freight at 17%), the rest on supporting documents.',

    'Base admissible 2025-2026 — sous-traitance ($)':
        'Eligible base 2025-2026 — subcontracting ($)',

    'Dont 12 564 $ pour JCC, dont les factures décrivent de la production à la pièce : c’est le bloc le plus fragile de la réclamation.':
        'Including $12,564 for JCC, whose invoices describe piece-rate production: it is the most fragile block of the claim.',

    'Base admissible totale 2025-2026 ($)':
        'Total eligible base 2025-2026 ($)',

    'Contre 184 797 $ en 2024-2025 et 125 140 $ en 2023-2024.':
        'Against $184,797 in 2024-2025 and $125,140 in 2023-2024.',

    'Taux appliqué aux salaires et aux matériaux':
        'Rate applied to salaries and materials',

    'Fédéral et Québec combinés sur une base majorée par la méthode de remplacement.':
        'Federal and Quebec combined on a base grossed up by the replacement method.',

    'Taux appliqué à la sous-traitance':
        'Rate applied to subcontracting',

    'Les contrats sans lien de dépendance n’entrent au compte de dépenses admissibles qu’à 80 %.':
        'Arm’s-length contracts enter the eligible expenditure pool at only 80%.',

    'Estimé selon la formule du relevé ($)':
        'Estimate by the schedule’s formula ($)',

    'La reproduction exacte de la colonne « estimé remboursement » des relevés des années précédentes. Ce n’est pas un calcul d’impôt.':
        'The exact reproduction of the “estimated refund” column of prior years’ schedules. It is not a tax computation.',

    'Correction du biais historique (encaissé / estimé)':
        'Correction for historical bias (collected / estimated)',

    'Trois exercices sur trois, l’encaissement a dépassé l’estimé : +11,6 % en 2023, +43,5 % en 2024, +4,0 % en 2025.':
        'Three years out of three, collections exceeded the estimate: +11.6% in 2023, +43.5% in 2024, +4.0% in 2025.',

    'Estimé corrigé du biais ($)':
        'Estimate corrected for bias ($)',

    'Le ratio encaissé / base admissible, médiane 54,2 %, donne 133 400 $ par un autre chemin. La fourchette à modéliser est 130 000 à 155 000 $.':
        'The collected / eligible base ratio, median 54.2%, gives $133,400 by another route. The range to model is $130,000 to $155,000.',

    'Crédit 2025-2026 retenu — cas central ($)':
        'Credit 2025-2026 retained — central case ($)',

    'Constaté au 31 août 2026, encaissé en 2027. Absorbe les deux sensibilités connues : août 2026 non comptabilisé (+5 000 à +8 000 $) et quatre pièces manquantes (-1 550 $).':
        'Recognised at 31 August 2026, collected in 2027. Absorbs the two known sensitivities: August 2026 not yet booked (+$5,000 to +$8,000) and four missing supporting documents (−$1,550).',

    'Scénario défavorable — bloc JCC refusé ($)':
        'Downside scenario — JCC block refused ($)',

    'La base tomberait à 233 629 $. Écart de 3 518 $, soit 2,7 % du crédit : le risque financier direct est faible, le vrai risque est qu’un refus sur JCC entraîne un examen plus large.':
        'The base would fall to $233,629. A difference of $3,518, i.e. 2.7% of the credit: the direct financial risk is small, the real risk is that a refusal on JCC triggers a broader review.',

    'Part fédérale de l’encaissement':
        'Federal share of the collection',

    'Observé : 62 % en 2024, 68 % en 2025. Le fédéral arrive en juin dans l’hypothèse retenue (délai de 10 mois après la clôture).':
        'Observed: 62% in 2024, 68% in 2025. The federal payment arrives in June under the assumption retained (10-month delay after year end).',

    'Part québécoise de l’encaissement':
        'Quebec share of the collection',

    'Le Québec arrive en avril (délai de 8 mois). Rien n’est encaissé avant mars. Scénario prudent, non modélisé : tout glisser d’un trimestre.':
        'Quebec arrives in April (8-month delay). Nothing is collected before March. Prudent scenario, not modelled: slide everything by one quarter.',

    'Salaires de R&D aux comptes 6061 et 6065, 2025-2026 ($)':
        'R&D salaries in accounts 6061 and 6065, 2025-2026 ($)',

    'Le relevé et la rangée 45 du résultat donnent le même montant sur les onze mois réels — 109 014,39 $. C’est le point de raccord entre les deux documents.':
        'The schedule and row 45 of the income statement give the same amount over the eleven actual months — $109,014.39. It is the point where the two documents join.',

    'Facteur coût réel pour l’entreprise / solde du grand livre':
        'Factor: actual cost to the company / general ledger balance',

    'Majore les seuls salaires des exercices projetés. Les matériaux ne sont pas majorés : la réaffectation de 2026 venait de la production québécoise, que le modèle transfère à l’étranger.':
        'Grosses up salaries only, for the forecast years. Materials are not grossed up: the 2026 reallocation came from Quebec production, which the model moves abroad.',

    'Pertes fiscales reportables au 1er septembre 2025 ($)':
        'Loss carryforwards at 1 September 2025 ($)',

    'L’estimé du comptable de 151 649 $ moins la perte de 2025-2026 telle qu’elle était alors (122 613 $). Sert de point de départ à C43.':
        'The accountant’s estimate of $151,649 less the 2025-2026 loss as it stood then ($122,613). Serves as the starting point for C43.',

    'Réserve fiscale hors RS&DE — CTI sur du fret détaxé ($)':
        'Tax reserve outside SR&ED — ITCs on zero-rated freight ($)',

    'Crédits de taxe sur intrants réclamés sur une facture de fret d’exportation détaxée. Erreur de TPS/TVQ sans lien avec la RS&DE, laissée en l’état sur décision de la direction ; non provisionnée au modèle, montant immatériel.':
        'Input tax credits claimed on a zero-rated export freight invoice. A GST/QST error unrelated to SR&ED, left as is by management decision; not provided for in the model, immaterial amount.',

}
