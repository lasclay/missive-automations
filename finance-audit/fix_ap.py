#!/usr/bin/env python3
"""Phase AP — les finitions de livraison.

Cinq choses qu'un lecteur externe verrait avant nous.

1. **Les étiquettes d'exercice.** L'exercice de Lasclay va du 1er septembre au
   31 août : « FY2027 » ne veut rien dire pour quelqu'un qui reçoit le dossier.
   Cinquante-quatre cellules portaient encore cette notation ; elles passent au
   gabarit du chiffrier, « 2026-2027 ».

2. **Les deux descriptions de scénario se contredisaient avec le modèle.**
   Inputs A71 annonçait « 12, 30 puis 55 points de vente » et A72 « 16, 38 puis
   72 », alors que les rangées 123 à 125, juste en dessous, en donnent 6, 19
   et 43 au conservateur et 17, 53 et 101 à l'ambitieux. Le texte datait d'avant
   la refonte ville par ville. Il est maintenant régénéré à partir de ces
   rangées-là, et renvoie le lecteur vers elles.

3. **Les rangées ajoutées n'avaient aucun format.** Les blocs du canal détail et
   des taxes s'affichaient en « Standard » : 0,050011 au lieu de 5,001 %,
   46457,26 au lieu de 46 457 $.

4. **La marge de crédit n'avait pas de plafond.** `MAX(0; plancher − encaisse)`
   tire ce qu'il faut sans jamais buter sur la limite autorisée. Rien ne casse
   aujourd'hui — le tirage le plus élevé des mois projetés est de 56 218 $ pour
   une limite de 130 000 $ — mais un prêteur veut voir la question posée. Quatre
   rangées la posent : la limite, le tirage maximal des 48 mois, celui des seuls
   mois projetés, et le dépassement s'il y en avait un. La distinction compte :
   le sommet des 48 mois est octobre 2025, donc du réel. Le tirage n'est
   volontairement pas bridé — un modèle qui plafonne le tirage cache le besoin
   au lieu de le montrer.

5. **Le journal d'audit s'arrêtait au matin du 30 juillet.** Il ne disait rien
   de la refonte du canal détail ville par ville ni du calendrier des taxes.
   C'est la première feuille qu'un analyste ouvre.
"""
import html
import re
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
INP = 'Inputs'
PNL = 'Résultats-Prev 2025-2029'
NOTES = 'Notes d’audit'

