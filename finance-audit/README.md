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
| `fix_ab.py` `fix_ac.py` | Budget de FY2026 figé (un exercice fermé ne se rebudgète pas) et section « ce qui s'est passé en juin et juillet 2026 ». |
| `fix_ad.py` → `fix_aj.py` | Canal détail en consignation au Canada, modélisé par ses pilotes, et les deux scénarios : conservateur réaliste et ambitieux. |
| `fix_ak.py` | Bloc 2028-2029 de « Ventes prévisionnelles », répliqué du bloc précédent décalé de quinze colonnes ; blocs périmés et exercice fermé masqués. |
| `fix_al.py` | Scénario ambitieux recalibré (croissance composée ramenée près de ce qui a été démontré), et ses ratios de coûts alignés sur ceux du conservateur. |
| `fix_am.py` | Canal détail reconstruit ville par ville sur les rapports de consignation des Défricheuses et les ventes en ligne par ville. Feuille « Détail par ville » : quarante villes nommées, un point de vente par tranche de 160 000 habitants, registre des 109 points de vente dans leur ordre d'ouverture. L'exercice 2025-2026 portait zéro vente au détail alors qu'il y en avait pour 13 801 $. |
| `fix_an.py` | Taxes à payer : onze des douze mois de 2028-2029 lisaient « Frais courus à payer » à la rangée voisine, ce qui aplatissait le solde et faussait la trésorerie du dernier exercice. Le facteur de croissance, écrit en dur à 1,35 puis 1,4, devient le rapport des ventes nettes d'un exercice à l'autre. |
| `fix_ao.py` | Versement de TPS du 30 novembre, posé explicitement. Le solde de taxes se construit par ses mouvements à partir du réel d'août 2026 : chaque mois accumule sa TPS et sa TVQ, la TVQ du mois précédent se verse, et novembre acquitte la TPS de l'exercice écoulé. Calé sur les vrais montants de 2025-2026 fournis par `tps_reelle.py`. |
| `tps_reelle.py` | Reconstitue à la source la TPS perçue, la TVQ perçue, les CTI et les RTI du 1er septembre 2025 au 30 juillet 2026 : part fédérale des taxes Shopify calculée région par région, plus les `TxnTaxDetail.TaxLine` des factures, des Bill et des Purchase chez QuickBooks. Lecture seule. |
| `data_pdf.py` `build_note_bailleurs.py` | Relève les deux scénarios et produit le mémo explicatif PDF (HTML + SVG posés à la main, rendu par Chromium sans en-tête). |
| `pdftxt.py` | Extrait le texte d'un PDF en passant par les tables ToUnicode de chaque police. Les PDF exportés de Google dessinent leur texte en hexadécimal avec des polices sous-ensemblées : sans la table, on ne lit rien. Sert à dépouiller les annexes et les lettres de soutien. |
| `overflow.py` | Mesure, page par page, la hauteur du contenu contre celle du cadre. Chromium coupe ce qui déborde sans rien dire ; c'est la seule façon de le voir sans ouvrir les quinze pages. |
| `fix_y.py` | Réparation de la mise en page : remet la table `cellXfs` dans l'ordre et donne un format aux cellules créées par la révision. À exécuter après toute série d'écritures. |
| `push_drive.py` | Pousse un fichier vers Drive. Les identifiants sont lus dans l'environnement, jamais passés en ligne de commande. Sait viser un fichier par son identifiant ou un dossier par son nom. |
| `apps_script/pousseur_drive.gs` `DEPOT_DRIVE.md` | Le pousseur généralisé, à installer dans le projet Apps Script : n'importe quel fichier, n'importe quelle destination, le lien de partage conservé. La version déployée ne connaît encore qu'une cible, le chiffrier, et refuse tout ce qui n'est pas un `.xlsx`. |

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
- **La table `cellXfs` de `xl/styles.xml` ne se modifie qu'en fin de liste.** Un `<xf>`
  inséré en tête décale les 678 index existants et chaque cellule du classeur affiche
  alors le format d'une autre : des montants en pourcentage, des dates en numéros de
  série. Aucune valeur n'est fausse, tout devient illisible. C'est arrivé une fois
  (`fix_o.py`), et `fix_y.py` sait le réparer.
- **Une cellule créée doit reprendre le style de sa voisine.** Sans style, elle hérite du
  format par défaut de sa rangée, souvent un pourcentage dans ce classeur.
  `xledit.set()` s'en charge maintenant ; vérifier avec `fix_y.py`.
