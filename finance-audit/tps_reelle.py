#!/usr/bin/env python3
"""Les vrais montants de TPS, de TVQ, de CTI et de RTI de 2025-2026.

`fix_ao.py` a besoin de cinq nombres, et aucun ne doit être un ratio hérité de
l'exercice d'avant. Ce script les reconstitue à la source, du 1er septembre 2025
au 30 juillet 2026 — onze mois clos, le douzième étant estimé dans `fix_ao.py`.

Deux sources, parce que Lasclay vend par deux chemins.

**Shopify** perçoit la taxe à la caisse et la déclare par région de facturation,
sans séparer le fédéral du provincial. La part fédérale se calcule région par
région : la TVH de l'Ontario, du Nouveau-Brunswick, de la Nouvelle-Écosse, de
Terre-Neuve-et-Labrador et de l'Île-du-Prince-Édouard est entièrement fédérale et
se réclame comme de la TPS ; l'Alberta, le Yukon, les Territoires du Nord-Ouest
et le Nunavut n'ont que la TPS ; le Québec mêle 5 % et 9,975 %, d'où 5/14,975 ;
la Colombie-Britannique et le Manitoba ajoutent 7 % de taxe provinciale, d'où
5/12 ; la Saskatchewan 6 %, d'où 5/11 ; les ventes américaines et britanniques ne
portent pas de TPS. Les lignes sans région sont traitées comme québécoises : ce
sont des commandes prises au comptoir ou par téléphone.

**QuickBooks** porte les factures B2B et toutes les dépenses. Le montant de taxe
d'une pièce ne vit pas dans `TaxLineDetail` mais dans `TxnTaxDetail.TaxLine`, et
le taux ne s'y trouve que par sa référence : il faut la liste des `TaxRate` pour
savoir si une ligne est de la TPS, de la TVQ, un CTI ou un RTI.

Le tableau Shopify est recopié tel que l'outil d'analyse le rend, parce que
l'accès à Shopify passe par un connecteur interactif et non par un client en
ligne de commande. La requête qui le produit est en tête du bloc, pour qu'on
puisse la relancer et vérifier.

    python3 tps_reelle.py

Le côté QuickBooks demande `FINANCE_PROXY_URL` et `FINANCE_PROXY_SECRET` ; sans
eux, le script s'en tient au calcul Shopify et le dit.
"""
import json
import os
import subprocess
import sys

DEBUT, FIN = '2025-09-01', '2026-07-30'

# FROM sales SHOW net_sales, taxes GROUP BY billing_region
#   SINCE 2025-09-01 UNTIL 2026-07-30 ORDER BY taxes DESC LIMIT 40
# (région, ventes nettes, taxes perçues, part fédérale de ces taxes)
SHOPIFY = [
    ('Québec',                    733180.04, 108631.77, 5 / 14.975),
    ('sans région',                46748.91,   7052.36, 5 / 14.975),
    ('Ontario',                    43972.06,   5753.27, 1.0),
    ('Colombie-Britannique',        4934.50,    620.96, 5 / 12),
    ('Nouveau-Brunswick',           3016.96,    447.46, 1.0),
    ('Manitoba',                    3101.29,    374.98, 5 / 12),
    ('Alberta',                     6289.31,    368.44, 1.0),
    ('Nouvelle-Écosse',             2057.67,    324.67, 1.0),
    ('Saskatchewan',                2252.23,    242.64, 5 / 11),
    ('Terre-Neuve-et-Labrador',     1593.26,    238.65, 1.0),
    ('Yukon',                       1405.72,     71.15, 1.0),
    ('Île-du-Prince-Édouard',        450.88,     70.35, 1.0),
    ('Territoires du Nord-Ouest',    396.92,     19.85, 1.0),
    ('Nunavut',                      237.96,     12.40, 1.0),
]
# Les ventes hors Canada, 61 976 $ sur la période, ne portent pas de TPS et
# n'entrent donc pas dans ce tableau.
SHOPIFY_HORS_CANADA = 61976.0

# Ce que chaque nom de TaxRate représente dans le calcul.
FEDERAL_PERCU = {'TPS', 'TVH'}
QUEBEC_PERCU = {'TVQ 9,975'}
FEDERAL_CREDIT = {'TPS (CTI)', 'TVH (CTI) ON'}
QUEBEC_CREDIT = {'TVQ 9,975 (RTI)'}


def qbo(requete):
    """Interroge QuickBooks par le Finance Proxy. Lecture seule."""
    out = subprocess.run(
        ['node', 'finance_client.js', 'query', json.dumps({'query': requete})],
        capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(
            os.path.abspath(__file__))))
    if out.returncode:
        raise RuntimeError(out.stderr.strip() or out.stdout.strip())
    return json.loads(out.stdout)['data']['QueryResponse']


