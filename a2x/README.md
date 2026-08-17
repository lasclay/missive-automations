# Remplacement maison d'A2X — Shopify Payments → QuickBooks Online

Reprend le travail d'A2X sans abonnement : pour chaque **versement** (payout) Shopify Payments,
l'outil ventile les commandes réglées en composantes comptables (ventes, rabais, livraison,
taxes, pourboires, remboursements, frais Shopify), les mappe aux comptes du plan comptable et
publie **une écriture de journal** dans QuickBooks.

L'écriture produite est **identique à celle d'A2X** — mêmes libellés de ligne, mêmes comptes,
même code de taxe, même ligne de contrepartie. Seul le préfixe du `DocNumber` change
(`CLONE-` au lieu de `A2XSH-`), délibérément, pour distinguer nos écritures des siennes.
Vérifié ligne par ligne contre la pièce QBO `11170` (`A2XSH-21Jul-27Jul-592`) :
`node a2x/tools/selftest.js`.

Deux façons de s'en servir :

| | |
|---|---|
| **Interface web** | `a2x-app/` — voir les versements, prévisualiser l'écriture, la publier, éditer les mappings |
| **Ligne de commande** | `a2x/a2x.js` — même moteur, pour le cron et les vérifications |

---

## Coûts

Zéro abonnement. Le service web tient sur un **Render free** (il s'endort après 15 min
d'inactivité, il se réveille en ~30 s au premier chargement) et le cron de publication est un
**Render Cron Job** gratuit. Aucune dépendance npm : uniquement Node ≥ 18.

---

## Mise en place

### 1. Portées Shopify

Sur l'app **« Render connector »** (Dev Dashboard, celle déjà utilisée par `support.js`),
ajouter aux portées existantes :

```
read_shopify_payments_payouts, read_shopify_payments_accounts, read_locations
```

Puis **Release** une nouvelle version — l'app est déjà installée sur la boutique.
Sans ces portées, la liste des versements renvoie
« Access denied for shopifyPaymentsAccount field ».

### 2. Variables d'environnement

| Variable | Rôle |
|---|---|
| `SHOPIFY_STORE` | `lasclay.myshopify.com` |
| `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` | app « Render connector » (client credentials) |
| `SHOPIFY_API_VERSION` | facultatif, défaut `2025-07` |
| `FINANCE_PROXY_URL` / `FINANCE_PROXY_SECRET` | le finance-proxy (QuickBooks) |
| `A2X_APP_SECRET` | mot de passe de l'interface web — **à définir**, sinon elle est ouverte |
| `GITHUB_TOKEN` / `GITHUB_REPO` | facultatif : versionne `mappings.tsv` à chaque sauvegarde depuis l'interface |

> Le disque de Render est éphémère. Sans `GITHUB_TOKEN`, une modification de mapping faite dans
> l'interface est perdue au prochain déploiement. Avec le jeton, elle est commitée dans le dépôt.

### 3. Déployer l'interface (Render Web Service, plan Free)

* Repo `lasclay/missive-automations`, branche `main`
* **Root Directory** : vide (racine) · **Build** : `npm install` (ou vide) · **Start** : `node a2x-app/server.js`
* Variables : celles du tableau ci-dessus

### 4. Déployer la publication automatique (Render Cron Job, optionnel)

* **Command** : `node a2x/a2x.js sync --since $(date -d '30 days ago' +%F)`
* **Schedule** : `0 13 * * *` (une fois par jour)
* `sync` est **idempotent** : il saute tout versement déjà couvert par une écriture dans QBO —
  y compris celles publiées par A2X (voir « Détection des doublons »). On peut donc faire tourner
  les deux en parallèle le temps de la transition, sans doublon. L'inverse n'est pas vrai : A2X
  ignore nos écritures et republiera les siennes.

---

## Ligne de commande

```bash
node a2x/a2x.js payouts --limit 20          # les derniers versements + leur état
node a2x/a2x.js preview 592                 # l'écriture, sans rien publier
node a2x/a2x.js post 592                    # publie dans QuickBooks
node a2x/a2x.js sync --since 2026-07-01 --dry-run
node a2x/a2x.js monthly 2026-07             # l'écriture mensuelle hors Shopify Payments
node a2x/a2x.js monthly 2026-07 --post      # …et sa publication
node a2x/a2x.js check                       # audite les mappings
node a2x/tools/selftest.js                  # rejoue l'écriture A2X de référence (hors-ligne)
node a2x/tools/monthly_test.js              # rejoue les 4 cas de l'écriture mensuelle (hors-ligne)
```

---

## Les mappings

`mappings.tsv` est la **source de vérité**, éditable à la main ou depuis l'interface. C'est la
reprise fidèle des 349 lignes exportées d'A2X (« Showing 1 to 349 of 349 entries »).

```
categorie <TAB> details <TAB> pays <TAB> marketplace <TAB> compte <TAB> taxe
Sales	ProductSales	CA-QC	online	4011	detaxe
```

| Colonne | Valeurs |
|---|---|
| `details` | le type A2X (`ProductSales`, `Discount`, `ShopifyFee`…) — `*` = règle d'automapping de la catégorie |
| `pays` | `CA`, `CA-QC`, `US`, `US-NY`, `EU`, `-` (indifférent) |
| `marketplace` | `online`, `manual`, `pos:<locationId>`, `exchange`, `edit`, un id d'app (`3890849`), `-` |
| `compte` | le **numéro** de compte QBO (`4011`) — l'`Id` interne est résolu automatiquement |
| `taxe` | `detaxe` = « Détaxé on Sales », vide = aucun code de taxe |

Après une édition manuelle :

```bash
node a2x/tools/import_mappings.js     # régénère mappings.json et valide les comptes contre QBO
```

**Résolution.** Comme A2X, du plus précis au plus général :
`ProductSales/CA-QC/online` → `ProductSales/CA/online` → `ProductSales/CA-QC/*` →
`ProductSales/CA/*` → `ProductSales/*/online` → `ProductSales/*/*` → règle d'automapping de la
catégorie. Une composante qui n'atterrit nulle part **bloque la publication** et apparaît en
avertissement dans l'interface — jamais de montant silencieusement perdu.

### Mappings hérités d'A2X qui méritent un coup d'œil

`node a2x/a2x.js check` signale 13 lignes reprises telles quelles d'A2X où un compte de
**produits** sert de compte de règlement (par ex. `Sale Gateway manual → 4011 Ventes`,
`Refund Gateway shopify_payments → 4033 Remboursements USA`). Elles sont conservées à
l'identique pour ne rien changer au comportement actuel, mais elles ressemblent à des réglages
laissés par défaut dans A2X plutôt qu'à un choix comptable. À revoir avec la comptable.

---

## Comment l'écriture est construite

1. **Le versement** (`ShopifyPaymentsPayout`) donne la période et le net déposé.
2. **Les transactions de solde** du versement (`balanceTransactions`) donnent, ligne par ligne,
   la commande réglée, le brut, les frais et le net.
3. **Chaque commande** est ventilée (`lib/breakdown.js`) :

   | Composante | Source Shopify |
   |---|---|
   | `ProductSales` / `ProductSalesNotTaxed` | `lineItems.originalTotal` (avant rabais) |
   | `Discount` / `DiscountNotTaxed` | `lineItems.totalDiscount`, en négatif |
   | `Shipping` / `ShippingNotTaxed` | `shippingLines.originalPrice` |
   | `ShippingDiscountNotTaxed` | écart `discountedPrice − originalPrice` |
   | `Tax`, `ShippingTax` | les `taxLines` respectives |
   | `Tip` | `totalTipReceived` |
   | `GiftCardSaleLiability` | articles dont le produit est une carte-cadeau |
   | `Refund*`, `Return*` | les `refunds` de la commande |
   | `ShopifyFee` | le `fee` de la transaction de solde |

   Le suffixe `NotTaxed` suit A2X : il s'applique quand la composante ne porte aucune taxe.
4. **Chaque composante est mappée** vers un compte, puis les composantes identiques sont
   regroupées en une ligne par (compte + libellé).
5. **La contrepartie** est le net réellement déposé, au débit du compte de règlement
   (`config.json` → `settlementAccountId`, par défaut `13 — Compte chèques CAD`, celui qu'A2X
   utilisait). Tout reliquat d'arrondi ou de conversion va au `9100 — Perte ou gain relié au
   taux de change`, comme dans le mapping `CurrencyConversionRounding USD-CAD` d'A2X.

**Montants en cents.** Toute l'arithmétique est en entiers, jamais en flottants ; la répartition
au prorata (commande à cheval sur deux versements, capture partielle) place le reliquat sur la
plus grosse composante pour que l'écriture tombe toujours juste au cent près.

---

## L'écriture mensuelle — hors Shopify Payments

Tout ne passe pas par un versement : PayPal, cartes-cadeaux, commandes manuelles, échanges.
A2X en faisait **une écriture par mois**, datée du 1er, en plus des écritures de versement :

```
A2XSH-01May-01Jun-418   TxnDate 2026-05-01
  CT 12248.92  ProductSales  - CA - Online store              125
  DT  2215.54  Discount  - CA - Online store                  127
  CT  1502.69  Tax  - CA - Online store                       132
  DT 13627.48  Sale Gateway paypal - Online store              25   ← la contrepartie
```

Onglet **Mensuel** de l'interface, ou `node a2x/a2x.js monthly 2026-07 [--post]`.

### La règle, en une ligne

```
PendingPayment = encaissé hors Shopify Payments − revenu reconnu
```

Elle couvre les trois situations réelles, relevées sur les écritures d'A2X :

| Situation | Revenu reconnu ici | Contrepartie |
| --- | --- | --- |
| Commande payée en PayPal (pièce 10835) | oui, en entier | `Sale Gateway paypal` au débit |
| Commande manuelle facturée, pas payée (pièce 10837) | oui, en entier | `PendingPayment` au **débit** — c'est la créance |
| Encaissement sur une commande déjà réglée par Shopify Payments (pièce 10836) | **non** | `PendingPayment` au **crédit** |

### Le garde-fou contre le double comptage

Une commande qui **touche** Shopify Payments — même par une transaction encore en attente — n'est
jamais reconnue ici : son écriture de versement la reconnaît en entier et reprend au passage ce qui
dormait en paiement en attente (`add("Pending Payments", …, -already)` dans `lib/journal.js`).
L'écriture mensuelle ne fait alors qu'enregistrer l'encaissement contre le compte d'attente.

### Ce qui est balayé

Les commandes **traitées** dans le mois, plus celles simplement **modifiées** dans le mois — sans
quoi un remboursement de juillet sur une commande de juin n'apparaîtrait nulle part.

### Les descriptions

Les lignes de passerelle n'ont **pas de pays** : `Sale Gateway paypal - Online store`, alors que les
lignes de revenu en ont un : `ProductSales  - CA - Online store` (deux espaces — le champ passerelle
est vide). C'est la convention d'A2X, et ses 20 règles de passerelle ont toutes la colonne pays à `-`.
Un règlement PayPal n'appartient à aucun territoire de vente ; une charge de change, si
(`ForeignCurrencyGainLoss Gateway paypal - US - Online store`).

### Doublons

Ces écritures n'ont **pas** de ligne « Balance of settlement » — c'est leur signature, et c'est ce qui
les tient à l'écart de l'appariement des versements. On reconnaît celles d'A2X à leur date (le 1er du
mois) et à un `DocNumber` dont la période commence au 1er ; les nôtres, à leur note privée. A2X en
publiait **plusieurs par mois** (5 en mai 2026, un lot à chaque traitement) : l'interface les liste
toutes, et une seule suffit à bloquer une publication en double.

Nos écritures mensuelles portent le suffixe `M` + année : `CLONE-01Jul-01Aug-M26`.

---

## Détection des doublons

Nos écritures portent le préfixe **`CLONE`**, celles d'A2X `A2XSH` — même structure, distinction
immédiate à l'œil et filtrable dans QuickBooks :

```
CLONE-24Jul-29Jul-314     les nôtres
A2XSH-24Jul-29Jul-314     celles d'A2X
```

QuickBooks limite le `DocNumber` à **21 caractères**, d'où un préfixe de 5 lettres (`CLONE-24Jul-29Jul-314`
en fait exactement 21). Le préfixe se change dans `config.json` ; `legacyDocNumberPrefixes` liste
ceux qu'on continue de reconnaître pour la détection de doublons.

Le `DocNumber` d'A2X se termine par trois chiffres (`A2XSH-21Jul-27Jul-**592**`) qui sont un
**compteur interne à A2X** : ils ne se déduisent pas de l'id du versement Shopify
(`141882065115`). Impossible donc de reproduire le `DocNumber` d'A2X à l'identique, et surtout
impossible d'apparier dessus — c'est ce que faisait la première version, ce qui donnait à la
fois des faux positifs (collisions entre périodes sans rapport, sur trois chiffres) et des faux
négatifs (un versement déjà comptabilisé par A2X présenté comme à faire, ce qui invite au
doublon).

`lib/posted.js` apparie donc sur ce qui est vérifiable, dans cet ordre :

1. **id du versement** — nos propres écritures le portent en `PrivateNote` : certitude
2. **période + montant** — même préfixe de `DocNumber` (`A2XSH-21Jul-27Jul-`) et même net déposé
3. **montant** — même net déposé, dans une fenêtre de 21 jours avant l'émission du versement

**Le montant doit toujours concorder.** Une première version acceptait la période seule : elle
désignait alors une écriture sans rapport, puisqu'A2X produit plusieurs journaux sur des dates
qui se chevauchent (`A2XSH-24Jul-28Jul-200` et `A2XSH-24Jul-29Jul-314` par exemple). Le montant
est un critère sûr — sur les 320 écritures de règlement existantes, les 320 montants sont
distincts. Les écritures de même période mais d'un autre montant sont affichées séparément,
comme contexte, jamais comme correspondance.

Les journaux **mensuels** d'A2X (`A2XSH-01Jun-01Jul-469`, pour les paiements hors Shopify
Payments) n'ont pas de ligne « Balance of settlement » : ils sont exclus de l'appariement, sans
quoi ils absorberaient un versement à tort.

La liste des versements, elle, n'apparie que par montant — connaître la période d'un versement
suppose de charger ses transactions de solde, trop coûteux pour une liste. L'appariement fin se
fait à l'ouverture du versement.

## Données brutes, comme A2X

```bash
node a2x/a2x.js raw <payoutId> > donnees.csv
```

Dans l'interface, le bouton **Données brutes (CSV)** de l'aperçu produit le même fichier. Colonnes
et tri identiques au « download the raw data » d'A2X — une ligne par article et par type, triée
par type, frais Shopify en dernier — pour comparer les deux fichiers directement :

```bash
diff a2x/reference/a2x-2026-07-14_16.csv donnees.csv
```

Quatre exports d'A2X sont conservés dans `a2x/reference/` et servent de test :

```bash
node a2x/tools/csv_test.js
```

Il compare, **commande par commande**, le type et le montant de chaque composante, la granularité
(nombre de lignes par type) et le libellé de pays. Huit commandes réelles, zéro écart. Le fichier
produit pour le versement du 14 au 17 juillet est **identique octet pour octet** à celui d'A2X.

## Audit contre les écritures réelles d'A2X

```bash
node a2x/tools/audit_a2x.js [--limit 400] [--verbose]
```

Chaque ligne d'écriture A2X porte son libellé d'origine
(`ProductSales  - CA - Online store`) et le compte qu'A2X a choisi. L'audit réinjecte ce libellé
dans le moteur de mappage et compare le compte et le code de taxe obtenus. C'est la seule façon
de valider le mappage sur des milliers de cas réels sans accès aux versements Shopify.

Résultat au 17 août 2026, sur **400 écritures A2X / 5 682 lignes comparables** :

| | |
|---|---|
| Comptes identiques | **5 679 (99,95 %)** |
| Codes de taxe identiques | **5 678 (99,93 %)** |
| Combinaisons distinctes rencontrées | 175 |

Les 7 lignes en écart sont documentées ci-dessous. L'audit ne valide pas les **montants**, qui
viennent des versements Shopify.

### Les écarts, un par un

**3 lignes — `PendingPayment` en `exchange` et en `Manual order`.** A2X se contredit lui-même :
sa table contient à la fois une règle générique (`PendingPayment / CA / exchange → 1110`) et une
règle composée (`PendingPayment - CA - exchange → 4013`). Il a appliqué la composée d'avril 2025 à
avril 2026 (9 lignes), puis la générique en mai et juin 2026 (3 lignes). On suit la **composée**,
comme le dit la table : c'est son comportement sur la très grande majorité des lignes, et ça fait
passer l'accord de 99,79 % à 99,95 %. Ces lignes n'apparaissent que dans les journaux **mensuels**,
que ce moteur produit désormais — **à trancher avec la comptable** si les 3 lignes récentes
comptent plus que les 9 anciennes.

**4 lignes — code de taxe sur `ForeignCurrencyGainLoss - refund_discrepancy`.** Dérive
historique : les 4 lignes sans code datent de mars à mai 2025 ; les 12 lignes suivantes, à partir
de juin 2025, portent bien « Détaxé on Sales ». Notre comportement suit la table actuelle.

**5 lignes — `ShopifyCashRounding Gateway cash`.** Type absent de la table de mappings d'A2X ; il
l'a imputé au `4011` via sa règle d'automapping (montants de 0,01 à 0,02 $, arrondis de caisse au
point de vente).

**12 lignes — écritures de prêt ajoutées à la main.** Les pièces `10650`, `10461`, `10190` et
`9735` sont des écritures A2X dans lesquelles quelqu'un a ajouté trois lignes de prêt BDC 10K
(57,70 $ d'intérêt au débit, 57,70 $ de déboursé au crédit). Ce ne sont pas des lignes A2X. À
savoir : si l'une de ces écritures était un jour republiée, ces ajouts manuels seraient perdus.

## Limites connues

* **Écritures mensuelles : le mois doit être fini.** L'écriture hors Shopify Payments couvre un
  mois entier ; la calculer en cours de mois donne un résultat partiel qu'il faudrait republier.
  À lancer une fois le mois clos, comme le faisait A2X.
* **Coût des marchandises vendues.** A2X proposait un calcul de COGS ; il n'était pas activé
  (« Your current A2X plan supports cost of goods sold. You can enable it… »), donc rien n'est
  repris ici.
* **Devises.** Tous les montants sont pris en devise de la boutique (`shopMoney`, CAD) ; l'écart
  de conversion sur les commandes en USD tombe au `9100`, comme chez A2X.

---

## Fichiers

```
a2x/
  a2x.js                    CLI
  config.json               compte de règlement, compte d'arrondi, préfixe de DocNumber
  mappings.tsv              les 349 mappings (source de vérité)
  mappings.json             index généré (ne pas éditer)
  lib/shopify.js            client Admin GraphQL (client credentials + backoff)
  lib/payouts.js            versements et transactions de solde
  lib/orders.js             commandes complètes
  lib/breakdown.js          ventilation d'une commande en composantes
  lib/mapper.js             résolution composante → compte
  lib/journal.js            assemblage de l'écriture QBO (partagé versement / mensuel)
  lib/monthly.js            écriture mensuelle hors Shopify Payments
  lib/posted.js             détection des doublons, versements et mensuels
  lib/qbo.js                client du finance-proxy
  tools/import_mappings.js  TSV → JSON + validation contre QBO
  tools/selftest.js         comparaison à l'écriture A2X de référence
  tools/monthly_test.js     les 4 cas de l'écriture mensuelle, sur commandes fabriquées
  tools/audit_a2x.js        mappage comparé aux 5682 lignes réelles d'A2X
a2x-app/
  server.js                 API + service de la page
  public/index.html         l'interface
```
