# Instruction Cowork : politiques Shopify, barre Hextom, courriel de confirmation

Contexte : Lasclay a changé sa politique le 4 septembre 2026. Échanges gratuits au Canada,
retour avec remboursement à 9,99 $ de frais, 15 jours, état neuf, livraison gratuite dès
99 $. Tout le site est déjà à jour, sauf trois choses qui se font seulement dans le
navigateur. Fais-les dans l'ordre. Ne touche à rien d'autre.

Connexion : admin Shopify de lasclay.com (compte admin@lasclay.com). Langue de
l'interface : peu importe, les chemins ci-dessous sont donnés en français et en anglais.

## 1. Politique de remboursement (Paramètres > Politiques)

Chemin : Paramètres (Settings) > Politiques (Policies) > Politique de remboursement
(Refund policy). Si un texte existe déjà (une ligne en anglais « 15 days after reception
for refunds… »), efface-le complètement. Passe l'éditeur en mode HTML (icône `<>`) et
colle exactement ceci, puis Enregistrer :

```html
<h2>Échanges gratuits au Canada</h2>
<p>Pas la bonne taille, pas la bonne couleur? On échange gratuitement, partout au Canada: bordereau de retour prépayé, aucuns frais de manutention. Vous avez 15 jours après la réception pour nous écrire à hey@lasclay.com ou par Messenger, avec votre numéro de commande. L'article doit être à l'état neuf, non porté, non lavé, sans odeur ni marque. Vous avez ensuite 10 jours pour poster le colis. L'article de remplacement part dès la réception et l'inspection du vôtre.</p>
<h2>Retours et remboursements</h2>
<p>Vous préférez un remboursement? Même délai de 15 jours, même état neuf, même bordereau prépayé. Des frais de manutention de 9,99 $ sont retenus sur le remboursement; ils couvrent une partie des frais postaux. Le remboursement revient sur le mode de paiement d'origine dans les 5 à 10 jours ouvrables suivant l'inspection.</p>
<h2>Ce qui n'est pas admissible</h2>
<p>Les articles en vente finale et ceux de la section Les Imparfaits ne sont ni repris ni échangés. Seuls les achats faits sur lasclay.com sont admissibles. Hors Canada, écrivez-nous: on trouve une solution, mais les frais de transport du retour ne sont pas couverts.</p>
<h2>Un défaut?</h2>
<p>Une couture qui lâche, une pièce manquante, un mauvais article reçu: écrivez-nous avec une ou deux photos et votre numéro de commande, même après la période de retour. On règle ça sans vous faire renvoyer le produit dans la plupart des cas.</p>
```

## 2. Politique d'expédition (même écran)

Chemin : Paramètres > Politiques > Politique d'expédition (Shipping policy). Le champ est
vide. Mode HTML, colle ceci, Enregistrer :

```html
<h2>Livraison</h2>
<p><strong>Canada.</strong> Livraison Xpresspost gratuite dès 99 $ d'achat. Sous ce montant, 6,99 $ en livraison standard ou 9,99 $ en Xpresspost. Les articles très légers, comme les graines, partent par timbre à 2,99 $, sans suivi. Délais après expédition: 2 à 5 jours ouvrables au Québec, 4 à 8 en Ontario et dans les Maritimes, 6 à 8 au Manitoba, 7 à 10 en Saskatchewan, en Alberta et en Colombie-Britannique.</p>
<p><strong>États-Unis.</strong> 6,99 $ US sous 59,99 $ US d'achat, gratuite à partir de 59,99 $ US.</p>
<p><strong>Ailleurs.</strong> Royaume-Uni, France, Belgique, Suisse, Australie, Nouvelle-Zélande et Mexique: les frais s'affichent au panier selon la destination.</p>
<p>Les produits en précommande partent après la date indiquée sur leur fiche. Vous recevez un courriel avec le numéro de suivi au moment de l'expédition. Les échanges sont gratuits au Canada: voir la politique de remboursement.</p>
```

Vérification : ouvre https://lasclay.com/policies/refund-policy et
https://lasclay.com/policies/shipping-policy, les deux textes doivent s'afficher. Ensuite,
dis à Claude Code que c'est fait : il enregistrera la version anglaise par l'API (les
politiques sont traduisibles, seule l'écriture du français est bloquée pour lui).

## 3. Barre Hextom « Free Shipping Bar »

Chemin : Applications (Apps) > Free Shipping Bar (Hextom). Ouvre la barre active. Dans les
messages, remplace tout seuil différent de 99 $ par 99 $ (message initial « Livraison
gratuite dès 99 $ », message de progression « Plus que {{remainder}} avant la livraison
gratuite », message atteint « Vous avez la livraison gratuite! »). Si l'application permet
plusieurs barres en rotation, ajoute une seconde barre au même style avec le texte
« Échanges gratuits au Canada » / « Free exchanges in Canada » (version anglaise si
l'application gère les langues). Enregistre et vérifie sur lasclay.com.

## 4. Courriel de confirmation de commande

Chemin : Paramètres > Notifications > Notifications client > Confirmation de commande
(Order confirmation) > Modifier le code. Cherche la ligne qui contient
`{{ email_body }}` ou le premier paragraphe de texte après le titre. Ajoute juste après ce
paragraphe :

```liquid
<p>Pas la bonne taille? L'échange est gratuit au Canada. Écrivez-nous à hey@lasclay.com dans les 15 jours suivant la réception.</p>
```

Enregistre, puis utilise « Envoyer un courriel de test » pour vérifier l'affichage. Ne
modifie rien d'autre dans le gabarit.

## Ce qu'il ne faut PAS faire

- Ne publie pas le thème « sep 2026 ». Ne modifie aucun thème.
- Ne change pas les tarifs d'expédition ni leurs noms : déjà faits.
- Ne touche pas aux pages, à la FAQ ni aux menus : déjà faits.
