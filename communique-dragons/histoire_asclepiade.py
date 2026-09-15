#!/usr/bin/env python3
"""L'histoire verifiee de la filiere, avec ses sources.

Les brouillons disaient « la filiere s'est cassee en 2018 quand l'usine de
Saint-Tite a ferme ». Deux erreurs dans une phrase, envoyee a des journalistes
de la region qui connaissent le dossier par coeur :

  · la date est le 11 octobre 2017, pas 2018 ;
  · ce n'est pas l'usine de Saint-Tite qui achetait 90 % de la recolte, c'est
    l'entreprise qui l'exploitait.

Gabriel a corrige une deuxieme fois : Encore 3 et Protec-Style sont la meme
entreprise, pas deux clients distincts. Un seul groupe, deux usines, Saint-Tite
et Granby, tombees le meme jour. Ecrire « le meme jour que l'atelier de Granby »
laissait croire a deux faillites separees, ce qu'un journaliste de la Mauricie
aurait releve tout de suite.

Ce que le dossier a de plus utile pour un pupitre regional : la suite. Six
semaines apres la faillite, la Cooperative Monark et Monark Eco Fibre ont
rallume l'usine de Saint-Tite, et c'est l'appui de la MRC de Mekinac qui a fait
pencher la decision. C'est une histoire mauricienne, pas une histoire d'entreprise
de Quebec, et le lien le prouve.

Chaque fait ci-dessous vient d'un article date, dont l'adresse est jointe. On ne
paraphrase pas un chiffre sans pouvoir le montrer.
"""

RC_FAILLITE = ("https://ici.radio-canada.ca/nouvelle/1061543/"
               "asclepiade-soyer-producteurs-industries-encore3-faillite-monark")
NOUVELLISTE_RELANCE = ("https://lenouvelliste.ca/affaires/asclepiade-les-activites-reprennent-"
                       "a-lusine-de-saint-tite-9a7c0d08d77c81c7ab22fdfc8e47a922")
HEBDO_FAILLITE = "https://www.lhebdodustmaurice.com/actualite/protec-style-en-faillite/"
RC_PROMESSES = ("https://ici.radio-canada.ca/recit-numerique/2072/"
                "asclepiade-agriculture-amerique-textile-production-vetements-quebec")

# Les faits, avec leur source. Rien ici n'est de memoire.
FAITS = {
    "faillite": ("Le groupe Protec-Style, qui exploitait l'usine de Saint-Tite sous le nom "
                 "d'Industries Encore 3 et avait réservé 90 % de la récolte québécoise "
                 "d'asclépiade, a fait faillite le 11 octobre 2017", RC_FAILLITE),
    "deux_usines": ("La faillite a fermé les deux usines du groupe, Saint-Tite et l'atelier de "
                    "transformation de la rue Bernard à Granby, avec une dette de plus de "
                    "1,4 M$", HEBDO_FAILLITE),
    "coop": ("La Coopérative Monark regroupait 125 producteurs et avait reçu environ 1,1 M$ en "
             "prêts et subventions entre 2013 et 2016", RC_FAILLITE),
    "relance": ("Six semaines plus tard, le 29 novembre 2017, la Coop Monark et Monark Eco Fibre "
                "rallumaient l'usine de Saint-Tite, et c'est l'appui de la MRC de Mékinac qui a "
                "fait pencher la décision", NOUVELLISTE_RELANCE),
}

# L'accroche regionale : le fait, puis le lien, puis ce que Lasclay fait de cette
# histoire aujourd'hui. Un journaliste regional ouvre le lien avant de lire la
# suite, donc la suite doit valoir le detour.
MAURICIE = (
    "Je vous écris parce que l'asclépiade a commencé chez vous, à Saint-Tite et dans Mékinac. "
    "Le groupe Protec-Style, qui exploitait l'usine de Saint-Tite sous le nom d'Encore 3, avait "
    "réservé 90 % de la récolte québécoise quand il a fait faillite le 11 octobre 2017 "
    f"({RC_FAILLITE}), emportant Saint-Tite et son atelier de Granby. Les 125 producteurs de la "
    "Coopérative Monark ont pris le choc. "
    f"Six semaines plus tard, la MRC de Mékinac a fait pencher la relance ({NOUVELLISTE_RELANCE}).\n\n"
    "Neuf ans après, on achète encore de l'asclépiade québécoise et on la transforme nous-mêmes "
    "à Québec. Ce jeudi, c'est cette plante-là que je vais défendre à la télévision nationale.")

ESTRIE = (
    "Je vous écris parce que la transformation de la fibre se faisait à Granby, rue Bernard. "
    "L'atelier appartenait au groupe Protec-Style, qui exploitait aussi l'usine de Saint-Tite, "
    "et les deux sont tombées le 11 octobre 2017 avec une dette de plus de 1,4 M$ "
    f"({HEBDO_FAILLITE}). L'Estrie compte encore "
    "des producteurs d'asclépiade, et on continue d'acheter de la fibre québécoise.")

SAGUENAY = (
    "Je vous écris parce que Sabin Tremblay, à L'Ascension-de-Notre-Seigneur, cultive de "
    "l'asclépiade pour nous depuis nos tout débuts, et qu'il en cultive encore. Je vais l'aider "
    "à récolter le 4 octobre. S'il y a un reportage à faire, il est là autant qu'ici.")

CENTRE = (
    "Je vous écris parce que l'asclépiade se cultive chez vous depuis la première vague de 2013, "
    "celle de la Coopérative Monark et de ses 125 producteurs. Plusieurs de ceux qui ont tenu bon "
    f"après la faillite d'octobre 2017 ({RC_FAILLITE}) nous vendent encore leur récolte.")

MONTEREGIE = (
    "Je vous écris parce que la Montérégie est une des régions où l'asclépiade se cultive encore, "
    "et que c'est de champs comme ceux-là que vient la fibre qu'on transforme à Québec.")

PAR_REGION = {
    "Mauricie": MAURICIE,
    "Estrie": ESTRIE,
    "Saguenay–Lac-Saint-Jean": SAGUENAY,
    "Centre-du-Québec": CENTRE,
    "Montérégie": MONTEREGIE,
}
