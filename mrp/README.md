# Lasclay MRP — ordres de production et fiches produits

Application web pour piloter la production entre Québec et la Tunisie.
Priorité 1 du projet : voir un ordre de production, suivre son avancement item
par item, et rattacher les dates clés.

## Où est l'app

**Elle n'est pas encore déployée.** Le code vit sur la branche
`claude/dazzling-pasteur-6fw08h` ; aucun service ne l'héberge.

### La voir tout de suite, en local

```
git clone https://github.com/lasclay/missive-automations
cd missive-automations/mrp
node mrp.js demo                                   # jeu de données d'exemple
node mrp.js utilisateur:creer toi@lasclay.com motdepasse1 "Ton nom" admin
node server.js                                     # → http://localhost:3000
```

Node 22.5 ou plus, rien à installer.

### La mettre en ligne

La marche à suivre complète, dans l'ordre où on clique :
**[`DEPLOIEMENT.md`](DEPLOIEMENT.md)**. En résumé :

1. **Fusionner la branche dans `main`.** Render suit `main` ; sans ça, le
   service se construirait sur du code qui ne contient pas le MRP. À noter :
   les autres services du dépôt suivent aussi `main` et se redéploieront.
2. **Render → New → Blueprint**, pointer sur ce dépôt. Le disque persistant,
   le chemin de la base et `MRP_SECURE` sont déjà dans `render.yaml`.
3. **Saisir les trois secrets** dans le tableau de bord :
   `MRP_ADMIN_COURRIEL` et `MRP_ADMIN_MDP` — le premier compte, créé au
   démarrage si la base est vide — et `ANTHROPIC_API_KEY`.
4. **Charger les données** depuis le Shell Render : `node mrp/import.js --ecrire`.

L'offre `starter` est nécessaire : le plan gratuit n'a pas de disque
persistant, et la base disparaîtrait à chaque redéploiement.

## Charger les vraies données

```
node import.js            # aperçu : ce qui serait fait, rien n'est écrit
node import.js --ecrire   # applique
```

L'import lit `donnees/` et remplit la base : 34 produits avec leurs photos
Shopify, leurs matériaux, leurs coûts et les consignes d'atelier, plus l'ordre
de production de la saison tiré du plan 26-27 — **27 items, 24 333 unités**, et
139 répartitions par taille et coloris.

Il est **idempotent** : relancé, il met à jour les quantités et ne touche pas
aux avancements. C'est l'atelier qui les déclare ; un import n'a pas à écraser
ça. Le pivot est le code produit de `donnees/correspondances.tsv`, pas le nom.

`node mrp.js demo` reste disponible pour un jeu de données inventé.

## Ce qu'elle fait

**Ordres de production**
- Liste complète des items d'un ordre : produit, quantité, avancement, note
- Mise à jour de l'avancement **par tranches de 10 %** (0, 10, 20 … 100)
- Avancement global **pondéré par les quantités** : 2000 cache-cous à 50 % ne
  pèsent pas comme 10 tuques à 100 %
- Cédule rattachée à l'ordre : livraisons, deadlines, préventes, événements
- Commentaires horodatés et signés
- Chaque item est cliquable vers sa fiche produit
- Historique de chaque changement d'avancement : qui, quand, de combien à combien

**À fabriquer — la liste de travail**
- Tout ce qui reste à produire, tous ordres confondus, **déjà trié**
- Le rang est un calcul, pas un champ : priorité, puis retard, puis échéance,
  puis quantité restante — ajouter un ordre urgent réordonne la liste tout seul
- Priorité manuelle (haute / normale / basse), le seul moyen de contredire le
  calendrier
- Quantité restante estimée en pièces : 2 000 à 40 % = 1 200 restants

**À fabriquer — la répartition par taille et coloris**
- « 3 500 cache-cous » ne dit pas quoi couper. Chaque ligne porte sa
  répartition : une barre proportionnelle, puis le détail chiffré
- Un coloris reçoit sa pastille de couleur, une taille sa case ; les tailles
  sont dans l'ordre du corps (XS, S, M, L, XL), pas celui de l'alphabet
- Quand un produit croise deux axes (genre × taille, coloris × modèle), un
  groupe = une barre, dimensionnée à sa part du total de l'item
- Sur mobile, le détail est replié derrière la barre : la barre suffit à lire,
  le chiffre est à un doigt

**Cédule — la charge de l'atelier, en Gantt**

La question n'est pas « à quoi ressemble le calendrier », c'est **« est-ce que
ça rentre »**. La page y répond en trois nombres avant de dessiner quoi que ce
soit : heures de travail, heures disponibles d'ici la première échéance, postes.

