# Lasclay MRP — ordres de production et fiches produits

Application web pour piloter la production entre Québec et la Tunisie.
Priorité 1 du projet : voir un ordre de production, suivre son avancement item
par item, et rattacher les dates clés.

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

**Fiches produits**
- Photos studio et photos en contexte d'utilisation
- « C'est quoi », « à quoi ça sert, comment ça s'utilise », notes techniques
- Matériaux et patrons, avec dimensions déclarées
- Liste des ordres de production où le produit apparaît

**Assistant — il exécute, il ne fait pas que répondre**
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

**Vingt outils** (`outils.js`) : lire les ordres, les fiches et la cédule ;
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
Tunisie. Chaque action est un formulaire qui poste et redirige. Les pages font
entre 1,5 et 13 Ko ; la feuille de style, 7 Ko, est mise en cache 24 h.

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

## Déploiement sur Render

Service web Node, comme les autres proxys du dépôt.

- Build : aucun. Start : `node server.js`
- **Ajouter un disque persistant** et pointer `MRP_DB` dessus, par exemple
  `/var/data/mrp.db`. Sans disque persistant, la base disparaît à chaque
  redéploiement.
- Mettre `MRP_SECURE=1`.
- Créer le premier utilisateur admin depuis le shell Render avec `mrp.js`.

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
| `tests/outils.js` | les 20 outils de l'assistant sur une vraie base : refus de droits, références ambiguës, valeurs invalides, journal et annulation |
| `tests/boucle.js` | la boucle agentique contre une fausse API : enchaînement des outils, retour des erreurs au modèle, reprise du fil, plafond de 12 étapes |
| `tests/e2e.sh` | le serveur complet : authentification, permissions, avancement pondéré, redimension des images, poids des pages sous 25 Ko |

Ce qui n'est **pas** couvert : le jugement du modèle. Après un changement de
modèle ou de consigne, essayer à la main quelques phrases réelles — dont une
référence ambiguë et une demande hors des droits de l'utilisateur.

## Modèle de données

```
utilisateurs ─┬─ sessions
              ├─ ordres ─┬─ ordre_items ── avancement_historique
              │          ├─ ordre_jalons          (cédule)
              │          └─ ordre_commentaires
              ├─ agent_tours ── agent_actions        (assistant + annulation)
              └─ produits ─┬─ produit_photos      (studio | contexte)
                           ├─ produit_materiaux
                           └─ produit_patrons
```

`ordre_items.produit_id` est la jointure entre les deux moitiés : c'est ce qui
rend chaque item cliquable vers sa fiche.

## Backlog

Volontairement hors de cette version : inventaire, traduction FR/EN, alertes,
convertisseur HPGL (voir `../patrons/`).

Pour l'assistant, ce qui reste à faire : lui donner accès aux stocks quand
l'inventaire existera, et le brancher sur le convertisseur de patrons pour
qu'« envoie-moi le patron du cache-cou en HPGL » devienne une seule phrase.