- **Un inventaire au bilan a besoin de DEUX contreparties** : la rangée 40 du résultat
  (le coût des marchandises capitalise ce qui n'est pas vendu) et une rangée du fonds de
  roulement entre 153 et 164. Il en manque une, la ligne 76 du bilan décolle.
- **Ne pas ajouter un stock à une rangée dont la formule multiplie l'année précédente
  par un facteur de croissance** : il serait remultiplié chaque exercice en plus d'être
  réajouté. La rangée 13 sépare donc le stock propre, qui croît, du stock en
  consignation, qui se calcule à part.
- **« Ventes prévisionnelles » est faite de blocs de quinze colonnes**, un par
  exercice : croissance, quantité annuelle, douze mois, total. Les libellés de produits
  ne sont écrits que dans trois colonnes (A:C, T:V, AM:AO) ; le jeu AM:AO sert à tous
  les blocs à partir de 2026-2027, donc il ne se masque pas.
- **Les douze mois d'une rangée réelle ne partagent pas une formule.** Chaque mois de
  l'exercice 2025-2026 va chercher SA colonne dans « QBO P&L à maj » : recopier la
  formule de septembre sur les onze autres efface onze mois de réel sans rien casser de
  visible. Et dans la même rangée, juillet et août 2026 restent prévisionnels et lisent
  la rangée 5 du résultat plutôt que la rangée 3. Reprendre la formule existante, jamais
  la réécrire.
- **Un script de révision doit être rejouable**, et il faut le vérifier en le lançant
  deux fois de suite : aucune formule ne doit bouger au second passage. Ajouter une
  soustraction à une formule existante l'empile à chaque exécution ; changer la forme
  d'une formule sans réécrire l'ancienne laisse les deux versions se combiner. Poser la
  forme canonique complète, jamais une retouche.
- **`data_pdf.py` écrase `pdf1.xlsx` et `pdf2.xlsx` à chaque exécution.** Ces fichiers
  ne sont pas une sauvegarde : ils sortent du classeur courant. S'en servir comme base
  de restauration fait rejouer un script sur son propre résultat.
- **`add_sheet()` ne met pas `sheetpart` à jour.** Sans `e.sheetpart[nom] = e.order[-1]`,
  plus rien ne peut désigner la feuille qu'on vient de créer.
- **La virgule décimale française ne s'applique jamais à une chaîne entière.** Un
  `.replace('.', ',')` posé sur un élément SVG complet corrompt les coordonnées : les
  libellés atterrissent hors du cadre. Composer le libellé à part.
- **Les taxes à payer sont une seule rangée pour deux régimes.** La TVQ se déclare au
  mois, la TPS à l'année avec un solde dû au 30 novembre. La rangée 35 du bilan porte le
  net des deux, et les exercices prévisionnels recopiaient le profil mensuel réel de
  2025-2026. Le creux de février n'est pas un versement trimestriel, il n'y en a pas :
  c'est la TVQ de décembre, le plus gros mois de ventes, versée le 31 janvier. Mettre le
  profil à l'échelle des ventes est juste pour la TVQ, qui est proportionnelle aux ventes
  du mois. Ça ne l'était pas pour la TPS, réglée en un seul versement au 30 novembre
  sur l'exercice écoulé. `fix_ao.py` remplace la recopie par les mouvements du solde :
  chaque mois accumule sa TPS et sa TVQ, la TVQ du mois précédent se verse, et novembre
  acquitte la TPS de l'exercice écoulé. Attention au décalage d'un
  an, facile à manquer — novembre 2026 acquitte l'exercice clos le 31 août 2026, pas
  celui d'avant, déjà payé en novembre 2025.
- **Les crédits de taxe sur intrants baissent quand la couture part en Tunisie.** Une
  dépense engagée hors du Canada ne donne pas de CTI ni de RTI, alors les taxes nettes
  montent plus vite que les ventes : 13 910 $ pour 2025-2026, 48 510 $ pour 2027-2028.
- **Les taux de taxe se lisent au réel, pas au taux nominal.** La TPS perçue vaut
  5,0011 % des ventes nettes et la TVQ 8,3851 %, au-dessus de ce qu'on attendrait de
  5 % et 9,975 % sur la part canadienne : la taxe porte sur les ventes brutes et sur le
  transport, les ventes nettes sont après escomptes et après transport net. Un modèle
  bâti sur « part canadienne × taux nominal » sous-estime donc la perception. Du côté
  des crédits, la base de RTI (47,17 % des ventes nettes) est plus petite que la base de
  CTI (52,58 %) parce qu'une partie des achats se fait hors du Québec. `tps_reelle.py`
  reconstitue les cinq montants à la source.
- **Le montant de taxe d'une pièce QuickBooks n'est pas dans `TaxLineDetail`.** Il vit
  dans `TxnTaxDetail.TaxLine`, et le taux ne s'y trouve que par sa référence : sans la
  liste des `TaxRate`, impossible de savoir si une ligne est de la TPS, de la TVQ, un
  CTI ou un RTI. Et QuickBooks ne rend jamais plus de 1 000 lignes par requête : sans
  `startposition`, une année chargée se fait tronquer sans le dire.
- **Shopify ne sépare pas le fédéral du provincial.** Les taxes se lisent par région de
  facturation et la part fédérale se calcule région par région : TVH entièrement
  fédérale en Ontario et dans l'Atlantique, TPS seule en Alberta et dans les
  territoires, 5/14,975 au Québec, 5/12 en Colombie-Britannique et au Manitoba, 5/11 en
  Saskatchewan, rien aux États-Unis.
- **Une formule posée sur une feuille référence cette feuille.** `$D$143` écrit dans le
  bilan désigne une cellule vide du bilan, pas `Inputs!$D$143`. Le calcul tombe à zéro
  sans rien signaler : le solde reste simplement plat.
- **Le canal détail et le commerce en ligne ne se lisent pas sur la même base.** La
  rangée 12 du résultat porte ce que Lasclay encaisse du détail ; la rangée 18 est le
  revenu après escomptes, la rangée 26 les ventes nettes. Le transport net et les
  escomptes ne s'appliquent qu'au commerce en ligne, alors seule la base « ventes nettes »
  fait que les deux moteurs s'additionnent au total. Une décomposition posée sur la
  rangée 18 donne des sous-totaux supérieurs au total, ce qu'un prêteur remarque.
- **Les feuilles ont chacune leur géométrie de colonnes.** Les mois de FY2027 sont
  `R:AC` au résultat et au bilan, `AS:BD` au budget de caisse, `BA:BL` dans « Dette à
  long terme ». Ne pas supposer qu'une colonne désigne le même mois d'une feuille à
  l'autre.
