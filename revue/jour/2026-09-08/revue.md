# Revue quotidienne — mardi 8 septembre 2026

Tour de 21 h 42 (Est). Fenêtre : 2026-09-08T04:00Z → 2026-09-09T04:00Z.
Preuves : `revue/jour/2026-09-08/collecte.json`, lectures directes de l'API Meta, boîte Missive.

> Septième soir sans `list_triggers`. Les deux « Ramassages » restent **invérifiables**.

## 1. Ce qui a tourné

| Routine | Résultat du jour | Tirs | Trace | Verdict |
| --- | --- | --- | --- | --- |
| Backlog FB — tir A (Lasclay) | 5 publiées, 1 écarté | **5** | 9,6 h | à jour — **matin seulement** |
| Backlog FB — tir B (Milkweed Company) | 6 publiées, 71 écartés | 11 | 1,2 h | à jour |
| Backlog FB — tir C (Milkweed & Monarchs) | 19 publiées, 65 écartés | 11 | 1,4 h | à jour |
| Backlog FB — tir D (Asclépiade & papillons) | 48 publiées, **44 écartés comptés 0** | 12 | 0 h | à jour |
| **Campagne points de vente** | **jour de tir, aucun envoi** | — | **33 j** | PÉRIMÉE (366,9 h) |
| Sync skills claude.ai → repo | a committé | — | 3,7 h | à jour |
| Ramassages ×2 | — | — | aucune | **invérifiables** |
| Revue quotidienne | ce tour-ci | — | 24 h | à jour |

## 2. Ce qui a été produit

- **78 réponses Facebook publiées** — A 5, B 6, C 19, D 48.
- **53 commits**, +5809/−115, sur six branches.
- **Santé** : `missive-proxy` 200 / 392 ms, `general-proxy` 200 / 342 ms, `finance-proxy` 200 / 367 ms.
- **Zéro échec 502 ou Meta**, troisième jour consécutif.
- **Boîte Missive** : 44 fils assignés, un actif ; brouillons inchangés.
- **Escalades : 19**, une ajoutée.

## 3. Constats

### Constat 1 — Le tir A remonte, mais s'arrête à midi — **majeur, récidive J+5**

Cinq tirs aujourd'hui, contre un hier. Les lignes de journal :

> `13:16Z` · `13:18Z` · `14:13Z` · `15:13Z` · `16:09Z`

soit **9 h 16 à 12 h 09 heure de l'Est** — puis plus rien. Les cinq heures ouvrables de l'après-midi
(13 h à 17 h) sont vides, alors que les tirs B, C et D ont tourné 11, 11 et 12 fois sur la journée
complète.

C'est mieux qu'hier et ce n'est pas rétabli : depuis cinq jours, le tir A tourne à 9, 3, 2, 4, 1 puis
5 tirs, sans jamais retrouver la douzaine des autres. Verdict de la collecte : « à jour (9,6 h) »,
cinquième journée de faux vert. `R-20260904-01` porte là-dessus depuis le 4 septembre.

### Constat 2 — Deuxième mardi consécutif sans envoi de la campagne — **majeur, récidive**

Mardi est un jour de tir (`0 13 * * 2-4`). `journal_envois.json` : **30 entrées, dernier envoi le
6 août**. Verdict **`PÉRIMÉE`, 366,9 h — 33 jours**.

Sur les deux semaines écoulées, six jours de tir sont passés (2, 3, 8 septembre et les trois de la
semaine précédente) : **zéro envoi**, 339 fiches toujours `en_attente`.

### Constat 3 — Les cinq doublons publics entament leur quatrième jour — **majeur, récidive J+4**

Vérifié en direct ce soir, mêmes chiffres qu'hier, avant-hier et le 5 : 4, 2, 2 et 2 réponses de la
Page sur les quatre parents, **5 en trop**.

### Constat 4 — Le reste n'a pas bougé — **récidive**

| Constat | Signalé les | État |
| --- | --- | --- |
| `buildFilter` non fusionné | 31 août, 1–8 sept | **neuvième soir** |
| Écarts du tir D non comptés | 30, 31 août, 1–8 sept | **623 entrées, 0 `ecarte_le`** |
| Brouillons non envoyés | 31 août, 1–8 sept | 11, le plus vieux à **55 jours** |
| Escalades sans sortie | 31 août, 1–8 sept | **19** |

## 4. Ce qui attend Gabriel

1. **Le tir A** — cinq jours à cadence réduite, arrêt systématique à midi. Le motif est maintenant
   assez net pour être diagnostiqué : il s'arrête à la même heure.
2. **Retirer les 5 doublons publics** — quatrième jour.
3. **La campagne points de vente** — 33 jours, six jours de tir manqués.
4. **Les 19 escalades** et les **11 brouillons**.
5. **Fusionner `0a81d48`** — gaspillage de quota, pas un blocage.

**Registre : onze `proposee`, une `reportee`, zéro `approuvee` — onzième soir sans décision.**

## 5. Améliorations proposées : aucune

Rien de neuf à proposer : les quatre constats sont couverts par `R-20260904-01`, `R-20260830-01`,
`R-20260905-01` et `R-20260830-02`, toutes en attente depuis quatre à neuf jours.

Une observation utile tout de même, pour la prochaine fois qu'on regardera le tir A : **il s'arrête
à midi, pas à une heure aléatoire.** Sa plage documentée est 9 h–17 h avec une pause à midi. Un
arrêt net à la pause, cinq jours de suite, ressemble davantage à un état qui ne se remet pas après
la pause qu'à une panne intermittente. Ce n'est pas un constat — je n'ai pas la preuve — mais c'est
la première piste à essayer.
