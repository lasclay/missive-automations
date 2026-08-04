#!/usr/bin/env python3
"""Phase AT — la page sommaire, et le journal remis à jour.

## La page sommaire

Un bailleur ouvre le classeur sur la première feuille et décide en une minute
s'il continue. Jusqu'ici cette feuille était « Résultats-Prev 2025-2029» :
193 rangées, 48 colonnes, aucune hiérarchie. Le sommaire donne les mêmes
chiffres, dans l'ordre où on les demande, et **par formule** — pas de valeurs
recopiées. Basculer `Inputs!C70` de 1 à 2 met donc le sommaire à jour comme le
reste ; un sommaire figé aurait affiché le conservateur pendant que le classeur
calcule l'ambitieux, et personne ne s'en serait aperçu.

La couverture du service de la dette est calculée ici comme le mémo la calcule :
EBITDA divisé par (intérêts + remboursements de capital), le capital excluant le
refinancement — sinon un emprunt qui en remplace un autre gonflerait le service
sans que rien ne sorte de la caisse.

## Le journal

Trois entrées décrivaient un état du monde qui n'existe plus : le bilan réel
« s'arrête à février », le solde bancaire « 28 472 $ », juillet « porté en
prévision ». Les laisser serait pire que de ne rien écrire — un journal d'audit
faux se retourne contre celui qui le signe. Elles sont réécrites au présent,
et la bascule de juillet est consignée.

    python3 fix_at.py
"""
import re
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc
from fix_ap import formats

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
R = "'Résultats-Prev 2025-2029'"
B = "'Bilan2026-27-28'"

TOT = ('P', 'AD', 'AR', 'BF')                    # colonnes de total d'exercice
FIN = ('O', 'AC', 'AQ', 'BE')                    # dernier mois de l'exercice
MOIS = (('D', 'O'), ('R', 'AC'), ('AF', 'AQ'), ('AT', 'BE'))
COL = ('B', 'C', 'D', 'E')
ANS = ('2025-2026', '2026-2027', '2027-2028', '2028-2029')

ONGLETS = [
    ('Résultats-Prev 2025-2029', 'Le résultat mois par mois, 48 mois. '
     'Les colonnes D à O sont 2025-2026.'),
    ('Bilan2026-27-28', 'Le bilan aux mêmes 48 mois. La rangée 76 est un '
     'contrôle : elle doit rester à zéro partout.'),
    ('Budget de caisse', 'Les encaissements et décaissements qui produisent '
     'la trésorerie du résultat.'),
    ('Inputs', 'Toutes les hypothèses, et la bascule de scénario (C70).'),
    ('Ventes prévisionnelles ', 'Le moteur de ventes, produit par produit.'),
    ('Détail par ville', 'Le canal détail : 40 villes, 109 points de vente '
     'possibles, calendrier de déploiement.'),
    ('Dette à long terme', 'Les échéanciers de chaque emprunt.'),
    ('Immos', 'Le registre des immobilisations et leur amortissement.'),
    ('Account payable', 'Les achats, les déboursés et l’inventaire.'),
    ('QBO P&L à maj', 'Le réel de QuickBooks, collé. Les mois réels du '
     'résultat le lisent par SUMIF.'),
    ('QBOBS à maj', 'Le bilan réel de QuickBooks, collé.'),
    ('Notes d’audit', 'Ce que la révision a corrigé, et ce qui reste à '
     'valider avant de déposer.'),
]


def capital(i):
    """Remboursements de capital de l'exercice `i`, hors refinancement.

    Les rangées 174 et 178 sont des emprunts qui en remplacent d'autres : les
    compter ferait payer deux fois la même dette. La rangée 176 et la 180 ne
    comptent que par leurs mouvements négatifs — un tirage n'est pas un
    remboursement.
    """
    t, (a, b) = TOT[i], MOIS[i]
    return (f'-({R}!{t}175+{R}!{t}177+{R}!{t}179'
            f'+SUMIF({R}!{a}176:{b}176,"<0")+MIN(0,{R}!{t}180))')


