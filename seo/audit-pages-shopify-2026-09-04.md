# Audit des pages Shopify de lasclay.com — 4 septembre 2026

Périmètre : les 27 pages « Pages » de l'admin Shopify (publiées ou non), leurs
versions anglaises, les 6 menus de navigation, les 5 politiques de la boutique
(pied de page de la caisse) et la page d'aide servie par une app
(`/apps/help-center`). Chaque page a été lue dans l'API (corps FR et traduction EN)
et, pour les pages dont le contenu vit dans un gabarit du thème (FAQ, entretien,
transparence, community), sur le site rendu.

Les faits « courants » contre lesquels les pages ont été comparées viennent de
sources vérifiables, pas de mémoire :

| Fait | Source | Valeur courante |
| --- | --- | --- |
| Tarifs de livraison Canada | profil de livraison Shopify | Express 9,99 $ sous 98,59 $, gratuit à partir de 98,59 $ ; timbre 2,99 $ pour les envois de 73 g et moins |
| Tarifs États-Unis | profil de livraison Shopify | 0,99 $ US sous 29,99 $ US, gratuit à partir de 29,99 $ US |
| Autres zones servies | profil de livraison Shopify | France/Belgique/Suisse, Royaume-Uni, Australie/N.-Z., Mexique |
| Transporteurs réellement utilisés | spec ShipStation, juillet 2026 | Postes Canada 90 %, Purolator 10 % |
| Adresse de l'entrepôt | emplacement Shopify « Entrepôt Lasclay » | 254 boulevard des Capucins, Québec G1J 3R4 |
| Adresse de facturation | fiche boutique Shopify | 1286 avenue de la Ronde, Québec G1J 4B7 |
| Retours | connaissance_support.md | 15 jours après réception, portail lasclay.happyreturns.com, frais 9,99 $ sauf défaut ; graines et bombes non retournables ; garantie défaut 1 an |
| Lieu de fabrication | skill lasclay-master, blogue Transparence | isolant cultivé et transformé au Québec ; assemblage textile de la majorité des produits finis chez des partenaires externes (Tunisie surtout) |
| Menu actif du thème | HTML rendu du site | « Menu 2025 » en tête, « Footer menu » et « Footer Menu1 » en pied |

## Résumé

Sur 27 pages, 9 sont à jour, 11 contiennent de l'information fausse ou périmée,
et 7 sont vides, orphelines ou à supprimer. Les versions anglaises sont en
retard sur le français pour 12 pages (Shopify les marque lui-même « outdated »).

Les trois problèmes qui coûtent le plus cher, par ordre :

1. **La FAQ et le centre d'aide affirment que la majorité des produits sont
   fabriqués au Québec.** C'est faux depuis le virage manufacturier et c'est une
   exposition légale (Bureau de la concurrence). Le 18 août, la passe SEO avait
   corrigé les fiches produits et la page À propos, mais la FAQ vit dans un gabarit
   du thème et n'a pas été touchée.
2. **Trois surfaces donnent trois tarifs de livraison différents**, aucun ne
   correspond aux tarifs réels de la caisse : page Expédition (9,50 $), FAQ
   (7,99 $, gratuit à partir de 100 $), centre d'aide (2,99 à 9,50 $, gratuit à
   partir de 119 $). Réel : 9,99 $, gratuit à partir de 98,59 $, timbre 2,99 $.
3. **La page Expédition parle encore de la grève de Postes Canada de novembre
   2024 et des Fêtes 2024**, en tête de page, et sa version anglaise est encore
   plus vieille (précommande 30 à 90 jours, exemple daté « December 2021 »).

## Tableau par page

Verdict : ✅ à jour · ⚠️ à corriger · ❌ à retirer ou remplacer.

