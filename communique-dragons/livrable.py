#!/usr/bin/env python3
"""Aplatit les deux feuilles de Lasclay_v2.xlsx en un seul chiffrier a editer.

Gabriel edite la colonne « TA VERSION » pour montrer le registre attendu ; tout
ce qu'il a deja ecrit dans les trois colonnes de droite est repris d'une version
a l'autre, sinon chaque regeneration effacerait ses corrections.
"""
import sys
import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

VERSION = 13
SOURCE = "Lasclay_v2.xlsx"
CIBLE = "Lasclay_brouillons_a_editer.xlsx"

COLONNES = ["Liste", "Nom", "Média", "Courriel", "Région", "Date / fonction",
            "Contexte connu", "Angle", "Registre", "Objet", f"Brouillon v{VERSION}",
            "TA VERSION", "CE QUI N'ALLAIT PAS", "Verdict"]
LARGEURS = [11, 24, 24, 32, 20, 15, 30, 7, 10, 46, 86, 86, 40, 14]

def changements(kit, chauds, mercis):
  return [
    (f"Version {VERSION} — deux jours avant la diffusion", None),
    (None, None),
    ("Ce que les envois ont appris",
     "Trois réponses sur tes 23, et une seule entrevue décrochée : Guillaume Roy, en "
     "vingt-six minutes. C'est le seul courriel dont l'objet nommait sa région, et le seul "
     "qui lui donnait quelqu'un à aller voir — Sabin Tremblay et ses champs. Tout le détail "
     "est dans 11-ce-que-les-envois-ont-appris.md."),
    ("Objets régionalisés",
     "Les 38 contacts de la Mauricie, du Centre-du-Québec, de l'Estrie, de la Montérégie et "
     "du Lac-Saint-Jean reçoivent « L'asclépiade de [leur région] à Dragons' Den! ». Les "
     "autres suivent les formes courtes que tu avais réécrites à la main."),
    ("Ce jeudi",
     "« Le 17 septembre prochain » est devenu « Ce jeudi 17 septembre » : à deux jours, la "
     "date n'est plus une information, c'est un délai. La disponibilité ne promet plus « la "
     "semaine du 14 septembre », qui est cette semaine."),
    ("Presse anglophone",
     "L'angle H avait zéro contact pour une émission de CBC. Neuf adresses, toutes publiées "
     "par le média lui-même sur sa page de contact — CBC Media Centre, Global National et "
     "Global Montréal, le Report on Business, Retail Insider, FashionUnited, et trois revues "
     "textiles dont Innovation in Textiles, qui a couvert l'asclépiade de Vegeto en février. "
     "Onglet « Presse anglophone »."),
    ("Adresses non devinées",
     "Beaucoup de rédactions anglophones ne publient qu'un formulaire. Je ne comble pas le "
     "trou avec des « prénom.nom@ » déduits : une adresse inventée rebondit et abîme le "
     "domaine qui doit livrer l'infolettre de prévente."),
    (None, None),
    ("À mettre à jour", None),
    (None, None),
    ("Valérie Simard",
     "Ne couvre plus la mode, elle est aux actualités environnement et climat. Elle a "
     "transmis à Olivia Lévy, à La Presse, et veut être tenue au courant des RÉPERCUSSIONS "
     "du passage, pas de l'annonce."),
    ("Sylvie Lemieux",
     "N'est plus au Journal de Montréal : Les Affaires et La Terre de chez nous. Elle dit "
     "elle-même que le volet agricole intéresserait La Terre."),
    ("Anne-Sophie Roy", "En congé de maternité. Tu as écrit à Mme Courteau à sa place."),
    (None, None),
    ("Rappels", None),
    (None, None),
    ("Diffusion", "Jeudi 17 septembre 2026, 20 h (20 h 30 NT), CBC et CBC Gem."),
    ("Envoi", "Missive, un appel par journaliste, suivi des ouvertures et des clics "
              "désactivé. Le mode par défaut dépose un brouillon."),
    ("Interdits CBC", "Rien sur l'issue avant le 17. Aucun logo ni « vu à Dragons' Den »."),
]


def index(ws):
    return {c.value: i for i, c in enumerate(ws[1])}


