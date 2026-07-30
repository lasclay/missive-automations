#!/usr/bin/env python3
"""Phase D — équipe, dette BDC, et remise en état des étiquettes servant de
critères SUMIF (le libellé de la colonne A du bilan et de la colonne B du
résultat est la clé de rapprochement avec QuickBooks : le modifier casse
silencieusement la valeur réelle de la ligne)."""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

SRC = 'prev_fix_c.xlsx'
DST = 'prev_fix_d.xlsx'
PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
CAI = 'Budget de caisse'
DET = 'Dette à long terme'
INP = 'Inputs'

FY = {'FY26': list('DEFGHIJKLMNO'),
      'FY27': ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],
      'FY28': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
      'FY29': ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']}
TOT = {'FY26': 'P', 'FY27': 'AD', 'FY28': 'AR', 'FY29': 'BF'}
FCST = FY['FY27'] + FY['FY28'] + FY['FY29']
# colonnes mensuelles de « Dette à long terme », par exercice
DFY = {'FY27': ['BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL'],
       'FY28': ['BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA'],
       'FY29': ['CE', 'CF', 'CG', 'CH', 'CI', 'CJ', 'CK', 'CL', 'CM', 'CN', 'CO', 'CP']}
# colonnes d'Inputs pour l'équipe, par exercice
IFY = {'FY27': ['AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV'],
       'FY28': ['AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ'],
       'FY29': ['BM', 'BN', 'BO', 'BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX']}
PREVCLOSE = {'FY27': 'O', 'FY28': 'AC', 'FY29': 'AQ'}


def build(dst=DST, src=SRC, hausse_dirigeants=0.03, hausse_autres=0.03,
          marketing_debut=46966.0, bdc_montant=125000.0, bdc_mensualite=2083.33):
    e = Editor(src)
    e.expand_shared()

    # =================================================================
    # D0. Étiquettes : remettre les critères SUMIF détruits en phase A/C
    # =================================================================
    e.set(BIL, 'A47', 'Avance Gabriel')
    e.set(BIL, 'A40', 'Dividendes à payer')
    e.set(BIL, 'A76', 'Total de contrôle ( écart à concilier)')
    e.set(PNL, 'B123', 'PARI-CNRC')
    e.set(PNL, 'B129', "Économies d'optimisation (SaaS, expédition, télécom)")
    # les notes vont en colonne C, qui n'est pas un critère de rapprochement
    e.set(PNL, 'C123', 'Hors scénario de base — voir « Sommaire bailleurs »')
    e.set(PNL, 'C129', "Retiré : une économie de coût n'est pas un revenu")
    e.set(BIL, 'C47', 'Postposée, sans intérêt ni remboursement pendant le terme des prêts')
    # ne remettre à zéro que les colonnes de prévision : les mois réels de
    # FY2026 doivent continuer de lire QuickBooks
    for i, c in enumerate(FY['FY26']):
        src_col = ['AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL'][i]
        for r in (123, 129):
            e.set(PNL, f'{c}{r}',
                  f"=-SUMIF('QBO P&L à maj'!$A$1:$A$400,$B{r},'QBO P&L à maj'!{src_col}$1:{src_col}$400)")

    # =================================================================
    # D1. Équipe
    # =================================================================
    # hausses salariales : 3 % par an, et non 10 % pour les dirigeants
    e.set(INP, 'C35', hausse_dirigeants)
    e.set(INP, 'E35', hausse_autres)
    e.set(INP, 'A35', 'Hausses salariales annuelles dès FY2028 (composées, 3 %/an)')
    # ressource ventes et service : retirée. Le service client est automatisé
    # (script support.js) ; un poste à temps plein contredirait cette structure.
    e.set(INP, 'A26', 'Service client — automatisé, aucune ressource dédiée')
    e.set(INP, 'B26', 'Ressource ventes et service (retirée du plan)')
    e.set(INP, 'F26', 0.0)
    for k in ('FY27', 'FY28', 'FY29'):
        for c in IFY[k]:
            e.set(INP, f'{c}26', 0.0)
    # ressource marketing : reportée au 1er septembre 2027
    e.set(INP, 'D48', marketing_debut)
    e.set(INP, 'B29', 'Ressource marketing (dès sept. 2027)')
    # gestion logistique : au 1er octobre 2026
    e.set(INP, 'AK31', 0.0)
    e.set(INP, 'A62', "PLAN D'EMBAUCHE — une embauche par exercice, pas trois d'un coup")
    e.set(INP, 'A63', 'FY2027 : gestion logistique / production internationale, 1er oct. 2026 '
                      '(11 mois). C’est la personne qui pilote BMB Tunisie ; sans elle, le '
                      'virage manufacturier ne tient pas.')
    e.set(INP, 'A64', 'FY2028 : ressource marketing, 1er sept. 2027, quand le volume la porte. '
                      'D’ici là, le marketing passe par la sous-traitance (ligne 82 du résultat).')
    e.set(INP, 'A65', 'Aucune ressource de service client : la boîte support est automatisée.')
    e.set(INP, 'A66', 'Expédition saisonnier : inchangé, oct. à déc., 25 h/sem.')

    # =================================================================
    # D2. Dette BDC 125 K : moratoire de capital 12 mois puis 60 mensualités
    #     (l'ancien modèle la remboursait d'un coup en décembre 2027)
    # =================================================================
    e.set(PNL, 'R176', bdc_montant)
    for c in FY['FY27'][1:]:
        e.set(PNL, f'{c}176', 0.0)          # moratoire de capital
    for k in ('FY28', 'FY29'):
        for c in FY[k]:
            e.set(PNL, f'{c}176', -bdc_mensualite)
    e.set(PNL, 'C176', 'BDC fonds de roulement 125 K : moratoire 12 mois, puis 60 mensualités')
    # solde au bilan : un vrai solde qui court, plus des valeurs en dur
    e.set(BIL, 'O59', 0.0)
    for k in ('FY27', 'FY28', 'FY29'):
        prev = PREVCLOSE[k]
        for i, c in enumerate(FY[k]):
            p = prev if i == 0 else FY[k][i - 1]
            e.set(BIL, f'{c}59', f"={p}59+'{PNL}'!{c}176")
    e.set(BIL, 'A59', 'Nouvelle dette')
    # intérêts : la ligne 44 de « Dette à long terme » est libérée par la
    # postposition de l'avance de l'actionnaire, elle porte maintenant le 125 K
    e.set(DET, 'B44', 'Intérêts nouvelle dette BDC 125 K (10,9 %)')
    e.set(DET, 'C44', 0.109)
    for k in ('FY27', 'FY28', 'FY29'):
        for i, c in enumerate(DFY[k]):
            e.set(DET, f'{c}44', f"=$C$44*'{BIL}'!{FY[k][i]}59/12")
    # et la porter au résultat : les lignes 43 et 44 de la dette n'atterrissaient
    # nulle part dans le P&L
    for k in ('FY27', 'FY28', 'FY29'):
        for i, c in enumerate(FY[k]):
            d = DFY[k][i]
            e.set(PNL, f'{c}112', f"='{DET}'!{d}36+'{DET}'!{d}37+'{DET}'!{d}38"
                                  f"+'{DET}'!{d}43+'{DET}'!{d}44")

    e.save(dst)
    return e


if __name__ == '__main__':
    e = build()
    print(f"{len(e.log)} écritures -> {DST}")
