# Plan d'exécution : ce qui reste dans LAS Support

**Date :** 2026-08-24
**Boîte :** LAS Support, **36 fils restants** (142 en début de journée)
**Sources des règles :** `connaissance_support.md`, skill `support`, skill `lasclay-seo`, `support.js`

---

## Qui exécute quoi

**Ce document n'est pas un brief Cowork, sauf pour huit fils.**

| Canal | Fils | Qui exécute |
| --- | --- | --- |
| **Courriel** | **28** | **Le proxy Missive**, directement. Les blocs ci-dessous se frappent avec `node missive_client.js reply`. Cowork n'a rien à y faire. |
| **Messenger** | **8** | **Cowork, dans Business Suite.** Ils n'ont aucune adresse courriel, donc le proxy ne peut pas y répondre. Ils sont **déjà couverts par `SOCIAL-20260824.md`** et listés ici seulement parce qu'ils occupent la boîte Support. |

Les huit fils Messenger : Sol Veil `[5eef512f]`, Josef Schwabl `[88f3058f]`, Marc-André Marchand
`[25e6e274]`, Patrick Fortier `[f24b8b24]`, Danielle Drolet `[064ee3c8]`, Caroline Riel
`[c0c9d2d5]`, Gino Poitras `[7cdcdfe8]`, Lynne Lalonde `[73f06bc6]`, plus Martine Savard
`[ba5d405c]` qui est en attente d'une action de sa part.

---

## Vérifications ShipStation, faites le 2026-08-24

Aucun bloc de ce document ne demande à un exécutant de vérifier ShipStation : **la vérification a
été faite ici**, par recherche du nom du client, y compris sur les commandes manuelles à six
chiffres invisibles dans Shopify.

| Dossier | Résultat |
| --- | --- |
| **Sylvia McVicar** L-50688 | **présente dans ShipStation au statut `awaiting_shipment`.** La commande n'est pas perdue, elle attend dans la file depuis le 16 juin. |
| **Francis Gagnon** L-50705 | **`awaiting_shipment`** depuis le 20 juin. Même cas. |
| **Marc-Olivier Gagnon** L-50159 | **`awaiting_shipment`** depuis le 30 mai, 402,41 $. Même cas. |
| **Susan Arata** | L-39454 seule au dossier. **Aucun renvoi, aucune commande manuelle.** Rien n'a été fait. |
| **Marie-Pierre Verret** | L-39238 seule. Aucun renvoi. |
| **Jean-Guy Guérard** | L-44129 seule. Aucun renvoi, aucune correction d'adresse. |
| **Camille Desvignes** | Dernière expédition le 7 février 2026, **rien après la promesse du 4 mars**. |
| **Stéphanie Girard** | L-47016 expédiée le 12 février, **rien après la promesse du 4 mars**. |
| **Linda Lavoie** | Dernière expédition en septembre 2025, **rien en 2026**. L'attache de remplacement n'est jamais partie. |
| **Martin Gauthier** | Dernière expédition en septembre 2025. **L'envoi annoncé pour le 27 juillet 2026 n'a pas eu lieu.** |
| **Anne-Marie Gagné** | Aucune commande à son nom. Le matériel d'isolation n'est jamais parti. |

**Conséquence : les quatre dossiers de la catégorie B ne sont plus incertains. Ce sont des
promesses non tenues, confirmées.** Les blocs correspondants sont corrigés en ce sens.

Les trois commandes `awaiting_shipment` sont la trouvaille la plus actionnable du lot : elles ne
sont ni perdues ni annulées, elles attendent simplement que quelqu'un les traite dans ShipStation.

---

## Le registre courriel n'est PAS le registre Messenger

Les trois briefs précédents (`AUDITAPM2`, `AUDITAPM3`, `SOCIAL-20260824`) portaient sur Messenger
et Instagram. **Le registre courriel est différent sur trois points qui se voient immédiatement,
et appliquer le style Messenger ici produirait des messages qui sonnent faux.**

| | Messenger | **Courriel, ce document** |
| --- | --- | --- |
| Salutation | « Bonjour Prénom, » puis ligne vide | **identique** |
| Longueur | 1 à 2 lignes par paragraphe | paragraphes courts, mais message plus étoffé |
| Signature | **aucune** | **obligatoire** : séparateur `__`, prénom, titre, « Lasclay » |
| Clôture | aucune | **« Chaleureusement, »** en français, **« Warmly, »** en anglais |
| Notice de transparence IA | **jamais** | **sur tous les messages**, voir plus bas |

### La structure exacte, tirée de `connaissance_support.md`

```
Bonjour [Prénom],
[ligne vide]
[corps, paragraphes d'une ou deux phrases]
[ligne vide]
[formule de disponibilité, facultative]
[ligne vide]
Chaleureusement,
__
[Prénom de l'agent]
Lasclay
```

