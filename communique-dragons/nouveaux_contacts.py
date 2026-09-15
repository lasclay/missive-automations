#!/usr/bin/env python3
"""Les contacts trouves le 15 septembre 2026, deux jours avant la diffusion.

Gabriel : « ne pas ecrire a qui que ce soit de CBC. Mais Radio-Canada oui,
incluant emissions de radio. » CBC diffuse l'emission : passer par-dessus son
equipe de publicite pour parler a ses salles de nouvelles se retourne contre
nous. Toutes les adresses @cbc.ca sont donc retirees, y compris celle du
Media Centre que j'avais mise la veille.

Meme regle que pour le reste du dossier : chaque adresse est PUBLIEE par le
media, et la source est notee a cote. Rien n'est deduit d'un patron
« prenom.nom@ », sauf que, pour La Semaine verte, c'est le media lui-meme qui
publie la liste nominative de son equipe, roles compris. On n'a pas devine, on
a lu.

Le tri par role compte autant que l'adresse : ecrire aux dix-huit personnes de
l'equipe, montage et camera compris, c'est du publipostage. Ne restent que la
redactrice en chef, l'animatrice et les journalistes.
"""
import sys

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill

from histoire_asclepiade import PAR_REGION
from voix_gabriel import BENEFICE, media_kit

DRIVE = "https://drive.google.com/drive/folders/1pyCUbfHYQhpXXl4FoCC2RCFXKRvGS5Zr"

# --- francais ---------------------------------------------------------------

QUI = ("Je m'appelle Gabriel Gouveia, fondateur de Lasclay. On isole des vêtements d'hiver avec "
       "une mauvaise herbe, l'asclépiade, qu'on cultive pour sauvegarder un pollinisateur "
       "emblématique et menacé : le papillon monarque.")
MATIERE = ("Ses gousses sont remplies d'une soie creuse, très légère et naturellement hydrophobe. "
           "On la transforme en isolant à Québec, et on en fait des manteaux, des mitaines, des "
           "tuques et des sacs isothermes vendus au Canada et aux États-Unis.")
ANNONCE = ("Ce jeudi 17 septembre, je présente Lasclay dans le premier épisode de la 21e saison "
           "de Dragons' Den, sur CBC et CBC Gem, à 20 h.")
CLOTURE = "Au plaisir et n'hésitez pas à me contacter si vous avez des questions."
SIGNATURE = "Chaleureusement,\n__\nGabriel Gouveia\nCo-fondateur\n+1 (581) 982-5857\nLasclay.com"

AGRICOLE = (
    "Je vous écris parce que l'asclépiade est une histoire agricole avec une date de rupture. "
    "Le groupe Protec-Style, qui exploitait l'usine de Saint-Tite sous le nom d'Encore 3 et "
    "avait réservé 90 % de la récolte québécoise, a fait faillite le 11 octobre 2017 "
    "(https://ici.radio-canada.ca/nouvelle/1061543/asclepiade-soyer-producteurs-industries-"
    "encore3-faillite-monark). Les 125 producteurs de la Coopérative Monark se sont retrouvés "
    "sans acheteur, et la question n'a pas changé depuis : y a-t-il quelqu'un au bout du champ.\n\n"
    "Nous, on achète encore. Sabin Tremblay, à L'Ascension-de-Notre-Seigneur, cultive pour nous "
    "depuis nos tout débuts, et je vais l'aider à récolter le 4 octobre. S'il y a un reportage à "
    "faire, il est là autant qu'ici.")

def fr(pourquoi, offre=None):
    bl = [QUI, MATIERE, pourquoi, ANNONCE,
          "Aller présenter notre entreprise et sa mission à la télévision nationale est une "
          "opportunité qui arrive bien rarement. Je voulais vous en faire part et qui sait, "
          "peut-être vous inspirer un sujet." + (" " + offre if offre else ""),
          media_kit("vous"), BENEFICE, CLOTURE, SIGNATURE]
    return "\n\n".join(bl)


DISPO = "Je suis disponible pour une entrevue d'ici jeudi, ou le vendredi 18 au matin."

