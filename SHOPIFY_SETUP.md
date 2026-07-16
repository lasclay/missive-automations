# Brancher Shopify sur `support.js` (vérification du vrai statut de commande)

Quand `SHOPIFY_STORE` **et** `SHOPIFY_ADMIN_TOKEN` sont présents dans l'environnement,
`support.js` retrouve chaque commande (numéro `L-xxxxx` repéré dans le sujet ou le fil)
dans Shopify et injecte son **vrai statut** (date, articles, expédiée / en préparation,
numéro de suivi) dans le prompt avant de rédiger. Sans ces variables, le script se comporte
**exactement comme avant** (formulations prudentes, aucune donnée Shopify). C'est donc
100 % additif et sans risque.

Utile surtout pour la boîte **« Mise à jour commande »** (prévente de la fin mai).

---

## Ce qu'il vous reste à faire (≈ 2 min) : créer l'app custom + le jeton

> La création d'une app custom et la génération du jeton Admin se font **obligatoirement**
> dans l'interface Admin Shopify (aucune API ne le fait à votre place). Voici les étapes exactes.

> ⚠️ **Ne pas confondre avec le « Dev Dashboard » / app partenaire** (écran « Create version »,
> App URL, Redirect URLs, embed…). Ça, c'est le flux OAuth d'une app hébergée : inutile ici et
> beaucoup plus lourd. Nous voulons l'**app custom du magasin** ci-dessous, qui donne un jeton
> `shpat_…` permanent sans OAuth ni code hébergé.

Raccourci direct : **`https://admin.shopify.com/store/lasclay/settings/apps/development`**

1. Admin Shopify → **Réglages** (Settings) → **Applications et canaux de vente** (Apps and sales channels).
2. Cliquer **Développer des applications** (Develop apps) → **Autoriser le développement d'applications** si demandé.
3. **Créer une application** (Create an app). Nom : `support-bot` (ou ce que vous voulez). Développeur : vous.
4. Onglet **Configuration de l'API Admin** (Admin API integration) → **Configurer** (Configure).
5. Cocher **uniquement** la portée en lecture des commandes :
   - `read_orders`
   - (facultatif, pour voir les numéros de suivi côté fulfillments : `read_fulfillments`)
   - Rien d'autre. Pas d'écriture.
6. **Enregistrer** (Save).
7. Onglet **Identifiants de l'API** (API credentials) → **Installer l'application** (Install app).
8. **Révéler le jeton d'accès Admin API** (Reveal token once). Il commence par `shpat_...`.
   ⚠️ Il n'est affiché **qu'une seule fois** : copiez-le tout de suite.

> Note `read_orders` ne couvre que les 60 derniers jours par défaut. La quasi-totalité de la
> boîte « Mise à jour commande » (prévente fin mai → aujourd'hui) est dans cette fenêtre. Si vous
> devez lire des commandes plus vieilles, demandez l'accès à `read_all_orders` dans la même page
> de portées (Shopify l'accorde aux apps custom sur simple case à cocher).

---

## Variables à mettre dans Render

Sur le service Render qui exécute `node support.js` (voir plus bas), ajouter :

| Variable              | Valeur                                   |
|-----------------------|------------------------------------------|
| `SHOPIFY_STORE`       | `lasclay.myshopify.com`                  |
| `SHOPIFY_ADMIN_TOKEN` | le jeton `shpat_...` révélé à l'étape 8  |
| `SHOPIFY_API_VERSION` | `2024-10` (facultatif, valeur par défaut)|

C'est tout. Au prochain run, le log affichera :
`Shopify (vérif. statut commande): ACTIF (lasclay.myshopify.com, API 2024-10).`

### Vérifier le jeton avant de déployer

```
SHOPIFY_STORE=lasclay.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_xxx node shopify_check.js L-50468
```
Affiche le vrai statut de la commande (ou les 3 dernières sans argument), ou un message clair
si le jeton / la portée `read_orders` sont invalides. Lecture seule, ne modifie rien.

---

## Déployer `support.js` sur Render (rappel)

`support.js` est un **script batch** (pas le proxy). Il tourne comme **Cron Job** Render :

1. **New → Cron Job**, repo `lasclay/missive-automations`, **Root Directory** vide (racine).
2. **Runtime** Node · **Build Command** `npm install` (ou vide, aucune dépendance) ·
   **Command** `node support.js`.
3. **Schedule** : ex. `0 12,17,21 * * *` (3 fois par jour, comme prévu).
4. **Environment** (secrets) :
   - `MISSIVE_TOKEN` = jeton API Missive
   - `ANTHROPIC_API_KEY` = clé Anthropic
   - `SHOPIFY_STORE`, `SHOPIFY_ADMIN_TOKEN` (ci-dessus)
   - **Rodage recommandé** : commencer avec `DRY_RUN=true` (ne crée / n'envoie rien, log seulement),
     vérifier les décisions dans les logs, puis passer `DRY_RUN=false` (brouillons), et seulement
     ensuite éventuellement `AUTO_SEND=true` pour l'envoi automatique des cas propres.

> Le proxy (`missive-proxy/`) reste un service **séparé**. Il ne fait que relayer des appels
> Missive et n'a **pas** besoin de la clé Anthropic ni du jeton Shopify.
