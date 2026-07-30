#!/usr/bin/env python3
"""Phase T — l'avance de l'actionnaire devient une dette courte.

Entente de juillet 2026 : Gabriel avance 80 000 $ le 15 août 2026, remboursables
sur douze mois à 8 %. Le modèle la portait à 75 000 $ postposée, sans intérêt ni
remboursement pendant le terme des prêts — trois hypothèses qui tombent ensemble.

Ce que ça change, et qui est écrit dans le classeur plutôt que laissé à trouver :
capital égal de 6 666,67 $ par mois de septembre 2026 à août 2027, 3 733 $
d'intérêt au total (demi-mois en août 2026, l'argent arrivant le 15), la
couverture du service de la dette de FY2027 qui passe de 0,88 à 0,61, et le
sommet de la marge d'exploitation qui monte de 130 000 $ à 178 359 $.
"""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
DET = 'Dette à long terme'
INP = 'Inputs'
SOM = 'Sommaire bailleurs'
NOT = 'Notes d’audit'

FY27 = ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC']
FY28 = ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ']
FY29 = ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']
# les mêmes mois dans « Dette à long terme », qui a sa propre géométrie
DET27 = ['BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL']
DET28 = ['BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA']
DET29 = ['CE', 'CF', 'CG', 'CH', 'CI', 'CJ', 'CK', 'CL', 'CM', 'CN', 'CO', 'CP']
# (colonne du sommaire, colonne du total annuel, plage mensuelle du résultat)
YEARS = (('B', 'P', ('D', 'O')), ('C', 'AD', ('R', 'AC')),
         ('D', 'AR', ('AF', 'AQ')), ('E', 'BF', ('AT', 'BE')))


def fr(x, dec=0):
    """Nombre à la française : espace fine pour les milliers, virgule décimale."""
    return f'{x:,.{dec}f}'.replace(',', ' ').replace('.', ',')


def structure(dst, src):
    """Les paramètres, l'échéancier, le bilan, l'intérêt, la couverture."""
    e = Editor(src)
    e.expand_shared()

    # --- T1 : les paramètres de l'entente, visibles dans Inputs -----------
    e.set(INP, 'A115', 'AVANCE DE L’ACTIONNAIRE — entente de juillet 2026')
    e.set(INP, 'A116', 'Montant avancé par Gabriel (15 août 2026)')
    e.set(INP, 'C116', 80000.0)
    e.set(INP, 'A117', 'Taux d’intérêt annuel')
    e.set(INP, 'C117', 0.08)
    e.set(INP, 'A118', 'Terme (mois, capital égal)')
    e.set(INP, 'C118', 12.0)
    e.set(INP, 'A119', 'Remboursée de septembre 2026 à août 2027. Intérêt sur le solde '
                       'décroissant ; demi-mois en août 2026, l’argent arrivant le 15. '
                       'Un prêteur à terme exigera très probablement une convention de '
                       'postposition : l’avance serait alors gelée et l’échéancier '
                       'ci-dessous repoussé d’autant.')

    # --- T2 : l'échéancier dans « Dette à long terme » --------------------
    e.set(DET, 'B46', 'Capital avance actionnaire (80 000 $ le 15 août 2026, 12 mois, 8 %)')
    e.set(DET, 'AW51', '=Inputs!$C$116')
    for i, c in enumerate(DET27):
        p = 'AW' if i == 0 else DET27[i - 1]
        e.set(DET, f'{c}51', f'=MAX(0,{p}51-Inputs!$C$116/Inputs!$C$118)')
    for c in DET28 + DET29:
        e.set(DET, f'{c}51', 0.0)

    e.set(DET, 'B53', 'Intérêts avance actionnaire (8 % sur solde décroissant)')
    e.set(DET, 'AW53', '=Inputs!$C$117/12*Inputs!$C$116*0.5')
    for i, c in enumerate(DET27):
        p = 'AW' if i == 0 else DET27[i - 1]
        e.set(DET, f'{c}53', f'=Inputs!$C$117/12*{p}51')
    for c in DET28 + DET29:
        e.set(DET, f'{c}53', 0.0)

    # --- T3 : le bilan porte le solde -------------------------------------
    # A47 reste « Avance Gabriel » : c'est le critère du SUMIF qui capte
    # QuickBooks sur les mois réels. La note va en C.
    e.set(BIL, 'C47', '80 000 $ reçus le 15 août 2026, remboursables sur 12 mois à 8 % '
                      '(sept. 2026 → août 2027)')
    e.set(BIL, 'O47', f"='{DET}'!AW51")
    for c, d in zip(FY27, DET27):
        e.set(BIL, f'{c}47', f"='{DET}'!{d}51")
    for c in FY28 + FY29:
        e.set(BIL, f'{c}47', 0.0)

    # --- T4 : l'intérêt au résultat ---------------------------------------
    # ligne 113 « Intérêts sur prêts privés » : l'avance en est un, à 8 %.
    # Le libellé de la colonne B ne bouge pas — c'est un critère de SUMIF.
    e.set(PNL, 'O113', f"='{DET}'!AW39+'{DET}'!AW40+'{DET}'!AW44+'{DET}'!AW53")
    for c, d in zip(FY27, DET27):
        e.set(PNL, f'{c}113',
              f"='{DET}'!{d}39+'{DET}'!{d}40+'{DET}'!{d}44+'{DET}'!{d}53")

    # --- T5 : la couverture compte le remboursement -----------------------
    # La ligne 180 était exclue du service de la dette parce que l'avance était
    # postposée. Elle entre par son mouvement NET annuel : en FY2026 le compte
    # porte un aller-retour de 30 000 $ dans QuickBooks (un reclassement, pas
    # deux flux) qu'un SUMIF sur les mois négatifs compterait comme un
    # remboursement réel.
    for col, tot, mo in YEARS:
        e.set(SOM, f'{col}100',
              f"=-('{PNL}'!{tot}175+'{PNL}'!{tot}177+'{PNL}'!{tot}179"
              f"+SUMIF('{PNL}'!{mo[0]}176:{mo[1]}176,\"<0\")"
              f"+MIN(0,'{PNL}'!{tot}180))")
    e.set(SOM, 'A100',
          'Remboursements de capital (hors refinancement, avance de l’actionnaire incluse)')

    # --- T6 : le plan de financement ---------------------------------------
    e.set(SOM, 'A50', 'Avance de l’actionnaire (15 août 2026)')
    e.set(SOM, 'B50', '=Inputs!$C$116')
    e.set(SOM, 'C50', 'Remboursable sur 12 mois à 8 % — postposition à négocier '
                      'avec le prêteur à terme')
    e.set(SOM, 'A56', '• Aucun dividende pendant le terme des prêts. L’avance de '
                      'l’actionnaire (80 000 $) est remboursée sur 12 mois à 8 % : ce '
                      'remboursement est dans les prévisions et dans la couverture.')
    e.save(dst)
    return e