| Page | Statut | Dernière maj FR | EN | Verdict | Problème principal |
| --- | --- | --- | --- | --- | --- |
| `/pages/expedition` | publiée, pied de page | 2026-06-23 | 2024-09, périmée | ⚠️ | grève 2024, tarif 9,50 $, retours par boîte rouge, aucun mot sur les É.-U. |
| `/pages/faq` (gabarit thème) | publiée, menu + pied | 2026-06-23 | gabarit | ⚠️ | « majorité fabriquée au Québec », tarifs faux, Canada seulement, processus de retour périmé |
| `/apps/help-center` (app) | accessible, ancien menu | ? | oui | ❌ | doublon de la FAQ avec d'autres chiffres, « tout se passe au Québec » |
| `/pages/avada-faqs` | publiée, orpheline | 2025-11-05 | non | ❌ | page vide : le script Chatty ne rend rien |
| `/pages/mission` | publiée, menu | 2026-06-27 | 2021, périmée | ⚠️ | « localement de la récolte jusqu'à la confection », hiver seulement, ordre de priorité contredit par la Tunisie |
| `/pages/a-propos` | publiée, menu + pied | 2026-08-18 | 2026-08, périmée | ⚠️ | FR corrigée le 18 août ; EN dit encore « Locally-made… made in Canada » |
| `/pages/equipe` | publiée, menu + pied | 2026-03-04 | 2026-03, périmée | ⚠️ | EN liste encore Laurence ; effectif à confirmer |
| `/pages/contact` | publiée, pied | 2020-10-16 | 2021 | ✅ | trois adresses courriel, rien d'autre ; à confirmer que operations@ est encore lue |
| `/pages/media` (Presse) | publiée, pied | 2023-09-16 | 2022, périmée | ⚠️ | s'arrête en août 2023, « 17 janvier 2013 » (2023), doublon du blogue zone-media qui va jusqu'en déc. 2025 |
| `/pages/points-de-vente` | publiée, menu | 2025-12-05 | 2025-10, périmée | ⚠️ | FR dit 254 Capucins, EN dit 298 ; listes de détaillants différentes FR/EN ; « Vancouver » pour Courtenay |
| `/pages/sizing-chart` | publiée, menu + pied | 2026-08-27 | 2026-08 | ⚠️ | phrase de prévente « nous recontacterons tous les clients… essayages » |
| `/pages/guide-des-tailles-manteaux-vestes-asclepiade` | publiée, orpheline | 2025-07-15 | 2025-07 | ⚠️ | même phrase de prévente ; doublon de la section manteaux du guide général |
| `/pages/guide-des-tailles-t-shirts-brodes` | publiée, liée du guide | 2026-08-27 | 2026-08 | ✅ | — |
| `/pages/guides-dentretien` (gabarit) | publiée, menu + pied | 2026-06-27 | 2025-09 | ✅ | mention répétée « atelier au même endroit que l'expédition », encore vraie pour l'isolant |
| `/pages/planting-guide` (gabarit + corps) | publiée, menu + pied | 2026-06-27 | 2025-07, périmée | ⚠️ | 3 coquilles, lien produit en redirection 301 |
| `/pages/milkweed-asclepiade` | publiée, menu + pied | 2026-06-27 | 2025-10, périmée | ⚠️ | ton 2020 (« repoussent complètement l'eau », « alternative miraculeuse », « révolution ») |
| `/pages/monarch-butterfly` | publiée, menu | 2026-06-28 | 2026-06, périmée | ⚠️ | FR refaite en juin, très bonne ; EN est l'ancien texte court (5 K vs 25 K) ; 3 liens produits en 301 |
| `/pages/transparence-asclepiade` (gabarit blogue) | publiée, menu | 2025-09-12 | aucune | ✅ | — |
| `/pages/transparency-transparence` | **dépubliée** | 2025-09-10 (contenu daté 2020-12-02) | « FR seulement » | ❌ | encore ciblée par deux menus inactifs (404) ; contenu 2020 précieux à archiver |
| `/pages/transparence` | dépubliée | 2025-09-10 | — | ❌ | coquille vide, gabarit Dovetale |
| `/pages/ambassadors` (Community) | **publiée**, orpheline | 2026-06-23 | — | ❌ | page rendue vide (Dovetale n'existe plus) |
| `/pages/avis-des-clients` | publiée, menu | 2026-06-23 | 2021 | ⚠️ | captures d'écran Facebook de 2021, « entreprise toute jeune » |
| `/pages/newsletter` | publiée, liée des promos | 2026-06-27 | 2021 | ✅ | — |
| `/pages/offre-novembre-2025-lasclay` | publiée, orpheline | 2026-06-27 | 2025-11 | ❌ | concours terminé le 15 décembre 2025 |
| `/pages/copy-of-concours-automnal-2025-et-offres-hebdomadaires` | publiée, orpheline | 2026-06-27 | non | ❌ | « Vente de fin de saison 2026 », ligne de prix cassée « Prix promo : 299,99 $) » |
| `/pages/milkweed-coolers` | dépubliée | 2023-05-27 | 2023 | ✅ | avant-première 2023, sans effet tant que dépubliée |
| `/pages/privacy-policy` | publiée, orpheline | 2026-06-27 | aucune | ⚠️ | nomme seulement Shopify et Google Analytics ; rien sur Klaviyo, Meta, Judge.me, ni sur la Loi 25 |

## Détail des corrections

### 1. Expédition (`/pages/expedition`)

Ce que la page dit, et ce qui est vrai aujourd'hui :

| Sur la page | Réalité |
| --- | --- |
| Bandeau « GRÈVE POSTES CANADA », grève du 15 novembre 2024, transporteurs temporaires GLS, UPS, ICS, Canpar, Purolator | grève terminée depuis longtemps ; en juillet 2026, 90 % des envois partent par Postes Canada |
| « Vous pouvez commander sans crainte pour le temps des Fêtes 2024 » | nous sommes en septembre 2026 |
| « Standard offert au taux avantageux de 9,50 $ » | Express 9,99 $ sous 98,59 $, gratuit au-dessus ; timbre 2,99 $ pour les petits envois (graines, bombes) |
| « nous expédions normalement uniquement avec [Postes Canada] » puis « nous utilisons, de la grève de Postes Canada, d'autres compagnies » | phrase cassée, et les deux affirmations se contredisent |
| « Étant donné les délais liés à notre modèle de précommande » | le modèle courant est la vente de produits déjà fabriqués, la prévente est ponctuelle |
| Retour : « étiquette numérique… boîte aux lettres rouge » | portail lasclay.happyreturns.com, frais de 9,99 $ sauf défaut ; ça mérite un lien vers la section Retours de la FAQ |
| Rien sur les États-Unis ni l'international | la caisse sert les É.-U. (gratuit dès 29,99 $ US), l'Europe francophone, le R.-U., l'Australie, le Mexique |

Les délais par province (QC 2 à 5 jours ouvrables, BC/AB/SK 7 à 10) sont
plausibles pour Postes Canada Expedited, à garder si l'équipe les confirme.

Version anglaise : texte différent et plus vieux encore. Il ouvre sur « we operate
on a pre-order basis, with items being produced within 30-90 days » et cite
« December 2021 » en exemple. À réécrire à partir de la nouvelle version française.

### 2. FAQ (`/pages/faq`, gabarit `page.faq` du thème)

Le corps de la page est vide dans l'admin : tout le texte vit dans les réglages
du gabarit. Les corrections passent donc par l'éditeur de thème, pas par l'API
des pages.

- **Où sont fabriqués vos produits ?** « La culture de l'asclépiade, la
  conception, la fabrication de la majorité de nos produits et leur distribution
  se font entièrement au Québec. Exception : les manteaux et vestes. » Depuis le
  virage, c'est l'inverse : l'assemblage textile de la majorité des produits
  finis est confié à des partenaires externes. Le paragraphe sur la Tunisie est
  bon et peut servir de base, en élargissant l'exception à la gamme. Formulation
  conforme au garde-fou : l'isolant est cultivé, conçu et transformé au Québec ;
  les produits sont conçus ici et assemblés chez des partenaires.
- **Tarifs de livraison** : « gratuite au-dessus de 100 $… 7,99 $ sous 100 $ »
  → 9,99 $ sous 98,59 $, gratuit à partir de 98,59 $, 2,99 $ par timbre pour
  les petits envois. Le seuil réel à 98,59 $ est bizarre à afficher : soit on
  écrit « à partir de 99 $ » soit on remonte le seuil de la caisse à 99 $ ou 100 $.
- **Où livrez-vous ?** « partout au Canada pour le moment » → Canada, États-Unis
  et plusieurs pays d'Europe et d'Océanie (liste de la caisse).
- **Délais et suivis** : « les commandes dont la livraison choisie est par
  timbre n'aura pas de numéro de suivi », correct ; ajouter le délai timbre
  attesté par le support (5 à 12 jours ouvrables).
- **Politique de retours** : cohérente avec la connaissance support sur les
  15 jours et les 9,99 $. Il manque « graines et bombes semencières non
  retournables » (présent dans la réponse type du support) et la garantie de
  1 an contre les défauts (présente dans la politique Shopify).
- **Processus de retour** : « nous envoyons un bordereau prépayé dans un délai
  de 1-2 jours ouvrables » → le portail Happy Returns génère l'étiquette ; à
  décrire tel quel. Le lien « Messenger » est un canal qu'on ne peut plus servir
  par l'API passé 7 jours ; laisser seulement le courriel.
- **FAQ anglaise** (même gabarit, autre locale) : « free shipping in the
  continental USA for orders over $99US », « anywhere in Canada for orders over
  $119CAD », « continental US and Canada at the moment » : trois chiffres faux,
  seuil É.-U. réel 29,99 $ US.

### 3. Centre d'aide servi par une app (`/apps/help-center`)

Cette page est encore en ligne et indexable, liée depuis l'ancien « Main menu »
(inactif). Elle répète la FAQ avec d'autres valeurs : gratuit dès 119 $, frais
« de 2,99 $ à 9,50 $ », et surtout « Tout se passe au Québec, qu'il s'agisse de la
culture, de la conception, de la fabrication et de la distribution ». Elle
contient une question utile qui manque à la FAQ (« Puis-je obtenir une facture
complète ? »). Recommandation : récupérer cette question dans la FAQ, puis
désinstaller l'app ou rediriger `/apps/help-center` vers `/pages/faq`.

`/pages/avada-faqs` est une troisième tentative de FAQ (app Chatty) : le script ne
charge rien, la page rendue ne contient que son titre. À supprimer.

### 4. Mission (`/pages/mission`)

Déjà signalée le 18 août sans correction, parce que c'est un énoncé de mission.
Trois passages ne tiennent plus :

- « démocratiser la place de l'asclépiade dans les vêtements hivernaux » : la
  gamme est aussi été, jardin, maison, cosmétiques.
- « faire des produits localement de la récolte jusqu'à la confection » : se lit
  comme une affirmation de fabrication locale du produit fini.
- L'ordre de priorité des fournisseurs (Québec, Canada, É.-U./Mexique, global en
  dernier recours) contredit le choix de la Tunisie, sans l'expliquer.

