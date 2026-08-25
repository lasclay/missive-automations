# Audit : les mentions de fabrication au Québec encore en ligne

**Fait le 24 août 2026** sur lasclay.com, FR et EN. Périmètre couvert : 121 produits, 25 pages,
35 collections, 32 articles de blogue (4 blogues), plus le HTML servi de la page d'accueil, de
`/collections/all`, de `/pages/a-propos`, de `/pages/faq` et de `/en/pages/faq`.

**Rien n'a été modifié.** Le pied de page relève de l'éditeur de thème et la FAQ est une page de
contenu : dans les deux cas la règle du skill `lasclay-seo` s'applique, l'agent prépare, un humain
exécute.

## Le verdict en une ligne

Les fiches produits sont propres. **Le pied de page et la FAQ ne le sont pas**, et la FAQ anglaise
affirme le contraire de la réalité.

C'est ce qui donne raison à Marie L. quand elle écrit « c'est écrit nul part sur leur site ». La
vérité est pire : le site dit l'inverse.

---

# 1. Le pied de page, sur toutes les pages, FR et EN

**Texte actuel :**

> Lasclay
> Produits d'asclépiade cueillis, conçus et fabriqués avec amour au Québec, Canada.

C'est la faute la plus grave, pour trois raisons.

- Le sujet est **« Produits »**, pas l'isolant. C'est exactement l'affirmation à bannir : elle
  rattache la fabrication au produit fini.
- Elle est **sur chaque page du site**, donc sur chaque fiche produit, chaque collection, chaque
  article. C'est le texte le plus répété du domaine.
- **Le pied de page anglais n'est pas traduit** : la version EN sert la même phrase en français à
  un public américain. Bogue distinct, à corriger en même temps.

**Remplacement proposé, FR :**

> Lasclay
> Isolant d'asclépiade cueilli, conçu et fabriqué au Québec, Canada.

**Remplacement proposé, EN :**

> Lasclay
> Milkweed insulation harvested, designed and made in Quebec, Canada.

Un seul mot change en français, « Produits » devient « Isolant », et la phrase redevient vraie sans
rien perdre de sa fierté. C'est d'ailleurs déjà la formulation exacte utilisée dans la section héro
de la page d'accueil : « Isolant d'asclépiade cueilli, conçu et fabriqué au Québec. » Le site se
contredit lui-même à deux endroits de la même page.

⚠️ **Zone jaune.** C'est très probablement un bloc de texte du pied de page dans l'éditeur de
thème, modifiable sans toucher au code. Si la chaîne est codée en dur dans le Liquid, ça passe en
zone rouge : thème dupliqué, aperçu, validation humaine avant publication.

---

# 2. La FAQ, question « Où sont fabriqués vos produits? »

C'est la page qu'une personne consulte précisément pour vérifier l'origine. Elle a deux versions,
et les deux sont fausses.

## Version française

**Texte actuel :**

> La culture de l'asclépiade, la conception, **la fabrication de la majorité de nos produits** et
> leur distribution se font entièrement au Québec. Produire local et réduire l'impact
> environnemental, c'est pour nous une priorité.
>
> **Exception : les manteaux et vestes.** Ils sont fabriqués partiellement en Tunisie.

Et, plus bas, un encadré de résumé :

> **Tout est fait au Québec**, sauf les coquilles de nos manteaux et vestes, produites en Tunisie
> pour des raisons techniques

Deux affirmations fausses. L'exception n'est pas limitée aux manteaux et aux vestes : l'assemblage
textile de la majorité des produits finis se fait hors Québec depuis 2025. Et « tout est fait au
Québec » est l'inverse de la réalité.

Le reste de la réponse est excellent et se garde intégralement : l'expertise textile disparue au
Québec, le coût prohibitif, le choix de la Tunisie pour ses conditions de travail et sa
francophonie, les liens personnels de confiance. C'est le meilleur passage du site sur le sujet.
Seuls le cadrage et l'encadré sont à refaire.

**Remplacement proposé :**

