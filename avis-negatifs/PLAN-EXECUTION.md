# Plan d'exécution de la vague

**Établi le 25 août 2026.** Ce fichier est la liste de tâches. Les textes sont dans `messages.md`
et `reponses-publiques.md`.

---

# Fait, en direct dans Shopify

## ✅ La FAQ anglaise ne ment plus

C'était l'affirmation la plus grave du site : à la question « Where are your products made? », la
version anglaise répondait « **Everything happens in Quebec** », sans mentionner la Tunisie une
seule fois. Shopify la marquait lui-même `outdated: true`.

Corrigée par `translationsRegister` sur la ressource
`OnlineStoreThemeJsonTemplate/page.faq`, clé
`section...a3cc90ce-af22-409c-889b-05e9885deb8c.text`. **Vérifié en ligne sur
`lasclay.com/en/pages/faq`.**

Le nouveau texte nomme la Tunisie, dit ce qui reste au Québec, garde l'explication sur l'expertise
textile disparue et se termine par « We explained this publicly, in a video and in the media,
rather than quietly changing our labels ».

⚠️ **Un autre `outdated: true` trouvé en passant**, hors périmètre mais à corriger : les tarifs de
livraison anglais annoncent « free shipping over $119CAD » et « $9.50CAD » alors que la version
française dit 100,00 $ et 7,99 $.

---

# À faire par Gabriel : ce que je ne peux pas exécuter

## 1. Les sept remerciements publics, en premier

**Aucun accès à Google Business Profile depuis cette session.** L'API Maps refuse, le navigateur
est bloqué. Les sept textes sont prêts dans `reponses-publiques.md`.

À publier **avant** le premier message privé : ça ne coûte rien, ça ne présente aucun risque, et
c'est ce que voit quelqu'un qui arrive sur la fiche demain.

Susan Buchanan, Fanny H, Danielle Gingras, Yingyan Janet Zhu, Sarah Resch, Sophie Lemieux, Sylvie
Internoscia. Plus la réponse sous la mise à jour de Patrick Lessnick.

## 2. ✅ Les 14 cartes-cadeaux sont créées

**Faites le 25 août par une autre session, via l'extension Chrome, directement dans l'admin.**
2 200 $ au total : 8 × 200 $ et 6 × 100 $, actives, sans date d'expiration, rattachées au bon
compte client et annotées « Vague avis négatifs août 2026 · <référence> ».

Aucun courriel n'est parti : la case « Send gift card now » a été décochée sur les quatorze, et la
colonne Recipient affiche « No recipient » partout.

| Client | Montant | Code se terminant par |
| --- | --- | --- |
| Tim Sullivan | 200 $ | ghdj |
| Stephane Vincent | 200 $ | 3bdx |
| Patrick Lessnick | 200 $ | bd87 |
| Toby Lanthier | 200 $ | fwcm |
| Nathalie Durand | 200 $ | r78m |
| Charlotte Bourgoing | 200 $ | pqwd |
| Guillaume Lanteigne-Voyer | 200 $ | 67cc |
| Marie-Andrée Blouin | 200 $ | frcw |
| Annie Hubert | 100 $ | cxgp |
| Sonia Pouliot | 100 $ | hytw |
| Jimmy Allaire | 100 $ | dx66 |
| Ariane Poirier | 100 $ | qqmt |
| Mélanie Boucher | 100 $ | fbpv |
| Emma Whiten | 100 $ | 9yft |

⚠️ **Je n'ai pas pu vérifier ces cartes moi-même.** Le jeton Shopify de cette session n'a pas la
portée `read_gift_cards`. Le tableau ci-dessus reprend le rapport de la session Chrome.

### Ce que ça a changé dans les quatorze messages

**Le code complet ne s'affiche qu'à la création et n'est plus récupérable.** Mes textes disaient
tous « une carte-cadeau de 200 $ **part à votre nom** », ce qui laissait entendre que quelque chose
allait arriver par courriel. **Rien n'arrive.** Le solde est sur leur compte client et s'applique à
la caisse quand la personne est connectée.

Les quinze formulations ont été réécrites en conséquence, par exemple :

> J'ai aussi déposé 200 $ de crédit sur votre compte, sans date d'expiration : il s'applique tout
> seul à la caisse quand vous êtes connecté avec cette adresse.

Et en anglais :

> There is also **$200 of store credit already sitting on your account**, no expiry date. It applies
> on its own at checkout when you are signed in with this email address, so there is no code to keep
> track of.

⚠️ **Conséquence à surveiller : le client doit être connecté avec la bonne adresse.** Quelqu'un qui
commande en invité, ou avec un autre courriel, ne verra pas son crédit. C'est le seul point de
friction du montage, et c'est pour ça que les messages nomment l'adresse plutôt que de promettre un
code.

Si une personne écrit qu'elle ne voit pas son crédit, le bouton **Send gift card** sur la fiche
envoie le code par courriel, un cas à la fois.

## 3. Le pied de page et la FAQ française

Voir `seo/AUDIT-origine-fabrication.md`. Le pied de page est **déjà corrigé dans le thème** mais
n'est pas servi : il suffit de rouvrir le bloc de texte dans l'éditeur et de re-sauvegarder. La FAQ
française est dans `templates/page.faq.json`, un collage de deux minutes dans l'éditeur de thème.

---

# Le calendrier d'envoi

Quinze gestes identiques la même journée se remarquent, chez Google comme chez les clients. Un ou
deux par jour ouvrable, sur trois semaines, en commençant par les dossiers les plus chauds.