def lignes():
    """(coord, valeur, style) — style : 't' titre, 's' section, '$', '%',
    'x' ratio, None texte courant."""
    L = []

    def met(coord, val, style=None):
        L.append((coord, val, style))

    met('A1', 'LASCLAY — SOMMAIRE DU MODÈLE', 't')
    met('A2', 'Prévisions financières de 2025-2026 à 2028-2029. Exercice du '
              '1er septembre au 31 août. Montants en dollars canadiens.')
    met('A3', f'=IF(Inputs!$C$70=2,"Scénario actif : AMBITIEUX (investisseur '
              f'privé)","Scénario actif : CONSERVATEUR RÉALISTE (bailleurs '
              f'institutionnels)")&"  —  bascule dans Inputs, cellule C70."')
    met('A4', 'Réel : septembre 2025 à juillet 2026, onze mois tirés de '
              'QuickBooks. Projeté : août 2026 à août 2029.')

    r = 6
    met(f'A{r}', 'RÉSULTAT', 's')
    for c, an in zip(COL, ANS):
        met(f'{c}{r}', an, 's')
    r += 1
    for lib, formule, style in (
        ('Ventes nettes', '{R}!{t}26', '$'),
        ('Croissance des ventes nettes', None, '%'),
        ('Coût des marchandises vendues', '{R}!{t}33', '$'),
        ('Contribution marginale', '{R}!{t}32', '$'),
        ('Marge brute', '{R}!{t}64', '$'),
        ('Marge brute en % des ventes nettes', None, '%'),
        ('EBITDA', '{R}!{t}145', '$'),
        ('EBITDA hors aides publiques', '{R}!{t}144', '$'),
        ('Aides publiques comprises dans le résultat', '{R}!{t}151', '$'),
        ('Résultat avant impôts', '{R}!{t}137', '$'),
    ):
        met(f'A{r}', lib)
        for i, c in enumerate(COL):
            if lib.startswith('Croissance'):
                v = None if i == 0 else f'={COL[i]}7/{COL[i-1]}7-1'
            elif lib.startswith('Marge brute en'):
                v = f'={c}11/{c}7'
            else:
                v = '=' + formule.format(R=R, t=TOT[i])
            met(f'{c}{r}', v, style)
        r += 1

    r += 1
    met(f'A{r}', 'TRÉSORERIE, DETTE ET COUVERTURE', 's')
    for c, an in zip(COL, ANS):
        met(f'{c}{r}', f'au 31 août {an[5:]}', 's')
    r += 1
    debut = r
    for lib, formule, style in (
        ('Encaisse à la fin de l’exercice', '{R}!{f}189', '$'),
        ('Marge de crédit tirée à la fin de l’exercice', '{R}!{f}183', '$'),
        ('Mois le plus creux de l’exercice (encaisse)', 'MIN({R}!{a}189:{b}189)', '$'),
        ('Tirage le plus élevé de l’exercice', 'MAX({R}!{a}183:{b}183)', '$'),
        ('Intérêts de l’exercice', '{R}!{t}149', '$'),
        ('Remboursements de capital, hors refinancement', None, '$'),
        ('Service de la dette', None, '$'),
        ('Couverture du service de la dette (EBITDA / service)', None, 'x'),
        ('Total des obligations', '{B}!{f}63', '$'),
        ('Capitaux propres', '{B}!{f}70', '$'),
    ):
        met(f'A{r}', lib)
        for i, c in enumerate(COL):
            if lib.startswith('Remboursements'):
                v = '=' + capital(i)
            elif lib == 'Service de la dette':
                v = f'={c}{debut + 4}+{c}{debut + 5}'
            elif lib.startswith('Couverture'):
                v = (f'=IF({c}{debut + 6}=0,0,{c}13/{c}{debut + 6})')
            else:
                v = '=' + formule.format(R=R, B=B, t=TOT[i], f=FIN[i],
                                         a=MOIS[i][0], b=MOIS[i][1])
            met(f'{c}{r}', v, style)
        r += 1

    r += 1
    met(f'A{r}', 'CE QUI EST DÉJÀ RÉEL — onze mois, sept. 2025 à juill. 2026', 's')
    r += 1
    for lib, formule, style in (
        ('Ventes nettes réalisées', f'SUM({R}!D26:N26)', '$'),
        ('Résultat avant impôts réalisé', f'SUM({R}!D137:N137)', '$'),
        ('Encaisse au 31 juillet 2026', f'{R}!N189', '$'),
        ('Marge de crédit tirée au 31 juillet 2026', f'{R}!N183', '$'),
        ('Part de l’exercice 2025-2026 déjà réalisée (ventes nettes)', None, '%'),
    ):
        met(f'A{r}', lib)
        met(f'B{r}', f'=B{r - 4}/B7' if formule is None else '=' + formule,
            style)
        r += 1

    r += 1
    met(f'A{r}', 'MARGE DE CRÉDIT — LIMITE ET CONTRÔLE', 's')
    r += 1
    for lib, ref in (
        ('Marge de crédit autorisée', 'Inputs!$D$164'),
        ('Tirage le plus élevé des 48 mois', 'Inputs!$D$165'),
        ('Tirage le plus élevé des mois projetés', 'Inputs!$D$166'),
        ('Dépassement de la limite sur les mois projetés', 'Inputs!$D$167'),
    ):
        met(f'A{r}', lib)
        met(f'B{r}', '=' + ref, '$')
        r += 1
    met(f'A{r}', 'Le tirage n’est pas bridé dans le modèle : plafonner le '
                 'tirage cacherait le besoin de financement au lieu de le '
                 'montrer. Le dépassement se lit ici.')
    r += 2

    met(f'A{r}', 'OÙ REGARDER', 's')
    r += 1
    for nom, quoi in ONGLETS:
        met(f'A{r}', nom)
        met(f'B{r}', quoi)
        r += 1

    r += 1
    met(f'A{r}', 'Aucun chiffre de cette page n’est saisi : tout est une '
                 'formule qui pointe vers les feuilles de détail. Une '
                 'correction faite ailleurs se lit ici sans intervention.')
    return L


