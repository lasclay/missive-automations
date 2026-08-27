#!/usr/bin/env python3
"""Préparation et vérification de l'outillage vidéo (ffmpeg, ffprobe, yt-dlp).

  setup.py --check   silencieux si tout est prêt ; sort 2 s'il manque un binaire
  setup.py --json    état lisible par machine
  setup.py           installe ce qui manque (brew sur macOS, apt/dnf + pip sur
                     Linux quand on a les droits, sinon imprime les commandes)

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
# (fichier local, plateforme sans sous-titres). L'audio extrait — et rien
# d'autre — est alors envoyé au fournisseur choisi. Laisse les deux vides pour
# désactiver : le skill fonctionne quand même, mais sans transcription.
#
# Groq   : https://console.groq.com/keys      (préféré : moins cher, plus rapide)
# OpenAI : https://platform.openai.com/api-keys

GROQ_API_KEY=
OPENAI_API_KEY=

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


def status() -> dict:
    missing = missing_binaries()
    key, backend = has_key()
    return {
        "can_proceed": not missing,
        "missing_binaries": missing,
        "has_whisper_key": key,
        "whisper_backend": backend,
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


def cmd_install() -> int:
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

    key, backend = has_key()
    if key:
        print(f"[setup] prêt. Repli de transcription : {backend}")
    else:
        print("[setup] prêt (sans Whisper).")
        print(f"  Les vidéos sans sous-titres natifs reviendront sans transcription.")
        print(f"  Pour l'activer, renseigne GROQ_API_KEY ou OPENAI_API_KEY dans {CONFIG_FILE}.")
    return 0


def main() -> int:
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    if arg == "--check":
        return cmd_check()
    if arg == "--json":
        json.dump(status(), sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    return cmd_install()


if __name__ == "__main__":
    raise SystemExit(main())
