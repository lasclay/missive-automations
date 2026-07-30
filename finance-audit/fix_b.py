#!/usr/bin/env python3
"""Phase B — recalage du modèle de ventes sur le réel Shopify et refonte de la
trajectoire FY2027-FY2029.

Base : ventes Shopify réelles du 1er sept. 2025 au 29 juillet 2026 (11 mois),
par produit, en unités et en ventes brutes. Les quantités annuelles FY2026 du
modèle sont remises sur ce réel ; les prix sont ajustés quand le prix moyen
réalisé s'en écarte. Les produits jamais lancés passent à zéro et deviennent
des lancements FY2027 dimensionnés explicitement."""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

SRC = 'prev_fix_a.xlsx'
DST = 'prev_fix_b.xlsx'
V = 'Ventes prévisionnelles '
PNL = 'Résultats-Prev 2025-2029'

M26 = ['AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB']
M27 = ['BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ']
M28 = ['BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA', 'CB', 'CC', 'CD', 'CE', 'CF']

# ---------------------------------------------------------------------------
# B1. Quantités FY2026 recalées sur le réel Shopify (unités vendues sept→juil)
#     (ligne, quantité, prix ; prix None = inchangé)
# ---------------------------------------------------------------------------
REBASE = [
    # produits hiver
    (8,   2447, 109.99),   # Mitaines plein air        réel 2 447 u / 295 145 $ brut
    (12,   408, None),     # Foulard (+ imparfait)     408 u / 21 697 $
    (16,  2528, None),     # Cache-cou (3 versions)    2 528 u / 110 667 $
    (20,   290, None),     # Bandeau                   290 u / 8 936 $
    (24,   373, None),     # Bandeau torsadé           373 u / 11 423 $
    (28,  2727, None),     # Semelles (2 versions)     2 727 u / 57 949 $
    (33,   758, None),     # Tuque de ville            758 u / 31 298 $
    (37,   375, None),     # Tuque sport               375 u / 19 977 $
    (41,   510, None),     # Étui téléphone            510 u / 12 515 $
    (45,   630, None),     # Coussin d'assise thermal  630 u / 23 290 $
    (50,   989, 76.99),    # Mitaines urbaines         989 u / 76 315 $
    (52,     0, None),     # Mitaines 3 doigts légères  jamais vendues -> lancement FY27
    (54,     0, None),     # Gants légers premium       jamais vendus  -> lancement FY27
    (56,   150, 399.99),   # Manteaux (isolé+hivernal) 150 u / 61 216 $
    (58,    90, 279.99),   # Veste sans manche          90 u / 25 508 $
    (67,    78, None),     # Mitaines bébé              78 u / 4 669 $
    # produits été
    (82,   121, None),     # Sac à dos glacière 30L    121 u / 11 239 $
    (86,   504, None),     # Sac à lunch (+imparfait)  504 u / 29 444 $
    (90,    49, None),     # Tote bag                   49 u / 2 429 $
    (94,   210, None),     # Besace isotherme          210 u / 16 835 $
    (99,   235, None),     # Sac à bouteille de vin    235 u / 6 283 $
    (104,  299, None),     # Manchon boissons          299 u / 4 339 $
    (108,    0, None),     # Manchon canette « petit » : aucune référence distincte
    (113,   93, None),     # Manchon canettes minces    93 u / 1 202 $
    (116,    0, None),     # Glacières cube textile : aucune vente, produit non lancé
    (118,    0, None),
    (120,    0, None),
    (122,    0, None),
    (125,   40, None),     # Sac de couchage / couverture 40 u / 5 960 $
    (127,   35, None),     # Oreiller de camping        35 u / 1 750 $
    # horticole — la correction la plus importante du modèle
    (139, 6910, 12.99),    # Graines + semences stratifiées 6 910 u / 92 092 $
    (143, 1087, None),     # Bombes (asclépiade + indigènes) 1 087 u / 25 150 $
    (148,    0, None),     # Plants / plantation : aucune vente
    # maison
    (153,  135, None),     # Mitaines de cuisine       135 u / 4 366 $
    (157,   73, None),     # Sous-plat                  73 u / 1 810 $
    (161,  128, None),     # Poignées de four          128 u / 2 662 $
    (165,   64, None),     # Pantoufles (discontinué)   64 u / 2 827 $
    (169,   82, 67.99),    # Coussin pour animaux       82 u / 5 551 $
    (171,    0, None),
    (173,    0, None),
    (179,   92, 124.99),   # Oreiller hypoallergène     92 u / 11 609 $
    # collaborations et dérivés
    (184,   81, 28.99),    # Nettoyant Monarch Botanika  81 u / 2 336 $
    (188,   95, 46.99),    # Crème Monarch Botanika      95 u / 4 432 $
    (193,   39, 61.99),    # Boucles d'oreilles          39 u / 2 404 $
    (197,    0, None),     # Pendentif asclépiade : aucune vente
    (201,   11, None),     # Pendentif monarque          11 u / 1 246 $
    (205,   15, None),     # Bague monarque              15 u / 1 617 $
    (209,    0, None),     # Illustrations : aucune vente
    (214,  149, 39.99),    # Crème yeux Gourmet Sauvage 149 u / 5 959 $
    (223,    0, None),     # Couvertures imprimées : une seule référence vendue
    (225,    0, None),
    (227,   71, None),     # Couverture imprimée        71 u / 5 742 $
    (230,    0, None),     # T-shirts : aucune vente
    (232,    0, None),     # Casquettes : aucune vente
    (234,   47, 12.99),    # Porte-clés gravés          47 u / 612 $
    (236,   43, 19.99),    # Sous-verres gravés         43 u / 977 $
    (238,    0, None),     # Affiches jardin : aucune vente
    # matériaux
    (242,  105, 23.99),    # Soie en vrac              105 u / 2 508 $
    (246,  427, 29.99),    # Isolant au mètre          427 u / 12 834 $
    (250,  333, 34.99),    # Huile d'asclépiade        333 u / 11 426 $
]

