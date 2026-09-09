# Portées Shopify — ce qu'il faut pour que le suivi remonte

Une étiquette achetée dans le clone doit produire chez Shopify une **exécution**
(*fulfillment*) portant le numéro de suivi : c'est ce que le client voit dans son courriel
et sur sa page de commande. Sans elle, le colis part et la boutique reste muette.

## Le symptôme

```
GraphQL: Access denied for fulfillmentOrders field.
```

Le message nomme un champ, pas un droit, et il tombe **après** l'achat de l'étiquette. Le
clone le traduit désormais lui-même, et l'écran Réglages ▸ Canaux de vente pose la question
à froid, avant d'expédier.

## Ce qu'il faut ajouter

Deux portées, sur l'app Shopify qui porte `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` :

```
read_merchant_managed_fulfillment_orders
write_merchant_managed_fulfillment_orders
```

**« merchant managed »** parce que Lasclay expédie depuis son propre entrepôt. Une boutique
qui déléguerait la préparation à un tiers aurait besoin de la paire `assigned` ou
`third_party` — ce n'est pas le cas ici.

Shopify a retiré l'ancien chemin d'exécution directe : tout passe par une *fulfillment
order*, y compris pour un envoi qu'on prépare soi-même. C'est pourquoi la lecture est
nécessaire en plus de l'écriture.

## La manœuvre

1. Admin Shopify → **Paramètres ▸ Apps et canaux de vente ▸ Développer des apps**.
2. Ouvrir l'app, onglet **Configuration** → **Admin API access scopes**.
3. Cocher les deux portées ci-dessus, **Enregistrer**.
4. Onglet **Versions de l'API** → **Créer une version** (les portées ne prennent effet
   qu'à la publication).
5. **Réinstaller** l'app sur la boutique — c'est l'étape qu'on oublie, et sans elle le jeton
   continue de porter les anciennes portées.

Aucune variable d'environnement à changer : le jeton est court et se renouvelle seul, il
reprendra les nouvelles portées au prochain cycle.

## Vérifier

Réglages ▸ Canaux de vente affiche en tête soit « Portées Shopify d'expédition accordées »,
soit la liste de ce qui manque. En ligne de commande :

```
node -e 'require("./lib/channels").CANAUX.shopify.verifierPortees().then(console.log)'
```

Puis, sur une commande déjà expédiée : le rail d'expéditions porte **Renvoyer le suivi**.
Il passe outre la date de bascule — c'est le geste de rattrapage.

## Pourquoi la date de bascule ne bloque plus les achats du clone

Elle existe pour ne pas réécrire à des clients dont ShipStation a déposé le suivi il y a des
mois, et ne concerne donc que les expéditions rapatriées par la migration. Une étiquette
achetée ici n'a jamais été notifiée par personne : elle remonte toujours. Voir
`verifier_canaux.js`.
