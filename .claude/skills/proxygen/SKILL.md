---
name: proxygen
description: General Proxy de Lasclay — le service Render des opérations, qui expose ShipStation en accès complet (19 actions), Omnisend (10) et Klaviyo en lecture seule (21). Couvre les commandes et expéditions, le suivi, les tarifs, les tags, la mise en attente, le marquage expédié, l'achat et l'annulation d'étiquettes, les contacts et campagnes courriel, et l'export exhaustif Klaviyo pour migration.
when_to_use: Déclenche dès qu'il est question du proxy général, de ShipStation, d'Omnisend, de Klaviyo, d'une expédition, d'un numéro de suivi, d'une étiquette d'envoi, d'un transporteur, d'un entrepôt, d'un contact ou d'une campagne courriel. Déclenche même sans nommer le service — « où est le colis de la commande 12345 », « mets cette commande en attente », « combien coûterait l'envoi vers les États-Unis », « exporte les profils pour la migration », « cette cliente est-elle désabonnée ».
argument-hint: [ce que tu veux faire côté expédition ou marketing]
allowed-tools:
  - Bash(node connectors_client.js:*)
  - Bash(node klaviyo_export.js:*)
  - Bash(node shipstation_check.js:*)
  - Bash(node shopify_check.js:*)
  - Read
  - Grep
  - Glob
  - Skill
---

# General Proxy — opérations Lasclay

N'explore pas pour retrouver comment joindre ces services : tout est ci-dessous.

## Prérequis

Service Render `https://general-proxy-5muf.onrender.com`, code dans `server.js` à la racine du
dépôt **`lasclay/missive-automations`**. Les clés API des services tiers vivent uniquement côté
Render — jamais dans le dépôt, jamais dans l'environnement de session. C'est tout l'intérêt du
proxy : la session ne porte que le secret d'appel.

| Variable | Rôle |
| --- | --- |
| `GENERAL_PROXY_SECRET` | requis |
| `GENERAL_PROXY_URL` | facultatif, défaut `https://general-proxy-5muf.onrender.com` |

### Trois couches — ne prends jamais la plus étroite pour la plus large

**Avant d'écrire qu'une chose est impossible, tu DOIS avoir lu les couches 2 et 3.** Sans ça, tu
n'as pas constaté une limite, tu as constaté ton ignorance.

| # | Couche | Ce que ça vaut comme preuve |
| --- | --- | --- |
| 1 | `connectors_client.js` et `GET /connectors` | **aucune.** La liste des actions est une commodité, pas une frontière |
| 2 | `server.js` à la racine | le périmètre réellement exposé aujourd'hui |
| 3 | API du service tiers (ShipStation, Omnisend, Klaviyo) | le vrai plafond |

Lis la couche 2 en entier : le bloc de commentaire vieillit, le dispatch de routes et les
fonctions disent la vérité. Une fonction existante fait souvent déjà presque ce que tu cherches, à
un champ près. Demande-toi toujours : « qu'est-ce qui, dans ce code, force cette limite? » Si la
réponse est une valeur codée en dur ou une validation, ce n'est pas une limite du service, c'est
une ligne à changer.

La bonne formulation n'est jamais « ShipStation ne peut pas ». C'est « le proxy ne l'expose pas
encore, l'API le permet, voici le correctif ». Et n'oublie pas : les services Render suivent
`main`, une route ajoutée sur une branche reste inerte tant que la fusion n'est pas faite.

Ce garde-fou vient d'un vrai incident sur le proxy Missive : on a cru longtemps qu'il ne pouvait
pas envoyer un courriel neuf, parce que le client n'exposait que `reply`. La capacité était là
depuis le début, à quinze lignes près, dans une fonction que personne n'avait ouverte.

```bash
node connectors_client.js                                   # sonde /health
node connectors_client.js <connecteur> <action> '{"param":"valeur"}'
```

Vérifie `ls connectors_client.js` si tu doutes d'être dans le dépôt. Premier appel ~10 s : Render
endort le service au repos.

**Introspection sans secret** : `GET /connectors` liste les connecteurs, leurs actions et leur état
`enabled`. À utiliser plutôt que de deviner un nom d'action. Les listes ci-dessous en viennent.

## ShipStation — accès complet, API v1, 33 actions

**Lecture (22).** `orders`, `order`, `shipments`, `fulfillments`, `carriers`, `carrier`,
`listservices`, `listpackages`, `stores`, `store`, `storerefreshstatus`, `marketplaces`,
`warehouses`, `warehouse`, `products`, `product`, `customers`, `customer`, `users`,
`webhooks`, `listtags`, `listbytag`, plus `getrates` (POST sans effet de bord).

