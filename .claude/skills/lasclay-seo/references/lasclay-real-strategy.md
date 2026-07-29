# La stratégie SEO réelle déjà en place chez Lasclay

Ce fichier résume le travail SEO durable de Lasclay (taxonomie d'articles, thèmes
et pages prioritaires, structure de la page pilier, exemples, outils). Sers-t'en
comme cadre pour rester cohérent avec l'ADN et la direction de l'équipe, plutôt
que de repartir de zéro.

Important: c'est une connaissance interne, jamais une source à citer publiquement.

## Données vivantes: à chercher dans les outils, pas ici

Ce fichier ne contient volontairement pas la liste de mots-clés à jour ni les
chiffres qui changent vite. Les volumes de recherche, la difficulté (KD) et
surtout les positions actuelles deviennent faux en quelques semaines. Les graver
ici ferait mentir le skill.

Quand tu as besoin de données fraîches (volume, difficulté, position d'une page,
quelles requêtes ramènent déjà du trafic), va les chercher dans les sources
vivantes de Lasclay, au moment de la tâche:

- le tableur de stratégie de contenu SEO de Lasclay (le plan de mots-clés
  maintenu par l'équipe, avec priorités, langue, page cible et raisonnement);
- Ahrefs (volume, difficulté, suivi de positions, profil de liens), par son
  interface ou son API;
- Google Search Console (données réelles du site: requêtes, impressions,
  position moyenne, clics), par son interface ou son API;
- Google Analytics (GA4) pour les conversions et le revenu par page, par son
  interface ou l'API GA4 Data.

Pour un agent qui exécute en autonomie, ces sources se lisent par API au moment
d'agir (voir la boucle de données vivantes dans
`references/technical-international.md`): l'export figé d'hier ne sert qu'à
comprendre le contexte, pas à décider aujourd'hui.

Si ces sources ne sont pas accessibles dans le contexte, demande-les ou dis
clairement que les chiffres doivent être vérifiés, plutôt que d'inventer ou de te
fier à un ordre de grandeur ancien.

## La taxonomie d'articles de Lasclay

Lasclay classe ses contenus cibles en trois types, ce qui guide le gabarit:

