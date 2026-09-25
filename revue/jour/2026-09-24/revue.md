# Revue du 24 septembre 2026

## Ce qui a tourné

| Routine | Verdict | Trace |
| --- | --- | --- |
| Backlog FB tir A | à jour (4,6 h) | 3 publiées, 2 écartés |
| Backlog FB tir B | à jour (1,2 h) | 5 publiées, 91 écartés |
| Backlog FB tir C | à jour (1,8 h) | 22 publiées, 93 écartés |
| Backlog FB tir D | à jour (1,1 h) | 31 publiées, 0 écarté daté |
| Campagne points de vente | tir SUCCEEDED, 0 envoi | 13 h 03 → 13 h 08, 1,38 $ US |
| Sync skills claude.ai → repo | à jour (25,3 h) | — |
| Ramassages, Revue | à jour | resynchro : sortie invérifiable |
| Ménages Operations/Admin, Instagram | **hors inventaire** | prochains tirs les 25 et 26 |

61 réponses publiées, toutes confirmées. Trois proxys à 200, aucune latence anormale.

## Constats

**Correction de deux soirs de suite sur le tir B.** Hier j'ai écrit « sept jours de baisse continue
jusqu'à zéro ». C'est faux : la série est 10, 4, 3, 3, 2, 1, **0 le 23**, puis **5 aujourd'hui** —
un trou d'une journée, pas un effondrement. Deux fois déjà j'ai lu une tendance dans les
publications d'un tir et je me suis trompé (le tir A en septembre, le tir B hier). La leçon est
la même que celle de R-20260912-01 : un tir se juge sur le travail qui reste, pas sur une série
de compteurs quotidiens. Je cesse de commenter ces séries jusqu'à ce qu'un instrument existe.

**La campagne points de vente a maintenant trois tirs mesurés qui finissent bien et ne livrent
rien.** 17 sept. 1,40 $ US, 23 sept. 4,74 $, 24 sept. 1,38 $ — 7,52 $ pour trois tours, et
`journal_envois.json` reste à 30 entrées dont la dernière date du **6 août**. La branche
`retail-expansion` n'a pas bougé depuis le 24 août. Chaque tir laisse sa session `REVIEW_READY`
non lue (`session_01KPSAbDHqwfzWsbi9GghP4A` aujourd'hui). Elle tire mardi, mercredi et jeudi :
la dépense se répète trois fois par semaine sans rien produire. → proposition du soir.

**Les commentaires différés ont pris 26 en une journée — 142 contre 116.** C'est la plus forte
hausse depuis que le compteur existe, et le tir C a écarté 93 commentaires aujourd'hui. Rien ne
relit ce fichier (R-20260920-01, `proposee` depuis le 20).

**Récidive.** Escalades : 61, inchangé. Écarts du tir D sans date : 1659 (R-20260830-02). Aucun
nouveau rapport d'achat bloqué depuis le 14 septembre, dix jours. Correctif Render `0a81d48` :
24 jours hors de `main`. Trois routines toujours absentes de `revue/routines.json`
(R-20260923-01, proposée hier) — les deux ménages tirent demain, la publication Instagram samedi.

## Ce qui attend Gabriel

Ce que le snapshot ne porte pas :

- La campagne points de vente coûte environ 1,40 $ US par tir, trois fois par semaine, pour zéro
  envoi depuis sept semaines. R-20260924-01 propose de l'arrêter le temps de trouver la cause.
- Question du 16 septembre, toujours sans réponse : un marqueur humain « NE PAS ENVOYER »
  peut-il être levé par l'agent qui exécute l'envoi ?