### La notice de transparence IA, à coller telle quelle en pied de message

`support.js` l'ajoute au corps de **tous** les messages du système. Elle est obligatoire ici,
contrairement à Messenger. Version française :

> Petit mot en toute transparence : ce message a été préparé par un nouveau système de réponse
> assisté par intelligence artificielle, présentement en rodage. S'il y a le moindre problème, il
> est possible de me joindre directement au 581-982-5857 pour régler le dossier rapidement.

Version anglaise :

> A quick note for transparency: this message was prepared with a new AI-assisted response system
> that we're currently fine-tuning. If anything is off, I can be reached directly at
> 581-982-5857 to sort it out quickly.

**Les blocs ci-dessous ne contiennent PAS la notice.** Ajoute-la à la fin de chacun, après la
signature, dans la langue du message.

---

## Règles de rédaction

Tirées de `connaissance_support.md`, section « Ton de marque Lasclay », et du skill `lasclay-seo`.

| Règle | Détail |
| --- | --- |
| **Aucun cadratin** | Règle de marque `lasclay-seo` : « Pas de cadratins. Utilise des virgules, des deux-points, des parenthèses ou des traits d'union simples. » Le tiret demi-cadratin est proscrit aussi. Vérifié : zéro dans les blocs de ce document. |
| **Vouvoiement** | Le tutoiement existe dans le corpus sous la plume de Gabriel, mais `connaissance_support.md` le classe en **manque documenté** : la politique n'est pas confirmée et **il ne doit pas être automatisé**. Tous les blocs vouvoient. |
| **Un emoji maximum** | Seul 😊 est attesté. Jamais sur une mauvaise nouvelle ni sur un message d'excuse. |
| **Longueur proportionnelle** | Courte pour une confirmation, longue seulement pour un problème complexe. Pas d'introduction rhétorique. |
| **Excuse jamais nue** | Formule attestée : « Désolé pour le délai de réponse plus long qu'à l'habitude. » Un seul marqueur d'excuse, jamais deux empilés. |
| **L'âge du fil ne s'énonce jamais** | Il sert au ton, pas au texte. |
| **Ne jamais promettre une date qu'on n'a pas** | « sous peu », « dans les prochains jours » sont des dates inventées. |
| **Pas de coquilles du corpus** | Le corpus réel contient « mentionnes », « le le » : ne pas les reproduire. |

### Formulations attestées, réutilisables mot pour mot

- Délai de réponse : **« Désolé pour le délai de réponse plus long qu'à l'habitude. »**
- Charge de travail : **« Bref, on ne t'oublie pas et on ne te laisse pas tomber ! »** (à vouvoyer)
- Période de retour : **« Il va de soi que la période de retour s'applique au moment où le client
  nous mentionne un désir d'effectuer un échange ou un remboursement, et non au moment où nous
  avons le temps de répondre. »**
- Disponibilité en fin de corps : **« Nous demeurons à votre disposition pour toute information,
  il nous fera plaisir de vous aider. »**

### Réponses types de Missive à connaître

Elles existent déjà dans `connaissance_support.md` et plusieurs blocs ci-dessous s'en inspirent :

| Réponse type | Sert à |
| --- | --- |
| **(FR) Suivi timbres poste régulière** | Expliquer l'absence de suivi sur un envoi par timbre, 5 à 12 jours ouvrables |
| **(FR) Suivi pour commande pas encore traitée** | Rassurer sur une commande non expédiée |
| **(FR) Réexpédition longue date, confirmation adresse** | Confirmer l'adresse avant d'expédier une vieille commande |
| **(FR) Modification d'adresse de livraison** | |
| **Retard production GÉNÉRAL** | Délai d'assemblage chez la sous-traitante en Beauce |

---

## Faits vérifiés le 2026-08-24

Tout ce qui suit vient de Shopify ce jour. **Ne rien affirmer d'autre sur le stock.**

| Produit | État |
| --- | --- |
| Semelles **9 femme / 7 homme** | **rupture franche, stock à moins 32.** La vente reste autorisée, ce qui explique l'affichage trompeur. |
| Semelles disponibles | 6 femme (2), 7 femme (5), 12 femme / 10 homme (7), 12 homme (9). Toutes les autres sont en rupture. |
| **T-shirt unisexe en coton brodé, monarque et asclépiade** | **existe, en prévente.** `lasclay.com/products/t-shirt-coton-brode-monarque-asclepiade` |
| **Bague Aile de monarque, taille 6,5** | **il en reste exactement une**, 109,99 $, vente finale |
| Manteau isolé | Homme XL : 2. **Homme 2XL et Femme 2XL : rupture.** Aucune gamme Tall au catalogue. |
| Guide des tailles | `lasclay.com/pages/sizing-chart-guide-tailles` |
| Téléphone du service | **581-982-5857** |

---
## Catégorie A. Livraisons en souffrance (7)

