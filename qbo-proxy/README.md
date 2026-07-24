# qbo-proxy

Proxy HTTP **lecture seule** entre Claude et l'API QuickBooks Online, sur le modèle
de `missive-proxy`. Les clés Intuit vivent dans les secrets Render; Claude n'a qu'un
`PROXY_SECRET` révocable. Raison d'être : le connecteur QuickBooks de Claude est
bloqué pour les comptes canadiens; une app développeur Intuit à soi n'a pas cette
limite.

## 1. Créer ton app Intuit (une fois, ~10 min)

1. [developer.intuit.com](https://developer.intuit.com) → connexion avec le compte
   Intuit de Lasclay → **Dashboard → Create an app** → QuickBooks Online and Payments.
2. Scope : **com.intuit.quickbooks.accounting**.
3. Dans l'app → **Keys & credentials → Production** : note `Client ID` et `Client Secret`.
   (Il faut compléter les infos de l'app pour débloquer les clés Production :
   domaine, politique de confidentialité — lasclay.com fait l'affaire.)
4. Ajoute l'URI de redirection :
   `https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl`
5. **OAuth 2.0 Playground** (dans le menu de l'app) : choisis tes clés Production,
   scope accounting → **Get authorization code** → connecte la compagnie
   *Les Produits Lasclay Inc* → le Playground affiche `Realm ID` et te laisse
   générer les jetons → note **Refresh token** et **Realm ID**.

## 2. Déploiement Render (Web Service)

1. **New → Web Service**, repo `lasclay/missive-automations`.
2. **Root Directory** : `qbo-proxy` · Runtime Node · Start : `node server.js`
3. **Environment** (secrets) :
   - `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` = clés Production de ton app
   - `QBO_REFRESH_TOKEN` = refresh token du Playground
   - `QBO_REALM_ID` = realm id de la compagnie
   - `PROXY_SECRET` = longue chaîne aléatoire que tu inventes
4. Déploie. Vérifie : `GET /health` → `{"ok":true}`.

Donne à Claude l'URL du service; mets `PROXY_SECRET` en variable d'environnement
de la session Claude Code (`LASCLAY_QBO_PROXY_URL`, `LASCLAY_QBO_PROXY_SECRET`).

## Rotation du refresh token (important)

Intuit fait tourner le refresh token à chaque rafraîchissement; le proxy garde le
plus récent **en mémoire**. Si le service redémarre longtemps après (Render redéploie,
crash), l'amorce `QBO_REFRESH_TOKEN` peut être périmée (`invalid_grant`) : refais
l'étape Playground et re-seed la variable. Un refresh token inutilisé expire après
100 jours.

## Endpoints

| Méthode + route | Corps JSON | Effet |
|---|---|---|
| `GET /health` | — | sonde (sans auth) |
| `POST /company` | `{}` | infos compagnie (test) |
| `POST /report` | `{"type":"ProfitAndLoss","params":{"start_date":"2025-09-01","end_date":"2026-06-30","summarize_column_by":"Month"}}` | rapports : ProfitAndLoss(Detail), BalanceSheet, CashFlow, TransactionList, GeneralLedger, TrialBalance, AgedPayables/Receivables(+Detail), VendorExpenses, CustomerIncome, AccountList |
| `POST /query` | `{"q":"select * from Account where AccountType='Expense'"}` | requêtes QBO SQL, **SELECT seulement** |

Toutes les routes POST exigent l'en-tête `X-Proxy-Secret: <PROXY_SECRET>`.

## Sécurité

- Lecture seule (aucune écriture QBO), types de rapports en liste blanche,
  SELECT-only sur `/query`.
- Les clés Intuit ne sont jamais renvoyées ni journalisées.
- Révocation : change `PROXY_SECRET` (porte de Claude) ou révoque la connexion
  de l'app dans QBO (porte Intuit).
