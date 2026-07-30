#!/bin/bash
# Setup script de l environnement Cloud — missive-automations
# A coller dans le champ "Setup script" du dialogue d environnement sur claude.ai/code.
# Tourne en root avant le lancement de Claude Code. Doit sortir avec le code 0.

set -u

# 1. Regles de permission en settings UTILISATEUR : elles ne dependent pas du
#    dialogue de confiance de l espace de travail, contrairement a celles du depot.
mkdir -p /root/.claude
cat > /root/.claude/settings.json <<'JSON'
{
  "permissions": {
    "defaultMode": "auto",
    "allow": [
      "Bash",
      "Edit",
      "Write",
      "NotebookEdit",
      "WebFetch",
      "WebSearch",
      "Agent",
      "Skill",
      "Bash(node missive_client.js:*)",
      "Bash(node connectors_client.js:*)",
      "Bash(node finance_client.js:*)",
      "Bash(node klaviyo_export.js:*)",
      "Bash(node qbo_check.js:*)",
      "Bash(node qbo_import.js:*)",
      "Bash(node shopify_check.js:*)",
      "Bash(node shipstation_check.js:*)",
      "Bash(node support.js:*)",
      "Bash(node analyse.js:*)",
      "Bash(node digest.js:*)",
      "Bash(node filtrage.js:*)",
      "Bash(node revision.js:*)",
      "Bash(node revision_ia.js:*)",
      "Bash(MISSIVE_PROXY_URL=https://proxy-missive.onrender.com node missive_client.js:*)",
      "Bash(GENERAL_PROXY_URL=https://general-proxy-5muf.onrender.com node connectors_client.js:*)",
      "Bash(npm install)",
      "Bash(npm ci)",
      "Bash(npm test:*)",
      "Bash(npm run:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git fetch:*)",
      "Bash(git pull:*)",
      "Bash(git checkout:*)",
      "Bash(git rebase:*)",
      "mcp__github",
      "mcp__Shopify",
      "mcp__Klaviyo",
      "mcp__Notion",
      "mcp__Google_Calendar",
      "mcp__Google_Drive",
      "mcp__Claude_Code_Remote"
    ]
  }
}
JSON

# 2. Ceinture et bretelles : marquer l espace de travail comme approuve, ce qui
#    active aussi les regles committees dans .claude/settings.json du depot.
cat > /tmp/trust-workspace.js <<'JS'
const fs = require('fs');
const p = '/root/.claude.json';
const dir = process.argv[2];
let c = {};
try { c = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {}
c.projects = c.projects || {};
c.projects[dir] = c.projects[dir] || {};
c.projects[dir].hasTrustDialogAccepted = true;
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('workspace trust accorde:', dir);
JS
node /tmp/trust-workspace.js /home/user/missive-automations || true

# 3. Fuseau horaire du Quebec. Le conteneur demarre en UTC, ce qui decale
#    « aujourd hui » d un jour entre 20h et minuit heure de Montreal, et fausse
#    toute requete filtree par date (QBO, commandes Shopify, exercice fiscal).
#    Complete la variable TZ des reglages d environnement, qui couvre Node ;
#    ces deux lignes couvrent en plus les outils systeme comme date.
ln -snf /usr/share/zoneinfo/America/Montreal /etc/localtime || true
echo 'America/Montreal' > /etc/timezone || true

exit 0
