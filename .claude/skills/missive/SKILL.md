---
name: missive
description: "Appelle le proxy Missive et toutes les connaissances reliées aux comm externes de Lasclay, et plus."
---

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

## Trois couches — ne prends jamais la plus étroite pour la plus large

**Avant d'écrire qu'une chose est impossible dans Missive, tu DOIS avoir lu les couches 2 et 3.**
Sans ça, tu n'as pas constaté une limite, tu as constaté ton ignorance.

| # | Couche | Ce que c'est | Ce que ça vaut comme preuve |
| --- | --- | --- | --- |
| 1 | `missive_client.js` | enveloppe mince, une quinzaine de `else if` | **aucune.** La liste des commandes est une commodité, pas une frontière |
| 2 | `missive-proxy/server.js` | le périmètre réellement exposé | ce que le proxy autorise aujourd'hui |
| 3 | [API publique Missive](https://learn.missiveapp.com/api-documentation/rest-endpoints) | le vrai plafond | ce qui est possible, point |

**Comment lire la couche 2, et pas seulement la survoler.** L'en-tête du fichier liste les routes,
mais il vieillit. Lis les trois : le bloc de commentaire, le `switch` de routes en bas, **et les
fonctions elles-mêmes**. Une fonction existante fait souvent déjà presque ce que tu cherches, à un
champ près. Demande-toi toujours : « qu'est-ce qui, dans ce code, force cette limite? » Si la
réponse est une valeur codée en dur ou une validation, ce n'est pas une limite de Missive, c'est
une ligne à changer.

**Le précédent qui a motivé cette règle.** On a longtemps cru que le proxy ne pouvait pas envoyer un
courriel neuf, parce que `missive_client.js` n'expose que `reply <convId>`. C'était faux. La
fonction `reply()` appelait déjà `POST /drafts`, qui est exactement l'appel qui crée un courriel
neuf : il suffit d'omettre `conversation`. Deux choses seulement bloquaient, `conversation: id`
codé en dur et une validation exigeant un `id`. La capacité était là depuis le début, à quinze
lignes près. Conclusion tirée d'une lecture du client, jamais du serveur.

**La bonne formulation quand la couche 2 ne l'expose pas.** Ce n'est jamais « Missive ne peut
pas ». C'est « le proxy ne l'expose pas encore, l'API le permet, voici le correctif ». Puis tu
proposes la route, avec ses garde-fous.

**Et n'oublie pas le déploiement.** Les services Render suivent `main`. Une route ajoutée sur une
branche reste inerte tant que la fusion n'est pas faite : vérifie avec un appel réel avant
d'annoncer qu'elle fonctionne.

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
node missive_client.js send                                # 🔴 COURRIEL NEUF, JSON complet sur stdin
```

`reply` est en plus couvert par une règle `permissions.ask` : il demandera même en mode auto.
C'est voulu — un courriel envoyé ne se rappelle pas.

### `send` — écrire à quelqu'un qui ne nous a jamais écrit

`reply` continue un fil et exige un `convId`. `send` ouvre un fil neuf : prospection, relance,
prise de contact. Même endpoint Missive derrière, sans le champ `conversation`.

```bash
echo '{"from":"admin@lasclay.com","to":["personne@exemple.com"],
       "subject":"…","body":"…"}' | node missive_client.js send
```

Deux garde-fous à connaître, et à ne pas contourner :

- **Le défaut est le brouillon.** Sans `"send": true`, le message se dépose dans Missive et attend
  qu'un humain appuie sur envoyer. C'est le bon mode par défaut pour de la prospection : tu
  prépares, la personne relit dans son interface, elle décide.
- **Cinq destinataires maximum** par appel, `to` + `cc` + `bcc` confondus. Cette route sert au
  contact ciblé. Si une tâche demande plus, c'est un envoi de masse : ça se fait dans un outil
  d'infolettre, pas ici, et ça se signale.

Écrire à froid engage la réputation de la marque. Montre toujours le texte avant, même quand tu
crées un simple brouillon, et n'invente jamais le nom d'une personne : va le lire à la source
(signature de l'article, page de contact) plutôt que de le déduire d'une adresse courriel.

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
  `merge.js` détecte les fils en doublon et pose « À fusionner » ; la FUSION (`MERGE=true`)
  est IRRÉVERSIBLE et ne touche **que des fils ouverts**. Deux fils de la **même adresse**
  sont réunis sans condition de date ; les garde-fous (fenêtre, étendue, conflit de
  commandes, exclusion des fils-agrégats) ne valent que pour les liens entre adresses
  **différentes**, là où le script soudait deux clientes par une commande transférée.
  `node merge_test.js` rejoue ces cas ; lance-le avant d'assouplir un seuil.
  `repartition_merge.js` renvoie dans leur boîte les fils déplacés dans MERGE à tort.
- `admin_ops.js`, `prevente.js`, `draftrefresh.js` — administratif et prévente.

Lis l'en-tête du script avant de le lancer : plusieurs agissent sur la boîte réelle.

## Contexte d'entreprise

**Les Produits Lasclay Inc**, siège à Québec — marque québécoise de produits isolés à la soie
d'asclépiade : plein air, accessoires, glacières souples, semences. Vente en ligne sur lasclay.com
en français et en anglais, expéditions au Canada et aux États-Unis.

Le service client se fait dans les deux langues : **réponds toujours dans celle du client**.
L'asclépiade est aussi la plante hôte du monarque, ce qui donne à la marque une dimension
écologique réelle — plusieurs questions clients portent là-dessus plutôt que sur un produit.