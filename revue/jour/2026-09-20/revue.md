# Revue du 20 septembre 2026

## Ce qui a tourné

| Routine | Verdict | Trace |
| --- | --- | --- |
| Backlog FB tir A | à jour (6,7 h) | 5 publiées, 1 écarté |
| Backlog FB tir B | à jour (2,3 h) | 3 publiées, 116 écartés |
| Backlog FB tir C | à jour (0,9 h) | 21 publiées, 58 écartés |
| Backlog FB tir D | à jour (0 h) | 29 publiées, 0 écarté daté |
| Campagne points de vente | **PÉRIMÉE** (654,9 h) | aucun envoi |
| Sync skills claude.ai → repo | à jour (102,9 h) | — |
| Revue quotidienne | à jour (24 h) | ce fichier |
| Ramassages (resynchro, étiquettes) | tirent, SUCCEEDED | sortie invérifiable |

58 réponses publiées, toutes confirmées chez Meta. Trois proxys à 200.

## Constats

**78 commentaires mis de côté « à reprendre » ne reviennent jamais.** 76 dans le tir C, 2 dans le
tir B, 12 ajoutés aujourd'hui, dont « A REPRENDRE EN PRIORITE […] c'est une cliente avec les
graines en main » et une abonnée qui vient d'arracher toute son asclépiade tropicale. Ces entrées
dorment dans `*-a-revoir.json` mêlées aux écarts définitifs : aucun champ ne les distingue, aucun
tir ne les relit. Même défaut que les 55 escalades (R-20260831-02), autre classe : celles-ci
doivent revenir au robot. → R-20260920-01.

**Écarts pour cause de récence : 142 depuis le 1er septembre, 136 dans le tir C**, dont 24
aujourd'hui — 41 % des écarts du tir C, le fait ayant été publié « dans la meme section » deux à
quatorze heures plus tôt. Assez récurrent pour que `REGLES.md` tranche la fenêtre une fois.

**Garde-fou Omnisend respecté, vérifié en direct.** `claude/klaviyo-newsletter-drafts-m9lzov` a
monté quatre campagnes et en a refait une ce matin (`779b19a`, 09 h 22). Lecture du proxy :
`status: draft`, `sent: 0` pour les quatre. Rien n'est parti sans confirmation humaine.

**Compteur « achat bloqué » corrigé : 7, pas 6.** Le septième (31 août, tir C) avait reçu une
réponse au lieu d'être écarté, et `*-repondus.json` ne garde que notre texte ; `snapshot.js` lit
maintenant les deux côtés (filtre validé, une seule correspondance). Le nombre de brouillons non
envoyés, lui, reste non mesurable : les deux étiquettes candidates rendent des volumes plafonnés
par l'API (283 fils, 100) — R-20260831-03 reste la réponse, pas une étiquette.

**La campagne points de vente attend un humain depuis le 17 septembre.** Elle a tiré le 17 à
13 h 03 et travaillé 3 min 30 (11 k jetons, 1,40 $ US), puis sa session
`session_01JtoX9bUfE3Djoot75yod1q` est restée `REVIEW_READY`, `unread: true`. Le garde-fou de son
étape 3 (« rebond au-dessus de 3 % : N'ENVOIE RIEN, écris à Gabriel, arrête ici ») expliquerait
les 45 jours sans envoi — piste, pas preuve : son transcript n'est pas lisible d'ici.

**Les deux « Ramassages » ne sont plus invérifiables : elles tirent.** Resynchro, 21 sept.
01 h 03 UTC, SUCCEEDED en 35 s ; étiquettes du mardi, 15 sept. 11 h 12, SUCCEEDED en 7 min. La
cadence est prouvée, la sortie (artefact, étiquettes) reste hors de portée. `routines.json` les
dit encore invérifiables sans nuance (R-20260831-01, `proposee`).

**Récidive.** Écarts du tir D sans date : 1421, contre 1345 hier — le tir en produit, la collecte
compte 0 (R-20260830-02, 30 août). Campagne points de vente : 45 jours sans envoi (R-20260830-01).
Les 6 commits de la branche Klaviyo ne touchent que `infolettres/` : aucun code Render n'y dort.

## Ce qui attend Gabriel

Ce que le snapshot ne porte pas :

- Question du 16 septembre, sans réponse : un marqueur humain « NE PAS ENVOYER » peut-il être
  levé par l'agent qui exécute l'envoi ?
- La session de la campagne points de vente (`REVIEW_READY`, non lue depuis le 17) : personne
  n'a vu ce qu'elle voulait dire.
