---
name: autoloop
description: Arme une boucle de travail autonome : Claude ne rend plus la main tant que l'objectif nommé n'est pas atteint et vérifié, et délègue à des sous-agents ce qui est parallélisable. Sert aussi à désarmer la boucle ou à en consulter l'état.
when_to_use: Invoque à la main avec /autoloop suivi de l'objectif. À utiliser quand une tâche est longue ou en plusieurs étapes et que tu veux qu'elle aille jusqu'au bout sans revenir demander quoi faire ensuite. /autoloop stop désarme, /autoloop status montre l'état.
argument-hint: [objectif à atteindre] | stop | status
disable-model-invocation: true
allowed-tools: Bash Read Write Edit Grep Glob Agent Skill
---

# Boucle de travail autonome

Argument reçu : `$ARGUMENTS`

Le fichier d'objectif est `/tmp/claude-autoloop-${CLAUDE_SESSION_ID}.goal`, et le
compteur de tours `/tmp/claude-autoloop-${CLAUDE_SESSION_ID}.count`. Le hook `Stop`
du dépôt (`.claude/hooks/keep-going.sh`) lit ces deux fichiers à chaque fin de tour.

## Aiguillage selon l'argument

**Si l'argument est `stop`** — supprime les deux fichiers, confirme en une ligne que la
boucle est désarmée, et arrête-toi. Ne fais rien d'autre.

**Si l'argument est `status`** — affiche l'objectif courant et le numéro de tour s'ils
existent, ou dis que rien n'est armé. Arrête-toi.

**Sinon, l'argument est l'objectif.** Fais exactement ceci, dans l'ordre :

1. Reformule l'objectif en critères de fin **vérifiables**. Pas « améliorer le support »,
   mais « les trois scripts passent leurs tests et sont poussés sur main ». Si l'objectif
   tel que donné n'a pas de critère de fin observable, demande-le maintenant : c'est le
   seul moment où s'arrêter pour demander est utile, une fois la boucle armée ce sera trop tard.
2. Écris ces critères dans le fichier d'objectif, avec `Write`. C'est ce texte que le hook
   te réinjectera à chaque tour, donc écris-le pour ton toi futur : ce qu'il faut atteindre,
   comment le vérifier, et ce qui est hors périmètre.
3. Remets le compteur à zéro : supprime le fichier `.count` s'il existe.
4. Annonce en deux lignes l'objectif retenu et le plafond de tours, puis **mets-toi au
   travail immédiatement** dans le même tour. N'attends pas de confirmation.

## Comment travailler pendant la boucle

- **Vérifie, ne suppose pas.** À chaque reprise, établis l'état réel avant d'agir : relis
  les fichiers, relance les tests, relance la commande. Le hook te réinjecte l'objectif,
  pas l'état d'avancement.
- **Délègue en parallèle.** Ce qui est indépendant part en sous-agents lancés dans un seul
  message, pas en série. Les sous-agents ne peuvent pas eux-mêmes en lancer d'autres dans
  cet environnement, donc découpe à un seul niveau.
- **Committe au fil de l'eau** sur la branche de travail. Le conteneur est éphémère : du
  travail non poussé est du travail perdu.
- **Ne contourne pas les garde-fous.** L'achat d'étiquette ShipStation, les écritures
  QuickBooks et l'envoi d'une réponse Missive demandent une confirmation par des règles
  `permissions.ask`, y compris en mode auto. Si l'objectif en dépend, prépare tout le
  reste, puis demande — et considère cette attente comme un blocage à annoncer, pas comme
  une raison de tourner à vide.

## Comment sortir

Deux sorties, et une seule est bonne :

- **L'objectif est atteint et vérifié** : supprime le fichier d'objectif, puis termine ton
  message par la ligne `OBJECTIF ATTEINT`. C'est cette ligne qui désarme la boucle. Ne
  l'écris jamais avant que ce soit vrai.
- **Tu es réellement bloqué** par une décision qui revient à l'humain : dis lequel des
  critères n'est pas atteint et pourquoi, ce que tu as essayé, et termine aussi par
  `OBJECTIF ATTEINT` pour rendre la main proprement. Tourner à vide en attendant est le
  seul échec réel.

Au-delà de 30 tours, la boucle se désarme d'elle-même et te demande de faire le point.
Le plafond se change avec la variable d'environnement `AUTOLOOP_MAX`.