- **Definition:** page éducative qui définit et explique un sujet (ex. la page
  monarque, ou des sujets d'adjacence comme une fibre textile). Sert l'autorité et
  la découverte.
- **Definition & Produits:** page éducative qui mène aussi vers les produits (la
  page asclépiade en est l'exemple type). Capte une intention à la fois
  informationnelle et transactionnelle.
- **Liste (listicle):** article de type "meilleurs X" ou "marques de X" où Lasclay
  figure (ex. vêtements écoresponsables, idée cadeau). Capte la demande commerciale
  et d'adjacence.

Relie cette taxonomie au mappage requête vers page de keyword-research.md.

## Les pages prioritaires à renforcer (FR)

Ces priorités sont durables; les chiffres précis (volume, KD, position) se
vérifient dans les outils au moment d'agir, pas ici.

- **Page asclépiade** (`lasclay.com/pages/milkweed-asclepiade`). Terme cible
  "asclépiade" et ses longues traînes ("asclépiade commune"). Demande forte au
  Canada et difficulté faible (vérifie les valeurs courantes), déjà bien classée
  mais perfectible. Plan de l'équipe: enrichir cette page pour qu'elle dépasse la
  page produit sur le terme. URL plus courte envisagée (`/pages/milkweed`) et
  titres meta plus riches en mots-clés ("Asclépiade : Description, rôle et
  utilisation | Lasclay"). C'est la page pilier de référence (voir l'exemple plus
  bas).
- **Page monarque** (`lasclay.com/pages/monarch-butterfly-papillon-monarque`).
  Terme cible "papillon monarque", bonne demande, position encore à améliorer
  (vérifie la position actuelle). Plan: ajouter une description du papillon en
  lui-même (pas seulement son lien avec l'asclépiade), brève, autour de 500 mots,
  pour mieux ressortir sur le terme.

## L'occasion la plus rentable: les pages produit coincées en page 2

Constat durable tiré des données réelles de Search Console: l'occasion organique
la mieux rentabilisée de Lasclay n'est pas de créer du contenu neuf, mais de
pousser vers la première page de Google des pages produit qui captent déjà
beaucoup d'impressions tout en restant en page 2 ou en bas de page 1. Ces pages
sont à un cheveu de la bascule: un petit renfort on-page (titre et méta plus
riches, FAQ, réponse directe, terme cible mieux placé) et quelques liens internes
éditoriaux suffisent souvent à les faire passer. C'est le meilleur rapport
effort/impact, et c'est ce qui fait croître le trafic hors marque, puisque
l'essentiel des clics actuels vient encore du nom de marque.

La règle d'ordonnancement est durable; quelles pages précises sont concernées,
et à quelle position, est une donnée vivante à vérifier dans Search Console au
moment d'agir (filtre par page, 28 derniers jours, tri par impressions, repère
les positions proches de la première page). Les familles de produits typiquement
en jeu: les accessoires d'hiver (mitaines, cache-cou) et les produits estivaux à
forte demande (sac à lunch isotherme, glacière souple), plus certaines pages
anglaises sur les semences et le terme générique milkweed. Attaque-les avant de
lancer de nouveaux chantiers de contenu, puis soutiens chacune par une grappe
éditoriale (voir content-strategy.md).

Note de prudence sur une page déjà gagnante: la page asclépiade classe déjà très
haut sur son terme, avec un titre déjà optimisé. Ne la déstabilise pas; tout
effort de page neuve doit viser une demande non captée, pas retoucher une position
acquise. Son taux de clic est bas, mais c'est structurel: sur cette requête
d'information, l'encadré de connaissances, les images et le résumé de Google
avalent la plupart des clics, et être premier ne change pas ça. Donc ne perds pas
de temps à réécrire son titre ou sa méta, ce serait sans effet. Le geste payant sur
cette page est plutôt de se servir de son autorité et de son trafic pour pointer
vers les pages produit par des liens internes (mitaines, lunch bag, semences):
c'est ainsi qu'on convertit une page d'autorité en ventes. Et rappel d'analyse: ses
impressions sont le fruit du travail passé, pas une raison d'y creuser encore;
mieux vaut créer de nouveaux contenus qui génèrent de nouvelles impressions
ailleurs.

## Les listes commerciales et d'adjacence (surtout US)

Lasclay vise des articles de type liste, souvent pour le marché américain, avec
des versions par pays (il suffit souvent d'ajouter "in Canada" au titre et
d'adapter le contenu). Exemples de thèmes retenus par l'équipe: vêtements
écoresponsables, vêtements véganes, marques de maquillage véganes, vêtements en
fibres naturelles. Logique: figurer dans ce genre de listicle attire une demande
commerciale déjà existante. (Quels termes valent l'effort maintenant, et à quel
volume ou difficulté: à confirmer dans le tableur et Ahrefs.)

Au-delà, l'équipe a repéré des sujets d'adjacence en haut de tunnel pour attirer
un public écoresponsable qui pourrait s'intéresser à l'asclépiade, même si le lien
est indirect: zéro déchet, vegan leather (un guide ultime de 3000 mots et plus est
envisagé), outdoor shower, recycled / upcycled / minimalist / slow fashion / fast
fashion, "hairyballs" (même famille botanique, très cherché aux US), "what is
modal fabric", et la cosmétique écoresponsable (eco friendly / sustainable makeup)
pour préparer une future niche maquillage. Et des listicles cadeaux populaires au
Québec (idée cadeau femme, homme, Noël) où il est toujours bon de figurer.

Garde-fou Lasclay sur l'adjacence: ces sujets attirent du trafic de haut de
tunnel, pas des acheteurs immédiats. Ils servent la notoriété et l'amorçage, pas
la conversion directe. Et reste honnête: l'asclépiade n'est ni recyclée, ni
upcyclée, ni du modal; on attire un public proche, on ne prétend pas être ce qu'on
n'est pas.

## Les semences: un levier d'acquisition et de mission, pas un centre de profit

Comprendre le modèle des semences change la façon de faire leur SEO. L'asclépiade
est une vivace: une fois qu'un client a ses plants, il ne rachète pas, la plante
revient seule. Le marché d'un territoire se sature donc vite. D'où le schéma
observé: première année dans un territoire très profitable (le Québec à ses
débuts), puis déclin, et le même schéma se répète au Canada anglais et aux
États-Unis. Les semences sont surtout un filler de ventes en basse saison et, de
plus en plus, un outil d'acquisition de clientèle, possiblement offert
gratuitement à terme.

Conséquence pour le SEO: les semences ne se jugent pas au revenu, mais à
l'acquisition et à la mission. Le gros trafic sur les pages de semences (la fiche
anglaise était la plus consultée du site) n'est pas une visite vide; il est mal
mesuré si on le compte en ventes de graines. Sa valeur réelle:

- **Acquisition.** Ce public passionné par l'asclépiade et le monarque doit être
  capté (inscription courriel, offre de semences en aimant à prospects) plutôt que
  laissé filer. Si les semences deviennent gratuites, la page de semences devient
  une page d'acquisition: son objectif n'est plus le revenu mais l'entrée dans la
  marque, qui nourrit les ventes futures de produits.
- **Canalisation vers les produits qui rapportent.** Depuis les pages de semences
  et de mission, pointer vers les produits qui se vendent et s'expédient (mitaines,
  lunch bag, glacières, cache-cou). C'est ainsi qu'on transforme l'autorité et
  l'acquisition en ventes.
- **Mission et autorité.** Le contenu semences, asclépiade et monarque construit
  l'autorité thématique du site, indépendamment des ventes de graines.

Sur l'expédition aux États-Unis: c'est possible mais par une voie de contournement
en poste timbre, lourde et peu profitable. Donc on ne vise pas le marché américain
sur des requêtes d'achat de semences pour vendre des graines; on traite ce trafic
en acquisition (capture et canalisation vers les produits expédiables). Distinguer
l'anglais Canada de l'anglais US reste utile, mais l'orientation acquisition
s'applique aux deux puisque le marché des semences se sature partout.

Règle générale qui en découle: avant de viser une requête pour la vente, vérifie
que le produit visé est réellement profitable et expédiable vers le marché. Sinon,
la requête peut quand même valoir la peine, mais pour l'acquisition ou l'autorité,
pas pour la vente directe; juge-la alors sur ces objectifs, et prévois la capture
(courriel) et la canalisation vers un produit vendable.

## L'exemple de page pilier: l'asclépiade

La page asclépiade existante est l'exemple type d'une page pilier bilingue bien
faite, à réutiliser comme modèle. Sa structure (miroir FR et EN, adaptée et non
traduite mot à mot):

1. Définition de l'asclépiade commune (nom latin, noms communs, aire de
   répartition, espèces indigènes du Québec).
