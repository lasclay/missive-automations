#!/bin/bash
# Dépôt des pièces RSDE 2026 dans le Drive, via le pousseur Apps Script.
# Usage: push_drive.sh <dossierId> <fichier> [nom]
set -u
S="$(cd "$(dirname "$0")" && pwd)"
DOSSIER="$1"; FICHIER="$2"; NOM="${3:-$(basename "$FICHIER")}"
NOM_ENC=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$NOM")
TMP=$(mktemp)
base64 -w0 "$FICHIER" > "$TMP"
for essai in 1 2 3; do
  LOC=$(curl -sS -i -X POST -H 'Content-Type: text/plain' --data-binary @"$TMP" \
        "$LASCLAY_DRIVE_PUSH_URL?token=$LASCLAY_DRIVE_PUSH_TOKEN&folder=$DOSSIER&name=$NOM_ENC" \
        | grep -i '^location:' | tr -d '\r' | sed 's/^[Ll]ocation: //')
  if [ -n "$LOC" ]; then
    REP=$(curl -sS "$LOC")
    case "$REP" in
      status:200:*) echo "OK   $NOM"; rm -f "$TMP"; exit 0 ;;
      *)            echo "REFUS $NOM -> $REP" ;;
    esac
  fi
  sleep $((essai * 2))
done
echo "ECHEC $NOM"
rm -f "$TMP"
exit 1