- **Le temps unitaire vient de deux sources, dans cet ordre.** Le chronomètre
  (`donnees/temps-operations.tsv`) quand la mesure existe — huit familles. Sinon
  le **coût de confection** des fiches COGS divisé par **26 $/h**, la conversion
  que le suivi Tunisie applique aux mitaines polar (« 12,01 $ à 26 $/h » = 27 min
  42 s, soit exactement 12,01 / 26 heures). **Chaque ligne du diagramme dit
  laquelle des deux** — « chronométré » ou « déduit du coût ».
- **Une ligne « Total » l'emporte sur la somme des postes**, jamais les deux :
  additionner un total et ses composantes doublerait la durée.
- **Le volume fait le reste** : temps unitaire × quantité restante. L'ordre des
  barres est celui d'« À fabriquer », donc la priorité déplace vraiment les dates.
- **La capacité est un réglage, pas une donnée.** Aucune source ne dit combien
  de personnes travaillent ni combien d'heures. Québec le pose (postes ×
  heures/jour × jours/semaine) et l'app affiche « avec cette capacité-là ». Le
  défaut est de **20 postes**, l'équipe annoncée par Québec en août 2026 —
  déclarée, pas mesurée, et marquée « équipe annoncée · non confirmée ici »
  tant que personne n'a validé le réglage dans l'app. À noter : *20 personnes
  dans l'atelier* n'est pas *20 personnes qui cousent*.
- **Le verdict a trois états, et la couleur dit la même chose que la phrase.**
  Rouge « ça ne rentre pas » ; vert « ça rentre » ; **ambre « ça rentre sur le
  papier »** quand la marge est plus petite que ce que les items non chiffrés
  demanderaient. Une bordure verte au-dessus de « la marge ne tient pas » se
  lit plus vite que la phrase, et dit le contraire.
- **L'atelier est modélisé comme une file unique** : un item à la fois, tous les
  postes dessus. C'est une simplification, et elle est du bon côté — supposer
  quatre produits en parallèle donnerait des dates plus optimistes sans rien
  pour le justifier.
- **Plus aucun item du plan ne compte pour zéro heure.** C'était le cas de six
  d'entre eux, et zéro est le seul chiffre dont on soit sûr qu'il est faux.
  Cinq sont couverts par les prix BMB ; le dernier — l'oreiller — par une
  estimation à la main dans `donnees/assemblage-estime.tsv`, ancrée sur un
  produit réel et affichée « estimé », jamais confondue avec un prix facturé.
- **S'il en restait, l'app chiffrerait ce qu'ils manquent.** `chargeInconnue()`
  leur prête les temps unitaires des items **du même plan** — le plus court, la
  médiane, le plus long — et affiche la fourchette, parce que « la charge réelle
  est plus élevée » est vrai et inutilisable : dix heures ou mille ?
- Le trait rouge est l'expédition ; les barres qui la dépassent sont grisées.

Au plan 26-27, avec 20 couturières et **4 320 heures disponibles** avant le
1er octobre, le total dépend entièrement du périmètre :

| Ce que l'atelier fait | Charge | Verdict |
| --- | ---: | --- |
| Préparation seulement | 2 417 h | rentre, +1 903 h |
| Assemblage seulement | 3 829 h | rentre, +491 h |
| **Préparation + assemblage** (défaut) | **5 311 h** | **manque 991 h** |

C'est le seul réglage qui décide si le plan tient, et aucune source ne le dit.
Tant qu'il n'est pas tranché, l'app affiche la lecture prudente : il faudrait
**25 postes au lieu de 20**, ou 9 h × 6 jours.

### Sortir le Gantt

L'app est faite pour la connexion tunisienne : pas de JS, quelques kilo-octets.
Un Gantt qu'on envoie ou qu'on projette a un autre métier — il peut se permettre
de vraies polices, un axe de temps dessiné, et le basculement entre les trois
périmètres.

```sh
node mrp/tools/gantt_export.js > gantt.html
```

Page autonome, les deux thèmes, rien à installer. Les chiffres viennent de la
même base que `/cedule` : **régénérer après chaque révision du plan**, jamais
recopier à la main.

**Suivi — est-ce que ça avance**
- Ce qui ne bouge plus depuis 7 jours : le seul bloc qui demande une action
- Progression convertie en pièces (2 000 cache-cous de 40 à 70 % = 600 unités)
- Journal de qui a changé quoi, quand

La méthode qui va avec — qui met à jour, quand, et ce que le pourcentage veut
dire — est dans [`METHODE-SUIVI.md`](METHODE-SUIVI.md).

**Fiches produits**
- Photos studio et photos en contexte d'utilisation
- « C'est quoi », « à quoi ça sert, comment ça s'utilise », notes techniques
- Matériaux et patrons, avec dimensions déclarées
- Liste des ordres de production où le produit apparaît

