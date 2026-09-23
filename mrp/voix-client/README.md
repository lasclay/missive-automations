# Voix client — la matière brute du contrôle qualité

> « Rien comme l'émotion d'un client insatisfait pour donner à des gens qui
> posent seulement les briques du mur une impression de la bâtisse que ça
> donne. » — Gabriel, en commandant ce travail

L'équipe de production en Tunisie est neuve et plusieurs modèles le sont aussi.
Ce dossier rassemble ce que les clients ont écrit à Lasclay quand un produit a
cassé, mal vieilli, mal fait, ou simplement déçu. Il sert à nourrir le module
de contrôle qualité du MRP : savoir ce qui se brise et où, avant de le
fabriquer à quatre mille exemplaires.

## Ce qu'il y a dedans

| | |
| --- | ---: |
| Fils de conversation | **2 282** |
| Messages | **9 146** |
| Pièces jointes | **1 781** |
| dont images | **1 675** |
| vidéos · PDF | 12 · 56 |
| Période | 2023 → 2026 |
| Poids | 36 Mo |

Les images sont pour l'essentiel des **photos prises par des clients** : une
semelle décollée, une couture qui a lâché, un zipper arraché. C'est ce qui
manque le plus à un atelier qui ne voit jamais le produit après l'expédition.

### Les étiquettes les plus représentées

| Fils | Étiquette |
| ---: | --- |
| 1 068 | `Support/↩️ RETOURS - ECHANGES` |
| 552 | `Support/⚡ Ventes - info pré-achat` |
| 227 | `Support/R&D/Feedbacks manteaux infolettre` |
| 137 | `Support/review à traiter` |
| 132 | `Support/R&D/Idées de produits` |
| 69 | `Opérations/🌱 Problème germination` |

## Les fichiers

| | |
| --- | --- |
| `fils/<id>.json` | un fil par fichier : messages, expéditeurs, dates, étiquettes, métadonnées des pièces jointes |
| `index-etiquettes.json` | les **5 109** fils portant au moins une des 109 étiquettes partagées, avec le chemin complet de chaque étiquette |
| `index-fermes.json` | les **12 740** fils fermés indexés sur 9 des 36 mois, avec le curseur pour reprendre |
| `TAXONOMIE.md` | ce que le classement doit chercher — bris, insatisfactions, ajustement — et la règle d'attribution au produit |
| `outils/` | les quatre scripts qui ont produit tout ça, reprenables |

## ⚠️ Données personnelles

`fils/` contient de la **correspondance client réelle** : noms, adresses
courriel, adresses postales, numéros de commande, parfois des numéros de
téléphone. Le dépôt est privé et doit le rester.

Ce n'est pas ce qui ira dans le MRP. Le MRP recevra le **distillat** — un défaut,
son produit, sa zone, la citation qui le décrit, la photo qui le montre — pas le
fil d'où il vient.

## Comment ça a été extrait

Quatre scripts, tous reprenables, dans `outils/` :

1. **`index.js`** — liste les fils de chacune des 109 étiquettes partagées et
   déduplique. Un fil porte souvent plusieurs étiquettes, et c'est cette
   combinaison qui sert à classer.
2. **`lire.js`** — lit chaque fil, un fichier JSON par conversation. Il saute ce
   qui est déjà sur disque, donc on peut l'arrêter et le relancer sans rien
   perdre.
3. **`fermes.js`** — indexe les fils **fermés** par tranches, avec curseur.
4. **`veilleur.sh`** — relance `lire.js` jusqu'à complétion : un fil abandonné
   après cinq reculs n'a pas de fichier, donc la passe suivante le reprend.

### L'ordre de lecture est une décision

Missive limite à une dizaine de fils par minute. Sur 5 109 fils, c'est des
heures, et une extraction se fait couper. On lit donc par **utilité pour le
contrôle qualité**, pas par date :

| Rang | Contenu | Fils |
| --- | --- | ---: |
| 1 | R&D, RETOURS, produit défectueux, conception produit | 1 480 |
| 2 | Pantoufles, cache-cou petit, tuque jaune, germination | 92 |
| 3 | Réclamations, cas à voir, manteaux, usage et entretien | 163 |
| 4 | Pré-achat, problèmes et erreurs | 547 |
| 9 | **Écarté** — expédition, suivi, facturation | 2 827 |

