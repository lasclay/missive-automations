---
name: missive
description: Boîte Missive via le proxy — lecture des fils et brouillons, pièces jointes, notes internes, tâches, étiquettes, fermeture, réponses et courriels neufs. Couvre la carte de la boîte (Resource ID), les filtres de recherche, les garde-fous d'écriture et les limites réelles de l'API Missive.
when_to_use: Déclenche dès qu'il est question du proxy Missive, de la boîte de réception partagée, d'un fil ou d'une conversation, d'un brouillon, d'une note interne, d'une étiquette, d'une tâche, ou de répondre à quelqu'un. Déclenche même sans le mot Missive — « lis le fil de la personne qui attend sa commande », « prépare une réponse », « qu'est-ce qu'il y a dans la boîte ce matin », « ferme la conversation », « assigne ça à quelqu'un ».
argument-hint: [ce que tu veux faire dans la boîte]
allowed-tools:
  - Bash(node client.js:*)
  - Read
  - Grep
  - Glob
---

# Boîte Missive — accès par le proxy

N'explore pas le dépôt pour retrouver comment joindre Missive : tout est ci-dessous.

## Prérequis

Le client est `client.js`, un script Node qui **tourne dans la session**, pas sur un serveur.
Il ne connaît pas le jeton Missive : seulement l'URL du proxy et son secret, lus dans
l'environnement.

| Variable | Rôle |
| --- | --- |
| `MISSIVE_PROXY_URL` | requis — l'URL publique du proxy déployé |
| `MISSIVE_PROXY_SECRET` | requis — le mot de passe du proxy (repli sur `PROXY_SECRET`) |

Si le répertoire courant ne contient pas le script, les appels échoueront : vérifie avec
`ls client.js`. Script absent → dis-le, ne reconstruis pas l'appel à la main avec `curl`. Le
secret ne doit jamais être écrit en dur, ni affiché, ni collé dans une conversation.

Commence par la sonde, qui vaut test d'authentification :

```bash
node client.js health     # attendu : {"ok":true,"service":"missive-proxy"}
```

Sur une offre d'hébergement gratuite, le premier appel peut prendre 30 à 60 secondes : le
service dormait. Ce n'est pas une panne, ne relance pas.

## Trois couches — ne prends jamais la plus étroite pour la plus large

**Avant d'écrire qu'une chose est impossible dans Missive, tu DOIS avoir lu les couches 2 et 3.**
Sans ça, tu n'as pas constaté une limite, tu as constaté ton ignorance.

