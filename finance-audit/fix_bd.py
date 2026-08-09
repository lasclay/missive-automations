#!/usr/bin/env python3
"""Phase BD — la RS&DE, remise sur le relevé de dépenses de 2026.

Le classeur portait la RS&DE comme **55 % du salaire de deux personnes** :
`Inputs!C42 = C39*1,175 + C41*1,11`, soit 73 865 $, reconduits tels quels en
2026-2027 puis indexés. Le relevé de dépenses 2026 (v2026-08-08) dit autre
chose, et il est vérifiable : la base admissible de l'exercice est de
**246 193 $**, dont 146 060 $ de salaires au coût réel, 81 388 $ de matériaux
et 18 745 $ de sous-traitance, répartis sur trois projets.

## Ce qui prouve que les deux documents parlent des mêmes livres

Le relevé note que les comptes 6061 et 6065 du grand livre totalisent
**109 014 $** et qu'ils excluent les charges de l'employeur. La rangée 45 du
résultat — « Salaires et BM - Développement et RSDE » — cumule **109 014,39 $**
sur les onze mois réels. Au dollar près. Le relevé et le chiffrier lisent la
même comptabilité ; c'est ce qui autorise à faire passer l'un dans l'autre.

## Le montant de 2025-2026

| | |
| --- | ---: |
| Base admissible | 246 193 $ |
| Estimé selon la formule du relevé, 0,55 × (sal. + mat.) + 0,28 × s.-trait. | 130 345 $ |
| Estimé corrigé du biais historique (× 1,15) | 149 900 $ |
| **Cas central retenu** | **140 000 $** |

Le biais est le point central du relevé : sur trois exercices, l'estimé a
**toujours** été inférieur à l'encaissement — de 11,6 %, de 43,5 %, puis de
4,0 %. Prendre 130 345 $ comme plafond serait un choix, pas une prudence. Le
cas central absorbe aussi les deux sensibilités connues : août 2026 n'est pas
comptabilisé (+5 000 à +8 000 $) et le bloc JCC pourrait être refusé
(-3 518 $).

Écart sur l'exercice : **+66 135 $**. Ce n'est pas de la trésorerie de 2026 —
le crédit n'entre pas avant 2027. Il change le résultat par la constatation au
31 août, et il change la valeur du compte « crédits d'impôt à recevoir ».

## Les exercices projetés

Le relevé propose de projeter à 20 % des charges totales en base admissible.
Appliqué au modèle, ce ratio donnerait 171 000 $, 220 000 $ et 269 000 $ de
crédit de 2027 à 2029 — et jusqu'à 345 000 $ en lecture optimiste. **Le
classeur ne le retient pas.** Ce ratio a été observé pendant que Lasclay
fabriquait au Québec : les matériaux et la main-d'œuvre de production
alimentaient la réclamation. Le modèle transfère justement l'assemblage à
l'étranger, et des travaux exécutés hors du Canada ne sont pas admissibles.
Extrapoler le ratio par-dessus la délocalisation ne serait pas prudent, ce
serait faux.

Les exercices projetés appliquent donc la formule du relevé aux dépenses de
R&D que le modèle budgète lui-même — rangées 45, 46 et 47 — en majorant les
seuls salaires du facteur coût réel / grand livre observé en 2026
(146 060 / 109 014 = 1,340). Les matériaux ne sont pas majorés : la
réaffectation de 2026 venait de la production québécoise, qui disparaît.

    2026-2027   103 318 $   (73 865 $ auparavant)
    2027-2028   101 699 $   (84 300 $)
    2028-2029   104 292 $   (95 692 $)

La correction du biais de 1,15 n'est pas appliquée aux années projetées : elle
jouerait dans le même sens qu'une base déjà sous-captée. Deux biais opposés,
tous deux laissés en place — c'est le seul traitement qu'on puisse expliquer
sans arbitrer à l'aveugle.

## Le calendrier d'encaissement, qui comptait plus que le montant

Le crédit de 2026 était encaissé **en un seul versement de mai 2027**. Les
trois dernières réclamations sont arrivées en deux virements, un du fédéral et
un du Québec, séparés de deux à cinq mois, et le délai s'allonge d'année en
année. Le relevé fixe l'hypothèse : Québec en avril, fédéral en juin, rien
avant mars. La répartition observée est de 65 % / 35 %.

Le classeur encaisse maintenant 35 % en avril et 65 % en juin, sur les trois
réclamations projetées, au bilan comme au budget de caisse. Le mois de pointe
du tirage de marge est un creux d'avant-saison ; déplacer 49 000 $ d'un mois
change ce que la marge doit porter.

Au passage, la réclamation de 2025 encaissée dans l'exercice 2025-2026 —
98 357 $ — était portée au budget de caisse en mai 2026 en un seul bloc. Les
livres montrent 31 277 $ le 21 avril et 67 080 $ le 26 juin. Corrigé : ce sont
des mois réels, ils doivent porter le réel.

## Ce que ça déplace ailleurs

Les pertes fiscales reportables (`Inputs!C43`) valaient 151 649 $, une
constante posée avant la révision. Un exercice moins déficitaire de 66 135 $
laisse moins de pertes à reporter. La cellule devient une formule : pertes au
1er septembre 2025 (29 036 $, la constante moins la perte d'alors) moins le
résultat de 2025-2026. L'impôt des exercices suivants suit.

    python3 fix_bd.py
"""
import re
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
S = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
BC = 'Budget de caisse'
I = 'Inputs'

