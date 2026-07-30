#!/usr/bin/env python3
"""Phase AM — le canal détail reconstruit ville par ville, sur du réel.

Le canal détail reposait sur trois nombres posés à la main : 55 ou 72 points de
vente en 2028-2029, et 44 000 $ ou 48 000 $ de vente annuelle par point. Aucun
des trois ne venait d'une observation. Et l'exercice 2025-2026 affichait zéro
vente au détail alors que Les Défricheuses, détaillante exclusive à Montréal,
dépose des rapports de consignation depuis septembre 2025.

Tout est maintenant construit sur deux sources vérifiables :

1. Les rapports de consignation des Défricheuses, de septembre 2025 à juin 2026.
   Dix mois, 13 801,29 $ encaissés par Lasclay, 23 002,15 $ au prix payé par le
   consommateur. C'est ce qu'un point de vente rapporte réellement.

2. Les ventes en ligne par ville de facturation chez Shopify, même période.
   Là où la marque pèse déjà, un point de vente pèse davantage. L'indice
   d'affinité de chaque ville se lit dans ces données, pas dans une hypothèse.

L'univers de déploiement n'est pas ouvert : ce sont les vingt plus grandes villes
du Québec et les vingt-cinq plus grandes du Canada, soit quarante villes
distinctes. Une ville porte plus d'un point de vente quand sa population le
permet, à raison d'un par tranche de 160 000 habitants, dix au plus : Toronto en porte
dix, Montréal dix, Granby un. Cent neuf points de vente au total, chacun rattaché
à une ville nommée. Le deuxième point de vente d'une ville ne vaut pas le
premier, qui a pris le meilleur emplacement : chaque rang suivant est escompté
de 20 %.

La feuille « Détail par ville » porte le calcul complet.
"""
import math
import re
import sys

sys.path.insert(0, 'tools')
from openpyxl.utils import column_index_from_string, get_column_letter
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
PNL = 'Résultats-Prev 2025-2029'
INP = 'Inputs'
VIL = 'Détail par ville'

# --- 1. Les Défricheuses, rapports mensuels (encaissé par Lasclay) -----------
# Sept. et oct. 2025 : la gamme se monte, dix-huit lignes de produits.
# Nov. à févr. : gamme complète, quarante lignes. Mars à juin : la tablette
# n'est pas réapprovisionnée, presque toutes les lignes sont à zéro.
DEFRICHEUSES = [92.99, 212.39, 2150.86, 5375.84, 3452.93, 1464.56,
                631.18, 157.18, 198.56, 64.80, 0.0, 0.0]
DEF_AN = sum(DEFRICHEUSES)

# --- 2. Ventes en ligne par ville, sept. 2025 à juil. 2026 (Shopify) ---------
# Variantes d'écriture et arrondissements regroupés sur la ville.
EN_LIGNE = {
    'Montréal': 116853.0, 'Québec': 78276.0, 'Laval': 17158.0,
    'Gatineau': 24290.0, 'Longueuil': 13094.0, 'Sherbrooke': 17543.0,
    'Lévis': 14602.0, 'Saguenay': 10597.0, 'Trois-Rivières': 14883.0,
    'Terrebonne': 5974.0, 'Saint-Jean-sur-Richelieu': 4884.0,
    'Brossard': 3311.0, 'Repentigny': 3825.0, 'Saint-Jérôme': 1716.0,
    'Drummondville': 4875.0, 'Granby': 7375.0, 'Mirabel': 3988.0,
    'Blainville': 4298.0, 'Saint-Hyacinthe': 5377.0, 'Châteauguay': 2219.0,
    'Toronto': 6753.0, 'Calgary': 1742.0, 'Ottawa': 9092.0,
    'Edmonton': 791.0, 'Winnipeg': 1971.0, 'Mississauga': 568.0,
    'Vancouver': 809.0, 'Brampton': 259.0, 'Hamilton': 480.0, 'Surrey': 0.0,
    'Halifax': 448.0, 'London': 638.0, 'Markham': 0.0, 'Vaughan': 0.0,
    'Saskatoon': 459.0, 'Kitchener': 1271.0, 'Burnaby': 300.0,
    'Windsor': 0.0, 'Regina': 513.0, 'Oakville': 337.0,
}
# Recensement de 2021, population de la municipalité (Statistique Canada).
POP = {
    'Montréal': 1762949, 'Québec': 549459, 'Laval': 438366, 'Gatineau': 291041,
    'Longueuil': 254483, 'Sherbrooke': 172950, 'Lévis': 149683,
    'Saguenay': 144723, 'Trois-Rivières': 139163, 'Terrebonne': 119944,
    'Saint-Jean-sur-Richelieu': 98036, 'Brossard': 91525, 'Repentigny': 86082,
    'Saint-Jérôme': 80213, 'Drummondville': 79258, 'Granby': 69025,
    'Mirabel': 60067, 'Blainville': 59819, 'Saint-Hyacinthe': 57239,
    'Châteauguay': 50815,
    'Toronto': 2794356, 'Calgary': 1306784, 'Ottawa': 1017449,
    'Edmonton': 1010899, 'Winnipeg': 749607, 'Mississauga': 717961,
    'Vancouver': 662248, 'Brampton': 656480, 'Hamilton': 569353,
    'Surrey': 568322, 'Halifax': 439819, 'London': 422324, 'Markham': 338503,
    'Vaughan': 323103, 'Saskatoon': 266141, 'Kitchener': 256885,
    'Burnaby': 249125, 'Windsor': 229660, 'Regina': 226404, 'Oakville': 213759,
}
QC20 = ['Montréal', 'Québec', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke',
        'Lévis', 'Saguenay', 'Trois-Rivières', 'Terrebonne',
        'Saint-Jean-sur-Richelieu', 'Brossard', 'Repentigny', 'Saint-Jérôme',
        'Drummondville', 'Granby', 'Mirabel', 'Blainville', 'Saint-Hyacinthe',
        'Châteauguay']
