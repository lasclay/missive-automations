#!/usr/bin/env python3
"""Phase A — intégrité technique du chiffrier de prévisions Lasclay.
Ne touche à aucune hypothèse d'affaires : répare les formules cassées, les
liens décalés, les totaux qui n'englobent pas leurs composantes, et les
définitions incohérentes (EBITDA, intérêts, amortissement, disposition)."""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

SRC = 'prev_orig.xlsx'
DST = 'prev_fix_a.xlsx'

PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
CAI = 'Budget de caisse'
DET = 'Dette à long terme'
IMM = 'Immos'
INP = 'Inputs'
ACR = 'Account Recevables'
APA = 'Account payable'

# blocs de colonnes, exercice par exercice
FY = {
    'FY26': list('DEFGHIJKLMNO'),
    'FY27': ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],
    'FY28': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
    'FY29': ['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE'],
}
TOTCOL = {'FY26': 'P', 'FY27': 'AD', 'FY28': 'AR', 'FY29': 'BF'}
ALLM = [c for cs in FY.values() for c in cs]

# colonnes du budget de caisse (mêmes exercices, géométrie propre à la feuille)
CFY = {
    'FY24': list('DEFGHIJKLMNO'),
    'FY25': ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],
    'FY26': ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ'],
    'FY27': ['AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD'],
    'FY28': ['BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ'],
    'FY29': ['BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA', 'CB', 'CC', 'CD', 'CE'],
}
CTOT = {'FY24': 'P', 'FY25': 'AD', 'FY26': 'AR', 'FY27': 'BE', 'FY28': 'BR', 'FY29': 'CF'}
# correspondance colonne P&L -> colonne Budget de caisse
P2C = {}
for k in ('FY26', 'FY27', 'FY28', 'FY29'):
    for a, b in zip(FY[k], CFY[k]):
        P2C[a] = b
# correspondance colonne P&L -> colonne Immos (les blocs Immos sont décalés)
IMMB = {'FY26': list('DEFGHIJKLMNO'),
        'FY27': ['U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF'],
        'FY28': ['AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW'],
        'FY29': ['BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN']}
P2I = {}
for k in IMMB:
    for a, b in zip(FY[k], IMMB[k]):
        P2I[a] = b

e = Editor(SRC)
print('formules partagées développées :', e.expand_shared())

# =====================================================================
# A0. Hygiène du classeur
# =====================================================================
e.drop_external_links()          # 2 liens morts « xlPathMissing », référencés par rien
e.set_full_calc()
e.set(INP, 'B10', 1.38, 'remplace le googlefinance() cassé hérité de Google Sheets')
e.set(INP, 'A10', 'Taux de change USD/CAD (hypothèse fixe, à réviser au besoin)')

# =====================================================================
# A1. La racine des #REF! : Account Recevables
# =====================================================================
e.set(ACR, 'N1', 'Aug. 2024')                    # était « Aug. 2025 », 12e mois du bloc FY24
e.set(ACR, 'N6', "='Résultats2024'!O26")         # était le littéral #REF!
# le bloc FY2025 lisait Résultats2024!R26:AC26, colonnes mortes (#REF!) ;
# le vrai FY2025 vit dans Résultats2025maj D26:O26
for i, c in enumerate(['P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA']):
    src = 'DEFGHIJKLMNO'[i]
    e.set(ACR, f'{c}6', f"='Résultats2025maj'!{src}26")

# =====================================================================
# A2. Formules partagées orphelines (groupe si=96 sans maître)
# =====================================================================
for c in ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'AA', 'AB', 'AC']:
    e.set(PNL, f'{c}46', '=5000/12', 'RSDE matériaux : formule partagée cassée')

# =====================================================================
# A3. Totaux qui n'englobent pas leurs composantes
# =====================================================================
# r181 : 27 colonnes omettaient la r180 (avance de l'actionnaire)
for c in ALLM:
    e.set(PNL, f'{c}181', f'=SUM({c}174:{c}180)')
for k, t in TOTCOL.items():
    e.set(PNL, f'{t}181', f'=SUM({FY[k][0]}181:{FY[k][-1]}181)')
# r171 : intègre la r170, qui va porter le produit de disposition
for c in ALLM:
    e.set(PNL, f'{c}171', f'=SUM({c}168:{c}170)')
for k, t in TOTCOL.items():
    e.set(PNL, f'{t}171', f'=SUM({t}168:{t}170)')
    e.set(PNL, f'{t}170', f'=SUM({FY[k][0]}170:{FY[k][-1]}170)')

