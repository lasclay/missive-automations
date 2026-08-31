# Revue quotidienne — dimanche 30 août 2026

Tour repris le 31 août à 10 h (Est) à la demande de Gabriel. Fenêtre relue :
2026-08-30T04:00Z → 2026-08-31T04:00Z, **maintenant close** — le premier passage avait lieu à
21 h 42 le 30, donc à l'intérieur de sa propre fenêtre.

Preuves : `revue/jour/2026-08-30/collecte.json`, plus `list_triggers` et `list_sessions`.

## 0. Correction du premier passage

Le tour du 30 au soir a écrit que les outils `mcp__*` étaient absents et a déclaré deux routines
**invérifiables** sur cette base. C'était faux : `list_triggers` et `list_sessions` étaient
disponibles, et le sont toujours. La procédure (`ROUTINE.md`, étape 2) affirme qu'« une session
lancée par une Routine ne reçoit aucun outil `mcp__*` » ; `collecte.js` répète cette affirmation
dans son champ `non_collecte`. Les deux ont été crus sur parole au lieu d'être vérifiés par un
appel.

Ce que ça change : les deux « Ramassages » sont **vérifiés et sains**, la campagne points de vente
passe de « silencieuse » à **« déclarée SUCCEEDED sans rien produire »**, et l'inventaire des
routines se révèle périmé. Le tableau ci-dessous est le tableau corrigé.

## 1. Ce qui a tourné

| Routine | Tirée | Résultat | Trace vérifiée | Statut déclaré |
| --- | --- | --- | --- | --- |
| Backlog FB — tir A (Lasclay) | oui | 18 publiées, 65 écartés | `A-journal` 0,7 h | session liée, pas de `last_run` |
| Backlog FB — tir B (Milkweed Company) | oui | 16 publiées, 105 écartés | `B-journal` 16,5 h | session liée, pas de `last_run` |
| Backlog FB — tir C (Milkweed & Monarchs) | oui | 45 publiées, 19 écartés | `C-journal` 1,1 h | session liée, pas de `last_run` |
| Backlog FB — tir D (Asclépiade & papillons) | oui | 21 publiées, écarts **non comptés** (constat 2) | `D-journal` 0,1 h | session liée, pas de `last_run` |
| Campagne points de vente | **oui** | **0 envoi** (constat 1) | `journal_envois` — 25 j | **SUCCEEDED** @ 2026-08-27T13:04:51Z |
| Sync skills claude.ai → repo | oui | rien à synchroniser | `.claude/skills` 51,4 h | SUCCEEDED @ 2026-08-31T10:23:39Z |
| Ramassages — resynchro de l'artefact | oui | **sain** | aucune trace au dépôt | SUCCEEDED @ 2026-08-31T13:03:30Z |
| Ramassages — lot d'étiquettes du mardi | oui | **sain** | aucune trace au dépôt | SUCCEEDED @ 2026-08-25T11:25:07Z |
| Revue quotidienne — contrôle qualité | oui | ce tour-ci | `revue/` 12,3 h | session liée, pas de `last_run` |

Deux lectures que `last_run` seul ferait rater, et qui valent d'être dites :

- **Un `last_run` absent n'est pas un tir manqué.** Les routines liées à une session permanente
  n'enregistrent pas de run. Les quatre tirs Facebook sont dans ce cas : leur preuve reste leur
  journal, qui avance.
- **Un `last_run` SUCCEEDED ne prouve aucune production.** La campagne points de vente en est
  l'exemple, et c'est le constat 1.

## 2. Ce qui a été produit

- **100 réponses Facebook publiées, 100 confirmées chez Meta, 0 non confirmée, 0 erreur** —
  A 18, B 16, C 45, D 21. Chiffres identiques à ceux du premier passage : la fenêtre était déjà
  complète côté Facebook.
