---
name: qbo
description: QuickBooks Online d'Unique Plastique via le Finance Proxy, service Render séparé des opérations pour isoler les finances. Couvre les rapports (P&L, bilan, balance de vérification, grand livre, flux de trésorerie, âge des comptes), les requêtes SQL-like v3, la lecture et l'écriture d'entités de tenue de livres, le téléchargement de pièces jointes, et la rotation du jeton Intuit.
when_to_use: Déclenche dès qu'il est question de QuickBooks, QBO, du proxy finance, d'un état financier, d'un compte de charge, d'une facture fournisseur, d'un rapprochement bancaire, d'une écriture comptable ou de chiffres comptables. Déclenche même sans le mot QuickBooks — « sors-moi le P&L du dernier trimestre », « est-ce que cette dépense est classée », « publie cette facture », « c'est quoi nos marges ce mois-ci », « QuickBooks est déconnecté ».
argument-hint: [ce que tu veux consulter ou publier dans QBO]
allowed-tools:
  - Bash(node clients/finance_client.js:*)
  - Bash(node clients/qbo_check.js:*)
  - Bash(node clients/qbo_auth.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# QuickBooks Online — Finance Proxy Unique Plastique

N'explore pas le dépôt pour retrouver comment joindre QBO : tout est ci-dessous.

## Prérequis — à vérifier en premier

Service Render **dédié**, distinct du proxy des opérations, précisément pour isoler les finances :
les secrets Intuit ne cohabitent avec aucun autre connecteur. Code dans `finance-proxy/server.js`.
Le client est un script du dépôt, non déployé.

| Variable | Rôle |
| --- | --- |
| `FINANCE_PROXY_SECRET` | requis — **distinct** du `GENERAL_PROXY_SECRET`, aucun repli |
| `FINANCE_PROXY_URL` | requis, `https://<a-remplir>.onrender.com` |

Ce secret n'est jamais donné aux environnements opérationnels (crons d'expédition, scripts de
support) : c'est tout le point de l'isolation. Une fuite de leur environnement n'expose pas la
comptabilité. Si le répertoire courant n'est pas le dépôt, vérifie avec
`ls clients/finance_client.js` et signale-le plutôt que de reconstruire un appel à la main.

Commence par le test d'authentification, qui valide aussi le refresh token Intuit :

```bash
node clients/finance_client.js            # sonde : {"ok":true,"service":"finance-proxy"}
node clients/finance_client.js actions    # liste des actions, sans secret
node clients/finance_client.js companyinfo   # nom de la compagnie, realm, mois de début d'exercice
```

Premier appel ~10 s : Render endort le service au repos.

### Trois couches — ne prends jamais la plus étroite pour la plus large

**Avant d'écrire qu'une chose est impossible dans QBO, tu DOIS avoir lu les couches 2 et 3.**

| # | Couche | Ce que ça vaut comme preuve |
| --- | --- | --- |
| 1 | `clients/finance_client.js` | **aucune.** Il ne fait que relayer `<action>` + JSON |
| 2 | `finance-proxy/server.js` | le périmètre réellement exposé aujourd'hui (objet `ACTIONS`, ensemble `ENTITES`) |
| 3 | API QuickBooks Online d'Intuit v3 | le vrai plafond |

La bonne formulation n'est jamais « QBO ne peut pas », c'est « le proxy ne l'expose pas encore, l'API
le permet, voici le correctif ». Le service suit `main` : une route ajoutée sur une branche reste
inerte tant que la fusion n'est pas faite.

**Nuance propre aux finances.** Ici, une capacité manquante n'est pas toujours un oubli : le
périmètre est volontairement étroit parce qu'il touche les livres réels. Constater que l'API permet
plus ne veut pas dire qu'on doit l'exposer. Avant d'élargir quoi que ce soit, demande.

## Lecture

| Action | Paramètres | Retour |
| --- | --- | --- |
| `companyinfo` | — | infos compagnie, test d'auth |
| `report` | **name** + `start_date`/`end_date`, `summarize_column_by` (`Month`…), `accounting_method` (`Accrual` \| `Cash`) | le rapport |
| `query` | **query** (SQL-like QBO v3) | résultats |
| `read` | **entity, id** | l'entité, avec son `SyncToken` courant |
| `download` | **id** d'un `Attachable`, trouvé via `query` | pièce jointe en base64 (`fileName`, `contentType`, `size`), max 15 Mo |

Noms de rapports : `ProfitAndLoss`, `BalanceSheet`, `TrialBalance`, `GeneralLedger`, `CashFlow`,
`AgedReceivables`, et les autres rapports v3.

```bash
node clients/finance_client.js report '{"name":"ProfitAndLoss","start_date":"2026-01-01","end_date":"2026-12-31","summarize_column_by":"Month","accounting_method":"Accrual"}'
node clients/finance_client.js query '{"query":"select * from Account maxresults 200"}'
node clients/finance_client.js read '{"entity":"purchase","id":"123"}'
```

## Écriture — ça touche les livres réels

