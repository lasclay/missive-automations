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

Dernière mise à jour : 2026-08-19. Assignées à Catherine Bedard-Mercier et Gabriel Gouveia.

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

## Conditionnels — rien à faire tant que le client n'a pas répondu

| Client | Fil | Déclencheur |
| --- | --- | --- |
| Marc-Olivier Gilbert | `eebad7e6` | remboursement de 68,97 $ **ou** sac de remplacement, à son choix |
| Hugo Poirier | `71abd7ec` | remboursement de 51,42 $ s'il juge l'attente jusqu'à l'automne trop longue |
| Cheryl Warner, Donna Burzynski, Georgia Hoffmann, Bob Barth | — | renvoi ou remboursement s'ils confirment n'avoir jamais reçu leurs graines |
| Andrew Lawson | `5a789699` | expédition d'un sac à lunch + nouvelle adresse s'il confirme n'avoir rien reçu |

## Réglé

Simon Déry — remboursement de 6,60 $, transaction `PENDING` chez Shopify Payments depuis le
2026-08-18 19 h 20. Patricia Prince — 4,28 $, `PENDING` depuis 18 h 48 le même jour.

## Doublons à nettoyer à la main dans Missive

Le dossier **Paulette Pratte** (`ab13967e`) porte jusqu'à quatre fois la même tâche, et six
autres fils portent chacun une tâche en double (André Boily, Patricia Prince, Hugo Poirier,
Claudia Déméné, Marc Bouvet, Géraldine Philippin). Le proxy ne peut pas les supprimer.