# Styles déjà présents dans le bloc « MARGE DE CRÉDIT » d'Inputs, réutilisés
# pour que le nouveau bloc ne détonne pas : texte, montant, taux, section.
S_TXT, S_MNT, S_TAUX, S_SEC = '1', '678', '680', '679'

# A = libellé, D = valeur, E = commentaire. Le style de D suit le type.
BLOC = [
    (169, S_SEC, 'RS&DE — relevé de dépenses 2026 (v2026-08-08), mise à jour '
                 'du 9 août 2026', None, None,
     'Remplace l’ancienne méthode « 55 % du salaire de deux personnes ». '
     'Sources : relevé de dépenses RS&DE 2026, QuickBooks au 5 août 2026, '
     'compte 1250 pour l’historique d’encaissement.'),

    (170, S_MNT, 'Base admissible 2025-2026 — salaires au coût réel ($)',
     146060.0, None,
     'Brut assurable reconstitué paie par paie, majoré des charges de '
     'l’employeur, sur trois projets. Réconcilié au grand livre à 756 $ près '
     'sur 24 périodes.'),
    (171, S_MNT, 'Base admissible 2025-2026 — matériaux ($)', 81388.0, None,
     'Eko-Terre 42 195 $ (8 factures, bons de commande), semences 12 600 $, '
     'parts conventionnelles 9 800 $ (Fibra MR à 50 %, tissu et fret à 17 %), '
     'reste sur pièces.'),
    (172, S_MNT, 'Base admissible 2025-2026 — sous-traitance ($)', 18745.0,
     None,
     'Dont 12 564 $ pour JCC, dont les factures décrivent de la production à '
     'la pièce : c’est le bloc le plus fragile de la réclamation.'),
    (173, S_MNT, 'Base admissible totale 2025-2026 ($)', '=SUM(D170:D172)',
     None, 'Contre 184 797 $ en 2024-2025 et 125 140 $ en 2023-2024.'),

    (174, S_TAUX, 'Taux appliqué aux salaires et aux matériaux', 0.55, None,
     'Fédéral et Québec combinés sur une base majorée par la méthode de '
     'remplacement.'),
    (175, S_TAUX, 'Taux appliqué à la sous-traitance', 0.28, None,
     'Les contrats sans lien de dépendance n’entrent au compte de dépenses '
     'admissibles qu’à 80 %.'),
    (176, S_MNT, 'Estimé selon la formule du relevé ($)',
     '=D174*(D170+D171)+D175*D172', None,
     'La reproduction exacte de la colonne « estimé remboursement » des '
     'relevés des années précédentes. Ce n’est pas un calcul d’impôt.'),

    (177, S_TAUX, 'Correction du biais historique (encaissé / estimé)', 1.15,
     None,
     'Trois exercices sur trois, l’encaissement a dépassé l’estimé : +11,6 % '
     'en 2023, +43,5 % en 2024, +4,0 % en 2025.'),
    (178, S_MNT, 'Estimé corrigé du biais ($)', '=D176*D177', None,
     'Le ratio encaissé / base admissible, médiane 54,2 %, donne 133 400 $ '
     'par un autre chemin. La fourchette à modéliser est 130 000 à 155 000 $.'),
    (179, S_MNT, 'Crédit 2025-2026 retenu — cas central ($)', 140000.0, None,
     'Constaté au 31 août 2026, encaissé en 2027. Absorbe les deux '
     'sensibilités connues : août 2026 non comptabilisé (+5 000 à +8 000 $) '
     'et quatre pièces manquantes (-1 550 $).'),
    (180, S_MNT, 'Scénario défavorable — bloc JCC refusé ($)', 126827.0, None,
     'La base tomberait à 233 629 $. Écart de 3 518 $, soit 2,7 % du crédit : '
     'le risque financier direct est faible, le vrai risque est qu’un refus '
     'sur JCC entraîne un examen plus large.'),

    (181, S_TAUX, 'Part fédérale de l’encaissement', 0.65, None,
     'Observé : 62 % en 2024, 68 % en 2025. Le fédéral arrive en juin dans '
     'l’hypothèse retenue (délai de 10 mois après la clôture).'),
    (182, S_TAUX, 'Part québécoise de l’encaissement', '=1-D181', None,
     'Le Québec arrive en avril (délai de 8 mois). Rien n’est encaissé avant '
     'mars. Scénario prudent, non modélisé : tout glisser d’un trimestre.'),

    (183, S_MNT, 'Salaires de R&D aux comptes 6061 et 6065, 2025-2026 ($)',
     109014.0, None,
     'Le relevé et la rangée 45 du résultat donnent le même montant sur les '
     'onze mois réels — 109 014,39 $. C’est le point de raccord entre les '
     'deux documents.'),
    (184, S_TAUX, 'Facteur coût réel pour l’entreprise / solde du grand livre',
     '=D170/D183', None,
     'Majore les seuls salaires des exercices projetés. Les matériaux ne sont '
     'pas majorés : la réaffectation de 2026 venait de la production '
     'québécoise, que le modèle transfère à l’étranger.'),

    (185, S_MNT, 'Pertes fiscales reportables au 1er septembre 2025 ($)',
     29036.0, None,
     'L’estimé du comptable de 151 649 $ moins la perte de 2025-2026 telle '
     'qu’elle était alors (122 613 $). Sert de point de départ à C43.'),
    (186, S_MNT, 'Réserve fiscale hors RS&DE — CTI sur du fret détaxé ($)',
     2279.0, None,
     'Crédits de taxe sur intrants réclamés sur une facture de fret '
     'd’exportation détaxée. Erreur de TPS/TVQ sans lien avec la RS&DE, '
     'laissée en l’état sur décision de la direction ; non provisionnée au '
     'modèle, montant immatériel.'),
]