**Contrôle qualité — le protocole de chaque produit**

Quatre volets par produit, dans l'ordre où on les lit à l'atelier :

| Volet | Ce que c'est |
| --- | --- |
| **Points critiques** | ce qu'on ne peut pas rattraper après coup |
| **Problèmes fréquents** | ce qui revient d'un lot à l'autre, et comment l'éviter |
| **Mesures et dimensions** | une cote, sa tolérance, son unité — et la taille concernée quand la cote en dépend |
| **Cyclage et tests** | lavages, compressions, tenue de l'isolant |
| **Emballage et finition** | pliage, sachet, étiquette, mise en carton |

**Le protocole général.** Un point sans produit s'applique à **tous** les
produits — c'est là que vit la méthode d'emballage, l'étiquetage, la finition.
Il apparaît sur la checklist de chaque lot, marqué « général », sans avoir à
être réécrit trente fois.

**L'échantillonnage suit le volume.** « 1 pièce sur 20 » ne veut pas dire la
même chose sur un lot de 100 et sur un lot de 3 500. La règle est stockée
structurée (`ech_type` + `ech_valeur`), et la checklist écrit **le nombre**, pas
la règle :

| Règle | Lot de 100 | Lot de 3 500 |
| --- | ---: | ---: |
| 1 sur 20 | 5 pièces | 175 pièces |
| 1 sur 50 | 2 pièces | 70 pièces |
| 5 pièces fixes | 5 | 5 |
| toutes | 100 | 3 500 |
| une fois par lot | 1 | 1 |

Personne ne devrait faire la division en ayant les pièces dans les mains. Le
contrôle enregistre aussi **combien de pièces ont réellement été vues**, ce qui
n'est pas toujours le nombre demandé.

**Conformité dimensionnelle : une mesure par taille, échantillonnée par
taille.** Un tableau de mensurations se saisit d'un coup — une ligne par
taille, `Homme / L = 120 ± 1,5`, recopiable d'un chiffrier. Sur la checklist
d'un lot, la connexion se fait avec la répartition réelle du lot :

- une taille **absente du lot n'est pas exigée** — un lot sans 4XL n'a pas de
  mesure 4XL à vérifier ;
- l'échantillon se calcule sur les pièces de **cette taille**, pas sur le lot :
  4 manteaux sur les 34 en L, pas 15 sur les 150 du lot ;
- `L` reconnaît `Homme / L`, parce que le chiffrier et le plan ne les écrivent
  pas pareil ;
- sans répartition déclarée, **aucune taille n'est écartée** — on ne sait pas,
  donc on n'enlève rien.

**Ce qui casse — la preuve qui fait écrire une consigne.** Un commentaire
client, une photo de couture ouverte, un retour d'atelier : `qc_bris` garde la
phrase **mot pour mot** (reformuler un client, c'est perdre ce qui rendait la
phrase utile) avec sa zone, sa date et son origine. Aucune photo n'est
hébergée : une URL, comme partout dans l'app.

La boucle se ferme en trois temps :

1. **Un bris est signalé** — par Québec depuis Missive, par l'atelier qui voit
   le défaut au montage, ou par l'assistant (`signaler_bris`).
2. **On en tire une consigne**, d'un bouton sur le signalement. Le point naît
   avec sa preuve, et **tous les bris de la même zone encore orphelins s'y
   rattachent** — ils disent la même chose, et les laisser séparés ferait
   réécrire trois fois la même consigne.
3. **La consigne devient une case à cocher** sur chaque lot, avec son
   échantillon calculé sur le volume.

Un signalement dont personne n'a tiré de consigne est marqué comme tel : c'est
la file de travail du contrôle qualité.

**Les zones qui cassent, tous produits confondus.** La page Qualité ouvre sur
« Ce qui casse » : combien de signalements par zone, **sur combien de produits
différents**, et combien sans consigne. Une zone qui revient sur cinq produits
n'est pas un défaut de produit, c'est un défaut de méthode — et c'est la
question que les commentaires clients permettent enfin de poser.

**Une non-conformité d'atelier est une observation de terrain, en plus tôt.**
Une case « non conforme » cochée par Montassar remonte au même endroit que les
commentaires clients, et disparaît de la liste dès qu'elle est corrigée.

