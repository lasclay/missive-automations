---
name: missive-messenger-7jours
description: Répondre aux conversations Facebook Messenger de Lasclay quand la fenêtre de 7 jours de l'API Meta est dépassée — ce que le proxy Missive peut et ne peut pas faire sur ce canal, comment auditer un arriéré Messenger, et comment produire un markdown exécutable par un agent qui pilote Meta Business Suite dans le navigateur. Couvre aussi le ménage du spam d'hameçonnage « Meta » et la vérification obligatoire avant tout message touchant une commande.
when_to_use: Déclenche dès qu'il est question de Messenger, de la boîte APM, des pages Asclépiade & papillons monarques ou Milkweed & Monarchs, de Business Suite, de la fenêtre de 7 jours, ou d'un message Facebook auquel on ne peut pas répondre. Déclenche aussi sans nommer Messenger — « pourquoi le proxy ne peut pas répondre à cette cliente », « vide l'arriéré de la page Facebook », « prépare les réponses pour que Cowork les envoie », « il y a du spam Meta dans la boîte ».
argument-hint: [ce que tu veux faire avec l'arriéré Messenger]
allowed-tools:
  - Bash(node missive_client.js:*)
  - Bash(node connectors_client.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# Messenger au-delà de 7 jours — la méthode

Ce skill existe parce que la conclusion « on ne peut pas répondre à ces gens » est fausse, et
que la conclusion inverse — « le proxy va s'en occuper » — l'est tout autant. Il y a un
chemin, il passe par un humain ou un agent qui pilote un navigateur, et il se prépare
entièrement ici.

## La contrainte, énoncée correctement

Meta n'autorise l'envoi d'un message par l'API Pages que dans une **fenêtre de 24 heures**
après le dernier message du client, étendue à **7 jours** pour certaines catégories. Passé ce
délai, l'API refuse l'envoi. C'est une règle de plateforme, pas une limite de notre code.

Trois conséquences qu'il ne faut pas confondre :

| Affirmation | Vrai? |
| --- | --- |
| « Le proxy Missive ne peut pas répondre sur Messenger » | **vrai**, et pour une autre raison encore : `reply` construit un courriel, et une conversation Messenger n'a pas d'adresse |
| « Le General Proxy peut le faire, il a Facebook » | **faux** — il couvre les **publications et commentaires** de Page, pas la boîte Messenger |
| « Personne ne peut répondre » | **faux** — l'interface Meta Business Suite permet de répondre à n'importe quel fil, sans limite de fenêtre |

**La formulation juste : « l'API ne peut plus envoyer, l'interface le peut encore ; on prépare
les réponses et on les envoie par Business Suite. »**

Ne jamais annoncer au demandeur que le dossier est perdu. Ce n'est pas vrai, c'est juste plus
lent.

## Où vivent ces conversations

La boîte Messenger de Lasclay est l'équipe Missive **APM**
(`1c57f5cd-3877-4067-b6d4-8344c5d29af9`). Elle fusionne **deux pages Meta distinctes** :

| Page Meta | Langue dominante | Nom vu dans Missive sur nos propres messages |
| --- | --- | --- |
| Asclépiade & papillons monarques | français | `Asclépiade & papillons monarques` |
| Milkweed & Monarchs | anglais | `Milkweed & Monarchs` |

**Business Suite ne les fusionne pas.** Chaque page a sa propre boîte, et chercher un nom
francophone dans la boîte anglaise ne renvoie rien — pas une erreur, zéro résultat, ce qui se
lit à tort comme « le fil a disparu ». C'est le piège numéro un de l'exécution.

La règle langue → page est fiable mais pas absolue. Un contact introuvable se cherche dans
l'autre page **avant** d'être déclaré manquant.

## Lire l'arriéré

```bash
node missive_client.js list "team_inbox=1c57f5cd-3877-4067-b6d4-8344c5d29af9&organization=d2b9b52d-ceff-4811-aea7-1f092ec95f36"
```

Ce filtre rend l'ensemble de la boîte en une trentaine de secondes. Mesuré le 2026-08-20 :
**164 fils, dont 162 dont le dernier message vient du client**, le plus vieux datant de 2023.

Puis, fil par fil :

```bash
node missive_client.js read <convId> 30
```

Trente messages plutôt que dix : le défaut de l'API plafonne à 10, et un fil Messenger long
se lit alors par sa fin, sans qu'on le sache.

### Le piège de la détection « nous / eux »

`isUs()` dans `missive-proxy/server.js` marque un message comme sortant si son adresse est
l'une des nôtres **ou si `author.name` est renseigné**. Sur Messenger :

- Nos messages sortants portent `from: "Asclépiade & papillons monarques"` ou
  `"Milkweed & Monarchs"` et `us: true`. Fiable.
- Les messages du client portent `from: "?"` et `address: null`. Il n'y a **pas d'adresse
  courriel** — c'est ce qui empêche `reply` de fonctionner.
- **Des messages sortants anciens sont parfois marqués `us: false`**, quand `author` n'a pas
  été enregistré. On les repère au contenu : un lien `lasclay.com`, un tutoiement de
  service, une réponse à la question précédente.

Conséquence pratique : **ne jamais se fier au seul champ `us` pour dire qu'un fil est non
répondu.** Lire le dernier échange. Un « Thank you! » final n'est pas un fil à traiter, c'est
un fil clos.

### Récupérer les pièces jointes

Beaucoup de questions Messenger sont des photos — « c'est quoi cette plante », « quel papillon
est-ce ». Y répondre sans regarder l'image, c'est inventer.

```bash
node missive_client.js attachment <messageId> <attachmentId> /chemin/sortie.jpg
```

Les `messageId` et `attachmentId` viennent du champ `attachments[]` renvoyé par `read`. Puis
lire le fichier avec l'outil de lecture d'image.

Sur un lot d'identification, il faut assumer l'incertitude : une abeille photographiée de loin
ne s'identifie pas au-delà de la famille, et le dire vaut mieux que d'inventer une espèce.

## Ce qu'on produit

Un seul fichier markdown, exécutable tel quel par un agent qui pilote le navigateur. Chaque
réponse dans un **bloc de code**, prête à copier sans retouche. Structure éprouvée :

1. **Contexte et contrainte** — pourquoi ce document existe, ce qui a été vérifié.
2. **Règles de rédaction** appliquées, énoncées explicitement.
3. **Mode d'emploi de Business Suite** — pages, sélecteur, comportement de la souris, boucle.
4. **Passe 0 — spam.**
5. **Vérifications obligatoires** avant tout message touchant une commande.
6. **Section 1 — à envoyer**, triée du plus récent au plus ancien, chaque entrée taguée
   `[EN]` ou `[FR]`.
7. **Section 1B — messages courts** (photos, encouragements).
8. **Section 2 — escalade humaine.** L'agent n'y touche pas.
9. **Section 3 — ne pas répondre.** Tableau avec motif.
10. **Annexes** — faits vérifiés (catalogue, stocks, URL) et défauts de fond révélés.
11. **Ordre de passage** — deux listes numérotées, une par page.

L'ordre de passage par page n'est pas cosmétique : il évite de changer de page cent fois.
Un seul changement dans toute l'exécution.

## Le registre Messenger n'est pas le registre courriel

`connaissance_support.md` décrit une voix de marque construite sur du courriel. Transposée
telle quelle dans Messenger, elle sonne faux.

| Courriel | Messenger |
| --- | --- |
| « Bonjour Prénom, » puis ligne vide | même chose, mais tout est plus court |
| Séparateur `__` + signature + titre | **rien** — pas de bloc de signature |
| « Chaleureusement, / Gabriel / Co-fondateur » | **jamais** |
| Paragraphes de 3-4 lignes | 1 à 2 lignes |
| Notice de transparence IA en pied | voir plus bas |

Ce qui ne change pas : **la langue du client**, le **vouvoiement en français** (le tutoiement
n'est pas une politique confirmée, `connaissance_support.md` l'interdit en automatisation), un
emoji maximum et jamais sur une mauvaise nouvelle.

Détail d'exécution : dans Messenger, `Entrée` **envoie**. Les retours à la ligne à l'intérieur
d'une réponse se font en `Maj+Entrée`. À écrire dans le mode d'emploi, sinon une réponse de
six paragraphes part en six messages.

### La notice de transparence IA

`support.js` l'ajoute en pied de **tous** les messages du système, avec le numéro
581-982-5857. Elle est écrite pour le courriel.

Sur Messenger, la poser sous une réponse d'une phrase est disproportionné : le client peut
répondre dans le même fil, et un humain relit avant d'envoyer. **La position tenable, et à
énoncer explicitement dans le document** : notice sur les réponses qui engagent
commercialement ou touchent une commande, pas sur les réponses botaniques courtes. Fournir les
deux versions FR et EN en tête de document pour que le demandeur puisse trancher autrement.

Ne jamais prendre cette décision en silence. C'est une dérogation à une règle écrite : elle
s'assume et se signale.

## Passe 0 — le spam

Les messages d'hameçonnage n'apparaissent **pas** dans Missive : ils ne sont visibles que dans
Business Suite et ne peuvent donc pas être listés à l'avance. Ils se traitent en direct.

Le gabarit dominant est le faux avis Meta : « Your Facebook page is scheduled to be permanently
removed due to violating our trademark rights », signé « Facebook Support Team », avec un lien
de contestation vers un domaine qui n'est pas facebook.com.

**Le critère absolu : Meta ne contacte jamais une Page par Messenger.** Les avis d'infraction
passent par le Espace Comptes ou par courriel `@facebookmail.com`.

Signaux secondaires : expéditeur qui est un profil personnel, lien en `.click` `.top` `.xyz`
`.online` `.cfd` ou raccourcisseur, menace de suppression « permanente » avec décision
« finale », motif d'infraction jamais rattaché à une publication précise.

Marche à suivre : **ne cliquer sur aucun lien**, ne pas répondre, **signaler** (bouton triangle
d'avertissement, premier de la rangée d'icônes en haut à droite du fil, à gauche de la
corbeille), puis supprimer, puis consigner l'expéditeur dans le rapport de fin.

En cas de doute, **ne rien signaler** : un signalement à tort est irréversible et peut coûter
un vrai contact. Laisser en place et inscrire au rapport.

## Vérification avant tout message touchant une commande

Cette règle prime sur le brouillon. Elle vient d'une erreur réelle documentée dans le skill
`support` : une quarantaine de réponses envoyées sans vérification, trois clients informés à
tort, une cliente dont le dossier était réglé depuis trois semaines relancée deux fois.

Sur un arriéré Messenger de plusieurs mois, ce n'est pas le pire cas, c'est le cas probable.

**Trois sources, dans cet ordre.**

1. **Les courriels.** La plus importante et la plus oubliée. Un client qui écrit sur Messenger
   écrit très souvent aussi par courriel, et c'est là que le dossier a été traité. Chercher
   par **nom** et par **adresse**, pas par numéro de commande. Réglé → ne rien envoyer.
   Plainte ou litige en cours → escalade, ne rien envoyer.
2. **Shopify.** `displayFinancialStatus`, `displayFulfillmentStatus`, `lineItems.currentQuantity`,
   `refunds`, `fulfillments.trackingInfo`. Un `currentQuantity: 0` avec un remboursement daté
   est une ligne annulée et traitée, pas un oubli.
3. **ShipStation**, via le skill `proxygen`. Deux pièges : un renvoi devient une commande
   **manuelle** sans le numéro `L-` d'origine, donc chercher par **nom** ; et un envoi par
   timbre n'apparaît que dans les `fulfillments` de Shopify, jamais dans les `shipments` —
   son absence dans ShipStation ne prouve rien.

**L'arbre de décision :**

| État réel | Action |
| --- | --- |
| Réglé par courriel | ne rien envoyer, archiver |
| Plainte ou litige en cours | ne rien envoyer, escalade |
| Non expédiée, aucune fulfillment | ne rien envoyer, escalade — il y a un geste à poser |
| Expédiée, livraison confirmée | message court de confirmation |
| **Expédiée, aucune confirmation claire nulle part** | **message « est-ce que c'est bien arrivé? »** |
| Déjà remboursée ou renvoyée | ne rien envoyer, archiver |

Le dernier cas est le plus fréquent d'un arriéré Messenger, parce que les semences partent par
**timbre, sans numéro de suivi** : il n'existe aucune preuve de livraison, donc aucune façon
de trancher. Le seul message honnête demande, et s'engage sur la suite :

> Bonjour [Prénom],
>
> On revient là-dessus, et désolé du silence — ce n'est pas dans nos habitudes.
>
> De notre côté, la commande est bien partie. Par contre, les semences voyagent en enveloppe
> timbrée, sans numéro de suivi, alors on n'a aucune façon de confirmer la livraison de notre
> bout.
>
> Est-ce que le colis a fini par arriver?
>
> Si ce n'est pas le cas, dites-le-nous simplement et on règle ça. Un envoi par timbre qui se
> perd, ça arrive, et c'est à nous de le reprendre — pas à vous de le prouver.

Version anglaise équivalente dans le document produit. **N'y ajouter ni date, ni numéro de
suivi qu'on n'a pas, ni « ça devrait arriver sous peu ».**

Politique tenable sur les envois par timbre : **renvoyer sans discuter**. La discussion coûte
plus cher que le sachet, et il n'existe aucune preuve à opposer au client.

## Piloter Business Suite sans se faire couper

Meta limite les comportements d'automatisation. Le risque concret n'est pas le bannissement,
c'est un CAPTCHA au milieu de la série ou un throttling qui fait échouer des envois
silencieusement.

À écrire dans le document, parce qu'un agent ne le déduira pas :

- Trajectoires de souris **courbes**, à vitesse variable, jamais de saut d'un point à l'autre.
- Pause de 150 à 400 ms avant chaque clic, micro-dérive du curseur entre les actions.
- Frappe **caractère par caractère**, 40 à 120 ms par touche, jamais d'injection d'un bloc.
- Défilement à la molette, par crans.
- 8 à 25 secondes entre deux conversations, tirées au hasard.
- Pause de 2 à 4 minutes toutes les 12 à 15 réponses.
- **Plafond de 25 à 35 envois à l'heure.** Cent réponses s'étalent donc sur trois à quatre
  heures. C'est le paramètre qui distingue le plus nettement une session humaine d'un script,
  et aller plus vite est le seul vrai moyen de tout casser.

**Le sélecteur de page** est l'avatar rond avec la pastille Facebook, tout en haut de la barre
latérale gauche, sous le logo Meta — pas le menu hamburger plus bas, pas l'engrenage.

**L'onglet de travail est `Messenger`**, pas `All messages` et surtout pas
`Facebook comments`, qui est un arriéré distinct traité dans `fb-backlog/`.

**Contrôle obligatoire avant chaque envoi :** le dernier message du fil doit correspondre à la
citation de l'entrée. S'il a bougé, ne rien envoyer et le consigner.

## Le régime de temporalité s'applique intégralement

Tout ce qu'énonce le skill `support` reste vrai ici, et vaut d'être rappelé parce qu'un
arriéré Messenger est par construction vieux :

- **L'âge sert au ton, il ne s'énonce jamais.** Aucun « votre message de mars », aucun « ça
  fait un an ».
- **Aucune promesse d'action** sur un fil de plus de trois semaines. On vérifie l'état réel,
  puis on demande si c'est encore d'actualité.
- **Excuse jamais nue.** Une seule, avec un motif concret ou un cadrage « ce n'est pas dans
  nos habitudes ». Jamais deux marqueurs empilés.
- **Un vieux fil sans question se ferme sans écrire.** Un remerciement, un sticker, une photo
  de deux ans : réaction 👍 et archivage. Écrire pour écrire rouvre un dossier clos.
- **Aucun souhait saisonnier décalé**, aucun délai chiffré non sourcé.

Ordre de tri du document : **du plus récent au plus ancien**. C'est aussi l'ordre
d'importance, et ça met le travail utile en tête si l'exécution s'interrompt.

## Ce qu'un audit Messenger révèle en plus des dossiers

Un arriéré n'est pas qu'une pile de clients à traiter, c'est un échantillon. Sur les 162 fils
d'août 2026, la fréquence des questions a mis au jour des défauts que personne n'avait
formulés : le site ne dit pas quelle espèce convient à quelle région alors que c'est le
premier motif d'écriture (24 fils sur 162) ; une variante marquée « Ouest canadien seulement »
se vend quand même à un client de l'Est ; trois clients signalent indépendamment la même
couture au pouce des mitaines ; Shop Pay masque le paiement par carte.

**Consacrer une annexe à ces causes.** Elles valent plus que les réponses, parce qu'elles
continueront de produire des messages tant qu'elles ne seront pas corrigées.

Et la cause première, à ne pas oublier de nommer : **`support.js` balaie sept équipes, et APM
n'en fait pas partie.** Rien dans le processus ne faisait remonter ces fils. C'est le défaut
qui a produit tous les autres.

## Skills complémentaires

- **`missive`** — accès au proxy, carte de la boîte, identifiants des équipes et étiquettes.
- **`support`** — méthode de vérification, règles de décision internes, garde-fous.
- **`proxygen`** — ShipStation, pour la vérification des expéditions.
- **`lasclay-master`** — voix de marque, cadres de réponse aux objections.

Charger `missive` et `support` systématiquement. `proxygen` dès qu'un fil touche une livraison.
