#!/usr/bin/env python3
"""Les redactions dont l'adresse etait masquee en JavaScript.

Cinq sites chiffraient leur adresse avec la protection courriel de Cloudflare :
un attribut data-cfemail contenant l'adresse en hexadecimal, chaque octet
XORe avec le premier. Ni curl ni le rendu de page ne les voient. Le script
cf.sh ramasse les chaines, un XOR les redonne en clair.

Ce qui en sort et qui vaut la peine : Canadian Geographic, The Tyee, Explore,
Ecohabitation, et KO Media qui publie L'actualite. Le reste etait de la
comptabilite, des droits d'auteur et de la vente de publicite.

    python3 pupitres_masques.py              simulation
    python3 pupitres_masques.py --envoyer    envoie, un aux 15 secondes
"""
import datetime
import json
import os
import subprocess
import sys
import time

ICI = os.path.dirname(os.path.abspath(__file__))
CLIENT = os.path.join(os.path.dirname(ICI), "missive_client.js")
JOURNAL = os.path.join(ICI, "pupitres_masques_journal.json")
DE = "media@lasclay.com"
KIT = "https://drive.google.com/drive/folders/1pyCUbfHYQhpXXl4FoCC2RCFXKRvGS5Zr"

SIG_FR = ("<br><br>Chaleureusement,<br>__<br>Gabriel Gouveia<br>Co-fondateur"
          "<br>+1 (581) 982-5857<br>Lasclay.com")
SIG_EN = ("<br><br>Warmly,<br>__<br>Gabriel Gouveia<br>Co-founder"
          "<br>+1 (581) 982-5857<br>Lasclay.com")

QUI_FR = ("Je m'appelle Gabriel Gouveia, fondateur de <a href=\"https://lasclay.com\">"
          "Lasclay</a>. On isole des vêtements d'hiver avec une mauvaise herbe, "
          "l'asclépiade, qu'on cultive pour sauvegarder un pollinisateur emblématique "
          "et menacé : le papillon monarque.")
QUI_EN = ("My name is Gabriel Gouveia, founder of <a href=\"https://lasclay.com/en-us\">"
          "Lasclay</a>. We insulate winter clothing with a weed called milkweed, which "
          "we grow to help save an emblematic, threatened pollinator: the monarch "
          "butterfly.")
ANN_FR = ("Ce soir, jeudi 17 septembre, je présente Lasclay dans le premier épisode de "
          "la 21e saison de Dragons' Den, sur CBC et CBC Gem.")
ANN_EN = ("Tonight, Thursday 17 September, I present Lasclay in the first episode of the "
          "21st season of Dragons' Den, on CBC and CBC Gem.")

NATURE_EN = ("Milkweed is a <a href=\"https://lasclay.com/en-us/pages/milkweed-plant-fiber\">"
             "weed native to eastern Canada</a>, and <a href=\"https://lasclay.com/en-us/"
             "pages/monarch-butterfly\">monarch caterpillars eat nothing else</a>. Eastern "
             "monarch colonies in Mexico reached their highest level in 20 years after "
             "more than 1,000 hectares were planted in Quebec, Ontario and the United "
             "States. Large milkweed fields are an unexpected habitat, and a rare case "
             "where harvesting a plant and protecting a species pull the same way: we "
             "cut after the monarchs have left for Mexico.")
GEAR_EN = ("The floss inside the pods is a hollow tube, 80% air, coated in a waterproof "
           "wax, and the fibres carry a charge that makes them repel each other. That is "
           "what traps heat. We process it in Quebec City and put it into coats, mitts, "
           "toques and cooler bags. It is a <a href=\"https://lasclay.com/en-us/pages/"
           "milkweed-plant-fiber\">plant native to eastern Canada</a>, and "
           "<a href=\"https://lasclay.com/en-us/pages/monarch-butterfly\">monarch "
           "caterpillars eat nothing else</a>, so the crop feeds the butterfly it saves.")
ECO_FR = ("L'asclépiade est une <a href=\"https://lasclay.com/pages/milkweed-asclepiade\">"
          "plante indigène</a>, et <a href=\"https://lasclay.com/pages/monarch-butterfly\">"
          "le monarque n'en mange aucune autre</a>, donc la cultiver crée de l'habitat au "
          "lieu d'en détruire. La soie de ses gousses est un tube creux à 80 %, enduit "
          "d'une cire hydrophobe : un isolant qui pousse tout seul, sans pétrole et sans "
          "élevage. La filière québécoise s'est cassée à la faillite de 2017 ; on a rebâti "
          "depuis, avec des producteurs d'ici et la transformation à Québec.")
