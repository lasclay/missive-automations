# Revue quotidienne — mercredi 2 septembre 2026

Tour de 21 h 41 (Est). Fenêtre : 2026-09-02T04:00Z → 2026-09-03T04:00Z.
Preuves : `revue/jour/2026-09-02/collecte.json`, boîte Missive, fichiers d'état du backlog.

> **Sans outils `mcp__*` ce soir.** Le serveur qui expose `list_triggers` et `list_sessions` n'est
> pas joignable — l'appel échoue sur « No such tool available ». Ce tour juge donc les routines
> **sur leur trace seule**, et les deux « Ramassages » ressortent **invérifiables** : je ne les
> déclare pas saines, contrairement aux deux tours précédents où j'avais la preuve. À noter pour
> `R-20260831-01` : le nom du serveur a changé trois fois en quatre jours, et ce soir il est
> absent. C'est l'argument le plus net en faveur d'une vérification par appel plutôt que d'une
> hypothèse figée, dans un sens comme dans l'autre.

## 1. Ce qui a tourné

| Routine | Résultat du jour | Trace vérifiée | Verdict |
| --- | --- | --- | --- |
| Backlog FB — tir A (Lasclay) | 32 publiées, 83 écartés | `A-journal` 1,5 h | à jour |
| Backlog FB — tir B (Milkweed Company) | 11 publiées, 110 écartés | `B-journal` 1,3 h | à jour |
| Backlog FB — tir C (Milkweed & Monarchs) | 34 publiées, 119 écartés | `C-journal` 0,7 h | à jour |
| Backlog FB — tir D (Asclépiade & papillons) | 28 publiées, **36 écartés comptés 0** | `D-journal` 0 h | à jour |
| **Campagne points de vente** | **aucun envoi** | `journal_envois` — **27 j** | **PÉRIMÉE (222,9 h)** |
| Sync skills claude.ai → repo | rien à synchroniser | `.claude/skills` 48 h | à jour |
| Ramassages — resynchro de l'artefact | — | aucune au dépôt | **invérifiable** |
| Ramassages — lot d'étiquettes du mardi | — | aucune au dépôt | **invérifiable** |
| Revue quotidienne — contrôle qualité | ce tour-ci | `revue/` 23,9 h | à jour |

## 2. Ce qui a été produit

- **105 réponses Facebook publiées, 105 confirmées chez Meta, 0 non confirmée, 0 erreur.**
  A 32, B 11, C 34, D 28. Le tir C n'a aucune heure creuse.
- **69 commits**, +6572/−1765.
- **Santé** : `missive-proxy` 200 / 428 ms, `general-proxy` 200 / 314 ms, `finance-proxy` 200 / 394 ms.
- **Boîte Missive** : 45 fils assignés, contre 50 hier — cinq ont été fermés ou désassignés. Un
  seul fil actif dans la fenêtre. La boîte a été travaillée, un peu.

## 3. Constats

### Constat 1 — Trois personnes, sur deux canaux, reprochent à Lasclay de répondre par une IA — **majeur, nouveau**

Ce n'est plus un incident isolé. Trois signaux indépendants, vérifiés :

1. **Facebook, tir C, écarté le 31 août** — commentaire public adressé à la Page :
   `« ‼️⚠️ FAKE - - A-I - - THIS - "FARMER" - IS - NOT - REAL - - "SHE" - IS - A - COMPUTER - IMAGE ‼️ »`,
   sur **deux publications** (la seconde : `934359419303137`).
2. **Missive, fil `640e6213`, 16 juillet** — la cliente écrit :
   *« C'est une blague? Ça fait 2x que je vous donne ma pointure et l'adresse aussi.. C'est ça
   l'effet des message réalisés par l'intelligence artificielle? »*
3. **Missive, fil `df1ba00d`** — le sujet du fil est, mot pour mot :
   **« J'aimerais que ce ne soit pas l'intelligence artificielle qui réponde »**.

Et le troisième porte une ironie qu'il faut nommer : **ce fil traîne un brouillon non envoyé daté
du 16 juillet**, soit 48 jours. Une personne demande explicitement à ne pas être répondue par une
IA, et la réponse qu'on lui a préparée n'est jamais partie.

Aucune proposition en file ne couvre ce signal : `R-20260831-03` compte les brouillons,
`R-20260831-02` route les escalades, mais rien ne suit le reproche d'inauthenticité comme tel,
alors qu'il traverse maintenant le service client et la page publique.

**Si rien n'est fait :** le reproche se répand sans que personne n'en tienne le compte, et il touche
la seule chose qu'une marque artisanale ne peut pas se permettre de perdre.

### Constat 2 — La campagne points de vente : 27 jours, et le mercredi n'a rien changé — **majeur, récidive**

