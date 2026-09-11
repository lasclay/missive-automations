# Le paid ads en 2026 — guide de saison forte pour Lasclay

Notes exhaustives tirées des enregistrements de la conférence (dossier Drive
`1YGCY0JO0d-jyUYEeljF33zQNRWdJbuAd`, 79 min de vidéo), puis traduites en plan d'exécution
pour la saison forte de Lasclay.

> **Lecture du document.** Tout ce qui est en citation ou en tableau vient de la conférence.
> Les blocs « **Chez Lasclay** » sont l'adaptation — c'est du jugement, pas du verbatim.
> Les chiffres du compte de démonstration viennent d'un compte tiers (location de chalets,
> panier ~2 400 $) : ce sont les **ratios et la méthode** qui se transposent, pas les valeurs.

## 0. Ce que contiennent les enregistrements

| Fichier | Durée | Contenu |
| --- | --- | --- |
| `IMG_8412.JPG` | photo | Deck A « Le paid ads en 2026 » (14 pages), page 13 |
| `IMG_8413.MOV` | 27:52 | Deck A + tracking (Stape) + **la vue de colonnes** + chiffrier budget |
| `IMG_8414.MOV` | 18:11 | Ads Manager en direct : structure du compte, audiences, création de campagne |
| `IMG_8415.MOV` | 20:18 | Ensemble de pubs et publicité, champ par champ, jusqu'à *Publish* |
| `IMG_3744.MOV` | 10:37 | Deck B (Omy Laboratoires, 61 pages) : formats, méthode de test |
| `IMG_8416.MOV` | 2:25 | Suite du deck B : UGC, entonnoir |

Deux intervenants : une marque D2C (**Omy Laboratoires**, soins personnalisés) qui raconte
ce qui a marché chez elle, et un praticien qui ouvre en direct un vrai compte Meta
(**MonsieurChalets**, 86 campagnes, 802 publicités).

---

## 1. La thèse de 2026 : le créatif est devenu le ciblage

C'est le fil conducteur des deux présentations. Depuis *Andromeda* (le moteur de diffusion de
Meta), l'algorithme trouve l'acheteur tout seul **à partir du créatif**. Le ciblage manuel ne
fait plus que l'empêcher de travailler.

La diapo d'arbitrage, mot pour mot :

| | **Broad** | **Lookalike (LAL)** | **Intérêts** |
| --- | --- | --- | --- |
| Description | Aucune restriction d'audience. L'algorithme trouve les bons utilisateurs tout seul grâce au créatif. | Basé sur tes meilleurs clients. 1 %, 3 %, 5 %. De moins en moins utile avec Andromeda. | Ciblage par centres d'intérêt. Signal de plus en plus dilué. |
| Verdict Meta | **Recommandé post-Andromeda** | Pertinence en baisse | Signal en déclin |

> « **Tester l'audience _après_ le créatif. Avec Andromeda, le broad gagne la majorité du temps.** »

La démonstration en direct le confirme par l'absurde : dans l'interface, les intérêts affichent
désormais des fourchettes absurdes (*Vacation rental (lodging)* = 139 à 164 **millions** de
personnes) pendant que les titres de poste précis tombent à 1 972–2 320. Aucun des deux ne cible
quoi que ce soit d'utile.

**Chez Lasclay.** Arrêter de bâtir des audiences d'intérêts « plein air / jardinage / monarque ».
Le signal « qui achète de l'asclépiade » n'existe pas chez Meta — mais une pub qui montre la fibre
en gros plan le fabrique. Le budget de réflexion passe du ciblage vers le tournage.

---

## 2. Le squelette de compte

### 2.1 L'entonnoir et la répartition du budget

| Étage | Qui | Contenu | Objectif | Part du budget |
| --- | --- | --- | --- | --- |
| **TOFU — Awareness** | Broad targeting | UGC | CPM bas, **hook rate élevé** | **70 %** |
| **MOFU — Considération** | Retargeting des engagés | Éducation produit, social proof, avant/après | Considération | **20 %** |
| **BOFU — Conversion** | Visiteurs + abandons panier | Offres limitées, urgence | Achat | **10 %** |

Le 70 / 20 / 10 est contre-intuitif quand on panique en novembre. C'est justement le point.

### 2.2 La nomenclature (à copier telle quelle)

Campagnes : `[ÉTAPE]_[TYPE]_[STRUCTURE BUDGET]_[MARCHÉ ou SAISON]`

```
TOF_Corpo_CBO_QC            MOF_Retargeting_ABO_QC
TOF_Prospection_CBO_QC      BOF_Retargeting_ABO_QC
TOF_Prospection_CBO_Hiver   BOOST_Chalets_ABO_QC
```

Publicités : `[ÉTAPE]_[FORMAT]_[sujet]_[placement]`

```
TOF_VID_Ilaali_tour_IG      MOF_CAR_Categories
CORPO_VID_Manoirdesforges_IG   Video_Altitude_IG
```

`VID` = vidéo, `CAR` = carrousel, `IMG` = statique. Le même créatif est dupliqué par placement
(`_IG` / `_FB`) et on éteint celui qui ne performe pas.

Audiences : `[TYPE]_[sujet]_[fenêtre]`

```
MOF_Site_Visitors_30d              GEO_Greater_Quebec_FR
SEASONAL_Winter_Bookers_Prep       GEO_Montreal_Metro_FR
INT_Quebec_Local_Explorers         Lookalike (1%) - RT_Abandon_Cart_30d
Klaviyo – Propriétaires de chalets Lookalike (1%) - BOFU_Initiate_Checkout_30d
```

**Chez Lasclay**, la transposition directe :

