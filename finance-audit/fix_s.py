#!/usr/bin/env python3
"""Phase S — ce qu'un analyste de crédit regarde en premier.

Trois ajouts. Les 360 hypothèses d'exploitation encore tapées à la main dans les
blocs de prévision remontent dans un bloc visible d'Inputs. Le coût d'acquisition
et la valeur à vie d'un client, calculés sur le réel Shopify, entrent au sommaire :
c'est la première question qu'on posera sur 28 % de publicité. Et les ratios de
couverture du service de la dette, parce que c'est le test que le dossier doit
passer et qu'il vaut mieux le voir avant la banque.
"""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
INP = 'Inputs'
SUM_ = 'Sommaire bailleurs'
NOTES = 'Notes d’audit'

FY = {'FY27': ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],
      'FY28': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
      'FY29': ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']}
COL = {'FY27': 'C', 'FY28': 'D', 'FY29': 'E'}

# (ligne du résultat, libellé, montant annuel FY27, FY28, FY29) — repris tel quel
# du modèle, la conversion est neutre sur les chiffres
ASSUMPTIONS = [
    (48, 'Carburant et immatriculation', 1650, 1650, 1650),
    (50, 'Entretien et réparations véhicule', 1000, 1000, 1000),
    (52, 'Entretien et réparation équipement', 500, 500, 500),
    (56, 'Fournitures et petits outils', 1500, 1500, 1500),
    (58, 'Abonnements logiciels (opérations)', 9000, 15000, 15000),
    (73, 'Site web', 3600, 4200, 3000),
    (75, 'Outils de vente en ligne', 6600, 7200, 8400),
    (82, 'Sous-traitance marketing (agence, création)', 18000, 42000, 60000),
    (87, 'Licences logicielles marketing', 12000, 15000, 15000),
    (95, "Autres frais d'administration", 2709, 2709, 2709),
    (96, 'Assurance biens et responsabilité', 3600, 4000, 4400),
    (97, 'Outils de gestion et RH', 6600, 6600, 6600),
]


def build(dst='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx',
          src='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx',
          facilite=460000.0, amort_mois=84):
    e = Editor(src)
    e.expand_shared()

    # =================================================================
    # S1. Les hypothèses d'exploitation deviennent visibles
    # =================================================================
    e.set(INP, 'A100', "HYPOTHÈSES D'EXPLOITATION — montants annuels des postes fixes")
    e.set(INP, 'B100', 'Ligne du résultat')
    e.set(INP, 'C100', 'FY2027')
    e.set(INP, 'D100', 'FY2028')
    e.set(INP, 'E100', 'FY2029')
    e.set(INP, 'A101', 'Ces postes étaient tapés mois par mois dans les blocs de prévision : '
                      '360 cellules qu’un analyste ne pouvait pas inspecter. Ils sont '
                      'maintenant ici, et les mois s’en déduisent.')
    row = 102   # sous le tableau de bascule des scénarios, qui occupe 74 à 97
    for pl_row, label, f27, f28, f29 in ASSUMPTIONS:
        e.set(INP, f'A{row}', label)
        e.set(INP, f'B{row}', f'Résultats l. {pl_row}')
        e.set(INP, f'C{row}', float(f27))
        e.set(INP, f'D{row}', float(f28))
        e.set(INP, f'E{row}', float(f29))
        for k in ('FY27', 'FY28', 'FY29'):
            for c in FY[k]:
                e.set(PNL, f'{c}{pl_row}', f'=Inputs!${COL[k]}${row}/12')
        e.set(PNL, f'C{pl_row}', f'Hypothèse : Inputs ligne {row}')
        row += 1

    # =================================================================
    # S2. Amortissement de la facilité sur 84 mois
    #     À 60 mois, le service de la dette dépasse l'EBITDA jusqu'en FY2029.
    #     Sept ans est le terme usuel d'un prêt de fonds de roulement BDC.
    # =================================================================
    mens = facilite / amort_mois
    for c in FY['FY27'][1:] + FY['FY28'] + FY['FY29']:
        e.set(PNL, f'{c}176', -mens)
    e.set(PNL, 'C176',
          ('Sept. 2026 : facilité de {f} $ (BDC fonds de roulement + prêt à terme de '
           'refinancement + Prêt d’Honneur). Solde Shopify Capital et Merchant Growth, '
           'et finance le stock d’automne. Amortissement {m} mois.'
           ).format(f=f'{facilite:,.0f}'.replace(',', ' '), m=amort_mois))

    e.save(dst)
    return e


