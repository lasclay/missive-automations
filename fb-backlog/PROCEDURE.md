# Procédure d'un tir — backlog de commentaires Facebook

Procédure commune aux trois Routines (`A`, `B`, `C`). Chaque Routine ne reçoit que sa lettre ;
tout le reste est ici. Une seule source, pas de dérive entre les trois.

## Le partage des rôles

`fb-backlog/traiter.js` porte tout ce qui est **mécanique** : moissonner, filtrer, appliquer la
priorité, cadencer, publier, vérifier, journaliser. **Tu ne fais qu'une chose : rédiger.**

C'est délibéré. Une session lancée par une Routine n'a ni connecteur MCP, ni droit d'émettre des
requêtes HTTP arbitraires — elle a le droit de lancer `node`. Toute la plomberie passe donc par
le script, qui parle au General Proxy. Ne tente jamais d'appeler Composio, Meta ou `curl`
directement : ça échouera, et c'est normal.

```
node fb-backlog/traiter.js candidats --tir <X>        # → le lot à rédiger, en JSON
node fb-backlog/traiter.js publier reponses.json --tir <X>
node fb-backlog/traiter.js etat                       # où en est chaque tir
```

## Périmètres — cloisonnés, jamais croisés

| Tir | Pages | Registre |
| --- | --- | --- |
| **A** | Lasclay `104242204750257` · Asclépiade & papillons monarques `114311920399404` | sobre · chaleureux |
| **B** | Lasclay: The Milkweed Company `368305119707866` | sobre |
| **C** | Milkweed & Monarchs `262382158951470` | chaleureux |

Les trois tirs se chevauchent dans le temps sans se marcher dessus : Pages disjointes, fichiers
d'état séparés. **Ne touche jamais aux fichiers d'une autre lettre.** Le script refuse d'ailleurs
une Page hors de ton périmètre.

## 1. Contexte

Dépôt `lasclay/missive-automations`, branche `main`. `git pull --rebase` d'abord. Lis :

- `fb-backlog/REGLES.md` — garde-fous, non négociables
- `fb-backlog/faits-verifies.json` — 20 thèmes, faits vérifiés, faits transverses
- `fb-backlog/exemplars.json` — 120 réponses écrites à la main : elles CALIBRENT le registre,
  jamais à copier

Charge le skill `lasclay-master` pour la voix de marque.

## 2. Prendre le lot

```
node fb-backlog/traiter.js candidats --tir <X> > /tmp/lot.json
```

Le script tire au sort s'il publie et combien — pondéré par l'heure de l'Est, qu'il calcule
lui-même — applique la priorité, et rend le lot. Si la sortie porte `"saute": true`, **le tir
s'arrête là** : c'est une heure de silence voulue, note-la et termine. La nuit, la plupart des
tirs sautent, et c'est le comportement recherché.

### Deux sortes de candidats

Chaque entrée porte un `type` :

- **`question`** — porte un point d'interrogation. Appelle une reponse utile, appuyee sur les
  faits verifies.
- **`récit`** — quelqu'un raconte son experience : ses cocons, ses semis, son plant disparu.
  Pas de question, mais une presence qui merite qu'on lui reponde.
- **`photo`** — aucun texte, seulement une image. Quelqu'un montre sa chenille, son plant, son
  monarque. Ce n'est pas un commentaire vide : c'est souvent le plus enthousiaste des trois.

  **Regarde l'image avant de repondre.** Le champ `image` du lot porte son URL :

  ```
  node fb-backlog/traiter.js image <url>     # -> ecrit le fichier dans /tmp/fb-images/
  ```

  Puis ouvre le fichier avec Read et reponds a ce que tu vois vraiment : la chenille au cinquieme
  stade, la chrysalide qui verdit, la talle en fleurs. C'est la que la reponse vaut le plus.

  La seule interdiction est de **deviner**. Si le telechargement echoue ou que l'image est
  illisible, reponds par un accueil chaleureux sans decrire quoi que ce soit, ou ecarte.

Un recit se repond **court** : une ou deux phrases, chaleureuses, qui accusent reception de ce que
la personne a vecu. Pas d'argumentaire produit, pas de lien vers la boutique, pas de conseil non
sollicite. Si elle raconte trois cocons, on parle de ses trois cocons.

N'exiger que les questions etait une erreur : sur les fils vivants, sept commentaires recents sur
huit sont des recits. Les ignorer donnait une Page qui ne repond jamais a ce qui vient d'etre
ecrit - exactement ce qu'un abonne remarque.

### Les sous-fils : transmis, pas rejetes

Chaque entree porte `adresse` — `la Page`, `la Page (reponse a notre commentaire)`, ou
`un autre abonne` — et, le cas echeant, `repond_a` avec l'auteur et un extrait du commentaire
parent.

Sur un fil vivant, **39 % des commentaires sont des reponses adressees a un autre abonne**. Les
rejeter d'office faisait tomber le taux d'eligibilite a 47 %. Beaucoup posent pourtant une vraie
question, ou s'adressent en fait a la marque sans la nommer. Ils te sont donc transmis avec leur
contexte, et c'est **ton jugement** qui tranche :

