# Veille — le système qui apprend de la boîte

## Le problème que ça règle

Le dépôt sait déjà **répondre** : `support.js` rédige, `analyse.js` reconstruit
`connaissance_support.md`, `revision.js` compare le brouillon IA à la correction
humaine. Tout ça produit des **rapports** : un markdown, lu une fois, puis oublié.
Au run suivant, le système repart de zéro et repaie le prix de tout relire.

Il manquait la mémoire. La veille l'ajoute, et elle regarde dans l'autre sens :
non pas « comment répondre à ce client », mais **« qu'est-ce que ce client nous
apprend qu'on ne savait pas »**.

C'est la différence entre un outil et un actif. Un concurrent peut acheter le
même modèle demain. Il ne peut pas acheter trois ans de ce que vos clients vous
ont dit, rangé et daté.

## Les quatre pièces

```
collecte  →  ardoise  →  distille  →  ratification
   ↑                                        │
   └────────── curseurs ────────────────────┘
```

| Fichier | Rôle | Tourne sans clé d'API |
| --- | --- | --- |
| `collecte.js` | les capteurs : Missive (verbatim), ShipStation (mesures) | oui |
| `ardoise.js` | la mémoire : append-only, dédupliquée, curseurs, états | oui |
| `pretri.js` | tri lexical : type, thèmes, produits | oui |
| `distille.js` | agrégats + verbatim → `connaissance/decouvertes.md` | oui |
| `distille.js` (mode 2) | synthèse rédigée → `connaissance/synthese.md` | non — `ANTHROPIC_API_KEY` |
| `veille.js` | la façade en ligne de commande | oui |

Tout sauf la synthèse tourne gratuitement. C'est délibéré : une veille qui coûte
cher tourne rarement, et une veille qui tourne rarement ne sert à rien.

## Usage

```bash
node veille/veille.js collecte      # ne lit que le nouveau, depuis les curseurs
node veille/veille.js distille      # réécrit connaissance/decouvertes.md
node veille/veille.js boucle        # les deux — ce que la tâche planifiée appelle
node veille/veille.js etat          # curseurs, volumes, santé du pré-tri
node veille/veille.js montre --type segment_usage --n 30
node veille/veille.js ratifie ratifie a1b2c3d4 e5f6g7h8
```

Variables : `MISSIVE_PROXY_URL` + `MISSIVE_PROXY_SECRET` (verbatim),
`GENERAL_PROXY_URL` + `GENERAL_PROXY_SECRET` (mesures ShipStation),
`ANTHROPIC_API_KEY` (synthèse, facultative).

Le premier passage lit tout l'historique des étiquettes suivies et prend une
vingtaine de minutes — les fils sont lus un par un pour rester poli avec l'API.
Les passages suivants ne voient que le nouveau et durent quelques secondes.

## Les quatre règles qui tiennent le système

**1. L'ardoise s'ajoute, elle ne se réécrit pas.** Un signal entré y reste avec
sa provenance et sa date. La seule écriture en place est la ratification, et
elle est manuelle. Un historique qu'on peut réécrire n'est plus une preuve.

**2. Les curseurs avancent après l'écriture, jamais avant.** Si le processus
meurt entre les deux, la collecte suivante repasse sur le même lot et la
déduplication absorbe le doublon. Refaire du travail coûte moins cher que
d'en perdre.

**3. La veille n'écrit jamais dans la connaissance de marque.** Elle écrit dans
`veille/connaissance/`. Ce qui migre vers `connaissance_support.md` ou
`contexte_lasclay.md` est déplacé par un humain. Un système qui réécrit ses
propres règles dérive, et personne ne s'en aperçoit avant que ce soit parti
chez un client.

**4. Le verbatim client n'est pas versionné.** `ardoise.jsonl`, `etat.json` et
`connaissance/` sont dans `.gitignore`. Le texte est pseudonymisé à l'entrée —
prénom + initiale, courriels et téléphones retirés. Les numéros de commande sont
gardés : ils servent au recoupement et vivent déjà partout ailleurs.

## Lire les types de signal

Par ordre de coût quand on les rate :

| Type | Ce que c'est | Pourquoi ça compte |
| --- | --- | --- |
| `risque_securite` | un produit qui blesse | jamais à noyer dans « défaut » |
| `segment_usage` | un usage ou un public non visé | c'est là que sont les marchés qu'on n'a pas planifiés |
| `offre_partenariat` | quelqu'un apporte une capacité | fabrication, média, matière — arrive non sollicité et se perd vite |
| `objection_achat` | ce qui empêche d'acheter | invisible dans Shopify : ces gens n'achètent pas |
| `defaut_produit` | un défaut signalé | plusieurs clients, même symptôme = systémique |
| `taille_ajustement` | taille, ajustement | premier moteur de retours |
| `friction_operation` | délai, colis, commande | conséquence, pas cause — se lit contre `mesure_ops` |
| `mesure_ops` | l'état des systèmes, daté | ce qui explique les vagues de friction |
| `eloge` | appréciation | ligne de base ; sert à mesurer les autres |

## Entretenir le pré-tri

`node veille/veille.js etat` affiche un **taux d'inclassés**. Au-dessus de 25 %,
le vocabulaire de `pretri.js` a vieilli : les clients parlent de choses que les
motifs ne connaissent pas. Regarder alors les inclassés
(`montre --type inclassé`) et ajouter les formes manquantes. Ce taux est le seul
indicateur de santé du fichier — sans lui, un tri qui se dégrade passe inaperçu
parce qu'il continue de produire quelque chose.

## Ajouter une source

Un adaptateur est une fonction qui rend `{signaux, curseurs}`. Il ne connaît ni
l'ardoise ni les autres. Les candidats évidents, dans l'ordre où ils rapportent :

- **Brouillons IA révisés** — l'écart entre ce que `support.js` a rédigé et ce
  qu'un humain a réellement envoyé. C'est le signal d'apprentissage le plus dense
  du dépôt, et l'étiquette existe déjà (`Draft AI RÉVISÉ PAR HUMAIN`).
  `revision.js` le calcule déjà mais le jette dans un rapport ; le brancher sur
  l'ardoise le rend cumulatif.
- **Shopify** — paniers abandonnés, variantes en rupture demandées, requêtes de
  recherche interne sans résultat. Ce que les gens cherchaient et n'ont pas trouvé.
- **Klaviyo / Omnisend** — désabonnements et leur motif, réponses aux campagnes.
- **QBO** — marge par produit, à croiser avec le volume de défauts : un produit
  très réclamé et peu rentable est une décision, pas un incident.
