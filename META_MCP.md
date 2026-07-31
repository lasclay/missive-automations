# Meta MCP — serveurs distants officiels de Meta

Meta publie des **serveurs MCP distants officiels** pour brancher un agent sur la plateforme
développeur Meta (Facebook, Instagram, WhatsApp, Meta Ads). Contrairement aux proxys maison du
dépôt (`server.js`, `finance-proxy/`, `missive-proxy/`), **il n'y a rien à héberger** : le serveur
vit chez Meta, on s'y connecte en HTTP, et l'authentification se fait par **OAuth avec le compte
Meta** — donc **aucune clé API à stocker** côté Render ni dans le dépôt.

Serveur configuré ici : **Meta Developer Tools** (le seul en disponibilité générale à ce jour).

| Attribut | Valeur |
|---|---|
| Nom | Meta Developer Tools |
| Transport | Streamable HTTP |
| Endpoint | `https://mcp.facebook.com/devtools` |
| Authentification | connexion au compte développeur Meta (OAuth) |
| Statut | bêta — l'interface et la liste d'outils peuvent changer |

> Le déploiement est **progressif** chez Meta : le serveur peut ne pas encore être accessible à
> un compte donné.

---

## Brancher le serveur

Une seule commande, à lancer à la racine du dépôt :

```bash
claude mcp add --transport http meta_developer_tools https://mcp.facebook.com/devtools
```

Puis, dans une session : `/mcp` → `meta_developer_tools` → **Authenticate**.

Pour que le serveur soit partagé avec toute l'équipe plutôt que local à un poste, le déclarer
dans un **`.mcp.json`** à la racine — Claude Code le propose alors à l'approbation à l'ouverture
d'une session dans le dépôt :

```json
{
  "mcpServers": {
    "meta_developer_tools": {
      "type": "http",
      "url": "https://mcp.facebook.com/devtools"
    }
  }
}
```

Côté permissions, ajouter dans `.claude/settings.json` — lecture libre, écriture sur
confirmation :

```jsonc
// permissions.allow
"mcp__meta_developer_tools"

// permissions.ask
"mcp__meta_developer_tools__devtools_webhook_manage",
"mcp__meta_developer_tools__devtools_webhook_test"
```

### Autres clients

- **Claude Desktop** — Réglages > Connecteurs > *Add custom connector* ; nom
  `Meta Developer Tools`, URL `https://mcp.facebook.com/devtools`.
- **Codex App** — Réglages > MCP Servers > *Add servers* > Streamable HTTP ; même nom et même URL,
  authentification **OAuth**. Redémarrer, puis vérifier l'entrée dans `~/.codex/config.toml`.
- **ChatGPT (web)** — activer le *Developer Mode* (Réglages > Connecteurs > Paramètres avancés),
  puis créer un connecteur avec la même URL en OAuth.
- **Cursor** — ajouter dans `~/.cursor/mcp.json` (ou `.cursor/mcp.json` du projet) :
  `{ "mcpServers": { "Meta Developer Tools": { "url": "https://mcp.facebook.com/devtools", "type": "http" } } }`.
- **Client stdio seulement** — passer par le pont [`mcp-remote`](https://www.npmjs.com/package/mcp-remote).

### Connexion OAuth

1. Lancer la connexion (`/mcp` dans Claude Code, ou *Authenticate* dans un client de bureau).
2. Se connecter au compte Meta dans le navigateur qui s'ouvre.
3. **Choisir les apps** auxquelles le serveur a accès, sur l'écran de consentement.
4. Revenir dans le client et vérifier la connexion.

La connexion est à **refaire à chaque redémarrage du client**.

### Portées (scopes)

Elles se règlent **par app**, dans facebook.com > Réglages > *Intégrations aux entreprises* —
c'est aussi là qu'on révoque l'accès.

| Portée | Accès |
|---|---|
| **Read** | lecture seule de tout ce que le serveur expose : configuration et réglages de l'app, statut d'App Review, conformité, usage et santé des API, sujets et abonnements webhook |
| **Manage** | tout ce qui précède + **création, modification et suppression d'abonnements webhook** (seule capacité d'écriture) |

