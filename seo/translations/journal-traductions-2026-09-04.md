# Journal des traductions anglaises publiées le 4 septembre 2026

Suite de l'audit `audit-traductions-2026-09-04.md`. Toutes les traductions ont été
publiées dans les traductions natives Shopify (locale `en`, celles que Langify v2 lit et
que `lasclay.com/en/` affiche) par `translationsRegister`, avec le digest du contenu
français courant. L'état **avant** est dans `snapshot-2026-09-04/` ; l'état **après**
(chaque valeur publiée, par ressource et par clé) est dans `registre-en-2026-09-04.json`.
Les corps de page anglais sont aussi dans `en/`.

Règles appliquées : anglais naturel canadien/américain (orthographe canadienne : colour,
fibre, metre), traduction fidèle du français courant, aucune mention d'origine qui
dépasse le français (seul l'isolant est cultivé et transformé au Québec), liens internes
vers `/en/…`, pas de tiret cadratin.

## Bilan chiffré

| Type de ressource | Ressources | Clés publiées |
| --- | --- | --- |
| Produits (titre, description, méta, type) | 70 | 185 |
| Champs méta produit (composition/entretien, dimensions, caractéristiques) | 61 | 61 |
| Valeurs d'options de variantes | 144 | 144 |
| Noms d'options | 46 | 46 |
| Collections | 29 | 87 |
| Pages | 11 | 22 |
| Gabarits du thème (JSON) | 10 | 135 |
| Groupes de sections (en-tête, pied) et réglages du thème | 3 | 14 |
| Liens de menu | 11 | 11 |
| Modes de livraison | 3 | 3 |
| Articles de blogue | 29 | 53 |
| **Total** (les lots 10 et 11 réécrivent des clés déjà comptées ; le lot 11 ajoute 2 clés préexistantes) | **417** | **763** |

## Lot 1 : menu actif (11 liens)

Liens du « Menu 2025 » et du pied de page sans anglais ou mal traduits (« Les
Imparfaits » → « lunch », etc.), réalignés sur le français.

## Lot 2 : produits actifs (70 produits, 185 clés)

- 11 produits de la prévente 2026 sans aucun anglais : sac de couchage, oreillers (camping,
  hypoallergène), manteau hivernal, chandail polaire, gants magiques, mitaines cuir,
  mitaines laine, cache-cou enfant, pince à cheveux, soins corporels (shampoing, gel,
  savon liquide, crème), boîte d'essai.
- Titres avec dates échues (« Pre-order November 2025 », « preorder January 2026 »,
  « Presale November 2025 », « June preorder ») retirées quand le français ne les a plus.
- 33 descriptions périmées ou HTML sale (`<!--StartFragment-->`, `data-start`) réécrites
  à partir du français courant.
- Méta-titres et méta-descriptions manquants ou en français (imprimés Asclepias, cartes
  cadeaux, échanges, cosmétiques, bijoux).

## Lot 3 : champs méta produit (61)

- 28 champs `composition_entretien` / `dimensions` / `features` dont l'anglais disait
  autre chose que le français (ex. isolant « 100% Milkweed » contre FR 50 % PLA / 30 %
  kapok / 20 % asclépiade ; manteau hivernal 60 % contre 20 %) : réécrits avec les
  compositions françaises réelles.
- 33 champs sans aucun anglais (bijoux, sac à dos glacière, tote bag, isolant vrac, crème
  contour des yeux, sac de couchage, oreillers, gants, mitaines cuir et laine, chandail,
  savon, cache-cou enfant). Même structure JSON riche que le français (paragraphes,
  listes, liens vers `/en/pages/guides-dentretien` et `/en/pages/sizing-chart`).
- Coquille FR corrigée dans l'EN seulement : sac de couchage « 131,5" (80 cm) » → 31.5".

## Lot 4 : options et valeurs de variantes (190)

- 11 valeurs avec dates échues en anglais seulement (« Pre-order December 2025 »,
  « mid-August 2025 », « mid-October 2025 », « preorder January 2026 ») : dates retirées.
- 133 valeurs sans anglais : couleurs (Noir, Vert forêt, Rouge fraise, Rose pastel, Jaune
  ambré, Cassonade, Jaune paille, Violet…), formats de manchons (Régulier 355 mL,
  Microbrasserie 473 mL, paquets de 2), pointures (« 8 femme - 6 homme » → « Women 8 -
  Men 6 »), tailles d'oreiller.
- 46 noms d'options : « Sac à lunch (Couleur) », « Besace… (Couleur) », « Mitaines
  (Taille) », « 1e besace », etc., et 7 noms marqués périmés re-validés.
- Convention retenue : « Color » (majoritaire dans la boutique), « Forest Green »,
  « Strawberry Red », « Charcoal Grey ».

## Lot 5 : collections (29 collections, 87 clés)

- 11 collections sans anglais : Pour le cou, Printemps, Été + Tous les jours, Soins du
  visage, Combos promotionnels, Rentrée 24, Bandeaux, Autres, Collaborations (titre),
  Produits (no garden), Mitaines (méta).
- Mentions d'origine retirées : Hiver « Locally made from milkweed fiber » → « Insulated
  with milkweed fibre grown and processed in Québec » ; méta Mitaines « made in Canada »
  retiré.
- Les Imparfaits : « Final sale on all items… No refunds or exchanges » rétabli.
- Vêtements : « Tested in the Arctic winter » (absent du FR) retiré.
- Fin de saison : titre et date alignés sur le FR (« March 2, 2024 », le FR est lui-même
  périmé, voir « À faire côté français »).
- Matières : méta-description en français remplacée.
- Descriptions et méta périmées réécrites (Mitaines, Accessoires, Produits, Imprimés,
  Été, Maison, Tous les jours, Cuisine, Sacs isothermes, Tuques et bandeaux, Manchons,
  Manteaux et vestes).

## Lot 6 : pages (11 pages, 22 clés)

| Page | Avant | Après |
| --- | --- | --- |
| Monarque | EN 2020 | réécrite (journal `seo/journal-2026-08-18.md`) |
| À propos | « Locally-made… Made in Beauce. Shipped with love », méta 2020 | « Our milkweed insulation… Harvested, designed and made in Québec », méta alignées |
| Équipe | EN listait Laurence | Gabriel et Catherine, comme le FR de mars 2026 |
| Points de vente | 298 Capucins, liste différente | 254 Capucins, même liste que le FR ; « Vancouver » → « British Columbia » (Courtenay) |
| Asclépiade | EN 2022, méta 317 caractères | réécrite sur le FR courant, méta 155 |
| Guide de plantation | EN 2023, liens en 301 | réécrite, liens `/en/products/milkweed-seeds`, guide Suzuki EN |
| Politique de confidentialité | aucun anglais | traduite (titre, corps, méta) |
| Guides des tailles | méta-description périmée | alignée |
| Infolettre, Avis, FAQ, Guides d'entretien | méta absentes ou périmées | alignées |

## Lot 7 : gabarits du thème (135 clés)

- `page.guide-entretien-produits` : 47 accordéons (foulards/cache-cous, bandeaux,
  tuques, manteau et veste, sacs isothermes, autres produits) traduits.
- `page.faq` : section « Entretien » ajoutée ; réponse « Livraison » réécrite avec les
  tarifs réels de la caisse (gratuit dès 98,59 $ CA, 6,99 $/9,99 $ sous ce seuil,
  timbre 2,99 $ ; États-Unis 6,99 $ US sous 59,99 $ US, gratuit au-delà).
- `product.cosmetics`, `product.manchons-seat-pad`, `product.sac-vin`,
  `product.plantule`, `product.mitaines-four-1` : titres d'accordéons et blocs
  marketing (« Un puissant hydratant naturel », « Élégance, personnalité et
  imperméabilité », « Responsable et sans cruauté »…) traduits.
- `product.graines-syriaca-1` et `product.sac-30l` : l'anglais remplaçait la balise
  Liquid du champ méta par un texte figé ou une balise cassée ; balise rétablie.
- `index` (accueil) : 15 diapositives et textes périmés (« National milkweed planting
  campaign », « This fall, plant milkweed », « Milkweed toques ») réalignés sur le
  carrousel FR courant (Prévente automnale 2026, crème contour des yeux, sacs isothermes,
  mitaines, cache-cous, énoncé de mission).
- En-tête et pied (groupes de sections + réglages) : barre d'annonce « FREE SHIPPING ON
  ORDERS OVER $50+ » → « FREE SHIPPING IN CANADA ON ORDERS OF $98.59+ » ; bloc promo
  « Cyber Monday… November 2023 » aligné sur le FR (Boxing Week) ; pied « Milkweed
  insulation harvested, designed and made with love in Québec, Canada » ; titres de
  colonnes du pied.

## Lot 8 : modes de livraison (3)

« Livraison gratuite » et « Free Shipping / Expédition Gratuite » → « Free shipping » ;
« Stamp / timbre (0 tracking) » → « Stamp (no tracking) ». Les modes du Mexique restent
en espagnol (zone MX).

## Lot 9 : blogue (29 articles, 53 clés)

- Cinq articles de fond du Journal traduits en entier (titre, résumé, méta, corps,
  liens internes vers `/en/`) : « Manteaux d'asclépiade et le compromis de la
  délocalisation », « L'histoire de l'industrie de l'asclépiade au Québec » (vers lequel
  pointe la page Monarque anglaise), « La soie d'Amérique en Nouvelle-France »,
  « Deux sacs sauvent une vie : l'asclépiade et la Seconde Guerre mondiale » et
  « La récolte de l'asclépiade ». Sources anglaises dans `en/articles/`.
