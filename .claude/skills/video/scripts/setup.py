#!/usr/bin/env python3
"""Préparation et vérification de l'outillage vidéo (ffmpeg, ffprobe, yt-dlp).

  setup.py --check   silencieux si tout est prêt ; sort 2 s'il manque un binaire
  setup.py --json    état lisible par machine
  setup.py           installe ce qui manque (brew sur macOS, apt/dnf + pip sur
                     Linux quand on a les droits, sinon imprime les commandes),
                     y compris `faster-whisper` pour la transcription locale

Options :
  --skip-whisper     n'installe pas le moteur de transcription local
  --model NOM        pré-télécharge un modèle Whisper local (tiny, base, small,
                     medium, large-v3) pour que la première vidéo n'attende pas

Aucune clé n'est jamais écrite automatiquement : le fichier de configuration
`~/.config/video/.env` n'est créé qu'avec des emplacements commentés, en 0600.
"""
from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

CONFIG_DIR = Path.home() / ".config" / "video"
CONFIG_FILE = CONFIG_DIR / ".env"
REQUIRED = ["ffmpeg", "ffprobe", "yt-dlp"]

TEMPLATE = """# Configuration du skill « video »
#
# Whisper ne sert QUE de repli : quand la vidéo n'a pas de sous-titres natifs
# (fichier local, plateforme sans sous-titres).
#
# Par défaut la transcription tourne EN LOCAL (faster-whisper) : aucune clé,
# rien qui sort de la machine. Les clés ci-dessous sont facultatives — elles ne
# servent qu'à aller plus vite sur de longues vidéos, et envoient alors l'audio
# extrait (et rien d'autre) au fournisseur choisi.
#
# Groq   : https://console.groq.com/keys      (le plus rapide, palier gratuit)
# OpenAI : https://platform.openai.com/api-keys

GROQ_API_KEY=
OPENAI_API_KEY=

# Modèle Whisper local : tiny | base (défaut) | small | medium | large-v3
# `small` est nettement meilleur en français, pour environ deux fois le temps.
# VIDEO_WHISPER_MODEL=base

# Langue imposée à la transcription locale, au lieu de la détecter (ex. fr)
# VIDEO_WHISPER_LANG=

# Détail par défaut : transcript | efficient | balanced | max
# VIDEO_DETAIL=balanced
"""


def which(name: str) -> str | None:
    return shutil.which(name)


def missing_binaries() -> list[str]:
    return [b for b in REQUIRED if which(b) is None]


def has_key() -> tuple[bool, str | None]:
    values = {}
    if CONFIG_FILE.exists():
        try:
            for line in CONFIG_FILE.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    values[k.strip()] = v.strip().strip("\"'")
        except OSError:
            pass
    for name, backend in (("GROQ_API_KEY", "groq"), ("OPENAI_API_KEY", "openai")):
        if (os.environ.get(name) or values.get(name) or "").strip():
            return True, backend
    return False, None


def scaffold_env() -> bool:
    if CONFIG_FILE.exists():
        return False
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(TEMPLATE, encoding="utf-8")
    try:
        CONFIG_FILE.chmod(0o600)
    except OSError:
        pass
    return True


def local_whisper_installed() -> bool:
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        return False
    return True


def status() -> dict:
    missing = missing_binaries()
    key, backend = has_key()
    local = local_whisper_installed()
    return {
        "can_proceed": not missing,
        "missing_binaries": missing,
        "has_whisper_key": key,
        "local_whisper": local,
        "transcription": backend or ("local" if local else None),
        "config_file": str(CONFIG_FILE),
        "platform": platform.system(),
    }


def _run(cmd: list[str]) -> bool:
    print(f"[setup] {' '.join(cmd)}", file=sys.stderr)
    return subprocess.run(cmd).returncode == 0


def _sudo(cmd: list[str]) -> list[str]:
    if os.geteuid() == 0 or which("sudo") is None:
        return cmd
    return ["sudo", "-n", *cmd]


