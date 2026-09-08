# Revue quotidienne — lundi 7 septembre 2026

Tour de 21 h 41 (Est). Fenêtre : 2026-09-07T04:00Z → 2026-09-08T04:00Z.
Preuves : `revue/jour/2026-09-07/collecte.json`, lectures directes du General Proxy et de l'API
Meta, boîte Missive.

> Sixième soir sans `list_triggers`. Les deux « Ramassages » restent **invérifiables**.

## 1. Ce qui a tourné

| Routine | Résultat du jour | Tirs | Trace | Verdict |
| --- | --- | --- | --- | --- |
| **Backlog FB — tir A (Lasclay)** | **1 publiée, 0 écarté** | **1** | 10,5 h | « à jour » — **quatrième jour de faux vert** |
| Backlog FB — tir B (Milkweed Company) | 10 publiées, 120 écartés | 15 | 3,2 h | à jour |
| Backlog FB — tir C (Milkweed & Monarchs) | 24 publiées, 32 écartés | 13 | 0,8 h | à jour |
| Backlog FB — tir D (Asclépiade & papillons) | 54 publiées, **67 écartés comptés 0** | 13 | 1,1 h | à jour |
| Campagne points de vente | pas de tir dû (lundi) | — | **32 j** | PÉRIMÉE (342,9 h) |
| Sync skills claude.ai → repo | — | — | 78,5 h | à jour |
| Ramassages ×2 | — | — | aucune | **invérifiables** |
| Revue quotidienne | ce tour-ci | — | 24 h | à jour |

## 2. Ce qui a été produit

- **89 réponses Facebook publiées** — A 1, B 10, C 24, D 54. Le tir D signe sa meilleure journée.
- **49 commits**, +3103/−80.
- **Santé** : `missive-proxy` 200 / 496 ms, `general-proxy` 200 / 176 ms, `finance-proxy` 200 / 283 ms.
- **Zéro échec 502 ou Meta**, deuxième jour consécutif.
- **Boîte Missive** : 44 fils assignés, aucun actif ; brouillons inchangés.
- **Escalades : 18**, aucune ajoutée.

## 3. Trois bonnes nouvelles, dont une importante

### Une fuite de jeton de Page a été trouvée, corrigée **et déployée** le jour même

