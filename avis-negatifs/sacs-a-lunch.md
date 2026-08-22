# Les sacs à lunch non livrés, croisés avec les avis Google et Facebook

Piste demandée : retrouver l'autrice du fil r/montreal à partir des commandes de sac à lunch non
livrées. Elle a abouti, et elle a aussi refermé une question restée ouverte dans le dossier des
avis.

---

## 1. L'autrice du fil Reddit : Marie-Michèle Leblanc, avec un haut degré de confiance

Ce qu'elle écrit le 6 août : *« J'ai commandé une boîte à lunch qui était affichée comme étant
disponible. **Deux jours après mon achat**, je reçois une longue infolettre pour m'annoncer que
j'ai finalement acheté une précommande. Depuis, aucune nouvelle, pas de livraison, et le service
client ignore mes demandes de remboursement. J'ai dû appeler ma banque pour faire une
rétrofacturation. »*

**L'infolettre est datée.** Dans Klaviyo, la campagne **« 2026-07-31 Infolettre FR - suivi
précommande »** a été envoyée le **2 août 2026 à 19 h 17**. C'est le seul envoi qui correspond à
sa description, et il donne la date de sa commande : deux à trois jours plus tôt.

**Une seule commande de sac à lunch tombe dans cette fenêtre :**

| | |
| --- | --- |
| Commande | **L-50761** |
| Cliente | **Marie-Michèle Leblanc**, m-m.leblanc@live.ca |
| Passée le | **30 juillet 2026, 12 h 43** |
| Contenu | **Sac à lunch × 1**, 70,13 $ |
| Expédiée | **jamais** |
| Annulée et remboursée | **18 août 2026, 20 h 05**, 70,13 $ |

Les cinq éléments concordent : un sac à lunch seul, commandé juste avant l'infolettre, jamais
expédié, et **remboursé douze jours après son post Reddit**. C'est exactement la séquence qu'elle
décrit : elle demande, on ignore, elle appelle sa banque, l'argent revient. L'annulation et le
remboursement au même horodatage sont la signature d'une rétrofacturation concédée.

**Les autres candidates ne tiennent pas.** Vickie Legare (L-50758, 28 juillet, Montréal) a commandé
cinq jours avant l'infolettre, pas deux, et **n'a jamais été remboursée** : elle attend encore
aujourd'hui. Manon Alie (L-50765) a commandé le 2 août, le jour même de l'envoi.

### ⚠️ Ne pas lui écrire en tant qu'autrice du fil

Elle a publié sous pseudonyme. Lui écrire en montrant qu'on l'a identifiée à partir de son post
transformerait un litige commercial en problème de vie privée, et donnerait au fil une seconde vie
bien pire que la première.

Ce qui est légitime, et suffisant : elle est une cliente dont la commande n'a jamais été expédiée
et qui a dû passer par sa banque. **Écrire à ce titre-là, sans jamais mentionner Reddit.** Son
argent lui a été rendu le 18 août ; ce qui reste dû, c'est l'explication et le geste.

---

## 2. Emma Nelson, l'avis Google du 29 juin, est Emma Whiten

Cette question était ouverte depuis la première passe. Elle se referme.

| | |
| --- | --- |
| Commande | **L-50672** |
| Cliente | **Emma Whiten**, emmaswhiten@gmail.com, Pitt Meadows, Colombie-Britannique |
| Passée le | 8 juin 2026 |
| Contenu | **Sac à lunch × 1**, 68,31 $ |
| Expédiée | **jamais** |
| Remboursée | **20 août 2026**, 68,31 $ |

L'avis d'Emma Nelson, en anglais : *« Ordered **an item**, never received any update on shipping or
processing. It's been over a month and three unanswered emails. »* Un seul article, anglophone,
aucune nouvelle d'expédition, commande jamais partie. Tout concorde.

**Emma Perez est éliminée** : Fort Lauderdale, quatre sachets de graines à 10,63 $, expédiée le
12 mai. Ce n'est pas « an item » et ce n'est pas non expédié.

Le seul frottement : elle écrit « over a month » le 29 juin pour une commande du 8 juin, soit trois
semaines. Un arrondi vers le haut, ou un décompte à partir d'un premier échange. **À confirmer par
les trois courriels qu'elle dit avoir envoyés** : ils doivent exister dans Missive.

Conséquence pratique : elle a été remboursée hier, 20 août, sept semaines après son avis. Le
message de `messages.md` doit être réécrit en conséquence, il partait du principe qu'elle n'était
pas identifiée.

---

## 3. Aucun autre recoupement

