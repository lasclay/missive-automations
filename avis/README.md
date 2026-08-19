# Audit des avis clients — « review à traiter »

Repère dans la boîte Missive les clients qui ont fait un éloge spontané sans jamais
publier d'avis sur Judge.me, et retire l'étiquette des fils qui n'auraient pas dû la porter.

## Règle, telle que fixée par Gabriel

L'étiquette `Support/review à traiter` (`1681e586-9a75-49a6-bf90-75a2620d20a5`) ne marque
**que du positif**. Un fil négatif qui la porte est une erreur, et l'étiquette se retire.
Un fil dont l'auteur a déjà publié sur Judge.me se retire aussi. Qu'une même personne ait
plusieurs avis Judge.me identiques est normal : elle évalue plusieurs produits à la fois.

Attention : la convention observée dans les 124 fils déjà étiquetés est plus large que
cette règle. Elle ramassait aussi les retours produits négatifs et étiquetait
systématiquement les notifications Judge.me. C'est précisément ce que cette passe corrige.

## Chaîne

```
node harvest.js      # collecte les fils Missive → threads.jsonl (reprend où il s'est arrêté)
./pipeline.sh        # detect.js puis croise.js → candidats.jsonl, decisions.jsonl
```

`harvest.js` respecte la limite de l'API Missive (environ 300 requêtes par 15 minutes sur un
jeton unique, deux appels par fil, donc dix fils par minute). Il place les fils déjà
étiquetés en tête, parce que la passe de retrait porte sur eux et que plusieurs sont fermés,
donc absents de la boîte de réception.

`detect.js` note les éloges en français et en anglais, sur les seuls messages du client.
Quatre pièges lui ont coûté cher pendant la calibration, et le code les traite explicitement :

1. **L'apostrophe typographique.** Apple Mail et Outlook écrivent `j’adore`. Un lexique bâti
   sur `j'adore` ne voyait rien, alors que c'est l'éloge le plus fréquent du corpus.
2. **Les citations recollées.** Sous l'entête `De :` ou `From:`, le client recolle
   l'infolettre de Lasclay. Sans la coupe, on note nos propres textes comme s'il les avait
   écrits.
3. **Le grief au niveau du fil.** Un colis perdu n'annule pas « mon conjoint aime beaucoup ».
   La pénalité est appliquée à la phrase, jamais au fil entier.
4. **Les souhaits de circonstance.** « Bonne chance », « joyeuses fêtes » ne sont pas un avis.

`croise.js` rapproche chaque fil des avis Judge.me. Un retrait exige une correspondance
**forte** : nom et prénom, ou prénom plus initiale. Le prénom seul ne prouve rien, Judge.me
en affiche des dizaines d'identiques.

## Source Judge.me

Les métachamps Shopify ne donnent que cinq avis par produit, soit 19 % du total. La liste
complète passe par la route publique du widget, sans jeton :

```
https://cdn.judge.me/reviews/all_reviews_js_based?url=lasclay.myshopify.com&shop_domain=lasclay.myshopify.com&platform=shopify&per_page=25&page=N
```

`per_page` est plafonné à 25, il y a 35 pages. Elle rend 853 avis sur les 859 annoncés,
de mars 2021 à août 2026. Elle ne donne ni courriel ni nom complet garanti : l'auteur est
souvent un prénom seul, d'où l'exigence de correspondance forte avant tout retrait.

## Données

Aucune sortie n'est versée au dépôt : `threads.jsonl`, `candidats.jsonl` et `decisions.jsonl`
contiennent des courriels et des messages de clients. Ils restent dans le répertoire de
travail de la session.

## Gabarit d'importation Judge.me

`gabarit.js` produit `import_judgeme.tsv` au format exact des importations passées, conservées
dans le Drive sous `1.7 Judge.Me Reviews Importation`. Colonnes :

```
title  body  rating  review_date  source  curated  reviewer_name  reviewer_email
product_id  product_handle  reply  reply_date  picture_urls  ip_address  location  metaobject_handle
```

Conventions relevées dans les fichiers déjà remplis : `rating` à 5, `source` à `web`,
`curated` à `ok`, `review_date` au format `2025-09-04 17:18:05 UTC`, et **une ligne par
produit** quand la même personne en évalue plusieurs. C'est voulu et normal.

Le courriel du client vient de Missive, pas de Judge.me : la route publique de Judge.me ne
donne qu'un prénom. C'est aussi pourquoi `importes.json`, extrait des importations passées,
sert de garde-fou : il porte les courriels des personnes déjà versées.

