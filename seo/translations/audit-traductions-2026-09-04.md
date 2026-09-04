# Audit des traductions anglaises (Langify / traductions natives Shopify) — 4 septembre 2026

Langify v2 lit et écrit les traductions natives de Shopify (API Translations). Tout ce
qui suit vient de cette API, locale `en`, comparée au contenu français (locale
principale), avec le drapeau `outdated` que Shopify pose quand le français a changé
après la traduction. Instantané complet « avant » (FR + EN + empreintes) dans
`snapshot-2026-09-04/`, sortie brute de l'analyse dans `analyse-brute-2026-09-04.txt`.

Règle de rendu Shopify à garder en tête : une clé sans traduction anglaise s'affiche
**en français** sur `lasclay.com/en/`. « Manquant » veut donc dire « le client anglophone
lit du français ».

## Résumé chiffré

| Ressource | Volume | EN manquante | EN périmée | Autres défauts |
| --- | --- | --- | --- | --- |
| Produits (78 actifs + 35 brouillons) | 113 | 114 clés | 145 clés | 33 fiches avec HTML sale (fragments Word/ChatGPT), 9 titres EN avec dates de prévente échues, 5 méta-titres EN copiés du FR |
| Champs méta produits (dimensions, composition, caractéristiques) | 134 sur les actifs | 33 | 28 | |
| Collections | 36 | 11 sans aucune EN | 14 avec body ou méta périmés | 1 méta-description EN en français, 1 body EN avec une date de 2022 |
| Pages | 26 | 22 clés | 17 clés | Monarque corrigée aujourd'hui |
| Articles de blogue | 32 | 29 articles sans EN | 1 | seuls 3 articles ont une version EN |
| Liens de menus | 133 | 9 dans le menu actif | 3 | 1 traduction fausse (« Les Imparfaits » → « lunch »), 6 incohérences entre menus |
| Gabarits du thème (JSON) | 27 | 225 clés | 27 clés | 5 gabarits produit sans aucune EN |
| Groupes de sections du thème (en-tête, pied, popup) | 3 | tout | | contenu promo de 2023 des deux côtés |
| Politiques de la caisse | 5 | tout | | le texte « français » est déjà en anglais |
| Modes de livraison | 28 | tout | | noms mêlés FR/EN/ES visibles à la caisse |
| Courriels de notification | 56 | 0 | 1 | conformes |
| Options et valeurs de variantes (actifs) | ~90 options, ~330 valeurs | nouveaux produits non traduits | 9 valeurs avec dates échues | |
| Métaobjets (panier, Candy Rack, taxonomie) | 88 | étiquettes de taxonomie | 4 | le message FR du panier est en anglais |

## Ce qui saute aux yeux sur le site anglais aujourd'hui

1. **Les huit nouveautés de la prévente d'automne 2026 et le service de plantation sont
   en français sur `/en/`** : gants magiques, sac de couchage, deux oreillers, chandail
   polaire, deux mitaines laine/cuir, boîte d'essai, service de plantation. Titre,
   description, méta, options (« S/M (femme) », « 150 g / m2 (0 à 15°C) »,
   « Mini-jardin (25 pi2) ») et champs méta : rien n'est traduit. C'est la vitrine de la
   saison, invisible pour le lectorat américain.
2. **Quatorze titres anglais de produits actifs portent une date de prévente échue**
   (« Pre-order November 2025 », « preorder mid-January 2026 », « Pre-order Winter
   25-26 ») alors que le titre français a été nettoyé. Idem pour des valeurs de couleur
   (« Strawberry Red (Pre-order mid-August 2025) », « Green - Pre-order mid-October
   2025 », « XL - Pre-order December 2025 »).
3. **Le menu anglais mélange les langues** : « Mission », « Équipe », « Presse »,
   « Transparence », « Avis client.es », « Guides des tailles » s'affichent en français
   dans « Learn more » et « Help & Guides ». Et un lien « Les Imparfaits » est traduit
   « lunch ».