**Squelettes de cyclage et d'essai porté.** `donnees/qualite-squelettes.tsv`
porte la structure des tests de durabilité de couture (assemblage principal,
points de contrainte, tenue après cyclage, migration de l'isolant) et des
essais portés (aisance, points de frottement, symétrie, fermeture éclair). Ce
sont des points du **protocole général**, puisque ce sont les mêmes gestes
quelle que soit la pièce.

**Aucun chiffre de Lasclay n'y figure.** Combien de cycles, quelle charge,
quelle tolérance — rien de tout ça n'existe dans les sources du dépôt, et
l'inventer le ferait passer pour une norme maison. Les valeurs sont écrites
`À FIXER`, en majuscules, pour qu'on ne puisse pas les confondre avec une
mesure. `node mrp/import_qualite.js --squelettes --ecrire` les charge.

- **La colonne qui fait la différence, c'est « Sinon… ».** « Presser le col
  avant l'isolant » se discute ; « sinon il fond et devient rigide » ne se
  discute pas. Chaque point peut porter sa conséquence, et elle s'affiche en
  rouge sous la consigne.
- **La page d'accueil du volet montre d'abord ce qui n'a AUCUN protocole**, le
  plus gros volume en tête : c'est là que l'absence coûte le plus cher. Un
  protocole vide sur un produit fabriqué à 4 665 unités est l'information la
  plus utile de la page.
- **L'atelier écrit autant que Québec.** C'est Montassar qui voit les défauts ;
  lui interdire d'écrire garderait l'information là où elle ne sert à personne.
  Chaque point porte le nom de qui l'a ajouté.
- **La fiche produit rappelle les points critiques**, avec un lien vers le
  protocole complet.
- L'assistant sait lire et écrire : « quelle est la tolérance sur les gants »,
  « note que le col doit être pressé avant l'isolant, sinon il fond ».

**La checklist obligatoire sur chaque ordre.** Le protocole ne sert à rien s'il
reste une page qu'on peut ne pas lire. Chaque item d'un ordre de production
porte donc sa checklist, dérivée du protocole de son produit :

- **Un lot ne peut pas être déclaré à 100 % tant que tous ses points n'ont pas
  de verdict.** Le refus nomme les points qui manquent et mène droit à la
  checklist.
- **Une non-conformité bloque aussi**, et se distingue d'un oubli : il faut
  corriger puis revérifier.
- **Le verrou vit dans `db.js` (`blocageQC`), et les deux chemins d'écriture y
  passent** — le formulaire et l'assistant. Aucun des deux ne contourne l'autre.
- **Sans protocole, rien n'est exigé.** C'est un trou, pas une permission, et la
  page le dit dans ces mots.
- **Dynamique par construction** : le protocole n'est jamais recopié dans le
  lot. Ajouter un point critique le fait apparaître non vérifié sur tous les
  lots en cours, y compris ceux déjà à 90 % — ce sont précisément ceux à qui ça
  sert.
- **Journal, pas état** : chaque vérification s'ajoute, aucune n'écrase la
  précédente. Une non-conformité corrigée reste visible, et c'est exactement ce
  qui nourrit la colonne « problèmes fréquents » du protocole.
- Sur la page de l'ordre, l'état qualité de chaque lot s'affiche **à côté du
  sélecteur d'avancement** — là où on s'apprête à déclarer 100 % et où on va se
  faire refuser.

**Amorce.** 25 points sur 15 produits viennent de
`donnees/qualite-amorce.tsv` — une relecture à la main des notes techniques,
où ces consignes dormaient mêlées aux coûts et aux questions Shopify. Le
fichier **n'est pas une source** : le classement en volet est un jugement, à
corriger sans hésiter. `node mrp/import_qualite.js` montre ce qui serait fait ;
l'import remplace les points marqués « notes techniques » et ne touche jamais à
ce qui a été écrit dans l'app.

**Tâches — ce qu'on se demande d'un bord à l'autre**

Ces demandes-là vivaient dans Missive, dans WhatsApp, ou dans la tête de
quelqu'un. Ici elles ont un porteur, un état, et une date.

- **Aucune hiérarchie** : Montassar assigne à Québec exactement comme Québec
  assigne à Montassar. C'est le seul module où les deux rôles ont les mêmes
  droits.
- Trois listes, dans l'ordre où on les regarde : **pour moi**, **ce que j'ai
  demandé**, **sans porteur**. Les faites sont repliées — elles servent à
  vérifier, pas à travailler.
- Une échéance dépassée porte un filet rouge et remonte en tête.
- **Une pastille dans le menu**, sur toutes les pages : rouge s'il y a du
  retard. Un compteur qu'on ne voit que sur sa propre page ne sert à rien.
- Qui peut quoi : le **porteur** termine ou rouvre ; seul le **demandeur**
  supprime. On ne fait pas disparaître ce qu'on vous a demandé.
- L'assistant sait s'en servir : « demande à Montassar de vérifier le stock de
  molleton », « qu'est-ce que j'ai à faire », « c'est fait pour les semelles ».

**Assistant — il exécute, il ne fait pas que répondre**

Il est **sur l'accueil**, en haut, avant tout le reste : il salue, puis une
phrase à écrire et le dernier échange, avec le bouton pour annuler ce qu'il a
écrit.

**La salutation connaît deux fuseaux.** Souhaiter « bonsoir » à quelqu'un qui
déjeune est la façon la plus rapide de faire sentir qu'une app ne sait pas à
qui elle parle : Québec et Tunis sont à cinq ou six heures d'écart. Le fuseau
se déduit du rôle, parce que les rôles de cette app **sont** des lieux. Et la
deuxième phrase dit ce qui attend vraiment — « Une tâche a dépassé son
échéance. » — plutôt que « Des questions ? », qui ne sert que quand il n'y a
rien à signaler. Aucun appel au modèle : c'est du texte, calculé en une
milliseconde. Le fil complet
reste sur sa page. L'accueil **reprend la conversation en cours** plutôt que
d'en ouvrir une neuve à chaque affichage — sans ça, « et les mitaines ? » perd
son antécédent dès qu'on recharge.

C'est un formulaire ordinaire : il part, la page revient. Rien à charger, rien
qui casse si le JS ne s'exécute pas. Le tableau de bord complet, assistant
compris, pèse **1,6 Ko compressé**.

- « Mets les cache-cous adultes à 70 % » met vraiment l'item à 70 %
- « Crée un ordre pour 500 tuques livrables le 15 novembre » crée l'ordre,
  y ajoute l'item et pose le jalon — en une phrase, sans repasser par les
  formulaires
- Dictée vocale dans le navigateur (français, arabe, anglais)
- Chaque tour affiche la liste de ce qui a été écrit, avec un bouton pour
  tout défaire

## Deux rôles

| Rôle | Peut faire |
| --- | --- |
| `admin` | Tout : créer des ordres, ajouter des items et des jalons, gérer les fiches produits |
| `atelier` | Consulter, **mettre à jour l'avancement**, commenter. Rien d'autre. |

C'est volontaire : donner le pourcentage d'avancement est la responsabilité de
l'atelier, et c'est la seule écriture qui lui est ouverte.

## L'assistant

C'est un agent, pas un chatbot. Il ne décrit pas la marche à suivre : il
appelle les mêmes écritures que les formulaires, dans la même base, avec les
mêmes contraintes.

```
« Mets les cache-cous adultes à 70 % et ajoute
  la deadline du départ conteneur le 2 octobre »

  → maj_avancement  CC-ADULTE dans OP-2026-0001 : 40 % → 70 %
  → ajouter_jalon   « Départ conteneur » le 2026-10-02 sur OP-2026-0001
  → « Cache-cous à 70 % et deadline ajoutée au 2 octobre. »        [Annuler]
```

**Trente outils** (`outils.js`) : lire les ordres, les fiches et la cédule ;
mettre à jour un avancement ; créer un ordre, y ajouter ou en retirer des
items ; poser des jalons ; créer et enrichir une fiche produit ; commenter.
L'assistant les enchaîne seul — créer un ordre puis le remplir de quatre items
est une seule demande.

### Trois garde-fous

**Les droits sont vérifiés dans les outils, pas seulement dans les routes.**
L'atelier peut mettre à jour un avancement et commenter ; il ne peut pas créer
d'ordre, et l'assistant ne lui sert pas d'échelle pour passer par-dessus le mur
— il ne reçoit même pas les schémas des outils d'administration.

**Toute écriture est journalisée avec de quoi la défaire.** L'assistant agit
sans demander la permission, parce que c'est ce qu'on attend de lui ; le filet,
c'est que rien n'est irréversible. On ne défait que le dernier tour encore en
place : annuler un tour ancien qui avait créé un ordre le supprimerait en
cascade, emportant silencieusement le travail des tours suivants.

**Aucune suppression d'ordre ni de produit.** Retirer un item ou un jalon, oui,
c'est du travail courant et ça se rétablit. Effacer un ordre complet sur une
phrase mal entendue, non — ça se fait à la main, à l'écran, en voyant ce qu'on
supprime.

Deux refus valent d'être connus : une référence ambiguë (« les cache-cous »
quand il en existe deux) fait poser une question au lieu d'un choix au hasard,
et un avancement doit être un multiple de 10 donné par Montassar — « presque
fini » ne devient pas 90 % tout seul.