- `orders` — `orderNumber`, `orderStatus` parmi `awaiting_shipment` / `shipped` / `on_hold` /
  `cancelled`, `customerName`, `storeId`, `createDateStart` et `createDateEnd`, `page`,
  `pageSize` jusqu'à 500. Retourne les commandes avec leurs articles.
- `order` — `orderId`, l'entier **interne** ShipStation, pas le numéro de commande.
- `shipments` — `orderNumber`, `trackingNumber`, `carrierCode`, `shipDateStart`/`End`. **C'est ici
  que vit le numéro de suivi.**
- `fulfillments` — les envois expédiés hors étiquette ShipStation. Un colis absent de `shipments`
  peut être ici.
- `listtags` — indispensable pour obtenir un `tagId` avant `addtag`.
- `listservices` / `listpackages` — **carrierCode** ; donnent les `serviceCode` et `packageCode`
  valides d'un transporteur, à consulter avant `getrates` ou un achat d'étiquette.
- `products` — fiches produit : poids, dimensions, `customsDescription`, `harmonizedTariffCode`,
  `warehouseLocation`, défauts d'expédition. C'est le référentiel qui alimente les douanes.
- `customers`, `users`, `webhooks`, `marketplaces` — le reste de la surface v1, en lecture.

**Écriture (11), par risque croissant.**

| Risque | Action | Détail |
| --- | --- | --- |
| 🟢 | `getrates` | devis de tarifs. **carrierCode, fromPostalCode, toPostalCode, toCountry, weight** `{value, units}`, plus serviceCode, packageCode, dimensions, confirmation, residential. Aucun effet de bord |
| 🟢 | `addtag` / `removetag` | **orderId, tagId** — réversible, sans coût |
| 🟢 | `holduntil` | **orderId, holdUntilDate** AAAA-MM-JJ |
| 🟢 | `restorefromhold` | **orderId** — remet en file |
| 🟡 | `markasshipped` | **orderId, carrierCode**, plus trackingNumber, shipDate, notifyCustomer, notifySalesChannel. **Notifie le client** sauf `notifyCustomer:false` |
| 🟡 | `createorder` | **orderNumber, orderDate, orderStatus, billTo, shipTo**. Upsert par `orderKey` : les champs fournis **écrasent** l'existant |
| 🟡 | `voidlabel` | **shipmentId** — annule une étiquette, généralement remboursée |
| 🔴 | `deleteorder` | **orderId** — destructeur |
| 🔴 | `createlabelfororder` | **orderId, carrierCode, serviceCode, shipDate**, plus weight, packageCode, testLabel |
| 🔴 | `createlabel` | **carrierCode, serviceCode, shipDate, shipFrom, shipTo, weight**, plus isReturnLabel, testLabel |

Les deux dernières **achètent une étiquette et débitent le wallet — argent réel**. `testLabel:true`
permet d'essayer sans frais, et c'est ce qu'il faut faire d'abord. Ne les lance jamais sans
confirmation explicite dans le tour courant, même si la demande paraît sans ambiguïté. Elles sont
d'ailleurs couvertes par des règles `permissions.ask`, comme `deleteorder` : elles demanderont même
en mode auto.

## Omnisend — API v3, 10 actions

Clé `OMNISEND_API_KEY` côté Render.

**Lecture (7).** `contacts` — `email`, `status` parmi `subscribed` / `unsubscribed` /
`nonSubscribed`, `segmentID`, `limit` max 250, `after` —, puis `contact` (**contactID**),
`campaigns`, `campaign` (**campaignID**), `orders`, `products`, `carts`.

**Écriture (3).** `createcontact` (🟡 crée ou abonne — **body** au format contact v3 :
`identifiers[{type:"email", id, channels:{email:{status}}}]`, `firstName`, `tags`),
`updatecontact` (🟡 **contactID, body**, PATCH partiel), et `triggerevent` (🟡 **body** avec
`eventID` ou `systemName`, `email`, `fields`) — qui **déclenche les automations écoutant
l'événement**, donc de vrais envois. Confirmation requise, règle `permissions.ask`.

Quand on demande « accéder à Omnisend », c'est ce chemin, pas un connecteur MCP.

## Klaviyo — lecture seule, 21 actions, export et migration

Clé `KLAVIYO_API_KEY` côté Render, en-tête `revision` (défaut `2025-04-15`).

Actions : `profiles`, `profile`, `lists`, `list`, `listprofiles`, `segments`, `segment`,
`segmentprofiles`, `flows`, `flow`, `campaigns`, `campaign`, `campaignmessage`, `templates`,
`template`, `events`, `metrics`, `tags`, `forms`, `images`, `coupons`.

