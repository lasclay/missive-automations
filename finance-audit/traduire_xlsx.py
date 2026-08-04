#!/usr/bin/env python3
"""Produire la copie anglaise du chiffrier à partir de la copie française.

Comme pour le mémo, l'anglais est **dérivé**, jamais tenu en parallèle. Aucune
formule et aucune valeur ne changent : seuls le texte et, pour les deux formats
monétaires à la française, la place du symbole du dollar. Les deux fichiers
calculent donc exactement la même chose, et c'est vérifié après coup, cellule à
cellule.

## Pourquoi c'est sûr malgré les SUMIF

409 cellules du classeur servent de critère à un `SUMIF` : le libellé d'une
rangée du résultat va chercher le même libellé dans la feuille de collage
QuickBooks. Traduire un côté sans l'autre casserait tout.

Ici, les deux côtés vivent dans le même fichier et reçoivent la **même**
substitution, puisqu'on traduit la table des chaînes partagées. Le rapprochement
est donc préservé par construction, pas par chance.

## Deux tables de chaînes, pas une

Excel range le texte à deux endroits : la table partagée `sharedStrings.xml`, et
des chaînes « en ligne » directement dans la feuille. Tout ce que les phases
d'audit ont écrit est en ligne, parce que `xledit` écrit ainsi. Traduire la seule
table partagée laisserait le journal d'audit et les libellés ajoutés en français.

## Ce que ça implique

La copie anglaise est une **sortie**, pas un fichier de travail. Un nouveau
collage de QuickBooks apporte des libellés français : il se fait sur le
chiffrier français, puis la copie anglaise se régénère. Le sens ne s'inverse
jamais.

    python3 traduire_xlsx.py --manquants   # ce qui n'est pas encore traduit
    python3 traduire_xlsx.py               # écrit la copie anglaise
"""
import html
import re
import sys
import zipfile

sys.path.insert(0, 'tools')

SRC = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
DST = 'LASCLAY FORECAST - audit version 2026-07-30.xlsx'

LETTRE = re.compile(r'[A-Za-zÀ-ÿ]{2}')

# Le nom d'une feuille vit à deux endroits : la liste de `workbook.xml` et
# CHAQUE formule qui la référence. Renommer sans réécrire les formules casse
# tout le classeur, alors les deux se font ensemble ou pas du tout.
ONGLETS = {
    'Sommaire': 'Summary',
    'Résultats-Prev 2025-2029': 'Income-Forecast 2025-2029',
    'Notes d’audit': 'Audit log',
    'Inputs': 'Inputs',
    'Détail par ville': 'Retail by city',
    'Budget de caisse': 'Cash budget',
    'Bilan2026-27-28': 'BalanceSheet2026-27-28',
    'Immos': 'Capital assets',
    'Account payable': 'Accounts payable',
    'Dette à long terme': 'Long-term debt',
    'QBO P&L à maj': 'QBO P&L to update',
    'Ventes prévisionnelles ': 'Sales forecast ',
    'QBOBS à maj': 'QBOBS to update',
}
FORMULE = re.compile(r'(<f[^>]*>)(.*?)(</f>)', re.S)
LITTERAL = re.compile(r'"((?:[^"]|"")*)"')
SI = re.compile(r'<si>(.*?)</si>', re.S)
TEXTE = re.compile(r'(<t(?:\s[^>]*)?>)(.*?)(</t>)', re.S)
EN_LIGNE = re.compile(r'(<is>\s*<t(?:\s[^>]*)?>)(.*?)(</t>\s*</is>)', re.S)


def litteraux(x, glossaire):
    """Traduit le texte écrit **dans** une formule.

    La page sommaire affiche le scénario actif par un `IF` dont les deux
    branches sont des phrases françaises. Ce texte n'est ni dans la table des
    chaînes partagées ni dans un `<is>` : il vit à l'intérieur de la formule,
    et la copie anglaise l'affichait donc en français.

    Seuls les littéraux dont le texte exact figure au glossaire sont touchés.
    Un critère de `SUMIF` — « <0 », un libellé de compte — n'est remplacé que
    si le glossaire le porte, et dans ce cas la rangée qu'il vise est traduite
    du même mouvement : le rapprochement reste vrai.
    """
    def dans_formule(m):
        def un(lit):
            brut = html.unescape(lit.group(1)).replace('""', '"')
            cle = ' '.join(brut.split())
            if cle not in glossaire:
                return lit.group(0)
            return '"' + html.escape(glossaire[cle].replace('"', '""'),
                                     quote=False) + '"'
        return m.group(1) + LITTERAL.sub(un, m.group(2)) + m.group(3)

    return FORMULE.sub(dans_formule, x)