SEMAINE_VERTE = {
 "johanne.j.lapierre@radio-canada.ca": ("Johanne Lapierre", "Rédactrice en chef"),
 "catherine.mercier@radio-canada.ca": ("Catherine Mercier", "Animatrice"),
 "france.beaudoin@radio-canada.ca": ("France Beaudoin", "Journaliste"),
 "gilbert.begin@radio-canada.ca": ("Gilbert Bégin", "Journaliste"),
 "carine.monat@radio-canada.ca": ("Carine Monat", "Journaliste"),
 "maxime.poire@radio-canada.ca": ("Maxime Poiré", "Journaliste"),
 "marie-maude.pontbriand@radio-canada.ca": ("Marie Maude Pontbriand", "Journaliste"),
 "julie.vaillancourt@radio-canada.ca": ("Julie Vaillancourt", "Journaliste"),
 "marc-yvan.hebert@radio-canada.ca": ("Marc-Yvan Hébert", "Journaliste-réalisateur"),
 "benoit.livernoche@radio-canada.ca": ("Benoit Livernoche", "Journaliste-réalisateur"),
}

TVA = {
 "nouvelles@tva.ca": ("TVA Nouvelles", "Pupitre national", None),
 "nouvelles.quebec@tva.ca": ("TVA Québec", "Pupitre de Québec",
    "Notre atelier est à Québec, et c'est là que la soie d'asclépiade devient de l'isolant."),
 "nouvelles.cjpm@tva.ca": ("TVA Saguenay", "Pupitre du Saguenay",
PAR_REGION["Saguenay–Lac-Saint-Jean"]),
 "nouvelles.chem@tva.ca": ("TVA Trois-Rivières", "Pupitre de la Mauricie",
PAR_REGION["Mauricie"]),
 "nouvelles.sherbrooke@tva.ca": ("TVA Sherbrooke", "Pupitre de l'Estrie",
PAR_REGION["Estrie"]),
 "nouvelles.cfer@tva.ca": ("TVA Est-du-Québec", "Pupitre de l'Est-du-Québec", None),
 "quebec@quebecormedia.com": ("Québecor Québec", "Salle de nouvelles", None),
 "montreal@quebecormedia.com": ("Québecor Montréal", "Salle de nouvelles", None),
 "sherbrooke@quebecormedia.com": ("Québecor Sherbrooke", "Salle de nouvelles", None),
 "trois-rivieres@quebecormedia.com": ("Québecor Trois-Rivières", "Salle de nouvelles", None),
 "estquebec@quebecormedia.com": ("Québecor Est-du-Québec", "Salle de nouvelles", None),
}

AFFAIRES = (
    "Je vous écris parce que c'est d'abord une histoire d'affaires : bâtir ses propres procédés "
    "faute de sous-traitant prêt à toucher à la fibre, puis changer de modèle manufacturier l'an "
    "dernier pour tenir, et se retrouver à pitcher à la télévision nationale. La vidéo sur le "
    "changement de modèle est ici : https://www.youtube.com/watch?v=GKyHh-Ok9JU")

# --- anglais ----------------------------------------------------------------

EN_QUI = ("My name is Gabriel Gouveia, founder of Lasclay. We insulate winter clothing with a "
          "weed called milkweed, which we grow to help save an emblematic, threatened pollinator: "
          "the monarch butterfly.")
EN_MATIERE = ("Its pods are filled with a hollow floss, very light and naturally water-repellent. "
              "We turn it into insulation in Quebec City and put it into coats, mitts, toques and "
              "cooler bags sold across Canada and the United States.")
EN_ANNONCE = ("This Thursday, September 17, Lasclay is in the first episode of season 21 of "
              "Dragons' Den, on CBC and CBC Gem at 8 p.m. (8:30 NT).")
EN_OFFRE = (f"If you'd like to cover it, or a colleague might, our media kit is here, with "
            f"images from the Dragons' Den floor and of the company: {DRIVE}")
