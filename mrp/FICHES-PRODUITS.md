# Fiches produits — état et préparation

**À faire : des fiches plus poussées s'en viennent, il faut les préparer.**
Note du 25 août 2026.

---

## Ce qu'une fiche porte aujourd'hui

Sur les 34 produits importés :

| | Rempli |
| --- | ---: |
| Description | 32 |
| Notes techniques | 34 |
| Photos | 32 |
| Matériaux | 12 |
| Patrons | 0 |
| Répartition par taille et coloris | 22 (139 lignes) |

Les notes techniques sont déjà denses — elles empilent trois sources : les
consignes d'atelier du suivi Tunisie (« presser le col avant d'insérer
l'isolant, sinon il fond »), les coûts décomposés, la quantité au plan 26-27
avec sa répartition par taille et coloris, et les rattachements Shopify restant
à confirmer.

Les matériaux ne couvrent que 12 produits, parce que la nomenclature n'existe
que pour ceux qui ont une fiche COGS. Les patrons ne sont rattachés à rien : il
n'existe aucun inventaire des patrons.

---

## Ce qui s'en vient

Un tableau Miro sert de référence — c'est la fiche que la direction veut voir
« en version exhaustive ++++ ». Il n'a pas encore pu être lu : le tableau
`uXjVLEALayg=` renvoie « Board access denied », le compte Miro connecté ici ne
voyant que « Refonte site web » et « Boutique et ramassage ».

**Pour débloquer** : partager le tableau avec le compte de la connexion
(utilisateur `3458764678911239441`, équipe `3458764678911072163`), ou vérifier
dans claude.ai → Paramètres → Connecteurs quel compte Miro est rattaché.

---

## Ce que le schéma ne sait pas encore porter

D'après les besoins exprimés au départ — « c'est quoi, ça sert à quoi, comment
ça s'utilise, est-ce que le bandeau peut être coupé dans ce sens-là » — voici
ce qu'une fiche poussée demanderait en plus, et qui n'a pas de place
aujourd'hui :

- **Le sens de coupe, illustré.** Aujourd'hui c'est une phrase dans
  `notes_tech`. Une fiche poussée le montre : un schéma, une flèche sur la
  pièce. Il faudrait un type de média « schéma technique », distinct des photos
  studio et contexte.
- **Les cotes.** Dimensions hors tout, tolérances. Rien ne les porte —
  `produit_patrons.dimensions` est un texte libre, pas une donnée.
- **L'échantillon de tissu sur la variante.** La répartition existe maintenant
  comme donnée — 139 lignes, sous la quantité de chaque item de l'ordre. Ce qui
  manque encore, c'est ce qui pend après : le tissu montré, la référence
  fournisseur, la disponibilité. Et un avancement par variante, si l'atelier a
  besoin de déclarer « les noirs sont faits, pas les rouges ».
- **Les opérations d'assemblage, dans l'ordre.** Les temps chronométrés
  existent (`donnees/temps-operations.tsv`, 35 lignes), mais rien ne les relie
  à un produit ni ne les met en séquence.
- **Les questions récurrentes et leurs réponses.** Le besoin de départ parlait
  d'une « boîte de discussion pour poser des questions techniques ». Les
  commentaires existent sur les ordres, pas sur les produits — donc une réponse
  donnée une fois se perd quand l'ordre se termine.

---

## Ce qu'il faut décider avant de construire

1. **Le Miro est-il la cible, ou une étape ?** Si les fiches poussées vivent
   dans le MRP, le Miro devient une source à importer une fois. Si elles restent
   dans Miro, le MRP n'a qu'à pointer dessus. Les deux se défendent ; la
   deuxième coûte moins cher et laisse les fiches où les gens les éditent déjà.
2. **Qui édite une fiche ?** Aujourd'hui l'administration seulement. Un
   patronnier qui corrige un sens de coupe devrait-il pouvoir écrire ?
3. **Une fiche par produit de production, ou par variante ?** Les mitaines
   polar en quatre coloris et cinq tailles font vingt variantes Shopify pour un
   seul produit de production. Le sens de coupe est commun ; la référence de
   tissu ne l'est pas.

---

## Un défaut corrigé au passage

L'export Shopify récupérait les descriptions mais ne les écrivait pas dans le
TSV : les 32 fiches importées avaient une description vide. La colonne
`description_html` a été ajoutée à `donnees/shopify-produits.tsv` et
**30 fiches sur 32** en portent une maintenant (les deux sans étant celles qui
n'ont pas de fiche Shopify).
