# -*- coding: utf-8 -*-
"""Glossaire du chiffrier, partie L — le budget de caisse complété."""

GLOSSAIRE = {
    'Impôts sur le bénéfice versés': 'Income taxes paid',

    'Variation du fonds de roulement : fournisseurs, charges à payer, cartes de '
    'crédit, taxes de vente, frais payés d’avance':
        'Change in working capital: suppliers, accrued liabilities, credit '
        'cards, sales taxes, prepaid expenses',

    'CONTRÔLE — vue directe moins chaîne de trésorerie du résultat':
        'CONTROL — direct view less the income statement’s cash chain',

    'Zéro sur les mois projetés : les deux vues décrivent la même entreprise et '
    'doivent donner le même nombre. La rangée vérifie que la présentation '
    'directe est complète, et non que deux estimations indépendantes '
    'concordent — le classeur n’a qu’une source de données. Les mois réels '
    'gardent leur écart : ils portent l’ajustement de calendrier BMB, que le '
    'bilan ne reflète pas.':
        'Zero on the forecast months: both views describe the same company and '
        'must give the same number. The row checks that the direct presentation '
        'is complete, not that two independent estimates agree — the workbook '
        'has a single data source. The actual months keep their gap: they carry '
        'the BMB timing adjustment, which the balance sheet does not reflect.',

    '• Budget de caisse, contrôle ramené à zéro sur les 36 mois projetés. La vue '
    'directe des rangées 12 à 32 s’écartait de la chaîne de trésorerie du '
    'résultat de -105 340 $ à +67 136 $ selon les mois, et le journal '
    'qualifiait cet écart d’« attendu ». Il ne l’était pas : deux méthodes de '
    'flux de trésorerie qui décrivent la même entreprise doivent donner le même '
    'nombre. Le résidu se décomposait en quatre morceaux : les impôts versés, '
    'cinq postes de fonds de roulement (fournisseurs, frais courus, cartes de '
    'crédit, taxes de vente, frais payés d’avance), et l’ajustement de '
    'calendrier BMB.':
        '• Cash budget, control brought to zero across the 36 forecast months. '
        'The direct view in rows 12 to 32 differed from the income statement’s '
        'cash chain by -$105,340 to +$67,136 depending on the month, and the '
        'log called that gap “expected”. It was not: two cash flow methods '
        'describing the same company must give the same number. The residual '
        'broke down into four pieces: taxes paid, five working capital items '
        '(suppliers, accrued liabilities, credit cards, sales taxes, prepaid '
        'expenses), and the BMB timing adjustment.',

    '• Ce qui a été fait : la rangée 27 porte les impôts réellement versés '
    '(charge moins variation du passif), la rangée 29 porte les sept postes de '
    'fonds de roulement que la vue directe ignorait, et l’ajustement BMB de la '
    'rangée 25 est retiré des mois projetés — il décalait la sous-traitance '
    'sans qu’aucun acompte fournisseur n’apparaisse au bilan en contrepartie. '
    'Les colonnes réelles ne sont pas touchées : le bilan d’août 2026 lit '
    '« Account payable », qui lit les rangées 18, 26 et 30 du budget de caisse '
    'de ce mois-là.':
        '• What was done: row 27 carries taxes actually paid (charge less the '
        'change in the liability), row 29 carries the seven working capital '
        'items the direct view ignored, and the BMB adjustment in row 25 is '
        'removed from the forecast months — it shifted subcontracting without '
        'any supplier deposit appearing on the balance sheet in return. The '
        'actual columns are untouched: the August 2026 balance sheet reads '
        '“Accounts payable”, which itself reads rows 18, 26 and 30 of that '
        'month’s cash budget.',

    '• Ce que la rangée 36 mesure désormais : que la présentation directe est '
    'complète, pas que deux estimations indépendantes concordent. Le classeur '
    'n’a qu’une source de données ; il ne peut pas produire deux lectures '
    'vraiment indépendantes. Le jour où un poste est ajouté au résultat sans '
    'être porté à la caisse, la rangée le dit.':
        '• What row 36 measures now: that the direct presentation is complete, '
        'not that two independent estimates agree. The workbook has a single '
        'data source; it cannot produce two genuinely independent readings. The '
        'day an item is added to the income statement without being carried to '
        'the cash budget, the row says so.',
}
