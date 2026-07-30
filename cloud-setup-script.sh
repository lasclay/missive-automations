#!/bin/bash
# =============================================================================
# Setup script — Lasclay / missive-automations
# A coller dans le champ « Setup script » du dialogue d environnement sur
# claude.ai/code (dernier champ). Tourne en root AVANT le lancement de Claude
# Code, doit sortir 0. Son resultat est mis en cache sous forme d instantane du
# systeme de fichiers : il ne retourne que si tu le modifies, si tu changes les
# domaines reseau, ou apres ~7 jours.
#
# Il fait trois choses :
#   1. depose les commandes /missive /qbo /proxygen /autoloop la ou vivent les
#      skills de compte, pour qu elles existent dans TOUTE nouvelle session
#   2. pose les permissions et le contexte du classificateur en settings
#      utilisateur, seul endroit d ou autoMode est lu
#   3. regle le fuseau horaire du Quebec
# =============================================================================
set -u
mkdir -p /root/.claude/skills

# --- 1. Les commandes slash ------------------------------------------------
# Verifie : un skill depose ici est vu sans figurer dans manifest.json, et un
# dossier deja present survit a la synchro des skills de compte.
mkdir -p /root/.claude/skills/missive
cat > /root/.claude/skills/missive/SKILL.md <<'SKILLEOF'
---
name: missive
description: Boîte support Missive de Lasclay — accès via le proxy Missive, lecture des fils et brouillons, notes internes, tâches, fermeture, envoi de réponses, plus les connaissances de service client et de marque nécessaires pour rédiger. Couvre aussi les scripts d'automatisation de la boîte : réponses IA, digest d'opérations, filtrage, révision, archivage.
when_to_use: Déclenche dès qu'il est question du proxy Missive, de la boîte support, d'un fil ou d'une conversation client, d'un brouillon, d'une note interne, du digest des opérations, ou de répondre à un client Lasclay. Déclenche même sans le mot Missive — « lis le fil de la cliente qui attend son colis », « prépare une réponse pour la commande en rupture », « qu'est-ce qu'il y a dans la boîte support ce matin », « ferme la conversation », « assigne ça à Catherine ».
argument-hint: [ce que tu veux faire dans la boîte support]
allowed-tools:
  - Bash(node missive_client.js:*)
  - Bash(node support.js:*)
  - Bash(node digest.js:*)
  - Bash(node filtrage.js:*)
  - Bash(node revision.js:*)
  - Bash(node revision_ia.js:*)
  - Bash(node analyse.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# Boîte support Missive — Lasclay

N'explore pas pour retrouver comment joindre Missive : tout est ci-dessous.

## Prérequis

Le client est `missive_client.js`, un script Node du dépôt **`lasclay/missive-automations`**. Il
n'est pas déployé : il tourne dans la session et lit l'URL et le secret depuis l'environnement.

| Variable | Rôle |
| --- | --- |
| `MISSIVE_PROXY_SECRET` | requis, repli sur `PROXY_SECRET` |
| `MISSIVE_PROXY_URL` | facultatif, défaut `https://proxy-missive.onrender.com` |

Si le répertoire courant n'est pas ce dépôt, les appels échoueront : vérifie avec
`ls missive_client.js`. Dépôt absent → dis-le, ne reconstruis pas l'appel à la main. Le secret ne
doit jamais être écrit en dur ni affiché.

Commence par la sonde, qui vaut test d'authentification :

```bash
node missive_client.js health     # attendu : {"ok":true,"service":"missive-proxy"}
```

Premier appel ~10 s : Render endort le service au repos. Ce n'est pas une panne, ne relance pas.

## Premier réflexe : la carte de la boîte

Rien d'utile ne se fait sans les **Resource ID** de Missive — étiquettes partagées, équipes,
organisation, membres. Ne les redécouvre pas à chaque session, et ne les devine jamais.

**1. Lis le cache d'abord.** `missive_structure.json` à la racine du dépôt contient la carte :
organisations, équipes, étiquettes partagées avec leur hiérarchie, membres. Un `Read` suffit, c'est
instantané, et ça te donne de quoi construire un filtre utile tout de suite.

**2. S'il est absent ou visiblement périmé**, capture-le puis écris-le :

```bash
node missive_client.js structure > missive_structure.json
```

Vérifie ensuite le champ `errors` du JSON : chaque bloc dégrade indépendamment, donc une
permission manquante sur un type laisse les autres exploitables. Committe le fichier — c'est ce qui
rend la prochaine session rapide. Il ne contient que des identifiants de structure, aucune donnée
client.

**3. Si `structure` renvoie 404 `route inconnue`**, la route existe dans le code du dépôt mais n'est
pas déployée : les services Render suivent `main`. Dis-le, et rabats-toi sur `users`, qui fonctionne
depuis toujours.

Avec la carte en main : les `shared_labels[].id` alimentent `list "shared_label=<ID>"`,
`name_with_parent_names` donne le chemin lisible d'une étiquette imbriquée, et les `users[].id`
servent aux assignations de tâches.

## Lecture

```bash
node missive_client.js structure          # organisations, équipes, étiquettes partagées, membres
node missive_client.js list "<filtre>"    # fils correspondant au filtre
node missive_client.js read <convId>      # une conversation, messages compris
node missive_client.js drafts <convId>    # brouillons rédigés par le script IA
node missive_client.js notes <convId>     # notes internes / commentaires
node missive_client.js users              # membres de l'org : id, nom, courriel
```

### Le filtre de `list` — à lire avant de l'utiliser

Le filtre est transmis **tel quel** à l'API Missive, sur `/conversations?<filtre>&limit=50`. Tout
paramètre de cette API fonctionne donc, pas seulement `shared_label`. Mais le proxy **pagine
jusqu'à épuisement** : un filtre large ramène tout, lentement.

Mesuré sur la boîte réelle :

| Filtre | Résultat |
| --- | --- |
| `assigned=true` | 38 fils — rapide, bon point de départ |
| `inbox=true` | 3214 fils — très lent, évite sauf besoin réel |
| `all=true` | expire — ne l'utilise pas |
| `shared_label=<ID>` | selon l'étiquette |

Commence toujours par le filtre le plus étroit qui répond à la question. Les ID d'étiquettes
viennent de la carte décrite plus haut, jamais d'une supposition.

### Membres de l'organisation

Deux personnes : **Catherine Bedard-Mercier** et **Gabriel Gouveia**. Prends leurs identifiants dans
la carte ou via `users` avant toute assignation de tâche — ne devine jamais un id.

## Écriture — confirme avant

Ces actions modifient la boîte partagée ou sortent vers le client. Demande confirmation, sauf
instruction explicite dans le tour courant.

```bash
node missive_client.js note <convId> "texte markdown"      # 🟡 note interne
node missive_client.js task <convId>                       # 🟡 JSON {title,assignees[],label} sur stdin
node missive_client.js close <convId> "note optionnelle"    # 🟡 ferme le fil
node missive_client.js reply <convId>                      # 🔴 ENVOIE au client, JSON de brouillon sur stdin
```

`reply` est en plus couvert par une règle `permissions.ask` : il demandera même en mode auto.
C'est voulu — un courriel envoyé ne se rappelle pas.

Le proxy expose aussi `/posts` et `/postraw`, que le client ne couvre pas. Si une tâche les
exige, signale-le au lieu d'improviser un appel HTTP avec le secret.

## Rédiger une réponse

Deux fichiers du dépôt, volumineux — lis la section utile avec `grep -n '^###'`, ne les récite
jamais en entier.

**`connaissance_support.md`** — la référence de rédaction. Structure :

1. Ton de marque
2. Savoir officiel en réponses types par thème, avec leur volume : expédition et suivi (31),
   plantation et bombes semencières (26), produits et questions techniques (25), accusés de
   réception et politesse (21), précommandes et ruptures de stock (21), retours échanges et
   remboursements (17), tailles et échanges (17), garantie et satisfaction (16), logistique
   spéciale — grèves, douanes, USA (14), clôtures et politesse (13), ateliers et points de vente
   (9), problèmes de livraison (9), fraude et sécurité (2)
3. Logiques de décision internes, en exemples commentés
4. Catégories de demandes avec volumes sur deux ans — `suivi_livraison` domine à 3728 fils,
   devant `question_pre_achat` à 1802

**`contexte_lasclay.md`** — identité, histoire, mission, théorie du changement, l'asclépiade et
ses propriétés, les monarques, l'agriculture, la fabrication, le catalogue par saison
(hiver, été et plein air, quotidien, jardin et horticulture, matières, collaborations, corporatif).

Charge aussi le skill **`lasclay-master`** pour toute rédaction destinée à un client : ton de voix
et garde-fous de marque. Et **`lasclay-seo`** si la tâche touche une fiche produit ou du contenu
public.

## Vérifier un envoi — règle ferme

Une question de suivi se tranche avec **deux** sources, jamais une seule : Shopify pour la
commande, ShipStation pour l'expédition et le numéro de suivi. Une commande payée peut n'avoir
aucune expédition créée ; une expédition peut exister sans suivi transmis. Ces deux cas se
répondent différemment, et c'est la catégorie la plus volumineuse de la boîte — donc celle où
l'erreur coûte le plus.

Pour ShipStation, charge le skill **`proxygen`**. Les deux skills coexistent dans le même tour.

## Scripts de la boîte

- `support.js` — réponses IA. Vérifie Shopify **et** ShipStation avant de répondre sur un envoi.
- `digest.js` — digest des opérations. `analyse.js`, `filtrage.js` — tri et analyse des fils.
- `revision.js`, `revision_ia.js` — révision des brouillons.
- `archive.js`, `purge.js`, `nettoyage.js`, `merge.js`, `repartition_merge.js` — entretien.
- `admin_ops.js`, `prevente.js`, `draftrefresh.js` — administratif et prévente.

Lis l'en-tête du script avant de le lancer : plusieurs agissent sur la boîte réelle.

## Contexte d'entreprise

**Les Produits Lasclay Inc**, siège à Québec — marque québécoise de produits isolés à la soie
d'asclépiade : plein air, accessoires, glacières souples, semences. Vente en ligne sur lasclay.com
en français et en anglais, expéditions au Canada et aux États-Unis.

Le service client se fait dans les deux langues : **réponds toujours dans celle du client**.
L'asclépiade est aussi la plante hôte du monarque, ce qui donne à la marque une dimension
écologique réelle — plusieurs questions clients portent là-dessus plutôt que sur un produit.
SKILLEOF

mkdir -p /root/.claude/skills/qbo
cat > /root/.claude/skills/qbo/SKILL.md <<'SKILLEOF'
---
name: qbo
description: Accès à QuickBooks Online via le Finance Proxy de Lasclay, service Render séparé des opérations pour isoler les finances. Couvre les rapports (P&L, bilan, balance de vérification, grand livre, flux de trésorerie, âge des comptes), les requêtes SQL-like v3, la lecture et l'écriture d'entités de tenue de livres, le téléchargement de pièces jointes, et l'import du chiffrier de prévisions.
when_to_use: Déclenche dès qu'il est question de QuickBooks, QBO, du proxy finance, d'un état financier, d'un compte de charge, d'un rapprochement bancaire, d'une écriture comptable, de l'exercice fiscal, ou de chiffres comptables de Lasclay. Déclenche même sans le mot QuickBooks, par exemple « sors-moi le P&L du dernier trimestre », « est-ce que cette dépense est classée », « publie les factures d'Anthropic », « c'est quoi nos marges ce mois-ci ».
argument-hint: [ce que tu veux consulter ou publier dans QBO]
allowed-tools:
  - Bash(node finance_client.js:*)
  - Bash(node qbo_check.js:*)
  - Bash(node qbo_import.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# QuickBooks Online — Finance Proxy Lasclay

N'explore pas pour retrouver comment joindre QBO : tout est ci-dessous.

## Prérequis — à vérifier en premier

Service Render **dédié**, distinct du proxy des opérations, précisément pour isoler les finances.
Code dans `finance-proxy/` du dépôt **`lasclay/missive-automations`**. Le client est un script
Node de ce dépôt, non déployé.

| Variable | Rôle |
| --- | --- |
| `FINANCE_PROXY_SECRET` | requis — **distinct** du `GENERAL_PROXY_SECRET`, aucun repli |
| `FINANCE_PROXY_URL` | requis |

Ce secret n'est jamais donné aux environnements opérationnels : c'est le point de l'isolation.
Si le répertoire courant n'est pas le dépôt, vérifie avec `ls finance_client.js` et signale-le
plutôt que de reconstruire un appel à la main.

Commence par le test d'authentification, qui valide aussi le refresh token Intuit :

```bash
node finance_client.js               # sonde : {"ok":true,"service":"finance-proxy"}
node finance_client.js companyinfo   # attendu : CompanyName « Les Produits Lasclay Inc »
```

Si `companyinfo` échoue en 401, le refresh token Intuit est à tourner — procédure dans
`finance-proxy/FINANCE_PROXY.md`. Ne tente pas de le renouveler sans le demander.
Premier appel ~10 s : Render endort le service au repos.

## Lecture

| Action | Paramètres | Retour |
| --- | --- | --- |
| `companyinfo` | — | infos compagnie, test d'auth |
| `report` | **name** + `start_date`/`end_date`, `summarize_column_by` (`Month`…), `accounting_method` (`Accrual`\|`Cash`) | le rapport |
| `query` | **query** (SQL-like QBO v3) | résultats |
| `read` | **entity, id** | l'entité, avec son `SyncToken` courant |
| `download` | **id** d'un `Attachable`, trouvé via `query` | pièce jointe en base64, max 15 Mo |

Noms de rapports : `ProfitAndLoss`, `BalanceSheet`, `TrialBalance`, `GeneralLedger`, `CashFlow`,
`AgedReceivables` et les autres rapports v3.

```bash
node finance_client.js report '{"name":"ProfitAndLoss","start_date":"2025-09-01","end_date":"2026-08-31","summarize_column_by":"Month"}'
node finance_client.js query '{"query":"SELECT * FROM Vendor WHERE DisplayName LIKE '\''Anthropic%'\''"}'
```

## Écriture — ça touche les livres réels

| Action | Paramètres | Effet |
| --- | --- | --- |
| `create` | **entity, body** (objet QBO v3) | 🟡 crée ; QBO apparie au flux bancaire automatiquement |
| `update` | **entity, body** avec **Id + SyncToken** (sparse par défaut) | 🟡 modifie |
| `remove` | **entity, body** avec **Id + SyncToken** | 🔴 supprime une transaction, **irréversible** |

Trois règles fermes :

1. **Relis via `read` juste avant tout `update` ou `remove`** pour avoir le `SyncToken` courant.
   Un token périmé fait échouer l'appel : c'est une protection contre l'écrasement concurrent,
   pas un bogue à contourner.
2. **Confirme avant** chaque `create`, `update` et `remove`, sauf instruction explicite dans le
   tour courant. Ces trois actions sont couvertes par des règles `permissions.ask` : elles
   demanderont même en mode auto.
3. **Ne publie jamais en lot sans avoir montré un échantillon** : une pièce mal classée en
   série coûte plus cher à défaire qu'à vérifier.

## Exercice fiscal — 1er septembre au 31 août

Toute borne de rapport et toute comparaison annuelle s'aligne là-dessus, jamais sur l'année
civile. L'exercice nommé par son année de fin : l'exercice 2026 court du 1er septembre 2025 au
31 août 2026.

Attention au fuseau : le conteneur peut démarrer en UTC, ce qui décale « aujourd'hui » d'un jour
en soirée heure du Québec et fausse une borne de rapport. Vérifie avec `date` quand la date
compte, et utilise `TZ=America/Montreal` au besoin.

## Import du chiffrier

`node qbo_import.js` produit les TSV « QBO P&L à maj » et « QBOBS à maj », destinés au chiffrier
de prévisions. Le mappage des comptes vit dans `qbo_mapping.json` — si un compte manque au
rapport, c'est là qu'il faut regarder avant de conclure à un problème QBO.

`qbo_auth.js` fait l'autorisation OAuth Intuit, une seule fois. `qbo_check.js` valide l'accès en
direct. Doc complète : `finance-proxy/FINANCE_PROXY.md`.

## Skills à charger

- **`bookkeeping-lasclay`** — tenue de livres opérationnelle : classement et publication de
  factures et reçus fournisseurs, boîte de réception Dext, comptes de charge, codes TPS/TVQ,
  devises étrangères et validation du montant CAD, doublons, rapprochement bancaire. À charger
  pour **classer ou publier une pièce**.
- **`finances-lasclay`** — modèle de prévisions, marges, COGS, trésorerie, masse salariale,
  états financiers, méthodologie de projection. À charger pour **analyser ou projeter un chiffre**.

En cas de doute : classer une pièce → `bookkeeping-lasclay` ; interpréter un chiffre →
`finances-lasclay`. Les deux peuvent être chargés ensemble.

## Contexte d'entreprise

*Les Produits Lasclay Inc*, marque québécoise de produits isolés à la soie d'asclépiade, siège à
Québec, vente en ligne sur lasclay.com. Les ventes viennent de Shopify, la logistique de
ShipStation, le marketing d'Omnisend et Klaviyo — tous accessibles via le skill `proxygen` si un
chiffre doit être recoupé hors QBO.
SKILLEOF

mkdir -p /root/.claude/skills/proxygen
cat > /root/.claude/skills/proxygen/SKILL.md <<'SKILLEOF'
---
name: proxygen
description: General Proxy de Lasclay — le service Render des opérations, qui expose ShipStation en accès complet (19 actions), Omnisend (10) et Klaviyo en lecture seule (21). Couvre les commandes et expéditions, le suivi, les tarifs, les tags, la mise en attente, le marquage expédié, l'achat et l'annulation d'étiquettes, les contacts et campagnes courriel, et l'export exhaustif Klaviyo pour migration.
when_to_use: Déclenche dès qu'il est question du proxy général, de ShipStation, d'Omnisend, de Klaviyo, d'une expédition, d'un numéro de suivi, d'une étiquette d'envoi, d'un transporteur, d'un entrepôt, d'un contact ou d'une campagne courriel. Déclenche même sans nommer le service — « où est le colis de la commande 12345 », « mets cette commande en attente », « combien coûterait l'envoi vers les États-Unis », « exporte les profils pour la migration », « cette cliente est-elle désabonnée ».
argument-hint: [ce que tu veux faire côté expédition ou marketing]
allowed-tools:
  - Bash(node connectors_client.js:*)
  - Bash(node klaviyo_export.js:*)
  - Bash(node shipstation_check.js:*)
  - Bash(node shopify_check.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# General Proxy — opérations Lasclay

N'explore pas pour retrouver comment joindre ces services : tout est ci-dessous.

## Prérequis

Service Render `https://general-proxy-5muf.onrender.com`, code dans `server.js` à la racine du
dépôt **`lasclay/missive-automations`**. Les clés API des services tiers vivent uniquement côté
Render — jamais dans le dépôt, jamais dans l'environnement de session. C'est tout l'intérêt du
proxy : la session ne porte que le secret d'appel.

| Variable | Rôle |
| --- | --- |
| `GENERAL_PROXY_SECRET` | requis |
| `GENERAL_PROXY_URL` | facultatif, défaut `https://general-proxy-5muf.onrender.com` |

```bash
node connectors_client.js                                   # sonde /health
node connectors_client.js <connecteur> <action> '{"param":"valeur"}'
```

Vérifie `ls connectors_client.js` si tu doutes d'être dans le dépôt. Premier appel ~10 s : Render
endort le service au repos.

**Introspection sans secret** : `GET /connectors` liste les connecteurs, leurs actions et leur état
`enabled`. À utiliser plutôt que de deviner un nom d'action. Les listes ci-dessous en viennent.

## ShipStation — accès complet, API v1, 19 actions

**Lecture (8).** `orders`, `order`, `shipments`, `fulfillments`, `carriers`, `stores`,
`warehouses`, `listtags`.

- `orders` — `orderNumber`, `orderStatus` parmi `awaiting_shipment` / `shipped` / `on_hold` /
  `cancelled`, `customerName`, `storeId`, `createDateStart` et `createDateEnd`, `page`,
  `pageSize` jusqu'à 500. Retourne les commandes avec leurs articles.
- `order` — `orderId`, l'entier **interne** ShipStation, pas le numéro de commande.
- `shipments` — `orderNumber`, `trackingNumber`, `carrierCode`, `shipDateStart`/`End`. **C'est ici
  que vit le numéro de suivi.**
- `fulfillments` — les envois expédiés hors étiquette ShipStation. Un colis absent de `shipments`
  peut être ici.
- `listtags` — indispensable pour obtenir un `tagId` avant `addtag`.

**Écriture (11), par risque croissant.**

| Risque | Action | Détail |
| --- | --- | --- |
| 🟢 | `getrates` | devis de tarifs. **carrierCode, fromPostalCode, toPostalCode, toCountry, weight** `{value, units}`, plus serviceCode, packageCode, dimensions, confirmation, residential. Aucun effet de bord |
| 🟢 | `addtag` / `removetag` | **orderId, tagId** — réversible, sans coût |
| 🟢 | `holduntil` | **orderId, holdUntilDate** AAAA-MM-JJ |
| 🟢 | `restorefromhold` | **orderId** — remet en file |
| 🟡 | `markasshipped` | **orderId, carrierCode**, plus trackingNumber, shipDate, notifyCustomer, notifySalesChannel. **Notifie le client** sauf `notifyCustomer:false` |
| 🟡 | `createorder` | **orderNumber, orderDate, orderStatus, billTo, shipTo**. Upsert par `orderKey` : les champs fournis **écrasent** l'existant |
| 🟡 | `voidlabel` | **shipmentId** — annule une étiquette, généralement remboursée |
| 🔴 | `deleteorder` | **orderId** — destructeur |
| 🔴 | `createlabelfororder` | **orderId, carrierCode, serviceCode, shipDate**, plus weight, packageCode, testLabel |
| 🔴 | `createlabel` | **carrierCode, serviceCode, shipDate, shipFrom, shipTo, weight**, plus isReturnLabel, testLabel |

Les deux dernières **achètent une étiquette et débitent le wallet — argent réel**. `testLabel:true`
permet d'essayer sans frais, et c'est ce qu'il faut faire d'abord. Ne les lance jamais sans
confirmation explicite dans le tour courant, même si la demande paraît sans ambiguïté. Elles sont
d'ailleurs couvertes par des règles `permissions.ask`, comme `deleteorder` : elles demanderont même
en mode auto.

## Omnisend — API v3, 10 actions

Clé `OMNISEND_API_KEY` côté Render.

**Lecture (7).** `contacts` — `email`, `status` parmi `subscribed` / `unsubscribed` /
`nonSubscribed`, `segmentID`, `limit` max 250, `after` —, puis `contact` (**contactID**),
`campaigns`, `campaign` (**campaignID**), `orders`, `products`, `carts`.

**Écriture (3).** `createcontact` (🟡 crée ou abonne — **body** au format contact v3 :
`identifiers[{type:"email", id, channels:{email:{status}}}]`, `firstName`, `tags`),
`updatecontact` (🟡 **contactID, body**, PATCH partiel), et `triggerevent` (🟡 **body** avec
`eventID` ou `systemName`, `email`, `fields`) — qui **déclenche les automations écoutant
l'événement**, donc de vrais envois. Confirmation requise, règle `permissions.ask`.

Quand on demande « accéder à Omnisend », c'est ce chemin, pas un connecteur MCP.

## Klaviyo — lecture seule, 21 actions, export et migration

Clé `KLAVIYO_API_KEY` côté Render, en-tête `revision` (défaut `2025-04-15`).

Actions : `profiles`, `profile`, `lists`, `list`, `listprofiles`, `segments`, `segment`,
`segmentprofiles`, `flows`, `flow`, `campaigns`, `campaign`, `campaignmessage`, `templates`,
`template`, `events`, `metrics`, `tags`, `forms`, `images`, `coupons`.

Paramètres qui comptent :

- `profiles` — ajoute `"additional-fields[profile]": "subscriptions"` pour récupérer les
  **consentements**, sans quoi l'export est inutilisable pour une migration.
- `segment` — `"additional-fields[segment]": "profile_count"`.
- `flow` — `"additional-fields[flow]": "definition"` pour une définition complète réimportable.
- `campaigns` — le paramètre `filter` est **obligatoire**, par exemple
  `equals(messages.channel,'email')`.
- Pagination : `"page[size]"` et `"page[cursor]"`.

Export en masse : `node klaviyo_export.js profiles <dossier>` produit des CSV avec les
consentements. Les données personnelles peuvent circuler entre ces systèmes et le dépôt privé pour
le travail de migration — **jamais vers une destination publique**, ni paste, ni gist, ni dépôt
public.

## Vérifier un envoi — règle ferme

Deux sources, jamais une seule : Shopify pour la commande, ShipStation pour l'expédition et le
suivi. Une commande payée peut n'avoir aucune expédition créée ; une expédition peut exister sans
suivi transmis ; un envoi hors étiquette ShipStation apparaît dans `fulfillments` et non dans
`shipments`. Ces cas se répondent différemment.

`shopify_check.js` et `shipstation_check.js` font la vérification croisée.

Pour rédiger la réponse au client ensuite, charge le skill **`missive`** : il porte le ton de
marque et les réponses types d'expédition et de suivi, la catégorie la plus volumineuse de la boîte
avec 3728 fils sur deux ans.

## Détail complet

`CONNECTORS_PROXY.md` à la racine du dépôt : tableaux par connecteur, paramètres exacts, risques
annotés. Consulte-le avant une action jamais lancée.

## Contexte d'entreprise

**Les Produits Lasclay Inc**, siège à Québec — marque québécoise de produits isolés à la soie
d'asclépiade : plein air, accessoires, glacières souples, semences. Vente sur lasclay.com en
français et en anglais, expéditions au Canada et aux États-Unis.

La logistique spéciale — grèves postales, douanes, envois vers les USA — a ses propres réponses
types dans le skill `missive`. QuickBooks est délibérément isolé sur un autre proxy, avec un secret
distinct : voir le skill `qbo`.
SKILLEOF

mkdir -p /root/.claude/skills/autoloop
cat > /root/.claude/skills/autoloop/SKILL.md <<'SKILLEOF'
---
name: autoloop
description: Arme une boucle de travail autonome : Claude ne rend plus la main tant que l'objectif nommé n'est pas atteint et vérifié, et délègue à des sous-agents ce qui est parallélisable. Sert aussi à désarmer la boucle ou à en consulter l'état.
when_to_use: Invoque à la main avec /autoloop suivi de l'objectif. À utiliser quand une tâche est longue ou en plusieurs étapes et que tu veux qu'elle aille jusqu'au bout sans revenir demander quoi faire ensuite. /autoloop stop désarme, /autoloop status montre l'état.
argument-hint: [objectif à atteindre] | stop | status
disable-model-invocation: true
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
  - Skill
---

# Boucle de travail autonome

Argument reçu : `$ARGUMENTS`

## Comment ça marche, et ce que ça exige

Le mécanisme n'est pas dans ce skill : c'est un hook `Stop` qui renvoie
`{"decision":"block"}` pour refuser que le tour se termine. Ce hook vit dans le dépôt
`lasclay/missive-automations`, à `.claude/hooks/keep-going.sh`, et il est enregistré dans le bloc
`hooks` de `.claude/settings.json`.

**Vérifie d'abord qu'il est là** : `ls .claude/hooks/keep-going.sh`. S'il est absent — session
hors de ce dépôt, ou dépôt pas encore à jour — alors armer la boucle ne fait rien du tout. Dis-le
franchement au lieu de laisser croire que la boucle tourne.

Deux fichiers d'état, dans `/tmp` :

- `/tmp/claude-autoloop-${CLAUDE_SESSION_ID}.goal` — l'objectif ; sa présence arme la boucle
- `/tmp/claude-autoloop-${CLAUDE_SESSION_ID}.count` — le compteur de tours

Le hook est dormant sans fichier d'objectif : sans ça, il forcerait Claude à « continuer à
travailler » après une simple question conversationnelle.

## Aiguillage selon l'argument

**`stop`** — supprime les deux fichiers, confirme en une ligne, arrête-toi. Rien d'autre.

**`status`** — affiche l'objectif courant et le numéro de tour s'ils existent, ou dis que rien
n'est armé. Arrête-toi.

**Sinon, l'argument est l'objectif.** Dans l'ordre :

1. Reformule-le en **critères de fin vérifiables**. Pas « améliorer le support », mais « les
   trois scripts passent leurs tests et sont poussés sur main ». Si l'objectif donné n'a aucun
   critère observable, demande-le maintenant : c'est le seul moment où s'arrêter pour demander
   est utile, une fois la boucle armée ce sera trop tard.
2. Écris ces critères dans le fichier d'objectif avec `Write`. C'est ce texte que le hook te
   réinjectera à chaque tour : écris-le pour ton toi futur — ce qu'il faut atteindre, comment le
   vérifier, ce qui est hors périmètre.
3. Supprime le fichier `.count` s'il existe, pour repartir de zéro.
4. Annonce en deux lignes l'objectif retenu et le plafond, puis **mets-toi au travail
   immédiatement dans le même tour**. N'attends aucune confirmation.

## Comment travailler pendant la boucle

- **Vérifie, ne suppose pas.** À chaque reprise, établis l'état réel avant d'agir : relis les
  fichiers, relance les tests, relance la commande. Le hook te réinjecte l'objectif, pas
  l'avancement — tu es seul à pouvoir le reconstituer.
- **Délègue en parallèle.** Ce qui est indépendant part en sous-agents lancés dans un seul
  message, pas en série. Les sous-agents ne peuvent pas en lancer d'autres dans cet
  environnement : découpe à un seul niveau.
- **Committe au fil de l'eau** sur une branche de travail. Le conteneur est éphémère, du travail
  non poussé est du travail perdu. Attention : sur ce dépôt, les services Render suivent `main`,
  donc une fusion dans `main` déclenche un redéploiement — ne fusionne pas à l'aveugle.
- **Ne contourne pas les garde-fous.** L'achat d'étiquette ShipStation, les écritures QuickBooks,
  l'envoi d'une réponse Missive et le `triggerevent` Omnisend demandent une confirmation par
  règle `permissions.ask`, y compris en mode auto. Si l'objectif en dépend, prépare tout le
  reste, puis demande — et traite cette attente comme un blocage à annoncer, pas comme une raison
  de tourner à vide.

## Comment sortir

Deux sorties, et tourner à vide n'en est pas une :

- **Objectif atteint et vérifié** — supprime le fichier d'objectif, puis termine ton message par
  la ligne `OBJECTIF ATTEINT`. C'est cette ligne qui désarme la boucle. Ne l'écris jamais avant
  que ce soit vrai.
- **Blocage réel exigeant une décision humaine** — dis lequel des critères n'est pas atteint et
  pourquoi, ce que tu as essayé, et termine aussi par `OBJECTIF ATTEINT` pour rendre la main
  proprement.

Au-delà de 30 tours la boucle se désarme d'elle-même et te demande de faire le point. Le plafond
se règle par la variable d'environnement `AUTOLOOP_MAX`.
SKILLEOF

# --- 2. Settings utilisateur ----------------------------------------------
cat > /root/.claude/settings.json <<'JSON'
{
  "outputStyle": "Proactive",
  "env": {
    "TZ": "America/Montreal",
    "GENERAL_PROXY_URL": "https://general-proxy-5muf.onrender.com",
    "MISSIVE_PROXY_URL": "https://proxy-missive.onrender.com"
  },
  "permissions": {
    "defaultMode": "auto",
    "allow": [
      "Bash",
      "Edit",
      "Write",
      "NotebookEdit",
      "WebFetch",
      "WebSearch",
      "Agent",
      "Skill",
      "Bash(node missive_client.js:*)",
      "Bash(node connectors_client.js:*)",
      "Bash(node finance_client.js:*)",
      "Bash(node klaviyo_export.js:*)",
      "Bash(node qbo_check.js:*)",
      "Bash(node qbo_import.js:*)",
      "Bash(node shopify_check.js:*)",
      "Bash(node shipstation_check.js:*)",
      "Bash(node support.js:*)",
      "Bash(node analyse.js:*)",
      "Bash(node digest.js:*)",
      "Bash(node filtrage.js:*)",
      "Bash(node revision.js:*)",
      "Bash(node revision_ia.js:*)",
      "Bash(node archive.js:*)",
      "Bash(node merge.js:*)",
      "Bash(node repartition_merge.js:*)",
      "Bash(node admin_ops.js:*)",
      "Bash(node prevente.js:*)",
      "Bash(node draftrefresh.js:*)",
      "Bash(node nettoyage.js:*)",
      "Bash(npm install)",
      "Bash(npm ci)",
      "Bash(npm test:*)",
      "Bash(npm run:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git fetch:*)",
      "Bash(git pull:*)",
      "Bash(git checkout:*)",
      "Bash(git merge:*)",
      "Bash(git rebase:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "mcp__github",
      "mcp__Shopify",
      "mcp__Klaviyo",
      "mcp__Notion",
      "mcp__Google_Calendar",
      "mcp__Google_Drive",
      "mcp__Claude_Code_Remote"
    ],
    "ask": [
      "Bash(node connectors_client.js shipstation createlabel:*)",
      "Bash(node connectors_client.js shipstation createlabelfororder:*)",
      "Bash(node connectors_client.js shipstation deleteorder:*)",
      "Bash(node finance_client.js create:*)",
      "Bash(node finance_client.js update:*)",
      "Bash(node finance_client.js remove:*)",
      "Bash(node missive_client.js reply:*)",
      "Bash(node connectors_client.js omnisend triggerevent:*)"
    ]
  },
  "autoMode": {
    "environment": [
      "$defaults",
      "Organization: Lasclay, marque quebecoise de produits isoles a la soie d'asclepiade, vendus en ligne sur lasclay.com en francais et en anglais. Primary use of Claude Code: automatisation du service client, des operations d'expedition et de la tenue de livres, en plus du developpement logiciel.",
      "Source control: GitHub, organisation lasclay. Le depot de travail est lasclay/missive-automations. Repository visibility: prive.",
      "Key internal services: trois proxys d'API heberges sur Render, qui sont l'infrastructure normale et attendue de ce depot et non des destinations externes. General Proxy a general-proxy-5muf.onrender.com pour ShipStation, Omnisend et Klaviyo. Missive Proxy a proxy-missive.onrender.com pour la boite support. Finance Proxy sur un service Render dedie pour QuickBooks Online. Les appeler avec leur secret depuis les scripts du depot est l'operation courante attendue.",
      "Trusted internal domains: *.onrender.com pour les trois proxys ci-dessus, lasclay.com et ses sous-domaines, la boutique Shopify de Lasclay, mail.missiveapp.com.",
      "Secrets management: les cles d'API des services tiers vivent uniquement en variables d'environnement cote Render, jamais dans le depot ni dans l'environnement Claude. L'environnement de session porte seulement les secrets d'appel des proxys, GENERAL_PROXY_SECRET, MISSIVE_PROXY_SECRET et FINANCE_PROXY_SECRET. Les envoyer au proxy correspondant en en-tete X-Proxy-Secret est leur usage prevu, pas une exfiltration.",
      "CI/CD deploy targets: les services Render suivent la branche main. Une fusion dans main declenche donc un redeploiement. Les fichiers de configuration Claude, sous .claude/, et cloud-setup-script.sh ne touchent aucun service.",
      "Sensitive data locations & audiences: les donnees personnelles des clients vivent dans Shopify, Missive, Klaviyo et Omnisend. Elles peuvent circuler entre ces systemes et le depot prive pour le travail de support et de migration, mais jamais vers une destination publique, un paste, un gist ni un depot public.",
      "Sensitive remote targets: le Finance Proxy et QuickBooks Online portent la comptabilite reelle. ShipStation engage de l'argent reel a l'achat d'une etiquette d'expedition.",
      "Additional context: exercice fiscal du 1er septembre au 31 aout. Les ecritures comptables et les achats d'etiquettes sont irreversibles ou couteux et restent soumis a confirmation par les regles permissions.ask ci-dessous, meme en mode auto."
    ],
    "allow": [
      "$defaults",
      "Appeler les trois proxys Render de Lasclay avec leur secret d'environnement est autorise : c'est le mecanisme d'acces normal de ce depot, concu precisement pour garder les cles d'API hors de l'environnement Claude.",
      "Lire et ecrire dans la boite support Missive, dans Shopify et dans ShipStation en lecture est autorise : c'est le travail courant des automatisations de ce depot.",
      "Fusionner une branche de travail dans main et pousser est autorise : c'est le mecanisme de deploiement documente du projet."
    ]
  }
}
JSON

# --- 3. Confiance de l espace de travail + fuseau -------------------------
cat > /tmp/t.js <<'JS'
const fs=require('fs'),p='/root/.claude.json',d='/home/user/missive-automations';
let c={};try{c=JSON.parse(fs.readFileSync(p,'utf8'))}catch(e){}
c.projects=c.projects||{};c.projects[d]=c.projects[d]||{};
c.projects[d].hasTrustDialogAccepted=true;
fs.writeFileSync(p,JSON.stringify(c,null,2));
JS
node /tmp/t.js || true
ln -snf /usr/share/zoneinfo/America/Montreal /etc/localtime || true
echo 'America/Montreal' > /etc/timezone || true

echo "--- setup Lasclay ---"
echo "  commandes: $(ls -d /root/.claude/skills/*/ 2>/dev/null | wc -l) skills dans /root/.claude/skills"
node -e 'const s=require("/root/.claude/settings.json");console.log("  mode:",s.permissions.defaultMode,"| allow:",s.permissions.allow.length,"| ask:",s.permissions.ask.length)' || true
echo "  date locale: $(date "+%Y-%m-%d %H:%M %Z")"
exit 0
