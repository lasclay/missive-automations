#!/usr/bin/env python3
"""Les pupitres d'emissions : radio de Radio-Canada, et l'economie a TVA.

Ce qui manquait aux 315 premiers envois. Les listes visaient des journalistes
nommes et La Semaine verte ; aucune matinale, aucune emission de retour, aucune
emission d'affaires. Or une emission se pitche autrement qu'un pupitre ecrit :
elle a besoin d'un invite disponible, d'une date, et d'un objet a montrer.

Les equipes viennent des pages « A propos » de chaque emission, verifiees le
16 septembre 2026. L'adresse suit le patron maison, prenom.nom@radio-canada.ca
et prenom.nom@tva.ca, celui de toutes les adresses qui marchent deja dans nos
listes. Une equipe change souvent : ce qui rebondit rebondit, ca ne coute rien.

    python3 emissions_radio.py              simulation
    python3 emissions_radio.py --envoyer    envoie, un aux 20 secondes
"""
import base64
import datetime
import json
import os
import subprocess
import sys
import time

from voix_gabriel import en_html, lien, media_kit
from histoire_asclepiade import SITE_FR, PAGE_FR, MONARQUE_FR

ICI = os.path.dirname(os.path.abspath(__file__))
CLIENT = os.path.join(os.path.dirname(ICI), "missive_client.js")
JOURNAL = os.path.join(ICI, "emissions_journal.json")
PHOTO = os.path.join(ICI, "dragons-plateau.jpg")
DE = "media@lasclay.com"

SIGNATURE = """Chaleureusement,
__
Gabriel Gouveia
Co-fondateur
+1 (581) 982-5857
Lasclay.com"""

# (prenom, adresse, emission, role, ville)
EQUIPES = [
    # Premiere heure, ICI Premiere Quebec, 6 h a 9 h
    ("Alexandre", "alexandre.duval@radio-canada.ca", "Première heure", "animateur", "quebec"),
    ("Isabelle", "isabelle.fleury@radio-canada.ca", "Première heure", "réalisation", "quebec"),
    ("Xavier", "xavier.gagnon@radio-canada.ca", "Première heure", "recherche", "quebec"),
    ("Bryan", "bryan.rochon@radio-canada.ca", "Première heure", "recherche", "quebec"),
    # C'est encore mieux l'apres-midi, ICI Premiere Quebec, 15 h a 18 h
    ("Guillaume", "guillaume.dumas@radio-canada.ca",
     "C'est encore mieux l'après-midi", "animateur", "quebec"),
    ("Sandra", "sandra.lalancette@radio-canada.ca",
     "C'est encore mieux l'après-midi", "réalisation", "quebec"),
    ("Mathieu", "mathieu.boulay@radio-canada.ca",
     "C'est encore mieux l'après-midi", "recherche", "quebec"),
    # Tout un matin, ICI Premiere Montreal
    ("Patrick", "patrick.masbourian@radio-canada.ca", "Tout un matin", "animateur", "montreal"),
    ("Dominique", "dominique.depatie@radio-canada.ca", "Tout un matin", "réalisation", "montreal"),
    ("Catherine", "catherine.bordeleau@radio-canada.ca", "Tout un matin", "recherche", "montreal"),
    ("Eric", "eric.st-pierre@radio-canada.ca", "Tout un matin", "recherche", "montreal"),
    # Le 15-18, ICI Premiere Montreal
    ("Annie", "annie.desrochers@radio-canada.ca", "Le 15-18", "animatrice", "montreal"),
    ("Stéphanie", "stephanie.gendron@radio-canada.ca", "Le 15-18", "chef de contenu", "montreal"),
    ("Noémie", "noemie.desilets@radio-canada.ca", "Le 15-18", "recherche", "montreal"),
    ("Caroline", "caroline.roy-blais@radio-canada.ca", "Le 15-18", "recherche", "montreal"),
    # Moteur de recherche
    ("Matthieu", "matthieu.dugal@radio-canada.ca", "Moteur de recherche", "animateur", "sciences"),
    ("Julie", "julie.brunet@radio-canada.ca", "Moteur de recherche", "réalisation", "sciences"),
    # Les annees lumiere (Sophie-Andree Blondin a deja recu le courriel froid)
    ("Sébastien", "sebastien.landry@radio-canada.ca", "Les années lumière", "réalisation", "sciences"),
    ("Gino", "gino.harel@radio-canada.ca", "Les années lumière", "journaliste", "sciences"),
    ("Damien", "damien.grapton@radio-canada.ca", "Les années lumière", "recherche", "sciences"),
    # LCN / TVA
    ("Pierre-Olivier", "pierre-olivier.zappa@tva.ca", "À vos affaires", "animateur", "affaires"),
]

QUI = ("Je m'appelle Gabriel Gouveia, fondateur de " + lien("Lasclay", SITE_FR) +
       ". On isole des vêtements d'hiver avec une mauvaise herbe, l'asclépiade, qu'on "
       "cultive pour sauvegarder un pollinisateur emblématique et menacé : le papillon "
       "monarque.")

ANNONCE = ("Demain soir, jeudi 17 septembre, je présente Lasclay dans le premier épisode "
           "de la 21e saison de Dragons' Den, sur CBC et CBC Gem.")

