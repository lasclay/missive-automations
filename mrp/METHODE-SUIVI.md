# Méthode de suivi de production

L'outil ne suffit pas : un champ d'avancement que personne ne met à jour donne
un chiffre faux, ce qui est pire que pas de chiffre du tout. Ce document dit
**qui met à jour quoi, quand, et ce que le chiffre veut dire**.

Il est court exprès. Une méthode que personne ne lit ne s'applique pas.

---

## La règle en une phrase

**Montassar met à jour l'avancement de chaque item sur lequel il a travaillé,
à la fin de sa journée de travail. Gabriel et Catherine posent les priorités.**

Les deux rôles de l'app portent leur lieu : **Atelier Tunisie** et **Admin QC**.
Ce n'est pas une hiérarchie, c'est un partage géographique — chacun est seul à
savoir ce que l'autre ne peut pas voir.

Les deux moitiés comptent. L'atelier est seul à savoir ce qui est fait ;
Québec est seul à savoir ce qui presse. Ni l'un ni l'autre ne fait le travail
de l'autre.

**Tout part à zéro.** Aucun avancement n'est saisi à l'import : le plan donne
des quantités, pas de l'avancement. Le premier chiffre de chaque item vient de
Montassar, pas d'une estimation posée depuis Québec.

C'est tout. Le reste de ce document explique pourquoi cette phrase est
suffisante, et ce qui se passe quand elle n'est pas respectée.

---

## Ce que le pourcentage veut dire

Un item d'ordre de production est une ligne : *2 000 cache-cous adultes*.
Son avancement va par tranches de 10 %, de 0 à 100.

**Le chiffre est une estimation de pièces terminées, pas d'effort dépensé.**

- 2 000 cache-cous à **40 %** = environ 800 cache-cous finis.
- Ce n'est **pas** « j'ai fait 40 % du travail » ni « j'en suis à 4 étapes
  sur 10 ».

Cette distinction est le cœur de la méthode. Un cache-cou coupé mais non
matelassé ne compte pas : il n'est pas fini. C'est ce qui rend le chiffre
utilisable pour savoir ce qui rentrera dans le conteneur.

**Pourquoi 10 % et pas un compte exact ?** Parce qu'un compte exact demande de
compter, et que compter 2 000 pièces prend plus de temps que d'en produire
cinquante. Une tranche de 10 % sur 2 000 pièces vaut 200 pièces — la précision
est suffisante pour planifier, et le coût de saisie est nul : six boutons sur
un téléphone.

**Ce que le chiffre n'est pas :** une mesure. Personne ne le vérifie. Il vaut
ce que vaut le jugement de celui qui le pose. C'est assumé — et c'est pour ça
que la personne qui produit est la seule à pouvoir le donner.

---

## Qui fait quoi

| | Montassar (Atelier Tunisie) | Gabriel et Catherine (Admin QC) |
| --- | --- | --- |
| Met à jour l'avancement | **oui, c'est sa responsabilité** | en dépannage seulement |
| Pose les priorités | non | **oui, c'est la leur** |
| Crée les ordres et les échéances | non | oui |
| Commente un blocage | oui | oui |
| Consulte tout | oui | oui |

**Québec ne met pas à jour un avancement à la place de l'atelier.** Si le
chiffre vient de Québec, il vient d'une supposition, et la supposition entre
dans la base avec le même poids qu'une observation. Quand Québec a besoin d'un
chiffre, la bonne action est de **commenter l'ordre pour le demander**, pas de
l'inventer.

---

## La cadence

**Fin de journée de travail, chaque jour travaillé.** Pas le lundi matin pour
la semaine passée : à sept jours de distance, on ne se souvient plus.

Concrètement, sur le téléphone : ouvrir **À fabriquer**, toucher l'ordre,
toucher la tranche pour chaque item touché dans la journée. Trois ou quatre
gestes. Les pages font moins de 10 Ko — ça passe sur la connexion tunisienne.

**Un item qui n'a pas bougé ne demande aucune action.** On ne « confirme » pas
qu'il n'y a rien eu. Le silence veut dire « pas de travail là-dessus », et
c'est exactement ce que la page de suivi affiche.

---

## Les quatre écrans, et à quelle question chacun répond

### À fabriquer — « qu'est-ce que je fais en premier ? »

Tout ce qui reste à produire, tous ordres confondus, **déjà trié**. Le rang
n'est pas un champ qu'on saisit, c'est un calcul :

1. **la priorité posée à la main** — haute, normale, basse ;
2. **le retard** — un ordre dont une échéance est passée passe devant ;
3. **la date d'expédition vers le Canada** — c'est elle qui commande tout : ce
   qui n'est pas fini le 1er octobre ne part pas ;
