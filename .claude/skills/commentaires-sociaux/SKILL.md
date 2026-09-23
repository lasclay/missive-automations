---
name: commentaires-sociaux
description: >-
  Commenter chez les autres au nom de Lasclay, la « canne à pêche » grassroots sur Instagram et
  Facebook : laisser sous la photo d'asclépiade ou de monarque d'un inconnu un commentaire
  naturel, précis et non sollicitant, depuis le bon compte (@lasclay et la Page Lasclay en
  français, @milkweed.company et la Page Lasclay: The Milkweed Company en anglais). Couvre la
  recherche des publications, le tri, l'écriture, le changement d'identité dans le navigateur, les
  plafonds, les signaux de blocage qui arrêtent tout et le journal anti-doublons. Aucune API ne
  commente chez un tiers : tout passe par Cowork et Chrome. Déclenche pour la tâche Cowork de
  pêche et dès qu'il faut commenter la publication de quelqu'un d'autre au nom de Lasclay, même
  sans le mot pêche : « va commenter des photos d'asclépiade », « fais du grassroots sur Insta »,
  « Instagram m'a bloqué une action ». Pour répondre aux commentaires reçus sur NOS Pages, c'est
  fb-backlog, pas ce skill.
---

# Commentaires sortants — la canne à pêche

## L'idée, et pourquoi elle marche seulement si on la fait bien

Quelqu'un publie une photo d'asclépiade. Lasclay laisse un mot sincère et précis sur sa photo. La
personne est touchée, clique sur le profil, découvre ce qu'on fait, s'abonne. On gagne des gens
**déjà convaincus** par la plante.

Ça marche parce que le commentaire ne vend rien. Il parle de **sa** photo. Le jour où un
commentaire Lasclay ressemble à une publicité ou à un robot, la pêche devient du pourriel, et
Instagram comme les gens le traitent comme tel.

## Le risque, dit une fois

Les conditions d'Instagram et de Facebook interdisent l'interaction automatisée. Gabriel l'a su
et a choisi ce mode le 23 septembre 2026. Ce qui protège le compte, c'est de se comporter
exactement comme une personne attentive : peu de commentaires, tous différents, tous précis,
à un rythme humain, et **l'arrêt immédiat** au premier signal de blocage. Ces règles ne sont pas
de la prudence décorative : un compte Instagram de marque suspendu, c'est une perte bien plus
grande que tout ce que la pêche peut rapporter.

## Les quatre identités

| Langue | Plateforme | Identité | Comment s'y placer |
| --- | --- | --- | --- |
| FR | Instagram | **@lasclay** | menu du profil → changer de compte |
| FR | Facebook | Page **Lasclay** | sélecteur de profil → « Lasclay » |
| EN | Instagram | **@milkweed.company** | menu du profil → changer de compte |
| EN | Facebook | Page **Lasclay: The Milkweed Company** | sélecteur de profil → cette Page |

**Avant chaque commentaire, vérifie l'identité affichée à côté de la boîte de commentaire.**
Jamais depuis le profil personnel de Gabriel, jamais depuis @asclepiadepapillons ni les Pages
monarques (elles ne pêchent pas). Identité douteuse : on ne publie pas.

Langue : une identité française ne commente qu'une publication en français, une identité
anglaise qu'une publication en anglais. Une publication sans texte se juge au profil de son
auteur.

## 1. Avant de commencer : l'état

Dans le dossier de travail de la tâche, deux fichiers (les créer s'ils n'existent pas) :

- `peche-etat.json` : `{ "premier_jour": "2026-09-24", "pause_jusqua": { "instagram": null, "facebook": null }, "blocages": [] }`
- `peche-journal.jsonl` : une ligne par commentaire publié (format plus bas).

Si `pause_jusqua` d'une plateforme est dans le futur, **cette plateforme ne se touche pas**
aujourd'hui, même pas pour aimer une photo.

## 2. Plafonds et cadence

| | Par identité et par jour |
| --- | --- |
| Rodage (14 premiers jours depuis `premier_jour`) | **3** commentaires |
| Ensuite | **6** commentaires |
| Plafond absolu, jamais dépassé | 8 |
| Samedi et dimanche | la moitié, arrondie à l'inférieur |