ROC20 = ['Toronto', 'Calgary', 'Ottawa', 'Edmonton', 'Winnipeg', 'Mississauga',
         'Vancouver', 'Brampton', 'Hamilton', 'Surrey', 'Halifax', 'London',
         'Markham', 'Vaughan', 'Saskatoon', 'Kitchener', 'Burnaby', 'Windsor',
         'Regina', 'Oakville']

# --- 3. Les deux seuls paramètres du modèle ---------------------------------
# Calibre : un point de vente majeur vaut trois fois ce qu'a fait Les
# Défricheuses en 2025-2026. Trois raisons, toutes lisibles dans les rapports :
# la gamme est passée de dix-huit à quarante lignes en cours d'année, la
# tablette n'a pas été réapprovisionnée après février, et le point de vente
# n'avait ni présentoir, ni chargé de comptes, ni poussée saisonnière.
CALIBRE = {'conservateur': 3.0, 'ambitieux': 3.0}
# Hors Québec, les ventes en ligne mesurent l'absence de marketing et non
# l'absence de potentiel : 8,3 % du chiffre canadien pour 77 % de la
# population. Une boutique vend à sa propre clientèle, alors l'indice se prend
# sur la taille du marché, escomptée de ce facteur.
#
# Le calibre est le seul jugement du modèle, et c'est aussi ce qui distingue
# les deux scénarios : le conservateur suppose des boutiques comparables aux
# Défricheuses, l'ambitieux suppose que l'isolant en rouleau et la poussée
# marketing ouvrent la porte de détaillants d'une autre taille.
FACTEUR_ROC = 0.40
OUVERTURE = 0.5      # un point ouvert en cours d'exercice ne livre qu'une part
# Une ville porte un point de vente majeur par tranche de population. Un seul
# commerce ne couvre pas Toronto, et Granby n'en porte pas deux.
HAB_PAR_POINT = 160000
PLAFOND_VILLE = 10
# Le deuxième point de vente d'une ville arrive après le premier, qui a pris le
# meilleur emplacement et la meilleure clientèle.
DECROISSANCE = 0.80

# Profil saisonnier observé chez Les Défricheuses, avec un plancher de 2,5 %
# de mars à août : l'effondrement du printemps est une rupture de stock, pas
# une saison morte. Septembre à août.
_BRUT = [x / DEF_AN for x in DEFRICHEUSES]
PROFIL = [max(v, 0.025) if i >= 6 else v for i, v in enumerate(_BRUT)]
PROFIL = [v / sum(PROFIL) for v in PROFIL]

# Ouvertures par exercice, en plus des précédentes (Montréal est déjà ouverte).
SCENARIOS = {'conservateur': [5, 13, 24], 'ambitieux': [16, 36, 48]}

