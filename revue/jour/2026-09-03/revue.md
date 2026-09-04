# Revue quotidienne — jeudi 3 septembre 2026

Tour de 21 h 41 (Est). Fenêtre : 2026-09-03T04:00Z → 2026-09-04T04:00Z.
Preuves : `revue/jour/2026-09-03/collecte.json`, boîte Missive, fichiers d'état du backlog.

> **Deuxième soir sans outils `mcp__*`.** `list_triggers` et `list_sessions` restent injoignables.
> Les routines sont jugées sur leur trace seule, les deux « Ramassages » ressortent
> **invérifiables**, et je ne les déclare pas saines. Je ne peux pas non plus confirmer qu'une
> routine a tiré : seulement ce qu'elle a laissé.

## 1. Ce qui a tourné

| Routine | Résultat du jour | Trace vérifiée | Verdict |
| --- | --- | --- | --- |
| Backlog FB — tir A (Lasclay) | 13 publiées, 47 écartés, **9 tirs** | `A-journal` 2,5 h | à jour |
| Backlog FB — tir B (Milkweed Company) | 2 publiées, 82 écartés, **12 tirs** | `B-journal` 6,3 h | à jour |
| Backlog FB — tir C (Milkweed & Monarchs) | 15 publiées, 57 écartés, **8 tirs** | `C-journal` 0,7 h | à jour |
| Backlog FB — tir D (Asclépiade & papillons) | 29 publiées, **49 écartés comptés 0**, 12 tirs | `D-journal` 0 h | à jour |
| **Campagne points de vente** | **aucun envoi** | `journal_envois` — **28 j** | **PÉRIMÉE (246,9 h)** |
| Sync skills claude.ai → repo | aucun commit depuis 72 h | `.claude/skills` 72 h | **non confirmable ce soir** |
| Ramassages — resynchro de l'artefact | — | aucune au dépôt | **invérifiable** |
| Ramassages — lot d'étiquettes du mardi | — | aucune au dépôt | **invérifiable** |
| Revue quotidienne — contrôle qualité | ce tour-ci | `revue/` 24 h | à jour |

## 2. Ce qui a été produit

- **59 réponses Facebook publiées, 59 confirmées chez Meta, 0 non confirmée, 0 erreur.**
  A 13, B 2, C 15, D 29. C'est **moitié moins qu'hier** (105) — voir plus bas, ce n'est pas une
  panne.
- **52 commits**, +5492/−193.
- **Santé** : `missive-proxy` 200 / 476 ms, `general-proxy` 200 / 351 ms, `finance-proxy` 200 / 316 ms.
- **Boîte Missive** : 44 fils assignés (45 hier), un seul actif dans la fenêtre.
- **Escalades du backlog : 15, aucune ajoutée aujourd'hui.** Première journée sans nouvelle
  escalade depuis que je les compte.

## 3. Constats

### Constat 1 — La proposition que j'ai faite hier ne fonctionne pas ; je l'ai testée — **majeur, autocorrection**

Hier j'ai proposé `R-20260902-01` : compter le reproche d'inauthenticité par recherche de mots-clés.
J'ai exécuté cette recherche à la main ce soir, sur les quatre fichiers `a-revoir`. Résultat :
**59 occurrences**, dont l'échantillon visible ne contient **aucun vrai positif** :

> *« Un beau message et j'ai rit par contre »* · *« J'ai acheté les mitaines, c'est miraculeux! »* ·
> *« je pellette la neige une demi-heure avec mes… »*

La cause est bête et nette : le motif `\bA-?I\b` capte **le verbe « ai » en français**. Pour trois
vrais cas connus, le compteur en crierait 59 — il serait ignoré dès le deuxième soir, et il aurait
rendu la revue moins fiable, pas plus.

J'avais écrit dans la clause de risque que « une recherche par mots-clés ramassera des faux
positifs ». Le test montre que ce n'est pas une réserve mineure : c'est le comportement dominant.

**Ce que j'ai fait :** `R-20260902-01` est passée à `reportee` avec cette raison, et remplacée par
**`R-20260903-01`**, qui n'accepte que des formes multi-mots et embarque un jeu de validation — les
trois vrais cas plus cinq faux positifs avérés — que le tour exécute **avant** de publier son
compte. La file reste à neuf items ; c'est le contenu qui change, pas le volume.

Le signal lui-même n'a pas bougé : trois personnes, deux canaux, et le fil `df1ba00d`
(« J'aimerais que ce ne soit pas l'intelligence artificielle qui réponde ») traîne toujours son
brouillon du 16 juillet.

