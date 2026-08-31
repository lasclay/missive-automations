# Livraisons non confirmées — boîte LAS Support, audit du 2026-08-24

Vérifié dans Shopify sur les **85 commandes** citées dans les fils de la boîte support.
Le champ `fulfillment.displayStatus` et `deliveredAt` portent le retour réel du transporteur.

**Résultat : 61 commandes sur 85 sont confirmées DELIVERED.** Les 24 autres se répartissent en
trois catégories, dont une seule demande une vérification manuelle.

---

## 1. À vérifier sur Postes Canada — suivi existant, livraison jamais confirmée (5)

**C'est la seule liste qui demande une intervention.** Le numéro de suivi existe, mais Shopify
n'a jamais reçu d'événement « livré ». Soit le colis est perdu, soit Postes Canada n'a pas
poussé le dernier scan vers Shopify.

**Tâche pour le plugin Chrome :** ouvrir chaque numéro sur
`canadapost.ca` et rapporter le dernier événement et sa date.

| Commande | Client | Numéro de suivi | Expédiée le | Statut Shopify |
| --- | --- | --- | --- | --- |
| L-41237 | Réjeanne Clair | `5082011974160309` | 2025-11-13 | IN_TRANSIT depuis 9 mois |
| L-41522 | Bernard Tremblay | `5082011112169317` | 2025-12-03 | IN_TRANSIT |
| L-41530 | David J Wilson | `5082011112178319` | 2025-12-03 | IN_TRANSIT |
| L-40707 | daniela velasco | `5082011305015315` | 2026-01-15 | FULFILLED, jamais livré |
| L-41299 | Géraldine Mathieu | `5082011061821311` | 2025-11-26 | FULFILLED, jamais livré |

**Deux d'entre elles sont déjà réglées par ailleurs**, et servent surtout de contrôle :
Bernard Tremblay a écrit qu'il avait **bien reçu** sa commande (fil `ee44c346`), et David Wilson
a reçu un remplacement (commande manuelle `100628`). Si Postes Canada confirme la livraison pour
ces deux-là, le motif est un simple défaut de remontée du scan. Si elle ne la confirme pas non
plus, alors **le statut IN_TRANSIT ne veut rien dire chez nous** et les trois autres ne prouvent
rien non plus.

Lien direct, en remplaçant le numéro :
`https://www.canadapost-postescanada.ca/track-reperage/fr#/details/NUMERO`

---

## 2. Impossible à vérifier, par personne — aucun numéro de suivi (16)

Il n'y a rien à chercher : la commande a été marquée expédiée sans qu'aucun numéro ne soit
enregistré. **Ni nous, ni le plugin Chrome, ni Postes Canada ne peuvent trancher.** La seule
issue est de demander au client, ou de renvoyer.

| Commande | Client | Marquée expédiée le | Note |
| --- | --- | --- | --- |
| L-39238 | Marie-Pierre Verret | 2025-11-21 | **`shippingAddress` null** : motif ramassage, comme Sylvie Parent et Denise Boyer |
| L-44129 | Jean Guy Guérard | 2025-12-15 | Avait demandé un **changement d'adresse** avant l'envoi |
| L-30987 | Gregg Brown | 2025-03-23 | Semences par timbre, renvoi L-32302 déjà fait |
| L-43967 | Nhi Vo | 2026-01-12 | |
| L-44281 | Cassandre Gratton | 2026-01-09 | |
| L-44982 | Isabelle Caron | 2026-02-10 | |
| L-45367 | Sophie Verret | 2026-01-07 | |
| L-46606 | Marie Marie | 2026-02-09 | |
| L-41671 | Etienne Bessette | 2025-12-10 | |
| L-42536 | Yannick Bardieux | 2025-12-03 | |
| L-42800 | Chantal Guindon | 2025-12-10 | |
| L-44383 | Marie-Josée Houde | 2026-05-26 | Commandée en décembre, expédiée **5 mois plus tard** |
| L-44694 | Nicholas St-germain | 2026-02-10 | |
| L-45085 | Camille Paquaux | 2026-03-31 | Commandée en décembre, expédiée **3 mois plus tard** |
| L-45120 | Jennifer Hladkowicz | 2026-01-06 | |
| L-40448 | Katrina Blackwell | 2025-10-28 | Suivi littéral : `Stamp_No_tracking` |

À part, deux cas où l'absence de suivi n'a pas d'importance :
L-41701 (Isabelle Trabut) est **remboursée en totalité**, et L-44730 (Jean-Philippe Tremblay) est
une commande à 0 $ marquée manuellement.

---

## 3. Jamais expédiées, toujours payées (3)

Ce ne sont pas des livraisons douteuses : **rien n'est parti.**

| Commande | Client | Montant | Commandée le | Jours |
| --- | --- | --- | --- | --- |
| L-50159 | Marc-Olivier Gagnon | **402,41 $** | 2026-05-30 | **86** |
| L-50705 | Francis Gagnon | **254,49 $** | 2026-06-21 | 64 |
| L-50688 | Sylvia McVicar | 49,42 $ | 2026-06-16 | 69 |

Sylvia McVicar a relancé le 13 août : *« Do you have an update for me? When will the seat pad
arrive? »*. Sans réponse.

L-39716 (Darcy Davis) et L-44550 (Liane Sylvain) sont aussi sans expédition, mais **toutes deux
remboursées** : dossiers clos.

---

## Ce que le balayage révèle

1. **19 commandes sur 85 ont été marquées expédiées sans numéro de suivi.** Ce n'est pas un
   accident isolé : c'est une pratique. Chacune devient invérifiable au moment où le client
   demande où est son colis, et il n'existe plus aucune source pour lui répondre.
2. **`shippingAddress` null réapparaît une troisième fois** (Marie-Pierre Verret), après Sylvie
   Parent et Denise Boyer. Une commande en ramassage marquée expédiée disparaît de tous les
   tableaux de bord.
3. **Deux commandes ont mis trois et cinq mois à partir** (L-45085, L-44383), sans suivi, donc
   sans que le client puisse le constater autrement qu'en attendant.
4. Le statut `IN_TRANSIT` traîne jusqu'à **neuf mois** sur des colis vraisemblablement livrés.
   Shopify ne clôt pas ces fulfillments tout seul, ce qui rend le tableau de bord trompeur dans
   les deux sens.
