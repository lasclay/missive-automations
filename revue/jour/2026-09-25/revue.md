# Revue du 25 septembre 2026

## Ce qui a tourné

| Routine | Verdict | Trace |
| --- | --- | --- |
| Backlog FB tir A | à jour (7,6 h) | 2 publiées, 2 écartés |
| Backlog FB tir B | à jour (3,3 h) | 9 publiées, 118 écartés |
| Backlog FB tir C | à jour (0,8 h) | 32 publiées, 91 écartés |
| Backlog FB tir D | à jour (1,9 h) | 21 publiées, 0 écarté daté |
| Ménage Admin *(hors inventaire)* | SUCCEEDED, 10 min | 1er tir, 11 h 17 |
| Ménage Operations *(hors inventaire)* | SUCCEEDED, 13 min | 12 h 17 |
| Campagne points de vente | ne tire pas le vendredi | dernier tir jeudi, 0 envoi |
| Sync skills, Ramassages, Revue | à jour | resynchro : sortie invérifiable |

64 réponses publiées, toutes confirmées chez Meta. Trois proxys à 200, aucune latence anormale.

## Constats

**Deux routines ferment des fils Missive et ne laissent aucune trace vérifiable.** Le ménage
Admin a tiré pour la première fois aujourd'hui (11 h 17, SUCCEEDED, 10 min) et le ménage
Operations a fait son deuxième passage (12 h 17, SUCCEEDED, 13 min). Les deux ferment et déplacent
des conversations en production, trois fois par semaine. `ops_triage.js` fait 399 lignes et ne
contient ni `writeFile`, ni `appendFile`, ni dossier d'état : rien de ce qu'il ferme n'est écrit
dans le dépôt. Le ménage Admin passe directement par `missive_client.js close`, même résultat. Le
proxy ne liste que les fils ouverts, donc même en interrogeant Missive je ne peux pas savoir ce
qui a été fermé aujourd'hui, ni si un fil de client s'est retrouvé dedans. Les quatre tirs
Facebook, eux, journalisent chaque réponse avec sa confirmation chez Meta — c'est précisément ce
qui les rend auditables. → proposition du soir.

**Le tir B est remonté à 9 publiées**, son meilleur chiffre depuis le 17 septembre. La série que
j'ai décrite mardi comme un effondrement était un trou d'une journée : la correction d'hier tient,
et je m'en tiens à ne plus lire ces séries avant que R-20260912-01 donne un instrument.

**Récidive.** Différés : 150 (+8) — R-20260920-01, cinq soirs. Escalades : 64. Écarts du tir D
sans date : 1733 (R-20260830-02). Correctif Render `0a81d48` : 25 jours hors de `main`. Aucun
nouveau rapport d'achat bloqué depuis le 14 septembre, onze jours. Les trois routines créées le
23 restent absentes de `revue/routines.json` (R-20260923-01) — les deux ménages ont tiré
aujourd'hui sans que la collecte les voie, la publication Instagram tire demain.

## Ce qui attend Gabriel

Ce que le snapshot ne porte pas :

- Deux routines ferment des conversations sans laisser de trace auditable. R-20260925-01 propose
  de leur faire écrire un journal, comme les tirs Facebook.
- Question du 16 septembre, toujours sans réponse : un marqueur humain « NE PAS ENVOYER »
  peut-il être levé par l'agent qui exécute l'envoi ?
