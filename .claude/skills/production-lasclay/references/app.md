# L'application — modules, règles de calcul, modèle, exploitation

Code dans `mrp/`. Node 22.5 minimum, **aucune dépendance npm** : `node:http`, `node:sqlite`,
`node:crypto`. Rendu côté serveur, zéro JavaScript client, tout compressé par l'app elle-même.

## Les fichiers

| Fichier | Lignes | Rôle |
| --- | ---: | --- |
| `vues.js` | 2 710 | tout le HTML, dont `urlImage()` |
| `db.js` | 1 779 | schéma, requêtes, tris — dont `blocageQC` |
| `server.js` | 1 485 | routeur, sessions, compression |
| `outils.js` | 1 264 | les 34 outils de l'assistant |
| `import.js` | 702 | l'import du catalogue et du plan |
| `charge.js` | 579 | temps unitaires, capacité, `calendrier()`, `chargeInconnue()` |
| `vues_inventaire.js` | 482 | stock, mouvements, besoins |
| `assistant.js` · `chiffrier.js` · `rappels.js` · `mrp.js` | — | boucle agentique, lecture COGS, rappel hebdo, CLI |
| `vues_calendrier.js` · `export.js` · `auth.js` · `amorce.js` | — | grille du mois, `/export.json`, scrypt/sessions, premier compte |
| `variantes.js` · `courriel.js` · `salutation.js` · `outils.js` | — | répartitions, envoi Missive, fuseaux |
| `import_charte.js` · `import_qualite.js` · `import_bris.js` | — | imports rejouables au démarrage |
| `tools/gantt_export.js` · `tools/extrait_bmb.js` | — | Gantt autonome, extraction des prix BMB |
| `demo/` | — | l'app figée en page unique, chaque écran récupéré par HTTP tel quel |

## Les modules, et la question à laquelle chacun répond

### Ordres de production — « où en est ce lot précisément ? »

Liste complète des items, avancement **pondéré par les quantités** (2 000 cache-cous à 50 % ne
pèsent pas comme 10 tuques à 100 %), cédule rattachée, commentaires horodatés et signés, historique
de chaque changement : qui, quand, de combien à combien. Chaque item est cliquable vers sa fiche.

**Le fil d'un item** porte quatre natures parce qu'elles ne se lisent pas pareil : une **note**
informe, une **question** attend une phrase, une **demande de mise à jour** attend un chiffre, une
**réponse** referme. Ce qui attend reste **hors du repli**. « Demander une mise à jour » est un
bouton d'administration qui **se referme tout seul quand l'avancement bouge** — déclarer 60 %,
c'est répondre. Une seule demande ouverte à la fois par lot. L'accueil remonte tout ce qui attend,
tous ordres confondus.

Chacun corrige et retire **ses propres** messages : la restriction est dans la clause SQL, pas dans
un contrôle de rôle qu'une URL fabriquée contournerait.

### À fabriquer — « qu'est-ce que je fais en premier ? »

Tout ce qui reste à produire, tous ordres confondus, déjà trié. **Le rang est un calcul, pas un
champ** — ajouter un ordre urgent réordonne la liste tout seul :

1. priorité posée à la main (haute / normale / basse) ;
2. retard — une échéance passée passe devant ;
3. date d'expédition vers le Canada ;
4. famille de production : **hiver, puis nouveaux produits, puis sacs, puis le reste** ;
5. quantité restante, décroissante.

**Pourquoi cet ordre de familles.** L'hiver d'abord : c'est ce que la prévente d'automne vend. Les
nouveaux ensuite, parce qu'ils portent le risque — un échantillon à valider, un patron à confirmer.
Les sacs après : ils se vendent au printemps. Un produit à la fois d'hiver et nouveau compte comme
**nouveau** ; la famille se change produit par produit dans l'app.

La priorité manuelle est **le seul moyen de contredire le calendrier**. Elle sert quand une raison
absente de la base l'exige — un tissu qui vient d'arriver, une machine libre. Posée par Québec,
lue par l'atelier, jamais changée par lui : la raison de bousculer l'ordre est commerciale.