### Constat 2 — Campagne points de vente : 28 jours, et le jeudi n'a rien changé non plus — **majeur, récidive**

Jeudi est le dernier jour de tir de la semaine (`0 13 * * 2-4`). Sans `list_triggers` je ne peux pas
confirmer le tir ; la trace, elle, est identique depuis six tours :

- `journal_envois.json` : **30 entrées, dernier envoi le 6 août** ;
- dernier commit de branche : `bc8f309`, 24 août ;
- **`PÉRIMÉE`, 246,9 h**.

Mardi, mercredi, jeudi : les trois jours de tir de la semaine sont passés, **zéro envoi**.
339 fiches `en_attente`.

### Constat 3 — Le correctif Render n'est toujours pas fusionné, quatrième soir — **majeur, récidive**

`0a81d48` reste hors de `main`. Aujourd'hui : **55 commits sur `main`, dont 48 d'état pur** (87 %).
Signalé les 31 août, 1er, 2 et 3 septembre. Une commande.

### Constat 4 — Tir D : 49 écarts de plus, toujours comptés zéro — **majeur, récidive**

`D-a-revoir.json` est passé à **329 entrées**, dont **0 avec un champ `ecarte_le`**. La collecte
rapporte `0 écarté` pour le tir D pour le cinquième soir. Sur les quatre jours que je mesure, ce
sont **211 écarts** (44 + 69 + 36 + 49 + 13 le 30) qui n'entrent dans aucun total.

### Ce qui n'est pas un constat

- **La production Facebook a chuté de moitié** (105 → 59). Ce n'est pas une panne : les quatre tirs
  ont tiré 8 à 12 fois chacun aujourd'hui. Le gisement était mince, voilà tout.
- **Tir B : 2 publiées pour 82 écartés** malgré 12 tirs. Page à faible volume, documenté — mais la
  série descend : 16, 5, 10, 11, 2 sur cinq jours. **À surveiller**, pas encore à conclure.
- **`Sync skills` sans commit depuis 72 h** : elle ne committe que s'il y a un changement, et sans
  `list_triggers` je ne peux pas confirmer qu'elle a tiré. Je note l'incertitude plutôt que de
  trancher dans un sens ou dans l'autre.
- **Aucune nouvelle escalade aujourd'hui** — bonne nouvelle, après deux jours à une plainte de
  commande par jour.

## 4. Ce qui attend Gabriel

1. **Fusionner `claude/scripts-render-deploy-bug-w0d1kf`** — quatrième soir.
2. **Les 15 escalades** en souffrance, dont deux plaintes de commande publiques et l'accusation
   « FAKE / A-I ».
3. **Les 11 brouillons** — aucun n'a bougé depuis avant-hier ; le plus ancien atteint **50 jours**,
   et trois ont un `to` vide.
4. **Pourquoi la campagne ne produit rien** — trois jours de tir cette semaine, zéro envoi.

**Registre : neuf `proposee`, une `reportee` (la mienne), zéro `approuvee` — sixième soir sans
décision.** Rien n'a été appliqué.

## 5. Récidive

| Constat | Signalé les | État |
| --- | --- | --- |
| Campagne à vide | 30, 31 août, 1, 2, 3 sept | **28 jours**, trois jours de tir manqués cette semaine |
| Correctif Render non fusionné | 31 août, 1, 2, 3 sept | 48 commits d'état sur `main` aujourd'hui |
| Écarts du tir D non comptés | 30, 31 août, 1, 2, 3 sept | **329 entrées, 0 `ecarte_le`** |
| Brouillons non envoyés | 31 août, 1, 2, 3 sept | 11 restants, le plus vieux à 50 jours |
| Escalades sans sortie | 31 août, 1, 2, 3 sept | 15, **aucune ajoutée aujourd'hui** |
| Inventaire des routines périmé | 30, 31 août | invérifiable, deuxième soir |

## 6. Amélioration proposée

- **`R-20260903-01`** *(majeur)* — Compter le reproche d'inauthenticité sur des formes multi-mots,
  validées sur trois cas connus. Elle remplace `R-20260902-01`, passée à `reportee`.

Aucune autre : les quatre autres constats de ce soir sont couverts par `R-20260830-01`,
`R-20260830-02`, `R-20260831-02` et `R-20260831-03`, tous en attente depuis quatre jours ou plus.