| Jour | Envoi | Pourquoi ce rang |
| --- | --- | --- |
| **Avant tout** | Les 7 remerciements publics + les réponses publiques | Change la fiche avant qu'un seul message parte |
| **J1** | **Marie-Michèle Leblanc** | Le fil Reddit est vivant. Plus tôt il part, moins il risque d'y être relayé comme une réaction |
| **J1** | **Emma Whiten** | Remboursée le 20 août, le dossier est encore chaud |
| **J2** | **Tim Sullivan** | Dossier ouvert, saison perdue, la réexpédition doit partir cette semaine |
| **J3** | **Ariane Poirier** | Solde de 32,39 $ à rembourser le jour même |
| **J4** | **Annie Hubert** | Solde de 16,88 $, et un modèle à choisir avec elle |
| **J5** | **Sonia Pouliot** | Remboursement de 133,35 $ |
| **J8** | **Charlotte Bourgoing** | Remboursement de 126,46 $ |
| **J9** | **Stephane Vincent** | Il se déclare parti, aucune urgence logistique |
| **J10** | **Jimmy Allaire** | ⚠️ N'envoyer que si la prochaine semelle a une date |
| **J11** | **Melanie Boucher** | Dossier de 2022, aucune urgence |
| **J12** | **Patrick Lessnick** | Remboursement de 112,39 $ |
| **J15** | **Marie-Andrée Blouin** | ⚠️ Le remplacement doit pouvoir partir dans la semaine |
| **J16** | **Guillaume Lanteigne-Voyer** | ⚠️ Idem |
| **J17** | **Toby Lanthier** | ⚠️ Idem, remplacement si l'article est encore défectueux |
| **J18** | **Nathalie Durand** | ⚠️ Paire de remplacement à réexpédier si elle dit ne rien avoir reçu |
| **J19** | **Susan Lockhart** | Semences, à caler sur la saison de semis |

**Les cinq derniers sont groupés exprès :** ce sont ceux qui promettent un envoi physique. Les
envoyer quand l'atelier peut suivre, pas avant. Un remplacement promis et non expédié est
exactement le reproche qu'on est en train de réparer.

---

# Le suivi qui survit à la vague

## ⚠️ Jimmy Allaire : la nouvelle semelle lui est due

Son message dit : « Est-ce que je peux vous envoyer la prochaine version dès qu'elle sort, sans
frais, pour que vous nous disiez si le problème est réglé? »

C'est la **seule promesse du lot qui engage après l'envoi**, et elle est faite à quelqu'un qui a
écrit « Je crois en votre produit ». Si la semelle sort dans six mois et qu'il ne reçoit rien,
on aura fait exactement ce qu'on lui reprochait.

**À inscrire dans le suivi produit, pas seulement ici :** `alljimremy@gmail.com`, une paire de
semelles nouvelle version, gratuite, dès la première série.

## ⚠️ Marie-Michèle Leblanc : la porte ouverte

Son message se termine par « si on peut faire quoi que ce soit d'autre pour faire amende honorable,
je suis tout ouïe ». **Si elle répond, il faut livrer vite.** Une porte ouverte qui se referme sur
un silence serait pire que de ne pas avoir écrit, et c'est très exactement le reproche qu'elle
nous fait déjà.

---

# Klaviyo : le grief de Marie-Andrée est structurellement vrai

Elle écrit dans son avis :

> *« Lasclay me dit qu'ils n'ont pas le temps, ni le personnel pour me répondre adéquatement, mais
> en même temps, ils ne cessent de m'envoyer des courriels faisant la promotion de leurs nouveaux
> produits. »*

**Vérifié le 25 août.** Les dix segments et les dix listes de Klaviyo ont été relevés. Aucun
n'exclut un client dont la commande est en souffrance :

| Ce qui existe | Ce sur quoi c'est bâti |
| --- | --- |
| Froids 365j, Engagés 90j, Palier 3 Engagés 180j | ouvertures et clics |
| Newsletter Français, English full, English Canada | langue |
| LAS Customer QC, LAS Customer ROC, USA South | géographie |
| unsub + inactif | désabonnement |

**Rien sur l'état d'une commande.** Un client dont la commande est payée et non expédiée depuis
trois mois reçoit donc les promos comme tout le monde. Avec **499 commandes payées non expédiées**
au dossier, ce n'est pas un cas isolé, c'est une mécanique.

## Le correctif

L'intégration Shopify de Klaviyo pousse déjà les événements de commande. Il faut un **segment
d'exclusion** appliqué à toutes les campagnes promotionnelles :

> Profils **qui ont** « Placed Order » dans les 120 derniers jours
> **et qui n'ont pas** « Fulfilled Order » pour cette commande
> **et qui n'ont pas** reçu de remboursement

Ces gens-là continuent de recevoir les courriels transactionnels et les suivis de précommande. Ils
ne reçoivent pas les nouveautés ni les promos tant que leur commande n'est pas partie.

⚠️ **Le proxy Klaviyo est en lecture seule**, je ne peux pas créer le segment. C'est de toute façon
une décision de segmentation marketing, pas une correction de texte.

---

# Récapitulatif

| # | Tâche | État |
| --- | --- | --- |
| 1 | FAQ anglaise sur l'origine | ✅ **Corrigée et en ligne** |
| 2 | Sept remerciements publics | textes prêts, publication par Gabriel |
| 3 | 14 cartes-cadeaux, 2 200 $ | ✅ **créées** dans l'admin par la session Chrome. Textes des messages réécrits en conséquence |
| 4 | Calendrier d'envoi sur trois semaines | ✅ **ci-dessus** |
| 5 | Suivi de la promesse à Jimmy Allaire | ✅ **consigné** |
| 6 | Pied de page et FAQ française | diagnostic fait, deux minutes dans l'éditeur |
| 7 | Segmentation Klaviyo | ✅ **diagnostiquée**, correctif spécifié, création bloquée |
