#!/usr/bin/env bash
# Démarre le clone ShipStation en vérifiant d'abord ce qui doit l'être.
#
#   ./shipstation-clone/demarrer.sh              lecture seule, transporteur bouchon
#   ./shipstation-clone/demarrer.sh --etiquettes autorise l'ACHAT d'étiquettes (argent réel)
#
set -euo pipefail
cd "$(dirname "$0")/.."

rouge() { printf '\033[31m%s\033[0m\n' "$1"; }
vert()  { printf '\033[32m%s\033[0m\n' "$1"; }
gris()  { printf '\033[90m%s\033[0m\n' "$1"; }

# --- Node 22.5+ : l'application utilise node:sqlite, absent avant.
majeur=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
mineur=$(node -p 'process.versions.node.split(".")[1]' 2>/dev/null || echo 0)
if [ "$majeur" -lt 22 ] || { [ "$majeur" -eq 22 ] && [ "$mineur" -lt 5 ]; }; then
  rouge "Node 22.5 ou plus récent requis (node:sqlite). Version détectée : $(node -v 2>/dev/null || echo 'aucune')."
  gris  "  macOS   : brew install node@22"
  gris  "  Linux   : https://nodejs.org — ou nvm install 22"
  exit 1
fi
vert "Node $(node -v) — compatible."

# --- Secret du General Proxy : requis seulement pour la migration.
if [ -z "${GENERAL_PROXY_SECRET:-}" ]; then
  rouge "GENERAL_PROXY_SECRET absent — l'application démarrera, mais la migration depuis"
  rouge "ShipStation échouera (onglet Réglages)."
  gris  "  export GENERAL_PROXY_SECRET='…'   (le même que pour connectors_client.js)"
  echo
else
  vert "GENERAL_PROXY_SECRET présent — migration possible."
fi

# --- Cookies Secure : impossible en HTTP local, on les relâche si rien n'est précisé.
if [ -z "${CLONE_COOKIE_SECURE:-}" ]; then
  export CLONE_COOKIE_SECURE=0
  gris "Cookies non-Secure (HTTP local). En production HTTPS, laisser CLONE_COOKIE_SECURE par défaut."
fi

# --- Achat d'étiquettes : verrouillé sauf demande explicite.
if [ "${1:-}" = "--etiquettes" ]; then
  export CLONE_ALLOW_LABELS=1
  echo
  rouge "ACHAT D'ÉTIQUETTES ACTIVÉ."
  if [ "${CARRIER_ADAPTER:-bouchon}" = "bouchon" ]; then
    gris "Adaptateur « bouchon » : rien ne sera réellement acheté ni facturé."
  else
    rouge "Adaptateur « ${CARRIER_ADAPTER} » : les achats débiteront un vrai compte transporteur."
    printf 'Confirmer en tapant OUI : '
    read -r reponse
    [ "$reponse" = "OUI" ] || { echo "Annulé."; exit 1; }
  fi
  echo
fi

exec node --no-warnings shipstation-clone/app/server.js