2. "Une mine d'or pour les pollinisateurs" (nectar, pollen, longue floraison).
3. "Plante hôte du papillon monarque" (cardénolides, symbiose, co-évolution).
4. "Le déclin des asclépiades et du papillon monarque".
5. "La soie d'Amérique comme isolant thermique" (structure tubulaire, hydrophobie,
   garde au chaud et au sec).
6. "Autres usages industriels" (flottaison pendant la guerre et le kapok, absorbant
   de déversements pétroliers, literie Ogallala, cosmétiques).

C'est un bon patron: réponse claire en tête de section, sous-titres explicites,
profondeur réelle, ancrage botanique crédible, et pont naturel vers les produits.
Note de voix: la version existante emploie une fois "miraculeuse" et parle de "la
révolution de l'asclépiade". C'est cohérent avec le garde-fou (ces mots se
manient avec parcimonie); dans un contenu informatif sérieux, préfère en général
des formulations sobres et fais l'inventaire avant d'en rajouter.

## L'exemple de placement en listicle: le cadeau cycliste

Lasclay a déjà été inséré dans des articles de type liste (par exemple "idées de
cadeaux écolo pour un Noël de cycliste", aux côtés d'autres marques québécoises,
avec son ensemble d'hiver et un clin d'oeil à la Véloroute des Monarques). C'est
l'illustration concrète de la tactique d'inclusion en listicle et de la voix de
marque chaleureuse et engagée. Vise ce genre de placement éditorial pour la
notoriété et les mentions.

## Les outils utilisés (pile observée)

Le travail de Lasclay s'appuie notamment sur Ahrefs (recherche de mots-clés,
volume, difficulté, suivi de liens), Google Search Console, Google Analytics et
Google Tag Manager, et des outils techniques comme Screaming Frog ou Sitebulb pour
les audits, Shortpixel ou Imagify pour les images, GTmetrix et PageSpeed pour la
vitesse. Lasclay tient aussi une checklist SEO opérationnelle (style SEO Buddy)
qui note chaque action par impact, difficulté et coût pour en déduire une
priorité.

Mise en garde sur cette checklist: elle est utile pour ne rien oublier, mais
c'est un gabarit générique qui contient des éléments datés ou contestés à ne pas
appliquer tels quels (le "dwell time" et les signaux sociaux comme facteurs de
classement, la soumission à des annuaires généralistes, les liens de commentaires
de blogue, l'objectif de "contenu 10x" ou "long-form" pour le volume). Prends-la
de façon critique et fie-toi d'abord aux principes des autres fichiers de
référence. À noter aussi: la checklist mentionne des outils orientés WordPress
(Yoast, WP Rocket) alors que les URL de Lasclay (`/pages/...`) pointent plutôt
vers Shopify; confirme la plateforme avant d'appliquer un conseil propre à un CMS.