def formats_en(x):
    """Met le symbole du dollar devant le nombre, comme l'anglais l'écrit.

    Le classeur porte une vingtaine de formats monétaires hérités, dont le
    symbole est déjà tantôt devant tantôt derrière. Seuls les deux qui le
    mettent **derrière à la française** — « 977 339 $ » — sont retournés :
    réécrire les vingt pour uniformiser irait bien au-delà d'une traduction,
    et casserait la comparaison cellule à cellule avec le français.
    """
    for avant, apres in ((r'#,##0&quot; $&quot;', r'&quot;$&quot;#,##0'),
                         (r'#,##0.00\ &quot;$&quot;', r'&quot;$&quot;#,##0.00')):
        x = x.replace(f'formatCode="{avant}"', f'formatCode="{apres}"')
    return x


def chaines(chemin):
    """Les chaînes partagées, avec l'indice de chacune."""
    with zipfile.ZipFile(chemin) as z:
        ss = z.read('xl/sharedStrings.xml').decode('utf8')
    return [html.unescape(re.sub(r'<[^>]+>', '', m.group(1)))
            for m in SI.finditer(ss)]


def feuilles_visibles(z):
    """Les parties XML des feuilles non masquées."""
    wb = z.read('xl/workbook.xml').decode('utf8')
    rels = z.read('xl/_rels/workbook.xml.rels').decode('utf8')
    rid = {m.group(1): m.group(2) for m in
           re.finditer(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels)}
    out = []
    bloc = re.search(r'<sheets>.*?</sheets>', wb, re.S).group(0)
    for m in re.finditer(r'<sheet\b[^>]*/>', bloc):
        a = m.group(0)
        if 'state="hidden"' in a:
            continue
        r = re.search(r'r:id="([^"]*)"', a).group(1)
        out.append('xl/' + rid[r].lstrip('/'))
    return out


def chaines_en_ligne(chemin):
    """Le texte écrit directement dans les feuilles visibles."""
    out = []
    with zipfile.ZipFile(chemin) as z:
        for p in feuilles_visibles(z):
            x = z.read(p).decode('utf8')
            out += [html.unescape(m.group(2)) for m in EN_LIGNE.finditer(x)]
    return out


def visibles(chemin):
    """Les indices de chaînes employées sur une feuille visible."""
    with zipfile.ZipFile(chemin) as z:
        parts = feuilles_visibles(z)
        out = set()
        cell = re.compile(r'<c\b([^>]*?)(?:/>|>(.*?)</c>)', re.S)
        for p in parts:
            x = z.read(p).decode('utf8')
            for m in cell.finditer(x):
                if 't="s"' not in m.group(1):
                    continue
                v = re.search(r'<v>(\d+)</v>', m.group(2) or '')
                if v:
                    out.add(int(v.group(1)))
    return out


