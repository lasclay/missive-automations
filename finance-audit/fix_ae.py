#!/usr/bin/env python3
"""Phase AE — rendre le canal détail crédible plutôt que flatteur.

La première version du canal donnait 29,7 % de marge nette en FY2029. Aucun
prêteur ne croit ça pour une marque de produits physiques, et il aurait raison.
Trois défauts, corrigés ici.

1. Le stock en consignation se composait deux fois. Il était ajouté à
   l'inventaire de produits finis, dont la formule multiplie l'année précédente
   par le facteur de croissance — donc le stock du canal était remultiplié chaque
   exercice EN PLUS d'être réajouté. L'inventaire de produits finis atteignait
   590 622 $ sur 2,8 M$ de ventes, et les 336 748 $ capitalisés hors du coût des
   marchandises gonflaient le profit d'autant. Le stock en consignation a
   maintenant sa propre rangée au bilan (l. 14), ce qui est de toute façon plus
   lisible : un prêteur veut voir séparément ce qui dort chez des tiers.

2. La logistique du canal était sous-estimée. Servir 55 comptes en consignation
   veut dire préparer, expédier, recompter et réapprovisionner : 3 % du revenu
   encaissé ne couvre que le transport. Porté à 6 %, préparation de commandes
   incluse.

3. Personne ne gérait les comptes. 55 détaillants en consignation, ça demande une
   personne : rapports de ventes, réapprovisionnement, inventaires, facturation
   sur écoulement. Un poste chargé de comptes à partir de FY2028, au moment où le
   canal passe de 12 à 30 points de vente.
"""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
INP = 'Inputs'

FY = {'FY27': ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],
      'FY28': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
      'FY29': ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']}
TOT = {'FY27': 'AD', 'FY28': 'AR', 'FY29': 'BF'}
RC = {'FY27': 'C', 'FY28': 'D', 'FY29': 'E'}
GF = {'FY27': 'C', 'FY28': 'D', 'FY29': 'E'}
PREVYR = {'FY27': list('DEFGHIJKLMNO'), 'FY28': FY['FY27'], 'FY29': FY['FY28']}
# colonnes mensuelles d'Inputs qui portent la masse salariale, par exercice
SAL = {'FY27': ['AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV'],
       'FY28': ['AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ'],
       'FY29': ['BM', 'BN', 'BO', 'BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX']}


def build(dst='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx',
          src='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'):
    e = Editor(src)
    e.expand_shared()

    # --- AE1 : le stock en consignation sur sa propre rangée --------------
    e.set(BIL, 'C13', None)
    e.set(BIL, 'C14', 'Stock en consignation chez les détaillants : Lasclay en reste '
                      'propriétaire jusqu’à la vente au consommateur. Coût des marchandises '
                      'immobilisé, pilotes dans Inputs rangées 126, 132 et 133.')
    for k, cols in FY.items():
        rc, gf = RC[k], GF[k]
        for i, c in enumerate(cols):
            p = PREVYR[k][i]
            # l'inventaire de produits finis retrouve sa formule d'origine
            e.set(BIL, f'{c}13', f'={p}13*Inputs!${gf}$67')
            # et le stock du canal vit à part, sans se composer
            e.set(BIL, f'{c}14',
                  f"='{PNL}'!{c}13*Inputs!$D$126*(Inputs!${rc}$57+Inputs!${rc}$59)"
                  f'/12*Inputs!$D$132')

    # --- AE2 : la logistique du canal, préparation de commandes incluse ---
    e.set(INP, 'A129', 'Transport et préparation de commandes vers les points de vente '
                       '(% du revenu encaissé)')
    e.set(INP, 'B129', 0.06)
    e.set(INP, 'C129', 0.06)

    # --- AE3 : quelqu'un gère les comptes ---------------------------------
    e.set(INP, 'A137', 'Chargé(e) de comptes détail — coût annuel chargé (FY2027 / 28 / 29)')
    e.set(INP, 'C137', 0.0)
    e.set(INP, 'D137', 68000.0)
    e.set(INP, 'E137', 70040.0)
    e.set(INP, 'A138', 'Aucun poste en FY2027 : douze points de vente se gèrent depuis '
                       'l’interne. Le poste arrive en FY2028, quand le canal passe de 12 à '
                       '30 comptes, et suit la hausse salariale de 3 % en FY2029.')
    for k, cols in FY.items():
        rc = RC[k]
        for c, sc in zip(cols, SAL[k]):
            e.set(PNL, f'{c}69', f'=Inputs!{sc}28+Inputs!${rc}$137/12')
    e.set(PNL, 'C69', 'Inclut le chargé(e) de comptes du canal détail dès FY2028 '
                      '(Inputs, rangée 137)')

    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    e = build()
    print(f'{len(e.log)} écritures')
    bk = xlcalc.load('PREVISIONS LASCLAY - version audit 2026-07-30.xlsx')
    allc = ['B'] + list('DEFGHIJKLMNO') + FY['FY27'] + FY['FY28'] + FY['FY29']
    print('mois hors équilibre :',
          len([c for c in allc if abs(bk.get(BIL, c + '76')) > 0.5]))
    hdr = ('FY2026', 'FY2027', 'FY2028', 'FY2029')
    tots = ('P', 'AD', 'AR', 'BF')
    def line(lab, r, pct=False):
        vals = [bk.get(PNL, f'{t}{r}') for t in tots]
        if pct:
            base = [bk.get(PNL, f'{t}26') for t in tots]
            print(f'{lab:<28}' + ''.join(f'{v / b:>13.1%}' for v, b in zip(vals, base)))
        else:
            print(f'{lab:<28}' + ''.join(f'{v:>13,.0f}' for v in vals))
    print(f'{"":<28}' + ''.join(f'{h:>13}' for h in hdr))
    line('Ventes nettes', 26)
    line('  dont détail', 12)
    line('Points de vente (fin)', 13)
    line('Contribution marginale', 32)
    line('  en %', 32, pct=True)
    line('Variation d’inventaire', 40)
    line('PAI', 137)
    line('PAI hors aides', 141)
    line('  en %', 141, pct=True)
    print('stock consignation au 31 août :',
          [round(bk.get(BIL, f'{c}14')) for c in ('O', 'AC', 'AQ', 'BE')])
    print('inventaire produits finis    :',
          [round(bk.get(BIL, f'{c}13')) for c in ('O', 'AC', 'AQ', 'BE')])
