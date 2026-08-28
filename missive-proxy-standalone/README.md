# missive-proxy

Un petit serveur qui s'interpose entre un assistant IA (Claude Code, un script, une
automatisation) et l'**API Missive**.

Le principe tient en une phrase : **le jeton Missive reste sur le serveur, l'assistant
ne reçoit qu'un mot de passe révocable qui n'ouvre que quelques portes précises.**

Sans ça, il faudrait donner la clé complète de la boîte de réception à ton assistant —
avec le droit de tout lire, tout supprimer, tout fusionner. Ici, l'assistant peut lire un
fil, laisser une note, préparer un brouillon, fermer une conversation. Rien d'autre :
pas de suppression, pas de fusion, pas d'accès brut à l'API.

- Node 18+, **aucune dépendance npm**. Deux fichiers : `server.js` et `client.js`.
- Testé en production sur Render (offre gratuite suffisante), mais tourne partout où
  Node tourne.

---

## Table des matières

1. [Ce dont tu as besoin](#1-ce-dont-tu-as-besoin)
2. [Architecture (5 lignes)](#2-architecture-5-lignes)
3. [Installation locale (5 minutes)](#3-installation-locale-5-minutes)
4. [Déploiement sur Render](#4-déploiement-sur-render)
5. [Brancher un assistant dessus](#5-brancher-un-assistant-dessus)
6. [Le client en ligne de commande](#6-le-client-en-ligne-de-commande)
7. [Les routes HTTP](#7-les-routes-http)
8. [Sécurité — à lire avant d'exposer le service](#8-sécurité--à-lire-avant-dexposer-le-service)
9. [Pièges de l'API Missive (durement appris)](#9-pièges-de-lapi-missive-durement-appris)
10. [Dépannage](#10-dépannage)

---

## 1. Ce dont tu as besoin

| | |
|---|---|
| Un compte **Missive** | avec accès à l'API (Settings → API) |
| **Node 18 ou plus** | `node --version` doit afficher `v18` ou mieux. Le `fetch` natif est requis. |
| Un hébergeur | Render, Railway, Fly.io, un VPS, une Raspberry Pi… n'importe quoi qui laisse tourner un processus Node et donne une URL HTTPS |

### Créer le jeton Missive

1. Missive → **Settings** → **API** → **Create token**.
2. Donne-lui un nom explicite (« proxy IA »), copie la valeur `missive_pat-...`.
3. **Crée un jeton dédié à ce proxy.** C'est le point important : le jour où tu veux
   couper l'accès, tu révoques ce jeton-là et rien d'autre ne casse.

Le jeton n'est affiché qu'une fois. Range-le tout de suite dans les secrets de ton
hébergeur, pas dans un fichier du dépôt.

---

## 2. Architecture (5 lignes)

```
   toi / ton assistant                le proxy (ton hébergeur)          Missive
   ───────────────────                ────────────────────────          ───────
   client.js  ──── HTTPS ────────────▶  server.js  ──── HTTPS ──────────▶  API
   X-Proxy-Secret: <secret>             Authorization: Bearer <jeton>
   (secret révocable, périmètre         (le jeton ne sort JAMAIS d'ici,
    limité à ~18 actions)                jamais renvoyé, jamais journalisé)
```

Deux secrets distincts, deux niveaux de confiance. Celui que ton assistant détient ne
donne accès qu'aux actions codées dans `server.js` ; il ne permet pas de parler
directement à Missive.

---

## 3. Installation locale (5 minutes)

```bash
# 1. Récupère les fichiers (ou copie simplement le dossier)
cd missive-proxy

# 2. Prépare les variables
cp .env.example .env
$EDITOR .env            # colle MISSIVE_TOKEN, invente MISSIVE_PROXY_SECRET

# 3. Génère un secret solide si tu n'en as pas
openssl rand -hex 32

# 4. Démarre
node --env-file=.env server.js
#    (Node 18 : `set -a; source .env; set +a; node server.js`)
```

Dans un autre terminal :

```bash
curl -s localhost:3000/health
# → {"ok":true,"service":"missive-proxy"}

export MISSIVE_PROXY_URL=http://localhost:3000
export MISSIVE_PROXY_SECRET=<le même secret>
node client.js structure | head -40
```

Si `structure` renvoie tes équipes et tes étiquettes, tout est branché.

**`npm install` n'est pas nécessaire** : il n'y a aucune dépendance.

---

## 4. Déploiement sur Render

### Option A — à la main (Web Service)

1. Pousse ce dossier dans un dépôt Git (GitHub, GitLab…). **Vérifie que `.env` n'y est
   pas** — le `.gitignore` fourni s'en charge.
2. Render → **New** → **Web Service**, choisis ton dépôt.
3. Réglages :
   - **Root Directory** : `missive-proxy` (ou vide si `server.js` est à la racine)
   - **Runtime** : Node
   - **Build Command** : *(laisse vide)*
   - **Start Command** : `node server.js`
   - **Health Check Path** : `/health`
4. **Environment** → ajoute les secrets :

   | Clé | Valeur |
   |---|---|
   | `MISSIVE_TOKEN` | ton jeton `missive_pat-...` |
   | `MISSIVE_PROXY_SECRET` | ta longue chaîne aléatoire |
   | `MISSIVE_ORG` | *(facultatif)* seulement si plusieurs organisations |
   | `MISSIVE_SELF_ADDRESSES` | *(facultatif)* tes adresses d'envoi, séparées par des virgules |

5. Déploie, puis vérifie :

   ```bash
   curl -s https://<ton-service>.onrender.com/health
   # → {"ok":true,"service":"missive-proxy"}
   ```

### Option B — Blueprint

Le fichier `render.yaml` fourni décrit déjà tout ça : Render → **New** → **Blueprint**,
pointe sur ton dépôt, et il te demandera les deux secrets au moment du déploiement.

### Autres hébergeurs

Rien de spécifique à Render dans le code. Il faut juste :
un processus qui lance `node server.js`, la variable `PORT` respectée (le proxy la lit),
et les deux secrets dans l'environnement. Railway, Fly.io, Heroku, Docker, systemd sur un
VPS : tout marche.

> ⚠️ **Offre gratuite Render** : le service s'endort après ~15 minutes d'inactivité, et le
> premier appel qui le réveille peut prendre 30 à 60 secondes. Ce n'est pas une panne.
> Si ça gêne, passe au plan payant ou envoie un `GET /health` périodique.

---

## 5. Brancher un assistant dessus

Donne à l'assistant **deux choses** :

1. **L'URL du service** — publique, pas secrète.
2. **Le `MISSIVE_PROXY_SECRET`** — en **variable d'environnement de la session**, jamais
   collé dans une conversation, jamais écrit dans un fichier du dépôt.

Pour Claude Code, par exemple :

```bash
export MISSIVE_PROXY_URL=https://<ton-service>.onrender.com
export MISSIVE_PROXY_SECRET=<ton secret>
claude
```

L'assistant appelle ensuite `node client.js <commande>`. Il ne verra jamais le jeton
Missive : il n'existe pas dans son environnement.

Bon réflexe : commence par mettre la carte de la boîte en cache, elle ne change presque
jamais et évite un appel réseau à chaque question.

```bash
node client.js structure > missive_structure.json
```

Ce fichier ne contient **aucune donnée client** — que des identifiants de structure
(organisations, équipes, étiquettes, membres).

---

## 6. Le client en ligne de commande

`client.js` tourne chez toi et parle au proxy. Toutes les sorties sont du JSON.

### Lecture

```bash
node client.js health                       # sonde
node client.js structure                    # organisations, équipes, étiquettes, membres
node client.js list "shared_label=<ID>"     # conversations d'une étiquette
node client.js list "team_all=<ID>&limit=50"
node client.js read <convId> [nbMessages]   # fil nettoyé (défaut 10, max 200)
node client.js drafts <convId> [limit]      # brouillons du fil
node client.js notes <convId>               # notes internes
node client.js users                        # membres (id pour les assignations)
node client.js books                        # carnets d'adresses
node client.js contacts "nom ou courriel"   # retrouver un contact connu
```

### Pièces jointes

```bash
# `read` liste les pièces jointes de chaque message avec leur id.
node client.js read <convId> 30

# Télécharge et ÉCRIT SUR DISQUE (le base64 ne passe pas par le terminal)
node client.js attachment <messageId>                      # la première
node client.js attachment <messageId> <attachmentId>       # une précise
node client.js attachment <messageId> - rapport.pdf        # nom de sortie choisi
```

### Écriture

```bash
# Note interne
node client.js note <convId> "Client relancé, en attente du numéro de suivi."

# Étiquettes (keepClosed: true sur un fil déjà fermé, sinon il se rouvre)
echo '{"add":["<labelId>"],"remove":["<autreId>"],"keepClosed":true}' \
  | node client.js labels <convId>

# Fermer
node client.js close <convId> "Réglé."

# Répondre dans un fil — SANS "send", ça reste un BROUILLON
echo '{
  "from": "allo@exemple.com",
  "to": ["client@exemple.com"],
  "body": "Bonjour,\n\nVotre colis part demain.\n\nMerci !",
  "send": false
}' | node client.js reply <convId>

# Courriel NEUF, hors de tout fil (max 5 destinataires)
echo '{
  "from": "allo@exemple.com",
  "to": ["prospect@exemple.com"],
  "subject": "Suite à notre appel",
  "body": "Bonjour,\n\n…",
  "send": false
}' | node client.js send

# Tâche sur un fil
echo '{"title":"Rappeler le fournisseur","assignees":["<userId>"]}' \
  | node client.js task <convId>
```

> 🛑 **`"send": false` (ou champ absent) = brouillon.** Le message apparaît dans Missive
> et attend qu'un humain appuie sur envoyer. C'est le garde-fou principal quand un
> assistant rédige : garde-le par défaut, un courriel envoyé ne se rappelle pas.

---

## 7. Les routes HTTP

Toutes les routes `POST` exigent l'en-tête `X-Proxy-Secret: <MISSIVE_PROXY_SECRET>`.
`GET /health` est la seule exception.

| Méthode + route | Corps JSON | Effet |
|---|---|---|
| `GET /health` | — | sonde, sans auth |
| `POST /structure` | `{}` | carte de la boîte : organisations, équipes, étiquettes partagées (hiérarchie incluse), membres. Chaque bloc dégrade seul → champ `errors`. |
| `POST /list` | `{ filter }` | conversations correspondant à un filtre Missive (`shared_label=ID`, `team_all=ID`…) |
| `POST /conversation` | `{ id, limit }` | fil nettoyé et daté ; `limit` défaut 10, max 200 ; champ `tronque` si des messages restent au-delà |
| `POST /messageraw` | `{ messageId }` | enveloppe brute d'un message (utile sur Messenger/SMS, que `/conversation` aplatit) |
| `POST /attachment` | `{ messageId, attachmentId }` | une pièce jointe, renvoyée en base64 (≤ 25 Mo) ; sans `attachmentId`, la première |
| `POST /drafts` | `{ id, limit, raw }` | brouillons du fil ; `limit` pagine au-delà des 10 de l'API (max 500) |
| `POST /comments` | `{ id }` | notes internes ; dégrade en liste vide si l'API refuse |
| `POST /users` | `{}` | membres de l'organisation (id, nom, courriel) |
| `POST /task` | `{ id, title, assignees[], label }` | crée une tâche sur un fil |
| `POST /task-state` | `{ taskId, state, conversation }` | `todo` \| `in_progress` \| `closed` |
| `POST /postraw` | `{ id }` | post brut — **échoue toujours**, voir §9 |
| `POST /note` | `{ id, markdown }` | note interne |
| `POST /labels` | `{ id, add[], remove[], markdown, keepClosed }` | étiquettes partagées |
| `POST /close` | `{ id, note }` | ferme le fil (+ note) |
| `POST /reply` | `{ id, from, to[], cc[], subject, body, send, closeAfter, attachments[] }` | brouillon dans le fil ; `send:true` envoie ; `closeAfter:true` ferme ensuite |
| `POST /contact-books` | `{}` | carnets d'adresses (id, nom) |
| `POST /contacts` | `{ search, book, limit }` | recherche par nom, courriel, téléphone, organisation |
| `POST /send` | `{ from, to[], cc[], bcc[], subject, body, send, attachments[] }` | courriel neuf, hors fil ; **max 5 destinataires** |

Pièces jointes en écriture : `attachments: [{ base64_data, filename }]`, ~20 Mo au total.

Codes de retour : `200` succès · `400` paramètre manquant · `401` mauvais secret ·
`404` route inconnue · `502` erreur venue de Missive (le message est repris, tronqué à
300 caractères).

---

## 8. Sécurité — à lire avant d'exposer le service

- **Le jeton Missive n'est jamais renvoyé ni journalisé.** Il ne sert qu'aux appels
  sortants du serveur. Même le téléchargement d'une pièce jointe (dont l'URL exige le
  jeton) se fait côté serveur : c'est du base64 qui ressort, pas la clé.
- **Le `MISSIVE_PROXY_SECRET` est la seule porte.** Le service est joignable
  publiquement. Fais-le long et aléatoire (`openssl rand -hex 32`), garde-le hors du
  dépôt, hors des conversations. Il se révoque en changeant la variable et en
  redéployant.
- **Périmètre étroit et volontaire.** Pas de suppression, pas de fusion, pas de proxy
  brut vers l'API. Si tu ajoutes une route, demande-toi ce qu'un secret fuité pourrait
  en faire.
- **`/send` plafonne à 5 destinataires** (`MAX_DEST` dans `server.js`). Ce n'est pas un
  outil d'infolettre, et il vaut mieux que ça reste vrai.
- **Le brouillon est le défaut** sur `/reply` et `/send`. Ne renverse ce défaut qu'en
  connaissance de cause.
- **Deux secrets, deux rôles.** Ne réutilise pas le `MISSIVE_PROXY_SECRET` ailleurs, et
  ne donne jamais le jeton Missive à un environnement d'assistant.

---

## 9. Pièges de l'API Missive (durement appris)

Ces limites viennent de l'API, pas du proxy. Les connaître évite de longues séances de
débogage.

- **Les messages sont plafonnés à 10 par page**, quoi que tu demandes. Lire un fil de 25
  messages exige de paginer avec `until` — c'est ce que fait `/conversation`. Le champ
  `tronque: true` te dit qu'il reste des messages plus anciens : sans lui, on répond à un
  fil en n'ayant lu que la fin, sans le savoir.
- **Même plafond de 10 sur les brouillons.** D'où le `limit` de `/drafts` (max 500).
- **Le listage ne renvoie qu'un `preview` d'environ 130 caractères**, jamais le corps
  complet. Le proxy va chercher le corps message par message. Quand il n'y arrive pas, il
  le dit (`tronque: true`) plutôt que de faire passer un extrait pour un texte entier.
- **Un « post » n'est pas un « comment ».** Une note déposée par `/note` crée un *post* ;
  `GET /conversations/:id/comments` ne liste que les *comments*. La note est bien visible
  dans Missive, mais `/comments` ne la relira jamais.
- **`GET /posts/:id` n'existe pas** (404 « Invalid request URL »). La route `/postraw` est
  conservée par symétrie, mais elle échouera.
- **`POST /posts` ne renvoie pas l'id de la tâche créée**, seulement `{conversation, id}`.
  Conséquence : une tâche créée par le proxy ne peut être ni relue, ni refermée, ni
  dédoublonnée par lui. **Ne recrée jamais une tâche en supposant que la première a
  échoué** — tiens ton registre ailleurs.
- **Poster sur un fil fermé le rouvre.** D'où `keepClosed: true` sur `/labels` (qui envoie
  `reopen: false`). Sans ce drapeau, changer une étiquette ramène le fil dans l'inbox.
- **429 en cas de rythme trop soutenu.** Le proxy attend 260 ms entre deux appels et
  réessaie jusqu'à 3 fois après 30 s. Une grosse boucle prendra donc du temps : c'est
  voulu.

---

## 10. Dépannage

| Symptôme | Cause probable |
|---|---|
| `{"error":"unauthorized"}` | En-tête `X-Proxy-Secret` absent ou différent. Vérifie que les deux côtés portent exactement la même valeur (espace ou retour de ligne en trop inclus). |
| `Manque MISSIVE_TOKEN.` au démarrage | La variable n'est pas dans l'environnement du service. Sur Render : Environment, puis redéploie. |
| `502` avec `→ 401` de Missive | Jeton Missive invalide ou révoqué. Régénère-le dans Missive. |
| `502 … Aucune organisation visible` | Le jeton ne voit aucune organisation. Pose `MISSIVE_ORG` explicitement. |
| Premier appel très lent puis normal | Service endormi (offre gratuite Render). Normal. |
| `structure` renvoie des `errors` par bloc | Permission manquante sur ce type de ressource. Les autres blocs restent exploitables — c'est le comportement voulu. |
| `read` renvoie des textes vides | Le message n'a peut-être qu'une pièce jointe. Regarde le champ `attachments[]` et utilise `client.js attachment`. |
| `fetch is not defined` | Node trop vieux. Il faut Node 18+. |

---

## Licence

Fais-en ce que tu veux. Aucune garantie : c'est un outil interne partagé tel quel.
