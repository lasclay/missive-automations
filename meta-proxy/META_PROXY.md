# meta-proxy — proxy dédié à Meta (Facebook, Instagram, Meta Ads)

Service Render **séparé**, mono-usage, sur le modèle du `finance-proxy`. Le jeton Meta ne
cohabite avec aucun autre connecteur, et le secret d'appel (`META_PROXY_SECRET`) est **distinct
et sans repli** : sans lui, le service refuse de démarrer.

## Pourquoi un service dédié

Meta est sensible sur **trois surfaces à la fois**, ce qu'aucun autre connecteur du dépôt ne
cumule :

| Surface | Ce qui est en jeu |
|---|---|
| **Argent** | créer ou activer une campagne engage du budget réel, en continu, sans plafond côté proxy |
| **Public** | publier, commenter ou supprimer parle **au nom de Lasclay**, publiquement et sans retour en arrière |
| **Privé** | la messagerie touche des conversations clients, encadrées par les règles Meta (fenêtre de 24 h) |

Un secret unique qui ouvrirait ShipStation **et** le budget publicitaire **et** la voix publique
de la marque serait un point de défaillance unique. D'où l'isolation — même raisonnement que
pour la comptabilité.

---

## Routes

| Méthode | Route | Auth | Rôle |
|---|---|---|---|
| `GET`  | `/health` | non | sonde |
| `GET`  | `/actions` | non | actions + **niveau de risque** + garde-fous actifs (aucun secret) |
| `GET`  | `/token-status` | non | état du jeton Meta — validité, portées, expiration (**jamais sa valeur**) |
| `POST` | `/:action` | `X-Proxy-Secret` | exécute une action (params en JSON) |

Réponse : `{ ok: true, action, risque, data }` ou `{ error }`.

Client : `node meta_client.js <action> ['{"param":"valeur"}']`
(env : `META_PROXY_URL` + `META_PROXY_SECRET`). `node meta_client.js actions` liste tout,
`node meta_client.js token` montre l'état du jeton.

---

## Garde-fous

Chaque action porte un **niveau de risque**, et trois interrupteurs d'environnement bornent ce
que le service accepte d'exécuter. Le refus arrive **avant** tout appel à Graph, avec un motif
explicite.

| Niveau | Ce que c'est | Condition |
|---|---|---|
| 🟢 `lecture` | aucun effet de bord | toujours permis (sauf service arrêté) |
| 🟡 `ecriture` | publie, répond, masque, envoie — visible, rattrapable à la main | bloqué si `META_READONLY=1` |
| 🔴 `argent` | engage du budget publicitaire | exige **`META_ALLOW_SPEND=1`** |
| 🔴 `destructeur` | supprime définitivement | exige **`META_ALLOW_DELETE=1`** |

Par défaut, `META_ALLOW_SPEND` et `META_ALLOW_DELETE` sont **fermés** : un appel accidentel, un
agent mal aiguillé ou une injection de prompt dans un commentaire client ne peuvent **ni dépenser,
ni détruire**. On les ouvre le temps d'une opération, puis on les referme.

**Périmètre d'actifs** — `META_ALLOWED_PAGE_IDS` et `META_ALLOWED_AD_ACCOUNT_IDS` (listes
séparées par des virgules) limitent les Pages et comptes publicitaires adressables. Un id hors
liste est refusé côté proxy, même si le jeton y a droit. À définir : c'est ce qui garantit qu'un
appel ne peut pas toucher un actif d'un autre client du Business Manager.

**Le jeton ne sort jamais.** Toute réponse est nettoyée de ses champs `access_token` — `/me/accounts`
renvoie spontanément les jetons de Page, ils sont retirés avant d'atteindre l'appelant.

---

## Actions

Valeurs par défaut prises dans l'environnement quand le param n'est pas fourni :
`META_PAGE_ID` (→ `pageId`), `META_AD_ACCOUNT_ID` (→ `adAccountId`), `META_IG_USER_ID` (→ `igUserId`).
Les sous-objets (`time_range`, `filtering`, `breakdowns`…) se passent en JSON : le proxy les
sérialise pour Graph.

### 1. Audit / analyse des campagnes