# =====================================================================
# A4. Disposition d'équipements FY2026 — comptabilisation correcte
#     VNC 39 670,02 vendue 33 979 => perte 5 691,02
#     rackings hors registre vendus 1 200 => gain 1 200
#     perte nette au résultat 4 491,02 ; encaissement 35 179 en investissement
# =====================================================================
e.set(IMM, 'A40', 'DISPOSITION FY2026 — détail (chiffrier « Vente équipements », comptable)')
e.set(IMM, 'B41', 'Produit de vente des actifs inscrits au compte 1630')
e.set(IMM, 'F41', 33979.0)
e.set(IMM, 'B42', 'Produit de vente des rackings (coût déjà passé en charges, hors registre)')
e.set(IMM, 'F42', 1200.0)
e.set(IMM, 'B43', 'VNC sortie du registre (coût 67 899,95 − amort. cumulé 28 229,93)')
e.set(IMM, 'F43', '=F10-K10')
e.set(IMM, 'B44', 'Perte sur les actifs inscrits')
e.set(IMM, 'F44', '=F43-F41')
e.set(IMM, 'B45', 'Perte nette sur disposition (portée au résultat)')
e.set(IMM, 'F45', '=F44-F42')
e.set(IMM, 'B46', 'Encaissement total de la disposition (porté aux investissements)')
e.set(IMM, 'F46', '=F41+F42')

e.set(PNL, 'B119', 'Perte nette sur disposition d’immobilisations')
e.set(PNL, 'O119', '=Immos!F45')
e.set(PNL, 'B170', 'Produit de disposition d’immobilisations')
e.set(PNL, 'O170', '=Immos!F46')
# la r148 s'appelle « Amortissements » : elle ne doit plus contenir la disposition
e.set(PNL, 'O148', '=O99+O55+O54+O49')

# =====================================================================
# A5. Définitions : intérêts, EBITDA, flux de trésorerie
# =====================================================================
# r149 « Intérêts » : englobe tous les intérêts (r110 à r116), pas seulement 111-114
for c in ALLM:
    e.set(PNL, f'{c}149', f'={c}110+{c}111+{c}112+{c}113+{c}114+{c}115+{c}116')
for k, t in TOTCOL.items():
    e.set(PNL, f'{t}149', f'=SUM({FY[k][0]}149:{FY[k][-1]}149)')
# r145 EBITDA = résultat avant impôts + amortissements + intérêts + perte sur disposition
# (l'ancienne formule rajoutait les impôts à un résultat déjà avant impôts)
for c in ALLM:
    e.set(PNL, f'{c}145', f'={c}137+{c}148+{c}149+{c}119')
for k, t in TOTCOL.items():
    e.set(PNL, f'{t}145', f'={t}137+{t}148+{t}149+{t}119')
e.set(PNL, 'C145', 'EBITDA (avant impôts, intérêts, amortissements et disposition)')
e.set(PNL, 'B150', 'Impôts (mémo, déjà exclus du résultat avant impôts)')
# r184 : même définition partout (l'ancienne partait du résultat après impôts
# dans les colonnes mensuelles et d'avant impôts dans les colonnes de total)
for c in ALLM:
    e.set(PNL, f'{c}184', f'={c}142+{c}148+{c}119+{c}165+{c}171+{c}181')
for k, t in TOTCOL.items():
    e.set(PNL, f'{t}184', f'={t}142+{t}148+{t}119+{t}165+{t}171+{t}181')
# r142 : cohérent avec 137 et 140 dans les colonnes de total
for k, t in TOTCOL.items():
    e.set(PNL, f'{t}142', f'={t}137-{t}140')
    e.set(PNL, f'{t}120', f'=SUM({t}121:{t}136)+{t}119')
    e.set(PNL, f'{t}119', f'=SUM({FY[k][0]}119:{FY[k][-1]}119)')

# =====================================================================
# A6. Amortissement FY2026 : QBO n'a rien passé, le registre est la référence
#     Régularisation de fin d'exercice en août 2026, comme le ferait le comptable.
# =====================================================================
for row, immrow in ((49, 36), (54, 33), (55, 34), (99, 35)):
    e.set(PNL, f'N{row}', f'=-Immos!N{immrow}')
    e.set(PNL, f'O{row}', f'=-Immos!$P${immrow}-SUM(D{row}:N{row})')

# =====================================================================
# A7. Immobilisations : les acquisitions viennent du registre, pas de valeurs en dur
# =====================================================================
for c in ['N', 'O'] + FY['FY27'] + FY['FY28'] + FY['FY29']:
    e.set(PNL, f'{c}168', f'=-Immos!{P2I[c]}28')

