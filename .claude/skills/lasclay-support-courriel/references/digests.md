# Les digests et comment les traiter

Trois flux de synthèse sortent des automatisations. En tant qu'agent, tu peux être appelé à
les LIRE (analyse, rapport à Gabriel) ou à les EXÉCUTER (poser les gestes listés).

## 1. « Actions à faire » (support.js) — à EXÉCUTER

Quand `support.js` ENVOIE une réponse qui promet une action (remboursement, rabais, renvoi,
correction), le client a déjà reçu la promesse ; l'action reste à poser. Chaque item est :

- noté sur le fil Missive (« Remboursement à faire » / « Action à faire ») ;
- ajouté au digest markdown `actions_a_faire_<date>.md`, déposé en pièce jointe d'un
  brouillon `[ACTIONS À FAIRE]` dans « Archives support »
  (`019eb488-6d42-7195-a2ae-11751d0a7a27`, ou `ACTIONS_CONV`).

Format d'un item : nom du client, sujet, lien du fil, catégorie, langue, action à faire,
montants mentionnés (ou « à confirmer dans Shopify »). Deux sections : « Remboursements à
traiter » et « Autres actions ».

### Procédure d'exécution (argent réel : prudence maximale)

1. Ouvre le fil Missive et relis la promesse EXACTE faite au client (montant, geste).
2. **Vérifie dans Shopify avant tout geste** : la commande, son statut, et surtout si un
   remboursement/renvoi n'a PAS déjà été fait (le digest peut dater ; un humain a pu
   passer avant). Un remboursement en double est le pire scénario.
3. Pose le geste dans le bon système : remboursement/rabais → Shopify Admin ; renvoi →
   commande manuelle ShipStation (via le connectors-proxy : `node connectors_client.js
   shipstation <action> ...` ; la création de commande et l'achat d'étiquette coûtent de
   l'argent réel, confirmer avec Gabriel si le montant est inhabituel).
4. Trace : note interne sur le fil Missive (fait, date, montant), et coche l'item.
5. Si l'action est ambiguë, si le montant diverge de la promesse, ou si Shopify contredit
   le digest : NE FAIS RIEN et remonte le cas à Gabriel avec le lien du fil.

## 2. « Pouls du service » (support.js) — à LIRE / rédiger

Point quotidien bref posté dans la conversation « Résumé Support » (`RESUME_CONV`) au run
de `DIGEST_HOUR` (10h UTC). Rôle : tenir Gabriel au courant, PAS une liste de tâches.
Structure : 2-3 phrases de pouls (volume, ton des clients, ce que l'IA a géré), thème
dominant éventuel, puis « À ton attention » avec un seuil d'escalade HAUT : client très
fâché ou menaçant, opportunité (grossiste, média, gros client), défaut produit récurrent
(tendance, pas cas isolé), cas où l'IA a probablement calé, contact VIP. Liste vide =
excellent résultat (« Rien de spécial à signaler, le service roule »). Icônes 🔴 urgent /
🟡 attention / 🔵 info, lien « ouvrir » vers chaque fil.

Si tu rédiges ou analyses un pouls : même philosophie. Calme, sélectif, jamais gonfler la
liste, jamais escalader le routine.

## 3. Digest Résumé Admin / Operations (admin_ops.js) — à LIRE / traiter

Posté chaque matin de semaine dans les conversations « Résumé » Admin
(`9e3f9ab8-9bb4-4a89-8040-9cf76284949d`) et Operations
(`8b0001c6-97ba-4c62-a12a-9ac6247326c9`). Structure :

- 🔴 **À traiter** : priorité haute (échéance, montant en jeu, relance qui traîne) ;
- 💰 **Opportunités** : catégories opportunite/developpement ;
- 🟢 **Vite fait / à fermer** : le reste, tronqué à 8 lignes ;
- **Sous-tâches** des cas lourds (cases à cocher) ;
- **Brouillons prêts** ✍️ (max 5) à relire avant envoi, éventuellement déjà créés comme
  vrais brouillons Missive si `CREATE_DRAFTS`.

Chaque ligne : expéditeur, sujet, âge en jours, lien « ouvrir », phrase d'action. Le digest
liste aussi les fermetures et spams du run (traçabilité : tout est réversible, un fil fermé
se rouvre à la moindre réponse).

Si on te demande de traiter ce digest : commence par les 🔴 les plus vieux, relis les
brouillons ✍️ contre les règles de voix (voir voix-redaction.md) avant d'approuver, et ne
réponds jamais à la place de Gabriel sur une décision d'affaires (rendez-vous, engagement,
refus) : prépare, il tranche.