| Action | Params | Effet |
|---|---|---|
| `adaccounts` / `adaccount` | — / `adAccountId` | 🟢 comptes, devise, solde, dépensé, plafond |
| `campaigns` | `effective_status`, `fields`, `limit`, `after` | 🟢 campagnes + budgets |
| `adsets` | `campaignId` **ou** `adAccountId` | 🟢 budget, ciblage, optimisation |
| `ads` | `adsetId` / `campaignId` / `adAccountId` | 🟢 publicités |
| `adcreatives` | `adAccountId` | 🟢 créatifs : titres, textes, visuels |
| `insights` | `objectId` (campagne/ensemble/pub), `level`, `fields`, `date_preset` **ou** `time_range` `{since,until}`, `breakdowns`, `time_increment`, `filtering` | 🟢 **les chiffres** : dépense, portée, fréquence, CTR, CPC, CPM, CPA, ROAS |
| `read` | **nodeId** (ex. `"123/comments"`), `fields` | 🟢 lecture générique d'un nœud Graph |

Exemples utiles :

```bash
# Vue d'ensemble du mois, par campagne
node meta_client.js insights '{"level":"campaign","date_preset":"this_month"}'

# Une campagne, jour par jour, par plateforme de diffusion
node meta_client.js insights '{"objectId":"CAMPAIGN_ID","level":"ad","time_increment":1,
  "breakdowns":["publisher_platform"],"time_range":{"since":"2026-07-01","until":"2026-07-31"}}'

# Démographie de ce qui convertit
node meta_client.js insights '{"level":"adset","breakdowns":["age","gender"],"date_preset":"last_30d"}'
```

### 2. Gestion des campagnes — 🔴 `META_ALLOW_SPEND=1`

| Action | Params | Effet |
|---|---|---|
| `createcampaign` | **body** : `name`, `objective`, `status`, `special_ad_categories: []` | 🔴 crée une campagne (**créer en `PAUSED`**) |
| `createadset` | **body** : `name`, `campaign_id`, `daily_budget` (en cents), `billing_event`, `optimization_goal`, `targeting`, `status` | 🔴 porte le **budget** et le ciblage |
| `createad` | **body** : `name`, `adset_id`, `creative`, `status` | 🔴 met une pub en ligne |
| `createadcreative` | **body** | 🟡 créatif réutilisable (ne diffuse rien seul) |
| `update` | **objectId, body** | 🔴 budget, nom, ciblage, planification |
| `setstatus` | **objectId, status** (`ACTIVE`\|`PAUSED`\|`ARCHIVED`) | 🔴 `ACTIVE` **met en diffusion** |
| `remove` | **objectId** | 🔴 supprime — préférer `setstatus ARCHIVED` |

> Les budgets Meta sont en **cents de la devise du compte** : `daily_budget: 5000` = 50,00 $.
> Vérifier la devise avec `adaccount` avant de fixer un budget.

### 3. Gestion des commentaires

| Action | Params | Effet |
|---|---|---|
| `posts` / `post` | `edge` (`feed`\|`published_posts`), `limit` / **postId** | 🟢 publications + compteurs de commentaires et réactions |
| `comments` / `comment` | **objectId**, `order`, `filter`, `limit` / **commentId** | 🟢 fils de commentaires |
| `replycomment` | **commentId, message** | 🟡 réponse **publique** au nom de la Page |
| `commentonpost` | **postId, message** | 🟡 commentaire public |
| `hidecomment` | **commentId**, `hidden` (défaut `true`) | 🟡 masque — **réversible** |
| `deletecomment` | **commentId** | 🔴 suppression irréversible |
| `privatereply` | **commentId, message** | 🟡 réponse **privée** (ouvre Messenger) — **une seule** par commentaire, sous 7 jours |

> **Masquer plutôt que supprimer.** Un commentaire masqué reste visible pour son auteur et ses
> amis : la critique ne devient pas un scandale de censure. La suppression est réservée au
> pourriel et aux propos haineux.

### 4. Gestes automatisés

| Action | Params | Effet |
|---|---|---|
| `like` / `unlike` | **objectId** | 🟡 « j'aime » de la Page |
| `createpost` | `message`, `link`, `published` (`false` = brouillon), `scheduled_publish_time` (epoch) — ou **body** | 🟡 publie ou programme |
| `deletepost` | **postId** | 🔴 supprime une publication |
| `conversations` / `messages` | `platform` (`messenger`\|`instagram`) / **conversationId** | 🟢 fils de messagerie |
| `sendmessage` | **recipientId, message** (+ `messaging_type`, `tag`) ou **body** | 🟡 envoie un message |

