# Le manuel officiel de Meta — ce qui tient, ce qui a vieilli, et la règle des 50

Extraction intégrale du « **Manuel sur les conversions** » de Meta (12 pages, version française),
puis confrontation aux trois autres sources du guide de saison.

Relevé page par page : [`sources/meta-conversions-playbook-notes-brutes.md`](sources/meta-conversions-playbook-notes-brutes.md)

> **Lecture du document.** Les citations et les sept ★ viennent du manuel, mot pour mot. Les
> blocs « **Chez Lasclay** » sont l'adaptation. Les datations et les changements de nom signalés
> plus bas sont **ma lecture**, pas du contenu du manuel — à revalider dans le Gestionnaire.

## Ce que cette source est, et ce qu'elle n'est pas

C'est **la recommandation du vendeur, écrite par le vendeur**. Sa valeur n'est pas d'avoir
raison : c'est d'être la configuration de référence à partir de laquelle tout le reste se mesure.
La conférence de 2026 ne se comprend bien qu'en voyant ce qu'elle contredit — et ce qu'elle
confirme sans le savoir.

La capture de l'étape 7 est datée du **24 février 2022**. Le manuel a donc environ quatre ans et
demi, ce qui, en publicité Meta, est très long. Il précède Andromeda, l'arrivée d'Advantage+ sales
et la refonte des objectifs. **Il faut le lire comme une archive utile, pas comme une consigne.**

| Source | Répond à |
| --- | --- |
| Conférence « Le paid ads en 2026 » | **Comment acheter l'attention** — créatif, structure, hook rate |
| J7 Media, « Fondation financière » | **Combien dépenser** — NCAC, cohortes, le budget comme résultat |
| *Sell Like Crazy*, Sabri Suby | **Quoi dire** — offre, garantie, titres, courriel |
| **Manuel Meta sur les conversions** | **Les planchers techniques** — les seuils sous lesquels rien ne fonctionne |

---

## 1. L'apport net : la règle des 50

C'est la seule chose que ce manuel apporte et qu'aucune des trois autres sources ne donne. Elle
apparaît deux fois, sous deux formes qui sont la même règle.

**Au niveau du budget (étape 3), mot pour mot :**

> « Pour définir votre budget, utilisez la formule suivante : prenez le coût moyen par résultat de
> vos campagnes précédentes et **multipliez-le par 50**. Le produit que vous obtenez correspond à
> votre **budget hebdomadaire minimal recommandé**. Par exemple, si votre coût par résultat est
> généralement de 10 $, votre budget hebdomadaire serait au moins de **500 $ pour chaque ensemble
> de publicités**. »

**Au niveau de l'évènement (étape 4), mot pour mot :**

> « Essayez de choisir un évènement qui a déclenché **au moins 50 fois le pixel sur votre site Web
> chaque semaine**. »

```
Plancher hebdomadaire par ensemble de publicités = CPA cible × 50
```

Les deux disent la même chose vue des deux bouts : **l'optimiseur a besoin d'environ 50
conversions par semaine et par ensemble de publicités pour sortir de la phase d'apprentissage.**
En dessous, on paie le plein tarif sans obtenir l'optimisation — on achète de la diffusion, pas de
la performance.

### Ce que ça coûte vraiment

| CPA cible | Plancher hebdo / ensemble | Par jour |
| --- | --- | --- |
| 20 $ | 1 000 $ | ~143 $ |
| 30 $ | **1 500 $** | ~214 $ |
| 40 $ | 2 000 $ | ~286 $ |
| 60 $ | 3 000 $ | ~429 $ |

**Chez Lasclay**, avec un CPA visé autour de 30 $, chaque ensemble de publicités correctement
alimenté coûte **1 500 $ par semaine**. Ce n'est pas un objectif, c'est un droit d'entrée.

### La conséquence qui fait mal : le budget dicte le nombre d'ensembles

```
Ensembles finançables = budget hebdomadaire total ÷ (CPA cible × 50)
```

| Budget hebdo total | Ensembles correctement alimentés (CPA 30 $) |
| --- | --- |
| 1 500 $ | **1** |
| 3 000 $ | 2 |
| 4 500 $ | 3 |
| 7 500 $ | 5 |

C'est la contrainte la plus dure de tout le guide, et c'est celle qu'on viole le plus facilement :
on ouvre six ensembles parce qu'on a six idées, et on se retrouve avec six ensembles qui
n'apprennent jamais. **Le nombre d'ensembles n'est pas une décision créative, c'est une division.**

---

## 2. Le conflit apparent avec le framework de tests — et sa résolution

Deux planchers coexistent, et ils ont l'air de se contredire d'un facteur dix :

