# Reprise de session — Finances Lasclay, 30 juillet 2026

Document de transfert. Une session neuve peut repartir d'ici sans rien perdre.

## Bootstrap : à faire en premier

1. Charger le skill **`finances-lasclay`** (modèle de prévisions, QBO, méthodologie).
   Charger **`bookkeeping-lasclay`** si la tâche touche Dext, la catégorisation ou une
   écriture dans les livres. **`lasclay-master`** pour le contexte de marque.
2. Tirer la version Drive courante du chiffrier **avant** toute modification
   (ID `1KHvc5QlzyzGtAcGriO7oEg9Il1ySvXqg`, titre « PREVISIONS LASCLAY version de travail.xlsx »).
   Via `mcp__Google_Drive__download_file_content`, puis décoder le base64 depuis le fichier
   de résultat d'outil (le contenu dépasse la limite de tokens, il est écrit sur disque).
3. Exercice fiscal : **1er septembre au 31 août**. FY2026 = sept. 2025 à août 2026.

## Ce qui a été fait dans la session précédente

### 1. Vente d'équipements — état complet

Le comptable a rempli le chiffrier « Vente équipements Lasclay — à compléter »
(Drive `1uevBnXcPGIAl9JYcxdzvAiNlnQOTFpA0`) : 9 lots, coût d'origine 68 899,95 $,
**produit de vente 33 979 $**.

| Lot | Coût | Prix de vente |
|---|---:|---:|
| Équipement hérité à la fondation (part vendue) | 32 000,00 | 13 599 |
| Excelle, machine à coudre | 3 378,14 | 1 500 |
| Excelle, machine matelassage | 10 599,00 | 6 500 |
| Excelle, machine (déc. 2023) | 10 999,00 | 4 280 |
| Grace / Sewrite, pièces matelassage | 2 597,00 | 1 500 |
| Presse grande 100×120 | 3 311,37 | 2 000 |
| Presses petites 40×60 ×2 | 1 615,44 | 800 |
| Petite machine laser (Raton Graveur) | 3 400,00 | 2 600 |
| Rackings métal (ajouté par le comptable) | 1 000,00 | 1 200 |
| **Total** | **68 899,95** | **33 979** |

**État dans QBO : rien n'est passé.** Compte 1630 Équipements encore à 135 850,85 $,
compte 1730 Amort. cumulé encore à -38 979,26 $. Aucune transaction ne correspond au
33 979 $ ni à ses composantes.

**Pourquoi** : Gabriel a fait les ventes, les montants sont entrés au compte, mais rien
n'a été catégorisé. Les dépôts sont dans la file « À réviser » de QBO, **que l'API
n'expose pas** (confirmé par le skill bookkeeping et par requête directe : les comptes
suspens « Actif non catégorisé », « Revenu non catégorisé », « Dépense non catégorisée »
sont tous à zéro).

**État dans le modèle** : Gabriel a inscrit lui-même la disposition dans Immos
(F10 = 67 899,95 coût sorti, K10 = 28 229,93 amort. cumulé sorti), et déplacé la
disposition de FY27 vers FY26, ce qui est le bon exercice. Les rackings (1 000 $) sont
exclus du 67 899,95, ce qui est cohérent : ils ne sont pas au compte 1630, donc le
1 200 $ reçu est un **gain pur** non modélisé.

