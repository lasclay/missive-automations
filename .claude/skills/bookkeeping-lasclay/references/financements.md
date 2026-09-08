# Financements de Lasclay — méthode et données

Avances de fonds marchandes (Merchant Growth, Shopify Capital) et prêts à terme (BDC).
Établi le 30 juillet 2026 à partir des contrats, des portails prêteurs et de QBO.

## La règle qui prime

**Le passif porte le montant reçu, pas le montant à rembourser.**

C'est la règle donnée par Gabriel, et elle n'est pas négociable. Le coût du financement
(frais fixes, intérêts capitalisés) devient une charge au rythme des remboursements. Il ne
faut ni gonfler le passif au montant du remboursement total, ni créer un actif reporté pour
loger le coût d'avance.

Les deux dossiers avaient été montés autrement avant juillet 2026 : passif gonflé, actif
reporté en contrepartie (`Intérêts Merchant Growth` 18 712 $, `Intérêts Shopify` 21 855 $).
Ces deux actifs ont été éliminés le 30 juillet 2026. **S'ils réapparaissent, c'est un
symptôme, pas une écriture.**

### Modèle d'écriture

Réception de l'avance :

```
Débit   Compte chèques CAD                          montant reçu
Crédit  Prêts privés et corporatifs:<le prêt>       montant reçu
```

Chaque remboursement, ventilé :

```
Débit   Prêts privés et corporatifs:<le prêt>       portion capital
Débit   Frais financiers:Intérêts:<le prêt>         portion frais
Crédit  Compte chèques CAD (ou compensation)        montant du versement
```

Quand les versements ont déjà été enregistrés en bloc au passif (virements, dépenses), la
correction est un simple reclassement :

```
Débit   Frais financiers:Intérêts:<le prêt>         portion frais cumulée
Crédit  Prêts privés et corporatifs:<le prêt>       portion frais cumulée
```

### Comment calculer la portion frais

Sur une avance à frais fixes, la portion frais de chaque versement est strictement
proportionnelle :

```
frais gagnés = frais fixes du contrat × (montant remis à ce jour / montant total à remettre)
```

Ne jamais estimer un taux d'intérêt annuel : ces produits n'en ont pas. Ils ont des frais
fixes payés d'avance, gagnés au prorata du remboursement.

### Le contrôle qui tranche

Avant de conclure quoi que ce soit sur une charge d'intérêts, vérifier cette identité :

```
solde cumulatif du compte de charge depuis l'origine
    = somme des frais contractuellement gagnés sur toutes les avances
```

Si l'égalité tombe au cent près, rien n'est compté deux fois ni compté avant d'être gagné.
Si elle ne tombe pas, chercher avant d'écrire.

---

## Merchant Growth

Portail : `my.merchantgrowth.com`. Gabriel s'y connecte lui-même, ne jamais saisir ses
identifiants.

Produit « Fixed Solution » : une avance, un montant à rembourser fixé d'avance, un versement
hebdomadaire prélevé **le jeudi** au compte chèques (libellé bancaire
`Direct withdrawal /MERCHANT GROWTH FUND`).

| Date | Type | Reçu | À rembourser | Coût | Versement |
|------|------|------|-------------|------|-----------|
| 3 nov. 2025 | initiale | 99 500 | 124 176 | 24 676 | 1 592,01 |
| 15 avr. 2026 | renouvellement | 79 839 | 116 565 | 36 726 | 1 962,75 |

**Le relevé du portail fournit la portion intérêt de chaque versement**, colonne
« (Included) Interest/Fee Revenue ». Aucune estimation n'est nécessaire, et il ne faut pas
en faire : télécharger le CSV et sommer par mois.

Le nombre de versements varie de 4 à 5 par mois selon le nombre de jeudis. Ce n'est pas un
changement de taux.

Comptes QBO :

| Id | Compte |
|----|--------|
| 1150040008 | Prêts privés et corporatifs:Merchant Growth Capital |
| 1150040015 | Frais financiers:Intérêts:Intérêts Merchant Growth (7020) |
| 1150040014 | Intérêts Merchant Growth (actif reporté, **doit rester à zéro**) |

État au 30 juillet 2026, après correction : passif 126 408,33, charge de l'exercice
13 126,81, actif reporté 0. Le passif se recalcule ainsi : 179 339 reçus moins 52 930,67 de
capital remboursé.

Piège vécu : les versements hebdomadaires existent aux livres sous forme de **Virements**,
pas d'écritures de journal. Une requête sur `JournalEntry` seule fait conclure à tort qu'ils
sont absents. Interroger aussi `Transfer`, `Purchase` et `Deposit`.

---

## Shopify Capital

### Le connecteur ne sert à rien ici