Le skill lasclay-master contient la formulation mûre (« Ce qui change, c'est la
manière de produire. Ce qui ne change pas, c'est pourquoi on existe. »). Je peux
proposer un texte, mais la publication revient à Gabriel. La version anglaise
date de 2021 et suivra.

### 5. À propos et Équipe (versions anglaises)

- `/pages/a-propos` EN : « Locally-made, eco-friendly & ethical product.
  Harvested, designed and made with passion in Canada. » C'est exactement la
  formulation retirée du français le 18 août. À aligner : « Our milkweed
  insulation: vegan, responsible and local. Harvested, designed and made in
  Québec, Canada. »
- `/pages/equipe` : le FR (mars 2026) montre Gabriel et Catherine ; l'EN montre
  encore Laurence. À confirmer qui est dans l'équipe aujourd'hui, puis aligner
  l'EN.

### 6. Presse (`/pages/media`) et blogue `zone-media`

Deux surfaces : la page (liée du pied de page « Footer menu ») s'arrête au
10 août 2023 ; le blogue (lié du menu 2025) va jusqu'au 1er décembre 2025 (Le
Soleil, dilemme de fabriquer au Québec) et inclut Le Devoir déc. 2023, Châtelaine
nov. 2023, Le Soleil Affaires avril 2024. Coquille sur la page : « 17 janvier
2013 » pour l'article du Soleil de 2023. L'EN de la page s'arrête à décembre 2021.

