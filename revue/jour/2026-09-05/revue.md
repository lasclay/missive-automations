# Revue quotidienne — samedi 5 septembre 2026

Tour de 21 h 41 (Est). Fenêtre : 2026-09-05T04:00Z → 2026-09-06T04:00Z.
Preuves : `revue/jour/2026-09-05/collecte.json`, `fb-backlog/INCIDENT-502-tirD.md`, lectures
directes de l'API Meta via le General Proxy, boîte Missive.

> Quatrième soir sans `list_triggers`. Les deux « Ramassages » restent **invérifiables**.

## 1. Ce qui a tourné

| Routine | Résultat du jour | Tirs | Trace | Verdict collecte |
| --- | --- | --- | --- | --- |
| **Backlog FB — tir A (Lasclay)** | **1 publiée, 1 écarté** | **2** | 7,6 h | « à jour » — **deuxième jour de faux vert** |
| Backlog FB — tir B (Milkweed Company) | 5 publiées, 118 écartés | 10 | 1,2 h | à jour |
| Backlog FB — tir C (Milkweed & Monarchs) | 22 publiées, 63 écartés, **4 échecs 502** | 11 | 1,9 h | à jour |
| Backlog FB — tir D (Asclépiade & papillons) | 18 publiées, **43 écartés comptés 0**, **3 échecs Meta** | 11 | 1,1 h | à jour |
| Campagne points de vente | pas de tir dû (samedi) | — | **30 j** | PÉRIMÉE (294,9 h) |
| Sync skills claude.ai → repo | — | — | 30,5 h | à jour |
| Ramassages ×2 | — | — | aucune | **invérifiables** |
| Revue quotidienne | ce tour-ci | — | 24 h | à jour |

## 2. Ce qui a été produit

- **46 réponses Facebook publiées** — A 1, B 5, C 22, D 18. La collecte annonce **« 0 non
  confirmée chez Meta »**. C'est faux, et le constat 2 explique pourquoi.
- **43 commits**, +3674/−170.
- **Santé** : `missive-proxy` 200 / 457 ms, `general-proxy` 200 / 368 ms, `finance-proxy` 200 / 322 ms.
- **Boîte Missive** : 44 fils assignés, aucun actif ; les brouillons n'ont pas bougé.
- **Escalades : 17**, une ajoutée.

## 3. Constats

### Constat 1 — Six réponses en double sont toujours publiques, un jour après avoir été documentées — **majeur**

Une autre session a documenté ce matin (`50b9ac5`, `fb-backlog/INCIDENT-502-tirD.md`) que cinq
502 trompeurs sur `facebook/reply` avaient fait relancer le tir D, produisant **6 doublons publics**
sur la page Asclépiade & papillons monarques. Le 502 survient *après* l'écriture chez Meta : la
réponse était publiée, le tir a cru à un échec, il a republié.

**J'ai vérifié en direct ce soir.** Lecture du parent `988691833397470_619372127668364` par
`connectors_client.js facebook comments` :

> **4 réponses de notre Page, dont 3 rigoureusement identiques** — *« Noté, et merci de l'avoir
> partagé 🦋 L'image qui v… »*

Les doublons sont donc **encore en ligne**. Le rapport d'incident explique pourquoi : le connecteur
`facebook` n'expose pas d'action `delete`, et `hide` est refusé par Meta sur les commentaires de la
Page elle-même. Il faut un passage humain dans Business Suite, ou une action `delete` ajoutée au
proxy.

**Et ce n'est pas fini** : aujourd'hui encore, **six échecs 502 ou Meta** figurent dans les messages
de commit — quatre au tir C (7 h, 14 h ×2, 17 h) et trois au tir D (6 h, 8 h, 9 h). Chacun peut
masquer une écriture réussie.

### Constat 2 — La revue annonce « 0 non confirmée chez Meta » depuis huit soirs, et elle ne peut pas voir cette panne — **majeur, sur la revue elle-même**

C'est le constat qui me concerne. `collecte.js` calcule les non-confirmées en lisant le champ
`confirme` des lignes de `*-journal.jsonl`. Un 502 **n'écrit pas de ligne de journal** : pour la
collecte, il n'existe pas. D'où :

- huit soirs de suite, j'ai écrit **« 0 non confirmée chez Meta, 0 erreur »** ;
- pendant que 6 doublons publics vivaient sur une Page, et que 6 échecs 502 étaient enregistrés
  aujourd'hui même dans les messages de commit ;
