# Transcriptions brutes

Produites en local avec `faster-whisper` (français forcé, amorçage de vocabulaire métier), sans
qu'aucun fichier ne sorte de la machine.

| Fichier | Source | Modèle | Fiabilité |
| --- | --- | --- | --- |
| `IMG_3744.md`, `IMG_8413.md`, `IMG_8416.md` | Conférence « Le paid ads en 2026 » | `small` | **faible** — voir ci-dessous |
| `j7-fondation-financiere.md` | Formation J7 Media | `medium` | bonne — voix unique en studio |

## Les transcriptions de la conférence

**À lire avec prudence.** Le français québécois parlé, en salle, avec plusieurs voix qui se
chevauchent, dépasse ce que le modèle `small` sait faire : beaucoup de phrases sont déformées
et certains noms propres sont faux (« OMIMI » pour Omy, « Monsieur Pince » pour un nom
d'intervenant). Ces fichiers servent de **repères d'horodatage** pour retrouver un passage dans
la vidéo, pas de verbatim.

Toutes les citations retenues dans `docs/meta-ads-saison-forte-2026.md` ont été recoupées avec
les diapositives affichées à l'écran avant d'être conservées ; celles qui restaient ambiguës ont
été écartées plutôt que devinées.

Deux fichiers manquent (`IMG_8414`, `IMG_8415`) : ce sont les démonstrations où la parole n'est
que du commentaire de clic sur des écrans déjà relevés image par image dans les notes.

## La transcription J7

Cas inverse : une seule voix, en studio, sans bruit de salle, et un modèle plus gros. Elle est
assez fiable pour être **citée**, et elle a effectivement apporté deux choses que les diapositives
ne montraient pas — la condition de réachat qui rend la règle du breakeven valide, et l'erreur
symétrique (faire trop de profit sur la première commande). Les déformations de vocabulaire connues
sont listées en tête du fichier.