EN_BENEFICE = ("I'm hoping this visibility moves sales, which more broadly is very good "
               "news for the Quebec milkweed growers we keep buying from, and for the threatened "
               "monarchs that keep breeding in their fields.")
EN_CLOTURE = "Happy to answer any questions, and available for an interview this week."
EN_SIGNATURE = "Warmly,\n__\nGabriel Gouveia\nCo-founder\n+1 (581) 982-5857\nLasclay.com"

def en(pourquoi):
    return "\n\n".join(["Hello,", EN_QUI, EN_MATIERE, pourquoi, EN_ANNONCE, EN_OFFRE,
                        EN_BENEFICE, EN_CLOTURE, EN_SIGNATURE])


ANGLO = {
"newsroom@thecanadianpress.com": (
    "The Canadian Press", "Fil de presse national",
    "I'm writing to the wire first because if this is worth two paragraphs, it's worth them in "
    "every paper in the country: a Quebec company insulating winter coats with the only plant "
    "monarch caterpillars can eat is going on national television Thursday.",
    "thecanadianpress.com/contact"),

"bnnassignmentdesk@bellmedia.ca": (
    "BNN Bloomberg", "Pupitre des affectations",
    "The business story: we built our own processing because no subcontractor would touch the "
    "fibre, changed our manufacturing model last year to survive, and are now pitching on "
    "national television.",
    "bnnbloomberg.ca/contact-us"),

"ROB@globeandmail.com": (
    "The Globe and Mail", "Report on Business",
    "A Quebec company built its own processing because no subcontractor would touch the fibre, "
    "changed its manufacturing model last year to survive, and is now pitching on national "
    "television. Whatever happens in the episode, the fibre and the farms behind it are real.",
    "theglobeandmail.com/about/contact"),

"globalnational@globalnews.ca": (
    "Global National", "Pupitre national",
    "A Canadian company goes on Dragons' Den this Thursday with a winter coat insulated by a "
    "weed most farmers spray, and that same weed is the only thing monarch caterpillars eat.",
    "globalnews.ca/pages/contact-us"),

"newstips@globalnews.ca": (
    "Global News", "Ligne de nouvelles",
    "A Canadian company goes on Dragons' Den this Thursday with a winter coat insulated by a "
    "weed most farmers spray, and that same weed is the only thing monarch caterpillars eat.",
    "globalnews.ca/pages/contact-us"),

"montreal@globalnews.ca": (
    "Global Montreal", "Pupitre de Montréal",
    "We're a Quebec City company, the milkweed is grown by Quebec farmers, and the insulation is "
    "made here, Thursday's national broadcast is a local story first.",
    "globalnews.ca/pages/contact-us"),

"insider@retail-insider.com": (
    "Retail Insider", "Rédaction",
    "We're a Canadian direct-to-consumer brand about to get national television exposure, with a "
    "supply chain that starts in Quebec fields. The coat on the shelf begins as a pod in a row of "
    "weeds somebody decided not to spray.",
    "retail-insider.com/contact-us"),

"editor@innovationintextiles.com": (
    "Innovation in Textiles", "Rédaction",
    "You covered Vegeto's milkweed insulation last February. We're the other end of that same "
    "Quebec filière: we buy the harvest, process the floss into insulation ourselves, and sell "
    "finished garments. As far as we know, nobody else holds the whole chain. The Quebec filière collapsed on October 11, 2017 when the group that had reserved 90 per cent of the crop went bankrupt (https://ici.radio-canada.ca/nouvelle/1061543/asclepiade-soyer-producteurs-industries-encore3-faillite-monark), which is the context for anything written about milkweed insulation today.",
    "innovationintextiles.com/contact"),

"editor@knittingindustry.com": (
    "Knitting Industry", "Rédaction",
    "Milkweed floss is a hollow, naturally water-repellent fibre that behaves like down without "
    "an animal. A Quebec filière has been trying to industrialise it since 2013; we process it "
    "ourselves and sell finished garments.",
    "knittingindustry.com/contact"),

"jborneman@textileworld.com": (
    "Textile World", "Rédaction technique",
    "Milkweed floss is a hollow, naturally water-repellent fibre that behaves like down without "
    "an animal, and a Quebec filière has been trying to industrialise it since 2013. We process "
    "it ourselves and sell finished garments. That last step is where the earlier attempts stopped.",
    "textileworld.com/contact"),

"news@fashionunited.com": (
    "FashionUnited Canada", "Rédaction",
    "Plant-based insulation is one of the few places where outerwear can actually leave animal "
    "and petroleum fibres behind, and milkweed is the rare one that also feeds a threatened "
    "pollinator.",
    "fashionunited.ca/contact"),


"viewercontacttoronto@globalnews.ca": (
    "Global Toronto", "Pupitre de Toronto",
    "A Canadian company goes on Dragons' Den this Thursday with a winter coat insulated by a weed most farmers spray, and that same weed is the only thing monarch caterpillars can eat. We grow it, we process the floss into insulation ourselves in Quebec City, and we sell the finished garments across the country.",
    "globalnews.ca/pages/contact-us"),

"calgary@globalnews.ca": (
    "Global Calgary", "Pupitre de Calgary",
    "A Canadian company goes on Dragons' Den this Thursday with a winter coat insulated by a weed most farmers spray, and that same weed is the only thing monarch caterpillars can eat. We grow it, we process the floss into insulation ourselves in Quebec City, and we sell the finished garments across the country.",
    "globalnews.ca/pages/contact-us"),

"edmonton@globalnews.ca": (
    "Global Edmonton", "Pupitre d'Edmonton",
    "A Canadian company goes on Dragons' Den this Thursday with a winter coat insulated by a weed most farmers spray, and that same weed is the only thing monarch caterpillars can eat. We grow it, we process the floss into insulation ourselves in Quebec City, and we sell the finished garments across the country.",
    "globalnews.ca/pages/contact-us"),

"winnipeg@globalnews.ca": (
    "Global Winnipeg", "Pupitre de Winnipeg",
    "A Canadian company goes on Dragons' Den this Thursday with a winter coat insulated by a weed most farmers spray, and that same weed is the only thing monarch caterpillars can eat. We grow it, we process the floss into insulation ourselves in Quebec City, and we sell the finished garments across the country.",
    "globalnews.ca/pages/contact-us"),

"halifax@globalnews.ca": (
    "Global Halifax", "Pupitre d'Halifax",
    "A Canadian company goes on Dragons' Den this Thursday with a winter coat insulated by a weed most farmers spray, and that same weed is the only thing monarch caterpillars can eat. We grow it, we process the floss into insulation ourselves in Quebec City, and we sell the finished garments across the country.",
    "globalnews.ca/pages/contact-us"),

"regina@globalnews.ca": (
    "Global Regina", "Pupitre de Regina",
    "A Canadian company goes on Dragons' Den this Thursday with a winter coat insulated by a weed most farmers spray, and that same weed is the only thing monarch caterpillars can eat. We grow it, we process the floss into insulation ourselves in Quebec City, and we sell the finished garments across the country.",
    "globalnews.ca/pages/contact-us"),

"saskatoon@globalnews.ca": (
    "Global Saskatoon", "Pupitre de Saskatoon",
    "A Canadian company goes on Dragons' Den this Thursday with a winter coat insulated by a weed most farmers spray, and that same weed is the only thing monarch caterpillars can eat. We grow it, we process the floss into insulation ourselves in Quebec City, and we sell the finished garments across the country.",
    "globalnews.ca/pages/contact-us"),

"okanagan@globalnews.ca": (
    "Global Okanagan", "Pupitre de l'Okanagan",
    "A Canadian company goes on Dragons' Den this Thursday with a winter coat insulated by a weed most farmers spray, and that same weed is the only thing monarch caterpillars can eat. We grow it, we process the floss into insulation ourselves in Quebec City, and we sell the finished garments across the country.",
    "globalnews.ca/pages/contact-us"),

"consumermatters@globalnews.ca": (
    "Global, Consumer Matters", "Chronique consommation",
    'A $300 winter coat insulated with a farm weed instead of down or polyester. The consumer question is whether it actually keeps you warm, and that is a fair thing to test on air.',
    "globalnews.ca/pages/contact-us"),

"vancouver@dailyhive.com": (
    "Daily Hive Vancouver", "Pupitre de Vancouver",
    'Your readers can watch it Thursday night. The milkweed is grown by Quebec farmers and the floss is processed into insulation in Quebec City. Final assembly of the garments happens offshore, which is what put the coat near $300 instead of the $1,000 the earlier attempts asked.',
    "dailyhive.com/page/contact"),

"toronto@dailyhive.com": (
    "Daily Hive Toronto", "Pupitre de Toronto",
    'Your readers can watch it Thursday night. The milkweed is grown by Quebec farmers and the floss is processed into insulation in Quebec City. Final assembly of the garments happens offshore, which is what put the coat near $300 instead of the $1,000 the earlier attempts asked.',
    "dailyhive.com/page/contact"),

"calgary@dailyhive.com": (
    "Daily Hive Calgary", "Pupitre de Calgary",
    'Your readers can watch it Thursday night. The milkweed is grown by Quebec farmers and the floss is processed into insulation in Quebec City. Final assembly of the garments happens offshore, which is what put the coat near $300 instead of the $1,000 the earlier attempts asked.',
    "dailyhive.com/page/contact"),

"edmonton@dailyhive.com": (
    "Daily Hive Edmonton", "Pupitre d'Edmonton",
    'Your readers can watch it Thursday night. The milkweed is grown by Quebec farmers and the floss is processed into insulation in Quebec City. Final assembly of the garments happens offshore, which is what put the coat near $300 instead of the $1,000 the earlier attempts asked.',
    "dailyhive.com/page/contact"),

"info@taproot.ca": (
    "Taproot Edmonton", "Rédaction",
    'Your readers can watch it Thursday night. The milkweed is grown by Quebec farmers and the floss is processed into insulation in Quebec City. Final assembly of the garments happens offshore, which is what put the coat near $300 instead of the $1,000 the earlier attempts asked.',
    "taproot.ca/contact"),

"jdavis@textileworld.com": (
    "Textile World", "Rédaction",
    'Milkweed floss is a hollow, naturally water-repellent fibre that behaves like down without an animal. A Quebec filière has been trying to industrialise it since 2013; we process it ourselves and sell finished garments, which is the part nobody had managed to hold.',
    "textileworld.com/contact"),

"news@huddle.today": (
    "Huddle", "Nouvelles d'affaires du Nouveau-Brunswick",
    "The business angle from the Atlantic side: we built our own processing because no "
    "subcontractor would touch the fibre, and we are about to pitch it on national television. "
    "Atlantic Canada has the same problem we had, a raw material with no processing chain.",
    "huddle.today/contact"),

"editors@nunatsiaq.com": (
    "Nunatsiaq News", "Rédaction",
    "Your readers buy winter coats to work in, not to walk to the car. Ours is insulated with a plant fibre instead of down or polyester, and I would rather have it judged by people who actually need it to hold at forty below than by anyone in a city. I'll send one to a reporter who wants to try it and say publicly what they found, good or bad.",
    "nunatsiaq.com/contact"),

"sarah@cabinradio.ca": (
    "Cabin Radio", "Rédaction, T.N.-O.",
    "Your readers buy winter coats to work in, not to walk to the car. Ours is insulated with a plant fibre instead of down or polyester, and I would rather have it judged by people who actually need it to hold at forty below than by anyone in a city. I'll send one to a reporter who wants to try it and say publicly what they found, good or bad.",
    "cabinradio.ca/contact"),

"newsroom@nnsl.com": (
    "NNSL Media", "Salle de nouvelles, T.N.-O. et Nunavut",
    "Your readers buy winter coats to work in, not to walk to the car. Ours is insulated with a plant fibre instead of down or polyester, and I would rather have it judged by people who actually need it to hold at forty below than by anyone in a city. I'll send one to a reporter who wants to try it and say publicly what they found, good or bad.",
    "nnsl.com/contact-us"),

"newstips@yukon-news.com": (
    "Yukon News", "Ligne de nouvelles",
    "Your readers buy winter coats to work in, not to walk to the car. Ours is insulated with a plant fibre instead of down or polyester, and I would rather have it judged by people who actually need it to hold at forty below than by anyone in a city. I'll send one to a reporter who wants to try it and say publicly what they found, good or bad.",
    "yukon-news.com/contact-us"),

"info@nbmediacoop.org": (
    "NB Media Co-op", "Rédaction",
    "The farm side of it: milkweed is a weed most growers spray, and a Quebec cooperative of "
    "125 producers lost its only buyer overnight in 2017. We still buy the harvest. That "
    "question, whether anyone is waiting at the end of the field, is not specific to Quebec.",
    "nbmediacoop.org/contact"),

"editor@betterfarming.com": (
    "Better Farming", "Rédaction",
    "The farm side: milkweed is a weed most growers spray, and a Quebec filière has been trying "
    "since 2013 to make it pay at the field gate. It stopped on October 11, 2017, when the group "
    "that had reserved 90 per cent of the Quebec crop went bankrupt and 125 growers lost their "
    "buyer overnight (https://ici.radio-canada.ca/nouvelle/1061543/asclepiade-soyer-producteurs-"
    "industries-encore3-faillite-monark). We still buy the harvest, and that is the part that "
    "decides whether anyone plants it again.",
    "betterfarming.com/contact"),
}


