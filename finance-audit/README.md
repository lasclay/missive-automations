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
| `fix_ap.py` | Finitions de livraison : les 54 étiquettes « FY20xx » passent au gabarit « 2026-2027 » ; les descriptions de scénario d'`Inputs` A71 et A72, qui annonçaient des déploiements périmés, sont régénérées depuis les rangées qu'elles décrivent ; les rangées ajoutées reçoivent un format ; la limite de la marge de crédit et le contrôle du tirage sont posés à la rangée 163 d'`Inputs` ; le journal d'audit est mis à jour. |
| `fix_aq.py` | Recolle le réel de QuickBooks dans « QBO P&L à maj » et « QBOBS à maj » après une séance de tenue de livres, en appariant par libellé. `--essai` montre ce qui bougerait sans rien écrire. |
| `fix_ar.py` | Met le journal d'audit au diapason du recollage. |
| `fix_as.py` | Fait passer juillet 2026 du prévisionnel au réel. Un mois réel ne se distingue pas d'un mois prévisionnel par une étiquette mais par la **forme de ses formules** : la colonne de juillet reçoit celle de juin, transposée, au résultat comme au bilan. |
| `fix_at.py` | La page « Sommaire », posée en première feuille et faite uniquement de formules, plus la remise à jour des entrées périmées du journal. |
| `fix_au.py` | Le premier mois projeté ouvre désormais sur les soldes réels du dernier mois comptabilisé, échéanciers de dette et fonds de roulement compris. |
| `fix_av.py` | Le contrôle du tirage de marge de crédit balaie aussi le premier mois projeté, qui est justement celui du sommet. |
| `fix_aw.py` | Corrige au journal une affirmation que la phase suivante avait rendue fausse, et pose le constat de clôture. |
| `fix_ax.py` | L'avance de 80 000 $ du 15 août 2026 **s'ajoute** aux 3 678 $ déjà inscrits chez QuickBooks au lieu de les remplacer. L'échéancier s'arrête sur le solde préexistant, qui reste au bilan sur tout l'horizon. |
| `fix_bb.py` | Le résultat ne lisait du moteur de ventes que son **total annuel**, qu'il redistribuait avec douze coefficients codés en dur — le profil de 2025-2026, avec son été arrêté et sa prévente unique de mai. Chaque mois projeté lit maintenant son propre mois. Les rangées 3, 9, 10 et 11, vides sur 36 mois, sont ventilées. |
| `fix_ba.py` | Consigne au journal pourquoi juin et juillet 2026 sont à presque zéro : l'été a été arrêté, pas subi. La main-d'œuvre de production tombe de 88 % pendant que les achats de matières montent de 48 %. |
| `fix_az.py` | La marge autorisée passe de 130 000 $ à 150 000 $ : le compte du grand livre s'appelle « EDC LC1 - 150K » et le mémo calculait déjà son coussin sur 150 000 $. Le contrôle annonçait un dépassement d'une limite qui n'était pas la bonne. |
| `fix_ay.py` | Nomme les deux méthodes du budget de caisse et dit laquelle fait foi. La rangée de contrôle 36 n'est pas à zéro : elle mesure l'écart entre une vue directe bâtie sur le résultat et la chaîne de trésorerie complète. |
| `recache.py` | Rafraîchit les valeurs en cache de tout le classeur. **À lancer en dernier**, après toute écriture. |
| `data_pdf.py` `build_note_bailleurs.py` | Relève les deux scénarios et produit le mémo explicatif PDF (HTML + SVG posés à la main, rendu par Chromium sans en-tête). |
| `traduire.py` `glossaire_en.py` | Dérive le mémo anglais du mémo français. Les deux sortent du même `pdf_data.json`, donc un chiffre ne peut pas diverger d'une langue à l'autre ; seul le texte change. `--manquants` liste les segments non traduits et le script refuse d'écrire tant qu'il en reste. Les nombres passent au format anglais mécaniquement. |
| `traduire_xlsx.py` `glossaire_x_*.py` | Dérive la copie anglaise du chiffrier : chaînes partagées, chaînes en ligne des feuilles visibles, noms d'onglets, texte écrit **à l'intérieur** des formules, et les deux formats monétaires à la française. Ne touche ni à la logique des formules ni aux valeurs, et vérifie ensuite que les deux fichiers calculent à l'identique. Aucune chaîne manquante. |
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
- **Le classeur porte deux vérités : la formule et sa dernière valeur calculée.**
  Excel recalcule à l'ouverture, le classeur pose `fullCalcOnLoad`. Tout le reste
  affiche le cache tel quel : l'aperçu de Google Drive, un import Sheets, une
  conversion en PDF, un tableur mobile. Après la révision, 29 991 cellules
  montraient un nombre périmé et 1 439 un `#REF!` réparé depuis — un chiffrier
  cassé à l'aperçu, juste au téléchargement. `recache.py` réécrit le cache et se
  lance **en dernier**, après toute écriture.