> **Où sont fabriqués vos produits?**
>
> La culture de l'asclépiade, la transformation de la soie en isolant, la conception et le contrôle
> qualité se font au Québec. C'est le cœur de ce qu'on fait et ça ne bouge pas.
>
> **L'assemblage textile de la plupart de nos produits finis se fait maintenant à l'extérieur du
> Québec, surtout en Tunisie.** L'isolant part d'ici vers les ateliers et revient dans le produit.
>
> Quelques produits sont encore entièrement faits ici, notamment nos cosmétiques à l'huile
> d'asclépiade. Ils sont identifiés comme tels sur leur fiche.
>
> **Pourquoi ce choix?** La filière textile québécoise ne possède plus certaines expertises ni les
> machines spécialisées nécessaires. Produire ces pièces ici rendrait les coûts prohibitifs. Nous
> avons choisi la Tunisie pour son expertise reconnue dans le textile, ses conditions de travail
> décentes et modernes, sa proximité avec l'Europe et sa francophonie, et parce que des liens
> personnels de confiance nous y garantissent transparence et suivi direct.
>
> On l'a expliqué publiquement en vidéo et dans les médias plutôt que de changer nos étiquettes en
> silence.

⚠️ **La liste des produits encore faits ici est volatile.** Le skill `lasclay-seo` demande
explicitement de la vérifier auprès de l'équipe plutôt que de la figer. La formulation ci-dessus
renvoie aux fiches produits au lieu de nommer une liste qui vieillira.

## Version anglaise, plus grave

**Texte actuel :**

> **Where are your products made?**
> **Everything happens in Quebec**, whether we're talking about milkweed harvesting, product
> design, manufacturing and distribution. Our philosophy is to produce as locally as possible to
> reduce the environmental impact of the clothing industry.

**La Tunisie n'y est pas mentionnée une seule fois.** La version anglaise n'a jamais été mise à
jour. Un acheteur américain qui pose la question obtient une réponse fausse et sans nuance.

**Remplacement proposé :**

> **Where are your products made?**
>
> Milkweed farming, turning the floss into insulation, product design and quality control all
> happen in Quebec. That is the core of what we do and it is not moving.
>
> **The textile assembly of most of our finished products now happens outside Quebec, mainly in
> Tunisia.** The insulation is made here, shipped to the workshops, and comes back inside the
> product.
>
> A few products are still made entirely here, including our milkweed oil cosmetics. Those are
> identified on their own product pages.
>
> We chose Tunisia for its established textile expertise, its decent and modern working
> conditions, its proximity to Europe and its French-speaking workforce, and because personal
> relationships there give us real transparency and follow-up. Quebec's textile industry no longer
> has some of the specialized machines and know-how these pieces require, and making them here
> would put them out of reach.

---

# 3. Les reprises de presse, à dater sans les censurer

Neuf articles du blogue `zone-media` sont des reprises de couverture médiatique de 2020 à 2025 qui
disent « fabriqué au Québec ». **C'était vrai au moment de leur publication.** Ce ne sont pas des
affirmations de Lasclay, ce sont des citations de journalistes.

Ne pas les réécrire, ce serait falsifier de la presse. Mais Google les sert comme du contenu de
lasclay.com, donc elles pèsent dans ce qu'une IA répond à « est-ce que Lasclay fabrique au
Québec ».

Les deux qui portent le plus :

| Article | Ce qu'il dit |
| --- | --- |
| `cadeaux-quebec-foulard-asclepiade-hiver` (Châtelaine, 2023) | « Cueilli, conçu et fabriqué au Québec, ce foulard... » et « un produit éthique fabriqué avec soin au Québec ». Le titre lui-même : « Cadeaux faits au Québec » |
| `idees-cadeaux-locaux-boite-lunch-asclepiade` (Le Devoir, 2023) | « des produits véganes, responsables et locaux, conçus et fabriqués au Québec » |

**Solution : un encadré daté en tête de chaque reprise antérieure à 2025.**

