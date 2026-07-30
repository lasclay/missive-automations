#!/bin/bash
# =============================================================================
# Hook Stop — empeche Claude de s'arreter tant que l'objectif n'est pas atteint.
#
# Enregistre dans .claude/settings.json du depot. Le hook Stop se declenche
# quand Claude a fini de repondre et s'apprete a rendre la main. En renvoyant
# {"decision":"block","reason":...} sur la sortie standard avec le code 0, on
# force Claude a continuer au lieu de s'arreter.
#
# DORMANT PAR DEFAUT. Il ne fait rien tant qu'une boucle n'est pas armee, sinon
# il forcerait Claude a « continuer a travailler » apres une simple question
# conversationnelle. On l'arme avec /autoloop.
#
# Deux garde-fous, parce que la doc est explicite : un hook Stop qui renvoie
# toujours block cree une boucle infinie.
#   1. Un plafond d'iterations (30 par defaut).
#   2. Un fichier d'objectif que Claude supprime lui-meme quand c'est fini.
# =============================================================================

set -u

INPUT=$(cat)
SESSION_ID=$(jq -r '.session_id // "inconnu"' <<<"$INPUT" 2>/dev/null || echo inconnu)
LAST_MSG=$(jq -r '.last_assistant_message // ""' <<<"$INPUT" 2>/dev/null || echo "")

GOAL_FILE="/tmp/claude-autoloop-${SESSION_ID}.goal"
COUNT_FILE="/tmp/claude-autoloop-${SESSION_ID}.count"
MAX_TOURS="${AUTOLOOP_MAX:-30}"

# Boucle non armee : comportement normal, Claude s'arrete quand il a fini.
[ -f "$GOAL_FILE" ] || exit 0

GOAL=$(cat "$GOAL_FILE" 2>/dev/null)

# Claude a annonce l'objectif atteint : on desarme et on laisse passer.
if grep -qiE 'OBJECTIF ATTEINT|AUTOLOOP TERMINE' <<<"$LAST_MSG"; then
  rm -f "$GOAL_FILE" "$COUNT_FILE"
  jq -nc '{
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: "Boucle autoloop desarmee : objectif declare atteint."
    }
  }'
  exit 0
fi

# Plafond d'iterations : on desarme plutot que de bruler des jetons sans fin.
COUNT=$(cat "$COUNT_FILE" 2>/dev/null || echo 0)
case "$COUNT" in ''|*[!0-9]*) COUNT=0 ;; esac
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNT_FILE"

if [ "$COUNT" -gt "$MAX_TOURS" ]; then
  rm -f "$GOAL_FILE" "$COUNT_FILE"
  jq -nc --arg n "$MAX_TOURS" '{
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: ("Boucle autoloop arretee : plafond de " + $n + " tours atteint sans que l objectif soit declare atteint. Fais le point sur ce qui reste et pourquoi ca bloque, plutot que de repartir.")
    }
  }'
  exit 0
fi

# Sinon : on bloque l'arret et on rappelle l'objectif.
jq -nc --arg goal "$GOAL" --arg n "$COUNT" --arg max "$MAX_TOURS" --arg gf "$GOAL_FILE" '{
  decision: "block",
  reason: ("Tu ne peux pas encore t arreter : la boucle autoloop est armee (tour " + $n + " sur " + $max + ").\n\nOBJECTIF :\n" + $goal + "\n\nReprends le travail la ou il en est. Verifie concretement ce qui reste a faire au lieu de le supposer : relis les fichiers, relance les tests, relance la commande. Delegue a des sous-agents en parallele ce qui est independant.\n\nQuand et seulement quand l objectif est reellement atteint et verifie, supprime le fichier " + $gf + " et termine ton message par la ligne OBJECTIF ATTEINT. N ecris pas cette ligne avant que ce soit vrai : c est ce qui desarme la boucle.\n\nSi tu es reellement bloque par quelque chose qui exige une decision humaine, dis-le explicitement et termine par OBJECTIF ATTEINT pour rendre la main — ne tourne pas a vide.")
}'
exit 0
