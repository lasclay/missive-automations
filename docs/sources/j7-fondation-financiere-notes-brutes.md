# J7 Media — « Fondation Financière » (spécialisation e-commerce, 39:46)

Formation de J7 Media (agence Meta Ads, Montréal). Enregistrement d'écran, nov. 2023.
Fichier Drive `1YrsnrSJZT8CBk7oApWZ2slr6VR3wPikm` — 1,36 Go, 1920×1080.

## La thèse

> « On doit apprendre à compter ! »
> « Si vous connaissez les chiffres de vos clients mieux que lui-même, vous passez de… »

Et la posture qu'il enseigne, face à un client qui annonce « mon objectif est de passer de 1 à 15 M
de chiffre d'affaires cette année » :
> « **Fantastique. Laissez-moi vous bâtir une fondation financière et je vous reviens
> rapidement.** » — pas de promesse avant le modèle.

## Les 11 métriques à connaître par cœur (diapo)
| Sigle | Définition donnée |
| --- | --- |
| **CAC** | coût d'acquisition |
| **NCAC** | coût d'acquisition d'un **nouveau** client |
| **AOV** (Average Order Value) | valeur d'une transaction moyenne |
| **Gross margin** (profit brut) | profit généré par transaction |
| **COGS** | coût du produit qu'on vend |
| **LTV 3 mois** | revenus moyens accumulés par un client sur **90 jours** |
| **Cohort** | période spécifique analysée dans l'analyse économique |
| **POAS** | *profit on ad spend* — profit généré sur l'investissement publicitaire |
| **Monthly contribution margin** | le profit net mensuel |
| **New customer sales** | ventes aux nouveaux clients |
| **Repeat customer sales** | ventes aux clients existants |

⭐ La distinction **CAC vs NCAC** est celle que tout le monde saute. Et **POAS** remplace le ROAS :
on regarde le profit sur la dépense, pas le revenu sur la dépense.

## Le chiffrier « Fondation Financière — Template J7 Académie »

Une ligne par mois, sur 12 mois glissants. Colonnes :
`Cohort` · `New clients past 12 months` · `Blended NCAC` · `Gross profit first transaction` ·
`Ideal NCAC target for maximum scale` · `Total Spend` · `AOV New customer` · `AOV old customer` ·
`Profit per customer` · `% of total new acquisition` · `% of sales of the entire year` ·
`New client's revenue` · `Old client's revenue`

### Les trois formules, vérifiées sur les 12 lignes
```
Blended NCAC              = Total Spend ÷ New clients          (formule visible : C3 = F3/B3)
Ideal NCAC target         = AOV nouveau client × marge brute %
Profit per customer       = (AOV × marge brute %) − Blended NCAC
```
⭐ **Le NCAC idéal pour scaler au maximum, c'est exactement le profit brut de la première
commande.** Autrement dit : on accepte de sortir à zéro sur la première vente, et on fait son
argent sur la suivante. Au-dessus de ce seuil, le profit par client devient négatif.

