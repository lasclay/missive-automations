# Incident — doublon public sur `facebook/reply` (tir B, 24 sept 2026, 18 h Est)

## Ce qui s'est passé

`node fb-backlog/traiter.js publier` a signalé :

```
échec non fatal sur 122121236618483418_1310058947356596 : facebook/reply → 502
{"error":"POST /v23.0/.../comments?message=... → 500
{\"error\":{\"code\":1,\"message\":\"Please reduce the amount of data you're asking for, then retry your request\"}}"}
```

et a conclu `"publiees": 0`. **La réponse était en fait publiée.** J'ai relancé une fois,
croyant à un échec transitoire. La seconde tentative a publié à son tour et a renvoyé
exactement la même erreur.

Résultat : **deux réponses identiques** sous le même commentaire.

## Le doublon à supprimer

Sous `122121236618483418_1310058947356596` (« Love these! My grandgirls enjoyed finding
them! »), texte « Grandchildren out hunting for pods. That is a fine way to spend an
afternoon. » :

- `122121236618483418_1475139214672611` — 22:26:22 UTC — **à garder**
- `122121236618483418_1127512233268524` — 22:26:38 UTC — **à supprimer**

Lien : https://www.facebook.com/122210881520483418/posts/122121236618483418?comment_id=1310058947356596&reply_comment_id=1127512233268524

`hide` est refusé par Meta sur les commentaires de la Page elle-même :
`(#200) Can not hide or unhide this comment`. Le connecteur n'expose pas de `delete`.
La suppression demande un passage humain dans Business Suite.

## Ce qui a été corrigé côté état

La réponse conservée a été inscrite à la main dans `B-repondus.json` et
`B-journal.jsonl`. Sans cela, le commentaire serait revenu dans un lot futur et aurait
produit un **troisième** doublon.

## Cause, identique à l'incident du tir D

C'est exactement le scénario décrit dans `INCIDENT-502-tirD.md` : le 502 du proxy
enveloppe indistinctement les erreurs Meta et les échecs survenant **après** une écriture
réussie. Le script classe cela « échec non fatal », décrémente son compteur, et invite
de fait à relancer.

Nouveauté par rapport au tir D : ici le message Meta interne est visible et trompeur
(« Please reduce the amount of data you're asking for »), ce qui ressemble à un refus
franc alors que l'écriture a bien eu lieu.

## Règle à appliquer d'ici un correctif

**Ne jamais relancer `publier` après un « échec non fatal » sur `facebook/reply`.**
Vérifier d'abord chez Meta :

```
node connectors_client.js facebook comments \
  '{"page_id":"<page>","object_id":"<comment_id>"}'
```

Si la réponse y figure, l'inscrire dans `B-repondus.json` et le journal, et ne pas
republier.

## Correctif souhaitable côté proxy

1. Distinguer, dans `facebook/reply`, l'échec d'écriture de l'échec de relecture, et
   renvoyer l'`id` créé dès que l'écriture a réussi.
2. Exposer une action `delete` sur le connecteur `facebook`, faute de quoi aucun doublon
   ne peut être réparé sans intervention humaine.