4. **Des affirmations d'origine retirées du français survivent en anglais** :
   collection Hiver « Locally made from milkweed fiber », méta-titre Mitaines « Warm and
   waterproof milkweed mittens made in Canada », page À propos « Locally-made… made
   with passion in Canada ». La passe de conformité du 18 août n'a touché que le
   français.
5. **La collection Les Imparfaits perd sa mention légale en anglais** : le français dit
   « Vente finale, aucun remboursement ni échange », l'anglais ne le dit pas.
6. **Le contenu anglais dit parfois autre chose que le français** : manteau et veste
   (FR « Prévente, livrable automne 2026 » ; EN « Pre-order Winter 25-26 », texte deux
   fois plus long), collection Vêtements (EN ajoute « Tested in the Arctic winter »,
   absent du FR), page Mission (EN « restore monarch populations to pre-industrial
   levels within 10 years », un énoncé abandonné), collection Fin de saison (EN
   « February 26th, 2022 » contre FR « 2 mars 2024 »).
7. **Le guide d'entretien anglais est aux deux tiers en français** : 47 accordéons du
   gabarit sans traduction ; seuls les onglets Manteau, Mitaines et Sacs sont traduits.
8. **Les gabarits produit cosmétiques, manchons/coussin, sac à vin et plantules n'ont
   aucune traduction** : sur ces fiches anglaises, les blocs marketing (« Un puissant
   hydratant naturel », « Élégance, personnalité et imperméabilité ») et les titres
   d'accordéons sont en français.
9. **La FAQ anglaise n'a pas la section Entretien** et les chiffres de livraison y sont
   faux dans les deux langues (voir l'audit des pages).
10. **La barre d'annonce du thème dit 119 $ en français et 50 $ en anglais** ; le
    vrai seuil est 98,59 $ CA et 29,99 $ US. Le bloc promo de l'en-tête contient encore
    « Boxing Week » (FR) et « Cyber Monday… November 2023 » (EN).
11. **Politiques de la caisse** : le texte de la locale française est déjà en anglais
    (remboursement, conditions, confidentialité). Il n'y a rien à traduire tant que le
    français n'existe pas.
12. **Noms des modes de livraison à la caisse** : « Livraison gratuite », « Free
    Shipping », « Stamp / timbre (0 tracking) », « Envío estándar » cohabitent, sans
    traduction. Le client anglophone au Québec voit « Livraison gratuite ».
13. **Blogue** : 29 articles sur 32 n'existent qu'en français, dont l'histoire de
    l'industrie de l'asclépiade vers laquelle pointe la nouvelle page Monarque anglaise.
14. **HTML sale** dans 33 descriptions anglaises (`<!--StartFragment-->`, attributs
    `data-start`/`data-end` de ChatGPT) : sans effet visible, mais signe de collages
    non relus, et ces attributs alourdissent la page.

## Ce qui est en ordre

Courriels de notification (56, tous traduits), méta du site, filtres, la plupart des
options de variantes des produits historiques, collections Jardin, Graines stratifiées,
Bombes semencières et Nouveautés (traduites le 25 et 28 août), Monarque (aujourd'hui).

## Plan d'exécution (demandé le 4 septembre)

Ordre de visibilité, par lots, chaque lot journalisé dans `journal-traductions.md` :

1. Menu actif (9 liens manquants, 1 faux, 6 incohérences).
2. Produits actifs : titres avec dates échues, 11 produits sans EN (titre, description,
   méta, options, champs méta), puis les 33 descriptions périmées et les méta.
3. Collections : 11 sans EN, mentions d'origine, Imparfaits (vente finale), périmées.
4. Pages : À propos, Équipe, Points de vente, Guides des tailles, Asclépiade,
   Plantation, Entretien (gabarit), FAQ Entretien (gabarit), Newsletter, Contact.
   Expédition et Mission attendent la décision sur le français.
5. Gabarits produit et accueil, groupes de sections.
6. Options, valeurs, modes de livraison, métaobjets de taxonomie.
7. Articles de blogue (Transparence et Journal d'abord ; les coupures de presse sont des
   citations de médias francophones et restent en français, avec un titre EN).
