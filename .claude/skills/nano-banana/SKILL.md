---
name: nano-banana
description: Générer une image avec Nano Banana (Gemini image) et la regarder. Sert à dessiner une consigne visuelle, une planche d'instruction, un pictogramme, une illustration de produit Lasclay, une variante d'une image existante. Couvre le conditionnement sur photos de référence — pour que le dessin montre LE produit et pas un équivalent générique —, le chaînage d'une série d'images qui doivent se suivre, l'interdiction de texte, et la conversion WebP qui divise le poids par dix.
when_to_use: Déclenche dès qu'il faut PRODUIRE une image plutôt qu'en lire une — « dessine-moi », « génère une image de », « fais-moi un visuel », « une illustration pour », « une planche d'instruction », « refais cette image mais ». Déclenche aussi quand une consigne écrite gagnerait à être montrée plutôt qu'expliquée, notamment pour l'atelier tunisien, où un dessin sans mots franchit la barrière de langue. Ne déclenche PAS pour regarder ou analyser une image existante — c'est `Read` — ni pour une vidéo, c'est le skill `video`.
argument-hint: "<ce qu'il faut dessiner> [--ref photo]"
allowed-tools:
  - Bash(node .claude/skills/nano-banana/scripts/image.js:*)
  - Bash(ffmpeg:*)
  - Read
  - Glob
---

# Nano Banana — dessiner avec Gemini

    node .claude/skills/nano-banana/scripts/image.js "la consigne" sortie.webp \
      --ref photo1.jpg --ref https://… --suite panneau-precedent.webp

Sort `sortie.webp` (1024 px) et `sortie-mini.webp` (320 px). Options : `--taille`,
`--qualite`, `--png`, `--modele`.

## La clé

`GEMINI_API_KEY`, dans les **réglages de l'environnement infonuagique** — barre de
titre de la session, puis *Edit*. Jamais dans le dépôt, jamais collée dans le chat.
Une session déjà démarrée ne la voit pas : il faut en ouvrir une nouvelle. Depuis
une session sans clé, on peut faire faire le travail par une session neuve créée
avec `create_session` sur le même environnement.

## Cinq choses apprises en produisant 60 panneaux

Elles ont chacune coûté une génération ratée. Les ignorer, c'est les repayer.

**1. Donner plusieurs photos, pas une.** Le modèle comble tout ce qu'une photo ne
montre pas, et il comble de façon plausible et fausse : bretelles rembourrées
vertes sur un sac qui a de simples sangles noires, patch de cuir sur un pouce qui
n'en a pas. Trois vues valent mieux qu'un paragraphe de consigne. `--ref` est
répétable.

**2. La première photo d'une fiche Shopify est choisie pour vendre**, pas pour
montrer la construction : le produit y est dans son emballage, ou aligné en sept
coloris. Prendre celle qui montre la pièce à dessiner.

**3. Chaîner une série.** Sans `--suite`, chaque image est dessinée seule et
l'objet change de forme d'une étape à l'autre — un tube devient un carré plat. Et
ce n'est pas qu'esthétique : au deuxième panneau la traction s'exerçait sur une
autre couture que celle qu'on venait de cercler.

**4. Aucun texte.** Écrire « NO text, no letters, no numbers, no labels » dans la
consigne. Un dessin sans mots se lit en Tunisie comme au Québec ; la numérotation
se fait par la page qui affiche l'image, jamais dans l'image.

**5. Le modèle ne dessine pas volontairement un détail mal fait.** Pour opposer un
bon et un mauvais exemple, l'erreur doit être STRUCTURELLE — une pièce qui bâille,
une couture ouverte, une sangle qui glisse — pas une petite rotation. Deux essais
de suite ont dessiné une étiquette « à l'envers » exactement comme celle « à
l'endroit ». Ce panneau-là a fini dessiné à la main en SVG, et c'était la bonne
décision : à un moment, s'acharner coûte plus cher que de tracer soi-même.

## Cadrer

Une main minuscule sur un vêtement entier se fait repousser dans un coin et les
flèches se détachent d'elle. Cadrer SERRÉ sur la zone du geste, demander les mains
entièrement dans le cadre, et exiger que **chaque flèche touche la main dont elle
décrit le mouvement**. Une série se lit alors comme un zoom : entier, rapproché,
rapproché, macro.

## Le poids

Le modèle rend du PNG 1024 px, ~300 Ko. Un dessin au trait passe à ~25 Ko en WebP
sans différence visible — vérifiée à l'œil, pas au compteur. Le script convertit
et garde le WebP comme **original** : une régénération ne redonne jamais le même
dessin, donc le fichier n'est pas un cache, c'est une donnée.

## Regarder ce qu'on a produit

Toujours ouvrir l'image avec `Read` avant de la livrer. Sur 60 panneaux, plusieurs
étaient plausibles et faux — un velcro dessiné sur la patte avant d'un manteau qui
n'en a pas, le cuir sur le mauvais morceau de la mitaine. Aucun ne se voit dans le
journal de génération ; tous se voient en regardant. Quand le sujet est un produit
Lasclay et qu'un détail cloche, la charte (`mrp/donnees/charte-produits.tsv`) et
les fiches Miro de procédé font autorité — et si elles se taisent, demander plutôt
que déduire.

## Exemple complet — une série de quatre qui se suivent

    R=(--ref photo-face.jpg --ref photo-detail.jpg --ref photo-dos.jpg)
    S="Technical instruction illustration, IKEA-manual style: flat vector drawing,
       dark even outlines, small flat palette, plain pale background.
       ABSOLUTELY NO text, letters, numbers or labels anywhere."

    node .claude/skills/nano-banana/scripts/image.js "$S La zone à contrôler, cerclée de rouge." p-1.webp "${R[@]}"
    node .claude/skills/nano-banana/scripts/image.js "$S Deux mains la saisissent." p-2.webp "${R[@]}" --suite p-1.webp
    node .claude/skills/nano-banana/scripts/image.js "$S Elles tirent, flèches rouges depuis chaque main." p-3.webp "${R[@]}" --suite p-2.webp
    node .claude/skills/nano-banana/scripts/image.js "$S Ce qui tient à gauche, ce qui lâche à droite." p-4.webp "${R[@]}" --suite p-3.webp

## Le cas déjà outillé : les planches de contrôle qualité du MRP

Elles ont leur propre générateur, `mrp/outils/planches_ia.js`, qui lit les consignes
dans `mrp/donnees/planches-prompts.tsv` et va chercher les photos de référence
toutes seules dans `shopify-images.tsv`. Pour une planche du MRP, passer par lui ;
ce skill sert à tout le reste.
