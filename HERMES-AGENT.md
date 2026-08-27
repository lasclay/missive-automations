# Hermes Agent chez Lasclay — dossier d'évaluation

Monté le 2026-08-26. Périmètre : le dépôt `missive-automations` tel qu'il est aujourd'hui.
Version mise en page : artefact publié (voir le lien remis avec ce dossier).

> **En une phrase.** Hermes n'est pas un remplaçant de Claude Code — c'est la pièce qui manque
> *entre* les sessions : un processus résident qui garde la mémoire, écrit ses propres skills,
> tient son propre cron et parle sur WhatsApp, Signal, SMS et courriel. Là où Lasclay perd
> aujourd'hui, ce n'est pas dans la qualité d'une réponse, c'est dans ce qui s'oublie d'un tir de
> Routine à l'autre. Un pilote en lecture seule sur un VPS à 6 $/mois suffit à trancher en deux
> semaines. Rien de ce qui touche l'argent ne devrait y passer avant.

---

## 1. Ce que c'est

Agent open source de **Nous Research** (le laboratoire des modèles Hermes, Nomos, Psyche),
licence **MIT**, sorti en février 2026. NVIDIA lui attribue 140 000+ étoiles GitHub en moins de
trois mois et la première place des agents sur OpenRouter — chiffres promotionnels, à lire comme
un signal d'adoption, pas comme une mesure.

La différence de forme compte plus que la différence de qualité. Claude Code s'ouvre, travaille,
se referme. Hermes **tourne** : un seul processus qui héberge la mémoire, les skills,
l'ordonnanceur et une passerelle de messagerie, et qui se souvient de la session d'hier.