### La dictée

Le bouton **Dicter** utilise la reconnaissance vocale du navigateur
(`SpeechRecognition`). Sans elle — Firefox, Safari ancien, micro refusé — le
bouton ne s'affiche pas et le clavier fait le travail.

Deux choses à savoir : dans Chrome, l'audio transite par les serveurs de
Google, ce n'est donc pas le canal pour une information confidentielle ; et
seul du texte remonte à notre serveur, ce qui en fait aussi l'option la plus
légère pour la Tunisie — pas de fichier audio à téléverser.

### Ce qu'il faut pour qu'il fonctionne

`ANTHROPIC_API_KEY` côté serveur. Sans elle, la page reste consultable et le
dit franchement au lieu d'échouer en silence. La boucle s'arrête d'elle-même
après 12 étapes et l'explique.

Les tests couvrent la mécanique — enchaînement des outils, retour des erreurs
au modèle, droits, journal, annulation — contre une fausse API. **Le jugement
du modèle, lui, ne se teste pas automatiquement** : après un changement de
modèle ou de consigne, il faut essayer à la main quelques phrases réelles,
dont une ambiguë et une hors de ses droits.

## Contraintes techniques assumées

**Aucune dépendance.** Node 22 suffit : `node:http`, `node:sqlite`, `node:crypto`.
Même philosophie que le reste du dépôt. Rien à installer, rien à mettre à jour.

