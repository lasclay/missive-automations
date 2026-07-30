#!/usr/bin/env python3
"""Phase F — structure de financement.

Constat du modèle corrigé : l'entreprise rembourse 382 000 $ de capital en
FY2027 sur 1,27 M$ de ventes, dont 367 000 $ de capital marchand (Shopify
Capital prélève 28,75 % des ventes quotidiennes, Merchant Growth a un coût fixe).
C'est ce prélèvement, et non la demande, qui a tué l'été 2026. La structure
retenue retire ce capital en septembre 2026 et l'étale sur 60 mois."""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

SRC = 'prev_fix_d.xlsx'
DST = 'prev_fix_f.xlsx'
PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
DET = 'Dette à long terme'
INP = 'Inputs'

FY = {'FY26': list('DEFGHIJKLMNO'),
      'FY27': ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],
      'FY28': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
      'FY29': ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']}
PREVCLOSE = {'FY27': 'O', 'FY28': 'AC', 'FY29': 'AQ'}
GROWCELL = {'FY27': 'C', 'FY28': 'D', 'FY29': 'E'}
TOTPREV = {'FY27': ('AD', 'P'), 'FY28': ('AR', 'AD'), 'FY29': ('BF', 'AR')}
DFY = {'FY27': ['BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL'],
       'FY28': ['BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA'],
       'FY29': ['CE', 'CF', 'CG', 'CH', 'CI', 'CJ', 'CK', 'CL', 'CM', 'CN', 'CO', 'CP']}


def build(dst=DST, src=SRC, marketing_debut=46631.0, facilite=460000.0, taux=0.099,
          amort_mois=60):
    e = Editor(src)
    e.expand_shared()

    # --- E1 : date d'embauche marketing (1er septembre 2027) -------------
    e.set(INP, 'D48', marketing_debut)

    # --- E2 : inventaire indexé sur la croissance des ventes -------------
    e.set(INP, 'A67', 'INVENTAIRE — croissance indexée sur celle des ventes nettes')
    e.set(INP, 'B67', 'Facteur appliqué au même mois de l’exercice précédent')
    for k in ('FY27', 'FY28', 'FY29'):
        cur, prev = TOTPREV[k]
        e.set(INP, f'{GROWCELL[k]}67', f"='{PNL}'!{cur}26/'{PNL}'!{prev}26")
    for k in ('FY27', 'FY28', 'FY29'):
        g = GROWCELL[k]
        src_cols = {'FY27': FY['FY26'], 'FY28': FY['FY27'], 'FY29': FY['FY28']}[k]
        for i, c in enumerate(FY[k]):
            e.set(BIL, f'{c}11', f'={src_cols[i]}11*Inputs!${g}$67')
            e.set(BIL, f'{c}13', f'={src_cols[i]}13*Inputs!${g}$67')

    # --- F1 : retirer le capital marchand en septembre 2026 --------------
    # Shopify Capital et Merchant Growth sont soldés d'un coup, financés par la
    # nouvelle facilité, au lieu d'être prélevés sur les ventes de l'exercice.
    e.set(PNL, 'R174', f"=-'{BIL}'!O48")
    for c in FY['FY27'][1:] + FY['FY28'] + FY['FY29']:
        e.set(PNL, f'{c}174', 0.0)
    e.set(PNL, 'C174', 'Soldé en sept. 2026 par la nouvelle facilité')
    e.set(PNL, 'R178', f"=-'{BIL}'!O58")
    for c in FY['FY27'][1:] + FY['FY28'] + FY['FY29']:
        e.set(PNL, f'{c}178', 0.0)
    e.set(PNL, 'C178', 'Soldé en sept. 2026 par la nouvelle facilité')
    # soldes au bilan : à zéro dès septembre 2026
    for k in ('FY27', 'FY28', 'FY29'):
        for c in FY[k]:
            e.set(BIL, f'{c}48', 0.0)
            e.set(BIL, f'{c}58', 0.0)
    # les intérêts correspondants disparaissent aussi
    for k in ('FY27', 'FY28', 'FY29'):
        for c in FY[k]:
            e.set(PNL, f'{c}114', 0.0)   # intérêts Merchant Growth
            e.set(PNL, f'{c}116', 0.0)   # frais d'intérêts Shopify Capital

    # --- F2 : la nouvelle facilité --------------------------------------
    mens = facilite / amort_mois
    e.set(PNL, 'R176', facilite)
    for c in FY['FY27'][1:] + FY['FY28'] + FY['FY29']:
        e.set(PNL, f'{c}176', -mens)
    e.set(PNL, 'C176',
          ('Sept. 2026 : facilité de {f} $ (BDC fonds de roulement + prêt à terme de '
           'refinancement + Prêt d’Honneur). Sert à solder Shopify Capital et Merchant '
           'Growth et à financer le stock d’automne. Amortissement {m} mois à {t} %.'
           ).format(f=f'{facilite:,.0f}'.replace(',', ' '), m=amort_mois, t=f'{taux*100:.1f}'))
    e.set(BIL, 'O59', 0.0)
    for k in ('FY27', 'FY28', 'FY29'):
        prev = PREVCLOSE[k]
        for i, c in enumerate(FY[k]):
            p = prev if i == 0 else FY[k][i - 1]
            e.set(BIL, f'{c}59', f"={p}59+'{PNL}'!{c}176")
    e.set(DET, 'C44', taux)
    e.set(DET, 'B44', f'Intérêts nouvelle facilité ({taux*100:.1f} %)')
    for k in ('FY27', 'FY28', 'FY29'):
        for i, c in enumerate(DFY[k]):
            e.set(DET, f'{c}44', f"=$C$44*'{BIL}'!{FY[k][i]}59/12")

    e.save(dst)
    return e


if __name__ == '__main__':
    import xlcalc
    CFY = {'FY27': ['AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD'],
           'FY28': ['BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ'],
           'FY29': ['BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA', 'CB', 'CC', 'CD', 'CE']}
    C = 'Budget de caisse'
    for f in (400000.0, 460000.0, 520000.0):
        build(dst='iterF.xlsx', facilite=f)
        bk = xlcalc.load('iterF.xlsx')
        lows = {k: min(bk.get(C, c + '33') for c in cs) for k, cs in CFY.items()}
        ends = {k: bk.get(C, cs[-1] + '33') for k, cs in CFY.items()}
        print(f"facilité={f:>9,.0f} | creux FY27 {lows['FY27']:>9,.0f} FY28 {lows['FY28']:>9,.0f} "
              f"FY29 {lows['FY29']:>9,.0f} | fin FY29 {ends['FY29']:>9,.0f} | PAI "
              + ' '.join(f"{bk.get(PNL, c + '137'):>9,.0f}" for c in ('AD', 'AR', 'BF')))
