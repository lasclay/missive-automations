#!/usr/bin/env python3
"""Phase M — interrupteur de scénario.

Un dossier à scénario unique optimiste se fait décoter d'office. Le classeur
porte donc deux jeux d'hypothèses, pilotés par une seule cellule : Inputs!C70.
1 = scénario de base (l'été se rouvre parce que le financement rétablit
l'approvisionnement), 2 = scénario prudent (l'été reste mort, aucune
amélioration de coût ni d'efficacité publicitaire n'est acquise)."""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

PNL = 'Résultats-Prev 2025-2029'
V = 'Ventes prévisionnelles '
INP = 'Inputs'

# (cellule, valeur base, valeur prudente, libellé)
SWITCHED = [
    ('BD10',  1.22,  1.12,  'Croissance FY2027 — accessoires hiver'),
    ('BD83',  1.40,  1.12,  'Croissance FY2027 — produits été'),
    ('BD141', 1.03,  1.00,  'Croissance FY2027 — horticole'),
    ('BD155', 1.20,  1.08,  'Croissance FY2027 — maison'),
    ('BD186', 1.15,  1.08,  'Croissance FY2027 — produits dérivés'),
    ('BD243', 1.15,  1.08,  'Croissance FY2027 — matériaux'),
    ('BS10',  1.20,  1.12,  'Croissance FY2028 — accessoires hiver'),
    ('BS83',  1.28,  1.12,  'Croissance FY2028 — produits été'),
    ('BS141', 1.00,  0.97,  'Croissance FY2028 — horticole'),
    ('BS155', 1.18,  1.08,  'Croissance FY2028 — maison'),
    ('BS186', 1.15,  1.08,  'Croissance FY2028 — produits dérivés'),
    ('BS243', 1.15,  1.08,  'Croissance FY2028 — matériaux'),
]
# hypothèses d'Inputs qui basculent aussi
INP_SWITCHED = [
    ('C57', 0.16,  0.165, 'Achats de matières premières, % des ventes nettes (FY2027)'),
    ('D57', 0.155, 0.162, 'Achats de matières premières (FY2028)'),
    ('E57', 0.15,  0.16,  'Achats de matières premières (FY2029)'),
    ('C59', 0.17,  0.185, "Sous-traitance d'assemblage (FY2027)"),
    ('D59', 0.155, 0.175, "Sous-traitance d'assemblage (FY2028)"),
    ('E59', 0.145, 0.17,  "Sous-traitance d'assemblage (FY2029)"),
    ('G11', 0.22,  0.235, 'Publicité numérique, % du revenu brut (FY2027)'),
    ('H11', 0.205, 0.225, 'Publicité numérique (FY2028)'),
    ('I11', 0.195, 0.215, 'Publicité numérique (FY2029)'),
    ('C54', 1.18,  1.12,  'Croissance FY2029 appliquée au profil mensuel FY2028'),
    ('D48', 46753.0, 99999.0, 'Ressource marketing — date d’entrée en poste'),
]


def build(dst='prev_fix_m.xlsx', src='prev_fix_l.xlsx'):
    e = Editor(src)
    e.expand_shared()
    e.set(INP, 'A70', 'SCÉNARIO ACTIF  →  1 = base   2 = prudent')
    e.set(INP, 'C70', 1.0)
    e.set(INP, 'D70', 'Changer cette seule cellule bascule tout le classeur')
    e.set(INP, 'A71', 'Base : le financement rétablit l’approvisionnement, l’été se rouvre '
                      'partiellement, le virage manufacturier livre une partie de son gain.')
    e.set(INP, 'A72', 'Prudent : l’été reste au niveau de 2026, aucun gain de coût unitaire ni '
                      'd’efficacité publicitaire n’est acquis, l’horticole décline.')
    e.set(INP, 'A74', 'HYPOTHÈSES QUI BASCULENT')
    e.set(INP, 'B74', 'Base')
    e.set(INP, 'C74', 'Prudent')
    e.set(INP, 'D74', 'Cellule pilotée')
    row = 75
    for cell, base, prud, label in SWITCHED:
        e.set(INP, f'A{row}', label)
        e.set(INP, f'B{row}', base)
        e.set(INP, f'C{row}', prud)
        e.set(INP, f'D{row}', f"'Ventes prévisionnelles '!{cell}")
        e.set(V, cell, f'=IF(Inputs!$C$70=2,Inputs!$C${row},Inputs!$B${row})')
        row += 1
    for cell, base, prud, label in INP_SWITCHED:
        e.set(INP, f'A{row}', label)
        e.set(INP, f'B{row}', base)
        e.set(INP, f'C{row}', prud)
        e.set(INP, f'D{row}', f'Inputs!{cell}')
        e.set(INP, cell, f'=IF($C$70=2,$C${row},$B${row})')
        if cell == 'D48':
            e.set(INP, f'A{row}', 'Ressource marketing — 1er janvier 2028 en base, '
                                  'reportée sine die en prudent')
        row += 1
    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    e = build()
    print(f"{len(e.log)} écritures -> prev_fix_m.xlsx")
    for scen in (1, 2):
        e2 = build(dst='scen.xlsx', src='prev_fix_m.xlsx')
        e2.set(INP, 'C70', float(scen))
        e2.save('scen.xlsx')
        bk = xlcalc.load('scen.xlsx')
        print(f"--- scénario {scen} ---")
        for r, l in ((26, 'Ventes nettes'), (137, 'PAI'), (141, 'PAI hors aides'),
                     (145, 'EBITDA'), (183, 'Marge max'), (189, 'Encaisse fin')):
            print(f"  {l:18}" + ' '.join(f"{bk.get(PNL, c + str(r)):>11,.0f}"
                                        for c in ('P', 'AD', 'AR', 'BF')))
        B = 'Bilan2026-27-28'
        allc = ['B'] + list('DEFGHIJKLMNO') + ['R','S','T','U','V','W','X','Y','Z','AA','AB','AC'] \
               + ['AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO','AP','AQ'] \
               + ['AT','AU','AV','AW','AX','AY','AZ','BA','BB','BC','BD','BE']
        print('  bilan hors équilibre :',
              sum(1 for c in allc if abs(bk.get(B, c + '76')) > 0.5))
