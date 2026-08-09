#!/usr/bin/env python3
"""Phase BC — un troisième scénario sur la bascule d'Inputs C70.

`Inputs!C70` portait deux lectures : 1 = conservateur, 2 = ambitieux. Elle en
porte trois. La troisième, **optimiste**, remet le classeur sur la trajectoire
annoncée dans la proposition de partenariat de juillet 2026 — 4,17 M$ de ventes
nettes en 2028-2029 — mais en la construisant avec les deux moteurs du modèle
au lieu d'un seul.

## Ce que la version de juillet ne faisait pas

Elle atteignait 4,17 M$ avec le **seul** commerce en ligne, à 61,7 % de
croissance par année, et ignorait complètement le canal détail. Le canal
détail existe : 13 801 $ encaissés en 2025-2026, un registre de 109 points de
vente construit ville par ville. Le laisser dehors d'une lecture optimiste
n'aurait pas de sens.

Le scénario optimiste garde donc la trajectoire, la répartit sur les deux
moteurs, et déploie le détail au rythme ambitieux. Le commerce en ligne n'a
plus à porter seul l'ambition : il croît vite, mais moins que dans la version
de juillet.

## Comment les hypothèses sont posées

Les facteurs de croissance du scénario optimiste sont ceux du scénario
ambitieux relevés d'un même écart, résolu par bissection pour que les ventes
nettes de 2028-2029 tombent sur la cible. Un seul écart pour toutes les
catégories : relever chaque catégorie séparément serait inventer six jugements
là où il n'y en a qu'un.

Les paramètres de coût — matières premières, sous-traitance, publicité — et le
plan d'embauche restent ceux du scénario ambitieux. L'optimisme porte sur le
volume, pas sur la structure de coûts : c'est la seule forme d'optimisme qu'un
prêteur accepte de lire.

## La mécanique de la bascule

Les 36 formules qui lisaient `IF(C70=2, ambitieux, conservateur)` deviennent :

- `IF(C70=3, optimiste, IF(C70=2, ambitieux, conservateur))` là où le scénario
  optimiste a sa propre valeur — les douze facteurs de croissance et le profil
  de 2028-2029 ;
- `IF(C70>=2, ambitieux, conservateur)` partout ailleurs. Écrire une colonne de
  valeurs identiques à celles d'à côté ferait croire qu'elles peuvent diverger.

    python3 fix_bc.py
"""
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
S = 'Résultats-Prev 2025-2029'
VP = 'Ventes prévisionnelles '

# Ventes nettes visées en 2028-2029 : celles de la version de juillet 2026,
# d'où sortent les chiffres de la proposition de partenariat.
CIBLE = 4_174_374.0

# Les rangées d'Inputs où le scénario optimiste a sa propre valeur, en colonne G.
CROISSANCE = list(range(75, 87)) + [96]

# Les formules à réécrire, par feuille. Celles qui ne sont pas dans CROISSANCE
# font suivre le scénario 3 au scénario 2.
INPUTS_PROPRE = {'C54': 96, 'C57': 87, 'C59': 90, 'D48': 97, 'D57': 88,
                 'D59': 91, 'E57': 89, 'E59': 92, 'G11': 93, 'H11': 94,
                 'I11': 95}
INPUTS_PAIRE = ['D123', 'D124', 'D125', 'D139', 'D140', 'D141']
INPUTS_ANCRE = {'D127': 127, 'D129': 129, 'D130': 130, 'D131': 131,
                'D132': 132}
VP_CELLS = {'BD10': 75, 'BD83': 76, 'BD141': 77, 'BD155': 78, 'BD186': 79,
            'BD243': 80, 'BS10': 81, 'BS83': 82, 'BS141': 83, 'BS155': 84,
            'BS186': 85, 'BS243': 86}


