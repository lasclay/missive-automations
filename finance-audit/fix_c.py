#!/usr/bin/env python3
"""Phase C — cohérence de la structure de coûts, traitement des aides publiques,
plan d'embauche et postposition de l'avance de l'actionnaire.

Le coût des marchandises vendues était bâti sur les coûts unitaires cibles des
fiches Tunisie (13-15 % du prix de vente), ce qui donnait une marge brute de
82 % en FY2027, au-dessus du meilleur exercice jamais réalisé. Il est ramené sur
des ratios calibrés sur le réel de trois exercices, avec l'amélioration du
virage manufacturier énoncée explicitement plutôt que supposée."""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

SRC = 'prev_fix_b.xlsx'
DST = 'prev_fix_c.xlsx'
PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
CAI = 'Budget de caisse'
DET = 'Dette à long terme'
INP = 'Inputs'
APA = 'Account payable'

FY = {'FY26': list('DEFGHIJKLMNO'),
      'FY27': ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],
      'FY28': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
      'FY29': ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']}
TOT = {'FY26': 'P', 'FY27': 'AD', 'FY28': 'AR', 'FY29': 'BF'}
ALLM = [c for cs in FY.values() for c in cs]
FCST = FY['FY27'] + FY['FY28'] + FY['FY29']
# colonne d'hypothèse (Inputs) par exercice de prévision
RATCOL = {'FY27': 'C', 'FY28': 'D', 'FY29': 'E'}
# mois précédent, pour les variations de bilan (le 1er mois reprend la clôture N-1)
PREV = {}
for k in ('FY26', 'FY27', 'FY28', 'FY29'):
    prevclose = {'FY26': 'B', 'FY27': 'O', 'FY28': 'AC', 'FY29': 'AQ'}[k]
    cs = FY[k]
    for i, c in enumerate(cs):
        PREV[c] = prevclose if i == 0 else cs[i - 1]

e = Editor(SRC)
e.expand_shared()

# =====================================================================
# C1. Hypothèses de coût des marchandises vendues
# =====================================================================
e.set(INP, 'A56', 'COÛT DES MARCHANDISES VENDUES — ratios de prévision')
e.set(INP, 'B56', 'Réel FY24 / FY25 / FY26')
e.set(INP, 'C56', 'FY2027')
e.set(INP, 'D56', 'FY2028')
e.set(INP, 'E56', 'FY2029')
e.set(INP, 'A57', 'Achats de matières premières (% des ventes nettes)')
e.set(INP, 'B57', '17,9 % / 17,7 % / 15,8 %')
e.set(INP, 'C57', 0.16)
e.set(INP, 'D57', 0.155)
e.set(INP, 'E57', 0.15)
e.set(INP, 'A58', 'Transport et douanes sur achats (% des achats)')
e.set(INP, 'B58', '6,4 % / 14,6 % / 4,5 %')
e.set(INP, 'C58', 0.10)
e.set(INP, 'D58', 0.10)
e.set(INP, 'E58', 0.10)
e.set(INP, 'A59', "Sous-traitance d'assemblage (% des ventes nettes)")
e.set(INP, 'B59', '12,0 % / 11,8 % / 19,2 %')
e.set(INP, 'C59', 0.17)
e.set(INP, 'D59', 0.155)
e.set(INP, 'E59', 0.145)
e.set(INP, 'A60', 'MOD interne, production sous-traitée dès FY2027 ($/an)')
e.set(INP, 'B60', '111 662 / 107 762 / 91 036')
e.set(INP, 'C60', 4500.0)
e.set(INP, 'D60', 4500.0)
e.set(INP, 'E60', 4500.0)
e.set(INP, 'A61', 'La sous-traitance monte (19,2 % en FY2026) parce que la production interne '
                  'disparaît, puis redescend avec l’échelle et le passage au bateau. Les coûts '
                  'unitaires cibles des fiches Tunisie (13-15 % du prix de vente) restent détaillés '
                  'dans « Ventes prévisionnelles » lignes 260 à 499 : ils constituent le plancher, '
                  'pas l’hypothèse retenue.')

for k in ('FY27', 'FY28', 'FY29'):
    rc = RATCOL[k]
    for c in FY[k]:
        e.set(PNL, f'{c}34', f'=Inputs!${rc}$57*{c}26')
        e.set(PNL, f'{c}36', f'=Inputs!${rc}$58*{c}34')
        e.set(PNL, f'{c}35', f'=Inputs!${rc}$59*{c}26')
        e.set(PNL, f'{c}38', f'=Inputs!${rc}$60/12')
        # variation d'inventaire = variation du poste au bilan, pour que le
        # résultat et le bilan racontent la même histoire
        p = PREV[c]
        e.set(PNL, f'{c}40', f"='{BIL}'!{p}11+'{BIL}'!{p}13-'{BIL}'!{c}11-'{BIL}'!{c}13")

# publicité numérique : amélioration modeste et énoncée, pas supposée
e.set(INP, 'A11', 'Publicité numérique (% du revenu brut) — réel FY26 24,4 %')
e.set(INP, 'G11', 0.22)
e.set(INP, 'H11', 0.205)
e.set(INP, 'I11', 0.195)

# le budget d'achats de matières de « Account payable » devient un dérivé du
# résultat, pour qu'il ne puisse plus le contredire
e.set(APA, 'A54', "Budget annuel d'achats de matières FY2027 (dérivé du résultat, ligne 34)")
e.set(APA, 'B54', f"='{PNL}'!AD34")
e.set(APA, 'A55', "Budget annuel d'achats de matières FY2028 (dérivé du résultat, ligne 34)")
e.set(APA, 'B55', f"='{PNL}'!AR34")
for row, share in ((45, 0.15), (46, 0.05), (47, 0.03), (48, 0.75), (49, 0.02)):
    e.set(APA, f'B{row}', f'=$B$54*{share}')
    e.set(APA, f'C{row}', f'=$B$55*{share}')

