# SEO technique et site bilingue

But: s'assurer que les moteurs et les assistants IA peuvent trouver, explorer,
indexer et comprendre lasclay.com, et que les versions française et anglaise se
servent au bon public sans se nuire. La plupart des sites bien faits sont
explorés et indexés sans intervention; la valeur du technique est d'enlever les
obstacles et de clarifier la structure.

Hypothèse de travail: le site tourne sur une plateforme hébergée de commerce
(probablement Shopify). Les principes ci-dessous sont universels; les notes
"Shopify" indiquent où la plateforme gère déjà une partie du travail. À ajuster
si la plateforme diffère.

## Exploration et indexation

- Vérifie si une page est déjà indexée avec l'opérateur `site:lasclay.com` dans
  Google, ou avec l'outil d'inspection d'URL dans Google Search Console (GSC).
- Assure-toi que Google voit la page comme un visiteur: si du contenu important
  dépend de scripts que le moteur ne charge pas, il peut le manquer. L'outil
  d'inspection d'URL de GSC montre ce que Google voit.
- Pour empêcher l'indexation d'une page (panier, compte, pages internes), utilise
  `noindex` ou `robots.txt` selon le cas, jamais pour bloquer par erreur des
  pages que tu veux voir classées.

## Sitemap et robots.txt

- Le sitemap XML liste les pages que tu veux faire indexer. Shopify en génère un
  automatiquement, en général à `lasclay.com/sitemap.xml`. Soumets-le dans GSC
  pour accélérer la découverte, surtout pour les nouvelles pages sans liens
  entrants.
- `robots.txt` (souvent à `lasclay.com/robots.txt`) indique aux robots ce qu'ils
  peuvent explorer et pointe vers le sitemap. Évite d'y bloquer des ressources
  utiles. Ne bloque pas les robots d'IA légitimes si tu veux apparaître dans
  leurs résultats.

## Contenu dupliqué, canonical et variantes

C'est l'enjeu technique le plus courant en commerce en ligne.

- Le contenu dupliqué (même contenu sous plusieurs URL) n'est pas une pénalité,
  mais il gaspille l'exploration et sème la confusion. Les moteurs choisissent
  une URL canonique par contenu.
- **Variantes de produit** (couleurs, tailles): elles créent souvent des URL
  multiples très semblables. Utilise une URL canonique qui pointe vers la fiche
  produit principale pour consolider la valeur, plutôt que de laisser chaque
  variante se disputer le classement. Shopify gère une partie de ça, mais
  vérifie les balises canoniques générées.
- **Paramètres d'URL** (tri, filtres de collection): ils multiplient les URL.
  Préfère des versions canoniques propres et évite de laisser indexer des
  combinaisons de filtres sans valeur.
- Quand tu remplaces une page, redirige l'ancienne URL vers la nouvelle en 301.
- **Pages sans valeur indexées (zombies).** Surveille le nombre de pages indexées
  dans Search Console. En commerce, des pages de résultats de recherche interne,
  de filtres, ou de vieux contenus minces se retrouvent souvent dans l'index sans
  rien apporter. Mets-les en noindex, fusionne-les ou supprime-les: moins de pages
  mais meilleures aide l'exploration et le classement (voir aussi
  content-strategy.md).

## Audit régulier

Un site accumule des problèmes avec le temps: liens internes cassés, pages
orphelines (sans lien entrant), titres ou méta manquants ou dupliqués,
redirections en chaîne, images sans alt. Plutôt que de tout vérifier à la main,
lance un audit périodique avec un outil de crawl (Search Console donne déjà
beaucoup, et des outils comme Screaming Frog, Ahrefs ou Semrush crawlent le site
et listent les problèmes par priorité). Corrige d'abord ce qui bloque
l'indexation et les liens cassés, surtout s'ils faisaient perdre des liens
entrants à une page que tu veux classer.

## Structure d'URL et du site