# ---------------------------------------------------------------------------
# B2. Lancements FY2027 — volumes explicites, revus à la baisse
#     (l'ancien plan portait 280 547 $ de nouveautés non documentées)
# ---------------------------------------------------------------------------
LAUNCH27 = {
    52: 50, 54: 150, 60: 40, 62: 75, 64: 300, 69: 200, 71: 60, 73: 40, 75: 30,
    116: 60, 118: 80, 120: 30, 122: 15, 129: 60, 131: 25,
    175: 10, 177: 20, 181: 20, 216: 100, 218: 150, 220: 60, 248: 100,
}

# ---------------------------------------------------------------------------
# B3. Facteurs de croissance par catégorie
#     hiver = moteur prouvé ; été = saison à reconquérir ; horticole = vivace,
#     le marché sature (doctrine de marque : outil d'acquisition, pas moteur)
# ---------------------------------------------------------------------------
GROWTH = {   # (cellule FY27, cellule FY28) : (facteur FY27, facteur FY28)
    # hiver : le moteur prouvé (+76 % nov., +133 % déc., +180 % janv. en FY26)
    'hiver':     ('BD10',  'BS10',  1.22, 1.20),
    # été : la saison perdue faute de fonds de roulement, que le financement rouvre
    'ete':       ('BD83',  'BS83',  1.40, 1.28),
    # horticole : l'asclépiade est vivace, le marché sature — outil d'acquisition
    'horticole': ('BD141', 'BS141', 1.03, 1.00),
    'maison':    ('BD155', 'BS155', 1.20, 1.18),
    'derives':   ('BD186', 'BS186', 1.15, 1.15),
    'materiaux': ('BD243', 'BS243', 1.15, 1.15),
}
FY29_FACTOR = 1.18      # remplace 1,4516 dans Résultats-Prev ligne 5

# lignes de parts mensuelles et leur ligne de dénominateur
PART_ROWS = [11, 15, 19, 23, 27, 31, 36, 40, 44, 48, 85, 89, 93, 97, 102, 107,
             111, 142, 146, 151, 156, 160, 164, 168, 187, 191, 196, 200, 204,
             208, 212, 245]

# les 76 lignes de revenu (celles qu'énumère déjà BF5 ; AQ5..BB5 n'en avaient que 53)
REV_ROWS = [9, 13, 17, 21, 25, 29, 34, 38, 42, 46, 51, 53, 55, 57, 59, 61, 63,
            65, 68, 70, 72, 74, 76, 83, 87, 91, 95, 100, 105, 109, 114, 117,
            119, 121, 123, 126, 128, 130, 132, 140, 144, 149, 154, 158, 162,
            166, 170, 172, 174, 176, 178, 180, 182, 185, 189, 194, 198, 202,
            206, 210, 215, 217, 219, 221, 224, 226, 228, 231, 233, 235, 237,
            239, 243, 247, 249, 251, 252, 253]


