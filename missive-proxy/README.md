# missive-proxy

Proxy HTTP **restreint** entre Claude et l'API Missive. But : laisser Claude lire des
fils, poser des notes, fermer, répondre — **sans jamais voir le jeton Missive**. Le
jeton vit dans les secrets Render; Claude n'a qu'un `PROXY_SECRET` révocable, à
périmètre limité.

## Déploiement Render (Web Service)

1. **New → Web Service**, repo `lasclay/missive-automations`.
2. **Root Directory** : `missive-proxy`
3. **Runtime** : Node · **Build Command** : (vide) · **Start Command** : `node server.js`
4. **Environment** (secrets) :
   - `MISSIVE_TOKEN` = ton jeton Missive (`missive_pat-...`) — **dédié à ceci, révocable**
   - `MISSIVE_PROXY_SECRET` = une longue chaîne aléatoire que tu inventes (le mot de passe du proxy).
     *(Repli accepté : `PROXY_SECRET`, si tu n'as pas encore migré le nom.)*
5. Déploie. Vérifie : `GET https://<ton-service>.onrender.com/health` → `{"ok":true}`

Donne ensuite à Claude **l'URL du service** (publique, pas secrète). Le `MISSIVE_PROXY_SECRET`,
mets-le en variable d'environnement de la session Claude Code (jamais dans le chat).

## Sécurité

- Le jeton Missive n'est **jamais** renvoyé ni journalisé.
- Toute route (sauf `/health`) exige l'en-tête `X-Proxy-Secret`. Le proxy étant public,
  ce secret est la porte : garde-le long et **révoque-le** en changeant la variable au besoin.
- Périmètre volontairement étroit (pas de suppression, pas de fusion, pas d'accès brut).
- Crée un **jeton Missive dédié** : tu peux le révoquer sans casser tes autres scripts.

## Endpoints

| Méthode + route | Corps JSON | Effet |
|---|---|---|
| `GET /health` | — | sonde (sans auth) |
| `POST /structure` | `{}` | carte de la boîte : organisations, équipes, étiquettes partagées (hiérarchie incluse), membres. Chaque bloc dégrade seul → champ `errors`. À mettre en cache dans `missive_structure.json`. |
| `POST /list` | `{ "filter": "shared_label=ID" }` | liste des conversations (filtre Missive) |
| `POST /conversation` | `{ "id": "..." }` | fil complet nettoyé (NOUS/EUX, daté) |
| `POST /note` | `{ "id": "...", "markdown": "..." }` | note interne |
| `POST /close` | `{ "id": "...", "note": "..." }` | ferme le fil (+ note) |
| `POST /reply` | `{ "id", "from", "to":[], "cc":[], "subject", "body", "send", "closeAfter", "attachments":[{"base64_data","filename"}] }` | crée un brouillon; `send:true` envoie; `closeAfter:true` ferme ensuite; pièces jointes en base64 (≤ ~20 Mo au total) |

Toutes les routes POST exigent l'en-tête `X-Proxy-Secret: <MISSIVE_PROXY_SECRET>`.
