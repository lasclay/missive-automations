#!/usr/bin/env python3
"""Regarder une vidéo : trames + transcription, prêtes à être lues par Claude.

Pipeline :
  1. source URL  → yt-dlp récupère les sous-titres natifs, puis la vidéo
     source fichier → on travaille directement dessus
  2. ffprobe      → durée, dimensions
  3. passe d'analyse ffmpeg (une seule) → horodatages candidats + vignettes
     16x16 en gris pour repérer les trames quasi identiques
  4. extraction des trames retenues en JPEG
  5. transcription : sous-titres natifs, sinon Whisper (Groq ou OpenAI) si une
     clé est configurée
  6. rapport markdown sur stdout : chemins des trames + transcription horodatée

Claude lit ensuite chaque chemin de trame avec l'outil Read pour voir la vidéo.

Inspiré de bradautomates/claude-video et devinilabs/claude-watch (MIT).
Dépendances externes : ffmpeg, ffprobe, yt-dlp. Aucune dépendance pip.
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import uuid
from pathlib import Path

CONFIG_FILE = Path.home() / ".config" / "video" / ".env"

DETAILS = ("transcript", "efficient", "balanced", "max")
FRAME_CAP = {"transcript": 0, "efficient": 50, "balanced": 100, "max": None}
SCENE_THRESHOLD = {"efficient": 0.30, "balanced": 0.30, "max": 0.15}

MAX_FPS = 2.0            # jamais plus dense, quel que soit le budget
MAX_FRAME_HEIGHT = 1998  # limite de l'outil Read
DEDUP_THRESHOLD = 6.0    # écart moyen (0-255) sous lequel deux trames sont jumelles
WHISPER_CHUNK_SECONDS = 900
WHISPER_MAX_BYTES = 24 * 1024 * 1024

SUB_LANGS = "fr,fr-CA,fr-FR,fr.*,en,en-US,en.*"
LANG_PREFERENCE = ("fr", "en")


# --------------------------------------------------------------------------- #
# utilitaires
# --------------------------------------------------------------------------- #

def log(msg: str) -> None:
    sys.stderr.write(f"[video] {msg}\n")
    sys.stderr.flush()


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, **kw)


def read_env_file(path: Path = CONFIG_FILE) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return values
    for line in lines:
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, _, value = raw.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] in "\"'" and value[-1] == value[0]:
            value = value[1:-1]
        else:
            for i, ch in enumerate(value):
                if ch == "#" and i > 0 and value[i - 1] in " \t":
                    value = value[:i].rstrip()
                    break
        values[key.strip()] = value
    return values


def env_value(name: str) -> str | None:
    value = os.environ.get(name)
    if value and value.strip():
        return value.strip()
    value = read_env_file().get(name)
    return value.strip() if value and value.strip() else None


def parse_time(value: str | None) -> float | None:
    """`SS`, `MM:SS` ou `HH:MM:SS` → secondes."""
    if value is None:
        return None
    parts = str(value).strip().split(":")
    if not parts or any(p.strip() == "" for p in parts):
        raise SystemExit(f"horodatage invalide : {value!r}")
    try:
        nums = [float(p) for p in parts]
    except ValueError:
        raise SystemExit(f"horodatage invalide : {value!r}")
    if len(nums) > 3:
        raise SystemExit(f"horodatage invalide : {value!r}")
    seconds = 0.0
    for n in nums:
        seconds = seconds * 60 + n
    return seconds


def format_time(seconds: float, precise: bool = False) -> str:
    seconds = max(0.0, float(seconds))
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    tenths = f".{int((seconds - int(seconds)) * 10)}" if precise else ""
    return f"{h}:{m:02d}:{s:02d}{tenths}" if h else f"{m}:{s:02d}{tenths}"


def is_url(source: str) -> bool:
    return source.startswith(("http://", "https://", "www."))


# --------------------------------------------------------------------------- #
# téléchargement (yt-dlp)
# --------------------------------------------------------------------------- #

def fetch_captions(url: str, workdir: Path) -> tuple[Path | None, str | None]:
    """Sous-titres natifs (manuels d'abord, auto ensuite). Gratuits, aucun envoi."""
    cmd = [
        "yt-dlp", "--skip-download",
        "--write-subs", "--write-auto-subs",
        "--sub-langs", SUB_LANGS,
        "--sub-format", "vtt/srt",
        "--convert-subs", "vtt",
        "--no-warnings",
        "-o", str(workdir / "sub.%(ext)s"),
        url,
    ]
    proc = run(cmd)
    if proc.returncode != 0:
        log("aucun sous-titre récupéré (yt-dlp : " + proc.stderr.decode(errors="replace").strip()[-200:] + ")")
    files = sorted(workdir.glob("sub*.vtt"))
    if not files:
        return None, None

    def rank(path: Path) -> tuple[int, str]:
        stem = path.stem  # sub.fr, sub.en-US, ...
        lang = stem.split(".", 1)[1] if "." in stem else ""
        for i, pref in enumerate(LANG_PREFERENCE):
            if lang.lower().startswith(pref):
                return (i, lang)
        return (len(LANG_PREFERENCE), lang)

    best = sorted(files, key=rank)[0]
    lang = best.stem.split(".", 1)[1] if "." in best.stem else "?"
    return best, lang


def download_video(url: str, workdir: Path, max_height: int) -> Path:
    out = workdir / "video.%(ext)s"
    fmt = (
        f"bv*[height<={max_height}]+ba/b[height<={max_height}]/"
        f"bv*+ba/b"
    )
    cmd = ["yt-dlp", "-f", fmt, "--no-warnings", "--no-playlist", "-o", str(out), url]
    proc = run(cmd)
    if proc.returncode != 0:
        err = proc.stderr.decode(errors="replace").strip()
        raise SystemExit(f"échec du téléchargement yt-dlp :\n{err[-1500:]}")
    files = [p for p in workdir.glob("video.*") if p.suffix.lower() not in (".vtt", ".srt", ".json")]
    if not files:
        raise SystemExit("yt-dlp n'a produit aucun fichier vidéo")
    return max(files, key=lambda p: p.stat().st_size)


# --------------------------------------------------------------------------- #
# métadonnées
# --------------------------------------------------------------------------- #

def probe(path: Path) -> dict:
    proc = run([
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", str(path),
    ])
    if proc.returncode != 0:
        raise SystemExit(f"ffprobe a échoué sur {path}")
    data = json.loads(proc.stdout.decode(errors="replace") or "{}")
    video = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), {})
    duration = 0.0
    for candidate in (video.get("duration"), data.get("format", {}).get("duration")):
        try:
            duration = float(candidate)
            break
        except (TypeError, ValueError):
            continue
    return {
        "duration": duration,
        "width": int(video.get("width") or 0),
        "height": int(video.get("height") or 0),
        "has_video": bool(video),
    }