### Ce que le script ne fait pas, et ne doit pas faire seul

L'extrait produit par `detect.js` est la phrase qui a le mieux noté, pas un corps d'avis
publiable. « Pardon, j'ai commandé trop vite sans avoir vu que vous aviez des cache-cous
noirs » contient bien un signal positif, mais ce n'est pas un avis. Choisir les mots du
client qui forment un avis, et leur donner un titre, demande un jugement que le lexique n'a
pas. Cette étape passe par une relecture, humaine ou par un agent, avant l'importation.

## Vérifier ce que les agents rédigent

`verifie.py` est le contrôle qui compte. Pour chaque avis rédigé, il découpe le corps en mots
de quatre lettres et plus et vérifie que chacun apparaît dans les messages du client du fil
correspondant. Au-delà d'un mot sur cinq absent, ce n'est plus une coquille corrigée.

Il ne s'agit pas de méfiance de principe. Douze agents ont travaillé en parallèle dans un
répertoire partagé, et leurs scripts d'aide portaient des noms génériques (`show.py`,
`dump.py`). Ils se sont écrasés entre eux, et plusieurs lectures ont renvoyé le contenu d'un
autre lot. Dix agents sur douze l'ont détecté eux-mêmes en recoupant les identifiants et ont
tout relu. Le contrôle indépendant confirme le résultat : sur 478 avis, 471 sont ancrés mot
pour mot dans leur source, et les sept restants sont des corrections d'accord sur des avis
courts, où un seul mot fait basculer le pourcentage.

Deux enseignements pour la prochaine fois :

1. Donner à chaque agent un **répertoire de travail distinct**, et lui interdire les noms de
   fichiers génériques.
2. Ne jamais se fier au compte rendu d'un agent sur la fidélité de son propre travail.
   Le contrôle doit être refait de l'extérieur, sur les fichiers livrés.

## Rattacher un avis à un produit

Un tiers des avis retenus ne nomment aucun produit : « j'adore vos produits », « votre service
est excellent ». Le texte ne tranche pas, la commande si. `assemble.js` va chercher dans
Shopify les articles réellement achetés par ce courriel et les utilise en repli, **à condition
qu'il y en ait au plus trois**. Au-delà, on ne sait plus lequel le client louait, et l'avis
part à la revue humaine plutôt que d'être attribué au hasard.

## Le contre-examen des rejets, et pourquoi il était obligatoire

La première passe a rejeté 1 534 fils sur 2 012. Un rejet ne laisse aucune trace : un avis
légitime jeté disparaît sans que personne ne s'en aperçoive. C'est l'angle mort du procédé.

Les 1 534 ont donc été réexaminés, par des agents à qui on demande de **chercher les erreurs**
de la première équipe, pas de la confirmer. Résultat : **145 avis récupérés, 9,5 % d'erreur**.

Le patron est unique et il se répète d'un lot à l'autre : **le fil est classé par sa demande,
pas par son contenu**. Un client écrit pour faire réparer une couture, et dit au passage
« j'adore ces mitaines, elles sont chaudes ». Le fil part dans « plainte », l'éloge part avec.

Deux formes, et une troisième plus rare :

1. l'éloge porte sur **un autre produit** que celui qui pose problème ;
2. l'éloge porte sur **le même produit** et coexiste avec un défaut, ce qui donne un avis
   honnête à 4 étoiles plutôt qu'un silence ;
3. l'éloge est **court mais net** (« très contente », « le coussin est magnifique ») et passe
   pour de la politesse.

Deux garde-fous ont tenu dans les onze audits, et ils comptent autant que les récupérations :
un éloge suivi du **retour du produit** ne se publie pas, et un éloge **rétracté plus loin dans
le fil** non plus. Publier tromperait le lecteur.

## Quatre défauts trouvés par contrôle, jamais par relecture d'un rapport d'agent

1. **Une adresse courriel en guise de nom d'auteur**, sur 395 lignes. L'archive Missive ne
   garde souvent que l'adresse dans le champ expéditeur.
2. **Un nom en guise d'adresse courriel**, sur 47 lignes venues de Messenger et Instagram.
   L'une attribuait un avis à « Lasclay: The Milkweed Company », c'est-à-dire à nous.
3. **L'avis distribué sur tout l'historique d'achat** au lieu de la commande qui le précède.
4. **Trois avis déjà publiés mot pour mot** sur Judge.me.