**La seule catégorie qui coûte de l'argent chaque jour.** Quatre de ces sept exigent un geste
humain avant ou après l'envoi, signalé sous chaque bloc.

### A1. Sylvia McVicar `[d5f2b5f9]` [EN] · **commande payée jamais expédiée**
**VÉRIFIÉ.** L-50688, 49,42 $, coussin d'assise thermique, **payée le 16 juin, aucune expédition
à ce jour**. Elle a relancé le 13 août : « Do you have an update for me? When will the seat pad
arrive? » Sans réponse.

**Vérifié dans ShipStation : la commande y est, au statut `awaiting_shipment`.** Elle n'est pas
perdue, elle attend dans la file depuis le 16 juin.
**AVANT L'ENVOI : traiter la commande dans ShipStation, ou obtenir une date ferme.** Ne pas
envoyer ce bloc sans cela, il promettrait une date inventée.

```
Hello Sylvia,

Your seat pad has not shipped, and there is no good reason for that. You paid in June, you followed up in August, and neither got you an answer. That is on us.

[Un humain complète ici : la date d'expédition ferme, ou le remboursement.]

You will get the tracking number by email the moment it goes out.

Warmly,
__
Lasclay
```

### A2. Francis Gagnon `[214e431f]` [FR] · **254,49 $ payés, jamais expédiés**
**VÉRIFIÉ.** L-50705, **254,49 $**, passée le 21 juin, **aucune expédition**. Son dernier message
ne contient que le numéro de commande et la date : c'est une relance sèche, et elle se comprend.

**Vérifié dans ShipStation : `awaiting_shipment` depuis le 20 juin.** Même situation que A1 :
la commande attend d'être traitée.
**AVANT L'ENVOI : la traiter dans ShipStation, ou obtenir une date ferme.**

```
Bonjour Francis,

Votre commande L-50705 n'est pas partie, et vous avez raison de nous relancer.

[Un humain complète ici : la date d'expédition ferme, ou le remboursement.]

Vous recevrez le numéro de suivi par courriel dès que le colis sera en route.

Chaleureusement,
__
Lasclay
```

### A3. Susan Arata `[d1003cfb]` [EN] · **ESCALADE, ne pas envoyer**
**VÉRIFIÉ.** L-39454, **98,30 $**, expédiée le 16 septembre 2025 **sans numéro de suivi**, donc
par timbre. Jamais reçue. Aucun remboursement, aucun renvoi. Elle écrit depuis février qu'elle
déconseille l'entreprise autour d'elle. Notre dernier message, en mars, disait « We will look
into it and get back to you as soon as possible ». **Rien depuis 176 jours.**

Le dossier demande un renvoi ou un remboursement de 98,30 $, pas un message. Un humain tranche.

### A4. Marie-Pierre Verret `[2055bda9]` [FR] · envoi sans suivi
**VÉRIFIÉ.** L-39238, 68,98 $, tuque de ville et sac à bouteille de vin. Marquée expédiée le
21 novembre 2025, **sans aucun numéro de suivi**, et `shippingAddress` est vide au dossier, ce
qui est le motif d'une commande en ramassage. Elle demandait un suivi le 10 novembre. **295 jours
sans réponse.** Aucune preuve de livraison n'existe et aucune ne peut être produite.

```
Bonjour Marie-Pierre,

Désolé pour le délai de réponse plus long qu'à l'habitude.

Votre commande, la tuque de ville et le sac à bouteille de vin, a été marquée expédiée de notre côté. Le problème est qu'aucun numéro de suivi n'a été enregistré, alors nous n'avons aucune façon de confirmer la livraison.

Est-ce que le colis a fini par vous arriver ?

Si ce n'est pas le cas, dites-le-nous simplement et nous refaisons partir la commande. Vous n'avez rien à prouver de votre côté.

Chaleureusement,
__
Lasclay
```
**APRÈS.** Si elle répond non : recréer la commande, **avec suivi cette fois**.

### A5. Jean-Guy Guérard `[20506548]` [FR] · adresse changée, ignorée
**VÉRIFIÉ.** L-44129, cache-cou gris pâle, 49,42 $. Marquée expédiée **le lendemain de la
commande, sans numéro de suivi**. Il écrit avoir demandé un changement d'adresse dès la commande
passée, et une confirmation, sans jamais rien obtenir. **259 jours.**

```
Bonjour Jean-Guy,

Vous avez demandé un changement d'adresse et une confirmation, et vous n'avez reçu ni l'un ni l'autre. C'est notre erreur.

Voici ce que nous voyons de notre côté : votre cache-cou a été expédié le lendemain de la commande, sans numéro de suivi. Nous ne pouvons donc ni confirmer où il est allé, ni s'il est arrivé.

Deux questions pour qu'on règle ça pour de bon :

Quelle est la bonne adresse aujourd'hui ?
Et est-ce que le colis a fini par vous parvenir malgré tout ?

Selon votre réponse, nous refaisons partir un cache-cou à la bonne adresse, avec un numéro de suivi cette fois.

Chaleureusement,
__
Lasclay
```
**APRÈS.** Recréer la commande à la bonne adresse s'il n'a rien reçu.