| Source | Règle | Sur un CPA de 30 $ |
| --- | --- | --- |
| Conférence 2026 | **5 × CPA cible par test**, 3 à 7 jours | 150 $ par créatif testé |
| Manuel Meta | **50 × CPA par semaine et par ensemble** | 1 500 $ par ensemble |

**Ils ne mesurent pas la même chose.**

- Le 5× de la conférence est le minimum pour **classer des créatifs entre eux** — savoir lequel
  accroche. C'est une lecture de signal créatif.
- Le 50× de Meta est le minimum pour que **l'ensemble soit réellement optimisé** et livre au coût
  visé. C'est une condition de fonctionnement de l'algorithme.

**La résolution est structurelle : on ne met pas un test par ensemble de publicités.** On teste
les créatifs *à l'intérieur* d'un ensemble unique, correctement alimenté. L'ensemble franchit les
50 conversions ; chaque créatif reçoit son 5× à l'intérieur.

```
1 500 $/semaine ÷ 150 $ par créatif = 10 créatifs lisibles par semaine, dans un seul ensemble
```

Et c'est exactement la structure que la conférence recommande par ailleurs — broad, CBO, plusieurs
créatifs dans le même ensemble. Les deux sources se rejoignent sans le dire. **La structure en
« un ensemble par hypothèse » est le fail le plus coûteux, parce qu'il paraît rigoureux.**

---

## 3. La règle des 50 appliquée à l'évènement de conversion

> « Essayez de choisir un évènement qui a déclenché au moins 50 fois le pixel sur votre site Web
> chaque semaine. »

C'est une règle de calendrier autant que de configuration. Le bon évènement n'est pas le plus
proche de l'argent : c'est **le plus proche de l'argent qui franchit encore 50/semaine**.

**Chez Lasclay**, à vérifier dans le Gestionnaire d'évènements avant de lancer quoi que ce soit :

| Période | Volume d'`Achat` attendu | Évènement d'optimisation |
| --- | --- | --- |
| Septembre, début de saison | probablement **< 50/sem** | `Ajout au panier` ou `Début de paiement` |
| Novembre, pleine saison | largement > 50/sem | **`Achat`** |
| Janvier, après-saison | retombe | resurveiller, quitte à redescendre d'un cran |

Deux choses en découlent :

1. **Ne pas lancer la saison en optimisant sur `Achat` si le pixel n'y est pas.** On croit viser
   juste et on affame l'algorithme.
2. **Le passage à `Achat` est un évènement du calendrier de saison**, à planifier — et il
   redémarre la phase d'apprentissage, donc il ne se fait pas la semaine du Vendredi fou.

---

## 4. Les sept ★ de Meta, et leur verdict en 2026

La dernière page du manuel les rassemble. Verdict à la lumière de la conférence :

| ★ Recommandation Meta | Verdict 2026 |
| --- | --- |
| Activer **l'optimisation du budget de la campagne** (CBO) | ✅ **Tient.** La conférence l'applique en TOF ; elle garde ABO pour le reciblage, où on veut forcer la répartition. |
| **Stratégie d'enchère au coût le plus bas** | ✅ **Tient.** Non contredit. C'est le réglage par défaut sain tant qu'on n'a pas de raison de plafonner. |
| **Évènement de pixel qui déclenche ≥ 50 fois/semaine** | ✅ **Tient, et c'est l'apport net.** Aucune autre source ne le dit. |
| Activer le **contenu dynamique** | ⚠️ **Renommé.** Devenu *Advantage+ creative*. L'intention survit, le champ a changé de nom et de portée. |
| **Optimisation de la diffusion → conversions** | ✅ **Tient.** |
| **Attribution 7 jours après le clic** | ✅ **Tient, avec une mise en garde.** Voir §5. |
| Activer les **placements automatiques** | ✅ **Tient.** Devenu *Advantage+ placements*, toujours recommandé. La conférence ajoute que la maîtrise se déplace vers le **créatif par placement**. |

Le repli que Meta donne si on refuse les placements automatiques mérite d'être noté :

> « Si vous ne sélectionnez pas les placements automatiques, Meta vous recommande d'utiliser **au
> moins six placements**. »

---

## 5. Ce qui a vieilli — à ne pas appliquer tel quel

⚠️ **C'est la section à lire avant d'ouvrir le manuel.** Quatre points sont contredits par la
conférence de 2026, et l'un d'eux frontalement.

