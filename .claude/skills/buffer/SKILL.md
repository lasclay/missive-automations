---
name: buffer
description: Buffer chez Lasclay — trois comptes gratuits de trois canaux chacun, publiés par deux chemins qu'on confond systématiquement : le connecteur MCP (compte principal seulement, session interactive) et le connecteur `buffer` du General Proxy (les trois comptes, par clé API, utilisable sans surveillance). Couvre les canaux, la file de publication, la création et la modification de posts, les brouillons, les idées, les métriques agrégées, et le quota de 100 appels par jour et par compte.
when_to_use: Déclenche dès qu'il est question de Buffer, d'un post à programmer ou à mettre en file, d'une publication LinkedIn, Facebook, Instagram, TikTok, Threads, Pinterest ou YouTube passant par Buffer, d'un brouillon social, du calendrier de publication, d'une idée de contenu, ou des statistiques d'un post publié. Déclenche même sans le mot Buffer — « programme ce post pour jeudi », « qu'est-ce qui est en file cette semaine », « publie ça sur le deuxième compte », « pourquoi le connecteur ne voit que trois canaux », « sors les stats LinkedIn du mois ».
argument-hint: [ce que tu veux faire dans Buffer, et sur quel compte]
allowed-tools:
  - Bash(node connectors_client.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# Buffer — trois comptes, deux chemins d'accès

N'explore pas le dépôt pour retrouver comment joindre Buffer : tout est ici.

## Pourquoi trois comptes

Le forfait gratuit de Buffer plafonne à **trois canaux par compte**. Lasclay en a donc trois,
chacun avec ses trois canaux, plutôt qu'un abonnement payant. Conséquence directe et permanente :
**un jeton Buffer ne voit qu'un seul compte**. Il n'existe aucune requête, aucun paramètre, aucune
organisation qui donne les neuf canaux d'un coup. Si tu ne vois que trois canaux, ce n'est pas un
bogue, c'est le compte que tu interroges.

| Compte | Clé côté Render | Canaux |
| --- | --- | --- |
| `main` | `BUFFER_MAIN_API_KEY` | LinkedIn Gabriel, Facebook Lasclay, Instagram Lasclay |
| `2` | `BUFFER_2_API_KEY` | à relever — `node connectors_client.js buffer channels '{"compte":"2"}'` |
| `3` | `BUFFER_3_API_KEY` | à relever — `node connectors_client.js buffer channels '{"compte":"3"}'` |

Quand tu relèves les canaux des comptes 2 et 3 pour la première fois, **écris-les dans ce tableau**
et pousse la correction : chaque relevé coûte un appel sur un quota de cent par jour, et la
prochaine session paiera le même appel pour la même information.

## Deux chemins — ne prends pas l'un pour l'autre

C'est le même piège que Composio, et il se paie de la même façon : une automatisation qui marche
en session et meurt en Routine.

| | Connecteur MCP `Buffer` | Connecteur `buffer` du General Proxy |
| --- | --- | --- |
| Authentification | OAuth, autorisé une fois dans le client | clé API personnelle, posée côté Render |
| Couverture | **compte principal seulement** | **les trois comptes**, via `compte` |
| Disponible | dans une session interactive qui a le connecteur | partout où `GENERAL_PROXY_SECRET` existe |
| En Routine, en cron, en agent | **non** — le connecteur n'y est pas | **oui** |

Règle : dès que la demande touche le compte 2 ou 3, ou dès que ça doit tourner sans personne
devant l'écran, c'est le proxy. Le MCP reste commode pour le compte principal en interactif.

## Prérequis

Service Render `https://general-proxy-5muf.onrender.com`, code dans `server.js` à la racine du
dépôt **`lasclay/missive-automations`**. Les clés Buffer vivent uniquement côté Render — jamais
dans le dépôt, jamais dans l'environnement de session.

| Variable | Rôle |
| --- | --- |
| `GENERAL_PROXY_SECRET` | requis (côté appelant) |
| `GENERAL_PROXY_URL` | facultatif, défaut `https://general-proxy-5muf.onrender.com` |
| `BUFFER_MAIN_API_KEY`, `BUFFER_2_API_KEY`, `BUFFER_3_API_KEY` | côté Render |
| `BUFFER_COMPTE_DEFAUT` | facultatif, défaut `main` |

Les clés se génèrent dans Buffer : **Settings → API → Personal Access → + New Key**
(`https://publish.buffer.com/settings/api`), une par compte, en étant connecté à ce compte-là.
Compte gratuit : une seule clé vivante à la fois — en régénérer une révoque la précédente.

```bash
node connectors_client.js buffer comptes                    # quels comptes sont configurés
node connectors_client.js buffer <action> '{"compte":"2", ...}'
```

Sans `compte`, c'est `main`. Premier appel ~10 s : Render endort le service au repos.

### Trois couches — ne prends jamais la plus étroite pour la plus large

**Avant d'écrire qu'une chose est impossible, tu DOIS avoir lu les couches 2 et 3.**

| # | Couche | Ce que ça vaut comme preuve |
| --- | --- | --- |
| 1 | `connectors_client.js` et `GET /connectors` | **aucune.** La liste des actions est une commodité |
| 2 | le connecteur `buffer` dans `server.js` | le périmètre réellement exposé aujourd'hui |
| 3 | l'API GraphQL de Buffer | le vrai plafond — et il est atteignable sans toucher au code |

Particularité de Buffer : la couche 3 est **directement accessible** par les actions `query` et
`mutation`, qui passent du GraphQL brut. Donc « le proxy ne l'expose pas » n'est jamais une
conclusion ici, seulement une raison d'écrire la requête soi-même. `introspect` donne le schéma.

## Les actions

Toutes acceptent `compte`. L'`organizationId` est résolu et mis en cache tout seul (6 h) : ne le
passe que si tu veux forcer une autre organisation.

**Lecture (11).**

| Action | Paramètres | Ce que ça donne |
| --- | --- | --- |
| `comptes` | — | quels comptes ont leur clé. Aucun appel à Buffer, aucun quota consommé |
| `account` | — | le compte, son fuseau, ses organisations |
| `organisations` | — | id et nom des organisations |
| `channels` | `isLocked` | **les trois canaux** : id, nom, service, fuseau, file en pause ou non |
| `channel` | **id** | un canal en détail |
| `posts` | `status`, `channelIds`, `startDate`, `endDate`, `first` (20), `after`, `sort`, `direction` | la file, les brouillons, les envoyés |
| `post` | **id** | un post + ses métriques s'il est publié |
| `metrics` | **startDateTime**, **endDateTime**, `channelIds` | métriques agrégées, fenêtre ≤ 365 jours |
| `limits` | **channelIds**, `date` | quota de publication du jour, par canal |
| `ideagroups` | — | les colonnes du tableau « Create » |
| `ideas` | `first`, `after` | les idées |

`status` prend `scheduled`, `draft`, `sent`, `sending`, `error`, `needs_approval` — en tableau.
`sort` vaut `dueAt` ou `createdAt`, `direction` `asc` ou `desc`. La pagination est Relay :
`pageInfo.endCursor` se repasse en `after`.

**Écriture (5), par risque croissant.**

| Risque | Action | Détail |
| --- | --- | --- |
| 🟢 | `createidea` | `text` et/ou `title`, `date`, `services`, `groupId`. Une idée n'est **pas** un post : rien n'est publié, rien n'entre en file |
| 🟡 | `createpost` avec `saveToDraft:true` | brouillon dans Buffer, rien ne part |
| 🟡 | `editpost` | **id**, plus les champs à changer. Les champs omis sont conservés |
| 🟠 | `createpost` | **channelId**, **text** — entre dans la **vraie file de publication** |
| 🔴 | `deletepost` | **id** — irréversible |

`createpost` en détail :

- `mode` : `addToQueue` (défaut — prochain créneau libre), `customScheduled` (heure précise),
  `shareNext` (tête de file), **`shareNow` (publie séance tenante)**.
- `dueAt` : ISO UTC, par exemple `2026-09-20T14:00:00Z`. Le fournir bascule automatiquement en
  `customScheduled` — pas besoin de préciser `mode`.
- `schedulingType` : `automatic` (Buffer publie) ou `notification` (Buffer rappelle à un humain de
  publier à la main — obligatoire sur certains formats Instagram).
- `imageUrl` + `altText` : raccourci pour une image. Sinon `assets`, tableau d'objets
  `{image:{url, metadata:{altText}}}` ou `{video:{...}}`.
- `metadata` : le réseau-spécifique (`linkAttachment`, `firstComment` LinkedIn, fil Threads…).
  `metadata.{service}.linkAttachment` est **incompatible** avec un `assets` non vide.

`shareNow` et un `createpost` sans `saveToDraft` sont des publications publiques au nom de Lasclay
ou de Gabriel : **jamais sans confirmation explicite dans le tour courant**, même si la demande
paraît sans ambiguïté. Ces actions sont couvertes par des règles `permissions.ask` — elles
demanderont même en mode auto.

**Échappatoire (3).** `query` et `mutation` passent du GraphQL brut
(`{"query":"...","variables":{...}}`), `introspect` donne le schéma — sans argument la liste des
types, avec `{"type":"CreatePostInput"}` les champs de ce type. C'est par là que passe tout ce que
l'allowlist ne couvre pas : gabarits de posts, déplacement dans la file, audio Instagram.

## Le quota, et pourquoi il dicte la méthode

Par clé, donc **par compte** : 100 requêtes / 15 minutes, et sur 24 h **100 sur le forfait
gratuit** (250 Essentials, 500 Team). Cent appels par jour et par compte, c'est peu — un `posts`
mal filtré et une pagination naïve en brûlent dix sans rien rapporter.

Donc :

- Relève les `channelId` **une fois**, note-les, réutilise-les. Un `channels` par session au plus.
- Filtre côté serveur (`status`, `channelIds`, `startDate`) plutôt que de tout tirer pour trier
  ensuite.
- `comptes` ne coûte rien : sers-t'en pour vérifier la configuration avant de dépenser un appel.
- Un 429 est déjà géré par le proxy (attente puis reprise). Si tu le vois quand même remonter,
  c'est le quota de 24 h : il ne se réarme qu'avec le temps, inutile de réessayer.
- Trois comptes = trois quotas séparés. Un compte à sec n'empêche pas les deux autres.

## Erreurs — ce qu'elles veulent dire

GraphQL répond **200 même en cas d'échec**. Le connecteur convertit les deux formes en vraie
erreur, ne les traite donc jamais comme un succès silencieux.

| Message | Cause |
| --- | --- |
| `compte « 3 » non configuré` | la variable `BUFFER_3_API_KEY` manque côté Render |
| `connecteur « buffer » non configuré` | aucune des trois clés n'est posée |
| `buffer/2 : ...Unauthorized...` | clé révoquée ou regénérée — il en faut une nouvelle |
| `buffer createPost refusé : ...` | Buffer a refusé la mutation : limite de canal, format, brouillon en approbation |
| `channel not found` avec un id valide | l'id vient d'un **autre compte** — vérifie `compte` |

Ce dernier cas est le plus coûteux en temps : un `channelId` du compte principal passé au compte 2
ne produit pas « mauvais compte », mais « canal introuvable ». Quand un id « n'existe pas » alors
que tu viens de le lire, demande-toi d'abord sur quel compte tu l'as lu.

## Avant de publier quoi que ce soit

Un post Buffer est un texte public au nom de la marque ou de son fondateur. Charge le skill
**`copywriting-lasclay`** avant d'écrire, et **`lasclay-master`** si le contexte d'entreprise
manque : ton de voix, garde-fous, et ce qu'on ne dit pas (greenwashing, localwashing,
founderwashing). Un brouillon (`saveToDraft:true`) est presque toujours la bonne première étape :
il se relit dans Buffer, il se corrige, il ne s'excuse pas.

Vérifie aussi que le canal visé n'a pas sa file en pause (`isQueuePaused`) : un post « programmé »
sur une file en pause ne part jamais, et rien ne le signale.

## Déploiement

Les services Render suivent `main`. Un connecteur ajouté sur une branche reste **inerte** tant que
la fusion n'est pas faite : `GET /connectors` sur Render continuera d'ignorer `buffer`, et les
appels répondront 404 « connecteur inconnu ». Si une action documentée ici n'existe pas en
production, vérifie la fusion avant de chercher plus loin.

## Détail complet

`CONNECTORS_PROXY.md` à la racine du dépôt (tableaux par connecteur, paramètres, risques) et le
bloc `buffer` de `server.js`. Documentation Buffer : `https://developers.buffer.com`.
