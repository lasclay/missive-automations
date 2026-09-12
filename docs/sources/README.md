# Sources brutes du guide de saison forte

Ce dossier garde la matière première derrière les trois documents de `docs/`. Rien ici n'est
destiné à être lu en continu : ce sont des relevés, à consulter quand on veut vérifier d'où
sort une affirmation du guide.

| Fichier | Ce que c'est |
| --- | --- |
| `conference-paid-ads-2026-notes-brutes.md` | Relevé écran par écran des six enregistrements de la conférence (dossier Drive `1YGCY0JO0d-jyUYEeljF33zQNRWdJbuAd`) |
| `sell-like-crazy-notes-brutes.md` | Relevé de lecture du PDF *Sell Like Crazy* (Sabri Suby) |
| `j7-fondation-financiere-notes-brutes.md` | Relevé écran par écran de la formation J7 Media « Fondation financière » (160 trames extraites) |
| `transcriptions/` | Transcriptions audio horodatées, produites en local — voir l'avertissement dans `transcriptions/README.md` |
| `saison-forte-2026.html` | Copie du guide visuel publié (Artifact), pour garder le contenu dans le dépôt |

## À propos de `saison-forte-2026.html`

C'est la **source** de l'Artifact publié, conservée ici telle quelle. Elle référence 49 images
en `img/…` qui ne sont pas versionnées : ce sont des captures de diapositives extraites des
vidéos (~5 Mo), publiées comme fichiers d'accompagnement de l'Artifact. Ouvert directement
depuis le dépôt, le fichier s'affiche donc sans ses images ; le texte, lui, est complet.

Pour régénérer les images, il faut les vidéos d'origine et le script d'extraction décrit dans
`conference-paid-ads-2026-notes-brutes.md` (échantillonnage ffmpeg, déduplication par hachage
perceptuel, recadrage sur l'écran puis agrandissement).

## Précaution de diffusion

Les captures et les chiffres démontrés viennent de **comptes publicitaires tiers**
(MonsieurChalets pour la conférence, un compte client anonyme pour J7 Media). Ce sont des
références internes de méthode : ne pas republier ces documents à l'extérieur de Lasclay.