# =====================================================================
# C2. Aides publiques : sortir le PARI du scénario de base
# =====================================================================
for c in ALLM:
    e.set(PNL, f'{c}123', 0.0)          # PARI-CNRC : demande en cours, hors scénario de base
    e.set(PNL, f'{c}129', 0.0)          # « Économies d'opération » : une économie de coût
                                        # n'est pas un revenu, elle est déjà dans les charges
e.set(PNL, 'B123', 'PARI-CNRC (hors scénario de base — voir feuille « Sommaire bailleurs »)')
e.set(PNL, 'B129', "Économies d'opération (retiré : une économie de coût n'est pas un revenu)")

# lignes de lecture « hors aides publiques »
e.set(PNL, 'B141', 'Profit (perte) avant impôts — HORS aides publiques')
e.set(PNL, 'B144', 'EBITDA — HORS aides publiques')
e.set(PNL, 'B151', 'Aides publiques comprises dans le résultat')
for c in ALLM + list(TOT.values()):
    e.set(PNL, f'{c}141', f'={c}137+SUM({c}121:{c}134)')
    e.set(PNL, f'{c}144', f'={c}145+SUM({c}121:{c}134)')
    e.set(PNL, f'{c}151', f'=-SUM({c}121:{c}134)')

# =====================================================================
# C3. Plan d'embauche : phasé, et non plus trois postes le 1er septembre
# =====================================================================
e.set(INP, 'D48', 46327.0)   # ressource marketing active au 1er novembre 2026
e.set(INP, 'A26', 'Service client (reporté à FY2028)')
e.set(INP, 'B26', 'Ressource ventes et service (dès sept. 2027)')
for c in ['AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV']:
    e.set(INP, f'{c}26', 0.0)
e.set(INP, 'AK31', 0.0)      # gestion logistique active au 1er octobre 2026
e.set(INP, 'B31', 'Gestion logistique - production internationale (dès oct. 2026)')
e.set(INP, 'A62', "PLAN D'EMBAUCHE FY2027 — 2 postes phasés, pas 3 au 1er septembre")
e.set(INP, 'A63', 'Gestion logistique / production internationale : 1er oct. 2026 (11 mois). '
                  'Indispensable au virage manufacturier : c’est la personne qui pilote BMB Tunisie.')
e.set(INP, 'A64', 'Ressource marketing : 1er nov. 2026 (10 mois), après la campagne d’automne '
                  'financée, quand le volume justifie le poste.')
e.set(INP, 'A65', 'Ressource ventes et service : reportée à FY2028. Le service client est '
                  'automatisé ; l’ajouter en FY2027 contredirait cette structure.')
e.set(INP, 'A66', 'Expédition saisonnier : inchangé, oct. à déc., 25 h/sem.')

# =====================================================================
# C4. Avance de l'actionnaire : postposée, sans intérêt ni remboursement
#     (exigence habituelle de la BDC ; rembourser l'actionnaire avec l'argent
#      du prêteur est le premier motif de refus)
# =====================================================================
D27 = ['BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL']
D28 = ['BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA']
D29 = ['CE', 'CF', 'CG', 'CH', 'CI', 'CJ', 'CK', 'CL', 'CM', 'CN', 'CO', 'CP']
for cols in (D27, D28, D29):
    for c in cols:
        e.set(DET, f'{c}44', 0.0)     # intérêts 8 % sur l'avance
        e.set(DET, f'{c}46', 0.0)     # capital
        e.set(DET, f'{c}51', '=75000')
e.set(DET, 'B44', 'Intérêts avance actionnaire (0 $ : avance postposée et sans intérêt)')
e.set(DET, 'B46', 'Capital avance actionnaire (0 $ : postposée pour le terme des prêts)')
e.set(BIL, 'A47', 'Avance de l’actionnaire (postposée, sans intérêt, convention à documenter)')

# =====================================================================
# C5. Dividende à l'actionnaire : aucun pendant le terme des prêts
# =====================================================================
for c in ['AV', 'BE', 'BI', 'BR', 'BW', 'CF']:
    e.set(CAI, f'{c}31', 0.0)
e.set(CAI, 'A31', 'Dividende à l’actionnaire (0 $ : aucun pendant le terme des prêts)')
for k in ('FY27', 'FY28', 'FY29'):
    first = FY[k][0]
    prevclose = {'FY27': 'O', 'FY28': 'AC', 'FY29': 'AQ'}[k]
    e.set(BIL, f'{first}68', f'={prevclose}68+{prevclose}69')
for k in ('FY27', 'FY28', 'FY29'):
    for c in FY[k]:
        e.set(BIL, f'{c}40', 0.0)

# =====================================================================
# C6. FY2029 : les postes encore indexés sur 1,4516
# =====================================================================
for c, src in zip(FY['FY29'], FY['FY28']):
    for r in (46, 47, 48, 50, 51, 52, 53, 56, 58, 60, 73, 75, 79, 82, 83, 85, 87,
              92, 93, 94, 95, 96, 97, 98, 100, 101, 102, 106, 109, 110):
        pass  # ces postes sont déjà des montants d'exploitation, laissés tels quels

e.save(DST)
print(f"{len(e.log)} écritures -> {DST}")
