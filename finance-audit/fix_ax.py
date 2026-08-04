#!/usr/bin/env python3
"""Phase AX — l'avance de 80 000 $ s'ajoute à celle qui existe déjà.

QuickBooks porte 3 678 $ d'avance de l'actionnaire au 31 juillet 2026. Le
modèle écrasait ce solde par les 80 000 $ de l'entente du 15 août, comme si le
nouveau versement remplaçait l'ancien. Gabriel a tranché : les deux montants
coexistent.

## Ce que ça change, ligne par ligne

Le solde d'août devient 83 678 $. L'échéancier de l'entente reste ce qu'il est
— 80 000 $ remboursés en douze versements égaux de septembre 2026 à août 2027 —
mais il s'arrête sur le solde préexistant au lieu de zéro : le plancher du
`MAX` n'est plus 0, c'est le réel de juillet.

Les 3 678 $ ne portent pas d'intérêt. L'entente de juillet 2026 fixe 8 % sur
**son** capital ; l'avance antérieure n'a ni terme ni taux. Les rangées
d'intérêt continuent donc de se calculer sur `Inputs!C116` seul.

Et le solde ne disparaît pas en septembre 2027. Le laisser tomber à zéro ferait
sortir 3 678 $ de la caisse pour un remboursement que personne n'a décidé : les
36 mois de 2027-2028 et 2028-2029 portent le solde préexistant, sans mouvement.

    python3 fix_ax.py
"""
import sys

sys.path.insert(0, 'tools')
from openpyxl.utils import column_index_from_string, get_column_letter
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
BIL = 'Bilan2026-27-28'
DLT = 'Dette à long terme'
REEL = f"'{BIL}'!$N$47"          # le solde réel au 31 juillet 2026

# La chaîne de l'échéancier : août 2026, puis les douze mois de 2026-2027.
CHAINE = ['AW', 'BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ',
          'BK', 'BL']

# Les mois du bilan qui n'ont pas de colonne d'échéancier : ils portent le
# solde préexistant tel quel.
APRES = [('AF', 'AQ'), ('AT', 'BE')]


def colonnes(bornes):
    out = []
    for a, b in bornes:
        out += [get_column_letter(i)
                for i in range(column_index_from_string(a),
                               column_index_from_string(b) + 1)]
    return out


def build(dst=F, src=F):
    avant = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()

    e.set(DLT, 'AW51', f'={REEL}+Inputs!$C$116',
          'L’avance de l’entente s’ajoute au solde réel de juillet')
    for prec, col in zip(CHAINE, CHAINE[1:]):
        e.set(DLT, f'{col}51',
              f'=MAX({REEL},{prec}51-Inputs!$C$116/Inputs!$C$118)',
              'L’échéancier s’arrête sur le solde préexistant, pas sur zéro')

    for col in colonnes(APRES):
        e.set(BIL, f'{col}47', f'={REEL}',
              'Solde préexistant, sans échéance convenue')

    # La note va dans la cellule qui décrit déjà l'entente : la rangée 120
    # est le blanc qui sépare ce bloc du suivant, et un tableau sans respiration
    # se lit deux fois moins bien.
    e.set('Inputs', 'A119', avant.get('Inputs', 'A119') + ' '
          'S’ajoute aux 3 678 $ d’avance déjà inscrits au 31 juillet 2026 : le '
          'solde du 31 août 2026 est donc de 83 678 $. Ces 3 678 $ ne portent '
          'pas d’intérêt et n’ont pas d’échéance ; ils restent au bilan sur '
          'tout l’horizon.')

    journal(e)
    e.set_full_calc()
    e.save(dst)

    apres = xlcalc.load(dst)
    lignes = ['avance de l’actionnaire au bilan :']
    for col, quand in (('N', '31 juill. 2026 (réel)'),
                       ('O', '31 août 2026'), ('R', '30 sept. 2026'),
                       ('AC', '31 août 2027'), ('AQ', '31 août 2028'),
                       ('BE', '31 août 2029')):
        lignes.append(f'  {quand:<22} {avant.get(BIL, f"{col}47"):>10,.0f} → '
                      f'{apres.get(BIL, f"{col}47"):>10,.0f}')
    lignes.append('contrôle du bilan, 48 mois : ' + controle(apres))
    return lignes


def controle(bk):
    hors = [c for c in colonnes([('D', 'O'), ('R', 'AC'), ('AF', 'AQ'),
                                 ('AT', 'BE')])
            if abs(bk.get(BIL, f'{c}76') or 0) > 0.01]
    return 'aucun écart, 48/48 à zéro' if not hors else f'écarts en {hors}'


def journal(e):
    # Trois entrées écrites aux phases AV et AW citaient le tirage de marge de
    # crédit. Ajouter 3 678 $ de dette au 31 août 2026 met autant de liquidités
    # de plus dans la caisse, donc autant de tirage en moins : les chiffres
    # bougent, et la phase qui les fait bouger corrige ce qu'elle invalide.
    e.set('Notes d’audit', 'A65',
          '• Ce que la bascule révèle : la marge de crédit était tirée à '
          '143 026 $ au 31 juillet 2026, alors que le modèle projetait '
          '27 825 $. Le sommet des mois projetés — août 2026 à août 2029 — '
          's’établit à 141 878 $ en août 2027, soit 11 878 $ au-dessus de la '
          'limite de 130 000 $ retenue. Le modèle ne bride pas le tirage : '
          'plafonner cacherait le besoin au lieu de le montrer '
          '(Inputs, rangées 163 à 167).')
    e.set('Notes d’audit', 'A71',
          '• Conséquence, et c’est le point : le tirage de marge de crédit au '
          '31 août 2026 passe de 25 248 $ à 131 134 $. Les 106 000 $ d’écart '
          'n’étaient pas une prévision, c’était l’artefact de la frontière. Le '
          'contrôle d’Inputs (rangée 166) balayait de septembre 2026 à août '
          '2029 et sautait donc août 2026, le mois du sommet ; il part '
          'maintenant d’août 2026.')
    e.set('Notes d’audit', 'A74',
          '• Constat de clôture, scénario conservateur : 2025-2026 se referme '
          'sur 977 339 $ de ventes nettes et -122 613 $ avant impôts, dont '
          'onze mois réels. La marge de crédit demandée culmine à 143 026 $ — '
          'le réel du 31 juillet 2026 — et le sommet projeté atteint 141 878 $ '
          'en août 2027, le creux saisonnier d’avant-saison deux fois de '
          'suite. C’est le chiffre du dossier : la limite autorisée de '
          '130 000 $ ne suffit pas, il en faut 150 000 $.')
    e.set('Notes d’audit', 'A73',
          '• Tranché avec Gabriel : les 3 678 $ d’avance de l’actionnaire '
          'inscrits chez QuickBooks au 31 juillet 2026 s’ajoutent aux '
          '80 000 $ de l’entente du 15 août, ils ne sont pas remplacés par '
          'eux. Le solde du 31 août 2026 passe de 80 000 $ à 83 678 $. '
          'L’échéancier de l’entente reste douze versements égaux de septembre '
          '2026 à août 2027, mais il s’arrête sur le solde préexistant au lieu '
          'de zéro, et ce solde reste au bilan jusqu’en août 2029 : le laisser '
          'tomber ferait sortir 3 678 $ de la caisse pour un remboursement que '
          'personne n’a décidé. Les 3 678 $ ne portent pas d’intérêt — '
          'l’entente fixe 8 % sur son propre capital.')


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
