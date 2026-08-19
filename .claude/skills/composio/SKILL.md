---
name: composio
description: Composio chez Lasclay — deux surfaces distinctes qu'on confond systématiquement : le connecteur MCP d'une session interactive, et la clé de projet posée sur Render. Dit laquelle sert à quoi, où chacune se trouve, ce qui casse quand on les intervertit, et pourquoi une Routine ne peut pas utiliser le connecteur MCP. Couvre l'accès aux Pages Facebook de Lasclay et le piège du jeton de Page.
when_to_use: Déclenche dès qu'il est question de Composio, d'une clé Composio, d'un accès Facebook ou aux Pages Lasclay, d'une erreur 401 « Invalid API key » ou « No authentication provided », d'une erreur Meta « (#10) pages_read_user_content », ou d'une automatisation qui doit joindre Facebook sans surveillance. Déclenche aussi avant de créer une Routine qui dépend d'un connecteur MCP.
argument-hint: [ce que tu veux joindre via Composio]
allowed-tools:
  - Bash(node connectors_client.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# Composio chez Lasclay

Ne cherche pas dans le dépôt : tout est ici. Ce fichier existe parce qu'une journée entière a
été perdue à confondre deux choses qui portent le même nom.

## Les deux surfaces, et elles n'ont rien à voir

| | Connecteur MCP | Clé de projet |
| --- | --- | --- |
| **Où** | Réglages Claude → Connectors → « Composio » (type *Custom*) | Composio **Developer Platform** → Project Settings → API Keys |
| **Forme** | OAuth, aucune clé à manipuler | clé passée en en-tête `x-api-key` |
| **Sert à** | outils `mcp__Composio__*` dans une session interactive | appels REST à `backend.composio.dev/api/v3` |
| **Vit où** | compte claude.ai | variable `COMPOSIO_API_KEY` sur Render (General Proxy) |
| **Disponible dans une Routine** | **non** | oui |

Elles ne sont pas interchangeables. Avoir l'une ne donne jamais l'autre.

## Le piège : la clé `ck_…`

Composio Connect affiche, sous **Sessions & API Key**, une clé préfixée `ck_`. Elle est
présentée comme « votre clé d'API » et c'est trompeur : c'est une clé **client MCP**, destinée à
l'en-tête `x-consumer-api-key` d'un serveur MCP. **Elle ne fonctionne pas** contre l'API de
plateforme. Symptômes, tous deux observés :

- en-tête `x-api-key` → `401 {"slug":"APIKey_InvalidAPIKey"}` — la clé est lue puis rejetée
- en-tête `x-consumer-api-key` → `401 {"slug":"Auth_NoAuthProvided"}` — l'en-tête est ignoré

Régénérer cette clé ne change rien : ce n'est pas la bonne famille. La clé utile est celle du
**Developer Platform**, pas celle de Connect. Le lien s'y trouve en bas à gauche des réglages
d'organisation : « Looking for your projects? → Go to the Developer Platform ».

## Pourquoi une Routine ne peut pas utiliser le connecteur MCP

Une session lancée par une Routine ne reçoit aucun outil `mcp__*`. `create_trigger` a bien un
paramètre `connectors`, mais il est refusé pour cette organisation (« not available for this
organization »). S'y ajoutent deux obstacles constatés :

- le classificateur du mode auto y **refuse les requêtes HTTP sortantes** — donc même une clé
  valide ne suffirait pas à appeler `tools/execute` ou à publier sur Graph ;
- **Enhanced Control** (Composio Connect → General) est explicitement *non supporté par les
  agents web*, ce qu'est une session de Routine. Le laisser activé casse ces sessions.

Conséquence pratique : **une automatisation sans surveillance ne passe jamais par le connecteur
MCP.** Elle passe par le General Proxy.

## Le chemin qui marche sans surveillance : le General Proxy

Facebook est un connecteur du General Proxy, comme ShipStation et Omnisend. Le proxy dérive
lui-même les jetons de Page et ne les expose jamais.

```
node connectors_client.js facebook diag                 # toujours en premier
node connectors_client.js facebook comments '{"page_id":"…","object_id":"…"}'
node connectors_client.js facebook reply '{"page_id":"…","comment_id":"…","message":"…"}'
```

`diag` dit quelle voie d'authentification est vivante et, en cas d'échec, rend l'erreur exacte
de chaque tentative. Deux voies possibles côté Render, `FB_USER_TOKEN` l'emporte si présente :

- `COMPOSIO_API_KEY` — Composio détient la connexion Facebook (compte `facebook_grice-absume`)
- `FB_USER_TOKEN` — jeton Meta longue durée détenu directement, sans Composio du tout

Actions : `diag`, `pages`, `posts`, `comments`, `comment`, `reply`, `hide`, `unhide`, `edit`.
Détail dans `CONNECTORS_PROXY.md` et `fb-backlog/PROCEDURE.md`.

## Le piège Meta : un jeton par Page

Meta exige que chaque appel visant une Page porte **le jeton de cette Page**. Le jeton d'une
autre Page produit `(#10) pages_read_user_content`, qui ressemble à une permission manquante
et n'en est pas une.

Les outils Composio `FACEBOOK_GET_COMMENTS`, `FACEBOOK_GET_COMMENT` et `FACEBOOK_CREATE_COMMENT`
n'ont **pas** de paramètre `page_id` : Composio retombe alors sur le jeton de la première Page.
C'est ce qui a fait échouer trois Pages sur quatre au premier passage. `FACEBOOK_UPDATE_COMMENT`
et `FACEBOOK_DELETE_COMMENT`, eux, acceptent `page_id`.

Ne te sers de ces trois outils sous aucun prétexte. Récupère les jetons avec
`FACEBOOK_LIST_MANAGED_PAGES` (`fields=id,name,access_token`) et appelle Graph v23.0 en direct
avec le jeton propre à la Page. Le connecteur du proxy le fait déjà, et refuse un `page_id`
inconnu plutôt que de retomber en silence sur une autre Page.

Les quatre Pages : Lasclay `104242204750257`, Lasclay: The Milkweed Company `368305119707866`,
Milkweed & Monarchs `262382158951470`, Asclépiade & papillons monarques `114311920399404`.
Pour la Page Lasclay, pagine avec `limit=25` — au-delà, Meta renvoie « reduce the amount of data ».

## Dans le bac à sable Composio

L'assistante s'appelle **`run_composio_tool(slug, params)`** — l'ancienne `tool()` n'existe plus.
Elle renvoie un **tuple** : déballe avec `r[0]`. Elle imprime aussi un aperçu de la réponse **qui
contient les jetons de Page** : redirige `stdout` pendant l'appel, sinon les jetons partent dans
la transcription. Le bac à sable est recyclé souvent — garde ton état sur disque, jamais
seulement en mémoire de cellule, et découpe les attentes en cellules de moins de 180 secondes.

## Règle

Les clés vivent côté Render, jamais dans l'environnement Claude ni dans le code. Un jeton de Page
ne doit jamais être journalisé, écrit dans un fichier, ni commité.
