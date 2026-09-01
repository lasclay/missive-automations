# Revue quotidienne — lundi 31 août 2026

Tour de 21 h 41 (Est). Fenêtre : 2026-08-31T04:00Z → 2026-09-01T04:00Z.
Preuves : `revue/jour/2026-08-31/collecte.json`, `list_triggers`, `list_sessions`, boîte Missive.

> **Sur les outils.** Le texte de la Routine affirme que cette session n'a aucun outil `mcp__*` et
> demande de déclarer les deux « Ramassages » invérifiables. C'est faux : `list_triggers` et
> `list_sessions` répondent. `ROUTINE.md` (qui fait autorité) dit de s'en servir quand ils sont là,
> et c'est ce que fait ce tour. `R-20260831-01`, toujours `proposee`, porte exactement là-dessus.
> À noter tout de même : le nom du serveur a changé en cours de session — l'appel d'hier
> (`mcp__Claude_Code_Remote__…`) échoue aujourd'hui, il faut passer par l'identifiant complet. Une
> vérification par appel reste donc indispensable ; une liste d'outils codée en dur vieillirait.

## 1. Ce qui a tourné

| Routine | Résultat du jour | Trace vérifiée | Statut déclaré |
| --- | --- | --- | --- |
| Backlog FB — tir A (Lasclay) | 20 publiées, 99 écartés | `A-journal` 0,5 h | session liée |
| Backlog FB — tir B (Milkweed Company) | 5 publiées, 59 écartés | `B-journal` 0,3 h | session liée |
| Backlog FB — tir C (Milkweed & Monarchs) | 54 publiées, 42 écartés | `C-journal` 0,9 h | session liée |
| Backlog FB — tir D (Asclépiade & papillons) | 38 publiées, **69 écartés comptés 0** | `D-journal` 2 h | session liée |
| Campagne points de vente | ne tire pas le lundi | `journal_envois` — 26 j | SUCCEEDED @ 2026-08-27T13:04:51Z |
| Sync skills claude.ai → repo | a committé aujourd'hui | `.claude/skills` 0 h | SUCCEEDED @ 2026-08-31T10:23:39Z |
| Ramassages — resynchro de l'artefact | **sain** | aucune au dépôt | SUCCEEDED @ 2026-09-01T01:03:41Z |
| Ramassages — lot d'étiquettes du mardi | **sain**, cadence correcte | aucune au dépôt | SUCCEEDED @ 2026-08-25T11:25:07Z |
| Revue quotidienne — contrôle qualité | ce tour-ci | `revue/` 11,6 h | session liée |

Les quatre tirs Facebook et la revue sont liés à une session permanente : `last_run` y est
absent par construction, ce qui **n'est pas** un tir manqué. Leur preuve reste leur journal.

## 2. Ce qui a été produit

- **117 réponses Facebook publiées, 117 confirmées chez Meta, 0 non confirmée, 0 erreur.**
  A 20, B 5, C 54, D 38. Meilleure journée de la semaine.
- **78 commits**, +18551/−4393, sur sept branches. Tête de `main` : `c88eb45`.
- **Santé des services** : `missive-proxy` 200 / 708 ms, `general-proxy` 200 / 578 ms,
  `finance-proxy` 200 / 330 ms.
- **Boîte Missive** : 45 fils assignés (37 hier), **21 touchés dans la fenêtre**.
- **Neuf sessions Claude actives**, dont deux bloquées.

## 3. Constats

### Constat 1 — Douze réponses sont rédigées et n'ont jamais été envoyées, la plus vieille depuis 48 jours — **majeur**

Sur les **21 fils touchés aujourd'hui, 12 portent un brouillon non envoyé**. Recensement complet,
pas un échantillon :

| Fil | Date du brouillon | Âge |
| --- | --- | --- |
| `ffae4d7a` | 2026-07-15 | 48 j, **`to` vide** |
| `7eb6d62f` (Cache-cou) | 2026-07-16 | 47 j |
| `df1ba00d` | 2026-07-16 | 47 j |
| `640e6213` (Semelles) | 2026-07-17 | 46 j |
| `1d8f9d14` (Missing seed bombs) | 2026-07-19 | 44 j |
| `5df68402` (Foulard abîmé) | 2026-07-20 | 43 j |
| `59166b01` (Cache-cou) | 2026-07-21 | 42 j |
| `7434b4bc` (Commande L-47976) | 2026-07-23 | 40 j |
| `3a4255f4` (Commande L-46837) | 2026-08-01 | 31 j |
| `88f3058f` | 2026-08-20 | 12 j, **`to` vide** |
| `5eef512f` | 2026-08-20 | 12 j, **`to` vide** |
| `eb108a7f` (Facture L-50943) | 2026-08-30 | 2 j |

