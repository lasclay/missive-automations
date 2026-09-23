#!/bin/sh
# Veilleur : relance la lecture jusqu'à ce qu'elle soit complète.
#
# `lire.js` abandonne un fil après cinq reculs successifs et passe au suivant —
# sinon une seule conversation malade bloquerait tout. Mais un fil abandonné
# n'a pas de fichier sur disque, donc la passe suivante le reprend. Relancer
# est donc à la fois sûr et utile : chaque tour rattrape les abandons du
# précédent, et le coût d'un tour qui ne trouve rien à faire est nul.
#
# On s'arrête quand un tour complet n'ajoute aucun fichier : il ne reste plus
# que des fils que Missive refuse durablement.
S="$(dirname "$0")"
DEPOT=/home/user/missive-automations
CIBLE=$(node -e "
const i=require('$S/index.json');
const R=[[1,/R&D|RETOURS|défectueux|conception produit|Quantité d'isolant/i],
         [2,/Pantoufles|Cache-cou petit|Tuque jaune|Verif grandeur|germination|quincaillerie/i],
         [3,/Réclamation|Cas à voir|review à traiter|MANTEAU|Usage et entretien|Use and care/i],
         [4,/Ventes - info pré-achat|Problèmes et erreurs|Problems and errors/i]];
const r=f=>{for(const[n,re]of R)if((f.labels||[]).some(l=>re.test(l)))return n;return 9};
console.log(Object.values(i.fils).filter(f=>r(f)<=4).length)")
echo "veilleur : cible $CIBLE fils" >> "$S/veilleur.log"

tour=0
while : ; do
  tour=$((tour+1))
  avant=$(ls "$S/fils" 2>/dev/null | wc -l)
  echo "$(date +%H:%M) tour $tour — $avant/$CIBLE" >> "$S/veilleur.log"
  [ "$avant" -ge "$CIBLE" ] && { echo "$(date +%H:%M) COMPLET" >> "$S/veilleur.log"; break; }
  (cd "$DEPOT" && node "$S/lire.js" >> "$S/lire.out" 2>&1)
  apres=$(ls "$S/fils" 2>/dev/null | wc -l)
  if [ "$apres" -le "$avant" ]; then
    echo "$(date +%H:%M) tour $tour sans progrès ($apres) — pause 15 min" >> "$S/veilleur.log"
    sleep 900
    apres2=$(ls "$S/fils" 2>/dev/null | wc -l)
    [ "$tour" -gt 3 ] && [ "$apres2" -le "$avant" ] && {
      echo "$(date +%H:%M) trois tours sans progrès — arrêt" >> "$S/veilleur.log"; break; }
  fi
done