**Rendu côté serveur, zéro JavaScript client.** La connexion est lente en
Tunisie. Chaque action est un formulaire qui poste et redirige.

**Tout est compressé.** C'est le seul levier qui agit sur toutes les pages d'un
coup, et il compte : l'ordre de production complet — 27 items, 297 boutons
d'avancement et 139 lignes de répartition — passe de **61 Ko à 5 Ko**, la liste
de fabrication de 32 à 2 Ko. En dessous de 1 Ko on envoie tel quel, le gain ne
paierait pas la compression. Aucune page ne dépasse 12 Ko sur le réseau.

**Utilisable au téléphone.** Sous 720 px, le tableau des items devient une pile
de blocs et le sélecteur d'avancement passe en grille de 6 colonnes — aucun
défilement latéral, boutons assez grands pour le pouce.

**Aucun fichier lourd hébergé.** L'app ne stocke que des URL, jamais d'images.
Les photos restent chez Shopify ou Google Drive et sont servies par leur CDN,
déjà redimensionnées à la largeur d'affichage — `urlImage()` (`vues.js`) ajoute
`?width=N` aux URL `cdn.shopify.com` et convertit toute forme de partage Drive
en `lh3.googleusercontent.com/d/ID=wN`. Les largeurs demandées : 160 px pour les
miniatures d'édition, 320 px pour les vignettes de liste, 640 px pour la
galerie d'une fiche (l'image pleine taille reste accessible d'un clic).

Mesuré sur la liste des produits du jeu de démonstration, cinq photos :

| | Sans redimension | Avec `width=320` |
| --- | ---: | ---: |
| Images | 2 005 Ko | 193 Ko |
| HTML | 2,7 Ko | 2,7 Ko |

Soit **dix fois moins de données** pour un affichage identique — décisif sur la
connexion tunisienne. Les balises portent `loading="lazy"`, `decoding="async"`
et `referrerpolicy="no-referrer"`, plus une largeur explicite pour éviter que la
page saute pendant le chargement. Conséquences assumées : si une image est
retirée de Shopify, la fiche affiche un cadre vide — c'est le prix à payer pour
ne rien héberger, et la source reste la seule vérité. `format=webp` n'est pas
honoré par le CDN Shopify : inutile de le demander.

## Démarrer

```
node mrp.js utilisateur:creer gabriel@lasclay.com <mot-de-passe> "Gabriel" admin
node mrp.js utilisateur:creer montassar@lasclay.com <mot-de-passe> "Montassar" atelier
node server.js                       # http://localhost:3000
```

Les deux rôles s'écrivent `admin` et `atelier` en ligne de commande, et
s'affichent **Admin QC** et **Atelier Tunisie**. Le libellé dit qui est où :
dans une entreprise dont la production est à six mille kilomètres du bureau, le
rôle dit ce que la personne peut savoir, pas son rang. Admin QC pose les
priorités et crée les ordres ; Atelier Tunisie déclare l'avancement et
commente.

Pour explorer avec des données d'exemple : `node mrp.js demo`

## Administration

```
node mrp.js utilisateur:creer <courriel> <mdp> "<nom>" [admin|atelier]
node mrp.js utilisateur:liste
node mrp.js utilisateur:mdp <courriel> <nouveau-mdp>
node mrp.js utilisateur:role <courriel> <admin|atelier>
node mrp.js utilisateur:desactiver <courriel>
node mrp.js etat
node mrp.js demo
```

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `PORT` | port d'écoute (défaut 3000) |
| `MRP_DB` | chemin du fichier SQLite (défaut `./data/mrp.db`) |
| `MRP_SECURE` | `1` en production : exige HTTPS sur le cookie de session |
| `ANTHROPIC_API_KEY` | clé de l'assistant ; sans elle la page le signale |
| `MRP_MODELE` | modèle utilisé (défaut `claude-sonnet-5`) |
| `MRP_ADMIN_COURRIEL` / `MRP_ADMIN_MDP` | premier compte, créé au démarrage si la base n'a aucun utilisateur ; sans effet ensuite |

