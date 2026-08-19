# Journal du chantier BIMI

État d'avancement, à relire au début de chaque session et à mettre à jour à la fin de chaque
étape. Le chantier s'étale sur des semaines (propagation DNS, observation DMARC, revue Apple,
délais de l'OPIC) : ce fichier est ce qui permet de reprendre sans tout redécouvrir.

Statuts : `à faire` · `en cours` · `en attente` (on attend un tiers ou un délai) · `fait` ·
`bloqué` (il faut une décision humaine).

---

| # | Étape | Statut | Depuis | Note |
| --- | --- | --- | --- | --- |
| 1 | Authentifier le domaine expéditeur Shopify | à faire | | 4 CNAME + `include:shopifyemail.com` au SPF |
| 2 | Brancher un lecteur de rapports DMARC | à faire | | puis **observer 2 à 4 semaines** |
| 3 | Durcir DMARC à `p=quarantine; pct=100` | à faire | | **bloqué tant que l'étape 2 n'a pas produit de rapports propres** |
| 4 | Publier le logo sur `bimi.lasclay.com` | à faire | | domaine perso Render + CNAME Porkbun |
| 5 | Publier l'enregistrement BIMI | à faire | | dépend des étapes 3 et 4 |
| 6 | Apple Branded Mail | à faire | | dépend de l'étape 3 |
| 7 | Déposer le papillon à l'OPIC | à faire | | **décision humaine** : classes, conseil en PI, paiement |
| 8 | Acheter un certificat (CMC ou VMC) | à faire | | **décision humaine** : dépense récurrente |

---

## Ce qui bloque en ce moment

- Rien. L'étape 1 peut commencer.

## Décisions déjà prises

- **2026-08-19** — Objectif retenu : VMC sur le papillon. En attendant, on prend tout ce qui
  est gratuit ; pas de VMC sur le mot « LASCLAY », qui afficherait du texte à la place du
  logo.
- **2026-08-19** — Hébergement du logo : le proxy général Render, derrière `bimi.lasclay.com`.

## Décisions en suspens

- Classes du dépôt OPIC : 25 seule (~491 $CA) ou 25 + 35 (~640 $CA) ; papillon seul ou logo
  complet. À trancher avec un conseil en PI.
- Certificat : CMC sur le papillon si Gmail devient prioritaire avant l'OPIC.

## Historique

- **2026-08-19** — Relevé initial : SPF et DKIM propres (Google Workspace, Klaviyo), DMARC à
  `p=none`, aucun enregistrement BIMI, expéditeur Shopify non authentifié. Logos produits et
  validés tiny-ps. Marque LASCLAY (TMA1285531) confirmée enregistrée mais en caractères
  standard — le papillon n'est pas couvert.