def toutes_les_pieces(entite):
    """QuickBooks ne rend jamais plus de 1 000 lignes : il faut paginer, sinon
    une année chargée se fait tronquer sans le dire."""
    pieces, depart, page = [], 1, 1000
    while True:
        lot = qbo(f'select * from {entite} startposition {depart} '
                  f'maxresults {page}').get(entite, [])
        pieces += lot
        if len(lot) < page:
            return pieces
        depart += page


def taxes_des_pieces(pieces, taux):
    """Somme les TxnTaxDetail.TaxLine par nom de taux, sur la période."""
    somme = {}
    for p in pieces:
        if not (DEBUT <= p.get('TxnDate', '') <= FIN):
            continue
        for ligne in (p.get('TxnTaxDetail') or {}).get('TaxLine', []):
            ref = ligne.get('TaxLineDetail', {}).get('TaxRateRef', {}).get('value')
            nom = taux.get(ref, ref)
            somme[nom] = somme.get(nom, 0.0) + ligne.get('Amount', 0.0)
    return somme


def part_federale_shopify():
    federal = sum(t * p for _, _, t, p in SHOPIFY)
    ventes = sum(v for _, v, _, _ in SHOPIFY)
    print(f'Shopify, {DEBUT} au {FIN}')
    for nom, v, t, p in SHOPIFY:
        print(f'  {nom:<28} ventes {v:>11,.2f}  taxes {t:>10,.2f}'
              f'  fédéral {t * p:>10,.2f}')
    print(f'  {"":<28} {"":>18}  {"":>16}  TOTAL   {federal:>10,.2f}')
    print(f'  ventes canadiennes {ventes:,.2f}, hors Canada '
          f'{SHOPIFY_HORS_CANADA:,.2f}\n')
    return federal


def cote_quickbooks():
    taux = {r['Id']: r['Name']
            for r in qbo('select * from TaxRate')['TaxRate']}
    total = {}
    for entite in ('Invoice', 'Bill', 'Purchase'):
        pieces = toutes_les_pieces(entite)
        somme = taxes_des_pieces(pieces, taux)
        dans = sum(1 for p in pieces if DEBUT <= p.get('TxnDate', '') <= FIN)
        print(f'{entite} — {dans} pièces sur la période, {len(pieces)} au total')
        for nom, v in sorted(somme.items(), key=lambda x: -abs(x[1])):
            if abs(v) > 0.005:
                print(f'  {nom:<24} {v:>12,.2f}')
        for nom, v in somme.items():
            total[nom] = total.get(nom, 0.0) + v
    print()
    return total


def main():
    federal_shopify = part_federale_shopify()
    try:
        total = cote_quickbooks()
    except Exception as err:      # noqa: BLE001 — on veut le message tel quel
        print(f'QuickBooks inaccessible ({err}).')
        print('Le calcul complet demande FINANCE_PROXY_URL et '
              'FINANCE_PROXY_SECRET.')
        return 1

    def somme(noms):
        return sum(v for n, v in total.items() if n in noms)

    tps_factures = somme(FEDERAL_PERCU)
    tvq_factures = somme(QUEBEC_PERCU)
    cti = somme(FEDERAL_CREDIT)
    rti = somme(QUEBEC_CREDIT)
    # La TVQ perçue chez Shopify est le complément de la part fédérale, sur les
    # seules régions qui en portent.
    tvq_shopify = sum(t * (1 - p) for nom, _, t, p in SHOPIFY
                      if nom in ('Québec', 'sans région'))

    print(f'Onze mois clos, {DEBUT} au {FIN}')
    print(f'  TPS/TVH perçue chez Shopify        {federal_shopify:>12,.2f}')
    print(f'  TPS perçue sur les factures        {tps_factures:>12,.2f}')
    print(f'  CTI sur achats et dépenses         {-cti:>12,.2f}')
    print(f'  TPS nette                          '
          f'{federal_shopify + tps_factures - cti:>12,.2f}')
    print()
    print(f'  TVQ perçue chez Shopify            {tvq_shopify:>12,.2f}')
    print(f'  TVQ perçue sur les factures        {tvq_factures:>12,.2f}')
    print(f'  RTI sur achats et dépenses         {-rti:>12,.2f}')
    print(f'  TVQ nette                          '
          f'{tvq_shopify + tvq_factures - rti:>12,.2f}')
    print()
    print('Ces montants sont les constantes de fix_ao.py. Les taux de '
          'projection s\'en déduisent en les divisant par les ventes nettes '
          'des onze mois, lisibles au chiffrier.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
