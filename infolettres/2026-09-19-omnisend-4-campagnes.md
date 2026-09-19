# Quatre campagnes Omnisend (19 sept. 2026)

Quatre campagnes créées **directement dans Omnisend**, toutes en **brouillon** : rien n'a été
envoyé, et `post_campaigns_id_send` n'a jamais été appelé.

1. Suivi de commande — commandes du 30 mai au 5 septembre 2026 — FR
2. Idem, en anglais
3. Remerciement — précommandes depuis le 12 septembre 2026 — FR
4. Idem, en anglais

## Objets Omnisend

| # | Campagne | Gabarit | Segment | Objet |
| --- | --- | --- | --- | --- |
| 1 FR | `6aae553f5d1a710686ceb875` | `6aae47fcae53f2fc18cd1e91` | `6aae474b1ca5687e4e4fba0d` | Des nouvelles, après ta commande de cet été |
| 2 EN | `6aae55ac6c360aa228151862` | `6aae4834ae53f2fc18cd1eba` | `6aae47a55ea5702c1c8e6486` | Some news, after your summer order |
| 3 FR | `6aae55b26c360aa228151863` | `6aae48f7ae53f2fc18cd1f47` | `6aae47ac5ea5702c1c8e6487` | Merci — ta précommande est notre bon de production |
| 4 EN | `6aae55b86c360aa228151864` | `6aae552dfe9daa7b1822b4bd` | `6aae47c45ea5702c1c8e6488` | Thank you — your preorder is our production order |

Expéditeur `Lasclay <hey@lasclay.com>` (adresse vérifiée du compte, reprise automatiquement).
Langue `fr_FR` sur 1 et 3, `en_US` sur 2 et 4 — c'est la langue de la page de désabonnement.

Aperçus : « Où en sont les préventes, et ce qui s'est passé ici depuis » · « Where the preorders
stand, and what happened here since » · « Ce qui arrive maintenant, et ce que tu n'as pas à
faire » · « What happens now, and what you don't have to do ».

Les mêmes courriels existent en HTML autonome dans `omnisend/` (1 à 4), source des gabarits
importés.

## Segments créés

Tous par `post_segments`, avec l'événement Shopify `placed order` et la propriété
`klaviyo_Language` héritée de la migration Klaviyo.

| Segment | Règle |
| --- | --- |
| `6aae474b1ca5687e4e4fba0d` | commande entre le 2026-05-30 et le 2026-09-05, langue French, courriel abonné |
| `6aae47a55ea5702c1c8e6486` | idem, langue English (les deux formes stockées, `English` et `["English"]`) |
| `6aae47ac5ea5702c1c8e6487` | commande après le 2026-09-11, langue French, courriel abonné |
| `6aae47c45ea5702c1c8e6488` | idem, langue English |

Les quatre sont `ready` et peuplés : vérifié en lisant un contact de chacun des deux segments
extrêmes, avec la bonne langue.

Deux réserves, à trancher avant l'envoi :

- **L'anglais n'est pas restreint au Canada.** Un suivi de commande concerne aussi les clients
  américains ; les segments « English Canada » existants les auraient exclus. À changer si on
  préfère la logique des infolettres Klaviyo.
- **Un contact sans `klaviyo_Language` ne reçoit rien.** Ceux dont la migration n'a pas rempli
  la propriété tombent entre les deux segments. Si on veut les couvrir, il faut élargir le
  segment anglais à « la propriété n'existe pas ».
- Un **doublon du segment 1** traîne dans le compte : `6aae47411ca5687e4e4fba0c`, mêmes règles,
  même nom, créé dix secondes plus tôt par un appel dont la réponse s'est perdue. Aucune
  campagne ne l'utilise ; il peut être supprimé.

## Contenu

### 1 et 2 — suivi de commande (30 mai → 5 sept.)

Ces gens-là ont commandé **entre** les deux préventes : la prévente de mai s'est terminée autour
du 30 mai (remerciement Klaviyo le 31) et celle d'automne a ouvert le 12 septembre. Ils ont
surtout acheté du stock (gants magiques, graines, semelles, polaire, oreiller), plus deux
articles en prévente en ligne tout l'été (boîte d'essai des soins, t-shirts brodés). Le courriel
sépare donc les deux cas au lieu de supposer.

1. Merci pour une commande passée hors des grosses semaines.
2. Article en stock → c'est parti depuis longtemps ; si ça cloche, réponds à ce courriel.
3. Article en prévente → livrable novembre 2026, échanges gratuits, retours au 31 janvier 2027,
   rien à faire.
4. Ce qui s'est passé depuis : la prévente du 12 septembre, une des meilleures de notre
   histoire ; Dragons' Den diffusé jeudi + bouton vers l'épisode CBC.
5. Ce qui reste commandable : six liens.
6. MERCI10, 10 %, sans minimum ni date de fin, réservé aux clients.
7. Signature de Gabriel.

### 3 et 4 — remerciement de précommande (depuis le 12 sept.)

1. Merci. La production démarre une fois les commandes reçues : la précommande est le bon de
   production. « Ta commande a changé un chiffre dans une feuille de production cette semaine. »
2. Ce qui arrive maintenant : livraison novembre 2026, échanges gratuits et retours au
   31 janvier 2027, rien à faire, on écrit quand le colis part.
3. Comment modifier la commande tant que la production n'est pas lancée — répondre au courriel.
4. Dragons' Den diffusé jeudi + bouton vers l'épisode CBC.
5. Compléter la commande dans le même colis : cinq liens.
6. Signature de Gabriel.

## Données vérifiées

- Fenêtre 30 mai → 5 sept. : encadrée par les campagnes Klaviyo réelles (« Réchauffement
  prévente 2026 remerciement » le 31 mai, prévente d'automne le 12 septembre).
- Produits vendus dans la fenêtre (Shopify, `FROM sales … GROUP BY product_title`).
- « Prévente - livrable en novembre 2026. Échanges gratuits et retours possibles jusqu'au
  31 janvier 2027 » : repris mot pour mot des fiches produits Shopify.
- MERCI10 : `ACTIVE`, 10 %, tous les articles, sans minimum, sans date de fin.
- Les 27 liens des quatre courriels répondent 200 (handles anglais lus dans les traductions
  Shopify, jamais `/en` collé devant un handle français).
- Adresse postale du pied de page : adresse de facturation de la boutique Shopify.
- Aucun `<h1>`–`<h6>` dans le HTML importé (Omnisend les refuse), et `[[unsubscribe_link]]`
  présent dans les quatre.

## Règles respectées

- Aucun chiffre de vente, aucune quantité, aucun montant : « une des meilleures préventes
  d'automne de notre histoire », rien de plus.
- Aucune mention de « fabriqué ici » sur un produit textile fini.
- Dragons' Den : mention factuelle de la diffusion et lien vers l'épisode CBC, sans logo, sans
  marque, sans en faire un argument de vente permanent, et sans rien dire de l'issue du tournage.
- Aucune liste INCI inventée.
- Les quatre campagnes restent en `draft`.

## À relire avant l'envoi

- Le gabarit importé arrive dans Omnisend comme **un seul bloc HTML**. Il s'affiche correctement
  mais ne se modifie pas dans l'éditeur visuel ; pour retoucher un paragraphe, éditer le HTML
  ici puis réimporter, ou passer par l'éditeur de code d'Omnisend.
- Le compte n'avait aucune campagne avant celles-ci : ce sont les premiers envois Omnisend.
