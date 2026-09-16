---
name: montage
description: Dérusher un dossier de rushes (vidéos et photos déjà tournées) et en monter une vidéo courte — Reel, pub Meta, capsule produit. Claude regarde réellement les rushes, en fait l'inventaire annoté, écrit le plan de montage dans un fichier, et l'ajuste ensuite sur simple demande orale : « le plan 3 est trop long », « commence par le lac », « enlève le texte du 5 ». Le rendu est fait par ffmpeg, avec un cache par plan pour que chaque ajustement coûte quelques secondes.
when_to_use: Déclenche dès qu'on parle de monter une vidéo à partir de rushes existants, de dérusher, de faire un plan de montage, un Reel, une capsule, une pub vidéo. Déclenche aussi sans le mot montage — « qu'est-ce que j'ai comme plans utilisables dans ce dossier », « fais-moi un Reel de 15 secondes avec ça », « raccourcis le troisième plan », « mets la photo de la glacière en premier », « recadre ça en 9:16 ». Ne déclenche pas pour analyser UNE vidéo reçue (c'est le skill `video`).
argument-hint: "<dossier de rushes ou nom de projet> [ce qu'on veut monter]"
allowed-tools:
  - Bash(node montage/montage.js:*)
  - Bash(python3 .claude/skills/video/scripts/setup.py:*)
  - Read
  - Edit
  - Write
  - Glob
---

# Monter une vidéo à partir de rushes existants

Tu n'as pas d'entrée vidéo. L'outil t'en fabrique une : il découpe chaque rush en trames JPEG
que tu **lis** vraiment. Tu fais le jugement — quel plan vaut quelque chose, dans quel ordre,
sur quelle durée — et tu l'écris dans `plan.json`, que ffmpeg exécute.

N'explore pas le dépôt : tout est ici et dans `montage/README.md`.

## Préparation (une fois par conteneur)

```bash
command -v ffmpeg >/dev/null || python3 .claude/skills/video/scripts/setup.py --skip-whisper
```

## 1. Dérusher

```bash
node montage/montage.js derush <dossier> --projet <nom>
node montage/montage.js trames <nom>
```

**Lis toutes les trames d'un même clip dans un seul message** (appels `Read` parallèles) :
c'est en les voyant côte à côte qu'on juge un mouvement, une netteté, une lumière.

Puis remplis `montage/projets/<nom>/derush.json` pour chaque clip :

| Champ | Ce qu'on y met |
| --- | --- |
| `description` | ce qu'on voit, en une ligne factuelle — pas d'adjectif de vente |
| `sujet` | 2 à 4 mots pour retrouver le plan plus tard |
| `qualite` | ce qui **limite** l'usage : flou, tremblant, surexposé, logo visible |
| `moments` | `{ "in": 0.5, "out": 2.3, "quoi": "..." }` — les secondes réellement utilisables |
| `garder` | `false` sur un rush inexploitable, pour qu'il sorte du gabarit |

`moments` est le champ qui fait gagner du temps : c'est lui qui devient les `in`/`out` du plan.
Un rush de 12 s contient rarement plus de 2 s utilisables — dis-le franchement.

## 2. Écrire le plan

```bash
node montage/montage.js gabarit <nom> --titre "..."   # départ : un plan par rush gardé
node montage/montage.js plan <nom>                     # relecture
node montage/montage.js check <nom>
```

Réécris ensuite `plan.json` toi-même. Repères qui tiennent pour un Reel :

- **1 à 2,5 s par plan.** Au-delà de 3 s sans mouvement ni parole, ça décroche.
- **Le meilleur plan en premier**, pas le plus explicatif.
- **Le texte est une accroche, pas une légende** : moins de 6 mots, un seul par plan.
- **Un paysage recadré en 9:16 perd 60 % de l'image** : choisis `cadrage` en regardant où est
  le sujet dans la trame, ne laisse pas `centre` par défaut.
- **Format** : `9:16` pour Reels et Stories, `4:5` pour le fil, `1:1` si ça sert aux deux.

Pour la voix de la marque et les garde-fous (pas de greenwashing ni de localwashing), charge
`copywriting-lasclay` avant d'écrire les textes incrustés.

## 3. Montrer, puis ajuster

```bash
node montage/montage.js render <nom> --brouillon   # demi-définition, rapide
```

Envoie le brouillon avec `SendUserFile`, accompagné du tableau de `plan`. C'est ce couple —
la vidéo et le plan numéroté — qui permet de répondre « le 3 est trop long ».

**Traduis chaque phrase en une modification minimale de `plan.json`, puis relance le rendu.**

| Ce qu'on te dit | Ce que tu changes |
| --- | --- |
| « le plan 3 est trop long » | `out` du plan 3 (ou `duree` pour une photo) |
| « commence par le lac » | déplace l'entrée dans `plans`, renumérote `n` |
| « on voit mal la glacière » | `cadrage`, ou un autre `moments` du même rush |
| « ça va trop vite » | `vitesse`, ou allonge les plans les plus stables |
| « enlève le texte du 5 » | `texte: ""` |
| « ajoute la musique » | `musique.fichier` + `volume` |
| « garde le son de l'atelier » | `audio: true` sur ce plan |

Renuméroter ou changer une `note` ne re-rend rien : le cache n'indexe que ce qui touche l'image.
Un ajustement typique se re-rend en 2 à 5 secondes.

Quand le rythme tient : `node montage/montage.js render <nom>` pour la pleine définition.

## Ce qu'il faut dire honnêtement

- `transition: "fondu"` est un fondu **au noir**, pas un fondu enchaîné.
- Pas de sous-titres automatiques, pas d'étalonnage, aucune génération d'image.
- Si les rushes ne contiennent pas le plan qu'il faudrait, **dis-le** et propose ce qu'il reste
  à tourner. Ne monte pas un plan faible en prétendant que ça passe.

Détail des champs et limites : `montage/README.md`.
