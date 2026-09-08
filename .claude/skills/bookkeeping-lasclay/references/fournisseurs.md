# Fournisseurs récurrents de Lasclay

Table de référence pour le classement dans Dext. Établie le 29 juillet 2026 à partir de
l'historique réel de QBO. À enrichir au fil des sessions.

## Comment lire ce tableau

- **Devise QBO** : la devise dans laquelle la transaction est enregistrée dans QBO. `USD`
  veut dire que QBO stocke le montant en USD avec un `ExchangeRate`, donc le taux est
  visible et vérifiable. `CAD` veut dire que le montant CAD de Dext devient directement le
  montant comptabilisé, sans trace du taux : c'est là que les erreurs de conversion passent
  inaperçues.
- **Publier comme** : détermine si la pièce devient un `Bill` ou un `Purchase` dans QBO. Se
  tromper casse le rapprochement bancaire.

## Logiciels et services

| Fournisseur | Compte de charge | Code de taxe | Devise QBO | Publier comme |
|-------------|------------------|--------------|-----------|---------------|
| Anthropic | 6401 Administration et RH:Logiciels Admin et RH | TPS/TVQ QC - 9,975 | **CAD** | Facture fournisseur |
| A2X | 6401 Administration et RH:Logiciels Admin et RH | TPS | USD | Facture fournisseur |
| Klaviyo | 6334 Marketing:Email | Exonéré | USD | Carte de Crédit |
| ShipStation | 6230 Frais de vente:Logiciel d'expédition de colis | **TPS** | **CAD** | Carte de Crédit |
| Render | 6401 Administration et RH:Logiciels Admin et RH | Exonéré | USD | Carte de Crédit |
| Dext Software | 6401 Administration et RH:Logiciels Admin et RH | Montant Extrait (0,00) | CAD | Facture fournisseur |
| Obsidian | 6401 Administration et RH:Logiciels Admin et RH | Montant Extrait (0,00) | CAD | — |
| Agendrix | 6401 Administration et RH:Logiciels Admin et RH | TPS/TVQ QC - 9,975 | CAD | — |
| OpenAI | 6401 Administration et RH:Logiciels Admin et RH | — | CAD | Carte de Crédit |
| 1Password | 6401 Administration et RH:Logiciels Admin et RH | — | CAD | Facture fournisseur |

## Services professionnels et opérations

| Fournisseur | Compte de charge | Code de taxe | Devise QBO |
|-------------|------------------|--------------|-----------|
| Impôts Match | 6452 Administration et RH:Comptabilité et finances | Montant Extrait | CAD |
| KOUTALY | 5210 Sous-traitance:Sous-traitance - Couture | Montant Extrait | CAD |
| Location Sauvageau | 5400 Transport sur achats | Montant Extrait | CAD |
| R&W Customs Brokers | 5400 Transport sur achats | Montant Extrait (0,00) | CAD |
| Freightcom | 5400 Transport sur achats | — | CAD |
| Rona | 6010 Frais généraux:Fournitures/petits outils | Montant Extrait | CAD |
| Emballages LP Aubut | 6210 Frais de vente:Packaging | Montant Extrait | CAD |
| Volcano Medias | — | — | CAD |
| Esso, Point S Pneus Ratte | 6042 Frais généraux / carburant | Montant Extrait | CAD |
| Amazon | selon l'article, voir la note | TPS/TVQ QC - 9,975 | CAD |

## Notes par fournisseur

### Anthropic

Le cas le plus délicat du dossier, pour trois raisons qui se combinent.

