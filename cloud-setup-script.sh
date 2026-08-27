#!/bin/bash
# =============================================================================
# Setup script — Lasclay / missive-automations
# A coller dans le champ « Setup script » du dialogue d environnement sur
# claude.ai/code (dernier champ). Tourne en root AVANT le lancement de Claude
# Code, doit sortir 0. Son resultat est mis en cache sous forme d instantane du
# systeme de fichiers : il ne retourne que si tu le modifies, si tu changes les
# domaines reseau, ou apres ~7 jours.
#
# Les skills NE SONT PLUS ici. Ils vivent dans .claude/skills/ du depot, qui est
# clone dans chaque session cloud et lu aussi en local. Les ecrire depuis ce
# script les rendait invisibles a git, impossibles a diffuser en local, et les
# avait fait deriver de la copie du depot dans les deux sens.
#
# Ce qui doit RESTER ici : le bloc autoMode. Le classificateur ne lit jamais
# autoMode depuis .claude/settings.json du depot — un depot committe pourrait
# sinon s auto-autoriser. Settings utilisateur uniquement.
#
# Il fait deux choses :
#   1. pose les permissions et le contexte du classificateur en settings
#      utilisateur, seul endroit d ou autoMode est lu
#   2. regle la confiance de l espace de travail et le fuseau du Quebec
# =============================================================================
set -u

# --- 1. Settings utilisateur ----------------------------------------------
# mkdir indispensable : l ancien script creait /root/.claude en passant, via le
# mkdir des skills. Sans lui, l ecriture ci-dessous echoue en silence.
mkdir -p /root/.claude
cat > /root/.claude/settings.json <<'JSON'
{
  "outputStyle": "Concis",
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
    ],
    "ask": [
      "Bash(node connectors_client.js shipstation createlabel:*)",
      "Bash(node connectors_client.js shipstation createlabelfororder:*)",
      "Bash(node connectors_client.js shipstation deleteorder:*)",
      "Bash(node finance_client.js create:*)",
      "Bash(node finance_client.js update:*)",
      "Bash(node finance_client.js remove:*)",
      "Bash(node missive_client.js reply:*)",
      "Bash(node connectors_client.js omnisend triggerevent:*)"
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

# --- 1b. Style de sortie ---------------------------------------------------
# Le style "Concis" ci-dessus est defini dans le depot, .claude/output-styles/,
# donc versionne et lu aussi en local. Claude Code ne cherche les styles du
# depot que si la session demarre dans ce dossier ; on le lie dans les settings
# utilisateur pour que "Concis" existe aussi depuis nimporte quel autre dossier.
# Un lien, pas une copie : le depot reste la seule source de verite, comme pour
# les skills. Le lien peut pendre au moment de linstantane, il se resout a
# lexecution une fois le depot clone.
mkdir -p /root/.claude/output-styles
ln -snf /home/user/missive-automations/.claude/output-styles/concis.md \
        /root/.claude/output-styles/concis.md || true

# --- 2. Confiance de l espace de travail + fuseau -------------------------
cat > /tmp/t.js <<'JS'
const fs=require('fs'),p='/root/.claude.json',d='/home/user/missive-automations';
let c={};try{c=JSON.parse(fs.readFileSync(p,'utf8'))}catch(e){}
c.projects=c.projects||{};c.projects[d]=c.projects[d]||{};
c.projects[d].hasTrustDialogAccepted=true;
fs.writeFileSync(p,JSON.stringify(c,null,2));
JS
node /tmp/t.js || true
ln -snf /usr/share/zoneinfo/America/Montreal /etc/localtime || true
echo 'America/Montreal' > /etc/timezone || true
echo "--- setup Lasclay ---"
node -e '
const u=require("/root/.claude/settings.json");
let p={};try{p=require("/home/user/missive-automations/.claude/settings.json")}catch(e){}
// Le depot lemporte sur lutilisateur pour defaultMode — SAUF "auto", que Claude
// Code ignore depuis .claude/settings.json pour quun depot ne se laccorde pas.
const dep=(p.permissions||{}).defaultMode;
const eff=(dep && dep!=="auto") ? dep : u.permissions.defaultMode;
console.log("  mode utilisateur:",u.permissions.defaultMode,"| depot:",dep||"(non defini)");
if(dep==="auto") console.log("  ATTENTION      : \"auto\" dans le depot est ignore — a retirer");
console.log("  mode EFFECTIF  :",eff);
console.log("  ask (fusionne) :",new Set([...(u.permissions.ask||[]),...((p.permissions||{}).ask||[])]).size,"regles");
console.log("  autoMode       :",u.autoMode?"present (settings utilisateur)":"ABSENT");
' || true
echo "  style de sortie: $(node -e 'console.log(require("/root/.claude/settings.json").outputStyle||"(defaut)")' 2>/dev/null) | definition: $(test -r /root/.claude/output-styles/concis.md && echo trouvee || echo MANQUANTE)"
echo "  skills du depot: $(ls -d /home/user/missive-automations/.claude/skills/*/ 2>/dev/null | wc -l)"
echo "  date locale: $(date "+%Y-%m-%d %H:%M %Z")"
exit 0
