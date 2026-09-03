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

## Priorité — le jour d'abord, puis l'intention d'achat

Un commentaire laissé sans réponse le jour même se voit ; un commentaire de 2024 qui attend une
semaine de plus, non. **Les commentaires du jour passent avant tout et sont traités en entier.**

Le backlog prend ensuite **toute la capacité restante**, sans plafond : une journée calme bascule
d'elle-même à 100 % de backlog. Les 70 % sont un plancher de priorité pour le jour, jamais un
frein sur le reste.

Dans le backlog, **les questions à intention d'achat passent devant** — où commander, livraison,
disponibilité, prix, quelle espèce choisir. Quelqu'un qui demande s'il peut être livré chez lui
attend une réponse qui compte.

Un score d'intention élevé n'autorise pourtant rien : une plainte de livraison score haut et part
quand même au support. Le tri ordonne, il ne décide pas.

## Cadence — 24 h sur 24, mais jamais à plat

Le traitement ne s'arrête jamais, pour que les commentaires du jour soient pris vite. Mais un
débit **plat** sur 24 heures serait une signature aussi nette qu'une cadence régulière : aucune
personne ne répond autant à 4 h du matin qu'à 14 h, et ça se voit autant des modèles
comportementaux de Meta que des abonnés.

L'intensité suit donc une journée humaine, et le script la calcule à partir de l'heure de l'Est
qu'il détermine lui-même — le cron tire toutes les heures en UTC et n'a plus rien à savoir des
changements d'heure. Le passage à l'heure normale en novembre ne demande aucune intervention.

| Tranche (heure de l'Est) | Intensité |
| --- | --- |
| 8 h – 11 h, 14 h – 16 h | 0,95 à 1,00 — le gros du travail |
| **6 h – 7 h** | **0,50 à 0,85 — le matin est un pic sur Facebook, pas un creux** |
| 12 h – 13 h | 0,70 à 0,95 — on scrolle en mangeant |
| 18 h – 20 h | 0,80 à 0,90 — second pic en soirée |
| 21 h – 1 h | 0,10 à 0,65 — extinction progressive |
| 2 h – 5 h | 0,05 à 0,15 — presque rien, jamais exactement rien |

La courbe suit les vrais pics d'engagement de Facebook — le matin tôt, le midi, la soirée — et
non une journée de bureau. Le creux de midi n'est pas une pause franche, et le cœur de la nuit
n'est jamais à zéro absolu :
**un zéro quotidien à heure fixe est lui-même un motif reconnaissable.** **Sept jours sur sept.** Il y avait une pénalité de
week-end : elle est retirée. Les gens commentent le samedi comme le mardi, et une Page qui répond
du lundi au vendredi se lit comme un bureau, pas comme une communauté.

**Rien n'est choisi, tout est tiré au sort** par le script, à chaque réveil :

| Décision | Tirage |
| --- | --- |
| Publier cette heure-ci ? | probabilité = intensité × 0,85 |
| Combien | `1 + int(expo(10 × intensité))`, plafonné à 20 |
| Délai avant la première | 45 à 420 secondes |
| Écart entre deux réponses | 60 à 600 secondes, moyenne 3 minutes |

Une réponse à la fois : publier, attendre, publier. Jamais de lot, jamais de boucle serrée.

Débit mesuré par simulation : **environ 310 réponses par jour**, dont **47 entre 6 h et 8 h** et
**1,2 entre 2 h et 5 h**. Soit à peu près 6 par Page et par heure de pointe — une toutes les dix
minutes. Jamais un chiffre rond, jamais le même deux jours de suite.

## Plafond par Page et par jour

Le tirage horaire ne connait pas l'historique de la journee : une serie de tirages hauts pourrait
concentrer beaucoup de reponses sur une seule Page. **Le plafond de 110 reponses par Page et par
jour est la seule chose qui regarde le cumul du jour**, et c'est le garde-fou qui compte vraiment
a ce debit. Il s'applique deux fois - a la constitution du lot et a la publication - et se regle
par `FB_PLAFOND_PAGE_JOUR`.

A 300 par jour sur quatre Pages, la moyenne est de 75 par Page : le plafond ne mord qu'en cas de
concentration anormale, ce qui est exactement son role.

## Ce debit est un rattrapage, pas un regime permanent

Le backlog est fini : environ 2 800 questions sans reponse, dont bien moins sont reellement
traitables. A 300 par jour, il se vide en une dizaine de jours. Ensuite, la seule matiere restante
est le flux quotidien, qui se compte en dizaines. **Quand `total_candidats` s'effondre, ce n'est
pas une panne - c'est le travail qui est fait.** Redescendre le debit a ce moment-la.

## État

- `repondus.json` : identifiants des commentaires déjà traités. **À lire avant chaque envoi et à
  mettre à jour après.** C'est la seule protection contre les doublons.
- `a-revoir.json` : commentaires écartés et pourquoi.

## Arrêt d'urgence

Si Meta retourne une erreur de limite de débit, un code 368, ou toute erreur de permission :
arrêter immédiatement, ne pas réessayer, consigner et signaler.
