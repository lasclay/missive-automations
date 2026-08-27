# Schéma de la mémoire longue de Lasclay

Ce fichier définit **ce qu'on écrit dans la mémoire**, indépendamment de l'outil qui l'héberge.
C'est la seule pièce qui doit survivre à un changement de runtime ou de fournisseur de mémoire.

Format retenu : une **entité par fichier markdown**, avec des *observations* (des faits typés) et
des *relations* (des liens `[[wiki]]`). Ce format se lit dans Obsidian, s'indexe par Basic Memory,
s'ingère dans Graphiti, et reste lisible à l'œil nu si tout le reste disparaît.

> **Règle unique et non négociable.** Toute observation porte sa **provenance** et sa **date**.
> Un fait sans source n'est pas un fait, c'est une rumeur à laquelle un modèle a fini par croire.
> C'est la même leçon que `fb-backlog/faits-verifies.json` et que « ne jamais recréer une tâche au
> cas où » dans `SUIVI-SUPPORT.md`.

---

## Anatomie d'une entité

```markdown
---
title: Nancy Amadon
type: client
permalink: clients/nancy-amadon
created: 2026-08-19
---

## Observations

- [préférence] Point de retrait : boutique des Capucins, Québec #retrait
  — source: fil Missive `ac6be2f2`, 2026-08-19
- [avertissement] Recevra un avis d'annulation puis une nouvelle commande au changement
  de point de retrait — c'est normal, ne pas s'en inquiéter
  — source: SUIVI-SUPPORT.md #13, 2026-08-19

## Relations

- a_commandé [[L-50xxx]]
- suivi_dans [[Fil ac6be2f2]]
```

**Frontmatter** — `title`, `type`, `permalink`, `created`. Rien d'autre n'est requis.

**Observation** — `- [catégorie] énoncé #étiquette — source: <où>, <date>`
Un fait, une ligne. Si ça prend deux phrases, c'est deux observations.

**Relation** — `- <type_de_relation> [[Cible]]`
Un seul mot pour le type, en minuscules avec des tirets bas.

---

## Les types d'entités

| Type | Ce que c'est | Ce qui déclenche sa création |
| --- | --- | --- |
| `client` | Une personne, pas une commande | Deuxième contact, ou un premier contact qui laisse une préférence durable |
| `commande` | Une commande Shopify ou manuelle | Seulement si quelque chose d'anormal s'y attache — sinon Shopify fait déjà foi |
| `produit` | Un produit ou une variante | Un fait qui ne vit pas dans la fiche Shopify : défaut connu, mensuration réelle, confusion fréquente |
| `atelier` | Un fournisseur, un partenaire, un point de retrait | Toute contrepartie récurrente |
| `geste` | Un geste promis et pas encore posé | Chaque promesse faite à une cliente. Se ferme, ne se supprime pas |
| `regle` | Une règle de décision interne | Une décision qu'on reprendrait à l'identique la prochaine fois |
| `lecon` | Une erreur réelle et ce qu'elle a coûté | Un refus du contrôle qualité, un doublon, un envoi raté |
| `fil` | Une conversation Missive ou Facebook | Seulement quand le fil porte du contexte qu'aucune commande ne porte |

Un type manquant se rajoute. Un type qui ne sert jamais se retire. Le schéma n'est pas
une loi, c'est un accord de nommage.

---

## Les catégories d'observation

Elles viennent du vocabulaire déjà en usage dans le dépôt, pas d'une ontologie générique.

| Catégorie | Sert à | Exemple |
| --- | --- | --- |
| `[fait]` | Un état vérifié | `[fait] L-50488 expédiée le 2026-08-14, suivi 1Z...` |
| `[préférence]` | Ce que la cliente veut, durablement | `[préférence] Écrit en anglais, répondre en anglais` |
| `[avertissement]` | Ce qui piège la prochaine personne | `[avertissement] Deux fils ouverts pour la même commande` |
| `[décision]` | Un arbitrage posé, avec sa raison | `[décision] Retour accepté hors délai — 40 jours, première commande` |
| `[mesure]` | Un chiffre | `[mesure] Manteau Femme XL : 71 cm de longueur dos` |
| `[promesse]` | Ce qu'on a dit qu'on ferait | `[promesse] Rabais MERCI10 à appliquer — 14,20 $` |
| `[correction]` | Ce qu'on avait faux | `[correction] Le drapeau « en drop-off » n'existe pas chez ShipStation` |

---

## Ce qui n'entre PAS dans la mémoire

La discipline compte plus que le schéma. Une mémoire qui absorbe tout devient un dépotoir
que plus personne ne relit — et le modèle, lui, la relit.

- **Ce que Shopify, ShipStation ou QBO savent déjà.** L'état d'une commande se demande à la
  source. L'écrire en mémoire crée un deuxième état qui va diverger.
- **Les données brutes.** Un export, un CSV, un log. La mémoire garde ce qu'on en a *conclu*.
- **L'éphémère.** « La cliente a répondu ce matin » n'a aucune valeur dans six mois.
- **Ce qui est déductible en une requête.** Si `node connectors_client.js` répond en deux
  secondes, ça ne se mémorise pas.
- **Les données personnelles au-delà du nécessaire.** Un numéro de carte ne s'écrit jamais.
  Une adresse s'écrit seulement si elle porte un avertissement (« a déménagé le 22 juin »).

---

## Le temps

Un fait vrai en juin peut être faux en août. Trois règles, dans l'ordre de préférence :

1. **On ne supprime pas, on remplace.** L'ancienne observation reste, marquée
   `— périmé le <date>, remplacé par <référence>`. L'historique est ce qui permet de comprendre
   pourquoi une décision passée avait du sens.
2. **Ce qui a une date de fin la porte.** `[promesse]` se ferme avec `— posé le <date>`.
3. **Ce qui se contredit se signale.** Deux observations incompatibles sur la même entité sont un
   défaut à corriger, pas une nuance à conserver.

Un moteur à graphe temporel (Graphiti) fait ça tout seul avec des fenêtres de validité. Tant
qu'on est en markdown, c'est une discipline d'écriture. Le schéma tient dans les deux cas — c'est
le but.

---

## Amorçage

L'erreur serait de vouloir tout migrer. On amorce avec ce qui a déjà prouvé sa valeur et qui
souffre aujourd'hui de vivre dans un fichier plat :

| Source | Devient |
| --- | --- |
| `SUIVI-SUPPORT.md` | Une entité `geste` par ligne, reliée à son `client` et à son `fil` |
| `connaissance_support.md` | Des entités `regle` et `lecon` |
| `fb-backlog/faits-verifies.json` | Des observations `[fait]` sur des entités `produit` |
| Les corrections encodées dans `support.js` | Des entités `lecon`, une par version |

Le reste attend d'avoir été demandé deux fois. Une mémoire se construit par le besoin, pas par
la migration.