Trois d'entre eux ont un champ **`to` vide** : même en cliquant « envoyer » à la main, ils ne
partiraient pas. Les sujets ne sont pas anodins — « Foulard abîmé », « Missing seed bombs »,
« Commande L-46837 », « Facture L-50943 ».

Le travail de rédaction a été fait ; c'est le dernier geste qui manque. Aucune routine suivie ne
couvre la boîte support, donc rien ne surveille ce stock.

**Si rien n'est fait :** des clientes et clients attendent depuis six semaines une réponse qui est
déjà écrite, et la boîte accumule un arriéré invisible qu'aucun instrument ne compte.

### Constat 2 — Le déploiement Render est à sec, et le correctif dort sur une branche — **majeur**

La session « Scripts render bug et déploiements » conclut : *« render deploy bug: buildFilter +
`[skip render]` applied; **quota exhausted (user side)** »*. Son correctif est le commit `0a81d48`
du 31 août à 09:58, sur `claude/scripts-render-deploy-bug-w0d1kf` — **jamais fusionné**.

J'ai vérifié la volumétrie moi-même plutôt que de reprendre son diagnostic : sur `main` en août,
**534 commits, dont 278 (52 %) ne touchent que `fb-backlog/etat/`** — de l'état pur, aucun code de
service. Six services Render suivent `main` et se reconstruisent à chacun. Aujourd'hui seul :
50 commits sur `main`.

Le correctif est donc sur une branche, et il porte précisément sur ce qui empêche les branches
d'être déployées. Les sondes HTTP restent à 200 : les services **tournent**, mais rien ne garantit
qu'ils tournent avec le code récent.

**Si rien n'est fait :** chaque fusion dans `main` consomme un quota déjà épuisé, et une correction
urgente pourrait ne pas se déployer sans que personne le voie — les sondes continueront d'afficher
vert.

### Constat 3 — Une accusation publique « FAKE / A-I » attend un humain dans un fichier que personne ne lit — **majeur**

Le tir C a écarté un commentaire adressé à la Page :

> `‼️⚠️... FAKE - - A-I - - FAKE - - A-I - - THIS - "FARMER" - IS - NOT - REAL - - "SHE" - IS - A - COMPUTER - - IMAGE - - ‼️⚠️‼️`

