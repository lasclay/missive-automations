#!/usr/bin/env python3
"""Phase BF — le budget de caisse complété, et son contrôle ramené à zéro.

La feuille « Budget de caisse » portait deux vues côte à côte. Les rangées 12 à
32 additionnaient des postes du résultat pour en tirer une variation de
trésorerie ; les rangées 33 à 35 lisaient la chaîne de trésorerie du résultat,
qui est celle qui produit l'encaisse du bilan. La rangée 36 mesurait l'écart
entre les deux : de **-105 340 $ à +67 136 $**, sur 36 des 36 mois projetés.

Le journal disait « attendu, pas nul ». C'était faux. Deux méthodes de flux de
trésorerie qui décrivent la même entreprise doivent donner le même nombre :
c'est l'identité qui les définit. Un écart signifie qu'une des deux est
incomplète, et c'était la vue directe.

## Ce qui manquait, au dollar près

Le résidu se décompose exactement en quatre morceaux, vérifiés mois par mois.

| | septembre 2026 |
| --- | ---: |
| Impôts sur le bénéfice, charge sans décaissement | -4 547 $ |
| Fournisseurs, charges à payer, cartes de crédit, taxes, frais payés d'avance | +38 629 $ |
| Ajustement de calendrier BMB, présent à la caisse et absent du bilan | +18 589 $ |
| **Total** | **+52 671 $** |

Et l'écart de la rangée 36 pour ce mois valait -52 670 $. Rien d'autre ne
manquait : les stocks et les crédits d'impôt à recevoir étaient déjà cohérents,
parce que la vue directe passe par les achats et non par la consommation, et
parce que les crédits n'entrent qu'au moment de leur encaissement.

## Les trois corrections

**Rangée 27, impôts payés.** La rangée existait, vide. Elle porte maintenant la
charge d'impôt moins la variation du passif « Impôts à payer » : ce que
l'entreprise verse réellement, et non ce qu'elle provisionne.

**Rangée 29, fonds de roulement.** Fournisseurs, frais courus, cartes de crédit,
taxes de vente à payer, frais payés d'avance, cartes cadeaux et revenus perçus
d'avance. Cinq de ces sept postes ne figuraient nulle part dans la vue directe,
et les taxes de vente à elles seules pèsent le versement du 30 novembre, qui
passe de 13 910 $ en 2026 à 48 510 $ en 2028.

**Rangée 25, calendrier BMB, retirée des mois projetés.** Elle décalait la
sous-traitance de couture sur un acompte de 40 % et un solde de 60 %. Le
calendrier est peut-être réel, mais le bilan ne porte aucun acompte fournisseur
en contrepartie : la caisse et le bilan modélisaient deux mondes différents. La
rangée reste en place sur les mois réels, où elle décrit du passé.

## Ce que la rangée 36 mesure maintenant

Elle ne compare plus deux estimations indépendantes, parce qu'il n'en existe pas
deux : le classeur ne porte qu'une seule source de données. Elle vérifie que la
présentation directe est **complète**. Le jour où quelqu'un ajoute un poste au
résultat sans le porter à la caisse, elle le dit. C'est moins qu'un contrôle
croisé, et c'est tout ce qu'un modèle à source unique peut offrir honnêtement.

Les colonnes réelles ne sont pas touchées. Le bilan d'août 2026 lit
« Account payable », qui lit lui-même les rangées 18, 26 et 30 du budget de
caisse de ce mois-là : y toucher déplacerait le point d'ancrage de tout le plan.

    python3 fix_bf.py
"""
import sys

sys.path.insert(0, 'tools')
from xledit import Editor
import xlcalc

F = 'PREVISIONS LASCLAY - version audit 2026-07-30.xlsx'
S = 'Résultats-Prev 2025-2029'
BC = 'Budget de caisse'
R = f"'{S}'"

# Le budget de caisse couvre six exercices, le résultat quatre. Seuls les mois
# PROJETÉS sont repris : 2026-2027, 2027-2028, 2028-2029.
MOIS = list(zip(
    # colonnes du budget de caisse
    ['AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD',
     'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ',
     'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA', 'CB', 'CC', 'CD', 'CE'],
    # colonnes du résultat, même mois
    ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC',
     'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ',
     'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE']))

# Les postes du fonds de roulement que la vue directe ignorait. Les stocks
# (153, 154) sont déjà couverts par les achats ; les comptes à recevoir (155)
# par la feuille « Account Recevables » ; les impôts (162) vont à la rangée 27 ;
# les crédits d'impôt à recevoir (164) par les rangées 8 et 9.
FDR = (156, 157, 158, 159, 160, 161, 163)