def commentary(dst, src):
    """Le paragraphe du point dur, la section liquidité, les notes d'audit.

    Réécrit après coup : les chiffres cités viennent du classeur recalculé, pas
    d'une saisie à la main qui se démoderait au premier changement d'hypothèse.
    """
    bk = xlcalc.load(src)
    g = lambda a: bk.get(SOM, a)
    int_av = sum(bk.get(DET, c + '53') for c in ['AW'] + DET27)
    int27 = int_av - bk.get(DET, 'AW53')
    d27, d28, d29 = g('C102'), g('D102'), g('E102')
    d27_sans = g('C98') / (g('C101') - 80000 - int27)
    mo = 460000 / 84                      # capital mensuel de la facilité, 84 mois
    mor27 = g('C98') / (g('C101') - mo * 11)
    mor28 = g('D98') / (g('D101') + (460000 / 72 - mo) * 12)
    peak = g('B49')

    hard = [
        'LE POINT DUR DU DOSSIER, ÉNONCÉ AVANT QU’ON LE TROUVE :',
        f'La couverture du service de la dette est de {fr(d27, 2)} en FY2027, {fr(d28, 2)} en '
        f'FY2028 et {fr(d29, 2)} en',
        'FY2029. Une banque veut 1,25. Autrement dit : l’exploitation ne porte pas 460 000 $ de',
        'dette amortissable avant FY2029, même sur un terme de sept ans.',
        'FY2027 porte en plus le remboursement de l’avance de l’actionnaire — 80 000 $ de capital',
        f'et {fr(int_av)} $ d’intérêt sur douze mois. C’est ce qui fait passer la couverture de '
        f'{fr(d27_sans, 2)} à {fr(d27, 2)},',
        f'et le sommet de la marge d’exploitation de 130 000 $ à {fr(peak)} $. Une convention de',
        'postposition de cette avance est donc dans l’intérêt des deux parties, et c’est la',
        'première chose qu’un prêteur à terme demandera.',
        f'Un moratoire de capital de 12 mois, pratique courante de la BDC, porterait FY2027 à '
        f'{fr(mor27, 2)}',
        f'et ramènerait FY2028 à {fr(mor28, 2)} : il déplace le problème d’un exercice, il ne le '
        f'règle pas.',
        'La conclusion honnête est que la structure a besoin de capital patient, pas seulement de',
        'dette bancaire : le Prêt d’Honneur (subordonné), le PARI (non remboursable), et une part',
        f'en capital. Avec des capitaux propres à {fr(g("B108"))} $ au 31 août 2026, un prêteur '
        f'seul ne peut',
        'pas porter ce dossier, et le lui présenter autrement ne tromperait personne. Le dire '
        'soi-même',
        'oriente la discussion vers le bon montage au lieu de la faire dérailler sur un ratio.',
    ]
    liq = [('Encaisse au 30 juin 2026', "='Bilan2026-27-28'!M6"),
           ('Marge de crédit EDC autorisée', 150000.0),
           ('Marge EDC tirée au 30 juin 2026', 83550.98),
           ('Marge EDC tirée au 30 juillet 2026', 143026.40),
           ('Coussin restant sur la marge', None)]
    liq_prose = [
        'En un mois, juillet, la marge a été tirée de 59 475 $ de plus, dans le mois le plus mort',
        'de l’année. Il reste 6 974 $ de coussin sur la seule source de liquidité disponible.',
        'C’est la mesure de l’urgence, et elle est vérifiable ligne par ligne dans QuickBooks.',
    ]

    e = Editor(src)
    e.expand_shared()
    e.set(SOM, 'A52', f'• Le sommet de la marge ({fr(peak)} $) inclut le remboursement de '
                      'l’avance de l’actionnaire ; postposer l’avance le ramènerait à '
                      '130 000 $. Détail à la section 8.')
    for r in range(110, 140):
        for c in ('A', 'B', 'C', 'D', 'E'):
            e.set(SOM, f'{c}{r}', None)
    r = 110
    for txt in hard:
        e.set(SOM, f'A{r}', txt)
        r += 1
    r += 1
    e.set(SOM, f'A{r}', '9. LIQUIDITÉ AU MOMENT DE LA DEMANDE (réel QuickBooks)')
    r += 1
    first = r
    for lbl, val in liq:
        e.set(SOM, f'A{r}', lbl)
        if val is not None:
            e.set(SOM, f'B{r}', val)
        r += 1
    e.set(SOM, f'B{r - 1}', f'=B{first + 1}-B{first + 3}')   # autorisée − tirée en juillet
    for txt in liq_prose:
        e.set(SOM, f'A{r}', txt)
        r += 1

    e.set(NOT, 'A27',
          '• Avance de l’actionnaire : entente de juillet 2026 — 80 000 $ avancés le 15 août '
          '2026, remboursables sur 12 mois à 8 % (capital égal de 6 666,67 $ de septembre 2026 à '
          f'août 2027, {fr(int_av)} $ d’intérêt au total). Le modèle la portait à 75 000 $ '
          'postposée, sans intérêt ni remboursement : les trois hypothèses sont remplacées. '
          'Paramètres dans Inputs, rangées 115 à 119 ; échéancier dans « Dette à long terme », '
          'rangées 46, 51 et 53.')
    e.set(NOT, 'A39',
          '• Avance de l’actionnaire : QuickBooks n’en enregistre que 5 000 $ au 30 juin 2026. '
          'Les 80 000 $ de l’entente du 15 août 2026 doivent être documentés (contrat, taux, '
          'échéancier) avant le dépôt — un prêteur à terme demandera aussi une convention de '
          'postposition, qui suspendrait l’échéancier de 12 mois.')
    e.set(NOT, 'A48',
          '• Reste à valider : la vente d’équipements est toujours dans « À réviser » ; le '
          'contrat de l’avance de 80 000 $ du 15 août 2026 reste à signer ; les pertes fiscales '
          'reportables (151 649 $) restent un estimé du comptable ; les soldes réels des prêts '
          'Accord D, privés et BDC 11K au 31 août 2026 sont à confirmer.')
    e.save(dst)
    return e


def build(dst='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx',
          src='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'):
    structure(dst, src)
    commentary(dst, dst)


if __name__ == '__main__':
    build(dst='t_all.xlsx', src='pre_t.xlsx')
    bk = xlcalc.load('t_all.xlsx')
    allc = ['B'] + list('DEFGHIJKLMNO') + FY27 + FY28 + FY29
    print('mois hors équilibre :',
          len([c for c in allc if abs(bk.get(BIL, c + '76')) > 0.5]))
    for lbl, c in (('FY2026', 'B'), ('FY2027', 'C'), ('FY2028', 'D'), ('FY2029', 'E')):
        print(f'{lbl}  service {bk.get(SOM, c + "101"):>12,.0f}  DSCR {bk.get(SOM, c + "102"):>6.2f}')
    print('sommet de la marge :', round(bk.get(SOM, 'B49'), 0))