- « Mitaines plus abordables » (liste courte) et « Coussins pour animaux & mitaines de
  bébé » (titre et méta ; le corps FR est vide) traduits.
- 22 autres articles : titre anglais seulement. Les 18 coupures de presse portent la
  mention « (in French) » et gardent leur corps français (citations de médias
  francophones) ; les deux mises à jour de lancement 2020, la prévente 2025 et
  l'infolettre de mai 2025 sont des nouvelles datées.

## Lot 10 : origine canadienne, formulations variées (40 clés, 35 ressources)

À la demande de Gabriel, l'anglais mentionne maintenant, en variant les tournures, que
l'entreprise est canadienne, que l'asclépiade (ressource phare) est cultivée et
transformée au Canada et que les produits sont conçus au Canada ou au Québec. Toujours
sans dire que les produits finis sont fabriqués ici.

- Formules utilisées : « a Canadian company », « a Canadian brand based in Québec »,
  « grown and processed in Canada », « Canada's plant-based insulation », « a Canadian
  plant-based insulation », « Canadian-grown insulation », « designed in Québec »,
  « designed in Canada », « Canadian-designed ».
- Où : 13 collections (Mitaines, Accessoires, Produits, Hiver, Maison, Tous les jours,
  Sacs isothermes, Tuques et bandeaux, Matières, Manteaux et vestes, Mitaines (2),
  Manchons, Été, Pour le cou), 13 méta de produits (cache-cou, besace, mitaines urbaines,
  veste, bandeaux, tote, sac à lunch, tuques, isolant vrac, crème contour), page À propos
  (méta), diapositive d'accueil, pied de page (deux emplacements), bloc « Responsible and
  cruelty-free » des quatre gabarits produit.

