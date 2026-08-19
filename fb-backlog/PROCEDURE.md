# Procédure d'un tir — backlog de commentaires Facebook

Ce fichier est la procédure commune aux trois Routines (`A`, `B`, `C`). Chaque Routine reçoit
seulement sa lettre ; tout le reste est ici. Une seule source, pas de dérive entre les trois.

## Périmètres — cloisonnés, jamais croisés

| Tir | Pages | État |
| --- | --- | --- |
| **A** | Lasclay `104242204750257` · Asclépiade & papillons monarques `114311920399404` | `etat/A-*.json` |
| **B** | Lasclay: The Milkweed Company `368305119707866` | `etat/B-*.json` |
| **C** | Milkweed & Monarchs `262382158951470` | `etat/C-*.json` |

Les trois tirs peuvent se chevaucher dans le temps. Ils ne se marchent jamais dessus parce que
leurs Pages sont disjointes et leurs fichiers d'état séparés. **Ne touche jamais aux fichiers
d'une autre lettre, et ne réponds jamais sur une Page qui n'est pas dans ton périmètre.**

## 1. Contexte

Dépôt `lasclay/missive-automations`, branche `claude/composio-facebook-moderation-9czg82`.
`git pull --rebase` d'abord. Lis :

- `fb-backlog/REGLES.md` — garde-fous, non négociables
- `fb-backlog/faits-verifies.json` — 20 thèmes, faits vérifiés, faits transverses
- `fb-backlog/exemplars.json` — 120 réponses écrites à la main : elles CALIBRENT le registre,
  jamais à copier
- `fb-backlog/etat/<X>-repondus.json` — ce que ton tir a déjà traité

Charge le skill `lasclay-master` pour la voix de marque.

## 2. Accès Facebook

Composio ne sert qu'à **une seule chose** : obtenir les jetons d'accès des Pages. Tout le reste —
lire les commentaires, publier les réponses — passe en direct par l'API Graph v23.0 de Meta.

### Trois chemins possibles — essaie-les dans cet ordre, rapporte celui qui marche

Le compte Facebook connecté est `facebook_grice-absume` (actif). L'outil à exécuter est
`FACEBOOK_LIST_MANAGED_PAGES` avec `fields=id,name,access_token`, `limit=25`.

**1. Le connecteur MCP**, si `mcp__Composio__*` est présent dans ta session. C'est le chemin le
plus simple. Il n'est pas garanti dans une session lancée par Routine — vérifie, ne suppose pas.

**2. L'API REST de la plateforme**, avec `$COMPOSIO_API_KEY` en en-tête `x-api-key` :

```
GET  https://backend.composio.dev/api/v3/connected_accounts?toolkit_slugs=facebook
POST https://backend.composio.dev/api/v3/tools/execute/FACEBOOK_LIST_MANAGED_PAGES
```

**3. Le serveur MCP de Composio**, avec la même clé mais en en-tête **`x-consumer-api-key`**.

Attention : Composio distingue deux types de clés. Celle du tableau de bord, sous « Sessions &
API Key », est une clé **client MCP** et s'envoie en `x-consumer-api-key` ; une clé de plateforme
s'envoie en `x-api-key`. Une clé refusée en 401 `APIKey_InvalidAPIKey` sur `backend.composio.dev`
n'est donc pas forcément expirée — elle peut simplement être du mauvais type pour cet endpoint.
Essaie les deux en-têtes avant de conclure.

Le nom des champs du corps de `tools/execute` a évolué entre versions (`arguments` /
`connected_account_id` / `user_id`). **Ne suppose pas : lis la réponse.** Une erreur de validation
nomme le champ attendu — corrige et réessaie une fois.

**Dans ton rapport, dis lequel des trois chemins a fonctionné, avec le code HTTP et la forme
exacte du corps accepté.** C'est la seule inconnue restante de cette procédure ; une fois connue,
elle sera figée ici et les deux autres chemins supprimés.

Si aucun des trois ne passe : arrête sans contournement et signale-le. C'est une action humaine.

**Ne journalise jamais un jeton ni une clé, ne les écris dans aucun fichier, ne les committe
jamais.** Pour la Page Lasclay, pagine avec `limit=25`.

### Piège connu, quel que soit le chemin

Les outils Composio `FACEBOOK_GET_COMMENTS`, `FACEBOOK_GET_COMMENT` et `FACEBOOK_CREATE_COMMENT`
n'ont PAS de paramètre `page_id`. Composio retombe sur le jeton de la première Page et Meta refuse
avec `(#10)` sur les autres. Ce n'est pas un problème de permission. **N'utilise aucun de ces trois
outils** : une fois les jetons en main, appelle Graph directement avec le jeton propre à la Page
visée.

**Ne journalise jamais un jeton, ne l'écris dans aucun fichier, ne le committe jamais.** Pour la
Page Lasclay, pagine avec `limit=25`.

## 3. Cadence — tirée au sort, jamais choisie