- Compte ce qui est **déjà** au journal pour aujourd'hui avant de commencer.
- Entre deux commentaires d'une même identité : **3 à 12 minutes**, tirées au hasard, jamais le
  même écart deux fois de suite. Aime la publication, lis-la, puis commente : un humain ne
  commente pas en deux secondes.
- Aime aussi, sans commenter, une ou deux autres belles publications rencontrées en chemin. Pas
  plus.
- Rien entre 22 h et 7 h, heure de l'Est.
- Ne jamais enchaîner les quatre identités en rafale : termine une identité, fais une pause d'au
  moins 10 minutes, passe à la suivante.

## 3. Trouver des publications

**Instagram** : recherche par mot-clé et par hashtag. Change de hashtags à chaque tir (trois par
identité), pour ne pas tourner en rond.

- FR : `asclépiade`, `#asclepiade`, `#asclépiadecommune`, `#monarque`, `#papillonmonarque`,
  `#chenillemonarque`, `#jardinpollinisateur`, `#plantesindigènes`, `#missionmonarque`
- EN : `milkweed`, `#commonmilkweed`, `#swampmilkweed`, `#butterflyweed`, `#monarchbutterfly`,
  `#monarchcaterpillar`, `#monarchwaystation`, `#pollinatorgarden`, `#milkweedpods`,
  `#nativeplants`

**Facebook** : recherche « asclépiade » / « milkweed » → Publications → Publications récentes.
Les groupes de jardinage et de monarques sont le meilleur terrain, mais une Page ne commente dans
un groupe que si elle en est membre et que le groupe l'accepte. **Ne rejoins aucun groupe
toi-même** : note les groupes prometteurs dans ton rapport, Gabriel décide.

## 4. Ce qui se commente — tout doit être vrai

- Publiée il y a **moins de 7 jours**.
- Par **une personne ou un petit créateur** : jardinière, photographe amateur, famille qui élève
  des monarques, naturaliste. Pas un média, pas une grosse institution, pas une marque.
- Montre vraiment de l'asclépiade, un monarque, sa chenille, sa chrysalide, des graines ou des
  follicules. Vérifie avec le skill `selection-images` : l'apocyn, le dompte-venin et le
  vice-roi ne sont pas ce qu'ils ont l'air d'être.
- Publique, en français pour les identités FR, en anglais pour les identités EN.
- Lasclay (aucune des identités) ne l'a **pas déjà commentée** : regarde les commentaires.
- L'auteur n'a reçu **aucun commentaire d'une identité Lasclay dans les 30 derniers jours**
  (journal).

## 5. Ce qui ne se commente jamais

- Une publication **triste ou tendue** : monarque mort, deuil, plainte, débat sur les pesticides,
  la politique, un voisin qui a fauché les plants. On passe.
- Un **enfant** comme sujet de la photo.
- Une **vente** (« graines à vendre », « DM pour prix ») ou un **concurrent** : toute marque qui
  vend de la soie, des vêtements ou des produits d'asclépiade. Pas de pêche chez eux, ni chez nos
  partenaires.
- De l'**asclépiade tropicale** (*curassavica*) célébrée : on ne l'encourage pas, et corriger
  quelqu'un chez lui n'est pas le but. On passe.
- Un compte qui ressemble à un **robot**, à un concours, à une page de citations.
- Une publication qui a déjà des dizaines de commentaires : la nôtre s'y noie, et ce n'est plus
  du grassroots.

## 6. Écrire le commentaire

**Il parle de SA photo.** Un détail que seul quelqu'un qui a vraiment regardé peut nommer : la
lumière dans les soies, les gouttes sur l'ombelle, la chenille à moitié cachée sous la feuille,
la couleur du follicule, le cadrage.

- **Court** : 4 à 20 mots. Une phrase, parfois deux.
- **Zéro vente** : pas de nom de marque, pas de lien, pas de hashtag, pas de « venez voir notre
  profil », pas de « suivez-nous », pas de produit. Jamais.
- **Zéro ou un émoji**, jamais en grappe.
- **Français québécois naturel**, vouvoiement si on s'adresse à la personne. Anglais simple et
  chaleureux, jamais « Amazing shot!!! 🔥🔥 ».