def lignes():
    wb = openpyxl.load_workbook(SOURCE)
    ws = wb["Liste chaude (34)"]
    h = index(ws)
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not r[h["Nom"]]:
            continue
        yield ["chaude", r[h["Nom"]], r[h["Média"]], r[h["Courriel"]], None,
               r[h["Dernier contact"]], r[h["Sujet du dernier échange"]],
               r[h["Angle"]], r[h["Registre"]], r[h["Objet suggéré"]], r[h["Brouillon"]]]

    ws = wb["Liste froide FPJQ (217)"]
    h = index(ws)
    for r in ws.iter_rows(min_row=2, values_only=True):
        nom = " ".join(x for x in (r[h["Prénom"]], r[h["Nom"]]) if x)
        if not nom:
            continue
        yield [f"froide {r[h['Priorité']]}", nom, r[h["Média"]], r[h["Courriel"]],
               r[h["Région"]], r[h["Fonction"]], r[h["Secteurs pertinents"]],
               r[h["Angle"]], "vous", r[h["Objet suggéré"]], r[h["Brouillon"]]]

    # La presse anglophone : meme colonnes, un seul angle, pas de region.
    if "Presse anglophone" in wb.sheetnames:
        ws = wb["Presse anglophone"]
        h = index(ws)
        for r in ws.iter_rows(min_row=2, values_only=True):
            if not r[h["Courriel"]]:
                continue
            yield ["anglo", r[h["Média"]], r[h["Média"]], r[h["Courriel"]], "Canada",
                   r[h["Source de l'adresse"]], r[h["Pourquoi eux"]], "H", "vous",
                   r[h["Objet"]], r[h["Brouillon"]]]


def acquis():
    """Ce que Gabriel a deja ecrit dans les trois colonnes de droite, par courriel."""
    try:
        wb = openpyxl.load_workbook(CIBLE)
    except FileNotFoundError:
        return {}
    ws = wb["Brouillons à éditer"]
    garde = {}
    for r in ws.iter_rows(min_row=2, values_only=True):
        if r[3] and any(r[11:14]):
            garde[r[3]] = list(r[11:14])
    return garde


def main():
    garde = acquis()
    # Les comptes du sommaire se calculent, ils ne s'écrivent pas : une sortie de
    # plus les laissait faux, et un chiffre faux dans un sommaire est pire que pas
    # de sommaire du tout.
    tout = list(lignes())
    kit = sum(1 for l in tout if l[10] and "1pyCUbfHYQhpXXl4FoCC2RCFXKRvGS5Zr" in l[10])
    chauds = sum(1 for l in tout if l[0] == "chaude" and not l[10].startswith("NE PAS"))
    mercis = sum(1 for l in tout if l[0] == "chaude" and "erci" in l[10]
                 and not l[10].startswith("NE PAS"))
    wb = openpyxl.Workbook()

    ws = wb.active
    ws.title = "Ce qui a changé"
    ws.column_dimensions["A"].width = 26
    ws.column_dimensions["B"].width = 108
    for titre, texte in changements(kit, chauds, mercis):
        ws.append([titre, texte])
        ws.cell(ws.max_row, 1).font = Font(bold=True, size=12 if titre and not texte else 11)
        ws.cell(ws.max_row, 2).alignment = Alignment(wrap_text=True, vertical="top")

    ws = wb.create_sheet("Brouillons à éditer")
    ws.append(COLONNES)
    tete = PatternFill("solid", fgColor="1F3864")
    for i, c in enumerate(ws[1], start=1):
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = tete
        c.alignment = Alignment(vertical="center")
        ws.column_dimensions[c.column_letter].width = LARGEURS[i - 1]

    edite = PatternFill("solid", fgColor="FFF2CC")
    n = 0
    for ligne in lignes():
        ws.append(ligne + garde.get(ligne[3], [None, None, None]))
        n += 1
        for col in (7, 10, 11, 12, 13):
            ws.cell(ws.max_row, col).alignment = Alignment(wrap_text=True, vertical="top")
        for col in (12, 13, 14):
            ws.cell(ws.max_row, col).fill = edite

    ws.freeze_panes = "B2"
    ws.auto_filter.ref = f"A1:N{ws.max_row}"
    verdict = DataValidation(type="list",
                             formula1='"à réécrire au complet,à corriger,bon,ne pas envoyer"',
                             allow_blank=True)
    registre = DataValidation(type="list", formula1='"tu,vous,—"', allow_blank=True)
    ws.add_data_validation(verdict)
    ws.add_data_validation(registre)
    verdict.add(f"N2:N{ws.max_row}")
    registre.add(f"I2:I{ws.max_row}")

    wb.save(CIBLE)
    print(f"{CIBLE} : {n} contacts, {kit} brouillons avec le média kit, "
          f"{len(garde)} édition(s) reprise(s)")


if __name__ == "__main__":
    sys.exit(main())