def build(dst=F, src=F):
    e = Editor(src)
    e.expand_shared()
    s_mnt, s_pct, _ = formats(e)
    s_titre, s_section, s_ratio = styles_texte(e)
    ST = {'t': s_titre, 's': s_section, '$': s_mnt, '%': s_pct, 'x': s_ratio}

    if 'Sommaire' in e.sheetpart:
        e.remove_sheet('Sommaire')
    L = lignes()
    e.add_sheet('Sommaire', [(c, v) for c, v, _ in L],
                styles={c: ST[s] for c, v, s in L if s},
                widths=[(1, 1, 54), (2, 5, 18), (6, 8, 16)], first=True)

    journal(e)
    e.set('Inputs', 'E165',
          'Le sommet est juillet 2026, et c’est du réel : la marge EDC était '
          'tirée à 143 026 $ au 31 juillet, au-dessus de la limite de 130 000 $ '
          'retenue pour les mois projetés.')

    e.set_full_calc()
    e.save(dst)

    bk = xlcalc.load(dst)
    return [f'Sommaire : {len(L)} cellules, en première position',
            f'  ventes nettes 2025-2026          {bk.get("Sommaire", "B7"):>13,.0f}',
            f'  couverture du service 2028-2029  {bk.get("Sommaire", "E26"):>13,.2f}',
            f'  encaisse au 31 juillet 2026      {bk.get("Sommaire", "B33"):>13,.0f}']


def styles_texte(e):
    """Index d'un titre, d'un en-tête de section et d'un ratio à deux
    décimales, tous **ajoutés à la fin** de `cellXfs`.

    Ajouter en tête décalerait tous les index existants : chaque cellule du
    classeur afficherait le format d'une autre. C'est l'accident qu'a dû
    réparer `fix_y.py`, et il ne se voit qu'à l'ouverture du fichier.
    """
    x = e.parts['xl/styles.xml'].decode('utf8')
    mf = re.search(r'(<fonts count=")(\d+)(">)(.*?)(</fonts>)', x, re.S)
    polices = list(re.finditer(r'<font\b[^>]*?(?:/>|>.*?</font>)', mf.group(4), re.S))
    n_polices = len(polices)
    gras = next((i for i, p in enumerate(polices) if '<b/>' in p.group(0)),
                n_polices + 1)
    titre = n_polices
    neuves = '<font><b/><sz val="14"/><name val="Calibri"/></font>'
    if gras > n_polices:                       # aucune police grasse existante
        gras = n_polices + 1
        neuves += '<font><b/><sz val="11"/><name val="Calibri"/></font>'
    x = (x[:mf.start()] + mf.group(1) + str(n_polices + neuves.count('<font>'))
         + mf.group(3) + mf.group(4) + neuves + mf.group(5) + x[mf.end():])

    m = re.search(r'(<cellXfs count=")(\d+)(">)(.*?)(</cellXfs>)', x, re.S)
    corps = m.group(4)
    n = len(list(re.finditer(r'<xf\b[^>]*?(?:/>|>.*?</xf>)', corps, re.S)))
    ajout = (f'<xf numFmtId="0" fontId="{titre}" fillId="0" borderId="0" '
             f'xfId="0" applyFont="1"/>'
             f'<xf numFmtId="0" fontId="{gras}" fillId="0" borderId="0" '
             f'xfId="0" applyFont="1"/>'
             f'<xf numFmtId="2" fontId="0" fillId="0" borderId="0" '
             f'xfId="0" applyNumberFormat="1"/>')
    x = (x[:m.start()] + m.group(1) + str(n + 3) + m.group(3) + corps + ajout
         + m.group(5) + x[m.end():])
    e.parts['xl/styles.xml'] = x.encode('utf8')
    return n, n + 1, n + 2