4. **la famille de production** — hiver, puis nouveaux produits, puis les
   sacs, puis le reste ;
5. **la quantité restante**, décroissante — à famille égale, le gros morceau
   d'abord, parce que c'est lui qui risque de ne pas rentrer.

### Pourquoi cet ordre de familles

L'hiver d'abord : c'est ce que la prévente d'automne vend. Les nouveaux
produits ensuite, parce qu'ils portent le risque — un échantillon à valider,
un patron à confirmer, un tissu à trouver — et qu'un retard sur eux coûte
moins qu'un retard sur un produit déjà vendu. Les sacs après : ils se vendent
au printemps, ils ont le temps.

Les quatre familles vivent dans `donnees/correspondances.tsv`, une colonne par
produit. Elles se changent aussi dans l'app, produit par produit — c'est un
classement d'exploitation, il bouge.

**Un produit à la fois d'hiver et nouveau compte comme nouveau.** C'est la
nouveauté qui porte le risque : le chandail polar est un vêtement d'hiver, et
c'est un nouveau produit. La famille se change produit par produit dans
l'app — la règle est un défaut, pas une camisole de force.

Conséquence utile : ajouter un ordre urgent réordonne la liste tout seul.
Personne n'a de numérotation à maintenir.

La priorité manuelle est le seul moyen de **contredire le calendrier**. Elle
sert quand une raison qui n'est pas dans la base l'exige : un tissu qui vient
d'arriver, une machine libre, un échantillon à envoyer. Posée par Gabriel ou
Catherine, visible par tout le monde — l'atelier la lit, il ne la change pas.
Ce n'est pas une question de confiance : la raison de bousculer l'ordre est
commerciale, et elle est à Québec.

### Ce qui ne se fabrique pas à l'atelier

Tout ne sort pas de Tunisie. La **tuque beanie** est tricotée en Chine ; seul
son **bandeau amovible** est fait à l'atelier. Un produit fabriqué ailleurs
n'apparaît pas dans *À fabriquer* — Montassar ne le produit pas, ce serait du
bruit sur l'écran fait pour dire quoi faire en premier.

Il ne disparaît pas pour autant : un encadré au-dessus de la liste dit combien
d'unités sont écartées et où elles se font, et l'ordre de production les garde.
Une ligne qui disparaît d'une liste sans explication est une ligne perdue.

### La répartition par taille et par coloris

« 3 500 cache-cous » ne dit pas quoi couper. Chaque item porte sa répartition
— 1 285 gris foncé, 1 078 noirs, 473 rouges, 364 gris pâle, 305 verts — et elle
se lit **en couleur** : une barre dont chaque segment a la teinte du coloris et
la largeur de sa part, puis les compteurs en pastilles.

Dans *À fabriquer*, la barre reste visible et les compteurs se replient : la
barre se lit d'un coup d'œil, le détail se demande d'un toucher. Sur l'ordre de
production, tout est déplié.

Quand le chiffrier croise deux axes — un coloris **et** une taille, un genre
**et** une taille — chaque groupe a sa ligne, et la longueur de sa barre montre
son poids : les mitaines polar, c'est 923 noires, 274 rouges, 204 grises et
99 violettes, chacune déclinée en cinq tailles.

**L'avancement reste au niveau de l'item.** Une tranche de 10 % par variante
multiplierait la saisie par cinq sans rien apprendre de plus sur ce qui rentrera
dans le conteneur. La répartition sert à couper juste, pas à déclarer.

Cinq répartitions s'écartent vraiment du plan : le bandeau (+300), les semelles
(+148), l'étui (−202), le foulard et l'oreiller (−15). Les deux chiffres sont
affichés et l'écart est signalé : c'est au chiffrier d'être corrigé, pas à l'app
de choisir. Les écarts d'une ou deux unités, eux, viennent de l'arrondi des
pourcentages et ne sont pas signalés — les mélanger noierait les cinq qui
méritent une réponse.

### Cédule — « est-ce que ça rentre ? »

C'est la seule question que la cédule a à trancher, et elle se répond avant le
diagramme, en trois nombres : **heures de travail**, **heures disponibles**
d'ici la première échéance, **postes**.

**D'où vient une heure — deux ÉTAPES, pas deux versions du même chiffre.**

C'est la confusion qui a fait dérailler la première version du calcul. Le
chronomètre et le prix BMB ne mesurent pas le même travail :

1. **Le chronomètre** (`donnees/temps-operations.tsv`) mesure la
   **préparation** : coupe, matelassage, remplissage, mélange d'asclépiade.
   C'est le travail de l'isolant.
