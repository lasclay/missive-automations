# Avis Facebook, recoupement avec Judge.me

Point de depart: une note de relecture de la page Facebook (208 avis, 90 % de
recommandations), remontee jusqu'aux premiers avis de mars 2021.

    python3 parse.py        # note de relecture -> avis_fb.json
    python3 construire.py   # -> avis_fb_produits.csv et avis_fb_boutique.csv
    python3 a_recuperer.py  # -> avis_fb_a_recuperer.csv, ce qu'il reste a aller chercher

## Deux regles qui commandent tout le reste

**Seuls les mots ecrits par le client sont publiables.** La note de relecture melange
des citations entre guillemets et des resumes de la personne qui a regarde
l'enregistrement. Un resume decrit fidelement ce que le client a dit, mais ce ne sont
pas ses mots: le publier sous son nom lui attribue une phrase qu'il n'a pas ecrite.
Sur 50 auteurs lisibles, 31 portent une citation, et une douzaine de ces citations
sont des fragments (« magnifiques », « a souhait ») trop courts pour tenir seuls.

**Un avis Facebook a souvent deja ete verse dans Judge.me.** C'est le cas de la
majorite. Trois signaux le detectent, du plus sur au moins sur:

1. le texte mot pour mot (empreinte sur 60 caracteres);
2. le meme auteur le meme jour, quel que soit le texte: une personne n'ecrit pas deux
   avis differents le meme jour, elle a publie sur Facebook et dans le formulaire;
3. n'importe quel auteur au meme prenom, le meme jour. Judge.me abrege souvent le nom
   de famille en initiale (« Tom R. », « Lucie B. », « Luc P. »): sans ce filet, trois
   avis deja en ligne passaient pour inedits.
4. le meme auteur avec un texte inclus dans l'autre. C'est le cas le plus retors:
   la citation relevee sur Facebook est un extrait de l'avis complet. Le taux de
   ressemblance s'effondre avec l'ecart de longueur et ne voit rien, l'inclusion la
   trouve. Francoise Legault est passee a travers les trois premiers filtres et n'a ete
   arretee que par celui-la.

Le prenom seul, en revanche, ne prouve rien: il y a six « Marie-Helene » et quinze
« Louise » sur Judge.me. Il ne compte que combine a la date.

## Identification du client

Judge.me exige une adresse par ligne, et Facebook n'en donne aucune. Le rapprochement
se fait sur le nom complet dans Shopify, et n'est retenu que si un seul client porte ce
nom, ou si une commande anterieure a l'avis tranche entre les homonymes. Michel Pepin a
commande un sac fourre-tout dix jours avant d'ecrire « le sac est tres pratique »:
c'est ce genre de preuve qui autorise a joindre une adresse a un avis. Un prenom qui
ressemble ne suffit jamais.

Nuance pour les avis de boutique: ils ne vouchent pour aucun article, donc la commande
anterieure n'est pas exigee. Anne-Julie Frenette n'a commande que six mois apres son
avis, et des bombes semencieres n'ont rien a voir avec « ca ne mouille pas »: son nom
est unique dans Shopify, elle passe en avis de boutique, sans fiche produit.

Piege de recherche: `customers(first: 5, ...)` tronque silencieusement. Trois identites
manquaient au premier passage (Anne Julie Frenette, Luc Prud'Homme, Marie-Helene Henry)
simplement parce que la reponse s'arretait au cinquieme homonyme.
