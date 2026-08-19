# Prépare les données de la page de contrôle qualité à partir des fichiers de travail.
import json, os, glob, collections
S = os.path.dirname(os.path.abspath(__file__))
lire = lambda f, d: json.load(open(f"{S}/{f}")) if os.path.exists(f"{S}/{f}") else d

horo = lire("horodatage.json", {})
achats = {}
# Les releves d'achats arrivent par lots successifs : on balaie plutot que de les nommer.
for f in sorted(os.path.basename(x) for x in glob.glob(f"{S}/achats_*.json")):
    for m, v in lire(f, {}).items():
        achats.setdefault(m.lower().strip(), []).extend(v)
# Un nom qui contient une arobase n'est pas un nom : le publier exposerait l'adresse du client.
noms = {}
for f in sorted(os.path.basename(x) for x in glob.glob(f"{S}/noms*.json")):
    for m, n in lire(f, {}).items():
        if n and "@" not in str(n):
            noms[m.lower().strip()] = str(n).strip()
cat = {}
for l in open(f"{S}/catalogue.tsv"):
    p = l.rstrip("\n").split("\t")
    if len(p) >= 3:
        cat[p[0]] = p[2]

avis = []
for i in range(1, 21):
    p = f"{S}/redige_{i}.jsonl"
    if not os.path.exists(p):
        continue
    for l in open(p):
        if l.strip():
            a = json.loads(l); a["lot"] = i; avis.append(a)

out = []
for a in avis:
    mail = (a.get("courriel") or "").lower().strip()
    brut = (a.get("nom") or "").strip()
    nom = brut if (brut and "@" not in brut) else noms.get(mail, "")
    prods = [p for p in (a.get("produits") or []) if p]
    src = "texte"
    if not prods and mail and achats.get(mail):
        # L'avis parle de ce que la personne vient de recevoir : on prend la commande
        # la plus récente antérieure à sa date, pas tout son historique d'achats.
        jour = (a.get("date") or "")[:10]
        par = {}
        for x in achats[mail]:
            par.setdefault((x.get("commande") or "")[:10], []).append(x["handle"])
        d = sorted(par)
        av = [x for x in d if not jour or x <= jour]
        prods = sorted(set(par[av[-1]] if av else par[d[0]])) if d else []
        src = "commande"
    out.append({
        "t": a.get("titre") or "", "c": a.get("corps") or "", "n": a.get("note") or 5,
        "d": (horo.get(a["id"], {}) or {}).get(a.get("date"), (a.get("date") or "") + " 12:00:00 UTC"),
        "nom": nom, "sansNom": not nom, "mail": a.get("courriel") or "",
        "p": [{"h": h, "t": cat.get(h, h)} for h in prods],
        "src": src if prods else "aucun",
        "doute": (a.get("doute") or "")[:220], "lot": a["lot"],
    })

out.sort(key=lambda x: x["d"], reverse=True)
json.dump(out, open(f"{S}/qc.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("avis:", len(out), "| lignes:", sum(max(1, len(x["p"])) for x in out),
      "| sans nom:", sum(1 for x in out if x["sansNom"]),
      "|", dict(collections.Counter(x["src"] for x in out)))
