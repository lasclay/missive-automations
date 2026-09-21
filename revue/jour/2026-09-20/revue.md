# Revue du 20 septembre 2026

## Ce qui a tourné

| Routine | Verdict | Trace |
| --- | --- | --- |
| Backlog FB tir A | à jour (6,6 h) | 5 publiées, 1 écarté |
| Backlog FB tir B | à jour (2,3 h) | 3 publiées, 116 écartés |
| Backlog FB tir C | à jour (0,9 h) | 21 publiées, 58 écartés |
| Backlog FB tir D | à jour (3,1 h) | 26 publiées, 0 écarté daté |
| Campagne points de vente | **PÉRIMÉE** (654,9 h) | aucun envoi |
| Sync skills claude.ai → repo | à jour (102,9 h) | — |
| Revue quotidienne | à jour (24 h) | ce fichier |
| Ramassages (resynchro, étiquettes) | invérifiable | aucune trace au dépôt |

55 réponses publiées, toutes confirmées chez Meta. Trois proxys à 200.

## Constats

**78 commentaires mis de côté « à reprendre » ne reviennent jamais.** 76 dans le tir C, 2 dans
le tir B, 12 ajoutés aujourd'hui. Le motif dit explicitement de revenir — « A REPRENDRE EN
PRIORITE des que l'ecart sera suffisant: c'est une cliente avec les graines en main », et une
abonnée qui vient d'arracher toute son asclépiade tropicale. Ces entrées dorment dans
`*-a-revoir.json` mêlées aux écarts définitifs : aucun champ ne les distingue, aucun tir ne les
relit. Même défaut structurel que les 55 escalades (R-20260831-02), classe différente : celles-ci
doivent revenir au robot, pas à un humain. → proposition du soir.

**Écarts pour cause de récence : 142 depuis le 1er septembre, 136 dans le tir C.** 24 aujourd'hui,
soit 41 % des 58 écarts du tir C. Le fait avait été publié « dans la meme section » deux à
quatorze heures plus tôt. Le motif revient assez pour que `REGLES.md` tranche la fenêtre une fois
pour toutes au lieu de la rejuger chaque heure.

**Garde-fou Omnisend respecté, vérifié en direct.** La branche
`claude/klaviyo-newsletter-drafts-m9lzov` a monté quatre campagnes hier et en a refait une ce
matin (`779b19a`, 09 h 22). Lecture du proxy : quatre campagnes, `status: draft`, `sent: 0`.
Rien n'est parti sans confirmation humaine.

**Compteur « achat bloqué » corrigé : 7, pas 6.** Le septième rapport (31 août, tir C) avait reçu
une réponse au lieu d'être écarté ; `*-repondus.json` ne garde que notre texte, pas celui du
client, donc le compteur ne le voyait pas. `snapshot.js` lit maintenant les deux côtés — filtre
de réponse validé : une seule correspondance, celle visée.

**Brouillons non envoyés : toujours non mesurable.** Les deux étiquettes candidates rendent des
volumes plafonnés par l'API (« Draft AI Support » : 283 fils ; « Draft créé » : 100), pas un
compte de brouillons en attente. R-20260831-03 reste la réponse ; une étiquette n'y suffira pas.

**Récidive.** Écarts du tir D sans date : 1417, contre 1345 hier — le tir continue d'en produire
et la collecte continue de compter 0 (R-20260830-02, signalé depuis le 30 août). Campagne points
de vente : 45 jours sans un envoi (R-20260830-01, même date d'origine). Les 6 commits de la
branche Klaviyo ne touchent que `infolettres/` : aucun code Render n'y dort.

## Ce qui attend Gabriel

- 11 propositions en attente, aucune approuvée depuis l'ouverture du registre.
- Achat bloqué : 7 rapports clients, du 31 août au 14 septembre, deux pages. Jamais reproduit —
  tester le paiement veut dire passer une vraie commande en production.
- 55 escalades marquées « à traiter par un humain » sans sortie.
- Correctif Render `0a81d48` (`buildFilter`) toujours hors de `main`.
- Question du 16 septembre, sans réponse : un marqueur humain « NE PAS ENVOYER » peut-il être
  levé par l'agent qui exécute l'envoi ?
