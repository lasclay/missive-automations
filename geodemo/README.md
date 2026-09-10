# geodemo — profil géodémographique de la clientèle

Trois scripts qui répondent à : *qui achète chez Lasclay, où, et est-ce que le
revenu du quartier y change quelque chose ?* Aucune donnée nominative n'est
conservée : les fichiers de `sortie/` sont des agrégats (prénom, municipalité,
RTA), jamais des lignes client.

## 1. Extraire les clients de Shopify

Le filtre `number_of_orders:>0` **n'est pas appliqué** par l'API dans une
opération en lot — il faut écarter les fiches sans commande côté script, ce que
`prenoms_regions.js` fait déjà. Sur l'extraction de septembre 2026 : 85 964
fiches, dont 46 201 sans aucune commande.

```graphql
mutation {
  bulkOperationRunQuery(query: """
    { customers(query: "number_of_orders:>0") { edges { node {
        id firstName numberOfOrders amountSpent { amount } createdAt
        defaultAddress { city province provinceCode zip countryCodeV2 }
    } } } }
  """) { bulkOperation { id status } userErrors { field message } }
}
```

Puis interroger `{ currentBulkOperation { status url } }` et télécharger le JSONL.

## 2. Prénoms et intensité d'achat par région

```bash
node geodemo/prenoms_regions.js customers.jsonl geodemo/sortie
```

Produit `analyse.json`, `prenoms.tsv`, `municipalites.tsv`, `rta.tsv`.
Les prénoms sont regroupés sans égard aux accents (« Genevieve » et
« Geneviève » comptent ensemble) et affichés dans leur graphie la plus
fréquente ; les valeurs qui ne sont pas des prénoms (courriels, chiffres,
initiales seules) sont écartées.

## 3. Croisement avec Statistique Canada

Deux fichiers publics, aucune clé requise.

**Par RTA** (les trois premiers caractères du code postal) — profil du
Recensement de 2021, 98-401-X2021013 :

```bash
curl -o fsa.zip "https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/details/download-telecharger/comp/GetFile.cfm?Lang=F&FILETYPE=CSV&GEONO=013"
unzip -p fsa.zip 98-401-X2021013_Francais_CSV_data.csv | iconv -f ISO-8859-1 -t UTF-8 \
  | grep -F -e ',1,"Population, 2021"' \
            -e ',50,"Total - Ménages privés selon la taille du ménage' \
            -e ',243,"  Revenu total médian des ménages en 2020 ($)"' \
            -e ',244,"  Revenu après impôt médian des ménages en 2020 ($)"' \
  > fsa_income_raw.csv

node geodemo/croisement_revenus.js geodemo/sortie/analyse.json fsa_income_raw.csv geodemo/sortie
```

Le CSV décompressé fait 684 Mo et est encodé en ISO-8859-1 : il faut le
filtrer au vol, ne pas l'écrire sur disque.

**Par municipalité** — tableau 98-10-0060-01 :

```bash
curl -o sdr.zip https://www150.statcan.gc.ca/n1/tbl/csv/98100060-fra.zip && unzip sdr.zip
awk -F';' 'NR==1 || $6 ~ /\.1\.1$/' 98100060.csv > income_totals.csv
node geodemo/revenus_municipalites.js geodemo/sortie/analyse.json income_totals.csv geodemo/sortie
```

## Ce que l'analyse a donné (septembre 2026)

- 39 763 acheteurs, 50 056 commandes, 3,53 M$ à vie. Le Québec pèse 64 % des
  clients et 68 % des commandes, avec un taux de réachat de 21,5 % contre
  11–14 % partout ailleurs au pays.
- Les dix prénoms les plus fréquents sont tous féminins : Julie, Sylvie,
  Isabelle, Geneviève, Nathalie, Catherine, Diane, Louise, Caroline, Hélène.
- **Le revenu du quartier n'explique à peu près rien** : corrélation de
  Spearman de 0,10 entre le revenu médian des ménages et la pénétration, sur
  les 413 RTA québécoises. La corrélation négative apparente à l'échelle du
  Canada (−0,19) n'est qu'un effet de composition — le Québec a des revenus
  plus bas que le reste du pays et c'est là que Lasclay vend.
- Ce qui ressort plutôt, ce sont les municipalités de plein air : Sutton,
  Val-David, Orford, Bromont, Lac-Beauport, Chelsea, Cantley, Prévost,
  Stoneham. Elles achètent 3 à 5 fois plus par ménage que la moyenne, et se
  trouvent effectivement plus riches que la moyenne (99 000 $ contre 78 500 $),
  mais le revenu y est un symptôme du profil « villégiature et plein air »,
  pas la cause de l'achat.

## Limites connues

- `defaultAddress` est l'adresse par défaut du compte client, pas l'adresse de
  livraison de chaque commande.
- Les arrondissements (Verdun, Lachine, LaSalle, Chicoutimi, Jonquière,
  Saint-Hubert) n'ont pas d'équivalent au niveau des subdivisions de
  recensement : leurs commandes n'entrent pas dans la ligne de la ville qui les
  contient, ce qui sous-estime Montréal, Saguenay et Longueuil.
- Les revenus du Recensement de 2021 portent sur l'année 2020.
- Homonymes de municipalités : la plus peuplée est retenue, et la ligne est
  marquée `homonymeIncertain` dans le JSON quand le doute est réel.