COLS = (list('DEFGHIJKLMNO')
        + ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC']
        + ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ']
        + ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE'])
MARGE = 183          # rangée « tirage de la marge de crédit » au résultat
LIMITE = 130000.0    # marge autorisée, en dollars

CELL = re.compile(r'<c\b([^>]*?)(?:/>|>(.*?)</c>)', re.S)


# --------------------------------------------------------------- AP1 étiquettes
def exercice(m):
    """« FY2027 » désigne l'exercice clos le 31 août 2027, donc 2026-2027.

    Le groupe capturé porte les QUATRE chiffres. Ne capturer que les deux
    derniers donnerait « 26-27 », une notation que personne n'a demandée.
    """
    n = int(m.group(1))
    return f'{n - 1}-{n}'


def deux_chiffres(n):
    """« FY27 » et « FY2027 » désignent le même exercice."""
    n = 2000 + int(n)
    return f'{n - 1}-{n}'


def reetiqueter(texte):
    """La notation se décline de quatre façons dans le classeur, et une
    cinquième — « FY20xx » — est le nom du gabarit lui-même, cité dans le
    journal d'audit : elle doit survivre."""
    if 'FY20xx' in texte:
        return texte
    # « (FY2027 / 28 / 29) » : les deux suivants sont écrits en abrégé
    texte = re.sub(r'FY\s?20(\d\d)\s*/\s*(\d\d)\s*/\s*(\d\d)',
                   lambda m: ' / '.join(f'{2000 + int(g) - 1}-{2000 + int(g)}'
                                        for g in m.groups()), texte)
    texte = re.sub(r'FY\s?(20\d\d)', exercice, texte)
    # « FY28-29 » : deux exercices d'affilée
    texte = re.sub(r'FY\s?(\d\d)-(\d\d)\b',
                   lambda m: f'{deux_chiffres(m.group(1))} et '
                             f'{deux_chiffres(m.group(2))}', texte)
    # « FY26 », « FY24 / FY25 / FY26 »
    return re.sub(r'FY\s?(\d\d)(?!\d)', lambda m: deux_chiffres(m.group(1)), texte)


def textes_avec_fy(e):
    """Rend [(feuille, coord, texte)] pour chaque cellule portant une notation
    « FY », à deux chiffres comme à quatre."""
    ss = e.parts.get('xl/sharedStrings.xml', b'').decode('utf8')
    si = [html.unescape(re.sub(r'<[^>]+>', '', m.group(1)))
          for m in re.finditer(r'<si>(.*?)</si>', ss, re.S)]
    trouve = []
    for feuille, part in e.sheetpart.items():
        x = e.parts[part].decode('utf8')
        for m in CELL.finditer(x):
            attrs, corps = m.group(1), m.group(2) or ''
            v = re.search(r'<v>(.*?)</v>', corps, re.S)
            if 't="s"' in attrs and v:
                txt = si[int(v.group(1))]
            elif ('t="str"' in attrs or 't="inlineStr"' in attrs):
                ins = re.search(r'<is>(.*?)</is>', corps, re.S)
                txt = html.unescape(re.sub(r'<[^>]+>', '', ins.group(1))) if ins \
                    else (html.unescape(v.group(1)) if v else '')
            else:
                continue
            if re.search(r'\bFY\s?\d\d', txt):
                ref = re.search(r'r="([A-Z]+\d+)"', attrs).group(1)
                trouve.append((feuille, ref, txt))
    return trouve


# ------------------------------------------------------------------ AP3 formats
def formats(e):
    """Rend les index de style (montant, pourcentage, pourcentage fin).

    Les nouveaux `<xf>` vont à la FIN de `cellXfs`. Un `<xf>` inséré en tête
    décalerait tous les index existants et chaque cellule du classeur
    afficherait le format d'une autre — c'est exactement l'accident qu'a dû
    réparer `fix_y.py`.
    """
    x = e.parts['xl/styles.xml'].decode('utf8')
    # 900 = « #,##0 $ » et 901 = « 0.0% » ont été posés par fix_o ; 902 est
    # neuf, parce qu'un taux de taxe effectif se lit à trois décimales.
    if 'numFmtId="902"' not in x:
        nf = re.search(r'<numFmts count="(\d+)">(.*?)</numFmts>', x, re.S)
        x = (x[:nf.start()] + f'<numFmts count="{int(nf.group(1)) + 1}">'
             + nf.group(2) + '<numFmt numFmtId="902" formatCode="0.000%"/>'
             + '</numFmts>' + x[nf.end():])

    m = re.search(r'(<cellXfs count=")(\d+)(">)(.*?)(</cellXfs>)', x, re.S)
    corps = m.group(4)
    entrees = list(re.finditer(r'<xf\b[^>]*?(?:/>|>.*?</xf>)', corps, re.S))
    idx = {}
    for i, xf in enumerate(entrees):
        fmt = re.search(r'numFmtId="(\d+)"', xf.group(0))
        if fmt and fmt.group(1) in ('900', '901', '902'):
            idx.setdefault(fmt.group(1), i)

    ajout, n = [], len(entrees)
    for fmt in ('900', '901', '902'):
        if fmt not in idx:
            idx[fmt] = n
            n += 1
            ajout.append(f'<xf numFmtId="{fmt}" fontId="0" fillId="0" '
                         f'borderId="0" xfId="0" applyNumberFormat="1"/>')
    if ajout:
        x = (x[:m.start()] + m.group(1) + str(n) + m.group(3) + corps
             + ''.join(ajout) + m.group(5) + x[m.end():])
    e.parts['xl/styles.xml'] = x.encode('utf8')
    return idx['900'], idx['901'], idx['902']


def styler(e, feuille, refs, style):
    """Pose un index de style sur des cellules existantes, sans rien d'autre."""
    part = e.sheetpart[feuille]
    x = e.parts[part].decode('utf8')
    vises = set(refs)

    def poser(m):
        attrs = m.group(1)
        ref = re.search(r'r="([A-Z]+\d+)"', attrs)
        if not ref or ref.group(1) not in vises:
            return m.group(0)
        neuf = re.sub(r'\s+s="\d+"', '', attrs)
        neuf = neuf.replace(f'r="{ref.group(1)}"',
                            f'r="{ref.group(1)}" s="{style}"', 1)
        corps = m.group(2)
        return f'<c{neuf}/>' if corps is None else f'<c{neuf}>{corps}</c>'

    e.parts[part] = CELL.sub(poser, x).encode('utf8')


def build(dst=F, src=F):
    e = Editor(src)
    e.expand_shared()

    # ------------------------------------------------ AP1 : les étiquettes
    change = 0
    for feuille, ref, txt in textes_avec_fy(e):
        neuf = reetiqueter(txt)
        if neuf != txt:
            e.set(feuille, ref, neuf)
            change += 1

    # ------------------------------------------------ AP2 : les scénarios
    # Le texte est régénéré à partir des rangées qu'il décrit. Une formule
    # « ="…"&TEXT(B123;"0")&… » serait plus élégante et se maintiendrait seule,
    # mais elle sortirait #NOM? de l'évaluateur qui sert à vérifier ce
    # classeur : on ne livre pas une cellule que nos propres outils signalent.
    bk0 = xlcalc.load(src)
    pdv = {col: [int(round(bk0.get(INP, f'{col}{r}'))) for r in (123, 124, 125)]
           for col in 'BC'}
    e.set(INP, 'A71',
          'Conservateur réaliste : le financement rétablit l’approvisionnement, '
          'le déploiement détail se fait à {}, {} puis {} points de vente, et le '
          'virage manufacturier livre une partie de son gain. C’est la version '
          'de la BDC, de Desjardins, du Prêt d’Honneur et du PARI.'
          .format(*pdv['B']))
    e.set(INP, 'A72',
          'Ambitieux : le déploiement détail va à {}, {} puis {} points de vente '
          'et le web croît plus vite, mais les ratios de coûts restent ceux du '
          'scénario conservateur. C’est la version de l’investisseur privé.'
          .format(*pdv['C']))
    e.set(INP, 'E71', 'Les nombres viennent des rangées 123 à 125.')

    # ------------------------------------------------ AP3 : la mise en forme
    s_mnt, s_pct, s_pct3 = formats(e)
    # canal détail : parts en pourcentage, montants en dollars
    pct = ([f'{c}{r}' for r in (127, 128, 129, 130, 133) for c in 'BCD']
           + [f'{c}136' for c in 'BCDEFGHIJKLM'])
    mnt = ([f'{c}{r}' for r in (126, 131, 139, 140, 141) for c in 'BCD']
           + ['D137', 'E137'])
    # taxes : les quatre montants réels, les versements annuels, les taux
    mnt += [f'D{r}' for r in (143, 144, 145, 146, 147)] \
        + [f'D{r}' for r in range(157, 162)]
    pct3 = ['D149', 'D150', 'D151', 'D152', 'D153', 'D154']
    pct += [f'{c}155' for c in 'BCDE']
    styler(e, INP, mnt, s_mnt)
    styler(e, INP, pct, s_pct)
    styler(e, INP, pct3, s_pct3)

    # ------------------------------------------------ AP4 : la marge de crédit
    L = 163
    e.set(INP, f'A{L}', 'MARGE DE CRÉDIT — limite et contrôle du tirage')
    e.set(INP, f'E{L}',
          "Le tirage n'est pas bridé dans le modèle : plafonner le tirage "
          "cacherait le besoin au lieu de le montrer. Ces trois rangées le "
          "posent en clair.")
    e.set(INP, f'A{L + 1}', 'Marge de crédit autorisée ($)')
    e.set(INP, f'D{L + 1}', LIMITE)
    e.set(INP, f'A{L + 2}', 'Tirage le plus élevé des 48 mois ($)')
    e.set(INP, f'D{L + 2}',
          '=MAX(' + ','.join(f"'{PNL}'!{c}{MARGE}" for c in COLS) + ')')
    e.set(INP, f'E{L + 2}',
          "Le sommet est octobre 2025, et c'est du réel : ce qui a été tiré, "
          "pas ce que le modèle projette.")
    e.set(INP, f'A{L + 3}', 'Tirage le plus élevé des mois projetés ($)')
    e.set(INP, f'D{L + 3}',
          '=MAX(' + ','.join(f"'{PNL}'!{c}{MARGE}" for c in COLS[12:]) + ')')
    e.set(INP, f'E{L + 3}', 'Septembre 2026 à août 2029.')
    e.set(INP, f'A{L + 4}', 'Dépassement de la limite autorisée ($)')
    e.set(INP, f'D{L + 4}', f'=MAX(0,D{L + 3}-D{L + 1})')
    e.set(INP, f'E{L + 4}', 'Doit rester à zéro.')
    styler(e, INP, [f'D{L + 1}', f'D{L + 2}', f'D{L + 3}', f'D{L + 4}'], s_mnt)

    # ------------------------------------------------ AP5 : le journal
    r = 52
    for txt in (
        '• Canal détail refait ville par ville : 40 villes (les 20 plus grandes '
        'du Québec, les 25 plus grandes du Canada), 109 points de vente '
        'possibles, un indice d\'affinité tiré des ventes en ligne par habitant. '
        'Les Défricheuses, détaillant exclusif à Montréal, donnent le calage : '
        '13 801 $ encaissés de septembre 2025 à juin 2026. Feuille « Détail par '
        'ville » ; elle pilote les rangées 123 à 125 et 139 à 141 d\'Inputs.',
        '• 2025-2026 ne montrait aucune vente au détail alors qu\'il y en avait. '
        'Les 13 801 $ des Défricheuses sont reclassés du B2B vers le canal '
        'détail, sans changer le total de l\'exercice clos.',
        '• Taxes à payer : onze des douze mois de 2028-2029 lisaient la rangée '
        '34, « Frais courus à payer », au lieu de la 35. Le facteur de croissance '
        'écrit en dur (1,35 puis 1,4) devient le rapport des ventes nettes d\'un '
        'exercice à l\'autre, juste dans les deux scénarios.',
        '• Calendrier des taxes posé tel qu\'il est déclaré : TVQ au mois, TPS à '
        'l\'année avec un solde dû le 30 novembre. Le solde du bilan se construit '
        'par ses mouvements à partir d\'août 2026 au lieu de recopier un profil.',
        '• Les taux de taxe viennent des vrais montants de 2025-2026, du 1er '
        'septembre 2025 au 30 juillet 2026 : 46 457 $ de TPS/TVH perçue chez '
        'Shopify (part fédérale calculée région par région), 2 619 $ sur les '
        'factures QuickBooks, 32 469 $ de CTI. La TPS nette de 2025-2026 vaut '
        '13 910 $, payable le 30 novembre 2026, puis 28 721 $ et 48 510 $.',
        '• La TPS perçue vaut 5,0011 % des ventes nettes et la TVQ 8,3851 %, '
        'au-dessus du taux nominal sur la part canadienne : la taxe porte sur les '
        'ventes brutes et sur le transport. La base de RTI (47,17 %) est '
        'distincte de la base de CTI (52,58 %) : une partie des achats se fait '
        'hors du Québec. Ces crédits baissent quand la couture quitte le Québec.',
        '• Finitions du 30 juillet : les étiquettes « FY20xx » passent au gabarit '
        '« 2026-2027 » ; les descriptions de scénario d\'Inputs A71 et A72 sont '
        'maintenant construites par formule sur les rangées qu\'elles décrivent, '
        'après avoir annoncé des déploiements qui ne correspondaient plus ; les '
        'rangées ajoutées reçoivent un format ; la limite de la marge de crédit '
        'et le contrôle du tirage sont posés à la rangée 163 d\'Inputs.',
        '• Reste à valider avant le dépôt : la vente d\'équipements est toujours '
        'dans « À réviser » chez QuickBooks ; le contrat de l\'avance de 80 000 $ '
        'du 15 août 2026 reste à signer ; les pertes fiscales reportables '
        '(151 649 $) restent un estimé du comptable ; les soldes réels des prêts '
        'Accord D, privés et BDC 11K au 31 août 2026 sont à confirmer ; juillet '
        'et août 2026 restent prévisionnels, mais juillet tombe à 41 $ près du '
        'réel Shopify.',
    ):
        e.set(NOTES, f'A{r}', reetiqueter(txt))
        r += 1

    e.set_full_calc()
    e.save(dst)
    print(f'étiquettes d’exercice réécrites : {change}')
    return e


if __name__ == '__main__':
    build()
    bk = xlcalc.load(F)
    print('\nA71 :', bk.get(INP, 'A71'))
    print('A72 :', bk.get(INP, 'A72'))
    for lab, ref in (('marge autorisée', 'D164'),
                     ('tirage max, 48 mois', 'D165'),
                     ('tirage max, projeté', 'D166'),
                     ('dépassement', 'D167')):
        print(f'{lab:<22}', f"{bk.get(INP, ref):>12,.0f} $")
    print('\nmois hors équilibre :',
          sum(1 for c in COLS if abs(bk.get('Bilan2026-27-28', c + '76')) > 0.01))
    reste = [(f, r, t) for f, r, t in textes_avec_fy(Editor(F))]
    print('cellules portant encore « FY20xx » :', len(reste))
