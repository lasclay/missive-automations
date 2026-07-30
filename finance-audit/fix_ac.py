#!/usr/bin/env python3
"""Phase AC — mettre au dossier le fait le plus convaincant qu'il contient.

Les ventes de juin et juillet 2026 se sont effondrées. Un prêteur va le voir
avant de lire quoi que ce soit d'autre, et il va supposer un problème de demande.
Ce n'en est pas un, et le classeur a de quoi le prouver ligne par ligne :

- la publicité numérique du réel QuickBooks passe de 32 756 $ en mars à 6 388 $
  en avril, 1 484 $ en juin, puis ZÉRO en juillet et août ;
- les commandes Shopify suivent trois semaines plus tard : 968 en mai, 71 en
  juin, 40 en juillet ;
- l'année précédente, les mêmes mois faisaient 1 272 et 672 commandes. Ce n'est
  donc pas la saison ;
- et l'exercice reste malgré tout à +3,5 % sur le budget qui avait été posé.

Autrement dit : la publicité s'est arrêtée faute de trésorerie, et les ventes se
sont arrêtées avec elle. C'est exactement ce que le refinancement corrige.
"""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

SOM = 'Sommaire bailleurs'
PNL = 'Résultats-Prev 2025-2029'
F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'

# publicité numérique réelle (résultat l. 78) et commandes Shopify, par mois
EVIDENCE = [
    ('', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet'),
    ('Publicité numérique (QuickBooks, l. 78)', 32756, 6388, 7688, 1484, 0),
    ('Commandes Shopify', 1276, 764, 968, 71, 40),
    ('Commandes aux mêmes mois de FY2025', 1450, 2193, 2314, 1272, 672),
    ('Ventes nettes (QuickBooks)', 53210, 42531, 82783, 9054, 2535),
]
PROSE = [
    'La publicité s’est arrêtée faute de trésorerie — Shopify Capital prélevait 28,75 % des',
    'ventes quotidiennes — et les ventes se sont arrêtées avec elle, à trois semaines de',
    'décalage. Les mêmes mois de l’exercice précédent avaient fait 1 272 et 672 commandes :',
    'ce n’est pas la saison, et ce n’est pas la demande. Le taux de conversion tombe de',
    '3,58 % en mai à 0,58 % en juin, pendant que les sessions passent de 25 333 à 10 392.',
    'C’est un problème de fonds de roulement, et c’est précisément ce que le refinancement',
    'de 460 000 $ corrige : solder le capital marchand libère la trésorerie qui achetait la',
    'publicité et le stock. Novembre et décembre 2025, financés, avaient fait +73 % et',
    '+135 % sur l’année précédente.',
]


def build(dst=F, src=F):
    e = Editor(src)
    e.expand_shared()

    # le réel de l'exercice contre le budget qui avait été posé
    e.set(SOM, 'C65', 'Budget posé pour le même exercice')
    e.set(SOM, 'D65', f"='{PNL}'!P5")

    r = 137
    e.set(SOM, f'A{r}', '10. CE QUI S’EST PASSÉ EN JUIN ET JUILLET 2026')
    r += 1
    for line in EVIDENCE:
        for i, val in enumerate(line):
            col = chr(ord('A') + i)
            if val != '':
                e.set(SOM, f'{col}{r}', float(val) if isinstance(val, int) else val)
        r += 1
    r += 1
    for txt in PROSE:
        e.set(SOM, f'A{r}', txt)
        r += 1
    e.set_full_calc()
    e.save(dst)
    return e, r - 1


if __name__ == '__main__':
    import xlcalc
    e, last = build()
    print(f'{len(e.log)} écritures, jusqu’à la rangée {last}')
    B = xlcalc.load(F)
    reel, budget = B.get(PNL, 'P3'), B.get(PNL, 'P5')
    print(f'réel FY2026 {reel:,.0f} $ | budget {budget:,.0f} $ | {reel / budget - 1:+.1%}')
