---
name: missive
description: Boîte courriel Missive d'Unique Plastique via le Missive Proxy — carte de la boîte, lecture des fils, brouillons, notes internes, étiquettes, tâches, fermeture, réponse à un client et courriel neuf. Couvre les accès et les garde-fous d'envoi, pas les politiques de service client.
when_to_use: Déclenche dès qu'il est question du proxy Missive, de la boîte support, d'un fil ou d'une conversation client, d'un brouillon, d'une note interne, d'une étiquette, d'une tâche, ou d'écrire à quelqu'un. Déclenche même sans le mot Missive — « lis le fil de la cliente qui attend son colis », « prépare une réponse », « qu'est-ce qu'il y a dans la boîte ce matin », « ferme la conversation », « assigne ça à quelqu'un », « écris à ce fournisseur ».
argument-hint: [ce que tu veux faire dans la boîte Missive]
allowed-tools:
  - Bash(node clients/missive_client.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# Boîte Missive — Unique Plastique

N'explore pas le dépôt pour retrouver comment joindre Missive : tout est ci-dessous.

## Prérequis

Le client est `clients/missive_client.js`, un script Node du dépôt. Il n'est **pas déployé** : il
tourne dans la session et lit l'URL et le secret dans l'environnement.

| Variable | Rôle |
| --- | --- |
| `MISSIVE_PROXY_SECRET` | requis, repli sur `PROXY_SECRET` |
| `MISSIVE_PROXY_URL` | requis, `https://<a-remplir>.onrender.com` |

Le jeton Missive lui-même vit uniquement côté Render : la session ne porte que le secret d'appel,
révocable. Ne l'écris jamais en dur, ne l'affiche jamais. Si le répertoire courant n'est pas le
dépôt, les appels échouent : vérifie avec `ls clients/missive_client.js` et dis-le plutôt que de
reconstruire un appel HTTP à la main.

Commence par la sonde, qui vaut test d'authentification :

```bash
node clients/missive_client.js health   # attendu : {"ok":true,"service":"missive-proxy"}
```

Premier appel ~10 s : Render endort le service au repos. Ce n'est pas une panne, ne relance pas.

## Trois couches — ne prends jamais la plus étroite pour la plus large

**Avant d'écrire qu'une chose est impossible dans Missive, tu DOIS avoir lu les couches 2 et 3.**
Sans ça, tu n'as pas constaté une limite, tu as constaté ton ignorance.

| # | Couche | Ce que ça vaut comme preuve |
| --- | --- | --- |
| 1 | `clients/missive_client.js` | **aucune.** La liste des commandes est une commodité, pas une frontière |
| 2 | `missive-proxy/server.js` | le périmètre réellement exposé aujourd'hui |
| 3 | [API publique Missive](https://learn.missiveapp.com/api-documentation/rest-endpoints) | le vrai plafond |

Lis la couche 2 en entier : le bloc de commentaire d'en-tête vieillit, le dispatch de routes en bas
et les fonctions disent la vérité. Une fonction existante fait souvent déjà presque ce que tu
cherches, à un champ près — `sendNew()` n'est que `reply()` sans le champ `conversation`. Demande-toi
toujours : « qu'est-ce qui, dans ce code, force cette limite? » Si la réponse est une valeur codée en
dur ou une validation, ce n'est pas une limite de Missive, c'est une ligne à changer.

Exemple vivant dans ce dépôt : la route `POST /task-state` (changer l'état d'une tâche) existe côté
serveur mais **le client ne l'expose pas**. La bonne formulation n'est jamais « Missive ne peut
pas », c'est « le client ne l'expose pas encore, le proxy le fait, voici l'appel à ajouter ». Et
n'oublie pas le déploiement : les services Render suivent `main`, une route ajoutée sur une branche
reste inerte tant que la fusion n'est pas faite — vérifie par un appel réel.

## Premier réflexe : la carte de la boîte

Rien d'utile ne se fait sans les **Resource ID** de Missive — étiquettes partagées, équipes,
organisation, membres. Ne les devine jamais.

1. **Lis le cache d'abord** : `missive_structure.json` à la racine du dépôt, s'il existe. Un `Read`
   suffit, c'est instantané.
2. **S'il est absent ou périmé**, capture-le puis écris-le :

```bash
node clients/missive_client.js structure > missive_structure.json
```

Vérifie ensuite le champ `errors` du JSON : chaque bloc dégrade indépendamment, donc une permission
manquante sur un type laisse les autres exploitables. Le fichier ne contient que de la structure,
aucune donnée client — il se committe sans risque et rend la prochaine session rapide.

3. Si `errors` parle d'organisation : `MISSIVE_ORG` n'est pas configuré côté Render. Le bloc
   `organizations` donne l'id à y mettre — tant qu'il manque, équipes, étiquettes et **toutes les
   écritures** ne fonctionnent pas.

Avec la carte : les `shared_labels[].id` alimentent `list "shared_label=<ID>"`,
`name_with_parent_names` donne le chemin lisible d'une étiquette imbriquée, et les `users[].id`
servent aux assignations.

## Lecture

```bash
node clients/missive_client.js structure            # organisations, équipes, étiquettes, membres
node clients/missive_client.js list "<filtre>"      # fils correspondant au filtre
node clients/missive_client.js read <convId> [n]    # un fil, n messages (défaut 10, max 200)
node clients/missive_client.js drafts <convId>      # brouillons déjà sur le fil
node clients/missive_client.js draftsraw <convId>   # idem, réponse brute
node clients/missive_client.js notes <convId>       # notes internes / commentaires
node clients/missive_client.js users                # membres de l'org : id, nom, courriel
node clients/missive_client.js books                # carnets d'adresses
node clients/missive_client.js contacts "terme" [n] # contact connu : nom, courriel, tél, organisation
```

Deux champs à ne pas ignorer :

- `read` renvoie `tronque: true` quand il reste des messages **avant** ceux que tu as lus. Ne réponds
  jamais à un fil tronqué : relance avec un `n` plus grand.
- `drafts` marque `tronque: true` quand seul l'aperçu (~130 caractères) a pu être récupéré. Un
  brouillon tronqué n'est **pas** relisible, donc pas envoyable les yeux fermés.

### Le filtre de `list`

Le filtre est transmis **tel quel** à l'API Missive, sur `/conversations?<filtre>&limit=50` : tout
paramètre de cette API fonctionne, pas seulement `shared_label`. Mais le proxy **pagine jusqu'à
épuisement** — un filtre large ramène tout, lentement, et peut expirer.

Commence toujours par le filtre le plus étroit qui répond à la question (`assigned=true`,
`shared_label=<ID>`) avant d'élargir (`inbox=true`). Les ID d'étiquettes viennent de la carte,
jamais d'une supposition.

## Écriture — confirme avant

Ces actions modifient la boîte partagée ou sortent vers l'extérieur. Demande confirmation, sauf
instruction explicite dans le tour courant.

```bash
node clients/missive_client.js note <convId> "texte markdown"     # 🟡 note interne
node clients/missive_client.js task <convId>                      # 🟡 JSON {title,assignees[],label} sur stdin
node clients/missive_client.js labels <convId>                    # 🟡 JSON {add[],remove[],markdown,keepClosed} sur stdin
node clients/missive_client.js close <convId> "note optionnelle"  # 🟡 ferme le fil
node clients/missive_client.js reply <convId>                     # 🔴 JSON de brouillon sur stdin
node clients/missive_client.js send                               # 🔴 COURRIEL NEUF, JSON complet sur stdin
```

**Étiquettes : `keepClosed`.** Sur un fil **déjà fermé**, poser ou retirer une étiquette sans
`"keepClosed": true` le remonte dans la boîte de quelqu'un. Le drapeau se transmet au post envoyé à
Missive ; passe-le systématiquement dès que le fil n'est plus ouvert.

**Tâches.** `task` prend `{title, assignees[], label}` : les `assignees` sont des `users[].id` lus
dans la carte, jamais devinés. La réponse contient `taskId` — c'est lui qui sert à changer l'état
plus tard (route `/task-state` du proxy, non exposée par le client).

### `reply` et `send` — le défaut est le brouillon

`reply` continue un fil et exige un `convId` (plus `from` et `body`). `send` ouvre un fil neuf :
prospection, relance, prise de contact. Même endpoint Missive derrière, sans champ `conversation`.

```bash
echo '{"from":"info@uniqueplastique.ca","to":["personne@exemple.com"],
       "subject":"…","body":"…"}' | node clients/missive_client.js send
```

`to`, `cc` et `bcc` sont des tableaux d'**adresses en clair**, pas d'objets — le proxy les enveloppe
lui-même. Le corps accepte du HTML ; les sauts de ligne simples sont convertis en `<br>`.

Trois garde-fous, à ne pas contourner :

- **Sans `"send": true`, rien ne part.** Le message se dépose dans Missive et attend qu'un humain
  appuie sur envoyer. C'est le bon défaut : un brouillon raté coûte dix secondes, un courriel raté
  coûte un client. Laisse le défaut tant que la boucle n'a pas fait ses preuves.
- **Cinq destinataires maximum** sur `send`, `to` + `cc` + `bcc` confondus : cette route sert au
  contact ciblé. Au-delà, le proxy refuse — et c'est qu'il s'agit d'un envoi de masse, à faire dans
  un outil d'infolettre, pas ici.
- **Montre toujours le texte avant**, même pour un simple brouillon, et n'invente jamais le nom d'une
  personne : va le lire à la source plutôt que de le déduire d'une adresse courriel.

`reply` accepte aussi `closeAfter: true` (ferme le fil après) et `attachments`
(`[{base64_data, filename}]`, ~20 Mo au total).

## Avant de promettre un envoi à un client

Une question de suivi se tranche avec **deux** sources, jamais une seule : Shopify pour la commande,
ShipStation pour l'expédition et le numéro de suivi. Shopify peut afficher « fulfilled » sur une
étiquette créée mais jamais ramassée. Charge le skill **`ops`** — les deux skills coexistent dans le
même tour.

## Ce que ce skill ne couvre pas

Il donne l'**accès**, pas les **décisions**. Politique de retour, délais promis, ton de marque,
langue de réponse, quand rembourser ou remplacer : ça n'est pas ici. Demande la règle plutôt que de
l'inventer, et note-la ensuite dans un skill d'entreprise à part. Doc complète du proxy et de ses
routes : `missive-proxy/README.md`.
