# Courriel à Freightcom — questions d'intégration API

À : support technique Freightcom / ClickShip
Objet : `Rate discrepancy between API and ClickShip, and three API questions`

Sans présentation de l'entreprise, sans volumes, sans mention des contrats en cours : le
contenu est purement technique et se suffit. Les chiffres cités sont ceux d'une cotation, pas
de l'activité.

---

Hello,

We are integrating directly against the Freightcom Customer API (spec 2.10.0). Rating and
booking both work — thank you for the clear specification. Four things came up that we cannot
resolve from our side.

## 1. The API returns higher rates than ClickShip for the same shipment — but only for some carriers

Same shipment, quoted the same day through `POST /rate` and through the ClickShip web
interface:

- Origin: Québec, QC — G1J 3R4
- Destination: Gatineau, QC — J8Y 6E1, **Residential Address checked in both**
- Package: 9 × 5 × 2 in, 0.22 lb, single piece, no special handling

| Carrier | ClickShip web | API `/rate` total | Difference |
|---|---:|---:|---:|
| Canada Post Exclusive Program | $7.28 | $7.28 | identical |
| ICS Courier | $14.92 | $14.92 | identical |
| GLS Ground | $10.01 | $11.06 | +10.5% |
| UPS Standard | $13.72 | $15.17 | +10.6% |
| Canpar Ground | $17.95 | $19.70 | +9.8% |
| Purolator Ground | $19.85 | $21.91 | +10.4% |

Two carriers match to the cent; four are about 10% higher through the API.

We have ruled out the obvious explanations on our side. It is not taxes — the API breakdown
shows GST and QST at the expected 14.975%, and the carriers that match include them too. It is
not the residential flag — it is set on both sides. It is not weight or dimensions — those are
identical, and a difference there would not leave two carriers untouched.

**Are negotiated rates applied differently depending on the channel (API vs web)?** If there is
a parameter we should be sending on `POST /rate` to obtain the same rates, please tell us which
one.

For reference, the API breakdown for GLS Ground on that shipment:

```
base                 6.66
fuel                 2.41
residential-delivery 0.55
tax-gst-qc           0.48
tax-qst-qc           0.96
total               11.06
```

## 2. `GET /services` returns an empty list

The endpoint responds 200 in 238 ms with `{"services": []}`, while `POST /rate` on the same
account returns 20 to 22 rates across 153 services searched. We expected the catalogue endpoint
to let us pre-select a service subset (the `services[]` field on `/rate`) in order to shorten
quote times.

Is this endpoint populated per account? If so, what activates it?

## 3. No Canada Post service above 500 g

We swept the same shipment across nine weights, from 100 g to 5 kg:

| Weight | Rates returned | Canada Post services |
|---|---:|---|
| 100 g | 20 | `canadapost-exclusive.expedited-parcel` $6.61 |
| 400 g | 20 | `canadapost-exclusive.expedited-parcel` $6.84 |
| 480 g | 20 | `canadapost-exclusive.expedited-parcel` $6.84 |
| 505 g | 19 | none |
| 1 kg | 19 | none |
| 5 kg | 19 | none |

Canada Post disappears entirely above the Exclusive Program threshold and never returns — no
Expedited Parcel, no Xpresspost, no Priority. Exactly one service drops out of the panel.

**Can regular Canada Post services be enabled on the account?** Above 500 g there is currently
no Canada Post option at all.

## 4. No field for delivery confirmation

We could not find any field in the 2.10.0 specification — on `POST /rate` or `POST /shipment` —
to request a delivery confirmation: signature required, proof of age, or Canada Post's **Do Not
Safe Drop**.

**Is this configurable at the account level, or is there an accessorial field we have missed?**

## Minor observation

On the same quote, UPS Standard returns no `fuel` line at all, while GLS, ICS, Canpar and
Canada Post each carry one. Its base ($13.19) and total ($15.17) differ only by taxes. Is fuel
included in the UPS base rate, or is the line missing?

---

We can provide the full JSON request and response for any of the above, or a rate request ID if
that is easier to trace on your side.

Thank you.