- **52 commits**, +5230/−319 (un commit de plus qu'au premier passage, arrivé après 21 h 42).
- **Santé des services** : `missive-proxy` 200 / 565 ms, `general-proxy` 200 / 658 ms,
  `finance-proxy` 200 / 589 ms. Les trois répondent vite — les 12,5 s observées hier soir étaient
  bien un réveil Render, ce que ce second passage confirme.
- **Boîte Missive** : 37 fils assignés, **aucun** touché dans la fenêtre ; aucun brouillon laissé
  sans envoi sur les fils récents. Aucune automatisation n'a écrit à un client.
- **Sessions Claude actives dans la fenêtre** : deux seulement, `REVIEW_READY` toutes les deux
  (« Routine de relecture quotidienne », « (gab) Lasclay MRP »). Aucune bloquée dans la fenêtre.

## 3. Constats

### Constat 1 — La campagne points de vente est déclarée SUCCEEDED et n'envoie rien depuis 25 jours — **majeur**

`trig_01MpfDwYo8AMsBc5GC3SgQvf` a tiré et enregistré **`ROUTINE_RUN_STATUS_SUCCEEDED` le
2026-08-27T13:04:51Z**. Pourtant `retail-expansion/journal_envois.json` contient 30 entrées,
**toutes datées du 6 août**, et `file_attente.json` compte 1419 fiches dont **339 `en_attente`** —
la file n'est pas vide, donc l'explication prévue par l'inventaire (« quand la file est vide, elle
ne produit plus rien ») ne tient pas.

Le premier passage appelait ça une routine silencieuse. C'est pire : **elle tire, elle réussit, et
elle ne produit rien.** Aucun statut ne le signalera jamais.

La collecte, elle, la classe « à jour » (`age_h` 163,2 · `seuil_h` 192) parce qu'elle mesure la
fraîcheur sur le dernier commit touchant `retail-expansion/` — `bc8f309` du 24 août, une réécriture
de gabarits par une session, pas un envoi. Statut déclaré et trace mesurée se trompent donc **dans
le même sens**, ce qui est exactement la situation où personne ne voit rien.

**Si rien n'est fait :** 339 détaillants restent en file, et les deux instruments censés se
contrôler l'un l'autre affichent vert.

### Constat 2 — Les écarts du tir D ne sont comptés nulle part — **majeur**

`revue/collecte.js:152` filtre les écarts sur `x.ecarte_le === jour`. Le tir D horodate les siens
dans un champ `quand` et n'a **aucun champ `ecarte_le`** : 108 entrées sur 108 de
`fb-backlog/etat/D-a-revoir.json`, dont les clés réelles sont `id, date, extrait, motif, page_id,
quand`. Les quatre fichiers n'ont pas le même schéma, et le filtre n'en connaît qu'un.

Mesuré : la collecte rapporte `ecartes_du_jour: 0` et `motifs_du_jour: []` pour le tir D, alors que
**44 entrées portent un `quand` dans la fenêtre**, que le fichier a gagné **328 lignes** dans la
journée, et que dix commits du jour (`d78d4a8` … `2df72e3`) annoncent chacun des écarts.

**Si rien n'est fait :** un quart du backlog Facebook échappe au contrôle qualité, en affichant
« 0 écarté » comme s'il avait été regardé.

### Constat 3 — L'inventaire des routines est périmé, et c'est lui qui cachait le reste — **majeur**

`list_triggers` retourne **11 routines**. `revue/routines.json` en suit **9**. L'écart n'est pas
qu'une question de nombre :

- La revue s'y suit elle-même sous l'id `trig_017tFgWR75UBgBu5FhwJQ9Bh` — **une routine désactivée**
  (`enabled: false`), nommée « Revue quotidienne — DÉSACTIVÉE ». La routine vivante est
  `trig_01XH6MqfMFPaYP5Vebb66Xie`, créée le 2026-08-30T12:31:34Z, et l'inventaire l'ignore.
- **`trig_01Yb5B4FJ8CrVTfPEwTPai9` — « Chief — point du matin »** (`13 11 * * *`, active) n'est
  suivie nulle part. La revue ne la regarde pas.

`ROUTINE.md` prévoit ce cas mot pour mot : « un inventaire périmé rend la revue aveugle sans le
dire ». C'est ce qui s'est produit — et il a fallu reprendre le tour avec les outils que la
procédure déclarait absents pour s'en apercevoir.

**Si rien n'est fait :** la revue continue de surveiller une routine morte, d'ignorer une routine
vivante, et de présenter le tout comme une couverture complète.

### Constat 4 — Un même motif d'écart revient 24 fois au tir A — **mineur**

