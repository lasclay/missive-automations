# montage — dérushage assisté et plan de montage exécutable

Monter un Reel à partir de rushes qu'on a déjà, en donnant les ajustements **à la voix** :
« le plan 3 est trop long », « commence par le lac », « enlève le texte du 5 ».

Le partage du travail est le point de tout l'outil :

| Qui | Quoi |
| --- | --- |
| Le script | sonder les fichiers, extraire les trames, encoder, assembler |
| Claude | **regarder** les trames, décrire les plans, écrire et ajuster `plan.json` |

Aucun éditeur vidéo ne fait la deuxième colonne. Aucun modèle ne fait bien la première.

## Pourquoi un fichier plutôt qu'une timeline

Le plan de montage est un JSON. Une phrase → une petite modification → un re-rendu.
Chaque plan est rendu séparément dans un cache indexé par empreinte : changer la durée
du plan 3 ne re-rend que le plan 3. Un ajustement coûte **quelques secondes**, pas un
aller-retour dans un logiciel.

## Prérequis

`ffmpeg` et `ffprobe`. Dans un conteneur neuf :

```bash
python3 .claude/skills/video/scripts/setup.py --skip-whisper
```

(sans `--skip-whisper` si on veut aussi transcrire les rushes parlés).

## La boucle

```bash
# 1. Inventaire : sonde les rushes et en extrait des trames
node montage/montage.js derush ~/rushes/glaciere-sept --projet glaciere

# 2. Claude lit les trames et remplit derush.json (description, sujet, qualite, moments, garder)
node montage/montage.js trames glaciere

# 3. Un plan de départ, puis Claude le réécrit
node montage/montage.js gabarit glaciere --titre "Reel glacière"

# 4. Relire le plan — c'est là-dessus qu'on donne ses ajustements
node montage/montage.js plan glaciere

# 5. Voir le rythme, en demi-définition et encodage rapide
node montage/montage.js render glaciere --brouillon

# 6. Le rendu final
node montage/montage.js render glaciere
```

Entre 4 et 5, on parle. « Raccourcis le 2, mets le texte en haut, coupe la musique à la fin » :
Claude modifie `plan.json` et relance le rendu.

## Le projet

```
montage/projets/<nom>/
  derush.json   l'inventaire annoté      (versionné)
  plan.json     le plan de montage       (versionné)
  trames/       les images du dérushage  (ignoré par git)
  cache/        les plans déjà rendus    (ignoré)
  sortie.mp4 / brouillon.mp4             (ignoré)
```

Les rushes eux-mêmes restent **hors du dépôt** : `derush.json` note le dossier source.

## derush.json

Le script remplit la mécanique ; les cinq derniers champs sont le travail de Claude.

```jsonc
{
  "id": "c03", "fichier": "C_asclepiade.mp4", "type": "video",
  "duree": 5.0, "largeur": 1920, "hauteur": 1080, "fps": 30,
  "orientation": "paysage", "audio": false,
  "trames": [{ "t": 0.8, "fichier": "trames/c03/t_00-00-80.jpg" }],

  "description": "gros plan sur la fibre, lumière rasante",  // ce qu'on voit
  "sujet": ["fibre", "détail", "atelier"],                   // pour retrouver un plan
  "qualite": "net, légèrement sous-exposé",                  // ce qui limite l'usage
  "moments": [{ "in": 0.5, "out": 2.3, "quoi": "la fibre s'ouvre" }],
  "garder": true
}
```

Relancer `derush` après avoir ajouté des rushes **conserve** les annotations déjà écrites
et n'extrait que les trames manquantes.

## plan.json

```jsonc
{
  "titre": "Reel glacière",
  "format": "9:16",                  // 9:16, 4:5, 1:1, 16:9
  "fps": 30,
  "musique": { "fichier": "musique.mp3", "volume": 0.6, "fade_out": 1.5, "debut": 0 },
  "texte": { "taille": 62, "couleur": "white", "contour": "black@0.7",
             "position": "bas", "marge": 220, "police": null },
  "plans": [
    { "n": 1, "source": "c01", "in": 1.0, "out": 3.4,
      "cadrage": "centre", "texte": "Le froid reste dedans.",
      "transition": "fondu", "note": "ouverture, plan large" },

    { "n": 2, "source": "c02", "in": 2.0, "out": 4.0,
      "cadrage": "haut", "audio": true },

    { "n": 3, "source": "c03", "in": 0.5, "out": 3.5, "vitesse": 1.5 },

    { "n": 4, "source": "p01", "duree": 2.5, "mouvement": "zoom_avant",
      "texte": "Fabriqué au Québec" }
  ]
}
```

| Champ | Effet |
| --- | --- |
| `in` / `out` | secondes **dans le rush** (vidéo). Une photo prend `duree` à la place |
| `vitesse` | `1.5` = accéléré. La durée écran devient `(out − in) / vitesse` |
| `cadrage` | `centre`, `haut`, `bas`, `gauche`, `droite` — où couper quand on passe un paysage en 9:16 |
| `mouvement` | photos : `zoom_avant`, `zoom_arriere`, `pan_gauche`, `pan_droite`, `fixe` |
| `audio` | `true` garde le son du rush, mélangé à la musique. Défaut : muet |
| `texte` | incrusté, replié automatiquement selon la largeur du cadre |
| `texte_position` / `texte_taille` / `texte_marge` | surchargent le style global pour ce plan |
| `transition` | `cut` (défaut) ou `fondu` — fondu **au noir** de 0,4 s, pas un fondu enchaîné |
| `n` / `note` | étiquettes de lecture : les changer ne re-rend rien |

`check` refuse un `out` qui dépasse le rush, un plan de moins de 0,3 s, une source inconnue
ou une musique introuvable. `render` valide avant d'encoder.

## Ce que l'outil ne fait pas

- **Pas de fondu enchaîné** entre deux plans : `fondu` est un fondu au noir. Un vrai
  cross-dissolve demanderait `xfade` sur toute la timeline et ferait tomber le cache par plan.
- **Pas de sous-titres automatiques** : le texte est écrit dans `plan.json`. Pour transcrire
  un rush parlé, passer par le skill `video`.
- **Pas d'étalonnage** ni de correction couleur.
- **Pas de génération** : l'outil monte ce qui existe, il n'invente pas de plan.

## Options de rendu

| Option | Effet |
| --- | --- |
| `--brouillon` | demi-définition, encodage `ultrafast` — pour juger le rythme. Le texte est mis à l'échelle, donc le brouillon ne ment pas sur le cadrage |
| `--force` | vide le cache et re-rend tout |
| `--sortie f.mp4` | fichier de sortie |