## Déploiement sur Render

Voir **[`DEPLOIEMENT.md`](DEPLOIEMENT.md)** : la marche à suivre complète, les
réglages à la main si le blueprint ne passe pas, et ce qui casse quand ça
casse. L'essentiel :

- Build : aucun. Start : `node --no-warnings mrp/server.js`
- **Disque persistant obligatoire**, `MRP_DB` pointé dessus
  (`/var/data/mrp.db`). Sans lui, la base disparaît à chaque redéploiement.
- `MRP_SECURE=1`, et `NODE_VERSION` au moins 22.5 pour `node:sqlite`.
- `MRP_ADMIN_COURRIEL` + `MRP_ADMIN_MDP` créent le premier compte au démarrage
  **si et seulement si** la base n'a aucun utilisateur. Sans ça, un service
  neuf n'est ouvrable par personne : la page de connexion n'offre pas de
  s'inscrire.

## Comptes

Le premier se crée au démarrage (`MRP_ADMIN_COURRIEL` / `MRP_ADMIN_MDP`), les
autres en ligne de commande :

```
node mrp.js utilisateur:creer <courriel> <mdp> "<nom>" [admin|atelier]
node mrp.js utilisateur:liste
```

**Chacun gère son compte lui-même**, dans l'app : son nom en haut à droite →
*Mon compte*. Il y change son **nom affiché** — c'est lui qui signe les mises à
jour dans le suivi, et l'amorce crée le premier compte au nom d'« Administration »,
qui n'apprend rien — et son **mot de passe**. Ça paraît accessoire ; ça ne l'est pas. Un mot de passe
transmis par message doit pouvoir être changé par celui qui le reçoit, et
l'atelier n'a pas de shell. Le changement ferme les sessions ouvertes ailleurs
— sinon celle ouverte avec le mot de passe qui a fuité continuerait de
fonctionner — mais épargne la session courante.

## Sécurité

- Mots de passe : scrypt, sel aléatoire par utilisateur, comparaison à temps
  constant. Une tentative sur un compte inexistant hache quand même, pour ne pas
  révéler quels comptes existent.
- Sessions : jeton aléatoire de 32 octets en base, cookie `HttpOnly` +
  `SameSite=Lax`, expiration 30 jours, purge au démarrage.
- Toutes les valeurs affichées sont échappées.
- En-têtes `X-Content-Type-Options` et `Referrer-Policy` sur chaque réponse.

**Limite connue :** pas de protection CSRF dédiée. `SameSite=Lax` bloque les
POST inter-sites, ce qui couvre le cas courant. À renforcer par un jeton par
formulaire si l'application devient accessible à un public plus large.

## Tests

```
sh tests/tout.sh
```

Trois suites, aucune n'a besoin du réseau ni de clé API.

| Suite | Ce qu'elle couvre |
| --- | --- |
| `tests/outils.js` | les 30 outils de l'assistant sur une vraie base : refus de droits, références ambiguës, valeurs invalides, journal et annulation |
| `tests/boucle.js` | la boucle agentique contre une fausse API : enchaînement des outils, retour des erreurs au modèle, reprise du fil, plafond de 12 étapes |
| `tests/e2e.sh` | le serveur complet : authentification, permissions, avancement pondéré, redimension des images, poids des pages sous 25 Ko |

Ce qui n'est **pas** couvert : le jugement du modèle. Après un changement de
modèle ou de consigne, essayer à la main quelques phrases réelles — dont une
référence ambiguë et une demande hors des droits de l'utilisateur.

## Modèle de données

```
utilisateurs ─┬─ sessions
              ├─ ordres ─┬─ ordre_items ─┬─ avancement_historique
              │          │               └─ item_variantes  (taille × coloris)
              │          ├─ ordre_jalons          (cédule)
              │          └─ ordre_commentaires
              ├─ agent_tours ── agent_actions        (assistant + annulation)
              ├─ taches                              (cree_par ↔ assigne_a)
              └─ produits ─┬─ produit_photos      (studio | contexte)
                           ├─ produit_materiaux
                           ├─ produit_patrons
                           └─ qc_points           (protocole qualité)
                                  ├─ qc_controles  (le protocole appliqué à un lot)
                                  └─ qc_bris       (ce qui casse : la preuve)

reglages                                  (capacité de l'atelier — hors graphe :
                                           un seul jeu, pas une préférence)
```

`ordre_items.produit_id` est la jointure entre les deux moitiés : c'est ce qui
rend chaque item cliquable vers sa fiche.

## Données collectées