**La perte réelle est 5 691,02 $** (VNC 39 670,02 moins produit 33 979), pas 39 670,02 $.
Mais la ligne P&L O119 porte la VNC complète, ce qui donne **par coïncidence le bon
résultat en agrégat**, parce que 5 691,02 + 33 979 (l'argent dépensé) = 39 670,02.
Ça ne tient que si le 33 979 $ a servi à des **dépenses d'exploitation**. S'il a
remboursé de la dette, la perte est surévaluée de 33 979 $ et la dette sous-évaluée.

**Décision prise** : ne rien ajouter aux lignes de caisse. L'argent est entré et
ressorti, net zéro. Une première tentative d'ajouter +33 979 $ en août 2026 a été
**annulée** parce qu'elle créait de l'argent fantôme : le budget de caisse est ancré sur
un solde bancaire mesuré (28 472 $ codé en dur dans `Budget de caisse AR33`), et un solde
mesuré nette déjà tout ce qui est arrivé avant lui.

**Livré sur Drive le 30 juillet à 02:29** : étiquette de la ligne O119 corrigée pour
expliciter la composition, et `fullCalcOnLoad="1"` activé dans `xl/workbook.xml`.
Aucun chiffre de fond modifié.

### 2. Ce qu'il reste à obtenir de Gabriel sur la vente

1. **La liste des dépôts dans « À réviser »** (dates et montants). Le total tranche la
   question fiscale : ~39 067,36 $ = taxes perçues (TPS 1 698,95 + TVQ 3 389,41) ;
   ~33 979 $ = taxes non perçues, et sur une vente taxable Revenu Québec considère
   généralement que le prix les incluait, donc ~4 426 $ à remettre quand même.
   **Question pour le comptable, ne pas trancher.**
2. **Le solde réel du compte chèques dans AccèsD.** Si proche de 30 551 $ (le solde QBO),
   les deux jambes sont non enregistrées et se neutralisent, rien à ajouter à la caisse.
   Si plus haut, une partie du 33 979 $ est encore là et il y a un ajustement à faire.
3. **Où est allé l'argent** (dépenses d'exploitation présumé).

### 3. Audit des prévisions pour les bailleurs — le gros morceau

Demandé en vue du **PARI-CNRC**, et des retours à faire à **BDC, Prêt d'Honneur QC,
Desjardins**. Regard de prêteur, avec le double écueil : trop noir = refus, trop rose =
« pas besoin d'argent » ou perte de crédibilité.

#### Le constat central : les ventes se sont effondrées et le modèle l'ignore

Revenus e-commerce réels QBO, FY26 contre FY25 :

| Mois | FY25 | FY26 | Écart |
|---|---:|---:|---:|
| Nov. | 108 080 | 190 708 | **+76 %** |
| Déc. | 115 790 | 270 061 | **+133 %** |
| Janv. | 46 248 | 129 272 | **+180 %** |
| Févr. | 70 325 | 99 072 | +41 % |
| Mars | 58 247 | 50 614 | -13 % |
| Avr. | 80 794 | 26 567 | **-67 %** |
| Mai | 87 116 | 86 355 | -1 % |
| Juin | 60 563 | 10 300 | **-83 %** |
| Juill. (29 j) | 40 094 | 1 556 | **-96 %** |

Totaux e-commerce : FY24 483 582 $, FY25 827 883 $, FY26 1 012 964 $ au 29 juillet.
Part juin-août : 19,8 % (FY24), 15,6 % (FY25), en voie de **~2 %** (FY26).

Le modèle prévoit pourtant **+59 % en FY27 et +84 % en FY28**. C'est le point qui tue
le dossier.

**L'angle recommandé** : l'hiver prouve la demande (+133 %, +180 %). L'effondrement de
l'été est une contrainte de liquidités et d'approvisionnement (marge EDC tirée à
143 026 $ sur 150 000 $, Shopify Capital qui prélève 25 % des ventes quotidiennes,
production interne fermée, Tunisie pas en régime). C'est exactement le problème qu'un
financement règle. Beaucoup plus fort qu'un bâton de hockey.

#### Erreurs qui coûteraient la crédibilité

| # | Problème | Détail |
|---|---|---|
| 1 | Le bilan ne balance pas | Ligne « Total de contrôle » `Bilan2026-27-28` r76 : -18 732 $ (août 2026), -108 402 $ (août 2027) |
| 2 | Dettes négatives | Prêt BDC FDR -18 337 $, BDC 18K -3 000 $ |
| 3 | 1 544 cellules en erreur | #REF! et #DIV/0!. Tout le bloc FY2025 de la variation de trésorerie du budget de caisse |
| 4 | La racine | `Account Recevables N6` contient un #REF! qui empoisonne 120 cellules du budget de caisse |
| 5 | Perte FY26 fausse | Affiche -40 259 $, vrai -79 928,73 $. L'écart est exactement la disposition de 39 670,02 $, non recalculée |
| 6 | Amortissement sous-évalué | Rangées 55 (amélio locatives), 99 (matériel info), 49 (camion) ne comptent qu'un ou deux mois au lieu de douze : ~5 877 $ manquants. Seule la rangée 54 (équipements) a été passée à l'année complète |
| 7 | 82 valeurs codées en dur | Dans le bloc FY27 de `Résultats-Prev` |
| 8 | RSDE FY26 est un plug | Formule `=-99000-SUM(D128:N128)`, c'est-à-dire « force le total à 99 000 » |
| 9 | Capitaux propres négatifs | -153 501 $ au 31 août 2026, et -193 171 $ après correction de la perte |