- URL descriptives et groupées par répertoires cohérents (produits, collections,
  blogue). Sur un site plus grand, ça aide les moteurs à comprendre la fréquence
  de changement et les relations entre pages.
- Garde une hiérarchie logique: accueil, collections, fiches, et une section
  blogue/asclépiade pour le contenu éducatif. Le maillage interne matérialise
  cette hiérarchie (voir on-page-and-pages.md).

## Vitesse, mobile, expérience de page

- Plus de la moitié des recherches se font sur mobile: le site doit être
  agréable et lisible sur petit écran.
- La vitesse compte (Core Web Vitals: chargement, interactivité, stabilité
  visuelle). Les images mal compressées sont la cause la plus fréquente de
  lenteur en commerce: compresse-les. Un CDN aide si la vitesse devient un
  problème.
- HTTPS obligatoire (chiffrement), c'est un signal de confiance de base.
- Évite les fenêtres surgissantes intrusives qui couvrent le contenu: elles
  nuisent à l'expérience et peuvent peser sur le classement.

## Données structurées (balisage Schema)

Le balisage rend les pages éligibles à des résultats enrichis (étoiles d'avis,
infos produit, carrousels). Utile pour Lasclay:

- **Product** sur les fiches: nom, image, description, prix, disponibilité, et
  avis si présents. Pour les variantes, suis les recommandations sur les
  variantes de produit.
- **Organization** sur le site pour la marque Lasclay (logo, profils).
- **BreadcrumbList** pour le fil d'Ariane (aide aussi les URL à s'afficher en
  miettes de pain).
- **FAQPage** sur les pages qui répondent à des questions (fiches avec FAQ,
  articles).
- **Article** sur les contenus de blogue.

Le balisage doit refléter le contenu réel et visible de la page, jamais des
infos absentes ou trompeuses.

## Site bilingue et international (FR / EN)

Lasclay sert le Québec francophone, le Canada anglophone et l'expansion
américaine. Le bilinguisme n'est pas une traduction mécanique.

- **hreflang:** indique à Google les versions linguistiques et régionales d'une
  page (par exemple fr-CA, en-CA, en-US) pour qu'il serve la bonne version au bon
  public et évite de traiter les versions comme du contenu dupliqué. Chaque
  version doit se référencer elle-même et référencer les autres.
- **Contenu adapté, pas traduit mot à mot:** aux États-Unis, appuie-toi sur
  "milkweed", "monarch", "native plant" et la pertinence régionale. Les angles
  changent selon la familiarité du marché avec l'asclépiade et le monarque.
- **Approche régionale aux États-Unis:** teste par régions plutôt que de traiter
  le pays comme un bloc. Le Nord-Est partage le climat et les produits d'hiver du
  Québec; le Midwest a un lien agricole fort avec l'asclépiade; l'Ouest est
  sensible au plein air et à l'environnement mais très concurrentiel.
