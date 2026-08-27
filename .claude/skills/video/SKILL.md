---
name: video
description: Regarder et analyser une vidéo — URL (YouTube, Vimeo, TikTok, X, Facebook, lien MP4 direct…) ou fichier local. Le script télécharge, extrait des trames JPEG horodatées que Claude lit vraiment comme des images, et récupère l'audio sous forme de transcription horodatée (sous-titres natifs, sinon Whisper local sans clé). Sert à résumer une vidéo, répondre à une question sur un moment précis, diagnostiquer un enregistrement d'écran, dépouiller une publicité concurrente, transcrire un webinaire.
when_to_use: Déclenche dès qu'on te donne un lien vidéo ou un fichier vidéo et qu'on te demande ce qu'il contient, dès qu'on écrit « regarde cette vidéo », « c'est quoi dans ce Reel », « que dit ce webinaire », « à 2:30 il se passe quoi », « transcris cette vidéo », « résume ce tuto », « pourquoi le bug apparaît dans cet enregistrement d'écran ». Déclenche aussi sur une vidéo reçue par un client dans la boîte support (colis abîmé, produit défectueux, démonstration d'un problème).
argument-hint: "<url-ou-chemin> [ta question]"
allowed-tools:
  - Bash(python3 .claude/skills/video/scripts/video.py:*)
  - Bash(python3 .claude/skills/video/scripts/setup.py:*)
  - Bash(rm -rf /tmp/video-*)
  - Read
  - Glob
---

# Regarder une vidéo

Tu n'as pas d'entrée vidéo. Ce skill t'en fabrique une : un script découpe la vidéo en trames
JPEG horodatées et en sort la transcription. Tu **lis** ensuite chaque trame avec `Read` — c'est
là que tu vois réellement la vidéo — et tu croises l'image avec ce qui est dit.

N'explore pas le dépôt pour trouver comment faire : tout est ci-dessous.

## Préparation (une fois par machine)

```bash
python3 .claude/skills/video/scripts/setup.py --check   # silencieux et code 0 si tout est prêt
```

Code 2 = il manque `ffmpeg`, `ffprobe` ou `yt-dlp`. Alors :

```bash
python3 .claude/skills/video/scripts/setup.py           # installe (brew / apt / dnf / pip) et crée ~/.config/video/.env
```

Le setup installe aussi `faster-whisper`, le moteur de transcription **local** : c'est ce qui
donne l'audio sans aucune clé. Options : `--skip-whisper` pour ne pas l'installer, `--model small`
pour pré-télécharger un modèle et éviter l'attente à la première vidéo.

Dans une session distante Claude Code, l'installation prend ~2 minutes et doit être refaite à
chaque nouveau conteneur — c'est normal, ne t'en étonne pas et ne demande rien à l'utilisateur :
lance simplement le setup.

Le fichier `~/.config/video/.env` (0600) porte des réglages facultatifs :

| Clé | Rôle |
| --- | --- |
| `VIDEO_WHISPER_MODEL` | modèle local : `tiny`, `base` (défaut), `small`, `medium`, `large-v3` |
| `VIDEO_WHISPER_LANG` | force la langue (ex. `fr`) au lieu de la détecter |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | **facultatif** — accélère les longues vidéos, au prix d'un envoi de l'audio |
| `VIDEO_DETAIL` | niveau de détail par défaut (`balanced` si absent) |

Ne réclame jamais de clé d'API à l'utilisateur : le local suffit. Une clé ne se justifie que
devant plusieurs heures d'audio à transcrire.

## Comment procéder

**1. Sépare la source de la question.** `regarde https://youtu.be/abc, il dit quoi sur les prix ?`
→ source = `https://youtu.be/abc`, question = « il dit quoi sur les prix ».

**2. Lance le script.** Passe la source telle quelle, entre guillemets.

```bash
python3 .claude/skills/video/scripts/video.py "<source>"
```

**3. Lis chaque trame listée** avec `Read`, toutes dans le même message (appels parallèles) pour
les voir ensemble. Elles sont en ordre chronologique avec leur horodatage `t=MM:SS`, ce qui
permet de les aligner sur la transcription.

**4. Réponds.** Tu as deux sources de preuve : ce qui est **à l'écran** (les trames) et ce qui est
**dit** (la transcription). Si l'utilisateur a posé une question, réponds-y directement en citant
les horodatages. Sinon, résume : structure, moments clés, visuels notables, propos tenus.
Même en mode `transcript` (sans trame), produis un **résumé** — ne recopie pas la transcription
brute dans le fil, sauf demande explicite.

**5. Nettoie.** Le rapport imprime le répertoire de travail. S'il n'y aura pas de question de
suivi : `rm -rf <répertoire>`. Sinon laisse-le — une relance ciblée pourra réutiliser le fichier
vidéo déjà téléchargé (passe le chemin local au lieu de l'URL, ça évite un second téléchargement).

## Options

| Option | Effet |
| --- | --- |
| `--detail transcript` | aucune trame — transcription seule, aucun téléchargement vidéo s'il y a des sous-titres |
| `--detail efficient` | images-clés seulement, plafond 50 trames — rapide et économe |
| `--detail balanced` | changements de scène, plafond 100 trames — **défaut** |
| `--detail max` | changements de scène, seuil plus sensible, sans plafond — coûteux en jetons |
| `--start T` / `--end T` | se concentrer sur une plage (`SS`, `MM:SS`, `HH:MM:SS`) ; l'échantillonnage devient plus dense et la transcription est filtrée sur la même plage |
| `--timestamps 4:32,7:10` | force une trame à ces instants précis (voir « repères de transcription ») |
| `--max-frames N` | plafond manuel de trames |
| `--resolution W` | largeur des trames, défaut 512 px ; monte à 1024 seulement s'il faut lire du texte à l'écran (≈ 4× plus de jetons) |
| `--fps F` | force la cadence d'échantillonnage (plafonnée à 2 img/s) |
| `--scene-threshold X` | sensibilité de détection de scène (défaut 0.30 ; 0.15 en mode `max`) |
| `--max-height H` | hauteur max de la vidéo téléchargée, défaut 720 |
| `--no-dedup` | garde les trames quasi identiques (par défaut, une diapo tenue 30 s ne donne qu'une trame) |
| `--no-whisper` | désactive le repli Whisper |
| `--whisper local\|groq\|openai` | force le moteur de transcription |
| `--whisper-model NOM` | modèle local : `tiny`, `base` (défaut), `small`, `medium`, `large-v3` |
| `--lang fr` | force la langue au lieu de la détecter — utile sur un extrait court ou bilingue |
| `--out-dir DIR` | répertoire de travail imposé |

## Combien de trames, et à quel coût

- **Meilleure fidélité : moins de 10 minutes de vidéo.** Au-delà, la couverture visuelle
  s'espace et le script te le dit dans le rapport.
- Plafond universel : **2 images/seconde**, jamais plus.
- Budget par durée en balayage complet : ≤30 s → ~30 trames · ≤1 min → ~40 · ≤3 min → ~60 ·
  ≤10 min → ~80 · au-delà → jusqu'au plafond du mode, clairsemé.
- En mode ciblé (`--start`/`--end`) c'est bien plus dense : ≤5 s → 2 img/s · 15-30 s → ~2 img/s ·
  30-60 s → ~1,3 img/s · 1-3 min → ~0,6 img/s.
- Ordre de grandeur : 80 trames à 512 px ≈ 50-80 k jetons d'image. La transcription, elle, ne
  coûte que quelques milliers de jetons.

**Sur une vidéo longue, ne balaie pas tout.** Fais d'abord `--detail transcript`, lis la
transcription, puis relance en ciblant la section qui répond à la question. C'est plus juste et
dix fois moins cher.

**Ne relance jamais le script pour une question de suivi sur une vidéo déjà regardée dans la
session** : tu as déjà les trames et la transcription en contexte.

## Repères de transcription

La sélection visuelle rate les moments que la personne à l'écran *désigne* — « regardez ici »,
« comme vous voyez », « remarquez ce chiffre » — parce que pointer une diapo change peu l'image.
La parade, en deux temps :

1. Une passe `--detail transcript` pour obtenir la transcription horodatée.
2. Tu repères toi-même les moments désignés (c'est un jugement, pas une expression régulière),
   puis tu relances avec `--timestamps 4:32,7:10,9:55` sur le **fichier local déjà téléchargé**.

Les trames de repère sont fusionnées avec celles du mode choisi, en ordre chronologique, et
réservées d'avance contre le plafond. Avec `--detail transcript`, elles deviennent les seules
trames extraites.

## D'où vient l'audio

Trois sources, essayées dans cet ordre, automatiquement :

1. **Sous-titres natifs** (`yt-dlp`) — gratuits, instantanés, déjà horodatés. Couvrent YouTube et
   la plupart des plateformes. Rien à installer, rien à configurer.
2. **Whisper local** (`faster-whisper`) — dès qu'il n'y a pas de sous-titres. Aucune clé, aucun
   envoi réseau : l'audio ne quitte pas la machine. C'est le mode par défaut du skill.
3. **Whisper en API** (Groq puis OpenAI) — seulement si une clé est configurée. Utilisé en
   priorité quand elle existe, parce que c'est beaucoup plus rapide sur les longues vidéos.

Le modèle local se télécharge une fois (75 Mo pour `tiny`, 142 Mo pour `base`, 464 Mo pour
`small`) et reste en cache. Vitesse mesurée sur processeur, sans carte graphique :

| Modèle | Vitesse | Pour 10 min de vidéo | Quand l'utiliser |
| --- | --- | --- | --- |
| `tiny` | ~10× le temps réel | ~1 min | dégrossir, anglais simple |
| `base` (défaut) | ~5× | ~2 min | usage courant |
| `small` | ~4× | ~2,5 min | **français**, noms propres, audio bruité |

Pour du français soigné : `--whisper-model small --lang fr`.

## Ce qui sort et d'où ça vient

Le rapport markdown donne : source, durée, définition, plage, mode, nombre de trames (et combien
de jumelles ont été écartées), origine de la transcription, répertoire de travail — puis la liste
des trames et la transcription horodatée. La ligne **Transcription** dit toujours la provenance :
`sous-titres (fr)`, `whisper local (base, fr)`, `whisper (groq)`, ou `aucune`.

## Ce qui peut échouer

| Symptôme | Quoi faire |
| --- | --- |
| `binaires manquants` | `python3 .claude/skills/video/scripts/setup.py` |
| yt-dlp : « Sign in to confirm you're not a bot », « Failed to extract player response » | YouTube bloque les IP de centre de données. Dans une session distante, ça arrive : dis-le franchement et demande un fichier vidéo, ou refais la manœuvre depuis la machine de l'utilisateur. N'insiste pas à coups de relances. |
| vidéo privée, géobloquée, derrière un mot de passe | dis-le simplement, ne réessaie pas en boucle |
| `Transcription : aucune` | ni sous-titres, ni moteur Whisper. Lance le setup (installe le moteur local, sans clé), puis relance |
| transcription locale lente | normal sur une longue vidéo : ~5× le temps réel avec `base`. Passe à `tiny`, ou cible une plage avec `--start`/`--end` |
| transcription locale approximative en français | `--whisper-model small --lang fr` |
| Whisper en API échoue | l'erreur est sur stderr (clé invalide, quota). Bascule sur `--whisper local` |
| avertissement « plus de 10 minutes » | reprends en ciblé avec `--start`/`--end` plutôt qu'un balayage clairsemé |

## Vie privée et périmètre

- Le téléchargement passe par `yt-dlp`, en accès public seulement : aucun compte, aucun témoin de
  session, aucune publication. Rien n'est envoyé à un service tiers pour extraire les trames —
  `ffmpeg` travaille en local.
- **La vidéo n'est jamais téléversée nulle part, et par défaut l'audio non plus** : la
  transcription tourne en local. Rien ne sort vers un tiers.
- L'audio ne part sur le réseau que dans un seul cas : une clé `GROQ_API_KEY` ou `OPENAI_API_KEY`
  est configurée, il n'y a pas de sous-titres natifs, et le repli n'est pas désactivé. Sur une
  vidéo confidentielle (client, interne, fournisseur) dans un environnement où une clé existe,
  impose le local avec `--whisper local` — ou `--no-whisper`.
- Tout le travail vit dans un répertoire temporaire, à supprimer à la fin (étape 5). Les clés ne
  sont jamais imprimées ni journalisées.

## Cas Lasclay

- **Vidéo d'un client dans la boîte support** (colis abîmé, produit défectueux) : regarde-la avant
  de répondre, puis suis le skill `support` pour la vérification et la rédaction. La vidéo est une
  preuve de plus, pas un raccourci sur la vérification Shopify + ShipStation.
- **Publicité ou contenu concurrent** : `--detail balanced` puis résumé structurel — accroche,
  promesse, preuve, appel à l'action, avec les horodatages.
- **Tuto ou webinaire fournisseur** : `--detail transcript` d'abord, repères ensuite sur les
  moments désignés, et rends des notes utilisables plutôt qu'une retranscription.
- **Vidéo de la marque avant publication** : `--detail max` sur les 15 premières secondes pour
  juger l'accroche image par image.

## Origine

Portage maison, sans dépendance pip, inspiré de deux projets MIT :
[bradautomates/claude-video](https://github.com/bradautomates/claude-video) (pipeline trames +
Whisper, budgets de trames, repères de transcription) et
[devinilabs/claude-watch](https://github.com/devinilabs/claude-watch) (sélection par scène, notes
d'étude). Le code d'ici est réécrit pour ce dépôt : `scripts/video.py` (tout le pipeline) et
`scripts/setup.py` (préparation). Rien d'autre n'est requis que `ffmpeg`, `ffprobe` et `yt-dlp`.
