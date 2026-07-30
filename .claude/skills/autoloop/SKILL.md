---
name: autoloop
description: Arme une boucle de travail autonome : Claude ne rend plus la main tant que l'objectif nommé n'est pas atteint et vérifié, et délègue à des sous-agents ce qui est parallélisable. Sert aussi à désarmer la boucle ou à en consulter l'état.
when_to_use: Invoque à la main avec /autoloop suivi de l'objectif. À utiliser quand une tâche est longue ou en plusieurs étapes et que tu veux qu'elle aille jusqu'au bout sans revenir demander quoi faire ensuite. /autoloop stop désarme, /autoloop status montre l'état.
argument-hint: [objectif à atteindre] | stop | status
disable-model-invocation: true
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
  - Skill
---

# Boucle de travail autonome

Argument reçu : `$ARGUMENTS`

## Comment ça marche, et ce que ça exige

Le mécanisme n'est pas dans ce skill : c'est un hook `Stop` qui renvoie
`{"decision":"block"}` pour refuser que le tour se termine. Ce hook vit dans le dépôt
`lasclay/missive-automations`, à `.claude/hooks/keep-going.sh`, et il est enregistré dans le bloc
`hooks` de `.claude/settings.json`.

**Vérifie d'abord qu'il est là** : `ls .claude/hooks/keep-going.sh`. S'il est absent — session
hors de ce dépôt, ou dépôt pas encore à jour — alors armer la boucle ne fait rien du tout. Dis-le
franchement au lieu de laisser croire que la boucle tourne.

Deux fichiers d'état, dans `/tmp` :

- `/tmp/claude-autoloop-${CLAUDE_SESSION_ID}.goal` — l'objectif ; sa présence arme la boucle
- `/tmp/claude-autoloop-${CLAUDE_SESSION_ID}.count` — le compteur de tours

Le hook est dormant sans fichier d'objectif : sans ça, il forcerait Claude à « continuer à
travailler » après une simple question conversationnelle.

## Aiguillage selon l'argument

**`stop`** — supprime les deux fichiers, confirme en une ligne, arrête-toi. Rien d'autre.

**`status`** — affiche l'objectif courant et le numéro de tour s'ils existent, ou dis que rien
n'est armé. Arrête-toi.

**Sinon, l'argument est l'objectif.** Dans l'ordre :

1. Reformule-le en **critères de fin vérifiables**. Pas « améliorer le support », mais « les
   trois scripts passent leurs tests et sont poussés sur main ». Si l'objectif donné n'a aucun
   critère observable, demande-le maintenant : c'est le seul moment où s'arrêter pour demander
   est utile, une fois la boucle armée ce sera trop tard.
2. Écris ces critères dans le fichier d'objectif avec `Write`. C'est ce texte que le hook te
   réinjectera à chaque tour : écris-le pour ton toi futur — ce qu'il faut atteindre, comment le
   vérifier, ce qui est hors périmètre.
3. Supprime le fichier `.count` s'il existe, pour repartir de zéro.
4. Annonce en deux lignes l'objectif retenu et le plafond, puis **mets-toi au travail
   immédiatement dans le même tour**. N'attends aucune confirmation.

## Comment travailler pendant la boucle

- **Vérifie, ne suppose pas.** À chaque reprise, établis l'état réel avant d'agir : relis les
  fichiers, relance les tests, relance la commande. Le hook te réinjecte l'objectif, pas
  l'avancement — tu es seul à pouvoir le reconstituer.
- **Délègue en parallèle.** Ce qui est indépendant part en sous-agents lancés dans un seul
  message, pas en série. Les sous-agents ne peuvent pas en lancer d'autres dans cet
  environnement : découpe à un seul niveau.
- **Committe au fil de l'eau** sur une branche de travail. Le conteneur est éphémère, du travail
  non poussé est du travail perdu. Attention : sur ce dépôt, les services Render suivent `main`,
  donc une fusion dans `main` déclenche un redéploiement — ne fusionne pas à l'aveugle.
- **Ne contourne pas les garde-fous.** L'achat d'étiquette ShipStation, les écritures QuickBooks,
  l'envoi d'une réponse Missive et le `triggerevent` Omnisend demandent une confirmation par
  règle `permissions.ask`, y compris en mode auto. Si l'objectif en dépend, prépare tout le
  reste, puis demande — et traite cette attente comme un blocage à annoncer, pas comme une raison
  de tourner à vide.

## Comment sortir

Deux sorties, et tourner à vide n'en est pas une :

- **Objectif atteint et vérifié** — supprime le fichier d'objectif, puis termine ton message par
  la ligne `OBJECTIF ATTEINT`. C'est cette ligne qui désarme la boucle. Ne l'écris jamais avant
  que ce soit vrai.
- **Blocage réel exigeant une décision humaine** — dis lequel des critères n'est pas atteint et
  pourquoi, ce que tu as essayé, et termine aussi par `OBJECTIF ATTEINT` pour rendre la main
  proprement.

Au-delà de 30 tours la boucle se désarme d'elle-même et te demande de faire le point. Le plafond
se règle par la variable d'environnement `AUTOLOOP_MAX`.
