# Extrait les avis Facebook de la note de relecture. Seules les phrases entre guillemets
# sont des mots du client: le reste est le resume de la personne qui a regarde le Loom,
# et un resume ne peut pas devenir un avis signe par le client.
import re, json, unicodedata

MOIS = {"janvier":1,"fevrier":2,"mars":3,"avril":4,"mai":5,"juin":6,"juillet":7,
        "aout":8,"septembre":9,"octobre":10,"novembre":11,"decembre":12}
sansacc = lambda t: "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")

lignes = open("source.md", encoding="utf-8").read().split("\n")
annee = None
avis = []
for l in lignes:
    m = re.match(r"^## (\d{4})\s*$", l)
    if m: annee = int(m.group(1)); continue
    if not l.startswith("| ") or l.startswith("| Date") or set(l) <= set("| -"): continue
    p = [x.strip() for x in l.strip("|").split("|")]
    if len(p) != 3: continue
    date, auteur, texte = p
    if "non lisible" in auteur: continue
    nom = re.sub(r"\*\*", "", auteur).strip()
    # date
    jour = None
    md = re.match(r"(\d{1,2})\s+([a-zéûô]+)", sansacc(date.lower()))
    if md and md.group(2) in MOIS: jour = f"{annee}-{MOIS[md.group(2)]:02d}-{int(md.group(1)):02d}"
    else:
        md2 = re.search(r"\(?\s*(?:nov\.|mars)\s*(\d{4})?\)?", date.lower())
        jour = None
    citations = re.findall(r"«\s*(.+?)\s*»", texte)
    avis.append({"nom": nom, "date": jour, "date_brute": date,
                 "citations": citations, "resume": re.sub(r"\*\*|«|»", "", texte)})

# Les deux mises a jour hors tableau
avis.append({"nom":"Isabelle Martineau","date":None,"date_brute":"mise a jour 26 mai",
  "citations":["MISE À JOUR au 26 mai : j'ai enfin reçu mes mitaines ! Aussi satisfaite du produit que du service à la clientèle en amont. Merci Lasclay !"],
  "resume":"mitaines recues, satisfaite du produit et du service"})
avis.append({"nom":"Lise Larocque","date":None,"date_brute":"commentaire",
  "citations":["Très bon service, réponse rapide"],
  "resume":"mitaines recues a la date prevue"})

json.dump(avis, open("avis_fb.json","w"), ensure_ascii=False, indent=1)
avec = [a for a in avis if a["citations"]]
print("avis retenus (auteur lisible) :", len(avis))
print("  avec citation verbatim      :", len(avec))
print("  resume seulement            :", len(avis)-len(avec))
print("  sans date exploitable       :", sum(1 for a in avis if not a["date"]))
print()
for a in avec: print(f'  {a["date"] or a["date_brute"]:12} {a["nom"]:26} « {" / ".join(a["citations"])[:80]} »')