def build(dst=F, src=F):
    avant = xlcalc.load(src)
    e = Editor(src)
    e.expand_shared()

    for bc, r in MOIS:
        # Impôts réellement versés : la charge moins ce qui reste à payer.
        e.set(BC, f'{bc}27', f'={R}!{r}140-{R}!{r}162')
        # Fonds de roulement : un solde qui monte est un décaissement évité,
        # d'où le signe négatif sur une rangée de décaissements.
        e.set(BC, f'{bc}29',
              '=-(' + '+'.join(f'{R}!{r}{n}' for n in FDR) + ')')
        # L'acompte BMB n'a pas de contrepartie au bilan.
        e.set(BC, f'{bc}25', None)

    etiquettes(e)
    journal(e)
    e.set_full_calc()
    e.save(dst)

    apres = xlcalc.load(dst)
    return rapport(avant, apres)


def etiquettes(e):
    e.set(BC, 'B27', 'Impôts sur le bénéfice versés')
    e.set(BC, 'B29', 'Variation du fonds de roulement : fournisseurs, charges à '
                     'payer, cartes de crédit, taxes de vente, frais payés '
                     'd’avance')
    e.set(BC, 'B36', 'CONTRÔLE — vue directe moins chaîne de trésorerie du '
                     'résultat')
    e.set(BC, 'B37', 'Zéro sur les mois projetés : les deux vues décrivent la '
                     'même entreprise et doivent donner le même nombre. La '
                     'rangée vérifie que la présentation directe est complète, '
                     'et non que deux estimations indépendantes concordent — le '
                     'classeur n’a qu’une source de données. Les mois réels '
                     'gardent leur écart : ils portent l’ajustement de '
                     'calendrier BMB, que le bilan ne reflète pas.')


def journal(e):
    e.set('Notes d’audit', 'A94',
          '• Budget de caisse, contrôle ramené à zéro sur les 36 mois projetés. '
          'La vue directe des rangées 12 à 32 s’écartait de la chaîne de '
          'trésorerie du résultat de -105 340 $ à +67 136 $ selon les mois, et '
          'le journal qualifiait cet écart d’« attendu ». Il ne l’était pas : '
          'deux méthodes de flux de trésorerie qui décrivent la même entreprise '
          'doivent donner le même nombre. Le résidu se décomposait en quatre '
          'morceaux : les impôts versés, cinq postes de fonds de roulement '
          '(fournisseurs, frais courus, cartes de crédit, taxes de vente, frais '
          'payés d’avance), et l’ajustement de calendrier BMB.')
    e.set('Notes d’audit', 'A95',
          '• Ce qui a été fait : la rangée 27 porte les impôts réellement '
          'versés (charge moins variation du passif), la rangée 29 porte les '
          'sept postes de fonds de roulement que la vue directe ignorait, et '
          'l’ajustement BMB de la rangée 25 est retiré des mois projetés — il '
          'décalait la sous-traitance sans qu’aucun acompte fournisseur '
          'n’apparaisse au bilan en contrepartie. Les colonnes réelles ne sont '
          'pas touchées : le bilan d’août 2026 lit « Account payable », qui lit '
          'les rangées 18, 26 et 30 du budget de caisse de ce mois-là.')
    e.set('Notes d’audit', 'A96',
          '• Ce que la rangée 36 mesure désormais : que la présentation directe '
          'est complète, pas que deux estimations indépendantes concordent. Le '
          'classeur n’a qu’une source de données ; il ne peut pas produire deux '
          'lectures vraiment indépendantes. Le jour où un poste est ajouté au '
          'résultat sans être porté à la caisse, la rangée le dit.')


def rapport(avant, apres):
    L = []
    for nom, (a, b) in (('2026-2027', (0, 12)), ('2027-2028', (12, 24)),
                        ('2028-2029', (24, 36))):
        av = [avant.get(BC, f'{bc}36') for bc, _ in MOIS[a:b]]
        ap = [apres.get(BC, f'{bc}36') for bc, _ in MOIS[a:b]]
        L.append(f'{nom}  avant : de {min(av):>10,.0f} à {max(av):>9,.0f}   '
                 f'après : écart maximal {max(abs(x) for x in ap):.4f}')
    tous = [abs(apres.get(BC, f'{bc}36')) for bc, _ in MOIS]
    L.append(f'contrôle du budget de caisse : {sum(1 for x in tous if x < 0.01)}'
             f'/36 mois à zéro')
    from openpyxl.utils import get_column_letter as gl, column_index_from_string as ci
    cols = []
    for a, b in (('D', 'O'), ('R', 'AC'), ('AF', 'AQ'), ('AT', 'BE')):
        cols += [gl(i) for i in range(ci(a), ci(b) + 1)]
    L.append(f'contrôle du bilan (rangée 76) : écart maximal '
             f'{max(abs(apres.get("Bilan2026-27-28", f"{c}76")) for c in cols):.6f}'
             f' sur 48 mois')
    L.append(f'encaisse au 31 août 2029 : {apres.get(S, "BF189"):,.0f} $ '
             f'(inchangée : {avant.get(S, "BF189"):,.0f} $)')
    return L


if __name__ == '__main__':
    for ligne in build():
        print(ligne)