#### Structure de coûts incohérente

| | FY26 | FY27 | FY28 | FY29 |
|---|---:|---:|---:|---:|
| Ventes nettes | 986 383 | 1 566 437 | 2 883 353 | 4 174 374 |
| Croissance | +12 % | **+59 %** | **+84 %** | +45 % |
| CMV en % des ventes | 41,0 % | **17,4 %** | 23,0 % | 26,5 % |
| Marge brute | 34,9 % | 66,0 % | 66,1 % | 65,6 % |
| EBITDA | -1,4 % | 24,2 % | 24,9 % | 30,3 % |

- **La sous-traitance d'assemblage baisse de 37 %** (189 745 → 119 933) pendant que les
  ventes montent de 59 %. Impossible : ce coût doit suivre le volume.
- **Le ratio de CMV fait des montagnes russes** (41 → 17,4 → 23 → 26,5 %). Un ratio de
  coût baisse avec l'échelle, il ne remonte pas.
- Le virage manufacturier justifie une vraie amélioration (MOD interne 91 036 → 4 500 $),
  mais 17,4 % de CMV n'est pas crédible pour des produits physiques.

#### Dépendance aux aides publiques

| | FY26 | FY27 | FY28 |
|---|---:|---:|---:|
| Profit avant impôts affiché | -40 259 | 322 269 | 674 969 |
| dont subventions et crédits | 99 378 | **253 565** | 113 700 |
| **Hors aides** | **-139 636** | **68 704** | 561 269 |

En FY27, **79 % du profit vient d'aides**. Hors aides, la marge est de 4,4 %, pas 20,6 %.
Et **le PARI de 75 000 $ que Gabriel s'apprête à demander est déjà inscrit comme revenu
FY27**, avec La Ruche 50 000 $ et Ville de Québec 35 000 $. Présenter au CNRC des
prévisions qui présument son propre financement est circulaire.

#### Budget de caisse

La trajectoire FY27 tient grâce à deux injections : **125 000 $ de nouvelle dette BDC**
en septembre 2026 et **75 000 $ d'avance de Gabriel** (déjà au bilan d'août 2026, alors
que QBO ne montre que 5 000 $ d'avances réellement enregistrées). Même avec les deux,
la trésorerie finit à **-7 232 $ en août 2027**.

Trésorerie cumulative FY27 par mois : 130 301, 124 465, 191 981, 277 877, 391 108,
423 823, 322 999, 278 672, 281 733, 191 466, 98 740, **-7 232**.

#### Embauches

| | FY26 | FY27 | Écart |
|---|---:|---:|---:|
| Masse salariale | 135 691 | **365 259** | **+169 %** |
| dont Administration | 27 090 | 100 315 | +270 % |
| en % des ventes | 13,8 % | 23,3 % | |

Deux ressources ajoutées (marketing au 1er sept. 2026, expédition au 1er oct. 2026),
dans l'exercice qui suit un été à zéro. La rémunération admin qui passe de 27 k$ à 100 k$
dans l'année d'une demande d'aide publique sera mal lue, même si c'est une normalisation
légitime. À lier à des jalons de revenus si les embauches sont essentielles.

#### Publicité

27 à 29 % des ventes en publicité numérique (269 178 $ FY26, 450 436 $ prévus FY27).
Très élevé. Un analyste demandera le coût d'acquisition et la valeur à vie client.

#### Recommandations formulées

Techniques, avant de montrer le dossier :
1. Corriger le #REF! d'`Account Recevables N6` (une cellule, 120 erreurs réglées).
2. Régler l'écart de balancement du bilan et les deux dettes négatives.
3. Laisser recalculer et reprendre la perte FY26 à -79 929 $.
4. Reconnecter la sous-traitance d'assemblage au volume.

De fond :
5. Refaire la trajectoire : FY27 à +25-35 % plutôt que +59 %, FY28 à ~+30 % plutôt
   que +84 %. Une croissance qui décélère proprement est plus crédible.
