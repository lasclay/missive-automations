# Suivi des actions en attente — boîte support

Registre des gestes promis à des clients et pas encore posés. **C'est ce fichier qui fait
foi, pas les tâches Missive.**

## Pourquoi ce fichier existe

Une tâche créée par le proxy Missive ne peut être ni relue, ni refermée, ni dédoublonnée.
Trois vérifications le 2026-08-19 :

| Chemin | Résultat |
| --- | --- |
| `POST /posts` avec un objet `task` | renvoie `{conversation, id}` — **aucun id de tâche** |
| `GET /conversations/:id/comments` | ne rend pas les tâches, ni les notes posées par le proxy |
| `GET /posts/:id` | **404 « Invalid request URL »** — l'endpoint n'existe pas |

Conséquence pratique : après avoir créé une tâche, on ne peut pas vérifier qu'elle existe.
Supposer l'échec et recréer produit des doublons — c'est arrivé trois fois sur le dossier
Paulette Pratte. **Ne jamais recréer une tâche « au cas où ».**

Même limite pour les notes internes : `postNote` crée un *post*, pas un *comment*. La note
est déposée dans le fil mais ne ressort pas de l'API.

---

## En attente d'un geste interne

Dernière mise à jour : 2026-08-31 — **boîte « Mise à jour commande » vidée : 187 fils au départ,
5 restants.** Toutes assignées à Catherine Bedard-Mercier et Gabriel Gouveia.

⚠️ Les entrées marquées **ANNONCÉ COMME FAIT** ont déjà été confirmées au client comme
accomplies. Elles ne sont pas des intentions : le client attend une facture ou un
remboursement qui a été promis au passé. Elles passent avant tout le reste.