- **L'évaluateur se valide sur les archives.** Les feuilles que la révision n'a
  pas touchées portent encore le cache d'Excel : c'est la bonne réponse, et
  `xlcalc` la reproduit sur 5 079 cellules sur 5 079. C'est ce contrôle qui rend
  `recache.py` défendable. La seule archive qui diverge, « Résultats2024 », lit
  deux feuilles que la révision a changées.
- **`TEXT()` n'existe pas dans l'évaluateur.** Une étiquette construite par
  formule, si élégante soit-elle, sort `#NOM?` de l'outil qui sert à vérifier le
  classeur. Régénérer le texte depuis Python et pointer le lecteur vers les
  rangées sources.
- **Les feuilles de collage ne se rafraîchissent pas toutes seules.** « QBO P&L à maj »
  et « QBOBS à maj » sont des constantes : après une séance de tenue de livres, il faut
  relancer `node qbo_import.js` puis `fix_aq.py`. Le recollage se fait **par libellé**,
  jamais par position : QuickBooks omet les comptes sans activité, alors une ligne qui
  disparaît décale tout ce qui suit — c'est ce qui a laissé un sous-total de 91 854 $ sur
  la rangée « 4050 Etsy Canada », sans dommage parce qu'elle n'a pas de clé de mappage.
- **« Bénéfices non répartis » et « Bénéfice de l'année » n'ont pas de numéro de compte.**
  Apparier sur le numéro seul les saute, et ce sont exactement les rangées qui portent la
  contrepartie de toute correction au résultat : le bilan sort alors de l'équilibre du
  montant exact de la correction, sur tous les mois suivants. La clé est le numéro quand
  il y en a un, le libellé complet sinon.
- **Un compte que QuickBooks ne renvoie plus doit être remis à zéro.** Le laisser à sa
  valeur d'hier fait compter deux fois une dépense qu'une reclassification a déplacée.
- **Une colonne entière n'a pas de numéro de rangée, donc `xlread.translate` ne la
  décale pas.** Transposer une formule d'un mois au suivant laisse
  `'QBO P&L à maj'!AJ:AJ` intact : la colonne de juillet se met à lire celle de juin et
  recopie le mois précédent au dollar près, sans qu'aucune formule n'ait l'air fausse. Les
  plages de colonnes se décalent à part, avant la transposition.
- **La frontière entre le réel et le projeté est un endroit dangereux.** Le premier mois
  projeté doit ouvrir sur les soldes du dernier mois réel. Quand il ouvre sur ses propres
  ancrages — un échéancier saisi à la main, l'inventaire de l'an dernier majoré de 10 % —
  le modèle lit l'écart comme un **mouvement de trésorerie**. En août 2026 : 56 596 $
  d'emprunts que personne n'a avancés et 67 780 $ de stock qui n'a pas bougé, soit
  110 000 $ de moins au tirage de marge de crédit affiché. Le niveau vient du réel, la
  variation vient du modèle.
- **Un contrôle qui balaie « les mois projetés » doit suivre la frontière.** Le contrôle du
  tirage partait de septembre 2026, ce qui était juste tant que 2025-2026 était réel de bout
  en bout. Août 2026 devenu le premier mois projeté, le contrôle sautait précisément le mois
  du sommet et affichait zéro dépassement.
- **Une rangée de contrôle qui n'est pas à zéro ne se bouche pas, elle s'explique.** Le
  budget de caisse porte une vue directe (rangées 12 à 32) et la chaîne de trésorerie du
  résultat (33 à 35). Elles divergent de -50 000 $ à +69 000 $ sur 39 des 48 mois parce
  qu'elles ne mesurent pas la même chose : la première ne porte ni les stocks ni le
  calendrier des fournisseurs. Poser un chiffre de bouclement ferait disparaître le
  contrôle plutôt que l'écart.