### A6. Diane Pagé `[9a81996a]` [FR] · relance sur un choix
**VÉRIFIÉ.** L-50787 expédiée le 21 août, suivi `5082011848313329`. Le foulard vert était en
rupture ; on lui a demandé de choisir entre un envoi différé sans frais et un remboursement de
cette portion. **Elle n'a pas répondu.**

```
Bonjour Madame Pagé,

Votre coussin pour animaux est bien parti le 21 août.

Il reste la question du foulard vert, toujours en rupture. Vous aviez le choix entre le recevoir sans frais dès qu'il rentre, ou être remboursée de cette portion tout de suite.

Dites-nous simplement lequel des deux vous convient et nous l'appliquons.

Chaleureusement,
__
Lasclay
```

### A7. David Morin `[ee2b4f2a]` [FR] · **laissé ouvert volontairement**
**VÉRIFIÉ.** L-43082 **livrée le 30 décembre 2025**, suivi `5082011205999319`. Le dossier de
livraison est clos. Ce qui ne l'est pas : il a écrit « je trouve ça tout de même dommage que ça
prenait un avis pour avoir un suivi », après avoir retiré son avis négatif.

**C'est un dossier de réputation, pas de logistique.** Décision humaine sur ce qu'on lui doit.

---

## Catégorie B. Envois annoncés, jamais confirmés (4)

Chacun se termine sur une promesse d'envoi de notre part.

**Vérifié dans ShipStation le 2026-08-24, recherche par nom, commandes manuelles incluses :
aucun de ces quatre envois n'a eu lieu.** Ce ne sont pas des incertitudes, ce sont des promesses
non tenues. Les blocs peuvent partir tels quels.

### B1. Gaétan `[53e71137]` [FR] · **une paire l'attend physiquement**
Le 3 mars, on lui a écrit que ses mitaines XL plein air étaient arrivées et qu'il pouvait passer
les récupérer à l'atelier. **Il n'est jamais venu. Six mois.** La paire est vraisemblablement
encore là.

```
Bonjour Gaétan,

Vos mitaines XL plein air sont toujours à l'atelier, mises de côté à votre nom.

On ne veut pas les garder indéfiniment sans savoir si vous les voulez encore. Deux options :

Vous passez les chercher à l'atelier, du lundi au vendredi entre 8 h et 16 h.
Ou on vous les expédie, sans frais. Donnez-nous simplement l'adresse.

Dites-nous ce qui vous convient et on s'en occupe.

Chaleureusement,
__
Lasclay
```
**APRÈS.** Vérifier physiquement que la paire est encore en réserve avant d'envoyer.

### B2. Camille Desvignes `[8fce7d54]` et B3. Stéphanie Girard `[4d224184]` [FR]
Deux fils de « Modification commande » du 4 mars. Dans les deux, notre dernier message dit que la
commande **partait le jour même**, l'un avec la version noire, l'autre avec la besace rouge.
Aucun numéro de commande n'apparaît dans les fils, donc rien n'est vérifiable. **181 jours.**

```
Bonjour [Prénom],

On revient sur votre commande pour s'assurer que tout s'est bien rendu.

Est-ce que vous avez bien reçu [la version noire / la besace rouge] ?

Si quelque chose manque ou n'est jamais arrivé, dites-le-nous et on corrige tout de suite.

Chaleureusement,
__
Lasclay
```

### B4. Linda Lavoie `[57d172fb]` [FR]
Le 26 juillet, on a confirmé que l'attache de remplacement partait au 1305 boulevard Lebourgneuf.
29 jours, pas de confirmation.

```
Bonjour Linda,

Petite vérification de notre côté : est-ce que l'attache de remplacement vous est bien parvenue au 1305 boulevard Lebourgneuf ?

Si elle n'est jamais arrivée, dites-le-nous et on en refait partir une.

Chaleureusement,
__
Lasclay
```

---
## Catégorie C. Questions avant-achat (5)

**Ce sont des ventes qui attendent une phrase.** Toutes vérifiées dans Shopify aujourd'hui.

### C1. Christiane Desrosiers `[79ac972b]` [FR] · **à traiter en premier**
Elle a vu une annonce de t-shirts brodés à 35,95 $ et demande **si c'est bien nous ou une
arnaque qui imite notre site**. Une question de confiance sans réponse est le pire des silences.
**VÉRIFIÉ : le produit existe bien**, en prévente.