Le rang 9 n'apprend rien à quelqu'un qui coud. Il reste dans l'index si une
question finit par le concerner.

## Ce qui a été appris en chemin, et qui vaut d'être su

**Le proxy Missive ne pouvait pas lire les fils fermés.** `listConversations`
paginait jusqu'à épuisement : sur `closed=true`, qui couvre tout l'historique,
la requête mourait en timeout ou en 429 avec des `retry_after` de 400 à 560
secondes. Trois paramètres bornés — `pages`, `since`, `until` — ont été ajoutés
au proxy pour cette extraction. Ils sont dans `main`.

**L'API Missive n'a aucune recherche plein texte.** Vérifié dans la
documentation officielle : les filtres sont les vues de boîte, `shared_label`,
et des filtres de contact. Pas de `search`, pas de `q`. On ne peut donc pas
chercher « raide » ou « décousu » à travers l'historique — d'où l'importance
des étiquettes.

**84 % des fils fermés ne portent aucune étiquette, et ils ne contiennent pas
ce qu'on cherche.** Sur 10 703 fils fermés sans étiquette, après retrait du
bruit machine (rapports DMARC, échecs de déploiement, notifications Shopify,
avis bancaires) il restait 1 372 réponses de clients : des médias, des
partenariats, des candidatures, des questions de semences, des réponses à une
infolettre de prévente. Quand un client signale un vrai problème, **l'équipe
support étiquette le fil**. Le classement qu'on cherchait à refaire était déjà
fait, par des humains qui avaient le dossier en main.

**271 fils sont tronqués.** Au-delà de dix messages, l'API Missive impose une
pagination que le proxy remonte jusqu'à une profondeur demandée. Ces fils
portent `"tronque": true` : les messages les plus anciens manquent. À
approfondir si l'un d'eux s'avère central.

**Un grep ne suffira pas pour classer.** Un comptage naïf du vocabulaire
trouve 219 occurrences de « brisson » — c'est un **nom de famille**, pas un
bris. De même, « couturières » (510) parle de l'équipe, pas d'un défaut de
couture. Le classement demande une lecture, pas une expression régulière.

## Ce qui est fait

1. **Classé.** `outils/distiller.js` produit `../donnees/retroactions.tsv` :
   **487 rétroactions**, rangées par produit et par famille de problème.
   `outils/lexique.js` porte le vocabulaire et ses faux amis, séparé du moteur
   parce que c'est la partie qui se corrige à la lecture des résultats.
2. **Images descendues et triées.** 247 images accompagnaient les fils retenus.
   **67 ont été écartées à l'œil, une par une** — reçus, captures de paiement,
   courriels, visages. Voir `photos-ecartees.tsv` et ses motifs. Les 180 autres
   sont dans `../photos-clients/`, redimensionnées et **sans EXIF**.
3. **Dans le MRP.** Un onglet par produit, groupé par problème, replié par
   défaut. `node ../import_retroactions.js --ecrire`.

**Décision révisée sur l'hébergement des photos.** Le plan disait « l'original
au Drive, une vignette dans le MRP ». Le Drive a été écarté : une URL lh3 est
lisible par quiconque l'a, et il s'agit de correspondance client. Les vignettes
vivent dans le dépôt privé et se servent derrière le mot de passe de l'app.

## Ce qui reste à faire

1. **Les 62 fils sans produit ni famille** — ils portent un problème mais rien
   ne dit de quoi ils parlent. Le numéro de commande, croisé avec Shopify,
   trancherait aussi les 222 « mitaines » ; ça se ferait ici, sur le corpus
   brut, pas sur le distillat qui est anonymisé.
2. **Brancher au protocole qualité** — chaque point de contrôle du MRP porte
   déjà un « Sinon : » qui dit la conséquence. Ces conséquences viendront de ce
   corpus, avec la photo et la citation du client. Les groupes de problèmes
   sont déjà la bonne maille pour ça.
3. **Les 1 428 images des fils écartés** ne sont pas descendues. Elles le
   seront si le classement s'élargit.
