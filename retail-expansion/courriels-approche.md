# Courriels d'approche des points de vente

Les textes ne vivent pas ici. Ils sont dans `envoyer.js`, qui les remplit et les
envoie. Ce fichier avait déjà divergé du code une fois: la version montrée à
Gabriel disait une chose et le script en envoyait une autre. Pour les lire tels
qu'ils partiront:

```sh
node retail-expansion/envoyer.js --essai --apercu 5
```

Quatre gabarits: premier contact et relance, en français et en anglais. Le
premier contact fait environ 250 mots, la relance 80.

## Ce que le message demande

Un détaillant qui porte la gamme au complet, comme Les Défricheuses à Montréal.
Pas de points de vente partiels: un commerce qui ne prendrait qu'un sac à lunch
sur un coin de tablette est le problème qu'on cherche à corriger, pas la
solution. Le message le dit franchement dès le troisième paragraphe.

En échange: la consignation et l'exclusivité de la région.

## Règles tenues dans ces textes

- **Objet direct.** « Devenir le détaillant Lasclay de votre région ». Pas de
  question rhétorique avec le nom du commerce dedans.
- **Aucun tic de publipostage.** Pas de « Calgary fait partie de notre liste »,
  pas de « votre boutique ressemble à ce qu'on cherche ». Ces formules disent au
  destinataire qu'il reçoit un envoi de masse.
- **Langue: le commerce, pas la zone.** Le Québec reçoit du français. Ailleurs,
  même dans une zone bilingue comme Ottawa ou Sudbury, la langue suit le nom du
  commerce.
- **Vouvoiement.** Contact à froid avec quelqu'un qu'on ne connaît pas.
- **Le compromis tunisien est nommé.** Le détaillant aura la question au
  comptoir; autant qu'il ait la réponse. Formulé comme un service qu'on lui rend.
- **Aucun chiffre inventé.** Plus de soixante produits (71 actifs dans Shopify au
  2026-08-24), manteau autour de 300 $. Les Défricheuses « portent tout », ce que
  la page publique des points de vente confirme. Aucune affirmation de
  performance du genre « notre meilleur détaillant », qu'on ne peut pas prouver.
- **Aucune promesse absolue.** Pas de « un isolant qui n'existe nulle part
  ailleurs »: d'autres entreprises québécoises utilisent l'asclépiade.
- **Jamais « fabriqué au Québec »** pour un produit fini. La soie l'est, le
  produit assemblé ne l'est plus.
- **Jamais qu'un achat sauve un monarque.**
- **Une seule antithèse, choisie.** « le genre de partenariat qu'on cherche à
  répéter, pas un produit isolé sur un coin de tablette ». C'est le tic numéro un
  des textes générés; une par message, à l'endroit où elle porte du sens.
- **Pas de signature dans le corps:** elle s'ajoute automatiquement.
- **Lien du catalogue:** `lasclay.com` en français, `lasclay.com/en` en anglais.
  La racine sert le français, donc un lien nu envoie un anglophone sur une page
  qu'il ne lit pas.
- **Adresse d'envoi:** `admin@lasclay.com`, la boîte de Gabriel. Shopify pointe le
  service client sur `hey@lasclay.com`, qui reste dégagé.

## Bloc légal, obligatoire

La Loi canadienne anti-pourriel exige, dans tout message commercial,
l'identification de l'expéditeur et un mécanisme de désabonnement valide 60
jours. Le fond tient sur le consentement tacite prévu pour une adresse d'affaires
publiée publiquement, quand le contenu concerne le rôle professionnel du
destinataire. C'est aussi pourquoi `confirmer_adresses.js` vérifie que l'adresse
est bien publiée sur le site du commerce: c'est la diligence légale autant que
l'hygiène de liste.

    Les Produits Lasclay inc., 298 boulevard des Capucins, 2e étage,
    Québec (Québec) G1J 3R4, 581 982-5857.

Adresse confirmée par Gabriel le 2026-08-06. Les réponses types de Missive
donnaient aussi 260 et 254; la page publique des points de vente affiche encore
254, ce qui est à corriger séparément puisque des clients s'y présentent pour un
ramassage.

## Grille de relecture

Avant de toucher aux gabarits, relire avec `--apercu` et vérifier:

1. Aucun tic de publipostage.
2. Une seule antithèse.
3. Aucun adjectif d'ambiance sans preuve dans la phrase suivante.
4. Un coût nommé (la Tunisie).
5. De la matière: soie, monarque, Limoilou, inserts amovibles, comptoir.
6. La dernière phrase reste concrète.
7. Test final: ce message pourrait-il être signé par une autre marque
   écoresponsable? Si oui, recommencer.
