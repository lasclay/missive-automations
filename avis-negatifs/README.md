# Avis Google négatifs — liste, croisement Shopify et messages de récupération

Fiche Google : **Lasclay**, 254 Bd des Capucins, Québec QC G1J 3R4
`place_id ChIJeXcP65DHd6YRhr5TXMN_4-M` · `ludocid 16421109143367302790` · note globale **4,4/5**

## Comment la liste a été bâtie (et sa limite)

Google Maps refuse les appels serveur depuis cette session (403 sur `listugcposts`, Chromium
sans réseau sortant), et le connecteur Google Business Profile n'est pas branché. La liste vient
donc de la **source de vérité alternative** : les notifications `businessprofile-noreply@google.com`
reçues dans Gmail, une par avis publié depuis 2021. Chacune donne le nom de l'auteur, la note en
étoiles, la date et le **début** du texte de l'avis.

**Limite à connaître :** Google tronque le texte de l'avis dans le courriel (`...`). Les extraits
ci-dessous sont donc partiels. Pour lire un avis en entier, ouvrir
<https://business.google.com/n/715788570095415146/reviews>. Un avis supprimé ou modifié par son
auteur depuis sa publication apparaît quand même ici — vérifier avant d'écrire.

**27 avis de 1 à 3 étoiles** depuis 2021 : 20 × 1★, 6 × 2★, 1 × 3★.

## Ce que disent les avis, en un coup d'œil

Sur 27 avis négatifs, **au moins 17 portent sur le service ou la livraison**, pas sur le produit :
commande non reçue, colis partiel, silence du service client, délai. Plusieurs disent
explicitement l'inverse sur le produit (« les mitaines sont de bonne qualité, mais… »,
« je n'ai rien de négatif à dire sur le produit »). C'est ce qui rend la récupération
plausible : le grief est réparable, et il est déjà réparé dans plusieurs cas.

Deux pics : **novembre 2025 – mars 2026** (7 avis) et **janvier 2025** (4 avis) — les deux
saisons de pointe où l'arriéré support a explosé.

## Fichiers

| Fichier | Contenu |
| --- | --- |
| `google_avis_negatifs.tsv` | les 27 avis bruts : date, nom, étoiles, extrait, id du courriel Gmail |
| `croisement.md` | le croisement avis ↔ client Shopify : courriel, téléphone, commandes, statut |
| `messages.md` | un brouillon de message par client identifié, prêt à relire et envoyer |
| `precedents.md` | les cas Missive où un client fâché a été retourné, et la méthode qui a marché |