```
Bonjour Christiane,

C'est bien nous, et vous avez eu le bon réflexe de vérifier.

Le t-shirt unisexe en coton brodé, avec le monarque et l'asclépiade, est un vrai produit Lasclay, actuellement en prévente : lasclay.com/products/t-shirt-coton-brode-monarque-asclepiade

La règle simple pour la suite : tout ce qui est authentiquement à nous passe par lasclay.com. Si une annonce mène ailleurs, ce n'est pas nous.

Merci d'avoir posé la question plutôt que de laisser passer.

Chaleureusement,
__
Lasclay
```

### C2. Marjolaine Tellier `[35abb22d]` [FR] · **bonne nouvelle qu'elle n'attend pas**
Elle écrit : « Concernant votre courriel du 16 juillet au sujet de votre bague 6,5, j'imagine
qu'elle n'est plus disponible… »
**VÉRIFIÉ : il en reste exactement une, en taille 6,5, à 109,99 $, en vente finale.**

```
Bonjour Marjolaine,

Bonne nouvelle : il en reste une, exactement dans votre taille.

La bague Aile de monarque en 6,5 est toujours disponible, à 109,99 $. C'est la dernière, et elle est en vente finale, donc sans retour possible. On préfère le dire d'avance.

Si vous la voulez, faites-nous signe et on vous la met de côté le temps que vous passiez la commande.

Merci pour vos bons mots sur nos décisions récentes, ça compte plus que vous ne le pensez.

Chaleureusement,
__
Lasclay
```
**APRÈS.** Mettre la bague de côté dès qu'elle confirme. Une seule unité, premier arrivé.

### C3. Élisabeth Vallet `[e4b3c989]` [FR] · **on lui a donné une information fausse**
Le 16 juillet, on lui a écrit que la variante « 9 femme, 7 homme » ressortait comme disponible et
que son affichage tardait peut-être à se rafraîchir. Elle a répondu : « Oui elle apparaît toujours
indisponible pour moi. »
**VÉRIFIÉ : la variante est en rupture franche, à moins 32.** Ce n'était pas son navigateur.

```
Bonjour Élisabeth,

Vous aviez raison et nous avions tort. La variante 9 femme, 7 homme est bel et bien en rupture, et elle l'était déjà quand on vous a écrit le contraire. Ce n'était pas votre navigateur.

On n'a pas de date de retour à vous donner pour cette pointure précise, et on ne va pas en inventer une.

Ce qu'on peut faire : vous écrire dès qu'elle rentre, avant la remise en ligne, pour que vous ne la manquiez pas.

Est-ce que ça vous convient ?

Chaleureusement,
__
Lasclay
```
**APRÈS.** L'inscrire sur une liste de rappel pour cette pointure.
**À SIGNALER.** La vente reste autorisée sur une variante à moins 32, ce qui produit exactement
ce genre de malentendu.

### C4. Pierre `[66a63016]` [FR] · manteau de ville, taille
Il cherche un manteau de tous les jours, se dit grand, et demande si notre suggestion est de
taille régulière ou entre Tall et Régulière.
**VÉRIFIÉ : il n'existe aucune gamme Tall au catalogue.**

```
Bonjour Pierre,

Réponse directe : nos manteaux existent en une seule longueur, il n'y a pas de gamme Tall. Autant vous le dire tout de suite plutôt que de vous laisser chercher.

Concrètement, pour quelqu'un de grand, ça veut dire que la coupe risque d'être un peu courte au niveau du dos et des manches si vous prenez votre taille habituelle.

Deux choses avant que vous décidiez :

Le guide des tailles donne les mesures réelles, dos et manches inclus : lasclay.com/pages/sizing-chart-guide-tailles

Et si vous nous donnez votre taille en centimètres et votre tour de poitrine, on vous dit franchement si ça vaut la peine ou non. On préfère vous dissuader que vous voir retourner un manteau.

Chaleureusement,
__
Lasclay
```

### C5. Pierrette Renaud `[e9b591df]` [FR] · **ce n'est pas une question client**
Elle signale une culture importante d'asclépiade à Trois-Pistoles, la **Coop Monark**, dirigée par
**Marie-Noël Breton**, qui aurait des problèmes de mise en marché et apprécierait un contact.

**C'est une piste d'approvisionnement au Québec, donc dans notre politique.** Le bloc remercie et
ouvre la porte, la décision de contacter la coop revient à un humain.

```
Bonjour Pierrette,

Merci beaucoup, c'est exactement le genre d'information qui nous est utile et qu'on n'aurait jamais trouvée seuls.

Une culture d'asclépiade au Bas-Saint-Laurent qui cherche des débouchés, ça nous intéresse directement : on s'approvisionne au Québec et en Ontario, et la fibre est notre matière première.

Si vous avez une façon de nous mettre en contact avec Marie-Noël Breton, faites-le sans hésiter, ou donnez-nous simplement l'information et on la contactera nous-mêmes.

Chaleureusement,
__
Lasclay
```
**APRÈS. Escalade prioritaire à la direction.**

