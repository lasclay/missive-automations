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

## 2. Accès Facebook — par le General Proxy, pas par Composio

Facebook passe désormais par le **General Proxy** de Lasclay, comme ShipStation et Omnisend.
C'est la règle du dépôt : les clés vivent côté Render, jamais dans l'environnement Claude ni
dans le code. Composio n'est plus dans le chemin — ni le connecteur MCP, ni la clé d'API.

Le proxy détient un seul secret, `FB_USER_TOKEN`, et **dérive lui-même les jetons de Page**.
Aucun jeton de Page ne sort du serveur ; tu n'en manipules jamais.

```
node connectors_client.js facebook <action> '{"page_id":"…", …}'
```

`GENERAL_PROXY_URL` et `GENERAL_PROXY_SECRET` sont déjà dans l'environnement, et
`.claude/settings.json` autorise déjà cette commande — pas de demande de permission, pas de
`curl` sortant à faire approuver.

| Action | Paramètres | Effet |
| --- | --- | --- |
| `pages` | — | les Pages accessibles (id et nom seulement) |
| `posts` | `page_id`, `limit`, `after` | publications d'une Page |
| `comments` | `page_id`, `object_id`, `limit`, `after` | commentaires d'une publication ou d'un commentaire |
| `comment` | `page_id`, `comment_id` | un commentaire précis |
| `reply` | `page_id`, `comment_id`, `message` | publie une réponse |
| `hide` / `unhide` | `page_id`, `comment_id` | masque, réversible, sans notification |
| `edit` | `page_id`, `comment_id`, `message` | corrige un commentaire de la Page sans renotifier |

**`page_id` est obligatoire partout.** Meta exige que chaque appel porte le jeton de la Page
visée ; un jeton d'une autre Page produit une erreur `(#10) pages_read_user_content`. C'est le
piège qui a fait échouer trois Pages sur quatre lors du premier passage. Le proxy choisit le bon
jeton à partir de `page_id`, et refuse un `page_id` inconnu au lieu de retomber silencieusement
sur une autre Page.

Vérifie le connecteur avant de commencer : `GET /connectors` sur le proxy doit montrer
`facebook` avec `enabled: true`. S'il est à `false`, `FB_USER_TOKEN` manque côté Render :
arrête et signale-le, c'est une action humaine.

Pour la Page Lasclay, pagine avec `limit=25` — au-delà, Meta renvoie « reduce the amount of
data ».

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