**Ce qui ne se fabrique pas à l'atelier n'y apparaît pas.** La tuque beanie est tricotée en Chine ;
seul son bandeau amovible est fait à l'atelier. Mais un encadré dit combien d'unités sont écartées
et où elles se font — une ligne qui disparaît sans explication est une ligne perdue.

**La répartition par taille et coloris.** « 3 500 cache-cous » ne dit pas quoi couper : une barre
proportionnelle dont chaque segment porte la teinte réelle du coloris, puis le détail chiffré. Les
tailles sont dans l'ordre du corps (XS, S, M, L, XL), pas celui de l'alphabet. Quand le chiffrier
croise deux axes (genre × taille, coloris × modèle), un groupe = une barre dimensionnée à sa part.
Sur mobile, le détail se replie derrière la barre.

**L'avancement reste au niveau de l'item.** Une tranche de 10 % par variante multiplierait la
saisie par cinq sans rien apprendre de plus sur ce qui rentrera dans le conteneur.

### Cédule — « est-ce que ça rentre ? »

La réponse vient **avant** le diagramme, en trois nombres : heures de travail, heures disponibles
d'ici la première échéance, postes.

**Le verdict a trois états**, et la couleur dit la même chose que la phrase : rouge « ça ne rentre
pas », vert « ça rentre », **ambre « ça rentre sur le papier »** quand la marge est plus petite que
ce que les items non chiffrés demanderaient. Une bordure verte au-dessus de « la marge ne tient
pas » se lirait plus vite que la phrase, et dirait le contraire.

**Deux exceptions marquées dans les sources.** Une ligne « Total » (semelles, glacière) et
« Confection Lasclay » (mitaines polar) couvrent déjà la couture : on ne leur ajoute pas
l'assemblage. Une simple somme de postes est marquée **« partiel »** — c'est un plancher.

**Six produits ont des sources qui se contredisent**, et l'app le dit sur la ligne plutôt que de
trancher en silence : le bandeau (2,50 $ BMB contre 0,87 $ COGS), les semelles 6-7-8F (2,50 contre
0,58), le sac à lunch (6 contre 7), et les mitaines cuir, laine et polar — qui pointaient toutes
vers la même fiche COGS « Mitaines polar » à 17,07 $ alors que BMB les facture 6, 5 et 4 $.

**Les deux sacs de couchage** portent un `sous_traitance` (29,22 $ et 31,47 $) mais **pas
d'`assemblage`**. Le poste sous-traitance couvre plus que la confection — sur le manteau, 44,67 $
contre 28,00 $ d'assemblage. L'app refuse de s'en servir et prend le prix BMB (20 $).

**L'atelier est modélisé comme une file unique** : un item à la fois, tous les postes dessus.
C'est une simplification, et elle est du bon côté. Pour « est-ce que ça rentre », seul le total
d'heures compte, et il ne dépend pas de l'ordre de passage ; c'est la date de chaque barre qui est
approchée, pas le verdict.

**Deux échelles** sur le diagramme : les mois pour le repère large, les semaines datées pour la
précision. « La semaine du 15 » est une consigne exécutable ; « en octobre » n'en est pas une.

**Le domino.** Trois leviers à la cédule — date de départ, pauses d'atelier (Aïd, congés, rupture
de matière), capacité — plus la priorité à *À fabriquer*. Tout ce qui suit se recale seul.

`node mrp/tools/gantt_export.js > gantt.html` sort un Gantt autonome, deux thèmes, pour projeter
ou envoyer. **Régénérer après chaque révision du plan**, jamais recopier à la main.

### Calendrier — la grille du mois

Une case par jour : ce que l'atelier fabrique, les heures prises, ce qui est dû, et **pourquoi une
journée est vide** quand elle l'est. Fermetures en ambre avec leur motif, aujourd'hui cerné. Une
teinte par item pour le suivre d'une case à l'autre — la couleur ne veut rien dire en soi. Sous
720 px, la grille devient un agenda vertical et les journées vides disparaissent.

### Suivi — « est-ce que ça avance ? »