- **Chromium coupe ce qui déborde d'une page sans rien dire.** La page 17 du mémo a perdu
  son bloc « Sources » pendant deux versions. `overflow.py` compare, page par page, le bas
  du contenu au cadre ; il faut le lancer après **chaque** ajout de texte, et lire le
  rendu PNG, parce que du contenu peut rester dans le cadre tout en recouvrant le pied de
  page.
- **L'espace qui précède « $ » ou « % » doit être insécable.** Sinon le symbole part seul à
  la ligne suivante, et un tableau de financement affiche « 298 156 » d'un côté, « $ » de
  l'autre.
- **Un total annuel redistribué par des coefficients fige l'année qui les a produits.** Le
  résultat jetait la saisonnalité mensuelle du moteur de ventes et la remplaçait par douze
  parts codées en dur, tirées de 2025-2026. Elles reportaient jusqu'en 2029 un été
  volontairement arrêté (2,0 % de l'année) et une prévente unique de 82 692 $ (mai à
  9,65 %). Le total annuel était juste ; le mois où l'argent rentre ne l'était pas — et
  c'est lui qui commande le stock à financer et le tirage de marge.
- **Le texte écrit dans une formule échappe à la traduction.** Les deux branches d'un
  `IF` qui affiche le scénario actif ne sont ni dans `sharedStrings` ni dans un `<is>` :
  elles vivent dans la formule. La copie anglaise les gardait en français.
- **Le séparateur de milliers se pose sur le nombre, pas sur la phrase.** Un
  `.replace(',', ' ')` appliqué au texte complet mange les virgules de la prose. Même
  piège que la virgule décimale dans les coordonnées SVG.
- **La version anglaise se dérive, elle ne se tient pas en parallèle.** Deux documents
  entretenus à la main divergent au premier dépôt. Le mémo et le chiffrier anglais
  sortent des mêmes données que les français, et les outils refusent d'écrire tant qu'il
  reste du texte non traduit : c'est ce refus qui empêche l'anglais de prendre du retard.
- **Traduire un classeur, c'est traduire deux tables de texte.** Excel range les chaînes
  soit dans `sharedStrings.xml`, soit « en ligne » dans la feuille. Tout ce que les phases
  d'audit ont écrit est en ligne, parce que `xledit` écrit ainsi : ne traduire que la table
  partagée laisse le journal d'audit et les libellés ajoutés en français.
- **409 cellules servent de critère à un SUMIF.** Traduire un côté sans l'autre casse tous
  les rapprochements QuickBooks. Traduire la table de chaînes les traduit tous les deux du
  même coup, donc le rapprochement tient par construction. La copie anglaise reste une
  **sortie** : un nouveau collage QuickBooks se fait sur le fichier français, jamais sur
  l'anglais.
- **Le séparateur de milliers du chiffrier est une espace fine insécable (U+202F).** Une
  classe de caractères qui ne connaît que l'espace ordinaire laisse « 4 500 $ » sortir en
  « 4 $500 ».
- **Une décimale française a une ou deux décimales, un groupe de milliers anglais en a
  trois.** C'est ce qui permet de convertir « 44,3 » sans abîmer « 10,000 » déjà écrit en
  anglais — et il faut convertir la décimale AVANT les milliers, sinon « 160 000 » devient
  « 160,000 » puis « 160.000 ».
- **Renommer un onglet, c'est réécrire toutes les formules qui le citent.** Le nom vit
  dans `workbook.xml` ET dans chaque référence. Trois pièges s'y cachent. Le nom
  « QBO P&L à maj » porte une esperluette, écrite `&amp;` dans le XML : chercher le nom
  non échappé ne le trouve pas, la référence reste française et le `SUMIF` pointe dans le
  vide — la rangée tombe à zéro sans que rien ne le signale. « Immos » n'avait pas
  d'espace et se citait sans apostrophes ; « Capital assets » en a une, alors la
  référence doit en gagner, sinon Excel lit « Capital » comme un nom défini et rend
  #NOM?. Et le comparateur qui vérifie l'égalité des deux fichiers doit lui aussi passer
  les noms par la table, sans quoi il annonce quarante mille écarts qui n'existent pas.
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
