---
name: support
description: Répondre à un client dans la boîte support Lasclay — méthode de vérification obligatoire avant tout envoi, règles de décision internes (période de retour, mensurations, rétention, remboursement), et garde-fous appris d'erreurs réelles. Couvre le montage du dossier avec dossier.js, le croisement Shopify + ShipStation, la détection des fils en doublon, et la rédaction dans la voix de la marque.
when_to_use: Déclenche AVANT d'écrire ou d'envoyer une réponse à un client Lasclay, avant de fermer un fil, avant de promettre un envoi, un remboursement, un échange ou une étiquette de retour. Déclenche aussi sur « réponds à ce client », « traite la boîte support », « vide l'arriéré », « est-ce qu'on peut fermer ce fil », « envoie le brouillon ». Complète le skill `missive` (accès au proxy) et `proxygen` (ShipStation) : ceux-là donnent les commandes, celui-ci donne la méthode.
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
| **ShipStation** | expéditions, suivis, étiquettes de retour, commandes manuelles | pourquoi une ligne est à quantité 0 |

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

## Avant d'écrire — la liste

1. `node dossier.js <convId>` et lecture intégrale de la sortie.
2. Le fil est-il marqué `TRONQUÉ` ? Si oui, relis plus profond.
3. Y a-t-il un autre fil **répondu plus récemment** ? Si oui, **n'écris pas ici** : la
   conversation vit ailleurs. Signale la fusion.
4. Les faits que je m'apprête à affirmer viennent-ils de Shopify **et** de ShipStation ?
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

**Ne donne jamais une date que tu n'as pas.** « Aujourd'hui », « dans les prochaines
heures », « dès que possible » sur un dossier déjà en retard sont des fautes. Une date
ferme, ou l'aveu qu'on ne l'a pas encore.

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