Trois blocs, **un seul demande une action** : *Sans mouvement* (commencé, figé depuis 7 jours),
*Avancé sur 7 jours* (converti en pièces : 2 000 cache-cous de 40 à 70 % = 600), *Dernières mises
à jour*.

**Un avancement qui recule est légitime** — lot rejeté au contrôle, recomptage. L'historique garde
les deux valeurs et le nom. Rien à corriger, c'est l'information.

**« En retard » est un drapeau, pas une distance** : la page n'affiche pas « 730 jours de retard »
pour un jalon oublié, elle affiche « en retard » et montre l'échéance vers laquelle on travaille.
Un ordre peut être en retard **et** avoir une échéance devant lui.

### Inventaire — matières et produits finis

**Le signe vient du motif** : réception, consommation, production, expédition, perte. Personne n'a
à taper « −12 » pour dire qu'il a consommé douze mètres.

**Le comptage ne s'ajoute pas au stock, il le remplace** — c'est le geste de l'inventaire physique
— et l'écart avec ce que la base croyait est enregistré.

Alertes de bas niveau sur les matières **et** sur les produits finis.

### Besoins — le calculateur

« Pour 500 tuques, il me faut quoi, et en ai-je assez ? » — matière par matière, avec le verdict et
le coût de la série. Puis, tous ordres confondus : ce qu'il reste à consommer pour finir ce qui est
déjà promis, l'avancement déclaré déduit, trié par ce qui manque puis par valeur.

`/besoins` donne aussi **l'ordre dans lequel commencer les comptages**, le plus engagé d'abord.

### Contrôle qualité

Cinq volets par produit, dans l'ordre où on les lit à l'atelier : **points critiques** (ce qu'on ne
peut pas rattraper), **problèmes fréquents**, **mesures et dimensions** (cote, tolérance, unité,
taille concernée), **cyclage et tests**, **emballage et finition**.

**Le protocole général** : un point sans produit s'applique à tous. Il apparaît sur la checklist de
chaque lot, marqué « général ». Mais un point général est juste *en général* — « aucune tension aux
emmanchures » est absurde sur un tote bag. Depuis la fiche d'un produit, un tel point ne se
**supprime** pas, il s'**écarte de ce produit-là**, avec un motif obligatoire, et reste retrouvable
sous « Ne s'applique pas à ce produit » (`donnees/qualite-hors-sujet.tsv`).

**L'échantillonnage suit le volume.** La règle est stockée structurée (`ech_type` + `ech_valeur`),
et la checklist écrit **le nombre**, pas la règle :

| Règle | Lot de 100 | Lot de 3 500 |
| --- | ---: | ---: |
| 1 sur 20 | 5 | 175 |
| 1 sur 50 | 2 | 70 |
| 5 pièces fixes | 5 | 5 |
| toutes | 100 | 3 500 |
| une fois par lot | 1 | 1 |

Le contrôle enregistre aussi **combien de pièces ont réellement été vues**.

**Conformité dimensionnelle, par taille.** Une taille absente du lot n'est pas exigée ;
l'échantillon se calcule sur les pièces de *cette* taille (4 manteaux sur les 34 en L, pas 15 sur
150) ; `L` reconnaît `Homme / L` ; **sans répartition déclarée, aucune taille n'est écartée**.

**La colonne qui fait la différence, c'est « Sinon… ».** « Presser le col avant l'isolant » se
discute ; « sinon il fond et devient rigide » ne se discute pas. Affichée en rouge sous la consigne.

