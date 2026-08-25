# Recoupement des avis Facebook avec tout ce qui est deja publie ou deja en file.
# Un meme auteur peut legitimement avoir plusieurs avis: ce n'est donc pas le nom qui
# disqualifie, c'est le nom ET la date, ou le texte lui-meme.
import json, csv, re, unicodedata, difflib
R = "../reviews"

def cle(t):
    t = unicodedata.normalize("NFD", t or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9 ]+", " ", t).strip()

connus = []          # (source, auteur, date, corps)
for a in json.load(open(f"{R}/judgeme_avis.json")):
    connus.append(("judge.me", a.get("auteur"), (a.get("date") or "")[:10], a.get("corps")))
for r in json.load(open(f"{R}/importes.json")):
    connus.append(("import 2025", r.get("nom"), (r.get("date") or "")[:10], r.get("corps")))
for f in ("import_judgeme.csv", "import_judgeme_boutique.csv", "import_judgeme_a_relire.csv"):
    for r in csv.DictReader(open(f"{R}/{f}", encoding="utf-8")):
        connus.append((f, r["reviewer_name"], r["review_date"][:10], r["body"]))

def meme_personne(nom_fb, auteur_jm):
    """Judge.me abrege les noms de facon variable: « Roland Baker », « Lucie B. »,
    « Julie M. D. », « Sophie B », « M. D. ». On considere que c'est la meme personne si le
    prenom concorde et que le reste de l'affichage est soit le nom de famille, soit
    uniquement des initiales de ce nom."""
    a = cle(nom_fb).split()
    b = cle(auteur_jm).split()
    if not a or not b: return False
    if a[0] != b[0]: return False
    if len(b) == 1: return False          # prenom nu: ne prouve rien sans la date
    reste_fb = " ".join(a[1:])
    reste_jm = " ".join(b[1:])
    if reste_fb == reste_jm: return True
    # que des initiales, chacune presente dans le nom de famille
    if all(len(x) == 1 for x in b[1:]):
        return all(x in reste_fb for x in b[1:])
    return False

def verdict(nom, date, corps, citations):
    """Pourquoi cet avis n'est pas a verser, ou None s'il l'est."""
    c = cle(corps)

    for src, auteur, d, texte in connus:
        t = cle(texte)
        if not c or not t: continue
        memeAuteur = meme_personne(nom, auteur)
        # L'inclusion ne prouve quelque chose que si le plus court des deux textes est
        # deja une phrase. « Merci » et « Tres satisfaite » se retrouvent dans la moitie
        # des avis du corpus: sans plancher, ils avalaient Isabelle Martineau et Dominique
        # Trottier. Entre auteurs differents, le plancher monte encore.
        court = min(len(c), len(t))
        seuil = 40 if memeAuteur else 60
        if court >= seuil and (c in t or t in c):
            return f"texte deja en ligne ({src}, {auteur}, {d})"
        # « Je suis tres satisfaite de mes mitaines » et « Je suis tres contente de mes
        # mitaines » se ressemblent a 0,8 et sont de deux personnes differentes. Entre
        # auteurs distincts, il faut la quasi-identite.
        if len(c) > 25 and difflib.SequenceMatcher(None, c, t).ratio() > (0.75 if memeAuteur else 0.92):
            return f"texte tres proche ({src}, {auteur}, {d})"
    if date:
        for src, auteur, d, texte in connus:
            if d != date: continue
            if meme_personne(nom, auteur) or cle(auteur).startswith(cle(nom).split(" ")[0]):
                return f"meme auteur le meme jour ({src}, {auteur}): {(texte or '')[:45]}"
    if not citations:
        return "la note ne garde qu'un resume, pas les mots du client"
    # Un fragment de trois mots n'est pas un avis: c'est un morceau arrache a une phrase
    # que la relecture n'a pas gardee. « magnifiques », « incroyable », « les meilleures ».
    if len(cle(corps)) < 30:
        return f"citation trop courte pour tenir seule: « {corps} »"
    return None

fb = json.load(open("avis_fb.json"))
aversers, ecartes = [], []
for a in fb:
    corps = max(a["citations"], key=len) if a["citations"] else a["resume"]
    m = verdict(a["nom"], a["date"], corps, a["citations"])
    (ecartes if m else aversers).append({**a, "corps": corps, "motif": m})
json.dump(aversers, open("candidats.json", "w"), ensure_ascii=False, indent=1)
json.dump(ecartes, open("ecartes.json", "w"), ensure_ascii=False, indent=1)
print(f"{len(fb)} auteurs | {len(aversers)} candidats | {len(ecartes)} ecartes")
print()
for a in aversers:
    print(f'  {(a["date"] or a["date_brute"])[:11]:12} {a["nom"][:24]:26} {a["corps"][:78]}')