MTL_PC = EN_LIGNE['Montréal'] / POP['Montréal']
BASE = DEF_AN * CALIBRE['conservateur']


def indice(v):
    if v in QC20:
        # affinité démontrée : ventes en ligne par habitant rapportées à
        # Montréal, amorties par la racine, parce qu'un commerce a une
        # capacité finie et qu'une affinité quadruple ne vend pas quatre fois
        return math.sqrt((EN_LIGNE[v] / POP[v]) / MTL_PC)
    return math.sqrt(min(1.0, POP[v] / POP['Montréal'])) * FACTEUR_ROC


def capacite(v):
    """Combien de points de vente majeurs une ville peut porter."""
    return max(1, min(PLAFOND_VILLE, round(POP[v] / HAB_PAR_POINT)))


# Les quarante villes, par potentiel décroissant du premier point de vente.
VILLES = sorted(((v, indice(v), capacite(v)) for v in QC20 + ROC20),
                key=lambda r: -r[1])

# Les cent trois points de vente, chacun rattaché à sa ville et à son rang.
# Ils s'ouvrent dans l'ordre du potentiel, tous rangs et toutes villes
# confondus : le deuxième point de Québec passe avant le premier de Regina.
POINTS = sorted(((v, n + 1, ind * DECROISSANCE ** n)
                 for v, ind, cap in VILLES for n in range(cap)),
                key=lambda r: -r[2])
# Montréal est déjà ouverte, par Les Défricheuses : c'est le point de rang 1 de
# Montréal, quelle que soit sa place dans le classement.
OUVERT = next(p for p in POINTS if p[0] == 'Montréal' and p[1] == 1)
A_OUVRIR = [p for p in POINTS if p is not OUVERT]


def deploiement(nouveaux, calibre):
    """Rend, par exercice : points ouverts, revenu, et la plage de rangées.

    Les points s'ouvrent dans l'ordre du registre, alors les rangées ouvertes
    forment toujours une plage continue à partir de la première."""
    base = DEF_AN * calibre
    i, ouverts, out = 0, [OUVERT], []
    for n in nouveaux:
        neufs = A_OUVRIR[i:i + n]
        debut = i               # index dans A_OUVRIR, converti en rangée plus tard
        i += n
        rev = base * (sum(p[2] for p in ouverts)
                      + OUVERTURE * sum(p[2] for p in neufs))
        ouverts = ouverts + neufs
        out.append((len(ouverts), rev, (debut, debut + n - 1)))
    return out


PLAN = {k: deploiement(v, CALIBRE[k]) for k, v in SCENARIOS.items()}

# --- géométrie des feuilles --------------------------------------------------
FY26 = list('DEFGHIJKLMNO')
FY27 = ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC']
FY28 = ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ']
FY29 = ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']
PROF_COL = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']