GEN_FR = ("L'asclépiade est une <a href=\"https://lasclay.com/pages/milkweed-asclepiade\">"
          "plante indigène</a>, et <a href=\"https://lasclay.com/pages/monarch-butterfly\">"
          "le monarque n'en mange aucune autre</a>. Sa filière québécoise s'est cassée à "
          "la faillite du groupe Protec-Style en 2017, qui exploitait l'usine de "
          "Saint-Tite et avait réservé 90 % de la récolte. On a rebâti une chaîne "
          "complète depuis : des producteurs d'ici, la transformation de la fibre à "
          "Québec, et une gamme vendue au Canada et aux États-Unis.")

DISPO_FR = ("Je suis à Québec et disponible cette semaine. L'atelier de Limoilou est "
            "ouvert si vous voulez voir comment une gousse devient un manteau.")
DISPO_EN = ("I am available this week, and our Quebec City workshop is open if you want "
            "to see how a pod becomes a coat.")

# (adresse, media, langue, corps du milieu, objet)
PUPITRES = [
 ("editor@canadiangeographic.ca", "Canadian Geographic", "en", NATURE_EN,
  "Harvesting a weed to save the monarch: Quebec milkweed on Dragons' Den tonight"),
 ("info@thetyee.ca", "The Tyee", "en", NATURE_EN,
  "Harvesting a weed to save the monarch: Quebec milkweed on Dragons' Den tonight"),
 ("explore@explore-mag.com", "Explore Magazine", "en", GEAR_EN,
  "Winter insulation grown from a native weed, on Dragons' Den tonight"),
 ("media@ecohabitation.com", "Écohabitation", "fr", ECO_FR,
  "Un isolant qui pousse tout seul : l'asclépiade à Dragons' Den ce soir"),
 ("egiasson@ko-media.ca", "KO Média (L'actualité)", "fr", GEN_FR,
  "Une mauvaise herbe indigène qui isole des manteaux, à Dragons' Den ce soir"),
]


def corps(langue, milieu):
    if langue == "fr":
        return ("Bonjour,<br><br>" + QUI_FR + "<br><br>" + ANN_FR + "<br><br>" + milieu +
                "<br><br>" + DISPO_FR + f"<br><br><a href=\"{KIT}\">Notre média kit est "
                "ici</a>." + SIG_FR)
    return ("Hello,<br><br>" + QUI_EN + "<br><br>" + ANN_EN + "<br><br>" + milieu +
            "<br><br>" + DISPO_EN + f"<br><br><a href=\"{KIT}\">Our media kit is here</a>."
            + SIG_EN)


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
    pause = 15.0
    if "--pause" in argv:
        pause = float(argv[argv.index("--pause") + 1])
    journal = json.load(open(JOURNAL, encoding="utf-8")) if os.path.exists(JOURNAL) else {}
    deja = set(journal)
    for f in ("envoi_fr_journal.json", "envoi_en_journal.json", "emissions_journal.json",
              "pupitres_journal.json", "pupitres_web_journal.json"):
        c = os.path.join(ICI, f)
        if os.path.exists(c):
            deja |= set(k.lower() for k in json.load(open(c, encoding="utf-8")))

    reste = [p for p in PUPITRES if p[0].lower() not in deja]
    print(f"{len(PUPITRES)} pupitres, {len(PUPITRES) - len(reste)} déjà servis, "
          f"{len(reste)} à envoyer, un aux {pause:.0f} s.", flush=True)
    if not envoyer:
        a, m, lg, milieu, objet = reste[0]
        print(f"\n--- exemple : {a} ({m}) ---\n{objet}\n")
        print(corps(lg, milieu).replace("<br>", "\n"))
        print("\n--- la file ---")
        for a, m, lg, _, _ in reste:
            print(f"  · {a:32s} {m} [{lg}]")
        print("\nSimulation. Relancer avec --envoyer.")
        return 0

    faits, echecs = 0, []
    for i, (adresse, media, langue, milieu, objet) in enumerate(reste, 1):
        res = appel({"from": DE, "to": [adresse], "subject": objet,
                     "body": corps(langue, milieu), "send": True})
        horo = datetime.datetime.now().isoformat(timespec="seconds")
        if res.get("ok"):
            faits += 1
            journal[adresse.lower()] = {"quand": horo, "média": media,
                                        "conversation": res.get("conversation")}
            json.dump(journal, open(JOURNAL, "w"), ensure_ascii=False, indent=1)
            print(f"[{i}/{len(reste)}] {horo[11:]} ✓ {adresse:32s} {media}", flush=True)
        else:
            echecs.append((adresse, res.get("erreur") or res))
            print(f"[{i}/{len(reste)}] {horo[11:]} ✗ {adresse:32s} "
                  f"{res.get('erreur') or res}", flush=True)
        if i < len(reste):
            time.sleep(pause)

    print(f"\n{faits} envoyés, {len(echecs)} en échec.", flush=True)
    for a, e in echecs:
        print(f"  {a} : {e}", flush=True)
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
