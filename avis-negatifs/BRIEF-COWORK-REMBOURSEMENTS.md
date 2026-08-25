# Brief Cowork — remboursements et cartes-cadeaux, vague de réparation

**Date : 25 août 2026. Priorité : haute.**

⚠️ **Les 15 messages sont déjà partis**, envoyés depuis Missive le 25 août. Chacun annonce au
client, au présent, un remboursement et une carte-cadeau. Tant que les deux ne sont pas exécutés,
la vague reproduit exactement le reproche qu'elle répare : une promesse écrite qui n'aboutit pas.

Il y a deux gestes à poser, dans cet ordre : **les remboursements d'abord, les cartes ensuite.**

---

## A. Les 12 remboursements

`refundCreate` est refusé par la politique du connecteur Shopify (« Refunds must be issued manually
in Shopify admin »). Ça se fait donc **à la main dans l'admin Shopify**, commande par commande,
comme les cartes-cadeaux l'ont été.

Pour chaque ligne : ouvrir la commande, **Refund**, saisir le montant, **décocher la notification
au client** (le message est déjà parti et l'explique mieux qu'un courriel automatique), noter
`Vague de réparation des avis négatifs` en note interne.

| # | Commande | Client | Montant à rendre | Passerelle | Remarque |
| --- | --- | --- | --- | --- | --- |
| 1 | **L-39248** | Ariane Poirier | **32,39 $** | shopify_payments | ⚠️ **En premier.** Son message dit « je les rembourse **aujourd'hui** ». Solde après les 82,78 $ de janvier |
| 2 | L-45225 | Tim Sullivan | **99,70 $** | shopify_payments | Le message annonce 99,72 $, mais seulement 99,70 $ ont été encaissés. Rendre le maximum permis |
| 3 | L-41587 | Stephane Vincent | **119,55 $** | shopify_payments | Intégral |
| 4 | L-47093 | Patrick Lessnick | **112,39 $** | shopify_payments | Partiel : une paire sur quatre. Il garde les quatre |
| 5 | L-28161 | Toby Lanthier | **242,57 $** | **paypal** | Intégral. Décembre 2024 : PayPal risque de refuser, voir la règle du virement |
| 6 | L-19577 | Nathalie Durand | **125,89 $** | shopify_payments | Intégral. Janvier 2024 : hors fenêtre probable |
| 7 | L-43391 | Charlotte Bourgoing | **126,46 $** | shopify_payments | Intégral |
| 8 | **L-10486** | Guillaume Lanteigne-Voyer | **321,93 $** | shopify_payments | Octobre 2022, la plus vieille. Voir la note ci-dessous |
| 9 | L-44407 | Annie Hubert | **16,88 $** | **paypal** | Solde après les 35,99 $ du 14 janvier. Ramène la commande à zéro |
| 10 | L-28037 | Sonia Pouliot | **121,86 $** | shopify_payments | Intégral |
| 11 | L-28862 | Sonia Pouliot | **11,49 $** | shopify_payments | Les frais d'échange qu'elle a payés. **Deux commandes distinctes pour elle** |
| 12 | L-46609 | Jimmy Allaire | **24,13 $** | shopify_payments | Intégral, sans retour |

**Total : 1 355,24 $.**

### Le cas Guillaume, à lire avant de rembourser

Il a **deux** commandes de préventes 2022, L-10295 (281,69 $) et L-10486 (321,93 $), toutes deux
expédiées le 18 décembre 2022. Impossible de savoir laquelle contenait le produit mal confectionné.
Son message nomme explicitement **L-10486, 321,93 $**, et lui propose de le dire si c'était l'autre.
**Ne rembourser que L-10486.** Si Guillaume répond que c'était L-10295, rembourser celle-là aussi,
sans discuter.

### Marie-Andrée Blouin — rien à faire tout de suite

L-38222 (189,70 $) contient deux articles, une besace isotherme et un sac à dos glacière 30L. Son
message lui demande **lequel des deux** était défectueux, et promet le remboursement de cet
article-là plus un remplacement. **Attendre sa réponse**, puis rembourser la ligne correspondante.

### La règle du virement Interac

Plusieurs de ces commandes sont vieilles : Shopify Payments et PayPal refusent généralement un
remboursement passé quelques mois. **Un refus de la passerelle n'est pas un blocage**, c'est le cas
prévu. Les 12 messages contiennent tous cette phrase :

> Si le remboursement n'apparaît pas sur votre relevé d'ici quelques jours, écrivez-moi et on vous
> l'envoie par virement Interac à la place.

Donc : si l'admin refuse, **noter la commande dans la liste des virements** et envoyer le montant
par virement Interac à l'adresse courriel du client, sans attendre qu'il relance. Les plus à risque
sont L-10486 (2022), L-19577 (2024), L-28161 et L-28037 (fin 2024).

---

## B. Les 14 cartes-cadeaux

Les cartes sont **déjà créées** dans l'admin, actives, sans date d'expiration, aucune entamée.
Il reste à appuyer sur **Send gift card** sur chaque fiche, une à la fois.

Le message annonçant la carte est déjà parti à chacune de ces personnes, donc la condition d'ordre
est remplie : **envoyer maintenant.**

| Client | Montant | 4 derniers du code |
| --- | --- | --- |
| Tim Sullivan | 200 $ | ghdj |
| Stephane Vincent | 200 $ | 3bdx |
| Patrick Lessnick | 200 $ | bd87 |
| Toby Lanthier | 200 $ | fwcm |
| Nathalie Durand | 200 $ | r78m |
| Charlotte Bourgoing | 200 $ | pqwd |
| Guillaume Lanteigne-Voyer | 200 $ | 67cc |
| Marie-Andrée Blouin | 200 $ | frcw |
| Annie Hubert | 100 $ | cxgp |
| Sonia Pouliot | 100 $ | hytw |
| Jimmy Allaire | 100 $ | dx66 |
| Ariane Poirier | 100 $ | qqmt |
| Mélanie Boucher | 100 $ | fbpv |
| Emma Whiten | 100 $ | 9yft |

**Total : 2 200 $** (8 × 200 $ + 6 × 100 $).

⚠️ **Charlotte Bourgoing a deux cartes** : celle de décembre (L-44698) et celle-ci. N'envoyer que
la nouvelle, `pqwd`. Son message dit déjà « en plus de celle de décembre ».

⚠️ **Aucune carte pour Marie-Michèle Leblanc ni pour Susan Lockhart.** Le message de Marie-Michèle
est des excuses seules, sans argent, volontairement. Lui envoyer une carte annulerait tout l'effet
et se lirait mal si la capture circule.

---

## C. Ce qu'il faut renvoyer une fois fini

Une ligne par personne : remboursement **passé** ou **refusé par la passerelle**, et carte
**envoyée** ou non. Les refus de passerelle deviennent la liste des virements Interac à faire, et
c'est la seule partie qui a une échéance : les messages disent « d'ici quelques jours ».