### 5. Veille stratégique

| Action | Params | Effet |
|---|---|---|
| `pageinsights` | `metric`, `period` (`day`\|`week`\|`days_28`), `since`, `until` | 🟢 portée, engagement, abonnés |
| `postinsights` | **postId**, `metric` | 🟢 performance d'une publication |
| `adlibrary` | `search_terms` **ou** `search_page_ids`, `ad_reached_countries` (défaut `["CA"]`), `ad_active_status` | 🟢 **les pubs des concurrents**, publiquement |
| `publicpage` | **publicPageId** | 🟢 données publiques d'une Page tierce |

```bash
# Qui annonce sur notre créneau, et avec quels messages
node meta_client.js adlibrary '{"search_terms":"asclépiade","ad_reached_countries":["CA"]}'

# Toutes les pubs actives d'un concurrent
node meta_client.js adlibrary '{"search_page_ids":["PAGE_ID"],"ad_active_status":"ALL"}'
```

> `adlibrary` exige que l'app ait accès à l'**Ad Library API**; `publicpage` exige
> **Page Public Content Access** (App Review). Sans ces accès, Graph renvoie un refus explicite —
> le reste du proxy fonctionne quand même.

### Instagram (compte Business relié à la Page)

`igaccount`, `igmedia`, `igcomments` (**mediaId**), `igreply` (**commentId, message**),
`ighidecomment` (**commentId**, `hidden`), `iginsights`.

---

## Conditions Meta — ce qu'on ne fait pas