Le connecteur Shopify n'a pas la portée `read_shopify_payments`, et l'API Admin GraphQL
n'expose **aucune** requête `capital` ou `loan` (vérifié sur le schéma complet). Les types
`LENDING_CAPITAL_REMITTANCE` existent dans l'énumération des transactions de solde, mais
restent inaccessibles sans la portée.

**Passer par le navigateur intégré** : `admin.shopify.com/store/lasclay/capital/fundings`,
puis « View full details » sur chaque avance. L'encadré « Details » donne le montant financé,
les frais fixes et le taux de remise. Le contenu est rendu hors du DOM qu'une extraction de
texte ramène : lire la région à l'écran, en l'agrandissant au besoin, ça marche.

Les identifiants d'avance sont dans les liens de la page, format `/capital/<id>/transactions`.

### Les avances

| Avance Shopify | Financé | Frais fixes | À remettre | Taux de remise | Entente | État |
|---|---|---|---|---|---|---|
| #1 | — | 3 510 (déduit) | 30 510 | — | — | complétée 5 oct. 2023 |
| #2 | 100 000 | 10 000 (10 %) | 110 000 | 17 % | 24 sept. 2024 | complétée 9 mai 2025 |
| #3 | 51 850 | 4 148 (8 %) | 55 998 | 17 % | 30 déc. 2024 | complétée 14 sept. 2025 |
| #4 | 180 000 | 17 280 (9,6 %) | 197 280 | 25 % | 23 juin 2025 | complétée 8 févr. 2026 |
| #5 | 250 000 | 23 500 (9,4 %) | 273 500 | 25 % | 13 janv. 2026 | en cours |

Le remboursement se fait par prélèvement sur les ventes quotidiennes, pas au compte chèques.
Il transite donc par les versements Shopify : chercher les remises du côté des comptes de
compensation e-commerce, pas du côté bancaire.

### Attention, la numérotation QBO est décalée d'un cran

| Compte QBO | Avance Shopify réelle |
|---|---|
| 89 Emprunt - Shopify Capital 100K | #2 |
| 264 Emprunt Shopify Capital #2 55K | #3 |
| 1150040006 Emprunt Shopify Capital #3 180K | #4 |
| 1150040009 Shopify Capital #4 250K | #5 |
| 207 Frais financiers:Intérêts:Intérêts Shopify Capital (7012) | — |
| 267 Intérêts Shopify (actif reporté, **doit rester à zéro**) | — |

### État au 30 juillet 2026

Charge cumulative depuis l'origine : 40 320,08, qui égale au cent près la somme des frais
gagnés (2 917,14 + 10 000 + 4 148 + 17 280 + 5 974,94). C'est le contrôle décrit plus haut.

Passif de l'avance #5 : 186 580,50 contre 186 436,79 en théorie, soit 143,71 d'écart non
forcé.

### Dossiers ouverts

- **15 848,88 $ de remises de l'avance #5 ne sont pas comptabilisées.** Shopify a prélevé
  69 538,15, QBO n'en porte que 53 689,27.
- **Le compte de l'avance #4 a reçu 212 330,84 de remises** alors que le contrat n'en
  prévoyait que 197 280. L'excédent de 15 050,84 vient probablement de remises de l'avance #5
  codées au mauvais compte, les deux s'étant chevauchées entre janvier et février 2026.
- **Césure d'exercice sur l'avance #4** : financée le 23 juin 2025, complétée le 8 février
  2026. Les livres ne portent aucune remise sur elle avant le 1er septembre 2025, ce qui met
  la totalité des 17 280 de frais dans l'exercice 2026. Si Shopify a réellement prélevé
  pendant l'été 2025, jusqu'à environ 5 000 appartiennent à l'exercice précédent.

Ces trois points sont à mentionner au comptable, pas à forcer.

---

## Prêts BDC

Portail BDC, connexion par Gabriel. Le portail donne l'avis de débit avec la ventilation
exacte capital / intérêt de chaque paiement : s'en servir, ne pas déduire d'un taux.

Structure typique : capital fixe, intérêt variable. Les opérations récurrentes de QBO donnent
le gabarit d'écriture.

Convention de numérotation des écritures : `BDC <prêt> AAAA-MM-JJ`, par exemple
`BDC 18K 2026-07-22`, `BDC 10k 2026-07-02`. Les corrections : `Corr Int BDC 18K`.

Comptes de charge :

| Compte | Prêt |
|--------|------|
| 248 (7014) | Intérêts Prêt BDC 100k |
| 1150040004 (7016) | Intérêts Prêt BDC 18K |

**Le prêt de 11K n'a pas son propre compte.** Ses intérêts atterrissent dans le compte du
18K (JE 11090 68,98 du 11 mai, JE 11091 82,26 du 9 juin, soit 151,24 à reclasser). Créer un
compte dédié réglerait la question.
