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

N'explore pas le dépôt pour retrouver comment joindre QBO : tout est ci-dessous.

## Accès au proxy

Service Render **dédié**, distinct du proxy général, précisément pour isoler les finances. Code
dans `finance-proxy/`. Le secret `FINANCE_PROXY_SECRET` est différent du `GENERAL_PROXY_SECRET`
et n'est jamais donné aux environnements opérationnels. Env : `FINANCE_PROXY_URL` +
`FINANCE_PROXY_SECRET`.

```bash
node finance_client.js <action> '{"param":"valeur"}'
node finance_client.js                     # sans action : sonde /health
```

Lecture :

| Action | Paramètres | Retour |
| --- | --- | --- |
| `companyinfo` | — | infos compagnie, sert de test d'authentification |
| `report` | **name** (`ProfitAndLoss`, `BalanceSheet`, `TrialBalance`, `GeneralLedger`, `CashFlow`, `AgedReceivables`…) + `start_date`/`end_date`, `summarize_column_by` (`Month`…), `accounting_method` (`Accrual`\|`Cash`) | le rapport |
| `query` | **query** (SQL-like QBO v3) | résultats |
| `read` | **entity, id** | l'entité, avec son `SyncToken` courant |
| `download` | **id** d'un `Attachable`, trouvé via `query` | pièce jointe en base64 (max 15 Mo) |

Écriture — ça touche les livres réels :

| Action | Paramètres | Effet |
| --- | --- | --- |
| `create` | **entity, body** (objet QBO v3) | 🟡 crée ; QBO apparie au flux bancaire automatiquement |
| `update` | **entity, body** avec **Id + SyncToken** (sparse par défaut) | 🟡 modifie — relis via `read` juste avant pour avoir le bon SyncToken |
| `remove` | **entity, body** avec **Id + SyncToken** | 🔴 supprime une transaction, **irréversible** |

Confirme avant tout `create`, `update` ou `remove`, sauf instruction explicite dans le tour
courant. Un `SyncToken` périmé fait échouer l'appel : c'est une protection, pas un bogue.

## Exercice fiscal

**1er septembre au 31 août.** Toute borne de rapport et toute comparaison annuelle s'aligne là
-dessus, pas sur l'année civile. Attention au fuseau : le conteneur peut être en UTC, ce qui
décale « aujourd'hui » d'un jour en soirée — vérifie avec `date` si une borne est sensible.

## Import du chiffrier

`node qbo_import.js` produit les TSV « QBO P&L à maj » et « QBOBS à maj ». Le mappage des
comptes vit dans `qbo_mapping.json`. Doc complète : `finance-proxy/FINANCE_PROXY.md`, dont la
procédure de rotation du refresh token Intuit.

`qbo_auth.js` fait l'autorisation OAuth Intuit, une seule fois. `qbo_check.js` valide l'accès en
direct.

## Skills à charger

- **`bookkeeping-lasclay`** — tenue de livres opérationnelle : classement et publication de
  factures et reçus, boîte de réception Dext, comptes de charge, codes TPS/TVQ, devises
  étrangères, doublons, rapprochement bancaire. C'est le skill à charger pour classer ou publier.
- **`finances-lasclay`** — modèle de prévisions, marges, COGS, trésorerie, masse salariale,
  états financiers, méthodologie de projection. C'est le skill à charger pour analyser ou projeter.

En cas de doute : classer une pièce → `bookkeeping-lasclay` ; interpréter un chiffre →
`finances-lasclay`.