def poser(e, bk, ecart):
    """Écrit la colonne G et rebranche les 36 formules sur trois scénarios."""
    e.set('Inputs', 'B74', 'Conservateur (C70 = 1)')
    e.set('Inputs', 'C74', 'Ambitieux (C70 = 2)')
    e.set('Inputs', 'G74', 'Optimiste (C70 = 3)')
    for r in CROISSANCE:
        e.set('Inputs', f'G{r}', round(bk.get('Inputs', f'C{r}') + ecart, 4))

    for cible, r in INPUTS_PROPRE.items():
        source = f'$G${r}' if r in CROISSANCE else f'$C${r}'
        if r in CROISSANCE:
            e.set('Inputs', cible,
                  f'=IF($C$70=3,{source},IF($C$70=2,$C${r},$B${r}))')
        else:
            e.set('Inputs', cible, f'=IF($C$70>=2,$C${r},$B${r})')
    for cible in INPUTS_PAIRE:
        r = cible[1:]
        e.set('Inputs', cible, f'=IF($C$70>=2,C{r},B{r})')
    for cible, r in INPUTS_ANCRE.items():
        e.set('Inputs', cible, f'=IF($C$70>=2,$C${r},$B${r})')
    for cible, r in VP_CELLS.items():
        e.set(VP, cible,
              f'=IF(Inputs!$C$70=3,Inputs!$G${r},'
              f'IF(Inputs!$C$70=2,Inputs!$C${r},Inputs!$B${r}))')
    e.set('Détail par ville', 'B21', '=IF(Inputs!$C$70>=2,B20,B19)')
    e.set('Sommaire', 'A3',
          '=IF(Inputs!$C$70=3,"Scénario actif : OPTIMISTE (trajectoire de la '
          'proposition de juillet 2026)",IF(Inputs!$C$70=2,"Scénario actif : '
          'AMBITIEUX (investisseur privé)","Scénario actif : CONSERVATEUR '
          'RÉALISTE (bailleurs institutionnels)"))&"  —  bascule dans Inputs, '
          'cellule C70."')


def essai(bk0, ecart, chemin='_scen3.xlsx'):
    """Ventes nettes de 2028-2029 pour un écart donné, scénario 3 actif."""
    e = Editor(F)
    e.expand_shared()
    poser(e, bk0, ecart)
    e.set('Inputs', 'C70', 3.0)
    e.set_full_calc()
    e.save(chemin)
    return xlcalc.load(chemin).get(S, 'BF26')


def resoudre(bk0, cible=CIBLE, bas=0.0, haut=0.60, tours=14):
    """Bissection sur l'écart appliqué aux facteurs ambitieux."""
    trace = []
    for _ in range(tours):
        mid = (bas + haut) / 2
        v = essai(bk0, mid)
        trace.append((mid, v))
        if v < cible:
            bas = mid
        else:
            haut = mid
        if abs(v - cible) < 2000:
            break
    return mid, trace


