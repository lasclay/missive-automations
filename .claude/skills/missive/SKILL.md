---
name: missive
description: Accès à la boîte support Lasclay via le proxy Missive, et aux connaissances de service client, d'ops et de marque nécessaires pour y répondre. Couvre la lecture des fils, les brouillons, les notes internes, les tâches, la fermeture de conversations, et les scripts d'automatisation de la boîte (réponses IA, digest, filtrage, révision, archivage).
when_to_use: Déclenche dès qu'il est question du proxy Missive, de la boîte support, d'un fil ou d'une conversation client, d'un brouillon de réponse, d'une note interne, du digest des opérations, ou de répondre à un client Lasclay. Déclenche même sans le mot Missive, par exemple « lis le fil de la cliente qui attend son colis », « prépare une réponse pour la commande en rupture », « c'est quoi dans la boîte support ce matin », « ferme la conversation ».
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

## Prérequis — à vérifier en premier

Les clients d'accès sont des scripts Node du dépôt **`lasclay/missive-automations`**. Ils ne
sont pas déployés : ils tournent dans l'environnement de la session et lisent l'URL et le secret
depuis l'environnement.

| Variable | Rôle |
| --- | --- |
| `MISSIVE_PROXY_SECRET` | requis (repli sur `PROXY_SECRET`) |
| `MISSIVE_PROXY_URL` | facultatif, défaut `https://proxy-missive.onrender.com` |

Si le répertoire courant n'est pas ce dépôt, les commandes échoueront avec un module
introuvable : vérifie avec `ls missive_client.js`. Si le dépôt est absent, dis-le plutôt que de
tenter de reconstruire un appel à la main — le secret ne doit jamais être écrit en dur.

Commence par la sonde, elle vaut test d'authentification :

```bash
node missive_client.js health     # attendu : {"ok":true,"service":"missive-proxy"}
```

Le premier appel peut prendre ~10 s : Render endort le service au repos. Ce n'est pas une panne,
ne relance pas trois fois.

## Lecture

```bash
node missive_client.js list "shared_label=ID"   # lister des fils par filtre
node missive_client.js read <convId>            # une conversation
node missive_client.js drafts <convId>          # brouillons rédigés par le script IA
node missive_client.js notes <convId>           # notes internes / commentaires
node missive_client.js users                    # membres de l'org : id, nom, courriel
```

L'organisation compte deux membres, Catherine Bedard-Mercier et Gabriel Gouveia. Récupère leurs
identifiants avec `users` avant toute assignation de tâche, ne les devine pas.

## Écriture — confirme avant

Ces actions modifient la boîte partagée ou sortent vers le client. Demande confirmation sauf
instruction explicite dans le tour courant.

```bash
node missive_client.js note <convId> "texte markdown"     # 🟡 note interne
node missive_client.js task <convId>                      # 🟡 JSON {title,assignees[],label} sur stdin
node missive_client.js close <convId> "note optionnelle"   # 🟡 ferme le fil
node missive_client.js reply <convId>                     # 🔴 ENVOIE au client, JSON sur stdin
```

`reply` est aussi couvert par une règle `permissions.ask` : il demandera même en mode auto.
C'est voulu.

## Rédiger une réponse

Deux fichiers du dépôt, volumineux — lis la section utile, ne les récite pas en entier.

- **`connaissance_support.md`** — la référence pour rédiger. Ton de marque, puis le savoir
  officiel en réponses types par thème : expédition et suivi, plantation et bombes semencières,
  produits et questions techniques, précommandes et ruptures, retours et remboursements, tailles
  et échanges, garantie, logistique spéciale (grèves, douanes, USA), ateliers et points de vente,
  problèmes de livraison, fraude. Suivent les logiques de décision internes commentées, puis les
  catégories de demandes avec leurs volumes sur deux ans — `suivi_livraison` domine avec 3728
  fils, devant `question_pre_achat` à 1802. Repère ta section avec `grep -n '^###'`.
- **`contexte_lasclay.md`** — identité, histoire, mission, l'asclépiade et ses propriétés, les
  monarques, la fabrication, le catalogue par saison.

Charge aussi le skill **`lasclay-master`** pour toute rédaction destinée à un client : ton de
voix et garde-fous de marque. Et **`lasclay-seo`** si la tâche touche une fiche produit ou du
contenu public.

## Vérifier un envoi — règle ferme

Une question de suivi se tranche avec **deux** sources, jamais une seule : Shopify pour la
commande, ShipStation pour l'expédition et le numéro de suivi. Un client qui n'a pas reçu son
colis peut avoir une commande payée sans expédition créée, ou une expédition sans suivi
transmis — les deux cas se répondent différemment. Pour ShipStation, charge le skill
**`proxygen`** ; les deux skills coexistent sans conflit dans le même tour.

## Scripts de la boîte

- `support.js` — réponses IA de la boîte. Vérifie Shopify **et** ShipStation avant de répondre
  sur un envoi.
- `digest.js` — digest des opérations. `analyse.js`, `filtrage.js` — tri et analyse des fils.
- `revision.js`, `revision_ia.js` — révision des brouillons.
- `archive.js`, `purge.js`, `nettoyage.js`, `merge.js`, `repartition_merge.js` — entretien.
- `admin_ops.js`, `prevente.js`, `draftrefresh.js` — administratif et prévente.

Lis l'en-tête du script avant de le lancer : plusieurs agissent sur la boîte réelle.

## Contexte d'entreprise

Lasclay — *Les Produits Lasclay Inc* — est une marque québécoise de produits isolés à la soie
d'asclépiade : plein air, accessoires, glacières souples, semences. Vente en ligne sur
lasclay.com, en français et en anglais. Siège à Québec. Le service client se fait dans les deux
langues : réponds dans celle du client.
