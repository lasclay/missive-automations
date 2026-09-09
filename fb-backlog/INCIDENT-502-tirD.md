# Incident — 502 trompeur sur `facebook/reply` (tir D, 4–5 sept 2026)

## Ce qui s'est passé

`node fb-backlog/traiter.js publier` a signalé « échec non fatal … facebook/reply → 502 »
sur cinq commentaires. **Ces réponses étaient en fait publiées.** Le 502 survient *après*
l'écriture chez Meta, sur l'étape de relecture / d'analyse de la réponse HTTP.

Croyant à un échec, le tir a relancé. Résultat : **6 doublons publics** sur la Page
Asclépiade & papillons monarques (114311920399404).

## Doublons à supprimer (garder le premier de chaque groupe)

Sous `988691833397470_619372127668364` — 4 réponses identiques, garder `..._2236583837075278` :
- `988691833397470_1052082910760088`
- `988691833397470_2286352182189929`
- `988691833397470_2259701531461549`

Sous `988691833397470_1684105585563933` — garder `..._27744163168599433` :
- `988691833397470_1548892433149381`

Sous `988691833397470_536033022871979` — garder `..._1376594024686998` :
- `988691833397470_1049491984539532`

Sous `988691833397470_1388102012370651` — garder `..._1005206255905807` :
- `988691833397470_1594752345393455`

Le connecteur `facebook` du General Proxy n'expose pas d'action `delete`, et `hide` est
refusé par Meta sur les commentaires de la Page elle-même (vérifié : `is_hidden` reste
`false`). La suppression demande donc soit une action `delete` ajoutée au proxy, soit
un passage humain dans Business Suite.

## Cause

Le 502 du proxy enveloppe indistinctement les erreurs de paramètres, les erreurs Meta et
les échecs survenant après une écriture réussie. Le corps d'erreur est en plus tronqué
(~500 caractères), ce qui masque le message Meta réel — impossible de distinguer un
véritable refus d'un simple échec de relecture.

## Correctifs proposés

1. `traiter.js` : après un 502 sur `reply`, **relire** les réponses du commentaire parent
   (`facebook comments {object_id}`) avant de conclure à l'échec, et ne jamais relancer
   sans cette vérification.
2. Proxy : ne pas tronquer le corps d'erreur Meta, et distinguer l'échec d'écriture de
   l'échec de relecture.
3. Ajouter une action `delete` au connecteur `facebook`.

## Portée

Les tirs A, B et C utilisent le même `traiter.js` : leurs pages peuvent porter les mêmes
doublons. À vérifier.
