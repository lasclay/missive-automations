#!/usr/bin/env python3
"""Phase J — une seule chaîne de trésorerie, continue sur 48 mois.

Le bilan réel de QuickBooks s'arrête à février 2026 (« QBOBS à maj » colonnes
AC à AH) alors que le résultat réel va jusqu'à juin 2026. La prévision de
trésorerie s'ancre donc sur le dernier mois de bilan réel et court sans rupture
jusqu'en août 2029, exercices compris. C'est ce chaînage qui fait tomber la
ligne de contrôle du bilan à zéro."""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

SRC = 'prev_fix_h.xlsx'
DST = 'prev_fix_j.xlsx'
PNL = 'Résultats-Prev 2025-2029'
CAI = 'Budget de caisse'
BIL = 'Bilan2026-27-28'

PFY = {'FY26': list('DEFGHIJKLMNO'),
       'FY27': ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],
       'FY28': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
       'FY29': ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']}
PTOT = {'FY26': 'P', 'FY27': 'AD', 'FY28': 'AR', 'FY29': 'BF'}
CFY = {'FY26': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
       'FY27': ['AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD'],
       'FY28': ['BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ'],
       'FY29': ['BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA', 'CB', 'CC', 'CD', 'CE']}
CTOT = {'FY26': 'AR', 'FY27': 'BE', 'FY28': 'BR', 'FY29': 'CF'}
PREVCLOSE = {'FY27': 'O', 'FY28': 'AC', 'FY29': 'AQ'}

ACTUAL = PFY['FY26'][:6]          # sept. 2025 → févr. 2026, bilan réel QBO
QBOBS_COL = ['AC', 'AD', 'AE', 'AF', 'AG', 'AH']
CHAIN = PFY['FY26'][6:] + PFY['FY27'] + PFY['FY28'] + PFY['FY29']   # 42 mois prévus


