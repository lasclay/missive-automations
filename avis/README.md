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
