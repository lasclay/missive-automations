# 16. Pièges connus & écarts d'implémentation

> Extrait de la spec ShipStation — Lasclay. Voir `00-INDEX.md` pour la carte complète.
> Libellés d'UI en anglais (langue source du produit). `[à vérifier]` = non confirmé par une source officielle.

# 8. Pièges connus et écarts d'implémentation

1. **Fuseau horaire v1** — toutes les dates de l'API v1 sont en PST/PDT sans indicateur de fuseau, alors que le custom store XML est en UTC. Deux conventions dans le même produit. **Recommandation : tout stocker en `timestamptz` UTC et convertir en sortie.**

2. **`createorder` est un upsert destructif** — sans `orderKey`, chaque appel crée une nouvelle commande. Avec `orderKey`, l'appel écrase l'intégralité de la commande : les champs omis sont réinitialisés, pas conservés. Il n'y a pas de PATCH.

3. **`customsItems` peut être écrasé** — ShipStation régénère les lignes douanières sauf si le réglage UI « International Settings » est sur *Leave blank (Enter Manually)*. Un comportement dépendant d'un réglage d'interface est un anti‑pattern à ne pas reproduire.

4. **`GET /shipments` n'inclut pas les « Mark as Shipped »** — ces commandes créent un `Fulfillment`, pas un `Shipment`. Pour un état complet des expéditions, il faut interroger les **deux** ressources et les fusionner.

5. **Webhooks « thin »** — le payload ne contient qu'un `resource_url`. Rappeler l'API consomme le quota de 40 req/min, ce qui peut créer une boucle de saturation en cas de pic. **Recommandation : payload complet, avec `resource_url` en complément.**

6. **`resource_url` limité à 200 caractères** — contrainte arbitraire qui casse sur les URLs à nombreux paramètres.

7. **Webhooks non modifiables par API** — créables et supprimables par API, mais modifiables uniquement par l'UI. Incohérence à ne pas reproduire.

8. **L'annulation ne se propage pas au canal** — `cancelled` dans ShipStation n'annule rien chez le marchand. À décider explicitement (propager, ou documenter clairement l'asymétrie).

9. **`addressVerified` v1 est du texte libre** — libellés en anglais complet plutôt qu'un enum machine. v2 a corrigé (`unverified`/`verified`/`warning`/`error`). Adopter v2.

10. **`billing_source` en PascalCase** (`Carrier`, `DutiesTax`) au milieu d'une API entièrement snake_case.

11. **`fullfilment_sku`** — faute de frappe présente dans le schéma v2 (`Item.fullfilment_sku`), alors que `fulfillment_sku` correct existe ailleurs. À normaliser dans la réplication.

12. **Une Manual Store active est requise** pour `POST /shipments/createlabel`, sinon HTTP 500 (et non 400). Erreur non actionnable.

13. **`toState` requis pour UPS seulement** sur `getrates` — validation conditionnelle par transporteur, non déclarative.

14. **Retours domestiques uniquement** — pas de retour international, toutes APIs confondues.

15. **Pas d'idempotency key** — ni v1 ni v2 n'exposent d'en‑tête `Idempotency-Key`. Sur `createlabel`, un timeout réseau peut produire une double facturation. **À ajouter dans une alternative maison.**

16. **Pas d'historique de statut exposé** — impossible de savoir quand une commande a changé de statut, ni par qui.

17. **Base URL v2 ambiguë** — la doc mentionne `https://api.shipstation.com/v2` en introduction, mais les chemins de la spec OpenAPI sont en `/v1/...` (héritage ShipEngine). Les deux hôtes servent la même API. `[à vérifier]` sur un compte réel avant implémentation.

---

<a name="9"></a>
