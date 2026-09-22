# Revue du 21 septembre 2026

## Ce qui a tourné

| Routine | Verdict | Trace |
| --- | --- | --- |
| Backlog FB tir A | à jour (2,6 h) | 4 publiées, 1 écarté |
| Backlog FB tir B | à jour (2,2 h) | 2 publiées, 124 écartés |
| Backlog FB tir C | à jour (1,8 h) | 12 publiées, 63 écartés |
| Backlog FB tir D | à jour (2 h) | 35 publiées, 0 écarté daté |
| Campagne points de vente | **PÉRIMÉE** (678,9 h) | ne tire que mar-jeu, dernier 17 sept. |
| Sync skills claude.ai → repo | à jour (126,8 h) | tir 21 sept. 10 h 23, 3 min |
| Ramassages (resynchro, étiquettes) | tirent, SUCCEEDED | sortie invérifiable |
| Revue quotidienne | à jour (23,8 h) | ce fichier |

53 réponses publiées, toutes confirmées chez Meta. Trois proxys à 200.

## Constats

**Les commentaires différés montent plus vite qu'ils ne se vident : 104 contre 78 hier soir**, dont
14 datés aujourd'hui. Aucun mécanisme ne les relit — c'est le constat de R-20260920-01, proposé
hier soir, encore `proposee`. En une seule journée la file a gagné un tiers de son volume ; à ce
rythme elle dépasse les escalades (55) en moins de trois jours. Ajouté au snapshot ce soir, parce
qu'un compteur qui monte de 26 en 24 h n'a pas sa place dans une archive que personne n'ouvre.

**Le tir C a des heures creuses en pleine plage ouvrable : 13, 15, 16 et 17 h.** Hier il n'en avait
aucune. Sur la même journée il a écarté 63 commentaires pour 12 publiés — le pire ratio des quatre
tirs (tir D : 35 publiées, 0 écart). Les motifs du jour disent pourquoi : sous-fils sans question
(« that is awesome », « message me », « Saw monarchs today ») et lacunes de `faits-verifies.json`
qui reviennent (pucerons pour la sixième fois, pesticides, décomptes de monarques). Ce n'est pas
une panne du tir, c'est un corpus trop court pour ce que la Page reçoit — R-20260831-04 visait
déjà la récolte de ces lacunes.

**Aucun nouveau rapport d'achat bloqué depuis le 14 septembre.** Sept jours. Ni preuve que le
paiement est réparé, ni preuve du contraire : les sept rapports connus restent les seuls, et rien
n'a été tenté pour les reproduire.

**Latence du general-proxy : 22,5 s à la sonde, puis 0,24 à 0,49 s sur trois appels de suite.**
Démarrage à froid de Render, pas une panne. Noté parce que la ligne brute de la collecte se lit
comme une alerte.

**Récidive.** Écarts du tir D sans date : 1468, contre 1421 hier (R-20260830-02, 30 août).
Campagne points de vente : 46 jours sans envoi, et sa session du 17 septembre est toujours
`REVIEW_READY` non lue (R-20260830-01). Correctif Render `0a81d48` : 21 jours sur
`claude/scripts-render-deploy-bug-w0d1kf`, un seul commit, jamais fusionné.

**Travail laissé en plan, vue d'ensemble.** Douze branches divergent de `main` de 6 à 47 commits,
dont sept sans un commit depuis plus de trois semaines (`lasclay-negative-reviews-outreach`,
47 commits, dernier le 26 août ; `audit-previsions-pari`, 44 commits, 17 août). Aucune ne porte de
code de service Render — ce sont des dossiers de recherche finis ou abandonnés, pas des
déploiements bloqués. Rien à faire ce soir, mais la liste ne raccourcit jamais.

## Ce qui attend Gabriel

Ce que le snapshot ne porte pas :

- Question du 16 septembre, sans réponse : un marqueur humain « NE PAS ENVOYER » peut-il être
  levé par l'agent qui exécute l'envoi ?
- La session de la campagne points de vente est `REVIEW_READY`, non lue depuis le 17.
