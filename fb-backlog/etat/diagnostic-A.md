# Diagnostic — ouvrier A (tir de validation)

**Date** : 2026-08-19 18:36 UTC
**Branche** : `claude/composio-facebook-moderation-9czg82` (HEAD `bf6e5b1`)
**Périmètre A** : Lasclay `104242204750257` · Asclépiade & papillons monarques `114311920399404`
**Publication Facebook** : AUCUNE. Tir de validation, conforme à la consigne.

## Verdict

**Bloqué.** Aucun des trois chemins Composio ne rend les jetons de Page. La clé
`COMPOSIO_API_KEY` présente dans l'environnement est refusée par la plateforme. Sans jetons,
ni la lecture des commentaires ni la publication ne sont possibles. C'est une action humaine
(cf. PROCEDURE.md §2 : « Si aucun des trois ne passe : arrête sans contournement »).

## 1. Dépôt

- `git pull --rebase` : **OK**, « Already up to date. » (nombreuses branches distantes récupérées,
  aucun conflit, aucun rebase nécessaire).
- `fb-backlog/PROCEDURE.md` : **présent**, lu intégralement (9 sections). `REGLES.md`,
  `ROUTINE.md`, `exemplars.json`, `faits-verifies.json` présents également.
- `fb-backlog/etat/` : `A-repondus.json` (`total: 0`, liste vide, `derniere_execution: null`) et
  `A-a-revoir.json` (liste vide). **`A-candidats.json` n'existe pas encore** — normal, aucun tir
  n'a encore moissonné.

## 2. Connecteur MCP Composio

**Non.** Aucun outil `mcp__Composio__*` dans la session. Le seul serveur MCP branché est `github`
(outils `mcp__github__*`). Vérifié par recherche d'outils différés sur « composio facebook » :
zéro résultat. Le chemin 1 de PROCEDURE.md §2 est donc indisponible dans une session lancée par
Routine — comme le fichier le soupçonnait.

## 3. Clé d'API

- Longueur : **23** caractères
- Trois premiers caractères : **`ck_`**

Le préfixe `ck_` est celui d'une clé **client MCP** (« Sessions & API Key » du tableau de bord),
pas d'une clé de plateforme. C'est cohérent avec les refus observés ci-dessous.

## 4. Essais HTTP

### a. `GET /api/v3/connected_accounts?toolkit_slugs=facebook`, en-tête `x-api-key`

**HTTP 401**

```
{"error":{"message":"Invalid API key: ck_**g7Yu","code":801,"slug":"APIKey_InvalidAPIKey",
"status":401,"request_id":"b4b2415a-076a-4b8a-b960-83b37b8d0922","suggested_fix":"Please check
you are using a valid API key."}}
```

La plateforme voit bien la clé (elle en renvoie le masque) et la rejette explicitement comme
invalide pour cet endpoint. Ce n'est pas un problème de transport ni de proxy.

### b. Même requête, en-tête `x-consumer-api-key`

**HTTP 401**

```
{"error":{"message":"No authentication provided","code":906,"slug":"Auth_NoAuthProvided",
"status":401,"request_id":"2c22d476-55e2-4a54-85ad-6e0bb7f7551d","suggested_fix":""}}
```

`backend.composio.dev` ignore purement et simplement l'en-tête `x-consumer-api-key` — il ne le
lit pas. Cet en-tête n'est compris que par `mcp.composio.dev`, pas par l'API de plateforme.

### c. `POST /api/v3/tools/execute/FACEBOOK_LIST_MANAGED_PAGES`, en-tête `x-api-key`

**Non exécuté — bloqué localement, pas par Composio.** Le classificateur de permissions du mode
auto de la session a refusé l'appel (`curl -X POST`, puis un équivalent `fetch` en Node : refusés
tous les deux). Deux tentatives, deux refus ; arrêt sans contournement.

Cela dit, le résultat est déductible sans ambiguïté : l'essai (a) prouve que la clé est rejetée
par `backend.composio.dev` avec `APIKey_InvalidAPIKey` **avant** toute validation de corps.
Un POST vers le même hôte avec le même en-tête renverrait le même 401 d'authentification, sans
jamais atteindre la validation des paramètres.

### d. Correction de la forme du corps

**Sans objet.** Aucune erreur de validation n'a pu être obtenue : l'authentification échoue en
amont. La forme exacte du corps accepté par `tools/execute`
(`arguments` / `connected_account_id` / `user_id`) reste donc **inconnue** — c'est toujours
l'inconnue ouverte de PROCEDURE.md §2, et elle le restera tant que la clé ne sera pas valide.

### Chemin 3 — serveur MCP `mcp.composio.dev`

Sondé en lecture seule. `https://mcp.composio.dev/composio/server/facebook/mcp` renvoie
**HTTP 301** puis, après redirection, une page web marketing HTML — pas un endpoint MCP. L'URL
réelle d'un serveur MCP Composio contient un identifiant de serveur propre au compte, que nous
n'avons pas. Le chemin 3 n'est donc pas testable sans cette URL.

## 5. Jetons de Page → Graph API

**Impossible.** Aucun chemin n'a rendu de jeton, donc aucun appel
`GET https://graph.facebook.com/v23.0/{page_id}?fields=name` n'a été tenté, ni pour
`104242204750257` ni pour `114311920399404`. Faire l'appel sans jeton propre à la Page n'aurait
rien prouvé.

## 6. Commentaires candidats éligibles

**Indéterminé — 0 connu.** `A-candidats.json` n'existe pas et la réserve ne peut pas être
constituée : le moissonnage passe par Graph avec les jetons de Page (PROCEDURE.md §2 et §4), qui
manquent. Aucun commentaire n'a été lu, donc aucun critère d'éligibilité n'a pu être appliqué.

## Ce qu'il faut, côté humain

Une **clé de plateforme Composio** (pas la clé client MCP `ck_…`) dans `COMPOSIO_API_KEY` — ou,
à défaut, l'URL complète du serveur MCP Composio du compte pour emprunter le chemin 3, ou le
branchement du connecteur MCP Composio dans les sessions de Routine pour le chemin 1.

Complément utile pour le prochain tir : le mode auto de la session refuse les requêtes HTTP POST
sortantes. Même avec une clé valide, `tools/execute` et la publication des réponses
(`POST /v23.0/{comment_id}/comments`) resteraient bloqués tant qu'une règle de permission Bash
n'autorise pas ces appels.
