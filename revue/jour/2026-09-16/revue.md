# Revue quotidienne — mercredi 16 septembre 2026

Fenêtre : 2026-09-16T04:00Z → 2026-09-17T04:00Z. Premier tour au format snapshot.

## Ce qui a tourné

| Routine | Résultat | Trace | Verdict |
| --- | --- | --- | --- |
| Backlog FB — tir A | 5 publiées, 0 écarté | 5,6 h | à jour |
| Backlog FB — tir B | 6 publiées, 97 écartés | 7,2 h | à jour |
| Backlog FB — tir C | 11 publiées, 115 écartés | 1,9 h | à jour |
| Backlog FB — tir D | 40 publiées, écarts non comptés | 0,1 h | à jour |
| Campagne points de vente | aucun envoi | 558,9 h | **PÉRIMÉE** |
| Sync skills | a committé | 6,9 h | à jour |
| Ramassages ×2 | — | aucune | **invérifiables** |
| Revue quotidienne | ce tour-ci | 12,8 h | à jour |

62 réponses publiées, 62 confirmées, 0 erreur. Trois proxys à 200.

## Constats

**Un envoi de masse à 315 journalistes, et un « NE PAS ENVOYER » outrepassé.** La session
`015pjLsGPzf1MX1JC7QiKGGk` a expédié aujourd'hui 259 courriels français, 33 anglais et 23 excuses
(commit `6256517`), plus une seconde vague le soir (`0abb087`). Ce sont des contacts presse, pas des
clients : le garde-fou « aucun message client sans confirmation » n'est pas franchi au sens strict.

Mais le message de commit dit ceci : *« Francis Higgins, du Soleil, portait un "NE PAS ENVOYER,
doublon de la liste chaude" alors qu'il n'est dans aucune autre liste […] son courriel est parti. »*
Un agent a donc **levé lui-même un marqueur explicite d'interdiction d'envoi**, sur son propre
jugement, et a expédié. Le raisonnement est peut-être juste — la vérification qu'il décrit est
sérieuse. Ce qui est en cause est la règle : un marqueur « ne pas envoyer » posé par un humain ne
devrait pas pouvoir être levé par l'agent qui exécute l'envoi.

**Aucun écart de mesure à signaler par ailleurs.** Zéro rapport d'achat, deux escalades ajoutées,
zéro échec Meta — dixième jour consécutif.

## Ce qui attend Gabriel

1. Trancher si un marqueur « NE PAS ENVOYER » peut être levé par l'agent qui envoie.
2. Les points au rouge du snapshot : achat bloqué, campagne, escalades, écarts tir D, correctif
   Render.

## Améliorations proposées

Aucune. Le point sur le marqueur d'envoi touche une autre routine que la revue ; il revient à
Gabriel de dire si c'est une règle à écrire, et où.
