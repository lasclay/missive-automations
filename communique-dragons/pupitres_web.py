#!/usr/bin/env python3
"""Redactions et pupitres trouves par scrape, Quebec et Canada, forte autorite.

Les adresses viennent d'un scrape des pages « Contactez-nous », « Nous joindre »,
« Masthead » et « Notre equipe » de 43 sites, complete par recherche pour ceux
qui bloquent les robots. Les 11 domaines ont ete verifies par MX avant l'envoi.

Le texte change selon le media : la chaine d'approvisionnement pour la presse
d'affaires, l'habitat cree plutot que detruit pour la presse environnementale,
la plante indigene et les producteurs pour la presse agricole.

    python3 pupitres_web.py              simulation
    python3 pupitres_web.py --envoyer    envoie, un aux 15 secondes
"""
import datetime
import json
import os
import subprocess
import sys
import time

ICI = os.path.dirname(os.path.abspath(__file__))
CLIENT = os.path.join(os.path.dirname(ICI), "missive_client.js")
JOURNAL = os.path.join(ICI, "pupitres_web_journal.json")
DE = "media@lasclay.com"

SIG_FR = ("<br><br>Chaleureusement,<br>__<br>Gabriel Gouveia<br>Co-fondateur"
          "<br>+1 (581) 982-5857<br>Lasclay.com")
SIG_EN = ("<br><br>Warmly,<br>__<br>Gabriel Gouveia<br>Co-founder"
          "<br>+1 (581) 982-5857<br>Lasclay.com")
KIT = "https://drive.google.com/drive/folders/1pyCUbfHYQhpXXl4FoCC2RCFXKRvGS5Zr"

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

ENV_EN = ("Milkweed is a <a href=\"https://lasclay.com/en-us/pages/milkweed-plant-fiber\">"
          "weed native to eastern Canada</a>, and <a href=\"https://lasclay.com/en-us/"
          "pages/monarch-butterfly\">monarch caterpillars eat nothing else</a>, so growing "
          "it creates habitat instead of clearing it. Eastern monarch colonies in Mexico "
          "reached their highest level in 20 years after more than 1,000 hectares were "
          "planted in Quebec, Ontario and the United States. Quebec's milkweed industry "
          "then collapsed in a 2017 bankruptcy that had locked up 90% of the crop, and "
          "the growers absorbed it. We rebuilt the chain since, buying from the ones who "
          "stayed and processing the fibre in Quebec City.")
AFF_EN = ("The angle is the supply chain rather than the television. Milkweed is a "
          "<a href=\"https://lasclay.com/en-us/pages/milkweed-plant-fiber\">weed native to "
          "eastern Canada</a>, and <a href=\"https://lasclay.com/en-us/pages/monarch-"
          "butterfly\">monarch caterpillars eat nothing else</a>. Quebec's milkweed "
          "industry collapsed in a 2017 bankruptcy that had locked up 90% of the crop. We "
          "rebuilt a vertically integrated chain since: growers here, fibre processing in "
          "Quebec City, and more than 50 products sold across Canada and the United "
          "States, with no price premium that shoppers refuse to pay.")
GEN_EN = ("Milkweed is a <a href=\"https://lasclay.com/en-us/pages/milkweed-plant-fiber\">"
          "weed native to eastern Canada</a>, and <a href=\"https://lasclay.com/en-us/"
          "pages/monarch-butterfly\">monarch caterpillars eat nothing else</a>. Quebec's "
          "milkweed industry collapsed in a 2017 bankruptcy that had locked up 90% of the "
          "crop. We rebuilt the chain since: growers here, fibre processing in Quebec "
          "City, and more than 50 products sold across Canada and the United States.")
ENV_FR = ("L'asclépiade est une <a href=\"https://lasclay.com/pages/milkweed-asclepiade\">"
          "plante indigène</a>, et <a href=\"https://lasclay.com/pages/monarch-butterfly\">"
          "le monarque n'en mange aucune autre</a>, donc la cultiver crée de l'habitat au "
          "lieu d'en détruire. Les colonies au Mexique ont atteint leur meilleur niveau en "
          "20 ans après la plantation de plus de 1000 hectares. La filière québécoise s'est "
          "cassée à la faillite de 2017 ; on a rebâti depuis, avec des producteurs d'ici et "
          "la transformation de la fibre à Québec.")
AGRI_FR = ("C'est d'abord une histoire agricole. La filière québécoise de l'asclépiade "
           "s'est cassée à la faillite du groupe Protec-Style en 2017, qui exploitait "
           "l'usine de Saint-Tite sous le nom d'Encore 3 et avait réservé 90 % de la "
           "récolte. Les producteurs ont encaissé le coup. On achète chez ceux qui sont "
           "restés, on transforme la fibre à Québec, et une visibilité nationale se "
           "traduit directement en volumes pour eux.")

DISPO_FR = ("Je suis à Québec et disponible cette semaine. L'atelier de Limoilou est "
            "ouvert si vous voulez voir comment une gousse devient un manteau.")
DISPO_EN = ("I am available this week for an interview, and our Quebec City workshop is "
            "open if you want to see how a pod becomes a coat.")

# (adresse, media, langue, corps du milieu, objet)
PUPITRES = [
 ("editor@thenarwhal.ca", "The Narwhal", "en", ENV_EN,
  "A native weed that insulates coats, and rebuilt a broken supply chain"),
 ("editorial@corporateknights.com", "Corporate Knights", "en", AFF_EN,
  "A native weed that insulates coats: Quebec milkweed on Dragons' Den tonight"),
 ("tips@betakit.com", "BetaKit", "en", AFF_EN,
  "Quebec milkweed company on Dragons' Den tonight"),
 ("tips@thelogic.co", "The Logic", "en", AFF_EN,
  "Quebec milkweed company on Dragons' Den tonight"),
 ("mmaddever@brunico.com", "Strategy (Brunico)", "en", GEN_EN,
  "Quebec milkweed company on Dragons' Den tonight"),
 ("editors@blogto.com", "blogTO", "en", GEN_EN,
  "Quebec milkweed company on Dragons' Den tonight"),
 ("city.desk@freepress.mb.ca", "Winnipeg Free Press", "en", GEN_EN,
  "Quebec milkweed company on Dragons' Den tonight"),
 ("webnews@freepress.mb.ca", "Winnipeg Free Press, web", "en", GEN_EN,
  "Quebec milkweed company on Dragons' Den tonight"),
 ("editor@ricochet.media", "Ricochet", "fr", ENV_FR,
  "Une mauvaise herbe indigène qui isole des manteaux, à Dragons' Den ce soir"),
 ("presse@pivot.quebec", "Pivot", "fr", ENV_FR,
  "Une mauvaise herbe indigène qui isole des manteaux, à Dragons' Den ce soir"),
 ("vcauchy@laterre.ca", "La Terre de chez nous, pupitre", "fr", AGRI_FR,
  "Une culture d'asclépiade québécoise à Dragons' Den ce soir"),
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
              "pupitres_journal.json"):
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
            print(f"  · {a:34s} {m} [{lg}]")
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
            print(f"[{i}/{len(reste)}] {horo[11:]} ✓ {adresse:34s} {media}", flush=True)
        else:
            echecs.append((adresse, res.get("erreur") or res))
            print(f"[{i}/{len(reste)}] {horo[11:]} ✗ {adresse:34s} "
                  f"{res.get('erreur') or res}", flush=True)
        if i < len(reste):
            time.sleep(pause)

    print(f"\n{faits} envoyés, {len(echecs)} en échec.", flush=True)
    for a, e in echecs:
        print(f"  {a} : {e}", flush=True)
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
