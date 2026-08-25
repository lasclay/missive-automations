# La démo

Une page unique qui contient l'app, pour la faire essayer avant qu'elle soit
déployée. Publiée ici :
<https://claude.ai/code/artifact/0e315c5a-39f1-4c23-be1f-1821819f8ac6>

## Le parti pris

**On ne réécrit rien.** Chaque écran de la démo est le HTML que le serveur
produit vraiment, récupéré par HTTP et collé tel quel. Une maquette qui
*ressemble* à l'app finit toujours par mentir sur un détail ; celle-ci ne le
peut pas, puisqu'elle est l'app.

Chaque vue est récupérée **deux fois**, une par rôle. Le partage des
responsabilités — l'atelier déclare l'avancement, Gabriel et Catherine posent
les priorités — ne se raconte pas, il se voit : on bascule de rôle et les
commandes changent, parce que ce sont deux pages réellement différentes.

Quatre choses seulement changent :

1. **Les liens** deviennent des ancres internes. Ce qui écrirait sur le
   serveur devient inerte et se voit (opacité réduite).
2. **Les photos** sont embarquées en base64. Une page publiée n'a pas le droit
   d'aller chercher le CDN de Shopify — c'est la seule différence assumée avec
   l'app, qui elle ne stocke que des adresses. Chaque photo n'apparaît qu'une
   fois dans le fichier, quelle que soit le nombre de fiches qui la partagent,
   et ne prend sa source qu'à l'affichage de sa fiche.
3. **Les gestionnaires en ligne partent.** Le sélecteur de priorité porte un
   `onchange="this.form.submit()"` : un envoi programmatique **ne déclenche
   pas** les écouteurs `submit`, donc la page quittait la démo sans que rien
   ne l'arrête. C'est le script de la démo qui écoute `change` et `click`.
4. **Les deux gestes fonctionnent.** `demo-app.js` recalcule ce que le serveur
   recalculerait : une tranche d'avancement met à jour la jauge, l'avancement
   global pondéré, le restant dans *À fabriquer*, les compteurs, la répartition
   par famille et le suivi ; une priorité réordonne la liste avec le tri exact
   de `db.js` et renumérote les rangs. La saisie tient dans `localStorage`,
   donc dans ce navigateur seulement.

**Tant que rien n'est touché, les chiffres affichés sont ceux du serveur.** Le
recalcul ne prend la main qu'à la première saisie, et « Remettre à zéro »
recharge la page plutôt que de reconstituer l'état de départ. Sans cette règle,
un écart entre le modèle de la démo et la base ferait mentir la page sans que
rien ne le signale — c'est arrivé une fois, deux items ajoutés après coup
n'étaient pas dans le modèle.

## Refaire la démo

Il faut un serveur MRP qui tourne avec les données à montrer, et les photos
rapatriées une fois.

```sh
# 1. une base peuplée
MRP_DB=/tmp/demo.db node mrp/import.js --ecrire
MRP_DB=/tmp/demo.db PORT=8799 node mrp/server.js &

# 2. une session ouverte, le cookie sert au constructeur
curl -s -c ck -d "courriel=…&mdp=…" http://127.0.0.1:8799/connexion -o /dev/null

# 3. les photos, une fois (voir build-demo.js pour le format de map.tsv)
#    ?width=320&format=jpg : le CDN sert du JPEG cinq fois plus léger que le PNG

# 4. le fichier ; MRP_DEMO_TRAVAIL pointe vers ck, demo-data.json et demoimg3
MRP_DEMO_TRAVAIL=/tmp/demo node mrp/demo/build-demo.js /tmp/demo

# 5. les tests, sur la page servie localement
npx http-server -p 8801 -s /tmp/demo
MRP_DEMO_TRAVAIL=/tmp/demo node mrp/demo/test-demo.js
```

Le dossier de travail doit contenir `ck-admin` et `ck-atelier` (une session
ouverte par rôle), `demo-data.json` et `demoimg3/`.

`test-demo.js` vérifie les trente points qui comptent : la navigation, la
bascule de rôle et ce que chaque rôle voit, le départ à zéro, ce qui est
fabriqué ailleurs, les deux gestes et leur répercussion dans les trois vues,
le tri après changement de priorité, la persistance, la remise à zéro,
l'affichage des photos, l'inertie des liens d'écriture, l'absence de
débordement horizontal, d'erreur JavaScript et de ressource manquante.

## Ce que la démo ne montre pas

- **L'assistant**, qui a besoin d'une clé d'API et d'un serveur.
- **La connexion** : la démo est ouverte. Les rôles s'y basculent d'un bouton ;
  dans l'app ils tiennent au compte, et personne ne choisit le sien.
- **Le vrai poids des pages.** Ici tout est dans un seul fichier de 4,0 Mo,
  dont 3,4 Mo de photos. L'app, elle, sert des pages de 2 à 5 Ko compressées
  et laisse le CDN livrer les images à la taille d'affichage.