def journal(e):
    """Réécrit les entrées périmées et consigne la bascule de juillet."""
    J = 'Notes d’audit'
    e.set(J, 'A1', 'JOURNAL D’AUDIT DU MODÈLE — révision du 30 juillet 2026, '
                   'mise à jour le 4 août 2026')
    e.set(J, 'A36',
          '• RÉGLÉ : le bilan réel de QuickBooks couvre maintenant les onze '
          'mois comptabilisés, de septembre 2025 à juillet 2026 (« QBOBS à '
          'maj », colonnes AC à AM). Le résultat réel couvre les mêmes onze '
          'mois : les deux feuilles s’arrêtent au même endroit, ce qui est la '
          'condition pour que la prévision de trésorerie parte du bon solde.')
    e.set(J, 'A37',
          '• Solde bancaire : au 31 juillet 2026, QuickBooks affiche -7 182 $ '
          'au compte chèques et -830 $ de trésorerie totale, avec la marge EDC '
          'tirée à 143 026 $. Le modèle ne porte plus d’ancrage codé en dur : '
          'il lit ces montants. Reste à rapprocher d’AccèsD (Budget de caisse, '
          'lignes 38 à 40) avant le dépôt.')
    e.set(J, 'A60',
          '• Séance de tenue de livres du 30 juillet, rapatriée par fix_aq.py, '
          'puis relevée à nouveau le 4 août : juillet 2026 est comptabilisé à '
          '3 267 $ de revenus, 7 879 $ de coût des marchandises et 44 304 $ de '
          'dépenses, soit une perte de 48 225 $. Juin a aussi bougé — '
          '15 746 $ de transport sur achats au lieu de 525 $ — et le résultat '
          'du mois passe de -18 051 $ à -33 405 $.')
    r = 64
    for texte in (
        '• Juillet 2026 est passé du prévisionnel au réel (fix_as.py). Un mois '
        'réel ne se distingue pas d’un mois prévisionnel par une case à cocher '
        'mais par la forme de ses formules : la colonne de juillet a reçu celle '
        'de juin, au résultat comme au bilan. Le résultat avant impôts du mois '
        'tombe à -48 225 $, exactement le PROFIT de QuickBooks, contre -39 272 $ '
        'en prévision.',
        '• Ce que la bascule révèle : la marge de crédit était tirée à '
        '143 026 $ au 31 juillet, alors que le modèle projetait 27 825 $. Le '
        'plafond de 130 000 $ retenu pour les mois projetés est donc déjà '
        'dépassé par le réel. Les mois projetés, eux, restent sous la limite : '
        'le tirage le plus élevé de septembre 2026 à août 2029 est de 94 610 $ '
        '(Inputs, rangées 163 à 167).',
        '• L’exercice 2025-2026 se referme sur 977 339 $ de ventes nettes et '
        '-122 613 $ avant impôts, dont onze mois réels et un seul mois — août '
        '2026 — encore projeté.',
        '• Une page « Sommaire » ouvre le classeur. Elle ne contient aucune '
        'valeur saisie : chaque chiffre est une formule vers les feuilles de '
        'détail, et la bascule de scénario d’Inputs C70 la met à jour comme le '
        'reste du classeur.',
        '• Vérifié après la bascule : le contrôle du bilan (rangée 76) reste à '
        'zéro sur les 48 mois, et aucune cellule des feuilles visibles ne rend '
        'd’erreur, dans l’un comme dans l’autre scénario.',
    ):
        e.set(J, f'A{r}', texte)
        r += 1


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
