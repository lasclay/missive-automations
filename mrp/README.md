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

## Deux rôles

| Rôle | Peut faire |
| --- | --- |
| `admin` | Tout : créer des ordres, ajouter des items et des jalons, gérer les fiches produits |
| `atelier` | Consulter, **mettre à jour l'avancement**, commenter. Rien d'autre. |

C'est volontaire : donner le pourcentage d'avancement est la responsabilité de
l'atelier, et c'est la seule écriture qui lui est ouverte.

## Contraintes techniques assumées

**Aucune dépendance.** Node 22 suffit : `node:http`, `node:sqlite`, `node:crypto`.
Même philosophie que le reste du dépôt. Rien à installer, rien à mettre à jour.

**Rendu côté serveur, zéro JavaScript client.** La connexion est lente en
Tunisie. Chaque action est un formulaire qui poste et redirige. Les pages font
entre 1,5 et 13 Ko ; la feuille de style, 7 Ko, est mise en cache 24 h.

**Utilisable au téléphone.** Sous 720 px, le tableau des items devient une pile
de blocs et le sélecteur d'avancement passe en grille de 6 colonnes — aucun
défilement latéral, boutons assez grands pour le pouce.

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
sh tests/e2e.sh
```

Démarre le serveur sur une base jetable et vérifie le parcours complet :
authentification, rejet des mauvais mots de passe, mise à jour d'avancement par
l'atelier, traçage dans l'historique, rejet des valeurs hors tranche de 10 %,
refus des actions d'administration à l'atelier, calcul pondéré de l'avancement
global, et poids des pages sous 25 Ko.

## Modèle de données

```
utilisateurs ─┬─ sessions
              ├─ ordres ─┬─ ordre_items ── avancement_historique
              │          ├─ ordre_jalons          (cédule)
              │          └─ ordre_commentaires
              └─ produits ─┬─ produit_photos      (studio | contexte)
                           ├─ produit_materiaux
                           └─ produit_patrons
```

`ordre_items.produit_id` est la jointure entre les deux moitiés : c'est ce qui
rend chaque item cliquable vers sa fiche.

## Backlog

Volontairement hors de cette version : inventaire, traduction FR/EN, alertes,
convertisseur HPGL (voir `../patrons/`), assistant conversationnel branché sur
la base et le code.
