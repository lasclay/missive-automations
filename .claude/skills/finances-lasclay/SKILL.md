---
name: finances-lasclay
description: >
  Expertise financière et budgétaire de Lasclay (marque québécoise de produits isolés à
  la soie d'asclépiade). Charge ce skill dès qu'une tâche touche les finances, le budget,
  les prévisions, la comptabilité, les marges, les COGS, la trésorerie, la masse salariale
  ou les états financiers de Lasclay. Couvre : le modèle de prévisions (chiffrier
  PRÉVISIONS...xlsx), la connexion QuickBooks, les données de ventes Shopify, les fiches
  COGS Tunisie, la méthodologie de projection (annualisation, saisonnalité, croissance),
  et les repères chiffrés. Exercice fiscal 1er sept au 31 août. Ce n'est pas un skill de
  marque ou de SEO : pour le contexte d'entreprise général, voir lasclay-master ; pour le
  référencement, lasclay-seo.
---

# Finances Lasclay

Skill d'expertise financière pour Les Produits Lasclay inc. Sert à mettre à jour, analyser
et défendre le modèle budgétaire, à intégrer les réels et à produire des documents
financiers cohérents. À utiliser avec lasclay-master (contexte de marque) au besoin.

Règle de voix : québécois, direct, pas de cadratins ; utiliser virgules, deux-points,
parenthèses ou traits d'union simples.

## 1. Faits structurants

- **Exercice fiscal : 1er septembre au 31 août.** FY2026 = sept. 2025 à août 2026. Toujours
  raisonner en année fiscale (jamais en année civile) pour les analyses et comparaisons.
- Virage manufacturier 2025-2026 : Lasclay ne fabrique plus la majorité des produits finis.
  Assemblage sous-traité (surtout Tunisie). Service client automatisé. Production interne
  éliminée. C'est ce qui allège la structure de coûts et crée du levier opérationnel.
- L'asclépiade horticole (graines, bombes) est **vivace** : une fois planté, pas de rachat.
  Le marché sature vite. Traiter l'horticole comme un **outil d'acquisition** (distribution
  gratuite, 1,50 $ d'expédition), pas comme un moteur de revenu.

## 2. Sources de données (où chercher la vérité)

- **QuickBooks Online** (connecteur Intuit) : résultats réels, P&L et bilan mensuels. Pour
  extraire : rapport en colonnes « Mois », base « Exercice », période sept-août. Les données
  se collent dans « QBO P&L à maj » et « QBOBS à maj » du chiffrier ; des SUMIF rattachent
  chaque compte à une ligne du modèle.
- **Shopify** (lasclay.myshopify.com) : ventes réelles par produit/mois. Requête ShopifyQL :
  `FROM sales SHOW gross_sales, net_sales, net_items_sold, orders GROUP BY product_title
  SINCE aaaa-mm-jj UNTIL aaaa-mm-jj`. La quantité est `net_items_sold` (pas
  `ordered_product_quantity`). Catalogue, prix et handles via graphql_query products. URL
  produit = https://lasclay.com/products/{handle}.
- **Google Drive** : fiches « A26 – [Produit] Tunisie COGS » (Coût du produit = Matériaux +
  Sous-traitance ; douanes et transport déjà inclus dans la sous-traitance). PRIX LASCLAY.xlsx.
- **EFS compilés** (PDF) : états financiers officiels par exercice.

## 3. Le chiffrier de prévisions (architecture)

Fichier de référence : `PRÉVISIONS LASCLAY - maj QBO ...xlsx` (24 feuilles). Travailler sur
une copie datée ; recalculer avec LibreOffice headless après édition (openpyxl ne calcule
pas les formules).

Feuilles clés :
- **Résultats2025-2028** : moteur P&L. Colonnes = mois par bloc d'exercice (D-P = FY2026,
  R-AD = FY2027, AF-AR = FY2028, AT-BF = FY2029). Ligne 5 = revenus, 26 = ventes nettes,
  33 = CMV, 137 = profit avant impôts, 145 = EBITDA. Mois réels via SUMIF sur feuilles QBO ;
  mois futurs = formules. FY2029 extrapolé (revenu = mois FY2028 × facteur).
- **Ventes prévisionnelles** (~1408 lignes, ~53 produits) : revenu par le bas. Par produit :
  quantité globale (base × facteur) × saisonnalité mensuelle × prix. Facteurs partagés par
  catégorie : hiver BD10/BS10, été BD83/BS83, horticole BD141/BS141. **Chaque exercice a sa
  propre colonne de taux/prix** (FY26 = AP, FY27 = BE, FY28 = BT) : changer les trois. La
  ligne 5 somme ~53 lignes de prix (une réf #REF! historique cassée y traîne, sans effet).
- **Inputs** : hypothèses. Ratios COGS (achat web 51 %, transport 6 %, escompte 8 %), pub
  (20 %, 17,5 %), contributions employeur, change 1,38. Bloc « Fenêtres d'activité des
  ressources » (lignes 44+) : équipe pilotée par dates actif-de/à + mois saisonniers, avec
  une ligne de dates de mois (ligne 15) qui pilote les salaires mensuels.
- **Account payable** : modèle d'achats + inventaire (matières). Le P&L tire ses « Achats
  MP » d'ici (croissance propre + 20 % douanes), PAS du coût matières par produit. Découplage
  à surveiller.
- **QBO P&L à maj / QBOBS à maj** : cibles du copier-coller mensuel QBO.

## 4. Méthodologie de projection

1. **Annualiser le réel** : part sept-févr du revenu annuel, empirique (H1 exercice N-1 /
   année complète N-1). Repères : hiver ~90-95 %, été ~25-27 %, horticole ~16-29 %. Annuel =
   réel H1 / part.
2. **Recaler les bases** de chaque produit sur le réel annualisé avant toute croissance.
3. **Répartition mensuelle** : emprunter la saisonnalité d'un produit similaire (usage,
   saison). Ex : gants magiques ~ semelles/mitaines.
4. **Prix pour le volume** : bas prix = plus de volume (semelles 20 $ > mitaines cuir 120 $).
5. **Nouveaux produits** : projeter depuis la prévente (fin mai) et par analogie ; leur volume
   s'ajoute par-dessus l'organique (attention à la cannibalisation des variantes de mitaines).
6. **Croissance** : historique CAGR ~48-68 %/an, par vagues. Scénario mid-optimiste en
   décélération. Régler les facteurs de catégorie, mesurer le total, itérer.
7. **Crédibilité des marges** : faire suivre les coûts variables (COGS, pub) au revenu ;
   laisser jouer le levier opérationnel sur les coûts fixes (loyer, admin, amortissement).

## 5. Repères chiffrés (mémo, datés)

- EFS : CA 404 k (FY23) → 505 k (FY24) → 879 k (FY25). Marge brute 44 → 65 → 73 %.
- Croissance Shopify par exercice : +149 % (FY22), +41 %, +21 %, +90 % (FY25). CAGR ~48-68 %.
- Trajectoire mid-optimiste retenue (ventes nettes) : FY26 1,03 M → FY27 1,65 M (+60 %) →
  FY28 2,44 M (+48 %) → FY29 3,40 M (+39 %). EBITDA 23 → 24 → 32 %.
- COGS Tunisie ($/u, douanes+transport inclus dans la S-T) : mitaines plein air 8,63 + 6,27 ;
  cache-cou 4,07 + 5,05 ; semelles 0,94 + 2,26 ; tuque sport 1,56 + 5,55 ; glacière
  11,15 + 20,78 ; sac lunch 6,84 + 12,96 ; foulard 3,50 + 7,69.
- Équipe : Catherine 28,60 $/h, Gabriel 30 $/h (année), marketing 30 $/h dès FY2027,
  expédition 23 $/h 25h oct-déc. Masse salariale prévisionnelle ~159-181 k$/an.

## 6. Garde-fous

- Ne jamais republier de données financières non publiques sans validation. Repères datés.
- Distinguer brut (quantité × prix) et net (après escomptes/remboursements/transport).
- Ne pas confondre les variantes de mitaines (plein air, urbaines, bébé, cuir de mouton,
  laine) : vérifier les dates de création Shopify pour situer chaque produit dans le bon
  exercice (ex : cuir de mouton créé mai 2026 = préventé FY2027).
- Recalculer et vérifier après toute édition ; préserver l'original, sauver une copie datée.
- Quirks pré-existants du modèle (annualisation des colonnes « Total », #REF! ligne 5, ~30
  produits sans nom) : les connaître, ne pas les prendre pour des erreurs nouvelles.

## 7. Chantiers connus (au 10 juillet 2026)

Rafraîchir le PDF investisseurs ; étiqueter les ~30 lignes produits anonymes de Ventes
prévisionnelles ; aligner le volet matières (Account payable) sur la Tunisie ; rebrancher les
Bilan sur les réels QBO (comptes manquants 2513, 2503, 3001) ; automatiser l'import QBO via
le connecteur de données.
