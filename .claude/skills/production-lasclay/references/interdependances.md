# Les interdépendances — qui dépend de quoi, et ce qui casse

Le MRP n'a presque aucune donnée autonome : tout se déduit d'autre chose. C'est ce qui le rend
cohérent, et c'est ce qui fait qu'une correction anodine à un bout se voit à l'autre. **Cette fiche
sert à répondre à « si je change ça, qu'est-ce qui bouge ? »**

## La chaîne complète, de la source à l'écran

```
SOURCES EXTERNES                 FICHIERS DU DÉPÔT            BASE              ÉCRANS
──────────────────               ─────────────────            ────              ──────

Shopify (API bulk)  ───────────► shopify-produits.tsv   ──┐
                                 shopify-variantes.tsv    ├─► produits ────────► Fiches produits
                                 shopify-images.tsv     ──┘   produit_photos     Galeries

Drive : 17 fiches COGS ────────► cogs-tunisie.tsv       ──┐
                                 nomenclatures.tsv        ├─► matieres ────────► Inventaire
                                 temps-operations.tsv     │   nomenclature       Besoins
                                 fournisseurs.tsv       ──┘                      Cédule

Drive : plan 26-27 ────────────► plan-production-2627.tsv ─┐
                                 plan-variantes-2627.tsv   ├─► ordres ─────────► Ordre de production
                                 ajouts-production.tsv     │   ordre_items       À fabriquer
                                 correspondances.tsv     ──┘   item_variantes    Calendrier

Drive : suivi Tunisie ─────────► production-tunisie.md  ──┐
                                 assemblage-bmb.tsv     ◄──┘ (extrait_bmb.js)
                                                          └─► produits.notes_tech

Miro : charte produits ────────► charte-produits.tsv    ──► produit_materiaux ─► Fiche : composition
                                 qualite-charte.tsv     ──┐
Terrain / Missive ─────────────► bris-terrain.tsv       ──┼─► qc_points ───────► Protocole qualité
                                 qualite-amorce.tsv       │   qc_bris            Checklist de lot
                                 qualite-squelettes.tsv   │   qc_controles       Mur des bris
                                 qualite-hors-sujet.tsv ──┘

L'ATELIER (saisie directe) ────────────────────────────────► avancement ───────► Suivi
                                                             mouvements          Inventaire
                                                             qc_controles        Tout le reste
```

**Une seule donnée ne vient d'aucune source : l'avancement.** C'est pour ça que `/export.json`
existe — la copie locale du dépôt ne le voit jamais.

## Le pivot : `correspondances.tsv`

C'est la table qui relie les trois univers, et **la seule dont une erreur se propage partout** :

```
                    ┌──────────────────────┐
   plan 26-27  ────►│  correspondances.tsv │◄──── Shopify (handle)
   (alias_plan)     │                      │
                    │  code  ← LE PIVOT    │
                    │  famille             │────► le tri d'À fabriquer
                    │  fabrication         │────► ce qui est écarté de la liste
                    │  confiance           │────► les notes techniques visibles dans l'app
                    └──────────┬───────────┘
                               ▼
                    COGS · charte · qualité · BMB · temps
```

**L'import pivote sur le `code`, jamais sur le nom.** Un produit renommé dans Shopify ou dans le
plan ne casse rien ; un `code` changé casse tout — les avancements se rattachent à lui.

Ce que la colonne `famille` commande : l'ordre de *À fabriquer* (hiver → nouveau → isotherme →
autre), donc **l'ordre des barres de la cédule**, donc **les dates du calendrier**. Changer la
famille d'un produit déplace de vraies dates.

Ce que la colonne `fabrication` commande : un produit `chine` **disparaît d'À fabriquer** mais reste
à l'ordre, avec un encadré qui dit combien d'unités sont écartées et où elles se font.

## Les cascades de calcul

### La charge, en quatre étages

```
temps-operations.tsv ─┐                      ┌─ ligne « Total » ? elle l'emporte sur la somme
assemblage-bmb.tsv   ─┼─► temps unitaire ────┼─ « Confection Lasclay » ? l'assemblage n'est PAS ajouté
cogs-tunisie.tsv     ─┘   (26 $/h)           └─ somme de postes seule ? marquée « partiel » = plancher
                               │
                               ▼
              × quantité restante  ◄──── avancement déclaré par l'atelier
                               │
                               ▼
                         charge totale  ──► verdict (3 états) ──► « est-ce que ça rentre »
                               │
                               ▼
                    étalement sur la capacité  ◄──── reglages : postes × heures × jours
                               │                     pauses d'atelier
                               ▼                     date de départ
                    calendrier + Gantt  ──► dates, jamais stockées
```

