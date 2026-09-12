# Revue quotidienne — vendredi 11 septembre 2026

Tour de 21 h 41 (Est). Fenêtre : 2026-09-11T04:00Z → 2026-09-12T04:00Z.
Preuves : `revue/jour/2026-09-11/collecte.json`, fichiers d'état du backlog, API Meta, sondes HTTP.

> Dixième soir sans `list_triggers`. Les deux « Ramassages » restent **invérifiables**.

**47 réponses publiées, 47 confirmées, 0 erreur** (A 2, B 4, C 19, D 22). 39 commits. Proxys à 200
(458 / 311 / 279 ms). **Zéro échec 502, sixième jour.**

## 1. Quatre personnes en trois jours n'arrivent pas à acheter — **bloquant**

Hier j'en signalais deux. En cherchant sur l'ensemble du corpus plutôt que sur les seuls écarts
marqués « URGENT », j'en trouve **quatre**, sur trois jours, toutes sur la page Milkweed & Monarchs :

| Date | Ce que la personne écrit |
| --- | --- |
| 9 sept | *« Never saw a checkout option, so please empty my cart lol »* |
| 10 sept | *« I tried clicking on the link to get seeds but it doesn't work. Tried t… »* |
| 10 sept | *« I tried! My order wouldn't go through! »* |
| **11 sept** | *« i makes it too hard to order the seeds »* |

J'avais manqué celle du 9 septembre hier, parce que je n'avais regardé que les deux entrées portant
la mention `URGENT`. C'est une leçon sur ma propre méthode : le marqueur d'escalade est posé au
jugé par l'agent, donc chercher sur le marqueur rate ce qu'il n'a pas marqué.

### Ce n'est pas un lien mort — je l'ai vérifié

Les deux seuls liens publiés sur cette page mènent quelque part :

| Lien publié | Résultat |
| --- | --- |
| `https://lasclay.com/milkweed-seeds` | **200**, redirige vers `/en-us/products/milkweed-seeds` |
| `https://lasclay.com/en-us/collections/milkweed-materials` | **200** |

*(Un premier essai avait renvoyé 429 sur les deux : c'était ma propre limitation de débit après
plusieurs appels rapides, pas ce que voit une cliente. Je le dis pour qu'on ne le prenne pas pour
un constat.)*

### Donc le problème est en aval du lien

« Never saw a checkout option », « my order wouldn't go through », « too hard to order » : ce sont
trois descriptions du **passage à la caisse**, pas de la page produit. Les quatre personnes écrivent
en anglais sur la page américaine, ce qui oriente vers la disponibilité de la livraison ou du
paiement pour les États-Unis.

**Je m'arrête là.** Aller plus loin voudrait dire tenter une commande — de l'argent réel sur un
système de production, ce que cette revue ne fait jamais. La question est cadrée, elle demande
quelqu'un qui peut ouvrir le tunnel d'achat en conditions américaines.

**Ce qu'il en coûte :** quatre signalements en trois jours sont la partie visible. Les gens qui
n'arrivent pas à payer écrivent rarement sous une publication Facebook ; ils ferment l'onglet.

## 2. Les escalades ont doublé en deux jours

**41 escalades**, dont **9 ajoutées aujourd'hui** — 20 le 9 septembre, 31 le 10, 41 le 11. Le
fichier `*-a-revoir.json` reçoit maintenant une dizaine de signalements humains par jour et n'a
toujours aucune sortie. `R-20260831-02` propose de le corriger depuis le 31 août.

## 3. Récidives

| Constat | Signalé les | État |
| --- | --- | --- |
| Campagne à vide | 30 août – 11 sept | **36 jours** |
| Écarts du tir D non comptés | 30 août – 11 sept | **828 entrées, 0 `ecarte_le`** |
| Escalades sans sortie | 31 août – 11 sept | **41** |
| Brouillons non envoyés | 31 août – 11 sept | 11, le plus vieux à **58 jours** |
| `buildFilter` non fusionné | 31 août – 11 sept | douzième soir |
| Doublons publics | 5–11 sept | septième jour |

Le tir A reste à faible volume (2 publiées) — et depuis hier on sait que **c'est normal** : son
arriéré historique est épuisé, il tourne au rythme d'arrivée réel. Je ne le compte plus comme
constat.

## 4. Ce qui attend Gabriel

1. **Le tunnel d'achat américain.** Quatre personnes, trois jours. Tout le reste de cette liste peut
   attendre lundi ; pas celui-là.
2. **Les 41 escalades.**
3. **La campagne points de vente** — 36 jours.
4. **Les 11 brouillons**, le plus vieux à 58 jours.
5. **Les doublons publics** — septième jour.

**Registre : dix `proposee`, deux `reportee`, zéro `approuvee` — quatorzième soir sans décision.**

## 5. Améliorations proposées : aucune

Toujours rien à ajouter. Ce soir la revue a fait son travail — elle a trouvé un problème
commercial réel, l'a cadré, et a écarté une fausse piste. Ce qu'elle ne peut pas faire, c'est le
porter jusqu'à quelqu'un : c'est exactement ce que `R-20260831-02` propose, et elle attend depuis
onze jours.
