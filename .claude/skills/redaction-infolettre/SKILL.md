---
name: redaction-infolettre
description: Rédiger et monter une infolettre Lasclay dans Klaviyo, en français comme en anglais. Couvre la méthode éditoriale tirée des infolettres qui ont réellement fonctionné, la mécanique des gabarits glisser-déposer, le piège de la copie de campagne, la construction des liens produits FR et EN, et la liste de vérification obligatoire avant tout envoi.
when_to_use: Déclenche dès qu'il faut écrire, réécrire, comparer ou monter une infolettre, une campagne Klaviyo, un courriel de prévente ou une annonce à la liste. Déclenche même sans le mot Klaviyo — « écris l'infolettre de samedi », « prépare le courriel qui annonce les nouveaux produits », « compare ma version à la tienne », « monte le brouillon », « pourquoi les liens ne trackent pas ».
argument-hint: [l'infolettre à rédiger ou à monter]
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Bash
  - Skill
---

# Rédaction d'infolettre — Lasclay

Charge aussi `copywriting-lasclay` pour la voix et `lasclay-master` pour le contexte.
Ce skill-ci ajoute ce que les deux autres ne disent pas : la méthode propre à l'infolettre,
et toute la mécanique Klaviyo.

Convention d'écriture : pas de cadratins. Virgules, deux-points, parenthèses ou tirets simples.

## 1. Le principe qui distingue une bonne infolettre d'une mauvaise

**Explique la matière avant d'annoncer le produit.**

C'est la leçon la plus chère de la session d'août 2026. Une version annonçait quatre soins
avec l'image « l'huile dormait dans un seau » : joli, mais creux. La version retenue par
Gabriel expliquait d'abord la plante, et le produit devenait évident :

> La partie qu'on récolte, c'est la cocotte soyeuse, ou le follicule de son vrai nom. La soie
> constitue environ 20 % de son poids, les graines environ 30 %. Or presque rien n'était fait
> avec les semences. Nous savions qu'elles contenaient environ 10 % d'huile, mais avec le
> laboratoire du CRIQ, nous avons découvert à quel point elle était exceptionnelle.

Le lecteur de Lasclay est là pour l'asclépiade, pas pour un rabais. Un chiffre vérifiable
(20 %, 30 %, 10 %) et une source nommée (CRIQ, avec le lien) valent dix adjectifs.

**Corollaire** : si tu ne connais pas la matière, demande-la avant d'écrire. Ne comble pas
avec une métaphore. Le fait « l'asclépiade ne se tisse pas » explique pourquoi les t-shirts
sont en coton ; sans lui, la mention du coton n'est qu'un aveu gênant.

## 2. Les cinq réflexes de l'infolettre

1. **Effet sandwich.** Le plus percutant en ouverture, le moins spectaculaire au ventre, un
   morceau fort à la fermeture. Gabriel l'a formulé ainsi : mettre un cache-cou pour enfant en
   premier, « ça ne ferait pas un gros punch ».
2. **Raconter plutôt que teaser.** Une vraie histoire bat un mystère. Le projet de pinces
   recyclées valait mieux raconté en entier (les moules d'injection 3D, Unique Plastique, la
   cohorte de l'Académie Entrepreneuriale, la route vers Toronto) que gardé pour plus tard.
   Garde le mystère seulement quand tu n'as pas d'histoire.
3. **Assumer l'incertitude, elle rend crédible.** « Il reste des tests à faire et rien n'est
   garanti, mais on aimerait beaucoup » est plus fort qu'une promesse lisse.
4. **L'humour désamorce l'aveu.** « Ils sont en coton et non en asclépiade (qui ne se tisse
   pas) : on préfère le dire tout de suite 😅 ». Même fait qu'une formulation sèche, effet
   inverse.
5. **Parler usage, pas géométrie.** Pour l'isolant mince, « un petit produit d'automne ou de
   printemps » et « sans transpirer pour les entre-saisons » portent mieux que « sans perdre la
   forme de l'objet ». Décris ce que la personne fera avec, pas ce que l'objet est.

## 3. Les liens — la raison d'être des statistiques

Sans lien par produit, aucune donnée par produit. C'est le premier truc à protéger quand on
raccourcit un courriel : coupe les descriptions, garde les liens.

- **FR** : `https://lasclay.com/products/<handle>`
- **EN** : `https://lasclay.com/en/products/<handle-anglais>`

**Les handles anglais sont traduits dans Shopify et ne sont PAS les mêmes qu'en français.**
Ne colle jamais `/en` devant un handle français. Va lire la traduction :

```graphql
translatableResourcesByIds(first: 10, resourceIds: [...]) {
  nodes { resourceId translations(locale: "en") { key value } }
}
```

Exemple réel : `shampoing-huile-asclepiade` en FR, `milkweed-oil-shampoo` en EN.

**Vérifie les handles le jour de l'envoi.** Ils changent quand quelqu'un renomme une fiche.
Un handle est passé de `shampooing-` à `shampoing-` en cours de session : lien mort.

Mets le libellé du lien en gras 16 px et précède la liste d'une raison de cliquer
(« Pour en savoir plus: »). Klaviyo suit les clics par lien si `add_tracking_params` est actif.

## 4. Klaviyo — la mécanique, et son piège

### Le piège de la copie de campagne

Quand on rattache un gabarit à une campagne, **Klaviyo en fait une copie**. Il y a donc deux
objets, et ils divergent dès la première correction :

| Objet | Ce que c'est | Qui l'édite |
| --- | --- | --- |
| Gabarit de bibliothèque | la version d'origine | l'API, au moment du montage |
| Copie de campagne (`Clone of …`) | **ce que l'assistant de campagne modifie** | l'humain, ensuite |

Avant de comparer deux versions ou de relire une modification, **lis la copie de campagne**,
pas le gabarit. Récupère son id via la relation `template` du `campaign-message`.

### Modifier un gabarit

Les gabarits Lasclay sont en `SYSTEM_DRAGGABLE` (glisser-déposer).

- `update_email_template` (HTML) **retourne 400** sur ces gabarits. Ne l'utilise pas.
- Utilise `update_dnd_email_template` avec la `definition` structurée. Elle **remplace tout** :
  relis d'abord, modifie, renvoie l'objet complet (`body.sections`, `styles`, `id`,
  `template_id`).

### Montage d'un brouillon, dans l'ordre

1. `clone_email_template` depuis la dernière campagne de la bonne langue — garde entête,
   pied de page, polices, couleur de lien `#d4ad67` et bloc de désabonnement.
2. `get_email_template` avec `additional_fields_template: ["definition"]`.
3. `update_dnd_email_template` avec le nouveau contenu.
4. `create_campaign` avec les audiences.
5. `assign_template_to_campaign_message`.

Sans `send_campaign`, la campagne reste en `Draft`. C'est le bon état par défaut.

### Audiences observées en août 2026

Ne les copie pas les yeux fermés, elles bougent : vérifie sur la dernière campagne envoyée.

- **FR** : incluses `T8qXdj`, `TGKgFC`, `VEMFYt` — exclues `UG8xUu`, `UXg6uz`, `WHUVwL`, `WwacXM`, `Y3Usnk`
- **EN** : incluses `QXRzba`, `UXg6uz`, `WwacXM`, `Y3Usnk` — exclue `TmJKc6`
- **Médias FR** : liste `W4JX2p`

## 5. Vérification obligatoire avant l'envoi

Un lien mort coûte plus cher qu'une phrase moyenne.

- [ ] **Chaque fiche produit est-elle en `ACTIVE` et publiée sur la boutique en ligne?** Un
      produit en `DRAFT` donne un 404. Vérifier `status` ET `onlineStoreUrl`.
- [ ] **Le stock permet-il d'acheter?** `inventoryQuantity: 0` avec `inventoryPolicy: DENY`
      affiche « épuisé ». Comparer avec les variantes jumelles du même produit.
- [ ] **Les handles FR et EN sont-ils exacts aujourd'hui?**
- [ ] **Les prix cités dans le texte correspondent-ils à Shopify?**
- [ ] **La copie de campagne contient-elle des résidus?** Chercher « This is a text block »,
      les `<img>` sans `src`, les paragraphes vides. L'éditeur glisser-déposer en laisse.
- [ ] **L'objet et l'aperçu décrivent-ils encore le contenu?** Après réécriture, un objet qui
      promet « une dernière qu'on ne montre pas encore » devient faux si la surprise est
      révélée dans le corps.
- [ ] **Les formats et volumes sont-ils cohérents entre FR et EN?** Un écart 250 ml / 100 ml
      s'est déjà glissé entre les deux versions d'une même crème.

## 6. Garde-fous de contenu

**Cosmétiques.** Ne jamais inventer une liste d'ingrédients. La nomenclature INCI est une
obligation d'étiquetage au Canada, pas du texte de vente. N'écris que ce que la fiche affirme
déjà, et si la liste manque, dis qu'elle sera publiée avant la mise en vente.

**Marques de tiers.** CBC interdit l'usage de ses logos et marques sans licence, y compris la
formule « vu à Dragons' Den ». Mentionner factuellement une date de diffusion est ce que la
production encourage ; s'en servir comme argument de vente permanent ne l'est pas. Ne jamais
révéler l'issue d'un tournage avant sa diffusion.

**Origine.** Jamais « fabriqué ici » sur un produit textile fini. Reste vrai : culture et
transformation de l'asclépiade au Québec, conception, cosmétiques mélangés à Québec.

**Rabais.** Ne réinvente pas la mécanique : va la lire dans la campagne précédente. En
septembre 2026 c'était 25 % de 9 h à 11 h le 12, puis 18 % jusqu'à minuit, puis 12 % le 13,
avec des codes distincts. Si elle a déjà été détaillée dans un envoi précédent, une seule
ligne de rappel suffit.

## 7. Comparer deux versions

Quand Gabriel réécrit, fige d'abord une base sur disque, sinon la comparaison se perd :
un fichier par version, avec l'id du gabarit et l'horodatage. Puis rends un écart bloc par
bloc, en séparant trois choses : ce qui a été supprimé, les résidus techniques, et ce que la
réécriture gagne. Sur la voix, c'est lui qui tranche.
