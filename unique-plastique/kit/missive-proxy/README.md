# missive-proxy

Proxy HTTP **restreint** entre Claude (ou n'importe quel script) et l'API Missive. But : laisser
Claude lire des fils, poser des notes, fermer, répondre — **sans jamais voir le jeton Missive**.
Le jeton vit dans les secrets Render ; l'appelant n'a qu'un `MISSIVE_PROXY_SECRET` révocable,
à périmètre limité.

## Déploiement Render (Web Service)

1. **New → Web Service**, ton dépôt GitHub.
2. **Root Directory** : `kit/missive-proxy` (ou l'endroit où tu as copié ce dossier)
3. **Runtime** : Node · **Build Command** : *(vide)* · **Start Command** : `node server.js`
4. **Environment** (secrets) :
   - `MISSIVE_TOKEN` = ton jeton Missive (`missive_pat-...`) — **dédié à ceci, révocable**
   - `MISSIVE_PROXY_SECRET` = une longue chaîne aléatoire que tu inventes (le mot de passe du proxy)
   - `MISSIVE_ORG` = l'id de ton organisation Missive (voir « Trouver son org » ci-dessous)
   - `MISSIVE_SELF_ADDRESSES` = tes adresses d'envoi, séparées par des virgules
     (ex. `info@uniqueplastique.ca,distributeur@uniqueplastique.ca`) — sert à distinguer
     NOUS de EUX dans un fil
5. Déploie. Vérifie : `GET https://<ton-service>.onrender.com/health` → `{"ok":true}`

Donne ensuite à Claude **l'URL du service** (publique, pas secrète). Le `MISSIVE_PROXY_SECRET`,
mets-le en variable d'environnement de la session Claude Code — jamais dans le chat, jamais
dans le dépôt.

### Trouver son org

Au premier démarrage, `MISSIVE_ORG` peut manquer : le service démarre quand même et affiche un
avertissement. Appelle `POST /structure` : le bloc `organizations` te donne l'id. Mets-le dans
Render, redéploie, et tout le reste s'allume.

## Sécurité

- Le jeton Missive n'est **jamais** renvoyé ni journalisé.
- Toute route (sauf `/health`) exige l'en-tête `X-Proxy-Secret`. Le proxy étant public,
  ce secret est la porte : garde-le long et **révoque-le** en changeant la variable au besoin.
- Périmètre volontairement étroit (pas de suppression, pas de fusion, pas d'accès brut).
- Crée un **jeton Missive dédié** : tu peux le révoquer sans casser tes autres scripts.
- `/send` (courriel neuf) est plafonné à 5 destinataires : c'est du contact ciblé,
  pas de l'envoi de masse.

## Endpoints

| Méthode + route | Corps JSON | Effet |
|---|---|---|
| `GET /health` | — | sonde (sans auth) |
| `POST /structure` | `{}` | carte de la boîte : organisations, équipes, étiquettes partagées (hiérarchie incluse), membres. Chaque bloc dégrade seul → champ `errors`. À mettre en cache. |
| `POST /list` | `{ "filter": "shared_label=ID" }` | liste des conversations (filtre Missive) |
| `POST /conversation` | `{ "id": "...", "limit": 10 }` | fil complet nettoyé (NOUS/EUX, daté) |
| `POST /drafts` | `{ "id": "...", "raw": false }` | brouillons déjà rédigés sur le fil |
| `POST /comments` | `{ "id": "..." }` | notes internes |
| `POST /users` | `{}` | membres de l'org (id, nom, courriel) |
| `POST /task` | `{ "id", "title", "assignees":[], "label" }` | crée une tâche sur le fil |
| `POST /task-state` | `{ "taskId", "state" }` | `todo` \| `in_progress` \| `closed` |
| `POST /note` | `{ "id": "...", "markdown": "..." }` | note interne |
| `POST /close` | `{ "id": "...", "note": "..." }` | ferme le fil (+ note) |
| `POST /labels` | `{ "id", "add":[], "remove":[], "keepClosed" }` | étiquettes ; `keepClosed:true` évite de rouvrir un fil fermé |
| `POST /reply` | `{ "id", "from", "to":[], "cc":[], "subject", "body", "send", "closeAfter", "attachments":[{"base64_data","filename"}] }` | crée un brouillon ; `send:true` envoie ; `closeAfter:true` ferme ensuite |
| `POST /contact-books` | `{}` | carnets d'adresses |
| `POST /contacts` | `{ "search", "book", "limit" }` | retrouve un contact connu de la boîte |
| `POST /send` | `{ "from", "to":[], "cc":[], "bcc":[], "subject", "body", "send", "attachments":[] }` | **courriel neuf**, hors de tout fil. Défaut = brouillon. Max 5 destinataires. |

Toutes les routes POST exigent l'en-tête `X-Proxy-Secret: <MISSIVE_PROXY_SECRET>`.

## Client en ligne de commande

Voir `../clients/missive_client.js` :

```bash
export MISSIVE_PROXY_URL=https://<ton-service>.onrender.com
export MISSIVE_PROXY_SECRET=...

node missive_client.js health
node missive_client.js structure > missive_structure.json
node missive_client.js list "shared_label=<ID>"
node missive_client.js read <convId> 20
node missive_client.js note <convId> "vérifié dans Shopify, commande expédiée"
echo '{"from":"info@uniqueplastique.ca","to":[{"address":"client@exemple.com"}],"subject":"...","body":"<p>...</p>"}' \
  | node missive_client.js reply <convId>
```

Sans `"send": true`, `reply` et `send` créent un **brouillon** : un humain appuie sur envoyer.
C'est le défaut recommandé tant que tu n'as pas confiance dans la boucle.