### Les données réelles du compte client montré (12 mois, 2022-2023)
| Mois | Nouveaux clients | Blended NCAC | Marge brute | NCAC idéal | Dépense | AOV nouveau | Profit/client |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Octobre | 810 | 29,02 $ | 53 % | 41,34 | 23 508 $ | 78 $ | **+12,32 $** |
| Novembre | 1 942 | 15,89 $ | 55 % | 45,10 | 30 854 $ | 82 $ | **+29,21 $** |
| Décembre | 2 599 | 11,92 $ | 55 % | 44,00 | 30 985 $ | 80 $ | **+32,08 $** |
| Janvier | 1 816 | 21,78 $ | 52 % | 39,52 | 39 552 $ | 76 $ | +17,74 $ |
| Février | 1 577 | 19,94 $ | 52 % | 36,92 | 31 453 $ | 71 $ | +16,98 $ |
| **Mars** | 1 184 | **38,89 $** | 49 % | **36,26** | 46 046 $ | 74 $ | **−2,63 $** ⚠️ |
| Avril | 726 | 39,98 $ | 49 % | 42,63 | 29 028 $ | 87 $ | +2,65 $ |
| Mai | 799 | 36,17 $ | 46 % | 41,86 | 28 898 $ | 91 $ | +5,69 $ |
| Juin | 1 469 | 19,18 $ | 46 % | 38,64 | 28 175 $ | 84 $ | +19,46 $ |
| Juillet | 536 | 33,87 $ | 48 % | 41,76 | 18 154 $ | 87 $ | +7,89 $ |
| Août | 806 | 14,03 $ | 49 % | 46,06 | 11 312 $ | 94 $ | +32,03 $ |
| Septembre | 440 | 3,97 $ | 51 % | 47,43 | 1 748 $ | 93 $ | +43,46 $ |
| **Total** | **14 704** | **21,74 $** | — | — | **319 713 $** | — | — |

Revenu des **nouveaux** clients : **1 031 832 $**. Revenu des clients **existants** : **1 482 111 $**.
→ **59 % du chiffre d'affaires vient des clients déjà acquis.** C'est ce ratio qui justifie de
sortir à zéro sur la première commande.

Lecture de mars : le NCAC (38,89 $) passe **au-dessus** du NCAC idéal (36,26 $) → le profit par
client tombe à **−2,63 $**. Le mois où on a dépensé le plus (46 046 $) est le seul mois déficitaire
à l'acquisition. C'est la démonstration de la mécanique.

### La deuxième moitié du chiffrier : le budget dérivé du NCAC
Section « Cohort (2023) » : colonnes **`Budget based on Blended NCAC`** répétées pour plusieurs
cibles de NCAC (26,6 · 35 · 40 · 50 dans la version montrée ; 21 · 25 · 30 · 35 dans une autre).
On entre une cible de NCAC, et le chiffrier sort **le budget publicitaire que ça implique** pour
un nombre de nouveaux clients visé — plus `AOV New customer sales`, `Gross Margin per order`,
`Profit per customer`, `New customer's revenue`, `Existing client's revenue`.

→ **Le budget n'est pas une décision, c'est un résultat.** On choisit un objectif de nouveaux
clients et un NCAC soutenable ; le budget tombe tout seul.

## L'outil de mesure : Lifetimely (by AMP)
Rapport *Income statement* montré à l'écran, période 01/10/2022 – 30/09/2023 :
- **Total sales 3 353 347 $** (+15 %)
- **Marketing costs 319 713 $** (+341 %)
- **COGS 1 425 705 $** (+23 %)
- **Net profit 1 172 390 $** (−10 %)

C'est là que le « Total Spend » du chiffrier est pris. Noter le contraste : les ventes montent de
15 %, la dépense pub de 341 %, et le profit net **baisse de 10 %**. Toute la formation est là.

### Les formules exactes, lues dans la barre de formule
```
C3  = F3/B3          Blended NCAC       = Dépense totale ÷ nouveaux clients
I3  = (G3*D3)-C3     Profit par client  = (AOV nouveau × marge brute) − NCAC
C20 = B20*C18        Budget             = nouveaux clients visés × NCAC cible
L19 = N19-M19        Revenu nouveaux    = revenu total − revenu clients existants
N31 = N15*4          Objectif de revenu = revenu de l'an dernier × le multiplicateur
```

⭐ **La chaîne complète, et c'est tout le propos de la formation :**
`objectif de revenu → nouveaux clients nécessaires → × NCAC soutenable = budget publicitaire`

Dans la démonstration, il met le multiplicateur à **×4** et le chiffrier répond :
74 468 nouveaux clients à trouver, revenu nouveaux clients de 8 600 964 $, et un budget de
**2 214 822 $** (NCAC 21) · **2 636 693 $** (25) · **3 164 032 $** (30) · **3 691 371 $** (35).
C'est la réponse arithmétique à la question « je veux passer de 1 à 15 M ».