Commit `842a524` (16 h 53) : Meta passe le jeton de Page dans la *query string*, et `httpJson`
reconstruisait ses messages d'erreur à partir de l'URL. **La moindre erreur Graph renvoyait donc un
jeton de Page complet au client** — qui finissait « dans les journaux, les transcriptions d'agent et
les rapports d'incident sans que personne l'ait demandé ». Constaté en direct par la session qui l'a
corrigé, sur une erreur « (#100) Comment not found ».

**J'ai vérifié que le correctif est vivant en production.** Appel volontairement fautif sur
`facebook/comment`, réponse du proxy :

> `…&access_token=[CAVIARDÉ] → 400 {"error":{"message":"Unsupported get request…`

Aucun jeton en clair. Le filtre couvre `access_token`, `api_key` et les en-têtes Bearer, et la
limite du corps d'erreur passe de 300 à 1200 caractères — ce qui rend enfin lisible le message de
Meta qui nomme la faute.

### Le déploiement fonctionne — je corrige mon propre cadrage

Ce correctif a été fusionné dans `main` à **16 h 53** et il est **actif en production à 21 h 45**.
J'écrivais depuis le 31 août que rien ne garantissait que les services tournent avec le code récent.
Ce soir j'ai une preuve directe du contraire : la chaîne `main` → Render livre, et en quelques
heures.

Le constat sur le quota de construction reste valable — 574 commits d'état en septembre relancent
six services pour rien, et le correctif `buildFilter` (`0a81d48`) **n'est toujours pas fusionné,
huitième soir**. Mais c'est un problème de coût et de gaspillage, **pas un blocage des livraisons**.
Je le dis plus précisément qu'avant.

### La base de faits grandit enfin

`fb-backlog/faits-verifies.json` a reçu deux enrichissements aujourd'hui : `62d05b2` (« ne jamais
s'auto-corriger sur un compliment ») et `c148ade` (« le déclencheur est le challenge, pas
l'inexactitude »). C'était le sujet de `R-20260831-04`, proposée le 31 août. Quelqu'un d'autre s'en
est chargé — tant mieux.

## 4. Constats

### Constat 1 — Le tir A empire : un seul tir aujourd'hui — **majeur, récidive J+4**

| Jour | Tirs du tir A | Tirs de B / C / D |
| --- | --- | --- |
| 3 sept | 9 | 12 / 8 / 12 |
| 4 sept | 3 | 13 / 12 / 14 |
| 5 sept | 2 | 10 / 11 / 11 |
| 6 sept | 4 | 13 / 9 / 12 |
| **7 sept** | **1** | **15 / 13 / 13** |

Une seule ligne de journal aujourd'hui : `2026-09-07T15:11:49Z`. Sept heures ouvrables sur huit sans
tir. La brève reprise d'hier n'a pas tenu, et la tendance est descendante sur cinq jours.

Le verdict de la collecte reste **« à jour (10,5 h) »**, quatrième journée consécutive de faux vert,
pour la raison déjà établie : un seuil de 30 heures ne peut pas voir l'arrêt d'une routine horaire.
`R-20260904-01` porte là-dessus et attend depuis le 4 septembre.

**Si rien n'est fait :** la page Lasclay — celle de la marque, pas celles des communautés — répond à
un commentaire par jour, et aucun instrument ne l'annonce.

### Constat 2 — Les cinq doublons publics sont toujours en ligne — **majeur, récidive J+3**

Vérifié en direct ce soir sur les quatre parents : 4, 2, 2 et 2 réponses de la Page, soit
**5 réponses en trop**, identiques à hier et avant-hier. Le connecteur `facebook` n'a toujours que
`diag, pages, posts, comments, comment, reply, hide, unhide, edit` — **pas de `delete`**, et `hide`
est refusé par Meta sur les commentaires de la Page.

Trois jours. C'est le genre de chose qu'un visiteur voit avant nous.

### Constat 3 — Le reste n'a pas bougé — **récidive**

| Constat | Signalé les | État |
| --- | --- | --- |
| Campagne à vide | 30, 31 août, 1–7 sept | **32 jours**, 30 entrées du 6 août |
| `buildFilter` non fusionné | 31 août, 1–7 sept | **huitième soir** |
| Écarts du tir D non comptés | 30, 31 août, 1–7 sept | **574 entrées, 0 `ecarte_le`** |
| Brouillons non envoyés | 31 août, 1–7 sept | 11, le plus vieux à **54 jours** |
| Escalades sans sortie | 31 août, 1–7 sept | **18** |

## 5. Ce qui attend Gabriel

1. **Le tir A** — quatre jours de baisse continue, un tir aujourd'hui. C'est passé devant tout le
   reste.
2. **Retirer les 5 doublons publics** — Business Suite, ou une action `delete` au proxy.
3. **Les 18 escalades** et les **11 brouillons**.
4. **La campagne points de vente** — 32 jours.
5. **Fusionner `0a81d48`** — moins urgent que je ne le disais : c'est du gaspillage de quota, pas un
   blocage.

**Registre : onze `proposee`, une `reportee`, zéro `approuvee` — dixième soir sans décision.**

## 6. Améliorations proposées : aucune

Rien à ajouter. Le tir A est couvert par `R-20260904-01`, les doublons par `R-20260905-01` et par les
correctifs du rapport d'incident, et `R-20260831-04` vient d'être réglée par quelqu'un d'autre sans
passer par le registre — ce qui est une réponse parfaitement valable, et vaut mieux qu'une file qui
s'allonge.