def build(dst=DST, src=SRC):
    e = Editor(src)
    e.expand_shared()

    # --- J1 : les six mois de bilan réel ---------------------------------
    for i, c in enumerate(ACTUAL):
        q = QBOBS_COL[i]
        for r in (6, 31):
            e.set(BIL, f'{c}{r}',
                  f"=SUMIF('QBOBS à maj'!$A$1:$A$400,$A{r},'QBOBS à maj'!{q}$1:{q}$400)")
        e.set(PNL, f'{c}183', f"='{BIL}'!{c}31")
        e.set(PNL, f'{c}189', f"='{BIL}'!{c}6")
        e.set(PNL, f'{c}182', f'={c}189-{c}183')
        prev = ACTUAL[i - 1] if i else None
        e.set(PNL, f'{c}186', (f'={prev}189' if prev else "='Bilan2026-27-28'!B6"))
        e.set(PNL, f'{c}185', f'={c}183-' + (f'{prev}183' if prev
                                             else "'Bilan2026-27-28'!B31"))
        e.set(PNL, f'{c}193', f'={c}189-{c}182-{c}183')

    # --- J2 : la chaîne prévue, continue d'un exercice à l'autre ---------
    for i, c in enumerate(CHAIN):
        prev = CHAIN[i - 1] if i else ACTUAL[-1]
        e.set(PNL, f'{c}182', f'={prev}182+{c}184')
        e.set(PNL, f'{c}183', f'=MAX(0,Inputs!$C$68-{c}182)')
        e.set(PNL, f'{c}185', f'={c}183-{prev}183')
        e.set(PNL, f'{c}186', f'={prev}189')
        e.set(PNL, f'{c}189', f'={c}182+{c}183')
        e.set(PNL, f'{c}193', f'={c}189-{c}182-{c}183')
        e.set(PNL, f'{c}110', f'=Inputs!$C$69/12*{prev}183')
        e.set(BIL, f'{c}6', f"='{PNL}'!{c}189")
        e.set(BIL, f'{c}31', f"='{PNL}'!{c}183")
    # les dix mois de résultat réel gardent leurs intérêts de marge de QBO
    for i, c in enumerate(PFY['FY26'][:10]):
        q = ['AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ'][i]
        e.set(PNL, f'{c}110',
              f"=SUMIF('QBO P&L à maj'!$A$1:$A$400,$B110,'QBO P&L à maj'!{q}$1:{q}$400)")

    # --- J3 : colonnes de total -----------------------------------------
    for k, t in PTOT.items():
        cs = PFY[k]
        e.set(PNL, f'{t}182', f'={cs[-1]}182')
        e.set(PNL, f'{t}183', f'=MAX({cs[0]}183:{cs[-1]}183)')
        e.set(PNL, f'{t}185', f'=SUM({cs[0]}185:{cs[-1]}185)')
        e.set(PNL, f'{t}186', f'={cs[0]}186')
        e.set(PNL, f'{t}189', f'={cs[-1]}189')
        e.set(PNL, f'{t}191', f'=MAX({cs[0]}183:{cs[-1]}183)')
        e.set(PNL, f'{t}193', f'={t}189-{t}182-{t}183')
        e.set(PNL, f'{t}110', f'=SUM({cs[0]}110:{cs[-1]}110)')

    # --- J4 : avance de l'actionnaire postposée, donc figée --------------
    for k in ('FY27', 'FY28', 'FY29'):
        for c in PFY[k]:
            e.set(BIL, f'{c}47', 75000.0)
            e.set(PNL, f'{c}180', 0.0)
    e.set(PNL, 'C180', 'Postposée : aucun mouvement pendant le terme des prêts')

    # --- J5 : crédits d'impôt à recevoir, solde courant ------------------
    e.set(BIL, 'C10', 'Solde courant : + crédits comptabilisés, − encaissement au printemps')
    for k in ('FY27', 'FY28', 'FY29'):
        prev = PREVCLOSE[k]
        for i, c in enumerate(PFY[k]):
            p = prev if i == 0 else PFY[k][i - 1]
            f = f"={p}10-('{PNL}'!{c}126+'{PNL}'!{c}128)"
            if i == 8:
                f += f'-${prev}$10'
            e.set(BIL, f'{c}10', f)
    for k in ('FY27', 'FY28', 'FY29'):
        prev = PREVCLOSE[k]
        for i, c in enumerate(CFY[k]):
            e.set(CAI, f'{c}9', f"='{BIL}'!${prev}$10" if i == 8 else 0.0)
    for c in CFY['FY26']:
        e.set(CAI, f'{c}9', 0.0)
    e.set(CAI, 'AN9', "='Bilan2026-27-28'!I10")

    # --- J6 : le budget de caisse, vue mensuelle de la même chaîne -------
    for k in ('FY26', 'FY27', 'FY28', 'FY29'):
        for i, c in enumerate(CFY[k]):
            p = PFY[k][i]
            e.set(CAI, f'{c}33', f"='{PNL}'!{p}182")
            e.set(CAI, f'{c}34', f"='{PNL}'!{p}183")
            e.set(CAI, f'{c}35', f"='{PNL}'!{p}189")
            e.set(CAI, f'{c}36', f"={c}32-'{PNL}'!{p}184")
    for k, t in CTOT.items():
        p = PTOT[k]
        e.set(CAI, f'{t}33', f"='{PNL}'!{p}182")
        e.set(CAI, f'{t}34', f"='{PNL}'!{p}183")
        e.set(CAI, f'{t}35', f"='{PNL}'!{p}189")
        e.set(CAI, f'{t}36', f'=SUM({CFY[k][0]}36:{CFY[k][-1]}36)')

    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    e = build()
    bk = xlcalc.load(DST)
    print(f"{len(e.log)} écritures -> {DST}")
    allc = ['B'] + [c for cs in PFY.values() for c in cs]
    worst = max(allc, key=lambda c: abs(bk.get(BIL, c + '76')))
    print('r76 |écart| max :', worst, f"{bk.get(BIL, worst + '76'):,.2f}")
    print('r76 clôtures :', *[f"{c}: {bk.get(BIL, c + '76'):,.1f}" for c in ('B', 'I', 'O', 'AC', 'AQ', 'BE')])
