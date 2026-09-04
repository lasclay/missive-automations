# FAQ lasclay.com, refonte

Une FAQ dont le **contenu s'édite dans l'admin Shopify** (Contenu > Pages > FAQ, mode HTML)
et dont la **mise en forme vit dans le thème** (une section, un gabarit). Aucune app.

## Pourquoi

- La page FAQ en ligne n'utilise pas l'app « SB: FAQ | HelpCenter » : ses 16 questions sont des
  sections « Expandable content » du thème Showcase, dans `templates/page.faq.json`. Le corps de
  la page est vide dans l'admin parce que tout est dans le thème. L'app peut être désinstallée.
- Une deuxième page orpheline existe, `pages/avada-faqs` (app Chatty), publiée mais vide de sens.
  À dépublier.
- L'ordre actuel commence par « Pourquoi le nom Lasclay? ». Sur deux ans de boîte support, les
  demandes sont : suivi de livraison (3728 fils), questions avant achat, surtout la taille (1802),
  modification et annulation (967), problème produit et garantie (930), retours et échanges (880).
  La nouvelle FAQ suit cet ordre. Les graines et bombes semencières, absentes de la FAQ actuelle
  alors qu'elles génèrent 26 réponses types, ont leur section.

## Fichiers

| Fichier | Rôle | Où ça va |
| --- | --- | --- |
| `faq-page-body.html` | le contenu : réponses rapides, 8 sections, 36 questions | corps de la page FAQ, dans l'admin |
| `sections/main-faq-html.liquid` | la coquille : en-tête, recherche, sommaire collant, icônes, accordéons, contact, données structurées FAQPage | `sections/` du thème |
| `templates/page.faq-html.json` | le gabarit qui appelle la section | `templates/` du thème |

Le contenu de `faq-page-body.html` reprend les réponses actuelles, raccourcies, plus des réponses
tirées des réponses types du support (`connaissance_support.md`). Les points à trancher avant
publication sont listés dans la maquette (notes « À valider ») et plus bas.

## État au 4 septembre 2026

- Le **corps de la page FAQ** (Contenu > Pages > FAQ) contient le nouveau contenu, poussé par
  l'API. Le thème en ligne l'ignore (son gabarit n'affiche pas le contenu de page), donc le site
  public n'a pas changé.
- Le thème brouillon **« sep 2026 »** contient la section `main-faq-html`, les deux gabarits et
  une copie de secours du contenu (`snippets/faq-content.liquid`). Son gabarit `page.faq` lit le
  corps de la page : l'aperçu de « sep 2026 » sur `/pages/faq` montre la nouvelle FAQ telle
  qu'elle est dans l'admin.
- Toute modification se fait désormais dans l'admin, en mode HTML. Ce dépôt garde la copie
  maîtresse (`faq-page-body.html`) : en cas de page abîmée, on la recolle.

## Mise en place (une fois)

1. Dupliquer le thème en ligne (Boutique en ligne > Thèmes > Dupliquer). Travailler sur la copie.
2. Dans l'éditeur de code de la copie : ajouter `sections/main-faq-html.liquid` et
   `templates/page.faq-html.json` (contenus de ce dossier).
3. Contenu > Pages > FAQ : ouvrir l'éditeur en mode HTML (bouton `<>`), coller le contenu de
   `faq-page-body.html`, choisir le gabarit **page.faq-html** dans le panneau de droite,
   enregistrer.
4. Prévisualiser la copie du thème sur `/pages/faq`, ajuster les textes de la section dans
   l'éditeur de thème (titre, phrase d'intro, courriel, lien Messenger), puis publier la copie.
5. Traduction anglaise : Translate & Adapt > Pages > FAQ, traduire le corps (un seul champ HTML).
   Les réglages de la section se traduisent sous Thème.
6. Ménage : désinstaller SB: FAQ | HelpCenter, dépublier `pages/avada-faqs`, retirer le bandeau
   « grève Postes Canada 2024 » de `pages/expedition`.

## Éditer le contenu ensuite

Tout se fait dans Contenu > Pages > FAQ, en mode HTML. Règles :

- une section = `<section class="faq-group" id="…" data-icon="…">` avec un `<h2>` et un
  `<p class="faq-intro">` facultatif. Icônes : `truck`, `ruler`, `return`, `warm`, `sprout`,
  `leaf`, `card`, `brief`;
- une question = `<details id="…"><summary>Question</summary><div class="faq-answer">…</div></details>`;
- l'ordre dans le HTML est l'ordre affiché, et le sommaire se construit tout seul;
- ne pas coller de `<svg>` ni de `<script>` : l'éditeur les retire. Les icônes viennent de
  `data-icon`;
- éviter de basculer en mode visuel puis de sauvegarder, l'éditeur peut réécrire le HTML.

Pour aller plus loin un jour : passer les questions en **métaobjets** (Contenu > Métaobjets),
une entrée par question avec catégorie, ordre et traduction champ par champ, et réutiliser les
mêmes entrées sur les fiches produit (« taille », « entretien », « livraison »). C'est le
prochain palier, pas un prérequis.

## Points à trancher avant publication

- Frais sous 100 $ : 7,99 $ (FAQ) ou 9,50 $ (page Expédition)? Délais au Québec : 2 à 5 ou
  4 à 8 jours ouvrables?
- Frais de retour : tranché le 4 septembre, 7,99 $ sur tout retour ou échange, pour prévenir les abus.
- Livraison hors Canada : Shopify expédie vers 9 pays. Que fait-on si les douanes américaines
  saisissent des graines?
- Ramassage à l'atelier et point de cueillette à Montréal : encore offerts?
- Modes de paiement : ajouter Shop Pay, Apple Pay, Google Pay?
- Codes promo : un seul par commande? Application rétroactive?
- « Où sont fabriqués vos produits? » : nouveau texte aligné sur le virage manufacturier, à
  valider par Gabriel.
- Garantie : nommer une durée ou garder la formulation ouverte?
- Personnalisation corporative : minimum de 15 articles?
