# Journal de session — extraction TVP C.-B. / Sask. / Man. et brief Cowork

**Date :** 5 septembre 2026
**Objet :** relever les données de taxes provinciales des trois provinces en retard, produire un
brief exécutable par Cowork, et vérifier la tenue de livres associée.
**Écriture dans QBO :** aucune. Une écriture est préparée et en attente d'accord (§4).

---

## 1. Méthode

Trois sources croisées, dans cet ordre de préséance :

1. **Rapport Taxes de Shopify** — `FROM sales_taxes SHOW sales_taxes GROUP BY tax_country,
   tax_region, tax_name, tax_rate`, via le connecteur Shopify MCP. C'est la source qui fait foi
   pour les montants de taxe.
2. **Rapport des ventes de Shopify** — `FROM sales ... GROUP BY shipping_region, month`, pour les
   ventes totales, que le rapport Taxes ne donne pas.
3. **QuickBooks Online** — grand livre complet 2023-01-01 → 2026-09-05 par le Finance Proxy,
   comptes 2111 (TVP C.-B.), 2112 (TVD Man.), 2113 (TVP Sask.), 2551 et 2053 (comptes d'attente).

**Erreur de méthode faite en cours de route, et corrigée.** Faute d'avoir chargé
`bookkeeping-lasclay` dès le départ, j'ai d'abord cherché la ventilation de taxe dans le dataset
`sales` (qui ne l'expose pas), puis lancé une opération `bulkOperationRunQuery` sur toutes les
commandes depuis septembre 2023, puis dérivé la part provinciale par la formule
`taxe totale × taux ÷ (taux + 5 %)`. Ça donnait des chiffres justes à 2 ¢ près, mais dérivés. Le
skill donne le bon dataset (`sales_taxes`) : les chiffres finaux en viennent directement.

**Contrôle final : écart nul entre le rapport Taxes de Shopify et QBO sur les 60 mois-provinces**
de janvier 2025 à août 2026, sauf mars 2026, absent des livres. Les soldes des trois comptes QBO
se réconcilient exactement avec le grand livre : C.-B. 425,98 $, Man. 338,23 $, Sask. 306,00 $.

---

## 2. Ce qui est en retard

| Province | Régime | Période | Taxe | Échéance | Retard |
| --- | --- | --- | --- | --- | --- |
| C.-B. | mensuel | janv. → juil. 2026 | 360,33 $ | dernier jour du mois suivant | 1 à 6 mois |
| C.-B. | mensuel | août 2026 | −4,27 $ (crédit) | 30 sept. 2026 | pas encore due |
| Sask. | annuel | année civile 2025 | 197,73 $ | 20 avril 2026 | ~4,5 mois |
| Man. | annuel | année civile 2025 | 301,20 $ | 20 janv. 2026 | ~7,5 mois |

Total à remettre : **854,99 $**, plus pénalités et intérêts que les portails calculeront.

Détail mois par mois dans `donnees-pst.csv`, marche à suivre dans `BRIEF-COWORK.md`.

---

## 3. Décisions de classement et de présentation

- **Facture 1081 incluse dans avril 2026 (C.-B.).** 280 $ de TVP de la C.-B. sur une vente de
  4 000 $ hors Shopify (Sylvia Lizotte, machine Qnique 21, 19 avril 2026). Le rapport Taxes de
  Shopify ne la voit pas ; elle est dans QBO. La case B d'avril passe donc de 5,25 $ à 285,25 $.
- **Juillet et août 2026 (C.-B.) : montants négatifs mis à la case I, pas à la case B.** Ces mois
  n'ont que des remboursements. La case B ne peut pas être négative ; la TVP rendue au client va à
  la case I du FIN 400.
- **Commission à zéro partout.** Les trois provinces la retirent en cas de production tardive, et
  le Manitoba l'a de toute façon abolie au budget 2024-2025. Ne pas réclamer une commission sur une
  déclaration en retard.
- **Case A du FIN 400 : ventes canadiennes totales, pas seulement les ventes en C.-B.** C'est le
  libellé du guide de la C.-B. Chiffre à confirmer contre le libellé de l'écran d'eTaxBC.
- **Aucun paiement autorisé.** Le brief demande à Cowork de produire, de relever les montants
  finaux, et de revenir demander l'autorisation de payer.

---

## 4. Écriture préparée, EN ATTENTE D'ACCORD

`2026-03 Taxes`, datée du 31 mars 2026 — la seule manquante de la série de 36 écritures.
Payload prêt dans `ecriture-2026-03-taxes.json`. **Rien n'a été écrit dans QBO.**

Ligne 1 : débit 3 370,01 $ au compte 132 (2121 Shopify Sales Tax Collected), soit le total
canadien du rapport Taxes de mars 2026. Puis le gabarit des juridictions.

| Description | Compte | TaxRateRef | Montant |
| --- | --- | --- | --- |
| GST - ALBERTA | 16 | 7 | 28,76 cr |
| GST - BRITISH COLUMBIA | 16 | 7 | 5,76 cr |
| PST - BRITISH COLUMBIA | 242 | 61 | 8,06 cr |
| GST - MANITOBA | 16 | 7 | 0,00 |
| PST - MANITOBA | 239 | 48 | 0,00 |
| HST - NEW BRUNSWICK | 16 | 29 | 0,00 |
| HST - NEWFOUNDLAND & LABRADOR | 16 | 33 | 0,00 |
| GST - NORTHWEST TERRITORIES | 16 | 7 | 0,00 |
| HST - NOVA SCOTIA | 16 | 39 | **12,18 dr** (négatif) |
| HST - ONTARIO | 16 | 25 | 145,31 cr |
| HST - PRINCE EDWARD ISLAND | 16 | 37 | 0,00 |
| GST - QUEBEC | 16 | 7 | 1 064,87 cr |
| QST - QUEBEC | 16 | 21 | 2 124,39 cr |
| GST - SASKATCHEWAN | 16 | 7 | 1,20 cr |
| PST - SASKATCHEWAN | 236 | 46 | 1,44 cr |
| **GST - NUNAVUT** | 16 | 7 | **2,40 cr** — ligne hors gabarit |

Contrôle : débits 3 382,19 = crédits 3 382,19. Ligne 1 = 3 370,01 = total canadien du rapport.

**Trois points à trancher avant d'écrire :**

1. **La ligne Nunavut n'est pas au gabarit.** Le gabarit documenté couvre onze juridictions et
   ignore le Yukon et le Nunavut. Mars 2026 a 2,40 $ de TPS du Nunavut. Je l'ajoute avec
   `TaxRateRef: 7`, contrairement à décembre 2025 où les lignes territoriales ont été saisies sans
   `TaxRateRef` (voir §5.1). Confirmer que c'est le bon traitement, et si oui, ajouter
   `GST - YUKON` et `GST - NUNAVUT` au gabarit de `references/taxes-shopify.md`.
2. **Le Québec revient en double dans le rapport Shopify**, une fois sous `CA` (point de vente :
   TPS 109,73, TVQ 218,88) et une fois sous `Canada` (TPS 955,14, TVQ 1 905,51). C'est l'anomalie
   que le skill signale. Je les additionne : TPS 1 064,87, TVQ 2 124,39.
3. **La Nouvelle-Écosse est négative** en mars 2026 (−12,18), donc au débit, comme la C.-B. l'a
   été en juillet 2026.

Pièce jointe à faire **après** l'écriture, jamais avant : capture du rapport Taxes de Shopify
pour mars 2026.

---

## 5. Anomalies relevées, non corrigées

### 5.1 Décembre 2025 — 31,35 $ de TPS hors déclaration

Écriture `2025-12 Taxes`, QBO Id 9763. Les lignes `GST- YUKON` (26,85 $) et `GST- NUNAVUT`
(4,50 $) sont saisies **sans `TaxRateRef` ni `TaxAmount`**. C'est exactement le piège décrit dans
le skill : l'écriture se balance, mais les montants n'alimentent pas la ligne 103 de la
déclaration de TPS.

J'ai balayé les 36 écritures de taxes du dossier : **c'est le seul mois touché**. Sans effet sur
les trois déclarations provinciales de ce mandat (c'est de la TPS), mais à corriger avant la
prochaine déclaration fédérale.

### 5.2 L'écriture de taxes de février 2025 porte le mauvais numéro

Elle existe sous `Sal Dist 2025-02-26` — un numéro de paie — au lieu de `2025-02 Taxes`. Les
montants sont bons et concordent avec Shopify (TVP C.-B. 12,12 $, TVP Sask. 10,17 $,
TVD Man. 8,27 $) ; seul le nom cloche. C'est ce qui fait que la série a l'air d'avoir deux trous
alors qu'elle n'en a qu'un.

### 5.3 Solde résiduel de 77,98 $ dans « TVP (C.-B.) à payer »

Les déclarations de la C.-B. jusqu'à décembre 2025 ont été produites, mais le compte 2111 ne se
solde pas. Deux origines probables, visibles au grand livre :

- **janvier 2025** : une série d'écritures « Taxe de vente soumise » et « Annuler une déclaration
  de taxe de vente » à 19,02 / 19,06 / 19,07 / 19,08 qui s'empilent, plus un redressement de
  11,92 $ sans contrepartie ;
- **décembre 2025** : la commission de 22,00 $ est passée en débit **et** en crédit, donc à effet
  nul, alors qu'elle aurait dû réduire le passif.

### 5.4 Saskatchewan — écart de 2024

Le compte 2113 porte 86,25 $ attribuables à 2024 : 119,99 $ de TVP perçus en 2024, mais l'écriture
de déclaration n'en a soldé que 33,74 $. Un paiement de 87,40 $ a été fait le 27 février 2025
(33,74 $ plus un redressement de 53,66 $ passé par le compte d'attente 2053), ce qui laisse un
écart réel d'environ **32,59 $** et un redressement de 43,66 $ encore coincé dans le compte
d'attente.

Je ne l'ai pas forcé. Le brief demande à Cowork de regarder ce que SETS affiche pour 2024 et de le
rapporter, sans y toucher.

### 5.5 Facture 1081 — TVP sans TPS

4 000 $ livrés en C.-B., 280 $ de TVP, **aucune TPS**. Une vente de ce montant devrait normalement
porter 200 $ de TPS. Question fiscale : je la signale plutôt que de la trancher.

---

## 6. À faire ensuite

1. Trancher les trois points du §4, puis écrire `2026-03 Taxes` et y joindre la capture du rapport.
2. Corriger les deux lignes territoriales de `2025-12 Taxes` avant la prochaine déclaration de TPS.
3. Passer le brief à Cowork, puis autoriser les paiements au retour.
4. Après production : enregistrer les déclarations dans QBO pour solder 2111, 2113 et 2112, et
   passer pénalités et intérêts en charge — ils ne font pas partie du passif de taxes.
5. Régler les résidus des §5.3 et §5.4.

---

## 7. Mises à jour à porter au skill `bookkeeping-lasclay`

- `references/taxes-shopify.md` dit « Série vérifiée : 2025-09 à 2026-07 ». Elle va maintenant
  jusqu'à **2026-08**, et le seul trou réel est **2026-03** : février 2025 existe sous le numéro
  `Sal Dist 2025-02-26` (§5.2).
- Le gabarit des seize lignes **manque le Yukon et le Nunavut**. Les deux apparaissent dans les
  données réelles (déc. 2025, mars 2026) et ont été saisis sans `TaxRateRef` en décembre.
- La ventilation provinciale se sort directement de `sales_taxes` par `tax_region` / `tax_name` :
  ça vaut la peine de le noter, la tentation de dériver la part provinciale du total est réelle et
  donne des écarts de quelques cents.
- L'action `report` du proxy **a bien appliqué** `start_date` et `end_date` sur un
  `GeneralLedger` demandé du 2023-01-01 au 2026-09-05 : les données remontaient jusqu'en 2023, soit
  bien au-delà de l'exercice courant. Le piège n° 3 du skill ne s'est pas reproduit ici, au moins
  pour ce rapport.
