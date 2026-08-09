#!/usr/bin/env python3
"""Phase BB — le résultat jetait la saisonnalité du moteur de ventes.

La feuille « Ventes prévisionnelles » calcule, produit par produit et mois par
mois, le revenu des trois exercices projetés. Le résultat n'en lisait que le
**total annuel** — `$BR$5`, `$CG$5`, `$CV$5` — et le redistribuait avec douze
coefficients codés en dur :

    8,96 %  5,20 %  17,42 %  24,73 %  12,62 %  10,02 %
    5,50 %  3,90 %   9,65 %   1,19 %   0,27 %   0,54 %

Ces douze nombres sont le profil mensuel de **2025-2026**. Ils portent donc
deux accidents de cet exercice-là et les répètent jusqu'en 2029 :

- l'été volontairement arrêté — juin, juillet et août pèsent **2,0 %** de
  l'année, contre 6,9 % dans le moteur et 16 % au dernier été réellement
  produit ;
- la prévente du 30 mai 2026, un événement unique de 82 692 $, inscrite comme
  **9,65 %** de mai dans chacune des trois années à venir.

Le moteur, lui, porte une vraie courbe : chaque produit a son profil de douze
mois, et les produits d'été y vendent l'été. Ce travail était fait et jeté.

## Ce que la correction change, et ce qu'elle ne change pas

Le total annuel **ne bouge pas** : la somme des douze mois du moteur est
exactement le total que les coefficients redistribuaient. Ce qui change, c'est
**quand** le revenu rentre — donc le stock à financer, le creux de trésorerie
et le tirage de marge de crédit. C'est précisément ce qu'un prêteur regarde.

## Deuxième correction : les rangées de revenu étaient vides

Sur les 36 mois projetés, les rangées 9, 10 et 11 (B2C-CAN, B2C-USA, B2B) et
leur total, la rangée 3, ne portaient rien. Tout le revenu vivait sur la
rangée 5, « Revenus Prévisions ». Un lecteur qui parcourt l'état des résultats
voit « Ventes B2C -CAN : 0 » de septembre 2026 à août 2029 et conclut que le
modèle est cassé. Les trois canaux sont maintenant ventilés comme ils le sont
déjà en août 2026, et la rangée 3 redevient le total des ventes en ligne.

Les rangées 17, 18 et 25 passent de la rangée 5 à la rangée 3 : les 48 mois
ont désormais la même forme, du revenu jusqu'aux ventes nettes.

    python3 fix_bb.py
"""
import sys

sys.path.insert(0, 'tools')
from openpyxl.utils import column_index_from_string, get_column_letter
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
S = 'Résultats-Prev 2025-2029'
VP = "'Ventes prévisionnelles '"

# (colonnes du résultat, colonnes du moteur) — les trois exercices projetés.
BLOCS = [(('R', 'AC'), ('BF', 'BQ')),
         (('AF', 'AQ'), ('BU', 'CF')),
         (('AT', 'BE'), ('CJ', 'CU'))]

# Août 2026 est projeté lui aussi, mais il lit déjà son propre mois du moteur.
# Seule sa rangée 11 retranche le canal détail, ce que la 18 rajoute ensuite :
# on l'harmonise pour que la rangée 3 vaille vraiment le total des ventes.
AOUT = 'O'

# Répartition par canal, telle qu'elle est déjà posée en août 2026.
CANAL = {9: 0.856, 10: 0.077, 11: 0.067}


def cols(a, b):
    return [get_column_letter(i)
            for i in range(column_index_from_string(a),
                           column_index_from_string(b) + 1)]