**Le mur des bris.** `qc_bris` garde la phrase **mot pour mot** — reformuler un client, c'est
perdre ce qui rendait la phrase utile — avec sa zone, sa date, son origine. Aucune photo hébergée :
une URL. La boucle se ferme en trois temps : un bris est signalé (Québec depuis Missive, l'atelier
au montage, ou l'assistant via `signaler_bris`) → on en tire une consigne d'un bouton, et **tous
les bris de la même zone encore orphelins s'y rattachent** → la consigne devient une case à cocher
sur chaque lot. Un signalement sans consigne est marqué : c'est la file de travail du QC.

**Une zone qui revient sur cinq produits n'est pas un défaut de produit, c'est un défaut de
méthode.** La page Qualité ouvre là-dessus : combien de signalements par zone, sur combien de
produits différents, combien sans consigne.

**Le verrou.** Un lot ne peut pas être déclaré à **100 %** tant que tous ses points n'ont pas de
verdict ; le refus nomme les points manquants. Une non-conformité bloque aussi, et se distingue
d'un oubli. Le verrou vit dans `db.js` (`blocageQC`) et **les deux chemins d'écriture y passent** —
le formulaire et l'assistant. **Sans protocole, rien n'est exigé** : c'est un trou, pas une
permission, et la page le dit dans ces mots.

**Dynamique par construction** : le protocole n'est jamais recopié dans le lot. Ajouter un point
critique le fait apparaître non vérifié sur tous les lots en cours, **y compris ceux à 90 %** — ce
sont précisément ceux à qui ça sert. **Journal, pas état** : chaque vérification s'ajoute, aucune
n'écrase la précédente.

**Aucun chiffre de Lasclay n'est inventé** dans les squelettes de cyclage et d'essai porté : combien
de cycles, quelle charge, quelle tolérance n'existent dans aucune source. Les valeurs sont écrites
`À FIXER`, en majuscules, pour qu'on ne les confonde pas avec une mesure.

### Fiches produits

Photos studio et contexte, « c'est quoi », « à quoi ça sert », notes techniques, matériaux et
patrons avec dimensions déclarées, liste des ordres où le produit apparaît, rappel des points
critiques avec lien vers le protocole complet.

### Tâches

**Aucune hiérarchie** : Montassar assigne à Québec exactement comme Québec assigne à Montassar.
Trois listes — **pour moi**, **ce que j'ai demandé**, **sans porteur** ; les faites sont repliées.
Une échéance dépassée porte un filet rouge et remonte. **Une pastille dans le menu, sur toutes les
pages** : un compteur qu'on ne voit que sur sa propre page ne sert à rien. Le **porteur** termine ou
rouvre ; seul le **demandeur** supprime — on ne fait pas disparaître ce qu'on vous a demandé.

### Assistant

Sur l'accueil, en haut, avant tout le reste. **La salutation connaît deux fuseaux** : souhaiter
« bonsoir » à quelqu'un qui déjeune est la façon la plus rapide de faire sentir qu'une app ne sait
pas à qui elle parle. Le fuseau se déduit du rôle, parce que les rôles de cette app **sont** des
lieux. La deuxième phrase dit ce qui attend vraiment — « Une tâche a dépassé son échéance » —
plutôt que « Des questions ? ». Aucun appel au modèle : du texte, calculé en une milliseconde.

L'accueil **reprend la conversation en cours** plutôt que d'en ouvrir une neuve à chaque affichage :
sans ça, « et les mitaines ? » perd son antécédent dès qu'on recharge.

Deux refus valent d'être connus : une **référence ambiguë** (« les cache-cous » quand il en existe
deux) fait poser une question au lieu d'un choix au hasard ; un avancement doit être un **multiple
de 10** donné par l'atelier.

Sur les stocks, l'assistant tient la même règle que l'app : sur une matière sans mouvement, il
répond que le stock est **inconnu** au lieu d'annoncer une rupture qu'il ne peut pas prouver.

**La dictée** utilise `SpeechRecognition` du navigateur (français, arabe, anglais). Sans elle, le
bouton ne s'affiche pas. Dans Chrome, l'audio transite par les serveurs de Google — **pas le canal
pour une information confidentielle** ; en revanche seul du texte remonte à notre serveur, ce qui en
fait l'option la plus légère pour la Tunisie.

La boucle s'arrête d'elle-même après **12 étapes** et l'explique. Sans `ANTHROPIC_API_KEY`, la page
reste consultable et le dit franchement au lieu d'échouer en silence.

## Modèle de données

