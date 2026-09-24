# Revue du 23 septembre 2026

## Ce qui a tourné

| Routine | Verdict | Trace |
| --- | --- | --- |
| Backlog FB tir A | à jour | 2 publiées, 0 écarté |
| Backlog FB tir B | **0 publiée** | 0 publiée, 80 écartés |
| Backlog FB tir C | à jour (2,9 h) | 19 publiées, 82 écartés |
| Backlog FB tir D | à jour (1 h) | 28 publiées, 0 écarté daté |
| Campagne points de vente | tir SUCCEEDED, 0 envoi | 13 h 02 → 13 h 06 |
| Ménage Operations *(non suivie)* | SUCCEEDED, 14 min | tir 15 h 20 |
| Ménage Admin *(non suivie)* | jamais tirée | créée 15 h 02, 1er tir le 25 |
| Publication Instagram *(non suivie)* | jamais tirée | créée 23 h 53, 1er tir le 26 |
| Ramassages étiquettes | ABANDONNÉE le 22 | prochain tir le 29 |
| Ramassages resynchro, Sync skills, Revue | à jour | — |

49 réponses publiées, toutes confirmées. Trois proxys à 200 ; `general-proxy` à 21,5 s puis 0,48 s
sur deux appels de suite — démarrage à froid, pas une panne.

## Constats

**Trois routines tournent hors de la vue de la revue.** Douze déclencheurs actifs, neuf dans
`revue/routines.json`. Les trois manquantes ont été créées aujourd'hui : ménage Operations
(`trig_01SSRZnRvzCwVPQoo6M8AzDE`, lun/mer/ven, **ferme des fils Missive**), ménage Admin
(`trig_01G26EWgRP5xAqhiFdnLvNEe`, **ferme et déplace des fils**), publication Instagram
(`trig_01MfAh73aAznQCjAerLnALGE`, **publie sur @lasclay et @milkweed.company**). Deux d'entre
elles agissent en production. C'est exactement l'angle mort décrit par R-20260831-01 le 31 août,
toujours `proposee` : l'inventaire n'est pas tenu, et la revue ne le sait pas.

**Correction d'hier soir.** J'ai écrit que la campagne points de vente meurt sur une demande de
permission. C'est vrai du tir du 22 septembre, pas des 48 jours de silence : aujourd'hui elle a
tiré à 13 h 02, `SUCCEEDED` à 13 h 06, session travaillée jusqu'à 23 h 04 pour 4,74 $ US et 47 k
jetons de sortie. Et malgré cela : `journal_envois.json` compte 30 envois, le dernier le
**6 août**, aucune entrée depuis le 1er septembre, et la branche `retail-expansion` n'a pas bougé
depuis le 24 août. Le blocage était un symptôme intermittent ; la cause des 48 jours reste
ouverte, et elle coûte de l'argent chaque mardi, mercredi et jeudi.

**Le tir B n'a rien publié aujourd'hui, au bout de sept jours de baisse continue.** 10, 4, 3, 3,
2, 1, 0 — du 17 au 23 septembre. Pendant ce temps son volume d'écarts n'a pas bougé : 116, 124,
100, 80. Sur les 80 écarts du jour, 40 sont des commentaires sans question (écart correct), 18
des lacunes de `faits-verifies.json`, 2 réservés à un humain. Commentaire par commentaire les
décisions se défendent ; le résultat est qu'une Page entière est muette. Le corpus est le goulot,
pas le jugement du tir — c'est ce que R-20260831-04 propose de récolter, et voilà son coût mesuré.

**Récidive.** Escalades : 61 (+2). Différés : 116 (+8). Écarts du tir D sans date : 1590. Aucun
nouveau rapport d'achat bloqué depuis le 14 septembre, neuf jours. Correctif Render `0a81d48` :
23 jours hors de `main`.

## Ce qui attend Gabriel

Ce que le snapshot ne porte pas :

- La campagne points de vente dépense sans livrer : 4,74 $ US aujourd'hui, 0 envoi depuis le
  6 août. Sa session `session_01QEz7goqRjcW7AhEfgUFN9f` est `REVIEW_READY`, non lue.
- Question du 16 septembre, toujours sans réponse : un marqueur humain « NE PAS ENVOYER »
  peut-il être levé par l'agent qui exécute l'envoi ?
