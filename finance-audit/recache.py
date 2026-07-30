#!/usr/bin/env python3
"""Rafraîchir les valeurs en cache du classeur. À lancer en DERNIER.

Un fichier .xlsx porte deux choses pour chaque cellule à formule : la formule,
et la dernière valeur calculée. Excel recalcule à l'ouverture — le classeur pose
`fullCalcOnLoad` — mais tout ce qui ne recalcule pas affiche le cache tel quel :
l'aperçu de Google Drive, un import Sheets, une conversion en PDF, un lecteur en
ligne, un tableur mobile.

Après la révision, ce cache était celui d'avant. Sur les seules feuilles
visibles, 29 645 cellules affichaient un nombre périmé et 327 un `#REF!` hérité
de la chaîne d'erreurs réparée depuis. Autrement dit : quelqu'un qui cliquait
l'aperçu du dossier partagé voyait un chiffrier cassé, alors que le fichier
téléchargé s'ouvrait juste.

## Pourquoi on peut faire confiance à l'évaluateur

Écrire 30 000 valeurs calculées par nos propres moyens n'a de sens que si ces
valeurs sont les bonnes. Le contrôle est direct : sur les feuilles d'archive, que
la révision n'a pas touchées, le cache d'Excel EST la bonne réponse. `xlcalc` la
reproduit sur 5 079 cellules sur 5 079, à un cent près.

La seule archive qui diverge est « Résultats2024 », et pour une raison connue :
elle lit « Ventes prévisionnelles » et « Account payable », deux feuilles que la
révision a changées. Ses valeurs ont bougé parce que ses données ont bougé.

## Ce que le script ne fait pas

Il ne touche ni aux formules, ni aux styles, ni à `fullCalcOnLoad` : Excel
recalculera quand même, et c'est Excel qui a le dernier mot. Une cellule que
l'évaluateur n'arrive pas à calculer, ou qui rend un type inattendu, garde son
cache : mieux vaut une valeur périmée qu'une valeur inventée.

    python3 recache.py "PREVISIONS LASCLAY - version audit 2026-07-30.xlsx"
"""
import math
import re
import sys
import zipfile

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

CELL = re.compile(r'<c\b([^>]*?)(?:/>|>(.*?)</c>)', re.S)


def echappe(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def rafraichir(chemin):
    bk = xlcalc.load(chemin)
    e = Editor(chemin)
    total = {'écrit': 0, 'inchangé': 0, 'refusé': 0}

    for feuille, part in e.sheetpart.items():
        x = e.parts[part].decode('utf8')

        def refaire(m):
            attrs, corps = m.group(1), m.group(2)
            if corps is None or '<f' not in corps:
                return m.group(0)
            ref = re.search(r'r="([A-Z]+\d+)"', attrs)
            if not ref:
                return m.group(0)
            try:
                v = bk.get(feuille, ref.group(1))
            except Exception:              # noqa: BLE001 — on garde le cache
                total['refusé'] += 1
                return m.group(0)

            # On n'écrit que ce qu'on sait écrire sans ambiguïté.
            if isinstance(v, bool) or v is None:
                total['refusé'] += 1
                return m.group(0)
            if isinstance(v, (int, float)):
                if not math.isfinite(v):
                    total['refusé'] += 1
                    return m.group(0)
                typ, val = None, repr(float(v))
            elif isinstance(v, str):
                # une chaîne qui commence par « # » est une erreur, pas un texte
                typ = 'e' if v.startswith('#') else 'str'
                val = echappe(v)
            else:
                total['refusé'] += 1
                return m.group(0)

            ancien = re.search(r'<v>(.*?)</v>', corps, re.S)
            if ancien and ancien.group(1) == val:
                total['inchangé'] += 1
                return m.group(0)
            total['écrit'] += 1

            # le type de la cellule doit suivre la valeur : un nombre écrit
            # dans une cellule restée t="e" s'affiche comme une erreur
            neuf = re.sub(r'\s+t="[^"]*"', '', attrs)
            if typ:
                neuf += f' t="{typ}"'
            corps2 = (corps[:ancien.start()] + f'<v>{val}</v>' + corps[ancien.end():]
                      if ancien else corps + f'<v>{val}</v>')
            return f'<c{neuf}>{corps2}</c>'

        e.parts[part] = CELL.sub(refaire, x).encode('utf8')

    # Excel garde le dernier mot : le cache n'est qu'un aperçu.
    e.set_full_calc()
    e.save(chemin)
    return total


def controle(chemin):
    """Combien de cellules à formule affichent encore autre chose que leur
    valeur calculée ?"""
    bk = xlcalc.load(chemin)
    z = zipfile.ZipFile(chemin)
    e = Editor(chemin)
    ecart = err = 0
    for feuille, part in e.sheetpart.items():
        x = z.read(part).decode('utf8')
        for m in CELL.finditer(x):
            corps = m.group(2)
            if corps is None or '<f' not in corps:
                continue
            v = re.search(r'<v>(.*?)</v>', corps, re.S)
            if not v:
                continue
            s = v.group(1)
            if s.startswith('#'):
                err += 1
                continue
            ref = re.search(r'r="([A-Z]+\d+)"', m.group(1)).group(1)
            try:
                calc = bk.get(feuille, ref)
            except Exception:              # noqa: BLE001
                continue
            if isinstance(calc, (int, float)) and not isinstance(calc, bool):
                try:
                    if abs(float(s) - calc) > max(0.01, abs(calc) * 1e-9):
                        ecart += 1
                except ValueError:
                    ecart += 1
    return ecart, err


if __name__ == '__main__':
    F = (sys.argv[1] if len(sys.argv) > 1
         else 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx')
    avant = controle(F)
    print(f'avant : {avant[0]:,} valeurs périmées, {avant[1]:,} erreurs en cache')
    t = rafraichir(F)
    print(f'  écrites {t["écrit"]:,}   déjà bonnes {t["inchangé"]:,}   '
          f'laissées telles quelles {t["refusé"]:,}')
    apres = controle(F)
    print(f'après : {apres[0]:,} valeurs périmées, {apres[1]:,} erreurs en cache')