# Résultats : la rangée 128, exercice par exercice. Chaque mois porte le
# douzième du crédit de son exercice, calculé sur les dépenses de R&D que le
# modèle budgète lui-même.
EXERCICES = [('R', 'AC', 'AD'), ('AF', 'AQ', 'AR'), ('AT', 'BE', 'BF')]

# Encaissement : (colonne du crédit constaté, mois d'avril, mois de juin,
# ancien mois de mai à nettoyer) — au bilan puis au budget de caisse.
ENCAISSE_BILAN = [('$O$10', 'Y', 'AA', 'Z'),
                  ('$AC$10', 'AM', 'AO', 'AN'),
                  ('$AQ$10', 'BA', 'BC', 'BB')]
ENCAISSE_CAISSE = [("'Bilan2026-27-28'!$O$10", 'AZ', 'BB', 'BA'),
                   ("'Bilan2026-27-28'!$AC$10", 'BM', 'BO', 'BN'),
                   ("'Bilan2026-27-28'!$AQ$10", 'CA', 'CC', 'CB')]


def colonnes(a, b):
    from openpyxl.utils import column_index_from_string as ci, get_column_letter as gl
    return [gl(c) for c in range(ci(a), ci(b) + 1)]


def build(dst=F, src=F):
    avant = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()

    # ------------------------------------------------------------------ Inputs
    for r, style, label, valeur, _, note in BLOC:
        e.set(I, f'A{r}', label)
        if valeur is not None:
            e.set(I, f'D{r}', valeur)
        e.set(I, f'E{r}', note)
    styler(e, {r: style for r, style, *_ in BLOC})

    e.set(I, 'A42', 'RSDE 2025-2026 — cas central du relevé de dépenses '
                    '(voir le bloc de la rangée 169)')
    e.set(I, 'C42', '=D179')
    e.set(I, 'A43', 'Pertes fiscales reportables fin 2025-2026 (calculées)')
    e.set(I, 'C43', f"=MAX(0,D185-'{S}'!P137)")

    # ------------------------------------------------------- Résultats, rg 128
    for a, b, tot in EXERCICES:
        f = (f'=-(Inputs!$D$174*(Inputs!$D$184*${tot}$45+${tot}$46)'
             f'+Inputs!$D$175*${tot}$47)/12')
        for c in colonnes(a, b):
            e.set(S, f'{c}128', f)

    # --------------------------------------------------- Bilan, rg 10 : timing
    for credit, avril, juin, mai in ENCAISSE_BILAN:
        nettoyer(e, BIL, f'{mai}10', f'-{credit}')
        ajouter(e, BIL, f'{avril}10', f'-{credit}*Inputs!$D$182')
        ajouter(e, BIL, f'{juin}10', f'-{credit}*Inputs!$D$181')

    # ------------------------------------------ Budget de caisse, rg 9 : timing
    for credit, avril, juin, mai in ENCAISSE_CAISSE:
        e.set(BC, f'{mai}9', None)
        e.set(BC, f'{avril}9', f'={credit}*Inputs!$D$182')
        e.set(BC, f'{juin}9', f'={credit}*Inputs!$D$181')
    # 2025-2026 est du réel : les deux virements du compte 1250, à leur date.
    e.set(BC, 'AN9', None)
    e.set(BC, 'AM9', 31277.0)
    e.set(BC, 'AO9', 67080.0)

    journal(e)
    e.set_full_calc()
    e.save(dst)

    apres = xlcalc.load(dst)
    return rapport(avant, apres)