- les fiches de la collecte affichent `erreurs: []` pour les quatre tirs.

J'ai aussi vérifié que **les journaux ne peuvent pas détecter les doublons** : sur les quatre tirs,
`0 commentaire répondu plus d'une fois` — y compris le tir D, où six doublons ont réellement été
publiés. La trace lisible par machine ne porte pas la panne.

Mon indicateur de qualité le plus visible était donc structurellement aveugle au seul incident de
production réel de la semaine.

### Constat 3 — Portée de l'incident : tranchée, les tirs A, B et C sont propres — **constat rassurant**

Le rapport d'incident laissait ouverte une question : *« Les tirs A, B et C utilisent le même
`traiter.js` : leurs pages peuvent porter les mêmes doublons. À vérifier. »*

Je l'ai vérifié. Lecture directe de **trois commentaires parents récents par tir**, sur les trois
pages, via l'API Meta :

| Tir | Parents lus | Réponses de la Page | Doublons |
| --- | --- | --- | --- |
| A (Lasclay) | 3 | 1 chacun | **0** |
| B (The Milkweed Company) | 3 | 1 chacun | **0** |
| C (Milkweed & Monarchs) | 3 | 1 chacun | **0** |

C'est un échantillon de neuf, pas une preuve exhaustive — mais aucun doublon n'apparaît hors du
tir D. La question de l'incident peut être refermée avec cette réserve.

### Constat 4 — Le tir A est dégradé pour le deuxième jour — **majeur, récidive**

Deux tirs aujourd'hui (10 h, 14 h Est), **1 réponse publiée et 1 écarté**. Son journal porte un trou
de **28 heures** : `2026-09-04T14:12:40Z` → `2026-09-05T18:07:47Z`. Verdict de la collecte :
« à jour (7,6 h) ».

Le Chief l'a relevé ce matin, dans les mêmes termes que moi hier soir — commit `2950100` :
*« tir A muet depuis 21 h, invisible pour une mesure déjà en fausse alerte »*. Deux agents
indépendants voient la même chose ; l'instrument, lui, reste au vert. `R-20260904-01`, proposée
hier, porte exactement là-dessus.

### Ce qui n'est pas un constat

- **Campagne points de vente** : samedi, pas de tir dû. Mais la trace atteint **30 jours**.
- **Tir B : 5 publiées pour 118 écartés**, sept heures creuses. Page à faible volume, documenté.
- **34 des 35 commits du jour sur `main` sont de l'état pur** — voir récidive.

## 4. Ce qui attend Gabriel

1. **Supprimer les 6 doublons publics** sur la page Asclépiade & papillons monarques (constat 1).
   Ils sont en ligne depuis au moins hier. Ni la revue ni le proxy ne peuvent le faire : `delete`
   n'existe pas et `hide` est refusé. C'est Business Suite, ou une action ajoutée au proxy.
2. **Le tir A**, deuxième journée à l'arrêt (constat 4).
3. **Fusionner `claude/scripts-render-deploy-bug-w0d1kf`** — sixième soir.
4. **Les 17 escalades** et les **11 brouillons** — inchangés, le plus vieux à 52 jours.

## 5. Récidive

| Constat | Signalé les | État |
| --- | --- | --- |
| Campagne à vide | 30, 31 août, 1–5 sept | **30 jours** |
| Correctif Render non fusionné | 31 août, 1–5 sept | 34 des 35 commits du jour sont de l'état |
| Écarts du tir D non comptés | 30, 31 août, 1–5 sept | **454 entrées, 0 `ecarte_le`** |
| Brouillons non envoyés | 31 août, 1–5 sept | 11, le plus vieux à 52 jours |
| Escalades sans sortie | 31 août, 1–5 sept | **17** |
| Tir A dégradé | 4, 5 sept | deuxième jour |

**Registre : dix `proposee`, zéro `approuvee` — huitième soir sans décision.**

## 6. Amélioration proposée

- **`R-20260905-01`** *(majeur)* — Faire entrer les échecs 502 et les doublons dans la mesure de
  qualité, au lieu de compter uniquement les lignes de journal.

Une seule, et elle porte sur le défaut de mon propre instrument. Les autres constats du soir sont
couverts par `R-20260904-01` (tir A) et par les propositions en attente depuis six jours.
