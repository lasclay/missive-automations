#!/usr/bin/env python3
"""Multiplie les étiquettes Dymo selon le nombre de sachets de graines.

Contrainte d'expédition : un envoi en enveloppe contient au maximum 5 sachets.
Une commande de N sachets exige donc ceil(N/5) enveloppes, donc autant
d'étiquettes d'adresse identiques.

Usage :
    python3 etiquettes_enveloppes.py <packing_slips.pdf> <adresses.csv> [dossier_sortie]

Produit dans le dossier de sortie :
    etiquettes_dymo.csv  — mêmes colonnes que le CSV d'entrée, lignes dupliquées
    analyse_batch.csv    — une ligne par commande : sachets, enveloppes, détail
"""
import csv
import json
import math
import re
import sys
from pathlib import Path

import pdfplumber

MAX_SACHETS_PAR_ENVELOPPE = 5


def normalise(txt):
    """Le PDF utilise un tiret insécable (U+00AD) ; on le ramène à '-'."""
    return re.sub(r"\s+", " ", txt).replace("­", "-").strip()


def taille_paquet(desc):
    """Nombre de sachets par unité vendue, d'après le libellé de l'article."""
    if "Paquet de 10" in desc or "-x10" in desc:
        return 10
    if "Paquet de 5" in desc or "-x5" in desc:
        return 5
    return 1


def lire_packing_slips(chemin_pdf):
    """Retourne [{'order','page','items':[{'desc','qty'}]}] pour chaque page."""
    commandes = []
    with pdfplumber.open(chemin_pdf) as pdf:
        for index, page in enumerate(pdf.pages):
            mots = page.extract_words()
            numero = None
            for i, mot in enumerate(mots):
                if mot["text"] == "Order":
                    numero = normalise("".join(m["text"] for m in mots[i + 1:i + 3])).replace("#", "")
            entete = [m for m in mots if m["text"] == "Qty"]
            haut_entete = entete[0]["top"] if entete else 0

            lignes = {}
            for mot in mots:
                if mot["top"] <= haut_entete + 2:
                    continue
                lignes.setdefault(round(mot["top"], 1), []).append(mot)

            articles = []
            courant = None
            for haut in sorted(lignes):
                mots_ligne = sorted(lignes[haut], key=lambda m: m["x0"])
                texte = " ".join(m["text"] for m in mots_ligne)
                if texte.startswith(("Sub Total", "Shipping:", "Total:", "ì")):
                    continue
                # Une ligne d'article porte son prix unitaire dans la colonne Price.
                # Les rabais s'affichent entre parenthèses : ($13.20), donc ignorés.
                prix = [m for m in mots_ligne if m["text"].startswith("$") and 185 <= m["x0"] <= 218]
                if prix:
                    qte = [m for m in mots_ligne
                           if 216 <= m["x0"] <= 245 and re.fullmatch(r"\d+", m["text"])]
                    desc = " ".join(m["text"] for m in mots_ligne if m["x0"] < 185)
                    courant = {"desc": desc, "qty": int(qte[0]["text"]) if qte else 1}
                    articles.append(courant)
                elif courant is not None:
                    # Suite de la description sur la ligne suivante.
                    courant["desc"] += " " + texte

            commandes.append({"page": index + 1, "order": numero, "items": articles})
    return commandes


def compter(commandes):
    resultats = {}
    for cmd in commandes:
        sachets = 0
        detail = []
        autres = []
        for article in cmd["items"]:
            desc = normalise(article["desc"])
            if "Graines" in desc:
                paquet = taille_paquet(desc)
                sachets += paquet * article["qty"]
                variete = re.search(r"Graines d'asclépiade - ([A-Za-zéèê]+)", desc)
                detail.append(f"{variete.group(1) if variete else '?'} {article['qty']}x{paquet}")
            else:
                autres.append(f"{desc[:60]} (qté {article['qty']})")
        resultats[cmd["order"]] = {
            "page": cmd["page"],
            "sachets": sachets,
            "enveloppes": max(1, math.ceil(sachets / MAX_SACHETS_PAR_ENVELOPPE)),
            "detail": " + ".join(detail),
            "autres": " + ".join(autres),
        }
    return resultats


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    chemin_pdf, chemin_csv = sys.argv[1], sys.argv[2]
    sortie = Path(sys.argv[3] if len(sys.argv) > 3 else ".")
    sortie.mkdir(parents=True, exist_ok=True)

    compte = compter(lire_packing_slips(chemin_pdf))

    with open(chemin_csv, newline="", encoding="utf-8-sig") as f:
        lecteur = csv.DictReader(f)
        colonnes = lecteur.fieldnames
        adresses = list(lecteur)

    col_commande = colonnes[0]
    manquantes = [a[col_commande] for a in adresses if a[col_commande] not in compte]
    sans_adresse = sorted(set(compte) - {a[col_commande] for a in adresses})

    with open(sortie / "etiquettes_dymo.csv", "w", newline="", encoding="utf-8") as f:
        ecrivain = csv.DictWriter(f, fieldnames=colonnes, quoting=csv.QUOTE_ALL)
        ecrivain.writeheader()
        total = 0
        for adresse in adresses:
            n = compte.get(adresse[col_commande], {}).get("enveloppes", 1)
            for _ in range(n):
                ecrivain.writerow(adresse)
            total += n

    with open(sortie / "analyse_batch.csv", "w", newline="", encoding="utf-8") as f:
        ecrivain = csv.writer(f, quoting=csv.QUOTE_ALL)
        ecrivain.writerow(["Commande", "Client", "Page", "Sachets", "Enveloppes",
                           "Detail sachets", "Autres articles"])
        for adresse in adresses:
            info = compte.get(adresse[col_commande], {})
            ecrivain.writerow([adresse[col_commande], adresse[colonnes[1]],
                               info.get("page", ""), info.get("sachets", ""),
                               info.get("enveloppes", 1), info.get("detail", ""),
                               info.get("autres", "")])

    print(f"Commandes            : {len(adresses)}")
    print(f"Sachets de graines   : {sum(compte[a[col_commande]]['sachets'] for a in adresses if a[col_commande] in compte)}")
    print(f"Étiquettes à imprimer: {total}")
    if manquantes:
        print(f"⚠️  Sans packing slip : {manquantes}")
    if sans_adresse:
        print(f"⚠️  Sans adresse CSV  : {sans_adresse}")


if __name__ == "__main__":
    main()
