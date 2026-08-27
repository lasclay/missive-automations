# skills-compte

Miroir versionné des skills **de compte** de Lasclay, ceux qui vivent sur
claude.ai et non dans ce dépôt.

## Pourquoi ce dossier existe

Les skills du dépôt (`.claude/skills/`) sont dans git: on les modifie, on
commit, c'est réglé. Les skills de compte, eux, arrivent dans le conteneur par
une synchronisation **à sens unique** depuis claude.ai, dans
`~/.claude/skills/synced/`. Ce répertoire est éphémère et il n'existe aucune
commande pour renvoyer une modification vers le compte.

Conséquence: un skill de compte modifié pendant une session est perdu quand le
conteneur est recyclé, sauf si on en garde une copie ici.

Ce dossier n'est pas chargé comme skill (seul `.claude/skills/` l'est). C'est un
miroir de sauvegarde et de révision.

## Appliquer une modification sur le compte

Un fichier `.skill` (une archive zip) se dépose sur claude.ai dans
Réglages → Capacités → Skills.

```bash
python3 ~/.claude/skills/synced/skill-creator/scripts/package_skill.py \
  skills-compte/copywriting-lasclay ./dist
```

Le fichier produit remplace le skill du même nom sur le compte.

## Contenu

| Skill | Suivi depuis | Notes |
|---|---|---|
| `copywriting-lasclay` | 27 août 2026 | ajout de `references/arc-narratif.md` |

Les autres skills de compte (`lasclay-master`, `lasclay-seo`,
`finances-lasclay`, `bookkeeping-lasclay`, `drivepush`,
`missive-messenger-7jours`) ne sont pas miroités tant qu'on n'a pas besoin de
les modifier.
