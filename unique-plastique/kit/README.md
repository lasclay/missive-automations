# Kit d'automatisation — Unique Plastique

Tout ce qu'il faut pour brancher Claude (ou n'importe quel script) sur **Missive**,
**Shopify**, **ShipStation** et **QuickBooks Online** sans jamais mettre une clé d'API
dans le dépôt ni dans l'environnement de l'agent.

Ce kit est une copie, adaptée et dépersonnalisée, de l'infrastructure qui tourne en
production chez Lasclay. Le code est en Node 18+ pur — **aucune dépendance npm**.

---

## Le principe : le secret ne quitte jamais le serveur

```
   Claude / script                Render (public)                  API tierce
   ───────────────                ───────────────                  ──────────
   MISSIVE_PROXY_SECRET  ──POST──▶  missive-proxy   ──Bearer──▶  api.missiveapp.com
   GENERAL_PROXY_SECRET  ──POST──▶  general-proxy   ──Basic───▶  ssapi.shipstation.com
   FINANCE_PROXY_SECRET  ──POST──▶  finance-proxy   ──OAuth2──▶  quickbooks.api.intuit.com
```

L'agent ne connaît qu'un **secret d'appel révocable**, propre à chaque proxy. Les vraies
clés (jeton Missive, clé ShipStation, refresh token Intuit) vivent uniquement dans les
variables d'environnement Render. Si un environnement de session fuit, on change une
variable et c'est réglé — sans toucher aux comptes tiers.

Corollaire important : **trois services séparés, trois secrets séparés.** La compta ne
partage jamais son secret avec les opérations. Un script d'expédition qui déraille ne peut
pas écrire dans QuickBooks.

---

## Ce qu'il y a dans la boîte

| Dossier | Quoi | Déployer sur Render ? |
| --- | --- | --- |
| `missive-proxy/` | Boîte de courriel Missive : lire un fil, poser une note, étiqueter, fermer, répondre, créer une tâche, envoyer un courriel neuf | oui — service 1 |
| `general-proxy/` | ShipStation (accès complet, 33 actions), Omnisend (10), Klaviyo (lecture seule, 21) | oui — service 2 |
| `finance-proxy/` | QuickBooks Online : rapports, requêtes, lecture et écriture d'entités | oui — service 3 |
| `clients/` | Les scripts en ligne de commande que Claude appelle. **Ne se déploient pas** — ils vivent dans le dépôt, à côté de l'agent. | non |
| `skills/` | Trois skills Claude Code qui apprennent à l'agent quoi appeler et quand | non |
| `CLAUDE.md.exemple` | La carte d'accès à mettre à la racine du dépôt | non |

Shopify n'a pas de proxy : `clients/shopify_check.js` parle directement à l'Admin API avec
un jeton lu dans l'environnement. Voir la section Shopify plus bas.

---

## Installation, dans l'ordre

### 1. Créer le dépôt

Copie le contenu de `kit/` à la racine d'un nouveau dépôt GitHub privé — par exemple
`unique-plastique/automations`. Les trois dossiers `*-proxy/` deviennent trois **Root
Directory** distincts dans Render ; les `clients/` et `skills/` restent dans le dépôt.

Renomme `CLAUDE.md.exemple` en `CLAUDE.md` à la racine et remplis les URL de tes services
au fur et à mesure que tu les déploies. Déplace `skills/` vers `.claude/skills/`.

### 2. Déployer les trois services Render

Pour chacun : **New → Web Service**, ton dépôt, **Root Directory** = le dossier du proxy,
**Build Command** vide, **Start Command** `node server.js`. Puis les variables :

**missive-proxy** — voir `missive-proxy/README.md`
| Variable | Valeur |
| --- | --- |
| `MISSIVE_TOKEN` | jeton Missive dédié (`missive_pat-…`), révocable |
| `MISSIVE_PROXY_SECRET` | une longue chaîne aléatoire que tu inventes |
| `MISSIVE_ORG` | id de ton organisation (découvert par `POST /structure`) |
| `MISSIVE_SELF_ADDRESSES` | tes adresses d'envoi, séparées par des virgules |

**general-proxy** — voir `general-proxy/CONNECTORS_PROXY.md`
| Variable | Valeur |
| --- | --- |
| `GENERAL_PROXY_SECRET` | une autre longue chaîne, **différente** de la précédente |
| `SHIPSTATION_API_KEY` / `SHIPSTATION_API_SECRET` | ShipStation → Account → API Settings |
| `OMNISEND_API_KEY` | facultatif — connecteur désactivé si absent |
| `KLAVIYO_API_KEY` | facultatif — connecteur désactivé si absent |

**finance-proxy** — voir `finance-proxy/FINANCE_PROXY.md`
| Variable | Valeur |
| --- | --- |
| `FINANCE_PROXY_SECRET` | une troisième chaîne, **aucun repli** : sans elle le service refuse de démarrer |
| `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` | app Intuit sur developer.intuit.com |
| `QBO_REALM_ID` | Company ID QuickBooks |
| `QBO_REFRESH_TOKEN` | obtenu une fois via `clients/qbo_auth.js` |
| `RENDER_API_KEY` / `RENDER_SERVICE_ID` | recommandé — laisse le service resynchroniser tout seul le refresh token tournant d'Intuit |