L'agent a écarté à juste titre — il ne peut ni confirmer ni démentir — et a écrit dans le motif :
**« A TRAITER PAR UN HUMAIN, en priorite. Deuxieme publication touchee par ce reproche »**
(l'autre : `934359419303137`). Lien du commentaire dans `C-a-revoir.json`, écarté le 2026-08-31.

Le problème n'est pas l'écart, il est correct. Le problème est **où il atterrit** : `*-a-revoir.json`
est une boîte morte. Un autre écart marqué pour traitement humain y dort **depuis le 20 août, soit
11 jours** (tir A, question sur l'usage de fonds collectés). Trois items au total portent cette
marque ; aucun n'a jamais été routé nulle part.

**Si rien n'est fait :** une accusation publique d'inauthenticité, sur deux publications, reste sans
réponse — et le mécanisme d'escalade que l'agent utilise correctement n'a aucune sortie.

### Constat 4 — La base de faits ne grandit pas, alors que les manques sont écrits chaque jour — **mineur**

**92 écarts** du corpus invoquent un trou de `fb-backlog/faits-verifies.json` — 5 aujourd'hui. Les
motifs nomment les sujets : statut légal et protégé des espèces (9), comestibilité de l'asclépiade
(3), allégations médicales (2). Plusieurs disent eux-mêmes « déjà signalé plusieurs fois ».

Or le fichier n'a reçu aucun enrichissement depuis sa création : `f1b5995` le 18 août, puis un
seul passage le 29 (`e3e73ad`). L'agent identifie ses manques, les écrit, et personne ne les
récolte.

**Si rien n'est fait :** les mêmes questions seront réécartées indéfiniment, et le taux d'écart
restera haut pour une raison qu'on connaît déjà.

### Ce qui n'est pas un constat

- **Tir B : 5 publiées pour 59 écartés (92 %), six heures sans publication.** Son inventaire dit
  « page à faible volume, plusieurs heures sans publication sont normales ». Le journal montre neuf
  tirs dans la journée et les motifs sont surtout des échanges entre abonnés, sans question à la
  Page. La routine fait son travail ; c'est le gisement qui est mince.
- **Le motif répété du tir A** (24 fois le 30 août) **ne s'est pas reproduit** : 2 occurrences
  aujourd'hui. `R-20260830-03` perd de son urgence — à considérer au moment d'arbitrer.
- **Campagne points de vente sans tir aujourd'hui** : son cron est `0 13 * * 2-4`, le 31 est un
  lundi. Pas un manquement. Le vrai test est demain, mardi 1er septembre.
- **Six branches non fusionnées** (`press-release-dragons` 14 commits, `chief` 11, `missive-g6xc72`
  6, `auto-merge-false-positives` 4, `missive-t438gw` 3) : toutes actives aujourd'hui, du travail en
  cours, pas du travail abandonné. Seule celle du constat 2 est urgente.

## 4. Ce qui attend Gabriel

**Décision hors registre, la plus pressante :**

- **Fusionner `claude/scripts-render-deploy-bug-w0d1kf` dans `main`** (constat 2). La revue ne
  fusionne jamais dans `main` — c'est ta décision, et c'est celle qui débloque toutes les autres
  livraisons.
- **Les 12 brouillons non envoyés** (constat 1) : les envoyer, les corriger ou les fermer. Trois
  ont un `to` vide à réparer d'abord. Envoyer relève de toi ou de Catherine, pas de cette revue.
- **L'accusation « FAKE / A-I »** sur deux publications (constat 3) — l'agent l'a explicitement
  escaladée en priorité.

**Sessions bloquées** — deux d'aujourd'hui, cinq plus anciennes :

| Session | Depuis | Ce qu'elle attend |
| --- | --- | --- |
| (cath) MRP Lasclay | 31 août 12:30Z | partage du dossier Drive `1cVY9vtJ4nPqtu-qviRjQK-B3RYaeqVIa` |
| Chief — Lasclay | 31 août 11:16Z | ton arbitrage sur les propositions du registre |
| Admissibilité aux tarifs douaniers américains | 28 août | — |
| Proxy Missive générique et documentation | 28 août | — |
| Opportunités corpo non traitées | 27 août | — |
| Finance | 26 août | — |
| Redirects graines d'asclépiade | 25 août | — |

**Registre — huit items `proposee`, aucun `approuvee`, donc rien appliqué ce tour-ci :**

| ID | Gravité | Titre |
| --- | --- | --- |
| `R-20260829-01` | majeur | Rendre les journaux Render lisibles par la revue |
| `R-20260830-01` | majeur | Mesurer la campagne points de vente sur ses envois |
| `R-20260830-02` | majeur | Compter les écarts du tir D |
| `R-20260830-03` | mineur | Trancher dans `REGLES.md` les félicitations génériques |
| `R-20260831-01` | majeur | Réconcilier l'inventaire des routines |
| `R-20260831-02` | majeur | Router les écarts marqués « à traiter par un humain » |
| `R-20260831-03` | majeur | Compter les brouillons non envoyés et leur âge |
| `R-20260831-04` | mineur | Récolter les trous de `faits-verifies.json` |

## 5. Récidive

- **Tir D, écarts non comptés** — signalé le 30 août, **toujours ouvert et pire** : 69 écarts
  aujourd'hui rapportés comme 0 (44 hier). Le fichier compte maintenant 177 entrées, toujours
  **0 avec un champ `ecarte_le`**. `R-20260830-02` reste `proposee`.
- **Inventaire des routines périmé** — signalé le 30 (reprise du 31), toujours ouvert : 9 suivies
  pour 11 réelles, la revue s'y suit encore sous un déclencheur désactivé. `R-20260831-01` reste
  `proposee`.
- **Campagne points de vente** — signalée le 30, toujours ouverte : 0 envoi depuis le 6 août.
  Pas de tir dû aujourd'hui ; prochain le 1er septembre à 13:02Z. À revérifier demain soir.
- **Motif répété du tir A** — signalé le 30, **non reproduit** aujourd'hui.

Le seuil de fraîcheur de la revue reste à 48 h, ce qui laisserait un tour sauté passer pour « à
jour » deux jours durant. Signalé pour la troisième fois, toujours pas proposé : la file de
décision est à huit, et j'aime mieux qu'elle se vide avant de l'allonger.
