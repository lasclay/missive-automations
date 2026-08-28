# Skill `missive` (pour Claude Code)

Le skill qui apprend à un assistant à se servir du proxy, sans qu'il ait à fouiller le code
à chaque session.

## Installation

Copie le dossier dans les skills de ton projet :

```bash
mkdir -p .claude/skills
cp -r skill/missive .claude/skills/missive
```

Puis, dans une session Claude Code, `/missive` — ou laisse-le se déclencher tout seul dès
qu'il est question de la boîte de réception.

Il suppose que `client.js` est dans le répertoire courant et que `MISSIVE_PROXY_URL` et
`MISSIVE_PROXY_SECRET` sont dans l'environnement.

## Deux garde-fous à ajouter toi-même

Dans `.claude/settings.json` du projet, force la confirmation sur ce qui sort vers
l'extérieur — même en mode automatique :

```json
{
  "permissions": {
    "ask": [
      "Bash(node client.js reply:*)",
      "Bash(node client.js send:*)"
    ]
  }
}
```

## À compléter

La dernière section du `SKILL.md` est volontairement vide : ton de voix, règles de décision,
vérifications obligatoires avant de répondre, membres de l'équipe. C'est ce qui transforme un
accès à l'API en assistant réellement utile — et c'est propre à chaque boîte.