| Point | Manuel Meta (2022) | Conférence (2026) | Qui prime |
| --- | --- | --- | --- |
| **Taille d'audience** | « entre deux à dix millions » | **Broad, aucune restriction.** L'algorithme trouve l'acheteur à partir du créatif | **La conférence** |
| **Audiences similaires (LAL)** | « Considérez une audience similaire » | « De moins en moins utile avec Andromeda », pertinence en baisse | **La conférence** |
| **Extension du ciblage détaillé** | « Assurez-vous qu'elle est activée » | Question absorbée : le ciblage détaillé lui-même est en déclin | **La conférence** |
| **Nom de l'objectif** | « Conversions » | L'objectif s'appelle désormais **Ventes** ; la campagne recommandée est *Advantage+ sales* | **La conférence** |

Le premier point est le plus important, et c'est un **renversement complet** : Meta recommandait
en 2022 de *restreindre* l'audience pour aider la diffusion, et recommande en 2026 de ne rien
restreindre du tout. La conférence donne la raison — Andromeda a déplacé le ciblage dans le
créatif. **Suivre le manuel sur ce point, aujourd'hui, c'est brider l'algorithme.**

Il reste une exception, et elle vient de la conférence, pas du manuel : le champ **Controls** au
niveau de l'ensemble (« We won't reach people beyond these settings, **even with Advantage+ on** »).
C'est le seul garde-fou réellement respecté. Tout le reste est suggestion.

### Sur l'attribution

Le manuel dit « 7 jours après le clic » sans commentaire. La conférence ajoute ce que le manuel
tait : cette fenêtre **sous-déclare** ce que la publicité produit réellement, et il ne faut pas
juger un ROAS sur la seule donnée du Gestionnaire. Garder le réglage, ne pas croire le chiffre sur
parole. Voir la section 3.2 du guide de conférence.

---

## 6. Ce que le manuel dit du créatif, et qui reste vrai

Peu de choses, mais elles convergent avec le reste :

> « Il est recommandé d'utiliser les **vidéos**, car elles sont plus attrayantes et rendent votre
> publicité plus intéressante. »

> « Rédigez un **texte court** pour éviter qu'il ne soit coupé. Assurez-vous de **souligner la
> valeur** de ce que vous offrez à l'audience. »

> « Choisissez le **lieu exact** sur votre site Web que vous souhaitez que les personnes
> visitent. […] assurez-vous que les visiteurs peuvent facilement entreprendre une action une fois
> qu'ils accèdent à votre page. »

Le deuxième point est le seul endroit où le manuel effleure l'offre — et il s'arrête exactement là
où *Sell Like Crazy* commence. « Souligner la valeur » n'est pas une instruction exploitable ; les
sept composantes de l'offre du Parrain, si. Voir
[`sell-like-crazy-methode-et-adaptation.md`](sell-like-crazy-methode-et-adaptation.md).

Le troisième est une consigne de page de destination glissée dans un manuel de publicité, et c'est
le seul moment où Meta admet que le problème peut être après le clic.

---

## 7. Ce que ça change dans le plan de saison

Quatre décisions concrètes, à prendre avant le 11 septembre.

| # | Décision | Pourquoi |
| --- | --- | --- |
| 1 | **Compter les évènements `Achat` de la semaine dernière** dans le Gestionnaire d'évènements | Détermine sur quoi on optimise. Sous 50, on optimise sur `Ajout au panier`. |
| 2 | **Diviser le budget hebdo par (CPA × 50)** et n'ouvrir que ce nombre d'ensembles | Un ensemble sous-alimenté ne coûte pas moins cher : il coûte autant et n'apprend pas. |
| 3 | **Tester les créatifs dans un ensemble, pas un ensemble par créatif** | Réconcilie le 5× de la conférence et le 50× de Meta. |
| 4 | **Planifier le passage à l'évènement `Achat`** comme une date du calendrier, jamais en semaine de pointe | Le changement d'évènement redémarre la phase d'apprentissage. |

Et une mise en garde d'ordre général sur ce manuel, qui vaut pour toute la documentation du
vendeur : le **Campaign score** relevé pendant la conférence (100 quand *Advantage+ sales* est ON,
puis 77, 74, 69, 50 à mesure qu'on s'en écarte) n'est pas une note de qualité. **C'est une mesure
de conformité aux réglages que Meta veut pousser.** Ce manuel est la même chose sous forme de PDF.
Les planchers techniques qu'il donne sont bons parce qu'ils décrivent le fonctionnement de la
machine ; ses conseils de ciblage étaient de la politique produit, et ils ont changé.

---

## Source

PDF officiel Meta, « Manuel sur les conversions », 12 pages, version française canadienne,
`www.facebook.com/business`. Aucune donnée de compte tiers : ce document est public, il peut être
partagé librement — contrairement aux trois autres sources du guide.