| # | Client | Fil | Geste | Montant | Promis au client |
| --- | --- | --- | --- | --- | --- |
| 1 | Hugo Poirier | `71abd7ec` | **Répondre dans Messenger** — le proxy ne peut pas écrire sur ce canal | 51,42 $ si remboursement | oui, par courriel |
| 2 | Marie-Anaïs Sauvé | `2103e221` | Appliquer le rabais **MERCI10** sur L-50488 | 14,20 $ | oui |
| 3 | Paulette Pratte | `ab13967e` | L-50527 : `PICK_UP` chez Les Défricheuses → **expédition depuis l'Entrepôt Lasclay**. L'adresse est déjà correcte au dossier | — | oui |
| 4 | André Boily | `b45dda94` | L-50400 : manteau **Femme XL → Homme XL** | 305,83 $ en jeu | oui |
| 5 | Marc Bouvet | `9d6f5652` | Commande manuelle : veste Femme M + veste Homme XL, au nom de **Geneviève Beyries**, 6304 Saint-Dominique, Montréal H2S 3A5. Stock vérifié : 1 de chaque | 390,90 $ | oui |
| 6 | Alexis Boulianne | `612ff95c` | Expédier la commande manuelle et **transmettre le suivi** | — | oui |
| 7 | Jayvi Murden (ArcelorMittal) | `4adadaab` | Réexpédier la besace isotherme noire, sans frais | 91,97 $ | oui |
| 8 | Claudia Déméné | `32ccb94f` | Transmettre le courriel de **carte-cadeau de 25 $** (crédit déjà émis) | 25,00 $ | oui |
| 9 | Patricia Prince | `6086b8af` | Retirer sa carte de crédit du dossier **+** élucider la tuque S/M retirée à 0,00 $ | ~35 $ à vérifier | non |
| 10 | Géraldine Philippin | `9346dc91` | Diviser L-50286 pour expédier la crème seule — **seulement si elle confirme** | — | offert |
| 11 | Deborah Williams | `fcb0547a` | Expédier le sachet de graines Labriformis manquant | 2,72 $ | oui |
| 12 | Henri-Paul Bronsard | `a13c8c3d` | Émettre un **crédit boutique** | 25,00 $ | oui |
| 13 | Nancy Amadon | `ac6be2f2` | Changer le point de retrait pour **Québec, boutique des Capucins**. Elle recevra un avis d'annulation puis une nouvelle commande — c'est normal, ne pas s'en inquiéter | — | oui |
| 14 | Kassandra Veilleux | `3b8c46ad` | Rembourser | 68,96 $ | oui |
| 15 | René St-Hilaire | `a8a56668` | Appliquer **LASCLAY30** (couverture imprimée en prévente automne) | 46,79 $ | oui |
| 16 | Estelle Bolduc | `7315a66a` | Appliquer le rabais de **30 %** | 46,19 $ | oui |
| 17 | Diane Mayer | `ede94a0c` | Rembourser la portion du code promo omis (30 %). Son chandail polaire reste en prévente automne 2026 | 32,09 $ | oui |
| 18 | Greg Shone | `13235c55` | **Obtenir sa nouvelle adresse** avant tout envoi — il a déménagé le 22 juin | — | oui |
| 19 | Léanne St-Hilaire | `54bd3d18` | L-50266 : expédier la **1re partie** — 3 sachets stratifiés + 2 paires de semelles 5 femme + graines d'automne offertes. Mitaines bébé et sac à lunch noir suivent à l'automne (prévente). ⚠️ **Semelles « 5 femme » à −7 dans Shopify** : vérifier physiquement avant de monter le colis, elle n'a pas été avertie d'un retard là-dessus | — | oui, elle a accepté le 18 août |
| 20 | **Paul-André Barrette** | `a6dd8642` | **ANNONCÉ COMME FAIT** — L-50625 : ajouter le chandail polaire **L**, appliquer **LASCLAY15** sur l'ensemble, envoyer la facture corrigée. Colis complet à l'automne (oreillers + chandail en prévente), il l'a accepté | ~54,67 $ de rabais, à recalculer après l'ajout | oui, au passé |
| 21 | **Jacqueline Dupuis** | `aeb6d0a7` | **ANNONCÉ COMME FAIT** — L-50943 : ajouter le **nettoyant visage** Monarch Botanika, envoyer la facture corrigée. Rien n'est expédié | 29,99 $ | oui, au passé |
| 22 | **David Hoover** | `c01c22cf` | **ANNONCÉ COMME FAIT** — remboursement **complet** de L-42182. Commandé le 28 nov 2025, expédié le 24 mars 2026 (117 jours), sans suivi ; il réclamait depuis le 1er janvier en menaçant PayPal | 51,89 $ US | oui, au passé |
| 23 | **Mike Conway** | `b7452450` | Réexpédier 5 sachets Incarnata (Linesville PA). Il a confirmé n'avoir rien reçu. Stock vérifié : 84 | — | oui, cette semaine |
| 24 | **Tim Sullivan** | `95570ced` | **URGENT** — L-45225 : réexpédition **avec vrai suivi** OU remboursement de 99,72 $ US, à son choix. Quatre messages sans réponse, il en était à « Is this a scam? ». Stock vérifié : 3× Speciosa (179) + verticillée (11) | 99,72 $ US | oui, cette semaine |
| 25 | **Kerry Bulson** | `867ce823` | L-48212 : expédier les bombes **verticillée** avec vrai suivi (stock 11). Les **incarnate sont en rupture (−1)** — il choisit une autre variété ou un remboursement partiel. La réexpédition promise le 12 mai n'a jamais été faite | — | oui, cette semaine |
| 26 | **Lynne Croteau** | `48427997` | L-48321 : expédier 1 sachet **Tuberosa stratifié** (Berkley MI). Erreur de préparation, pas colis perdu — livré le 1er avril avec suivi USPS, les 3 articles marqués emballés ensemble, le sachet manquait. Stock 675 | 24,69 $ US | oui, cette semaine |
| 27 | **Diane Roy** | `e46726e7` | Rembourser les 30 % non appliqués sur L-50418 **+** décider de l'envoi partiel (tuque et semelles prêtes ; coussin d'assise et gants magiques en prévente automne) | 46,21 $ | oui |
| 28 | **Diane Brazeau** | `e6b6a907` | Rembourser les 30 % non appliqués sur L-50460 | 7,58 $ | oui |
| 29 | **Nancie Bélanger** | `25f95447` | Rembourser les 15 % non appliqués sur L-50638 | 3,79 $ | oui |
| 30 | **Carole Bourdon** | `f311d591` | Rembourser les frais d'expédition facturés à tort sur L-50197 (rabais bien appliqué, mais 9,99 $ ajoutés) | 11,49 $ | oui |

## Conditionnels — rien à faire tant que le client n'a pas répondu

| Client | Fil | Déclencheur |
| --- | --- | --- |
| Marc-Olivier Gilbert | `eebad7e6` | remboursement de 68,97 $ **ou** sac de remplacement, à son choix |
| Hugo Poirier | `71abd7ec` | remboursement de 51,42 $ s'il juge l'attente jusqu'à l'automne trop longue |
| Sara Usher | `eb882b81` | remboursement de ses 3 sachets s'ils ne sont jamais arrivés |
| Emma Nelson | `fd4fbc13` | échange de couleur **ou** annulation + remboursement de 68,31 $ |
| Andrew Lawson | `5a789699` | expédition d'un sac à lunch + nouvelle adresse s'il confirme n'avoir rien reçu |
| Fanny Brisson | `d6330a54` | expédition des mitaines urbaines **lilas** si elle confirme ne les avoir jamais reçues — **vérifier le stock de la couleur avant de promettre** |
| Margaret Clarke | `e834a6da` | L-49971 était déjà partie vers son ancienne adresse quand elle a demandé le changement ; renvoi si elle dit n'avoir rien reçu. Nouvelle adresse : 57 Stinson Rd, Dunbarton NH 03046 |
| Chantal Richard | `6a0c71e5` | L-50203 : envoi partiel des deux crèmes si elle le préfère, gants magiques à l'automne |
| Dave Clubb, Lynda Dauber, Stani Butler, James Mobley, Pamela Shaw, Raphaël D. Pageau, Michael Clark, Tina Rumsey, Jo Stachowiak, Diane Swanson | — | **lot « graines sans suivi »** relancé le 2026-08-20 : la question seule a été posée, aucune offre chiffrée, pour éviter de provoquer une fausse déclaration. Traiter au cas par cas si l'un répond n'avoir rien reçu |
| Cheryl Warner, Donna Burzynski, Georgia Hoffmann, Bob Barth | — | renvoi ou remboursement s'ils confirment n'avoir jamais reçu leurs graines |

