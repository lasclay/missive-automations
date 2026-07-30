#!/usr/bin/env python3
"""Phase P — coller le bilan réel de QuickBooks pour les douze mois de FY2026.

Le bilan du modèle s'arrêtait à février 2026 alors que le résultat allait jusqu'à
juin. Le collage se fait par appariement sur le NUMÉRO DE COMPTE plutôt qu'en
réécrivant la feuille, pour ne pas désaligner les blocs FY2024 et FY2025 qui
partagent les mêmes rangées (la colonne AB, août 2025, sert de bilan d'ouverture).

Le mappage a aussi été corrigé : le prêt BDC 100K (54 266 $ en juin 2026), le
BDC 11K, le prêt AccordD 003 et une carte de crédit ne tombaient nulle part, et
le compte 1650 « Intérêts Merchant Growth » était classé en immobilisations.
"""
import csv, re, sys
sys.path.insert(0, 'tools')
from xledit import Editor

Q = 'QBOBS à maj'
TSV = 'qbo_bs_FY2026.tsv'
# colonnes du bloc FY2026 dans la feuille de collage
MONTHS = ['AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN']
MONTH_NAMES = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février',
               'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août']
# corrections d'étiquettes de la feuille, pour que les prochains collages tombent juste
LABEL_FIX = {
    29: ('FPA', '   1650  Intérêts Merchant Growth'),
    96: ('Prêt accord D 003', '            2503 Prêt AccordD 003 8k'),
    98: ('Prêt BDC FDR', '            2510 Prêt BDC 100K'),
    100: ('Prêt BDC 10K', '            2512 Prêt BDC 10K'),
    108: ('Merchant Growth Capital', '            2606 Merchant Growth Capital'),
    109: ('Emprunt Shopify', '            2607 Shopify Capital #4 250K'),
}


def key_of(label):
    """Clé d'appariement : le numéro de compte, sinon le libellé nettoyé."""
    if label is None:
        return None
    s = str(label).strip()
    if s.endswith('.0') and s[:-2].isdigit():
        s = s[:-2]
    m = re.match(r'^(\d{3,4})', s)
    if m:
        return m.group(1)
    s = re.sub(r'\s+', ' ', s)
    if s.lower().startswith('total') or not s:
        return None
    return s.lower()


def load_tsv(path=TSV):
    rows = list(csv.reader(open(path, encoding='utf8'), delimiter='\t'))
    out = {}
    for r in rows[1:]:
        if len(r) < 15:
            r = r + [''] * (15 - len(r))
        tag, label = r[0].rstrip('\n'), r[1]
        k = key_of(label)
        if k is None:
            continue
        vals = []
        for v in r[2:14]:
            v = v.strip()
            vals.append(float(v) if v not in ('', '-') else None)
        out[k] = {'tag': tag, 'label': label, 'vals': vals}
    return out


def build(dst='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx',
          src='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'):
    import xlcalc
    data = load_tsv()
    bk = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()

    # le compte 1650 figurait sur deux rangées (29 et 39) : 18 712 $ comptés en
    # double dans les immobilisations. La rangée 39 est vidée.
    e.set(Q, 'A39', None)
    e.set(Q, 'B39', None)
    for c in MONTHS:
        e.set(Q, f'{c}39', None)
    for r, (tag, label) in LABEL_FIX.items():
        e.set(Q, f'A{r}', tag)
        e.set(Q, f'B{r}', label)

    # en-têtes de mois du bloc FY2026, qui n'en avaient aucun
    e.set(Q, 'AB2', 2025.0)
    e.set(Q, 'AC2', 2026.0)
    for c, name in zip(MONTHS, MONTH_NAMES):
        e.set(Q, f'{c}3', name)
        e.set(Q, f'{c}4', 'Total')
    e.set(Q, 'AM2', 'partiel')
    e.set(Q, 'AN2', 'partiel')

    used, written = set(), 0
    for r in range(5, 180):
        if r == 39:
            continue
        b = bk.values[Q].get(f'B{r}')
        if r in LABEL_FIX:
            b = LABEL_FIX[r][1]
        k = key_of(b)
        if k is None or k not in data:
            continue
        d = data[k]
        used.add(k)
        if d['tag']:
            e.set(Q, f'A{r}', d['tag'])
        for c, v in zip(MONTHS, d['vals']):
            e.set(Q, f'{c}{r}', v if v is not None else None)
        written += 1

    # comptes présents chez QuickBooks mais absents de la feuille
    extra = [k for k, d in data.items() if k not in used and d['tag']]
    row = 121
    if extra:
        e.set(Q, 'A120', 'Comptes ajoutés par QuickBooks depuis le dernier collage')
        for k in sorted(extra):
            d = data[k]
            e.set(Q, f'A{row}', d['tag'])
            e.set(Q, f'B{row}', d['label'].strip())
            for c, v in zip(MONTHS, d['vals']):
                e.set(Q, f'{c}{row}', v if v is not None else None)
            row += 1

    e.save(dst)
    print(f"{written} comptes collés sur les 12 mois de FY2026")
    print(f"comptes ajoutés en bas de feuille : {sorted(extra) if extra else 'aucun'}")
    orphan = [k for k, d in data.items() if not d['tag'] and any(
        v not in (None, 0.0) for v in d['vals'])]
    print(f"comptes QuickBooks sans étiquette et non nuls : {orphan if orphan else 'aucun'}")
    return e


if __name__ == '__main__':
    build()
