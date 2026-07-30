#!/usr/bin/env python3
"""Phase AL — recalibrer le scénario ambitieux sur 3,4 M$.

Le scénario ambitieux visait 4,10 M$ en FY2029, soit 60,8 % de croissance annuelle
composée à partir de FY2026. L'entreprise a réalisé 39,8 % sur les trois derniers
exercices : demander 21 points de plus est difficile à défendre dans une
conversation, même avec un investisseur.

La cible passe à 3,4 M$, soit 51,1 % de croissance composée. Le déploiement détail
va à 16, 38 puis 72 points de vente au lieu de 20, 48 et 85, et la vente annuelle
par point de vente à 48 000 $ au lieu de 52 000 $.

Les ratios de coûts du scénario ambitieux sont alignés sur ceux du conservateur :
avec un volume moins élevé, il n'y a pas de raison de s'attribuer un gain d'échelle
supplémentaire. Le scénario ambitieux se distingue maintenant par son seul
déploiement, pas par des coûts plus favorables.
"""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
INP = 'Inputs'

# colonne C d'Inputs = scénario ambitieux ; colonne B = conservateur
AMBITIEUX = [
    ('C75', 1.28), ('C76', 1.46), ('C77', 1.05),      # croissance FY2027
    ('C78', 1.24), ('C79', 1.20), ('C80', 1.20),
    ('C81', 1.25), ('C82', 1.34), ('C83', 1.02),      # croissance FY2028
    ('C84', 1.23), ('C85', 1.20), ('C86', 1.20),
    ('C96', 1.21),                                     # facteur FY2029
    ('C123', 16.0), ('C124', 38.0), ('C125', 72.0),   # points de vente
    ('C126', 48000.0),                                 # détail annuel par point de vente
    # ratios de coûts identiques au conservateur : aucun gain d'échelle présumé
    ('C87', 0.16), ('C88', 0.155), ('C89', 0.15),
    ('C90', 0.17), ('C91', 0.155), ('C92', 0.145),
    ('C93', 0.22), ('C94', 0.205), ('C95', 0.195),
]


def build(dst=F, src=F):
    e = Editor(src)
    e.expand_shared()
    for cell, val in AMBITIEUX:
        e.set(INP, cell, val)
    e.set(INP, 'A72', 'Ambitieux : le déploiement détail va à 16, 38 puis 72 points de '
                      'vente et le web croît plus vite, mais les ratios de coûts restent '
                      'ceux du scénario conservateur. C’est la version de l’investisseur '
                      'privé.')
    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    e = build()
    print(f'{len(e.log)} écritures')
    P = 'Résultats-Prev 2025-2029'; B = 'Bilan2026-27-28'
    FY = {'FY27': ['R','S','T','U','V','W','X','Y','Z','AA','AB','AC'],
          'FY28': ['AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO','AP','AQ'],
          'FY29': ['AT','AU','AV','AW','AX','AY','AZ','BA','BB','BC','BD','BE']}
    ALL = ['B'] + list('DEFGHIJKLMNO') + FY['FY27'] + FY['FY28'] + FY['FY29']
    for scen, nom in ((1, 'CONSERVATEUR'), (2, 'AMBITIEUX')):
        x = Editor(F); x.expand_shared(); x.set(INP, 'C70', float(scen)); x.save(f'v{scen}.xlsx')
        bk = xlcalc.load(f'v{scen}.xlsx')
        err = sum(1 for sh in list(bk.formulas) for a in list(bk.formulas[sh])
                  if isinstance(bk.get(sh, a), str) and str(bk.get(sh, a)).startswith('#'))
        bad = len([c for c in ALL if abs(bk.get(B, c + '76')) > 0.5])
        t = ('P', 'AD', 'AR', 'BF')
        v = [bk.get(P, c + '26') for c in t]
        print(f'\n=== {nom}  (erreurs {err}, mois hors équilibre {bad})')
        for lab, r in (('ventes nettes', 26), ('  dont détail', 12), ('points de vente', 13),
                       ('PAI', 137), ('hors aides', 141)):
            print(f'  {lab:<16}' + '  '.join(f'{bk.get(P, c + str(r)):>11,.0f}' for c in t))
        print(f'  {"capitaux propres":<16}'
              + '  '.join(f'{bk.get(B, c + "70"):>11,.0f}' for c in ('O','AC','AQ','BE')))
        print(f'  croissance annuelle composée : {(v[3]/v[0])**(1/3)-1:.1%}')