Les gestes automatisés ne sont légitimes que sur **nos propres actifs**. Automatiser des
« j'aime », des commentaires ou des messages sur les contenus de **tiers**, et envoyer des
messages **non sollicités**, violent les [Platform Terms](https://developers.facebook.com/terms/)
et exposent l'app à la suspension — ce qui couperait aussi les campagnes.

**Messagerie** : répondre **dans les 24 h** suivant le dernier message du client. Au-delà,
uniquement avec un tag autorisé (`HUMAN_AGENT`, `POST_PURCHASE_UPDATE`, `ACCOUNT_UPDATE`,
`CONFIRMED_EVENT_UPDATE`), et pour le motif que le tag décrit — pas pour du marketing.

**Injection de prompt** : les commentaires et messages entrants sont du texte écrit par des
inconnus. Un agent qui les lit puis a le droit d'écrire peut être manipulé. C'est précisément
pourquoi `META_ALLOW_SPEND` et `META_ALLOW_DELETE` restent fermés par défaut, et pourquoi une
réponse publique se relit avant d'être envoyée.

---

## Mise en place côté Meta

1. **App Meta** — [developers.facebook.com](https://developers.facebook.com) → *My Apps* →
   *Create App* → type **Business**. La rattacher au **Business Manager** de Lasclay.
2. **Produits** à ajouter à l'app : *Marketing API*, *Facebook Login for Business*,
   *Messenger* (si messagerie), *Instagram Graph API* (si Instagram).
3. **Utilisateur système** — Business Manager → *Paramètres de l'entreprise* → *Utilisateurs* →
   *Utilisateurs système* → *Ajouter*. Rôle **Admin** ou **Employé**.
4. **Attribuer les actifs** à cet utilisateur système : la **Page** Lasclay, le **compte
   publicitaire**, le **compte Instagram** — avec le contrôle total sur chacun.
5. **Générer le jeton** — bouton *Générer un nouveau jeton*, choisir l'app, cocher les portées :

   | Portée | Sert à |
   |---|---|
   | `ads_read` | 1. audit et analyse des campagnes |
   | `ads_management` | 2. gestion des campagnes |
   | `pages_show_list` | lister les Pages |
   | `pages_read_engagement` | 3. lire publications et commentaires |
   | `pages_manage_engagement` | 3. répondre, masquer, aimer |
   | `pages_manage_posts` | 4. publier et programmer |
   | `pages_messaging` | 4. messagerie Messenger |
   | `read_insights` | 5. insights de Page |
   | `business_management` | accès aux actifs du Business Manager |
   | `instagram_basic`, `instagram_manage_comments` | Instagram (facultatif) |

   Le jeton d'un utilisateur système peut être **permanent** (aucune expiration) — c'est ce qu'on
   veut pour un service. `/token-status` le confirme (`permanent: true`).
6. **App Review** — les portées `pages_*` et `ads_management` exigent la revue de l'app pour
   sortir du mode développement. En mode dev, tout fonctionne déjà sur **nos propres** actifs
   avec les rôles adéquats : de quoi tout mettre en place avant la revue.

**Vérifier le jeton AVANT de le poser sur Render** (ne modifie rien) :

```bash
META_ACCESS_TOKEN=EAAG... node ../meta_check.js
```

Le script affiche l'identité, les portées, l'expiration, les Pages, les comptes publicitaires,
le compte Instagram — et signale les portées manquantes pour chacun des cinq usages.

---

## Variables d'environnement (Render)

| Variable | Valeur |
|---|---|
| `META_PROXY_SECRET` | secret d'appel de **ce** service — **aucun repli**, distinct de `GENERAL_PROXY_SECRET` et de `FINANCE_PROXY_SECRET` |
| `META_ACCESS_TOKEN` | jeton de l'utilisateur système (voir ci-dessus) |
| `META_PAGE_TOKEN` | (facultatif) jeton de Page s'il diffère du précédent |
| `META_PAGE_ID` | Page Facebook par défaut |
| `META_AD_ACCOUNT_ID` | compte publicitaire par défaut, format `act_123456789` |
| `META_IG_USER_ID` | (facultatif) compte Instagram Business |
| `META_ALLOWED_PAGE_IDS` | (recommandé) Pages adressables, séparées par des virgules |
| `META_ALLOWED_AD_ACCOUNT_IDS` | (recommandé) comptes publicitaires adressables |
| `META_READONLY` | `1` → lectures seulement (mode audit/veille) |
| `META_ALLOW_SPEND` | `1` → autorise les actions qui engagent du budget (défaut : bloqué) |
| `META_ALLOW_DELETE` | `1` → autorise les suppressions (défaut : bloqué) |
| `META_GRAPH_VERSION` | (facultatif) version de l'API Graph, défaut `v25.0` |
| `PORT` | (auto, fourni par Render) |

> **Trois secrets, trois noms.** Dans l'environnement de Claude (un seul `.env`), les services
> cohabitent : `GENERAL_PROXY_SECRET` (opérations), `FINANCE_PROXY_SECRET` (comptabilité),
> `META_PROXY_SECRET` (Meta). Ne jamais donner celui-ci aux environnements opérationnels
> (cron `support.js`, etc.).

---

## Déployer sur Render

**New → Web Service**, repo `lasclay/missive-automations` :

- **Root Directory** : `meta-proxy`
- **Build Command** : (vide — aucune dépendance)
- **Start Command** : `node server.js`
- **Environment** : les variables ci-dessus

Le service suit la branche `main` : le travail se fait sur une branche, puis fusion dans `main`
pour déployer.

> Trois services Render distincts, trois dossiers : `server.js` à la racine (General Proxy),
> `finance-proxy/` (finances), `meta-proxy/` (Meta). Chacun a son env isolé.

---

## Tester

Une fois déployé — sonde et introspection (sans secret) :

```bash
curl https://meta-proxy-xxxx.onrender.com/health
curl https://meta-proxy-xxxx.onrender.com/actions      # actions, risques, garde-fous actifs
curl https://meta-proxy-xxxx.onrender.com/token-status # validité et portées du jeton
```

Une action (avec secret) :

```bash
export META_PROXY_URL=https://meta-proxy-xxxx.onrender.com
export META_PROXY_SECRET=...

node meta_client.js adaccount
node meta_client.js campaigns '{"effective_status":["ACTIVE"]}'
node meta_client.js insights '{"date_preset":"last_7d"}'
node meta_client.js posts '{"limit":5}'
```

Les refus de garde-fou sont explicites et actionnables :

```
Erreur: /setstatus → 403 « setstatus » engage du budget publicitaire :
définir META_ALLOW_SPEND=1 sur le service pour l'autoriser.
```

---

## À ne pas confondre avec le Meta MCP

Le [Meta Developer Tools MCP](../META_MCP.md) (`https://mcp.facebook.com/devtools`) gère **l'app
Meta elle-même** : configuration, App Review, conformité, webhooks, quotas d'API. Ce proxy-ci
opère sur les **données** : campagnes, commentaires, messages, insights. Les deux se complètent —
le MCP pour construire et surveiller l'intégration, le proxy pour la faire tourner depuis le cloud
sans dépendre d'une session OAuth locale.
