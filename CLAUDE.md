# missive-automations — carte d'accès aux services (pour Claude)

Automatisations Lasclay (support Missive, proxys d'API). Quand on te demande d'**accéder à un
service tiers** (ShipStation, Omnisend, QuickBooks…), passe par les proxys ci-dessous — les
clés API vivent côté Render, jamais dans l'environnement Claude ni dans le code.

**N'explore pas le dépôt pour retrouver comment joindre un service : quatre skills du projet
contiennent déjà les actions exactes, les paramètres et les garde-fous.** Charge-les au lieu de
chercher (elles s'activent aussi d'elles-mêmes, ou à la main avec `/missive`, `/qbo`,
`/proxygen`, `/drivepush`) :

| Skill | Couvre |
| --- | --- |
| `missive` | boîte support Missive, fils et brouillons, connaissances de service client et de marque, scripts de la boîte |
| `qbo` | QuickBooks via le Finance Proxy, rapports et tenue de livres, exercice fiscal, import du chiffrier |
| `proxygen` | General Proxy : ShipStation, Omnisend, Klaviyo |
| `drivepush` | écriture de fichiers dans le Google Drive (pousseur Apps Script) |

## Écrire dans le Google Drive

Le connecteur Google Drive sert à **lire** : chercher, lire, lister, créer un dossier, copier un
fichier. Il ne peut pas téléverser de binaire d'une taille utile, parce que le contenu devrait
transiter en base64 dans l'appel d'outil.

Pour **déposer ou remplacer un fichier**, passe par le pousseur Apps Script (env
`LASCLAY_DRIVE_PUSH_URL` + `LASCLAY_DRIVE_PUSH_TOKEN`) et charge le skill `drivepush`. Le
paramètre de destination est `folder`, pas `folderId` : un nom inconnu est ignoré en silence et
l'appel écrase alors le chiffrier de prévisions. Ne sonde jamais l'endpoint « pour voir », chaque
POST valide écrit quelque part.

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
- **Klaviyo** (`KLAVIYO_API_KEY` côté Render, lecture seule) : profils, listes, segments,
  flows, campagnes, templates, événements — pour l'export exhaustif/migration.
  Export en masse : `node klaviyo_export.js profiles <dossier>` (CSV avec consentements).
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

## A2X maison (Shopify Payments → QuickBooks)

- Remplace l'app A2X sans abonnement : un versement Shopify = une écriture de journal QBO,
  identique à celles d'A2X (`DocNumber` `A2XSH-21Jul-27Jul-592`, mêmes libellés et comptes).
- Interface web : `node a2x-app/server.js` (versements, aperçu d'écriture, publication,
  édition des mappings). CLI : `node a2x/a2x.js payouts|preview|post|sync|check`.
- Les 349 mappings d'A2X vivent dans `a2x/mappings.tsv` (source de vérité) ; `mappings.json`
  est régénéré par `node a2x/tools/import_mappings.js`.
- Doc complète : `a2x/README.md`.

## Missive Proxy

- Service Render séparé pour l'API Missive ; code : `missive-proxy/` (env `MISSIVE_PROXY_SECRET`).

## Scripts principaux

- `support.js` : réponses IA de la boîte support (v2.34 : vérifie Shopify ET ShipStation).
- `qbo_auth.js` / `qbo_check.js` : autorisation OAuth Intuit (une fois) et validation directe.
- Déploiement : les services Render suivent la branche `main` — le travail se fait sur une
  branche, puis fusion dans `main` pour déployer.