def styler(e, styles):
    """Poser le style des cellules du nouveau bloc.

    `Editor.set` fait naître une rangée sans style ; le format par défaut de
    cette feuille afficherait 146 060 $ comme un nombre nu et 0,55 comme
    « 0,55 » au lieu du format des rangées voisines.
    """
    x = e._sheet(I)
    if isinstance(x, bytes):
        x = x.decode('utf8')
    for r, s in styles.items():
        m = re.search(r'<row r="%d"[^>]*>(.*?)</row>' % r, x, re.S)
        if not m:
            continue
        corps = m.group(1)

        def poser(cm):
            col = re.match(r'<c r="([A-Z]+)\d+"', cm.group(0)).group(1)
            style = {'A': S_TXT, 'D': s, 'E': S_TXT}.get(col)
            if style is None:
                return cm.group(0)
            return re.sub(r'^<c r="([A-Z]+\d+)"(\s+s="\d+")?',
                          rf'<c r="\1" s="{style}"', cm.group(0))

        neuf = re.sub(r'<c r="[A-Z]+\d+"[^>]*?(?:/>|>.*?</c>)', poser, corps,
                      flags=re.S)
        x = x[:m.start(1)] + neuf + x[m.end(1):]
    e._save_sheet(I, x)


def nettoyer(e, feuille, coord, terme):
    """Retirer un terme d'une formule existante, en vérifiant qu'il y était."""
    f = lire(e, feuille, coord)
    if terme not in f:
        raise SystemExit(f'{feuille}!{coord} : « {terme} » introuvable dans {f}')
    e.set(feuille, coord, '=' + f.replace(terme, '', 1))


def ajouter(e, feuille, coord, terme):
    e.set(feuille, coord, '=' + lire(e, feuille, coord) + terme)


def lire(e, feuille, coord):
    x = e._sheet(feuille)
    if isinstance(x, bytes):
        x = x.decode('utf8')
    m = re.search(r'<c r="%s"[^>]*>(.*?)</c>' % coord, x, re.S)
    f = re.search(r'<f[^>]*>(.*?)</f>', m.group(1), re.S)
    return (f.group(1).replace('&amp;', '&').replace('&lt;', '<')
            .replace('&gt;', '>'))


