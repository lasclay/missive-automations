---
name: lasclay-support-courriel
description: >-
  Expertise du support courriel et des boîtes Missive de Lasclay (marque québécoise de
  produits isolés à la soie d'asclépiade). Charge ce skill dès qu'une tâche touche les
  courriels de Lasclay : rédiger ou corriger une réponse client ou d'affaires dans la voix
  de Gabriel, travailler sur support.js (réponses IA de la boîte support), admin_ops.js ou
  digest.js (tri et digests des boîtes Admin/Operations), traiter un digest « Actions à
  faire » (remboursements, renvois), analyser un « pouls du service », déboguer un run,
  ajuster les prompts, la voix ou les garde-fous, ou modifier le document de connaissance.
  Déclenche-le même sans le mot « support », par exemple « réponds à ce client », « pourquoi
  le brouillon n'est pas parti », « ajoute une règle de voix », « traite les remboursements
  du digest ». C'est LE skill de référence pour tout ce qui entre ou sort des boîtes
  courriel de Lasclay.
---

# Support / courriel Lasclay

Lasclay gère tous ses courriels dans **Missive** (boîtes partagées) et les automatise avec
trois scripts Node de ce dépôt, qui tournent en cron sur Render (déploiement = fusion dans
`main`). Ce skill te donne la carte du système, les règles de rédaction et les réflexes de
sécurité. Les détails vivent dans `references/` et dans le code lui-même.

## La carte du système

| Boîtes | Script | Rôle |
|---|---|---|
| Support client (LAS Support, Mise à jour commande, Retours-Échanges, Ventes pré-achat, USA, Expéditions prioritaires, R&D) | `support.js` (v2.34) | Rédige des réponses IA (Sonnet) vérifiées contre Shopify + ShipStation, contrôle qualité Opus, envoi auto optionnel, fermeture des fils réglés, pouls du service, digest des actions à faire |
| Admin (`admin@`) et Operations (`operations@`) : partenaires, gouvernement, fournisseurs, factures — PAS du service client | `admin_ops.js` (v3.5) | Trie chaque fil (close / spam / à voir / keep), priorise les « keep », prépare des brouillons, poste un digest 🔴/💰/🟢 par boîte |
| (ancien) | `digest.js` | Ancêtre du digest Admin/Ops, entièrement remplacé par `admin_ops.js`. Ne pas le faire évoluer ; il sert de référence historique |

Deux documents de connaissance nourrissent les IA :

- `connaissance_support.md` (~4200 lignes) : ton de marque, 224 canned responses classées,
  logiques de décision, statistiques par catégorie de demande. Source de vérité du support
  client. Attention : certaines canned sont périmées (voir « corrections de Gabriel » dans
  le bloc VOICE de `support.js`, qui PRIMENT sur ce document).
- `contexte_lasclay.md` : contexte d'entreprise dense (mission, histoire, pivot 2026,
  produits, ton). Source de vérité des brouillons Admin/Operations.

## Quoi faire selon la tâche

- **Rédiger ou corriger un courriel** (client ou affaires) → lis
  `references/voix-redaction.md` et applique-le à la lettre. Pour un courriel client,
  vérifie les faits (catalogue, commande) avant d'affirmer quoi que ce soit.
- **Modifier `support.js`, ses prompts ou ses garde-fous** → lis
  `references/architecture.md` d'abord : chaque verrou existe pour une raison apprise en
  production (v2.x = un correctif par incident). Ne retire jamais un verrou sans comprendre
  l'incident qui l'a créé. Le bloc d'en-tête du script raconte cet historique.
- **Traiter un digest « Actions à faire » ou un pouls** → lis `references/digests.md`.
  Les remboursements sont de l'argent réel : toujours revérifier dans Shopify avant d'agir.
- **Modifier le tri Admin/Ops** → `references/architecture.md`, section admin_ops.js.
  Règle d'or du tri : dans le doute ce n'est JAMAIS du spam ; les invitations
  institutionnelles/gouvernementales et tout ce qui touche la mission (asclépiade,
  monarques, semences, textile) restent « keep ».
- **Enrichir la connaissance** → ajoute dans `connaissance_support.md` (support) ou
  `contexte_lasclay.md` (admin/ops) ; si une consigne doit PRIMER sur une canned périmée,
  elle va plutôt dans le bloc VOICE de `support.js` (section « CONNAISSANCES CORRIGÉES PAR
  GABRIEL »).

## Réflexes de sécurité (non négociables)