POURQUOI = {
 "quebec": ("Je vous écris parce que l'atelier est à Québec, dans Limoilou, et que "
            "l'asclépiade n'est pas une plante importée : c'est une " +
            lien("mauvaise herbe indigène", PAGE_FR) + " qui pousse ici depuis toujours, "
            "et c'est pour ça que " + lien("le monarque en dépend", MONARQUE_FR) + "."),
 "montreal": ("Je vous écris parce que l'asclépiade était une mauvaise herbe qu'on "
              "arrachait, et qu'elle est devenue une culture avec des producteurs, une "
              "usine et des manteaux. C'est une " + lien("plante indigène", PAGE_FR) +
              ", et " + lien("le monarque n'en mange aucune autre", MONARQUE_FR) + "."),
 "sciences": ("Je vous écris parce que la soie de l'asclépiade est un objet curieux : un "
              "tube creux à 80 %, enduit d'une cire hydrophobe, dont les fibres portent "
              "une charge qui les fait se repousser. C'est ce qui forme le parachute de "
              "la graine, et c'est ce qui emprisonne l'air. Chaque follicule en produit "
              "plus de 200. C'est une " + lien("plante indigène", PAGE_FR) + ", la seule "
              "que " + lien("les chenilles du monarque", MONARQUE_FR) + " peuvent manger."),
 "affaires": ("Je vous écris parce que c'est un dossier économique avant d'être une "
              "histoire de papillons. La filière québécoise de l'asclépiade s'est cassée "
              "à la faillite de 2017, et on a rebâti une chaîne complète depuis : "
              "approvisionnement chez des producteurs d'ici, transformation de la fibre "
              "à Québec, et une gamme vendue au Canada et aux États-Unis."),
}

DISPO = {
 "quebec": ("Je suis à Québec et disponible en studio, demain matin comme le reste de la "
            "semaine. Je peux apporter de la soie brute et un manteau ouvert : ça se "
            "touche, et personne ne s'attend à ce que ça pèse aussi peu."),
 "montreal": ("Je suis à Québec, disponible au téléphone n'importe quand, et je peux me "
              "déplacer à Montréal cette semaine. Je peux apporter de la soie brute et un "
              "manteau ouvert."),
 "sciences": ("Je suis à Québec et disponible quand ça vous convient, en studio ou au "
              "téléphone. L'atelier de Limoilou est ouvert si vous voulez voir comment "
              "une gousse devient un isolant."),
 "affaires": ("Je suis à Québec, disponible en studio à Montréal ou en duplex, demain "
              "comme le reste de la semaine."),
}


def corps(prenom, emission, ville):
    blocs = [f"Bonjour {prenom},", QUI, ANNONCE, POURQUOI[ville], DISPO[ville],
             media_kit("vous"), SIGNATURE]
    return "\n\n".join(b for b in blocs if b)


def appel(charge):
    p = subprocess.run(["node", CLIENT, "send"], input=json.dumps(charge),
                       capture_output=True, text=True, timeout=300)
    if p.returncode != 0:
        return {"erreur": (p.stderr or p.stdout).strip()[:300]}
    try:
        return json.loads(p.stdout)
    except ValueError:
        return {"erreur": p.stdout.strip()[:300]}


def main(argv):
    envoyer = "--envoyer" in argv
    pause = 20.0
    if "--pause" in argv:
        pause = float(argv[argv.index("--pause") + 1])
    journal = json.load(open(JOURNAL, encoding="utf-8")) if os.path.exists(JOURNAL) else {}
    deja = set(journal)
    for f in ("envoi_fr_journal.json", "envoi_en_journal.json"):
        c = os.path.join(ICI, f)
        if os.path.exists(c):
            deja |= set(json.load(open(c, encoding="utf-8")))

    reste = [e for e in EQUIPES if e[1].lower() not in deja]
    print(f"{len(EQUIPES)} pupitres, {len(EQUIPES) - len(reste)} déjà servis, "
          f"{len(reste)} à envoyer, un aux {pause:.0f} s.", flush=True)
    if not envoyer:
        p, a, em, r, v = reste[0]
        print(f"\n--- exemple : {a} ({em}, {r}) ---")
        print(corps(p, em, v))
        print("\n--- la file ---")
        for p, a, em, r, v in reste:
            print(f"  · {a:42s} {em} ({r})")
        print("\nSimulation. Relancer avec --envoyer.")
        return 0

    pieces = [{"base64_data": base64.b64encode(open(PHOTO, "rb").read()).decode(),
               "filename": "lasclay-dragons-den.jpg"}]
    faits, echecs = 0, []
    for i, (prenom, adresse, emission, role, ville) in enumerate(reste, 1):
        res = appel({"from": DE, "to": [adresse],
                     "subject": f"Invité possible pour {emission} : l'asclépiade à Dragons' Den demain",
                     "body": en_html(corps(prenom, emission, ville)),
                     "send": True, "attachments": pieces})
        horo = datetime.datetime.now().isoformat(timespec="seconds")
        if res.get("ok"):
            faits += 1
            journal[adresse.lower()] = {"quand": horo, "émission": emission, "rôle": role,
                                        "conversation": res.get("conversation")}
            json.dump(journal, open(JOURNAL, "w"), ensure_ascii=False, indent=1)
            print(f"[{i}/{len(reste)}] {horo[11:]} ✓ {adresse:42s} {emission}", flush=True)
        else:
            echecs.append((adresse, res.get("erreur") or res))
            print(f"[{i}/{len(reste)}] {horo[11:]} ✗ {adresse:42s} "
                  f"{res.get('erreur') or res}", flush=True)
        if i < len(reste):
            time.sleep(pause)

    print(f"\n{faits} envoyés, {len(echecs)} en échec.", flush=True)
    for a, e in echecs:
        print(f"  {a} : {e}", flush=True)
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