## Lot 11 : audit de traducteur professionnel (62 clés, 44 ressources)

Relecture de l'ensemble des 761 clés publiées en se plaçant du point de vue d'un traducteur
anglophone professionnel, à partir d'une grille des erreurs typiques des francophones qui
écrivent en anglais (interférences, faux amis, calques, ordre des mots, usages canadiens).

Sources consultées pour la grille : London School of English (« common mistakes French
speakers make in English »), Scribendi (calques et faux amis), Linguee et WordReference
(« éco-responsable », « valoriser », « performant », « en nature »), Anglocom (guide sur
« valoriser »), The Canadian Style et le guide des nombres du Musée canadien de
l'histoire (symbole $ avant le nombre, « 50 % » sans espace en anglais, espace avant les
unités), Collins et Linguee pour tuque, manchon, besace et cache-cou.

Grille appliquée à chaque clé : faux amis (actually, eventually, important, propose,
permit, allow to, responsible of, since + durée, performant, valorize, in nature,
reception, eco-responsible, ecological), calques de construction (« made to measure »,
« at a small price », « your ally », « adopt » au sens de choisir), pluriels et possessifs
(« the Karen's »), ordre adjectif-nom, orthographe canadienne (colour, fibre, metre,
-ize), majuscule de l'option « Color », espace insécable et unités, structure des
champs riches (mêmes nœuds qu'en français).

Corrections publiées (toutes à `userErrors: []`) :

- « high-performing » → « high-performance » (11 clés : produits, collections, gabarits).
- « eco-responsible » → « eco-friendly » ou « environmental values » selon le contexte
  (8 clés) ; « is ecological, plant-based » → « is eco-friendly, plant-based » dans les
  quatre gabarits produit.
- « in nature » → « outdoors » / « in the great outdoors » (4 clés).
- Guide d'entretien : « Upon reception » → « When it arrives », « Washing frequency » →
  « How often to wash » (onglets et titres, y compris deux clés anglaises préexistantes).
- « Adopt one-of-a-kind pieces » → « Embrace one-of-a-kind pieces ».
- « local joining forces with local » → « local talent joining forces with local talent ».
- « at a small price » → « at a low price ».
- Bague : « made to measure » → « made to size », « Make sure of your ring size » → « Make
  sure you know your ring size » ; « highly precise casting(s) » → « highly detailed ».
- Coussin pour animaux : « virgin fibres recycled » → « unused fibre offcuts recycled » ;
  « The result of long research and development, we recently added » → « After a long
  stretch of research and development, we recently added ».
- Crème contour des yeux : « a material that is both sensory and effective » → « an
  ingredient that is a pleasure for the senses and effective on the skin » ; « from here »
  → « from right here ».
- Veste et manteau : « your ally » → « your go-to ».
- Coussin d'assise : « more resistant, durable, effective and eco-friendly » → « tougher,
  longer-lasting, more effective and more eco-friendly ».
- « giving value to milkweed » → « creating value from milkweed ».
- « milkweed insulated lunch bag » → « milkweed-insulated lunch bag » ; « a friendly
  milkweed cooler format » → « a milkweed cooler in a friendly size ».
- Bombes de semences : « beautify a parcel » → « beautify a plot of land » ; « across the
  land » → « across the landscape ».
- Chaussons : « on the tile » → « on tile floors ».
- Fin de saison : « breaks along the seams » → « seam flaws ».
- Isolant vrac : « This non-woven » → « This nonwoven batting ».
- « athletes that nothing can stop » → « athletes who never stop ».
- Noms d'options « (color) » → « (Color) » (3 clés).
- Bijoux : second « talented » retiré (déjà dit dans la phrase précédente).

Vérifié et laissé tel quel :

- « Respectful of monarchs » (bloc responsable des gabarits) : formulation déjà présente
  dans six gabarits anglais antérieurs, conservée pour l'uniformité.
- Tiret cadratin dans les valeurs de taille d'oreiller : reproduit le français.
- « -32°C » sans espace dans une clé, « -32 °C » ailleurs : reflète le français.
- Mitaines de laine : « gris kaki » et « vert kaki » coexistent dans le français, l'anglais
  suit.
- Symboles monétaires : « $6.99 », « $98.59 » et « 50% » conformes à l'usage canadien
  anglais.

## Volontairement laissé tel quel

- Page Mission : le français doit être réécrit d'abord (audit des pages, point 4).
- Page Presse (`/pages/media`) : à rediriger vers le blogue `zone-media` plutôt qu'à
  traduire.
- Pages à dépublier (ambassadors, avada-faqs, transparence vide, copy-of-concours).
- Gabarits `product.semelles-isolantes` et `product.bombe-semence-1` : l'anglais y
  remplace une balise Liquid par un texte figé ; sur les semelles ce texte anglais est
  plus complet que le champ méta FR (inexistant), donc conservé.
- Coupures de presse du blogue : corps en français (voir lot 9).
- Produits en brouillon (combos) : options traduites, descriptions non.

## À faire côté français (relevé pendant la traduction)

- Barre d'annonce du thème : « 119 $ » alors que la caisse offre la livraison gratuite dès
  98,59 $.
- FAQ, réponse Livraison : « 100 $ » et « 7,99 $ » ; réels 98,59 $ et 6,99 $/9,99 $.
- Pied de page (groupe de sections) : « Produits d'asclépiade cueillis, conçus et
  fabriqués… au Québec » alors que les réglages du thème disent « Isolant d'asclépiade… ».
  L'anglais dit « insulation » dans les deux.
- Collection Fin de saison : « 2 mars 2024 ».
- Collection Tous les jours, méta : « fabriqués avec des matériaux locaux ».
- Collection Sacs isothermes, méta : « cultivé et fabriqué au Québec ».
- Points de vente : en-tête « Vancouver » pour un détaillant de Courtenay.
- Option « Bandeau d'asclépiade torsadé extra-doux - Précommande novembre 2025 (Couleur) »
  et valeur « Noir - Précommande Hiver 25-26 » (produit combo) : dates échues en FR.
- Guide de plantation : « asclépaide », « oùl'ensoleillement », « rongueurs » ; liens vers
  des produits retirés (bombes semencières).
- Sac de couchage, champ Dimensions : « 131,5" (80cm) » (lire 31,5").
