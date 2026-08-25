# Journal du chantier BIMI

État d'avancement, à relire au début de chaque session et à mettre à jour à la fin de chaque
étape. Le chantier s'étale sur des semaines (propagation DNS, observation DMARC, revue Apple,
délais de l'OPIC) : ce fichier est ce qui permet de reprendre sans tout redécouvrir.

Statuts : `à faire` · `en cours` · `en attente` (on attend un tiers ou un délai) · `fait` ·
`bloqué` (il faut une décision humaine).

---

| # | Étape | Statut | Depuis | Note |
| --- | --- | --- | --- | --- |
| 1 | Authentifier le domaine expéditeur Shopify | **à faire** | | ⚠️ un rapport de session l'a déclarée « déjà faite » — **c'est faux**, revérifié le 2026-08-25 : ni `shopifyemail._domainkey`, ni `include:shopifyemail.com` dans le SPF. 4 CNAME à créer + SPF à modifier |
| 2 | Brancher un lecteur de rapports DMARC | à faire | | sauté — l'étape 3 a été faite directement |
| 3 | Durcir DMARC à `p=quarantine; pct=100` | fait | 2026-08-25 | `v=DMARC1; p=quarantine; pct=100; rua=mailto:hey@lasclay.com; fo=1; adkim=r; aspf=r` |
| 4 | Héberger le logo | fait | 2026-08-25 | **choix modifié** : fichiers Shopify plutôt que Render — `https://lasclay.com/cdn/shop/files/lasclay-bimi.svg`, HTTP 200, `image/svg+xml`, conforme tiny-ps |
| 5 | Publier l'enregistrement BIMI | fait | 2026-08-25 | `v=BIMI1; l=https://lasclay.com/cdn/shop/files/lasclay-bimi.svg;` |
| 6 | Apple Branded Mail | **en cours** | 2026-08-25 | compte créé (`admin@lasclay.com`), fuseau corrigé, **domaine vérifié ✅**. Reste : méthode 2 de vérification de l'organisation (certificat de constitution à téléverser), puis *Send for Review* |
| 7 | Déposer le papillon à l'OPIC | à faire | | **décision humaine** : classes, conseil en PI, paiement |
| 8 | Acheter un certificat (CMC ou VMC) | à faire | | **décision humaine** : dépense récurrente |

---

## Ce qui bloque en ce moment

- **Apple, méthode 2** : la session Apple a expiré en cours de route. Il faut se reconnecter
  avec `admin@lasclay.com`, téléverser le certificat de constitution, puis *Send for Review*.
  Compteur : **60 jours** à partir du 2026-08-25 pour compléter les deux méthodes, sinon Apple
  supprime l'organisation et ses données.
- **Étape 1, Shopify — toujours pas faite**, malgré ce qu'un rapport de session a affirmé.
  C'est l'étape qui décide si les confirmations de commande auront un jour le logo.
- À vérifier : envoyer un courriel de test à une adresse **Yahoo** ou **Fastmail**. Ce sont
  les boîtes qui affichent le logo sans certificat — c'est là, et seulement là, qu'on peut
  constater aujourd'hui que le montage BIMI fonctionne.

## Comptes et identifiants (aucun secret ici)

- Apple Business : compte au nom de **Les Produits Lasclay inc**, identifiant
  `admin@lasclay.com`, adresse déclarée 408 rue Riopelle, Québec G1C 6L3, fuseau
  Canada/Eastern.
- Écart à surveiller : TMA1285531 porte l'adresse **1286 ave De La Ronde, Québec G1J 4B7**
  comme siège du titulaire. Elle diffère de celle déclarée chez Apple. Sans effet sur Branded
  Mail, mais à aligner avant tout dépôt à l'OPIC ou toute demande de certificat — une autorité
  de certification compare le titulaire au registre.

## Décisions déjà prises

- **2026-08-19** — Objectif retenu : VMC sur le papillon. En attendant, on prend tout ce qui
  est gratuit ; pas de VMC sur le mot « LASCLAY », qui afficherait du texte à la place du
  logo.
- **2026-08-25** — Hébergement du logo : **les fichiers Shopify**, pas Render. L'URL
  `https://lasclay.com/cdn/shop/files/lasclay-bimi.svg` est stable (section *Fichiers* de
  l'admin, pas les ressources d'un thème — elle ne contient pas d'identifiant de thème), sert
  le bon `Content-Type` et n'a pas de mise en veille. La route Render `/bimi/logo.svg` reste
  disponible comme rechange. Point de vigilance : **ne pas remplacer le fichier dans Shopify**
  une fois un certificat acheté — Shopify peut alors changer l'URL, et l'URL est inscrite dans
  le certificat.

## Décisions en suspens

- Classes du dépôt OPIC : 25 seule (~491 $CA) ou 25 + 35 (~640 $CA) ; papillon seul ou logo
  complet. À trancher avec un conseil en PI.
- Certificat : CMC sur le papillon si Gmail devient prioritaire avant l'OPIC.

## Historique

- **2026-08-25 (session au navigateur)** — Apple Business : compte créé avec
  `admin@lasclay.com`, organisation inscrite, fuseau passé de US/Pacific à Canada/Eastern.
  Vérification du domaine réussie du premier coup via le TXT
  `apple-domain-verification=CsPZJhYoQ93csEK7` publié à la racine chez Porkbun — **ne jamais
  le supprimer**, Apple revalide périodiquement. Zone vérifiée après coup : un seul SPF, MX
  intacts, aucun autre enregistrement touché. La session Apple a expiré avant la méthode 2.
  Le certificat de constitution (NEQ 1177782068, constituée le 2022-06-27) est retenu comme
  pièce plutôt que le bail commercial : c'est un document gouvernemental qui établit le nom
  légal, ce que le bail ne fait pas.
- **2026-08-25 (correction)** — Le tableau de fin de session déclarait l'expéditeur Shopify
  « authentifié (l'était déjà) ». Mesure directe : `shopifyemail._domainkey` absent en TXT
  comme en CNAME, et le SPF racine est toujours `v=spf1 include:_spf.google.com ~all`, sans
  `include:shopifyemail.com`. L'étape 1 reste entièrement à faire.

- **2026-08-25** — Relevé : DMARC est passé à `p=quarantine; pct=100`, le logo est publié
  dans les fichiers Shopify et l'enregistrement `default._bimi` pointe dessus. `bimi_check.js`
  valide le SVG servi (200, `image/svg+xml`, conforme tiny-ps). Le durcissement DMARC est sans
  danger ici : les deux expéditeurs qui écrivent sous `lasclay.com` — Google Workspace et
  Klaviyo — sont alignés, et Shopify envoie sous `shopifyemail.com`, donc hors de la politique.
  Constaté qu'un envoi Klaviyo reçu sur iCloud n'affiche pas le logo : c'est attendu, Apple Mail
  ne lit pas BIMI sans VMC — il passe par Branded Mail (étape 6).

- **2026-08-19** — Relevé initial : SPF et DKIM propres (Google Workspace, Klaviyo), DMARC à
  `p=none`, aucun enregistrement BIMI, expéditeur Shopify non authentifié. Logos produits et
  validés tiny-ps. Marque LASCLAY (TMA1285531) confirmée enregistrée mais en caractères
  standard — le papillon n'est pas couvert.
