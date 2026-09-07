# Revue quotidienne — dimanche 6 septembre 2026

Tour de 21 h 41 (Est). Fenêtre : 2026-09-06T04:00Z → 2026-09-07T04:00Z.
Preuves : `revue/jour/2026-09-06/collecte.json`, lectures directes de l'API Meta, boîte Missive.

> Cinquième soir sans `list_triggers`. Les deux « Ramassages » restent **invérifiables**.

Revue courte : rien de neuf ce soir, et deux nouvelles plutôt bonnes. Tout le reste est de la
récidive déjà documentée.

## 1. Ce qui a tourné

| Routine | Résultat du jour | Tirs | Trace | Verdict |
| --- | --- | --- | --- | --- |
| Backlog FB — tir A (Lasclay) | 4 publiées, 0 écarté | **4** | 3,5 h | à jour — cadence encore réduite |
| Backlog FB — tir B (Milkweed Company) | 10 publiées, 130 écartés | 13 | 0,2 h | à jour |
| Backlog FB — tir C (Milkweed & Monarchs) | 25 publiées, 55 écartés | 9 | 1,6 h | à jour |
| Backlog FB — tir D (Asclépiade & papillons) | 34 publiées, **32 écartés comptés 0** | 12 | 2 h | à jour |
| Campagne points de vente | pas de tir dû (dimanche) | — | **31 j** | PÉRIMÉE (318,9 h) |
| Sync skills claude.ai → repo | — | — | 54,5 h | à jour |
| Ramassages ×2 | — | — | aucune | **invérifiables** |
| Revue quotidienne | ce tour-ci | — | 23,9 h | à jour |

## 2. Ce qui a été produit

- **73 réponses Facebook publiées** — A 4, B 10, C 25, D 34.
- **45 commits**, +11789/−3965.
- **Santé** : `missive-proxy` 200 / 408 ms, `general-proxy` 200 / 229 ms, `finance-proxy` 200 / 493 ms.
- **Boîte Missive** : 44 fils assignés, aucun actif, brouillons inchangés.
- **Escalades : 18**, une ajoutée.

## 3. Deux bonnes nouvelles

### Aucun échec 502 aujourd'hui

Zéro commit du jour ne mentionne un échec 502 ou Meta, contre **six hier** (quatre au tir C, trois
au tir D). Je ne sais pas si quelque chose a été corrigé ou si la journée a simplement été
clémente — sans `list_triggers` ni journaux Render, je ne peux pas trancher. Mais le fait est là et
mérite d'être écrit au même titre que les mauvaises nouvelles.

### Le tir A se relève

Quatre tirs aujourd'hui, contre deux hier et trois avant-hier, et son journal se répartit enfin sur
la journée : 15 h 08, 15 h 09, 18 h 08, 22 h 09. Il reste loin des autres — **4 tirs contre 13, 9
et 12** — donc la cadence n'est pas rétablie, mais il n'est plus muet. Troisième jour de
surveillance.

## 4. Constats

### Constat 1 — Les cinq doublons publics n'ont toujours pas été retirés — **majeur, récidive J+2**

Vérifié en direct ce soir, les quatre commentaires parents nommés dans
`fb-backlog/INCIDENT-502-tirD.md` :

| Parent (fin de l'identifiant) | Réponses de la Page | En trop |
| --- | --- | --- |
| `…70_619372127668364` | 4 | **2** |
| `…0_1684105585563933` | 2 | **1** |
| `…70_536033022871979` | 2 | **1** |
| `…0_1388102012370651` | 2 | **1** |

**Cinq réponses en trop, toujours publiques**, plus de 24 heures après que l'incident ait été
documenté et signalé. Rien ne peut les retirer côté automatisation : le connecteur `facebook`
n'expose pas d'action `delete`, et `hide` est refusé par Meta sur les commentaires de la Page.

Le rapport d'incident propose déjà les trois correctifs (relecture après 502, corps d'erreur non
tronqué, action `delete`). Je n'en ajoute pas au registre : ce qui manque n'est pas une proposition,
c'est une décision.

### Constat 2 — Rien d'autre n'a bougé — **récidive**

| Constat | Signalé les | État ce soir |
| --- | --- | --- |
| Campagne à vide | 30, 31 août, 1–6 sept | **31 jours**, 30 entrées datées du 6 août |
| Correctif Render non fusionné | 31 août, 1–6 sept | **septième soir** ; 37 des 38 commits du jour sont de l'état pur |
| Écarts du tir D non comptés | 30, 31 août, 1–6 sept | **500 entrées, 0 `ecarte_le`** |
| Brouillons non envoyés | 31 août, 1–6 sept | 11, le plus vieux à **53 jours** |
| Escalades sans sortie | 31 août, 1–6 sept | **18** |
| Tir A à cadence réduite | 4, 5, 6 sept | 4 tirs contre 13, 9 et 12 |

## 5. Ce qui attend Gabriel

1. **Retirer les 5 doublons publics** — Business Suite, ou une action `delete` ajoutée au proxy.
2. **Fusionner `claude/scripts-render-deploy-bug-w0d1kf`** — septième soir.
3. **Les 18 escalades** et les **11 brouillons**, inchangés.
4. **La campagne points de vente** — un mois sans envoi.

**Registre : onze `proposee`, une `reportee`, zéro `approuvee` — neuvième soir sans décision.**

## 6. Améliorations proposées : aucune

Rien à ajouter ce soir. Le seul fait nouveau — les doublons non retirés — a déjà ses correctifs
écrits dans le rapport d'incident, et sa mesure dans `R-20260905-01`, proposée hier. Les onze items
en attente couvrent tout le reste.

Je continue de tenir la file courte plutôt que de l'allonger : depuis le 1er septembre, j'ai proposé
zéro, une, une, une, une et zéro. Ce n'est pas de la retenue de principe, c'est que le goulot n'est
pas du côté des propositions.
