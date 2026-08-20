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

Dernière mise à jour : 2026-08-19 (batch 14). Toutes assignées à Catherine Bedard-Mercier
et Gabriel Gouveia.

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

## Conditionnels — rien à faire tant que le client n'a pas répondu

| Client | Fil | Déclencheur |
| --- | --- | --- |
| Marc-Olivier Gilbert | `eebad7e6` | remboursement de 68,97 $ **ou** sac de remplacement, à son choix |
| Hugo Poirier | `71abd7ec` | remboursement de 51,42 $ s'il juge l'attente jusqu'à l'automne trop longue |
| Sara Usher | `eb882b81` | remboursement de ses 3 sachets s'ils ne sont jamais arrivés |
| Emma Nelson | `fd4fbc13` | échange de couleur **ou** annulation + remboursement de 68,31 $ |
| Andrew Lawson | `5a789699` | expédition d'un sac à lunch + nouvelle adresse s'il confirme n'avoir rien reçu |
| Cheryl Warner, Donna Burzynski, Georgia Hoffmann, Bob Barth | — | renvoi ou remboursement s'ils confirment n'avoir jamais reçu leurs graines |

## Réglé

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
