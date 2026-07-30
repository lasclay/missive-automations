#!/usr/bin/env python3
"""Phase AH — le sommaire raconte le nouveau plan.

Deux scénarios remplacent le couple base/prudent : conservateur réaliste pour les
bailleurs institutionnels, ambitieux pour l'investisseur privé. Et le canal
détail, qui est le cœur du plan, avait besoin de sa propre section : un prêteur
ne signera pas une trajectoire qui double en trois ans sans voir les pilotes.

Le point dur du dossier a changé de nature, et il faut le dire honnêtement. La
couverture du service de la dette passe le seuil de 1,25 dès FY2028 en scénario
conservateur, et les capitaux propres redeviennent positifs la même année. Le
risque n'est plus la capacité de payer : c'est l'exécution du déploiement détail,
qui n'a pas encore commencé.
"""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
SOM = 'Sommaire bailleurs'
PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
INP = 'Inputs'
TOTS = ('P', 'AD', 'AR', 'BF')
YEAREND = ('O', 'AC', 'AQ', 'BE')


def fr(x, dec=0):
    return f'{x:,.{dec}f}'.replace(',', ' ').replace('.', ',')


def snapshot(path):
    """Relève les chiffres d'un scénario déjà basculé."""
    bk = xlcalc.load(path)
    g = lambda sh, a: bk.get(sh, a)
    return {
        'ventes': [g(PNL, t + '26') for t in TOTS],
        'detail': [g(PNL, t + '12') for t in TOTS],
        'pdv': [g(PNL, t + '13') for t in TOTS],
        'cmv': [g(PNL, t + '33') for t in TOTS],
        'pai': [g(PNL, t + '137') for t in TOTS],
        'hors': [g(PNL, t + '141') for t in TOTS],
        'ebitda': [g(PNL, t + '145') for t in TOTS],
        'marge': [g(SOM, c + '49') for c in 'B'],
        'equity': [g(BIL, c + '70') for c in YEAREND],
        'dscr': [g(SOM, c + '102') for c in 'BCDE'],
        'tirage': [g(SOM, 'B49')],
        'consig': [g(BIL, c + '84') for c in YEAREND],
    }


def build(cons, amb, dst=F, src=F):
    e = Editor(src)
    e.expand_shared()

    e.set(SOM, 'C3', '← piloté par Inputs!C70 (1 = conservateur réaliste, 2 = ambitieux)')
    e.set(SOM, 'B3', '=IF(Inputs!$C$70=2,"AMBITIEUX","CONSERVATEUR RÉALISTE")')
    e.set(SOM, 'A4', 'Deux versions du même modèle. Le canal détail, nouveau dans ce plan, '
                     'est détaillé à la section 11.')

    # --- section 2 : le scénario ambitieux --------------------------------
    e.set(SOM, 'A30', '2. SCÉNARIO AMBITIEUX (Inputs!C70 = 2)')
    e.set(SOM, 'A31', 'Le déploiement détail va au bout de son plan — 20, 48 puis 85 points de '
                      'vente — et le web croît au rythme des deux exercices financés.')
    rows = [('Ventes nettes', 'ventes'), ('  dont ventes au détail', 'detail'),
            ('Points de vente au 31 août', 'pdv'),
            ('Coût des marchandises vendues', 'cmv'),
            ('Résultat avant impôts', 'pai'),
            ('Résultat avant impôts — hors aides', 'hors'),
            ('EBITDA', 'ebitda')]
    r = 32
    for lab, key in rows:
        e.set(SOM, f'A{r}', lab)
        for c, v in zip('BCDE', amb[key]):
            e.set(SOM, f'{c}{r}', round(v, 2))
        r += 1
    e.set(SOM, f'A{r}', 'Couverture du service de la dette')
    for c, v in zip('BCDE', amb['dscr']):
        e.set(SOM, f'{c}{r}', round(v, 2))
    r += 1
    e.set(SOM, f'A{r}', 'Capitaux propres au 31 août')
    for c, v in zip('BCDE', amb['equity']):
        e.set(SOM, f'{c}{r}', round(v, 2))
    for rr in range(r + 1, 40):
        for c in 'ABCDE':
            e.set(SOM, f'{c}{rr}', None)

    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    from xledit import Editor as Ed
    # relever les deux scénarios sans toucher au fichier livré
    for s in (1, 2):
        x = Ed(F); x.expand_shared(); x.set(INP, 'C70', float(s)); x.save(f'snap{s}.xlsx')
    cons, amb = snapshot('snap1.xlsx'), snapshot('snap2.xlsx')
    build(cons, amb)
    print('conservateur :', [round(v) for v in cons['ventes']],
          '| hors aides', [round(v) for v in cons['hors']],
          '| DSCR', [round(v, 2) for v in cons['dscr']])
    print('ambitieux    :', [round(v) for v in amb['ventes']],
          '| hors aides', [round(v) for v in amb['hors']],
          '| DSCR', [round(v, 2) for v in amb['dscr']])
    print('consignation :', [round(v) for v in cons['consig']],
          '/', [round(v) for v in amb['consig']])