def feuille(wb, titre, entetes, lignes, largeurs):
    if titre in wb.sheetnames:
        del wb[titre]
    ws = wb.create_sheet(titre)
    ws.append(entetes)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="1F3864")
    for l, w in zip("ABCDEFGHIJ", largeurs):
        ws.column_dimensions[l].width = w
    for ligne in lignes:
        ws.append(ligne)
        for c in ws[ws.max_row]:
            c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[ws.max_row].height = 200
    ws.freeze_panes = "A2"
    return ws


def main(chiffrier):
    wb = openpyxl.load_workbook(chiffrier)

    fr_lignes = []
    for adresse, (nom, role) in SEMAINE_VERTE.items():
        texte = f"Bonjour {nom.split()[0]},\n\n" + fr(AGRICOLE, DISPO)
        fr_lignes.append([adresse, nom, "La Semaine verte (Radio-Canada)", role, "C",
                          "L'asclépiade à Dragons' Den le 17 sept!",
                          "ici.radio-canada.ca/tele/la-semaine-verte", None, None, texte])
    for adresse, (media, role, accroche) in TVA.items():
        texte = "Bonjour,\n\n" + fr(accroche or AFFAIRES, DISPO)
        fr_lignes.append([adresse, media, media, role, "I" if "TVA" in media else "E",
                          "L'asclépiade à Dragons' Den le 17 sept!",
                          "tvanouvelles.ca/nous-joindre", None, None, texte])
    feuille(wb, "Ajouts FR, RC et TVA",
            ["Courriel", "Nom", "Média", "Rôle", "Angle", "Objet", "Source de l'adresse",
             "Envoyé le", "Réponse", "Brouillon"],
            fr_lignes, (40, 24, 30, 24, 7, 44, 38, 12, 12, 100))

    en_lignes = []
    for adresse, (media, role, pourquoi, source) in ANGLO.items():
        en_lignes.append([adresse, media, role, "H",
                          "Quebec milkweed on Dragons' Den, this Thursday",
                          pourquoi, source, None, None, en(pourquoi)])
    feuille(wb, "Presse anglophone",
            ["Courriel", "Média", "Rôle", "Angle", "Objet", "Pourquoi eux",
             "Source de l'adresse", "Envoyé le", "Réponse", "Brouillon"],
            en_lignes, (38, 30, 26, 7, 46, 60, 34, 12, 12, 100))

    wb.save(chiffrier)
    print(f"{len(fr_lignes)} contacts FR ajoutés (La Semaine verte + TVA/Québecor), "
          f"{len(en_lignes)} anglophones, aucun @cbc.ca")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "Lasclay_v2.xlsx"))
