# Verse dans le pipeline les avis récupérés par le contre-examen des rejets.
# Chaque récupération rejoint le fichier du lot d'où le fil venait, pour que le contrôle
# mot à mot (verifie.py) puisse le recouper avec sa source.
import json, glob, os, re, collections

S = os.path.dirname(os.path.abspath(__file__))

# Quel fil appartient à quel lot.
lotDe = {}
for i in range(1, 21):
    for l in open(f"{S}/lot_{i}.jsonl"):
        if l.strip():
            lotDe[json.loads(l)["id"]] = i

# Ce qui est déjà retenu : on ne verse pas deux fois.
deja = set()
for i in range(1, 21):
    p = f"{S}/redige_{i}.jsonl"
    if os.path.exists(p):
        for l in open(p):
            if l.strip():
                deja.add(json.loads(l)["id"])

recup = []
for f in sorted(glob.glob(f"{S}/audit_[0-9].jsonl")) + sorted(glob.glob(f"{S}/audit_r[0-9].jsonl")):
    for l in open(f):
        if not l.strip():
            continue
        d = json.loads(l)
        if d.get("verdict") != "a_recuperer":
            continue
        if d["id"] in deja:
            continue
        if not (d.get("corps") or "").strip():
            continue
        d["_source"] = os.path.basename(f)
        recup.append(d)
        deja.add(d["id"])

parLot = collections.defaultdict(list)
sansLot = 0
for d in recup:
    i = lotDe.get(d["id"])
    if not i:
        sansLot += 1
        continue
    parLot[i].append(d)

for i, lot in parLot.items():
    with open(f"{S}/redige_{i}.jsonl", "a") as fh:
        for d in lot:
            fh.write(json.dumps({k: v for k, v in d.items()
                                 if k in ("id","titre","corps","note","date","nom","courriel","produits","doute")},
                                ensure_ascii=False) + "\n")

print(f"récupérations versées : {len(recup) - sansLot} | sans lot d'origine : {sansLot}")
print("par lot :", dict(sorted((k, len(v)) for k, v in parLot.items())))
