---
name: selection-images
description: >-
  Choisir, juger et cadrer une image ou une vidéo pour Lasclay : vérité botanique d'abord (est-ce
  vraiment de l'asclépiade, un monarque, sa chenille), puis clarté du sujet sur un téléphone,
  qualité technique, cadrage 4:5 d'Instagram, saison, variété, droits et visages. Sert à la
  Routine de publication Instagram (médias du Drive VOLCANO et 1.4.3, annotation de la banque) et
  à la canne à pêche (juger la photo d'un inconnu avant de la commenter). Couvre les sosies qui
  piègent (apocyn, dompte-venin, asclépiade tropicale, vice-roi, chenille de l'arctiide), les
  seuils de résolution et les formats qu'Instagram refuse. Déclenche dès qu'il faut choisir une
  photo ou une vidéo à publier au nom de Lasclay, comparer des candidats ou dire ce que montre une
  image d'asclépiade ou de monarque, même sans le mot image : « quelle photo pour dimanche », «
  est-ce que ce cliché passe », « c'est bien une asclépiade là-dessus ? », « trouve-moi une belle
  photo de chenille dans le Drive ».
---

# Sélection d'images Lasclay

Une image publiée par Lasclay engage la crédibilité botanique de la marque. Une asclépiade
confondue avec un apocyn, un vice-roi présenté comme un monarque : c'est la faute que les
connaisseurs, qui sont justement notre public, repèrent en une seconde et ne pardonnent pas.
L'ordre des critères ci-dessous est donc l'ordre d'élimination.

## 1. Vérité botanique — éliminatoire

Nomme seulement ce dont tu es sûr. Dans le doute, la légende parle de ce qui est certain (« une
ombelle d'asclépiade ») et se tait sur le reste (l'espèce, le sexe du papillon, le stade).

| Tu crois voir | Vérifie que ce n'est pas | Comment trancher |
| --- | --- | --- |
| Asclépiade commune (*A. syriaca*) : grandes feuilles opposées ovales, ombelles rose-mauve pendantes, follicules épais et verruqueux | **Apocyn** (*Apocynum*), le sosie classique | Apocyn : feuilles plus petites et étroites, fleurs minuscules en clochettes blanc-rosé, gousses **fines et longues en paires**, tiges ramifiées rougeâtres |
| Asclépiade | **Dompte-venin** (*Vincetoxicum*), envahissant, piège à monarques : les femelles y pondent et les chenilles meurent | Plante **grimpante**, feuilles luisantes, petites fleurs étoilées brun-violet ou noires, gousses minces. **Jamais** dans une publication Lasclay |
| Asclépiade à fleurs rouges et jaunes | **Asclépiade tropicale** (*A. curassavica*) | Ombelles rouge et jaune d'or. Lasclay ne la vend ni ne la promeut : rejet pour la publication, et prudence pour un commentaire |
| Asclépiade orange vif | c'est probablement **l'asclépiade tubéreuse** (*A. tuberosa*) | Feuilles alternes étroites, fleurs orange, pas de latex abondant. La nommer seulement si c'est net |
| Asclépiade rose en milieu humide | **asclépiade incarnate** (*A. incarnata*) | Feuilles étroites lancéolées, fleurs rose vif plus petites, plante de bord d'eau |
| Monarque (*Danaus plexippus*) | **Vice-roi** (*Limenitis archippus*) | Le vice-roi a une **ligne noire qui traverse l'aile postérieure**, et il est plus petit |
| Chenille du monarque : bandes jaune, noire et blanche, deux paires de filaments noirs | **Arctiide de l'asclépiade** (*Euchaetes egle*) | Chenille **poilue**, touffes orange, noires et blanches. Belle aussi, mais ce n'est pas un monarque |
| Chrysalide du monarque : vert jade, points dorés | chrysalide d'un autre papillon | Le vert jade et la couronne de points or sont la signature ; brune ou anguleuse, ce n'est pas elle |

Rejette aussi : une plante malade ou couverte de pucerons présentée comme « magnifique », un
insecte mort, une chenille parasitée (points noirs, affaissée), un papillon aux ailes
déchiquetées **sauf** si l'angle en parle.

## 2. Clarté du sujet

L'image se lit sur un téléphone, en passant, en une seconde. Un seul sujet, net, qui se détache
du fond. Si tu dois chercher le monarque dans la photo, le lecteur ne le trouvera pas.

Préfère : macro nette d'un détail (ombelle, pollinie, graine et ses soies, chenille), contre-jour
qui fait briller la soie, papillon ailes ouvertes, follicule qui s'ouvre. Les plans larges de champ
passent seulement s'ils ont une vraie composition (lumière rasante, ligne d'horizon, profondeur).

## 3. Qualité technique

- Mise au point **sur le sujet**, pas sur la feuille derrière. Regarde l'aperçu en entier.
- Exposition : pas de ciel brûlé sur le sujet, pas d'ombres bouchées sur la chenille.
- Pas de flou de bougé, pas de bruit numérique marqué.
- Résolution : le script refuse un agrandissement de plus de ×1,35 et signale au-delà de ×1,05.
  Ne force pas ce seuil en changeant de format pour « passer » : prends une autre image.

## 4. Cadrage pour Instagram

Instagram refuse en fil une image hors de **0,8 (4:5) à 1,91:1**. Le script rend l'image à la
volée par le service d'images de Google, sans rien héberger :

| `format` | Rendu | Quand |
| --- | --- | --- |
| `4:5` | 1080×1350, recadrage intelligent | **défaut** : c'est ce qui occupe le plus d'écran dans le fil |
| `1:1` | 1080×1080 | sujet centré dans une photo horizontale que le 4:5 amputerait |
| `original` | 1080 de large | photo déjà entre 0,8 et 1,91 dont la composition horizontale est l'intérêt |
| `1.91:1` | 1080×566 | panorama, rarement |

Le recadrage « intelligent » vise le centre d'intérêt, sans le garantir. **Regarde toujours le
rendu** que produit `apercu` avant de programmer : un monarque coupé en deux, une ombelle collée
au bord, et on change de format ou d'image.

## 5. Ce qui ne se publie pas

- **Visages de clients ou d'inconnus**, et **aucun enfant**. Les dossiers « Photos clients »
  sont exclus par le script, mais un visage peut se trouver ailleurs.
- **Texte incrusté, logo, filigrane, fiche produit.** Les dossiers « Image avec informations »
  sont exclus ; un logo isolé peut encore passer, rejette-le.
- **Photo de produit** : la Routine de publication célèbre la plante, pas le catalogue. Un produit
  en usage dans la nature peut passer une fois de temps en temps, jamais un packshot.
- Tout ce qui montre le dompte-venin ou l'asclépiade tropicale comme une bonne plante.

## 6. Saison et variété

- **Saison** : le script choisit un angle de saison. Une ombelle en fleurs en janvier sonne faux,
  sauf si la légende assume le souvenir d'été.
- **Variété** : regarde les deux dernières publications (`publier.js etat`). Pas trois macros de
  fleurs d'affilée : alterne détail et plan large, plante et insecte, couleur et contre-jour.

## 7. Vidéos

- 3 à 90 secondes, 250 Mo au plus : le script le vérifie.
- **Verticale de préférence.** Les rushes VOLCANO sont en 4K horizontal (≈ 1,9:1) : ils
  passent, mais le Reel s'affichera avec des bandes. N'en prends un que s'il est nettement plus
  fort que toutes les photos du lot.
- La piste son est publiée telle quelle. Vent et oiseaux : bien. **Une voix, une conversation,
  une musique protégée : rejet.** Pour l'entendre, charge le skill `video` (il installe `ffmpeg`
  et transcrit) ; sans ça, tu ne vois que l'image d'affiche et tu ne sais pas ce qu'on y dit.