def build(dst=F, src=F):
    avant = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()

    n = 0
    for (ra, rb), (ma, mb) in BLOCS:
        for c, m in zip(cols(ra, rb), cols(ma, mb)):
            e.set(S, f'{c}5', f'={VP}!{m}5',
                  'Le mois du moteur, pas le total annuel redistribué')
            n += 1
    for c in [c for (ra, rb), _ in BLOCS for c in cols(ra, rb)] + [AOUT]:
        for r, part in CANAL.items():
            e.set(S, f'{c}{r}', f'={c}5*{part}')
        e.set(S, f'{c}3', f'=SUM({c}9:{c}11)')
        e.set(S, f'{c}17', f'={c}16/{c}3')
        e.set(S, f'{c}18', f'={c}3+{c}16+{c}12')
        e.set(S, f'{c}25', f'={c}24/{c}3')

    # Les colonnes de total d'exercice : la rangée 3 n'en avait pas sur les
    # trois exercices projetés, et les rangées 17 et 25 y divisaient encore par
    # la rangée 5. Les quatre exercices se lisent maintenant pareil.
    for t, (a, b) in (('P', ('D', 'O')), ('AD', ('R', 'AC')),
                      ('AR', ('AF', 'AQ')), ('BF', ('AT', 'BE'))):
        e.set(S, f'{t}3', f'=SUM({a}3:{b}3)')
        e.set(S, f'{t}17', f'={t}16/{t}3')
        e.set(S, f'{t}25', f'={t}24/{t}3')

    journal(e)
    e.set_full_calc()
    e.save(dst)

    apres = xlcalc.load(dst)
    out = [f'{n} mois reliés au moteur de ventes, 37 mois ventilés par canal', '']
    out.append(f'{"":30}{"avant":>14}{"après":>14}')
    for lab, ref in (('Ventes nettes 2026-2027', 'AD26'),
                     ('Ventes nettes 2027-2028', 'AR26'),
                     ('Ventes nettes 2028-2029', 'BF26'),
                     ('Total des ventes 2028-2029 (l.3)', 'BF3'),
                     ('EBITDA 2028-2029', 'BF145')):
        out.append(f'{lab:<30}{avant.get(S, ref):>14,.0f}{apres.get(S, ref):>14,.0f}')
    out.append('')
    out.append('part de juin+juillet+août dans les ventes nettes de l’exercice')
    for (ra, rb), _ in BLOCS:
        cs = cols(ra, rb)
        for bk, quand in ((avant, 'avant'), (apres, 'après')):
            tot = sum(bk.get(S, c + '26') for c in cs)
            ete = sum(bk.get(S, c + '26') for c in cs[9:12])
            out.append(f'  {bk.get(S, cs[0] + "1")} {quand:<6} '
                       f'{ete:>10,.0f} $ sur {tot:>11,.0f} $   {ete / tot:>6.1%}')
    out.append('')
    for lab, ref in (('Tirage de marge le plus élevé', 'Inputs!D165'),
                     ('Tirage projeté le plus élevé', 'Inputs!D166'),
                     ('Dépassement de la limite', 'Inputs!D167')):
        sh, r = ref.split('!')
        out.append(f'{lab:<30}{avant.get(sh, r):>14,.0f}{apres.get(sh, r):>14,.0f}')
    return out


def journal(e):
    e.set('Notes d’audit', 'A80',
          '• Corrigé, et c’est le défaut le plus lourd trouvé à ce jour : le '
          'résultat ne lisait du moteur de ventes que son TOTAL ANNUEL, qu’il '
          'redistribuait sur douze mois avec des coefficients codés en dur '
          '(8,96 % · 5,20 % · 17,42 % · 24,73 % · 12,62 % · 10,02 % · 5,50 % · '
          '3,90 % · 9,65 % · 1,19 % · 0,27 % · 0,54 %). Ces douze nombres sont '
          'le profil mensuel de 2025-2026 : ils reportaient jusqu’en 2029 '
          'l’été volontairement arrêté (juin, juillet et août à 2,0 % de '
          'l’année) et la prévente unique du 30 mai 2026 (mai à 9,65 %). '
          'Chaque mois projeté lit maintenant son propre mois du moteur, où '
          'chaque produit porte sa courbe de douze mois.')
    e.set('Notes d’audit', 'A81',
          '• Ce que la correction change : le total annuel ne bouge pas d’un '
          'dollar — la somme des douze mois du moteur est exactement le total '
          'que les coefficients redistribuaient. Ce qui bouge, c’est quand le '
          'revenu rentre. La part de juin, juillet et août passe de 2,6 % à '
          '6,8 % en 2026-2027, de 3,3 % à 6,9 % en 2027-2028 et de 3,7 % à '
          '6,9 % en 2028-2029. Le tirage de marge de crédit projeté le plus '
          'élevé passe de 141 878 $ à 141 295 $.')
    e.set('Notes d’audit', 'A82',
          '• Corrigé aussi : sur les 36 mois projetés, les rangées 9, 10 et 11 '
          '(B2C-CAN, B2C-USA, B2B) et leur total, la rangée 3, ne portaient '
          'rien — tout le revenu vivait sur la rangée 5. L’état des résultats '
          'affichait « Ventes B2C -CAN : 0 » de septembre 2026 à août 2029. '
          'Les trois canaux sont ventilés comme ils l’étaient déjà en août '
          '2026 (85,6 % · 7,7 % · 6,7 %), la rangée 3 redevient le total des '
          'ventes en ligne, et les rangées 17, 18 et 25 y renvoient : les '
          '48 mois ont désormais la même forme.')


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