- **Une vraie question, une fois sur trois ou quatre**, qui appelle une réponse facile : « C'est
  une incarnate? », « Ils sont arrivés quand chez vous cette année? ». Jamais une question dont on
  connaît la réponse pour faire la leçon.
- **Un petit savoir, rarement** (une fois sur cinq au plus), en une demi-phrase, seulement s'il
  est sûr : les pollinies, la chenille qui se nourrit d'une plante toxique, la soie qui fait
  voyager la graine. Jamais « Saviez-vous que… », jamais de leçon.
- **Jamais deux fois le même commentaire**, ni la même ouverture deux fois de suite. Relis les 30
  derniers du journal avant d'écrire. « Magnifique cliché! » tout seul est un gabarit : garde
  l'élan, ajoute le détail qui prouve qu'on a regardé.

| Générique, à ne pas faire | Précis, à faire |
| --- | --- |
| « Magnifique photo! » | « Magnifique cliché, la lumière traverse les soies juste comme il faut. » |
| « Wow 😍😍😍 » | « Les gouttes de pluie sur l'ombelle 😍 » |
| « Beautiful! » | « That caterpillar tucked under the leaf, perfect timing. » |
| « Super, continuez comme ça! » | « Trois chrysalides sur la même tige, votre coin doit être un vrai garde-manger. » |
| « Great shot! Check out our milkweed products! » | *(jamais)* |

## 7. Publier

1. Place-toi sur la bonne identité, vérifie-la à côté de la boîte de commentaire.
2. Aime la publication.
3. Colle le commentaire, relis-le une fois dans la boîte, publie.
4. Vérifie qu'il apparaît. S'il disparaît aussitôt ou qu'un message apparaît : section 8.
5. Écris la ligne au journal **immédiatement** :

```json
{"date":"2026-09-24T14:12:00-04:00","identite":"ig:lasclay","url":"https://www.instagram.com/p/…","auteur":"@…","langue":"fr","commentaire":"…","question":false}
```

Identités : `ig:lasclay`, `fb:lasclay`, `ig:milkweed.company`, `fb:milkweed-company`.

## 8. Signaux de blocage — arrêt immédiat

Au premier de ces signaux, **arrête toute la plateforme** (toutes ses identités), sans réessayer :

- « Action bloquée », « Réessayez plus tard », « Nous limitons la fréquence de certaines
  actions », « Try again later », « We restrict certain activity to protect our community »
- un CAPTCHA, une demande de vérification, une déconnexion inattendue
- un commentaire qui n'apparaît pas, ou qui disparaît après publication
- un avertissement sur les « standards de la communauté »

Puis dans `peche-etat.json` : `pause_jusqua` de la plateforme = maintenant + **72 heures**, et
une entrée dans `blocages` avec la date et le message exact. **Deuxième blocage en 30 jours :
pause de 14 jours**, et le rapport dit à Gabriel de revoir les plafonds. On ne contourne jamais
un blocage en changeant d'identité.

## 9. Les gens qui répondent

En début de tir, regarde les notifications de chaque identité. Si quelqu'un a répondu à un
commentaire de pêche :

- **une** réponse courte et chaleureuse, dans son ton ; la conversation s'arrête là de notre côté
  sauf question directe ;
- s'il demande qui on est ou ce qu'on fait : une phrase simple (« On transforme la soie
  d'asclépiade en isolant, à Québec »), sans lien ni vente ; le profil fait le reste ;
- une question de client (commande, livraison, retour) : ne réponds pas sur le fond, signale-la
  dans le rapport pour le service client ;
- ces réponses **comptent** dans le plafond du jour.

## 10. Rapport de fin de tir

Court. Par identité : commentaires publiés (lien + texte), aimés, publications écartées et
pourquoi (une ligne par famille, pas par publication), réponses reçues et données, groupes
Facebook prometteurs, et **tout signal de blocage mot pour mot**. Un tir sans rien de
commentable est un résultat normal : dis-le en une ligne.

## Skills voisins

`selection-images` (juger ce que montre la photo), `copywriting-lasclay` (voix, garde-fous),
`lasclay-master` (faits de marque, si quelqu'un pose une question).