Fais ces tirages avec `random`, AVANT de regarder le moindre commentaire, et rapporte-les.

**a) Publier cette heure-ci ?** Entier de 1 à 6. Sur un 1, tu ne publies rien : note
« heure sautée » et termine. Le samedi et le dimanche, saute aussi sur un 2.

**b) Combien ?** `N = 1 + int(random.expovariate(1/9.5))`, plafonné à 24. Le plus souvent 4 à
16. N'invente pas un autre nombre et ne complète jamais jusqu'à un chiffre rond.

**c) Quand commencer ?** `random.uniform(45, 420)` secondes d'attente avant la première.

**d) Écarts.** Avant chaque réponse suivante : `max(60, min(600, random.expovariate(1/180.0)))`
secondes. Moyenne autour de 3 minutes, beaucoup de courts, quelques longs. Deux écarts quasi
identiques dans le même tir, c'est un défaut — retire.

Le bac à sable Composio coupe les cellules à 180 secondes : découpe les attentes en cellules
courtes et garde ton état sur disque, jamais seulement en mémoire de cellule.

Arrête quand l'heure est écoulée, même si N n'est pas atteint. Ne rattrape jamais un retard.

## 4. Candidats — mis en cache, pas re-moissonnés à chaque tir

`fb-backlog/etat/<X>-candidats.json` garde la réserve de commentaires éligibles.

Re-moissonne depuis Meta **seulement** si le fichier est absent, s'il a plus de 24 heures, ou
s'il reste moins de 40 candidats. Sinon, lis-le et n'appelle Meta que pour publier. Moissonner
tout le backlog à chaque tir brûlerait le quota de lecture de l'application pour rien.

Critères d'éligibilité : non masqué, `comment_count == 0`, contient un point d'interrogation,
plus de 12 caractères, ne commence pas par un nom propre suivi d'un espace (ce sont des réponses
entre abonnés), pas écrit par la Page elle-même, absent de `<X>-repondus.json`.

Les commentaires utilisent l'apostrophe typographique U+2019, pas U+0027 : normalise avant de
comparer. N'utilise jamais de sous-chaîne nue pour classer un thème — « chat » se trouve dans
« achat », « cat » dans « scatter ». Frontières de mot obligatoires.

Tire tes N candidats **au hasard** dans la réserve, en mélangeant les Pages, les dates et les
thèmes. Ne prends pas les N premiers. Ne balaie pas le même fil deux tirs de suite.

Écarte, en consignant dans `etat/<X>-a-revoir.json` avec le motif : plaintes de commande,
dossiers clients, échecs de germination, diatribes, et tout ce qui sort des faits vérifiés.
Dans le doute, écarte.

## 5. Rédaction — chaque réponse est unique

Écris chaque réponse sur mesure à partir des faits vérifiés du thème, adaptée à ce que la
personne demande vraiment : sa région, son produit, son inquiétude précise. Deux réponses ne
doivent jamais être identiques ni quasi identiques, dans toute l'histoire du traitement, tous
tirs confondus. Varie la longueur et la forme : parfois une phrase, parfois trois. Une réponse
toujours calibrée pareil se repère autant qu'un texte copié.

Langue : celle du commentaire. Registre : sobre pour Lasclay et Lasclay: The Milkweed Company
(0 à 1 emoji) ; chaleureux et quétaine assumé pour Milkweed & Monarchs et Asclépiade & papillons
monarques (1 à 2 emoji).

Vouvoie en français. Aucune date de livraison. Aucun prix. Jamais « fabriqué au Québec » pour un
produit fini — l'isolant est cultivé et transformé au Québec, l'assemblage textile se fait
surtout en Tunisie depuis juillet 2026. Jamais « acheter sauve un monarque ».

## 6. Publication — une à la fois

Publier, attendre l'écart tiré, choisir la suivante, publier. Jamais de lot, jamais de boucle
serrée, jamais deux appels rapprochés. Alterne tes Pages au hasard.

`POST https://graph.facebook.com/v23.0/{comment_id}/comments` avec `message` et le jeton de la
bonne Page.

## 7. Enregistrement

Relis chaque réponse auprès de Meta pour confirmer qu'elle existe. Ajoute les identifiants à
`etat/<X>-repondus.json` avec la date et le texte publié, retire-les de `<X>-candidats.json`,
mets à jour `<X>-a-revoir.json`.

Pour pousser : `git pull --rebase` puis `git push`. Un autre tir peut avoir poussé entre-temps ;
comme vos fichiers sont disjoints, le rebase passe toujours. Réessaie jusqu'à quatre fois avec
un délai croissant. **Sans cette étape, le prochain tir produira des doublons.**

## 8. Arrêt d'urgence

Erreur de limite de débit Meta, code 368, ou erreur de permission : arrête immédiatement, ne
réessaie pas, consigne et signale.

## 9. Rapport

Court : les tirages obtenus (saut ou non, N, délai initial, écarts réels), le nombre publié par
Page, le nombre écarté et pourquoi, et ce qui reste dans ta réserve.
