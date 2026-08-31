# Revue quotidienne — dimanche 30 août 2026

Tour de 21 h 40 (Est). Fenêtre : 2026-08-30T04:00Z → 2026-08-31T04:00Z.
Preuves : `revue/jour/2026-08-30/collecte.json`, généré à 01:42Z.

## 1. Ce qui a tourné

| Routine | Tirée | Résultat | Trace vérifiée |
| --- | --- | --- | --- |
| Backlog FB — tir A (Lasclay) | oui | 18 publiées, 65 écartés | `A-journal.jsonl`, 0,5 h — à jour |
| Backlog FB — tir B (The Milkweed Company) | oui | 16 publiées, 105 écartés | `B-journal.jsonl`, 4,2 h — à jour |
| Backlog FB — tir C (Milkweed & Monarchs) | oui | 45 publiées, 19 écartés | `C-journal.jsonl`, 2,6 h — à jour |
| Backlog FB — tir D (Asclépiade & papillons monarques) | oui | 21 publiées, écarts **non comptés** (constat 2) | `D-journal.jsonl`, 0,7 h — à jour |
| Campagne points de vente | **aucune trace de production** | 0 envoi depuis le 6 août (constat 1) | `journal_envois.json` — 24 j |
| Sync skills claude.ai → repo | sans objet | aucun changement à synchroniser | `.claude/skills/`, 39 h — normal |
| Ramassages — resynchro de l'artefact | **invérifiable** | ne laisse aucune trace dans le dépôt | aucune, et pas d'outils `mcp__*` |
| Ramassages — lot d'étiquettes du mardi | **invérifiable** | ne laisse aucune trace dans le dépôt | aucune, et pas d'outils `mcp__*` |
| Revue quotidienne — contrôle qualité | oui | ce tour-ci | `revue/`, 13,1 h — à jour |

Les deux « Ramassages » sont **invérifiables**, pas saines : sans outils `mcp__*` dans une session
de Routine et sans trace dans le dépôt, la revue n'a rien sur quoi se prononcer. Aucun journal
Render n'est lisible (pas de `RENDER_API_KEY`) : la seule information sur les services est la sonde
HTTP ci-dessous.

## 2. Ce qui a été produit

- **100 réponses Facebook publiées, 100 confirmées chez Meta, 0 non confirmée, 0 erreur.**
  Réparties : A 18, B 16, C 45, D 21.
- **51 commits** dans la fenêtre, +3879/−216. La tête de `main` est `6cef054` (tir A de 21 h) :
  le travail du backlog est déployé, il ne dort pas sur une branche.
- **Santé des services** : `missive-proxy` 200 en 399 ms, `finance-proxy` 200 en 302 ms,
  `general-proxy` 200 en 12 511 ms. Les 12,5 s sont le réveil Render d'un service au repos, pas
  une panne — c'est le comportement documenté.
- **Boîte Missive** : 37 fils assignés, **aucun** touché dans la fenêtre du jour ; aucun brouillon
  laissé sans envoi sur les 4 fils les plus récents (`drafts` vide sur chacun). Aucune
  automatisation n'a écrit dans la boîte aujourd'hui.

## 3. Constats

### Constat 1 — La campagne points de vente n'envoie plus rien depuis 24 jours, et la revue la déclare « à jour » — **majeur**

`retail-expansion/journal_envois.json` contient 30 entrées, **toutes datées du 2026-08-06**.
`file_attente.json` compte 1419 fiches dont **339 à l'état `en_attente`** : la file n'est pas vide,
donc l'explication prévue par la note d'inventaire (« quand la file est vide, elle ne produit plus
rien ») ne tient pas. Le cron est `0 13 * * 2-4` : depuis le 6 août, une dizaine de tirs prévus
n'ont produit aucun envoi.

La fiche de collecte donne pourtant `age_h: 150.9`, `seuil_h: 192`, `verdict: "à jour"`. La mesure
est prise sur **le dernier commit touchant `retail-expansion/`** — `bc8f309` du 24 août, qui est une
réécriture de gabarits faite par une session humaine, pas un envoi de la routine. La revue mesure
donc l'activité éditoriale d'un répertoire et l'appelle production.

C'est précisément le cas que `ROUTINE.md` désigne comme le plus grave : une routine qui a l'air de
fonctionner. **Coût si rien n'est fait** : 339 détaillants restent en file indéfiniment, et le
tableau de bord continue d'afficher « à jour » — l'angle mort se referme sur lui-même.

### Constat 2 — Les écarts du tir D ne sont comptés nulle part — **majeur**

