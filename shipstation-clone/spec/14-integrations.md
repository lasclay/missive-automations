# 14. Modèle d'intégration (import, custom store XML, mapping, tracking)

> Extrait de la spec ShipStation — Lasclay. Voir `00-INDEX.md` pour la carte complète.
> Libellés d'UI en anglais (langue source du produit). `[à vérifier]` = non confirmé par une source officielle.

# 6. Modèle d'intégration

## 6.1 Polling vs Webhook

ShipStation utilise **les deux, pour des directions différentes** :

| Direction | Mécanisme | Détail |
|---|---|---|
| Canal de vente → ShipStation | **Polling** (`autoRefresh`) | ShipStation appelle périodiquement chaque boutique. Déclenchement manuel possible via `POST /stores/refreshstore`, statut via `GET /stores/getrefreshstatus`. `refreshDate` permet de rejouer l'historique |
| ShipStation → votre système | **Webhook** | Notification « thin » avec `resource_url` à rappeler |
| ShipStation → canal de vente | **Push (shipnotify)** | Écriture retour du tracking |

**Modèle de polling à répliquer :**
```
pour chaque store où active = true et autoRefresh = true :
    si (now - store.refreshDate) > intervalle_du_plan :
        appeler l'intégration avec [lastSuccessfulRefresh, now]
        upsert des commandes par (store_id, order_key)
        store.lastRefreshAttempt = now
        si succès : store.refreshDate = now
```
L'intervalle dépend du plan tarifaire (typiquement 15 min à 1 h). `[à vérifier]`

## 6.2 Custom Store Integration (XML) — spécification complète

C'est le contrat d'intégration générique : le marchand héberge un endpoint HTTP, ShipStation l'appelle. **C'est le mécanisme le plus important à répliquer** si l'on veut une plateforme ouverte.

### Contrat d'URL

**Export de commandes (GET) :**
```
GET [votre_endpoint]?action=export&start_date=[MM/dd/yyyy HH:mm]&end_date=[MM/dd/yyyy HH:mm]&page=1
```
**Notification d'expédition (POST) :**
```
POST [votre_endpoint]?action=shipnotify&order_number=[…]&carrier=[…]&service=[…]&tracking_number=[…]
```

### Authentification
**Basic HTTP Authentication** — ShipStation envoie les identifiants configurés dans les réglages de la boutique.

### Réponse `action=export` — schéma XML complet

```xml
<?xml version="1.0" encoding="utf-8"?>
<Orders pages="3">
  <Order>
    <OrderID>string, requis</OrderID>
    <OrderNumber>string, max 50, requis</OrderNumber>
    <OrderDate>MM/dd/yyyy HH:mm, requis</OrderDate>
    <OrderStatus>string, max 50, requis</OrderStatus>
    <LastModified>MM/dd/yyyy HH:mm, requis</LastModified>
    <ShippingMethod>string, max 100</ShippingMethod>
    <PaymentMethod>string, max 50</PaymentMethod>
    <CurrencyCode>ISO 4217, requis</CurrencyCode>
    <OrderTotal>decimal(9,2), requis</OrderTotal>
    <TaxAmount>decimal(9,2)</TaxAmount>
    <ShippingAmount>decimal(9,2), requis</ShippingAmount>
    <CustomerNotes><![CDATA[string, max 1000]]></CustomerNotes>
    <InternalNotes><![CDATA[string, max 1000]]></InternalNotes>
    <Gift>boolean</Gift>
    <GiftMessage><![CDATA[string, max 1000]]></GiftMessage>
    <CustomField1>string, max 100</CustomField1>
    <CustomField2>string, max 100</CustomField2>
    <CustomField3>string, max 100</CustomField3>
    <RequestedWarehouse>string, max 100</RequestedWarehouse>
    <Source>string, max 50</Source>
    <Dimensions>
      <DimensionUnits>Inch | Centimeter</DimensionUnits>
      <Length>decimal(9,2)</Length>
      <Width>decimal(9,2)</Width>
      <Height>decimal(9,2)</Height>
    </Dimensions>
    <Customer>                                  <!-- requis -->
      <CustomerCode>string, max 50, requis</CustomerCode>
      <BillTo>                                  <!-- requis -->
        <Name>string, max 100, requis</Name>
        <Company>string, max 100</Company>
        <Phone>string, max 50</Phone>
        <Email>string, max 100</Email>
      </BillTo>
      <ShipTo>                                  <!-- requis -->
        <Name>string, max 100, requis</Name>
        <Company>string, max 100</Company>
        <Address1>string, max 200, requis</Address1>
        <Address2>string, max 200</Address2>
        <City>string, max 100, requis</City>
        <State>string, max 100, requis pour US/CA</State>
        <PostalCode>string, max 50, requis</PostalCode>
        <Country>ISO 3166-1 alpha-2, requis</Country>
        <Phone>string, max 50</Phone>
      </ShipTo>
    </Customer>
    <Items>                                     <!-- requis -->
      <Item>                                    <!-- illimité -->
        <LineItemID>string, max 50</LineItemID>
        <SKU>string, max 50, requis</SKU>
        <Name>string, max 200, requis</Name>
        <ImageUrl>string, max 500</ImageUrl>
        <Weight>decimal(9,2)</Weight>
        <WeightUnits>Pounds | Ounces | Grams</WeightUnits>
        <Quantity>integer, requis</Quantity>
        <UnitPrice>decimal(9,2), requis</UnitPrice>
        <UPC>string, max 12</UPC>
        <Location>string, max 100</Location>
        <Adjustment>boolean</Adjustment>
        <Options>
          <Option>                              <!-- max 100 par article -->
            <Name>string, max 100, requis</Name>
            <Value>string, max 100, requis</Value>
            <Weight>decimal(9,2)</Weight>
          </Option>
        </Options>
      </Item>
    </Items>
  </Order>
</Orders>
```

