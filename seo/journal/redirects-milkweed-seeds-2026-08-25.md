# Journal SEO — redirections vers les graines d'asclépiade régulières

Date : 2026-08-25
Boutique : lasclay.com (Shopify)
Cible unique : produit `milkweed-seeds` (« Graines d'asclépiade », ACTIVE)

## Pourquoi

Deux produits sont passés en brouillon et leurs pages ne sont plus servies :

- `milkweed-seed-bombs` — Bombes semencières - Asclépiade (DRAFT)
- `graines-semences-asclepiade-stratifiees-froid` — Semences d'asclépiade stratifiées
  à froid (DRAFT), dont la poignée anglaise traduite est `cold-stratified-milkweed-seeds`

Les redirections existantes envoyaient les bombes semencières vers les semences
stratifiées, elles-mêmes devenues brouillon : la chaîne finissait en 404. Tout est
maintenant ramené en un seul saut vers le produit vivant.

## Couverture

Préfixes de langue et de marché servis par la boutique, tous couverts :

| Préfixe | Marché | Langue |
| --- | --- | --- |
| (aucun) | Canada / défaut | français (langue principale) |
| `/en` | Canada / défaut | anglais |
| `/en-us` | États-Unis | anglais |
| `/fr-us` | États-Unis | français (langue alternative) |

Les marchés désactivés (`en-au`, `fr-eu`, `en-mx`, `en-nz`, `en-uk`) ne servent
aucune page : rien à rediriger tant qu'ils restent désactivés.

Formes d'URL couvertes pour chacune des trois poignées de produit
(`milkweed-seed-bombs`, `graines-semences-asclepiade-stratifiees-froid`,
`cold-stratified-milkweed-seeds`) :

- `{préfixe}/products/{poignée}`
- `{préfixe}/collections/{collection}/products/{poignée}` pour 11 collections :
  `all`, `produits-products`, `related-products-produits-connexes`, `garden`,
  `matieres`, `milkweed-materials`, `semences-d-asclepiade-stratifiees-a-froid`,
  `cold-stratified-milkweed-seeds`, `flower-seed-bombs`, `bombes-semences-graines`,
  `milkweed-accessories-spring`
- les pages de collection elles-mêmes (voir la réserve plus bas)

Les liens avec paramètre de variante (`?variant=...`) sont couverts : Shopify
apparie le chemin et conserve la chaîne de requête.

Liste complète des 160 chemins : `redirects-milkweed-seeds-2026-08-25.tsv`.

## Avant / après des redirections déjà existantes (modifiées)

| Chemin | Cible avant | Cible après |
| --- | --- | --- |
| `/products/milkweed-seed-bombs` | `/products/graines-semences-asclepiade-stratifiees-froid` | `/products/milkweed-seeds` |
| `/collections/bombes-semences-graines/products/milkweed-seed-bombs` | `/products/graines-semences-asclepiade-stratifiees-froid` | `/products/milkweed-seeds` |
| `/milkweed-seed-bombs` | `/en/products/milkweed-seed-bombs` | `/en/products/milkweed-seeds` |
| `/collections/bombes-semences-graines` | `/collections/semences-d-asclepiade-stratifiees-a-froid` | `/products/milkweed-seeds` |
| `/collections/flower-seed-bombs` | `/en/collections/cold-stratified-milkweed-seeds` | `/products/milkweed-seeds` |
| `/en-us/collections/flower-seed-bombs` | `/en-us/collections/cold-stratified-milkweed-seeds` | `/en-us/products/milkweed-seeds` |
| `/seed-bombs` | `/en/collections/flower-seed-bombs` | `/en/products/milkweed-seeds` |
| `/bombes-semencieres` | `/collections/garden` | `/products/milkweed-seeds` |
| `/products/graines-dasclepiade-a-planter` | `/products/milkweed-seeds-semences-asclepiade` (404) | `/products/milkweed-seeds` |
| `/en/products/milkweed-seeds-semences-asclepiade` | `/en-us/products/milkweed-seeds` | `/en/products/milkweed-seeds` |

Pour annuler l'une d'elles, il suffit de replacer la cible « avant ».

Ajouts hors périmètre strict, pour réparer d'anciennes poignées du produit cible
qui pointaient dans le vide : `/products/milkweed-seeds-semences-asclepiade`,
`/{en-us,fr-us}/products/milkweed-seeds-semences-asclepiade` et
`/{en,en-us,fr-us}/products/graines-dasclepiade-a-planter`.

## Vérification

Les 160 chemins ont été appelés sur le site en production :

- 140 répondent 301 directement vers la bonne cible.
- 8 aboutissent à la bonne cible en deux sauts. Shopify retire lui-même le segment
  de collection inexistant avant de consulter la table de redirections
  (`/collections/bombes-semences-graines/products/cold-stratified-milkweed-seeds`
  et l'équivalent `milkweed-accessories-spring`, sur les quatre préfixes).
- 12 sont en attente : voir la réserve ci-dessous.

## Réserve : deux collections encore publiées

Les redirections sont créées pour ces chemins, mais elles ne se déclenchent pas :
Shopify sert la collection existante avant de consulter la table.

- `semences-d-asclepiade-stratifiees-a-froid` (poignée EN `cold-stratified-milkweed-seeds`)
- `flower-seed-bombs` (« Milkweed & Wild flowers seed bombs »)

Les deux ne contiennent plus que des produits brouillon ou non répertoriés : leurs
pages s'affichent vides, sur les quatre préfixes. Il suffit de les retirer du canal
Boutique en ligne pour que les 12 redirections déjà en place prennent effet. Ce
geste retire des pages du site, donc il attend une décision humaine.

## Laissé intact volontairement

`flower-seed-bombs` (produit « Bombes semencières - Fleurs indigènes ») reste
joignable. Il est UNLISTED, pas brouillon, et il lui reste du stock : c'est une
gamme distincte, des fleurs indigènes et non de l'asclépiade. Le rediriger vers les
graines d'asclépiade fermerait une page encore vendeuse et enverrait le visiteur
vers un autre produit que celui qu'il cherchait.