## La visite de Lifetimely (l'outil de mesure)

**Cost & expenses** — sept onglets qui construisent la vraie marge :
`Product costs` (coût par SKU, avec comparaison coût Shopify / coût Lifetimely) ·
`Default gross margin` · `Transaction costs` · `Handling costs` · `Shipping costs` ·
`Custom costs` · `Personnel`.
→ Sans ces sept-là remplis, la marge brute du modèle est fausse, et tout le reste avec.

**Profit & loss → Income statement**, par mois :
`Total sales → Taxes → Net sales → COGS → Marketing → Contribution margin →
Operating expenses → Net profit`, avec une ligne de KPI en % en dessous (44 %, 36 %, 49 %,
43 %, 44 %…).

**Lifetime value → Cohorts** : une ligne par mois de première commande, colonnes
`New customers` · `CAC` · `R-%` (taux de réachat) · puis **`Months since first order` 0 à 6+**,
qui accumule la marge brute par client. Exemple : avril 2023, 35 nouveaux clients, CAC 11 €,
R-% 23 %, première commande 16 € → 24 € au 6e mois.

⭐ **Le même tableau ventilé par produit** — et c'est la découverte la plus utile de la formation :
| Produit d'entrée | Nouveaux clients | R-% | 1re commande | 6e mois |
| --- | --- | --- | --- | --- |
| Box NUOO (sans engagement) | 352 | **64 %** | 16 € | **57 €** |
| Ma Gelée Boucles | 1 063 | 7 % | 31 € | 36 € |
| Calendrier de l'Avent beauté 2023 | 508 | **1 %** | **93 €** | 94 € |
→ Le calendrier de l'Avent a le plus gros panier d'entrée et **ne produit aucun réachat**.
La box a le plus petit panier et triple sa valeur en six mois.
**Le produit sur lequel on acquiert décide de la valeur à vie du client.**

**Customer behavior → Repurchase rate** : taux de réachat d'un client déjà revenu —
**40,7 % à 30 jours · 69,8 % à 90 jours · 80,1 % à 180 jours · 88,8 % à 365 jours.**
(Plus : Product journey, Funnel, Repurchase rate breakdown, Time between orders,
Subscription churn.)

**Dashboards** : gabarits *Boardroom KPI's* (« ce que vos investisseurs veulent voir »),
*Marketing board*, *Daily overview*, *Empty board*.

### Les KPI du relevé de revenus, mois par mois (Lifetimely)
| | Oct 22 | Nov 22 | **Déc 22** | Jan 23 | Fév 23 | Mars 23 |
| --- | --- | --- | --- | --- | --- | --- |
| Commandes | 2 841 | 5 509 | **7 102** | 4 487 | 3 861 | 3 232 |
| AOV global | 77 $ | 80 $ | 75 $ | 74 $ | 71 $ | 70 $ |
| AOV nouveau client | 78 $ | 82 $ | 80 $ | 76 $ | 71 $ | 74 $ |
| AOV client de retour | 80 $ | 85 $ | 80 $ | 75 $ | 72 $ | 69 $ |
| **% commandes de réachat** | 57 % | 49 % | **35 %** | 47 % | 47 % | 52 % |
| **% ventes de réachat** | 59 % | 52 % | **38 %** | 48 % | 48 % | 51 % |
| Articles par commande | 3,2 | 2,9 | 3,0 | 2,7 | 2,5 | 2,6 |

⭐ Décembre est le plus gros mois en commandes **et** le mois où la part de réachat s'effondre
(57 % → 35 %). C'est normal et c'est important : la saison forte est un mois d'**acquisition**,
pas de fidélisation. Le profit de ces clients-là se fait en janvier, mars et l'automne suivant.
