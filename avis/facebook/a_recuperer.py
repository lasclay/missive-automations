# Les avis Facebook qui ne sont ni sur Judge.me ni dans les fichiers en attente, mais dont
# la note de relecture ne donne qu'un resume ou un fragment. Le texte existe, il est sur la
# page Facebook: il suffit d'aller le chercher. Ce fichier dit exactement ou regarder.
import json, csv, re, unicodedata
R = "../reviews"
def cle(t):
    t = unicodedata.normalize("NFD", t or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9 ]+", " ", t).strip()

jm = json.load(open(f"{R}/judgeme_avis.json"))
attente = set()
for f in ("import_judgeme.csv", "import_judgeme_boutique.csv", "import_judgeme_a_relire.csv"):
    for r in csv.DictReader(open(f"{R}/{f}", encoding="utf-8")): attente.add(cle(r["reviewer_name"]))
for r in json.load(open(f"{R}/importes.json")): attente.add(cle(r.get("nom")))

livres = set()
for f in ("avis_fb_produits.csv", "avis_fb_boutique.csv"):
    for r in csv.DictReader(open(f, encoding="utf-8")): livres.add(cle(r["reviewer_name"]))
# « AnneJulie Frenette » sur Facebook, « Anne-Julie Frenette » dans le fichier livre.
livres_compact = {x.replace("-", " ").replace(" ", "") for x in livres}

# Ces trois-la ont bien une phrase citee, mais aucun client de ce nom dans Shopify, et
# Judge.me refuse une ligne sans adresse. Verifie fiche par fiche sur les 30 homonymes.
SANS_ADRESSE = {"Jean-François Laflamme", "Lise Forget", "Lise Larocque"}

lignes = [["auteur", "date_facebook", "ce_qui_manque", "ce_que_dit_la_note"]]
for a in json.load(open("avis_fb.json")):
    n = cle(a["nom"]); mots = n.split(" ")
    if n.replace("-", " ").replace(" ", "") in livres_compact: continue
    date = a["date"]
    # Le prenom seul ne prouve rien: il y a six « Marie-Helene » sur Judge.me. Seuls le nom
    # complet et la forme abregee « Prenom I. » identifient quelqu'un; le prenom nu ne compte
    # que s'il tombe le jour meme de l'avis Facebook (teste juste apres).
    formes = {n, f"{mots[0]} {mots[-1][0]}"}
    if any(cle(x.get("auteur")).rstrip(" .") in formes for x in jm): continue
    if date and any((x.get("date") or "")[:10] == date and cle(x.get("auteur")).startswith(mots[0]) for x in jm): continue
    if n in attente: continue
    if a["nom"] in SANS_ADRESSE:
        etat = "adresse: aucun client de ce nom dans Shopify"
    elif a["citations"]:
        etat = "texte: la note ne garde qu'un fragment"
    else:
        etat = "texte: la note ne garde qu'un resume"
    lignes.append([a["nom"], date or a["date_brute"], etat, a["resume"][:180]])

with open("avis_fb_a_recuperer.csv", "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows(lignes)
print("avis_fb_a_recuperer.csv :", len(lignes) - 1, "personnes")
for l in lignes[1:]: print(f"  {l[1]:12} {l[0]:26} {l[2]:20} {l[3][:70]}")