```
TOF_Prospection_CBO_QC        TOF_Prospection_CBO_CA_EN
TOF_Prospection_CBO_US        MOF_Retargeting_ABO_QC
BOF_AbandonPanier_ABO_QC      BOF_Retargeting_ABO_US

MOF_Site_Visitors_30d         MOF_Video_Viewers_365d
BOF_AddToCart_14d             BOF_InitiateCheckout_7d
CLIENT_Acheteurs_180d         CLIENT_Acheteurs_365d
SEASONAL_Mitaines_2025        SEASONAL_Semences_Printemps
KLAVIYO_Infolettre_Actifs     LAL1_Acheteurs_365d
```

### 2.3 Ce que le compte de démo fait mal — à ne pas copier

802 publicités actives, presque toutes en **« Learning limited »**. C'est le symptôme classique :
trop de pubs pour le budget. Mieux vaut 6 pubs qui sortent du learning que 60 qui n'en sortent
jamais.

---

## 3. Les fondations, avant de dépenser un dollar

Le deck A tient en trois étapes. L'étape 2 est celle que tout le monde saute :

> **« 2. Installer du tracking et faire un audit de la compétition »**
> **Facebook Ads : installer le Facebook Pixel sur son site + Serveurs**
> **Google Ads : utiliser Google Tag Manager**
> Dans les deux cas : **Stape**.

L'outil montré à l'écran est `stape.io/fb-capi-gateway` — *Meta Conversions API Gateway Hosting*,
fait en collaboration avec Meta : « The easy way to implement Facebook Conversions API with no
manual tagging. No need to hire a tracking specialist or use a third-party integration tool. »
Essai 7 jours. **Triple Whale** est aussi montré, côté attribution.

### 3.1 Pourquoi le tracking passe avant tout le reste

> « Avant de lancer la première pub Facebook, il faut mettre du tracking sur le site. Sinon, on est
> une grosse mitraillette qui tire partout, mais on n'a aucune idée où ça tombe. »

> « Des fois, c'est pour ça que ça ne fonctionne pas : le tracking est mal installé. »

La progression conseillée, en deux temps :

> « Commencez quand même à faire de la pub même si vous avez juste un Facebook Pixel, c'est
> correct, commencez là. Et dès que vous mettez un peu plus de budget, là vous voulez avoir vos
> données sur un **vrai serveur** — parce que vos données, c'est ça qui va faire en sorte que votre
> compte va être de plus en plus performant. »

Pour un site sur mesure (pas Shopify), la démonstration décrit sa propre installation : Google Tag
Manager, avec un **événement personnalisé par étape du parcours** (la date entrée, le nombre
d'invités, chaque bouton du tunnel), puis du reciblage sur ces événements dans Google Ads comme
dans Facebook Ads. Et le conseil répété deux fois : **faire écrire l'installation par une IA**
plutôt que de renoncer parce que c'est technique.

### 3.2 Le piège de l'attribution — à lire avant de juger un ROAS

> « Si quelqu'un a vu une pub dans les derniers jours ou a cliqué dedans dans les 7 jours, Facebook
> va dire que **100 % de la vente vient de lui**. »

Conséquence, racontée en direct : entre la pub Facebook, la pub Google et l'infolettre, « à un
moment donné, j'avais compté 4 ventes alors que j'en avais 3 ». Chaque plateforme réclame la
même commande.

Le débat qui suit dans la salle porte sur l'**incrémentalité** : quand on met du budget sur des
gens qui connaissent déjà la marque, est-ce que ce sont de vraies ventes de plus, ou des ventes
qui auraient eu lieu de toute façon ? La conclusion, dite sans détour, est qu'il n'existe pas de
mesure parfaite — mais que poser la question change la façon de répartir le budget. C'est un
argument de plus pour le 70 % en haut de l'entonnoir.

Trois règles qui en découlent :
1. Le ROAS affiché dans Meta est un **indice**, pas un résultat comptable.
2. La seule vérité est le rapprochement quotidien dépense totale / ventes réelles (§ 9.2).
3. Pour comprendre le parcours réel (pub Facebook → recherche Google → vidéo → achat), il faut un
   outil d'attribution — **Triple Whale** est celui montré, utilisé par la marque invitée.

**Chez Lasclay.** Avant de payer un outil d'attribution, le rapprochement quotidien Shopify /
Meta / Google dans un chiffrier fait déjà 80 % du travail — et c'est une donnée qu'on possède
déjà des deux côtés.

### Liste de contrôle avant la saison

- [ ] Pixel Meta en place **et** Conversions API côté serveur (Stape, ou l'intégration Shopify
      native si elle couvre déjà le besoin — à vérifier avant de payer un service de plus).
- [ ] Événements standard propres : `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`,
      avec valeur et devise.
- [ ] **Catalogue produits** branché. Dans la démo, `Advantage+ catalog` est la recommandation
      qui vaut le plus de points dans le *Campaign score* (+53 à elle seule). Sans catalogue à
      jour, on se prive du levier que Meta pousse le plus fort.
- [ ] **Audiences d'exclusion clients** créées : `Acheteurs - 180J`, `Acheteurs - 365J`.
      Elles servent au réglage *Customer lifecycle strategy → Acquire new customers*.
- [ ] Audiences de reciblage créées **maintenant**, pas en novembre : une audience a besoin de
      se remplir avant d'être utile.

### Les fenêtres de rétention, telles que Meta les propose

| Source d'audience | Rétention par défaut | Note affichée par Meta |
| --- | --- | --- |
| Visiteurs du site (pixel) | **30 jours** | « Maximum audience retention increased for purchase events — tu peux monter à **730 jours** quand tu choisis des événements d'achat. » |
| Engagement vidéo | **365 jours** | — |

**Chez Lasclay**, c'est un point clé : le cycle d'achat est saisonnier. Quelqu'un qui a regardé
une vidéo de mitaines en février est un bon prospect en novembre. Créer dès aujourd'hui
`MOF_Video_Viewers_365d` et pousser les audiences d'acheteurs à 730 jours.

---

## 4. Le catalogue de formats

Le deck B consacre une dizaine de pages aux formats, sous le titre
**« Des incontournables qui fonctionnent (presque) toujours »**. Chacun est illustré de vrais
créatifs.

### 4.1 UGC — User Generated Content

Le format de tête, en TOFU. Créateur face caméra, vertical, sous-titres brûlés.
Accroches montrées : « If you care about clean water… », « Si j'avais un seul produit… »,
« If you're using ChatGPT… ».

Le passage le plus utile est l'économie du format :

> Il ne faut pas viser le créateur à 200 000 abonnés. « Elle va demander 5 000 $, elle va dire
> que tu as juste le droit de l'utiliser 6 mois, et elle va dire je ne veux pas que tu fasses
> ci, ça. Moi j'ai besoin de flexibilité : si ça marche, je ne veux pas me faire bloquer. »
> À la place : des petits créateurs, payés **~100 $ plus le produit**, dont la face n'est pas
> connue — et ce n'est pas grave.

> « Le filtre, c'est de s'assurer que les personnes sont bonnes. » Une remarque honnête et
> inconfortable de la présentation : leur apprentissage est que « ça prend une belle fille »,
> et que la diversité, chez eux, ne performait pas. C'est **leur** donnée sur **leur** produit
> (soins du visage), pas une règle. À noter comme tel, pas à importer.

**Le whitelisting** — le vrai levier du format :

> « Au lieu de les rouler sur le compte d'Omy, ça roule sur le compte de Marie-Pierre. »

La pub est diffusée depuis le compte du créateur. Elle n'a plus l'air d'une pub de marque.

**Chez Lasclay.** Recruter 5 à 8 micro-créateurs québécois (plein air, jardinage, jeunes parents,
chasse-pêche pour le profil *Pascal*), 100 $ + produit, droits d'usage **illimités en durée**
négociés d'avance — c'est la clause qui compte. Demander le fichier brut sans musique, pour
pouvoir remonter le hook. Prévoir le whitelisting dès l'entente (accès partenaire à leur compte
Instagram).

