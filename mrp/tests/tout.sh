#!/bin/sh
# Lance les quatre suites. Aucune n'a besoin du réseau : la boucle agentique
# tourne contre une fausse API, seuls les outils touchent une vraie base.
set -e
cd "$(dirname "$0")"
node outils.js
node inventaire.js
node boucle.js
sh e2e.sh