6. Présenter la rentabilité hors subventions dans une ligne distincte, de soi-même.
7. Sortir le PARI des prévisions, ou en faire un scénario clairement identifié.
8. Ajouter un scénario prudent. Un dossier à scénario unique optimiste se fait décoter
   d'office par l'analyste.
9. Raconter l'histoire de l'été comme argument, pas comme faiblesse.

**Gabriel n'a pas encore tranché par où commencer.** Les quatre corrections techniques
peuvent se faire rapidement. La refonte de la trajectoire exige son jugement d'affaires.

## Pièges techniques à connaître

- **LibreOffice ne peut pas recalculer ce chiffrier.** Deux échecs : 899 s puis 3 298 s
  (55 minutes) avec `/root/.claude/skills/xlsx/scripts/recalc.py`. Contournement retenu :
  poser `fullCalcOnLoad="1"` dans `<calcPr>` de `xl/workbook.xml`, ce qui force Excel et
  Google Sheets à tout recalculer à l'ouverture. **Conséquence : beaucoup de valeurs en
  cache du fichier sont périmées.** Ne jamais conclure à partir d'une valeur en cache sans
  la recouper avec la formule.
- **Éditer par chirurgie XML**, pas openpyxl en écriture (openpyxl casse les dessins).
  Lire avec openpyxl, écrire en réécrivant le zip et en remplaçant les chaînes XML.
- **Pousser sur Drive** : POST du xlsx en base64 vers `LASCLAY_DRIVE_PUSH_URL`
  avec `?file=controle&token=<LASCLAY_DRIVE_PUSH_TOKEN>`, `Content-Type: text/plain`.
  Le pousseur refuse tout ce qui fait moins de 100 Ko ou ne commence pas par « PK ».
  **Il n'y a pas de mode « pull »** : `doGet` n'existe pas dans l'Apps Script. Pour tirer,
  passer par le connecteur Google Drive.
- **Le sandbox ne joint pas Google directement** : `drive.google.com`, `docs.google.com`,
  `googleapis.com`, `drive.usercontent.google.com` renvoient tous 403 au CONNECT du proxy.
  Seul `script.googleusercontent.com` passe. Utiliser les outils MCP Google Drive.
- **QBO** : proxy `FINANCE_PROXY_URL` + en-tête `X-Proxy-Secret: FINANCE_PROXY_SECRET`.
  Routes `POST /query` (SQL v3), `POST /report`, `POST /download`. La file « À réviser »
  du flux bancaire **n'est pas exposée par l'API**.
- **Ne jamais écrire dans QBO sans accord explicite et préalable de Gabriel.**

## Chiffres de référence au 30 juillet 2026

- Compte chèques CAD 30 551,26 $ ; PayPal 6 346,47 $.
- Marge EDC LC1 tirée à **143 026,40 $ sur 150 000 $** (il reste 6 974 $).
- VISA principale -11 505,92 $.
- Shopify Capital #4 : 200 558,47 $ ; Merchant Growth : 137 956,69 $ au sous-état QBO
  (solde dû réel 174 684 $ au 23 juillet, le compte ne porte pas tout le coût fixe).
- BDC : 100K à 54 266,44 $, 18K à 18 000 $, 10K à 9 499,62 $, 11K à 11 000 $.
- AccordD 004 : 40 580,84 $. Prêts Philippe Langlois : 2 538,46 $.
- Prêts des actionnaires : 5 000 $ enregistrés (deux avances de 5 000 $ les 20 et
  28 juillet, une seule au compte).
- Total passif au bilan modèle, août 2026 : 546 434 $. Capitaux propres -153 501 $.
- Le compte chèques est maintenu à flot par une trentaine de tirages de marge
  (5 000 à 20 000 $) entre mai et juillet, plus les avances d'actionnaire.

## Chantiers ouverts (liste de tâches de la session)

- #3 Recaler les ventes prévisionnelles — **en cours**, devient prioritaire vu l'audit
- #11 Crédits d'impôt à venir (RSDE, Visa Design, timing caisse) — en cours
- #12 Creux de trésorerie août 2027 (-7 232 $) à financer — en attente
- #15 Registre Équipements après la vente — en cours, bloqué sur les 2 faits ci-dessus
- Nouveau : les 4 corrections techniques de l'audit
- Nouveau : la refonte de la trajectoire pour le dossier PARI
