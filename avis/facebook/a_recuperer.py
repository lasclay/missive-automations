# Les avis Facebook absents de Judge.me qu'on ne peut pas encore verser, et pourquoi.
import json, csv, re, unicodedata, difflib, sys
sys.argv = ["x"]
exec(open("recoupe2.py").read().split("fb = json.load")[0])

livres = set()
for f in ("avis_fb_produits.csv", "avis_fb_boutique.csv"):
    for r in csv.DictReader(open(f, encoding="utf-8")):
        livres.add(cle(r["reviewer_name"]).replace(" ", ""))

# Verifie fiche par fiche dans Shopify, au-dela du cinquieme homonyme.
SANS_ADRESSE = {"Jean-François Laflamme", "Lise Forget", "Lise Larocque", "Eric Ménard"}

lignes = [["auteur", "date_facebook", "ce_qui_manque", "ce_que_dit_la_note"]]
for a in json.load(open("avis_fb.json")):
    if cle(a["nom"]).replace(" ", "") in livres: continue
    corps = max(a["citations"], key=len) if a["citations"] else a["resume"]
    m = verdict(a["nom"], a["date"], corps, a["citations"])
    # « texte deja en ligne » et « meme auteur le meme jour » sont des avis deja publies:
    # rien a recuperer. Tout le reste manque de quelque chose, y compris les avis qui
    # passent le recoupement (m vaut None) mais dont je n'ai pas trouve l'adresse.
    if m and m.startswith(("texte deja", "texte tres proche", "meme auteur")): continue
    if a["nom"] in SANS_ADRESSE or (m is None and a["nom"] not in ("Lise Mascitelli",)):
        manque = "adresse: aucun client de ce nom dans Shopify"
    elif a["nom"] == "Lise Mascitelli":
        manque = "texte: la citation n'est qu'un bout de phrase"
    elif m.startswith("citation trop courte"):
        manque = "texte: la note ne garde qu'un fragment"
    else:
        manque = "texte: la note ne garde qu'un resume"
    lignes.append([a["nom"], a["date"] or a["date_brute"], manque, a["resume"][:190]])

with open("avis_fb_a_recuperer.csv", "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows(lignes)
print("avis_fb_a_recuperer.csv :", len(lignes) - 1, "personnes")
for l in lignes[1:]:
    print(f"  {l[1][:11]:12} {l[0][:25]:27} {l[2][:44]:46} {l[3][:56]}")