Les 17 commandes contenant un sac à lunch non livré ont été croisées avec les 30 auteurs d'avis
Google négatifs : **aucun courriel commun**. Les rapprochements par prénom seul (une Sarah, une
Marie, une Ariane) ont été vérifiés un par un et ne tiennent pas : dates, produits et villes
divergent.

---

## 4. Facebook : les recommandations ne sont pas accessibles, mais les commentaires ont parlé

Le connecteur Facebook du General Proxy expose `diag, pages, posts, comments, comment, reply, hide,
unhide, edit`. **Aucune action pour les avis ou les recommandations de Page.** Ce n'est pas une
limite de Facebook : l'API Graph expose `/{page-id}/ratings` avec `pages_read_engagement`. Il
manque une route au proxy, à ajouter dans `server.js` sur le modèle de `comments`.

En attendant, les commentaires de la Page ont livré un recoupement réel.

**patrick lambert, auteur de l'avis Google 1★ du 31 mai** (« Ce n est plus un produit québécois la
qualité va en souffrir a banir »), **a aussi commenté la publication du virage sur Facebook**. Un
autre abonné lui répond le 5 juin : *« Lambert Patrick j'espère que tu as écouté le documentaire
avant de commenter. »* Son avis Google et son commentaire Facebook sont la même intervention, la
même semaine, sur les deux canaux.

La publication en question, **« Nous nous mettons à nu »** du 26 mai, est l'annonce du virage. Ses
vingt commentaires sont **très majoritairement favorables** : « Bravo quel courage », « Respect »,
« Bonne décision ». Deux seulement sont hostiles, celui de patrick lambert et un autre du 30 mai :
*« Déplacé la production pour faire plus d'argent, j'espère que plus personne ne va vous
encourager. »*

C'est une donnée utile pour le fil Reddit : sur le sujet précis de la Tunisie, **la communauté
Facebook de Lasclay a majoritairement suivi**. Le fil Reddit n'est pas le thermomètre de l'opinion,
il en est l'extrémité.

---

## 5. Ce qui compte plus que l'identification

**Onze autres personnes attendent un sac à lunch payé et jamais expédié.** Aucune n'a rien publié.
Deux d'entre elles ont dépassé les trois mois.

| Commande | Date | Client | Courriel | Ville | Montant | Attente |
| --- | --- | --- | --- | --- | --- | --- |
| L-50124 | 25 mai | Andrew Lawson | andrewmnlawson@gmail.com | Louisville, US | 50,42 $ | **88 j** |
| L-50513 | 30 mai | Karine Gagnon | gagnka@hotmail.com | Montréal | 48,29 $ | **83 j** |
| L-50413 | 30 mai | Martin Lyonnais | martinlyonnais@gmail.com | Beaumont | 59,78 $ | **83 j** |
| L-50684 | 15 juin | N. La Haye Gallant | cocochanel314@hotmail.com | Québec | 58,64 $ | **67 j** |
| L-50752 | 22 juil. | Sébastien Noël | sebastien.p.noel@gmail.com | Saint-Lambert | 70,13 $ | 30 j |
| L-50758 | 28 juil. | **Vickie Legare** | vickie_legare@hotmail.com | Montréal | 70,13 $ | 24 j |
| L-50765 | 2 août | Manon Alie | manon_alie@videotron.ca | Victoriaville | 70,13 $ | 19 j |
| L-50789 | 5 août | Sarah Wheeler | sewgr8@ymail.com | Omaha, US | 63,38 $ | 16 j |
| L-50840 | 21 août | Christine Lavoie | christine.lav@hotmail.com | Québec | 58,64 $ | 0 j |
| L-50848 | 21 août | Elyse Racine | elyseracine@hotmail.com | Cowansville | 70,13 $ | 0 j |

S'ajoutent une quinzaine de commandes contenant un sac à lunch parmi d'autres articles, dont
**L-50308** (suzanne crete, 30 mai, 454,05 $) et **L-50193** (Johanne Lebrun, 30 mai, 249,49 $).

**Vickie Legare est la plus exposée.** Elle a commandé quatre jours avant Marie-Michèle Leblanc,
n'a jamais été livrée, n'a jamais été remboursée, et elle est à Montréal. C'est exactement le profil
de la personne qui écrit le prochain fil.

### La conclusion opérationnelle

Il n'est pas nécessaire d'identifier qui que ce soit. Dix personnes attendent un sac à lunch. Les
traiter toutes règle le cas de l'autrice du fil sans jamais avoir à nommer Reddit, et désamorce les
neuf autres avant qu'elles n'écrivent.

Trois options par personne, dans cet ordre : expédier cette semaine avec une date ferme, ou
rembourser sans qu'elles aient à le demander, ou rembourser et livrer quand même. Pour celles qui
dépassent les deux mois, c'est la troisième.