```
utilisateurs ─┬─ sessions
              ├─ ordres ─┬─ ordre_items ─┬─ avancement_historique
              │          │               └─ item_variantes  (taille × coloris)
              │          ├─ ordre_jalons          (cédule)
              │          └─ ordre_commentaires
              ├─ agent_tours ── agent_actions     (assistant + annulation)
              ├─ taches                           (cree_par ↔ assigne_a)
              ├─ produits ─┬─ produit_photos      (studio | contexte)
              │            ├─ produit_materiaux   (texte libre, pour la fiche)
              │            ├─ produit_patrons
              │            ├─ qc_points ─┬─ qc_controles   (le protocole appliqué à un lot)
              │            │             └─ qc_bris        (ce qui casse : la preuve)
              │            └─ nomenclature ──┐    (calculable, pour les besoins)
              └─ matieres ──────────────────┘
                     └─ mouvements                (le stock est leur somme)

reglages                                          (capacité de l'atelier — un seul jeu)
```

`ordre_items.produit_id` est la jointure entre les deux moitiés : c'est ce qui rend chaque item
cliquable vers sa fiche.

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `PORT` | port d'écoute (défaut 3000) — **ne pas définir sur Render**, il le fournit |
| `MRP_DB` | chemin SQLite (défaut `./data/mrp.db`, prod `/var/data/mrp.db`) |
| `MRP_SECURE` | `1` en production : exige HTTPS sur le cookie de session |
| `ANTHROPIC_API_KEY` | l'assistant ; sans elle la page le signale |
| `MRP_MODELE` | modèle utilisé (défaut `claude-sonnet-5`) |
| `MRP_ADMIN_COURRIEL` / `MRP_ADMIN_MDP` | premier compte, **si et seulement si** la base n'a aucun utilisateur |
| `MRP_COURRIEL_ARME` | `1` pour que le rappel hebdo parte vraiment. **Sans elle, rien n'est envoyé** — la présence du secret Missive ne suffit pas, c'est volontaire |
| `MISSIVE_PROXY_SECRET` | requis en plus de la précédente pour l'envoi |
| `MRP_RAPPEL_HEURE` | heure locale de Tunis du rappel du vendredi (défaut 7) |
| `MRP_SANS_RAPPELS` | `1` désactive le rappel hebdomadaire |
| `MRP_SANS_AMORCE` | `1` désactive le chargement charte/qualité/bris au démarrage |
| `MRP_JETON_EXPORT` | arme `/export.json`. **24 caractères minimum, sinon la route reste absente** |
| `MRP_URL` | adresse publique pour les liens du courriel |

## `/export.json`

Un instantané, un seul appel, rien qui s'écrit : ordres en cours, items avec avancement et
répartition, jalons, les trente dernières déclarations, et depuis combien de jours l'atelier se
tait. **Aucune donnée personnelle** — ni comptes, ni adresses, ni le texte des signalements clients.
Sans `MRP_JETON_EXPORT`, la route n'existe pas.

## Le rappel hebdomadaire

Chaque lundi, une tâche par compte d'atelier : « Déclarer l'avancement — semaine du X », échéance
le vendredi. Le courriel part le **vendredi à 7 h, heure de Tunis** — le jour de l'échéance, quand
il reste une journée pour agir. L'adresse est celle du COMPTE :
`node mrp.js utilisateur:courriel <ancienne> <nouvelle>`.

## Administration

```sh
node mrp.js utilisateur:creer <courriel> <mdp> "<nom>" [admin|atelier]
node mrp.js utilisateur:liste
node mrp.js utilisateur:mdp <courriel> <nouveau-mdp>
node mrp.js utilisateur:role <courriel> <admin|atelier>
node mrp.js utilisateur:desactiver <courriel>
node mrp.js etat
node mrp.js demo
```