### 4.2 EGC — Employee Generated Content

Le contenu tourné par les employés, assumé comme tel.

> « Ça marche super bien. Quand on fait des ventes chez Omy, on fait un vidéo : salut, on a une
> vente en fin de semaine. Juste d'avoir du contenu fait par vos employés, ça fonctionne
> toujours super bien. »

> Ce qui marche le mieux à l'interne : **une personne qui explique les produits.**
> « Quand on lance un produit, [elle] fait toujours une vidéo pour expliquer c'est quoi le
> produit, pourquoi il est là, qu'est-ce qu'il y a dedans. Ça prend quelqu'un de naturel, qui est
> habitué de parler devant la caméra. »

**Chez Lasclay.** C'est le format le moins cher et le plus défendable : Gabriel explique
l'asclépiade. L'équipe d'atelier montre l'isolant. Le discours de marque existe déjà, il suffit
de le filmer à l'horizontale du quotidien plutôt qu'en production léchée.

### 4.3 Installations / coulisses de fabrication

> « Tout ce qui est behind the scenes, la fabrication des produits… ça marche vraiment bien, et
> ça m'a surpris, je ne peux pas expliquer pourquoi. Le monde, quand on brasse de la crème, quand
> il y a une machine qui étiquette des trucs — ça marche vraiment bien. »

> « Il y avait vraiment une résistance à l'interne au début, parce que ce n'est pas assez haut de
> gamme, ça ne fait pas premium. Mais ça marche. »

Et le raccourci de production qui en découle :

> « Peu importe ce qu'on dit par-dessus, le visuel en background, ça marche bien. On lance un
> produit, on a une version qui ressemble à [la précédente], tu changes juste le vidéo derrière
> et tu mets l'étiqueteuse à la place. Ça marche toujours super bien. »

**Chez Lasclay, c'est l'actif le plus sous-exploité de l'entreprise.** Le défibrage, l'isolant
qui sort de la machine, la découpe laser, les coussinets qu'on insère dans un manteau, les
gousses qui s'ouvrent : personne d'autre au Québec ne peut filmer ça. Et le pivot manufacturier
de 2025-2026 en fait un stock d'images qui se renouvelle tout seul.

Méthode : tourner **une banque de 20-30 plans d'atelier**, puis les recycler derrière tous les
scripts de la saison.

### 4.4 US VS THEM

Comparatif visuel côte à côte. Exemples montrés : un eye-liner « then / us », une boisson
sportive contre « autre boisson pour sportifs », un sérum contre un sérum, un service financier
« 6 à 10 semaines vs 7 jours », des jeans « other brands vs us ».

**Chez Lasclay.** Asclépiade vs duvet : chaleur à poids égal, comportement à l'humidité, origine,
prix. Ou asclépiade vs polyester. Attention au garde-fou de marque : comparer sur des faits
vérifiables, sans dénigrer nommément un concurrent local.

### 4.5 Volume quantifiable

Mettre un chiffre dans le visuel. Exemples de la diapo : « We ingest up to **75,612** microplastic
particles each year by drinking bottled water », « Les soins personnalisés viraux vendus et adorés
**10 000 fois** », « Vendu et adoré **40 000 fois** », « Sold & loved **10k** times ».

> « À chaque fois qu'on mettait des chiffres… “aimé par 50 000 Québécoises”, “aimé par 100 000
> Canadiens”… ça a toujours bien fonctionné. C'était tout le temps un winner, ce genre de
> messaging-là. »

