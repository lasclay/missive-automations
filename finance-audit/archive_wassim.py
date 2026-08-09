#!/usr/bin/env python3
"""Reconstituer, nommer et documenter la version optimiste de juillet 2026.

La proposition à Wassim Gharmoul annonce 1,03 / 1,65 / 3,1 / 4,5 M$ de ventes.
Ces quatre nombres viennent de `prev_orig.xlsx`, le classeur d'avant la
révision, et plus précisément de sa **rangée 18, « Ventes escomptées »** :
1 052 270 / 1 657 606 / 3 059 261 / 4 440 823. La correspondance est exacte au
millier près sur trois exercices sur quatre.

Le bénéfice avant impôts annoncé, lui, ne vient pas de ce classeur. La
proposition écrit -52 / +347 / +559 / +1 070 k$ ; la rangée 137 du classeur
porte -96 / +284 / +683 / +1 230 k$. Ni décalage constant ni facteur commun :
ce sont deux séries différentes. Si Wassim demande à voir le modèle, l'écart se
verra.

## Pourquoi ce fichier ne peut pas circuler tel quel

Il porte encore ce que la révision a corrigé : une référence morte `#REF!` dans
« Account Recevables », et un bilan qui ne balance pas sur **42 des 48 mois**,
jusqu'à 20 190 $ d'écart. Il ignore aussi le canal détail et n'a pas de bascule
de scénario, et son exercice 2025-2026 annonce 986 383 $ de ventes nettes là où
QuickBooks en montre 977 339 $ sur onze mois réels.

D'où la feuille d'avertissement posée en tête : un classeur d'archive qui ne
dit pas qu'il est une archive finit par être lu comme s'il ne l'était pas.

    python3 archive_wassim.py
"""
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

SRC = 'prev_orig.xlsx'
DST = 'PREVISIONS LASCLAY - version optimiste juillet 2026 (Wassim) - ARCHIVE.xlsx'
AUDIT = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
S = 'Résultats-Prev 2025-2029'
T = ('P', 'AD', 'AR', 'BF')
ANS = ('2025-2026', '2026-2027', '2027-2028', '2028-2029')

# Ce que la proposition annonce, page 3 et page 5.
WASSIM_VENTES = (1_030_000, 1_650_000, 3_100_000, 4_500_000)
WASSIM_PAI = (-52_000, 347_000, 559_000, 1_070_000)


def lignes(vieux, neuf):
    L, r = [], 1

    def met(coord, val, style=None):
        L.append((coord, val, style))

    met('A1', 'ARCHIVE — VERSION OPTIMISTE DE JUILLET 2026', 't')
    met('A2', 'Ce classeur est celui d’où viennent les chiffres de ventes de la '
              'proposition de partenariat présentée à Wassim Gharmoul. Il est '
              'conservé pour que ces chiffres restent traçables.')
    met('A3', 'CE N’EST PAS LA VERSION DE DÉPÔT. Le dossier remis aux prêteurs '
              'et aux investisseurs est « PREVISIONS LASCLAY - version audit '
              '2026-07-30.xlsx », avec son mémo explicatif.', 's')

    r = 5
    met(f'A{r}', 'D’OÙ VIENNENT LES CHIFFRES DE LA PROPOSITION', 's')
    for c, an in zip(('B', 'C', 'D', 'E'), ANS):
        met(f'{c}{r}', an, 's')
    r += 1
    for lib, vals, style in (
        ('Ventes annoncées dans la proposition', WASSIM_VENTES, '$'),
        ('Ce classeur, rangée 18 « Ventes escomptées »',
         tuple(vieux.get(S, t + '18') for t in T), '$'),
        ('Écart', tuple(vieux.get(S, t + '18') - w
                        for t, w in zip(T, WASSIM_VENTES)), '$'),
    ):
        met(f'A{r}', lib)
        for c, v in zip(('B', 'C', 'D', 'E'), vals):
            met(f'{c}{r}', float(v), style)
        r += 1
    met(f'A{r}', 'La correspondance est exacte au millier près sur trois '
                 'exercices sur quatre : la ligne de revenu de la proposition '
                 'est bien la rangée 18 de ce classeur.')
    r += 2

    met(f'A{r}', 'CE QUI NE CONCORDE PAS', 's')
    r += 1
    for lib, vals, style in (
        ('Bénéfice avant impôts annoncé dans la proposition', WASSIM_PAI, '$'),
        ('Ce classeur, rangée 137', tuple(vieux.get(S, t + '137') for t in T), '$'),
        ('Écart', tuple(vieux.get(S, t + '137') - w
                        for t, w in zip(T, WASSIM_PAI)), '$'),
    ):
        met(f'A{r}', lib)
        for c, v in zip(('B', 'C', 'D', 'E'), vals):
            met(f'{c}{r}', float(v), style)
        r += 1
    met(f'A{r}', 'Ni décalage constant ni facteur commun : la série de bénéfices '
                 'de la proposition ne sort pas de ce classeur. À retracer avant '
                 'toute discussion chiffrée avec Wassim.')
    r += 2

    met(f'A{r}', 'CE CLASSEUR COMPARÉ AU MODÈLE AUDITÉ (scénario conservateur)', 's')
    for c, an in zip(('B', 'C', 'D', 'E'), ANS):
        met(f'{c}{r}', an, 's')
    r += 1
    for lib, ref in (('Ventes nettes — cette archive', 26),
                     ('Ventes nettes — modèle audité', None),
                     ('Résultat avant impôts — cette archive', 137),
                     ('Résultat avant impôts — modèle audité', None)):
        met(f'A{r}', lib)
        rr = 26 if 'Ventes' in lib else 137
        src = vieux if 'archive' in lib else neuf
        for c, t in zip(('B', 'C', 'D', 'E'), T):
            met(f'{c}{r}', float(src.get(S, t + str(rr))), '$')
        r += 1
    r += 1

    met(f'A{r}', 'CE QUE CE CLASSEUR PORTE ENCORE, ET QUE LA RÉVISION A CORRIGÉ', 's')
    r += 1
    for texte in (
        'Une référence morte #REF! dans la feuille « Account Recevables », '
        'qui était la source des erreurs propagées dans la trésorerie.',
        'Un bilan qui ne balance pas sur 42 des 48 mois, jusqu’à 20 190 $ '
        'd’écart entre l’actif et la somme du passif et du capital.',
        'Aucun canal détail : les ventes en consignation, 13 801 $ réalisés en '
        '2025-2026, n’y figurent pas.',
        'Aucune bascule de scénario : un seul jeu d’hypothèses, sans lecture '
        'prudente.',
        'Un exercice 2025-2026 à 986 383 $ de ventes nettes, contre 977 339 $ '
        'chez QuickBooks avec onze mois réels comptabilisés.',
        'Une trajectoire 2026-2029 obtenue en multipliant chaque année par un '
        'facteur unique, sans justification par produit ni par canal.',
    ):
        met(f'A{r}', '•  ' + texte)
        r += 1
    return L


