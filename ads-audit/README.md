# Suivi de la performance publicitaire — Lasclay

Audit d'août 2026 et outillage de suivi récurrent. Remplace le chiffrier
« Journal publicitaire » du Drive, qui a décroché de la réalité en mars 2026.

## ⚠ Base de calcul — la correction qui a tout changé

**Meta compte la valeur d'une commande taxes et livraison comprises. Le journal
publicitaire, non.** La première version de cet audit comparait le ROAS de Meta
aux ventes *nettes* de Shopify. Sur 38 mois, l'écart entre les deux bases est de
**456 688 $, soit 20,3 %** — assez pour faire passer une campagne rentable pour
une campagne déficitaire.

Trois bases décrivent le même mois de ventes :

| Base | Définition | 38 mois |
| --- | --- | --- |
| **Base Meta** | brut − rabais + livraison + taxes, **avant retours** | 2 709 534 $ |
| **Base encaissée** (`total_sales`) | idem, retours déduits | 2 625 182 $ |
| **Base marge** (`net_sales`) | brut − rabais − retours, **sans** taxes ni livraison | 2 252 847 $ |

Tout rendement comparé à un chiffre de Meta se calcule sur la **base Meta**.

## Ce qu'il y a ici

| Fichier | Contenu |
| --- | --- |
| `out/Lasclay - suivi performance publicitaire.xlsx` | **Le chiffrier de suivi.** 8 feuilles, dont les trois bases côte à côte et la rentabilité QuickBooks. |
| `build_report.py` | Génère le rapport d'audit HTML depuis `data/chart_data.json`. |
| `data/master_mensuel.csv` | Table maîtresse : un mois par ligne, toutes sources et toutes bases. |
| `data/shopify_monthly_bridge.csv` | Le pont entre les trois bases : brut, rabais, retours, livraison, taxes. |
| `data/meta_monthly_qc.csv`, `data/meta_monthly_usa.csv` | Mensuel Meta par compte. |
| `data/meta_campaigns.csv` | Campagnes des deux comptes, avec objectif et ROAS. |
| `data/meta_adsets_qc.json` | Ensembles de publicités du compte Québec, ciblage et placements. |
| `data/klaviyo_envois_3ans.csv` | 251 envois courriel et SMS, sept. 2023 → août 2026. |
| `data/shopify_monthly.csv`, `data/shopify_daily_*.csv` | Ventes Shopify, mensuel depuis 2021 et quotidien sur 12 mois. |
| `data/journal_daily.json`, `data/journal_sheet1.csv` | Le journal publicitaire du Drive, analysé (979 jours). |

## Comment rafraîchir les données

Aucune clé d'API ne vit dans ce dépôt. Les extractions passent par les connecteurs
de la session Claude :

- **Meta Ads** — connecteur `FB_ads_MCP`. Comptes : Québec `363736411681046`,
  USA `359131645638217`. Le compte ROC `903584246857616` est fermé et non
  interrogeable. L'API ne remonte que **37 mois**.
  - mensuel : `ads_get_ad_entities` niveau `ad_account`, `date_preset=maximum`,
    `time_increment=monthly`
  - campagnes / ensembles / publicités : même outil, niveau `campaign`, `adset`, `ad`
- **Shopify** — connecteur `Shopify`, `run-analytics-query` (ShopifyQL). Pour le pont
  entre les bases :
  `FROM sales SHOW gross_sales, discounts, sales_reversals, net_sales, shipping_charges, taxes, total_sales TIMESERIES month SINCE 2023-07-01 UNTIL today`
- **Klaviyo** — connecteur `Klaviyo`, `get_campaign_report` et `get_flow_report`.
  Métrique de conversion « Placed Order » = `XQ6jaa`. Fenêtre max : 1 an par appel.
- **QuickBooks** — `node finance_client.js report '{"name":"ProfitAndLoss","start_date":"…","end_date":"…","summarize_column_by":"Total"}'`
  (voir le skill `qbo`). Sert à recalculer la marge de contribution, donc le seuil.

Puis régénérer : `python3 build_report.py` (requiert `openpyxl`).

## Le seuil de rentabilité publicitaire

```
seuil MER = (base Meta ÷ ventes nettes) ÷ marge de contribution
marge de contribution = (revenus − COGS − expédition clients − frais marchands) ÷ revenus
```

| Exercice | Marge brute | Contribution | Ratio base/marge | **Seuil** | MER réel |
| --- | --- | --- | --- | --- | --- |
| FY2024 | 65,5 % | 51,9 % | 1,248 | **2,40** | 6,95 |
| FY2025 | 73,0 % | 57,5 % | 1,179 | **2,05** | 4,11 |
| FY2026 | 61,4 % | 48,5 % | 1,198 | **2,47** | 4,30 |

À recalculer chaque trimestre : le seuil bouge avec la marge.

## Les six chiffres à lire chaque mois

1. **MER réel** (base Meta ÷ dépense), comparé au seuil de l'exercice.
2. **Fréquence du compte Québec.** Au-delà de **4**, l'audience est saturée.
3. **CPA Meta vs panier moyen.** Alerte au-delà de 45 % du panier.
4. **Part de la dépense hors conversion.** Cible : **0 %**.
5. **Revenu courriel du mois.** Une journée d'envoi vaut 3,3× une journée ordinaire.
6. **Écart journal ↔ API Meta.** Tolérance : 2 %.