**Quatre leviers déplacent toutes les dates** : la priorité d'un item, la date de départ, les pauses
d'atelier, la capacité. Aucun autre. Et **le périmètre** — préparation / assemblage / les deux —
change le total du simple au double.

### Le besoin matière

```
nomenclatures.tsv ──► consommation = coût par produit ÷ prix unitaire
                              │        (la phrase sert de contre-vérification, 12 divergent)
                              ▼
                      × quantité restante ◄── avancement déclaré
                              │
                              ▼
                        besoin en matière
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
        stock connu ?            jamais compté ?
        (somme des mouvements)   → « on ne sait pas », PAS « il en manque »
                    │
                    ▼
            « il en manquera X »
```

**La frontière entre les deux listes est un invariant testé** (`tests/inventaire.js`). La franchir
transformerait 36 inconnues en 36 fausses alertes.

## Ce qui casse si vous touchez à…

| Vous changez… | Ce qui bouge | Ce qui casse si vous n'y pensez pas |
| --- | --- | --- |
| **un `code` de `correspondances.tsv`** | tout | les avancements déclarés se détachent de leur item |
| **la `famille` d'un produit** | tri d'À fabriquer → ordre des barres → **dates du calendrier** | rien ne casse, mais les dates changent sans prévenir |
| **la `fabrication`** (`tunisie`/`chine`) | le produit entre ou sort d'À fabriquer | une ligne disparaît de la liste ; l'encadré doit l'expliquer |
| **un coût dans `nomenclatures.tsv`** | la consommation déduite → le besoin matière → les alertes | le coût **fait foi** ; corriger la phrase, pas le coût |
| **un prix BMB ou un chrono** | le temps unitaire → la charge → le verdict → les dates | vérifier la règle « Total l'emporte » et « Confection couvre la couture » |
| **le périmètre de l'atelier** | 2 417 / 3 829 / **5 311 h** | le verdict passe de vert à rouge |
| **la capacité (postes × h × j)** | l'étalement complet | le défaut de 20 postes est **déclaré, pas mesuré** |
| **une pause d'atelier** | tout ce qui suit se recale, sans trou ni chevauchement | invariant testé : fermer 5 jours ouvrés recule la fin de 5 jours ouvrés |
| **un point du protocole qualité** | apparaît **non vérifié sur tous les lots en cours**, y compris ceux à 90 % | c'est voulu : ce sont ceux à qui ça sert |
| **un point QC général** (`produit_id IS NULL`) | apparaît sur **tous** les produits | l'écarter d'un produit ≠ le supprimer — motif obligatoire |
| **la règle d'échantillonnage** (`ech_type`/`ech_valeur`) | le nombre écrit sur chaque checklist | 1 sur 20 = 5 pièces sur 100, **175 sur 3 500** |
| **un handle Shopify** | photos, description, titre de la fiche | l'inversion des deux manteaux a duré des mois |
| **une URL d'image** | la fiche affiche un cadre vide | assumé : l'app n'héberge rien, la source est la seule vérité |
| **`MRP_JETON_EXPORT`** (< 24 car.) | `/export.json` **disparaît** silencieusement | elle retombe sur le routeur ordinaire, comme une adresse inconnue |
| **`MRP_COURRIEL_ARME`** | le rappel du vendredi part ou non | le secret Missive **ne suffit pas** — c'est volontaire |
| **le mot de passe d'un compte** | **ferme les sessions ouvertes ailleurs** | épargne la session courante ; c'est le but |

## Les verrous croisés

**`blocageQC` vit dans `db.js`, et les deux chemins d'écriture y passent** — le formulaire et
l'assistant. Aucun des deux ne contourne l'autre. Un lot ne peut pas être déclaré à 100 % tant que
tous ses points n'ont pas de verdict.

**Les droits sont vérifiés dans les outils, pas seulement dans les routes.** L'atelier ne reçoit même
pas les schémas des outils d'administration : l'assistant ne lui sert pas d'échelle pour passer
par-dessus le mur.