Paramètres qui comptent :

- `profiles` — ajoute `"additional-fields[profile]": "subscriptions"` pour récupérer les
  **consentements**, sans quoi l'export est inutilisable pour une migration.
- `segment` — `"additional-fields[segment]": "profile_count"`.
- `flow` — `"additional-fields[flow]": "definition"` pour une définition complète réimportable.
- `campaigns` — le paramètre `filter` est **obligatoire**, par exemple
  `equals(messages.channel,'email')`.
- Pagination : `"page[size]"` et `"page[cursor]"`.

Export en masse : `node klaviyo_export.js profiles <dossier>` produit des CSV avec les
consentements. Les données personnelles peuvent circuler entre ces systèmes et le dépôt privé pour
le travail de migration — **jamais vers une destination publique**, ni paste, ni gist, ni dépôt
public.

### Écrire dans Klaviyo — le connecteur, pas le proxy

Le General Proxy est en **lecture seule** sur Klaviyo. Pour modifier un profil il existe un autre
chemin, le **connecteur Klaviyo MCP**, qui expose `update_profile`,
`subscribe_profile_to_marketing` et le reste. Ne conclus donc pas qu'une écriture est impossible
parce que le proxy ne la fait pas : ce sont deux accès distincts au même compte.

**Changer l'adresse courriel d'un contact efface son consentement.** Klaviyo rattache le
consentement à l'adresse, pas à la personne. Un `update_profile` qui change le champ `email` fait
retomber le profil de `SUBSCRIBED` à `NEVER_SUBSCRIBED` et **efface la date d'opt-in**, sans
prévenir. Le champ `can_receive_email_marketing` reste `true`, ce qui masque le problème : le
contact n'est pas bloqué, mais il n'a plus de preuve de consentement et sort des segments et flux
qui filtrent là-dessus. Constaté sur un abonné de 2021, à qui ça a coûté cinq ans d'ancienneté le
temps qu'on s'en aperçoive.

La manœuvre se fait donc **en deux temps**, jamais un seul :

1. `update_profile` — changer `email` vers la nouvelle adresse.
2. `subscribe_profile_to_marketing` — rétablir `SUBSCRIBED` avec `historical_import: true` et
   `consented_at` réglé sur la **date d'opt-in d'origine**, relevée AVANT l'étape 1.

Relève donc toujours `subscriptions.email.marketing.consent_timestamp` avant de toucher à quoi que
ce soit. Et ne date jamais l'opt-in d'aujourd'hui pour aller plus vite : ça fabrique une preuve de
consentement fausse, alors que la vraie existe et qu'il suffit de la reporter. Renseigne
`custom_source` avec la raison et la date du courriel du contact.

Enfin, vérifie après coup en relisant le profil. La souscription est asynchrone et renvoie une
réponse vide : l'absence d'erreur ne prouve rien.

Deux limites du compte, constatées à l'usage : les **identifiants secondaires**
(`meta.patch_identifiers`) ne sont pas activés — impossible de garder l'ancienne adresse rattachée
au profil — et `subscribe_profile_to_marketing` **exige une confirmation humaine explicite** avant
de s'exécuter. C'est voulu : un consentement ne se pose pas à la place de quelqu'un.

## Vérifier un envoi — règle ferme

Deux sources, jamais une seule : Shopify pour la commande, ShipStation pour l'expédition et le
suivi. Une commande payée peut n'avoir aucune expédition créée ; une expédition peut exister sans
suivi transmis ; un envoi hors étiquette ShipStation apparaît dans `fulfillments` et non dans
`shipments`. Ces cas se répondent différemment.

`shopify_check.js` et `shipstation_check.js` font la vérification croisée.

Pour rédiger la réponse au client ensuite, charge le skill **`missive`** : il porte le ton de
marque et les réponses types d'expédition et de suivi, la catégorie la plus volumineuse de la boîte
avec 3728 fils sur deux ans.

## Détail complet

`CONNECTORS_PROXY.md` à la racine du dépôt : tableaux par connecteur, paramètres exacts, risques
annotés. Consulte-le avant une action jamais lancée.

## Contexte d'entreprise

**Les Produits Lasclay Inc**, siège à Québec — marque québécoise de produits isolés à la soie
d'asclépiade : plein air, accessoires, glacières souples, semences. Vente sur lasclay.com en
français et en anglais, expéditions au Canada et aux États-Unis.

La logistique spéciale — grèves postales, douanes, envois vers les USA — a ses propres réponses
types dans le skill `missive`. QuickBooks est délibérément isolé sur un autre proxy, avec un secret
distinct : voir le skill `qbo`.