**Chez Lasclay.** Les chiffres existent déjà et sont plus forts que la moyenne du marché :
~10 millions de graines distribuées, plus de 40 produits, une fibre récoltée dans des champs
québécois, le nombre de mitaines vendues depuis 2020. Un chiffre vrai, gros, dans le premier
tiers de l'image.

### 4.6 Avant / après

Exemples : peau (« Not Overnight, But in 28 Days »), rénovation de cuisine (« BEFORE »),
profil barbe avec étiquettes « Avant/before » et « Après/after ».

> « Les avant-après, ça marche bien aussi. C'est d'avoir quelque chose à montrer. Ce n'est pas
> possible pour tout le monde, mais ça marche toujours bien. »

**Chez Lasclay.** Pas un avant/après de corps — un avant/après de **matière et de terrain** :
la gousse d'asclépiade → la fibre → l'isolant → le produit fini. Ou le champ en juin → le champ
en septembre. Ou la caméra thermique : main nue / main en mitaine.

### 4.7 Dans la voiture ou dehors

Filmé au volant, en marchant, en mouvement. Sous-titres vus : « Je travaille souvent sur la
route », « Everything is moving! Go! Go! Go! ».

> « Des trucs dans des contextes différents — dans la voiture, être à l'extérieur — ça casse les
> codes de la pub, pour que ça n'ait pas l'air d'une pub. Ça marche bien. Encore une fois, dès
> qu'il y a une twist qui fait plus organique, ça marche bien. »

**Chez Lasclay.** Le terrain est le décor naturel de la marque : le champ, le sentier, le
stationnement à −20 °C, le quai en novembre. Filmer dehors coûte zéro et donne la preuve d'usage.

### 4.8 Faux billboard

Un créatif qui imite un panneau d'affichage extérieur. Exemples montrés : une annonce de vente
d'entrepôt (« Trois-Rivières — jusqu'à 50 % de rabais, 24-25 octobre »), un panneau protéine,
un panneau « Summer moments in linen ».

**Chez Lasclay.** Parfait pour annoncer la prévente ou le Vendredi fou sans faire une énième
bannière de rabais.

### 4.9 Le podcast — le format le plus vanté de la conférence

> « L'autre chose qui marche, du feu de Dieu, c'est des podcasts. […] On est restés sur place
> après et on a filmé des trucs. Il faut absolument qu'on en fasse, ça marche tellement bien,
> c'est fou. »

> Le mécanisme est le segment choc : « [Elle] disait *on a plus de crème chez Omy que chez
> Sephora* — et ça a explosé. »

> Et le raccourci, dit tel quel : « Vous louez un studio, et vous parlez dans le vide en disant
> des phrases chocs mais qui sont en lien avec votre produit. Ça marche vraiment bien. »

**Chez Lasclay.** Gabriel a déjà le matériel : l'effondrement de la filière en 2018, le pivot
manufacturier, pourquoi un manteau d'asclépiade coûtait 1 000 $ avant et pourquoi il ne le coûte
plus, pourquoi les monarques disparaissent. Une demi-journée de studio, dix phrases chocs, et on
a de quoi alimenter le TOFU jusqu'en février.

### 4.10 Boosté ce qui marche déjà

> « Si vous avez des posts qui marchent bien en organique, ils vont bien marcher en payant aussi.
> L'algorithme est quand même assez similaire. »

**Chez Lasclay.** Avant de produire du neuf : reprendre les publications organiques Facebook et
Instagram des 12 derniers mois, classer par taux d'engagement, et passer les trois meilleures en
payant dès cette semaine. C'est le gain le plus rapide du document.

### 4.11 Une note sur les formats : ils fonctionnent par vagues

> « C'est un peu tout, ça vient vraiment par vagues. Il y a des statiques qui fonctionnent bien,
> des vidéos, des carrousels. Il y a un an on ne roulait aucun carrousel ; on a retesté six mois
> après, ça performait super bien. »

> « Quand les reels sont sortis, Facebook voulait vraiment les pousser, donc ça ne coûtait pas
> cher sur ce format-là pour que les gens l'adoptent. Et maintenant que c'est adopté, le prix est
> monté. »

Deux conséquences pratiques : **retester les formats abandonnés tous les six mois**, et **aller
là où Meta pousse** (en ce moment : la vidéo générée, les placements Advantage+, le catalogue).

### 4.12 Le volume de production

> Chez Omy : **environ 50 nouveaux créatifs par mois.**

C'est le chiffre qui recadre tout le reste. Le ciblage est mort, donc la variable, c'est le débit
de créatifs.

**Chez Lasclay**, 50/mois n'est pas réaliste. Mais 12 à 15 par mois l'est si on accepte la
recette : un tournage d'atelier + un tournage terrain + trois UGC, puis du remontage (même script,
fond différent ; même fond, hook différent).

---

## 5. Le hook, l'angle, l'audience — dans cet ordre

La diapo de priorisation est explicite : **on teste le hook en premier, toujours.**

### 5.1 Le hook (3 premières secondes)

> **« Le facteur #1 de performance. Tester en premier, toujours. »**
>
> **Qu'est-ce qu'un hook ?** Une accroche percutante placée au tout début d'une publicité (vidéo
> ou visuel), qui sert à captiver l'attention instantanément.
>
> **C'est souvent :** une question provocante · un problème ciblé · une phrase forte qui pique la
> curiosité ou génère une émotion.
>
> **À quoi ça sert ?** Stopper le scroll · faire en sorte que l'audience reste pour voir la suite ·
> booster les performances (plus de vues, clics, conversions) · favoriser l'algorithme :
> un bon hook → meilleure rétention → meilleure diffusion.

