# Les deux relectures ne citent pas les memes passages: la seconde resume parfois ce que la
# premiere citait, et l'inverse. On garde, pour chaque auteur, la plus longue citation vue
# dans l'une ou l'autre, et le resume le plus complet.
import json, unicodedata, re
def cle(t):
    t = unicodedata.normalize("NFD", t or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "", t)

fusion = {}
for f, source in (("fb_v1.json", "v1"), ("fb_v2.json", "v2")):
    for a in json.load(open(f)):
        k = cle(a["nom"])
        v = fusion.setdefault(k, {"nom": a["nom"], "date": None, "date_brute": a["date_brute"],
                                  "citations": [], "resume": "", "vu": []})
        v["vu"].append(source)
        if a["date"] and not v["date"]: v["date"] = a["date"]
        for c in a["citations"]:
            if not any(cle(c) in cle(x) for x in v["citations"]):
                v["citations"] = [x for x in v["citations"] if cle(x) not in cle(c)] + [c]
        if len(a["resume"]) > len(v["resume"]): v["resume"] = a["resume"]
        if len(a["nom"]) > len(v["nom"]): v["nom"] = a["nom"]

avis = list(fusion.values())
json.dump(avis, open("avis_fb.json", "w"), ensure_ascii=False, indent=1)
print("auteurs distincts apres fusion :", len(avis))
print("  presents dans les deux relectures :", sum(1 for a in avis if len(set(a["vu"])) == 2))
print("  avec au moins une citation        :", sum(1 for a in avis if a["citations"]))
gagne = [a for a in avis if a["citations"] and len(set(a["vu"])) == 2]
print("\ncitations recuperees en croisant les deux versions :")
v2 = {cle(a["nom"]): a for a in json.load(open("fb_v2.json"))}
for a in avis:
    if not a["citations"]: continue
    b = v2.get(cle(a["nom"]))
    if b is not None and not b["citations"]:
        print(f'  {a["nom"]:26} (v2 ne citait rien) « {" / ".join(a["citations"])[:70]} »')
