# Registre des améliorations — revue quotidienne

Vue générée par `node revue/registre.js md`. **Ne pas éditer à la main** :
la source est `revue/registre.json`, et tout changement d'état passe par le script.

| État | Nombre |
| --- | --- |
| proposee | 1 |
| approuvee | 0 |
| appliquee | 0 |
| refusee | 0 |
| reportee | 0 |

## En attente d'approbation (1)

### R-20260829-01 — Rendre les journaux Render lisibles par la revue

- **Gravité** : majeur · **Effort** : 20 min côté Render, 1 h côté script · **Proposé le** : 2026-08-29
- **Source** : mise en place de la routine, 2026-08-29
- **Constat** : La revue ne peut rien dire des services Render au-delà d'une sonde HTTP : aucune RENDER_API_KEY n'est présente dans l'environnement des sessions. Un service qui répond 200 tout en journalisant des erreurs à chaque appel passerait inaperçu, et les cron jobs Render n'ont aucune trace vérifiable de ce côté.
- **Preuve** : env | grep -i render → rien ; revue/collecte.js ne sonde que /health et /connectors.
- **Proposition** : Poser une RENDER_API_KEY en lecture seule dans les variables de l'environnement Claude Code Remote, puis ajouter à revue/collecte.js un volet qui liste les services, leur dernier déploiement et les lignes de journal en erreur des 24 h.
- **Portée** : variables d'environnement + revue/collecte.js
- **Risque** : Une clé Render lit toute l'infrastructure : la prendre en lecture seule, et ne jamais la faire transiter par le code ni par un dépôt.

## Approuvées, à appliquer au prochain tour (0)

_rien._

## Reportées (0)

_rien._

## Appliquées (0)

_rien._

## Refusées (0)

_rien._
