#!/usr/bin/env python3
"""La presse anglophone — l'angle H, qui n'avait aucun contact.

Une emission de CBC diffusee dans tout le pays et pas un seul contact anglais :
c'est le trou le plus evident du dossier depuis le debut. Les listes de depart
etaient la FPJQ et nos propres echanges, tous francophones.

Ce que ces adresses ont en commun : elles sont PUBLIEES par le media lui-meme,
sur sa page de contact, pour recevoir des nouvelles. Aucune n'est devinee a
partir d'un patron d'adresse — ni « prenom.nom@ », ni un nom trouve ailleurs.
Quand une redaction ne publie qu'un formulaire, elle ne figure pas ici : mieux
vaut un trou qu'une adresse inventee qui rebondit et salit le domaine.

Trouvees le 15 septembre 2026, chacune verifiee sur la page citee.
"""
import sys

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill

DRIVE = "https://drive.google.com/drive/folders/1pyCUbfHYQhpXXl4FoCC2RCFXKRvGS5Zr"
OBJET = "Quebec milkweed on Dragons' Den — this Thursday"

QUI = ("My name is Gabriel Gouveia, founder of Lasclay. We insulate winter clothing with a "
       "weed — milkweed — that we grow to help save an emblematic, threatened pollinator: "
       "the monarch butterfly.")

MATIERE = ("Its pods are filled with a hollow floss, very light and naturally water-repellent. "
           "We turn it into insulation in Quebec City and put it into coats, mitts, toques and "
           "cooler bags sold across Canada and the United States.")

ANNONCE = ("This Thursday, September 17, Lasclay is in the first episode of season 21 of "
           "Dragons' Den, on CBC and CBC Gem at 8 p.m. (8:30 NT).")

OFFRE = (f"If you'd like to cover it — or a colleague might — our media kit is here, with "
         f"images from the Dragons' Den floor and of the company: {DRIVE}")

BENEFICE = ("I'm genuinely hoping this visibility moves sales, which more broadly is very good "
            "news for the Quebec milkweed growers we keep buying from, and for the threatened "
            "monarchs that keep breeding in their fields.")

CLOTURE = "Happy to answer any questions, and available for an interview this week."

SIGNATURE = ("Warmly,\n__\nGabriel Gouveia\nCo-founder\n+1 (581) 982-5857\nLasclay.com")

# adresse : (media, salutation, pourquoi vous, source de l'adresse)
CONTACTS = {
"cbcpr@cbc.ca": (
    "CBC Media Centre", "Hello",
    "I'm writing to the people who handle publicity for the show: we're the Quebec company in "
    "episode 1, and we have high-resolution images and a founder available all week if that is "
    "useful to anyone covering the season premiere.",
    "cbc.ca/mediacentre/contact"),

"editor@innovationintextiles.com": (
    "Innovation in Textiles", "Hello",
    "You covered Vegeto's milkweed insulation last February. We're the other end of that same "
    "Quebec filière: we buy the harvest, process the floss into insulation ourselves, and sell "
    "finished garments — which makes us, as far as we know, the only ones doing the whole chain.",
    "innovationintextiles.com/contact"),

"jborneman@textileworld.com": (
    "Textile World", "Hello",
    "Milkweed floss is a hollow, naturally water-repellent fibre that behaves like down without "
    "an animal, and a Quebec filière has been trying to industrialise it since 2013. We process "
    "it ourselves and sell finished garments, which is the part nobody had managed to hold.",
    "textileworld.com/contact"),

"insider@retail-insider.com": (
    "Retail Insider", "Hello",
    "We're a Canadian direct-to-consumer brand about to get national television exposure, with "
    "a supply chain that starts in Quebec fields — a retail story as much as an environmental one.",
    "retail-insider.com/contact-us"),

"news@fashionunited.com": (
    "FashionUnited Canada", "Hello",
    "Plant-based insulation is one of the few places where outerwear can actually leave animal "
    "and petroleum fibres behind, and milkweed is the rare one that also feeds a threatened "
    "pollinator.",
    "fashionunited.ca/contact"),

"ROB@globeandmail.com": (
    "The Globe and Mail — Report on Business", "Hello",
    "A Quebec company built its own processing because no subcontractor would touch the fibre, "
    "changed its manufacturing model last year to survive, and is now pitching on national "
    "television. Whatever happens in the episode, the fibre and the farms behind it are real.",
    "theglobeandmail.com/about/contact"),

"globalnational@globalnews.ca": (
    "Global National", "Hello",
    "A Canadian company goes on Dragons' Den this Thursday with a winter coat insulated by a "
    "weed most farmers spray — and the same plant is the only thing monarch caterpillars eat.",
    "globalnews.ca/pages/contact-us"),

"newstips@globalnews.ca": (
    "Global News — news tips", "Hello",
    "A Canadian company goes on Dragons' Den this Thursday with a winter coat insulated by a "
    "weed most farmers spray — and the same plant is the only thing monarch caterpillars eat.",
    "globalnews.ca/pages/contact-us"),

"montreal@globalnews.ca": (
    "Global Montreal", "Hello",
    "We're a Quebec City company, the milkweed is grown by Quebec farmers, and the insulation "
    "is made here — the national broadcast on Thursday is a local story first.",
    "globalnews.ca/pages/contact-us"),
}


def monter(adresse):
    media, salut, pourquoi, _ = CONTACTS[adresse]
    return "\n\n".join([f"{salut},", QUI, MATIERE, pourquoi, ANNONCE, OFFRE, BENEFICE,
                        CLOTURE, SIGNATURE])


def main(chiffrier):
    wb = openpyxl.load_workbook(chiffrier)
    titre = "Presse anglophone"
    if titre in wb.sheetnames:
        del wb[titre]
    ws = wb.create_sheet(titre)
    entetes = ["Courriel", "Média", "Angle", "Objet", "Pourquoi eux", "Source de l'adresse",
               "Envoyé le", "Réponse", "Brouillon"]
    ws.append(entetes)
    tete = PatternFill("solid", fgColor="1F3864")
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = tete
    for l, w in zip("ABCDEFGHI", (34, 30, 7, 46, 60, 34, 12, 12, 100)):
        ws.column_dimensions[l].width = w

    for adresse, (media, _, pourquoi, source) in CONTACTS.items():
        ws.append([adresse, media, "H", OBJET, pourquoi, source, None, None, monter(adresse)])
        for c in ws[ws.max_row]:
            c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[ws.max_row].height = 220
    ws.freeze_panes = "A2"
    wb.save(chiffrier)

    md = ["# Presse anglophone — angle H", "",
          "Une émission de CBC diffusée dans tout le pays, et pas un contact anglophone : c'est",
          "le trou le plus évident du dossier. Voici les premières adresses, toutes **publiées",
          "par le média lui-même** sur sa page de contact. Aucune n'est devinée à partir d'un",
          "patron « prénom.nom@ » — une adresse inventée rebondit et abîme le domaine qui doit",
          "livrer l'infolettre de prévente.", ""]
    for adresse, (media, _, pourquoi, source) in CONTACTS.items():
        md += [f"## {media}", "", f"`{adresse}` — vérifiée sur {source}", "",
               f"**Pourquoi eux.** {pourquoi}", "", "```", monter(adresse), "```", ""]
    open("12-presse-anglophone.md", "w", encoding="utf-8").write("\n".join(md))
    print(f"{len(CONTACTS)} contacts anglophones écrits dans {chiffrier} et 12-presse-anglophone.md")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "Lasclay_v2.xlsx"))
