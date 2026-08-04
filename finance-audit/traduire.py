#!/usr/bin/env python3
"""Produire la version anglaise du mémo à partir de la version française.

Le mémo anglais ne se réécrit pas : il se **dérive**. Les deux versions sortent
du même `pdf_data.json`, donc du même chiffrier, et un chiffre ne peut pas
diverger d'une langue à l'autre. Seul le texte change.

La traduction s'applique aux **nœuds de texte** du HTML, jamais aux attributs ni
aux coordonnées SVG : traduire une chaîne entière casserait les `viewBox`, les
`d=` des tracés et les classes. C'est la même précaution que la virgule décimale.

Le glossaire vit dans `glossaire_en.py`, une correspondance segment par segment.
Tout segment français sans traduction est **signalé, pas deviné** :

    python3 traduire.py --manquants    # liste ce qui n'est pas encore traduit
    python3 traduire.py                # écrit le HTML et le PDF anglais

À chaque dépôt, relancer `data_pdf.py`, `build_note_bailleurs.py` puis ce
script. Un segment français modifié réapparaît dans `--manquants` : c'est le
filet qui empêche l'anglais de prendre du retard sur le français.
"""
import html
import os
import re
import subprocess
import sys

SRC = 'note_bailleurs.html'
DST = 'note_bailleurs_en.html'
PDF = 'Lasclay - Financial projections 2026-2029 - explanatory memo.pdf'
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

# Un nœud de texte : ce qui se trouve entre « > » et « < ».
NOEUD = re.compile(r'>([^<>]+)<')
# Les zones dont le contenu n'est pas du texte affiché.
OPAQUE = re.compile(r'<(style|script)[^>]*>.*?</\1>', re.S)
# Un segment sans lettre est un nombre, une date ou un symbole : rien à traduire,
# mais il faut quand même le reformater.
LETTRE = re.compile(r'[A-Za-zÀ-ÿ]{2}')

# Une année ou un exercice ne se reformate pas : « 2025-2026 » reste tel quel,
# et « 1 703 504 » n'est pas une année. On protège d'abord, on convertit ensuite.
ANNEE = re.compile(r'\b(19|20)\d\d\b')
# Le séparateur de milliers du chiffrier est une espace fine insécable (U+202F),
# pas une espace ordinaire. La classe doit les nommer toutes les trois, sinon
# « 4 500 $ » ressort « 4 $500 ».
ESP = '[\u202f\u00a0 ]'
MILLIERS = re.compile(rf'(?<![\d,.\x01])(\d{{1,3}}(?:{ESP}\d{{3}})+)(?![\d,.\x01])')
# Une décimale française n'a qu'une ou deux décimales dans ce document ; un
# groupe de milliers anglais en a toujours trois. C'est ce qui permet de
# reformater « 44,3 » sans abîmer « 10,000 » déjà écrit en anglais.
DECIMAL = re.compile(r'(?<![\d,.\x01])(\d+),(\d{1,2})(?![\d,.\x01])')
# Le montant doit commencer par un CHIFFRE. Sans ça, « ... 2028, $52,410 »
# laisse la virgule jouer le rôle de montant et sort « 2028$,52,410 ».
DOLLAR = re.compile(rf'(-|\u2212)?(\d[\d,.]*){ESP}?(M?)\$')
POURCENT = re.compile(rf'(\d[\d,.]*){ESP}?%')


def nombres_en(texte):
    """Passe les nombres du format français au format anglais.

    Français : « 1 703 504 $ », « 12,5 % », « 2,78 M$ ».
    Anglais  : « $1,703,504 », « 12.5% », « $2.78M ».

    Les années sont mises de côté avant toute chose : sans ça, « 2026 » devient
    « 2,026 ». C'est la même prudence que pour les coordonnées SVG.

    La fonction s'applique aussi aux traductions déjà écrites en anglais, comme
    filet ; elle doit donc être sans effet sur « $1,703,504 » et « 12.5% ».
    """
    gardes = []

    def garder(m):
        gardes.append(m.group(0))
        return f'\x01{len(gardes) - 1}\x01'

    t = ANNEE.sub(garder, texte)
    # La décimale AVANT les milliers : dans l'autre ordre, « 160 000 » devient
    # « 160,000 » puis la règle décimale le relit et rend « 160.000 ».
    t = DECIMAL.sub(lambda m: f'{m.group(1)}.{m.group(2)}', t)
    t = MILLIERS.sub(lambda m: re.sub(ESP, ',', m.group(1)), t)
    # Le symbole passe devant, et l'espace avant % disparaît.
    t = DOLLAR.sub(lambda m: f'{m.group(1) or ""}${m.group(2)}{m.group(3)}', t)
    t = POURCENT.sub(r'\1%', t)
    return re.sub(r'\x01(\d+)\x01', lambda m: gardes[int(m.group(1))], t)


