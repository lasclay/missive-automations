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
node a2x/a2x.js check                       # audite les mappings
node a2x/tools/selftest.js                  # rejoue l'écriture A2X de référence (hors-ligne)
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

## Limites connues

* **Shopify Payments seulement.** Les commandes payées par PayPal, carte-cadeau ou paiement
  manuel n'apparaissent pas dans les versements Shopify Payments et ne sont donc pas
  comptabilisées ici — A2X ne les traitait pas non plus dans ces écritures. Les mappings
  correspondants (`Gateway Transactions`, `Pending Payments`) sont conservés dans le fichier
  pour le jour où on ajoutera ce volet.
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
  lib/journal.js            assemblage de l'écriture QBO
  lib/qbo.js                client du finance-proxy
  tools/import_mappings.js  TSV → JSON + validation contre QBO
  tools/selftest.js         comparaison à l'écriture A2X de référence
a2x-app/
  server.js                 API + service de la page
  public/index.html         l'interface
```
