---
name: production-lasclay
description: Le MRP maison de Lasclay — l'application de production entre Québec et la Tunisie (mrp/), ses règles de calcul, sa méthode de suivi, ses données sources, et tout ce qui a été appris en auditant MRPeasy et ERPNext. Couvre les ordres de production et l'avancement déclaré, la charge d'atelier et la cédule, l'inventaire matières et le calculateur de besoins, le contrôle qualité et le mur des bris, les fiches produits, la charte Miro, les patrons et le convertisseur HPGL, et ce qui reste à trancher avant de construire la suite.
when_to_use: Déclenche dès qu'il est question du MRP, de l'ERP, de la production, de l'atelier tunisien, de BMB ou Grada, d'un ordre de production, d'un avancement, de la cédule ou de la charge, d'une nomenclature, d'un inventaire de matières, d'un contrôle qualité, d'une fiche produit, de la charte produits, d'un patron ou d'un fichier HPGL. Déclenche même sans nommer le MRP — « est-ce que le plan rentre », « combien de tissu pour 500 tuques », « où en est la production des cache-cous », « qu'est-ce qu'il faut vérifier avant d'emballer », « pourquoi ce patron sort trop grand », « on devrait acheter MRPeasy ».
argument-hint: [ce que tu veux savoir ou faire côté production]
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Edit
  - Write
  - Skill
---

# Production Lasclay — le MRP maison

N'explore pas le dépôt pour retrouver comment fonctionne la production : la carte est ici, et
les cinq fiches de `references/` portent le détail. Le code et les données vivent dans
`mrp/` et `patrons/` du dépôt `lasclay/missive-automations`.

## En une phrase

