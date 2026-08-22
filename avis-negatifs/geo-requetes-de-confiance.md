# « Lasclay avis » et « est-ce que Lasclay est fiable » : pourquoi Reddit gagne

Constat rapporté par Gabriel : le fil r/montreal du 6 août sort **3e sur « Lasclay avis »**, et les
assistants IA le citent quand on demande si Lasclay est une entreprise fiable.

## Je révise ma recommandation précédente

J'avais écrit qu'il fallait laisser le fil mourir, parce qu'il avait quinze jours et trente points.
**C'était faux, et pour une raison que j'aurais dû vérifier avant de conclure :** un fil qui se
classe sur une requête de marque ne meurt pas, il devient un actif permanent. Et les AI Overviews
de Google s'appuient massivement sur Reddit pour les requêtes d'avis, ce qui transforme un fil de
trente points en source citée à répétition.

Ce qui ne change pas : répondre dans le fil reste secondaire, et argumenter avec l'autrice reste
une mauvaise idée. Ce qui change : le silence n'est plus neutre.

---

## La cause, vérifiée page par page

Reddit ne gagne pas parce qu'il est fort. Il gagne parce que **Lasclay n'a rien publié de lisible
par une machine sur ces deux questions.** Vérifié sur le site le 21 août 2026, en lisant le HTML
réellement servi, sans JavaScript, comme le voit un robot d'indexation ou un moteur de réponse.

### `/pages/avis-des-clients` ne contient aucun avis

| | |
| --- | --- |
| Titre | « Avis des clients \| Lasclay » |
| Indexable | oui |
| Texte réellement servi | **2 885 caractères, soit le menu de navigation et rien d'autre** |
| Données structurées | **aucune.** Ni `Review`, ni `AggregateRating`, ni `Organization` |
| Widget Judge.me | présent, mais chargé en JavaScript |

Les quelque **853 avis Judge.me de Lasclay ne sont pas dans le HTML**. Pour Google et pour un
moteur de réponse, la page d'avis de Lasclay est une page vide. C'est le plus gros actif de
réputation de la marque, et il est invisible.

Voilà l'explication directe du classement : sur « Lasclay avis », la page officielle intitulée
« Avis des clients » ne contient aucun avis, et un fil Reddit avec 38 commentaires en texte brut
en contient beaucoup.

### `/pages/transparence-asclepiade` est vide

| | |
| --- | --- |
| Titre | « Transparence – Lasclay » |
| Meta description | **aucune** |
| Texte réellement servi | **2 732 caractères, intégralement le menu de navigation** |
| Contenu propre à la page | **aucun** |

