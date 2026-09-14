# Revue quotidienne — dimanche 13 septembre 2026

Tour de 21 h 41 (Est). Fenêtre : 2026-09-13T04:00Z → 2026-09-14T04:00Z.
Preuves : `revue/jour/2026-09-13/collecte.json`, fichiers d'état du backlog.

**58 réponses publiées, 58 confirmées, 0 erreur** (A 2, B 8, C 16, D 32). 39 commits. Proxys à 200
(612 / 370 / 451 ms). **Zéro échec 502, huitième jour.** Les deux « Ramassages » restent
**invérifiables** — onzième soir sans `list_triggers`.

Revue courte : une bonne nouvelle, une vérification qui a évité une fausse alerte, et de la
récidive.

## 1. Aucun nouveau rapport d'achat aujourd'hui

Premier jour sans depuis le 8 septembre. Le compte reste à **six**, du 9 au 12 septembre. Rien ne
dit que le problème est réglé — un dimanche est un jour creux, et personne n'a touché au produit
depuis hier — mais la série s'interrompt et cela vaut d'être écrit.

## 2. J'ai failli en annoncer dix

En élargissant ma recherche ce soir, j'ai d'abord compté **dix** rapports, remontant au 29 août.
J'ai vérifié les quatre plus anciens avant de l'écrire. **Les quatre sont faux** — ils accrochent
sur le mot « impossible », sans aucun rapport avec un achat :

| Date | Ce que c'est réellement |
| --- | --- |
| 29 août | *« parait que c'est impossible de vous envoyer un mp »* — deux abonnées s'organisent un envoi de semences entre elles |
| 29 août | *« BRAVO! La preuve que RIEN n'est impossible… »* — félicitations sur le billet du récit de maladie |
| 2 sept | *« il m'étais impossible d'effacer »* — excuses d'un abonné après une insulte |
| 3 sept | *« Impossible now on the west coast »* — une personne qui ne trouve plus de chrysalides |

Le compte réel reste **six, du 9 au 12 septembre**. Le problème a quatre jours, pas seize.

C'est la troisième fois en deux semaines qu'un motif de recherche trop large me trompe — après
`\bA-?I\b` qui capturait le verbe « ai », et la recherche sur le seul marqueur `URGENT` qui, elle,
en manquait. Le défaut est symétrique : trop large, j'invente ; trop étroit, je rate. La seule
parade qui a fonctionné à chaque fois est de **lire les correspondances une par une avant de les
compter**, ce que j'ai fait ce soir et qui a évité d'annoncer un problème deux fois plus vieux
qu'il ne l'est.

## 3. Récidives

| Constat | Signalé les | État |
| --- | --- | --- |
| Chemin d'achat des graines | 10–13 sept | **6 rapports**, cause probable identifiée hier, rien de changé |
| Campagne à vide | 30 août – 13 sept | **38 jours** |
| Écarts du tir D non comptés | 30 août – 13 sept | **976 entrées, 0 `ecarte_le`** |
| Escalades sans sortie | 31 août – 13 sept | **44**, une ajoutée |
| Brouillons non envoyés | 31 août – 13 sept | 11, le plus vieux à **60 jours** |
| `buildFilter` non fusionné | 31 août – 13 sept | quatorzième soir |
| Doublons publics | 5–13 sept | neuvième jour |

## 4. Ce qui attend Gabriel

1. **Le chemin d'achat des graines** — six rapports, cause probable établie hier en lecture seule :
   33 variantes, prévente livrable en novembre 2026, prix en CAD sur un public américain,
   inventaire plein. Ouvrir la page comme une cliente américaine tranche.
2. **Les 44 escalades.**
3. **La campagne points de vente** — 38 jours.
4. **Les 11 brouillons** (le plus vieux à 60 jours) et les **doublons publics** (neuvième jour).

**Registre : onze `proposee`, deux `reportee`, zéro `approuvee` — seizième soir sans décision.**

## 5. Améliorations proposées : aucune

Rien de neuf. `R-20260912-01`, proposée hier, couvre le dernier défaut d'instrument que j'ai
trouvé ; les dix autres attendent depuis une à deux semaines.
