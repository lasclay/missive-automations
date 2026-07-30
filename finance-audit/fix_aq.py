#!/usr/bin/env python3
"""Phase AQ — recoller le réel de QuickBooks après une séance de tenue de livres.

Le modèle porte deux feuilles de collage, « QBO P&L à maj » et « QBOBS à maj »,
où les `SUMIF` du résultat et du bilan vont chercher les montants réels. Elles
sont faites de constantes : elles ne se rafraîchissent pas toutes seules.

Ce script les recolle depuis `qbo_import.js`, en appariant **par libellé** et non
par position. L'appariement par position est un piège : QuickBooks omet les
comptes sans activité, alors une ligne qui disparaît décale tout ce qui suit —
c'est ce qui a laissé un sous-total de 91 854 $ sur la rangée « 4050 Etsy
Canada » du classeur, sans conséquence parce que cette rangée n'a pas de clé de
mappage, mais l'avertissement vaut.

La clé est le numéro de compte quand il y en a un, le libellé complet sinon. Les
deux comptent : **« Bénéfices non répartis » et « Bénéfice de l'année » n'ont pas
de numéro**, et ce sont précisément les rangées qui portent la contrepartie de
toute correction au résultat. Les oublier fait sortir le bilan de l'équilibre du
montant exact de la correction — une reclassification de 8 000 $ en avril 2026 a
fait exactement ça.

Un compte que le rapport ne renvoie plus est remis à zéro plutôt que laissé avec
sa valeur d'hier : sinon une reclassification qui vide un compte laisse le montant
en place et le modèle le compte deux fois.

    node qbo_import.js
    python3 fix_aq.py --essai      # ne montre que ce qui bougerait
    python3 fix_aq.py
"""
import csv
import re
import sys

sys.path.insert(0, 'tools')
from openpyxl.utils import column_index_from_string, get_column_letter
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
MOIS = ['sept', 'oct', 'nov', 'déc', 'jan', 'fév', 'mar', 'avr', 'mai',
        'jun', 'jul', 'aoû']
NUM = re.compile(r'^\s*(\d{4})\b')

# feuille, fichier TSV, colonne des libellés, première colonne du bloc,
# indice de la première colonne de mois dans le TSV
BLOCS = [
    ('QBO P&L à maj', 'qbo_pl_FY2026.tsv', 'B', 'AA', 2),
    ('QBOBS à maj', 'qbo_bs_FY2026.tsv', 'B', 'AC', 2),
]


def nb(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def cle(lab):
    """Le numéro de compte s'il y en a un, sinon le libellé normalisé."""
    m = NUM.match(lab)
    return m.group(1) if m else ' '.join(lab.split())


def lire_tsv(chemin, debut):
    """{clé: (libellé, [12 mois])}"""
    out = {}
    for row in csv.reader(open(chemin, encoding='utf8'), delimiter='\t'):
        if len(row) <= debut or not (row[1] or '').strip():
            continue
        out.setdefault(cle(row[1]),
                       (row[1].strip(), [nb(x) for x in row[debut:debut + 12]]))
    return out


def comptes_feuille(bk, feuille, col_lab):
    """{clé: [rangées]} — une clé qui revient deux fois est ambiguë."""
    out = {}
    for r in range(1, 250):
        lab = bk.get(feuille, f'{col_lab}{r}')
        if isinstance(lab, str) and lab.strip():
            out.setdefault(cle(lab), []).append(r)
    return out


def build(dst=F, src=F, essai=False):
    bk = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()
    resume = []

    for feuille, tsv_path, col_lab, col0, debut in BLOCS:
        cols = [get_column_letter(column_index_from_string(col0) + i)
                for i in range(12)]
        qbo = lire_tsv(tsv_path, debut)
        sheet = comptes_feuille(bk, feuille, col_lab)
        ecrits = mis_a_zero = 0
        change = []

        orphelins = sorted(set(qbo) - set(sheet))
        if orphelins:
            resume.append(f'  ⚠ {feuille} : {len(orphelins)} rangées de '
                          f'QuickBooks sans place au classeur — '
                          + ', '.join(o[:40] for o in orphelins))

        for compte, rangees in sheet.items():
            # Une clé sur deux rangées ne peut pas être recollée sans choisir
            # laquelle porte quoi : on le signale au lieu de deviner.
            if len(rangees) > 1:
                resume.append(f'  ⚠ {feuille} : compte {compte} sur '
                              f'{len(rangees)} rangées, laissé tel quel')
                continue
            r = rangees[0]
            neuf = qbo.get(compte, (None, [0.0] * 12))[1]
            absent = compte not in qbo
            for j, c in enumerate(cols):
                vieux = nb(bk.get(feuille, f'{c}{r}'))
                if abs(vieux - neuf[j]) <= 0.005:
                    continue
                if not essai:
                    e.set(feuille, f'{c}{r}', neuf[j])
                ecrits += 1
                mis_a_zero += absent
                change.append((compte, bk.get(feuille, f'{col_lab}{r}').strip(),
                               MOIS[j], vieux, neuf[j]))
        resume.append(f'{feuille} : {ecrits} cellules, dont {mis_a_zero} '
                      f'remises à zéro (compte disparu du rapport)')
        for c, lab, m, a, b in change:
            if m != 'jul':
                resume.append(f'    {lab[:44]:<46} {m:<5} '
                              f'{a:>12,.2f} → {b:>12,.2f}')
        n_jul = sum(1 for x in change if x[2] == 'jul')
        if n_jul:
            resume.append(f'    + {n_jul} cellules de juillet 2026, '
                          f'qui n’était pas encore comptabilisé')

    if not essai:
        e.set_full_calc()
        e.save(dst)
    return resume


if __name__ == '__main__':
    essai = '--essai' in sys.argv
    for ligne in build(essai=essai):
        print(ligne)
    if essai:
        print('\n(essai : rien n’a été écrit)')