- **Cohérence des coordonnées:** garde le nom, l'adresse et le téléphone (NAP)
  cohérents partout (site, fiche d'établissement Google, annuaires). Utile pour
  la confiance et le SEO local.
- **ccTLD vs domaine unique:** lasclay.com (.com) convient pour viser plusieurs
  pays; le ciblage se gère alors par hreflang et le contenu, pas par le domaine.

## SEO local (Québec)

Lasclay est avant tout du commerce en ligne livré partout, donc le SEO local est
secondaire. Il devient pertinent là où il y a une présence physique (l'atelier de
Limoilou, des points de vente) ou pour capter la recherche locale de cadeaux
("cadeau local Québec", "boutique écoresponsable Québec", recherches "près de
moi"). Le SEO local ne consiste pas à classer des pages de blogue, mais surtout à
faire ressortir une fiche d'établissement Google. Trois facteurs y jouent: la
proximité (que tu ne contrôles pas), la pertinence et la notoriété (que tu
contrôles).

Si une présence physique le justifie:

- **Fiche d'établissement Google complète.** C'est le premier levier. Choisis
  plusieurs catégories pertinentes (pas une seule), liste largement les services
  ou types de produits, remplis tous les champs (description, attributs, photos,
  horaires, questions-réponses), et garde la fiche active (publications, photos,
  réponses aux avis). Une fiche complète et active inspire plus confiance qu'une
  fiche à moitié vide.
- **Avis.** Recueille des avis et réponds-y, tous, sereinement (voir la voix de
  marque pour le ton).
- **Cohérence site et fiche.** La page du site liée à la fiche (souvent l'accueil)
  doit confirmer qu'il s'agit du même commerce: nom, adresse et téléphone
  identiques au caractère près, mention de la ville et de la catégorie dans le
  titre et le H1 quand c'est pertinent, et balisage d'établissement local.
- **Contenu localement pertinent** quand c'est utile (présence régionale, points
  de vente au Canada), sans tomber dans des pages de ville creuses qui ne font
  que changer le nom de la ville.

Note: certains systèmes de SEO local très poussés (cartes de classement,
multiplication de pages de quartier, liens de chambres de commerce) sont conçus
pour des entreprises de services locaux comme la plomberie. Pour Lasclay, qui
vend en ligne à l'échelle nationale, ce niveau de détail est rarement justifié.
Garde l'effort proportionné.

## Quand intervenir

Ne réorganise pas tout le site d'un coup. Le technique sert à lever des
obstacles précis et à clarifier la structure. Priorise: indexation correcte,
canoniques propres sur les variantes, vitesse des images, hreflang bien posé,
données structurées sur les fiches. Mesure ensuite dans Search Console.

## Exécution autonome sécuritaire

Cette section encadre tout agent qui a un accès en écriture réel au site Shopify
de Lasclay, notamment pour du travail non supervisé en temps réel (tâche
nocturne, file de tâches). Le garde-fou court est dans le SKILL; voici le détail.
La règle de fond: le niveau d'autonomie suit la réversibilité du geste.

### Le périmètre d'écriture, par zone

- **Zone verte, autorisée en écriture autonome:** titres SEO, méta descriptions,
  descriptions de produits et de collections, textes de page, balises ALT,
  articles de blogue (créés en brouillon). C'est du contenu réversible: en cas
  d'erreur, on restaure l'ancienne valeur depuis le journal.
- **Zone jaune, l'humain assisté d'une IA:** les réglages de l'admin Shopify qui
  ne s'automatisent pas proprement et les gestes au niveau du thème depuis
  l'interface (par exemple compresser les images trop lourdes qui plombent le LCP,
  remplacer un visuel d'accueil). L'agent prépare, recommande, guide pas à pas;
  l'humain clique.
- **Zone rouge, jamais en autonomie:** le prix, l'inventaire, et le code du thème
  (Liquid, balises head, CSS, correctifs de vitesse au gabarit). Le code du thème
  ne se touche jamais en production directe: toujours sur une copie (thème
  dupliqué, aperçu), validée par un humain avant publication.

### La particularité Shopify à connaître absolument

Shopify n'offre pas de mode brouillon pour les métadonnées (titre SEO, méta,
description): toute modification de ces champs est publiée immédiatement, il
n'existe pas de version en attente. La sécurité ne peut donc pas reposer sur un
brouillon qui n'existe pas. Elle repose sur les filets ci-dessous. Les articles
de blogue, eux, ont un vrai statut brouillon (isPublished: false): on s'en sert.

### Les filets de sécurité, à appliquer sans exception

1. **Journal avant/après, écrit sur disque, pour chaque changement.** Note la
   page, le champ, l'ancienne valeur et la nouvelle. C'est ce qui permet
   d'annuler. Sans journal, pas d'écriture autonome.
2. **Contrôle qualité par un second agent avant publication.** Le réviseur relit
   la voix de marque, les garde-fous (cadratins, mots sensibles, promesses
   absolues, chiffres inventés), l'exactitude factuelle et la cohérence SEO
   (intention, mot-clé, maillage). Un agent ne publie pas son propre travail sans
   cette relecture.
3. **Travail par lots raisonnables, pas en masse.** Un petit nombre de pages par
   exécution. Modifier des centaines de métas d'un coup crée du bruit pour les
   moteurs et rend le journal ingérable. La prudence vaut mieux que la vitesse.
4. **Plafond de changements par exécution,** pour borner le risque d'une tâche
   automatisée qui dérape.
5. **Liste blanche des champs modifiables,** codée en dur quand un script écrit
   sur le site: seuls les champs de zone verte passent, le prix, l'inventaire et
   le thème sont exclus par construction, pas seulement par consigne.
6. **Mode simulation par défaut.** Tout script d'écriture démarre en simulation
   (n'écrit rien, affiche seulement ce qui serait fait). On n'active l'écriture
   réelle qu'après avoir vérifié longuement la simulation.
7. **La révision humaine reste le dernier filet,** surtout sur la voix. Aucune
   automatisation ne remplace un humain qui lit avant que ça devienne public sur
   un volume sensible.

### La règle non négociable

Aucun article de blogue n'est publié automatiquement. L'agent le crée toujours en
brouillon (isPublished: false) et attend l'approbation humaine. C'est le canal le
plus sûr pour le contenu long, et la règle ne souffre aucune exception.

### Organisation multi-agents

Quand plusieurs agents travaillent ensemble, sépare les rôles: un agent
rédacteur qui produit en zone verte, un agent réviseur qui fait le contrôle
qualité, et l'humain qui garde la main sur les zones jaune et rouge et sur la
publication finale. Cette séparation est elle-même un filet: le rédacteur ne juge
pas son propre travail.

### La boucle de données vivantes (entrées de l'agent)

Un agent autonome ne se fie jamais à un export figé pour décider. Il tire ses
données au moment d'agir, des sources en temps réel, puis agit sur cette base.

- **API Google Search Console** (gratuite): la source principale de priorisation.
  Clics, impressions, position moyenne et requêtes par page sur une fenêtre
  récente. C'est ce qui révèle les pages à sauver (haute impression, faible taux
  de clic) et les pages proches de la première page.
- **API GA4 (Google Analytics Data)** (gratuite): conversions et revenu par page,
  pour prioriser l'impact business et pas seulement le trafic.
- **API Ahrefs** (payante, optionnelle): volumes de recherche et difficulté à
  jour, suivi de positions. Utile pour évaluer une cible neuve; Search Console
  suffit pour optimiser l'existant.
- **API Shopify Admin (GraphQL), en lecture**: l'état courant des fiches, pages,
  titres et métas, lu avant toute écriture pour constituer le journal avant/après.

À chaque balayage périodique, archive aussi les données Search Console lues (par
exemple dans une feuille). Search Console n'en garde que 16 mois; sans archivage,
l'historique réel des clics et du taux de clic s'efface. Le balayage mensuel fait
donc double emploi: il optimise et il préserve les données dont toute la mesure
dépend.

La boucle saine: tirer les données fraîches, prioriser à partir d'elles, rédiger,
faire relire par un second agent, écrire en zone verte avec journal, mesurer
ensuite dans Search Console. La file de tâches se recalcule sur les données du
jour plutôt que d'être figée d'avance. Démarrer toujours en mode simulation sur un
petit volume pour valider la priorisation et la qualité avant d'activer l'écriture
réelle.

### Cadence: ponctuel plutôt que récurrent

La plupart des tâches SEO sont des chantiers ponctuels, pas des routines: un titre
ou une méta bien réécrits restent bons, les balises ALT une fois écrites sont
finies, le maillage interne une fois posé est posé, et la rédaction d'articles est
un backlog fini qu'on épuise. On les exécute par lots, on révise, c'est fait. Ne
programme pas une routine récurrente pour un travail qui ne se refait pas: ça crée
du bruit et du risque pour rien.

Ce qui est réellement récurrent, c'est la détection, pas la réécriture: un
balayage léger et périodique (mensuel suffit en général) de Search Console pour
repérer le nouveau, une page qui glisse, une page fraîchement à fort impressions
et faible taux de clic, un produit ajouté à optimiser. Plus du ponctuel déclenché
par un événement (un nouveau produit mérite ses titres, ALT et description). Donc
le bon rythme: un blitz initial pour nettoyer l'existant, puis un audit léger
périodique, pas une machine qui écrit en continu.

Le mensuel n'est pas arbitraire: Search Console a besoin d'environ 28 jours de
données pour qu'une tendance soit fiable. Réoptimiser plus souvent, ce serait
réagir à du bruit. Corollaire, la période de repos: quand l'agent vient de
réécrire une page, il la laisse tranquille 6 à 8 semaines avant d'y retoucher, le
temps de mesurer proprement l'effet et d'éviter de tourner en rond sur la même
page.

### Choix du modèle selon le jugement requis

Le modèle se choisit par tâche, pas une fois pour toutes. Règle: plus la tâche
demande de la voix de marque et du jugement stratégique, plus le modèle doit être
fort.

- **Modèle le plus fort (Opus) pour la création à fort jugement:** titres, méta
  descriptions, articles, descriptions de produits, et balises ALT des images
  importantes. C'est là que se joue la voix et l'alignement sur les deux objectifs
  (autorité et ventes); un modèle plus léger produit du correct mais plat, qui
  dilue la marque.
- **Modèle léger (Sonnet ou Haiku) pour le peu-de-jugement:** lire les données et
  repérer les pages candidates, appliquer un plan de liens déjà écrit, tâches
  mécaniques et répétitives.
- **Réviseur en modèle fort:** le contrôle qualité qui relit voix, garde-fous et
  exactitude mérite un modèle fort, pas un modèle d'appoint.

Comme le travail à fort jugement est surtout ponctuel (voir la cadence ci-dessus),
utiliser le meilleur modèle dessus coûte une fois, pas en continu: mets la qualité
là où elle reste, garde le modèle léger pour la détection périodique.

### Filets supplémentaires pour l'écriture autonome

Trois garde-fous qui rendent l'écriture autonome plus sûre et auto-correctrice.

- **Photo avant, retour arrière si c'est pire.** Avant chaque changement, en plus
  de l'ancienne valeur, note les chiffres actuels de la page (clics, impressions,
  taux de clic, position sur 28 jours). Au balayage suivant, si la page a empiré
  depuis le changement, restaure l'ancienne valeur depuis le journal. Le journal
  devient ainsi un filet actif, pas juste un annuler manuel.
- **Révision humaine graduée selon l'importance de la page.** Les pages phares
  (asclépiade, accueil, meilleurs vendeurs) passent toujours par un oeil humain
  avant publication; les pages de longue traîne à faible trafic peuvent être plus
  autonomes. L'humain reste le dernier filet là où ça compte, sans devenir un
  goulot sur le trivial.
- **Coupe-circuit.** Si le trafic organique global du site baisse nettement après
  une série de changements, l'agent met l'écriture en pause et alerte l'humain au
  lieu de continuer. Mieux vaut s'arrêter et faire vérifier que d'empiler des
  changements sur une tendance négative.
- **Vérifie l'état réel avant d'exécuter une tâche d'un backlog.** Une liste de
  tâches venue d'un consultant ou d'un audit (par exemple le backlog de Franck)
  est une liste de candidates, pas une vérité: une partie peut déjà être faite. Le
  titre de la page asclépiade, par exemple, porte déjà la réécriture proposée.
  Avant d'agir sur un item, confronte-le au site en direct: si c'est déjà fait
  correctement, passe au suivant; ne refais pas, et surtout n'écrase pas du bon
  travail par une correction d'un problème déjà réglé.
