# Migration ShipStation → clone : ce qui suit, et ce qui ne suit pas

Audit exhaustif des 21 actions de lecture de l'API v1, chacune sondée sur le compte réel. Le
tableau dit ce que la migration récupère, et — plus important — **ce que l'API ne donne pas**,
pour que rien ne soit découvert le jour de la bascule.

**À faire avant toute résiliation.** L'accès API disparaît avec l'abonnement ; passé ce point,
l'historique n'est plus récupérable.

---

## 1. Ce que la migration récupère

| Objet | Source | Détail |
|---|---|---|
| **Commandes** | `orders` × 5 statuts | tous statuts, toutes pages : en attente de paiement, à expédier, en attente, expédiées, annulées |
| **Articles** | inclus | SKU, nom, quantité, prix, poids, emplacement, UPC, lignes d'ajustement |
| **Tags de commande** | `tagIds` | rattachés aux commandes, plus le référentiel des tags |
| **Champs personnalisés** | `advancedOptions` | `customField1..3`, source, entrepôt, options avancées |
| **Expéditions** | `shipments` | suivi, transporteur, service, colis, coût, assurance, annulations, retours |
| **Articles expédiés** | `shipmentItems` | rattachés aux lignes de commande — distingue une expédition partielle |
| **Lots** | reconstitués | ShipStation n'expose pas les lots, mais chaque expédition porte son `batchNumber` : ils sont reconstruits et l'historique redevient consultable |
| **Fulfillments** | `fulfillments` | les envois marqués expédiés hors étiquette ShipStation — 42 % du flux historique |
| **Produits** | `products` | poids, dimensions, douane, code SH, pays d'origine, emplacement, **défauts d'expédition** |
| **Clients** | `customers` + agrégats | fiches ShipStation (téléphone, adresse) **plus** les compteurs recalculés depuis les commandes |
| **Transporteurs** | `carriers` | comptes, soldes, contrat direct ou portefeuille |
| **Services** | `listservices` × transporteur | catalogue complet des `serviceCode` |
| **Types de colis** | `listpackages` × transporteur | catalogue des `packageCode` |
| **Boutiques** | `stores` | canal, état, auto-refresh, dernier import |
| **Entrepôts** | `warehouses` | adresse d'origine **et** de retour |
| **Utilisateurs** | `users` | pour que l'historique garde qui a fait quoi |
| **Webhooks** | `webhooks` | abonnements existants, importés **désactivés** |
| **Marketplaces** | `marketplaces` | catalogue des canaux intégrables |

**Statistiques** : rien à migrer — elles se recalculent. Une fois commandes et expéditions en
base, l'onglet Analytique reproduit les mêmes chiffres. Vérifié : l'écart au tarif drop-off
calculé par le clone retombe au dollar près sur celui de l'audit.

---

## 2. Ce que l'API ShipStation ne donne pas

Ces objets **n'existent nulle part dans l'API v1**. Aucun outil ne peut les extraire — ni le
clone, ni un autre. Ils sont à recréer à la main, une fois.

| Objet | Pourquoi | Où le refaire |
|---|---|---|
| **Règles d'automatisation** | aucun point de terminaison | onglet Automatisation |
| **Vues sauvegardées** | aucun point de terminaison | bouton « Sauver la vue » sur la grille |
| **Groupes de préréglages** | aucun point de terminaison | Produits → groupes |
| **Gabarits de bordereau et de courriel** | aucun point de terminaison | onglet Gabarits |
| **Paramètres de marque** | aucun point de terminaison | Réglages → Marque |
| **Configuration des notifications** | aucun point de terminaison | Gabarits + Réglages |
| **Manifestes passés** | aucun point de terminaison | sans objet — on repart à zéro |

**Les défauts produit, eux, migrent** : `defaultCarrierCode`, `defaultServiceCode`,
`defaultPackageCode` et les champs de douane viennent avec chaque fiche. C'est le gros du travail
de préréglage. Seuls les *groupes* de préréglages sont perdus.

### Combien de travail, concrètement

Pour Lasclay, d'après l'audit : les **6 tags** migrent, les **règles** sont à retranscrire —
le clone en livre cinq de départ, désactivées, dont « Drop-off sous 500 g » —, et les **vues**
sont à recréer selon les habitudes de chacun. Le compte n'utilisait aucun groupe de préréglages
ni gabarit personnalisé au moment de l'audit.

Le plus sûr est de **faire des captures d'écran de vos règles et vues dans ShipStation avant de
résilier**, puis de les retranscrire. C'est une heure de travail, pas une journée.

---

## 3. Lancer la migration

**Réglages → Lancer la migration**, ou en ligne de commande :

```js
require("./lib/ingest").migrerDepuisShipStation({ depuis: null });   // null = tout l'historique
```

Compter quelques minutes : la limite de ShipStation est de 40 requêtes par minute, et
l'historique de Lasclay représente environ 90 pages de 500 enregistrements.

La migration est **rejouable**. Les commandes sont mises à jour par `order_key`, pas dupliquées.
On peut donc migrer une première fois pour vérifier, puis relancer juste avant la bascule pour
rattraper les derniers jours.

Chaque étape qui échoue est **absorbée** : un objet indisponible n'interrompt pas le reste, et le
bilan final dit ce qui n'est pas passé.

---

## 4. Après la migration

L'import Shopify prend le relais pour les **nouvelles** commandes :

1. Réglages → **Abonner aux webhooks** — Shopify appelle le clone à chaque commande créée,
   modifiée ou annulée, chaque appel vérifié par signature HMAC.
2. Un **rattrapage** tourne toutes les vingt minutes et comble ce qu'un webhook manqué aurait
   laissé passer. Un webhook perdu ne coûte pas une commande.
3. La clé d'identification est la même des deux côtés (`order_key` = identifiant Shopify) :
   une commande migrée depuis ShipStation et la même commande reçue de Shopify **convergent**
   au lieu de se dupliquer.

Les règles d'automatisation ne s'appliquent qu'à **l'arrivée** d'une commande, jamais sur une
commande déjà connue : un choix fait à la main dans la grille ne se fait pas écraser par un
rattrapage.
