---
name: proxygen
description: Accès au General Proxy de Lasclay, le service Render des opérations qui expose ShipStation (accès complet), Omnisend et Klaviyo (lecture seule). Couvre les commandes et expéditions, le suivi, les tags, la mise en attente, le marquage expédié, l'achat et l'annulation d'étiquettes, les contacts et campagnes courriel, et l'export exhaustif Klaviyo.
when_to_use: Déclenche dès qu'il est question du proxy général, de ShipStation, d'Omnisend, de Klaviyo, d'une expédition, d'un numéro de suivi, d'une étiquette d'envoi, d'un transporteur, d'un contact ou d'une campagne courriel. Déclenche même sans nommer le service, par exemple « où est le colis de la commande 12345 », « mets cette commande en attente », « combien coûterait l'envoi vers les États-Unis », « exporte les profils pour la migration ».
argument-hint: [ce que tu veux faire côté expédition ou marketing]
allowed-tools:
  - Bash(node connectors_client.js:*)
  - Bash(node klaviyo_export.js:*)
  - Bash(node shipstation_check.js:*)
  - Bash(node shopify_check.js:*)
  - Read
  - Grep
  - Glob
---

# General Proxy — opérations Lasclay

N'explore pas le dépôt pour retrouver comment joindre ces services : tout est ci-dessous.

## Accès au proxy

Service Render `https://general-proxy-5muf.onrender.com`, code dans `server.js` à la racine. Les
clés API vivent côté Render, jamais dans l'environnement Claude ni dans le code. Env :
`GENERAL_PROXY_URL` facultative, `GENERAL_PROXY_SECRET` requise.

```bash
node connectors_client.js <connecteur> <action> '{"param":"valeur"}'
node connectors_client.js                    # sans argument : sonde /health
```

Introspection sans secret : `GET /connectors` liste les connecteurs, leurs actions et leur état
`enabled`. Utilise-la si tu doutes qu'une action existe, plutôt que de deviner.

Le premier appel peut prendre ~10 s, Render endort le service au repos.

## ShipStation — accès complet

API v1 « legacy ». Lecture : `orders` (filtres `orderNumber`, `orderStatus` parmi
`awaiting_shipment`/`shipped`/`on_hold`/`cancelled`, `customerName`, `storeId`,
`createDateStart`/`End`, `page`, `pageSize` max 500), `order` (`orderId` interne),
`shipments` (donne le **numéro de suivi**), `fulfillments`, `carriers`, `stores`, `warehouses`,
`listtags`.

Écriture, par risque croissant :

- 🟢 sans effet de bord : `getrates` (devis de tarifs), `addtag` / `removetag` (`orderId`, `tagId`
  via `listtags`), `holduntil` (`orderId`, `holdUntilDate` AAAA-MM-JJ), `restorefromhold`.
- 🟡 `markasshipped` (`orderId`, `carrierCode`) — **notifie le client** sauf `notifyCustomer:false`.
- 🟡 `createorder` — upsert par `orderKey` : les champs fournis **écrasent** l'existant.
- 🟡 `voidlabel` (`shipmentId`) — annule une étiquette, généralement remboursée.
- 🔴 `deleteorder` (`orderId`) — destructeur.
- 🔴 `createlabelfororder` et `createlabel` — **achètent une étiquette, c'est de l'argent réel**
  sur le wallet. Utilise `testLabel:true` pour essayer sans frais. Ne les lance jamais sans
  confirmation explicite dans le tour courant, même si la demande semble claire.

## Omnisend

Clé `OMNISEND_API_KEY` côté Render, API v3. Lecture : `contacts` (`email`, `status` parmi
`subscribed`/`unsubscribed`/`nonSubscribed`, `segmentID`, `limit` max 250, `after`), `contact`,
`campaigns`, `campaign`, `orders`, `products`, `carts`. Écriture : `createcontact`,
`updatecontact` (PATCH partiel), `triggerevent` — 🟡 ce dernier déclenche les automations qui
écoutent l'événement, donc de vrais envois.

Quand on te demande « accéder à Omnisend », c'est ce chemin, pas un connecteur MCP.

## Klaviyo — lecture seule

Clé `KLAVIYO_API_KEY` côté Render, en-tête `revision` (défaut `2025-04-15`). Pour l'export
exhaustif et la migration : `profiles` (avec `"additional-fields[profile]": "subscriptions"` pour
les consentements), `profile`, `lists`, `listprofiles`, `segments`, `segmentprofiles`, `flows`
(avec `"additional-fields[flow]": "definition"` pour une définition réimportable), `campaigns`
(filtre **obligatoire**, ex. `equals(messages.channel,'email')`), `campaignmessage`, templates,
événements.

Export en masse : `node klaviyo_export.js profiles <dossier>` produit des CSV avec les
consentements.

## Détail complet

`CONNECTORS_PROXY.md` à la racine : tableaux d'actions par connecteur, paramètres exacts,
niveaux de risque. Consulte-le avant une action que tu n'as jamais lancée.

## Vérifier un envoi

Une question de suivi se tranche avec Shopify **et** ShipStation, jamais une seule source :
Shopify pour la commande, ShipStation pour l'expédition et le suivi. `shopify_check.js` et
`shipstation_check.js` font la vérification croisée.
