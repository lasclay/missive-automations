# Rapport exhaustif — 6 vidéos sur l'optimisation de conversion et de checkout e-commerce

**Date du relevé** : 8 septembre 2026
**Corpus** : 6 vidéos YouTube, ≈ 1 h 36 min de contenu
**Livrable** : transcriptions intégrales horodatées + analyse catégorisée
**Contexte** : veille CRO / checkout pour lasclay.com

---

## Avertissement de méthode — lire avant tout le reste

**Ces vidéos ont été LUES, pas VUES.** La session tourne sur une adresse IP de centre de données. Dans cette configuration :

- YouTube a livré les **métadonnées** et les **sous-titres complets** des six vidéos (grâce au jeton PO `bgutil` installé pour l'occasion — il a fallu corriger un désaccord de versions entre le greffon Python `bgutil-ytdlp-pot-provider` 2.0.0 et le générateur Node compilé, resté au tag 1.3.2) ;
- YouTube a **refusé le flux vidéo lui-même** (403 des serveurs de diffusion), et le relais tiers public de secours (instance cobalt) était hors service au moment du relevé.

**Conséquence directe : aucune trame d'image n'a été extraite.** Rien dans ce rapport ne décrit ce qui est montré à l'écran autrement que par ce que la personne en dit à voix haute. Quand une vidéo montre une capture d'écran sans la commenter, cette information est perdue et n'a pas été inventée. Les vidéos les plus affectées par cette limite sont, dans l'ordre :

1. **Vidéo 5 (Louis ST)** — démonstration écran de l'admin Shopify ; les chemins de clics sont verbalisés, donc l'essentiel passe, mais les valeurs de couleurs et l'aspect final ne sont pas vérifiables ;
2. **Vidéo 6 (Chase Chappell)** — décorticage visuel de sites (Graza, Everyday Dose, Carpe) ; il commente abondamment, mais les captures elles-mêmes manquent ;
3. **Vidéo 3 (Convertica)** — même situation sur Amazon, Apple et Zendesk.

**Qualité des transcriptions** : ce sont les sous-titres automatiques de YouTube dans la langue originale (`en-orig` pour cinq vidéos, `fr-orig` pour la vidéo 5). Ils comportent des erreurs de reconnaissance vocale, laissées **telles quelles** dans la partie « transcriptions intégrales » pour ne rien altérer. La vidéo 4 (Samuel Larsen) est de loin la plus abîmée : « thrust » pour *trust*, « at » pour *add*, « varants » pour *variants*, « Cler » pour *Klarna*, « salsa » pour *upsell*, « pills » pour *fields*, « harmone » pour *hmm*, « secular » pour *secure*, « feeling » pour *filling*. Les corrections de lecture sont faites dans l'analyse, pas dans la transcription.

---

## Table des matières

1. [Corpus](#1-corpus)
2. [Résumé catégorisé](#2-résumé-catégorisé) — la synthèse transversale par thème
   - 2.1 [Cadre économique et métriques](#21-cadre-économique-et-métriques)
   - 2.2 [L'offre et la structure de prix](#22-loffre-et-la-structure-de-prix)
   - 2.3 [Confiance, preuve sociale et objections](#23-confiance-preuve-sociale-et-objections)
   - 2.4 [Page d'accueil, fiche produit, expérience](#24-page-daccueil-fiche-produit-expérience)
   - 2.5 [Panier et checkout](#25-panier-et-checkout)
   - 2.6 [Vitesse et technique](#26-vitesse-et-technique)
   - 2.7 [Données, diagnostic et expérimentation](#27-données-diagnostic-et-expérimentation)
   - 2.8 [Récupération, après-achat et valeur à vie](#28-récupération-après-achat-et-valeur-à-vie)
   - 2.9 [Continuité publicité → page](#29-continuité-publicité--page)
3. [Tableau de convergence et de désaccord](#3-tableau-de-convergence-et-de-désaccord)
4. [Inventaire des outils cités](#4-inventaire-des-outils-cités)
5. [Inventaire des marques données en exemple](#5-inventaire-des-marques-données-en-exemple)
6. [Chiffres avancés et niveau de fiabilité](#6-chiffres-avancés-et-niveau-de-fiabilité)
7. [Réserves légales pour le Québec et le Canada](#7-réserves-légales-pour-le-québec-et-le-canada)
8. [Application à Lasclay](#8-application-à-lasclay)
9. [Fiches détaillées par vidéo](#9-fiches-détaillées-par-vidéo)
10. [Transcriptions intégrales](#10-transcriptions-intégrales)

---

## 1. Corpus

| # | Chaîne | Titre | Durée | Langue | ID YouTube |
|---|---|---|---|---|---|
| 1 | Davie Fogarty Mentors | How To 4X Your Shopify Conversion Rate (Complete CRO Guide) | 16 min 56 s | EN | `A-7pTamjBIw` |
| 2 | Michael Bernstein | How To Increase Conversion Rate On Shopify (2025 CRO Guide) | 10 min 33 s | EN | `kLneJKAqRtk` |
| 3 | Convertica | 7 eCommerce Conversion Rate Optimization Fundamentals | 10 min 46 s | EN | `hb-qAAfCSPc` |
| 4 | Samuel Larsen — eCommerce Optimization | The Ultimate Guide to Shopify Checkout Optimization (100% Free Methods) | 14 min 57 s | EN | `aeUJw_ectUQ` |
| 5 | Shopify OS — Louis ST | Comment Optimiser sa Page Checkout Shopify ? (pour la conversion) | 10 min 28 s | FR | `6n98r3YiBOc` |
| 6 | Chase Chappell | How To Increase Conversion Rates on Shopify (2026 Guide) | 32 min 56 s | EN | `daDsoHXE52A` |

**Total : 1 h 36 min 36 s.**

**Répartition par angle** :

- **CRO généraliste** (tout l'entonnoir) : vidéos 1, 2, 6
- **Crédibilité et confiance** (angle unique) : vidéo 3
- **Checkout Shopify spécifiquement** : vidéos 4 et 5
- **Actualité** : la vidéo 5 est la seule à couvrir le Checkout Extensibility actuel ; la vidéo 4 décrit l'ancien checkout personnalisable par `checkout.liquid` et est **partiellement périmée** ; la vidéo 3 est la plus ancienne du corpus.
- **Intérêt commercial du présentateur** : les vidéos 2 et 6 se terminent par un argumentaire de vente (mentorat, applications affiliées) ; la vidéo 3 est un appel à un audit gratuit ; les vidéos 1, 4 et 5 sont les moins intéressées, la 5 ne vendant qu'un abonnement à la chaîne.

---

## 2. Résumé catégorisé

### 2.1 Cadre économique et métriques

**Le raisonnement de base, partagé par les six** : le trafic coûte cher, la conversion est gratuite. Fogarty : « tout ce que vous faites, c'est verser plus d'eau dans un seau percé ». Chappell : « peu importe combien vous dépensez, vous convertissez déjà à peine ce trafic ».

**Repères de taux de conversion cités** :

| Source | Moyenne annoncée | Haut du marché |
|---|---|---|
| Fogarty (vid. 1) | 1 à 3 % sur Shopify | 6 à 8 % pour le top 1 % |
| Chappell (vid. 6) | 1,4 % | 3, 5, 8, voire 10 % |
| Bernstein (vid. 2) | « moyenne de l'industrie » ≈ 2,5 % | son propre chiffre : 7,4 % |

Tous notent que le chiffre dépend de la niche et du panier moyen.

**La chaîne de métriques de Fogarty (1:32–2:41)** — le contenu le plus rigoureux du corpus, et le seul cadre analytique complet :

```
CR    = combien de visiteurs achètent
AOV   = combien ils dépensent quand ils achètent
RPV   = CR × AOV               (revenu par visiteur)
PPV   = RPV − tous les coûts   (profit par visiteur)
```

> « Si une optimisation n'augmente pas le RPV ou le PPV, c'est du bruit. Un taux de 5 % peut sembler impressionnant sur papier, mais s'il fait chuter votre panier moyen et monter vos coûts, vous êtes perdant. »

Il ajoute une quatrième dimension : ne pas juger au mois, mais **en valeur à vie du client**.

**L'illustration arithmétique de l'arbitrage prix (5:43–6:51)** :

| Scénario | Visiteurs | CR | Panier | Revenu |
|---|---|---|---|---|
| Départ | 5 000 | 2,0 % | 50 $ | 5 000 $ |
| Prix +10 % | 5 000 | 1,8 % | 55 $ | 4 950 $ |

Revenu quasi identique, **mais profit supérieur** : moins de commandes à traiter, moins de service client, moins d'opérations, meilleur ratio coût produit / revenu. Fogarty affirme même avoir vu des hausses de prix faire *monter* le taux de conversion.

**Le contre-exemple de Bernstein (6:54–7:40)** — même logique par la preuve inverse : un portefeuille passé de ~20 000 $/mois (janvier 2023) à 225 000 $/mois un an plus tard, avec un panier moyen supérieur de seulement 4 $. Le taux de conversion a **baissé** à l'échelle, mais le profit a explosé, les upsells n'ayant pas de coût produit additionnel.

**L'effet composé (Fogarty, 9:07–9:56)** — concept qu'il dit lui avoir « retourné le cerveau » : trois tests à +10 %, +15 % et +20 % ne donnent pas +45 % mais se **multiplient**, soit 2 à 3× au total. D'où le « volant d'inertie du CRO » : chaque gain finance des publicités plus efficaces, qui libèrent du budget, qui finance plus de tests, qui produisent plus de gains.

**Le lien avec le ROAS (Chappell, 1:12–1:36)** : 10 000 $ de pub qui rapportent 30 000 $ à 1 % de conversion en rapportent 60 000 à 90 000 $ à 2 ou 3 %, sans un dollar de plus. C'est pourquoi, dit-il, Skims, AG1, Nike et Apple dépensent des millions par an en CRO.

---

### 2.2 L'offre et la structure de prix

**La thèse dominante du corpus : l'offre écrase le design.**

- Fogarty (4:55) : « Le plus gros point de levier du CRO, c'est votre offre. C'est ce qui fait passer une marque de 500 k$ à 2 M$. » Et par « offre » il n'entend pas le produit, mais **le paquet complet** : prix, lots, ventes incitatives, garantie, formulation de la valeur.
- Bernstein (0:22–1:09) : « Le design de votre boutique n'a pas vraiment d'importance. On a testé un bon logo contre un mauvais logo, ça ne change rien. » Le design commence à compter **après 100 k$/mois**.

**Le plancher de crédibilité (Bernstein, 6:30)** — la nuance qui sauve la thèse : « votre site ne peut pas avoir l'air d'une merde. S'il est absolument horrible, ça peut faire tomber la conversion à zéro parce que les gens vont penser que c'est une arnaque. Assurez-vous que c'est au moins 5 sur 10. Tout ce qui est au-dessus ne change pas grand-chose, tout ce qui est en dessous, énormément. »

**Le fractionnement du prix le long de l'entonnoir (Bernstein, 2:16–4:12)** — l'idée la plus originale du corpus, expliquée nulle part ailleurs :

| Structure classique | Structure fractionnée |
|---|---|
| Produit 49,99 $ | Produit **19,99 $** |
| Livraison gratuite | + case à cocher **pré-cochée** 4,99 $ (≈ 70 % de prise) |
| Éventuel upsell post-achat | + pop-up pré-achat 9,99 $ (jusqu'à 50 % de prise) |
| | + livraison 4,99–9,99 $ |
| | + upsell post-achat 20 $ |
| | + downsells |

Panier moyen équivalent, **mais nettement plus de ventes** — le prix d'entrée bas multiplie les ajouts au panier, et le client entre dans une « boucle de oui » : il a déjà accepté le produit, autant accepter le complément. Bernstein insiste sur le fait que ce n'est pas universellement supérieur : « dans de rares cas c'est le contraire — mais vous ne le savez pas, parce que vous n'avez pas testé les deux ».

**Le test de prix systématique (Bernstein, 1:09–1:54)** : personne ne sait si 29 $ est le bon prix. Méthode : ± 5 $. Un produit à 29,99 $ se teste contre 24,99 $ et 34,99 $. « Des différences de 1 $ comptent énormément. »

**Les mécaniques de panier moyen relevées dans le corpus** :

| Mécanique | Cité par | Détail |
|---|---|---|
| Multipacks à rabais dégressif | Fogarty, Chappell (Carpe) | « chaque bâton ajouté donne un rabais majeur », ce qui entraîne le client à cliquer encore |
| Version premium / deluxe | Fogarty, Bernstein | même produit, une caractéristique en plus, 10–20 $ de majoration ; Fogarty cite des diffuseurs (parfum seul vs parfum + son) |
| Case à cocher pré-cochée | Bernstein | ≈ 70 % de prise, « le chemin de moindre résistance : ils n'ont rien à cliquer » |
| Pop-up pré-achat | Fogarty, Bernstein | jusqu'à 50 % de prise selon Bernstein |
| Upsell post-achat | Fogarty, Bernstein, Chappell | sur la page de remerciement ; le coût d'acquisition est déjà payé, la confiance vient d'être établie |
| Downsell | Bernstein | après refus de l'upsell |
| Abonnement (subscribe & save) | Chappell | Graza : 10 $ d'acquisition, 81 $ d'abonnement, renouvelé mensuellement |
| Paliers de quantité (order bumps) | Chappell | Graza, dans la même vue |
| Prix leurre / ancrage | Fogarty (réservé), Bernstein (favorable) | voir désaccords |

**L'ancrage par les variantes (Bernstein, 8:25–8:49)** — sa version de l'ancrage, qu'il juge supérieure au rabais affiché :

> « Personne ne fait plus confiance aux rabais. Si vous mettez −50 %, personne n'y croit. Mais s'il y a cinq versions sur la page produit, quatre à 100 $ et une à 50 $, ça les gens y croient, et ils se sentent intelligents d'avoir eu la bonne affaire. Alors qu'en réalité, c'est vous qui êtes intelligent : vous avez fait en sorte que ça ressemble à une bonne affaire. »

**L'offre héros (Chappell, 12:12–12:59, exemple Everyday Dose)** — tout l'argumentaire condensé dans le premier écran : 86 % de rabais, 30 portions, crème offerte, une semaine de café offerte, cadeaux bonus, recharge à 36 $, annulable à tout moment, livraison gratuite en 3 jours. « Ça rend l'offre presque irrésistible. »

**La mise en garde de Fogarty (5:19–5:43)** : la plupart des marques ne réfléchissent pas leur offre — elles copient-collent celle du concurrent. « C'est la pire chose à faire. Vous avez besoin d'une offre unique. »

---

### 2.3 Confiance, preuve sociale et objections

**Le cadre « Au début je pensais X, mais en fait Y »** — apparaît **mot pour mot chez Fogarty (10:19–10:41) et Bernstein (4:34–4:57)**, ce qui en fait le point de convergence le plus frappant du corpus.

L'avis utile n'est pas « super produit ». C'est celui qui nomme l'objection que le prospect a précisément en tête, puis la démonte :

- « Au début je pensais que les bandes de résistance allaient déchirer, mais elles tiennent après des mois d'usage quotidien. »
- « Je pensais que la couverture serait trop chaude, mais elle est parfaite en toutes saisons. »
- « Je pensais qu'elles laisseraient des taches bleues sur mon chandail, mais jamais. »

Fogarty : « écrits comme ça, les avis fonctionnent comme une FAQ pré-achat écrite par de vraies personnes. Le nouveau client voit que d'autres ont eu la même peur, et que cette peur était infondée. »

**Le minage d'objections** — même méthode chez les deux, et étendue par Chappell :

| Source d'objections | Cité par |
|---|---|
| Avis 1 étoile des produits **concurrents** sur Amazon | Fogarty, Bernstein |
| Sections de commentaires TikTok | Fogarty |
| Fils Reddit | Fogarty |
| Demander à des gens de la niche pourquoi ils n'achèteraient pas | Bernstein |

Le raisonnement de Bernstein (5:20–5:42) : « les gens ne sont généralement pas des primo-acheteurs dans votre niche. Ils ont déjà essayé un tas de choses pour résoudre le problème que vous résolvez. Ils se sont fait avoir par d'autres produits. »

**Où placer le traitement d'objection — la hiérarchie de crédibilité de Bernstein (5:42–6:30)**, du plus au moins crédible :

1. **Section commentaires** (sous une vidéo organique, top commentaires sous une publicité Facebook, stories à la une Instagram) — « une couche au-dessus »
2. **Avis sur la fiche produit** — « ils paraissent plus honnêtes que la page produit, mais tout le monde sait qu'on peut les truquer »
3. **Texte de la fiche produit** — le moins crédible

**Les indicateurs de crédibilité (Convertica, toute la vidéo)** — angle unique du corpus :

- **Étoiles d'avis directement sous le titre du produit** : « chaque client à qui on ajoute ça voit ses conversions augmenter ». 50 ou 60 avis valent déjà infiniment mieux que zéro ; la plupart des gens ne cliquent même pas, ils voient juste le 4,3 sur 5.
- **Questions-réponses de clients** (modèle Amazon) : une FAQ écrite par les acheteurs, qui évite les contacts au service à la clientèle. « Si vous pouvez répondre à toutes les questions sur la page, ça fera beaucoup pour la conversion. »
- **Badges de tiers** : « Amazon's Choice » cité comme exemple.
- **Réducteurs d'anxiété (Apple)** : « livraison rapide, gratuite, sans contact », « retours gratuits et faciles ». Subtils, mais fort impact : ils répondent à « et si je n'en veux pas ? et si la personne à qui je l'offre n'en veut pas ? ».
- **Clavardage en direct** : « des questions sur l'achat d'un iPhone ? parlez à un spécialiste ». Faisable sans équipe interne via des services de permanence 24/7.
- **Page « À propos » comme actif de conversion** (modèle Zendesk) : équipe réelle et diverse en photo, engagements affichés, et surtout des **métriques empilées** — 160 000 comptes clients payants, 4 000 employés, 160 pays, 38 000 heures de bénévolat. « De la crédibilité, encore et encore, avec de vraies photos de haute qualité, pas des photos de banque d'images. » Une fois que le visiteur a adhéré à la vision et à l'éthique, il achète beaucoup plus facilement.
- Pour une jeune marque sans photos : « vous devrez peut-être utiliser des illustrations ou des photos de banque — mais pour bien convertir, vous devez raconter votre histoire ».

**La preuve sociale en cascade (Chappell, 12:59–15:19, exemple Everyday Dose)** — la démonstration la plus complète du corpus :

1. **Autorité empruntée** : citations de médias connus (Tasting Table, Who What Wear) — « parfois les gens ne veulent pas l'entendre de vous, ils veulent l'entendre de quelqu'un d'autre ».
2. **Autorité scientifique** : « plus de 10 000 publications de recherche appuient les ingrédients ».
3. **Preuve de masse** : « plus de 6 millions de commandes livrées — pourquoi n'achèteriez-vous pas si 6 millions d'autres l'ont fait ? »
4. **Statistiques de satisfaction** : 93,6 % aiment le goût, 88 % ressentent un effet positif. « Les humains, au bout du compte, sont comme des moutons : ils suivent le troupeau et font confiance à l'opinion des autres. »
5. **Traitement d'objection produit par produit** : quel goût ? quel effet ? est-ce que je vais être énervé ? est-ce trop de caféine ? est-ce buvable ?
6. **Visages de clients** : « on ne montre pas juste un avis, on montre le visage de gens qui sourient en utilisant le produit — on construit l'émotion ».
7. **Comparaison frontale** : « vous buvez du café ordinaire — vous n'avez pas de collagène pour la peau, pas de soutien intestinal et cérébral, pas 100 % de vrais champignons ».
8. **UGC vidéo** : histoires réelles, démonstrations, coulisses.

**Le contenu généré par les utilisateurs (Fogarty, 11:51–12:12)** : « l'UGC peut à lui seul faire monter la conversion jusqu'à 30 %. Pourquoi ? Parce que les gens achètent à des gens. » Photos non retouchées, réactions TikTok, vidéos client brutes — sur la fiche produit, sous le bouton d'ajout au panier ou en section dédiée. Elles répondent à la question « est-ce que de vraies personnes utilisent ce produit ? ».

**Les politiques comme signal de confiance (Fogarty, 11:26–11:51)** :

> « Une des façons les plus rapides de détruire la confiance, c'est de cacher vos retours, remboursements ou détails de livraison. Si les gens ne les voient pas, ils supposent le pire. Ne les enterrez pas dans le pied de page. Mettez-les directement sur la fiche produit, sous le bouton d'ajout au panier. »

Formulations données : « retours gratuits sous 30 jours », « expédié en 3 à 5 jours ouvrables ». Larsen (4:21) place les mêmes politiques **en fenêtres modales dans le checkout**, pour qu'on puisse les lire sans quitter le tunnel. Louis (9:06) explique la mécanique exacte pour les faire apparaître sous le checkout Shopify.

**La confiance se joue avant la fiche produit (Fogarty, 12:12–12:58)** :

> « Le parcours client ne commence pas à votre page produit. Il commence à la seconde où ils voient votre créa sur Facebook. En moins d'un clignement d'œil, environ 0,05 seconde, ils décident s'ils peuvent vous faire confiance. »

D'où la cohérence exigée jusqu'aux **stories à la une Instagram** : « les gens vont creuser en profondeur pour trouver une raison de ne pas vous faire confiance ».

**La règle du contre-effet (Larsen, 9:55–10:44)** — la plus contre-intuitive du corpus :

> « Parfois on suggère de mettre toutes sortes de signaux de confiance sur le site. Mais si vous insistez trop sur la confiance, les gens deviennent trop conscients de la sécurité. Et une fois trop conscients de la sécurité, ils sont aussi préoccupés par le risque. Alors que si vous pouvez suggérer subtilement que c'est sécuritaire, c'est beaucoup plus puissant. »

Application concrète : remplacer le titre « Payment » par **« Secure payment »** dans l'éditeur de langue du checkout. « Un gain de conversion minuscule, mais c'est un principe qui agit au niveau subconscient. »

---

### 2.4 Page d'accueil, fiche produit, expérience

**Les erreurs qui tuent la conversion (Fogarty, 2:41–3:49)** — liste complète :

| Erreur | Détail donné |
|---|---|
| Branding incohérent | On clique sur une pub et on atterrit sur un site qui n'a rien à voir : couleurs qui jurent, polices différentes, « l'expérience paraît légèrement de travers ». Il vise explicitement les dropshippers. |
| Information produit faible | Pas de guide des tailles, pas de délais de livraison, aucune explication claire des bénéfices |
| Trop ou trop peu de texte | « Certaines boutiques vous noient sous la copie, d'autres vous donnent une ligne et une photo floue. Dans les deux cas, le client ne fera pas confiance. » |
| **Fausse urgence** | L'urgence est un excellent levier — mais si elle sonne faux, elle nuit |
| Visuels de mauvaise qualité | Photos floues, images de banque génériques qui font paraître le produit bon marché. « Vous voulez que les gens voient le produit et se disent instantanément : je sais exactement ce que j'achète, je connais le tissu, la couleur, la coupe. » |
| Navigation encombrée | Trop d'options ; à simplifier au maximum |

**Ce que font les bonnes marques (Fogarty, 4:11–4:55)**, illustré par sa propre marque Oodie : branding continu du courriel (« 30 % de rabais ») à l'image d'en-tête du site, mêmes polices, même ambiance, même photographie ; **iconographie** pour les détails produit (« les gens n'ont même pas besoin de lire, ils voient les icônes et comprennent ») ; offres réelles (rabais authentiques, campagnes saisonnières, lots qui ajoutent de la valeur plutôt que des gadgets) ; photographie coûteuse pour faire sentir la douceur du produit ; navigation simple — et il reconnaît honnêtement que la sienne ne l'est pas assez, tout en notant que la plupart des marchands ont peu de produits et pourraient simplifier davantage.

**L'expérience fluide et le coût cognitif (Fogarty, 12:58–13:44)** :

> « Si c'est maladroit et confus, le client va brûler des calories à réfléchir. Et les gens ne veulent pas brûler de calories à réfléchir — notre corps nous en empêche naturellement. »

Il vise les sites sur-designés où l'on ne sait pas quels éléments sont cliquables. Recommandation : copier les sites très simples des meilleurs vendeurs, et vérifier que **chaque bouton clique effectivement**.

**La page d'accueil (Fogarty, 13:44–14:32)** — un seul travail : **clarté, valeur, direction.**

> « Trop de marques enterrent leurs produits sous du contenu de style de vie ou du blabla de marque. La page d'accueil devient un lookbook plutôt qu'une boutique. »

Structure du bloc héros :
1. un titre clair qui dit exactement ce que vous offrez ;
2. un sous-titre qui dit pourquoi ça compte pour le visiteur ;
3. le produit en évidence dans l'image ;
4. **une** action évidente (« Magasiner »).

Plus un bandeau pour l'offre principale : livraison gratuite, solde saisonnier, offre de lot — ou, pour une marque toute neuve, simplement ce que vous vendez et le problème que vous réglez.

**La fiche produit — trois tâches simultanées (Fogarty, 14:32–15:41)** : **informer, persuader, faire agir.** « Ratez-en une et la vente meurt. »

- **Nuanciers visuels** pour les couleurs et les tailles — le choix doit être évident ;
- variantes lisibles (type de pyjama : « chaud » ou « rafraîchissant », rayé ou à pois) — « c'est très noir sur blanc, ce qu'on vend et ce qu'ils sélectionnent » ;
- **bénéfices en lignes courtes**, pour permettre le survol rapide ;
- essentiels obligatoires : taille, livraison, remboursement ;
- **accordéons** : « au lieu de longs paragraphes brouillons, découpez en sections qui s'ouvrent au défilement. La page reste légère. » Disponible dans n'importe quel constructeur de thème.

**Le format testé de Convertica (10:01–10:22)** — leur recommandation la plus opérationnelle :

> « Les bonnes descriptions produit fonctionnent, mais on a remarqué qu'au-dessus du bouton d'ajout au panier et sous le titre du produit, **trois à cinq puces de caractéristiques et de bénéfices suffisent**. Qui veut en lire plus peut défiler. Mais la plupart des gens veulent juste un résumé rapide. »

**Les boutons de variantes plutôt que les menus déroulants (Convertica, 4:16–4:37)** : testé gagnant sur plusieurs sites e-commerce, à condition d'avoir **moins de 5 à 10 options**. Les afficher toutes côte à côte convertit mieux qu'une liste à dérouler.

**La description longue reléguée en bas (Convertica, 4:37–5:01)** : Amazon la place très bas parce que « pour être honnête, la plupart des gens ne la lisent pas — je ne me souviens pas de la dernière fois où je suis descendu tout en bas lire une description ». Elle reste présente pour la minorité qui en a besoin.

**Le diagnostic visuel d'une mauvaise boutique (Chappell, 5:54–8:35)** — le passage le plus concret sur les erreurs de mise en page :

- bandeau de livraison sur fond blanc qui ne ressort pas ;
- éléments de menu tous empilés ;
- sur mobile, l'imagerie n'occupe pas assez d'espace, et il manque d'images pédagogiques ;
- des options produit (« types de boucles ») incompréhensibles sans explication ;
- **des liens qui mangent un espace énorme sur mobile, si bien qu'il faut défiler très loin pour atteindre le bouton d'ajout au panier** — d'où un taux d'ajout au panier structurellement bas ;
- **le bouton d'ajout au panier est blanc sur blanc**, il se fond dans le site ;
- le prix est trop petit, le titre prend trop de place, il y a des pop-up ;
- au clic, un pop-up d'ajout au panier **sans upsell ni guidage**, qui dit « voir le panier » — donc **deux clics** pour voir son panier, puis une page panier séparée : « ça détruit les taux de conversion » ;
- sur la page panier, un pop-up **au pire moment possible** ;
- une protection de colis à 0,97 $ dont l'option de refus est en grisé, « ce qui est encore plus bizarre » ;
- au checkout, aucun badge de confiance, aucun délai de livraison annoncé, presque aucune information, et des frais supplémentaires qui apparaissent — « les gens peuvent rebondir là aussi ».

**L'échantillon comme produit d'appel (Convertica, 6:14–7:23)** : sur un site par ailleurs médiocre, un bloc « essayer un échantillon » juste sous l'ajout au panier. Pour un produit à faible coût et forte marge : « c'est ce qu'on appelle un produit d'appel — ça leur coûte de l'argent pour vous inscrire, mais ça finit par leur rapporter plus à long terme ». L'échantillon arrive avec de l'information d'inscription.

---

### 2.5 Panier et checkout

**Le constat commun** : Fogarty (15:41) — « le panier et le checkout, c'est là que la plupart des ventes meurent. Vous avez dépensé tellement d'argent, de temps et d'efforts pour les amener ici. »

Les trois tâches du tunnel, selon lui : **réviser, rassurer, convertir.**

**La page panier séparée : l'erreur unanime.**

| Source | Formulation |
|---|---|
| Fogarty (15:41) | « La plus grosse erreur ici, c'est de forcer les clients sur une page panier séparée. Cette étape supplémentaire ajoute de la friction. Le correctif : un tiroir latéral, pour aller droit au checkout. » |
| Chappell (4:44) | « Si vous les amenez directement à une page panier, ça a un effet négatif parce que vous chargez maintenant une deuxième page. » |
| Chappell (7:02) | « On a cliqué deux fois juste pour voir notre panier. Puis on est amené à une page panier. Ça détruit les taux de conversion. » |
| Louis (8:20) | Le paiement en trois pages « fait des étapes et des étapes et des étapes » |

**Le tiroir latéral outillé (Chappell, 19:42–20:54)** — ce qu'il faut y mettre : badges de confiance, minuteur d'urgence, barre de livraison gratuite, carrousel d'upsell avant le paiement, badges de moyens de paiement. Illustré chez Carpe : paliers empilés (livraison gratuite, −15 %, −20 %, −25 %, −30 %), prix barrés, tous les produits visibles en premier écran, et un produit supplémentaire proposé à −20 %.

**Le libellé du bouton (Chappell, 17:19)** — détail fin : Carpe écrit **« Continuer »** et non « Payer », parce que le parcours ne s'arrête pas là — il enchaîne sur des upsells post-achat.

**Les moyens de paiement** — désaccord net :

- **Fogarty (16:02)** : tout offrir — PayPal, Apple Pay, Klarna, Afterpay. « Un checkout lent et maladroit sans beaucoup d'options ne construit pas la confiance. »
- **Larsen (3:34–4:21)** : **PayPal et Amazon Pay seulement**. Les autres passerelles « vous verrez peut-être 0,2 % de gens qui l'utilisent vraiment — vous êtes mieux, au moins pour l'instant, d'utiliser juste ces deux-là : elles font la même chose avec moins de choix ». Son argument : les passerelles affichées sont elles-mêmes un signal de confiance, mais l'excès de choix dilue.
- **Louis (1:05)** : **décocher Shop Pay**, « ce n'est pas utilisé en Europe » et « ça va faire peur à plein de gens ».

**L'international (Fogarty, 16:02–16:47)** : détection automatique de la devise et de la langue, via Shopify Markets ou une application de conversion. Son argument personnel, qui est l'argument le plus directement transposable à une marque québécoise qui vend aux États-Unis :

> « Je déteste acheter en USD alors que je suis en Australie, parce que je ne sais même pas si le site est opérationnel en Australie. Je veux un vendeur australien en dollars australiens. C'est cette confiance et cette connexion que vous devez transmettre à vos clients. »

**Les réglages de champs — comparaison des deux vidéos checkout** :

| Réglage | Larsen (vid. 4) | Louis (vid. 5) |
|---|---|---|
| Comptes clients obligatoires | Désactivés | « Jamais de la vie — vous rajouteriez une énorme étape » |
| Méthode de contact | Peu importe | **Courriel**, pas téléphone ; **décocher Shop Pay** |
| Prénom + nom | Exigés — logistique **et** psychologie : « ça confirme que ça part pour Samuel Larsen », « une petite confirmation psychologique que le colis sait où il va » | Exigés — « beaucoup plus simple pour les livraisons, vous aurez moins de problèmes » |
| Nom d'entreprise | Masqué, sauf B2B | **« Ne pas inclure »**, pas même facultatif, sauf B2B fréquent. « Les clients professionnels sont habitués à redemander une facture au nom de leur entreprise. » |
| Ligne d'adresse 2 | Masquée ou optionnelle | **Facultative** — facilite la livraison |
| Téléphone d'expédition | Optionnel (avec adaptation du libellé) | **Facultatif** — aide la livraison et alimente le marketing SMS |
| Adresse de facturation | = adresse de livraison par défaut | Autoriser qu'elles diffèrent (« relativement bien fait, à la base tout sera identique ») + **activer la validation d'adresse** (« il n'y a rien à valider, c'est juste Shopify qui propose des adresses ») |
| **Marketing courriel** | **Pré-cocher** — « c'est un peu douteux avec le RGPD, mais vous risquez peu d'être puni, j'utilise un peu la zone grise » | **Ne PAS pré-cocher** — « si vous voulez respecter le RGPD, il est interdit de présélectionner » |
| Pourboires | Non abordé | **Interdits en Union européenne**, à ne pas ajouter |
| Scripts supplémentaires | Non abordé | Obsolètes selon Shopify, à ignorer |
| Langue du paiement | Éditable (voir plus bas) | Vérifier qu'on est bien sur « français » |
| Courriels de panier abandonné | En place, obligatoire | Non abordé (voir vid. 6) |

**Le principe des champs (Larsen, 5:13–5:40)** :

> « En général, moins vous montrez de champs, mieux c'est. Quand un client regarde cette vue, il n'a pas envie de commencer à remplir tout ça — et même s'ils sont optionnels, ils ressemblent quand même à du travail. Le moins de champs possible, mais le moins avec lequel on peut s'en tirer : il en faut quand même quelques-uns. »

**L'édition de la langue du checkout (Larsen, 8:36–12:02)** — la contribution la plus originale de sa vidéo :

1. **Règle générale d'abord** : « ne visez rien de trop hors norme. Les gens sont habitués à magasiner d'une certaine façon et s'attendent à un certain type d'expérience. Tout ce qui sort trop de ça peut causer de la friction et de la méfiance. »
2. **« Payment » → « Secure payment »** (voir 2.3, la règle du contre-effet).
3. **Donner une raison à chaque champ imposé.** Au lieu de « numéro de mobile requis », écrire **« requis pour la confirmation d'expédition »** ou « requis pour la livraison » — « vous donnez à la personne une raison de le remplir, et elle est beaucoup plus susceptible de le faire ». Même principe pour le courriel : « requis pour la confirmation de commande ». Sa justification : « le livreur pourrait vous appeler » est une raison plausible pour le téléphone, la confirmation de commande l'est pour le courriel.

**Les délais dans le nom de la méthode d'expédition (Larsen, 12:02–13:17)** — problème posé : à l'étape 2, le client voit les options d'expédition mais « n'a aucune idée de quand ces produits vont lui arriver ». Correctif accessible à tous : **écrire le délai entre parenthèses dans le nom même de la méthode d'expédition**. « Ce ne sera pas aussi joli » que la version Shopify Plus qu'il montre (exemple : Tactical Baby Gear), « mais ça transmet aux gens quand ils vont recevoir leur colis, et ils seront beaucoup plus à l'aise pour continuer vers le paiement ».

**Le téléphone et le courriel dans le checkout (Larsen, 1:57–3:34)** — Shopify ne prévoit pas d'emplacement pour un contact de soutien. Il en a ajouté pour un client : « ils voient que s'ils ont des questions, c'est une petite confirmation que quelqu'un est là pour aider ».

À l'objection « et si les gens appellent vraiment ? » :

> « Laissez-les. Vous pouvez faire tomber ça sur une boîte vocale, et si vous voulez, rappeler — mais vous n'avez pas à être là tout le temps. »

Un abonnement Skype suffit pour obtenir un numéro à faible coût avec messagerie. Double bénéfice :
1. on apprend les préoccupations réelles des clients ;
2. **sur un produit haut de gamme (il donne l'exemple de 1 000 $), les gens veulent appeler pour vérifier que la boutique est légitime** — et le rappel devient une occasion de vente.

**Les politiques dans le checkout** :
- **Larsen (4:21–5:13)** : les afficher en **fenêtres modales** — « si un client a une inquiétude ou une question, il n'est pas retiré du checkout ». Bien structurées et lisibles, pour être survolées rapidement.
- **Louis (9:06–10:14)** : la mécanique exacte. Paramètres → Politiques → rédiger les politiques. **Elles n'apparaissent pas instantanément** : « ça a parfois pris quelques minutes chez moi ». Elles s'affichent ensuite juste sous le checkout et servent de réassurance.

**Le réglage désigné comme le plus important de toute la boutique (Louis, 8:20–9:06)** :

> « Mise en page du paiement — c'est peut-être le paramètre, la configuration la plus importante de toute votre boutique. Vous devez impérativement être sur un **paiement en une page**. »

Comparaison qu'il fait à l'écran : le mode trois pages enchaîne panier → information → expédition → paiement. « Le problème principal, c'est que ça fait des étapes et des étapes et des étapes. » Son argument d'autorité : « c'est prouvé par Shopify que ça permet un taux de conversion plus élevé, et c'est assez évident : il y a juste moins de clics, moins d'étapes, c'est mieux pour tout le monde ».

**La personnalisation visuelle du checkout (Louis, 4:06–8:20)** — le mode d'emploi le plus détaillé du corpus :

1. **Mettre à niveau** les pages de remerciement et de statut de commande (Paramètres → Paiement → examiner les personnalisations → mettre à niveau), sans se prendre la tête.
2. **Logo** : ajouter une image — mais **pas un logo détouré**. Recommandation : le logo **sur une pastille ronde de couleur** assortie à la charte graphique, blanche à défaut d'idée.
3. **Position du logo : pleine largeur.** C'est la seule des trois options (pleine largeur / résumé de commande / formulaire de paiement) qui **débloque une image de fond** — il le démontre en basculant entre les options et en montrant l'image qui disparaît.
4. **Usage de l'image de fond** : y loger des **badges de réassurance**, à placer **plutôt vers la droite** de l'image. Raison donnée : à gauche il y a le logo et la zone est très centrée, à droite il y a le résumé de commande. Exemple : logos de paiement sécurisé faits sur Canva.
   - Mise en garde honnête : « vous êtes très nombreux à être extrêmement mauvais sur Canva, on va pas se mentir. Vous n'avez absolument pas la patte d'un designer, et c'est normal quand on débute. » D'où : faire **le plus simple possible**, des badges cohérents entre eux, peu chargés, épurés, de la même thématique et de la même collection, au style identique.
5. **Couleur de fond principale** : **jamais du blanc**. Prendre la couleur principale de la marque, **très fortement tirée vers le blanc** (dans son exemple, un vert très léger).
6. **Fond du résumé de commande (à droite)** : la couleur secondaire de la marque.
7. **Couleur d'accent** : reprise de la charte (il montre la saisie d'un code hexadécimal).
8. **Champs et cartes : blanc**, pas transparent — « ça ressort beaucoup plus, ça permet que les champs qui doivent être complétés le soient mieux par les utilisateurs ».
9. Ne **jamais** mettre d'image dans le fond de la zone de formulaire : « jamais de la vie ».

**La cohérence visuelle du checkout (Larsen, 0:22–1:57)** — l'équivalent pour l'ancienne interface : Thèmes → Personnaliser → paramètres de thème → Paiement. Formulaires assortis au site, **couleurs de boutons identiques partout dans le tunnel** (« n'ayez pas de l'orange ici si le reste du site est bleu »), et un **vrai logo image** — « il ne se tire pas naturellement du logo Shopify de la navigation principale, il faut le téléverser séparément ».

---

### 2.6 Vitesse et technique

**La règle chiffrée (Chappell, 1:36–3:07)** :

> « Pour chaque seconde de délai, il y a une baisse de 7 % de vos taux de conversion. »

**Le paradoxe qu'il pose** : on veut des images haute résolution — elles convertissent, elles éduquent, elles montrent les ingrédients, le style de vie, chaque étape d'utilisation. Mais tout cet espace prend du temps à charger. « En fait, la plus grosse chute de conversion de la plupart des boutiques vient de la lenteur de chargement due aux images haute résolution qu'elles téléversent. »

Sa résolution : **compresser sans dégrader**. Outil cité : Tiny Image Optimizer (application Shopify), qui optimise automatiquement toutes les images, les garde en haute résolution et les fait charger instantanément. « Une fois installé, l'outil fait les ajustements automatiquement. »

Argument de fond : « à l'époque actuelle, la fréquence et la vitesse d'accès à un site sont extrêmement importantes. Si le site prend trop de temps à charger, les gens sont moins susceptibles de passer à la caisse. »

**La vitesse comme prérequis, pas comme levier (Convertica, 9:38–10:01)** : la vidéo la range explicitement dans les choses « dont je n'ai pas parlé » parce qu'elles vont de soi — « assurez-vous que votre site charge rapidement, que vous avez des photos de haute qualité, que vos titres sont bien écrits ». Leur diagnostic est que ces prérequis sont souvent **déjà remplis** — les sites montés sur Shopify ou WordPress sont « généralement faciles à utiliser, généralement rapides, généralement assez intuitifs, avec une bonne expérience utilisateur » — et que le problème est ailleurs : dans les indicateurs de crédibilité absents.

**Aucune des six vidéos ne traite** : Core Web Vitals nommément, le poids du JavaScript, le nombre d'applications installées, le rendu serveur, ou l'impact des scripts tiers sur la performance. La vitesse est traitée uniquement sous l'angle du poids des images.

---

### 2.7 Données, diagnostic et expérimentation

**La ventilation du taux de conversion (Chappell, 3:31–5:54)** — la méthode de diagnostic la plus utile du corpus, et la seule vraiment structurée.

Principe : ne pas regarder le taux de conversion global, mais **la ventilation par étape** dans le tableau de bord Shopify, pour localiser le goulot d'étranglement. Trois diagnostics distincts :

| Symptôme | Interprétation | Causes probables citées |
|---|---|---|
| **Taux d'ajout au panier bas** (2 à 5 %) | Le problème est sur la fiche produit | Le bouton n'est pas vu ou se fond dans la page ; friction ; client pas éduqué ; ingrédients non listés ; taille du mannequin absente ; offre ou prix trop élevé |
| **Bon ajout au panier, chute vers le checkout** | Le problème est entre le panier et le tunnel | Page panier séparée qui recharge ; pas de tiroir latéral ; badges de paiement invisibles ; frais de livraison découverts à ce moment ; code promo qui ne s'applique pas |
| **Bon parcours, peu de paiements complétés** | Le problème est dans le checkout | Seuils de livraison gratuite ; prix ; moyens de paiement offerts ; manque de badges de confiance ou d'avis ; délai de livraison trop long |

Contexte de la démonstration : un client à ~500 000 $ de ventes sur 30 jours, taux de conversion en hausse autour de 2,9–3 %.

**L'expérimentation comme processus, pas comme projet (Fogarty, 8:22–9:32)** :

> « Une fois votre offre réglée, le travail n'est pas fini. Le CRO n'est jamais terminé. Les marchés bougent, les préférences changent, les concurrents vous copient, et surtout, les comportements changent. Quand les gens voient une certaine offre ou une certaine expérience encore et encore, ça perd parfois son impact, simplement parce qu'ils en ont assez. Ce qui marchait l'an dernier ne marchera pas nécessairement cette année. »

Règles qu'il pose :
- **Une variable à la fois** — prix, titre, appel à l'action, upsells, lots — « jamais tout d'un coup, sinon vous ne saurez jamais ce qui a causé le changement. Un seul point de focus donne de la clarté. »
- **Ne pas surcompliquer le suivi** : un chiffrier suffit quand on est petit ; passer à des tableaux de bord en grandissant, pour voir les motifs plus vite.
- Outil recommandé : Visually, avec éditeur glisser-déposer — **il déclare être investisseur dans l'entreprise**.

**Le test A/B chez Bernstein (1:32–1:54, 2:16, 4:12)** :
- Outil : **Intelligems** A/B testing — « un de mes outils préférés, on l'utilise constamment ». Fonctionnement : 50 % du trafic vers une version, 50 % vers l'autre, **un seul changement** entre les deux (prix, titre, ou autre).
- Son cadrage de fond : « l'objectif principal, c'est de ne rien deviner. La première fois, vous avez fixé le prix au hasard, vous avez fait la livraison gratuite au hasard, vous avez fait tel upsell, vous avez fixé le prix de l'upsell d'une certaine façon — ce sont tous des devinettes. C'est correct, mais vous devez les changer pour voir si votre devinette était bonne ou mauvaise. Et aucun d'entre vous ne fait ça, ce qui me sidère. »
- Son coup de gueule : « ce sont ces choses-là que vous devez tester, pas votre foutue palette de couleurs. »
- Sur le statu quo : « si vous gagnez de l'argent avec votre boutique, c'est ridicule de garder la même offre du début à la fin. C'est insensé. »

**L'argument d'autorité statistique de Convertica (1:53–2:43)** — leur justification méthodologique pour étudier Amazon :

> « Amazon, parce qu'ils sont les meilleurs du jeu. Ils ont un algorithme de test A/B intégré qui teste en permanence. Donc ces éléments ont été prouvés sur d'énormes volumes de données, et on peut en tirer quelques conclusions. »

Autrement dit : ce que fait Amazon n'est pas une opinion de design, c'est le résultat d'un test à très grande échelle. Même logique appliquée à Apple (« ces gars-là ont tellement de données, autant apprendre des pros »).

**La position de Chappell sur ce qu'est le CRO (31:21)** — sa phrase de cadrage finale :

> « Le CRO ne veut pas dire simplement réparer des pages. C'est de l'expérimentation continue, du test A/B, et la maximisation de chaque métrique du haut jusqu'au bas de l'entonnoir. »

---

### 2.8 Récupération, après-achat et valeur à vie

**Cette catégorie est traitée presque exclusivement par la vidéo 6.** Fogarty et Bernstein l'effleurent (upsell post-achat, marketing courriel), les vidéos 3, 4 et 5 ne l'abordent pas.

**Le gisement des paniers abandonnés (Chappell, 20:54–21:41)** — cas montré : près de 35 000 commandes mises au panier, 8 600 achats. **Plus de 20 000 paniers récupérables** sans augmenter le budget publicitaire. « C'est une occasion massive qu'on ne veut pas rater. »

Sa règle de diagnostic : **taux d'ajout au panier élevé + taux de conversion bas = la récupération est le levier le plus rapide.**

**La récupération par SMS avec IA (21:41–23:37)** — le passage le plus commercial de la vidéo.

- Cas client cité : Heights District, marque de vêtements streetwear passée par son mentorat, **+60 000 $ de ventes le premier mois** après installation de l'outil.
- Mécanique décrite : l'outil met en place « une IA et un numéro de téléphone » ; pour chaque personne qui met au panier puis quitte, l'IA relance — « j'ai vu que vous aviez ajouté cet article au panier mais que vous n'avez pas acheté, puis-je vous aider ? » ; le client répond « c'était un peu cher, je veux vraiment le produit mais pas dépenser autant » ; l'IA répond « est-ce qu'un rabais de 5 ou 10 % vous aiderait ? » — et la vente se conclut.
- Chiffres annoncés : **15 à 30 % de récupération**, **ROI de 10 à 15×**, à configurer une seule fois.
- Son argument de fenêtre : « ça ne veut pas dire qu'ils ne voulaient pas acheter, mais maintenant qu'ils sont partis, la chance de les récupérer diminue si vous n'avez pas quelque chose comme ça. »

**La récupération par courriel — l'étape préalable (23:37–25:55)** : avant d'envoyer des rappels, il faut une liste. « Une des façons les plus rapides de récupérer plus de gens par courriel, c'est d'avoir plus de courriels au départ. »

- Dispositif : **pop-up pleine largeur interactive** — on choisit un article (une bougie si on vend des bougies, un supplément si on vend des suppléments), on débloque un **rabais mystère**, on saisit son courriel.
- Chiffre annoncé : **≈ 15 % d'inscription**, contre 3 à 5 % pour un pop-up ordinaire. « Imaginez tripler ce volume. »
- Bénéfices secondaires cités : le courriel est gratuit à envoyer ; et une liste plus grande améliore les **taux d'appariement des données avec Meta**.
- Cas client : Photon Candle, passée par le mentorat puis l'agence, « à plus de 3 millions ce mois-ci ».
- Flux à construire ensuite : rappels de récupération, flux d'abandon de panier, flux d'abandon de checkout, flux post-achat.

**L'abonnement (25:55–27:27)** — la mécanique de valeur à vie la plus rentable selon lui.

Exemple Graza chiffré : 10 $ d'acquisition pour un client qui prend l'abonnement à 81 $ = **8× de retour sur la dépense publicitaire** dès le premier mois ; puis **81 $ supplémentaires le mois suivant**, sans nouveau coût d'acquisition. « Votre revenu s'empile chaque mois. »

Champ d'application : « tout produit consommable, ou de soin de la peau — tout ce qui s'épuise et se rachète plusieurs fois. » Bénéfice secondaire : le client n'a pas à revenir sur le site, ce qui améliore l'expérience post-achat. Outil cité : Rebuy.

**L'upsell post-achat (27:27–28:39)** :
- Fogarty (6:51–7:13) : « le client complète la commande, et à l'écran suivant, la page de remerciement, il y a une autre très bonne offre et une séquence d'offres qui peut augmenter drastiquement le profit par client. Parce que pour chaque client, vous avez déjà payé le coût d'acquisition. Maintenant, il s'agit de tirer le maximum de valeur. »
- Chappell (27:27) : exemple Carpe. « S'ils viennent de dépenser 100 $, vous leur offrez un produit supplémentaire à tarif réduit pour disons 20 $ de plus. Et parce qu'ils ont déjà acheté chez vous et vous font confiance, les chances qu'ils rachètent montent significativement. » Effet : hausse du ROAS, et **déclenchement de la deuxième commande**, qui rend une troisième plus probable.
- Bernstein (3:25) l'intègre à sa structure de prix fractionnée, avec des downsells à la suite.

**Les séquences courriel post-achat (Chappell, 28:39–29:47)** — contenus qu'il énumère : offres spéciales ; produits complémentaires (« vous avez acheté ce produit, mais saviez-vous que cet autre améliore votre sommeil ? » ; « vous avez pris notre créatine, saviez-vous que notre protéine augmente la croissance musculaire par-dessus ? ») ; **l'histoire du fondateur** pour créer l'attachement — « une fois qu'ils ont acheté, ils sont en phase avec la marque, maintenant on veut les intégrer pour qu'ils deviennent des fans quasi sectaires » ; ventes de la fête du Travail ; cadeaux mystères ; remerciements thématiques.

Objectif stratégique qu'il énonce : « augmenter la valeur à vie dès le premier jour et leur revendre encore et encore par courriel et SMS, pour pouvoir **réorienter le budget publicitaire vers de nouvelles personnes** — ce qui abaisse le coût publicitaire, augmente la valeur à vie, et fait entrer plus de gens dans notre écosystème. »

**Les avis provoqués, pas espérés (Chappell, 29:47–31:21)** — sur l'exemple d'Everyday Dose :

> « Pour obtenir tous ces avis, ça ne vient pas juste de gens qui achètent et laissent un avis naturellement. Il y a toute une science derrière que vous ne voyez pas. »

Mécanique : immédiatement après l'achat, sollicitation par notification et courriel d'avis, de vidéos et de photos, avec **incitatifs et parrainage** — « pour les faire dépenser plus, référer leurs amis, et fournir des vidéos du produit ». Raison : « ils savent que s'ils obtiennent une tonne d'avis et de preuve sociale, ils auront un taux de conversion plus élevé. » La boucle est explicite : les avis nourrissent la conversion, qui nourrit les ventes, qui nourrissent les avis.

**Le marketing courriel comme angle mort (Bernstein, 9:34)** : dernier de ses six leviers, avec ce commentaire — « c'est aussi quelque chose de très, très sous-utilisé, et la plupart des gens ne le font tout simplement jamais. »

---

### 2.9 Continuité publicité → page

**Catégorie traitée par Fogarty et surtout Chappell, qui en fait son étape 3 et « l'une des plus importantes de toutes ».**

**Le principe (Chappell, 8:35–8:59)** :

> « C'est là que la plupart du revenu se gagne ou se perd. Vous voulez garder les choses super cohérentes de la publicité à la page d'atterrissage. »

**La cohérence entre créas (9:00–9:23)** : sur l'exemple de Graza, dont il ouvre la bibliothèque publicitaire Facebook — branding coloré constant (le vert de la marque), produit toujours montré, titres, émojis. « On veut que les gens reconnaissent notre marque, parce que ça augmente les taux de conversion quand les publicités sont cohérentes et synergiques entre elles. Peu importe quelle publicité ils voient, ils reconnaissent la marque et sont plus susceptibles de cliquer, ce qui fait monter les sessions sur le site. »

**Le « first load experience » (9:23–9:48)** — le concept le plus précis du corpus sur ce point :

> « Ce que vous remarquez : ce visuel d'emballage dans la publicité ? Quand je clique, le tout premier visuel que je vois est exactement le même. C'est ce qu'on appelle une expérience de premier chargement. Quand vous cliquez sur une publicité, votre esprit s'attend à voir ce sur quoi vous venez de cliquer. Et quand le site charge exactement cette chose, ça **valide** la chose même qu'ils cherchaient, ce qui augmente les chances qu'ils passent à l'étape suivante. »

**L'écho chez Fogarty (2:41, 12:12–12:58)** — la même idée par la négative : « vous cliquez sur une publicité et vous atterrissez sur un site qui a l'air complètement différent. Les couleurs jurent, les polices ne correspondent pas, et toute l'expérience paraît légèrement de travers. » Et sa mesure du délai de jugement : **0,05 seconde**.

**L'extension de la cohérence aux réseaux sociaux (Fogarty, 12:34–12:58)** : « faites en sorte que votre Instagram corresponde au branding, que vos stories à la une correspondent, parce que les gens vont creuser en profondeur pour trouver une raison de ne pas vous faire confiance. »

**Une remarque de Fogarty qui limite le champ du test (12:58)** :

> « Et rappelez-vous, tout dans le CRO n'a pas besoin d'être testé. Ces choses-là relèvent du simple bon sens, et vous voulez simplement les ajouter parce qu'elles vont construire cette confiance. »

---

## 3. Tableau de convergence et de désaccord

### 3.1 Points de convergence

| # | Point | Sources | Force du consensus |
|---|---|---|---|
| 1 | **L'offre prime sur le design** | Fogarty, Bernstein, Chappell | Fort (Convertica en dissidence partielle) |
| 2 | **Cadre d'objection « au début je pensais X, mais en fait Y »** | Fogarty, Bernstein (mot pour mot), Chappell (par la structure) | Très fort — formulation identique |
| 3 | **Miner les objections dans les avis 1 étoile des concurrents** | Fogarty, Bernstein | Fort — même méthode |
| 4 | **Tuer la page panier séparée, tiroir latéral** | Fogarty, Chappell, Louis (par le paiement en une page) | Très fort |
| 5 | **Moins de champs, moins d'étapes** | Larsen, Louis, Convertica | Fort |
| 6 | **Ne jamais imposer la création de compte** | Larsen, Louis | Fort |
| 7 | **Prénom + nom exigés, nom d'entreprise masqué** | Larsen, Louis | Fort — réglages identiques |
| 8 | **Politiques visibles et accessibles sans quitter le tunnel** | Fogarty (sous l'ajout au panier), Larsen (modales), Louis (sous le checkout) | Fort — trois emplacements complémentaires |
| 9 | **La confiance se joue avant la fiche produit** | Fogarty (0,05 s), Chappell (first load), Convertica (À propos) | Fort |
| 10 | **UGC et vrais visages plutôt que photos de banque** | Fogarty (+30 %), Chappell, Convertica | Fort |
| 11 | **Upsell post-achat, le CAC est déjà payé** | Fogarty, Bernstein, Chappell | Fort |
| 12 | **Bénéfices en puces courtes et scannables au-dessus du pli** | Convertica (3–5 puces), Fogarty (lignes courtes), Chappell (Carpe) | Fort |
| 13 | **Tester une variable à la fois** | Fogarty, Bernstein | Fort |
| 14 | **Version premium / variantes majorées** | Fogarty, Bernstein | Moyen |
| 15 | **Délais de livraison annoncés avant le paiement** | Larsen (dans le nom de la méthode), Chappell (dans le diagnostic checkout) | Moyen |

### 3.2 Points de désaccord

| Sujet | Position A | Position B | Arbitrage |
|---|---|---|---|
| **Case marketing pré-cochée** | **Larsen** : pré-cocher ; « c'est un peu douteux avec le RGPD mais vous risquez peu d'être puni, j'utilise la zone grise ; la différence entre opt-out et opt-in est énorme » | **Louis** : ne pas pré-cocher ; « si vous voulez respecter le RGPD, il est **interdit** de présélectionner » | **Louis a raison en droit.** Au Canada, la LCAP exige un consentement exprès : la case pré-cochée n'est pas conforme. Voir §7. |
| **Importance du design** | **Bernstein** : sans effet mesurable sous 100 k$/mois ; logo et palette testés, rien | **Convertica** : la crédibilité visuelle **est** le levier principal | Faux désaccord en partie : Bernstein parle d'esthétique, Convertica de signaux de crédibilité (étoiles, badges, photos réelles). Bernstein reconnaît d'ailleurs un plancher (« au moins 5/10 »). |
| **Prix leurre / ancrage par variantes** | **Bernstein** : recommandé — quatre variantes à 100 $, une à 50 $ | **Fogarty** : « je ne sais pas trop, je ne le recommande pas vraiment, mais ça fonctionne et beaucoup de gens l'utilisent » | Divergence éthique plus que technique. Les deux reconnaissent l'efficacité. |
| **Crédibilité des rabais affichés** | **Bernstein** : « personne ne fait plus confiance aux rabais, un −50 % n'est pas cru » | **Chappell** : paliers de rabais empilés chez Carpe (−15, −20, −25, −30 %), très efficaces | Réconciliable : Bernstein vise le rabais **affiché sans structure**, Chappell décrit un rabais **gagné par le volume**. |
| **Nombre de moyens de paiement** | **Larsen** : PayPal + Amazon Pay seulement ; les autres font 0,2 % et diluent le choix | **Fogarty** : tout offrir (PayPal, Apple Pay, Klarna, Afterpay) ; **Chappell** : badges de paiement visibles = confiance | Larsen est le plus ancien ; l'écosystème a changé (Apple Pay et le paiement différé sont devenus courants). Position de Fogarty et Chappell probablement plus à jour. |
| **Shop Pay** | **Louis** : décocher, peu utilisé en Europe, « ça va faire peur à plein de gens » | **Fogarty / Chappell** : accélérateurs de paiement = conversion | Dépend du marché. Au Québec / Canada / États-Unis, l'argument européen de Louis ne s'applique pas. |
| **Le téléphone au checkout** | **Louis** : méthode de contact = courriel, pas téléphone | **Larsen** : téléphone optionnel avec justification (« requis pour la confirmation d'expédition ») ; téléphone de soutien affiché | Compatibles : Louis parle de la **méthode de contact principale**, Larsen d'un **champ optionnel** et d'un numéro de soutien. |
| **La description longue** | **Convertica** : la reléguer tout en bas, « presque personne ne la lit » | **Fogarty** : la découper en accordéons | Compatibles : deux solutions au même problème (alléger la page sans supprimer l'information). |
| **Ce qu'il faut tester** | **Bernstein** : tout, et surtout le prix ; « ne devinez rien » | **Fogarty** : « tout dans le CRO n'a pas besoin d'être testé — certaines choses relèvent du bon sens » | Nuance utile : la cohérence de marque et la lisibilité ne sont pas des hypothèses à tester, ce sont des prérequis. |

---

## 4. Inventaire des outils cités

| Outil | Fonction | Cité par | Conflit d'intérêts déclaré |
|---|---|---|---|
| **Visually** | Test A/B, éditeur glisser-déposer | Fogarty (9:07) | **Oui** — « j'ai parlé du fait que je suis investisseur chez eux » |
| **Intelligems** | Test A/B (50/50, une variable) | Bernstein (1:32) | Non — il précise explicitement « aucun lien d'affiliation, je n'ai pas besoin de cet argent, je veux rester honnête » |
| **Zipify OneClickUpsell** | Upsell pré-achat en un clic | Bernstein (7:40) | Non (même déclaration) |
| **Bundle Bear** | Lots | Bernstein (9:11) | Non (même déclaration) |
| **Thème Shrine** | Lots + case à cocher | Bernstein (9:11, 9:34) | Non (même déclaration) |
| **X Checkbox** | Case à cocher pré-cochée | Bernstein (9:34) | Non (même déclaration) |
| **Shopify Markets** | Devise et langue automatiques | Fogarty (16:25) | Non |
| **Skype** | Numéro de téléphone à bas coût avec messagerie | Larsen (2:46) | Non |
| **Canva** | Fabrication des badges de réassurance | Louis (6:00) | Non |
| **Tiny Image Optimizer** | Compression d'images Shopify | Chappell (2:46) | Probable — « lié sous la vidéo » |
| **Rebuy** | Abonnements récurrents | Chappell (26:41) | Probable |
| Outil de constructeur d'audit | Audit automatisé de boutique (Surge) | Chappell (18:06) | **Oui** — c'est son entreprise |
| Outil de lots multi-produits | Panier moyen, vue unique | Chappell (18:53) | Probable — « lié sous la vidéo » |
| Outil de tiroir latéral | Badges, minuteur, barre de livraison, upsell | Chappell (20:06) | Probable |
| Outil de récupération SMS par IA | Relance conversationnelle de panier | Chappell (22:06) | Probable |
| Outil de pop-up pleine largeur | Capture de courriels, rabais mystère | Chappell (25:08) | Probable |
| Outil d'upsell post-achat | Offre après paiement | Chappell (28:14) | Probable |
| Application d'avis | Sollicitation d'avis, photos, vidéos | Chappell (30:34) | Probable |
| **Convertica** | Audit de conversion gratuit (convertica.org) | Convertica (10:22) | **Oui** — c'est leur service |

**Lecture** : la vidéo 6 est structurée comme un catalogue — chaque étape de méthode débouche sur un outil « lié sous la vidéo ». La méthode reste valable indépendamment des outils ; les chiffres de performance attribués à ces outils ne sont pas vérifiables. La vidéo 2 est la seule à déclarer explicitement l'absence de liens d'affiliation.

---

## 5. Inventaire des marques données en exemple

| Marque | Secteur | Vidéo | Ce qui est loué |
|---|---|---|---|
| **Amazon** | Généraliste | 3 (1:53–5:01) | Étoiles sous le titre, Q&R clients, badge « Amazon's Choice », boutons de variantes, description reléguée en bas, images produit exhaustives — et l'argument que tout cela est le résultat de tests permanents à grande échelle |
| **Apple** | Technologie | 3 (5:01–6:14) | Pages minimales, réducteurs d'anxiété (« livraison rapide, gratuite, sans contact », « retours gratuits et faciles »), clavardage « parlez à un spécialiste » |
| **Zendesk** | Logiciel B2B | 3 (7:23–8:54) | Page « À propos » : équipe réelle et diverse, engagements, métriques empilées (160 000 comptes, 4 000 employés, 160 pays, 38 000 h de bénévolat), vraies photos |
| **Oodie** (marque de Fogarty) | Vêtement / maison | 1 (4:11–4:55) | Branding continu courriel → site, iconographie produit, photographie coûteuse ; il admet que sa navigation n'est pas assez simple |
| **Graza** | Huile d'olive | 6 (8:35–12:12, 25:55) | Cohérence publicité → page (first load), verre + bouteille souple, paliers de quantité, abonnement, recharges, tiroir avec upsells, détails de récolte et de fabrication, **recettes** (traitement de l'objection « je ne saurais pas quoi en faire ») |
| **Everyday Dose** | Café fonctionnel | 6 (12:12–15:19, 29:47) | Offre héros en premier écran, autorité empruntée (Tasting Table, Who What Wear), 10 000 publications de recherche, 6 millions de commandes, 93,6 % / 88 %, comparaison frontale au café ordinaire, UGC vidéo, sollicitation systématique d'avis |
| **Carpe** | Antisudorifique | 6 (15:44–18:06, 19:19, 27:27) | Entonnoir à panier croissant (« ils entrent pour 4 $ et sortent à plusieurs centaines »), rabais par unité ajoutée, puces de bénéfices, tiroir à paliers, bouton « Continuer » plutôt que « Payer », upsells post-achat, **avant / après** |
| **Tactical Baby Gear** | Équipement | 4 (12:54) | Délais d'expédition affichés dans les méthodes (via Shopify Plus) |
| **Heights District** | Vêtement streetwear | 6 (21:41) | Cas client : +60 000 $ le premier mois via récupération SMS |
| **Photon Candle** | Bougies | 6 (24:22) | Cas client : montée à 300 k$/mois, « plus de 3 M$ ce mois-ci » |
| Skims, AG1, Nike, Apple | — | 6 (1:36) | Cités comme marques qui dépensent des millions par an en CRO |

---

## 6. Chiffres avancés et niveau de fiabilité

| Chiffre | Source | Fiabilité | Commentaire |
|---|---|---|---|
| 1 s de délai = −7 % de conversion | Chappell 1:36 | **Moyenne** | Ordre de grandeur repris de l'industrie ; aucune source citée |
| Conversion Shopify moyenne 1–3 % | Fogarty 1:32 | **Bonne** | Cohérent avec les repères publics |
| Conversion Shopify moyenne 1,4 % | Chappell 0:00 | **Bonne** | Cohérent |
| Top 1 % : 6–8 % | Fogarty 1:32 | **Bonne** | Plausible et nuancé (dépend de la niche) |
| UGC : jusqu'à +30 % de conversion | Fogarty 11:51 | **Faible** | « jusqu'à », sans source |
| Case pré-cochée : ≥ 70 % de prise | Bernstein 3:01 | **Faible** | Chiffre de praticien, non sourcé, mais mécaniquement plausible |
| Pop-up pré-achat : jusqu'à 50 % de prise | Bernstein 3:25 | **Faible** | « si vous le faites bien » — très optimiste |
| 7,4 % de conversion, 5 000 $/jour, 3 000 $ de profit | Bernstein 0:00 | **Faible** | Invérifiable ; argument de vente pour son mentorat |
| 20 000 $ → 225 000 $/mois en un an, +4 $ de panier | Bernstein 6:54 | **Faible** | Invérifiable ; capture d'écran non consultable dans ce relevé |
| 16 000+ boutiques auditées, 2 G$ de ventes clients | Chappell 0:24 | **Faible** | Argument d'autorité |
| Récupération SMS : 15–30 %, ROI 10–15× | Chappell 23:37 | **Très faible** | Outil affilié ; « la quantité de fois où j'ai vu des gens exploser après ça est irréelle » |
| +60 000 $ le premier mois (Heights District) | Chappell 21:41 | **Très faible** | Cas client d'un mentorat, outil affilié |
| Pop-up pleine largeur : ≈ 15 % d'opt-in contre 3–5 % | Chappell 24:46 | **Faible** | Outil affilié |
| Graza : 10 $ d'acquisition, 81 $ d'abonnement, 8× | Chappell 26:17 | **Faible** | Illustration pédagogique plutôt que donnée réelle |
| Zendesk : 160 000 comptes, 4 000 employés, 160 pays | Convertica 8:08 | **Bonne** | Chiffres affichés publiquement par Zendesk à l'époque |
| Everyday Dose : 6 M commandes, 93,6 %, 88 %, 10 000 publications | Chappell 12:59 | **Non applicable** | Ce sont les allégations **de la marque**, rapportées comme exemple de technique — pas des faits validés |
| Autres passerelles : 0,2 % d'usage | Larsen 3:57 | **Faible et daté** | Observation d'époque ; Apple Pay et le paiement différé ont beaucoup progressé depuis |

**Règle de lecture** : les **mécanismes** décrits dans ce corpus sont solides et convergents. Les **chiffres de performance** attribués à des outils précis proviennent presque tous de vidéos qui vendent ces outils ou un accompagnement, et doivent être traités comme du matériel promotionnel.

---

## 7. Réserves légales pour le Québec et le Canada

Trois recommandations du corpus sont **inapplicables telles quelles** au Québec :

**7.1 La case de consentement marketing pré-cochée.** Larsen (7:45–8:36) recommande de la pré-cocher en assumant une « zone grise » du RGPD. **La Loi canadienne anti-pourriel (LCAP) exige un consentement exprès** pour les messages électroniques commerciaux : une case pré-cochée ne constitue pas un consentement exprès. La Loi 25 (protection des renseignements personnels au Québec) va dans le même sens sur le consentement explicite et granulaire. **Suivre Louis (2:13), pas Larsen.**

**7.2 La relance SMS automatisée de panier abandonné.** Le dispositif décrit par Chappell (21:41–23:37) — une IA qui envoie un SMS à toute personne ayant abandonné un panier — suppose un **consentement préalable au marketing par SMS**. Sans ce consentement, chaque message est un message électronique commercial non sollicité au sens de la LCAP. Le champ « téléphone facultatif » recommandé par Louis (2:13) pour « profiter du numéro si jamais vous faites du SMS marketing » demande la même prudence : **collecter le numéro n'emporte pas consentement à être sollicité.**

**7.3 Les pourboires.** Louis (2:13) signale qu'ils sont interdits en Union européenne. Ce n'est pas le cas au Canada, mais le point mérite d'être noté pour un marché européen éventuel.

**7.4 Point non traité par le corpus mais pertinent** : aucune des six vidéos n'aborde l'affichage bilingue obligatoire, la Charte de la langue française pour un commerce servant le Québec, ni les obligations d'affichage de prix tout inclus. À vérifier en interne, pas dans ces sources.

---

## 8. Application à Lasclay

Éléments du corpus qui s'appliquent directement à lasclay.com, marque québécoise de produits isolés à la soie d'asclépiade vendus en français et en anglais.

**8.1 Le cadre RPV / PPV de Fogarty est le bon cadre de lecture.** Pour une marque à marge travaillée et à structure de coûts connue (COGS Tunisie, service de la dette), une hausse de conversion obtenue en écrasant le panier moyen serait une perte nette. Le raisonnement à quatre étages — CR, AOV, RPV, PPV, puis valeur à vie — est directement branchable sur le chiffrier de prévisions existant. C'est aussi l'argument à opposer à toute optimisation qui se justifierait par le seul taux de conversion.

**8.2 Le minage d'objections est immédiatement exploitable.** Les avis 1 étoile des produits concurrents en isolation (duvet, laine mérinos, isolants synthétiques) sur Amazon, plus les fils Reddit de plein air, donnent la liste des craintes réelles sur un isolant méconnu : pouvoir isolant réel comparé au duvet, tenue au lavage, compressibilité, allergies, comportement à l'humidité, durabilité. Ces objections alimentent ensuite les fiches produits, l'infolettre et les réponses publiques — c'est un travail de recherche, pas de rédaction, et il précède la rédaction.

**8.3 Le cadre « au début je pensais X, mais en fait Y » est un format d'avis à solliciter activement**, pas seulement à espérer. Un avis « super produit » ne vaut rien ; « je pensais que ça ne vaudrait pas le duvet, mais j'ai passé l'hiver avec » vaut une section entière de fiche produit. Cela implique de modifier la demande d'avis post-achat pour orienter la réponse.

**8.4 La devise et la langue automatiques (Fogarty, 16:25).** L'argument est celui d'un Australien qui refuse d'acheter en USD parce qu'il doute que le marchand le serve. Transposé : un client américain sur une boutique en dollars canadiens a exactement le même doute, en sens inverse. Shopify Markets règle les deux.

**8.5 Les réglages de checkout de Louis sont vérifiables en une dizaine de minutes dans l'admin**, et c'est la seule des six vidéos à jour sur le Checkout Extensibility actuel. À passer en revue par ordre d'impact décroissant : paiement en une page, connexion au compte non obligatoire, nom d'entreprise « ne pas inclure », politiques rédigées pour qu'elles s'affichent, personnalisation visuelle (logo sur pastille, fond en couleur de marque tirée vers le blanc, champs blancs).

**8.6 Les politiques sous le bouton d'ajout au panier (Fogarty, 11:26).** Pour un produit d'isolation vendu à distance, où la question « et si ce n'est pas assez chaud pour moi ? » est l'objection principale, l'affichage de la politique de retour au point de décision — et pas dans le pied de page — est le geste le plus rentable de la liste.

**8.7 Le format 3 à 5 puces de bénéfices au-dessus du pli (Convertica, 10:01)** est un format contraignant qui force à trancher ce qui compte vraiment dans une fiche : c'est un bon exercice de discipline éditoriale pour un produit technique.

**8.8 Ce qu'il faut écarter.** La structure de prix fractionnée de Bernstein (produit à 19,99 $ + quatre couches d'upsell) et les mécaniques d'ancrage par variantes gonflées relèvent d'une logique de dropshipping à acquisition payante et à faible attachement de marque. Elles sont incompatibles avec le positionnement de Lasclay et avec les garde-fous de la marque. Les mécaniques transposables sont plus sobres : lots cohérents, version supérieure réelle, abonnement là où il a du sens (les semences), upsell post-achat pertinent.

**8.9 Ce que le corpus ne couvre pas et qui compte pour Lasclay** : le référencement organique comme source de trafic (seule Convertica l'effleure en 1:05, pour dire que chaque visiteur SEO non converti est une occasion perdue), la conversion en contexte bilingue, la saisonnalité forte d'un produit d'hiver, la vente B2B et les cadeaux corporatifs, et le récit manufacturier local. Ces sujets relèvent d'autres sources.

---

## 9. Fiches détaillées par vidéo

### Vidéo 1 — Davie Fogarty Mentors, « How To 4X Your Shopify Conversion Rate (Complete CRO Guide) »

**Durée** : 16 min 56 s · **ID** : `A-7pTamjBIw` · **Langue** : anglais
**Nature** : guide structuré, la vidéo la plus rigoureuse du corpus sur le plan analytique
**Intérêt commercial** : faible — une seule recommandation d'outil, avec déclaration d'investissement ; renvoi final vers ses guides gratuits

**Plan de la vidéo**

| Horodatage | Section |
|---|---|
| 0:00–0:48 | Accroche : la plupart des boutiques sous 3 %, 99 % des marques ne font pas de CRO, celles qui en font testent des couleurs de boutons « comme en 2019 » |
| 0:48–1:32 | Définition du CRO ; la métaphore du seau percé |
| 1:32–2:41 | **La chaîne CR → AOV → RPV → PPV**, et la valeur à vie |
| 2:41–4:11 | Les six erreurs qui tuent la conversion |
| 4:11–4:55 | Ce que font les bonnes marques (exemple Oodie) |
| 4:55–6:51 | **L'offre comme levier principal** ; l'arithmétique du prix ; upsells pré et post-achat |
| 6:51–8:22 | Lots et variantes : multipacks, versions premium, prix leurre |
| 8:22–9:56 | Tester, itérer, répéter ; **l'effet composé** ; le volant d'inertie du CRO |
| 9:56–12:58 | Confiance : avis, minage d'objections, politiques, UGC, cohérence de bout en bout |
| 12:58–13:44 | L'expérience fluide et le coût cognitif |
| 13:44–14:32 | La page d'accueil : clarté, valeur, direction |
| 14:32–15:41 | La fiche produit : informer, persuader, faire agir |
| 15:41–16:47 | Panier et checkout ; international |

**Apports uniques au corpus**
- Le seul cadre métrique complet (RPV / PPV) et la seule mise en garde contre l'optimisation du taux de conversion isolé.
- Le seul à formuler **l'effet composé** des gains successifs (multiplication, pas addition) et le « volant d'inertie ».
- La seule mention du délai de jugement de **0,05 seconde** dès la créa publicitaire.
- La seule à dire explicitement que **tout n'a pas besoin d'être testé** — la cohérence de marque relève du bon sens.
- L'argument de la devise locale formulé du point de vue du client étranger (australien).

**Limites**
- Aucun chiffre sourcé ; les pourcentages (30 % d'UGC) sont donnés en « jusqu'à ».
- L'exemple principal est sa propre marque, dont il reconnaît lui-même les défauts de navigation.
- Recommandation d'outil avec conflit d'intérêts déclaré (Visually).

---

### Vidéo 2 — Michael Bernstein, « How To Increase Conversion Rate On Shopify (2025 CRO Guide) »

**Durée** : 10 min 33 s · **ID** : `kLneJKAqRtk` · **Langue** : anglais
**Nature** : contenu de praticien dropshipping, ton brut et direct, langage grossier censuré par les sous-titres
**Intérêt commercial** : élevé — les deux dernières minutes sont un argumentaire pour son mentorat un-à-un ; mais il déclare explicitement n'utiliser aucun lien d'affiliation

**Plan de la vidéo**

| Horodatage | Section |
|---|---|
| 0:00–0:46 | Accroche chiffrée : 7,4 % de conversion, 5 000 $ en une journée, 3 000 $ de profit |
| 0:22–1:09 | **Le design ne compte pas** — logo et palette testés A/B, aucun effet |
| 1:09–1:54 | **Split-tester le prix systématiquement** (± 5 $) ; outil Intelligems |
| 1:54–2:16 | « Ne devinez rien » : vos réglages initiaux sont tous des devinettes non vérifiées |
| 2:16–4:12 | **Le fractionnement du prix le long de l'entonnoir** — le cœur de la vidéo |
| 4:12–4:34 | Ne jamais garder la même offre du début à la fin ; le design compte après 100 k$/mois |
| 4:34–6:07 | Avis et objections : le cadre « au début je pensais X, mais en fait Y », méthode Amazon 1 étoile |
| 6:07–6:30 | **La hiérarchie de crédibilité** : commentaires > avis produit |
| 6:30–6:54 | Le plancher de design : « au moins 5 sur 10 », sinon ça a l'air d'une arnaque |
| 6:54–7:40 | Preuve chiffrée : 20 k$ → 225 k$/mois avec +4 $ de panier moyen |
| 7:40–9:34 | **Les six tests prioritaires** |
| 9:34–fin | Argumentaire de vente pour le mentorat |

**Apports uniques au corpus**
- **Le fractionnement du prix** (prix d'appel bas + couches successives d'upsell) — expliqué nulle part ailleurs dans le corpus, avec sa justification psychologique (la « boucle de oui »).
- **L'ancrage par les variantes plutôt que par le rabais** : « personne ne croit plus à un −50 %, mais quatre versions à 100 $ et une à 50 $, ça ils y croient ».
- **La hiérarchie de crédibilité** commentaires > avis produit > texte de fiche.
- La position la plus tranchée du corpus sur l'inutilité du design en dessous d'un certain seuil de revenu — avec le plancher qui l'accompagne.
- La seule déclaration explicite d'absence de liens d'affiliation.

**Limites**
- Tous les chiffres sont invérifiables et servent l'argumentaire de vente final.
- Cadre entièrement dropshipping : acquisition payante, faible attachement de marque, produits interchangeables. Une partie des mécaniques ne se transpose pas à une marque à valeur ajoutée.
- Le cadre d'objection est repris à l'identique de Fogarty (ou d'une source commune) sans attribution.

---

### Vidéo 3 — Convertica, « 7 eCommerce Conversion Rate Optimization Fundamentals »

**Durée** : 10 min 46 s · **ID** : `hb-qAAfCSPc` · **Langue** : anglais
**Nature** : décorticage d'exemples réels par une agence de CRO ; angle **crédibilité** exclusif
**Intérêt commercial** : modéré — appel final à un audit de conversion gratuit sur convertica.org
**Actualité** : la plus ancienne du corpus (références et ton datés) ; les principes tiennent, les captures montrées sont périmées

**Plan de la vidéo**

| Horodatage | Section |
|---|---|
| 0:00–1:05 | Problème posé : site rapide, belles images, titres optimisés — et ça ne convertit toujours pas |
| 1:05–1:53 | **Le diagnostic** : sites montés sans réflexe marketing, il manque les indicateurs de crédibilité |
| 1:53–5:01 | **Amazon décortiqué** — et l'argument que ses choix sont des conclusions de tests, pas des opinions |
| 5:01–6:14 | **Apple** : pages minimales, réducteurs d'anxiété, clavardage spécialisé |
| 6:14–7:23 | **L'échantillon** comme produit d'appel |
| 7:23–8:54 | **La page « À propos »** comme actif de conversion (exemple Zendesk) |
| 8:54–10:01 | Raconter son histoire : « les gens ne sont pas en magasin à toucher le produit » |
| 10:01–10:22 | **Le format 3 à 5 puces** au-dessus du bouton d'ajout au panier |
| 10:22–fin | Offre d'audit gratuit |

**Apports uniques au corpus**
- **Le seul angle « crédibilité »** du corpus. Là où les autres parlent d'offre et de prix, Convertica parle de ce qui rend une boutique inconnue digne de confiance.
- **La page « À propos » comme levier de conversion mesurable** — traitée par aucune autre vidéo. Les métriques empilées de Zendesk sont un modèle directement copiable.
- **L'argument méthodologique Amazon** : utiliser les choix d'un acteur qui teste en permanence comme substitut à ses propres tests quand on n'a pas le volume.
- **Les boutons de variantes plutôt que les menus déroulants** sous 5 à 10 options — recommandation précise et testée.
- **Le format 3 à 5 puces** au-dessus du pli, la recommandation la plus opérationnelle du corpus sur la fiche produit.
- **La question-réponse client** comme FAQ écrite par les acheteurs, qui décharge le service à la clientèle.
- **L'échantillon en produit d'appel** — mécanique traitée nulle part ailleurs.

**Limites**
- Aucun chiffre propre : la vidéo ne quantifie jamais l'effet des éléments qu'elle recommande, sauf par « on voit une augmentation chez chaque client ».
- Ancienneté : Amazon et Apple ont changé leurs pages depuis.
- Les captures d'écran commentées sont la substance de la vidéo, et c'est celle que la contrainte de relevé (pas d'image) ampute le plus.

---

### Vidéo 4 — Samuel Larsen, « The Ultimate Guide to Shopify Checkout Optimization (100% Free Methods) »

**Durée** : 14 min 57 s · **ID** : `aeUJw_ectUQ` · **Langue** : anglais
**Nature** : tutoriel checkout par un consultant e-commerce (cinq ans d'expérience annoncés)
**Intérêt commercial** : faible — appel à l'abonnement à la chaîne
**⚠️ Actualité : la vidéo la plus périmée du corpus.** Elle décrit l'ancien checkout Shopify personnalisable via les paramètres de thème et l'éditeur `checkout.liquid`. Une bonne partie des chemins de clics décrits n'existe plus depuis le passage au Checkout Extensibility. **Les principes restent valides ; la mécanique est à retrouver dans la vidéo 5.**
**⚠️ Qualité de transcription** : la plus dégradée du corpus (voir l'avertissement de méthode).

**Plan de la vidéo**

| Horodatage | Section |
|---|---|
| 0:00–0:22 | Promesse : méthodes gratuites, applicables en 15 minutes |
| 0:22–1:57 | **Cohérence visuelle** : couleurs de formulaires et de boutons, vrai logo image |
| 1:57–3:34 | **Téléphone et courriel de soutien dans le checkout** ; la réponse à « et s'ils appellent ? » |
| 3:34–4:21 | **Paiements express** : PayPal + Amazon Pay seulement |
| 4:21–5:13 | **Politiques en fenêtres modales**, sans quitter le tunnel |
| 5:13–7:45 | **Les champs** : le moins possible ; réglages recommandés un par un |
| 7:45–8:36 | Adresse de facturation, autocomplétion, **marketing courriel pré-coché** (zone grise), paniers abandonnés |
| 8:36–12:02 | **L'éditeur de langue du checkout** : « Secure payment », et donner une raison à chaque champ |
| 12:02–13:17 | **Les délais de livraison dans le nom de la méthode d'expédition** |
| 13:17–13:42 | L'étape paiement : « s'écarter du chemin » |
| 13:42–fin | Conclusion et abonnement |

**Apports uniques au corpus**
- **La règle du contre-effet des signaux de confiance** : trop insister sur la sécurité rend le client conscient du risque ; un indice subtil (« Secure payment ») est plus puissant qu'une avalanche de badges. Contre-intuitif, et contredit implicitement Chappell qui empile les badges.
- **Donner une raison à chaque champ imposé** (« requis pour la confirmation d'expédition ») — technique fine, transposable telle quelle dans n'importe quel checkout, y compris actuel.
- **Le délai dans le nom de la méthode d'expédition** — contournement gratuit d'une limite de Shopify.
- **Le téléphone de soutien comme outil de vente sur produit haut de gamme** : les gens appellent pour vérifier la légitimité, le rappel devient une occasion de vente.
- La justification psychologique de l'exigence du prénom : « une petite confirmation que le colis sait où il va ».
- **La règle générale de non-originalité** : « ne visez rien de trop hors norme, les gens ont des attentes de parcours, et l'écart crée de la friction et de la méfiance ».

**Limites**
- Interface décrite obsolète.
- **La recommandation de pré-cocher le consentement marketing est à écarter** (voir §7).
- La recommandation de limiter les passerelles à PayPal + Amazon Pay est datée.
- Aucun chiffre : tout est présenté comme « on a testé et ça augmente les conversions », sans quantification.

---

### Vidéo 5 — Shopify OS / Louis ST, « Comment Optimiser sa Page Checkout Shopify ? (pour la conversion) »

**Durée** : 10 min 28 s · **ID** : `6n98r3YiBOc` · **Langue** : français
**Nature** : démonstration écran pas à pas dans l'admin Shopify, par un formateur
**Intérêt commercial** : très faible — checklist gratuite en description, appel à l'abonnement
**Actualité : la plus à jour du corpus.** Seule vidéo à couvrir le Checkout Extensibility, l'éditeur de personnalisation du paiement et la mise à niveau des pages de remerciement et de statut de commande.

**Plan de la vidéo**

| Horodatage | Section |
|---|---|
| 0:00–0:44 | Promesse : tout configurer et tout appliquer d'ici la fin ; réduire les paniers abandonnés |
| 0:44–1:05 | Où aller : Paramètres → Paiement ; deux blocs, **Configuration** (nouveau) et **Paramètres** |
| 1:05–1:29 | **Méthode de contact : courriel** ; **décocher Shop Pay** ; **jamais de connexion obligatoire** |
| 1:29–2:13 | Information client : prénom + nom exigés, **nom d'entreprise « ne pas inclure »**, ligne 2 et téléphone facultatifs |
| 2:13–2:36 | **Marketing courriel : ne pas pré-cocher (RGPD)** ; pourboires interdits en UE |
| 2:36–3:20 | Adresses de livraison et facturation distinctes autorisées ; validation d'adresse activée ; scripts obsolètes ; langue française |
| 3:20–4:06 | Récapitulatif : « des petits paramètres extrêmement importants », à ne pas remettre en question si on débute |
| 4:06–4:51 | **Mise à niveau** des pages de remerciement et de statut ; entrée dans l'éditeur de personnalisation |
| 4:51–5:37 | **Logo sur pastille ronde** ; alignement ; **position pleine largeur pour débloquer l'image de fond** |
| 5:37–6:46 | **L'image de fond comme support de badges de réassurance**, à placer vers la droite ; la mise en garde Canva |
| 6:46–8:20 | **Couleurs** : fond principal en couleur de marque tirée vers le blanc, fond du résumé en couleur secondaire, couleur d'accent, **champs en blanc** |
| 8:20–9:06 | **Paiement en une page vs trois pages — « la configuration la plus importante de toute votre boutique »** |
| 9:06–10:14 | **Les politiques** : où les rédiger, et le délai de quelques minutes avant qu'elles s'affichent |
| 10:14–fin | Conclusion, abonnement, renvoi vers sa vidéo sur la page panier |

**Apports uniques au corpus**
- **La seule mécanique à jour** du checkout Shopify : chemins de clics vérifiables aujourd'hui.
- **Le paiement en une page** désigné comme le réglage le plus important de toute la boutique — argument absent des cinq autres vidéos, et appuyé sur une affirmation de Shopify.
- **L'astuce de la position « pleine largeur » du logo** pour débloquer l'image de fond, puis usage de cette image comme support de badges de réassurance : détournement astucieux d'une contrainte de l'éditeur.
- **La recommandation de couleur de fond** (couleur de marque très tirée vers le blanc plutôt que du blanc pur) et **champs en blanc pour qu'ils ressortent** — le seul conseil chromatique argumenté du corpus.
- **Le logo sur pastille** plutôt que détouré.
- **La mécanique exacte des politiques** dans le checkout, avec l'avertissement du délai — détail que personne d'autre ne donne et qui évite de croire à un bogue.
- **La position juridique correcte** sur le consentement pré-coché.
- Une honnêteté rare sur les limites de son audience (« vous êtes très nombreux à être extrêmement mauvais sur Canva ») qui débouche sur un conseil utile : faire simple et cohérent.

**Limites**
- Périmètre volontairement étroit : uniquement le checkout, aucun mot sur l'offre, le prix, les avis, la fiche produit.
- Perspective européenne sur Shop Pay, non transposable au marché nord-américain.
- Aucun chiffre, aucune source pour l'affirmation « c'est prouvé par Shopify ».
- C'est la vidéo dont le relevé sans image perd le plus de valeur démonstrative (couleurs, rendu final).

---

### Vidéo 6 — Chase Chappell, « How To Increase Conversion Rates on Shopify (2026 Guide) »

**Durée** : 32 min 56 s · **ID** : `daDsoHXE52A` · **Langue** : anglais
**Nature** : la plus longue, la plus récente, la plus dense en exemples de marques réelles
**Intérêt commercial** : **très élevé** — la vidéo est structurée comme un catalogue d'applications affiliées ; chaque étape de méthode débouche sur un outil « lié sous la vidéo » ; renvoi final vers sa vidéo suivante sur l'entonnoir publicitaire

**Plan de la vidéo**

| Horodatage | Section |
|---|---|
| 0:00–1:36 | Accroche et crédits : 1,4 % de moyenne, 16 000 boutiques auditées, 2 G$ de ventes clients |
| 1:36–3:31 | **Étape 1 — Vitesse** : 1 s = −7 %, le paradoxe des images haute résolution |
| 3:31–5:54 | **Étape 2 — La ventilation du taux de conversion** : trois diagnostics distincts |
| 5:54–8:35 | **La contre-démonstration** : décorticage d'une boutique mal optimisée, du bandeau au checkout |
| 8:35–9:48 | **Étape 3 — Continuité publicité → page** ; la bibliothèque publicitaire de Graza ; **le « first load experience »** |
| 9:48–12:12 | **Graza** : fiche produit exemplaire, paliers de quantité, abonnement, recharges, tiroir, recettes |
| 12:12–15:19 | **Everyday Dose** : l'offre héros et la preuve sociale en cascade |
| 15:44–18:06 | **Carpe** : l'entonnoir à panier croissant, les puces de bénéfices, le tiroir à paliers, l'avant/après |
| 18:06–20:54 | **Étape 4 — Panier moyen** : lots multi-produits en vue unique, tiroir latéral outillé |
| 20:54–25:55 | **Étape 5 — Récupération** : 20 000 paniers dormants, SMS avec IA, pop-up pleine largeur pour la liste |
| 25:55–31:21 | **Étape 6 — Après-achat** : abonnement, upsell post-achat, flux courriel, avis provoqués |
| 31:21–fin | Récapitulatif en six points ; renvoi vers la vidéo suivante |

**Apports uniques au corpus**
- **La ventilation du taux de conversion en trois diagnostics** (ajout au panier / atteinte du checkout / paiement complété) — la seule méthode de diagnostic structurée du corpus, et la plus directement actionnable pour savoir *par où commencer*.
- **Le « first load experience »** : le premier visuel après le clic doit être exactement celui de la publicité, pour valider l'attente.
- **La contre-démonstration** d'une boutique ratée, point par point : c'est la seule vidéo qui montre ce qu'il ne faut pas faire de façon systématique.
- **Le gisement chiffré des paniers abandonnés** (35 000 créés, 8 600 achats) comme argument de priorisation.
- **Les avis provoqués plutôt qu'espérés** : « il y a toute une science derrière que vous ne voyez pas ».
- La règle du bouton « Continuer » plutôt que « Payer » quand le parcours enchaîne sur des upsells.
- La seule à traiter **l'abonnement** comme levier de valeur à vie, avec son arithmétique.

**Limites**
- **Le conflit d'intérêts est structurel** : la moitié des étapes se conclut par une recommandation d'outil affilié, avec des chiffres de performance spectaculaires et invérifiables (15–30 % de récupération, ROI 10–15×, +60 000 $ le premier mois).
- Les cas clients cités sont tous issus de son propre mentorat.
- Les allégations des marques citées (6 millions de commandes, 93,6 % de satisfaction) sont rapportées comme techniques de persuasion, pas comme faits — la distinction n'est pas toujours claire dans son propos.
- **La récupération SMS automatisée telle que décrite est problématique au Canada** (voir §7).
- Aucune source pour la règle « 1 seconde = −7 % ».

---

## 10. Transcriptions intégrales

Les six transcriptions ci-dessous sont les **sous-titres automatiques de YouTube dans la langue originale**, récupérés le 8 septembre 2026, regroupés en blocs d'environ vingt secondes et horodatés `[MM:SS]`. Elles sont reproduites **sans correction** : les erreurs de reconnaissance vocale, la ponctuation absente et les censures automatiques (`[ __ ]`) sont celles de la source. Les corrections de lecture figurent dans l'analyse, pas ici.


### 10.1 — Vidéo 1 : Davie Fogarty Mentors — « How To 4X Your Shopify Conversion Rate (Complete CRO Guide) »

- **URL** : https://www.youtube.com/watch?v=A-7pTamjBIw
- **Durée** : 16 min 56 s
- **Langue** : anglais
- **Source de la transcription** : sous-titres automatiques YouTube (en-orig)
- **Images** : aucune (flux vidéo refusé — voir l'avertissement de méthode)

```text
[0:00] Most Shopify stores are converting at under 3%. If that's you, you're leaving thousands of dollars on the table every single month. Everyone tries to grow their business by introducing more ads, sending more emails, and pushing more traffic to the top of the funnel. But almost nobody talks about the fact that if you simply 4xed your conversion rate, you would take your business from $500,000 to $2 million overnight. Sadly,
[0:25] 99% of brands [music] aren't doing CRO at all. And the ones that are, they're split testing button colors like it's 2019. In this video, I'm going to give you the exact framework that I would use if I was starting CRO from scratch. And make sure you stick around because by the end, you'll have a step-by-step game plan to turn more visitors into buyers this week. So, what CRO actually is and why it matters stands for conversion
[0:48] rate optimization. And it's really simple. It's taking the traffic you already have and turning more of those visitors into paying customers. Most brands, as I said, they don't think like this. They're obsessed with traffic, pumping money into ads, chasing new channels. Alternatively, they just start trying to grow their Tik Tok all of a sudden, even though they've got an existing website. And sure, traffic does matter, but if your site doesn't
[1:11] convert, all you're doing is pouring more water into a bucket that's filled with holes. Here's why this is such a big mistake. Imagine you have 10,000 visitors hitting your store each month. If the conversion rate is 2%, that gives you 200 orders. But if you can lift that to 4%, that's 400 orders. The same traffic, double the sales at no extra cost to the business. That's the real power of conversion rate optimization.
[1:32] The average Shopify store converts at 1 to 3%. The top 1% can hit 6 to 8% or higher. Now, this does obviously depend on what niche you're in, what your average order value is, but that is the average. But here's what a lot of people don't understand is that conversion rate alone doesn't tell the full story. Conversion rate tells you how many visitors buy, but AOV tells you how much they spend when they do. And when you
[1:56] combine the two metrics, you get RPV. Then once you subtract all of your costs, you're left with PPV, profit per visitor, which is the metric that really matters. If an optimization doesn't increase RPV or PPV, then it's just noise. A 5% conversion rate might look impressive on paper, but if it drives down your average order value and it
[2:18] increases your cost, you're worse off. So, focus on RPV and PPV because they're the things that are going to keep the lights on. The other thing to consider is don't focus on these just for this month. Think about it from a lifetime value perspective. So, why isn't your store converting and what the great brands are doing instead? Most Shopify stores fail at CRO because they're built like old school retail sites. They're
[2:41] making mistakes that instantly kill trust and stop people from buying. So, what are some of these common mistakes? The first is inconsistent branding. You click on an ad and land on a site that looks completely different. Colors clash, fonts don't match, and the whole experience feels slightly off. This is a lot of the drop shippers out there. Then, we've got weak product info, such as no sizing charts, no shipping
[3:03] timelines, and no clear explanations of the benefits of the products. Then, we've got too much or too little text. It can definitely go both ways. Some stores drown you on copy. Others give you one line and a blurry photo. Either way, customers aren't going to trust that. Then we got fake urgency, which can, you know, urgency can be a great conversion rate boost, but if it feels disingenuine, it's not going to help
[3:26] you. Another one, which is really bad for early stage brands that have just gotten started and don't have photography, is low quality visuals, such as blurry photos or generic stock images that make your product feel cheap. You want people to see the product and instantly go, I know exactly what I'm buying. I know the fabric color. I know how it kind of fits, how like this top right now, you can see because I'm in video, you can see
[3:49] exactly how it fits. If they had a blurry photo or they used a blurry video, you wouldn't build feel that trust instantly. Next is cluttered navigation such as this one where there's just so many different options as well. You really want to simplify that as much as possible. What do the great brands do instead? I'm not sure we should have used Udy here. There's plenty of great brands, but we do do
[4:11] this quite well nowadays. We've got consistent branding. You can see this is from an email with a 30% off. Then we've got the exact same branding. The fonts and the vibe, the photography feels the same on the actual header image on the website. We've got clear product info. We've used these iconography down here to just describe the product details, which people don't even need to read
[4:34] that. you can just see the icons and know exactly what it means. Then we've got real offers, genuine discounts, seasonal campaigns, and bundles that they actually add value instead of gimmicks. Highquality visuals. We spend so much money on photography to make sure customers know exactly how soft the product really is. Then we got simple navigation, which truthfully this is an art. I don't even think our navigation
[4:55] is as simple as it could be, but it does get hard when you have lots of products. The truth is most of you probably don't have lots of products and you can simplify yours a lot further. So what's one of the main things you can do to get way better conversion rate? I would fix the offer first. The biggest leverage point in CR is your offer. Getting this right is what takes a brand from 500K to 2 million. When I say offer, I don't just mean the product. I mean the full
[5:19] package such as the price, the bundles, the upsells, even something like a guarantee. Even the way you position the value. All of these things together is what makes someone decide whether it's worth buying. But most brands don't think about their offer this way. They simply think about gut feel and they just copy and paste exactly what the competitors are doing, which is the worst thing you can do. You need a unique offer. CRO is all about testing,
[5:43] measuring, and adjusting. So, what happens if your price is $1 higher or $5 lower? You won't know until you run the test. Even the smallest changes can shift your revenue and profit in a big way. Think about it. If you sell a product for $50 with a 2% conversion rate, that's 100 orders per 5,000 visitors. Now, if you raise the price to $55, the conversion rate might stay
[6:06] exactly the same. In fact, we've actually increased the price and it's gone up, which is crazy. That's an instant 10% lift in revenue without more traffic. Or maybe the conversion rate dips slightly to 1.8%, but you're still generating more total revenue because every sale is worth more. you're probably delivering way more profit as well because to facilitate those orders, it's far cheaper. You've got less
[6:28] customer service. You've got less operations. The product cost itself is a better percentage of revenue. So, for example, 5,000 visitors at 2% conversion rate and $50 AOV is $5,000 revenue. The same 5,000 visitors at 1.8% and $55 AOV is $4,950. Almost the same. Next thing, we've also got a pre purchase pop-up upsell, which
[6:51] can also work. It's similar concept, but before the checkout, it'll pop up and it will be a far more obvious experience. Then we've got post purchase, upsells, and downells. In Daily Mentor, we've got a great partner that we work with. the customer will actually complete the order. And then on the next screen where it's the thank you page, there's another really good offer and offer sequence
[7:13] that can drastically increase the profit per customer that you've actually made. Because each customer, you've already paid the customer acquisition cost. Now, it's about just getting as much value from that customer and providing great offers for them to make it more profitable for your business. The next thing that we've got is bundles and varants, which a lot of people don't understand. The first is multiacks with small discounts which you can see here.
[7:37] I think this is true classic where they're just adding multiple of the same products. If you've got anything where someone will need that, I highly recommend testing that. Then we've got premium or deluxe versions. I've seen people doing this with like diffusers where one would have sound and beautiful smell. One just had the beautiful smell and you it was all on the same product page, but just simply adding those other offers drastically increased their
[8:00] conversion rate. Then we've got decoy pricing. I don't really know about this one. I don't really recommend it, but it does work and a lot of people use it where there's like good, better, best pricing and you want people to take the the most premium option cuz it's so packed with so many features. So, next up, we've got test, iterate, and repeat. Once your offer is dialed, your work
[8:22] isn't over. Zero is never finished. Market shift, customers preferences change, competitors copy you, and more importantly, behavior changes. When people see a certain unique offer or a certain, you know, user experience on a website, such as like a way that you sign up for emails, and they see it over and over, sometimes it loses its impact because people are just so bored of it.
[8:45] So, you constantly need to test it because what worked last year won't necessarily work this year. That's why the best brands treat zero as a process, not a one-time project. Test one variable at a time, such as price, your headline, call to action, upsells, your bundles, all of that kind of stuff. and never all at once. Otherwise, you'll never know what caused the change. One small focus gives clarity. And make sure
[9:07] you use the right tool. I highly recommend Visually. I've talked about me being an investor with them, and I think that they're amazing with a drag and drop editor. Now, one thing's for sure, you don't want to over complicate tracking. A spreadsheet works when you're small. As you grow, move into dashboards to see patterns faster. Now, here's one concept that blew my mind when I learned it. One test might add 10%. Another one adds 15%. And then another one adds 20%. On their own, each
[9:32] feels small, but together the gains compound. Suddenly, you're not at 45% better, which is just adding each of those numbers. You're two to three times better because they're all multiplying together. And that's the snowball effect of CRO. Small wins stack until they transform your store. And this creates what I call the CRO flywheel. Every win, every better product page, smarter offers, smoother checkouts. These boost revenue and boost profit per visitor.
[9:56] Efficient ads free up budget, scale, more tests, more wins, more growth. And this cycle will just continue. Next is we got build trust and handle objections. Once your offer is strong and you're testing one thing at a time, the next step is trust. Because even if you have the perfect price and bundles, if people don't believe you and still have doubts, they won't buy. Obvious one is reviews as proof. People buy from
[10:19] people. Numbers and logos don't convince anyone anymore. Real customers do. The right review can definitely do more than your creative copywriting. And the best reviews don't just say something like, "Great product." They speak directly to the objections running through a buyer's mind. Use this framework to spot really great reviews that you can highlight. At first, I thought X, but actually why because the customer is already thinking
[10:41] the exact same thing. So, for example, at first I thought the bands would rip, but they've lasted months of daily use. Another example, I thought the blanket would be too hot, but it's the perfect weight for all seasons. When written this way, reviews act like pre-art and FAQs from real people. They let new customers see that others have the same fear, and those fears turned out to be wrong. The next thing is mining objections. So, don't wait for these
[11:04] objections to appear in your own reviews. Go digging for them, such as Amazonar reviews. Even if it's your competitors, Tik Tok comment sections, Reddit threads, all of these things are gold binds and that's where you'll see the truth about your product and the truth about the objections that people have for your product. So, what do we do with all of those objections? We can bake them directly into your product descriptions, drop them in your ad copy,
[11:26] or even use them as pinned comments under your creatives. Instead of hiding the objections, tackle them head on. Then, we've got policies as trust signals. One of the fastest ways to destroy trust is hiding your return, refund, or shipping details. If people can't see them, they assume the worst. So, don't bury them in a footer. Put them right on the product page directly under your ad to car. Simple lines with free returns within 30 days or ships
[11:51] within 3 to 5 business days instantly reduce the risk for the customer. And the result is you'll get a higher revenue per visitor. Next, we've got user generated content. UGC can boost conversion rate by up to 30% alone. Why? Because people buy from other people. Unpolished photos, Tik Tok reactions, raw customer videos. You can put these because they're seeing them as ads. You
[12:12] can even put them on the product page underneath the ad to cart or as their own section. They feel real. They feel authentic and answer people's questions such as, "Do people actually use this product?" Then we've got layering trust across the entire journey. The customer journey isn't just your product page. It starts the very second that they actually land on your site. It actually starts even before that. It starts when
[12:34] they see your creative on Facebook. In less than a blink, about 0.05 seconds, they decide whether they can trust you or not. This is what I was talking about before. If your branding is inconsistent, your homepage feels unclear, or your site feels a little bit scammy, they will bounce. So, make sure your branding is consistent. Do things like make sure your Instagram even matches the branding. Make sure your story highlights on Instagram all match
[12:58] the same thing cuz people will just go dive deep trying to find a reason not to trust you. And remember, not everything NCR needs to be tested. These things are just common sense and you just want to add them because they will build that trust. Next, we've got smooth shopping experience. I'm sure everyone has an experience where they go onto a website, it's really really overly designed or you don't know what buttons do what.
[13:21] You're clicking on things and they're not even buttons. If it's clunky and confusing, what's going to happen is the customers [music] is actually going to burn calories trying to think. And people don't want to burn calories thinking about stuff. Our bodies naturally try to prevent ourselves from doing that. So, you want it really streamlined. You want to copy really, really basic websites, really top sellers in terms of how their website
[13:44] works and make sure every button actually clicks through. Then we've got homepage must show value immediately. So, your homepage has one job. clarity, value, and direction. Too many brands bury their products under lifestyle content or brand fluff. The homepage turns into a lookbook rather than a store. Instead, feature your key products front and center. Add a banner that communicates your main offer, such
[14:09] as free shipping, a seasonal sale, a bundle deal, or even if you're a brand new brand. It should just explain exactly what you sell and the solution that you solve. So, how do we make that happen? The hero section of your homepage is your first and sometimes only charts to answer those questions. Start with a clear headline, tell you exactly what you offer. Add a sub headline that explains why it matters to them. And then show your product front
[14:32] and center in the hero image. And give them one obvious action like shop now. That's the direction that we're talking about. Then we've got the PDP, which is product detail page. Your product page has to do three jobs at once. Inform, persuade, and drive action. miss one and the sale is going to die. It should give the buyers the key details to need to persuade them with proof and clear benefits. And then they should simply
[14:56] take action. You want swatches that make colors and sizes easy to choose. We've got the type of pajamas such as warming and cooling. So that might even just be a style. It might be striped or polka dots. Then we've got sizes as well. It's very black and white about what we're actually selling and they're selecting. You want benefits written in short, clear lines so people can skim quickly and the essentials such as sizing,
[15:19] shipping, and refund information. And the copy itself should never feel heavy. Instead of long, messy paragraphs, break things into sections, but open as you scroll. That way, the page feels light. This is called an accordion. You can set this up in any theme builder and then click it and expands the copy if it's relevant to them. We've got the cart and checkout flow. This is where most sales die. This is the final strategy. You
[15:41] spent so much money, time, and effort to get them here. How do we make sure that we optimize it? We want them to be able to review. We want to reassure them, and then we want to convert them. The biggest mistake here is forcing customers onto a separate cart page. That extra step adds friction and confusing. The fix at the moment is use a slide out draw cart so shoppers can go straight to checkout. The easiest way to
[16:02] do this is hopefully your theme builder already has it, but you can use other Shopify apps as well. And once they're actually in the checkout stage, make sure you've got all the payment options such as PayPal, Apple Pay, Cler, Afterpay, because a slow, clunky checkout without lots of options doesn't build trust. And make sure if you're selling internationally, you've got auto detect currency and language. Don't make buyers do the math themselves. You can
[16:25] easily get simple apps to autoconvert this. And you can set up with Shopify Markets with just a few clicks to give the user the best user experience. I hate purchasing things in USD if I'm actually based in Australia because I don't actually know if the website is even operational in Australia. I want an Australian seller in Australian dollars. And that's what you should be passing on to your customers, that trust and
[16:47] connection. If you like this video, I filmed completely free guides about how to take your brand from zero to eight figures. It's on YouTube. Go check it out now.
```

### 10.2 — Vidéo 2 : Michael Bernstein — « How To Increase Conversion Rate On Shopify (2025 CRO Guide) »

- **URL** : https://www.youtube.com/watch?v=kLneJKAqRtk
- **Durée** : 10 min 33 s
- **Langue** : anglais
- **Source de la transcription** : sous-titres automatiques YouTube (en-orig)
- **Images** : aucune (flux vidéo refusé — voir l'avertissement de méthode)

```text
[0:00] this will be a full no [ __ ] guide on things you can do to make more money on your Shopify store in other words increasing your conversion rate in our case we have a 7.4 conversion rate on the store yesterday which made 5K in one single day this is three times higher than the industry average and this means that out of 100 people who visit our
[0:22] store 7.4 people buy that's very high and this is also part of the reason why yesterday we made $3,000 in pure profit with this product alone so the question is how do we do that well first things first I have to emphasize here that the design of your store doesn't really matter that much it is not connected to how we designed the store how the logo looks and also how the coloring scheme
[0:46] is we've split tested all these things and we noticed a good logo versus a bad logo doesn't really change anything so what actually makes more people buy well it's basically the offer the main thing you can do is change up the offer in a more compelling way to get more people to buy probably the single most important split test you always have to be doing is your product price if you
[1:09] are selling your product for let's say $29 you just assumed that that is the best price you don't know if $31 or $28 is going to perform better so that's something you have to split test and the ideal way to do that is just add $5 and you subtract $5 so if you're selling something for $29.99 you're going to split test $34.99 and $24.99 and then you just generally see what makes you
[1:32] more money and then you can just adjust because $1 differences matter a lot the best way to do this is the app called intelligence AB testing it's one of my favorite apps and we're constantly using it because what it does is basically it sends 50% of your traffic to one website and then 50% of your traffic to another one and then you can just do one single change in there so for example the price or the headline or whatever it is so the
[1:54] main objective you should be having is not guessing anything the first thing you did was just randomly price your product somehow you did free shipping you did one certain upsell you did one certain price you priced your upsell in a certain way these are old guesses right that's good but you have to change it up to see if your guess was good or bad obviously but none of you guys are doing that which is wild to me and the
[2:16] second thing I noticed what most of you guys are doing is you have a product price let's say $49.99 and then you have free shipping and then maybe some of you guys have like a post purchase upsell so after somebody bought you offer some them something else and that's basically it you would be shocked on how much more money you can make if you chunk up your price in different segments what you can
[2:39] for example do is you can price your product instead of $449.99 $19.99 obviously if you do that you're going to have way more at to cards now profit margins are going to drastically decrease if you only do that well that's why you don't only do that but you do a few other things which is for example you add a checkbox upsell on your product page which is already automatically checked on for let's say
[3:01] $4.99 if a checkbox is already checked on 70% at least take that checkbox because that's the path of least resistance they don't have to press anything it's just already in their cart and they buy it this is something which works incredibly well then on top of that you have a pre- purchase upsell popup for let's say $9.99 and if you do that right you can very well reach up to a 50% take rate which means that you're
[3:25] going to add another $5 on average onto your average order value and if you compare all of that with a shipping setting for like $4.99 or $9.99 or something along those lines and then also have another $20 postp purchase upsell and then even have a few downsells after that you're basically going to have the same average order value as on the first example but you're just going to have so many more sales because people are in this yes Loop they
[3:49] already took the product might as well buy this extra one small thing most of you guys are not chunking your price along the funnel but you just want to have the money right away from the product price which a lot of the cases it's just a mistake and in rare instances that is the best way to do it but you don't know that because you didn't split test both if you're making money with your Drop Shipping Store it's just ridiculous to just keep the same
[4:12] offer as you had in the very beginning till the end that's insane and again these are the things you need to be split testing not your [ __ ] coloring scheme design starts to matter after you make 100K a month after you do that go ahead play around with your design because don't get me wrong it's going to increase the conversion rate a little bit and on 100K month that actually can make quite a bit of a difference but in the beginning it doesn't matter the next
[4:34] thing is your reviews and here it's very important to handle as many objections as possible my favorite framework is this one at first I thought X but it is y so what's the goal here well at first I thought some common objection if you're selling resistance bands you're going to say at first I thought they're going to rip super easy or they're going to leave Blue stains on my shirt
[4:57] whatever the common objections are you to say that's what you thought but it is the dream outcome but it actually never ripped but it actually never leaves stains but it actually never feels weird on my skin or doesn't leave rashes and how you find these things out is by looking into your Niche and searching for bad reviews from other products so for example if you're selling resistance bands and you go on Amazon and sort
[5:20] everything by one star reviews you're going to find out really quickly what the most common things are which people have experienced think about this people are usually not the first time purchasers in your Niche they already tried a bunch of things to solve the problem which you're solving but now you just come out at them saying all right your product is so much better than the other ones and most likely they got burnt by other products Etc so make a
[5:42] huge list of objections why people are not buying your product ask people you know in the niche what they know about this product and why they wouldn't buy it and a little Pro tip here as well objection handling in reviews is more powerful than objection handling in your product page generally because reviews seem seem a little bit more honest however everybody knows that you can still fake reviews on your product page one layer above that is the comment
[6:07] section so for example if you're doing organic Drop Shipping having good comments in terms of handling objections below your call to action videos is very powerful if you have a big Instagram account and you have a story highlight thing on your Instagram page which basically has a bunch of people handling your objections that's very very powerful if you're doing Facebook ads having a few top comments which handle these objections is very very powerful
[6:30] now the easiest way to do this is obviously the reviews on your product page and you should definitely be doing that but if you can layer in the comment section as well now one more thing I have to add here your website cannot look like dog [ __ ] if it looks absolutely horrible it can actually drive the conversion rates to basically zero because people are going to think you're a scam so make sure the design is semi okay like a 5 out of 10 everything
[6:54] above that is not going to make a crazy difference but everything below that is so make sure it at least looks DEC and just to show you one more example here of how big of a difference average order value and upsells can make in January 2023 we had this store which made around $20,000 exactly one year later our same portfolio company here made $225,000 in one month as well with an
[7:18] average order value of 20 so the difference here was only $4 and as you can see here on scale the conversion rate actually dropped a little bit but because we saw that higher average order values still makes us so much more money because there's no extra product cost we still made way more profit with this and now let me list the top six things you need to be split testing and trying out to make more money on your website
[7:40] number one price very obvious number two is adding oneclick upsell pre purchases onto your website very important the app you have to use here is zipify oneclick upsell our favorite app and by the way none of these apps are going to be having an affiliate link below this video it's just the ones we use I don't need the extra affiliate money it's not about that I want to stay honest this is just literally the best app for
[8:03] upselling out there then the next thing you need to do is add variance whenever you're selling some sort of product which can have a premium version you should always use that we saw that so often where you just have the same product but basically name it some some premium version of it and have a little change in there that you can just upcharge $10 $20 and some people are going to take that so make sure you have
[8:25] different varant for different prices and sometimes if you for example see that everyone is taking only one variant then make sure all the other variants are going to be three times up marked in terms of price so the top variant looks like it is actually discounted nobody trusts discounts anymore if you have a 50% off thing nobody trusts that however if there's five versions on the product page four of them cost $100 one of them
[8:49] cost $50 that's something people trust and they feel smart for getting the good deal but in reality you're the smart one who made that look like a good deal so making Mak sure your split testing variance on the product page crucial next is adding bundles just incentivize people to buy multiple Pieces by giving them discount if they do that either you use bundle bear or you use the shrine
[9:11] theme both of those are amazing and you should be using either one of those the next thing is add a checkbox upsell so here it's very important that the checkbox is going to be pre-selected already super crucial because every time somebody has to click something less people are going to do that which app you should be using here either you're going to be using X checkbox or you're going to again use the shrine theme and then the last thing is just add email
[9:34] marketing if you're already making some money you have to do that as well this is also something which is very very underutilized and most people just don't do that ever now if you're already making money with Drop Shipping for me to help you is going to be the easiest thing in the world because I'm just going to look at your store I'm going to tell you a few changes you should do and I guarantee you wouldn't do them by yourself I'm going to tell you exactly that you're going to change them you're going to literally make more money out of every single sale and that's it all
[9:58] right very very simple and obviously we're going to help you with scaling and all the other things in terms of how to get more traffic onto your website as well but it's the easiest thing in the world to help an advanced person now if you're a complete beginner and you're not currently making Drop Shipping money we have the most beginner friendly system to make your first $10,000 online there's nobody out there who has more case studies than we do who got people
[10:20] from zero to the first $10,000 in profit per month on a consistent basis so it doesn't matter if you're a beginner or Advanced click the link below sign up for a call and we're we're going to see if we're a good fit to work together in our one-on-one mentoring program
```

### 10.3 — Vidéo 3 : Convertica — « 7 eCommerce Conversion Rate Optimization Fundamentals »

- **URL** : https://www.youtube.com/watch?v=hb-qAAfCSPc
- **Durée** : 10 min 46 s
- **Langue** : anglais
- **Source de la transcription** : sous-titres automatiques YouTube (en-orig)
- **Images** : aucune (flux vidéo refusé — voir l'avertissement de méthode)

```text
[0:00] is your website not converting as well as it should well today we're going to go through and look at some reasons why websites convert what are the trust factors on a product page or a landing page that make users buy so we're going to go through and look at some huge websites that everyone will know we're going to break them down to show exactly why you trust them what elements have
[0:22] been shown that you instantly trust to put your credit card in on the checkout page to buy their products but you've done everything that you think you should do you've made your website fast you've got high quality images you've optimized your titles your descriptions and so on but your website still isn't performing at the levels that it should and this is going to harm you in a few ways you're either going to be
[0:43] spending way more on google ads or facebook ads and you should because the visitors coming to your site are liking your product they're clicking over to your product to see exactly what it is you're offering but they're not quite sure that they should trust you and they're not quite sure that you are a credible source so we're going to we're going to go through and look at some elements that will help you improve that
[1:05] but also all this seo work you're doing you know all these hours and hours of writing content getting ranking on search engines on every visitor that comes and doesn't end up in a sale is a lost opportunity here at convertica we've worked with hundreds of e-commerce websites now and we see the same problems all the time a lot of websites are so easy to set up these days on shopify on wordpress a lot of people are doing
[1:29] it for themselves but even people who don't do that do it for themselves are using developers that don't have a a marketing skill or a marketing mindset when they go into creating these these websites so they're usually easy to use they're usually fast loading and they're usually quite intuitive and they have nice ux but they're missing a lot of these credibility indicators that build trust make it easy to buy and help
[1:53] you to push users into a conversion so we're going to jump right in and have a look at some some well-known brands and show exactly why they're converting how they're converting and what makes you trust them instantly when jumping on their website so now we're going to go through and look at amazon because they're the best in the game they they
[2:17] have an inbuilt split testing algorithm that's always testing so these elements have been proven across huge amounts of sample data and we can have a few takeaways on why they're converting and you can see what elements maybe you're missing that you can add to your e-commerce website to optimize your conversions build trust and make more sales so first off of course we've got very high
[2:43] quality product images showing everything about the product showing what's in the product very clear outline of what the product is how many you get now this is super important having review stars directly below the title is absolutely huge every client that we we add this to just below the title has an increase in conversions because
[3:06] instantly it builds trust and credibility if you have two uh 22 913 ratings that are that high it also will increase your conversions to obviously or even a few hundred or even 50 or 60 are better than better than none but having more reviews and more ratings and of course you can click that and go down to the each individual review and of course the positives and
[3:29] negatives are both here but having this right here most people won't even click just that showing the four and a half or four point three out of five um having the full ratings and then having these unanswered questions is huge too if you can build out these answers and questions um on your website that'll be huge too of course this will take time but it's similar to a faq
[3:52] right it's frequently asked questions they've got people answering the them and allows them to not have to get in contact with the seller if you can answer all the questions on the landing page that'll do really well for conversions too and on top of that the amazon choice has been added which further builds credibility and
[4:16] some other really high converting elements that we've tested on on different e-commerce websites too is these buttons these these type of buttons work much better than pop down lists or lists where you you click them like here and then you can select the the option especially when you don't have a huge amount so if you have below
[4:37] 5 even below 10 it's worth testing just having them all laid out next to each other has a higher conversion rate which is what they've done all the product data all the product images and a bit more about this item of course they can go down if they want to read more and see the full sales content the reason that amazon has put this way down here is because
[5:01] to be honest most people don't read it i can't think of the last time i went all the way down and read a product description but it's there because there are people obviously that need to know more and again more data more information uh and so on and then the reviews so it's a really high converting product page so we'll jump on to uh we'll jump onto another really high converting landing page
[5:24] again these guys have so much data we might as well learn off the pros so apple does a great job at setting up minimal landing pages and then although it's subtle and you may have not noticed it these things have a really high impact on conversion too these are called credibility indicators so fast free contactless delivery and free and easy returns because it reduces
[5:51] anxiety because you're going well you know what if i don't need it or don't want it or maybe you're giving it as a gift and the person doesn't actually want the product this reduces that anxiety and then on top of that they've got a nice little very subtle have any questions about buying an iphone chat with a specialist now if you have enough traffic and have enough um have enough volume of visitors where
[6:14] you need to put someone on um to answer these you can do that but there's also services available where they can you can have them manning the the message the message boxes 24 7 to to help the users answer questions and so on so there are services out there
[6:37] to do to do that i was also while researching for this video i found this website while it has actually a pretty horrible product page there's one really cool element that if you have a really low cost product and a high margin product you might want to try this out so they've got to try a sample section on on their website just below the add to cart
[6:59] that if you're not quite sure that their product is exactly what you want they actually send you out a sample to win you over which is really cool i'm sure that when that arrives that comes with sign up information to try and hook you in there but they've obviously worked out that giving away that's what what's called a lost leader so it costs them money to try and sign you up actually ends up actually ends up making them more money
[7:23] in the long term which is pretty cool now on top of on top of adding you know these these high converting elements to your e-commerce website having an about us page can be really important too especially in this day and age if you're a a a business that isn't well known and no one really has any trust for you yet building out
[7:45] an about us page that's super credible can help with conversions too so zendesk pretty well known support desk crm platform has done a really good job at building credibility and i'm going to take some of these things away and split test them on our own web page because these are fantastic aside from the text um we're people people they've got all their staff multicultural staff or people of all
[8:08] different races showing that you know they're diverse and they they don't discriminate which is really cool for conversions and then um oh here it is here too diversion and diversity and inclusion we're good neighbors let's get together and this is really cool they go through and show different metrics they've got 160 000 paid customer accounts 4 000 global employees 160
[8:32] customer countries and territories 38 000 global volunteer hours just building credibility over and over again with high quality real photos non-stock photos which builds a lot of credibility too and all of these things together help to build a real positive representation of this company and then once you go to the product page
[8:54] if you have you know people have already been won over by your vision your your ethics your morals and so on they'll be much more likely to buy into your story and into your into your product so there's plenty of on-page elements that we've gone through that make for a high converting ecommerce website but it's all about having it's all about painting the real picture of your company
[9:16] it's all about having professional website high quality photos don't use stock photos if you can obviously if you're a startup and you don't have a team yet you may have to use maybe cartoons or stock photos to to build out the about us pages and so on but in order to convert well you need to tell your story you need to be able to
[9:38] communicate your products correctly to your customer people aren't in stores touching feeling the products you need to be able to communicate that message through to them over over your website now i've just gone through a bunch of on-page elements now the things that i haven't spoken about make sure your website loads quickly make sure that you have high quality photos make
[10:01] sure that your titles are well written having having good product descriptions work well but we've noticed that above the add to cart button and below the title of the product just having three to five points and features and benefits about your product is enough and if people want to read more they can scroll down and read more but most people just want a quick
[10:22] summary but if you're looking for a company or service to do this all for you jump over to convertica.org and we'll go through and do a conversion audit on your website and show you exactly where we think we can increase conversion rates and we'll go into detail and give you the full strategy for that absolutely free so if you'd like to take us up on that jump over to convertica.org
[10:44] and we'll chat to you soon
```

### 10.4 — Vidéo 4 : Samuel Larsen - eCommerce Optimization — « The Ultimate Guide to Shopify Checkout Optimization (100% Free Methods) »

- **URL** : https://www.youtube.com/watch?v=aeUJw_ectUQ
- **Durée** : 14 min 57 s
- **Langue** : anglais
- **Source de la transcription** : sous-titres automatiques YouTube (en-orig) — qualité dégradée
- **Images** : aucune (flux vidéo refusé — voir l'avertissement de méthode)

```text
[0:00] hey there Samuel Larson here from Cruz I'm going to share my best Shopify checkout optimization tips on this video and we're going to cover the methods that don't cost you anything that are really doable in 15 minutes so we're just gonna keep it super actionable I'm gonna jump into it right
[0:22] now and let's get started so obviously first things first the Shopify checkout is this part right after the cart where you have the steps information shipping and payment now this is a standard one this is the known plus sorted on advanced one you cannot customize so
[0:47] what you can do here is just go the themes and press customize from here you can edit all the basic stuff we're not going to cover them too much here but just make sure that your forms match the site and that your bottom colors are the same throughout so every single color here that is leading to the sale should
[1:11] be the same so don't have orange here for example if at the rest of your site is blue so that's to make sure that the experience is consistent obviously you want to change the logo as well so you'll have actual logo here and not just text you'll need to upload it separately so it won't naturally pull
[1:35] from your Shopify logo from the main navigation remember the way you get here themes customize and then just select the say check out from the left-hand side here so you go theme settings check out and here you have the options so it's pretty much the black and blue here
[1:57] you can set colors the heading type of Rafi and false cool so once we have done that let's jump into a little bit more fancier more advanced optimizations that you can start worrying about once you take care of the basics so one of the problems with the shop if I check out this that you cannot build phone numbers
[2:22] and emails into it so there's no room for support emails here what we did with this client is we added a telephone and an email to this account and from here they can see that if they have questions it's just a little confirmation that oh they are here they are here to help and
[2:46] when I suggest these to my clients they always ask okay what if people call and do my answer to that is just let them like you can have that go to voicemail and if you want you can return that call but you don't have to be there all the time and an easy way to get a phone number just to get a sighs Skype school
[3:09] subscription and from there you can have the phone number relatively cheaply you'll get all the voicemails - you know or Skype basically this is also a way to get to know a little bit more about the customers concerns and also a good way to convert those hire endorsed offers
[3:34] because let's say you have a really high-end product thousand bucks or something people probably want to call to make sure that the store is legit and from there you can call them back and you have an opportunity of salsa that's a my view that's fantastic when it comes to the Express Checkout option here I definitely advise that you
[3:57] do at this payment gateways because they are also thrust signal for people and we check out you definitely want to emphasize thrust as much as possible so at least PayPal and Amazon pay are good options cheap a people need usually use that so you'll see like maybe 0.2% of people actually used it so you might be
[4:21] better off at least for now just using these two they achieve same thing basically with the less choice another thing with Shopify check out that I personally love is these little boxes here so you can have all your policies come up like this and if a customer has a concern or question they are not taking
[4:47] away from the checkout so just make sure that you have these and make sure that they are clearly laid out so they are readable they are well structured like here and people can just ideally the scroll browse through them look over them briefly and get a good idea of what are the terms what are the conditions
[5:13] then next let's look at the fields data you should show now generally the list fields you show the better because when a customer looks at it this view here they don't really want to start feeling all these pills and even if they're optional they still look like more work so in general I always advise people to
[5:40] remove for example company field it does not necessary and to fill in to check out even if it's optional so the last fields we can have the better but it's also the least fields that we can get away with so we still need some fields so these are my recommended checkout settings that we have found that work
[6:03] best for the customers and we found a good reason behind it and tested tested these do increase the conversion rates so customer accounts definitely should be disabled and these are things that you can find with the second settings and check out tell you when to stop go and edit them right now customer contact
[6:28] this is a good thing to harmone so just there it doesn't really matter that much the these are the most once so you'll have the forum options typically it feels better to also add your first name even if it's like one
[6:52] thing that you have to add it still confirms that okay it's going for Samuel instead of Larson so that's that's a nice thing to have just a little psychological confirmation that it or this package knows where it's heading good company names usually hidden especially if you don't have a b2b business then others lines optional so
[7:19] sometimes people do like to add that second line but it's either hidden optional or they're fine and this one last one is also one where you can go both ways I'll show you soon if you do choose optional why that would be important to modify the language a little bit so there you have it for
[7:45] those fields and then I would definitely use the shipping address as the billing address and enable those other completions this is up to you basically and that's about that for email marketing you want to have it pre-selected it's a little bit sketchy with gdpr usually but you're unlikely to
[8:10] get punished for it so I just recommend to utilize the gray area here a little bit because you do want to have these people on your list and it's oftentimes huge difference if you make people opt out versus making people opt in so you don't make them take that box make them
[8:36] on tip top box in order to get most emails and definitely you should have the abundant card emails in place now there's an interesting thing here in the beginning then you have the checkout language and once we click this button we get taken to a page like this and on this page we can edit some of that
[9:00] default language so we have to check out on system and this is where you will find all the texts than are in that check out now there's a few things we can do with this but basically here's my suggestions in general you don't want to go for anything that is too outside of
[9:26] the norm so people are used to shopping a certain way and they expect a certain type of experience and anything that is too outside of that experience can cause friction can cause distrust so here we have the payment and we scroll
[9:55] down we have the title payment now it's a little bit of a cheeky techie act but you notice that if it has changed this secure payment we get the tiniest tiniest conversion boost it's a principle that works in a subconscious level so sometimes people suggest that
[10:20] you should put all kinds of trust signals to your site but if you emphasize trust too much then people get overly conscious about security and once they're overly conscious about security they are also concerned about risks but if you can subtly hint it that this is a secular thing to do things a lot more
[10:44] powerful and this is where these kind of titles can be helpful next thing we have is our phone and emails so let's go and filter by phone and from here you'll find that you have the option of whole label and you have the mandatory phone label so here shipping line phone on
[11:08] label so mobile phone number required is the default text now here under this or after this required you can test that type mobile phone number required for shipping confirmation or required for delivery you give that person a reason
[11:34] to fill that in and they're much more likely to do that same for email but instead of it being for shipping phone numbers for shipping that makes sense the delivery guy might call you but for email that will be required for the order confirmation so the same exact principle works now we have covered the
[12:02] step one of the out so the information start now there's two more and the next one is shipping so well do here is just a fill in some details and on page two we can find these so these are good but I have very little idea of when do these products
[12:27] come to me and that is what we could cover here we have control over each shipping method names and we can check them out here so you have the shipping and here you would have the options for that shipping so what you can do here is just edit them in to the name so here's
[12:54] tactical baby girl calm they have a Shopify Plus account so they are able to showcase this but what you can do is just have the name and put the times in brackets hundred or after it so you'll have the same information won't be as
[13:17] pretty but it conveys to the people that are checking this out when we like it my package and there will be a lot more comfortable after that to proceed to this checkout or to continue the payment and then on this last secure payment section it's basically where the magic
[13:42] happens now it's just about getting out of their way providing all the options that people want to have and collecting the money enjoying your successes in e-commerce merchants and celebrating your victories now that's it 15 minutes of e-commerce optimization tips for record or checkout
[14:07] and this is the most important phase so I hope that it was helpful that's all my experience in five years at shopify ecommerce consultant and crowd optimization now make sure to subscribe the channel I want to provide a lot more of actionable ecommerce videos for you to watch and you'll get a lot of interesting
[14:31] behind-the-scenes materials of what we as consultants suggest to our clients and see you in the next video thanks [Music] you
```

### 10.5 — Vidéo 5 : Shopify OS - Louis ST — « Comment Optimiser sa Page Checkout Shopify ? (pour la conversion) »

- **URL** : https://www.youtube.com/watch?v=6n98r3YiBOc
- **Durée** : 10 min 28 s
- **Langue** : français
- **Source de la transcription** : sous-titres automatiques YouTube (fr-orig)
- **Images** : aucune (flux vidéo refusé — voir l'avertissement de méthode)

```text
[0:00] comment optimiser votre page checkout pour qu'elle transforme le plus de visiteurs possiblees en client on va voir dans cette vidéo ce que vous devez configurer ce que vous devez paramétrer et toutes les possibilités que vous avez pour augmenter votre taux de conversion et réduire votre nombre de paniers abandonnés à la fin vous saurez tout et vous aurez tout appliqué grâce à moi et à ce que je vais vous apprendre moi c'est Louis je suis professeur sur
[0:21] Shopify et vous trouverez dans la description la checklist de tout ce que vous devez savoir pour créer votre boutique Shopify n'hésitez pas à aimer cette vidéo si il vous plaît et à me demander une page en commentaire que vous aimeriez qu'on traite en vidéo et qu'on optimise ensemble pour que vous puissiez le refaire à votre tour je réponds à absolument tout le monde on se lance dans le vif du sujet tout de suite c'est parti donc comment optimiser le checkout bah en fait il y a deux choses
[0:44] majoritaires à faire les paramètres et la configuration on va voir ça ensemble les paramètres donc une fois que vous êtes dans l'administrateur de votre boutique ils sont juste ici on clique donc ensemble sur Paramètres et puis on voit qu'ici on a paiement et là la page paiement elle va donc se décomposer en deux grandes parties la configuration c'est nouveau hein ça vient de sortir c'est une des dernières mises à jour les plus récentes de Shopify c'est tout ce
[1:05] qui va se passer ici qu'on va faire ensemble et ensuite il y a les paramètres qu'on va faire qui sont ici aussi nous on va commencer par les paramètres ok c'est tous les paramètres importants pour la conversion alors on descend ici méthode de contact client numéro de téléphone ou email moi je vous conseille de mettre email parce que c'est la chose la plus importante la chose indispensable à avoir le numéro de téléphone c'est bien mais c'est du plus ça vous devez absolument le décocher ça
[1:29] va faire peur à plein de gens shop n'est pas utilisé en Europe exigez que les clients se connectent à leur compte avant de payer jamais de la vie évidemment vous rajouteriez une énorme étape ensuite information client là exiger le prénom et le nom de famille c'est beaucoup plus simple pour les livraisons vous aurez moins de problèm nom de l'entreprise vous pouvez le mettre en facultatif moi je vous recommande de le mettre en ne pas inclure sauf si vous avez fréquemment des clients B2B mais mettez-le en ne pas inclure et la majorité des clients
[1:51] professionnels sont habitués à redemander une facture au nom de leur entreprise donc les quelques-uns qui voudront une facture vous la demanderont adresse ligne de là je vous recommande de mettre en facultatif encore une fois pour faciliter la livraison vous aurez moins de problème numéro de téléphone de l'adresse d'expédition là vous pouvez aussi le mettre en facultatif ça aide encore une fois la livraison et ça vous permet aussi de bah de profiter du numéro de téléphone si jamais vous
[2:13] faites du SMS marketing on y vient justement email on va cliquer dessus évidemment he permettez au client de s'inscrire au marketing par email et donc ensuite on a préélectionné ça je ne vous recommande pas de le cocher si vous voulez respecter le rgpd il est interdit de présélectionner pour respecter le rgpd en Union Européenne pour boire les pourboir sont interdits aussi en Union Européenne donc on ne va pas les ajouter ensuite préférence de collecte d'adresse
[2:36] autoriser l'adresse de livraison et la FA de facturation à être différente exiger que l'adresse de de livraison et de facturation correspondent OK et valider l'adresse de livraison nous on va cliquer sur Autoriser l'adresse de livraison et de facturation différente et valider l'adresse de livraison pourquoi euh parce que il est très important que effectivement les gens puisse mettre une adresse de livraison et une adresse de facturation différente hein c'est quand même relativement bien
[2:59] fait ne vous inquiétez pas à la base tout sera fait ensemble et si quelqu'un si une personne a besoin de faire quelque chose de différent et ben il en a la possibilité valider l'adresse de livraison il y a rien à valider c'est pas une étape supplémentaire c'est juste littéralement Shopify qui va proposer des adresses à ceux qui rentreront une adresse justement ensuite script supplémentaire la majorité d'entre vous n'en auront pas besoin et puis en plus
[3:20] c'est obsolette comme nous le dit Shopify ça ne fonctionne plus comme ça et langue du paiement on s'assure bien d'être sur français une fois qu'on a fait tout ça on clique sur Enregistrer et là et bien vous avez déjà fait une énorme partie du travail puisque la deuxième partie hein c'est la partie configuration là on vient de faire la partie paramètres tous les petits paramètres qu'on vient de faire c'est des petits paramètres extrêmement importants pour votre taux de conversion ce sont des paramètres qui vont vous permettre d'avoir des visiteurs qui
[3:44] ajoutent à leur panier et qui passent plus facilement à l'achat il reste des configurations qu'on va faire ensemble dès maintenant mais il faut vraiment comprendre que ce que je viens de vous présenter n'a pas à être remis en question ça va évidemment pour certains d'entre vous qui connaissent un petit peu les spécificités de leur cas euh va évidemment il y avoir quelques petites différences mais c'est uniquement pour ceux qui ont conscience des spécificités de leur cas et qui maîtrisent ce qu'ils
[4:06] sont en train de faire si vous ne maîtrisez pas vous êtes débutant notamment ou que vous ne voulez pas vous poser trop de questions fiez-vous à tout ce que je viens de vous dire parce que pour la conversion ce sera beaucoup beaucoup plus pertinent et beaucoup plus simple euh évidemment ensuite bah là pour peut-être que beaucoup d'entre vous auront mettez à niveau vos pages de remerciement et statut de commande on va cliquer sur examiner les personnalisation OK et là vous allez pouvoir cliquer sur mettre à niveau
[4:27] c'est important de pareil pas trop se prendre la la tête le but hein c'est que ça se fasse assez facilement voilà on a ensuite ici notre page et donc on va pouvoir cliquer sur Personnaliser et là on se retrouve donc dans la personnalisation de la page de paiement il y a pas mal de choses que vous pouvez faire on va donc regarder tout ça ensemble alors la première chose que je vous recommande de faire sur la gauche c'est de cliquer sur Ajouter une image et évidemment hein bien évidemment de
[4:51] venir ajouter votre logo vous pouvez ajouter un logo sans fond comme moi mais c'est pas forcément ce que je vous recommande ce que je vous recommande c'est de mettre votre logo avec juste un rond derrière un rond de couleur qui va avec votre char graphique ça peut être un rond blanc si vous n'avez pas d'idée mais le but c'est de mettre un rond moi là en l'occurrence j'en ai pas sous la main donc je pourrais peut-être éventuellement mettre une autre image mais vous voyez l'idée hein le but c'est de mettre votre logo avec derrière un
[5:14] rond une pastille blanche tout simplement ensuite la largeur on va la laisser ainsi l'alignement du logo vous pourriez le mettre au centre à droite ou à gauche nous dans ce cas-là on va le laisser à gauche position du logo là je vous recommande de laisser en pleine largeur parce que cette fonctionnalité là pleine largeur à l'inverse des deux autres vous permet de mettre une image de fond vous voyez he si je clique sur résumé de la commande hop l'image de fond elle disparaît et sur formulaire de
[5:37] paiement toujours pas d'image de fond alors si je reviens sur pleine largeur on a une image de fond juste là cette image de fond à quoi sert elle elle peut vous servir à deux choses la première chose à laquelle elle va pouvoir vous servir ça peut par exemple être de mettre une image qui va ajouter des badges de réassurance donc vous pourriez créer une image rectangulaire une image horizontale avec des badges de réassurance qui seraient plutôt sur la droite pourquoi ben je vais vous montrer
[6:00] ça tout de suite hop moi par exemple si je choisis ça voilà plutôt sur la droite parce que vous le voyez he si on met en grand c'est plutôt sur la droite parce que sur la gauche en fait c'est même plutôt extrêmement centré en réalité sur la gauche on a un logo ici sur la droite on a la page panier vous voyez bien au centre vous pourriez faire une image avec des logos de paiement sécurisé avec canva par exemple de réassurance de manière générale par contre vous êtes très nombreux à être extrêmement mauvais
[6:23] sur canva on va pas se mentir peut-être que vous en avez conscience vous n'avez absolument pas la patte d'un designer et c'est normal quand on débute on n pas la pâte d'un designer on n' pas la pâte de quoi que ce soit donc si vous voulez faire ça faites-le le plus simplement du monde faites vraiment quelque chose d'extrêmement simple mettez des badges qui soient cohérents entre eux qui soient pas trop chargés qui soient tout petit peu épurés voilà des badges de la même thématique de la même collection qui soit identique vous voyez don dont
[6:46] le style est identique ok maintenant qu'on a fait ça on a donc notre image notre logo et là on va pouvoir descendre directement au niveau du fond alors je vous recommande pas du tout de mettre une une image ici jamais de la vie là on est vraiment dans ce qui se passe à ce niveau-là donc vous voyez on va pouvoir cliquer sur ça et on va pouvoir bah tout simplement mettre la couleur de fond de votre boutique je vous recommande de pas avoir du blanc je vous recommande d'avoir votre couleur principale et extrêmement tiré vers le blanc donc moi
[7:10] en l'occurrence ce serait un vert très léger comme celui-ci ok ensuite le fond de bah c'est ce qui se passe sur la droite donc là bah moi en l'occurrence ce serait plutôt un un jaune orangé comme vous allez pouvoir le voir parce que c'est ma couleur secondaire alors là je vais pas chercher véritablement ma couleur hein parce que bah je l'ai pas sous la main mais vous mettez bien entendu votre véritable couleur il faut quand même que ça fasse pas trop étrange
[7:34] ce que vous êtes en train de faire moi c'est vraiment censé être du orange voilà on peut éventuellement faire quelque chose comme cela OK et ensuite la couleur d'accent bah là c'est tout ce qui va être ici he qui est en bleu et cetera qu'est-ce qu'on va faire on va reprendre la couleur qui est ici à droite donc moi en l'occurrence c'est FD 9f2 donc FD 9F et 20 ok et vous allez pouvoir refaire la même chose à chaque
[7:56] fois là moi c'est du hasard he comme vous le voyez vous bien entendu mettez les couleurs de votre charte graphique et vous voyez quand même que tout de suite on est sur quelque chose qui est beaucoup plus intéressant beaucoup plus pertinant pardon ensuite ici entre champ et carte transparent ou blanc et bien nous on va évidemment laisser blanc pourquoi parce que ça ressort beaucoup plus ça permet que les champs qui doivent être complétés soient complétés
[8:20] mieux par les utilisateurs tout simplement mise en page du paiement et ben là c'est peut-être le paramètre la configuration la plus importante de toute votre boutique vous devez impérativement être sur un paiement en une page paiement en trois pages regardez un petit peu la différence donc là on est sur un paiement en une seule page on a toute notre page qui est là le paiement en trois pages qu'est-ce que ça fait et ben ça fait ça on a donc d'abord continué vers l'expédition et après on se retrouve au fur et à mesure he sur
[8:43] différentes pages et le problème principal c'est que ça fait des étapes et des étapes et des étapes et nous et ben c'est pas du tout du tout ce qu'on veut hein panier information expédition paiement ça fait beaucoup d'étapes pour nous donc nous on veut absolument un paiement en une seule page c'est prouvé par Shopify que ça permet un taux de conversion plus élevé et c'est assez évident il y a juste moins de clic moins d'étapes c'est mieux pour tout le monde
[9:06] donc vous voyez l'idée une fois que vous avez fait ça vous pouvez cliquer sur Enregistrer et une fois que c'est fait et ben on va pouvoir regarder un petit peu qu'il faut pas oublier les politiques je vais vous montrer où elles sont ces politiques ça permet en fait de la réassurance les politiques elles sont juste ici et certains d'entre vous peuvent se dire mais comment faire pour ajouter ces politiques juste ici dans le checkout et ben c'est très simple on va quitter ensemble on va descendre juste
[9:28] ici dans politique et vous allez voir que en cliquant ici donc dans politique écrite et bien si vous remplissez vos politiques ici au bout de quelques minutes c'est pas instantané à chaque fois en tout cas moi ça a parfois pris quelques minutes au bout de quelques minutes vous allez vous retrouver avec les politiques qui sont juste en dessous de votre checkout je vous montre ça tout de suite je fais procéder au paiement et je me retrouve tout de suite dans mon
[9:52] checkout personnalisé hein avec tout ce que je viens de faire moi-même et ça bah c'est quand même vachement mieux on est dans quel quelque chose de tout à fait qualitatif quelque chose qui va donner confiance à vos visiteurs bref quelque chose qui va vous permettre d'avoir les ventes euh que vous méritez puisque vous aurez aussi bien travaillé votre marketing et tout le reste voilà donc faites bien les politiques à partir d'ici aussi pour les avoir à l'intérieur
[10:14] de votre page checkout et c'est tout voilà votre checkout est parfaitement optimisé n'oubliez pas de vous abonner à cette chaîne c'est ce qui nous aide le plus et qui va vous aider dans votre aventure sur Shopify on se dit à très vite et je vous invite à cliquer ici pour optimiser au maximum votre page Panier à très vite
```

### 10.6 — Vidéo 6 : Chase Chappell — « How To Increase Conversion Rates on Shopify (2026 Guide) »

- **URL** : https://www.youtube.com/watch?v=daDsoHXE52A
- **Durée** : 32 min 56 s
- **Langue** : anglais
- **Source de la transcription** : sous-titres automatiques YouTube (en-orig)
- **Images** : aucune (flux vidéo refusé — voir l'avertissement de méthode)

```text
[0:00] The average Shopify brand only converts at a 1.4% conversion rate. If that sounds like you, I'm going to show you how to 4x that in 2026. The typical brand tries to scale by spending more on ads, but here's the problem with that. No matter how much you spend, you are already barely converting on that traffic as it is. And if you're doing, for example, $50,000 per month, 4xing your conversion rate would mean you were
[0:24] now over $200,000 per month in sales without spending a single extra penny on paid ads. So, in this video, I'm going to give you my conversion rate framework, where we have audited over 16,000-plus Shopify stores between the three of my companies, which has generated over $2 billion in sales for our clients, where we are seeing conversion rates of 3%, 5%, 8%, even 10% on Shopify. And after I break all of
[0:48] that down, I'm also going to give you the full funnel that we use and install with brands from A to Z for you to copy. Starting with step number one in 4xing your conversion rate. What is CRO? CRO stands for conversion rate optimization. Just like we optimize our ads, we also want to optimize the way our website is converting on the traffic we send it. For example, if you're spending $10,000 per month in ads and that brings back
[1:12] $30,000 in sales, but you only have a conversion rate of 1%, once we optimize that website, if we increase it to a 2% or 3% conversion rate, you are immediately overnight making double or triple the sales without spending any more money on paid ads. In addition to that, your ROAS skyrockets because more people are converting. Now you're spending 10K on ads but are making back 60,000 or 90,000 dollars in sales. This
[1:36] is why it is so important and why big brands like Skims, AG1, Nike, and Apple spend millions per year on improving their conversion rates. And today, I'm giving it all to you for free. So, the first step in this is your website speed. For every 1 second delay, there is a 7% decrease in your conversion rates. So, when we're looking at a brand like Graza, whenever people visit their website, there's a lot of imagery. And a
[2:00] lot of you have images on your website showcasing your product, breaking down how it works. There's a lot of visuals that go into educating people, walking them through every step, showing ingredients, you know, the lifestyle, the imagery. And all of this space takes up time to load. In fact, most stores have the biggest conversion rate drop because of their site speed loading so
[2:23] slowly from the high res images that they upload. And you want high res imagery because it helps with conversions. You don't want it to take away from conversions by slowing down the website too much. Because in today's age, frequency and the speed to being able to access a website is extremely important. If it takes too long for your website to load, people are less likely to check out and complete the purchase.
[2:46] So, what we want to do is make sure all of our images on our website are optimized, so that way we can decrease our website page speed. And one of the easiest ways that you can do this is by going to a tool called Tiny Image Optimizer. And this Shopify app will automatically optimize all of your images, keep them high res, but make them load instantaneously. That way, when people visit your website, all of
[3:07] the images are ready to go, and it doesn't slow down your site, but it also keeps them high res. And this tool, once installed, will automatically make these adjustments for you. And once we do that, this will allow us to improve our site speed, so that way we don't have to worry about friction when people visit our website from our ads. And now that your website is loading faster, step number two in this is understanding your data on the actual website itself. So,
[3:31] here we are inside of one of my clients' Shopify dashboards. And as you can see, they've done nearly $500,000 in sales in the last 30 days, and their conversion rates are going up. They're roughly at a 2.9% 3% conversion rate. And the main metrics that you want to pay attention to when looking to optimize your conversion rate on Shopify is not just your overall conversion rate, but your
[3:54] conversion rate breakdown. Because what the conversion rate breakdown does is it allows us to understand where the drop-offs, bottlenecks are in our PDP and product pages. Because when somebody visits our website, now that we've sped them up, we have more sessions hitting our site, the next step is to understand add to cart ratio. If you have a low add to cart ratio, that points to a whole list of problems. If you are at two or
[4:19] three or even four or five percent add to cart ratio, that means not enough people are seeing your add to cart button, there's friction, they're not being educated, maybe there's no ingredients listed, the model sizing isn't there, the offer or price is too high, which is preventing people from adding to cart, or your buttons are just not that visible and it's hard for them to see. So therefore, you have a low add to cart ratio. Now, if you have a high
[4:44] add to cart ratio, but a large drop-off in reach checkout, that pinpoints a problem where you have drop-off between when they add to cart and check out, meaning it could be your add to cart page. If you're taking them directly to an add to cart page, that can end up having a negative effect because you're now loading a second page. So if you don't have a drawer cart or a slide cart, or whenever they go to checkout, they don't see the complete payment
[5:07] badges or their payment options, they're less likely to go to checkout. Or maybe they see that shipping costs money, or your discounts didn't load properly, and this causes friction. So that's where we'll start to fix those issues. Now, if you have a good add to cart ratio and a good reach checkout ratio, but a small complete checkout, where they actually make the payment, that could point to your actual checkout page. It could be
[5:30] to do with your shipping thresholds, your pricing, the different payment methods that you offer, not having enough trust or review badges, or too slow of a shipping time. There's so many things that go into each of these metrics that we need to understand. And I'm going to be breaking down in this video how to solve for each of these stages. So that way you can maximize your overall sales. So now that we
[5:54] understand what our conversion rate breakdown looks like, let's go find the bottlenecks that a website that is not very well optimized would encounter. So here we are on a Shopify website that is not very well optimized at all. And there's so many different friction points that we can discover and learn from with a store that looks like this. The first is our shipping banner doesn't
[6:17] really stand out. It's on a white background. Our menu items are all stacked up together. And if we look at mobile here, we're not taking up enough space with our imagery. We don't have enough educational imagery. As we scroll down, we have these different curl types. And if you don't know what this is, this can be very confusing. So we don't have enough information on exactly
[6:39] how this works. And then our links were taking up a huge amount of space on mobile right here. I mean, look how far we have to scroll to get to the add to cart. So a Shopify store like this is going to have a very low add to cart ratio because we have to scroll very far down just to find the add to cart. And not only that, the add to cart blends in with the website. It's white on white. And we have this all stacked up. This
[7:02] should be on a scroller. Our pricing isn't very big. We're taking up too much space with our headline. There's so much going on here. We have pop-ups. And by the time we make it to add to cart, not only is it a low add to cart ratio, it then has a pop-up add to cart with no upsells, no guidance. It tells us to view cart. So now we've clicked twice just to be able to see our cart. And
[7:24] then we're taken to a cart page. This destroys conversion rates. And then on our cart page, we're getting a pop-up at the exact wrong time that we want to show something. So now we're in our cart and we have to then hit check out and it's saying 97 cents, which is a little confusing for package protection. Check out without is unhighlighted, which is even more bizarre. And then we have our
[7:46] payment options. So, we have to go through multiple clicks, which is going to destroy our add to cart to checkout ratio. This is causing a lot of friction. And so, when we finally come down here, if we were ever able to make it here as a customer, and by the time we make it to the checkout, we don't have trust badges, we don't have shipping times mentioned, we don't have much information really at all. We see additional pricing and it can cause
[8:11] people to just bounce at this point, too. So, a lot of things are going wrong with this website, which is preventing people from being able to convert. So, if your website looks like this, there is a lot of things that we can improve on to be able to fix your conversion rate and drive more sales. Now, for step number three in this, and it is one of the most important out of all of these. It's understanding the landing page experience from the ad to the actual
[8:35] product page itself. And let me show you what I mean. This is where most revenue is either made or lost. And you want to keep things super consistent from ads to lander, whether it's a product display page or just a product page in general. So, let's look at Graza. So, here we are on Graza's Facebook ad library. We have their colorful branding in their green. We're showing the product. We have
[9:00] headlines, we have emojis. It's very dialed in for their creatives and overall brand. And this is very important because we want people to recognize our brand because it can help increase conversion rates whenever ads are consistent and synergistic between each of our creatives. We want our creatives to be well color oriented and have the right branding between each of them. So, no matter which ad they see,
[9:23] they recognize our brand and are more likely to click through, which drives up our conversion rates because we have more sessions on our website. What's equally important here is whenever we click on an ad, it takes us to the exact same thing. So, what you'll notice is here, you see this product packaging? When I click this, the very first visual I see is that exact same thing. And this is what we call a first load experience. When you click on an ad, your mind is
[9:48] expecting to see what you just clicked on. And when the website loads that exact thing, it validates the very thing that they were looking for, which increases the chances that they are going to move to the very next stage. And so, whenever we have a product page and a PDP page like this, which is for gift shopping, we now can expect the customer to move to the next stage from here, which then has our well-branded
[10:12] site, and all of that same information is being shown here. And when I go to their product pages, it is very well optimized. We have clean and clear images of the products, showing how to use it, actually baking and applying it, what it looks like in a kitchen setting. And this is a masterclass in conversion rates, because we have both the glass version, the squeeze bottle. prefer
[10:35] that, we have quantity order bumps, which is going to help increase ALVs, and this drives higher conversions because we're giving options to people now, allowing them to decide whether or not they want to save money and buy more. We have subscribe and save if they want to put this on an auto-recurring subscription, so that way they don't have to come back to the website and buy every time, which helps increase conversions. We have refill options, and
[11:00] additional upsells, and Graza makes it very easy for somebody to add to cart. With a drawer cart, we see all of the items in our cart, we have upsells in a very clean checkout. The experience is very easy to understand. And then we break down the actual details of how big the bottle is, how it's harvested, how you can use it, as well as the refill options. And when we go down, they go
[11:24] into the details of the ingredients, from where it's grown, how it's made, the distribution, and what the finished product looks like. And then we have recipes showcasing how you can use this because if people don't know what they should do with this product, well, those are objections and questions that people might ask. So, Graza does a really good job of showcasing how they have order bumps, bundles, packs, and subscriptions
[11:48] allowing them to maximize sales and drive higher conversions. And it's all consolidated in one view making it super easy to navigate. Notice how on the other website there was so much stacking and so much stuff going on, whereas Graza makes it super easy to just select everything in one view and check out without having to load another page. Now, let's look at Everyday Dose and how
[12:12] they break down a very clear offer with their hero mechanism. So, from their ad to landing page, we have a very clear offer. 86% off today, get 30 servings, a free creamer, a free week of coffee, bonus gifts. They frame this as a hero mechanism which solves all things in one specific offer. This increases their conversion rate and allows more people
[12:35] to make a decision to buy. Not only that, but we have the breakdowns of $36 refill. We have the skip, pause, or cancel anytime on subscription. We have free 3-day shipping, so that way they know when they receive it. We break down the product in simple steps. We show the ingredients and what's included. And everything they need is all called out. And they have their entire offer all framed right here in first view. You can
[12:59] see all of the deals that you're getting with this making this offer seem almost irresistible to buy. And Everyday Dose does a really good job of objection handling because they break down the credibility from other brands and what they had to say because sometimes people don't just want to hear it from you, they want to hear it from somebody else. And so, they're leveraging credible sources like Tasting Table or Who What
[13:23] Wear which are known publishers at review websites and products. And people trust these brands. And not only that, but they're breaking down how this coffee is beneficial, transforming your mornings. Over 10,000 research publications support the ingredients in Everyday Dose. That's a very credible callout, which is going to build a lot of trust. So, all of these things handle more objections. Over 6 million orders
[13:48] delivered? Well, why wouldn't you buy this product if 6 million other people have? And not only that, but 93.6% of people say they love the taste. 88% of people say they feel a positive impact. Those are pretty trustworthy statistics that make it easier for consumer to make a decision to buy. Because humans, at the end of the day, are like sheep and they move with the crowd and trust
[14:12] others' opinions. And then we break down the benefits of the coffee. Maybe you don't understand why you need this. They break down the taste. What does it taste like? That's an objection. They break it down. What is it going to make me feel like? Am I going to be jittery? Am I going to be mellow? Is it too much coffee? Is it drinkable? They break it down. Then they bring in their customers and allow the customers to do the speaking for them. We're not just
[14:33] showing a review, we're showing the faces of people smiling, using the product, building up the emotion. And then, maybe they're like, "Well, you know, all this sounds great. People are saying they love it, but maybe I'm happy with my current coffee." Well, what does Everyday Dose deal? They break down the objection of why they're better than everyone else. So, you may be a regular coffee drinker and realize that you're
[14:56] not getting collagen to improve your skin. You're not getting gut and brain support. You're not getting 100% real mushrooms. You're just getting maybe some caffeine and a little bit of a vanilla flavor. And so, this allows you to start understanding the key differences between what you're doing now versus what you should be doing. And they continue to break down this offer and they do a beautiful job of showcasing social proof and UGC, which
[15:19] is very important. They're not just showing product imagery. They're not just breaking it down, they're not just putting statistics in, but they're driving in videos that have real-life stories, education, walkthroughs, behind the scenes, and user-generated content that allows people to build up even more trust to buy. Now, let's look at another website that is doing very well in their conversion rate and is on pace to become
[15:44] a billion-dollar company off of what they've done by disrupting the deodorant industry. There are so many deodorants out there, but what Carpe has been able to do is build a funnel that is so high converting that people come in expecting to spend four bucks, 10 bucks, 12 bucks, but come out spending hundreds of dollars and still converting. And they do this by breaking down some of the key features in bullet points and making it
[16:09] super easy for you to pick between the different scents and buy. Because every stick you add, you're getting a major discount, which is incentivizing people to add more. And because you're training the person to be able to click more times and start to build up the suspense of getting all these different scents in their cart, they're more likely to click through. And they have benefit
[16:31] breakdowns. You're getting a VIP discount. It's renewing every four weeks. You can adjust your delivery frequency. You can cancel anytime. We have dermatologist recommended. Apply at night. 100% satisfaction guarantee. These are clear benefit-driven callouts that make it much more easy for people to not only scan, but make a quick decision to buy. And when we hit continue, we have our simple drawer cart
[16:56] where we're claiming free shipping, 15% off, 20% off, 25% off, and 30% off all in one. And we can see the strike-through pricing. We can see all of our products on first view. And we're even throwing in another product for 20% off and making it super easy for the continue button to move forward. They're not just saying check out, they're saying continue because what Carpe does is it doesn't stop there. They then
[17:19] offer post-purchase upsells, additional offers, and it just keeps going until they've maximized not only the total number of sales, but the overall conversion rate that they could possibly get. And if you hadn't moved forward by this point and you continue to scroll down, they show you the exact steps on how to use it, and they even break down a beautiful before and after. If you have sweaty pits, smelly pits, or have
[17:43] this issue, here's what it looks like with Carpe. They stop sweat and odor. Simple and safe ingredients, dermatologist recommended. Carpe's really good at benefit-driven and before-and-after transformations to convince you to buy. So, the goal from all of this helps you boost add to cart rates, AOV's, and conversion rates by applying all of these things. And at this point, if you're wondering how you
[18:06] can make all of these adjustments, I've gone ahead and linked a tool from Surge where we've audited thousands of Shopify websites and know exactly what converts. And inside of this free audit builder, it will show you everything you need to know and what changes to make in real time. So, I highly recommend checking that out. For AOV's and LTV's, this is where we can do two things. It's where we maximize our average order volume or
[18:30] maximize our lifetime value. Both are great strategies, but it just depends on how your funnel is set up to do it. Maximizing your LTV on the front end is a little more advanced. So, I'm going to show you how to maximize your AOV for any brand that's under 100k per month, I recommend this setup. So, just like I was showing you with Graza, where you're able to switch between different products and be able to add multiple
[18:53] products to cart and do bundling and subscribe and one-time orders all in one view, you can do this by using this tool here. It will allow you to pair your products to where you have bundles, people can toggle between different products, you can set up custom offers all in one view, so that way you can increase your average order value going from $30 to 40, 50, even $60, $100 plus,
[19:19] allowing you to make more money off of every order and simplifying it in a process that is conversion rate friendly. And I highly recommend checking out this tool because whether you're a clothing brand, supplement, any brand where you can pair products or sell bundles or packs, this is a tool that you must have. And just like on Carpe's website, where we have our Black Friday offers, we have our free shipping
[19:42] banners, our special discounts where we show the different tiers that people are going through. And when you add multiple items to cart and we hit continue, you see all of it pop up in a drawer cart or slide cart for a very intuitive and seamless checkout, allowing you to increase your add to cart ratio and your reached checkout ratio. And the exact tool for how you can set this up in a very easy to understand manner and have
[20:06] these special offers being shown in these pop-ups in the upsells in cart to increase AOV's and drive more conversions is this tool right here. It allows you to input your trust badges, urgency timers, free shipping bars, your upsell slider to sell them on additional products in cart before they check out, as well as the payment badges to build trust. This will increase your AOV's and your conversion rates. So, this tool is
[20:30] linked below the video and it's a drawer cart that pops out when they add to cart, allowing them to check out faster and spend more on every customer that visits your website. And this allows you to convert more people that visit your website while getting them to spend more. And all of the tools and things that I'm showing you in this video are all linked below for you to quickly access and install in one click on your
[20:54] Shopify. So, the goal from this, bump AOV's on people who are ready to buy. Next is our checkout and cart recovery. This is where we recapture missed opportunities by increasing at the cart recovery via email and SMS. So, when we're looking at a website that has a very high add-to-cart ratio, where we have nearly 35,000 orders that have been sitting in add-to-carts that have not
[21:18] purchased, and we've only gotten 8,600, that means over 20,000 people are still having a product in their cart, but have not checked out. That is a massive opportunity that we do not want to miss. Without even increasing our spend on ads, we can start liquidating all of these added carts and recovering them to drive more sales. And to be able to do that, if you have a very high
[21:41] add-to-cart ratio and a very low conversion rate, this is one of the quickest ways you can recover them is with email and SMS. So, here we are with a brand that went through the mentorship, and this is Heights District. They are a streetwear clothing brand, and literally within his first month of installing this tool that I'm about to show you, he was able to capture an additional $60,000 in sales off of this one SMS tool. All from the
[22:06] amount of added carts that he had on his Shopify that were not converting. So, if you have a lot of added carts, you want to be able to recover them with SMS and email. So, what I've gone ahead and done is linked below this exact tool, and I highly recommend this, especially if you want to recover more sales and make more money. Because you can literally be able to install this cart recovery tool, and what it does is is it automatically sets
[22:30] up an AI and a phone number. And for every person who adds a cart and bounces from your website, maybe they got busy, something happened and they did not make the purchase. That doesn't mean they necessarily didn't want to buy, but now that they've left, the opportunity of recovering them goes down if you do not have something like this. And what this cart recovery tool does is it'll have an AI conversation where somebody adds the
[22:52] cart and they bounce, and the AI will reach out to them and say, "Hey, I saw that you added this item to cart, but you did not buy. Anything I can help with?" And then the person responds and says, "Well, it was a little pricey. I really want the product, but I don't want to spend that much money." The AI bot will automatically respond and say, "Would a 5% or 10% discount help you?" And then that person ends up checking
[23:14] out, allowing you to recover more individuals. So, this tool only really needs to be set up once, and it will do the automatic add to cart recovery for you. Imagine if you were able to recover up to 30% of the people who added to cart but did not buy. That is a huge increase in sales and a huge increase in conversion rate, all by doing one thing, activating cart recovery with SMS. So,
[23:37] once you install this tool, it will run on autopilot and recover anywhere between 15 to 30% and on average increase your ROI by 10 to 15 X. The amount of times I've seen people explode after doing this is unreal. Next up is email recovery, and one of the quickest ways to recover more people from email is by having more emails to begin with.
[24:00] And before we start sending out email recovery reminders, add to cart recovery flows, check out abandonment flows, post purchase flows, we have to be able to build up our email list in a much more efficient and quicker way. And one of the best ways to do that is by having a full-width pop-up where people can interact and be able to submit their email, so that way you build your email list, increase your matchback ratios
[24:22] with Meta, and be able to send more emails to drive more sales. And one of the ways you do that is a great example from Photon Candle here, who literally came into our mentorship, scaled up to 300k months, transferred into the agency, and will do over $3 million this month from following all of these steps exactly. And we did this with one of these tools, which helps with email capture, and you pick between one of
[24:46] these items. If you're selling candles, these could be candles. If you're selling, you know, supplements, you could have pick between one of our supplements. And it's a mystery discount, and you unlock it and enter in your email address and the average email opt-in ratio is roughly 15% with this tool. Imagine if you're only capturing roughly 3 to 5% and you were able to triple that volume. What does that mean
[25:08] for you? Well, it's totally free to send out emails. So, if you have a much bigger list and you have a much higher capture ratio, you're going to be driving way more conversions. So, to be able to do this exact setup and have a very clean and intuitive pop-up that is full width, I highly recommend checking out this tool where you can have these beautiful visuals of full-width pop-ups that absolutely crush it on mobile and
[25:31] desktop view. And you simply can pick between products or you could do some fun offers. You could ask them questions and it's more interactive, it's very clean, and it has a very high opt-in ratio, which allows us to start sending out email recovery and reminders whenever people leave items in their cart. But, what this also will allow us to do is build out even more flows to drive more sales, which I'm about to get
[25:55] into. So, the goal from this, increase add to cart and purchase recovery. And now we can get into post-purchase and subscriptions. This is where we turn a $40 customer into a $120 customer instantly. So, to show what this looks like, back on Graza, we have the subscribe and save. So, if we spend $10 to acquire a customer and they spend 81 bucks on the subscribe and save option,
[26:17] not only are we getting an 8x return on ad spend, the very next month the subscription renews, allowing us to make an additional $81 on top of what it only costed us to acquire them for 10 bucks. This increases our LTVs and allows us to build up a returning customer rate and get more post-purchases. So, if you have a product that could be on a subscription, you need to install a subscription app that allows you to
[26:41] increase your returning customer rate and recurring revenue. So, that way your revenue is stacking every single month. This allows us to not only spend more on ads, but make more money by having people on subscribe and save options. And the ways that you can do that are are by using a tool called Rebuy. And this allows you to put people on a recurring subscription, so that way every single month you're able to not
[27:03] only bill them, but they receive the product without having to come back to the website. This makes the post-purchase experience much better, so that way they don't have to think about ordering the product every time. It automatically comes to them. They can cancel anytime, and it increases the revenue that you make every single month by multiples. So, if you have a product that is a consumable or skin care, anything where you could buy that
[27:27] product multiple times every month and it runs out, you want to have a subscription. Next up is the post-purchase experience. And Carpe does a really good job of this. Once you buy the first time, they're going to offer you a product immediately after you buy. And this is what we call the post-purchase upsell. And if they go from spending $100, well, now you're offering an additional product to them at a discounted rate for say 20 more
[27:51] dollars. And because they already bought from you and trust you, the chances that they're going to buy again go up significantly. So, you definitely want to have a post-purchase upsell because it helps raise your ROAS. It helps you get that second purchase, which makes it even more likely that a customer will return to your website again and again to buy more. So, how do we set up the post-purchase after they buy? Well, we do that with this post-purchase upsell,
[28:14] which will help increase your AOV and the post-purchase experience. So, that way you make more money after every customer that checks out on your website. In this tool right here, all you do is just install it, and as soon as they buy, they're given another offer to spend more with you. And this is one of the easiest ways to increase your AOVs and gain more sales. Now, it doesn't just stop there. Next up, we want to have all of the email flows that
[28:39] allow us to keep bringing these customers back and back every single month. So, that way we don't have to constantly go out and acquire tons of new customers every single week. And one of the easiest ways to do that is with email post-purchase flows. And this is where we can go over special offers. We can break down other products that we're offering where we showcase, you know,
[29:01] maybe you bought this product, but did you know this other product improves your sleep or has a different feel? Maybe it pairs well with this item. We can share the founder's story to get them more engaged with us. Because once they buy, they're in tune with the brand, but now we want to integrate them so that way they become a cult-like fan of our brand. And what we'll do is we'll send them down multiple flows where we're giving them special offers. We'll
[29:25] do Labor Day sales. We'll do mystery gifts. We'll end up thanking them for sleeping with us, right? If they bought a sleeping product. Or if they bought a supplement, you bought our creatine, but did you know our protein helps increase your muscle growth on top of the creatine that you're using? This is a great way to communicate to our customers after they've already bought. So, you want to build out multiple email
[29:47] flows to increase conversion rates because now we have an easy route of bringing people back to the site and buying again. And we can continue to educate and be able to give out more offers to drive more sales by using these email flows. An example of somebody who's doing a really good job of not only sending out emails, but getting customers to review so that way they build up the credibility and social
[30:09] proof and drive more trust like we were talking about earlier is Everyday Dose. In order to get all of these reviews, it doesn't just come by natural people buying and reviewing. There's an entire science behind the scenes that you're not seeing. And that is where they're incentivizing and sending out notifications. Immediately after customer buys, they're asking for reviews, videos, and offering referrals to get people to spend more money with
[30:34] them, refer their friends, and provide them with videos of their product, and more reviews. Because they know if they get a ton of reviews and social proof, they're going to have a higher conversion rate. So, what you want to do is set up an email flow to be able to reach out to these customers to get them to buy more. And how you do that is by using a tool like this review app, which is linked below this video, and it sends out requests to not only get people to
[30:57] review, but also get photos, videos, images of people actually using the product because it builds more social proof, drives higher conversions, and allows you to be able to drive more sales. So, if you want to get way more reviews and be able to recover and increase your sales and conversion rate, then you definitely want to use this tool. So, the goal from this, increase your LTVs from day one and sell to them
[31:21] again and again through email and SMS so we can shift ad budget towards net new people, which lowers our ad spend, increases our LTVs, and brings in more people into our ecosystem. Now, I want to make one thing crystal clear. CRO doesn't mean just fixing pages. It's continuous experimentation, AB testing, and maximizing every metric from the front end to the back end of the funnel.
[31:45] So, to recap what all was learned in this video is number one, we learned what a proper website foundation looks like with our speed and overall trust. Number two is we now understand our data and all of the analytics and leaks in our site that is preventing people from converting. Number three, we now understand how to properly set up our landing pages and make sure that our messaging from our ads align with our
[32:09] landers or PDPs. And number four, we have all of our offers, bundles, and upsells all set up along with a properly structured checkout cart. And number five, we have add to cart recovery set up through email and SMS and not always relying on ads. And finally, we have a clear understanding of maximizing our LTV on the back end to get more repeat customers every single month. And
[32:33] earlier in this video, I mentioned I was also going to give you the full funnel that we roll out with all of our clients. And once you understand how to structure your website for conversions, this funnel will bring you traffic 40% cheaper and be able to scale to 100k, 500k, 1 million, and even 10 million dollars per month on Shopify. And I put all of it in this next video for you right here. I'll see you inside.
```

---

## Annexe A — Conditions techniques du relevé

| Élément | Valeur |
|---|---|
| Date | 8 septembre 2026 |
| Environnement | session Claude Code infonuagique, IP de centre de données |
| Outil | `.claude/skills/video/scripts/video.py` puis `yt-dlp` en direct |
| Version yt-dlp | 2026.08.19 |
| Jeton PO | `bgutil-ytdlp-pot-provider`, greffon Python 2.0.0 + générateur Node recompilé au tag 2.0.0 |
| Client d'extraction retenu | `youtube:player_client=web` |
| Métadonnées | récupérées pour les six vidéos |
| Sous-titres | récupérés pour les six vidéos, langue originale |
| Flux vidéo | **refusé** (403 des serveurs de diffusion) |
| Relais tiers (cobalt) | **hors service** (HTTP 400 sur l'instance configurée) |
| Trames d'image extraites | **0** |

**Incident rencontré et corrigé** : le greffon Python `bgutil-ytdlp-pot-provider` installé par le script de préparation était en version 2.0.0, alors que son générateur Node compilé dans `~/.cache/video/bgutil` était resté au tag 1.3.2. yt-dlp échouait avec « Plugin and script major versions are mismatched ». Correction : `git checkout 2.0.0` dans le dépôt en cache, puis recompilation (`npm ci` + `tsc`). Les métadonnées et les sous-titres sont redevenus accessibles immédiatement après.

**Pour obtenir les images lors d'un prochain relevé**, trois voies existent, par ordre de simplicité :
1. attendre que l'instance cobalt publique redevienne disponible, ou en configurer d'autres dans `VIDEO_COBALT_INSTANCES` ;
2. poser `VIDEO_YT_COOKIES_B64` dans les variables d'environnement Claude Code (témoins d'un compte YouTube secondaire — gratuit, mais le compte risque une suspension) ;
3. poser `VIDEO_PROXY` (mandataire résidentiel, ~3–10 $/mois — pas de risque de compte).

Aucune option de yt-dlp ne lève le refus des serveurs de diffusion : ce n'est pas un réglage à chercher.

---

## Annexe B — Ce que le corpus ne couvre pas

Sujets absents des six vidéos, à ne pas chercher dans ce rapport :

- **Référencement organique** comme source de trafic (seule Convertica l'effleure, en 1:05, pour dire qu'un visiteur SEO non converti est une occasion perdue)
- **Conversion en contexte bilingue** — aucune vidéo n'aborde la gestion FR/EN au-delà de la détection automatique de langue
- **Performance technique au-delà du poids des images** : Core Web Vitals, poids du JavaScript, nombre d'applications installées, scripts tiers
- **Accessibilité**
- **Saisonnalité** et gestion des pics
- **Vente B2B**, cadeaux corporatifs, comptes professionnels
- **Retours et échanges** comme processus (seulement comme signal de confiance affiché)
- **Service à la clientèle** comme levier de conversion (seulement le clavardage, chez Convertica)
- **Mesure statistique des tests** : puissance, taille d'échantillon, durée minimale, faux positifs — aucune vidéo ne dit combien de temps ni combien de visiteurs il faut pour conclure un test A/B, ce qui est une lacune sérieuse compte tenu de l'insistance générale sur le test
- **Conformité légale** : LCAP, Loi 25, Charte de la langue française, affichage des prix

---

*Rapport produit à partir des transcriptions intégrales des six vidéos. Aucune image n'a été vue ; aucune description visuelle n'a été inventée.*