**Deux documents par transaction.** Une facture (*Invoice*, en USD, avec date d'échéance) et
un reçu de paiement (*Receipt*, avec numéro de reçu et historique de paiement), tous deux
captés par Dext, tous deux portant le même numéro de facture. Garder la facture, archiver le
reçu.

**Deux séries de numéros en parallèle.** `U9BST0XW-xxxx` pour les recharges automatiques de
crédits, `20NSSBBI-xxxx` pour l'abonnement. Les deux séries progressent en même temps :
vérifier la continuité de chacune séparément.

**Enregistré en CAD dans QBO.** Contrairement à A2X ou Klaviyo, il n'y a pas de taux de
change visible dans la transaction. Le montant CAD de Dext devient le montant comptabilisé.
C'est ce qui a permis au bogue du 14 juillet 2026 de passer : deux reçus lus comme
CAD 46,07 alors que la vraie valeur était 64,80, soit 37 $ de dépense manquante et 4,88 $ de
CTI/RTI non réclamés. Toujours recalculer le montant CAD avec le taux QBO avant de publier.

Inscriptions : QST `NR00116823`, GST/HST `797870227RT9999`. Donc TPS 5 % + TVQ 9,975 %, soit
14,975 % sur le HT.

### A2X

Facture mensuelle du plan Shopify. GST/HST `781140942 RT0001`, aucun numéro de TVQ : **TPS
seulement**. La facture imprime l'équivalent canadien de la taxe entre parenthèses, par
exemple « GST $3.95 (CA$5.56) » : excellent contrôle du taux de change.

Attention, il existe trois fiches fournisseur dans QBO : `A2X` (id 288), `A2X Software`
(150), `A2X Usa` (241), toutes en USD. Utiliser `A2X`, c'est celle qui porte l'historique.

### Klaviyo

Facture avec autoliquidation : « Reverse charge: Exempted VAT/GST », aucune taxe facturée.
Vérifié sur les 11 transactions depuis septembre 2025, toutes à 0,00 de taxe. Aucun CTI à
réclamer, ni maintenant ni rétroactivement. Voir la section sur l'autoliquidation dans
SKILL.md.

Deux fiches dans QBO : `Klaviyo` (149, USD) et `Klaviyo CAD` (28, CAD). Utiliser la fiche
USD.

### ShipStation

Facture mensuelle, montant variable selon le volume d'expéditions. Deux fiches :
`ShipStation` (185, USD) et `shipstationcad` (225, CAD) — cette dernière sert aux achats de
postage en dollars canadiens, qui sont autre chose que l'abonnement.

**Changement constaté le 31 juillet 2026 : ils facturent maintenant la TPS.** La facture vient
d'**Auctane Canada ULC, 3400 – 350 7th Avenue SW, Calgary AB**, en dollars canadiens, avec
5 % de TPS et **aucune TVQ** malgré un client au Québec. Exemple, facture 16057876 :
sous-total 237,49, CA GST 5 % 11,87, total 249,36.

Donc : fiche `shipstationcad`, devise CAD, code `TPS`. À vérifier depuis quand ils chargent la
TPS, il y a peut-être des CTI non réclamés en arrière. La question de la TVQ absente est à
signaler au comptable, pas à trancher.

Les recharges de solde d'expédition (« Add Funds ») sont autre chose : fiche `shipstationcad`,
compte `190 Expédition clients:Expédition Canada`, code `Exonéré`, numéro `AddFunds-AAAAMMJJ`.

### Render

Facturé en USD, aucune taxe. Enregistré en USD dans QBO, mais la carte est débitée en CAD
avec la majoration de change Visa : 6,87 USD le 4 juillet 2026 est devenu 10,00 CAD, alors
que le taux QBO du jour (1,41995) donnait 9,76.

**Pour un achat par carte en devise étrangère, inscrire le montant réellement débité**, pas la
conversion au taux QBO. Précédent : l'achat 11167 porte 242,42 CAD pour une facture
ShipStation de 166,24 USD, soit un taux implicite de 1,4583 contre 1,4202 chez QBO. La règle
du taux QBO vaut pour les factures fournisseurs payées plus tard, pas pour les charges de
carte.

### Amazon

Fiche `Amazon` (2, CAD). Les taxes sont versées par `Amazon.com.ca ULC`, TPS
`857305932RT0001`, TVQ `1201187016TQ0001` : TPS et TVQ pleines, code `TPS/TVQ QC - 9,975`.

Le compte de charge dépend de l'article, d'après l'historique :

| Type d'article | Compte |
|---|---|
| Jardin, champ, atelier (piquets, toile anti-mauvaises herbes, épandeur) | 6010 Frais généraux:Fournitures/petits outils |
| Matériaux d'essai et de transformation (bases de savon, moulin à grains) | 6063 RSDE - Matériaux |

Le numéro de commande `70x-xxxxxxx-xxxxxxx` sert de numéro de pièce.

**Deux pièges.** La page de facture imprimable exige une réauthentification par mot de passe :
demander à Gabriel d'ouvrir la facture plutôt que de saisir quoi que ce soit. Et certaines
commandes sont passées depuis le compte Amazon personnel de Gabriel : la facture porte alors
son nom et son adresse personnelle, mais l'achat est pour Lasclay et la charge est sur la
carte de l'entreprise. Le noter dans le mémo plutôt que de le traiter comme une anomalie.

### Dext Software

39,50 $ CAD par mois, aucune taxe, de façon constante depuis février 2026. Le zéro de taxe
mériterait une vérification auprès de Dext, mais le traitement est cohérent dans le temps :
ne pas le changer unilatéralement.
