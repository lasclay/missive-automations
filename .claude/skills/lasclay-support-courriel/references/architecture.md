# Architecture des automatisations courriel

## support.js — réponses IA de la boîte support (v2.34)

Tourne 3 fois par jour. Pour chaque fil OUVERT des 7 boîtes support où le dernier mot
revient au client, il rassemble tout le contexte, fait rédiger Sonnet, contrôle avec Opus,
puis crée un brouillon ou (si autorisé) envoie. Node 18+, aucune dépendance ; tout passe
par l'API publique Missive (`public.missiveapp.com/v1`) et l'API Anthropic.

### Déroulement d'un run

1. **Rafraîchissement** : retire le label « Draft AI Support » des fils fermés (l'anti-
   doublon des brouillons ; un message ENVOYÉ ne le reçoit pas).
2. **Ciblage** : fils ouverts uniques des équipes, dernier message non-nous, pas déjà
   drafté, pas en mémoire des écartés (fil jugé « rien à répondre » et inchangé depuis).
   Plafonds : `MAX_FILS` (40) analysés, `DRAFT_LIMIT` (5) sorties par run.
3. **Contexte « vue humaine »** rassemblé avant rédaction :
   - fil complet (1er message + 11 derniers), notes internes Missive du fil ;
   - photos jointes du client (VISION, max 3) envoyées en multimodal ;
   - **Shopify (GraphQL Admin)** : commande par numéro `L-xxxxx` (extrait du sujet/fil) ou
     par courriel ; statut, dates expédiées/livrées avec temps écoulé pré-calculé, suivi et
     lien, remboursements déjà faits, rabais, mode d'expédition, notes, tags ; historique
     jusqu'à 5 commandes ; identité pivotée sur le courriel du COMPTE (alerte si
     l'expéditeur diffère). Auth par client credentials (app « Render connector ») ou jeton
     fixe ; replis propres si scopes read_customers/read_products absents (latch par run) ;
   - **ShipStation (lecture seule, direct ou via connectors-proxy)** : statut interne
     (à expédier, on hold, annulée), TOUS les envois (détecte un renvoi → donner le suivi
     du plus récent), étiquettes de retour émises, commandes manuelles au nom du client
     (invisibles dans Shopify : renvois de garantie). Caches par commande/nom, latch
     d'échec, respect du 40 req/min ;
   - **stock réel** au catalogue (inventaire Admin par variante, repli dispo publique) ;
   - autres fils du client (ouverts + fermés récents) pour ne pas se contredire ;
   - excuses déjà servies à ce client (mémoire persistante).
4. **Rédaction** (Sonnet, `MODEL`) avec les blocs système en cache : connaissance +
   catalogue + VOICE. Sortie JSON (voir voix-redaction.md).
5. **Fermeture active** (`CLOSE_RESOLVED`) : si l'IA rend `fermer=true` (fil manifestement
   réglé, simple remerciement, obsolète) et ni action ni escalade → fermer SANS répondre,
   avec note interne. Réversible (se rouvre si le client réécrit).
6. **Alertes déterministes** sur le brouillon : féminins de 1re personne, formules bannies,
   tu/vous mélangés, excuse creuse ou trop appuyée, souhaits datés, montants non sourcés,
   action déclarée accomplie, emoji, numéro de téléphone, affirmations d'origine.