Lasclay fabrique des produits isolés à la soie d'asclépiade ; la conception et la vente sont à
Québec, la couture est en Tunisie chez deux sous-traitants (**BMB Textile** et **Grada Mode**),
et le MRP existe pour que les deux bouts travaillent sur la même réalité. **En ligne :
[lasclay-mrp.onrender.com](https://lasclay-mrp.onrender.com)**.

## Le recadrage qui décide de tout

Ce qu'on appelle « le MRP » est en réalité **trois systèmes**, et les confondre fait acheter le
mauvais outil :

| # | Système | État |
| --- | --- | --- |
| 1 | **MRP** — inventaire, nomenclatures, planification, alertes | problème résolu depuis trente ans, peu de valeur à réinventer ; **construit ici** |
| 2 | **PLM textile** — patrons, fiches techniques, sens de coupe, arbre produits/patrons, HPGL | spécialisé, hors périmètre de tout MRP généraliste ; **amorcé dans `patrons/`** |
| 3 | **Boucle Québec ↔ Tunisie** — discussion contextuelle, calendrier partagé, avancement, bilinguisme, faible bande passante | **c'est le vrai problème**, et aucun produit du marché ne le touche |

Chaque élément de la demande initiale ramène au troisième. Un MRP acheté résout le premier,
ignore le deuxième et ne touche pas au troisième. C'est ce qui justifie le sur-mesure — pas
l'orgueil.

## Les six contraintes non négociables

Elles ont toutes été payées une fois. Ne les rediscute pas sans une raison neuve.

1. **La connexion tunisienne commande l'architecture.** Rendu côté serveur, **zéro JavaScript
   client**, aucune dépendance npm, tout compressé. Aucune page ne dépasse **12 Ko** sur le
   réseau ; le tableau de bord complet pèse **1,6 Ko compressé**. Une application monopage de
   plusieurs mégaoctets ne serait pas utilisée : l'atelier retournerait à WhatsApp.
2. **Aucun fichier lourd hébergé.** L'app ne stocke que des URL. `urlImage()` (`vues.js`) ajoute
   `?width=N` aux URL `cdn.shopify.com` et convertit les liens Drive — dix fois moins de données
   pour un affichage identique. Prix assumé : une image retirée de Shopify laisse un cadre vide.
3. **Le stock n'est pas une colonne, c'est la somme de ses mouvements.** Une colonne se
   désynchronise en silence ; une somme ne peut pas mentir sur son propre historique.
4. **Aucune date de production n'est stockée.** Le calendrier est recalculé à chaque affichage en
   étalant ce qui reste sur la capacité disponible. C'est ce qui fait qu'il n'y a jamais ni trou
   ni chevauchement, et qu'il n'y a rien à « repropager ». Pas de glisser-déposer : une barre
   déplacée à la main créerait une date qui ne vient d'aucun calcul.
5. **« Il en manquera » et « on ne sait pas » sont deux listes différentes.** Une matière jamais
   comptée n'est pas déclarée en rupture. Trente-six inconnues rangées dans les urgences font
   trente-six fausses alertes, et l'atelier cesse de lire la liste.
6. **Zéro est le seul chiffre dont on soit sûr qu'il est faux.** Un item sans temps unitaire ne
   compte pas pour zéro heure : l'app chiffre la fourchette de ce qu'il manque.

## Le partage des rôles, qui est un partage géographique

Deux rôles seulement : `admin` (**Admin QC**) et `atelier` (**Atelier Tunisie**). Ce n'est pas une
hiérarchie, c'est le constat que chacun est seul à savoir ce que l'autre ne peut pas voir.

- **Montassar déclare l'avancement** de chaque item touché, à la fin de sa journée de travail.
  C'est sa responsabilité et la seule écriture qui lui soit ouverte, hors commentaires et tâches.
- **Gabriel et Catherine posent les priorités**, créent les ordres et les échéances.
- **Québec ne met jamais à jour un avancement à la place de l'atelier.** Un chiffre venu de Québec
  est une supposition, et elle entre en base avec le même poids qu'une observation. Quand Québec a
  besoin d'un chiffre, il le **demande** — c'est à ça que sert le bouton « Demander une mise à jour ».
- Le module **Tâches** est le seul où les deux rôles ont exactement les mêmes droits.

**Ce que l'avancement veut dire** : une estimation de **pièces terminées**, par tranches de 10 %,
pas d'effort dépensé. 2 000 cache-cous à 40 % = environ 800 finis. Un cache-cou coupé mais non
matelassé ne compte pas. L'assistant refuse de traduire « presque fini » en 90 %.

## Où est quoi

| Chemin | Contenu |
| --- | --- |
| `mrp/` | l'application : ~13 000 lignes, 12 fichiers JS principaux, aucune dépendance |
| `mrp/README.md` | la description complète de chaque module, écran par écran |
| `mrp/METHODE-SUIVI.md` | qui met à jour quoi, quand, et ce que le chiffre veut dire |
| `mrp/DEPLOIEMENT.md` | la mise en ligne Render, dans l'ordre où on clique |
| `mrp/SCHEMA-V2.md` | ce qu'il faut prendre du schéma v0.1 dérivé de Miro, et ce qu'il faut laisser |
| `mrp/FICHES-PRODUITS.md` | l'état des fiches et ce qu'une fiche « exhaustive ++++ » demanderait |
| `mrp/COMPARAISON-ERPNEXT.md` | ce que le plus gros ERP libre fait de son ordonnancement |
| `mrp/donnees/` | 21 fichiers TSV — les sources, avec `SOURCES.md` comme carte |
| `mrp-audit/` | l'audit MRPeasy : 2 515 lignes de `.md`, 115 écrans capturés en PDF |
| `patrons/` | audit d'échelle HPGL, diagnostic PDF, convertisseur PDF → HPGL |

Les fiches de ce skill, quand tu as besoin du détail :

| Fiche | Quand la lire |
| --- | --- |
| `references/app.md` | modules, règles de calcul, modèle de données, variables d'environnement, déploiement, tests |
| `references/donnees.md` | les sources, ce que porte chaque TSV, les pièges, ce qui n'existe nulle part |
| `references/marche.md` | MRPeasy, ERPNext, le PLM textile — les verdicts et ce qu'on en reprend |
| `references/patrons.md` | HPGL, les trois conventions d'unités, la conversion, DXF-AAMA |
| `references/decisions.md` | les besoins exprimés, ce qui reste à trancher, le backlog priorisé |

## Les chiffres à connaître

**L'autorité, c'est `node mrp/import.js` (aperçu, rien n'est écrit) — pas les `.md` du dépôt.**
Le plan bouge par ajouts datés, et les documents ne suivent pas toujours : au 23 septembre 2026,
`README.md`, `DEPLOIEMENT.md`, `SOURCES.md` et `SCHEMA-V2.md` annoncent encore **27 items /
24 333 unités**, alors que les données en donnent **30 et 26 133**. Vérifie avant de citer un
chiffre.

Plan de production **26-27**, état au 23 septembre 2026 :

- **26 133 unités** sur **30 items**, plus **139 lignes** de taille × coloris.
- **34 produits** de production, **32** rattachés à une fiche Shopify, **12** avec une fiche COGS,
  164 photos.
- **39 matières** pour **65 lignes** de nomenclature au fichier, dont **46** entrent dans l'import.
- **4 320 heures** disponibles avant le 1er octobre avec 20 postes.

Fiabilité du rattachement Shopify : 15 sûr · 6 à confirmer · 5 non couvert · 4 partiel · 3 non
vendu · 1 non produit.

## Le calcul de charge, et pourquoi il est la question la plus ouverte

Une heure d'atelier vient de **deux étapes distinctes**, pas de deux versions du même chiffre :

1. le **chronomètre** (`donnees/temps-operations.tsv`) mesure la **préparation** — coupe,
   matelassage, remplissage, mélange d'asclépiade ;
2. le **prix BMB** (`donnees/assemblage-bmb.tsv`) paie l'**assemblage** — la couture facturée
   par unité.

Tout se convertit à **26 $/h**, la règle que le suivi Tunisie applique déjà. La preuve que ce sont
deux choses : sur le cache-cou, six opérations chronométrées donnent 17 min et BMB facture 3 $
(≈ 7 min) ; sur la tuque sport, trois opérations donnent 2 min et BMB facture 4 $ (≈ 9 min). Si
c'était la même mesure vue de deux façons, le rapport serait constant.

**Le périmètre décide si le plan tient, et personne ne l'a tranché :**

| Ce que l'atelier fait | Charge | Verdict |
| --- | ---: | --- |
| Préparation seulement | 2 417 h | rentre, +1 903 h |
| Assemblage seulement | 3 829 h | rentre, +491 h |
| **Préparation + assemblage** (défaut) | **5 311 h** | **manque 991 h** |

Du simple au double. Le défaut est la lecture prudente — celle qui ne rentre pas. **C'est la
première chose à trancher, et c'est une question, pas un calcul** : est-ce que les couturières de
BMB font aussi la coupe, le matelassage et le remplissage ?

La **capacité n'est pas mesurée** non plus : 20 postes est un chiffre *déclaré* en août 2026,
affiché « équipe annoncée · non confirmée ici ». *20 personnes dans l'atelier* n'est pas
*20 personnes qui cousent*, et personne n'a dit si ces 20 sont chez BMB, chez Grada, ou les deux.

## Les pièges qui ont déjà coûté quelque chose

- **Lire la copie locale du dépôt au lieu de l'état réel.** Un plan de chargement de conteneur a
  été calculé sur un ordre « à 0 % » qui était en réalité à 42 % : l'analyse lisait les TSV, qui
  ne voient jamais ce que l'atelier déclare. Pour l'état réel, appelle `/export.json` :
  `curl -H "X-MRP-Jeton: $MRP_JETON_EXPORT" https://lasclay-mrp.onrender.com/export.json`.
- **Le chiffrier COGS se contredit sur douze lignes.** La consommation y est du texte libre
  (« 2 pads (4,80 pads/m) », « voir fiche ») alors que le coût est un nombre fiable. On déduit donc
  consommation = coût par produit ÷ prix unitaire, et la phrase sert de contre-vérification.
  **Le coût fait foi** — c'est lui qui a servi à fixer les prix de vente. `node import.js` liste
  les douze nommément ; c'est la phrase qu'il faut corriger à la source.
- **Les libellés des fiches COGS mentent.** Les 17 chiffriers ont été clonés les uns des autres :
  la fiche « Tuque Sport » contient « COST TISSUS mitaines 2024 », la fiche « Manteau » ouvre sur
  un onglet 2022 de mitaines. Les *valeurs* sont bonnes, les *titres* traînent.
- **Render suit `main`.** Un travail resté sur une branche n'est pas en ligne. Et fusionner
  redéploie aussi le General Proxy, le Finance Proxy et le Missive Proxy — éviter pendant une
  expédition.
- **Le plan gratuit Render effacerait la base** à chaque redéploiement : le disque persistant et
  l'offre `starter` sont obligatoires.
- **Tout part à zéro.** Aucun avancement n'est saisi à l'import : le plan donne des quantités, pas
  de l'avancement.
- **Les documents du dépôt sont en retard sur les données.** Quatre `.md` annoncent encore le plan
  d'août. Un chiffre se relit à la source (`node mrp/import.js`, ou `/export.json` pour l'état
  déclaré), jamais dans une phrase de README.
- **Le périmètre d'un ordre vivant est `statut IN ('planifie','en_cours')`**, et il doit être le
  même sur tous les écrans. Le détecteur d'items figés a un jour exigé `en_cours` seul : l'ordre
  importé du plan étant `planifie`, trois items bloqués depuis 9 à 14 jours n'apparaissaient nulle
  part — et c'est le seul bloc du suivi qui demande une action. Neuf requêtes de `db.js` partagent
  maintenant ce périmètre.

## L'assistant

C'est un agent, pas un chatbot : **34 outils** (`mrp/outils.js`) qui appellent les mêmes écritures
que les formulaires, dans la même base, avec les mêmes contraintes.

```
lister_ordres lire_ordre chercher_produit lire_produit a_fabriquer definir_famille
definir_fabrication definir_priorite suivi_production cedule maj_avancement commenter
lire_qualite ajouter_point_qc signaler_bris lister_taches creer_tache terminer_tache
creer_ordre ajouter_item maj_item retirer_item maj_ordre ajouter_jalon retirer_jalon
creer_produit maj_produit ajouter_materiau ajouter_patron ajouter_photo etat_stock
stock_matiere besoins_produit mouvement_stock
```

Trois garde-fous : **les droits sont vérifiés dans les outils**, pas seulement dans les routes
(l'atelier ne reçoit même pas les schémas des outils d'administration) ; **toute écriture est
journalisée avec de quoi la défaire**, et seul le dernier tour encore en place s'annule ;
**aucune suppression d'ordre ni de produit** par une phrase.

Les **gabarits** sous la boîte de saisie **remplissent la boîte, ils n'envoient rien** — une phrase
toute faite est presque jamais la bonne phrase, il manque la quantité, la date, la précision qui
compte. Le menu déroulant est *dans* la phrase, à la place du trou.

## Le bilinguisme, qui est à moitié fait

Le modèle porte un nom arabe sur les matières ; **personne ne l'a rempli**. C'est la moitié du
bilinguisme qui compte pour l'atelier : que Québec et Tunis désignent le même rouleau. La
traduction de l'interface FR/AR/EN est volontairement hors de la version actuelle.

C'est aussi le point où **aucun MRP du marché ne suit** : MRPeasy affiche son interface en 33
langues, mais le paramètre « langue » ne s'applique qu'aux documents imprimés pour un client ou un
fournisseur — la description d'un article n'existe qu'en une seule langue. Un modèle de données
bilingue se décide au premier jour ; ça ne se rajoute pas après coup.

## La discussion contextuelle, qui est un symptôme autant qu'un besoin

« Quel tissu pour ce produit », « quel sens de coupe », « quelles couleurs » ne sont pas des
questions de conversation : ce sont **trois champs manquants** dans la fiche technique. Le tissu,
c'est la nomenclature ; le sens de coupe, un attribut de la ligne de nomenclature ; les couleurs,
une matrice de variantes.

Construire une messagerie pour répondre chaque semaine à « quel sens de coupe » industrialise le
problème au lieu de le régler. **Tarir ces questions est le but** : chaque réponse qui devient une
donnée de fiche est un aller-retour de moins. La discussion ne doit servir qu'à ce qui varie
vraiment — un problème sur un lot, un arbitrage, une exception — et elle est **attachée à l'objet**
(le fil d'un item d'ordre), jamais à un canal général.

Limite actuelle connue : les commentaires existent sur les **ordres**, pas sur les **produits**.
Une réponse donnée une fois se perd quand l'ordre se termine.

## La charte Miro

Le tableau **« Charte produits Lasclay (copie MRP) »** — `uXjVHuYrQSA=` — est **accessible
maintenant** : 633 objets, 64 frames, 26 produits, rangés en bandes par pays (TUNISIE, CHINE).
Chaque frame est une fiche produit à deux colonnes : la **fiche technique** (de quoi c'est fait) et
les **vérifications** (ce qu'on regarde avant d'emballer).

Il est déjà relevé dans le dépôt — `donnees/charte-produits.tsv` (211 lignes en base) et
`donnees/qualite-charte.tsv` — mais **à partir d'un export PDF basse résolution** : 328 px par
carte, sans couche de texte. Le corps se lit, **les vignettes d'étiquettes et les schémas de cotes
non**, et ce qui manquait est marqué `À RELIRE` plutôt que deviné.

**Conséquence actionnable :** le tableau étant maintenant lisible directement, les `À RELIRE`
peuvent être comblés à la source (82 images et 16 documents y sont attachés) au lieu d'être
devinés. C'est le travail qui débloque les « fiches produits exhaustives ++++ ».

## Ce qui reste à trancher

Dix questions, dont trois commandent l'architecture. Le détail et les options sont dans
`references/decisions.md` ; en tête de liste :

1. **Le périmètre de l'atelier** — préparation, assemblage, ou les deux. Décide si le plan tient.
2. **La granularité de traçabilité par lot** — la recommandation est **par famille d'articles** :
   obligatoire sur la fibre et les tissus, automatique sur la visserie et les emballages. MRPeasy
   en fait un interrupteur global, et c'est là que se concentrent 80 % de ses problèmes.
3. **Les fiches poussées : dans le MRP ou dans Miro ?** Si elles vivent dans le MRP, Miro devient
   une source à importer une fois. Si elles restent dans Miro, le MRP n'a qu'à pointer dessus.

## Travailler dans ce projet

```sh
cd mrp
node mrp.js demo                    # jeu de données inventé
node import.js                      # aperçu : ce qui serait fait, rien n'est écrit
node import.js --ecrire             # applique — idempotent, ne touche jamais aux avancements
node server.js                      # http://localhost:3000
sh tests/tout.sh                    # 5 suites, aucun réseau, aucune clé API
node tools/gantt_export.js > gantt.html
```

Node 22.5 minimum (`node:sqlite`). Avant de pousser quoi que ce soit qui touche `charge.js`,
`db.js` ou `vues.js` : **`sh tests/tout.sh` passe, ou ça ne part pas.** Les tests couvrent les
invariants du calendrier (aucune journée en surcapacité, aucun travail un dimanche, le domino
mesuré) et la frontière « il en manque » / « on ne sait pas ».

Ce qui n'est **pas** couvert : le jugement du modèle. Après un changement de modèle ou de consigne
d'assistant, essayer à la main quelques phrases réelles — dont une référence ambiguë et une demande
hors des droits de l'utilisateur.

## Les services déjà en place — ne reconstruis rien

| Besoin | Chemin existant |
| --- | --- |
| Commandes, produits, stock boutique | Shopify (connecteur MCP) |
| Expéditions, étiquettes, suivi | ShipStation via le General Proxy — skill `proxygen` |
| Comptabilité | QuickBooks via le Finance Proxy — skill `qbo` |
| Communication client | Missive — skills `missive` et `support` |
| Marketing | Klaviyo / Omnisend — hors périmètre MRP |