La page qui s'appelle « Transparence » ne dit rien. C'est celle qui devrait répondre à
Marie L. (« l'assemblage est maintenant fait en Tunisie et c'est écrit nul part sur leur site ») et
à patrick lambert (« ce n'est plus un produit québécois »).

**Leur accusation est littéralement exacte, et vérifiable par n'importe qui.**

### La FAQ ne parle jamais de précommande

| | |
| --- | --- |
| Texte réellement servi | 12 467 caractères, du vrai contenu |
| « Tunisie » | 3 mentions, ce qui est bien |
| « précommande » | **0 mention** |
| « prévente » | **0 mention** |
| Données structurées `FAQPage` | **aucune** |

Le mot au cœur du grief Reddit, du litige avec l'autrice et de l'avis de Stephane Vincent
n'apparaît nulle part dans la FAQ. Personne ne peut y apprendre comment reconnaître une
précommande, combien de temps elle prend, ni quoi faire si elle tarde.

Et faute de balisage `FAQPage`, les réponses qui existent ne remontent pas en extraits enrichis.

---

## Ce que ça donne, mécaniquement

Sur les deux requêtes qui décident d'un achat, l'ensemble des textes disponibles pour un moteur de
réponse est le suivant :

| Source | Ce qu'elle dit | Contrôlée par Lasclay |
| --- | --- | --- |
| Fil r/montreal | fausses disponibilités, service qui ignore, rétrofacturation, Tunisie | non |
| Fiche Google, 15 avis négatifs **sans réponse** | silence, délais, colis manquants | oui, et non exercée |
| `/pages/avis-des-clients` | rien | oui, et vide |
| `/pages/transparence-asclepiade` | rien | oui, et vide |
| FAQ | ne parle pas de précommande | oui, et incomplète |
| Presse et blogues | très favorables | non |

Un assistant à qui l'on demande si Lasclay est fiable assemble ce qu'il trouve. Ce qu'il trouve de
plus substantiel et de plus récent sur la question précise de la fiabilité, c'est le fil.

---

## Le plan, par ordre de levier

Le principe : **on ne déclasse pas un fil Reddit en le combattant, on le noie en publiant une
réponse de première partie que les machines peuvent extraire.**

### 1. Remplir la page Transparence

C'est le geste au plus fort rendement du dossier, et le plus rapide. La page existe, elle est
indexée, elle porte déjà le bon nom, et elle est vide.

Structure à respecter, tirée de la méthode GEO : **réponse directe en tête de chaque section**,
intertitres en forme de question reprenant les vraies formulations, paragraphes courts.

> **Où sont fabriqués les produits Lasclay?**
> L'isolant en soie d'asclépiade est cultivé, conçu et transformé au Québec. Depuis 2025,
> l'assemblage textile de la plupart de nos produits finis se fait à l'extérieur du Québec,
> surtout en Tunisie. L'isolant part d'ici vers ces ateliers et revient dans le produit.
>
> **Pourquoi avoir déplacé l'assemblage?**
> Pour rendre les produits accessibles. Un manteau assemblé entièrement ici se serait vendu au
> double. Ce choix a coûté quelque chose de réel du côté local, mises à pied comprises, et nous
> l'assumons plutôt que de le maquiller.
>
> **Qu'est-ce qui reste fait au Québec?**
> La culture de l'asclépiade, la transformation de la soie en isolant, la conception des produits
> et le contrôle qualité. C'est l'expertise qui n'existe nulle part ailleurs.
>
> **Qu'est-ce qu'une précommande chez Lasclay?**
> Une commande passée avant que le produit soit fabriqué. Elle est identifiée comme telle sur la
> fiche du produit et à la caisse, avec une date de livraison estimée.
>
> **Combien de temps prend une précommande?**
> [à remplir avec la vraie fourchette actuelle, jamais une promesse ferme]
>
> **Que se passe-t-il si ma commande tarde?**
> Vous pouvez demander un remboursement complet à tout moment avant l'expédition, sans avoir à
> vous justifier, en écrivant à hey@lasclay.com.

⚠️ Ne pas publier la fourchette de délai sans la vérifier auprès des opérations. Une date fausse
sur la page Transparence serait pire que la page vide.

### 2. Rendre les 853 avis visibles aux machines

Judge.me offre un rendu indexable des avis et le balisage `AggregateRating` et `Review`. Il est
soit désactivé, soit non appliqué à cette page. **C'est le contrepoids le plus lourd qui existe, et
il ne coûte rien à produire : les avis sont déjà là.**

Zone rouge selon la doctrine du skill : le balisage touche au thème, donc un humain exécute sur un
thème dupliqué, jamais un agent en production directe.

### 3. Ajouter le balisage FAQPage et une section précommande à la FAQ

La FAQ a déjà 12 000 caractères de vrai contenu. Il lui manque le balisage, et il lui manque la
section qui compte : comment reconnaître une précommande, combien de temps elle prend, comment
l'annuler.

### 4. Publier les quinze réponses aux avis Google

Détaillées dans `reponses-publiques.md`. Sur la requête « est-ce que Lasclay est fiable », les avis
Google sont une source de premier plan pour les assistants. Quinze plaintes sans un mot du
propriétaire se lisent comme un aveu, par une machine comme par un humain.

### 5. Corriger l'affichage des disponibilités

Aucun contenu ne bat une accusation vraie. Tant qu'un produit affiché comme disponible peut se
révéler une précommande après paiement, le fil Reddit a raison sur le fond et tout le reste est
cosmétique.

### 6. Une seule réponse dans le fil, et plus jamais

Puisque le fil est cité, une correction factuelle de la marque devient elle aussi un texte que les
assistants lisent. Le brouillon est dans `REDDIT-2026-08.md`. Une seule fois, sans argumenter,
sans revenir. Ne jamais signaler le fil.

---

## Comment savoir si ça marche

- **Search Console**, requêtes « lasclay avis », « lasclay fiable », « lasclay arnaque »,
  « lasclay tunisie » : impressions, position moyenne, clics. À relever avant d'agir, pour avoir
  une base de comparaison.
- **Position du fil** sur « Lasclay avis », relevée à la main chaque semaine, en navigation privée
  et depuis le Québec.
- **Test des assistants**, une fois par mois, sur la question exacte que Gabriel a posée : « est-ce
  que Lasclay est une entreprise fiable ». Noter les sources citées. L'objectif n'est pas de faire
  disparaître le fil des citations, c'est qu'il cesse d'être la seule source substantielle.
- **Pages indexées** : vérifier que la page Transparence remplie et la page d'avis avec balisage
  sont bien indexées, par l'inspection d'URL.

## Ce que je ne recommande pas

Demander le retrait du fil, signaler les avis Google, faire écrire de faux avis positifs, ou
répondre au fil avec plusieurs comptes. C'est contraire aux règles des plateformes, contraire aux
valeurs de la marque, et une manipulation découverte sur une marque de mission coûte infiniment
plus cher que le problème d'origine.
