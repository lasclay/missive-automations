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

## Échanges gratuits (4 septembre, soirée) : nouvelle politique affichée partout

Politique : échanges gratuits au Canada (bordereau prépayé, aucuns frais), retour avec
remboursement à 9,99 $ de frais de manutention, 15 jours, état neuf, vente finale et
Imparfaits exclus. Demandé par Gabriel après l'évaluation des emplacements. Tout est en
FR et en EN.

Publié (contenu, visible tout de suite) :

- Nouvelle page `/pages/livraison-et-echanges` (gid Page/137938370779) : échanges gratuits,
  retours, exclusions, défauts, livraison. FR : `fr/livraison-et-echanges.html`, EN :
  `en/livraison-et-echanges.html`. Titre, méta titre, méta description traduits.
- FAQ (corps de page) : six passages réécrits (réponse rapide « Retourner ou échanger »,
  intro Tailles, « Je me suis trompé de taille », intro Retours, politique en bref, « Comment
  faire un retour? »). La FAQ n'avait aucune traduction anglaise du corps : traduction
  complète publiée (`en/faq.html`), donc `/en/pages/faq` sera en anglais quand « sep 2026 »
  sera publié (le thème actif n'affiche pas le corps de page).
- Guides des tailles (général, manteaux et vestes, t-shirts brodés) : paragraphe d'ouverture
  « Pas la bonne taille? L'échange est gratuit au Canada… » en FR et en EN, avec lien vers la
  nouvelle page.
- Menus : « Échanges gratuits et retours » ajouté au pied de page Aide & Guides (2e position)
  et au sous-menu Aide & Guides de l'en-tête ; lien traduit « Free exchanges and returns ».

Publié sur le thème non publié « sep 2026 » (copies dans `seo/theme-sep-2026/`) :

- 12 gabarits produit (tous sauf gift-card) : bloc « Trust icons » sous le bouton d'achat
  (Échanges gratuits au Canada / Livraison gratuite dès 98,59 $ / 15 jours pour changer
  d'idée / Isolant cultivé et transformé au Québec ; variantes « Espèces indigènes du
  Québec » pour graines et plantule, « Huile d'asclépiade cultivée au Québec » pour
  cosmetics) et accordéon « Livraison, échanges et retours » branché sur la page
  `livraison-et-echanges` après le dernier accordéon.
- Panier (`templates/cart.json`) : blocs sous-total + texte « Échanges gratuits au Canada.
  Livraison gratuite dès 98,59 $. » + lien vers la page.
- 62 clés anglaises enregistrées pour ces blocs (theme_id 164701012187).

Bloqué ou à faire à la main :

- Politiques Shopify (Politique de remboursement et d'expédition, liées au pied de la
  caisse) : `shopPolicyUpdate` refusé, portée `write_legal_policies` absente du connecteur.
  La politique de remboursement actuelle est une ligne en anglais (« 15 days after
  reception for refunds, 1 year defect warranty for exchanges ») et la politique
  d'expédition est vide. Textes prêts à coller (Paramètres > Politiques) : remboursement =
  sections « Échanges gratuits au Canada », « Retours et remboursements », « Ce qui n'est
  pas admissible », « Un défaut? » de `fr/livraison-et-echanges.html` ; expédition =
  section « Livraison » de la même page. Une fois remplie, la politique d'expédition fait
  apparaître un lien dans le panier (« Taxes et frais de livraison calculés à la caisse »).
- Noms des tarifs de livraison (« Standard », « Express ») : non renommés, parce que
  ShipStation et ses règles d'automatisation peuvent dépendre de ces libellés. À décider
  avec l'équipe expédition avant d'ajouter « échanges gratuits » au nom.
- Barre Hextom (livraison gratuite) : ajouter un second message en rotation « Échanges
  gratuits au Canada », dans l'application.
- Courriel de confirmation de commande Shopify et flux Klaviyo (panier abandonné,
  bienvenue) : ajouter « Pas la bonne taille? L'échange est gratuit au Canada. » / « Wrong
  size? Exchanges are free in Canada. »
- Thème actif « 18 aout » : ses accordéons FAQ disent encore 9,99 $ pour un échange, jusqu'à
  la publication de « sep 2026 ».
- Crédit-boutique : la nouvelle politique ne dit pas s'il est gratuit comme l'échange ou
  soumis aux 9,99 $ comme le remboursement. La FAQ le mentionne sans montant.

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

## Corrections côté français (4 septembre, après-midi)

À la demande de Gabriel, les points relevés ci-dessous ont été corrigés dans le français
courant, puis les traductions anglaises touchées ont été republiées avec le nouveau digest
(sinon Shopify les marque « périmées »). Avant/après complet de chaque champ :
`corrections-fr-2026-09-04.json`.

Corrigé dans Shopify (contenu, zone verte) :

- FAQ, corps de page : « Livraison gratuite dès 100 $ » devient « Livraison Xpresspost
  gratuite dès 98,59 $ d'achat, partout au Canada. Sous ce montant, comptez 6,99 $ en
  livraison standard ou 9,99 $ en Xpresspost » (tarifs vérifiés dans les profils
  d'expédition).
- Points de vente : en-tête « Vancouver » devient « Colombie-Britannique » (Local
  Refillery est à Courtenay) ; l'anglais disait déjà « British Columbia ».
- Guide de plantation : « asclépaide » → « asclépiade », « oùl'ensoleillement » → « où
  l'ensoleillement », « rongueurs » → « rongeurs » ; le lien graines pointe directement sur
  `/products/milkweed-seeds` ; les deux liens « procurez-vous des bombes semencières »
  (produits retirés) remplacés par « Les bombes semencières ne sont plus offertes. Le guide
  ci-dessus reste utile si vous en avez encore à planter. » Même chose en anglais.
- Collection Fin de saison : la date « 2 mars 2024 » remplacée par une description
  permanente ; anglais republié en conséquence.
- Collection Pour tous les jours, méta description : « fabriqués avec des matériaux
  locaux » devient « isolés à la soie d'asclépiade, une fibre végétale cultivée et
  transformée au Québec ». Note : `collectionUpdate` avec `seo.description` seul a vidé le
  titre SEO ; il a été rétabli aussitôt (« Pour Tous Les Jours | Essentiels du quotidien
  écoresponsables ») et les deux clés EN republiées.
- Sac de couchage, champ Dimensions : « 131,5" (80cm) » → « 31,5" (80cm) ».
- Produits en brouillon (combos bandeau) : option « … - Précommande novembre 2025
  (Couleur) » → « Bandeau d'asclépiade torsadé extra-doux (Couleur) » ; valeur « Noir -
  Précommande Hiver 25-26 » → « Noir ». Anglais republié.

Vérifié en ligne après publication : plus aucune des trois fautes sur `/pages/planting-guide`,
note « bombes semencières » visible en FR et en EN, en-têtes Colombie-Britannique /
British Columbia sur les points de vente.

Laissé tel quel : la méta de la collection Sacs isothermes (« isolant d'asclépiade cultivé
et fabriqué au Québec ») vise l'isolant, pas le produit fini, formulation conforme aux
règles de la marque.

Thème non publié « sep 2026 » (gid 164701012187), à la demande de Gabriel, écrit par
`themeFilesUpsert` (l'écriture sur le thème publié est bloquée) :

- `sections/footer-group.json` : « Produits d'asclépiade cueillis, conçus et fabriqués avec
  amour au Québec, Canada. » → « Isolant d'asclépiade cueilli, conçu et fabriqué avec amour
  au Québec, Canada. »
- `sections/header-group.json` : barre d'annonce « LIVRAISON GRATUITE SUR LES COMMANDES DE
  119$+ » → « LIVRAISON GRATUITE AU CANADA DÈS 98,59 $ » (barre désactivée dans ce thème
  aussi).
- Gabarit FAQ : rien à faire, ce thème utilise déjà la section `main-faq-html` qui affiche
  le corps de page (plus d'accordéons périmés).

Traductions anglaises de ce thème (elles sont propres à chaque thème, donc la copie n'avait
pas celles publiées aujourd'hui) : 115 clés portées depuis le registre (guide d'entretien,
gabarits cosmetics, manchons/seat-pad, mitaines de four, plantule, sac-vin), 8 clés des
groupes en-tête et pied de page, 20 clés périmées remplacées (réglages, accueil, guide
d'entretien, graines-syriaca, sac-30l), et 7 textes d'accueil propres à ce thème traduits
à neuf (« Rich in vitamin E and omegas 6, 7 & 9 », « Explore the skincare collection », « In
collaboration with Gourmet Sauvage », « Milkweed neck warmers perform down to -50°C, but
stay just as comfortable in milder weather », « Responsible, high-performance bags »,
« Explore the bag collection », « Our range of insulated bags »). Toutes à `userErrors: []`.
Le registre `registre-en-2026-09-04.json` reste indexé sur le thème publié ; les mêmes
valeurs valent pour « sep 2026 » aux clés identiques.

À faire dans l'éditeur du thème publié seulement (si « sep 2026 » n'est pas publié
bientôt, zone jaune) :

- Pied de page (groupe de sections `footer`, bloc texte) : « Produits d'asclépiade
  cueillis, conçus et fabriqués avec amour au Québec, Canada. » → « Isolant d'asclépiade
  cueilli, conçu et fabriqué avec amour au Québec, Canada. » (c'est déjà ce que disent les
  réglages du thème et l'anglais).
- Barre d'annonce (en-tête, désactivée) : « LIVRAISON GRATUITE SUR LES COMMANDES DE 119$+ »
  → « LIVRAISON GRATUITE AU CANADA DÈS 98,59 $ ».
- Gabarit `page.faq`, accordéon « Tarifs de livraison » (c'est ce texte qui s'affiche sur
  `/pages/faq`, pas le corps de page : le gabarit a `show_content: false`) : « supérieur à
  100.00$ … 7.99$ » → « Livraison Xpresspost (Postes Canada) gratuite partout au Canada dès
  98,59 $ d'achat. Sous ce montant, la livraison coûte 6,99 $ (standard) ou 9,99 $
  (Xpresspost). Les articles très légers qui tiennent dans une enveloppe partent par timbre
  à 2,99 $, sans suivi. Aux États-Unis : 6,99 $ US sous 59,99 $ US d'achat, gratuite à
  partir de 59,99 $ US. » (l'anglais publié dit déjà cela).
- Même gabarit, accordéon « Où sont fabriqués vos produits? » : dit « Tout est fait au
  Québec, sauf les coquilles… », ce qui contredit la nouvelle FAQ (assemblage en Tunisie
  pour la plupart des produits). À réécrire ou à remplacer par le corps de page
  (`show_content: true` et retrait des accordéons).
- Même gabarit, « Où livrez-vous? » : « partout au Canada pour le moment » alors que la
  caisse livre aux États-Unis, en Europe, au Royaume-Uni, en Australie, en Nouvelle-Zélande
  et au Mexique.

## À faire côté français (relevé pendant la traduction, traité ci-dessus le 4 septembre)

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