# --------------------------------------------------------------------------- #
# budget de trames
# --------------------------------------------------------------------------- #

def frame_budget(span: float, focused: bool) -> int:
    """Nombre de trames visé pour une plage de `span` secondes."""
    if focused:
        table = [(5, 10), (15, 30), (30, 60), (60, 80), (180, 100)]
    else:
        table = [(30, 30), (60, 40), (180, 60), (600, 80)]
    for limit, budget in table:
        if span <= limit:
            return budget
    return 100


def auto_fps(span: float, budget: int) -> float:
    if span <= 0:
        return 1.0
    return max(0.05, min(MAX_FPS, budget / span))


# --------------------------------------------------------------------------- #
# passe d'analyse : horodatages candidats + vignettes pour la déduplication
# --------------------------------------------------------------------------- #

SHOWINFO_PTS = re.compile(r"pts_time:([0-9.]+)")
THUMB = 16  # vignette 16x16 en gris = 256 octets par trame


def analyse(
    video: Path,
    mode: str,
    start: float | None,
    end: float | None,
    fps: float,
    scene_threshold: float,
) -> list[tuple[float, str, bytes]]:
    """Retourne [(timestamp absolu, raison, vignette)] pour les trames candidates.

    Une seule passe ffmpeg : `showinfo` donne les horodatages sur stderr pendant
    que la sortie rawvideo donne les vignettes sur stdout.
    """
    if mode == "scene":
        select = f"select='gt(scene,{scene_threshold})'"
        reason = "scène"
        pre = []
    elif mode == "keyframe":
        select = "select='eq(pict_type,I)'"
        reason = "image-clé"
        pre = ["-skip_frame", "nokey"]
    else:  # uniform
        select = f"fps={fps:.4f}"
        reason = "régulier"
        pre = []

    cmd = ["ffmpeg", "-hide_banner", "-nostdin"]
    if start is not None:
        cmd += ["-ss", f"{start:.3f}"]
    cmd += pre + ["-i", str(video)]
    if end is not None:
        cmd += ["-to", f"{max(0.0, end - (start or 0.0)):.3f}"]
    cmd += [
        "-an", "-sn",
        "-vf", f"{select},showinfo,scale={THUMB}:{THUMB},format=gray",
        "-vsync", "vfr", "-f", "rawvideo", "-",
    ]

    proc = run(cmd)
    stamps = [float(m) for m in SHOWINFO_PTS.findall(proc.stderr.decode(errors="replace"))]
    raw = proc.stdout
    size = THUMB * THUMB
    thumbs = [raw[i * size:(i + 1) * size] for i in range(len(raw) // size)]

    offset = start or 0.0
    frames: list[tuple[float, str, bytes]] = []
    for i, ts in enumerate(stamps):
        thumb = thumbs[i] if i < len(thumbs) else b""
        frames.append((ts + offset, reason, thumb))
    return frames


def dedup(frames: list[tuple[float, str, bytes]], threshold: float) -> tuple[list, int]:
    """Écarte les trames visuellement jumelles de la précédente retenue."""
    kept: list[tuple[float, str, bytes]] = []
    dropped = 0
    last: bytes | None = None
    for ts, reason, thumb in frames:
        if last is not None and thumb and len(thumb) == len(last):
            diff = sum(abs(a - b) for a, b in zip(thumb, last)) / len(thumb)
            if diff < threshold:
                dropped += 1
                continue
        kept.append((ts, reason, thumb))
        last = thumb or last
    return kept, dropped


def subsample(frames: list, cap: int) -> list:
    """Réduit à `cap` trames en gardant un échantillonnage régulier."""
    if cap is None or len(frames) <= cap or cap <= 0:
        return frames
    step = len(frames) / cap
    return [frames[int(i * step)] for i in range(cap)]


# --------------------------------------------------------------------------- #
# extraction des trames retenues
# --------------------------------------------------------------------------- #

def extract_frame(video: Path, ts: float, dest: Path, width: int) -> bool:
    scale = f"scale={width}:-2:force_original_aspect_ratio=decrease"
    clamp = f"scale='min({width},iw)':'min({MAX_FRAME_HEIGHT},ih)':force_original_aspect_ratio=decrease"
    cmd = [
        "ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error",
        "-ss", f"{max(0.0, ts):.3f}", "-i", str(video),
        "-frames:v", "1", "-vf", f"{scale},{clamp}",
        "-q:v", "3", "-y", str(dest),
    ]
    proc = run(cmd)
    return proc.returncode == 0 and dest.exists() and dest.stat().st_size > 0


# --------------------------------------------------------------------------- #
# transcription
# --------------------------------------------------------------------------- #

VTT_TIME = re.compile(
    r"(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})"
)
VTT_TAG = re.compile(r"<[^>]+>")


def parse_vtt(path: Path) -> list[tuple[float, str]]:
    """VTT → [(secondes, texte)], sans les doublons roulants des sous-titres auto."""
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    cues: list[tuple[float, float, str]] = []  # (début, fin, texte)
    current: tuple[float, float] | None = None
    buffer: list[str] = []

    def flush() -> None:
        if current is None:
            return
        text = " ".join(t.strip() for t in buffer if t.strip())
        text = VTT_TAG.sub("", text).strip()
        text = " ".join(text.split())
        if text:
            cues.append((current[0], current[1], text))

    for line in content.splitlines():
        m = VTT_TIME.search(line)
        if m:
            flush()
            g = [int(m.group(i)) for i in range(1, 9)]
            begin = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000
            stop = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000
            current = (begin, stop)
            buffer = []
            continue
        if line.strip().upper().startswith(("WEBVTT", "NOTE", "STYLE", "KIND:", "LANGUAGE:")):
            continue
        if line.strip().isdigit():
            continue
        buffer.append(line)
    flush()

    # Sous-titres auto de YouTube : les blocs se chevauchent et chacun réécrit le
    # texte du précédent avant d'ajouter le nouveau. On ne retire ce préfixe que
    # sur des blocs qui se chevauchent — un sous-titre normal qui répète une
    # phrase reste intact.
    cleaned: list[tuple[float, str]] = []
    prev_end = 0.0
    prev_full = ""  # texte d'origine du bloc précédent, avant tout élagage
    for begin, stop, text in cues:
        full = text
        if prev_full and text == prev_full:
            prev_end = max(prev_end, stop)
            continue
        if prev_full and begin < prev_end and text.startswith(prev_full):
            new = text[len(prev_full):].strip()
            if not new:
                prev_end = max(prev_end, stop)
                continue
            text = new
        cleaned.append((begin, text))
        prev_end, prev_full = stop, full
    return cleaned


def filter_range(cues: list[tuple[float, str]], start: float | None, end: float | None):
    out = []
    for ts, text in cues:
        if start is not None and ts < start - 2:
            continue
        if end is not None and ts > end + 2:
            continue
        out.append((ts, text))
    return out


def extract_audio(video: Path, workdir: Path) -> Path:
    audio = workdir / "audio.mp3"
    cmd = [
        "ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error",
        "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k",
        "-y", str(audio),
    ]
    proc = run(cmd)
    if proc.returncode != 0 or not audio.exists():
        raise RuntimeError("extraction audio impossible")
    return audio


def split_audio(audio: Path, workdir: Path) -> list[Path]:
    if audio.stat().st_size <= WHISPER_MAX_BYTES:
        return [audio]
    pattern = workdir / "audio_part_%03d.mp3"
    cmd = [
        "ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error",
        "-i", str(audio), "-f", "segment",
        "-segment_time", str(WHISPER_CHUNK_SECONDS), "-c", "copy",
        "-y", str(pattern),
    ]
    run(cmd)
    parts = sorted(workdir.glob("audio_part_*.mp3"))
    return parts or [audio]


WHISPER_ENDPOINTS = {
    "groq": ("https://api.groq.com/openai/v1/audio/transcriptions", "whisper-large-v3", "GROQ_API_KEY"),
    "openai": ("https://api.openai.com/v1/audio/transcriptions", "whisper-1", "OPENAI_API_KEY"),
}


def local_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        return False
    return True


def pick_backend(forced: str | None) -> tuple[str, str | None] | None:
    """(fournisseur, clé). Une clé d'API l'emporte — c'est plus rapide ; sinon
    Whisper local, qui ne demande aucune clé et n'envoie rien nulle part."""
    if forced == "local":
        return ("local", None) if local_available() else None
    order = [forced] if forced else ["groq", "openai"]
    for name in order:
        if not name:
            continue
        _, _, env_name = WHISPER_ENDPOINTS[name]
        key = env_value(env_name)
        if key:
            return name, key
    if forced is None and local_available():
        return "local", None
    return None


def transcribe_local(audio: Path, model_name: str, language: str | None):
    """Whisper en local via faster-whisper. Aucune clé, aucun envoi réseau
    (hors téléchargement du modèle la première fois)."""
    from faster_whisper import WhisperModel

    log(f"Whisper local (modèle {model_name}) — première fois : téléchargement du modèle…")
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        str(audio), beam_size=1, vad_filter=True, language=language,
    )
    cues = [(float(s.start), s.text.strip()) for s in segments if s.text.strip()]
    return cues, getattr(info, "language", language)


def _multipart(fields: dict[str, str], file_path: Path) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    body = bytearray()
    for name, value in fields.items():
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode()
        body += f"{value}\r\n".encode()
    mime = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    body += f"--{boundary}\r\n".encode()
    body += (
        f'Content-Disposition: form-data; name="file"; filename="{file_path.name}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode()
    body += file_path.read_bytes()
    body += f"\r\n--{boundary}--\r\n".encode()
    return bytes(body), f"multipart/form-data; boundary={boundary}"


def whisper_chunk(backend: str, key: str, chunk: Path, offset: float) -> list[tuple[float, str]]:
    url, model, _ = WHISPER_ENDPOINTS[backend]
    body, content_type = _multipart(
        {"model": model, "response_format": "verbose_json", "timestamp_granularities[]": "segment"},
        chunk,
    )
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", content_type)
    with urllib.request.urlopen(req, timeout=600) as resp:
        payload = json.loads(resp.read().decode("utf-8", errors="replace"))
    segments = payload.get("segments") or []
    if segments:
        return [(float(s.get("start", 0.0)) + offset, str(s.get("text", "")).strip())
                for s in segments if str(s.get("text", "")).strip()]
    text = str(payload.get("text", "")).strip()
    return [(offset, text)] if text else []


def transcribe_with_whisper(
    video: Path,
    workdir: Path,
    forced: str | None,
    model_name: str = "base",
    language: str | None = None,
):
    chosen = pick_backend(forced)
    if not chosen:
        return None, None
    backend, key = chosen
    try:
        audio = extract_audio(video, workdir)
    except RuntimeError as exc:
        log(str(exc))
        return None, None

    if backend == "local":
        try:
            cues, detected = transcribe_local(audio, model_name, language)
        except Exception as exc:  # noqa: BLE001 — dépendance externe, on dégrade proprement
            log(f"Whisper local a échoué : {exc}")
            return None, None
        if not cues:
            return None, None
        return cues, f"whisper local ({model_name}, {detected or '?'})"

    parts = split_audio(audio, workdir)
    cues: list[tuple[float, str]] = []
    failures = 0
    for i, part in enumerate(parts):
        offset = i * WHISPER_CHUNK_SECONDS if len(parts) > 1 else 0.0
        try:
            cues.extend(whisper_chunk(backend, key, part, offset))
        except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError) as exc:
            failures += 1
            detail = ""
            if isinstance(exc, urllib.error.HTTPError):
                try:
                    detail = exc.read().decode(errors="replace")[:300]
                except Exception:  # noqa: BLE001
                    detail = ""
            log(f"Whisper ({backend}) a échoué sur le segment {i + 1}/{len(parts)} : {exc} {detail}")
    if not cues:
        return None, None
    suffix = f" (partiel : {failures}/{len(parts)} segments perdus)" if failures else ""
    return cues, f"whisper ({backend}){suffix}"


# --------------------------------------------------------------------------- #
# programme principal
# --------------------------------------------------------------------------- #

def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="video.py",
        description="Télécharge une vidéo, en extrait des trames et la transcription.",
    )
    ap.add_argument("source", help="URL de vidéo ou chemin d'un fichier local")
    ap.add_argument("--detail", choices=DETAILS, default=None,
                    help="transcript (aucune trame) | efficient (images-clés, max 50) | "
                         "balanced (scènes, max 100, défaut) | max (scènes, sans plafond)")
    ap.add_argument("--start", default=None, help="début de la plage (SS, MM:SS, HH:MM:SS)")
    ap.add_argument("--end", default=None, help="fin de la plage (SS, MM:SS, HH:MM:SS)")
    ap.add_argument("--timestamps", default=None,
                    help="horodatages absolus séparés par des virgules : une trame forcée à chacun")
    ap.add_argument("--max-frames", type=int, default=None, help="plafond de trames")
    ap.add_argument("--resolution", type=int, default=512, help="largeur des trames en px (défaut 512)")
    ap.add_argument("--fps", type=float, default=None, help="force la cadence d'échantillonnage (max 2)")
    ap.add_argument("--scene-threshold", type=float, default=None,
                    help="sensibilité de détection de scène (défaut 0.30, 0.15 en mode max)")
    ap.add_argument("--max-height", type=int, default=720,
                    help="hauteur max de la vidéo téléchargée (défaut 720)")
    ap.add_argument("--out-dir", default=None, help="répertoire de travail (défaut : tmp)")
    ap.add_argument("--no-dedup", action="store_true", help="garde les trames quasi identiques")
    ap.add_argument("--no-whisper", action="store_true", help="désactive le repli Whisper")
    ap.add_argument("--whisper", choices=["local", "groq", "openai"], default=None,
                    help="force le moteur de transcription (défaut : clé d'API si configurée, "
                         "sinon Whisper local)")
    ap.add_argument("--whisper-model", default=None,
                    help="modèle Whisper local : tiny | base (défaut) | small | medium | large-v3")
    ap.add_argument("--lang", default=None,
                    help="force la langue de la transcription locale (ex. fr) au lieu de la détecter")
    return ap