def install(missing: list[str]) -> list[str]:
    """Tente l'installation ; retourne ce qui manque encore."""
    system = platform.system()
    need_ffmpeg = any(b in ("ffmpeg", "ffprobe") for b in missing)
    need_ytdlp = "yt-dlp" in missing

    if system == "Darwin":
        if which("brew") is None:
            print("[setup] Homebrew absent — installe-le depuis https://brew.sh puis relance,\n"
                  "        ou : brew install ffmpeg yt-dlp", file=sys.stderr)
            return missing_binaries()
        pkgs = (["ffmpeg"] if need_ffmpeg else []) + (["yt-dlp"] if need_ytdlp else [])
        _run(["brew", "install", *pkgs])
        return missing_binaries()

    if system == "Linux":
        if need_ffmpeg:
            if which("apt-get"):
                _run(_sudo(["apt-get", "update", "-qq"]))
                _run(_sudo(["apt-get", "install", "-y", "--no-install-recommends", "ffmpeg"]))
            elif which("dnf"):
                _run(_sudo(["dnf", "install", "-y", "ffmpeg"]))
            elif which("apk"):
                _run(_sudo(["apk", "add", "ffmpeg"]))
            else:
                print("[setup] installe ffmpeg avec le gestionnaire de paquets de ta distribution",
                      file=sys.stderr)
        if need_ytdlp:
            if which("pipx"):
                _run(["pipx", "install", "yt-dlp"])
            else:
                if not _run([sys.executable, "-m", "pip", "install", "--quiet", "yt-dlp"]):
                    _run([sys.executable, "-m", "pip", "install", "--quiet", "--user", "yt-dlp"])
        return missing_binaries()

    if system == "Windows":
        print("[setup] à installer manuellement :", file=sys.stderr)
        if need_ffmpeg:
            print("  winget install Gyan.FFmpeg", file=sys.stderr)
        if need_ytdlp:
            print("  winget install yt-dlp.yt-dlp", file=sys.stderr)
        return missing

    print(f"[setup] plateforme non gérée ({system}) — installe : {', '.join(missing)}", file=sys.stderr)
    return missing


def cmd_check() -> int:
    missing = missing_binaries()
    if not missing:
        return 0
    sys.stderr.write(
        f"[video] binaires manquants : {', '.join(missing)}. "
        f"Lance : python3 {Path(__file__).resolve()}\n"
    )
    return 2


def install_local_whisper() -> bool:
    """`faster-whisper` : transcription locale, sans clé. ~220 Mo de
    dépendances, plus le modèle (75 Mo à 464 Mo) au premier usage."""
    if local_whisper_installed():
        return True
    print("[setup] installation de faster-whisper (transcription locale, sans clé)…", file=sys.stderr)
    if not _run([sys.executable, "-m", "pip", "install", "--quiet", "faster-whisper"]):
        _run([sys.executable, "-m", "pip", "install", "--quiet", "--user", "faster-whisper"])
    return local_whisper_installed()


def prefetch_model(name: str) -> bool:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("[setup] faster-whisper absent — impossible de pré-télécharger le modèle", file=sys.stderr)
        return False
    print(f"[setup] téléchargement du modèle Whisper « {name} »…", file=sys.stderr)
    try:
        WhisperModel(name, device="cpu", compute_type="int8")
    except Exception as exc:  # noqa: BLE001
        print(f"[setup] échec du téléchargement : {exc}", file=sys.stderr)
        return False
    return True


def cmd_install(skip_whisper: bool = False, model: str | None = None) -> int:
    missing = missing_binaries()
    if missing:
        missing = install(missing)
    if missing:
        print(f"[setup] toujours absents : {', '.join(missing)}", file=sys.stderr)
        return 2

    if scaffold_env():
        print(f"[setup] configuration créée : {CONFIG_FILE}")
    else:
        print(f"[setup] configuration présente : {CONFIG_FILE}")

    local = local_whisper_installed()
    if not local and not skip_whisper:
        local = install_local_whisper()
    if model:
        prefetch_model(model)

    key, backend = has_key()
    if key:
        print(f"[setup] prêt. Transcription : {backend} (clé d'API), repli local : "
              f"{'oui' if local else 'non'}")
    elif local:
        print("[setup] prêt. Transcription : Whisper local, sans clé et sans envoi réseau.")
        print("  Le modèle se télécharge à la première vidéo (~142 Mo pour « base »).")
        print(f"  Pour aller plus vite sur de longues vidéos, une clé Groq dans {CONFIG_FILE}.")
    else:
        print("[setup] prêt, mais sans transcription.")
        print("  Les vidéos sans sous-titres natifs reviendront en images seules.")
        print("  Pour l'audio : relance ce script sans --skip-whisper (moteur local, sans clé),")
        print(f"  ou renseigne GROQ_API_KEY / OPENAI_API_KEY dans {CONFIG_FILE}.")
    return 0


def main() -> int:
    args = sys.argv[1:]
    if "--check" in args:
        return cmd_check()
    if "--json" in args:
        json.dump(status(), sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    model = None
    if "--model" in args:
        i = args.index("--model")
        if i + 1 < len(args):
            model = args[i + 1]
        else:
            print("[setup] --model attend un nom de modèle", file=sys.stderr)
            return 1
    return cmd_install(skip_whisper="--skip-whisper" in args, model=model)


if __name__ == "__main__":
    raise SystemExit(main())
