# Routine « Backlog commentaires Facebook Lasclay »

Routine persistante (Claude Code Remote), une session neuve à chaque tir.

## Horaire

8 tirs par jour, un par heure ouvrable, dans la fenêtre demandée : 9 h à 18 h heure de l'Est,
avec pause complète entre 12 h et 13 h.

| Heure de l'Est | UTC (EDT, mars→novembre) |
| --- | --- |
| 9 h, 10 h, 11 h | 13, 14, 15 |
| **12 h — pause** | — |
| 13 h, 14 h, 15 h, 16 h, 17 h | 17, 18, 19, 20, 21 |

`cron_expression` : `<minute> 13,14,15,17,18,19,20,21 * * *`, minute 6 / 24 / 47 selon le tir.

Le dernier tir part à 17 h et se termine avant 18 h. Le cron est ancré à la minute 6, donc les
tirs partent à h:06 et non au haut de l'heure.

Aucun tir n'a de quota. Chacun tire au sort s'il publie (1 chance sur 6 de sauter l'heure,
2 sur 6 le week-end), combien (loi exponentielle de moyenne 9,5, plafonnée à 24), quand
commencer (45 s à 7 min) et quels écarts (60 s à 10 min, moyenne 3 min). Détail dans
`REGLES.md`.
Débit attendu : **environ 200 réponses par jour**, tous tirs confondus, jamais un chiffre rond, jamais le même deux
jours de suite.

> **Heure normale de l'Est.** Le cron est en UTC. Au retour à l'heure normale (premier
> dimanche de novembre, EST = UTC−5), il faut décaler d'une heure avec `update_trigger` :
> `<minute> 14,15,16,18,19,20,21,22 * * *`. Sans ce changement, la routine tirerait de 8 h à 16 h.

## Trois Routines, pas une

Le volume vient du parallélisme, pas de la vitesse. Trois Routines identiques tournent en
parallèle sur des périmètres **disjoints** : Pages différentes, fichiers d'état différents.
Elles peuvent donc se chevaucher sans jamais répondre deux fois au même commentaire ni entrer
en conflit sur le dépôt.

| Tir | Pages | Minute de départ |
| --- | --- | --- |
| **A** | Lasclay · Asclépiade & papillons monarques | h:06 |
| **B** | Lasclay: The Milkweed Company | h:24 |
| **C** | Milkweed & Monarchs | h:47 |

La procédure commune vit dans `PROCEDURE.md` — une seule source, pour qu'aucune des trois ne
dérive. Le message de chaque Routine ne fait que donner sa lettre.

## Ce que fait chaque tir

1. Lit `REGLES.md`, `faits-verifies.json`, `exemplars.json`, `repondus.json`.
2. Récupère les jetons par Page via l'**API REST de Composio** (`$COMPOSIO_API_KEY`, compte
   `facebook_grice-absume`), puis attaque l'API Graph v23.0 en direct. Le connecteur MCP n'est
   pas garanti dans une session lancée par Routine, d'où le passage par REST. Les outils
   `FACEBOOK_GET_COMMENTS`, `FACEBOOK_GET_COMMENT` et `FACEBOOK_CREATE_COMMENT` n'ont pas de
   paramètre `page_id` et retombent sur le jeton de la première Page — ne pas les utiliser.
3. Sélectionne des questions sans réponse, non masquées, absentes de `repondus.json`.
4. **Rédige chaque réponse sur mesure** à partir des faits vérifiés. Aucun gabarit copié.
5. Publie **une réponse à la fois**, à intervalles tirés au sort, en alternant les Pages.
6. Met à jour `repondus.json` et `a-revoir.json`, committe et pousse sur
   `claude/composio-facebook-moderation-9czg82`.

## Arrêt

Erreur de limite de débit Meta, code 368, ou erreur de permission : arrêt immédiat, sans
réessai. Pour suspendre : `update_trigger` avec `enabled: false` sur chacune des trois.