def add_sommaire(dst='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx',
                 src='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'):
    """Sections 7 et 8 du sommaire : acquisition client et ratios de crédit."""
    e = Editor(src)
    e.expand_shared()
    S = SUM_
    P, AD, AR, BF = 'P', 'AD', 'AR', 'BF'

    r = 78
    def put(a, b=None, c=None, d=None, ee=None):
        nonlocal r
        for col, v in zip('ABCDE', (a, b, c, d, ee)):
            if v is not None:
                e.set(S, f'{col}{r}', v)
        r += 1

    put('7. COÛT D’ACQUISITION ET VALEUR À VIE D’UN CLIENT')
    put('Calculé sur le réel : clients et commandes de Shopify, publicité de QuickBooks. '
        'C’est la première question qu’on posera sur 28 % de publicité.')
    put('', 'FY2025', 'FY2026')
    put('Nouveaux clients acquis', 11509.0, 8443.0)
    put('Publicité numérique', 231500.0, 269178.0)
    put('Coût d’acquisition par nouveau client', 20.11, 31.88)
    put('Panier moyen', 56.47, 79.92)
    put('Marge de contribution par commande', 39.36, 47.15)
    put('Récupération du coût d’acquisition', 'dès la 1re commande', 'dès la 1re commande')
    put('Taux de réachat', 0.193, 0.270)
    put('Valeur à vie estimée', 48.76, 64.62)
    put('Valeur à vie / coût d’acquisition', 2.42, 2.03)
    put('Lecture : l’acquisition payante se rembourse dès la première commande, dans les deux')
    put('exercices. Ce n’est pas la publicité qui creuse la perte, c’est la structure de coûts')
    put('fixes et le service de la dette. Mais le coût d’acquisition a monté de 59 % en un an')
    put('(20,11 $ → 31,88 $) pendant que le panier montait de 28 % : c’est ce que la ressource')
    put('marketing interne doit corriger. Valeur à vie estimée par série géométrique sur le')
    put('taux de réachat annuel, faute de deux ans d’historique de cohortes.')
    r += 1

    R_TITLE = r
    put('8. RATIOS DE CRÉDIT', 'FY2026', 'FY2027', 'FY2028', 'FY2029')
    r_eb = r;   put('EBITDA', *[f"='{PNL}'!{c}145" for c in (P, AD, AR, BF)])
    r_int = r;  put('Intérêts', *[f"='{PNL}'!{c}149" for c in (P, AD, AR, BF)])
    r_cap = r;  put('Remboursements de capital (hors refinancement)',
                    *[f"=-('{PNL}'!{c}175+'{PNL}'!{c}177+'{PNL}'!{c}179+MIN(0,'{PNL}'!{c}176))"
                      for c in (P, AD, AR, BF)])
    r_svc = r;  put('Service de la dette',
                    *[f'={x}{r_int}+{x}{r_cap}' for x in 'BCDE'])
    r_dscr = r; put('COUVERTURE DU SERVICE DE LA DETTE (EBITDA / service)',
                    *[f'=IFERROR({x}{r_eb}/{x}{r_svc},0)' for x in 'BCDE'])
    put('Seuil habituel d’une banque', 1.25, 1.25, 1.25, 1.25)
    put('Couverture des intérêts (EBITDA / intérêts)',
        *[f'=IFERROR({x}{r_eb}/{x}{r_int},0)' for x in 'BCDE'])
    r_dette = r
    put('Dette totale au 31 août',
        *[f"='{BIL}'!{c}43+'{BIL}'!{c}60" for c in ('O', 'AC', 'AQ', 'BE')])
    put('Dette nette / EBITDA',
        *[f"=IFERROR(({x}{r_dette}-'{PNL}'!{c}189)/{x}{r_eb},0)"
          for x, c in zip('BCDE', (P, AD, AR, BF))])
    put('Fonds de roulement au 31 août',
        *[f"='{BIL}'!{c}15-'{BIL}'!{c}43" for c in ('O', 'AC', 'AQ', 'BE')])
    put('Capitaux propres au 31 août',
        *[f"='{BIL}'!{c}70" for c in ('O', 'AC', 'AQ', 'BE')])
    r += 1
    put('LE POINT DUR DU DOSSIER, ÉNONCÉ AVANT QU’ON LE TROUVE :')
    put('La couverture du service de la dette reste sous 1,25 jusqu’en FY2029. Autrement dit,')
    put('l’exploitation ne suffit pas à porter 460 000 $ de dette amortissable, même sur sept')
    put('ans. Avec des capitaux propres négatifs, la conclusion honnête est que la structure a')
    put('besoin de capital patient — Prêt d’Honneur, PARI non remboursable, ou une injection —')
    put('et pas seulement de dette bancaire. Le mettre sur la table soi-même vaut mieux que de')
    put('le laisser découvrir : un analyste qui trouve ce ratio lui-même décote tout le reste.')
    r += 1
    put('9. LIQUIDITÉ AU MOMENT DE LA DEMANDE (réel QuickBooks)')
    put('Encaisse au 30 juin 2026', "='Bilan2026-27-28'!M6")
    r_auth = r; put('Marge de crédit EDC autorisée', 150000.0)
    put('Marge de crédit EDC tirée au 30 juin 2026', 83550.98)
    r_juil = r; put('Marge de crédit EDC tirée au 30 juillet 2026', 143026.40)
    put('Coussin restant sur la marge', f'=B{r_auth}-B{r_juil}')
    put('En un mois, juillet, la marge a été tirée de 59 475 $ de plus, dans le mois le plus')
    put('mort de l’année. Il reste 6 974 $ de coussin sur la seule source de liquidité')
    put('disponible. C’est la mesure de l’urgence, et elle est vérifiable dans QuickBooks.')
    print(f'  ratios aux lignes {r_eb} à {r_dscr}')

    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    e1 = build()
    e2 = add_sommaire()
    bk = xlcalc.load('PREVISIONS LASCLAY - version audit 2026-07-30.xlsx')
    print(f"{len(e1.log) + len(e2.log)} écritures")
    allc = (['B'] + list('DEFGHIJKLMNO') + FY['FY27'] + FY['FY28'] + FY['FY29'])
    print('mois hors équilibre :',
          sum(1 for c in allc if abs(bk.get(BIL, c + '76')) > 0.5))
    errs = [(sh, c) for sh, F in bk.formulas.items() for c in F
            if isinstance(bk.get(sh, c), xlcalc.Err)]
    print('erreurs :', len(errs), errs[:5], '| cycles :', len(bk.cycles))
    for r, l in ((26, 'Ventes nettes'), (137, 'PAI'), (141, 'PAI hors aides'),
                 (145, 'EBITDA'), (183, 'Marge max'), (189, 'Encaisse fin')):
        print(f"  {l:18}" + ' '.join(f"{bk.get(PNL, c + str(r)):>11,.0f}"
                                    for c in ('P', 'AD', 'AR', 'BF')))
    for row in range(96, 112):
        a = bk.get(SUM_, 'A' + str(row))
        if isinstance(a, str) and a:
            vals = [bk.get(SUM_, c + str(row)) for c in 'BCDE']
            if all(isinstance(v, float) for v in vals):
                print(f"  {a[:46]:46}" + ' '.join(f"{v:>11,.2f}" for v in vals))
