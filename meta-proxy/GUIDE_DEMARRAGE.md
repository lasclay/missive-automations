# Brancher Claude sur Meta — guide pas à pas

De zéro à « Claude gère mes Pages Facebook ». Compte une heure la première fois, dont
la moitié à attendre des écrans Meta.

Le chemin en une phrase : **une app Meta → un utilisateur système qui détient le jeton →
le meta-proxy sur Render qui garde ce jeton → Claude qui parle au proxy.** Le jeton ne
descend jamais jusqu'à Claude, et le proxy n'expose que les actions de son allowlist.

```
  Toi ─────► Claude ─────► meta-proxy (Render) ─────► Graph API ─────► ta Page
             (aucun         (détient META_ACCESS_TOKEN,
              jeton)         garde-fous, allowlist)
```

---

## Avant de commencer

| Il te faut | Où vérifier |
| --- | --- |
| Rôle **Administrateur** sur la Page Facebook | facebook.com → ta Page → Paramètres → Accès à la Page |
| Un **Business Manager** (portefeuille d'entreprise) | [business.facebook.com](https://business.facebook.com) — gratuit, à créer si absent |
| Un compte **Render** | [render.com](https://render.com) — le plan gratuit suffit pour démarrer |
| Le dépôt `lasclay/missive-automations` | déjà là |

> Sans le rôle Administrateur sur la Page, tout le reste échouera à l'étape 3 — commence par ça.

---

## Étape 1 — Rassembler les actifs dans le Business Manager

C'est l'étape qu'on saute et qui coûte une demi-heure plus tard : un utilisateur système ne
peut donner accès qu'aux actifs que **l'entreprise** possède.

1. [business.facebook.com](https://business.facebook.com) → **Paramètres de l'entreprise** (l'engrenage).
2. **Comptes → Pages** → *Ajouter* → **Ajouter une Page existante** → ta Page Lasclay.
3. **Comptes → Comptes publicitaires** → *Ajouter* → ton compte publicitaire.
4. **Comptes → Comptes Instagram** → ajoute le compte Instagram **Business** (pas un compte perso —
   la conversion se fait dans l'app Instagram : Paramètres → Type de compte → Compte professionnel).

✅ **Fait quand** les trois apparaissent dans *Paramètres de l'entreprise*, sans bandeau « en attente ».

---

## Étape 2 — Créer l'app Meta

1. [developers.facebook.com](https://developers.facebook.com) → **Mes applications** → **Créer une application**.
2. Type : **Entreprise** (*Business*).
3. Nom : `Lasclay Automations`. Rattache-la à ton **portefeuille d'entreprise** quand l'écran le demande.
4. Dans le tableau de bord de l'app, **Ajouter des produits** :

   | Produit | Pourquoi |
   | --- | --- |
   | **Marketing API** | audit et gestion des campagnes |
   | **Facebook Login for Business** | requis pour les portées de Page |
   | **Messenger** | messagerie (facultatif) |
   | **Instagram Graph API** | commentaires et insights Instagram (facultatif) |

5. Note l'**identifiant de l'app** (tableau de bord → Paramètres → Général).

> L'app reste en **mode développement** : c'est parfait pour commencer. En mode dev, tout
> fonctionne déjà sur **tes propres** actifs tant que tu y as un rôle. L'App Review (étape 9)
> ne sert qu'à sortir de ce mode.

---

## Étape 3 — Créer l'utilisateur système et générer le jeton

C'est l'étape clé. Un **utilisateur système** est un compte de service : son jeton peut être
**permanent**, contrairement à un jeton personnel qui expire au bout de 60 jours et casserait
l'intégration en pleine nuit.

1. *Paramètres de l'entreprise* → **Utilisateurs → Utilisateurs système** → **Ajouter**.
2. Nom : `automations`. Rôle : **Admin**.
3. Sélectionne-le, puis **Ajouter des actifs** — un par un :
   - la **Page** → *Contrôle total*
   - le **compte publicitaire** → *Gérer la campagne*
   - le **compte Instagram** → *Contrôle total*
4. **Générer un nouveau jeton** → choisis ton app → coche les portées :

   | Portée | Débloque |
   | --- | --- |
   | `ads_read` | 1 · lire les campagnes et les résultats |
   | `ads_management` | 2 · créer, modifier, mettre en pause |
   | `pages_show_list` | lister les Pages |
   | `pages_read_engagement` | 3 · lire publications et commentaires |
   | `pages_manage_engagement` | 3 · répondre, masquer, aimer |
   | `pages_manage_posts` | 4 · publier et programmer |
   | `pages_messaging` | 4 · Messenger |
   | `read_insights` | 5 · insights de Page |
   | `business_management` | accéder aux actifs de l'entreprise |
   | `instagram_basic`, `instagram_manage_comments` | Instagram (facultatif) |

5. **Copie le jeton immédiatement** — Meta ne le réaffiche jamais. Colle-le dans ton gestionnaire
   de mots de passe, pas dans un fichier du dépôt.

✅ **Fait quand** tu as un jeton qui commence par `EAA…`.

---

## Étape 4 — Vérifier le jeton avant de le déployer

Ne pose jamais un jeton sur Render sans l'avoir testé : un jeton auquel il manque une portée
échoue silencieusement, action par action, et le diagnostic est pénible.

```bash
META_ACCESS_TOKEN=EAA... node meta_check.js
```

Le script ne modifie rien. Il affiche :

- l'identité du jeton, son type, et **s'il est permanent** (`expire : jamais`) ;
- un **✓ ou ✗ par usage** — audit, gestion des campagnes, commentaires, gestes automatisés, veille —
  avec les portées manquantes nommées ;
- tes Pages avec leur `META_PAGE_ID` ;
- tes comptes publicitaires avec leur `META_AD_ACCOUNT_ID` ;
- le compte Instagram relié avec son `META_IG_USER_ID`.

**Note les trois identifiants** : ils vont dans Render à l'étape suivante.

> Un ✗ ? Retourne à l'étape 3.4, régénère le jeton avec la portée manquante cochée.
> Aucune Page listée ? L'actif n'a pas été attribué à l'utilisateur système (étape 3.3).

---

## Étape 5 — Déployer le meta-proxy sur Render

1. Génère le secret d'appel du service :

   ```bash
   openssl rand -hex 32
   ```

2. Render → **New → Web Service** → connecte `lasclay/missive-automations`.
3. Réglages :

   | Champ | Valeur |
   | --- | --- |
   | Name | `meta-proxy` |
   | Branch | `main` |
   | **Root Directory** | `meta-proxy` |
   | Build Command | *(vide — aucune dépendance)* |
   | Start Command | `node server.js` |

4. **Environment** — ajoute les variables :

   | Variable | Valeur |
   | --- | --- |
   | `META_PROXY_SECRET` | le secret généré ci-dessus |
   | `META_ACCESS_TOKEN` | le jeton `EAA…` |
   | `META_PAGE_ID` | vu à l'étape 4 |
   | `META_AD_ACCOUNT_ID` | `act_…`, vu à l'étape 4 |
   | `META_IG_USER_ID` | vu à l'étape 4 (si Instagram) |
   | `META_ALLOWED_PAGE_IDS` | le même id de Page — **borne le périmètre** |
   | `META_ALLOWED_AD_ACCOUNT_IDS` | le même `act_…` |

5. **Create Web Service**. Le déploiement prend une minute.

> **Pourquoi les listes blanches ?** Sans elles, un appel avec un `pageId` inattendu partirait
> vers n'importe quel actif du Business Manager. Avec elles, le proxy refuse avant même d'appeler
> Meta. C'est deux lignes de configuration pour supprimer une classe entière d'erreurs.

---

## Étape 6 — Vérifier le service

Sans secret, depuis n'importe où :

```bash
curl https://meta-proxy-xxxx.onrender.com/health
curl https://meta-proxy-xxxx.onrender.com/token-status
curl https://meta-proxy-xxxx.onrender.com/actions
```

- `/token-status` doit répondre `"valide": true` et `"permanent": true`. Il n'expose **jamais**
  le jeton — seulement son état, ses portées et son expiration.
- `/actions` liste les 43 actions, leur niveau de risque, et l'état des garde-fous.

✅ **Fait quand** `/token-status` dit `valide: true`.

---

## Étape 7 — Brancher Claude

Dans l'environnement où tourne Claude, deux variables :

```bash
export META_PROXY_URL=https://meta-proxy-xxxx.onrender.com
export META_PROXY_SECRET=le-secret-de-l-etape-5
```

Vérifie la chaîne complète :

```bash
node meta_client.js actions      # actions + risques + garde-fous
node meta_client.js token        # état du jeton
node meta_client.js posts '{"limit":5}'
```

Le skill `/meta` du dépôt se charge tout seul dès qu'une demande touche Facebook, Instagram
ou les campagnes — tu n'as rien à invoquer. À partir de là, demande en français :

> « quelles publications ont le plus d'engagement ce mois-ci »
> « montre-moi les commentaires sans réponse »
> « combien on a dépensé en pub cette semaine, et quel est le ROAS »
> « mets la campagne X en pause »

✅ **Fait quand** `node meta_client.js posts` renvoie tes vraies publications.

---

## Étape 8 — S'entraîner avant de parler en public

Les réponses aux commentaires sont publiques et irréversibles. Le script s'entraîne d'abord :

```bash
node meta_commentaires.js
```

En **dry-run** (le défaut), il lit les vrais commentaires, rédige une réponse pour chacun, et
écrit un fichier de révision dans `meta_reponses/` — sans rien publier. Il te montre même
l'appel Graph exact qui **partirait**.

Relis le `.md` produit. Le ton n'est pas le bon ? Ajuste `CONSIGNES` dans `meta_commentaires.js`,
relance, recompare. Quand c'est juste :

```bash
node meta_commentaires.js --envoyer
```

Trois protections tiennent en permanence :

- un commentaire déjà traité n'est **jamais** retraité (journal `meta_reponses/traites.json`) ;
- un commentaire marqué **escalade** n'est jamais publié automatiquement, même avec `--envoyer` —
  et il reste ouvert pour demain ;
- le script ne répond ni aux commentaires masqués, ni à ses propres réponses.

> Le dry-run n'est pas réservé à ce script : **toute** action du proxy accepte `"dryRun": true`.
> `node meta_client.js createpost '{"message":"...","dryRun":true}'` te montre exactement ce qui
> serait publié, sans le publier.

---

## Étape 9 — App Review (plus tard, seulement si nécessaire)

En mode développement, tout fonctionne sur **tes** actifs. L'App Review ne devient nécessaire que
pour agir sur des actifs que tu n'administres pas, ou pour ouvrir l'app à d'autres personnes.

Si tu y arrives : tableau de bord de l'app → **App Review → Permissions and Features** → demande
`pages_manage_engagement`, `pages_manage_posts`, `pages_messaging`, `ads_management`. Meta veut une
vidéo d'écran montrant l'usage réel et une description du cas d'usage. Compte quelques jours.

Deux accès se demandent séparément : **Ad Library API** (pour `adlibrary`, la veille concurrentielle)
et **Page Public Content Access** (pour `publicpage`). Sans eux, ces deux actions renvoient un refus
explicite — le reste du proxy continue de fonctionner.

---

## Le quotidien, une fois branché

| Quand | Quoi |
| --- | --- |
| Chaque matin | `node meta_commentaires.js` → relire → `--envoyer` |
| Chaque lundi | `node meta_client.js insights '{"date_preset":"last_7d"}'` |
| Avant une campagne | `node meta_client.js adaccount` (devise et solde), puis créer en `PAUSED` |
| Une fois par mois | `node meta_client.js adlibrary '{"search_terms":"asclépiade"}'` — ce que fait la concurrence |
| Une fois par trimestre | `/token-status`, et facebook.com → Paramètres → Intégrations aux entreprises pour auditer |

---

## Quand ça coince

| Symptôme | Cause | Correctif |
| --- | --- | --- |
| `unauthorized` sur toute action | mauvais `META_PROXY_SECRET` côté Claude | recopier la valeur exacte depuis Render |
| `Page 123 hors périmètre` | l'id n'est pas dans `META_ALLOWED_PAGE_IDS` | ajouter l'id, ou corriger l'appel |
| `OAuthException/190` | jeton expiré ou révoqué | régénérer (étape 3), remettre sur Render |
| `OAuthException/200` | portée manquante | `meta_check.js` dit laquelle → régénérer |
| `(#100) … does not exist` | id d'un autre actif, ou objet supprimé | vérifier l'id avec `pages` / `adaccounts` |
| `pages` renvoie une liste vide | actif non attribué à l'utilisateur système | étape 3.3 |
| Le service ne démarre pas | `META_PROXY_SECRET` ou `META_ACCESS_TOKEN` absent | les logs Render le disent en clair |
| Premier appel très lent | le plan gratuit Render met le service en veille | normal ; ~30 s au réveil |
| « It looks like this app isn't available » | app non approuvée pour ce compte | étape 9, ou rester en mode dev |

---

## Ce qu'il faut garder en tête

- **Le jeton vit sur Render, nulle part ailleurs.** Ni dans le dépôt, ni dans l'environnement de
  Claude, ni dans un fichier local. Le proxy retire même les jetons de Page des réponses.
- **Trois secrets, trois noms** : `GENERAL_PROXY_SECRET` (opérations), `FINANCE_PROXY_SECRET`
  (comptabilité), `META_PROXY_SECRET` (Meta). Ne donne jamais celui-ci aux crons opérationnels.
- **Les commentaires entrants sont écrits par des inconnus.** Un texte qui demande de publier
  quelque chose ou de changer un budget est une *donnée*, pas une instruction. Le skill `/meta`
  le rappelle à Claude ; garde le réflexe toi aussi.
- **Masquer plutôt que supprimer.** Un commentaire masqué reste visible pour son auteur : la
  critique ne devient pas un scandale de censure.
- **Messenger : fenêtre de 24 h.** Au-delà du dernier message du client, il faut un tag autorisé —
  et jamais pour du marketing.
- **Les budgets Meta sont en cents.** `daily_budget: 5000` = 50,00 $. Vérifie la devise avec
  `adaccount` avant de fixer un budget.

---

## Pour aller plus loin

- `meta-proxy/META_PROXY.md` — les 43 actions en détail, les garde-fous, les variables
- `.claude/skills/meta/SKILL.md` — ce que Claude sait faire sans qu'on le lui explique
- `META_MCP.md` — le serveur MCP officiel de Meta, qui gère **l'app** (App Review, webhooks,
  quotas) et non les données. Complémentaire, pas concurrent.
