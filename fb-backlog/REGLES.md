# Traitement du backlog de commentaires Facebook — règles d'exécution

## Principe

**Aucune réponse n'est copiée d'un gabarit.** Chaque réponse est rédigée sur mesure pour la
question posée, à partir des faits vérifiés de `faits-verifies.json`. Deux réponses ne doivent
jamais être identiques, ni quasi identiques. C'est une exigence de Meta autant que de qualité :
la répétition littérale déclenche la détection de spam et fait perdre la Page.

`exemplars.json` contient 120 réponses rédigées à la main. Elles servent à **calibrer le
registre**, jamais à être copiées-collées.

## Registre par Page

| Page | ID | Registre |
| --- | --- | --- |
| Lasclay | 104242204750257 | sobre, 0 à 1 emoji |
| Lasclay: The Milkweed Company | 368305119707866 | sobre, 0 à 1 emoji |
| Milkweed & Monarchs | 262382158951470 | chaleureux, quétaine assumé, 1 à 2 emoji |
| Asclépiade & papillons monarques | 114311920399404 | chaleureux, quétaine assumé, 1 à 2 emoji |

Langue : toujours celle du commentaire, jamais celle de la Page.

## Garde-fous non négociables

1. **Vouvoiement en français.** La base de connaissance signale que le tutoiement n'est pas une
   politique confirmée de la marque. Ne pas tutoyer sans décision explicite de l'équipe.
2. **Jamais de date de livraison.** Toute question sur une commande précise se renvoie en privé.
   Une date exige une vérification Shopify + ShipStation, impossible depuis un commentaire.
3. **Jamais de prix chiffré.** La grille de prix est marquée comme datée dans la base. Renvoyer
   au site.
4. **Jamais « fabriqué au Québec » pour un produit fini.** L'isolant est cultivé et transformé au
   Québec ; l'assemblage textile se fait surtout en Tunisie depuis juillet 2026.
5. **Jamais « acheter sauve un monarque ».** Le lien est systémique, pas transactionnel.
6. **Ne rien inventer.** Si la question sort des faits vérifiés, ne pas répondre : consigner le
   commentaire dans `a-revoir.json` pour traitement humain.
7. **Ne jamais répondre à une plainte de commande.** Ce sont des dossiers clients, pas des
   questions. Les laisser au support.

## Cadence

Le rythme n'est pas une contrainte de débit, c'est une contrainte d'apparence. Une page qui
répond toutes les heures ouvrables sans exception, à intervalles réguliers, se lit comme un
automate — autant pour les heuristiques de vélocité de Meta que pour les abonnés qui font
défiler le fil.

Le volume ne vient donc pas d'une cadence plus rapide, mais de **trois tirs cloisonnés par
Page** qui travaillent en parallèle sans jamais se croiser. Voir `PROCEDURE.md`.

**Rien n'est choisi, tout est tiré au sort**, au début de chaque tir, avec `random` :

| Décision | Tirage |
| --- | --- |
| Publier cette heure-ci ? | 1 chance sur 6 de sauter l'heure entièrement (2 sur 6 le week-end) |
| Combien | `N = 1 + int(random.expovariate(1/9.5))`, plafonné à 24 — le plus souvent 4 à 16 |
| Délai avant la première | `random.uniform(45, 420)` secondes |
| Écart entre deux réponses | `max(60, min(600, random.expovariate(1/180.0)))` secondes |

Une réponse à la fois : publier, attendre, choisir la suivante, publier. Jamais de lot, jamais
de boucle serrée, jamais deux écarts identiques dans le même tir. Alterner les Pages au hasard,
et ne pas balayer le même fil deux tirs de suite.

Fenêtre : 9 h à 18 h, heure de l'Est, avec pause complète entre 12 h et 13 h. Arrêter quand
l'heure est écoulée, même si N n'est pas atteint — ne jamais rattraper un retard.

Débit attendu : **environ 200 réponses par jour**, réparties sur trois tirs et quatre Pages,
soit à peu près 7 par Page et par heure. Jamais un chiffre rond, jamais le même deux jours de
suite.

## État

- `repondus.json` : identifiants des commentaires déjà traités. **À lire avant chaque envoi et à
  mettre à jour après.** C'est la seule protection contre les doublons.
- `a-revoir.json` : commentaires écartés et pourquoi.

## Arrêt d'urgence

Si Meta retourne une erreur de limite de débit, un code 368, ou toute erreur de permission :
arrêter immédiatement, ne pas réessayer, consigner et signaler.