Sur 65 écarts au tir A, **24 portent le même motif** : félicitations génériques sur le billet du
récit de maladie, écartées parce que plusieurs réponses y figurent déjà et qu'en ajouter relèverait
de la répétition que Meta lit comme du spam. Le raisonnement est bon ; ce qui cloche est qu'il soit
refait à neuf 24 fois au lieu d'être tranché une fois dans `REGLES.md`.

**Si rien n'est fait :** un coût de jugement répété, et le risque que le 25ᵉ passage tranche
autrement que les 24 précédents.

### Ce qui n'est pas un constat

- **Heures sans publication** (A : 09, 10, 15, 17 ; B : 14 ; C : 13 ; D : 13, 15) — un tir saute
  volontairement 1 fois sur 6, l'inventaire le documente.
- **`Sync skills` à 51,4 h sans commit** — sa note dit qu'elle ne committe que s'il y a un
  changement, et `list_triggers` confirme un SUCCEEDED ce matin à 10:23Z. L'ambiguïté que la note
  signalait est levée, dans le bon sens.
- **Les 37 fils assignés dans Missive**, dont le plus ancien remonte au 2025-04-07 : des fils
  humains, hors du périmètre de cette revue.
- **`claude/daily-review-routine-hbxozc`** (7 commits hors `main`) : intégralement contenue dans
  `claude/revue-quotidienne`, rien n'y est perdu.

## 4. Ce qui attend Gabriel

**Décisions sur le registre** — cinq items `proposee`, aucun `approuvee`, donc rien n'a été
appliqué ce tour-ci :

| ID | Gravité | Titre |
| --- | --- | --- |
| `R-20260829-01` | majeur | Rendre les journaux Render lisibles par la revue |
| `R-20260830-01` | majeur | Mesurer la campagne points de vente sur ses envois, pas sur ses commits |
| `R-20260830-02` | majeur | Compter les écarts du tir D, qui n'entrent dans aucun total |
| `R-20260830-03` | mineur | Trancher dans `REGLES.md` les félicitations génériques |
| `R-20260831-01` | majeur | Réconcilier l'inventaire des routines, et cesser de supposer `mcp__*` absent (proposé le 31) |

`R-20260831-01` est une **quatrième proposition pour le même tour**, au-delà de la limite de trois
fixée par la procédure. Je le signale plutôt que de le taire : elle sort de la reprise du tour, et
elle porte sur le défaut qui masquait les autres. Un `refuser` ou un `reporter` la retire en une
commande.

**Hors registre :**

- **La campagne points de vente est à l'arrêt** (constat 1). Savoir *pourquoi* une routine qui
  réussit ne produit rien demande de regarder son exécution, pas sa trace. C'est une décision, pas
  une amélioration à approuver.
- **Deux sessions bloquées ce matin**, hors de la fenêtre relue mais utiles à savoir :
  « Chief — Lasclay » (`BLOCKED`, 2026-08-31T11:16Z) et « (cath) MRP Lasclay »
  (`BLOCKED`, 2026-08-31T12:30Z).

## 5. Récidive

La revue du **29 août** n'a produit aucun `revue.md` (`revues_precedentes[0].revue` valait `null`)
alors que le tour était marqué SUCCEEDED. Ce second passage donne enfin la trace exacte :
`trig_017tFgWR75UBgBu5FhwJQ9Bh` a tiré le **2026-08-30T01:41:07Z** et a enregistré
`ROUTINE_RUN_STATUS_SUCCEEDED`. Rien n'est arrivé sur la branche. La routine a depuis été
**désactivée** et remplacée le 2026-08-30T12:31:34Z par `trig_01XH6MqfMFPaYP5Vebb66Xie`, liée à une
session permanente.

**Ce que je ne peux pas établir** : *pourquoi* ce tir n'a rien produit. La session portant le nom
de la revue (« Routine de relecture quotidienne ») résume son dernier tour par une évaluation de
dépôts de skills Obsidian — sans rapport avec un tour de revue —, mais rien ne prouve que ce soit
la session qu'a réveillée ce tir-là. Je le note comme piste, pas comme cause.

**Le point d'écriture, lui, est clos** : `3b4432c` le 30 au matin, `39bf1d0` le 30 au soir, et le
présent commit. La chaîne tient.

À surveiller : le seuil de fraîcheur de la revue est de 48 h, ce qui laisse un tour entièrement
sauté passer pour « à jour » pendant deux jours — même famille que le constat 1. Signalé, non
proposé : la file de décision est déjà à cinq.
