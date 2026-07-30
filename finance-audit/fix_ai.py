#!/usr/bin/env python3
"""Phase AI — la section du canal détail, et le point dur qui a changé.

Le canal détail porte 39 % des ventes de FY2029 en scénario conservateur et 49 %
en ambitieux. Un prêteur ne signera pas ça sans voir les pilotes, ce que le canal
coûte, et ce qu'il immobilise. La section 11 les met à plat.

Le point dur du dossier a changé de nature et il faut le réécrire. La couverture
du service de la dette passe 1,25 dès FY2028 et les capitaux propres redeviennent
positifs la même année : le risque n'est plus la capacité de payer. C'est
l'exécution d'un déploiement détail qui n'a pas encore commencé — zéro point de
vente aujourd'hui, douze visés au 31 août 2027. Le dire d'abord vaut mieux que de
le faire découvrir.
"""
import re
import sys
sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
SOM = 'Sommaire bailleurs'
PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
MONEY, PCT = '678', '679'


def fr(x, dec=0):
    return f'{x:,.{dec}f}'.replace(',', ' ').replace('.', ',')


def build(dst=F, src=F):
    bk = xlcalc.load(src)
    g = lambda sh, a: bk.get(sh, a)
    tots = ('AD', 'AR', 'BF')
    ventes = [g(PNL, t + '26') for t in tots]
    detail = [g(PNL, t + '12') for t in tots]
    part = [d / v for d, v in zip(detail, ventes)]
    d27, d28, d29 = (g(SOM, c + '102') for c in 'CDE')
    eq = [g(BIL, c + '70') for c in ('O', 'AC', 'AQ', 'BE')]
    peak = g(SOM, 'B49')

    e = Editor(src)
    e.expand_shared()

    # ------------------------------------------------ le point dur, réécrit
    hard = [
        'LE POINT DUR DU DOSSIER, ÉNONCÉ AVANT QU’ON LE TROUVE :',
        f'Avec le canal détail, la couverture du service de la dette passe de {fr(d27, 2)} en '
        f'FY2027 à {fr(d28, 2)} en',
        f'FY2028 et {fr(d29, 2)} en FY2029. Le seuil habituel d’une banque est de 1,25 : il est '
        'franchi',
        f'dès FY2028, et les capitaux propres redeviennent positifs le même exercice '
        f'({fr(eq[2])} $).',
        'Le point dur n’est donc plus la capacité de payer. Il est ailleurs, et il est réel :',
        f'1. FY2027 reste sous le seuil, à {fr(d27, 2)}, et négatif hors aides publiques. C’est '
        'l’exercice',
        '   qui a besoin du financement, pas les suivants — c’est aussi pour ça qu’il faut du',
        '   capital patient dans le montage, pas seulement de la dette amortissable.',
        f'2. Le canal détail porte {fr(part[2] * 100, 0)} % des ventes de FY2029 et il n’existe '
        'pas encore. Zéro point de',
        '   vente aujourd’hui, douze visés au 31 août 2027. C’est LE risque d’exécution du plan,',
        '   et la question à poser est le nombre de lettres d’intention signées, pas le modèle.',
        '3. La consignation immobilise du stock chez des tiers : '
        f'{fr(g(BIL, "BE84"))} $ au 31 août 2029.',
        '   C’est du fonds de roulement qui ne revient qu’à la vente au consommateur.',
        'Ce que le modèle ne prétend pas : que le déploiement se fasse tout seul. Il suppose un',
        'chargé de comptes dès FY2028, une commission de représentation de 7 %, un présentoir par',
        'point de vente, et un coût des marchandises de 55 % du revenu encaissé au lieu de 33 %.',
    ]
    r = 110
    for txt in hard:
        e.set(SOM, f'A{r}', txt)
        r += 1
    for rr in range(r, 126):
        e.set(SOM, f'A{rr}', None)

    # -------------------------------------------------- section 11, le canal
    last = 0
    for a in list(bk.values[SOM]) + list(bk.formulas[SOM]):
        m = re.match(r'^([A-Z]+)(\d+)$', a)
        if m:
            last = max(last, int(m.group(2)))
    r = last + 2
    e.set(SOM, f'A{r}', '11. LE CANAL DÉTAIL — CONSIGNATION AU CANADA')
    r += 1
    for txt in [
        'Un point de vente majeur par ville moyenne à grande, toute la gamme en dépôt, 40 % de',
        'marge au détaillant. Le canal n’est pas modélisé par un taux de croissance : il l’est par',
        'ses pilotes, qui sont dans Inputs aux rangées 121 à 138 et se changent un par un.',
    ]:
        e.set(SOM, f'A{r}', txt)
        r += 1
    r += 1
    head = r
    e.set(SOM, f'A{r}', '')
    for c, h in zip('BCD', ('FY2027', 'FY2028', 'FY2029')):
        e.set(SOM, f'{c}{r}', h)
    r += 1
    block = [
        ('Points de vente ouverts au 31 août', [g(PNL, t + '13') for t in tots], MONEY),
        ('Vente au détail (prix de détail payé par le consommateur)',
         [d / g('Inputs', 'D128') for d in detail], MONEY),
        ('Revenu encaissé par Lasclay (60 %)', detail, MONEY),
        ('Part des ventes nettes', part, PCT),
        ('Stock en consignation au 31 août (coût)',
         [g(BIL, c + '84') for c in ('AC', 'AQ', 'BE')], MONEY),
    ]
    styled = []
    for lab, vals, sty in block:
        e.set(SOM, f'A{r}', lab)
        for c, v in zip('BCD', vals):
            e.set(SOM, f'{c}{r}', round(v, 4))
            styled.append((f'{c}{r}', sty))
        r += 1
    r += 1
    for txt in [
        'Pourquoi ça vaut la peine malgré une marge plus mince : le détaillant prend 40 %, mais',
        'l’acquisition en ligne coûte déjà 22 % du revenu brut en publicité — et elle s’arrête dès',
        'que la trésorerie manque, ce qui est exactement ce qui est arrivé en juin 2026. Le canal',
        'détail vend sans budget publicitaire et sans dépendre du coût par clic. C’est du volume',
        'incrémental, pas du volume déplacé.',
        'Ce qu’il coûte, et qui est dans les prévisions : coût des marchandises à 55 % du revenu',
        'encaissé au lieu de 33 % en ligne, 6 % de transport et préparation de commandes, 7 % de',
        'commission de représentation, 800 $ de présentoir par point de vente ouvert, un chargé de',
        'comptes dès FY2028, et le stock en consignation immobilisé au bilan.',
    ]:
        e.set(SOM, f'A{r}', txt)
        r += 1
    e.set_full_calc()
    e.save(dst)
    return e, styled, head


if __name__ == '__main__':
    e, styled, head = build()
    # les nouvelles cellules prennent les formats montant et pourcentage
    e2 = Editor(F)
    x = e2.parts[e2.sheetpart[SOM]].decode('utf8')
    for coord, sty in styled:
        m = re.search(r'<c r="%s"([^>/]*)' % coord, x)
        if not m:
            continue
        attrs = m.group(1)
        new = (re.sub(r'\ss="\d+"', f' s="{sty}"', attrs)
               if re.search(r'\ss="\d+"', attrs) else attrs + f' s="{sty}"')
        x = x[:m.start(1)] + new + x[m.end(1):]
    e2.parts[e2.sheetpart[SOM]] = x.encode('utf8')
    e2.set_full_calc()
    e2.save(F)
    print(f'{len(e.log)} écritures, en-tête de la table à la rangée {head}')