Exemples à l'écran : « Winter in Canada = skin in crisis », « I love winter but my skin throws a
fit every year. »

Et le commentaire parlé, plus brutal :

> « On écoute nos vidéos en défilant. Si tu ne me stimules pas après une seconde, j'ai skippé ta
> vidéo. Ça peut être un hook visuel, une phrase, quelque chose d'écrit — mais **une vidéo ne peut
> pas commencer par deux secondes de silence puis “bonjour”.** »

**Chez Lasclay**, dix hooks à tester, gratuits :
« L'asclépiade, c'est de la mauvaise herbe. On en fait des manteaux. » ·
« Cette fibre est plus chaude que le duvet et elle pousse dans un champ à Québec. » ·
« Pourquoi les monarques disparaissent, en 20 secondes. » ·
« J'ai mis ma main dans l'azote… » (preuve thermique) ·
« On a failli fermer en 2018. » ·
« Regarde ce qui sort de cette machine. » ·
« Ce manteau se démonte. » ·
« 10 millions de graines plus tard. » ·
« Tout le monde jette ça. » ·
« −27 °C, mains nues, 30 secondes. »

### 5.2 L'angle / le message

> « Bénéfice, problème, social proof, urgence, éducation… »

Exemples : « See What Personalized Skincare Can Do in 28 Days », « Derniers jours pour une
livraison avant Noël » (visuel de sablier).

### 5.3 L'audience — en dernier

Voir la section 1. Broad, et on n'y revient pas.

---

## 6. Le framework de tests

Six cases, telles quelles :

| | | |
| --- | --- | --- |
| **01 Hypothèse**<br>Quel angle créatif tester ? Définir une hypothèse claire avant de lancer quoi que ce soit. | **02 Isolation**<br>Une seule variable à la fois. Hook, angle, format ou audience — jamais tout en même temps. | **03 Budget**<br>**Minimum 5× le CPA cible par test.** En dessous, les résultats ne sont pas fiables. |
| **04 Durée**<br>**3 à 7 jours minimum** avant de conclure. Laisser l'algorithme sortir du learning phase. | **05 Analyse**<br>Significativité statistique requise. On ne kill pas un test sur du bruit — on attend la data. | **06 Scale**<br>Les gagnants passent en scaling. Les perdants nourrissent les apprentissages pour le prochain cycle. |

> Gagnant → Scaling · Perdant → Apprentissage

### Ce que « 5× le CPA cible » veut dire concrètement

Si le coût d'acquisition visé est de 30 $, chaque test a besoin de **150 $** avant qu'on ait le
droit d'en tirer une conclusion. Avec 4 créatifs à tester, c'est 600 $ sur 3 à 7 jours. C'est la
contrainte qui décide du nombre de tests qu'on peut vraiment mener — pas l'envie.

---

## 7. CAC et LTV

La diapo pose la définition et la question, sans donner la réponse à l'écran :

