# Mémoire partagée

La pièce qui manquait. Neuf agents travaillent chaque jour, chacun dans une session neuve qui
oublie tout : chaque tour redécouvre l'état du monde, et ce qu'un agent apprend, aucun autre ne
le sait. `memoire/ETAT.md` est la page unique que toute session — humaine ou agent — lit avant
de travailler.

## Le principe

**On ne demande à aucun agent de changer sa façon d'écrire.** Une mémoire partagée qui exige la
réécriture de neuf routines n'existe jamais. Celle-ci se construit par-dessus les traces déjà
présentes : les journaux JSONL du backlog Facebook, les commits, le registre de la revue, l'état
des branches. `memoire/sources.js` va les lire là où elles sont.

Ce qui ne laisse aucune trace — une décision prise, un blocage, une question qui attend Gabriel —
se note à la main avec `noter.js`. C'est la seule saisie manuelle, et elle est courte.

## Ce que répond `ETAT.md`, dans cet ordre

1. **Ce qui attend une décision** — propositions de la revue non tranchées, blocages ouverts.
   En haut, parce que c'est la seule section où quelqu'un est bloqué sur toi.
2. **La flotte** — chaque agent, sa dernière trace réelle, et s'il est `actif`, `silencieux` ou
   `invérifiable`. Jamais « en santé » par défaut : un agent qui ne laisse rien derrière lui est
   déclaré invérifiable, pas sain.
3. **Ce qui a bougé** — les événements de la fenêtre, groupés par agent.
4. **Ce qui n'est pas déployé** — les branches hors de `main`. Les services Render suivent
   `main` : ce qui n'y est pas ne tourne nulle part.

## Commandes

```
node memoire/index.js                 # régénère ETAT.md (fenêtre 24 h)
node memoire/index.js --heures 72     # fenêtre plus large
node memoire/index.js attente         # seulement ce qui attend une décision
node memoire/index.js flotte          # seulement l'état des agents
node memoire/index.js json            # tout, en JSON

node memoire/noter.js decision "boite-support" "on ne rembourse plus les frais de retour hors Québec"
node memoire/noter.js blocage  "a2x" "le versement du 22 août ne balance pas de 4,12 $"
node memoire/noter.js attente  "campagne-points-de-vente" "Gabriel doit trancher sur Les Vivaces"
node memoire/noter.js liste            # les entrées encore ouvertes
node memoire/noter.js resoudre 3       # une fois réglé
```

Un blocage ou une attente reste en tête d'`ETAT.md` **tant qu'il n'est pas résolu**. C'est le
défaut que cette mémoire corrige : une question posée et jamais reprise.

## Ce que ce n'est pas

`ETAT.md` est **dérivé** : régénéré, jamais édité. Toute modification à la main disparaît au
prochain `node memoire/index.js`. La vérité vit dans les traces des agents et dans
`memoire/journal.jsonl`.

Il n'est donc **pas versionné** — `.gitignore` l'exclut. Le versionner ferait entrer en collision
chaque agent qui le régénère, et surtout : un `ETAT.md` cloné avec le dépôt donnerait l'état d'un
autre jour en ayant l'air frais. Une session qui ne l'a pas le fabrique en une seconde ; c'est
plus honnête qu'un fichier périmé qui se présente comme la vérité.

Ce n'est pas non plus un tableau de bord de vanité. Aucune métrique ne s'y félicite : pas
d'« heures économisées », pas de taux de complétion. Un compteur qu'un système s'attribue à
lui-même ne prouve rien. Les seules lignes qui comptent sont celles qui pointent vers une preuve
vérifiable — un sha, une ligne de journal, un fichier d'état.

## Rapport avec `revue/`

`revue/` juge la journée et propose des améliorations ; `memoire/` dit ce qui est vrai
maintenant. La revue est un **écrivain** de la mémoire (ses propositions non tranchées
apparaissent en section 1) et la mémoire est une **entrée** de la revue.

Les deux modules lisent aujourd'hui les mêmes journaux par deux chemins différents
(`revue/collecte.js` et `memoire/sources.js`). C'est une duplication assumée le temps que la
revue tourne quelques soirs sans être déstabilisée ; sa consolidation passe par le registre,
comme toute autre amélioration.