7. **Décision d'envoi** (si `AUTO_SEND`) : candidat = catégorie permise, courriel avec
   destinataire, sous plafond, pas d'escalade, et verrous levés. Trois verrous durs qui
   forcent le brouillon quoi qu'il arrive :
   - **verrou remboursement** : promesse d'argent/renvoi non vérifiée dans Shopify ;
   - **verrou Mise à jour commande** : réponse de statut sans commande vérifiée ;
   - **verrou gabarit** : tout `[...]` ou `{...}` résiduel dans le corps (indépendant de
     l'IA, appliqué après correction Opus).
8. **QC Opus** (`SEND_QC`, `QC_MODEL`) : verdict envoyer / corriger (réécrit le brouillon)
   / bloquer. Sauté seulement sur les envois sans AUCUN signal de risque (`QC_SKIP_SAFE`).
   S'ajoutent au QC : catégories sensibles (retours, garantie, wholesale, douane), enjeu
   détecté dans le dernier message client (menace d'avis, chargeback, légal, colère, saga),
   escalade décidée par Sonnet. **Double passe** (`DOUBLE_QC`) sur les cas à enjeu : un
   vérificateur adversarial confronte le brouillon aux données vérifiées ; au moindre
   doute → brouillon. Panne du QC = brouillon, jamais l'inverse.
9. **Sortie** : corps final + signature (FR/EN) + notice de transparence IA (dans la langue
   du client, avec le 581-982-5857). Envoi → fil fermé ; si `suivi='nous'` → label
   « Relance » + note datée avec le délai suggéré par l'IA. Brouillon → label anti-doublon
   + note interne (bloquante ⚠️ ou informative) postée sur le fil.
10. **Fin de run** : sauvegarde des mémoires (excuses, écartés) en `.json.gz` attachés à
    des brouillons `[NE PAS ENVOYER]` dans « Archives support » ; dépôt du digest
    « Actions à faire » ; pouls du service (voir digests.md) ; bilan et coûts QC loggés.

### Variables d'environnement principales

Requis : `MISSIVE_TOKEN`, `ANTHROPIC_API_KEY`. Sécurité : `DRY_RUN` (défaut true),
`AUTO_SEND` (défaut false), `SEND_LIMIT`, `SEND_CATEGORIES`, `SEND_ACTIONS` (envoyer aussi
les promesses d'action, avec digest), `DRAFT_LIMIT` (5), `MAX_FILS` (40). QC : `SEND_QC`
(true), `QC_MODEL` (claude-opus-4-8), `QC_SKIP_SAFE`, `QC_LEAN` (contexte allégé sans les
canned), `QC_ESCALADE`, `DOUBLE_QC`. Contexte : `SHOPIFY_STORE` +
(`SHOPIFY_CLIENT_ID`/`SECRET` ou `SHOPIFY_ADMIN_TOKEN`), `GENERAL_PROXY_URL` +
`GENERAL_PROXY_SECRET` ou `SHIPSTATION_API_KEY`/`SECRET`, `SHIPSTATION_VERIF`, `VISION`,
`HISTO_CLOSED`. Digest/pouls : `DIGEST_SUPPORT`, `DIGEST_HOUR` (10 UTC), `RESUME_CONV`,
`DIGEST_MODEL`, `ACTIONS_CONV`. Divers : `MODEL` (claude-sonnet-4-6), `KNOWLEDGE_FILE`,
`TEAMS`, `CLOSE_RESOLVED`, `LIST_TEAMS=true` pour lister les équipes de l'org.

### Patrons techniques réutilisables

Retry réseau + 429 sur chaque appel (Missive ~300 req/min → pause 260 ms) ; cache de
prompt Anthropic par blocs système (`cache_control: ephemeral`) ; nettoyage HTML + coupe
des citations (`cleanBody`) ; extraction de numéro de commande `L-xxxxx` tolérante ;
mémoires persistantes en pièces jointes gzip de brouillons (pas de base de données) ;
`noDash()` partout (aucun cadratin ne sort du système).

## admin_ops.js — tri et digest Admin/Operations (v3.5)

Boîtes `admin@` et `operations@` (partenaires, gouvernement, factures, notifications ;
PAS du service client). A absorbé `digest.js` : une seule passe, UN appel IA par fil
(Opus, `MODEL` défaut claude-opus-4-8) qui trie ET priorise.

Chaîne de décision par fil ouvert : assigné → gardé ; dernier message = nous → gardé
(balle dans leur camp) ; fast-path déterministe (reçu automatique évident) → fermé sans
IA ; sinon juge IA sur le fil complet → `close` / `spam` / `a_voir` / `keep` :

- **close** (confiance ≥ `AI_SEUIL`, défaut 0.6) : reçus, notifications jetables, pur
  informatif, annonces produit, factures récurrentes auto-débitées, démarchage froid.
  Réversible et tracé au digest, d'où le seuil bas.
- **spam** (confiance ≥ `SPAM_SEUIL`, défaut 0.85, action `SPAM_ACTION` close/trash/
  label) : uniquement le démarchage commercial creux d'un privé sans relation ni lien avec
  la mission. Jamais les invitations institutionnelles/gouvernementales, jamais ce qui
  touche l'asclépiade/monarques/textile : dans le doute, PAS spam.
- **a_voir** : rare ; obligation future concrète (échéance réelle, décision à venir,
  mouvement d'argent anormal). Gardé ouvert + label de revue optionnel.
- **keep** : attend Gabriel → priorisé (haute/moyenne/basse), phrase d'action, sous-tâches,
  et brouillon éventuel (opportunités et relances seulement) → entre au digest.

Un signal d'action clair (facture à payer, « action requise », vraie personne) interdit
close/spam par garde-fou. Le digest 🔴 (à traiter) / 💰 (opportunités) / 💰🟢 (vite fait)
est posté dans la conversation « Résumé » de chaque équipe, avec sous-tâches et brouillons
à relire. Options : vraies tâches Missive (`MISSIVE_TASK_LABEL`) pour les 🔴, vrais
brouillons Missive (`CREATE_DRAFTS` + label anti-doublon + `DRAFT_LIMIT`). Digest sauté la
fin de semaine (heure du Québec) sauf `DIGEST_SKIP_WEEKEND=false` ; le tri, lui, tourne.

## digest.js — ancien digest (référence seulement)

Version d'origine du digest Admin/Operations (inspection des fils en attente, classement
par Claude, digest posté, tâches et brouillons). Remplacé par `admin_ops.js` v3 ; son cron
est à laisser désactivé. Utile uniquement pour l'archéologie du format.

## Autres scripts voisins de l'écosystème

`missive_client.js` et `missive-proxy/` (accès API Missive via proxy Render),
`draftrefresh.js`, `filtrage.js`, `nettoyage.js`, `purge.js`, `archive.js`, `merge.js`,
`analyse.js`, `revision.js`/`revision_ia.js` (historique du tri et de la révision des
canned), `prevente.js`, `shopify_check.js`, `shipstation_check.js` (validations directes).
Consulte leur en-tête avant usage : chacun documente ses env vars et garde-fous.