Recommandation : garder une seule surface. Le blogue est celle qui est
entretenue ; rediriger `/pages/media` vers `/blogs/zone-media` et changer le lien
du pied de page. Sinon, compléter la page avec les six parutions manquantes.

### 7. Points de vente (`/pages/points-de-vente`)

- Adresse de l'atelier : FR « 254 Bd des Capucins, 2e étage (porte du
  stationnement) », EN « 298 Des Capucins Boulevard ». Le support interne parle
  aussi de « 298, 2e étage, entrée par la porte 260 ». L'emplacement Shopify dit
  254. Une seule adresse vraie, à confirmer.
- Heures « lundi au vendredi, 9 h à 16 h » : à confirmer avec l'effectif réduit.
- Listes différentes : l'EN a Les Mauvaises Herbes (Montréal) et le parc
  national du Mont-Saint-Bruno, absents du FR ; le FR a Vert métal, absent de
  l'EN. « Vancouver » comme titre pour Local Refillery, qui est à Courtenay sur
  l'île de Vancouver.
- La liste date de décembre 2025 : une relance des dix détaillants avant l'hiver
  éviterait d'envoyer des clients dans une boutique qui n'a plus de stock.

### 8. Guides des tailles

`/pages/sizing-chart` et `/pages/guide-des-tailles-manteaux-vestes-asclepiade`
portent tous deux : « Nous recontacterons tous les clients individuellement pour
valider les grandeurs et des essayages pourront même être organisés au besoin. »
C'est une promesse de la prévente de manteaux de mai 2025 ; elle n'est plus tenue
pour une commande courante et le support la paie. À retirer des deux pages, FR et
EN. La page manteaux est orpheline (aucun menu) et duplique la section du guide
général ; la garder seulement si les fiches produits y pointent.

