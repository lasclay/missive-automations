#!/usr/bin/env python3
"""Phase AY — dire ce que le budget de caisse mesure, et ce qu'il ne mesure pas.

La feuille « Budget de caisse » porte sa propre rangée de contrôle, la 36, qui
compare sa variation mensuelle à celle de l'état des résultats. Elle n'est pas
à zéro : elle oscille entre -50 000 $ et +69 000 $ sur 39 des 48 mois. Ce n'est
pas une erreur de calcul, c'est **deux méthodes** posées côte à côte sans que
rien ne le dise.

Les rangées 12 à 32 sont une vue **directe** : les encaissements de ventes
moins les postes de dépense de l'état des résultats. Elles ne portent ni la
constitution des stocks ni le calendrier des fournisseurs. Les rangées 33 à 35
viennent de la chaîne de trésorerie du résultat, qui est **indirecte** et
complète — et c'est elle, et elle seule, qui produit l'encaisse du bilan, le
tirage de marge et le besoin de financement du dossier.

Un analyste qui bâtit son propre pont de trésorerie trouve l'écart en dix
minutes. Mieux vaut qu'il le trouve écrit.

Ce que cette phase fait : elle nomme les deux méthodes sur la feuille, elle dit
laquelle fait foi, et elle remet à jour deux notes qui parlaient encore de juin
comme du dernier mois réel. Elle ne bouche pas l'écart par un chiffre de
bouclement : un plafond posé sur un contrôle n'est plus un contrôle.

    python3 fix_ay.py
"""
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
C = 'Budget de caisse'


def build(dst=F, src=F):
    bk = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()

    e.set(C, 'A32', 'Variation de trésorerie — méthode directe '
                    '(encaissements moins décaissements ci-dessus)')
    e.set(C, 'A36', 'Écart entre la méthode directe ci-dessus et la chaîne de '
                    'trésorerie du résultat (rangée 184)')
    e.set(C, 'B36', 'Attendu, pas nul')
    e.set(C, 'A37',
          'Les deux méthodes ne mesurent pas la même chose. Les rangées 12 à 32 '
          'partent des postes de l’état des résultats : elles ne portent ni la '
          'constitution des stocks ni le calendrier des fournisseurs. Les '
          'rangées 33 à 35 viennent de la chaîne de trésorerie du résultat '
          '(rangées 153 à 189), qui porte le fonds de roulement au complet. '
          'C’est cette dernière qui fait foi : c’est elle qui produit '
          'l’encaisse du bilan, le tirage de marge de crédit et le besoin de '
          'financement du dossier. L’écart de la rangée 36 mesure la différence '
          'entre les deux méthodes ; il ne signale pas une erreur.')

    # La page sommaire annonçait cette feuille comme celle « qui produit la
    # trésorerie du résultat ». C'est l'inverse : elle en donne une seconde
    # lecture, plus courte.
    e.set('Sommaire', 'B47',
          'Une seconde lecture de la trésorerie, en méthode directe. C’est la '
          'chaîne du résultat (rangées 153 à 189) qui fait foi ; voir la note '
          'de la rangée 37 de cette feuille.')

    e.set(C, 'A38', 'CONTRÔLE — encaisse réelle au 31 juillet 2026 (QuickBooks)')
    e.set(C, 'C38', "='Bilan2026-27-28'!N6")
    e.set(C, 'A40',
          'Bilan réel de QuickBooks : onze mois, septembre 2025 à juillet 2026 '
          '(colonnes AC à AM de « QBOBS à maj »). Seul août 2026 reste '
          'prévisionnel.')

    journal(e)
    e.set_full_calc()
    e.save(dst)

    apres = xlcalc.load(dst)
    return [f'contrôle C38 (encaisse réelle) : {bk.get(C, "C38"):,.2f} → '
            f'{apres.get(C, "C38"):,.2f}',
            f'écart C40 avec l’encaisse modélisée d’août : '
            f'{apres.get(C, "C40"):,.2f} $']


def journal(e):
    e.set('Notes d’audit', 'A76',
          '• Signalé, non corrigé : la feuille « Budget de caisse » porte deux '
          'méthodes côte à côte. Les rangées 12 à 32 sont une vue directe bâtie '
          'sur les postes du résultat, sans les stocks ni le calendrier des '
          'fournisseurs ; les rangées 33 à 35 viennent de la chaîne de '
          'trésorerie du résultat, qui est complète et qui fait foi. La rangée '
          'de contrôle 36 mesure l’écart entre les deux : il va de -50 000 $ à '
          '+69 000 $ sur 39 des 48 mois. Les deux méthodes sont désormais '
          'nommées sur la feuille et la note de la rangée 37 dit laquelle '
          'produit l’encaisse du bilan. Boucher l’écart par un chiffre de '
          'bouclement aurait fait disparaître le contrôle plutôt que le '
          'problème : refaire la vue directe en méthode d’encaissement '
          'complète reste à décider.')


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
