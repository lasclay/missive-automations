# 21. Intégration Shopify & contexte canadien

> Ce fichier complète le paquet sur les deux points que la spec ShipStation générique ne couvre pas et qui sont pourtant les seuls réellement indispensables au jour 1 pour Lasclay : **l'intégration Shopify** (unique canal de vente) et **l'expédition depuis le Canada**.

---

## Partie A — Shopify

### A.1 Pourquoi c'est le point le plus risqué du projet

ShipStation masque toute la complexité de Shopify derrière un connecteur. En le remplaçant, on hérite de cette complexité. Deux choses seulement doivent marcher parfaitement :

1. **Importer les commandes** — si ça casse, on s'en rend compte tout de suite.
2. **Renvoyer le tracking** — si ça casse, on s'en rend compte trois jours plus tard, par les clients.

Le second est le plus délicat, parce que le modèle de fulfillment de Shopify a changé et que beaucoup de tutoriels en circulation décrivent l'ancien.

### A.2 REST est mort, utiliser GraphQL

L'API REST Admin de Shopify est **legacy depuis le 1er octobre 2024**. Depuis le **1er avril 2025**, toute nouvelle app publique doit être bâtie exclusivement sur l'**API GraphQL Admin**. Une app privée/custom peut techniquement encore appeler REST, mais c'est bâtir sur du sable.

**Décision : GraphQL Admin API uniquement.**

### A.3 Le modèle FulfillmentOrder

Le point à comprendre avant de coder : **on ne « fulfille » plus une commande, on fulfille des `FulfillmentOrder`**.

```
Order  (la commande du client)
  └── FulfillmentOrder[]   ← créés AUTOMATIQUEMENT par Shopify, jamais manuellement
        └── FulfillmentOrderLineItem[]
              └── Fulfillment   ← ce que TU crées, avec le tracking
```

Un `FulfillmentOrder` = un groupe d'articles à expédier **depuis un même emplacement**. Une commande peut en avoir plusieurs : deux emplacements de stock, ou un article en ramassage en magasin et un autre à expédier.

> ⚠️ Piège : une commande avec plusieurs méthodes de livraison (expédition + ramassage) produit plusieurs `FulfillmentOrder` de natures différentes. **Ne jamais supposer une seule méthode par commande** — itérer sur tous les `FulfillmentOrder` et traiter chacun selon son type. C'est le bug classique du « split cart ».

### A.4 Renvoyer le tracking — la mutation