## Constats de l'audit d'août 2026

1. Sur la bonne base, la pub **paie** : MER FY2026 de 4,30 contre un seuil de 2,47.
   Deux mois seulement passent sous le seuil en trois ans (juin 2025, mars 2026).
2. Mais le rendement **marginal** estimé est de ~3,30 $/$ (régression, R² 0,74),
   bien sous le MER moyen de 4,63 — et Meta s'attribue **72 %** du magasin dans les
   mois à forte dépense. Un test d'incrémentalité reste à faire.
3. 58 260 $ passés en campagnes engagement / notoriété / trafic (ROAS 0,62) —
   117 476 $ de manque à gagner au ROAS des campagnes de conversion.
4. Audience québécoise saturée : fréquence 2,92 → 4,23, CPM 3,35 $ → 9,28 $,
   CPA 16,86 $ → 31,48 $ entre FY2024 et FY2026. Le plus gros ensemble tourne
   sur le fil Facebook seul, sans Instagram ni Reels, à une fréquence de 11,5.
5. Le journal surévalue la dépense de +502 % (avril 2026) et +2 886 % (mai 2026) ;
   colonnes sessions / commandes vides depuis février 2025.
6. `add_tracking_params` à `false` sur presque toutes les campagnes Klaviyo :
   Shopify n'attribue que 20 commandes au courriel contre 2 242 revendiquées.
7. **La perte FY2026 de 149 994 $ ne vient pas de la pub** mais de la marge brute
   qui tombe de 73,0 % à 61,4 %. Couper la pub réglerait le mauvais problème.

Rapport complet : artefact « Où part la pub de Lasclay ».

## Lecture complète du journal — insights (août 2026)

Les 979 jours, les 124 interventions annotées et les trois feuilles remontant à
octobre 2022 (hors fenêtre de l'API Meta) donnent six constats qu'aucun tableau
de bord ne montre :

- **A. Le journal a cessé de penser le 8 juillet 2025** — dernière note de raisonnement,
  318 jours avant la dernière ligne. **47 % de la dépense mesurée (272 431 $)** a été
  engagée après, dont les deux plus gros mois de l'histoire (nov. et déc. 2025).
- **B. Les 124 ajustements sont indistinguables du bruit.** Test avec témoin apparié
  par décile de niveau de départ, puis permutation sur 4 000 tirages : **p = 0,29**.
  Les hausses apparentes sont du retour à la moyenne (il intervient après les mauvaises
  journées). 55 désactivations pour 21 réactivations : 2 pubs coupées sur 5 sont rallumées.
- **C. Le budget est à contretemps de la saison.** Corrélation de rang de **−0,97**
  entre l'écart de financement d'un mois et son rendement. Septembre : MER 9,13 pour
  4,4 % du budget. Mars : MER 2,76 pour 9,8 %. Déplacer 25 % du budget des mois faibles
  ≈ **+139 000 $** de valeur de commande, à budget total inchangé.
- **D. La semaine n'est pas exploitée** : samedi 136, mardi 75 (indice 100 = médiane).
  Trouvé une fois le 15 mars 2025, jamais systématisé.
- **E. Le taux de conversion glisse** : 3,08 % (2023-24) → 2,54 % (2024-25) pendant que
  les sessions doublaient (660 → 1 148/j). On achète plus de visiteurs moins qualifiés.
  Colonnes vides depuis février 2025.
- **F. Six erreurs de configuration, zéro alerte** — toutes trouvées à l'œil, dont
  l'audience « USA Sud » qui ciblait **la Géorgie, le pays** (corrigée le 1er avril 2025).

Sept notes distinctes sur deux ans soupçonnent une compétition entre ad sets.
Jamais testée.

## Audit technique du compte Meta (sans création de contenu)

Constats tirés de l'API le 25 août 2026 — jeu de données `1038224283301175`,
catalogue `1198507480521979` :

| Réglage | État constaté | Effort | Impact |
| --- | --- | --- | --- |
| Publicités catalogue Advantage+ | **0 campagne sur 36** — le catalogue Shopify existe depuis 2020 | 1 h | Élevé |
| Audiences de reciblage | « Visiteurs site web 180 j » et « Pixel 180 j » : **20 personnes** | 1 h | Élevé |
| Répartition saisonnière du budget | plate toute l'année | 2 h | Élevé |
| Signal CAPI amont | Achat 9,3 · **Panier 6,3 · Vue produit 6,0** (courriel sur 10,5 % des paniers) | 3 h | Élevé |
| Placements | ensemble à 95 196 $ : **fil Facebook seul**, fréquence 11,5 | 15 min | Moyen |
| Stratégie d'enchère | « volume le plus élevé » sur les 13 ensembles | 30 min | Moyen |
| Conversions personnalisées | **aucune** | 1 h | Moyen |
| Fenêtre d'attribution | **trois réglages coexistent** → ROAS non comparables | 15 min | Moyen |
| Test A/B de chevauchement | jamais lancé | 30 min | Diagnostic |

Le moteur de recommandations de Meta, interrogé indépendamment sur le compte USA,
place *Advantage+ catalog ads* en tête (gain estimé le plus élevé) et signale la
couverture d'événements CAPI — mêmes conclusions par un autre chemin.

Le diagnostic du catalogue échoue sur `catalog_has_da_visibility_issues`
(articles invisibles pour les publicités) : à corriger avant de lancer.
