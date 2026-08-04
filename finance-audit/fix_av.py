#!/usr/bin/env python3
"""Phase AV — le contrôle de la marge de crédit doit compter août 2026.

« Tirage le plus élevé des mois projetés » balayait de septembre 2026 à août
2029. C'était juste tant que l'exercice 2025-2026 était réel de bout en bout.
Il ne l'est plus : août 2026 est le **premier** mois projeté, et c'est celui
où le tirage culmine. Le contrôle sautait donc exactement le mois qu'il devait
surveiller, et affichait zéro dépassement.

    python3 fix_av.py
"""
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
R = "'Résultats-Prev 2025-2029'"


def build(dst=F, src=F):
    avant = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()

    ancienne = avant.formulas['Inputs']['D166']
    e.set('Inputs', 'D166', f'=MAX({R}!O183,{ancienne[4:]}',
          'Le tirage projeté inclut août 2026, premier mois projeté')
    e.set('Inputs', 'E166', 'Août 2026 à août 2029. Août 2026 est le premier '
                            'mois projeté : le réel du modèle s’arrête au '
                            '31 juillet.')
    e.set('Inputs', 'E167', 'Le dépassement est réel, pas une erreur de '
                            'formule : la marge EDC était déjà tirée à '
                            '143 026 $ au 31 juillet 2026. C’est le besoin de '
                            'financement que le modèle est censé montrer.')

    journal(e)
    e.set_full_calc()
    e.save(dst)

    apres = xlcalc.load(dst)
    return [f'  tirage projeté le plus élevé  '
            f'{avant.get("Inputs", "D166"):>12,.0f} → '
            f'{apres.get("Inputs", "D166"):>12,.0f}',
            f'  dépassement de la limite      '
            f'{avant.get("Inputs", "D167"):>12,.0f} → '
            f'{apres.get("Inputs", "D167"):>12,.0f}']


def journal(e):
    J = 'Notes d’audit'
    r = 69
    for texte in (
        '• Défaut découvert par la bascule de juillet, et corrigé (fix_au.py) : '
        'le premier mois projeté ouvrait sur des soldes d’ancrage plutôt que '
        'sur le réel du mois précédent. Le bilan d’août lisait l’échéancier de '
        'dette — 202 609 $ d’emprunt Shopify là où QuickBooks en montre '
        '186 437 $ au 31 juillet — et le modèle lisait la différence comme un '
        'encaissement. Avec Merchant Growth, 56 596 $ de liquidités que '
        'personne n’a avancées.',
        '• Même mécanique au fonds de roulement : les produits finis passaient '
        'de 131 594 $ (réel de juillet) à 63 814 $ (l’an dernier majoré de '
        '10 %), soit 67 780 $ d’encaissement en un mois sur un stock qui n’a '
        'pas bougé. Août ouvre désormais sur le solde réel de juillet et '
        'applique le mouvement prévu par le modèle : le niveau vient du réel, '
        'la variation vient du modèle.',
        '• Conséquence, et c’est le point : le tirage de marge de crédit au '
        '31 août 2026 passe de 25 248 $ à 134 812 $. Les 110 000 $ d’écart '
        'n’étaient pas une prévision, c’était l’artefact de la frontière. Le '
        'contrôle d’Inputs (rangée 166) balayait de septembre 2026 à août 2029 '
        'et sautait donc août 2026, le mois du sommet ; il part maintenant '
        'd’août 2026.',
        '• Ce qui reste ancré, sciemment : frais payés d’avance (bilan rangée '
        '8), taxes à payer (35), cartes cadeaux (37), comptes à recevoir (7). '
        'Les écarts y sont de quelques milliers de dollars et leurs chaînes de '
        '2026-2027 partent de la colonne d’août : les rebaser créerait une '
        'cassure en septembre pour corriger une broutille en août.',
        '• À trancher avec Gabriel : QuickBooks porte 3 678 $ d’avance de '
        'l’actionnaire au 31 juillet 2026. Le modèle porte le solde à 80 000 $ '
        'au 15 août par l’entente, sans les additionner. Si les deux montants '
        'coexistent, le bilan d’août sous-estime la dette de 3 678 $.',
    ):
        e.set(J, f'A{r}', texte)
        r += 1


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