## Le vivier (Drive partagé par lien)

Parcouru par `node social/drive.js inventaire`, sans clé. Ce qui compte pour la plante :

| Dossier | Contenu |
| --- | --- |
| `VOLCANO/PHOTOS/03_Saguenay (Asclépiade, Monarque, Sabin, Fleurs)` | 89 photos pro 2026, 4000×2668 : le meilleur du lot |
| `VOLCANO/PHOTOS/04_Chenilles et chrysalides` | 50 photos pro 2026 |
| `VOLCANO/VIDEOS/03_Saguenay 2026` | 70 rushes 4K de 8 à 11 s, son d'ambiance |
| `VOLCANO/ASSETS et autres/Archive Lasclay/Asclépiade automne` | 14 photos du **Media Kit** (`Lasclay-MediaKit-*`, 2048 px) : follicules ouverts, soie au vent, champ d'automne. Le meilleur de septembre à novembre |
| `VOLCANO/ASSETS et autres/Archive Lasclay/Asclépiade été` | 47 photos plus anciennes, 2048 px, et 38 rushes |
| `1.4.3 …/Photos/Produits/Graines`, `Graines stratifiées`, `Plantules`, `Graines_Plantation` | graines et semis, souvent sur fond produit : juge au cas par cas |
| `1.4.3 …/Photos/Équipe/Culture asclépiade/Asclepiade_Recolte` | récolte au champ |
| `1.4.3 …/Photos/Produits/Bombes semencières/fleurs` | fleurs indigènes, pas toutes des asclépiades |

Un fichier nommé `lasclay-…-unsplash.jpg` est une photo **de Lasclay** republiée sur Unsplash :
c'est un doublon d'une photo du Media Kit, pas une photo d'autrui. Rejette le doublon, garde
l'original.

## Annoter : la banque apprend

Chaque média regardé s'annote, retenu ou non, pour que le tir suivant n'ait pas à le regarder
de nouveau à l'aveugle :

```json
[{"id":"…","verdict":"ok","note":5,"description":"Ombelle rose en contre-jour, abeille à droite, fond vert flou","tags":["fleur","abeille","macro","contre-jour"]},
 {"id":"…","verdict":"rejete","raison":"logo PROREC, pas une photo"}]
```

`node social/publication/publier.js noter annotations.json`. La **description** dit ce qu'on voit,
en mots que les angles cherchent (fleur, graine, chenille, monarque, follicule, champ) : c'est ce
qui fait remonter l'image au bon moment. `note` va de 1 à 5 ; 5 = publiable tel quel et
remarquable.
