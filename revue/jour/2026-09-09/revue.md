# Revue quotidienne — mercredi 9 septembre 2026

Tour de 21 h 41 (Est). Fenêtre : 2026-09-09T04:00Z → 2026-09-10T04:00Z.
Preuves : `revue/jour/2026-09-09/collecte.json`, douze jours de journaux du backlog, lectures
directes de l'API Meta.

> Huitième soir sans `list_triggers`. Les deux « Ramassages » restent **invérifiables**.

## 1. Ce qui a tourné

| Routine | Résultat du jour | Trace | Verdict |
| --- | --- | --- | --- |
| Backlog FB — tir A (Lasclay) | 4 publiées, 2 écartés | 2,5 h | à jour |
| Backlog FB — tir B (Milkweed Company) | 5 publiées, 80 écartés | 0,1 h | à jour |
| Backlog FB — tir C (Milkweed & Monarchs) | 13 publiées, 96 écartés | 0,9 h | à jour |
| Backlog FB — tir D (Asclépiade & papillons) | 42 publiées, écarts comptés 0 | 0,9 h | à jour |
| Campagne points de vente | jour de tir, aucun envoi | **34 j** | PÉRIMÉE (390,9 h) |
| Sync skills claude.ai → repo | — | 27,7 h | à jour |
| Ramassages ×2 | — | aucune | **invérifiables** |
| Revue quotidienne | ce tour-ci | 24 h | à jour |

**64 réponses publiées, 64 confirmées, 0 erreur.** 52 commits. Trois proxys à 200 (474 / 342 /
410 ms). **Zéro échec 502, quatrième jour.** Escalades : 20.

## 2. Le constat du soir est une correction de deux erreurs à moi

### Ce que j'ai écrit hier était faux

Hier j'ai proposé une piste : *« le tir A s'arrête à midi, pas à une heure aléatoire […] un arrêt
net à la pause, cinq jours de suite »*. J'ai vérifié ce soir en dépliant douze jours de journal,
heure par heure, en heure de l'Est. **La piste ne tient pas.** Dernière ligne de chaque journée :

> 29 août `22 h` · 30 `21 h` · 31 `21 h` · 1er sept `22 h` · 2 `20 h` · 3 `19 h` · 4 `10 h` ·
> 5 `14 h` · 6 `18 h` · 7 `11 h` · 8 `12 h` · **9 `19 h`**

Aucun arrêt systématique à midi : hier c'était 12 h, aujourd'hui 19 h, le 6 c'était 18 h. J'avais
bâti une hypothèse sur une seule journée et je l'ai présentée comme un motif. C'était prématuré.

### Ce que les données montrent vraiment : une rupture nette le 4 septembre

Éléments traités par jour (publiées + écartés) :

| | 1er | 2 | 3 | **4** | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **tir A** | 91 | 115 | 60 | **9** | 2 | 4 | 6 | 6 | 6 |
| tir C | 22 | 37 | 16 | 25 | 26 | 25 | 31 | 21 | 13 |
| tir D | 27 | 28 | 29 | 41 | 25 | 41 | 58 | 50 | 42 |

Le tir A passe de 60–115 éléments par jour à 2–9, **du jour au lendemain, le 4 septembre**, et y
reste. Les trois autres tirs ne bougent pas ; le tir D monte même.

Le point important : **ses écarts se sont effondrés en même temps que ses publications**
(`A-a-revoir` : 72, 83, 47 les 1er–3 septembre, puis 6, 1, 0, 0, 1, 2). Une routine qui publierait
mal continuerait d'écarter. Celle-ci **ne voit presque plus rien**.

### Et la page, elle, n'est pas vide

J'ai lu les trois dernières publications de la page Lasclay via l'API :

| Publication | Commentaires | Du public | De nous |
| --- | --- | --- | --- |
| 8 sept | 10 | **7** | 3 |
| 6 sept | 22 | **13** | 9 |
| 5 sept | 2 | 1 | 1 |

Il y a donc de la matière. Une partie est exactement ce que `REGLES.md` écarte — *« Bravo!👏 »*,
*« Ma prefffff 🥰😇 »*, des félicitations sans question — mais elle devrait alors ressortir comme
**écart**, et les écarts sont à 1 ou 2 par jour.

**Ce que je ne peux pas trancher :** si le tir A cherche mal (une collecte qui ne ramène plus rien)
ou s'il trouve correctement peu. Cela demande ses journaux d'exécution, que le dépôt ne porte pas et
qu'aucun outil ne me donne. Je m'arrête là plutôt que de deviner une troisième fois.

### Conséquence sur le registre

`R-20260904-01` — « juger les tirs horaires sur leur cadence du jour » — est passée à **`reportee`**.
Telle qu'écrite, elle déclencherait une alerte `INTERROMPUE` sur le tir A **chaque jour**, sans
qu'on sache si l'alerte est juste. C'est précisément le faux positif que sa propre clause de risque
annonçait, et que je n'avais pas vérifié avant de la proposer.

**Je ne propose pas de variante ce soir.** Le bon instrument dépend de la réponse à la question
ci-dessus, et je ne l'ai pas.

## 3. Les récidives, inchangées

| Constat | Signalé les | État |
| --- | --- | --- |
| Campagne à vide | 30, 31 août, 1–9 sept | **34 jours**, troisième mercredi sans envoi |
| Doublons publics | 5–9 sept | **5 en trop**, cinquième jour, vérifiés à nouveau |
| `buildFilter` non fusionné | 31 août, 1–9 sept | dixième soir |
| Écarts du tir D non comptés | 30 août – 9 sept | **686 entrées, 0 `ecarte_le`** |
| Brouillons non envoyés | 31 août – 9 sept | 11, le plus vieux à **56 jours** |
| Escalades sans sortie | 31 août – 9 sept | **20** |

## 4. Ce qui attend Gabriel

1. **Le tir A** — la question est maintenant précise : *pourquoi ne voit-il presque plus rien depuis
   le 4 septembre ?* Ses journaux d'exécution répondraient en cinq minutes.
2. **Retirer les 5 doublons publics** — cinquième jour.
3. **La campagne points de vente** — 34 jours.
4. **Les 20 escalades**, les **11 brouillons**.

**Registre : dix `proposee`, deux `reportee`, zéro `approuvee` — douzième soir sans décision.**

## 5. Améliorations proposées : aucune

Une retirée, aucune ajoutée. Sur douze soirs j'ai proposé onze améliorations et j'en ai retiré deux
après les avoir testées — `R-20260902-01` parce que son motif capturait le verbe « ai », et
`R-20260904-01` ce soir. Les deux fois, le défaut était le même : j'avais écrit la clause de risque
juste, puis proposé sans l'avoir vérifiée. Je préfère le dire que le laisser dans le dossier.
