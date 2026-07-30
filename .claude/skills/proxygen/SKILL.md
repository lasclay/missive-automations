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

N'explore pas pour retrouver comment joindre ces services : tout est ci-dessous.

## Prérequis — à vérifier en premier

Service Render `https://general-proxy-5muf.onrender.com`, code dans `server.js` à la racine du
dépôt **`lasclay/missive-automations`**. Les clés API des services tiers vivent uniquement côté
Render, jamais dans le dépôt ni dans l'environnement de session : c'est tout l'intérêt du proxy.

| Variable | Rôle |
| --- | --- |
| `GENERAL_PROXY_SECRET` | requis |
| `GENERAL_PROXY_URL` | facultatif, défaut `https://general-proxy-5muf.onrender.com` |

```bash
node connectors_client.js                                  # sonde /health
node connectors_client.js <connecteur> <action> '{"param":"valeur"}'
```

Si le répertoire courant n'est pas le dépôt, vérifie avec `ls connectors_client.js` et signale-le
plutôt que de reconstruire un appel à la main.

**Introspection sans secret** : `GET /connectors` liste les connecteurs, leurs actions et leur
état `enabled`. Utilise-la quand tu doutes qu'une action existe, au lieu de deviner un nom.

Premier appel ~10 s : Render endort le service au repos. Ce n'est pas une panne.

## ShipStation — accès complet, API v1

**Lecture.** `orders` accepte `orderNumber`, `orderStatus` parmi `awaiting_shipment`, `shipped`,
`on_hold`, `cancelled`, plus `customerName`, `storeId`, `createDateStart`/`End`, `page`,
`pageSize` jusqu'à 500. Puis `order` par `orderId` interne, `shipments` qui porte le **numéro de
suivi**, `fulfillments` pour les envois expédiés hors étiquette ShipStation, `carriers`, `stores`,
`warehouses`, `listtags`.

**Écriture, par risque croissant.**

| Risque | Actions |
| --- | --- |
| 🟢 aucun effet de bord | `getrates` (devis de tarifs), `addtag` / `removetag` (`orderId` + `tagId` via `listtags`), `holduntil` (`orderId` + `holdUntilDate` AAAA-MM-JJ), `restorefromhold` |
| 🟡 visible par le client | `markasshipped` — **notifie le client** sauf `notifyCustomer:false` |
| 🟡 écrase | `createorder` — upsert par `orderKey`, les champs fournis remplacent l'existant |
| 🟡 réversible | `voidlabel` (`shipmentId`) — annule une étiquette, généralement remboursée |
| 🔴 destructeur | `deleteorder` (`orderId`) |
| 🔴 **argent réel** | `createlabelfororder`, `createlabel` |

Les deux dernières **achètent une étiquette et débitent le wallet**. `testLabel:true` permet
d'essayer sans frais. Ne les lance jamais sans confirmation explicite dans le tour courant, même
si la demande paraît claire — elles sont d'ailleurs couvertes par des règles `permissions.ask`
qui demanderont même en mode auto, comme `deleteorder`.

## Omnisend — API v3, marketing courriel et SMS

Clé `OMNISEND_API_KEY` côté Render. Lecture : `contacts` (`email`, `status` parmi `subscribed`,
`unsubscribed`, `nonSubscribed`, plus `segmentID`, `limit` max 250, `after`), `contact`,
`campaigns`, `campaign`, `orders`, `products`, `carts`.

Écriture : `createcontact` et `updatecontact` (PATCH partiel, 🟡), et `triggerevent` (🟡) qui
**déclenche les automations écoutant l'événement**, donc de vrais envois aux clients —
confirmation requise, règle `permissions.ask`.

Quand on demande « accéder à Omnisend », c'est ce chemin, pas un connecteur MCP.

## Klaviyo — lecture seule, export et migration

Clé `KLAVIYO_API_KEY` côté Render, en-tête `revision` (défaut `2025-04-15`). Actions : `profiles`
— ajoute `"additional-fields[profile]": "subscriptions"` pour récupérer les consentements —,
`profile`, `lists`, `listprofiles`, `segments` (`"additional-fields[segment]": "profile_count"`),
`segmentprofiles`, `flows` (`"additional-fields[flow]": "definition"` pour une définition
réimportable), `campaigns` (le paramètre `filter` est **obligatoire**, par exemple
`equals(messages.channel,'email')`), `campaignmessage`, templates, événements.

Pagination par `"page[size]"` et `"page[cursor]"`.

Export en masse : `node klaviyo_export.js profiles <dossier>` produit des CSV avec les
consentements. Les données personnelles peuvent circuler entre ces systèmes et le dépôt privé
pour le travail de migration, **jamais vers une destination publique**.

## Vérifier un envoi — règle ferme

Une question de suivi se tranche avec **deux** sources : Shopify pour la commande, ShipStation
pour l'expédition et le suivi. Une commande payée peut n'avoir aucune expédition créée, et une
expédition peut exister sans numéro de suivi transmis — ces deux cas se répondent différemment.
`shopify_check.js` et `shipstation_check.js` font la vérification croisée.

Pour rédiger la réponse au client ensuite, charge le skill **`missive`** : il porte le ton de
marque et les réponses types d'expédition et de suivi, la catégorie la plus volumineuse de la
boîte.

## Détail complet

`CONNECTORS_PROXY.md` à la racine du dépôt : tableaux d'actions par connecteur, paramètres
exacts, niveaux de risque annotés. Consulte-le avant une action que tu n'as jamais lancée.

## Contexte d'entreprise

*Les Produits Lasclay Inc*, marque québécoise de produits isolés à la soie d'asclépiade — plein
air, accessoires, glacières souples, semences. Vente en ligne sur lasclay.com en français et en
anglais, siège à Québec, expéditions au Canada et aux États-Unis. La logistique spéciale — grèves
postales, douanes, envois vers les USA — a ses propres réponses types dans le skill `missive`.
QuickBooks est délibérément isolé sur un autre proxy : voir le skill `qbo`.
