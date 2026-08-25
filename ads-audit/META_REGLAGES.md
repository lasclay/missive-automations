# Réglages Meta — état constaté et décisions

Vérifié par l'API le 25 août 2026. Comptes : Québec `363736411681046`,
USA `359131645638217`. Jeu de données `1038224283301175`.

## Audiences créées le 25 août 2026

Huit audiences de site web, quatre par compte, avec `prefill: true`.

| Audience | Rétention | Événement | Québec | USA |
| --- | --- | --- | --- | --- |
| Vue produit 30 j | 30 j | `ViewContent` | `120245744139410609` | `120250397377420305` |
| Ajout au panier 30 j | 30 j | `AddToCart` | `120245744139820609` | `120250397378140305` |
| Paiement entamé 14 j | 14 j | `InitiateCheckout` | `120245744139970609` | `120250397377600305` |
| Acheteurs 180 j (exclusion) | 180 j | `Purchase` | `120245744141450609` | `120250397376520305` |

Meta a enrichi les règles de lui-même avec les sources `shopping_page` et
`shopping_ig` (boutiques Facebook et Instagram), en plus du pixel.

**Le remplissage prend de quelques heures à 24 h.** Juste après la création,
le code d'opération est `441` (audience trop petite) et la taille affiche la
valeur plancher de 20 — c'est normal, pas une erreur.

### Pourquoi les anciennes audiences étaient à 20

« Visiteurs site web 180 j. » (`23851361772160608`) n'était **pas cassée** :
sa règle `ALL_VISITORS` sur le bon pixel est correcte. Son code d'opération est
`100 — Not used in active ad for extended period`. **Meta cesse d'alimenter une
audience de site web qui n'est attachée à aucune publicité active pendant une
période prolongée.**

Conséquence directe : les huit nouvelles audiences vont décliner exactement
pareil si elles ne sont pas attachées à un ensemble actif. Il faut les utiliser,
pas seulement les créer.

## Catalogue `1198507480521979`

59 produits, 62 ensembles de produits — il n'est pas vide, mais ce qui est
**visible** l'est presque :

| Diagnostic | Éléments touchés | Canal |
| --- | --- | --- |
| Hors stock | **112** | dynamic ads |
| Archivé | **116** | boutiques |
| Moins de 2 images | **351** | tous |
| Prix / titre / disponibilité / condition manquants | 3 chacun | tous |
| Devise non conforme | 3 | boutiques |
| Content IDs sans correspondance | 17 | pixel |

Décision : on ne lance **pas** de campagne catalogue (le storytelling performe
mieux pour Lasclay). Mais l'aperçu catalogue placé sous les publicités tire sur
ce même stock — il faut nettoyer la disponibilité et les images.

## Stratégie d'enchère — CPA d'équilibre

```
CPA d'équilibre = panier net × marge de contribution
```

| Exercice | Panier net | Contribution | CPA d'équilibre | CPA Meta réel | CPA mixte réel |
| --- | --- | --- | --- | --- | --- |
| FY2024 | 59,27 $ | 51,9 % | **30,76 $** | 16,86 $ | 13,90 $ |
| FY2025 | 56,47 $ | 57,5 % | **32,47 $** | 20,85 $ | 16,22 $ |
| FY2026 | 79,67 $ | 48,5 % | **38,64 $** | 31,48 $ | 22,29 $ |

Le CPA Meta ne compte que les achats que Meta s'attribue (71 % des commandes en
FY2026). Le CPA mixte rapporte la dépense à **toutes** les commandes.

**Décision : plafond de coût à 28 $ sur les ensembles de prospection** — 27 %
sous le seuil d'équilibre. Laisser les ensembles de reciblage en « volume le
plus élevé » : leurs audiences sont trop petites pour un plafond.

## Attribution

Trois fenêtres coexistent, ce qui rend les ROAS non comparables entre ensembles :

| Fenêtre | Ensembles concernés | Dépense |
| --- | --- | --- |
| `1d_view_7d_click` | la majorité, dont les deux plus gros | ~ 200 k$ |
| `7d_click` | « C general » (Ontario), « USA Northern states », « C general » US+CA | ~ 21 k$ |
| `1d_view_7d_click_1d_ev` | « Statique » (QC), « statique » Plantation 2026 | ~ 20 k$ |

**Décision : tout ramener à `1d_view_7d_click`** — c'est déjà la fenêtre des
deux plus gros ensembles, donc l'historique reste comparable, et le cycle de
vente de Lasclay traîne sur trois jours après un envoi d'infolettre (une fenêtre
d'un jour sous-compterait).

Effet secondaire à connaître : les ensembles en `7d_click` seul paraissent
moins bons qu'ils ne le sont, faute de compter les achats après affichage.
« C general » Ontario (ROAS 2,57, `7d_click`) et « Video C hiver » Ontario
(ROAS 3,28, `1d_view_7d_click`) ciblent la même province et **n'ont jamais été
comparables**.

## Placements — ce que dit le compte

Aucun outil de l'API ne donne la répartition par placement. Comparaison au
niveau des ensembles, tout l'historique :

| Ensemble | Placements | Dépense | ROAS | CPA |
| --- | --- | --- | --- | --- |
| 2024 Conversion statique USA general | Facebook fil seul | 39 676 $ | 2,00 | 14,65 $ |
| Video USA graines P25 | FB + Instagram + Messenger + Threads | 33 645 $ | 1,87 | 17,79 $ |
| **Video C hiver** (Ontario) | **Facebook élargi** : fil, Reels, Story, in-stream | 18 715 $ | **3,28** | 36,55 $ |
| C general (Ontario) | Facebook fil seul | 14 233 $ | 2,57 | 40,66 $ |

L'ensemble avec Instagram fait 7 % de moins en ROAS que l'ensemble sans — mais
les créatifs diffèrent (vidéo contre statique), donc ce n'est pas un test.
En revanche, **l'élargissement à l'intérieur de Facebook** (Reels, Story,
in-stream) donne le meilleur ROAS des gros ensembles.

Décision : ne pas ouvrir Instagram. Ouvrir Facebook Reels, Story et in-stream
sur l'ensemble à 95 196 $, qui tourne au fil seul à une fréquence de 11,5.
Pour trancher sur Instagram : Gestionnaire de publicités → Répartition →
Par diffusion → Plateforme.

## Signal CAPI

| Événement | Qualité | Couverture courriel | Fréquence d'envoi |
| --- | --- | --- | --- |
| Purchase | **9,3** | 100 % | horaire |
| AddPaymentInfo | 7,8 | 75 % | temps réel |
| InitiateCheckout | 7,4 | 63 % | horaire |
| PageView | 6,6 | 22 % | temps réel |
| AddToCart | **6,3** | **10,5 %** | horaire |
| Search | 6,1 | 11 % | temps réel |
| ViewContent | **6,0** | 16,5 % | horaire |

L'achat est parfait, les événements amont — ceux qui servent à **prédire** qui
va acheter — ne le sont pas. L'identifiant de clic Meta (`fbc`) manque sur 59 %
des pages vues.

Deux réglages : **correspondance avancée automatique** dans les paramètres du
jeu de données (Gestionnaire d'événements), et **niveau de partage de données
« Maximum »** dans l'app Facebook & Instagram de Shopify.

Meta signale de son côté une occasion `capi_event_coverage` sur le compte USA.
