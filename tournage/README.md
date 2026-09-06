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