---

## Catégorie D. Approvisionnement et production (8)

**Politique connue : Québec ou Ontario, peut-être. Ailleurs, non.**
Six de ces huit sont des **fils Messenger** sans adresse courriel : ils sont listés ici parce
qu'ils occupent la boîte Support, mais **ils se traitent dans Business Suite** et sont déjà dans
`SOCIAL-20260824.md`. Ne les cherche pas dans Missive.

| Fil | Qui | Canal | État |
| --- | --- | --- | --- |
| `[5eef512f]` | Sol Veil, fermière | Messenger | Dans `SOCIAL-20260824.md` |
| `[88f3058f]` | Josef Schwabl | Messenger | Idem. **Prix de 2022 à ne pas reconduire.** |
| `[25e6e274]` | Marc-André Marchand | Messenger | Idem |
| `[f24b8b24]` | Patrick Fortier | Messenger | Idem |
| `[064ee3c8]` | Danielle Drolet | Messenger | Idem |
| `[c0c9d2d5]` | Caroline Riel, plagiat | Messenger | Idem |
| `[e596a15b]` | Stephanie Bengson | **courriel** | **Déjà répondu** le 20 août : achat au Québec et en Ontario seulement. Rien à faire. |
| `[5d9502e3]` | Ginette Gagnon | **courriel** | **Déjà répondu** le 20 août sur ses follicules. Rien à faire. |

### D1. Vincent Castonguay `[0c5a4a6d]` [FR] · **il demande un appel de 5 minutes**
Propriétaire d'un terrain, toujours intéressé, mais il loue ses champs à un cultivateur du coin et
le bail n'est pas réglé. Il veut en parler de vive voix.

```
Bonjour Vincent,

Avec plaisir pour l'appel, et votre enjeu de bail est justement le genre de chose qui se règle mieux en parlant qu'en écrivant.

Donnez-nous vos disponibilités et un numéro où vous joindre, et on vous appelle.

Si c'est plus simple pour vous, notre ligne est le 581-982-5857.

Chaleureusement,
__
Lasclay
```
**APRÈS.** Escalade : l'appel doit être fait par un humain qui peut décider.

---

## Catégorie E. Partenariats et projets (4)

### E1. Mathilde Ouellet `[04a872bc]` [FR] · **elle a donné son numéro et ses disponibilités**
Projet de monarques. Elle écrit : « Je suis disponible lundi au mercredi prochain en pm à l'heure
qui vous convient. Mon numéro de téléphone est le (514) 886-3468. » **13 jours.**

Elle a fait tout ce qu'on lui demandait. **Un appel, pas un courriel.**
**ESCALADE : ne pas envoyer de message, appeler.**

### E2. PlaneteSOS `[c6750a8e]` [FR] · visite d'atelier
Chantal écrit : « Nous sommes toujours intéressés par l'appareil de fabrication de balles de
semences. Quand pourrions-nous aller la voir fonctionner ? »

```
Bonjour Chantal,

Avec plaisir, et merci de votre patience.

Dites-nous quelles dates vous conviendraient et combien vous seriez, et on organise la visite à l'atelier. On est du lundi au vendredi, entre 8 h et 16 h.

Chaleureusement,
__
Lasclay
```
**APRÈS.** Confirmer la disponibilité de l'atelier avant de fixer une date.

### E3. Martin Gauthier `[ef048a62]` [FR] · **date passée**
Fil de 18 messages sur des boules de semences. Notre dernier mot, le 16 juillet : « Ok, on remet
donc au 27 juillet. On va s'assurer que ça fonctionne et en mettre plus dans le prochain paquet. »
**Le 27 juillet est passé depuis un mois.**

**Vérifié dans ShipStation : l'envoi du 27 juillet n'a jamais eu lieu.** Sa dernière expédition
remonte à septembre 2025.

```
Bonjour Martin,

On revient là-dessus, et on aurait dû le faire plus tôt.

[Un humain complète : ce qui est parti le 27 juillet, ou ce qui ne l'est pas.]

Chaleureusement,
__
Lasclay
```

### E4. Mélanie G `[bcc5fb1d]` [FR] · testeuse plein air
Elle s'est proposée comme testeuse, précise être très souvent dehors, s'intéresse aux vêtements et
accessoires, et **évite les produits cosmétiques à cause de défis de peau**. Ce dernier point est
important : ne pas lui proposer l'huile ni la crème.

```
Bonjour Mélanie,

Merci, et c'est noté pour les cosmétiques : on ne vous enverra rien de ce côté.

Vêtements et accessoires, c'est justement là qu'on a le plus besoin de retours de terrain. Les mitaines et les semelles en particulier, parce qu'elles se jugent au bout de plusieurs heures dehors et pas en magasin.

Deux choses pour qu'on vous envoie ce qui convient : votre taille de mitaines et votre pointure. Le guide des tailles est ici si ça aide : lasclay.com/pages/sizing-chart-guide-tailles

On vous dira ce qu'on cherche à observer précisément avant de vous envoyer quoi que ce soit.

Chaleureusement,
__
Lasclay
```
**APRÈS.** Préparer l'envoi de test dès sa réponse. Dossier R&D.

