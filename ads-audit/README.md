# Suivi de la performance publicitaire — Lasclay

Audit d'août 2026 et outillage de suivi récurrent. Remplace le chiffrier
« Journal publicitaire » du Drive, qui a décroché de la réalité en mars 2026.

## Ce qu'il y a ici

| Fichier | Contenu |
| --- | --- |
| `out/Lasclay - suivi performance publicitaire.xlsx` | **Le chiffrier de suivi.** 7 feuilles, 60 mois consolidés Meta + Shopify + Klaviyo. |
| `build_report.py` | Génère le rapport d'audit HTML (données injectées depuis `data/chart_data.json`). |
| `data/master_mensuel.csv` | Table maîtresse : un mois par ligne, toutes sources confondues. |
| `data/meta_monthly_qc.csv`, `data/meta_monthly_usa.csv` | Mensuel Meta par compte (dépense, ROAS, CPA, CPM, fréquence, entonnoir). |
| `data/meta_campaigns.csv` | Toutes les campagnes mesurables des deux comptes, avec objectif et ROAS. |
| `data/meta_adsets_qc.json` | Ensembles de publicités du compte Québec, ciblage et placements inclus. |
| `data/klaviyo_envois_3ans.csv` | 251 envois courriel et SMS, sept. 2023 → août 2026. |
| `data/shopify_monthly.csv`, `data/shopify_daily_*.csv` | Ventes Shopify, mensuel depuis 2021 et quotidien sur 12 mois. |
| `data/journal_daily.json`, `data/journal_sheet1.csv` | Le journal publicitaire du Drive, analysé (979 jours). |

## Comment rafraîchir les données

Aucune clé d'API ne vit dans ce dépôt. Les extractions passent par les connecteurs
de la session Claude :

- **Meta Ads** — connecteur `FB_ads_MCP`. Comptes : Québec `363736411681046`,
  USA `359131645638217`. Le compte ROC `903584246857616` est fermé et non
  interrogeable. L'API ne remonte que **37 mois** : au-delà, seule la liste des
  campagnes subsiste, sans métriques.
  - mensuel : `ads_get_ad_entities` niveau `ad_account`, `date_preset=maximum`,
    `time_increment=monthly`
  - campagnes / ensembles / publicités : même outil, niveau `campaign`, `adset`, `ad`
- **Shopify** — connecteur `Shopify`, `run-analytics-query` (ShopifyQL).
  Exemple : `FROM sales SHOW orders, net_sales TIMESERIES month SINCE 2021-01-01 UNTIL today`
- **Klaviyo** — connecteur `Klaviyo`, `get_campaign_report` et `get_flow_report`.
  Métrique de conversion « Placed Order » = `XQ6jaa`. Fenêtre maximale : 1 an par
  appel, donc une requête par exercice.

Puis régénérer : `python3 build_report.py` (requiert `openpyxl` pour le chiffrier).

## Les six chiffres à lire chaque mois

1. **MER réel** = ventes nettes Shopify ÷ dépense publicitaire. Le seul indicateur
   qui ne dépend d'aucune attribution déclarative. Seuil d'alerte : **3,0**.
2. **Fréquence du compte Québec.** Au-delà de **4**, l'audience est saturée.
3. **CPA Meta vs panier moyen.** Alerte au-delà de 45 % du panier.
4. **Part de la dépense hors conversion.** Cible : **0 %**.
5. **Revenu courriel du mois.** Une journée d'envoi vaut 3,2× une journée ordinaire.
6. **Écart journal ↔ API Meta.** Tolérance : 2 %.

## Constats de l'audit d'août 2026

1. 58 260 $ passés en campagnes engagement / notoriété / trafic (ROAS 0,62) —
   117 476 $ de manque à gagner au ROAS conversion.
2. Audience québécoise saturée : fréquence 2,92 → 4,23, CPM 3,35 $ → 9,28 $,
   CPA 16,86 $ → 31,48 $ entre FY2024 et FY2026. Le plus gros ensemble tourne
   sur le fil Facebook seul, sans Instagram ni Reels.
3. Le journal publicitaire surévalue la dépense de +502 % (avril 2026) et
   +2 886 % (mai 2026) ; colonnes sessions / commandes vides depuis février 2025.
4. `add_tracking_params` à `false` sur presque toutes les campagnes Klaviyo :
   Shopify n'attribue que 20 commandes au courriel contre 2 242 revendiquées.
5. Liste courriel en repli (audience médiane 22 215 → 15 576) et seulement
   quatre automatisations, dont une en brouillon.

Rapport complet : voir l'artefact « Où part la pub de Lasclay ».
