# Journal SEO — ratissage des 404 et descriptions de collections

Date : 2026-08-25
Boutique : lasclay.com (Shopify)
Suite du journal `redirects-milkweed-seeds-2026-08-25.md`.

## Ce qui a été fait

Après les redirections des semences, ratissage de toutes les pages produit qui
répondaient 404 sur le site, puis correction des descriptions de collections qui
annonçaient encore des produits disparus.

## 1. Ratissage des 404

Les 51 produits en brouillon ou archivés ont été testés en production. 43 pages
répondaient 404 (les 8 autres avaient déjà une redirection). Chacune est
maintenant redirigée vers son équivalent vivant, sur les quatre préfixes servis
(défaut FR, `/en`, `/en-us`, `/fr-us`) et sur chacune des collections auxquelles
le produit appartenait.

588 chemins au total. Liste complète : `redirects-404-sweep-2026-08-25.tsv`.

| Produit disparu | Cible |
| --- | --- |
| Mitaines, préventes et ventes de fin de saison 2020 à 2022 (3 pages) | `/products/mittens` |
| Crochet à mitaines, Pince à mitaines | `/products/pince-a-mitaines-1` |
| Graines d'asclépiade en vrac (2 pages), Plantules d'asclépiade | `/products/milkweed-seeds` |
| Carte-cadeau, Gift card Rise.ai | `/products/giftcard` |
| Glacière à boissons imprimée 3D | `/products/manchon-isotherme-canettes-bouteilles` |
| Mitaines de four, sous-plat, poignées de four, ensemble de cuisine | `/collections/milkweed-oven-mitts-pot-holders` |
| 9 combos promotionnels et combos bandeau | `/collections/combos-promotionnels` |
| 6 Illustrations Asclépiade et Monarques | `/collections/prints` |
| 2x et 4x Sac lunch | `/products/lunchbag` |
| 2x et 4x Besace, Besace IMPARFAIT | `/products/besace` |
| Étui tablette (2 pages) | `/products/etui-telephone-asclepiade` |
| Bandeau torsadé IMPARFAIT | `/products/bandeau-copy` |
| Semelles (copie) | `/products/thermal-insoles` |
| Sac isotherme tote bag IMPARFAIT | `/products/insulated-tote-bag` |
| Foulard IMPARFAIT, Foulard ancienne version | `/products/scarf` |
| Couverture imprimée, modèle discontinué | `/products/couverture-imprimee-asclepiade-monarques` |
| Mitaines urbaines, ancienne version | `/products/mitaines-ville-asclepiade` |
| Glacière anglais dummy | `/collections/sacs-isothermes-glacieres-asclepiade` |
| Deux fiches « Sans titre » sans contenu | `/collections/all` |

Vérification : les 588 chemins ont été appelés en production, tous répondent 301
vers la bonne cible. Nouveau balayage des 51 produits sur les quatre préfixes :
plus aucun 404, sauf l'exception ci-dessous.

**Laissé de côté volontairement : `savon`** (« Savon hydratant à la glycérine et
huile d'asclépiade »). Le produit est en brouillon mais il a été modifié
aujourd'hui et il a du stock : c'est un lancement en préparation, pas un produit
retiré. Une redirection sur cette poignée nuirait à sa mise en ligne. À revoir si
le lancement est abandonné.

## 2. Descriptions de collections

Les collections décrivaient encore des produits retirés (bombes semencières,
semences stratifiées, plantules). Corrigé en français et en anglais.

| Collection | Avant | Après |
| --- | --- | --- |
| `garden` / Pour le jardin | « Semences stratifiées prêtes à semer, bombes semencières et plantules » ; EN « Milkweed seeds and seed balls » | Graines de plusieurs espèces indigènes et service de plantation clé en main |
| `milkweed-accessories-spring` | « Semences à semer, bombes semencières et accessoires d'entre-saison » | « Graines à semer et accessoires d'entre-saison » |
| `semences-d-asclepiade-stratifiees-a-froid` | Description du produit stratifié comme s'il était en vente | Dit que les semences stratifiées et les bombes ne sont plus offertes, explique pourquoi, et renvoie aux graines d'asclépiade avec la méthode de stratification maison |
| `flower-seed-bombs` | Description des bombes semencières comme si elles étaient en vente | Dit que les bombes ne sont plus offertes, explique pourquoi, et renvoie aux graines d'asclépiade |

Les méta descriptions et méta titres de ces collections ont été alignés sur le
même message. Les valeurs d'avant sont récupérables dans l'historique de cette
page et dans le journal précédent.

## 3. Ce qui reste à faire par un humain

Les deux collections retirées, `semences-d-asclepiade-stratifiees-a-froid` (poignée
EN `cold-stratified-milkweed-seeds`) et `flower-seed-bombs`, sont toujours publiées
sur la Boutique en ligne. Shopify sert la collection existante avant de consulter la
table de redirections, donc les 12 redirections créées pour ces chemins restent
dormantes. Leur nouvelle description fait le pont en attendant : la page explique le
retrait et renvoie aux graines d'asclépiade, plutôt que d'afficher une grille vide.

Pour activer les 12 redirections, il faut retirer ces deux collections du canal
Boutique en ligne depuis l'admin Shopify. Le geste n'a pas pu être posé ici : la
dépublication est bloquée par la politique de sécurité du connecteur, précisément
pour éviter qu'un agent retire des pages du catalogue sans décision humaine.
