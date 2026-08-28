# Dossier — PAUPME Tarifs douaniers

**Demandeur :** Les Produits Lasclay Inc
**Guichet :** Ville de Québec (fonds local d'investissement)
**Exercice de référence :** 1er septembre 2024 au 31 août 2025 (« exercice 2025 »), confirmé
avec la MRC comme l'exercice servant au critère des 25 %
**Préparé le :** 28 août 2026

---

## 1. Identification

| | |
| --- | --- |
| Dénomination | Les Produits Lasclay Inc |
| Siège social | 1286, avenue de la Ronde, Québec (Québec) G1J 4B7 |
| Début d'activité | 20 octobre 2022 |
| Secteur | Fabrication et vente de produits isolés à la soie d'asclépiade (plein air, accessoires, glacières souples, semences) |
| Canaux | lasclay.com (Shopify), Etsy, ventes corporatives |
| Exercice financier | 1er septembre au 31 août |
| Marchés | Canada et États-Unis |

## 2. Grille d'admissibilité

| # | Condition | Situation | État |
| --- | --- | --- | --- |
| 1 | Entreprise à but lucratif constituée sous les lois du Québec ou du Canada | Société par actions | ✅ |
| 2 | Inscrite au REQ depuis au moins deux ans, siège social au Québec | Depuis le 20 octobre 2022, soit 3 ans 10 mois | ✅ |
| 3 | Chiffre d'affaires de 200 000 $ à 2 000 000 $ au dernier exercice terminé | **879 125 $** (exercice 2025) | ✅ |
| 4 | Au moins 25 % du chiffre d'affaires provenant d'exportations vers les États-Unis | **25,84 %** (227 130 $ sur 879 125 $) | ✅ |
| 5 | Baisse du chiffre d'affaires d'au moins 20 % vs 2024, ou baisse prévisionnelle de 20 % causée par les tarifs de 2026 | **À documenter** — voir section 6 | ⚠️ |
| 6 | Rentabilité à au moins un des deux derniers exercices terminés | Exercice 2025 : **+4 204 $** | ✅ |
| 7 | Plan d'adaptation déposé dans les douze mois suivant l'aide | Engagement pris — esquisse en section 8 | ✅ |
| 8 | Hors RENA, pas en faillite, obligations antérieures respectées | Aucun manquement | ✅ |

## 3. Chiffre d'affaires par marché — exercice 2025

| Compte | Marché | Montant |
| --- | --- | ---: |
| 4010 Shopify Canada | Canada | 616 900,34 $ |
| 4020 Shopify Corpo (commandes manuelles) | Canada | 18 418,77 $ |
| 4050 Etsy Canada | Canada | 2 419,67 $ |
| 4200 Ventes corporatives | Canada | 46 003,09 $ |
| 4201 Revenus d'expédition (refacturation) | Canada | 5 239,33 $ |
| **4030 Shopify USA** | **États-Unis** | **220 023,49 $** |
| **4060 Etsy USA** | **États-Unis** | **7 106,61 $** |
| | **Ventes États-Unis** | **227 130,10 $** |
| | **Chiffre d'affaires total** | **879 125,39 $** |
| | **Part des exportations américaines** | **25,84 %** |

Le seuil de 25 % correspond à 219 781,35 $. La marge au-dessus du seuil est de **7 348,75 $**.

Aucune vente américaine indirecte n'est réclamée : la revue du grand livre confirme que les
46 003 $ de ventes corporatives sont tous à des clients québécois (MA-TH, Espace inc, Les
Défricheuses, Stablex, Ville de Mont-Tremblant, kotmo, Les Mauvaises Herbes, Tournesol
Paysagiste, Timininous, Dédié au Design Durable). Le chiffre de 25,84 % ne repose que sur des
exportations directes, documentées commande par commande dans Shopify.

## 4. Note méthodologique — correction comptable de l'exercice 2025

Les chiffres ci-dessus intègrent une correction de **7 888,14 $** entre deux comptes de revenus.
Elle ne modifie ni le chiffre d'affaires total, ni le bénéfice, ni le bilan : c'est un
reclassement entre le compte de remboursements canadien et le compte de remboursements américain.

**Ce qui s'est passé.** Les écritures de ventes Shopify sont générées automatiquement à partir
d'une table de correspondance héritée de l'application A2X. Quatre règles de cette table
dirigeaient des transactions vers le compte du mauvais pays :

| Règle | Destination erronée | Destination corrigée |
| --- | --- | --- |
| `Discounts / DiscountNotTaxed / CA / exchange` | 4033 Remboursements Shopify **USA** | 4013 Remboursements Shopify **Canada** |
| `Refunds / RefundAdjustmentNotTaxed – refund_discrepancy / CA / manual` | 4033 Remboursements Shopify **USA** | 4013 Remboursements Shopify **Canada** |
| `Refunds / RefundDiscountNotTaxed / US / manual` | 4012 Rabais Shopify **Canada** | 4032 Rabais Shopify **USA** |
| `Refunds / RefundNotTaxed / US / manual` | 4013 Remboursements Shopify **Canada** | 4031 Ventes Shopify **USA** |

Les règles voisines de la même table confirment la destination correcte : `DiscountNotTaxed /
CA / online` va bien en 4013, et `RefundAdjustmentNotTaxed / CA / online` aussi. Seules les
variantes « exchange » et « manual » du côté canadien pointaient vers le compte américain.

**Effet sur l'exercice 2025.** Huit lignes, toutes étiquetées « CA » dans leur propre libellé,
étaient logées dans le compte 4033 « Remboursements Shopify USA » :

| Date | Écriture | Libellé | Montant |
| --- | --- | --- | ---: |
| 2024-11-04 | A2XSH-04Nov-08Nov-455 | RefundAdjustmentNotTaxed – CA – Manual order – refund_discrepancy | −35,00 $ |
| 2025-01-01 | A2XSH-01Jan-31Jan-763 | DiscountNotTaxed – CA – exchange | −1 291,85 $ |
| 2025-01-29 | A2XSH-29Jan-03Feb-147 | RefundAdjustmentNotTaxed – CA – Manual order – refund_discrepancy | −30,00 $ |
| 2025-02-01 | A2XSH-01Feb-28Feb-061 | DiscountNotTaxed – CA – exchange | −3 499,61 $ |
| 2025-03-01 | A2XSH-01Mar-31Mar-138 | DiscountNotTaxed – CA – exchange | −1 893,81 $ |
| 2025-04-01 | A2XSH-01Apr-30Apr-787 | DiscountNotTaxed – CA – exchange | −931,89 $ |
| 2025-05-01 | A2XSH-01May-31May-073 | DiscountNotTaxed – CA – exchange | −105,99 $ |
| 2025-08-01 | A2XSH-01Aug-31Aug-009 | DiscountNotTaxed – CA – exchange | −99,99 $ |
| | | **Total** | **−7 888,14 $** |

Il s'agit de rabais d'échange consentis à des clients **canadiens** (programme d'échange Rise),
qui venaient réduire les ventes américaines.

**Validation externe.** La correction rapproche les livres des données de Shopify, qui sont la
source primaire des ventes :

| | Avant correction | Après correction | Shopify Analytics |
| --- | ---: | ---: | ---: |
| Ventes É.-U. (hors pourboires) | 208 210,04 $ | **216 098,18 $** | 216 826,31 $ |
| Écart avec Shopify | 8 616,27 $ (3,97 %) | **728,13 $ (0,34 %)** | — |
| Remboursements É.-U. | 11 088,41 $ | **3 200,27 $** | 2 666,33 $ |

Avant correction, les livres montraient quatre fois plus de remboursements américains que
Shopify n'en enregistre. Après, les deux systèmes concordent à 0,34 % près.

**Portée de la correction.** Les quatre règles ont été corrigées à la source, donc les écritures
futures sont bonnes. La même erreur touche l'exercice 2026 pour **17 580,15 $** (dix lignes) —
elle y sera corrigée aussi, ce qui porte la part américaine de l'exercice 2026 de 8,04 % à
9,65 %. L'exercice 2024 n'est pas touché : le programme d'échange n'existait pas encore.

**Statut.** Le reclassement dans QuickBooks n'est pas encore passé : il touche un exercice clos.
À valider avec le comptable avant écriture, et les états financiers de l'exercice 2025 devront
présenter la ventilation corrigée pour concorder avec le présent dossier.

## 5. Rentabilité — exercice 2025

| | Montant |
| --- | ---: |
| Revenus | 879 125 $ |
| Coût des marchandises vendues | 237 004 $ |
| Marge brute (73,0 %) | 642 122 $ |
| Dépenses d'exploitation | 677 300 $ |
| Résultat d'exploitation | −35 178 $ |
| Autres revenus (subventions, remises) | +39 663 $ |
| **Bénéfice net** | **+4 204 $** |

Le critère de rentabilité porte sur le bénéfice net, qui est positif. L'exercice 2024 affichait
une perte de 18 401 $. EBITDA de l'exercice 2025 : environ 62 570 $.

## 6. Démonstration de l'impact tarifaire — point à clarifier avec la MRC

C'est le seul critère qui n'est pas acquis, et il faut le traiter de front plutôt que de le
laisser surgir à l'analyse.

**Les faits, qui sont solides :**

- Les ventes américaines ont chuté de **52 %** entre l'exercice 2025 (227 130 $) et
  l'exercice 2026 (105 043 $), après la suspension du traitement de minimis américain le
  29 août 2025, qui a soumis chaque colis de moins de 800 $ US au régime douanier complet.
- Le creux est net dans le mensuel : 43 230 $ de ventes américaines en mai 2025 contre 4 674 $
  en mai 2026.
- Depuis le **22 août 2026**, les tarifs de l'article 338 imposent **50 % sur les textiles**,
  sans égard à la conformité à l'ACEUM. Les tuques, cache-cous, mitaines, sacs à lunch et
  coussins de Lasclay sont directement visés. L'effet complet n'est pas encore aux livres.

**La difficulté :** le critère demande une baisse d'au moins 20 % du chiffre d'affaires **de
l'entreprise**, pas du marché américain. Le chiffre d'affaires total est en hausse, parce que la
croissance canadienne a compensé la perte américaine. Et comme les États-Unis représentent
environ 10 % des revenus de l'exercice 2026, même leur disparition complète ne produit pas
mécaniquement une baisse de 20 % du total.

**Ce qu'il faut pour fermer le critère**, l'un ou l'autre :

1. Une projection de l'exercice 2027, préparée avec le comptable, montrant une réduction d'au
   moins 20 % du chiffre d'affaires prévisionnel attribuable aux tarifs — ce qui suppose de
   documenter les effets au-delà de la seule perte des ventes directes aux États-Unis
   (renchérissement des intrants, perte de volume de production et effet sur les coûts
   unitaires, contrats corporatifs liés à des clients exportateurs).
2. Une confirmation écrite de la MRC sur la lecture qu'elle retient du critère, comme celle déjà
   obtenue pour la période de référence des 25 %.

À poser au guichet avant le dépôt.

## 7. Besoins de liquidités et montant demandé

L'aide correspond à 75 % des besoins de liquidités sur douze mois, jusqu'à 150 000 $. Le montant
demandé reste à établir avec le comptable à partir des prévisions de l'exercice 2027. Points
d'appui tirés des livres de l'exercice 2026 :

| | Montant |
| --- | ---: |
| Flux de trésorerie d'exploitation | −131 837 $ |
| Activités de placement | −5 029 $ |
| Activités de financement | +127 103 $ |
| Variation nette de l'encaisse | −9 764 $ |
| Encaisse au 28 août 2026 | −4 840 $ |
| Intérêts payés (exercice 2026) | 53 186 $ |

Structure d'endettement au 28 août 2026 : marges et cartes 159 440 $, prêts bancaires 130 914 $
(Desjardins AccordD, BDC), prêts privés et corporatifs 300 730 $ (Merchant Growth, Shopify
Capital), prêt de l'actionnaire 91 478 $. Passif total 726 705 $, capitaux propres −303 716 $.

Le montant maximal de 150 000 $ correspondrait à un besoin de liquidités de 200 000 $ sur douze
mois — un ordre de grandeur cohérent avec le déficit d'exploitation et le service de la dette de
l'exercice courant, mais qui doit être appuyé par une prévision détaillée, pas par une
extrapolation.

## 8. Plan d'adaptation — esquisse

À déposer dans les douze mois suivant l'octroi. Axes déjà engagés :

- **Diversification des marchés hors États-Unis** : consolidation du marché canadien, qui a
  absorbé la perte américaine, et évaluation des marchés européens.
- **Pivot manufacturier** : internalisation de la production (107 762 $ de salaires de production
  et 92 252 $ de sous-traitance couture à l'exercice 2025, 187 759 $ de sous-traitance à
  l'exercice 2026), qui réduit la dépendance aux chaînes d'approvisionnement exposées aux tarifs.
- **Développement de produits** : 51 889 $ en recherche et développement à l'exercice 2025,
  128 092 $ à l'exercice 2026.
- **Productivité et compétitivité** : révision du coût de revient et des canaux d'acquisition,
  la publicité numérique représentant 28 % du chiffre d'affaires.

## 9. Pièces à joindre

- États financiers des exercices 2024 et 2025, avec ventilation des revenus par marché
- Grand livre des comptes 4030, 4033, 4060 et 4013 pour l'exercice 2025, à l'appui de la
  correction de la section 4
- Rapport Shopify des ventes par pays pour l'exercice 2025 (validation externe de la part
  américaine)
- Rapport Shopify mensuel des ventes américaines, exercices 2025 et 2026, à l'appui de la
  baisse de 52 %
- Attestation du REQ
- Prévisions de l'exercice 2027 et calcul du besoin de liquidités
- Attestation de conformité fiscale (Revenu Québec)

## 10. Écriture de correction proposée — non passée

À valider avec le comptable avant d'être portée aux livres, l'exercice étant clos.

```
Date : 2025-08-31
Écriture de journal — Reclassement des rabais d'échange canadiens
mal dirigés vers le compte de remboursements américain (règles de
mappage A2X « DiscountNotTaxed / CA / exchange » et
« RefundAdjustmentNotTaxed – refund_discrepancy / CA / manual »)

  Débit   4033 Remboursements Shopify USA        7 888,14 $
  Crédit  4013 Remboursements Shopify Canada     7 888,14 $
```

Effet : aucun sur le chiffre d'affaires total, le bénéfice ou le bilan. Les ventes américaines
passent de 212 135,35 $ à 220 023,49 $ et les ventes canadiennes de 624 788,48 $ à 616 900,34 $.

Une écriture équivalente de 17 580,15 $ est à passer pour l'exercice 2026, qui n'est pas encore
clos.
