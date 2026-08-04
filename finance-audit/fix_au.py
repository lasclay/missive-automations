#!/usr/bin/env python3
"""Phase AU — le premier mois projeté doit ouvrir sur le dernier mois réel.

Basculer juillet au réel a mis au jour un défaut que la frontière précédente
cachait : **août ouvrait sur des soldes d'ancrage, pas sur ceux de juillet.**

Le cas le plus net est la dette. Le bilan d'août lisait l'échéancier
(« Dette à long terme », colonne AW), dont les soldes avaient été saisis à la
main des mois plus tôt. QuickBooks dit 186 437 $ d'emprunt Shopify au
31 juillet ; l'échéancier disait 202 609 $. Le modèle lisait la différence
comme un **encaissement** : 16 172 $ d'argent frais qu'aucun prêteur n'a
avancés. Même mécanique sur Merchant Growth, 40 424 $. Au total 56 596 $ de
liquidités inventées en un mois, qui venaient réduire d'autant le tirage de
marge de crédit affiché au 31 août — c'est-à-dire précisément le chiffre qu'un
bailleur regarde.

Le même défaut jouait sur le fonds de roulement : les produits finis passaient
de 131 594 $ (réel de juillet) à 63 814 $ (l'an dernier majoré de 10 %), soit
67 780 $ d'encaissement en un mois sur un stock qui n'a pas bougé.

## La règle appliquée

Août ouvre sur le solde réel de juillet, puis applique le mouvement que le
modèle prévoit pour le mois. Le niveau vient du réel, la variation vient du
modèle. Aucune des deux sources n'est écartée.

Ça ne déplace pas le problème à septembre : les colonnes de 2026-2027 sont
ancrées soit sur septembre 2025 (les postes de fonds de roulement, indexés à la
croissance), soit sur la colonne d'août elle-même (les échéanciers de dette,
`BA3 = AW3 - BA16`). La correction se propage donc dans le bon sens.

## Ce qui est laissé tel quel, et pourquoi

Les frais payés d'avance (bilan rangée 8), les taxes à payer (35), les cartes
cadeaux (37) et les comptes à recevoir (7) gardent leur ancrage. Les écarts y
sont de quelques milliers de dollars, et leurs chaînes de 2026-2027 partent de
la colonne d'août : les rebaser créerait une cassure en septembre pour corriger
une broutille en août. L'avance de l'actionnaire (47) est portée à 80 000 $ par
l'entente, sans s'ajouter aux 3 678 $ déjà inscrits ; l'écart est signalé au
journal plutôt que corrigé, parce que c'est une question de fait à trancher
avec Gabriel, pas de modélisation.

    python3 fix_au.py
"""
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
BIL = "'Bilan2026-27-28'"

# Échéanciers : le solde d'août = le réel de juillet moins le remboursement
# du mois. La rangée de remboursement est celle que l'échéancier utilisait
# déjà pour enchaîner ses propres colonnes.
DETTE = [
    ('AW3', 'N48', 'AW16', 'Emprunt Shopify'),
    ('AW4', 'N52', 'AW20', 'Prêt accord D 004'),
    ('AW5', 'N53', 'AW21', 'Prêt BDC FDR'),
    ('AW6', 'N54', 'AW22', 'Prêt BDC 18K'),
    ('AW7', 'N55', 'AW23', 'Prêt BDC 10K'),
    ('AW10', 'N58', 'AW26', 'Merchant Growth Capital'),
]

# Fonds de roulement : le niveau vient de juillet, la variation du modèle.
ROULEMENT = [
    ('O11', f'=N11-\'Account payable\'!AQ36', 'Inventaire matières premières'),
    ('O13', '=N13', 'Inventaire produits finis'),
    ('O32', '=N32', 'Cartes de crédit'),
    ('O33', "=N33+('Account payable'!AQ9-'Account payable'!AP9)",
     'Comptes à payer'),
]


def build(dst=F, src=F):
    avant = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()

    for cible, reel, remb, quoi in DETTE:
        e.set('Dette à long terme', cible, f'={BIL}!{reel}-{remb}', quoi)
    # L'intérêt de Merchant Growth se calcule sur le solde du mois précédent :
    # il doit lui aussi partir du réel, sinon le remboursement d'août (qui est
    # « 6 368 $ moins l'intérêt ») est calculé sur un solde qui n'existe pas.
    e.set('Dette à long terme', 'AW41', f'=0.1566*{BIL}!N58/12',
          'Intérêts Merchant Growth, sur le solde réel de juillet')

    for cible, formule, quoi in ROULEMENT:
        e.set('Bilan2026-27-28', cible, formule, quoi)

    e.set_full_calc()
    e.save(dst)

    apres = xlcalc.load(dst)
    S = 'Résultats-Prev 2025-2029'
    out = ['financement d’août 2026 — ce que le modèle disait encaisser :']
    for r, quoi in ((174, 'Emprunt Shopify'), (178, 'Merchant Growth'),
                    (181, 'Total financement')):
        out.append(f'  {quoi:<26} {avant.get(S, f"O{r}"):>12,.0f} → '
                   f'{apres.get(S, f"O{r}"):>12,.0f}')
    out.append('fonds de roulement et trésorerie :')
    for r, quoi in ((154, 'Variation produits finis'),
                    (165, 'Total fonds de roulement'),
                    (184, 'Variation des liquidités'),
                    (183, 'Marge de crédit tirée au 31 août'),
                    (189, 'Encaisse au 31 août')):
        out.append(f'  {quoi:<26} {avant.get(S, f"O{r}"):>12,.0f} → '
                   f'{apres.get(S, f"O{r}"):>12,.0f}')
    out.append(f'contrôle du bilan, août : '
               f'{apres.get("Bilan2026-27-28", "O76"):.6f}')
    return out


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