2. **Le prix BMB** (`donnees/assemblage-bmb.tsv`) paie l'**assemblage** :
   la couture. C'est ce que le sous-traitant facture par unité.

La preuve que ce sont deux choses : sur le cache-cou, six opérations
chronométrées donnent 17 min et BMB facture 3 $, soit environ 7 min. Sur la
tuque sport, trois opérations donnent 2 min et BMB facture 4 $, soit 9 min. Si
c'était la même mesure vue de deux façons, le rapport serait constant. Il ne
l'est pas.

Tout se convertit à **26 $/h**, la règle que le suivi Tunisie applique déjà aux
mitaines polar : « 12,01 $ à 26 $/h » y donne 27 min 42 s, soit exactement
12,01 / 26 heures.

**Deux exceptions, marquées.** Une ligne « Total » (semelles, glacière) et
« Confection Lasclay » (mitaines polar) couvrent déjà la couture : on ne leur
ajoute pas l'assemblage, ce serait compter le produit deux fois. À l'inverse,
une simple somme de postes est marquée **« partiel »** — elle ne dit pas
quelles opérations n'ont pas été chronométrées, donc c'est un plancher.

**Où était cachée la donnée.** Les prix BMB dormaient en texte libre dans les
notes techniques des fiches produits — « Assemblage BMB 7 $/unité » — là où
aucun calcul ne pouvait les atteindre. Ils couvrent 23 produits, dont cinq que
les fiches COGS ignorent complètement et qui comptaient donc pour zéro heure.
`tools/extrait_bmb.js` les récupère ; le fichier se régénère.

**Six produits ont des sources qui se contredisent**, et l'app le dit sur la
ligne plutôt que de trancher en silence : le bandeau (2,50 $ BMB contre 0,87 $
COGS), les semelles 6-7-8F (2,50 contre 0,58), le sac à lunch (6 contre 7), et
les trois mitaines cuir, laine et polar — qui pointaient toutes vers la même
fiche COGS « Mitaines polar » à 17,07 $ alors que BMB les facture 6, 5 et 4 $.
Ce dernier cas était une approximation de l'app, pas une contradiction des
sources : un prix par produit vaut mieux qu'une fiche empruntée au voisin.

Multiplié par la quantité restante, ça fait la charge. L'ordre des barres est
celui d'« À fabriquer » : poser une priorité déplace vraiment les dates.

**La capacité, elle, n'est pas mesurée.** Aucune source ne dit combien de
personnes travaillent, ni combien d'heures. Sans ça, des heures ne deviennent
pas des dates. C'est donc un **réglage** : Québec pose postes × heures/jour ×
jours/semaine, et l'app annonce « avec cette capacité-là ».

Le défaut est de **20 postes**, l'équipe annoncée en août 2026. C'est un
chiffre **déclaré**, et la page le dit — « équipe annoncée · non confirmée
ici » — tant que personne ne l'a validé dans le formulaire. Deux réserves
valent d'être gardées en tête : *20 personnes dans l'atelier* n'est pas *20
personnes qui cousent* (encadrement, coupe, finition en font partie), et
personne n'a précisé si ces 20 sont chez BMB, chez Grada, ou les deux réunis.

**Ce que le diagramme simplifie, et de quel côté.** L'atelier est modélisé
comme une file unique : un item à la fois, tous les postes dessus. Supposer
plusieurs produits en parallèle donnerait des dates plus optimistes sans rien
pour le justifier. Pour la question « est-ce que ça rentre », seul le total
d'heures compte, et il ne dépend pas de l'ordre de passage ; c'est la date de
chaque barre qui est approchée, pas le verdict.

**Plus aucun item ne compte pour zéro heure.** Six l'étaient, et zéro est le
seul chiffre dont on soit sûr qu'il est faux. Cinq sont maintenant couverts par
les prix BMB. Le dernier — l'oreiller, 250 unités — par une estimation à la
main, dans `donnees/assemblage-estime.tsv`, ancrée sur l'oreiller de camping
(5 $ BMB : même garnissage, même construction en housse cousue). Elle s'affiche
**« estimé »**, en rouge, et ne se confond jamais avec un prix facturé. À
supprimer dès que BMB en donne un.

**S'il en restait**, l'app chiffrerait ce qu'ils manquent : elle leur prête les
temps unitaires des items du même plan — le plus court, la médiane, le plus
long — et affiche la fourchette, parce que « la charge réelle est plus élevée »
est vrai et inutilisable.

**Le verdict a donc trois états**, et la couleur dit la même chose que la
phrase : rouge « ça ne rentre pas », vert « ça rentre », **ambre « ça rentre
sur le papier »** quand la marge est plus petite que ce que les items non
chiffrés demanderaient.