---
## Catégorie F. Réputation et avis (3)

### F1. Lucie Champoux `[b19e7a51]` [FR] · **elle croit avoir gagné un concours**
Elle a participé au concours de fin de saison, croit avoir gagné une veste, et n'a jamais eu de
suivi. « Est-ce que le courriel s'est égaré entre Lachute et Québec ? » Elle donne son numéro,
450-712-3080. **155 jours.**

**AVANT L'ENVOI : vérifier la liste des gagnants du concours.** C'est la seule vérification de ce
document que je n'ai pas pu faire : la liste n'existe ni dans Shopify ni dans ShipStation. Un bloc
qui laisserait entendre
qu'elle a gagné alors que non serait pire que le silence. Deux cas.

**Si elle a gagné :**
```
Bonjour Lucie,

Vous avez bien gagné, et personne ne vous l'a confirmé. C'est notre erreur, et elle a duré bien trop longtemps.

[Un humain complète : la veste, la taille à confirmer, l'expédition.]

Chaleureusement,
__
Lasclay
```

**Si elle n'a pas gagné :**
```
Bonjour Lucie,

Merci d'avoir relancé, et désolé du silence : votre message méritait une réponse, gagnante ou pas.

Après vérification, la veste est allée à une autre participante. On aurait dû vous le dire au moment du tirage plutôt que de vous laisser sans nouvelles.

Merci d'avoir participé, et merci surtout d'avoir pris le temps de nous écrire.

Chaleureusement,
__
Lasclay
```

### F2. Gino Poitras `[7cdcdfe8]` · **Messenger, pas courriel**
L'allégation « mitaines à moins 40 degrés » qu'il nous conseille de retirer. **Déjà traité dans
`SOCIAL-20260824.md`, section A25.** Ne pas le chercher dans Missive.

### F3. Martine Savard `[ba5d405c]` · **Messenger, en attente d'elle**
On lui a expliqué comment modifier son avis. La balle est dans son camp. Rien à envoyer.
Six jours seulement : laisser mûrir.

---

## Catégorie G. Divers (4)

### G1. Anne-Marie `[7a4299c4]` [FR] · **deuxième relance sans réponse**
On lui avait offert du matériel d'isolation. Elle a confirmé en février, puis relancé : « Je me
permets de vous relancer. Est-ce que ce serait toujours possible d'avoir ce matériel
d'isolation ? » **149 jours.** C'est une promesse en suspens.

```
Bonjour Anne-Marie,

Oui, c'est toujours possible, et vous n'auriez pas dû avoir à relancer deux fois.

Pour qu'on vous l'envoie sans autre délai : confirmez-nous votre adresse et la quantité qui vous serait utile.

L'isolant se vend au mètre et au demi-mètre, ce qui vous donne une idée des formats : lasclay.com/products/isolant-asclepiade-vegan-naturel

Chaleureusement,
__
Lasclay
```
**Vérifié dans ShipStation : aucune commande à son nom. Le matériel n'est jamais parti.**
**APRÈS.** Préparer l'envoi dès sa réponse.

### G2. Bill Small `[98405a91]` [EN] · correction de code postal
Il corrige son adresse : **208 Dorset Ave, Oswego, IL 60543**, et non 60538.

```
Hello Bill,

Got it, thank you for the correction: 208 Dorset Ave, Oswego, IL 60543.

The address is updated on our side.

Warmly,
__
Lasclay
```
**AVANT L'ENVOI : corriger réellement l'adresse dans Shopify.** Sans quoi le bloc affirme quelque
chose de faux, et c'est exactement l'erreur du dossier Jean-Guy Guérard en A5, où la correction
demandée n'a jamais été faite.

### G3. Raymond Rouillard `[2573d775]` [FR] · rafale de questions
Client fidèle depuis la pandémie. Il envoie une salve : boutique physique, contrats avec l'armée
canadienne, partenariat financier à 49 %, pays d'exportation, robots IA contre coûts de la
Tunisie. **On répond aux deux questions concrètes et on laisse le reste.**

```
Bonjour Raymond,

Merci pour vos encouragements, ça fait plaisir à lire.

Deux réponses claires sur vos questions.

Pour la boutique : nos produits se trouvent chez nos détaillants partenaires et sur lasclay.com. Notre atelier de Québec n'est pas un magasin, mais il est possible d'y passer sur rendez-vous.

Pour l'exportation : on livre au Canada et aux États-Unis. C'est tout pour l'instant.

Le reste de vos questions touche des décisions d'entreprise sur lesquelles on ne s'avance pas publiquement, mais l'intérêt est noté.

Chaleureusement,
__
Lasclay
```
**À VÉRIFIER AVANT ENVOI :** la mention « sur rendez-vous » pour l'atelier. Si c'est faux, retirer
la phrase plutôt que de la corriger.