Un connecteur sans ses variables est simplement **désactivé** ; les autres continuent de
fonctionner. `GET /connectors` (sans secret) dit lesquels sont allumés.

### 3. Vérifier

```bash
curl https://<missive>.onrender.com/health     # {"ok":true}
curl https://<general>.onrender.com/connectors # liste + enabled: true/false
curl https://<finance>.onrender.com/health
```

### 4. Donner les secrets à la session Claude

Dans l'environnement de la session (jamais dans le chat, jamais commités) :

```bash
MISSIVE_PROXY_URL=https://<missive>.onrender.com
MISSIVE_PROXY_SECRET=...
GENERAL_PROXY_URL=https://<general>.onrender.com
GENERAL_PROXY_SECRET=...
FINANCE_PROXY_URL=https://<finance>.onrender.com
FINANCE_PROXY_SECRET=...
SHOPIFY_STORE=uniqueplastique.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_...
```

Donne `FINANCE_PROXY_SECRET` **uniquement** aux sessions qui font de la comptabilité.
Les crons d'expédition n'en ont pas besoin et ne doivent pas l'avoir.

---

## Utilisation

```bash
# Missive
node clients/missive_client.js structure > missive_structure.json
node clients/missive_client.js list "shared_label=<ID>"
node clients/missive_client.js read <convId> 20
node clients/missive_client.js note <convId> "commande vérifiée dans Shopify"

# ShipStation
node clients/connectors_client.js connectors
node clients/connectors_client.js shipstation orders '{"orderNumber":"1001"}'
node clients/connectors_client.js shipstation shipments '{"trackingNumber":"1Z..."}'
node clients/connectors_client.js shipstation getrates '{"carrierCode":"canada_post","fromPostalCode":"G6V 7E4","toPostalCode":"H2X 1Y4","toCountry":"CA","weight":{"value":90,"units":"grams"}}'

# Shopify
SHOPIFY_STORE=uniqueplastique.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_... \
  node clients/shopify_check.js 1001

# QuickBooks
node clients/finance_client.js companyinfo
node clients/finance_client.js report '{"name":"ProfitAndLoss","start_date":"2026-01-01","end_date":"2026-12-31"}'
node clients/finance_client.js query '{"query":"select * from Account maxresults 200"}'
```

---

## Les garde-fous, à lire avant de brancher un cron

Ces règles viennent de vraies erreurs en production. Elles valent plus cher que le code.

**Argent réel.** `shipstation createlabelfororder` et `createlabel` **débitent le wallet**.
`getrates` non (aucun effet de bord) — c'est ce qu'il faut appeler pour comparer des prix.
`voidlabel` annule et rembourse. `deleteorder` annule la commande. Ces actions existent
dans l'allowlist parce qu'elles sont utiles, pas parce qu'elles sont anodines : un agent
qui les appelle doit avoir été explicitement mandaté pour ça.

**Envoi de courriel : brouillon par défaut.** `reply` et `send` ne partent que si tu passes
`"send": true`. Laisse le défaut tant que tu n'as pas des semaines de brouillons corrects
derrière toi. Un brouillon raté coûte dix secondes ; un courriel raté coûte un client.

**Vérifier avant de promettre.** Avant de dire à quelqu'un que son colis est parti, croise
**Shopify ET ShipStation** — les deux, pas l'un ou l'autre. Shopify peut afficher
« fulfilled » sur une étiquette créée mais jamais ramassée. C'est la source d'erreur la
plus fréquente d'un agent de support.

**Ne pas rouvrir un fil fermé.** `POST /labels` avec `keepClosed: true` quand le fil est
déjà fermé, sinon Missive le remonte dans la boîte de quelqu'un.

**Compta : lire avant d'écrire.** `create`, `update` et `remove` du finance-proxy touchent
un vrai livre comptable. Interroge d'abord (`query`, `read`, `report`), montre ce que tu
comptes faire, puis écris.

---

## Ce que ce kit ne contient pas

- Les **connaissances métier** de Lasclay (politiques de retour, ton de marque, règles de
  décision du service client). C'est spécifique à chaque entreprise — les skills de ce kit
  couvrent les *accès*, pas les *décisions*.
- Un connecteur Shopify dans le general-proxy. Shopify passe en direct pour l'instant ; si
  tu veux le même isolement que le reste, ajoute une entrée dans le registre `CONNECTEURS`
  de `general-proxy/server.js` — la structure est faite pour ça (un connecteur = un objet
  avec `enabled()`, `actions{}`).
- Les scripts d'automatisation eux-mêmes (tri de boîte, réponses IA, rapprochement
  comptable). Ce kit donne les tuyaux ; ce qui coule dedans se construit ensuite.
