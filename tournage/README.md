# Plan de tournage — vidéos virales Lasclay (V2, visuel)

`Lasclay_Plan_de_tournage_videos_virales.pdf` — 52 pages, majoritairement visuelles :
storyboards, schémas de plans, timelines, barres de preuve.

## Régénérer

```bash
python3 build.py          # écrit dossier.html à partir de glyphs.py / data.py / concepts.py
/opt/pw-browsers/chromium --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
  --print-to-pdf=_raw.pdf --virtual-time-budget=25000 file://$PWD/dossier.html
# puis estampiller folios + titres courants (script dans l'historique git)
```

| Fichier | Rôle |
| --- | --- |
| `glyphs.py` | 46 pictogrammes SVG, un par plan du vocabulaire |
| `data.py` | les 46 plans et les 14 lois |
| `concepts.py` | les 88 concepts storyboardés et les 12 familles |
| `build.py` | mise en page et génération du HTML |

## Règle éditoriale

Le nom de la plante **ne se dit jamais** : ni en voix off, ni en dialogue, ni en
sous-titre incrusté (le sous-titre transcrit l'audio). Il **peut s'écrire** :
carton, description, hashtag, nom de produit, commentaire épinglé, bio, site.

Source d'analyse : dossier Drive « Analyse TikTok @uniqueplastique_ »
(135 vidéos, 4 639 captures, 5 509 commentaires, 31 comparaisons A/B).
Skills mobilisés : `copywriting-lasclay`, `lasclay-master`, `drivepush`.

## Storyboard case par case

`Lasclay_Storyboard_case_par_case.pdf` — 31 pages. 24 vidéos décomposées en
97 cases dessinées : composition, échelle de plan, mouvement de caméra, carton,
et le sous-titre incrusté tel qu'il apparaîtra à l'écran. Chaque case porte un
**prompt d'image IA** pour en tirer une version photoréaliste.

```bash
python3 build_sb.py       # scene.py + frames.py -> storyboard.html
/opt/pw-browsers/chromium --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
  --print-to-pdf=_sb.pdf --virtual-time-budget=30000 file://$PWD/storyboard.html
```

| Fichier | Rôle |
| --- | --- |
| `scene.py` | moteur de dessin : ~30 primitives (gousse, soie, main, champ, machine, thermomètre, chenille, sous-titre, carton, flèche de mouvement) |
| `frames.py` | les 24 planches, case par case : minutage, plan, dessin, note technique, prompt IA |
| `build_sb.py` | mise en page du storyboard |

Le plan de tournage (`Lasclay_Plan_de_tournage_videos_virales.pdf`) reste le
document compagnon : lois, journées, CTA, mesure, garde-fous. Le storyboard,
lui, se prend sur le plateau.
