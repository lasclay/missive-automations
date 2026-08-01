# 13. Machines à états (commande, expédition, batch, retour)

> Extrait de la spec ShipStation — Lasclay. Voir `00-INDEX.md` pour la carte complète.
> Libellés d'UI en anglais (langue source du produit). `[à vérifier]` = non confirmé par une source officielle.

# 5. Machines à états

## 5.1 Cycle de vie d'une commande (v1)

```
                        ┌────────────────────────────────────────────┐
                        │            IMPORT / CREATE ORDER           │
                        └───────────────┬────────────────────────────┘
                                        │
                     ┌──────────────────┴───────────────────┐
             non payé│                                      │payé / prêt
                     ▼                                      ▼
          ┌────────────────────┐                 ┌────────────────────┐
          │  awaiting_payment  │ ──paiement reçu►│ awaiting_shipment  │◄───┐
          │                    │  (ou "mark as   │                    │    │
          │                    │      paid")     │                    │    │
          └─────────┬──────────┘                 └──┬────┬────┬───────┘    │
                    │                               │    │    │            │
                    │ hold                          │    │    │ hold /     │
                    │                               │    │    │ règle auto │
                    ▼                               │    │    ▼            │
          ┌────────────────────┐                    │    │  ┌───────────┐  │
          │      on_hold       │◄───────────────────┘    │  │  on_hold  │  │
          │ (holdUntilDate)    │                         │  └─────┬─────┘  │
          └─────────┬──────────┘                         │        │        │
                    │  restoreorder OU date atteinte     │        └────────┘
                    └────────────────────────────────────┘   (retour auto à
                                                              awaiting_shipment
                                        ┌───────────────┐      à holdUntilDate)
                                        │               │
             createlabelfororder        │               │  envoi au
             OU markasshipped           │               │  prestataire
                                        ▼               ▼
                              ┌──────────────┐  ┌─────────────────────┐
                              │   shipped    │  │ pending_fulfillment │
                              └──────────────┘  └────┬───────────┬────┘
                                      ▲              │           │
                                      │              │ expédié   │ rejeté
                                      └──────────────┘           ▼
                                    (FULFILLMENT_SHIPPED)  ┌──────────────────────┐
                                                           │ rejected_fulfillment │
                                                           └──────────────────────┘

   Depuis N'IMPORTE QUEL statut ──► cancelled  (DELETE /orders/{id} ou action UI)
```

**Règles de transition à répliquer :**
1. `awaiting_payment → awaiting_shipment` : automatique à réception du paiement, ou manuel (« mark as paid »).
2. `holdUntilDate` atteinte → **retour automatique** à `awaiting_shipment` (ou `awaiting_payment` si toujours non payée).
3. `awaiting_shipment → shipped` : automatique dès l'impression d'une étiquette. Aucune étape intermédiaire.
4. **`cancelled` dans ShipStation ne propage PAS l'annulation au canal de vente.** Il faut annuler à la source ; ShipStation reflétera l'annulation au prochain import. C'est une asymétrie volontaire, mais source de bugs — à décider explicitement dans la réplication.
5. `DELETE /orders/{orderId}` est un **soft delete** : la commande passe en `cancelled`, elle n'est pas supprimée.
6. Fusion/scission : les commandes fusionnées portent `mergedOrSplit=true` + `mergedIds[]` ; les commandes scindées portent `parentId`.

## 5.2 Cycle de vie d'une expédition / étiquette

### v1
```
   (aucun objet Shipment)
            │
            │ POST /shipments/createlabel
            │ OU POST /orders/createlabelfororder
            ▼
   ┌──────────────────────────┐
   │ Shipment  voided=false   │───► trackingNumber attribué
   │ labelData (PDF base64)   │     marketplaceNotified: false → true
   └────────────┬─────────────┘
                │ POST /shipments/voidlabel
                ▼
   ┌──────────────────────────┐
   │ Shipment  voided=true    │
   │ voidDate renseignée      │
   └──────────────────────────┘
```

