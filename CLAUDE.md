# missive-automations — carte d'accès aux services (pour Claude)

Automatisations Lasclay (support Missive, proxys d'API). Quand on te demande d'**accéder à un
service tiers** (ShipStation, Omnisend, QuickBooks…), passe par les proxys ci-dessous — les
clés API vivent côté Render, jamais dans l'environnement Claude ni dans le code.

## General Proxy (opérations) — ShipStation, Omnisend

- Service Render : `https://general-proxy-5muf.onrender.com` (code : `server.js` à la racine).
- Client : `node connectors_client.js <connecteur> <action> ['{"param":"valeur"}']`
  (env : `GENERAL_PROXY_URL` facultative, `GENERAL_PROXY_SECRET` requise).
- Introspection sans secret : `GET /connectors` (liste connecteurs + actions + enabled).
- **ShipStation** (accès complet) : commandes, expéditions, suivi, tags, hold, marquage
  expédié, création/suppression de commande, achat/annulation d'étiquettes (⚠️ argent réel).
- **Omnisend** (`OMNISEND_API_KEY` côté Render) : contacts, campagnes, commandes, produits,
  paniers + createcontact / updatecontact / triggerevent. Quand on te demande « accéder à
  Omnisend », c'est CE chemin : `node connectors_client.js omnisend <action> ...`.
- Doc complète : `CONNECTORS_PROXY.md`.

## Finance Proxy (comptabilité) — QuickBooks Online, service SÉPARÉ

- Service Render dédié (isolation des finances) ; code : `finance-proxy/server.js`.
- Client : `node finance_client.js <action> ['{...}']`
  (env : `FINANCE_PROXY_URL` + `FINANCE_PROXY_SECRET` — secret DISTINCT du général, jamais
  donné aux environnements opérationnels).
- Actions : report, query, companyinfo, read, create, update, remove (tenue de livres).
- Import chiffrier : `node qbo_import.js` → TSV « QBO P&L à maj » / « QBOBS à maj »
  (mappage des comptes : `qbo_mapping.json`). Exercice fiscal : 1er sept → 31 août.
- Doc complète : `finance-proxy/FINANCE_PROXY.md` (dont rotation du refresh token Intuit).

## Missive Proxy

- Service Render séparé pour l'API Missive ; code : `missive-proxy/` (env `MISSIVE_PROXY_SECRET`).

## Scripts principaux

- `support.js` : réponses IA de la boîte support (v2.34 : vérifie Shopify ET ShipStation).
- `qbo_auth.js` / `qbo_check.js` : autorisation OAuth Intuit (une fois) et validation directe.
- Déploiement : les services Render suivent la branche `main` — le travail se fait sur une
  branche, puis fusion dans `main` pour déployer.
