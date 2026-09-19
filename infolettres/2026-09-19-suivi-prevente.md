# Suivi de prévente, une semaine après (19 sept. 2026)

Deux brouillons Klaviyo montés le 19 septembre 2026, sur le modèle du suivi envoyé
une semaine après la prévente d'automne 2025 (`Précommande follow-up FR non-acheteur`,
20 sept. 2025). Les deux restent en **Draft** : rien n'a été envoyé.

## Objets Klaviyo

| | FR | EN Canada |
| --- | --- | --- |
| Campagne | `01M2VJH7CAF1F46NKZA2AD4M96` | `01M2VJHE68E35JYE3FKRXBWC72` |
| Message | `01M2VJH7CN00NZF9FJ2WZZC4D4` | `01M2VJHE6GE5BC8PQK78R1RRVN` |
| Gabarit de bibliothèque | `UabrTL` | `X82ai7` |
| Copie de campagne (à relire/éditer) | `TkxmTt` | `VFm3Fb` |
| Cloné depuis | `UQpVrt` (Jour J FR) | `RPfcKU` (Jour J EN) |
| Objet | Une semaine après la prévente | One week after the presale |
| Aperçu | Et ce qui s'est passé à Dragons' Den jeudi | And what happened on Dragons' Den |
| Audiences incluses | T8qXdj, TGKgFC, VEMFYt | QXRzba, UXg6uz |
| Audiences exclues | UXg6uz, WwacXM, Y3Usnk | aucune |
| Date placeholder | 2026-09-19 11:30 UTC | 2026-09-19 12:00 UTC |

Rappel du piège : l'assistant de campagne édite la **copie** (`TkxmTt` / `VFm3Fb`),
pas le gabarit de bibliothèque. Chaque réassignation d'un gabarit crée une copie neuve
et abandonne la précédente.

## Structure (identique dans les deux langues)

1. Bilan de la prévente du 12 septembre, **sans aucun chiffre** : « une des meilleures
   préventes d'automne de notre histoire ». C'est de ces commandes-là que part la production.
2. Les six produits partis le plus vite, un lien par produit, sans quantités.
3. La lecture sur la matière : la soie et les graines de la même cocotte ; quatre des
   produits les plus demandés viennent de la graine (boîte d'essai, savon, crème contour
   des yeux, pinces brunes au tourteau).
4. MERCI10 pour les paniers abandonnés (10 %, illimité, réservé aux anciens clients).
5. Ce qui reste commandable, livrable novembre 2026, retours jusqu'au 31 janvier 2027.
6. Dragons' Den diffusé le 17 septembre, écrit à partir du segment lui-même : Arlene
   Dickinson a fait une offre, acceptée sur le plateau, et la suite sera dite quand elle
   sera connue. Bouton or vers l'épisode CBC
   (`https://www.cbc.ca/dragonsden/episodes/season-21-episode-1`).
7. Appel à l'action + signature de Gabriel.

## Typographie des liens

Les libellés de liens des deux listes (meilleurs vendeurs, ce qui reste commandable)
sont en **gras 16 px**, comme dans les infolettres Jour J, et chaque liste est précédée
d'une raison de cliquer. 19 liens de liste par langue.

Quatre copies de campagne ont été laissées derrière par les réassignations successives :
`YnZvAC` et `Ywuw7P` (FR), `U6vrBD` et `TFADRB` (EN). Elles ne servent plus à rien et
peuvent être supprimées de la bibliothèque.

## Données vérifiées

- Ventes du 12 au 18 septembre 2026 (Shopify, `FROM sales ... GROUP BY product_title`) —
  consultées pour classer les produits, jamais publiées dans le courriel.
- MERCI10 : `ACTIVE`, 10 %, tous les articles, sans minimum, sans date de fin.
- Livraison novembre 2026 et retours 31 janvier 2027 : repris des fiches produits.
- Les 40 liens FR et EN répondent 200 (handles anglais lus dans les traductions Shopify).
- Les 20 fiches liées sont `ACTIVE`, publiées, et toutes leurs variantes sont
  `availableForSale` en `CONTINUE` : aucune n'affichera « épuisé ».
- Aucun résidu d'éditeur dans le HTML des deux gabarits (« This is a text block »,
  `<img>` sans `src`).
- Le bouton or rend bien en HTML de courriel (`<td align="center" class="kl-button"
  bgcolor="#d4ad67">`), dans les deux langues.
- Segment Dragons' Den visionné avant d'écrire la section, plutôt que deviné.

## Règle appliquée

**On ne donne jamais de chiffres précis** : c'est ennuyeux et c'est confidentiel. Tous les
chiffres de vente ont été retirés des deux gabarits. Les seuls nombres restants dans le
texte visible sont le 10 de MERCI10, la date du 14 septembre, la saison 21 de l'émission,
et les dates de livraison et de retour (novembre 2026, 31 janvier 2027).

## À trancher avant l'envoi

- Le passage Dragons' Den s'arrête à « Arlene Dickinson a fait une offre, je l'ai acceptée
  sur le plateau, et la suite sera dite quand on la saura ». Les termes annoncés à l'écran
  ont été laissés de côté sous la règle des chiffres.
- Les quatre copies de campagne orphelines peuvent être supprimées sur un mot.
