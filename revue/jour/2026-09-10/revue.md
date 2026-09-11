# Revue quotidienne — jeudi 10 septembre 2026

Tour de 21 h 41 (Est). Fenêtre : 2026-09-10T04:00Z → 2026-09-11T04:00Z.
Preuves : `revue/jour/2026-09-10/collecte.json`, fichiers d'état du backlog, lectures directes de
l'API Meta, sondes HTTP publiques.

> Neuvième soir sans `list_triggers`. Les deux « Ramassages » restent **invérifiables**.

**64 réponses publiées, 64 confirmées, 0 erreur** (A 3, B 6, C 28, D 27). 46 commits. Proxys à 200
(`missive-proxy` à 1 374 ms — réveil Render). **Zéro échec 502, cinquième jour.**

## 1. À traiter ce soir, pas demain : deux clientes n'arrivent pas à acheter

Le tir C a écarté aujourd'hui deux commentaires, tous deux marqués **« URGENT À SIGNALER »** :

> *« I tried clicking on the link to get seeds but it doesn't work »*
> — motif : **URGENT A SIGNALER, NON TRAITABLE PAR MOI**

> *« I tried! My order wouldn't go through! »*
> — motif : **URGENT A SIGNALER : DEUXIÈME rapport d'achat impossible**

Deux personnes différentes, la même journée, disent ne pas pouvoir compléter un achat. L'agent a
fait exactement ce qu'il fallait — il a refusé de répondre et a escaladé — et les deux escalades
sont parties dans `C-a-revoir.json`, le fichier que personne ne lit. **Les escalades passent
aujourd'hui de 20 à 31**, onze ajoutées en une journée.

J'ai vérifié ce que je pouvais publiquement : `https://lasclay.com` répond **200**, et
`/collections/all` aussi. Je ne peux pas aller plus loin — **l'escalade n'enregistre pas le lien sur
lequel la cliente a cliqué**, donc même un humain qui la reprend ne peut pas reproduire le problème
sans le lui redemander. (Les deux 404 que j'ai obtenus en devinant des noms de collection sont mes
suppositions, pas une preuve : je ne les compte pas.)

**Ce qu'il en coûte si rien n'est fait :** deux rapports le même jour, c'est rarement deux
coïncidences. Si le tunnel d'achat est cassé pour une partie du trafic, chaque heure compte, et rien
dans le dispositif actuel ne portera l'information jusqu'à un humain.

## 2. Correction : le tir A est sain, et je me suis trompé six soirs de suite

Depuis le 4 septembre j'écris que le tir A est « dégradé », en « faux vert », qu'il « répond à un
commentaire par jour ». Le Chief a repris le même diagnostic le 5. **C'était faux.** Voici ce que
j'ai vérifié ce soir, et que j'aurais pu vérifier le premier jour.

### Le tir A voit ce qu'il doit voir

J'ai croisé les commentaires publics des deux dernières publications de la page Lasclay avec ses
deux fichiers d'état :

| | |
| --- | --- |
| Commentaires du public | **20** |
| Connus du tir A (répondus ou écartés) | **17** |
| Inconnus de ses fichiers | **3** |

Et les trois inconnus sont : *« Bravo!👏 »*, *« Bravo! »*, *« Fais du gaz »* — précisément ce que
`REGLES.md` écarte. Le tir ne rate rien.

### La chute du 4 septembre est la fin d'un arriéré historique, pas une panne

Âge des commentaires qu'il traitait, mesuré sur ses propres écarts :

| Période | Écarts | Âge médian du commentaire traité | Plus ancien |
| --- | --- | --- | --- |
| Avant le 4 septembre | 426 | **182 jours** | **2 153 jours** (près de six ans) |
| Depuis le 4 septembre | 10 | 221 jours | 224 jours |

Jusqu'au 3 septembre, le tir A vidait des années de commentaires jamais répondus — un âge médian de
six mois, des pièces vieilles de six ans. **Il a fini.** Depuis, il tourne au rythme réel d'arrivée
des nouveaux commentaires sur cette page, qui est faible. Passer de 115 éléments par jour à 6 n'est
pas une dégradation : c'est la fin du rattrapage.

### Ce que ça change

- **Le verdict « à jour » de la collecte était juste depuis le début.** C'est moi qui l'ai traité de
  faux vert pendant six jours.
- `R-20260904-01`, que j'avais proposée pour « corriger » ce faux vert, aurait transformé une
  routine saine en alerte quotidienne. Elle était déjà passée à `reportee` hier ; c'est confirmé.
- Deux agents — le Chief et moi — ont lu la même trace et en ont tiré la même conclusion fausse.
  Ce qui manquait n'était pas un instrument de plus, c'était **une question : par rapport à quoi
  ce volume est-il bas ?**

## 3. Récidives

| Constat | Signalé les | État |
| --- | --- | --- |
| Campagne à vide | 30 août – 10 sept | **35 jours**, troisième jeudi sans envoi |
| Doublons publics | 5–10 sept | **2 en trop** sur le parent témoin, sixième jour |
| Écarts du tir D non comptés | 30 août – 10 sept | **754 entrées, 0 `ecarte_le`** |
| Escalades sans sortie | 31 août – 10 sept | **31**, dont deux urgentes de ce soir |
| Brouillons non envoyés | 31 août – 10 sept | 11, le plus vieux à **57 jours** |
| `buildFilter` non fusionné | 31 août – 10 sept | onzième soir |

## 4. Ce qui attend Gabriel

1. **Les deux rapports d'achat impossible** — ce soir. C'est le seul point de cette liste où
   l'attente coûte des ventes.
2. **Les 31 escalades**, dont ces deux-là.
3. **Retirer les doublons publics** — sixième jour.
4. **La campagne points de vente** — 35 jours.
5. **Les 11 brouillons**, le plus vieux à 57 jours.

**Registre : dix `proposee`, deux `reportee`, zéro `approuvee` — treizième soir sans décision.**

## 5. Améliorations proposées : aucune

Je n'en ajoute pas. `R-20260831-02` — router les escalades hors du fichier `a-revoir` — attend depuis
le 31 août, et ce soir elle aurait porté deux rapports d'achat impossible jusqu'à un humain le jour
même. La proposition existe déjà ; ce qui manque est une décision, et une douzième entrée ne la
produira pas.
