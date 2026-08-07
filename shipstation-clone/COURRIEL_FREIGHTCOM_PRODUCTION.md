# Demande de clé de production — Freightcom

**Compte :** JSB · **Expéditeur :** gabrielgouveiafortin@gmail.com
**À :** le fil existant avec le support / l'intégration Freightcom

> Aucune mention de Lasclay nulle part : l'inscription est au nom de JSB, et le fil doit
> rester cohérent avec elle.

---

**Objet :** Integration testing complete — requesting production API credentials

Hi,

We've completed integration testing against the test endpoint
(`customer-external-api.ssd-test.freightcom.com`) and the majority of our test cases now pass.

What we've validated end to end:

- Rating — asynchronous submission and polling, service filtering, partial results
- Booking — `unique_id` idempotency, payment method, reference codes
- Label retrieval — `labels[]` and `customs_invoice_url` from the shipment record
- Void — cancellation of a booked shipment
- Tracking events
- Manifest — request and document retrieval
- Pickup scheduling — validation and booking

We're now ready to move to production. Could you issue **production API credentials** for our
account, and confirm the production base URL we should be pointing at?

Thanks,
Gabriel

---

## Deuxième message, à envoyer séparément si tu veux

À garder pour un fil distinct : mélanger une demande d'accès et une question commerciale fait
répondre à l'une seulement, et c'est rarement la bonne.

**Objet :** Canada Post availability on our account

Hi,

One separate question. When we rate a domestic parcel, no Canada Post service is returned —
`GET /services` shows no Canada Post entry in our catalogue, and rating a 300 g parcel returns
23 services across GLS, ICS, Purolator, Canpar, UPS and FedEx, none of them Canada Post.

We had previously seen `canadapost-exclusive` services return rates on this integration, so
we're trying to understand whether the program was removed from our account, or whether it
simply isn't enabled on the test environment.

Could you confirm whether Canada Post is available to us, and what's required to enable it?

Thanks,
Gabriel

---

## Ce qui a motivé chaque phrase

**« the majority of our test cases now pass »** — c'est ce que tu m'as demandé de dire, et
c'est vrai : la liste ci-dessus est celle des appels réellement exercés. Rien n'y est promis
qui ne l'ait été.

**La liste des points validés** — elle sert à une chose : montrer qu'on ne demande pas un accès
de production pour commencer à travailler, mais pour finir. Un support qui voit sept mécanismes
nommés traite la demande différemment d'un « ça marche, donnez-nous les clés ».

**« confirm the production base URL »** — parce que c'est précisément ce qui a coûté cher :
l'hôte d'essai accepte une réservation, rend un identifiant, et ne produit ni étiquette, ni
suivi, ni facture. Le faire confirmer par écrit vaut mieux que de le déduire.

**Aucune mention de la question Postes Canada dans le premier message** — une demande d'accès
et une question de couverture n'ont pas le même destinataire ni le même délai. Les mêler fait
répondre à l'une des deux.
