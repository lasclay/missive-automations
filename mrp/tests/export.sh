#!/bin/sh
# La route d'export : elle n'existe pas sans jeton, elle refuse un mauvais
# jeton, et elle ne laisse sortir aucune donnée personnelle.
set -e
cd "$(dirname "$0")/../../../../../home/user/missive-automations/mrp" 2>/dev/null || cd /home/user/missive-automations/mrp
DB=$(mktemp -d)/e.db; export MRP_DB="$DB"
JETON="jeton-de-test-assez-long-pour-passer-le-minimum"
ok(){ printf "  [OK ] %s\n" "$1"; }
ko(){ printf "  [ÉCHEC] %s\n" "$1"; kill $S1 $S2 2>/dev/null; exit 1; }
node mrp.js demo >/dev/null 2>&1

# --- sans jeton : la route n'existe pas
PORT=3901 MRP_SANS_AMORCE=1 MRP_SANS_RAPPELS=1 node --no-warnings server.js >/dev/null 2>&1 & S1=$!
sleep 1.5
# Ce qui compte n'est pas le code renvoyé — l'app redirige toute adresse
# inconnue vers la connexion — mais qu'AUCUNE donnée ne sorte.
R=$(curl -s http://localhost:3901/export.json)
C=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3901/export.json)
{ [ "$C" != 200 ] && ! echo "$R" | grep -q '"avancement"'; } \
  && ok "sans jeton configuré, la route ne sort rien ($C)" \
  || ko "la route sort des données sans jeton ($C)"
kill $S1 2>/dev/null; wait $S1 2>/dev/null || true

# --- jeton trop court : refusé au démarrage, route toujours absente
PORT=3902 MRP_JETON_EXPORT=court MRP_SANS_AMORCE=1 MRP_SANS_RAPPELS=1 \
  node --no-warnings server.js >/dev/null 2>&1 & S2=$!
sleep 1.5
R=$(curl -s http://localhost:3902/export.json)
C=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3902/export.json?jeton=court")
{ [ "$C" != 200 ] && ! echo "$R" | grep -q '"avancement"'; } \
  && ok "un jeton trop court n'arme pas la route" \
  || ko "jeton court accepté ($C)"
kill $S2 2>/dev/null; wait $S2 2>/dev/null || true

# --- armée
PORT=3903 MRP_JETON_EXPORT="$JETON" MRP_SANS_AMORCE=1 MRP_SANS_RAPPELS=1 \
  node --no-warnings server.js >/dev/null 2>&1 & S2=$!
sleep 1.5
B=http://localhost:3903
C=$(curl -s -o /dev/null -w '%{http_code}' $B/export.json)
[ "$C" = 401 ] && ok "armée mais sans jeton fourni : 401" || ko "401 attendu ($C)"

C=$(curl -s -o /dev/null -w '%{http_code}' "$B/export.json?jeton=mauvais")
[ "$C" = 401 ] && ok "mauvais jeton refusé" || ko "mauvais jeton accepté ($C)"

C=$(curl -s -o /dev/null -w '%{http_code}' -H "X-MRP-Jeton: $JETON" $B/export.json)
[ "$C" = 200 ] && ok "bon jeton en en-tête : 200" || ko "bon jeton refusé ($C)"

J=$(curl -s "$B/export.json?jeton=$JETON")
echo "$J" | grep -q '"numero"' && ok "l'export porte l'ordre et ses items" \
  || ko "export vide"
echo "$J" | grep -q '"avancement"' && ok "il porte l'avancement déclaré" || ko "avancement absent"
echo "$J" | grep -q '"variantes"' && ok "il porte la répartition par variante" || ko "variantes absentes"
echo "$J" | grep -q '"silence_atelier"' && ok "il dit depuis quand l'atelier se tait" || ko "silence absent"

# --- rien de personnel ne sort. C'est la garantie qui compte : cette route
# est lisible par quiconque tient le jeton.
for mot in mdp_hash courriel utilisateurs jeton mot_de_passe; do
  echo "$J" | grep -qi "\"$mot\"" && ko "l'export laisse fuir « $mot »"
done
ok "aucun compte, aucune adresse, aucun secret dans l'export"
# Le texte des signalements clients n'a rien à faire là non plus.
echo "$J" | grep -qi '"bris"' && ko "les signalements clients sortent" \
  || ok "les signalements clients restent dans l'app"

kill $S2 2>/dev/null; wait $S2 2>/dev/null || true
echo "  Export : conforme."
