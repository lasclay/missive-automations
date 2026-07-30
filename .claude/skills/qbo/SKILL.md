---
name: qbo
description: Accès à QuickBooks Online via le Finance Proxy de Lasclay, service Render séparé des opérations pour isoler les finances. Couvre les rapports (P&L, bilan, balance de vérification, grand livre, flux de trésorerie, âge des comptes), les requêtes SQL-like v3, la lecture et l'écriture d'entités de tenue de livres, le téléchargement de pièces jointes, et l'import du chiffrier de prévisions.
when_to_use: Déclenche dès qu'il est question de QuickBooks, QBO, du proxy finance, d'un état financier, d'un compte de charge, d'un rapprochement bancaire, d'une écriture comptable, de l'exercice fiscal, ou de chiffres comptables de Lasclay. Déclenche même sans le mot QuickBooks, par exemple « sors-moi le P&L du dernier trimestre », « est-ce que cette dépense est classée », « publie les factures d'Anthropic », « c'est quoi nos marges ce mois-ci ».
argument-hint: [ce que tu veux consulter ou publier dans QBO]
allowed-tools:
  - Bash(node finance_client.js:*)
  - Bash(node qbo_check.js:*)
  - Bash(node qbo_import.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# QuickBooks Online — Finance Proxy Lasclay

N'explore pas pour retrouver comment joindre QBO : tout est ci-dessous.

## Prérequis — à vérifier en premier

Service Render **dédié**, distinct du proxy des opérations, précisément pour isoler les finances.
Code dans `finance-proxy/` du dépôt **`lasclay/missive-automations`**. Le client est un script
Node de ce dépôt, non déployé.

| Variable | Rôle |
| --- | --- |
| `FINANCE_PROXY_SECRET` | requis — **distinct** du `GENERAL_PROXY_SECRET`, aucun repli |
| `FINANCE_PROXY_URL` | requis |

Ce secret n'est jamais donné aux environnements opérationnels : c'est le point de l'isolation.
Si le répertoire courant n'est pas le dépôt, vérifie avec `ls finance_client.js` et signale-le
plutôt que de reconstruire un appel à la main.

Commence par le test d'authentification, qui valide aussi le refresh token Intuit :

```bash
node finance_client.js               # sonde : {"ok":true,"service":"finance-proxy"}
node finance_client.js companyinfo   # attendu : CompanyName « Les Produits Lasclay Inc »
```

Si `companyinfo` échoue en 401, le refresh token Intuit est à tourner — procédure dans
`finance-proxy/FINANCE_PROXY.md`. Ne tente pas de le renouveler sans le demander.
Premier appel ~10 s : Render endort le service au repos.

## Lecture

| Action | Paramètres | Retour |
| --- | --- | --- |
| `companyinfo` | — | infos compagnie, test d'auth |
| `report` | **name** + `start_date`/`end_date`, `summarize_column_by` (`Month`…), `accounting_method` (`Accrual`\|`Cash`) | le rapport |
| `query` | **query** (SQL-like QBO v3) | résultats |
| `read` | **entity, id** | l'entité, avec son `SyncToken` courant |
| `download` | **id** d'un `Attachable`, trouvé via `query` | pièce jointe en base64, max 15 Mo |

Noms de rapports : `ProfitAndLoss`, `BalanceSheet`, `TrialBalance`, `GeneralLedger`, `CashFlow`,
`AgedReceivables` et les autres rapports v3.

```bash
node finance_client.js report '{"name":"ProfitAndLoss","start_date":"2025-09-01","end_date":"2026-08-31","summarize_column_by":"Month"}'
node finance_client.js query '{"query":"SELECT * FROM Vendor WHERE DisplayName LIKE '\''Anthropic%'\''"}'
```

## Écriture — ça touche les livres réels

| Action | Paramètres | Effet |
| --- | --- | --- |
| `create` | **entity, body** (objet QBO v3) | 🟡 crée ; QBO apparie au flux bancaire automatiquement |
| `update` | **entity, body** avec **Id + SyncToken** (sparse par défaut) | 🟡 modifie |
| `remove` | **entity, body** avec **Id + SyncToken** | 🔴 supprime une transaction, **irréversible** |

Trois règles fermes :

1. **Relis via `read` juste avant tout `update` ou `remove`** pour avoir le `SyncToken` courant.
   Un token périmé fait échouer l'appel : c'est une protection contre l'écrasement concurrent,
   pas un bogue à contourner.
2. **Confirme avant** chaque `create`, `update` et `remove`, sauf instruction explicite dans le
   tour courant. Ces trois actions sont couvertes par des règles `permissions.ask` : elles
   demanderont même en mode auto.
3. **Ne publie jamais en lot sans avoir montré un échantillon** : une pièce mal classée en
   série coûte plus cher à défaire qu'à vérifier.

## Exercice fiscal — 1er septembre au 31 août

Toute borne de rapport et toute comparaison annuelle s'aligne là-dessus, jamais sur l'année
civile. L'exercice nommé par son année de fin : l'exercice 2026 court du 1er septembre 2025 au
31 août 2026.

Attention au fuseau : le conteneur peut démarrer en UTC, ce qui décale « aujourd'hui » d'un jour
en soirée heure du Québec et fausse une borne de rapport. Vérifie avec `date` quand la date
compte, et utilise `TZ=America/Montreal` au besoin.

## Import du chiffrier

`node qbo_import.js` produit les TSV « QBO P&L à maj » et « QBOBS à maj », destinés au chiffrier
de prévisions. Le mappage des comptes vit dans `qbo_mapping.json` — si un compte manque au
rapport, c'est là qu'il faut regarder avant de conclure à un problème QBO.

`qbo_auth.js` fait l'autorisation OAuth Intuit, une seule fois. `qbo_check.js` valide l'accès en
direct. Doc complète : `finance-proxy/FINANCE_PROXY.md`.

## Skills à charger

- **`bookkeeping-lasclay`** — tenue de livres opérationnelle : classement et publication de
  factures et reçus fournisseurs, boîte de réception Dext, comptes de charge, codes TPS/TVQ,
  devises étrangères et validation du montant CAD, doublons, rapprochement bancaire. À charger
  pour **classer ou publier une pièce**.
- **`finances-lasclay`** — modèle de prévisions, marges, COGS, trésorerie, masse salariale,
  états financiers, méthodologie de projection. À charger pour **analyser ou projeter un chiffre**.

En cas de doute : classer une pièce → `bookkeeping-lasclay` ; interpréter un chiffre →
`finances-lasclay`. Les deux peuvent être chargés ensemble.

## Contexte d'entreprise

*Les Produits Lasclay Inc*, marque québécoise de produits isolés à la soie d'asclépiade, siège à
Québec, vente en ligne sur lasclay.com. Les ventes viennent de Shopify, la logistique de
ShipStation, le marketing d'Omnisend et Klaviyo — tous accessibles via le skill `proxygen` si un
chiffre doit être recoupé hors QBO.