## Réglé

M Starr (`7dc38baa`) — a confirmé le 2026-08-27 avoir finalement reçu L-49992. Renvoi
conditionnel annulé.

Tina Newman (`2b225563`) — a confirmé le 2026-08-19 avoir reçu ses semences. Le renvoi
conditionnel est annulé, rien à poser.

Simon Déry — remboursement de 6,60 $, transaction `PENDING` chez Shopify Payments depuis le
2026-08-18 19 h 20. Patricia Prince — 4,28 $, `PENDING` depuis 18 h 48 le même jour.

## Perdus

Martin Maillet (`79a41d5e`) — L-49533, un sachet Tuberosa parti le 11 mai sans suivi. Il a
écrit deux fois sans réponse, puis le 2026-08-20 : « après mes deux tentatives, j'ai annulé
ma transaction auprès de mon institution financière. Bien déçu…. J'aurais aimé pouvoir
attirer quelques papillons chez nous. » **Rétrofacturation en cours** — l'offre de renvoi ou
de remboursement est caduque, la banque a tranché à notre place. À traiter comme un litige,
pas comme un dossier support.

## Fils impossibles à joindre par le proxy

Cinq fils restent ouverts dans la boîte parce que le proxy rend `address: null` sur chacun de
leurs messages — ni adresse, ni nom, ni objet, et l'un d'eux est entièrement vide. Ce ne sont
probablement pas des courriels mais des conversations d'un autre canal remontées dans cette
boîte. **Il faut les ouvrir à la main dans Missive** pour voir qui écrit.

| Fil | Ce qu'on lit | Ce qu'on sait |
| --- | --- | --- |
| `76a36b03` | « j'ai commandé votre produit avant Noël mais je n'ai jamais reçu. Je vous ai écrit par courriel mais pas de réponse » | rien |
| `c24d7738` | « que je n'ai toujours pas reçu et dont je n'ai plus de nouvelles depuis avant Noël » | rien |
| `7c591b2a` | message vide | rien |
| `a1b5b5a9` | « i placed an order on may 10th and i was just wondering what your typical shipping time is? i had ordered a few packets of milkweed » | prénom « emily » |
| `89df7498` | « Yes. Thank you… You should have my address from the envelope you sent me. 4 Beechwood lane Yardley PA. 19067 » | **L-33754** du 28 avril 2025, 1 sachet d'asclépiade commune expédié sans suivi ; courriel Shopify `sjrc.pres@yahoo.com`. Elle confirmait son adresse en réponse à une offre — un renvoi lui a vraisemblablement été promis |

## Doublons à nettoyer à la main dans Missive

Le dossier **Paulette Pratte** (`ab13967e`) porte jusqu'à quatre fois la même tâche, et six
autres fils portent chacun une tâche en double (André Boily, Patricia Prince, Hugo Poirier,
Claudia Déméné, Marc Bouvet, Géraldine Philippin). Le proxy ne peut pas les supprimer.

## Défauts de fond repérés en vidant la boîte

Ces trois-là ne sont pas des dossiers clients : ce sont les causes qui les ont produits.

1. **Semelles vendues à découvert.** Le produit « Semelles intérieures isolantes » est à
   **−86 au total**, chaque variante étant en `inventoryPolicy: CONTINUE`. On encaisse des
   commandes qu'on ne peut pas honorer — c'est ce qui bloque la ligne 19 ci-dessus.
2. **Le mode de livraison affiché ment.** Des commandes marquées **« Express »** dans
   Shopify partent par courrier ordinaire sans numéro de suivi (L-46229, L-46301). Le
   courriel automatique promet ensuite un suivi qui n'existe pas. Trois courriels du
   batch 14 n'ont pas d'autre cause que celle-là.
3. **L'objet du rappel Klaviyo de panier abandonné** — « Rappel : Votre commande Lasclay
   vous attend 😊 » — fait croire à une commande réelle. Une cliente a tenté d'annuler une
   commande qui n'a jamais existé.
