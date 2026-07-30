#!/usr/bin/env python3
"""Phase N — les deux feuilles que les bailleurs liront en premier :
un sommaire d'une page, et le journal d'audit du modèle."""
import sys
sys.path.insert(0, 'tools')
from xledit import Editor

PNL = 'Résultats-Prev 2025-2029'
BIL = 'Bilan2026-27-28'
COLS = ['P', 'AD', 'AR', 'BF']          # FY26, FY27, FY28, FY29
BCOLS = ['O', 'AC', 'AQ', 'BE']
YEARS = ['FY2026 (réel)', 'FY2027', 'FY2028', 'FY2029']
# scénario prudent, relevé avec Inputs!C70 = 2
PRUDENT = {
    'ventes':   [986383, 1169194, 1287326, 1437981],
    'cmv':      [404641, 387143, 429545, 464242],
    'pai':      [-89310, -50053, -62670, 9341],
    'horsaide': [-163175, -217419, -175470, -113351],
    'ebitda':   [-18239, 61535, 6649, 78563],
    'marge':    [130000, 126167, 312641, 423758],
    'cp':       [-202553, -252606, -315276, -305935],
}


def L(col, row, val):
    return (f'{col}{row}', val)


def build(dst='PREVISIONS LASCLAY - version audit 2026-07-30.xlsx', src='prev_fix_m.xlsx'):
    e = Editor(src)
    e.expand_shared()
    rows = []
    r = 1

    def put(a, b=None, c=None, d=None, ee=None, f=None):
        nonlocal r
        for col, v in zip('ABCDEF', (a, b, c, d, ee, f)):
            if v is not None:
                rows.append((f'{col}{r}', v))
        r += 1

    put('LES PRODUITS LASCLAY INC. — SOMMAIRE POUR LES BAILLEURS')
    put('Prévisions au 30 juillet 2026. Exercice du 1er septembre au 31 août.')
    put('Scénario affiché ci-dessous :', "=IF(Inputs!$C$70=2,\"PRUDENT\",\"BASE\")",
        '← piloté par Inputs!C70 (1 = base, 2 = prudent)')
    r += 1

    put('1. CE QUE DIT LE MODÈLE', 'FY2026 (réel)', 'FY2027', 'FY2028', 'FY2029')
    for lab, row in (('Ventes nettes', 26),
                     ('Coût des marchandises vendues', 33),
                     ('Frais généraux', 44), ('Frais de ventes', 68),
                     ('Marketing', 77), ('Administration', 90),
                     ('Frais financiers', 105)):
        put(lab, *[f"='{PNL}'!{c}{row}" for c in COLS])
    put('Aides publiques comprises dans le résultat', *[f"='{PNL}'!{c}151" for c in COLS])
    put('RÉSULTAT AVANT IMPÔTS', *[f"='{PNL}'!{c}137" for c in COLS])
    put('RÉSULTAT AVANT IMPÔTS — HORS AIDES PUBLIQUES', *[f"='{PNL}'!{c}141" for c in COLS])
    put('EBITDA', *[f"='{PNL}'!{c}145" for c in COLS])
    put('EBITDA hors aides publiques', *[f"='{PNL}'!{c}144" for c in COLS])
    r += 1
    put('Croissance des ventes nettes', '',
        f"='{PNL}'!AD26/'{PNL}'!P26-1", f"='{PNL}'!AR26/'{PNL}'!AD26-1",
        f"='{PNL}'!BF26/'{PNL}'!AR26-1")
    put('Marge sur coût des marchandises', *[f"=1-'{PNL}'!{c}33/'{PNL}'!{c}26" for c in COLS])
    put('Marge EBITDA', *[f"='{PNL}'!{c}145/'{PNL}'!{c}26" for c in COLS])
    put('Publicité numérique en % des ventes nettes',
        *[f"='{PNL}'!{c}78/'{PNL}'!{c}26" for c in COLS])
    put('Masse salariale totale (production incluse)',
        *[f"='{PNL}'!{c}45+'{PNL}'!{c}69+'{PNL}'!{c}81+'{PNL}'!{c}91+'{PNL}'!{c}38"
          for c in COLS])
    r += 1
    put('Capitaux propres au 31 août', *[f"='{BIL}'!{c}70" for c in BCOLS])
    put('Total du passif au 31 août', *[f"='{BIL}'!{c}43+'{BIL}'!{c}60" for c in BCOLS])
    put('Encaisse au 31 août', *[f"='{PNL}'!{c}189" for c in COLS])
    put('Marge de crédit — tirage maximal de l’exercice',
        *[f"='{PNL}'!{c}183" for c in COLS])
    r += 1

    put('2. SCÉNARIO PRUDENT', 'FY2026 (réel)', 'FY2027', 'FY2028', 'FY2029')
    put('Relevé avec Inputs!C70 = 2. L’été reste au niveau de 2026, aucun gain de coût '
        'unitaire ni d’efficacité publicitaire n’est acquis, l’embauche marketing est reportée.')
    for lab, key in (('Ventes nettes', 'ventes'),
                     ('Coût des marchandises vendues', 'cmv'),
                     ('Résultat avant impôts', 'pai'),
                     ('Résultat avant impôts — hors aides', 'horsaide'),
                     ('EBITDA', 'ebitda'),
                     ('Marge de crédit — tirage maximal', 'marge'),
                     ('Capitaux propres au 31 août', 'cp')):
        put(lab, *[float(v) for v in PRUDENT[key]])
    r += 1

    put('3. CE QUE LE FINANCEMENT SERT À FAIRE')
    put('Le problème n’est pas la demande. Novembre, décembre et janvier 2025-2026 ont fait',
        )
    put('+76 %, +133 % et +180 % sur l’année précédente. Le problème est le capital marchand :')
    put('Shopify Capital prélève 28,75 % des ventes quotidiennes et Merchant Growth porte un')
    put('coût fixe. Ces deux facilités représentent 367 479 $ au 31 août 2026 et absorbent la')
    put('trésorerie qui aurait dû acheter le stock de l’été. C’est ce qui a vidé juin et juillet.')
    r += 1
    put('Structure demandée', 'Montant', 'Objet')
    put('Prêt à terme (BDC fonds de roulement + refinancement)', 460000.0,
        'Solder Shopify Capital (202 609 $) et Merchant Growth (164 870 $), financer le stock')
    put('Marge de crédit d’exploitation (saisonnière)',
        f"=MAX('{PNL}'!P183,'{PNL}'!AD183,'{PNL}'!AR183,'{PNL}'!BF183)",
        'Couvrir le creux d’automne : le stock s’achète avant de se vendre')
    put('Avance de l’actionnaire déjà au bilan', 75000.0,
        'Postposée, sans intérêt ni remboursement pendant le terme des prêts')
    put('Argent neuf net (hors refinancement)',
        f"=460000-367479+MAX('{PNL}'!P183,'{PNL}'!AD183,'{PNL}'!AR183,'{PNL}'!BF183)",
        'Le reste remplace de la dette existante, il ne s’y ajoute pas')
    r += 1

    put('4. CE QUE LE MODÈLE NE SUPPOSE PAS')
    put('• Le PARI-CNRC (75 000 $) est hors du scénario de base. La demande est en cours ;')
    put('  présenter au CNRC des prévisions qui présument son propre financement serait circulaire.')
    put('• Aucun dividende ni remboursement à l’actionnaire pendant le terme des prêts.')
    put('• Aucune amélioration du taux de conversion publicitaire n’est supposée en scénario prudent.')
    put('• Les ventes B2B et les produits hors catalogue modélisé (102 469 $ en FY2026) sont')
    put('  inclus mais ne croissent qu’au rythme des accessoires d’hiver.')
    put('• Les coûts unitaires cibles des fiches Tunisie (13-15 % du prix de vente) ne sont PAS')
    put('  l’hypothèse retenue : le modèle retient 33-37 %, calibré sur trois exercices réalisés.')
    r += 1

    put('5. LES CHIFFRES QUI SERVENT DE BASE (réel Shopify, 1er sept. 2025 au 29 juillet 2026)')
    put('Ventes brutes Shopify', 1066806.0, 'Ventes B2B (QuickBooks)', 74475.0)
    put('Revenu brut total QuickBooks FY2026', 1103327.0)
    put('Total modélisé pour le même exercice',
        "='Ventes prévisionnelles '!BC5", 'Écart', "=1103327-'Ventes prévisionnelles '!BC5")
    put('Les quantités annuelles de chacun des 76 produits sont les unités réellement vendues.')

    e.add_sheet('Sommaire bailleurs', rows, after='Résultats-Prev 2025-2029')

    # ------------------------------------------------------------------
    notes = []
    n = 1

    def put2(a, b=None):
        nonlocal n
        notes.append((f'A{n}', a))
        if b is not None:
            notes.append((f'B{n}', b))
        n += 1

    put2('JOURNAL D’AUDIT DU MODÈLE — 30 juillet 2026')
    put2('Ce que la révision a corrigé, et ce qui reste à valider avant de déposer le dossier.')
    n += 1
    put2('A. INTÉGRITÉ TECHNIQUE')
    for t in [
        "Account Recevables N6 contenait le littéral #REF! : c'était la racine des erreurs "
        "du budget de caisse. Réparé, et le bloc FY2025 repointé sur « Résultats2025maj » "
        "(il lisait des colonnes mortes de « Résultats2024 »).",
        "Deux liens externes morts (« xlPathMissing ») retirés : ils faisaient afficher "
        "« mettre à jour les liens ? » à chaque ouverture et bloquaient le recalcul.",
        "33 351 formules partagées développées en formules autonomes. Un groupe (RSDE "
        "matériaux, FY2027) n'avait plus de formule maîtresse : 8 cellules ne calculaient rien.",
        "4 517 SUMIF portaient sur des colonnes entières (A:A) des feuilles de collage QuickBooks. "
        "Ramenés aux 400 premières lignes : même résultat, recalcul possible.",
        "Ligne 181 du résultat : 27 colonnes sur 48 omettaient la ligne 180 (avance de "
        "l'actionnaire) dans le total du financement.",
        "EBITDA : l'ancienne formule rajoutait les impôts à un résultat déjà avant impôts, et "
        "n'ajoutait que quatre des sept lignes d'intérêts. Redéfini.",
        "Le total annuel du budget de caisse sommait la colonne au lieu des douze mois : "
        "quatre exercices perdaient un montant inscrit directement dans un mois "
        "(-30 467 $, -49 974 $, -39 317 $, -107 367 $).",
        "Bilan : l'inventaire de matières lisait mars-août 2025 au lieu de mars-août 2026 ; "
        "l'emprunt Shopify redémarrait à janvier 2027 en mars 2027 ; « Passif à long terme » "
        "excluait la nouvelle dette (125 000 $ d'écart affiché sur la même page).",
        "Dette à long terme : les soldes d'ouverture de septembre 2025 manquaient pour le prêt "
        "BDC FDR et le BDC 18K, ce qui affichait des dettes NÉGATIVES (-18 337 $ et -3 000 $). "
        "Trois rustines codées en dur ont été retirées.",
        "Ventes prévisionnelles : le prix des casquettes prenait celui des boucles d'oreilles ; "
        "trois produits FY2028 prenaient le prix de la crème contour des yeux ; les mitaines "
        "appliquaient la croissance FY2028 à la base FY2026 ; le total FY2026 n'additionnait "
        "que 53 des 76 lignes de revenu ; trois produits n'avaient pas de mois d'août.",
        "Les parts mensuelles de saisonnalité étaient divisées par un total saisi à la main qui "
        "ne valait pas la somme des douze mois : jusqu'à +15 % de revenu fantôme par produit.",
        "Hypothèses saisies à 8 et 3,5 au lieu de 0,08 et 0,035 (escompte et frais Shopify des "
        "exercices 2027-2029) ; bloc de brouillon contenant une cellule à 47,7 M$ supprimé.",
        "Le bilan ne balançait pas : -18 732 $ à août 2026 et -108 402 $ à août 2027. Il balance "
        "maintenant à zéro sur les 48 mois, parce qu'il n'y a plus qu'une seule chaîne de "
        "trésorerie au lieu de deux prévisions parallèles non réconciliées.",
    ]:
        put2('• ' + t)
    n += 1
    put2('B. FOND')
    for t in [
        "Trajectoire de ventes : le modèle prévoyait +59 % en FY2027 et +84 % en FY2028. Les "
        "quantités annuelles des 76 produits ont été remises sur les unités réellement vendues "
        "chez Shopify entre septembre 2025 et juillet 2026, puis crues par catégorie. "
        "Résultat : +28,6 %, +18,4 %, +17,7 %.",
        "Horticole : le modèle portait 340 203 $ en FY2026 et projetait 1 084 353 $ en FY2028. "
        "Le réel Shopify est 108 187 $ (bombes semencières : 1 087 unités, pas 10 000). "
        "L'asclépiade est vivace, le marché sature : croissance ramenée à zéro.",
        "Coût des marchandises : le modèle bâtissait le CMV sur les coûts unitaires cibles des "
        "fiches Tunisie, ce qui donnait 17,4 % de CMV et 82 % de marge en FY2027 — au-dessus du "
        "meilleur exercice jamais réalisé. Ramené à des ratios calibrés sur trois exercices, "
        "avec l'amélioration du virage manufacturier énoncée dans Inputs lignes 56 à 61.",
        "Sous-traitance d'assemblage : elle baissait de 37 % pendant que les ventes montaient. "
        "Elle suit maintenant le volume.",
        "Plan d'embauche : trois postes démarraient le 1er septembre 2026 (+169 % de masse "
        "salariale). Il en reste un en FY2027 (gestion logistique, 1er octobre) et un en FY2028 "
        "(marketing, 1er janvier). Le poste de service client est retiré : la boîte support est "
        "automatisée. Hausses salariales ramenées de 10 % à 3 % par an.",
        "PARI-CNRC : 75 000 $ étaient inscrits en revenu FY2027 alors que la demande n'est pas "
        "déposée. Retiré du scénario de base.",
        "« Économies d'optimisation » (11 200 $ à 17 400 $ par an) étaient comptabilisées en "
        "revenu. Une économie de coût n'est pas un revenu : retirée.",
        "Avance de l'actionnaire : le modèle la remboursait (75 000 $) avec 6 000 $ d'intérêts "
        "pendant l'exercice où l'entreprise demande 460 000 $. Postposée, sans intérêt.",
        "Dividende de 5 % du bénéfice net : retiré pendant le terme des prêts.",
        "Prêt BDC de 125 000 $ : il était remboursé d'un coup en décembre 2027. Remplacé par une "
        "facilité de 460 000 $ amortie sur 60 mois qui solde le capital marchand.",
        "Disposition d'équipements : le résultat portait la valeur nette comptable complète "
        "(39 670 $) en perte. La perte réelle est 4 491 $ (VNC 39 670 − produit 33 979 − gain de "
        "1 200 $ sur les rackings) et l'encaissement de 35 179 $ figure aux investissements.",
        "Amortissement : QuickBooks n'en avait passé aucun de l'exercice. La régularisation "
        "d'août reprend le registre d'immobilisations, et le bilan suit désormais exactement "
        "l'amortissement du résultat.",
        "RSDE FY2026 : la cellule forçait le total à 99 000 $ (formule = -99000-SUM(...)). "
        "Remplacée par la même méthode que FY2027, tirée des salaires admissibles.",
        "Une ligne « hors aides publiques » a été ajoutée au résultat (lignes 141 et 144) : "
        "l'analyste la calculera de toute façon, autant la lui donner.",
    ]:
        put2('• ' + t)
    n += 1
    put2('C. CE QUI RESTE À VALIDER AVANT DE DÉPOSER')
    for t in [
        "Le bilan réel de QuickBooks s'arrête à février 2026 alors que le résultat réel va "
        "jusqu'à juin 2026. Coller quatre mois de bilan de plus dans « QBOBS à maj » "
        "(colonnes AI et suivantes) avant de déposer : la prévision de trésorerie s'ancre sur "
        "le dernier mois de bilan réel.",
        "Solde bancaire : le modèle donne 38 515 $ au 31 août 2026 ; le solde mesuré au "
        "31 juillet était 28 472 $ et QuickBooks affiche 30 551 $ au compte chèques plus "
        "6 346 $ PayPal. Reconcilier avec AccèsD (Budget de caisse, lignes 38 à 40).",
        "Vente d'équipements : les dépôts sont encore dans la file « À réviser » de QuickBooks. "
        "Faire trancher par le comptable la question des taxes (si le prix de 33 979 $ est "
        "réputé les inclure, environ 4 426 $ sont à remettre) et faire passer les écritures.",
        "Avance de l'actionnaire : 75 000 $ figurent au bilan d'août 2026 ; QuickBooks n'en "
        "enregistre que 10 000 $ (deux avances de 5 000 $ les 20 et 28 juillet). Documenter le "
        "reste, et préparer la convention de postposition que la BDC exigera.",
        "Pertes fiscales reportables : 151 649 $ (Inputs C43) reste un estimé du comptable, à "
        "confirmer. Le calcul d'impôt s'en sert pour la régularisation de fin d'exercice.",
        "Publicité numérique : 22 % du revenu brut en FY2027. Un analyste demandera le coût "
        "d'acquisition et la valeur à vie d'un client. Les avoir sous la main.",
        "Trois produits vendus en FY2026 ne sont pas dans le modèle (chandail polaire, gants "
        "magiques, mitaines en cuir de mouton, environ 21 000 $). Ils sont dans la ligne "
        "« produits hors catalogue modélisé ». À modéliser s'ils deviennent significatifs.",
        "Le prêt Accord D, les prêts privés et le BDC 11K sont projetés à partir de leurs "
        "échéanciers ; vérifier les soldes réels au 31 août 2026 avant dépôt.",
    ]:
        put2('• ' + t)
    n += 1
    put2('D. COMMENT LE CLASSEUR EST BÂTI MAINTENANT')
    for t in [
        "Une seule chaîne de trésorerie : « Résultats-Prev » lignes 182 à 193. Le bilan y lit "
        "son encaisse et sa marge de crédit, et le « Budget de caisse » en est la vue mensuelle.",
        "La ligne 76 du bilan (« Total de contrôle ») doit rester à zéro. Si elle bouge, une "
        "variation de poste n'a pas de contrepartie dans l'état des flux.",
        "Inputs!C70 bascule tout le classeur entre le scénario de base et le scénario prudent. "
        "Les hypothèses qui basculent sont listées dans Inputs à partir de la ligne 74.",
        "Les libellés de la colonne A du bilan et de la colonne B du résultat servent de critère "
        "de rapprochement avec QuickBooks (SUMIF). Les modifier casse silencieusement la valeur "
        "réelle de la ligne. Mettre les commentaires en colonne C.",
    ]:
        put2('• ' + t)

    e.add_sheet('Notes d’audit', notes, after='Sommaire bailleurs')
    e.set_full_calc()
    e.save(dst)
    return e


if __name__ == '__main__':
    e = build()
    print(f"{len(e.log)} écritures")
