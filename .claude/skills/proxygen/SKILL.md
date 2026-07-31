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

```bash
node connectors_client.js                                   # sonde /health
node connectors_client.js <connecteur> <action> '{"param":"valeur"}'
```

Vérifie `ls connectors_client.js` si tu doutes d'être dans le dépôt. Premier appel ~10 s : Render
endort le service au repos.

**Introspection sans secret** : `GET /connectors` liste les connecteurs, leurs actions et leur état
`enabled`. À utiliser plutôt que de deviner un nom d'action. Les listes ci-dessous en viennent.

## ShipStation — accès complet, API v1, 34 actions

**Lecture (23).** `orders`, `order`, `shipments`, `fulfillments`, `carriers`, `carrier`,
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
