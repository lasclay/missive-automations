---
name: missive
description: Accès à la boîte support Lasclay via le proxy Missive, et aux connaissances de service client, d'ops et de marque nécessaires pour y répondre. Couvre la lecture des fils, les brouillons, les notes internes, les tâches, la fermeture de conversations, et les scripts d'automatisation de la boîte (réponses IA, digest, filtrage, révision, archivage).
when_to_use: Déclenche dès qu'il est question du proxy Missive, de la boîte support, d'un fil ou d'une conversation client, d'un brouillon de réponse, d'une note interne, du digest des opérations, ou de répondre à un client Lasclay. Déclenche même sans le mot Missive, par exemple « lis le fil de la cliente qui attend son colis », « prépare une réponse pour la commande en rupture », « c'est quoi dans la boîte support ce matin », « ferme la conversation ».
argument-hint: [ce que tu veux faire dans la boîte support]
allowed-tools: Bash(node missive_client.js:*) Bash(node support.js:*) Bash(node digest.js:*) Bash(node filtrage.js:*) Bash(node revision.js:*) Bash(node revision_ia.js:*) Bash(node analyse.js:*) Read Grep Glob Skill
---

# Boîte support Missive — Lasclay

N'explore pas le dépôt pour retrouver comment joindre Missive : tout est ci-dessous.

## Accès au proxy

Service Render séparé (code dans `missive-proxy/`). Le client n'est pas déployé, il tourne
dans l'environnement Claude Code et lit l'URL et le secret depuis l'environnement
(`MISSIVE_PROXY_URL`, défaut `https://proxy-missive.onrender.com` ; `MISSIVE_PROXY_SECRET`).

```bash
node missive_client.js health                      # sonde du service
node missive_client.js list "shared_label=ID"      # lister des fils par filtre
node missive_client.js read <convId>               # lire une conversation
node missive_client.js drafts <convId>             # brouillons déjà rédigés par le script IA
node missive_client.js notes <convId>              # notes internes / commentaires
node missive_client.js users                       # membres de l'org (id, nom, courriel)
```

Écritures — elles sortent vers le client ou modifient la boîte partagée, donc **confirme
avant** sauf instruction explicite dans le tour courant :

```bash
node missive_client.js note <convId> "texte markdown"     # 🟡 note interne
node missive_client.js task <convId>                      # 🟡 JSON {title,assignees[],label} sur stdin
node missive_client.js close <convId> "note optionnelle"   # 🟡 ferme le fil
node missive_client.js reply <convId>                     # 🔴 ENVOIE au client, JSON de brouillon sur stdin
```

Le premier appel peut prendre ~10 s : Render endort le service au repos. Ce n'est pas une
panne, ne relance pas trois fois.

## Connaissances à charger selon le besoin

Ne récite pas ces fichiers en entier, ils sont volumineux. Lis la section utile.

- **`connaissance_support.md`** — la référence pour rédiger. Contient le ton de marque, puis
  le savoir officiel en réponses types classées par thème : expédition et suivi, plantation et
  bombes semencières, produits et questions techniques, précommandes et ruptures, retours et
  remboursements, tailles et échanges, garantie, logistique spéciale (grèves, douanes, USA),
  ateliers et points de vente, fraude. Suivent les logiques de décision internes commentées et
  les catégories de demandes avec leurs volumes. Repère la section par `grep -n '^###'`.
- **`contexte_lasclay.md`** — identité, histoire, mission, l'asclépiade et ses propriétés, les
  monarques, la fabrication, le catalogue par saison.
- Skill **`lasclay-master`** — contexte de marque permanent, ton de voix et garde-fous.
  Charge-le pour toute rédaction destinée à un client.
- Skill **`lasclay-seo`** si la tâche touche une fiche produit ou du contenu public.

## Scripts de la boîte

- `support.js` — réponses IA de la boîte support. Vérifie Shopify **et** ShipStation avant de
  répondre sur un envoi.
- `digest.js` — digest des opérations. `analyse.js`, `filtrage.js` — tri et analyse des fils.
- `revision.js`, `revision_ia.js` — révision des brouillons. `archive.js`, `purge.js`,
  `nettoyage.js`, `merge.js`, `repartition_merge.js` — entretien de la boîte.
- `admin_ops.js`, `prevente.js`, `draftrefresh.js` — opérations administratives et prévente.

Lis l'en-tête du script avant de le lancer : plusieurs agissent sur la boîte réelle.

## Vérifier un envoi

Une question de suivi se tranche avec les deux sources, jamais une seule : Shopify pour la
commande, ShipStation pour l'expédition et le numéro de suivi. Pour ShipStation, passe par le
proxy général — voir le skill `proxygen`.