def main() -> int:
    args = build_parser().parse_args()

    for binary in ("ffmpeg", "ffprobe"):
        if shutil.which(binary) is None:
            raise SystemExit(f"{binary} est absent — lance `python3 .claude/skills/video/scripts/setup.py`")

    detail = args.detail or env_value("VIDEO_DETAIL") or "balanced"
    if detail not in DETAILS:
        detail = "balanced"
    cap = args.max_frames if args.max_frames is not None else FRAME_CAP[detail]
    if cap is not None and cap < 0:
        raise SystemExit("--max-frames doit être positif")

    start = parse_time(args.start)
    end = parse_time(args.end)
    if start is not None and end is not None and end <= start:
        raise SystemExit("--end doit être postérieur à --start")

    cues_forced = []
    if args.timestamps:
        cues_forced = [parse_time(t) for t in args.timestamps.split(",") if t.strip()]

    workdir = Path(args.out_dir).expanduser() if args.out_dir else Path(tempfile.mkdtemp(prefix="video-"))
    workdir.mkdir(parents=True, exist_ok=True)
    frames_dir = workdir / "frames"
    frames_dir.mkdir(exist_ok=True)

    source = args.source
    caption_file: Path | None = None
    caption_lang: str | None = None
    video_path: Path | None = None

    wants_frames = detail != "transcript" or bool(cues_forced)

    if is_url(source):
        if source.startswith("www."):
            source = "https://" + source
        log("sous-titres natifs…")
        caption_file, caption_lang = fetch_captions(source, workdir)
        if wants_frames or caption_file is None:
            log("téléchargement de la vidéo…")
            video_path = download_video(source, workdir, args.max_height)
    else:
        video_path = Path(source).expanduser()
        if not video_path.exists():
            raise SystemExit(f"fichier introuvable : {video_path}")
        for candidate in (video_path.with_suffix(".vtt"), video_path.with_suffix(".srt")):
            if candidate.exists():
                caption_file = candidate
                caption_lang = "local"
                break

    meta = probe(video_path) if video_path else {"duration": 0.0, "width": 0, "height": 0, "has_video": False}
    duration = meta["duration"]

    # ---- transcription -----------------------------------------------------
    transcript: list[tuple[float, str]] = []
    transcript_source = "aucune"
    if caption_file:
        transcript = parse_vtt(caption_file)
        if transcript:
            transcript_source = f"sous-titres ({caption_lang})"
    if not transcript and not args.no_whisper and video_path:
        log("pas de sous-titres — tentative Whisper…")
        model_name = args.whisper_model or env_value("VIDEO_WHISPER_MODEL") or "base"
        language = args.lang or env_value("VIDEO_WHISPER_LANG")
        cues, label = transcribe_with_whisper(
            video_path, workdir, args.whisper, model_name, language
        )
        if cues:
            transcript = cues
            transcript_source = label or "whisper"
    transcript = filter_range(transcript, start, end)

    # ---- trames ------------------------------------------------------------
    selected: list[tuple[float, str, bytes]] = []
    dropped = 0
    warnings: list[str] = []

    if wants_frames and video_path and meta["has_video"]:
        span_start = start or 0.0
        span_end = end if end is not None else (duration or 0.0)
        span = max(0.0, span_end - span_start) or duration
        focused = start is not None or end is not None
        budget = frame_budget(span, focused)
        if cap is not None:
            budget = min(budget, cap) if cap else budget
        fps = args.fps if args.fps is not None else auto_fps(span, budget)
        fps = min(fps, MAX_FPS)

        if detail == "transcript":
            candidates = []  # seules les trames forcées seront extraites
        else:
            threshold = args.scene_threshold
            if threshold is None:
                threshold = SCENE_THRESHOLD[detail]
            mode = "keyframe" if detail == "efficient" else "scene"
            candidates = analyse(video_path, mode, start, end, fps, threshold)
            if len(candidates) < 4:
                log(f"peu de {'images-clés' if mode == 'keyframe' else 'changements de scène'} — "
                    f"échantillonnage régulier à {fps:.2f} img/s")
                candidates = analyse(video_path, "uniform", start, end, fps, threshold)

            if not args.no_dedup:
                candidates, dropped = dedup(candidates, DEDUP_THRESHOLD)

            room = cap
            if room is not None:
                room = max(0, room - len(cues_forced))
                candidates = subsample(candidates, room)

        for ts in cues_forced:
            if start is not None and ts < start:
                warnings.append(f"horodatage forcé {format_time(ts)} hors plage — ignoré")
                continue
            if end is not None and ts > end:
                warnings.append(f"horodatage forcé {format_time(ts)} hors plage — ignoré")
                continue
            candidates.append((ts, "repère", b""))

        selected = sorted(candidates, key=lambda f: f[0])

        if duration > 600 and not focused:
            warnings.append(
                "vidéo de plus de 10 minutes : la couverture visuelle est clairsemée. "
                "Relance avec --start/--end sur la section utile pour plus de détail."
            )

    # ---- extraction --------------------------------------------------------
    written: list[tuple[float, str, Path]] = []
    for i, (ts, reason, _) in enumerate(selected, start=1):
        dest = frames_dir / f"f{i:04d}_t{int(ts * 10):07d}.jpg"
        if extract_frame(video_path, ts, dest, args.resolution):
            written.append((ts, reason, dest))

    # ---- rapport -----------------------------------------------------------
    out: list[str] = []
    out.append("# Vidéo")
    out.append("")
    out.append(f"- **Source** : {args.source}")
    if duration:
        out.append(f"- **Durée** : {format_time(duration)}")
    if meta["width"]:
        out.append(f"- **Définition source** : {meta['width']}x{meta['height']}")
    if start is not None or end is not None:
        out.append(f"- **Plage** : {format_time(start or 0)} → "
                   f"{format_time(end) if end is not None else 'fin'}")
    out.append(f"- **Détail** : {detail}")
    frame_line = f"- **Trames** : {len(written)}"
    if dropped:
        frame_line += f" ({dropped} quasi identiques écartées)"
    out.append(frame_line)
    out.append(f"- **Transcription** : {transcript_source}")
    out.append(f"- **Répertoire de travail** : {workdir}")
    out.append("")

    for w in warnings:
        out.append(f"> ⚠️ {w}")
    if warnings:
        out.append("")

    if written:
        out.append("## Trames — lis chacun de ces chemins avec Read")
        out.append("")
        dense = len(written) > 1 and (written[-1][0] - written[0][0]) / max(1, len(written) - 1) < 2
        for ts, reason, path in written:
            out.append(f"- `t={format_time(ts, precise=dense)}` ({reason}) — {path}")
        out.append("")

    out.append("## Transcription")
    out.append("")
    if transcript:
        for ts, text in transcript:
            out.append(f"[{format_time(ts)}] {text}")
    else:
        out.append("_Aucune transcription disponible._ Pas de sous-titres natifs, et aucun moteur "
                   "Whisper utilisable (repli désactivé, ou `faster-whisper` non installé et aucune "
                   "clé d'API). Pour l'activer sans clé : "
                   "`python3 .claude/skills/video/scripts/setup.py`. Les trames restent exploitables.")
    out.append("")

    sys.stdout.write("\n".join(out))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