Son cron est `0 13 * * 2-4` ; mercredi est un jour de tir. Faute d'outils `mcp__*` ce soir, **je ne
peux pas confirmer qu'elle a tiré aujourd'hui** — je le dis plutôt que de le supposer. Ce que la
trace montre, elle, est sans ambiguïté :

- `journal_envois.json` : **30 entrées, dernier envoi le 6 août** — inchangé depuis six tours ;
- dernier commit de la branche : `bc8f309`, **24 août** ;
- verdict de fraîcheur : **`PÉRIMÉE`, 222,9 h**.

**27 jours sans un envoi**, 339 fiches `en_attente`. Hier la preuve était faite sur un tir observé ;
aujourd'hui la trace confirme que rien n'a bougé.

### Constat 3 — Le correctif Render n'est toujours pas fusionné, troisième jour — **majeur, récidive**

`0a81d48` reste hors de `main` (vérifié). Aujourd'hui : **65 commits sur `main`, dont 57 ne touchent
que `fb-backlog/etat/`** — 88 %. Six services Render se reconstruisent pour chacun, sur un quota
déjà constaté épuisé.

Signalé le 31 août, le 1er septembre, et ce soir. C'est la seule action de cette liste qui ne
demande qu'une commande.

### Constat 4 — Une deuxième plainte de commande publique en deux jours — **majeur, récidive**

Escalade ajoutée aujourd'hui, tir D :

> *« J'ai commandé et je me demande pourquoi si long à recevoir ma commande »*
> Motif : *« Plainte de commande — règle 7 de REGLES.md : on ne répond jamais publiquement à une
> plainte de commande. À rou[ter]… »*

L'agent applique correctement la règle 7 et route la plainte — vers un fichier qui n'a pas de
sortie. Hier c'était *« Malheureusement aucun service après vente ! »*. **Le total des escalades
passe à 15.** Deux plaintes publiques de commande en deux jours, sur une boîte support qui traîne
onze brouillons non envoyés : ce sont les deux bouts du même problème.

### Ce qui n'est pas un constat — et une bonne nouvelle

- **Un brouillon est parti, et c'était le bon.** Le fil « Semelles » (`640e6213`) a reçu une vraie
  réponse le 31 août, qui ouvre par : *« Vous aviez raison, et votre question méritait une vraie
  réponse plutôt qu'un silence de six semaines. »* C'est exactement le ton qu'il fallait. La
  cliente a répondu aujourd'hui — encore insatisfaite, l'échange dure « depuis le mois de
  février » — mais le fil est vivant au lieu d'être mort.
- **Cinq fils assignés de moins** (50 → 45) : la boîte a été travaillée.
- **Tir B : 11 publiées pour 110 écartés**, cinq heures creuses. Page à faible volume, documenté.
- **`Sync skills` à 48 h sans commit** : elle ne committe que s'il y a un changement. Sans
  `list_triggers` ce soir, je ne peux pas confirmer qu'elle a tiré — donc je ne l'affirme pas.

## 4. Ce qui attend Gabriel

1. **Fusionner `claude/scripts-render-deploy-bug-w0d1kf`** — troisième soir de suite.
2. **Les 15 escalades**, dont deux plaintes de commande publiques et l'accusation « FAKE / A-I ».
3. **Les onze brouillons restants** — trois ont un `to` vide.
4. **Le reproche d'inauthenticité** (constat 1) : trois personnes, deux canaux. C'est une question
   de marque, pas d'outillage.
5. **Pourquoi la campagne points de vente ne produit rien** — 27 jours.

**Registre : huit items `proposee`, zéro `approuvee`, cinquième soir sans décision.** Rien n'a été
appliqué.

## 5. Récidive

| Constat | Signalé les | État |
| --- | --- | --- |
| Campagne à vide | 30, 31 août, 1er, 2 sept | **27 jours**, trace inchangée |
| Correctif Render non fusionné | 31 août, 1er, 2 sept | 57 commits d'état sur `main` aujourd'hui |
| Écarts du tir D non comptés | 30, 31 août, 1er, 2 sept | 36 aujourd'hui, fichier à 280, toujours 0 `ecarte_le` |
| Escalades sans sortie | 31 août, 1er, 2 sept | **15**, une de plus aujourd'hui |
| Brouillons non envoyés | 31 août, 1er, 2 sept | un envoyé, onze restants |
| Inventaire des routines périmé | 30, 31 août | invérifiable ce soir, faute d'outils |

## 6. Amélioration proposée : une seule

Le registre est saturé — huit items, aucune décision depuis le 29 août — et j'ai laissé passer hier
sans rien proposer pour cette raison. Ce soir j'en ajoute **une**, parce qu'aucune de celles en file
ne la couvre et que le signal traverse deux canaux :

- **`R-20260902-01`** — Suivre le reproche d'inauthenticité comme un signal nommé.

Les quatre autres constats restent couverts par `R-20260830-01`, `R-20260830-02`, `R-20260831-02` et
`R-20260831-03`.
