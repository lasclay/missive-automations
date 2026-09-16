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

from voix_gabriel import lien

RC_FAILLITE = ("https://ici.radio-canada.ca/nouvelle/1061543/"
               "asclepiade-soyer-producteurs-industries-encore3-faillite-monark")
NOUVELLISTE_RELANCE = ("https://lenouvelliste.ca/affaires/asclepiade-les-activites-reprennent-"
                       "a-lusine-de-saint-tite-9a7c0d08d77c81c7ab22fdfc8e47a922")
HEBDO_FAILLITE = "https://www.lhebdodustmaurice.com/actualite/protec-style-en-faillite/"
FAILLITE_2017 = "la faillite d'octobre 2017"

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
    "réservé 90 % de la récolte québécoise quand il a fait faillite "
    f"{lien('le 11 octobre 2017', RC_FAILLITE)}, emportant Saint-Tite et son atelier de "
    "Granby. Les 125 producteurs de la "
    "Coopérative Monark ont pris le choc. "
    f"Six semaines plus tard, {lien('la MRC de Mékinac a fait pencher la relance', NOUVELLISTE_RELANCE)}.\n\n"
    "Neuf ans après, on achète encore de l'asclépiade québécoise et on la transforme nous-mêmes "
    "à Québec. Ce jeudi, c'est cette plante-là que je vais défendre à la télévision nationale.")

ESTRIE = (
    "Je vous écris parce que la transformation de la fibre se faisait à Granby, rue Bernard. "
    "L'atelier appartenait au groupe Protec-Style, qui exploitait aussi l'usine de Saint-Tite, "
    f"et les deux sont tombées {lien('le 11 octobre 2017', HEBDO_FAILLITE)} avec une dette "
    "de plus de 1,4 M$. L'Estrie compte encore "
    "des producteurs d'asclépiade, et on continue d'acheter de la fibre québécoise.")

SAGUENAY = (
    "Je vous écris parce que Sabin Tremblay, à L'Ascension-de-Notre-Seigneur, cultive de "
    "l'asclépiade pour nous depuis nos tout débuts, et qu'il en cultive encore. Je vais l'aider "
    "à récolter le 4 octobre. S'il y a un reportage à faire, il est là autant qu'ici.")

CENTRE = (
    "Je vous écris parce que l'asclépiade se cultive chez vous depuis la première vague de 2013, "
    "celle de la Coopérative Monark et de ses 125 producteurs. Plusieurs de ceux qui ont tenu bon "
    f"après {lien(FAILLITE_2017, RC_FAILLITE)} nous vendent encore leur récolte.")

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


# --- les pages de lasclay.com -----------------------------------------------
# Gabriel : « preciser que l'asclepiade est une mauvaise herbe INDIGENE, avec
# une riche histoire », et pointer vers nos propres pages.
#
# Pourquoi ca change quelque chose : « mauvaise herbe » tout court laisse croire
# a une espece envahissante importee. L'asclepiade commune pousse ici depuis
# toujours, et c'est exactement ce qui rend le monarque dependant d'elle. Un
# journaliste qui apprend ca en trois mots a deja son angle.
#
# Les liens servent deux fois : ils donnent au journaliste de quoi ecrire sans
# nous rappeler, et ils ramenent du trafic vers des pages qu'on controle.

PAGE_FR = "https://lasclay.com/pages/milkweed-asclepiade"
PAGE_EN = "https://lasclay.com/en-us/pages/milkweed-plant-fiber"
INDUSTRIE_FR = "https://lasclay.com/blogs/journal/histoire-industrie-asclepiade-quebec"
INDUSTRIE_EN = "https://lasclay.com/en-us/blogs/journal/histoire-industrie-asclepiade-quebec"
NOUVELLE_FRANCE_FR = "https://lasclay.com/blogs/journal/soie-amerique-nouvelle-france"
NOUVELLE_FRANCE_EN = "https://lasclay.com/en-us/blogs/journal/soie-amerique-nouvelle-france"
GUERRE_FR = "https://lasclay.com/blogs/journal/asclepiade-seconde-guerre-mondiale"
GUERRE_EN = "https://lasclay.com/en-us/blogs/journal/asclepiade-seconde-guerre-mondiale"
MONARQUE_FR = "https://lasclay.com/pages/monarch-butterfly"
MONARQUE_EN = "https://lasclay.com/en-us/pages/monarch-butterfly"

INDIGENE_FR = (
    f"L'asclépiade n'est pas une plante importée : c'est une "
    f"{lien('mauvaise herbe indigène', PAGE_FR)} qui pousse ici depuis toujours, et c'est "
    f"pour ça que {lien('le monarque en dépend', MONARQUE_FR)}. Elle a aussi une histoire plus "
    f"longue que la nôtre. On a écrit ce qu'on en a trouvé : "
    + lien("la soie d'Amérique en Nouvelle-France", NOUVELLE_FRANCE_FR) + ", "
    + lien("les enfants qui la récoltaient pour les gilets de sauvetage de la Seconde "
           "Guerre mondiale", GUERRE_FR) + ", et "
    + lien("l'histoire de l'industrie québécoise", INDUSTRIE_FR) + ".")

INDIGENE_EN = (
    f"Milkweed is not an imported plant: it is a "
    f"{lien('weed native to eastern Canada', PAGE_EN)}, which is exactly why "
    f"{lien('the monarch depends on it', MONARQUE_EN)}. It also has a longer history than we do. "
    f"We wrote down what we found: "
    f"{lien('American silk in New France', NOUVELLE_FRANCE_EN)}, "
    f"{lien('the children who picked it for Second World War life jackets', GUERRE_EN)}, "
    f"and {lien('the story of the Quebec industry', INDUSTRIE_EN)}.")


# Pour un journal de Mekinac, inutile de lui expliquer ou est Saint-Tite.
MAURICIE_COURT = (
    "Le groupe Protec-Style, qui exploitait l'usine sous le nom d'Encore 3, avait réservé 90 % "
    "de la récolte québécoise quand il a fait faillite "
    + lien("le 11 octobre 2017", RC_FAILLITE)
    + ", et c'est "
    + lien("l'appui de la MRC qui a fait pencher la relance", NOUVELLISTE_RELANCE)
    + " six semaines plus tard. On a démarré après. Neuf ans plus tard, on achète encore de "
      "l'asclépiade québécoise et on la transforme nous-mêmes à Québec.")


# Le nom de l'entreprise, lie des la premiere phrase. Un journaliste qui ne nous
# connait pas clique avant de finir le paragraphe, et il atterrit dans la bonne
# langue : lasclay.com sert le francais, /en-us l'anglais.
SITE_FR = "https://lasclay.com"
SITE_EN = "https://lasclay.com/en-us"