def build():
    vieux = xlcalc.load(SRC)
    neuf = xlcalc.load(AUDIT)
    e = Editor(SRC)
    e.expand_shared()

    # Un format monétaire : le classeur d'origine n'a pas celui que la révision
    # a ajouté, alors on le pose ici plutôt que d'afficher des nombres nus.
    x = e.parts['xl/styles.xml'].decode('utf8')
    import re
    nf = re.search(r'<numFmts count="(\d+)">(.*?)</numFmts>', x, re.S)
    if nf and 'numFmtId="950"' not in x:
        x = (x[:nf.start()] + f'<numFmts count="{int(nf.group(1)) + 1}">'
             + nf.group(2) + '<numFmt numFmtId="950" formatCode="#,##0&quot; $&quot;"/>'
             + '</numFmts>' + x[nf.end():])
    mf = re.search(r'(<fonts count=")(\d+)(">)(.*?)(</fonts>)', x, re.S)
    n_pol = len(re.findall(r'<font\b[^>]*?(?:/>|>.*?</font>)', mf.group(4), re.S))
    x = (x[:mf.start()] + mf.group(1) + str(n_pol + 2) + mf.group(3) + mf.group(4)
         + '<font><b/><sz val="14"/><name val="Calibri"/></font>'
         + '<font><b/><sz val="11"/><name val="Calibri"/></font>'
         + mf.group(5) + x[mf.end():])
    m = re.search(r'(<cellXfs count=")(\d+)(">)(.*?)(</cellXfs>)', x, re.S)
    n = len(re.findall(r'<xf\b[^>]*?(?:/>|>.*?</xf>)', m.group(4), re.S))
    x = (x[:m.start()] + m.group(1) + str(n + 3) + m.group(3) + m.group(4)
         + f'<xf numFmtId="0" fontId="{n_pol}" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
         + f'<xf numFmtId="0" fontId="{n_pol + 1}" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
         + '<xf numFmtId="950" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
         + m.group(5) + x[m.end():])
    e.parts['xl/styles.xml'] = x.encode('utf8')
    ST = {'t': n, 's': n + 1, '$': n + 2}

    L = lignes(vieux, neuf)
    if 'AVERTISSEMENT' in e.sheetpart:
        e.remove_sheet('AVERTISSEMENT')
    e.add_sheet('AVERTISSEMENT', [(c, v) for c, v, _ in L],
                styles={c: ST[s] for c, v, s in L if s},
                widths=[(1, 1, 62), (2, 5, 17)], first=True)
    e.set_full_calc()
    e.save(DST)

    return [f'{DST}',
            f'  {len(L)} cellules d’avertissement, feuille en première position',
            f'  ventes nettes  ' + ' '.join(
                f'{vieux.get(S, t + "26") / 1e6:,.2f} M$' for t in T),
            f'  ventes l.18    ' + ' '.join(
                f'{vieux.get(S, t + "18") / 1e6:,.2f} M$' for t in T),
            f'  résultat       ' + ' '.join(
                f'{vieux.get(S, t + "137") / 1000:,.0f} k$' for t in T)]


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