**Le périmètre décide tout — et c'est un réglage, comme la capacité.** Personne
n'a dit si l'atelier planifié fait la préparation, l'assemblage, ou les deux.
Avec 20 couturières et 4 320 heures disponibles avant le 1er octobre :

| Ce que l'atelier fait | Charge | Verdict |
| --- | ---: | --- |
| Préparation seulement | 2 417 h | rentre, +1 903 h |
| Assemblage seulement | 3 829 h | rentre, +491 h |
| **Préparation + assemblage** | **5 311 h** | **manque 991 h** |

Du simple au double. Le défaut est « les deux » : c'est la lecture prudente, et
c'est celle qui ne rentre pas. Partir de l'hypothèse optimiste ferait
disparaître le risque sans rien changer à l'atelier. **C'est la première chose
à trancher** — et c'est une question, pas un calcul : est-ce que les
couturières de BMB font aussi la coupe, le matelassage et le remplissage, ou
est-ce que ça se fait ailleurs ?

Les deux sacs de couchage méritent une note : leur fiche COGS porte bien un
`sous_traitance` (29,22 $ et 31,47 $) mais **pas de `assemblage`**. Le poste
sous-traitance couvre plus que la confection — sur le manteau, 44,67 $ contre
28,00 $ d'assemblage. L'app refuse de s'en servir et prend le prix BMB (20 $) :
le sous-traitance gonflerait la charge sans qu'on sache de combien.

### Suivi — « est-ce que ça avance ? »

Trois blocs, un seul demande une action.

- **Sans mouvement** — du travail commencé qui n'avance plus depuis 7 jours.
  C'est le seul bloc qui appelle une réaction. Un item à 30 % figé depuis
  onze jours, c'est soit un blocage que personne n'a signalé, soit une mise à
  jour oubliée. Les deux se règlent en demandant.
- **Avancé sur 7 jours** — la progression convertie en pièces. Passer 2 000
  cache-cous de 40 à 70 % compte pour 600. C'est la mesure de rythme.
- **Dernières mises à jour** — qui a changé quoi, quand. Sert à ne pas avoir à
  demander.

### Ordre de production — « où en est ce lot précisément ? »

La liste complète des items, l'avancement global pondéré par les quantités, la
cédule, et les commentaires. C'est la page qu'on ouvre quand on parle d'un lot
en particulier.

---

## Ce que « en retard » veut dire

Un ordre est **en retard** dès qu'une de ses échéances est passée. C'est un
drapeau, pas une distance : la page n'affiche pas « 730 jours de retard » pour
un jalon oublié de l'an dernier, elle affiche « en retard » et montre
l'échéance vers laquelle on travaille maintenant.

Un ordre peut donc être en retard **et** avoir une échéance devant lui. Les
deux s'affichent ensemble.

---

## Quand ça ne marche pas

**« Presque fini », « ça avance bien ».** Ce ne sont pas des chiffres. La
réponse est de demander la tranche : 80 % ou 90 % ? L'assistant est instruit de
refuser de traduire une appréciation en pourcentage.

**Un item figé plus de 7 jours.** Le bloc *Sans mouvement* le signale. Commenter
l'ordre pour demander ce qui bloque — ne pas corriger le chiffre depuis Québec.

**Un avancement qui recule.** C'est légitime : un lot rejeté au contrôle, un
recomptage. L'historique garde les deux valeurs et le nom de qui a fait le
changement. Rien à corriger, c'est l'information.

**Une erreur de saisie.** Reposer la bonne valeur. L'historique conserve la
trace des deux — c'est voulu, on ne réécrit pas le passé.

---

## Ce que cette méthode ne couvre pas encore

Elle décrit le suivi d'un **avancement déclaré par item**. Elle ne couvre pas :

- **le suivi par opération** (coupe, matelassage, remplissage) — les temps
  chronométrés existent dans `donnees/temps-operations.tsv`, mais rien ne les
  relie encore à un ordre ;
- **la consommation de matières** — il n'y a pas d'inventaire ;
- **la capacité mesurée** — la cédule sait convertir des heures en dates, mais
  le nombre de postes et d'heures par jour est **déclaré**, pas observé. Tant
  que personne ne compte ce qui sort réellement de l'atelier par jour, le
  calendrier dit « avec cette capacité-là » et rien de plus.

Ces trois manques sont volontaires pour cette version. Le premier a une
valeur : savoir qu'un lot est « coupé mais pas matelassé » changerait la
conversation. À voir après quelques semaines d'usage réel — c'est l'usage qui
dira si le pourcentage par item suffit.
