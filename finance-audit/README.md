# finance-audit — révision du chiffrier de prévisions Lasclay

Outillage et scripts de la révision du 30 juillet 2026 du chiffrier
« PREVISIONS LASCLAY version de travail.xlsx » (Drive `1KHvc5QlzyzGtAcGriO7oEg9Il1ySvXqg`),
en vue du dépôt PARI-CNRC et des retours à la BDC, au Prêt d'Honneur QC et à Desjardins.

## Pourquoi ces outils existent

**LibreOffice ne peut pas ouvrir ce classeur.** Il se bloque au chargement, sans
consommer de CPU, quel que soit le délai accordé. Sans recalcul, impossible de savoir
ce que le modèle calcule vraiment : les valeurs en cache du fichier étaient périmées de
plusieurs mois et menaient à des conclusions fausses (la perte FY2026 affichée était
-40 259 $, la vraie -95 985 $).

`tools/` contient donc un moteur de calcul autonome. Il évalue les 47 540 formules du
classeur en 1,2 seconde.

| Fichier | Rôle |
| --- | --- |
| `tools/xlread.py` | Lit valeurs et formules directement dans le XML. Résout les formules partagées `t="shared"`, qu'openpyxl abandonne silencieusement quand la formule maîtresse n'a pas de texte inline — ce classeur en avait 33 351, dont un groupe orphelin. |
| `tools/xlcalc.py` | Évaluateur paresseux avec mémoïsation et détection de cycles. Couvre le vocabulaire du classeur : SUMIF, SUM, IFERROR, IF, AND, OR, MAX, MIN, MONTH, SEARCH, ISNUMBER, SUMPRODUCT, arithmétique. Les cellules vides se comparent à `""` comme dans Excel, ce dont dépendent les fenêtres d'activité des ressources. |
| `tools/xledit.py` | Édition chirurgicale du XML : pose formules, constantes et chaînes sur des cellules existantes ou nouvelles, ajoute des feuilles, développe les formules partagées avant écriture. openpyxl en écriture détruirait les dessins, les images et les commentaires du classeur. |

## Les scripts de révision

À exécuter dans l'ordre alphabétique ; chacun prend le résultat du précédent.

| Script | Ce qu'il corrige |
| --- | --- |
| `fix_a.py` | Intégrité technique : le `#REF!` racine, les liens externes morts, les totaux qui n'englobent pas leurs composantes, les définitions d'EBITDA et d'intérêts, l'amortissement FY2026, la disposition d'équipements. |
| `fix_b.py` | Recalage des 76 produits sur les unités réellement vendues chez Shopify, et refonte de la trajectoire FY2027-FY2029. |
| `fix_c.py` | Structure de coûts calibrée sur l'historique, PARI sorti du scénario de base, lignes « hors aides publiques ». |
| `fix_d.py` | Plan d'embauche phasé, dette BDC amortie, remise en état des étiquettes servant de critère SUMIF. |
| `fix_f.py` | Retrait du capital marchand (Shopify Capital, Merchant Growth) et nouvelle facilité. |
| `fix_j.py` `fix_k.py` `fix_l.py` | Une seule chaîne de trésorerie sur 48 mois, articulation des immobilisations et du fonds de roulement. Le bilan balance à zéro après `fix_l`. |
| `fix_m.py` | Interrupteur de scénario (`Inputs!C70`). |
| `fix_n.py` | Feuilles « Sommaire bailleurs » et « Notes d'audit ». |
| `fix_o.py` | Finitions : plus une seule cellule en erreur, formatage. |
| `fix_p.py` `fix_q.py` `fix_r.py` | Collage du bilan réel de QuickBooks pour les douze mois de FY2026 (appariement sur le numéro de compte), et report des mois réels de février à juin 2026. |
| `fix_s.py` | Hypothèses d'exploitation remontées dans `Inputs` (rangées 100 à 113), et sections « coût d'acquisition », « ratios de crédit » et « liquidité » du sommaire. |
| `fix_t.py` | Avance de l'actionnaire : 80 000 $ le 15 août 2026, remboursables sur 12 mois à 8 %, avec ce que ça fait à la couverture du service de la dette et à la marge demandée. |
| `push_drive.py` | Pousse le résultat vers Drive. Les identifiants sont lus dans l'environnement, jamais passés en ligne de commande. |

## Pièges du classeur, à connaître avant d'y toucher

- **Les libellés sont des clés de rapprochement.** La colonne A du bilan et la colonne B
  du résultat servent de critère aux `SUMIF` qui vont chercher les réels dans QuickBooks.
  Changer un libellé met la ligne à zéro, sans erreur visible. Mettre les commentaires en
  colonne C.
- **Les `SUMIF` sur colonnes entières** (`'QBO P&L à maj'!$A:$A`) rendent tout recalcul
  hors Excel impraticable. Ils sont ramenés aux 400 premières lignes.
- **La ligne 76 du bilan doit rester à zéro.** Si elle bouge, une variation de poste n'a
  pas de contrepartie dans l'état des flux.
- **Une seule chaîne de trésorerie** : `Résultats-Prev` lignes 182 à 193. Le bilan y lit
  son encaisse et sa marge de crédit ; le « Budget de caisse » en est la vue mensuelle.
  Ne pas en recréer une deuxième.
- **Le bilan réel porte dix mois**, septembre 2025 à juin 2026, collés depuis QuickBooks
  (`fix_p.py`). Juillet et août 2026 restent prévisionnels : la colonne juillet de
  QuickBooks est une photo du mois en cours, pas un mois fermé, et sa colonne août n'en
  est qu'un doublon. La chaîne de trésorerie s'ancre donc sur juin 2026.
- **Les feuilles ont chacune leur géométrie de colonnes.** Les mois de FY2027 sont
  `R:AC` au résultat et au bilan, `AS:BD` au budget de caisse, `BA:BL` dans « Dette à
  long terme ». Ne pas supposer qu'une colonne désigne le même mois d'une feuille à
  l'autre.
