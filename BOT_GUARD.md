# Bot-guard — protection anti-bots Shopify

## Contexte

Le 2026-07-28, une purge a supprimé **3 286 faux clients** de Shopify : 8 clusters de
noms anglais génériques numérotés (`anna.taylor262@gmail.com`, `david.jones48@outlook.com`,
`emily.davis…`, `james.smith…`, `john.johnson…`, `michael.brown…`, `robert.williams…`,
`sarah.wilson…`, ~400 variantes chacun), créés en rafales depuis avril 2026, 0 commande,
aucune adresse. **19 bots supplémentaires** avaient chacun 1 commande de *card testing*
(compte créé et commande passée la même seconde, toutes remboursées) — non supprimables,
ils portent les tags `bot` + `bot-card-testing`.

Le bot-guard empêche la vague de revenir : il écoute les webhooks Shopify et neutralise
les nouveaux bots dès leur apparition.

## Fonctionnement

Route `POST /webhooks/shopify` sur le **proxy général** (`server.js` → `bot_guard.js`),
authentifiée par la **signature HMAC** de Shopify (pas par `X-Proxy-Secret`).

Deux niveaux de détection (email `prenom.nom<numéro>@gmail|outlook.com`) :

| Verdict | Critère | customers/create | orders/create |
|---|---|---|---|
| **bot** (confirmé) | nom dans la liste des 8 clusters (+ `BOT_GUARD_NAMES`) | tag `bot` | **annulation** (FRAUD, remboursement, restock, sans courriel) + tags `bot`, `bot-card-testing` |
| **suspect** | même forme d'email, nom hors liste | tag `bot-suspect` | rien (zéro faux positif) |

Les commandes de vrais clients ne sont jamais touchées : l'annulation exige un nom de la
liste confirmée. Les `bot-suspect` se retrouvent dans l'admin via le filtre de tag pour
inspection humaine ; si un nouveau cluster apparaît, l'ajouter à `BOT_GUARD_NAMES`.

## Mise en service (une fois)

1. **App admin Shopify** (Paramètres → Applications → Développer des applications) avec
   scopes `read_customers, write_customers, read_orders, write_orders` (l'app existante
   du support peut servir si elle a ces scopes).
2. **Variables Render** sur le service general-proxy :
   - `SHOPIFY_STORE` — sous-domaine (ex. `lasclay`)
   - `SHOPIFY_ADMIN_TOKEN` — jeton Admin API de l'app
   - `SHOPIFY_WEBHOOK_SECRET` — **clé secrète API** de la même app (signe les webhooks)
   - `BOT_GUARD_NAMES` — optionnel, noms `prenom.nom` additionnels séparés par virgules
3. **Fusionner dans `main`** (Render déploie automatiquement).
4. **Enregistrer les webhooks** : `node bot_guard_setup.js` (avec `SHOPIFY_STORE`,
   `SHOPIFY_ADMIN_TOKEN`, et `GENERAL_PROXY_URL` si différent du défaut). Idempotent.

## Vérification

- `curl -X POST https://general-proxy-5muf.onrender.com/webhooks/shopify` → doit répondre
  `401 signature invalide` (ou `503` si variables manquantes).
- Logs Render : chaque interception écrit une ligne `bot-guard <topic>: {...}`.
- Admin Shopify → Clients → filtre tag `bot-suspect` : file d'inspection humaine.
