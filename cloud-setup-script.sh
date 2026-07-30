#!/bin/bash
# =============================================================================
# Setup script de l'environnement Cloud — Lasclay / missive-automations
#
# A coller dans le champ « Setup script » du dialogue d'environnement, sur
# claude.ai/code (dernier champ, sous « Environment variables »).
#
# Tourne en root sur Ubuntu 24.04, AVANT le lancement de Claude Code, et doit
# sortir avec le code 0 sinon la session ne demarre pas. Il ne retourne pas a
# chaque session : son resultat est mis en cache sous forme d'instantane du
# systeme de fichiers, et il est relance seulement si tu modifies ce script, si
# tu changes les domaines reseau autorises, ou apres ~7 jours.
#
# Ce qui est ici et nulle part ailleurs : les settings UTILISATEUR. Deux raisons.
#   1. Les regles permissions.allow du depot sont ignorees tant que l'espace de
#      travail n'est pas approuve ; celles des settings utilisateur s'appliquent
#      sans cette etape.
#   2. Le bloc autoMode n'est JAMAIS lu depuis .claude/settings.json du depot,
#      par conception : un depot ne doit pas pouvoir s'auto-autoriser.
# =============================================================================

set -u

CLAUDE_HOME=/root/.claude
PROJECT_DIR=/home/user/missive-automations

mkdir -p "$CLAUDE_HOME"

# -----------------------------------------------------------------------------
# 1. Settings utilisateur : mode de permission, regles, classificateur, env.
#
#    defaultMode "auto" est le maximum atteignable en session Cloud :
#    bypassPermissions n'y est pas disponible et est ignore silencieusement
#    depuis un fichier de settings. En mode auto il n'y a aucun prompt de
#    routine ; un classificateur juge les actions en arriere-plan.
#
#    A savoir : le mode auto suspend les octrois larges d'execution de code
#    arbitraire (Bash nu, Agent, interpreteurs avec joker) et ne conserve que
#    les regles etroites. C'est pour ca que la liste enumere chaque script du
#    depot au lieu de se contenter de "Bash".
# -----------------------------------------------------------------------------
cat > "$CLAUDE_HOME/settings.json" <<'JSON'
{
  "outputStyle": "Proactive",
  "env": {
    "TZ": "America/Montreal",
    "GENERAL_PROXY_URL": "https://general-proxy-5muf.onrender.com",
    "MISSIVE_PROXY_URL": "https://proxy-missive.onrender.com"
  },
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
      "Bash(node archive.js:*)",
      "Bash(node merge.js:*)",
      "Bash(node repartition_merge.js:*)",
      "Bash(node admin_ops.js:*)",
      "Bash(node prevente.js:*)",
      "Bash(node draftrefresh.js:*)",
      "Bash(node nettoyage.js:*)",
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
      "Bash(git merge:*)",
      "Bash(git rebase:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "mcp__github",
      "mcp__Shopify",
      "mcp__Klaviyo",
      "mcp__Notion",
      "mcp__Google_Calendar",
      "mcp__Google_Drive",
      "mcp__Claude_Code_Remote"
    ]
  },
  "autoMode": {
    "environment": [
      "$defaults",
      "Organization: Lasclay, marque quebecoise de produits isoles a la soie d'asclepiade, vendus en ligne sur lasclay.com en francais et en anglais. Primary use of Claude Code: automatisation du service client, des operations d'expedition et de la tenue de livres, en plus du developpement logiciel.",
      "Source control: GitHub, organisation lasclay. Le depot de travail est lasclay/missive-automations. Repository visibility: prive.",
      "Key internal services: trois proxys d'API heberges sur Render, qui sont l'infrastructure normale et attendue de ce depot et non des destinations externes. General Proxy a general-proxy-5muf.onrender.com pour ShipStation, Omnisend et Klaviyo. Missive Proxy a proxy-missive.onrender.com pour la boite support. Finance Proxy sur un service Render dedie pour QuickBooks Online. Les appeler avec leur secret depuis les scripts du depot est l'operation courante attendue.",
      "Trusted internal domains: *.onrender.com pour les trois proxys ci-dessus, lasclay.com et ses sous-domaines, la boutique Shopify de Lasclay, mail.missiveapp.com.",
      "Secrets management: les cles d'API des services tiers vivent uniquement en variables d'environnement cote Render, jamais dans le depot ni dans l'environnement Claude. L'environnement de session porte seulement les secrets d'appel des proxys, GENERAL_PROXY_SECRET, MISSIVE_PROXY_SECRET et FINANCE_PROXY_SECRET. Les envoyer au proxy correspondant en en-tete X-Proxy-Secret est leur usage prevu, pas une exfiltration.",
      "CI/CD deploy targets: les services Render suivent la branche main. Une fusion dans main declenche donc un redeploiement. Les fichiers de configuration Claude, sous .claude/, et cloud-setup-script.sh ne touchent aucun service.",
      "Sensitive data locations & audiences: les donnees personnelles des clients vivent dans Shopify, Missive, Klaviyo et Omnisend. Elles peuvent circuler entre ces systemes et le depot prive pour le travail de support et de migration, mais jamais vers une destination publique, un paste, un gist ni un depot public.",
      "Sensitive remote targets: le Finance Proxy et QuickBooks Online portent la comptabilite reelle. ShipStation engage de l'argent reel a l'achat d'une etiquette d'expedition.",
      "Additional context: exercice fiscal du 1er septembre au 31 aout. Les ecritures comptables et les achats d'etiquettes sont irreversibles ou couteux et restent soumis a confirmation par les regles permissions.ask ci-dessous, meme en mode auto."
    ],
    "allow": [
      "$defaults",
      "Appeler les trois proxys Render de Lasclay avec leur secret d'environnement est autorise : c'est le mecanisme d'acces normal de ce depot, concu precisement pour garder les cles d'API hors de l'environnement Claude.",
      "Lire et ecrire dans la boite support Missive, dans Shopify et dans ShipStation en lecture est autorise : c'est le travail courant des automatisations de ce depot.",
      "Fusionner une branche de travail dans main et pousser est autorise : c'est le mecanisme de deploiement documente du projet."
    ]
  }
}
JSON

