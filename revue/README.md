# Revue quotidienne

Chaque soir, une session relit la journée — routines, scripts exécutés, journaux, sessions
Claude, boîte Missive —, en fait le contrôle qualité, et propose des améliorations que Gabriel
approuve. **Rien ne s'applique sans approbation** : une amélioration proposée le soir du 29 est
appliquée au plus tôt le soir du 30, et seulement si elle est passée à `approuvee`.

| Fichier | Rôle |
| --- | --- |
| `ROUTINE.md` | la procédure du tour du soir — c'est le document que la routine suit |
| `collecte.js` | ramasse les preuves vérifiables : commits, journaux, santé des proxys |
| `registre.js` | seule façon de changer l'état d'une amélioration |
| `registre.json` | la source de vérité des améliorations |
| `REGISTRE.md` | vue lisible, régénérée — ne pas éditer à la main |
| `jour/AAAA-MM-JJ/` | `collecte.json` (les faits) et `revue.md` (la lecture qu'on en fait) |
| `artefact.json` | URL de l'artefact permanent, republié chaque soir au même endroit |

## À la main

```
node revue/collecte.js                  # journée locale en cours
node revue/collecte.js 2026-08-29       # une journée précise
node revue/collecte.js --sans-reseau    # sans les sondes de santé

node revue/registre.js liste            # tout
node revue/registre.js liste proposee   # ce qui attend une décision
node revue/registre.js approuver R-20260829-01 R-20260829-03
node revue/registre.js refuser  R-20260829-02 --note "pas notre problème"
```

Les états vont de `proposee` à `approuvee` puis `appliquee`, ou bifurquent vers `refusee` et
`reportee`. Le tour du soir applique ce qui est `approuvee` et rien d'autre.

## Ce que la revue ne voit pas

- **Les journaux Render.** Aucune `RENDER_API_KEY` dans l'environnement : la seule information
  disponible sur les services est une sonde HTTP. C'est la première amélioration proposée du
  registre.
- **Le transcript d'une autre session.** `list_sessions` donne le titre, l'état, le résumé de
  tour et le coût ; pas les messages. La trace exploitable d'une session, ce sont ses commits,
  ses artefacts et son résumé.

## Branche

Le tour du soir travaille sur `claude/revue-quotidienne` et ne fusionne jamais dans `main` :
les services Render suivent `main`, et cette fusion reste une décision humaine.