> « Le **CAC** (coût d'acquisition client) représente le montant total investi en marketing et
> ventes pour acquérir un nouveau client. »
> **« Comment calculer son CAC maximal ? »**

La réponse pratique :

```
CAC maximal = marge brute par commande × part de la marge qu'on accepte de céder à l'acquisition
```

**Chez Lasclay**, avec une marge brute autour de 73 % (chiffre interne, à revalider) :

| Panier moyen | Marge brute | CAC max à 50 % de la marge | CAC max à 70 % (mode conquête) |
| --- | --- | --- | --- |
| 80 $ | 58 $ | **29 $** | 41 $ |
| 120 $ | 88 $ | **44 $** | 61 $ |
| 200 $ | 146 $ | **73 $** | 102 $ |

Deux mises en garde :
- Le CAC max se calcule sur le **premier achat** si on ne sait pas encore mesurer la LTV. Dès
  qu'on sait qu'un client réachète (semences au printemps, accessoire l'hiver suivant), on peut
  monter le plafond — mais seulement avec la donnée en main, pas par optimisme.
- En pleine saison, monter le CAC accepté est une décision de trésorerie autant que de marketing.
  Avec un modèle qui passe de la prévente à l'inventaire, le cash encaissé aujourd'hui ne
  finance plus la production de demain.

---

## 8. Monter le compte, écran par écran

Ce qui suit suit exactement l'ordre de la démonstration en direct.

### 8.1 Campagne

| Champ | Valeur | Remarque de la démo |
| --- | --- | --- |
| `Buying type` | **Auction** | *Reservation* existe (« buy in advance for more predictable outcomes ») mais n'est pas le chemin ici |
| `Campaign objective` | **Sales** | Les autres : Awareness, Traffic, Engagement, Leads, App promotion |
| `Advantage+ catalog` | **ON** | Catalogue produits branché. C'est la recommandation qui pèse le plus lourd dans le score |
| `Budget strategy` | **Campaign budget** (CBO) | L'alternative *Ad set budget* (ABO) sert au reciblage, où on veut forcer la répartition |
| `Campaign name` | selon nomenclature | Bouton **Create template** : à utiliser, ça évite de tout reconfigurer à chaque campagne |

Encadré Meta à connaître : *« Existing customer budget cap no longer available for new campaigns.
You can use Campaign budget with ad set spending limits to achieve the same goal. »*

**Campaign score** : 100 quand *Advantage+ sales campaign* est ON (« You're using our recommended
setup »), et le score chute dès qu'on s'en écarte — 77, 74, 69, 50 au fil de la démo. Chaque
recommandation est chiffrée en points. **Ce n'est pas une note de qualité, c'est une mesure de
conformité aux réglages que Meta veut pousser.** À lire comme une information, pas comme un ordre.

### 8.2 Ensemble de publicités

- **Customer lifecycle strategy → Acquire new customers** (pré-sélectionné par Meta).
  « This helps you prioritize conversions from new customers by excluding custom audiences of
  your existing customers. »
  - `Exclude existing customers` → `Acheteurs - 180J`, `Acheteurs - 365J`
  - C'est ici que servent les audiences d'exclusion préparées à la section 3.
- **Controls** : « We won't reach people beyond these settings, **even with Advantage+ on**. »
  → C'est le seul vrai garde-fou quand Advantage+ est actif. Ce qui est mis là est respecté ;
  tout le reste est suggestion.
- **Locations** : inclusion pays, puis ville + rayon si besoin (la démo : *Quebec, Quebec + 25 mi*).
  Deux cases exclusives :
  - *Reach more people likely to respond*
  - *Reach people interested in your selected cities or regions* → Meta annonce
    **6,7 % lower cost per result, « based on our experiment »**
- **Minimum age** 18. Avis : l'audience inclut désormais les gens de WhatsApp dont l'âge est
  inconnu, à cause du placement WhatsApp Status.
- **Languages** : mettre `French (All)` seulement si on veut limiter. Meta précise de ne le faire
  que si la langue visée n'est pas courante dans les lieux choisis.
  → **Chez Lasclay**, c'est le champ qui sépare proprement les campagnes FR et EN sur un même
    territoire canadien.
- **Detailed targeting** : à laisser vide (voir section 1).
- **Placements** : Advantage+ ON. Encadré important :
  > **« Changes to placement settings are coming soon. »** Exclure des placements ou des
  > plateformes ne sera **plus possible au niveau de l'ensemble de pubs**. Il restera :
  > *Placement value rules* (monter/baisser l'enchère par placement), *Ad creative*
  > (personnaliser le créatif par placement), *Account controls* (exclusions au niveau du compte).

  → Conséquence : la maîtrise des placements se déplace vers le **créatif par placement** et les
  **règles de valeur**. Il faut commencer à produire en 9:16 et en 1:1 plutôt qu'à exclure.
- **Budget** : ex. *Daily budget 20,00 $ CAD*. Meta affiche alors : « We'll spend around $20.00
  per day. Your **maximum daily spend is $35.00** and your **maximum weekly spend is $140.00**. »
  → Le lissage peut dépenser **175 % du budget quotidien** un jour donné. À savoir avant le
  Vendredi fou, quand on met un gros budget pour 24 h.

### 8.3 Publicité — l'assistant créatif 2026

Sept onglets : `Creative setup → Media → Text → Image generation → Video generation →
Enhancements → Translation`.

**Creative setup** — quatre extensions, toutes **OFF par défaut** :

| Extension | Ce qu'elle fait |
| --- | --- |
| *Website summaries* (IA) | Tire du texte du site et du profil Instagram. Cases : **Product Descriptions**, **Selling Points** |
| *Branding* | Logo, police, couleurs, **Text tone**, **Visual style**. « Set brand defaults for this ad **and future ads** » |
| *Site links* | Liens supplémentaires sous la pub, « more ways to learn and buy » |
| *Website highlights* | Meta moissonne les images du site et propose une grille à activer |

⭐ **Remplir *Branding* une seule fois.** Toutes les générations IA ultérieures en héritent. Sans
ça, l'IA de Meta invente une identité visuelle à la place de la vôtre.

**Text** : `Primary text`, `Headline`, `Description`, `Call to action`.
> « **Add multiple text options** and we'll show the one we predict will perform best when your ad
> is delivered. » → Mettre plusieurs variantes, pas une seule.

**Image generation** — *Advantage+ creative image generation* :
> « In our experiment, campaigns with all ads adding AI-generated images saw **10 % CTR lift** and
> **6 % CVR lift**. »

Trois familles proposées : *Refined original look*, *Popular in [catégorie]*, *High return on ad
spend*.

**Video generation** — *Advantage+ creative video generation* : « Ready-made videos and styles to
try », annoncé à **+1,9 % CTR** et **+3,2 % CVR**.

**Enhancements** — *Advantage+ creative enhancements* :
> **« You've been enrolled in testing new creative and AI enhancements, which you can edit in
> Advertising settings. »**

C'est **opt-out, pas opt-in**. Options : *Enhance CTA*, *Add animation*, *Show spotlights*,
*Add product tags*, et côté « essentiels » activés par défaut : *Relevant comments* ✓,
**Adjust brightness and contrast ✓ (on by default)**.

**Chez Lasclay, c'est le paragraphe à lire deux fois.** Un ajustement automatique de luminosité et
de contraste sur une photo de produit change la couleur de la fibre et du tissu. Aller vérifier
dans *Advertising settings* ce qui est activé sur le compte, et décider sciemment — pas par
défaut. Les variantes se prévisualisent dans **Advanced preview → Advantage+ creative**
(*Add overlays*, *Visual touch-ups*, *Add music*, *Text improvements*, *Add animation*,
*Add product tags*), cinq exemples chacune.

**Niveau pub, dernier écran** :
- `Ad name` + Create template
- `Partnership ad` (off) — c'est ici que se branche le **whitelisting** décrit en 4.1 :
  « Run ads with creators, brands and other businesses. Go to Partnership Ads Hub. »
- `Identity` : Facebook Page, Instagram profile, **Threads profile**, WhatsApp phone number

---

## 9. Le tableau de bord

### 9.1 La vue de colonnes à créer dans Meta

La démo travaille dans une vue personnalisée nommée *« MonsieurChalets Ecommerce »*. Les colonnes,
dans l'ordre :

`Purchases conversion value` · `Website purchases (valeur)` · `Website adds to cart` ·
`Website purchases` · `Cost per purchase` · `Purchase ROAS` · `Website purchase ROAS` ·
**`Hold rate`** · **`Hook rate`**

Les deux dernières sont le cœur du sujet et ne sont pas là par défaut.

- **Hook rate** — la proportion de gens qui ne sont pas partis dans les 3 premières secondes.
  C'est la note du hook, isolée du reste.
- **Hold rate** — la proportion qui reste jusqu'à la fin utile. C'est la note du contenu.

Repères observés dans le compte de démo :

| Campagne | Coût/achat | ROAS | Hold rate | Hook rate |
| --- | --- | --- | --- | --- |
| TOF_Corpo_CBO_QC | 38,09 $ | 65,18 | 4,23 % | **18,26 %** |
| TOF_Prospection_CBO_QC | ~55 $ | 26,31 | 4,95 % | **23,18 %** |
| BOOST_Chalets_ABO_QC | 56,84 $ | 43,34 | 2,93 % | **12,49 %** |
| MOF_Retargeting_ABO_QC | 26,58 $ | 84,78 | 0,59 % | 2,4 % |
| **Compte entier (86 campagnes)** | **51,47 $** | **45,96** | **3,30 %** | **~9,2 %** |

Lecture : en prospection froide, un hook rate de 12 à 23 % et un hold rate de 3 à 5 %. Le
reciblage a des ratios beaucoup plus bas parce que l'audience connaît déjà la marque — normal,
et c'est pour ça qu'on ne compare jamais TOF et MOF sur les mêmes seuils.

⚠️ Le ROAS de 26 à 85 est propre à un panier de ~2 400 $ (location de chalet). Ne pas s'en servir
comme repère. Les ratios de rétention vidéo, eux, se transposent.

### 9.2 Le chiffrier hors de Meta

Le pilotage réel se fait dans un Google Sheets **« Budget Marketing »** : une ligne par **jour**,
un onglet par **mois**, plus un onglet **Dashboard Marketing**.

Colonnes : `Journée` · `Ventes` · `Revenus` · `Commission` · `Commission moyenne` ·
**`Coût Google Ads`** · **`Coût Facebook Ads`** · **`Coûts total publicités`** ·
`Ventes Google Ads` · `Commission Google` · **`ROAS Google`** · **`Profit Google`** ·
`Commission − publicités`.

**Chez Lasclay.** L'équivalent existe déjà à moitié : le chiffrier PRÉVISIONS et QuickBooks via le
Finance Proxy. Il manque la ligne quotidienne dépense pub / ventes / profit pendant la saison. Une
colonne `Coût Meta` et une colonne `Ventes Shopify` par jour, du 1er octobre au 5 janvier,
suffisent à voir venir le décrochage avant que le mois soit fini.

---

## 10. Les fails — la diapo la plus utile du deck

> **NOS APPRENTISSAGES… NOS FAILS…**
> 👎 Contenu promotionnel sur une audience **froide** lors d'une vente
> 👍 Nos meilleures pubs **avec des mentions de la vente**
>
> **TOF : laisser rouler nos meilleures pubs.**
> **MOF : convertir notre audience réchauffée avec du contenu promotionnel.**

C'est la règle qui contredit le réflexe de novembre. Le Vendredi fou ne se gagne pas en passant
tout le compte en « −30 % » : on garde les créatifs qui performent en haut de l'entonnoir, et on
ajoute simplement la mention de la vente dessus. La promo pure est réservée aux gens qui
connaissent déjà la marque.

---

## 11. Le plan de saison — 11 septembre 2026 → 5 janvier 2027

Repères : **Vendredi fou le 27 novembre 2026**, **Cyber Monday le 30 novembre**,
**Boxing Day le 26 décembre**. Les dates limites d'expédition de Postes Canada sont à confirmer
en octobre, elles bougent chaque année.

### Phase 0 — 11 au 21 septembre : les fondations (aucune dépense nouvelle)

- [ ] Vérifier pixel + Conversions API, et la qualité des événements `Purchase`.
- [ ] Brancher/rafraîchir le catalogue produits Shopify dans Meta.
- [ ] Créer les audiences d'exclusion `Acheteurs - 180J` et `Acheteurs - 365J`.
- [ ] Créer `MOF_Site_Visitors_30d`, `MOF_Video_Viewers_365d`, `BOF_AddToCart_14d`,
      `BOF_InitiateCheckout_7d` — elles ont besoin de septembre et octobre pour se remplir.
- [ ] Pousser les audiences d'acheteurs à **730 jours** (possible sur les événements d'achat).
- [ ] Créer la vue de colonnes avec **Hook rate** et **Hold rate**.
- [ ] Ouvrir l'onglet quotidien du chiffrier (§ 9.2).
- [ ] Aller lire *Advertising settings* et décider des *creative enhancements* (§ 8.3).
- [ ] **Gain rapide :** classer les publications organiques des 12 derniers mois par engagement,
      et passer les trois meilleures en payant cette semaine (§ 4.10).

### Phase 1 — 22 septembre au 31 octobre : produire et tester

C'est la phase qui décide de la saison. En novembre, il est trop tard pour découvrir un créatif.

- Tournage **atelier** : une banque de 20-30 plans (défibrage, isolant, découpe, insertion des
  coussinets, étiquetage). Réutilisables toute la saison en fond.
- Tournage **terrain** : froid réel, sentier, champ. Le décor fait la preuve.
- **Studio / podcast** : une demi-journée, dix phrases chocs (§ 4.9).
- **5 à 8 UGC** commandés (100 $ + produit, droits illimités, fichiers bruts, whitelisting prévu).
- Test des hooks selon le framework : une variable à la fois, 5× le CPA cible par test,
  3 à 7 jours, pas de kill sur du bruit.
- Structure : `TOF_Prospection_CBO_QC` en broad, budget modeste, uniquement pour trouver les
  gagnants. On ne cherche pas le ROAS ici, on cherche le **hook rate**.

**Objectif de sortie de phase : 3 à 5 créatifs avec un hook rate au-dessus de 12 %.**

### Phase 2 — 1er au 20 novembre : monter en puissance

- Basculer le budget vers les gagnants, répartition **70 / 20 / 10**.
- Activer `MOF_Retargeting_ABO_QC` (éducation, social proof, avant/après).
- Activer `BOF_AbandonPanier_ABO_QC`.
- Continuer à injecter 3 à 5 nouveaux créatifs par semaine — la fatigue créative arrive vite
  quand le budget monte (surveiller la **fréquence** : au-delà de 3-4, c'est le signal).
- Vérifier les délais de production et d'inventaire : ne pas faire monter une pub sur un produit
  qui va rupturer.

### Phase 3 — 21 novembre au 1er décembre : le Vendredi fou

- **TOF : on laisse rouler les meilleures pubs**, avec la mention de la vente ajoutée dessus.
  Pas de créatif promo pur sur froid (§ 10).
- **MOF et BOF : promo assumée**, urgence, dates limites.
- Budget quotidien : se rappeler que Meta peut dépenser **175 %** du budget d'une journée (§ 8.2).
- Format *faux billboard* (§ 4.8) pour annoncer, plutôt qu'une bannière de rabais de plus.

### Phase 4 — 2 au 20 décembre : le cadeau

- Angle cadeau : « fabriqué au Québec », « utile », « l'histoire derrière » — les profils
  *Suzanne et Gilbert* et *Alexandra*.
- Angle B2B / corporatif, qui se décide justement en décembre.
- Compte à rebours sur les dates limites d'expédition (le sablier « Derniers jours pour une
  livraison avant Noël » de la diapo p.41 est exactement ça).
- Pousser les combos et les cartes-cadeaux quand l'expédition devient risquée.

### Phase 5 — 26 décembre au 5 janvier : Boxing week

- Reciblage lourd sur toute l'audience accumulée depuis septembre.
- « Les Imparfaits » et les fins de série : c'est le moment où le rabais est cohérent avec le
  récit de la marque plutôt qu'en contradiction avec lui.
- Capter pour le printemps : les semences et l'infolettre, sur les gens touchés en novembre.

---

## 12. Les décisions, résumées

| Question | Réponse de la conférence |
| --- | --- |
| Qu'est-ce qu'on teste en premier ? | Le hook. Toujours. |
| Combien de budget par test ? | 5× le CPA cible, minimum. |
| Combien de temps avant de conclure ? | 3 à 7 jours. Pas moins. |
| Combien de variables à la fois ? | Une. |
| Quel ciblage ? | Broad. Le créatif fait le ciblage. |
| Quelle répartition de budget ? | 70 TOFU / 20 MOFU / 10 BOFU. |
| Quelle métrique regarder sur un créatif ? | Hook rate, puis hold rate. Le ROAS vient après. |
| Que faire des perdants ? | Ils nourrissent l'apprentissage du prochain cycle. On ne les efface pas sans noter pourquoi. |
| Promo sur audience froide ? | Non. TOF = meilleures pubs + mention de la vente. MOF/BOF = promo. |
| Combien de créatifs par mois ? | Chez Omy, ~50. Le débit est la vraie variable. |
| Quel outil de tracking ? | Pixel + Conversions API côté serveur (Stape). Attribution : Triple Whale. |

---

## 13. Livres cités (diapo p.13 du deck A)

- **$100M Offers** — Alex Hormozi
- **Sell Like Crazy** — Sabri Suby → **lu en entier, voir
  [`sell-like-crazy-methode-et-adaptation.md`](sell-like-crazy-methode-et-adaptation.md)**
- **Expert Secrets** — Russell Brunson

Le livre de Suby couvre précisément ce que la conférence ne couvre pas : **l'offre, la garantie,
les formules de titre, la séquence de nurturing et le courriel.** Il complète ce guide sur trois
points concrets pour la saison :

1. **Pourquoi 70 % du budget va en haut de l'entonnoir** — la formule du marché élargi :
   3 % achètent aujourd'hui, 17 % cherchent de l'information, 20 % sont conscients du problème,
   **60 % ne savent pas qu'ils ont un besoin**.
2. **Comment construire l'offre du Vendredi fou** autrement qu'en « −25 % sur tout » —
   les sept composantes de l'offre du Parrain, et la garantie de force.
3. **Le courriel**, dont la conférence ne parle pratiquement pas, et qui est le seul canal
   que l'entreprise possède réellement.

⚠️ Son chapitre sur le ciblage date de 2019 et vante les critères ultra-ciblés que la conférence
de 2026 déclare morts. Sur ce point, c'est la conférence qui a raison.

---

## Source et précautions

Notes établies à partir des six fichiers du dossier Drive, par extraction des diapositives
(trames recadrées sur l'écran, haute résolution) et transcription audio locale (faster-whisper).
La transcription québécoise est imparfaite ; les citations ont été recoupées avec les diapositives
avant d'être retenues, et celles qui restaient ambiguës ont été écartées plutôt que devinées.

Les captures d'écran montrent le compte publicitaire d'un tiers (MonsieurChalets) tel que présenté
en conférence. Elles servent de référence de méthode à usage interne. Ne pas rediffuser
publiquement les chiffres de ce compte.

---

**Version visuelle** (guide pas-à-pas avec les 40 captures d'écran) :
https://claude.ai/code/artifact/234b57ab-2d38-4deb-b5fe-6b8873d937bd
