# Mettre le MRP en ligne sur Render

Dans l'ordre. Compter vingt minutes, dont dix d'attente pendant le premier
déploiement.

---

## Avant de commencer : trois choses à savoir

**L'offre payante est obligatoire.** Le MRP garde ses données dans un fichier
SQLite, et un fichier a besoin d'un **disque persistant**. Le plan gratuit de
Render n'en a pas : le disque d'une instance gratuite est effacé à chaque
redéploiement, donc les ordres, les avancements et l'historique
disparaîtraient. `starter` = 7 USD/mois pour le service, plus environ
0,25 USD/mois pour 1 Go de disque.

**Render suit `main`.** Le code du MRP est sur la branche
`claude/dazzling-pasteur-6fw08h`. Tant qu'elle n'est pas fusionnée, le service
se construirait sur du code qui ne contient pas le MRP.

**Les autres services du dépôt suivent aussi `main`.** Fusionner redéploiera
aussi le General Proxy, le Finance Proxy et le Missive Proxy. Leur code ne
change pas — mais ils redémarreront, donc éviter de faire ça pendant qu'une
expédition est en cours.

---

## 1. Fusionner la branche dans `main`

Sur GitHub, ouvrir une pull request de `claude/dazzling-pasteur-6fw08h` vers
`main`, puis la fusionner. Ou en ligne de commande :

```sh
git checkout main
git pull origin main
git merge claude/dazzling-pasteur-6fw08h
git push origin main
```

---

## 2. Créer le service

**Render → New → Blueprint**, choisir le dépôt `lasclay/missive-automations`.

Render lit `mrp/render.yaml` et propose de créer un service **lasclay-mrp**.
Tout ce qui est technique y est déjà : le disque persistant de 1 Go monté sur
`/var/data`, le chemin de la base, la version de Node, l'obligation d'HTTPS sur
le cookie de session, la sonde de santé.

> Si Render ne trouve pas le blueprint, c'est qu'il cherche `render.yaml` à la
> racine. Dans ce cas, indiquer le chemin `mrp/render.yaml` dans le champ
> prévu, ou créer le service à la main (voir « À la main » plus bas).

---

## 3. Saisir les trois secrets

Render demande les variables marquées `sync: false` — c'est-à-dire celles qui
ne doivent jamais être écrites dans le dépôt.

| Variable | Valeur | À quoi ça sert |
| --- | --- | --- |
| `MRP_ADMIN_COURRIEL` | ton courriel | **Le premier compte.** Sans lui, personne ne peut ouvrir l'app. |
| `MRP_ADMIN_MDP` | un mot de passe, **8 caractères minimum** | Idem. À changer après la première connexion. |
| `ANTHROPIC_API_KEY` | la clé Anthropic | L'assistant. Sans elle, l'app fonctionne, l'assistant dit simplement qu'il lui manque sa clé. |

**Pourquoi un premier compte par variable d'environnement ?** La page de
connexion n'offre pas de s'inscrire — c'est voulu, l'app n'est pas publique. Un
service fraîchement déployé n'a donc aucun utilisateur, et n'est ouvrable par
personne. L'amorce résout ça au démarrage.

Elle **n'agit que si la base n'a aucun utilisateur**. Elle ne peut pas écraser
un compte, ni changer un mot de passe, ni réactiver un compte désactivé. Une
fois la première connexion faite, ces deux variables ne servent plus à rien :
retirer `MRP_ADMIN_MDP` du tableau de bord.

Puis **Apply**. Le premier déploiement prend cinq à dix minutes.

---

## 4. Vérifier que ça répond

L'adresse est du genre `https://lasclay-mrp.onrender.com`.

```sh
curl https://lasclay-mrp.onrender.com/sante
# {"ok":true,"service":"lasclay-mrp"}
```

Puis ouvrir l'adresse dans un navigateur et se connecter avec le courriel et le
mot de passe de l'étape 3. **Changer le mot de passe tout de suite** : le nom
en haut à droite → *Mon compte*.

Si la connexion échoue, regarder les logs du service (onglet **Logs**) : la
ligne `[mrp] Premier compte créé : …` dit que l'amorce a fonctionné. Si elle
dit `Aucun utilisateur, et pas d'amorce`, les deux variables n'ont pas été
saisies.

---

## 5. Charger les données

La base est vide au premier démarrage : ni produits, ni ordre de production.

Onglet **Shell** du service (disponible sur les offres payantes) :

```sh
node mrp/import.js            # aperçu : ce qui serait fait, rien n'est écrit
node mrp/import.js --ecrire   # applique
```

L'import est **idempotent** : le relancer met les quantités à jour sans jamais
toucher aux avancements saisis. C'est comme ça qu'on répercutera une révision
du plan.