def segments(source):
    """Les segments de texte affichés, dans l'ordre, dédoublonnés."""
    corps = OPAQUE.sub(lambda m: '<!--opaque-->', source)
    vus, out = set(), []
    for m in NOEUD.finditer(corps):
        brut = m.group(1)
        s = ' '.join(html.unescape(brut).split())
        if not s or not LETTRE.search(s) or s in vus:
            continue
        vus.add(s)
        out.append(s)
    return out


def traduire(source, glossaire):
    """Rend (html_traduit, segments_manquants)."""
    manquants = []
    opaques = []

    def garder(m):
        opaques.append(m.group(0))
        return f'\x00{len(opaques) - 1}\x00'

    corps = OPAQUE.sub(garder, source)

    def remplacer(m):
        brut = m.group(1)
        s = ' '.join(html.unescape(brut).split())
        if not s or not LETTRE.search(s):
            # Un nombre isolé : pas de traduction, mais un reformatage.
            neuf = nombres_en(brut)
            return '>' + neuf + '<' if neuf != brut else m.group(0)
        if s not in glossaire:
            if s not in manquants:
                manquants.append(s)
            return m.group(0)
        # L'espacement d'origine est conservé : le HTML reste lisible et les
        # espaces insécables du français ne se transportent pas en anglais.
        gauche = brut[:len(brut) - len(brut.lstrip())]
        droite = brut[len(brut.rstrip()):]
        return ('>' + gauche + html.escape(nombres_en(glossaire[s]), quote=False)
                + droite + '<')

    sortie = NOEUD.sub(remplacer, corps)
    sortie = re.sub(r'\x00(\d+)\x00', lambda m: opaques[int(m.group(1))], sortie)
    return sortie, manquants


def rendre(chemin_html, chemin_pdf):
    subprocess.run(
        [CHROME, '--headless', '--no-sandbox', '--disable-gpu',
         '--no-pdf-header-footer', f'--print-to-pdf={chemin_pdf}',
         f'file://{os.getcwd()}/{chemin_html}'],
        capture_output=True, check=True)
    try:
        import pikepdf
        with pikepdf.open(chemin_pdf) as p:
            p.save('_compact_en.pdf', compress_streams=True,
                   object_stream_mode=pikepdf.ObjectStreamMode.generate,
                   recompress_flate=True, deterministic_id=True)
        os.replace('_compact_en.pdf', chemin_pdf)
    except ImportError:
        pass


def main():
    source = open(SRC, encoding='utf8').read()
    if '--segments' in sys.argv:
        for s in segments(source):
            print(s)
        return 0

    try:
        from glossaire_en import GLOSSAIRE
    except ImportError:
        GLOSSAIRE = {}

    sortie, manquants = traduire(source, GLOSSAIRE)
    if '--manquants' in sys.argv:
        for s in manquants:
            print(s)
        print(f'\n{len(manquants)} segments sans traduction', file=sys.stderr)
        return 1 if manquants else 0

    if manquants:
        print(f'{len(manquants)} segments sans traduction — le PDF anglais '
              f'porterait du français. Rien n’a été écrit.', file=sys.stderr)
        for s in manquants[:10]:
            print(f'   {s[:100]}', file=sys.stderr)
        return 1

    open(DST, 'w', encoding='utf8').write(sortie)
    rendre(DST, PDF)
    print(f'{PDF} — {os.path.getsize(PDF):,} octets')
    return 0


if __name__ == '__main__':
    sys.exit(main())
