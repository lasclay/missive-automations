# Écriture mensuelle des taxes Shopify

Une écriture par mois, `AAAA-MM Taxes`, datée au dernier jour du mois. Elle transfère les
taxes perçues par Shopify du compte de collecte vers les comptes de taxes à payer, par
juridiction.

Série vérifiée : 2025-09 à 2026-07. **Il manque `2026-03 Taxes`** — à retracer.

## La source

Rapport Shopify **Taxes**, sous Analytics → Reports. L'ancienne URL
`/reports/finances/taxes` renvoie un 404 depuis 2026, la bonne est
`/store/lasclay/analytics/reports/taxes`.

Requête ShopifyQL à utiliser, en remplaçant les dates :

```
FROM sales_taxes
SHOW sales_taxes
GROUP BY sales_channel, tax_country, tax_region, tax_name, tax_rate
WITH TOTALS
SINCE 2026-07-01 UNTIL 2026-07-31
ORDER BY sales_channel ASC, tax_country ASC, tax_region ASC, tax_name ASC
VISUALIZE sales_taxes TYPE table
```

Elle se passe en clair dans le paramètre `ql` de l'URL du rapport, ce qui donne une page
prête à capturer pour la pièce jointe. Le connecteur Shopify MCP accepte la même requête via
`run-analytics-query` et renvoie les chiffres en JSON : utiliser les deux, l'un pour les
montants, l'autre pour la pièce.

## La règle de périmètre

**Toutes les taxes canadiennes, tous canaux de vente confondus. Les taxes américaines sont
exclues.**

Confirmée en refaisant juin (1 109,27) et mai (11 266,97) au cent près à partir de Shopify. Les canaux comptent tous : Online Store, Draft Orders, Point of Sale, Shop,
Shopify Claude Connector App.

Deux anomalies connues dans les données Shopify, sans effet sur les totaux :

- le pays revient parfois comme `CA` au lieu de `Canada` pour les ventes en point de vente ;
- l'écriture de mai 2026 a laissé de côté le canal « Shopify Mobile for iPhone » (4,10 de TPS
  et 8,20 de TVQ). Cette écriture est courte de 12,30.

**Conséquence à surveiller** : comme les taxes américaines sont perçues par Shopify mais
exclues des écritures, le compte 2121 Shopify Sales Tax Collected garde un résidu qui ne se
solde jamais. 8,79 en juin, 2,35 en mai. À vider un jour.

## La forme de l'écriture

Une ligne de débit au compte de collecte pour le total, puis une ligne par juridiction. Le
gabarit liste **toutes** les provinces, y compris celles à zéro, dans cet ordre :

| # | Description | Compte | TaxRateRef |
|---|---|---|---|
| 1 | *(aucune)* | 132 — 2121 Shopify Sales Tax Collected | *(aucun)* |
| 2 | GST - ALBERTA | 16 | 7 |
| 3 | GST - BRITISH COLUMBIA | 16 | 7 |
| 4 | PST - BRITISH COLUMBIA | 242 | 61 |
| 5 | GST - MANITOBA | 16 | 7 |
| 6 | PST - MANITOBA | 239 | 48 |
| 7 | HST - NEW BRUNSWICK | 16 | 29 |
| 8 | HST - NEWFOUNDLAND & LABRADOR | 16 | 33 |
| 9 | GST - NORTHWEST TERRITORIES | 16 | 7 |
| 10 | HST - NOVA SCOTIA | 16 | 39 |
| 11 | HST - ONTARIO | 16 | 25 |
| 12 | HST - PRINCE EDWARD ISLAND | 16 | 37 |
| 13 | GST - QUEBEC | 16 | 7 |
| 14 | QST - QUEBEC | 16 | 21 |
| 15 | GST - SASKATCHEWAN | 16 | 7 |
| 16 | PST - SASKATCHEWAN | 236 | 46 |

Le compte de collecte est au débit. Les juridictions positives sont au **crédit**. Une
juridiction négative (remboursements du mois supérieurs aux ventes) passe au **débit** :
c'est arrivé en juillet 2026 pour la Colombie-Britannique. Les lignes à zéro restent au
débit, comme dans le gabarit.

## Le piège qui a coûté une reprise

Chaque ligne de taxe **doit** porter, dans `JournalEntryLineDetail` :

```javascript
TaxRateRef: { value: '<voir table>' },
TaxApplicableOn: 'Purchase',
TaxAmount: <même montant que la ligne>
```

Sans ça, l'écriture s'enregistre, se balance dans les livres, mais :

- la grille QBO affiche **Total CAD 0,00 $** au lieu du total réel ;
- la colonne « Taxe de vente » reste vide ;
- **les montants n'alimentent pas les lignes de la déclaration** (Ligne 103, Ligne 203).

Le `TaxApplicableOn: 'Purchase'` est contre-intuitif pour de la taxe sur les ventes, mais
c'est ce que QBO stocke : les écritures antérieures le portent toutes.

## Contrôle avant d'écrire

```
somme des débits = somme des crédits
total du rapport Shopify (canadien) = ligne 1
```

Sur juillet 2026 : débit 309,95 au compte de collecte + 1,20 + 1,68 aux lignes négatives =
312,83, crédits 8,54 + 81,64 + 74,32 + 148,33 = 312,83.

## La pièce jointe

Gabriel veut le rapport de taxes attaché à l'écriture. Capturer la page du rapport Shopify
avec la bonne période affichée, puis la téléverser dans le champ « Pièces jointes » de
l'écriture dans QBO.

**Rattacher en dernier.** Une modification par l'action `update` du proxy efface le lien vers
les pièces jointes : le fichier survit dans le dossier, mais l'écriture ne le montre plus.

## Le mémo

Reprendre celui des mois antérieurs, en ajoutant le contexte de la période :

```
Le formulaire des taxes Shopify se trouve ici: https://admin.shopify.com/store/lasclay/reports/finances/taxes
```