# =====================================================================
# A8. Dette à long terme : soldes d'ouverture manquants et rustines empilées
# =====================================================================
e.set(DET, 'AL5', '=AJ5-AL21')      # BDC FDR : le report du solde d'ouverture manquait
e.set(DET, 'AL6', '=AJ6-AL22')      # BDC 18K : idem
e.set(DET, 'AY5', '=AW5')           # était 53329 en dur
e.set(DET, 'AY11', '=AW11')
e.set(DET, 'BA5', '=AY5-BA21')      # était =53333.12-BA21
e.set(DET, 'BA6', '=AY6-BA22')      # était =15000-BA22
e.set(DET, 'BA7', '=AY7-BA23')
e.set(DET, 'BA10', '=AY10-BA26-BA41')   # était =164869.77-BA26-BA41
e.set(DET, 'BA11', '=AY11-BA28')        # était =11000-BA28
e.set(DET, 'AY22', '=SUM(AL22:AW22)')   # pointait sur la ligne de solde AY6
e.set(DET, 'AY23', '=SUM(AL23:AW23)')   # idem AY7
e.set(DET, 'BN4', '=BL4')               # était 21934 en dur
e.set(DET, 'BN6', '=BL6')               # était 11400 en dur
e.set(DET, 'AY1', 'Solde au 31 août 2026')
e.set(DET, 'BN1', 'Solde au 31 août 2027')
e.set(DET, 'CC1', 'Solde au 31 août 2028')

# =====================================================================
# A9. Bilan : liens décalés d'un exercice, totaux divergents, brouillons
# =====================================================================
# r11 Inventaire MP lisait mars-août 2025 au lieu de mars-août 2026
for c, src in zip('JKLMNO', ['AL', 'AM', 'AN', 'AO', 'AP', 'AQ']):
    e.set(BIL, f'{c}11', f"='Account payable'!{src}34")
# r48 Emprunt Shopify : la séquence redémarrait à BE3 en mars 2027
for c, src in zip(['X', 'Y', 'Z', 'AA', 'AB', 'AC'], ['BG', 'BH', 'BI', 'BJ', 'BK', 'BL']):
    e.set(BIL, f'{c}48', f"='Dette à long terme'!{src}3")