| Action | Paramètres | Effet |
| --- | --- | --- |
| `create` | **entity, body** (objet QBO v3 complet) | 🟡 crée ; QBO apparie ensuite au flux bancaire |
| `update` | **entity, body** avec **Id + SyncToken** (sparse par défaut) | 🟡 modifie |
| `remove` | **entity, body** avec **Id + SyncToken** | 🔴 supprime une transaction, **irréversible** |

Entités permises : `purchase`, `journalentry`, `deposit`, `transfer`, `bill`, `billpayment`,
`invoice`, `payment`, `salesreceipt`, `creditmemo`, `vendorcredit`, `refundreceipt`, `vendor`,
`customer`, `item`, `account`, `attachable`. Toute autre valeur est refusée par le proxy.

Quatre règles fermes :

1. **Lire avant d'écrire.** Interroge d'abord (`query`, `read`, `report`), montre ce que tu comptes
   faire, puis écris. Une écriture posée sans avoir regardé les comptes existants finit toujours au
   mauvais endroit.
2. **Relis via `read` juste avant tout `update` ou `remove`** pour avoir le `SyncToken` courant. Un
   token périmé fait échouer l'appel : c'est une protection contre l'écrasement concurrent, pas un
   bogue à contourner.
3. **Confirme avant** chaque `create`, `update` et `remove`, sauf instruction explicite dans le tour
   courant.
4. **Ne publie jamais en lot sans avoir montré un échantillon.** Une pièce mal classée en série coûte
   plus cher à défaire qu'à vérifier.

Une entité de liste (vendor, customer, item, account) ne se supprime pas : on la désactive par un
`update` avec `Active: false`. `remove` est réservé aux transactions.

Quand QBO refuse une écriture, le motif réel est dans le champ `Detail` de l'erreur — le proxy laisse
passer 2000 caractères précisément pour ça. Lis-le avant de réessayer.

## Exercice fiscal et dates

**Ne suppose jamais l'exercice.** `companyinfo` renvoie `FiscalYearStartMonth` : c'est la source. Une
entreprise dont l'exercice ne commence pas en janvier fausse toute borne de rapport prise sur l'année
civile. `clients/qbo_check.js` contient une fonction `exerciceCourant()` avec des dates d'exemple à
adapter avant usage — c'est un gabarit, pas une vérité.

Attention au fuseau : le conteneur peut démarrer en UTC, ce qui décale « aujourd'hui » d'un jour en
soirée heure du Québec et fausse une borne de rapport. Vérifie avec `date` quand la date compte, et
utilise `TZ=America/Toronto` au besoin.

## Quand QuickBooks se déconnecte

Intuit **fait tourner** le refresh token : chaque rafraîchissement (~24 h) en émet un nouveau et
périme le précédent. Une seule copie est valide à la fois. Le service la sauvegarde tout seul dans
son environnement Render (`RENDER_API_KEY` + `RENDER_SERVICE_ID` = l'ID `srv-…` de **ce** service).

Symptôme : `companyinfo` échoue, l'erreur mentionne `invalid_grant`. Dans l'ordre :

1. Ouvrir `https://<finance-proxy>/token-status` — route **publique** qui n'expose aucune valeur.
   `durable: true` veut dire que le service a réellement testé l'accès en écriture à l'API Render.
   `durable: false` avec un motif (`clé invalide`, `RENDER_SERVICE_ID ne correspond à aucun service`)
   dit exactement quoi corriger.
2. Réautoriser en un clic : ouvrir `https://<finance-proxy>/authorize?secret=<FINANCE_PROXY_SECRET>`
   dans un navigateur, se connecter à QuickBooks, autoriser. Le service échange le code et sauvegarde
   lui-même. Il **refuse** le retour si le compte autorisé n'est pas le bon realm — autoriser la
   mauvaise entreprise écrirait dans les mauvais livres.
3. Le parcours manuel `node clients/qbo_auth.js url` puis `exchange <code> <realmId>` reste le
   dernier recours ; il exige `QBO_CLIENT_ID` et `QBO_CLIENT_SECRET` dans l'environnement, ce qu'une
   session ordinaire n'a pas. `clients/qbo_check.js` valide l'accès en direct, hors proxy, dans les
   mêmes conditions.

**Ne tente pas de tourner le jeton sans le demander** : un échange raté périme la copie valide et
oblige à tout réautoriser à la main.

## Ce que ce skill ne couvre pas

Il donne l'**accès**, pas les **décisions** : quel compte de charge utiliser, quel code de taxe,
comment ventiler un prêt entre capital et intérêts, quoi considérer comme un doublon. Ces règles sont
propres à l'entreprise — demande-les plutôt que de les inventer, et note-les dans un skill de tenue
de livres à part.

La file « À réviser » du flux bancaire n'est **pas** exposée par l'API Intuit : on crée les
transactions directement et QBO les apparie ensuite. Ce n'est pas une limite du proxy.

Doc complète, déploiement et rotation du jeton : `finance-proxy/FINANCE_PROXY.md`. Pour recouper un
chiffre hors QBO (ventes Shopify, expéditions, marketing), charge le skill **`ops`**.