| # | Couche | Ce que c'est | Ce que ça vaut comme preuve |
| --- | --- | --- | --- |
| 1 | `client.js` | enveloppe mince, une vingtaine de `else if` | **aucune.** La liste des commandes est une commodité, pas une frontière |
| 2 | `server.js` | le périmètre réellement exposé | ce que le proxy autorise aujourd'hui |
| 3 | [API publique Missive](https://learn.missiveapp.com/api-documentation/rest-endpoints) | le vrai plafond | ce qui est possible, point |

**Comment lire la couche 2, et pas seulement la survoler.** L'en-tête du fichier liste les routes,
mais il vieillit. Lis les trois : le bloc de commentaire, le `switch` de routes en bas, **et les
fonctions elles-mêmes**. Une fonction existante fait souvent déjà presque ce que tu cherches, à un
champ près. Demande-toi toujours : « qu'est-ce qui, dans ce code, force cette limite? » Si la
réponse est une valeur codée en dur ou une validation, ce n'est pas une limite de Missive, c'est
une ligne à changer.

**Le précédent qui a motivé cette règle.** On a longtemps cru que le proxy ne pouvait pas envoyer un
courriel neuf, parce que le client n'exposait que `reply <convId>`. C'était faux. La fonction
`reply()` appelait déjà `POST /drafts`, qui est exactement l'appel qui crée un courriel neuf : il
suffit d'omettre `conversation`. Deux choses seulement bloquaient — `conversation: id` codé en dur
et une validation exigeant un `id`. La capacité était là depuis le début, à quinze lignes près.
Conclusion tirée d'une lecture du client, jamais du serveur.

**La bonne formulation quand la couche 2 ne l'expose pas.** Ce n'est jamais « Missive ne peut
pas ». C'est « le proxy ne l'expose pas encore, l'API le permet, voici le correctif ». Puis tu
proposes la route, avec ses garde-fous.

**Et n'oublie pas le déploiement.** Le service tourne sur la branche que l'hébergeur suit. Une
route ajoutée sur une branche de travail reste inerte tant que la fusion n'est pas faite : vérifie
avec un appel réel avant d'annoncer qu'elle fonctionne.

## Premier réflexe : la carte de la boîte

Rien d'utile ne se fait sans les **Resource ID** de Missive — étiquettes partagées, équipes,
organisation, membres. Ne les redécouvre pas à chaque session, et ne les devine jamais.

**1. Lis le cache d'abord.** Si un `missive_structure.json` existe dans le dépôt, il contient la
carte : organisations, équipes, étiquettes partagées avec leur hiérarchie, membres. Un `Read`
suffit, c'est instantané, et ça donne de quoi construire un filtre utile tout de suite.

**2. S'il est absent ou visiblement périmé**, capture-le puis écris-le :

```bash
node client.js structure > missive_structure.json
```

Vérifie ensuite le champ `errors` du JSON : chaque bloc dégrade indépendamment, donc une
permission manquante sur un type laisse les autres exploitables. Committe le fichier — c'est ce qui
rend la prochaine session rapide. Il ne contient que des identifiants de structure, **aucune donnée
de client ou de correspondant**.

**3. Si `structure` renvoie 404 `route inconnue`**, la route existe dans le code mais n'est pas
déployée. Dis-le, et rabats-toi sur `users`, qui fonctionne depuis toujours.

Avec la carte en main : les `shared_labels[].id` alimentent `list "shared_label=<ID>"`,
`name_with_parent_names` donne le chemin lisible d'une étiquette imbriquée, et les `users[].id`
servent aux assignations de tâches.

## Lecture

```bash
node client.js structure          # organisations, équipes, étiquettes partagées, membres
node client.js list "<filtre>"    # fils correspondant au filtre
node client.js read <convId> [n]  # une conversation (défaut 10 messages, max 200)
node client.js drafts <convId>    # brouillons du fil
node client.js notes <convId>     # notes internes / commentaires
node client.js users              # membres de l'org : id, nom, courriel
node client.js books              # carnets d'adresses
node client.js contacts "terme"   # retrouver un contact connu de la boîte
```

### Le filtre de `list` — à lire avant de l'utiliser

Le filtre est transmis **tel quel** à l'API Missive, sur `/conversations?<filtre>&limit=50`. Tout
paramètre de cette API fonctionne donc, pas seulement `shared_label`. Mais le proxy **pagine
jusqu'à épuisement** : un filtre large ramène tout, lentement.

Ordres de grandeur mesurés sur une boîte de support active (plusieurs milliers de fils) :

| Filtre | Résultat |
| --- | --- |
| `assigned=true` | quelques dizaines de fils — rapide, bon point de départ |
| `shared_label=<ID>` | selon l'étiquette — le filtre le plus utile au quotidien |
| `inbox=true` | des milliers de fils — très lent, évite sauf besoin réel |
| `all=true` | expire — ne l'utilise pas |

Commence toujours par le filtre le plus étroit qui répond à la question. Les ID d'étiquettes
viennent de la carte décrite plus haut, jamais d'une supposition.

### Lire un fil en entier, pas seulement sa fin

`read` s'arrête à 10 messages par défaut. Sur un fil long, tu lis la fin d'une discussion et tu
crois avoir tout lu. **Regarde toujours le champ `tronque`** : s'il vaut `true`, il reste des
messages plus anciens, et il faut relancer avec une profondeur explicite.

```bash
node client.js read <convId> 50
```

### Pièces jointes

Un message qui dit « voici le document » et dont le `text` est vide n'est pas un message vide :
c'est une pièce jointe. `read` liste chaque pièce jointe avec son id.

```bash
node client.js attachment <messageId>                  # la première
node client.js attachment <messageId> <attachmentId>   # une précise
node client.js attachment <messageId> - rapport.pdf    # nom de sortie choisi
```

Le fichier est **écrit sur disque** ; le base64 ne traverse jamais le terminal.

### Canaux non courriels (Messenger, SMS)

`read` aplatit volontairement l'enveloppe des messages. Sur un canal qui n'est pas du courriel, il
faut parfois voir la forme réelle de `from_field`, `to_fields` et du compte de canal pour savoir
comment répondre :

```bash
node client.js messageraw <messageId>
```

## Écriture — confirme avant

Ces actions modifient la boîte partagée ou sortent vers l'extérieur. Demande confirmation, sauf
instruction explicite dans le tour courant.

```bash
node client.js note <convId> "texte markdown"        # 🟡 note interne
node client.js labels <convId>                       # 🟡 JSON {add,remove,keepClosed} sur stdin
node client.js task <convId>                         # 🟡 JSON {title,assignees[],label} sur stdin
node client.js close <convId> "note optionnelle"     # 🟡 ferme le fil
node client.js reply <convId>                        # 🔴 sort vers le correspondant
node client.js send                                  # 🔴 COURRIEL NEUF
```

Ajoute une règle `permissions.ask` sur `reply` et `send` dans les réglages du projet : elles
demanderont alors confirmation même en mode automatique. C'est voulu — un courriel envoyé ne se
rappelle pas.

### Le brouillon est le défaut, et c'est le garde-fou principal

`reply` et `send` créent un **brouillon** tant que `"send": true` n'est pas passé. Le message se
dépose dans Missive et attend qu'un humain appuie sur envoyer. Garde ce défaut : c'est ce qui
rend une rédaction assistée récupérable.

```bash
echo '{"from":"allo@exemple.com","to":["personne@exemple.com"],
       "body":"Bonjour,\n\n…"}' | node client.js reply <convId>
```

### `send` — écrire à quelqu'un qui ne nous a jamais écrit

`reply` continue un fil et exige un `convId`. `send` ouvre un fil neuf : prospection, relance,
prise de contact. Même endpoint Missive derrière, sans le champ `conversation`.

```bash
echo '{"from":"allo@exemple.com","to":["personne@exemple.com"],
       "subject":"…","body":"…"}' | node client.js send
```

**Cinq destinataires maximum** par appel, `to` + `cc` + `bcc` confondus. Cette route sert au
contact ciblé. Si une tâche en demande plus, c'est un envoi de masse : ça se fait dans un outil
d'infolettre, pas ici, et ça se signale.

Écrire à froid engage la réputation de l'expéditeur. Montre toujours le texte avant, même quand tu
crées un simple brouillon, et n'invente jamais le nom d'une personne : va le lire à la source
(signature, page de contact) plutôt que de le déduire d'une adresse courriel.

### Étiquettes sur un fil déjà fermé

Poster sur un fil fermé le **rouvre**. Pour changer une étiquette sans ramener le fil dans
l'inbox :

```bash
echo '{"add":["<labelId>"],"remove":["<autreId>"],"keepClosed":true}' \
  | node client.js labels <convId>
```

## Limites réelles de l'API Missive

Elles viennent de l'API, pas du proxy. Les connaître évite d'accuser le code à tort.

- **10 messages par page maximum**, quoi que tu demandes. Le proxy pagine pour toi, mais c'est
  pourquoi lire un long fil prend du temps.
- **Même plafond de 10 sur les brouillons** — d'où le `limit` de `drafts` (max 500).
- **Le listage ne renvoie qu'un `preview` d'environ 130 caractères**, jamais le corps complet. Le
  proxy va chercher le corps message par message ; quand il n'y arrive pas, il le dit
  (`tronque: true`) au lieu de faire passer un extrait pour un texte entier.
- **Un « post » n'est pas un « comment ».** Une note déposée par `note` crée un *post* ;
  `notes` ne liste que les *comments*. La note est bien visible dans Missive, mais l'API ne la
  relira jamais. Ne conclus pas que la note a échoué.
- **`POST /posts` ne renvoie pas l'id de la tâche créée.** Une tâche créée par le proxy ne peut
  donc être ni relue, ni refermée, ni dédoublonnée par lui. **Ne recrée jamais une tâche en
  supposant que la première a échoué** — tiens ton registre ailleurs, dans un fichier du dépôt.
- **429 en cas de rythme soutenu.** Le proxy attend 260 ms entre deux appels et réessaie après
  30 s. Une grosse boucle est lente par conception ; ne la parallélise pas.

## À compléter pour ta propre boîte

Les sections ci-dessus sont vraies partout. Les suivantes ne le sont que chez toi — remplis-les,
c'est ce qui fait la différence entre un accès à l'API et un assistant utile.

- **Ton de voix et règles de rédaction.** Où vit la référence, et ce qu'il ne faut jamais promettre.
- **Règles de décision.** Délais, remboursements, exceptions : ce qu'un assistant peut trancher
  seul et ce qui remonte à un humain.
- **Vérification obligatoire avant de répondre.** Si une question se tranche avec une source
  externe (boutique en ligne, transporteur, CRM), dis laquelle, et exige-la. Une règle qui a
  fait ses preuves : *une question de suivi se tranche avec deux sources, jamais une seule* —
  la commande d'un côté, l'expédition de l'autre. Une commande payée peut n'avoir aucune
  expédition ; une expédition peut exister sans numéro de suivi transmis. Ces deux cas se
  répondent différemment.
- **Membres de l'équipe.** Prends les identifiants dans la carte ou via `users` avant toute
  assignation — ne devine jamais un id.
- **Langue.** Si la boîte est bilingue, la règle est simple : réponds toujours dans la langue de
  la personne.
