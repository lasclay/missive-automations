#!/bin/sh
# Détecte puis croise, dans cet ordre : le croisement lit la sortie du détecteur.
cd "$(dirname "$0")" || exit 1
node detect.js && node croise.js