# -----------------------------------------------------------------------------
# 2. Garde-fous qui survivent au mode auto.
#
#    Une regle permissions.ask est evaluee AVANT le classificateur et force un
#    prompt dans tous les modes, y compris auto. C'est le seul moyen de garder
#    un point d'arret humain sur les actions couteuses ou irreversibles tout en
#    n'ayant aucun prompt sur le reste.
#
#    Fichier separe : ainsi une regeneration de la liste allow ci-dessus ne peut
#    pas emporter les garde-fous par accident.
# -----------------------------------------------------------------------------
cat > /tmp/merge-ask-rules.js <<'JS'
const fs = require('fs');
const p = '/root/.claude/settings.json';
const s = JSON.parse(fs.readFileSync(p, 'utf8'));
s.permissions.ask = [
  // ShipStation : achat d'etiquette = argent reel sur le wallet.
  "Bash(node connectors_client.js shipstation createlabel:*)",
  "Bash(node connectors_client.js shipstation createlabelfororder:*)",
  // ShipStation : destructeur.
  "Bash(node connectors_client.js shipstation deleteorder:*)",
  // QuickBooks : ecritures comptables, remove est irreversible.
  "Bash(node finance_client.js create:*)",
  "Bash(node finance_client.js update:*)",
  "Bash(node finance_client.js remove:*)",
  // Missive : reply part vers le client.
  "Bash(node missive_client.js reply:*)",
  // Omnisend : triggerevent declenche de vrais envois.
  "Bash(node connectors_client.js omnisend triggerevent:*)",
];
fs.writeFileSync(p, JSON.stringify(s, null, 2));
console.log('  garde-fous permissions.ask :', s.permissions.ask.length, 'regles');
JS
node /tmp/merge-ask-rules.js || true

# -----------------------------------------------------------------------------
# 3. Approuver l'espace de travail.
#
#    Sans ce drapeau, les regles permissions.allow committees dans
#    .claude/settings.json du depot sont lues puis ignorees, avec l'avertissement
#    « this workspace has not been trusted ». Les hooks du depot, eux, tournent.
#    Verifie en session : sans ce drapeau, 42 regles etaient inertes.
# -----------------------------------------------------------------------------
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
console.log('  espace de travail approuve :', dir);
JS
node /tmp/trust-workspace.js "$PROJECT_DIR" || true

# -----------------------------------------------------------------------------
# 4. Fuseau horaire du Quebec.
#
#    Le conteneur demarre en UTC. Verifie en session : le systeme indiquait le
#    30 juillet alors qu'il etait encore le 29 a 21h31 a Montreal. Tout
#    « aujourd'hui » entre 20h et minuit est donc decale d'un jour, ce qui fausse
#    les requetes filtrees par date et les bornes de l'exercice fiscal.
#    La variable TZ du bloc env ci-dessus couvre Node ; ces deux lignes couvrent
#    les outils systeme comme date.
# -----------------------------------------------------------------------------
ln -snf /usr/share/zoneinfo/America/Montreal /etc/localtime || true
echo 'America/Montreal' > /etc/timezone || true

# -----------------------------------------------------------------------------
# 5. Verification, visible dans le journal de provisionnement de la session.
# -----------------------------------------------------------------------------
echo "--- setup Lasclay ---"
node -e '
  const s = require("/root/.claude/settings.json");
  console.log("  mode              :", s.permissions.defaultMode);
  console.log("  regles allow      :", s.permissions.allow.length);
  console.log("  autoMode env      :", s.autoMode.environment.length, "entrees");
  console.log("  variables env     :", Object.keys(s.env).join(", "));
  console.log("  style de sortie   :", s.outputStyle);
' || true
echo "  date locale       : $(date '+%Y-%m-%d %H:%M %Z')"
echo "---------------------"

exit 0