D'où deux règles dans `assemble.js` : une adresse doit ressembler à une adresse, un nom ne doit
jamais en être une, et aucun avis ne peut être signé par quelqu'un de la maison.

## Badge « acheteur vérifié »

Judge.me ne l'accorde que si l'adresse a commandé **ce produit-là**. Vérifié ligne par ligne
pour les 418 personnes : 530 lignes l'obtiennent, 55 concernent un produit que la personne n'a
pas commandé sous cette adresse, 69 viennent d'adresses sans aucune commande. Les avis restent
publiables sans le badge : c'est le sort normal d'un client qui écrit d'une adresse
personnelle après avoir commandé au bureau, ou qui a reçu le produit en cadeau.

## Le consentement, et l'identité de l'auteur

Deux contrôles ajoutés en fin de parcours, tous deux nés d'une observation d'agent :

**Refus de publication.** Une cliente écrivait « je préférerais vous en parler personnellement
que de faire un commentaire public ». Un agent l'a écartée de lui-même. Le corpus entier a
ensuite été balayé pour ce genre de formulation : trois occurrences, toutes de faux positifs
(pieds de page juridiques d'entreprise). Aucun autre refus explicite dans les avis retenus.

**Auteur qui n'est pas un client.** Le même balayage a fait ressortir Dominique Berthiaume,
qui écrit « j'adore vos produits » et se présente dans la phrase précédente comme représentant
des ventes chez Red Bull, à propos d'un produit concurrent à saveur d'asclépiade. Courtoisie
entre marques, pas avis de client. Écarté nommément, avec la raison en commentaire.

C'est le genre de cas qu'aucune règle générale n'attrape et qu'aucun compte rendu d'agent ne
signale spontanément. Il est sorti d'un balayage lancé pour une autre raison.

## L'archive n'était pas complète non plus

La collecte directe de la boîte a rapporté **733 fils absents de l'archive**, échelonnés de
juin 2023 à août 2026. Le script d'export en écarte manifestement une partie. 170 portaient un
signal, traités dans les lots 13 et 14, pour 36 avis de plus.

Leçon pour la prochaine fois : l'archive est la voie rapide, elle n'est pas la voie exhaustive.
Les deux sources se complètent, et `detect.js` lit bien les deux.

## Fichiers livres

`node assemble.js` produit trois TSV, convertis en CSV par `python3 tsv2csv.py` :

| Fichier | Contenu |
| --- | --- |
| `import_judgeme.csv` | les avis a verser sur les fiches produits |
| `import_judgeme_boutique.csv` | les avis sans produit identifiable, pour l'avis de boutique |
| `import_judgeme_a_relire.csv` | note 3, ou note 4 signalant un bris ou une taille : a trancher a la main |

`python3 tableau.py && python3 tableau_page.py` reconstruisent la page de controle
qualite (`qc.html`) a partir de ces CSV, avec le statut « acheteur verifie » ligne par ligne.

## Pieges deja payes

- **Les listes de fichiers ecrites a la main.** Les releves d'achats et de noms arrivent par
  lots successifs (`achats_A`, `achats_B`...). Une liste codee en dur en oublie toujours un,
  et les avis perdent alors leur badge sans le moindre message d'erreur. On balaie le
  repertoire au lieu de nommer les fichiers.
- **Le badge « acheteur verifie ».** Judge.me ne l'accorde que si l'adresse a commande CE
  produit precis. Un avis rattache au bon client mais au mauvais article s'importe quand
  meme, sans badge.
- **Les fiches brouillon.** Un handle peut exister dans Shopify tout en etant a l'etat de
  brouillon : la page n'est pas publique et l'avis y resterait invisible. Ces lignes partent
  vers les avis de boutique (`BROUILLONS` dans `assemble.js`).
- **La carte cadeau.** L'eloge d'un client qui a paye avec un bon porte sur ce qu'il a recu,
  jamais sur le bon (`giftcard` est dans `MORTS`).
- **Le meme client, quatre fois.** Un habitue ecrit « je suis satisfaite de mes achats »
  tous les ans. Une seule ligne par personne et par produit, la plus complete.
- **La plainte publiee cinq etoiles.** Un client qui ecrit au soutien pour une couture
  decousue n'ecrit pas un avis. Le tri par note et par lexique de panne le met de cote
  plutot que de tronquer sa phrase pour n'en garder que l'eloge.
