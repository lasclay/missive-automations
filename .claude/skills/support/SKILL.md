---
name: support
description: Répondre à un client dans la boîte support Lasclay — méthode de vérification obligatoire avant tout envoi, règles de décision internes (période de retour, mensurations, rétention, remboursement), et garde-fous appris d'erreurs réelles. Couvre le montage du dossier avec dossier.js, le croisement Shopify + ShipStation, les envois par timbre qui n'ont aucun numéro de suivi, la détection des fils en doublon, et la rédaction dans la voix de la marque.
when_to_use: Déclenche AVANT d'écrire ou d'envoyer une réponse à un client Lasclay, avant de fermer un fil, avant de promettre un envoi, un remboursement, un échange ou une étiquette de retour. Déclenche aussi sur « réponds à ce client », « traite la boîte support », « vide l'arriéré », « est-ce qu'on peut fermer ce fil », « envoie le brouillon », « le client n'a pas de numéro de suivi », « où est son colis ». Complète le skill `missive` (accès au proxy), `proxygen` (ShipStation) et `shopify` (poids et tarifs) : ceux-là donnent les commandes, celui-ci donne la méthode.
argument-hint: [id du fil, ou ce que tu veux traiter dans la boîte]
allowed-tools:
  - Bash(node dossier.js:*)
  - Bash(node missive_client.js:*)
  - Bash(node connectors_client.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# Répondre à un client Lasclay

Un courriel envoyé ne se rappelle pas. Ce skill existe parce qu'une session a envoyé
40 réponses dont **aucune** n'avait été vérifiée correctement : trois clients ont reçu
de l'information fausse, et une cliente dont le dossier était réglé depuis trois semaines
a reçu deux messages à côté de la plaque.

## La règle qui prime sur tout

**Ne réponds jamais à un client sans avoir monté le dossier au complet.**

```bash
node dossier.js <convId>
```

Une seule commande, quatre sources. Lis-en la sortie en entier avant d'écrire un mot.

## Les quatre sources, et ce que chacune rate seule

| Source | Ce qu'elle donne | Ce qu'elle ne dit PAS |
| --- | --- | --- |
| **Le fil au complet** | l'historique, les engagements déjà pris | rien de ce qui s'est dit ailleurs |
| **Les autres fils du client** | le dossier peut être réglé ailleurs, plus récemment | — |
| **Shopify** | contenu réel de la commande, lignes retirées, remboursements, adresse au dossier | si le colis est parti |
| **ShipStation** | expéditions, suivis, étiquettes de retour, commandes manuelles | pourquoi une ligne est à quantité 0 ; **rien sur un envoi par timbre**, qui n'a pas d'étiquette |

Trois pièges, chacun payé par une erreur réelle :

- **Le fil est paginé.** L'API Missive plafonne à 10 messages par appel. `dossier.js` pagine
  et affiche `⚠️ TRONQUÉ` s'il en reste. Un fil de 25 messages lu aux 10 derniers, c'est
  répondre sans avoir vu le début du dossier.
- **Le client peut avoir deux adresses.** Le recoupement par courriel exact ne suffit pas.
  Les trois empreintes de `merge.js` — adresse, **nom**, **numéro de commande** — sont
  requises. Le seul doublon réel trouvé sur 806 fils reliait `…bef@icloud.com` à
  `…bed@hotmail.com` : uniquement le numéro de commande les rattachait.
- **Un renvoi n'a pas le numéro de commande d'origine.** Une garantie, un échange, une
  commande téléphone deviennent une commande **manuelle** dans ShipStation. Chercher par
  numéro `L-` seul les rend invisibles ; il faut chercher par **nom du client**. De même,
  un envoi sans étiquette ShipStation n'apparaît que dans `fulfillments`, jamais dans
  `shipments`.

Requête Shopify (le connecteur MCP, `dossier.js` te donne la chaîne toute faite) :

```graphql
orders(first: 10, query: "name:L-50429 OR email:client@exemple.com") {
  displayFinancialStatus  displayFulfillmentStatus
  lineItems { name quantity currentQuantity }   # currentQuantity 0 = ligne retirée
  refunds { createdAt totalRefundedSet { shopMoney { amount } } }
  fulfillments { createdAt trackingInfo { number company } }
  shippingAddress { address1 city zip }
}
```

`currentQuantity: 0` avec un remboursement daté, c'est une ligne annulée et traitée —
pas un oubli. Ne devine jamais la raison d'un zéro : Shopify la donne.

## Envoi par timbre — l'absence de suivi est normale

Le suivi de livraison est la catégorie la plus volumineuse de la boîte, et c'est ici qu'on
invente un numéro qui n'existera jamais. Une part des commandes part par **timbre** :
enveloppe Postes Canada à 2,99 $, **sans aucun suivi**. Ce n'est pas un incident, c'est le
tarif que le client a choisi à la caisse.

### Repérer une commande partie par timbre

```graphql
shippingLines(first: 2) { edges { node { title originalPriceSet { shopMoney { amount } } } } }
totalWeight                                  # en grammes, FIGÉ à la caisse
fulfillments(first: 3) { trackingInfo { number company } }
```

- Tarif actuel : `title` = **« Stamp / timbre (0 tracking) »**, 2,99 $.
- **Le titre ment sur les vieilles commandes.** Shopify fige le nom du tarif tel qu'il était
  à la caisse. Des commandes légères portent « Standard » à **2,99 $** (l'ancien nom du
  timbre) ou à **1,37–1,38 $** (ancien tarif des semences). Un « Standard » à 2,99 $ n'est
  pas le Standard d'aujourd'hui, qui est à 6,99 $. **Fie-toi au prix et au poids, pas au
  titre.**
- `totalWeight ≤ 73` g : le panier était éligible au timbre. Au-delà, il est parti en colis.
- **`totalWeight` est figé à la caisse.** Si un poids de produit a été corrigé depuis, la
  vieille commande garde le sien. **Ne recalcule jamais une commande passée avec les poids
  d'aujourd'hui** — tu conclurais à un colis là où le client a payé un timbre.

### Ce que ça implique, et qu'on oublie

- **Il n'y a pas de numéro de suivi. Jamais. Pas « pas encore ».** Le timbre n'en produit
  aucun, c'est écrit dans le nom du tarif.
- Dans Shopify, une commande **`FULFILLED` avec `trackingInfo: []` est normale** : elle est
  partie par timbre. Ce n'est ni un oubli de saisie, ni un colis perdu.
- Dans ShipStation, il n'y a **souvent aucune expédition** : aucune étiquette n'a été
  achetée. C'est le piège des commandes manuelles, en pire — `shipments` vide ne veut pas
  dire « pas expédié ».
- Délai : **5 à 12 jours ouvrables**. C'est le seul délai chiffré autorisé d'office.

### Interdits

- Promettre de « retrouver » ou d'« envoyer » le numéro de suivi.
- Écrire « le suivi devrait apparaître sous peu ».
- Conclure d'un `shipments` vide, ou d'un `trackingInfo` vide, que la commande n'est pas
  partie.
- Traiter le dossier en **colis perdu avant les 12 jours ouvrables**.

### Ce qu'on dit

Que l'envoi est parti par enveloppe timbrée — l'option à 2,99 $ choisie à la commande —
qu'elle voyage sans suivi, et qu'il faut compter 5 à 12 jours ouvrables. On le dit
platement, sans s'excuser : c'est le tarif que le client a retenu, pas une défaillance.

Passé le délai sans livraison, un renvoi ou un remboursement est un **mouvement de
marchandise ou d'argent** : règle générale du skill, ça exige un humain avant l'envoi.
Laisse le brouillon, pose la note, ne promets rien.

## Avant d'écrire — la liste

1. `node dossier.js <convId>` et lecture intégrale de la sortie.
2. Le fil est-il marqué `TRONQUÉ` ? Si oui, relis plus profond.
3. Y a-t-il un autre fil **répondu plus récemment** ? Si oui, **n'écris pas ici** : la
   conversation vit ailleurs. Signale la fusion.
4. Les faits que je m'apprête à affirmer viennent-ils de Shopify **et** de ShipStation ?
   S'il est question de suivi : la commande est-elle partie **par timbre** ? Vérifie
   `shippingLines` et `totalWeight` avant d'annoncer, ou de chercher, un numéro.
5. Les **notes internes** disent-elles autre chose que le brouillon ?
   `node missive_client.js notes <convId>`. Une note de l'équipe prime toujours sur un
   brouillon IA — le brouillon ne les lit pas.
6. Est-ce que je promets un geste que personne ne fera ? Voir plus bas.

## Ce qu'il ne faut jamais promettre soi-même

Un message qui annonce une action non faite ne règle rien : il renouvelle la promesse
qui a mis le dossier en retard. Ces gestes exigent un humain **avant** l'envoi :

- **une étiquette de retour prépayée** — l'achat débite le wallet ShipStation ;
- **un remboursement** — mouvement d'argent ;
- **un envoi** dont aucune commande correspondante n'existe dans ShipStation ;
- **des photos, une mesure, une vérification atelier**.

Dans ces cas : laisse le brouillon, pose une note interne disant précisément quoi faire,
et dis-le à l'humain. Ne ferme pas le fil.

**Les étiquettes de retour ne se génèrent pas automatiquement.** C'est le piège le plus
facile à tomber, parce que les réponses types renvoient vers le portail : diriger un client
vers `lasclay.happyreturns.com` en lui disant qu'il « obtiendra une étiquette prépayée » ne
produit rien. Il suit la marche à suivre et se heurte à un mur — ce qui, sur un retour déjà
en retard, coûte plus cher que le silence.

Chaque étiquette se crée **à la main dans ShipStation**, puis s'envoie par courriel. Donc :
n'annonce jamais une étiquette qui n'existe pas encore. Mets le fil dans la to-do
« étiquettes de retour », laisse le brouillon, et signale-le. Rappel de la règle 6 : sur un
défaut de fabrication, les frais sont à notre charge et les 9,99 $ facturés d'office par
Happy Returns doivent être **remboursés manuellement**.

**Ne donne jamais une date que tu n'as pas.** « Aujourd'hui », « dans les prochaines
heures », « dès que possible » sur un dossier déjà en retard sont des fautes. Une date
ferme, ou l'aveu qu'on ne l'a pas encore.

## Temporalité — la source d'erreur la plus coûteuse

Les fils de l'arriéré ont des mois. `support.js` (v2.24 et v2.29) encode tout un régime
là-dessus, et c'est ce qui se viole le plus facilement.

**Raisonne toujours à partir d'aujourd'hui, jamais de la date du message.** Convertis les
dates en temps écoulé avant de décider quoi que ce soit.

| Âge du dernier message client | Ce qu'on fait |
| --- | --- |
| ≤ 3 jours | aucune excuse, ou très légère |
| 4 à 10 jours | excuse simple, jamais en ouverture, + admission qu'on aurait dû faire mieux |
| > 10 jours, **ou** 2 messages sans réponse | excuse appuyée : « inacceptable », « pas dans nos habitudes » |
| ≥ 1 mois | excuse maximale : une explication **concrète** (main-d'œuvre, période intense) |
| > ~3 semaines | **ne promets plus rien d'actif** — le dossier est presque sûrement déjà traité |

Les interdits, tous appris d'erreurs réelles :

- **Ne chiffre jamais l'ancienneté au client.** « votre commande de janvier », « depuis
  novembre », « ta question du 24 février », « ce dossier traîne depuis 2020 » : ça
  souligne notre lenteur. L'âge sert au **ton** et à la **décision**, il ne s'énonce pas.
- **Sur un fil vieux, ne promets aucune action** (« j'expédie », « j'ajoute à ta
  commande », « je t'envoie le lien »). Vérifie l'état réel, puis **demande si c'est
  encore d'actualité**. Une note de Gabriel le dit mot pour mot : « problème de
  temporalité. Sa demande date du 27 janvier. Faut lui demander si sa demande a été
  traitée en fait! »
- **Commande expédiée ou livrée = reçue.** Interdiction absolue de dire « on prépare » sur
  une commande déjà partie. On confirme l'envoi, ou on ferme si le fil est vieux et sans
  question.
- **Excuse jamais nue.** « Désolé du délai » seul est banni : robotique et vide. Toute
  excuse porte un **pourquoi** concret ou un cadrage « ce n'est pas dans nos habitudes ».
- **Un seul marqueur d'excuse, deux au maximum.** On ne s'auto-flagelle pas. Bannis :
  « tu méritais mieux », « pas à la hauteur », « ça ne me ressemble pas », « c'est
  gênant », et l'empilement « inacceptable + pas dans nos habitudes ». Après l'excuse, on
  regarde devant.
- **Jamais deux fois la même excuse au même client.** Idem pour la vidéo du pivot
  (`youtube.com/watch?v=GKyHh-Ok9JU`), qui ne se sert qu'une fois.
- **Aucun souhait daté ou saisonnier décalé.** Pas de « joyeuses Fêtes » en janvier, pas de
  « bonne plantation » à quelqu'un qui a semé il y a un mois. Le souhait colle à
  aujourd'hui ou disparaît.
- **Aucun délai chiffré non sourcé.** « dans les prochaines heures », « d'ici la fin de la
  journée », « dans les prochains jours » sont des dates inventées. Le seul délai chiffré
  autorisé d'office : 5 à 12 jours ouvrables pour un envoi par timbre.

**Un vieux fil sans question — un remerciement, un dossier résolu — se FERME avec une note
interne, sans écrire au client.** Écrire pour écrire rouvre un dossier clos.

**Mais un avis positif n'est pas un simple remerciement : il s'étiquette avant de se fermer.**
Quand un client dit qu'il est satisfait de son produit — « je suis très satisfaite »,
« quelle belle entreprise », un avis Judge.me — pose l'étiquette
`Support/review à traiter` (`1681e586-9a75-49a6-bf90-75a2620d20a5`). C'est de la matière à
témoignage, et fermer sans étiqueter la perd définitivement. Distingue-la de l'encouragement
sur l'entreprise (« bravo, lâchez pas »), qui se ferme sans étiquette. **Sur un fil déjà
fermé, `labels` exige `keepClosed: true`**, sinon l'étiquetage le rouvre.

Deux effets de bord saisonniers à connaître :

- **Semences.** L'automne est le bon moment pour semer l'asclépiade : l'hiver lève la
  dormance. Un envoi tardif n'est pas un pis-aller, c'est la bonne fenêtre — et ça se dit.
  Des graines mal conservées qui ont germé donnent droit à un renvoi gratuit **programmé à
  la bonne période**, pas expédié n'importe quand.
- **Contrainte de date du client.** Un cadeau de Noël, un départ en voyage, une expédition
  qui part : ces cas passent en priorité. Un fil documenté a coûté l'usage prévu —
  « pour les cache-cou que je devais donner en cadeau c'est foutu. Noël est passé ».

Rappel : une **contestation PayPal** non répondue en 10 jours devient un remboursement
automatique et irréversible.

## Règles de décision internes

Elles viennent de `connaissance_support.md` (section 3), formulées par Gabriel. Les plus
faciles à enfreindre :

- **Mensurations avant tout échange de taille, sans exception** — même si le client dit
  connaître sa taille. Elles décident qui paie les 9,99 $. Gabaris dans la section
  « Tailles et échanges ».
- **La période de retour court à la date du message du client**, jamais à celle de notre
  réponse. Un délai interne ne pénalise jamais le client.
- **Une seule tentative de rétention** avant d'accepter un retour, appuyée sur une
  information produit réelle. Si le client réitère, on accepte sans friction.
- **Ne pas accepter un remboursement trop vite** sans offrir d'alternative concrète
  d'abord. Mais si la frustration persiste sans demande claire, proposer le remboursement
  calmement fait souvent garder le produit.
- **Défaut de fabrication → frais de retour à notre charge**, et les 9,99 $ facturés
  automatiquement par Happy Returns doivent être remboursés **à la main**.
- **Annoncer l'issue favorable en tête de message**, l'explication ensuite.
- **Erreur de panier ou d'adresse : la responsabilité est au client** par défaut — mais
  jamais affirmée sans vérification, et jamais avant d'avoir annoncé la solution.
- **Une contestation PayPal non répondue en 10 jours est un remboursement automatique**,
  irréversible. 320,72 $ perdus ainsi une fois.

Lis la section au complet avant un dossier délicat :
`grep -n '^####' connaissance_support.md`

## Rédiger

Charge **`lasclay-master`** pour la voix de marque, et lis le ton dans
`connaissance_support.md` section 1. Les 224 réponses types sont classées par thème —
`grep -n '^###' connaissance_support.md` donne la carte.

**Réponds toujours dans la langue du client.** La notice de transparence IA est ajoutée à
tout message préparé par le système, en français comme en anglais — sauf si le client a
explicitement refusé d'échanger avec une IA, auquel cas le dossier passe à un humain.

## Envoyer, puis nettoyer

```bash
node missive_client.js reply <convId>    # 🔴 JSON {from,to[],subject,body,send:true} sur stdin
node missive_client.js note <convId> "…" # note interne
node missive_client.js labels <convId>   # JSON {remove:["<labelId>"],keepClosed:true si fermé}
node missive_client.js close <convId> "…"
```

Trois pièges de fin de course :

- **`close` ne retire aucune étiquette.** Un fil répondu garde « Draft AI Support »
  (`019eb935-9b22-7d14-8aeb-614a1e303e24`) jusqu'à retrait explicite via `labels`. Sinon la
  boîte annonce du travail déjà fait.
- **Sur un fil déjà fermé, `labels` sans `keepClosed:true` le rouvre.**
- **Le brouillon IA périmé reste en place** après ton envoi — aucune route ne le supprime.
  Pose une note ⚠️ pour que personne ne l'envoie en double.

**Ne ferme pas** un fil qui porte un engagement futur (envoi à venir, réponse attendue du
client). Ferme seulement quand plus rien n'est dû de part et d'autre.

## Limites connues du proxy

- Les fils **fermés de LAS Support** font tomber `/list` en 502 (volume). L'index des
  autres fils a donc un angle mort de ce côté ; à paginer par tranches de dates si le
  dossier l'exige.
- Les conversations **hors courriel** (Messenger, Instagram, SMS) n'ont pas d'adresse :
  `reply` ne crée que des courriels et ne peut pas y répondre. Signale-le, n'improvise pas.

## Contexte

**Les Produits Lasclay Inc**, Québec — produits isolés à la soie d'asclépiade. Vente sur
lasclay.com en français et en anglais, Canada et États-Unis. Le suivi de livraison est la
catégorie la plus volumineuse de la boîte, donc celle où l'erreur coûte le plus cher.

Pour la mécanique des tarifs et des poids derrière un envoi par timbre — pourquoi un panier
de 73 g ou moins déclenche le 2,99 $ sans suivi — voir le skill `shopify`.
