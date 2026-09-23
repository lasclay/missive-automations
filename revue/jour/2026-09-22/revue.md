# Revue du 22 septembre 2026

## Ce qui a tourné

| Routine | Verdict | Trace |
| --- | --- | --- |
| Backlog FB tir A | à jour (0,6 h) | 4 publiées, 2 écartés |
| Backlog FB tir B | à jour (5,2 h) | 1 publiée, 100 écartés |
| Backlog FB tir C | à jour (2,9 h) | 22 publiées, 69 écartés |
| Backlog FB tir D | à jour (1,1 h) | 28 publiées, 0 écarté daté |
| Campagne points de vente | **BLOQUÉE** | a tiré 13 h 04, `PENDING` depuis |
| Ramassages étiquettes du mardi | **ABANDONNÉE** | a tiré 11 h 10, morte à 11 h 10 min 31 |
| Ramassages resynchro | tire, SUCCEEDED (3 min) | sortie invérifiable |
| Sync skills claude.ai → repo | à jour (150,9 h) | tir 22 sept. 10 h 23, 3 min |
| Revue quotidienne | à jour (24 h) | ce fichier |

55 réponses publiées, toutes confirmées chez Meta. Trois proxys à 200, sans latence anormale.

## Constats

**Deux routines meurent sur une demande de permission que personne ne verra jamais.** C'est la
cause des 46 jours de silence de la campagne, cherchée depuis le 30 août.

- **Campagne points de vente** : tir du 22 sept. 13 h 04, `last_run.status` =
  `ROUTINE_RUN_STATUS_PENDING`, aucun `finished_at` douze heures plus tard. Session
  `session_017hAyqCYoT1XUq2GmWREYwY` : `SESSION_STATUS_REQUIRES_ACTION`, `status_bucket`
  `BLOCKED`, figée depuis 13 h 07 min 14 sur un `pending_action` Bash — un `git status --porcelain
  && node -e '…'` composé, qui n'est que son propre calcul à blanc du taux de rebond et du lot.
  Elle n'a jamais atteint l'étape d'envoi. Le 17 septembre, même routine, même issue : session
  laissée `REVIEW_READY` non lue.
- **Ramassages — lot d'étiquettes du mardi** : tir du 22 sept. 11 h 10,
  `ROUTINE_RUN_STATUS_ABANDONED`. Session `session_017MMCL5KaPCBfqwaRewxQc1` bloquée 19 secondes
  après le départ sur l'autorisation de `mcp__Shopify__graphql_query`, sa toute première requête.
  Aucune étiquette produite cette semaine ; prochain tir le 29.

Deux familles d'outils différentes (Bash composé, connecteur MCP), un seul mécanisme : le premier
appel qui demande une approbation arrête une session qu'aucun humain ne regarde. Je l'ai vécu dans
cette session même — un `git push && git fetch && git log` refusé, le `git push` seul accepté.

**Régression, pas état permanent.** Le 15 septembre, la même routine d'étiquettes a fini en 7 min
(SUCCEEDED) ; le 17, la campagne a travaillé 3 min 30. Les sessions d'avant portent
`container_cc_version` 2.1.274, celles de ce soir 2.1.278. Corrélation relevée, pas une cause
démontrée : je n'ai pas de quoi attribuer le changement.

**Les différés ne montent pas au rythme annoncé hier.** 107 contre 104, soit +3 — pas +26. Hier
j'ai écrit qu'ils dépasseraient les escalades avant jeudi ; c'était une extrapolation sur une
seule journée, et elle est fausse. Les escalades, elles, ont pris +4 aujourd'hui (59).

**Récidive.** Écarts du tir D sans date : 1536 (R-20260830-02). Correctif Render `0a81d48` :
22 jours hors de `main`. Aucun nouveau rapport d'achat bloqué depuis le 14 septembre, huit jours.

## Ce qui attend Gabriel

Ce que le snapshot ne porte pas :

- **Deux sessions bloquées attendent une approbation** :
  `session_017hAyqCYoT1XUq2GmWREYwY` (campagne) et `session_017MMCL5KaPCBfqwaRewxQc1`
  (étiquettes). Je ne les débloque pas moi-même : la revue observe.
- Question du 16 septembre, toujours sans réponse : un marqueur humain « NE PAS ENVOYER »
  peut-il être levé par l'agent qui exécute l'envoi ?