| Fonction | Ce que c'est |
| --- | --- |
| **Mémoire** | `MEMORY.md` (faits d'environnement, conventions) + `USER.md` (préférences), plus une base SQLite indexée FTS5 sur **toutes** les conversations passées, CLI et messagerie. Recherche ~20 ms. Option `write_approval` : rien ne s'écrit sans revue. |
| **Skills** | Format `SKILL.md` + frontmatter YAML, standard ouvert **agentskills.io** — le même que les six skills de `.claude/skills/`. L'agent les crée et les corrige via `skill_manage`. Chargement progressif à trois niveaux. |
| **Cron** | Tâches en langage naturel ou expression cron, un skill attaché et un modèle épinglé par tâche, livraison vers n'importe quelle plateforme, suivi des échecs consécutifs, accusé d'incident. |
| **Passerelle** | 25+ plateformes depuis un seul processus : Telegram, Discord, Slack, **WhatsApp, Signal, SMS, courriel**, Teams, Matrix, iMessage, LINE. Liste blanche obligatoire — sans allowlist, tout le monde est refusé. |
| **Sous-agents** | `delegate_task` ouvre des agents enfants à contexte isolé, outils restreints, terminal propre. Trois en parallèle par défaut. |
| **Code exécutable** | `execute_code` : l'agent écrit du Python qui appelle ses propres outils par RPC. Un pipeline de dix étapes s'effondre en un tour de modèle. |
| **MCP** | stdio, HTTP, SSE. OAuth 2.1 (PKCE + rafraîchissement), mTLS, filtrage des outils par glob. Secrets dans `~/.hermes/.env` en 0600 ; les sous-processus MCP ne reçoivent que les variables autorisées. |
| **Exécution** | Sept environnements : local, Docker, SSH, Singularity, Modal, Daytona, Vercel Sandbox. |
| **Modèles** | N'importe lequel : Nous Portal (300+), OpenRouter, OpenAI, Anthropic, endpoint maison, ou **local** (Qwen 3.6 27B/35B sur RTX via Ollama ou llama.cpp). Routage, repli automatique, pools de clés, cache de préfixe 1 h pour Claude. |
| **Contexte** | Lit `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `SOUL.md` — **et les analyse contre l'injection de prompt** avant inclusion. |

S'ajoutent : hooks d'événements, traitement par lots sur des milliers de prompts, points de
restauration avant modification de fichier, serveur HTTP compatible OpenAI, mode vocal avec mot
de réveil, automatisation de navigateur, vision, génération d'images, et un « mode bot » qui fait
collaborer plusieurs bots spécialisés dans une même conversation de groupe.

**Sécurité** — huit couches : listes blanches et appairage par DM, approbation des commandes
dangereuses (*smart* / *manuel* / *off*, avec une liste noire irréductible), protection des
écritures de fichiers (`HERMES_WRITE_SAFE_ROOT`, chemins sensibles toujours bloqués), isolation
conteneur, filtrage des identifiants pour les sous-processus MCP, analyse des fichiers de
contexte contre l'injection, isolation entre sessions, assainissement des entrées. Plus :
protection SSRF, scan pré-exécution Tirith, détection de paquets compromis au démarrage.
`cron_mode: deny` et `single_query_mode: deny` par défaut.

---

## 2. Le décalage avec ce qui tourne déjà

Le dépôt n'est pas un terrain vierge : `support.js` en v2.34, trois proxys Render isolés, un
remplacement maison d'A2X, un clone ShipStation testé sur 39 000 commandes réelles, un MRP
Québec–Tunisie, trois Routines qui traitent ~200 commentaires Facebook par jour, six skills
écrits à la main. Ce qui manque n'est pas de la capacité — c'est de la **persistance**.

| Fonction | Aujourd'hui | Ce que Hermes change |
| --- | --- | --- |
| Mémoire entre les tirs | Aucune. Chaque Routine ouvre une session neuve ; ce qui n'est pas commité dans un `.md` meurt avec la session. | Mémoire curée + recherche plein texte sur tout l'historique. |
| Apprentissage | Manuel. 34 versions de `support.js` encodent des leçons qu'un humain a transcrites. | `skill_manage` dépose la leçon lui-même, en attente de revue. |
| Canaux | Missive, Facebook via proxy. Pas de WhatsApp, pas de Signal, pas de SMS. | 25+ plateformes depuis un processus, avec liste blanche. |
| Ordonnancement | Render Cron + Routines. Le passage à l'heure normale se corrige à la main. | Cron interne : validation avant tir, streak d'échecs, modèle épinglé. |
| Registre des gestes promis | `SUIVI-SUPPORT.md`, tenu à la main — parce que l'API Missive ne relit pas ses tâches. | État interrogeable, réconcilié contre ShipStation et Shopify. |
| Coût par tir | Sonnet rédige, Opus relit, 3×/jour, sur chaque fil ouvert. | Triage sur modèle local à coût marginal nul, Opus réservé aux escalades. |

---

## 3. Sept usages concrets

Chacun est ancré sur un fichier qui existe déjà. Aucun n'est hypothétique.

### A — Le registre des gestes promis se tient tout seul
`SUIVI-SUPPORT.md`

**Aujourd'hui.** Dix-huit gestes promis vivent dans un markdown tenu à la main, avec cette note
en tête : « c'est ce fichier qui fait foi, pas les tâches Missive ». Il existe parce que
`POST /posts` ne rend pas d'identifiant de tâche et que `GET /posts/:id` répond 404 — on ne peut
pas vérifier qu'une tâche existe. Trois doublons créés sur le dossier Paulette Pratte.

**Avec Hermes.** Chaque promesse s'écrit en mémoire au moment où elle est faite. Une tâche cron à
7 h relit le registre, croise chaque ligne contre ShipStation et Shopify par MCP, pousse sur
Signal seulement ce qui est encore ouvert, avec ce qui a bougé. Le `failure_streak` fait crier la
tâche quand elle cesse de fonctionner, au lieu de la laisser mourir en silence.

**Gain.** Aucune promesse ne tombe. Le poste « garder l'état à jour » sort du temps de Gabriel.

### B — La v2.35 de `support.js` s'écrit elle-même
`support.js`, `connaissance_support.md`

**Aujourd'hui.** Opus relit chaque brouillon candidat et rétrograde ce qui ne passe pas. Ce refus
est le signal le plus précieux du système — et il finit dans les logs. La leçon ne devient une
règle que si quelqu'un la transcrit.

**Avec Hermes.** Une tâche de nuit relit les refus du jour et fait un `patch` sur le skill
concerné (`support`, voix de marque, les 224 réponses types). Avec `skills.write_approval` actif,
rien n'est commité : les modifications attendent dans `/skills pending`, approuvées ou rejetées
en deux minutes le matin.

**Gain.** La boucle « erreur réelle → règle encodée » passe de plusieurs semaines à une nuit,
sans céder le contrôle éditorial.

### C — Le proxy général répond sur Signal
`connectors_client.js`

**Aujourd'hui.** « Où est le colis de L-50488 ? » exige d'ouvrir une session Claude Code. En
pratique : attendre Gabriel.

**Avec Hermes.** Le proxy général devient un serveur MCP avec filtrage par glob — seules les
actions de lecture sont exposées. Catherine écrit sur Signal à 19 h, obtient la réponse. La liste
blanche limite l'accès ; l'approbation des commandes dangereuses fait escalader « achète
l'étiquette » au lieu de l'exécuter.

**Gain.** Le délai de réponse à une question opérationnelle passe du prochain jour ouvrable à
quelques minutes, sans embaucher.

### D — Le backlog Facebook cesse d'être partitionné
`fb-backlog/ROUTINE.md`

**Aujourd'hui.** Trois Routines identiques sur des Pages disjointes avec des fichiers d'état
disjoints, uniquement pour ne jamais répondre deux fois au même commentaire. Le passage à l'heure
normale exige un `update_trigger` manuel, sinon la routine tire de 8 h à 16 h.

**Avec Hermes.** Un ordonnanceur, un état partagé, la même logique de tirage au sort — attachée
comme skill à la tâche au lieu d'être dupliquée en trois exemplaires. La validation avant tir
vérifie jetons et cibles de livraison avant de dépenser un appel.

**Gain.** Le parallélisme cesse d'être une contrainte d'architecture. Le débit se règle par un
paramètre, pas par un découpage de Pages.

### E — L'écriture A2X ne se découvre plus en octobre
`a2x/`, `finance-proxy/`

**Aujourd'hui.** Un cron Render publie l'écriture hebdomadaire. Si le jeton de rafraîchissement
Intuit a expiré — friction documentée dans `FINANCE_PROXY.md` — le tir échoue, et l'absence
d'écriture se constate à la fermeture d'exercice.

**Avec Hermes.** Tâche épinglée à un modèle, charge le skill `qbo`, valide le jeton Intuit
*avant* de partir, compte ses échecs consécutifs. Au deuxième échec d'affilée, message sur Signal
avec la cause.

**Gain.** L'écart comptable se découvre le jour même. Sur un exercice qui ferme le 31 août, c'est
la différence entre un correctif et une reconstitution.

### F — La Tunisie sur WhatsApp
`mrp/`

**Aujourd'hui.** Le MRP n'est pas déployé — le code vit sur une branche, aucun service ne
l'héberge. La coordination avec l'atelier tunisien se fait en pratique sur WhatsApp, hors de tout
système.

**Avec Hermes.** Seul cas où Hermes fait quelque chose que la pile actuelle ne peut pas faire du
tout : Claude Code n'a pas de WhatsApp. Une passerelle branchée sur la base MRP permet de
demander l'état d'un ordre, de faire avancer un item, d'envoyer la photo d'un lot fini que la
vision de l'agent lit et rattache.

**Gain.** Le suivi de production entre deux continents passe d'un fil de discussion à un état
structuré, sans imposer un logiciel à l'atelier.

### G — Le triage descend sur du matériel local
`filtrage.js`, `analyse.js`

**Aujourd'hui.** Sonnet rédige, Opus relit, 3×/jour, sur chaque fil ouvert — la ligne de coût la
plus lourde. Une bonne partie de ce travail est de la classification, du dédoublonnage, de
l'étiquetage.

**Avec Hermes.** Le routage de fournisseurs et le repli automatique laissent un Qwen 3.6 27B
local faire le triage à coût marginal nul, Opus réservé aux escalades. Bénéfice secondaire réel :
les données personnelles des clientes restent sur place pendant la classification.

**Gain.** Le coût par tir se découple du volume de fils. La documentation annonce un facteur 3 à
5 sur la revue en arrière-plan seule.

---

## 4. Où est vraiment l'avantage concurrentiel

Pas dans « Lasclay utilise l'IA ». D'ici douze mois, toutes les marques comparables l'utiliseront,
avec des modèles équivalents et des outils achetés au même endroit. L'outil ne différencie rien.

Ce qui différencie, c'est le **corpus**. Lasclay possède déjà ce qui ne s'achète pas : un document
de connaissance de service client construit sur des erreurs réelles, 224 réponses types, un
fichier de faits vérifiés pour Facebook, 349 mappages comptables A2X, une méthode de vérification
obligatoire avant tout envoi, la connaissance opérationnelle tirée de 39 000 commandes migrées.
Un concurrent qui installe le même agent demain matin n'a rien de tout ça.

Aujourd'hui ce corpus est de la *documentation* : il vaut ce que vaut le temps que quelqu'un
passe à le tenir à jour. La boucle d'apprentissage le transforme en *actif* : il se met à jour à
chaque cas traité, et il grossit pendant que Gabriel fait autre chose.

Le point stratégique par-dessus : les skills sont au format `SKILL.md` agentskills.io, le même que
`.claude/skills/`. Le corpus n'est lié à aucun fournisseur. Si Hermes disparaît, ou si un meilleur
agent sort en 2027, l'actif suit — c'est du markdown. C'est la seule forme de verrouillage qu'une
entreprise de cette taille devrait accepter : aucune.

---

## 5. Ce que ça ne règle pas

- **Messenger reste bloqué.** Hermes couvre WhatsApp, Signal, SMS, courriel — **pas Messenger**.
  La fenêtre de sept jours de Meta est une règle de politique, pas un problème de transport. Le
  dossier Hugo Poirier et le skill `missive-messenger-7jours` restent où ils sont.
- **L'approbation « smart » est plus faible que la liste actuelle.** Le `settings.json` du dépôt
  liste explicitement ce qui exige confirmation : achat d'étiquette, écriture QBO, réponse
  Missive, déclenchement Omnisend. C'est déterministe. Le mode par défaut de Hermes fait juger le
  risque par un modèle. Pour tout ce qui touche l'argent : mode **manuel**, et `cron_mode: deny`
  tel quel.
- **Le Skills Hub est une surface d'approvisionnement.** Installer un skill tiers dans un agent
  qui peut acheter des étiquettes est une décision de chaîne d'approvisionnement. Les
  installations sont analysées, mais la bonne règle reste : aucun skill externe sur l'instance qui
  a des droits d'écriture.
- **Six mois d'existence.** Sorti en février 2026. La vitesse d'adoption est réelle, la maturité
  ne se décrète pas. Le proxy finance touche à de l'argent réel et à un exercice qui ferme le
  31 août — dernier endroit où faire un essai.
- **Ce n'est pas un remplaçant de Claude Code.** Le clone ShipStation, le MRP, les migrations
  restent du ressort de Claude Code. Hermes est bon à *rester allumé*, pas à écrire 40 000 lignes
  vérifiées. Claude Code construit, Hermes tient la maison.

---

## 6. Le pilote : deux semaines, en lecture seule

Coût logiciel nul (MIT). Infrastructure ~6 $/mois (Hetzner CX22 à 4,35 $, DigitalOcean à 6 $)
pour 1 vCPU / 2 Go. Coût des modèles selon le routage : 2–5 $/mois en triage économique, jusqu'à
60 $ en tout-Opus, zéro en inférence locale.

1. **Poser l'agent, sans droits d'écriture.** VPS à 6 $. Proxy général et proxy finance exposés
   comme serveurs MCP avec un filtre `include` restreint aux actions de lecture. Aucune écriture,
   nulle part. Passerelle Signal seulement, liste blanche à deux personnes. `cron_mode: deny`,
   approbation en mode manuel.
2. **Une seule tâche : la réconciliation du registre.** À 7 h, l'agent relit `SUIVI-SUPPORT.md`,
   croise chaque ligne contre ShipStation et Shopify, envoie sur Signal ce qui est encore ouvert.
   C'est le cas A, et c'est le bon premier test : il ne peut rien casser, et il se mesure.
3. **Ouvrir l'apprentissage, garder la main.** Si la réconciliation tient : activer
   `skills.write_approval` et laisser l'agent proposer ses premiers skills de support à partir des
   refus d'Opus. Revue tous les matins dans `/skills pending`. Ne jamais passer `cron_mode` en
   `approve` sur quoi que ce soit qui touche à l'argent.

**Critère d'arrêt.** Au bout de deux semaines, si le message de 7 h n'a rien signalé que le
fichier manuel ne contenait pas déjà, l'agent n'apporte rien et il s'éteint. C'est un test à 12 $.

---

## 7. Sources

- [Site officiel — Nous Research](https://hermes-agent.nousresearch.com/) — présentation, boucle d'apprentissage, environnements
- [Documentation Hermes Agent](https://hermes-agent.nousresearch.com/docs/) — architecture, installation, modèles
- [Skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) — agentskills.io, `skill_manage`, Skills Hub
- [Mémoire](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory) — MEMORY.md / USER.md, SQLite FTS5
- [Tâches planifiées](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron) — langage naturel, skills attachés, streak d'échecs
- [Passerelle de messagerie](https://hermes-agent.nousresearch.com/docs/user-guide/messaging) — 25+ plateformes, listes blanches
- [Intégration MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp) — transports, OAuth 2.1, mTLS, filtrage
- [Sécurité](https://hermes-agent.nousresearch.com/docs/user-guide/security) — les huit couches
- [Dépôt GitHub — NousResearch/hermes-agent](https://github.com/nousresearch/hermes-agent) — MIT, installation, limites
- [NVIDIA — Hermes sur RTX et DGX Spark](https://blogs.nvidia.com/blog/rtx-ai-garage-hermes-agent-dgx-spark/) — adoption, Qwen 3.6 local
- [Ventilation des coûts (source tierce)](https://www.autolearningagents.com/hermes-agent/hermes-pricing) — VPS, API, hébergement géré

Les chiffres d'adoption proviennent de matériel promotionnel de Nous Research et de NVIDIA ; ils
n'ont pas été vérifiés indépendamment.
