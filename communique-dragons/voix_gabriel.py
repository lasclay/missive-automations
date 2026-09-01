#!/usr/bin/env python3
"""Le squelette de courriel de Gabriel, tire de deux courriels qu'il a reecrits
lui-meme (Sylvain Larocque et Chloe Pouliot, 31 aout 2026).

Ce que ces deux exemples ont corrige, et qui vaut pour tout le dossier :

1. C'est une bonne nouvelle, pas une communication de crise. Ne pas s'excuser du
   virage manufacturier, ne pas renommer ce qu'il a coute, ne pas relitiger la
   Tunisie. C'est deja couvert, on avance.
2. Le pont narratif est toujours le meme : le changement de modele devait
   liberer du temps pour les deux missions, et Dragons' Den est le pas suivant.
   C'est l'aboutissement de la decision que ces journalistes ont racontee.
3. Crediter le journaliste. « publie et TRES relaye », « repris par La Tribune et
   Le Droit ». Jamais « vous vous interessiez a », qui presume de son interet.
4. Enthousiasme assume. « un enorme pas dans la bonne direction », « j'espere
   vraiment un boom des ventes ».
5. Demander la suite franchement, sans tourner autour.
6. Finir sur la chaine de benefices : ventes, puis cultivateurs, puis monarques.
   Jamais la mise en garde « un achat ne sauve pas un papillon » : c'est un
   garde-fou de texte public, pas de courriel a un journaliste, et ca degonfle
   le message.
7. Ne pas mentionner la confidentialite du resultat. C'est un frein inutile tant
   que personne ne pose la question.
8. Donner des ressources : le lien de la video sur le changement de modele,
   la mention des couvertures recentes.
9. Le registre depend de la proximite reelle, pas d'une regle. Larocque au
   « vous » avec « M. », Chloe au « tu » avec « J'espere que tu vas bien ».
   La colonne Registre du chiffrier tranche, elle ne se devine pas.
"""

VIDEO = "https://www.youtube.com/watch?v=GKyHh-Ok9JU"

# L'objet annonce la nouvelle, avec la date et l'enthousiasme. Modele donne par
# Gabriel : « Nous serons diffuses a Dragons' Den le 17 septembre! » Les
# variantes suivent l'angle, pour que 253 courriels n'aient pas tous exactement
# la meme ligne d'objet, et parce que « l'asclepiade s'en va a Dragons' Den »
# parle plus a un journaliste agricole qu'a un chroniqueur d'affaires.
OBJETS = {
    "A": "Nous serons diffusés à Dragons' Den le 17 septembre!",
    "B": "Nous serons diffusés à Dragons' Den le 17 septembre!",
    "C": "L'asclépiade s'en va à Dragons' Den le 17 septembre!",
    "D": "L'asclépiade et les monarques à Dragons' Den le 17 septembre!",
    "E": "Nous serons diffusés à Dragons' Den le 17 septembre!",
    "F": "L'asclépiade s'en va à Dragons' Den le 17 septembre!",
    "G": "Nous serons diffusés à Dragons' Den le 17 septembre!",
    "H": "We are airing on Dragons' Den on September 17!",
    "I": "Nous serons diffusés à Dragons' Den le 17 septembre — invité disponible",
    "J": "L'asclépiade s'en va à Dragons' Den le 17 septembre!",
}

MISSIONS = ("mes 2 grandes missions : faire connaître l'asclépiade et sauvegarder "
            "les monarques par la culture de l'asclépiade")

ANNONCE = ("Je vais présenter Lasclay dans le premier épisode de la 21e saison de "
           "Dragons' Den, sur CBC et CBC Gem.")

PAS = "Eh bien, le 17 septembre prochain, on va faire un énorme pas dans la bonne direction :"

BENEFICE = ("J'espère vraiment un boom des ventes avec cette visibilité, ce qui, plus "
            "largement, sera extrêmement bénéfique pour les cultivateurs d'asclépiade du "
            "Québec chez qui on continue d'acheter, et pour les papillons monarques menacés "
            "qui continuent de se reproduire dans leurs plantations.")


def tu(registre):
    return registre.strip().lower().startswith("tu")


def salutation(registre, prenom, nom_famille, jvb=False):
    if tu(registre):
        s = f"Bonjour {prenom},"
        return s + ("\n\nJ'espère que tu vas bien." if jvb else "")
    civilite = "M." if nom_famille[1] == "M" else "Mme"
    return f"Bonjour {civilite} {nom_famille[0]},"


def rareté(registre, avec_suite=True):
    t = tu(registre)
    p = ("Aller présenter notre entreprise et sa mission à la télévision nationale est une "
         "opportunité qui arrive bien rarement.")
    if avec_suite:
        p += (f" Je voulais {'t' if t else 'vous '}en faire part et qui sait, peut-être "
              f"{'t' if t else 'vous '}inspirer une suite à votre dernier article."
              if not t else
              " Je voulais t'en faire part et qui sait, peut-être t'inspirer une suite à ton "
              "dernier article.")
    return p


def cloture(registre):
    if tu(registre):
        return "Au plaisir et n'hésite pas à me contacter si tu as des questions."
    return "Au plaisir et n'hésitez pas à me contacter si vous avez des questions."


def assembler(blocs):
    """Colle les paragraphes non vides avec une ligne blanche entre chacun."""
    return "\n\n".join(b.strip() for b in blocs if b and b.strip())
