# Vue tableur du gabarit Judge.me : reprend les deux CSV livres tels quels et
# ajoute deux colonnes de controle (_src, _badge) qui ne partent pas a l'import.
import csv, json, glob, os, sys, collections

S = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))

# Un badge « acheteur verifie » n'est accorde que si l'adresse a commande CE produit.
achats = collections.defaultdict(set)
for f in sorted(glob.glob(f"{S}/achats_*.json")):
    for m, v in json.load(open(f)).items():
        for x in v:
            h = x.get("handle") or x.get("produit") or x.get("product_handle")
            if h:
                achats[m.lower().strip()].add(h)

COL = ["title", "body", "rating", "review_date", "source", "curated",
       "reviewer_name", "reviewer_email", "product_id", "product_handle",
       "reply", "reply_date", "picture_urls", "ip_address", "location",
       "metaobject_handle"]

# assemble.js note, pour chaque ligne retenue, si le produit vient du texte du client
# ou de la commande qui precede son message.
prov = json.load(open(f"{S}/provenance.json")) if os.path.exists(f"{S}/provenance.json") else {}

rows = []
for fichier, src_defaut in (("import_judgeme.csv", None),
                            ("import_judgeme_boutique.csv", "boutique"),
                            ("import_judgeme_a_relire.csv", "relire")):
    p = f"{S}/{fichier}"
    if not os.path.exists(p):
        continue
    for r in csv.DictReader(open(p)):
        courriel = (r.get("reviewer_email") or "").lower().strip()
        handle = (r.get("product_handle") or "").strip()
        possede = achats.get(courriel)
        if src_defaut in ("boutique", "relire"):
            # Un avis de boutique ne vise aucun produit : la question du badge ne se pose pas.
            badge = src_defaut
        elif not possede:
            badge = "aucune"
        elif handle and handle in possede:
            badge = "badge"
        else:
            badge = "autre"
        cle = f'{courriel}|{handle}|{(r.get("review_date") or "")}'
        src = src_defaut or prov.get(cle, "texte")
        rows.append([r.get(c, "") for c in COL] + [src, badge])

rows.sort(key=lambda x: x[COL.index("review_date")], reverse=True)
json.dump({"col": COL + ["_src", "_badge"], "rows": rows},
          open(f"{S}/table.json", "w"), ensure_ascii=False, separators=(",", ":"))
c = collections.Counter(r[-1] for r in rows)
produits = len(rows) - c["boutique"] - c["relire"]
print("lignes:", len(rows), "| produit:", produits, "|", dict(c),
      "| provenance:", dict(collections.Counter(r[-2] for r in rows)),
      "| taux de badge: %d%%" % round(100 * c["badge"] / max(1, produits)))