### 9. Monarque, asclépiade, guide de plantation

- `/pages/monarch-butterfly` : le FR refait en juin 2026 est la meilleure page
  du site, sourcée et dans la voix mûre de la marque. L'EN est l'ancien texte
  (cinq fois plus court) : à traduire. Trois liens pointent vers des poignées en
  redirection 301 (`graines-semences-asclepiade-stratifiees-froid`,
  `plant-asclepiade`, `milkweed-seeds-semences-asclepiade`), toutes vers
  `/products/milkweed-seeds` : à remplacer par la cible finale.
- `/pages/milkweed-asclepiade` : contenu botanique solide, mais le ton est celui
  de 2020 : « repoussent complètement l'eau », « alternative miraculeuse », « La
  révolution de l'asclépiade est là ». Le discours actuel explique le mécanisme
  sans absolus. Une passe de ton, sans refonte.
- `/pages/planting-guide` : coquilles « asclépaide », « oùl'ensoleillement »,
  « rongueurs » ; lien graines en 301. Contenu à jour.

### 10. Pages à dépublier ou supprimer

| Page | Action | Pourquoi |
| --- | --- | --- |
| `/pages/offre-novembre-2025-lasclay` | dépublier, redirection 301 vers `/collections/produits-products` | concours terminé le 15 décembre 2025 ; encore indexable, avec sa version EN |
| `/pages/copy-of-concours-automnal-2025-et-offres-hebdomadaires` | dépublier après la vente, corriger la ligne de prix d'ici là | « Prix promo : 299,99 $) » sans prix régulier ; poignée « copy-of » |
| `/pages/ambassadors` | dépublier ou supprimer | page publiée mais rendue vide ; gabarit Dovetale, service fermé |
| `/pages/avada-faqs` | supprimer | vide, doublon de FAQ |
| `/pages/transparence` (126119215323) | supprimer | coquille dépubliée, gabarit Dovetale |
| `/pages/transparency-transparence` | rediriger vers `/pages/transparence-asclepiade`, archiver le contenu | 37 000 caractères de 2020 (politique fournisseurs, matières, conditions de travail) : à ne pas perdre, mais périmé sur la fabrication |
| `/pages/avis-des-clients` | remplacer par le widget d'avis, ou retirer du menu | 31 captures d'écran Facebook de 2021, « entreprise toute jeune » |