# r35 Taxes à payer partait de la r34 (frais courus) aux bascules FY29
e.set(BIL, 'AT35', '=AF35*1.4')
e.set(BIL, 'BE35', '=AQ35*1.4')
# r58 Merchant Growth défini comme -r41 (portion CT), sans sens comptable
e.set(BIL, 'AT58', 0.0)
e.set(BIL, 'BE58', 0.0)
# r19 Équipements : Z19 omettait le terme d'acquisition
e.set(BIL, 'Z19', '=Y19+Immos!AC33+Immos!AC23')
# r20/21/22 FY29 : la séquence Immos redémarrait à BC après trois mois
for i, c in enumerate(['AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']):
    src = IMMB['FY29'][i]
    prev = ['AQ', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD'][i]
    e.set(BIL, f'{c}20', f'={prev}20+Immos!{src}34')
    e.set(BIL, f'{c}21', f'={prev}21+Immos!{src}35')
    e.set(BIL, f'{c}22', f'={prev}22+Immos!{src}36')
    e.set(BIL, f'{c}19', f'={prev}19+Immos!{src}33+Immos!{src}23')
# r45 « Passif à long terme » excluait la r59 (nouvelle dette) : 125 000 $ d'écart
for c in ['B'] + FY['FY26'] + FY['FY27'] + FY['FY28'] + FY['FY29']:
    e.set(BIL, f'{c}45', f'=SUM({c}47:{c}59)')
    e.set(BIL, f'{c}60', f'=SUM({c}47:{c}59)')
# r10 Crédits d'impôt : tirait le sous-total « Autres revenus/dépenses », qui
# contient désormais la perte sur disposition
e.set(BIL, 'R10', "=-('Résultats-Prev 2025-2029'!R126+'Résultats-Prev 2025-2029'!R128)")
# r81 : les trois bascules d'exercice étaient invisibles
e.set(BIL, 'R81', '=R76-O76')
e.set(BIL, 'AF81', '=AF76-AC76')
e.set(BIL, 'AT81', '=AT76-AQ76')
# lignes de brouillon abandonnées
for coord in ['I61', 'J61', 'R61', 'I62', 'J62'] + [f'{c}42' for c in 'DEFGHI']:
    e.set(BIL, coord, None)
e.set(BIL, 'A2', "Pour l'exercice se terminant le 31 août 2026, 2027, 2028 et 2029")
e.set(BIL, 'A76', 'Total de contrôle (doit être zéro : actif − passif − capitaux propres)')
e.set(BIL, 'A40', 'Dividendes à payer (déclarés aux capitaux propres, r. 68)')
# le dividende retiré des capitaux propres n'entrait nulle part
for k in ('FY27', 'FY28', 'FY29'):
    first = FY[k][0]
    prevtot = {'FY27': 'P', 'FY28': 'AD', 'FY29': 'AR'}[k]
    for c in FY[k]:
        e.set(BIL, f'{c}40', f"=MAX(0,0.05*'Résultats-Prev 2025-2029'!{prevtot}142)"
              f"-'Budget de caisse'!{CTOT[k]}31")

# =====================================================================
# A10. Budget de caisse
# =====================================================================
for k in ('FY26', 'FY27', 'FY28', 'FY29'):
    for i, c in enumerate(CFY[k]):
        p = FY[k][i]
        # r10 = nouveaux emprunts ; r26 = remboursements. Avant, la r10 était
        # décorative et un terme correcteur « +x10 » ne vivait que dans 13 colonnes.
        e.set(CAI, f'{c}10', f"=SUMIF('Résultats-Prev 2025-2029'!{p}174:{p}180,\">0\")")
        e.set(CAI, f'{c}26', f"=-SUMIF('Résultats-Prev 2025-2029'!{p}174:{p}180,\"<0\")")
        # r12 : la r6 était omise dans 70 colonnes sur 72
        e.set(CAI, f'{c}12', f'={c}6+{c}7+{c}8+{c}9+{c}10')
        # r18 : la masse salariale marketing disparaissait en FY28-FY29
        e.set(CAI, f'{c}18', f"='Résultats-Prev 2025-2029'!{p}38"
              f"+'Résultats-Prev 2025-2029'!{p}45+'Résultats-Prev 2025-2029'!{p}69"
              f"+'Résultats-Prev 2025-2029'!{p}91+'Résultats-Prev 2025-2029'!{p}81")
        # r23 : l'amortissement du matériel informatique n'était retiré qu'en sept. 2025
        e.set(CAI, f'{c}23', f"='Résultats-Prev 2025-2029'!{p}90"
              f"-'Résultats-Prev 2025-2029'!{p}91-'Résultats-Prev 2025-2029'!{p}99")
        # r28 : 8 valeurs en dur en FY27, débranchées du registre d'immos
        e.set(CAI, f'{c}28', f"=-'Résultats-Prev 2025-2029'!{p}168")
# colonnes de total : sommer les 12 mois, pas la colonne (4 exercices perdaient
# des montants inscrits directement dans un mois)
for k, t in CTOT.items():
    a, b = CFY[k][0], CFY[k][-1]
    for r in (6, 7, 8, 9, 10, 12, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
              27, 28, 29, 30, 31, 32):
        e.set(CAI, f'{t}{r}', f'=SUM({a}{r}:{b}{r})')
# r27 FY25 : 25 % du chiffre d'affaires présenté comme un impôt
for c in CFY['FY25']:
    e.set(CAI, f'{c}27', None)
# ancrage de trésorerie : sortir le littéral de la formule et le documenter
e.set(CAI, 'A35', 'Ancrage de trésorerie — solde bancaire mesuré au 31 juillet 2026')
e.set(CAI, 'C35', 28472.0)
e.set(CAI, 'D35', 'À reconcilier avec AccèsD et QBO avant dépôt (QBO : 30 551 $ chèques + 6 346 $ PayPal)')
e.set(CAI, 'AR33', '=$C$35+AQ32')
# étiquettes qui ne décrivaient pas leur contenu
e.set(CAI, 'A3', 'Exercices 2024 à 2029 (1er septembre au 31 août)')
e.set(CAI, 'B10', 'Nouveaux emprunts encaissés')
e.set(CAI, 'B26', 'Remboursements de capital (dette à long terme et avances)')
e.set(CAI, 'B8', 'Subventions encaissées')
e.set(CAI, 'AR1', 'Total 2025-2026')
e.set(CAI, 'BE1', 'Total 2026-2027')
for k in ('FY24', 'FY25'):
    for c in CFY[k]:
        e.set(CAI, f'{c}2', 'Actuel')
# PO Vegeto : l'asymétrie 30 467 / 30 466 laissait 1 $ de résidu
e.set(CAI, 'AW29', -30467.0)
e.set(CAI, 'AY29', 30467.0)

# =====================================================================
# A11. Hypothèses : colonnes d'exercice mal saisies (8 au lieu de 0,08)
# =====================================================================
e.set(INP, 'I5', 0.08)     # escompte 2029, saisi 8
e.set(INP, 'G12', 0.035)   # frais Shopify 2027, saisi 3,5
e.set(INP, 'H12', 0.035)
e.set(INP, 'I12', 0.035)
# bloc de brouillon P38:T52 : une cellule y affiche 47,7 M$ (taux × salaire)
for r in range(38, 53):
    for c in ['P', 'Q', 'R', 'S', 'T']:
        e.set(INP, f'{c}{r}', None)
e.set(INP, 'A42', 'RSDE FY2026 — même méthode que FY2027 (55 % des salaires admissibles, majorés)')
e.set(INP, 'C42', '=C39*1.175+C41*1.11')
e.set(PNL, 'O128', '=-Inputs!$C$42-SUM(D128:N128)')

e.save(DST)
print(f"{len(e.log)} écritures -> {DST}")