### G4. Lynne Lalonde `[73f06bc6]` · **Messenger**
La quenouille et l'isolant de Ponda. **Déjà traité dans `SOCIAL-20260824.md`, section A6.**

---

## Récapitulatif

| Catégorie | Fils | Blocs prêts | Geste humain requis |
| --- | --- | --- | --- |
| A. Livraisons en souffrance | 7 | 4 | **5** |
| B. Envois annoncés, **non tenus, vérifié** | 4 | 4 | 4 |
| C. Questions avant-achat | 5 | 5 | 2 |
| D. Approvisionnement | 8 | 1 | 1, plus 6 fils Messenger hors périmètre |
| E. Partenariats | 4 | 3 | 3, dont un **appel téléphonique** |
| F. Réputation | 3 | 2 variantes | 1 vérification préalable |
| G. Divers | 4 | 3 | 2 |
| **Total** | **36** | **22 blocs** | |

### Ordre de passage suggéré

1. **Christiane Desrosiers** en tout premier : elle se demande si on est une arnaque.
2. **Marjolaine Tellier** : une seule bague, premier arrivé.
3. **Élisabeth Vallet** : on lui a donné une information fausse, la correction ne peut pas attendre.
4. Les quatre relances de livraison : Marie-Pierre Verret, Jean-Guy Guérard, Diane Pagé, Gaétan.
5. Le reste dans l'ordre du document.

### Gestes humains, à ne pas confier à Cowork

| Dossier | Geste |
| --- | --- |
| **L-50159, 402,41 $** | Payée le 30 mai, **jamais expédiée, aucun fil ne la réclame.** Personne ne la voit. |
| Sylvia McVicar L-50688 | Expédier ou rembourser, puis compléter le bloc |
| Francis Gagnon L-50705 | Expédier ou rembourser, 254,49 $ |
| Susan Arata L-39454 | Renvoi ou remboursement de 98,30 $. **Ne pas écrire avant.** |
| Mathilde Ouellet | **Appeler au (514) 886-3468**, lundi à mercredi en après-midi |
| Vincent Castonguay | Appel sur son projet de terrain |
| Marjolaine Tellier | Mettre la bague 6,5 de côté |
| Élisabeth Vallet | Liste de rappel pour les semelles 9 femme / 7 homme |
| Bill Small | Corriger l'adresse dans la commande **avant** d'envoyer le bloc |
| Gaétan | Vérifier que les mitaines XL sont encore en réserve |
| Anne-Marie | Préparer l'envoi du matériel d'isolation |
| Lucie Champoux | Vérifier la liste des gagnants du concours |
| Martin Gauthier | Vérifier si l'envoi du 27 juillet a eu lieu |
| B1 à B4 | Vérification ShipStation **déjà faite** : aucun des quatre envois n'a eu lieu. Créer les commandes. |
| L-50688, L-50705, L-50159 | **Les trois sont dans ShipStation au statut `awaiting_shipment`.** Il suffit de les traiter. |

### Ce qu'on veut dans ton rapport

1. Les envois réussis.
2. Tout fil où la vérification ShipStation a révélé un renvoi déjà fait : dis-le, et **n'envoie
   pas** le bloc.
3. Tout écart entre la citation d'une entrée et le dernier message réel du fil.
4. Toute réponse revenue pendant l'exécution, surtout celles qui contiennent un numéro de
   commande ou une adresse.

---

## Annexe. Ce que cette boîte révèle

1. **Trois commandes payées n'ont jamais été expédiées**, pour **706,32 $**, dont une que personne
   ne réclame et que personne ne voit.
2. **La vente reste autorisée sur des variantes en rupture profonde.** Les semelles 9 femme /
   7 homme sont à moins 32, et c'est ce qui a fait dire à une cliente que son navigateur affichait
   mal. On lui a donné tort alors qu'elle avait raison.
3. **Deux commandes ont été marquées expédiées sans numéro de suivi**, ce qui rend toute
   réclamation impossible à arbitrer, pour nous comme pour le client.
4. **Un client a dû laisser un avis négatif pour obtenir une réponse**, et il nous l'a écrit.
5. **Une cliente se demande si nos propres annonces sont une arnaque.** Le produit est réel. La
   question dit quelque chose sur la lisibilité de notre présence en ligne.
6. **Six fils Messenger occupent la boîte Support** sans pouvoir y être répondus, faute d'adresse
   courriel. Ils viennent des deux pages Facebook découvertes hier et alimenteront la boîte tant
   que le routage ne sera pas corrigé.