`revue/collecte.js:152` filtre les écarts sur `x.ecarte_le === jour`. Or dans
`fb-backlog/etat/D-a-revoir.json`, **108 entrées sur 108 n'ont aucun champ `ecarte_le`** : le tir D
horodate ses écarts dans un champ `quand` (ISO complet), là où les tirs A, B et C écrivent
`ecarte_le` (date seule). Les quatre fichiers n'ont pas le même schéma.

Conséquence mesurée : la collecte rapporte `ecartes_du_jour: 0` et `motifs_du_jour: []` pour le
tir D, alors que **44 entrées portent un `quand` dans la fenêtre du jour**, que le fichier a gagné
**328 lignes aujourd'hui**, et que dix commits du jour (`d78d4a8`, `2160222`, `c3bdeac`, `f3c4f1d`,
`6d4cdcf`, `e852562`, `47cb60d`, `3614ef7`, `9acdaf2`, `2df72e3`) annoncent chacun des écarts.

**Coût si rien n'est fait** : un quart du backlog Facebook échappe au contrôle qualité, et il y
échappe silencieusement — la revue affiche « 0 écarté » et donne l'impression d'avoir regardé.

### Constat 3 — Un même motif d'écart revient 24 fois au tir A — **mineur**

Sur les 65 écarts du jour au tir A, **24 portent le même motif** : des félicitations génériques sur
le billet du récit de maladie, écartées parce que plusieurs réponses y ont déjà été publiées et
qu'en ajouter relèverait de la répétition que Meta lit comme du spam. Le raisonnement est bon ; ce
qui cloche est qu'il soit refait à neuf 24 fois dans la journée, à chaque tir, au lieu d'être
tranché une fois dans `REGLES.md`.

**Coût si rien n'est fait** : coût de jugement répété, et surtout un risque de dérive — rien ne
garantit que le 25ᵉ passage tranche comme les 24 précédents.

### Ce qui n'est pas un constat

- **Heures sans publication** (A : 09, 10, 15, 17 ; B : 14 ; C : 13 ; D : 13, 15). L'inventaire
  documente qu'un tir saute volontairement 1 fois sur 6. Des trous d'une heure épars ne sont pas
  un incident.
- **`general-proxy` à 12,5 s.** Réveil Render, documenté comme tel.
- **Les 37 fils assignés dans Missive**, dont le plus ancien remonte au 2025-04-07. Ce sont des
  fils humains, pas de la production d'automatisation : hors du périmètre de cette revue.
- **La branche `claude/daily-review-routine-hbxozc`** (7 commits hors `main`) : intégralement
  contenue dans `claude/revue-quotidienne`. Rien n'y est perdu.

## 4. Ce qui attend Gabriel

- **`R-20260829-01` — « Rendre les journaux Render lisibles par la revue »**, `proposee` depuis le
  29 août, toujours sans décision. Rappelée ici, comme prévu.
- **Les trois propositions de ce soir**, ci-dessous.
- **La campagne points de vente est à l'arrêt** (constat 1). La revue observe et ne corrige pas :
  savoir *pourquoi* la routine ne produit plus demande de regarder son exécution, pas sa trace.
  C'est une décision de Gabriel, pas une amélioration à approuver.

## 5. Récidive

La revue du **29 août** n'a produit aucun `revue.md` — `revues_precedentes[0].revue` vaut `null`
dans la collecte de ce soir — alors que le tour était marqué SUCCEEDED. Le Chief l'avait relevé
(`f2b46c0`, `ad1e3d8` sur `origin/claude/chief`).

**Ce point est clos** : le tour de vérification de ce matin a poussé `3b4432c` sur
`claude/revue-quotidienne` à 08:33 (Est), et le présent tour écrit et pousse à son tour. La chaîne
d'écriture est établie ; ce n'est plus un constat ouvert.

À surveiller tout de même : le seuil de fraîcheur de la revue elle-même est de 48 h, ce qui laisse
un tour entièrement sauté passer pour « à jour » pendant deux jours. Même famille de défaut que le
constat 1 — signalé ici, pas encore proposé, pour tenir la limite de trois propositions par soir.

## 6. Améliorations proposées

Les identifiants sont créés par `revue/registre.js` au même commit que ce fichier ; ils figurent
dans `revue/REGISTRE.md`.

| ID | Gravité | Titre |
| --- | --- | --- |
| `R-20260830-01` | majeur | Mesurer la campagne points de vente sur ses envois, pas sur ses commits |
| `R-20260830-02` | majeur | Compter les écarts du tir D, qui n'entrent dans aucun total |
| `R-20260830-03` | mineur | Trancher dans `REGLES.md` le cas des félicitations génériques sur un billet déjà répondu |

Rien n'est appliqué ce soir : le registre ne contenait aucun item `approuvee` à l'ouverture du
tour. Ces trois-là s'appliqueront au plus tôt demain, et seulement s'ils passent à `approuvee`.