`fulfillmentCreateV2` (ou `fulfillmentCreate` selon la version d'API) :

```graphql
mutation fulfillmentCreateV2 {
  fulfillmentCreateV2(fulfillment: {
    notifyCustomer: false,          # ← voir A.6 : qui envoie l'email ?
    trackingInfo: {
      company: "Canada Post",
      number: "1562678",
      url: "https://..."
    },
    # Un seul appel peut couvrir plusieurs fulfillmentOrders,
    # à condition qu'ils soient sur la MÊME commande et au MÊME emplacement.
    lineItemsByFulfillmentOrder: [
      {
        fulfillmentOrderId: "gid://shopify/FulfillmentOrder/5012131971094",
        # Omettre fulfillmentOrderLineItems = fulfiller tous les articles restants.
        # Le fournir = fulfillment partiel.
        fulfillmentOrderLineItems: [
          { id: "gid://shopify/FulfillmentOrderLineItem/10907890253846", quantity: 3 }
        ]
      }
    ]
  }) {
    fulfillment { id status trackingInfo { company number url } }
    userErrors { field message }
  }
}
```

Mise à jour ultérieure du tracking (numéro corrigé, étiquette réémise) : **`fulfillmentTrackingInfoUpdate`** — ne pas recréer un fulfillment.

Ramassage en magasin : **`fulfillmentOrderLineItemsPreparedForPickup`**, pas `fulfillmentCreate`.

> `userErrors` n'est pas optionnel à traiter. Shopify renvoie un HTTP 200 avec des erreurs métier dedans. Un client GraphQL naïf considérera l'appel réussi.

### A.5 Scopes d'accès requis

Pour une app de type **order management** (ce qu'on bâtit) :

- `merchant_managed_fulfillment_orders`
- `third_party_fulfillment_orders`
- `read_orders`, `write_orders`
- `read_products`, `read_customers` (grille et catalogue)
- `read_locations` (mapping vers les entrepôts internes)

Et il faut satisfaire les **exigences Shopify sur les données client protégées** (protected customer data) — c'est une démarche d'approbation, pas seulement une case à cocher. À entamer tôt.

### A.6 Qui envoie l'email au client ?

À trancher avant la phase 6, sinon le client reçoit deux notifications d'expédition.

| Option | `notifyCustomer` | Conséquence |
|---|---|---|
| Shopify envoie | `true` | Le plus simple. Template géré dans Shopify, bilingue FR/EN natif. |
| Klaviyo envoie | `false` | Sur l'événement `Fulfilled` de Shopify. Cohérent avec le reste du marketing Lasclay. |
| Le nouvel outil envoie | `false` | Le plus de contrôle, le plus de travail (templates, délivrabilité, bilinguisme). |

**Recommandation : `notifyCustomer: false` + Klaviyo**, puisque Lasclay y gère déjà ses communications et ses versions FR/EN. Le nouvel outil pousse le tracking et ne s'occupe pas d'emails clients — ce qui supprime toute la section « Notifications & emails » de la phase 6 et simplifie sérieusement le build.

À valider en remplissant `99-config-lasclay.md` §9 : voir ce qui envoie réellement aujourd'hui.

### A.7 Import des commandes

Deux mécanismes, à combiner :

- **Webhooks** `orders/create`, `orders/updated`, `orders/cancelled`, `fulfillments/create` — pour la réactivité
- **Polling de rattrapage** sur `orders(query: "updated_at:>...")` — pour la fiabilité, parce qu'un webhook manqué est un webhook perdu

Upsert idempotent sur `(store_id, shopify_order_id)`. Ne jamais se fier au seul numéro de commande.

Vérifier les en-têtes de coût GraphQL (`throttleStatus`) et gérer le leaky bucket de Shopify — c'est un modèle de coût par requête, pas un compteur de requêtes.

---

## Partie B — Expédier depuis le Canada

### B.1 Les transporteurs qui comptent

Pour Lasclay (Québec → Canada, États-Unis, international) :

| Transporteur | Usage typique | Disponible chez |
|---|---|---|
| **Postes Canada** | National, colis légers, régions éloignées, boîtes postales | Shippo, EasyPost, ShipEngine |
| **Purolator** | National express, volumes B2B | Shippo, EasyPost, ShipEngine |
| **UPS / FedEx / DHL** | International, États-Unis express | Tous |
| **Transporteurs régionaux QC** | Selon les tarifs négociés | Variable — à vérifier au cas par cas |

> Postes Canada est le seul à desservir correctement les boîtes postales et les régions nordiques. Si Lasclay expédie au Nunavut ou aux Territoires, aucune règle d'automatisation ne peut router ces commandes ailleurs.

### B.2 Ce qui diffère d'une intégration américaine

- **Poids volumétrique / dimensionnel** — le facteur diffère par transporteur et par zone. Le tarif dépend de `max(poids réel, poids volumétrique)`. À modéliser dans le service de tarification, pas dans l'UI.
- **Surcharges carburant** — pourcentage qui change chaque semaine. Si les tarifs sont affichés à l'utilisateur, ils doivent venir de l'API, jamais d'une table figée.
- **Zones tarifaires canadiennes** — logique différente des zones USPS.
- **Bilinguisme** — les étiquettes et documents douaniers pour la France, la Belgique et le Québec ; le nom du transporteur affiché au client.

### B.3 Douane — Canada → États-Unis et international

Le point où une erreur coûte cher, parce qu'elle bloque un colis à la frontière plutôt que de lever une exception.

- **Pays d'origine** ≠ pays d'expédition. La production Lasclay étant partiellement en Tunisie, le pays d'origine déclaré peut être `TN` alors que l'expédition part de `CA`. C'est le champ `origin_country` de chaque `CustomsItem`, pas celui de l'expédition.
- **ACEUM / CUSMA** — un traitement préférentiel s'applique aux biens d'origine canadienne vers les États-Unis et le Mexique. Un produit fabriqué en Tunisie n'y a **pas** droit. Se tromper, c'est déclarer faux.
- **Codes SH (HS codes)** — obligatoires par article. Les fibres textiles et l'asclépiade transformée relèvent de positions spécifiques `[à vérifier avec un courtier en douane — ne pas deviner]`.
- **De minimis américain** — seuil de franchise historiquement bas et sujet à changements réglementaires fréquents. `[à vérifier à la date du build]`
- **IOSS** — requis pour vendre en UE sous 150 €.
- **Incoterms DDP vs DDU/DAP** — DDP (droits payés par Lasclay) donne une bien meilleure expérience client mais doit être répercuté dans le prix. Décision commerciale, pas technique — mais elle doit être un paramètre du système, par destination.
- **TPS/TVQ** — l'expédition n'est pas neutre fiscalement. Voir le skill `bookkeeping-lasclay` pour le traitement comptable des frais de port et des droits de douane.

### B.4 Conformité — Loi 25

Le système stocke des noms, adresses, courriels et téléphones de clients québécois. La **Loi 25** s'applique :

- Politique de conservation explicite (combien de temps garde-t-on une adresse de livraison ?)
- Capacité de suppression sur demande — à prévoir dans le schéma dès le départ, pas après coup
- Registre des incidents de confidentialité
- Si l'hébergement est hors Québec, évaluation des facteurs relatifs à la vie privée

C'est plus léger à traiter au moment du design du schéma qu'à rajouter sur une base en production.

---

## Sources

- [Build fulfillment solutions — Shopify](https://shopify.dev/docs/apps/build/orders-fulfillment/order-management-apps/build-fulfillment-solutions)
- [Build for fulfillment services — Shopify](https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps/build-for-fulfillment-services)
- [FulfillmentOrder resource (note de dépréciation REST)](https://shopify.dev/docs/api/admin-rest/latest/resources/fulfillmentorder)
- [ShipStation API Carriers Canada — ShipEngine](https://help.shipengine.com/hc/en-us/articles/19372351447963-ShipStation-API-Carriers-Canada)
- [Purolator Canada Guide — ShipEngine](https://www.shipengine.com/docs/carriers/purolator-canada/)
- [Canada Post — ShipEngine](https://help.shipengine.com/hc/en-us/articles/4406863384091-Canada-Post)
- [Purolator Guide — EasyPost](https://docs.easypost.com/carriers/purolator-guide)
- [Canada Post API — Shippo](https://goshippo.com/carriers/canada-post-api)
