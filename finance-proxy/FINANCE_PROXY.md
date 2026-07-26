# finance-proxy — service dédié aux finances (QuickBooks Online)

Service Render **séparé** du connectors-proxy général, par design : les secrets Intuit ne
cohabitent avec aucun autre connecteur, et son secret d'appel (`FINANCE_PROXY_SECRET`) est
distinct — les environnements opérationnels (cron `support.js`, etc.) ne le reçoivent jamais.
Une fuite de leur env n'expose donc pas la comptabilité.

Pourquoi une app Intuit maison : le connecteur QuickBooks officiel de Claude est US-only,
bloqué pour une entreprise canadienne (« isn't available for use in your country »).

---

## Déployer sur Render (une fois)

1. **New → Web Service**, repo `lasclay/missive-automations`, branche `main`.
2. **Root Directory** = `finance-proxy` · **Runtime** Node · **Build** `npm install` (ou vide) ·
   **Start** `node server.js`.
3. **Environment** (voir tableau) → Create Web Service.
4. Après création, noter l'ID `srv-...` du service (dans l'URL du dashboard) → l'ajouter en
   `RENDER_SERVICE_ID` (sync du refresh token tournant).

| Variable | Valeur |
|---|---|
| `FINANCE_PROXY_SECRET` | secret d'appel de CE service — **nouveau**, différent du `GENERAL_PROXY_SECRET`, aucun repli |
| `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` | app Intuit (Keys & credentials, Production) |
| `QBO_REALM_ID` | Company ID QuickBooks |
| `QBO_REFRESH_TOKEN` | ⚠️ la valeur **LA PLUS RÉCENTE** (voir migration ci-dessous) |
| `RENDER_API_KEY` | clé API Render (Account Settings → API Keys) |
| `RENDER_SERVICE_ID` | l'ID `srv-...` de **CE** service (pas du proxy général) |
| `QBO_ENV`, `QBO_MINORVERSION`, `QBO_TOKEN_FILE` | facultatifs (défauts : production, 75, —) |

### Migration depuis le General Proxy (ordre IMPORTANT)

Le refresh token TOURNE (~24 h) et une seule copie est valide. Pour le déménager sans le casser :

1. Déployer d'abord le `main` à jour sur le **General Proxy** (le connecteur quickbooks y est
   retiré → il cesse de rafraîchir le token).
2. **Copier la valeur ACTUELLE de `QBO_REFRESH_TOKEN` depuis l'env du General Proxy** (c'est la
   plus récente — la sync l'y a maintenue à jour; PAS celle du Playground d'origine).
3. Créer le service finance-proxy avec cette valeur.
4. Supprimer `QBO_CLIENT_ID/SECRET`, `QBO_REALM_ID`, `QBO_REFRESH_TOKEN`, `RENDER_API_KEY`,
   `RENDER_SERVICE_ID` de l'env du General Proxy.
5. Si le token a expiré entre-temps (`invalid_grant`) : refaire l'autorisation —
   `node qbo_auth.js url` puis `exchange` (voir la racine du repo).

---

## Routes

| Méthode | Route | Auth | Rôle |
|---|---|---|---|
| `GET`  | `/health` | non | sonde |
| `GET`  | `/actions` | non | liste des actions |
| `POST` | `/:action` | `X-Proxy-Secret` | exécute (params JSON) |

### Actions — lecture

| Action | Params | Renvoie |
|---|---|---|
| `report` | **name** (`ProfitAndLoss`, `BalanceSheet`, `TrialBalance`, `GeneralLedger`, `CashFlow`, `AgedReceivables`…) + `start_date`/`end_date`, `summarize_column_by` (`Month`…), `accounting_method` (`Accrual`\|`Cash`)… | le rapport |
| `query` | **query** (SQL-like v3) | résultats |
| `companyinfo` | — | infos compagnie (test d'auth) |
| `read` | **entity, id** | l'entité (donne le `SyncToken` courant) |
| `download` | **id** (Id d'un `Attachable`, via `query`) | le fichier joint en base64 (`fileName`, `contentType`, `size`, `base64`; max 15 Mo) |

### Actions — écriture (tenue de livres)

Entités permises : `purchase`, `journalentry`, `deposit`, `transfer`, `bill`, `billpayment`,
`invoice`, `payment`, `salesreceipt`, `creditmemo`, `vendorcredit`, `refundreceipt`, `vendor`,
`customer`, `item`, `account`, `attachable`.

| Action | Params | Effet / risque |
|---|---|---|
| `create` | **entity, body** (objet QBO v3) | 🟡 crée; QBO apparie au flux bancaire automatiquement |
| `update` | **entity, body** avec **Id + SyncToken** (sparse par défaut) | 🟡 modifie (relire via `read` avant) |
| `remove` | **entity, body** avec **Id + SyncToken** | 🔴 supprime une transaction (irréversible) |

NB : la file « À réviser » du flux bancaire n'est **pas** exposée par l'API Intuit — on crée les
transactions directement, QBO les apparie ensuite (match automatique).

---

## Tester

```
curl https://finance-proxy-XXXX.onrender.com/health
node finance_client.js companyinfo        # FINANCE_PROXY_URL + FINANCE_PROXY_SECRET dans l'env
node qbo_import.js                        # TSV P&L + bilan pour le chiffrier
```

Rotation du refresh token, app Intuit, autorisation : voir aussi `qbo_auth.js` et
`qbo_check.js` à la racine (accès direct Intuit, sans le proxy).