Résultat attendu : 34 produits, 164 photos, 50 matériaux, l'ordre
`OP-2026-0001` avec 27 items, **24 333 unités**, le jalon d'expédition au
1er octobre et 139 répartitions par taille et coloris.

Puis les deux imports du contrôle qualité, dans cet ordre — les protocoles
d'abord, les bris ensuite, parce qu'un bris peut se rattacher à un point :

```sh
node mrp/import_qualite.js --ecrire   # protocoles : points critiques, mesures
node mrp/import_bris.js --ecrire      # ce que les clients ont signalé, photos comprises
```

Attendu pour le second : **26 signalements, 24 avec photo** — 16 sur le sac à
dos glacière, dont dix fois la même couture de bretelle. Les photos ne sont pas
hébergées ici : ce sont des adresses, et l'onglet **Ce qui casse** les demande
redimensionnées au CDN. Si elles n'apparaissent pas, ce n'est pas l'app — c'est
que le dossier de l'hébergeur n'est pas partagé par lien.

---

## 6. Créer les comptes de l'équipe

Toujours dans le Shell :

```sh
node mrp/mrp.js utilisateur:creer montassar@… "<mot de passe>" "Montassar" atelier
node mrp/mrp.js utilisateur:creer catherine@… "<mot de passe>" "Catherine" admin
node mrp/mrp.js utilisateur:liste
```

**Le rôle n'est pas cosmétique.** `atelier` déclare l'avancement et ne peut pas
poser de priorité ; `admin` pose les priorités, crée les ordres et les
échéances. Le partage est décrit dans [`METHODE-SUIVI.md`](METHODE-SUIVI.md).

---

## Après : ce qu'il faut savoir

**Le disque, c'est toute la mémoire du système.** `/var/data/mrp.db` contient
les ordres, les avancements, l'historique et les comptes. Render sauvegarde les
disques, mais une copie régulière ne coûte rien :

```sh
# depuis le Shell Render
cat /var/data/mrp.db | base64      # puis coller ailleurs
```

**Un redéploiement ne perd rien**, tant que le disque reste monté. En revanche,
supprimer le service supprime le disque : ne pas « recréer proprement » un
service sans avoir copié la base avant.

**L'app ne dort pas** sur l'offre `starter` — pas de démarrage à froid de
trente secondes comme sur le plan gratuit. C'est important : la connexion
tunisienne est déjà lente, un réveil de service par-dessus rendrait l'app
pénible.

**Les pages font 2 à 5 Ko compressées.** Rien à régler côté Render : la
compression gzip est faite par l'app elle-même.

---

## À la main, si le blueprint ne passe pas

**New → Web Service**, dépôt `lasclay/missive-automations`, branche `main`.

| Réglage | Valeur |
| --- | --- |
| Runtime | Node |
| Build Command | `true` (aucune dépendance à installer) |
| Start Command | `node --no-warnings mrp/server.js` |
| Plan | Starter |
| Health Check Path | `/sante` |

Puis **Disks → Add Disk** : nom `donnees`, chemin `/var/data`, 1 Go.

Puis les variables d'environnement :

```
NODE_VERSION        22.22.2        (node:sqlite exige 22.5 minimum)
MRP_DB              /var/data/mrp.db
MRP_SECURE          1
MRP_MODELE          claude-sonnet-5
MRP_ADMIN_COURRIEL  <ton courriel>
MRP_ADMIN_MDP       <8 caractères minimum>
ANTHROPIC_API_KEY   <la clé>
```

Ne pas définir `PORT` : Render le fournit, et l'app le lit.

---

## Quand ça ne marche pas

**`Cannot find module 'node:sqlite'`** — `NODE_VERSION` est trop vieux. Il faut
22.5 minimum ; le blueprint met 22.22.2.

**La base est vide après un redéploiement** — le disque n'est pas monté, ou
`MRP_DB` ne pointe pas dedans. Vérifier que `MRP_DB` vaut bien
`/var/data/mrp.db` et que le disque est monté sur `/var/data`.

**Connexion impossible, aucune erreur** — regarder les logs au démarrage. Si
l'amorce n'a pas tourné, créer le compte depuis le Shell :
`node mrp/mrp.js utilisateur:creer … admin`.

**Le cookie de session ne tient pas** — `MRP_SECURE=1` exige HTTPS. En accès
par `http://` (ce qui n'arrive pas sur Render, qui force HTTPS), le cookie
serait refusé par le navigateur.

**L'assistant répond qu'il lui manque sa clé** — `ANTHROPIC_API_KEY` n'est pas
saisie. Le reste de l'app fonctionne normalement.