def journal(e):
    J = 'Notes d’audit'
    e.set(J, 'A86',
          '• RS&DE 2025-2026, corrigé : le classeur portait 73 865 $, soit '
          '55 % du salaire de deux personnes (Inputs C42 = C39×1,175 + '
          'C41×1,11). Le relevé de dépenses v2026-08-08 donne une base '
          'admissible de 246 193 $ sur trois projets — 146 060 $ de salaires '
          'au coût réel, 81 388 $ de matériaux, 18 745 $ de sous-traitance — '
          'et un estimé de 130 345 $ par la formule du relevé. Le cas central '
          'retenu est 140 000 $, dans la fourchette 130 000 à 155 000 $. '
          'Écart sur l’exercice : +66 135 $, sans effet sur la trésorerie de '
          '2026 (voir Inputs, rangées 169 à 186).')
    e.set(J, 'A87',
          '• Ce qui autorise le raccord : le relevé note que les comptes 6061 '
          'et 6065 du grand livre totalisent 109 014 $ et excluent les '
          'charges de l’employeur. La rangée 45 du résultat cumule '
          '109 014,39 $ sur les onze mois réels. Le relevé et le chiffrier '
          'lisent la même comptabilité.')
    e.set(J, 'A88',
          '• Pourquoi l’estimé du relevé n’est pas pris comme plafond : sur '
          'trois exercices, l’encaissement a toujours dépassé l’estimé — '
          '+11,6 % en 2023, +43,5 % en 2024, +4,0 % en 2025. Le cas central '
          'applique une correction de 1,15 arrondie vers le bas, et absorbe '
          'les deux sensibilités connues : août 2026 n’est pas encore '
          'comptabilisé (+5 000 à +8 000 $) et le bloc JCC de 12 564 $ '
          'pourrait être refusé (-3 518 $).')
    e.set(J, 'A89',
          '• Exercices projetés : le relevé propose 20 % des charges totales '
          'en base admissible, ce qui donnerait 171 000 $, 220 000 $ et '
          '269 000 $ de crédit de 2027 à 2029. Le classeur ne le retient '
          'pas — ce ratio a été observé pendant que Lasclay fabriquait au '
          'Québec, et le modèle transfère l’assemblage à l’étranger, où les '
          'travaux ne sont pas admissibles. La formule du relevé est '
          'appliquée aux dépenses de R&D que le modèle budgète lui-même '
          '(rangées 45, 46, 47), salaires majorés du facteur 1,340 observé en '
          '2026 : 103 318 $, 101 699 $ et 104 292 $.')
    e.set(J, 'A90',
          '• Calendrier d’encaissement, corrigé : le crédit était encaissé en '
          'un seul versement de mai. Les trois dernières réclamations sont '
          'arrivées en deux virements, Québec puis fédéral, et le délai '
          's’allonge — 4,6 et 6,3 mois en 2023, 8,0 et 4,7 en 2024, 7,7 et '
          '9,9 en 2025. Hypothèse retenue : 35 % en avril, 65 % en juin, rien '
          'avant mars. Le budget de caisse suit. La réclamation de 2025 '
          'encaissée en 2025-2026 était portée en mai en un bloc ; les livres '
          'montrent 31 277 $ le 21 avril et 67 080 $ le 26 juin.')
    e.set(J, 'A91',
          '• Pertes fiscales reportables : Inputs C43 valait 151 649 $, une '
          'constante posée avant la révision. Elle devient une formule — '
          'pertes au 1er septembre 2025 (29 036 $) moins le résultat de '
          '2025-2026 — pour qu’un exercice moins déficitaire laisse moins de '
          'pertes à reporter. L’impôt des exercices suivants suit.')
    e.set(J, 'A92',
          '• Signalé, non provisionné : 2 279 $ de crédits de taxe sur '
          'intrants ont été réclamés sur une facture de fret d’exportation '
          'détaxée. C’est une erreur de TPS/TVQ sans lien avec la RS&DE, '
          'laissée en l’état sur décision de la direction. Montant '
          'immatériel ; inscrit à Inputs D186 pour mémoire.')


def rapport(avant, apres):
    L = []
    TOT = [('P', '2025-2026'), ('AD', '2026-2027'), ('AR', '2027-2028'),
           ('BF', '2028-2029')]
    L.append('RS&DE portée au résultat (rangée 128)')
    for t, nom in TOT:
        L.append(f'  {nom}   {-avant.get(S, f"{t}128"):>11,.0f} → '
                 f'{-apres.get(S, f"{t}128"):>11,.0f}')
    L.append('Résultat avant impôts')
    for t, nom in TOT:
        L.append(f'  {nom}   {avant.get(S, f"{t}137"):>11,.0f} → '
                 f'{apres.get(S, f"{t}137"):>11,.0f}')
    L.append('Marge de crédit — tirage le plus élevé des mois projetés')
    L.append(f'  {avant.get(I, "D166"):>11,.0f} → {apres.get(I, "D166"):>11,.0f}'
             f'   (limite {apres.get(I, "D164"):,.0f})')
    L.append(f'Pertes reportables  {avant.get(I, "C43"):>11,.0f} → '
             f'{apres.get(I, "C43"):>11,.0f}')
    ecarts = [abs(apres.get(BIL, f'{c}76')) for c in
              colonnes('D', 'O') + colonnes('R', 'AC') + colonnes('AF', 'AQ')
              + colonnes('AT', 'BE')]
    L.append(f'Contrôle du bilan (rangée 76) : écart maximal '
             f'{max(ecarts):.6f} sur 48 mois')
    return L


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