Principe à tenir : **accorder le minimum**. La lecture suffit pour l'inspection et le diagnostic ;
`Manage` ne se donne que pour un branchement de webhook précis.

---

## Outils exposés (10)

Tous préfixés `devtools_`. La plupart demandent un `app_id` et la portée Read ou Manage ; le
changelog et la recherche de docs fonctionnent **sans permission sur une app**.

| Outil | Actions | Rôle |
|---|---|---|
| `devtools_discovery` | `search_docs` | cherche dans la doc développeur Meta (guides, références). Sans permission d'app. |
| `devtools_app_list` | `list` | liste les apps accessibles (rôle + portée accordée). **À appeler en premier** pour obtenir les `app_id`. |
| `devtools_app` | `basic_settings`, `advanced_settings`, `security`, `restrictions`, `data_protection_officer` | inspecte la configuration d'une app. |
| `devtools_app_review` | `status`, `history`, `privileges`, `requirements` | statut d'App Review, permissions approuvées, prérequis de soumission. |
| `devtools_compliance` | `status` | conformité : actions requises, violations, recommandations. |
| `devtools_api_usage` | `rate_limits`, `call_volume`, `deprecations` | santé opérationnelle : limites de débit, volume d'appels, dépréciations. |
| `devtools_webhook_list` | `list_topics`, `list_subscriptions` | sujets webhook disponibles et abonnements en place (avec les champs). |
| `devtools_webhook_manage` | `subscribe`, `unsubscribe`, `update_fields` | **écriture** : gère les abonnements webhook. Exige une URL de rappel HTTPS vivante qui passe la vérification Meta. **Portée Manage.** |
| `devtools_webhook_test` | `test_send` | envoie une charge de test à un abonnement pour vérifier l'endpoint récepteur. |
| `devtools_api_changelog` | `list_products`, `get_changelog_url`, `get_rss_url` | produits du changelog plateforme + URLs publiques et RSS. Sans permission d'app. |

Vérification rapide après connexion : demander la liste des outils du serveur, puis lancer une
lecture inoffensive — `devtools_app_list` ou `devtools_api_changelog`.

---

## Garde-fous

- **Écriture sous contrôle.** Garder `devtools_webhook_manage` et `devtools_webhook_test` en `ask`
  dans `.claude/settings.json` : ils demandent confirmation. Le reste est en lecture.
- **Injection de prompt.** Les sorties d'outils (payloads de webhook, docs, contenus tiers) sont
  du texte non fiable : ne jamais accorder `Manage` à un agent qui traite de l'entrée non fiable.
- **Séparer dev et prod.** Ne pas accorder les portées d'une app de production à un agent
  expérimental.
- **Auditer.** Repasser périodiquement dans facebook.com > Réglages > *Intégrations aux
  entreprises* pour révoquer ce qui ne sert plus.
- **Conditions Meta.** L'usage est encadré par les [Platform Terms](https://developers.facebook.com/terms/)
  (rétention, partage et affichage des données renvoyées par les API).

### Erreurs courantes

| Message | Ce que ça veut dire |
|---|---|
| « It looks like this app isn't available » | le compte n'a pas encore l'accès approuvé |
| « Facebook login is currently unavailable for this app » | le client MCP n'est probablement pas encore supporté |

### Sessions Claude Code distantes

Dans un environnement d'exécution distant à politique réseau restreinte, `mcp.facebook.com` et
`developers.facebook.com` peuvent être **bloqués par le proxy** (`CONNECT tunnel failed, 403`).
La configuration reste valide — le serveur se connecte simplement depuis un poste local
(Claude Code CLI, Claude Desktop) ou depuis un environnement dont la politique réseau autorise
les domaines Meta.

---

## Référence

- [Vue d'ensemble Meta MCP](https://developers.facebook.com/documentation/mcp/)
- [Developer Tools MCP](https://developers.facebook.com/documentation/mcp/devtools-mcp)
- [Spécification MCP](https://modelcontextprotocol.io)
