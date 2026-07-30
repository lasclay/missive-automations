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