1. **DRY_RUN d'abord.** Tous les scripts simulent par défaut (`DRY_RUN=true`). Tout test
   d'une modification se fait en simulation ; le mode réel n'écrit dans Missive qu'après
   validation. L'envoi auto (`AUTO_SEND`) est éteint par défaut et un envoi est
   irréversible.
2. **Déploiement = `main`.** Les crons Render suivent la branche `main`. On travaille sur
   une branche, on fusionne dans `main` pour déployer. Rien ne « part en prod » autrement.
3. **La vérité vient des systèmes, pas du fil.** Statut de commande, remboursement, stock,
   suivi : Shopify (GraphQL Admin) et ShipStation (lecture seule, via le connectors-proxy)
   priment sur ce que dit le client ou ce que suppose l'IA. Une promesse d'argent ou de
   renvoi sans vérification Shopify est bloquée par conception ; garde ce principe dans
   tout ce que tu écris ou modifies.
4. **Jamais de secrets dans le code ni l'environnement Claude.** Les clés vivent côté
   Render. Pour accéder à ShipStation/Omnisend, passe par `connectors_client.js` (voir
   `CLAUDE.md` et `CONNECTORS_PROXY.md`).
5. **Ne casse pas les anti-doublons.** Labels marqueurs (« Draft AI Support », « Draft
   créé »), mémoires gzip stockées en brouillons (« Archives support »), fils écartés :
   c'est ce qui empêche le système de répondre deux fois au même client.

## Identifiants Missive utiles

Organisation : `d2b9b52d-ceff-4811-aea7-1f092ec95f36`. Adresse d'envoi support :
`hey@lasclay.com` ; Admin : `admin@lasclay.com` ; Operations : `operations@lasclay.com`.
Signature automatique Missive : « Chaleureusement, Gabriel Gouveia, Co-fondateur,
Lasclay.com » (les brouillons ne signent JAMAIS eux-mêmes).

| Objet | ID |
|---|---|
| Équipe LAS Support | `e184d153-4472-4edd-9b35-f8867cf437a8` |
| Équipe Mise à jour commande | `0db185c1-3a93-4a44-9f50-dcfe8c0683dd` |
| Équipe Retours-Échanges | `cc587c84-63b9-4e88-993c-4f4b5b328173` |
| Équipe Ventes - info pré-achat | `d6f28d2f-06ef-4aa5-aae0-b68f014e3216` |
| Équipe USA | `13d8a7bd-ed2e-4e0c-8cf3-2329ebaed217` |
| Équipe Expéditions prioritaires | `9240aa4e-3e81-40aa-a07a-84f6b1c2231e` |
| Équipe LAS R&D | `80ae6958-8266-4898-9d80-38851eb3ba69` |
| Équipe Lasclay Admin | `a6c74be0-2a27-4c79-9294-a74b447e6dc0` |
| Équipe LAS Operations | `7c925f0d-3eca-4535-be20-424078619cef` |
| Label « Draft AI Support » (anti-doublon support.js) | `019eb935-9b22-7d14-8aeb-614a1e303e24` |
| Label « Relance » (suivi à faire après envoi) | `019f5d2f-51ca-70f0-83cc-2175b52d5a41` |
| Label « Draft créé » (anti-doublon admin_ops/digest) | `d0fad8a6-2ce4-427e-a971-949b2313d118` |
| Conversation « Archives support » (mémoires + digests actions) | `019eb488-6d42-7195-a2ae-11751d0a7a27` |
| Conversation Résumé Admin | `9e3f9ab8-9bb4-4a89-8040-9cf76284949d` |
| Conversation Résumé Operations | `8b0001c6-97ba-4c62-a12a-9ac6247326c9` |

Lien vers un fil : `https://mail.missiveapp.com/#inbox/conversations/<id>`.

## Références

- `references/voix-redaction.md` — la voix de Gabriel : règles absolues, excuses graduées,
  formules bannies, escalade, contrat JSON des rédacteurs. À lire AVANT d'écrire le moindre
  courriel Lasclay.
- `references/architecture.md` — pipeline complet de `support.js` (vérifications Shopify/
  ShipStation, QC Opus, verrous, mémoires), tri d'`admin_ops.js`, variables d'environnement.
- `references/digests.md` — les trois digests (Actions à faire, Pouls du service, Résumé
  Admin/Ops) : qui les produit, où ils atterrissent, comment les traiter en tant qu'agent.

Pour le contexte de marque général (produits, mission, garde-fous publics), charge aussi le
skill `lasclay-master` s'il est disponible ; pour les finances, `finances-lasclay`.