**La restriction « chacun ne corrige que ses propres messages » est dans la clause SQL**, pas dans un
contrôle de rôle qu'une URL fabriquée contournerait.

**Le périmètre `statut IN ('planifie','en_cours')` est partagé par neuf requêtes de `db.js`.** Quand
un seul écran l'a oublié, trois items figés depuis 9 à 14 jours ont disparu du seul bloc qui demande
une action. **Si vous ajoutez une requête sur les ordres vivants, reprenez ce périmètre.**

## Les imports, et ce que chacun a le droit d'écraser

| Import | Quand | Écrase | N'écrase jamais |
| --- | --- | --- | --- |
| `import.js` | **une fois**, base vide | le catalogue | tout, si la base est peuplée — il vient de Shopify, le relancer perdrait une correction faite dans l'app |
| `import.js --ecrire` *(relance)* | sur demande | les **quantités** | **les avancements** — c'est l'atelier qui les déclare |
| `import_charte.js` | à chaque démarrage | les lignes dont **il** est la source | ce qui a été écrit dans l'app |
| `import_qualite.js` | à chaque démarrage | les points marqués « notes techniques » | un point qui porte le nom de son auteur |
| `import_bris.js` | à chaque démarrage | ses propres lignes | les rattachements faits à la main |

**Les trois derniers se rechargent après que le service ait commencé à répondre** — ils prennent
20 secondes, et Render coupe une instance qui ne répond pas encore à sa sonde. `MRP_SANS_AMORCE=1`
les désactive (c'est ce que font les tests de bout en bout).

**L'ordre compte : les protocoles avant les bris**, parce qu'un bris peut se rattacher à un point.

## Les dépendances externes du MRP

| Dépend de | Pour quoi | Ce qui se passe sans |
| --- | --- | --- |
| **Shopify** (CDN) | toutes les images, servies redimensionnées | cadre vide sur la fiche ; l'app fonctionne |
| **Shopify** (API bulk) | régénérer le catalogue | rien, tant qu'on ne régénère pas |
| **Anthropic** (`ANTHROPIC_API_KEY`) | l'assistant | la page le dit franchement ; le reste marche |
| **Missive Proxy** (`MISSIVE_PROXY_SECRET`) | le rappel hebdomadaire | le message est composé et **écrit au journal**, pas envoyé |
| **Render** (disque persistant) | **toute la mémoire du système** | une base vide à chaque redéploiement |
| **Google Drive** | les sources : COGS, plan, suivi | rien en ligne ; c'est une dépendance de collecte, pas d'exécution |
| **Miro** | la charte et les vérifications | idem |

**Le MRP ne dépend d'aucun autre service Lasclay à l'exécution.** Il ne parle ni à ShipStation, ni à
QuickBooks, ni à Klaviyo. C'est délibéré : un MRP qui tombe parce qu'un proxy d'expédition tousse
n'est pas utilisable par un atelier.

**Mais il partage leur branche.** Les quatre services Render du dépôt suivent `main` : fusionner pour
déployer le MRP **redéploie aussi** le General Proxy, le Finance Proxy et le Missive Proxy. Leur code
ne change pas, mais ils redémarrent — **éviter pendant qu'une expédition est en cours.**

## Les jointures internes qui portent tout

| Jointure | Ce qu'elle permet |
| --- | --- |
| `ordre_items.produit_id → produits.id` | **chaque item cliquable vers sa fiche** — c'est la couture entre les deux moitiés de l'app |
| `item_variantes → ordre_items` | la répartition taille × coloris d'un lot *(≠ le catalogue des variantes vendables)* |
| `qc_bris.point_id → qc_points.id` | la preuve qui a fait écrire la consigne |
| `qc_controles → qc_points` + `ordre_items` | le protocole appliqué à un lot, jamais recopié |
| `mouvements → matieres` | le stock, qui **est** leur somme |
| `nomenclature → produits` + `matieres` | le besoin matière |
| `avancement_historique → ordre_items` | qui a changé quoi, de combien à combien |
| `agent_actions → agent_tours` | de quoi défaire ce que l'assistant a écrit |
| `taches.cree_par ↔ taches.assigne_a` | le seul module sans hiérarchie |

**`reglages` est hors du graphe** : un seul jeu pour tout l'atelier, pas une préférence par
utilisateur. La capacité n'appartient à personne.