### 11. Politiques Shopify (pied de page de la caisse)

Elles s'affichent à la caisse et dans le pied de page de chaque courriel de
commande, dans les deux langues.

| Politique | État | À faire |
| --- | --- | --- |
| Remboursement | deux lignes en anglais : « 15 days after reception for refunds / 1 year defect warranty for exchanges » | rédiger la politique complète FR et EN à partir de la section Retours de la FAQ |
| Expédition | **vide** | reprendre le texte de la nouvelle page Expédition |
| Conditions d'utilisation | modèle Shopify en anglais ; « governed by the laws of 95 104e rue, Québec, QC, G1C 2Z5 » | adresse d'un autre âge ; traduire, mettre l'adresse courante |
| Confidentialité | modèle 2020 en anglais, Google Analytics seulement | même chose que la page FR : ajouter Klaviyo, Meta, Judge.me, le responsable de la protection des renseignements personnels (Loi 25) |
| Contact | admin@lasclay.com | la page Contact dit hey@ ; choisir |

### 12. Menus

Le thème actif utilise « Menu 2025 », « Footer menu » et « Footer Menu1 ». Trois
menus dorment dans l'admin et sont des pièges si quelqu'un les réactive :

- « Main menu » : Transparence → page dépubliée (404) ; Aide → `/apps/help-center`.
- « Megamenu2023 » : Transparence → 404 ; « Aide & Guides » → `https://google.com`
  (lien bouche-trou jamais remplacé).
- Dans « Menu 2025 » lui-même, tout répond 200. Une seule incohérence : « Presse »
  y pointe vers le blogue, alors que le pied de page pointe vers la page.

Supprimer « Main menu » et « Megamenu2023 » une fois vérifié qu'aucune section du
thème ne les référence.

### 13. Liens internes en redirection

Ces liens fonctionnent mais passent par un 301 ; à remplacer par la cible :

| Dans | Lien | Cible |
| --- | --- | --- |
| monarch-butterfly | `/products/graines-semences-asclepiade-stratifiees-froid` | `/products/milkweed-seeds` |
| monarch-butterfly | `/products/plant-asclepiade` | `/products/milkweed-seeds` (vérifier : les plantules ont-elles encore une fiche ?) |
| planting-guide | `/products/milkweed-seeds-semences-asclepiade` | `/products/milkweed-seeds` |
| Megamenu2023 | `/products/etui-appareils-electroniques-asclepiade-2` | `/products/etui-telephone-asclepiade` |

## Plan proposé

Ce que je peux faire seul par l'API des pages, avec journal avant/après comme le
18 août :

1. Réécrire `/pages/expedition` FR et EN (tarifs réels, sans grève, avec
   États-Unis et international, retours vers Happy Returns).
2. Aligner les EN de `a-propos`, `equipe`, `sizing-chart`, `points-de-vente`.
3. Retirer la phrase de prévente des deux guides des tailles.
4. Corriger les coquilles et les liens en 301 (planting-guide, monarch-butterfly).
5. Dépublier les deux pages de promotion et la page Community ; supprimer les
   deux coquilles vides.
6. Passe de ton sur `milkweed-asclepiade`.

Ce qui demande l'éditeur de thème (gabarit) ou une décision humaine :

- FAQ FR et EN : les six réponses ci-dessus (gabarit `page.faq`).
- Mission : nouveau texte à valider par Gabriel.
- Équipe et points de vente : confirmer l'effectif, l'adresse (254 ou 298) et
  les heures.
- Politiques de la caisse : rédaction FR/EN, choix de l'adresse courriel.
- Presse : page ou blogue, pas les deux.
- Traduction anglaise de la page Monarque (25 000 caractères).
- Avis clients : remplacer les captures 2021 par le widget d'avis.