def build(dst=F, src=F):
    bk = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()

    # ------------------------------------------------ AM1 : la feuille villes
    # add_sheet() veut toutes les cellules d'un coup : on monte la feuille dans
    # une liste avant de la poser.
    L = []
    def put(coord, val):
        L.append((coord, val))

    put('A1', 'CANAL DÉTAIL — POTENTIEL PAR VILLE')
    put('A2', "Vingt plus grandes villes du Québec et vingt-cinq plus grandes "
              "du Canada, soit quarante villes distinctes. L'univers de "
              "déploiement est borné : il n'y a pas de quarante-et-unième "
              "point de vente dans ce modèle.")
    put('A4', 'RÉFÉRENCE — LES DÉFRICHEUSES, MONTRÉAL, 2025-2026')
    lig = 5
    for m, v in zip(['sept. 2025', 'oct. 2025', 'nov. 2025', 'déc. 2025',
                     'janv. 2026', 'févr. 2026', 'mars 2026', 'avr. 2026',
                     'mai 2026', 'juin 2026', 'juill. 2026', 'août 2026'],
                    DEFRICHEUSES):
        put(f'A{lig}', m)
        put(f'B{lig}', v)
        put(f'C{lig}', f'=IFERROR(B{lig}/$B$17,0)')
        lig += 1
    put('A17', 'Encaissé par Lasclay, 2025-2026')
    put('B17', '=SUM(B5:B16)')
    put('A18', 'Prix payé par le consommateur (Lasclay encaisse 60 %)')
    put('B18', '=B17/Inputs!$D$128')
    put('A19', "Calibre d'un point de vente majeur — conservateur")
    put('B19', CALIBRE['conservateur'])
    put('A20', "Calibre d'un point de vente majeur — ambitieux")
    put('B20', CALIBRE['ambitieux'])
    put('A21', 'Calibre retenu par le scénario actif')
    put('B21', '=IF(Inputs!$C$70=2,B20,B19)')
    put('C21', "Combien de fois Les Défricheuses. La gamme y est passée de 18 à "
               "40 lignes en cours d'année, la tablette n'a pas été "
               "réapprovisionnée après février, et le point de vente n'avait ni "
               "présentoir, ni chargé de comptes, ni poussée saisonnière. Le "
               "scénario ambitieux suppose en plus des détaillants d'un autre "
               "calibre, que l'isolant en rouleau rend accessibles.")
    put('A22', "Revenu annuel d'un point de vente majeur à Montréal")
    put('B22', '=B17*B21')
    put('A23', 'Facteur hors Québec')
    put('B23', FACTEUR_ROC)
    put('C23', "Hors Québec, les ventes en ligne valent 8,3 % du chiffre "
               "canadien pour 77 % de la population : elles mesurent l'absence "
               "de marketing et non l'absence de potentiel. L'indice s'y prend "
               "donc sur la taille du marché, escomptée de ce facteur.")

    # --- bloc A : les quarante villes ------------------------------------
    for col, lab in (('A', 'VILLE'), ('B', 'PROVINCE'),
                     ('C', 'POPULATION (2021)'),
                     ('D', 'VENTES EN LIGNE 2025-2026'), ('E', 'PAR HABITANT'),
                     ('F', "INDICE D'AFFINITÉ"),
                     ('G', 'POINTS DE VENTE POSSIBLES'),
                     ('H', 'REVENU DU 1er POINT DE VENTE'),
                     ('I', 'POTENTIEL TOTAL DE LA VILLE')):
        put(f'{col}24', lab)

    lig = 25
    for v, ind, cap in VILLES:
        put(f'A{lig}', v)
        put(f'B{lig}', 'Québec' if v in QC20 else 'Hors Québec')
        put(f'C{lig}', float(POP[v]))
        put(f'D{lig}', EN_LIGNE[v])
        put(f'E{lig}', f'=IFERROR(D{lig}/C{lig},0)')
        put(f'F{lig}', round(ind, 4))
        put(f'G{lig}', float(cap))
        put(f'H{lig}', f'=$B$22*F{lig}')
        # somme de la série escomptée : H x (1 + d + d^2 + ... + d^(cap-1))
        mult = sum(DECROISSANCE ** k for k in range(cap))
        put(f'I{lig}', f'=H{lig}*{mult:.6f}')
        lig += 1
    DERNIERE_VILLE = lig - 1
    put(f'A{lig}', 'TOTAL — 40 villes')
    put(f'C{lig}', f'=SUM(C25:C{DERNIERE_VILLE})')
    put(f'D{lig}', f'=SUM(D25:D{DERNIERE_VILLE})')
    put(f'G{lig}', f'=SUM(G25:G{DERNIERE_VILLE})')
    put(f'I{lig}', f'=SUM(I25:I{DERNIERE_VILLE})')

    # --- bloc B : le registre des points de vente, en ordre d'ouverture ---
    lig += 2
    REG0 = lig + 1
    put(f'A{lig}', "REGISTRE DES POINTS DE VENTE, EN ORDRE D'OUVERTURE")
    put(f'B{lig}', 'RANG DANS LA VILLE')
    put(f'C{lig}', 'INDICE')
    put(f'D{lig}', 'REVENU ANNUEL')
    put(f'E{lig}', 'OUVERTURE — CONSERVATEUR')
    put(f'F{lig}', 'OUVERTURE — AMBITIEUX')

    EXOS = ['2026-2027', '2027-2028', '2028-2029']
    quand = {}
    for scen in ('conservateur', 'ambitieux'):
        q = {}
        for ex, (_, _, (d, f)) in zip(EXOS, PLAN[scen]):
            for k in range(d, f + 1):
                q[k] = ex
        quand[scen] = q

    put(f'A{REG0}', 'Montréal')
    put(f'B{REG0}', 1.0)
    put(f'C{REG0}', round(OUVERT[2], 4))
    put(f'D{REG0}', f'=$B$22*C{REG0}')
    put(f'E{REG0}', 'ouverte (Les Défricheuses)')
    put(f'F{REG0}', 'ouverte (Les Défricheuses)')
    for k, (v, rang, ind) in enumerate(A_OUVRIR):
        r = REG0 + 1 + k
        put(f'A{r}', v)
        put(f'B{r}', float(rang))
        put(f'C{r}', round(ind, 4))
        put(f'D{r}', f'=$B$22*C{r}')
        put(f'E{r}', quand['conservateur'].get(k, 'non déployé'))
        put(f'F{r}', quand['ambitieux'].get(k, 'non déployé'))
    REGN = REG0 + len(A_OUVRIR)
    lig = REGN + 1
    put(f'A{lig}', f'PLAFOND DU CANAL — {len(POINTS)} points de vente')
    put(f'D{lig}', f'=SUM(D{REG0}:D{REGN})')

    # --- bloc C : le déploiement -----------------------------------------
    lig += 2
    put(f'A{lig}', 'DÉPLOIEMENT')
    put(f'B{lig}', 'POINTS DE VENTE AU 31 AOÛT')
    put(f'D{lig}', 'REVENU ENCAISSÉ PAR LASCLAY')
    lig += 1
    put(f'A{lig}', '2025-2026 (réel, Les Défricheuses)')
    put(f'B{lig}', 1.0)
    put(f'D{lig}', '=$B$17')
    dep = {}
    for scen in ('conservateur', 'ambitieux'):
        base = lig + 1
        for i, (ex, (n, rev, (d, f))) in enumerate(zip(EXOS, PLAN[scen])):
            r = base + i
            # d et f sont des index dans A_OUVRIR, qui commence à REG0+1
            r0, r1 = REG0 + 1 + d, REG0 + 1 + f
            put(f'A{r}', f'{ex} — {scen}')
            put(f'B{r}', float(n))
            avant = f'SUM($D${REG0}:$D${r0 - 1})'
            put(f'D{r}', f'={avant}+{OUVERTURE}*SUM($D${r0}:$D${r1})')
            dep[(scen, ex)] = r
        lig = base + len(EXOS) - 1

    if VIL in e.sheetpart:
        e.remove_sheet(VIL)
    e.add_sheet(VIL, L, after=INP)
    # add_sheet() ne tient pas l'index des feuilles à jour : on l'y inscrit,
    # sinon rien ne peut plus désigner la feuille qu'on vient de créer.
    e.sheetpart[VIL] = e.order[-1]

    # Sans style, une cellule créée prend le format par défaut de sa rangée.
    # On pose le format monétaire (index 678, déjà dans la table) sur les
    # colonnes de dollars, et deux décimales sur les indices.
    MONNAIE, DEC = 678, 679
    xml = e.parts[e.sheetpart[VIL]].decode('utf8')

    def style(coord, idx):
        return re.sub(r'(<c r="%s")' % coord, r'\1 s="%d"' % idx, xml, count=1)

    for coord, idx in ([(f'B{r}', MONNAIE) for r in list(range(5, 19)) + [22]]
                       + [(f'{c}{r}', MONNAIE)
                          for r in range(25, 25 + len(VILLES) + 1)
                          for c in ('D', 'G')]
                       + [(f'C{r}', MONNAIE)
                          for r in range(25, 25 + len(VILLES) + 1)]
                       + [(f'D{r}', MONNAIE)
                          for r in range(28 + len(VILLES) + 3,
                                         28 + len(VILLES) + 10)]):
        xml = style(coord, idx)
    e.parts[e.sheetpart[VIL]] = xml.encode('utf8')

    # ------------------------------------------------ AM2 : les Inputs
    e.set(INP, 'A123', 'Points de vente ouverts au 31 août 2027')
    e.set(INP, 'A124', 'Points de vente ouverts au 31 août 2028')
    e.set(INP, 'A125', 'Points de vente ouverts au 31 août 2029')
    for i, ex in enumerate(EXOS):
        r = 123 + i
        e.set(INP, f'B{r}', f"='{VIL}'!$B${dep[('conservateur', ex)]}")
        e.set(INP, f'C{r}', f"='{VIL}'!$B${dep[('ambitieux', ex)]}")
        e.set(INP, f'D{r}', f'=IF($C$70=2,C{r},B{r})')
    e.set(INP, 'A126', "Vente au détail annuelle moyenne par point de vente "
                       "ouvert (prix payé par le consommateur)")
    for c in 'BCD':
        e.set(INP, f'{c}126', f'=IFERROR({c}141/{c}125/Inputs!$D$128,0)')
    e.set(INP, 'A139', 'Revenu du canal détail encaissé par Lasclay — 2026-2027')
    e.set(INP, 'A140', 'Revenu du canal détail encaissé par Lasclay — 2027-2028')
    e.set(INP, 'A141', 'Revenu du canal détail encaissé par Lasclay — 2028-2029')
    for i, ex in enumerate(EXOS):
        r = 139 + i
        e.set(INP, f'B{r}', f"='{VIL}'!$D${dep[('conservateur', ex)]}")
        e.set(INP, f'C{r}', f"='{VIL}'!$D${dep[('ambitieux', ex)]}")
        e.set(INP, f'D{r}', f'=IF($C$70=2,C{r},B{r})')
    e.set(INP, 'E139', "Construit ville par ville dans « Détail par ville », à "
                       "partir des rapports de consignation des Défricheuses et "
                       "des ventes en ligne par ville chez Shopify.")

    # La consignation ne se gère presque pas. Le détaillant vend, Lasclay
    # réapprovisionne sans facturer, et rien ne circule entre les deux : pas de
    # bon de commande, pas de compte client, pas de recouvrement. Le canal ne
    # porte donc pas un chargé de comptes par tranche de points de vente, mais
    # une demi-ressource de coordination à partir de 2027-2028 et une complète
    # en 2028-2029, quand le réseau approche la centaine.
    e.set(INP, 'A137', 'Coordination du canal détail — coût annuel chargé '
                       '(2026-2027 / 2027-2028 / 2028-2029)')
    for col, v in (('C', 0.0), ('D', 34000.0), ('E', 68000.0)):
        e.set(INP, f'{col}137', v)
    e.set(INP, 'A138', "Aucune ressource en 2026-2027 : le réseau se gère depuis "
                       "l'interne. Une demi-ressource en 2027-2028, une complète "
                       "en 2028-2029. La consignation n'a ni facturation ni "
                       "compte client ; il reste à cadencer les "
                       "réapprovisionnements et les envois hebdomadaires aux "
                       "points de ramassage.")
    # La rangée 69 est réécrite dans sa forme canonique plutôt que retouchée :
    # une version antérieure la mettait au prorata des points de vente, et la
    # laisser en place multiplierait un coût annuel par cent un.
    for cols, ref, an in ((FY27, 'AK28', 'C'), (FY28, 'AY28', 'D'),
                          (FY29, 'BM28', 'E')):
        for i, c in enumerate(cols):
            col = get_column_letter(column_index_from_string(ref[:2]) + i)
            e.set(PNL, f'{c}69', f'=Inputs!{col}{ref[2:]}+Inputs!${an}$137/12')

    # profil saisonnier observé
    for c, v in zip(PROF_COL, PROFIL):
        e.set(INP, f'{c}136', round(v, 4))
    e.set(INP, 'A136', 'Profil saisonnier du canal détail (part du détail '
                       'annuel, sept. à août)')
    e.set(INP, 'N136', "Profil observé chez Les Défricheuses en 2025-2026, avec "
                       "un plancher de 2,5 % de mars à août : l'effondrement du "
                       "printemps est une rupture de stock, pas une saison morte.")

    # ------------------------------------------------ AM3 : le résultat
    # 2025-2026 : le réel. Les Défricheuses est déjà dans le chiffre de
    # QuickBooks, à la ligne B2B ; on l'en sort pour ne pas compter deux fois.
    # Chacun des douze mois de la rangée 11 va chercher SA colonne dans
    # « QBO P&L à maj » : la formule de septembre n'est pas celle d'octobre, et
    # les recopier toutes depuis une seule effacerait onze mois de réel. On
    # reprend donc la formule existante, en retirant d'abord une soustraction
    # déjà posée pour que le script reste rejouable.
    for c, v in zip(FY26, DEFRICHEUSES):
        e.set(PNL, f'{c}12', v)
        e.set(PNL, f'{c}13', 1.0)
        f11 = (bk.formulas[PNL].get(f'{c}11') or '').split(f'-{c}12')[0]
        if f11:
            e.set(PNL, f'{c}11', f'={f11}-{c}12')
    e.set(PNL, 'C11', "Net des ventes en consignation aux Défricheuses, "
                      "reclassées à la rangée 12 : le total de l'exercice fermé "
                      "ne bouge pas, le canal détail devient lisible.")
    e.set(PNL, 'C12', "Revenu encaissé par Lasclay, soit 60 % du prix payé par "
                      "le consommateur. 2025-2026 est le réel des rapports de "
                      "consignation des Défricheuses ; 2026-2027 à 2028-2029 "
                      "viennent de « Détail par ville ».")

    # Le revenu total de 2025-2026 se lit D3+D16, et la rangée 3 ne somme que
    # 9:11. Sans ce terme, sortir Les Défricheuses de la rangée 11 ferait
    # baisser un exercice fermé.
    # Septembre à juin lisent le réel de QuickBooks par la rangée 3 ; juillet et
    # août 2026 restent prévisionnels et lisent la rangée 5. Les deux formes
    # coexistent dans l'exercice, il ne faut pas les uniformiser.
    for c in FY26:
        src18 = bk.formulas[PNL].get(f'{c}18') or f'{c}3+{c}16'
        if f'+{c}12' not in src18:
            e.set(PNL, f'{c}18', f'={src18}+{c}12')
    e.set(PNL, 'P12', '=SUM(D12:O12)')
    e.set(PNL, 'P13', '=O13')

    for cols, inp in ((FY27, 139), (FY28, 140), (FY29, 141)):
        for c, p in zip(cols, PROF_COL):
            e.set(PNL, f'{c}12', f'=Inputs!$D${inp}*Inputs!${p}$136')

    # nombre de points de vente : interpolation mensuelle du déploiement
    for i, c in enumerate(FY27):
        e.set(PNL, f'{c}13', f'=1+(Inputs!$D$123-1)*{i + 1}/12')
    for i, c in enumerate(FY28):
        e.set(PNL, f'{c}13',
              f'=Inputs!$D$123+(Inputs!$D$124-Inputs!$D$123)*{i + 1}/12')
    for i, c in enumerate(FY29):
        e.set(PNL, f'{c}13',
              f'=Inputs!$D$124+(Inputs!$D$125-Inputs!$D$124)*{i + 1}/12')

    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    build()
    print(f'Les Défricheuses 2025-2026 : {DEF_AN:,.2f} $ encaissés, '
          f'{DEF_AN / 0.6:,.2f} $ au détail')
    somme = sum(p[2] for p in POINTS)
    for k, cal in CALIBRE.items():
        print(f'{k:<14} calibre {cal}   point de vente à Montréal '
              f'{DEF_AN * cal:>9,.0f} $   plafond {len(POINTS)} points '
              f'{DEF_AN * cal * somme:>12,.0f} $')
    print()
    for scen in ('conservateur', 'ambitieux'):
        print(f'--- {scen} ---')
        for ex, (n, rev, _) in zip(['2026-2027', '2027-2028', '2028-2029'],
                                   PLAN[scen]):
            print(f'  {ex}  {n:>3} points de vente  {rev:>12,.0f} $')

    for scen, sw in (('conservateur', 1), ('ambitieux', 2)):
        e = Editor(F)
        e.set(INP, 'C70', float(sw))
        e.set_full_calc()
        e.save('tmp_am.xlsx')
        bk = xlcalc.load('tmp_am.xlsx')
        print(f'\n--- {scen} : résultat ---')
        for lab, t in (('2025-2026', 'P'), ('2026-2027', 'AD'),
                       ('2027-2028', 'AR'), ('2028-2029', 'BF')):
            print(f'  {lab}  ventes nettes {bk.get(PNL, t + "26"):>12,.0f}   '
                  f'dont détail {bk.get(PNL, t + "12"):>11,.0f}   '
                  f'PAI {bk.get(PNL, t + "137"):>11,.0f}   '
                  f'hors aides {bk.get(PNL, t + "141"):>11,.0f}')
        B = 'Bilan2026-27-28'
        bad = [c for c in FY26 + FY27 + FY28 + FY29
               if abs(bk.get(B, c + '76')) > 0.01]
        err = sum(1 for sh in bk.values for a2, v in bk.values[sh].items()
                  if isinstance(v, str) and v.startswith('#'))
        print(f'  mois hors équilibre : {len(bad)}   cellules en erreur : {err}')