> *Cet article a été publié en [mois année]. Depuis 2025, l'assemblage textile de la plupart de nos
> produits finis se fait à l'extérieur du Québec, surtout en Tunisie. La culture de l'asclépiade et
> la transformation de la soie en isolant restent ici. [En savoir plus](/pages/faq)*

C'est de la zone verte : contenu réversible, un agent peut l'écrire avec journal avant/après. Et
c'est un signal de fiabilité fort pour les moteurs comme pour les lecteurs.

⚠️ **Un cas à part :** `lasclay-lesoleil-fabrication-asclepiade-quebec` (Le Soleil, 1er déc. 2025)
raconte justement le dilemme de la délocalisation. Ne pas l'encadrer, il est déjà à jour et il
travaille pour vous.

---

# 4. Les produits archivés

Neuf fiches contiennent « Produit végane, responsable et local. **Cueilli, conçu et fabriqué au
Québec, Canada.** » : les préventes de mitaines et de foulards de 2020 à 2022, plus la glacière
imprimée en 3D.

**Toutes sont en statut `ARCHIVED`**, sans `onlineStoreUrl`. Elles ne sont donc pas servies au
public aujourd'hui. Le seul risque résiduel est qu'elles restent dans l'index de Google depuis
l'époque où elles étaient publiques.

Priorité basse. À vérifier avec une requête `site:lasclay.com/products/ "fabriqué au Québec"` dans
Google : si des résultats remontent, demander leur retrait dans la Search Console.

---

# 5. Ce qui est correct et ne doit pas être touché

Ces formulations rattachent la fabrication à l'isolant, ce qui est vrai, rare et précieux. Le skill
demande explicitement de les mettre de l'avant avec fierté.

| Emplacement | Texte |
| --- | --- |
| Section héro, page d'accueil | « Isolant d'asclépiade cueilli, conçu et fabriqué au Québec. » |
| Page **À propos** | « Notre isolant d'asclépiade : végane, responsable et local. Cueilli, conçu et fabriqué au Québec, Canada. » |
| Produit **veste sans manche** | « Isolant cultivé et fait au Québec. » |
| Produit **foulard** (`scarf`) | « Le cœur isolant, en soie d'asclépiade, est cultivé, conçu et fabriqué au Québec. » |
| Produit **mitaines** (`mittens`) | « un isolant végétal cultivé et transformé au Québec » |
| Collection **sacs isothermes** | « isolant d'asclépiade cultivé et fabriqué au Québec » |
| Article **transparence** sur les manteaux | « coussinets isolants amovibles fabriqués au Québec, insérés dans une coquille préassemblée ailleurs » |
| Produits **imprimés 3D** et **illustrations** | « Imprimé en 3D à Québec », « imprimé à Montréal » : vrai, et ce sont des produits réellement faits ici |

Les cosmétiques à l'huile d'asclépiade (crème contour des yeux, collaboration Gourmet Sauvage)
parlent d'ingrédients « d'ici » et d'un savoir-faire du territoire boréal : c'est exact et ça
reste.

---

# Ordre d'exécution

| # | Quoi | Zone | Effort |
| --- | --- | --- | --- |
| 1 | **La FAQ anglaise.** C'est la seule affirmation du site qui nie complètement la Tunisie | verte | 10 min |
| 2 | **La FAQ française.** Corriger le cadrage et l'encadré « Tout est fait au Québec » | verte | 15 min |
| 3 | **Le pied de page**, FR et EN, plus la traduction manquante du pied de page anglais | jaune | 10 min, humain |
| 4 | **Encadré daté** sur les 8 reprises de presse antérieures à 2025 | verte | 30 min |
| 5 | Vérifier l'indexation des 9 fiches archivées | verte | 10 min |

Les trois premiers points suffisent à ce que la réponse publique à Marie L. soit vraie quand elle
dira « on corrige ça, produit par produit ». **Tant qu'ils ne sont pas faits, cette réponse promet
quelque chose que le site contredit trois clics plus loin.**
