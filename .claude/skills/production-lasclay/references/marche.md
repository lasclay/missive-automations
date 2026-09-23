# Le marché — MRPeasy, ERPNext, le PLM textile

Ce qu'on a regardé, ce qu'on en reprend, et pourquoi on construit quand même.

## MRPeasy — l'audit de référence

Dossier `mrp-audit/`. Compte Lasclay : **`operations@lasclay.com`**, connexion à
`https://app.mrpeasy.com/`.

| Fichier | Nature |
| --- | --- |
| `AUDIT-MRPEASY.md` | audit fonctionnel exhaustif, 2 515 lignes, structuré pour lecture par un LLM |
| `AUDIT-MRPEASY-VISUEL.pdf` | **le relevé exécuté** — 115 écrans capturés en vrai et légendés, 84 pages |
| `GUIDE-CAPTURES-MRPEASY.pdf` | le plan de relevé qui a servi à le produire, 65 captures spécifiées, 33 pages |
| `guide-captures.html` | source du plan, regénérable |

**Les deux documents se lisent ensemble.** Le `.md` a été écrit **sans accès au compte** — le
périmètre reconstitué depuis le manuel officiel (187 pages) et les deux spécifications OpenAPI
(v1 et v2 : 49 chemins, 116 et 135 schémas — c'est le schéma de base de données réel). Le PDF
visuel a été produit **avec accès** : version V.10.26746, jeu de démonstration « Simple discrete
manufacturing », 26 fonctions optionnelles activées pour révéler toute la surface. **L'un dit
comment ça marche, l'autre montre à quoi ça ressemble.**

Le visuel corrige deux comptes du premier, parce qu'il compte des **interrupteurs à l'écran** là où
le manuel liste des **capacités** : **15** fonctions Professional (et non 16), **11** Enterprise
(et non 13). « Custom Fields » est documenté comme fonction mais n'est pas un interrupteur — les
champs personnalisés se configurent entité par entité.

**Ce qu'aucun des deux ne couvre** : la configuration réelle de l'instance Lasclay. Le visuel a été
fait sur le jeu de démonstration. Sans importance pour concevoir un MRP sur mesure ; déterminant
s'il fallait reprendre des données existantes.

Régénérer le PDF du guide :

```sh
/opt/pw-browsers/chromium-*/chrome-linux/chrome --headless --disable-gpu --no-sandbox \
  --no-pdf-header-footer --print-to-pdf=GUIDE-CAPTURES-MRPEASY.pdf \
  "file://$PWD/guide-captures.html"
```

### La tarification, qui est le calcul d'arbitrage

| Palier | $/utilisateur/mois | À partir du 11ᵉ |
| --- | ---: | --- |
| Starter | 49 | 79 $ / 10 utilisateurs |
| Professional | 69 | 79 $ / 10 |
| **Enterprise** *(le plus populaire)* | **99** | 79 $ / 10 |
| Unlimited | 149 (minimum 2) | 79 $ / 10 |

**Le contrôle qualité, les numéros de série et la sous-traitance sont en Professional ; les
codes-barres, le multi-entrepôt, le MPS et les retours clients en Enterprise.** Pour un
manufacturier réel, le palier d'entrée fonctionnellement viable est donc **Enterprise à
99 $/utilisateur/mois** — et **l'API n'est accessible qu'à 149 $**, soit +50 % par utilisateur pour
le seul droit d'automatiser.

Ordre de grandeur pour Lasclay à 5 utilisateurs : **~5 940 $ US/an sur Enterprise, sans API** ;
**~8 940 $ US/an avec API**. C'est le calcul de référence face auquel le sur-mesure s'arbitre.

### Ce que MRPeasy fait vraiment bien, et qu'il faut étudier de près

**Le configurateur de produit (Matrix BOM).** L'exemple documenté dans leur manuel est littéralement
le cas Lasclay — un vêtement décliné en tailles, tissus et couleurs, où la taille change la quantité
de tissu consommée, le couple tissu × couleur change l'article de tissu utilisé, et la gamme reste
commune à toutes les variantes. C'est exactement le mécanisme requis, et il est non trivial à
construire. **Le concept paramètre / valeur / relation / variante est réutilisable tel quel.**

**Le système de drapeaux de fonctionnalités.** 29 drapeaux qui, activés, injectent champs, colonnes,
sections, onglets et statuts dans toute l'application. C'est le **mécanisme d'architecture le plus
imitable du produit** — et aussi la source de sa complexité.

### Les concepts à reprendre (§17.1 de l'audit)

- **Le lot de stock comme objet pivot** — traçabilité amont/aval, FIFO/FEFO, coût réel, péremption
  et rappel produit découlent tous d'un seul objet bien conçu.
- **Le booking comme lien source ↔ destination** — bien plus clair qu'un champ « quantité réservée ».
- **Quatre statuts orthogonaux sur une commande** — commande / produits / facturation / paiement.
  Chacun répond à une question différente. **À reprendre absolument.**
- **Groupe de postes ≠ poste** — la gamme désigne un groupe, l'ordonnanceur choisit le poste. Les
  gammes restent stables quand le parc machine change.
- **Le type « traitement passif »** — séchage, refroidissement, quarantaine : 24/7, capacité
  illimitée, durée indépendante de la quantité, sans coût de main-d'œuvre.
- **Assignation à un département avec prise en main (« pull »)** — l'opération est visible par tout
  le département jusqu'à ce que quelqu'un la démarre. Simple, sans surcouche de planification RH.
- **Double code couleur fond/texte** dans le planning — avancement et disponibilité matière lus d'un
  coup d'œil sur le même bloc.
- **« Estimate costs and dates »** — simulation complète d'une commande, achats et fabrications
  simulés, avant engagement. Très forte valeur commerciale.
- **L'utilisateur « gratuit »** — fiche sans droits, non facturée, mais assignable à des opérations.
  Résout élégamment le cas des opérateurs sans licence.
- **Le rapport « Deliveries » en lien public** — écran mural d'atelier sans authentification.
  Petite idée, gros effet.
- **La prévision IA qui n'écrase jamais la saisie manuelle** — règle de gouvernance humain/machine
  correcte, à généraliser.
- **La doctrine explicite matière > machine > opérateur** — documenter les principes
  d'ordonnancement dans le produit évite des débats sans fin.

### Ce qu'il faut faire différemment (§17.2)

| Défaut de MRPeasy | Ce qu'on fait |
| --- | --- |
| **Tracing en interrupteur global** | traçabilité **par famille d'articles** — obligatoire sur les matières critiques, automatique sur la visserie |
| **Corrections en 6 à 10 étapes de navigation** | **bouton d'annulation en un clic** sur le document où l'erreur a été faite (déjà le cas pour l'assistant du MRP) |
| **Ordonnancement silencieusement optimiste** quand un délai est inconnu | bloquer et signaler. **Un plan faux coûte plus cher qu'un plan absent** |
| **Sélection alphabétique** de la nomenclature d'un sous-ensemble | choix explicite : nomenclature marquée « par défaut », ou choix au lancement |
| **Deux conventions de coût** (rapports production « impurs », CRM « purs ») | une seule convention, explosion récursive systématique |
| **API en lecture seule** sur PO, expéditions, fournisseurs, stock | API complète en écriture dès le départ — condition de toute automatisation |
| **Interdiction des onglets multiples** | concevoir sans état serveur de session : concurrence optimiste avec numéro de version, pas de verrou de document |
| **Coût 0 sur les articles retournés en RMA** | reprendre le coût du lot d'origine — l'information existe |
| **Champs non modifiables après création** | autoriser la migration avec une procédure de reprise contrôlée |
| **Prévision d'appro limitée à 12 produits** | traitement asynchrone ; aucune raison technique de limiter |
| **Pas de hiérarchie d'emplacements** | emplacements en arbre dès le modèle (`parent_location_id`) |
| **« Use planned goods » qui casse l'historique** | statut explicite « en transit / non réceptionné », coût provisoire assumé et rapport d'écart |

### Les pièges à haut risque (§16.3)

1. **« Use planned goods » = Yes** — consommer des marchandises non reçues : coût initial **0** puis
   corrigé rétroactivement, historique temporairement faux voire négatif, PO/MO source non
   modifiable, écritures comptables rétroactives postées en « ajustements de périodes antérieures »
   vers QuickBooks.
2. **Matrix BOM après coup** — ajouter un paramètre à un article existant rend ses anciennes
   variations « incomplètement définies » : elles disparaissent des listes et les documents
   existants deviennent non modifiables. **Conseil officiel : créer un nouvel article plutôt que
   d'ajouter un paramètre.**
3. **Basculer Tracing** — déclenche des actions automatiques immédiates. Sauvegarde impérative.
4. **Substitute a part** — modifie toutes les nomenclatures filtrées ; sans filtre, **toutes celles
   de la base**. Potentiellement non annulable.
5. **Stock → Inventory** — peut annuler des réservations existantes en LIFO.
6. Les nomenclatures utilisant des **relations** sont exclues du calcul de besoin matière du MPS.

### Les plafonds qui surprennent

12 produits par prévision d'approvisionnement · 3 000 lignes d'import CSV pour articles et
nomenclatures, mais 100 pour un PO · 30 champs personnalisés · icône d'article **50 Ko, 160×120 px**
(c'est pour ça que les images y sont médiocres) · fenêtre d'accès aux commandes Shopify **60 jours**
· OEE historique 1 mois par requête · horizon MPS 5 ans.

### Le point de décision structurant (§17.4)

**La granularité de traçabilité** déterminera l'architecture :

- **par lot partout** → coût réel exact, rappel produit possible, mais saisie quotidienne lourde et
  corrections complexes. C'est le mode Tracing = ON de MRPeasy, et **c'est là que se concentrent
  80 % de ses problèmes d'ergonomie**.
- **allocation automatique FIFO** → saisie minimale, coût moyen suffisant, pas de rappel ciblé.
- **Recommandation : par famille d'articles.** Obligatoire sur la fibre d'asclépiade et les tissus
  (matières critiques, potentiellement soumises à des exigences de provenance et de certification),
  automatique sur les accessoires, fermetures, étiquettes et emballages.

**MRPeasy n'offre pas cette granularité.** C'est précisément le genre d'écart qui justifie un
développement sur mesure plutôt qu'un abonnement.

### Le périmètre minimal viable (§17.3)

**Indispensable en v1** : articles avec nomenclature et gamme multi-niveaux **plus** variations
taille/couleur (le textile impose le Matrix BOM) · lots avec coût réel et traçabilité · ordre de
fabrication avec réservation matière et déclaration d'avancement · PO fournisseur avec devise,
délai en jours ouvrables et **frais additionnels répartis (landed cost)** — critique pour de
l'import · commande client alimentée par Shopify avec les quatre statuts orthogonaux · expédition
avec prélèvement, poussée vers ShipStation · point de commande par article · **sous-traitance par
la méthode « PO + expédition de matières »** — c'est le modèle Tunisie.

**Utile en v2** : ordonnancement à capacité finie et Gantt · déclaration atelier mobile · contrôle
qualité à la réception avec lot en quarantaine · MPS et prévision de ventes (saisonnalité forte) ·
RMA.

**À ne probablement pas construire** : un module comptable interne — QuickBooks est déjà en place
via le Finance Proxy. Construire l'équivalent des **écritures automatiques** (§10.2 de l'audit, la
table complète est directement réutilisable) et les pousser vers QBO, mais **pas un grand livre
parallèle**. Ni portail B2B, ni numéros de série (sans objet pour du textile), ni multi-sites tant
qu'il n'y a qu'un entrepôt réel.

## ERPNext — la meilleure spécification gratuite

Note de lecture complète : `mrp/COMPARAISON-ERPNEXT.md`. Dépôt `frappe/erpnext`, 2 968 fichiers
Python, 161 Mo.

**La licence décide de tout : GNU GPL v3**, à contamination.

- **Lire la conception, oui.** Une idée ne se protège pas.
- **Copier du code, non.** Pas une fonction, pas un fichier, même « adapté » — le MRP Lasclay
  deviendrait GPLv3, avec obligation de publier sa source.
- Réimplémenter un concept à partir de sa description est licite et courant.

Leur `manufacturing/scheduling/DESIGN.md` est un document de conception public, argumenté, avec ses
décisions et ses questions ouvertes. **C'est un cahier des charges gratuit.**

**Ce qu'on fait déjà comme eux** — ce sont les invariants du problème : placement avant à capacité
finie, priorité qui départage sous contention, calendrier de ressource (plages + fériés), les
placements déjà faits contraignent les suivants, les fermetures se retirent et le plan se resserre.

**Un point où on va plus loin qu'eux.** Leur moteur est « dry-run par défaut, l'appelant persiste » :
la proposition est écrite dans `schedule_date` quand l'utilisateur applique. **Nous ne stockons
aucune date.** Ils ont écrit une section entière (phase 2) pour matérialiser ce qu'on obtient en ne
l'écrivant jamais. Leur propre constat : *« Production Plan today carries dates […] but nothing
computes them — users type them in. »* C'est exactement le chiffrier `PRODUCTION MASTER SHEET`.

**Les trois choses à reprendre, dans cet ordre de valeur :**

1. **La matière contraint la production.** `/besoins` sait qu'il manquera 631 m² de Vegeto ; le
   calendrier l'ignore et place la production comme si la matière était là. La colonne `delai_jours`
   existe sur les matières et **ne sert à rien pour l'instant**. Relier les deux transformerait deux
   modules justes en un module vrai — **et c'est ce qui distingue un MRP d'un calendrier**.
2. **L'ordonnancement à rebours.** La vraie question n'est pas « si on commence aujourd'hui, on
   finit quand ? » mais **« le conteneur part le 20 octobre, l'atelier doit commencer quand ? »**.
   Leur garde-fou est à reprendre tel quel : **repli avant en cas d'échec** — si le calcul à rebours
   place un début dans le passé, la tâche et tout ce qui en dépend est replacée au plus tôt depuis
   aujourd'hui. Une date impossible dégénère en « au plus tôt possible » au lieu de lever une erreur.
3. **Le mode infini.** Mêmes calendriers, mais en ignorant la charge déjà posée. Comparer la fin en
   mode fini et en mode infini **est** le rapport de surcharge. Une date contre une date se lit mieux
   qu'un solde d'heures : « au plus tôt le 12 octobre si l'atelier était vide, le 3 novembre avec ce
   qui est déjà engagé ».

**Aucune ne demande un nouveau moteur** : les trois sont des variations de la boucle de
`charge.calendrier()`.

Ce qu'ils ont d'autre, noté sans recommandation : gammes avec `sequence_id` et `depends_on` (c'est
exactement la tension que notre réglage « ce que l'atelier fait » contourne) · `Job Card Time Log`
(le temps réellement passé, ce qui permet à la longue de remplacer un temps déduit par un temps
mesuré) · postes multiples avec calendrier propre · choix du poste par capacité · `Downtime Entry`
(les arrêts *subis*, distincts des fermetures *prévues*) · `Plant Floor`.

## Le PLM textile — le trou que personne ne comble

**Les patrons ne sont pas de la matière.** Un patron n'est ni consommé ni stocké : c'est une
ressource de conception, comme une recette. Le domaine s'appelle le **PLM textile**, et c'est un
logiciel différent.

C'est le seul point où MRPeasy est franchement inexistant : **sa seule capacité CAO est l'affichage
de modèles 3D Collada.** Rien en 2D, rien en DXF-AAMA, rien en HPGL.

| Outil | Ce que c'est |
| --- | --- |
| **PolyPM / PolyNest** | le plus abouti pour couvrir à la fois l'ERP textile et le patronnage — import/export DXF-AAMA, pilotage direct des traceurs et découpeurs |
| Optitex, Lectra, Gerber, Audaces | la CAO pure — logiciels lourds, chers, vendus au poste |

**Bonne nouvelle sur le convertisseur** : HPGL est un format trivial — du texte, une poignée de
commandes. Convertir vers SVG ou DXF, ou l'inverse, c'est quelques centaines de lignes de code, pas
un projet. **Ce n'est pas ce qui doit dicter le choix d'architecture.** Détail dans
`references/patrons.md`.

## Les autres dépôts regardés

| Dépôt | Ce que c'est | Pour Lasclay |
| --- | --- | --- |
| `makeplane/plane` | alternative libre à Jira / Linear | le module `taches` du MRP couvre déjà le besoin |
| `triggerdotdev/trigger.dev` | tâches planifiées, Apache 2.0 | les Routines et Render font déjà ce travail |
| `getlago/lago` | facturation à l'usage | sans objet : Lasclay vend des objets |
| `relaticle/relaticle` | CRM avec serveur MCP, 32 outils | même idée que nos 34 outils d'assistant — **une confirmation, pas une piste** |

## Le verdict

Environ **70 % des besoins Lasclay sont du MRP standard**, résolu depuis trente ans. Les **30 %
restants sont ce qui compte vraiment**, et c'est précisément ce qu'aucun MRP généraliste ne fait :

| Besoin | Statut sur le marché |
| --- | --- |
| Inventaire, nomenclature, kits, alertes, planification | standard partout |
| Image associée à chaque pièce | standard mais **médiocre** — MRPeasy plafonne les vignettes à 50 Ko / 160×120 px |
| Calendrier dynamique, % d'avancement, planifié vs projeté | **partiel** — les MRP raisonnent en opérations et postes de charge, pas en jalons projet |
| **Discussion contextuelle** | **absent partout** |
| **Multilingue sur les données** (pas l'interface) | **absent partout** |
| **Léger, connexion lente** | MRPeasy est exactement le contraire — l'interdiction des onglets multiples est l'aveu d'une architecture à état serveur |
| Fiches produits exhaustives, HPGL, arbre des patrons | **hors périmètre MRP** |

La contrainte de bande passante est décisive et on la sous-estime toujours : **elle élimine à elle
seule la quasi-totalité du marché.**