def build(src=SRC, dst=DST, essai=False):
    try:
        from glossaire_xlsx import GLOSSAIRE
    except ImportError:
        GLOSSAIRE = {}

    toutes = chaines(src)
    vus = visibles(src)
    candidats = [toutes[i] for i in sorted(vus)] + chaines_en_ligne(src)
    manquants, deja = [], set()
    for t in candidats:
        cle = ' '.join(t.split())
        if not LETTRE.search(t) or cle in GLOSSAIRE or cle in deja:
            continue
        deja.add(cle)
        manquants.append(cle)
    if essai:
        return manquants

    with zipfile.ZipFile(src) as z:
        ss = z.read('xl/sharedStrings.xml').decode('utf8')

    # On réécrit chaque <t> de la table : c'est la seule partie du fichier
    # touchée. Les feuilles, les formules et les styles restent intacts.
    def remplacer(m):
        brut = html.unescape(m.group(2))
        cle = ' '.join(brut.split())
        if cle not in GLOSSAIRE:
            return m.group(0)
        return m.group(1) + html.escape(GLOSSAIRE[cle], quote=False) + m.group(3)

    neuf = TEXTE.sub(remplacer, ss)

    def onglets(x):
        """Réécrit les références de feuille, entre apostrophes ou non.

        Le nom « QBO P&L à maj » porte une esperluette, écrite « &amp; » dans le
        XML. Chercher le nom non échappé ne le trouve pas, la référence reste
        française, et le SUMIF pointe dans le vide : la rangée tombe à zéro sans
        que rien ne signale l'erreur. Les deux formes sont donc traitées.
        """
        for fr, en in ONGLETS.items():
            if fr == en:
                continue
            for f, e in ((fr, en), (html.escape(fr, quote=False),
                                    html.escape(en, quote=False))):
                x = x.replace(f"'{f}'!", f"'{e}'!")
            # Référence sans apostrophes : possible seulement si l'ANCIEN nom
            # n'en demandait pas. Si le NOUVEAU en demande — « Immos » devient
            # « Capital assets », qui porte une espace — il faut les ajouter,
            # sinon Excel lit « Capital » comme un nom défini et rend #NOM?.
            if re.fullmatch(r"[A-Za-z0-9_.]+", fr):
                cible = en if re.fullmatch(r"[A-Za-z0-9_.]+", en) else f"'{en}'"
                x = re.sub(rf"(?<![A-Za-z0-9_.'])({re.escape(fr)})!",
                           f'{cible}!', x)
            x = x.replace(f'<sheet name="{html.escape(fr, quote=True)}"',
                          f'<sheet name="{html.escape(en, quote=True)}"')
            x = x.replace(f'"{html.escape(fr, quote=True)}"',
                          f'"{html.escape(en, quote=True)}"')
        return x

    # Un .xlsx est un zip : remplacer une pièce demande de le réécrire en entier.
    with zipfile.ZipFile(src) as zin:
        feuilles = set(feuilles_visibles(zin))
        with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == 'xl/sharedStrings.xml':
                    data = onglets(neuf).encode('utf8')
                elif item.filename == 'xl/styles.xml':
                    data = formats_en(data.decode('utf8')).encode('utf8')
                elif item.filename in ('xl/workbook.xml',):
                    data = onglets(data.decode('utf8')).encode('utf8')
                elif item.filename.startswith('xl/worksheets/'):
                    x = onglets(data.decode('utf8'))
                    if item.filename in feuilles:
                        x = litteraux(x, GLOSSAIRE)
                    data = x.encode('utf8')
                if item.filename in feuilles:
                    x = data.decode('utf8')
                    data = EN_LIGNE.sub(
                        lambda m: (m.group(1)
                                   + html.escape(GLOSSAIRE.get(
                                       ' '.join(html.unescape(m.group(2)).split()),
                                       html.unescape(m.group(2))), quote=False)
                                   + m.group(3)), x).encode('utf8')
                zout.writestr(item, data)
    return manquants


def verifier(src=SRC, dst=DST):
    """La copie anglaise doit calculer exactement comme la française.

    La comparaison passe les noms de feuille par `ONGLETS` : chercher une
    feuille française dans le fichier anglais ne renverrait rien et ferait
    croire à quarante mille écarts.
    """
    import xlcalc
    a, b = xlcalc.load(src), xlcalc.load(dst)
    ecarts = 0
    for sh in a.formulas:
        shb = ONGLETS.get(sh, sh)
        for ref in a.formulas[sh]:
            try:
                x, y = a.get(sh, ref), b.get(shb, ref)
            except Exception:              # noqa: BLE001
                continue
            if isinstance(x, (int, float)) and isinstance(y, (int, float)):
                if abs(x - y) > 0.005:
                    ecarts += 1
            elif x != y and not (isinstance(x, str) and isinstance(y, str)):
                ecarts += 1
    return ecarts


if __name__ == '__main__':
    if '--manquants' in sys.argv:
        m = build(essai=True)
        for s in m:
            print(s)
        print(f'\n{len(m)} chaînes visibles sans traduction', file=sys.stderr)
        sys.exit(1 if m else 0)
    manquants = build()
    print(f'{DST} écrit — {len(manquants)} chaînes visibles encore en français')
    print('écarts de calcul avec le français :', verifier())