def build(growth=GROWTH, fy29=FY29_FACTOR, launch=LAUNCH27, dst=DST, src=SRC):
    e = Editor(src)

    # --- B1 : quantités et prix FY2026 ---------------------------------
    for row, qty, price in REBASE:
        e.set(V, f'AP{row}', float(qty))
        if price is not None:
            e.set(V, f'AP{row+1}', float(price))
            e.set(V, f'BE{row+1}', float(price))
            e.set(V, f'BT{row+1}', float(price))

    # --- B2 : quantités FY2027 ----------------------------------------
    # motif normal : FY27 = qté FY26 x facteur de catégorie, FY28 = FY27 x facteur
    ANCHOR = {}
    for cat, (bd, bs, _, _) in growth.items():
        ANCHOR[cat] = (bd[2:], bs[2:])   # numéro de ligne du facteur
    CAT_OF = {}
    for r in [8, 12, 16, 20, 24, 28, 33, 37, 41, 45, 50, 52, 54, 56, 58, 60, 62,
              64, 67, 69, 71, 73, 75]:
        CAT_OF[r] = 'hiver'
    for r in [82, 86, 90, 94, 99, 104, 108, 113, 125, 129, 131]:
        CAT_OF[r] = 'ete'
    for r in [139, 143, 148]:
        CAT_OF[r] = 'horticole'
    for r in [153, 157, 161, 165, 169, 171, 173, 175, 177, 179, 181]:
        CAT_OF[r] = 'maison'
    for r in [116, 118, 120, 122, 127, 184, 188, 193, 197, 201, 205, 209, 214,
              216, 218, 220, 223, 225, 227, 230, 232, 234, 236, 238]:
        CAT_OF[r] = 'derives'
    for r in [242, 246, 248, 250]:
        CAT_OF[r] = 'materiaux'

    for r, cat in CAT_OF.items():
        a27, a28 = ANCHOR[cat]
        if r in launch:
            e.set(V, f'BE{r}', float(launch[r]))     # volume de lancement assumé
        else:
            e.set(V, f'BE{r}', f'=AP{r}*$BD${a27}')
        e.set(V, f'BT{r}', f'=BE{r}*$BS${a28}')
    # produits discontinués : pas de FY27 ni de FY28
    for r in (165,):
        e.set(V, f'BE{r}', 0.0)
        e.set(V, f'BT{r}', 0.0)

    # --- B3 : facteurs de croissance -----------------------------------
    for cat, (bd, bs, f27, f28) in growth.items():
        e.set(V, bd, f27)
        e.set(V, bs, f28)

    # --- B4 : bogues de référence ---------------------------------------
    # prix pris sur un autre produit
    for c in M26:
        e.set(V, f'{c}114', f'={c}113*$AP$114')
        e.set(V, f'{c}233', f'=$AP$233*{c}232')
        e.set(V, f'{c}209', f'={c}212*$AP$209')
    for c in M27:
        e.set(V, f'{c}114', f'={c}113*$BE$114')
        e.set(V, f'{c}233', f'=$BE$233*{c}232')
        e.set(V, f'{c}209', f'={c}212*$BE$209')
    for c in M28:
        e.set(V, f'{c}114', f'={c}113*$BT$114')
        e.set(V, f'{c}233', f'=$BT$233*{c}232')
        e.set(V, f'{c}209', f'={c}212*$BT$209')
        for r in (217, 219, 221):
            e.set(V, f'{c}{r}', f'={c}{r-1}*$BT${r}')
    # glacières cube : la saisonnalité était lue dans le bloc de l'exercice précédent
    for i, c in enumerate(M27):
        for r in (116, 118, 120, 122):
            e.set(V, f'{c}{r}', f'=$BE${r}*{M27[i]}97')
    for i, c in enumerate(M28):
        for r in (116, 118, 120, 122):
            e.set(V, f'{c}{r}', f'=$BT${r}*{M28[i]}97')
    # mitaines : base FY26 en dur et référence relative au facteur
    e.set(V, 'BE8', '=AP8*$BD$10')
    e.set(V, 'BT8', '=BE8*$BS$10')
    # sac de couchage : multiplicateur littéral 1,2 au lieu du facteur été
    e.set(V, 'BE125', '=AP125*$BD$83')
    # mois d'août manquant sur Parka, Pantalon de neige et Semelles barefoot
    # (ces trois blocs empruntent la saisonnalité du cache-cou, ligne 19)
    for r in (60, 62, 64):
        e.set(V, f'BQ{r}', f'=$BE${r}*BQ19')
        e.set(V, f'CF{r}', f'=$BT${r}*CF19')
    # couverture et sac de couchage de camping : la saisonnalité pointait sur la
    # ligne 151, entièrement vide, ce qui annulait 10 mois sur 12
    for cols, anchor in ((M27, 'BE'), (M28, 'BT')):
        for c in cols:
            for r in (129, 131):
                e.set(V, f'{c}{r}', f'=${anchor}${r}*{c}97')

    # --- B5 : parts mensuelles — dénominateur = somme des 12 mois -------
    # (les dénominateurs saisis ne valaient pas la somme des mois : biais de
    #  0 à 15 % à la hausse sur le revenu de 11 produits)
    for pr in PART_ROWS:
        dr = pr - 1
        for cols in (M26, M27, M28):
            a, b = cols[0], cols[-1]
            for c in cols:
                e.set(V, f'{c}{pr}',
                      f'=IFERROR({c}{dr}/SUM(${a}${dr}:${b}${dr}),0)')

    # --- B6 : totaux qui n'englobent pas leurs composantes --------------
    for cols, tot in ((M26, 'BC'), (M27, 'BR'), (M28, 'CG')):
        for c in cols:
            e.set(V, f'{c}5', '=SUM(' + ','.join(f'{c}{r}' for r in REV_ROWS) + ')')
        e.set(V, f'{tot}5', f'=SUM({cols[0]}5:{cols[-1]}5)')
    e.set(V, 'BC183', '=SUM(BC153:BC182)')
    e.set(V, 'CG183', '=SUM(CG153:CG182)')
    e.set(V, 'BR255', '=SUM(BR242:BR251)')
    e.set(V, 'BC255', '=SUM(BC242:BC251)')
    e.set(V, 'CG255', '=SUM(CG242:CG251)')

    # --- B6b : les deux canaux que le modèle ignorait -------------------
    # Le modèle ne couvrait que le catalogue B2C. Le B2B (compte QBO
    # « Ventes B2B-Distributeurs », 74 475 $ en FY2026) et les références
    # vendues hors catalogue modélisé (chandail polaire, gants magiques,
    # mitaines cuir de mouton, 27 994 $) n'entraient nulle part : le total du
    # modèle ne se réconciliait donc pas avec les ventes réelles.
    e.set(V, 'AM252', 'Autres canaux')
    for r, label, amount, part in ((252, 'Ventes B2B et distributeurs', 74475.0, 19),
                                   (253, 'Produits vendus hors catalogue modélisé', 27994.0, 11)):
        e.set(V, f'AN{r}', label)
        e.set(V, f'AO{r}', 'Revenu annuel en AP / mensuel à droite')
        e.set(V, f'AP{r}', amount)
        e.set(V, f'BE{r}', f'=AP{r}*$BD$10')
        e.set(V, f'BT{r}', f'=BE{r}*$BS$10')
        for c in M26:
            e.set(V, f'{c}{r}', f'=$AP${r}*{c}{part}')
        for c in M27:
            e.set(V, f'{c}{r}', f'=$BE${r}*{c}{part}')
        for c in M28:
            e.set(V, f'{c}{r}', f'=$BT${r}*{c}{part}')
        e.set(V, f'BC{r}', f'=SUM({M26[0]}{r}:{M26[-1]}{r})')
        e.set(V, f'BR{r}', f'=SUM({M27[0]}{r}:{M27[-1]}{r})')
        e.set(V, f'CG{r}', f'=SUM({M28[0]}{r}:{M28[-1]}{r})')

    # --- B7 : trajectoire FY2029 ---------------------------------------
    for a, b in zip(['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE'],
                    ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ']):
        e.set(PNL, f'{a}5', f'={b}5*Inputs!$C$54')
    e.set('Inputs', 'A54', 'Croissance FY2029 appliquée au profil mensuel FY2028')
    e.set('Inputs', 'C54', fy29)

    e.save(dst)
    return e


if __name__ == '__main__':
    e = build()
    print(f"{len(e.log)} écritures -> {DST}")