- une question, meme dans un sous-fil → reponds
- deux abonnes qui se parlent, sans rien qui nous concerne → ecarte, c'est leur conversation
- quelqu'un qui repond a NOTRE commentaire → reponds, c'est une conversation avec nous

**Le taux de rejet vise est sous 10 %.** S'il monte, c'est le signe qu'un filtre est trop strict
ou que le jugement ecarte trop large — signale-le dans ton rapport.

### La règle du 70 %

**Les commentaires du jour passent avant tout et sont traités en entier.** Le backlog ne prend
que ce qui reste, plafonné pour que le jour garde au moins 70 % du lot.

Une seule exception, explicite : si aucun commentaire n'est arrivé aujourd'hui, tout le lot va au
backlog — sinon une journée calme ne ferait rien avancer. Le champ `regle_priorite` de la sortie
dit laquelle des deux s'est appliquée.

Chaque entree du lot porte `origine` (`jour` ou `backlog`), `type` (`question` ou `récit`),
`page`, `registre`, `date`, `message` et `lien`.

## 3. Trier — c'est ton jugement, pas celui du script

Le script ne filtre que le structurel : non masque, sans reponse, assez long, pas ecrit par la
Page. Il ne juge ni la pertinence ni le ton. **Le jugement éditorial est à toi.** Écarte, en consignant
dans `etat/<X>-a-revoir.json` avec le motif :

- toute plainte de commande ou dossier client — ce sont des dossiers du support, jamais des
  questions publiques
- les échecs de germination, les diatribes, le sarcasme
- tout ce qui sort des faits vérifiés

**Dans le doute, écarte.** Un commentaire écarté ne coûte rien ; une réponse inventée coûte la
réputation de la marque.

## 4. Rédiger — chaque réponse est unique

Écris chaque réponse sur mesure à partir des faits vérifiés du thème, adaptée à ce que la
personne demande vraiment : sa région, son produit, son inquiétude précise. Deux réponses ne
doivent jamais être identiques ni quasi identiques, dans toute l'histoire du traitement, tous
tirs confondus. Varie la longueur et la forme : parfois une phrase, parfois trois. Une réponse
toujours calibrée pareil se repère autant qu'un texte copié.

Langue : celle du commentaire, toujours. Registre : sobre pour Lasclay et The Milkweed Company
(0 à 1 emoji) ; chaleureux et quétaine assumé pour Milkweed & Monarchs et Asclépiade & papillons
monarques (1 à 2 emoji).

Vouvoie en français. Aucune date de livraison. Aucun prix. Jamais « fabriqué au Québec » pour un
produit fini — l'isolant est cultivé et transformé au Québec, l'assemblage textile se fait surtout
en Tunisie depuis juillet 2026. Jamais « acheter sauve un monarque ».

## 5. Publier

Écris un fichier JSON `[{ "id": "...", "page_id": "...", "message": "..." }]` puis :

```
node fb-backlog/traiter.js publier /tmp/reponses.json --tir <X>
```

Le script publie **une réponse à la fois**, à intervalles tirés au sort entre 60 et 600 secondes,
relit chaque réponse auprès de Meta pour confirmer qu'elle existe, et enregistre au fur et à
mesure — pas à la fin. Un tir interrompu laisse donc un état juste.

Il s'arrête net, sans réessai, sur une limite de débit Meta, un code 368 ou une erreur de
permission. C'est voulu : réessayer aggrave le dossier auprès de Meta au lieu de le régler.

## 6. Enregistrer et rapporter

Le script tient `etat/<X>-repondus.json` et `etat/<X>-journal.jsonl` tout seul. À toi de tenir
`etat/<X>-a-revoir.json`. Puis :

```
git pull --rebase && git push
```

Un autre tir peut avoir poussé entre-temps ; comme vos fichiers sont disjoints, le rebase passe
toujours. Réessaie jusqu'à quatre fois avec un délai croissant. **Sans cette étape, le prochain
tir produira des doublons.**

Termine par un rapport court : le lot obtenu et la règle de priorité appliquée, le nombre publié,
le nombre écarté et pourquoi, et tout ce qui a échoué.

## Si la publication est refusee par le classificateur

`node fb-backlog/traiter.js publier` doit figurer dans les regles de permission de
`.claude/settings.json`. Si un tir redige ses reponses puis se bloque a l'etape 6, c'est cette
regle qui manque - pas un probleme d'acces a Facebook. Les reponses deja redigees restent dans
`etat/` : rien n'est perdu, le tir suivant les republiera.

## En cas de panne

`node connectors_client.js facebook diag` dit en une commande quelle voie d'accès est vivante et,
en cas d'échec, l'erreur exacte. Charge le skill `composio` : il documente les pièges connus —
deux surfaces Composio distinctes, la clé `ck_` qui n'en est pas une, la forme du corps en v3.1,
et le jeton par Page qu'exige Meta.
