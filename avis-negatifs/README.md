# Avis Google négatifs, croisement Shopify, messages de récupération

Fiche Google : **Lasclay**, 254 Bd des Capucins, Québec QC G1J 3R4
`place_id ChIJeXcP65DHd6YRhr5TXMN_4-M` · `ludocid 16421109143367302790`
Note globale **4,4 / 5** · **132 avis** au 20 août 2026

## Le dossier a été bâti en deux passes

**Passe 1, par les notifications Gmail.** Google Maps refuse les appels serveur depuis
l'environnement Claude Code et le connecteur Business Profile n'est pas branché. La liste
initiale de 27 avis vient donc des courriels `businessprofile-noreply@google.com`, un par avis
publié depuis 2021.

**Passe 2, par la fiche elle-même.** Cowork, qui a un navigateur et la session Google, est allé
lire les avis sur `business.google.com`. Cette passe a corrigé le dossier en profondeur.

### Ce que la passe 2 a changé

| Constat | Conséquence |
| --- | --- |
| **3 avis négatifs** n'avaient déclenché **aucune notification** Gmail | La reconstitution par courriel n'est pas exhaustive |
| **3 auteurs ont relevé leur note** (deux passés à 4★) | 3 brouillons devenus faux |
| **4 avis n'existent plus** sur la fiche | 4 brouillons sans objet |
| **6 textes complets** montrent un grief différent de celui supposé | 6 brouillons réécrits |
| **3 réponses publiques** existaient déjà, contre « aucune » supposée | 2 d'entre elles contredisaient le dossier |
| **5 avis** n'ont pas pu être relus | Deuxième passe requise avant tout envoi |

Trois contradictions ont été tranchées dans Shopify : Susan Lockhart a bien commandé, onze mois
après la réponse publique qui affirmait le contraire ; la paire de remplacement de Nathalie Durand
a bien été livrée, le lendemain de son avis ; la commande de Cyr-Marc Debien a été annulée et
remboursée en entier le soir même.

## Où en est la fiche aujourd'hui

- **15** avis négatifs en ligne **sans aucune réponse publique**
- **3** avis négatifs en ligne avec une réponse déjà publiée
- **3** notes relevées par leurs auteurs, aucune remerciée
- **4** avis supprimés par leurs auteurs
- **5** avis non relus, état inconnu

Le grief dominant reste le service : silence, messages sans réponse, délais. Deux personnes ont
écrit par courriel **et** par Messenger sans obtenir de réponse par aucun des deux canaux.

## Fichiers

| Fichier | Contenu |
| --- | --- |
| `croisement.md` | l'état réel de chaque dossier : client, contact, grief réel, ce qui a été vérifié |
| `messages.md` | **version 2.** Les brouillons privés, corrigés. Ce qui ne doit pas être envoyé, et pourquoi |
| `reponses-publiques.md` | les réponses à publier sur la fiche, y compris sous les notes relevées |
| `google_avis_negatifs.tsv` | le registre des 30 avis : note notifiée, note réelle, statut, contact |
| `avis-complets.jsonl` | les textes intégraux relevés sur la fiche par Cowork |
| `RAPPORT-LECTURE-FICHE.md` | le rapport de lecture de Cowork, tel que reçu |
| `precedents.md` | les cas Missive de reconquête et la méthode |
| `BRIEF-COWORK.md` | le brief d'exécution, à rejouer pour la deuxième passe |

## Ce que ça déclenche ailleurs

Trois choses sortent du périmètre des avis et appartiennent à d'autres équipes.

**1. La rigidité est un défaut produit, pas un incident de service.** Nathalie Durand sur des
mitaines d'un lot reconnu défectueux, Jimmy Allaire sur les semelles. Même mot, deux produits,
deux années. À porter à la R&D.

**2. Messenger ne se rend pas.** Patrick Lessnick et Charlotte Bourgoing ont écrit sur les deux
canaux et n'ont eu de réponse sur aucun. Le skill `missive-messenger-7jours` documente déjà les
limites du canal.

**3. Le site ne dit pas où les produits sont assemblés.** C'est le fond de l'avis de Marie L. du
20 août, et c'est exact. La transparence sur l'origine est la valeur affichée de la marque, et
l'écart se voit maintenant publiquement. Ça se corrige sur les fiches produits, pas dans une
réponse Google. Voir les skills `lasclay-master` (formulations justes et à bannir) et
`lasclay-seo` (exécution sur les fiches).

## Le fil Reddit du 6 août 2026

Un fil r/montreal, « Attention à la marque Lasclay : manque de transparence et fausses
disponibilités », 38 commentaires. Il reprend le même grief que l'avis Google de Stephane Vincent :
un produit affiché comme disponible qui devient une précommande après l'achat. Il envoie
explicitement ses lecteurs vers les avis Google les plus faibles.

En cherchant la commande de son autrice, la vérification Shopify a sorti plus gros que le fil :
**499 commandes payées et jamais expédiées**, et **sept rétrofacturations depuis avril dont une qui
attend encore une réponse**. Détail, nuances et recommandations dans `REDDIT-2026-08.md`.

## Avant d'envoyer quoi que ce soit

Rien n'a été envoyé. Aucune carte-cadeau émise, aucun remboursement déclenché, aucune réponse
publiée. Les brouillons attendent une relecture humaine et un envoi un par un depuis Missive,
après `node dossier.js <convId>` ou une vérification Shopify **et** ShipStation.

**Aucun geste n'est conditionnel au retrait ou à la modification d'un avis.** Interdit par les
règles Google sur les faux avis, trompeur au sens de la Loi sur la protection du consommateur du
Québec, et bien plus coûteux que l'avis d'origine si un client le documente.
