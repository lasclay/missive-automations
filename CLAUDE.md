# missive-automations — carte d'accès aux services (pour Claude)

Automatisations Lasclay (support Missive, proxys d'API). Quand on te demande d'**accéder à un
service tiers** (ShipStation, Omnisend, QuickBooks…), passe par les proxys ci-dessous — les
clés API vivent côté Render, jamais dans l'environnement Claude ni dans le code.

**N'explore pas le dépôt pour retrouver comment joindre un service : les skills du projet
contiennent déjà les actions exactes, les paramètres et les garde-fous.** Charge-les au lieu de
chercher (elles s'activent aussi d'elles-mêmes, ou à la main avec `/missive`, `/qbo`,
`/proxygen`, `/copywriting-lasclay`) :

| Skill | Couvre |
| --- | --- |
| `missive` | boîte support Missive, fils et brouillons, connaissances de service client et de marque, scripts de la boîte |
| `qbo` | QuickBooks via le Finance Proxy, rapports et tenue de livres, exercice fiscal, import du chiffrier |
| `proxygen` | General Proxy : ShipStation, Omnisend, Klaviyo |
| `composio` | Composio : connecteur MCP contre clé de projet, accès aux Pages Facebook, pièges de jetons |
| `video` | regarder une vidéo (URL ou fichier) : trames horodatées à lire + transcription |
| `copywriting-lasclay` | rédaction et révision de tous les textes de Lasclay : voix, canaux, garde-fous du pivot, arc narratif, anti-tics IA |

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
- **Facebook Pages** (`FB_USER_TOKEN` côté Render) : publications, commentaires, réponses,
  masquage, correction. Le proxy dérive lui-même les jetons de Page ; `page_id` est requis à
  chaque appel, sans quoi Meta refuse avec `(#10)`. Sert au traitement du backlog de
  commentaires (`fb-backlog/`).
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
  édition des mappings). CLI : `node a2x/a2x.js payouts|preview|post|sync|monthly|check`.
- Une fois par mois, l'écriture **hors Shopify Payments** (PayPal, cartes-cadeaux, commandes
  manuelles, échanges) : onglet « Mensuel », ou `node a2x/a2x.js monthly 2026-07 --post`.
- Les 349 mappings d'A2X vivent dans `a2x/mappings.tsv` (source de vérité) ; `mappings.json`
  est régénéré par `node a2x/tools/import_mappings.js`.
- Doc complète : `a2x/README.md`.

## Missive Proxy

- Service Render séparé pour l'API Missive ; code : `missive-proxy/` (env `MISSIVE_PROXY_SECRET`).

## Vidéo (regarder et analyser)

- `python3 .claude/skills/video/scripts/video.py <url-ou-fichier>` : trames JPEG horodatées à lire
  avec `Read` + transcription horodatée.
- L'audio marche sans clé : sous-titres natifs d'abord, sinon **Whisper local** (`faster-whisper`,
  rien ne sort de la machine). Une clé Groq/OpenAI n'est qu'une accélération facultative.
- Dépendances : `ffmpeg`, `ffprobe`, `yt-dlp`, `faster-whisper` —
  `python3 .claude/skills/video/scripts/setup.py` les installe (à refaire dans chaque nouveau
  conteneur distant).
- **YouTube en session infonuagique** : ajoute `--youtube` au setup (jeton PO). Avec, la
  transcription passe ; les images restent refusées par les serveurs de diffusion de YouTube, qui
  bloquent les IP de centre de données. Les images sont alors récupérées automatiquement par un
  relais tiers (instance publique de cobalt) — l'URL de la vidéo lui est transmise, donc
  `--no-fallback-service` pour une vidéo confidentielle. Si le relais tombe :
  `VIDEO_YT_COOKIES_B64` ou `VIDEO_PROXY`. Détails : skill `video`.

## Skills de compte et skills du dépôt

Deux origines, à ne pas confondre :

- **Skills du dépôt** (`.claude/skills/`) : versionnés ici, chargés automatiquement dans toute
  session ouverte sur le dépôt. On les modifie, on commit, c'est réglé.
- **Skills de compte** (claude.ai → Réglages → Capacités) : `lasclay-master`, `lasclay-seo`,
  `finances-lasclay`, `bookkeeping-lasclay`, `drivepush`, `missive-messenger-7jours`. Ils
  arrivent dans le conteneur par une synchronisation **à sens unique** dans
  `~/.claude/skills/synced/`, répertoire éphémère. Aucune commande ne renvoie une modification
  vers le compte : `claude` n'a pas de sous-commande `skill`, et le jeton d'authentification
  n'est pas exposé. Une modification faite en session est donc perdue au recyclage du conteneur.

`copywriting-lasclay` existe **dans les deux**. Le dépôt fait foi. Après l'avoir modifié ici,
il faut repousser la même version vers le compte, sinon les deux divergent :

```bash
PYTHONPATH=~/.claude/skills/synced/skill-creator \
  python3 ~/.claude/skills/synced/skill-creator/scripts/package_skill.py \
  .claude/skills/copywriting-lasclay ./dist
```

Le `.skill` produit se dépose dans claude.ai → Réglages → Capacités → Skills et remplace celui
du même nom. Les archives `.skill` sont regénérables, donc `dist/` est ignoré par git.

## Scripts principaux

- `support.js` : réponses IA de la boîte support (v2.34 : vérifie Shopify ET ShipStation).
- `qbo_auth.js` / `qbo_check.js` : autorisation OAuth Intuit (une fois) et validation directe.
- Déploiement : les services Render suivent la branche `main` — le travail se fait sur une
  branche, puis fusion dans `main` pour déployer.