**Chacun gère son compte dans l'app** — son nom en haut à droite → *Mon compte*. Il y change son
nom affiché (c'est lui qui signe les mises à jour) et son mot de passe. Un mot de passe transmis par
message doit pouvoir être changé par celui qui le reçoit, et l'atelier n'a pas de shell. Le
changement **ferme les sessions ouvertes ailleurs** et épargne la session courante.

## Déploiement Render

Service `lasclay-mrp`, blueprint `mrp/render.yaml`. Build : aucun. Start :
`node --no-warnings mrp/server.js`. Health check : `/sante`.

- **Offre `starter` obligatoire** (~7 USD/mois + 0,25 pour 1 Go de disque) : le plan gratuit n'a pas
  de disque persistant, la base disparaîtrait à chaque redéploiement.
- Disque `donnees` monté sur `/var/data`, `MRP_DB=/var/data/mrp.db`.
- `NODE_VERSION` ≥ 22.5 — sinon `Cannot find module 'node:sqlite'`.
- **Render suit `main`** : fusionner la branche avant de déployer. Ça redéploie aussi les trois
  autres proxys du dépôt.
- L'app **ne dort pas** sur `starter` : pas de réveil de 30 s par-dessus la connexion tunisienne.

**Le chargement des données.** Le catalogue une seule fois depuis le Shell
(`node mrp/import.js --ecrire`) ; la charte, les protocoles et les bris **se rechargent à chaque
démarrage** depuis les fichiers du dépôt, **après** que le service ait commencé à répondre (les
imports prennent 20 s, et Render coupe une instance qui ne répond pas à sa sonde). Ces imports
n'effacent que les lignes dont **ils** sont la source : un point écrit à la main dans l'app porte
le nom de son auteur et n'est jamais touché. Le catalogue, lui, ne se charge que sur une base vide.

**Le disque est toute la mémoire du système.** Supprimer le service supprime le disque. Copie :
`cat /var/data/mrp.db | base64` depuis le Shell.

## Sécurité

- Mots de passe : **scrypt**, sel aléatoire par utilisateur, comparaison à temps constant. Une
  tentative sur un compte inexistant hache quand même, pour ne pas révéler quels comptes existent.
- Sessions : jeton aléatoire de 32 octets en base, cookie `HttpOnly` + `SameSite=Lax`, expiration
  30 jours, purge au démarrage.
- Toutes les valeurs affichées sont échappées. En-têtes `X-Content-Type-Options` et
  `Referrer-Policy` sur chaque réponse.
- **Limite connue : pas de protection CSRF dédiée.** `SameSite=Lax` bloque les POST inter-sites, ce
  qui couvre le cas courant. À renforcer par un jeton par formulaire si l'app s'ouvre plus large.

## Tests — `sh tests/tout.sh`

Cinq suites, aucune n'a besoin du réseau ni de clé API.

| Suite | Ce qu'elle couvre |
| --- | --- |
| `outils.js` | les 34 outils sur une vraie base : refus de droits, références ambiguës, valeurs invalides, journal et annulation |
| `inventaire.js` | lecture du chiffrier (unités, rendements inversés, tolérance d'arrondi), stock = somme des mouvements, frontière « il en manque » / « on ne sait pas » |
| `calendrier.js` | les invariants de l'étalement : aucune journée en surcapacité, aucun travail un dimanche ou pendant une fermeture, aucune journée ouvrée laissée vide — et **le domino mesuré** : fermer 5 jours ouvrés recule la fin de 5 jours ouvrés, exactement |
| `boucle.js` | la boucle agentique contre une fausse API : enchaînement, retour des erreurs au modèle, reprise du fil, plafond de 12 étapes |
| `e2e.sh` | le serveur complet : authentification, permissions, avancement pondéré, redimension des images, **poids des pages sous 25 Ko** |

## Le poids des pages, mesuré

| | Sans redimension | Avec `width=320` |
| --- | ---: | ---: |
| Images (5 photos) | 2 005 Ko | 193 Ko |
| HTML | 2,7 Ko | 2,7 Ko |

L'ordre de production complet — 27 items, 297 boutons d'avancement, 139 lignes de répartition —
passe de **61 Ko à 5 Ko** compressé ; la liste de fabrication de 32 à 2 Ko. En dessous de 1 Ko on
envoie tel quel. Largeurs demandées : 160 px miniatures d'édition, 320 px vignettes de liste,
640 px galerie de fiche.

`format=webp` **n'est pas honoré** par le CDN Shopify — inutile de le demander. `?format=jpg` l'est,
et divise par cinq (un cache-cou en 320 px passe de 33 à 7 Ko) : **c'est le plus gros gain qui
reste**, mais la conversion aplatit la transparence, à vérifier avant de généraliser.