def build(dst=F, src=F):
    bk0 = xlcalc.load(src)
    ecart, trace = resoudre(bk0)

    e = Editor(src)
    e.expand_shared()
    poser(e, bk0, ecart)
    e.set('Inputs', 'E74',
          'Le scénario optimiste reprend les facteurs ambitieux relevés de '
          f'{ecart:.3f} — le même écart pour toutes les catégories, résolu pour '
          .replace('.', ',', 1) +
          'que les ventes nettes de 2028-2029 retrouvent la trajectoire de la '
          'proposition de juillet 2026 (4,17 M$). Les paramètres de coût et le '
          'plan d’embauche restent ceux du scénario ambitieux : l’optimisme '
          'porte sur le volume, pas sur la structure.')
    e.set('Inputs', 'A70',
          'SCÉNARIO ACTIF  →  1 = conservateur réaliste (bailleurs)   '
          '2 = ambitieux (investisseur privé)   3 = optimiste (trajectoire de '
          'la proposition de juillet 2026)')
    e.set('Inputs', 'A73',
          'Optimiste : la trajectoire annoncée en juillet 2026, mais portée par '
          'les deux moteurs. La version de juillet atteignait 4,17 M$ avec le '
          'seul commerce en ligne, à 61,7 % de croissance par année, et '
          'ignorait le canal détail. Ici le détail se déploie au rythme '
          'ambitieux — 101 points de vente au 31 août 2029 — et le commerce en '
          'ligne n’a plus à porter seul l’ambition.')
    journal(e, ecart)
    e.set('Inputs', 'C70', 1.0)          # on repart sur le conservateur
    e.set_full_calc()
    e.save(dst)

    out = [f'écart résolu : +{ecart:.4f} sur chaque facteur de croissance',
           '  bissection : ' + ' → '.join(f'{v/1e6:,.2f}' for _, v in trace[-4:]),
           '']
    out.append(f'{"":34}{"conservateur":>14}{"ambitieux":>14}{"optimiste":>14}')
    for scen in (1, 2, 3):
        ed = Editor(dst)
        ed.expand_shared()
        ed.set('Inputs', 'C70', float(scen))
        ed.set_full_calc()
        ed.save(f'_s{scen}.xlsx')
    bks = {s: xlcalc.load(f'_s{s}.xlsx') for s in (1, 2, 3)}
    for lab, sh, ref in (('Ventes nettes 2028-2029', S, 'BF26'),
                         ('  dont commerce en ligne', S, None),
                         ('  dont canal détail', S, 'BF12'),
                         ('Ventes nettes 2026-2027', S, 'AD26'),
                         ('Ventes nettes 2027-2028', S, 'AR26'),
                         ('Résultat avant impôts 2028-2029', S, 'BF137'),
                         ('EBITDA 2028-2029', S, 'BF145'),
                         ('Tirage de marge le plus élevé', 'Inputs', 'D165')):
        vals = []
        for s in (1, 2, 3):
            if ref is None:
                vals.append(bks[s].get(S, 'BF26') - bks[s].get(S, 'BF12'))
            else:
                vals.append(bks[s].get(sh, ref))
        out.append(f'{lab:<34}' + ''.join(f'{v:>14,.0f}' for v in vals))
    out.append('')
    for s in (1, 2, 3):
        bad = [c for c in ('BF76',) if abs(bks[s].get('Bilan2026-27-28', c) or 0) > 0.01]
        out.append(f'  scénario {s} : contrôle du bilan 2028-2029 '
                   f'{bks[s].get("Bilan2026-27-28", "BF76"):.4f}, '
                   f'{"ok" if not bad else "ÉCART"}')
    return out


def journal(e, ecart):
    e.set('Notes d’audit', 'A83',
          '• La bascule Inputs C70 porte maintenant trois lectures : '
          '1 = conservateur réaliste, 2 = ambitieux, 3 = optimiste. La '
          'troisième remet le classeur sur la trajectoire annoncée dans la '
          'proposition de partenariat de juillet 2026 — 4,17 M$ de ventes '
          'nettes en 2028-2029 — mais en la construisant avec les deux '
          'moteurs. La version de juillet atteignait ce montant avec le seul '
          'commerce en ligne, à 61,7 % de croissance annuelle, et ignorait le '
          'canal détail ; ici le détail se déploie au rythme ambitieux et le '
          'commerce en ligne n’a plus à porter seul l’ambition.')
    e.set('Notes d’audit', 'A84',
          '• Comment le scénario optimiste est posé : ses facteurs de '
          f'croissance sont ceux du scénario ambitieux relevés de {ecart:.3f}, '
          'le même écart pour les six catégories et les trois exercices, '
          'résolu par bissection sur les ventes nettes de 2028-2029. Un seul '
          'écart plutôt que six jugements séparés. Les paramètres de coût — '
          'matières, sous-traitance, publicité — et le plan d’embauche restent '
          'ceux du scénario ambitieux : l’optimisme porte sur le volume, pas '
          'sur la structure de coûts.')
    e.set('Notes d’audit', 'A85',
          '• Mécanique : les 36 formules qui lisaient IF(C70=2, ambitieux, '
          'conservateur) deviennent IF(C70=3, optimiste, IF(C70=2, ambitieux, '
          'conservateur)) là où le scénario optimiste a sa propre valeur — les '
          'douze facteurs de croissance et le profil de 2028-2029, colonne G '
          'd’Inputs — et IF(C70>=2, ambitieux, conservateur) partout ailleurs. '
          'Écrire une colonne de valeurs identiques à celles d’à côté ferait '
          'croire qu’elles peuvent diverger.')


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