`donnees/` porte un instantané des trois sources qui alimenteront le MRP :
catalogue Shopify, fiches COGS Tunisie, suivi de production. Voir
`donnees/SOURCES.md` pour la carte complète — ce qui existe, ce qui cloche,
et ce qui n'existe nulle part encore.

| Fichier | Lignes |
| --- | ---: |
| `shopify-produits.tsv` · `shopify-variantes.tsv` · `shopify-images.tsv` | 121 · 906 · 678 |
| `cogs-tunisie.tsv` — 10 postes de coût par produit | 17 |
| `nomenclatures.tsv` — produit → matière, consommation, coût | 65 |
| `temps-operations.tsv` — temps chronométrés par poste | 35 |
| `assemblage-bmb.tsv` — prix d'assemblage BMB par unité, extrait des notes | 23 |
| `assemblage-estime.tsv` — estimations à la main, à supprimer dès qu'un prix existe | 1 |
| `qualite-amorce.tsv` — protocoles relus depuis les notes techniques | 25 |
| `fournisseurs.tsv` · `emballage-expedition.tsv` · `tarifs-postes-canada.tsv` | 15 · 4 · 3 |
| `production-tunisie.md` — consignes et état des patrons par produit | — |

Les 678 URL d'images sont toutes sur le CDN Shopify et passent `urlImage()`
sans exception. Rien n'est hébergé ici : ce sont des adresses, pas des
fichiers, et l'ensemble pèse 412 Ko.

## Backlog

**Fiches produits poussées — à préparer.** Des fiches plus détaillées s'en
viennent ; le tableau Miro qui sert de référence n'est pas encore accessible.
Ce qui manque au schéma, ce qu'il faut décider avant de construire, et le
blocage d'accès : [`FICHES-PRODUITS.md`](FICHES-PRODUITS.md).


**Le bandeau de la tuque beanie manque au plan.** Le plan prévoit 1 500 tuques
de ville — tricotées en Chine — mais aucune quantité pour leur bandeau amovible,
qui lui est fait à l'atelier. S'il en faut un par tuque, il manque 1 500 bandeaux
au plan de Tunisie. À confirmer avec Gabriel ou Catherine.

**Cinq répartitions par variante s'écartent vraiment du plan** — et ce ne sont
pas celles annoncées d'abord. Les « trois doublements exacts » du manteau
hivernal, du manteau 3 saisons et de la veste venaient d'une extraction fautive,
pas du chiffrier : celui-ci croise deux axes (genre × taille, coloris × taille)
et porte des lignes de sous-total, que la première lecture additionnait avec
leurs enfants. Corrigé, ces trois-là bouclent.

Restent : le **bandeau** (2 100 pour 1 800 — le modèle « Sport, noir seulement »
s'ajoute aux cinq coloris torsadés, à confirmer), les **semelles** (4 813 pour
4 665), l'**étui** (298 pour 500), le **foulard** et l'**oreiller** (−15 chacun).
Sept autres écarts tiennent à l'arrondi des pourcentages ; l'import les nomme à
part plutôt que de les mélanger aux vrais.

`donnees/extrait-variantes.py` refait l'extraction depuis le chiffrier et
vérifie chaque produit par la somme de ses feuilles.

**L'avancement par variante n'existe pas.** La répartition dit quoi couper —
elle s'affiche dans *À fabriquer* et sur l'ordre, en barre proportionnelle et
en pastilles de la vraie couleur. Mais l'avancement reste par item. Si l'atelier
a besoin de déclarer « les noirs sont faits, pas les rouges », c'est la première
chose à ajouter.

**Le CDN sert du JPEG cinq fois plus léger que le PNG.** `?format=jpg` est
honoré par Shopify (contrairement à `format=webp`) : un cache-cou en 320 px
passe de 33 à 7 Ko. L'app ne le demande pas encore, parce que la conversion
aplatit la transparence — sans danger sur une photo produit, à vérifier avant
de généraliser. Sur la connexion tunisienne, c'est le plus gros gain qui reste.

**Le rattachement Shopify sert parfois juste de photothèque.** Les deux tailles
enfant du cache-cou empruntent le handle de l'adulte faute de fiche à elles ;
l'import prend alors le nom de production plutôt que le titre Shopify, sans
quoi trois produits portent le même nom dans la liste. La règle tient au
`confiance = non vendu` de `correspondances.tsv` — à revoir le jour où les
fiches enfant existeront.

Volontairement hors de cette version : inventaire, traduction FR/EN, alertes,
convertisseur HPGL (voir `../patrons/`).

Pour l'assistant, ce qui reste à faire : lui donner accès aux stocks quand
l'inventaire existera, et le brancher sur le convertisseur de patrons pour
qu'« envoie-moi le patron du cache-cou en HPGL » devienne une seule phrase.
