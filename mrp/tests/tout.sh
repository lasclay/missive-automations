#!/bin/sh
# Lance les huit suites. Aucune n'a besoin du réseau : la boucle agentique
# tourne contre une fausse API, seuls les outils touchent une vraie base.
set -e
cd "$(dirname "$0")"
node outils.js
node inventaire.js
node calendrier.js
node boucle.js
node rappels.js
node schemas.js
sh export.sh
sh e2e.sh
