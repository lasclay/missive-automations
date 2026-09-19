# Infolettre du 19 septembre, version anglaise

Gabriel a réécrit la version FR dans Klaviyo le 19 septembre à 09 h 24. Cette version-là a
été clonée et traduite en anglais, liens compris.

## Objets Klaviyo

| | FR (sa version) | EN (traduite) |
| --- | --- | --- |
| Campagne | `01M2VJH7CAF1F46NKZA2AD4M96` | `01M2VJHE68E35JYE3FKRXBWC72` |
| Message | `01M2VJH7CN00NZF9FJ2WZZC4D4` | `01M2VJHE6GE5BC8PQK78R1RRVN` |
| Gabarit de bibliothèque | `UabrTL` | `Y6ktzj` |
| Copie de campagne (ce qui part) | `TkxmTt` | `XdMDVr` |
| Objet | Wow, quelle prévente! 😍 | Wow, what a presale! 😍 |
| Aperçu | Et ce qui s'est passé à Dragons' Den jeudi | And what happened on Dragons' Den on Thursday |

Les deux restent en **Draft**. Copies figées ici : `klaviyo/2026-09-19-TkxmTt-fr.json` et
`klaviyo/2026-09-19-Y6ktzj-en.json`.

## Ce que la traduction reprend

Les cinq images sont réutilisées telles quelles (montage produits, champ et monarque, plateau
de Dragons' Den, photo finale). Elles ne contiennent pas de texte, sauf le logo.

Les sept liens produits pointent vers les handles anglais lus dans les traductions Shopify,
jamais `/en` collé devant un handle français :

| FR | EN |
| --- | --- |
| `gants-magiques-asclepiade` | `gants-magiques-asclepiade` |
| `boite-essai-soins-huile-asclepiade` | `milkweed-oil-body-care-trial-box` |
| `pince-a-cheveux-plastique-recycle-asclepiade` | `recycled-plastic-milkweed-hair-clip` |
| `t-shirt-coton-brode-monarque-asclepiade` | `embroidered-cotton-t-shirt-monarch-milkweed` |
| `thermal-insoles` | `thermal-insoles` |
| `barre-savon-huile-asclepiade` | `milkweed-oil-glycerin-bar-soap` |
| `creme-contour-yeux-huile-asclepiade` | `milkweed-oil-eye-contour-cream-moisturizer` |

Les neuf liens de la version anglaise répondent 200, vérifiés le jour même.

## Trois écarts assumés par rapport à la version FR

1. **La capture de la page de caisse a été retirée.** Elle est entièrement en français
   (« Code de réduction ou carte-cadeau », « Valider », « Paiement express ») et n'a pas de
   sens dans un courriel anglais. Le texte décrit la manœuvre à la place.
2. **« Le Québec est le seul endroit au monde » devient « Canada is the only place in the
   world »**, selon la règle de marque.
3. **L'échéance du rabais est nommée** : « It is good until September 30 ». DRAGONS15 se
   termine le 30 septembre à 23 h 59 (heure de l'Est) et la version FR ne le dit pas.

La personnalisation utilise `{{ person.first_name|default:'there' }}`, forme qui ne laisse
jamais « Hi , » si le prénom manque.

## À corriger dans la version FR

- **La capture d'écran montre le code `LASCLAY20`, pas `DRAGONS15`.** Le texte dit « Juste à
  l'entrer à l'endroit indiqué » : l'image indique un autre code. C'est le point le plus
  dommageable avant l'envoi.
- **`{{ first_name }}` au premier bloc, sans valeur par défaut.** Un contact sans prénom
  recevra « Bonjour , ». Le dernier bloc utilise déjà la bonne forme,
  `{{ person.first_name|default:'' }}`.
- **« Le Québec est le seul endroit au monde »** reste à passer à « Le Canada », d'après la
  règle appliquée côté anglais. Non fait ici pour ne pas écraser une édition en cours.
- L'adresse postale du pied de page garde « Québec » : c'est l'adresse de l'expéditeur, elle
  doit rester exacte pour la conformité anti-pourriel.

## Données vérifiées

- DRAGONS15 : `ACTIVE`, 15 %, tous les articles, sans minimum, du 14 septembre au
  30 septembre 2026 inclus.
- Les neuf liens anglais répondent 200.
- Aucun cadratin, ni dans la version FR de Gabriel ni dans la traduction.
- Aucune structure antithétique du type « ce n'est pas X, c'est Y ».