### v2 (bien plus riche)
```
  Shipment: pending ──► processing ──► label_purchased
                                            │
                                            │ cancel
                                            ▼
                                        cancelled

  Label:  ┌──────────────┐ traitement asynchrone
          │  processing  │──────────┐
          └──────┬───────┘          │ échec
                 │ succès           ▼
                 ▼             ┌─────────┐
          ┌──────────────┐     │  error  │
          │  completed   │     └─────────┘
          └──────┬───────┘
                 │ PUT /labels/{id}/void
                 ▼
          ┌──────────────┐
          │   voided     │  void_type: refund_assist | manual
          └──────┬───────┘
                 │
                 ▼  refund_details.refund_status :
       request_scheduled → pending → approved | rejected | excluded
                                        │
                                        │ POST /labels/{id}/cancel_refund
                                        ▼
                                  (annulation de la demande)

  tracking_status du label : unknown → in_transit → delivered
                                    └─────────────► error
```

**Point clé du `charge_event` :**
- `on_creation` → facturé immédiatement. **Il faut annuler l'étiquette non utilisée pour obtenir un remboursement.** Défaut pour USPS et transporteurs ShipStation.
- `on_carrier_acceptance` → facturé au scan par le transporteur. Pas de charge si non utilisée, donc pas besoin d'annuler. Nécessite l'accord du transporteur.
- `carrier_default` → comportement standard du transporteur.

## 5.3 Cycle de vie d'un batch (v2)

```
   POST /v1/batches
          │
          ▼
   ┌────────────┐  add / remove d'expéditions autorisés
   │    open    │◄──────────────────────────┐
   └─────┬──────┘                           │
         │ POST /batches/{id}/process/labels │
         ▼                                   │
   ┌────────────┐                            │
   │   queued   │                            │
   └─────┬──────┘                            │
         ▼                                   │
   ┌────────────┐   ┌──────────┐             │
   │ processing │──►│ invalid  │  (lot rejeté)
   └─────┬──────┘   └──────────┘             │
         │                                   │
         ├──────────────┬────────────────────┘
         ▼              ▼
   ┌────────────┐  ┌────────────────────────┐
   │ completed  │  │ completed_with_errors  │
   └─────┬──────┘  └────────────┬───────────┘
         │                      │
         │  webhook `batch`     │  GET /batches/{id}/errors
         ▼                      ▼
   ┌────────────┐
   │ notifying  │  (envoi de la notification webhook)
   └─────┬──────┘
         │  DELETE /batches/{id}
         ▼
   ┌────────────┐
   │  archived  │  (le lot ne peut plus être modifié)
   └────────────┘
```

Une fois quitté `open`, le lot ne peut plus être modifié (erreur `batch_cannot_be_modified`). Compteurs de suivi : `completed`, `errors`, `warnings`, `forms`, `count = errors + warnings + completed`.

## 5.4 Cycle de vie d'un retour

```
  ┌──────────────────────────────────────────────────────────┐
  │ 3 points d'entrée                                        │
  │  A. Returns Portal (self-service client)                 │
  │  B. Retours importés depuis le canal de vente            │
  │  C. Retour manuel créé dans ShipStation                  │
  └───────────────────────┬──────────────────────────────────┘
                          ▼
                  ┌───────────────┐
                  │      RMA      │  (enregistrement proche d'une commande :
                  │   créé/ouvert │   contient étiquette + articles retournés)
                  └───────┬───────┘
                          │
              ┌───────────┴─────────────┐
              │ 2 méthodes de création  │
              │  1) POST /v2/labels     │
              │     is_return_label:true│
              │     + rma_number        │
              │     + outbound_label_id │
              │     (ship_from = client,│
              │      ship_to = entrepôt)│
              │  2) POST /v2/labels/    │
              │     {label_id}/return   │
              │     (inverse auto les   │
              │      adresses)          │
              └───────────┬─────────────┘
                          ▼
                  ┌───────────────┐
                  │ Étiquette de  │  charge_event détermine
                  │ retour émise  │  la facturation
                  └───────┬───────┘
                          ▼
                  ┌───────────────┐
                  │ Client expédie│  suivi via tracking
                  └───────┬───────┘
                          ▼
                  ┌───────────────┐
                  │ Marqué reçu   │  action « mark as received »
                  └───────┬───────┘
                          ▼
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐      ┌──────────┐     ┌────────────┐
   │ Refund  │      │ Exchange │     │Store credit│
   └─────────┘      └──────────┘     └────────────┘
                    (Shopify seulement)
```

**Contraintes :** retours **domestiques uniquement** (pas d'international). Tous les transporteurs/services ne supportent pas les retours. Une étiquette de retour compte dans le quota mensuel d'expéditions.
`[à vérifier]` ShipStation n'expose pas d'enum public de statut de RMA — les statuts internes observables sont : ouvert / étiquette émise / en transit / reçu / clos.

---

<a name="6"></a>