**Encodage :** tous les champs texte libre doivent être encapsulés dans une section `<![CDATA[ … ]]>`.

### Requête `action=shipnotify` — corps XML

```xml
<?xml version="1.0" encoding="utf-8"?>
<ShipNotice>
  <OrderNumber>string, max 50</OrderNumber>
  <OrderID>string, max 50</OrderID>
  <CustomerCode>string, max 50</CustomerCode>
  <CustomerNotes>string, max 1000</CustomerNotes>
  <InternalNotes>string, max 1000</InternalNotes>
  <NotesToCustomer>string, max 1000</NotesToCustomer>
  <NotifyCustomer>boolean</NotifyCustomer>
  <LabelCreateDate>MM/dd/yyyy HH:MM (UTC)</LabelCreateDate>
  <ShipDate>MM/dd/yyyy</ShipDate>
  <Carrier>string, max 50</Carrier>
  <Service>string, max 50</Service>
  <TrackingNumber>string, max 50</TrackingNumber>
  <ShippingCost>decimal(9,2)</ShippingCost>
  <CustomField1>string</CustomField1>
  <CustomField2>string</CustomField2>
  <CustomField3>string</CustomField3>
  <Recipient>
    <Name>string, max 100</Name>
    <Company>string, max 100</Company>
    <Address1>string, max 200</Address1>
    <Address2>string, max 200</Address2>
    <City>string, max 100</City>
    <State>string</State>
    <PostalCode>string, max 50</PostalCode>
    <Country>ISO 2</Country>
  </Recipient>
  <Items>
    <Item>
      <LineItemID>string, max 50</LineItemID>
      <SKU>string, max 100</SKU>
      <Name>string, max 200</Name>
      <Quantity>integer</Quantity>
      <UPC>string</UPC>
    </Item>
  </Items>
</ShipNotice>
```

**Réponse attendue :** HTTP 200 (ou 2xx).

### Pagination XML
L'attribut `pages` sur `<Orders>` indique le nombre total de pages. Si `pages > 1`, ShipStation redemande automatiquement les pages suivantes (`&page=2`, `&page=3`…). Le développeur choisit le nombre d'enregistrements par page.

### Formats de date
- Date‑heure : `MM/dd/yyyy HH:mm` (24 h), **UTC assumé** si non précisé
- Date seule : `MM/dd/yyyy`
- Les notations 12 h et 24 h sont acceptées en lecture pour `OrderDate`

> **Incohérence à noter :** le custom store utilise UTC et `MM/dd/yyyy`, alors que l'API v1 JSON utilise PST/PDT et `yyyy-mm-dd`. Deux conventions de temps différentes dans le même produit.

## 6.3 Mapping de statuts

Chaque boutique porte une table `statusMappings` : `orderStatus` (canonique ShipStation) ↔ `statusKey` (vocabulaire du canal). **Les valeurs sont sensibles à la casse.**

Catégories mappables lors de la configuration d'un custom store :
- **Unpaid** — non payée, pas prête à expédier → `awaiting_payment`
- **Paid** — payée, prête à expédier → `awaiting_shipment`
- **Shipped** → `shipped`
- **Cancelled** → `cancelled`
- **On‑Hold** → `on_hold`

Le drapeau `supportsCustomMappings` du Marketplace indique si le canal supporte cette personnalisation ; `supportsCustomStatuses` indique s'il accepte des statuts arbitraires.

## 6.4 Écriture retour du tracking vers la marketplace

Deux chemins :

1. **Custom store** → POST `action=shipnotify` (voir §6.2)
2. **Intégrations natives** → appel API propre au canal, piloté par :
   - `Marketplace.canConfirmShipments` (le canal supporte‑t‑il la confirmation ?)
   - `Shipment.marketplaceNotified` (booléen — la notification a‑t‑elle été envoyée ?)
   - `Shipment.notifyErrorMessage` (message d'erreur si l'envoi a échoué)
   - `markasshipped.notifySalesChannel` / `notifyCustomer` (contrôle explicite par appel)

**À répliquer : une file de notification avec réessai**, car `marketplaceNotified` + `notifyErrorMessage` impliquent un traitement asynchrone avec états d'échec persistés.

## 6.5 Boutiques supportées

`GET /stores/marketplaces` retourne la liste dynamique. Confirmés : Manual (0), Amazon (2), 3DCart (23), Amazon CA (32), WooCommerce (36), Shopify. Les codes v2 `order_source_code` donnent une seconde liste (20 valeurs, §4.10). ShipStation revendique 100+ intégrations réparties en 4 catégories : *Stores & Shopping Carts*, *Marketplaces*, *Listing Tools & Multichannel*, *Ecommerce Tools*.

---

<a name="7"></a>
