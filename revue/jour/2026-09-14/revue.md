# Revue quotidienne — lundi 14 septembre 2026

Tour de 21 h 42 (Est). Fenêtre : 2026-09-14T04:00Z → 2026-09-15T04:00Z.
Preuves : `revue/jour/2026-09-14/collecte.json`, fichiers d'état du backlog, boîte Missive.

**100 réponses publiées, 100 confirmées, 0 erreur** (A 1, B 4, C 20, D 75 — meilleure journée du
tir D). 54 commits. Proxys à 200 (`general-proxy` à 12,4 s : réveil Render). Un échec au backlog.
Les deux « Ramassages » restent **invérifiables** — douzième soir sans `list_triggers`.

## 1. Septième rapport d'achat, sur une deuxième page, et le plus explicite — **bloquant**

Écarté aujourd'hui par le tir **B** (The Milkweed Company) :

> **« Checkout link wasn't working »**

C'est le septième signalement en six jours, et le premier hors de la page Milkweed & Monarchs.
Récapitulatif :

| Date | Page | Ce qui est écrit |
| --- | --- | --- |
| 9 sept | Milkweed & Monarchs | *« Never saw a checkout option, so please empty my cart lol »* |
| 10 sept | Milkweed & Monarchs | *« I tried clicking on the link to get seeds but it doesn't work »* |
| 10 sept | Milkweed & Monarchs | *« I tried! My order wouldn't go through! »* |
| 11 sept | Milkweed & Monarchs | *« i makes it too hard to order the seeds »* |
| 12 sept | Milkweed & Monarchs | *« the order website was crap. One of the option[s]… »* |
| 12 sept | Milkweed & Monarchs | *« I have tried to order but it. Is. Impossible »* |
| **14 sept** | **The Milkweed Company** | **« Checkout link wasn't working »** |

### Ce que ça change dans mon analyse

Le 12 septembre, j'ai avancé une explication d'ergonomie : 33 variantes, prévente livrable en
novembre 2026, prix en CAD sur un public américain. Ces quatre faits restent vrais — je les ai
vérifiés en lecture seule sur l'API Shopify — mais **ils n'expliquent pas celui-ci**.

« Checkout link wasn't working », « my order wouldn't go through », « never saw a checkout option »
décrivent une **panne**, pas une difficulté. Et le fait que ça touche maintenant **deux pages
distinctes** écarte l'idée d'un lien mal collé dans une publication.

Je corrige donc la pondération que je donnais samedi : l'ergonomie est probablement un facteur
aggravant, pas la cause. La cause ressemble à un chemin de paiement qui échoue pour une partie du
trafic.

**Je ne teste toujours pas la caisse** — cela veut dire passer une commande réelle. C'est la
troisième fois que je bute sur cette limite, et elle est la bonne : ce qu'il faut, c'est quelqu'un
qui ouvre `lasclay.com` depuis les États-Unis, met un sachet de graines au panier et va jusqu'au
paiement. Deux minutes.

**Ce qu'il en coûte :** sept personnes l'ont écrit en public en six jours. Six jours de ventes
perdues sur le marché américain, à la saison où l'on achète des semences.

## 2. Récidives

| Constat | Signalé les | État |
| --- | --- | --- |
| Chemin d'achat | 10–14 sept | **7 rapports, 2 pages**, rien de changé |
| Escalades sans sortie | 31 août – 14 sept | **47**, trois ajoutées aujourd'hui |
| Campagne à vide | 30 août – 14 sept | **39 jours** |
| Écarts du tir D non comptés | 30 août – 14 sept | **1 020 entrées, 0 `ecarte_le`** |
| Brouillons non envoyés | 31 août – 14 sept | 11, le plus vieux à **61 jours** |
| `buildFilter` non fusionné | 31 août – 14 sept | quinzième soir |
| Doublons publics | 5–14 sept | dixième jour |

Le tir D a franchi **mille entrées** dans son fichier d'écarts, dont aucune n'est comptée par la
collecte. C'est le chiffre le plus simple à citer de tout ce dossier.

## 3. Ce qui attend Gabriel

1. **Ouvrir le tunnel d'achat depuis les États-Unis.** Sept personnes, six jours, deux pages. Rien
   d'autre sur cette liste ne coûte de l'argent en ce moment même.
2. **Les 47 escalades** — les sept rapports y sont.
3. **La campagne points de vente** — 39 jours.
4. **Les 11 brouillons**, les **doublons publics**.

**Registre : onze `proposee`, deux `reportee`, zéro `approuvee` — dix-septième soir sans décision.**

## 4. Améliorations proposées : aucune

Rien de neuf à proposer. Je note seulement que `R-20260831-02` — router les escalades hors du
fichier que personne ne lit — aurait, sur ce seul dossier, porté sept signalements de vente perdue
jusqu'à un humain entre le 9 et le 14 septembre. Elle attend depuis le 31 août.
