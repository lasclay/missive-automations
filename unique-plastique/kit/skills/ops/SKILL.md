---
name: ops
description: Opérations d'Unique Plastique — General Proxy (ShipStation en accès complet, Omnisend, Klaviyo en lecture seule) et Shopify en accès direct. Couvre les commandes et expéditions, le suivi, les tarifs, les tags, la mise en attente, le marquage expédié, l'achat et l'annulation d'étiquettes, les contacts et campagnes courriel, et la vérification croisée Shopify + ShipStation avant de répondre à un client.
when_to_use: Déclenche dès qu'il est question du General Proxy, de ShipStation, de Shopify, d'Omnisend, de Klaviyo, d'une commande, d'une expédition, d'un numéro de suivi, d'une étiquette d'envoi, d'un transporteur, d'un entrepôt, d'un contact ou d'une campagne courriel. Déclenche même sans nommer le service — « où est le colis de la commande 1042 », « mets cette commande en attente », « combien coûterait l'envoi vers l'Ontario », « est-ce que cette cliente est désabonnée », « exporte les profils ».
argument-hint: [ce que tu veux faire côté commande, expédition ou marketing]
allowed-tools:
  - Bash(node clients/connectors_client.js:*)
  - Bash(node clients/shopify_check.js:*)
  - Bash(node clients/shipstation_check.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# Opérations — Unique Plastique

N'explore pas le dépôt pour retrouver comment joindre ces services : tout est ci-dessous.

## Prérequis

Le General Proxy est un service Render, `https://<a-remplir>.onrender.com`, code dans
`general-proxy/server.js`. Les clés des API tierces vivent **uniquement** côté Render — jamais dans
le dépôt, jamais dans l'environnement de session. C'est tout l'intérêt du proxy : la session ne
porte qu'un secret d'appel révocable.

| Variable | Rôle |
| --- | --- |
| `GENERAL_PROXY_SECRET` | requis, repli sur `PROXY_SECRET` |
| `GENERAL_PROXY_URL` | requis, `https://<a-remplir>.onrender.com` |
| `SHOPIFY_STORE` + `SHOPIFY_ADMIN_TOKEN` | Shopify, en direct (ou `SHOPIFY_CLIENT_ID`/`SHOPIFY_CLIENT_SECRET`) |

```bash
node clients/connectors_client.js                    # sonde /health
node clients/connectors_client.js connectors         # introspection, SANS secret
node clients/connectors_client.js <connecteur> <action> '{"param":"valeur"}'
```

`connectors` liste les connecteurs, leurs actions et leur état `enabled` : utilise-le plutôt que de
deviner un nom d'action. Un connecteur dont les variables manquent est simplement **désactivé** (503)
— les autres continuent de fonctionner. Premier appel ~10 s : Render endort le service au repos.

### Trois couches — ne prends jamais la plus étroite pour la plus large

**Avant d'écrire qu'une chose est impossible, tu DOIS avoir lu les couches 2 et 3.**

| # | Couche | Ce que ça vaut comme preuve |
| --- | --- | --- |
| 1 | `clients/connectors_client.js` et `GET /connectors` | **aucune.** L'allowlist est une commodité, pas une frontière |
| 2 | `general-proxy/server.js` | le périmètre réellement exposé aujourd'hui |
| 3 | API du service tiers (ShipStation v1, Omnisend v3, Klaviyo) | le vrai plafond |

La bonne formulation n'est jamais « ShipStation ne peut pas ». C'est « le proxy ne l'expose pas
encore, l'API le permet, voici le correctif » — ajouter une action, c'est une entrée de plus dans
l'objet `actions` du connecteur. Et les services Render suivent `main` : une action ajoutée sur une
branche reste inerte tant que la fusion n'est pas faite.

## ShipStation — API v1, accès complet, 33 actions

**Lecture (22).** `orders`, `order`, `shipments`, `fulfillments`, `carriers`, `carrier`,
`listservices`, `listpackages`, `stores`, `store`, `storerefreshstatus`, `marketplaces`,
`warehouses`, `warehouse`, `products`, `product`, `customers`, `customer`, `users`, `webhooks`,
`listtags`, `listbytag`.

- `orders` — `orderNumber`, `orderStatus` parmi `awaiting_payment` / `awaiting_shipment` / `shipped`
  / `on_hold` / `cancelled`, `customerName`, `storeId`, `createDateStart`/`End`, `page`, `pageSize`
  jusqu'à 500. Retourne les commandes avec leurs articles.
- `order` — `orderId`, l'entier **interne** ShipStation, pas le numéro de commande.
- `shipments` — `orderNumber`, `trackingNumber`, `carrierCode`, `shipDateStart`/`End`. **C'est ici
  que vit le numéro de suivi**, avec le drapeau `voided`.
- `fulfillments` — les envois marqués expédiés **hors** étiquette ShipStation. Un colis absent de
  `shipments` peut être ici.
- `listtags` — indispensable pour obtenir un `tagId` avant `addtag` / `removetag` / `listbytag`.
- `listservices` / `listpackages` — **carrierCode** ; donnent les `serviceCode` et `packageCode`
  valides, à consulter **avant** un devis ou un achat d'étiquette.

**Écriture (11), par risque croissant.**

| Risque | Action | Paramètres requis, en gras |
| --- | --- | --- |
| 🟢 | `getrates` | **carrierCode, fromPostalCode, toPostalCode, toCountry, weight** `{value, units}` (+ serviceCode, packageCode, dimensions, confirmation, residential). POST mais **aucun effet de bord** |
| 🟢 | `addtag` / `removetag` | **orderId, tagId** — réversible, sans coût |
| 🟢 | `holduntil` | **orderId, holdUntilDate** AAAA-MM-JJ |
| 🟢 | `restorefromhold` | **orderId** — remet la commande en file |
| 🟡 | `markasshipped` | **orderId, carrierCode** (+ trackingNumber, shipDate, notifyCustomer, notifySalesChannel). **Notifie le client** sauf `notifyCustomer:false` |
| 🟡 | `createorder` | **orderNumber, orderDate, orderStatus, billTo, shipTo**. Upsert par `orderKey` : sur une commande existante, les champs fournis **écrasent** |
| 🟡 | `voidlabel` | **shipmentId** — annule une étiquette, généralement remboursée |
| 🔴 | `deleteorder` | **orderId** — annule la commande, destructeur |
| 🔴 | `createlabelfororder` | **orderId, carrierCode, serviceCode, shipDate** (+ weight, packageCode, testLabel) |
| 🔴 | `createlabel` | **carrierCode, serviceCode, shipDate, shipFrom, shipTo, weight** (+ isReturnLabel, testLabel) |

Les deux dernières **achètent une étiquette et débitent le wallet — argent réel**. `testLabel: true`
permet d'essayer sans frais, et c'est ce qu'il faut faire d'abord. Pour comparer des prix, c'est
`getrates` qu'on appelle, jamais un achat. Ne lance `createlabelfororder`, `createlabel` ou
`deleteorder` qu'avec une confirmation explicite dans le tour courant, même si la demande paraît sans
ambiguïté : ces actions sont dans l'allowlist parce qu'elles sont utiles, pas parce qu'elles sont
anodines.

Limite de débit v1 : 40 requêtes/minute. Le proxy respecte `X-Rate-Limit-Reset` sur 429 — n'ajoute
pas ta propre boucle de retry.

## Shopify — accès direct, lecture seule

Shopify n'a pas de connecteur dans le proxy : `clients/shopify_check.js` parle à l'Admin API avec un
jeton lu dans l'environnement.

```bash
node clients/shopify_check.js <numéro de commande>   # sans argument : les 3 dernières commandes
```

Il renvoie un résumé lisible et ne modifie rien : date, statut de paiement, annulation, **état
d'expédition**, état du colis, remboursements (montant et articles retournés), numéros et liens de
suivi, articles. Deux pièges : la portée `read_orders` ne voit par défaut que **60 jours**
d'historique — une commande introuvable n'est pas forcément inexistante ; et `label_printed` /
`label_purchased` veut dire « étiquette créée », pas « colis parti ».

## Vérification croisée — règle ferme

**Avant de dire à quelqu'un que son colis est parti, croise Shopify ET ShipStation. Les deux, pas
l'un ou l'autre.** Shopify peut afficher « fulfilled » sur une étiquette créée mais jamais ramassée :
c'est la source d'erreur la plus fréquente d'un agent de support.

```bash
node clients/shopify_check.js 1042
node clients/connectors_client.js shipstation orders    '{"orderNumber":"1042"}'
node clients/connectors_client.js shipstation shipments '{"orderNumber":"1042"}'
```

Comment lire le résultat :

| Shopify | ShipStation | Ce que c'est |
| --- | --- | --- |
| payée, non expédiée | commande `awaiting_shipment` | en préparation — ne promets pas de date |
| fulfilled | aucune expédition | étiquette créée hors ShipStation, ou rien de parti : vérifie `fulfillments` |
| fulfillment avec suivi | `shipments` avec `voided: true` | l'étiquette a été annulée, le colis n'est **pas** parti |
| fulfillment avec suivi | `shipments` avec `shipDate` | vraiment expédié — c'est le seul cas où on l'affirme |

Ces cas se répondent différemment. `clients/shipstation_check.js` fait la même vérification côté
ShipStation sans passer par le proxy (clés en environnement), utile pour valider un accès avant
déploiement. Pour rédiger ensuite la réponse au client, charge le skill **`missive`** : les deux
skills coexistent dans le même tour.

## Omnisend — API v3, 10 actions

**Lecture (7).** `contacts` (`email`, `status` parmi `subscribed` / `unsubscribed` /
`nonSubscribed`, `segmentID`, `limit` max 250, `after`), `contact` (**contactID**), `campaigns`,
`campaign` (**campaignID**), `orders`, `products`, `carts`.

**Écriture (3).** `createcontact` (🟡 **body** au format contact v3 :
`identifiers[{type:"email", id, channels:{email:{status}}}]`, `firstName`, `tags`), `updatecontact`
(🟡 **contactID, body**, PATCH partiel), `triggerevent` (🟡 **body** avec `eventID` ou `systemName`,
`email`, `fields`). `triggerevent` **démarre les automations qui écoutent l'événement**, donc de
vrais envois vers de vraies personnes : confirmation requise.

Quand on demande « accéder à Omnisend », c'est ce chemin, pas un connecteur MCP.

## Klaviyo — lecture seule, 21 actions, export et migration

Clé privée `pk_...` côté Render, en-tête `revision` (défaut `2025-04-15`). Actions : `profiles`,
`profile`, `lists`, `list`, `listprofiles`, `segments`, `segment`, `segmentprofiles`, `flows`,
`flow`, `campaigns`, `campaign`, `campaignmessage`, `templates`, `template`, `events`, `metrics`,
`tags`, `forms`, `images`, `coupons`.

Paramètres qui comptent :

- `profiles` — ajoute `"additional-fields[profile]": "subscriptions"` pour récupérer les
  **consentements**, sans quoi l'export est inutilisable pour une migration ou une preuve LCAP.
- `segment` — `"additional-fields[segment]": "profile_count"`.
- `flow` — `"additional-fields[flow]": "definition"` pour une définition complète réimportable.
- `campaigns` — le paramètre `filter` est **obligatoire**, par exemple
  `equals(messages.channel,'email')`.
- Pagination par curseur : `"page[size]"` (max 100) et `"page[cursor]"`, extrait de `links.next`.

Les données personnelles peuvent circuler entre ces systèmes et le dépôt privé pour un travail de
migration — **jamais vers une destination publique**, ni paste, ni gist, ni dépôt public.

## Ce que ce skill ne couvre pas

Il donne l'**accès**, pas les **décisions** : quand rembourser, quand réexpédier, quel transporteur
choisir, quoi promettre comme délai. Demande la règle plutôt que de l'inventer. Détail complet,
paramètres exacts et risques annotés : `general-proxy/CONNECTORS_PROXY.md`. QuickBooks est
délibérément isolé sur un autre service, avec un secret distinct : skill **`qbo`**.
